# Airtable MCP Skill

Shareable Codex skill and local proxy for Airtable's hosted MCP server.

The Airtable MCP endpoint is:

```text
https://mcp.airtable.com/mcp
```

This repo intentionally does not contain an Airtable personal access token. Each user should receive the admin-approved PAT through an approved internal secret-sharing channel, then store it locally.

## Install For Codex

From this repo:

```bash
./scripts/install-shared-skill-macos.sh
./scripts/store-airtable-pat-config-file.sh
```

Then add this to `~/.codex/config.toml`, adjusting the username if needed:

```toml
[mcp_servers.airtable]
command = "/Users/YOUR_USERNAME/.codex/bin/airtable-mcp-keychain-proxy"
enabled = true
```

Restart Codex after updating the config.

## Auth Options

Recommended project-local config-file setup:

- Store the PAT in this project's `config.json` using `./scripts/store-airtable-pat-config-file.sh`.
- The file is created with permissions `600`.
- The proxy refuses to read the file if it is group/world readable.
- The file is ignored by git.

More secure macOS option:

- Store the PAT in macOS Keychain using `./scripts/store-airtable-pat-macos.sh`.
- The proxy reads it at runtime from service `codex-airtable-mcp-token`.
- The PAT is never written to the repo or Codex config.

The proxy reads auth in this order:

1. `AIRTABLE_MCP_PAT` or `AIRTABLE_PERSONAL_ACCESS_TOKEN`
2. The file pointed to by `AIRTABLE_MCP_CONFIG_FILE`
3. macOS Keychain service `codex-airtable-mcp-token`

For the project-local config file, include this in `~/.codex/config.toml`:

```toml
[mcp_servers.airtable.env]
AIRTABLE_MCP_CONFIG_FILE = "/Users/YOUR_USERNAME/path/to/projects/airtable-mcp/config.json"
```

For MCP clients that support HTTP headers directly:

```text
Server URL: https://mcp.airtable.com/mcp
Header: Authorization: Bearer <ADMIN_SHARED_PAT>
```

For clients that support OAuth, prefer OAuth when practical.

## Smoke Test

After installing the skill and storing the PAT:

```bash
./scripts/smoke-test-airtable-mcp.sh
```

The test calls `tools/list` through the local proxy and prints tool names only.

## Excel Extract Commands

Generate all current standardized Excel extracts:

```bash
./scripts/generate-excel-all.sh
```

Generate only the H2 Values workbook:

```bash
./scripts/generate-excel-h2-values.sh
```

Generate only the Retain On-Prem workbook:

```bash
./scripts/generate-excel-retain-on-prem.sh
```

Generate a detailed workbook for one H2 value:

```bash
./scripts/generate-excel-h2-detail.sh "Accelerate AI Growth and Adoption"
```

Generate only the all-H2 detailed methods/comments workbook:

```bash
./scripts/generate-excel-all-h2-details.sh
```

Generate a reporting-period update extract using the current two-sheet method extract standard:

```bash
./scripts/generate-excel-reporting-period-updates.sh "Jun 4 (June MBR)"
```

These commands generate:

- `outputs/H2 Values - Linked Top Level Methods.xlsx`
- `outputs/Retain On-Prem - Methods and Comments.xlsx`
- `outputs/<Reporting Period> Methods Sample - Requested Columns.xlsx`

Equivalent Codex prompts:

- `Generate the latest Excel extracts for CX FY26 V2MOM - NEW.`
- `Generate the latest H2 Values Excel extract.`
- `Generate the latest Retain On-Prem methods and comments Excel extract.`
- `Generate the latest Excel for "Accelerate AI Growth and Adoption".`
- `Generate the latest all-H2 values methods and comments Excel extract.`

Find methods and sub-methods for a person or owner:

```bash
./scripts/find-owner-methods.sh "Karthik Sundaram"
```

## Broader Airtable MCP Capabilities

The shell commands above cover the current standardized CX FY26 V2MOM Excel
extracts. The Airtable MCP connection supports a broader set of read and write
capabilities based on the PAT scopes and the Airtable workspace/base permissions
available to that token.

Live tool inventory confirmed through this project config:

- `ping`
- `list_bases`
- `list_workspaces`
- `search_bases`
- `list_tables_for_base`
- `get_table_schema`
- `list_records_for_table`
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
- `list_records_for_page`
- `list_pages_for_base`
- `get_record_for_page`
- `search_records`

Common supported workflows:

| Area | What it supports | Example prompt |
| --- | --- | --- |
| Workspace discovery | List accessible workspaces and bases. | `Show me all Airtable workspaces and bases I can access.` |
| Base discovery | Search bases by name or business topic. | `Find bases related to V2MOM or roadmap.` |
| Schema inspection | List tables, fields, field types, and select choices. | `Inspect the schema of CX FY26 V2MOM - NEW and summarize each table.` |
| Record reads | Read records from accessible tables. | `Show me records from the Method Top Level table with owner, status, and comments.` |
| Record search | Search records across accessible Airtable data. | `Search for methods related to AI adoption or on-prem migration.` |
| Interface/page access | Read Airtable Interface pages where base access is limited. | `List pages available in this base and show records from the relevant page.` |
| Comments | Read record comments and, where permitted, create comments. | `Show comments captured for this method with date and author where available.` |
| Record writes | Create, update, or delete records where the PAT has permission. | `Prepare a dry-run update plan for these Airtable records, but do not write anything yet.` |
| Schema changes | Create or update tables and fields where the PAT has permission. | `Draft a new field plan for tracking FIRA risk status; do not apply it yet.` |
| Base creation | Create a new base where workspace permissions allow it. | `Create a test base structure for V2MOM reporting after confirmation.` |

Additional useful prompts:

- `Show me all Airtable bases and pages I can access, grouped by workspace.`
- `Inspect the CX FY26 V2MOM - NEW base and produce a table-by-table data dictionary.`
- `Find all methods where Current Status is At Risk or Off Track, including latest commentary.`
- `Show stale methods where no update has been captured in the latest reporting period.`
- `Extract all FIRA-linked sub-methods and group them by H2 Value, status, and owner.`
- `Compare current vs previous status for all top-level methods and highlight changes.`
- `Prepare a dry-run update plan for these Airtable records, but do not write anything.`

For write operations, first confirm the exact target base, table, records, and
intended changes. Do not add, edit, or delete live Airtable data unless the user
explicitly approves the final write action.

## Excel Report Standards

All Excel reports created from this project should follow the current requested-column method extract pattern:

- Use live Airtable data as the source of truth, not generated workbook outputs, unless the user explicitly asks to inspect an output workbook.
- Default method extracts should use only the business sheets `Top-Level Methods` and `Sub-Level Methods` unless the user explicitly requests additional sheets.
- Keep the user's requested columns, including `H2 Order`, `H2 Value`, method name, reporting period, owner, status owner, current status/actual/commentary, previous status/actual/commentary, and status update date. Add `Sub-Level Method` only on the sub-level sheet when needed to identify rows.
- Use readable Title Case filenames, for example `H2 Values - Linked Top Level Methods.xlsx`.
- Use concise business titles in `Overview!A1`; do not append implementation labels such as `Human Readable`.
- Include only curated business sheets unless raw/schema/debug sheets are explicitly requested.
- Do not expose Airtable machine IDs such as record, field, user, or select-option IDs in visible workbook cells.
- Resolve Airtable lookup/link fields from `valuesByLinkedRecordId` before any fallback.
- Use MCP `cursor`/`nextCursor` pagination for `list_records_for_table`.
- Before delivery, inspect for formula errors and scan visible cells for machine IDs.
- Use 12pt font for normal cells and 14pt font for workbook titles and sheet headers.
- Word-wrap text wherever cells or columns can contain long descriptions.
- Use a dark navy header row `#1F4E78` with white bold text.
- Use H2 headline/group rows in strong blue `#245B89` with white bold text.
- Use Top-Level Method headline rows in light blue `#D9EAF7` with dark bold text.
- Use light green-blue `#EAF5F1` for current status/actual/commentary cells and light amber `#FFF4D8` for previous status/actual/commentary cells.
- Use light gray `#EEF2F6` for status update date cells.
- Use status-specific cell colors: `On Track` green, `At Risk` amber, `Off Track/Delayed` red, `Completed/Done` blue, and blank/no status gray.
- Format multi-item cells as hyphen bullets or numbered lists when a cell contains several pointers.
- Top-level method sheets must include the top-level owner column as `Method Owner Name`.
- Sub-method sheets and supporting-method owner columns must include supporting owners as `Owner - Supporting Method` wherever that Airtable field is applicable.
- Treat owner-style fields, including `Method Owner Name` and `Owner - Supporting Method`, as multi-item cells when multiple names are extracted.
- When an all-H2 detailed workbook is explicitly requested, structure `Overview` with `Report Summary` first and `H2 Value Summary` below it, ordered by H2 order.
- Do not include a separate `Latest Comments` column in detailed workbooks.
- For `Top-Level Methods`, derive `Current Status`, `Current Actual`, and `Current Commentary` from the latest top-level dated update with status/actual/commentary data.
- For `Top-Level Methods`, derive `Previous Status`, `Previous Actual`, and `Previous Commentary` from the immediately prior top-level dated update in the same dated sequence; only fall back to method-level fields when no dated updates exist.
- In `Top-Level Methods`, place previous fields directly after the current fields so current and previous status/actual/commentary can be compared side by side.
- For `Sub-Methods`, derive `Current Status`, `Current Actual`, and `Current Commentary` from the latest sub-method dated update with status/actual/commentary data.
- For `Sub-Methods`, derive `Previous Status`, `Previous Actual`, and `Previous Commentary` from the immediately prior sub-method dated update in the same dated sequence; only fall back to supporting-method fields when no dated updates exist.
- In `Sub-Methods`, include compact Feature FIRA summary columns after `Dated Update Count`: `FIRA Count`, `FIRAs`, `FIRA Feature Names`, `FIRA Latest Release Quarter Status`, `FIRA JIRA Status`, `FIRA JIRA Feature State`, `FIRA Latest Update Quarter`, `FIRA Market Access`, `FIRA CLUS Payload Items`, and `FIRA CLUS Payload Items NEW`.
- Pair FIRA-specific status/date/select values with the FIRA key inside summary cells, for example `WXCC-14031: Slipped`, so multiple FIRAs remain readable in one sub-method row.
- Do not add a separate granular `Feature FIRAs` sheet unless explicitly requested.
- Person/owner lookups must be returned as a readable markdown table with `Type`, `H2 Value`, `Method / Sub-Method`, `Current Status`, `Latest Reporting Period`, and `Latest Comment`.
- Keep workbook styling consistent: dark blue headers, hierarchy headline rows, status-colored cells, wrapped cells, frozen header rows, and fixed readable column widths.

## Security Notes

- Do not paste PATs into chat, commits, tickets, or docs.
- If a PAT is pasted into an untrusted place, rotate it in Airtable.
- Keep PAT scopes and base access as narrow as possible.
- The proxy only forwards MCP JSON-RPC messages to Airtable's hosted MCP endpoint.
