"use strict";

/*
 * Phase 28 — Production Developer Platform Executor
 *
 * Canonical path:
 * Tool → Resolver → Approval/Execution Gate → Connector Policy
 * → Connector Hub → Provider Executor
 *
 * Security contract:
 * - Credentials come only from environment variables.
 * - No credential values are returned or logged.
 * - No arbitrary URL execution.
 * - No arbitrary HTTP method execution.
 * - Provider base URLs are fixed.
 * - Only explicit provider operations are accepted.
 * - External execution remains controlled by ConnectorPolicy/Gateway.
 */

/*
 * PHASE28_SECURE_PROVIDER_CREDENTIAL_LOADER
 *
 * Credential precedence:
 * 1. Existing process environment
 * 2. Dedicated external provider credential file
 *
 * The file is outside the repository and credential values are never logged.
 */
const path = require("path");
const dotenv = require("dotenv");

const PROVIDER_CREDENTIAL_FILE =
  process.env.ABU_BASHA_PROVIDER_CREDENTIAL_FILE ||
  path.join(
    process.env.HOME || "",
    ".config",
    "abubasha",
    "credentials",
    "providers.env"
  );

dotenv.config({
  path: PROVIDER_CREDENTIAL_FILE,
  override: false,
  quiet: true
});

class DeveloperPlatformConnector {
  constructor(name, metadata = {}) {
    if (!name) {
      throw new Error("DeveloperPlatformConnector يحتاج اسم Connector");
    }

    this.name = name;
    this.provider = metadata.provider || name;
    this.envKey = metadata.envKey || null;
    this.version = "2.0.0";
    this.status = "online";
    this.externalExecution = true;
    this.executed = 0;

    if (this.name === "github") {
      this.baseUrl = "https://api.github.com";
      this.operations = new Set([
        "health_check",
        "get_identity",
        "list_repositories"
      ]);
    } else if (this.name === "gitlab") {
      this.baseUrl = "https://gitlab.com/api/v4";
      this.operations = new Set([
        "health_check",
        "get_identity",
        "list_projects"
      ]);
    } else {
      this.baseUrl = null;
      this.operations = new Set();
    }
  }

  isConfigured() {
    if (!this.envKey) {
      return false;
    }

    return Boolean(process.env[this.envKey]);
  }

  getToken() {
    if (!this.envKey) {
      return null;
    }

    const token = process.env[this.envKey];

    if (!token || typeof token !== "string") {
      return null;
    }

    return token.trim() || null;
  }

  async request(path, options = {}) {
    if (!this.baseUrl) {
      return {
        success: false,
        type: "provider_not_supported",
        connector: this.name,
        failClosed: true
      };
    }

    const token = this.getToken();

    if (!token) {
      return {
        success: false,
        type: "connector_not_configured",
        connector: this.name,
        configured: false,
        failClosed: true
      };
    }

    if (typeof path !== "string" || !path.startsWith("/")) {
      return {
        success: false,
        type: "invalid_provider_path",
        connector: this.name,
        failClosed: true
      };
    }

    const url = `${this.baseUrl}${path}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const headers = {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "Abu-Basha-AI"
      };

      if (this.name === "github") {
        headers["X-GitHub-Api-Version"] = "2022-11-28";
      }

      const response = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal
      });

      const text = await response.text();

      let data;

      try {
        data = text ? JSON.parse(text) : null;
      } catch (_) {
        data = null;
      }

      if (!response.ok) {
        return {
          success: false,
          type: "provider_request_failed",
          connector: this.name,
          providerStatus: response.status,
          message:
            data && typeof data.message === "string"
              ? data.message
              : `Provider returned HTTP ${response.status}.`,
          failClosed: true
        };
      }

      return {
        success: true,
        type: "provider_request_success",
        connector: this.name,
        providerStatus: response.status,
        data
      };
    } catch (error) {
      return {
        success: false,
        type: "provider_request_error",
        connector: this.name,
        message: error && error.name === "AbortError"
          ? "Provider request timed out."
          : error.message,
        failClosed: true
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async healthCheck() {
    if (!this.isConfigured()) {
      return {
        success: false,
        type: "connector_not_configured",
        connector: this.name,
        provider: this.provider,
        configured: false,
        executable: true,
        externalExecution: true,
        failClosed: true
      };
    }

    return {
      success: true,
      type: "provider_executor_ready",
      connector: this.name,
      provider: this.provider,
      configured: true,
      executable: true,
      externalExecution: true,
      failClosed: true,
      operations: [...this.operations]
    };
  }

  async execute(payload = {}) {
    if (!payload || typeof payload !== "object") {
      return {
        success: false,
        type: "invalid_payload",
        connector: this.name,
        failClosed: true
      };
    }

    const operation = payload.operation;

    if (!operation || !this.operations.has(operation)) {
      return {
        success: false,
        type: "operation_not_allowed",
        connector: this.name,
        operation: operation || null,
        allowedOperations: [...this.operations],
        failClosed: true
      };
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        type: "connector_not_configured",
        connector: this.name,
        operation,
        configured: false,
        executionAllowed: false,
        externalExecution: true,
        failClosed: true
      };
    }

    let result;

    if (this.name === "github") {
      if (operation === "health_check" || operation === "get_identity") {
        result = await this.request("/user");
      } else if (operation === "list_repositories") {
        const page = Number.isInteger(payload.page) && payload.page > 0
          ? payload.page
          : 1;

        result = await this.request(
          `/user/repos?per_page=30&page=${page}&sort=updated`
        );
      }
    }

    if (this.name === "gitlab") {
      if (operation === "health_check" || operation === "get_identity") {
        result = await this.request("/user");
      } else if (operation === "list_projects") {
        const page = Number.isInteger(payload.page) && payload.page > 0
          ? payload.page
          : 1;

        result = await this.request(
          `/projects?membership=true&per_page=30&page=${page}&order_by=last_activity_at`
        );
      }
    }

    if (!result) {
      return {
        success: false,
        type: "operation_not_implemented",
        connector: this.name,
        operation,
        failClosed: true
      };
    }

    if (result.success) {
      this.executed += 1;

      return {
        ...result,
        operation,
        executed: true
      };
    }

    return {
      ...result,
      operation,
      executed: false
    };
  }

  getStatus() {
    return {
      name: this.name,
      provider: this.provider,
      version: this.version,
      status: this.status,
      configured: this.isConfigured(),
      externalExecution: true,
      executable: true,
      failClosed: true,
      executed: this.executed,
      allowedOperations: [...this.operations]
    };
  }
}

module.exports = DeveloperPlatformConnector;
