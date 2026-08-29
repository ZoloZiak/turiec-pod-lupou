// ETL: transactions (NFP zmluvy) -> eu_funds karta. REALNE dotacie Martin+podniky.
// Poctivo: len "Zmluva o poskytnuti NFP" (NIE dodatky/ukoncenia), dedup podla
// (suma+prijimatel), z duplicit vyber NAJINFORMATIVNEJSI predmet. Program odvodeny
// LEN ak jednoznacny v texte. winner_* = PRIJIMATEL dotacie. Dry-run default; --apply.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
const APPLY = process.argv.includes('--apply');
const CITY_ICOS = new Set(['00316792','53560922','36672084']); // Martin, DPMM, TVS

async function fetchAll(table, cols){
  let all=[],from=0,page=1000;
  for(;;){ const {data,error}=await supabase.from(table).select(cols).range(from,from+page-1);
    if(error) throw error; all=all.concat(data||[]); if(!data||data.length<page) break; from+=page; }
  return all;
}
const clean = s => (s||'').replace(/&quot;/g,'"').replace(/[„“”]/g,'"').replace(/\s+/g,' ').trim();

// cislo NFP projektu (dohladatelnost)
function projectCode(s){
  const m = s.match(/(IROP-[A-Z]-[A-Z0-9-]+|IROP-[A-Z0-9-]+|OPKZP-[A-Z0-9-/]+|Z?\s?SKCZ[0-9A-Z]+|MZP-PSK-[0-9A-Z]+|PSK-SIEA-[0-9A-Z-/]+|Z?40[0-9]{4}[A-Z][0-9A-Z]{2,}|401[0-9]{3}[A-Z][0-9]{3})/i);
  return m ? m[1].replace(/\s+/g,'').toUpperCase() : null;
}
function program(s){
  if(/IROP/i.test(s)) return 'IROP';
  if(/OPKZP/i.test(s)) return 'OP Kvalita životného prostredia';
  if(/SKCZ|Interreg/i.test(s)) return 'Interreg SK-CZ';
  if(/MZP-PSK|PSK-SIEA|PSK-/i.test(s)) return 'Program Slovensko';
  if(/Pl[aá]n obnovy|\bPOO\b/i.test(s)) return 'Plán obnovy';
  return null;
}
// vytiahni realny nazov projektu z predmetu (za "nazov projektu"/"projekt"/"projektu")
function extractName(s){
  let m = s.match(/(?:n[aá]zov projektu|projekt[u]?)\s*[:\-–]?\s*"?([^"]{6,140})/i);
  if(m){ let n=m[1].replace(/["]/g,'').replace(/\s+/g,' ').trim();
    n=n.replace(/\s+(zo d[ňn]a|č\.).*$/i,'').trim(); if(n.length>=6) return n; }
  // fallback: odstran pravnu omacku + cislo
  let n = s.replace(/(dodatok\s*č?\.?\s*\d+\s*k\s*)/gi,'')
    .replace(/zmluv[ay]?\s*(č\.?\s*[A-Z0-9/\-.]+)?\s*o poskytnut[ií]\s*(nen[aá]vratn[eé]ho finan[čc]n[eé]ho pr[ií]spevku|NFP)/gi,'')
    .replace(/č\.?\s*[A-Z0-9/\-.]{4,}/g,'').replace(/\bzo d[ňn]a\b.*$/i,'')
    .replace(/[-–—:]+/g,' ').replace(/["]/g,'').replace(/\s+/g,' ').trim();
  return n.length>=6 ? n : null;
}
// "signal" predmetu na vyber reprezentanta z dedup skupiny (viac konkretiky = lepsie)
function infoScore(s){
  let sc = s.length;
  if(/n[aá]zov projektu|projekt[u]?\s+["A-ZÁ]/i.test(s)) sc += 200;
  if(/^ZMLUVA O POSKYTNUT[IÍ] NEN[AÁ]VRATN/i.test(s.trim())) sc -= 150; // holy nadpis
  return sc;
}

async function run(){
  const tx = await fetchAll('transactions','id,subject,amount_eur,source_url,external_id,date_published,buyer_entity_id');
  const ents = await fetchAll('entities','id,name,ico');
  const eById = new Map(ents.map(e=>[e.id,e]));

  let cand = tx.filter(t=>{
    const s = clean(t.subject);
    if(!/nen[aá]vratn[eé]ho finan[čc]n[eé]ho pr[ií]spevku|poskytnut[ií]\s+NFP/i.test(s)) return false;
    if(/dodatok|dohoda o (mimoriadnom )?ukon[čc]en|ukon[čc]en[ií] zmluv/i.test(s)) return false;
    const b=eById.get(t.buyer_entity_id); return b && CITY_ICOS.has(b.ico);
  });

  // dedup: primarne podla cisla projektu (spoji centove/opakovane zverejnenia),
  // fallback (bez kodu) podla suma+ICO prijimatela. z kazdej skupiny najlepsi predmet.
  const groups = new Map();
  for(const t of cand){
    const b=eById.get(t.buyer_entity_id);
    const code = projectCode(clean(t.subject));
    const key = code ? `C:${code}` : `A:${Math.round((Number(t.amount_eur)||0)*100)}:${b.ico}`;
    if(!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(t);
  }
  const rows=[];
  for(const [key,grp] of groups){
    // reprezentant = najvyssi infoScore; kod z KTOREJKOLVEK verzie v skupine
    grp.sort((a,b)=>infoScore(clean(b.subject))-infoScore(clean(a.subject)));
    // reprezentant sumy = NAJVYSSIA suma v skupine (dodatky/opravy niekedy nizsie), stabilne
    const repAmt = grp.reduce((mx,g)=>Math.max(mx, Number(g.amount_eur)||0), 0);
    const rep = grp[0]; const b=eById.get(rep.buyer_entity_id);
    let code=null; for(const g of grp){ code = code || projectCode(clean(g.subject)); }
    let prog=null; for(const g of grp){ prog = prog || program(clean(g.subject)); }
    let name = grp.map(g=>extractName(clean(g.subject))).find(Boolean);
    // fallback: ak ziadna verzia nema realny nazov -> dohladatelne cislo NFP (nie pravny nadpis)
    if(!name) name = code ? `NFP projekt č. ${code}` : clean(rep.subject).slice(0,140);
    if(code && !name.includes(code)) name = `${name} (${code})`;
    // ocisti uvodne/koncove uvodzovkove artefakty z CRZ textu (,, „ " a pod.)
    name = name.replace(/^[\s,„“"'‚']+/,'').replace(/[\s„“"'‚']+$/,'').replace(/\s+/g,' ').trim();
    rows.push({
      project_name: name.slice(0,200),
      amount_eur: repAmt,
      program_name: prog,
      year: Number((rep.date_published||'').slice(0,4))||null,
      winner_ico: b.ico,
      winner_name: b.name.replace(/\s+/g,' ').trim(),
    });
  }
  rows.sort((a,b)=>b.amount_eur-a.amount_eur);

  // FINALNY zlucovaci priechod: ta ista dotacia moze byt raz s kodom (C-key) a raz
  // len s pravnym nadpisom (A-key). Zluc podla (suma+ICO), nechaj lepsi nazov+program.
  const nameRank = n => /^ZMLUVA O POSKYTNUT/i.test(n) ? 0 : (/^NFP projekt č\./.test(n) ? 1 : 2);
  const merged = new Map();
  for(const r of rows){
    const k = `${Math.round(r.amount_eur*100)}:${r.winner_ico}`;
    const cur = merged.get(k);
    if(!cur){ merged.set(k, r); continue; }
    if(nameRank(r.project_name) > nameRank(cur.project_name)) cur.project_name = r.project_name;
    cur.program_name = cur.program_name || r.program_name;
  }
  let final = [...merged.values()];
  // poctivy fallback pre dotacie bez nazvu aj bez kodu (holy nadpis) -> deskriptivny, nefabrikovany
  const SHORT = {'00316792':'Mesto Martin','53560922':'Dopravný podnik mesta Martin','36672084':'Turčianska vodárenská spoločnosť'};
  for(const r of final){
    if(/^ZMLUVA O POSKYTNUT/i.test(r.project_name))
      r.project_name = `Nenávratný finančný príspevok – ${SHORT[r.winner_ico]||r.winner_name} (${r.year||'?'})`;
  }
  final.sort((a,b)=>b.amount_eur-a.amount_eur);
  const rowsOut = final;

  console.log(`Mode: ${APPLY?'APPLY':'DRY-RUN'}`);
  console.log(`NFP zmluv (kandidati): ${cand.length} -> unikatnych dotacii: ${rowsOut.length}\n`);
  let sum=0;
  for(const r of rowsOut){ sum+=r.amount_eur;
    console.log(`${r.amount_eur.toLocaleString('sk').padStart(14)} EUR | ${r.year} | ${(r.program_name||'(program?)').padEnd(30)} | ${r.winner_name.slice(0,32).padEnd(32)} | ${r.project_name}`);
  }
  console.log(`\nSUCET: ${sum.toLocaleString('sk')} EUR`);
  // sanity: ziadny holy nadpis nesmie ostat ako nazov
  const bad = rowsOut.filter(r=>/^ZMLUVA O POSKYTNUT/i.test(r.project_name));
  if(bad.length) console.log(`\n!! POZOR ${bad.length} riadkov ma stale holy nadpis ako nazov`);
  else console.log('OK: ziadny holy nadpis');

  if(APPLY){
    const {error:delErr}=await supabase.from('eu_funds').delete().neq('id','00000000-0000-0000-0000-000000000000');
    if(delErr){ console.log('DELETE CHYBA',delErr.message); return; }
    const {data,error}=await supabase.from('eu_funds').insert(rowsOut).select();
    console.log(error?`INSERT CHYBA: ${error.message}`:`>> vlozenych ${data.length} riadkov`);
  }
}
run().catch(e=>console.log('FATAL',e.message));
