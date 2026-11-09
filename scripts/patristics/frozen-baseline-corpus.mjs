/**
 * Freeze the 2026-11-09 baseline retrieval universe before adding new works.
 * Four indexed editions = 281 passage embeddings. One unindexed Augustine
 * pilot edition contributes 4 to the original total of 285.
 *
 * Never change these IDs or historical benchmark metrics when staging expands.
 */
export const FROZEN_INDEXED_EDITIONS=Object.freeze([
 "edition_b0cd850e255cf4bd4310094ce8625dec",
 "edition_55ef4de453f96a6f885f78a83e01edc0",
 "edition_7f982e9d2f0acc26526b91f0042dee75",
 "edition_a5ab16669e87b05abd9219553343d318"
]);
export const FROZEN_PILOT_EDITION="pilot_pl32_confessiones";
const quote=id=>"'"+id+"'";
export const FROZEN_INDEXED_SQL=FROZEN_INDEXED_EDITIONS.map(quote).join(",");
export const FROZEN_TOTAL_SQL=[...FROZEN_INDEXED_EDITIONS,FROZEN_PILOT_EDITION].map(quote).join(",");
export const FROZEN_INDEXED_COUNT=281;
export const FROZEN_TOTAL_COUNT=285;
