import fitz, re, sys
doc = fitz.open("scripts/_hlas_2026-02-19.pdf")
for i,page in enumerate(doc):
    t = page.get_text()
    uzn = re.findall(r"Uznesenie\s*č\.\s*([\d]+/\d+)", t)
    bod = re.search(r"bod č\.\s*([^\n]+)", t)
    print(f"str{i}: uzn_matches={uzn} | bod={(bod.group(1)[:50] if bod else None)}")
