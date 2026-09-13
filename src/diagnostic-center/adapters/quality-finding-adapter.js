"use strict";

/**
 * Quality Provider -> Canonical Diagnostic Finding Adapter.
 *
 * Rules:
 * - Uses only explicit QualityProvider evidence.
 * - Never invents root cause, repair metadata, affected files, or IDs.
 * - Never executes repairs or external actions.
 */

class QualityFindingAdapter {
  constructor() {
    this.name = "quality-finding-adapter";
    this.readOnly = true;
    this.safe = true;
    this.failClosed = true;
  }

  adapt(result = {}) {
    if (!result || typeof result !== "object") {
      return [];
    }

    if (result.provider !== "quality") {
      return [];
    }

    const status = result.status;

    if (status !== "FAIL" && status !== "WARN") {
      return [];
    }

    const findings = [];

    if (Array.isArray(result.findings)) {
      for (const item of result.findings) {
        if (typeof item !== "string" || !item.trim()) {
          continue;
        }

        findings.push({
          provider: "quality",
          classification: status === "FAIL" ? "FAIL" : "RISK",
          severity: status === "FAIL" ? "HIGH" : "MEDIUM",
          title: "Quality Gate diagnostic finding",
          evidence: item.trim(),
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
    }

    return findings;
  }
}

module.exports = QualityFindingAdapter;
