const { createDefaultPreset } = require("ts-jest");
const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  testMatch: ["**/tests/**/*.test.ts", "**/src/**/*.test.ts"],
  collectCoverageFrom: ["src/**/*.ts", "!src/server.ts", "!src/types/**"],
  coverageDirectory: "coverage",
};