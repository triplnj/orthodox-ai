/**
 * Collection-level discovery registry, NOT a list of imported text.
 * Only reviewed individual works/editions may be staged and later activated.
 * No entry here authorizes bulk downloading or commercial redistribution.
 */
export type LibraryCollectionCandidate = {
  corpus: "PG" | "PL" | "PHILOKALIA" | "MODERN_ORTHODOX";
  title: string;
  catalogueUrl: string;
  access: "SCANS" | "MIXED_TEXT_AND_SCANS" | "READABLE_TEXT";
  review: "EDITION_BY_EDITION";
  warning: string;
};

export const LIBRARY_COLLECTION_CANDIDATES: readonly LibraryCollectionCandidate[] = [
  {
    corpus: "PG",
    title: "Patrologia Graeca — Wikimedia Commons / historical scans",
    catalogueUrl: "https://commons.wikimedia.org/wiki/Category:Patrologia_Graeca",
    access: "SCANS",
    review: "EDITION_BY_EDITION",
    warning: "OCR quality and author/work attribution vary by volume; distinguish printed PG columns from scan pages.",
  },
  {
    corpus: "PL",
    title: "Patrologia Latina — Wikimedia Commons / historical scans",
    catalogueUrl: "https://commons.wikimedia.org/wiki/Category:Patrologia_Latina",
    access: "SCANS",
    review: "EDITION_BY_EDITION",
    warning: "Some Commons items are incomplete placeholders; check volume completeness and Latin text before import.",
  },
  {
    corpus: "PL",
    title: "Corpus Corporum — University of Zurich Latin text repository",
    catalogueUrl: "https://mlat.uzh.ch/",
    access: "READABLE_TEXT",
    review: "EDITION_BY_EDITION",
    warning: "Repository states non-commercial conditions for some TEI data. Commercial reuse requires edition-specific permission.",
  },
  {
    corpus: "PHILOKALIA",
    title: "Greek Philokalia, Venice 1782 — digitized historical edition",
    catalogueUrl: "https://commons.wikimedia.org/wiki/Category:The_Greek_Philokalia",
    access: "SCANS",
    review: "EDITION_BY_EDITION",
    warning: "Distinguish historical Greek original from later translations; scan OCR, work boundaries and attributions require review.",
  },
  {
    corpus: "MODERN_ORTHODOX",
    title: "Later Orthodox saints — curated individual editions",
    catalogueUrl: "https://www.ccel.org/",
    access: "MIXED_TEXT_AND_SCANS",
    review: "EDITION_BY_EDITION",
    warning: "No blanket rights or author coverage inferred. Index Saint John of Kronstadt and other authors only from verified editions.",
  },
] as const;
