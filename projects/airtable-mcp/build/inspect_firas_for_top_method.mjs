import { spawnSync } from "node:child_process";
import path from "node:path";

const projectDir = "/Users/abbaivk/Documents/Codex Project/projects/airtable-mcp";
const proxy = "/Users/abbaivk/.codex/bin/airtable-mcp-keychain-proxy";
const env = { ...process.env, AIRTABLE_MCP_CONFIG_FILE: path.join(projectDir, "config.json") };
const baseId = "appps1eduhJZPnFHD";
const targetTopMethod = process.argv.slice(2).join(" ").trim() || "Make AI easy to start and hard to abandon";

function callTool(name, args, id = 2) {
  const messages = [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "fira-inspector", version: "0.1.0" },
      },
    },
    { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
    { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } },
  ];
  const result = spawnSync(proxy, {
    input: `${messages.map((message) => JSON.stringify(message)).join("\n")}\n`,
    env,
    encoding: "utf8",
    maxBuffer: 100 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr || `proxy exited ${result.status}`);
  const response = result.stdout
    .trim()
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .find((message) => message.id === id);
  if (response?.error) throw new Error(JSON.stringify(response.error));
  return response.result?.structuredContent || response.result;
}

const schema = callTool("list_tables_for_base", { baseId });
const tables = Object.fromEntries((schema.tables || []).map((table) => [table.name, table]));
const requiredTables = ["Method Top Level", "Supporting Methods", "Feature Firas"];
for (const table of requiredTables) {
  if (!tables[table]) throw new Error(`Missing required table: ${table}`);
}

const fieldMaps = Object.fromEntries(
  requiredTables.map((tableName) => [tableName, Object.fromEntries((tables[tableName].fields || []).map((field) => [field.name, field]))]),
);

function fieldId(tableName, fieldName) {
  return fieldMaps[tableName][fieldName]?.id;
}

function cell(record, tableName, fieldName) {
  const id = fieldId(tableName, fieldName);
  if (!id) return undefined;
  return (record.cellValuesByFieldId || record.fields || {})[id];
}

function flattenHuman(value) {
  if (value == null) return [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item) => flattenHuman(item));
  if (value.valuesByLinkedRecordId) return Object.values(value.valuesByLinkedRecordId).flatMap((items) => flattenHuman(items));
  if (value.name) return [String(value.name)];
  if (value.email) return [String(value.email)];
  return [];
}

function join(values, separator = "\n") {
  const seen = new Set();
  const out = [];
  for (const value of values.map((item) => String(item).trim()).filter(Boolean)) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out.join(separator);
}

function value(record, tableName, fieldName, separator = "\n") {
  return join(flattenHuman(cell(record, tableName, fieldName)), separator);
}

function links(record, tableName, fieldName) {
  const raw = cell(record, tableName, fieldName);
  if (!Array.isArray(raw)) return [];
  return raw.filter((item) => item && item.id).map((item) => ({ id: item.id, name: item.name || "" }));
}

function listAllRecords(tableName) {
  const table = tables[tableName];
  const fieldIds = table.fields.map((field) => field.id);
  const records = [];
  let cursor;
  do {
    const page = callTool("list_records_for_table", {
      baseId,
      tableId: table.id,
      fieldIds,
      pageSize: 100,
      ...(cursor ? { cursor } : {}),
    });
    records.push(...(page.records || []));
    cursor = page.nextCursor;
  } while (cursor);
  return records;
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function pipeSafe(value) {
  return String(value || "").replaceAll("|", "\\|").replace(/\r?\n/g, "<br>");
}

function linkedTo(record, tableName, fieldName, id) {
  return links(record, tableName, fieldName).some((link) => link.id === id);
}

function fieldValue(record, fieldName) {
  return clean(value(record, "Feature Firas", fieldName, "; "));
}

const topRecords = listAllRecords("Method Top Level");
const subRecords = listAllRecords("Supporting Methods");
const firaRecords = listAllRecords("Feature Firas");
const topRecord = topRecords.find((record) => clean(value(record, "Method Top Level", "Top Level Method")) === targetTopMethod);
if (!topRecord) throw new Error(`Top-level method not found: ${targetTopMethod}`);

const linkedSubIds = new Set(links(topRecord, "Method Top Level", "Supporting Methods").map((link) => link.id));
for (const sub of subRecords) {
  if (linkedTo(sub, "Supporting Methods", "Method Top Level", topRecord.id)) linkedSubIds.add(sub.id);
}

const subById = new Map(subRecords.map((record) => [record.id, record]));
const directTopFiraIds = new Set(links(topRecord, "Method Top Level", "Feature Firas").map((link) => link.id));
const subFiraIds = new Map();
for (const subId of linkedSubIds) {
  const sub = subById.get(subId);
  if (!sub) continue;
  subFiraIds.set(subId, new Set(links(sub, "Supporting Methods", "Feature Firas").map((link) => link.id)));
}

const rows = [];
for (const fira of firaRecords) {
  const topLinked = directTopFiraIds.has(fira.id) || linkedTo(fira, "Feature Firas", "Top Method Link", topRecord.id);
  const subLinks = links(fira, "Feature Firas", "Sub Method Link").filter((link) => linkedSubIds.has(link.id));
  const linkedSubRecords = new Map(subLinks.map((link) => [link.id, subById.get(link.id)]));
  for (const [subId, firaIds] of subFiraIds.entries()) {
    if (firaIds.has(fira.id)) linkedSubRecords.set(subId, subById.get(subId));
  }
  if (!topLinked && linkedSubRecords.size === 0) continue;

  const base = {
    featureName: fieldValue(fira, "Feature Name"),
    fira: fieldValue(fira, "FIRA"),
    clusPayloadItems: fieldValue(fira, "CLUS Payload Items"),
    clusPayloadItemsNew: fieldValue(fira, "CLUS Payload Items NEW"),
    marketAccess: fieldValue(fira, "Market Access"),
    initialQuarter: fieldValue(fira, "Initial Quarter (Q3 outset)"),
    febMberDates: fieldValue(fira, "Feb MBER Dates"),
    marMberDates: fieldValue(fira, "Mar MBER Dates"),
    aprMberDates: fieldValue(fira, "Apr MBER Dates"),
    mayMberDates: fieldValue(fira, "May MBER Dates"),
    latestReleaseQuarterStatus: fieldValue(fira, "Latest Release Quarter Status"),
    latestJiraPull: fieldValue(fira, "Latest Jira Pull"),
    jiraLatestUpdateQuarter: fieldValue(fira, "JIRA Latest Update Quarter"),
    jiraStatus: fieldValue(fira, "JIRA Status"),
    jiraExecutiveStatusNotes: fieldValue(fira, "JIRA Executive Status Notes"),
    jiraMethod: fieldValue(fira, "JIRA Method"),
    fy26MeasureAssociation: fieldValue(fira, "FY26 Measure (Value) Association"),
    methodType: fieldValue(fira, "Method Type"),
    jiraFeatureState: fieldValue(fira, "JIRA Feature State"),
  };

  if (linkedSubRecords.size === 0) {
    rows.push({ subMethod: "(Top-level only)", ...base });
  } else {
    for (const sub of linkedSubRecords.values()) {
      rows.push({ subMethod: clean(value(sub, "Supporting Methods", "Sub-Method")), ...base });
    }
  }
}

rows.sort((a, b) => a.subMethod.localeCompare(b.subMethod) || a.featureName.localeCompare(b.featureName) || a.fira.localeCompare(b.fira));

console.log(`Top-Level Method: ${targetTopMethod}`);
console.log(`Linked Sub-Methods checked: ${linkedSubIds.size}`);
console.log(`FIRA rows found: ${rows.length}`);
console.log("");
if (!rows.length) {
  console.log("No Feature Firas links or linked Feature Firas records found for this top-level method or its sub-methods.");
  process.exit(0);
}

const tableFields = [
  ["Sub-Method", "subMethod"],
  ["Feature Name", "featureName"],
  ["FIRA", "fira"],
  ["Market Access", "marketAccess"],
  ["CLUS Payload Items", "clusPayloadItems"],
  ["CLUS Payload Items NEW", "clusPayloadItemsNew"],
  ["Latest Release Quarter Status", "latestReleaseQuarterStatus"],
  ["Latest Jira Pull", "latestJiraPull"],
  ["JIRA Latest Update Quarter", "jiraLatestUpdateQuarter"],
  ["JIRA Status", "jiraStatus"],
  ["JIRA Feature State", "jiraFeatureState"],
  ["JIRA Executive Status Notes", "jiraExecutiveStatusNotes"],
  ["JIRA Method", "jiraMethod"],
  ["FY26 Measure Association", "fy26MeasureAssociation"],
  ["Method Type", "methodType"],
  ["Initial Quarter", "initialQuarter"],
  ["Feb MBER Dates", "febMberDates"],
  ["Mar MBER Dates", "marMberDates"],
  ["Apr MBER Dates", "aprMberDates"],
  ["May MBER Dates", "mayMberDates"],
];

console.log("| Sub-Method | Field | Value |");
console.log("|---|---|---|");
for (const row of rows) {
  let printedAny = false;
  for (const [fieldLabel, key] of tableFields) {
    if (fieldLabel === "Sub-Method") continue;
    const fieldValueText = row[key];
    if (!fieldValueText) continue;
    printedAny = true;
    console.log(`| ${pipeSafe(row.subMethod)} | ${pipeSafe(fieldLabel)} | ${pipeSafe(fieldValueText)} |`);
  }
  if (!printedAny) console.log(`| ${pipeSafe(row.subMethod)} | Feature Firas | Linked record has no populated readable fields |`);
}
