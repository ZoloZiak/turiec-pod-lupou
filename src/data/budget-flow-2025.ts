// Tok peňazí mesta Martin za rok 2025 — ZDROJ: Záverečný účet mesta Martin za rok 2025,
// "Správa o finančnom plnení rozpočtu k 31.12.2025" (plnenie), martin.sk.
// Dokument: https://www.martin.sk/zaverecny-ucet-mesta-martin-za-rok-2025/d-108583
// PDF: https://www.martin.sk/assets/File.ashx?id_org=700031&id_dokumenty=108596
//
// Čísla sú PLNENIE k 31.12.2025 (skutočnosť), nie schválený/upravený rozpočet.
// Príjmy spolu 76.115.523 € · výdavky spolu 69.338.395 € · prebytok 6.777.128 €.
// Overené na cent proti súhrnu v PDF (bežné 64.150.865 + kapitálové 2.030.278 + fin.operácie 9.934.380).
//
// DÔLEŽITÉ: tieto čísla sú ROZPOČTOVÝ tok jedného roka (2025). NIE sú totožné
// s registrami zmlúv/faktúr/objednávok (tie sú viacročné archívy od 2011 a navzájom
// sa prekrývajú — objednávka→zmluva→faktúra je často tá istá platba). Preto sa lievik
// a registre NESČÍTAVAJÚ a zobrazujú sa oddelene.

export const BUDGET_YEAR = 2025;

export const SOURCE = {
  label: "Záverečný účet mesta Martin za rok 2025 — plnenie k 31.12.2025",
  page: "https://www.martin.sk/zaverecny-ucet-mesta-martin-za-rok-2025/d-108583",
  pdf: "https://www.martin.sk/assets/File.ashx?id_org=700031&id_dokumenty=108596",
};

export type FlowNode = {
  id: string;
  label: string;
  /** krátke ELI5 vysvetlenie "čo to je" */
  hint: string;
  color: string;
  /** odkaz na detail (kam rozkliknúť) — len pri výdavkových uzloch */
  href?: string;
  side: "in" | "hub" | "out";
};

export type FlowLink = {
  source: string;
  target: string;
  value: number; // €
};

// ── ĽAVÁ STRANA: odkiaľ peniaze prídu (príjmy 76.115.523 €) ─────────────────
export const INCOME: FlowNode[] = [
  { id: "podielove", label: "Podielové dane", hint: "Časť štátnej dane z príjmov, ktorú štát prerozdelí mestu podľa počtu obyvateľov, detí a seniorov.", color: "#34d399", side: "in" },
  { id: "transfery", label: "Dotácie a transfery", hint: "Účelové peniaze zo štátu a EÚ — najmä na prenesené kompetencie v školstve, sociálne služby a projekty.", color: "#60a5fa", side: "in" },
  { id: "miestne", label: "Miestne dane", hint: "Daň z nehnuteľností, poplatok za odpad, za psa, za ubytovanie a pod. — vyberá ich priamo mesto.", color: "#fbbf24", side: "in" },
  { id: "vlastne", label: "Vlastné príjmy", hint: "Nájmy mestského majetku, správne poplatky, pokuty a príjmy z vlastnej činnosti.", color: "#fb7185", side: "in" },
  { id: "uvery", label: "Úvery a fondy", hint: "Čerpané úvery, prevody z rezervného fondu a zostatky z minulých rokov — nie sú to „zarobené“ peniaze.", color: "#a78bfa", side: "in" },
];

// ── STRED: mesto ────────────────────────────────────────────────────────────
export const HUB: FlowNode = {
  id: "mesto", label: "Mesto Martin", hint: "Primátor a mestský úrad — rozpočet schvaľuje mestské zastupiteľstvo.", color: "#e7ecf5", side: "hub",
};

// ── PRAVÁ STRANA: kam idú (výdavky 69.338.395 € + prebytok do rezervy) ───────
export const OUTFLOW: FlowNode[] = [
  { id: "chod", label: "Chod mesta", hint: "Bežné výdavky: platy, školy a škôlky, údržba, verejné osvetlenie, zeleň, doprava, sociálne služby.", color: "#34d399", side: "out", href: "/zmluvy" },
  { id: "investicie", label: "Investície", hint: "Kapitálové výdavky: stavby, rekonštrukcie, nový majetok (napr. úpravy ulíc, budovy, parky).", color: "#60a5fa", side: "out", href: "/kontrola" },
  { id: "rezerva", label: "Do rezervy", hint: "Prebytok hospodárenia — peniaze, ktoré sa v roku 2025 neminuli a odkladajú sa do rezervného fondu.", color: "#94a3b8", side: "out" },
  { id: "dlh", label: "Splátky úverov", hint: "Splátky istiny skôr prijatých úverov (dlhová služba mesta).", color: "#fb7185", side: "out", href: "/podniky" },
];

// Hodnoty (€) — PLNENIE 2025, overené proti PDF
export const LINKS: FlowLink[] = [
  // príjmy -> mesto
  { source: "transfery", target: "mesto", value: 25_199_539 }, // bežné granty+transfery 23.296.820 + kapitálové 1.902.719
  { source: "podielove", target: "mesto", value: 23_399_377 },
  { source: "miestne", target: "mesto", value: 12_194_404 }, // daň z nehn. 9.076.800 + dane za služby 3.090.093 + používanie 531 + sankcie 26.980
  { source: "uvery", target: "mesto", value: 10_061_939 }, // fin. operácie príjmové 9.934.380 + kap. predaj majetku 127.559
  { source: "vlastne", target: "mesto", value: 5_260_264 },
  // mesto -> výdavky
  { source: "mesto", target: "chod", value: 59_149_217 },
  { source: "mesto", target: "investicie", value: 8_517_787 },
  { source: "mesto", target: "rezerva", value: 6_777_129 }, // príjmy 76.115.523 − výdavky 69.338.395 (zaokr. na €)
  { source: "mesto", target: "dlh", value: 1_671_391 },
];

export const TOTAL_IN = 76_115_523;
export const TOTAL_OUT = 69_338_395;

// Viacročné registre (NEspočítavať s rozpočtom vyššie) — pre rozklikový kontext
export const REGISTERS = {
  contracts: { label: "Zmluvy mesta", note: "od 2011", href: "/zmluvy" },
  invoices: { label: "Faktúry", note: "od 2009", href: "/kontrola?tab=faktury" },
  orders: { label: "Objednávky", note: "od 2010", href: "/objednavky" },
};
