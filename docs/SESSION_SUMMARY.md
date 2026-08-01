# Turiec pod Lupou - Session Zápis

## Čo sa podarilo (Zhrnutie aktuálneho stavu)

Tento projekt sme úspešne dostali z fázy návrhu až do **plne produkčnej, automatizovanej verzie** bez technologického dlhu a bez nebezpečenstva halucinovania ("YOLO chýb") v dátach.

1. **Čistenie a architektúra (Anti-Hallucination deduplikácia)**
   - Všetky pôvodné zlé/falošné dáta z databázy boli prečistené.
   - Pripravili sme deterministickú logiku na generovanie dočasných IČO (tzv. `NO_ICO_*`) z mien dodávateľov (napríklad z CRZ alebo z webových faktúr). Tým pádom zachovávame čistú reláciu pre jeden a ten istý subjekt bez rizika, že ho systém automaticky priradí k cudzej firme, s ktorou nemá nič spoločné.

2. **Backend & Dátová pumpa (Supabase + Krtko)**
   - Plne funkčný web scraper na vládny CRZ (zbiera zmluvy mesta Martin).
   - Vytvorená "Fáza 1" scraper architektúra (pomocou `cheerio`), ktorá vie ťahať a čistiť neštruktúrované dáta priamo z webov mestských podnikov (napr. parkovaniemartin.sk).
   - Obe tieto cesty sa zbiehajú v jednej Supabase databáze (zmluva aj faktúra majú svoje tagy `CRZ_CONTRACT` a `WEB_INVOICE`).

3. **Frontend (Vercel + Next.js)**
   - Nasadený analytický verejný **Dashboard** postavený nad knižnicami `Next.js` a `recharts`.
   - Používateľské prostredie bolo zamerané na laikov – pekný, vizuálne prívetivý layout, grafy, jasné zobrazenie Top 10 poberateľov verejných zdrojov a jednoduchý filter mestských organizácií.
   - Nasadené na webe cez prepojenie GitHub -> Vercel, kde si Vercel ťahá Supabase `.env` premenné priamo z produkcie.

4. **Human-in-the-loop (Administrácia pre Fázu 2)**
   - Vytvorili sme bezpečné prostredie na prepájanie neznámych subjektov s tými registrovanými.
   - V `/admin` rozhraní si môže overený človek pozrieť entity s tagom `NO_ICO_*` (stiahnuté robotom) a "na jeden klik" zviazať celú ich históriu platieb so skutočným, z ORSR overeným subjektom. 100% ochrana pred falošnými obvineniami.

5. **Automatizácia ("The Ultimate Machine")**
   - Všetok kód je uložený a odoslaný na GitHube.
   - Spustený nočný **GitHub Actions Cron Job** (`krtko-cron.yml`), ktorý o 02:00 ráno automaticky poťahá nové verejné zmluvy aj nové webové faktúry, spracuje ich a nahrá ich do Supabase, odkiaľ si ich ráno načíta Dashboard.

---

## TODO (Čo nás čaká nabudúce)

Projekt funguje autonómne, no pre jeho ďalší rast si tu nechávame tieto nasledujúce ciele (Fáza 3 a expanzia):

- [ ] **Integrovať FinStat / ORSR API:** 
  Do admin rozhrania môžeme zapojiť tlačidlo, ktoré pre neznámu entitu (napr. `NO_ICO_SERVISAS`) potiahne zoznam pravdepodobných zhôd priamo z FinStatu, aby administrátor nemusel manuálne "gúgliť" správne IČO.
- [ ] **Odhaľovanie Majetkových Sietí (RPVS):**
  Akonáhle spárujeme firmu s reálnym IČOm, napojiť Register partnerov verejného sektora (RPVS) a stiahnuť meno skutočného majiteľa. Pridať do Dashboardu graf sietí: *"Majiteľ X -> Vlastní Firmu A, Firmu B -> Firma A a B spolu vysúťažili 500 000€"*.
- [ ] **Nové Scraper Pluginy:**
  Naklonovať základný `scraper-invoices.ts` a ušiť ho pre weby ďalších konkrétnych firiem v meste (napríklad vodárne, technické služby, domovy dôchodcov, hokejový klub), ktoré nezverejňujú na CRZ, ale do vlastných neštruktúrovaných PDF.
- [ ] **AI PDF Extractor:**
  Ak nejaký podnik zverejňuje faktúry len ako oskenované PDF obrázky, nasadiť LLM / OCR agenta (cez Google Vertex AI alebo Gemini), ktorý zo surového skenu extrahuje JSON tabuľku (Suma, Dodávateľ, Predmet) a pošle ju nášmu Krtkovi.
- [ ] **Notifikácie (Slack/Email):**
  Pridať do GitHub Actions hook, ktorý v prípade nájdenia mimoriadne veľkej (anomálnej) faktúry alebo zmluvy okamžite pošle notifikáciu administrátorom na mobil.
