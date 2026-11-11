# Step 2/6 — bibliography data model and editorial seed (2026-11-11)

**Status:** independent non-production bibliographic catalog module and editorial seed. No application Chat wiring, database migration or user-facing changes in this step.

## Files
- `src/lib/patristics/bibliography-catalog.ts`: reusable strongly typed catalog graph, exact/whole phrase author lookup, unambiguous resolution, validation.
- `src/lib/patristics/bibliography-catalog-seed.json`: reviewable catalog data with one editorial seed author (St Nicodemus the Hagiorite), ten distinct titles, ten explicit source records, roles, and statuses.
- `tests/bibliography-catalog-model.test.mjs`: evidence and consistency checks.
- `tests/run-regressions.mjs`: runs the catalog tests in normal CI.

## Normalized entities
- Author: stable ID, canonical name, variants including Serbian Cyrillic/Latin and English/Greek, bibliography completeness marker.
- Work: stable ID, canonical/original titles, translations and variants, language, original/compilation/anthology/adaptation/commentary distinction.
- Contribution: one relation per author–work, one or more roles (AUTHOR, CO_AUTHOR, EDITOR, CO_EDITOR, COMPILER, TRANSLATOR, ADAPTOR, COMMENTATOR); attribution status (SOURCE_ATTESTED, REVIEW_REQUIRED, DISPUTED or REJECTED); linked proof IDs.
- Evidence: stable ID, per-work/per-author URL, source class, precise support scope, supported roles, reviewer, timestamp and review status.

## Content provenance
The starter seed is a **selected bibliography, not a complete listing**. The principal reviewed source is:
https://antiochpatriarchate.org/en/page/saint-nicodemus-the-righteous-of-mount-athos/650/

Its narrative separately identifies editorial work on Philokalia, Scupoli-derived Unseen Warfare, Manual of Confession, Christian Morality, New Theotokarion, Pedalion, New Synaxarion, Seven Catholic Epistles commentary, Heortodromion and New Ladder. In contrast to the old Chat reply, the seed **does not label Philokalia and Unseen Warfare as independently original books authored by Nicodemus**.

Manual of Confession and the New Synaxarion are provisionally marked REVIEW_REQUIRED for the particular contribution classification pending a second source and editorial review. The official account attests the titles, not a complete critical stemma of their textual genealogy. Other items are SOURCE_ATTESTED specifically for the limited bibliographic claim stated in each source record; this does not certify their entire theological content. Reviewers can amend statuses without editing application business logic.

## Fail-closed catalog rules
- Same ID cannot be reused across author/work/evidence.
- An author/work relation cannot cite somebody else's work or evidence.
- SOURCE_ATTESTED must reference a reviewer-checked, non-community-only evidence record confirming the stated contributor role.
- Ambiguous author-name matches return AMBIGUOUS_AUTHOR, never the first matching author.
- Invalid, insecure or blank evidence URLs are rejected.
- A source record cannot pretend to have a reviewer timestamp while still pending review.
- There is no claim that the catalog is complete unless a human editor explicitly marks it REVIEWED_FULL.

## Planned step 3
Review roles and attribution disputes, add contributor relationships for additional authors and critical studies, improve title alignment, and distinguish historically complex adaptation, translation, editorial and compilation roles. Do not display provisional work relations as verified to users.

## Planned step 4
Wire a bibliographic-intent router to verified catalog outputs and a claim-to-work evidence ledger. For sources still pending review, use a clearly labeled provisional bibliography or decline a definitive assertion rather than inventing missing works. Keep original Chat and billing isolation, and allow independently reviewed author records to be inserted without per-author code patches.

## Deployment
No Prisma change, no migration, no database writes, no API endpoint modification. PR review and CI do not affect production data.
