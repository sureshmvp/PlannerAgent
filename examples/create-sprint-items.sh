#!/bin/bash

# Sprint Items Creation - Example Commands

# 1. Build the project
npm run build

# 2. Create sprint items from devops-backlog.json (no sprint assignment)
# Items will be created in the backlog
cat devops-backlog.json | npm run cli -- create-sprint-items

# 3. List available sprints to find sprint ID
npm run cli -- list-sprints --team "Default"

# 4. Create sprint items and assign to a specific sprint
# Replace "2026-Q1-Sprint1" with actual sprint ID
cat devops-backlog.json | npm run cli -- create-sprint-items --sprint "2026-Q1-Sprint1"

# 5. Using the helper script (alternative method)
# Creates items from devops-backlog.json and assigns to sprint
npx ts-node scripts/createSprintItems.ts "2026-Q1-Sprint1"

# 6. View created items documentation
ls -la docs/sprint-created-*.md
cat docs/sprint-created-*.md | tail -20

# 7. View items in Azure DevOps
# Open: https://dev.azure.com/workasaservice/Automate/_backlog/board

echo "Sprint items creation examples complete!"
