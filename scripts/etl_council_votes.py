#!/usr/bin/env python3
# ETL: menovité hlasovania MsZ Martin (H.E.R. PDF) -> public/data/council-votes.json
# ---------------------------------------------------------------------------
# Reprodukovateľné stiahnutie + parse celého volebného obdobia priamo z martin.sk.
# Poctivo: každý záznam je verný oficiálnemu PDF, krížovo overený proti vytlačenému
# súčtu (ZA/PROTI). Kompaktný výstup (33 poslancov indexovaných raz, každé hlasovanie
# = kódový reťazec) drží celú históriu (750+ hlasovaní) na ~220 KB namiesto ~10 MB.
#
# Použitie:
#   python3 scripts/etl_council_votes.py            # dry-run: parse + report, nezapíše
#   python3 scripts/etl_council_votes.py --write     # zapíše public/data/council-votes.json
#
# POZNÁMKA O POKRYTÍ (poctivo): PyMuPDF (fitz) spoľahlivo dekóduje 33 z 39 zasadnutí
# tohto obdobia. 6 starších/odlišných exportov (2023-02-13, 2023-11-20, 2024-01-05,
# 2024-07-11, 2025-05-29, 2025-07-02 = 39 hlasovaní) používa font bez ToUnicode mapy a
# fitz ich mená komolí. Tie sú v datasete doplnené z čistej textovej vrstvy (jednorazový
# backfill v `council-votes.seed.json`). Skript zlúči čerstvo naparsované + seed a
# uprednostní čerstvé. Mesačný refresh (nové zasadnutia) fitz zvláda bez problémov.
import json, os, re, sys, ssl, urllib.request
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from parse_msz_votes import parse  # fitz-based, overený per-uznesenie parser

ssl._create_default_https_context = ssl._create_unverified_context  # MITM proxy v sieti

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "data", "council-votes.json")
SEED = os.path.join(ROOT, "scripts", "council-votes.seed.json")
CACHE = os.path.join(ROOT, "scripts", "_pdf_cache")

CODE = {"ZA": "Z", "PROTI": "P", "ZDRŽAL SA": "D", "NEPRÍTOMNÝ": "N", "NEHLASOVAL": "H"}

# Zasadnutia volebného obdobia 2023-2026: dátum -> (ds-id stránky, [PDF id_dokumenty])
# ds-id z indexu martin.sk/hlasovania/ds-1008; PDF id z každej session stránky.
SESSIONS = {
    "2023-02-13": ("2442", ["88348"]), "2023-02-23": ("2460", ["89084"]),
    "2023-03-30": ("2462", ["89597"]), "2023-04-27": ("2467", ["90681"]),
    "2023-05-25": ("2468", ["90683"]), "2023-06-22": ("2481", ["92699"]),
    "2023-08-17": ("2482", ["92700"]), "2023-10-03": ("2483", ["92780"]),
    "2023-10-26": ("2487", ["93471"]), "2023-11-20": ("2488", ["93472"]),
    "2023-11-30": ("2565", ["102804", "102805"]), "2023-12-21": ("2566", ["102808"]),
    "2024-01-05": ("2523", ["96290"]), "2024-01-25": ("2524", ["96296"]),
    "2024-02-14": ("2525", ["96292", "96298"]), "2024-02-29": ("2527", ["96318"]),
    "2024-04-04": ("2528", ["96322"]), "2024-04-25": ("2539", ["99616"]),
    "2024-06-20": ("2536", ["98985"]), "2024-07-11": ("2537", ["98986"]),
    "2024-08-27": ("2563", ["102162"]), "2024-09-26": ("2567", ["102825", "102826"]),
    "2024-10-24": ("2568", ["102830", "102831"]), "2024-11-28": ("2569", ["102834", "102835"]),
    "2024-12-19": ("2570", ["102841", "102842"]), "2025-01-30": ("2572", ["102847", "102848"]),
    "2025-02-27": ("2573", ["102851"]), "2025-03-27": ("2574", ["102864", "102865"]),
    "2025-04-24": ("2576", ["103108"]), "2025-05-29": ("2615", ["107683"]),
    "2025-06-19": ("2616", ["107685"]), "2025-07-02": ("2617", ["107687"]),
    "2025-09-30": ("2618", ["107689"]), "2025-10-31": ("2619", ["107718"]),
    "2025-11-21": ("2620", ["107727"]), "2025-12-18": ("2621", ["107731"]),
    "2026-01-29": ("2623", ["107734"]), "2026-02-19": ("2624", ["107736"]),
    "2026-03-26": ("2625", ["108029"]),
}


def session_url(date, ds):
    d, m, y = date.split("-")[2], date.split("-")[1], date.split("-")[0]
    return f"https://www.martin.sk/hlasovania-z-rokovania-zastupitelstva-zo-dna-{d}-{m}-{y}/ds-{ds}"


def download(date, pid):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, f"{date}_{pid}.pdf")
    if os.path.exists(path) and os.path.getsize(path) > 5000:
        return path
    url = f"https://www.martin.sk/assets/File.ashx?id_org=700031&id_dokumenty={pid}"
    urllib.request.urlretrieve(url, path)
    return path


def is_garbled(recs):
    return any(any(ord(ch) < 32 for ch in r["councillor_name"]) for r in recs)


def voting_key(date, hlas_no, uzn=None):
    return f"{date}#{hlas_no or 0}#{uzn or ''}"


import math

# --- Zákonný verdikt "prešlo / neprešlo" (zákon SNR 369/1990 Zb. o obecnom zriadení) ---
# § 12 ods. 7: na uznesenie treba súhlas NADPOLOVIČNEJ väčšiny PRÍTOMNÝCH poslancov.
# § 6 ods. 8 (a § 11 ods. 4 písm. g): na VZN/nariadenie treba súhlas 3/5 PRÍTOMNÝCH.
# Kľúč: kvórum sa počíta z PRÍTOMNÝCH (= ZA + PROTI + ZDRŽAL + NEHLASOVAL), NIE z 31 kresiel.
# Overené proti vytlačenému PDF: VZN č.144 prešlo so ZA=18 pri 18 prítomných (3/5 z 18 = 11).
# PDF invariant (34/34 blokov): prítomných == ZA + ZDRŽAL + PROTI + NEHLASOVAL.
_VZN_RE = re.compile(r"\bvzn\b|nariaden|dodat\w*.*k\s*vzn|dodat\w*.*vzn\s*č|zmen\w*.*vzn", re.I)

def is_vzn_vote(title):
    """VZN/nariadenie (vrát. dodatkov a zmien k VZN) -> prísnejšie 3/5 kvórum."""
    return bool(_VZN_RE.search(title or ""))

def legal_verdict(za, proti, zdrzal, nehl, title):
    """Vráti ('prešlo'|'neprešlo', prítomných, potrebné_ZA, pravidlo) alebo None ak sa nehlasovalo."""
    present = za + proti + zdrzal + nehl
    if present == 0:
        return None
    if is_vzn_vote(title):
        need = math.ceil(3 / 5 * present)          # 3/5 prítomných
        ok = za >= need and za > proti
        rule = "vzn_3_5"
    else:
        need = present // 2 + 1                     # nadpolovičná prítomných
        ok = za >= need and za >= proti
        rule = "nadpolovicna"
    return ("prešlo" if ok else "neprešlo"), present, need, rule


def build_votings_from_records(recs, date, url):
    """Zoskup ploché záznamy (1 poslanec x 1 hlasovanie) do hlasovaní.

    DEDUP: kľúč je (hlasovanie × poslanec). Niektoré zasadnutia zverejnia DVA PDF
    s identickým exportom tých istých hlasovaní (napr. 2024-02-14: 96292 + 96298).
    Keby sme hlasy appendovali do listu, Counter by každý hlas zrátal 2× a sumy
    (za/proti/...) by sa zdvojili (bug: za=44 pri 31 kreslách). Preto zber je
    idempotentný dict meno->hlas: duplicitné PDF prepíše tú istú hodnotu, nepričíta.
    """
    by_voting = defaultdict(dict)
    meta = {}
    for r in recs:
        k = voting_key(date, r.get("_hlas_no"), r.get("_uzn"))
        by_voting[k][r["councillor_name"]] = r["vote_cast"]
        meta[k] = (r.get("_hlas_no"), r.get("_uzn"), r["issue_title"], url)
    out = []
    for k, rows_map in by_voting.items():
        hlas_no, uzn, title, src = meta[k]
        rows = list(rows_map.items())
        c = Counter(rows_map.values())
        # odstráň prefix "Uznesenie č. X: " z titulu (uzn máme samostatne)
        t = re.sub(r"^Uznesenie č\.\s*[\d/]+:?\s*", "", title).strip() or title
        t = re.sub(r"^bod\s+[\w\.\)]+\s*[–-]\s*", "", t).strip()
        out.append({
            "date": date, "hlas_no": int(hlas_no) if hlas_no else None,
            "uzn": uzn, "title": t, "rows": dict(rows),
            "za": c["ZA"], "proti": c["PROTI"], "zdrzal": c["ZDRŽAL SA"],
            "nepr": c["NEPRÍTOMNÝ"], "nehl": c["NEHLASOVAL"], "source": src,
        })
    return out


def to_compact(all_votings):
    councillors = sorted({n for v in all_votings for n in v["rows"]}, key=lambda s: s.lower())
    idx = {n: i for i, n in enumerate(councillors)}
    votings = []
    for v in all_votings:
        code = ["."] * len(councillors)
        for name, cast in v["rows"].items():
            code[idx[name]] = CODE.get(cast, "?")
        votings.append({
            "d": v["date"], "n": v["hlas_no"], "u": v["uzn"], "t": v["title"][:220],
            "za": v["za"], "proti": v["proti"], "zdrzal": v["zdrzal"],
            "nepr": v["nepr"], "nehl": v["nehl"], "s": v["source"], "c": "".join(code),
        })
        verdict = legal_verdict(v["za"], v["proti"], v["zdrzal"], v["nehl"], v["title"])
        if verdict is not None:
            res, present, need, rule = verdict
            votings[-1]["p"] = 1 if res == "prešlo" else 0   # passed podľa zákona
            votings[-1]["pr"] = present                       # prítomných v sále
            votings[-1]["nd"] = need                          # potrebné ZA na schválenie
            votings[-1]["rl"] = rule                          # ktoré kvórum sa použilo
    votings.sort(key=lambda x: (x["d"], x["n"] or 0), reverse=True)
    return {
        "councillors": councillors, "votings": votings,
        "meta": {"seats": 31, "generated_from": "martin.sk H.E.R. rollcall PDF",
                 "range": [min(v["d"] for v in votings), max(v["d"] for v in votings)],
                 "voting_count": len(votings)},
    }


def main():
    WRITE = "--write" in sys.argv
    fresh, garbled_dates = [], []
    for date, (ds, pids) in SESSIONS.items():
        url = session_url(date, ds)
        session_recs = []
        for pid in pids:
            try:
                path = download(date, pid)
            except Exception as e:
                print(f"  ! {date}/{pid} download zlyhal: {e}")
                continue
            recs, _ = parse(path, date, url)
            if recs and not is_garbled(recs):
                session_recs.extend(recs)
        if session_recs:
            fresh.extend(build_votings_from_records(session_recs, date, url))
        else:
            garbled_dates.append(date)

    fresh_keys = {voting_key(v["date"], v["hlas_no"], v["uzn"]) for v in fresh}
    print(f"Čerstvo naparsované (fitz): {len(fresh)} hlasovaní z {len(SESSIONS) - len(garbled_dates)} zasadnutí")
    if garbled_dates:
        print(f"Fitz nezvláda (font bez ToUnicode): {garbled_dates}")

    # doplň seed (jednorazový backfill fitz-nečitateľných + akékoľvek chýbajúce)
    seed_added = 0
    if os.path.exists(SEED):
        seed = json.load(open(SEED, encoding="utf-8"))
        for v in seed:
            if voting_key(v["date"], v["hlas_no"], v["uzn"]) not in fresh_keys:
                fresh.append(v); seed_added += 1
        print(f"Doplnené zo seedu: {seed_added} hlasovaní")
    else:
        print("(seed council-votes.seed.json nenájdený — dataset len z fitz)")

    payload = to_compact(fresh)
    print(f"\nSPOLU: {payload['meta']['voting_count']} hlasovaní, "
          f"{len(payload['councillors'])} poslancov, rozsah {payload['meta']['range']}")

    if not WRITE:
        print("\n[DRY-RUN] Spusti s --write na zápis public/data/council-votes.json")
        return
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    print(f"\n>> zapísané {OUT} ({os.path.getsize(OUT) // 1024} KB)")


if __name__ == "__main__":
    main()
