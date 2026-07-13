import test from "node:test";
import assert from "node:assert/strict";
import { makeTempHome, cleanupTempHome } from "./support/_helpers.js";

// Force the file backend so this test never touches a real OS secret store
// (Keychain / libsecret / DPAPI) regardless of which platform CI runs on.
const homeDir = makeTempHome();
process.env.HOME = homeDir;
process.env.MCP_CLI_FORCE_SECRETS_BACKEND = "file";
const secrets = await import("../src/secrets.js");

test.after(() => cleanupTempHome(homeDir));

test("substitute replaces ${VAR} with the matching secret value", () => {
  assert.equal(secrets.substitute("prefix-${FOO}-suffix", { FOO: "bar" }), "prefix-bar-suffix");
  assert.equal(secrets.substitute("no placeholders here", {}), "no placeholders here");
  assert.equal(secrets.substitute(42, {}), 42); // non-strings pass through untouched
});

test("substitute throws a helpful error for a missing variable", () => {
  assert.throws(() => secrets.substitute("${MISSING_VAR}", {}), /MISSING_VAR/);
});

test("substituteAll maps substitute over every value in an object", () => {
  const result = secrets.substituteAll({ a: "${X}", b: "literal" }, { X: "resolved" });
  assert.deepEqual(result, { a: "resolved", b: "literal" });
});

test("secretsBackend reports the file backend when forced", () => {
  assert.match(secrets.secretsBackend(), /local file/);
});

test("setSecret/loadSecrets/unsetSecret round-trip through the file backend", () => {
  assert.deepEqual(secrets.loadSecrets(), {});
  secrets.setSecret("MY_TOKEN", "abc123");
  assert.deepEqual(secrets.loadSecrets(), { MY_TOKEN: "abc123" });
  assert.deepEqual(secrets.listSecretKeys(), ["MY_TOKEN"]);

  const existed = secrets.unsetSecret("MY_TOKEN");
  assert.equal(existed, true);
  assert.deepEqual(secrets.loadSecrets(), {});
  assert.equal(secrets.unsetSecret("MY_TOKEN"), false);
});

test("setSecret overwrites an existing key rather than duplicating it", () => {
  secrets.setSecret("DUP", "first");
  secrets.setSecret("DUP", "second");
  assert.deepEqual(secrets.loadSecrets(), { DUP: "second" });
  secrets.unsetSecret("DUP");
});
