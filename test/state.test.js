import test from "node:test";
import assert from "node:assert/strict";
import { makeTempHome, cleanupTempHome } from "./support/_helpers.js";

const homeDir = makeTempHome();
process.env.HOME = homeDir;
const { recordInstall, getInstall, setEnabled, setPinned, removeInstall, listInstalled } = await import(
  "../src/state.js"
);

test.after(() => cleanupTempHome(homeDir));

test("getInstall returns null for a server that was never installed", () => {
  assert.equal(getInstall("nope"), null);
});

test("recordInstall/getInstall round-trip with enabled/pinned defaults and a recorded version", () => {
  recordInstall("memory", { targets: ["claude-code"], server: { command: "npx", args: [], env: {} }, version: "1.0.0" });
  const install = getInstall("memory");
  assert.equal(install.enabled, true);
  assert.equal(install.pinned, false);
  assert.equal(install.version, "1.0.0");
  assert.deepEqual(install.targets, ["claude-code"]);
  assert.equal(typeof install.installedAt, "string");
});

test("recordInstall accepts explicit enabled/pinned overrides (used by mcp upgrade)", () => {
  recordInstall("memory", {
    targets: ["claude-code"],
    server: { command: "npx", args: [], env: {} },
    version: "2.0.0",
    enabled: false,
    pinned: true,
  });
  const install = getInstall("memory");
  assert.equal(install.enabled, false);
  assert.equal(install.pinned, true);
  assert.equal(install.version, "2.0.0");
});

test("setEnabled toggles the enabled flag and reports whether the server was found", () => {
  assert.equal(setEnabled("memory", true), true);
  assert.equal(getInstall("memory").enabled, true);
  assert.equal(setEnabled("never-installed", false), false);
});

test("setPinned toggles the pinned flag and reports whether the server was found", () => {
  assert.equal(setPinned("memory", false), true);
  assert.equal(getInstall("memory").pinned, false);
  assert.equal(setPinned("memory", true), true);
  assert.equal(getInstall("memory").pinned, true);
  assert.equal(setPinned("never-installed", true), false);
});

test("listInstalled returns the names of every installed server", () => {
  recordInstall("everything", { targets: ["claude-code"], server: { command: "npx", args: [], env: {} }, version: "1.0.0" });
  assert.deepEqual(listInstalled().sort(), ["everything", "memory"]);
});

test("removeInstall deletes the record and reports whether it existed", () => {
  assert.equal(removeInstall("memory"), true);
  assert.equal(getInstall("memory"), null);
  assert.equal(removeInstall("memory"), false);
});
