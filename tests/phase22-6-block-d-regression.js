"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

const ROOT = path.resolve(__dirname, "..");
const PACKAGE_PATH = path.join(ROOT, "package.json");
const APP_PATH = path.join(ROOT, "control-center", "src", "App.tsx");
const API_PATH = path.join(ROOT, "control-center", "src", "api.ts");
const VITE_PATH = path.join(ROOT, "control-center", "vite.config.ts");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function request(pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      {
        hostname: "127.0.0.1",
        port: 3000,
        path: pathname,
        headers: {
          Accept: "application/json"
        }
      },
      (res) => {
        let body = "";

        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });

        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            body
          });
        });
      }
    );

    req.on("error", reject);

    req.setTimeout(2000, () => {
      req.destroy(new Error("request_timeout"));
    });
  });
}

function parseJson(response) {
  assert.strictEqual(
    response.statusCode >= 200 && response.statusCode < 500,
    true,
    "HTTP response must be valid"
  );

  return {
    statusCode: response.statusCode,
    body: JSON.parse(response.body)
  };
}

function waitForHealth(child, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const poll = async () => {
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error("backend_health_timeout"));
        return;
      }

      if (child.exitCode !== null) {
        reject(new Error("backend_exited_before_health"));
        return;
      }

      try {
        const response = await request("/health");
        const body = parseJson(response);

        if (
          response.statusCode === 200 &&
          body.body.success === true &&
          body.body.type === "health"
        ) {
          resolve();
          return;
        }
      } catch (_) {
        // Backend may still be starting.
      }

      setTimeout(poll, 250);
    };

    poll();
  });
}

async function stopChild(child) {
  if (child.exitCode !== null) {
    return;
  }

  if (process.platform !== "win32") {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch (error) {
      if (error.code !== "ESRCH") {
        throw error;
      }
    }
  } else {
    child.kill("SIGTERM");
  }

  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 5000);

    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function main() {
  const pkg = JSON.parse(read(PACKAGE_PATH));
  const app = read(APP_PATH);
  const api = read(API_PATH);
  const vite = read(VITE_PATH);

  assert.strictEqual(
    typeof pkg.scripts?.test,
    "string",
    "package test script must exist"
  );

  assert.ok(
    pkg.scripts.test.includes("tests/phase22-6-block-d-regression.js"),
    "npm test must include the Phase 22.6 Block D regression test"
  );

  assert.ok(
    api.includes('const API_BASE = "/api"'),
    "frontend API must use the relative API boundary"
  );

  assert.ok(
    api.includes('"/plans/status"') &&
    api.includes('"/execution/status"') &&
    api.includes('"/execution/history"'),
    "frontend monitor API routes must exist"
  );

  assert.ok(
    app.includes("getPlanStatus") &&
    app.includes("getExecutionStatus") &&
    app.includes("getExecutionHistory"),
    "Control Center must consume monitor API clients"
  );

  assert.ok(
    app.includes("Plan Registry") &&
    app.includes("Execution Monitor") &&
    app.includes("Execution History"),
    "Control Center monitor surfaces must exist"
  );

  assert.ok(
    (app.match(/READ ONLY/g) || []).length >= 3,
    "monitor surfaces must remain explicitly read-only"
  );

  assert.strictEqual(
    (app.match(
      /connector\.execute|child_process|execSync|spawnSync|execFileSync|shell\s*[:=]|\.execute\(/g
    ) || []).length,
    0,
    "frontend must not contain direct execution primitives"
  );

  assert.strictEqual(
    (app.match(
      /axios|XMLHttpRequest|EventSource|WebSocket/g
    ) || []).length,
    0,
    "frontend must not contain forbidden network primitives"
  );

  assert.strictEqual(
    (app.match(
      /apiKey|API_KEY|GEMINI_API_KEY|process\.env|secret|token|password/g
    ) || []).length,
    0,
    "frontend must not contain secret references"
  );

  assert.ok(
    vite.includes('"/api"') &&
    vite.includes("http://127.0.0.1:3000"),
    "Vite must proxy /api to the canonical backend"
  );

  const child = spawn(
    "node",
    ["src/startup.js"],
    {
      cwd: ROOT,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32"
    }
  );

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  try {
    await waitForHealth(child);

    const before = parseJson(
      await request("/api/execution/status")
    );

    assert.strictEqual(before.body.success, true);
    assert.strictEqual(before.body.type, "execution_status");

    const beforeExecuted = before.body.status?.executed;
    const beforeHistory = before.body.status?.history;

    const plan = parseJson(
      await request("/api/plans/status")
    );

    assert.strictEqual(plan.statusCode, 200);
    assert.strictEqual(plan.body.success, true);
    assert.strictEqual(plan.body.type, "plan_registry_status");

    const history = parseJson(
      await request("/api/execution/history")
    );

    assert.strictEqual(history.statusCode, 200);
    assert.strictEqual(history.body.success, true);
    assert.strictEqual(history.body.type, "execution_history");

    const after = parseJson(
      await request("/api/execution/status")
    );

    assert.strictEqual(after.body.success, true);
    assert.strictEqual(after.body.type, "execution_status");
    assert.strictEqual(after.body.status?.executed, beforeExecuted);
    assert.strictEqual(after.body.status?.history, beforeHistory);

    const unknown = parseJson(
      await request("/api/this-route-must-not-exist")
    );

    assert.strictEqual(unknown.statusCode, 404);
    assert.strictEqual(unknown.body.success, false);
    assert.strictEqual(unknown.body.failClosed, true);
    assert.strictEqual(unknown.body.type, "route_not_found");

    console.log("FRONTEND_MONITOR_CONTRACT=PASS");
    console.log("FRONTEND_SECURITY_CONTRACT=PASS");
    console.log("PLAN_ROUTE_CONTRACT=PASS");
    console.log("EXECUTION_STATUS_CONTRACT=PASS");
    console.log("EXECUTION_HISTORY_CONTRACT=PASS");
    console.log("READ_ONLY_STATE_PRESERVATION=PASS");
    console.log("UNKNOWN_ROUTE_FAIL_CLOSED=PASS");
    console.log("EXTERNAL_NETWORK_USED=NO");
    console.log("SECRETS_VALUES_PRINTED=NO");
    console.log("PHASE22_6_BLOCK_D_REGRESSION=PASS");
  } finally {
    await stopChild(child);
  }

  if (
    stdout.includes("Agent production startup listening on 127.0.0.1:3000")
  ) {
    console.log("STARTUP_CONTRACT=PASS");
  }

  if (stderr.trim()) {
    console.log("STARTUP_STDERR_PRESENT=YES");
  }
}

main().catch((error) => {
  console.error("PHASE22_6_BLOCK_D_REGRESSION=FAIL");
  console.error("ERROR=" + error.message);
  process.exitCode = 1;
});
