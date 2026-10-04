"use client";

import { Radar, Eye } from "lucide-react";

type WatchItem = {
  title: string;
  eli5: string;
  status: string;
  found: string;
};

// Triky, ktoré SLEDUJEME, ale zatiaľ ich z dát nevieme jednoznačne doložiť.
// Čestne: hľadali sme ich v zápisniciach a buď je prípadov primálo, alebo
// sa zámer nedá odlíšiť od legitímneho postupu. Uvádzame to otvorene —
// nie ako obvinenie, ale ako transparentný „máme na vás oko".
const ITEMS: WatchItem[] = [
  {
    title: "Taktická prestávka v kľúčovom momente",
    eli5:
      "Vyhlásiť prestávku tesne pred citlivým hlasovaním — vyčkať, kým odídu odporcovia, alebo sa dohodnúť v zákulisí.",
    status: "sledujeme, zatiaľ nepotvrdené",
    found:
      "V zápisniciach je prestávok viacero, ale väčšina má legitímny dôvod (porada poslaneckých klubov, technická pauza). Zámer sa z textu odlíšiť nedá — preto nič netvrdíme.",
  },
  {
    title: "Odkladanie bodu „na budúce“ donekonečna",
    eli5:
      "Nevypustiť bod natvrdo, ale ho stále presúvať na ďalší termín, až kým nestratí aktuálnosť a nezapadne.",
    status: "sledujeme, zatiaľ nepotvrdené",
    found:
      "Jednotlivé presuny bodov sa v zápisniciach objavujú, ale zatiaľ sme nenašli prípad, kde by sa ten istý bod opakovane odkladal tak, že by to tvorilo vzorec. Sledujeme ďalej.",
  },
  {
    title: "Zahltenie programu na poslednú chvíľu",
    eli5:
      "Dohodiť do programu veľa bodov tesne pred zasadnutím, aby na tie dôležité neostal čas ani sústredenie.",
    status: "sledujeme, zatiaľ nepotvrdené",
    found:
      "Pokusy doplniť bod do programu sme našli — zaujímavé je, že nám zatiaľ všetky neprešli. To skôr svedčí proti tomuto triku než preň. Sledujeme.",
  },
  {
    title: "Hlasovanie «en bloc» o nesúvisiacich veciach",
    eli5:
      "Zabaliť sporný bod do balíka s nespornými a dať hlasovať o všetkom naraz — kto je proti jednému, musí odmietnuť celý balík.",
    status: "sledujeme, zatiaľ nepotvrdené",
    found:
      "Hlasovanie o materiáloch „ako celok“ sa vyskytuje, ale vo väčšine ide o vecne súvisiaci balík, nie o skrytie sporného bodu. Bez jasného prípadu netvrdíme nič.",
  },
];

export default function TricksWatchlist() {
  return (
    <section className="bg-card rounded-2xl shadow-sm border border-line p-6">
      <div className="flex items-center gap-3 mb-2">
        <Radar className="w-6 h-6 text-sky-400" aria-hidden="true" />
        <h2 className="text-2xl font-bold text-body">Čo sledujeme, ale zatiaľ v dátach nevidíme</h2>
      </div>
      <p className="text-sm text-muted mb-5 max-w-3xl">
        Toto je dôležité pre dôveryhodnosť celej stránky: nehovoríme len to, čo nám vyšlo. Tu sú
        ďalšie postupy, ktoré <strong className="text-body">poznáme z praxe iných zastupiteľstiev</strong> a
        aktívne ich hľadáme v zápisniciach — ale zatiaľ ich tu{" "}
        <strong className="text-body">nevieme jednoznačne doložiť</strong>. Buď je prípadov primálo,
        alebo sa úmysel nedá odlíšiť od úplne legitímneho postupu. Nepodsúvame ich ako fakt. Len
        otvorene hovoríme: máme na ne oko a keď sa v dátach objavia, pribudnú vyššie medzi
        doložené triky.
      </p>
      <ul className="space-y-3">
        {ITEMS.map((it) => (
          <li key={it.title} className="rounded-xl border border-dashed border-line p-4">
            <div className="flex items-start justify-between gap-4 mb-1.5">
              <p className="text-sm font-semibold text-body flex items-center gap-2">
                <Eye className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
                {it.title}
              </p>
              <span className="shrink-0 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 px-2.5 py-0.5 text-[11px] font-bold">
                {it.status}
              </span>
            </div>
            <p className="text-sm text-body/90 mb-1.5">{it.eli5}</p>
            <p className="text-xs text-muted">
              <strong className="text-muted">Čo zatiaľ vidíme v dátach:</strong> {it.found}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
