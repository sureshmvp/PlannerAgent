#!/usr/bin/env node

/**
 * Smart CLI — accepts natural language prompts to create work items in Azure DevOps.
 *
 * Usage:
 *   npm run go "Create user stories from devops-backlog.json"
 *   npm run go "Create user stories from the data in input.json"
 *   npm run go -- --file devops-backlog.json
 *   cat devops-backlog.json | npm run go "Create user stories"
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";

import { azureDevOpsMcpClient, resolveAzureDevOpsMcpConfig } from "./clients/azureDevOpsMcpClient";

dotenv.config();

// ─── Types ───────────────────────────────────────────────────────────────────

type WorkItemType = "User Story" | "Bug" | "Task" | "Feature" | "Epic";

type BacklogItem = {
  order?: number;
  title: string;
  state?: string;
  description?: string;
  type?: string;
  acceptanceCriteria?: string[];
  estimate?: number;
};

type CreatedItem = {
  order: number | undefined;
  id: number | string;
  title: string;
  type: string;
  url: string;
  webUrl: string;
};

// ─── Intent Detection ────────────────────────────────────────────────────────

interface DetectedIntent {
  action: "create";
  workItemType: WorkItemType;
  jsonFilePath: string | null;
  iterationPath: string | null;
}

const WORK_ITEM_TYPE_MAP: Record<string, WorkItemType> = {
  "user story": "User Story",
  "user stories": "User Story",
  "userstory": "User Story",
  "userstories": "User Story",
  "story": "User Story",
  "stories": "User Story",
  "bug": "Bug",
  "bugs": "Bug",
  "task": "Task",
  "tasks": "Task",
  "feature": "Feature",
  "features": "Feature",
  "epic": "Epic",
  "epics": "Epic",
  "backlog item": "User Story",
  "backlog items": "User Story",
  "backlog": "User Story",
  "work item": "User Story",
  "work items": "User Story",
  "item": "User Story",
  "items": "User Story",
  "pbi": "User Story",
  "pbis": "User Story",
};

function detectWorkItemType(prompt: string): WorkItemType {
  const lower = prompt.toLowerCase();
  // Check longest phrases first
  const sorted = Object.keys(WORK_ITEM_TYPE_MAP).sort((a, b) => b.length - a.length);
  for (const phrase of sorted) {
    if (lower.includes(phrase)) {
      return WORK_ITEM_TYPE_MAP[phrase]!;
    }
  }
  return "User Story"; // default
}

function detectJsonFile(prompt: string, cliFile?: string): string | null {
  // 1. Explicit --file flag wins
  if (cliFile) {
    return resolveFilePath(cliFile);
  }

  // 2. Look for a filename mentioned in the prompt
  const filePatterns = [
    /(?:from|in|using|file|read|load|parse)\s+(?:the\s+)?(?:data\s+(?:in|from|of)\s+)?["']?([^\s"']+\.json)["']?/i,
    /["']([^\s"']+\.json)["']/i,
    /(\S+\.json)\b/i,
  ];

  for (const pattern of filePatterns) {
    const match = prompt.match(pattern);
    if (match?.[1]) {
      return resolveFilePath(match[1]);
    }
  }

  // 3. Fall back to well-known files
  const defaultFiles = ["devops-backlog.json", "input.json", "backlog.json"];
  for (const f of defaultFiles) {
    const full = path.resolve(process.cwd(), f);
    if (fs.existsSync(full)) {
      return full;
    }
  }

  return null;
}

function detectIterationPath(prompt: string, cliSprint?: string): string | null {
  if (cliSprint) return cliSprint;

  const sprintMatch = prompt.match(/(?:sprint|iteration)\s+["']?([^\s"',]+)["']?/i);
  return sprintMatch?.[1] ?? null;
}

function resolveFilePath(raw: string): string {
  const abs = path.resolve(process.cwd(), raw);
  if (!fs.existsSync(abs)) {
    throw new Error(`File not found: ${raw} (looked at ${abs})`);
  }
  return abs;
}

function detectIntent(prompt: string, flags: Record<string, string>): DetectedIntent {
  return {
    action: "create",
    workItemType: detectWorkItemType(prompt),
    jsonFilePath: detectJsonFile(prompt, flags["file"]),
    iterationPath: detectIterationPath(prompt, flags["sprint"] || flags["iteration"]),
  };
}

// ─── Data Loading ────────────────────────────────────────────────────────────

function loadItems(filePath: string): BacklogItem[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw);

  // Support several shapes
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.payload?.items)) return data.payload.items;
  if (Array.isArray(data.data?.items)) return data.data.items;
  if (Array.isArray(data.features)) {
    // Flatten features → items view
    return data.features.map((f: any) => ({
      title: f.title,
      description: f.description,
    }));
  }
  if (Array.isArray(data.stories)) return data.stories;

  throw new Error(
    "Cannot find an array of items in the JSON. Expected { items: [...] } or a top-level array."
  );
}

function loadItemsFromStdin(): Promise<BacklogItem[] | null> {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      resolve(null);
      return;
    }
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => {
      if (!data.trim()) {
        resolve(null);
        return;
      }
      try {
        const parsed = JSON.parse(data);
        const items = Array.isArray(parsed)
          ? parsed
          : parsed.items || parsed.payload?.items || parsed.data?.items || [];
        resolve(items.length > 0 ? items : null);
      } catch {
        reject(new Error("Invalid JSON from stdin."));
      }
    });
    process.stdin.on("error", reject);
  });
}

// ─── Item Description Formatting ─────────────────────────────────────────────

function buildDescription(item: BacklogItem): string {
  const parts: string[] = [];

  if (item.description) {
    parts.push(`<p>${item.description}</p>`);
  }

  if (item.acceptanceCriteria && item.acceptanceCriteria.length > 0) {
    parts.push("<h3>Acceptance Criteria</h3><ul>");
    item.acceptanceCriteria.forEach((ac) => parts.push(`<li>${ac}</li>`));
    parts.push("</ul>");
  }

  if (typeof item.estimate === "number") {
    parts.push(`<p><strong>Estimate:</strong> ${item.estimate}</p>`);
  }

  return parts.length > 0 ? parts.join("\n") : "";
}

function buildWebUrl(apiUrl: string): string {
  // Transform API url to browser url
  // https://dev.azure.com/org/projGuid/_apis/wit/workItems/12345  →
  // https://dev.azure.com/org/project/_workitems/edit/12345
  const config = resolveAzureDevOpsMcpConfig();
  const idMatch = apiUrl.match(/workItems\/(\d+)/i);
  if (idMatch?.[1]) {
    return `https://dev.azure.com/${config.org}/${config.project}/_workitems/edit/${idMatch[1]}`;
  }
  return apiUrl;
}

// ─── Report Generation ───────────────────────────────────────────────────────

function resolveDocsPath(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(process.cwd(), "docs", `created-${stamp}.md`);
}

function writeReport(items: CreatedItem[], intent: DetectedIntent) {
  const dir = path.join(process.cwd(), "docs");
  fs.mkdirSync(dir, { recursive: true });

  const docPath = resolveDocsPath();
  const lines: string[] = [];
  const now = new Date().toISOString();

  lines.push(`# ${intent.workItemType}s Created in Azure DevOps`);
  lines.push("");
  lines.push(`Generated: ${now}`);
  if (intent.iterationPath) lines.push(`Sprint / Iteration: ${intent.iterationPath}`);
  lines.push("");
  lines.push("| # | Title | ID | Type | Link |");
  lines.push("|---|-------|----|------|------|");

  items.forEach((item, i) => {
    lines.push(
      `| ${item.order ?? i + 1} | ${item.title} | ${item.id} | ${item.type} | [Open](${item.webUrl}) |`
    );
  });

  lines.push("");
  fs.writeFileSync(docPath, lines.join("\n"), "utf8");
  return path.relative(process.cwd(), docPath);
}

// ─── Main Execution ──────────────────────────────────────────────────────────

function parseFlags(args: string[]): { prompt: string; flags: Record<string, string> } {
  const flags: Record<string, string> = {};
  const promptParts: string[] = [];

  let i = 0;
  while (i < args.length) {
    const arg = args[i]!;
    if (arg.startsWith("--")) {
      const key = arg.replace(/^--/, "");
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i += 2;
      } else {
        flags[key] = "true";
        i += 1;
      }
    } else {
      promptParts.push(arg);
      i += 1;
    }
  }

  return { prompt: promptParts.join(" "), flags };
}

async function main() {
  const { prompt, flags } = parseFlags(process.argv.slice(2));

  if (!prompt && !flags["file"] && process.stdin.isTTY) {
    console.log("");
    console.log("  ╭─────────────────────────────────────────────────────────────╮");
    console.log("  │  AgilePlanner — Smart Work Item Creator                     │");
    console.log("  ╰─────────────────────────────────────────────────────────────╯");
    console.log("");
    console.log("  Usage:");
    console.log('    npm run go "Create user stories from devops-backlog.json"');
    console.log('    npm run go "Create tasks from input.json"');
    console.log('    npm run go -- --file my-items.json');
    console.log('    cat data.json | npm run go "Create bugs"');
    console.log("");
    console.log("  Supported work item types: User Story, Bug, Task, Feature, Epic");
    console.log("");
    process.exitCode = 1;
    return;
  }

  // Use a default prompt if only --file was given
  const effectivePrompt = prompt || "Create user stories from provided JSON";

  console.log("");
  console.log("  🚀 AgilePlanner — Smart Work Item Creator");
  console.log("  ─────────────────────────────────────────");
  console.log(`  Prompt  : ${effectivePrompt}`);

  // 1. Detect intent
  const intent = detectIntent(effectivePrompt, flags);
  console.log(`  Type    : ${intent.workItemType}`);
  if (intent.iterationPath) {
    console.log(`  Sprint  : ${intent.iterationPath}`);
  }

  // 2. Load items
  let items: BacklogItem[];

  const stdinItems = await loadItemsFromStdin();
  if (stdinItems) {
    items = stdinItems;
    console.log(`  Source  : stdin (${items.length} items)`);
  } else if (intent.jsonFilePath) {
    items = loadItems(intent.jsonFilePath);
    console.log(`  Source  : ${path.relative(process.cwd(), intent.jsonFilePath)} (${items.length} items)`);
  } else {
    console.error("\n  ❌ No JSON file found. Provide a filename in your prompt or use --file.");
    process.exitCode = 1;
    return;
  }

  // 3. Validate connection
  if (!azureDevOpsMcpClient.isConfigured()) {
    console.error("\n  ❌ Azure DevOps is not configured. Check mcp/azure-devops.json or env vars.");
    process.exitCode = 1;
    return;
  }

  const config = resolveAzureDevOpsMcpConfig();
  console.log(`  Target  : ${config.serverUrl}/${config.project}`);
  console.log("");

  // 4. Create work items
  const created: CreatedItem[] = [];
  let errorCount = 0;

  for (const [i, item] of items.entries()) {
    if (!item.title) {
      console.log(`  ⚠  Skipping item ${i + 1}: no title`);
      continue;
    }

    const itemType = (item.type as WorkItemType) || intent.workItemType;
    const description = buildDescription(item);
    const prefix = `  [${i + 1}/${items.length}]`;

    try {
      const patchOps: any[] = [
        { op: "add", path: "/fields/System.Title", value: item.title },
        { op: "add", path: "/fields/System.Description", value: description },
      ];

      if (intent.iterationPath) {
        patchOps.push({
          op: "add",
          path: "/fields/System.IterationPath",
          value: intent.iterationPath,
        });
      }

      if (item.state && item.state !== "New") {
        patchOps.push({ op: "add", path: "/fields/System.State", value: item.state });
      }

      const response = await azureDevOpsMcpClient.callTool("create-work-item", {
        type: itemType,
        title: item.title,
        description,
        ...(intent.iterationPath ? { iterationPath: intent.iterationPath } : {}),
      });

      const apiUrl = (response as any).url ?? "";
      const webUrl = buildWebUrl(apiUrl);

      created.push({
        order: item.order,
        id: (response as any).id ?? "?",
        title: item.title,
        type: itemType,
        url: apiUrl,
        webUrl,
      });

      console.log(`${prefix} ✅ ${item.title}  →  ID ${(response as any).id}  ${webUrl}`);
    } catch (err) {
      errorCount++;
      console.log(`${prefix} ❌ ${item.title}  →  ${err instanceof Error ? err.message : err}`);
    }
  }

  // 5. Report
  console.log("");
  console.log("  ─────────────────────────────────────────");
  console.log(`  ✅ Created: ${created.length}   ❌ Failed: ${errorCount}   📋 Total: ${items.length}`);

  if (created.length > 0) {
    const reportPath = writeReport(created, intent);
    console.log(`  📄 Report : ${reportPath}`);
    console.log("");
    console.log(`  View in Azure DevOps:`);
    console.log(`    https://dev.azure.com/${config.org}/${config.project}/_backlogs`);
  }

  console.log("");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
