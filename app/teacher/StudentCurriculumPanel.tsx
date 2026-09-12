"use client";

import { useState } from "react";
import UnitPrepPanel from "./UnitPrepPanel";
import {
  ensureActiveOverlay,
  addCanonicalUnit,
  createSupplementUnit,
  excludeUnit,
  moveUnit,
  setUnitStatus,
  setActiveKeywords,
} from "./student-curriculum-actions";
import type { EligibleLibrary, OverlayUnit, StudentCurriculum } from "./student-curriculum-data";

const STATUS_LABEL: Record<OverlayUnit["status"], string> = {
  not_started: "미시작",
  in_progress: "진행 중",
  completed: "완료",
  reinforcement_needed: "보강 필요",
  skipped: "건너뜀",
};

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
}: {
  subjectEnrollmentId: string;
  initial: StudentCurriculum;
  library: EligibleLibrary;
  studentName?: string;
  subjectName?: string;
}) {
  // P2/P3 3단계 — 예약이 없어도 여기서 바로 회차를 준비한다.
  const [preparingUnit, setPreparingUnit] = useState<{ id: string; title: string } | null>(null);
  const [overlayId, setOverlayId] = useState(initial.overlayId);
  const [units, setUnits] = useState(initial.units);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withOverlayId(): Promise<string> {
    if (overlayId) return overlayId;
    const id = await ensureActiveOverlay(subjectEnrollmentId);
    setOverlayId(id);
    return id;
  }

  async function handleAddCanonical(sourceUnitId: string, unitTitle: string) {
    setError(null);
    try {
      const id = await withOverlayId();
      const unit = await addCanonicalUnit(subjectEnrollmentId, id, sourceUnitId, unitTitle);
      setUnits((prev) => [...prev, unit]);
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
      <h2 className="text-[16px] font-extrabold text-ink mb-1">학생 운영 커리큘럼</h2>
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
      {sorted.map((u, idx) => (
        <div key={u.id} className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3 mb-2.5">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[13px] font-bold text-ink">
              {u.unitTitle}
              {u.sourceUnitId === null && (
                <span className="ml-1.5 text-[10.5px] font-bold text-white bg-ink rounded-full px-1.5 py-0.5">
                  보강
                </span>
              )}
            </span>
            <div className="flex items-center gap-1.5">
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
                onClick={() => setPreparingUnit({ id: u.id, title: u.unitTitle })}
                className="text-[11.5px] font-bold text-ink"
              >
                회차 준비
              </button>
              <button onClick={() => handleExclude(u.id)} className="text-[11.5px] font-semibold text-red">
                제외
              </button>
            </div>
          </div>
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
        </div>
      ))}

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
