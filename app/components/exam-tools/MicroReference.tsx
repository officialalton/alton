"use client";

import { MICRO_CONVENTIONS, MICRO_GROUPS, MICRO_REF_DISCLAIMER } from "@/lib/exam-tools/micro-reference";

const H = "mb-1.5 border-b border-grey-200 pb-1 text-[12.5px] font-extrabold text-ink";

export default function MicroReference() {
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3 text-[13px]" data-testid="micro-reference">
      <p className="rounded-md bg-grey-100 px-3 py-2 text-[11.5px] font-bold text-grey-700" data-testid="micro-reference-disclaimer">{MICRO_REF_DISCLAIMER}</p>
      <section aria-labelledby="mr-conv"><h3 id="mr-conv" className={H}>Conventions</h3>
        <ul className="list-disc space-y-1 pl-5 text-[12.5px] text-ink">{MICRO_CONVENTIONS.map((c) => <li key={c}>{c}</li>)}</ul>
      </section>
      {MICRO_GROUPS.map((g) => (
        <section key={g.id} aria-labelledby={`mr-${g.id}`}>
          <h3 id={`mr-${g.id}`} className={H}>{g.title}</h3>
          <dl className="space-y-2">{g.items.map((it) => <div key={it.name}><dt className="text-[11.5px] font-semibold text-grey-600">{it.name}</dt><dd className="font-mono text-[13px] leading-snug text-ink">{it.expr}</dd></div>)}</dl>
        </section>
      ))}
    </div>
  );
}
