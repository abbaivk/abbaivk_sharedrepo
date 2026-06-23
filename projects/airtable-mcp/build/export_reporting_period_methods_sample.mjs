import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const projectDir = "/Users/abbaivk/Documents/Codex Project/projects/airtable-mcp";
const outputDir = path.join(projectDir, "outputs");
const baseId = "appps1eduhJZPnFHD";
const endpoint = "https://mcp.airtable.com/mcp";
const tokenConfig = JSON.parse(await fs.readFile(path.join(projectDir, "config.json"), "utf8"));
const airtableToken = tokenConfig.pat || tokenConfig.AIRTABLE_MCP_PAT || tokenConfig.AIRTABLE_PERSONAL_ACCESS_TOKEN;
if (!airtableToken) throw new Error("Missing Airtable token in config.json");
const reportingPeriod = process.argv.slice(2).join(" ").trim() || "Jun 4 (June MBR)";
const filePeriod = reportingPeriod
  .replace(/[()]/g, "")
  .replace(/[^A-Za-z0-9]+/g, " ")
  .trim()
  .replace(/\s+/g, " ");
const outputPath = path.join(outputDir, `${filePeriod} Methods Sample - Requested Columns.xlsx`);
const bodyFontSize = 12;
const headingFontSize = 13;
const palette = {
  header: "#1F4E78",
  h2: "#245B89",
  topLevel: "#D9EAF7",
  current: "#EAF5F1",
  previous: "#FFF4D8",
  date: "#EEF2F6",
  white: "#FFFFFF",
  alternate: "#F7F9FB",
  text: "#1F2933",
  muted: "#52616F",
};

function parseMcpText(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("event:") || trimmed.startsWith("data:")) {
    const dataLines = trimmed
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim());
    return JSON.parse(dataLines.join("\n"));
  }
  return JSON.parse(trimmed);
}

async function mcp(method, params, id = 1) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${airtableToken}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Airtable MCP HTTP ${response.status}: ${text.slice(0, 1000)}`);
  const payload = parseMcpText(text);
  if (payload?.error) throw new Error(JSON.stringify(payload.error));
  return payload?.result;
}

async function callTool(name, args) {
  const result = await mcp("tools/call", { name, arguments: args });
  return result?.structuredContent || result;
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

function cleanText(value) {
  return String(value || "")
    .replaceAll("```", "")
    .replaceAll("\\#", "#")
    .replace(/@\[(?:rec|fld|usr|sel)[A-Za-z0-9]{14,}\]\s*/g, "")
    .replace(/\b(?:rec|fld|usr|sel)[A-Za-z0-9]{14,}\b/g, "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function cellText(value) {
  if (typeof value !== "string") return value;
  return cleanText(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function formatMatrix(matrix) {
  return matrix.map((row) => row.map((value) => cellText(value)));
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

function raw(record, id) {
  if (!record || !id) return undefined;
  return (record.cellValuesByFieldId || record.fields || {})[id];
}

function linkedIds(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => item?.id).filter(Boolean);
  if (Array.isArray(value.linkedRecordIds)) return value.linkedRecordIds;
  return [];
}

async function recordsForTable(tableId, fieldIds) {
  const records = [];
  let cursor;
  do {
    const page = await callTool("list_records_for_table", {
      baseId,
      tableId,
      fieldIds: unique(fieldIds),
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

await mcp("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "reporting-period-methods-sample", version: "0.1.0" },
});

const schema = await callTool("list_tables_for_base", { baseId });
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
  h2Values: fieldId(h2Fields, "H2 Values"),
  order: fieldId(h2Fields, "H2 Value Order"),
  group: fieldId(h2Fields, "Group"),
  team: fieldId(h2Fields, "Team"),
};
const top = {
  method: fieldId(topFields, "Top Level Method"),
  owner: fieldId(topFields, "Method Owner"),
  statusOwner: fieldId(topFields, "Status Owner"),
  team: fieldId(topFields, "Team"),
  measure: fieldId(topFields, "Measure Description"),
  fy26Measure: fieldId(topFields, "FY26 Measure (Value)"),
  supportingMethods: fieldId(topFields, "Supporting Methods"),
  values: fieldId(topFields, "Values"),
};
const sub = {
  method: fieldId(subFields, "Sub-Method"),
  owner: fieldId(subFields, "Owner - Supporting Method"),
  statusOwner: fieldId(subFields, "Status Owner"),
  team: fieldId(subFields, "Team - Supporting Method"),
  measure: fieldId(subFields, "Measure Description"),
  fy26Measure: fieldId(subFields, "FY26 Measure (Value)"),
  parent: fieldId(subFields, "Method Top Level"),
};
const tl = {
  method: fieldId(tlFields, "Top Level Method"),
  owner: fieldId(tlFields, "Method Owner"),
  statusOwner: fieldId(tlFields, "Status Owner"),
  status: fieldId(tlFields, "Current Status"),
  actual: fieldId(tlFields, "Current Actual"),
  comment: fieldId(tlFields, "Current Commentary"),
  reportingPeriodLookup: fieldId(tlFields, "Reporting Period"),
  reportingMonth: fieldId(tlFields, "Reporting Month"),
  updateDate: fieldId(tlFields, "Update Date and Time"),
  topLink: fieldId(tlFields, "Top Level Method Link"),
};
const sm = {
  method: fieldId(smFields, "Supporting Method"),
  owner: fieldId(smFields, "Supporting Method Owner"),
  statusOwner: fieldId(smFields, "Status Owner"),
  status: fieldId(smFields, "Current Status"),
  actual: fieldId(smFields, "Current Actual"),
  comment: fieldId(smFields, "Current Commentary"),
  reportingPeriodLookup: fieldId(smFields, "Reporting Period"),
  reportingMonth: fieldId(smFields, "Reporting Month"),
  updateDate: fieldId(smFields, "Update Date and Time"),
  subLink: fieldId(smFields, "Supporting Methods"),
};

const [h2Records, topRecords, subRecords, allTlUpdateRecords, allSmUpdateRecords] = await Promise.all([
  recordsForTable(h2Table.id, Object.values(h2)),
  recordsForTable(topTable.id, Object.values(top)),
  recordsForTable(subTable.id, Object.values(sub)),
  recordsForTable(tlUpdateTable.id, Object.values(tl)),
  recordsForTable(smUpdateTable.id, Object.values(sm)),
]);

const h2ById = new Map(h2Records.map((record) => [record.id, record]));
const topById = new Map(topRecords.map((record) => [record.id, record]));
const subById = new Map(subRecords.map((record) => [record.id, record]));

function h2ContextFromTop(topRecord) {
  const h2Record = h2ById.get(linkedIds(raw(topRecord, top.values))[0]);
  if (!h2Record) return { order: "", h2Value: "Not linked in Airtable", group: "", team: "" };
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
    topMethod: cleanText(raw(topRecord, top.method)),
  };
}

function subContext(subRecord) {
  if (!subRecord) return { order: "", h2Value: "Not linked in Airtable", group: "", team: "", topMethod: "Not linked", subMethod: "Not linked" };
  const parentTop = topById.get(linkedIds(raw(subRecord, sub.parent))[0]);
  return {
    ...topContext(parentTop),
    subMethod: cleanText(raw(subRecord, sub.method)),
  };
}

const allTlUpdateRows = allTlUpdateRecords.map((record) => {
  const topRecord = topById.get(linkedIds(raw(record, tl.topLink))[0]);
  return {
    ...topContext(topRecord),
    recordId: record.id,
    topId: topRecord?.id || "",
    methodOwner: join(raw(record, tl.owner)) || join(raw(topRecord, top.owner)) || "Not specified",
    statusOwner: join(raw(record, tl.statusOwner)) || join(raw(topRecord, top.statusOwner)) || "Not specified",
    status: join(raw(record, tl.status)) || "Not specified",
    actual: raw(record, tl.actual),
    commentary: raw(record, tl.comment),
    updateDate: formatDate(raw(record, tl.updateDate)),
    reportingPeriod: join(raw(record, tl.reportingPeriodLookup)) || reportingPeriod,
    isSelectedPeriod: periodMatches(record, tl.reportingPeriodLookup),
  };
});

const tlUpdateRows = allTlUpdateRows.filter((row) => row.isSelectedPeriod);

const allSmUpdateRows = allSmUpdateRecords.map((record) => {
  const subRecord = subById.get(linkedIds(raw(record, sm.subLink))[0]);
  return {
    ...subContext(subRecord),
    recordId: record.id,
    subId: subRecord?.id || "",
    supportingOwner: join(raw(record, sm.owner)) || join(raw(subRecord, sub.owner)) || "Not specified",
    statusOwner: join(raw(record, sm.statusOwner)) || join(raw(subRecord, sub.statusOwner)) || "Not specified",
    status: join(raw(record, sm.status)) || "Not specified",
    actual: raw(record, sm.actual),
    commentary: raw(record, sm.comment),
    updateDate: formatDate(raw(record, sm.updateDate)),
    reportingPeriod: join(raw(record, sm.reportingPeriodLookup)) || reportingPeriod,
    isSelectedPeriod: periodMatches(record, sm.reportingPeriodLookup),
  };
});

const smUpdateRows = allSmUpdateRows.filter((row) => row.isSelectedPeriod);

function previousUpdate(row, allRows, idKey) {
  const sequence = allRows
    .filter((candidate) => candidate[idKey] && candidate[idKey] === row[idKey])
    .sort((a, b) => sortDate(a.updateDate) - sortDate(b.updateDate) || a.recordId.localeCompare(b.recordId));
  const index = sequence.findIndex((candidate) => candidate.recordId === row.recordId);
  return index > 0 ? sequence[index - 1] : null;
}

const topRows = latestBy(tlUpdateRows, (row) => row.topId)
  .map((row) => {
    const previous = previousUpdate(row, allTlUpdateRows, "topId");
    return {
      ...row,
      previousStatus: previous?.status || "",
      previousActual: previous?.actual || "",
      previousCommentary: previous?.commentary || "",
    };
  })
  .sort((a, b) => (a.order || 999) - (b.order || 999) || a.topMethod.localeCompare(b.topMethod));

const subRows = latestBy(smUpdateRows, (row) => row.subId)
  .map((row) => {
    const previous = previousUpdate(row, allSmUpdateRows, "subId");
    return {
      ...row,
      previousStatus: previous?.status || "",
      previousActual: previous?.actual || "",
      previousCommentary: previous?.commentary || "",
    };
  })
  .sort((a, b) => (a.order || 999) - (b.order || 999) || a.topMethod.localeCompare(b.topMethod) || a.subMethod.localeCompare(b.subMethod));

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
    fill: palette.header,
    font: { color: "#FFFFFF", bold: true, size: headingFontSize },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
  };
}

function statusColors(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("off track") || normalized.includes("delayed")) return { fill: "#FDECEC", text: "#A12622" };
  if (normalized.includes("risk")) return { fill: "#FFF4D8", text: "#8A5A00" };
  if (normalized.includes("complete") || normalized.includes("done")) return { fill: "#E6F0FF", text: "#1F4E78" };
  if (normalized.includes("track")) return { fill: "#E8F5E9", text: "#1B6B35" };
  return { fill: "#EEF2F6", text: "#52616F" };
}

function setColumnWidths(sheet, widths) {
  for (const [col, widthPx] of Object.entries(widths)) {
    sheet.getRange(`${col}:${col}`).format = {
      columnWidthPx: widthPx,
      font: { size: bodyFontSize },
      wrapText: true,
      verticalAlignment: "top",
    };
  }
}

function fullRowFormat(sheet, rowNumber, lastCol, format) {
  sheet.getRange(`A${rowNumber}:${lastCol}${rowNumber}`).format = {
    font: { size: bodyFontSize, color: palette.text },
    wrapText: true,
    verticalAlignment: "top",
    ...format,
  };
}

function applyWorkbookStandardStyles(sheet, headers, rowMeta, styleConfig) {
  const lastCol = numToCol(headers.length);
  let detailIndex = 0;
  rowMeta.forEach((meta, index) => {
    const rowNumber = index + 2;
    if (meta.type === "h2") {
      fullRowFormat(sheet, rowNumber, lastCol, {
        fill: palette.h2,
        font: { color: "#FFFFFF", bold: true, size: headingFontSize },
        horizontalAlignment: "left",
        verticalAlignment: "center",
        wrapText: true,
      });
      return;
    }
    if (meta.type === "top") {
      fullRowFormat(sheet, rowNumber, lastCol, {
        fill: palette.topLevel,
        font: { color: "#173A56", bold: true, size: bodyFontSize },
        horizontalAlignment: "left",
        verticalAlignment: "center",
        wrapText: true,
      });
      return;
    }

    fullRowFormat(sheet, rowNumber, lastCol, {
      fill: detailIndex % 2 === 0 ? palette.white : palette.alternate,
      font: { size: bodyFontSize, color: palette.text },
    });
    detailIndex += 1;

    if (styleConfig.currentRange) {
      sheet.getRange(`${styleConfig.currentRange[0]}${rowNumber}:${styleConfig.currentRange[1]}${rowNumber}`).format = {
        fill: palette.current,
        font: { size: bodyFontSize, color: palette.text },
        wrapText: true,
        verticalAlignment: "top",
      };
    }
    if (styleConfig.previousRange) {
      sheet.getRange(`${styleConfig.previousRange[0]}${rowNumber}:${styleConfig.previousRange[1]}${rowNumber}`).format = {
        fill: palette.previous,
        font: { size: bodyFontSize, color: palette.text },
        wrapText: true,
        verticalAlignment: "top",
      };
    }
    if (styleConfig.dateCol) {
      sheet.getRange(`${styleConfig.dateCol}${rowNumber}`).format = {
        fill: palette.date,
        font: { size: bodyFontSize, color: palette.muted },
        wrapText: true,
        verticalAlignment: "top",
      };
    }
    for (const [column, value] of [
      [styleConfig.currentStatusCol, meta.currentStatus],
      [styleConfig.previousStatusCol, meta.previousStatus],
    ]) {
      if (!column) continue;
      const colors = statusColors(value);
      sheet.getRange(`${column}${rowNumber}`).format = {
        fill: colors.fill,
        font: { color: colors.text, bold: true, size: bodyFontSize },
        horizontalAlignment: "center",
        verticalAlignment: "center",
        wrapText: true,
      };
    }
    if (styleConfig.methodCol) {
      sheet.getRange(`${styleConfig.methodCol}${rowNumber}`).format = {
        font: { size: bodyFontSize, color: palette.text, bold: true },
        wrapText: true,
        verticalAlignment: "top",
      };
    }
  });
}

function blankRow(width) {
  return Array.from({ length: width }, () => "");
}

function buildTopLevelSheetRows(rows) {
  const sheetRows = [];
  const meta = [];
  let currentH2Key = null;
  for (const row of rows) {
    const h2Key = `${row.order || ""}|${row.h2Value}`;
    if (h2Key !== currentH2Key) {
      const groupRow = blankRow(13);
      groupRow[0] = row.order;
      groupRow[1] = row.h2Value;
      sheetRows.push(groupRow);
      meta.push({ type: "h2" });
      currentH2Key = h2Key;
    }
    sheetRows.push([
      row.order,
      row.h2Value,
      row.topMethod,
      row.reportingPeriod,
      row.methodOwner,
      row.statusOwner,
      row.status,
      row.actual,
      row.commentary,
      row.previousStatus,
      row.previousActual,
      row.previousCommentary,
      row.updateDate,
    ]);
    meta.push({ type: "detail", currentStatus: row.status, previousStatus: row.previousStatus });
  }
  return { rows: sheetRows, meta };
}

function buildSubLevelSheetRows(rows) {
  const sheetRows = [];
  const meta = [];
  let currentH2Key = null;
  let currentTopMethod = null;
  for (const row of rows) {
    const h2Key = `${row.order || ""}|${row.h2Value}`;
    if (h2Key !== currentH2Key) {
      const groupRow = blankRow(14);
      groupRow[0] = row.order;
      groupRow[1] = row.h2Value;
      sheetRows.push(groupRow);
      meta.push({ type: "h2" });
      currentH2Key = h2Key;
      currentTopMethod = null;
    }
    if (row.topMethod !== currentTopMethod) {
      const topRow = blankRow(14);
      topRow[2] = `Top-Level Method: ${row.topMethod}`;
      sheetRows.push(topRow);
      meta.push({ type: "top" });
      currentTopMethod = row.topMethod;
    }
    sheetRows.push([
      row.order,
      row.h2Value,
      row.topMethod,
      row.subMethod,
      row.reportingPeriod,
      row.supportingOwner,
      row.statusOwner,
      row.status,
      row.actual,
      row.commentary,
      row.previousStatus,
      row.previousActual,
      row.previousCommentary,
      row.updateDate,
    ]);
    meta.push({ type: "detail", currentStatus: row.status, previousStatus: row.previousStatus });
  }
  return { rows: sheetRows, meta };
}

function writeSheet(name, headers, rows, widths, rowMeta, styleConfig) {
  const sheet = workbook.worksheets.add(name);
  setValues(sheet, "A1", [headers]);
  styleHeader(sheet.getRange(`A1:${numToCol(headers.length)}1`));
  if (rows.length) setValues(sheet, "A2", rows);
  try {
    sheet.freezePanes = { rows: 1 };
  } catch {}
  setColumnWidths(sheet, widths);
  applyWorkbookStandardStyles(sheet, headers, rowMeta, styleConfig);
  styleHeader(sheet.getRange(`A1:${numToCol(headers.length)}1`));
}

const topSheetRows = buildTopLevelSheetRows(topRows);
const subSheetRows = buildSubLevelSheetRows(subRows);

writeSheet(
  "Top-Level Methods",
  [
    "H2 Order",
    "H2 Value",
    "Top-Level Method",
    "Reporting Period",
    "Method Owner Name",
    "Status Owner",
    "Current Status",
    "Current Actual",
    "Current Commentary",
    "Previous Status",
    "Previous Actual",
    "Previous Commentary",
    "Status Update Date",
  ],
  topSheetRows.rows,
  { A: 85, B: 360, C: 420, D: 180, E: 220, F: 220, G: 150, H: 300, I: 520, J: 150, K: 300, L: 420, M: 170 },
  topSheetRows.meta,
  { currentRange: ["G", "I"], currentStatusCol: "G", previousRange: ["J", "L"], previousStatusCol: "J", dateCol: "M", methodCol: "C" },
);

writeSheet(
  "Sub-Level Methods",
  [
    "H2 Order",
    "H2 Value",
    "Top-Level Method",
    "Sub-Level Method",
    "Reporting Period",
    "Method Owner Name",
    "Status Owner",
    "Current Status",
    "Current Actual",
    "Current Commentary",
    "Previous Status",
    "Previous Actual",
    "Previous Commentary",
    "Status Update Date",
  ],
  subSheetRows.rows,
  { A: 85, B: 360, C: 390, D: 430, E: 180, F: 220, G: 220, H: 150, I: 300, J: 520, K: 150, L: 300, M: 420, N: 170 },
  subSheetRows.meta,
  { currentRange: ["H", "J"], currentStatusCol: "H", previousRange: ["K", "M"], previousStatusCol: "K", dateCol: "N", methodCol: "D" },
);

const topInspect = await workbook.inspect({
  kind: "table",
  range: "Top-Level Methods!A1:M8",
  include: "values",
  tableMaxRows: 10,
  tableMaxCols: 15,
});
console.log(topInspect.ndjson);

const subInspect = await workbook.inspect({
  kind: "table",
  range: "Sub-Level Methods!A1:N8",
  include: "values",
  tableMaxRows: 10,
  tableMaxCols: 16,
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

await workbook.render({ sheetName: "Top-Level Methods", range: "A1:M12", format: "png", scale: 2 });
await workbook.render({ sheetName: "Sub-Level Methods", range: "A1:N12", format: "png", scale: 2 });

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

console.log(JSON.stringify({ outputPath, sheets: ["Top-Level Methods", "Sub-Level Methods"], topRows: topRows.length, subRows: subRows.length }));
