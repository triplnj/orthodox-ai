# Step 3/6 — attribution and contributor audit (2026-11-11)

**Implementation status:** independent catalog contributor audit; no Chat integration, migrations or production mutations. This branch includes Step 2/6 source model.

## Cross-checked editorial relationships

| Work | Relation | Supporting document | Treatment |
| --- | --- | --- | --- |
| Philokalia | Nicodemus: editor; Macarius of Corinth: compiler | [Antiochian Patriarchate](https://antiochpatriarchate.org/en/page/saint-nicodemus-the-righteous-of-mount-athos/650/); [Azbyka English edition metadata](https://azbyka.org/otechnik/Nikodim_Svjatogorets/the-philokalia/) | Anthology, not original single-author treatise |
| Unseen Warfare | Nicodemus: adaptor; Lorenzo Scupoli: underlying source author | [Antiochian Patriarchate](https://antiochpatriarchate.org/en/page/saint-nicodemus-the-righteous-of-mount-athos/650/); [St Vladimir's Seminary Press book metadata](https://books.google.com/books/about/Unseen_Warfare.html?id=7ed4DF8tmS8C) | `SOURCE_AUTHOR` never means author of Nicodemus's adapted recension; separate edition history includes Theophan's later revision, not yet a separate contribution row |
| Pedalion | Nicodemus: editor; Agapios Leonardos: co-author of compiled volume | [Moscow Theological Academy](https://publishing.mpda.ru/index.php/theological-herald/article/view/902); [Lund doctoral thesis](https://www.lunduniversity.lu.se/publication/c82583a6-94af-4670-87d9-a4f1fc2da81d) | Canonical compilation; individual canons **not** authored by either editor. Nicodemus's interpretive apparatus is distinct from canonical texts |
| Exomologetarion | Nicodemus: **role review required** | [Antiochian Patriarchate](https://antiochpatriarchate.org/en/page/saint-nicodemus-the-righteous-of-mount-athos/650/); [G. Metallinos](https://orthodoxinfo.com/praxis/manualofconfession) | Attested book title; source-history/extent of composition cannot be collapsed to an unqualified single-author claim |
| New Synaxarion | Nicodemus: **role review required** | [Antiochian Patriarchate](https://antiochpatriarchate.org/en/page/saint-nicodemus-the-righteous-of-mount-athos/650/) | Published posthumously in three volumes; do not imply every life was an original composition by Nicodemus |
| New Eklogion | Nicodemus: compiler | [Antiochian Patriarchate](https://antiochpatriarchate.org/en/page/saint-nicodemus-the-righteous-of-mount-athos/650/) | Newly indexed, attested hagiographic collection |
| Paul's Fourteen Epistles (work by Theophylact) | Nicodemus: translator into Modern Greek | [Antiochian Patriarchate](https://antiochpatriarchate.org/en/page/saint-nicodemus-the-righteous-of-mount-athos/650/) | Newly indexed; Nicodemus must **not** be credited as author of Theophylact's underlying commentary |

## Evidence and limitations
Every contribution carries its **own** evidence record and validated work/author/role relation. Source reviewer strings indicate research-source cross-checking for this catalog, not independent ecclesiastical certification of every text or theological statement. No claims of complete bibliography.

The research seed includes four persons, 12 distinct works and 15 person-to-work contributions. Deliberately marked REVIEW_REQUIRED: the precise compilation/original-composition roles of Exomologetarion and New Synaxarion. SOURCE_ATTESTED means the role stated in the record is supported by at least one specifically inspected non-community bibliographic source; it **does not** validate a source's entire content, original-language reading, or every subchapter.

## Specific negative guarantees tested
- No source's evidence ID can be borrowed to justify another contributor or book.
- Scupoli's source text authorship does not become direct authorship of Nicodemus's edition.
- An unresolved attribution remains review-required and cannot be silently promoted to a reviewed assertion.
- Conflicting records can remain DISPUTED; the review matrix exposes them.
- A longer exact name match supersedes a shorter overlapping epithet, without masking true ambiguity.

## Next steps
Step 4 adds intent-based bibliography answering from this catalog, allowing verified entries to be supplied to Chat with one bibliographic citation per work and clear role wording. Keep incomplete/pending entries separate. Expand source-by-source and additional authors independently rather than hardcode a finite whitelist.
