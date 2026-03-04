import dotenv from "dotenv";
dotenv.config();

import {
  getMicrosoftGraphMCPClient,
  disconnectMCPClient,
} from "./clients/microsoftGraphRealMcpClient";

// ─── Demo User ────────────────────────────────────────────────────────────────

const DEMO_USER = {
  displayName:              "Demo User",
  givenName:                "Demo",
  surname:                  "User",
  userPrincipalName:        "demo.user@workasaservice.ai",
  mailNickname:             "demo.user",
  jobTitle:                 "Test Account",
  department:               "Engineering",
  usageLocation:            "US",
  accountEnabled:           true,
  password:                 process.env.DEMO_USER_PASSWORD || "DemoTest123!",
  forceChangePasswordNextSignIn: true,
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("");
  console.log("  ╭──────────────────────────────────────────────────╮");
  console.log("  │  Microsoft Graph MCP — Connection Validator       │");
  console.log("  ╰──────────────────────────────────────────────────╯");
  console.log("");

  // ── 1. Config check ────────────────────────────────────────────────────────
  const tenantId     = process.env.AZURE_TENANT_ID     ?? "";
  const clientId     = process.env.AZURE_CLIENT_ID     ?? "";
  const clientSecret = process.env.AZURE_CLIENT_SECRET ?? "";

  console.log("  📋 Configuration:");
  console.log(`     Tenant ID   : ${tenantId     ? `✅ ${tenantId}`   : "❌ Missing (AZURE_TENANT_ID)"}`);
  console.log(`     Client ID   : ${clientId     ? `✅ ${clientId}`   : "❌ Missing (AZURE_CLIENT_ID)"}`);
  console.log(`     Secret      : ${clientSecret ? "✅ Configured"    : "❌ Missing (AZURE_CLIENT_SECRET)"}`);
  console.log("");

  if (!tenantId || !clientId || !clientSecret) {
    console.error("  ❌ Client is not configured. Check your .env file.\n");
    process.exit(1);
  }

  // ── 2. Connect + connectivity test ─────────────────────────────────────────
  console.log("  🔌 Connecting to MCP Server (stdio)...");
  const client = await getMicrosoftGraphMCPClient();
  console.log("  ✅ MCP Server connected (JSON-RPC 2.0 / stdio)\n");

  console.log("  🔗 Testing Microsoft Graph connectivity...");
  try {
    const result = await client.callTool("list_users", { top: 1 });
    const count = result?.value?.length ?? 0;
    console.log(`  ✅ Connected to Azure AD  (sampled ${count} user)\n`);
  } catch (error) {
    console.error("  ❌ Connection failed!");
    if (error instanceof Error) console.error(`     ${error.message}`);
    console.error("\n  Possible causes:");
    console.error("     • Wrong AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET");
    console.error("     • App registration missing User.ReadWrite.All or Directory.ReadWrite.All permission");
    console.error("     • Admin consent not granted\n");
    process.exit(1);
  }

  // ── 3. Create demo user ────────────────────────────────────────────────────
  console.log(`  👤 Creating demo user: ${DEMO_USER.userPrincipalName}`);
  console.log("     Checking if user already exists...");

  try {
    const existing = await client.callTool("get_user", {
      userId: DEMO_USER.userPrincipalName,
    });

    if (existing?.id) {
      console.log(`  ⏭️  User already exists — ID: ${existing.id}`);
      console.log(`     Display name : ${existing.displayName}`);
      console.log(`     Job title    : ${existing.jobTitle ?? "(not set)"}`);
      console.log(`     Account      : ${existing.accountEnabled ? "Enabled" : "Disabled"}`);
      console.log("");
      console.log("  ℹ️  Skipped creation (user already present).");
    }
  } catch {
    // User doesn't exist — create them
    try {
      const created = await client.callTool("create_user", DEMO_USER);
      console.log(`  ✅ Demo user created!`);
      console.log(`     User ID      : ${created.id}`);
      console.log(`     Display name : ${created.displayName}`);
      console.log(`     UPN          : ${created.userPrincipalName}`);
      console.log(`     Portal URL   : https://portal.azure.com/#view/Microsoft_AAD_UsersAndTenants/UserProfileMenuBlade/~/overview/userId/${created.id}`);
    } catch (createError) {
      console.error("  ❌ Failed to create demo user!");
      if (createError instanceof Error) console.error(`     ${createError.message}`);
      process.exit(1);
    }
  }

  console.log("");
  console.log("  🎉 Microsoft Graph MCP is connected and ready!\n");
}

main()
  .catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectMCPClient();
  });
