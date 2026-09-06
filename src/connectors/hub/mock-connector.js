
"use strict";

class MockConnector {
  constructor(name = "mock") {
    this.name = name;
    this.version = "1.0.0";
    this.executed = 0;
  }

  async healthCheck() {
    return {
      success: true,
      type: "healthy",
      connector: this.name
    };
  }

  async execute(payload = {}, context = {}) {
    this.executed++;

    return {
      success: true,
      type: "connector_execution",
      connector: this.name,
      simulated: true,
      payload,
      context
    };
  }
}

module.exports = MockConnector;
