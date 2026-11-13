/**
 * Data-independent evaluation primitives. A source index listing is weaker than
 * a reviewed author-work-role assertion. Never convert INDEX_LISTED into AUTHOR.
 */
export type BibliographyBenchmarkEntry = { author:string; work:string; relation:string; reviewStatus:string };
const normalize = (s:string) => s.normalize("NFKC").toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu," ").replace(/\s+/g," ").trim();
const pair = (x:{author:string;work:string}) => normalize(x.author)+"|"+normalize(x.work);
export function evaluateIndexCoverage(
 reference:BibliographyBenchmarkEntry[],
 predicted: Array<{author:string;work:string}>,
 negatives: Array<{author:string;work:string}>,
) {
  const referenceKeys = new Set(reference.map(pair)), negativeKeys=new Set(negatives.map(pair));
  const uniquePredictions=new Set(predicted.map(pair));
  const trueIndexMatches=[...uniquePredictions].filter(k=>referenceKeys.has(k)).length;
  const warnedFalsePositives=[...uniquePredictions].filter(k=>negativeKeys.has(k)).length;
  const unlisted=[...uniquePredictions].filter(k=>!referenceKeys.has(k)&&!negativeKeys.has(k)).length;
  return {
    indexedReferenceCount:referenceKeys.size,
    distinctPredictions:uniquePredictions.size,
    exactIndexMatches:trueIndexMatches,
    indexCoverage:referenceKeys.size ? trueIndexMatches/referenceKeys.size : 0,
    indexPrecisionWithinKnownRecords:uniquePredictions.size ? trueIndexMatches/uniquePredictions.size : null,
    explicitWarningsViolated:warnedFalsePositives,
    unlistedNotNecessarilyFalse:unlisted,
    // This is deliberately false regardless of coverage: indexed relations do
    // not constitute an independent adjudicated author-work-role benchmark.
    independentlyAdjudicated:false,
    attributionReleaseReady:false,
  };
}
