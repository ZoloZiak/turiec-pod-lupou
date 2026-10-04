#!/usr/bin/env python3
# Extrahuje PLNE nazvy bodov z H.E.R. PDF (nazov zalomeny cez viac riadkov).
# Vystup: mapa kluc -> full_title. Kluc = "DATUM|UZN" a zaroven "DATUM|hNO".
# Spustaj z korena projektu: /usr/bin/python3 scripts/zz_extract_titles.py
import fitz, re, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
cache = os.path.join(HERE, "_titlepdf")
STOP = re.compile(r"^\(\s*Pozn|^Zasadnutie č|^Dňa\s|^Riadok$|^Karta$|^Mesto MARTIN|^Výsledok hlasovania$|^\d+/\d+$|^file:///")

def norm_uzn(u):
    if not u: return None
    return re.sub(r"/(\d{2})$", r"/20\1", u)

def extract(pdf_path, date):
    doc = fitz.open(pdf_path)
    out = {}
    for page in doc:
        lines = [l.strip() for l in page.get_text().split("\n") if l.strip()]
        hlas_no = None; uzn = None; title = None
        for i, l in enumerate(lines):
            mh = re.search(r"Výsledok hlasovania č\.\s*(\d+)\s*-\s*bod č\.\s*([\dA-Za-z\.\)]+)\s*[-–]\s*(.+)$", l)
            if mh and title is None:
                hlas_no = mh.group(1)
                parts = [mh.group(3).strip()]
                j = i + 1
                while j < len(lines) and not STOP.match(lines[j]):
                    parts.append(lines[j]); j += 1
                    if j - i > 6: break
                title = " ".join(parts).strip()
            mu = re.search(r"[Uu]znesenie[\s\-]*(?:uznesenie\s*)?č\.\s*(\d+/\d+)", l)
            if mu and uzn is None:
                uzn = norm_uzn(mu.group(1))
        if title:
            if uzn: out[f"{date}|{uzn}"] = title
            if hlas_no: out[f"{date}|h{hlas_no}"] = title
    return out

allmap = {}
for fn in sorted(os.listdir(cache)):
    if not fn.endswith(".pdf"): continue
    date = fn[:10]  # "YYYY-MM-DD" aj pri suboroch "YYYY-MM-DD__2.pdf"
    try:
        m = extract(os.path.join(cache, fn), date)
        allmap.update(m)
    except Exception as e:
        print("ERR", fn, type(e).__name__, e, file=sys.stderr)

json.dump(allmap, open(os.path.join(HERE, "_fulltitles.json"),"w",encoding="utf-8"), ensure_ascii=False, indent=0)
print("extrahovanych klucov:", len(allmap))
# ukazka danovych
for k in sorted(allmap):
    if "2023-10-26" in k:
        print(" ", k, "->", allmap[k][:90])
