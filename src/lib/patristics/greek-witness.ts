export type GreekWitnessSource = {
  pgVolume: number;

  workTitle: string;

  sourceName: string;

  sourceUrl: string;

  textUrl: string;
};


const GREEK_WITNESSES:
  GreekWitnessSource[] = [
    {
      pgVolume: 46,

      workTitle:
        "De anima et resurrectione",

      sourceName:
        "Patrologia Graeca 46 — digital Greek witness",

      sourceUrl:
        "https://archive.org/details/patrologiaecursu46mignuoft",

      textUrl:
        "https://archive.org/download/patrologiaecursu46mignuoft/patrologiaecursu46mignuoft_djvu.txt",
    },
  ];


export function findGreekWitness(
  pgVolume: number,
) {
  return (
    GREEK_WITNESSES.find(
      (source) =>
        source.pgVolume ===
        pgVolume,
    ) ?? null
  );
}


export async function fetchGreekWitnessText(
  pgVolume: number,
) {
  const source =
    findGreekWitness(
      pgVolume,
    );


  if (!source) {
    throw new Error(
      `No Greek witness configured for PG ${pgVolume}.`,
    );
  }


  const response =
    await fetch(
      source.textUrl,
      {
        headers: {
          "User-Agent":
            "OrthodoxAI-Patristics/1.0 (+https://orthodoxai.app)",
        },

        cache:
          "force-cache",
      },
    );


  if (!response.ok) {
    throw new Error(
      `Could not fetch Greek witness for PG ${pgVolume}: ${response.status}`,
    );
  }


  const text =
    await response.text();


  if (
    text.trim().length <
    1000
  ) {
    throw new Error(
      `Greek witness for PG ${pgVolume} is unexpectedly short.`,
    );
  }


  return {
    source,
    text,
  };
}