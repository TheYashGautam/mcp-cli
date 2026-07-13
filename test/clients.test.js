import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { makeTempHome, cleanupTempHome } from "./support/_helpers.js";

const homeDir = makeTempHome();
process.env.HOME = homeDir;
const { CLIENTS, writeServer, removeServer, isServerActive, isClientPresent, detectAvailableClients } = await import(
  "../src/clients.js"
);

test.after(() => cleanupTempHome(homeDir));

function seedConfigs() {
  fs.writeFileSync(CLIENTS["claude-code"].configPath, JSON.stringify({ projects: {}, mcpServers: {} }));
  fs.chmodSync(CLIENTS["claude-code"].configPath, 0o600);
  fs.mkdirSync(path.dirname(CLIENTS["claude-desktop"].configPath), { recursive: true });
  fs.writeFileSync(
    CLIENTS["claude-desktop"].configPath,
    JSON.stringify({ mcpServers: { existing: { command: "echo", args: ["hi"] } }, keepMe: "yes" })
  );
  fs.chmodSync(CLIENTS["claude-desktop"].configPath, 0o600);
}
seedConfigs();

test("writeServer adds a claude-code entry with type:stdio, preserving unrelated keys", () => {
  writeServer("claude-code", "demo", { command: "npx", args: ["-y", "demo-pkg"], env: {} });
  const config = JSON.parse(fs.readFileSync(CLIENTS["claude-code"].configPath, "utf8"));
  assert.deepEqual(config.mcpServers.demo, { type: "stdio", command: "npx", args: ["-y", "demo-pkg"], env: {} });
  assert.deepEqual(config.projects, {});
});

test("writeServer for claude-desktop omits type:stdio and preserves existing servers/keys", () => {
  writeServer("claude-desktop", "demo", { command: "npx", args: ["-y", "demo-pkg"], env: {} });
  const config = JSON.parse(fs.readFileSync(CLIENTS["claude-desktop"].configPath, "utf8"));
  assert.deepEqual(config.mcpServers.demo, { command: "npx", args: ["-y", "demo-pkg"], env: {} });
  assert.deepEqual(config.mcpServers.existing, { command: "echo", args: ["hi"] });
  assert.equal(config.keepMe, "yes");
});

test("writeServer preserves the config file's existing permission mode", () => {
  assert.equal(fs.statSync(CLIENTS["claude-code"].configPath).mode & 0o777, 0o600);
  assert.equal(fs.statSync(CLIENTS["claude-desktop"].configPath).mode & 0o777, 0o600);
});

test("isServerActive reflects presence in the config", () => {
  assert.equal(isServerActive("claude-code", "demo"), true);
  assert.equal(isServerActive("claude-code", "not-installed"), false);
});

test("removeServer removes only the targeted entry and reports whether it existed", () => {
  const removed = removeServer("claude-desktop", "demo");
  assert.equal(removed, true);
  const config = JSON.parse(fs.readFileSync(CLIENTS["claude-desktop"].configPath, "utf8"));
  assert.equal(config.mcpServers.demo, undefined);
  assert.deepEqual(config.mcpServers.existing, { command: "echo", args: ["hi"] });

  assert.equal(removeServer("claude-desktop", "demo"), false); // already gone
});

test("isClientPresent/detectAvailableClients reflect which config files exist", () => {
  assert.equal(isClientPresent("claude-code"), true);
  assert.equal(isClientPresent("claude-desktop"), true);
  assert.equal(isClientPresent("bogus-client"), false);
  assert.deepEqual(detectAvailableClients().sort(), ["claude-code", "claude-desktop"]);
});
