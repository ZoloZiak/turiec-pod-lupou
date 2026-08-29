import fitz, re, sys
doc = fitz.open("scripts/_hlas_2026-01-29.pdf")
txt = "\n".join(p.get_text() for p in doc)
print("STRAN:", doc.page_count, "ZNAKOV:", len(txt))
print("===VZORKA prvych 1800===")
print(txt[:1800])
