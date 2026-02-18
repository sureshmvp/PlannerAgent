import dotenv from "dotenv";

import { planBacklog } from "./handlers/planBacklog";
import { planFeature } from "./handlers/planFeature";
import { planSprint } from "./handlers/planSprint";

dotenv.config();

interface CommandInput {
  [key: string]: any;
}

interface ParsedCommand {
  name: string;
  args: Record<string, string | string[] | boolean>;
}

/**
 * Parse command string and extract command name and arguments
 * Supports formats like: /plan-backlog, plan-backlog, plan-backlog --file path/to/file
 */
function parseCommand(input: string | CommandInput): ParsedCommand {
  let commandStr = "";
  let args: Record<string, string | string[] | boolean> = {};

  if (typeof input === "string") {
    commandStr = input.trim();
  } else if (typeof input === "object" && input.command) {
    commandStr = input.command;
    // Preserve other properties as arguments
    args = { ...input };
    delete args.command;
  } else {
    return { name: "", args: {} };
  }

  // Parse command string: "/plan-backlog --file path/to/file --project MyProject"
  const commandRegex = /^\/?([\w-]+)/;
  const match = commandStr.match(commandRegex);

  if (!match || !match[1]) {
    return { name: "", args: {} };
  }

  const commandName = match[1];

  // Parse flags and arguments
  const flagRegex = /--?([\w-]+)(?:\s+([^\s-][^\s]*?))?(?=\s--|\s*$)/g;
  let flagMatch;
  while ((flagMatch = flagRegex.exec(commandStr)) !== null) {
    const key = flagMatch[1] || "";
    const value = flagMatch[2] ? flagMatch[2] : true;
    if (key) {
      args[key] = value;
    }
  }

  return {
    name: commandName,
    args: args,
  };
}

/**
 * Route command to the appropriate handler
 */
async function routeCommand(
  command: string | CommandInput
): Promise<any> {
  const parsed = parseCommand(command);

  if (!parsed.name) {
    return {
      success: false,
      error: "Invalid command format",
      message: "Use format: /command-name [--flag value]",
    };
  }

  // Handler registry
  const handlers: Record<string, (input: CommandInput) => Promise<any>> = {
    "plan-backlog": planBacklog,
    "plan-feature": planFeature,
    "plan-sprint": planSprint,
  };

  // Check if command is registered
  if (!(parsed.name in handlers)) {
    const available = Object.keys(handlers).map((c) => `/${c}`);
    return {
      success: false,
      error: `Unknown command: /${parsed.name}`,
      availableCommands: available,
    };
  }

  try {
    const handler = handlers[parsed.name];
    if (!handler) {
      return {
        success: false,
        error: `Handler not found for command: /${parsed.name}`,
      };
    }

    const input: CommandInput = {
      command: parsed.name,
      ...parsed.args,
    };

    const result = await handler(input);
    return {
      success: true,
      command: `/${parsed.name}`,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      command: `/${parsed.name}`,
    };
  }
}

export async function activateAgent() {
  console.log("AgileProcess Planner Ready!");

  return {
    routeCommand,
    commands: {
      "plan-backlog": async (input: any) => {
        return await planBacklog(input);
      },
      "plan-feature": async (input: any) => {
        return await planFeature(input);
      },
      "plan-sprint": async (input: any) => {
        return await planSprint(input);
      },
    },
  };
}
