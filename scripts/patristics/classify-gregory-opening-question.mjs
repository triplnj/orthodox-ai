/** Reviewed preview pilot coverage. Do not confuse 'same book' with evidence for any thesis in it.
 * This tiny source subset supports ONLY the opening grief/consolation exchange.
 */
const author=/(?:\b(?:gregory\s+of\s+nyssa|gregorius\s+nyssenus|grigorije\s+niski|grigorija\s+niskog)\b|григориј[аеу]?\s+ниск[оигм]*)/iu;
const mourning=/(?:\b(?:grief|grieving|grieved|mourn\w*|sorrow\w*|comfort\w*|consol\w*|bereave\w*|loss of basil|basil.s death)\b|жалост\w*|туг\w*|утеш\w*|смрт\w*|бол\w*|жалов\w*|tug\w*|žalost\w*|utes\w*|uteh\w*|smrt\w*|žaljen\w*)/iu;
const episode=/(?:\b(?:macrina|basil|makrina|vasilije|vasilija|vasilijem)\b|макрин\w*|василиј\w*)/iu;
const exactQuotation=/(?:\b(?:verbatim|exact quote|exact words|word.for.word|quote me|direct quotation)\b|дословн\w*|тачан цитат|тачне речи|цитирај|дословно|doslovno|tačan citat|tačne reči|citiraj)/iu;
const comparison=/(?:\b(?:compare|versus|vs\.?|contrast|both authors|compared with)\b|упоред\w*|поред\w*|сравн\w*|upored\w*|poredi\w*)/iu;
export function classifyGregoryOpeningQuestion(question){
 if(typeof question!=="string"||!author.test(question))return {isNamedGregory:false,eligible:false,reason:"NOT_NAMED_GREGORY"};
 if(exactQuotation.test(question))return {isNamedGregory:true,eligible:false,reason:"DIRECT_QUOTATION_NOT_APPROVED"};
 if(comparison.test(question))return {isNamedGregory:true,eligible:false,reason:"COMPARATIVE_SCOPE_UNSUPPORTED"};
 if(!mourning.test(question)||!episode.test(question))
  return {isNamedGregory:true,eligible:false,reason:"BEYOND_VERIFIED_OPENING_DIALOGUE"};
 return {isNamedGregory:true,eligible:true,reason:"BASIL_MACRINA_OPENING_GRIEF"};
}
