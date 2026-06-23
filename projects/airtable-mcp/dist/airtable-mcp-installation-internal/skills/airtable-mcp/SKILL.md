---
name: airtable-mcp
description: Install, configure, troubleshoot, and use Airtable's official hosted MCP server at https://mcp.airtable.com/mcp, including OAuth setup, admin-shared PAT authorization through secure local storage, base/table/page discovery, records, comments, schemas, and Airtable Interface access.
---

# Airtable MCP

Use Airtable's hosted MCP endpoint unless the user explicitly asks to build a custom server:

```text
https://mcp.airtable.com/mcp
```

## Auth Selection

Prefer OAuth when the MCP client supports browser authentication.

Use an admin-shared PAT only when OAuth is not practical or the organization intentionally provides a shared service token. Never store that PAT in the skill, repo, chat, or committed config.

For Codex on macOS, prefer the bundled Keychain proxy:

```toml
[mcp_servers.airtable]
command = "/Users/YOUR_USERNAME/.codex/bin/airtable-mcp-keychain-proxy"
enabled = true
```

The proxy forwards MCP JSON-RPC requests to Airtable with `Authorization: Bearer <token>`.

Auth lookup order:

1. `AIRTABLE_MCP_PAT` or `AIRTABLE_PERSONAL_ACCESS_TOKEN`
2. The file pointed to by `AIRTABLE_MCP_CONFIG_FILE`
3. macOS Keychain service `codex-airtable-mcp-token`

If using a project-local config file, create it with `scripts/store-airtable-pat-config-file.sh`, then set `AIRTABLE_MCP_CONFIG_FILE` in the MCP server env config. The proxy refuses to read that file unless it has owner-only permissions (`600`).

For clients that support HTTP headers directly:

```text
Server URL: https://mcp.airtable.com/mcp
Header: Authorization: Bearer <ADMIN_SHARED_PAT>
```

## Setup

For shareable install and token-storage commands, read `references/share-and-auth.md`.

Use `scripts/store-airtable-pat-config-file.sh` to store the PAT in a local config file. Use `scripts/store-airtable-pat-macos.sh` instead when Keychain is preferred. Both scripts prompt silently.

Use `scripts/smoke-test-airtable-mcp.sh` after install. It calls `tools/list` and prints tool names only.

## Operating Workflow

1. Discover bases with `search_bases` or `list_bases`.
2. For full base access, call `list_tables_for_base`.
3. When filtering select fields, call `get_table_schema` first and use choice IDs.
4. Read table records with `list_records_for_table` or `search_records`.
5. For interface-only bases or bases with `permissionLevel: "none"`, use `list_pages_for_base`, `list_records_for_page`, and `get_record_for_page`.
6. For writes, confirm the target base/table and summarize intended changes before creating, updating, or deleting records.

Do not guess Airtable IDs. Fetch base IDs, table IDs, field IDs, page IDs, interface IDs, and record IDs before using them.

## Data Checking

When checking or extracting Airtable data, use live sources by default: Airtable direct MCP access first, or current online sources when Airtable MCP is unavailable or the user asks for online data.

Do not use generated output workbooks, exported Excel files, cached spreadsheets, or files under `outputs/` as the source of truth for data checks unless the user explicitly asks to inspect those files or confirms that workbook output should be checked.

## Excel Extraction Standard

For Airtable Excel extractions in this project, use live Airtable data and the current requested-column method extract shape unless the user explicitly requests another workbook shape.

Default method extracts should use only the business sheets `Top-Level Methods` and `Sub-Level Methods`. Keep the user's requested columns, including `H2 Order`, `H2 Value`, method name, reporting period, owner, status owner, current status/actual/commentary, previous status/actual/commentary, and status update date. Add `Sub-Level Method` only on the sub-level sheet when needed to identify rows.

For sub-method/supporting-method rows, populate the visible `Team` column from Airtable `Supporting Methods -> Team - Supporting Method`; do not use the H2 value `Team` field for sub-method rows.

Use the project color standard for readable hierarchy:

- Main column header row: dark navy `#1F4E78` with white bold text.
- H2 headline/group rows: strong blue `#245B89` with white bold text.
- Top-Level Method headline rows: light blue `#D9EAF7` with dark bold text.
- Current status/actual/commentary cells: light green-blue `#EAF5F1`.
- Previous status/actual/commentary cells: light amber `#FFF4D8`.
- Status update date cells: light gray `#EEF2F6`.
- Status cells: `On Track` green, `At Risk` amber, `Off Track/Delayed` red, `Completed/Done` blue, blank/no status gray.

## Common Tools

- `ping`
- `list_bases`
- `list_workspaces`
- `search_bases`
- `list_tables_for_base`
- `get_table_schema`
- `list_records_for_table`
- `search_records`
- `list_record_comments`
- `create_record_comment`
- `create_records_for_table`
- `update_records_for_table`
- `delete_records_for_table`
- `create_base`
- `create_table`
- `update_table`
- `create_field`
- `update_field`
- `list_pages_for_base`
- `list_records_for_page`
- `get_record_for_page`

## References

Read `references/official-airtable-mcp.md` when exact scopes, tools, limitations, or official setup notes are needed.

Read `references/share-and-auth.md` when helping another user install the skill or configure the admin-shared PAT.
