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


function buildFrequencyMap(
  words: string[],
) {
  const frequencies =
    new Map<string, number>();


  for (
    const word
    of words
  ) {
    frequencies.set(
      word,
      (
        frequencies.get(
          word,
        ) ?? 0
      ) + 1,
    );
  }


  return frequencies;
}


function calculateOverlap(
  queryFrequencies:
    Map<string, number>,

  candidateFrequencies:
    Map<string, number>,
) {
  let overlap =
    0;


  for (
    const [
      word,
      queryCount,
    ]
    of queryFrequencies
  ) {
    const candidateCount =
      candidateFrequencies.get(
        word,
      ) ?? 0;


    overlap +=
      Math.min(
        queryCount,
        candidateCount,
      );
  }


  return overlap;
}


function incrementFrequency(
  frequencies:
    Map<string, number>,

  word: string,
) {
  frequencies.set(
    word,
    (
      frequencies.get(
        word,
      ) ?? 0
    ) + 1,
  );
}


function decrementFrequency(
  frequencies:
    Map<string, number>,

  word: string,
) {
  const current =
    frequencies.get(
      word,
    );


  if (!current) {
    return;
  }


  if (
    current <= 1
  ) {
    frequencies.delete(
      word,
    );

    return;
  }


  frequencies.set(
    word,
    current - 1,
  );
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


  /*
   * Dirty OCR садржи додатне
   * бројеве, слова, апарат,
   * поломљене речи итд.
   *
   * Зато прозор правимо нешто
   * већи од чистог пасуса.
   */
  const extraWords =
    Math.max(
      20,
      Math.ceil(
        queryWords.length *
        0.25,
      ),
    );


  const windowSize =
    Math.min(
      witnessWords.length,
      queryWords.length +
        extraWords,
    );


  if (
    windowSize === 0
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


  const queryFrequencies =
    buildFrequencyMap(
      queryWords,
    );


  const candidateFrequencies =
    buildFrequencyMap(
      witnessWords.slice(
        0,
        windowSize,
      ),
    );


  let bestStart =
    0;

  let bestOverlap =
    calculateOverlap(
      queryFrequencies,
      candidateFrequencies,
    );


  const lastStart =
    witnessWords.length -
    windowSize;


  /*
   * Sliding window:
   *
   * не поредимо више реч по реч
   * на истој позицији.
   *
   * Меримо колико речи из чистог
   * пасуса постоји у датом OCR
   * прозору.
   *
   * Тако нас (27), xoi, OE,
   * поломљене речи и сличан OCR
   * отпад више не померају.
   */
  for (
    let start = 1;
    start <= lastStart;
    start += 1
  ) {
    const removedWord =
      witnessWords[
        start - 1
      ];


    const addedWord =
      witnessWords[
        start +
        windowSize -
        1
      ];


    decrementFrequency(
      candidateFrequencies,
      removedWord,
    );


    incrementFrequency(
      candidateFrequencies,
      addedWord,
    );


    const overlap =
      calculateOverlap(
        queryFrequencies,
        candidateFrequencies,
      );


    if (
      overlap >
      bestOverlap
    ) {
      bestOverlap =
        overlap;

      bestStart =
        start;
    }


    /*
     * Све речи чистог пасуса
     * постоје у прозору.
     */
    if (
      bestOverlap ===
      queryWords.length
    ) {
      break;
    }
  }


  const similarity =
    bestOverlap /
    queryWords.length;


  const matchedWords =
    witnessWords.slice(
      bestStart,
      bestStart +
        windowSize,
    );


  return {
    /*
     * Ово значи само:
     *
     * "врло вероватно смо
     * лоцирали исти пасус".
     *
     * НЕ значи да је текст
     * верификован.
     */
    found:
      similarity >= 0.55,

    similarity,

    queryWordCount:
      queryWords.length,

    matchedWordCount:
      bestOverlap,

    startWordIndex:
      bestStart,

    endWordIndex:
      bestStart +
      windowSize -
      1,

    matchedText:
      matchedWords.join(
        " ",
      ),
  };
}