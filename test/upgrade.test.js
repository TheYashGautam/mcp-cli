import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { makeTempHome, cleanupTempHome } from "./support/_helpers.js";

const homeDir = makeTempHome();
process.env.HOME = homeDir;
process.env.MCP_CLI_FORCE_SECRETS_BACKEND = "file";

const { upgradeOne } = await import("../src/commands/upgrade.js");
const { recordInstall, getInstall, setPinned } = await import("../src/state.js");
const { CLIENTS } = await import("../src/clients.js");
const { setSecret } = await import("../src/secrets.js");
const { findServer } = await import("../src/registry.js");

test.after(() => cleanupTempHome(homeDir));

fs.writeFileSync(CLIENTS["claude-code"].configPath, JSON.stringify({ mcpServers: {} }));
fs.mkdirSync(path.dirname(CLIENTS["claude-desktop"].configPath), { recursive: true });
fs.writeFileSync(CLIENTS["claude-desktop"].configPath, JSON.stringify({ mcpServers: {} }));

function fakeFetchReturning(version) {
  return async () => version;
}

test("upgradeOne reports not-installed for a server that was never installed", async () => {
  const result = await upgradeOne("nope", {}, { fetchLatestVersionImpl: fakeFetchReturning("1.0.0") });
  assert.equal(result.status, "not-installed");
});

test("upgradeOne skips a pinned server unless --force is passed", async () => {
  const memory = findServer("memory");
  recordInstall("memory", {
    targets: ["claude-code"],
    server: { command: memory.command, args: [], env: {} },
    version: memory.version,
    pinned: true,
  });

  const skipped = await upgradeOne("memory", {}, { fetchLatestVersionImpl: fakeFetchReturning("999.0.0") });
  assert.equal(skipped.status, "pinned");
  assert.equal(getInstall("memory").version, memory.version); // unchanged

  const forced = await upgradeOne("memory", { force: true }, { fetchLatestVersionImpl: fakeFetchReturning("999.0.0") });
  assert.equal(forced.status, "upgraded");
  assert.equal(getInstall("memory").version, "999.0.0");
  assert.equal(getInstall("memory").pinned, true, "pin survives a forced upgrade");

  setPinned("memory", false);
});

test("upgradeOne reports up-to-date when the latest version matches what's installed", async () => {
  const memory = findServer("memory");
  recordInstall("memory", {
    targets: ["claude-code"],
    server: { command: memory.command, args: [], env: {} },
    version: memory.version,
  });
  const result = await upgradeOne("memory", {}, { fetchLatestVersionImpl: fakeFetchReturning(memory.version) });
  assert.equal(result.status, "up-to-date");
});

test("upgradeOne --dry-run reports what would change without touching state or config", async () => {
  const memory = findServer("memory");
  recordInstall("memory", {
    targets: ["claude-code"],
    server: { command: memory.command, args: [], env: {} },
    version: memory.version,
  });

  const result = await upgradeOne("memory", { dryRun: true }, { fetchLatestVersionImpl: fakeFetchReturning("5.5.5") });
  assert.equal(result.status, "would-upgrade");
  assert.equal(result.to, "5.5.5");
  assert.equal(getInstall("memory").version, memory.version, "dry-run must not persist a change");
});

test("upgradeOne fails cleanly when a required secret is missing", async () => {
  recordInstall("github", {
    targets: ["claude-code"],
    server: { command: "npx", args: [], env: {} },
    version: "2025.4.8",
  });
  const result = await upgradeOne("github", {}, { fetchLatestVersionImpl: fakeFetchReturning("2026.1.1") });
  assert.equal(result.status, "error");
  assert.equal(getInstall("github").version, "2025.4.8"); // unchanged
});

test("upgradeOne rewrites the client config and bumps the recorded version when enabled", async () => {
  const memory = findServer("memory");
  recordInstall("memory", {
    targets: ["claude-code"],
    server: { command: memory.command, args: pinnedArgsFor(memory), env: {} },
    version: memory.version,
    enabled: true,
  });

  const result = await upgradeOne("memory", {}, { fetchLatestVersionImpl: fakeFetchReturning("7.7.7") });
  assert.equal(result.status, "upgraded");
  assert.equal(getInstall("memory").version, "7.7.7");

  const config = JSON.parse(fs.readFileSync(CLIENTS["claude-code"].configPath, "utf8"));
  assert.ok(config.mcpServers.memory.args.some((a) => a.includes("@7.7.7")));
});

test("upgradeOne bumps the recorded version but does NOT touch client config when the server is down", async () => {
  const memory = findServer("memory");
  recordInstall("memory", {
    targets: ["claude-code"],
    server: { command: memory.command, args: pinnedArgsFor(memory), env: {} },
    version: "7.7.7",
    enabled: false,
  });
  // Config currently reflects v7.7.7 from the previous test; simulate "down" by clearing it.
  fs.writeFileSync(CLIENTS["claude-code"].configPath, JSON.stringify({ mcpServers: {} }));

  const result = await upgradeOne("memory", {}, { fetchLatestVersionImpl: fakeFetchReturning("8.8.8") });
  assert.equal(result.status, "upgraded");
  assert.equal(getInstall("memory").version, "8.8.8");
  assert.equal(getInstall("memory").enabled, false, "upgrading a down server must not re-enable it");

  const config = JSON.parse(fs.readFileSync(CLIENTS["claude-code"].configPath, "utf8"));
  assert.equal(config.mcpServers.memory, undefined, "a down server's config must stay untouched by upgrade");
});

function pinnedArgsFor(server) {
  return server.command === "npx" ? ["-y", `${server.package}@${server.version}`] : [`${server.package}@${server.version}`];
}
