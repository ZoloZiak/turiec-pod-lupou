// KOREKCIA CHYBNÝCH IČO ENTÍT — durabilná oprava na úrovni čítania (read-time).
//
// PROBLÉM (WATCH #59 → #63 → #68, opakovaná REGRESIA): niektoré CRZ doklady majú v
// samotnom zdroji preklep v IČO dodávateľa/objednávateľa. Krtko scraper ich verne
// skopíruje a cez noc znova založí ORPHAN entitu s CHYBNÝM IČO — aj po tom, čo ju
// predchádzajúci WATCH tik zlúčil a zmazal (recidíva: orphan 00216822 vznikol 46 s PO
// commite fixu #63). Pri DB merge-delete ide o „whack-a-mole": zmazaná entita sa vráti
// pri najbližšom re-scrape. Bez tejto korekcie by na transparentnom webe vznikol profil
// /dodavatel/<chybné_IČO> s odkazmi ORSR/RPVS/FinStat na NEEXISTUJÚCI (alebo cudzí)
// subjekt pod menom reálnej entity = zámena subjektu.
//
// KĽÚČ = presná zhoda chybného 8-miestneho IČO (stringu). Mapujeme na RPO ŠÚ SR overené
// správne IČO. Aplikuje sa pri čítaní (buyer.ico / supplier.ico) v /api/data a /api/supplier,
// takže web VŽDY ukáže správne IČO nezávisle od toho, či Krtko orphan práve znova založil.
// DB samotnú nemení (nedeštruktívne, idempotentné). Presná zhoda → žiadny fuzzy dopad na
// iné entity.
//
// OVERENIE (2-zdrojovo): pre každý pár chybné→správne IČO potvrdené, že (a) chybné IČO v RPO
// ŠÚ SR NEEXISTUJE (0 exact výsledkov na identifier) a (b) správne IČO je v RPO priradené
// presne tej entite (názov sedí), plus CRZ detail zmluvy potvrdzuje reálny subjekt.
//
// Poistka menovaných osôb SA NEUPLATŇUJE (obec/firma = verejná inštitúcia, nie fyzická osoba;
// ide iba o opravu nesprávneho párovania na reálne IČO, žiadne nové obvinenie).
//
// Páry (chybné IČO → správne IČO | subjekt | zdroj preklepu):
//   00216822 → 00316822 | Obec Nolčovo (okres Martin) | CRZ 12502992 má typo 2↔3 v IČO
//     dodávateľa; RPO: 00216822 = 0 exact výsledkov (neexistuje), 00316822 = „Obec Nolčovo",
//     orgán verejnej moci od 1973-07-01 (RPO + RÚZ #13203 + nolcovo.sk z WATCH #59).
//
// WATCH #89 (2026-08-29): Krtko cez noc založil 15 entít s POŠKODENÝM IČO (vnútorné/koncové
// medzery, 6-miestne IČO obcí bez vedúcich núl, 9-miestne, MULTI-string). Guard isValidIco()
// im síce zablokoval register-odkazy (žiadny zlý link na webe), no dodávatelia tým prišli
// o funkčné ORSR/RPVS/FinStat prepojenie a niektorí majú rozštiepený profil (orphan + kanon).
// Každý pár (poškodené IČO → reálne IČO) je overený 2-zdrojovo: (a) CRZ detail zmluvy
// (source_url) uvádza reálne IČO dodávateľa, (b) RPO ŠÚ SR na tom IČO vracia presne ten subjekt.
// POZOR: pri 3 pároch (BTI, eSYST, Generali) samotné odstránenie medzier vedie na CUDZÍ subjekt
//   (napr. "52  222 438" → 52222438 = „OZ Za zdravší život", pričom CRZ 8332592 uvádza BTI = 47619503),
//   preto sa musí použiť reálne IČO z CRZ, nie naivný strip.
// WATCH #93 (2026-08-30): EUROPOWER dodatočne VYRIEŠENÝ. CRZ 12252173 síce IČO dodávateľa
//   neuvádza, no RPO ŠÚ SR fulltext (fullName=EUROPOWER) vracia „EUROPOWER, s. r. o.“ IČO
//   45541329 so sídlom vo Vrútkach (okres Martin) — presná zhoda mena aj regiónu (zmluva o
//   vecnom bremene pre IBV Vrútky s Turčianskou vodárenskou). 2-zdrojovo potvrdené aj RÚZ
//   (id 1018345 = EUROPOWER, s. r. o., Vrútky, Francúzskych partizánov 3498/70, okres SK0316).
//   POZOR: naivný strip „50 513 923 “ → 50513923 = „NEUROPOWER s. r. o.“ Bratislava = CUDZÍ
//   subjekt (rovnaká pasca ako BTI/Generali), preto sa mapuje na reálne 45541329, nie na strip.
//   Neopraviteľné ostávajú: RRA a.s. (CRZ 9000484 neuvádza IČO, RPO fullName=RRA nedáva exact
//   „RRA, a.s.“ — len RRA Horný Spiš Kežmarok = iný subjekt) a MULTI-string SLOVES (5 IČO v
//   jednom poli) — ponechané na guard + ľudské oko (findings.md).
// Poistka menovaných osôb SA NEUPLATŇUJE (firmy/obce = verejné inštitúcie, nie fyzické osoby;
// ide iba o opravu párovania na reálne IČO, žiadne nové obvinenie).
const ICO_CORRECTIONS: Record<string, string> = {
  '00216822': '00316822', // Obec Nolčovo — typo v CRZ 12502992 (WATCH #59/#63/#68)
  // WATCH #89 — CRZ+RPO overené páry (kľúč = presný DB string vrátane medzier)
  '52  222 438': '47619503', // BTI s.r.o. — CRZ 8332592 (strip 52222438 = cudzí subjekt!)
  '31 580 726': '31580726',  // VS Guard, s.r.o. — CRZ 10055405
  '361062145': '50139088',   // eSYST s.r.o. — CRZ 11796782 (9-miestne, reálne z CRZ)
  '55 049 249': '55049249',  // DFM Slovakia s.r.o. — CRZ 10787956
  '35 770 732': '35770732',  // MAJES výťahy a eskalátory, a.s. — CRZ 9625539
  '44552483 ': '44552483',   // KV - mont Martin, s.r.o. — CRZ 8185355
  '316873': '00316873',      // Obec Rudno — CRZ 12716123 (short6 zero-pad)
  '36 751 804 ': '36751804', // SIRS - Development, a.s. — CRZ 9292456
  '36368792 ': '36368792',   // Stavchem s.r.o. — CRZ 11677616
  '54 228 573': '35709332',  // Generali Poisťovňa, a.s. — CRZ 6092295 (strip 54228573 = pobočka!)
  '316580': '00316580',      // Obec Brieštie — CRZ 12533558 (short6 zero-pad)
  '316679': '00316679',      // Obec Turčianske Jaseno — CRZ 12501273 (short6 zero-pad)
  // WATCH #93 — RPO fullName + RÚZ overený (strip 50513923 = NEUROPOWER Bratislava = cudzí!)
  '50 513 923 ': '45541329', // EUROPOWER, s. r. o. — Vrútky, RPO+RÚZ (CRZ 12252173 bez IČO dodáv.)
};

/** Vráti opravené IČO, ak je vstupné IČO známy preklep; inak vráti pôvodné IČO nezmenené. */
export function correctIco(ico: string | null | undefined): string | null | undefined {
  if (!ico) return ico;
  return ICO_CORRECTIONS[ico] ?? ico;
}

/** True, ak je dané IČO známy preklep so známou správnou náhradou. */
export function isKnownWrongIco(ico: string | null | undefined): boolean {
  return !!ico && ico in ICO_CORRECTIONS;
}

/**
 * True IBA ak je IČO syntakticky platné slovenské IČO = presne 8 číslic.
 *
 * WATCH #78 (2026-08-28): Krtko scraper cez noc zakladá entity s POŠKODENÝM IČO —
 * vnútorné/koncové medzery ("52  222 438", "44552483 "), 6-miestne IČO obcí bez
 * vedúcich núl ("316580", "316873"), 9-miestne hodnoty, ba aj viac IČO zlúčených do
 * jedného poľa ("00316792, 36132543, ..."). Doterajší gate `!ico.startsWith('NO_ICO_')`
 * ich prepustil, takže UI generovalo NEFUNKČNÉ odkazy na registre (orsr.sk?ICO=52  222 438,
 * finstat.sk/316580) a — po naivnom odstránení medzier — dokonca odkazy na CUDZÍ subjekt
 * (napr. "52  222 438" → 52222438 = „OZ Za zdravší život", pričom reálne BTI s.r.o. má
 * podľa CRZ detailu IČO 47619503). Preto register-odkazy a RPVS badge vykresľujeme len pre
 * IČO, ktoré prejdú touto validáciou; poškodené IČO sa zobrazí ako text (čestne), no bez
 * odkazu vedúceho na nesprávny/neexistujúci subjekt. Nedeštruktívne, žiadny nový claim.
 */
export function isValidIco(ico: string | null | undefined): boolean {
  return !!ico && /^\d{8}$/.test(ico);
}

/**
 * Vráti VŠETKY známe chybné IČO, ktoré sa mapujú na dané správne IČO.
 * Použité v /api/supplier: profil dodávateľa musí zozbierať transakcie aj z orphan
 * entít (chybné IČO), ktoré Krtko cez noc znova zakladá — inak by zmluvy priviazané
 * na orphan (napr. Nolčovo crz_12502992 pod 00216822) na profile /dodavatel/00316822
 * chýbali, kým DB merge whack-a-mole nedobehne. Tým je profil úplný nezávisle od DB.
 */
export function wrongIcosFor(correctedIco: string | null | undefined): string[] {
  if (!correctedIco) return [];
  return Object.entries(ICO_CORRECTIONS)
    .filter(([, correct]) => correct === correctedIco)
    .map(([wrong]) => wrong);
}
