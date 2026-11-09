# OrthodoxAI — frozen English holdout, first run (2026-11-09)

## Experimental protocol

Twelve new English questions were locked in `tests/fixtures/patristic-english-holdout-12.json` **before running the holdout benchmark**, with twelve source-hash-checked target passage IDs from Neon staging branch `br-spring-frost-assfzje6`.

The question set covers:
- St Basil the Great, *Hexaemeron*, Homily I: 3 questions (invisible creation; investigation of essence; competing cosmological hypotheses).
- St John Chrysostom, *Homily I on Matthew*: 5 questions (Luke; John; chastity; heavenly rewards; spiritual warfare).
- St Gregory of Nyssa, *On the Soul and Resurrection*: 4 questions (will and emotions; emotion versus virtue/vice; love, faith and hope; birth/death and humanity's fullness).

These **12 passage IDs do not appear among the initial 61 evidence associations or the 10 v2 review proposals**. No holdout question duplicates the original 30 questions. The texts remain from the SAME three works: this tests new questions and passage identities within the existing corpus, not generalization to entirely new authors or works.

## Precommitted measurement

The executable `scripts/patristics/evaluate-12-holdout-staging.mjs` compares **unaltered** embedding similarity and **unaltered** fixed English reranker, taking the top 20 candidate passages, scoring the top ten and reporting Hit@3/5/10, Recall@3/5/10, nDCG@3/5/10 and reciprocal rank. Both global and expected-author retrieval are measured.

The workflow `.github/workflows/patristic-english-holdout-12-once.yml` runs isolation tests, checks the staging-branch marker, passage hashes and indexed corpus count, makes a single bounded batch of 12 embedding queries and uploads a complete JSON report. It does not synthesize answers or access production.

## Interpretation boundaries

1. **Gold labels are provisional, not independently theologically certified.** Some Gregory dialogue chunks require verification of speaker continuity; a retrieved passage is not inherently the saint's endorsed teaching.
2. A question expressly asking about the hypotheses Basil *reports* or the tradition Chrysostom *recounts* does not imply those claims are the father's own doctrinal endorsement.
3. A difference in reported scores must be interpreted in light of different question distribution and one marked passage per question; do not directly treat a percentage difference with the 30-question set as an algorithmic improvement.
4. Never edit these holdout questions or their labels in response to the results. If labels need correction, create a separately versioned adjudication record and retain the first report.
5. No deployment to live OrthodoxAI is authorized by a passing CI job or successful retrieval scores alone.

At the time this protocol was committed, no new holdout benchmark scores had been verified.
