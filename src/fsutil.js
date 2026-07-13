import fs from "node:fs";
import path from "node:path";

export function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw new Error(`Failed to read/parse ${filePath}: ${err.message}`);
  }
}

export function writeJsonAtomic(filePath, data, { mode } = {}) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  // Preserve an existing file's permissions unless a mode is explicitly
  // requested — don't silently loosen a config file that was 600.
  let resolvedMode = mode;
  if (!resolvedMode) {
    try {
      resolvedMode = fs.statSync(filePath).mode & 0o777;
    } catch {
      resolvedMode = 0o644;
    }
  }

  const tmpPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`);
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + "\n", { mode: resolvedMode });
  fs.renameSync(tmpPath, filePath);
  fs.chmodSync(filePath, resolvedMode);
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}
