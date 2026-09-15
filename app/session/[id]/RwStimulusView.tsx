"use client";

import LearningText from "./LearningText";
import { parseRwStimulus } from "@/lib/rw-stimulus";

/**
 * 문제 지문을 RW 구조화 자료 블록으로 그린다(2026-09-14 제품 오너 지시).
 *   Text 1 / Text 2 → 제목이 있는 두 구역, 메모 목록 → 소개 줄 + 목록, 질문 → 본문과 나눈 굵은 단락,
 *   빈칸(______)·밑줄(__문장__) → LearningText 가 칸·밑줄로 그린다.
 * 구조가 하나도 없으면(옛 문제·한 단락 수학 문항) LearningText 와 똑같이 그린다 — 레거시 지문은 그대로 읽힌다.
 */
export default function RwStimulusView({ passage, className }: { passage: string; className?: string }) {
  const s = parseRwStimulus(passage);
  if (!s.structured) return <LearningText text={passage} className={className} />;
  return (
    <div className={className} data-testid="rw-stimulus">
      {s.blocks.map((b, i) => {
        if (b.kind === "text") {
          return (
            <section key={i} data-testid={`rw-${b.title.toLowerCase().replace(/\s+/g, "-")}`} className="mb-4">
              <h4 className="text-[12px] font-extrabold tracking-wide uppercase text-grey-500 mb-1">{b.title}</h4>
              <LearningText text={b.body} />
            </section>
          );
        }
        if (b.kind === "notes") {
          return (
            <div key={i} className="mb-4">
              <p className="whitespace-pre-wrap">{b.intro}</p>
              <ul className="my-2 pl-5 list-disc" data-testid="rw-notes">
                {b.items.map((it, j) => (
                  <li key={j} className="mb-1">
                    <LearningText text={it} />
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        if (b.kind === "question") {
          return (
            <div key={i} className="mt-4 font-semibold" data-testid="rw-question">
              <LearningText text={b.text} />
            </div>
          );
        }
        if (b.kind === "table") {
          // 옛 마크다운 표(레거시) — 그대로 표로 그린다. 새 문제는 figure(type:'data') 를 쓴다.
          return <LearningText key={i} text={["| " + b.header.join(" | ") + " |", "|" + b.header.map(() => "---").join("|") + "|", ...b.rows.map((r) => "| " + r.join(" | ") + " |")].join("\n")} />;
        }
        if (b.kind === "list") {
          return (
            <ul key={i} className="my-2 pl-5 list-disc">
              {b.items.map((it, j) => (
                <li key={j} className="mb-1">
                  <LearningText text={it} />
                </li>
              ))}
            </ul>
          );
        }
        return <LearningText key={i} text={b.text} className="mb-3" />;
      })}
    </div>
  );
}
