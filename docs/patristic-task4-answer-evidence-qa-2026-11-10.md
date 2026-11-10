# OrthodoxAI — Task 4: Answer & evidence QA (isolated pilot)
Date: 2026-11-10
Environment: `experiment/patristic-catalog-author-v2-20261109`; isolated Neon Preview branch `br-empty-breeze-asd2dqrq`; guarded source-audit staging branch `br-spring-frost-assfzje6`
Status: **Pilot answer QA passed with explicit scope boundaries. Full-corpus theological sign-off NOT granted.**

## The source-grounded pilot tested
- Gregory of Nyssa, *On the Soul and the Resurrection*, the opening passage about the death of Basil and Macrina's consolation.
- Two public edition witnesses: https://www.newadvent.org/fathers/2915.htm and https://www.stninaorlando.org/holy-fathers/gregory-of-nyssa/on-the-soul-and-the-resurrection/.
- Six SHA-256 pinned, fully source-matched passages. No speaker or verbatim quote approval inferred from bibliographic work authorship.
- Apostolic nuance cross-checked against 1 Thessalonians 4:13–14, https://bible.usccb.org/bible/1thessalonians/4: *do not mourn as those without hope*, NOT a universal prohibition of natural sorrow.

## Real authenticated Preview Chat
- User submitted: “How does Macrina help Gregory of Nyssa overcome his grief after Basil’s death?”
- The completed turn and associated three source cards were inspected read-only in the **isolated** Neon branch.
- 1 conversation / 1 completed turn / 2 messages / 3 source cards; 2 cards have excerpt-matched claim mappings, the third has none. All three retain `STAGING_TEXT_MATCH_ONLY`, not theological certification.
- The Chat answer named Macrina as the consoling Teacher, Gregory as dialogue author, and apostolic teaching as apostolic rather than Gregory's own original words. No invented source was observed.
- An unmatched third card and misleadingly strong “claim linked” presentation were fixed in `src/components/chat/SourceCards.tsx` on the experiment branch.
- This authenticated test was performed before Task 4's newest Preview source restrictions; do not claim the latest deployment has received another authenticated Chat POST.

## Independent REAL LLM generative holdout
- Five newly generated answers using actual `gpt-4.1-mini` calls, the six SHA-pinned source passages fetched from guarded **staging** with SELECT-only SQL, and Preview-equivalent evidence/answer restrictions; not the full Next.js HTTP Chat route.
- Three English, one Serbian Latin, one Serbian Cyrillic.
- Ten adversarial/unsupported query cases rejected before model invocation (immortality, apokatastasis, fabricated exact quotes, unrelated doctrines, comparisons, etc.).
- Fixed maximum five real model calls per run; zero DB mutations and zero production operations.
- **Final accepted holdout:** https://github.com/triplnj/orthodox-ai/actions/runs/42817263942; artifact `patristic-preview-real-answer-holdout`, ID `13765361888`.
- Automated result: **5/5 structure/script/source constraints passed and 10/10 negative queries refused**. Final answers manually inspected for the Macrina/Basil context and the crucial distinction between grief with hope and grief without hope.

## Defects found and fixed during stress tests
1. **Mixed-language / duplicate model output:** initial generation 1/5 script checks; English and Serbian Latin answers included an unwanted second Cyrillic version and one Cyrillic version duplicated itself. Explicit one-language prompting, a language/script check and a duplicate-paragraph check were added.
2. **Theological overstatement:** initial five generated answers portrayed mourning itself as prohibited (“grief is not fitting,” “sorrow is unbefitting,” “zabranjuju da se tuguje,” etc.). This misreads 1 Thess. 4:13. Updated Preview evidence instructions and added `MISREADS_APOSTOLIC_MOURNING_WITH_HOPE` regression cases on English and Serbian answers. Final outputs preserve natural mourning with Christian hope.
3. **Unsupported source scope:** the source-checking pilot cannot answer unrestricted questions about the whole soul/resurrection dialogue, universal salvation or exact quotations on just six opening paragraphs. A fail-closed coverage classifier now refuses those topics instead of offering unrelated snippets or silently falling back to the legacy path.
4. **Unsupported reference/quotation:** generated PG/PL references, verbatim source copying and fabricated speaker certification are structurally denied; the Preview assistant buffers pilot responses until post-generation checks complete.
5. **Serbian stylistic errors:** known mis-translation `тужи` for `тугује`, malformed `названа/звана Учитељица` apposition and one adjective-case error were repaired with narrowly scoped text normalization. Source content and doctrinal propositions are not changed.
6. **Invented horse imagery:** model sometimes expanded the historical “skilful driver / curb” comparison into a wild horse or cavalry. Those are blocked and explicitly excluded from the generation instructions. **Residual observation:** the Serbian Latin final output used `nemirnu kočiju`, an embellished detail absent from the selected passage. This stylistic/source-fidelity imperfection requires future improvement and is not represented as a verified direct quotation.

## Verified CI evidence
- Strict TypeScript, provenance, source audit, 18-case author routing, nine-case source integration, Gregory speaker controls and Preview answer checks:
  https://github.com/triplnj/orthodox-ai/actions/runs/42817263808 — SUCCESS.
- Five REAL AI generations and ten negative guards:
  https://github.com/triplnj/orthodox-ai/actions/runs/42817263942 — SUCCESS.
- Last verified code SHA before report: `1f7679063766b051d57a787d1cafdc554104cd53`.

## Publication constraints and next task
- These results certify **only the tested Preview pilot's basic evidence selection and controlled answer behavior**; they do not certify all 297 staged passages, every Church Father, every dialogue voice, or the truth of arbitrary theological claims.
- 73 of 297 source excerpts remain quarantined in source-review classification; the rest have textual correspondence, **not automatic permission for direct quotation or verified speaker attribution**.
- Do not connect the Preview pilot to main or production until task 5 safety/release checks and wider editorial coverage are explicitly cleared.
- Production DB and `main` unchanged. No production payments or email sends from QA.

## Final Preview deployment & post-deploy read-back
- Preview deployment `dpl_3QbBeZfWMpeknVox8MBiSgrQTBTs`: **READY**, SHA `1f7679063766b051d57a787d1cafdc554104cd53`, https://orthodox-ai-24li-8ne0w46kq-iconismusyahoocoms-projects.vercel.app.
- Protected read-only `/api/patristics/preview-readiness` returned HTTP 200: `status=READY`, `environment=ISOLATED_PREVIEW`, `selectedSourceCount=3`, `exactQuoteApproved=false`, `speakerAutoVerified=false`, `authenticatedChatTested=false`. This last flag truthfully indicates that a *new* signed-in POST has not been repeated against this specific updated deployment.
- Database counts after deployment (read-only): isolated Preview 1 synthetic QA user, 1 session, 1 conversation, 2 messages, 297 source passages, `PATRISTIC_CHAT_ISOLATED_PREVIEW` guard. Production 74 users, 29 conversations, 864 messages and 4 blog posts, unchanged from the previous snapshot.
- **No merge, production deployment, subscription/billing activity or live data mutation was performed.**
