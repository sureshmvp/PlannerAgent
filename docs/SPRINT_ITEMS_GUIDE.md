# Creating Sprint Items from devops-backlog.json

This document explains how to create sprint items in Azure DevOps from the `devops-backlog.json` file.

## Overview

The `create-sprint-items` command takes items defined in `devops-backlog.json` and creates them as User Stories in Azure DevOps. It can optionally assign them to a specific sprint.

## Quick Start

### 1. Create Sprint Items (in Backlog, No Sprint Assignment)

```bash
cat devops-backlog.json | npm run cli -- create-sprint-items
```

This will create all items from `devops-backlog.json` as User Stories in Azure DevOps without assigning them to a sprint.

### 2. Create Sprint Items with Sprint Assignment

First, find your sprint ID:

```bash
npm run cli -- list-sprints --team "Default"
```

Then create items and assign them to a sprint:

```bash
cat devops-backlog.json | npm run cli -- create-sprint-items --sprint <SPRINT_ID>
```

Or using the helper script:

```bash
npx ts-node scripts/createSprintItems.ts <SPRINT_ID>
```

## Input Format

The `devops-backlog.json` should have this structure:

```json
{
  "items": [
    {
      "order": 1,
      "title": "Item Title",
      "state": "New",
      "description": "Optional description"
    },
    {
      "order": 2,
      "title": "Another Item",
      "state": "New"
    }
  ]
}
```

### Fields

- `order` (optional): Display order in the backlog (1-based)
- `title` (required): The work item title
- `state` (optional): The work item state (e.g., "New", "Active", "Resolved", "Closed")
- `description` (optional): Detailed description of the item

## Output

After creation, the command returns:

```json
{
  "success": true,
  "command": "/create-sprint-items",
  "data": {
    "createdItems": [
      {
        "order": 1,
        "id": 19433,
        "title": "TEst",
        "type": "User Story",
        "url": "https://dev.azure.com/workasaservice/..."
      }
    ],
    "sprintId": "2026-Q1-Sprint1",
    "documentPath": "docs/sprint-created-2026-02-24T16-13-35-978Z.md"
  }
}
```

A markdown document is also created in `docs/` with a summary of all created items.

## Configuration

The Azure DevOps connection is configured via `mcp/azure-devops.json`:

```json
{
  "serverUrl": "https://dev.azure.com/workasaservice",
  "token": "YOUR_PAT_TOKEN",
  "org": "workasaservice",
  "project": "Automate"
}
```

Or via environment variables:
- `AZURE_DEVOPS_ORG_URL`
- `AZURE_DEVOPS_PAT`
- `AZURE_DEVOPS_ORG`
- `AZURE_DEVOPS_PROJECT`

## Finding Sprint IDs

To list available sprints:

```bash
npm run cli -- list-sprints --team "Default"
```

This returns a list of iterations (sprints) with their IDs which can be used with the `--sprint` flag.

## Example Workflow

1. **Prepare your backlog** in `devops-backlog.json`

2. **View available sprints**:
   ```bash
   npm run cli -- list-sprints --team "Default"
   ```

3. **Create items in a sprint**:
   ```bash
   npx ts-node scripts/createSprintItems.ts "2026-Q1-Sprint1"
   ```

4. **Check the output**:
   - Items created in Azure DevOps
   - Check the generated markdown in `docs/sprint-created-*.md`
   - View items directly at: https://dev.azure.com/workasaservice/Automate/_backlog/board/

## Troubleshooting

### "Azure DevOps MCP client is not configured"

Ensure `mcp/azure-devops.json` exists with valid credentials or set environment variables.

### "No items found in input"

Check that you're piping valid JSON with an `items` array:

```bash
cat devops-backlog.json | npm run cli -- create-sprint-items
```

### Items created but not in sprint

If no sprint ID is provided, items are created in the Backlog without sprint assignment. You can manually move them in Azure DevOps or provide a sprint ID.

## See Also

- [devops-backlog.json](../devops-backlog.json) - Example backlog file
- [Azure DevOps Configuration](../mcp/azure-devops.json) - Connection settings
- [Agent Commands](../README.md) - Other available commands
