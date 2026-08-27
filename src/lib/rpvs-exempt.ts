/**
 * Čistá, závislosťami-nezaťažená logika RPVS výnimiek.
 *
 * PREČO samostatný súbor: pôvodne žila v `telegram.ts`, ktorý hore importuje
 * `node-fetch` (Node-only) a Telegram/RPVS sieťové funkcie. Klientske komponenty
 * (page.tsx, dodavatel/[ico]) však potrebujú LEN túto čistú funkciu — a tým si
 * cez `telegram.ts` ťahali do prehliadačového bundle `node-fetch` → `fetch-blob`,
 * čo Turbopack nevie zabaliť pre klienta (chunk generation error, biela stránka).
 * Tento modul nemá žiadne runtime závislosti, takže je bezpečný na oboch stranách.
 */

export function isRpvsExempt(ico?: string | null, supplierName?: string | null): boolean {
  const cleanIco = ico && !ico.startsWith('NO_ICO_') ? ico.trim() : null;

  const KNOWN_BANKS = ['00151653', '31320155', '36854140', '47251336', '31318762', '31575951'];
  if (cleanIco && KNOWN_BANKS.includes(cleanIco)) return true;
  if (supplierName && /sporiteľňa|vúb|čsob|unicredit|tatra banka|prima banka/i.test(supplierName)) return true;

  const KNOWN_STATE_ICOS = [
    '00151866', '00000604', '00151742', '00156884', '42181810', '00165182', '00681156', '00686832', '30416094', '00151513',
    '30807484', '37808427', '00316792', '00316776', '00647365', '00316717', '00316890', '00316601', '00316580', '00316971',
    '00316679', '00316709', '00316806', '00650480', '00316831', '00216822', '00633909', '00316997', '00317012', '31749504',
    '31813811', '00164623', '00164721', '00397563', '30794536', '36145319', '42220360', '37806939', '42386497', '30796491'
  ];
  if (cleanIco && KNOWN_STATE_ICOS.includes(cleanIco)) return true;

  const STATE_KEYWORDS = /ministerstvo|rezort|štátn|sociálna poisťovňa|environmentálny fond|fond rozvoja|slovenská pošta|železnice|lesy sr|úrad práce|úrad verejného|žilinský samosprávny|mesto |obec |slovenská akadémia|všeobecná zdravotná|všzp|knižnica|osvetové centrum/i;
  if (supplierName && STATE_KEYWORDS.test(supplierName)) return true;

  return false;
}
