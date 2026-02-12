import axios, { AxiosInstance } from "axios";
import fs from "fs";
import path from "path";

type AgileCoreEndpoints = {
  planBacklog: string;
  planFeature: string;
  planSprint: string;
};

type AgileCoreConfig = {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  endpoints: AgileCoreEndpoints;
};

type ConfigFileShape = {
  agileCore?: Partial<AgileCoreConfig> & { endpoints?: Partial<AgileCoreEndpoints> };
};

function loadConfigFile(): ConfigFileShape {
  const configPath = process.env.OPS360_CONFIG_PATH
    ? path.resolve(process.cwd(), process.env.OPS360_CONFIG_PATH)
    : path.resolve(process.cwd(), "config", "default-config.json");

  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    return JSON.parse(raw) as ConfigFileShape;
  } catch {
    return {};
  }
}

function resolveAgileCoreConfig(): AgileCoreConfig {
  const fileConfig = loadConfigFile();
  const agileCore = fileConfig.agileCore || {};
  const endpoints = (agileCore.endpoints || {}) as Partial<AgileCoreEndpoints>;

  const baseUrl = process.env.OPS360_AGILE_CORE_BASE_URL || agileCore.baseUrl || "";
  const apiKey = process.env.OPS360_AGILE_CORE_API_KEY || agileCore.apiKey || "";
  const timeoutMs = Number(
    process.env.OPS360_AGILE_CORE_TIMEOUT_MS || agileCore.timeoutMs || 15000
  );

  return {
    baseUrl,
    apiKey,
    timeoutMs,
    endpoints: {
      planBacklog:
        process.env.OPS360_AGILE_CORE_ENDPOINT_PLAN_BACKLOG ||
        endpoints.planBacklog ||
        "/api/planner/plan-backlog",
      planFeature:
        process.env.OPS360_AGILE_CORE_ENDPOINT_PLAN_FEATURE ||
        endpoints.planFeature ||
        "/api/planner/plan-feature",
      planSprint:
        process.env.OPS360_AGILE_CORE_ENDPOINT_PLAN_SPRINT ||
        endpoints.planSprint ||
        "/api/planner/plan-sprint"
    }
  };
}

function createClient(config: AgileCoreConfig): AxiosInstance {
  if (!config.baseUrl) {
    throw new Error("AgileProcess Core base URL is not configured.");
  }

  const headers: Record<string, string> = {};
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  return axios.create({
    baseURL: config.baseUrl,
    timeout: config.timeoutMs,
    headers
  });
}

function resolveTextInput(input: string): string {
  const candidatePath = path.resolve(process.cwd(), input);
  if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
    return fs.readFileSync(candidatePath, "utf8");
  }

  return input;
}

async function planRequirementsToBacklog(requirements: string, options?: any) {
  const config = resolveAgileCoreConfig();
  const client = createClient(config);
  const requirementsText = resolveTextInput(requirements);

  const response = await client.post(config.endpoints.planBacklog, {
    requirements: requirementsText,
    options
  });

  return response.data;
}

async function planFeature(feature: string, options?: any) {
  const config = resolveAgileCoreConfig();
  const client = createClient(config);
  const featureText = resolveTextInput(feature);

  const response = await client.post(config.endpoints.planFeature, {
    feature: featureText,
    options
  });

  return response.data;
}

async function planSprint(input: any, options?: any) {
  const config = resolveAgileCoreConfig();
  const client = createClient(config);

  let payload: Record<string, unknown>;
  if (typeof input === "string") {
    payload = { sprint: resolveTextInput(input) };
  } else if (input && typeof input === "object") {
    payload = "sprint" in input ? (input as Record<string, unknown>) : { sprint: input };
  } else {
    payload = { sprint: "" };
  }

  const response = await client.post(config.endpoints.planSprint, {
    ...payload,
    options
  });

  return response.data;
}

export const agileCoreClient = {
  planRequirementsToBacklog,
  planFeature,
  planSprint
};
