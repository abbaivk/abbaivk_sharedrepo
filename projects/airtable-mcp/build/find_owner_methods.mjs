import { execFileSync } from "node:child_process";
import path from "node:path";

const projectDir = "/Users/abbaivk/Documents/Codex Project/projects/airtable-mcp";
const workbookPath = path.join(projectDir, "outputs", "All H2 Values - Methods and Comments.xlsx");
const ownerName = process.argv.slice(2).join(" ").trim();
const commentMaxLength = Number(process.env.COMMENT_MAX_LENGTH || 260);

if (!ownerName) {
  console.error("Usage: node build/find_owner_methods.mjs <owner name>");
  process.exit(2);
}

function unzipText(entry) {
  return execFileSync("unzip", ["-p", workbookPath, entry], {
    encoding: "utf8",
    maxBuffer: 100 * 1024 * 1024,
  });
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

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function columnIndex(cellRef) {
  const letters = String(cellRef).match(/^[A-Z]+/)?.[0] || "";
  return [...letters].reduce((num, char) => num * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function stripTags(value) {
  return String(value || "").replace(/<[^>]*>/g, "");
}

function sharedStrings() {
  try {
    const xml = unzipText("xl/sharedStrings.xml");
    return [...xml.matchAll(/<[^:>]*:?si\b[^>]*>([\s\S]*?)<\/[^:>]*:?si>/g)].map((match) => {
      const texts = [...match[1].matchAll(/<[^:>]*:?t\b[^>]*>([\s\S]*?)<\/[^:>]*:?t>/g)].map((textMatch) => decodeXml(textMatch[1]));
      return texts.length ? texts.join("") : decodeXml(stripTags(match[1]));
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
    const attrs = match[1];
    const id = attrs.match(/\bId="([^"]+)"/)?.[1];
    const target = attrs.match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) relById[id] = target;
  }
  const out = {};
  for (const match of workbook.matchAll(/<[^:>]*:?sheet\b([^>]*)\/?>/g)) {
    const attrs = match[1];
    const name = decodeXml(attrs.match(/\bname="([^"]+)"/)?.[1] || "");
    const relationshipId = attrs.match(/\b(?:r:)?id="([^"]+)"/)?.[1];
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
    const texts = [...cellXml.matchAll(/<[^:>]*:?t\b[^>]*>([\s\S]*?)<\/[^:>]*:?t>/g)].map((match) => decodeXml(match[1]));
    return texts.join("");
  }
  const raw = cellXml.match(/<[^:>]*:?v>([\s\S]*?)<\/[^:>]*:?v>/)?.[1] || "";
  const decoded = decodeXml(raw);
  if (type === "s") return shared[Number(decoded)] || "";
  return decoded;
}

function rowsForSheet(sheetName) {
  const targets = sheetTargetsByName();
  if (!targets[sheetName]) throw new Error(`Missing sheet: ${sheetName}`);
  const xml = unzipText(targets[sheetName]);
  const rows = [];
  for (const rowMatch of xml.matchAll(/<[^:>]*:?row\b[^>]*>([\s\S]*?)<\/[^:>]*:?row>/g)) {
    const row = [];
    for (const cellMatch of rowMatch[1].matchAll(/<[^:>]*:?c\b([^>]*)>([\s\S]*?)<\/[^:>]*:?c>/g)) {
      const ref = cellMatch[1].match(/\br="([^"]+)"/)?.[1];
      if (!ref) continue;
      row[columnIndex(ref)] = cellValue(cellMatch[0]);
    }
    rows.push(row);
  }
  return rows;
}

function objectRows(sheetName) {
  const rows = rowsForSheet(sheetName);
  const headers = rows[0] || [];
  return rows
    .slice(1)
    .filter((row) => row.some((value) => String(value || "").trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
}

function parseDate(value) {
  const time = Date.parse(String(value || ""));
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
}

function sortedByLatest(rows) {
  return [...rows].sort((a, b) => parseDate(b["Update Date"]) - parseDate(a["Update Date"]));
}

function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function shorten(value) {
  const text = compact(value);
  if (!commentMaxLength || text.length <= commentMaxLength) return text;
  return `${text.slice(0, commentMaxLength - 3)}...`;
}

function pipeSafe(value) {
  return String(value || "").replaceAll("|", "\\|").replace(/\r?\n/g, "<br>");
}

function relatedTopUpdates(row, updates) {
  return updates.filter(
    (update) =>
      normalize(update["H2 Value"]) === normalize(row["H2 Value"]) &&
      normalize(update["Top-Level Method"]) === normalize(row["Top-Level Method"]),
  );
}

function relatedSubUpdates(row, updates) {
  return updates.filter(
    (update) =>
      normalize(update["H2 Value"]) === normalize(row["H2 Value"]) &&
      normalize(update["Top-Level Method"]) === normalize(row["Top-Level Method"]) &&
      normalize(update["Sub-Method"]) === normalize(row["Sub-Method"]),
  );
}

function latestFields(row, relatedUpdates) {
  const sorted = sortedByLatest(relatedUpdates);
  const latestUpdate = sorted[0] || null;
  const latestCommentUpdate = sorted.find((update) => compact(update.Commentary)) || latestUpdate;
  return {
    currentStatus: latestUpdate?.Status || row["Current Status"] || row["Previous Status"] || "",
    latestReportingPeriod: latestUpdate?.["Reporting Period"] || row["Reporting Period"] || "",
    latestUpdateDate: latestUpdate?.["Update Date"] || row["Status Update Date"] || "",
    latestComment: shorten(latestCommentUpdate?.Commentary || row["Current Commentary"] || row["Previous Commentary"] || ""),
  };
}

const topRows = objectRows("Top-Level Methods");
const subRows = objectRows("Sub-Methods");
const tlUpdates = objectRows("TL Dated Updates");
const smUpdates = objectRows("SM Dated Updates");

const owner = normalize(ownerName);
const matches = [
  ...topRows
    .filter((row) => normalize(row["Method Owner Name"]).includes(owner))
    .map((row) => ({
      type: "Top-Level Method",
      h2Value: row["H2 Value"],
      method: row["Top-Level Method"],
      owner: row["Method Owner Name"],
      ...latestFields(row, relatedTopUpdates(row, tlUpdates)),
    })),
  ...subRows
    .filter((row) => normalize(row["Owner - Supporting Method"]).includes(owner))
    .map((row) => ({
      type: "Sub-Method",
      h2Value: row["H2 Value"],
      method: row["Sub-Method"],
      owner: row["Owner - Supporting Method"],
      ...latestFields(row, relatedSubUpdates(row, smUpdates)),
    })),
].sort((a, b) => a.h2Value.localeCompare(b.h2Value) || a.type.localeCompare(b.type) || a.method.localeCompare(b.method));

console.log(`Owner/person lookup: ${ownerName}`);
console.log(`Matches: ${matches.length}`);
console.log("");
console.log("| Type | H2 Value | Method / Sub-Method | Current Status | Latest Reporting Period | Latest Comment |");
console.log("|---|---|---|---|---|---|");
for (const row of matches) {
  console.log(
    `| ${pipeSafe(row.type)} | ${pipeSafe(row.h2Value)} | ${pipeSafe(row.method)} | ${pipeSafe(row.currentStatus)} | ${pipeSafe(row.latestReportingPeriod)} | ${pipeSafe(row.latestComment)} |`,
  );
}
