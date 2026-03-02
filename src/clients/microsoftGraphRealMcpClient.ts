import { spawn, ChildProcess } from "child_process";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

/**
 * Microsoft Graph MCP Client
 * 
 * Communicates with the MCP server via stdio transport.
 * This is a TRUE MCP implementation using the MCP protocol.
 */

interface MCPRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export class MicrosoftGraphMCPClient {
  private serverProcess: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }>();
  private buffer = "";
  private isInitialized = false;

  async connect(): Promise<void> {
    if (this.serverProcess) {
      return; // Already connected
    }

    const serverPath = path.join(
      __dirname,
      "..",
      "..",
      "mcp-server",
      "dist",
      "server.js"
    );

    this.serverProcess = spawn("node", [serverPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        AZURE_TENANT_ID: process.env.AZURE_TENANT_ID,
        AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
        AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET,
      },
    });

    // Handle stdout (JSON-RPC responses)
    this.serverProcess.stdout?.on("data", (data) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    // Handle stderr (server logs)
    this.serverProcess.stderr?.on("data", (data) => {
      const message = data.toString().trim();
      if (message.includes("✅")) {
        console.log(message);
      }
    });

    // Handle process exit
    this.serverProcess.on("exit", (code) => {
      console.error(`MCP Server process exited with code ${code}`);
      this.serverProcess = null;
    });

    // Initialize MCP connection
    await this.initialize();
  }

  private processBuffer() {
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const response: MCPResponse = JSON.parse(line);
        const pending = this.pendingRequests.get(response.id as number);
        
        if (pending) {
          this.pendingRequests.delete(response.id as number);
          
          if (response.error) {
            pending.reject(new Error(response.error.message));
          } else {
            pending.resolve(response.result);
          }
        }
      } catch (error) {
        console.error("Failed to parse MCP response:", line);
      }
    }
  }

  private async initialize(): Promise<void> {
    const result = await this.sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "ops360-ai",
        version: "1.0.0",
      },
    });

    this.isInitialized = true;
    
    // Send initialized notification
    await this.sendNotification("notifications/initialized", {});
  }

  private async sendRequest(method: string, params?: any): Promise<any> {
    if (!this.serverProcess || !this.serverProcess.stdin) {
      throw new Error("MCP Server is not connected");
    }

    const id = ++this.requestId;
    const request: MCPRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      
      const requestLine = JSON.stringify(request) + "\n";
      this.serverProcess!.stdin!.write(requestLine);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error("Request timeout"));
        }
      }, 30000);
    });
  }

  private async sendNotification(method: string, params?: any): Promise<void> {
    if (!this.serverProcess || !this.serverProcess.stdin) {
      throw new Error("MCP Server is not connected");
    }

    const notification = {
      jsonrpc: "2.0",
      method,
      params,
    };

    const notificationLine = JSON.stringify(notification) + "\n";
    this.serverProcess.stdin.write(notificationLine);
  }

  async listTools(): Promise<any> {
    if (!this.isInitialized) {
      await this.connect();
    }

    return await this.sendRequest("tools/list", {});
  }

  async callTool(toolName: string, args: Record<string, any>): Promise<any> {
    if (!this.isInitialized) {
      await this.connect();
    }

    const result = await this.sendRequest("tools/call", {
      name: toolName,
      arguments: args,
    });

    // Parse the text content from MCP response
    if (result.content && result.content[0]?.text) {
      try {
        return JSON.parse(result.content[0].text);
      } catch {
        return result.content[0].text;
      }
    }

    return result;
  }

  async disconnect(): Promise<void> {
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
      this.isInitialized = false;
    }
  }
}

// Singleton instance
let mcpClient: MicrosoftGraphMCPClient | null = null;

export async function getMicrosoftGraphMCPClient(): Promise<MicrosoftGraphMCPClient> {
  if (!mcpClient) {
    mcpClient = new MicrosoftGraphMCPClient();
    await mcpClient.connect();
  }
  return mcpClient;
}

export async function disconnectMCPClient(): Promise<void> {
  if (mcpClient) {
    await mcpClient.disconnect();
    mcpClient = null;
  }
}
