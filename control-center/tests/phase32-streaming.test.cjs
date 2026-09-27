"use strict";

const assert = require("node:assert/strict");
const Runtime = require("../../src/core/runtime");

assert.match(
  require("node:fs").readFileSync(
    "src/connectors/adapters/gemini-adapter.js",
    "utf8"
  ),
  /async \*executeStream\(/
);

assert.match(
  require("node:fs").readFileSync(
    "src/core/runtime.js",
    "utf8"
  ),
  /async \*chatStream\(/
);

(async () => {
  const runtime = new Runtime(process.cwd());

  let streamCalls = 0;

  runtime.geminiAdapter = {
    executeStream: async function* () {
      streamCalls += 1;

      yield {
        success: true,
        type: "gemini_stream_chunk",
        text: "مرحبا "
      };

      yield {
        success: true,
        type: "gemini_stream_chunk",
        text: "أبو بشة"
      };

      yield {
        success: true,
        type: "gemini_stream_end",
        text: ""
      };
    }
  };

  const chunks = [];

  for await (
    const chunk of runtime.chatStream(
      "اختبار Streaming",
      {
        requestId: "stream-test-1"
      }
    )
  ) {
    chunks.push(chunk);
  }

  assert.equal(streamCalls, 1);
  assert.equal(
    chunks.filter(
      (chunk) =>
        chunk.type === "conversation_stream_chunk"
    ).length,
    2
  );

  const end = chunks.at(-1);

  assert.equal(
    end.type,
    "conversation_stream_end"
  );

  assert.equal(end.done, true);

  const cancelledId = "stream-cancel-test";

  await runtime.cancelChat(cancelledId);

  const cancelledChunks = [];

  for await (
    const chunk of runtime.chatStream(
      "لن يبدأ",
      {
        requestId: cancelledId
      }
    )
  ) {
    cancelledChunks.push(chunk);
  }

  assert.equal(
    cancelledChunks.length,
    1
  );

  assert.equal(
    cancelledChunks[0].type,
    "chat_generation_cancelled"
  );

  console.log("PASS=STREAM_RUNTIME_BEHAVIOR");
  console.log("PASS=STREAM_CHUNKS_EMITTED");
  console.log("PASS=STREAM_END_CONTRACT");
  console.log("PASS=STREAM_CANCEL_FAIL_CLOSED");
})().catch((error) => {
  console.error(
    "FAIL=STREAM_RUNTIME_BEHAVIOR:" +
      (error?.message || String(error))
  );
  process.exitCode = 1;
});
