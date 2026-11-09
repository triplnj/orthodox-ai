# Patristic catalog v2 — expanded staging regression report
Date: 2026-11-09

## Scope and execution
- Repository branch: `experiment/patristic-catalog-author-v2-20261109`, **not main**.
- Staging database: Neon project `winter-mountain-30736951`, branch `br-spring-frost-assfzje6`.
- The author catalogue was queried read-only for the tests. The evaluator was also exercised with mocked DB calls and staging guard response; both SQL queries were SELECT and connection cleanup was observed.
- No production route, production database, live answer generation, or billing was modified.
- GitHub Actions successful execution has **not** been verified via job logs; the below results are connector-based source execution and mock-backed evaluator replay, not a CI assertion.

## Verified tests
| Check | Result |
|---|---|
| Original 18-case staging fixture | 18/18 |
| 19-case post-discovery adversarial regression fixture | 19/19 |
| Resolver unit test groups | 10/10 |
| Passage speaker attribution unit test groups | 3/3 |
| Saved 19-case regression test group | 1/1 |
| Evaluator with mocked DB and actual staged catalogue rows | 18/18 + 19/19 |
| Guard/SQL shape in mocked execution | 2 SELECT statements, successful guard, connection closed |

**Do not treat these results as a blinded accuracy estimate.** The original 18 cases were curated, and the 19 new cases were developed in response to observed failures.

## Defects discovered and corrected
1. An old unit test expected a bare `Cyril` to route as global instead of ambiguous. The test expectation was corrected to fail closed.
2. Recognized Basil plus unknown unprefixed `Maximus the Confessor` or `Photios the Great` could route as Basil only. Added protective detection of capitalized names.
3. `basil` in non-author contexts such as plant questions was treated as an author hint. Bare-name ambiguity now requires author-discussion context.
4. Generic Serbian `Свети Оци` wrongly counted as one named unknown author. Added generic plural handling.
5. Latin alternative `Gregorius Nyssenus` and Serbian no-title `Василије Велики` were absent from the staged catalogue; added to `nameVariants` of the relevant staging records (existing variants retained).
6. `compare repentance and faith according to St Basil` incorrectly selected multi-author routing. Compare is now multi-author only when exactly two authors are recognized.
7. Explicit comparison with an additional partially recognized/unknown author fails closed.

## Important limits
- The speaker attribution module is **shadow-only**, not wired into chat. A caller-supplied review-record identifier is not by itself proof of a genuine editorial review; trusted persistence and verified lookup remain required.
- Gregory of Nyssa duplicate author records (5 vs 175 indexed passages) are untouched. Four of five pilot chunks had preliminary prefix overlap in the longer edition after normalization.
- The current work does not test retrieval quality, web source validity, theological interpretation, verbatim quotation correctness, or end-user answer helpfulness.
- Before shipping: validate genuine CI logs, make review-record verification authoritative, evaluate source ranking/attribution and complete staging Chat end-to-end tests.

## Code added to repeat these checks
- `tests/fixtures/patristic-author-catalog-v2-adversarial.json`
- `tests/patristic-author-catalog-v2-adversarial.test.mjs`
- Staging evaluator reports both fixture groups.
- Staging workflow includes all regression tests and both sets of per-case metrics.
