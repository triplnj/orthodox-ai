import test from "node:test";
import assert from "node:assert/strict";
import {createLoader} from "./helpers/load-ts.mjs";
import {readFileSync} from "node:fs";
const {applyClaimVerdicts,answerUnits}=createLoader({"server-only":{}})("src/lib/chat/claim-grounding-gate.ts");
function src(author,excerpt,metadata={}){return {provider:"CURATED_TEXT",authorName:author,workTitle:"Source work",sourceUrl:"https://example.com/work",verificationStatus:"CURATED_PATRISTIC_TEXT_REPOSITORY",metadata:{excerpt,...metadata}}}
const support=(id,sourceIndex,quote,kind="PASSAGE")=>({id,verdict:"supported",sourceIndex,evidenceQuote:quote,evidenceKind:kind});
test("Chrysostom unsupported punitive attribution removed while genuinely sourced scripture reading survives",()=>{
 const quote="Hearken ye, as many as are worldly, and have the charge of wife and children";
 const answer="Златоусти подстиче родитеље да читају Писмо.\nЗлатоусти тврди да родитељи заслужују најтежу казну.";
 const r=applyClaimVerdicts(answer,[src("John Chrysostom",quote+".")],{verdicts:[support(0,0,quote),{id:1,verdict:"unsupported",sourceIndex:null,evidenceQuote:null}]});
 assert.equal(r.checked,2);assert.equal(r.rejected,1);assert.match(r.answer,/читају Писмо/);assert.doesNotMatch(r.answer,/најтежу казну/);
 assert.equal(r.audit.claims[0].status,"excerpt_matched");
});
test("Maximus claim unsupported by unrelated Gregory evidence, and skipping a verdict never retains it",()=>{
 const q="Свети Максим учи да је душа самобитно вечна.\nДуша је створена.";
 const result=applyClaimVerdicts(q,[src("Gregory of Nyssa","And Macrina sought to console him regarding the death of Basil.")],{verdicts:[{id:0,verdict:"unsupported",sourceIndex:null,evidenceQuote:null}]});
 assert.match(result.answer,/Нисам могао/);assert.equal(result.rejected,2);assert.doesNotMatch(result.answer,/самобитно вечна/);
});
test("rejects model-fabricated evidence quote, wrong source index and duplicate verdicts",()=>{
 const q="Свети Исак говори о смирењу и молитви.";
 const sources=[src("Isaac the Syrian","Watchfulness and humility are commended in the life of prayer.")];
 for(const row of [support(0,0,"a completely fabricated sentence over twenty five letters"),support(0,99,"Watchfulness and humility are commended in the life of prayer.")])
  assert.equal(applyClaimVerdicts(q,sources,{verdicts:[row]}).rejected,1);
});
test("bibliography notes can support an Ignatius collection attribution only when tagged bibliographic",()=>{
 const s=src("Ignatius of Antioch","seven authentic letters of the middle recension are widely recognized",{graphRecord:true,supportingStatement:"seven authentic letters of the middle recension are widely recognized"});
 const q="Игњатију се приписује седам посланица средње редакције.";
 assert.equal(applyClaimVerdicts(q,[s],{verdicts:[support(0,0,"seven authentic letters of the middle recension are widely recognized","BIBLIOGRAPHIC")]}).rejected,0);
 assert.equal(applyClaimVerdicts(q,[s],{verdicts:[support(0,0,"seven authentic letters of the middle recension are widely recognized","PASSAGE")]}).rejected,1);
});
test("a joint sentence must receive a single verdict supporting ALL included assertions",()=>{
 const q="Свети Григорије дели тугу са Макрином, али забрањује свако природно жаљење.";
 const s=src("Gregory of Nyssa","She allowed him to grieve and gently reminded him not to mourn without hope.");
 assert.equal(answerUnits(q).length,1);
 assert.equal(applyClaimVerdicts(q,[s],{verdicts:[{id:0,verdict:"contradicted",sourceIndex:null,evidenceQuote:null}]}).rejected,1);
});
test("if model returns malformed verdict list, fail closed rather than displaying asserted teaching",()=>{
 const result=applyClaimVerdicts("Свети Василије тврди да је Свети Дух створење.",[src("Basil","The Spirit is not a creature and must not be counted among creatures.")],{});
 assert.equal(result.status,"unavailable");assert.doesNotMatch(result.answer,/тврди/);
});
test("actual source excerpt is required; a plain web search URL is not an attestation",()=>{
 const q="Свети Јустин говори о светости.";
 const s={provider:"WEB_RESEARCH",authorName:null,workTitle:null,sourceUrl:"https://example.com",metadata:{},verificationStatus:"LIVE_WEB_RESEARCH"};
 assert.equal(applyClaimVerdicts(q,[s],{verdicts:[support(0,0,"this is purportedly a long source excerpt")]}).rejected,1);
});
test("new claim gate executes before user-visible delta, existing audit and persistence",()=>{
 const route=readFileSync("src/app/api/chat/route.ts","utf8");
 const g=route.indexOf("verifyPatristicAnswerClaims(result.answer");
 const d=route.indexOf("onDelta?.(result.answer)",g),audit=route.indexOf("const claimAudit =",g),db=route.indexOf("await completeTurn(",g);
 assert.ok(g>=0&&d>g&&audit>d&&db>audit);
});

test("more than 24 prose units fail closed, not leave unreviewed tail published",()=>{
 const q=Array.from({length:30},(_,i)=>"Свети отац тврди да правило важи за сваког човека "+i+".").join("\n");
 const units=answerUnits(q);
 assert.equal(units.length,30);
 const r=applyClaimVerdicts(q,[],{verdicts:[]});
 assert.equal(r.rejected,30);
 assert.doesNotMatch(r.answer,/важи за сваког човека 29/);
});
