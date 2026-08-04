import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { auditAndNotifyTransaction, TransactionForAudit } from '../lib/telegram';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Chýbajú Supabase kľúče v .env.local!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runAudit() {
  console.log('🔎 Spúšťam Krtko Audit - Vyhodnocovanie podozrivých zmlúv (Suma > 100 000 € & RPVS)...');

  // Fetch transactions with amount >= 100,000 EUR
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select(`
      id,
      external_id,
      subject,
      amount_eur,
      source_url,
      date_published,
      buyer:buyer_entity_id ( name, ico ),
      supplier:supplier_entity_id ( name, ico )
    `)
    .gte('amount_eur', 100000)
    .order('amount_eur', { ascending: false });

  if (error) {
    console.error('❌ Chyba pri načítavaní transakcií zo Supabase:', error);
    process.exit(1);
  }

  console.log(`📋 Nájdených ${transactions?.length || 0} zmlúv nad 100 000 € na vyhodnotenie.`);

  let totalAudited = 0;
  let suspiciousCount = 0;
  let telegramAlertsCount = 0;

  for (const tx of transactions || []) {
    totalAudited++;
    const buyerObj = Array.isArray(tx.buyer) ? tx.buyer[0] : tx.buyer;
    const supplierObj = Array.isArray(tx.supplier) ? tx.supplier[0] : tx.supplier;

    const txForAudit: TransactionForAudit = {
      external_id: tx.external_id,
      title: tx.subject,
      subject: tx.subject,
      amount: Number(tx.amount_eur),
      buyer_name: buyerObj?.name || 'Neznámy objednávateľ',
      supplier_name: supplierObj?.name || 'Neznámy dodávateľ',
      supplier_ico: supplierObj?.ico || null,
      url: tx.source_url,
      published_at: tx.date_published,
    };

    console.log(`\n🔍 AUDIT [${totalAudited}/${transactions.length}]: ${txForAudit.supplier_name} - ${txForAudit.amount.toLocaleString('sk-SK')} €`);

    const result = await auditAndNotifyTransaction(txForAudit);

    if (result.isSuspicious) {
      suspiciousCount++;
      console.warn(`🚨 PODOZRIVÁ ZMLUVA DETEKOVANÁ! Dôvod: ${result.reason}`);
      if (result.telegramSent) {
        telegramAlertsCount++;
      }
    } else {
      console.log(`✅ Zmluva OK (RPVS aktívne).`);
    }
  }

  const summary = `🎉 Krtko Audit dokončený! Skontrolovaných: ${totalAudited} zmlúv nad 100k €. Detekovaných podozrivých: ${suspiciousCount}, Odeslaných Telegram notifikácií: ${telegramAlertsCount}.`;
  console.log(`\n${summary}`);

  await supabase.from('system_logs').insert({
    source: 'KRTKO_AUDIT_BOT',
    message: summary,
    parsed_data: { totalAudited, suspiciousCount, telegramAlertsCount }
  });
}

runAudit();
