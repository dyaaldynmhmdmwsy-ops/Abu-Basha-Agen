"use strict";

/**
 * Central Execution Gate v2.0.0
 *
 * Fail-closed boundary for executable/mutating operations.
 * Read-only operations may explicitly opt out of approval.
 */
class ExecutionGate {
  constructor(options = {}) {
    this.name = "Central Execution Gate";
    this.version = "2.0.0";
    this.status = "online";

    this.externalExecution = options.externalExecution === true;
    this.failClosed = options.failClosed !== false;
  }

  check({
    requiresApproval = true,
    approved = false,
    externalExecution = false,
    operation = null,
    context = {}
  } = {}) {
    if (this.failClosed !== true) {
      return this.deny(
        "fail_closed_required",
        "Execution Gate يجب أن يعمل بوضع fail-closed."
      );
    }

    if (this.externalExecution === true) {
      return this.deny(
        "external_execution_blocked",
        "التنفيذ الخارجي مغلق."
      );
    }

    if (
      externalExecution === true &&
      approved !== true
    ) {
      return this.deny(
        "approval_required",
        "التنفيذ الخارجي يحتاج موافقة المستخدم."
      );
    }

    if (
      requiresApproval === true &&
      approved !== true
    ) {
      return this.deny(
        "approval_required",
        "هذه العملية تحتاج موافقة المستخدم."
      );
    }

    return {
      success: true,
      type: "execution_allowed",
      executionAllowed: true,
      operation,
      approved: approved === true,
      context
    };
  }

  deny(type, message) {
    return {
      success: false,
      type,
      executionAllowed: false,
      message
    };
  }

  getStatus() {
    return {
      name: this.name,
      version: this.version,
      status: this.status,
      failClosed: this.failClosed,
      externalExecution: this.externalExecution
    };
  }
}

module.exports = ExecutionGate;
