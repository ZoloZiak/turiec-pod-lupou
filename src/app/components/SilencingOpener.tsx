"use client";

import { useState, useEffect } from "react";
import { ShieldAlert, Quote } from "lucide-react";

type QuorumFailure = { date: string; label: string; outcome: string; quote: string };
type InterruptedData = { quorumFailures?: QuorumFailure[] };

export default function SilencingOpener() {
  const [data, setData] = useState<InterruptedData | null>(null);

  useEffect(() => {
    fetch("/data/council-interrupted.json")
      .then((r) => r.json())
      .then((d: InterruptedData) => setData(d))
      .catch(() => {});
  }, []);

  const q = data?.quorumFailures ?? [];
  // Pomer PRED a PO zmene pravidla — počítaný ŽIVO podľa VÝSLEDKU, nie podľa dátumu.
  // Prečo podľa výsledku: 27.3.2025 je deň, keď zbor Dodatok č. 4 SCHVÁLIL — ale na tom
  // istom zasadnutí ešte platili staré pravidlá, takže keď padlo kvórum, rokovanie sa
  // PRERUŠILO a pokračovalo (10.4.2025), presne ako predtým. Nové pravidlo platilo až od
  // ďalšieho zasadnutia (24.4.). Filter podľa dátumu (>=27.3.) by 27.3. nesprávne hodil
  // medzi „po" a potom ho ako „prerušené" nezapočítal → súčet 6+13=19 nesedel s počtom
  // všetkých padnutých kvór (20). Výsledok je jednoznačný: „prerušené" = staré správanie
  // (dohlasovalo sa), čokoľvek iné = nové (definitívny koniec). 7 + 13 = 20.
  const beforeInterrupted = q.filter((x) => x.outcome === "prerušené").length;
  const afterEnded = q.filter((x) => x.outcome !== "prerušené").length;
  const hasSplit = beforeInterrupted > 0 && afterEnded > 0;

  return (
    <section className="bg-card rounded-2xl shadow-sm border border-line p-6">
      <div className="flex items-center gap-3 mb-3">
        <ShieldAlert className="w-6 h-6 text-rose-400" aria-hidden="true" />
        <h2 className="text-2xl font-bold text-body">Ako sa dá umlčať menšina</h2>
      </div>

      <p className="text-body/90 mb-3 max-w-3xl">
        Začnime tým najdôležitejším. Demokracia v zastupiteľstve nestojí na tom, že väčšina
        rozhoduje — to je samozrejmé. Stojí na tom, že <strong className="text-body">menšina má
        právo byť vypočutá</strong>: podať návrh, otvoriť tému, prinútiť ostatných hlasovať o nej
        nahlas. Keď väčšina menšine tento priestor vezme, hlasovania síce vyzerajú čisto — ale
        rozhodnuté je už predtým, než sa niekto prihlási o slovo.
      </p>

      <p className="text-body/90 mb-4 max-w-3xl">
        A presne jeden takýto krok sa tu stal, čierne na bielom. Zastupiteľstvo si{" "}
        <strong className="text-body">zmenilo vlastné pravidlá rokovania</strong> tak, že keď počas
        schôdze klesne počet poslancov pod uznášaniaschopnosť, rokovanie sa už{" "}
        <strong className="text-body">nedohlasúva inokedy — jednoducho zomrie</strong>. Body, ku
        ktorým sa zbor nestihol dostať, padnú zo stola. Kto chcel niečo navrhnúť na konci programu,
        má smolu.
      </p>

      {/* Citát poslanca — insider pomenoval mechanizmus priamo v sále */}
      <figure className="mb-5 rounded-xl border-l-4 border-rose-400 bg-rose-50 dark:bg-rose-950/30 p-4">
        <div className="flex items-start gap-2">
          <Quote className="w-4 h-4 text-rose-400 shrink-0 mt-1" aria-hidden="true" />
          <blockquote className="text-sm text-body/90 italic">
            „…keď klesne počet poslancov pod uznášaniaschopnosť, MsZ sa ukončí a tým pádom
            možnosť pre poslancov podávať návrhy tu nie je žiadna… týmto sa bráni právam poslancov
            podávať návrhy.“
          </blockquote>
        </div>
        <figcaption className="text-xs text-muted mt-2 pl-6">
          — poslanec na zasadnutí 29.5.2025, zo zápisnice MsZ (nie náš výklad, jeho slová)
        </figcaption>
      </figure>

      {/* Dôkaz zo zlomu v dátach — počítaný živo */}
      {hasSplit && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-amber-300 dark:border-amber-900/70 bg-amber-50 dark:bg-amber-950/30 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300 mb-1">
              Predtým (do zmeny pravidla)
            </p>
            <p className="text-3xl font-extrabold text-body">
              {beforeInterrupted}×
            </p>
            <p className="text-xs text-muted mt-1">
              keď padlo kvórum, rokovanie sa <strong>prerušilo a pokračovalo</strong> v ďalší termín.
              Body sa dohlasovali.
            </p>
          </div>
          <div className="rounded-xl border border-rose-300 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/30 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300 mb-1">
              Odvtedy (po zmene pravidla)
            </p>
            <p className="text-3xl font-extrabold text-body">
              {afterEnded}×
            </p>
            <p className="text-xs text-muted mt-1">
              keď padlo kvórum, rokovanie sa <strong>definitívne ukončilo</strong>. Zvyšné body
              padli zo stola.
            </p>
          </div>
        </div>
      )}

      <p className="text-sm text-muted max-w-3xl">
        Toto nie je obvinenie z úmyslu — pravidlo sa dá obhájiť aj vecne (netahať polprázdnu sálu do
        noci). Ale dôsledok je jednoznačný a vidno ho priamo v dátach: od zmeny pravidla padnuté
        kvórum <strong className="text-body">zakaždým</strong> znamená koniec, nie odklad. A keď sa
        zmena rokovacieho poriadku schvaľovala, <strong className="text-body">celá opozícia bola
        proti</strong>. Nižšie ukazujeme po lopate jednotlivé spôsoby, akými sa v praxi dá návrh
        „zabiť“ bez toho, aby zaň ktokoľvek zdvihol ruku.
      </p>
    </section>
  );
}
