# OrthodoxAI — bibliography and transcription editorial audit
Date: 2026-11-09
Scope: protected Neon branch `br-spring-frost-assfzje6`, no production changes.

## Inventory and evidence grading

SQL enumeration confirmed **9 edition records, 6 distinct canonical authors, 297 stored passage rows**. All editions remain `STAGED`. The editions below have independently identifiable historical bibliographic witnesses, but **bibliographic identification is not proof that every passage is a faithful transcription or that every speaker/claim is correctly attributed**.

| Edition ID (short) | Author and source | Historical witness | Evidence grade |
|---|---|---|---|
| `pilot_pl32_confessiones` | Augustine, *Confessiones*, 4 Latin snippets | PL 32 (1845), https://patrologia-lib.ru/patrolog/augustin/confess.htm | Primary Latin bibliographic identification corroborated; four text snippets awaiting complete correspondence verification |
| `edition_ca6fd5...` | Athanasius, *On the Incarnation*, chapter I, 4 excerpts | NPNF2 IV, Robertson; CPG 2091, https://www.fourthcentury.com/on-the-incarnation/ and https://www.newadvent.org/fathers/2802.htm | Work/translator independently verified; passage transcription awaits complete check |
| `edition_b0cd850...` | Basil, *Hexaemeron*, homily I, 29 excerpts | NPNF2 VIII (1895), Blomfield Jackson, https://www.newadvent.org/fathers/32011.htm | Work/translator verified; full segmentation awaiting audit |
| `pilot_edition_basil_holyspirit_ch10_20261109` | Basil, *On the Holy Spirit*, chapter X §24, 1 excerpt | NPNF2 VIII (1895), Blomfield Jackson, https://www.newadvent.org/fathers/3203.htm and https://ccel.org/s/schaff/npnf208/cache/npnf208.html3 | Pilot quote matched published paragraph; speaker/argument and edited transcription still require review |
| `edition_088573...` | Cyril of Jerusalem, *Catechetical Lecture I*, 6 excerpts | NPNF2 VII (1894), Edwin Hamilton Gifford, https://www.newadvent.org/fathers/310101.htm | Work/translator and numbered sections verified; full-passage correspondence awaiting audit |
| `edition_7f982e...` | Gregory of Nyssa, *On the Soul and the Resurrection*, 175 excerpts | NPNF2 V (1893), William Moore, https://www.newadvent.org/fathers/2915.htm | Work identified; passage segmentation and dialogue speaker attribution unreviewed |
| `edition_a5ab166...` | Gregory of Nyssa, same work, 5 pilot excerpts | NPNF2 V (1893), William Moore, https://www.stninaorlando.org/holy-fathers/gregory-of-nyssa/on-the-soul-and-the-resurrection/ | Same work, different text source and segmentation; no destructive merge |
| `edition_55ef4de...` | John Chrysostom, *Homilies on Matthew*, homily I, 72 excerpts | NPNF1 X (1888), Sir George Prevost, revised M. B. Riddle, https://en.wikisource.org/wiki/Nicene_and_Post-Nicene_Fathers:_Series_I/Volume_X/The_Homilies_of_St._John_Chrysostom/Title_Page | Title and translators verified; segmentation/short fragments awaiting audit |
| `pilot_edition_john_eph24_20261109` | John Chrysostom, *Homily 24 on Ephesians*, 1 excerpt | NPNF1 XIII (1889), Gross Alexander, https://www.newadvent.org/fathers/230124.htm and https://www.newadvent.org/fathers/2301.htm | Pilot paragraph confirmed on source page; mixed biblical quotation and author's commentary must be distinguished |

## Completed checks
1. All 297 stored passage SHA-256 values were recomputed in SQL and compared with `contentSha256`: **0 mismatches**. All locators nonempty; 297 distinct hashes within the inspected editions (each edition has no duplicate passage hash).
2. **Nine fragments shorter than 30 characters** were detected: Basil Hexaemeron 1, Gregory 175-chunk edition 4, Chrysostom Matthew 4. Such fragments are not acceptable as independent source evidence.
3. Staging only: fixed five bibliographic metadata records (the two pilot English translation-language fields and edition/translator names; missing translators for Basil's *Hexaemeron*, Gregory's 175-passage edition and Chrysostom's Matthew homily).
4. The two new pilot excerpts and their locators were manually checked against the live cited source pages, and independently stored/source SHA-256 matched. These are still held as `UNREVIEWED`, `STAGED`, with no embeddings.
5. The staging-only `audit-staging-transcriptions.mjs` tool now supports **all passage rows**, downloading each allowlisted cited source page only once, verifying normalized full text or three aligned text anchors, recording source failures, SHA mismatches, partial matches, missing matches and short fragments. Only read-only SQL is used. The protected GitHub Actions workflow includes an audit and rejects release when pending unverified text remains.

## Limitations and editorial red lines
- Public-domain nineteenth-century NPNF text is historically identifiable; **modern online transcription/editorial changes must not be assumed automatically public-domain or identical to the printed volume**. CCEL labels NPNF2 VIII public-domain: https://ccel.org/s/schaff/npnf208/cache/npnf208.html3.
- Exact source-text verification of the other 295 rows has **not yet been confirmed via a completed GitHub Actions job log**. Hash integrity does not prove a faithful transcription. A running CI workflow cannot be inferred from committed files alone.
- Work authenticity is not the same as textual authenticity, historical authorship of every passage, literal quote permission, voice assignment in a dialogue or factual adequacy of an answer.
- The Augustine staging pilot has no vectors and therefore cannot serve as verified retrieval evidence by the current catalog resolver.
- `On the Soul and the Resurrection` has two catalog author IDs for one historical author and work; the 5-versus-175-passages difference is a separate normalization problem.
- Scripture cited inside Chrysostom's homily remains Scripture cited by Chrysostom. It must not be presented as original words coined by Chrysostom.
- All nine editions remain STAGED, and no blanket work-level `UNREVIEWED` to `AUTHENTIC` promotion was made. Promotion should require confirmed matching report, edition boundary resolution and verified source reviewer record.

## Outcome
**Historical bibliographic audit and staging metadata corrections completed.**
**Full per-passage textual review and editorial signoff not yet complete**, pending successful external-source audit execution and resolution of mismatches. Therefore the first release gate remains **NOT APPROVED**. No user credential or action is needed for the corrections made here; subsequent production approval is not requested.
