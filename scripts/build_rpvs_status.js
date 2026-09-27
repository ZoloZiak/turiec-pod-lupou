#!/usr/bin/env node
/**
 * build_rpvs_status.js — precompute RPVS stavu pre audit "zákazky nad 100k bez RPVS".
 *
 * PREČO precompute (a nie živý fetch z prehliadača):
 * Register partnerov verejného sektora (rpvs.gov.sk) je pomalý a pri desiatkach súčasných
 * dopytov nespoľahlivý (timeouty). Živé batch-overovanie z klienta preto dávalo nedeterministický
 * výsledok (raz 3 nálezy, inokedy 0 kvôli výpadku registra) — na transparentnom webe neprípustné,
 * lebo by sme firmu falošne obvinili z porušenia zákona len kvôli timeoutu.
 *
 * Riešenie: tento skript overí kandidátov SEKVENČNE (spoľahlivo), s retry, a uloží stav do
 * src/data/rpvs-status.json. /api/data ten stav pripojí k transakciám, filter je potom
 * deterministický a okamžitý. Obnova = spustiť skript znova (ideálne cron; RPVS sa nemení denne).
 *
 * Použitie:  node scripts/build_rpvs_status.js [baseUrl]
 *   baseUrl = odkiaľ vziať dataset (default http://localhost:3000). Dá sa aj produkčné URL.
 *
 * Status hodnoty:
 *   registered     — firma je zapísaná v RPVS (má aktívny záznam)
 *   not_registered — register odpovedal, firma NIE je zapísaná (pravý red flag)
 *   exempt         — zákonná výnimka (§ 2 ods. 3 z. 315/2016): štát, obce, banky, štátne fondy
 *   unknown        — register sa nepodarilo overiť (výpadok) — NEoznačuje sa ako red flag
 */

const fs = require('fs');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:3000';
const OUT = path.join(__dirname, '..', 'src', 'data', 'rpvs-status.json');
const RPVS_TIMEOUT_MS = 15000;
const MAX_RETRY = 4;

// --- isRpvsExempt: musí zostať v zhode s src/lib/rpvs-exempt.ts ---
const KNOWN_BANKS = ['00151653', '31320155', '36854140', '47251336', '31318762', '31575951'];
const KNOWN_STATE_ICOS = [
  '00151866', '00000604', '00151742', '00156884', '42181810', '00165182', '00681156', '00686832', '30416094', '00151513',
  '30807484', '37808427', '00316792', '00316776', '00647365', '00316717', '00316890', '00316601', '00316580', '00316971',
  '00316679', '00316709', '00316806', '00650480', '00316831', '00316822', '00633909', '00316997', '00317012', '31749504',
  '31813811', '00164623', '00164721', '00397563', '30794536', '36145319', '42220360', '37806939', '42386497', '30796491'
];
const BANK_RE = /sporiteľňa|vúb|čsob|unicredit|tatra banka|prima banka/i;
const STATE_RE = /ministerstvo|rezort|štátn|sociálna poisťovňa|environmentálny fond|fond rozvoja|fond na podporu|slovenská pošta|železnice|lesy sr|úrad práce|úrad verejného|žilinský samosprávny|mesto |obec |slovenská akadémia|všeobecná zdravotná|všzp|knižnica|osvetové centrum/i;

function isRpvsExempt(ico, name) {
  const clean = ico && !ico.startsWith('NO_ICO_') ? ico.trim() : null;
  if (clean && KNOWN_BANKS.includes(clean)) return true;
  if (name && BANK_RE.test(name)) return true;
  if (clean && KNOWN_STATE_ICOS.includes(clean)) return true;
  if (name && STATE_RE.test(name)) return true;
  return false;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(RPVS_TIMEOUT_MS) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

/**
 * Autoritatívne overenie cez OData API (primárny zdroj pravdy). Vráti 'registered' /
 * 'not_registered' keď register odpovedal, alebo 'unknown' keď VŠETKY pokusy zlyhali.
 */
async function checkRpvs(ico, name) {
  if (isRpvsExempt(ico, name)) return 'exempt';
  const odataUrl = `https://rpvs.gov.sk/opendatav2/PartneriVerejnehoSektora?%24filter=${encodeURIComponent(`Ico eq '${ico}'`)}`;
  const gpUrl = `https://rpvs.gov.sk/rpvs/Partner/Partner/GetPartners?text=${encodeURIComponent(ico)}`;
  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    try {
      const data = await fetchJson(odataUrl);
      const active = Array.isArray(data.value) && data.value.some(r => !r.PlatnostDo || new Date(r.PlatnostDo) > new Date());
      if (active) return 'registered';
      // OData prázdny -> over ešte GetPartners (niekedy má záznam, čo OData filter nevráti)
      try {
        const gp = await fetchJson(gpUrl);
        if (Array.isArray(gp) && gp.some(p => p.TypOsoby === 'Partner verejného sektora' && p.PartnerId)) return 'registered';
      } catch { /* GetPartners zlyhal, ale OData odpovedal -> ver OData */ }
      return 'not_registered';
    } catch {
      await sleep(1500 * (attempt + 1)); // backoff
    }
  }
  return 'unknown';
}

(async () => {
  console.log(`[rpvs] dataset z ${BASE}/api/data`);
  const data = await fetchJson(`${BASE}/api/data`);
  const tx = data.transactions || [];

  // unikátni kandidáti: reálna zákazka (non-income, nie prepísaný dodatok) nad 100k, platné IČO
  const candidates = new Map();
  for (const t of tx) {
    if (t.is_income || t.superseded) continue;
    if ((t.amount_eur || 0) < 100000) continue;
    const ico = t.supplier?.ico;
    const name = t.supplier?.name;
    if (!ico || ico.startsWith('NO_ICO_')) continue;
    if (!candidates.has(ico)) candidates.set(ico, name || '');
  }
  console.log(`[rpvs] kandidátov nad 100k: ${candidates.size}`);

  const status = {};
  let i = 0;
  const counts = { registered: 0, not_registered: 0, exempt: 0, unknown: 0 };
  for (const [ico, name] of candidates) {
    i++;
    const s = await checkRpvs(ico, name);
    status[ico] = s;
    counts[s]++;
    console.log(`[rpvs] ${i}/${candidates.size}  ${s.padEnd(15)} ${ico}  ${name}`);
    await sleep(400); // šetrný odstup medzi firmami
  }

  const out = {
    generatedAt: new Date().toISOString(),
    source: 'rpvs.gov.sk OData v2 + GetPartners',
    note: 'Precompute pre audit "zákazky nad 100k bez RPVS". unknown = register nedostupný, NIE je to red flag.',
    counts,
    status,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log(`[rpvs] HOTOVO -> ${OUT}`);
  console.log(`[rpvs] súhrn:`, counts);
})();
