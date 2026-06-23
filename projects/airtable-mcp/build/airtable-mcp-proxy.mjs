#!/Users/abbaivk/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const projectDir = "/Users/abbaivk/Documents/Codex Project/projects/airtable-mcp";
const endpoint = "https://mcp.airtable.com/mcp";
const configPath = process.env.AIRTABLE_MCP_CONFIG_FILE || path.join(projectDir, "config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const token = config.pat || config.AIRTABLE_MCP_PAT || config.AIRTABLE_PERSONAL_ACCESS_TOKEN;

if (!token) {
  throw new Error(`Missing Airtable token in ${configPath}`);
}

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

async function forward(message) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(message),
  });
  const text = await response.text();
  if (!response.ok) {
    return {
      jsonrpc: "2.0",
      id: message.id,
      error: { code: response.status, message: text.slice(0, 1000) },
    };
  }
  return parseMcpText(text);
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

for await (const line of rl) {
  if (!line.trim()) continue;
  const message = JSON.parse(line);
  if (message.id == null) continue;
  try {
    const response = await forward(message);
    if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: message.id,
        error: { code: -32000, message: error instanceof Error ? error.message : String(error) },
      })}\n`,
    );
  }
}
