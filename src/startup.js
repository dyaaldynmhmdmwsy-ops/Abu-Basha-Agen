"use strict";

// Load production environment configuration before runtime/server initialization.
require("./config");

const { createHttpBridge, DEFAULT_HOST, DEFAULT_PORT } =
  require("./http/server");

const fs = require("node:fs");
const path = require("node:path");

const RUNTIME_LOCK_DIR =
  process.env.AGENT_RUNTIME_LOCK ||
  path.resolve(__dirname, "..", ".runtime.lock");

let runtimeLockOwned = false;

function isOwnedRuntimeProcess(pid) {
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) {
    return false;
  }

  try {
    process.kill(pid, 0);

    const cmdline = fs
      .readFileSync(`/proc/${pid}/cmdline`, "utf8")
      .replace(/\\0/g, " ");

    const cwd = fs.realpathSync(`/proc/${pid}/cwd`);
    const projectRoot = path.resolve(__dirname, "..");

    return (
      cmdline.includes("node") &&
      cmdline.includes("src/startup.js") &&
      cwd === projectRoot
    );
  } catch {
    return false;
  }
}

function acquireRuntimeLock() {
  try {
    fs.mkdirSync(RUNTIME_LOCK_DIR);
  } catch (error) {
    if (!error || error.code !== "EEXIST") {
      throw error;
    }

    const pidFile = path.join(RUNTIME_LOCK_DIR, "pid");
    let ownerPid = 0;

    try {
      ownerPid = Number.parseInt(
        fs.readFileSync(pidFile, "utf8").trim(),
        10
      );
    } catch {}

    if (isOwnedRuntimeProcess(ownerPid)) {
      const error = new Error(
        `Runtime ownership already held by PID ${ownerPid}`
      );
      error.code = "RUNTIME_ALREADY_RUNNING";
      throw error;
    }

    fs.rmSync(RUNTIME_LOCK_DIR, { recursive: true, force: true });
    fs.mkdirSync(RUNTIME_LOCK_DIR);
  }

  try {
    fs.writeFileSync(
      path.join(RUNTIME_LOCK_DIR, "pid"),
      String(process.pid),
      { encoding: "utf8", flag: "wx" }
    );

    runtimeLockOwned = true;
  } catch (error) {
    if (error && error.code === "EEXIST") {
      const error2 = new Error("Runtime ownership already held");
      error2.code = "RUNTIME_ALREADY_RUNNING";
      throw error2;
    }

    throw error;
  }
}

function releaseRuntimeLock() {
  if (!runtimeLockOwned) {
    return;
  }

  runtimeLockOwned = false;

  try {
    fs.rmSync(RUNTIME_LOCK_DIR, {
      recursive: true,
      force: true
    });
  } catch {}
}

function installRuntimeLifecycle(startup) {
  let shuttingDown = false;

  const shutdown = () => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    const finish = () => {
      releaseRuntimeLock();
      process.exitCode = 0;
    };

    try {
      startup.stop(finish);
    } catch {
      finish();
    }
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  return shutdown;
}


const HOST = process.env.AGENT_HOST || DEFAULT_HOST;
const PORT = Number(process.env.AGENT_PORT || DEFAULT_PORT);

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("Invalid AGENT_PORT");
}

function createProductionStartup(options = {}) {
  const bridge = createHttpBridge({
    ...options,
    host: options.host || HOST,
    port: options.port || PORT,
  });

  return {
    bridge,
    host: bridge.host,
    port: bridge.port,

    start(callback) {
      return bridge.start(callback);
    },

    stop(callback) {
      return bridge.stop(callback);
    },
  };
}

function startProduction() {
  acquireRuntimeLock();

  const startup = createProductionStartup();
  installRuntimeLifecycle(startup);

  try {
    startup.start(() => {
      process.stdout.write(
        `Agent production startup listening on ${startup.host}:${startup.port} pid=${process.pid}\n`
      );
    });
  } catch (error) {
    releaseRuntimeLock();
    throw error;
  }

  return startup;
}

if (require.main === module) {
  startProduction();
}

module.exports = {
  createProductionStartup,
  startProduction,
  DEFAULT_HOST,
  DEFAULT_PORT,
};
