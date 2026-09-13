"use strict";

/**
 * Independent Verification Gate.
 *
 * Purpose:
 * - Verify internal consistency of the diagnostic evidence chain.
 * - Never infer missing evidence.
 * - Never execute repairs.
 * - Never perform external/network execution.
 * - Fail closed.
 *
 * Verification states:
 * - PROVEN: required diagnostic chain is structurally complete
 *            and internally consistent.
 * - UNRESOLVED: required proof material is missing.
 * - CONTRADICTED: explicit downstream data conflicts with upstream data.
 */

class VerificationEngine {
  constructor() {
    this.name = "independent-verification";
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
    return typeof value === "string" && value.trim()
      ? value.trim()
      : null;
  }

  _list(value) {
    return Array.isArray(value)
      ? value.filter(item => typeof item === "string" && item.trim())
      : [];
  }

  _ids(value) {
    if (!value || typeof value !== "object") {
      return {};
    }

    const ids = {};

    for (const [key, item] of Object.entries(value)) {
      if (typeof item === "string" && item.trim()) {
        ids[key] = item.trim();
      }
    }

    return ids;
  }

  _sameList(a, b) {
    const left = this._list(a);
    const right = this._list(b);

    if (left.length !== right.length) {
      return false;
    }

    const rightSet = new Set(right);

    return left.every(item => rightSet.has(item));
  }

  _sameIds(a, b) {
    const left = this._ids(a);
    const right = this._ids(b);

    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();

    if (leftKeys.length !== rightKeys.length) {
      return false;
    }

    return leftKeys.every(
      key => left[key] === right[key]
    );
  }

  _verifyRepairPlan(rootCause, plan) {
    const fields = [
      "rootCause",
      "requiredFix",
      "patchScope",
      "targetedTest",
      "securityImpact",
      "expectedResult"
    ];

    for (const field of fields) {
      const rootValue = this._text(rootCause[field]);
      const planValue = this._text(plan[field]);

      if (!rootValue || !planValue) {
        return {
          state: "UNRESOLVED",
          reason: `missing_${field}`
        };
      }

      if (rootValue !== planValue) {
        return {
          state: "CONTRADICTED",
          reason: `repair_plan_${field}_conflicts_with_root_cause`
        };
      }
    }

    if (!this._sameList(rootCause.evidence, plan.evidence)) {
      return {
        state: "CONTRADICTED",
        reason: "repair_plan_evidence_conflicts_with_root_cause"
      };
    }

    if (!this._sameList(rootCause.affectedFiles, plan.affectedFiles)) {
      return {
        state: "CONTRADICTED",
        reason: "repair_plan_affected_files_conflict_with_root_cause"
      };
    }

    if (!this._sameIds(rootCause.correlationIds, plan.correlationIds)) {
      return {
        state: "CONTRADICTED",
        reason: "repair_plan_correlation_ids_conflict_with_root_cause"
      };
    }

    return {
      state: "PROVEN",
      reason: "repair_plan_consistent_with_root_cause"
    };
  }

  _verifyFinding(finding, rootCause, plan) {
    if (!finding || typeof finding !== "object") {
      return {
        state: "UNRESOLVED",
        findingStatus: "UNRESOLVED",
        rootCauseStatus: "NOT_APPLICABLE",
        repairStatus: "NOT_APPLICABLE",
        reason: "finding_missing_or_invalid"
      };
    }

    const classification = this._text(finding.classification);

    if (!classification) {
      return {
        state: "UNRESOLVED",
        findingStatus: "UNRESOLVED",
        rootCauseStatus: "NOT_APPLICABLE",
        repairStatus: "NOT_APPLICABLE",
        reason: "finding_classification_missing"
      };
    }

    const evidence = this._list(finding.evidence);

    /*
     * A non-failure finding can be independently verified when
     * its classification is explicit and its evidence is present.
     *
     * This does NOT invent a root cause or repair plan.
     */
    if (
      classification === "PASS" ||
      classification === "WARN" ||
      classification === "RISK" ||
      classification === "PROVEN"
    ) {
      if (evidence.length === 0) {
        return {
          state: "UNRESOLVED",
          findingStatus: "UNRESOLVED",
          rootCauseStatus: "NOT_APPLICABLE",
          repairStatus: "NOT_APPLICABLE",
          reason: "finding_has_no_evidence"
        };
      }

      return {
        state: "PROVEN",
        findingStatus: "PROVEN",
        rootCauseStatus: "NOT_APPLICABLE",
        repairStatus: "NOT_APPLICABLE",
        reason: "finding_classification_and_evidence_consistent"
      };
    }

    if (
      classification === "FAIL" ||
      classification === "NEW_EVIDENCE"
    ) {
      if (evidence.length === 0) {
        return {
          state: "UNRESOLVED",
          findingStatus: "UNRESOLVED",
          rootCauseStatus: "UNRESOLVED",
          repairStatus: "UNRESOLVED",
          reason: "proven_classification_has_no_evidence"
        };
      }

      const findingStatus = "PROVEN";

      if (!rootCause) {
        return {
          state: "UNRESOLVED",
          findingStatus,
          rootCauseStatus: "UNRESOLVED",
          repairStatus: "UNRESOLVED",
          reason: "root_cause_missing"
        };
      }

      if (!this._text(rootCause.rootCause)) {
        return {
          state: "UNRESOLVED",
          findingStatus,
          rootCauseStatus: "UNRESOLVED",
          repairStatus: "UNRESOLVED",
          reason: "root_cause_text_missing"
        };
      }

      if (!this._sameList(evidence, rootCause.evidence)) {
        return {
          state: "CONTRADICTED",
          findingStatus,
          rootCauseStatus: "CONTRADICTED",
          repairStatus: "CONTRADICTED",
          reason: "root_cause_evidence_conflicts_with_finding"
        };
      }

      const correlationIds = this._ids(
        finding.ids || finding.correlationIds
      );

      if (Object.keys(correlationIds).length === 0) {
        return {
          state: "UNRESOLVED",
          findingStatus,
          rootCauseStatus: "UNRESOLVED",
          repairStatus: "UNRESOLVED",
          reason: "correlation_identity_missing"
        };
      }

      if (
        !this._sameIds(
          correlationIds,
          rootCause.correlationIds
        )
      ) {
        return {
          state: "CONTRADICTED",
          findingStatus,
          rootCauseStatus: "CONTRADICTED",
          repairStatus: "CONTRADICTED",
          reason: "root_cause_correlation_conflicts_with_finding"
        };
      }

      if (!plan) {
        return {
          state: "UNRESOLVED",
          findingStatus,
          rootCauseStatus: "PROVEN",
          repairStatus: "UNRESOLVED",
          reason: "repair_plan_missing"
        };
      }

      const repairResult = this._verifyRepairPlan(
        rootCause,
        plan
      );

      return {
        ...repairResult,
        findingStatus,
        rootCauseStatus:
          repairResult.state === "CONTRADICTED"
            ? "CONTRADICTED"
            : "PROVEN",
        repairStatus: repairResult.state
      };
    }

    return {
      state: "UNRESOLVED",
      findingStatus: "UNRESOLVED",
      rootCauseStatus: "UNRESOLVED",
      repairStatus: "UNRESOLVED",
      reason: "unsupported_finding_classification"
    };
  }

  buildReport(input = {}) {
    if (!input || typeof input !== "object") {
      return {
        success: false,
        status: "FAIL",
        type: "invalid_verification_input",
        failClosed: true,
        findings: [],
        proven: [],
        unresolved: [],
        contradicted: []
      };
    }

    const findings = Array.isArray(input.findings)
      ? input.findings
      : [];

    const rootCauses =
      input.rootCause &&
      Array.isArray(input.rootCause.rootCauses)
        ? input.rootCause.rootCauses
        : [];

    const plans =
      input.repairPlan &&
      Array.isArray(input.repairPlan.plans)
        ? input.repairPlan.plans
        : [];

    const rootCauseById = new Map(
      rootCauses
        .filter(item => item && item.findingId)
        .map(item => [item.findingId, item])
    );

    const planById = new Map(
      plans
        .filter(item => item && item.findingId)
        .map(item => [item.findingId, item])
    );

    const proven = [];
    const unresolved = [];
    const contradicted = [];

    for (const finding of findings) {
      const findingId = finding?.findingId || null;

      const result = this._verifyFinding(
        finding,
        findingId ? rootCauseById.get(findingId) : null,
        findingId ? planById.get(findingId) : null
      );

      const item = {
        findingId,
        provider: finding?.provider || null,
        state: result.state,
        findingStatus: result.findingStatus,
        rootCauseStatus: result.rootCauseStatus,
        repairStatus: result.repairStatus,
        reason: result.reason
      };

      if (result.state === "PROVEN") {
        proven.push(item);
      } else if (result.state === "CONTRADICTED") {
        contradicted.push(item);
      } else {
        unresolved.push(item);
      }
    }

    let status = "PROVEN";

    if (contradicted.length > 0) {
      status = "CONTRADICTED";
    } else if (unresolved.length > 0) {
      status = "UNRESOLVED";
    }

    return {
      success: true,
      status,
      type: "diagnostic_independent_verification_report",
      engine: this.name,
      version: this.version,
      failClosed: true,

      summary: {
        inputFindings: findings.length,
        proven: proven.length,
        unresolved: unresolved.length,
        contradicted: contradicted.length
      },

      proven,
      unresolved,
      contradicted,

      safety: {
        safe: this.safe,
        readOnly: this.readOnly,
        autoFix: this.autoFix,
        externalExecution: this.externalExecution,
        autonomousExecution: this.autonomousExecution,
        failClosed: this.failClosed,
        requiresApproval: this.requiresApproval
      }
    };
  }

  getStatus() {
    return {
      name: this.name,
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

module.exports = VerificationEngine;
