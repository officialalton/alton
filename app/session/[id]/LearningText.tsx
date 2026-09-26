"use client";

import { splitLearningBlocks, splitLearningContent, type ContentPart } from "@/lib/render-learning-content";

/**
 * 교재·문제 본문 한 덩어리를 읽기 좋게 그린다. 글 줄바꿈은 그대로 살리고,
 * 섞여 있는 수식($...$, $$...$$)은 수식으로 그린다.
 *
 * 깨진 수식은 원문을 그대로 보여준다 — 학생 화면에서 내용이 사라지는 것이
 * 가장 나쁘고, 교사가 오타를 발견할 수 있어야 한다.
 */
// 2026-09-19(제품 오너 발견) — "200000"처럼 5자리 이상 정수가 천 단위 구분 쉼표 없이 그대로
// 나온 사례(옵션 텍스트: 지문·질문·선택지의 순수 텍스트 구간, 수식 $...$ 안은 건드리지 않는다 —
// 그건 KaTeX가 그대로 조판해야 하는 수식이다). 4자리 숫자(연도 등, 예: "2024")는 쉼표를 붙이면
// 오히려 어색해지므로 대상에서 뺀다. 소수의 소수부(".141592" 같은)는 정수가 아니므로 앞에 마침표가
// 있으면 건너뛴다.
function addThousandsSeparators(text: string): string {
  return text.replace(/(?<!\.)\b\d{5,}\b/g, (m) => m.replace(/\B(?=(\d{3})+(?!\d))/g, ","));
}

export default function LearningText({ text, className }: { text: string; className?: string }) {
  // 2026-09-14 문제 템플릿 ②: 마크다운 파이프 표는 표로 그린다. 나머지 줄은 글·수식 조각.
  const blocks = splitLearningBlocks(text);
  return (
    <div className={className}>
      {blocks.map((block, b) =>
        block.kind === "table" ? (
          <div key={b} className="my-3 overflow-x-auto">
            <table className="learning-table text-[13.5px] border-collapse">
              <thead>
                <tr>
                  {block.header.map((h, i) => (
                    <th key={i} className="border border-grey-200 bg-grey-100 px-3 py-1.5 text-left font-bold">
                      <Inline parts={splitLearningContent(h)} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, i) => (
                      <td key={i} className="border border-grey-200 px-3 py-1.5">
                        <Inline parts={splitLearningContent(cell)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : block.kind === "list" ? (
          <ul key={b} className="my-2 pl-5 list-disc">
            {block.items.map((item, i) => (
              <li key={i} className="mb-1">
                <Inline parts={splitLearningContent(item)} />
              </li>
            ))}
          </ul>
        ) : (
          <Inline key={b} parts={splitLearningContent(block.text)} />
        )
      )}
    </div>
  );
}

function Inline({ parts }: { parts: ContentPart[] }) {
  return (
    <>
      {parts.map((part, i) => {
        if (part.kind === "text") {
          return (
            <span key={i} className="whitespace-pre-wrap">
              {addThousandsSeparators(part.value)}
            </span>
          );
        }
        if (part.kind === "blank") {
          return (
            <span
              key={i}
              data-testid="rw-blank"
              aria-label="빈칸"
              className="inline-block min-w-[7ch] border-b-[1.5px] border-ink align-baseline mx-0.5"
            >
              &nbsp;
            </span>
          );
        }
        if (part.kind === "underline") {
          return (
            <span key={i} className="underline decoration-ink underline-offset-4 whitespace-pre-wrap">
              {part.value}
            </span>
          );
        }
        if (part.kind === "math-error") {
          return (
            <span
              key={i}
              title="수식을 읽을 수 없습니다"
              className="whitespace-pre-wrap underline decoration-red decoration-dotted underline-offset-4"
            >
              {part.source}
            </span>
          );
        }
        return (
          <span
            key={i}
            // 블록 수식은 줄을 차지하고, 인라인 수식은 글 흐름에 붙는다.
            // 좁은 화면에서 긴 수식이 잘리지 않도록 블록 수식만 가로 스크롤을 허용한다.
            // 2026-09-19(제품 오너 발견) — 인라인 수식에도 overflow-x-auto를 걸어뒀더니
            // KaTeX가 만드는 strut(폭 없는 정렬용 요소)의 1px 미만 서브픽셀 오버플로만으로도
            // 브라우저가 항상 작은 스크롤바 알약을 그렸다(모든 인라인 수식 옆에 회색 캡슐이
            // 붙어 보이던 원인). 인라인 수식은 대부분 짧아 스크롤이 필요 없으므로 뺀다.
            className={part.display ? "block my-3 overflow-x-auto max-w-full" : "inline-block align-middle max-w-full"}
            dangerouslySetInnerHTML={{ __html: part.html }}
          />
        );
      })}
    </>
  );
}
