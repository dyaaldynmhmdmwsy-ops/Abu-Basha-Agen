"use strict";

const ProjectAuditProvider = require("./providers/project-audit-provider");
const EnvironmentForensicProvider = require("./providers/environment-forensic-provider");
const PathIntelligenceProvider = require("./providers/path-intelligence-provider");

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
        results.push(this.normalizeResult(result, providerName));
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

    const report = {
      success: !hasFail,
      status: hasFail ? "FAIL" : hasWarn ? "WARN" : "PASS",
      center: this.name,
      version: this.version,
      mode: this.mode,
      startedAt: new Date(startedAt).toISOString(),
      duration: Date.now() - startedAt,
      providers: results,
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
