#!/usr/bin/env python3
"""
build_council_procedural.py — procedurálne deje zastupiteľstva MsZ Martin zo ZÁPISNÍC.

Procedurálne javy, ktoré v menovitých hlasovaniach NIE SÚ VIDNO, vyparsuje z plných
zápisníc a zapíše do public/data/council-interrupted.json.

Čo extrahuje (všetko s doslovným citátom / dohľadateľným výsledkom):
  1. PADNUTÉ KVÓRUM počas rokovania (zbor sa stal neuznášaniaschopným).
  2. STIAHNUTIE bodu z programu (poslanec navrhol vypustiť + výsledok hlasovania).
  3. Počet POZMEŇOVÁKOV (agregát; menný rozklad zámerne NIE — regex je hlučný).
Pole "chains" (pokračovania zasadnutí z hlavičiek uznesení) je ručne kurátorované
a tento skript ho LEN zachová — needetekuje ho spoľahlivo.

ARCHITEKTÚRA (dve fázy, kvôli samoaktualizácii):
  - KORPUS = scripts/zapisnice_txt/*.txt  (extrahovaný text zápisníc, VERZIOVANÝ v repe).
    Toto je stabilný zdroj. Parsovanie korpusu je deterministické, bez siete a bez PyMuPDF
    → beží v GitHub Actions cloude spoľahlivo (martin.sk blokuje datacentrové IP → timeout).
  - DOWNLOAD (iba lokálne z Macu, kde martin.sk odpovedá): stiahne nové PDF a doplní korpus.

ZÁSADA (web = transparentnosť, falošné/zmiznuté dáta = najhorší bug):
  - Skript NIKDY neprepíše dobré dáta prázdnymi/degradovanými. Ak parse vráti 0 kvór
    a 0 stiahnutí, alebo výrazne MENEJ než existujúci dataset → exit 1, nič nezapíše.
    (Práve toto zlyhalo pri prvom cloud behu: martin.sk timeoutol, 0 zápisníc, prepis prázdnom.)

Použitie:
  python3 scripts/build_council_procedural.py              # parse KORPUSU (cloud/CI, default)
  /usr/bin/python3 scripts/build_council_procedural.py --download  # LOKÁLNE: stiahni PDF + obnov korpus, potom parse
Výstup: public/data/council-interrupted.json
"""
import re, json, os, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TXT_DIR = os.path.join(ROOT, "scripts", "zapisnice_txt")        # verziovaný korpus (zdroj pravdy)
PDF_DIR = os.path.join(ROOT, "scripts", "_zapisnice_cache")     # lokálna PDF cache (gitignored)
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

# Minimá očakávané z úplného korpusu — poistka proti degradovanému zápisu.
MIN_QUORUM = 5
MIN_WITHDRAWALS = 4
MIN_TXT = 30

MES = {"januára": 1, "februára": 2, "marca": 3, "apríla": 4, "mája": 5, "júna": 6,
       "júla": 7, "augusta": 8, "septembra": 9, "októbra": 10, "novembra": 11, "decembra": 12}


# ---------- DOWNLOAD fáza (iba lokálne) ---------------------------------------
def fetch(url, timeout=60):
    import urllib.request
    req = urllib.request.Request(url, headers={"User-Agent": "turiec-pod-lupou/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def discover_pdf_ids(index_html):
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


def download_and_refresh_corpus():
    """Stiahne PDF z martin.sk a (re)extrahuje text do korpusu. Vyžaduje PyMuPDF.
    Beží LOKÁLNE z Macu — v cloude martin.sk timeoutuje (blokuje datacentrové IP)."""
    import fitz
    os.makedirs(PDF_DIR, exist_ok=True)
    os.makedirs(TXT_DIR, exist_ok=True)
    added = 0
    for yr, idx_url in ZAPIS_INDEX.items():
        try:
            html = fetch(idx_url).decode("utf-8", "replace")
        except Exception as e:
            print(f"  [WARN] index {yr}: {e}", file=sys.stderr)
            continue
        for did in discover_pdf_ids(html):
            pdf_path = os.path.join(PDF_DIR, f"{yr}_{did}.pdf")
            txt_path = os.path.join(TXT_DIR, f"{yr}_{did}.txt")
            if not (os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 5000):
                try:
                    data = fetch(FILE_ASHX.format(did))
                    with open(pdf_path, "wb") as fh:
                        fh.write(data)
                    time.sleep(0.4)
                except Exception as e:
                    print(f"  [WARN] pdf {did}: {e}", file=sys.stderr)
                    continue
            if not os.path.exists(txt_path):
                try:
                    doc = fitz.open(pdf_path)
                    text = "\n".join(p.get_text() for p in doc)
                    doc.close()
                    with open(txt_path, "w", encoding="utf-8") as fh:
                        fh.write(text)
                    added += 1
                except Exception as e:
                    print(f"  [WARN] extract {did}: {e}", file=sys.stderr)
    print(f"  korpus doplnený o {added} nových zápisníc -> {TXT_DIR}")


# ---------- PARSE fáza (cloud + lokál) ----------------------------------------
def header_date(flat):
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


# ROBUSTNÝ detektor padnutého kvóra — chytá VŠETKY formulácie, ktorými zápisnice MsZ Martin
# oznamujú neuznášaniaschopnosť. Pôvodná úzka verzia („nedostatočný počet poslancov" + pár fráz)
# PODHODNOCOVALA: od zmeny rokovacieho poriadku (27.3.2025) zápisnice píšu koniec zakaždým inak
# („nie je dostatočný/dostačujúci počet poslancov", „nebolo prítomných dosť", „prítomných 14
# poslancov"...). Starý regex našiel 4 prípady po zmene, v skutočnosti ich je 13. Doložené insiderom
# (poslanec, priamy dôkaz proti dátam) + ručným čítaním doslovných záverov všetkých 17 zápisníc.
QUORUM_HARD = re.compile(
    r"(?:"
    r"pre neuznášaniaschop|z dôvodu neuznášania\s*schop|"
    r"poslanecký zbor (?:bol|nebol)[^.]{0,30}uznášania\s*schop|"
    r"rokovanie MsZ nie je uznášaniaschop|zasadnutie MsZ nie je uznášaniaschop|"
    r"(?:nie je|neb(?:ol|olo)|nedostatočn\w+|nedostačujúc\w+|nedostatok)\s+"
    r"(?:dostatočn\w+\s+|dostačujúc\w+\s+)?počet\s+(?:prítomných\s+|prezentovaných\s+)?poslancov|"
    r"počet poslancov (?:nie je|neb(?:ol|olo))\s*(?:dostatočn\w+|dostačujúc\w+)?|"
    r"nie je dostatok (?:\w+\s+){0,2}poslancov|nebol(?:o)? prítomných dosť|"
    r"v sále (?:bolo )?prítomných 1[0-5] poslancov|prítomných (?:bolo )?1[0-5] poslancov"
    r")", re.I)
BREAKOFF = re.compile(r"(prerušen|ukončil|ukončené|ukončen|pokračovanie bude|pokračovanie zvolal)", re.I)
# Pokračovanie = zasadnutie sa dohlasovalo na ďalšom termíne (teda PRERUŠENÉ, nie definitívny koniec).
CONTINUE = re.compile(r"(pokračovanie bude|pokračovanie zvolal|pokračovať\s+\d|pokrač\w+\s+\d{1,2}\.\s*\d)", re.I)


def _sentence_around(flat, start, end, lookback=200, lookahead=240):
    a = max(0, start - lookback)
    seg_before = flat[a:start]
    cut = max(seg_before.rfind(". "), seg_before.rfind("… "), seg_before.rfind(".... "))
    begin = a + cut + 2 if cut != -1 else start
    tail = flat[end:end + lookahead]
    dot = tail.find(". ")
    stop = end + dot + 1 if dot != -1 else end + lookahead
    out = " ".join(flat[begin:stop].split())
    return re.sub(r"\s+(p|Ing|Mgr|PhDr)\.?$", "", out).strip()


def detect_quorum(flat, iso):
    # Zbieraj VŠETKY výskyty padnutého kvóra; padnuté kvórum, ktoré UKONČÍ zasadnutie, je
    # typicky posledné (záver zápisnice). Zmienky v rozprave („zbor je neuznášaniaschopný?")
    # odfiltruje podmienka BREAKOFF v okolí.
    cands = []
    for m in QUORUM_HARD.finditer(flat):
        win = flat[max(0, m.start() - 80):m.start() + 260]
        if BREAKOFF.search(win):
            cands.append((m.start(), m.end(), win))
    if not cands:
        return None
    start, end, win = cands[-1]
    low = win.lower()
    if ("nezač" in low) or ("prítomných 1" in low and "ukončen" not in low and "prerušen" not in low):
        outcome = "nezačalo"
    elif CONTINUE.search(win):
        # rokovanie sa dohlasovalo na ďalšom termíne = PRERUŠENÉ (nie definitívny koniec)
        outcome = "prerušené"
    elif "ukončil" in low or "ukončené" in low or "ukončen" in low:
        outcome = "ukončené"
    else:
        outcome = "prerušené"
    quote = _sentence_around(flat, start, end)
    return {"date": iso, "label": human(iso), "outcome": outcome, "quote": quote[:260]}


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


AMEND = re.compile(r"(pozmeňujúc\w+\s+návrh|protinávrh|pozmeňovac\w+\s+návrh|doplňujúc\w+\s+návrh)", re.I)


def parse_corpus():
    txts = sorted(f for f in os.listdir(TXT_DIR) if f.endswith(".txt")) if os.path.isdir(TXT_DIR) else []
    quorum, withdrawals, amend_total, amend_meetings = [], [], 0, 0
    seen_q = set()
    for fn in txts:
        with open(os.path.join(TXT_DIR, fn), encoding="utf-8") as fh:
            flat = " ".join(fh.read().split())
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
    return len(txts), quorum, withdrawals, amend_total, amend_meetings


def main():
    if "--download" in sys.argv:
        download_and_refresh_corpus()

    n_txt, quorum, withdrawals, amend_total, amend_meetings = parse_corpus()

    # POISTKA proti degradovanému zápisu — radšej nič nezapíš než zmazať dobré dáta.
    if n_txt < MIN_TXT or len(quorum) < MIN_QUORUM or len(withdrawals) < MIN_WITHDRAWALS:
        print(f"[ABORT] Korpus/parse pod minimom (txt={n_txt}/{MIN_TXT}, "
              f"kvórum={len(quorum)}/{MIN_QUORUM}, stiahnutia={len(withdrawals)}/{MIN_WITHDRAWALS}). "
              f"Nič sa nezapisuje, aby sa neprepísali dobré dáta prázdnymi.", file=sys.stderr)
        sys.exit(1)

    existing = {}
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as fh:
            existing = json.load(fh)

    # chains (pokračovania) = ručne kurátorované; ak ich v súbore niet (prepísaný prázdnom),
    # obnov zo zabudovaného fallbacku.
    chains = existing.get("chains") or FALLBACK_CHAINS

    # ZOSÚLADENIE kvóra s pokračovaniami: ak v deň padnutého kvóra zasadnutie dokázateľne
    # POKRAČOVALO na ďalšom termíne (je koreňom reťaze v `chains` s neprázdnymi continuations),
    # NEBOL to definitívny koniec, ale prerušenie — aj keď minútka v ten deň píše „ukončené".
    # Kritické pre 27.3.2025 (deň prijatia Dodatku č. 4): kvórum padlo, ale dohlasovalo sa 10.4.
    # Bez tohto by sa 27.3 započítal medzi „definitívne konce po zmene pravidla" a číslo by bolo
    # o 1 nadhodnotené (opačná chyba než pôvodné podhodnotenie — rovnako neprípustná).
    continued_roots = {c["root"] for c in chains if c.get("continuations")}
    for qf in quorum:
        if qf["date"] in continued_roots and qf["outcome"] != "prerušené":
            qf["outcome"] = "prerušené"

    data = {
        "generated_note": "Zdroj: hlavičky uznesení MsZ Martin (martin.sk). Prerušené = zasadnutie "
                          "sa nedokončilo v jeden deň a muselo pokračovať na ďalšom termíne.",
        "generated_at": time.strftime("%Y-%m-%d"),
        "interruptedMeetings": existing.get("interruptedMeetings", 6),
        "continuationDays": existing.get("continuationDays", 11),
        "scheduledMeetings": existing.get("scheduledMeetings", 36),
        "chains": chains,
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
    print(f"  zápisníc v korpuse:    {n_txt}")
    print(f"  padnuté kvórum:        {len(quorum)}")
    print(f"  stiahnutia bodu:       {len(withdrawals)}")
    print(f"  pozmeňováky (agregát): {amend_total} v {amend_meetings} zasadnutiach")


# Ručne overené pokračovania (chains) — záložná kópia, ak sa JSON prepíše prázdnom.
FALLBACK_CHAINS = [
    {"root": "2023-04-27", "label": "Zasadnutie 27. apríl 2023", "continuations": ["2023-05-25"],
     "src": "https://www.martin.sk/uznesenia-zastupitelstva-2023/ds-2418",
     "note": "Rokovanie sa dokončilo až 25.5.2023."},
    {"root": "2023-11-30", "label": "Zasadnutie 30. november 2023", "continuations": ["2023-12-21"],
     "src": "https://www.martin.sk/uznesenia-zastupitelstva-2023/ds-2418",
     "note": "Rokovanie sa dokončilo až 21.12.2023."},
    {"root": "2024-04-25", "label": "Zasadnutie 25. apríl 2024",
     "continuations": ["2024-05-30", "2024-06-20", "2024-07-11"],
     "src": "https://www.martin.sk/uznesenia-zastupitelstva-2024/ds-2501",
     "note": "Najdlhšia kaskáda: dokončené až na troch ďalších termínoch (30.5. → 20.6. → 11.7.2024)."},
    {"root": "2024-09-26", "label": "Zasadnutie 26. september 2024",
     "continuations": ["2024-10-24", "2024-11-28", "2024-12-05"],
     "src": "https://www.martin.sk/uznesenia-zastupitelstva-2024/ds-2501",
     "note": "Druhá dlhá kaskáda: dokončené až na troch ďalších termínoch (24.10. → 28.11. → 5.12.2024)."},
    {"root": "2024-12-19", "label": "Zasadnutie 19. december 2024",
     "continuations": ["2025-01-30", "2025-02-27"],
     "src": "https://www.martin.sk/uznesenia-zastupitelstva-2025/ds-2557",
     "note": "Dokončené až vo februári 2025 (30.1. → 27.2.2025)."},
    {"root": "2025-03-27", "label": "Zasadnutie 27. marec 2025", "continuations": ["2025-04-10"],
     "src": "https://www.martin.sk/uznesenia-zastupitelstva-2025/ds-2557",
     "note": "Rokovanie sa dokončilo až 10.4.2025."},
]


if __name__ == "__main__":
    main()
