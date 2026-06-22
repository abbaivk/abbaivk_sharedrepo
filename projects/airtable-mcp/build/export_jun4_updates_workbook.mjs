import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const projectDir = "/Users/abbaivk/Documents/Codex Project/projects/airtable-mcp";
const proxy = "/Users/abbaivk/.codex/bin/airtable-mcp-keychain-proxy";
const bundledNodeBin = "/Users/abbaivk/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin";
const env = {
  ...process.env,
  AIRTABLE_MCP_CONFIG_FILE: path.join(projectDir, "config.json"),
  PATH: `${bundledNodeBin}:${process.env.PATH || ""}`,
};
const outputDir = path.join(projectDir, "outputs");
const baseId = "appps1eduhJZPnFHD";
const reportingPeriod = process.argv.slice(2).join(" ").trim() || "Jun 4 (June MBR)";
const outputName = `${reportingPeriod
  .replace(/[()]/g, "")
  .replace(/[^A-Za-z0-9]+/g, " ")
  .trim()
  .replace(/\s+/g, " ")} Updated Methods - All H2 Template.xlsx`;
const outputPath = path.join(outputDir, outputName);
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
        clientInfo: { name: "standard-reporting-period-extract", version: "0.1.0" },
      },
    },
    { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
    { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } },
  ];
  const result = spawnSync(proxy, {
    input: `${messages.map((message) => JSON.stringify(message)).join("\n")}\n`,
    env,
    encoding: "utf8",
    maxBuffer: 150 * 1024 * 1024,
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

function flattenHuman(value) {
  if (value == null) return [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item) => flattenHuman(item));
  if (value.valuesByLinkedRecordId) {
    return Object.values(value.valuesByLinkedRecordId).flatMap((items) => flattenHuman(items));
  }
  if (value.name) return [String(value.name)];
  if (value.email) return [String(value.email)];
  return [];
}

function unique(values) {
  const seen = new Set();
  const out = [];
  for (const value of values.map((item) => String(item || "").trim()).filter(Boolean)) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function join(value, separator = "; ") {
  return unique(flattenHuman(value)).join(separator);
}

function cleanReportText(value) {
  return String(value || "")
    .replaceAll("```", "")
    .replaceAll("\\#", "#")
    .replace(/@\[(?:rec|fld|usr|sel)[A-Za-z0-9]{14,}\]\s*/g, "")
    .replace(/\b(?:rec|fld|usr|sel)[A-Za-z0-9]{14,}\b/g, "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function formatCellValue(value) {
  if (typeof value !== "string") return value;
  const cleaned = cleanReportText(value);
  const lines = cleaned
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.join("\n");
}

function formatMatrix(matrix) {
  return matrix.map((row) => row.map((value) => formatCellValue(value)));
}

function formatDate(value) {
  if (!value) return "";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return String(value);
  return new Date(time).toISOString().replace("T", " ").slice(0, 16);
}

function sortDate(value) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
}

function tableByName(schema, tableName) {
  const table = (schema.tables || []).find((candidate) => candidate.name === tableName);
  if (!table) throw new Error(`Missing table: ${tableName}`);
  return table;
}

function fieldMap(table) {
  return Object.fromEntries((table.fields || []).map((field) => [field.name, field]));
}

function fieldId(fields, name) {
  const field = fields[name];
  if (!field) throw new Error(`Missing field: ${name}`);
  return field.id;
}

function optionalFieldId(fields, name) {
  return fields[name]?.id || null;
}

function raw(record, id) {
  if (!id) return undefined;
  return (record.cellValuesByFieldId || record.fields || {})[id];
}

function linkedIds(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => item?.id).filter(Boolean);
  if (Array.isArray(value.linkedRecordIds)) return value.linkedRecordIds;
  return [];
}

function recordsForTable(tableId, fieldIds) {
  const records = [];
  let cursor;
  do {
    const page = callTool("list_records_for_table", {
      baseId,
      tableId,
      fieldIds: unique(fieldIds.filter(Boolean)),
      pageSize: 100,
      ...(cursor ? { cursor } : {}),
    });
    records.push(...(page.records || []));
    cursor = page.nextCursor;
  } while (cursor);
  return records;
}

function periodMatches(record, fieldId) {
  return flattenHuman(raw(record, fieldId)).some((value) => String(value).trim() === reportingPeriod);
}

function latestBy(rows, keyFn) {
  const out = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    const current = out.get(key);
    if (!current || sortDate(row.updateDate) >= sortDate(current.updateDate)) out.set(key, row);
  }
  return [...out.values()];
}

const schema = callTool("list_tables_for_base", { baseId });
const h2Table = tableByName(schema, "CX FY26 H2 Values");
const topTable = tableByName(schema, "Method Top Level");
const subTable = tableByName(schema, "Supporting Methods");
const tlUpdateTable = tableByName(schema, "TL Update Table");
const smUpdateTable = tableByName(schema, "SM Update Table");

const h2Fields = fieldMap(h2Table);
const topFields = fieldMap(topTable);
const subFields = fieldMap(subTable);
const tlFields = fieldMap(tlUpdateTable);
const smFields = fieldMap(smUpdateTable);

const h2 = {
  value: fieldId(h2Fields, "Value"),
  h2Values: optionalFieldId(h2Fields, "H2 Values"),
  order: optionalFieldId(h2Fields, "H2 Value Order") || optionalFieldId(h2Fields, "Value Order"),
  group: optionalFieldId(h2Fields, "Group"),
  team: optionalFieldId(h2Fields, "Team"),
};
const top = {
  method: fieldId(topFields, "Top Level Method"),
  owner: fieldId(topFields, "Method Owner"),
  statusOwner: fieldId(topFields, "Status Owner"),
  team: fieldId(topFields, "Team"),
  measure: fieldId(topFields, "Measure Description"),
  fy26Measure: fieldId(topFields, "FY26 Measure (Value)"),
  currentStatus: fieldId(topFields, "Current Status"),
  currentActual: fieldId(topFields, "Current Actual"),
  currentCommentary: fieldId(topFields, "Current Commentary"),
  previousStatus: fieldId(topFields, "Previous Status"),
  previousActual: fieldId(topFields, "Previous Actual"),
  previousCommentary: fieldId(topFields, "Previous Commentary"),
  statusUpdateDate: fieldId(topFields, "Status Update Date"),
  reportingPeriod: fieldId(topFields, "Reporting Period"),
  supportingMethods: fieldId(topFields, "Supporting Methods"),
  updates: fieldId(topFields, "TL Update Table"),
  values: fieldId(topFields, "Values"),
};
const sub = {
  method: fieldId(subFields, "Sub-Method"),
  owner: fieldId(subFields, "Owner - Supporting Method"),
  statusOwner: fieldId(subFields, "Status Owner"),
  team: fieldId(subFields, "Team - Supporting Method"),
  measure: fieldId(subFields, "Measure Description"),
  fy26Measure: fieldId(subFields, "FY26 Measure (Value)"),
  currentStatus: fieldId(subFields, "Current Status"),
  currentActual: fieldId(subFields, "Current Actual"),
  currentCommentary: fieldId(subFields, "Current Commentary"),
  previousStatus: fieldId(subFields, "Previous Status"),
  previousActual: fieldId(subFields, "Previous Actual"),
  previousCommentary: fieldId(subFields, "Previous Commentary"),
  statusUpdateDate: fieldId(subFields, "Status Update Date"),
  reportingPeriod: fieldId(subFields, "Reporting Period"),
  updates: fieldId(subFields, "SM Update Table"),
  parent: fieldId(subFields, "Method Top Level"),
  firas: optionalFieldId(subFields, "Feature Firas"),
};
const tl = {
  method: fieldId(tlFields, "Top Level Method"),
  owner: fieldId(tlFields, "Method Owner"),
  statusOwner: fieldId(tlFields, "Status Owner"),
  status: fieldId(tlFields, "Current Status"),
  actual: fieldId(tlFields, "Current Actual"),
  comment: fieldId(tlFields, "Current Commentary"),
  reportingMonth: fieldId(tlFields, "Reporting Month"),
  reportingPeriodLookup: fieldId(tlFields, "Reporting Period"),
  reportingPeriodsLink: fieldId(tlFields, "Reporting Periods"),
  updateDate: fieldId(tlFields, "Update Date and Time"),
  topLink: fieldId(tlFields, "Top Level Method Link"),
  obstacles: optionalFieldId(tlFields, "Obstacles NL"),
};
const sm = {
  method: fieldId(smFields, "Supporting Method"),
  owner: fieldId(smFields, "Supporting Method Owner"),
  statusOwner: fieldId(smFields, "Status Owner"),
  status: fieldId(smFields, "Current Status"),
  actual: fieldId(smFields, "Current Actual"),
  comment: fieldId(smFields, "Current Commentary"),
  reportingMonth: fieldId(smFields, "Reporting Month"),
  reportingPeriodLookup: fieldId(smFields, "Reporting Period"),
  reportingPeriodsLink: fieldId(smFields, "Reporting Periods"),
  updateDate: fieldId(smFields, "Update Date and Time"),
  subLink: fieldId(smFields, "Supporting Methods"),
  obstacles: optionalFieldId(smFields, "Obstacles"),
};

const h2Records = recordsForTable(h2Table.id, Object.values(h2));
const topRecords = recordsForTable(topTable.id, Object.values(top));
const subRecords = recordsForTable(subTable.id, Object.values(sub));
const tlUpdates = recordsForTable(tlUpdateTable.id, Object.values(tl)).filter((record) =>
  periodMatches(record, tl.reportingPeriodLookup),
);
const smUpdates = recordsForTable(smUpdateTable.id, Object.values(sm)).filter((record) =>
  periodMatches(record, sm.reportingPeriodLookup),
);

const h2ById = new Map(h2Records.map((record) => [record.id, record]));
const topById = new Map(topRecords.map((record) => [record.id, record]));
const subById = new Map(subRecords.map((record) => [record.id, record]));

function h2ContextFromTop(topRecord) {
  const h2Record = h2ById.get(linkedIds(raw(topRecord, top.values))[0]);
  if (!h2Record) {
    return { order: "", h2Value: "Not linked in Airtable", group: "", team: "" };
  }
  return {
    order: Number(flattenHuman(raw(h2Record, h2.order))[0] || "") || "",
    h2Value: join(raw(h2Record, h2.h2Values)) || join(raw(h2Record, h2.value)) || "Not specified",
    group: join(raw(h2Record, h2.group)),
    team: join(raw(h2Record, h2.team)),
  };
}

function topContext(topRecord) {
  if (!topRecord) return { order: "", h2Value: "Not linked in Airtable", group: "", team: "", topMethod: "Not linked" };
  return {
    ...h2ContextFromTop(topRecord),
    topMethod: cleanReportText(raw(topRecord, top.method)),
  };
}

function subContext(subRecord) {
  if (!subRecord) {
    return { order: "", h2Value: "Not linked in Airtable", group: "", team: "", topMethod: "Not linked", subMethod: "Not linked" };
  }
  const parentTop = topById.get(linkedIds(raw(subRecord, sub.parent))[0]);
  return {
    ...topContext(parentTop),
    subMethod: cleanReportText(raw(subRecord, sub.method)),
  };
}

const tlUpdateRows = tlUpdates
  .map((record) => {
    const topRecord = topById.get(linkedIds(raw(record, tl.topLink))[0]);
    const context = topContext(topRecord);
    return {
      ...context,
      topId: topRecord?.id || "",
      updateDate: formatDate(raw(record, tl.updateDate)),
      reportingMonth: join(raw(record, tl.reportingMonth)),
      reportingPeriod,
      status: join(raw(record, tl.status)) || "Not specified",
      actual: raw(record, tl.actual),
      commentary: raw(record, tl.comment),
      obstacles: raw(record, tl.obstacles),
      owner: join(raw(record, tl.owner)) || join(raw(topRecord, top.owner)) || "Not specified",
      statusOwner: join(raw(record, tl.statusOwner)) || join(raw(topRecord, top.statusOwner)) || "Not specified",
      methodTeam: join(raw(topRecord, top.team)),
      measure: raw(topRecord, top.measure),
      fy26Measure: raw(topRecord, top.fy26Measure),
      subMethodCount: linkedIds(raw(topRecord, top.supportingMethods)).length || "",
    };
  })
  .sort((a, b) => (a.order || 999) - (b.order || 999) || a.topMethod.localeCompare(b.topMethod) || sortDate(a.updateDate) - sortDate(b.updateDate));

const smUpdateRows = smUpdates
  .map((record) => {
    const subRecord = subById.get(linkedIds(raw(record, sm.subLink))[0]);
    const context = subContext(subRecord);
    return {
      ...context,
      subId: subRecord?.id || "",
      updateDate: formatDate(raw(record, sm.updateDate)),
      reportingMonth: join(raw(record, sm.reportingMonth)),
      reportingPeriod,
      status: join(raw(record, sm.status)) || "Not specified",
      actual: raw(record, sm.actual),
      commentary: raw(record, sm.comment),
      obstacles: raw(record, sm.obstacles),
      owner: join(raw(record, sm.owner)) || join(raw(subRecord, sub.owner)) || "Not specified",
      statusOwner: join(raw(record, sm.statusOwner)) || join(raw(subRecord, sub.statusOwner)) || "Not specified",
      subMethodTeam: join(raw(subRecord, sub.team)),
      measure: raw(subRecord, sub.measure),
      fy26Measure: raw(subRecord, sub.fy26Measure),
    };
  })
  .sort((a, b) => (a.order || 999) - (b.order || 999) || a.topMethod.localeCompare(b.topMethod) || a.subMethod.localeCompare(b.subMethod) || sortDate(a.updateDate) - sortDate(b.updateDate));

const topRows = latestBy(tlUpdateRows, (row) => row.topId)
  .map((row) => ({
    ...row,
    currentStatus: row.status,
    currentActual: row.actual,
    currentCommentary: row.commentary,
    previousStatus: "",
    previousActual: "",
    previousCommentary: "",
    statusUpdateDate: row.updateDate,
    updateCount: tlUpdateRows.filter((candidate) => candidate.topId === row.topId).length,
  }))
  .sort((a, b) => (a.order || 999) - (b.order || 999) || a.topMethod.localeCompare(b.topMethod));

const subRows = latestBy(smUpdateRows, (row) => row.subId)
  .map((row) => {
    const subRecord = subById.get(row.subId);
    return {
      ...row,
      currentStatus: row.status,
      currentActual: row.actual,
      currentCommentary: row.commentary,
      previousStatus: "",
      previousActual: "",
      previousCommentary: "",
      statusUpdateDate: row.updateDate,
      updateCount: smUpdateRows.filter((candidate) => candidate.subId === row.subId).length,
      firaCount: linkedIds(raw(subRecord, sub.firas)).length || "",
    };
  })
  .sort((a, b) => (a.order || 999) - (b.order || 999) || a.topMethod.localeCompare(b.topMethod) || a.subMethod.localeCompare(b.subMethod));

const summaryByH2 = new Map();
for (const row of [...topRows, ...subRows]) {
  const key = row.h2Value || "Not linked in Airtable";
  const current = summaryByH2.get(key) || {
    order: row.order,
    h2Value: key,
    group: row.group,
    team: row.team,
    topMethods: new Set(),
    subMethods: new Set(),
    tlUpdates: 0,
    smUpdates: 0,
  };
  if (row.topId) current.topMethods.add(row.topId);
  if (row.subId) current.subMethods.add(row.subId);
  summaryByH2.set(key, current);
}
for (const row of tlUpdateRows) {
  const current = summaryByH2.get(row.h2Value);
  if (current) current.tlUpdates += 1;
}
for (const row of smUpdateRows) {
  const current = summaryByH2.get(row.h2Value);
  if (current) current.smUpdates += 1;
}
const summaryRows = [...summaryByH2.values()].sort((a, b) => (a.order || 999) - (b.order || 999) || a.h2Value.localeCompare(b.h2Value));

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

function writeSheet(name, headers, rows, widths) {
  const sheet = workbook.worksheets.add(name);
  setValues(sheet, "A1", [headers]);
  styleHeader(sheet.getRange(`A1:${numToCol(headers.length)}1`));
  if (rows.length) setValues(sheet, "A2", rows);
  try {
    sheet.freezePanes = { rows: 1 };
  } catch {}
  setColumnWidths(sheet, widths);
  styleHeader(sheet.getRange(`A1:${numToCol(headers.length)}1`));
  return sheet;
}

const overview = workbook.worksheets.add("Overview");
setValues(overview, "A1", [["All H2 Values - Methods and Comments"]]);
styleTitle(overview.getRange("A1"));
setValues(overview, "A3", [
  ["Report Summary", "Value"],
  ["Base", "CX FY26 V2MOM - NEW"],
  ["Source", "Live Airtable MCP"],
  ["Template", "All H2 Values - Methods and Comments"],
  ["Reporting Period Filter", reportingPeriod],
  ["H2 Values Included", summaryRows.length],
  ["Top-Level Method Rows", topRows.length],
  ["Sub-Method Rows", subRows.length],
  ["Dated Top-Level Update Rows", tlUpdateRows.length],
  ["Dated Sub-Method Update Rows", smUpdateRows.length],
  ["Airtable Record Comments", 0],
  ["Extraction Note", "Reporting-period extract using the standard all-H2 methods/comments workbook structure."],
]);
styleHeader(overview.getRange("A3:B3"));
setValues(overview, "A17", [["H2 Value Summary"]]);
styleTitle(overview.getRange("A17"));
setValues(overview, "A19", [["H2 Order", "H2 Value", "Group", "Team", "Top-Level Methods", "Sub-Methods", "TL Updates", "SM Updates", "Record Comments"]]);
styleHeader(overview.getRange("A19:I19"));
setValues(
  overview,
  "A20",
  summaryRows.map((row) => [
    row.order,
    row.h2Value,
    row.group,
    row.team,
    row.topMethods.size,
    row.subMethods.size,
    row.tlUpdates,
    row.smUpdates,
    0,
  ]),
);
setColumnWidths(overview, { A: 90, B: 430, C: 260, D: 260, E: 150, F: 130, G: 120, H: 120, I: 140 });
styleTitle(overview.getRange("A1"));
styleHeader(overview.getRange("A3:B3"));
styleTitle(overview.getRange("A17"));
styleHeader(overview.getRange("A19:I19"));

writeSheet(
  "Top-Level Methods",
  [
    "H2 Order",
    "H2 Value",
    "Group",
    "Team",
    "Top-Level Method",
    "Method Owner Name",
    "Status Owner",
    "Method Team",
    "Measure Description",
    "FY26 Measure",
    "Current Status",
    "Current Actual",
    "Current Commentary",
    "Previous Status",
    "Previous Actual",
    "Previous Commentary",
    "Status Update Date",
    "Reporting Period",
    "Sub-Method Count",
    "Dated Update Count",
  ],
  topRows.map((row) => [
    row.order,
    row.h2Value,
    row.group,
    row.team,
    row.topMethod,
    row.owner,
    row.statusOwner,
    row.methodTeam,
    row.measure,
    row.fy26Measure,
    row.currentStatus,
    row.currentActual,
    row.currentCommentary,
    row.previousStatus,
    row.previousActual,
    row.previousCommentary,
    row.statusUpdateDate,
    row.reportingPeriod,
    row.subMethodCount,
    row.updateCount,
  ]),
  { A: 90, B: 360, C: 220, D: 220, E: 420, F: 220, G: 220, H: 220, I: 420, J: 360, K: 150, L: 280, M: 520, N: 150, O: 280, P: 420, Q: 160, R: 180, S: 120, T: 120 },
);

writeSheet(
  "Sub-Methods",
  [
    "H2 Order",
    "H2 Value",
    "Group",
    "Team",
    "Top-Level Method",
    "Sub-Method",
    "Owner - Supporting Method",
    "Status Owner",
    "Sub-Method Team",
    "Measure Description",
    "FY26 Measure",
    "Current Status",
    "Current Actual",
    "Current Commentary",
    "Previous Status",
    "Previous Actual",
    "Previous Commentary",
    "Status Update Date",
    "Reporting Period",
    "Dated Update Count",
    "FIRA Count",
    "FIRAs",
    "FIRA Feature Names",
    "FIRA Latest Release Quarter Status",
    "FIRA JIRA Status",
    "FIRA JIRA Feature State",
    "FIRA Latest Update Quarter",
    "FIRA Market Access",
    "FIRA CLUS Payload Items",
    "FIRA CLUS Payload Items NEW",
  ],
  subRows.map((row) => [
    row.order,
    row.h2Value,
    row.group,
    row.team,
    row.topMethod,
    row.subMethod,
    row.owner,
    row.statusOwner,
    row.subMethodTeam,
    row.measure,
    row.fy26Measure,
    row.currentStatus,
    row.currentActual,
    row.currentCommentary,
    row.previousStatus,
    row.previousActual,
    row.previousCommentary,
    row.statusUpdateDate,
    row.reportingPeriod,
    row.updateCount,
    row.firaCount,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]),
  {
    A: 90,
    B: 360,
    C: 220,
    D: 220,
    E: 390,
    F: 420,
    G: 220,
    H: 220,
    I: 220,
    J: 420,
    K: 360,
    L: 150,
    M: 280,
    N: 420,
    O: 150,
    P: 280,
    Q: 420,
    R: 160,
    S: 180,
    T: 120,
    U: 110,
    V: 180,
    W: 420,
    X: 320,
    Y: 260,
    Z: 220,
    AA: 260,
    AB: 220,
    AC: 220,
    AD: 260,
  },
);

writeSheet(
  "TL Dated Updates",
  ["H2 Order", "H2 Value", "Top-Level Method", "Update Date", "Reporting Month", "Reporting Period", "Status", "Actual", "Commentary", "Obstacles"],
  tlUpdateRows.map((row) => [row.order, row.h2Value, row.topMethod, row.updateDate, row.reportingMonth, row.reportingPeriod, row.status, row.actual, row.commentary, row.obstacles]),
  { A: 90, B: 360, C: 420, D: 170, E: 150, F: 180, G: 160, H: 320, I: 520, J: 420 },
);

writeSheet(
  "SM Dated Updates",
  ["H2 Order", "H2 Value", "Top-Level Method", "Sub-Method", "Update Date", "Reporting Month", "Reporting Period", "Status", "Actual", "Commentary", "Obstacles"],
  smUpdateRows.map((row) => [row.order, row.h2Value, row.topMethod, row.subMethod, row.updateDate, row.reportingMonth, row.reportingPeriod, row.status, row.actual, row.commentary, row.obstacles]),
  { A: 90, B: 340, C: 360, D: 420, E: 170, F: 150, G: 180, H: 160, I: 320, J: 520, K: 420 },
);

writeSheet(
  "Airtable Record Comments",
  ["H2 Order", "H2 Value", "Record Type", "Top-Level Method", "Sub-Method", "Comment Date", "Author", "Comment"],
  [["", "", "", "", "", "", "", "No Airtable record comments extracted for this reporting-period update export."]],
  { A: 90, B: 360, C: 180, D: 420, E: 420, F: 170, G: 220, H: 520 },
);

const overviewInspect = await workbook.inspect({
  kind: "table",
  range: "Overview!A1:I26",
  include: "values",
  tableMaxRows: 30,
  tableMaxCols: 10,
});
console.log(overviewInspect.ndjson);

const topInspect = await workbook.inspect({
  kind: "table",
  range: "Top-Level Methods!A1:T8",
  include: "values",
  tableMaxRows: 10,
  tableMaxCols: 21,
});
console.log(topInspect.ndjson);

const subInspect = await workbook.inspect({
  kind: "table",
  range: "Sub-Methods!A1:AD8",
  include: "values",
  tableMaxRows: 10,
  tableMaxCols: 31,
});
console.log(subInspect.ndjson);

const machineIds = await workbook.inspect({
  kind: "match",
  searchTerm: "\\b(?:rec|fld|usr|sel)[A-Za-z0-9]{14,}\\b",
  options: { useRegex: true, maxResults: 100 },
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

await workbook.render({ sheetName: "Overview", range: "A1:I26", format: "png", scale: 2 });
await workbook.render({ sheetName: "Top-Level Methods", range: "A1:T8", format: "png", scale: 2 });
await workbook.render({ sheetName: "Sub-Methods", range: "A1:AD8", format: "png", scale: 2 });
await workbook.render({ sheetName: "TL Dated Updates", range: "A1:J12", format: "png", scale: 2 });
await workbook.render({ sheetName: "SM Dated Updates", range: "A1:K12", format: "png", scale: 2 });
await workbook.render({ sheetName: "Airtable Record Comments", range: "A1:H5", format: "png", scale: 2 });

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

console.log(
  JSON.stringify({
    outputPath,
    sheets: workbook.worksheets.items.map((sheet) => sheet.name),
    h2Values: summaryRows.length,
    topLevelMethods: topRows.length,
    subMethods: subRows.length,
    tlDatedUpdates: tlUpdateRows.length,
    smDatedUpdates: smUpdateRows.length,
  }),
);
