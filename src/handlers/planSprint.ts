import { agileCoreClient } from "../clients/agileCoreClient";

export async function planSprint(input: any) {
  const sprint = input?.sprint || input?.goals || input;
  if (!sprint) {
    throw new Error("plan-sprint requires sprint goals, details, or a file path.");
  }

  const result = await agileCoreClient.planSprint(sprint, input);
  return result;
}
