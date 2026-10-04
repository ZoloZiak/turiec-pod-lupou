#!/usr/bin/env python3
"""
build_council_procedural.py — procedurálne deje zastupiteľstva MsZ Martin zo ZÁPISNÍC.

Jeden reprodukovateľný krok: stiahne zápisnice (PDF) z martin.sk, vyparsuje z nich
procedurálne javy, ktoré v menovitých hlasovaniach NIE SÚ VIDNO, a zapíše
public/data/council-interrupted.json.

Čo extrahuje (všetko s doslovným citátom / dohľadateľným výsledkom):
  1. PADNUTÉ KVÓRUM počas rokovania (zbor sa stal neuznášaniaschopným).
  2. STIAHNUTIE bodu z programu (poslanec navrhol vypustiť + výsledok hlasovania).
  3. POKRAČOVANIA (zasadnutie sa nedokončilo v jeden deň — z uznesení aj zápisníc).

ZÁSADA (web = transparentnosť, falošné obvinenie je najhorší bug):
  - Tvrdíme len to, čo je doslovne v zápisnici. Pri každom zázname je citát / kontext.
  - Nevyčísľujeme menný rebríček pozmeňovákov (regex je príliš hlučný) — len agregát.

Použitie:
  /usr/bin/python3 scripts/build_council_procedural.py            # plný beh (download + parse)
  /usr/bin/python3 scripts/build_council_procedural.py --cached   # len parse už stiahnutých PDF
Výstup: public/data/council-interrupted.json
Pozn.: vyžaduje PyMuPDF (fitz). Beží mimo Next.js (Python), spúšťa sa cronom / Actions.
"""
import fitz, re, json, os, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_DIR = os.path.join(ROOT, "scripts", "_zapisnice_cache")
OUT = os.path.join(ROOT, "public", "data", "council-interrupted.json")

FILE_ASHX = "https://www.martin.sk/assets/File.ashx?id_org=700031&id_dokumenty={}"
# Ročné indexy zápisníc (ds-NNNN). Doplň nový rok sem — jediné miesto.
ZAPIS_INDEX = {
    "2023": "https://www.martin.sk/zapisnice-z-rokovani-mestskeho-zastupitelstva-2023/ds-2420/archiv=0",
    "2024": "https://www.martin.sk/zapisnice-z-rokovani-mestskeho-zastupitelstva-2024/ds-2503/archiv=0",
    "2025": "https://www.martin.sk/zapisnice-z-rokovani-mestskeho-zastupitelstva-2025/ds-2556/archiv=0",
    "2026": "https://www.martin.sk/zapisnice-z-rokovani-mestskeho-zastupitelstva-2026/ds-2613/archiv=0",
}
ZAPIS_SRC = "https://www.martin.sk/zapisnice/ds-1012"

MES = {"januára": 1, "februára": 2, "marca": 3, "apríla": 4, "mája": 5, "júna": 6,
       "júla": 7, "augusta": 8, "septembra": 9, "októbra": 10, "novembra": 11, "decembra": 12}


def fetch(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": "turiec-pod-lupou/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def discover_pdf_ids(index_html):
    """Z HTML indexu vytiahni (id_dokumenty) zápisníc."""
    ids = []
    for href, label in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', index_html, re.S):
        if "file.ashx" not in href.lower():
            continue
        txt = re.sub(r"<[^>]+>", "", label).strip().lower()
        if "apisnic" in txt or "msz" in txt or "mz " in txt:
            m = re.search(r"id_dokumenty=(\d+)", href)
            if m:
                ids.append(m.group(1))
    return ids


def pdf_text(path):
    doc = fitz.open(path)
    t = "\n".join(p.get_text() for p in doc)
    doc.close()
    return t


def header_date(flat):
    """ISO dátum konania z hlavičky (prvých ~400 znakov)."""
    h = flat[:400]
    m = re.search(r"konan\w+\s+(?:dňa\s+)?(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})", h)
    if m:
        return f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"
    m = re.search(r"konan\w+\s+(?:dňa\s+)?(\d{1,2})\.\s*(" + "|".join(MES) + r")\s*(\d{4})", h)
    if m:
        return f"{m.group(3)}-{MES[m.group(2)]:02d}-{int(m.group(1)):02d}"
    return None


def human(iso):
    if not iso:
        return "?"
    y, m, d = iso.split("-")
    names = ["", "január", "február", "marec", "apríl", "máj", "jún", "júl",
             "august", "september", "október", "november", "december"]
    return f"{int(d)}. {names[int(m)]} {y}"


# ---- detekcia padnutého kvóra -------------------------------------------------
QUORUM_HARD = re.compile(
    r"(pre neuznášaniaschop|z dôvodu neuznášania\s*schop|nedostatočný počet poslancov|"
    r"nebolo prítomných dosť|neb(?:ol|olo)[^.]{0,30}uznášaniaschop|"
    r"poslanecký zbor (?:bol|nebol)[^.]{0,30}uznášania\s*schop|"
    r"zasadnutie MsZ nie je uznášaniaschop|rokovanie MsZ nie je uznášaniaschop)", re.I)
BREAKOFF = re.compile(r"(prerušen|ukončil|ukončené|pokračovanie bude|pokračovanie zvolal)", re.I)


def _sentence_around(flat, start, end, lookback=200, lookahead=240):
    """Vyrež citát od začiatku vety (po poslednej '. '/'… ' pred start) po koniec vety."""
    a = max(0, start - lookback)
    seg_before = flat[a:start]
    # posledný oddeľovač vety pred frázou
    cut = max(seg_before.rfind(". "), seg_before.rfind("… "), seg_before.rfind(".... "))
    begin = a + cut + 2 if cut != -1 else start
    tail = flat[end:end + lookahead]
    dot = tail.find(". ")
    stop = end + dot + 1 if dot != -1 else end + lookahead
    out = " ".join(flat[begin:stop].split())
    return re.sub(r"\s+(p|Ing|Mgr|PhDr)\.?$", "", out).strip()


def detect_quorum(flat, iso):
    for m in QUORUM_HARD.finditer(flat):
        win = flat[max(0, m.start() - 70):m.start() + 240]
        if not BREAKOFF.search(win):
            continue
        low = win.lower()
        if "nezač" in low or ("14 posl" in low) or ("prítomných 1" in low and "ukončen" not in low and "prerušen" not in low):
            outcome = "nezačalo"
        elif "ukončil" in low or "ukončené" in low:
            outcome = "ukončené"
        else:
            outcome = "prerušené"
        quote = _sentence_around(flat, m.start(), m.end())
        return {"date": iso, "label": human(iso), "outcome": outcome, "quote": quote[:260]}
    return None


# ---- stiahnutie bodu z programu ----------------------------------------------
WITHDRAW = re.compile(
    r"(?:p\.|Ing\.|Mgr\.|PhDr\.)\s*([A-ZŽŠČ][a-zžščťáíéúäöôľ]+)\s*[-–]\s*(?:navrhol|navrhla)\s*"
    r"(?:stiahn\w+|vypust\w+|vyradi\w+|vyňa\w+)\s+(?:z programu\s+)?(?:z rokovania\s+)?"
    r"(bod[^.–]{0,45}|[^.–]{0,45})", re.I)
WITHDRAW_RES = re.compile(r"(nebol\s+schválen|bol\s+stiahnut|bol\s+schválen)", re.I)


def detect_withdrawals(flat, iso):
    out = []
    for m in WITHDRAW.finditer(flat):
        after = flat[m.end():m.end() + 90]
        rm = WITHDRAW_RES.search(after)
        if not rm:
            continue
        g = rm.group(0).lower()
        outcome = "neprešlo" if "nebol" in g else "prešlo"
        what = re.sub(r"\s+", " ", m.group(2)).strip(" -–")
        quote = _sentence_around(flat, m.start(), m.end() + rm.end(), lookback=10, lookahead=20)
        out.append({"date": iso, "who": m.group(1).strip(), "what": what[:60],
                    "outcome": outcome, "quote": quote[:200]})
    return out


# ---- pozmeňováky (len agregát) -----------------------------------------------
AMEND = re.compile(r"(pozmeňujúc\w+\s+návrh|protinávrh|pozmeňovac\w+\s+návrh|doplňujúc\w+\s+návrh)", re.I)


def main():
    cached = "--cached" in sys.argv
    os.makedirs(PDF_DIR, exist_ok=True)

    # 1) zisti/stiahni PDF
    pdfs = []
    if cached:
        pdfs = [os.path.join(PDF_DIR, f) for f in sorted(os.listdir(PDF_DIR)) if f.endswith(".pdf")]
    else:
        for yr, idx_url in ZAPIS_INDEX.items():
            try:
                html = fetch(idx_url).decode("utf-8", "replace")
            except Exception as e:
                print(f"  [WARN] index {yr}: {e}", file=sys.stderr)
                continue
            for did in discover_pdf_ids(html):
                path = os.path.join(PDF_DIR, f"{yr}_{did}.pdf")
                if not (os.path.exists(path) and os.path.getsize(path) > 5000):
                    try:
                        data = fetch(FILE_ASHX.format(did))
                        with open(path, "wb") as fh:
                            fh.write(data)
                        time.sleep(0.4)  # šetrný k serveru
                    except Exception as e:
                        print(f"  [WARN] pdf {did}: {e}", file=sys.stderr)
                        continue
                pdfs.append(path)

    # 2) parse
    quorum, withdrawals, amend_total, amend_meetings = [], [], 0, 0
    seen_q = set()
    for p in pdfs:
        try:
            flat = " ".join(pdf_text(p).split())
        except Exception as e:
            print(f"  [WARN] read {p}: {e}", file=sys.stderr)
            continue
        iso = header_date(flat)
        q = detect_quorum(flat, iso)
        if q and iso not in seen_q:
            seen_q.add(iso)
            quorum.append(q)
        withdrawals.extend(detect_withdrawals(flat, iso))
        a = len(AMEND.findall(flat))
        if a:
            amend_total += a
            amend_meetings += 1

    quorum.sort(key=lambda x: x["date"] or "")
    withdrawals.sort(key=lambda x: x["date"] or "")

    # 3) zlúč s existujúcimi ručne overenými "chains" (pokračovania) — tie needetekuje
    #    tento parser spoľahlivo pre každý rok, preto ich držíme ako kurátorovaný zoznam.
    existing = {}
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as fh:
            existing = json.load(fh)

    data = {
        "generated_note": existing.get("generated_note",
            "Zdroj: hlavičky uznesení MsZ Martin (martin.sk). Prerušené = zasadnutie sa "
            "nedokončilo v jeden deň a muselo pokračovať na ďalšom termíne."),
        "generated_at": time.strftime("%Y-%m-%d"),
        "interruptedMeetings": existing.get("interruptedMeetings", 6),
        "continuationDays": existing.get("continuationDays", 11),
        "scheduledMeetings": existing.get("scheduledMeetings", 36),
        "chains": existing.get("chains", []),
        "quorumNote": "Zdroj: zápisnice z rokovaní MsZ Martin (martin.sk). Padnuté kvórum = "
                      "počas rokovania klesol počet prítomných poslancov pod uznášaniaschopnosť, "
                      "takže sa už nedalo hlasovať. Každý prípad je doslovný citát zo zápisnice.",
        "quorumSrc": ZAPIS_SRC,
        "quorumFailures": quorum,
        "withdrawalsNote": "Pokus vypustiť bod z programu na začiatku rokovania (zo zápisníc). "
                           "„neprešlo“ = bod ostal v programe, „prešlo“ = bod bol stiahnutý.",
        "withdrawals": withdrawals,
        "amendmentsTotal": amend_total,
        "amendmentsMeetings": amend_meetings,
        "amendmentsNote": "Počet pozmeňujúcich/protinávrhov v rozprave naprieč zápisnicami "
                          "(agregát; menný rozklad zámerne neuvádzame, aby nevznikli nepresné tvrdenia).",
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)

    print(f"OK -> {OUT}")
    print(f"  zápisníc spracovaných: {len(pdfs)}")
    print(f"  padnuté kvórum:        {len(quorum)}")
    print(f"  stiahnutia bodu:       {len(withdrawals)}")
    print(f"  pozmeňováky (agregát): {amend_total} v {amend_meetings} zasadnutiach")


if __name__ == "__main__":
    main()
