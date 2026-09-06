"use strict";

const catalog = require("./index");
const ToolRegistry = require("./registry");

const registry = new ToolRegistry();
registry.registerMany(catalog);

module.exports = {
  catalog,
  registry
};
