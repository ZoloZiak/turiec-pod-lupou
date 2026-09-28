/**
 * build-supplier-contracts.ts — PRECOMPUTE: ktorí dodávatelia (podľa IČO) majú zmluvu mesta.
 *
 * PREČO: Audit "faktúra ≥10k bez zmluvy" porovnáva faktúry (od 2010) proti zmluvám. Národný
 * register CRZ máme v DB len od ~2021 (reálne 2023+), takže sám osebe by označil tisíce faktúr
 * z 2010–2022 ako "bez zmluvy" len preto, že zmluvu z tých rokov NEMÁME — nie že neexistuje.
 * To je falošné verejné obvinenie (zakázané). Mesto Martin však zverejňuje VLASTNÉ zmluvy od
 * 2010 na CORA portáli (egov.martin.sk, NavigationState=778) — 30k+ zmlúv, plné pokrytie zhodné
 * s faktúrami. Použijeme ich ako autoritatívny náprotivok.
 *
 * PROBLÉM: JSON export zmlúv ANI detail zmluvy na portáli NEOBSAHUJE IČO dodávateľa (overené) —
 * len meno zmluvných strán. IČO-based párovanie faktúra↔zmluva teda fyzicky nie je možné.
 * Párovanie je nutne na meno. Meno-match je krehký (raz falošne vyčistí, raz falošne obviní),
 * preto NIE je základ verejného auditu za behu — namiesto toho ho spravíme OFFLINE, uložíme
 * deterministický výsledok do JSON, a hraničné prípady prejdeme kurátorsky (CONTRACT_OVERRIDES).
 *
 * VÝSTUP: src/data/supplier-contracts.json = { generatedAt, icoWithContract: [ico, ...] }
 * Audit v /api/data: faktúra je red-flag len ak supplier.ico NIE JE v tomto sete (+ CRZ + interné).
 *
 * Konzervatívny princíp: keď si nie sme istí, radšej dodávateľa VYČISTÍME (nedáme red-flag),
 * aby sme NIKDY nespôsobili falošné obvinenie. Riziko je nanajvýš prehliadnutý problém.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { writeFileSync } from 'fs';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// CORA export zmlúv mesta (NavigationState=778) — redirect na OutputStreamHttpHandler (JSON).
const ZMLUVY_EXPORT_URL =
  'https://egov.martin.sk/Default.aspx?NavigationState=778:0::plac1889:_144101_5_8';

// Kurátorské verdikty pre hraničné prípady, ktoré automat (token/fulltext) vyhodnotí zle.
// Formát: ICO -> true = MÁ zmluvu mesta (vyčisti z red-flag). Overené ručne fulltextom v exporte.
// Dôvod pri každom, aby to bolo auditovateľné (rovnaký vzor ako entity-ico-fixes.ts).
const CONTRACT_OVERRIDES: Record<string, { hasContract: boolean; reason: string }> = {
  '47764821': { hasContract: true, reason: 'P.S. in, a.s. — Zmluva o dielo "Šport park Pltníky" I.+II.etapa (2020,2021, ~1,55M €). Meno s bodkami rozbíja token-match.' },
  '50196049': { hasContract: true, reason: 'MS s.r.o. — 3 zmluvy mesta 2018–2019 ("Mesto Martin, MS s.r.o."). "MS" je pregenerické pre token-match.' },
  '31559093': { hasContract: true, reason: 'G A L I M E X s.r.o. — 6 zmlúv mesta (rozstrelené medzery v mene rozbíjajú tokenizáciu).' },
  '47020946': { hasContract: true, reason: 'SINO s.r.o. — 3 zmluvy mesta.' },
};

// ---- normalizácia a matching (offline, dôkladné) ----
const LEGAL_TOKEN = /\b(s\.?\s?r\.?\s?o|spol|a\.?\s?s|akciová spoločnosť|n\.?\s?o|o\.?\s?z|k\.?\s?s|v\.?\s?o\.?\s?s|závod|st|ml)\b\.?/gi;
const CITY = /mesto martin|útvar hlavného architekta|mestský úrad/i;

function coreTokens(s: string): Set<string> {
  const x = (s || '').toLowerCase().replace(LEGAL_TOKEN, ' ').replace(/[^\wáäčďéěíĺľňóôŕšťúýž ]/g, ' ');
  return new Set(x.split(/\s+/).filter((t) => t.length >= 3));
}
function normPhrase(s: string): string {
  return (s || '').toLowerCase().replace(/\./g, ' ').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
}
const LEGAL_SUFFIX = /[,]?\s*(spol\.?\s*)?s\.?\s?r\.?\s?o\.?$|[,]?\s*a\.?\s?s\.?$|[,]?\s*n\.?\s?o\.?$|[,]?\s*k\.?\s?s\.?$/i;
function firmCore(name: string): string {
  return normPhrase(name.replace(LEGAL_SUFFIX, '').trim());
}

async function pageAll<T>(cb: (from: number) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let f = 0; ; f += 1000) {
    const r = await cb(f);
    if (!r.length) break;
    out.push(...r);
    if (r.length < 1000) break;
  }
  return out;
}

async function main() {
  console.log('📄 build-supplier-contracts — precompute "dodávateľ má zmluvu mesta"');

  // 1) Stiahni egov zmluvy mesta (JSON export, redirect)
  console.log('  Sťahujem export zmlúv mesta (CORA 778)...');
  const res = await fetch(ZMLUVY_EXPORT_URL, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Export zmlúv zlyhal: HTTP ${res.status}`);
  const zmluvy: Array<{ Zmluvné_strany?: string }> = await res.json();
  console.log(`  Zmlúv mesta (egov): ${zmluvy.length}`);

  // Postav index partnerov (token sety) + blob pre fulltext (bez mesta)
  const partnerTokenSets: Set<string>[] = [];
  const blobs: string[] = [];
  for (const z of zmluvy) {
    const strany = z.Zmluvné_strany || '';
    blobs.push(normPhrase(strany));
    for (const part of strany.split(/[\r,]/)) {
      const p = part.trim();
      if (!p || CITY.test(p)) continue;
      const tk = coreTokens(p);
      if (tk.size) partnerTokenSets.push(tk);
    }
  }

  // 2) CRZ dodávatelia z DB (národný register — tiež platí ako "má zmluvu")
  const crzRows = await pageAll(async (f) => {
    const { data } = await supabase
      .from('transactions')
      .select('entities!transactions_supplier_entity_id_fkey(ico)')
      .eq('source_type', 'CRZ_CONTRACT')
      .not('supplier_entity_id', 'is', null)
      .range(f, f + 999);
    return data || [];
  });
  const crzIco = new Set<string>();
  for (const t of crzRows as Array<{ entities: { ico?: string } | { ico?: string }[] }>) {
    const e = Array.isArray(t.entities) ? t.entities[0] : t.entities;
    if (e?.ico) crzIco.add(e.ico);
  }
  console.log(`  CRZ dodávateľov (národný register): ${crzIco.size}`);

  // 3) Všetci WEB_INVOICE dodávatelia ≥10k (kandidáti auditu) — pre nich rozhodni verdikt
  const invRows = await pageAll(async (f) => {
    const { data } = await supabase
      .from('transactions')
      .select('entities!transactions_supplier_entity_id_fkey(ico, name)')
      .eq('source_type', 'WEB_INVOICE')
      .gte('amount_eur', 10000)
      .not('supplier_entity_id', 'is', null)
      .range(f, f + 999);
    return data || [];
  });
  const suppliers = new Map<string, string>(); // ico -> name
  for (const t of invRows as Array<{ entities: { ico?: string; name?: string } | { ico?: string; name?: string }[] }>) {
    const e = Array.isArray(t.entities) ? t.entities[0] : t.entities;
    if (e?.ico) suppliers.set(e.ico, e.name || '');
  }
  console.log(`  Unikátnych ≥10k dodávateľov (kandidáti): ${suppliers.size}`);

  function tokenHasContract(name: string): boolean {
    const ft = coreTokens(name);
    if (!ft.size) return false;
    for (const pt of partnerTokenSets) {
      let inter = false;
      for (const t of ft) if (pt.has(t)) { inter = true; break; }
      if (!inter) continue;
      // subset v ktoromkoľvek smere
      let ftSubset = true; for (const t of ft) if (!pt.has(t)) { ftSubset = false; break; }
      let ptSubset = true; for (const t of pt) if (!ft.has(t)) { ptSubset = false; break; }
      if (ftSubset || ptSubset) return true;
    }
    return false;
  }
  function fulltextHasContract(name: string): boolean | null {
    const core = firmCore(name);
    if (core.replace(/ /g, '').length < 4) return null; // pregenerické — nedá sa fulltext
    return blobs.some((b) => b.includes(core));
  }

  // 4) Rozhodni pre každé IČO: má zmluvu mesta?
  const icoWithContract = new Set<string>(crzIco); // CRZ automaticky platí
  let byToken = 0, byFulltext = 0, byOverride = 0;
  for (const [ico, name] of suppliers) {
    if (CONTRACT_OVERRIDES[ico]) {
      if (CONTRACT_OVERRIDES[ico].hasContract) { icoWithContract.add(ico); byOverride++; }
      continue; // override je definitívny (aj negatívny)
    }
    if (icoWithContract.has(ico)) continue;
    if (tokenHasContract(name)) { icoWithContract.add(ico); byToken++; continue; }
    const ft = fulltextHasContract(name);
    if (ft === true) { icoWithContract.add(ico); byFulltext++; continue; }
    // ft === false alebo null (pregenerické bez override) -> ostáva mimo (red-flag)
  }
  console.log(`  Zmluvu mesta má: token-match ${byToken}, fulltext ${byFulltext}, override ${byOverride}, + CRZ ${crzIco.size}`);

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'egov.martin.sk CORA 778 (zmluvy mesta) + CRZ_CONTRACT (DB)',
    note: 'IČO dodávateľov, ktorí majú aspoň jednu zmluvu s mestom (egov alebo národné CRZ). Audit ich NEoznačuje ako "faktúra bez zmluvy". Meno-párovanie doplnené kurátorskými override (viď build-supplier-contracts.ts).',
    icoWithContract: [...icoWithContract].sort(),
  };
  const outPath = resolve(process.cwd(), 'src/data/supplier-contracts.json');
  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`✅ Zapísané ${payload.icoWithContract.length} IČO so zmluvou → ${outPath}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
