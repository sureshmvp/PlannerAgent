import fs from "fs";
import path from "path";

import { azureDevOpsMcpClient } from "../clients/azureDevOpsMcpClient";

type TaskInput = {
  title: string;
  description?: string;
  estimate?: number;
};

type StoryInput = {
  title: string;
  description?: string;
  acceptanceCriteria?: string[];
  estimate?: number;
  tasks?: TaskInput[];
};

type FeatureInput = {
  title: string;
  description?: string;
  stories?: StoryInput[];
};

type WorkItemSummary = {
  id: number | string;
  type: string;
  title: string;
  description: string;
  children?: WorkItemSummary[];
};

function asArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function formatDescriptionLines(lines: string[]): string {
  return lines.filter((line) => line.trim().length > 0).join("\n");
}

function formatEpicDescription(feature: FeatureInput): string {
  const lines = [
    "<h3>Description</h3>",
    feature.description || "",
  ];

  const storyTitles = asArray(feature.stories)
    .map((story) => story.title)
    .filter(Boolean);

  if (storyTitles.length > 0) {
    lines.push("<h3>Planned Stories</h3>");
    lines.push("<ul>");
    storyTitles.forEach((title) => {
      lines.push(`<li>${title}</li>`);
    });
    lines.push("</ul>");
  }

  return formatDescriptionLines(lines);
}

function formatStoryDescription(story: StoryInput): string {
  const lines = [
    "<h3>Description</h3>",
    story.description || "",
  ];

  if (typeof story.estimate === "number") {
    lines.push(`<p><strong>Estimate:</strong> ${story.estimate}</p>`);
  }

  const criteria = asArray(story.acceptanceCriteria);
  if (criteria.length > 0) {
    lines.push("<h3>Acceptance Criteria</h3>");
    lines.push("<ul>");
    criteria.forEach((item) => {
      lines.push(`<li>${item}</li>`);
    });
    lines.push("</ul>");
  }

  const taskTitles = asArray(story.tasks)
    .map((task) => task.title)
    .filter(Boolean);

  if (taskTitles.length > 0) {
    lines.push("<h3>Planned Tasks</h3>");
    lines.push("<ul>");
    taskTitles.forEach((title) => {
      lines.push(`<li>${title}</li>`);
    });
    lines.push("</ul>");
  }

  return formatDescriptionLines(lines);
}

function formatTaskDescription(task: TaskInput): string {
  const lines = [
    "<h3>Description</h3>",
    task.description || "",
  ];

  if (typeof task.estimate === "number") {
    lines.push(`<p><strong>Estimate:</strong> ${task.estimate}</p>`);
  }

  return formatDescriptionLines(lines);
}

function getFeatures(input: any): FeatureInput[] {
  if (Array.isArray(input?.features)) {
    return input.features as FeatureInput[];
  }
  if (Array.isArray(input?.payload?.features)) {
    return input.payload.features as FeatureInput[];
  }
  if (Array.isArray(input?.data?.features)) {
    return input.data.features as FeatureInput[];
  }
  return [];
}

function validateFeature(feature: FeatureInput, index: number) {
  if (!feature.title) {
    throw new Error(`Feature at index ${index} is missing a title.`);
  }
}

function resolveDocsPath(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(process.cwd(), "docs", `devops-items-${stamp}.md`);
}

function ensureDocsDir(filePath: string) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function formatDoc(items: WorkItemSummary[], generatedAt: string): string {
  const lines: string[] = [];

  lines.push("# DevOps Items");
  lines.push("");
  lines.push(`Generated: ${generatedAt}`);
  lines.push("Note: This document lists created items, but parent-child links are not established by this command.");
  lines.push("");

  items.forEach((epic) => {
    lines.push(`## Epic: ${epic.title} (ID: ${epic.id})`);
    lines.push("");
    lines.push(epic.description || "");
    lines.push("");

    (epic.children || []).forEach((feature) => {
      lines.push(`### Feature: ${feature.title} (ID: ${feature.id})`);
      lines.push("");
      lines.push(feature.description || "");
      lines.push("");

      (feature.children || []).forEach((story) => {
        lines.push(`#### User Story: ${story.title} (ID: ${story.id})`);
        lines.push("");
        lines.push(story.description || "");
        lines.push("");
      });
    });
  });

  return lines.join("\n");
}

export async function createDevopsItems(input: any) {
  if (!azureDevOpsMcpClient.isConfigured()) {
    throw new Error("Azure DevOps MCP client is not configured.");
  }

  const features = getFeatures(input);
  if (features.length === 0) {
    throw new Error("No features found in input.");
  }

  const createdItems: WorkItemSummary[] = [];

  for (const [i, feature] of features.entries()) {
    validateFeature(feature, i);

    const epicDescription = formatEpicDescription(feature);
    const epicResponse = await azureDevOpsMcpClient.callTool("create-work-item", {
      type: "Epic",
      title: feature.title,
      description: epicDescription,
    });

    const epicItem: WorkItemSummary = {
      id: (epicResponse as any).id ?? "unknown",
      type: "Epic",
      title: feature.title,
      description: epicDescription,
      children: [],
    };

    const stories = asArray(feature.stories);
    for (const [j, story] of stories.entries()) {
      if (!story.title) {
        throw new Error(`Story at index ${j} in feature ${feature.title} is missing a title.`);
      }

      const storyDescription = formatStoryDescription(story);
      const storyResponse = await azureDevOpsMcpClient.callTool("create-work-item", {
        type: "Feature",
        title: story.title,
        description: storyDescription,
      });

      const storyItem: WorkItemSummary = {
        id: (storyResponse as any).id ?? "unknown",
        type: "Feature",
        title: story.title,
        description: storyDescription,
        children: [],
      };

      const tasks = asArray(story.tasks);
      for (const [k, task] of tasks.entries()) {
        if (!task.title) {
          throw new Error(`Task at index ${k} in story ${story.title} is missing a title.`);
        }

        const taskDescription = formatTaskDescription(task);
        const taskResponse = await azureDevOpsMcpClient.callTool("create-work-item", {
          type: "User Story",
          title: task.title,
          description: taskDescription,
        });

        storyItem.children?.push({
          id: (taskResponse as any).id ?? "unknown",
          type: "User Story",
          title: task.title,
          description: taskDescription,
        });
      }

      epicItem.children?.push(storyItem);
    }

    createdItems.push(epicItem);
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
