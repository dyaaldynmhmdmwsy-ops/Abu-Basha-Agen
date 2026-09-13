"use strict";

/**
 * Diagnostic Center Evidence Engine
 *
 * Purpose:
 * - Normalize heterogeneous provider findings into one canonical evidence contract.
 * - Preserve the distinction between proven evidence and inference.
 * - Never invent root causes, repairs, affected files, or tests.
 * - Remain read-only and side-effect free.
 *
 * This module does NOT execute commands, modify files, access the network,
 * approve actions, or perform automatic repairs.
 */

const CLASSIFICATIONS = Object.freeze([
  "PROVEN",
  "FAIL",
  "GAP",
  "RISK",
  "ASSUMPTION",
  "NEW_EVIDENCE"
]);

const SEVERITIES = Object.freeze([
  "INFO",
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL"
]);

function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === undefined || value === null) {
    return [];
  }

  return [value];
}

function cleanText(value) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeClassification(value, fallback = "ASSUMPTION") {
  const normalized =
    typeof value === "string"
      ? value.trim().toUpperCase()
      : "";

  return CLASSIFICATIONS.includes(normalized)
    ? normalized
    : fallback;
}

function normalizeSeverity(value, fallback = "INFO") {
  const normalized =
    typeof value === "string"
      ? value.trim().toUpperCase()
      : "";

  return SEVERITIES.includes(normalized)
    ? normalized
    : fallback;
}

function normalizeList(value) {
  return asArray(value)
    .flatMap((item) => {
      if (item === undefined || item === null) {
        return [];
      }

      const text = cleanText(String(item));
      return text ? [text] : [];
    });
}

class EvidenceEngine {
  constructor(options = {}) {
    this.name = "evidence-engine";
    this.type = "diagnostic-evidence-engine";
    this.version = "1.0.0";

    this.safe = true;
    this.readOnly = true;
    this.autoFix = false;
    this.externalExecution = false;
    this.autonomousExecution = false;
    this.failClosed = true;

    this.classifications = [...CLASSIFICATIONS];
    this.severities = [...SEVERITIES];

    this.maxEvidenceItems =
      Number.isInteger(options.maxEvidenceItems) &&
      options.maxEvidenceItems > 0
        ? options.maxEvidenceItems
        : 500;
  }

  normalizeFinding(input = {}, context = {}) {
    const provider =
      cleanText(input.provider) ||
      cleanText(context.provider) ||
      "unknown";

    const source =
      cleanText(input.source) ||
      cleanText(context.source) ||
      provider;

    const rawStatus =
      typeof input.status === "string"
        ? input.status.trim().toUpperCase()
        : "";

    let classification =
      normalizeClassification(input.classification, "");

    if (!classification) {
      if (rawStatus === "FAIL") {
        classification = "FAIL";
      } else if (rawStatus === "WARN") {
        classification = "RISK";
      } else if (rawStatus === "PASS") {
        classification = "PROVEN";
      } else {
        classification = "ASSUMPTION";
      }
    }

    const evidence = normalizeList(
      input.evidence ??
      input.evidenceItems ??
      input.details
    );

    const affectedFiles = normalizeList(
      input.affectedFiles ??
      input.files ??
      input.paths
    );

    const findingId =
      cleanText(input.findingId) ||
      cleanText(input.id) ||
      `${provider}:${context.index ?? 0}`;

    return {
      findingId,
      provider,
      source,
      classification,
      severity: normalizeSeverity(input.severity),
      title:
        cleanText(input.title) ||
        cleanText(input.name) ||
        "Diagnostic finding",
      evidence,
      rootCause: cleanText(input.rootCause) || null,
      affectedFiles,
      requiredFix: cleanText(input.requiredFix) || null,
      patchScope: cleanText(input.patchScope) || null,
      targetedTest: cleanText(input.targetedTest) || null,
      securityImpact: cleanText(input.securityImpact) || null,
      expectedResult: cleanText(input.expectedResult) || null,

      correlationId:
        cleanText(input.correlationId) ||
        cleanText(input.metadata?.correlationId) ||
        null,

      sessionId:
        cleanText(input.sessionId) ||
        cleanText(input.metadata?.sessionId) ||
        null,

      approvalId:
        cleanText(input.approvalId) ||
        cleanText(input.metadata?.approvalId) ||
        null,

      planId:
        cleanText(input.planId) ||
        cleanText(input.metadata?.planId) ||
        null,

      confidence: cleanText(input.confidence) || null,
      status:
        cleanText(input.status) ||
        classification,
      sourceStatus:
        rawStatus || null,
      metadata:
        input.metadata && typeof input.metadata === "object"
          ? { ...input.metadata }
          : {}
    };
  }

  collect(providerResult, context = {}) {
    if (!providerResult || typeof providerResult !== "object") {
      return [];
    }

    const provider =
      cleanText(providerResult.provider) ||
      cleanText(context.provider) ||
      "unknown";

    const rawFindings = [];

    if (Array.isArray(providerResult.findings)) {
      rawFindings.push(...providerResult.findings);
    }

    if (Array.isArray(providerResult.checks)) {
      rawFindings.push(
        ...providerResult.checks.map((check) => ({
          ...check,
          provider
        }))
      );
    }

    if (
      rawFindings.length === 0 &&
      typeof providerResult.status === "string"
    ) {
      rawFindings.push({
        provider,
        status: providerResult.status,
        title: `${provider} provider status`,
        evidence: [
          `Provider returned status=${providerResult.status}.`
        ]
      });
    }

    return rawFindings
      .slice(0, this.maxEvidenceItems)
      .map((finding, index) =>
        this.normalizeFinding(finding, {
          ...context,
          provider,
          index
        })
      );
  }

  buildReport(providerResults = []) {
    const results = Array.isArray(providerResults)
      ? providerResults
      : [];

    const findings = [];

    results.forEach((result, providerIndex) => {
      findings.push(
        ...this.collect(result, {
          provider: result?.provider || `provider-${providerIndex}`,
          source: result?.provider || `provider-${providerIndex}`
        })
      );
    });

    const counts = Object.fromEntries(
      CLASSIFICATIONS.map((classification) => [
        classification,
        findings.filter(
          (finding) => finding.classification === classification
        ).length
      ])
    );

    return {
      engine: {
        name: this.name,
        type: this.type,
        version: this.version
      },
      safety: {
        safe: this.safe,
        readOnly: this.readOnly,
        autoFix: this.autoFix,
        externalExecution: this.externalExecution,
        autonomousExecution: this.autonomousExecution,
        failClosed: this.failClosed
      },
      totalFindings: findings.length,
      classificationCounts: counts,
      findings
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
      classifications: [...this.classifications],
      severities: [...this.severities],
      maxEvidenceItems: this.maxEvidenceItems
    };
  }
}

EvidenceEngine.CLASSIFICATIONS = CLASSIFICATIONS;
EvidenceEngine.SEVERITIES = SEVERITIES;

module.exports = EvidenceEngine;
