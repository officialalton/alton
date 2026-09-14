"use client";

import { useEffect, useState } from "react";
import {
  loadMyCurriculumOverlay,
  loadUnitPreview,
  type UnitPreview,
} from "./curriculum-overlay-actions";
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
  const [openUnitId, setOpenUnitId] = useState<string | null>(null);

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

                  {/* 2026-09-13 확정 — 예습 허용. 예약이나 수업 시작 여부로 막지
                      않는다. 열람만 하고 답을 제출하지는 않는다. */}
                  <button
                    onClick={() => setOpenUnitId(openUnitId === u.id ? null : u.id)}
                    className="text-[12px] font-bold text-ink mt-1.5"
                  >
                    {openUnitId === u.id ? "미리보기 닫기" : "교재·문제 미리보기"}
                  </button>
                  {openUnitId === u.id && <UnitPreviewPanel unitId={u.id} />}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * 회차의 교재·문제를 수업 전에 보여준다.
 *
 * 정답·해설은 서버 응답에 아예 담기지 않는다(unit_preview_for_viewer) — 여기서
 * 가리는 것이 아니다. 교사용 지도 노트(teaching_tip)도 마찬가지다.
 */
function UnitPreviewPanel({ unitId }: { unitId: string }) {
  const [preview, setPreview] = useState<UnitPreview | null | "loading" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    loadUnitPreview(unitId)
      .then((p) => {
        if (!cancelled) setPreview(p);
      })
      .catch(() => {
        if (!cancelled) setPreview("error");
      });
    return () => {
      cancelled = true;
    };
  }, [unitId]);

  if (preview === "loading") {
    return <p className="text-[12.5px] text-grey-500 mt-2">불러오는 중...</p>;
  }
  if (preview === "error") {
    return <p className="text-[12.5px] text-red mt-2">미리보기를 불러오지 못했습니다.</p>;
  }
  if (!preview) {
    return <p className="text-[12.5px] text-grey-500 mt-2">볼 수 있는 내용이 없습니다.</p>;
  }

  const empty = preview.materials.length === 0 && preview.problems.length === 0;

  return (
    <div className="mt-3 border-t-[1.5px] border-grey-200 pt-3">
      <p className="text-[12px] text-grey-500 mb-3">
        {preview.frozen
          ? "이 회차는 이미 수업에서 다뤘습니다. 그때 쓴 내용을 그대로 보여줍니다."
          : "수업 전까지 자료가 변경될 수 있습니다. 정답과 해설은 수업에서 확인합니다."}
      </p>

      {empty && (
        <p className="text-[12.5px] text-grey-500">
          아직 준비된 자료가 없습니다. 선생님이 담으면 여기에 나타납니다.
        </p>
      )}

      {preview.materials.length > 0 && (
        <section className="mb-4">
          <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1.5">
            교재
          </div>
          {preview.materials.map((m) => (
            <div key={m.curriculumDocId} className="mb-2.5">
              <div className="text-[13px] font-bold text-ink">{m.title}</div>
              {m.sections.length === 0 ? (
                <p className="text-[12px] text-grey-500 mt-0.5">
                  {m.versionId
                    ? "본문이 비어 있습니다."
                    : "이 교재는 아직 미리 볼 수 있는 내용이 저장되지 않았습니다."}
                </p>
              ) : (
                m.sections.map((sec) => (
                  <div key={sec.id} className="mt-1.5">
                    <div className="text-[12.5px] font-bold text-grey-500">{sec.title}</div>
                    <div
                      className="text-[12.5px] text-ink leading-[1.65] prose-sm"
                      dangerouslySetInnerHTML={{ __html: sec.body }}
                    />
                  </div>
                ))
              )}
            </div>
          ))}
        </section>
      )}

      {preview.problems.length > 0 && (
        <section>
          <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1.5">
            문제
          </div>
          {preview.problems.map((p, i) => (
            <div key={p.problemId} className="mb-2.5">
              <div className="text-[12.5px] text-ink whitespace-pre-wrap leading-[1.6]">
                {i + 1}. {p.passage ?? "(내용이 저장되지 않은 문제입니다)"}
              </div>
              {p.options && p.options.length > 0 && (
                <ol className="mt-1 space-y-0.5">
                  {p.options.map((o, j) => (
                    <li key={j} className="text-[12px] text-grey-500">
                      {j + 1}. {o}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
          <p className="text-[11.5px] text-grey-500 mt-2">
            정답과 해설은 아직 보이지 않습니다.
          </p>
        </section>
      )}
    </div>
  );
}
