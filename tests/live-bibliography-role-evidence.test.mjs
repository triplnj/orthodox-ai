import test from "node:test";
import assert from "node:assert/strict";
import {createLoader} from "./helpers/load-ts.mjs";
const {explicitRoleAttested,namedAuthorFromEnglishQuestion}=createLoader({})("src/lib/patristics/live-bibliography-role-evidence.ts");
const cases=[
 ["Saint Basil the Great wrote On the Holy Spirit.","On the Holy Spirit","AUTHOR","Saint Basil the Great",true],
 ["Saint Basil the Great is identified as author of On the Holy Spirit in the critical edition.","On the Holy Spirit","AUTHOR","Saint Basil the Great",true],
 ["Saint Basil the Great wrote On the Holy Spirit.","On the Holy Spirit","TRANSLATOR","Saint Basil the Great",false],
 ["Saint Basil the Great reviewed On the Holy Spirit.","On the Holy Spirit","AUTHOR","Saint Basil the Great",false],
 ["The modern review discusses On the Holy Spirit without documenting who wrote it.","On the Holy Spirit","AUTHOR","Saint Basil the Great",false],
 ["Saint Basil the Great did not write On the Holy Spirit.","On the Holy Spirit","AUTHOR","Saint Basil the Great",false],
 ["Lorenzo Scupoli wrote Unseen Warfare.","Unseen Warfare","AUTHOR","Saint Nicodemus the Hagiorite",false],
 ["Saint Nicodemus the Hagiorite adapted Unseen Warfare for Orthodox readers.","Unseen Warfare","ADAPTOR","Saint Nicodemus the Hagiorite",true],
 ["Saint Nicodemus the Hagiorite adapted Unseen Warfare.","Unseen Warfare","AUTHOR","Saint Nicodemus the Hagiorite",false],
 ["Saint Gregory of Nyssa authored On the Soul and the Resurrection.","On the Soul and the Resurrection","AUTHOR","Saint Gregory of Nyssa",true],
 ["Saint Isaac the Syrian compiled Ascetical Homilies.","Ascetical Homilies","COMPILER","Saint Isaac the Syrian",true],
 ["The scholar comments on On the Soul and the Resurrection. Saint Gregory of Nyssa wrote it.","On the Soul and the Resurrection","AUTHOR","Saint Gregory of Nyssa",false],
 ["Saint Justin Popovich authored Dogmatics of the Orthodox Church.","Dogmatics of the Orthodox Church","AUTHOR","Saint Justin Popovich",true],
 ["Saint Maximus the Confessor wrote Ambigua.","Ambigua","AUTHOR","Saint Maximus the Confessor",true],
 ["Ἰωάννου τοῦ Δαμασκηνοῦ λόγος ἀπολογητικὸς πρὸς τὰς ἁγίας εἰκόνας.","Περὶ εἰκόνων","AUTHOR","Saint John of Damascus",false],
];
for(const [quote,work,role,author,expected] of cases)test("role entailment "+String(cases.indexOf(cases.find(x=>x[0]===quote)))+" "+role,()=>{
 assert.equal(explicitRoleAttested({quote,work,role,authorNames:[author]}),expected);
});
test("extracts an English named subject but does not invent one from Cyrillic",()=>{
 assert.match(namedAuthorFromEnglishQuestion("List works of Saint Basil the Great"),/Saint Basil the Great/);
 assert.equal(namedAuthorFromEnglishQuestion("Наведи дела светог Јована Дамаскина"),null);
});
