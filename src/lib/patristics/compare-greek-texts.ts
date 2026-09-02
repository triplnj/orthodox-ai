import {
  greekWords,
} from "./normalize-greek-text";


export type GreekTextComparison = {
  leftWordCount: number;

  rightWordCount: number;

  matchedWordCount: number;

  similarity: number;

  differingPositions: Array<{
    index: number;

    left: string | null;

    right: string | null;
  }>;
};


export function compareGreekTexts(
  leftText: string,
  rightText: string,
): GreekTextComparison {
  const leftWords =
    greekWords(
      leftText,
    );


  const rightWords =
    greekWords(
      rightText,
    );


  const maxLength =
    Math.max(
      leftWords.length,
      rightWords.length,
    );


  let matchedWordCount =
    0;


  const differingPositions:
    GreekTextComparison["differingPositions"] =
    [];


  for (
    let index = 0;
    index < maxLength;
    index += 1
  ) {
    const left =
      leftWords[index] ??
      null;


    const right =
      rightWords[index] ??
      null;


    if (
      left !== null &&
      right !== null &&
      left === right
    ) {
      matchedWordCount +=
        1;

      continue;
    }


    differingPositions.push({
      index,
      left,
      right,
    });
  }


  const denominator =
    Math.max(
      leftWords.length,
      rightWords.length,
      1,
    );


  const similarity =
    matchedWordCount /
    denominator;


  return {
    leftWordCount:
      leftWords.length,

    rightWordCount:
      rightWords.length,

    matchedWordCount,

    similarity,

    differingPositions,
  };
}