"use strict";

const DeveloperToolRegistry = require("../developer-tools");
const TermuxDeveloperTool = require("../developer-tools/termux");

class NodeDeveloperTool {
  constructor(options = {}) {
    this.name = "Node Developer Tool";
    this.version = "1.0.0";
    this.status = "online";
    this.rootDir = options.rootDir || process.cwd();
  }

  async execute(payload = {}) {
    if (payload.operation !== "run_file") {
      return {
        success: false,
        type: "operation_not_allowed",
        message: `عملية Node "${payload.operation}" غير مسموحة.`
      };
    }

    if (!payload.path) {
      return {
        success: false,
        type: "invalid_path",
        message: "مسار ملف Node مطلوب."
      };
    }

    const path = require("path");
    const fs = require("fs/promises");
    const { execFile } = require("child_process");
    const { promisify } = require("util");

    const execFileAsync = promisify(execFile);
    const target = path.resolve(this.rootDir, payload.path);

    if (
      target !== this.rootDir &&
      !target.startsWith(this.rootDir + path.sep)
    ) {
      return {
        success: false,
        type: "path_outside_project",
        message: "الوصول خارج مجلد المشروع غير مسموح."
      };
    }

    try {
      await fs.access(target);

      const result = await execFileAsync(
        process.execPath,
        [target],
        {
          cwd: this.rootDir,
          timeout: 30000,
          maxBuffer: 1024 * 1024
        }
      );

      return {
        success: true,
        type: "node_executed",
        operation: payload.operation,
        path: payload.path,
        stdout: result.stdout,
        stderr: result.stderr
      };
    } catch (error) {
      return {
        success: false,
        type: "node_execution_error",
        operation: payload.operation,
        path: payload.path,
        message: error.message,
        stdout: error.stdout || "",
        stderr: error.stderr || ""
      };
    }
  }

  getStatus() {
    return {
      name: this.name,
      version: this.version,
      status: this.status,
      rootDir: this.rootDir,
      allowedOperations: ["run_file"]
    };
  }
}

class PythonDeveloperTool {
  constructor(options = {}) {
    this.name = "Python Developer Tool";
    this.version = "1.0.0";
    this.status = "online";
    this.rootDir = options.rootDir || process.cwd();
  }

  async execute(payload = {}) {
    if (payload.operation !== "run_file") {
      return {
        success: false,
        type: "operation_not_allowed",
        message: `عملية Python "${payload.operation}" غير مسموحة.`
      };
    }

    if (!payload.path) {
      return {
        success: false,
        type: "invalid_path",
        message: "مسار ملف Python مطلوب."
      };
    }

    const path = require("path");
    const fs = require("fs/promises");
    const { execFile } = require("child_process");
    const { promisify } = require("util");

    const execFileAsync = promisify(execFile);
    const target = path.resolve(this.rootDir, payload.path);

    if (
      target !== this.rootDir &&
      !target.startsWith(this.rootDir + path.sep)
    ) {
      return {
        success: false,
        type: "path_outside_project",
        message: "الوصول خارج مجلد المشروع غير مسموح."
      };
    }

    try {
      await fs.access(target);

      const result = await execFileAsync(
        "python",
        [target],
        {
          cwd: this.rootDir,
          timeout: 30000,
          maxBuffer: 1024 * 1024
        }
      );

      return {
        success: true,
        type: "python_executed",
        operation: payload.operation,
        path: payload.path,
        stdout: result.stdout,
        stderr: result.stderr
      };
    } catch (error) {
      return {
        success: false,
        type: "python_execution_error",
        operation: payload.operation,
        path: payload.path,
        message: error.message,
        stdout: error.stdout || "",
        stderr: error.stderr || ""
      };
    }
  }

  getStatus() {
    return {
      name: this.name,
      version: this.version,
      status: this.status,
      rootDir: this.rootDir,
      allowedOperations: ["run_file"]
    };
  }
}

function createDefaultDeveloperPlatform(options = {}) {
  const rootDir = options.rootDir || process.cwd();

  const registry =
    options.registry || new DeveloperToolRegistry();

  const definitions = [
    {
      name: "termux",
      tool: new TermuxDeveloperTool({ rootDir }),
      metadata: {
        category: "developer",
        description: "Safe Termux project operations",
        requiresApproval: true
      }
    },
    {
      name: "node",
      tool: new NodeDeveloperTool({ rootDir }),
      metadata: {
        category: "developer",
        description: "Safe Node.js project execution",
        requiresApproval: true
      }
    },
    {
      name: "python",
      tool: new PythonDeveloperTool({ rootDir }),
      metadata: {
        category: "developer",
        description: "Safe Python project execution",
        requiresApproval: true
      }
    }
  ];

  const registered = [];
  const skipped = [];

  for (const definition of definitions) {
    if (registry.has(definition.name)) {
      skipped.push({
        name: definition.name,
        type: "already_registered"
      });
      continue;
    }

    const result = registry.register(
      definition.name,
      definition.tool,
      definition.metadata
    );

    if (!result.success) {
      return {
        success: false,
        type: "developer_platform_registration_failed",
        failedTool: definition.name,
        result,
        registry
      };
    }

    registered.push(definition.name);
  }

  return {
    success: true,
    type: "developer_platform_ready",
    registry,
    registered,
    skipped,
    total: definitions.length
  };
}

module.exports = {
  createDefaultDeveloperPlatform,
  NodeDeveloperTool,
  PythonDeveloperTool
};
