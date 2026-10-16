"use client";

import { BIOLOGY_CHI_TABLE, BIOLOGY_GROUPS, BIOLOGY_PREFIXES, BIOLOGY_REF_DISCLAIMER } from "@/lib/exam-tools/biology-reference";

const H = "mb-1.5 border-b border-grey-200 pb-1 text-[12.5px] font-extrabold text-ink";

export default function BiologyReference() {
  const t = BIOLOGY_CHI_TABLE;
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3 text-[13px]" data-testid="biology-reference">
      <p className="rounded-md bg-grey-100 px-3 py-2 text-[11.5px] font-bold text-grey-700" data-testid="biology-reference-disclaimer">{BIOLOGY_REF_DISCLAIMER}</p>
      {BIOLOGY_GROUPS.map((g) => (
        <section key={g.id} aria-labelledby={`br-${g.id}`}>
          <h3 id={`br-${g.id}`} className={H}>{g.title}</h3>
          <dl className="space-y-2">{g.items.map((it) => <div key={it.name}><dt className="text-[11.5px] font-semibold text-grey-600">{it.name}</dt><dd className="font-mono text-[13px] leading-snug text-ink">{it.expr}</dd></div>)}</dl>
          {g.id === "stat" && (
            <div className="mt-2 overflow-auto" tabIndex={0} aria-label="Chi-square critical values (scrollable)">
              <table className="min-w-[420px] border-collapse text-[12px]" data-testid="chi-square-table">
                <thead><tr><th className="border border-grey-200 px-2 py-1 text-left">p value</th>{t.dfs.map((d) => <th key={d} className="border border-grey-200 px-2 py-1">df {d}</th>)}</tr></thead>
                <tbody>
                  <tr><th className="border border-grey-200 px-2 py-1 text-left">0.05</th>{t.p05.map((v, i) => <td key={i} className="border border-grey-200 px-2 py-1 text-center font-mono">{v.toFixed(2)}</td>)}</tr>
                  <tr><th className="border border-grey-200 px-2 py-1 text-left">0.01</th>{t.p01.map((v, i) => <td key={i} className="border border-grey-200 px-2 py-1 text-center font-mono">{v.toFixed(2)}</td>)}</tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
      <section aria-labelledby="br-pre"><h3 id="br-pre" className={H}>Metric prefixes</h3>
        <p className="font-mono text-[12px] leading-relaxed text-ink">{BIOLOGY_PREFIXES.map(([n, s, f]) => `${n} (${s}) ${f}`).join("  ·  ")}</p>
      </section>
    </div>
  );
}
