import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { writeFileSync } from 'fs';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Precompute agregátov WEB_INVOICE faktúr (mesto Martin + DPM) do statického JSON.
// Dôvod: pri ~158k faktúrach nie je únosné sčítavať ich v /api/data pri každom requeste
// ani ich posielať klientovi. API číta tieto agregáty staticky (vzor ako rpvs-status.json).
async function main() {
  const byYear: Record<string, { count: number; sum: number }> = {};
  let total = 0, count = 0;
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('transactions')
      .select('amount_eur, date_published')
      .eq('source_type', 'WEB_INVOICE')
      .range(from, from + PAGE - 1);
    if (error) { console.error(error.message); process.exit(1); }
    if (!data || !data.length) break;
    for (const t of data) {
      const amt = Number(t.amount_eur) || 0;
      const y = (t.date_published || '').slice(0, 4) || 'unknown';
      if (!byYear[y]) byYear[y] = { count: 0, sum: 0 };
      byYear[y].count++; byYear[y].sum += amt;
      total += amt; count++;
    }
    if (data.length < PAGE) break;
  }
  const out = {
    generatedAt: new Date().toISOString(),
    source: 'WEB_INVOICE agregáty (DPM zverejňovanie + egov.martin.sk CORA)',
    note: 'Precompute pre škálovateľné zobrazenie faktúr. API neposiela jednotlivé bežné faktúry klientovi — len tieto súčty + red-flag faktúry (>=10k bez CRZ zmluvy).',
    totalInvoiced: Math.round(total * 100) / 100,
    invoiceCount: count,
    byYear: Object.fromEntries(Object.entries(byYear).sort().map(([y, v]) => [y, { count: v.count, sum: Math.round(v.sum * 100) / 100 }])),
  };
  const path = resolve(process.cwd(), 'src/data/invoice-stats.json');
  writeFileSync(path, JSON.stringify(out, null, 2));
  console.log('Zapísané:', path);
  console.log('  totalInvoiced:', out.totalInvoiced, '€ | invoiceCount:', out.invoiceCount);
  console.log('  roky:', Object.keys(out.byYear).join(', '));
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
