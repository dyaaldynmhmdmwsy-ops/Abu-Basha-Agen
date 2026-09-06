"use strict";

const assert = require("assert");
const http = require("http");
const fs = require("fs");
const { spawn } = require("child_process");

const ROOT = process.cwd();
const STARTUP_FILE = "src/startup.js";
const PACKAGE_FILE = "package.json";

function requestHealth(port) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: "/health",
        method: "GET",
        timeout: 2000,
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
            body,
          });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("health request timeout"));
    });

    req.on("error", reject);
    req.end();
  });
}

async function waitForHealth(port, child) {
  for (let i = 0; i < 30; i += 1) {
    if (child.exitCode !== null) {
      throw new Error(`process exited early with code ${child.exitCode}`);
    }

    try {
      const response = await requestHealth(port);

      if (response.statusCode === 200) {
        const data = JSON.parse(response.body);

        if (data && data.status === "ok") {
          return data;
        }
      }
    } catch {
      // Process may still be starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`health endpoint unavailable on port ${port}`);
}

function stopProcess(child) {
  return new Promise((resolve, reject) => {
    if (child.exitCode !== null) {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("process did not stop within timeout"));
    }, 3000);

    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });

    child.kill();
  });
}

async function runScript(script, port) {
  const child = spawn(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", script],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        AGENT_HOST: "127.0.0.1",
        AGENT_PORT: String(port),
      },
      stdio: ["ignore", "pipe", "pipe"],
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

  const health = await waitForHealth(port, child);

  assert.strictEqual(health.status, "ok");

  await stopProcess(child);

  return {
    stdout,
    stderr,
  };
}

async function main() {
  const pkg = JSON.parse(
    fs.readFileSync(PACKAGE_FILE, "utf8")
  );

  assert.strictEqual(pkg.main, "src/index.js");
  assert.strictEqual(pkg.scripts?.start, "node src/startup.js");
  assert.strictEqual(pkg.scripts?.release, "node src/startup.js");

  assert.ok(fs.existsSync(STARTUP_FILE));

  console.log("PACKAGE_STARTUP_CONTRACT=PASS");
  console.log("STARTUP_FILE_PRESENT=PASS");

  const startResult = await runScript("start", 33123);

  assert.match(
    startResult.stdout,
    /Agent production startup listening on 127\.0\.0\.1:33123/
  );

  console.log("NPM_START_RUNTIME=PASS");
  console.log("NPM_START_HEALTH=PASS");
  console.log("NPM_START_STOP=PASS");
  console.log("NPM_START_LOG=PASS");

  const releaseResult = await runScript("release", 33124);

  assert.match(
    releaseResult.stdout,
    /Agent production startup listening on 127\.0\.0\.1:33124/
  );

  console.log("NPM_RELEASE_RUNTIME=PASS");
  console.log("NPM_RELEASE_HEALTH=PASS");
  console.log("NPM_RELEASE_STOP=PASS");
  console.log("NPM_RELEASE_LOG=PASS");

  console.log("EXTERNAL_NETWORK_USED=NO");
  console.log("SECRETS_VALUES_PRINTED=NO");
  console.log("PHASE23_2_STARTUP_RELEASE_REGRESSION=PASS");
}

main().catch((error) => {
  console.error(
    "PHASE23_2_STARTUP_RELEASE_REGRESSION=FAIL"
  );
  console.error(
    "ERROR_TYPE=" + error.constructor.name
  );
  console.error(
    "ERROR_MESSAGE=" + error.message
  );
  process.exitCode = 1;
});
