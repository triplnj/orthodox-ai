import type { PatristicResearchSource } from "@/lib/patristics/build-patristic-research-context";

export type AnswerSource = PatristicResearchSource & {
  snapshotVersion: 1;
  retrievedAt: string;
  includedInContext: boolean;
  // Intentionally empty: present providers do not return validated answer-claim links.
  claimMappings: never[];
};
export function snapshotSources(sources: PatristicResearchSource[], included: boolean): AnswerSource[] {
  return sources.map(source => ({ ...JSON.parse(JSON.stringify(source)), snapshotVersion: 1,
    retrievedAt: new Date().toISOString(), includedInContext: included, claimMappings: [] }));
}
