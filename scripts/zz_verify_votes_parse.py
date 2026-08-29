#!/usr/bin/env python3
# KRIZOVE OVERENIE: parsed hlasy per HLASOVANIE (hlas_no) MUSIA sediet s vlastnym suctom v PDF.
import fitz, re, sys
from collections import Counter
from parse_msz_votes import parse

pdf = sys.argv[1]
recs, issues = parse(pdf, "2000-01-01", "x")

# zoskup parsed podla _hlas_no (unikatne per hlasovanie/strana)
by_hlas = {}
for r in recs:
    by_hlas.setdefault(r["_hlas_no"], Counter())[r["vote_cast"]] += 1

# vytiahni PDF vlastne sucty per strana (kluc = Výsledok hlasovania č. N)
doc = fitz.open(pdf)
mismatches = 0
checked = 0
for page in doc:
    t = page.get_text()
    mh = re.search(r"Výsledok hlasovania č\.\s*(\d+)", t)
    if not mh:
        continue
    hlas_no = mh.group(1)
    if hlas_no not in by_hlas:
        continue
    za = re.search(r"ZA:\s*(\d+)", t)
    proti = re.search(r"PROTI:\s*(\d+)", t)
    zdrz = re.search(r"ZDRŽALO SA:\s*(\d+)", t)
    nehl = re.search(r"NEHLASOVALO:\s*(\d+)", t)
    nepr = re.search(r"NEPRÍTOMNÝCH:\s*(\d+)", t)
    c = by_hlas[hlas_no]
    checked += 1
    pdf_counts = {
        "ZA": int(za.group(1)) if za else 0,
        "PROTI": int(proti.group(1)) if proti else 0,
        "ZDRŽAL SA": int(zdrz.group(1)) if zdrz else 0,
        "NEHLASOVAL": int(nehl.group(1)) if nehl else 0,
        "NEPRÍTOMNÝ": int(nepr.group(1)) if nepr else 0,
    }
    for k,v in pdf_counts.items():
        if c.get(k,0) != v:
            print(f"NESEDI hlas#{hlas_no} {k}: parsed={c.get(k,0)} pdf={v}")
            mismatches += 1

print(f"\nOverenych hlasovani (s PDF suctom): {checked} | zaznamov: {len(recs)}")
print("VSETKO SEDI" if mismatches==0 else f"NEZHOD: {mismatches}")
