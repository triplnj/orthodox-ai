import {
  PATRISTIC_CORPUS_INDEX,
  findRelevantWorks,
  type PatristicAuthorIndex,
  type PatristicWorkIndex,
} from "./corpus-index";
import { serbianAuthorLookupVariant } from "./serbian-script-variants";

function normalize(value: string) {
  return serbianAuthorLookupVariant(value)
    .normalize("NFC")
    .toLowerCase()
    .replace(/[.,;:!?()[\]{}"'’`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenMatches(queryToken: string, aliasToken: string) {
  if (queryToken === aliasToken) return true;
  if (queryToken.length < 5 || aliasToken.length < 5) return false;
  return queryToken.slice(0, 4) === aliasToken.slice(0, 4);
}

function phraseMatches(query: string, alias: string) {
  const normalizedQuery = normalize(query);
  const normalizedAlias = normalize(alias);
  if (normalizedQuery.includes(normalizedAlias)) return true;

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const aliasTokens = normalizedAlias.split(" ").filter(Boolean);
  return aliasTokens.every((aliasToken) =>
    queryTokens.some((queryToken) => tokenMatches(queryToken, aliasToken)),
  );
}

export function findPatristicAuthor(query: string) {
  return PATRISTIC_CORPUS_INDEX.find((author) =>
    author.aliases.some((alias) => phraseMatches(query, alias)),
  ) ?? null;
}

export { findRelevantWorks };
export type { PatristicAuthorIndex, PatristicWorkIndex };
