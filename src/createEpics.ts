import { azureDevOpsMcpClient } from "./clients/azureDevOpsMcpClient";

async function createEpics() {
  const epicCount = 5;
  const createdEpics = [];

  console.log("🚀 Creating 5 Epics...\n");

  for (let i = 1; i <= epicCount; i++) {
    try {
      const result = await azureDevOpsMcpClient.callTool("create-work-item", {
        type: "Epic",
        title: `chhanda Behera - Epic ${i}`,
        description: `Epic ${i} created via MCP for chhanda Behera`
      });

      createdEpics.push({
        id: result.id,
        title: result.fields["System.Title"],
        state: result.fields["System.State"]
      });

      console.log(`✅ Epic ${i} created!`);
      console.log(`   ID: ${result.id}, Title: ${result.fields["System.Title"]}\n`);
    } catch (error) {
      console.error(
        `❌ Failed to create Epic ${i}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  console.log("📊 Summary:");
  console.log(`   Total Epics Created: ${createdEpics.length}`);
  createdEpics.forEach((epic, idx) => {
    console.log(`   ${idx + 1}. ID: ${epic.id}, Title: ${epic.title}`);
  });
}

createEpics().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
