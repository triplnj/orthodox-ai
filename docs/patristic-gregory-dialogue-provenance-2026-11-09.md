# Gregory of Nyssa dialogue provenance audit — protected staging
Date: 2026-11-09. SELECT-only inspection of Neon branch `br-spring-frost-assfzje6`; no production or staging passage mutations.

## Two separate records
Both are catalogued as *On the Soul and the Resurrection*, same NPNF Series II volume 5 (1893), but they have different origin pages, editorial states and segmentation.

| Record | Source | Editorial state | Indexed passages | Distinct passage hashes |
|---|---|---|---:|---:|
| `author_70a3fd40c93b35acefdd905186e79922` | https://www.stninaorlando.org/holy-fathers/gregory-of-nyssa/on-the-soul-and-the-resurrection/ | Work AUTHENTIC; import STAGED; 1893 Moore translation; short curated pilot | 5 | 5 |
| `author_8acfb0ee0a6f046a3528db5d6587582f` | https://www.newadvent.org/fathers/2915.htm | Work UNREVIEWED; import STAGED; translation provenance and boundaries awaiting review | 175 | 175 |

Cross-edition exact `contentSha256` overlap: **0** matching passage hashes. This does not imply different works: segmentation is different, and textual overlap would need normalized comparison. No merge, deletion, reattribution, or activation has been performed.

## Speaker-provenance risk
Samples from the 175-passage edition show alternating voices:
- Source paragraph 018 begins with a response introduced as the Virgin replying. In this dialogue the Teacher is Macrina, not the bibliographic author.
- Source paragraph 017 starts with the narrator's `I rejoined` objection.
- Source paragraph 023 starts `Your instance, she replied`.
- Source paragraph 019 is introduced as `What then, I asked`.

These are real dialogue boundaries, so even *authentic work attribution* is not reliable *speaker attribution*. The shadow-only `assess-passage-attribution.mjs` returns `SPEAKER_NOT_VERIFIED` until reviewed speaker, exact locator and review record identifier are explicitly supplied. It is not connected to the live chat.

## Next editorial gates
1. Independently verify source text and its translation/edition boundaries.
2. Produce a controlled normalized near-duplicate alignment between the 5-passage pilot and 175-passage edition.
3. Add reviewed speaker-level passage attribution with auditable records before enabling direct speaker quotations.
4. Run independent CI and answer-quality evaluation before any production routing change.


## Preliminary text alignment on staging (read-only)
A second SELECT normalized letter case, punctuation and spacing, then checked whether the first 70 normalized characters of each 5-passage pilot chunk occurred in any of the 175 longer-edition chunks:
- 4 of 5 pilot chunks had an exact normalized 70-character prefix match in at least one larger-edition chunk.
- 1 pilot chunk, `pilot_gregory_macrina_first_response`, did not match under this strict prefix test. Its opening differs in spelling (`especial` versus `special`), which can explain an exact-prefix miss.
- Matching locators include the three separate chunks labelled `Opening dialogue — paragraphs 1–3` and `Opening dialogue — paragraph 4`.
This is preliminary overlapping-text evidence, not sufficient for automatically merging records; requires editorial review of entire passage boundaries, language and source provenance.

## Additional router safeguards
Shadow resolver now blocks questions mixing recognized author names with unmatched titled saints, and questions that mention two recognized authors but do not clearly request a comparison. Fixture replay remained 18/18 on the protected staging catalogue; three additional adversarial examples were evaluated and correctly blocked.
