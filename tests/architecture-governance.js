"use strict";

const assert = require("assert");
const Governance = require("../src/phase24");

console.log("========================================");
console.log(" ARCHITECTURE GOVERNANCE TEST");
console.log("========================================");

const governance = new Governance();

/* 1 */
console.log("[1] Bootstrap");
assert.ok(governance);
console.log("PASS");

/* 2 */
console.log("[2] Public API");
assert.strictEqual(
  typeof governance.inspect,
  "function"
);
assert.strictEqual(
  typeof governance.validateCapability,
  "function"
);
assert.strictEqual(
  typeof governance.getHistory,
  "function"
);
assert.strictEqual(
  typeof governance.getStatus,
  "function"
);
console.log("PASS");

/* 3 */
console.log("[3] Safety boundary");

const status = governance.inspect();

assert.strictEqual(status.safe, true);
assert.strictEqual(status.executable, false);
assert.strictEqual(status.externalExecution, false);
assert.strictEqual(status.autonomousExecution, false);
console.log("PASS");

/* 4 */
console.log("[4] Approval boundary");

assert.strictEqual(
  status.approvalRequired,
  true
);

assert.strictEqual(
  status.requireApproval,
  true
);

console.log("PASS");

/* 5 */
console.log("[5] Fail-closed policy");

assert.strictEqual(
  status.failClosed,
  true
);

console.log("PASS");

/* 6 */
console.log("[6] External execution rejection");

const external =
  governance.validateCapability({
    externalExecution: true
  });

assert.strictEqual(
  external.success,
  false
);

assert.strictEqual(
  external.externalExecution,
  false
);

console.log("PASS");

/* 7 */
console.log("[7] Autonomous execution rejection");

const autonomous =
  governance.validateCapability({
    autonomousExecution: true
  });

assert.strictEqual(
  autonomous.success,
  false
);

assert.strictEqual(
  autonomous.autonomousExecution,
  false
);

console.log("PASS");

/* 8 */
console.log("[8] Safe capability");

const safe =
  governance.validateCapability({
    name: "inspection"
  });

assert.strictEqual(
  safe.success,
  true
);

assert.strictEqual(
  safe.safe,
  true
);

assert.strictEqual(
  safe.executable,
  false
);

console.log("PASS");

/* 9 */
console.log("[9] History");

assert.ok(
  governance.getHistory().length >= 1
);

console.log("PASS");

/* 10 */
console.log("[10] Status integrity");

const finalStatus =
  governance.getStatus();

assert.strictEqual(
  finalStatus.safe,
  true
);

assert.strictEqual(
  finalStatus.executable,
  false
);

assert.strictEqual(
  finalStatus.externalExecution,
  false
);

assert.strictEqual(
  finalStatus.autonomousExecution,
  false
);

console.log("PASS");

console.log();
console.log("========================================");
console.log(" ARCHITECTURE GOVERNANCE TEST: PASS");
console.log("========================================");

console.log(
  JSON.stringify(
    {
      name: finalStatus.name,
      version: finalStatus.version,
      safe: finalStatus.safe,
      approvalRequired:
        finalStatus.approvalRequired,
      executable:
        finalStatus.executable,
      externalExecution:
        finalStatus.externalExecution,
      autonomousExecution:
        finalStatus.autonomousExecution,
      failClosed:
        finalStatus.failClosed
    },
    null,
    2
  )
);

console.log("TEST_RESULT=PASS");
