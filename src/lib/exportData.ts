// exportData.ts — klientský export tabuľkových dát do CSV a JSON (bez servera).
// Transparentnosť = dáta musia byť stiahnuteľné (novinári, aktivisti, kontrola).
// Používa Blob + dočasný <a download>, funguje čisto v prehliadači.

type Row = Record<string, string | number | boolean | null | undefined>;

function csvCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // escapuj úvodzovky, obaľ ak obsahuje oddeľovač/nový riadok/úvodzovku
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCSV(rows: Row[], columns?: { key: string; label: string }[]): string {
  if (rows.length === 0) return "";
  const cols = columns ?? Object.keys(rows[0]).map((k) => ({ key: k, label: k }));
  const header = cols.map((c) => csvCell(c.label)).join(";");
  const body = rows
    .map((r) => cols.map((c) => csvCell(r[c.key])).join(";"))
    .join("\r\n");
  // BOM aby Excel správne čítal diakritiku (UTF-8)
  return "\uFEFF" + header + "\r\n" + body;
}

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // uvoľni pamäť po chvíli (Safari potrebuje odklad)
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function downloadCSV(rows: Row[], basename: string, columns?: { key: string; label: string }[]) {
  triggerDownload(toCSV(rows, columns), `${basename}-${dateStamp()}.csv`, "text/csv;charset=utf-8");
}

export function downloadJSON(data: unknown, basename: string) {
  triggerDownload(JSON.stringify(data, null, 2), `${basename}-${dateStamp()}.json`, "application/json");
}
