# Share And Auth Setup

## Shareable Package

Share the repo or the `skills/airtable-mcp` folder plus the proxy and scripts:

```text
skills/airtable-mcp/
bin/airtable-mcp-keychain-proxy.js
scripts/install-shared-skill-macos.sh
scripts/store-airtable-pat-config-file.sh
scripts/store-airtable-pat-macos.sh
scripts/smoke-test-airtable-mcp.sh
```

Do not include a PAT in the package.

## Codex macOS Setup

From the package root:

```bash
./scripts/install-shared-skill-macos.sh
./scripts/store-airtable-pat-config-file.sh
```

Add this to `~/.codex/config.toml`:

```toml
[mcp_servers.airtable]
command = "/Users/YOUR_USERNAME/.codex/bin/airtable-mcp-keychain-proxy"
enabled = true
```

Restart Codex.

## Admin-Shared PAT Handling With Config File

Send the PAT through an approved secret-sharing channel. The recipient runs `store-airtable-pat-config-file.sh`, pastes the PAT into the silent prompt, and the script stores it at:

```text
<package root>/config.json
```

The file format is:

```json
{
  "pat": "<ADMIN_SHARED_PAT>"
}
```

The script creates the file with permissions `600`. The proxy refuses to read it if it is group/world readable.

To use a custom config path:

```bash
AIRTABLE_MCP_CONFIG_FILE="$HOME/.config/airtable-mcp/config.json" \
./scripts/store-airtable-pat-config-file.sh
```

Then run the proxy with the same `AIRTABLE_MCP_CONFIG_FILE` value.

For Codex, add this env section under the Airtable MCP server entry:

```toml
[mcp_servers.airtable.env]
AIRTABLE_MCP_CONFIG_FILE = "/absolute/path/to/projects/airtable-mcp/config.json"
```

## Admin-Shared PAT Handling With Keychain

Send the PAT through an approved secret-sharing channel. The recipient runs `store-airtable-pat-macos.sh`, pastes the PAT into the silent prompt, and the script stores it in macOS Keychain under:

```text
service: codex-airtable-mcp-token
account: current macOS username
```

To use a different Keychain service/account:

```bash
AIRTABLE_MCP_KEYCHAIN_SERVICE=my-airtable-mcp-token \
AIRTABLE_MCP_KEYCHAIN_ACCOUNT="$USER" \
./scripts/store-airtable-pat-macos.sh
```

Then run the proxy with the same environment variables.

## Proxy Auth Lookup Order

1. `AIRTABLE_MCP_PAT` or `AIRTABLE_PERSONAL_ACCESS_TOKEN`
2. `AIRTABLE_MCP_CONFIG_FILE`
3. macOS Keychain service `codex-airtable-mcp-token`

## Direct Header Setup

For MCP clients that accept remote HTTP MCP URLs and custom headers:

```text
Name: airtable
Server URL: https://mcp.airtable.com/mcp
Header: Authorization: Bearer <ADMIN_SHARED_PAT>
```

Do not use plaintext headers in committed config files.

## Verification

Run:

```bash
./scripts/smoke-test-airtable-mcp.sh
```

Expected output is a list of tool names, such as `list_bases`, `list_tables_for_base`, and `list_records_for_page`.
