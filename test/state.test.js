import test from "node:test";
import assert from "node:assert/strict";
import { makeTempHome, cleanupTempHome } from "./support/_helpers.js";

const homeDir = makeTempHome();
process.env.HOME = homeDir;
const { recordInstall, getInstall, setEnabled, removeInstall } = await import("../src/state.js");

test.after(() => cleanupTempHome(homeDir));

test("getInstall returns null for a server that was never installed", () => {
  assert.equal(getInstall("nope"), null);
});

test("recordInstall/getInstall round-trip with enabled defaulting to true", () => {
  recordInstall("memory", { targets: ["claude-code"], server: { command: "npx", args: [], env: {} } });
  const install = getInstall("memory");
  assert.equal(install.enabled, true);
  assert.deepEqual(install.targets, ["claude-code"]);
  assert.equal(typeof install.installedAt, "string");
});

test("setEnabled toggles the enabled flag and reports whether the server was found", () => {
  assert.equal(setEnabled("memory", false), true);
  assert.equal(getInstall("memory").enabled, false);
  assert.equal(setEnabled("memory", true), true);
  assert.equal(getInstall("memory").enabled, true);
  assert.equal(setEnabled("never-installed", false), false);
});

test("removeInstall deletes the record and reports whether it existed", () => {
  assert.equal(removeInstall("memory"), true);
  assert.equal(getInstall("memory"), null);
  assert.equal(removeInstall("memory"), false);
});
