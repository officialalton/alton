"use client";

import { CHEMISTRY_CONSTANTS, CHEMISTRY_CONVERSIONS, CHEMISTRY_ELEMENTS, CHEMISTRY_GROUPS, CHEMISTRY_PREFIXES, CHEMISTRY_REF_DISCLAIMER, elementPosition } from "@/lib/exam-tools/chemistry-reference";

const H = "mb-1.5 border-b border-grey-200 pb-1 text-[12.5px] font-extrabold text-ink";
const cell = (z: number, s: string, m: string) => (
  <div key={z} className="flex flex-col items-center rounded border border-grey-200 bg-white py-0.5 text-[10px] leading-tight text-ink" title={`Z = ${z}`}><span className="text-grey-500">{z}</span><span className="text-[12px] font-extrabold">{s}</span><span className="text-grey-600">{m}</span></div>
);

export default function ChemistryReference() {
  const main = CHEMISTRY_ELEMENTS.filter(([z]) => elementPosition(z).group !== 0);
  const lan = CHEMISTRY_ELEMENTS.filter(([z]) => elementPosition(z).group === 0);
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3 text-[13px]" data-testid="chemistry-reference">
      <p className="rounded-md bg-grey-100 px-3 py-2 text-[11.5px] font-bold text-grey-700" data-testid="chemistry-reference-disclaimer">{CHEMISTRY_REF_DISCLAIMER}</p>
      <section aria-labelledby="cr-pt"><h3 id="cr-pt" className={H}>Periodic table (elements 1–86; atomic mass in g/mol)</h3>
        <div className="overflow-auto" tabIndex={0} aria-label="Periodic table (scrollable)">
          <div className="grid min-w-[760px] gap-0.5" style={{ gridTemplateColumns: "repeat(18, minmax(0, 1fr))" }} data-testid="periodic-table">
            {main.map(([z, s, m]) => { const p = elementPosition(z); return <div key={z} style={{ gridColumn: p.group, gridRow: p.period }}>{cell(z, s, m)}</div>; })}
          </div>
          <div className="mt-1 grid min-w-[760px] gap-0.5" style={{ gridTemplateColumns: "repeat(15, minmax(0, 1fr))" }} aria-label="Lanthanides">{lan.map(([z, s, m]) => cell(z, s, m))}</div>
        </div>
      </section>
      <section aria-labelledby="cr-const"><h3 id="cr-const" className={H}>Constants</h3>
        <dl className="space-y-1.5">{CHEMISTRY_CONSTANTS.map((c) => <div key={c.name}><dt className="text-[11.5px] font-semibold text-grey-600">{c.name}</dt><dd className="font-mono text-[13px] text-ink">{c.value}</dd></div>)}</dl>
      </section>
      <section aria-labelledby="cr-conv"><h3 id="cr-conv" className={H}>Unit conversions</h3>
        <ul className="list-disc space-y-1 pl-5 font-mono text-[12.5px] text-ink">{CHEMISTRY_CONVERSIONS.map((c) => <li key={c}>{c}</li>)}</ul>
      </section>
      {CHEMISTRY_GROUPS.map((g) => (
        <section key={g.id} aria-labelledby={`cr-${g.id}`}>
          <h3 id={`cr-${g.id}`} className={H}>{g.title}</h3>
          <dl className="space-y-2">{g.items.map((it) => <div key={it.name}><dt className="text-[11.5px] font-semibold text-grey-600">{it.name}</dt><dd className="font-mono text-[13px] leading-snug text-ink">{it.expr}</dd></div>)}</dl>
        </section>
      ))}
      <section aria-labelledby="cr-pre"><h3 id="cr-pre" className={H}>Metric prefixes</h3>
        <p className="font-mono text-[12px] leading-relaxed text-ink">{CHEMISTRY_PREFIXES.map(([n, s, f]) => `${n} (${s}) ${f}`).join("  ·  ")}</p>
      </section>
    </div>
  );
}
