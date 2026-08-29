-- AUTO-GENEROVANE z eu_funds (scripts/etl_eu_funds_from_tx.js). 20 realnych NFP dotacii.
-- Zdroj: transactions (CRZ zmluvy o poskytnuti NFP), prijimatel = Martin/DPMM/TVS.
-- Idempotentne: wipe + reinsert. Spustit v Supabase SQL Editor.

DELETE FROM eu_funds;

INSERT INTO eu_funds (project_name, amount_eur, program_name, year, winner_ico, winner_name) VALUES
('Nákup autobusov s CNG pohonom (Z401203I083)', 3127080, NULL, 2026, '53560922', 'Dopravný podnik mesta Martin, s.r.o.'),
('Revitalizácia Námestia S. H. Vajanského v Martine (401202F311)', 1993880.2, NULL, 2025, '00316792', 'Mesto Martin'),
('NFP projekt č. IROP-Z-302071BTP9-71-77', 1894400, 'IROP', 2026, '53560922', 'Dopravný podnik mesta Martin, s.r.o.'),
('NFP projekt č. MZP-PSK-401202I114', 1509653.35, 'Program Slovensko', 2026, '36672084', 'Turčianska vodárenská spoločnosť, a.s.'),
('NFP projekt č. MZP-PSK-401202G134', 1162296.46, 'Program Slovensko', 2026, '36672084', 'Turčianska vodárenská spoločnosť, a.s.'),
('Modernizácia ZŠ Aurela Stodolu v Martine', 873989.65, NULL, 2025, '00316792', 'Mesto Martin'),
('NFP projekt č. IROP-PO9-SC91-2023-108', 826800, 'IROP', 2026, '00316792', 'Mesto Martin'),
('NFP projekt č. MZP-PSK-401202G206', 659602.53, 'Program Slovensko', 2026, '36672084', 'Turčianska vodárenská spoločnosť, a.s.'),
('Revitalizácia Parku P. O. Hviezdoslava v Martine (401202FKH7)', 627404.07, NULL, 2025, '00316792', 'Mesto Martin'),
('Zvyšovanie energetickej účinnosti budovy Základnej školy J. Kronera v Martine (PSK-SIEA-007-2024-ITI-EFRR/F173)', 619827.65, 'Program Slovensko', 2026, '00316792', 'Mesto Martin'),
('Modernizácia prestupového terminálu Dopravného podniku mesta Martin s.r.o. a Železníc Slovenskej republiky', 539715.52, NULL, 2026, '53560922', 'Dopravný podnik mesta Martin, s.r.o.'),
('Zmluva č. Z SKCZ304021CKS7 o poskytnutí nenávratného finančného príspevku ,,Dedičstvo minulosti ako odkaz do budúcnosti (ZSKCZ304021CKS7)', 514386.36, 'Interreg SK-CZ', 2026, '00316792', 'Mesto Martin'),
('Realizácia opatrení kybernetickej a informačnej bezpečnosti Mesta Martin. (Z401101FKB8)', 487225.7, NULL, 2024, '00316792', 'Mesto Martin'),
('Modernizácia miestnej komunikácie ul. Hollého Martin (401301B976)', 453964.64, NULL, 2025, '00316792', 'Mesto Martin'),
('401402B928', 385701.83, NULL, 2025, '00316792', 'Mesto Martin'),
('Nenávratný finančný príspevok – Dopravný podnik mesta Martin (2026)', 372537.88, NULL, 2026, '53560922', 'Dopravný podnik mesta Martin, s.r.o.'),
('ZŠ J. Kronera - komplexná škola s prístupom pre všetkých a zatraktívnenie školského prostredia', 344819.4, NULL, 2025, '00316792', 'Mesto Martin'),
('NFP projekt č. MZP-PSK-401202D794', 309413.5, 'Program Slovensko', 2026, '36672084', 'Turčianska vodárenská spoločnosť, a.s.'),
('Č. IROP Z 302071CVB9 76 98 (IROP-Z-302071CVB9-76-98)', 175116, 'IROP', 2023, '00316792', 'Mesto Martin'),
('č. 401406DUN6 s názvom ,,Miestne občianske a preventívne služby v Martine', 169030.99, NULL, 2024, '00316792', 'Mesto Martin');
