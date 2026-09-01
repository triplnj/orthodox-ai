import { z } from "zod";

export const ExtractedQuoteSchema = z.object({
  authorName: z.string(),
  authorNameOriginal: z.string().nullable(),

  workTitle: z.string(),
  workTitleOriginal: z.string().nullable(),

  originalLanguage: z.string(),
  originalText: z.string(),

  section: z.string().nullable(),
  chapter: z.string().nullable(),
  paragraph: z.string().nullable(),

  pgReference: z.string().nullable(),
  scReference: z.string().nullable(),
  cpgReference: z.string().nullable(),

  translationSr: z.string().nullable(),
  translationEn: z.string().nullable(),

  topics: z.array(z.string()),
});

export const ExtractedQuotesSchema = z.object({
  quotes: z.array(ExtractedQuoteSchema),
});

export type ExtractedQuote =
  z.infer<typeof ExtractedQuoteSchema>;

  export const BackfillTranslationSchema = z.object({
  translationSr: z.string().nullable(),
  translationEn: z.string().nullable(),
});

export type BackfillTranslation =
  z.infer<typeof BackfillTranslationSchema>;