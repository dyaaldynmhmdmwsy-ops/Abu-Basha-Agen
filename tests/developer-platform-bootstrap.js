"use strict";

const assert = require("assert");
const AgentRuntime = require("../src/core/runtime");

async function main() {
  console.log("==========================================");
  console.log(" DEVELOPER PLATFORM BOOTSTRAP TEST v1");
  console.log("==========================================");

  const runtime = new AgentRuntime();

  assert(runtime.developerTools, "Developer registry missing");
  assert(runtime.developerPlatform, "Developer platform bootstrap missing");

  console.log("[1] Runtime bootstrap");
  console.log("PASS");

  const registry = runtime.developerTools;

  for (const name of ["termux", "node", "python"]) {
    assert(
      registry.has(name),
      `Default developer tool missing: ${name}`
    );
  }

  console.log("\n[2] Default tools available");
  console.log("PASS");

  assert(
    runtime.planExecutor.toolRegistry === registry,
    "PlanExecutor registry is not shared"
  );

  assert(
    runtime.planExecutor.developerExecutor.toolRegistry === registry,
    "DeveloperExecutor registry is not shared"
  );

  console.log("\n[3] Shared registry integrity");
  console.log("PASS");

  const secondBootstrap = require("../src/developer-platform")
    .createDefaultDeveloperPlatform({
      registry,
      rootDir: process.cwd()
    });

  assert(
    secondBootstrap.success === true,
    "Second bootstrap failed"
  );

  assert(
    secondBootstrap.registered.length === 0,
    "Second bootstrap registered duplicate tools"
  );

  assert(
    secondBootstrap.skipped.length === 3,
    "Second bootstrap did not skip all default tools"
  );

  console.log("\n[4] Idempotent bootstrap");
  console.log("PASS");

  const status = runtime.developerTools.getStatus();

  assert(
    status.total === 3,
    `Expected 3 tools, got ${status.total}`
  );

  console.log("\n[5] Registry status");
  console.log("PASS");

  const runtimeStatus = runtime.planExecutor.getStatus();

  assert(
    runtimeStatus.executors &&
    runtimeStatus.executors.developer,
    "Developer executor status missing"
  );

  assert(
    runtimeStatus.toolRegistry &&
    runtimeStatus.toolRegistry.total === 3,
    "PlanExecutor tool registry status mismatch"
  );

  console.log("\n[6] PlanExecutor status");
  console.log("PASS");

  console.log("\n==========================================");
  console.log(" DEVELOPER PLATFORM BOOTSTRAP PASS");
  console.log("==========================================");

  console.log("\nSummary:");
  console.log("- Runtime bootstrap          PASS");
  console.log("- Default tools              PASS");
  console.log("- Shared registry            PASS");
  console.log("- Idempotent bootstrap       PASS");
  console.log("- Registry status            PASS");
  console.log("- PlanExecutor status        PASS");
}

main().catch(error => {
  console.error("\n==========================================");
  console.error(" DEVELOPER PLATFORM BOOTSTRAP FAIL");
  console.error("==========================================");
  console.error(error.stack || error.message || error);
  process.exit(1);
});
