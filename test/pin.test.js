import test from "node:test";
import assert from "node:assert/strict";
import { makeTempHome, cleanupTempHome } from "./support/_helpers.js";

const homeDir = makeTempHome();
process.env.HOME = homeDir;
const { pinCommand, unpinCommand } = await import("../src/commands/pin.js");
const { recordInstall, getInstall } = await import("../src/state.js");

test.after(() => cleanupTempHome(homeDir));

test("pinCommand/unpinCommand toggle the pinned flag for an installed server", () => {
  recordInstall("memory", { targets: ["claude-code"], server: { command: "npx", args: [], env: {} }, version: "1.0.0" });

  pinCommand("memory");
  assert.equal(getInstall("memory").pinned, true);

  unpinCommand("memory");
  assert.equal(getInstall("memory").pinned, false);
});

test("pinCommand/unpinCommand exit non-zero for a server that isn't installed", () => {
  process.exitCode = undefined;
  pinCommand("never-installed");
  assert.equal(process.exitCode, 1);

  process.exitCode = undefined;
  unpinCommand("never-installed");
  assert.equal(process.exitCode, 1);

  process.exitCode = undefined; // don't leak a failing exit code into the test runner's own exit
});
