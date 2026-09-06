"use strict";

/**
 * Step Policy v1.1.0
 *
 * مسؤول عن التحقق من نوع الخطوة قبل تفويضها.
 *
 * execution -> Execution Executor
 * control   -> Control Executor
 * developer -> Developer Executor
 */

class StepPolicy {
  constructor() {
    this.name = "Step Policy";
    this.version = "1.1.0";
    this.status = "online";

    this.allowedTypes = new Set([
      "execution",
      "control",
      "developer"
    ]);
  }

  validate(step) {
    if (!step) {
      return {
        success: false,
        type: "invalid_step",
        message: "الخطوة غير موجودة."
      };
    }

    if (!step.name) {
      return {
        success: false,
        type: "invalid_step_name",
        message: "الخطوة بدون name."
      };
    }

    if (!step.type) {
      return {
        success: false,
        type: "step_type_missing",
        message: `الخطوة "${step.name}" بدون type.`
      };
    }

    if (!this.allowedTypes.has(step.type)) {
      return {
        success: false,
        type: "step_type_not_allowed",
        message:
          `نوع الخطوة "${step.type}" غير مسموح به في Step Policy.`
      };
    }

    return {
      success: true,
      type: "step_allowed",
      stepName: step.name,
      stepType: step.type
    };
  }

  canExecute(step) {
    const result = this.validate(step);

    if (!result.success) {
      return result;
    }

    let executor;

    if (step.type === "execution") {
      executor = "Execution Executor";
    } else if (step.type === "control") {
      executor = "Control Executor";
    } else if (step.type === "developer") {
      executor = "Developer Executor";
    }

    return {
      ...result,
      executor
    };
  }

  getStatus() {
    return {
      name: this.name,
      version: this.version,
      status: this.status,
      allowedTypes: [...this.allowedTypes]
    };
  }
}

module.exports = StepPolicy;
