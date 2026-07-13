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
  assert.ok(Date.now() - start < 500, "stale lock should be reclaimed almost immediately");
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
    // Give the holder a moment to actually acquire the lock before we race it.
    const deadline = Date.now() + 500;
    while (!fs.existsSync(`${resource}.lock`) && Date.now() < deadline) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }

    assert.throws(() => withLock(resource, () => {}, { timeoutMs: 200 }), /Timed out waiting for lock/);
  } finally {
    holder.kill();
    cleanupTempHome(dir);
  }
});
