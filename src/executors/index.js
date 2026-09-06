"use strict";

/**
 * Executor Core
 * القلب التنفيذي للوكيل.
 *
 * لا ينفذ أي خدمة خارجية مباشرة.
 * التنفيذ الخارجي يتم لاحقاً عبر Connectors مصرح بها.
 */

class Executor {
  constructor(options = {}) {
    this.name = options.name || "Executor Core";
    this.version = "1.0.0";

    this.executed = 0;
    this.history = [];
    this.connectors = new Map();
  }

  registerConnector(name, connector) {
    if (!name || !connector) {
      throw new Error("اسم أو Connector غير صالح");
    }

    if (typeof connector.execute !== "function") {
      throw new Error(`Connector "${name}" يجب أن يحتوي على execute()`);
    }

    this.connectors.set(name, connector);

    return {
      success: true,
      connector: name
    };
  }

  unregisterConnector(name) {
    return this.connectors.delete(name);
  }

  hasConnector(name) {
    return this.connectors.has(name);
  }

  listConnectors() {
    return [...this.connectors.keys()];
  }

  validate(action) {
    if (!action) {
      return {
        valid: false,
        reason: "لا يوجد إجراء"
      };
    }

    if (!action.name) {
      return {
        valid: false,
        reason: "الإجراء بدون اسم"
      };
    }

    return {
      valid: true
    };
  }

  async execute(action, payload = {}, options = {}) {
    const validation = this.validate(action);

    if (!validation.valid) {
      return {
        success: false,
        type: "validation_error",
        message: validation.reason
      };
    }

    const connectorName = options.connector;

    if (!connectorName) {
      return {
        success: false,
        type: "connector_required",
        action: action.name,
        message:
          "الإجراء جاهز، لكن يحتاج Connector رسمي قبل التنفيذ الخارجي."
      };
    }

    const connector = this.connectors.get(connectorName);

    if (!connector) {
      return {
        success: false,
        type: "connector_not_found",
        connector: connectorName,
        message: `الـConnector "${connectorName}" غير مربوط.`
      };
    }

    const startedAt = new Date().toISOString();

    try {
      /*
       * LEGACY DIRECT CONNECTOR ACTUATION CLOSED.
       *
       * Executor Core is no longer an actuator.
       * ConnectorGateway is the only external execution route.
       */
      return {
        success: false,
        executionAllowed: false,
        type: "legacy_executor_execution_disabled",
        connector: connectorName
      };

      this.executed++;

      const record = {
        action: action.name,
        connector: connectorName,
        success: true,
        startedAt,
        finishedAt: new Date().toISOString()
      };

      this.history.push(record);

      return {
        success: true,
        type: "executed",
        action: action.name,
        connector: connectorName,
        result
      };
    } catch (error) {
      const record = {
        action: action.name,
        connector: connectorName,
        success: false,
        startedAt,
        finishedAt: new Date().toISOString(),
        error: error.message
      };

      this.history.push(record);

      return {
        success: false,
        type: "execution_error",
        action: action.name,
        connector: connectorName,
        message: error.message
      };
    }
  }

  getHistory(limit = 20) {
    return this.history.slice(-limit);
  }

  getStatus() {
    return {
      name: this.name,
      version: this.version,
      status: "online",
      executed: this.executed,
      connectors: this.listConnectors(),
      history: this.history.length
    };
  }
}

module.exports = Executor;
