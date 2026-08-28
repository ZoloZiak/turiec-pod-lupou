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
const ICO_CORRECTIONS: Record<string, string> = {
  '00216822': '00316822', // Obec Nolčovo — typo v CRZ 12502992 (WATCH #59/#63/#68)
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
