import test from "node:test";
import assert from "node:assert/strict";
import { createLoader } from "./helpers/load-ts.mjs";

test("fast research uses one bounded web search and preserves source provenance", async () => {
  const calls = [];
  const load = createLoader({
    "@/lib/ai/openaiClient": {
      getOpenAI: () => ({ responses: { create: async (params, options) => {
        calls.push({ params, options });
        return {
          output_text: "Saint Nicholas Velimirovich wrote works such as The Prologue from Ohrid.",
          output: [{
            type: "message",
            content: [{ type: "output_text", text: "A grounded account", annotations: [{
              type: "url_citation",
              url: "https://www.oca.org/saints/lives/2026/03/18/103107-saint-nikolai-of-zhicha",
              title: "Saint Nikolai",
            }] }],
          }],
        };
      } } }),
    },
    "@/lib/diagnostics": { diagnostic: () => {}, failureCategory: () => "unexpected" },
  });
  const research = load("src/lib/patristics/web-patristic-research.ts");
  const result = await research.researchPatristicQuestionOnWeb("Ко је Свети владика Николај Велимировић?");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].params.model, "gpt-4.1-mini");
  assert.equal(calls[0].params.tool_choice, "required");
  assert.equal(calls[0].params.tools[0].type, "web_search");
  assert.equal(calls[0].options.maxRetries, 0);
  assert.ok(calls[0].options.timeout < 30000);
  assert.equal(result.sources.length, 1);
  assert.match(result.sources[0].sourceUrl, /^https:\/\/www\.oca\.org\//);
});
