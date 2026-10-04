#!/usr/bin/env python3
# Obohati council-contested.json o PLNE nazvy (z H.E.R. PDF) + ELI5 opis typu bodu.
# Opis je odvodeny LEN z nazvu (po ludsky co dany typ bodu znamena) - nic sa nevymysla.
# Spustaj z korena projektu: /usr/bin/python3 scripts/zz_enrich_contested.py
# Vyzaduje najprv: scripts/zz_extract_titles.py (vytvori scripts/_fulltitles.json)
import json, re, os

HERE = os.path.dirname(os.path.abspath(__file__))
CON = os.path.join(HERE, "..", "src", "data", "council-contested.json")
FM  = os.path.join(HERE, "_fulltitles.json")
VOTES = os.path.join(HERE, "..", "public", "data", "council-votes.json")

con = json.load(open(CON, encoding="utf-8"))
# _fulltitles.json je gitignored (generuje ho zz_extract_titles.py z PDF stiahnutych
# lokalne z Macu). Ak chyba, enrichment PLNYCH nazvov sa preskoci, existujuce "full"
# ostanu; prahove polia (z council-votes.json, verziovany) sa doplnia vzdy.
fm = json.load(open(FM, encoding="utf-8")) if os.path.exists(FM) else {}

# Index menovitych hlasovani (verziovany zdroj pravdy) pre prahove polia prahovej osi.
votes = json.load(open(VOTES, encoding="utf-8"))["votings"]

# POZOR (fix WATCH #289): parovanie NESMIE byt len cez (d,u). Pri u=null (viacero
# hlasovani v ten den) alebo pri jednom uzneseni s viacerymi pod-hlasovaniami (napr.
# 20/2026 ma 4 ciastkove hlasovania) by dict kolizia priradila contested riadku prah
# z NESPRAVNEHO hlasovania (napr. VZN 130/131 dostali rl=nadpolovicna miesto vzn_3_5).
# Preto kaskadove, JEDNOZNACNE parovanie: (d,u) ak unikatne -> (d,za,proti,zdrzal) ->
# +nehl -> ak kandidati maju identicky prah je jedno ktory -> inak NEPRIRADIM (nic
# sa nevymysla, povodne polia ostanu).
def match_voting(c):
    d, u = c["d"], c.get("u")
    if u is not None:
        by_u = [v for v in votes if v["d"] == d and v.get("u") == u]
        if len(by_u) == 1:
            return by_u[0]
    cand = [v for v in votes if v["d"] == d and v["za"] == c["za"]
            and v["proti"] == c["proti"] and v["zdrzal"] == c["zdrzal"]]
    if len(cand) == 1:
        return cand[0]
    if len(cand) > 1 and isinstance(c.get("nehl"), int):
        by_n = [v for v in cand if v.get("nehl", 0) == c["nehl"]]
        if len(by_n) == 1:
            return by_n[0]
    if len(cand) > 1:
        sig = {(v["za"] + v["proti"] + v["zdrzal"] + v.get("nehl", 0),
                v.get("nd"), v.get("rl"), v.get("p"), v.get("nehl", 0)) for v in cand}
        if len(sig) == 1:
            return cand[0]
    return None

def clean(t):
    t = t.replace("\xad", "")
    t = t.replace("úvereč.", "úvere č.")
    t = re.sub(r"\s+", " ", t).strip()
    t = re.sub(r"\s*:\s*$", "", t)                       # trailing " :"
    t = re.sub(r"na rok 2024 2026", "na roky 2024 – 2026", t)
    t = re.sub(r"^Hlasovanie č\.\s*\d+\s*\([^)]*\):\s*bod[^–-]*[–-]\s*", "", t)
    return t.strip()

def resolve_full(c):
    d, u = c["d"], c.get("u")
    full = fm.get(f"{d}|{u}") if u else None
    if not full:
        mh = re.search(r"Hlasovanie č\.\s*(\d+)", c["t"])
        if mh:
            full = fm.get(f"{d}|h{mh.group(1)}")
    return clean(full) if full else clean(c["t"])

# ELI5 opisy podla typu bodu (keyword -> veta). Poradie = priorita.
RULES = [
    (r"rokovaci(emu)? poriadk", "Pravidlá, podľa ktorých prebieha samotné rokovanie — vrátane toho, čo sa stane, keď klesne počet poslancov pod uznášaniaschopnosť."),
    (r"miestnych daniach|VZN č\. ?76", "Koľko obyvatelia a firmy platia mestu na dani z nehnuteľností a za vývoz komunálneho odpadu."),
    (r"poplatku za rozvoj|VZN č\. ?139", "Nový poplatok, ktorý platí stavebník pri novej výstavbe v meste."),
    (r"zásad(ám|y) odmeňovania poslancov", "Koľko dostávajú zaplatené samotní poslanci za svoju funkciu."),
    (r"odmien hlavnému kontrolór|odmeňovani.*kontrolór", "Odmena pre mestského kontrolóra — nezávislý dohľad nad hospodárením mesta."),
    (r"plánu kontrolnej činnosti|súhlas.*§ ?18|žiadosť hlavného kontrolór", "Čo a ako smie kontrolovať mestský kontrolór."),
    (r"úver", "Mesto si berie pôžičku na veľkú investíciu — dlh, ktorý bude splácať z rozpočtu."),
    (r"rozpočtu mesta.*na rok|návrh rozpočtu", "Hlavný finančný plán mesta na celý rok — najdôležitejšie hlasovanie roka."),
    (r"zmen[ey] rozpočtu|zmenu rozpočtu|čerpania prostriedkov", "Presun alebo dočerpanie peňazí v rámci rozpočtu počas roka."),
    (r"dotáci", "Rozdelenie mestských peňazí spolkom a organizáciám (šport, kultúra, sociálne služby)."),
    (r"majetkov[ýy] blok|prevod.*nehnuteľného majetku|prenájm|prenájom|prebytočnosti", "Predaj alebo prenájom mestských pozemkov a budov."),
    (r"personálne otázky|zmen[ye].*(komisi|orgán|členstve)|vymenovanie riaditeľa", "Kto zasadne do komisií a do orgánov mestských firiem — rozdelenie postov."),
    (r"protestu prokurátora", "Prokurátor namietol, že uznesenie je v rozpore so zákonom; zastupiteľstvo to musí riešiť."),
    (r"dohody o urovnaní|duplicitného vlastníctva", "Mesto rieši spor o pozemok, ktorý mal podľa papierov dvoch vlastníkov."),
    (r"koncepci[ae] rozvoja športu", "Dlhodobý plán, ako mesto podporuje a financuje šport."),
    (r"nenávratný finančný príspevok|žiadosti o.*príspevok|envirofond|eurofond", "Mesto sa uchádza o dotáciu z EÚ/štátu a dokladá vlastné spolufinancovanie."),
    (r"plnení termínovaných uznesení|plnení uznesení", "Kontrola, či sa splnili úlohy, ktoré si zastupiteľstvo samo uložilo."),
    (r"plánu práce MsR a MsZ", "Harmonogram zasadnutí a tém zastupiteľstva na ďalší polrok."),
    (r"organizovaní dopravy|VZN č\. ?103", "Pravidlá dopravy a parkovania na území mesta."),
    (r"opr[ae]v[ey] dlažby|investičnej akcie|štadión|haly", "Konkrétna stavebná či investičná akcia mesta."),
    (r"zmien v komisiách|zmeny v komisiách", "Kto zasadne do poradných komisií zastupiteľstva — rozdelenie postov."),
    (r"pozastavení výkonu uznesenia", "Primátor pozastavil platnosť uznesenia, lebo s ním nesúhlasí; zastupiteľstvo ho môže prelomiť."),
    (r"členský príspevok|OOCR|OCR Turiec|cestovného ruchu", "Príspevok mesta organizácii cestovného ruchu Turiec."),
    (r"zaradeni.*(škol|pracoviska)|siete škôl", "Zaradenie školy či jej pracoviska do oficiálnej siete škôl."),
]

def eli5(full):
    low = full.lower()
    for pat, desc in RULES:
        if re.search(pat, low):
            return desc
    return ""  # radsej nic nez hadanie

enr = 0
desc_cnt = 0
thr_cnt = 0
for c in con:
    # PLNY nazov: len ak ho vieme z PDF (fm); inak ponechaj existujuci c["full"] alebo t
    if fm:
        full = resolve_full(c)
        c["full"] = full
    else:
        full = c.get("full") or clean(c["t"])
    d = eli5(full)
    if d:
        c["desc"] = d
        desc_cnt += 1
    if full.strip() != c["t"].strip():
        enr += 1
    # PRAHOVE polia pre prahovu os (z council-votes.json, verziovany zdroj pravdy)
    m = match_voting(c)
    if m:
        c["pr"] = m.get("pr")          # pocet pritomnych
        c["nd"] = m.get("nd")          # potrebna hranica (kvorum pre dany typ)
        c["passed"] = bool(m.get("p")) # presslo / neprešlo
        c["rl"] = m.get("rl")          # typ pravidla (nadpolovicna / vzn_3_5)
        c["nehl"] = m.get("nehl", 0)   # zaprezentoval sa, nehlasoval
        thr_cnt += 1

json.dump(con, open(CON, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"zapisanych: {len(con)} | full odlisny od t: {enr} | s ELI5 desc: {desc_cnt} | s prahom: {thr_cnt}")
# ukazka
for c in con[:5]:
    print("\n", c["d"], "|", c["full"][:80])
    print("    desc:", c.get("desc","(ziadny)"))
