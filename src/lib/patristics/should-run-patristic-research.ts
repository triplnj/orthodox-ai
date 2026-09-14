import {
  findPatristicAuthor,
} from "./corpus-index";

const PATRISTIC_INTENT_PATTERN =
  /\b(?:sveti|svetog|svetom|sv\.?|свети|светог|светом|св\.?|saint|st\.?|church father|holy father|patristic|patristics|patrologia|philokalia|heilige(?:r|n|m)?|hl\.?)\b/iu;

const PATRISTIC_WORK_PATTERN =
  /\b(?:ascetical homilies|ascetical works|homilies|homilije|ambigua|mystagogia|ladder of divine ascent|lestvica|лествица|аскетске беседе|подвижничке беседе|patrologia graeca|philokalia|филокалија)\b/iu;

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
    PATRISTIC_INTENT_PATTERN.test(
      query,
    ) ||
    PATRISTIC_WORK_PATTERN.test(
      query,
    )
  );
}
