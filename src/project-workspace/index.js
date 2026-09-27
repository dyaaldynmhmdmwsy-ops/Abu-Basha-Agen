"use strict";

/**
 * Project Workspace Service v1.0.0
 *
 * Phase 30A:
 * Canonical internal contract for Coding / Editing / Studio.
 *
 * IMPORTANT:
 * - No shell execution.
 * - No connector execution.
 * - No GitHub/GitLab calls.
 * - No credential access.
 * - No autonomous external execution.
 * - Mutations are state/specification only.
 * - Actual execution remains behind Approval -> Executor.
 */

const crypto = require("crypto");

const WORKSPACE_TYPES = new Set([
  "coding",
  "editing",
  "studio"
]);

const PROJECT_PLATFORMS = new Set([
  "web",
  "api",
  "android",
  "ios",
  "node",
  "python",
  "generic"
]);

class ProjectWorkspaceService {
  constructor() {
    this.name = "Project Workspace Service";
    this.version = "1.0.0";
    this.status = "online";
    this.failClosed = true;
    this.externalExecution = false;
    this.autonomousExecution = false;
    this.requiresApproval = true;
    this.workspaces = new Map();
  }

  createWorkspace(input = {}) {
    const type = String(input.type || "").trim().toLowerCase();

    if (!WORKSPACE_TYPES.has(type)) {
      return {
        success: false,
        type: "workspace_type_not_allowed",
        executionAllowed: false,
        failClosed: true
      };
    }

    const name = String(input.name || "").trim();

    if (!name) {
      return {
        success: false,
        type: "workspace_name_required",
        executionAllowed: false,
        failClosed: true
      };
    }

    const platform = String(
      input.platform || "generic"
    ).trim().toLowerCase();

    if (!PROJECT_PLATFORMS.has(platform)) {
      return {
        success: false,
        type: "project_platform_not_allowed",
        executionAllowed: false,
        failClosed: true
      };
    }

    const id = `workspace_${crypto.randomUUID()}`;

    const workspace = {
      id,
      type,
      name,
      platform,
      projectPath: null,
      repository: null,
      tools: [],
      capabilities: [],
      execution: {
        externalExecution: false,
        autonomousExecution: false,
        requiresApproval: true,
        executionAllowed: false
      },
      status: "defined",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.workspaces.set(id, workspace);

    return {
      success: true,
      type: "workspace_created",
      workspace
    };
  }

  getWorkspace(id) {
    const workspace = this.workspaces.get(String(id || ""));
    if (!workspace) {
      return {
        success: false,
        type: "workspace_not_found",
        executionAllowed: false,
        failClosed: true
      };
    }

    return {
      success: true,
      type: "workspace",
      workspace
    };
  }

  listWorkspaces(type = null) {
    const normalizedType =
      type === null || type === undefined
        ? null
        : String(type).trim().toLowerCase();

    if (
      normalizedType !== null &&
      !WORKSPACE_TYPES.has(normalizedType)
    ) {
      return {
        success: false,
        type: "workspace_type_not_allowed",
        executionAllowed: false,
        failClosed: true
      };
    }

    const items = [...this.workspaces.values()].filter(
      workspace =>
        normalizedType === null ||
        workspace.type === normalizedType
    );

    return {
      success: true,
      type: "workspace_list",
      items
    };
  }

  getStatus() {
    return {
      name: this.name,
      version: this.version,
      status: this.status,
      failClosed: this.failClosed,
      externalExecution: this.externalExecution,
      autonomousExecution: this.autonomousExecution,
      requiresApproval: this.requiresApproval,
      totalWorkspaces: this.workspaces.size
    };
  }
}

module.exports = ProjectWorkspaceService;
