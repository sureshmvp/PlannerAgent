import dotenv from "dotenv";

import { planBacklog } from "./handlers/planBacklog";
import { planFeature } from "./handlers/planFeature";
import { planSprint } from "./handlers/planSprint";

dotenv.config();

export async function activateAgent() {
  console.log("AgileProcess Planner Ready!");

  return {
    commands: {
      "plan-backlog": async (input: any) => {
        return await planBacklog(input);
      },
      "plan-feature": async (input: any) => {
        return await planFeature(input);
      },
      "plan-sprint": async (input: any) => {
        return await planSprint(input);
      }
    }
  };
}
