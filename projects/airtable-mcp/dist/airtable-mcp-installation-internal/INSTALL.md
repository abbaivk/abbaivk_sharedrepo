# Airtable MCP Internal Installation

This package installs the shared Codex skill and local proxy for Airtable's hosted MCP server:

```text
https://mcp.airtable.com/mcp
```

No Airtable personal access token is included in this package. Get the approved token through the team's internal secret-sharing process, then store it locally with one of the scripts below.

## Prerequisites

- macOS
- Codex configured with `~/.codex/config.toml`
- Node.js available on `PATH`
- `jq` for the smoke test
- Airtable PAT with approved scopes and base access

## Quick Install

From the unzipped package root:

```bash
./scripts/install-shared-skill-macos.sh
./scripts/store-airtable-pat-config-file.sh
```

Add the config printed by the installer to:

```text
~/.codex/config.toml
```

The config should look like this, with paths adjusted for your machine:

```toml
[mcp_servers.airtable]
command = "/Users/YOUR_USERNAME/.codex/bin/airtable-mcp-keychain-proxy"
enabled = true

[mcp_servers.airtable.env]
AIRTABLE_MCP_CONFIG_FILE = "/absolute/path/to/projects/airtable-mcp/config.json"
```

Restart Codex after updating `config.toml`.

## Keychain Option

If you prefer macOS Keychain storage:

```bash
./scripts/install-shared-skill-macos.sh
./scripts/store-airtable-pat-macos.sh
```

Then add only the MCP server command block to `~/.codex/config.toml`:

```toml
[mcp_servers.airtable]
command = "/Users/YOUR_USERNAME/.codex/bin/airtable-mcp-keychain-proxy"
enabled = true
```

## Verify

After restarting Codex, or any time after installing the proxy and token:

```bash
./scripts/smoke-test-airtable-mcp.sh
```

Expected output is a list of Airtable MCP tool names, such as `list_bases`, `list_tables_for_base`, and `list_records_for_page`.

## Security

- Do not paste Airtable PATs into chat, tickets, commits, or docs.
- Do not share a generated `config.json` file.
- Keep `config.json` permissions at `600`; the proxy refuses to read it otherwise.
- Rotate the PAT in Airtable if it is exposed.
