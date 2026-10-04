#!/usr/bin/env node
// FIX WATCH #289: oprav prahove polia (pr/nd/rl/passed/nehl) v council-contested.json.
// KOREN CHYBY: zz_enrich_contested.py paruje cez (d,u); pri u=null alebo viacerych
// pod-hlasovaniach jedneho uznesenia kluc koliduje -> contested riadok zdedi prah z
// NESPRAVNEHO hlasovania (napr. VZN 130/131 dostali rl=nadpolovicna namiesto vzn_3_5).
//
// Kaskadove parovanie (jednoznacne):
//   1) ak c.u != null a existuje PRAVE JEDEN voting s (d,u) -> ten
//   2) inak filter (d, za, proti, zdrzal); ak prave jeden -> ten
//   3) inak + nehl; ak prave jeden -> ten
//   4) inak NEJEDNOZNACNE -> LOG + NECHAJ povodne (nic sa nevymysla)
// Prepisuje LEN prahove polia, NEDOTYKA sa t/full/desc/za/proti/zdrzal/tags/margin/s.
// Idempotentny. Dry-run default; --apply zapise.
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const CON = path.join(ROOT, "src/data/council-contested.json");
const APPLY = process.argv.includes("--apply");

const contested = JSON.parse(fs.readFileSync(CON, "utf8"));
const cv = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/council-votes.json"), "utf8"));
const V = cv.votings;

function pick(c) {
  // 1) (d,u) jednoznacne
  if (c.u != null) {
    const byU = V.filter(v => v.d === c.d && v.u === c.u);
    if (byU.length === 1) return byU[0];
  }
  // 2) (d, za, proti, zdrzal)
  let cand = V.filter(v => v.d === c.d && v.za === c.za && v.proti === c.proti && v.zdrzal === c.zdrzal);
  if (cand.length === 1) return cand[0];
  // 3) + nehl (ak contested ma nehl)
  if (cand.length > 1 && typeof c.nehl === "number") {
    const byN = cand.filter(v => v.nehl === c.nehl);
    if (byN.length === 1) return byN[0];
  }
  // ak viac kandidatov ma IDENTICKE prahove hodnoty, je jedno ktory
  if (cand.length > 1) {
    const uniq = new Set(cand.map(v => `${v.za + v.proti + v.zdrzal + v.nehl}|${v.nd}|${v.rl}|${v.p}|${v.nehl}`));
    if (uniq.size === 1) return cand[0];
  }
  return null;
}

let changed = 0, ambiguous = 0, nomatch = 0;
for (let i = 0; i < contested.length; i++) {
  const c = contested[i];
  const src = pick(c);
  if (!src) {
    if (V.some(v => v.d === c.d && v.za === c.za && v.proti === c.proti && v.zdrzal === c.zdrzal)) {
      ambiguous++;
      console.log(`[#${i}] ${c.d} u=${c.u} za=${c.za}/${c.proti}/${c.zdrzal} -> NEJEDNOZNACNE, NECHAVAM`);
    } else {
      nomatch++;
      console.log(`[#${i}] ${c.d} u=${c.u} za=${c.za}/${c.proti}/${c.zdrzal} -> BEZ ZHODY, NECHAVAM (LOG)`);
    }
    continue;
  }
  const want = {
    pr: src.za + src.proti + src.zdrzal + src.nehl,
    nd: src.nd,
    rl: src.rl,
    passed: src.p === 1,
    nehl: src.nehl,
  };
  const before = { pr: c.pr, nd: c.nd, rl: c.rl, passed: c.passed, nehl: c.nehl };
  const diff = [];
  for (const k of ["pr", "nd", "rl", "passed", "nehl"]) {
    if (before[k] !== want[k]) diff.push(`${k} ${before[k]}->${want[k]}`);
  }
  if (diff.length) {
    changed++;
    console.log(`[#${i}] ${c.d} u=${c.u} "${(c.full || c.t).slice(0, 55)}"`);
    console.log(`        ${diff.join(", ")}`);
    if (APPLY) {
      c.pr = want.pr; c.nd = want.nd; c.rl = want.rl; c.passed = want.passed; c.nehl = want.nehl;
    }
  }
}

console.log(`\n>> ${APPLY ? "APPLY" : "DRY-RUN"}: zmenenych ${changed} | nejednoznacnych ${ambiguous} | bez zhody ${nomatch}`);
if (APPLY && changed) {
  fs.writeFileSync(CON, JSON.stringify(contested, null, 2) + "\n", "utf8");
  console.log(`>> zapisane ${CON}`);
}
