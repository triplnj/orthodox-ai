import test from "node:test";
import assert from "node:assert/strict";
import {createLoader} from "./helpers/load-ts.mjs";
const {bibliographyGraphContext,recognizesBibliographyIntent}=createLoader({})("src/lib/patristics/bibliography-knowledge-graph.ts");
test("offline graph recognizes Serbian requests previously returning generic no-source",()=>{
 for(const q of [
 "Наведи дела светог Максима Исповедника: Ambigua, Mystagogia и Questions to Thalassius",
 "Које су аутентичне посланице светог Игњатија Богоносца и спорне редакције?",
 "Ко је аутор списа Мучеништво Поликарпово?",
 "Наведи најважнија дела светог Василија Великог",
 "Наведи дела светог Григорија Ниског",
 ])assert.equal(recognizesBibliographyIntent(q),true,q);
 assert.equal(recognizesBibliographyIntent("What does Saint Basil teach about grace?"),false);
});
test("Maximus gets 3 source-tagged distinct works without network",()=>{
 const r=bibliographyGraphContext("Наведи дела светог Максима Исповедника, Ambigua, Mystagogia и Questions to Thalassius");
 assert.equal(r.sources.length,6);
 assert.equal(new Set(r.sources.map(x=>x.workTitle)).size,3);
 assert.ok(r.sources.every(x=>x.metadata.roles[0]==="AUTHOR"));
 assert.ok(r.context.includes("CCSG"));
});
test("Ignatius's seven letters are a corpus, not seven independent editions",()=>{
 const r=bibliographyGraphContext("Које су аутентичне и спорне посланице светог Игњатија Богоносца?");
 assert.ok(r.sources.some(x=>x.metadata.relation==="COLLECTION"));
 assert.match(r.context,/middle recension/);
});
test("Polycarp is subject, never author of martyrdom account",()=>{
 const r=bibliographyGraphContext("Ко је аутор списа Мучеништво Поликарпово?");
 assert.ok(r.sources.length>=1);
 assert.ok(r.sources.every(x=>x.metadata.roles[0]==="SUBJECT_NOT_AUTHOR"));
 assert.match(r.context,/Church of Smyrna/);
});
test("Gregory and Basil index headings cannot become verified author-role attributions",()=>{
 for(const q of ["Наведи дела светог Григорија Ниског","Наведи дела светог Василија Великог"]){
  const r=bibliographyGraphContext(q);
  assert.ok(r.sources.length>0);
  assert.ok(r.sources.every(x=>x.metadata.roles[0]==="UNKNOWN"||x.metadata.roles[0]==="AUTHOR"));
  assert.ok(r.sources.filter(x=>x.metadata.sourceKind==="INDEX_LISTED").every(x=>x.metadata.roles[0]==="UNKNOWN"));
 }
});
test("crosschecked original, translator, and adaptation roles remain separate",()=>{
 const r=bibliographyGraphContext("Наведи дела светог Јована Дамаскина");
 assert.ok(r.sources.some(x=>x.metadata.relation==="PART_OF"));
 assert.ok(r.sources.some(x=>x.metadata.parentWorkTitle==="Fount of Knowledge"));
 assert.ok(r.sources.every(x=>x.metadata.editorialReview===false));
});
test("the index never confuses a nonmatching question or invents an author",()=>{
 assert.equal(bibliographyGraphContext("Наведи дела светог Исака Сирина"),null);
 assert.equal(bibliographyGraphContext("Наведи дела светог Максима Исповедника и Игњатија Богоносца"),null);
 assert.equal(bibliographyGraphContext("What does Saint Ignatius teach about love?"),null);
});

test("Basil and Athanasius crosschecked names resolve through canonical author identities",()=>{
 for(const [question,work] of [
  ["Наведи дела светог Василија Великог","On the Holy Spirit / De Spiritu Sancto"],
  ["Наведи дела светог Атанасија Великог","On the Incarnation / De Incarnatione Verbi"],
 ]){
  const result=bibliographyGraphContext(question);
  assert.ok(result.sources.some(x=>x.workTitle===work&&x.metadata.roles.includes("AUTHOR")),question);
  assert.ok(result.sources.some(x=>x.metadata.sourceKind==="CROSSCHECKED"),question);
 }
});

test("real preview incident: declined Игњатију and Игнатију case forms now resolve to actual corpus",()=>{
 for(const question of [
  "Која дела која се приписују светом Игњатију Богоносцу сматрају се аутентичним, а која спурним? Објасни разлику између средње и дуже редакције посланица и наведи научне изворе.",
  "Која дела која се приписују светом Игнатију Богоносцу сматрају се аутентичним, а која спурним? Објасни разлику између средње и дуже редакције посланица и наведи научне изворе.",
  "Које су аутентичне посланице Игњатија Антиохијског?",
 ]){
  assert.equal(recognizesBibliographyIntent(question),true,question);
  const result=bibliographyGraphContext(question);
  assert.ok(result?.sources.length>=2,question);
  assert.ok(result.context.includes("Ephesians, Magnesians, Trallians"),question);
  assert.ok(result.context.includes("long recension"),question);
 }
});
test("lexical matching must reject innocent substrings and theological queries",()=>{
 assert.equal(recognizesBibliographyIntent("Које књиге говоре о свету и игри?"),false);
 assert.equal(bibliographyGraphContext("Која су учења светог Игњатија о смирењу?"),null);
});
