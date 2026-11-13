import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Kollyvades movement recognition is connected to the active retrieval router", () => {
  const source = read("src/lib/patristics/should-run-patristic-research.ts");
  assert.match(source, /PATRISTIC_MOVEMENT_PATTERN\s*=\s*\n\s*\//);
  const routerBody = source.slice(source.indexOf("export function shouldRunPatristicResearch"));
  assert.match(routerBody, /PATRISTIC_MOVEMENT_PATTERN\.test\(query\)/);
  assert.match(source, /кољивар/);
});

test("Kollyvades are indexed as historical sources, not fictional folk meanings", () => {
  const curated = read("src/lib/patristics/curated-text-sources.ts");
  assert.match(curated, /kollyvades-oca-church-history/);
  assert.match(curated, /kollyvades-manna-from-athos-bibliography/);
  assert.match(curated, /www\.oca\.org\/orthodoxy/);
});

test("source-dependent answers cannot silently proceed without evidence", () => {
  const route = read("src/app/api/chat/route.ts");
  assert.match(route, /evidenceRequired\s*=\s*shouldRunPatristicResearch\(query\)/);
  assert.match(route, /evidenceUnavailable\s*=\s*evidenceRequired\s*&&\s*!research\?\.sources\.length/);
  assert.match(route, /(?:const|let) result\s*=\s*evidenceUnavailable\s*\?/);
});

test("general OpenAI research uses required broad web search rather than a restricted timeout-starving first pass", () => {
  const research = read("src/lib/patristics/web-patristic-research.ts");
  assert.match(research, /tool_choice: "required"/);
  assert.match(research, /include: \["web_search_call.action.sources"\]/);
  assert.match(research, /runResearch\(query, undefined, controller.signal, mode === "bibliography"\)/);
  assert.doesNotMatch(research, /runResearch\(\s*query,\s*PREFERRED_PATRISTIC_DOMAINS/);
});

test("Serbian follow-up about Lives of Saints retains author context", () => {
  const route = read("src/app/api/chat/route.ts");
  assert.match(route, /житија светих/);
  assert.match(route, /followUp && previousPatristicQuestion/);
});
test("source challenges are explicitly re-researched rather than treated as prior evidence", () => {
  const route = read("src/app/api/chat/route.ts");
  assert.match(route, /const sourceChallenge/);
  assert.match(route, /Previous assistant claim to verify/);
  assert.match(route, /Explicitly verify or retract it/);
});

test("Maximus doctrinal question cannot be replaced by a Justin bibliography", () => {
  const route = read("src/app/api/chat/route.ts");
  assert.doesNotMatch(route, /verifiedBibliographyAnswer/);
  assert.doesNotMatch(route, /bibliographyUnavailable/);
  assert.match(route, /await generateOrthodoxAnswer\(/);
  assert.match(route, /conversation: \{ turns \},(?:\s*\/\/[^\n]*\n)*\s*onDelta: reviewedPilot \|\| doctrinalSourceGate \? undefined : onDelta/);
});
test("fallback responses also emit streaming deltas", () => {
  const route = read("src/app/api/chat/route.ts");
  assert.match(route, /onDelta\?\.\(noSourceMessage\)/);
  assert.match(route, /delta => emit\("delta", \{ text: delta \}\)/);
});

test("PG text has priority over secondary bibliography and interpretation uses context", () => {
  const research = read("src/lib/patristics/build-patristic-research-context.ts");
  const pg = research.indexOf('if (livePg?.context) {', research.indexOf("Source-first order"));
  const wiki = research.indexOf('if (orthodoxWiki.length) {', research.indexOf("Source-first order"));
  assert.ok(pg >= 0 && wiki > pg);
  assert.match(research, /SYNTHESIS METHOD/);
  const service = read("src/lib/ai/chatService.ts");
  assert.match(service, /Patrologia Graeca \(PG\)/);
  assert.match(service, /Patrologia Latina \(PL/);
  assert.match(service, /Philokalia/);
  assert.match(service, /For dialogues identify who is speaking/);
});

test("PG, PL and Philokalia supplement modern Orthodox Fathers, rather than replace them", () => {
  const research = read("src/lib/patristics/build-patristic-research-context.ts");
  assert.match(research, /Additive federation/);
  assert.match(research, /keep all existing verified and curated writings/);
  for (const provider of ["curated?.length", "verified", "livePg?.context", "webResearch?.context"]) {
    assert.ok(research.includes("if (" + provider + ") {"), "missing provider: " + provider);
  }
  const service = read("src/lib/ai/chatService.ts");
  assert.match(service, /expand, NEVER replace/);
  assert.match(service, /John of Kronstadt/);
  assert.match(service, /Nikolaj Velimirovich/);
  assert.match(service, /Justin Popovich/);
});
