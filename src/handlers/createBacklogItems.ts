import fs from "fs";
import path from "path";

import { azureDevOpsMcpClient } from "../clients/azureDevOpsMcpClient";

type BacklogItem = {
  order?: number;
  title: string;
  state?: string;
  description?: string;
};

type CreatedItem = {
  order: number | undefined;
  id: number | string;
  title: string;
  type: string;
  url: string | undefined;
};

function getItems(input: any): BacklogItem[] {
  if (Array.isArray(input?.items)) {
    return input.items as BacklogItem[];
  }
  if (Array.isArray(input?.payload?.items)) {
    return input.payload.items as BacklogItem[];
  }
  if (Array.isArray(input?.data?.items)) {
    return input.data.items as BacklogItem[];
  }
  if (Array.isArray(input)) {
    return input as BacklogItem[];
  }
  return [];
}

function validateItem(item: BacklogItem, index: number) {
  if (!item.title) {
    throw new Error(`Item at index ${index} is missing a title.`);
  }
}

function formatItemDescription(item: BacklogItem): string {
  const lines = [];
  
  if (item.description) {
    lines.push(item.description);
  }
  
  if (typeof item.order === "number") {
    lines.push(`<p><strong>Backlog Order:</strong> ${item.order}</p>`);
  }
  
  if (item.state) {
    lines.push(`<p><strong>State:</strong> ${item.state}</p>`);
  }
  
  return lines.length > 0 ? lines.join("\n") : item.title;
}

function resolveDocsPath(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(process.cwd(), "docs", `backlog-created-${stamp}.md`);
}

function ensureDocsDir(filePath: string) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function formatDoc(items: CreatedItem[], generatedAt: string): string {
  const lines: string[] = [];

  lines.push("# Backlog Items Created");
  lines.push("");
  lines.push(`Generated: ${generatedAt}`);
  lines.push("");
  lines.push("| Order | Title | ID | Type |");
  lines.push("|-------|-------|----|----|");

  items.forEach((item) => {
    const order = item.order ?? "-";
    const title = item.title;
    const id = item.id;
    const type = item.type;
    lines.push(`| ${order} | ${title} | ${id} | ${type} |`);
  });

  lines.push("");
  lines.push("## Details");
  lines.push("");

  items.forEach((item) => {
    lines.push(`### ${item.title} (ID: ${item.id})`);
    if (item.url) {
      lines.push(`[View in Azure DevOps](${item.url})`);
    }
    lines.push("");
  });

  return lines.join("\n");
}

export async function createBacklogItems(input: any) {
  if (!azureDevOpsMcpClient.isConfigured()) {
    throw new Error("Azure DevOps MCP client is not configured.");
  }

  const items = getItems(input);
  if (items.length === 0) {
    throw new Error("No items found in input.");
  }

  const createdItems: CreatedItem[] = [];

  for (const [i, item] of items.entries()) {
    validateItem(item, i);

    const description = formatItemDescription(item);
    const response = await azureDevOpsMcpClient.callTool("create-work-item", {
      type: "User Story",
      title: item.title,
      description: description,
    });

    createdItems.push({
      order: item.order,
      id: (response as any).id ?? "unknown",
      title: item.title,
      type: "User Story",
      url: (response as any).url ?? undefined,
    });
  }

  const docPath = resolveDocsPath();
  ensureDocsDir(docPath);

  const generatedAt = new Date().toISOString();
  const docContent = formatDoc(createdItems, generatedAt);
  fs.writeFileSync(docPath, docContent, "utf8");

  return {
    createdItems,
    documentPath: path.relative(process.cwd(), docPath),
  };
}
