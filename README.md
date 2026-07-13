# mcp-cli

**Homebrew for MCP.** Install, configure, and manage Model Context Protocol
servers for your AI clients with one command — no hand-editing JSON.

```bash
mcp search github
mcp secrets set GITHUB_TOKEN=ghp_xxx
mcp install github
mcp status
```

## Install

```bash
npm install
npm link   # exposes the `mcp` command globally
```

## Commands

| Command | What it does |
|---|---|
| `mcp list` | List every MCP server in the registry (bundled + added) |
| `mcp search <query>` | Search the registry by name or description |
| `mcp secrets set <KEY>[=VALUE]` | Store a secret (prompts hidden input if no `=VALUE` given) |
| `mcp secrets list` | List stored secret keys and the active backend (never prints values) |
| `mcp secrets unset <KEY>` | Remove a stored secret |
| `mcp install <name> [--target claude-code,claude-desktop] [--dry-run]` | Check the runtime is installed, resolve secrets, write the version-pinned server into detected client config(s), remember it |
| `mcp up <name> [--dry-run]` | Re-write a previously installed server into its client config(s) |
| `mcp down <name> [--dry-run]` | Remove a server from client config(s) without forgetting it — `mcp up` restores it |
| `mcp uninstall <name>` | Remove config and forget the server entirely |
| `mcp status` | Show installed servers and whether they're active per client |
| `mcp rollback <client> [--list]` | Restore a client's config from the most recent mcp-cli backup (or list available backups) |
| `mcp registry add/list/remove <url>` | Add, list, or remove additional server registries fetched from a URL |

Supported clients today: **Claude Code** (`~/.claude.json`) and **Claude
Desktop** (`claude_desktop_config.json`). `mcp install` auto-detects which
clients are present on your machine; override with `--target`.

`--dry-run` on `install`/`up`/`down` previews exactly what would change —
target clients, the resolved (version-pinned) command, and unresolved
`${VAR}` secret placeholders — without writing anything to disk.

## Version pinning (supply-chain integrity)

Every registry entry pins an exact `package`+`version`, and `mcp install`
invokes `npx -y pkg@1.2.3` / `uvx pkg@1.2.3` — never an unpinned `@latest`.
Two people installing the same server a month apart get the *same* code,
not whatever happens to be newest on npm/PyPI at install time. The exact
resolved command (including the pinned version) is recorded in
`~/.mcp-cli/state.json` at install time, so `mcp status`/`mcp up` always
reproduce exactly what was originally installed.

(This relies on npm/uv's own registry-signature verification for the actual
bytes — pinning the version is what makes the *result* reproducible; it
doesn't add a second, separate checksum layer on top.)

## Safety: preflight checks, locking, and backups

- **Runtime preflight**: before writing anything, `mcp install` checks that
  the server's runtime (`npx`, `uvx`, `docker`, ...) is actually on `PATH`.
  If it's missing, install fails with an install hint instead of writing a
  config entry that would fail the moment the client tries to spawn it.
- **Concurrency-safe**: every read-modify-write of `state.json` or a
  client's config file is wrapped in a file lock (`<path>.lock`). Two `mcp`
  commands running at once queue up instead of racing; a lock abandoned by
  a crashed process is auto-reclaimed after 15s instead of deadlocking
  forever.
- **Automatic backups**: every time mcp-cli is about to mutate a client's
  config file, it snapshots the current contents to `~/.mcp-cli/backups/`
  first (last 10 kept per client, permissions matched to the original file).
  `mcp rollback <client>` restores the most recent snapshot.
- **Permission-preserving writes**: config files are rewritten atomically
  (write to a temp file, then rename) and keep whatever file mode they had
  before — mcp-cli will never loosen a `600` config to `644`.
- **No raw crashes**: any unexpected failure (locked keychain, malformed
  config, etc.) is caught and printed as a one-line `Error: ...` with a
  non-zero exit code, never a Node stack trace.

## How secrets work

`mcp secrets set` stores values in the OS-native secret store for your
platform — never in a plaintext file by default:

| Platform | Backend |
|---|---|
| macOS | Login **Keychain** via `security` (tested) |
| Linux | **Secret Service** via `secret-tool`/libsecret, if installed (implemented, not verified on a Linux machine) |
| Windows | Per-user **DPAPI**-encrypted file via PowerShell (implemented, not verified on a Windows machine) |
| Fallback | Local JSON file (`~/.mcp-cli/secrets.json`, mode `600`) if no OS backend is available |

mcp-cli only keeps a local index of which keys exist
(`~/.mcp-cli/secrets-index.json`, mode `600`), not their values. Run `mcp
secrets list` to see which backend is active. If an older plaintext
`secrets.json` is found once an OS backend becomes available, its values
are migrated automatically and the old file is renamed to
`secrets.json.migrated` as a backup.

Set `MCP_CLI_FORCE_SECRETS_BACKEND=file` to force the plaintext-file
fallback — useful if an OS backend is present but misbehaving, and what the
test suite uses so it never touches a real Keychain/libsecret/DPAPI store.

Registry entries reference secrets with `${VAR_NAME}` placeholders in their
`env`/`extraArgs`; `mcp install` substitutes real values in only when
writing the target client's config — the placeholder, not the value, is
what's checked into `src/registry.json`.

## Scope note on `up`/`down`/`status`

MCP servers here are `stdio` processes spawned *by the client* (Claude Code,
Claude Desktop, etc.), not long-running daemons this CLI supervises. So:

- `mcp up`/`mcp down` toggle whether a server's entry is **present in the
  client's config** — not whether a process is running right now.
- `mcp status` reports each server as `up` (present in all its target
  configs), `down` (removed from all), or `partial` (present in some).
- Restarting the client is what actually starts/stops the underlying
  process.

## Adding a server to the registry

Edit `src/registry.json`:

```json
{
  "name": "my-server",
  "description": "What it does.",
  "command": "npx",
  "package": "@scope/my-mcp-server",
  "version": "1.2.3",
  "extraArgs": ["--some-flag"],
  "env": { "MY_SERVER_TOKEN": "${MY_SERVER_TOKEN}" }
}
```

Any `${VAR_NAME}` in `env` or `extraArgs` becomes a required secret that
`mcp install` checks for before writing config. `command` + `package` +
`version` get combined into a pinned invocation (`npx -y
@scope/my-mcp-server@1.2.3 --some-flag`) by `pinnedArgs()` in
`src/registry.js`.

To add a whole external registry without editing the bundled file, host a
JSON file with an array of entries in this same shape and run `mcp registry
add <url>` — entries that collide with a bundled server name are rejected
so an external registry can never shadow a trusted built-in one.

## Testing

```bash
npm test   # node's built-in test runner, zero extra dependencies
```

The suite (`test/*.test.js`) covers atomic file writes and permission
preservation, registry loading/search/pinning/external-source merging,
secret substitution and the file-backend store, client config read/write
(including permission and unrelated-key preservation), install-state
bookkeeping, backup snapshot/prune/restore, runtime preflight checks, and
cross-process file locking (including stale-lock reclaim and genuine
timeout). Every test runs against a temp `$HOME` and forces the file-based
secrets backend, so `npm test` never touches your real config files or OS
secret store. CI (`.github/workflows/test.yml`) runs this on Linux and
macOS across Node 18/20/22 — Windows is excluded from CI because Node's
`fs.chmodSync`/`stat().mode` don't carry real POSIX permission bits there,
which is also why the Windows secret backend above is unverified.

## Roadmap

- [ ] More client targets (Cursor, VS Code, Windsurf)
- [ ] Verify the Linux and Windows secret backends on real machines
- [ ] Signed/verified registry entries (today, only the *version* is
      pinned — trust in the bytes still comes from npm/PyPI's own registry
      signing, not from mcp-cli)
- [ ] A real community-reviewed registry/tap system (`mcp registry add
      <url>` is a deliberately small first step toward this, not a
      replacement for it)

## License

MIT © [TheYashGautam](https://github.com/TheYashGautam)
