// READ-ONLY WATCH: check if the live `krtko:pdf` script (src/scripts/krtko-pdf.ts)
// ever left residue in the production DB. It upserts transactions with
// external_id LIKE 'PDF_%', entities named 'Neznáma firma z PDF (ico)',
// source_url = the sample dummy.pdf, and PDF_EXTRACTOR/MANUAL_REVIEW logs.
// If any of these exist -> fabricated/test data on the live transparency site.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const out = {};

  // 1) transactions with PDF_ external_id
  const { data: pdfTx, error: e1 } = await supabase
    .from('transactions')
    .select('id, external_id, source_type, source_url, amount_eur, subject, buyer_entity_id, supplier_entity_id')
    .like('external_id', 'PDF_%');
  out.pdf_external_id_tx = { error: e1 && e1.message, count: (pdfTx || []).length, rows: pdfTx || [] };

  // 2) transactions whose source_url references the dummy/testing pdf or w3.org
  const { data: dummyTx, error: e2 } = await supabase
    .from('transactions')
    .select('id, external_id, source_type, source_url, amount_eur, subject')
    .or('source_url.ilike.%dummy.pdf%,source_url.ilike.%w3.org%');
  out.dummy_url_tx = { error: e2 && e2.message, count: (dummyTx || []).length, rows: dummyTx || [] };

  // 3) entities named like the PDF fallback
  const { data: ents, error: e3 } = await supabase
    .from('entities')
    .select('id, ico, name, type')
    .ilike('name', '%Neznáma firma z PDF%');
  out.pdf_fallback_entities = { error: e3 && e3.message, count: (ents || []).length, rows: ents || [] };

  // 4) system_logs from PDF_EXTRACTOR / MANUAL_REVIEW_NEEDED (may not exist as table)
  const { data: logs, error: e4 } = await supabase
    .from('system_logs')
    .select('id, source, message, created_at')
    .in('source', ['PDF_EXTRACTOR', 'MANUAL_REVIEW_NEEDED'])
    .order('created_at', { ascending: false })
    .limit(20);
  out.pdf_logs = { error: e4 && e4.message, count: (logs || []).length, rows: logs || [] };

  console.log(JSON.stringify(out, null, 1));
}
main().catch(e => { console.error(e); process.exit(1); });
