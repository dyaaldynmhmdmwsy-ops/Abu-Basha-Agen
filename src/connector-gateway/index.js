"use strict";

/**
 * Connector Gateway v2.1.0
 *
 * Canonical execution boundary:
 *
 * Tool
 *   ↓
 * Resolver
 *   ↓
 * Approval / Execution Gate
 *   ↓
 * Connector Policy
 *   ↓
 * Connector Hub
 *   ↓
 * Execution
 *
 * External execution remains CLOSED globally.
 */

class ConnectorGateway {
  constructor({
    hub,
    resolver,
    policy,
    executionGate
  } = {}) {
    if (!hub) {
      throw new Error("ConnectorGateway يحتاج Connector Hub");
    }

    if (!resolver) {
      throw new Error("ConnectorGateway يحتاج Connector Resolver");
    }

    if (!policy) {
      throw new Error("ConnectorGateway يحتاج Connector Policy");
    }

    if (!executionGate) {
      throw new Error("ConnectorGateway يحتاج Execution Gate");
    }

    this.name = "Connector Gateway";
    this.version = "2.1.0";
    this.status = "online";

    this.hub = hub;
    this.resolver = resolver;
    this.policy = policy;
    this.executionGate = executionGate;

    this.history = [];
  }

  resolve(toolName) {
    return this.resolver.resolve(toolName);
  }

  canExecute(toolName, operation = {}) {
    const resolved = this.resolve(toolName);

    if (!resolved.success) {
      return {
        success: false,
        type: resolved.type,
        tool: toolName,
        executionAllowed: false
      };
    }

    const hubEntry = this.hub.get(resolved.connector);

    if (!hubEntry) {
      return {
        success: false,
        type: "connector_not_found",
        tool: toolName,
        connector: resolved.connector,
        executionAllowed: false
      };
    }

    const requiresApproval =
      hubEntry.metadata &&
      hubEntry.metadata.requiresApproval === true;

    const isExternalExecution =
      Boolean(
        hubEntry.metadata &&
        hubEntry.metadata.externalExecution === true
      );

    const approvalResult = this.executionGate.check({
      requiresApproval,
      approved: operation.approved === true,
      externalExecution: false,
      operation: "connector",
      context: {
        tool: toolName,
        connector: resolved.connector,
        requiresApproval
      }
    });

    if (!approvalResult.success) {
      return {
        ...approvalResult,
        tool: toolName,
        connector: resolved.connector,
        executionAllowed: false
      };
    }

    const externalResult = this.executionGate.check({
      requiresApproval: false,
      approved: operation.approved === true,
      externalExecution: isExternalExecution,
      operation: "connector",
      context: {
        tool: toolName,
        connector: resolved.connector,
        externalExecution: isExternalExecution
      }
    });

    if (!externalResult.success) {
      return {
        ...externalResult,
        tool: toolName,
        connector: resolved.connector,
        executionAllowed: false
      };
    }

    const policy = this.policy.canExecute(
      resolved.connector,
      operation
    );

    return {
      ...policy,
      tool: toolName,
      connector: resolved.connector,
      executionAllowed: policy.executionAllowed === true
    };
  }

  async execute(
    toolName,
    payload = {},
    context = {},
    operation = {}
  ) {
    const timestamp = new Date().toISOString();

    /*
     * 1. Resolve tool → connector.
     */
    const resolved = this.resolve(toolName);

    if (!resolved.success) {
      const result = {
        success: false,
        type: resolved.type,
        tool: toolName,
        executionAllowed: false,
        timestamp
      };

      this.history.push(result);
      return result;
    }

    /*
     * 2. Approval check FIRST.
     *
     * Connector Hub metadata is the canonical source for the
     * connector's approval requirement. An explicit operation
     * requirement can only strengthen that requirement.
     */
    const hubEntry = this.hub.get(resolved.connector);

    if (!hubEntry) {
      const result = {
        success: false,
        type: "connector_not_found",
        tool: toolName,
        connector: resolved.connector,
        executionAllowed: false,
        timestamp
      };

      this.history.push(result);
      return result;
    }

    const connectorRequiresApproval =
      hubEntry.metadata &&
      hubEntry.metadata.requiresApproval === true;

    const requiresApproval =
      connectorRequiresApproval ||
      operation.requiresApproval === true;

    const approvalResult = this.executionGate.check({
      requiresApproval,
      approved: operation.approved === true,
      externalExecution: false,
      operation: "connector",
      context: {
        tool: toolName,
        connector: resolved.connector,
        requiresApproval
      }
    });

    if (!approvalResult.success) {
      const result = {
        ...approvalResult,
        tool: toolName,
        connector: resolved.connector,
        executionAllowed: false,
        timestamp
      };

      this.history.push(result);
      return result;
    }

    /*
     * 3. Connector execution boundary.
     *
     * Internal/test connectors may execute through Hub while
     * real external connectors remain blocked by ExecutionGate.
     *
     * Approval NEVER opens external execution by itself.
     */
    const isExternalExecution =
      Boolean(
        hubEntry &&
        hubEntry.metadata &&
        hubEntry.metadata.externalExecution === true
      );

    const externalResult = this.executionGate.check({
      requiresApproval: false,
      approved: operation.approved === true,
      externalExecution: isExternalExecution,
      operation: "connector",
      context: {
        tool: toolName,
        connector: resolved.connector,
        externalExecution: isExternalExecution
      }
    });

    if (!externalResult.success) {
      const result = {
        ...externalResult,
        tool: toolName,
        connector: resolved.connector,
        executionAllowed: false,
        timestamp
      };

      this.history.push(result);
      return result;
    }

    /*
     * 4. Connector policy.
     *
     * Connector Policy requires the connector NAME,
     * never the connector object.
     */
    const connectorName =
      typeof resolved.connector === "string"
        ? resolved.connector
        : resolved.connector &&
          typeof resolved.connector.name === "string"
          ? resolved.connector.name
          : null;

    if (!connectorName) {
      const result = {
        success: false,
        type: "connector_name_invalid",
        message: "تعذر تحديد اسم الـConnector.",
        tool: toolName,
        executionAllowed: false,
        timestamp
      };

      this.history.push(result);
      return result;
    }

    const policyResult = this.policy.canExecute(
      connectorName,
      operation
    );

    if (!policyResult.success) {
      const result = {
        success: false,
        type: policyResult.type,
        message: policyResult.message,
        tool: toolName,
        connector: resolved.connector,
        executionAllowed: false,
        timestamp
      };

      this.history.push(result);
      return result;
    }

    /*
     * 5. Resolve connector from Hub.
     */
    const entry = this.hub.get(resolved.connector);

    if (!entry) {
      const result = {
        success: false,
        type: "connector_not_found",
        tool: toolName,
        connector: resolved.connector,
        executionAllowed: false,
        timestamp
      };

      this.history.push(result);
      return result;
    }

    if (
      !entry.connector ||
      typeof entry.connector.execute !== "function"
    ) {
      const result = {
        success: false,
        type: "connector_not_executable",
        tool: toolName,
        connector: resolved.connector,
        executionAllowed: false,
        timestamp
      };

      this.history.push(result);
      return result;
    }

    /*
     * Final execution point.
     */
    const auditStore = this.auditStore;

    if (!auditStore || typeof auditStore.append !== "function") {
      const result = {
        success: false,
        type: "audit_store_unavailable",
        tool: toolName,
        connector: resolved.connector,
        executionAllowed: false,
        failClosed: true,
        timestamp
      };
      this.history.push(result);
      return result;
    }

    const auditIntent = auditStore.append({
      eventType: "execution_intent",
      source: "connector-gateway",
      component: "ConnectorGateway",
      action: "execute_connector",
      sessionId: context.sessionId || null,
      correlationId:
        context.correlationId ||
        context.sessionId ||
        toolName,
      tool: toolName,
      connector: connectorName,
      approvalId: operation.approvalId || null,
      approvalRequired: requiresApproval,
      approved: operation.approved === true,
      executionAllowed: false,
      externalExecution: isExternalExecution,
      success: true,
      metadata: {
        operation: "connector",
        policyApproved: true
      }
    });

    if (!auditIntent || auditIntent.success !== true) {
      const result = {
        success: false,
        type: "audit_intent_blocked",
        tool: toolName,
        connector: resolved.connector,
        executionAllowed: false,
        failClosed: true,
        audit: auditIntent || null,
        timestamp
      };
      this.history.push(result);
      return result;
    }

    const connectorResult = await this.hub.execute(
      resolved.connector,
      payload,
      {
        ...context,
        tool: toolName
      }
    );

    const auditOutcome = auditStore.append({


      eventType: "execution_outcome",


      source: "connector-gateway",


      component: "ConnectorGateway",


      action: "execute_connector",


      sessionId: context.sessionId || null,


      correlationId:


        context.correlationId ||


        context.sessionId ||


        toolName,


      tool: toolName,


      connector: connectorName,


      approvalId: operation.approvalId || null,


      approvalRequired: requiresApproval,


      approved: operation.approved === true,


      executionAllowed: true,


      externalExecution: isExternalExecution,


      success: connectorResult && connectorResult.success === true,


      resultType:


        connectorResult && typeof connectorResult.type === "string"


          ? connectorResult.type


          : null,


      metadata: {


        operation: "connector"


      }


    });



    const finalResult = {


      ...connectorResult,


      tool: toolName,


      connector: resolved.connector,


      executionAllowed: true,


      timestamp,


      auditOutcomePersisted:


        Boolean(auditOutcome && auditOutcome.success === true),


      auditOutcome:


        auditOutcome && auditOutcome.success === true


          ? null


          : auditOutcome || null


    };


    this.history.push(finalResult);


    return finalResult;
  }

  getHistory(limit = 20) {
    return this.history.slice(-limit);
  }

  async healthCheck(toolName) {
    const resolved = this.resolve(toolName);

    if (!resolved.success) {
      return {
        success: false,
        type: resolved.type,
        tool: toolName
      };
    }

    return this.hub.healthCheck(
      resolved.connector
    );
  }

  getStatus() {
    return {
      name: this.name,
      version: this.version,
      status: this.status,
      history: this.history.length,
      resolverRules: this.resolver.list().length,
      connectors: this.hub.list().length,
      executionGate: this.executionGate.getStatus(),
      policy: this.policy.getStatus()
    };
  }
}

module.exports = ConnectorGateway;
