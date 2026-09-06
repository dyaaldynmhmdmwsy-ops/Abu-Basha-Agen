
"use strict";

class MockConnector {
  constructor() {
    this.name = "mock";
    this.version = "1.0.0";
    this.executed = 0;
  }

  async execute({ action, payload, context }) {
    this.executed++;

    return {
      success: true,
      type: "mock_execution",
      connector: this.name,
      simulated: true,
      action: action ? action.name : null,
      payload,
      context,
      message: "تم تنفيذ الإجراء تجريبياً عبر Mock Connector."
    };
  }
}

module.exports = MockConnector;
