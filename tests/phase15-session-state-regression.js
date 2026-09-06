"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const SessionStateManager = require("../src/session-state");
const Runtime = require("../src/core/runtime");

function assert(condition, label) {
  if (!condition) {
    throw new Error("ASSERTION_FAILED: " + label);
  }
  console.log(label + "=PASS");
}

const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "agent-phase15-")
);

const dbPath = path.join(tempDir, "session-state.sqlite");
const sessionId = "phase15-permanent-regression";

let manager;

try {
  manager = new SessionStateManager({ dbPath });

  const status = manager.getStatus();

  assert(status.phase === 15, "PHASE=15");
  assert(status.database === "sqlite", "DATABASE=SQLITE");
  assert(status.safe === true, "SAFE=true");
  assert(status.failClosed === true, "FAIL_CLOSED=true");
  assert(status.requiresApproval === true, "APPROVAL_REQUIRED=true");
  assert(status.executionEnabled === false, "EXECUTION_DISABLED=true");

  const created = manager.createSession(sessionId, {
    source: "phase15-permanent-regression"
  });

  assert(created.success === true, "SESSION_CREATE=PASS");
  assert(created.session.state === "RECEIVED", "INITIAL_STATE=RECEIVED");
  assert(created.session.revision === 0, "INITIAL_REVISION=0");

  const understood = manager.transition(
    sessionId,
    "UNDERSTOOD",
    { reason: "permanent-regression" }
  );

  assert(understood.success === true, "VALID_TRANSITION=PASS");
  assert(understood.session.state === "UNDERSTOOD", "STATE_UNDERSTOOD=PASS");
  assert(understood.session.revision === 1, "REVISION_INCREMENT=PASS");

  const invalid = manager.transition(
    sessionId,
    "COMPLETED",
    { reason: "must-fail-closed" }
  );

  assert(invalid.success === false, "INVALID_TRANSITION_BLOCKED=PASS");
  assert(
    invalid.type === "transition_rejected",
    "INVALID_TRANSITION_FAIL_CLOSED=PASS"
  );

  const unchanged = manager.getSession(sessionId);

  assert(
    unchanged.state === "UNDERSTOOD",
    "STATE_UNCHANGED_AFTER_REJECTION=PASS"
  );

  assert(
    unchanged.revision === 1,
    "REVISION_UNCHANGED_AFTER_REJECTION=PASS"
  );

  const idempotent = manager.transition(sessionId, "UNDERSTOOD");

  assert(
    idempotent.success === true,
    "IDEMPOTENT_TRANSITION=PASS"
  );

  assert(
    idempotent.type === "transition_idempotent",
    "IDEMPOTENT_TYPE=PASS"
  );

  const transitions = manager.getTransitions(sessionId);

  assert(transitions.length === 2, "JOURNAL_ENTRIES=PASS");
  assert(transitions[0].to_state === "RECEIVED", "JOURNAL_CREATE=PASS");
  assert(
    transitions[1].to_state === "UNDERSTOOD",
    "JOURNAL_TRANSITION=PASS"
  );

  manager.close();
  manager = null;

  assert(fs.existsSync(dbPath), "SQLITE_FILE_PERSISTED=PASS");

  manager = new SessionStateManager({ dbPath });

  const recovered = manager.recover(sessionId);

  assert(recovered.success === true, "RECOVERY=PASS");
  assert(
    recovered.session.state === "UNDERSTOOD",
    "RECOVERED_STATE=PASS"
  );
  assert(
    recovered.session.revision === 1,
    "RECOVERED_REVISION=PASS"
  );
  assert(
    recovered.transitions.length === 2,
    "RECOVERED_JOURNAL=PASS"
  );
  assert(
    recovered.executable === false,
    "RECOVERY_NON_EXECUTABLE=PASS"
  );
  assert(
    recovered.executionStarted === false,
    "RECOVERY_DID_NOT_EXECUTE=PASS"
  );
  assert(
    recovered.requiresApproval === true,
    "RECOVERY_REQUIRES_APPROVAL=PASS"
  );

  const runtime = new Runtime();

  assert(
    runtime.sessionState &&
    typeof runtime.sessionState.createSession === "function",
    "RUNTIME_SESSION_STATE_PRESENT=PASS"
  );

  assert(
    runtime.sessionState.getStatus().phase === 15,
    "RUNTIME_SESSION_STATE_PHASE=PASS"
  );

  runtime.sessionState.close();

  console.log("PHASE15_PERMANENT_REGRESSION=PASS");
} finally {
  if (manager) {
    manager.close();
  }

  fs.rmSync(tempDir, {
    recursive: true,
    force: true
  });
}
