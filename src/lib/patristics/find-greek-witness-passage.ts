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


/*
 * Nalazi stvarni početak
 * grčkog odlomka unutar već
 * pronađenog šireg OCR prozora.
 *
 * Prvo pokušavamo sa prvom
 * rečju čistog teksta.
 *
 * Ako je baš ona OCR-oštećena,
 * pokušavamo sa sledećih nekoliko.
 */
function findAlignedStart(
  queryWords: string[],
  witnessWords: string[],
  approximateStart: number,
  approximateEnd: number,
) {
  const searchStart =
    Math.max(
      0,
      approximateStart,
    );

  const searchEnd =
    Math.min(
      witnessWords.length,
      approximateEnd,
    );


  const prefixWordsToTry =
    Math.min(
      10,
      queryWords.length,
    );


  /*
   * Najbolji slučaj:
   *
   * prva reč pasusa postoji
   * neoštećena u witness OCR-u.
   */
  const firstWord =
    queryWords[0];


  for (
    let i = searchStart;
    i < searchEnd;
    i += 1
  ) {
    if (
      witnessWords[i] ===
      firstWord
    ) {
      return i;
    }
  }


  /*
   * Ako je prva reč oštećena,
   * tražimo drugu, treću...
   *
   * Tada približno vraćamo
   * početak za broj reči koje
   * prethode pronađenoj reči.
   */
  for (
    let queryIndex = 1;
    queryIndex <
      prefixWordsToTry;
    queryIndex += 1
  ) {
    const queryWord =
      queryWords[
        queryIndex
      ];


    for (
      let witnessIndex =
        searchStart;
      witnessIndex <
        searchEnd;
      witnessIndex += 1
    ) {
      if (
        witnessWords[
          witnessIndex
        ] !==
        queryWord
      ) {
        continue;
      }


      const estimatedStart =
        Math.max(
          searchStart,
          witnessIndex -
            queryIndex,
        );


      /*
       * Ne prihvatamo samo jednu
       * slučajnu zajedničku reč.
       *
       * Gledamo da li u neposrednoj
       * blizini postoji još nekoliko
       * reči iz početka pasusa.
       */
      let nearbyMatches =
        0;


      const checkLength =
        Math.min(
          8,
          queryWords.length,
        );


      const localWitnessEnd =
        Math.min(
          witnessWords.length,
          estimatedStart +
            checkLength +
            8,
        );


      const localWitness =
        new Set(
          witnessWords.slice(
            estimatedStart,
            localWitnessEnd,
          ),
        );


      for (
        let q = 0;
        q < checkLength;
        q += 1
      ) {
        if (
          localWitness.has(
            queryWords[q],
          )
        ) {
          nearbyMatches += 1;
        }
      }


      if (
        nearbyMatches >= 4
      ) {
        return estimatedStart;
      }
    }
  }


  return null;
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


    if (
      bestOverlap ===
      queryWords.length
    ) {
      break;
    }
  }


  const locatorSimilarity =
    bestOverlap /
    queryWords.length;


  /*
   * Locator nam je našao
   * širi region.
   *
   * Sada u njegovoj okolini
   * tražimo pravi početak
   * grčkog teksta.
   */
  const alignedStart =
    findAlignedStart(
      queryWords,
      witnessWords,

      Math.max(
        0,
        bestStart - 30,
      ),

      Math.min(
        witnessWords.length,
        bestStart +
          windowSize +
          30,
      ),
    );


  if (
    alignedStart === null
  ) {
    return {
      found: false,

      similarity:
        locatorSimilarity,

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
        witnessWords
          .slice(
            bestStart,
            bestStart +
              windowSize,
          )
          .join(" "),
    };
  }


  /*
   * Za sada ostavljamo malo
   * dodatnog prostora na kraju,
   * jer dirty OCR ubacuje brojeve,
   * kritički aparat i druge tokene.
   *
   * Kasnije ćemo i kraj poravnati
   * sekvencijalnim algoritmom.
   */
  const alignedLength =
    Math.min(
      witnessWords.length -
        alignedStart,

      queryWords.length +
        Math.max(
          10,
          Math.ceil(
            queryWords.length *
              0.15,
          ),
        ),
    );


  const alignedEnd =
    alignedStart +
    alignedLength;


  const alignedWords =
    witnessWords.slice(
      alignedStart,
      alignedEnd,
    );


  return {
    found:
      locatorSimilarity >=
      0.55,

    similarity:
      locatorSimilarity,

    queryWordCount:
      queryWords.length,

    matchedWordCount:
      bestOverlap,

    startWordIndex:
      alignedStart,

    endWordIndex:
      alignedEnd - 1,

    matchedText:
      alignedWords.join(
        " ",
      ),
  };
}