# Bibliography QA — Step 5/6

## Scope and outcome

This stage evaluates the current PR #61 bibliography resolver as a *general mechanism* instead of repeatedly polishing a particular saint's response. It is not proof of release readiness. The matrix runs offline, without secrets, database access, or external API calls.

**Author cohorts (7):** Maximus the Confessor, Basil the Great, Gregory of Nyssa, Isaac the Syrian, Justin Popovich, Nicodemus the Hagiorite, John of Damascus.

**Structural / negative cases:** adapter vs author metadata; work contained in a larger collection; fabricated hierarchy; invented excerpts; wrong URLs; duplicate records; missing sources and curated-only fallback; unrelated doctrinal question detection.

**Critical known gaps (2), characterized but NOT fixed by this stage:**

1. A literal quote can match a real page while a fabricated **role** is attributed to it. String inclusion verifies textual presence, not what the passage *means*.
2. A page can mention a work *about* an author, and the resolver may misinterpret it as the author's own book.

Other unmeasured risks: original-language title translation, semantic work identity across editions, omission of important works, authors with overlapping names, final model answer fidelity, PDF-only scholarship, live provider timeouts, and live end-to-end behavior.

## Acceptance policy

- Green CI means only deterministic harness assertions and project typecheck passed. It does **not** certify bibliographic accuracy.
- **Release gate: NOT MET** until an independent historical bibliography is used as ground truth, and author-role / work-parent / source provenance are judged on real generated answers, for authors absent from the reviewed catalogue.
- Do not merge PR #61 or change production on the basis of this matrix alone.
- Each future issue should be added as a cross-author regression scenario, not addressed with author-specific hardcoding.

## Execution

`node tests/run-regressions.mjs bibliography-step5-matrix`

The report includes a `STEP5_MATRIX` line with counts, known gaps, and the explicit `releaseReady:false` marker.
