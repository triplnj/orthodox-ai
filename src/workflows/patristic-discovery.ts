import { getWorkflowMetadata } from "workflow";
import { prisma } from "@/lib/prisma";
import { claimPatristicJob, finishPatristicJob } from "@/lib/patristics/job-claims";
import { diagnostic, failureCategory, safeResearchFailure } from "@/lib/diagnostics";

import {
  discoverPatristicSourceUrls,
} from "@/lib/patristics/discover-and-save";

import {
  fetchSourceText,
} from "@/lib/patristics/fetch-source";

import {
  extractRelevantPatristicQuotes,
} from "@/lib/patristics/extract-quotes";

import {
  exactQuoteExists,
} from "@/lib/patristics/verify";

import {
  findTrustedPatristicSource,
} from "@/lib/patristics/trusted-sources";

import {
  verifyCandidateAttribution,
} from "@/lib/patristics/verify-attribution";

import {
  saveVerifiedDiscoveryCandidate,
} from "@/lib/patristics/save-quotes";

import {
  translateQuote,
} from "@/lib/patristics/backfill-translations";

import {
  verifyQuotesAgainstPg,
} from "@/lib/patristics/verify-second-source";

import {
  embedVerifiedQuotes,
} from "@/lib/patristics/embed-quotes";


type ExtractedCandidate =
  Awaited<
    ReturnType<
      typeof extractRelevantPatristicQuotes
    >
  >[number];


type WorkflowCandidate =
  ExtractedCandidate & {
    sourceUrl: string;
    sourceName: string;

    exactMatch: true;

    trustedSource: true;

    trustLevel:
      number | null;

    trustedSourceType:
      string | null;

    verificationError:
      null;
  };


export async function patristicDiscoveryWorkflow(
  jobId: string,
  query: string,
  language: "sr" | "en",
) {
  "use workflow";

  try {
    const canProcess =
      await markJobProcessingStep(
        jobId,
      );

    if (!canProcess) {
      return {
        processed: false,
        jobId,
        reason:
          "JOB_NOT_PROCESSABLE",
      };
    }


    const discovery =
      await discoverSourcesStep(
        jobId,
        query,
        language,
      );


    const candidates:
      WorkflowCandidate[] = [];


    for (
      const sourceUrl of
      discovery.sourceUrls
    ) {
      const extracted =
        await extractSourceStep(
          jobId,
          query,
          sourceUrl,
        );

      candidates.push(
        ...extracted,
      );
    }


    const savedQuoteIds:
      string[] = [];


    for (
      const candidate of
      candidates
    ) {
      const savedQuoteId =
        await verifyAndSaveCandidateStep(
          jobId,
          candidate,
        );

      if (savedQuoteId) {
        savedQuoteIds.push(
          savedQuoteId,
        );
      }
    }


    const uniqueQuoteIds = [
      ...new Set(
        savedQuoteIds,
      ),
    ];


    const multiSourceQuoteIds:
      string[] = [];


    for (
      const quoteId of
      uniqueQuoteIds
    ) {
      const matched =
        await verifySecondSourceStep(
          jobId,
          quoteId,
        );

      if (matched) {
        multiSourceQuoteIds.push(
          quoteId,
        );
      }
    }


    let embedded = 0;


    for (
      const quoteId of
      multiSourceQuoteIds
    ) {
      const didEmbed =
        await embedQuoteStep(
          jobId,
          quoteId,
        );

      if (didEmbed) {
        embedded += 1;
      }
    }


    await markJobCompletedStep(
      jobId,
    );


    return {
      processed: true,

      jobId,

      discovered:
        discovery.discovered,

      sources:
        discovery.sourceUrls.length,

      extracted:
        candidates.length,

      saved:
        uniqueQuoteIds.length,

      multiSourceVerified:
        multiSourceQuoteIds.length,

      embedded,
    };
  } catch (error) {
    const message = safeResearchFailure(error);

    await markJobFailedStep(
      jobId,
      message,
    );

    throw new Error(message);
  }
}


async function markJobProcessingStep(jobId: string) {
  "use step";
  return claimPatristicJob(jobId, getWorkflowMetadata().workflowRunId, true);
}

async function discoverSourcesStep(
  jobId: string,
  query: string,
  language: "sr" | "en",
) {
  "use step";

  diagnostic("operation_started", { operation: "workflow" });


  const result =
    await discoverPatristicSourceUrls(
      query,
      language,
    );


  diagnostic("operation_completed", { operation: "discovery", count: result.discovered });


  return result;
}


async function extractSourceStep(
  jobId: string,
  query: string,
  sourceUrl: string,
): Promise<
  WorkflowCandidate[]
> {
  "use step";

  diagnostic("operation_started", { operation: "extraction" });


  try {
    const trusted =
      findTrustedPatristicSource(
        sourceUrl,
      );


    if (!trusted) {
      diagnostic("operation_skipped", { operation: "extraction" });

      return [];
    }


    const source =
      await fetchSourceText(
        sourceUrl,
      );


    const extracted =
      await extractRelevantPatristicQuotes(
        source.text,
        sourceUrl,
        query,
      );


    const exactCandidates:
      WorkflowCandidate[] =
      extracted
        .filter(
          (candidate) =>
            exactQuoteExists(
              candidate.originalText,
              source.text,
            ),
        )
        .map(
          (candidate) => ({
            ...candidate,

            sourceUrl,

            sourceName:
              trusted.name,

            exactMatch:
              true,

            trustedSource:
              true,

            trustLevel:
              trusted.trustLevel ??
              null,

            trustedSourceType:
              trusted.sourceType ??
              null,

            verificationError:
              null,
          }),
        );


    diagnostic("operation_completed", { operation: "extraction", count: exactCandidates.length });


    return exactCandidates;
  } catch (error) {
    diagnostic("operation_skipped", { operation: "extraction", failure: failureCategory(error) });


    return [];
  }
}


async function verifyAndSaveCandidateStep(
  jobId: string,
  candidate: WorkflowCandidate,
) {
  "use step";

  try {
    if (
      !candidate.authorName ||
      !candidate.workTitle
    ) {
      diagnostic("operation_skipped", { operation: "verification" });

      return null;
    }


    const attribution =
      await verifyCandidateAttribution(
        candidate,
      );


    if (
      !attribution
        .matchesClaimedAuthor
    ) {
      diagnostic("operation_skipped", { operation: "verification" });

      return null;
    }


    const saved =
      await saveVerifiedDiscoveryCandidate(
        candidate,
        attribution,
      );


    const translation =
      await translateQuote(
        candidate.originalText,

        candidate.originalLanguage ??
          "Unknown",
      );


    await prisma
      .patristicQuote
      .update({
        where: {
          id: saved.id,
        },

        data: {
          translationSr:
            saved.translationSr ??
            translation.translationSr,

          translationEn:
            saved.translationEn ??
            translation.translationEn,
        },
      });


    diagnostic("operation_completed", { operation: "workflow" });


    return saved.id;
  } catch (error) {
    diagnostic("operation_skipped", { operation: "verification", failure: failureCategory(error) });


    return null;
  }
}


async function verifySecondSourceStep(
  jobId: string,
  quoteId: string,
) {
  "use step";

  try {
    const result =
      await verifyQuotesAgainstPg(
        [quoteId],
      );


    const matched =
      result.matched > 0;


    diagnostic("operation_completed", { operation: "verification" });


    return matched;
  } catch (error) {
    diagnostic("operation_skipped", { operation: "verification", failure: failureCategory(error) });


    return false;
  }
}


async function embedQuoteStep(
  jobId: string,
  quoteId: string,
) {
  "use step";

  try {
    const result =
      await embedVerifiedQuotes(
        [quoteId],
      );


    const embedded =
      result.embedded > 0;


    diagnostic("operation_completed", { operation: "embedding" });


    return embedded;
  } catch (error) {
    diagnostic("operation_skipped", { operation: "embedding", failure: failureCategory(error) });


    return false;
  }
}


async function markJobCompletedStep(jobId: string) {
  "use step";
  await finishPatristicJob(jobId, getWorkflowMetadata().workflowRunId);
}

async function markJobFailedStep(jobId: string, error: string) {
  "use step";
  await finishPatristicJob(jobId, getWorkflowMetadata().workflowRunId, error);
}
