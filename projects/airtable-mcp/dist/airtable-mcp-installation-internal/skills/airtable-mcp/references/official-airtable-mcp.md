# Official Airtable MCP Reference

Source: https://support.airtable.com/v1/docs/using-the-airtable-mcp-server

Last checked locally: 2026-06-06.

## Endpoint

```text
https://mcp.airtable.com/mcp
```

## Scopes

For broad MCP use, Airtable documents these OAuth/PAT scopes:

- `data.records:read`
- `data.records:write`
- `schema.bases:read`
- `schema.bases:write`
- `data.recordComments:read`
- `data.recordComments:write`
- `workspacesAndBases:read`
- `webhook:manage`

Use fewer scopes when the task is read-only or limited to known bases.

## Tool Names Observed

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

## Operating Notes

- Permissions mirror the Airtable user/token permissions and selected scopes.
- Read-only/commenter users can read accessible data but cannot write records.
- Workspace owners/creators can create new bases where Airtable permissions allow it.
- Enterprise allowlists can block MCP until an admin approves the relevant integration.
- Airtable MCP calls use Airtable's public API underneath and are subject to Airtable API limits.
- Record creation/update/delete requests are subject to Airtable batch limits.
- Tool names and behavior may change; run the smoke test or `tools/list` for the current server inventory.
