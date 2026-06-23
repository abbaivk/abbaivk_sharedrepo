import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const projectDir = "/Users/abbaivk/Documents/Codex Project/projects/airtable-mcp";
const proxy = path.join(projectDir, "build", "airtable-mcp-proxy.mjs");
const env = { ...process.env, AIRTABLE_MCP_CONFIG_FILE: path.join(projectDir, "config.json") };
const outputDir = path.join(projectDir, "outputs");
const outputPath = path.join(outputDir, "H2 Values - Linked Top Level Methods.xlsx");
const baseId = "appps1eduhJZPnFHD";
const tableName = "CX FY26 H2 Values";
const bodyFontSize = 12;
const headingFontSize = 14;

function callTool(name, args, id = 2) {
  const messages = [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "h2-values-linked-methods-extract", version: "0.1.0" },
      },
    },
    { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
    { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } },
  ];
  const result = spawnSync(proxy, {
    input: `${messages.map((message) => JSON.stringify(message)).join("\n")}\n`,
    env,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
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
const table = (schema.tables || []).find((candidate) => candidate.name === tableName);
if (!table) throw new Error(`Missing table: ${tableName}`);

const fieldByName = Object.fromEntries(table.fields.map((field) => [field.name, field]));
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

function raw(record, fieldName) {
  const field = fieldByName[fieldName];
  if (!field) return undefined;
  return (record.cellValuesByFieldId || record.fields || {})[field.id];
}

function flattenHuman(value) {
  if (value == null) return [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item) => flattenHuman(item));
  if (value.valuesByLinkedRecordId) {
    return Object.values(value.valuesByLinkedRecordId).flatMap((items) => flattenHuman(items));
  }
  if (value.name) return [String(value.name)];
  if (value.email) return [String(value.email)];
  // Deliberately do not fall back to linkedRecordIds or id. They are machine IDs, not report data.
  return [];
}

function linkedValues(value, linkedRecordId) {
  if (!value?.valuesByLinkedRecordId?.[linkedRecordId]) return [];
  return flattenHuman(value.valuesByLinkedRecordId[linkedRecordId]);
}

function unique(values) {
  const seen = new Set();
  const out = [];
  for (const value of values.map((item) => String(item).trim()).filter(Boolean)) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function join(values, separator = "\n") {
  return unique(values).join(separator);
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
  if (typeof value !== "string") return value;
  const cleaned = cleanReportText(value);
  const lines = cleaned
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length <= 1) return cleaned;
  if (lines.every(isListLine)) return lines.join("\n");
  return lines.map((line) => (isListLine(line) ? line : `- ${line}`)).join("\n");
}

function formatMatrix(matrix) {
  return matrix.map((row) => row.map((value) => formatCellValue(value)));
}

function numberValue(value) {
  const first = flattenHuman(value)[0];
  const parsed = Number(first);
  return Number.isFinite(parsed) ? parsed : null;
}

const h2Rows = records
  .map((record) => {
    const methods = raw(record, "Methods Top Level") || [];
    const methodIds = methods.map((method) => method.id).filter(Boolean);
    const linkedMethodNames = methods.map((method) => method.name).filter(Boolean);
    const methodOwner = raw(record, "Method Owner");
    const measureDescription = raw(record, "Measure Description");
    const subMethods = raw(record, "Sub-Methods");
    const supportingMethodOwner = raw(record, "Supporting Method Owner");
    return {
      order: numberValue(raw(record, "H2 Value Order")) ?? numberValue(raw(record, "Value Order")),
      h2Value: join(flattenHuman(raw(record, "H2 Values")).length ? flattenHuman(raw(record, "H2 Values")) : flattenHuman(raw(record, "Value"))),
      group: join(flattenHuman(raw(record, "Group")), "; "),
      team: join(flattenHuman(raw(record, "Team")), "; "),
      topLevelMethods: join(linkedMethodNames),
      methodOwners: join(methodIds.flatMap((methodId) => linkedValues(methodOwner, methodId))),
      measureDescriptions: join(methodIds.flatMap((methodId) => linkedValues(measureDescription, methodId))),
      subMethods: join(methodIds.flatMap((methodId) => linkedValues(subMethods, methodId))),
      supportingMethodOwners: join(methodIds.flatMap((methodId) => linkedValues(supportingMethodOwner, methodId))),
      methodCount: linkedMethodNames.length,
      subMethodCount: unique(methodIds.flatMap((methodId) => linkedValues(subMethods, methodId))).length,
      record,
    };
  })
  .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

const linkedRows = [];
for (const row of h2Rows) {
  const methods = raw(row.record, "Methods Top Level") || [];
  for (const method of methods) {
    linkedRows.push({
      h2Value: row.h2Value,
      order: row.order,
      group: row.group,
      team: row.team,
      topLevelMethod: method.name || "",
      methodOwner: join(linkedValues(raw(row.record, "Method Owner"), method.id)),
      measureDescription: join(linkedValues(raw(row.record, "Measure Description"), method.id)),
      fy26Measure: join(linkedValues(raw(row.record, "FY26 Measure (Value)"), method.id)),
      fy26Q1Measure: join(linkedValues(raw(row.record, "FY26 Q1 Measure (Value)"), method.id)),
      fy26Q2Measure: join(linkedValues(raw(row.record, "FY26 Q2 Measure (Value)"), method.id)),
      fy26Q3Measure: join(linkedValues(raw(row.record, "FY26 Q3 Measure (Value)"), method.id)),
      fy26Q4Measure: join(linkedValues(raw(row.record, "FY26 Q4 Measure (Value)"), method.id)),
      subMethods: join(linkedValues(raw(row.record, "Sub-Methods"), method.id)),
      supportingMethodOwners: join(linkedValues(raw(row.record, "Supporting Method Owner"), method.id)),
    });
  }
}

const workbook = Workbook.create();
const defaultSheet = workbook.worksheets.getItemOrNull?.("Sheet1");
if (defaultSheet) defaultSheet.delete();

function colToNum(col) {
  return [...col].reduce((num, char) => num * 26 + char.charCodeAt(0) - 64, 0);
}

function numToCol(num) {
  let out = "";
  while (num > 0) {
    const rem = (num - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    num = Math.floor((num - 1) / 26);
  }
  return out;
}

function setValues(sheet, startCell, matrix) {
  if (!matrix.length) return;
  const formattedMatrix = formatMatrix(matrix);
  const start = startCell.match(/^([A-Z]+)(\d+)$/);
  const startCol = colToNum(start[1]);
  const startRow = Number(start[2]);
  const endCol = numToCol(startCol + formattedMatrix[0].length - 1);
  const endRow = startRow + formattedMatrix.length - 1;
  const range = sheet.getRange(`${startCell}:${endCol}${endRow}`);
  range.values = formattedMatrix;
  range.format = {
    font: { size: bodyFontSize },
    wrapText: true,
    verticalAlignment: "top",
  };
}

function styleHeader(range) {
  range.format = {
    fill: "#1F4E78",
    font: { color: "#FFFFFF", bold: true, size: headingFontSize },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
  };
}

function styleTitle(range) {
  range.format = { font: { bold: true, size: headingFontSize, color: "#1F4E78" }, wrapText: true };
}

function setColumnWidths(sheet, widths) {
  for (const [col, widthPx] of Object.entries(widths)) {
    try {
      sheet.getRange(`${col}:${col}`).format = {
        columnWidthPx: widthPx,
        font: { size: bodyFontSize },
        wrapText: true,
        verticalAlignment: "top",
      };
    } catch {}
  }
}

const overview = workbook.worksheets.add("Overview");
setValues(overview, "A1", [["CX FY26 H2 Values"]]);
styleTitle(overview.getRange("A1"));
setValues(overview, "A3", [
  ["Base", "CX FY26 V2MOM - NEW"],
  ["Source table", "CX FY26 H2 Values"],
  ["H2 values", h2Rows.length],
  ["Top-level method links", linkedRows.length],
  ["Extraction logic", "Lookup fields resolved from valuesByLinkedRecordId; machine IDs excluded from report"],
]);
setValues(overview, "A10", [["Order", "H2 Value", "Group", "Team", "Top-Level Methods", "Sub-Methods"]]);
styleHeader(overview.getRange("A10:F10"));
setValues(
  overview,
  "A11",
  h2Rows.map((row) => [row.order, row.h2Value, row.group, row.team, row.methodCount, row.subMethodCount]),
);
setColumnWidths(overview, { A: 70, B: 420, C: 260, D: 260, E: 150, F: 130 });
styleTitle(overview.getRange("A1"));
styleHeader(overview.getRange("A10:F10"));

const h2Sheet = workbook.worksheets.add("H2 Values");
const h2Headers = [
  "Order",
  "H2 Value",
  "Group",
  "Team",
  "Top-Level Methods",
  "Method Owner Name",
  "Measure Descriptions",
  "Sub-Methods",
  "Owner - Supporting Method",
];
setValues(h2Sheet, "A1", [h2Headers]);
styleHeader(h2Sheet.getRange("A1:I1"));
setValues(
  h2Sheet,
  "A2",
  h2Rows.map((row) => [
    row.order,
    row.h2Value,
    row.group,
    row.team,
    row.topLevelMethods,
    row.methodOwners,
    row.measureDescriptions,
    row.subMethods,
    row.supportingMethodOwners,
  ]),
);
setColumnWidths(h2Sheet, { A: 70, B: 380, C: 230, D: 230, E: 520, F: 260, G: 520, H: 520, I: 260 });
styleHeader(h2Sheet.getRange("A1:I1"));

const linkedSheet = workbook.worksheets.add("Linked Methods");
const linkedHeaders = [
  "Order",
  "H2 Value",
  "Group",
  "Team",
  "Top-Level Method",
  "Method Owner Name",
  "Measure Description",
  "FY26 Measure",
  "FY26 Q1 Measure",
  "FY26 Q2 Measure",
  "FY26 Q3 Measure",
  "FY26 Q4 Measure",
  "Sub-Methods",
  "Owner - Supporting Method",
];
setValues(linkedSheet, "A1", [linkedHeaders]);
styleHeader(linkedSheet.getRange("A1:N1"));
setValues(
  linkedSheet,
  "A2",
  linkedRows.map((row) => [
    row.order,
    row.h2Value,
    row.group,
    row.team,
    row.topLevelMethod,
    row.methodOwner,
    row.measureDescription,
    row.fy26Measure,
    row.fy26Q1Measure,
    row.fy26Q2Measure,
    row.fy26Q3Measure,
    row.fy26Q4Measure,
    row.subMethods,
    row.supportingMethodOwners,
  ]),
);
setColumnWidths(linkedSheet, {
  A: 70,
  B: 340,
  C: 210,
  D: 220,
  E: 420,
  F: 220,
  G: 420,
  H: 360,
  I: 280,
  J: 280,
  K: 280,
  L: 280,
  M: 420,
  N: 240,
});
styleHeader(linkedSheet.getRange("A1:N1"));

for (const sheet of [overview, h2Sheet, linkedSheet]) {
  try {
    sheet.freezePanes = { rows: 1 };
  } catch {}
}

const overviewInspect = await workbook.inspect({
  kind: "table",
  range: "Overview!A1:F17",
  include: "values",
  tableMaxRows: 20,
  tableMaxCols: 8,
});
console.log(overviewInspect.ndjson);

const h2Inspect = await workbook.inspect({
  kind: "table",
  range: "H2 Values!A1:I8",
  include: "values",
  tableMaxRows: 10,
  tableMaxCols: 12,
});
console.log(h2Inspect.ndjson);

const linkedInspect = await workbook.inspect({
  kind: "table",
  range: "Linked Methods!A1:G12",
  include: "values",
  tableMaxRows: 14,
  tableMaxCols: 10,
});
console.log(linkedInspect.ndjson);

const machineIds = await workbook.inspect({
  kind: "match",
  searchTerm: "\\b(?:rec|fld|usr|sel)[A-Za-z0-9]{14,}\\b",
  options: { useRegex: true, maxResults: 50 },
  summary: "machine id scan",
});
console.log(machineIds.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 50 },
  summary: "formula error scan",
});
console.log(errors.ndjson);

await workbook.render({ sheetName: "Overview", range: "A1:F17", format: "png", scale: 2 });
await workbook.render({ sheetName: "H2 Values", range: "A1:I8", format: "png", scale: 2 });
await workbook.render({ sheetName: "Linked Methods", range: "A1:N16", format: "png", scale: 2 });

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({ outputPath, sheets: workbook.worksheets.items.map((sheet) => sheet.name), h2Rows: h2Rows.length, linkedRows: linkedRows.length }));
