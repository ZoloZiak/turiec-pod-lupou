#!/usr/bin/env node
// WATCH #289 (cursor=287, oblast "jedna stranka" -> /dramy). READ-ONLY.
// Over vnutornu konzistenciu contested.json + dramy rollcall + zhodu prahovych poli
// s council-votes.json (zdroj pravdy). Hlada regresiu ETL (zz_enrich_contested.py
// (d,null) dict kolizia -> VZN riadky dedia prah z nespravneho hlasovania).
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const contested = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/council-contested.json"), "utf8"));
const dramas = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/council-dramas.json"), "utf8"));
const cv = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/council-votes.json"), "utf8"));
const votings = cv.votings;

// index votes jednoznacne (ako fix): (d,u) ak unikatne -> (d,za,proti,zdrzal) -> +nehl.
const keyCount = {};
for (const v of votings) {
  const k = v.d + "|" + (v.u ?? "NULL");
  keyCount[k] = (keyCount[k] || 0) + 1;
}
function matchVoting(c) {
  if (c.u != null) {
    const byU = votings.filter(v => v.d === c.d && v.u === c.u);
    if (byU.length === 1) return byU[0];
  }
  let cand = votings.filter(v => v.d === c.d && v.za === c.za && v.proti === c.proti && v.zdrzal === c.zdrzal);
  if (cand.length === 1) return cand[0];
  if (cand.length > 1 && typeof c.nehl === "number") {
    const byN = cand.filter(v => v.nehl === c.nehl);
    if (byN.length === 1) return byN[0];
  }
  if (cand.length > 1) {
    const uniq = new Set(cand.map(v => `${v.za + v.proti + v.zdrzal + v.nehl}|${v.nd}|${v.rl}|${v.p}|${v.nehl}`));
    if (uniq.size === 1) return cand[0];
  }
  return null;
}

function expectedThreshold(za, proti, zdrzal, nehl, rule) {
  const present = za + proti + zdrzal + nehl;
  if (present === 0) return null;
  let need, ok;
  if (rule === "vzn_3_5") {
    need = Math.ceil((3 / 5) * present);
    ok = za >= need && za > proti;
  } else {
    need = Math.floor(present / 2) + 1;
    ok = za >= need && za >= proti;
  }
  return { present, need, ok };
}

console.log("=== A) CONTESTED: vnutorna konzistencia + zhoda s council-votes.json ===");
let problems = 0;
contested.forEach((c, i) => {
  const flags = [];
  const key = c.d + "|" + (c.u ?? "NULL");
  const src = matchVoting(c);

  // 1) prah polia pritomne?
  const hasThr = typeof c.pr === "number" && typeof c.nd === "number" && typeof c.passed === "boolean";
  if (!hasThr) { flags.push("CHYBA prahove polia"); }

  // 2) nd konzistentne s rl + pr (prepocet z ulozeneho pr a rl)
  if (hasThr && c.rl) {
    const ndVzn = Math.ceil((3 / 5) * c.pr);
    const ndNad = Math.floor(c.pr / 2) + 1;
    const ndExp = c.rl === "vzn_3_5" ? ndVzn : ndNad;
    if (c.nd !== ndExp) {
      flags.push(`nd=${c.nd} NESEDI s rl=${c.rl}@pr=${c.pr} (ocak ${ndExp}; vzn=${ndVzn}/nad=${ndNad})`);
    }
  }

  // 3) zhoda prahu so zdrojom council-votes.json
  if (src) {
    // pr ma byt za+proti+zdrzal+nehl zdroja
    const srcPresent = src.za + src.proti + src.zdrzal + src.nehl;
    if (hasThr && c.pr !== srcPresent) flags.push(`pr=${c.pr} != zdroj present ${srcPresent}`);
    if (hasThr && typeof src.nd === "number" && c.nd !== src.nd) flags.push(`nd=${c.nd} != zdroj nd ${src.nd}`);
    if (hasThr && typeof src.rl === "string" && c.rl !== src.rl) flags.push(`rl=${c.rl} != zdroj rl ${src.rl}`);
    // suma za/proti contested vs zdroj
    if (c.za !== src.za || c.proti !== src.proti) flags.push(`za/proti contested ${c.za}/${c.proti} != zdroj ${src.za}/${src.proti}`);
  } else {
    flags.push(`ZIADNY zdroj v council-votes.json pre kluc ${key}`);
  }

  // 4) is_vzn podla nazvu vs pouzite rl
  const title = (c.full || c.t || "").toLowerCase();
  const looksVzn = /\bvzn\b|nariaden|dodat\w*\s*(č\.?\s*\d+\s*)?k?\s*vzn|k\s*vzn/.test(title);
  if (hasThr && looksVzn && c.rl !== "vzn_3_5") flags.push(`NAZOV je VZN ale rl=${c.rl} (malo byt vzn_3_5)`);
  if (hasThr && !looksVzn && c.rl === "vzn_3_5") flags.push(`rl=vzn_3_5 ale nazov nevyzera ako VZN`);

  if (flags.length) {
    problems++;
    console.log(`\n[#${i}] ${c.d} u=${c.u} za=${c.za} proti=${c.proti} zdrzal=${c.zdrzal} nehl=${c.nehl} pr=${c.pr} nd=${c.nd} rl=${c.rl} passed=${c.passed}`);
    console.log(`     "${(c.full || c.t).slice(0, 80)}"`);
    flags.forEach(f => console.log("     !! " + f));
    if (src) console.log(`     zdroj: d=${src.d} u=${src.u} za=${src.za} proti=${src.proti} zdrzal=${src.zdrzal} nehl=${src.nehl} pr=${src.pr} nd=${src.nd} rl=${src.rl} p=${src.p} t="${(src.t||"").slice(0,50)}"`);
  }
});
console.log(`\n>> CONTESTED: ${contested.length} riadkov, ${problems} s problemom`);

console.log("\n=== B) council-votes.json: vsetky hlasovania 2025-12-18 ===");
votings.filter(v => v.d === "2025-12-18").forEach(v => {
  console.log(`  n=${v.n} u=${v.u} za=${v.za} proti=${v.proti} zdrzal=${v.zdrzal} nehl=${v.nehl} nepr=${v.nepr} pr=${v.pr} nd=${v.nd} rl=${v.rl} p=${v.p}`);
  console.log(`     t="${v.t}"`);
});

console.log("\n=== C) DRAMY rollcall konzistencia ===");
dramas.forEach(d => {
  d.votes.forEach((vt, vi) => {
    const col = vi === 0 ? "v1" : "v2";
    let za = 0, proti = 0, abs = 0, nep = 0;
    d.rollcall.forEach(r => {
      const val = r[col];
      if (val === "ZA") za++;
      else if (val === "PROTI") proti++;
      else if (val === "ZDRŽAL" || val === "ZDRŽAL SA") abs++;
      else if (val === "NEPRÍTOMNÝ") nep++;
    });
    const ok = za === vt.za && proti === vt.proti;
    console.log(`  ${d.slug} ${vt.date} rollcall(${col}): ZA=${za} PROTI=${proti} ABS=${abs} NEPR=${nep} | hlavicka ZA=${vt.za} PROTI=${vt.proti} nepr=${vt.nepritomny} => ${ok ? "OK" : "!! NESEDI"}`);
  });
  // changed flag konzistencia
  d.rollcall.forEach(r => {
    const chg = r.v1 !== r.v2;
    if (chg !== r.changed) console.log(`  !! ${r.name}: changed=${r.changed} ale v1=${r.v1} v2=${r.v2}`);
  });
});
