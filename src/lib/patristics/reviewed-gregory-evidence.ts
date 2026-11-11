/**
 * Production-safe, read-only primary-text anchor for the reviewed OPENING scene
 * of Gregory's On the Soul and the Resurrection.
 * The historical English wording is public-domain NPNF, independently compared
 * with New Advent and the isolated staging passage fingerprints (2026-11-10).
 *
 * These snippets establish textual provenance, NOT speaker-attribution for every
 * sentence or a doctrine beyond this episode. No staging DB, credentials or calls.
 */
import type {PatristicResearchContext, PatristicResearchSource} from "./build-patristic-research-context";

const author=/(?:\b(?:gregory\s+of\s+nyssa|gregorius\s+nyssenus|grigorije\s+niski|grigorija\s+niskog)\b|григориј(?:е|а|у|ем)?\s+ниск(?:и|ог|ом|оме))/iu;
const grief=/(?:\b(?:grief|grieving|grieved|mourn\w*|sorrow\w*|comfort\w*|consol\w*|bereave\w*|loss of basil|basil.s death)\b|жалост[\p{L}]*|туг[\p{L}]*|утеш[\p{L}]*|смрт[\p{L}]*|бол[\p{L}]*|жалов[\p{L}]*|tug\w*|žalost\w*|utes\w*|uteh\w*|smrt\w*|žaljen\w*)/iu;
const episode=/(?:\b(?:macrina|basil|makrina|vasilije|vasilija|vasilijem)\b|макрин[\p{L}]*|василиј[\p{L}]*)/iu;
const excluded=/(?:\b(?:verbatim|exact quote|exact words|word.for.word|quote me|direct quotation|immortality|metempsychosis|apokatastasis|pre.existence|universal salvation|origin of (?:the )?soul|bodily resurrection|nature of (?:the )?soul|final restoration|compare|versus|contrast|compared with)\b|дословн[\p{L}]*|тачан цитат|тачне речи|цитирај|апокатастаз[\p{L}]*|бесмртност[\p{L}]*|пресељење душ[\p{L}]*|свеопшт[\p{L}]* спасењ[\p{L}]*|упоред[\p{L}]*|besmrtnost\w*|apokatastaz\w*|doslovno|citiraj|upored\w*)/iu;
export function reviewedGregoryOpeningEligible(question:string):boolean{
 return typeof question==="string"&&question.length<=1500&&author.test(question)&&grief.test(question)&&episode.test(question)&&!excluded.test(question);
}

const provenance=[
 {id:"opening-1",locator:"Opening dialogue, paragraph 1",excerpt:"Basil, great among the saints, had departed from this life to God; and the impulse to mourn for him was shared by all the churches. But his sister the Teacher was still living; and so I journeyed to her, yearning for an interchange of sympathy over the loss of her brother. My soul was right sorrow-stricken by this grievous blow, and I sought for one who could feel it equally, to mingle my tears with."},
 {id:"opening-2",locator:"Opening dialogue, paragraph 2",excerpt:"But when we were in each other's presence the sight of the Teacher awakened all my pain; for she too was lying in a state of prostration even unto death. Well, she gave in to me for a little while, like a skilful driver, in the ungovernable violence of my grief; and then she tried to check me by speaking, and to correct with the curb of her reasonings the disorder of my soul."},
 {id:"opening-3",locator:"Opening dialogue, paragraph 3",excerpt:"She quoted the Apostle's words about the duty of not being grieved for them that sleep; because only men without hope have such feelings. With a heart still fermenting with my pain, I asked —"}
] as const;
export function reviewedGregoryOpeningEvidence(currentQuestion:string):PatristicResearchContext|null{
 if(!reviewedGregoryOpeningEligible(currentQuestion))return null;
 const sources:PatristicResearchSource[]=provenance.map(p=>({
  provider:"CURATED_TEXT",authorName:"St. Gregory of Nyssa",
  workTitle:"On the Soul and the Resurrection",reference:p.locator,
  originalLanguage:"English",sourceUrl:"https://www.newadvent.org/fathers/2915.htm",
  scanUrl:null,verificationStatus:"REVIEWED_PRIMARY_TEXT_TRANSLATION",
  metadata:{reviewedPilot:true,passageId:p.id,excerpt:p.excerpt,speakerVerified:false,
    sourceTextMatch:true,exactQuoteAllowed:false,sourceTextScope:"BASIL_MACRINA_OPENING_GRIEF"}
 }));
 const context=[
  "REVIEWED PRIMARY-TEXT ANCHOR — Gregory of Nyssa, On the Soul and the Resurrection, OPENING EPISODE ONLY.",
  "These are matched excerpts of an English translation, NOT the Greek critical edition. This does not verify speakers throughout the work or doctrines elsewhere.",
  "Paraphrase only claims established by these excerpts. Do NOT invent direct quotations or exact PG/PL references.",
  "Macrina shares Gregory's mourning. She allows grief, then leads him towards the Apostle's distinction: grieve with Christian hope rather than AS THOSE WITHOUT HOPE. Never claim natural mourning is prohibited.",
  "The text compares her response to a skilful driver. It DOES NOT mention horses, cavalry, or other imaginary details.",
  "Distinguish Gregory as AUTHOR and the narrative's first-person speaker; do not attribute the Apostle's words to Gregory as an original saying.",
  "This source does NOT establish Gregory's doctrine of the soul, immortality, the universal restoration, or any theology outside the opening consolation.",
  ...provenance.map((p,i)=>["[REVIEWED_EXCERPT_"+(i+1)+"]","WORK: On the Soul and the Resurrection","AUTHOR: St. Gregory of Nyssa","SOURCE: https://www.newadvent.org/fathers/2915.htm","LOCATION: "+p.locator,"EXCERPT: "+p.excerpt,"[/REVIEWED_EXCERPT_"+(i+1)+"]"].join("\n"))
 ].join("\n\n");
 return {context,sources,providersAttempted:["REVIEWED_PRIMARY_TEXT"],providersSucceeded:["REVIEWED_PRIMARY_TEXT"]};
}
