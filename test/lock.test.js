import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { withLock } from "../src/lock.js";
import { makeTempHome, cleanupTempHome } from "./support/_helpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const lockModulePath = path.join(__dirname, "..", "src", "lock.js");

test("withLock runs fn and returns its value", () => {
  const dir = makeTempHome();
  const resource = path.join(dir, "resource.json");
  const result = withLock(resource, () => 42);
  assert.equal(result, 42);
  cleanupTempHome(dir);
});

test("withLock releases the lock file after fn completes", () => {
  const dir = makeTempHome();
  const resource = path.join(dir, "resource.json");
  withLock(resource, () => {});
  assert.equal(fs.existsSync(`${resource}.lock`), false);
  cleanupTempHome(dir);
});

test("withLock releases the lock even if fn throws", () => {
  const dir = makeTempHome();
  const resource = path.join(dir, "resource.json");
  assert.throws(() => withLock(resource, () => { throw new Error("boom"); }));
  assert.equal(fs.existsSync(`${resource}.lock`), false);
  cleanupTempHome(dir);
});

test("withLock reclaims a stale lock left by a crashed process", () => {
  const dir = makeTempHome();
  const resource = path.join(dir, "resource.json");
  fs.writeFileSync(`${resource}.lock`, "99999");
  const old = Date.now() / 1000 - 30; // older than the 15s staleness threshold
  fs.utimesSync(`${resource}.lock`, old, old);

  const start = Date.now();
  withLock(resource, () => {});
  // Generous margin for a loaded CI runner — the point is confirming it
  // didn't wait through the full default 5000ms acquire timeout, not
  // pinning down an exact fast duration.
  assert.ok(Date.now() - start < 2000, "stale lock should be reclaimed quickly, not after waiting out the timeout");
  cleanupTempHome(dir);
});

test("withLock times out with a clear error when another process genuinely holds the lock", () => {
  const dir = makeTempHome();
  const resource = path.join(dir, "resource.json");

  // Hold the lock in a real child process so this is a genuine cross-process race.
  const holder = spawn(
    process.execPath,
    [
      "-e",
      `
      import("${lockModulePath.replace(/\\/g, "\\\\")}").then(({ withLock }) => {
        withLock(${JSON.stringify(resource)}, () => {
          const until = Date.now() + 1000;
          while (Date.now() < until) {}
        });
      });
      `,
    ],
    { stdio: "ignore" }
  );

  try {
    // Wait for the holder to actually acquire the lock before we race it.
    // Spawning a node process + dynamic ESM import can be slow on a loaded
    // CI runner, so this budget is generous — the moment the lock file
    // appears, the holder just acquired it and will keep it for another
    // ~1000ms regardless of how long spawning took, so there's no rush.
    const deadline = Date.now() + 10_000;
    while (!fs.existsSync(`${resource}.lock`) && Date.now() < deadline) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
    assert.ok(fs.existsSync(`${resource}.lock`), "holder process never acquired the lock — can't test contention");

    assert.throws(() => withLock(resource, () => {}, { timeoutMs: 200 }), /Timed out waiting for lock/);
  } finally {
    holder.kill();
    cleanupTempHome(dir);
  }
});
