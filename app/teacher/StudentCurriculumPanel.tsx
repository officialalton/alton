"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import UnitPrepPanel from "./UnitPrepPanel";
import { loadUnitPrepSummaries, type UnitPrepSummary } from "./unit-prep-actions";
import { useEffect } from "react";
import {
  ensureActiveOverlay,
  addCanonicalUnit,
  createSupplementUnit,
  excludeUnit,
  moveUnit,
  setUnitStatus,
  setActiveKeywords,
  previewBaseCurriculumUpdate,
  applyBaseCurriculumUpdate,
  previewAdditionalStudyUnitInsert,
  insertAdditionalStudyUnit,
  reloadCurriculumUnits,
  type BaseUpdateDiff,
  type AdditionalStudyUnitPreview,
} from "./student-curriculum-actions";
import type { EligibleLibrary, OverlayUnit, StudentCurriculum } from "./student-curriculum-data";

const STATUS_LABEL: Record<OverlayUnit["status"], string> = {
  not_started: "미시작",
  in_progress: "진행 중",
  completed: "완료",
  reinforcement_needed: "보강 필요",
  skipped: "건너뜀",
};

function formatSessionTime(startsAt: string | null): string {
  if (!startsAt) return "다음 예약 없음";
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return "다음 예약 없음";
  const date = d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
  const time = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time} 수업`;
}

// R9(Task 3) — 선생님이 담당 학생의 운영 커리큘럼(오버레이)을 조정하는 화면.
// 원본 문제 생성은 이 화면에 없다(스펙 §7 "학생별 커리큘럼 조정·보강 단원
// 조립" 행만 선생님에게 허용 — 원본 문제·교재 직접 공개는 명시적 제외).
// 2026-09-09(UAT 지적, 제품 오너 승인): 단원별 키워드 태그(추가·제외)는 이
// 원칙과 별개다 — 실제 문제·교재를 노출하는 게 아니라, 세션 준비 화면에서
// "이 단원에 맞는 공개 교재/문제 후보"를 검색하는 데 쓰이는 메타데이터일
// 뿐이라 여기서 편집 가능하게 한다.
export default function StudentCurriculumPanel({
  subjectEnrollmentId,
  initial,
  library,
  studentName = "",
  subjectName = "",
  studentId,
}: {
  subjectEnrollmentId: string;
  initial: StudentCurriculum;
  library: EligibleLibrary;
  studentName?: string;
  subjectName?: string;
  studentId?: string;
}) {
  const router = useRouter();
  // P2/P3 3단계 — 예약이 없어도 여기서 바로 회차를 준비한다.
  const [preparingUnit, setPreparingUnit] = useState<{ id: string; title: string } | null>(null);
  // 회차별 준비 상태를 한 번에 불러와 목록에서 바로 보여준다.
  const [prepSummaries, setPrepSummaries] = useState<Record<string, UnitPrepSummary>>({});
  const [overlayId, setOverlayId] = useState(initial.overlayId);
  const [units, setUnits] = useState(initial.units);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateDiffUnitId, setUpdateDiffUnitId] = useState<string | null>(null);
  const [updateDiff, setUpdateDiff] = useState<BaseUpdateDiff | null>(null);
  const [applyingUpdate, setApplyingUpdate] = useState(false);

  // 2026-09-18 — "다음 수업에 추가 학습 회차 넣기" 확인 패널 상태.
  const [additionalStudyUnitId, setAdditionalStudyUnitId] = useState<string | null>(null);
  const [additionalStudyPreview, setAdditionalStudyPreview] = useState<AdditionalStudyUnitPreview | null>(null);
  const [additionalStudyBusy, setAdditionalStudyBusy] = useState(false);

  async function handleOpenUpdateDiff(unitId: string) {
    setError(null);
    setUpdateDiff(null);
    setUpdateDiffUnitId(unitId);
    try {
      const diff = await previewBaseCurriculumUpdate(subjectEnrollmentId, unitId);
      setUpdateDiff(diff);
    } catch (e) {
      setError(e instanceof Error ? e.message : "변경 내용을 불러오지 못했습니다.");
      setUpdateDiffUnitId(null);
    }
  }

  async function handleApplyUpdate(unitId: string) {
    setApplyingUpdate(true);
    setError(null);
    try {
      const result = await applyBaseCurriculumUpdate(subjectEnrollmentId, unitId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, needsBaseUpdate: false } : u)));
      setUpdateDiffUnitId(null);
      setUpdateDiff(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "기준본 업데이트 적용에 실패했습니다.");
    } finally {
      setApplyingUpdate(false);
    }
  }

  async function handleOpenAdditionalStudyPreview(unitId: string) {
    setError(null);
    setAdditionalStudyPreview(null);
    setAdditionalStudyUnitId(unitId);
    try {
      const result = await previewAdditionalStudyUnitInsert(subjectEnrollmentId, unitId);
      if (!result.ok) {
        setError(result.error);
        setAdditionalStudyUnitId(null);
        return;
      }
      setAdditionalStudyPreview(result.preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "미리보기를 불러오지 못했습니다.");
      setAdditionalStudyUnitId(null);
    }
  }

  async function handleConfirmAdditionalStudyUnit(unitId: string) {
    setAdditionalStudyBusy(true);
    setError(null);
    try {
      const result = await insertAdditionalStudyUnit(subjectEnrollmentId, unitId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const refreshed = await reloadCurriculumUnits(subjectEnrollmentId);
      setOverlayId(refreshed.overlayId);
      setUnits(refreshed.units);
      setAdditionalStudyUnitId(null);
      setAdditionalStudyPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "추가 학습 회차를 넣지 못했습니다.");
    } finally {
      setAdditionalStudyBusy(false);
    }
  }

  async function withOverlayId(): Promise<string> {
    if (overlayId) return overlayId;
    const result = await ensureActiveOverlay(subjectEnrollmentId);
    // 서버가 사유를 값으로 돌려준다(Production 은 던진 예외를 가린다). 여기서 던지는 것은
    // 클라이언트 안이라 그대로 화면의 오류 문구가 된다.
    if (!result.ok) throw new Error(result.error);
    setOverlayId(result.overlayId);
    return result.overlayId;
  }

  async function handleAddCanonical(sourceUnitId: string, unitTitle: string) {
    setError(null);
    try {
      const id = await withOverlayId();
      const result = await addCanonicalUnit(subjectEnrollmentId, id, sourceUnitId, unitTitle);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setUnits((prev) => [...prev, result.unit]);
      setShowAddPanel(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "단원 추가에 실패했습니다.");
    }
  }

  async function handleCreateSupplement(unitTitle: string) {
    setError(null);
    try {
      const id = await withOverlayId();
      const unit = await createSupplementUnit(subjectEnrollmentId, id, unitTitle);
      setUnits((prev) => [...prev, unit]);
      setShowAddPanel(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "보강 단원 추가에 실패했습니다.");
    }
  }

  async function handleExclude(unitId: string) {
    setError(null);
    try {
      await excludeUnit(subjectEnrollmentId, unitId);
      setUnits((prev) => prev.filter((u) => u.id !== unitId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "단원 제외에 실패했습니다.");
    }
  }

  async function handleMove(unitId: string, direction: -1 | 1) {
    if (!overlayId) return;
    setError(null);
    try {
      const currentOrderedIds = units.map((u) => u.id);
      const reordered = await moveUnit(subjectEnrollmentId, overlayId, currentOrderedIds, unitId, direction);
      if (reordered.length === 0) return;
      const byId = new Map(reordered.map((u) => [u.id, u]));
      setUnits((prev) =>
        prev
          .map((u) => ({ ...u, position: byId.get(u.id)?.position ?? u.position }))
          .sort((a, b) => a.position - b.position)
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "순서 변경에 실패했습니다.");
    }
  }

  async function handleStatus(unitId: string, status: OverlayUnit["status"]) {
    setError(null);
    try {
      await setUnitStatus(subjectEnrollmentId, unitId, status);
      setUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, status } : u)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "상태 변경에 실패했습니다.");
    }
  }

  async function handleToggleKeyword(unitId: string, keywordId: string) {
    setError(null);
    const unit = units.find((u) => u.id === unitId);
    if (!unit) return;
    const nextKeywordIds = unit.keywordIds.includes(keywordId)
      ? unit.keywordIds.filter((id) => id !== keywordId)
      : [...unit.keywordIds, keywordId];
    try {
      await setActiveKeywords(subjectEnrollmentId, unitId, nextKeywordIds);
      setUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, keywordIds: nextKeywordIds } : u)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "키워드 변경에 실패했습니다.");
    }
  }

   
  useEffect(() => {
    if (preparingUnit) return;
    const ids = units.map((u) => u.id);
    if (ids.length === 0) return;
    let cancelled = false;
    loadUnitPrepSummaries(ids)
      .then((next) => {
        if (!cancelled) setPrepSummaries(next);
      })
      .catch(() => {
        // 준비 상태는 보조 정보다 — 못 불러와도 커리큘럼 자체는 계속 쓸 수 있어야 한다.
      });
    return () => {
      cancelled = true;
    };
  }, [units, preparingUnit]);

  if (preparingUnit) {
    return (
      <UnitPrepPanel
        overlayUnitId={preparingUnit.id}
        unitTitle={preparingUnit.title}
        studentName={studentName}
        subjectName={subjectName}
        onBack={() => setPreparingUnit(null)}
      />
    );
  }

  const sorted = [...units].sort((a, b) => a.position - b.position);
  const current = sorted.find((u) => u.status === "in_progress") ?? sorted[0];
  const upcoming = sorted.filter((u) => u.id !== current?.id);

  return (
    <div className="max-w-[640px] px-6 py-6">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="text-[16px] font-extrabold text-ink">학생 운영 커리큘럼</h2>
        {studentId && (
          <Link
            href={`/teacher/student/${studentId}/roadmap`}
            className="text-[11.5px] font-bold text-ink bg-grey-100 rounded-full px-3 py-1.5 shrink-0"
          >
            학생 프로필·로드맵 보기
          </Link>
        )}
      </div>
      <p className="text-[12.5px] text-grey-500 mb-4">
        기본 원본은 그대로 두고, 이 학생만의 추가·제외·재정렬·진도를 관리합니다.
      </p>

      {current && (
        <div className="border-[1.5px] border-ink rounded-xl px-4 py-3 mb-4">
          <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1">현재 단원</div>
          <div className="text-[13.5px] font-bold text-ink">{current.unitTitle}</div>
        </div>
      )}

      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">
        전체 단원 ({sorted.length})
      </div>
      {sorted.map((u, idx) => {
        const p = prepSummaries[u.id];
        const canInsertAdditionalStudyUnit = u.status === "in_progress" || u.status === "completed";
        return (
        <div key={u.id} className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3 mb-2.5">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[13px] font-bold text-ink">
              {u.unitTitle}
              {/* 기준본에서든 교사 기본 구성에서든 갈라져 나왔으면 보강이 아니다.
                  매칭 경로는 교사 회차만 가리키므로 그쪽도 함께 본다. */}
              {u.sourceUnitId === null && u.sourceTeacherTemplateUnitId === null && (
                <span className="ml-1.5 text-[10.5px] font-bold text-white bg-ink rounded-full px-1.5 py-0.5">
                  보강
                </span>
              )}
              {u.needsBaseUpdate && (
                <span className="ml-1.5 text-[10.5px] font-bold text-amber-700 bg-amber-100 rounded-full px-1.5 py-0.5">
                  교재·문제 변경 있음
                </span>
              )}
            </span>
            <div className="flex items-center gap-1.5">
              {u.needsBaseUpdate && (
                <button
                  onClick={() => handleOpenUpdateDiff(u.id)}
                  className="text-[11.5px] font-bold text-amber-700"
                >
                  변경 내용 보기
                </button>
              )}
              <button
                disabled={idx === 0}
                onClick={() => handleMove(u.id, -1)}
                className="text-[11.5px] font-semibold text-grey-500 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                disabled={idx === sorted.length - 1}
                onClick={() => handleMove(u.id, 1)}
                className="text-[11.5px] font-semibold text-grey-500 disabled:opacity-30"
              >
                ↓
              </button>
              <button
                onClick={() => {
                  // 2026-09-17(UAT 지적) — 이미 시작·완료된(취소 아닌) 수업이
                  // 있으면 준비 편집 화면이 아니라 실제 수업 화면으로 들어간다.
                  // 학생의 /unit-preview 경로가 이미 하는 것과 같은 규칙이다.
                  const frozenSessionId = prepSummaries[u.id]?.frozenSessionId;
                  if (frozenSessionId) {
                    router.push(`/session/${frozenSessionId}`);
                    return;
                  }
                  setPreparingUnit({ id: u.id, title: u.unitTitle });
                }}
                className="text-[11.5px] font-bold text-ink"
              >
                수업 준비
              </button>
              <button onClick={() => handleExclude(u.id)} className="text-[11.5px] font-semibold text-red">
                제외
              </button>
            </div>
          </div>
          {/* 2026-09-18(제품 오너 지시) — 회차 카드는 회차명·진행 상태·키워드·교재
              수·문제 수·가장 가까운 연결 수업의 실제 일시만 보여준다. "목표
              미작성", "수업 N개 연결됨" 같은 배지는 없앤다. */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {p && (
              <>
                <span className="text-[10.5px] font-bold rounded-full px-2 py-0.5 bg-grey-100 text-grey-500">
                  교재 {p.materialCount}개
                </span>
                <span className="text-[10.5px] font-bold rounded-full px-2 py-0.5 bg-grey-100 text-grey-500">
                  문제 {p.problemCount}개
                </span>
                <span
                  className={
                    "text-[10.5px] font-bold rounded-full px-2 py-0.5 " +
                    (p.nearestSessionStartsAt ? "bg-green/10 text-green" : "bg-grey-100 text-grey-500")
                  }
                >
                  {formatSessionTime(p.nearestSessionStartsAt)}
                </span>
                {p.hasFrozenLesson && (
                  <span className="text-[10.5px] font-bold rounded-full px-2 py-0.5 bg-ink text-white">
                    진행한 수업 있음
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={u.status}
              onChange={(e) => handleStatus(u.id, e.target.value as OverlayUnit["status"])}
              className="text-[12px] font-semibold px-2.5 py-1 border-[1.5px] border-grey-200 rounded-lg"
            >
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {canInsertAdditionalStudyUnit && (
              <button
                onClick={() => handleOpenAdditionalStudyPreview(u.id)}
                className="text-[11.5px] font-bold text-ink"
              >
                다음 수업에 추가 학습 회차 넣기
              </button>
            )}
          </div>

          {additionalStudyUnitId === u.id && (
            <div className="mt-2.5 pt-2.5 border-t border-grey-200 bg-grey-50 -mx-4 -mb-3 px-4 py-3 rounded-b-xl">
              {!additionalStudyPreview ? (
                <p className="text-[12px] text-grey-500">확인 내용을 불러오는 중...</p>
              ) : (
                <>
                  <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1.5">
                    새 회차: {additionalStudyPreview.newUnitTitle}
                  </div>
                  {additionalStudyPreview.affectedFutureSessions.length === 0 ? (
                    <p className="text-[12px] text-grey-500 mb-2">
                      바뀌는 예정 수업이 없습니다(아직 시작하지 않은 다음 예약이 없습니다).
                    </p>
                  ) : (
                    <ul className="text-[12px] text-ink mb-2 space-y-0.5">
                      {additionalStudyPreview.affectedFutureSessions.map((s) => (
                        <li key={s.sessionId}>
                          {formatSessionTime(s.startsAt)} → {s.resultingUnitTitle}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[11.5px] text-grey-500 mb-2">
                    영향받지 않는 시작·완료 수업 {additionalStudyPreview.unaffectedStartedOrCompletedCount}개
                  </p>
                  <div className="flex gap-2">
                    <button
                      disabled={additionalStudyBusy}
                      onClick={() => handleConfirmAdditionalStudyUnit(u.id)}
                      className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
                    >
                      {additionalStudyBusy ? "넣는 중..." : "추가 학습 회차 넣기"}
                    </button>
                    <button
                      disabled={additionalStudyBusy}
                      onClick={() => {
                        setAdditionalStudyUnitId(null);
                        setAdditionalStudyPreview(null);
                      }}
                      className="text-[12px] font-semibold text-grey-500"
                    >
                      취소
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {library.keywords.length > 0 && (
            <div className="mt-2.5 pt-2.5 border-t border-grey-100">
              <div className="text-[10.5px] font-bold text-grey-300 uppercase tracking-wide mb-1.5">
                키워드 — 세션 준비 시 이 단원에 맞는 교재·문제를 찾는 기준
              </div>
              <div className="flex flex-wrap gap-1.5">
                {library.keywords.map((k) => {
                  const active = u.keywordIds.includes(k.id);
                  return (
                    <button
                      key={k.id}
                      onClick={() => handleToggleKeyword(u.id, k.id)}
                      className={
                        "text-[11.5px] font-semibold px-2.5 py-1 rounded-full border-[1.5px] " +
                        (active ? "bg-ink text-white border-ink" : "border-grey-200 text-grey-500")
                      }
                    >
                      {k.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {updateDiffUnitId === u.id && (
            <div className="mt-2.5 pt-2.5 border-t border-amber-200 bg-amber-50/50 -mx-4 -mb-3 px-4 py-3 rounded-b-xl">
              {!updateDiff ? (
                <p className="text-[12px] text-grey-500">변경 내용을 불러오는 중...</p>
              ) : (
                <>
                  <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wide mb-1.5">
                    적용하면 이렇게 바뀝니다(학생이 직접 조정한 값은 그대로 유지됩니다)
                  </div>
                  {updateDiff.addedKeywordLabels.length === 0 &&
                  updateDiff.removedKeywordLabels.length === 0 &&
                  updateDiff.addedMaterialTitles.length === 0 &&
                  updateDiff.removedMaterialTitles.length === 0 ? (
                    <p className="text-[12px] text-grey-500 mb-2">
                      기준본 버전은 갱신됐지만, 실제로 추가·제거될 항목은 없습니다.
                    </p>
                  ) : (
                    <ul className="text-[12px] text-ink mb-2 space-y-0.5">
                      {updateDiff.addedKeywordLabels.map((l) => (
                        <li key={`add-kw-${l}`}>키워드: {l} 추가</li>
                      ))}
                      {updateDiff.removedKeywordLabels.map((l) => (
                        <li key={`rm-kw-${l}`}>키워드: {l} 제거</li>
                      ))}
                      {updateDiff.addedMaterialTitles.map((l) => (
                        <li key={`add-mat-${l}`}>교재: {l} 추가</li>
                      ))}
                      {updateDiff.removedMaterialTitles.map((l) => (
                        <li key={`rm-mat-${l}`}>교재: {l} 제거</li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-2">
                    <button
                      disabled={applyingUpdate}
                      onClick={() => handleApplyUpdate(u.id)}
                      className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
                    >
                      {applyingUpdate ? "반영 중..." : "구성에 반영"}
                    </button>
                    <button
                      disabled={applyingUpdate}
                      onClick={() => {
                        setUpdateDiffUnitId(null);
                        setUpdateDiff(null);
                      }}
                      className="text-[12px] font-semibold text-grey-500"
                    >
                      취소
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        );
      })}

      {upcoming.length === 0 && sorted.length === 0 && (
        <p className="text-[12.5px] text-grey-500 mb-3">아직 단원이 없습니다. 기본 원본에서 불러오거나 보강 단원을 만드세요.</p>
      )}

      {showAddPanel ? (
        <AddUnitPanel
          library={library}
          onAddCanonical={handleAddCanonical}
          onCreateSupplement={handleCreateSupplement}
          onCancel={() => setShowAddPanel(false)}
        />
      ) : (
        <button
          onClick={() => setShowAddPanel(true)}
          className="text-[12.5px] font-bold px-4 py-2.5 rounded-lg border-[1.5px] border-grey-200 text-ink w-full mt-2"
        >
          + 라이브러리에서 불러오기 / 보강 단원 만들기
        </button>
      )}
      {error && <p className="text-[12px] text-red mt-2">{error}</p>}
    </div>
  );
}

function AddUnitPanel({
  library,
  onAddCanonical,
  onCreateSupplement,
  onCancel,
}: {
  library: EligibleLibrary;
  onAddCanonical: (sourceUnitId: string, unitTitle: string) => void;
  onCreateSupplement: (unitTitle: string) => void;
  onCancel: () => void;
}) {
  const [supplementTitle, setSupplementTitle] = useState("");

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3.5">
      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">
        기본 원본에서 불러오기
      </div>
      {library.units.length === 0 && (
        <p className="text-[12px] text-grey-500 mb-2">불러올 수 있는 원본 단원이 없습니다.</p>
      )}
      {library.units.map((u) => (
        <button
          key={u.id}
          onClick={() => onAddCanonical(u.id, u.unitTitle)}
          className="block w-full text-left px-3 py-2 text-[12.5px] rounded-lg hover:bg-grey-100 mb-1"
        >
          {u.unitTitle}
        </button>
      ))}

      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2 mt-4">
        학생 전용 보강 단원 만들기
      </div>
      <div className="flex gap-2 mb-3">
        <input
          value={supplementTitle}
          onChange={(e) => setSupplementTitle(e.target.value)}
          placeholder="보강 단원 제목"
          className="flex-1 px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
        />
        <button
          disabled={!supplementTitle.trim()}
          onClick={() => {
            onCreateSupplement(supplementTitle.trim());
            setSupplementTitle("");
          }}
          className="text-[12px] font-bold px-3.5 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
        >
          만들기
        </button>
      </div>

      <button onClick={onCancel} className="text-[12px] font-semibold text-grey-500">
        취소
      </button>
    </div>
  );
}
