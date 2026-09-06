"use strict";

/**
 * Connector Hub v1.0.0
 * سجل موحد للمنصات والخدمات الخارجية.
 */

class ConnectorHub {
  constructor() {
    this.name = "Connector Hub";
    this.version = "1.0.0";
    this.status = "online";
    this.connectors = new Map();
  }

  register(name, connector, metadata = {}) {
    if (!name || typeof name !== "string") {
      return {
        success: false,
        type: "invalid_connector_name"
      };
    }

    if (!connector || typeof connector.execute !== "function") {
      return {
        success: false,
        type: "invalid_connector",
        message: `Connector "${name}" يحتاج execute().`
      };
    }

    if (this.connectors.has(name)) {
      return {
        success: true,
        type: "connector_already_registered",
        tool: this.connectors.get(name)
      };
    }

    const entry = {
      name,
      connector,
      metadata: {
        enabled: metadata.enabled !== false,
        category: metadata.category || "general",
        description: metadata.description || "",
        requiresApproval: metadata.requiresApproval !== false,
        externalExecution: metadata.externalExecution === true
      }
    };

    this.connectors.set(name, entry);

    return {
      success: true,
      type: "connector_registered",
      name,
      metadata: entry.metadata
    };
  }

  get(name) {
    return this.connectors.get(name) || null;
  }

  has(name) {
    return this.connectors.has(name);
  }

  list() {
    return [...this.connectors.values()].map(entry => ({
      name: entry.name,
      metadata: entry.metadata
    }));
  }

  async healthCheck(name) {
    const entry = this.get(name);

    if (!entry) {
      return {
        success: false,
        type: "connector_not_found"
      };
    }

    if (!entry.metadata.enabled) {
      return {
        success: false,
        type: "connector_disabled"
      };
    }

    if (typeof entry.connector.healthCheck !== "function") {
      return {
        success: true,
        type: "health_check_not_supported",
        connector: name
      };
    }

    return entry.connector.healthCheck();
  }

  async execute(name, payload = {}, context = {}) {
    const entry = this.get(name);

    if (!entry) {
      return {
        success: false,
        type: "connector_not_found",
        message: `Connector "${name}" غير موجود.`
      };
    }

    if (!entry.metadata.enabled) {
      return {
        success: false,
        type: "connector_disabled"
      };
    }

    return entry.connector.execute(payload, context);
  }

  async healthCheckAll() {
    const results = {};

    for (const name of this.connectors.keys()) {
      results[name] = await this.healthCheck(name);
    }

    return {
      success: true,
      type: "batch_health_check",
      results
    };
  }

  getStatus() {
    return {
      name: this.name,
      version: this.version,
      status: this.status,
      total: this.connectors.size,
      connectors: this.list()
    };
  }
}

module.exports = ConnectorHub;
