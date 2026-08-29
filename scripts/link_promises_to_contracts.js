// Prepojenie slubov na REALNE CRZ zmluvy z nasej DB (related_transaction_ids).
// Konzervativne: len jednoznacne relevantne zmluvy mesta Martin.
// Dry-run default; --apply zapise. Zolander, mandat: dolozitelne fakty.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
const APPLY = process.argv.includes('--apply');

// title -> zoznam realnych tx ID (overene z DB dumpu, crz.gov.sk zmluvy)
const MAP = {
  'Zelenšie mesto a údržba parkov': [
    'b4ad60e0-129c-4e00-9857-4c00a9fa1f84', // ZoD Revitalizacia Parku P.O.Hviezdoslava 627k
    '6f0a2c62-11e1-475d-8246-aa83ef019940', // Dodatok revitalizacia parku 626k
    'f330bdf7-275e-43d7-bcef-5923fcc6dbd5', // Zazelenenie pesej zony 144k
    '1e38eb64-a8aa-446d-8464-17883366919c', // PD Zazelenenie 22k
  ],
  'Oprava ciest a chodníkov': [
    'bd7dfb5a-771b-4765-951a-083ea6a049a5', // Ramcova dohoda 2/JS/2026 opravy ciest 614k
    '62c6de3f-2cfa-4fa6-abda-5b337d01efa4', // Ramcova dohoda 1/JS/2026 601k
    'ddb5b267-31fe-4b78-a259-02d6a5dcff54', // ZoD 1/JS/2025 opravy ciest 560k
    'ac891474-34e8-4848-aad9-a68879b50757', // ZoD 2/JS/2025 opravy ciest 522k
    '29ae3fe6-9bfb-4a0b-bb7a-40585359d67a', // Modernizacia komunikacie Holleho 896k
  ],
  'Výstavba domovov pre seniorov': [
    'ab732343-2f22-40a9-9d64-1949922deafd', // ZoD Zariadenie pre seniorov Skultetyho 690k
    '0dd27ebf-8e87-4430-8828-0fb03cfd4604', // Dodatok 1 705k
    'f20b3c6e-01d8-4c48-a5af-4ecf41ef02a2', // Dodatok 2 737k
    'f25ac444-f976-448b-b4db-9bb969e41d23', // Dodatok 4 512k
  ],
  'Bezplatná MHD': [
    '0b92775d-0710-44e7-a271-a7686483eb68', // Dodatok 6 sluzby vo verejnom zaujme MHD 3.85M
    '75ac2ad9-3f27-412e-9b94-bea58aa7f934', // Dodatok 4 MHD 3.67M
    'f79156b9-842d-484c-9442-2f6cb90df524', // prispevok MHD 880k
  ],
  'Výstavba Univerzitnej nemocnice': [
    '6abdcdf6-32ce-4056-97a9-d0b3286a851e', // buduca zmluva Vystavba UNsM
    'b8b9fa82-66a7-4aea-982f-c09524e7918b', // dodatok vecne bremeno vystavba UN
    'bace453f-7662-4617-9e8b-c32b7954a755', // darovacia vykopova zemina vystavba UN
    '602e17cb-11e4-4b1b-8003-f9f93942f8c8', // buduca zmluva prevod komunikacie
  ],
  'Lanovka na Martinské hole': [
    '6976385e-2d19-4a19-9d1a-78788bbfbe63', // najomna pozemky Lanova draha 150k
    '12e26cb2-8795-4eeb-a10b-3be3d76482e6', // sluzby projekt Lanova draha 79
    '1f1b9569-de03-4352-a848-2722e5de8b22', // kupa PD lyziarske stredisko 1e
  ],
  'Nové parkovacie miesta': [
    '52ff99e5-fb24-48db-9c87-7a6d1f643f1b', // prenajom 10 parkovacich miest 7200
    'dd77104a-fc22-4d2c-88f2-5bc1af9f3606', // prenajom 10 miest 6000
    'effc1608-b35b-4e24-8933-981e81825dcd', // sprava parkovacich automatov 1960
  ],
  'Parkovacia politika (Parkovacie domy)': [
    'edcad32f-c8f3-4bb9-8688-e5798ac7def5', // Zmluva o mobilnom parkovani
    'fcc68acb-dbfd-4090-a468-70bcf0dd1fda', // Zmluva o prevadzke parkovacich miest
    'effc1608-b35b-4e24-8933-981e81825dcd', // sprava automatov
  ],
  // Bez kandidatov v DB -> ostavaju prazdne (poctivo): Transparentnejsie obstaravanie,
  // Vystavba akvaparku/kupaliska, Znizenie dlhu mesta.
};

async function fetchAll() {
  let all = [], from = 0, page = 1000;
  for (;;) {
    const { data, error } = await supabase.from('transactions')
      .select('id, subject, amount_eur, source_url').range(from, from + page - 1);
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < page) break;
    from += page;
  }
  return new Map(all.map(t => [t.id, t]));
}

async function run() {
  const txById = await fetchAll();
  const { data: promises } = await supabase.from('promises').select('*');
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}  | tx v DB: ${txById.size}\n`);
  for (const p of promises) {
    const ids = MAP[p.title] || [];
    // over ze vsetky tx ID realne existuju
    const valid = ids.filter(id => txById.has(id));
    const missing = ids.filter(id => !txById.has(id));
    if (missing.length) { console.log(`!! ${p.title}: CHYBAJU tx ${missing.join(',')}`); }
    const sum = valid.reduce((s,id)=>s+(Number(txById.get(id).amount_eur)||0),0);
    console.log(`${p.title}: ${valid.length} zmluv, spolu ${sum.toLocaleString('sk')} EUR`);
    for (const id of valid) {
      const t = txById.get(id);
      console.log(`   - ${(t.subject||'').replace(/&quot;/g,'"').slice(0,70)} | ${(Number(t.amount_eur)||0).toLocaleString('sk')} EUR`);
    }
    if (APPLY) {
      const { error } = await supabase.from('promises').update({ related_transaction_ids: valid }).eq('id', p.id);
      console.log(error ? `   ZAPIS CHYBA: ${error.message}` : `   >> zapisane`);
    }
  }
}
run().catch(e=>console.log('FATAL',e.message));
