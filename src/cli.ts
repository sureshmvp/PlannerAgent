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
  const [command, payloadArg] = process.argv.slice(2);
  if (!command) {
    console.error("Usage: ops360-ai <command> [jsonPayload]");
    process.exitCode = 1;
    return;
  }

  const agent = await activateAgent();
  const handler = (agent.commands as Record<string, (input: any) => Promise<any>>)[command];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    process.exitCode = 1;
    return;
  }

  let payload: any = {};
  if (payloadArg) {
    try {
      payload = JSON.parse(payloadArg);
    } catch (error) {
      console.error("Invalid JSON payload.");
      process.exitCode = 1;
      return;
    }
  } else if (!process.stdin.isTTY) {
    const stdinPayload = await readStdin();
    if (stdinPayload.trim()) {
      try {
        payload = JSON.parse(stdinPayload);
      } catch (error) {
        console.error("Invalid JSON payload from stdin.");
        process.exitCode = 1;
        return;
      }
    }
  }

  const result = await handler(payload);
  process.stdout.write(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
