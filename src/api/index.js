"use strict";

/**
 * Control Center API Boundary
 *
 * This layer exposes Runtime capabilities to future HTTP/UI adapters.
 * It MUST NOT execute connectors, shell commands, Gemini calls, or tools
 * directly. All execution remains owned by Runtime and its security gates.
 */

class ApiBoundary {
  constructor(runtime) {
    if (!runtime || typeof runtime !== "object") {
      throw new TypeError("ApiBoundary requires a Runtime instance");
    }

    this.runtime = runtime;
    this.version = "1.0.0";
    this.name = "ControlCenterApiBoundary";
  }

  getStatus() {
    if (typeof this.runtime.getStatus !== "function") {
      return {
        success: false,
        type: "runtime_status_unavailable"
      };
    }

    return {
      success: true,
      type: "runtime_status",
      status: this.runtime.getStatus()
    };
  }

  getCentralCoreStatus() {
    if (typeof this.runtime.getCentralCoreStatus !== "function") {
      return {
        success: false,
        type: "central_core_status_unavailable"
      };
    }

    return {
      success: true,
      type: "central_core_status",
      status: this.runtime.getCentralCoreStatus()
    };
  }

  async transcribeVoice(audio, context = {}) {
    if (
      !this.runtime ||
      typeof this.runtime.transcribeVoice !== "function"
    ) {
      return {
        success: false,
        type: "stt_runtime_unavailable",
        message: "Voice transcription runtime is unavailable.",
        executionAllowed: false,
        externalExecution: false,
        actionExecution: "plan_only",
        requiresApproval: true,
        failClosed: true,
      };
    }

    const result = await this.runtime.transcribeVoice(audio, context);

    if (
      result &&
      result.success === true &&
      typeof result.text === "string" &&
      typeof result.transcript !== "string"
    ) {
      return {
        ...result,
        transcript: result.text,
      };
    }

    return result;
  }

async synthesizeVoice(text, options = {}) {
    if (
      !this.runtime ||
      typeof this.runtime.synthesizeVoice !== "function"
    ) {
      return {
        success: false,
        type: "voice_runtime_capability_unavailable",
        executionAllowed: false,
        externalExecution: false,
        actionExecution: "presentation_only",
        requiresApproval: true,
        failClosed: true
      };
    }

    return this.runtime.synthesizeVoice(text, options);
  }

  async chat(prompt, options = {}) {
    if (!this.runtime || typeof this.runtime.chat !== "function") {
      return {
        success: false,
        type: "chat_runtime_unavailable",
        executionAllowed: false,
        externalExecution: false,
        failClosed: true,
        message: "مسار الدردشة في Runtime غير متاح."
      };
    }

    return this.runtime.chat(prompt, options);
  }

  chatStream(prompt, options = {}) {
    if (
      !this.runtime ||
      typeof this.runtime.chatStream !== "function"
    ) {
      return {
        success: false,
        type: "streaming_unavailable",
        executionAllowed: false,
        externalExecution: false,
        failClosed: true,
        message: "مسار Streaming غير متاح."
      };
    }

    return this.runtime.chatStream(prompt, options);
  }

  async cancelChat(requestId) {
    const id =
      typeof requestId === "string"
        ? requestId.trim()
        : "";

    if (!id) {
      return {
        success: false,
        type: "invalid_chat_cancel_request",
        executionAllowed: false,
        externalExecution: false,
        failClosed: true,
        message: "معرّف طلب المحادثة مطلوب."
      };
    }

    if (
      !this.runtime ||
      typeof this.runtime.cancelChat !== "function"
    ) {
      return {
        success: false,
        type: "chat_cancel_api_unavailable",
        executionAllowed: false,
        externalExecution: false,
        failClosed: true
      };
    }

    return this.runtime.cancelChat(id);
  }

  createChatApproval(prompt, options = {}) {
    if (
      !this.runtime ||
      typeof this.runtime.createChatApproval !== "function"
    ) {
      return {
        success: false,
        type: "chat_api_unavailable",
        executionAllowed: false,
        failClosed: true
      };
    }

    return this.runtime.createChatApproval(prompt, options);
  }

  async executeApprovedChat(approvalId, prompt, options = {}) {
    if (
      !this.runtime ||
      typeof this.runtime.executeApprovedChat !== "function"
    ) {
      return {
        success: false,
        type: "chat_execution_api_unavailable",
        executionAllowed: false,
        failClosed: true
      };
    }

    return this.runtime.executeApprovedChat(
      approvalId,
      prompt,
      options
    );
  }

  getApprovalStatus() {
    if (typeof this.runtime.getApprovalStatus !== "function") {
      return {
        success: false,
        type: "approval_status_unavailable"
      };
    }

    return {
      success: true,
      type: "approval_status",
      status: this.runtime.getApprovalStatus()
    };
  }

  getPendingApprovals() {
    if (typeof this.runtime.getPendingApprovals !== "function") {
      return {
        success: false,
        type: "pending_approvals_unavailable"
      };
    }

    return {
      success: true,
      type: "pending_approvals",
      items: this.runtime.getPendingApprovals()
    };
  }

  getSettings() {
    return this.runtime.getSettings();
  }

  getSettingsStatus() {
    return this.runtime.getSettingsStatus();
  }

  updateSettings(patch, context = {}) {
    return this.runtime.updateSettings(patch, context);
  }

  getDiagnosticStatus() {
    if (
      !this.runtime ||
      typeof this.runtime.getDiagnosticStatus !== "function"
    ) {
      return {
        success: false,
        type: "diagnostic_status_unavailable",
        failClosed: true
      };
    }

    return {
      success: true,
      type: "diagnostic_status",
      status: this.runtime.getDiagnosticStatus()
    };
  }

  getDiagnosticReport() {
    if (
      !this.runtime ||
      typeof this.runtime.getDiagnosticReport !== "function"
    ) {
      return {
        success: false,
        status: "FAIL",
        type: "diagnostic_report_unavailable",
        failClosed: true
      };
    }

    return this.runtime.getDiagnosticReport();
  }

  async runDiagnostic(options = {}) {
    if (
      !this.runtime ||
      typeof this.runtime.runDiagnostic !== "function"
    ) {
      return {
        success: false,
        status: "FAIL",
        type: "diagnostic_run_unavailable",
        failClosed: true
      };
    }

    return this.runtime.runDiagnostic(options);
  }

  getPlanRegistryStatus() {
    if (
      !this.runtime ||
      typeof this.runtime.getPlanRegistryStatus !== "function"
    ) {
      return {
        success: false,
        type: "plan_registry_status_unavailable",
        failClosed: true
      };
    }

    return {
      success: true,
      type: "plan_registry_status",
      status: this.runtime.getPlanRegistryStatus()
    };
  }

  getExecutionStatus() {
    if (
      !this.runtime ||
      typeof this.runtime.getExecutionStatus !== "function"
    ) {
      return {
        success: false,
        type: "execution_status_unavailable",
        failClosed: true
      };
    }

    return {
      success: true,
      type: "execution_status",
      status: this.runtime.getExecutionStatus()
    };
  }

  getExecutionHistory(limit = 20) {
    if (
      !this.runtime ||
      typeof this.runtime.getExecutionHistory !== "function"
    ) {
      return {
        success: false,
        type: "execution_history_unavailable",
        items: [],
        failClosed: true
      };
    }

    const safeLimit =
      Number.isInteger(limit) && limit >= 0 && limit <= 100
        ? limit
        : 20;

    return {
      success: true,
      type: "execution_history",
      items: this.runtime.getExecutionHistory(safeLimit)
    };
  }

  getRevenueStatus() {
    if (typeof this.runtime.getRevenueStatus !== "function") {
      return {
        success: false,
        type: "revenue_status_unavailable"
      };
    }

    return {
      success: true,
      type: "revenue_status",
      status: this.runtime.getRevenueStatus()
    };
  }

  listRevenueOpportunities() {
    if (typeof this.runtime.listRevenueOpportunities !== "function") {
      return {
        success: false,
        type: "revenue_opportunities_unavailable"
      };
    }

    return {
      success: true,
      type: "revenue_opportunities",
      items: this.runtime.listRevenueOpportunities()
    };
  }

  getRevenuePlans() {
    if (typeof this.runtime.getRevenuePlans !== "function") {
      return {
        success: false,
        type: "revenue_plans_unavailable"
      };
    }

    return {
      success: true,
      type: "revenue_plans",
      items: this.runtime.getRevenuePlans()
    };
  }

  getProjectWorkspaceStatus() {
    if (
      !this.runtime ||
      typeof this.runtime.getProjectWorkspaceStatus !== "function"
    ) {
      return {
        success: false,
        type: "project_workspace_api_unavailable",
        executionAllowed: false,
        failClosed: true
      };
    }

    return {
      success: true,
      type: "project_workspace_status",
      status: this.runtime.getProjectWorkspaceStatus()
    };
  }

  createProjectWorkspace(request = {}) {
    if (
      !this.runtime ||
      typeof this.runtime.createProjectWorkspace !== "function"
    ) {
      return {
        success: false,
        type: "project_workspace_api_unavailable",
        executionAllowed: false,
        failClosed: true
      };
    }

    return this.runtime.createProjectWorkspace(request);
  }

  getProjectWorkspace(id) {
    if (
      !this.runtime ||
      typeof this.runtime.getProjectWorkspace !== "function"
    ) {
      return {
        success: false,
        type: "project_workspace_api_unavailable",
        executionAllowed: false,
        failClosed: true
      };
    }

    return this.runtime.getProjectWorkspace(id);
  }

  listProjectWorkspaces(type = null) {
    if (
      !this.runtime ||
      typeof this.runtime.listProjectWorkspaces !== "function"
    ) {
      return {
        success: false,
        type: "project_workspace_api_unavailable",
        executionAllowed: false,
        failClosed: true
      };
    }

    return this.runtime.listProjectWorkspaces(type);
  }

  createDeveloperApproval(request = {}) {
    if (
      !this.runtime ||
      typeof this.runtime.createDeveloperApproval !== "function"
    ) {
      return {
        success: false,
        type: "developer_approval_api_unavailable",
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

    return this.runtime.createDeveloperApproval({
      task
    });
  }

  createRevenuePlanWithApproval(opportunityId, target = "online") {
    const normalizedOpportunityId =
      typeof opportunityId === "string"
        ? opportunityId.trim()
        : "";

    if (!normalizedOpportunityId) {
      return {
        success: false,
        type: "revenue_opportunity_id_required",
        failClosed: true
      };
    }

    if (
      typeof this.runtime.createRevenuePlanWithApproval !==
      "function"
    ) {
      return {
        success: false,
        type: "revenue_plan_approval_unavailable",
        failClosed: true
      };
    }

    return this.runtime.createRevenuePlanWithApproval(
      normalizedOpportunityId,
      target
    );
  }


  async executeApprovedDeveloper(approvalId) {
    if (
      !this.runtime ||
      typeof this.runtime.executeApprovedDeveloper !== "function"
    ) {
      return {
        success: false,
        type: "developer_execution_api_unavailable",
        executionAllowed: false,
        failClosed: true
      };
    }

    const id =
      typeof approvalId === "string"
        ? approvalId.trim()
        : "";

    if (!id) {
      return {
        success: false,
        type: "approval_id_required",
        executionAllowed: false,
        failClosed: true
      };
    }

    return this.runtime.executeApprovedDeveloper(id);
  }

  approve(approvalId) {
    if (typeof this.runtime.approve !== "function") {
      throw new Error("Runtime approval capability unavailable");
    }

    return this.runtime.approve(approvalId);
  }

  reject(approvalId) {
    if (typeof this.runtime.reject !== "function") {
      throw new Error("Runtime rejection capability unavailable");
    }

    return this.runtime.reject(approvalId);
  }

  getDevelopmentPipelineStatus() {
    if (
      !this.runtime ||
      typeof this.runtime.getDevelopmentPipelineStatus !== "function"
    ) {
      return {
        success: false,
        type: "development_pipeline_unavailable",
        failClosed: true
      };
    }

    return this.runtime.getDevelopmentPipelineStatus();
  }

  createDevelopmentPipelineApproval(request = {}) {
    if (
      !this.runtime ||
      typeof this.runtime.createDevelopmentPipelineApproval !== "function"
    ) {
      return {
        success: false,
        type: "development_pipeline_approval",
        failClosed: true,
        blocked: true,
        reason: "runtime_unavailable",
      };
    }

    return this.runtime.createDevelopmentPipelineApproval(request);
  }

  executeApprovedDevelopmentPipeline(approvalId) {
    if (
      !this.runtime ||
      typeof this.runtime.executeApprovedDevelopmentPipeline !== "function"
    ) {
      return Promise.resolve({
        success: false,
        type: "development_pipeline_execution",
        failClosed: true,
        blocked: true,
        reason: "runtime_unavailable",
      });
    }

    return this.runtime.executeApprovedDevelopmentPipeline(approvalId);
  }

  createDevelopmentPipelineRequest(request = {}) {
    if (
      !this.runtime ||
      typeof this.runtime.createDevelopmentPipelineRequest !== "function"
    ) {
      return {
        success: false,
        type: "development_pipeline_unavailable",
        failClosed: true
      };
    }

    return this.runtime.createDevelopmentPipelineRequest(request);
  }

  getDevelopmentPipelineRequest(id) {
    if (
      !this.runtime ||
      typeof this.runtime.getDevelopmentPipelineRequest !== "function"
    ) {
      return {
        success: false,
        type: "development_pipeline_unavailable",
        failClosed: true
      };
    }

    return this.runtime.getDevelopmentPipelineRequest(id);
  }

  listDevelopmentPipelineRequests(limit = 50) {
    if (
      !this.runtime ||
      typeof this.runtime.listDevelopmentPipelineRequests !== "function"
    ) {
      return {
        success: false,
        type: "development_pipeline_unavailable",
        failClosed: true
      };
    }

    return this.runtime.listDevelopmentPipelineRequests(limit);
  }

  getMetadata() {
    return {
      name: this.name,
      version: this.version,
      execution: {
        directExecution: false,
        externalExecution: false,
        autonomousExecution: false,
        requiresApproval: true
      }
    };
  }
}

module.exports = ApiBoundary;
