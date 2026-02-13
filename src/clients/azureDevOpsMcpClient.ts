import fs from "fs";
import path from "path";
import axios, { AxiosInstance } from "axios";

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

function createAxiosClient(config: AzureDevOpsMcpConfig): AxiosInstance {
  const encodedToken = Buffer.from(`:${config.token}`).toString("base64");
  
  // Normalize the base URL - remove org if it's already in serverUrl
  let baseURL = config.serverUrl;
  if (baseURL.includes(config.org)) {
    baseURL = baseURL.replace(`/${config.org}`, "");
  }
  if (!baseURL.endsWith("/")) {
    baseURL += "/";
  }

  return axios.create({
    baseURL: baseURL,
    headers: {
      Authorization: `Basic ${encodedToken}`,
      "Content-Type": "application/json"
    },
    timeout: 30000
  });
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

    if (!config.token) {
      throw new Error("Azure DevOps MCP token is not configured.");
    }

    const client = createAxiosClient(config);

    try {
      // Route different tools to appropriate Azure DevOps endpoints
      switch (tool) {
        case "list-work-items":
          return await listWorkItems(client, config, args);
        case "create-work-item":
          return await createWorkItem(client, config, args);
        case "update-work-item":
          return await updateWorkItem(client, config, args);
        case "list-sprints":
          return await listSprints(client, config, args);
        case "get-sprint":
          return await getSprint(client, config, args);
        default:
          throw new Error(`Unknown tool: ${tool}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Azure DevOps API error (${error.response?.status}): ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }
};

async function listWorkItems(
  client: AxiosInstance,
  config: AzureDevOpsMcpConfig,
  args: Record<string, unknown>
) {
  const query = args.query || `SELECT [System.Id], [System.Title], [System.State] FROM workitems WHERE [System.TeamProject] = '${config.project}'`;
  
  const response = await client.post(
    `${config.org}/${config.project}/_apis/wit/wiql`,
    { query },
    { params: { "api-version": "7.0" } }
  );

  return response.data;
}

async function createWorkItem(
  client: AxiosInstance,
  config: AzureDevOpsMcpConfig,
  args: Record<string, unknown>
) {
  const { type = "User Story", title, description } = args;

  const response = await client.post(
    `${config.org}/${config.project}/_apis/wit/workitems/$${type}`,
    [
      { op: "add", path: "/fields/System.Title", value: title },
      { op: "add", path: "/fields/System.Description", value: description || "" }
    ],
    {
      params: { "api-version": "7.0" },
      headers: { "Content-Type": "application/json-patch+json" }
    }
  );

  return response.data;
}

async function updateWorkItem(
  client: AxiosInstance,
  config: AzureDevOpsMcpConfig,
  args: Record<string, unknown>
) {
  const { id, state, title, description } = args;

  const patches = [];
  if (state) patches.push({ op: "add", path: "/fields/System.State", value: state });
  if (title) patches.push({ op: "add", path: "/fields/System.Title", value: title });
  if (description) patches.push({ op: "add", path: "/fields/System.Description", value: description });

  const response = await client.patch(
    `${config.org}/${config.project}/_apis/wit/workitems/${id}`,
    patches,
    {
      params: { "api-version": "7.0" },
      headers: { "Content-Type": "application/json-patch+json" }
    }
  );

  return response.data;
}

async function listSprints(
  client: AxiosInstance,
  config: AzureDevOpsMcpConfig,
  args: Record<string, unknown>
) {
  const team = args.team || "Default";

  const response = await client.get(
    `${config.org}/${config.project}/${team}/_apis/work/teamsettings/iterations`,
    {
      params: { "api-version": "7.0" }
    }
  );

  return response.data;
}

async function getSprint(
  client: AxiosInstance,
  config: AzureDevOpsMcpConfig,
  args: Record<string, unknown>
) {
  const { id, team = "Default" } = args;

  const response = await client.get(
    `${config.org}/${config.project}/${team}/_apis/work/teamsettings/iterations/${id}`,
    {
      params: { "api-version": "7.0" }
    }
  );

  return response.data;
}
