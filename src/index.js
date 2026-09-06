const readline = require("readline");
const Agent = require("./agent");
const config = require("./config");

function createAgent() {
  return new Agent();
}

function printBanner(agent) {
  console.log("================================");
  console.log("   وكيل أبو بشة");
  console.log("   Status:", agent.status);
  console.log("   Port:", config.port);
  console.log(
    "   Gemini key:",
    config.geminiApiKey ? "SET" : "NOT SET"
  );
  console.log("================================");
}

function startCLI() {
  // Never start an interactive readline session without a real TTY.
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.log("Agent CLI requires an interactive TTY.");
    return 0;
  }

  const agent = createAgent();

  printBanner(agent);
  console.log("اكتب أمرك للوكيل، أو اكتب خروج للخروج.\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  let closing = false;

  const shutdown = (signal) => {
    if (closing) return;
    closing = true;

    try {
      rl.close();
    } catch (_) {}

    if (signal) {
      console.log(`\nتم إيقاف الوكيل بواسطة ${signal}.`);
    }
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  const ask = () => {
    if (closing) return;

    rl.question("أنت > ", async (command) => {
      if (closing) return;

      const text = String(command || "").trim();

      if (text === "خروج") {
        shutdown();
        return;
      }

      if (!text) {
        ask();
        return;
      }

      try {
        const result = await agent.run(text);

        if (result && result.type === "approval_required") {
          console.log("\n" + result.message + "\n");
        } else {
          console.log(
            "\nوكيل أبو بشة >",
            result && result.message !== undefined
              ? result.message
              : result,
            "\n"
          );
        }
      } catch (error) {
        console.log(
          "\nAgent Error >",
          error && error.message ? error.message : String(error),
          "\n"
        );
      }

      ask();
    });
  };

  rl.once("close", () => {
    closing = true;
  });

  ask();
  return 0;
}

// Critical lifecycle boundary:
// requiring this module must NOT launch the interactive CLI.
if (require.main === module) {
  const code = startCLI();
  if (Number.isInteger(code) && code !== 0) {
    process.exitCode = code;
  }
}

module.exports = {
  startCLI,
  createAgent,
};
