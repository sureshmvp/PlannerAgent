import fs from "fs";
import path from "path";

type AzureDevOpsMcpConfig = {
  serverUrl: string;
  token: string;
  org: string;
  project: string;
};

type McpConfigFileShape = Partial<AzureDevOpsMcpConfig>;

function loadMcpConfigFile(): McpConfigFileShape {
  const configPath = process.env.OPS360_AZURE_DEVOPS_MCP_CONFIG
    ? path.resolve(process.cwd(), process.env.OPS360_AZURE_DEVOPS_MCP_CONFIG)
    : path.resolve(process.cwd(), "mcp", "azure-devops.json");

  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    return JSON.parse(raw) as McpConfigFileShape;
  } catch {
    return {};
  }
}

export function resolveAzureDevOpsMcpConfig(): AzureDevOpsMcpConfig {
  const fileConfig = loadMcpConfigFile();

  return {
    serverUrl: process.env.OPS360_AZURE_DEVOPS_MCP_URL || fileConfig.serverUrl || "",
    token: process.env.OPS360_AZURE_DEVOPS_MCP_TOKEN || fileConfig.token || "",
    org: process.env.OPS360_AZURE_DEVOPS_ORG || fileConfig.org || "",
    project: process.env.OPS360_AZURE_DEVOPS_PROJECT || fileConfig.project || ""
  };
}

export const azureDevOpsMcpClient = {
  isConfigured() {
    const config = resolveAzureDevOpsMcpConfig();
    return Boolean(config.serverUrl && config.token);
  },
  async callTool(tool: string, args: Record<string, unknown>) {
    const config = resolveAzureDevOpsMcpConfig();
    if (!config.serverUrl) {
      throw new Error("Azure DevOps MCP server URL is not configured.");
    }

    throw new Error(
      `Azure DevOps MCP client is not wired. Configure transport for ${tool} before use.`
    );
  }
};
