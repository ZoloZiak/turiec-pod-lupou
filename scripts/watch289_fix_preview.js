#!/usr/bin/env node
// WATCH #289 FIX PREVIEW (READ-ONLY): sprav prahove polia contested.json cez
// JEDNOZNACNY kluc (d, za, proti, zdrzal) voci council-votes.json (zdroj pravdy,
// nd/rl/p vypocitane ETL podla zakona 369/1990). Ziadny zapis.
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const CON = path.join(ROOT, "src/data/council-contested.json");
const contested = JSON.parse(fs.readFileSync(CON, "utf8"));
const cv = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/council-votes.json"), "utf8"));
const votings = cv.votings;

function matchKey(d, za, proti, zdrzal) {
  return votings.filter(v => v.d === d && v.za === za && v.proti === proti && v.zdrzal === zdrzal);
}

let changes = 0, ambiguous = 0, nomatch = 0, unchanged = 0;
contested.forEach((c, i) => {
  const cands = matchKey(c.d, c.za, c.proti, c.zdrzal);
  if (cands.length === 0) {
    nomatch++;
    console.log(`[#${i}] ${c.d} za=${c.za}/${c.proti}/${c.zdrzal} -> ZIADNA zhoda v council-votes (NECHAM, LOG)`);
    return;
  }
  if (cands.length > 1) {
    // viac kandidatov s identickym za/proti/zdrzal — rozlis cez nd/rl/pr ak su rovnake je to jedno
    const uniq = new Set(cands.map(v => `${v.pr}|${v.nd}|${v.rl}|${v.p}|${v.nehl}`));
    if (uniq.size > 1) {
      ambiguous++;
      console.log(`[#${i}] ${c.d} za=${c.za}/${c.proti}/${c.zdrzal} -> ${cands.length} NEJEDNOZNACNYCH kandidatov s roznym prahom:`);
      cands.forEach(v => console.log(`        n=${v.n} u=${v.u} pr=${v.pr} nd=${v.nd} rl=${v.rl} p=${v.p} nehl=${v.nehl} t="${(v.t||"").slice(0,40)}"`));
      return;
    }
  }
  const src = cands[0];
  const want = { pr: src.za + src.proti + src.zdrzal + src.nehl, nd: src.nd, rl: src.rl, passed: src.p === 1, nehl: src.nehl };
  const diff = [];
  if (c.pr !== want.pr) diff.push(`pr ${c.pr}->${want.pr}`);
  if (c.nd !== want.nd) diff.push(`nd ${c.nd}->${want.nd}`);
  if (c.rl !== want.rl) diff.push(`rl ${c.rl}->${want.rl}`);
  if (c.passed !== want.passed) diff.push(`passed ${c.passed}->${want.passed}`);
  if ((c.nehl ?? 0) !== want.nehl) diff.push(`nehl ${c.nehl}->${want.nehl}`);
  if (diff.length) {
    changes++;
    console.log(`[#${i}] ${c.d} u=${c.u} za=${c.za}/${c.proti}/${c.zdrzal} "${(c.full||c.t).slice(0,55)}"`);
    console.log(`        ZMENA: ${diff.join(", ")}  (src n=${src.n} u=${src.u} t="${(src.t||"").slice(0,40)}")`);
  } else {
    unchanged++;
  }
});
console.log(`\n>> SUMAR: ${contested.length} riadkov | zmeni sa ${changes} | bezo zmeny ${unchanged} | nejednoznacnych ${ambiguous} | bez zhody ${nomatch}`);
