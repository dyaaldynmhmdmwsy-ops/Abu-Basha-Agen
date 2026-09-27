"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_SETTINGS = Object.freeze({
  account: {
    displayName: "",
    identityMode: "local"
  },

  appearance: {
    theme: "system",
    density: "comfortable",
    reduceMotion: false
  },

  agent: {
    responseStyle: "balanced",
    confirmations: "required",
    proactiveSuggestions: true
  },

  tools: {
    enabled: true
  },

  connectors: {
    showUnavailable: true
  },

  ai: {
    provider: "gemini",
    model: "gemini-3.8-flash"
  },

  security: {
    requireApproval: true,
    failClosed: true
  },

  notifications: {
    enabled: true,
    approvalAlerts: true,
    executionAlerts: true
  },

  data: {
    retainSessionHistory: true,
    retainAuditHistory: true
  }
});

const EDITABLE_PATHS = new Set([
  "account.displayName",
  "appearance.theme",
  "appearance.density",
  "appearance.reduceMotion",
  "agent.responseStyle",
  "agent.confirmations",
  "agent.proactiveSuggestions",
  "tools.enabled",
  "connectors.showUnavailable",
  "ai.provider",
  "ai.model",
  "notifications.enabled",
  "notifications.approvalAlerts",
  "notifications.executionAlerts",
  "data.retainSessionHistory",
  "data.retainAuditHistory"
]);

const ALLOWED_THEMES = new Set(["system", "light", "dark"]);
const ALLOWED_DENSITIES = new Set(["comfortable", "compact"]);
const ALLOWED_RESPONSE_STYLES = new Set(["balanced", "concise", "detailed"]);
const ALLOWED_CONFIRMATIONS = new Set(["required"]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function merge(base, incoming) {
  const output = clone(base);

  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    return output;
  }

  for (const [key, value] of Object.entries(incoming)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      output[key] &&
      typeof output[key] === "object" &&
      !Array.isArray(output[key])
    ) {
      output[key] = merge(output[key], value);
    } else if (Object.prototype.hasOwnProperty.call(output, key)) {
      output[key] = value;
    }
  }

  return output;
}

class SettingsService {
  constructor(options = {}) {
    this.name = "Settings Service";
    this.version = "1.0.0";
    this.status = "online";
    this.failClosed = true;
    this.readOnly = false;
    this.requiresApproval = true;

    const root =
      options.projectRoot ||
      process.cwd();

    this.filePath =
      options.filePath ||
      path.resolve(root, "data", "settings.json");

    this.ensureStorage();
    this.settings = this.load();
  }

  ensureStorage() {
    fs.mkdirSync(path.dirname(this.filePath), {
      recursive: true,
      mode: 0o700
    });

    if (!fs.existsSync(this.filePath)) {
      this.writeAtomic(DEFAULT_SETTINGS);
    }

    try {
      fs.chmodSync(this.filePath, 0o600);
    } catch (_) {
      // Fail closed at the application layer even when chmod is unavailable.
    }
  }

  load() {
    try {
      const raw = fs.readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      return merge(DEFAULT_SETTINGS, parsed);
    } catch (_) {
      return clone(DEFAULT_SETTINGS);
    }
  }

  writeAtomic(value) {
    const dir = path.dirname(this.filePath);
    const temp = path.join(
      dir,
      `.settings.${process.pid}.${Date.now()}.tmp`
    );

    fs.writeFileSync(
      temp,
      JSON.stringify(value, null, 2) + "\n",
      {
        encoding: "utf8",
        mode: 0o600
      }
    );

    fs.renameSync(temp, this.filePath);

    try {
      fs.chmodSync(this.filePath, 0o600);
    } catch (_) {}
  }

  get() {
    return {
      success: true,
      type: "settings",
      settings: clone(this.settings),
      failClosed: true,
      requiresApproval: true
    };
  }

  validatePatch(patch) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      return {
        success: false,
        type: "invalid_settings_patch",
        failClosed: true
      };
    }

    const flat = [];

    const walk = (value, prefix = "") => {
      for (const [key, child] of Object.entries(value)) {
        const full = prefix ? `${prefix}.${key}` : key;

        if (
          child &&
          typeof child === "object" &&
          !Array.isArray(child)
        ) {
          walk(child, full);
        } else {
          flat.push([full, child]);
        }
      }
    };

    walk(patch);

    for (const [key, value] of flat) {
      if (!EDITABLE_PATHS.has(key)) {
        return {
          success: false,
          type: "setting_not_editable",
          setting: key,
          failClosed: true
        };
      }

      if (key === "appearance.theme" && !ALLOWED_THEMES.has(value)) {
        return {
          success: false,
          type: "invalid_setting_value",
          setting: key,
          failClosed: true
        };
      }

      if (
        key === "appearance.density" &&
        !ALLOWED_DENSITIES.has(value)
      ) {
        return {
          success: false,
          type: "invalid_setting_value",
          setting: key,
          failClosed: true
        };
      }

      if (
        key === "agent.responseStyle" &&
        !ALLOWED_RESPONSE_STYLES.has(value)
      ) {
        return {
          success: false,
          type: "invalid_setting_value",
          setting: key,
          failClosed: true
        };
      }

      if (
        key === "agent.confirmations" &&
        !ALLOWED_CONFIRMATIONS.has(value)
      ) {
        return {
          success: false,
          type: "invalid_setting_value",
          setting: key,
          failClosed: true
        };
      }

      if (
        key === "account.displayName" &&
        (typeof value !== "string" || value.length > 120)
      ) {
        return {
          success: false,
          type: "invalid_setting_value",
          setting: key,
          failClosed: true
        };
      }

      if (
        key.endsWith("reduceMotion") ||
        key.endsWith("proactiveSuggestions") ||
        key.endsWith("enabled") ||
        key.endsWith("showUnavailable") ||
        key.startsWith("notifications.") ||
        key.startsWith("data.")
      ) {
        if (typeof value !== "boolean") {
          return {
            success: false,
            type: "invalid_setting_value",
            setting: key,
            failClosed: true
          };
        }
      }
    }

    return {
      success: true
    };
  }

  update(patch, context = {}) {
    const validation = this.validatePatch(patch);

    if (!validation.success) {
      return validation;
    }

    /*
     * Security invariant:
     * UI/API settings can never modify:
     * - execution gate
     * - external execution
     * - approval requirement
     * - connector policy
     * - credentials/secrets
     */
    /*
     * Ordinary local preferences are safe to persist directly.
     * Sensitive execution/security/connector controls are NOT editable
     * through this settings service and remain fail-closed.
     */
    if (context.externalExecution === true) {
      return {
        success: false,
        type: "settings_external_execution_denied",
        executionAllowed: false,
        failClosed: true,
        requiresApproval: true
      };
    }

    const next = merge(this.settings, patch);

    // Immutable security invariants.
    next.security.requireApproval = true;
    next.security.failClosed = true;

    this.writeAtomic(next);
    this.settings = next;

    return {
      success: true,
      type: "settings_updated",
      settings: clone(this.settings),
      failClosed: true,
      requiresApproval: true
    };
  }

  getStatus() {
    return {
      name: this.name,
      version: this.version,
      status: this.status,
      failClosed: true,
      requiresApproval: true,
      persistent: true,
      secretsStored: false,
      filePath: this.filePath
    };
  }
}

module.exports = SettingsService;
