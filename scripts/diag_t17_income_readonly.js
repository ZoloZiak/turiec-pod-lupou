// T17: READ-ONLY overenie klasifikacie smeru (INCOME vs EXPENSE) a hero cisel.
// Ciel:
//  1) exact count transakcii + full paginovany fetch (pravda),
//  2) replikovat PRESNE logiku src/app/api/data/route.ts:
//     is_income = hasDirectionColumn && t.direction ? t.direction==='INCOME' : INCOME_TX_IDS.has(t.id)
//     totalSpent = sum(amount) pre !is_income ; totalIncome = sum(amount) pre is_income
//  3) prepocitat totalIncome proti ocakavanym 15 407 988,08 EUR (hero "Ziskane dotacie a granty"),
//  4) overit ze totalSpent (hero vydavky) NEzahrna prijmy (dvojite pocitanie),
//  5) skontrolovat stav 12 UNSURE zmluv: maju DB direction alebo su default EXPENSE?
// Nic nemeni. INCOME/UNSURE ID cita priamo z src/lib/*.ts regexom (auditovatelne).
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PAGE = 1000;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

// Nacitaj INCOME_TX_IDS zo zdrojaku (rovnaka mnozina ako pouziva route.ts)
function loadIncomeIds() {
  const src = fs.readFileSync('src/lib/income-ids.ts', 'utf8');
  const body = src.slice(src.indexOf('new Set<string>(['));
  const ids = (body.match(UUID_RE) || []);
  return new Set(ids);
}
// Nacitaj UNSURE ID + subject z unsure-ids.ts (staci nam zoznam ID)
function loadUnsureIds() {
  const src = fs.readFileSync('src/lib/unsure-ids.ts', 'utf8');
  // len z casti UNSURE_REVIEW (pred UNSURE_TX_IDS)
  const body = src.slice(src.indexOf('UNSURE_REVIEW'), src.indexOf('UNSURE_TX_IDS'));
  const ids = [];
  const re = /id:\s*"([0-9a-f-]{36})"/g;
  let m;
  while ((m = re.exec(body)) !== null) ids.push(m[1]);
  return ids;
}

async function truthFetch() {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, source_type, amount_eur, subject, direction')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      // ak stlpec direction neexistuje, skusime bez neho
      if ((error.message || '').toLowerCase().includes('direction')) return { rows: null, noDir: true };
      throw error;
    }
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return { rows, noDir: false };
}

async function truthFetchNoDir() {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, source_type, amount_eur, subject')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

async function main() {
  console.log('=== T17 income/direction audit (READ-ONLY) ===');
  const INCOME = loadIncomeIds();
  const UNSURE = loadUnsureIds();
  console.log(`INCOME_TX_IDS zo zdrojaku: ${INCOME.size} (ocakavane 87)`);
  console.log(`UNSURE_REVIEW zo zdrojaku: ${UNSURE.length} (ocakavane 12)`);

  const { count } = await supabase.from('transactions').select('*', { count: 'exact', head: true });
  console.log('transactions COUNT (exact) = ' + count);

  let { rows, noDir } = await truthFetch();
  let hasDirectionColumn = !noDir;
  if (noDir) {
    console.log('!! Stlpec direction NEEXISTUJE v DB -> fallback na INCOME_TX_IDS (rovnako ako route)');
    rows = await truthFetchNoDir();
  } else {
    console.log('Stlpec direction existuje v DB -> route preferuje DB rozhodnutia.');
  }
  console.log(`Full fetch: ${rows.length} riadkov (cap check: ${rows.length === count ? 'OK, vsetko' : 'POZOR nesedi s count'})`);

  // Replikacia route.ts is_income
  let totalSpent = 0, totalIncome = 0, expenseCount = 0, incomeCount = 0;
  let dbDirIncome = 0, dbDirExpense = 0, dbDirNull = 0;
  for (const t of rows) {
    const amt = Number(t.amount_eur) || 0;
    const is_income = (hasDirectionColumn && t.direction)
      ? t.direction === 'INCOME'
      : INCOME.has(t.id);
    if (is_income) { totalIncome += amt; incomeCount++; }
    else { totalSpent += amt; expenseCount++; }
    if (hasDirectionColumn) {
      if (t.direction === 'INCOME') dbDirIncome++;
      else if (t.direction === 'EXPENSE') dbDirExpense++;
      else dbDirNull++;
    }
  }

  console.log('--- HERO CISLA (replikacia route.ts) ---');
  console.log(`totalSpent (vydavky):  ${totalSpent.toFixed(2)} EUR  (${expenseCount} tx)`);
  console.log(`totalIncome (prijmy):  ${totalIncome.toFixed(2)} EUR  (${incomeCount} tx)`);
  const EXPECTED_INCOME = 15407988.08;
  const diff = Math.abs(totalIncome - EXPECTED_INCOME);
  console.log(`Ocakavany totalIncome (desc): ${EXPECTED_INCOME.toFixed(2)} EUR | rozdiel: ${diff.toFixed(2)} EUR ${diff < 0.5 ? '=> SEDI' : '=> NESEDI (over)'}`);

  if (hasDirectionColumn) {
    console.log('--- DB direction stlpec rozlozenie ---');
    console.log(`  INCOME=${dbDirIncome}  EXPENSE=${dbDirExpense}  NULL/ine=${dbDirNull}`);
  }

  // Kontrola dvojiteho pocitania: ziadna tx nesmie byt naraz v spent aj income (z definicie nemoze)
  // Over ze income tx NEsu zapocitane vo vydavkoch (sanity: totalSpent + totalIncome = sum vsetkych)
  const sumAll = rows.reduce((a, t) => a + (Number(t.amount_eur) || 0), 0);
  const recomposed = totalSpent + totalIncome;
  console.log('--- SANITY dvojite pocitanie ---');
  console.log(`  sum(vsetkych amount) = ${sumAll.toFixed(2)}`);
  console.log(`  totalSpent+totalIncome = ${recomposed.toFixed(2)}  ${Math.abs(sumAll - recomposed) < 0.01 ? '=> OK (ziadny prekryv/dvojite pocitanie)' : '=> POZOR nesedi'}`);
  console.log(`  => hero vydavky ${totalIncome > 0 ? 'VYLUCUJU' : '(bez prijmov v DB)'} prijmy: ${incomeCount} prijmovych tx nie je vo vydavkoch`);

  // 12 UNSURE — aktualny stav
  console.log('--- 12 UNSURE zmluv: aktualny stav v DB ---');
  const byId = new Map(rows.map(r => [r.id, r]));
  let unsureIncome = 0, unsureExpenseDefault = 0, unsureResolved = 0, unsureMissing = 0;
  for (const uid of UNSURE) {
    const t = byId.get(uid);
    if (!t) { console.log(`  ${uid}: NIE JE V DB (chyba riadok)`); unsureMissing++; continue; }
    const dbDir = hasDirectionColumn ? (t.direction || 'NULL') : '(no col)';
    const effective = (hasDirectionColumn && t.direction) ? t.direction : (INCOME.has(uid) ? 'INCOME(static)' : 'EXPENSE(default)');
    const resolved = hasDirectionColumn && (t.direction === 'INCOME' || t.direction === 'EXPENSE');
    if (resolved) unsureResolved++;
    if (effective === 'INCOME') unsureIncome++;
    else unsureExpenseDefault++;
    console.log(`  ${uid} | amt=${(Number(t.amount_eur)||0).toFixed(2)} | dbDir=${dbDir} | efektivne=${effective} | ${resolved ? 'ROZHODNUTE adminom' : 'NEROZHODNUTE (fallback)'}`);
  }
  console.log(`UNSURE spolu: rozhodnutych adminom=${unsureResolved}, efektivne INCOME=${unsureIncome}, efektivne EXPENSE=${unsureExpenseDefault}, chybajucich=${unsureMissing}`);

  console.log('=== koniec T17 ===');
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
