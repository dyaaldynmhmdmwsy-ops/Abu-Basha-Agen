"use strict";

const assert = require("assert");
const VerificationEngine = require("../src/diagnostic-center/verification-engine");

const engine = new VerificationEngine();

assert.strictEqual(engine.getStatus().safe, true);
assert.strictEqual(engine.getStatus().readOnly, true);
assert.strictEqual(engine.getStatus().autoFix, false);
assert.strictEqual(engine.getStatus().externalExecution, false);
assert.strictEqual(engine.getStatus().autonomousExecution, false);
assert.strictEqual(engine.getStatus().failClosed, true);

const provenInput = {
  findings: [
    {
      findingId: "F-1",
      provider: "test",
      classification: "FAIL",
      evidence: ["evidence-A"],
      ids: {
        correlationId: "C-1"
      }
    }
  ],

  rootCause: {
    rootCauses: [
      {
        findingId: "F-1",
        provider: "test",
        rootCause: "Explicit proven cause",
        evidence: ["evidence-A"],
        affectedFiles: ["src/example.js"],
        requiredFix: "Apply exact fix",
        patchScope: "src/example.js",
        targetedTest: "node tests/example.js",
        securityImpact: "No security regression",
        expectedResult: "Failure is resolved",
        correlationIds: {
          correlationId: "C-1"
        }
      }
    ]
  },

  repairPlan: {
    plans: [
      {
        findingId: "F-1",
        provider: "test",
        rootCause: "Explicit proven cause",
        evidence: ["evidence-A"],
        affectedFiles: ["src/example.js"],
        requiredFix: "Apply exact fix",
        patchScope: "src/example.js",
        targetedTest: "node tests/example.js",
        securityImpact: "No security regression",
        expectedResult: "Failure is resolved",
        correlationIds: {
          correlationId: "C-1"
        }
      }
    ]
  }
};

const proven = engine.buildReport(provenInput);

assert.strictEqual(proven.success, true);
assert.strictEqual(proven.status, "PROVEN");
assert.strictEqual(proven.summary.proven, 1);
assert.strictEqual(proven.summary.unresolved, 0);
assert.strictEqual(proven.summary.contradicted, 0);


const healthy = engine.buildReport({
  findings: [
    {
      findingId: "F-HEALTHY",
      provider: "test",
      classification: "PASS",
      evidence: ["healthy-evidence"]
    }
  ],
  rootCause: {
    rootCauses: []
  },
  repairPlan: {
    plans: []
  }
});

assert.strictEqual(healthy.status, "PROVEN");
assert.strictEqual(healthy.summary.proven, 1);
assert.strictEqual(healthy.summary.unresolved, 0);
assert.strictEqual(healthy.summary.contradicted, 0);
assert.strictEqual(healthy.proven[0].findingStatus, "PROVEN");
assert.strictEqual(healthy.proven[0].rootCauseStatus, "NOT_APPLICABLE");
assert.strictEqual(healthy.proven[0].repairStatus, "NOT_APPLICABLE");

const noEvidence = engine.buildReport({
  findings: [
    {
      findingId: "F-NO-EVIDENCE",
      provider: "test",
      classification: "FAIL",
      evidence: []
    }
  ],
  rootCause: {
    rootCauses: []
  },
  repairPlan: {
    plans: []
  }
});

assert.strictEqual(noEvidence.status, "UNRESOLVED");
assert.strictEqual(noEvidence.summary.proven, 0);
assert.strictEqual(noEvidence.summary.unresolved, 1);
assert.strictEqual(noEvidence.summary.contradicted, 0);
assert.strictEqual(noEvidence.unresolved[0].findingStatus, "UNRESOLVED");
assert.strictEqual(noEvidence.unresolved[0].rootCauseStatus, "UNRESOLVED");
assert.strictEqual(noEvidence.unresolved[0].repairStatus, "UNRESOLVED");

const unresolved = engine.buildReport({
  findings: [
    {
      findingId: "F-2",
      provider: "test",
      classification: "FAIL",
      evidence: ["evidence-B"],
      ids: {
        correlationId: "C-2"
      }
    }
  ],
  rootCause: {
    rootCauses: []
  },
  repairPlan: {
    plans: []
  }
});

assert.strictEqual(unresolved.status, "UNRESOLVED");
assert.strictEqual(unresolved.summary.unresolved, 1);

const contradicted = engine.buildReport({
  findings: [
    {
      findingId: "F-3",
      provider: "test",
      classification: "FAIL",
      evidence: ["evidence-C"],
      ids: {
        correlationId: "C-3"
      }
    }
  ],
  rootCause: {
    rootCauses: [
      {
        findingId: "F-3",
        provider: "test",
        rootCause: "Cause",
        evidence: ["DIFFERENT-EVIDENCE"],
        affectedFiles: ["src/example.js"],
        requiredFix: "Fix",
        patchScope: "src/example.js",
        targetedTest: "node tests/example.js",
        securityImpact: "Safe",
        expectedResult: "Resolved",
        correlationIds: {
          correlationId: "C-3"
        }
      }
    ]
  },
  repairPlan: {
    plans: []
  }
});

assert.strictEqual(contradicted.status, "CONTRADICTED");
assert.strictEqual(contradicted.summary.contradicted, 1);

const provenClassificationWithEvidence =
  engine.buildReport({
    findings: [
      {
        findingId: "F-PROVEN-CLASSIFICATION",
        provider: "semantic-test",
        classification: "PROVEN",
        evidence: ["direct-proof"]
      }
    ],
    rootCause: { rootCauses: [] },
    repairPlan: { plans: [] }
  });

if (
  provenClassificationWithEvidence.status !== "PROVEN" ||
  provenClassificationWithEvidence.proven.length !== 1 ||
  provenClassificationWithEvidence.unresolved.length !== 0 ||
  provenClassificationWithEvidence.contradicted.length !== 0
) {
  throw new Error(
    "PROVEN_CLASSIFICATION_WITH_EVIDENCE_FAILED"
  );
}

const provenClassificationWithoutEvidence =
  engine.buildReport({
    findings: [
      {
        findingId: "F-PROVEN-NO-EVIDENCE",
        provider: "semantic-test",
        classification: "PROVEN",
        evidence: []
      }
    ],
    rootCause: { rootCauses: [] },
    repairPlan: { plans: [] }
  });

if (
  provenClassificationWithoutEvidence.status !== "UNRESOLVED" ||
  provenClassificationWithoutEvidence.proven.length !== 0 ||
  provenClassificationWithoutEvidence.unresolved.length !== 1 ||
  provenClassificationWithoutEvidence.contradicted.length !== 0
) {
  throw new Error(
    "PROVEN_CLASSIFICATION_WITHOUT_EVIDENCE_FAILED"
  );
}

console.log("PROVEN_CLASSIFICATION_WITH_EVIDENCE=PASS");
console.log("PROVEN_CLASSIFICATION_WITHOUT_EVIDENCE=PASS");

console.log("PRO_MAX_PLUS_VERIFICATION_TEST=PASS");
