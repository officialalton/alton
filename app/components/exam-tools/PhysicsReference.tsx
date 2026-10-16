"use client";

import { PHYSICS_CONSTANTS, PHYSICS_CONVENTIONS, PHYSICS_GROUPS, PHYSICS_PREFIXES, PHYSICS_REF_DISCLAIMER, PHYSICS_TRIG } from "@/lib/exam-tools/physics-reference";

const H = "mb-1.5 border-b border-grey-200 pb-1 text-[12.5px] font-extrabold text-ink";

export default function PhysicsReference() {
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3 text-[13px]" data-testid="physics-reference">
      <p className="rounded-md bg-grey-100 px-3 py-2 text-[11.5px] font-bold text-grey-700" data-testid="physics-reference-disclaimer">{PHYSICS_REF_DISCLAIMER}</p>
      <section aria-labelledby="pr-const"><h3 id="pr-const" className={H}>Constants</h3>
        <dl className="space-y-1.5">{PHYSICS_CONSTANTS.map((c) => <div key={c.name}><dt className="text-[11.5px] font-semibold text-grey-600">{c.name}</dt><dd className="font-mono text-[13px] text-ink">{c.value}</dd></div>)}</dl>
      </section>
      <section aria-labelledby="pr-conv"><h3 id="pr-conv" className={H}>Conventions</h3>
        <ul className="list-disc space-y-1 pl-5 text-[12.5px] text-ink">{PHYSICS_CONVENTIONS.map((c) => <li key={c}>{c}</li>)}</ul>
      </section>
      {PHYSICS_GROUPS.map((g) => (
        <section key={g.id} aria-labelledby={`pr-${g.id}`}>
          <h3 id={`pr-${g.id}`} className={H}>{g.title}</h3>
          <dl className="space-y-2">{g.items.map((it) => <div key={it.name}><dt className="text-[11.5px] font-semibold text-grey-600">{it.name}</dt><dd className="font-mono text-[13px] leading-snug text-ink">{it.expr}</dd></div>)}</dl>
        </section>
      ))}
      <section aria-labelledby="pr-trig"><h3 id="pr-trig" className={H}>Trigonometric values for common angles</h3>
        <div className="overflow-auto" tabIndex={0} aria-label="Trigonometric values (scrollable)"><table className="w-full border-collapse text-right font-mono text-[12px]"><thead><tr className="bg-ink text-white"><th scope="col" className="px-2 py-1 text-left">angle</th><th scope="col" className="px-2 py-1">sin</th><th scope="col" className="px-2 py-1">cos</th><th scope="col" className="px-2 py-1">tan</th></tr></thead>
          <tbody>{PHYSICS_TRIG.map((r) => <tr key={r.angle} className="odd:bg-grey-50"><th scope="row" className="px-2 py-0.5 text-left">{r.angle}</th><td className="px-2 py-0.5">{r.sin}</td><td className="px-2 py-0.5">{r.cos}</td><td className="px-2 py-0.5">{r.tan}</td></tr>)}</tbody></table></div>
      </section>
      <section aria-labelledby="pr-pre"><h3 id="pr-pre" className={H}>Metric prefixes</h3>
        <p className="font-mono text-[12px] leading-relaxed text-ink">{PHYSICS_PREFIXES.map(([n, s, f]) => `${n} (${s}) ${f}`).join("  ·  ")}</p>
      </section>
    </div>
  );
}
