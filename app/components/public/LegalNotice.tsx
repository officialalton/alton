import { LEGAL_LAST_UPDATED, STUDENT_TERMS_VERSION } from "@/lib/legal";

export default function LegalNotice({ sections }: { sections: { id: string; title: string }[] }) {
  return (
    <>
      <p className="p-mono m-0 text-[12.5px] text-[var(--p-mute)]">
        Last updated: {LEGAL_LAST_UPDATED} · Version {STUDENT_TERMS_VERSION}
      </p>
      <nav aria-label="Contents" className="border border-[var(--p-line)] bg-white px-5 py-4">
        <ol className="m-0 grid list-none gap-x-8 gap-y-1 p-0 text-[15px] sm:grid-cols-2">
          {sections.map((s, i) => (
            <li key={s.id} className="m-0">
              <a href={`#${s.id}`}>
                {i + 1}. {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}

export function LegalSection({ id, n, title, children }: { id: string; n: number; title: string; children: React.ReactNode }) {
  return (
    <>
      <h2 id={id} className="scroll-mt-24">
        {n}. {title}
      </h2>
      {children}
    </>
  );
}
