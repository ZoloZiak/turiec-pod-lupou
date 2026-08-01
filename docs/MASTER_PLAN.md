# MASTER PLAN & TECH SPEC: "Turiec pod Lupou"

Tento dokument je "Bibliou" projektu. Definuje nielen to, ako systém funguje dnes, ale najmä to, ako je navrhnutý pre budúcnosť, aby sa nezrútil pod ťarchou nových dátových zdrojov (CRZ, weby miest, ORSF, ÚVO) a nevytváral duplikáty.

---

## 1. STRATÉGIA: Od MVP k Ultimátnemu Stroju (Roadmap)

### Fáza 0: Základy a MVP (Kde sme teraz)
- **Cieľ:** Rozbehnúť 1 dátový zdroj (API Slovensko.Digital - CRZ) pre 3 konkrétne IČO (Martinská parkovacia spol., DPMM, OOCR Turiec).
- **Výstup:** Jednoduchý web, ktorý načíta dáta z našej databázy a ukáže koláčové grafy "Kam idú peniaze".
- **Architektúra (100% Cloud / Zero Cost):** Zberač (GitHub Actions Cron) -> Databáza (Supabase PostgreSQL) -> Backend & Frontend (Vercel / Next.js).

### Fáza 1: Zapojenie Neštruktúrovaných Dát (Faktúry z webov)
- **Cieľ:** Integrácia faktúr, ktoré nie sú v centrálnom registri, ale len na weboch podnikov.
- **Výzva:** Každý web má iný formát (HTML tabuľky, občas PDF).
- **Riešenie:** Vytvorenie modulárnych "Scraper Plugins" (napr. `parkovanieMartinScraper.js`). Dáta prejdú čistiacou vrstvou (Sanitizer) a uložia sa do rovnakého univerzálneho formátu ako dáta z CRZ.

### Fáza 2: Prepojovacie Mágie (The Ultimate Machine)
- **Cieľ:** Inteligentné prepájanie subjektov a odhaľovanie sietí.
- **Funkcia:** Pripojenie na Register partnerov verejného sektora (RPVS) a ORSF (Open Register). 
- **Výstup:** Nielen "Kto dostal peniaze", ale aj "Kto je konečný užívateľ výhod (majiteľ) tej firmy" a či tá istá osoba nevlastní 5 rôznych firiem, ktoré "súťažia" o tú istú zákazku.

---

## 2. TECHNICKÁ ŠPECIFIKÁCIA: Ako predísť chaosu a duplikátom

Aby sme mohli ťahať dáta z "xyz miest" a nemali v systéme duplikáty (napr. "Firma s.r.o." a "Firma s.r.o" a "Firma, s r.o."), **databáza musí byť prísne normalizovaná.**

### Zlaté pravidlo deduplikácie: IČO je Kráľ
Každý subjekt v systéme (objednávateľ aj dodávateľ) má unikátny identifikátor. Ak IČO existuje, je to primárny kľúč.

### Návrh Databázy (PostgreSQL)

**1. Tabuľka `entities` (Firmy, Mestá, Podniky)**
Toto je centrálny mozog pre deduplikáciu. Všetky ostatné tabuľky ukazujú sem.
- `id` (UUID, Primary Key)
- `ico` (String, Unique, Index) - *Napr. 36387959*
- `name` (String)
- `type` (Enum: 'MUNICIPALITY', 'COMPANY', 'NGO', 'PERSON')
- `normalized_name` (String) - *Pre fuzzy vyhľadávanie, odstránené s.r.o., diakritika*

**2. Tabuľka `transactions` (Univerzálna tabuľka pre Zmluvy aj Faktúry)**
Namiesto oddelenej tabuľky pre zmluvy a faktúry (čo robí bordel pri agregácii), máme jednu tabuľku finančných tokov.
- `id` (UUID, Primary Key)
- `source_type` (Enum: 'CRZ_CONTRACT', 'WEB_INVOICE')
- `source_url` (String) - *Odkaz na dôkaz (z-dykty prístup)*
- `buyer_entity_id` (UUID, Foreign Key -> entities.id)
- `supplier_entity_id` (UUID, Foreign Key -> entities.id)
- `amount_eur` (Decimal)
- `date_published` (Date)
- `subject` (String) - *Predmet zákazky*
- `external_id` (String) - *ID zmluvy z CRZ, bráni stiahnutiu duplikátu*

### Čistiaca vrstva (Data Sanitization Pipeline)
Keď krtko stiahne dáta, nejdú hneď do DB. Prejdú potrubím:
1. **Validácia:** Má to sumu? Má to dátum?
2. **Identifikácia:** Má dodávateľ IČO? 
   - Ak ÁNO -> `UPSERT` (Vlož alebo aktualizuj) do tabuľky `entities`.
   - Ak NIE (časté pri faktúrach) -> Voláme externé API (ORSF / FinStat) a podľa názvu + adresy skúsime zistiť IČO.
3. **Uloženie:** Až po overení entít sa uloží `transaction`.

---

## 3. TODO LIST: Krok po kroku k MVP

Toto je náš prísny, iteratívny postup. Kým nie je hotový Krok N, nejdeme na Krok N+1.

### KROK 1: Databáza (Supabase v Cloude)
- [ ] Vytvoriť bezplatný projekt na webe Supabase (PostgreSQL ako služba).
- [ ] Získať prístupové údaje (Connection String) do `.env` súboru.
- [ ] Napísať a spustiť SQL skripty na vytvorenie tabuliek (`entities`, `transactions`) priamo v Supabase.
- [ ] Otestovať vloženie dummy dát.

### KROK 2: Dátový Krtko (ETL Pipeline / GitHub Actions)
- [ ] Vytvoriť Node.js skript, ktorý sa pripojí na API Slovensko.Digital.
- [ ] Stiahnuť JSON dáta pre IČO `36387959`.
- [ ] Naprogramovať "Čistiacu vrstvu", ktorá tieto dáta preklopí do našich Supabase tabuliek.
- [ ] Pripraviť skript tak, aby mohol bežať neskôr bezplatne v cloude (napr. GitHub Actions alebo Vercel Cron).

### KROK 3: API Vrstva (Serverless) a Frontend (Next.js na Verceli)
- [ ] Inicializovať Next.js projekt (spojíme Frontend aj Backend API do jedného repozitára).
- [ ] Vytvoriť Next.js API endpoint `GET /api/stats?ico=36387959`, ktorý sa pripojí do Supabase.
- [ ] Použiť `Tremor` knižnicu pre zobrazenie krásneho "Koláča peňazí" a "Rebríčka firiem" na Frontende.

### KROK 4: Nasadenie do Cloudu (Launch)
- [ ] Nahrať kód na GitHub.
- [ ] Prepojiť GitHub repozitár s Vercel.com (automatické nasadenie na web zadarmo).
- [ ] Nastaviť automatické nočné spúšťanie Krtka, aby sa Supabase databáza sama aktualizovala.
