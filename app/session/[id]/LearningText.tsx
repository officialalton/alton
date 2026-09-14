"use client";

import { splitLearningBlocks, splitLearningContent, type ContentPart } from "@/lib/render-learning-content";

/**
 * 교재·문제 본문 한 덩어리를 읽기 좋게 그린다. 글 줄바꿈은 그대로 살리고,
 * 섞여 있는 수식($...$, $$...$$)은 수식으로 그린다.
 *
 * 깨진 수식은 원문을 그대로 보여준다 — 학생 화면에서 내용이 사라지는 것이
 * 가장 나쁘고, 교사가 오타를 발견할 수 있어야 한다.
 */
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
              {part.value}
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
            // 좁은 화면에서 긴 수식이 잘리지 않도록 가로 스크롤을 허용한다.
            className={
              part.display
                ? "block my-3 overflow-x-auto max-w-full"
                : "inline-block align-middle max-w-full overflow-x-auto"
            }
            dangerouslySetInnerHTML={{ __html: part.html }}
          />
        );
      })}
    </>
  );
}
