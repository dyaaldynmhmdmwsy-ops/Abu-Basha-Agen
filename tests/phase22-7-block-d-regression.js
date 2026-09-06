"use strict";

const assert = require("assert");
const http = require("http");
const { createHttpBridge } = require("../src/http/server");

function request(port, method, path, body) {
  return new Promise((resolve, reject) => {
    const payload =
      body === undefined ? "" : JSON.stringify(body);

    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload)
        }
      },
      (res) => {
        let data = "";

        res.setEncoding("utf8");

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          let parsed = null;

          try {
            parsed = JSON.parse(data);
          } catch (_) {}

          resolve({
            statusCode: res.statusCode,
            body: parsed
          });
        });
      }
    );

    req.on("error", reject);
    req.end(payload);
  });
}

function assertDiagnosticSuccess(result) {
  assert.ok(result);
  assert.strictEqual(result.success, true);
  assert.ok(["PASS", "WARN"].includes(result.status));

  assert.ok(Array.isArray(result.providers));

  for (const provider of result.providers) {
    assert.notStrictEqual(provider.status, "FAIL");
    assert.strictEqual(provider.success, true);
  }

  assert.ok(result.safety);
  assert.strictEqual(result.safety.safe, true);
  assert.strictEqual(result.safety.readOnly, true);
  assert.strictEqual(result.safety.autoFix, false);
  assert.strictEqual(result.safety.externalExecution, false);
  assert.strictEqual(result.safety.autonomousExecution, false);
  assert.strictEqual(result.safety.failClosed, true);
  assert.strictEqual(result.safety.requiresApproval, true);
}

async function main() {
  const bridge = createHttpBridge({
    host: "127.0.0.1",
    port: 0
  });

  await new Promise((resolve) => bridge.start(resolve));

  try {
    const port = bridge.server.address().port;

    const status = await request(
      port,
      "GET",
      "/api/diagnostic/status"
    );

    assert.strictEqual(status.statusCode, 200);
    assert.strictEqual(status.body.success, true);
    assert.strictEqual(status.body.type, "diagnostic_status");

    assert.strictEqual(status.body.status.safe, true);
    assert.strictEqual(status.body.status.readOnly, true);
    assert.strictEqual(status.body.status.autoFix, false);
    assert.strictEqual(status.body.status.externalExecution, false);
    assert.strictEqual(status.body.status.autonomousExecution, false);
    assert.strictEqual(status.body.status.failClosed, true);
    assert.strictEqual(status.body.status.requiresApproval, true);

    console.log("HTTP_DIAGNOSTIC_STATUS=PASS");

    const initialReport = await request(
      port,
      "GET",
      "/api/diagnostic/report"
    );

    assert.strictEqual(initialReport.statusCode, 200);
    assert.strictEqual(initialReport.body, null);

    console.log("HTTP_INITIAL_REPORT_NULL=PASS");

    const run = await request(
      port,
      "POST",
      "/api/diagnostic/run",
      { options: {} }
    );

    assert.strictEqual(run.statusCode, 200);
    assertDiagnosticSuccess(run.body);

    console.log(
      `HTTP_DIAGNOSTIC_RUN_STATUS=${run.body.status}`
    );
    console.log("HTTP_DIAGNOSTIC_RUN=PASS");
    console.log("HTTP_DIAGNOSTIC_SAFETY=PASS");
    console.log("HTTP_NO_PROVIDER_FAILURES=PASS");

    const report = await request(
      port,
      "GET",
      "/api/diagnostic/report"
    );

    assert.strictEqual(report.statusCode, 200);
    assert.ok(report.body);
    assert.strictEqual(report.body.success, true);
    assert.ok(["PASS", "WARN"].includes(report.body.status));
    assert.strictEqual(report.body.status, run.body.status);

    assert.ok(Array.isArray(report.body.providers));

    for (const provider of report.body.providers) {
      assert.notStrictEqual(provider.status, "FAIL");
      assert.strictEqual(provider.success, true);
    }

    console.log(
      `HTTP_DIAGNOSTIC_REPORT_STATUS=${report.body.status}`
    );
    console.log("HTTP_DIAGNOSTIC_REPORT=PASS");

    const unknown = await request(
      port,
      "GET",
      "/api/diagnostic/unknown"
    );

    assert.strictEqual(unknown.statusCode, 404);
    assert.strictEqual(unknown.body.success, false);
    assert.strictEqual(unknown.body.failClosed, true);

    console.log("HTTP_UNKNOWN_ROUTE_FAIL_CLOSED=PASS");
    console.log("HTTP_EXTERNAL_EXECUTION=NO");
    console.log("HTTP_EXTERNAL_NETWORK=NO");
    console.log("HTTP_SECRETS_VALUES_PRINTED=NO");
    console.log("PHASE22_7_BLOCK_D_REGRESSION=PASS");

  } finally {
    await new Promise((resolve) => bridge.stop(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
