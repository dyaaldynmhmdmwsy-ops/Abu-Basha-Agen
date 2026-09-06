"use strict";

const assert = require("assert");
const Master = require("../src/agents/master");

(async () => {
  const master = new Master({ mode: "simulation" });

  const normalized = master.normalizeRequest("حلل فكرة محتوى");
  assert.strictEqual(normalized.success, true);
  assert.strictEqual(normalized.type, "request_normalized");
  assert.strictEqual(normalized.request.text, "حلل فكرة محتوى");
  assert.strictEqual(normalized.request.intent, "unknown");
  assert.strictEqual(normalized.request.source, "text");

  const understood = await master.understand({
    text: "اعرض خطة المحتوى",
    intent: "content_planning",
    payload: { channel: "facebook" },
    source: "text"
  });

  assert.strictEqual(understood.success, true);
  assert.strictEqual(understood.type, "intent_understood");
  assert.strictEqual(understood.intent, "content_planning");
  assert.strictEqual(understood.request.payload.channel, "facebook");

  const proposal = master.proposePlan({
    text: "اعرض خطة المحتوى",
    intent: "content_planning"
  });

  assert.strictEqual(proposal.success, true);
  assert.strictEqual(proposal.type, "plan_proposal");
  assert.strictEqual(proposal.executable, false);
  assert.strictEqual(proposal.requiresApproval, true);

  const registry = {
    plans: new Map(),
    register(id, definition) {
      this.plans.set(id, { id, ...definition });
      return { success: true, id };
    }
  };

  const attached = master.attachPlanRegistry(registry);
  assert.strictEqual(attached.success, true);
  assert.strictEqual(attached.type, "plan_registry_attached");
  assert.strictEqual(attached.owner, "runtime");

  const registered = master.registerPlanProposal(
    "content_planning",
    {
      name: "Content Planning",
      category: "content",
      steps: [
        { name: "analyze", label: "Analyze", type: "execution" },
        { name: "approve", label: "Approval", type: "control" }
      ]
    }
  );

  assert.strictEqual(registered.success, true);
  assert.strictEqual(registered.type, "plan_registered");
  assert.strictEqual(registered.id, "content_planning");
  assert.strictEqual(registry.plans.has("content_planning"), true);

  const invalid = master.normalizeRequest({});
  assert.strictEqual(invalid.success, false);
  assert.strictEqual(invalid.type, "empty_request");

  console.log("PHASE9_MASTER_REQUEST_CONTRACT=PASS");
  console.log("PHASE9_MASTER_INTENT_CONTRACT=PASS");
  console.log("PHASE9_MASTER_PLAN_PROPOSAL_CONTRACT=PASS");
  console.log("PHASE9_MASTER_REQUEST_SAFETY=PASS");
})();
