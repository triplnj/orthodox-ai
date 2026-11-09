# OrthodoxAI — v2 source-evidence editorial review (PROPOSAL ONLY)

Date: 2026-11-09. Staging branch: `br-spring-frost-assfzje6`.

The frozen v1 benchmark contains **30 questions** and **61 source-evidence associations**. The user-supplied v1 report measures global reranked **Hit@10 = 27/30** and nDCG@10 = **0.68627**. These are *provisional evidence retrieval metrics*, not theological accuracy.

Proposed version 2 additions are stored separately at `tests/fixtures/patristic-english-30-evidence-v2-review-candidates.json`. **None is certified or merged into v1.** Ten distinct source passages were checked against Neon IDs and source-content hashes.

## What the existing report actually found

| Query | What retrieved v1 did | New textual candidates | Status |
| --- | --- | --- | --- |
| `basil-07` | Missed the two exact positive references but retrieved paragraph 018 at rank **3** and paragraph 011 ordinal 0 at rank **4** (global reranking) | 018 is about the visible beauty and wisdom of the maker; 011 begins the artist/artwork analogy, continued in the v1 evidence ordinal 1 | Potentially valid **supporting** context; independent approval required. |
| `gregory-02` | Missed the two early reference passages, but retrieved paragraph 033 ordinal 1 at rank **7** and paragraph 031 ordinal 1 at rank **8** | Both discuss the spiritual soul's non-dissolution and are plausibly relevant to Macrina's reasoning, subject to unverified speaker metadata | Editorial speaker and doctrinal relevance review required. |
| `gregory-09` | Retrieved paragraph 087 ordinal 0 at rank **6**, 087 ordinal 2 at rank **9**, and paragraph 086 ordinal 0 at rank **10** | These continue or introduce arguments in response to bodily-dissolution objections. The exact v1 response at 086 ordinal 1 still did not rank top-ten | Editorial dialogue boundary review required. |

### Additional high-risk passages that must NOT count as direct Macrina answers

- Gregory 032 ordinal 0: begins **“I rejoined”** and develops an objection via the shipwreck analogy. It is not Macrina's answer.
- Gregory 054 ordinal 0: begins **“Then to meet such an objection, I rejoined”** and offers Gregory's reasoning. Not Macrina's direct statement.
- Gregory 084–085 chunks: the existing `LibraryPassageAttribution` identifies Gregory speaking in **OBJECTION / TEXT_VERIFIED** chunks. Do not promote their high similarity scores to approved teaching.

## Next evaluation gate

1. Independently adjudicate each candidate as *directly relevant, supporting, objection only, or reject*; check speaker continuity, including boundaries at 031–033 and 085–087. This step cannot be inferred from similarity scores.
2. Retain v1 unchanged; create a signed/editor-approved versioned v2 fixture only after those decisions.
3. Report before/after retrieval metrics on both annotation versions **with explicit disclosure that expanding ground truth changes the denominator**, not the algorithm.
4. Use independent English holdout questions not used to construct v2 before calling any retrieval improvement validated.
5. Review faithfulness of every planned OrthodoxAI quotation against the source text before staging-to-production promotion.

**Lobster mode** here means a defensible, auditable chain from English question to passage, speaker, interpretation, source URL and editorial approval—not optimizing metrics to a target.
