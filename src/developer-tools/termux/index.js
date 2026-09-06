"use strict";

const fs = require("fs/promises");
const path = require("path");

class TermuxDeveloperTool {
  constructor(options = {}) {
    this.name = "Termux Developer Tool";
    this.version = "1.1.0";
    this.status = "online";

    this.rootDir = path.resolve(
      options.rootDir || process.cwd()
    );

    this.allowedOperations = new Set([
      "read_file",
      "write_file",
      "list_files"
    ]);

    this.protectedNames = new Set([
      ".env",
      ".env.local",
      ".env.production",
      ".env.development"
    ]);

    this.protectedDirectories = new Set([
      ".git",
      ".backups",
      ".safety-backup",
      ".auto-repair-backup",
      "node_modules"
    ]);
  }

  resolveSafe(relativePath) {
    if (typeof relativePath !== "string" || !relativePath.trim()) {
      throw new Error("مسار صالح مطلوب.");
    }

    const target = path.resolve(this.rootDir, relativePath);

    if (
      target !== this.rootDir &&
      !target.startsWith(this.rootDir + path.sep)
    ) {
      throw new Error(
        "الوصول خارج مجلد المشروع غير مسموح."
      );
    }

    return target;
  }

  isProtected(target) {
    const relative = path.relative(this.rootDir, target);

    if (!relative || relative.startsWith("..")) {
      return true;
    }

    const parts = relative.split(path.sep);

    if (parts.some(part => this.protectedDirectories.has(part))) {
      return true;
    }

    if (
      parts.some(part =>
        this.protectedNames.has(part) ||
        part.startsWith(".env.")
      )
    ) {
      return true;
    }

    return false;
  }

  async resolveExistingSafe(relativePath) {
    const target = this.resolveSafe(relativePath);

    let realRoot;
    let realTarget;

    try {
      realRoot = await fs.realpath(this.rootDir);
      realTarget = await fs.realpath(target);
    } catch {
      throw new Error("المسار غير موجود أو غير صالح.");
    }

    if (
      realTarget !== realRoot &&
      !realTarget.startsWith(realRoot + path.sep)
    ) {
      throw new Error(
        "الوصول عبر رابط رمزي خارج المشروع غير مسموح."
      );
    }

    return realTarget;
  }

  async execute(payload = {}) {
    const operation = payload.operation;

    if (!this.allowedOperations.has(operation)) {
      return {
        success: false,
        type: "operation_not_allowed",
        message:
          `عملية Termux "${operation}" غير مسموحة.`
      };
    }

    try {
      if (operation === "read_file") {
        const target = await this.resolveExistingSafe(payload.path);

        if (this.isProtected(target)) {
          return {
            success: false,
            type: "protected_path",
            message: "قراءة هذا المسار محمية."
          };
        }

        const content = await fs.readFile(target, "utf8");

        return {
          success: true,
          type: "file_read",
          operation,
          path: payload.path,
          content
        };
      }

      if (operation === "write_file") {
        const target = this.resolveSafe(payload.path);

        if (this.isProtected(target)) {
          return {
            success: false,
            type: "protected_path",
            message: "الكتابة إلى هذا المسار محمية."
          };
        }

        await fs.mkdir(
          path.dirname(target),
          { recursive: true }
        );

        await fs.writeFile(
          target,
          typeof payload.content === "string"
            ? payload.content
            : "",
          {
            encoding: "utf8",
            flag: "wx"
          }
        );

        return {
          success: true,
          type: "file_written",
          operation,
          path: payload.path
        };
      }

      if (operation === "list_files") {
        const requestedPath = payload.path || ".";
        const isProjectRoot =
          requestedPath === "." ||
          requestedPath === "./";

        const target =
          await this.resolveExistingSafe(requestedPath);

        if (!isProjectRoot && this.isProtected(target)) {
          return {
            success: false,
            type: "protected_path",
            message: "هذا المسار محمي."
          };
        }

        const entries = await fs.readdir(
          target,
          { withFileTypes: true }
        );

        return {
          success: true,
          type: "files_listed",
          operation,
          path: requestedPath,
          files: entries
            .filter(
              entry =>
                !this.protectedDirectories.has(entry.name)
            )
            .map(entry => ({
              name: entry.name,
              type: entry.isDirectory()
                ? "directory"
                : "file"
            }))
        };
      }

    } catch (error) {
      return {
        success: false,
        type: "termux_execution_error",
        operation,
        message: error.message
      };
    }
  }

  getStatus() {
    return {
      name: this.name,
      version: this.version,
      status: this.status,
      rootDir: this.rootDir,
      allowedOperations: [
        ...this.allowedOperations
      ],
      executionEnabled: false,
      arbitraryNodeExecution: false,
      shellExecution: false,
      symlinkEscapeBlocked: true
    };
  }
}

module.exports = TermuxDeveloperTool;
