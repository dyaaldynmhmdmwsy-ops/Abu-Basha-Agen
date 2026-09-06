"use strict";

const BaseAdapter = require("./base-adapter");

class ApiAdapter extends BaseAdapter {
  constructor(name, metadata = {}) {
    super(name, metadata);
    this.envKey = metadata.envKey || null;
  }

  isConfigured() {
    if (!this.envKey) return true;
    return Boolean(process.env[this.envKey]);
  }

  async execute(payload = {}, context = {}) {
    if (!this.isConfigured()) {
      return {
        success: false,
        type: "connector_not_configured",
        connector: this.name,
        envKey: this.envKey,
        message: `المنصة "${this.name}" غير مهيأة بعد.`
      };
    }

    this.executed++;

    return {
      success: true,
      type: "adapter_ready_for_execution",
      connector: this.name,
      simulated: true,
      payload,
      context
    };
  }
}

module.exports = ApiAdapter;
