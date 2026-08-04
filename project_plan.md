# Plán rozvoja: Turiec pod Lupou 🔎

Tento dokument obsahuje postupný plán implementácie ďalších kľúčových funkcií pre projekt Turiec pod Lupou.

## ✅ Fáza 1: Vyhľadávanie a stránkovanie (Viac dát)
- [x] Pridať globálne vyhľadávanie nad tabuľku (hľadanie podľa názvu firmy alebo predmetu zákazky).
- [x] Odstrániť limit 15 záznamov a nahradiť ho plnohodnotným stránkovaním.

## ✅ Fáza 2: Profil dodávateľa (Detailná karta firmy)
- [x] Vytvoriť novú dynamickú podstránku `/dodavatel/[ico]`.
- [x] Na tejto stránke zobraziť agregované štatistiky a graf rastu.
- [x] **Zdieľanie a virálny export:** Pridané tlačidlo "Zdieľať profil" s automatickým formátovaním štatistiky pre sociálne siete.

## ✅ Fáza 4: Upozornenia (Telegram Bot)
- [x] Vytvoriť Telegram bota pre Krtka (`src/lib/telegram.ts`).
- [x] Vykonať audit aktuálnych notifikácií pre nové zmluvy (`npm run krtko:audit`).
- [x] Zabezpečiť, aby bot vyhodnocoval podozrivé transakcie (nová zmluva nad 100k bez zápisu v RPVS) a zasielal varovania priamo na mobilné zariadenie.

## ✅ Fáza 5: UI/UX Upgrady & Radikálna Transparentnosť (Terminal & z-dykty.pl)
- [x] **Terminal Téma (Tmavý Režim):** Nová analytická estetika na domovskej stránke (slate + emerald prvky).
- [x] **Liczba-Bohater (Hero Stats):** Použitie knižnice `@number-flow/react` na dramatické animované "odpočítavanie" verejných peňazí s bielym čitateľným fontom a glow efektom.
- [x] **Spotlight Cards:** Implementovaný 3D tilt + glow efekt pomocou `framer-motion` (`SpotlightCard.tsx`).
- [x] **Červené Vlajky (Red Flags Quick Audit Bar):** Jednoklikové filtre pre "Zmluvy nad 100k", "Chýba zmluva v CRZ" a "Koncoročný zhonec (December)".
- [x] **Časová konzistencia dát:** CRZ scraper upravený tak, aby filtroval zmluvy podľa roku a presne pasoval na Finstat zisky z rovnakého obdobia.

## ✅ Fixy Dát: Masové dopárovanie IČO a integrácia RPVS (99.2% pokrytie)
- [x] Masový automatizovaný skript prešiel všetky subjekty cez RÚZ (Register účtovných závierok) a RPVS API, čím sa finančné pokrytie zmlúv presným IČO zvýšilo na **99,2 %** (151,87 mil. €).
- [x] Vyriešené a prelinkované všetky kľúčové ministerstvá, štátne fondy, banky a mestské podniky.

## ✅ Fáza 7: Verejná kontrola (Z-dykty Hub)
Vytvorenie a naplnenie 4 nových modulov reálnymi dátami prostredníctvom Krtka (automatizovaných ETL skriptov) a Supabase.
- [x] 7.1 Mestské podniky + **Interaktívny Porovnávač Podnikov (Bliźniak module)**
- [x] 7.2 Kontroly NKÚ SR (Protokoly)
- [x] 7.3 Eurofondy a Dotácie (ITMS2014+ / Plán obnovy)
- [x] 7.4 Hlasovania Poslancov MsZ
