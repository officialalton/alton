"use client";

import { JAVA_GROUPS, JAVA_REF_DISCLAIMER } from "@/lib/exam-tools/java-reference";

const H = "mb-1.5 border-b border-grey-200 pb-1 text-[12.5px] font-extrabold text-ink";

export default function JavaReference() {
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3 text-[13px]" data-testid="java-reference">
      <p className="rounded-md bg-grey-100 px-3 py-2 text-[11.5px] font-bold text-grey-700" data-testid="java-reference-disclaimer">{JAVA_REF_DISCLAIMER}</p>
      {JAVA_GROUPS.map((g) => (
        <section key={g.id} aria-labelledby={`jr-${g.id}`}>
          <h3 id={`jr-${g.id}`} className={H}>{g.title}</h3>
          <dl className="space-y-2">{g.items.map((it) => <div key={it.sig}><dt className="break-words font-mono text-[12.5px] text-ink">{it.sig}</dt><dd className="text-[12px] leading-snug text-grey-600">{it.note}</dd></div>)}</dl>
        </section>
      ))}
    </div>
  );
}
