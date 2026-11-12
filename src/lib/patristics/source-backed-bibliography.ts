/**
 * Step 4/6 — strictly scoped, source-backed bibliographic evidence for Chat.
 * Only verified attribution edges are emitted as facts. Provisional or
 * disputed edges never become user-facing author/work assertions.
 * This is evidence for the answer model, not a verified answer by itself.
 */
import seed from "./bibliography-catalog-seed.json";
import {
  findCatalogAuthor, listCatalogWorks, validateBibliographyCatalog,
  type BibliographyCatalog,
} from "./bibliography-catalog";
import type { PatristicResearchContext, PatristicResearchSource } from "./build-patristic-research-context";

const bibliographyIntent = /(?:\b(?:works|writings|books|bibliograph\w*|publications|authored|compiled|edited|translated)\b|\b(?:dela|djela|spisi|knjige|bibliografija|napisao|sastavio|uredio|preveo)\b|аутор[а-я]*|адапт[а-я]*|оригиналн[а-я]*|дел[аоуи]|спис[а-я]*|књиг[а-я]*|библиограф[а-я]*|написа[а-я]*|састави[а-я]*|уреди[а-я]*|преве[а-я]*)/iu;

export function sourceBackedBibliographyContext(currentQuestion: string): PatristicResearchContext | null {
  // Resolve ONLY the current user question: never inherit an author from a
  // previous turn or from untrusted assistant prose in the retrieval query.
  if (!bibliographyIntent.test(currentQuestion)) return null;
  const catalog = validateBibliographyCatalog(seed as BibliographyCatalog);
  const match = findCatalogAuthor(currentQuestion, catalog);
  if (match.status !== "EXACT_AUTHOR") return null;

  // An explicitly named work narrows the evidence set; a general bibliography
  // request still receives the selective attested catalogue.
  const normalized = (text: string) => text.normalize("NFKC").toLocaleLowerCase("en").replace(/[^\\p{L}\\p{N}]+/gu, " ").trim();
  const input = " " + normalized(currentQuestion) + " ";
  const namedWorks = catalog.works.filter(work =>
    [work.canonicalTitle, work.originalTitle, ...work.titleVariants]
      .filter((title): title is string => typeof title === "string")
      .some(title => input.includes(" " + normalized(title) + " ")));
  const namedWorkIds = new Set(namedWorks.map(work => work.id));
  const confirmed = listCatalogWorks(catalog, match.author.id)
    .filter(entry => !namedWorkIds.size || namedWorkIds.has(entry.work.id))
    .filter(entry => entry.status === "SOURCE_ATTESTED")
    .map(entry => ({
      ...entry,
      reviewed: entry.evidence.filter(e =>
        e.reviewStatus === "REVIEWED" && e.kind !== "COMMUNITY_REFERENCE"),
    }))
    .filter(entry => entry.reviewed.length > 0);
  if (!confirmed.length) return null;
  const provisionalCount = listCatalogWorks(catalog, match.author.id)
    .filter(entry => entry.status !== "SOURCE_ATTESTED").length;
  const sources: PatristicResearchSource[] = [];
  const blocks = confirmed.map((entry, index) => {
    const contributors = catalog.contributions
      .filter(c => c.workId === entry.work.id &&
        c.authorId !== match.author.id && c.attribution === "SOURCE_ATTESTED")
      .filter(c => c.evidenceIds.some(id => catalog.evidence.some(e =>
        e.id === id && e.reviewStatus === "REVIEWED" && e.kind !== "COMMUNITY_REFERENCE")))
      .map(c => ({
        name: catalog.authors.find(a => a.id === c.authorId)!.canonicalName,
        roles: c.roles.join(", "),
      }));
    for (const evidence of entry.reviewed) sources.push({
      provider: "WEB_RESEARCH",
      authorName: match.author.canonicalName,
      workTitle: entry.work.canonicalTitle,
      reference: null,
      originalLanguage: entry.work.originalLanguage,
      sourceUrl: evidence.url,
      scanUrl: null,
      verificationStatus: "REVIEWED_BIBLIOGRAPHIC_ATTRIBUTION",
      webpageTitle: evidence.title,
      metadata: { bibliographyCatalog: true, workId: entry.work.id,
        roles: entry.roles, sourceKind: evidence.kind,
        evidenceId: evidence.id, supportingStatement: evidence.supportingStatement },
    });
    return [
      `[REVIEWED_BIBLIOGRAPHY_${index + 1}]`,
      `TITLE: ${entry.work.canonicalTitle}`,
      `ORIGINAL_TITLE: ${entry.work.originalTitle ?? "not established"}`,
      `WORK_KIND: ${entry.work.workKind}`,
      `REQUESTED_PERSON: ${match.author.canonicalName}`,
      `REQUESTED_PERSON_ROLES: ${entry.roles.join(", ")}`,
      `OTHER_VERIFIED_CONTRIBUTORS: ${contributors.map(c => c.name + " (" + c.roles + ")").join("; ") || "none catalogued"}`,
      ...entry.reviewed.map(e => `EVIDENCE: ${e.title} | ${e.url} | ${e.supportingStatement}`),
      `[/REVIEWED_BIBLIOGRAPHY_${index + 1}]`,
    ].join("\n");
  });
  const unique = [...new Map(sources.map(s => [s.sourceUrl + "|" + s.workTitle, s])).values()];
  return {
    context: [
      "REVIEWED BIBLIOGRAPHIC EVIDENCE — SELECTED, NOT EXHAUSTIVE.",
      `Requested person: ${match.author.canonicalName}.`,
      "Use ONLY the verified work-role pairs below as positive bibliographic assertions.",
      "AUTHOR, EDITOR, COMPILER, TRANSLATOR, ADAPTOR, CO_AUTHOR and SOURCE_AUTHOR are DIFFERENT roles.",
      "Never describe an editor/translator/adaptor as the sole original author.",
      "The source author of an underlying adapted work is not the author of the adaptation.",
      "These are bibliographic metadata, not text excerpts: no direct quotation, doctrinal interpretation, or invented page references.",
      `There are ${provisionalCount} additional provisional/disputed attribution(s) intentionally excluded; do not guess their titles or present this selection as a complete bibliography.`,
      "If asked for a complete bibliography, explicitly state that the catalog is selective.",
      "Never infer that an omitted work does not exist or has no historical relationship with this author. Missing in this selective catalogue means NOT CATALOGUED HERE, not disproved.",
      "If a work explicitly named in the question is not covered by reviewed evidence, state that this catalogue cannot establish its attribution; never declare that no historical connection is known.",
      "For every bibliographic claim, name its corresponding reviewed work and source URL from the evidence blocks; do not treat bibliographic metadata as verbatim book excerpts.",
      "Do not use unsupported prior assistant statements to expand the list.",
      ...blocks,
    ].join("\n\n"),
    sources: unique,
    providersAttempted: ["REVIEWED_BIBLIOGRAPHY_CATALOG"],
    providersSucceeded: ["REVIEWED_BIBLIOGRAPHY_CATALOG"],
  };
}
