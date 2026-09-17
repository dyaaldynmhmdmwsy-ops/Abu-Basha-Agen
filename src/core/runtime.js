const crypto = require("node:crypto");
require("../config");
const RevenueEngine = require("../revenue");
const ApprovalQueue = require("../approval");
const ExecutionGate = require("../security/execution-gate");
const ConnectorGateway = require("../connector-gateway");
"use strict";

const Master = require("../agents/master");
const PlanVerificationGate = require("../phase21");
const HumanApprovalGate = require("../phase22");
const SessionStateManager = require("../session-state");
const AbuBashaPod = require("../agents/pods/abu-basha");

const ConnectorPolicy = require("../connector-policy");
const PlanExecutor = require("../plan-executors");
const PlanRegistry = require("../plan-registry");
const DiagnosticCenter = require("../diagnostic-center");
const QualityProvider = require("../diagnostic-center/providers/quality-provider");

const DeveloperToolRegistry = require("../developer-tools");
const AppBuilderExecutor = require("../executors/app-builder-executor");
const {
  createDefaultDeveloperPlatform
} = require("../developer-platform");
const ConnectorHub = require("../connectors/hub");
const HubMockConnector = require("../connectors/hub/mock-connector");
const ConnectorResolver = require("../connectors/resolver");
const GeminiAdapter = require("../connectors/adapters/gemini-adapter");
const ResilienceManager = require("../resilience");
const AuditStore = require("../observability/audit-store");
class AgentRuntime {
  constructor(options = {}) {
    const projectRoot = options.projectRoot || process.cwd();
    const sessionStateOptions = options.dbPath
      ? { dbPath: options.dbPath }
      : {};

    // Phase 23: Host Context is optional for backward compatibility.
    // Legacy Termux/CLI execution continues to use process.cwd().
    this.projectRoot = projectRoot;


    // Phase 3: safe Master + Abu Basha Runtime ownership
    this.master = new Master();
    this.verificationGate = new PlanVerificationGate(this);
    this.approvalGate = new HumanApprovalGate(this);
    this.sessionState = new SessionStateManager(sessionStateOptions);
    this.auditStore = new AuditStore({ dbPath: this.sessionState.dbPath });
    this.abuBashaPod = new AbuBashaPod({ mode: this.master.mode });
    this.master.registerPod("abu-basha", this.abuBashaPod);

    // Safety boundary: external execution remains disabled.
    if (this.master.externalExecution === true) {
      throw new Error(
        "Phase 3 safety violation: Master external execution enabled."
      );
    }

    if (this.abuBashaPod.externalExecution === true) {
      throw new Error(
        "Phase 3 safety violation: Abu Basha external execution enabled."
      );
    }


    this.connectorPolicy = new ConnectorPolicy();
    this.revenue = new RevenueEngine();

    this.diagnosticCenter = new DiagnosticCenter();

    this.approvals = new ApprovalQueue();

    this.executionGate = new ExecutionGate({
      externalExecution: false,
      failClosed: true
    });

    this.developerTools = new DeveloperToolRegistry(this.executionGate);
    this.appBuilderExecutor = new AppBuilderExecutor(this);

    const developerPlatform = createDefaultDeveloperPlatform({
      registry: this.developerTools,
      rootDir: projectRoot
    });

    if (!developerPlatform.success) {
      throw new Error(
        `Developer Platform bootstrap failed: ${developerPlatform.type}`
      );
    }

    this.developerPlatform = developerPlatform;

    this.connectorHub = new ConnectorHub();

    this.connectorResolver = new ConnectorResolver(this.connectorHub);
    this.connectorGateway = new ConnectorGateway({
      hub: this.connectorHub,
      resolver: this.connectorResolver,
      policy: this.connectorPolicy,
      executionGate: this.executionGate,
        auditStore: this.auditStore
    });



    // PHASE2_MOCK_BOOTSTRAP
    // PHASE 2 FINAL CONNECTOR BOOTSTRAP
    // Keep Manager, Executor, Hub, Resolver and Policy synchronized.    // Gemini AI Connector
    const geminiConnector = new GeminiAdapter();
    this.geminiResilience = new ResilienceManager(this);
    this.geminiAdapter = geminiConnector;

    this.registerConnector(
      "gemini",
      geminiConnector,
      {
        category: "ai",
        description: "Google Gemini AI connector",
        version: "1.0.0",
        enabled: true,
        requiresApproval: true,
        externalExecution: true
      }
    );



    const mockConnector = new HubMockConnector("mock");

    this.registerConnector(
      "mock",
      mockConnector,
      {
        category: "system",
        description: "Safe simulated connector",
        version: "1.0.0",
        enabled: true,
        requiresApproval: false
      }
    );

    this.connectorResolver.register(
      "plan_execution",
      "mock"
    );

    this.connectorResolver.register(
      "execution",
      "mock"
    );

    this.connectorResolver.register(
      "gemini",
      "gemini"
    );

    this.connectorPolicy.allowConnector("gemini");



    this.planExecutor = new PlanExecutor(this);
    this.planExecutor.auditStore = this.auditStore;
    this.planRegistry = new PlanRegistry();
    this.master.attachPlanRegistry(this.planRegistry);

    this.startedAt = new Date().toISOString();
  }

  registerConnector(name, connector, metadata = {}) {
    /*
     * CANONICAL CONNECTOR REGISTRATION
     *
     * ConnectorHub is the single source of truth.
     * Resolver and Gateway consume the same Hub registry.
     */
    if (!this.connectorHub) {
      return {
        success: false,
        type: "connector_hub_unavailable"
      };
    }

    return this.connectorHub.register(
      name,
      connector,
      metadata
    );
  }
  unregisterConnector(name) {
    if (!this.connectorHub) return false;
    return this.connectorHub.unregister(name);
  }

  enableConnector(name) {
    const entry = this.connectorHub
      ? this.connectorHub.get(name)
      : null;

    if (!entry) return false;

    entry.metadata.enabled = true;
    return true;
  }

  disableConnector(name) {
    const entry = this.connectorHub
      ? this.connectorHub.get(name)
      : null;

    if (!entry) return false;

    entry.metadata.enabled = false;
    return true;
  }

  // =================================
  // Revenue Bridge
  // =================================

  listRevenueOpportunities() {
    return this.revenue.listOpportunities();
  }

  createRevenuePlan(opportunityId) {
    const opportunity = this.revenue
      .listOpportunities()
      .find(item => item.id === opportunityId);

    if (!opportunity) {
      return {
        success: false,
        type: "revenue_opportunity_not_found",
        message: "فرصة الربح غير موجودة"
      };
    }

    return this.revenue.createPlan(opportunityId);
  }

  getRevenuePlans() {
    return this.revenue.getPlans();
  }

  getRevenueStatus() {
    return this.revenue.getStatus();
  }


  async execute(action, payload = {}, options = {}) {
    return {
      success: false,
      type: "legacy_runtime_execution_disabled",
      executionAllowed: false,
      message:
        "مسار Runtime.execute القديم مغلق. استخدم المسار الموحد عبر PlanExecutor."
    };
  }
  /**
   * Canonical Control Center chat path.
   *
   * Chat NEVER executes Gemini directly.
   * Flow:
   *   user prompt
   *     -> Chat Plan
   *     -> Approval Queue
   *     -> explicit Runtime.approve()
   *     -> executeApproved()
   *     -> PlanExecutor
   *     -> ExecutionExecutor
   *     -> ConnectorGateway
   *     -> Gemini
   */
  createChatApproval(prompt, options = {}) {
    const text = typeof prompt === "string" ? prompt.trim() : "";

    if (!text) {
      return {
        success: false,
        type: "invalid_chat_prompt",
        message: "طلب الدردشة فارغ."
      };
    }

    const injectionDefense =
      this.injectionDefense ||
      (this.geminiAdapter && this.geminiAdapter.injectionDefense) ||
      null;

    if (
      injectionDefense &&
      typeof injectionDefense.inspect === "function"
    ) {
      const inspection = injectionDefense.inspect(text);

      if (!inspection || inspection.safe !== true) {
        return {
          success: false,
          type: "chat_input_rejected",
          executionAllowed: false,
          approvalRequired: true,
          failClosed: true
        };
      }
    }

    const chatPlanId = "chat_response";

    if (
      !this.planRegistry ||
      typeof this.planRegistry.register !== "function" ||
      typeof this.planRegistry.get !== "function"
    ) {
      return {
        success: false,
        type: "chat_plan_registry_unavailable",
        executionAllowed: false,
        failClosed: true
      };
    }

    if (!this.planRegistry.has(chatPlanId)) {
      const registration = this.planRegistry.register(chatPlanId, {
        name: "Chat Response",
        category: "ai",
        steps: [
          {
            name: "generate_response",
            label: "توليد رد الدردشة",
            type: "execution",
            tool: "gemini"
          }
        ]
      });

      if (!registration || registration.success !== true) {
        return {
          success: false,
          type: "chat_plan_registration_failed",
          executionAllowed: false,
          failClosed: true
        };
      }
    }

    const plan = {
      id: chatPlanId,
      name: "Chat Response",
      category: "ai",
      opportunityId: "chat",
      target: options.target || "user",
      goal: text,
      chatPromptHash: crypto
        .createHash("sha256")
        .update(text, "utf8")
        .digest("hex"),
      steps: this.planRegistry.get(chatPlanId).steps
    };

    const approval = this.createApproval(plan);

    if (!approval || approval.success !== true) {
      return {
        success: false,
        type: "chat_approval_creation_failed",
        executionAllowed: false,
        failClosed: true
      };
    }

    return {
      success: true,
      type: "chat_approval_required",
      approvalRequired: true,
      approved: false,
      executionAllowed: false,
      externalExecution: false,
      autonomousExecution: false,
      approval: approval.item,
      plan,
      message: "تم تجهيز رد الدردشة وينتظر موافقة المستخدم."
    };
  }

  async executeApprovedChat(approvalId, prompt, options = {}) {
    const text = typeof prompt === "string" ? prompt.trim() : "";

    if (!approvalId || !text) {
      return {
        success: false,
        type: "invalid_chat_execution_request",
        executionAllowed: false,
        failClosed: true
      };
    }

    const approval = this.approvals.getAll().find(
      item => item && item.id === approvalId
    );

    if (!approval) {
      return {
        success: false,
        type: "approval_not_found",
        executionAllowed: false
      };
    }

    if (approval.status !== "approved") {
      return {
        success: false,
        type: "approval_required",
        approvalRequired: true,
        approved: false,
        executionAllowed: false
      };
    }

    const approvedChatPromptHash =
      approval.plan &&
      typeof approval.plan.chatPromptHash === "string"
        ? approval.plan.chatPromptHash
        : null;

    const requestedChatPromptHash = crypto
      .createHash("sha256")
      .update(text, "utf8")
      .digest("hex");

    if (
      !approvedChatPromptHash ||
      approvedChatPromptHash !== requestedChatPromptHash
    ) {
      return {
        success: false,
        type: "chat_prompt_mismatch",
        approvalRequired: true,
        approved: false,
        executionAllowed: false,
        failClosed: true
      };
    }

    return this.executeApproved(
      approvalId,
      "chat_response",
      {
        prompt: text
      },
      {
        ...options,
        connector: "gemini",
        requiresApproval: true,
        approved: true
      }
    );
  }

  /**
   * E1.6-A
   * Classify the user's request before choosing a chat path.
   *
   * This classifier is intentionally conservative:
   * - ordinary conversation stays conversation
   * - explicit external-action language becomes an action proposal
   * - proposals never execute by themselves
   */
  classifyChatIntent(prompt) {
    const text = typeof prompt === "string" ? prompt.trim() : "";

    if (!text) {
      return {
        success: false,
        type: "invalid_chat_prompt"
      };
    }

    const normalized = text.toLowerCase();

    const actionVerbs = [
      "انشر",
      "نشر",
      "أرسل",
      "ارسل",
      "إرسال",
      "ارسال",
      "احذف",
      "حذف",
      "عدّل",
      "عدل",
      "تعديل",
      "حدّث",
      "حدث",
      "تحديث",
      "ارفع",
      "رفع",
      "حمّل",
      "حمل",
      "تحميل",
      "publish",
      "post",
      "send",
      "delete",
      "remove",
      "update",
      "upload"
    ];

    const externalTargets = [
      "فيسبوك",
      "facebook",
      "انستغرام",
      "إنستغرام",
      "instagram",
      "واتساب",
      "whatsapp",
      "تيليجرام",
      "telegram",
      "يوتيوب",
      "youtube",
      "تيك توك",
      "tiktok"
    ];

    const hasActionVerb = actionVerbs.some(
      verb => normalized.includes(verb)
    );

    const hasExternalTarget = externalTargets.some(
      target => normalized.includes(target)
    );

    const actionIntent = hasActionVerb && hasExternalTarget;

    if (!actionIntent) {
      return {
        success: true,
        intent: "conversation",
        approvalRequired: false,
        executionAllowed: false,
        externalExecution: false
      };
    }

    return {
      success: true,
      intent: "action",
      approvalRequired: true,
      executionAllowed: false,
      externalExecution: true,
      executable: false,
      proposal: {
        type: "action_proposal",
        prompt: text,
        requiresApproval: true,
        approvalRequired: true,
        executionAllowed: false,
        externalExecution: true,
        executable: false,
        detected: {
          hasActionVerb,
          hasExternalTarget
        }
      }
    };
  }

  /**
   * E1.6-A
   * Direct conversational inference.
   *
   * This is inference only. It does not create approval and does not
   * enter ConnectorGateway / PlanExecutor / external execution.
   */
  async chat(prompt, options = {}) {
    const text = typeof prompt === "string" ? prompt.trim() : "";

    if (!text) {
      return {
        success: false,
        type: "invalid_chat_prompt",
        message: "طلب الدردشة فارغ.",
        executionAllowed: false,
        externalExecution: false,
        failClosed: true
      };
    }

    const intent = this.classifyChatIntent(text);

    if (!intent.success) {
      return {
        success: false,
        type: intent.type,
        executionAllowed: false,
        externalExecution: false,
        failClosed: true
      };
    }

    if (intent.intent === "action") {
      return {
        success: true,
        type: "action_proposal",
        intent: "action",
        approvalRequired: true,
        executionAllowed: false,
        externalExecution: true,
        executable: false,
        proposal: intent.proposal
      };
    }

    if (
      !this.geminiAdapter ||
      typeof this.geminiAdapter.execute !== "function"
    ) {
      return {
        success: false,
        type: "ai_inference_unavailable",
        intent: "conversation",
        approvalRequired: false,
        executionAllowed: false,
        externalExecution: false,
        failClosed: true,
        message: "مسار استدلال المحادثة غير متاح."
      };
    }

    const resilienceResult = await this.geminiResilience.execute(
      () =>
        this.geminiAdapter.execute(
          {
            prompt: text,
            ...(options.payload || {})
          },
          {
            ...(options.context || {}),
            channel: "chat",
            intent: "conversation"
          }
        ),
      {
        ...(options.context || {}),
        channel: "chat",
        intent: "conversation",
        sessionId: options.context?.sessionId || null
      }
    );

    if (!resilienceResult || resilienceResult.success !== true) {
      return {
        success: false,
        type: resilienceResult?.type || "chat_inference_failed",
        intent: "conversation",
        approvalRequired: false,
        executionAllowed: false,
        externalExecution: false,
        failClosed: true,
        result: resilienceResult?.result || null,
        resilience: resilienceResult
      };
    }

    const inferenceResult = resilienceResult.result;

    if (!inferenceResult || inferenceResult.success !== true) {
      return {
        success: false,
        type: inferenceResult?.type || "chat_inference_failed",
        intent: "conversation",
        approvalRequired: false,
        executionAllowed: false,
        externalExecution: false,
        failClosed: true,
        result: inferenceResult || null,
        resilience: resilienceResult
      };
    }

    return {
      success: true,
      type: "conversation_response",
      intent: "conversation",
      approvalRequired: false,
      executionAllowed: false,
      externalExecution: false,
      text: inferenceResult.text || "",
      model: inferenceResult.model || null,
      result: inferenceResult,
      resilience: {
        attempts: resilienceResult.attempts,
        retried: resilienceResult.retried,
        maxRetries: resilienceResult.resilience?.maxRetries ?? null
      }
    };
  }

  /**
   * Backward-compatible AI entry point.
   */
  async askAI(prompt, options = {}) {
    return this.chat(prompt, options);
  }


  async executeApproved(approvalId, action, payload = {}, options = {}) {
    const approval = this.approvals.getAll().find(
      item => item.id === approvalId
    );

    if (!approval) {
      return {
        success: false,
        type: "approval_not_found",
        message: `الموافقة "${approvalId}" غير موجودة.`
      };
    }

    if (approval.status !== "approved") {
      return {
        success: false,
        type: "approval_required",
        message: "لا يمكن التنفيذ قبل موافقة المستخدم."
      };
    }

    /*
     * CANONICAL APPROVED EXECUTION PATH
     *
     * Approved execution must enter PlanExecutor.
     * Do not fall back to the legacy Runtime.execute() path.
     */
    const result = await this.planExecutor.execute(
      approvalId,
      payload,
      options
    );

    return {
      success: result.success === true,
      type: "approved_execution",
      approvalId,
      action,
      result
    };
  }

  async delegateToAbuBashaWithApproval(task = {}) {
    const result = await this.master.delegate(
      task,
      { pod: "abu-basha" }
    );

    if (!result || result.success !== true) {
      return result;
    }

    const plan = {
      id: `abu-basha-${Date.now()}`,
      name: "Abu Basha Delegation",
      type: "pod_delegation",
      pod: "abu-basha",
      task,
      proposal: result.proposal,
      executionAllowed: false,
      externalExecution: false,
      simulationOnly: true
    };

    const registration = this.planRegistry.register(plan.id, {
      name: plan.name,
      category: "pod_delegation",
      steps: [
        {
          name: "approved_pod_delegation",
          label: "تنفيذ التفويض بعد الموافقة",
          type: "control"
        }
      ]
    });

    if (!registration || registration.success !== true) {
      return {
        success: false,
        type: "delegation_plan_registration_failed",
        plan,
        registration
      };
    }

    const verification = this.verificationGate.verify(
      {
        goal: plan.name,
        executable: false,
        externalExecution: plan.externalExecution === true,
        steps: [
          {
            name: "approved_pod_delegation",
            type: "control",
            approvalRequired: true,
            executable: false,
            externalExecution: false
          }
        ]
      },
      {
        source: "master-delegation",
        planId: plan.id,
        pod: "abu-basha"
      }
    );

    if (!verification || verification.verified !== true) {
      return {
        success: false,
        type: "delegation_verification_failed",
        plan,
        registration,
        verification
      };
    }

    const coordination = this.master.prepareApproval({
      success: true,
      type: "plan_pod_proposal",
      planId: result.proposal.planId || plan.id,
      pod: "abu-basha",
      requiresApproval: true,
      executable: false,
      proposal: result.proposal
    });

    if (!coordination || coordination.success !== true) {
      return {
        success: false,
        type: "delegation_approval_coordination_failed",
        proposal: result.proposal,
        coordination
      };
    }

    const approvalRequest = this.approvalGate.requestApproval(
      verification,
      {
        planId: plan.id,
        pod: "abu-basha",
        source: "master-delegation"
      }
    );

    if (
      !approvalRequest ||
      approvalRequest.type !== "approval_request"
    ) {
      return {
        success: false,
        type: "approval_request_failed",
        plan,
        registration,
        verification,
        approvalRequest
      };
    }

    const approval = this.createApproval(plan);

    if (!approval || approval.success !== true) {
      return {
        success: false,
        type: "delegation_approval_failed",
        proposal: result.proposal,
        approval
      };
    }

    return {
      success: true,
      type: "delegation_approval_created",
      pod: "abu-basha",
      proposal: result.proposal,
      coordination,
      approval: approval.item
    };
  }

  // =================================
  // Approval Queue
  // =================================

  async executeApprovedDeveloper(approvalId) {
    const approval = this.approvals.getAll().find(
      item => item.id === approvalId
    );

    if (!approval) {
      return {
        success: false,
        type: "approval_not_found",
        executionAllowed: false,
        failClosed: true,
        message: `الموافقة "${approvalId}" غير موجودة.`
      };
    }

    if (approval.status !== "approved") {
      return {
        success: false,
        type: "approval_required",
        executionAllowed: false,
        failClosed: true,
        message: "لا يمكن تنفيذ مهمة التطوير قبل موافقة المستخدم."
      };
    }

    if (approval.planId !== "developer_coding") {
      return {
        success: false,
        type: "developer_plan_mismatch",
        executionAllowed: false,
        failClosed: true,
        message: "الموافقة لا تخص مسار التطوير البرمجي."
      };
    }

    const task =
      approval.plan &&
      typeof approval.plan.task === "string"
        ? approval.plan.task.trim()
        : "";

    if (!task) {
      return {
        success: false,
        type: "developer_task_missing",
        executionAllowed: false,
        failClosed: true,
        message: "مهمة التطوير غير موجودة داخل الموافقة."
      };
    }

    return this.executeApproved(
      approvalId,
      "developer_coding",
      { task },
      { approved: true }
    );
  }

  createApproval(plan) {
    return this.approvals.create(plan);
  }

  createDeveloperApproval(request = {}) {
    const plan = this.planRegistry.get("developer_coding");

    if (!plan) {
      return {
        success: false,
        type: "developer_plan_unavailable",
        executionAllowed: false,
        failClosed: true
      };
    }

    const task =
      request && typeof request.task === "string"
        ? request.task.trim()
        : "";

    if (!task) {
      return {
        success: false,
        type: "developer_task_required",
        executionAllowed: false,
        failClosed: true
      };
    }

    const approvalPlan = {
      id: plan.id,
      name: plan.name,
      category: plan.category,
      steps: plan.steps.map(step => ({
        ...step
      })),
      task
    };

    const approval = this.createApproval(approvalPlan);

    if (!approval || approval.success !== true) {
      return {
        success: false,
        type: "developer_approval_creation_failed",
        executionAllowed: false,
        failClosed: true,
        approval: approval || null
      };
    }

    return {
      success: true,
      type: "developer_coding_approval_created",
      approved: false,
      approvalRequired: true,
      executionAllowed: false,
      plan: approvalPlan,
      approval: approval.item || null
    };
  }

  createRevenuePlanWithApproval(opportunityId, target = "online") {
    const result = this.revenue.createPlan(
      opportunityId,
      target
    );

    if (!result || result.success === false) {
      return result;
    }

    this.planRegistry.register(result.plan.id, {
      name: result.plan.name,
      category: "revenue",
      steps: result.plan.steps.map((label, index) => ({
        name: [
          "analyze_opportunity",
          "define_requirements",
          "create_prototype",
          "test_prototype",
          "request_approval",
          "execute_after_approval"
        ][index] || `step_${index + 1}`,
        label,
        type: index === 4 ? "control" : "execution"
      }))
    });

    const approval = this.createApproval(result.plan);

    return {
      success: approval.success === true,
      type: "revenue_plan_approval_created",
      plan: result.plan,
      approval: approval.item || null
    };
  }

  approve(id) {
    return this.approvals.approve(id);
  }

  reject(id) {
    return this.approvals.reject(id);
  }

  getPendingApprovals() {
    return this.approvals.getPending();
  }


  getDiagnosticStatus() {
    if (
      !this.diagnosticCenter ||
      typeof this.diagnosticCenter.getStatus !== "function"
    ) {
      return {
        status: "unavailable",
        type: "diagnostic_center"
      };
    }

    return this.diagnosticCenter.getStatus();
  }

  getDiagnosticReport() {
    if (
      !this.diagnosticCenter ||
      typeof this.diagnosticCenter.getReport !== "function"
    ) {
      return {
        success: false,
        status: "FAIL",
        type: "diagnostic_report_unavailable",
        failClosed: true
      };
    }

    return this.diagnosticCenter.getReport();
  }

  async runDiagnostic(options = {}) {
    if (
      !this.diagnosticCenter ||
      typeof this.diagnosticCenter.run !== "function"
    ) {
      return {
        success: false,
        status: "FAIL",
        type: "diagnostic_run_unavailable",
        failClosed: true
      };
    }

    return this.diagnosticCenter.run(options);
  }

  getPlanRegistryStatus() {
    if (
      !this.planRegistry ||
      typeof this.planRegistry.getStatus !== "function"
    ) {
      return {
        status: "unavailable",
        type: "plan_registry"
      };
    }

    return this.planRegistry.getStatus();
  }

  getExecutionStatus() {
    if (
      !this.planExecutor ||
      typeof this.planExecutor.getStatus !== "function"
    ) {
      return {
        status: "unavailable",
        type: "plan_executor"
      };
    }

    return this.planExecutor.getStatus();
  }

  getExecutionHistory(limit = 20) {
    if (
      !this.planExecutor ||
      typeof this.planExecutor.getHistory !== "function"
    ) {
      return [];
    }

    return this.planExecutor.getHistory(limit);
  }


  getApprovalStatus() {
    return this.approvals.getStatus();
  }

  getCentralCoreStatus() {
    return {
      status: "online",
      runtime: "AgentRuntime",
      centralCore: true,
      master: !!this.master,
      executor: false,
      planExecutor: !!this.planExecutor,
      approvals: !!this.approvals,
      connectors: !!this.connectorHub,
      revenue: !!this.revenue,
      delegate: typeof this.delegateToAbuBashaWithApproval === "function",
      executeApproved: typeof this.executeApproved === "function",
      externalExecution: {
        master: this.master
          ? !!this.master.externalExecution
          : false,
        abuBasha: this.abuBashaPod
          ? !!this.abuBashaPod.externalExecution
          : false
      }
    };
  }

  getStatus() {
    return {
      status: "online",
      startedAt: this.startedAt,
      executor: {
        status: "disabled",
        type: "legacy_executor"
      },
      planExecutor: this.planExecutor
        ? {
            status: "online",
            name: this.planExecutor.name,
            version: this.planExecutor.version
          }
        : {
            status: "unavailable",
            type: "plan_executor"
          },
      connectors: this.connectorHub
        ? this.connectorHub.getStatus()
        : {
            status: "unavailable",
            type: "connector_hub"
          }
    };
  }
}

module.exports = AgentRuntime;
