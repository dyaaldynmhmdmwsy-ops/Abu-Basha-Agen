"use strict";

const Runtime = require("../src/core/runtime");

(async () => {
  let failures = 0;

  function check(name, condition) {
    console.log(`${name}=${condition ? "PASS" : "FAIL"}`);
    if (!condition) failures++;
  }

  const runtime = new Runtime();
  const center = runtime.diagnosticCenter;

  check("CENTER_INSTANCE", !!center);

  const providers = center.listProviders();

  check(
    "ENVIRONMENT_FORENSIC_REGISTERED",
    providers.includes("environment-forensic")
  );

  const provider = center.providers.get("environment-forensic");

  check(
    "PROVIDER_SAFETY",
    provider &&
    provider.safe === true &&
    provider.readOnly === true &&
    provider.autoFix === false &&
    provider.externalExecution === false &&
    provider.autonomousExecution === false &&
    provider.failClosed === true
  );

  check(
    "PROVIDER_API",
    provider &&
    typeof provider.run === "function" &&
    typeof provider.inspect === "function" &&
    typeof provider.diagnose === "function"
  );

  const report = await center.run({
    providers: ["environment-forensic"]
  });

  check(
    "CENTER_REPORT",
    report &&
    Array.isArray(report.providers)
  );

  const result = report &&
    Array.isArray(report.providers)
      ? report.providers.find(
          item => item.provider === "environment-forensic"
        )
      : null;

  check("PROVIDER_RESULT_PRESENT", !!result);

  check(
    "PROVIDER_RESULT_VALID",
    !!result &&
    ["PASS", "WARN", "FAIL"].includes(result.status) &&
    typeof result.success === "boolean" &&
    Array.isArray(result.checks)
  );

  check(
    "NODE_CHECK",
    !!result &&
    result.checks.some(
      item => item.name === "node" && item.status === "PASS"
    )
  );

  check(
    "PACKAGE_CHECK",
    !!result &&
    result.checks.some(
      item => item.name === "package-json" && item.status === "PASS"
    )
  );

  const providerCheckFailures = !!result
    ? result.checks.filter(item => item.status === "FAIL").length
    : -1;

  check(
    "NO_PROVIDER_FAILURES",
    !!result &&
    result.success === true &&
    providerCheckFailures === 0
  );

  console.log(`ENVIRONMENT_FORENSIC_STATUS=${result ? result.status : "UNDEFINED"}`);
  console.log(`ENVIRONMENT_FORENSIC_REGRESSION_FAILURES=${failures}`);

  if (failures === 0 && result && result.status !== "FAIL") {
    console.log("ENVIRONMENT_FORENSIC_PROVIDER_REGRESSION=PASS");
  } else {
    console.log("ENVIRONMENT_FORENSIC_PROVIDER_REGRESSION=FAIL");
  }

  process.exitCode =
    failures === 0 && result && result.status !== "FAIL" ? 0 : 1;
})().catch(error => {
  console.error("UNHANDLED_TEST_ERROR=" + error.message);
  process.exitCode = 1;
});
