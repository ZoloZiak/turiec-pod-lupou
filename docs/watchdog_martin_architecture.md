# Koncept a Architektúra: Civic-Tech Watchdog "Turiec pod Lupou"

Tento dokument sumarizuje hĺbkový výskum a navrhuje pevnú, rozšíriteľnú architektúru pre komunitný watchdog projekt zameraný na transparentnosť verejných organizácií v regióne Turiec/Martin. Projekt je inšpirovaný portálmi ako z-dykty.pl a kladie dôraz na absolútnu jednoduchosť ("UX pre 12-ročné deti").

## 1. Ciele a Rozsah
**Cieľ:** Vytvoriť portál, ktorý laicky a vizuálne jasne ukáže, s kým a za koľko obchodujú mestské podniky a organizácie.
**Cieľové subjekty:**
1. **Martinská parkovacia spoločnosť, a.s.** (IČO: 36387959)
2. **Dopravný podnik mesta Martin, s.r.o.** (IČO: 53560922)
3. **Oblastná organizácia cestovného ruchu (OOCR) Turiec** (IČO: 42220360)

## 2. Dátové Zdroje (Kde zoberieme dáta?)
Pri hĺbkovom výskume sa ukázalo, že štátne zmluvy (CRZ) nemajú vlastné verejné API, ale komunita (Slovensko.Digital) vytvorila perfektný ekosystém.

1. **API Ekosystému Slovensko.Digital (CRZ a ďalšie registre):**
   - **Endpointy:** `https://datahub.ekosystem.slovensko.digital/api/data/crz/contracts/`
   - **Výhoda:** API je bezplatné, umožňuje sťahovanie zmien a dotazovanie. Nemusíme priamo scrapovať štátny web `crz.gov.sk`.
2. **Alternatíva - API ORSF.sk (Open Register of Slovak Companies):**
   - Agreguje CRZ, ÚVO a RPO. Vhodné na rýchle prepojenie firiem.
3. **Zverejňovanie na vlastných weboch (Faktúry):**
   - Zmluvy nad určitú sumu musia byť v CRZ, inak sú neplatné.
   - Avšak **faktúry a objednávky** zverejňujú tieto subjekty často len na svojich weboch (napr. `parkovaniemartin.sk/faktury`). Pre tieto dáta budeme musieť postaviť **na mieru šité scrapere** (robotov), ktorí raz za noc prejdú ich weby a stiahnu nové faktúry.

## 3. Koncept UX a UI ("Z-dykty" prístup)
- **Fakty bez zafarbenia:** Žiadne politické názory. Len čísla, mená firiem, sumy a priamy preklik na dôkaz (zdrojový dokument na webe štátu).
- **Gamifikácia & Ľahká stráviteľnosť:**
  - Žiadne zložité excelovské tabuľky pre bežného používateľa.
  - Zobrazenie typu: "Rebríček: Kto dostal od DPMM najviac peňazí v roku 2023?"
  - Veľké kruhové (pie) grafy, jasné farby (napr. červená = výdaj, zelená = príjem), obrovská typografia.
  - Obyčajný jazyk: Namiesto "Dodávateľ" použijeme "Komu zaplatili".

## 4. Návrh Architektúry (Technologický Stack)

Aby sa systém pri rozširovaní na ďalšie firmy nezrútil, rozdelíme ho na 3 nezávislé časti:

### A. Data Pipeline (Zberač - "Krtko")
Nezávislý systém, ktorý beží na pozadí (cron jobs) a neovplyvňuje rýchlosť webu.
- **Technológia:** Node.js alebo Python.
- **Úloha 1 (CRZ):** Každú noc zavolá API Slovensko.Digital a spýta sa: "Máš nové zmluvy pre IČO 36387959?". Ak áno, uloží ich.
- **Úloha 2 (Scraping):** Puppeteer / Playwright (Node.js) robot, ktorý otvorí web parkovacej spoločnosti, prečíta HTML tabuľku s faktúrami a uloží ju do našej databázy.

### B. Databáza & Backend (Mozog)
- **Databáza:** PostgreSQL (SupaBase alebo Neon.tech - oboje zadarmo a veľmi silné).
- **Tabuľky:**
  - `organizations` (naše 3 subjekty)
  - `contracts` (zmluvy z CRZ)
  - `invoices` (faktúry z webov)
  - `contractors` (firmy, ktorým sa platilo)
- **Backend/API:** Rýchle REST API (Next.js API routes alebo Hono.js), ktoré vie spočítať "Daj mi Top 5 firiem pre OOCR Turiec".

### C. Frontend (Tvár)
- **Technológia:** Next.js (React) + TailwindCSS.
- **Vizualizačné knižnice:** Tremor.so alebo Recharts (vytvárajú nádherné interaktívne grafy doslova na pár riadkov kódu).
- **Hosting:** Vercel (zadarmo, nasadenie jedným klikom z GitHubu).

## 5. Postupnosť krokov (Ako začať?)
Keď sa rozhodneme do toho ísť, toto bude náš plán:
1. **Proof of Concept (Skúška dát):** Najprv si napíšeme len malý skript, ktorý vytiahne dáta pre IČO 36387959 cez API. Zistíme, akú majú dáta kvalitu.
2. **Založenie Databázy:** Nastavíme PostgreSQL a navrhneme presnú štruktúru tabuliek.
3. **Vývoj Krtka (Data ETL):** Vytvoríme robota na sťahovanie a transformáciu dát.
4. **Stavba UI (Web):** Vytvoríme jednoduchý, pekný frontend v Next.js s grafmi.
5. **Launch:** Nasadenie a testovanie s ľuďmi.

---

> [!TIP]
> Tvoj kamarát má skvelý nápad. Technologicky to je stredne náročný projekt, ale 90% "mágie" sa odohráva na pozadí pri čistení a ťahaní dát. Akonáhle sú dáta pekne uložené u nás v databáze, spraviť z nich pekný graf pre 12-ročného užívateľa je tá najkrajšia a najľahšia časť!
