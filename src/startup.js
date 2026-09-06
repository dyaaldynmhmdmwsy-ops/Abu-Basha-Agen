"use strict";

const { createHttpBridge, DEFAULT_HOST, DEFAULT_PORT } =
  require("./http/server");

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

    stop() {
      return bridge.stop();
    },
  };
}

function startProduction() {
  const startup = createProductionStartup();

  startup.start(() => {
    process.stdout.write(
      `Agent production startup listening on ${startup.host}:${startup.port}\n`
    );
  });

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
