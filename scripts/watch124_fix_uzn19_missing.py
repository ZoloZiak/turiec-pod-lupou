#!/usr/bin/env python3
# WATCH #124: doplni CHYBAJUCE uzn. 19/2026 (19.02.2026, hlas. c.13) do city_council_votes.
# Bug: parse_msz_votes.py regex nezachytil anomalnu poznamku "Uznesenie - uznesenie c.19/2026"
# -> prve hlasovanie dna vypadlo (15 hlasovani v DB namiesto 16). Parser uz opraveny.
# Zdroj = /tmp/parsed_1902_fixed.json (opraveny parser), 31 riadkov, KRIZOVO OVERENE 31/31 voci
# oficialnemu H.E.R. PDF mesta (ZA 23, ZDRZAL 1 Ftorek, NEPRIT 7). Neutralny badge (Zdroj udajov).
# Idempotentne: najprv DELETE uzn 19/2026 pre 2026-02-19, potom INSERT 31. Dry-run default; --apply zapise.
import json, os, sys, urllib.request, urllib.parse, ssl

ssl._create_default_https_context = ssl._create_unverified_context

def load_env(path=".env.local"):
    env = {}
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env

def main():
    APPLY = "--apply" in sys.argv
    recs = json.load(open("/tmp/parsed_1902_fixed.json", encoding="utf-8"))
    u19 = [r for r in recs if r.get("_uzn") == "19/2026"]
    for r in u19:
        r.pop("_hlas_no", None); r.pop("_uzn", None)
    print(f"Chybajucich zaznamov uzn 19/2026 (19.02): {len(u19)}")
    from collections import Counter
    print("Rozklad:", dict(Counter(r["vote_cast"] for r in u19)))
    print("issue_title:", u19[0]["issue_title"] if u19 else None)
    # sanity
    assert len(u19) == 31, "ocakavam presne 31 riadkov (31 poslancov)"
    assert all(r["councillor_name"] and r["vote_cast"] and r["vote_date"] == "2026-02-19" for r in u19)
    names = set(r["councillor_name"] for r in u19)
    assert len(names) == 31, "31 unikatnych poslancov"

    if not APPLY:
        print("\n[DRY-RUN] Spusti s --apply na zapis. Vzorka:")
        for r in u19[:3]:
            print(f"  {r['councillor_name']}: {r['vote_cast']}")
        return

    env = load_env()
    base = env["NEXT_PUBLIC_SUPABASE_URL"]; key = env["SUPABASE_SERVICE_ROLE_KEY"]
    hdr = {"apikey": key, "Authorization": f"Bearer {key}"}
    # idempotentne: zmaz existujuce uzn 19/2026 pre tento datum (ak by uz boli)
    flt = urllib.parse.quote("Uznesenie č. 19/2026%")
    du = f"{base}/rest/v1/city_council_votes?vote_date=eq.2026-02-19&issue_title=like.{flt}"
    req = urllib.request.Request(du, method="DELETE", headers={**hdr, "Prefer": "return=minimal"})
    urllib.request.urlopen(req)
    # insert 31
    data = json.dumps(u19, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(f"{base}/rest/v1/city_council_votes", data=data, method="POST",
        headers={**hdr, "Content-Type": "application/json", "Prefer": "return=minimal"})
    urllib.request.urlopen(req)
    print(f"\n>> vlozenych {len(u19)} zaznamov uzn 19/2026 do city_council_votes")

if __name__ == "__main__":
    main()
