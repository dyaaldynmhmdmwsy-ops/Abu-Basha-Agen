"use strict";

/**
 * Project Audit Provider -> Canonical Diagnostic Finding Adapter.
 *
 * Uses only explicit provider status/output.
 * Never invents root cause, repair metadata, affected files, or IDs.
 */

class ProjectAuditFindingAdapter {
  constructor() {
    this.name = "project-audit-finding-adapter";
    this.readOnly = true;
    this.safe = true;
    this.failClosed = true;
  }

  adapt(result = {}) {
    if (!result || typeof result !== "object") {
      return [];
    }

    if (result.provider !== "project-audit") {
      return [];
    }

    const status = result.status;

    if (status !== "FAIL" && status !== "WARN") {
      return [];
    }

    const evidence =
      typeof result.stdout === "string" && result.stdout.trim()
        ? result.stdout.trim()
        : `Project Audit provider returned status=${status}.`;

    return [{
      provider: "project-audit",
      classification: status === "FAIL" ? "FAIL" : "RISK",
      severity: status === "FAIL" ? "HIGH" : "MEDIUM",
      title: "Project Audit diagnostic finding",
      evidence,
      rootCause: null,
      affectedFiles: [],
      requiredFix: null,
      patchScope: null,
      targetedTest: null,
      securityImpact: null,
      expectedResult: null,
      correlationId: null,
      sessionId: null,
      approvalId: null,
      planId: null
    }];
  }
}

module.exports = ProjectAuditFindingAdapter;
