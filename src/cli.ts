import { activateAgent } from "./agent";

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command) {
    console.error("Usage: ops360-ai <command> [--flag value]");
    console.error("Example: ops360-ai plan-backlog --file docs/Requirements.md");
    process.exitCode = 1;
    return;
  }

  const agent = await activateAgent();

  // Build command string from arguments
  let commandInput = `/${command}`;
  if (args.length > 0) {
    commandInput += ` ${args.join(" ")}`;
  }

  // Try to get JSON payload from stdin if available
  let payload: any = {};
  if (!process.stdin.isTTY) {
    const stdinPayload = await readStdin();
    if (stdinPayload.trim()) {
      try {
        payload = JSON.parse(stdinPayload);
        // Merge stdin payload with command arguments
        commandInput = { command, ...payload };
      } catch (error) {
        console.error("Invalid JSON payload from stdin.");
        process.exitCode = 1;
        return;
      }
    }
  }

  try {
    const result = await agent.routeCommand(commandInput);
    process.stdout.write(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
