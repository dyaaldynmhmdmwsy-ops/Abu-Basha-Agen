"use strict";

const crypto = require("crypto");

const PIPELINE_VERSION = "1.0.0";

const SUPPORTED_ACTIONS = Object.freeze([
  "build",
  "test",
  "debug",
  "release"
]);

const SUPPORTED_WORKSPACES = Object.freeze([
  "coding",
  "editing",
  "studio"
]);

class DevelopmentPipelineService {
  constructor(options = {}) {
    this.name = "DevelopmentPipelineService";
    this.version = PIPELINE_VERSION;
    this.failClosed = true;
    this.externalExecution = false;
    this.autonomousExecution = false;
    this.requiresApproval = true;
    this.workspaceRoot = options.workspaceRoot || null;
    this.history = [];
  }

  _normalizeAction(action) {
    return String(action || "").trim().toLowerCase();
  }

  _normalizeWorkspace(workspace) {
    return String(workspace || "").trim().toLowerCase();
  }

  _validateRequest(request = {}) {
    const action = this._normalizeAction(request.action);
    const workspace = this._normalizeWorkspace(request.workspace);
    const projectId =
      typeof request.projectId === "string" ? request.projectId.trim() : "";

    if (!SUPPORTED_ACTIONS.includes(action)) {
      return {
        success: false,
        type: "unsupported_pipeline_action",
        failClosed: true,
        externalExecution: false,
        requiresApproval: true
      };
    }

    if (!SUPPORTED_WORKSPACES.includes(workspace)) {
      return {
        success: false,
        type: "unsupported_pipeline_workspace",
        failClosed: true,
        externalExecution: false,
        requiresApproval: true
      };
    }

    return {
      success: true,
      action,
      workspace,
      projectId
    };
  }

  createRequest(request = {}) {
    const validation = this._validateRequest(request);

    if (!validation.success) {
      return validation;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const record = {
      id,
      action: validation.action,
      workspace: validation.workspace,
      projectId: validation.projectId,
      status: "pending_approval",
      failClosed: true,
      externalExecution: false,
      autonomousExecution: false,
      requiresApproval: true,
      createdAt: now,
      updatedAt: now
    };

    this.history.push(record);

    return {
      success: true,
      type: "development_pipeline_request",
      request: { ...record },
      failClosed: true,
      externalExecution: false,
      requiresApproval: true
    };
  }

  getRequest(id) {
    const requestId = String(id || "").trim();

    if (!requestId) {
      return {
        success: false,
        type: "invalid_pipeline_request_id",
        failClosed: true
      };
    }

    const record = this.history.find((item) => item.id === requestId);

    if (!record) {
      return {
        success: false,
        type: "pipeline_request_not_found",
        failClosed: true
      };
    }

    return {
      success: true,
      request: { ...record },
      failClosed: true
    };
  }

  listRequests(limit = 50) {
    const safeLimit = Number.isInteger(limit)
      ? Math.max(1, Math.min(limit, 100))
      : 50;

    return {
      success: true,
      requests: this.history
        .slice(-safeLimit)
        .reverse()
        .map((item) => ({ ...item })),
      failClosed: true
    };
  }

  getStatus() {
    return {
      success: true,
      name: this.name,
      version: this.version,
      supportedActions: [...SUPPORTED_ACTIONS],
      supportedWorkspaces: [...SUPPORTED_WORKSPACES],
      failClosed: true,
      externalExecution: false,
      autonomousExecution: false,
      requiresApproval: true,
      executable: false,
      executionBoundary: "approval-required"
    };
  }
}

module.exports = DevelopmentPipelineService;
