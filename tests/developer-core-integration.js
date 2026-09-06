"use strict";

const assert = require("assert");

const AgentRuntime = require("../src/core/runtime");
const TermuxDeveloperTool = require("../src/developer-tools/termux");

async function main() {
  console.log("==========================================");
  console.log(" DEVELOPER CORE INTEGRATION TEST v2");
  console.log("==========================================");

  const runtime = new AgentRuntime();

  /* =========================================================
   * 1. RUNTIME COMPONENTS
   * ======================================================= */

  console.log("\n[1] Runtime components");

  assert(runtime.developerTools, "developerTools missing");
  assert(runtime.connectorHub, "connectorHub missing");
  assert(runtime.connectorResolver, "connectorResolver missing");
  assert(runtime.planExecutor, "planExecutor missing");

  console.log("PASS");


  /* =========================================================
   * 2. SHARED REGISTRY
   * ======================================================= */

  console.log("\n[2] Shared Developer Tool Registry");

  const runtimeRegistry = runtime.developerTools;
  const planExecutor = runtime.planExecutor;
  const developerExecutor = planExecutor.developerExecutor;

  assert(runtimeRegistry.has("termux"), "Runtime default Termux tool missing");
  assert(runtimeRegistry.has("node"), "Runtime default Node tool missing");
  assert(runtimeRegistry.has("python"), "Runtime default Python tool missing");

  const DeveloperToolRegistry = require("../src/developer-tools");
  const registry = new DeveloperToolRegistry();

  assert(
    planExecutor.toolRegistry === runtimeRegistry,
    "PlanExecutor does not use Runtime DeveloperToolRegistry"
  );

  assert(
    developerExecutor.toolRegistry === runtimeRegistry,
    "DeveloperExecutor does not use Runtime DeveloperToolRegistry"
  );

  console.log("PASS");


  /* =========================================================
   * 3. REGISTER TERMUX
   * ======================================================= */

  console.log("\n[3] Register Termux Developer Tool");

  const termux = new TermuxDeveloperTool({
    rootDir: process.cwd()
  });

  const registration = registry.register(
    "termux",
    termux,
    {
      category: "developer",
      description: "Safe Termux project operations",
      requiresApproval: true
    }
  );

  assert(
    registration.success === true,
    `Termux registration failed: ${registration.type}`
  );

  assert(
    registry.has("termux"),
    "Termux was not found in registry"
  );

  console.log("PASS");


  /* =========================================================
   * 4. REGISTRY DIRECT EXECUTION
   * ======================================================= */

  console.log("\n[4] Registry → Termux");

  const directResult = await registry.execute(
    "termux",
    {
      operation: "list_files",
      path: "."
    },
    {
      source: "integration-test"
    }
  );

  assert(
    directResult.success === true,
    `Registry execution failed: ${directResult.message || directResult.type}`
  );

  assert(
    directResult.type === "files_listed",
    `Unexpected result type: ${directResult.type}`
  );

  assert(
    Array.isArray(directResult.files),
    "Termux did not return files array"
  );

  console.log("PASS");


  /* =========================================================
   * 5. DEVELOPER EXECUTOR → REGISTRY
   * ======================================================= */

  console.log("\n[5] DeveloperExecutor → Registry → Termux");

  const plan = {
    id: "integration-plan",
    opportunityId: "integration-test",
    name: "Developer Core Integration"
  };

  const step = {
    type: "developer",
    name: "list-project-files",
    label: "List project files",
    tool: "termux"
  };

  const executorResult = await developerExecutor.execute(
    plan,
    step,
    0,
    {
      operation: "list_files",
      path: "."
    },
    {
      approved: true
    }
  );

  assert(
    executorResult.success === true,
    `DeveloperExecutor failed: ${executorResult.type}`
  );

  assert(
    executorResult.result,
    "DeveloperExecutor result missing"
  );

  assert(
    executorResult.result.success === true,
    "Underlying Developer Tool failed"
  );

  assert(
    executorResult.result.type === "files_listed",
    `Unexpected underlying result: ${executorResult.result.type}`
  );

  console.log("PASS");


  /* =========================================================
   * 6. HISTORY
   * ======================================================= */

  console.log("\n[6] DeveloperExecutor history");

  const history = developerExecutor.getHistory();

  assert(
    Array.isArray(history),
    "DeveloperExecutor history is not an array"
  );

  assert(
    history.length >= 1,
    "DeveloperExecutor history was not updated"
  );

  const lastRecord = history[history.length - 1];

  assert(
    lastRecord.success === true,
    "Last history record is not successful"
  );

  assert(
    lastRecord.tool === "termux",
    "History tool mismatch"
  );

  console.log("PASS");


  /* =========================================================
   * 7. STATUS
   * ======================================================= */

  console.log("\n[7] Status integrity");

  const runtimeStatus = runtime.planExecutor.getStatus();
  const developerStatus = developerExecutor.getStatus();
  const registryStatus = registry.getStatus();

  assert(
    runtimeStatus &&
    runtimeStatus.executors &&
    runtimeStatus.executors.developer,
    "PlanExecutor developer status missing"
  );

  assert(
    developerStatus.status === "online",
    "DeveloperExecutor is not online"
  );

  assert(
    registryStatus.total >= 1,
    "Registry contains no tools"
  );

  console.log("PASS");


  /* =========================================================
   * 8. CONNECTOR RESOLVER
   * ======================================================= */

  console.log("\n[8] Connector Resolver");

  let connectorExecuted = false;

  const connectorRegistration =
    runtime.connectorHub.register(
      "gemini",
      {
        isConfigured: () => true,

        async execute(payload, context) {
          connectorExecuted = true;

          return {
            success: true,
            type: "gemini_integration_test",
            connector: "gemini",
            payload,
            context
          };
        }
      },
      {
        category: "ai",
        description: "Gemini integration test",
        requiresApproval: true
      }
    );

  assert(
    connectorRegistration.success === true,
    `Gemini registration failed: ${connectorRegistration.type}`
  );

  runtime.connectorResolver.register(
    "generate_code",
    "gemini"
  );

  const resolved =
    developerExecutor.resolveConnector("generate_code");

  assert(
    resolved.success === true,
    `Connector resolution failed: ${resolved.type}`
  );

  assert(
    resolved.connector === "gemini",
    "Resolved connector is not Gemini"
  );

  assert(
    resolved.entry &&
    resolved.entry.connector,
    "Resolved connector entry missing"
  );

  console.log("PASS");


  /* =========================================================
   * 9. DEVELOPER → RESOLVER → CONNECTOR
   * ======================================================= */

  console.log("\n[9] DeveloperExecutor → Resolver → Mock Connector");

  runtime.connectorResolver.register(
    "connector_test",
    "mock"
  );

  const connectorResult = await developerExecutor.execute(
    {
      id: "connector-plan",
      opportunityId: "connector-test",
      name: "Connector Integration"
    },
    {
      type: "developer",
      name: "connector-test",
      label: "Connector Test",
      tool: "connector_test"
    },
    0,
    {
      prompt: "integration test"
    },
    {
      approved: true
    }
  );

  assert(
    connectorResult.success === true,
    `Connector pipeline failed: ${connectorResult.type}`
  );

  assert(
    connectorResult.result,
    "Connector pipeline result missing"
  );

  assert(
    connectorResult.result.success === true,
    "Connector execution failed"
  );

  assert(
    connectorResult.result.connector === "mock",
    "Connector result mismatch"
  );



  console.log("PASS");


  /* =========================================================
   * 10. INVALID TOOL SAFETY
   * ======================================================= */

  console.log("\n[10] Invalid tool handling");

  const invalidResult = await registry.execute(
    "tool_that_does_not_exist",
    {},
    {}
  );

  assert(
    invalidResult.success === false,
    "Invalid tool unexpectedly succeeded"
  );

  assert(
    invalidResult.type === "tool_not_found",
    `Unexpected invalid-tool result: ${invalidResult.type}`
  );

  console.log("PASS");


  /* =========================================================
   * 11. TERMUX OPERATION POLICY
   * ======================================================= */

  console.log("\n[11] Termux operation policy");

  const deniedResult = await registry.execute(
    "termux",
    {
      operation: "arbitrary_shell_command",
      command: "echo dangerous"
    },
    {}
  );

  assert(
    deniedResult.success === false,
    "Unauthorized Termux operation was accepted"
  );

  assert(
    deniedResult.type === "operation_not_allowed",
    `Unexpected Termux policy result: ${deniedResult.type}`
  );

  console.log("PASS");


  /* =========================================================
   * FINAL
   * ======================================================= */

  console.log("\n==========================================");
  console.log(" ALL DEVELOPER CORE TESTS PASSED");
  console.log("==========================================");

  console.log("\nSummary:");
  console.log("- Runtime components        PASS");
  console.log("- Shared registry            PASS");
  console.log("- Termux registration        PASS");
  console.log("- Registry → Termux          PASS");
  console.log("- DeveloperExecutor pipeline PASS");
  console.log("- History                    PASS");
  console.log("- Status                     PASS");
  console.log("- Connector Resolver         PASS");
  console.log("- Connector execution        PASS");
  console.log("- Invalid tool safety        PASS");
  console.log("- Termux operation policy    PASS");
}

main().catch(error => {
  console.error("\n==========================================");
  console.error(" DEVELOPER CORE TEST FAILED");
  console.error("==========================================");
  console.error(error.stack || error.message || error);
  process.exit(1);
});
