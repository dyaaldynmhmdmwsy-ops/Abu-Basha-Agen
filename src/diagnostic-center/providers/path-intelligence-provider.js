"use strict";

const fs = require("fs");
const path = require("path");

class PathIntelligenceProvider {
  constructor(options = {}) {
    this.name = "path-intelligence";
    this.type = "path-intelligence-provider";
    this.version = "1.1.0";

    this.root = path.resolve(
      options.root || path.join(__dirname, "../../..")
    );

    this.safe = true;
    this.readOnly = true;
    this.autoFix = false;
    this.externalExecution = false;
    this.autonomousExecution = false;
    this.failClosed = true;
    this.requiresApproval = true;

    this.searchRoots = [
      "src",
      "tests",
      "tools",
      "reports",
      "backups"
    ];
  }

  normalizeInput(inputPath) {
    const raw = typeof inputPath === "string" ? inputPath.trim() : "";

    if (!raw) {
      return {
        success: false,
        status: "FAIL",
        type: "invalid_path",
        input: inputPath
      };
    }

    const expanded = raw === "~"
      ? this.root
      : raw.startsWith("~/")
        ? path.join(this.root, raw.slice(2))
        : raw;

    const resolvedPath = path.isAbsolute(expanded)
      ? path.normalize(expanded)
      : path.resolve(this.root, expanded);

    return {
      success: true,
      raw,
      resolvedPath
    };
  }

  collectCandidates(raw, resolvedPath) {
    const suggestions = new Set();

    const normalizedRaw = raw.replace(/\\/g, "/");
    const basename = path.basename(normalizedRaw).toLowerCase();

    for (const relativeRoot of this.searchRoots) {
      const rootPath = path.join(this.root, relativeRoot);

      if (!fs.existsSync(rootPath)) {
        continue;
      }

      const directCandidate = path.join(rootPath, basename);

      if (fs.existsSync(directCandidate)) {
        suggestions.add(
          path.relative(this.root, directCandidate) || "."
        );
      }

      this.scanDirectory(rootPath, basename, suggestions, 3);
    }

    const relativeResolved = path.relative(this.root, resolvedPath);

    if (
      relativeResolved &&
      !relativeResolved.startsWith("..") &&
      !path.isAbsolute(relativeResolved)
    ) {
      const normalizedRelative = relativeResolved.replace(/\\/g, "/");

      if (normalizedRelative !== normalizedRaw) {
        if (fs.existsSync(resolvedPath)) {
          suggestions.add(normalizedRelative);
        }
      }
    }

    return [...suggestions].slice(0, 10);
  }

  scanDirectory(directory, basename, suggestions, depth) {
    if (depth < 0 || suggestions.size >= 10) {
      return;
    }

    let entries;

    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (suggestions.size >= 10) {
        break;
      }

      const fullPath = path.join(directory, entry.name);

      if (entry.name.toLowerCase() === basename) {
        suggestions.add(path.relative(this.root, fullPath));
      }

      if (entry.isDirectory()) {
        this.scanDirectory(fullPath, basename, suggestions, depth - 1);
      }
    }
  }

  inspectPath(inputPath) {
    const normalized = this.normalizeInput(inputPath);

    if (!normalized.success) {
      return normalized;
    }

    const {
      raw,
      resolvedPath
    } = normalized;

    const exists = fs.existsSync(resolvedPath);

    if (exists) {
      return {
        success: true,
        status: "PASS",
        type: "path_valid",
        input: raw,
        normalizedInput: raw.replace(/\\/g, "/"),
        resolvedPath,
        relativePath: path.relative(this.root, resolvedPath) || ".",
        exists: true,
        recommendation: null,
        suggestions: [],
        executable: false
      };
    }

    const suggestions = this.collectCandidates(raw, resolvedPath);

    return {
      success: true,
      status: "WARN",
      type: "path_not_found",
      input: raw,
      normalizedInput: raw.replace(/\\/g, "/"),
      resolvedPath,
      relativePath: path.relative(this.root, resolvedPath) || ".",
      exists: false,
      suggestions,
      recommendation:
        suggestions.length > 0
          ? `المسار غير موجود. المسار المقترح: ${suggestions[0]}`
          : "المسار غير موجود ولا يوجد مسار canonical واضح من الفحص الآمن.",
      executable: false
    };
  }

  run(options = {}) {
    const startedAt = Date.now();
    const targets = Array.isArray(options.paths)
      ? options.paths
      : [];

    const checks = targets.map(item => this.inspectPath(item));

    const failures = checks.filter(item => item.status === "FAIL");
    const warnings = checks.filter(item => item.status === "WARN");

    const status =
      failures.length > 0
        ? "FAIL"
        : warnings.length > 0
          ? "WARN"
          : "PASS";

    return {
      success: failures.length === 0,
      status,
      provider: this.name,
      type: this.type,
      version: this.version,
      safe: this.safe,
      readOnly: this.readOnly,
      autoFix: this.autoFix,
      externalExecution: this.externalExecution,
      autonomousExecution: this.autonomousExecution,
      failClosed: this.failClosed,
      requiresApproval: this.requiresApproval,
      checks,
      totalChecks: checks.length,
      passed: checks.filter(item => item.status === "PASS").length,
      warnings: warnings.length,
      failures: failures.length,
      durationMs: Date.now() - startedAt
    };
  }

  inspect(options = {}) {
    return this.run(options);
  }

  diagnose(options = {}) {
    return this.run(options);
  }

  getStatus() {
    return {
      name: this.name,
      type: this.type,
      version: this.version,
      root: this.root,
      searchRoots: [...this.searchRoots],
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

module.exports = PathIntelligenceProvider;
