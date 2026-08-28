// DUPLICITNÉ ZVEREJNENIA CRZ ZMLÚV — external_id na vylúčenie z agregácií a zoznamov.
//
// PROBLÉM (WATCH #66, 2026-08-28): NFP/dotačné zmluvy sa v Centrálnom registri zmlúv
// zverejňujú OBOMA zmluvnými stranami (poskytovateľ = ministerstvo/agentúra, napr. MIRRI;
// prijímateľ = mesto/mestský podnik), navyše ich Krtko scraper cez noc niekedy re-scrapuje.
// Tá istá JEDNA zmluva tak v DB figuruje pod 2–3 RÔZNYMI CRZ ID a rôznymi "Č. zmluvy".
// Keďže cyklus 2 (T17) zaradil všetky NFP nohy do INCOME_TX_IDS, ten istý príspevok sa v
// hero "Získané dotácie a granty" počítal 2–3×, čo nafúklo príjmy o 18 933 864,08 € (60,6M
// namiesto reálnych ~41,7M).
//
// KĽÚČ = external_id ("crz_<id>"), lebo je STABILNÉ cez re-scrape (na rozdiel od UUID id,
// ktoré Krtko pri opätovnom vložení mení). Presná zhoda — NEZLUČUJE fuzzy podobné zmluvy.
//
// KTORÝ ČLEN SA PONECHÁVA (kanonický): najskôr publikovaný doklad skupiny (min date_published).
// NIŽŠIE UVEDENÉ external_id sú NEKANONICKÉ (mladšie zverejnenia tej istej zmluvy) → vylúčiť.
//
// OVERENIE (2-zdrojovo, každý doklad HTTP 200 na crz.gov.sk/zmluva/<id>/): pre každú skupinu
// potvrdená ZHODA oficiálneho NFP/projektového referenčného čísla + celkovej sumy + oboch IČO
// strán (00316792 Mesto Martin / 36672084 Turč. vodárenská ↔ 50349287 MIRRI). Rôzne "Č. zmluvy"
// a rôzny "Rezort" sú pri duplicite očakávané (každá strana zverejní pod svojím číslom).
// Legitímne opakované zmluvy (napr. ročná reklama 200 €) NIE SÚ v zozname — overené, že majú
// rôzne roky/evidenčné čísla, teda nejde o duplicitu.
//
// Skupiny (kanonický ponechaný → vylúčené): suma € | NFP ref
//  crz_8925478  → crz_9069830, crz_8952736   6 629 481,99 | IROP-Z-302041M829-421-19 (Dodatok č.1)
//  crz_11631193 → crz_11640021               1 993 880,20 | 401202F311
//  crz_8629437  → crz_8676398, crz_8646928     572 413,74 | IROP-Z-302041BDF7-431-65 (Dodatok č.2)
//  crz_10777804 → crz_10782440                 627 404,07 | 401202FKH7
//  crz_9936715  → crz_9940951                  487 225,70 | Z401101FKB8
//  crz_11065056 → crz_11069857                 385 701,83 | 401402B928
//  crz_7674173  → crz_7681397                  355 569,42 | IROP-Z-302021W253-211-34 (Dodatok č.2)
//  crz_11424107 → crz_11437844                 344 819,40 | NFP č. 1374/2025
//  crz_8058128  → crz_8061781                  175 116,00 | IROP-Z-302071CVB9-76-98 (zmluva)
//  crz_9286569  → crz_9289098                  160 356,00 | IROP-Z-302071CVB9-76-98 (Dodatok č.1)
//
// Spolu 10 skupín, 12 vylúčených nôh, dopad na hero income −18 933 864,08 €.
export const DUPLICATE_TX_EXTERNAL_IDS = new Set<string>([
  "crz_9069830",
  "crz_8952736",
  "crz_11640021",
  "crz_8676398",
  "crz_8646928",
  "crz_10782440",
  "crz_9940951",
  "crz_11069857",
  "crz_7681397",
  "crz_11437844",
  "crz_8061781",
  "crz_9289098",
]);

// ── VÝDAVKOVÁ (EXPENSE) strana ──────────────────────────────────────────────
// PROBLÉM (WATCH stráž, 2026-08-28): rovnaká double-publikácia postihuje aj bežné
// (ne-NFP) zmluvy — obojstranné zverejnenie (objednávateľ aj dodávateľ zverejnia
// tú istú zmluvu pod vlastným „Č. zmluvy") + nočný re-scrape Krtka. Tá istá JEDNA
// zmluva tak v DB figuruje 2× a nafukuje výdavky/agregáty dodávateľa.
//
// KĽÚČ = external_id (stabilné cez re-scrape). Kanonický = skôr ZVEREJNENÝ doklad
// (Mesto Martin oba protokoly zverejnilo pred SŠZ), vylúčené = duplicitná noha.
//
// OVERENIE (2-zdrojovo, každý doklad HTTP 200 na crz.gov.sk/zmluva/<id>/): pre každý
// pár potvrdená ZHODA sumy na cent + oboch IČO strán + dátumu UZAVRETIA + predmetu/
// majetku; rôzne „Č. zmluvy" = očakávané pri obojstrannom zverejnení. Ročné opakované
// zmluvy (reklama 200 €, poistenie, audit) sú OVERENÉ ako RÔZNE roky (rôzne Č. zmluvy
// a dátumy uzavretia) → NIE duplicita, NIE sú v zozname (0 falošných pozitív, poistka).
//
// Páry (kanonický ponechaný → vylúčený): suma € | doklad
//  crz_10961126 → crz_11006541  2 128 019,36 | Protokol – Atletický štadión, zázemie s tribúnou (uz. 20.06.2025; MsMartin 1027/2025 vs SŠZ RD20/2025)
//  crz_12189892 → crz_12215067    999 604,69 | Protokol – strecha a bleskozvod Zimný štadión (uz. 26.03.2026; MsMartin 417/2026 vs SŠZ RD09/2026)
//  crz_12291762 → crz_12294611      7 606,83 | Kúpna zmluva Obec Blatnica (Č. E-19/2026; TVS vs Blatnica)
//  crz_8958417  → crz_9000729       3 000,00 | Budúca ZVB DPMM↔ŽSR (uz. 19.02.2024; ŽSR ZOBZ vs DPMM Z 010/2024)
//  crz_8175095  → crz_9881596       1 000,00 | Darovacia – cyklopreteky Okolo Slovenska (Č. 1521/2023, uz. 04.08.2023; MsMartin vs KraussMaffei)
//  crz_9584235  → crz_9611284         704,00 | ZVB č. 836168018-4-2024-ZVB TVS↔ŽSR (TVS O-51/2024 vs ŽSR)
//  crz_10007847 → crz_10033888      21 712,12 | Protokol – Zimný štadión, stav. úpravy hl. vstup/obklady ľadárne/šatňa juniori (uz. 07.11.2024; Mesto Martin 1307/2024 vs SŠZ RD32/2024) — WATCH #75, pod prahom #67 (<100k)
//
// Spolu 7 párov, 7 vylúčených nôh, dopad na výdavky/agregáty −3 161 647,00 €.
export const DUPLICATE_EXPENSE_EXTERNAL_IDS = new Set<string>([
  "crz_11006541",
  "crz_12215067",
  "crz_12294611",
  "crz_9000729",
  "crz_9881596",
  "crz_9611284",
  "crz_10033888",
]);

/** True, ak je transakcia nekanonické (opakované) zverejnenie tej istej CRZ zmluvy (income aj expense). */
export function isDuplicatePublication(externalId: string | null | undefined): boolean {
  return (
    !!externalId &&
    (DUPLICATE_TX_EXTERNAL_IDS.has(externalId) ||
      DUPLICATE_EXPENSE_EXTERNAL_IDS.has(externalId))
  );
}
