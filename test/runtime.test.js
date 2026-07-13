import test from "node:test";
import assert from "node:assert/strict";
import { checkRuntime, findOnPath } from "../src/runtime.js";

test("checkRuntime always passes shell built-ins without a PATH lookup", () => {
  assert.deepEqual(checkRuntime("zsh"), { ok: true });
  assert.deepEqual(checkRuntime("bash"), { ok: true });
});

test("checkRuntime finds node itself on PATH (the process running this test)", () => {
  const result = checkRuntime("node");
  assert.equal(result.ok, true);
  assert.ok(result.resolvedPath.length > 0);
});

test("checkRuntime fails with an actionable hint for a known-missing runtime", () => {
  // Regardless of whether uvx happens to be installed on the machine running
  // this test, a made-up command must fail with a generic hint.
  const result = checkRuntime("mcp-cli-definitely-not-a-real-command-xyz");
  assert.equal(result.ok, false);
  assert.match(result.hint, /not found on PATH/);
});

test("findOnPath returns null for a command that doesn't exist", () => {
  assert.equal(findOnPath("mcp-cli-definitely-not-a-real-command-xyz"), null);
});
