import fs from "fs";
import path from "path";
import { getMicrosoftGraphMCPClient } from "../clients/microsoftGraphRealMcpClient";

type UserGroupAssignment = {
  userPrincipalName: string;
  groups: string[];
};

type AssignmentResult = {
  userPrincipalName: string;
  userId?: string;
  assignments: {
    groupName: string;
    groupId?: string;
    status: "success" | "failed" | "skipped";
    error?: string;
  }[];
};

function getAssignmentsFromInput(input: any): UserGroupAssignment[] {
  if (Array.isArray(input?.assignments)) {
    return input.assignments as UserGroupAssignment[];
  }
  if (Array.isArray(input?.payload?.assignments)) {
    return input.payload.assignments as UserGroupAssignment[];
  }
  if (Array.isArray(input?.data?.assignments)) {
    return input.data.assignments as UserGroupAssignment[];
  }
  
  // Support direct user list with groups
  if (Array.isArray(input?.users)) {
    return input.users
      .filter((u: any) => u.groups && u.groups.length > 0)
      .map((u: any) => ({
        userPrincipalName: u.userPrincipalName,
        groups: u.groups
      }));
  }
  
  if (Array.isArray(input)) {
    return input as UserGroupAssignment[];
  }
  
  return [];
}

function validateAssignment(assignment: UserGroupAssignment, index: number) {
  if (!assignment.userPrincipalName) {
    throw new Error(`Assignment at index ${index} is missing userPrincipalName.`);
  }
  if (!assignment.groups || !Array.isArray(assignment.groups) || assignment.groups.length === 0) {
    throw new Error(`Assignment at index ${index} is missing groups array.`);
  }
}

function resolveDocsPath(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(process.cwd(), "docs", `group-assignments-${stamp}.md`);
}

function ensureDocsDir(filePath: string) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function formatDoc(results: AssignmentResult[], generatedAt: string): string {
  const lines: string[] = [];

  lines.push("# Azure AD Group Assignments");
  lines.push("");
  lines.push(`Generated: ${generatedAt}`);
  lines.push("");

  let totalAssignments = 0;
  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  results.forEach((result) => {
    result.assignments.forEach((assignment) => {
      totalAssignments++;
      if (assignment.status === "success") successCount++;
      else if (assignment.status === "failed") failedCount++;
      else if (assignment.status === "skipped") skippedCount++;
    });
  });

  lines.push(`**Summary:**`);
  lines.push(`- Total Assignments: ${totalAssignments}`);
  lines.push(`- ✅ Success: ${successCount}`);
  lines.push(`- ❌ Failed: ${failedCount}`);
  lines.push(`- ⏭️ Skipped: ${skippedCount}`);
  lines.push("");

  lines.push("## Assignment Details");
  lines.push("");

  results.forEach((result) => {
    lines.push(`### ${result.userPrincipalName}`);
    lines.push("");
    
    if (result.userId) {
      lines.push(`**User ID:** ${result.userId}`);
      lines.push(
        `[View User in Azure Portal](https://portal.azure.com/#view/Microsoft_AAD_UsersAndTenants/UserProfileMenuBlade/~/overview/userId/${result.userId})`
      );
      lines.push("");
    }

    lines.push("| Status | Group | Group ID | Notes |");
    lines.push("|--------|-------|----------|-------|");

    result.assignments.forEach((assignment) => {
      const statusIcon = assignment.status === "success" ? "✅" : assignment.status === "failed" ? "❌" : "⏭️";
      const groupName = assignment.groupName;
      const groupId = assignment.groupId || "-";
      const notes = assignment.error || (assignment.status === "skipped" ? "Already a member" : "-");
      lines.push(`| ${statusIcon} | ${groupName} | ${groupId} | ${notes} |`);
    });

    lines.push("");
  });

  return lines.join("\n");
}

export async function assignUsersToGroups(args: Record<string, any>): Promise<any> {
  if (!process.env.AZURE_TENANT_ID || !process.env.AZURE_CLIENT_ID || !process.env.AZURE_CLIENT_SECRET) {
    return {
      success: false,
      error:
        "Microsoft Graph MCP is not configured. Please set AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET environment variables."
    };
  }

  let input: any;
  const filePath = args.file || args.input || args.path;

  if (filePath) {
    const fullPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      return {
        success: false,
        error: `File not found: ${filePath}`
      };
    }

    try {
      const raw = fs.readFileSync(fullPath, "utf8");
      input = JSON.parse(raw);
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to read or parse file: ${err.message}`
      };
    }
  } else {
    input = args;
  }

  const assignments = getAssignmentsFromInput(input);

  if (!assignments || assignments.length === 0) {
    return {
      success: false,
      error: "No assignments found in input. Expected { assignments: [{ userPrincipalName, groups: [...] }] } structure."
    };
  }

  // Validate all assignments before processing
  for (let i = 0; i < assignments.length; i++) {
    const assignment = assignments[i];
    if (!assignment) {
      return {
        success: false,
        error: `Invalid assignment at index ${i}`
      };
    }
    try {
      validateAssignment(assignment, i);
    } catch (err: any) {
      return {
        success: false,
        error: err.message
      };
    }
  }

  const results: AssignmentResult[] = [];
  const mcpClient = await getMicrosoftGraphMCPClient();

  console.log(`\n🔄 Processing group assignments for ${assignments.length} user(s) via MCP...\n`);

  for (const assignment of assignments) {
    const result: AssignmentResult = {
      userPrincipalName: assignment.userPrincipalName,
      assignments: []
    };

    try {
      // Get user via MCP
      let user: any = null;
      try {
        user = await mcpClient.callTool("get_user", { userId: assignment.userPrincipalName });
      } catch {
        // user not found
      }

      if (!user?.id) {
        console.log(`❌ User not found: ${assignment.userPrincipalName}`);
        assignment.groups.forEach((groupName) => {
          result.assignments.push({
            groupName,
            status: "failed",
            error: "User not found"
          });
        });
        results.push(result);
        continue;
      }

      result.userId = user.id;
      console.log(`\n👤 Processing user: ${assignment.userPrincipalName} (${user.id})`);

      // Get user's existing groups via MCP
      const groupsResult = await mcpClient.callTool("get_user_groups", { userId: user.id });
      const existingGroupNames = new Set(
        (groupsResult?.value ?? []).map((g: any) => g.displayName as string)
      );

      // Process each group assignment
      for (const groupName of assignment.groups) {
        try {
          // Check if user is already in the group
          if (existingGroupNames.has(groupName)) {
            console.log(`   ⏭️  Already in group: ${groupName}`);
            result.assignments.push({
              groupName,
              status: "skipped"
            });
            continue;
          }

          // Find the group via MCP
          const group = await mcpClient.callTool("get_group", { displayName: groupName });

          if (!group?.id) {
            console.log(`   ❌ Group not found: ${groupName}`);
            result.assignments.push({
              groupName,
              status: "failed",
              error: "Group not found"
            });
            continue;
          }

          // Add user to group via MCP
          await mcpClient.callTool("add_group_member", { groupId: group.id, userId: user.id });
          console.log(`   ✅ Added to group: ${groupName}`);

          result.assignments.push({
            groupName,
            groupId: group.id,
            status: "success"
          });

        } catch (err: any) {
          console.log(`   ❌ Failed to add to group: ${groupName}`);
          console.log(`      Error: ${err.message}`);

          result.assignments.push({
            groupName,
            status: "failed",
            error: err.message
          });
        }
      }

    } catch (err: any) {
      console.log(`❌ Error processing user: ${assignment.userPrincipalName}`);
      console.log(`   Error: ${err.message}`);
      
      assignment.groups.forEach((groupName) => {
        result.assignments.push({
          groupName,
          status: "failed",
          error: `User processing error: ${err.message}`
        });
      });
    }

    results.push(result);
  }

  // Generate documentation
  const generatedAt = new Date().toISOString();
  const docPath = resolveDocsPath();
  ensureDocsDir(docPath);
  const doc = formatDoc(results, generatedAt);
  fs.writeFileSync(docPath, doc, "utf8");

  let totalAssignments = 0;
  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  results.forEach((result) => {
    result.assignments.forEach((assignment) => {
      totalAssignments++;
      if (assignment.status === "success") successCount++;
      else if (assignment.status === "failed") failedCount++;
      else if (assignment.status === "skipped") skippedCount++;
    });
  });

  console.log(`\n✨ Group assignment complete!`);
  console.log(`   Total Assignments: ${totalAssignments}`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failedCount}`);
  console.log(`   Skipped: ${skippedCount}`);
  console.log(`   Documentation: ${docPath}\n`);

  return {
    success: true,
    summary: {
      totalAssignments,
      success: successCount,
      failed: failedCount,
      skipped: skippedCount
    },
    results,
    documentationPath: docPath
  };
}
