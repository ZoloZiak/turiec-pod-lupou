#!/usr/bin/env python3
# ETL: menovite hlasovania MsZ Martin (H.E.R. PDF) -> city_council_votes.
# Poctivo: kazdy zaznam = 1 poslanec x 1 hlasovanie, verne PDF (krizovo overene).
# district = None (nie je v zdroji). Dry-run default; --apply zapise cez REST.
import json, os, sys, urllib.request, ssl
from parse_msz_votes import parse

ssl._create_default_https_context = ssl._create_unverified_context

SESSIONS = [
    ("scripts/_hlas_2026-01-29.pdf", "2026-01-29",
     "https://www.martin.sk/hlasovania-z-rokovania-zastupitelstva-zo-dna-29-01-2026/ds-2623/archiv=0"),
    ("scripts/_hlas_2026-02-19.pdf", "2026-02-19",
     "https://www.martin.sk/hlasovania-z-rokovania-zastupitelstva-zo-dna-19-02-2026/ds-2624/archiv=0"),
    ("scripts/_hlas_2026-03-26.pdf", "2026-03-26",
     "https://www.martin.sk/hlasovania-z-rokovania-zastupitelstva-zo-dna-26-03-2026/ds-2625/archiv=0"),
]

def load_env(path=".env.local"):
    env = {}
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k,v = line.split("=",1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env

def main():
    APPLY = "--apply" in sys.argv
    all_recs = []
    for pdf, date, url in SESSIONS:
        recs, issues = parse(pdf, date, url)
        # ocisti interne polia
        for r in recs:
            r.pop("_hlas_no", None); r.pop("_uzn", None)
        all_recs.extend(recs)
        print(f"{date}: {len(issues)} hlasovani, {len(recs)} zaznamov")
    print(f"\nSPOLU: {len(all_recs)} zaznamov")
    # sanity: kazdy ma meno+hlas+datum+titul
    bad = [r for r in all_recs if not (r["councillor_name"] and r["vote_cast"] and r["vote_date"] and r["issue_title"])]
    print(f"Nekompletnych: {len(bad)}")
    from collections import Counter
    print("Rozklad:", dict(Counter(r["vote_cast"] for r in all_recs)))
    print("Poslancov:", len(set(r["councillor_name"] for r in all_recs)))
    print("\nVZORKA (kontroverzne - PROTI):")
    for r in [x for x in all_recs if x["vote_cast"]=="PROTI"][:5]:
        print(f"  {r['vote_date']} {r['councillor_name']}: {r['vote_cast']} | {r['issue_title'][:70]}")

    if not APPLY:
        print("\n[DRY-RUN] Spusti s --apply na zapis.")
        return
    env = load_env()
    base = env["NEXT_PUBLIC_SUPABASE_URL"]; key = env["SUPABASE_SERVICE_ROLE_KEY"]
    # wipe
    req = urllib.request.Request(f"{base}/rest/v1/city_council_votes?id=neq.00000000-0000-0000-0000-000000000000",
        method="DELETE", headers={"apikey":key,"Authorization":f"Bearer {key}","Prefer":"return=minimal"})
    urllib.request.urlopen(req)
    # insert po davkach 200
    ins = 0
    for i in range(0, len(all_recs), 200):
        batch = all_recs[i:i+200]
        data = json.dumps(batch, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(f"{base}/rest/v1/city_council_votes", data=data, method="POST",
            headers={"apikey":key,"Authorization":f"Bearer {key}","Content-Type":"application/json","Prefer":"return=minimal"})
        urllib.request.urlopen(req); ins += len(batch)
    print(f"\n>> vlozenych {ins} zaznamov do city_council_votes")

if __name__ == "__main__":
    main()
