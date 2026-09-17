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
