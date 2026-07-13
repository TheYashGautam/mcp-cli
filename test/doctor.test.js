import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { makeTempHome, cleanupTempHome } from "./support/_helpers.js";

const homeDir = makeTempHome();
process.env.HOME = homeDir;
process.env.MCP_CLI_FORCE_SECRETS_BACKEND = "file";

const { doctorCommand } = await import("../src/commands/doctor.js");
const { CLIENTS } = await import("../src/clients.js");
const { STATE_FILE } = await import("../src/paths.js");

test.after(() => cleanupTempHome(homeDir));

function captureConsole(fn) {
  const lines = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...args) => lines.push(args.join(" "));
  console.error = (...args) => lines.push(args.join(" "));
  try {
    fn();
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
  return lines.join("\n");
}

test("doctorCommand reports ok for a well-formed, correctly-permissioned config", () => {
  fs.writeFileSync(CLIENTS["claude-code"].configPath, JSON.stringify({ mcpServers: {} }));
  fs.chmodSync(CLIENTS["claude-code"].configPath, 0o600);

  process.exitCode = undefined;
  const output = captureConsole(() => doctorCommand());
  assert.match(output, /Claude Code config is valid JSON with safe permissions/);
  assert.equal(process.exitCode, undefined);
  process.exitCode = undefined;
});

test("doctorCommand flags a config file with group/other-readable permissions", () => {
  fs.chmodSync(CLIENTS["claude-code"].configPath, 0o644);
  const output = captureConsole(() => doctorCommand());
  assert.match(output, /readable by group\/others/);
  fs.chmodSync(CLIENTS["claude-code"].configPath, 0o600);
  process.exitCode = undefined;
});

test("doctorCommand reports an error for malformed JSON in a client config", () => {
  fs.writeFileSync(CLIENTS["claude-code"].configPath, "{ not valid json");
  process.exitCode = undefined;
  const output = captureConsole(() => doctorCommand());
  assert.match(output, /is not valid JSON/);
  assert.equal(process.exitCode, 1);
  process.exitCode = undefined;
  fs.writeFileSync(CLIENTS["claude-code"].configPath, JSON.stringify({ mcpServers: {} }));
  fs.chmodSync(CLIENTS["claude-code"].configPath, 0o600);
});

test("doctorCommand flags a stale lock file", () => {
  const lockPath = `${STATE_FILE}.lock`;
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, "12345");
  const output = captureConsole(() => doctorCommand());
  assert.match(output, /Found a lock file/);
  fs.unlinkSync(lockPath);
  process.exitCode = undefined;
});

test("doctorCommand reports when a client's app-support dir doesn't exist", () => {
  // claude-desktop's config was never created in this sandbox's Library dir
  const output = captureConsole(() => doctorCommand());
  assert.match(output, /Claude Desktop: not installed on this machine/);
  process.exitCode = undefined;
});
