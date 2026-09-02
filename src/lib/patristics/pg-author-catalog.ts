export type PgAuthorCatalogEntry = {
  canonicalName: string;

  aliases: string[];

  pgVolumes: number[];
};


const PG_AUTHOR_CATALOG:
  PgAuthorCatalogEntry[] = [
    {
      canonicalName:
        "Epiphanius of Salamis",

      aliases: [
        "Epiphanius of Salamis",
        "Epiphanius of Cyprus",
        "Saint Epiphanius of Cyprus",
        "Saint Epiphanius of Salamis",
        "Epiphanius Salaminis",
        "Epiphanius Salaminis Episcopus",
        "Свети Епифаније Кипарски",
        "Свети Епифаније Саламински",
        "Епифаније Кипарски",
        "Епифаније Саламински",
        "Ἐπιφάνιος",
      ],

      pgVolumes: [
        41,
        42,
        43,
      ],
    },
  ];


function normalize(
  value: string,
) {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}


export function findPgAuthorCatalogEntry(
  value: string,
) {
  const normalized =
    normalize(
      value,
    );


  return (
    PG_AUTHOR_CATALOG.find(
      (entry) =>
        entry.aliases.some(
          (alias) => {
            const normalizedAlias =
              normalize(
                alias,
              );


            return (
              normalized.includes(
                normalizedAlias,
              ) ||
              normalizedAlias.includes(
                normalized,
              )
            );
          },
        ),
    ) ?? null
  );
}