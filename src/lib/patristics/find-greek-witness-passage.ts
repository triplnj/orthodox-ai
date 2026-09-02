import {
  greekWords,
} from "./normalize-greek-text";


export type GreekWitnessPassageMatch = {
  found: boolean;

  similarity: number;

  queryWordCount: number;

  matchedWordCount: number;

  startWordIndex: number | null;

  endWordIndex: number | null;

  matchedText: string;
};


function countMatches(
  queryWords: string[],
  candidateWords: string[],
) {
  let matches = 0;


  const length =
    Math.min(
      queryWords.length,
      candidateWords.length,
    );


  for (
    let index = 0;
    index < length;
    index += 1
  ) {
    if (
      queryWords[index] ===
      candidateWords[index]
    ) {
      matches += 1;
    }
  }


  return matches;
}


export function findGreekWitnessPassage(
  passageText: string,
  witnessText: string,
): GreekWitnessPassageMatch {
  const queryWords =
    greekWords(
      passageText,
    );


  const witnessWords =
    greekWords(
      witnessText,
    );


  if (
    queryWords.length === 0 ||
    witnessWords.length === 0
  ) {
    return {
      found: false,

      similarity: 0,

      queryWordCount:
        queryWords.length,

      matchedWordCount: 0,

      startWordIndex: null,

      endWordIndex: null,

      matchedText: "",
    };
  }


  if (
    witnessWords.length <
    queryWords.length
  ) {
    return {
      found: false,

      similarity: 0,

      queryWordCount:
        queryWords.length,

      matchedWordCount: 0,

      startWordIndex: null,

      endWordIndex: null,

      matchedText: "",
    };
  }


  /*
   * Тражимо најбољи прозор исте
   * дужине као пасус.
   *
   * Ово је намерно детерминистички:
   * нема AI одлуке о томе шта
   * "личи" на извор.
   */
  let bestStart =
    -1;

  let bestMatches =
    -1;


  const lastStart =
    witnessWords.length -
    queryWords.length;


  for (
    let start = 0;
    start <= lastStart;
    start += 1
  ) {
    const candidate =
      witnessWords.slice(
        start,
        start +
          queryWords.length,
      );


    const matches =
      countMatches(
        queryWords,
        candidate,
      );


    if (
      matches >
      bestMatches
    ) {
      bestMatches =
        matches;

      bestStart =
        start;
    }


    /*
     * Савршено поклапање:
     * нема потребе да настављамо.
     */
    if (
      matches ===
      queryWords.length
    ) {
      break;
    }
  }


  if (
    bestStart < 0
  ) {
    return {
      found: false,

      similarity: 0,

      queryWordCount:
        queryWords.length,

      matchedWordCount: 0,

      startWordIndex: null,

      endWordIndex: null,

      matchedText: "",
    };
  }


  const similarity =
    bestMatches /
    queryWords.length;


  const matchedWords =
    witnessWords.slice(
      bestStart,
      bestStart +
        queryWords.length,
    );


  return {
    /*
     * За сада је 0.70 само праг
     * да кажемо да смо вероватно
     * нашли исти пасус.
     *
     * То НИЈЕ праг за коначну
     * теолошку/текстуалну
     * верификацију.
     */
    found:
      similarity >= 0.7,

    similarity,

    queryWordCount:
      queryWords.length,

    matchedWordCount:
      bestMatches,

    startWordIndex:
      bestStart,

    endWordIndex:
      bestStart +
      queryWords.length -
      1,

    matchedText:
      matchedWords.join(
        " ",
      ),
  };
}