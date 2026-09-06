"use strict";

/**
 * Connector Policy v1.0.0
 *
 * مسؤول عن التحقق من صلاحية استخدام Connector
 * قبل السماح بالتنفيذ الخارجي.
 *
 * لا ينفذ Connector ولا Runtime.
 */

class ConnectorPolicy {
  constructor() {
    this.name = "Connector Policy";
    this.version = "1.0.0";
    this.status = "online";

    this.allowedConnectors = new Set([
      "mock"
    ]);
  }

  validate(connectorName) {
    if (!connectorName) {
      return {
        success: false,
        type: "connector_not_found",
        message: "لم يتم تحديد Connector."
      };
    }

    if (!this.allowedConnectors.has(connectorName)) {
      return {
        success: false,
        type: "connector_not_allowed",
        connector: connectorName,
        message:
          `الـConnector "${connectorName}" غير مسموح به في Connector Policy.`
      };
    }

    return {
      success: true,
      type: "connector_allowed",
      connector: connectorName
    };
  }

  canExecute(connectorName, operation = {}) {
    const validation = this.validate(connectorName);

    if (!validation.success) {
      return validation;
    }

    if (
      operation &&
      operation.requiresApproval === true &&
      operation.approved !== true
    ) {
      return {
        success: false,
        type: "approval_required",
        connector: connectorName,
        executionAllowed: false,
        message: "هذه العملية تحتاج موافقة المستخدم."
      };
    }

    return {
      success: true,
      type: "connector_allowed",
      connector: connectorName,
      executionAllowed: true
    };
  }

  allowConnector(connectorName) {
    if (!connectorName) {
      return {
        success: false,
        type: "connector_not_found",
        message: "اسم Connector مطلوب."
      };
    }

    this.allowedConnectors.add(connectorName);

    return {
      success: true,
      type: "connector_allowed",
      connector: connectorName
    };
  }

  revokeConnector(connectorName) {
    return this.allowedConnectors.delete(connectorName);
  }

  getStatus() {
    return {
      name: this.name,
      version: this.version,
      status: this.status,
      allowedConnectors: [...this.allowedConnectors]
    };
  }
}

module.exports = ConnectorPolicy;
