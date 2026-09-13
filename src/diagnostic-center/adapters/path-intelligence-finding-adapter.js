"use strict";

/**
 * Path Intelligence Provider -> Canonical Diagnostic Finding Adapter.
 *
 * Uses only explicit provider check evidence.
 * Never invents root cause, repair metadata, affected files, or IDs.
 */

class PathIntelligenceFindingAdapter {
  constructor() {
    this.name = "path-intelligence-finding-adapter";
    this.readOnly = true;
    this.safe = true;
    this.failClosed = true;
  }

  adapt(result = {}) {
    if (!result || typeof result !== "object") {
      return [];
    }

    if (result.provider !== "path-intelligence") {
      return [];
    }

    if (!Array.isArray(result.checks)) {
      return [];
    }

    const findings = [];

    for (const check of result.checks) {
      if (!check || typeof check !== "object") {
        continue;
      }

      if (check.status !== "FAIL" && check.status !== "WARN") {
        continue;
      }

      findings.push({
        provider: "path-intelligence",
        classification: check.status === "FAIL" ? "FAIL" : "RISK",
        severity: check.status === "FAIL" ? "HIGH" : "MEDIUM",
        title: "Path Intelligence diagnostic finding",
        evidence: check,
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
      });
    }

    return findings;
  }
}

module.exports = PathIntelligenceFindingAdapter;
