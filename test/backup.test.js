import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { makeTempHome, cleanupTempHome } from "./support/_helpers.js";

const homeDir = makeTempHome();
process.env.HOME = homeDir;
const { snapshotConfig, listBackupsForClient, latestBackup, restoreBackup } = await import("../src/backup.js");

test.after(() => cleanupTempHome(homeDir));

const configPath = path.join(homeDir, "fake-client-config.json");

test("snapshotConfig is a no-op when the config doesn't exist yet", () => {
  const result = snapshotConfig("fake-client", configPath);
  assert.equal(result, null);
  assert.deepEqual(listBackupsForClient("fake-client"), []);
});

test("snapshotConfig copies the current contents and mode into a new backup file", () => {
  fs.writeFileSync(configPath, JSON.stringify({ mcpServers: { a: 1 } }));
  fs.chmodSync(configPath, 0o600);

  const backupPath = snapshotConfig("fake-client", configPath);
  assert.ok(backupPath && fs.existsSync(backupPath));
  assert.deepEqual(JSON.parse(fs.readFileSync(backupPath, "utf8")), { mcpServers: { a: 1 } });
  assert.equal(fs.statSync(backupPath).mode & 0o777, 0o600);
  assert.equal(latestBackup("fake-client"), backupPath);
});

test("snapshotConfig prunes to the 10 most recent backups per client", () => {
  for (let i = 0; i < 15; i++) {
    fs.writeFileSync(configPath, JSON.stringify({ n: i }));
    snapshotConfig("fake-client", configPath);
  }
  const backups = listBackupsForClient("fake-client");
  assert.equal(backups.length, 10);
  // the most recent snapshot should reflect the last write (n: 14)
  const latest = JSON.parse(fs.readFileSync(latestBackup("fake-client"), "utf8"));
  assert.equal(latest.n, 14);
});

test("restoreBackup copies a backup's contents back and preserves the target's mode", () => {
  fs.writeFileSync(configPath, JSON.stringify({ n: "current" }));
  fs.chmodSync(configPath, 0o644);
  const backupToRestore = latestBackup("fake-client");

  restoreBackup(configPath, backupToRestore);

  assert.deepEqual(JSON.parse(fs.readFileSync(configPath, "utf8")), { n: 14 });
  assert.equal(fs.statSync(configPath).mode & 0o777, 0o644);
});

test("backups for different clients don't interfere with each other", () => {
  const otherConfigPath = path.join(homeDir, "other-client-config.json");
  fs.writeFileSync(otherConfigPath, JSON.stringify({ other: true }));
  snapshotConfig("other-client", otherConfigPath);

  assert.equal(listBackupsForClient("other-client").length, 1);
  assert.equal(listBackupsForClient("fake-client").length, 10); // unaffected
});
