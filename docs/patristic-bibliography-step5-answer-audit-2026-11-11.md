# Step 5/6 — bibliography answer and evidence audit (2026-11-11)

## Scope and verification boundary
Audit target: the reviewed-only bibliography adapter added in step 4, based on the
source and contributor graph in steps 2–3. This is **not** a test of authenticated
production Chat responses. No live OpenAI reply, user session, production database
or billing integration was exercised. Do not label the result as an end-to-end
answer-quality pass.

## Reproducible checks
Automated suite: `tests/bibliography-answer-audit-step5.test.mjs`.
- Serbian Cyrillic nominative/genitive and Latinized Nicodemus variants
- English names and contributors (Macarius, Agapios, Scupoli)
- Exact work / requested-person / role / reviewed evidence ID correspondence
- No promotion of `REVIEW_REQUIRED` or `DISPUTED` contributions
- Macarius: compiler of Philokalia (not sole author)
- Nicodemus: editor of Philokalia and Pedalion, adaptor of Unseen Warfare,
  translator for the Theophylact Pauline commentary edition
- Scupoli: source author of underlying text, not author of Nicodemus' adaptation
- No misleading claim of a complete works list
- Unknown authors, subject questions and ambiguous multi-author questions
  retain existing retrieval rather than claiming catalog authority
- Bibliographic links cannot be treated as verified direct-text quotations

## Defects found and fixed
1. Serbian Latin query `Nabroj dela Nikodima Agiorita` lacked an exact name alias.
2. Serbian genitive `Агапија Леонардоса` lacked an exact name alias.
Added explicit variants to seed JSON; this changes no schema or production data.

## Outstanding acceptance checks for step 6
- Compare actual authenticated **preview** Chat answers with source URLs and
  roles shown in source cards, and inspect streaming from the client.
- Test whether the model invents extra titles or turns editorial contributions
  into sole authorship despite the supplied context. The adapter supplies safe
  evidence but does not mechanically enforce the generated answer's accuracy.
- Ensure source links are reachable at the time of the test; a stored reviewed
  bibliography entry is not proof of permanent URL availability.
- Do not roll out until PRs #59 and #60 are reviewed and merged in order,
  and end-to-end sample answers are reviewed.

## Recommended interactive sample questions
1. Наведи дела светог Никодима Светогорца.
2. Да ли је свети Никодим написао Филокалију?
3. Ко је аутор Невидљиве борбе, а ко је приредио њену грчку верзију?
4. Која је улога Агапија Леонардоса у Пидалиону?
5. Наведи сва дела светог Никодима, без изузетка.
6. Наведи дела светог Јустина Поповића.

Expected quality gate: clearly distinguish AUTHOR, EDITOR, COMPILER, ADAPTOR,
TRANSLATOR, CO_AUTHOR and SOURCE_AUTHOR; cite relevant reviewed bibliography,
never imply an exhaustive collection from a SELECTED corpus. For questions not
covered by the catalog, use ordinary research and do not invent citations.
