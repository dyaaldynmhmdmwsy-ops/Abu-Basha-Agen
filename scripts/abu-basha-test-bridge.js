#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawnSync } = require("child_process");

const ROOT = process.cwd();
const APP = path.join(ROOT, "control-center");
const RESULT = {
  schema: "abu-basha-test-bridge/v1",
  project: "Abu Basha AI",
  mode: "read-only",
  timestamp: new Date().toISOString(),
  checks: {},
  evidence: {},
  summary: {}
};

function exists(p) {
  return fs.existsSync(p);
}

function run(cmd, args = [], options = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    timeout: options.timeout || 15000,
    maxBuffer: 512 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    ...options
  });

  return {
    code: typeof r.status === "number" ? r.status : 1,
    stdout: String(r.stdout || "").trim(),
    stderr: String(r.stderr || "").trim()
  };
}

function httpGet(url, timeout = 5000) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let body = "";
      res.setEncoding("utf8");

      res.on("data", (chunk) => {
        if (body.length < 20000) body += chunk;
      });

      res.on("end", () => {
        resolve({
          reachable: true,
          status: res.statusCode || 0,
          body
        });
      });
    });

    req.setTimeout(timeout, () => {
      req.destroy();
      resolve({ reachable: false, status: 0, body: "" });
    });

    req.on("error", () => {
      resolve({ reachable: false, status: 0, body: "" });
    });
  });
}

function pass(name, value, evidence = null) {
  RESULT.checks[name] = !!value;
  if (evidence !== null) RESULT.evidence[name] = evidence;
}

async function main() {
  if (!exists(path.join(ROOT, "package.json"))) {
    console.log("FAIL=PROJECT_ROOT");
    process.exit(1);
  }

  pass(
    "PROJECT_ROOT",
    exists(path.join(ROOT, "src")) &&
    exists(path.join(ROOT, "package.json"))
  );

  pass(
    "FRONTEND_SOURCE",
    exists(path.join(APP, "src", "App.tsx")) &&
    exists(path.join(APP, "src", "api.ts"))
  );

  const app = exists(path.join(APP, "src", "App.tsx"))
    ? fs.readFileSync(path.join(APP, "src", "App.tsx"), "utf8")
    : "";

  const workspaceIds = [
    "overview",
    "coding",
    "editing",
    "studio",
    "settings"
  ];

  const workspaceEvidence = {};
  for (const id of workspaceIds) {
    workspaceEvidence[id] = {
      definition: app.includes(`id: "${id}"`),
      render: app.includes(`activeWorkspace === "${id}"`)
    };
  }

  const workspacePass = workspaceIds.every(
    (id) =>
      workspaceEvidence[id].definition &&
      workspaceEvidence[id].render
  );

  pass("WORKSPACE_STATIC_BINDING", workspacePass, workspaceEvidence);

  pass(
    "SETTINGS_WORKSPACE_PRESENT",
    app.includes('activeWorkspace === "settings"')
  );

  pass(
    "CANONICAL_WORKSPACE_STATE",
    app.includes("const [activeWorkspace") &&
    app.includes("setActiveWorkspace")
  );

  pass(
    "SETTINGS_SECURITY_GLOBAL_SAVE_BOUNDARY",
    app.includes("account: settings.account") &&
    app.includes("appearance: settings.appearance") &&
    app.includes("agent: settings.agent") &&
    app.includes("tools: settings.tools") &&
    app.includes("connectors: settings.connectors") &&
    app.includes("ai: settings.ai") &&
    app.includes("notifications: settings.notifications") &&
    app.includes("data: settings.data") &&
    !app.includes("security: settings.security")
  );

  const health = await httpGet("http://127.0.0.1:3000/health");

  RESULT.evidence.RUNTIME_HEALTH = {
    reachable: health.reachable,
    status: health.status
  };

  let healthJson = null;
  if (health.reachable && health.body) {
    try {
      healthJson = JSON.parse(health.body);
    } catch {}
  }

  pass(
    "RUNTIME_HEALTH",
    !!(
      healthJson &&
      healthJson.status &&
      healthJson.success !== undefined &&
      healthJson.type
    ),
    healthJson || {
      reachable: health.reachable,
      status: health.status
    }
  );

  const adb = run("adb", ["devices"], { timeout: 5000 });
  const deviceLines = adb.stdout
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter((x) => x && !x.startsWith("List of devices"));

  const devices = deviceLines
    .map((line) => {
      const parts = line.split(/\s+/);
      return {
        id: parts[0] || "",
        state: parts[1] || ""
      };
    })
    .filter((x) => x.id);

  RESULT.evidence.ADB = {
    available: adb.code === 0,
    devices
  };

  pass("ADB_AVAILABLE", adb.code === 0);
  pass("ANDROID_DEVICE_CONNECTED", devices.some((d) => d.state === "device"));

  RESULT.summary.pass = Object.values(RESULT.checks).filter(Boolean).length;
  RESULT.summary.fail = Object.values(RESULT.checks).filter((x) => !x).length;
  RESULT.summary.total = Object.keys(RESULT.checks).length;

  RESULT.summary.androidLive =
    RESULT.checks.ANDROID_DEVICE_CONNECTED
      ? "AVAILABLE"
      : "BLOCKED_BY_ENVIRONMENT";

  console.log("=== ABU BASHA TEST BRIDGE V1 ===");

  for (const [name, ok] of Object.entries(RESULT.checks)) {
    console.log(`${ok ? "PASS" : "FAIL"}=${name}`);
  }

  console.log(
    `SUMMARY=PASS:${RESULT.summary.pass}/FAIL:${RESULT.summary.fail}/TOTAL:${RESULT.summary.total}`
  );

  console.log(`ANDROID_LIVE=${RESULT.summary.androidLive}`);

  console.log("=== JSON ===");
  console.log(JSON.stringify(RESULT, null, 2));
}

main().catch((err) => {
  console.error("FAIL=TEST_BRIDGE_INTERNAL");
  console.error(String(err && err.message ? err.message : err));
  process.exit(1);
});
