"use strict";

/**
 * Trusted Input Boundary v1.0.0
 *
 * Purpose:
 * - Treat external/user text as untrusted data.
 * - Detect common prompt-injection / instruction-confusion patterns.
 * - Fail closed on unsafe or malformed input.
 * - Never execute tools, actions, or external operations.
 * - Never grant trust to instructions embedded in untrusted text.
 */
class InjectionDefense {
  constructor() {
    this.name = "Trusted Input Boundary";
    this.version = "1.0.0";
    this.status = "online";

    this.safe = true;
    this.failClosed = true;
    this.externalExecution = false;
    this.autonomousExecution = false;
    this.executionEnabled = false;
    this.requiresApproval = true;

    this.patterns = [
      /ignore\s+(all|any|previous|prior)\s+(instructions|rules|prompts)/i,
      /disregard\s+(all|any|previous|prior)\s+(instructions|rules|prompts)/i,
      /forget\s+(all|any|previous|prior)\s+(instructions|rules|prompts)/i,
      /system\s+prompt/i,
      /developer\s+message/i,
      /developer\s+instructions?/i,
      /reveal\s+(the\s+)?system\s+prompt/i,
      /show\s+(me\s+)?(the\s+)?system\s+prompt/i,
      /override\s+(the\s+)?(system|developer|security)\s+(instructions?|rules?)/i,
      /bypass\s+(the\s+)?(security|approval|safety)\s+(gate|check|rules?)/i,
      /you\s+are\s+now\s+(a|an)\s+/i,
      /act\s+as\s+(a|an)\s+/i,
      /jailbreak/i
    ];
  }

  inspect(input) {
    if (typeof input !== "string") {
      return {
        success: false,
        type: "invalid_untrusted_input",
        safe: false,
        blocked: true,
        reason: "untrusted_input_must_be_string"
      };
    }

    if (input.length === 0) {
      return {
        success: false,
        type: "empty_untrusted_input",
        safe: false,
        blocked: true,
        reason: "empty_input"
      };
    }

    const matches = [];

    for (const pattern of this.patterns) {
      if (pattern.test(input)) {
        matches.push(pattern.source);
      }
    }

    if (matches.length > 0) {
      return {
        success: false,
        type: "prompt_injection_detected",
        safe: false,
        blocked: true,
        reason: "instruction_confusion_detected",
        matches: matches.length
      };
    }

    return {
      success: true,
      type: "trusted_input_accepted",
      safe: true,
      blocked: false,
      matches: 0
    };
  }

  buildModelInput(input) {
    const inspection = this.inspect(input);

    if (!inspection.success) {
      return {
        ...inspection,
        executionAllowed: false,
        externalExecution: false,
        autonomousExecution: false
      };
    }

    return {
      success: true,
      type: "trusted_input_boundary_pass",
      safe: true,
      blocked: false,
      executionAllowed: false,
      externalExecution: false,
      autonomousExecution: false,
      text:
        "[UNTRUSTED_USER_DATA_BEGIN]\n" +
        input +
        "\n[UNTRUSTED_USER_DATA_END]"
    };
  }

  getStatus() {
    return {
      name: this.name,
      version: this.version,
      status: this.status,
      safe: this.safe,
      failClosed: this.failClosed,
      externalExecution: this.externalExecution,
      autonomousExecution: this.autonomousExecution,
      executionEnabled: this.executionEnabled,
      requiresApproval: this.requiresApproval
    };
  }
}

module.exports = InjectionDefense;
