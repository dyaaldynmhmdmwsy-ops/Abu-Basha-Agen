"use strict";

/**
 * Developer Policy v1.0.0
 *
 * مسؤول عن التحقق من خطوات التطوير البرمجي فقط.
 * لا ينفذ أوامر نظام ولا يتصل بالـConnectors.
 */

class DeveloperPolicy {
  constructor() {
    this.name = "Developer Policy";
    this.version = "1.0.0";
    this.status = "online";

    this.allowedTypes = new Set(["developer"]);
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
        message: "خطوة Developer بدون name."
      };
    }

    if (step.type !== "developer") {
      return {
        success: false,
        type: "developer_step_type_not_allowed",
        message:
          `Developer Policy تقبل خطوات من النوع developer فقط. النوع الحالي: "${step.type}".`
      };
    }

    return {
      success: true,
      type: "developer_step_allowed",
      stepName: step.name,
      stepType: step.type
    };
  }

  canExecute(step) {
    return this.validate(step);
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

module.exports = DeveloperPolicy;
