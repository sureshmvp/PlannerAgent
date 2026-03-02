import fs from "fs";
import path from "path";
import { getMicrosoftGraphMCPClient } from "../clients/microsoftGraphRealMcpClient";

type UserInput = {
  displayName: string;
  userPrincipalName: string;
  mailNickname: string;
  givenName?: string;
  surname?: string;
  jobTitle?: string;
  department?: string;
  usageLocation?: string;
  password?: string;
  accountEnabled?: boolean;
  forceChangePasswordNextSignIn?: boolean;
  groups?: string[];
  devOpsTeams?: string[];
};

type CreatedUser = {
  id: string;
  displayName: string;
  userPrincipalName: string;
  status: "success" | "failed" | "skipped";
  url?: string;
  error?: string;
  groups?: string[];
  devOpsTeams?: string[];
};

function getUsersFromInput(input: any): UserInput[] {
  if (Array.isArray(input?.users)) {
    return input.users as UserInput[];
  }
  if (Array.isArray(input?.payload?.users)) {
    return input.payload.users as UserInput[];
  }
  if (Array.isArray(input?.data?.users)) {
    return input.data.users as UserInput[];
  }
  if (Array.isArray(input)) {
    return input as UserInput[];
  }
  return [];
}

function validateUser(user: UserInput, index: number) {
  if (!user.displayName) {
    throw new Error(`User at index ${index} is missing displayName.`);
  }
  if (!user.userPrincipalName) {
    throw new Error(`User at index ${index} is missing userPrincipalName.`);
  }
  if (!user.mailNickname) {
    throw new Error(`User at index ${index} is missing mailNickname.`);
  }

  // Validate email format for userPrincipalName
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(user.userPrincipalName)) {
    throw new Error(
      `User at index ${index} has invalid userPrincipalName format. Expected: user@domain.com`
    );
  }
}

function generatePassword(): string {
  const length = 16;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

function resolveDocsPath(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(process.cwd(), "docs", `users-created-${stamp}.md`);
}

function ensureDocsDir(filePath: string) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function formatDoc(users: CreatedUser[], generatedAt: string): string {
  const lines: string[] = [];

  lines.push("# Azure AD Users Created");
  lines.push("");
  lines.push(`Generated: ${generatedAt}`);
  lines.push("");

  const successCount = users.filter((u) => u.status === "success").length;
  const failedCount = users.filter((u) => u.status === "failed").length;
  const skippedCount = users.filter((u) => u.status === "skipped").length;

  lines.push(`**Summary:**`);
  lines.push(`- ✅ Created: ${successCount}`);
  lines.push(`- ❌ Failed: ${failedCount}`);
  lines.push(`- ⏭️ Skipped: ${skippedCount}`);
  lines.push("");

  lines.push("| Status | Display Name | Email | ID |");
  lines.push("|--------|--------------|-------|-----|");

  users.forEach((user) => {
    const statusIcon = user.status === "success" ? "✅" : user.status === "failed" ? "❌" : "⏭️";
    const displayName = user.displayName;
    const email = user.userPrincipalName;
    const id = user.id || "-";
    lines.push(`| ${statusIcon} | ${displayName} | ${email} | ${id} |`);
  });

  lines.push("");
  lines.push("## Details");
  lines.push("");

  users.forEach((user) => {
    lines.push(`### ${user.displayName} (${user.userPrincipalName})`);
    lines.push("");
    lines.push(`**Status:** ${user.status}`);
    
    if (user.status === "success") {
      lines.push(`**User ID:** ${user.id}`);
      if (user.url) {
        lines.push(`[View in Azure Portal](${user.url})`);
      }
      if (user.groups && user.groups.length > 0) {
        lines.push(`**Azure AD Groups:** ${user.groups.join(", ")}`);
      }
      if (user.devOpsTeams && user.devOpsTeams.length > 0) {
        lines.push(`**Azure DevOps Teams:** ${user.devOpsTeams.join(", ")}`);
      }
    } else if (user.status === "failed") {
      lines.push(`**Error:** ${user.error || "Unknown error"}`);
    } else if (user.status === "skipped") {
      lines.push(`**Reason:** User already exists`);
      if (user.id) {
        lines.push(`**Existing User ID:** ${user.id}`);
      }
    }
    
    lines.push("");
  });

  return lines.join("\n");
}

export async function createUsers(args: Record<string, any>): Promise<any> {
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
      
      // Support both JSON and CSV formats
      if (fullPath.endsWith(".csv")) {
        // Simple CSV parsing (consider using a library for production)
        const lines = raw.split("\n").filter(line => line.trim());
        if (lines.length === 0) {
          return {
            success: false,
            error: "CSV file is empty"
          };
        }
        const headers = lines[0]?.split(",").map(h => h.trim()) || [];
        const users = lines.slice(1).map(line => {
          const values = line.split(",").map(v => v.trim());
          const user: any = {};
          headers.forEach((header, i) => {
            user[header] = values[i];
          });
          return user;
        });
        input = { users };
      } else {
        input = JSON.parse(raw);
      }
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to read or parse file: ${err.message}`
      };
    }
  } else {
    input = args;
  }

  const users = getUsersFromInput(input);

  if (!users || users.length === 0) {
    return {
      success: false,
      error: "No users found in input. Expected { users: [...] } structure."
    };
  }

  // Validate all users before attempting creation
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    if (!user) {
      return {
        success: false,
        error: `Invalid user at index ${i}`
      };
    }
    try {
      validateUser(user, i);
    } catch (err: any) {
      return {
        success: false,
        error: err.message
      };
    }
  }

  const createdUsers: CreatedUser[] = [];
  const mcpClient = await getMicrosoftGraphMCPClient();

  console.log(`\n🔄 Processing ${users.length} user(s) via MCP...\n`);

  for (const user of users) {
    try {
      // Check if user already exists via MCP
      let existingUser: any = null;
      try {
        existingUser = await mcpClient.callTool("get_user", { userId: user.userPrincipalName });
      } catch {
        // 404 = user does not exist, proceed to create
      }

      if (existingUser?.id) {
        console.log(`⏭️  User ${user.userPrincipalName} already exists (ID: ${existingUser.id})`);
        createdUsers.push({
          id: existingUser.id,
          displayName: user.displayName,
          userPrincipalName: user.userPrincipalName,
          status: "skipped"
        });
        continue;
      }

      // Create the user via MCP (flat payload — MCP server handles passwordProfile)
      const password = user.password || generatePassword();
      const payload: Record<string, unknown> = {
        displayName:                   user.displayName,
        userPrincipalName:             user.userPrincipalName,
        mailNickname:                  user.mailNickname,
        accountEnabled:                user.accountEnabled !== false,
        password,
        forceChangePasswordNextSignIn: user.forceChangePasswordNextSignIn !== false,
      };
      if (user.givenName)     payload["givenName"]     = user.givenName;
      if (user.surname)       payload["surname"]       = user.surname;
      if (user.jobTitle)      payload["jobTitle"]      = user.jobTitle;
      if (user.department)    payload["department"]    = user.department;
      if (user.usageLocation) payload["usageLocation"] = user.usageLocation;

      const result = await mcpClient.callTool("create_user", payload);

      console.log(`✅ Created user: ${user.displayName} (${user.userPrincipalName})`);
      console.log(`   ID: ${result.id}`);
      if (!user.password) {
        console.log(`   Temporary Password: ${password}`);
      }

      const createdUser: CreatedUser = {
        id: result.id,
        displayName: user.displayName,
        userPrincipalName: user.userPrincipalName,
        status: "success",
        url: `https://portal.azure.com/#view/Microsoft_AAD_UsersAndTenants/UserProfileMenuBlade/~/overview/userId/${result.id}`
      };
      
      if (user.groups && user.groups.length > 0) {
        createdUser.groups = user.groups;
      }
      
      if (user.devOpsTeams && user.devOpsTeams.length > 0) {
        createdUser.devOpsTeams = user.devOpsTeams;
      }
      
      createdUsers.push(createdUser);

    } catch (err: any) {
      console.log(`❌ Failed to create user: ${user.displayName}`);
      console.log(`   Error: ${err.message}`);
      
      createdUsers.push({
        id: "",
        displayName: user.displayName,
        userPrincipalName: user.userPrincipalName,
        status: "failed",
        error: err.message
      });
    }
  }

  // Generate documentation
  const generatedAt = new Date().toISOString();
  const docPath = resolveDocsPath();
  ensureDocsDir(docPath);
  const doc = formatDoc(createdUsers, generatedAt);
  fs.writeFileSync(docPath, doc, "utf8");

  const successCount = createdUsers.filter((u) => u.status === "success").length;
  const failedCount = createdUsers.filter((u) => u.status === "failed").length;
  const skippedCount = createdUsers.filter((u) => u.status === "skipped").length;

  console.log(`\n✨ User creation complete!`);
  console.log(`   Created: ${successCount}`);
  console.log(`   Failed: ${failedCount}`);
  console.log(`   Skipped: ${skippedCount}`);
  console.log(`   Documentation: ${docPath}\n`);

  return {
    success: true,
    summary: {
      total: users.length,
      created: successCount,
      failed: failedCount,
      skipped: skippedCount
    },
    users: createdUsers,
    documentationPath: docPath
  };
}
