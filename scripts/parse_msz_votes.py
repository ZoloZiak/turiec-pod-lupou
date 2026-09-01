#!/usr/bin/env python3
# Parser menovitych hlasovani MsZ Martin (H.E.R. System PDF) -> JSON.
# Robustne: cita sekvenciu riadok/karta/meno/hlas per uznesenie.
import fitz, re, json, sys

VOTES = {"ZA","PROTI","ZDRŽAL SA","NEHLASOVAL","NEPRÍTOMNÝ"}

def parse(pdf_path, vote_date, source_url):
    doc = fitz.open(pdf_path)
    records = []
    issues = []  # (issue_title, [rows])
    # rozdel na strany - kazda strana = jedno uznesenie
    for page in doc:
        lines = [l.strip() for l in page.get_text().split("\n") if l.strip()]
        if not lines:
            continue
        # najdi nazov bodu, cislo uznesenia a PORADOVE cislo hlasovania (unikatne per hlas)
        title_bod = None
        uzn = None
        hlas_no = None  # "Výsledok hlasovania č. N" - unikatny kluc kazdeho hlasu
        for i,l in enumerate(lines):
            mh = re.search(r"Výsledok hlasovania č\.\s*(\d+)", l)
            if mh and hlas_no is None:
                hlas_no = mh.group(1)
            m = re.search(r"bod č\.\s*(.+?)\s*$", l)
            if m and "Výsledok hlasovania" in l:
                # nazov moze pokracovat: "... - bod č. 3. - Návrh zmeny..."
                mm = re.search(r"bod č\.\s*([\d\w\.\)]+)\s*-\s*(.+)$", l)
                if mm:
                    title_bod = f"bod {mm.group(1).strip()} – {mm.group(2).strip()}"
                else:
                    title_bod = l.split("bod č.")[-1].strip()
            # Toleruj anomalny format poznamky "Uznesenie - uznesenie č.19/2026"
            # (H.E.R. inak generuje "Uznesenie č. N/RR") — inak vypadne prve
            # hlasovanie dna (bug: 19.02.2026 uzn 19 chybalo, WATCH #124).
            m2 = re.search(r"[Uu]znesenie[\s\-]*(?:uznesenie\s*)?č\.\s*([\d]+/\d+)", l)
            if m2:
                uzn = m2.group(1)
        if not uzn:
            continue
        # nazov: ak titul chyba, pouzi generricky. Normalizuj cislo uznesenia (20/26 -> 20/2026)
        uzn_n = re.sub(r"/(\d{2})$", r"/20\1", uzn)
        issue_title = f"Uznesenie č. {uzn_n}"
        if title_bod:
            # odstran zvysky "Strana"
            tb = title_bod.replace("Strana","").strip(" –-")
            issue_title = f"Uznesenie č. {uzn_n}: {tb}"
        # parsuj riadky poslancov: vzor  <int riadok>\n<int karta>\n<meno>\n<VOTE>
        i = 0
        rows = []
        while i < len(lines)-3:
            if re.fullmatch(r"\d{1,2}", lines[i]) and re.fullmatch(r"\d{1,3}", lines[i+1]):
                name = lines[i+2]
                vote = lines[i+3]
                if vote in VOTES and re.search(r"[A-Za-zÀ-ž]", name) and len(name.split())>=2:
                    rows.append((name, vote))
                    i += 4
                    continue
            i += 1
        for name, vote in rows:
            records.append({
                "councillor_name": name,
                "district": None,
                "vote_cast": vote,
                "issue_title": issue_title[:300],
                "vote_date": vote_date,
                "source_url": source_url,
                "_hlas_no": hlas_no,
                "_uzn": uzn_n,
            })
        if rows:
            issues.append((issue_title, len(rows)))
    # post-pass: ak jedno uznesenie ma viac hlasovani (hlas_no), rozlis titulok
    from collections import defaultdict
    uzn_hlasy = defaultdict(set)
    for r in records:
        uzn_hlasy[r["_uzn"]].add(r["_hlas_no"])
    for r in records:
        if len(uzn_hlasy[r["_uzn"]]) > 1 and r["_hlas_no"]:
            base = r["issue_title"]
            r["issue_title"] = f"{base} (hlasovanie č. {r['_hlas_no']})"[:300]
    return records, issues

if __name__ == "__main__":
    pdf = sys.argv[1]
    vote_date = sys.argv[2]
    source_url = sys.argv[3]
    out = sys.argv[4]
    recs, issues = parse(pdf, vote_date, source_url)
    json.dump(recs, open(out,"w"), ensure_ascii=False, indent=1)
    print(f"Uzneseni: {len(issues)} | zaznamov: {len(recs)}")
    from collections import Counter
    c = Counter(r["vote_cast"] for r in recs)
    print("Rozklad hlasov:", dict(c))
    print("Poslancov v prvom uzneseni:", issues[0] if issues else None)
    names = sorted(set(r["councillor_name"] for r in recs))
    print(f"Unikatnych poslancov: {len(names)}")
    print("Mena:", names)
