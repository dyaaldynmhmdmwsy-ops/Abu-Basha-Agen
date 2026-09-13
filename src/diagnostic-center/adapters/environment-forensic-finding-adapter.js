"use strict";

class EnvironmentForensicFindingAdapter {
  constructor() {
    this.name = "environment-forensic-finding-adapter";
    this.readOnly = true;
    this.safe = true;
    this.failClosed = true;
  }

  adapt(result = {}) {
    if (!result || typeof result !== "object") return [];
    if (result.provider !== "environment-forensic") return [];

    const checks = Array.isArray(result.checks) ? result.checks : [];

    return checks
      .filter(
        (check) =>
          check &&
          (check.status === "FAIL" || check.status === "WARN")
      )
      .map((check) => {
        const classification =
          check.status === "FAIL" ? "FAIL" : "RISK";
        const severity =
          check.status === "FAIL" ? "HIGH" : "MEDIUM";

        const evidence =
          typeof check.evidence === "string" && check.evidence.trim()
            ? check.evidence.trim()
            : typeof check.message === "string" && check.message.trim()
              ? check.message.trim()
              : `Environment Forensic check "${
                  check.name || "unknown"
                }" returned ${check.status}.`;

        return {
          provider: "environment-forensic",
          classification,
          severity,
          title: `Environment Forensic diagnostic finding: ${
            check.name || "unnamed check"
          }`,
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
        };
      });
  }
}

module.exports = EnvironmentForensicFindingAdapter;
