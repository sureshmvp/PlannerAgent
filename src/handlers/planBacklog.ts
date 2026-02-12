import { agileCoreClient } from "../clients/agileCoreClient";

export async function planBacklog(input: any) {
  const requirements = input?.requirements || "docs/Requirements.md";

  const result = await agileCoreClient.planRequirementsToBacklog(requirements, input);
  return result;
}
