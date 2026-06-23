import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const files = process.argv.slice(2);
if (!files.length) {
  throw new Error("Pass one or more .xlsx files to style.");
}

const bodyFontSize = 12;
const headingFontSize = 14;
const palette = {
  header: "#1F4E78",
  h2: "#245B89",
  topLevel: "#D9EAF7",
  current: "#EAF5F1",
  previous: "#FFF4D8",
  date: "#EEF2F6",
  white: "#FFFFFF",
  alternate: "#F7F9FB",
  titleText: "#1F4E78",
  text: "#1F2933",
  muted: "#52616F",
};

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

function statusColors(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("off track") || normalized.includes("delayed")) return { fill: "#FDECEC", text: "#A12622" };
  if (normalized.includes("risk")) return { fill: "#FFF4D8", text: "#8A5A00" };
  if (normalized.includes("complete") || normalized.includes("done")) return { fill: "#E6F0FF", text: "#1F4E78" };
  if (normalized.includes("track")) return { fill: "#E8F5E9", text: "#1B6B35" };
  return { fill: "#EEF2F6", text: "#52616F" };
}

function isBlank(value) {
  return value == null || String(value).trim() === "";
}

function usedBounds(values) {
  let rows = values.length;
  let cols = 0;
  for (const row of values) {
    row.forEach((value, index) => {
      if (!isBlank(value)) cols = Math.max(cols, index + 1);
    });
  }
  while (rows > 1 && (values[rows - 1] || []).every(isBlank)) rows -= 1;
  return { rows, cols: Math.max(cols, 1) };
}

function headerIndex(headers, names) {
  const wanted = Array.isArray(names) ? names : [names];
  return headers.findIndex((header) => wanted.includes(String(header || "").trim()));
}

function applyRangeFormat(sheet, address, format) {
  try {
    sheet.getRange(address).format = {
      font: { size: bodyFontSize, color: palette.text },
      wrapText: true,
      verticalAlignment: "top",
      ...format,
    };
  } catch {}
}

function rowLooksLikeH2Headline(row, headers) {
  const h2OrderIdx = headerIndex(headers, ["H2 Order", "Order"]);
  const h2ValueIdx = headerIndex(headers, ["H2 Value"]);
  if (h2OrderIdx < 0 || h2ValueIdx < 0) return false;
  if (isBlank(row[h2OrderIdx]) || isBlank(row[h2ValueIdx])) return false;
  return row.every((value, index) => index === h2OrderIdx || index === h2ValueIdx || isBlank(value));
}

function rowLooksLikeTopHeadline(row) {
  return row.some((value) => String(value || "").trim().startsWith("Top-Level Method:")) && row.filter((value) => !isBlank(value)).length === 1;
}

async function sheetValues(workbook, sheetName) {
  const inspect = await workbook.inspect({
    kind: "table",
    range: `${sheetName}!A1:AD1200`,
    include: "values",
    tableMaxRows: 1200,
    tableMaxCols: 30,
  });
  const table = JSON.parse(inspect.ndjson.split(/\r?\n/).find((line) => line.trim().startsWith("{")) || "{}");
  return table.values || [];
}

async function styleWorkbook(filePath) {
  const input = await FileBlob.load(filePath);
  const workbook = await SpreadsheetFile.importXlsx(input);

  for (const sheet of workbook.worksheets.items) {
    const values = await sheetValues(workbook, sheet.name);
    if (!values.length) continue;

    const { rows, cols } = usedBounds(values);
    const lastCol = numToCol(cols);
    const headers = values[0] || [];

    applyRangeFormat(sheet, `A1:${lastCol}1`, {
      fill: palette.header,
      font: { color: "#FFFFFF", bold: true, size: headingFontSize },
      horizontalAlignment: "center",
      verticalAlignment: "center",
      wrapText: true,
    });

    if (String(values[0]?.[0] || "").trim() && rows > 1 && String(sheet.name).toLowerCase().includes("overview")) {
      applyRangeFormat(sheet, "A1:AD1", {
        font: { color: palette.titleText, bold: true, size: headingFontSize },
        fill: palette.white,
        horizontalAlignment: "left",
      });
    }

    const currentStart = headerIndex(headers, ["Current Status"]);
    const currentEnd = headerIndex(headers, ["Current Commentary"]);
    const previousStart = headerIndex(headers, ["Previous Status"]);
    const previousEnd = headerIndex(headers, ["Previous Commentary"]);
    const currentStatus = headerIndex(headers, ["Current Status", "Status"]);
    const previousStatus = headerIndex(headers, ["Previous Status"]);
    const statusCol = headerIndex(headers, ["Status"]);
    const statusUpdateDate = headerIndex(headers, ["Status Update Date"]);
    const updateDate = headerIndex(headers, ["Update Date"]);
    const commentDate = headerIndex(headers, ["Comment Date"]);
    const methodCols = [
      headerIndex(headers, ["Top-Level Method", "Top Level Method"]),
      headerIndex(headers, ["Sub-Level Method", "Sub-Method"]),
    ].filter((index) => index >= 0);

    let detailRow = 0;
    for (let rowIndex = 1; rowIndex < rows; rowIndex += 1) {
      const rowNumber = rowIndex + 1;
      const row = values[rowIndex] || [];

      if (rowLooksLikeH2Headline(row, headers)) {
        applyRangeFormat(sheet, `A${rowNumber}:${lastCol}${rowNumber}`, {
          fill: palette.h2,
          font: { color: "#FFFFFF", bold: true, size: headingFontSize },
          horizontalAlignment: "left",
          verticalAlignment: "center",
        });
        continue;
      }

      if (rowLooksLikeTopHeadline(row)) {
        applyRangeFormat(sheet, `A${rowNumber}:${lastCol}${rowNumber}`, {
          fill: palette.topLevel,
          font: { color: "#173A56", bold: true, size: bodyFontSize },
          horizontalAlignment: "left",
          verticalAlignment: "center",
        });
        continue;
      }

      applyRangeFormat(sheet, `A${rowNumber}:${lastCol}${rowNumber}`, {
        fill: detailRow % 2 === 0 ? palette.white : palette.alternate,
      });
      detailRow += 1;

      if (currentStart >= 0 && currentEnd >= currentStart) {
        applyRangeFormat(sheet, `${numToCol(currentStart + 1)}${rowNumber}:${numToCol(currentEnd + 1)}${rowNumber}`, {
          fill: palette.current,
        });
      }
      if (previousStart >= 0 && previousEnd >= previousStart) {
        applyRangeFormat(sheet, `${numToCol(previousStart + 1)}${rowNumber}:${numToCol(previousEnd + 1)}${rowNumber}`, {
          fill: palette.previous,
        });
      }
      for (const index of [statusUpdateDate, updateDate, commentDate].filter((value) => value >= 0)) {
        applyRangeFormat(sheet, `${numToCol(index + 1)}${rowNumber}`, {
          fill: palette.date,
          font: { size: bodyFontSize, color: palette.muted },
        });
      }
      for (const index of [currentStatus, previousStatus, statusCol].filter((value, index, array) => value >= 0 && array.indexOf(value) === index)) {
        const colors = statusColors(row[index]);
        applyRangeFormat(sheet, `${numToCol(index + 1)}${rowNumber}`, {
          fill: colors.fill,
          font: { color: colors.text, bold: true, size: bodyFontSize },
          horizontalAlignment: "center",
          verticalAlignment: "center",
        });
      }
      for (const index of methodCols) {
        applyRangeFormat(sheet, `${numToCol(index + 1)}${rowNumber}`, {
          font: { color: palette.text, bold: true, size: bodyFontSize },
        });
      }
    }

    try {
      sheet.freezePanes = { rows: 1 };
    } catch {}
  }

  const errors = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
    options: { useRegex: true, maxResults: 50 },
    summary: "formula error scan",
  });
  const machineIds = await workbook.inspect({
    kind: "match",
    searchTerm: "\\b(?:rec|fld|usr|sel)[A-Za-z0-9]{14,}\\b",
    options: { useRegex: true, maxResults: 100 },
    summary: "machine id scan",
  });
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(filePath);

  return {
    filePath,
    sheets: workbook.worksheets.items.map((sheet) => sheet.name),
    errorScan: errors.ndjson,
    machineIdScan: machineIds.ndjson,
  };
}

const results = [];
for (const file of files) {
  results.push(await styleWorkbook(file));
}
console.log(JSON.stringify(results.map(({ filePath, sheets }) => ({ filePath, sheets })), null, 2));
