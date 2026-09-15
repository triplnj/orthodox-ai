const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ђ: "dj", е: "e", ж: "z",
  з: "z", и: "i", ј: "j", к: "k", л: "l", љ: "lj", м: "m", н: "n",
  њ: "nj", о: "o", п: "p", р: "r", с: "s", т: "t", ћ: "c", у: "u",
  ф: "f", х: "h", ц: "c", ч: "c", џ: "dz", ш: "s",
};

function foldSerbianLatin(value: string) {
  return value
    .toLowerCase()
    .replace(/đ/g, "dj")
    .replace(/[čć]/g, "c")
    .replace(/š/g, "s")
    .replace(/ž/g, "z");
}

function cyrillicToFoldedLatin(value: string) {
  return Array.from(value.toLowerCase())
    .map((character) => CYRILLIC_TO_LATIN[character] ?? character)
    .join("");
}

/**
 * Produces a script-neutral Serbian form used only for deterministic
 * author-name lookup. Greek/English text is left harmlessly unchanged.
 */
export function serbianAuthorLookupVariant(value: string) {
  return foldSerbianLatin(cyrillicToFoldedLatin(value));
}
