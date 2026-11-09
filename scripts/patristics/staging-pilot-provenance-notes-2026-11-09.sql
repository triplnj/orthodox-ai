-- Source-provenance notes for two staging pilots only; no status promotion.
WITH guard AS (SELECT 1 WHERE (SELECT count(*) FROM "LibraryStagingGuard" WHERE "branchId"='br-spring-frost-assfzje6' AND "purpose"='PATRISTIC_LIBRARY_STAGING')=1),
notes(id,note) AS (VALUES
('pilot_edition_john_eph24_20261109','Historical NPNF First Series Vol. XIII (1889), English translation by Gross Alexander; public-domain historical edition. New Advent electronic transcription is revised/edited; verify its deviations and separate biblical quotations (Eph 6:18; 1 Thess 5:17) from Chrysostom commentary. Source text/locator witnessed on New Advent. STAGING ONLY; editorial and quotation approval still pending.'),
('pilot_edition_basil_holyspirit_ch10_20261109','Historical NPNF Second Series Vol. VIII (1895), English translation by Blomfield Jackson; CCEL identifies historical edition as Public Domain. New Advent electronic text is revised/edited; verify deviations and distinguish Matt 28:19 quotation from Basil polemical argument about Spirit. Text/locator witnessed in chapter X section 24. STAGING ONLY; editorial and quotation approval still pending.')
), updated AS (
 UPDATE "LibraryEdition" e SET "licenseNote"=notes.note FROM notes
 WHERE e."id"=notes.id AND EXISTS(SELECT 1 FROM guard)
 RETURNING e."id",e."licenseNote"
)
SELECT "id" FROM updated ORDER BY "id";
