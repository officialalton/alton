"use client";

import { useEffect, useState } from "react";
import { loadMyCurriculumOverlay } from "./curriculum-overlay-actions";
import type { OverlayUnit, StudentCurriculum } from "@/lib/curriculum-overlay-data";
import { formatCurriculumProgressLabel } from "@/lib/curriculum-overlay-progress";

// v3 커리큘럼 열람 결함 수정(2026-09-11) — 학생·학부모용 읽기 전용 v3 운영
// 커리큘럼(curriculum_overlay_units) 화면. 교사용 StudentCurriculumPanel과
// 달리 이동·제외·키워드 토글·단원 추가 등 편집 UI를 전혀 렌더링하지 않는다
// — 이 컴포넌트에는 그런 핸들러 자체가 없다(숨김이 아니라 부재).
// 학생 포털("수강 과목" 탭, app/student/EnrollmentTab.tsx)과 학부모 포털
// (같은 컴포넌트를 자녀별로 재사용, app/parent/EnrollmentTab.tsx)이 이
// 하나를 공유한다.

const STATUS_LABEL: Record<OverlayUnit["status"], string> = {
  not_started: "예정",
  in_progress: "진행중",
  completed: "완료",
  reinforcement_needed: "다시 보기",
  skipped: "건너뜀",
};

const STATUS_TONE: Record<OverlayUnit["status"], string> = {
  not_started: "bg-grey-100 text-grey-500",
  in_progress: "bg-yellow-bg text-ink",
  completed: "bg-green-bg text-green",
  reinforcement_needed: "bg-red/10 text-red",
  skipped: "bg-grey-100 text-grey-400",
};

export default function CurriculumOverlayView({
  subjectEnrollmentId,
  subjectName,
  onBack,
}: {
  subjectEnrollmentId: string;
  subjectName: string;
  onBack: () => void;
}) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; data: StudentCurriculum }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadMyCurriculumOverlay(subjectEnrollmentId)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((e) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: e instanceof Error ? e.message : "불러오지 못했습니다.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [subjectEnrollmentId]);

  const units = state.status === "ready" ? state.data.units : [];
  const currentUnit = units.find((u) => u.status === "in_progress") ?? null;
  const nextUnit =
    units.find(
      (u) =>
        u.status === "not_started" &&
        (!currentUnit || u.position > currentUnit.position)
    ) ?? null;

  return (
    <div className="max-w-[640px] px-8 py-8">
      <button onClick={onBack} className="text-[13px] text-grey-500 font-semibold mb-4">
        ← 뒤로
      </button>

      <div className="flex items-center justify-between mb-1.5">
        <h1 className="text-[20px] font-extrabold text-ink">{subjectName}</h1>
        {state.status === "ready" && (
          <span className="text-[12px] font-bold px-3 py-1 rounded-full bg-grey-100 text-ink">
            {formatCurriculumProgressLabel({
              totalUnits: units.length,
              doneUnits: units.filter((u) => u.status === "completed" || u.status === "skipped").length,
              sourceLabel: null,
            })}
          </span>
        )}
      </div>

      {state.status === "loading" && (
        <div className="text-[13px] text-grey-500 py-8">불러오는 중...</div>
      )}
      {state.status === "error" && (
        <div className="text-[13px] text-red py-8">{state.message}</div>
      )}

      {state.status === "ready" && (
        <>
          {(currentUnit || nextUnit) && (
            <div className="mb-5 space-y-1.5">
              {currentUnit && (
                <div className="text-[12.5px] text-ink">
                  <span className="font-bold">현재 단원</span> · {currentUnit.unitTitle}
                </div>
              )}
              {nextUnit && (
                <div className="text-[12.5px] text-grey-500">
                  <span className="font-bold text-ink">다음 학습</span> · {nextUnit.unitTitle}
                </div>
              )}
            </div>
          )}

          {units.length === 0 ? (
            <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
              아직 배정된 커리큘럼이 없습니다.
            </div>
          ) : (
            <div>
              {units.map((u) => (
                <div
                  key={u.id}
                  className="border-[1.5px] border-grey-200 rounded-xl px-5 py-3.5 mb-2.5"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-bold text-ink">
                      {u.position}. {u.unitTitle}
                    </span>
                    <span
                      className={
                        "text-[11px] font-bold px-2.5 py-0.5 rounded-full " + STATUS_TONE[u.status]
                      }
                    >
                      {STATUS_LABEL[u.status]}
                    </span>
                  </div>
                  {u.note && <p className="text-[12.5px] text-grey-500">{u.note}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
