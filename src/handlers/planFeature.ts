import { agileCoreClient } from "../clients/agileCoreClient";

export async function planFeature(input: any) {
  // Stub: Return handler reached
  return "Handler reached";
  
  // TODO: Full implementation below (currently commented out)
  // const feature = input?.feature || input?.text || input?.requirements;
  // if (!feature) {
  //   throw new Error("plan-feature requires a feature description or path to a feature file.");
  // }
  // const result = await agileCoreClient.planFeature(feature, input);
  // return result;
}
