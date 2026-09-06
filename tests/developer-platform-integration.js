"use strict";

const assert = require("assert");
const AgentRuntime = require("../src/core/runtime");
const TermuxDeveloperTool = require("../src/developer-tools/termux");

async function main() {
  console.log("==========================================");
  console.log(" DEVELOPER PLATFORM INTEGRATION TEST v1");
  console.log("==========================================");

  const runtime = new AgentRuntime();

  assert(runtime, "Runtime was not created");
  assert(runtime.developerTools, "Developer Tool Registry missing");
  assert(runtime.connectorHub, "Connector Hub missing");
  assert(runtime.connectorResolver, "Connector Resolver missing");
  assert(runtime.planExecutor, "Plan Executor missing");

  console.log("\n[1] Runtime architecture");
  console.log("PASS");

  const runtimeRegistry = runtime.developerTools;
  const developerExecutor =
    runtime.planExecutor.developerExecutor;

  assert(runtimeRegistry.has("termux"), "Runtime default Termux tool missing");
  assert(runtimeRegistry.has("node"), "Runtime default Node tool missing");
  assert(runtimeRegistry.has("python"), "Runtime default Python tool missing");

  const DeveloperToolRegistry = require("../src/developer-tools");
  const registry = new DeveloperToolRegistry();

  assert(
    runtime.planExecutor.toolRegistry === runtimeRegistry,
    "PlanExecutor registry is not shared"
  );

  assert(
    developerExecutor.toolRegistry === runtimeRegistry,
    "DeveloperExecutor registry is not shared"
  );

  console.log("\n[2] Shared registry architecture");
  console.log("PASS");

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

  console.log("\n[3] Termux registration");
  console.log("PASS");

  const duplicate = registry.register(
    "termux",
    termux,
    {
      category: "developer"
    }
  );

  assert(
    duplicate.success === false,
    "Duplicate registration unexpectedly succeeded"
  );

  assert(
    duplicate.type === "tool_already_exists",
    `Unexpected duplicate result: ${duplicate.type}`
  );

  console.log("\n[4] Duplicate registration protection");
  console.log("PASS");

  const missing = await registry.execute(
    "missing-tool",
    {},
    {}
  );

  assert(
    missing.success === false,
    "Missing tool unexpectedly succeeded"
  );

  assert(
    missing.type === "tool_not_found",
    `Unexpected missing-tool result: ${missing.type}`
  );

  console.log("\n[5] Missing tool protection");
  console.log("PASS");

  const disabledRegistration = registry.register(
    "disabled-test-tool",
    {
      async execute() {
        return {
          success: true,
          type: "should_not_execute"
        };
      }
    },
    {
      enabled: false,
      category: "developer"
    }
  );

  assert(
    disabledRegistration.success === true,
    "Disabled tool registration failed"
  );

  const disabledResult = await registry.execute(
    "disabled-test-tool",
    {},
    {}
  );

  assert(
    disabledResult.success === false,
    "Disabled tool unexpectedly executed"
  );

  assert(
    disabledResult.type === "tool_disabled",
    `Unexpected disabled result: ${disabledResult.type}`
  );

  console.log("\n[6] Disabled tool protection");
  console.log("PASS");

  const listResult = await developerExecutor.execute(
    {
      id: "hardening-plan",
      opportunityId: "hardening-test",
      name: "Developer Core Hardening"
    },
    {
      type: "developer",
      name: "list-project-files",
      label: "List project files",
      tool: "termux"
    },
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
    listResult.success === true,
    `Developer execution failed: ${listResult.type}`
  );

  assert(
    listResult.result,
    "Developer result missing"
  );

  assert(
    listResult.result.success === true,
    "Termux operation failed"
  );

  assert(
    listResult.result.type === "files_listed",
    `Unexpected Termux result: ${listResult.result.type}`
  );

  console.log("\n[7] DeveloperExecutor → Registry → Termux");
  console.log("PASS");

  const denied = await registry.execute(
    "termux",
    {
      operation: "arbitrary_shell_command",
      command: "echo blocked"
    },
    {}
  );

  assert(
    denied.success === false,
    "Unauthorized operation was accepted"
  );

  assert(
    denied.type === "operation_not_allowed",
    `Unexpected safety result: ${denied.type}`
  );

  console.log("\n[8] Termux operation safety");
  console.log("PASS");

  const history = developerExecutor.getHistory();

  assert(
    Array.isArray(history),
    "DeveloperExecutor history is not an array"
  );

  assert(
    history.length >= 1,
    "DeveloperExecutor history was not updated"
  );

  console.log("\n[9] Execution history");
  console.log("PASS");

  const status = runtime.planExecutor.getStatus();

  assert(
    status.executors &&
    status.executors.developer,
    "Developer executor status missing"
  );

  assert(
    status.toolRegistry,
    "Tool registry status missing"
  );

  assert(
    status.toolRegistry.total >= 2,
    "Expected registered tools are missing"
  );

  console.log("\n[10] Status integrity");
  console.log("PASS");

  console.log("\n==========================================");
  console.log(" ALL DEVELOPER PLATFORM TESTS PASSED");
  console.log("==========================================");

  console.log("\nSummary:");
  console.log("- Runtime architecture       PASS");
  console.log("- Shared registry            PASS");
  console.log("- Termux registration        PASS");
  console.log("- Duplicate protection       PASS");
  console.log("- Missing tool protection    PASS");
  console.log("- Disabled tool protection   PASS");
  console.log("- Developer pipeline         PASS");
  console.log("- Termux safety              PASS");
  console.log("- Execution history          PASS");
  console.log("- Status integrity           PASS");
}

main().catch(error => {
  console.error("\n==========================================");
  console.error(" DEVELOPER PLATFORM TEST FAILED");
  console.error("==========================================");
  console.error(error.stack || error.message || error);
  process.exit(1);
});
