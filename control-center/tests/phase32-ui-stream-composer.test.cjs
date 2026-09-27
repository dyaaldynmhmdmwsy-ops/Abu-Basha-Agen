const assert = require("node:assert/strict");
const fs = require("node:fs");

const app = fs.readFileSync(
  require("node:path").join(__dirname, "../src/App.tsx"),
  "utf8"
);

assert.match(app, /chatStream\(/);
assert.match(
  app,
  /const assistantMessage = createChatMessage\(\s*"assistant",\s*""/
);
assert.match(
  app,
  /message\.id === assistantMessage\.id/
);
assert.match(app, /content: streamText/);
assert.match(
  app,
  /streamCompleted\s*=\s*true/
);
assert.match(
  app,
  /const finalAssistantMessage = \{\s*\.\.\.assistantMessage,\s*content: streamText\s*\}/
);
assert.match(
  app,
  /playVoiceText\(\s*finalAssistantMessage\.content,\s*finalAssistantMessage\.id/
);
assert.match(
  app,
  /createChatApproval\(prompt\)/
);
assert.match(
  app,
  /executeApprovedChat\(/
);
assert.doesNotMatch(
  app,
  /const result = await chat\(prompt/
);
assert.match(
  app,
  /activeChatAbortRef\.current\?\.abort\(\)/
);
assert.match(
  app,
  /activeChatRequestIdRef\.current/
);

console.log("PASS=UI_STREAM_COMPOSER_CONTRACT");
console.log("PASS=STABLE_ASSISTANT_MESSAGE_ID");
console.log("PASS=DELTA_COMPOSITION");
console.log("PASS=STREAM_END_REQUIRED");
console.log("PASS=TEXT_AUDIO_BINDING_PRESERVED");
console.log("PASS=APPROVAL_EXECUTION_PATH_PRESERVED");
console.log("PASS=UI_STREAM_CANCEL_BOUNDARY");
