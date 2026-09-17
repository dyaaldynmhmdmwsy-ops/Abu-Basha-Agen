"use strict";

/**
 * Developer Executor v1.1.0
 *
 * مسؤول عن تنفيذ خطوات التطوير عبر Developer Tool Registry.
 * لا يدير الخطط أو الموافقات.
 */

class DeveloperExecutor {
  constructor(runtime, toolRegistry = null) {
    if (!runtime) {
      throw new Error("DeveloperExecutor يحتاج Runtime");
    }

    this.runtime = runtime;
    this.connectorResolver = runtime.connectorResolver;
    this.connectorGateway = runtime.connectorGateway;
    this.toolRegistry = toolRegistry;
    this.appBuilderExecutor =
      runtime.appBuilderExecutor || null;

    this.name = "Developer Executor";
    this.version = "1.1.0";
    this.status = "online";

    this.executed = 0;
    this.history = [];
  }

  async execute(
    plan,
    step,
    index,
    payload = {},
    options = {}
  ) {
    const startedAt = new Date().toISOString();

    if (!step || step.type !== "developer") {
      return {
        success: false,
        type: "invalid_developer_step",
        message:
          "DeveloperExecutor يقبل خطوات من النوع developer فقط."
      };
    }

    const action = {
      name: `plan_developer_${index + 1}`,
      stepName: step.name,
      label: step.label,
      planId: plan.id,
      opportunityId: plan.opportunityId,
      planName: plan.name,
      stepIndex: index
    };

    const toolName =
      step.tool ||
      payload.tool ||
      null;

    let result;
    /*
     * CANONICAL LOCAL ROUTE
     *
     * Local developer tools MUST execute through
     * DeveloperToolRegistry → Termux.
     *
     * They must NOT enter ConnectorResolver/Gateway.
     */
    if (
      result === undefined &&
      toolName &&
      this.toolRegistry
    ) {
      const localTool = this.toolRegistry.get
        ? this.toolRegistry.get(toolName)
        : null;

      if (localTool) {
        result = await this.toolRegistry.execute(
          toolName,
          payload,
          {
            plan,
            step,
            index,
            options,
            action
          }
        );
      }
    }

    let resolvedConnector = null;

    /*
     * المسار الأساسي:
     * Developer Tool → Resolver → Connector → execute()
     */
    /*
     * App Builder is an internal Developer Executor.
     * It must bypass Connector Resolver.
     * Approval is mandatory before execution.
     */
    if (toolName === "app-builder") {
      if (options.approved !== true) {
        result = {
          success: false,
          type: "approval_required",
          tool: "app-builder",
          executionAllowed: false
        };
      } else if (!this.appBuilderExecutor) {
        result = {
          success: false,
          type: "app_builder_executor_unavailable",
          tool: "app-builder"
        };
      } else {
        result = await this.appBuilderExecutor.execute(
          plan,
          step,
          index,
          payload,
          options
        );
      }
    } else if (toolName && this.connectorResolver) {
      resolvedConnector = this.resolveConnector(toolName);

      if (resolvedConnector.success) {
        const entry = resolvedConnector.entry;

        if (!entry || !entry.connector) {
          result = {
            success: false,
            type: "connector_invalid",
            connector: resolvedConnector.connector
          };
        } else if (
          typeof entry.connector.execute !== "function"
        ) {
          result = {
            success: false,
            type: "connector_execute_unavailable",
            connector: resolvedConnector.connector
          };
        } else {
          result = await this.connectorGateway.execute(
            toolName,
            payload,
            {
              plan,
              step,
              index,
              options,
              action,
              tool: toolName,
              connector: resolvedConnector.connector
            },
            {
              ...options,
              approved: options.approved === true,
              requiresApproval: options.requiresApproval !== false
            }
          );
        }
      }
    }

    /*
     * إذا لم يوجد Resolver Rule،
     * استخدم Developer Tool Registry كمسار بديل.
     */
    if (
      result === undefined &&
      toolName &&
      this.toolRegistry
    ) {
      result = await this.toolRegistry.execute(
        toolName,
        payload,
        {
          plan,
          step,
          index,
          options,
          action
        }
      );
    }

    /*
     * FAIL-CLOSED:
     * A developer step must never report success when no real
     * Tool/Connector execution path was resolved.
     */
    if (result === undefined) {
      result = {
        success: false,
        type: "developer_execution_unavailable",
        executionAllowed: false,
        failClosed: true,
        action: step.name,
        tool: toolName,
        message: "لم يتم العثور على مسار تنفيذ فعلي لخطوة التطوير."
      };
    }

    const record = {
      success: result.success === true,
      type: "developer",
      action,
      tool: toolName,
      result,
      startedAt,
      finishedAt: new Date().toISOString()
    };

    this.history.push(record);

    if (record.success) {
      this.executed++;
    }

    return record;
  }

  resolveConnector(toolName) {
    if (!this.connectorResolver) {
      return {
        success: false,
        type: "connector_resolver_unavailable"
      };
    }

    return this.connectorResolver.resolve(toolName);
  }

  getHistory(limit = 20) {
    return this.history.slice(-limit);
  }

  getStatus() {
    return {
      name: this.name,
      version: this.version,
      status: this.status,
      executed: this.executed,
      history: this.history.length,
      toolRegistry: this.toolRegistry
        ? this.toolRegistry.getStatus()
        : null
    };
  }
}

module.exports = DeveloperExecutor;
