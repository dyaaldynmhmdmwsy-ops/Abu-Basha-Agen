"use strict";

/**
 * Diagnostic Center — Repair Plan Engine
 *
 * Converts explicitly proven root-cause evidence into a repair plan.
 *
 * This engine does not:
 * - execute repairs
 * - modify files
 * - invent affected files
 * - invent tests
 * - invent root causes
 * - commit or push changes
 */

class RepairPlanEngine {
  constructor() {
    this.name = "repair-plan-engine";
    this.type = "diagnostic-repair-plan";
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

  _list(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(
      (item) =>
        typeof item === "string" &&
        item.trim().length > 0
    );
  }

  _ids(value) {
    if (!value || typeof value !== "object") {
      return {};
    }

    const ids = {};

    for (const [key, item] of Object.entries(value)) {
      if (
        typeof item === "string" &&
        item.trim().length > 0
      ) {
        ids[key] = item.trim();
      }
    }

    return ids;
  }

  _isReady(rootCause) {
    if (!rootCause || typeof rootCause !== "object") {
      return false;
    }

    const rootCauseText = this._text(rootCause.rootCause);
    const evidence = this._list(rootCause.evidence);
    const affectedFiles = this._list(rootCause.affectedFiles);

    const source = rootCause.source &&
      typeof rootCause.source === "object"
      ? rootCause.source
      : {};

    const requiredFix =
      this._text(rootCause.requiredFix) ||
      this._text(source.requiredFix) ||
      this._text(source.required_fix);

    const patchScope =
      this._text(rootCause.patchScope) ||
      this._text(source.patchScope) ||
      this._text(source.patch_scope);

    const targetedTest =
      this._text(rootCause.targetedTest) ||
      this._text(source.targetedTest) ||
      this._text(source.targeted_test);

    const securityImpact =
      this._text(rootCause.securityImpact) ||
      this._text(source.securityImpact) ||
      this._text(source.security_impact);

    const expectedResult =
      this._text(rootCause.expectedResult) ||
      this._text(source.expectedResult) ||
      this._text(source.expected_result);

    return Boolean(
      rootCauseText &&
      evidence.length > 0 &&
      affectedFiles.length > 0 &&
      requiredFix &&
      patchScope &&
      targetedTest &&
      securityImpact &&
      expectedResult
    );
  }

  _buildPlan(rootCause) {
    if (!this._isReady(rootCause)) {
      return null;
    }

    const source =
      rootCause.source &&
      typeof rootCause.source === "object"
        ? rootCause.source
        : {};

    return {
      findingId: rootCause.findingId || null,
      provider: rootCause.provider || null,
      classification: rootCause.classification || null,
      rootCause: this._text(rootCause.rootCause),

      evidence: this._list(rootCause.evidence),

      affectedFiles: this._list(rootCause.affectedFiles),

      requiredFix:
        this._text(rootCause.requiredFix) ||
        this._text(source.requiredFix) ||
        this._text(source.required_fix),

      patchScope:
        this._text(rootCause.patchScope) ||
        this._text(source.patchScope) ||
        this._text(source.patch_scope),

      targetedTest:
        this._text(rootCause.targetedTest) ||
        this._text(source.targetedTest) ||
        this._text(source.targeted_test),

      securityImpact:
        this._text(rootCause.securityImpact) ||
        this._text(source.securityImpact) ||
        this._text(source.security_impact),

      expectedResult:
        this._text(rootCause.expectedResult) ||
        this._text(source.expectedResult) ||
        this._text(source.expected_result),

      correlationIds: this._ids(rootCause.correlationIds),

      status: "READY_FOR_REPAIR"
    };
  }

  buildReport(rootCauseReport = {}) {
    if (
      !rootCauseReport ||
      typeof rootCauseReport !== "object"
    ) {
      return {
        success: false,
        status: "FAIL",
        type: "invalid_root_cause_report",
        failClosed: true,
        plans: [],
        unresolved: []
      };
    }

    const rootCauses = Array.isArray(
      rootCauseReport.rootCauses
    )
      ? rootCauseReport.rootCauses
      : [];

    const plans = [];
    const unresolved = [];

    for (const rootCause of rootCauses) {
      const plan = this._buildPlan(rootCause);

      if (plan) {
        plans.push(plan);
      } else {
        unresolved.push({
          findingId: rootCause?.findingId || null,
          provider: rootCause?.provider || null,
          reason: "repair_plan_requirements_not_explicitly_proven"
        });
      }
    }

    return {
      success: true,
      status: "PASS",
      type: "diagnostic_repair_plan_report",
      engine: this.name,
      version: this.version,
      failClosed: true,
      summary: {
        inputRootCauses: rootCauses.length,
        readyForRepair: plans.length,
        unresolved: unresolved.length
      },
      plans,
      unresolved
    };
  }

  analyze(rootCauseReport = {}) {
    return this.buildReport(rootCauseReport);
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

module.exports = RepairPlanEngine;
