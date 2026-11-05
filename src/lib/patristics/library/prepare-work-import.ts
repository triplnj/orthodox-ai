/**
 * Offline-only book ingestion. A work is a collection of independently
 * identified sections, not a flattened wall of OCR text.
 * It never activates the resulting edition or contacts the database.
 */
import { planLibraryImport, type ImportDocument, type LibraryImportPlan } from "./prepare-import";

export type WorkImportPlan = {
  author: LibraryImportPlan["author"];
  work: LibraryImportPlan["work"];
  edition: LibraryImportPlan["edition"];
  passages: LibraryImportPlan["passages"];
  sectionCount: number;
  coverage: "COMPLETE_MANIFEST" | "PARTIAL_SAMPLE";
};

export function planLibraryWorkImport(
  sections: readonly ImportDocument[],
  maxChars = 1800,
  expectedSectionLocators?: readonly string[],
): WorkImportPlan {
  if (!Array.isArray(sections) || sections.length === 0 || sections.length > 2000) {
    throw new RangeError("A book import must contain 1–2000 identified sections");
  }

  const plans = sections.map(section => planLibraryImport(section, maxChars));
  const first = plans[0];
  const locators = new Set<string>();
  const passageIds = new Set<string>();
  const allPassages: LibraryImportPlan["passages"] = [];

  for (let index = 0; index < plans.length; index++) {
    const plan = plans[index];
    const original = sections[index];
    // Never allow conflicting title, source, license or languages within
    // a single edition. Different translations must be separate editions.
    if (plan.author.id !== first.author.id ||
        plan.author.canonicalName !== first.author.canonicalName ||
        plan.work.id !== first.work.id ||
        plan.work.title !== first.work.title ||
        plan.edition.id !== first.edition.id ||
        JSON.stringify(plan.edition) !== JSON.stringify(first.edition)) {
      throw new Error("All sections must belong to the same author, work and exact edition");
    }
    const locator = original.passageLocator.trim();
    if (locators.has(locator)) {
      throw new Error("Duplicate section locator: " + locator);
    }
    locators.add(locator);
    for (const passage of plan.passages) {
      if (passageIds.has(passage.id)) throw new Error("Duplicate passage id");
      passageIds.add(passage.id);
      allPassages.push(passage);
    }
  }
  if (expectedSectionLocators) {
    const expected = new Set(expectedSectionLocators.map(value => value.trim()));
    if (expected.size !== expectedSectionLocators.length ||
        expected.size !== locators.size ||
        [...expected].some(locator => !locator || !locators.has(locator))) {
      throw new Error("Section manifest mismatch: do not report partial imports as complete");
    }
  }
  if (allPassages.length > 50000) throw new RangeError("Book is too large for a single import");
  return {
    author: first.author,
    work: first.work,
    edition: first.edition,
    passages: allPassages,
    sectionCount: plans.length,
    coverage: expectedSectionLocators ? "COMPLETE_MANIFEST" : "PARTIAL_SAMPLE",
  };
}
