export type PgAuthorCatalogEntry = {
  canonicalName: string;
  aliases: string[];
  pgVolumes: number[];
};


const PG_AUTHOR_CATALOG: PgAuthorCatalogEntry[] = [
  {
    canonicalName: "Epiphanius of Salamis",

    aliases: [
      "Epiphanius of Salamis",
      "Epiphanius of Cyprus",
      "Saint Epiphanius of Salamis",
      "Saint Epiphanius of Cyprus",
      "St Epiphanius of Salamis",
      "St Epiphanius of Cyprus",
      "St. Epiphanius of Salamis",
      "St. Epiphanius of Cyprus",

      "Epiphanius Salaminis",
      "Epiphanius Salaminis Episcopus",

      "Sveti Epifanije Kiparski",
      "Sveti Epifanije Salamiski",
      "Sveti Epifanije Salaminski",
      "Epifanije Kiparski",
      "Epifanije Salamiski",
      "Epifanije Salaminski",

      "Свети Епифаније Кипарски",
      "Свети Епифаније Саламински",
      "Епифаније Кипарски",
      "Епифаније Саламински",

      "Ἐπιφάνιος",
      "Επιφανιος",
    ],

    pgVolumes: [41, 42, 43],
  },
];


function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,;:()[\]{}'"!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


export function findPgAuthorCatalogEntry(
  value: string,
): PgAuthorCatalogEntry | null {
  const normalizedValue = normalize(value);

  if (!normalizedValue) {
    return null;
  }

  for (const entry of PG_AUTHOR_CATALOG) {
    if (
      normalize(entry.canonicalName) ===
      normalizedValue
    ) {
      return entry;
    }

    for (const alias of entry.aliases) {
      const normalizedAlias =
        normalize(alias);

      if (
        normalizedAlias ===
        normalizedValue
      ) {
        return entry;
      }
    }
  }

  /*
   * Drugi, malo fleksibilniji prolaz.
   *
   * Koristi se samo ako nema
   * tačnog podudaranja.
   */
  for (const entry of PG_AUTHOR_CATALOG) {
    const names = [
      entry.canonicalName,
      ...entry.aliases,
    ];

    for (const name of names) {
      const normalizedName =
        normalize(name);

      if (
        normalizedValue.includes(
          normalizedName,
        ) ||
        normalizedName.includes(
          normalizedValue,
        )
      ) {
        return entry;
      }
    }
  }

  return null;
}