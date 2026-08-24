// READ-ONLY: exact count + paginovany sucet transakcii (overenie 1000-row limitu v /api/data).
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { count, error } = await supabase.from('transactions').select('id', { count: 'exact', head: true });
  if (error) { console.log('CHYBA count: ' + error.message); return; }
  console.log('EXACT POCET TRANSAKCII: ' + count);

  const PAGE = 1000;
  let from = 0, sumAll = 0, sumExpense = 0, sumIncome = 0;
  let nIncome = 0, nExpense = 0, nCrz = 0, fetched = 0;
  while (true) {
    const { data, error } = await supabase.from('transactions')
      .select('id, amount_eur')
      .range(from, from + PAGE - 1);
    if (error) { console.log('CHYBA page: ' + error.message); return; }
    if (!data || data.length === 0) break;
    for (const t of data) {
      const amt = Number(t.amount_eur) || 0;
      const isIncome = false; // stlpec direction v DB neexistuje — INCOME sa riesi cez INCOME_TX_IDS
      sumAll += amt; fetched++;
      if (isIncome) { sumIncome += amt; nIncome++; } else { sumExpense += amt; nExpense++; }
    }
    nCrz += data.length;
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log('FETCHED: ' + fetched);
  console.log('SUM_ALL: ' + sumAll.toFixed(2));
  console.log('SUM_EXPENSE (totalSpent): ' + sumExpense.toFixed(2));
  console.log('SUM_INCOME (totalIncome): ' + sumIncome.toFixed(2));
  console.log('COUNT_EXPENSE (totalContracts): ' + nExpense);
  console.log('COUNT_INCOME (incomeCount): ' + nIncome);
}
run();
