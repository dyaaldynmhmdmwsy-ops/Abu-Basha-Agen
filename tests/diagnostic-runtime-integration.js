"use strict";

const Runtime = require("../src/core/runtime");

const runtime = new Runtime();

const center = runtime.diagnosticCenter;
const provider = center && center.providers
  ? center.providers.get("quality")
  : null;

const checks = [
  [
    "RUNTIME_DIAGNOSTIC_CENTER_INSTANCE",
    center && typeof center.registerProvider === "function"
  ],
  [
    "RUNTIME_QUALITY_PROVIDER_REGISTERED",
    center && center.hasProvider("quality") === true
  ],
  [
    "RUNTIME_DIAGNOSTIC_CENTER_SAFE",
    center && center.getStatus().safe === true
  ],
  [
    "RUNTIME_DIAGNOSTIC_CENTER_READ_ONLY",
    center && center.getStatus().readOnly === true
  ],
  [
    "RUNTIME_QUALITY_PROVIDER_SAFE",
    provider &&
      provider.safe === true &&
      provider.readOnly === true &&
      provider.autoFix === false &&
      provider.externalExecution === false &&
      provider.autonomousExecution === false &&
      provider.failClosed === true
  ]
];

let failures = 0;

for (const [name, passed] of checks) {
  console.log(`${name}=${passed ? "PASS" : "FAIL"}`);
  if (!passed) failures++;
}

console.log(`RUNTIME_DIAGNOSTIC_INTEGRATION_FAILURES=${failures}`);

if (failures === 0) {
  console.log("DIAGNOSTIC_RUNTIME_INTEGRATION_TEST=PASS");
} else {
  console.log("DIAGNOSTIC_RUNTIME_INTEGRATION_TEST=FAIL");
  process.exitCode = 1;
}
