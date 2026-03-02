import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import {
  getMicrosoftGraphMCPClient,
  disconnectMCPClient,
} from "./clients/microsoftGraphRealMcpClient";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserDefinition {
  displayName: string;
  userPrincipalName: string;
  mailNickname: string;
  givenName?: string;
  surname?: string;
  jobTitle?: string;
  department?: string;
  usageLocation?: string;
  accountEnabled?: boolean;
  password?: string;
  forceChangePasswordNextSignIn?: boolean;
}

interface UsersFile {
  users: UserDefinition[];
}

// ─── Load users.json ──────────────────────────────────────────────────────────

function loadUsersFile(): UserDefinition[] {
  // Allow custom path via env or argument, default to users.json in project root
  const filePath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(process.cwd(), "users.json");

  if (!fs.existsSync(filePath)) {
    console.error(`  ❌ File not found: ${filePath}`);
    console.error(`     Usage: npm run create-users-mcp [path/to/users.json]`);
    process.exit(1);
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed: UsersFile = JSON.parse(raw);

    if (!Array.isArray(parsed.users) || parsed.users.length === 0) {
      console.error(`  ❌ No users found in: ${filePath}`);
      console.error(`     Make sure your JSON has a "users": [...] array.`);
      process.exit(1);
    }

    console.log(`  📂 Loaded ${parsed.users.length} user(s) from: ${filePath}`);
    return parsed.users;
  } catch (err) {
    console.error(`  ❌ Failed to parse JSON: ${filePath}`);
    console.error(`     ${err}`);
    process.exit(1);
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateUser(user: UserDefinition, index: number): string[] {
  const errors: string[] = [];
  if (!user.displayName)        errors.push("missing 'displayName'");
  if (!user.userPrincipalName)  errors.push("missing 'userPrincipalName'");
  if (!user.mailNickname)       errors.push("missing 'mailNickname'");
  if (!user.userPrincipalName?.includes("@"))
    errors.push("'userPrincipalName' must be a valid email");
  return errors.map(e => `  User[${index + 1}] (${user.displayName || "?"}): ${e}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("");
  console.log("  ╭──────────────────────────────────────────────────╮");
  console.log("  │  Azure AD Bulk User Creation via MCP              │");
  console.log("  │  Transport: stdio  |  Protocol: JSON-RPC 2.0      │");
  console.log("  ╰──────────────────────────────────────────────────╯");
  console.log("");

  // ── Load & validate ────────────────────────────────────────────────────────
  const users = loadUsersFile();

  const allErrors: string[] = [];
  users.forEach((u, i) => allErrors.push(...validateUser(u, i)));

  if (allErrors.length > 0) {
    console.error("  ❌ Validation errors found — aborting:");
    allErrors.forEach(e => console.error(e));
    process.exit(1);
  }
  console.log("  ✅ All user definitions are valid\n");

  // ── Connect via MCP ────────────────────────────────────────────────────────
  console.log("  🔌 Connecting to MCP Server (stdio)...");
  const client = await getMicrosoftGraphMCPClient();
  console.log("  ✅ Connected — using REAL MCP protocol, not HTTP POST\n");

  // ── Process users ──────────────────────────────────────────────────────────
  let created = 0;
  let skipped = 0;
  let failed  = 0;

  const results: { upn: string; status: string; id?: string }[] = [];

  for (let i = 0; i < users.length; i++) {
    const user = users[i]!;
    console.log(`  [${i + 1}/${users.length}] ${user.displayName} <${user.userPrincipalName}>`);

    // Check if user already exists
    try {
      const existing = await client.callTool("get_user", {
        userId: user.userPrincipalName,
      });

      if (existing?.id) {
        console.log(`           ⏭️  Already exists (ID: ${existing.id}) — skipped`);
        skipped++;
        results.push({ upn: user.userPrincipalName, status: "skipped", id: existing.id });
        continue;
      }
    } catch {
      // 404 = does not exist — proceed to create
    }

    // Create via MCP
    try {
      const payload: Record<string, unknown> = {
        displayName:                   user.displayName,
        userPrincipalName:             user.userPrincipalName,
        mailNickname:                  user.mailNickname,
        accountEnabled:                user.accountEnabled ?? true,
        password:                      user.password ?? "Welcome@2026!",
        forceChangePasswordNextSignIn: user.forceChangePasswordNextSignIn ?? true,
      };

      if (user.givenName)    payload["givenName"]    = user.givenName;
      if (user.surname)      payload["surname"]      = user.surname;
      if (user.jobTitle)     payload["jobTitle"]     = user.jobTitle;
      if (user.department)   payload["department"]   = user.department;
      if (user.usageLocation) payload["usageLocation"] = user.usageLocation;

      const result = await client.callTool("create_user", payload);

      console.log(`           ✅ Created  (ID: ${result.id})`);
      created++;
      results.push({ upn: user.userPrincipalName, status: "created", id: result.id });
    } catch (err: any) {
      console.error(`           ❌ Failed: ${err.message}`);
      failed++;
      results.push({ upn: user.userPrincipalName, status: "failed" });
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("");
  console.log("  ┌─────────────────────────────────────────────┐");
  console.log(`  │  ✅ Created : ${String(created).padEnd(28)}│`);
  console.log(`  │  ⏭️  Skipped : ${String(skipped).padEnd(28)}│`);
  console.log(`  │  ❌ Failed  : ${String(failed).padEnd(28)}│`);
  console.log(`  │  📊 Total   : ${String(users.length).padEnd(28)}│`);
  console.log("  └─────────────────────────────────────────────┘");

  if (created > 0) {
    console.log("\n  🌐 View users in Azure Portal:");
    results
      .filter(r => r.status === "created")
      .forEach(r =>
        console.log(
          `     https://portal.azure.com/#view/Microsoft_AAD_UsersAndTenants/UserProfileMenuBlade/~/overview/userId/${r.id}`
        )
      );
  }

  console.log("");

  if (failed > 0) process.exit(1);
}

// ─── Run ──────────────────────────────────────────────────────────────────────

main()
  .catch((err) => {
    console.error("  ❌ Unexpected error:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectMCPClient();
  });
