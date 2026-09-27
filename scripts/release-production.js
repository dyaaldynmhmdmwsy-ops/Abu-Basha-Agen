#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const androidRoot = path.join(root, "control-center", "android");
const gradlew = path.join(androidRoot, "gradlew");

function fail(code) {
  console.error("FAIL=" + code);
  process.exitCode = 1;
}

if (!fs.existsSync(gradlew)) {
  fail("ANDROID_GRADLEW_MISSING");
  return;
}

const credentialFile =
  process.env.ABU_BASHA_RELEASE_CREDENTIAL_FILE ||
  path.join(
    process.env.HOME || "",
    "abubasha",
    "release",
    "credentials.env"
  );

if (!fs.existsSync(credentialFile)) {
  fail("RELEASE_CREDENTIAL_FILE_MISSING");
  return;
}

const stat = fs.statSync(credentialFile);

if ((stat.mode & 0o077) !== 0) {
  fail("RELEASE_CREDENTIAL_FILE_PERMISSIONS_TOO_OPEN");
  return;
}

const requiredKeys = [
  "ABU_BASHA_RELEASE_KEYSTORE",
  "ABU_BASHA_RELEASE_KEY_ALIAS",
  "ABU_BASHA_RELEASE_STORE_PASSWORD",
  "ABU_BASHA_RELEASE_KEY_PASSWORD"
];

const values = {};
const credentialText = fs.readFileSync(credentialFile, "utf8");

for (const rawLine of credentialText.split(/\r?\n/)) {
  const line = rawLine.trim();

  if (!line || line.startsWith("#")) {
    continue;
  }

  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);

  if (!match) {
    fail("RELEASE_CREDENTIAL_FILE_FORMAT_INVALID");
    return;
  }

  const key = match[1];
  const value = match[2];

  if (!requiredKeys.includes(key) || !value) {
    fail("RELEASE_CREDENTIAL_FILE_INVALID");
    return;
  }

  if (Object.prototype.hasOwnProperty.call(values, key)) {
    fail("RELEASE_CREDENTIAL_FILE_DUPLICATE_KEY");
    return;
  }

  values[key] = value;
}

for (const key of requiredKeys) {
  if (!values[key]) {
    fail("RELEASE_CREDENTIAL_MISSING_" + key);
    return;
  }
}

const env = {
  ...process.env,
  ABU_BASHA_RELEASE_CREDENTIAL_FILE: credentialFile,
  ABU_BASHA_RELEASE_KEYSTORE: values.ABU_BASHA_RELEASE_KEYSTORE,
  ABU_BASHA_RELEASE_KEY_ALIAS: values.ABU_BASHA_RELEASE_KEY_ALIAS,
  ABU_BASHA_RELEASE_STORE_PASSWORD: values.ABU_BASHA_RELEASE_STORE_PASSWORD,
  ABU_BASHA_RELEASE_KEY_PASSWORD: values.ABU_BASHA_RELEASE_KEY_PASSWORD
};

const result = spawnSync(
  gradlew,
  ["--no-daemon", "assembleRelease"],
  {
    cwd: androidRoot,
    env,
    shell: false,
    stdio: "inherit"
  }
);

if (result.error) {
  fail("RELEASE_GRADLE_LAUNCH_FAILED");
  return;
}

if (result.status !== 0) {
  fail("RELEASE_BUILD_FAILED");
  return;
}

console.log("PASS=PRODUCTION_RELEASE_BUILD");
