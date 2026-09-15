import {
  findPatristicAuthor,
  findRelevantWorks,
  type PatristicAuthorIndex,
  type PatristicWorkIndex,
} from "./corpus-lookup";
import { resolvePgAuthor } from "./resolve-pg-author";
import { verifyPgAuthorCandidate } from "./verify-pg-author-candidate";

export type PgSearchPlanWork = {
  titleSr: string;
  titleEn: string;
  titleOriginal?: string;
  pgVolume: number;
  pgColumns?: string;
  topics: string[];
};

export type PgSearchPlan = {
  query: string;
  author: PatristicAuthorIndex | null;
  authorName: string | null;
  pgVolumes: number[];
  works: PgSearchPlanWork[];
  hasSpecificAuthor: boolean;
  hasSpecificWorks: boolean;
  authorSource: "LOCAL_INDEX" | "AI_CANDIDATE" | null;
  routingVerified: boolean;
  authorVolumeVerified: boolean;
};

function uniqueNumbers(values: number[]) {
  return [...new Set(values)].sort((a, b) => a - b);
}

function hasPgVolume(
  work: PatristicWorkIndex,
): work is PatristicWorkIndex & { pgVolume: number } {
  return typeof work.pgVolume === "number";
}

function mapWork(
  work: PatristicWorkIndex & { pgVolume: number },
): PgSearchPlanWork {
  return {
    titleSr: work.titleSr,
    titleEn: work.titleEn,
    titleOriginal: work.titleOriginal,
    pgVolume: work.pgVolume,
    pgColumns: work.pgColumns,
    topics: work.topics,
  };
}

export async function buildPgSearchPlan(query: string): Promise<PgSearchPlan> {
  const normalizedQuery = query.trim();
  const localAuthor = findPatristicAuthor(normalizedQuery);

  if (localAuthor) {
    const relevantWorks = findRelevantWorks(normalizedQuery, localAuthor)
      .filter(hasPgVolume);

    if (relevantWorks.length > 0) {
      const works = relevantWorks.map(mapWork);
      return {
        query: normalizedQuery,
        author: localAuthor,
        authorName: localAuthor.canonicalName,
        pgVolumes: uniqueNumbers(works.map((work) => work.pgVolume)),
        works,
        hasSpecificAuthor: true,
        hasSpecificWorks: true,
        authorSource: "LOCAL_INDEX",
        routingVerified: true,
        authorVolumeVerified: true,
      };
    }

    return {
      query: normalizedQuery,
      author: localAuthor,
      authorName: localAuthor.canonicalName,
      pgVolumes: uniqueNumbers(localAuthor.pgVolumes ?? []),
      works: [],
      hasSpecificAuthor: true,
      hasSpecificWorks: false,
      authorSource: "LOCAL_INDEX",
      routingVerified: true,
      authorVolumeVerified: true,
    };
  }

  const resolvedAuthor = await resolvePgAuthor(normalizedQuery);

  if (!resolvedAuthor) {
    return {
      query: normalizedQuery,
      author: null,
      authorName: null,
      pgVolumes: [],
      works: [],
      hasSpecificAuthor: false,
      hasSpecificWorks: false,
      authorSource: null,
      routingVerified: false,
      authorVolumeVerified: false,
    };
  }

  const verified = await verifyPgAuthorCandidate(resolvedAuthor);

  if (!verified.routingVerified || verified.pgVolumes.length === 0) {
    return {
      query: normalizedQuery,
      author: null,
      authorName: verified.canonicalName,
      pgVolumes: [],
      works: [],
      hasSpecificAuthor: true,
      hasSpecificWorks: false,
      authorSource: verified.source,
      routingVerified: false,
      authorVolumeVerified: false,
    };
  }

  return {
    query: normalizedQuery,
    author: null,
    authorName: verified.canonicalName,
    pgVolumes: uniqueNumbers(verified.pgVolumes),
    works: [],
    hasSpecificAuthor: true,
    hasSpecificWorks: false,
    authorSource: verified.source,
    routingVerified: verified.routingVerified,
    authorVolumeVerified: verified.authorVolumeVerified,
  };
}
