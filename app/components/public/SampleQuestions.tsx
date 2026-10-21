import type { Sample } from "@/lib/landing/samples";

/** 자체 제작 샘플 문항. 정답·해설을 본문에 포함해 크롤 가능하게 둔다(details는 열기 전에도 HTML에 존재). */
export function SampleQuestions({ samples, heading = "Sample practice questions" }: { samples: Sample[]; heading?: string }) {
  if (samples.length === 0) return null;
  return (
    <section aria-labelledby="sample-questions">
      <h2 id="sample-questions">{heading}</h2>
      <p>These questions were written by ALTON for practice. They are not official exam questions.</p>
      {samples.map((s) => (
        <article key={s.prompt} className="my-4 rounded border border-[var(--p-line)] p-4">
          <p className="text-[12px] uppercase tracking-wide text-[var(--p-slate)]">{s.topic}</p>
          <p className="whitespace-pre-line font-medium">{s.prompt}</p>
          {s.choices && (
            <ul className="list-none pl-0">
              {s.choices.map((c) => <li key={c}>{c}</li>)}
            </ul>
          )}
          <details>
            <summary className="cursor-pointer">Show answer and explanation</summary>
            <p><strong>Answer: {s.answer}</strong></p>
            <p>{s.explanation}</p>
          </details>
        </article>
      ))}
    </section>
  );
}
