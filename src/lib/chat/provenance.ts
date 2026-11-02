import type { PatristicResearchSource } from "@/lib/patristics/build-patristic-research-context";
import type { AuditedClaim } from "./claim-audit";

export type AnswerSource = PatristicResearchSource & {
  snapshotVersion: 1;
  retrievedAt: string;
  includedInContext: boolean;
  // A verbatim excerpt match, not an independently established theological proof.
  claimMappings: { claim: string; evidenceQuote: string; reviewStatus: "excerpt_matched" }[];
};
export function snapshotSources(sources: PatristicResearchSource[], included: boolean, audited: AuditedClaim[] = []): AnswerSource[] {
  return sources.map((source, index) => ({ ...JSON.parse(JSON.stringify(source)), snapshotVersion: 1 as const,
    retrievedAt: new Date().toISOString(), includedInContext: included,
    claimMappings: audited.filter(item => item.status === "excerpt_matched" && item.sourceIndex === index && item.evidenceQuote)
      .map(item => ({ claim: item.claim, evidenceQuote: item.evidenceQuote!, reviewStatus: "excerpt_matched" as const })) }));
}
