import { prisma } from "@/lib/prisma";

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
    const message =
      error instanceof Error
        ? error.message
        : "Unknown patristic discovery error.";

    await markJobFailedStep(
      jobId,
      message,
    );

    throw error;
  }
}


async function markJobProcessingStep(
  jobId: string,
) {
  "use step";

  const job =
    await prisma
      .patristicDiscoveryJob
      .findUnique({
        where: {
          id: jobId,
        },
      });


  if (!job) {
    return false;
  }


  if (
    job.status ===
      "COMPLETED" ||
    job.status ===
      "FAILED"
  ) {
    return false;
  }


  if (
    job.status ===
    "PENDING"
  ) {
    await prisma
      .patristicDiscoveryJob
      .update({
        where: {
          id: jobId,
        },

        data: {
          status:
            "PROCESSING",

          attempts: {
            increment: 1,
          },

          startedAt:
            new Date(),

          finishedAt:
            null,

          error:
            null,
        },
      });
  }


  return true;
}


async function discoverSourcesStep(
  jobId: string,
  query: string,
  language: "sr" | "en",
) {
  "use step";

  console.log(
    "PATRISTIC_WORKFLOW_DISCOVERY_START:",
    {
      jobId,
      query,
      language,
    },
  );


  const result =
    await discoverPatristicSourceUrls(
      query,
      language,
    );


  console.log(
    "PATRISTIC_WORKFLOW_DISCOVERY_RESULT:",
    {
      jobId,

      discovered:
        result.discovered,

      sourceUrls:
        result.sourceUrls,
    },
  );


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

  console.log(
    "PATRISTIC_WORKFLOW_EXTRACTION_START:",
    {
      jobId,
      sourceUrl,
    },
  );


  try {
    const trusted =
      findTrustedPatristicSource(
        sourceUrl,
      );


    if (!trusted) {
      console.warn(
        "PATRISTIC_WORKFLOW_UNTRUSTED_SOURCE:",
        {
          jobId,
          sourceUrl,
        },
      );

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


    console.log(
      "PATRISTIC_WORKFLOW_EXTRACTION_RESULT:",
      {
        jobId,
        sourceUrl,

        sourceName:
          trusted.name,

        textLength:
          source.text.length,

        extracted:
          extracted.length,

        exactMatches:
          exactCandidates.length,
      },
    );


    return exactCandidates;
  } catch (error) {
    console.warn(
      "PATRISTIC_WORKFLOW_SOURCE_SKIPPED:",
      {
        jobId,
        sourceUrl,

        error:
          error instanceof Error
            ? error.message
            : "Unknown source error.",
      },
    );


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
      console.warn(
        "PATRISTIC_WORKFLOW_INCOMPLETE_CANDIDATE:",
        {
          jobId,

          sourceUrl:
            candidate.sourceUrl,

          authorName:
            candidate.authorName,

          workTitle:
            candidate.workTitle,
        },
      );

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
      console.warn(
        "PATRISTIC_WORKFLOW_ATTRIBUTION_REJECTED:",
        {
          jobId,

          sourceUrl:
            candidate.sourceUrl,

          authorName:
            candidate.authorName,

          workTitle:
            candidate.workTitle,
        },
      );

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


    console.log(
      "PATRISTIC_WORKFLOW_QUOTE_SAVED:",
      {
        jobId,

        quoteId:
          saved.id,

        authorName:
          candidate.authorName,

        workTitle:
          candidate.workTitle,
      },
    );


    return saved.id;
  } catch (error) {
    console.warn(
      "PATRISTIC_WORKFLOW_CANDIDATE_SKIPPED:",
      {
        jobId,

        sourceUrl:
          candidate.sourceUrl,

        error:
          error instanceof Error
            ? error.message
            : "Unknown candidate error.",
      },
    );


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


    console.log(
      "PATRISTIC_WORKFLOW_SECOND_SOURCE_RESULT:",
      {
        jobId,
        quoteId,
        matched,
      },
    );


    return matched;
  } catch (error) {
    console.warn(
      "PATRISTIC_WORKFLOW_SECOND_SOURCE_SKIPPED:",
      {
        jobId,
        quoteId,

        error:
          error instanceof Error
            ? error.message
            : "Unknown second-source error.",
      },
    );


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


    console.log(
      "PATRISTIC_WORKFLOW_EMBED_RESULT:",
      {
        jobId,
        quoteId,
        embedded,
      },
    );


    return embedded;
  } catch (error) {
    console.warn(
      "PATRISTIC_WORKFLOW_EMBED_SKIPPED:",
      {
        jobId,
        quoteId,

        error:
          error instanceof Error
            ? error.message
            : "Unknown embedding error.",
      },
    );


    return false;
  }
}


async function markJobCompletedStep(
  jobId: string,
) {
  "use step";

  await prisma
    .patristicDiscoveryJob
    .update({
      where: {
        id: jobId,
      },

      data: {
        status:
          "COMPLETED",

        finishedAt:
          new Date(),

        error:
          null,
      },
    });
}


async function markJobFailedStep(
  jobId: string,
  error: string,
) {
  "use step";

  await prisma
    .patristicDiscoveryJob
    .updateMany({
      where: {
        id: jobId,

        status: {
          in: [
            "PENDING",
            "PROCESSING",
          ],
        },
      },

      data: {
        status:
          "FAILED",

        error,

        finishedAt:
          new Date(),
      },
    });
}