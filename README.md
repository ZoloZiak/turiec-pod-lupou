# Turiec pod lupou

> **In English:** Open-data portal tracking municipal contracts, invoices, purchase orders, budget flows, and council votes for the city of Martin (Slovakia) and its city-owned companies. Scheduled GitHub Actions pipelines collect and reconcile records from national and municipal registers using deterministic parsers, supplier deduplication, and zero LLM calls in production.

Verejný prehľad hospodárenia mesta Martin a jeho mestských organizácií na jednom mieste: **[turiec-pod-lupou.vercel.app](https://turiec-pod-lupou.vercel.app)**.

Údaje o tom, kam v meste tečú peniaze a ako hlasuje zastupiteľstvo, sú bežne roztrúsené po viacerých štátnych a mestských systémoch (`crz.gov.sk`, mestský eGov CORA na `egov.martin.sk`, `rpvs.gov.sk`, RPO/RÚZ, správy NKÚ a PDF zápisnice na `martin.sk`). Každý zdroj používa iné formátovanie, časť faktúr neuvádza IČO dodávateľa a živé štátne registre pri nárazových dopytoch vypadávajú. Portál tieto zdroje pravidelne sťahuje, zjednocuje dodávateľov pod jedným IČO a prepočítava väzby dopredu deterministickými skriptami bez volania jazykových modelov v produkcii.

## Čo portál sleduje

- **Tok peňazí a rozpočet (`/`, `/rozpocet`):** Sankeyho diagram príjmov a výdavkov mesta skontrolovaný na cent oproti záverečnému účtu mesta a rozpad programového rozpočtu.
- **Zmluvy, faktúry a objednávky (`/zmluvy`, `/objednavky`, `/dodavatelia`, `/kontrola`):** prepojenie zmlúv z národného CRZ aj mestského registra CORA s reálne uhradenými faktúrami a objednávkami, vrátane kontroly faktúr bez dohľadateľnej zmluvy.
- **Mestské podniky a organizácie (`/podniky`, `/voda`):** samostatný prehľad mestských firiem a príspevkových organizácií (Dopravný podnik mesta Martin, Brantner Fatra, Turčianska vodárenská spoločnosť, OOCR Turiec a ďalšie).
- **Zastupiteľstvo a sľuby (`/poslanci`, `/vzory`, `/slubomer`):** dochádzka, hlasovania poslancov a procedurálne štatistiky zo zápisníc MsZ (padnuté kvórum, stiahnuté body programu, pozmeňujúce návrhy).
- **Kontroly NKÚ a eurofondy (`/nku`, `/eurofondy`):** zistenia Najvyššieho kontrolného úradu a čerpanie projektov z fondov EÚ.

## Odkiaľ idú dáta a ako beží obnova

Zber je rozdelený do štyroch plánovaných úloh v `.github/workflows/`, aby pomalé alebo nestabilné štátne weby neblokovali bežné vykresľovanie stránok:

| Úloha | Rozvrh (UTC) | Čo robí |
|---|---|---|
| `krtko.yml` / `krtko-cron.yml` | denne o 02:00 | Sťahuje nové zmluvy z `crz.gov.sk`, faktúry, údaje dopravného podniku a PDF prílohy do Supabase (`src/scripts/krtko-*.ts`). |
| `rpvs-refresh.yml` | pondelok o 03:00 | Sekvenčne overuje dodávateľov pri zákazkách nad 100 000 € v Registri partnerov verejného sektora (`rpvs.gov.sk`) a výsledok zapisuje do repozitára, keďže živý register pri paralelných dopytoch končí chybou. |
| `egov-datasets-refresh.yml` | 1. deň v mesiaci o 04:00 | Sťahuje hromadné open-data exporty mestských zmlúv a objednávok z `egov.martin.sk`, anonymizuje mená fyzických osôb podľa GDPR a ukladá predpočítané štatistiky. |
| `council-procedural-refresh.yml` | 2. deň v mesiaci o 05:00 | Prepočítava procedurálne deje zo zápisníc MsZ vo verziovanom korpuse `scripts/zapisnice_txt/`. |

Zápisnice zastupiteľstva sa z GitHub runnera nesťahujú naschvál: `martin.sk` blokuje IP adresy cloudových dátových centier, čo pri prvom pokuse prepísalo výstup prázdnym súborom. Nové zápisnice sa preto sťahujú lokálne (`python3 scripts/build_council_procedural.py --download`), ukladajú do korpusu v git histórii a samotný parser má poistku, ktorá pri podozrivo nízkom počte záznamov zastaví beh s chybovým kódom.

Pri každom pushi a pull requeste beží v `ci.yml` kontrola `npm run lint` a produkčný `npm run build` (Node.js 22, zapnutá typová kontrola bez `ignoreBuildErrors`).

## Čistenie dát a opravené chyby pri zbere

Štátne a mestské zdroje menia štruktúru HTML bez upozornenia a často obsahujú neúplné záznamy. Tri chyby, na ktorých sa skripty upravovali najviac:

- **Zlučovanie dodávateľov bez IČO (`scripts/deduplicate.js`):** časť faktúr prichádza bez IČO pod dočasným identifikátorom `NO_ICO_*`. Deduplikačný skript normalizuje názvy firiem a spája tieto položky s overenými subjektmi z RPO a RÚZ, aby sa obrat jedného dodávateľa nerozpadol na viacero záznamov.
- **Tichý posun dátumov v CRZ (`src/scripts/krtko-crz.ts`, `scripts/fix_watch290_crz_dates.js`):** keď `crz.gov.sk` presunul dátum zverejnenia za značku `<strong>` do samostatného elementu `<span>`, pôvodný regulárny výraz prestal zaberať a scraper zapisoval zmluvám dátum svojho behu. Postihlo to 1 362 z 2 274 zmlúv (približne 60 %) a skreslilo časové grafy. Parser dnes číta DOM cez Cheerio s textovou zálohou a hlasným varovaním; opravný skript spätne prepísal dátumy z `crz.gov.sk` len pri záznamoch, kde register vrátil platný údaj.
- **Krížová kontrola čísel v rozpočte:** všetkých deväť uzlov hlavného prehľadu príjmov a výdavkov mesta (76,12 mil. € v záverečnom účte za rok 2025) je prepočítaných oproti oficiálnemu PDF záverečného účtu. Starší nepoužívaný komponent s pevne zadanými medzimestskými odhadmi bol z repozitára vymazaný, aby sa nemohol omylom dostať späť na web.

## Lokálne spustenie

Web je postavený na Next.js 16, Reacte 19, TypeScripte, Tailwind CSS 4, D3 Sankey/Recharts a Supabase. Samotné rozhranie a kontrola zostavenia nevyžadujú prístup do databázy; kľúče v `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) sú potrebné pre živé zberné skripty.

```bash
npm ci
npm run dev          # vývojový server na http://localhost:3000
npm run lint         # ESLint
npm run build        # produkčný build a kontrola typov
```

Manuálne spustenie zberných skriptov:

```bash
npm run krtko:all        # CRZ zmluvy + PDF prílohy + audit väzieb
npm run krtko:egov       # faktúry z mestského eGov portálu
npm run build:contracts  # obnova mestských zmlúv z exportu CORA
npm run build:orders     # štatistiky objednávok mesta
```
