import Link from "next/link";
import {
  ArrowLeft,
  Droplets,
  TreePine,
  CheckCircle2,
  Ruler,
  AlertTriangle,
  MapPin,
  Building2,
  ExternalLink,
  CircleDollarSign,
} from "lucide-react";

export const metadata = {
  title: "Voda späť do Martina — vodný koridor Medokýš | Turiec pod Lupou",
  description:
    "Podklad pre urbanistickú štúdiu: odkrytie potoka Medokýš v lesoparku pod Malou Horou a zelený okruh okolo centra. Overené fakty z verejných registrov (SVP, OSM, Wikipédia) oddelené od toho, čo musí zamerať geodet.",
};

// Statická stránka — podklad k diskusii, bez databázy.
export default function VodaPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Späť */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/"
            className="text-slate-500 hover:text-slate-800 transition-colors p-2 bg-white rounded-full shadow-sm border border-slate-200"
            aria-label="Späť na dashboard"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 flex items-center gap-2">
            <Droplets className="w-7 h-7 text-sky-500" aria-hidden="true" />
            Voda späť do Martina
          </h1>
        </div>

        {/* Perex */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <p className="text-lg text-slate-700 leading-relaxed">
            Centrom Martina tečie potok <strong>Medokýš</strong> — dnes na
            viacerých úsekoch zakrytý pod zemou. Tento dokument je{" "}
            <strong>podklad pre urbanistickú štúdiu</strong>: zhŕňa, čo sa dá
            o toku overiť z verejných zdrojov, a rozlišuje{" "}
            <strong>lacné a realistické</strong> riešenie od{" "}
            <strong>drahého a efektného</strong>. Cieľom je, aby prípadné
            alternatívy architektov stáli na dátach, nie na dojme.
          </p>
          <p className="text-sm text-slate-500 mt-4 border-t border-slate-100 pt-4">
            Zostavené z otvorených zdrojov (Slovenský vodohospodársky podnik,
            OpenStreetMap, Wikipédia, výškopis). Ku každému tvrdeniu je uvedené,
            či je <strong>overené</strong>, alebo či ho ešte musí potvrdiť{" "}
            <strong>geodet / správca toku</strong>.
          </p>
        </div>

        {/* Kľúčové posolstvo: lacné vs drahé */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <CircleDollarSign
                className="w-5 h-5 text-emerald-600"
                aria-hidden="true"
              />
              <h2 className="text-lg font-bold text-emerald-900">
                Lacné a gravitačné
              </h2>
            </div>
            <p className="text-sm text-emerald-800 leading-relaxed">
              Odkryť potok tam, kade už dnes tečie —{" "}
              <strong>v lesoparku na úpätí Malej Hory</strong>. Voda tečie sama
              dole (gravitáciou), koryto je vo voľnej zeleni, netreba búrať ani
              čerpať. Švajčiarsky model{" "}
              <em>Bachkonzept</em>: otvorený potok býva lacnejší než položiť
              ďalšiu rúru.
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle
                className="w-5 h-5 text-amber-600"
                aria-hidden="true"
              />
              <h2 className="text-lg font-bold text-amber-900">
                Drahé a rizikové
              </h2>
            </div>
            <p className="text-sm text-amber-800 leading-relaxed">
              Ťahať vodu <strong>do pešej zóny / na námestie</strong> ako
              regulované rameno. Prevýšenie v centre je malé — čím vyššie treba
              vodu dostať, tým viac čerpania a nákladov navždy (prevádzka,
              energie). Riziko „krásne na vizualizácii, neufinancovateľné v
              prevádzke“.
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-500 italic mb-8 px-1">
          Odporúčanie: skôr ako sa rozhodne o efektnom variante, nechať geodeta
          zamerať skutočný spád. Pár metrov prevýšenia navyše = výrazne drahšie.
        </p>

        {/* 1. Overené fakty */}
        <SectionTitle
          icon={<CheckCircle2 className="w-6 h-6 text-emerald-500" />}
          title="Čo je overené"
        />
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 divide-y divide-slate-100 mb-8">
          <Fact
            label="Medokýš je vodný tok, nie kanalizácia"
            body="Evidovaný vodný tok (ľavostranný prítok Silavy) v správe Slovenského vodohospodárskeho podniku, š.p. Pramení v Jahodníckych hájoch — profil čistého potoka, nie priemyselnej stoky."
            src="Databáza správcovstva drobných vodných tokov, MŽP SR (2025); Stratégia adaptácie mesta Martin na zmenu klímy (2024)"
          />
          <Fact
            label="Tečie lesoparkom pod Malou Horou, nie pod budovami"
            body="Fakulta (JLF UK) a nemocnica (UNM) stoja hore na Malej Hore; potok tečie dole pod nimi v lesoparku, v páse popri uliciach Šoltésovej a Holubyho (17–30 m od nich). Nejde pod námestím ani pod budovami — rozkopateľný zelený/uličný pás."
            src="OpenStreetMap / geodáta (2026), v zhode s miestnou znalosťou"
          />
          <Fact
            label="Zdravý gravitačný spád na pôvodnej línii"
            body="Existujúca zatrubnená línia klesá zhruba 1,4–1,9 % — dostatočný sklon na to, aby odkrytý potok tiekol sám, bez čerpania."
            src="Výškopis (orientačný, SRTM/ASTER 2026) — presné hodnoty musí potvrdiť geodetické zameranie"
          />
          <Fact
            label="Sútok a vyústenie sú známe"
            body="Medokýš ústi do Silavy pri ulici Holubyho (~398 m n.m.). Silava potom tečie ~600 m zakrytá a vynára sa pri predajni Lidl (ul. Červenej armády), ďalej smeruje k rieke Turiec. Prepojenie na Turiec je teda prirodzené — netreba ho stavať cez železničnú stanicu."
            src="OpenStreetMap, voda.oma.sk, Wikipédia (2026)"
          />
        </div>

        {/* 2. Zelený okruh */}
        <SectionTitle
          icon={<TreePine className="w-6 h-6 text-emerald-600" />}
          title="Zelený okruh okolo centra (návrh)"
        />
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <p className="text-slate-700 leading-relaxed mb-4">
            Myšlienka: zelený peší okruh okolo jadra mesta — inšpirácia{" "}
            <strong>Planty Krakowskie</strong> (park do kruhu okolo Starého
            mesta) a <strong>krakovské nábrežné bulváre</strong> (chodníky
            priamo pri rieke). Časť okruhu už fyzicky existuje, len nie je
            pospájaná.
          </p>
          <div className="space-y-3">
            <RingItem
              tone="ok"
              label="Vodná strana (prirodzená)"
              body="Lesopark pod Malou Horou → zelená os Šoltésovej/Holubyho → sútok → odkrytá Silava → Turiec. Vzniká odkrytím toku + promenádou pri vode."
            />
            <RingItem
              tone="ok"
              label="Východná strana (voľná, zelená)"
              body="Od tržnice popod Národný cintorín k parku Malá Hora a arborétu. Prevažne voľné / už zelené plochy — reálna chrbtica okruhu."
            />
            <RingItem
              tone="ok"
              label="Spiatočná strana — ľahká časť: premena obytných ulíc"
              body="Robotnícka → Bernolákova → popri bývalej stoličkárni. Existujúce obytné mestské ulice (verejný pozemok). Nemusia zostať iba vozovkou — dá sa z nich spraviť zelený bulvár: stromoradie, chodník, cyklotrasa, lavičky. Lacné: pozemok už mesto vlastní, netreba vykupovať ani búrať budovy — mení sa profil ulice."
            />
            <RingItem
              tone="warn"
              label="Spiatočná strana — ťažká časť: úsek pri tržnici a galérii je I/65"
              body="Kľúčová korekcia (overené z máp + miestnej znalosti): úsek medzi galériou a tržnicou NIE je pešia zóna — posledný kus pri tržnici a celý zadok OC Galérie tvorí cesta I. triedy I/65 (Kohútova, 4 pruhy, regionálny tranzit). Aby tade prešiel súvislý zelený bulvár, cesta by sa musela na cca 300 m ZAHĹBIŤ (zhruba od miesta bývalej synagógy po zadnú časť galérie). To je najdrahší a najzložitejší prvok celej vízie — veľká dopravná stavba, nie sadenie stromov."
            />
            <RingItem
              tone="warn"
              label="Tá istá I/65 sa vracia aj pri cintoríne"
              body="Kohútova (pri tržnici) a Jesenského (pri Národnom cintoríne) sú dva body jedného súvislého ťahu I/65. Okruh sa teda s hlavnou cestou stretáva na viacerých miestach — riešenie tranzitu (obchvat / zahĺbenie / presmerovanie) je predpokladom, nie detailom."
            />
          </div>
          <p className="text-sm text-slate-500 mt-5 border-t border-slate-100 pt-4">
            Poctivé pomenovanie: nejde o dokonale uzavretý prstenec ako v Krakove
            (Martin nemá historické hradby, ktoré by ho definovali), ale o{" "}
            <strong>zelený polokruh + vodný bulvár</strong>, budovateľný po
            etapách. <strong>Dôležité rozlíšenie nákladov:</strong> vodná a
            lesoparková strana je lacná a rýchla (odkrytie toku, zeleň). Uzavrieť
            okruh na juhu naráža na cestu I/65 — to je už veľká dopravná
            investícia (zahĺbenie ~300 m), ktorú treba priznať vopred, nie
            predávať ako lacnú.
          </p>
        </div>

        {/* 3. Čo treba zamerať */}
        <SectionTitle
          icon={<Ruler className="w-6 h-6 text-slate-600" />}
          title="Čo musí potvrdiť geodet a správca toku"
        />
        <div className="bg-slate-100 rounded-2xl border border-slate-200 p-6 mb-8">
          <ul className="space-y-3 text-slate-700">
            <TodoItem body="Presný pozdĺžny spád v centre (geodetické nivelovanie) — verejný výškopis má chybu niekoľkých metrov, čo je pri malom prevýšení rozhodujúce." />
            <TodoItem body="Či do zakrytého úseku niekto historicky napojil dažďovú alebo splaškovú kanalizáciu — pasport toku od SVP (OZ Piešťany) a pasport kanalizácie od Turčianskej vodárenskej spoločnosti. Toto rozhoduje o všetkom." />
            <TodoItem body="Hĺbka a priemer existujúceho potrubia — z technickej dokumentácie správcu." />
            <TodoItem body="Hydrológia (bežný a povodňový prietok) — či otvorené koryto v uličnom páse prietok bezpečne unesie." />
          </ul>
        </div>

        {/* 4. Referenčné mestá */}
        <SectionTitle
          icon={<MapPin className="w-6 h-6 text-slate-600" />}
          title="Referenčné mestá"
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <RefCard
            city="Zürich"
            note="Program „Bachkonzept“ (od 1988): systematické odkrývanie malých mestských potokov, oddelenie čistej vody od splaškov, gravitačný tok. Správny vzor mierkou."
            tone="ok"
          />
          <RefCard
            city="Krakov"
            note="Planty (park do kruhu okolo centra) + nábrežné bulváre pri Visle. Vzor pre zelený okruh a pobyt pri vode."
            tone="ok"
          />
          <RefCard
            city="Katovice"
            note="Rieku Rawu v centre napokon NEODKRYLI — dali len symbolickú vodu nad kolektorom, lebo bola priemyselná stoka. Varovanie: bez oddelenia splaškov sa odkrytie nepodarí."
            tone="warn"
          />
        </div>

        {/* Kontext biotech + námestie (stručne) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-5 h-5 text-indigo-500" aria-hidden="true" />
            <h2 className="text-lg font-bold text-slate-800">
              Širší rámec
            </h2>
          </div>
          <p className="text-slate-700 leading-relaxed text-sm">
            Vodný koridor je jednou vrstvou väčšej vízie centra: hore na Malej
            Hore výskumno-zdravotnícke zázemie (JLF UK + UNM + nová univerzitná
            nemocnica), pod ním oživený lesopark s vodou, zelené ulice smerom k
            námestiu a kvalitne (nie iba čiastočne) obnovené centrálne námestie.
            Detailný podklad je vedený samostatne; táto stránka sa venuje vode a
            zelenému okruhu.
          </p>
        </div>

        {/* Zdroje */}
        <SectionTitle
          icon={<ExternalLink className="w-6 h-6 text-slate-600" />}
          title="Zdroje"
        />
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8 text-sm text-slate-600 space-y-2">
          <p>• Databáza správcovstva drobných vodných tokov SR — MŽP SR (2025)</p>
          <p>• Stratégia adaptácie mesta Martin na zmenu klímy — Útvar hlavného architekta mesta Martin (2024)</p>
          <p>• OpenStreetMap / Overpass — geometria tokov a ulíc (2026, licencia ODbL)</p>
          <p>• voda.oma.sk — hydrologická vrstva OSM (2026)</p>
          <p>• Wikipédia: Medokýš (prítok Silavy); Bachkonzept; Planty Krakowskie; Rawa (2026)</p>
          <p>• Výškopis SRTM / ASTER cez OpenTopoData (2026) — orientačný, nie geodetický</p>
        </div>

        <p className="text-xs text-slate-400 text-center pb-8">
          Pracovný podklad pre diskusiu o rozvoji centra Martina. Rozlišuje
          overené fakty od návrhov; čísla označené ako orientačné musí pred
          projektom potvrdiť geodetické zameranie a správca toku.
        </p>
      </div>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4 px-1">
      {icon}
      <h2 className="text-xl font-bold text-slate-800">{title}</h2>
    </div>
  );
}

function Fact({
  label,
  body,
  src,
}: {
  label: string;
  body: string;
  src: string;
}) {
  return (
    <div className="p-6">
      <div className="flex items-start gap-3">
        <CheckCircle2
          className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0"
          aria-hidden="true"
        />
        <div>
          <h3 className="font-bold text-slate-800">{label}</h3>
          <p className="text-slate-600 mt-1 leading-relaxed">{body}</p>
          <p className="text-xs text-slate-400 mt-2">Zdroj: {src}</p>
        </div>
      </div>
    </div>
  );
}

function RingItem({
  tone,
  label,
  body,
}: {
  tone: "ok" | "warn" | "stop";
  label: string;
  body: string;
}) {
  const toneMap = {
    ok: "border-emerald-200 bg-emerald-50",
    warn: "border-amber-200 bg-amber-50",
    stop: "border-red-200 bg-red-50",
  };
  const dotMap = {
    ok: "bg-emerald-500",
    warn: "bg-amber-500",
    stop: "bg-red-500",
  };
  return (
    <div className={`rounded-xl border p-4 ${toneMap[tone]}`}>
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`w-2.5 h-2.5 rounded-full ${dotMap[tone]}`}
          aria-hidden="true"
        />
        <h3 className="font-bold text-slate-800">{label}</h3>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed pl-4">{body}</p>
    </div>
  );
}

function TodoItem({ body }: { body: string }) {
  return (
    <li className="flex items-start gap-3">
      <Ruler className="w-4 h-4 text-slate-500 mt-1 shrink-0" aria-hidden="true" />
      <span className="text-sm leading-relaxed">{body}</span>
    </li>
  );
}

function RefCard({
  city,
  note,
  tone,
}: {
  city: string;
  note: string;
  tone: "ok" | "warn";
}) {
  const border = tone === "ok" ? "border-emerald-200" : "border-amber-200";
  return (
    <div className={`bg-white rounded-xl border ${border} p-5 shadow-sm`}>
      <h3 className="font-bold text-slate-800 mb-2">{city}</h3>
      <p className="text-xs text-slate-600 leading-relaxed">{note}</p>
    </div>
  );
}
