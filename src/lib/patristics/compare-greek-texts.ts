import {
  greekWords,
} from "./normalize-greek-text";


export type GreekTextDifference = {
  type:
    | "SUBSTITUTE"
    | "INSERT"
    | "DELETE";

  leftIndex: number | null;

  rightIndex: number | null;

  left: string | null;

  right: string | null;
};


export type GreekTextComparison = {
  leftWordCount: number;

  rightWordCount: number;

  matchedWordCount: number;

  substitutedWordCount: number;

  insertedWordCount: number;

  deletedWordCount: number;

  similarity: number;

  differingPositions:
    GreekTextDifference[];
};


type Operation =
  | "MATCH"
  | "SUBSTITUTE"
  | "INSERT"
  | "DELETE";


export function compareGreekTexts(
  leftText: string,
  rightText: string,
): GreekTextComparison {
  const left =
    greekWords(
      leftText,
    );

  const right =
    greekWords(
      rightText,
    );


  const rows =
    left.length + 1;

  const columns =
    right.length + 1;


  /*
   * Levenshtein matrica na nivou
   * reči, ne karaktera.
   *
   * Time OCR dodatak poput:
   *
   *   1|
   *
   * postaje INSERT i ne pomera
   * poređenje svih narednih reči.
   */
  const distance:
    number[][] =
    Array.from(
      {
        length: rows,
      },
      () =>
        Array(
          columns,
        ).fill(0),
    );


  const operation:
    Operation[][] =
    Array.from(
      {
        length: rows,
      },
      () =>
        Array(
          columns,
        ).fill(
          "MATCH",
        ),
    );


  for (
    let i = 1;
    i < rows;
    i += 1
  ) {
    distance[i][0] =
      i;

    operation[i][0] =
      "DELETE";
  }


  for (
    let j = 1;
    j < columns;
    j += 1
  ) {
    distance[0][j] =
      j;

    operation[0][j] =
      "INSERT";
  }


  for (
    let i = 1;
    i < rows;
    i += 1
  ) {
    for (
      let j = 1;
      j < columns;
      j += 1
    ) {
      if (
        left[i - 1] ===
        right[j - 1]
      ) {
        distance[i][j] =
          distance[
            i - 1
          ][
            j - 1
          ];

        operation[i][j] =
          "MATCH";

        continue;
      }


      const substitution =
        distance[
          i - 1
        ][
          j - 1
        ] + 1;


      const deletion =
        distance[
          i - 1
        ][j] + 1;


      const insertion =
        distance[i][
          j - 1
        ] + 1;


      const minimum =
        Math.min(
          substitution,
          deletion,
          insertion,
        );


      distance[i][j] =
        minimum;


      /*
       * Kod izjednačenja prvo
       * biramo substitution.
       *
       * Za OCR je korisnije da:
       *
       *   και -> χαι
       *
       * vidimo kao jednu
       * zamenu, a ne DELETE +
       * INSERT.
       */
      if (
        minimum ===
        substitution
      ) {
        operation[i][j] =
          "SUBSTITUTE";
      } else if (
        minimum ===
        deletion
      ) {
        operation[i][j] =
          "DELETE";
      } else {
        operation[i][j] =
          "INSERT";
      }
    }
  }


  let i =
    left.length;

  let j =
    right.length;


  let matchedWordCount =
    0;

  let substitutedWordCount =
    0;

  let insertedWordCount =
    0;

  let deletedWordCount =
    0;


  const differences:
    GreekTextDifference[] =
    [];


  /*
   * Backtracking kroz optimalno
   * poravnanje.
   */
  while (
    i > 0 ||
    j > 0
  ) {
    const currentOperation =
      operation[i][j];


    if (
      i > 0 &&
      j > 0 &&
      currentOperation ===
        "MATCH"
    ) {
      matchedWordCount +=
        1;

      i -= 1;
      j -= 1;

      continue;
    }


    if (
      i > 0 &&
      j > 0 &&
      currentOperation ===
        "SUBSTITUTE"
    ) {
      substitutedWordCount +=
        1;


      differences.push({
        type:
          "SUBSTITUTE",

        leftIndex:
          i - 1,

        rightIndex:
          j - 1,

        left:
          left[i - 1],

        right:
          right[j - 1],
      });


      i -= 1;
      j -= 1;

      continue;
    }


    if (
      i > 0 &&
      (
        j === 0 ||
        currentOperation ===
          "DELETE"
      )
    ) {
      deletedWordCount +=
        1;


      differences.push({
        type:
          "DELETE",

        leftIndex:
          i - 1,

        rightIndex:
          null,

        left:
          left[i - 1],

        right:
          null,
      });


      i -= 1;

      continue;
    }


    if (
      j > 0
    ) {
      insertedWordCount +=
        1;


      differences.push({
        type:
          "INSERT",

        leftIndex:
          null,

        rightIndex:
          j - 1,

        left:
          null,

        right:
          right[j - 1],
      });


      j -= 1;
    }
  }


  differences.reverse();


  /*
   * Similarity merimo prema
   * dužem od dva teksta.
   *
   * Sada ubačeni OCR token više
   * ne uništava sve naredne
   * pozicije.
   */
  const denominator =
    Math.max(
      left.length,
      right.length,
      1,
    );


  const similarity =
    matchedWordCount /
    denominator;


  return {
    leftWordCount:
      left.length,

    rightWordCount:
      right.length,

    matchedWordCount,

    substitutedWordCount,

    insertedWordCount,

    deletedWordCount,

    similarity,

    differingPositions:
      differences,
  };
}