"use client";

import { useState } from "react";
import type { MockExamAttemptDetail } from "@/lib/mock-exam/attempt-data";
import { ItemDetail } from "@/app/student/mock-exam/[attemptId]/MockExamResultView";

const SECTION_LABEL: Record<string, string> = { rw: "R&W", math: "Math" };

/** 교사가 담당 학생이 실제로 어떻게 풀었는지 읽기 전용으로 보는 화면(2026-09-21 UAT 지적
 * "현황 쪽은... 들어가서 학생이 푼 페이지를 그대로 읽기전용으로 볼 수 있게"). 답 변경·저장
 * 버튼은 전혀 없다 — ItemDetail(학생 결과 화면과 같은 컴포넌트)만 재사용해 일관되게 보여준다. */
export default function TeacherMockExamAttemptViewer({ attempt }: { attempt: MockExamAttemptDetail }) {
  const [index, setIndex] = useState(0);
  const current = attempt.items[index];

  if (attempt.items.length === 0) return <p className="text-[13px] text-grey-500">문항이 없습니다.</p>;

  return (
    <div className="flex flex-col gap-3 md:flex-row">
      <div className="flex flex-wrap gap-1 md:w-[200px] md:flex-shrink-0 md:flex-col md:flex-nowrap md:overflow-y-auto md:max-h-[70vh]">
        {attempt.items.map((it, i) => {
          // 2026-09-21(UAT 지적) — 응답했다는 사실만이 아니라 정오(맞음/틀림)를 왼쪽 목록에서도
          // 바로 구분할 수 있어야 한다(틀린 문항은 빨간색). correct가 null이면 아직 채점 전이라
          // 응답 여부만 보여준다.
          const stateClass =
            i === index
              ? "bg-ink text-white"
              : it.correct === true
                ? "bg-green/10 text-ink"
                : it.correct === false
                  ? "bg-red/10 text-red"
                  : it.response
                    ? "bg-grey-200 text-ink"
                    : "bg-grey-100 text-grey-600";
          return (
            <button
              key={it.setItemId}
              type="button"
              onClick={() => setIndex(i)}
              className={`rounded px-2 py-1.5 text-left text-[12px] font-semibold ${stateClass}`}
            >
              {SECTION_LABEL[it.section] ?? it.section} {it.position}
            </button>
          );
        })}
      </div>
      {current && (
        <div className="min-w-0 flex-1">
          <ItemDetail item={current} attemptId={attempt.id} studentId={attempt.studentId} viewerIsOwner={false} />
        </div>
      )}
    </div>
  );
}
