"use strict";

/**
 * Diagnostic Center — Root-Cause Engine
 *
 * Root cause may only be promoted when supported by explicit evidence
 * and a correlated diagnostic context.
 *
 * This engine does not:
 * - execute repairs
 * - modify files
 * - infer arbitrary causes
 * - invent affected files
 * - invent tests
 */

const ALLOWED_CLASSIFICATIONS = Object.freeze([
  "PROVEN",
  "FAIL",
  "GAP",
  "RISK",
  "ASSUMPTION",
  "NEW_EVIDENCE"
]);

class RootCauseEngine {
  constructor() {
    this.name = "root-cause-engine";
    this.type = "diagnostic-root-cause";
    this.version = "1.0.0";

    this.safe = true;
    this.readOnly = true;
    this.autoFix = false;
    this.externalExecution = false;
    this.autonomousExecution = false;
    this.failClosed = true;
    this.requiresApproval = true;
  }

  _text(value) {
    if (typeof value !== "string") {
      return null;
    }

    const text = value.trim();
    return text.length > 0 ? text : null;
  }

  _classification(value) {
    return ALLOWED_CLASSIFICATIONS.includes(value)
      ? value
      : "ASSUMPTION";
  }

  _evidenceList(value) {
    if (Array.isArray(value)) {
      return value.filter(
        (item) =>
          typeof item === "string" &&
          item.trim().length > 0
      );
    }

    if (typeof value === "string" && value.trim()) {
      return [value.trim()];
    }

    return [];
  }

  _files(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(
      (item) =>
        typeof item === "string" &&
        item.trim().length > 0
    );
  }

  _findingSupported(finding) {
    if (!finding || typeof finding !== "object") {
      return false;
    }

    const classification = this._classification(
      finding.classification
    );

    const evidence = this._evidenceList(
      finding.evidence
    );

    const hasCorrelation =
      finding.ids &&
      typeof finding.ids === "object" &&
      Object.values(finding.ids).some(
        (value) =>
          typeof value === "string" &&
          value.trim().length > 0
      );

    return (
      (classification === "FAIL" ||
        classification === "NEW_EVIDENCE") &&
      evidence.length > 0 &&
      hasCorrelation
    );
  }

  _buildCause(finding) {
    if (!this._findingSupported(finding)) {
      return null;
    }

    const explicitRootCause =
      this._text(finding.source?.rootCause) ||
      this._text(finding.source?.root_cause);

    if (!explicitRootCause) {
      return null;
    }

    return explicitRootCause;
  }

  analyze(correlationReport = {}) {
    if (
      !correlationReport ||
      typeof correlationReport !== "object"
    ) {
      return {
        success: false,
        status: "FAIL",
        type: "invalid_correlation_report",
        failClosed: true,
        findings: [],
        rootCauses: []
      };
    }

    const findings = Array.isArray(
      correlationReport.findings
    )
      ? correlationReport.findings
      : [];

    const rootCauses = [];
    const unresolved = [];

    for (const finding of findings) {
      const cause = this._buildCause(finding);

      if (cause) {
        rootCauses.push({
          findingId: finding.findingId,
          provider: finding.provider || null,
          rootCause: cause,
          classification: this._classification(
            finding.classification
          ),
          evidence: this._evidenceList(
            finding.evidence
          ),
          affectedFiles: this._files(
            finding.affectedFiles
          ),

          requiredFix:
            this._text(finding.requiredFix) ||
            this._text(finding.source?.requiredFix) ||
            this._text(finding.source?.required_fix) ||
            null,

          patchScope:
            this._text(finding.patchScope) ||
            this._text(finding.source?.patchScope) ||
            this._text(finding.source?.patch_scope) ||
            null,

          targetedTest:
            this._text(finding.targetedTest) ||
            this._text(finding.source?.targetedTest) ||
            this._text(finding.source?.targeted_test) ||
            null,

          securityImpact:
            this._text(finding.securityImpact) ||
            this._text(finding.source?.securityImpact) ||
            this._text(finding.source?.security_impact) ||
            null,

          expectedResult:
            this._text(finding.expectedResult) ||
            this._text(finding.source?.expectedResult) ||
            this._text(finding.source?.expected_result) ||
            null,

          correlationIds:
            finding.ids &&
            typeof finding.ids === "object"
              ? { ...finding.ids }
              : {}
        });
      } else {
        unresolved.push({
          findingId: finding.findingId || null,
          provider: finding.provider || null,
          reason:
            this._findingSupported(finding)
              ? "root_cause_not_explicitly_proven"
              : "insufficient_proven_evidence",
          classification: this._classification(
            finding.classification
          )
        });
      }
    }

    return {
      success: true,
      status: "PASS",
      type: "diagnostic_root_cause_report",
      engine: this.name,
      version: this.version,
      failClosed: true,
      summary: {
        inputFindings: findings.length,
        provenRootCauses: rootCauses.length,
        unresolvedFindings: unresolved.length
      },
      rootCauses,
      unresolved
    };
  }

  buildReport(correlationReport = {}) {
    return this.analyze(correlationReport);
  }

  getStatus() {
    return {
      name: this.name,
      type: this.type,
      version: this.version,
      safe: this.safe,
      readOnly: this.readOnly,
      autoFix: this.autoFix,
      externalExecution: this.externalExecution,
      autonomousExecution: this.autonomousExecution,
      failClosed: this.failClosed,
      requiresApproval: this.requiresApproval
    };
  }
}

module.exports = RootCauseEngine;
