-- Historical bibliographic metadata corrections; protected staging ONLY.
-- Preserves work authenticity, edition import status, every passage and vector.
-- Do not run on main/default Neon branch.
WITH guard AS (
 SELECT 1 WHERE (SELECT count(*) FROM "LibraryStagingGuard"
 WHERE "branchId"='br-spring-frost-assfzje6'
 AND "purpose"='PATRISTIC_LIBRARY_STAGING')=1
), fixes(id, translator, lang, title) AS (VALUES
 ('pilot_edition_john_eph24_20261109','Gross Alexander','English',
  'NPNF First Series, Vol. XIII (1889), Homily 24 on Ephesians'),
 ('pilot_edition_basil_holyspirit_ch10_20261109','Blomfield Jackson','English',
  'NPNF Second Series, Vol. VIII (1895), On the Holy Spirit, Chapter X'),
 ('edition_b0cd850e255cf4bd4310094ce8625dec','Blomfield Jackson','English',NULL),
 ('edition_55ef4de453f96a6f885f78a83e01edc0','George Prevost; revised by M. B. Riddle','English',NULL),
 ('edition_7f982e9d2f0acc26526b91f0042dee75','William Moore','English',NULL)
), updated AS (
 UPDATE "LibraryEdition" e
 SET "translator"=f.translator, "originalLanguage"=f.lang,
     "editionTitle"=COALESCE(f.title,e."editionTitle")
 FROM fixes f WHERE e."id"=f.id AND EXISTS(SELECT 1 FROM guard)
 RETURNING e."id",e."translator",e."originalLanguage",e."editionTitle"
)
SELECT * FROM updated ORDER BY "id";
