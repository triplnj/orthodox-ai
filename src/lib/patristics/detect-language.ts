export function detectPatristicLanguage(
  text: string,
): "sr" | "en" {
  const value = text.toLowerCase();

  // Serbian Cyrillic
  if (/[а-шђјљњћџ]/i.test(value)) {
    return "sr";
  }

  // Serbian Latin-specific characters
  if (/[čćžšđ]/i.test(value)) {
    return "sr";
  }

  // Common Serbian words, including text typed
  // without Serbian diacritics.
  const serbianWords = [
    "sta",
    "što",
    "sto",
    "kako",
    "zasto",
    "zašto",
    "sveti",
    "svetog",
    "svetih",
    "otac",
    "oci",
    "očevi",
    "bog",
    "boga",
    "molitva",
    "molitvi",
    "greh",
    "grijeh",
    "poslusanje",
    "poslušanje",
    "smirenje",
    "pokajanje",
    "spasenje",
    "dusa",
    "duša",
  ];

  const words = value
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/);

  const matches =
    words.filter((word) =>
      serbianWords.includes(word),
    ).length;

  return matches > 0 ? "sr" : "en";
}