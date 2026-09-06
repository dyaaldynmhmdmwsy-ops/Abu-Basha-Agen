"use strict";

/**
 * Master
 *
 * Role:
 *   High-level orchestrator.
 *
 * Responsibilities:
 *   - receive a task
 *   - classify/delegate it
 *   - coordinate Pods
 *   - return proposed actions
 *
 * Safety:
 *   - no direct external execution
 *   - no direct connector execution
 *   - no automatic social-media actions
 */

class Master {
  constructor(options = {}) {
    this.name = "master";
    this.type = "orchestrator";
    this.version = "1.0.0";

    // Phase 9 safety contract:
    // Master coordinates and proposes only.
    // It never performs external execution or bypasses approval.
    this.externalExecution = false;
    this.requiresApproval = true;

    this.mode = options.mode || "simulation";

    this.pods = new Map();
  }

  registerPod(name, pod) {
    if (!name || !pod) {
      throw new Error("Master: invalid Pod registration.");
    }

    if (this.pods.has(name)) {
      return {
        success: false,
        type: "pod_already_exists",
        pod: name
      };
    }

    this.pods.set(name, pod);

    return {
      success: true,
      type: "pod_registered",
      pod: name
    };
  }

  hasPod(name) {
    return this.pods.has(name);
  }

  listPods() {
    return [...this.pods.keys()];
  }

  normalizeRequest(request = {}) {
    if (typeof request === "string") {
      request = { text: request };
    }

    if (!request || typeof request !== "object") {
      return {
        success: false,
        type: "invalid_request"
      };
    }

    const text = typeof request.text === "string"
      ? request.text.trim()
      : "";

    const intent = typeof request.intent === "string" && request.intent.trim()
      ? request.intent.trim()
      : "unknown";

    if (!text && intent === "unknown") {
      return {
        success: false,
        type: "empty_request"
      };
    }

    return {
      success: true,
      type: "request_normalized",
      request: {
        text,
        intent,
        payload: request.payload && typeof request.payload === "object"
          ? request.payload
          : {},
        source: request.source || "text"
      }
    };
  }

  async understand(request = {}) {
    const normalized = this.normalizeRequest(request);

    if (!normalized.success) {
      return normalized;
    }

    return {
      success: true,
      type: "intent_understood",
      master: this.name,
      intent: normalized.request.intent,
      request: normalized.request
    };
  }

  proposePlan(request = {}) {
    const understood = this.normalizeRequest(request);

    if (!understood.success) {
      return understood;
    }

    return {
      success: true,
      type: "plan_proposal",
      master: this.name,
      requiresApproval: this.requiresApproval,
      executable: false,
      intent: understood.request.intent,
      request: understood.request
    };
  }

  resolvePlan(intent) {
    if (!this.planRegistry || typeof this.planRegistry.get !== "function") {
      return {
        success: false,
        type: "plan_registry_unavailable"
      };
    }

    const normalizedIntent = typeof intent === "string"
      ? intent.trim().toLowerCase()
      : "";

    const intentToPlan = {
      telegram: "telegram_service",
      telegram_service: "telegram_service",
      content: "content_service",
      content_service: "content_service",
      automation: "automation_service",
      automation_service: "automation_service",
      security: "security_research",
      security_research: "security_research"
    };

    const planId = intentToPlan[normalizedIntent];

    if (!planId) {
      return {
        success: false,
        type: "unsupported_intent",
        intent: normalizedIntent
      };
    }

    const plan = this.planRegistry.get(planId);

    if (!plan) {
      return {
        success: false,
        type: "plan_not_found",
        intent: normalizedIntent,
        planId
      };
    }

    return {
      success: true,
      type: "plan_resolved",
      intent: normalizedIntent,
      planId,
      plan
    };
  }

  proposeRegisteredPlan(request = {}) {
    const understood = this.normalizeRequest(request);

    if (!understood.success) {
      return understood;
    }

    const resolved = this.resolvePlan(understood.request.intent);

    if (!resolved.success) {
      return resolved;
    }

    return {
      success: true,
      type: "registered_plan_proposal",
      master: this.name,
      intent: understood.request.intent,
      planId: resolved.planId,
      plan: resolved.plan,
      requiresApproval: this.requiresApproval,
      executable: false,
      request: understood.request
    };
  }

  evaluatePlanPodCompatibility(plan, podName) {
    if (!plan || typeof plan !== "object") {
      return {
        success: false,
        type: "invalid_plan"
      };
    }

    if (!podName || typeof podName !== "string") {
      return {
        success: false,
        type: "invalid_pod"
      };
    }

    const approvedMappings = {
      content_service: "abu-basha"
    };

    const expectedPod = approvedMappings[plan.id];

    if (!expectedPod) {
      return {
        success: false,
        type: "plan_pod_compatibility_denied",
        planId: plan.id,
        pod: podName,
        reason: "No approved Plan → Pod mapping."
      };
    }

    if (expectedPod !== podName) {
      return {
        success: false,
        type: "plan_pod_mismatch",
        planId: plan.id,
        pod: podName,
        expectedPod
      };
    }

    const pod = this.pods.get(podName);

    if (!pod) {
      return {
        success: false,
        type: "pod_not_found",
        pod: podName,
        planId: plan.id
      };
    }

    if (pod.externalExecution === true) {
      return {
        success: false,
        type: "unsafe_pod",
        pod: podName,
        planId: plan.id
      };
    }

    if (pod.requiresApproval !== true) {
      return {
        success: false,
        type: "approval_contract_missing",
        pod: podName,
        planId: plan.id
      };
    }

    return {
      success: true,
      type: "plan_pod_compatible",
      planId: plan.id,
      pod: podName,
      requiresApproval: true,
      executable: false
    };
  }

  async proposePlanWithPod(request = {}, options = {}) {
    const planProposal = this.proposeRegisteredPlan(request);

    if (!planProposal.success) {
      return planProposal;
    }

    const podByPlan = {
      content_service: "abu-basha"
    };

    const podName = options.pod || podByPlan[planProposal.planId];

    if (!podName) {
      return {
        success: false,
        type: "pod_mapping_unavailable",
        planId: planProposal.planId
      };
    }

    const decision = this.evaluatePlanPodCompatibility(
      planProposal.plan,
      podName
    );

    if (!decision.success) {
      return decision;
    }

    const pod = this.pods.get(podName);

    if (!pod) {
      return {
        success: false,
        type: "pod_not_found",
        pod: podName,
        planId: planProposal.planId
      };
    }

    if (typeof pod.propose !== "function") {
      return {
        success: false,
        type: "pod_not_executable",
        pod: podName,
        planId: planProposal.planId
      };
    }

    const podProposal = await pod.propose({
      ...planProposal.request,
      planId: planProposal.planId,
      plan: planProposal.plan
    });

    if (!podProposal || podProposal.success !== true) {
      return {
        success: false,
        type: "pod_proposal_failed",
        pod: podName,
        planId: planProposal.planId,
        proposal: podProposal
      };
    }

    return {
      success: true,
      type: "plan_pod_proposal",
      master: this.name,
      intent: planProposal.intent,
      planId: planProposal.planId,
      plan: planProposal.plan,
      pod: podName,
      proposal: podProposal,
      requiresApproval: true,
      executable: false
    };
  }

  prepareApproval(proposal) {
    if (!proposal || typeof proposal !== "object") {
      return {
        success: false,
        type: "invalid_proposal"
      };
    }

    if (proposal.success !== true) {
      return {
        success: false,
        type: "proposal_not_ready"
      };
    }

    if (proposal.executable === true) {
      return {
        success: false,
        type: "unsafe_proposal_state"
      };
    }

    if (proposal.requiresApproval !== true) {
      return {
        success: false,
        type: "approval_required_contract_missing"
      };
    }

    if (!proposal.pod || !proposal.planId) {
      return {
        success: false,
        type: "approval_context_incomplete"
      };
    }

    return {
      success: true,
      type: "approval_request",
      master: this.name,
      planId: proposal.planId,
      pod: proposal.pod,
      requiresApproval: true,
      executable: false,
      proposal
    };
  }

  attachPlanRegistry(registry) {
    if (!registry || typeof registry.register !== "function") {
      return {
        success: false,
        type: "invalid_plan_registry"
      };
    }

    this.planRegistry = registry;

    return {
      success: true,
      type: "plan_registry_attached",
      owner: "runtime"
    };
  }

  registerPlanProposal(id, definition) {
    if (!this.planRegistry) {
      return {
        success: false,
        type: "plan_registry_unavailable"
      };
    }

    if (!id || !definition || !Array.isArray(definition.steps)) {
      return {
        success: false,
        type: "invalid_plan_proposal"
      };
    }

    const result = this.planRegistry.register(id, definition);

    return {
      ...result,
      type: result.success === true
        ? "plan_registered"
        : "plan_registration_failed",
      master: this.name
    };
  }

  async delegate(task, options = {}) {
    if (!task || typeof task !== "object") {
      return {
        success: false,
        type: "invalid_task"
      };
    }

    const podName = options.pod || task.pod;

    if (!podName) {
      return {
        success: false,
        type: "pod_required",
        message: "Master requires a target Pod."
      };
    }

    const pod = this.pods.get(podName);

    if (!pod) {
      return {
        success: false,
        type: "pod_not_found",
        pod: podName
      };
    }

    if (typeof pod.propose !== "function") {
      return {
        success: false,
        type: "pod_not_executable",
        pod: podName
      };
    }

    /*
     * Delegation only produces a proposal.
     * It does not execute an external action.
     */
    const proposal = await pod.propose(task);

    return {
      success: true,
      type: "delegated",
      master: this.name,
      pod: podName,
      mode: this.mode,
      proposal
    };
  }

  getStatus() {
    return {
      name: this.name,
      type: this.type,
      version: this.version,
      mode: this.mode,
      externalExecution: this.externalExecution,
      requiresApproval: this.requiresApproval,
      pods: this.listPods()
    };
  }
}

module.exports = Master;
