#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
classify_income.py — klasifikuje CRZ kandidatske zmluvy cez Opus (Palantir)
na INCOME / EXPENSE / UNSURE. Resumovatelne.

Vstup:  .audit/income_candidates.json  (pole {id, amount_eur, buyer, supplier, subject, url})
Vystup: .audit/income_verdicts.json    (pole {id, verdict, reason, amount_eur, subject})

Spustaj:  VPY=/Users/ziak.z/.local/share/uv/tools/vmlx/bin/python
          $VPY scripts/classify_income.py
"""
import os, sys, json, html

sys.path.insert(0, "/Users/ziak.z/zolo2.0/toolkit")
from palantir_client import chat

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAND = os.path.join(ROOT, ".audit", "income_candidates.json")
OUT  = os.path.join(ROOT, ".audit", "income_verdicts.json")
BATCH = 15

SYSTEM = """Si audit klasifikator zmluv z Centralneho registra zmluv SR pre transparentnostny web o meste Martin.

KONTEXT: CRZ scraper VZDY oznacuje mesto/mestsku organizaciu ako odberatela (buyer) a druhu stranu ako dodavatela (supplier). To je pri dotaciach NESPRAVNE. Tvojou ulohou je urcit skutocny SMER penazi z pohladu MESTA (a jeho organizacii ako Dopravny podnik mesta Martin, OOCR Turiec at.).

Klasifikuj KAZDU zmluvu do jednej z troch kategorii:

- INCOME = subjekt (mesto/jeho organizacia) DOSTAVA peniaze. Typicky: nenavratny financny prispevok (NFP), dotacia, grant, prispevok OD ministerstva / SIEA / SAZP / uradu prace / vyssieho uzemneho celku (kraj) / agentury / Environmentalneho fondu / Planu obnovy / EFRR / ITI. Penize idu DO rozpoctu mesta -> smer +.

- EXPENSE = subjekt PLATI / vydava peniaze. Bezna dodavatelska zmluva. Aj ked obsahuje slovo "prispevok", ale MESTO ho DAVA niekomu inemu (napr. prispevok mesta neverejnemu poskytovatelovi socialnej sluzby, prispevok obcanovi, prispevok organizacii, prispevok inej obci). Penize idu Z rozpoctu von.

- UNSURE = z predmetu sa neda jednoznacne urcit smer.

DOLEZITE ROZLISENIE pri slove "prispevok":
* Ak DAVATEL je ministerstvo/agentura/urad/kraj a PRIJIMATEL je mesto -> INCOME.
* Ak DAVATEL je mesto a PRIJIMATEL je n.o./o.z./obcan/ina obec/poskytovatel sluzby -> EXPENSE.
* Pozor na buyer/supplier: su casto prehodene. Riad sa PREDMETOM (subject) a logikou kto komu plati, nie mechanicky poziciou buyer/supplier.

NEHALUCINUJ. Ak subject nestaci na jednoznacne urcenie, daj UNSURE.

Odpovedz VYHRADNE validnym JSON polom, ziadny text navyse:
[{"id":"<id>","verdict":"INCOME|EXPENSE|UNSURE","reason":"<kratke zdovodnenie po slovensky>"}]"""


def clean(s):
    if not s:
        return ""
    return html.unescape(str(s)).replace("\n", " ").strip()


def build_prompt(batch):
    lines = ["Klasifikuj tychto {} zmluv. Pre kazdu vrat objekt s id, verdict, reason.\n".format(len(batch))]
    for c in batch:
        lines.append(json.dumps({
            "id": c["id"],
            "amount_eur": c.get("amount_eur"),
            "buyer": clean(c.get("buyer")),
            "supplier": clean(c.get("supplier")),
            "subject": clean(c.get("subject")),
        }, ensure_ascii=False))
    return "\n".join(lines)


def parse_json(txt):
    txt = txt.strip()
    # odstran markdown fence
    if txt.startswith("```"):
        txt = txt.split("```", 2)[1] if "```" in txt[3:] else txt
        txt = txt.lstrip("json").lstrip()
        if txt.endswith("```"):
            txt = txt[:-3]
    # najdi prve [ a posledne ]
    a = txt.find("[")
    b = txt.rfind("]")
    if a == -1 or b == -1:
        raise ValueError("ziadne JSON pole v odpovedi: " + txt[:200])
    return json.loads(txt[a:b + 1])


def main():
    with open(CAND, encoding="utf-8") as f:
        cands = json.load(f)
    by_id = {c["id"]: c for c in cands}

    done = {}
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as f:
            for v in json.load(f):
                done[v["id"]] = v
        print("Resume: uz mam {} verdiktov".format(len(done)))

    todo = [c for c in cands if c["id"] not in done]
    print("Spolu kandidatov: {}, na spracovanie: {}".format(len(cands), len(todo)))

    for i in range(0, len(todo), BATCH):
        batch = todo[i:i + BATCH]
        print("Davka {}-{} ...".format(i + 1, i + len(batch)), flush=True)
        prompt = build_prompt(batch)
        resp = chat(prompt, model="opus", max_tokens=1600, system=SYSTEM)
        try:
            parsed = parse_json(resp)
        except Exception as e:
            print("  CHYBA parse: {}".format(e))
            print("  RAW:", resp[:500])
            raise
        got = {p["id"] for p in parsed}
        for p in parsed:
            cid = p["id"]
            if cid not in by_id:
                continue
            c = by_id[cid]
            done[cid] = {
                "id": cid,
                "verdict": p.get("verdict", "UNSURE"),
                "reason": p.get("reason", ""),
                "amount_eur": c.get("amount_eur"),
                "subject": clean(c.get("subject")),
                "buyer": clean(c.get("buyer")),
                "supplier": clean(c.get("supplier")),
                "url": c.get("url"),
            }
        # zmesk id ktore Opus nevratil
        for c in batch:
            if c["id"] not in got:
                print("  POZOR: id {} chyba v odpovedi -> UNSURE".format(c["id"]))
                done[c["id"]] = {
                    "id": c["id"], "verdict": "UNSURE",
                    "reason": "model nevratil verdikt pre tuto zmluvu",
                    "amount_eur": c.get("amount_eur"),
                    "subject": clean(c.get("subject")),
                    "buyer": clean(c.get("buyer")),
                    "supplier": clean(c.get("supplier")),
                    "url": c.get("url"),
                }
        # ulozit priebezne (resumovatelne)
        with open(OUT, "w", encoding="utf-8") as f:
            json.dump(list(done.values()), f, ensure_ascii=False, indent=2)

    verdicts = list(done.values())
    counts = {"INCOME": 0, "EXPENSE": 0, "UNSURE": 0}
    for v in verdicts:
        counts[v["verdict"]] = counts.get(v["verdict"], 0) + 1
    print("\n=== HOTOVO ===")
    print("INCOME : {}".format(counts.get("INCOME", 0)))
    print("EXPENSE: {}".format(counts.get("EXPENSE", 0)))
    print("UNSURE : {}".format(counts.get("UNSURE", 0)))
    print("Ulozene do: {}".format(OUT))


if __name__ == "__main__":
    main()
