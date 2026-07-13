import { CLIENTS } from "../clients.js";
import { latestBackup, listBackupsForClient, restoreBackup } from "../backup.js";
import { withLock } from "../lock.js";

export function rollbackCommand(clientKey, opts) {
  const client = CLIENTS[clientKey];
  if (!client) {
    console.error(`Unknown client "${clientKey}". Valid: ${Object.keys(CLIENTS).join(", ")}`);
    process.exitCode = 1;
    return;
  }

  if (opts.list) {
    const backups = listBackupsForClient(clientKey);
    if (backups.length === 0) {
      console.log(`No backups found for ${client.label}.`);
      return;
    }
    backups.forEach((b) => console.log(b));
    return;
  }

  const backup = latestBackup(clientKey);
  if (!backup) {
    console.error(`No backups found for ${client.label}.`);
    process.exitCode = 1;
    return;
  }
  withLock(client.configPath, () => restoreBackup(client.configPath, backup));
  console.log(`Restored ${client.label} config from ${backup}`);
  console.log('Note: this does not update "mcp status" bookkeeping — re-run install/up/down as needed if they drift.');
}
