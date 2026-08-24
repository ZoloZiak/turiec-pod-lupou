// Fix davka 200-239: renames podla RPO (presna zhoda identifier) + zle ICO STAVAJ-SK.
// Zdroje: RPO api.statistics.sk (exact identifiers[].value) + FinStat/registeruz pre rename TuCon->Marti.
// Idempotentny, dry-run default, --apply na zapis.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');

const FIXES = [
  { id: '19c61c0b-e557-4128-9837-49f4e705558e', ico: '44802030', set: { name: 'Marti, a.s.' }, why: 'premenovanie TuCon -> Marti (RPO, FinStat: hist. nazov TuCon do 2.9.2024), ICO spravne' },
  { id: 'ddd71dc7-87ce-47a1-ad9f-cb281e891d3b', ico: '45516286', set: { name: 'AUTOKLUB, s. r. o.' }, why: 'pravna forma podla RPO je s.r.o., v DB zle a.s.' },
  { id: '20456f55-bb18-4020-98fb-bef33eb15064', ico: '45689792', set: { name: 'Agroservis - Stred s.r.o.' }, why: 'nazov podla RPO' },
  { id: '0a6b8e21-53da-45af-8682-655d7797b061', ico: '46042865', set: { name: 'Július Halaj - HTCOM' }, why: 'nazov podla RPO' },
  { id: '79e6c182-ebea-4c4b-8912-3a476235f7dc', ico: '47493540', set: { ico: '46482377', name: 'STAVAJ - SK, s.r.o.' }, why: 'ZLE ICO 47493540 neexistuje v RPO; realna firma STAVAJ - SK s.r.o. ma ICO 46482377 (RPO exact match, registeruz, Košťany nad Turcom)' },
  { id: '84170609-6ff5-4c77-ab5f-ff39e1d14a17', ico: '47526611', set: { name: 'JMS Press, s. r. o.' }, why: 'premenovanie JMS -> JMS Press podla RPO' },
  { id: 'e9f28ab3-57ae-4083-bdd0-28d70203414f', ico: '47552549', set: { name: 'SPP Mobilita s. r. o.' }, why: 'premenovanie SPP CNG -> SPP Mobilita podla RPO' },
];

(async () => {
  for (const f of FIXES) {
    const { data, error } = await supabase.from('entities').select('id, ico, name').eq('id', f.id).single();
    if (error) { console.log('ERR probe', f.ico, error.message); continue; }
    if (!data) { console.log('SKIP', f.ico, 'entity nenajdena'); continue; }
    const needs = Object.entries(f.set).some(([k, v]) => data[k] !== v);
    if (!needs) { console.log('ALREADY OK', f.ico); continue; }
    console.log(`${APPLY ? 'APPLY' : 'DRY'} ${data.ico} ${data.name} -> ${JSON.stringify(f.set)} [${f.why}]`);
    if (APPLY) {
      const { error: e } = await supabase.from('entities').update(f.set).eq('id', f.id);
      console.log(e ? 'ERROR: ' + e.message : 'OK');
    }
  }
})();
