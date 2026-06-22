#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const readline = require("node:readline");

const ENDPOINT = process.env.AIRTABLE_MCP_ENDPOINT || "https://mcp.airtable.com/mcp";
const SERVICE = process.env.AIRTABLE_MCP_KEYCHAIN_SERVICE || "codex-airtable-mcp-token";
const CONFIG_FILE =
  process.env.AIRTABLE_MCP_CONFIG_FILE ||
  path.join(os.homedir(), ".codex", "airtable-mcp", "config.json");
const ACCOUNT =
  process.env.AIRTABLE_MCP_KEYCHAIN_ACCOUNT ||
  process.env.USER ||
  spawnSync("/usr/bin/id", ["-un"], { encoding: "utf8" }).stdout.trim();

let cachedToken = "";

function getToken() {
  if (cachedToken) return cachedToken;

  const envToken = process.env.AIRTABLE_MCP_PAT || process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
  if (envToken && envToken.trim()) {
    cachedToken = normalizeToken(envToken.trim());
    return cachedToken;
  }

  const configToken = readConfigToken();
  if (configToken) {
    cachedToken = normalizeToken(configToken);
    return cachedToken;
  }

  const result = spawnSync(
    "/usr/bin/security",
    ["find-generic-password", "-a", ACCOUNT, "-s", SERVICE, "-w"],
    { encoding: "utf8" },
  );

  if (result.status !== 0 || !result.stdout.trim()) {
    throw new Error(`Missing Keychain item: ${SERVICE} for account ${ACCOUNT}`);
  }

  cachedToken = result.stdout.trim();
  return cachedToken;
}

function normalizeToken(token) {
  return token.replace(/^Bearer\s+/i, "").trim();
}

function readConfigToken() {
  if (!fs.existsSync(CONFIG_FILE)) return "";

  const stat = fs.statSync(CONFIG_FILE);
  if ((stat.mode & 0o077) !== 0) {
    throw new Error(`Refusing to read ${CONFIG_FILE}; set permissions to 600`);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  const token =
    config.pat ||
    config.token ||
    config.personalAccessToken ||
    config.authorization ||
    "";

  return String(token).trim();
}

function parseMcpResponse(text) {
  const data = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  return JSON.parse(data || text);
}

async function forward(message) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-06-18",
    },
    body: JSON.stringify(message),
  });

  if (response.status === 202) return null;

  const text = await response.text();
  if (!response.ok) {
    const id = Object.prototype.hasOwnProperty.call(message, "id") ? message.id : null;
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32000,
        message: `Airtable MCP HTTP ${response.status}: ${text.slice(0, 500)}`,
      },
    };
  }

  return parseMcpResponse(text);
}

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on("line", async (line) => {
  if (!line.trim()) return;

  let message;
  try {
    message = JSON.parse(line);
  } catch {
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      })}\n`,
    );
    return;
  }

  try {
    const result = await forward(message);
    if (result) process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    if (Object.prototype.hasOwnProperty.call(message, "id")) {
      process.stdout.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: message.id,
          error: { code: -32000, message: error.message },
        })}\n`,
      );
    } else {
      process.stderr.write(`${error.message}\n`);
    }
  }
});
