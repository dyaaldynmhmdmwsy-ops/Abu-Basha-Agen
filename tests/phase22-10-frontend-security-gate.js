"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const FRONTEND = path.join(ROOT, "control-center");
const DIST = path.join(FRONTEND, "dist");
const SRC = path.join(FRONTEND, "src");

const SECRET_PATTERNS = [
  /GEMINI_API_KEY\s*[:=]/i,
  /\bAPI_KEY\s*[:=]/i,
  /\bPASSWORD\s*[:=]\s*["'`]/i,
  /\bAUTHORIZATION\s*[:=]\s*["'`]/i,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/i,
  /\bVITE_[A-Z0-9_]+\s*[:=]/i
];

const DYNAMIC_SOURCE_PATTERNS = [
  /dangerouslySetInnerHTML/,
  /\beval\s*\(/,
  /\bnew\s+Function\s*\(/,
  /\bdocument\.write\s*\(/,
  /\.innerHTML\s*=/
];

const EXTERNAL_URL_PATTERN = /https?:\/\/[^\s"'`<>]+/gi;

function walk(dir) {
  if (!fs.existsSync(dir)) return [];

  const out = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;

    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }

  return out;
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    timeout: 180000
  });

  return {
    status: typeof result.status === "number" ? result.status : 1,
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || "")
  };
}

function scanFiles(files, patterns) {
  const hits = [];

  for (const file of files) {
    let text;

    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      hits.push({
        file: path.relative(ROOT, file),
        reason: "read_failed"
      });
      continue;
    }

    for (const pattern of patterns) {
      if (pattern.test(text)) {
        hits.push({
          file: path.relative(ROOT, file),
          pattern: pattern.source
        });
      }
    }
  }

  return hits;
}

function collectExternalUrls(files) {
  const urls = new Set();

  for (const file of files) {
    let text;

    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }

    const matches = text.match(EXTERNAL_URL_PATTERN) || [];

    for (const url of matches) {
      urls.add(url);
    }
  }

  return [...urls].sort();
}

function main() {
  console.log("=== PHASE 22.10 FRONTEND SECURITY GATE ===");

  let failed = false;

  if (!fs.existsSync(FRONTEND)) {
    console.log("FRONTEND=FAIL");
    console.log("ERROR=control_center_missing");
    process.exitCode = 1;
    return;
  }

  console.log("FRONTEND=PASS");

  console.log("[1/6] BUILD");
  const build = run("npm", ["run", "build"], FRONTEND);

  if (build.status !== 0) {
    console.log("BUILD=FAIL");
    if (build.stderr.trim()) {
      console.log(build.stderr.trim().slice(-4000));
    }
    failed = true;
  } else {
    console.log("BUILD=PASS");
  }

  console.log("[2/6] DIST");
  const indexFile = path.join(DIST, "index.html");

  if (fs.existsSync(indexFile)) {
    console.log("DIST=PASS");
  } else {
    console.log("DIST=FAIL");
    failed = true;
  }

  const sourceFiles = walk(SRC).filter(file =>
    /\.(js|jsx|ts|tsx)$/.test(file)
  );

  console.log("[3/6] SOURCE_SECURITY");
  const sourceDynamicHits = scanFiles(
    sourceFiles,
    DYNAMIC_SOURCE_PATTERNS
  );

  if (sourceDynamicHits.length === 0) {
    console.log("SOURCE_DYNAMIC_PATTERNS=CLEAN");
  } else {
    console.log("SOURCE_DYNAMIC_PATTERNS=FAIL");
    for (const hit of sourceDynamicHits) {
      console.log(`SOURCE_HIT=${hit.file}|${hit.pattern}`);
    }
    failed = true;
  }

  const distFiles = walk(DIST).filter(file =>
    /\.(js|css|html|map)$/.test(file)
  );

  console.log("[4/6] BUNDLE_SECRET_SCAN");
  const secretHits = scanFiles(distFiles, SECRET_PATTERNS);

  if (secretHits.length === 0) {
    console.log("BUNDLE_SECRETS=CLEAN");
  } else {
    console.log("BUNDLE_SECRETS=FAIL");

    for (const hit of secretHits) {
      console.log(`SECRET_HIT=${hit.file}|${hit.pattern}`);
    }

    failed = true;
  }

  console.log("[5/6] EXTERNAL_URL_AUDIT");
  const externalUrls = collectExternalUrls(distFiles);

  const unexpectedUrls = externalUrls.filter(url =>
    !/https:\/\/react\.dev\/errors\//i.test(url)
  );

  console.log(`EXTERNAL_URL_COUNT=${externalUrls.length}`);

  if (unexpectedUrls.length === 0) {
    console.log("EXTERNAL_URLS=EXPECTED_OR_REACT_RUNTIME");
  } else {
    console.log("EXTERNAL_URLS=REVIEW_REQUIRED");

    for (const url of unexpectedUrls) {
      console.log(`EXTERNAL_URL=${url.slice(0, 300)}`);
    }
  }

  console.log("[6/6] API_BOUNDARY");
  const sourceText = sourceFiles
    .map(file => fs.readFileSync(file, "utf8"))
    .join("\n");

  const forbiddenNetworkPattern =
    /\b(?:XMLHttpRequest|WebSocket)\s*\(/;

  const fetchCalls =
    sourceText.match(/\bfetch\s*\(\s*([^,\n]+)/g) || [];

  const absoluteApiPattern =
    /https?:\/\/(?!react\.dev\/errors\/|127\.0\.0\.1:3000\/api(?:\/|["'`\s]|$))/i;

  const forbiddenFetchCalls = fetchCalls.filter(call =>
    !/fetch\s*\(\s*["'`]\/api(?:\/|["'`])/i.test(call) &&
    !/fetch\s*\(\s*`\$\{API_BASE\}/i.test(call)
  );

  const forbiddenNetworkHits =
    forbiddenNetworkPattern.test(sourceText) ||
    absoluteApiPattern.test(sourceText) ||
    forbiddenFetchCalls.length > 0;

  if (!forbiddenNetworkHits) {
    console.log("API_BOUNDARY=CLEAN");
    console.log(`FETCH_CALLS=${fetchCalls.length}`);
    console.log("LOCAL_API_FETCH=ALLOWED");
  } else {
    console.log("API_BOUNDARY=FAIL");
    console.log(
      `FORBIDDEN_NETWORK=${forbiddenNetworkPattern.test(sourceText) ? "HIT" : "CLEAN"}`
    );
    console.log(
      `ABSOLUTE_URL=${absoluteApiPattern.test(sourceText) ? "HIT" : "CLEAN"}`
    );
    console.log(`FORBIDDEN_FETCHES=${forbiddenFetchCalls.length}`);

    for (const call of forbiddenFetchCalls) {
      console.log(`FORBIDDEN_FETCH=${call.slice(0, 300)}`);
    }

    failed = true;
  }

  console.log("");
  console.log("=== PHASE 22.10 RESULT ===");

  if (failed) {
    console.log("FRONTEND_SECURITY_GATE=FAIL");
    process.exitCode = 1;
  } else {
    console.log("FRONTEND_SECURITY_GATE=PASS");

    if (fs.existsSync(DIST)) {
      fs.rmSync(DIST, { recursive: true, force: true });
      console.log("DIST_CLEANUP=PASS");
    } else {
      console.log("DIST_CLEANUP=NOT_REQUIRED");
    }
  }
}

main();
