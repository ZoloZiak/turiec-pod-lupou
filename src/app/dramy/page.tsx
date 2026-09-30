import SiteNav from "../components/SiteNav";
import CouncilDrama, { Drama } from "../components/CouncilDrama";
import ContestedVotes, { Contested } from "../components/ContestedVotes";
import dramas from "../../data/council-dramas.json";
import contested from "../../data/council-contested.json";
import { AlertTriangle, Vote } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Drámy zastupiteľstva — Turiec pod lupou",
  description:
    "Kľúčové hlasovania Mestského zastupiteľstva v Martine rozobrané po jednom — kto ako hlasoval, čo rozhodlo, kto zmenil hlas. Z oficiálnych menných záznamov mesta.",
};

export default function DramyPage() {
  const list = dramas as Drama[];

  return (
    <div className="min-h-screen bg-surface text-body pb-20">
      <SiteNav />
      <header className="bg-card text-body pt-16 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <Link href="/" className="text-sm font-medium text-muted hover:text-body mb-4 block">
            &larr; Dashboard
          </Link>
          <h1 className="text-4xl font-extrabold flex items-center gap-3">
            <Vote className="w-10 h-10 text-purple-400" aria-hidden="true" /> Drámy zastupiteľstva
          </h1>
          <p className="text-lg text-muted mt-4 max-w-3xl">
            Niektoré hlasovania rozhodli o meste — a pritom sa udiali potichu, tesne, alebo sa vrátili na druhýkrát
            s iným výsledkom. Tu ich rozoberáme jedno po druhom: kto ako hlasoval, čo presne rozhodlo a čo sa zmenilo.
            Všetko z oficiálnych menných záznamov mesta (systém H.E.R.), s odkazom na zdroj pri každom čísle.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 space-y-8">
        {list.map((d) => (
          <CouncilDrama key={d.slug} drama={d} />
        ))}

        <ContestedVotes items={contested as Contested[]} />

        {/* metodika / disclaimer — poctivosť, nie obvinenie */}
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-5 flex gap-3 items-start">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm text-body/90 space-y-2">
            <p>
              <strong>Ako to čítať.</strong> Čísla a menné hlasy pochádzajú priamo z oficiálnych záznamov hlasovania
              Mestského zastupiteľstva v Martine (systém H.E.R., zverejnené na martin.sk). Pri každom hlasovaní je odkaz
              na zdrojové uznesenie — over si to sám.
            </p>
            <p>
              Zmena hlasu ani neúčasť <strong>nie sú dôkazom pochybenia</strong>. Poslanec môže hlas zmeniť z legitímnych
              dôvodov (upravený návrh, nové informácie, rokovanie). Zámerom nie je nikoho obviniť, ale ukázať verejný
              záznam prehľadne — záver si spraví čitateľ.
            </p>
            <p>
              VZN a jeho dodatky potrebujú na schválenie <strong>trojpätinovú väčšinu</strong> — teda 19 z 31 poslancov.
              Preto môže mať návrh viac hlasov za ako proti a napriek tomu neprejsť.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
