#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_direction_outputs.py — z .audit/income_verdicts.json vygeneruje:
  1. database/add_direction_column.sql  (ALTER + UPDATE pre INCOME id-cka) — na rucne aplikovanie
  2. .audit/income_ids.json            (zoznam INCOME id-ciek pre UI filter fallback)

DDL prava z klienta NIE su dostupne (overene: stlpec direction neexistuje, RPC exec_sql chyba).
Preto SQL treba spustit rucne v Supabase SQL editore, ALEBO UI odfiltruje cez income_ids.json.
"""
import os, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERD = os.path.join(ROOT, ".audit", "income_verdicts.json")
SQL_OUT = os.path.join(ROOT, "database", "add_direction_column.sql")
IDS_OUT = os.path.join(ROOT, ".audit", "income_ids.json")

with open(VERD, encoding="utf-8") as f:
    verdicts = json.load(f)

income = [v for v in verdicts if v["verdict"] == "INCOME"]
income_ids = [v["id"] for v in income]

# 1. income_ids.json (fallback pre UI)
with open(IDS_OUT, "w", encoding="utf-8") as f:
    json.dump({
        "note": "INCOME transakcie (mesto/organizacia DOSTAVA peniaze - NFP/dotacia/grant). "
                "Nemaju sa zapocitavat do objemu vydavkov. Klasifikovane cez Opus (Palantir).",
        "count": len(income_ids),
        "ids": income_ids,
    }, f, ensure_ascii=False, indent=2)

# 2. SQL subor
lines = []
lines.append("-- add_direction_column.sql")
lines.append("-- Vygenerovane z .audit/income_verdicts.json (klasifikacia Opus/Palantir).")
lines.append("-- DDL prava z app klienta NIE su dostupne -> SPUSTI RUCNE v Supabase SQL editore")
lines.append("-- (Dashboard -> SQL Editor) alebo cez psql so service/db heslom.")
lines.append("--")
lines.append("-- Smer penazi z pohladu mesta: EXPENSE = mesto plati (default), INCOME = mesto dostava.")
lines.append("")
lines.append("-- 1. Pridaj stlpec direction (default EXPENSE pre vsetky existujuce zaznamy).")
lines.append("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'EXPENSE';")
lines.append("")
lines.append("-- 2. Oznac INCOME zmluvy ({} kusov).".format(len(income_ids)))
lines.append("UPDATE transactions SET direction = 'INCOME' WHERE id IN (")
for i, cid in enumerate(income_ids):
    comma = "," if i < len(income_ids) - 1 else ""
    lines.append("  '{}'{}".format(cid, comma))
lines.append(");")
lines.append("")
lines.append("-- 3. (volitelne) index pre filtrovanie podla smeru")
lines.append("CREATE INDEX IF NOT EXISTS idx_transactions_direction ON transactions(direction);")
lines.append("")
lines.append("-- Overenie po spusteni:")
lines.append("-- SELECT direction, count(*), sum(amount_eur) FROM transactions GROUP BY direction;")
lines.append("")

with open(SQL_OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print("INCOME id-ciek:", len(income_ids))
print("Zapisane:")
print(" ", SQL_OUT)
print(" ", IDS_OUT)
