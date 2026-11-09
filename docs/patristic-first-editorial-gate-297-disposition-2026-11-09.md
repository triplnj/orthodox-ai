# First editorial-source gate — definitive 297-passage disposition
Date: 2026-11-09
Source evidence: GitHub Actions run 42671629630, artifact 13699306761.
Neon staging branch: br-spring-frost-assfzje6.
Production changes: NONE.

## Audit outcome and restrictive policy
A full external-page audit read 297 stored passages across nine historical editions, with zero source fetch failures, zero content-hash discrepancies. Each of the 297 rows has an explicit classification:
- 224 FULL_NORMALIZED_MATCH: eligible as *source-text candidate evidence*, only; not editorially certified quotations.
- 20 THREE_ANCHORS_MATCH: quarantined until exact boundary review.
- 36 PARTIAL_TEXT_MATCH: quarantined until repaired/reverified.
- 7 TOO_SHORT_FOR_TEXT_AUDIT: quarantined from standalone evidence.
- 1 NO_TEXT_MATCH: quarantined and must not be cited.
- 9 QUARANTINED_NON_EVIDENCE: already hash-pinned as fragments or headings.

**Total: 224 source-matched candidates, 73 quarantined. No direct quote, speaker or doctrinal attribution is automatically approved by this classification.**

A new automated gate `scripts/patristics/finalize-staging-source-review.mjs` consumes the full audit artifact, checks the exact branch, source URLs, all 297 unique IDs, valid hashes, zero fetch errors and immutable expected counts. It emits a per-passage versionable JSON disposition and has adversarial unit tests. The CI workflow runs it after the full source audit and saves `patristic-staging-source-review-classification` artifact.

## Original source defect
The unmatched `passage_5d9683ebc43d601e3e19e68e255ddf4c`, *Hexaemeron* Homily I, source paragraph 005, is NOT silently promoted. A historical parallel exists at https://www.newadvent.org/fathers/32011.htm (Homily 1, section 2), but this does not itself establish byte-for-byte agreement with its indexed Wikisource version. It remains quarantined until source reconstruction and hash update with explicit review.

## Bibliographic metadata
Five edition metadata entries were corrected in the guarded staging database: translators, translation-language metadata and two historical NPNF volume identifiers. 9 editions and 297 passage texts remain intact, with no deletion. Historic public-domain editions must be distinguished from their modern webpage transcriptions. Bibliographic author and dialogue speaker are separate concerns.

## Acceptance boundary for release planning
This completes **inventory, historical edition attribution, text-integrity verification, external textual comparison and a per-record conservative disposition** of the current staging pilot corpus.

This does NOT complete publisher/editorial sign-off of the 73 quarantined passages and does not establish that the 224 full matches can be quoted directly or attributed to the source work's bibliographic author as a speaker. They must be filtered using the review classification before any Chat source card can be described as verified. A generated answer has not been audited. Unreviewed work and staged edition flags must not be lifted by this classification alone.

The subsequent speaker-attribution/author deduplication phase must retain this evidence boundary. Production remains untouched.
