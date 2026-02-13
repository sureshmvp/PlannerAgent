import { resolveAzureDevOpsMcpConfig, azureDevOpsMcpClient } from "./clients/azureDevOpsMcpClient";

async function validateMcpConnection() {
  console.log("🔍 Validating Azure DevOps MCP Connection...\n");

  const config = resolveAzureDevOpsMcpConfig();

  // Check configuration
  console.log("📋 Configuration Status:");
  console.log(`  ✓ Server URL: ${config.serverUrl ? "✓ Configured" : "✗ Missing"}`);
  console.log(`  ✓ Token: ${config.token ? "✓ Configured" : "✗ Missing"}`);
  console.log(`  ✓ Organization: ${config.org ? `${config.org}` : "✗ Missing"}`);
  console.log(`  ✓ Project: ${config.project ? `${config.project}` : "✗ Missing"}\n`);

  if (!azureDevOpsMcpClient.isConfigured()) {
    console.error("❌ MCP Client is not properly configured!");
    process.exit(1);
  }

  console.log("✅ MCP Client Configuration Valid\n");

  // Test connection
  console.log("🔗 Testing Azure DevOps Connection...");
  try {
    const result = await azureDevOpsMcpClient.callTool("list-work-items", {});
    console.log("✅ Connection successful!");
    console.log(`   Found ${result.workItems?.length || 0} work items\n`);
  } catch (error) {
    console.error("❌ Connection test failed!");
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}\n`);
    }
    process.exit(1);
  }

  console.log("🎉 Azure DevOps MCP is ready to use!");
}

validateMcpConnection().catch((error) => {
  console.error("Validation failed:", error);
  process.exit(1);
});
