"use strict";

const DiagnosticCenter = require("../src/diagnostic-center");

let failures = 0;

function check(name, condition) {
  if (condition) {
    console.log(`${name}=PASS`);
  } else {
    console.log(`${name}=FAIL`);
    failures += 1;
  }
}

(async () => {
  const center = new DiagnosticCenter();

  check(
    "CENTER_INSTANCE",
    center &&
      center.name === "diagnostic-center" &&
      center.type === "diagnostic-orchestrator"
  );

  const status = center.getStatus();

  check(
    "CENTER_SAFETY",
    status.safe === true &&
      status.readOnly === true &&
      status.autoFix === false &&
      status.externalExecution === false &&
      status.autonomousExecution === false &&
      status.failClosed === true
  );

  const provider = {
    externalExecution: false,
    autoFix: false,
    autonomousExecution: false,
    async run() {
      return {
        success: true,
        status: "PASS",
        checks: ["contract"],
        findings: [],
        recommendations: [],
        duration: 1
      };
    }
  };

  const registered = center.registerProvider(
    "contract-provider",
    provider
  );

  check(
    "PROVIDER_REGISTERED",
    registered.success === true &&
      center.hasProvider("contract-provider") === true
  );

  const duplicate = center.registerProvider(
    "contract-provider",
    provider
  );

  check(
    "DUPLICATE_PROVIDER_BLOCKED",
    duplicate.success === false &&
      duplicate.type === "duplicate_provider"
  );

  const unsafe = center.registerProvider("unsafe-provider", {
    externalExecution: true
  });

  check(
    "UNSAFE_PROVIDER_BLOCKED",
    unsafe.success === false &&
      unsafe.type === "unsafe_provider"
  );

  const normalizedPass = center.normalizeResult(
    {
      success: true,
      status: "PASS"
    },
    "contract-provider"
  );

  const normalizedWarn = center.normalizeResult(
    {
      success: true,
      status: "WARN"
    },
    "contract-provider"
  );

  const normalizedFail = center.normalizeResult(
    {
      success: false,
      status: "FAIL"
    },
    "contract-provider"
  );

  check(
    "RESULT_NORMALIZATION",
    normalizedPass.status === "PASS" &&
      normalizedWarn.status === "WARN" &&
      normalizedFail.status === "FAIL"
  );

  const report = await center.run({
    providers: ["contract-provider"]
  });

  check(
    "RUN_PASS",
    report.success === true &&
      report.status === "PASS" &&
      Array.isArray(report.providers) &&
      report.providers.length === 1
  );

  check(
    "REPORT_CONTRACT",
    report.center === "diagnostic-center" &&
      report.version === "1.0.0" &&
      report.safety &&
      report.safety.readOnly === true &&
      report.safety.autoFix === false &&
      report.safety.externalExecution === false &&
      report.safety.autonomousExecution === false &&
      report.safety.failClosed === true
  );

  const inspectReport = await center.inspect({
    providers: ["contract-provider"]
  });

  check(
    "INSPECT_CONTRACT",
    inspectReport &&
      typeof inspectReport.status === "string" &&
      Array.isArray(inspectReport.providers)
  );

  const diagnoseReport = await center.diagnose({
    providers: ["contract-provider"]
  });

  check(
    "DIAGNOSE_CONTRACT",
    diagnoseReport &&
      typeof diagnoseReport.status === "string" &&
      Array.isArray(diagnoseReport.providers)
  );

  check(
    "REPORT_ACCESS",
    center.getReport() === diagnoseReport
  );

  const missingReport = await center.run({
    providers: ["missing-provider"]
  });

  check(
    "MISSING_PROVIDER_FAIL_CLOSED",
    missingReport.success === false &&
      missingReport.status === "FAIL" &&
      missingReport.providers[0].status === "FAIL"
  );

  check(
    "LAST_REPORT_UPDATES",
    center.getReport() === missingReport
  );

  check(
    "HISTORY_TRACKING",
    Array.isArray(center.history) &&
      center.history.length === 4
  );

  console.log();
  console.log(`DIAGNOSTIC_CENTER_CONTRACT_FAILURES=${failures}`);

  if (failures === 0) {
    console.log("DIAGNOSTIC_CENTER_CONTRACT_TEST=PASS");
    process.exitCode = 0;
  } else {
    console.log("DIAGNOSTIC_CENTER_CONTRACT_TEST=FAIL");
    process.exitCode = 1;
  }
})();
