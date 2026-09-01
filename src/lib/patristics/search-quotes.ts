import { prisma } from "@/lib/prisma";

function getSearchTerms(
  query: string,
) {
  const stopWords =
    new Set([
      "what",
      "does",
      "about",
      "teach",
      "teaches",
      "said",
      "says",
      "say",
      "the",
      "and",
      "for",
      "from",
      "with",
      "that",
      "this",
      "who",
      "kako",
      "sta",
      "što",
      "sto",
      "sveti",
      "svetog",
      "svetih",
      "kaže",
      "kaze",
      "govori",
      "uči",
      "uci",
      "kod",
      "ima",
      "jel",
      "ili",
    ]);

  return Array.from(
    new Set(
      query
        .normalize("NFC")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter(
          (word) =>
            word.length >= 4 &&
            !stopWords.has(word),
        ),
    ),
  ).slice(0, 12);
}


export async function searchPatristicQuotes(
  query: string,
  limit = 5,
) {
  const terms =
    getSearchTerms(query);

  if (terms.length === 0) {
    return [];
  }

  return prisma.patristicQuote.findMany({
    where: {
      verification:
        "MULTI_SOURCE_VERIFIED",

      confidence: {
        gte: 90,
      },

      OR: [
        {
          topics: {
            hasSome: terms,
          },
        },

        ...terms.flatMap(
          (term) => [
            {
              authorName: {
                contains: term,
                mode: "insensitive" as const,
              },
            },

            {
              workTitle: {
                contains: term,
                mode: "insensitive" as const,
              },
            },

            {
              translationEn: {
                contains: term,
                mode: "insensitive" as const,
              },
            },

            {
              translationSr: {
                contains: term,
                mode: "insensitive" as const,
              },
            },
          ],
        ),
      ],
    },

    take: limit,

    orderBy: {
      confidence: "desc",
    },

    include: {
      sources: {
        where: {
          exactMatch: true,
        },
      },
    },
  });
}