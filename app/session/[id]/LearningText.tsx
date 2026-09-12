"use client";

import { splitLearningContent } from "@/lib/render-learning-content";

/**
 * 교재·문제 본문 한 덩어리를 읽기 좋게 그린다. 글 줄바꿈은 그대로 살리고,
 * 섞여 있는 수식($...$, $$...$$)은 수식으로 그린다.
 *
 * 깨진 수식은 원문을 그대로 보여준다 — 학생 화면에서 내용이 사라지는 것이
 * 가장 나쁘고, 교사가 오타를 발견할 수 있어야 한다.
 */
export default function LearningText({ text, className }: { text: string; className?: string }) {
  const parts = splitLearningContent(text);
  return (
    <div className={className}>
      {parts.map((part, i) => {
        if (part.kind === "text") {
          return (
            <span key={i} className="whitespace-pre-wrap">
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
    </div>
  );
}
