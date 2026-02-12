# Ops360-AI

AgileProcess Planner agent for turning requirements, features, and sprint goals into backlog-ready output.

## What it does
- Plans a backlog from requirements text or a requirements file.
- Splits a feature into user stories and tasks.
- Assists sprint planning using goals, scope, and constraints.

## Setup
1. Install dependencies: `npm install`
2. Copy and edit environment variables: `cp .env.example .env`
3. Update config defaults in `config/default-config.json` (optional).

## Configuration
The agent reads configuration from `config/default-config.json` and overrides via environment variables.

Required (for AgileProcess Core):
- `OPS360_AGILE_CORE_BASE_URL`
- `OPS360_AGILE_CORE_API_KEY` (if required by the API)

Optional:
- `OPS360_AGILE_CORE_TIMEOUT_MS`
- `OPS360_AGILE_CORE_ENDPOINT_PLAN_BACKLOG`
- `OPS360_AGILE_CORE_ENDPOINT_PLAN_FEATURE`
- `OPS360_AGILE_CORE_ENDPOINT_PLAN_SPRINT`

## Commands
These handlers are available via `activateAgent()`:
- `plan-backlog`
- `plan-feature`
- `plan-sprint`

Example payloads are in [docs/usage-guide.md](docs/usage-guide.md).

## Development
- Build: `npm run build`
- Run (ts-node): `npm run dev`
- Run (compiled): `npm run start`

## CLI
After building, you can run:
```
ops360-ai plan-backlog '{"requirements":"docs/Requirements.md"}'
```
Or via ts-node:
```
npm run cli -- plan-backlog '{"requirements":"docs/Requirements.md"}'
```

## Notes
This repo provides the agent core and API client wiring. The runtime host is expected to call `activateAgent()` and route inputs to the command handlers.
