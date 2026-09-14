import {
  findPatristicAuthor,
} from "./corpus-index";

const NAMED_FATHER_PATTERN =
  /\b(?:sveti|svetog|svetom|sv\.?|свети|светог|светом|св\.?|saint|st\.?|heilige(?:r|n|m)?|hl\.?)\s+[\p{L}][\p{L}.'’\-]{2,}/iu;

const PATRISTIC_WORK_PATTERN =
  /\b(?:ascetical homilies|ascetical works|homilies|homilije|ambigua|mystagogia|ladder of divine ascent|lestvica|лествица|аскетске беседе|подвижничке беседе|patrologia graeca|philokalia|филокалија)\b/iu;

const GENERIC_PATRISTIC_PATTERN =
  /\b(?:church fathers|holy fathers|sveti oci|sveti otci|свети оци|свети отци|patristic|patristics|patrologia|philokalia|филокалија)\b/iu;

export function isGenericPatristicResearchQuery(
  query: string,
) {
  return GENERIC_PATRISTIC_PATTERN.test(
    query,
  );
}

export function shouldRunPatristicResearch(
  query: string,
) {
  if (
    findPatristicAuthor(
      query,
    )
  ) {
    return true;
  }

  return (
    NAMED_FATHER_PATTERN.test(
      query,
    ) ||
    PATRISTIC_WORK_PATTERN.test(
      query,
    ) ||
    isGenericPatristicResearchQuery(
      query,
    )
  );
}
