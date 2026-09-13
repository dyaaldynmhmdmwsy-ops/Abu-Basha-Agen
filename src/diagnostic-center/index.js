"use strict";

const ProjectAuditProvider = require("./providers/project-audit-provider");
const EnvironmentForensicProvider = require("./providers/environment-forensic-provider");
const PathIntelligenceProvider = require("./providers/path-intelligence-provider");
const QualityProvider = require("./providers/quality-provider");
const EvidenceEngine = require("./evidence-engine");
const CorrelationEngine = require("./correlation-engine");
const RootCauseEngine = require("./root-cause-engine");
const RepairPlanEngine = require("./repair-plan-engine");
const VerificationEngine = require("./verification-engine");
const QualityFindingAdapter = require("./adapters/quality-finding-adapter");
const ProjectAuditFindingAdapter = require("./adapters/project-audit-finding-adapter");
const EnvironmentForensicFindingAdapter = require("./adapters/environment-forensic-finding-adapter");
const PathIntelligenceFindingAdapter = require("./adapters/path-intelligence-finding-adapter");

/**
 * Diagnostic Center
 * Unified diagnostic orchestration contract.
 *
 * Safety boundary:
 * - Read/inspect/diagnose/report only.
 * - No automatic repair.
 * - No external execution.
 * - No autonomous execution.
 * - Fail-closed.
 */

class DiagnosticCenter {
  constructor(options = {}) {
    this.name = "diagnostic-center";
    this.type = "diagnostic-orchestrator";
    this.version = "1.0.0";

    this.mode = options.mode || "diagnostic";
    this.providers = new Map();

    this.evidenceEngine = new EvidenceEngine();
    this.correlationEngine = new CorrelationEngine();
    this.rootCauseEngine = new RootCauseEngine();
    this.repairPlanEngine = new RepairPlanEngine();
    this.verificationEngine = new VerificationEngine();
    this.qualityFindingAdapter = new QualityFindingAdapter();
    this.projectAuditFindingAdapter = new ProjectAuditFindingAdapter();
    this.environmentForensicFindingAdapter = new EnvironmentForensicFindingAdapter();
    this.pathIntelligenceFindingAdapter = new PathIntelligenceFindingAdapter();

    this._validateDiagnosticEngine(
      "evidence",
      this.evidenceEngine,
      ["buildReport", "getStatus"]
    );
    this._validateDiagnosticEngine(
      "correlation",
      this.correlationEngine,
      ["buildReport", "getStatus"]
    );
    this._validateDiagnosticEngine(
      "root-cause",
      this.rootCauseEngine,
      ["buildReport", "getStatus"]
    );
    this._validateDiagnosticEngine(
      "repair-plan",
      this.repairPlanEngine,
      ["buildReport", "getStatus"]
    );    this._validateDiagnosticEngine(
      "verification",
      this.verificationEngine,
      ["buildReport", "getStatus"]
    );
    const projectAuditProvider = new ProjectAuditProvider({
      root: process.cwd()
    });

    const environmentForensicProvider =
      new EnvironmentForensicProvider({
        root: process.cwd()
      });

    const pathIntelligenceProvider =
      new PathIntelligenceProvider({
        root: process.cwd()
      });

    const pathIntelligenceRegistration =
      this.registerProvider(
        "path-intelligence",
        pathIntelligenceProvider
      );

    if (!pathIntelligenceRegistration.success) {
      throw new Error(
        `Diagnostic Center path intelligence bootstrap failed: ${pathIntelligenceRegistration.type}`
      );
    }

    const environmentForensicRegistration =
      this.registerProvider(
        "environment-forensic",
        environmentForensicProvider
      );

    if (!environmentForensicRegistration.success) {
      throw new Error(
        `Diagnostic Center environment forensic bootstrap failed: ${environmentForensicRegistration.type}`
      );
    }

    const projectAuditRegistration = this.registerProvider(
      "project-audit",
      projectAuditProvider
    );

    const qualityProvider = new QualityProvider();
    const qualityRegistration = this.registerProvider(
      "quality",
      qualityProvider
    );

    if (!projectAuditRegistration.success) {
      throw new Error(
        `Diagnostic Center project audit bootstrap failed: ${projectAuditRegistration.type}`
      );
    }

    this.safe = true;
    this.readOnly = true;
    this.autoFix = false;
    this.externalExecution = false;
    this.autonomousExecution = false;
    this.failClosed = true;
    this.requiresApproval = true;

    this.lastReport = null;
    this.history = [];
  }

  _validateDiagnosticEngine(name, engine, requiredMethods = []) {
    if (!engine || typeof engine !== "object") {
      throw new Error(
        `Diagnostic Center ${name} engine bootstrap failed: invalid engine.`
      );
    }

    if (
      engine.externalExecution === true ||
      engine.autoFix === true ||
      engine.autonomousExecution === true ||
      engine.readOnly !== true ||
      engine.safe !== true ||
      engine.failClosed !== true
    ) {
      throw new Error(
        `Diagnostic Center ${name} engine bootstrap failed: unsafe engine.`
      );
    }

    for (const method of requiredMethods) {
      if (typeof engine[method] !== "function") {
        throw new Error(
          `Diagnostic Center ${name} engine bootstrap failed: missing ${method}().`
        );
      }
    }
  }

  registerProvider(name, provider) {
    if (!name || typeof name !== "string") {
      return {
        success: false,
        type: "invalid_provider_name"
      };
    }

    if (!provider || typeof provider !== "object") {
      return {
        success: false,
        type: "invalid_provider"
      };
    }

    if (this.providers.has(name)) {
      return {
        success: false,
        type: "duplicate_provider",
        provider: name
      };
    }

    if (provider.externalExecution === true) {
      return {
        success: false,
        type: "unsafe_provider",
        provider: name
      };
    }

    if (provider.autoFix === true || provider.autonomousExecution === true) {
      return {
        success: false,
        type: "unsafe_provider",
        provider: name
      };
    }

    this.providers.set(name, provider);

    return {
      success: true,
      type: "provider_registered",
      provider: name
    };
  }

  hasProvider(name) {
    return this.providers.has(name);
  }

  listProviders() {
    return [...this.providers.keys()];
  }

  normalizeResult(result = {}, provider = "unknown") {
    if (!result || typeof result !== "object") {
      return {
        success: false,
        status: "FAIL",
        provider,
        checks: [],
        findings: [],
        recommendations: [],
        duration: 0,
        error: "Invalid diagnostic result."
      };
    }

    const allowedStatuses = new Set(["PASS", "WARN", "FAIL"]);
    const status = allowedStatuses.has(result.status)
      ? result.status
      : result.success === true
        ? "PASS"
        : "FAIL";

    return {
      success: result.success === true && status !== "FAIL",
      status,
      provider,
      checks: Array.isArray(result.checks) ? result.checks : [],
      findings: Array.isArray(result.findings) ? result.findings : [],
      recommendations: Array.isArray(result.recommendations)
        ? result.recommendations
        : [],
      duration:
        typeof result.duration === "number" && result.duration >= 0
          ? result.duration
          : 0,
      error: result.error || null
    };
  }

  async inspect(options = {}) {
    return this.run(options);
  }

  async diagnose(options = {}) {
    return this.run(options);
  }

  async run(options = {}) {
    const startedAt = Date.now();
    const requestedProviders = Array.isArray(options.providers)
      ? options.providers
      : this.listProviders();

    const results = [];

    for (const providerName of requestedProviders) {
      const provider = this.providers.get(providerName);

      if (!provider) {
        results.push(
          this.normalizeResult(
            {
              success: false,
              status: "FAIL",
              error: "Diagnostic provider not found."
            },
            providerName
          )
        );
        continue;
      }

      if (provider.externalExecution === true ||
          provider.autoFix === true ||
          provider.autonomousExecution === true) {
        results.push(
          this.normalizeResult(
            {
              success: false,
              status: "FAIL",
              error: "Unsafe diagnostic provider rejected."
            },
            providerName
          )
        );
        continue;
      }

      if (typeof provider.run !== "function" &&
          typeof provider.inspect !== "function" &&
          typeof provider.diagnose !== "function") {
        results.push(
          this.normalizeResult(
            {
              success: false,
              status: "FAIL",
              error: "Diagnostic provider has no supported diagnostic method."
            },
            providerName
          )
        );
        continue;
      }

      try {
        const method =
          typeof provider.run === "function"
            ? provider.run.bind(provider)
            : typeof provider.inspect === "function"
              ? provider.inspect.bind(provider)
              : provider.diagnose.bind(provider);

        const result = await method(options.context || {});
        const adaptedResult =
      providerName === "quality"
        ? {
            ...result,
            findings: this.qualityFindingAdapter.adapt(result)
          }
        : providerName === "project-audit"
          ? {
              ...result,
              findings: this.projectAuditFindingAdapter.adapt(result)
            }
          : providerName === "environment-forensic"
            ? {
                ...result,
                findings: this.environmentForensicFindingAdapter.adapt(result)
              }
            : providerName === "path-intelligence"
              ? {
                  ...result,
                  findings: this.pathIntelligenceFindingAdapter.adapt(result)
                }
              : result;

    results.push(this.normalizeResult(adaptedResult, providerName));
      } catch (error) {
        results.push(
          this.normalizeResult(
            {
              success: false,
              status: "FAIL",
              error: error.message || String(error)
            },
            providerName
          )
        );
      }
    }

    const hasFail = results.some(result => result.status === "FAIL");
    const hasWarn = results.some(result => result.status === "WARN");
    const hasPipelineError = results.some(
      result =>
        typeof result.error === "string" &&
        result.error.trim().length > 0
    );

    let evidenceReport;
    let correlationReport;
    let rootCauseReport;
    let repairPlanReport;
    let verificationReport;

    try {
      evidenceReport = this.evidenceEngine.buildReport(results);

      correlationReport = this.correlationEngine.buildReport([
        {
          provider: "evidence-engine",
          findings: Array.isArray(evidenceReport.findings)
            ? evidenceReport.findings
            : []
        }
      ]);

      if (
        !correlationReport ||
        correlationReport.success !== true
      ) {
        throw new Error(
          "Diagnostic correlation engine failed closed."
        );
      }

      rootCauseReport =
        this.rootCauseEngine.buildReport(correlationReport);

      if (
        !rootCauseReport ||
        rootCauseReport.success !== true
      ) {
        throw new Error(
          "Diagnostic root-cause engine failed closed."
        );
      }

      repairPlanReport =
        this.repairPlanEngine.buildReport(rootCauseReport);

      if (
        !repairPlanReport ||
        repairPlanReport.success !== true
      ) {
        throw new Error(
          "Diagnostic repair-plan engine failed closed."
        );
      }

      verificationReport =
        this.verificationEngine.buildReport({
          findings: Array.isArray(evidenceReport.findings)
            ? evidenceReport.findings
            : [],
          rootCause: rootCauseReport,
          repairPlan: repairPlanReport
        });

      if (
        !verificationReport ||
        verificationReport.success !== true
      ) {
        throw new Error(
          "Diagnostic independent verification failed closed."
        );
      }

      if (verificationReport.status === "CONTRADICTED") {
        throw new Error(
          "Diagnostic independent verification detected contradictory evidence."
        );
      }
    } catch (error) {
      const report = {
        success: false,
        status: "FAIL",
        center: this.name,
        version: this.version,
        mode: this.mode,
        startedAt: new Date(startedAt).toISOString(),
        duration: Date.now() - startedAt,
        providers: results,
        evidence: evidenceReport || null,
        correlation: correlationReport || null,
        rootCause: rootCauseReport || null,
        repairPlan: repairPlanReport || null,
        verification: typeof verificationReport !== "undefined" ? verificationReport : null,
        error: error.message || String(error),
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

      this.lastReport = report;
      this.history.push(report);
      return report;
    }

    const report = {
      success: !hasPipelineError,
      pipelineSuccess: !hasPipelineError,
      status: hasFail ? "FAIL" : hasWarn ? "WARN" : "PASS",
      center: this.name,
      version: this.version,
      mode: this.mode,
      startedAt: new Date(startedAt).toISOString(),
      duration: Date.now() - startedAt,
      providers: results,

      evidence: evidenceReport,
      correlation: correlationReport,
      rootCause: rootCauseReport,
      repairPlan: repairPlanReport,
      verification: verificationReport,
      verificationStatus: verificationReport.status,

      findings: Array.isArray(evidenceReport.findings)
        ? evidenceReport.findings
        : [],

      classificationCounts:
        evidenceReport.classificationCounts || {},

      repairReady:
        Array.isArray(repairPlanReport.plans) &&
        repairPlanReport.plans.length > 0,

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

    this.lastReport = report;
    this.history.push(report);

    return report;
  }

  getReport() {
    return this.lastReport;
  }

  getStatus() {
    return {
      name: this.name,
      type: this.type,
      version: this.version,
      mode: this.mode,
      providers: this.listProviders(),
      safe: this.safe,
      readOnly: this.readOnly,
      autoFix: this.autoFix,
      externalExecution: this.externalExecution,
      autonomousExecution: this.autonomousExecution,
      failClosed: this.failClosed,
      requiresApproval: this.requiresApproval,
      history: this.history.length
    };
  }
}

module.exports = DiagnosticCenter;
