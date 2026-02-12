# Usage Guide

## plan-backlog
Input:
```json
{
  "requirements": "docs/Requirements.md",
  "options": {
    "includeEstimates": true
  }
}
```

## plan-feature
Input:
```json
{
  "feature": "Build a self-serve reporting dashboard for project owners.",
  "options": {
    "splitByPersona": true
  }
}
```

## plan-sprint
Input:
```json
{
  "sprint": {
    "goal": "Ship onboarding v2",
    "capacityDays": 40,
    "constraints": ["No database migrations"]
  }
}
```

## File-based inputs
If a value looks like a file path and exists, the agent reads the file content automatically.
