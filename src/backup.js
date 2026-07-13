import fs from "node:fs";
import path from "node:path";
import { BACKUPS_DIR } from "./paths.js";

const MAX_BACKUPS_PER_CLIENT = 10;

function ensureBackupsDir() {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true, mode: 0o700 });
}

function listBackupFiles(clientKey) {
  ensureBackupsDir();
  return fs
    .readdirSync(BACKUPS_DIR)
    .filter((f) => f.startsWith(`${clientKey}.`) && f.endsWith(".json"))
    .sort(); // ISO-ish timestamps in the filename sort chronologically
}

// Snapshots a client's config file before mcp-cli mutates it. No-op if the
// config doesn't exist yet (nothing to protect).
export function snapshotConfig(clientKey, configPath) {
  if (!fs.existsSync(configPath)) return null;
  ensureBackupsDir();
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(BACKUPS_DIR, `${clientKey}.${ts}.json`);
  fs.copyFileSync(configPath, backupPath);
  fs.chmodSync(backupPath, 0o600);
  pruneBackups(clientKey);
  return backupPath;
}

function pruneBackups(clientKey) {
  const files = listBackupFiles(clientKey);
  const excess = files.length - MAX_BACKUPS_PER_CLIENT;
  for (let i = 0; i < excess; i++) {
    fs.unlinkSync(path.join(BACKUPS_DIR, files[i]));
  }
}

export function listBackupsForClient(clientKey) {
  return listBackupFiles(clientKey).map((f) => path.join(BACKUPS_DIR, f));
}

export function latestBackup(clientKey) {
  const files = listBackupFiles(clientKey);
  if (files.length === 0) return null;
  return path.join(BACKUPS_DIR, files[files.length - 1]);
}

export function restoreBackup(configPath, backupPath) {
  const mode = fs.existsSync(configPath) ? fs.statSync(configPath).mode & 0o777 : 0o600;
  fs.copyFileSync(backupPath, configPath);
  fs.chmodSync(configPath, mode);
}
