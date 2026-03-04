import dotenv from "dotenv";
dotenv.config();

import { getMicrosoftGraphMCPClient, disconnectMCPClient } from "./clients/microsoftGraphRealMcpClient";

// ─── Test User ────────────────────────────────────────────────────────────────

const TEST_USER = {
  displayName: "MCP Test User",
  givenName: "MCP",
  surname: "Test",
  userPrincipalName: "mcp.testuser@workasaservice.ai",
  mailNickname: "mcp.testuser",
  jobTitle: "MCP Protocol Tester",
  department: "Engineering",
  usageLocation: "US",
  password: process.env.TEST_USER_PASSWORD || "McpTest123!",
  accountEnabled: true,
  forceChangePasswordNextSignIn: true,
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("");
  console.log("  ╭──────────────────────────────────────────────────╮");
  console.log("  │  TRUE MCP PROTOCOL TEST                           │");
  console.log("  │  Microsoft Graph MCP Server                       │");
  console.log("  ╰──────────────────────────────────────────────────╯");
  console.log("");
  console.log("  ℹ️  This test uses the REAL MCP protocol (stdio transport)");
  console.log("     NOT HTTP POST requests!");
  console.log("");

  try {
    // ── 1. Connect to MCP Server ───────────────────────────────────────────────
    console.log("  🔌 Connecting to MCP Server...");
    const client = await getMicrosoftGraphMCPClient();
    console.log("  ✅ Connected to MCP Server via stdio transport");
    console.log("");

    // ── 2. List available tools ────────────────────────────────────────────────
    console.log("  🔧 Listing available MCP tools...");
    const tools = await client.listTools();
    console.log(`  ✅ Found ${tools.tools?.length || 0} tools:`);
    tools.tools?.slice(0, 5).forEach((tool: any) => {
      console.log(`     • ${tool.name}: ${tool.description}`);
    });
    if (tools.tools?.length > 5) {
      console.log(`     ... and ${tools.tools.length - 5} more`);
    }
    console.log("");

    // ── 3. Check if user already exists ────────────────────────────────────────
    console.log(`  🔍 Checking if user '${TEST_USER.userPrincipalName}' exists...`);
    try {
      const existingUser = await client.callTool("get_user", {
        userId: TEST_USER.userPrincipalName,
      });

      if (existingUser?.id) {
        console.log("  ⏭️  User already exists:");
        console.log(`     ID           : ${existingUser.id}`);
        console.log(`     Display Name : ${existingUser.displayName}`);
        console.log(`     Job Title    : ${existingUser.jobTitle || "(not set)"}`);
        console.log("");

        // Delete existing user to re-create
        console.log("  🗑️  Deleting existing user to re-test creation...");
        await client.callTool("delete_user", {
          userId: TEST_USER.userPrincipalName,
        });
        console.log("  ✅ User deleted");
        console.log("");
        
        // Wait a bit for deletion to propagate
        console.log("  ⏳ Waiting 3 seconds for deletion to propagate...");
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (error: any) {
      if (error.message.includes("404") || error.message.includes("not found")) {
        console.log("  ✅ User does not exist (ready to create)");
        console.log("");
      } else {
        throw error;
      }
    }

    // ── 4. Create user via MCP ─────────────────────────────────────────────────
    console.log("  👤 Creating user via MCP protocol...");
    console.log(`     Email: ${TEST_USER.userPrincipalName}`);
    console.log("");

    const createdUser = await client.callTool("create_user", TEST_USER);

    console.log("  ✅ User created successfully via MCP!");
    console.log(`     User ID      : ${createdUser.id}`);
    console.log(`     Display Name : ${createdUser.displayName}`);
    console.log(`     UPN          : ${createdUser.userPrincipalName}`);
    console.log(`     Job Title    : ${createdUser.jobTitle || "(not set)"}`);
    console.log(`     Department   : ${createdUser.department || "(not set)"}`);
    console.log("");
    console.log(`  🌐 View in portal:`);
    console.log(`     https://portal.azure.com/#view/Microsoft_AAD_UsersAndTenants/UserProfileMenuBlade/~/overview/userId/${createdUser.id}`);
    console.log("");

    // ── 5. Verify via MCP ──────────────────────────────────────────────────────
    console.log("  🔍 Verifying user via MCP...");
    const verifiedUser = await client.callTool("get_user", {
      userId: createdUser.id,
    });

    console.log("  ✅ User verified!");
    console.log(`     Display Name : ${verifiedUser.displayName}`);
    console.log(`     Account Status : ${verifiedUser.accountEnabled ? "Enabled" : "Disabled"}`);
    console.log("");

    // ── Success ────────────────────────────────────────────────────────────────
    console.log("  ╭──────────────────────────────────────────────────╮");
    console.log("  │  ✅ MCP PROTOCOL TEST SUCCESSFUL!                │");
    console.log("  │                                                   │");
    console.log("  │  User was created using:                          │");
    console.log("  │  • MCP Server (stdio transport)                   │");
    console.log("  │  • JSON-RPC 2.0 protocol                          │");
    console.log("  │  • NOT HTTP POST requests                         │");
    console.log("  ╰──────────────────────────────────────────────────╯");
    console.log("");

  } catch (error: any) {
    console.error("  ❌ Test failed!");
    console.error(`     ${error.message}`);
    if (error.stack) {
      console.error("\n  Stack trace:");
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    // ── Cleanup ────────────────────────────────────────────────────────────────
    console.log("  🔌 Disconnecting from MCP Server...");
    await disconnectMCPClient();
    console.log("  ✅ Disconnected\n");
  }
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
