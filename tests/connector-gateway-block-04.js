"use strict";

const assert = require("assert");

const ConnectorHub =
  require(
    "../src/connectors/hub"
  );

const ConnectorResolver =
  require(
    "../src/connectors/resolver"
  );

const ConnectorPolicy =
  require(
    "../src/connector-policy"
  );

const MockConnector =
  require(
    "../src/connectors/hub/mock-connector"
  );

const ExecutionGate = require("../src/security/execution-gate");

const ConnectorGateway =
  require(
    "../src/connector-gateway"
  );

async function main() {
  console.log("========================================");
  console.log(" BLOCK 04 CONNECTOR GATEWAY TEST");
  console.log("========================================");

  console.log("[1] Bootstrap");

  const hub =
    new ConnectorHub();

  const resolver =
    new ConnectorResolver(hub);

  const policy =
    new ConnectorPolicy();

  const executionGate = new ExecutionGate({
    externalExecution: false,
    failClosed: true
  });

  const gateway =
    new ConnectorGateway({
      hub,
      resolver,
      policy,
      executionGate
    });

  assert.strictEqual(
    gateway.status,
    "online"
  );

  console.log("PASS");

  console.log("[2] Register mock connector");

  const registration =
    hub.register(
      "mock",
      new MockConnector("mock"),
      {
        enabled: true,
        requiresApproval: false
      }
    );

  assert.strictEqual(
    registration.success,
    true
  );

  console.log("PASS");

  console.log("[3] Register tool resolver");

  const rule =
    resolver.register(
      "developer",
      "mock"
    );

  assert.strictEqual(
    rule.success,
    true
  );

  console.log("PASS");

  console.log("[4] Resolve tool");

  const resolved =
    gateway.resolve("developer");

  assert.strictEqual(
    resolved.success,
    true
  );

  assert.strictEqual(
    resolved.connector,
    "mock"
  );

  console.log("PASS");

  console.log("[5] Permission check");

  const permission =
    gateway.canExecute(
      "developer"
    );

  assert.strictEqual(
    permission.success,
    true
  );

  assert.strictEqual(
    permission.connector,
    "mock"
  );

  console.log("PASS");

  console.log("[6] Approved execution path");

  const execution =
    await gateway.execute(
      "developer",
      {
        action: "test"
      },
      {
        source: "block-04-test"
      }
    );

  assert.strictEqual(
    execution.success,
    true
  );

  assert.strictEqual(
    execution.connector,
    "mock"
  );

  assert.strictEqual(
    execution.tool,
    "developer"
  );

  assert.strictEqual(
    execution.executionAllowed,
    true
  );

  console.log("PASS");

  console.log("[7] Unknown tool");

  const unknown =
    await gateway.execute(
      "unknown-tool"
    );

  assert.strictEqual(
    unknown.success,
    false
  );

  assert.strictEqual(
    unknown.executionAllowed,
    false
  );

  console.log("PASS");

  console.log("[8] Approval boundary");

  const approvalPolicy =
    new ConnectorPolicy();

  approvalPolicy.allowConnector(
    "approval-mock"
  );

  const approvalHub =
    new ConnectorHub();

  approvalHub.register(
    "approval-mock",
    new MockConnector("approval-mock"),
    {
      enabled: true,
      requiresApproval: true
    }
  );

  const approvalResolver =
    new ConnectorResolver(
      approvalHub
    );

  approvalResolver.register(
    "approval-tool",
    "approval-mock"
  );

  const approvalGateway =
    new ConnectorGateway({
      hub: approvalHub,
      resolver: approvalResolver,
      policy: approvalPolicy,
      executionGate
    });

  const denied =
    await approvalGateway.execute(
      "approval-tool"
    );

  assert.strictEqual(
    denied.success,
    false
  );

  assert.strictEqual(
    denied.type,
    "approval_required"
  );

  assert.strictEqual(
    denied.executionAllowed,
    false
  );

  console.log("PASS");

  console.log("[9] Approved connector");

  const approved =
    await approvalGateway.execute(
      "approval-tool",
      {
        action: "approved-test"
      },
      {},
      {
        approved: true
      }
    );

  assert.strictEqual(
    approved.success,
    true
  );

  assert.strictEqual(
    approved.executionAllowed,
    true
  );

  console.log("PASS");

  console.log("[10] History");

  assert.ok(
    gateway.getHistory().length >= 2
  );

  assert.ok(
    approvalGateway.getHistory().length >= 2
  );

  console.log("PASS");

  console.log("[11] Health check");

  const health =
    await gateway.healthCheck(
      "developer"
    );

  assert.strictEqual(
    health.success,
    true
  );

  console.log("PASS");

  console.log("[12] Status");

  const status =
    gateway.getStatus();

  assert.strictEqual(
    status.status,
    "online"
  );

  assert.ok(
    status.history >= 2
  );

  assert.ok(
    status.connectors >= 1
  );

  assert.ok(
    status.resolverRules >= 1
  );

  console.log("PASS");

  console.log("");
  console.log("========================================");
  console.log("BLOCK 04 TEST: PASS");
  console.log("========================================");

  console.log(
    JSON.stringify(
      status,
      null,
      2
    )
  );
}

main().catch(error => {
  console.error("");
  console.error("BLOCK 04 TEST: FAIL");
  console.error(
    error.stack ||
    error.message
  );
  process.exit(1);
});
