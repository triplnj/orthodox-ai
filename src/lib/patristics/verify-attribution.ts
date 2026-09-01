import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

import {
  fetchSourceText,
} from "./fetch-source";

import type {
  VerifiedDiscoveryCandidate,
} from "./verify-discovery";


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


const AttributionResultSchema = z.object({
  matchesClaimedAuthor: z.boolean(),

  actualAuthorName:
    z.string().nullable(),

  reason:
    z.string(),
});


export type AttributionResult =
  z.infer<
    typeof AttributionResultSchema
  >;


function normalizeText(
  value: string,
) {
  return value
    .normalize("NFC")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function extractQuoteContext(
  sourceText: string,
  quoteText: string,
  radius = 1800,
) {
  const source =
    normalizeText(
      sourceText,
    );

  const quote =
    normalizeText(
      quoteText,
    );

  const index =
    source.indexOf(
      quote,
    );

  if (index === -1) {
    return null;
  }

  const start =
    Math.max(
      0,
      index - radius,
    );

  const end =
    Math.min(
      source.length,
      index +
        quote.length +
        radius,
    );

  return source.slice(
    start,
    end,
  );
}


function extractDocumentBeginning(
  sourceText: string,
  length = 3000,
) {
  return normalizeText(
    sourceText,
  ).slice(
    0,
    length,
  );
}


function getParentWorkUrl(
  sourceUrl: string,
) {
  try {
    const url =
      new URL(
        sourceUrl,
      );

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return null;
    }

    const pathname =
      url.pathname;

    /*
     * Do not try to infer a parent work
     * page from a direct PDF/file URL.
     */
    const lastSegment =
      pathname
        .replace(/\/+$/, "")
        .split("/")
        .pop() ??
      "";

    if (
      /\.[a-z0-9]{2,8}$/i.test(
        lastSegment,
      )
    ) {
      return null;
    }

    const segments =
      pathname
        .split("/")
        .filter(Boolean);

    /*
     * We need at least:
     *
     * /work/chapter/
     *
     * Otherwise the parent would only
     * be the site root.
     */
    if (
      segments.length < 2
    ) {
      return null;
    }

    segments.pop();

    url.pathname =
      `/${segments.join("/")}/`;

    url.search = "";
    url.hash = "";

    const parentUrl =
      url.toString();

    if (
      parentUrl ===
      sourceUrl
    ) {
      return null;
    }

    return parentUrl;

  } catch {
    return null;
  }
}


async function loadWorkLevelEvidence(
  sourceUrl: string,
) {
  const parentUrl =
    getParentWorkUrl(
      sourceUrl,
    );

  if (!parentUrl) {
    return null;
  }

  try {
    const parent =
      await fetchSourceText(
        parentUrl,
      );

    return {
      url:
        parentUrl,

      title:
        parent.title,

      beginning:
        extractDocumentBeginning(
          parent.text,
        ),
    };

  } catch {
    /*
     * Work-level evidence is optional.
     *
     * Failure to load the parent page
     * must not fail attribution of the
     * original source page.
     */
    return null;
  }
}


export async function verifyCandidateAttribution(
  candidate: VerifiedDiscoveryCandidate,
): Promise<AttributionResult> {

  const model =
    process.env.PATRISTICS_MODEL;

  if (!model) {
    throw new Error(
      "PATRISTICS_MODEL is not configured.",
    );
  }


  if (!candidate.exactMatch) {
    return {
      matchesClaimedAuthor:
        false,

      actualAuthorName:
        null,

      reason:
        "Exact quotation match was not verified.",
    };
  }


  let sourceText:
    string;

  let sourceTitle:
    string;


  try {
    const source =
      await fetchSourceText(
        candidate.sourceUrl,
      );

    sourceText =
      source.text;

    sourceTitle =
      source.title;

  } catch (error) {

    return {
      matchesClaimedAuthor:
        false,

      actualAuthorName:
        null,

      reason:
        error instanceof Error
          ? `Could not load source for attribution verification: ${error.message}`
          : "Could not load source for attribution verification.",
    };
  }


  const context =
    extractQuoteContext(
      sourceText,
      candidate.originalText,
    );


  if (!context) {
    return {
      matchesClaimedAuthor:
        false,

      actualAuthorName:
        null,

      reason:
        "The verified quotation could not be located in source context.",
    };
  }


  const documentBeginning =
    extractDocumentBeginning(
      sourceText,
    );


  const workLevelEvidence =
    await loadWorkLevelEvidence(
      candidate.sourceUrl,
    );


  const workLevelBlock =
    workLevelEvidence
      ? `
WORK-LEVEL SOURCE URL:
${workLevelEvidence.url}

WORK-LEVEL SOURCE TITLE:
${workLevelEvidence.title || "Not available"}

WORK-LEVEL DOCUMENT BEGINNING:
${workLevelEvidence.beginning}
      `.trim()
      : `
WORK-LEVEL SOURCE:
Not available.
      `.trim();


  const response =
    await openai.responses.parse({
      model,

      input: [
        {
          role:
            "system",

          content: `
You verify authorship attribution of patristic quotations
using ONLY the supplied source evidence.

CRITICAL RULES:

1. Do not use memory or outside knowledge.

2. Do not decide authorship merely because you
recognize the quotation.

3. The quotation text has already been verified
programmatically as existing in the DIRECT SOURCE.

4. Determine whether the supplied SOURCE EVIDENCE
itself supports attribution of the quotation to
the claimed author.

5. SOURCE EVIDENCE may contain:
- the direct page or document title,
- the beginning of the direct document,
- local context surrounding the quotation,
- an optional WORK-LEVEL parent page from
  the same website.

6. The DIRECT SOURCE is the source in which the
quotation itself was programmatically verified.

7. WORK-LEVEL SOURCE evidence must NEVER be used
to claim that the quotation occurs there.
It is supplied only as possible evidence about
the author and identity of the larger work.

8. A work-level parent page may support attribution
only when it clearly identifies the claimed author
and the same work or chapter structure to which
the DIRECT SOURCE clearly belongs.

9. For example, if:
- the direct page contains "Step V" of a work,
- the parent work page identifies the work's author,
- and the parent page lists that same "Step V",
then the combined evidence may establish authorship.

10. Do not infer authorship merely because two pages
are on the same website.

11. A page author is NOT automatically the author
of every quotation appearing on the page.

12. A document beginning that clearly identifies
an author and work may be used as evidence when
the local quotation context is clearly part of
that same work.

13. Watch especially for wording such as:
"X said",
"according to X",
"Abba X said",
"Saint X writes",
or equivalent wording in Greek, Russian,
Serbian, Romanian or English.

14. Also use clear source evidence such as:
author headings,
work titles,
chapter headings,
section headings,
table-of-contents entries,
or explicit attribution surrounding the quotation.

15. If the local context explicitly attributes
the quoted words to another person,
matchesClaimedAuthor must be false even if the
larger work itself is written by the claimed author.

16. actualAuthorName should contain the actual
quoted author only when the supplied evidence
identifies that person.

17. Names in different languages may refer to the
same claimed author when the supplied evidence
clearly establishes the correspondence through
the work structure. Do not require the author's
name to be written in English.

18. If attribution cannot be established safely
from the supplied source evidence alone,
matchesClaimedAuthor must be false.

19. Do not guess.

20. In reason, briefly state exactly which supplied
source evidence supports or fails to support
the attribution.
          `.trim(),
        },

        {
          role:
            "user",

          content: `
CLAIMED AUTHOR:
${candidate.authorName ?? "Unknown"}

CLAIMED WORK:
${candidate.workTitle ?? "Unknown"}

DIRECT SOURCE URL:
${candidate.sourceUrl}

DIRECT SOURCE TITLE:
${sourceTitle || "Not available"}

DIRECT DOCUMENT BEGINNING:
${documentBeginning}

QUOTATION:
${candidate.originalText}

LOCAL QUOTATION CONTEXT:
${context}

${workLevelBlock}

Does the supplied SOURCE EVIDENCE itself establish
that this quotation belongs to the claimed author?
          `.trim(),
        },
      ],

      text: {
        format:
          zodTextFormat(
            AttributionResultSchema,
            "patristic_attribution",
          ),
      },
    });


  const parsed =
    response.output_parsed;


  if (!parsed) {
    return {
      matchesClaimedAuthor:
        false,

      actualAuthorName:
        null,

      reason:
        "Attribution verification returned no structured result.",
    };
  }


  return parsed;
}