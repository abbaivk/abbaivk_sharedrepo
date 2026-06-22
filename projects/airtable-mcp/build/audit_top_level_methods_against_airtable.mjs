import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";

const projectDir = "/Users/abbaivk/Documents/Codex Project/projects/airtable-mcp";
const proxy = "/Users/abbaivk/.codex/bin/airtable-mcp-keychain-proxy";
const env = { ...process.env, AIRTABLE_MCP_CONFIG_FILE: path.join(projectDir, "config.json") };
const baseId = "appps1eduhJZPnFHD";
const targetValue = (process.env.H2_VALUE || process.argv.slice(2).join(" ").trim() || "Accelerate AI Growth and Adoption").trim();
const workbookPath = path.join(projectDir, "outputs", `${targetValue} - Methods and Comments.xlsx`);

function callTool(name, args, id = 2) {
  const messages = [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "top-level-audit", version: "0.1.0" },
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
const requiredTables = ["CX FY26 H2 Values", "Method Top Level", "TL Update Table"];
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

function cleanReportText(value) {
  return String(value)
    .replaceAll("```", "")
    .replaceAll("\\#", "#")
    .replace(/@\[(?:rec|fld|usr|sel)[A-Za-z0-9]{14,}\]\s*/g, "")
    .replace(/\b(?:rec|fld|usr|sel)[A-Za-z0-9]{14,}\b/g, "")
    .trim();
}

function isListLine(line) {
  return /^\s*(?:[-*]\s+|\d+[.)]\s+)/.test(line);
}

function formatCellValue(value) {
  if (typeof value !== "string") return String(value ?? "");
  const cleaned = cleanReportText(value);
  const lines = cleaned
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length <= 1) return cleaned;
  if (lines.every(isListLine)) return lines.join("\n");
  return lines.map((line) => (isListLine(line) ? line : `- ${line}`)).join("\n");
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

function links(record, tableName, fieldName) {
  const raw = cell(record, tableName, fieldName);
  if (!Array.isArray(raw)) return [];
  return raw.filter((item) => item && item.id).map((item) => ({ id: item.id, name: item.name || "" }));
}

function updateLinkedTo(record, tableName, fieldName, id) {
  return links(record, tableName, fieldName).some((link) => link.id === id);
}

function sortTime(record, tableName) {
  const parsed = Date.parse(value(record, tableName, "Update Date and Time"));
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function sortedUpdates(updates, tableName) {
  return updates
    .map((update, index) => ({ update, index }))
    .sort((a, b) => sortTime(a.update, tableName) - sortTime(b.update, tableName) || a.index - b.index)
    .map(({ update }) => update);
}

function hasTlUpdateData(update) {
  return ["Current Status", "Current Actual", "Current Commentary"].some((fieldName) =>
    cleanReportText(value(update, "TL Update Table", fieldName, "; ")),
  );
}

function hasTlUpdateCommentary(update) {
  return Boolean(cleanReportText(value(update, "TL Update Table", "Current Commentary")));
}

function snapshotFromUpdate(update) {
  return {
    "Current Status": value(update, "TL Update Table", "Current Status", "; "),
    "Current Actual": value(update, "TL Update Table", "Current Actual"),
    "Current Commentary": value(update, "TL Update Table", "Current Commentary"),
    "Status Update Date": formatDate(value(update, "TL Update Table", "Update Date and Time")),
    "Reporting Period": value(update, "TL Update Table", "Reporting Period", "; "),
  };
}

function latestByDateSource(updates, record) {
  const sorted = sortedUpdates(updates, "TL Update Table");
  let currentIndex = -1;
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    if (hasTlUpdateData(sorted[index])) {
      currentIndex = index;
      break;
    }
  }
  if (currentIndex === -1) return methodSource(record);
  const current = snapshotFromUpdate(sorted[currentIndex]);
  let previous = {};
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    if (hasTlUpdateData(sorted[index])) {
      previous = snapshotFromUpdate(sorted[index]);
      break;
    }
  }
  return {
    ...current,
    "Previous Status": previous["Current Status"] || "",
    "Previous Actual": previous["Current Actual"] || "",
    "Previous Commentary": previous["Current Commentary"] || "",
  };
}

function latestWithCommentarySource(updates, record) {
  const sorted = sortedUpdates(updates, "TL Update Table");
  let currentIndex = -1;
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    if (hasTlUpdateCommentary(sorted[index])) {
      currentIndex = index;
      break;
    }
  }
  if (currentIndex === -1) return latestByDateSource(updates, record);
  const current = snapshotFromUpdate(sorted[currentIndex]);
  let previous = {};
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    if (hasTlUpdateData(sorted[index])) {
      previous = snapshotFromUpdate(sorted[index]);
      break;
    }
  }
  return {
    ...current,
    "Previous Status": previous["Current Status"] || "",
    "Previous Actual": previous["Current Actual"] || "",
    "Previous Commentary": previous["Current Commentary"] || "",
  };
}

function methodSource(record) {
  return {
    "Current Status": value(record, "Method Top Level", "Current Status", "; "),
    "Current Actual": value(record, "Method Top Level", "Current Actual"),
    "Current Commentary": value(record, "Method Top Level", "Current Commentary"),
    "Previous Status": value(record, "Method Top Level", "Previous Status", "; "),
    "Previous Actual": value(record, "Method Top Level", "Previous Actual"),
    "Previous Commentary": value(record, "Method Top Level", "Previous Commentary"),
    "Status Update Date": formatDate(value(record, "Method Top Level", "Status Update Date")),
    "Reporting Period": value(record, "Method Top Level", "Reporting Period", "; "),
  };
}

function formatDate(input) {
  if (!input) return "";
  const parsed = Date.parse(input);
  if (!Number.isFinite(parsed)) return String(input);
  return new Date(parsed).toISOString().replace("T", " ").slice(0, 16);
}

function unzipText(entry) {
  return execFileSync("unzip", ["-p", workbookPath, entry], { encoding: "utf8", maxBuffer: 100 * 1024 * 1024 });
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function columnIndex(cellRef) {
  const letters = String(cellRef).match(/^[A-Z]+/)?.[0] || "";
  return [...letters].reduce((num, char) => num * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function sharedStrings() {
  try {
    const xml = unzipText("xl/sharedStrings.xml");
    return [...xml.matchAll(/<[^:>]*:?si\b[^>]*>([\s\S]*?)<\/[^:>]*:?si>/g)].map((match) => {
      const texts = [...match[1].matchAll(/<[^:>]*:?t\b[^>]*>([\s\S]*?)<\/[^:>]*:?t>/g)].map((textMatch) => decodeXml(textMatch[1]));
      return texts.join("");
    });
  } catch {
    return [];
  }
}

const shared = sharedStrings();

function sheetTargetsByName() {
  const workbook = unzipText("xl/workbook.xml");
  const rels = unzipText("xl/_rels/workbook.xml.rels");
  const relById = {};
  for (const match of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = match[1].match(/\bId="([^"]+)"/)?.[1];
    const target = match[1].match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) relById[id] = target;
  }
  const out = {};
  for (const match of workbook.matchAll(/<[^:>]*:?sheet\b([^>]*)\/?>/g)) {
    const name = decodeXml(match[1].match(/\bname="([^"]+)"/)?.[1] || "");
    const relationshipId = match[1].match(/\b(?:r:)?id="([^"]+)"/)?.[1];
    const target = relById[relationshipId];
    if (!target) continue;
    if (target.startsWith("/")) out[name] = target.slice(1);
    else if (target.startsWith("xl/")) out[name] = target;
    else out[name] = path.posix.join("xl", target);
  }
  return out;
}

function cellValue(cellXml) {
  const type = cellXml.match(/\bt="([^"]+)"/)?.[1];
  if (type === "inlineStr") {
    return [...cellXml.matchAll(/<[^:>]*:?t\b[^>]*>([\s\S]*?)<\/[^:>]*:?t>/g)].map((match) => decodeXml(match[1])).join("");
  }
  const raw = cellXml.match(/<[^:>]*:?v>([\s\S]*?)<\/[^:>]*:?v>/)?.[1] || "";
  const decoded = decodeXml(raw);
  if (type === "s") return shared[Number(decoded)] || "";
  return decoded;
}

function objectRows(sheetName) {
  const target = sheetTargetsByName()[sheetName];
  if (!target) throw new Error(`Missing sheet ${sheetName}`);
  const xml = unzipText(target);
  const rows = [];
  for (const rowMatch of xml.matchAll(/<[^:>]*:?row\b[^>]*>([\s\S]*?)<\/[^:>]*:?row>/g)) {
    const row = [];
    for (const cellMatch of rowMatch[1].matchAll(/<[^:>]*:?c\b([^>]*)\/>|<[^:>]*:?c\b([^>]*)>([\s\S]*?)<\/[^:>]*:?c>/g)) {
      const ref = (cellMatch[1] || cellMatch[2] || "").match(/\br="([^"]+)"/)?.[1];
      if (!ref) continue;
      row[columnIndex(ref)] = cellValue(cellMatch[0]);
    }
    rows.push(row);
  }
  const headers = rows[0] || [];
  return rows
    .slice(1)
    .filter((row) => row.some((item) => String(item || "").trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
}

function comparable(value) {
  return formatCellValue(String(value || ""))
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

function display(value, max = 150) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function compareSource(sourceName, workbookRows, expectedByTitle, fields) {
  const mismatches = [];
  for (const row of workbookRows) {
    const expected = expectedByTitle.get(row["Top-Level Method"]);
    if (!expected) {
      mismatches.push({ method: row["Top-Level Method"], field: "*", workbook: "row present", airtable: "missing source row" });
      continue;
    }
    for (const field of fields) {
      const workbookValue = comparable(row[field]);
      const sourceValue = comparable(expected[field]);
      if (workbookValue !== sourceValue) {
        mismatches.push({ method: row["Top-Level Method"], field, workbook: display(row[field]), airtable: display(expected[field]) });
      }
    }
  }
  return { sourceName, mismatches };
}

const h2Records = listAllRecords("CX FY26 H2 Values");
const topRecords = listAllRecords("Method Top Level");
const tlUpdates = listAllRecords("TL Update Table");
const topById = new Map(topRecords.map((record) => [record.id, record]));
const h2Record = h2Records.find((record) => value(record, "CX FY26 H2 Values", "H2 Values", "; ") === targetValue);
if (!h2Record) throw new Error(`Could not find H2 value: ${targetValue}`);

const selectedTopMethods = links(h2Record, "CX FY26 H2 Values", "Methods Top Level")
  .map((link) => topById.get(link.id))
  .filter(Boolean);
const workbookRows = objectRows("Top-Level Methods");

const methodExpected = new Map();
const latestDateExpected = new Map();
const latestCommentaryExpected = new Map();
for (const record of selectedTopMethods) {
  const title = value(record, "Method Top Level", "Top Level Method");
  const updates = tlUpdates.filter((update) => updateLinkedTo(update, "TL Update Table", "Top Level Method Link", record.id));
  methodExpected.set(title, methodSource(record));
  latestDateExpected.set(title, latestByDateSource(updates, record));
  latestCommentaryExpected.set(title, latestWithCommentarySource(updates, record));
}

const fields = [
  "Current Status",
  "Current Actual",
  "Current Commentary",
  "Previous Status",
  "Previous Actual",
  "Previous Commentary",
  "Status Update Date",
  "Reporting Period",
];
const audits = [
  compareSource("Method Top Level table fields", workbookRows, methodExpected, fields),
  compareSource("Latest TL update by date sequence", workbookRows, latestDateExpected, fields),
  compareSource("Latest TL update with commentary sequence", workbookRows, latestCommentaryExpected, fields),
];

console.log(`Top-Level Methods audit for: ${targetValue}`);
console.log(`Workbook: ${workbookPath}`);
console.log(`Rows scanned: ${workbookRows.length}`);
for (const audit of audits) {
  console.log("");
  console.log(`${audit.sourceName}: ${audit.mismatches.length} mismatches`);
  for (const mismatch of audit.mismatches.slice(0, 30)) {
    console.log(`- ${mismatch.method} | ${mismatch.field}`);
    console.log(`  workbook: ${mismatch.workbook}`);
    console.log(`  airtable: ${mismatch.airtable}`);
  }
  if (audit.mismatches.length > 30) console.log(`  ... ${audit.mismatches.length - 30} more`);
}
