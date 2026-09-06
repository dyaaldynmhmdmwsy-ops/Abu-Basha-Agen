"use strict";

/**
 * Phase 24 — Architecture Governance
 *
 * Governance / inspection layer only.
 *
 * Hard boundaries:
 * - executable: false
 * - externalExecution: false
 * - autonomousExecution: false
 * - approvalRequired: true
 * - failClosed: true
 *
 * This phase does NOT execute tools, connectors,
 * system commands, or external actions.
 */

class ArchitectureGovernance {
  constructor(runtime = {}) {
    this.runtime = runtime;

    this.name = "Architecture Governance";
    this.version = "1.1.0";
    this.status = "online";

    this.policy = Object.freeze({
      safe: true,
      approvalRequired: true,
      requireApproval: true,
      executable: false,
      externalExecution: false,
      autonomousExecution: false,
      failClosed: true
    });

    this.history = [];
  }

  inspect() {
    const result = {
      phase: 24,
      component: this.name,

      safe: true,

      approvalRequired:
        this.policy.approvalRequired,

      requireApproval:
        this.policy.requireApproval,

      executable:
        this.policy.executable,

      externalExecution:
        this.policy.externalExecution,

      autonomousExecution:
        this.policy.autonomousExecution,

      failClosed:
        this.policy.failClosed,

      governanceOnly: true,

      historySize:
        this.history.length
    };

    this.history.push({
      type: "architecture_inspection",
      phase: 24,
      safe: true,
      executable: false,
      externalExecution: false,
      autonomousExecution: false
    });

    return {
      ...result,
      historySize: this.history.length
    };
  }

  validateCapability(capability = {}) {
    if (
      !capability ||
      typeof capability !== "object"
    ) {
      return {
        success: false,
        type: "invalid_capability",
        safe: true,
        executable: false,
        externalExecution: false,
        autonomousExecution: false,
        approvalRequired: true
      };
    }

    if (
      capability.externalExecution === true
    ) {
      return {
        success: false,
        type: "external_execution_blocked",
        safe: true,
        executable: false,
        externalExecution: false,
        autonomousExecution: false,
        approvalRequired: true
      };
    }

    if (
      capability.autonomousExecution === true
    ) {
      return {
        success: false,
        type: "autonomous_execution_blocked",
        safe: true,
        executable: false,
        externalExecution: false,
        autonomousExecution: false,
        approvalRequired: true
      };
    }

    if (
      capability.executable === true
    ) {
      return {
        success: false,
        type: "executable_capability_blocked",
        safe: true,
        executable: false,
        externalExecution: false,
        autonomousExecution: false,
        approvalRequired: true
      };
    }

    return {
      success: true,
      type: "capability_allowed",
      safe: true,
      executable: false,
      externalExecution: false,
      autonomousExecution: false,
      approvalRequired: true
    };
  }

  getHistory() {
    return [...this.history];
  }

  getStatus() {
    return this.inspect();
  }
}

module.exports = ArchitectureGovernance;
