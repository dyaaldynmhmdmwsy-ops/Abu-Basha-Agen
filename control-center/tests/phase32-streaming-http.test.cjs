"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const server = fs.readFileSync(
  "src/http/server.js",
  "utf8"
);

const apiIndex = fs.readFileSync(
  "src/api/index.js",
  "utf8"
);

const client = fs.readFileSync(
  "control-center/src/api.ts",
  "utf8"
);

assert.match(
  apiIndex,
  /async chatStream\(prompt, options = \{\}\)/
);

assert.match(
  apiIndex,
  /this\.runtime\.chatStream/
);

assert.match(
  server,
  /path === "\/api\/chat\/stream"/
);

assert.match(
  server,
  /application\/x-ndjson/
);

assert.match(
  server,
  /for await \(\s*const chunk of api\.chatStream/
);

assert.match(
  server,
  /JSON\.stringify\(chunk\) \+ "\\n"/
);

assert.match(
  client,
  /export async function chatStream\(/
);

assert.match(
  client,
  /fetch\(\s*`\$\{API_BASE\}\/chat\/stream`/
);

assert.match(
  client,
  /response\.body\.getReader\(\)/
);

assert.match(
  client,
  /application\/x-ndjson/
);

assert.match(
  client,
  /JSON\.parse\(trimmed\)/
);

assert.match(
  client,
  /delete requestOptions\.signal/
);

assert.match(
  client,
  /signal\s*\n/
);

assert.doesNotMatch(
  client,
  /createChatApproval\([^)]*signal/
);

assert.doesNotMatch(
  client,
  /executeApprovedChat\([^)]*signal/
);

console.log("PASS=STREAM_HTTP_BOUNDARY_CONTRACT");
console.log("PASS=STREAM_NDJSON_SERVER");
console.log("PASS=STREAM_CLIENT_READER");
console.log("PASS=STREAM_SIGNAL_BOUNDARY");
console.log("PASS=STREAM_APPROVAL_EXECUTION_ISOLATED");
