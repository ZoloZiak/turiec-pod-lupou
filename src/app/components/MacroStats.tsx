"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Building2, Info, ExternalLink } from "lucide-react";

/**
 * Reálne dáta — NIE dummy. Zdroje (auditovateľné):
 *  - Celkové náklady miest: RÚZ (registeruz.sk), individuálna účtovná závierka za rok 2025,
 *    Výkaz ziskov a strát Úč ROPO SFOV 2-01, súčet nákladov (účt. skupiny 50–58), stĺpec Spolu.
 *    Odkaz `ruz` vedie na profil účtovnej jednotky v RÚZ, kde je zdrojová závierka.
 *  - Počet obyvateľov: ŠÚ SR, stav k 31. 12. 2025.
 *  - Náklady na obyvateľa = celkové náklady / počet obyvateľov (odvodený ukazovateľ).
 * POZOR: "celkové náklady" (akruálne účtovníctvo) NIE sú totožné s rozpočtovým pojmom
 * "bežné výdavky" (Výkaz plnenia rozpočtu FIN) — preto ich tak ani nepomenúvame.
 */
const ROK = 2025;

const MESTA = [
  { mesto: "Prievidza", ico: "00318442", naklady: 40795774, obyvatelov: 41959, ujId: 13714 },
  { mesto: "Martin",    ico: "00316792", naklady: 43593283, obyvatelov: 50153, ujId: 23450 },
  { mesto: "Poprad",    ico: "00326470", naklady: 47046770, obyvatelov: 48034, ujId: 21175 },
  { mesto: "Trenčín",   ico: "00312037", naklady: 56373807, obyvatelov: 54104, ujId: 25694 },
];

const data = MESTA.map((m) => ({
  ...m,
  naklady_na_hlavu: Math.round(m.naklady / m.obyvatelov),
})).sort((a, b) => a.naklady_na_hlavu - b.naklady_na_hlavu);

const martin = data.find((m) => m.mesto === "Martin")!;
const priemerOstatni = Math.round(
  data.filter((m) => m.mesto !== "Martin").reduce((s, m) => s + m.naklady_na_hlavu, 0) /
    (data.length - 1)
);
const rozdiel = martin.naklady_na_hlavu - priemerOstatni;
const poloha = rozdiel < 0 ? "podpriemerné" : "nadpriemerné";

export default function MacroStats() {
  return (
    <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden mb-8">
      <div className="p-6 bg-card border-b border-line">
        <h2 className="text-xl font-bold text-body flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-400" aria-hidden="true" />
          Makro-porovnanie (Samosprávy SR)
        </h2>
        <p className="text-sm text-muted mt-1">
          Celkové náklady mesta na jedného obyvateľa voči porovnateľným mestám. Zdroj:
          RÚZ (účtovné závierky {ROK}) + počet obyvateľov ŠÚ SR (k 31.&nbsp;12.&nbsp;{ROK}).
        </p>
      </div>

      <div className="p-6">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="mesto"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontWeight: 600 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8' }}
                tickFormatter={(value) => `${value} €`}
              />
              <Tooltip
                cursor={{ fill: '#f1f5f9' }}
                formatter={(value: number) => [`${value} €`, 'Náklady na obyvateľa']}
                labelFormatter={(label: string) => {
                  const m = data.find((x) => x.mesto === label)!;
                  return `${label} — ${m.obyvatelov.toLocaleString('sk-SK')} obyv.`;
                }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar
                dataKey="naklady_na_hlavu"
                radius={[6, 6, 0, 0]}
                barSize={40}
                fill="#3b82f6"
                activeBar={{ fill: '#2563eb' }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-6 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-xl p-4 flex gap-3 items-start">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-blue-800">
            <strong>Analýza:</strong> Mesto Martin vykazuje podľa účtovných závierok za rok {ROK}
            {" "}{poloha} celkové náklady na jedného obyvateľa (<strong>{martin.naklady_na_hlavu} €</strong>)
            v porovnaní s demograficky podobnými mestami (Prievidza, Poprad, Trenčín; ich priemer
            {" "}{priemerOstatni} €). Ide o účtovné (akruálne) náklady mesta, nie rozpočtové bežné
            výdavky. Každý údaj si možno overiť priamo v Registri účtovných závierok.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
          {data.map((m) => (
            <a
              key={m.ico}
              href={`https://www.registeruz.sk/cruz-public/domain/accountingentity/show/${m.ujId}`}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center justify-between gap-1 text-xs bg-surface hover:bg-elevated border border-line rounded-lg px-3 py-2 transition-colors"
              title={`Zdrojový výkaz RÚZ pre ${m.mesto} (IČO ${m.ico})`}
            >
              <span className="font-semibold text-body">{m.mesto}</span>
              <span className="text-muted group-hover:text-blue-600 flex items-center gap-1">
                RÚZ <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
