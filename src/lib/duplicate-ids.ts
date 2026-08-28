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

/** True, ak je transakcia nekanonické (opakované) zverejnenie tej istej CRZ zmluvy. */
export function isDuplicatePublication(externalId: string | null | undefined): boolean {
  return !!externalId && DUPLICATE_TX_EXTERNAL_IDS.has(externalId);
}
