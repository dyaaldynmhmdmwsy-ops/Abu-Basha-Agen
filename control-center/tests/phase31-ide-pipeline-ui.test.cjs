const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");

function required(text, label) {
  assert(
    app.includes(text),
    `MISSING_UI_CONTRACT:${label}`
  );
}

/*
 * Phase 31 IDE Pipeline UI contract.
 * These are intentionally absent before the patch.
 */
required("DevelopmentPipelineStatusResponse", "PIPELINE_STATUS_TYPE_USAGE");
required("getDevelopmentPipelineStatus", "PIPELINE_STATUS_API_USAGE");
required("pipelineStatus", "PIPELINE_STATUS_STATE");
required("pipelineStatusLoading", "PIPELINE_STATUS_LOADING_STATE");
required("refreshDevelopmentPipelineStatus", "PIPELINE_STATUS_REFRESH");
required("Development Pipeline", "PIPELINE_STATUS_UI");
