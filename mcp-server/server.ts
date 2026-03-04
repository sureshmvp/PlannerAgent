#!/usr/bin/env node
/**
 * Microsoft Graph MCP Server
 * 
 * A Model Context Protocol server for Microsoft Graph / Azure AD operations.
 * Runs as a standalone process and communicates via stdio.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js";
import "isomorphic-fetch";

// ─── Configuration ────────────────────────────────────────────────────────────

const config = {
  tenantId:     process.env.AZURE_TENANT_ID,
  clientId:     process.env.AZURE_CLIENT_ID,
  clientSecret: process.env.AZURE_CLIENT_SECRET,
};

if (!config.tenantId || !config.clientId || !config.clientSecret) {
  console.error("❌ Missing required environment variables:");
  console.error("   AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET");
  process.exit(1);
}

// ─── Microsoft Graph Client ───────────────────────────────────────────────────

const credential = new ClientSecretCredential(
  config.tenantId,
  config.clientId,
  config.clientSecret
);

const authProvider = new TokenCredentialAuthenticationProvider(credential, {
  scopes: ["https://graph.microsoft.com/.default"],
});

const graphClient = Client.initWithMiddleware({ authProvider });

// ─── MCP Server ───────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: "microsoft-graph-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ─── Tool Definitions ─────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_user",
      description: "Create a new user in Azure AD / Microsoft Entra ID",
      inputSchema: {
        type: "object",
        properties: {
          displayName: {
            type: "string",
            description: "Full display name (e.g., 'John Doe')",
          },
          userPrincipalName: {
            type: "string",
            description: "User principal name / email (e.g., 'john.doe@domain.com')",
          },
          mailNickname: {
            type: "string",
            description: "Mail alias (e.g., 'john.doe')",
          },
          password: {
            type: "string",
            description: "Initial password (required for user creation)",
          },
          givenName: { type: "string", description: "First name" },
          surname: { type: "string", description: "Last name" },
          jobTitle: { type: "string", description: "Job title" },
          department: { type: "string", description: "Department" },
          usageLocation: {
            type: "string",
            description: "Two-letter country code (e.g., 'US', 'GB')",
          },
          accountEnabled: {
            type: "boolean",
            description: "Enable the account (default: true)",
          },
          forceChangePasswordNextSignIn: {
            type: "boolean",
            description: "Force password change on first sign-in (default: true)",
          },
        },
        required: ["displayName", "userPrincipalName", "mailNickname"],
      },
    },
    {
      name: "get_user",
      description: "Get user details by user principal name or ID",
      inputSchema: {
        type: "object",
        properties: {
          userId: {
            type: "string",
            description: "User principal name or user ID",
          },
        },
        required: ["userId"],
      },
    },
    {
      name: "list_users",
      description: "List users with optional filtering",
      inputSchema: {
        type: "object",
        properties: {
          top: {
            type: "number",
            description: "Maximum number of results (default: 100)",
          },
          filter: {
            type: "string",
            description: "OData filter query (e.g., \"department eq 'Engineering'\")",
          },
        },
      },
    },
    {
      name: "delete_user",
      description: "Delete a user from Azure AD",
      inputSchema: {
        type: "object",
        properties: {
          userId: {
            type: "string",
            description: "User principal name or user ID to delete",
          },
        },
        required: ["userId"],
      },
    },
    {
      name: "create_group",
      description: "Create a new group in Azure AD",
      inputSchema: {
        type: "object",
        properties: {
          displayName: { type: "string", description: "Group name" },
          mailNickname: { type: "string", description: "Mail alias" },
          description: { type: "string", description: "Group description" },
          mailEnabled: {
            type: "boolean",
            description: "Enable mail for this group (default: false)",
          },
          securityEnabled: {
            type: "boolean",
            description: "Mark as security group (default: true)",
          },
        },
        required: ["displayName", "mailNickname"],
      },
    },
    {
      name: "add_group_member",
      description: "Add a user to a group",
      inputSchema: {
        type: "object",
        properties: {
          groupId: { type: "string", description: "Group ID" },
          userId: { type: "string", description: "User ID to add" },
        },
        required: ["groupId", "userId"],
      },
    },
    {
      name: "list_groups",
      description: "List all groups",
      inputSchema: {
        type: "object",
        properties: {
          top: { type: "number", description: "Max results (default: 100)" },
        },
      },
    },
    {
      name: "get_group",
      description: "Find a group by displayName",
      inputSchema: {
        type: "object",
        properties: {
          displayName: { type: "string", description: "Exact group display name" },
        },
        required: ["displayName"],
      },
    },
    {
      name: "get_user_groups",
      description: "Get all groups a user is a member of",
      inputSchema: {
        type: "object",
        properties: {
          userId: { type: "string", description: "User principal name or user ID" },
        },
        required: ["userId"],
      },
    },
  ],
}));

// ─── Tool Handlers ────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let result: any;

    switch (name) {
      case "create_user": {
        const userPayload: any = {
          displayName: args.displayName,
          userPrincipalName: args.userPrincipalName,
          mailNickname: args.mailNickname,
          accountEnabled: args.accountEnabled ?? true,
          passwordProfile: {
            password: args.password ?? process.env.DEFAULT_USER_PASSWORD ?? "TempUser123!",
            forceChangePasswordNextSignIn:
              args.forceChangePasswordNextSignIn ?? true,
          },
        };

        if (args.givenName) userPayload.givenName = args.givenName;
        if (args.surname) userPayload.surname = args.surname;
        if (args.jobTitle) userPayload.jobTitle = args.jobTitle;
        if (args.department) userPayload.department = args.department;
        if (args.usageLocation) userPayload.usageLocation = args.usageLocation;

        result = await graphClient.api("/users").post(userPayload);
        break;
      }

      case "get_user": {
        result = await graphClient.api(`/users/${args.userId}`).get();
        break;
      }

      case "list_users": {
        let query = graphClient.api("/users");
        if (args.top) query = query.top(args.top as number);
        if (args.filter) query = query.filter(args.filter as string);
        result = await query.get();
        break;
      }

      case "delete_user": {
        await graphClient.api(`/users/${args.userId}`).delete();
        result = { success: true, message: `User '${args.userId}' deleted` };
        break;
      }

      case "create_group": {
        const groupPayload: any = {
          displayName: args.displayName,
          mailNickname: args.mailNickname,
          mailEnabled: args.mailEnabled ?? false,
          securityEnabled: args.securityEnabled ?? true,
        };
        if (args.description) groupPayload.description = args.description;

        result = await graphClient.api("/groups").post(groupPayload);
        break;
      }

      case "add_group_member": {
        await graphClient.api(`/groups/${args.groupId}/members/$ref`).post({
          "@odata.id": `https://graph.microsoft.com/v1.0/users/${args.userId}`,
        });
        result = {
          success: true,
          message: `User '${args.userId}' added to group '${args.groupId}'`,
        };
        break;
      }

      case "list_groups": {
        let query = graphClient.api("/groups");
        if (args.top) query = query.top(args.top as number);
        result = await query.get();
        break;
      }

      case "get_group": {
        const name = (args.displayName as string).replace(/'/g, "\\'");
        result = await graphClient
          .api("/groups")
          .filter(`displayName eq '${name}'`)
          .get();
        // Return first match or null
        result = result?.value?.[0] ?? null;
        break;
      }

      case "get_user_groups": {
        result = await graphClient
          .api(`/users/${args.userId}/memberOf`)
          .get();
        break;
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}\n${
            error.body ? JSON.stringify(error.body, null, 2) : ""
          }`,
        },
      ],
      isError: true,
    };
  }
});

// ─── Start Server ─────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("✅ Microsoft Graph MCP Server running on stdio");
}

main().catch((error) => {
  console.error("❌ Server failed to start:", error);
  process.exit(1);
});
