#!/usr/bin/env ts-node
"use strict";
/**
 * Script to create sprint items from devops-backlog.json and assign them to a sprint
 * Usage: npx ts-node scripts/createSprintItems.ts [sprintId]
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const agent_1 = require("../src/agent");
async function main() {
    const sprintId = process.argv[2];
    // Read the backlog file
    const backlogPath = path_1.default.join(process.cwd(), "devops-backlog.json");
    if (!fs_1.default.existsSync(backlogPath)) {
        console.error(`Error: ${backlogPath} not found`);
        process.exitCode = 1;
        return;
    }
    const backlogContent = fs_1.default.readFileSync(backlogPath, "utf8");
    const backlogData = JSON.parse(backlogContent);
    // Activate the agent
    const agent = await (0, agent_1.activateAgent)();
    // Create sprint items
    const input = {
        ...backlogData,
        sprintId: sprintId,
    };
    try {
        const result = await agent.routeCommand({
            command: "create-sprint-items",
            ...input,
        });
        console.log(JSON.stringify(result, null, 2));
        if (result.success) {
            console.log("\n✓ Successfully created sprint items!");
            if (sprintId) {
                console.log(`✓ Items assigned to sprint: ${sprintId}`);
            }
            else {
                console.log("⚠ No sprint ID provided - items created in backlog");
            }
        }
    }
    catch (error) {
        console.error("Error creating sprint items:", error);
        process.exitCode = 1;
    }
}
main();
//# sourceMappingURL=createSprintItems.js.map