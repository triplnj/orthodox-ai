/** Strict scope for the six independently source-matched Gregory excerpts. */
const author=/(?:\b(?:gregory\s+of\s+nyssa|gregorius\s+nyssenus|grigorije\s+niski|grigorija\s+niskog)\b|григориј(?:е|а|у|ем)?\s+ниск(?:и|ог|ом|оме))/iu;
const mourning=/(?:\b(?:grief|grieving|grieved|mourn\w*|sorrow\w*|comfort\w*|consol\w*|bereave\w*|loss of basil|basil.s death)\b|жалост[\p{L}]*|туг[\p{L}]*|утеш[\p{L}]*|смрт[\p{L}]*|бол[\p{L}]*|жалов[\p{L}]*|tug\w*|žalost\w*|utes\w*|uteh\w*|smrt\w*|žaljen\w*)/iu;
const episode=/(?:\b(?:macrina|basil|makrina|vasilije|vasilija|vasilijem)\b|макрин[\p{L}]*|василиј[\p{L}]*)/iu;
const exactQuotation=/(?:\b(?:verbatim|exact quote|exact words|word.for.word|quote me|direct quotation)\b|дословн[\p{L}]*|тачан цитат|тачне речи|цитирај|дословно|doslovno|tačan citat|tačne reči|citiraj)/iu;
const outOfScope=/(?:\b(?:immortality|metempsychosis|apokatastasis|pre.existence|universal salvation|origin of (?:the )?soul|bodily resurrection|nature of (?:the )?soul|final restoration)\b|апокатастаз[\p{L}]*|бесмртност[\p{L}]*|пресељење душ[\p{L}]*|свеопшт[\p{L}]* спасењ[\p{L}]*|besmrtnost\w*|apokatastaz\w*)/iu;
const comparison=/(?:\b(?:compare|versus|vs\.?|contrast|both authors|compared with)\b|упоред[\p{L}]*|поред[\p{L}]*|сравн[\p{L}]*|upored\w*|poredi\w*)/iu;
export function classifyGregoryOpeningQuestion(question){
 if(typeof question!=="string"||!author.test(question))return {isNamedGregory:false,eligible:false,reason:"NOT_NAMED_GREGORY"};
 if(exactQuotation.test(question))return {isNamedGregory:true,eligible:false,reason:"DIRECT_QUOTATION_NOT_APPROVED"};
 if(outOfScope.test(question))return {isNamedGregory:true,eligible:false,reason:"TOPIC_NOT_ESTABLISHED_BY_OPENING_EXCERPTS"};
 if(comparison.test(question))return {isNamedGregory:true,eligible:false,reason:"COMPARATIVE_SCOPE_UNSUPPORTED"};
 if(!mourning.test(question)||!episode.test(question))
  return {isNamedGregory:true,eligible:false,reason:"BEYOND_VERIFIED_OPENING_DIALOGUE"};
 return {isNamedGregory:true,eligible:true,reason:"BASIL_MACRINA_OPENING_GRIEF"};
}

