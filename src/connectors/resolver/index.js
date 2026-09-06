"use strict";

class ConnectorResolver {
  constructor(hub) {
    if (!hub) {
      throw new Error("ConnectorResolver يحتاج Connector Hub");
    }

    this.hub = hub;
    this.name = "Connector Resolver";
    this.version = "1.0.0";
    this.status = "online";

    this.rules = new Map();
  }

  register(toolName, connectorName) {
    if (!toolName || !connectorName) {
      return {
        success: false,
        type: "invalid_resolver_rule"
      };
    }

    if (!this.hub.has(connectorName)) {
      return {
        success: false,
        type: "connector_not_found",
        connector: connectorName
      };
    }

    this.rules.set(toolName, connectorName);

    return {
      success: true,
      type: "resolver_rule_registered",
      tool: toolName,
      connector: connectorName
    };
  }

  resolve(toolName) {
    const connectorName = this.rules.get(toolName);

    if (!connectorName) {
      return {
        success: false,
        type: "connector_not_resolved",
        tool: toolName
      };
    }

    const connector = this.hub.get(connectorName);

    if (!connector) {
      return {
        success: false,
        type: "connector_not_found",
        connector: connectorName
      };
    }

    return {
      success: true,
      type: "connector_resolved",
      tool: toolName,
      connector: connectorName,
      entry: connector
    };
  }

  list() {
    return [...this.rules.entries()].map(
      ([tool, connector]) => ({
        tool,
        connector
      })
    );
  }

  getStatus() {
    return {
      name: this.name,
      version: this.version,
      status: this.status,
      totalRules: this.rules.size,
      rules: this.list()
    };
  }
}

module.exports = ConnectorResolver;
