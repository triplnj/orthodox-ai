import { prisma } from "@/lib/prisma";

function normalize(value: string) {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(/[.,!?;:'"()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function detectPatristicAuthor(
  query: string,
): Promise<string | undefined> {
  const authors = await prisma.patristicQuote.findMany({
    where: {
      verification: "MULTI_SOURCE_VERIFIED",
      confidence: {
        gte: 90,
      },
    },
    select: {
      authorName: true,
    },
    distinct: ["authorName"],
  });

  const normalizedQuery = normalize(query);

  for (const author of authors) {
    const normalizedAuthor = normalize(author.authorName);

    if (normalizedQuery.includes(normalizedAuthor)) {
      return author.authorName;
    }

    // Allows queries such as "St John Climacus" when DB contains
    // "John Climacus".
    const withSaint = `st ${normalizedAuthor}`;
    const withSaintLong = `saint ${normalizedAuthor}`;

    if (
      normalizedQuery.includes(withSaint) ||
      normalizedQuery.includes(withSaintLong)
    ) {
      return author.authorName;
    }
  }

  return undefined;
}