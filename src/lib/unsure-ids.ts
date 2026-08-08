// AUTO-GENEROVANE (scripts/_gen_unsure_ids.js) z .audit/income_verdicts.json.
// Zmluvy, kde klasifikacia smeru (prijem vs vydavok) bola SPORNA (verdict UNSURE)
// a vyzaduju rucne rozhodnutie administratora v admin paneli (tab "Smer transakcii").
export interface UnsureReviewItem {
  id: string;
  reason: string;
  amount_eur: number;
  subject: string;
  buyer: string;
  supplier: string;
  url: string;
}

export const UNSURE_REVIEW: UnsureReviewItem[] = [
  {
    id: "cfa74337-e12d-4c79-9a3b-dbafff900eca",
    reason: "Prijimatelom je fyzicka osoba (Rapavy Peter), nie mesto ani jeho organizacia - smer voci mestu nejasny.",
    amount_eur: 6629481.99,
    subject: "Dodatok č.1 k Zmluve o poskytnutí nenávratného finančného príspevku č. IROP-Z-302041M829-421-19 zo dňa 14.04.2020",
    buyer: "Rapavý Peter",
    supplier: "Ministerstvo investícií, regionálneho rozvoja a informatizácie Slovenskej   republiky",
    url: "https://crz.gov.sk/zmluva/8925478/",
  },
  {
    id: "0d0588c4-9258-45d5-81d9-b1ac31a1d146",
    reason: "Prijimatelom je fyzicka osoba (Rapavy Peter), nie mesto ani jeho organizacia - smer voci mestu nejasny.",
    amount_eur: 6629481.99,
    subject: "Dodatok č.1 k Zmluve o poskytnutí nenávratného finančného príspevku č. IROP-Z-302041M829-421-19",
    buyer: "Rapavý Peter",
    supplier: "Ministerstvo investícií, regionálneho rozvoja a informatizácie Slovenskej   republiky",
    url: "https://crz.gov.sk/zmluva/9069830/",
  },
  {
    id: "4b3aa766-b833-4da9-9d97-47ffef6b2a0e",
    reason: "Zmluva o zriadeni bezneho uctu pre dotacie, nulova suma, smer penazi sa neda urcit.",
    amount_eur: 0,
    subject: "Zmluva o bežnom účte - SPORObusiness dotácie - číslo účtu SK9209000000005239052446",
    buyer: "Mesto Martin",
    supplier: "Slovenská sporiteľňa, a.s",
    url: "https://crz.gov.sk/zmluva/11409653/",
  },
  {
    id: "882df7d9-e57c-4df7-ad0e-05620de5bf45",
    reason: "Zmluva o spolupraci pri sprave stavby, z predmetu sa neda urcit smer penazi.",
    amount_eur: 1520,
    subject: "Dodatok č. 1 k zmluve o spolupráci pri zabezpečovaní správy, údržby a využitia stavby ,,Envirocentrum, areál SIM - Priekopa\"",
    buyer: "Mesto Martin",
    supplier: "Sociálny podnik mesta Martin, s. r. o.",
    url: "https://crz.gov.sk/zmluva/12399572/",
  },
  {
    id: "5ec59e5d-c2c7-4205-9f93-8b2ee87cd442",
    reason: "Zmluva o zabezpeceni vyuzitia komunikacie, z predmetu sa smer penazi nedaji jednoznacne urcit.",
    amount_eur: 3240,
    subject: "Zmluva o zabezpečení využitia komunikácie",
    buyer: "Martinská parkovacia spoločnosť, a.s.",
    supplier: "Martimex - holding, akciová spoločnosť",
    url: "https://crz.gov.sk/zmluva/10163250/",
  },
  {
    id: "92ed6c21-3024-4fb0-a8df-8b2b64376901",
    reason: "Zmluva o spolupraci pri sprave stavby, z predmetu sa smer penazi neda jednoznacne urcit.",
    amount_eur: 1600,
    subject: "Zmluva o spolupráci pri zabezpečovaní správy, údržby a využitia stavby ,,Envirocentrum, areál SIM - Priekopa\"",
    buyer: "Mesto Martin",
    supplier: "Sociálny podnik mesta Martin, s. r. o.",
    url: "https://crz.gov.sk/zmluva/9453652/",
  },
  {
    id: "4d58633c-b76c-41fc-aa15-0b57455e1fef",
    reason: "Zmluva o beznom ucte, nula EUR, nejde o tok penazi medzi stranami.",
    amount_eur: 0,
    subject: "Zmluva o bežnom účte - zriadenie Účtu SPORObusiness dotácie",
    buyer: "Mesto Martin",
    supplier: "Slovenská sporiteľňa, a.s",
    url: "https://crz.gov.sk/zmluva/8943569/",
  },
  {
    id: "6d5225a4-8bcc-4340-854d-2cd533bea0d5",
    reason: "Zmluva o beznom ucte, nula EUR, nejde o tok penazi medzi stranami.",
    amount_eur: 0,
    subject: "Zmluva o bežnom účte - SPORObusiness dotácie - číslo účtu SK07 0900 0000 0052 3703 5212",
    buyer: "Mesto Martin",
    supplier: "Slovenská sporiteľňa, a.s",
    url: "https://crz.gov.sk/zmluva/11197846/",
  },
  {
    id: "37f31764-9954-4871-baec-fab34e927009",
    reason: "Dodatok k zmluve o beznom ucte, nula EUR, nejde o tok penazi.",
    amount_eur: 0,
    subject: "Dodatok  č. 1 k Zmluve o bežnom účte - zriadenie účtu SPORObusiness dotácie",
    buyer: "Mesto Martin",
    supplier: "Slovenská sporiteľňa, a.s",
    url: "https://crz.gov.sk/zmluva/7654949/",
  },
  {
    id: "7d7141a7-12c2-430e-b2de-2b09fc8fadad",
    reason: "Zmluva o zbere textilii bez sumy, smer penazi z predmetu nejasny.",
    amount_eur: 0,
    subject: "Zmluva o zbere použitých textílií a šatstva na vykonávanie prípravy na opätovné použitie",
    buyer: "Mesto Martin",
    supplier: "HUMANA PEOPLE TO PEOPLE SLOVAKIA",
    url: "https://crz.gov.sk/zmluva/10494967/",
  },
  {
    id: "13f76c6b-7386-4512-856d-89257cee3b25",
    reason: "Zmluva o bezne ucte, nejde o tok dotacie ako takej; smer neurcitelny.",
    amount_eur: 0,
    subject: "Zmluva o bežnom účte - SPORObusiness dotácie",
    buyer: "Mesto Martin",
    supplier: "Slovenská sporiteľňa, a.s",
    url: "https://crz.gov.sk/zmluva/10241951/",
  },
  {
    id: "53a1b503-8f63-4222-b829-33c3514e7c9f",
    reason: "Zmluva o bezne ucte, nejde o tok dotacie ako takej; smer neurcitelny.",
    amount_eur: 0,
    subject: "Zmluva o bežnom účte - SPORObusiness dotácie",
    buyer: "Mesto Martin",
    supplier: "Slovenská sporiteľňa, a.s",
    url: "https://crz.gov.sk/zmluva/10241949/",
  },
];

export const UNSURE_TX_IDS = new Set<string>(UNSURE_REVIEW.map((r) => r.id));

export const UNSURE_TX_COUNT = 12;
