// READ-ONLY WATCH #89: pre každý (malformed → real) zisti, či v DB existuje KANONICKÁ entita
// s real IČO (rozhodne stratégiu: read-time correction vs DB normalizácia ico).
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const PAIRS = [
  ['52  222 438', '47619503', 'BTI s.r.o.'],
  ['31 580 726', '31580726', 'VS Guard, s.r.o.'],
  ['361062145', '50139088', 'eSYST s.r.o.'],
  ['55 049 249', '55049249', 'DFM Slovakia s.r.o.'],
  ['35 770 732', '35770732', 'MAJES výťahy a eskalátory, a.s.'],
  ['44552483 ', '44552483', 'KV - mont Martin, s.r.o.'],
  ['316873', '00316873', 'Obec Rudno'],
  ['36 751 804 ', '36751804', 'SIRS - Development, a.s.'],
  ['36368792 ', '36368792', 'Stavchem s.r.o.'],
  ['54 228 573', '35709332', 'Generali Poisťovňa, a.s.'],
  ['316580', '00316580', 'Obec Brieštie'],
  ['316679', '00316679', 'Obec Turčianske Jaseno'],
];

async function ent(ico) {
  const { data } = await sb.from('entities').select('id,ico,name').eq('ico', ico);
  return data || [];
}
async function txCount(entId) {
  const { count: b } = await sb.from('transactions').select('*', { count: 'exact', head: true }).eq('buyer_entity_id', entId);
  const { count: s } = await sb.from('transactions').select('*', { count: 'exact', head: true }).eq('supplier_entity_id', entId);
  return (b || 0) + (s || 0);
}

(async () => {
  console.log('malformed | real | KANON.entita? | strategia');
  for (const [mal, real, name] of PAIRS) {
    const malEnts = await ent(mal);
    const realEnts = await ent(real);
    let malTx = 0; for (const e of malEnts) malTx += await txCount(e.id);
    let realTx = 0; for (const e of realEnts) realTx += await txCount(e.id);
    const strat = realEnts.length > 0 ? 'READ-TIME (kanon existuje)' : 'DB-UPDATE ico (kanon chýba)';
    console.log(`"${mal}"(tx=${malTx}) -> ${real}: kanon=${realEnts.length}(tx=${realTx}) [${realEnts.map(e=>e.name).join('/')}] => ${strat} | ${name}`);
  }
})();
