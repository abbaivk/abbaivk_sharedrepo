import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const uiPath = "/Users/abbaivk/Library/CloudStorage/OneDrive-Cisco/Mac_Backup/Downloads/Manali - Airtable Info.xlsx";
const generatedPath = "/Users/abbaivk/Documents/Codex Project/projects/airtable-mcp/outputs/All H2 Values - Methods and Comments.xlsx";
const outputPath = "/Users/abbaivk/Documents/Codex Project/projects/airtable-mcp/outputs/Manali Airtable UI Gap Analysis.xlsx";

const palette = {
  header: "#1F4E78",
  subHeader: "#D9EAF7",
  ok: "#E8F5E9",
  warning: "#FFF4D8",
  issue: "#FDECEC",
  neutral: "#EEF2F6",
  text: "#1F2933",
  white: "#FFFFFF",
};

function normalize(value) {
  return String(value ?? "")
    .replaceAll("\u200b", "")
    .replaceAll("\u00a0", " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function clean(value) {
  return String(value ?? "")
    .replaceAll("\u200b", "")
    .replaceAll("\u00a0", " ")
    .trim();
}

async function tableRows(path, sheetName) {
  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(path));
  const sheet = workbook.worksheets.getItem(sheetName);
  const values = sheet.getUsedRange().values;
  const headers = values[0].map((value) => clean(value));
  const rows = values
    .slice(1)
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])))
    .filter((row) => Object.values(row).some((value) => clean(value)));
  return { headers, rows };
}

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
  const start = startCell.match(/^([A-Z]+)(\d+)$/);
  const startCol = colToNum(start[1]);
  const startRow = Number(start[2]);
  const endCol = numToCol(startCol + matrix[0].length - 1);
  const endRow = startRow + matrix.length - 1;
  const range = sheet.getRange(`${startCell}:${endCol}${endRow}`);
  range.values = matrix;
  range.format = {
    font: { size: 11, color: palette.text },
    wrapText: true,
    verticalAlignment: "top",
  };
}

function styleHeader(sheet, row, colCount) {
  sheet.getRange(`A${row}:${numToCol(colCount)}${row}`).format = {
    fill: palette.header,
    font: { color: palette.white, bold: true, size: 12 },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
  };
}

function styleRows(sheet, startRow, rowCount, colCount, fillsByResult = new Map()) {
  for (let index = 0; index < rowCount; index += 1) {
    const rowNumber = startRow + index;
    const fill = fillsByResult.get(rowNumber) || (index % 2 === 0 ? palette.white : "#F7F9FB");
    sheet.getRange(`A${rowNumber}:${numToCol(colCount)}${rowNumber}`).format = {
      fill,
      font: { size: 11, color: palette.text },
      wrapText: true,
      verticalAlignment: "top",
    };
  }
}

function setColumnWidths(sheet, widths) {
  for (const [col, widthPx] of Object.entries(widths)) {
    sheet.getRange(`${col}:${col}`).format = {
      columnWidthPx: widthPx,
      font: { size: 11, color: palette.text },
      wrapText: true,
      verticalAlignment: "top",
    };
  }
}

const ui = await tableRows(uiPath, "Sheet1");
const generated = await tableRows(generatedPath, "Sub-Methods");
const generatedBySubMethod = new Map(generated.rows.map((row) => [normalize(row["Sub-Method"]), row]));

const fieldPairs = [
  ["Method Top Level", "Top-Level Method"],
  ["Owner - Supporting Method", "Owner - Supporting Method"],
  ["Measure Description", "Measure Description"],
  ["FY26 Measure (Value)", "FY26 Measure"],
  ["Team - Supporting Method", "Team"],
  ["Status Owner", "Status Owner"],
];

const comparisonRows = [];
const fieldIssues = [];
for (const uiRow of ui.rows) {
  const subMethod = clean(uiRow["Sub-Method"]);
  const generatedRow = generatedBySubMethod.get(normalize(subMethod));
  if (!generatedRow) {
    comparisonRows.push([
      subMethod,
      clean(uiRow["Method Top Level"]),
      "",
      clean(uiRow["Owner - Supporting Method"]),
      "",
      clean(uiRow["Team - Supporting Method"]),
      "",
      clean(uiRow["Status Owner"]),
      "",
      "Missing from generated",
      clean(uiRow["Method Top Level"])
        ? "Sub-method was present in UI workbook but not present in the H2-linked all-H2 extract."
        : "UI row has no Method Top Level value; the all-H2 workbook follows H2 -> Top-Level Method -> Sub-Method links.",
    ]);
    continue;
  }

  const mismatches = fieldPairs
    .map(([uiField, generatedField]) => ({
      uiField,
      generatedField,
      uiValue: clean(uiRow[uiField]),
      generatedValue: clean(generatedRow[generatedField]),
    }))
    .filter((item) => normalize(item.uiValue) !== normalize(item.generatedValue));

  for (const item of mismatches) {
    fieldIssues.push([subMethod, item.uiField, item.generatedField, item.uiValue, item.generatedValue]);
  }

  comparisonRows.push([
    subMethod,
    clean(uiRow["Method Top Level"]),
    clean(generatedRow["Top-Level Method"]),
    clean(uiRow["Owner - Supporting Method"]),
    clean(generatedRow["Owner - Supporting Method"]),
    clean(uiRow["Team - Supporting Method"]),
    clean(generatedRow["Team"]),
    clean(uiRow["Status Owner"]),
    clean(generatedRow["Status Owner"]),
    mismatches.length ? "Mismatch" : "Match",
    mismatches.length ? `${mismatches.length} mapped field(s) differ.` : "Mapped fields align after Team source update.",
  ]);
}

const uiOnlyColumns = ui.headers.filter(
  (header) =>
    !generated.headers.includes(header) &&
    !["Method Top Level", "FY26 Measure (Value)", "Team - Supporting Method"].includes(header),
);

const missingRows = comparisonRows.filter((row) => row[9] === "Missing from generated");
const mismatchRows = comparisonRows.filter((row) => row[9] === "Mismatch");

const workbook = Workbook.create();

const summary = workbook.worksheets.add("Summary");
const summaryRows = [
  ["Manali Airtable UI Gap Analysis", ""],
  ["Source UI workbook", uiPath],
  ["Generated workbook", generatedPath],
  ["UI rows reviewed", ui.rows.length],
  ["Generated sub-method rows", generated.rows.length],
  ["Matched UI rows", ui.rows.length - missingRows.length],
  ["Missing UI rows in generated workbook", missingRows.length],
  ["Rows with mapped-field mismatches after fix", mismatchRows.length],
  ["UI-only fields not in all-H2 Sub-Methods sheet", uiOnlyColumns.join("; ") || "None"],
  ["Team source standard", "Sub-method Team is now sourced from Airtable Supporting Methods -> Team - Supporting Method."],
];
setValues(summary, "A1", summaryRows);
summary.getRange("A1:B1").format = {
  fill: palette.header,
  font: { color: palette.white, bold: true, size: 14 },
  wrapText: true,
};
summary.getRange("A2:A10").format = {
  fill: palette.subHeader,
  font: { bold: true, size: 11, color: palette.text },
  wrapText: true,
  verticalAlignment: "top",
};
setColumnWidths(summary, { A: 300, B: 780 });

const comparison = workbook.worksheets.add("Row Comparison");
const comparisonHeaders = [
  "Sub-Method",
  "UI Method Top Level",
  "Generated Top-Level Method",
  "UI Owner - Supporting Method",
  "Generated Owner - Supporting Method",
  "UI Team - Supporting Method",
  "Generated Team",
  "UI Status Owner",
  "Generated Status Owner",
  "Result",
  "Notes",
];
setValues(comparison, "A1", [comparisonHeaders, ...comparisonRows]);
styleHeader(comparison, 1, comparisonHeaders.length);
const rowFills = new Map();
comparisonRows.forEach((row, index) => {
  const rowNumber = index + 2;
  if (row[9] === "Match") rowFills.set(rowNumber, palette.ok);
  if (row[9] === "Mismatch") rowFills.set(rowNumber, palette.warning);
  if (row[9] === "Missing from generated") rowFills.set(rowNumber, palette.issue);
});
styleRows(comparison, 2, comparisonRows.length, comparisonHeaders.length, rowFills);
setColumnWidths(comparison, {
  A: 520,
  B: 320,
  C: 340,
  D: 220,
  E: 220,
  F: 230,
  G: 230,
  H: 220,
  I: 220,
  J: 170,
  K: 520,
});

const gaps = workbook.worksheets.add("Field Gaps");
const gapHeaders = ["Gap Type", "Field / Row", "Status", "Notes"];
const gapRows = [
  ["Corrected mapping", "Team", "Fixed", "Generated Sub-Methods Team now uses Team - Supporting Method rather than H2 Team."],
  ...missingRows.map((row) => ["Missing row", row[0], "Open", row[10]]),
  ...uiOnlyColumns.map((column) => [
    "UI-only field",
    column,
    "Not in all-H2 Sub-Methods columns",
    "Present in the UI export but not captured as a column in the all-H2 detailed workbook.",
  ]),
  ...(fieldIssues.length
    ? fieldIssues.map(([subMethod, uiField, generatedField, uiValue, generatedValue]) => [
        "Mapped-field mismatch",
        subMethod,
        "Open",
        `${uiField} (${uiValue}) differs from ${generatedField} (${generatedValue}).`,
      ])
    : [["Mapped-field mismatch", "Compared fields", "None after fix", "Mapped fields align for the 10 UI rows present in the generated workbook."]]),
];
setValues(gaps, "A1", [gapHeaders, ...gapRows]);
styleHeader(gaps, 1, gapHeaders.length);
const gapFills = new Map();
gapRows.forEach((row, index) => {
  const rowNumber = index + 2;
  if (row[2] === "Fixed" || row[2] === "None after fix") gapFills.set(rowNumber, palette.ok);
  if (row[2] === "Open" || row[2] === "Not in all-H2 Sub-Methods columns") gapFills.set(rowNumber, palette.warning);
});
styleRows(gaps, 2, gapRows.length, gapHeaders.length, gapFills);
setColumnWidths(gaps, { A: 210, B: 520, C: 240, D: 650 });

for (const sheet of workbook.worksheets.items) {
  try {
    sheet.freezePanes = { rows: 1 };
  } catch {}
  try {
    sheet.showGridLines = false;
  } catch {}
}

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 50 },
  summary: "formula error scan",
});
console.log(errors.ndjson);

await workbook.render({ sheetName: "Summary", range: "A1:B10", format: "png", scale: 2 });
await workbook.render({ sheetName: "Row Comparison", range: "A1:K12", format: "png", scale: 2 });
await workbook.render({ sheetName: "Field Gaps", range: "A1:D8", format: "png", scale: 2 });

await fs.mkdir("/Users/abbaivk/Documents/Codex Project/projects/airtable-mcp/outputs", { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

console.log(
  JSON.stringify({
    outputPath,
    uiRows: ui.rows.length,
    generatedSubMethodRows: generated.rows.length,
    matchedRows: ui.rows.length - missingRows.length,
    missingRows: missingRows.length,
    mappedFieldMismatchRows: mismatchRows.length,
    uiOnlyColumns,
  }),
);
