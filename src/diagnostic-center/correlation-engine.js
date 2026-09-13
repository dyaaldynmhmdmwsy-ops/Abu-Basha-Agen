"use strict";

/**
 * Diagnostic Center — Cross-System Correlation Engine
 *
 * Purpose:
 * - Correlate diagnostic evidence that already carries explicit
 *   system identifiers.
 * - Never invent identifiers.
 * - Never execute project actions.
 * - Never modify project state.
 *
 * Safety:
 * - read-only
 * - fail-closed
 * - no external execution
 * - no autonomous execution
 * - no auto-fix
 */

const CORRELATION_KEYS = Object.freeze([
  "correlationId",
  "sessionId",
  "approvalId",
  "planId"
]);

const FINDING_CLASSES = Object.freeze([
  "PROVEN",
  "FAIL",
  "GAP",
  "RISK",
  "ASSUMPTION",
  "NEW_EVIDENCE"
]);

class CorrelationEngine {
  constructor() {
    this.name = "correlation-engine";
    this.type = "diagnostic-correlation";
    this.version = "1.0.0";

    this.safe = true;
    this.readOnly = true;
    this.autoFix = false;
    this.externalExecution = false;
    this.autonomousExecution = false;
    this.failClosed = true;
    this.requiresApproval = true;
  }

  _normalizeValue(value) {
    if (typeof value !== "string") {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  _extractIds(value = {}) {
    if (!value || typeof value !== "object") {
      return {};
    }

    const metadata =
      value.metadata && typeof value.metadata === "object"
        ? value.metadata
        : {};

    const ids = {};

    for (const key of CORRELATION_KEYS) {
      const direct = this._normalizeValue(value[key]);
      const nested = this._normalizeValue(metadata[key]);

      if (direct) {
        ids[key] = direct;
      } else if (nested) {
        ids[key] = nested;
      }
    }

    return ids;
  }

  _normalizeFinding(finding, providerIndex, findingIndex) {
    const source =
      finding && typeof finding === "object"
        ? finding
        : { value: finding };

    const ids = this._extractIds(source);

    return {
      findingId:
        this._normalizeValue(source.findingId) ||
        `finding-${providerIndex}-${findingIndex}`,
      provider:
        this._normalizeValue(source.provider) ||
        `provider-${providerIndex}`,
      classification:
        FINDING_CLASSES.includes(source.classification)
          ? source.classification
          : "ASSUMPTION",
      status:
        this._normalizeValue(source.status) || null,
      ids,
      evidence:
        Array.isArray(source.evidence)
          ? source.evidence
          : source.evidence == null
            ? []
            : [source.evidence],
      affectedFiles:
        Array.isArray(source.affectedFiles)
          ? source.affectedFiles
          : [],
      source
    };
  }

  collect(providerResults = []) {
    if (!Array.isArray(providerResults)) {
      return {
        success: false,
        status: "FAIL",
        type: "invalid_provider_results",
        failClosed: true,
        groups: [],
        findings: []
      };
    }

    const findings = [];

    providerResults.forEach((providerResult, providerIndex) => {
      if (!providerResult || typeof providerResult !== "object") {
        findings.push(
          this._normalizeFinding(
            {
              provider: `provider-${providerIndex}`,
              classification: "FAIL",
              status: "FAIL",
              evidence: ["Invalid provider result."]
            },
            providerIndex,
            0
          )
        );
        return;
      }

      const providerFindings = Array.isArray(providerResult.findings)
        ? providerResult.findings
        : [];

      if (providerFindings.length > 0) {
        providerFindings.forEach((finding, findingIndex) => {
          const normalized = this._normalizeFinding(
            {
              ...finding,
              provider:
                finding && typeof finding === "object" && finding.provider
                  ? finding.provider
                  : providerResult.provider
            },
            providerIndex,
            findingIndex
          );

          findings.push(normalized);
        });
        return;
      }

      const providerIds = this._extractIds(providerResult);

      if (Object.keys(providerIds).length > 0) {
        findings.push(
          this._normalizeFinding(
            {
              provider: providerResult.provider,
              classification:
                FINDING_CLASSES.includes(providerResult.classification)
                  ? providerResult.classification
                  : providerResult.status === "FAIL"
                    ? "FAIL"
                    : "PROVEN",
              status: providerResult.status,
              metadata: providerIds,
              evidence: providerResult.evidence || []
            },
            providerIndex,
            0
          )
        );
      }
    });

    return {
      success: true,
      status: "PASS",
      type: "correlation_collection",
      failClosed: true,
      groups: this._buildGroups(findings),
      findings
    };
  }

  _buildGroups(findings) {
    const groups = new Map();

    for (const finding of findings) {
      for (const key of CORRELATION_KEYS) {
        const value = finding.ids[key];

        if (!value) {
          continue;
        }

        const groupKey = `${key}:${value}`;

        if (!groups.has(groupKey)) {
          groups.set(groupKey, {
            key,
            value,
            findingIds: [],
            providers: [],
            classifications: [],
            affectedFiles: []
          });
        }

        const group = groups.get(groupKey);

        if (!group.findingIds.includes(finding.findingId)) {
          group.findingIds.push(finding.findingId);
        }

        if (!group.providers.includes(finding.provider)) {
          group.providers.push(finding.provider);
        }

        if (!group.classifications.includes(finding.classification)) {
          group.classifications.push(finding.classification);
        }

        for (const file of finding.affectedFiles) {
          if (
            typeof file === "string" &&
            file.trim() &&
            !group.affectedFiles.includes(file)
          ) {
            group.affectedFiles.push(file);
          }
        }
      }
    }

    return [...groups.values()];
  }

  buildReport(providerResults = []) {
    const collected = this.collect(providerResults);

    if (!collected.success) {
      return collected;
    }

    const groups = collected.groups;

    const multiFindingGroups = groups.filter(
      (group) => group.findingIds.length > 1
    );

    const uncorrelatedFindingIds = collected.findings
      .filter((finding) => Object.keys(finding.ids).length === 0)
      .map((finding) => finding.findingId);

    return {
      success: true,
      status: "PASS",
      type: "diagnostic_correlation_report",
      engine: this.name,
      version: this.version,
      failClosed: true,
      summary: {
        inputFindings: collected.findings.length,
        correlationGroups: groups.length,
        multiFindingGroups: multiFindingGroups.length,
        uncorrelatedFindings: uncorrelatedFindingIds.length
      },
      groups,
      multiFindingGroups,
      uncorrelatedFindingIds,
      findings: collected.findings
    };
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

module.exports = CorrelationEngine;
