"use client";

import type { SessionLessonContext } from "./session-context-data";

// P2/P3 5단계 — 수업 화면의 머리말. "지금 어디에 있는가"와 "이 시간의 목표"를
// 한눈에 준다. 커리큘럼 → 회차 준비 → 수업 → 복습이 같은 말로 이어지도록,
// 여기 쓰는 단어는 준비 화면과 동일하다(회차 이름, 회차 목표).
export default function LessonContextHeader({
  studentName,
  subjectName,
  context,
  stateLabel,
  canPrepare = false,
}: {
  studentName: string;
  subjectName: string;
  context: SessionLessonContext;
  /** 수업 전 / 수업 중 / 지난 수업 — 사용자 문구로만 표현한다. */
  stateLabel: string;
  /**
   * 이 수업의 구성을 고칠 수 있는 사람인가. 학생·학부모에게는 준비 화면으로 가는
   * 길을 보여주지 않는다 — 구성 편집과 교사 전용 초안은 그들의 것이 아니다(7절).
   */
  canPrepare?: boolean;
}) {
  const trail = [subjectName, context.unitTitle].filter(Boolean).join(" › ");

  return (
    <header className="border-b-[1.5px] border-grey-200 px-5 sm:px-8 py-4">
      <div className="max-w-[760px] mx-auto">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
          <span className="text-[11.5px] font-bold text-grey-500">
            {studentName ? `${studentName} 학생` : "내 수업"}
          </span>
          {trail && <span className="text-[11.5px] text-grey-300">·</span>}
          {trail && <span className="text-[11.5px] font-semibold text-grey-500">{trail}</span>}
          <span className="text-[10.5px] font-bold text-grey-500 bg-grey-100 rounded-full px-2 py-0.5 ml-auto">
            {stateLabel}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <h1 className="text-[19px] sm:text-[21px] font-extrabold text-ink leading-tight">
            {context.unitTitle ?? "이번 수업"}
          </h1>
          {/* 4절 — 커리큘럼 → 수업 준비 → 수업 → 복습이 같은 말로 이어진다. */}
          {canPrepare && context.primaryUnitId && (
            <a
              href={`/lesson-prep/student/${context.primaryUnitId}`}
              className="text-[12px] font-bold text-grey-500 underline underline-offset-2 shrink-0"
            >
              수업 준비
            </a>
          )}
        </div>

        {context.goal ? (
          <p className="text-[13.5px] leading-[1.65] text-grey-500 mt-1.5">{context.goal}</p>
        ) : (
          <p className="text-[13px] text-grey-400 mt-1.5">이 회차의 목표가 아직 적히지 않았습니다.</p>
        )}

        {context.supplementTitles.length > 0 && (
          <p className="text-[12px] text-grey-500 mt-1.5">
            함께 다루는 회차 · {context.supplementTitles.join(", ")}
          </p>
        )}
      </div>
    </header>
  );
}
