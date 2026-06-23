import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const projectDir = "/Users/abbaivk/Documents/Codex Project/projects/airtable-mcp";
const proxy = path.join(projectDir, "build", "airtable-mcp-proxy.mjs");
const env = { ...process.env, AIRTABLE_MCP_CONFIG_FILE: path.join(projectDir, "config.json") };
const outputDir = path.join(projectDir, "outputs");
const outputPath = path.join(outputDir, "All H2 Values - Methods and Comments.xlsx");
const baseId = "appps1eduhJZPnFHD";
const bodyFontSize = 12;
const headingFontSize = 14;
const palette = {
  current: "#EAF5F1",
  previous: "#FFF4D8",
  date: "#EEF2F6",
  white: "#FFFFFF",
  alternate: "#F7F9FB",
  text: "#1F2933",
  muted: "#52616F",
};

function callTool(name, args, id = 2) {
  const messages = [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "all-h2-values-detail-extract", version: "0.1.0" },
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
const requiredTables = [
  "CX FY26 H2 Values",
  "Method Top Level",
  "Supporting Methods",
  "TL Update Table",
  "SM Update Table",
  "Feature Firas",
];
for (const table of requiredTables) {
  if (!tables[table]) throw new Error(`Missing required table: ${table}`);
}

function fieldByName(tableName) {
  return Object.fromEntries((tables[tableName].fields || []).map((field) => [field.name, field]));
}

const fieldMaps = Object.fromEntries(requiredTables.map((tableName) => [tableName, fieldByName(tableName)]));

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
  if (value.valuesByLinkedRecordId) {
    return Object.values(value.valuesByLinkedRecordId).flatMap((items) => flattenHuman(items));
  }
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

function value(record, tableName, fieldName, separator = "\n") {
  return join(flattenHuman(cell(record, tableName, fieldName)), separator);
}

function links(record, tableName, fieldName) {
  const raw = cell(record, tableName, fieldName);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && item.id)
    .map((item) => ({ id: item.id, name: item.name || "" }));
}

function lookupLinks(record, tableName, fieldName, linkedRecordId) {
  const raw = cell(record, tableName, fieldName);
  const vals = raw?.valuesByLinkedRecordId?.[linkedRecordId] || [];
  if (!Array.isArray(vals)) return [];
  return vals
    .filter((item) => item && item.id)
    .map((item) => ({ id: item.id, name: item.name || "" }));
}

function numberValue(record, tableName, fieldName) {
  const first = flattenHuman(cell(record, tableName, fieldName))[0];
  const parsed = Number(first);
  return Number.isFinite(parsed) ? parsed : null;
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

function sortDate(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

function formatDate(value) {
  if (!value) return "";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return String(value);
  return new Date(time).toISOString().replace("T", " ").slice(0, 16);
}

function updateTime(record, tableName) {
  const updateDate = value(record, tableName, "Update Date and Time");
  const time = Date.parse(updateDate);
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
}

function sortedUpdates(updates, tableName) {
  return updates
    .map((update, index) => ({ update, index }))
    .sort((a, b) => updateTime(a.update, tableName) - updateTime(b.update, tableName) || a.index - b.index)
    .map(({ update }) => update);
}

function hasTlUpdateData(update) {
  return ["Current Status", "Current Actual", "Current Commentary"].some((fieldName) =>
    cleanReportText(value(update, "TL Update Table", fieldName, "; ")),
  );
}

function tlUpdateSnapshot(update) {
  return {
    currentStatus: value(update, "TL Update Table", "Current Status", "; "),
    currentActual: value(update, "TL Update Table", "Current Actual"),
    currentCommentary: value(update, "TL Update Table", "Current Commentary"),
    statusUpdateDate: formatDate(value(update, "TL Update Table", "Update Date and Time")),
    reportingPeriod: value(update, "TL Update Table", "Reporting Period", "; "),
  };
}

function topLevelCurrentPrevious(updates, record) {
  const sorted = sortedUpdates(updates, "TL Update Table");
  let currentIndex = -1;
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    if (hasTlUpdateData(sorted[index])) {
      currentIndex = index;
      break;
    }
  }

  if (currentIndex === -1) {
    return {
      currentStatus: value(record, "Method Top Level", "Current Status", "; "),
      currentActual: value(record, "Method Top Level", "Current Actual"),
      currentCommentary: value(record, "Method Top Level", "Current Commentary"),
      previousStatus: value(record, "Method Top Level", "Previous Status", "; "),
      previousActual: value(record, "Method Top Level", "Previous Actual"),
      previousCommentary: value(record, "Method Top Level", "Previous Commentary"),
      statusUpdateDate: formatDate(value(record, "Method Top Level", "Status Update Date")),
      reportingPeriod: value(record, "Method Top Level", "Reporting Period", "; "),
    };
  }

  const current = tlUpdateSnapshot(sorted[currentIndex]);
  let previous = { currentStatus: "", currentActual: "", currentCommentary: "" };
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    if (hasTlUpdateData(sorted[index])) {
      previous = tlUpdateSnapshot(sorted[index]);
      break;
    }
  }

  return {
    currentStatus: current.currentStatus,
    currentActual: current.currentActual,
    currentCommentary: current.currentCommentary,
    previousStatus: previous.currentStatus,
    previousActual: previous.currentActual,
    previousCommentary: previous.currentCommentary,
    statusUpdateDate: current.statusUpdateDate,
    reportingPeriod: current.reportingPeriod,
  };
}

function hasSmUpdateData(update) {
  return ["Current Status", "Current Actual", "Current Commentary"].some((fieldName) =>
    cleanReportText(value(update, "SM Update Table", fieldName, "; ")),
  );
}

function smUpdateSnapshot(update) {
  return {
    currentStatus: value(update, "SM Update Table", "Current Status", "; "),
    currentActual: value(update, "SM Update Table", "Current Actual"),
    currentCommentary: value(update, "SM Update Table", "Current Commentary"),
    statusUpdateDate: formatDate(value(update, "SM Update Table", "Update Date and Time")),
    reportingPeriod: value(update, "SM Update Table", "Reporting Period", "; "),
  };
}

function subMethodCurrentPrevious(updates, record) {
  const sorted = sortedUpdates(updates, "SM Update Table");
  let currentIndex = -1;
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    if (hasSmUpdateData(sorted[index])) {
      currentIndex = index;
      break;
    }
  }

  if (currentIndex === -1) {
    return {
      currentStatus: value(record, "Supporting Methods", "Current Status", "; "),
      currentActual: value(record, "Supporting Methods", "Current Actual"),
      currentCommentary: value(record, "Supporting Methods", "Current Commentary"),
      previousStatus: value(record, "Supporting Methods", "Previous Status", "; "),
      previousActual: value(record, "Supporting Methods", "Previous Actual"),
      previousCommentary: value(record, "Supporting Methods", "Previous Commentary"),
      statusUpdateDate: formatDate(value(record, "Supporting Methods", "Status Update Date")),
      reportingPeriod: value(record, "Supporting Methods", "Reporting Period", "; "),
    };
  }

  const current = smUpdateSnapshot(sorted[currentIndex]);
  let previous = { currentStatus: "", currentActual: "", currentCommentary: "" };
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    if (hasSmUpdateData(sorted[index])) {
      previous = smUpdateSnapshot(sorted[index]);
      break;
    }
  }

  return {
    currentStatus: current.currentStatus,
    currentActual: current.currentActual,
    currentCommentary: current.currentCommentary,
    previousStatus: previous.currentStatus,
    previousActual: previous.currentActual,
    previousCommentary: previous.currentCommentary,
    statusUpdateDate: current.statusUpdateDate,
    reportingPeriod: current.reportingPeriod,
  };
}

const h2Records = listAllRecords("CX FY26 H2 Values");
const topRecords = listAllRecords("Method Top Level");
const subRecords = listAllRecords("Supporting Methods");
const tlUpdates = listAllRecords("TL Update Table");
const smUpdates = listAllRecords("SM Update Table");
const featureFiraRecords = listAllRecords("Feature Firas");

const topById = new Map(topRecords.map((record) => [record.id, record]));
const subById = new Map(subRecords.map((record) => [record.id, record]));
const featureFiraById = new Map(featureFiraRecords.map((record) => [record.id, record]));

function methodTitle(record) {
  return value(record, "Method Top Level", "Top Level Method");
}

function subTitle(record) {
  return value(record, "Supporting Methods", "Sub-Method");
}

function linkedIds(record, tableName, fieldName) {
  return links(record, tableName, fieldName).map((link) => link.id);
}

function updateLinkedTo(record, tableName, fieldName, id) {
  return linkedIds(record, tableName, fieldName).includes(id);
}

function firaValue(record, fieldName, separator = "; ") {
  const out = value(record, "Feature Firas", fieldName, separator);
  return out === "false" ? "" : out;
}

function firaLabel(record) {
  return firaValue(record, "FIRA") || firaValue(record, "Feature Name") || "Feature FIRA";
}

function featureFirasForSubMethod(sub) {
  const ids = new Set(links(sub, "Supporting Methods", "Feature Firas").map((link) => link.id));
  for (const fira of featureFiraRecords) {
    if (updateLinkedTo(fira, "Feature Firas", "Sub Method Link", sub.id)) ids.add(fira.id);
  }
  return [...ids]
    .map((id) => featureFiraById.get(id))
    .filter(Boolean)
    .sort((a, b) => firaLabel(a).localeCompare(firaLabel(b)));
}

function firaList(records, fieldName, { withLabel = false } = {}) {
  return records
    .map((record) => {
      const out = firaValue(record, fieldName);
      if (!out) return "";
      return withLabel ? `${firaLabel(record)}: ${out}` : out;
    })
    .filter(Boolean)
    .join("\n");
}

function firaSummary(records) {
  return {
    firaCount: records.length,
    firas: firaList(records, "FIRA"),
    firaFeatureNames: firaList(records, "Feature Name"),
    firaReleaseStatus: firaList(records, "Latest Release Quarter Status", { withLabel: true }),
    firaJiraStatus: firaList(records, "JIRA Status", { withLabel: true }),
    firaJiraFeatureState: firaList(records, "JIRA Feature State", { withLabel: true }),
    firaLatestUpdateQuarter: firaList(records, "JIRA Latest Update Quarter", { withLabel: true }),
    firaMarketAccess: firaList(records, "Market Access", { withLabel: true }),
    firaClusPayloadItems: firaList(records, "CLUS Payload Items", { withLabel: true }),
    firaClusPayloadItemsNew: firaList(records, "CLUS Payload Items NEW", { withLabel: true }),
  };
}

function h2Context(record) {
  return {
    order: numberValue(record, "CX FY26 H2 Values", "H2 Value Order") ?? numberValue(record, "CX FY26 H2 Values", "Value Order"),
    h2Value: value(record, "CX FY26 H2 Values", "H2 Values", "; ") || value(record, "CX FY26 H2 Values", "Value", "; "),
    group: value(record, "CX FY26 H2 Values", "Group", "; "),
    team: value(record, "CX FY26 H2 Values", "Team", "; "),
  };
}

const sortedH2Records = h2Records
  .map((record) => ({ record, context: h2Context(record) }))
  .filter((row) => row.context.h2Value)
  .sort((a, b) => (a.context.order ?? 999) - (b.context.order ?? 999) || a.context.h2Value.localeCompare(b.context.h2Value));

const topRows = [];
const subRows = [];
const tlUpdateRows = [];
const smUpdateRows = [];
const recordCommentRows = [];
const summaryByH2 = new Map();
const commentsCache = new Map();

function commentsFor(tableName, record) {
  const key = `${tableName}:${record.id}`;
  if (commentsCache.has(key)) return commentsCache.get(key);
  const table = tables[tableName];
  const comments = [];
  let offset;
  do {
    const page = callTool("list_record_comments", {
      baseId,
      tableId: table.id,
      recordId: record.id,
      pageSize: 100,
      ...(offset ? { offset } : {}),
    });
    comments.push(...(page.comments || []));
    offset = page.offset;
  } while (offset);
  commentsCache.set(key, comments);
  return comments;
}

for (const { record: h2Record, context } of sortedH2Records) {
  const topMethodLinks = links(h2Record, "CX FY26 H2 Values", "Methods Top Level");
  const selectedTopMethods = topMethodLinks.map((link) => topById.get(link.id)).filter(Boolean);
  const selectedSubMethodIds = new Set();
  let h2TlUpdateCount = 0;
  let h2SmUpdateCount = 0;
  let h2CommentCount = 0;

  for (const top of selectedTopMethods) {
    const h2SubLinks = lookupLinks(h2Record, "CX FY26 H2 Values", "Sub-Methods", top.id);
    const updates = tlUpdates.filter((update) => updateLinkedTo(update, "TL Update Table", "Top Level Method Link", top.id));
    const statusSnapshot = topLevelCurrentPrevious(updates, top);
    h2TlUpdateCount += updates.length;

    topRows.push({
      ...context,
      topMethod: methodTitle(top),
      owner: value(top, "Method Top Level", "Method Owner"),
      statusOwner: value(top, "Method Top Level", "Status Owner"),
      methodTeam: value(top, "Method Top Level", "Team", "; "),
      measure: value(top, "Method Top Level", "Measure Description"),
      fy26Measure: value(top, "Method Top Level", "FY26 Measure (Value)"),
      currentActual: statusSnapshot.currentActual,
      currentStatus: statusSnapshot.currentStatus,
      currentCommentary: statusSnapshot.currentCommentary,
      previousActual: statusSnapshot.previousActual,
      previousStatus: statusSnapshot.previousStatus,
      previousCommentary: statusSnapshot.previousCommentary,
      statusUpdateDate: statusSnapshot.statusUpdateDate,
      reportingPeriod: statusSnapshot.reportingPeriod,
      subMethodCount: h2SubLinks.length,
      updateCount: updates.length,
    });

    for (const update of updates) {
      tlUpdateRows.push({
        ...context,
        topMethod: methodTitle(top),
        updateDate: formatDate(value(update, "TL Update Table", "Update Date and Time")),
        reportingMonth: value(update, "TL Update Table", "Reporting Month", "; "),
        reportingPeriod: value(update, "TL Update Table", "Reporting Period", "; "),
        status: value(update, "TL Update Table", "Current Status", "; "),
        actual: value(update, "TL Update Table", "Current Actual"),
        commentary: value(update, "TL Update Table", "Current Commentary"),
        obstacles: value(update, "TL Update Table", "Obstacles NL"),
      });
    }

    for (const comment of commentsFor("Method Top Level", top)) {
      h2CommentCount += 1;
      recordCommentRows.push({
        ...context,
        recordType: "Top-Level Method",
        topMethod: methodTitle(top),
        subMethod: "",
        createdTime: formatDate(comment.createdTime || comment.createdAt),
        author: comment.author?.name || comment.createdBy?.name || "",
        text: comment.text || comment.body || "",
      });
    }

    for (const subLink of h2SubLinks) {
      selectedSubMethodIds.add(subLink.id);
      const sub = subById.get(subLink.id);
      if (!sub) continue;
      const subUpdates = smUpdates.filter((update) => updateLinkedTo(update, "SM Update Table", "Supporting Methods", sub.id));
      const subStatusSnapshot = subMethodCurrentPrevious(subUpdates, sub);
      const fira = firaSummary(featureFirasForSubMethod(sub));
      h2SmUpdateCount += subUpdates.length;

      subRows.push({
        ...context,
        topMethod: methodTitle(top),
        subMethod: subTitle(sub),
        owner: value(sub, "Supporting Methods", "Owner - Supporting Method"),
        statusOwner: value(sub, "Supporting Methods", "Status Owner"),
        team: value(sub, "Supporting Methods", "Team - Supporting Method", "; "),
        measure: value(sub, "Supporting Methods", "Measure Description"),
        fy26Measure: value(sub, "Supporting Methods", "FY26 Measure (Value)"),
        currentActual: subStatusSnapshot.currentActual,
        currentStatus: subStatusSnapshot.currentStatus,
        currentCommentary: subStatusSnapshot.currentCommentary,
        previousActual: subStatusSnapshot.previousActual,
        previousStatus: subStatusSnapshot.previousStatus,
        previousCommentary: subStatusSnapshot.previousCommentary,
        statusUpdateDate: subStatusSnapshot.statusUpdateDate,
        reportingPeriod: subStatusSnapshot.reportingPeriod,
        updateCount: subUpdates.length,
        ...fira,
      });

      for (const update of subUpdates) {
        smUpdateRows.push({
          ...context,
          topMethod: methodTitle(top),
          subMethod: subTitle(sub),
          updateDate: formatDate(value(update, "SM Update Table", "Update Date and Time")),
          reportingMonth: value(update, "SM Update Table", "Reporting Month", "; "),
          reportingPeriod: value(update, "SM Update Table", "Reporting Period", "; "),
          status: value(update, "SM Update Table", "Current Status", "; "),
          actual: value(update, "SM Update Table", "Current Actual"),
          commentary: value(update, "SM Update Table", "Current Commentary"),
          obstacles: value(update, "SM Update Table", "Obstacles"),
        });
      }
    }
  }

  for (const subId of selectedSubMethodIds) {
    const sub = subById.get(subId);
    if (!sub) continue;
    const parent = selectedTopMethods
      .filter((top) => linkedIds(sub, "Supporting Methods", "Method Top Level").includes(top.id))
      .map((top) => methodTitle(top))
      .find((title) => title) || "";
    for (const comment of commentsFor("Supporting Methods", sub)) {
      h2CommentCount += 1;
      recordCommentRows.push({
        ...context,
        recordType: "Sub-Method",
        topMethod: parent,
        subMethod: subTitle(sub),
        createdTime: formatDate(comment.createdTime || comment.createdAt),
        author: comment.author?.name || comment.createdBy?.name || "",
        text: comment.text || comment.body || "",
      });
    }
  }

  summaryByH2.set(context.h2Value, {
    ...context,
    topMethodCount: selectedTopMethods.length,
    subMethodCount: selectedSubMethodIds.size,
    tlUpdateCount: h2TlUpdateCount,
    smUpdateCount: h2SmUpdateCount,
    commentCount: h2CommentCount,
  });
}

tlUpdateRows.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.topMethod.localeCompare(b.topMethod) || sortDate(a.updateDate) - sortDate(b.updateDate));
smUpdateRows.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.topMethod.localeCompare(b.topMethod) || a.subMethod.localeCompare(b.subMethod) || sortDate(a.updateDate) - sortDate(b.updateDate));
recordCommentRows.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.topMethod.localeCompare(b.topMethod) || a.subMethod.localeCompare(b.subMethod) || sortDate(a.createdTime) - sortDate(b.createdTime));

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

function statusColors(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("off track") || normalized.includes("delayed")) return { fill: "#FDECEC", text: "#A12622" };
  if (normalized.includes("risk")) return { fill: "#FFF4D8", text: "#8A5A00" };
  if (normalized.includes("complete") || normalized.includes("done")) return { fill: "#E6F0FF", text: "#1F4E78" };
  if (normalized.includes("track")) return { fill: "#E8F5E9", text: "#1B6B35" };
  return { fill: "#EEF2F6", text: "#52616F" };
}

function headerIndex(headers, names) {
  const wanted = Array.isArray(names) ? names : [names];
  return headers.findIndex((header) => wanted.includes(header));
}

function formatRange(sheet, address, format) {
  sheet.getRange(address).format = {
    font: { size: bodyFontSize, color: palette.text },
    wrapText: true,
    verticalAlignment: "top",
    ...format,
  };
}

function applyStandardColorCoding(sheet, headers, rows) {
  const currentStart = headerIndex(headers, "Current Status");
  const currentEnd = headerIndex(headers, "Current Commentary");
  const previousStart = headerIndex(headers, "Previous Status");
  const previousEnd = headerIndex(headers, "Previous Commentary");
  const currentStatus = headerIndex(headers, ["Current Status", "Status"]);
  const previousStatus = headerIndex(headers, "Previous Status");
  const status = headerIndex(headers, "Status");
  const dateColumns = ["Status Update Date", "Update Date", "Comment Date"].map((name) => headerIndex(headers, name)).filter((index) => index >= 0);
  const methodColumns = ["Top-Level Method", "Sub-Method"].map((name) => headerIndex(headers, name)).filter((index) => index >= 0);

  for (let index = 0; index < rows.length; index += 1) {
    const rowNumber = index + 2;
    const row = rows[index] || [];
    formatRange(sheet, `A${rowNumber}:${numToCol(headers.length)}${rowNumber}`, {
      fill: index % 2 === 0 ? palette.white : palette.alternate,
    });
    if (currentStart >= 0 && currentEnd >= currentStart) {
      formatRange(sheet, `${numToCol(currentStart + 1)}${rowNumber}:${numToCol(currentEnd + 1)}${rowNumber}`, { fill: palette.current });
    }
    if (previousStart >= 0 && previousEnd >= previousStart) {
      formatRange(sheet, `${numToCol(previousStart + 1)}${rowNumber}:${numToCol(previousEnd + 1)}${rowNumber}`, { fill: palette.previous });
    }
    for (const column of dateColumns) {
      formatRange(sheet, `${numToCol(column + 1)}${rowNumber}`, {
        fill: palette.date,
        font: { size: bodyFontSize, color: palette.muted },
      });
    }
    for (const column of [currentStatus, previousStatus, status].filter((value, idx, arr) => value >= 0 && arr.indexOf(value) === idx)) {
      const colors = statusColors(row[column]);
      formatRange(sheet, `${numToCol(column + 1)}${rowNumber}`, {
        fill: colors.fill,
        font: { color: colors.text, bold: true, size: bodyFontSize },
        horizontalAlignment: "center",
        verticalAlignment: "center",
      });
    }
    for (const column of methodColumns) {
      formatRange(sheet, `${numToCol(column + 1)}${rowNumber}`, {
        font: { color: palette.text, bold: true, size: bodyFontSize },
      });
    }
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
  applyStandardColorCoding(sheet, headers, rows);
  styleHeader(sheet.getRange(`A1:${numToCol(headers.length)}1`));
  return sheet;
}

const overview = workbook.worksheets.add("Overview");
setValues(overview, "A1", [["All H2 Values - Methods and Comments"]]);
styleTitle(overview.getRange("A1"));
setValues(overview, "A3", [
  ["Report Summary", "Value"],
  ["Base", "CX FY26 V2MOM - NEW"],
  ["Source table", "CX FY26 H2 Values"],
  ["H2 Values", sortedH2Records.length],
  ["Top-Level Method Rows", topRows.length],
  ["Sub-Method Rows", subRows.length],
  ["Dated Top-Level Update Rows", tlUpdateRows.length],
  ["Dated Sub-Method Update Rows", smUpdateRows.length],
  ["Airtable Record Comments", recordCommentRows.length],
  ["Extraction Note", "All H2 values are expanded into the same method, sub-method, dated update, and Airtable record comment structure used by the Retain On-Prem report."],
]);
styleHeader(overview.getRange("A3:B3"));
setValues(overview, "A15", [["H2 Value Summary"]]);
styleTitle(overview.getRange("A15"));
setValues(overview, "A17", [["H2 Order", "H2 Value", "Group", "Team", "Top-Level Methods", "Sub-Methods", "TL Updates", "SM Updates", "Record Comments"]]);
styleHeader(overview.getRange("A17:I17"));
setValues(
  overview,
  "A18",
  [...summaryByH2.values()].map((row) => [
    row.order,
    row.h2Value,
    row.group,
    row.team,
    row.topMethodCount,
    row.subMethodCount,
    row.tlUpdateCount,
    row.smUpdateCount,
    row.commentCount,
  ]),
);
setColumnWidths(overview, { A: 90, B: 430, C: 260, D: 260, E: 150, F: 130, G: 120, H: 120, I: 140 });
styleTitle(overview.getRange("A1"));
styleHeader(overview.getRange("A3:B3"));
styleTitle(overview.getRange("A15"));
styleHeader(overview.getRange("A17:I17"));

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
    row.firas,
    row.firaFeatureNames,
    row.firaReleaseStatus,
    row.firaJiraStatus,
    row.firaJiraFeatureState,
    row.firaLatestUpdateQuarter,
    row.firaMarketAccess,
    row.firaClusPayloadItems,
    row.firaClusPayloadItemsNew,
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
    I: 420,
    J: 360,
    K: 150,
    L: 280,
    M: 420,
    N: 150,
    O: 280,
    P: 420,
    Q: 160,
    R: 180,
    S: 120,
    T: 110,
    U: 180,
    V: 420,
    W: 320,
    X: 260,
    Y: 220,
    Z: 260,
    AA: 220,
    AB: 220,
    AC: 260,
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
  recordCommentRows.length
    ? recordCommentRows.map((row) => [row.order, row.h2Value, row.recordType, row.topMethod, row.subMethod, row.createdTime, row.author, row.text])
    : [["No Airtable record comments found", "", "", "", "", "", "", ""]],
  { A: 90, B: 360, C: 180, D: 420, E: 420, F: 170, G: 220, H: 520 },
);

const overviewInspect = await workbook.inspect({
  kind: "table",
  range: "Overview!A1:I25",
  include: "values",
  tableMaxRows: 27,
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
  range: "Sub-Methods!A1:AC8",
  include: "values",
  tableMaxRows: 10,
  tableMaxCols: 30,
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

await workbook.render({ sheetName: "Overview", range: "A1:I25", format: "png", scale: 2 });
await workbook.render({ sheetName: "Top-Level Methods", range: "A1:T8", format: "png", scale: 2 });
await workbook.render({ sheetName: "Sub-Methods", range: "A1:AD8", format: "png", scale: 2 });
await workbook.render({ sheetName: "TL Dated Updates", range: "A1:J12", format: "png", scale: 2 });
await workbook.render({ sheetName: "SM Dated Updates", range: "A1:K12", format: "png", scale: 2 });
await workbook.render({ sheetName: "Airtable Record Comments", range: "A1:H8", format: "png", scale: 2 });

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

console.log(
  JSON.stringify({
    outputPath,
    sheets: workbook.worksheets.items.map((sheet) => sheet.name),
    h2Values: sortedH2Records.length,
    topLevelMethods: topRows.length,
    subMethods: subRows.length,
    tlDatedUpdates: tlUpdateRows.length,
    smDatedUpdates: smUpdateRows.length,
    airtableRecordComments: recordCommentRows.length,
  }),
);
