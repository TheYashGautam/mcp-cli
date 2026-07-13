import fs from "node:fs";
import path from "node:path";

const STALE_MS = 15_000; // assume a crashed process abandoned the lock past this age
const POLL_MS = 50;

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function acquire(lockPath, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      return;
    } catch (err) {
      if (err.code !== "EEXIST") throw err;

      try {
        if (Date.now() - fs.statSync(lockPath).mtimeMs > STALE_MS) {
          fs.unlinkSync(lockPath); // steal an abandoned lock, retry immediately
          continue;
        }
      } catch {
        continue; // lock vanished between the openSync and statSync — retry
      }

      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for lock: ${lockPath} (another mcp command may be running)`);
      }
      sleepSync(POLL_MS);
    }
  }
}

function release(lockPath) {
  try {
    fs.unlinkSync(lockPath);
  } catch {
    // already gone — nothing to do
  }
}

// Runs fn() while holding an exclusive file-based lock, so two concurrent
// `mcp` invocations can't race on the same read-modify-write.
export function withLock(resourcePath, fn, { timeoutMs = 5000 } = {}) {
  const lockPath = `${resourcePath}.lock`;
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  acquire(lockPath, timeoutMs);
  try {
    return fn();
  } finally {
    release(lockPath);
  }
}
