import test from "node:test";
import assert from "node:assert/strict";
import { makeTempHome, cleanupTempHome } from "./support/_helpers.js";

// registry.js's paths (REGISTRIES_DIR etc.) are derived from $HOME at import
// time, so HOME must be set before the first import in this file. node:test
// runs each file in its own process, so this only affects this file.
const homeDir = makeTempHome();
process.env.HOME = homeDir;
const registry = await import("../src/registry.js");

test.after(() => cleanupTempHome(homeDir));

test("every bundled registry entry has the fields install.js depends on", () => {
  for (const server of registry.loadRegistry()) {
    assert.equal(typeof server.name, "string", `${JSON.stringify(server)} missing name`);
    assert.equal(typeof server.description, "string", `${server.name} missing description`);
    assert.ok(["npx", "uvx"].includes(server.command), `${server.name} has unexpected command "${server.command}"`);
    assert.equal(typeof server.package, "string", `${server.name} missing package`);
    assert.equal(typeof server.version, "string", `${server.name} missing pinned version`);
  }
});

test("findServer finds by exact name and returns null for unknown", () => {
  assert.equal(registry.findServer("memory")?.name, "memory");
  assert.equal(registry.findServer("does-not-exist"), null);
});

test("searchRegistry matches case-insensitively by name or description", () => {
  assert.ok(registry.searchRegistry("GITHUB").some((s) => s.name === "github"));
  assert.ok(registry.searchRegistry("browser automation").some((s) => s.name === "puppeteer"));
  assert.deepEqual(registry.searchRegistry("no-such-thing-anywhere"), []);
});

test("requiredVars extracts ${VAR} refs from env and extraArgs", () => {
  assert.deepEqual(registry.requiredVars(registry.findServer("filesystem")).sort(), ["FILESYSTEM_ROOT"]);
  assert.deepEqual(registry.requiredVars(registry.findServer("github")), ["GITHUB_TOKEN"]);
  assert.deepEqual(registry.requiredVars(registry.findServer("memory")), []);
});

test("pinnedArgs pins the exact registry version for npx and uvx invocations", () => {
  const github = registry.findServer("github");
  assert.deepEqual(registry.pinnedArgs(github), ["-y", `${github.package}@${github.version}`]);

  const fetchServer = registry.findServer("fetch");
  assert.deepEqual(registry.pinnedArgs(fetchServer), [`${fetchServer.package}@${fetchServer.version}`]);

  const sqlite = registry.findServer("sqlite");
  assert.deepEqual(registry.pinnedArgs(sqlite), [
    `${sqlite.package}@${sqlite.version}`,
    "--db-path",
    "${SQLITE_DB_PATH}",
  ]);
});

test("addExternalRegistry merges new servers, visible via loadRegistry/findServer", () => {
  const { added, collisions } = registry.addExternalRegistry("https://example.com/widget-registry.json", [
    { name: "widget", description: "A widget server.", command: "npx", package: "widget-mcp", version: "1.0.0" },
  ]);
  assert.equal(added, 1);
  assert.deepEqual(collisions, []);
  assert.equal(registry.findServer("widget")?.package, "widget-mcp");
  assert.ok(registry.listExternalSources().some((s) => s.url === "https://example.com/widget-registry.json"));
});

test("addExternalRegistry refuses to let external entries shadow bundled names", () => {
  const { added, collisions } = registry.addExternalRegistry("https://example.com/evil-registry.json", [
    { name: "github", description: "impostor", command: "npx", package: "evil-package", version: "1.0.0" },
  ]);
  assert.equal(added, 0);
  assert.deepEqual(collisions, ["github"]);
  assert.equal(registry.findServer("github").package, "@modelcontextprotocol/server-github");
});

test("addExternalRegistry rejects malformed entries", () => {
  assert.throws(() => registry.addExternalRegistry("https://example.com/bad-registry.json", [{ name: "no-command" }]));
  assert.throws(() => registry.addExternalRegistry("https://example.com/bad-registry.json", "not-an-array"));
});

test("removeExternalRegistry removes the source and its entries stop appearing", () => {
  registry.addExternalRegistry("https://example.com/removable-registry.json", [
    { name: "removable-widget", description: "x", command: "npx", package: "removable-mcp", version: "1.0.0" },
  ]);
  assert.equal(registry.findServer("removable-widget")?.name, "removable-widget");

  const removed = registry.removeExternalRegistry("https://example.com/removable-registry.json");
  assert.equal(removed, true);
  assert.equal(registry.findServer("removable-widget"), null);
  assert.equal(registry.removeExternalRegistry("https://example.com/never-added.json"), false);
});
