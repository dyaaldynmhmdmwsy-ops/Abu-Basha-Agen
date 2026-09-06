"use strict";

class BaseAdapter {
  constructor(name, metadata = {}) {
    this.name = name;
    this.metadata = metadata;
    this.status = "online";
    this.executed = 0;
  }

  async healthCheck() {
    return {
      success: true,
      type: "adapter_ready",
      connector: this.name,
      configured: this.isConfigured()
    };
  }

  isConfigured() {
    return false;
  }

  async execute() {
    return {
      success: false,
      type: "not_implemented",
      connector: this.name,
      message: `Adapter "${this.name}" لم يتم ربط التنفيذ الحقيقي بعد.`
    };
  }

  getStatus() {
    return {
      name: this.name,
      status: this.status,
      configured: this.isConfigured(),
      executed: this.executed
    };
  }
}

module.exports = BaseAdapter;
