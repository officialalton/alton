"use client";

import { useEffect, useState } from "react";
import {
  loadHeldSelectionsForEnrollment,
  loadEligibleContent,
  createPreparedSelection,
  addUnitToSelection,
  removeUnitFromSelection,
  setSelectionActiveKeywords,
  pickContentItem,
  excludeContentItem,
  includeContentItem,
  attachSelectionToSession,
  pinSessionSelection,
} from "./session-prep-actions";
import type { PreparedSelection, EligibleSelectionContent } from "./session-prep-data";
import type { OverlayUnit, LibraryKeyword } from "./student-curriculum-data";

// 2026-09-09(UAT 지적, 제품 오너 승인) — "세션 준비" 화면 최초 구현. 지금까지
// session-prep-data.ts/session-prep-actions.ts 백엔드(R9 Task 1-2)만 있고
// 이를 실제로 쓰는 화면이 전혀 없었다. 확정된 회차(오버레이 단원)와 그 단원의
// 키워드를 기준으로 공개된 교재 섹션·확정된 문제 후보를 찾고, 선생님이 실제로
// 고른 것만 세션에 고정(pin)한다 — 키워드는 검색 기준일 뿐, 교재·문제가
// 회차에 자동으로 붙지 않는다(명시적 pick 없이는 절대 붙지 않는다).
export default function SessionPrepPanel({
  subjectEnrollmentId,
  overlayUnits,
  keywords,
  sessionId,
  studentName,
  subjectName,
  onBack,
}: {
  subjectEnrollmentId: string;
  overlayUnits: OverlayUnit[];
  keywords: LibraryKeyword[];
  sessionId: string | null;
  // 2026-09-10(P0-2) — "이 세션"이 내부 id일 뿐 어느 학생·수업인지 화면에
  // 식별되지 않는다는 지적 반영. 지금은 특정 예정 수업(일시)까지 연결되지
  // 않아(sessionId가 항상 null인 진입 경로, P2-4에서 실제 세션 연결 예정)
  // 학생·과목까지만 표시한다.
  studentName: string;
  subjectName: string;
  onBack: () => void;
}) {
  const [selection, setSelection] = useState<PreparedSelection | null>(null);
  const [eligible, setEligible] = useState<EligibleSelectionContent>({ materialSections: [], problems: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh(preparedSelectionId?: string) {
    const id = preparedSelectionId ?? selection?.id;
    if (!id) return;
    const content = await loadEligibleContent(id);
    setEligible(content);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadHeldSelectionsForEnrollment(subjectEnrollmentId)
      .then(async (all) => {
        if (cancelled) return;
        // 이 세션(또는 아직 세션에 안 붙은 staged)에 해당하는 준비된 선택
        // 하나만 다룬다 — 한 번에 여러 개를 편집하지 않는다.
        const match = sessionId
          ? all.find((s) => s.sessionId === sessionId) ?? all.find((s) => s.status === "staged" && !s.sessionId)
          : all.find((s) => s.status === "staged" && !s.sessionId);
        setSelection(match ?? null);
        if (match) {
          const content = await loadEligibleContent(match.id);
          if (!cancelled) setEligible(content);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [subjectEnrollmentId, sessionId]);

  async function handleStart() {
    setError(null);
    try {
      const id = await createPreparedSelection(subjectEnrollmentId);
      setSelection({
        id,
        subjectEnrollmentId,
        teacherId: "",
        status: "staged",
        sessionId: null,
        pinnedAt: null,
        units: [],
        contentItems: [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "세션 준비를 시작하지 못했습니다.");
    }
  }

  async function handleToggleUnit(overlayUnitId: string) {
    if (!selection) return;
    setError(null);
    const existing = selection.units.find((u) => u.overlayUnitId === overlayUnitId);
    try {
      if (existing) {
        await removeUnitFromSelection(selection.id, existing.id);
        setSelection((prev) =>
          prev ? { ...prev, units: prev.units.filter((u) => u.id !== existing.id) } : prev
        );
      } else {
        const id = await addUnitToSelection(selection.id, overlayUnitId);
        setSelection((prev) =>
          prev
            ? { ...prev, units: [...prev.units, { id, overlayUnitId, position: prev.units.length + 1, keywordIds: [] }] }
            : prev
        );
      }
      await refresh(selection.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "회차 추가/제외에 실패했습니다.");
    }
  }

  async function handleToggleKeyword(preparedSelectionUnitId: string, keywordId: string) {
    if (!selection) return;
    setError(null);
    const unit = selection.units.find((u) => u.id === preparedSelectionUnitId);
    if (!unit) return;
    const nextKeywordIds = unit.keywordIds.includes(keywordId)
      ? unit.keywordIds.filter((id) => id !== keywordId)
      : [...unit.keywordIds, keywordId];
    // 2026-09-10(P0-2) — setSelectionActiveKeywords()가 이제 던지지 않고
    // { ok, error }를 반환한다(Minified React error #441 마스킹 버그 수정 —
    // production에서 서버 액션이 throw하면 이 화면에 그 마스킹된 문구가 그대로
    // 노출됐다).
    const result = await setSelectionActiveKeywords(selection.id, preparedSelectionUnitId, nextKeywordIds);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSelection((prev) =>
      prev
        ? { ...prev, units: prev.units.map((u) => (u.id === preparedSelectionUnitId ? { ...u, keywordIds: nextKeywordIds } : u)) }
        : prev
    );
    await refresh(selection.id);
  }

  async function handlePick(preparedSelectionUnitId: string, contentType: "material_section" | "problem", contentId: string) {
    if (!selection) return;
    setError(null);
    try {
      const id = await pickContentItem(selection.id, preparedSelectionUnitId, contentType, contentId);
      setSelection((prev) =>
        prev
          ? {
              ...prev,
              contentItems: [
                ...prev.contentItems,
                { id, preparedSelectionUnitId, contentType, contentId, position: prev.contentItems.length + 1, included: true },
              ],
            }
          : prev
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "선택에 실패했습니다.");
    }
  }

  async function handleToggleInclude(contentItemId: string, currentlyIncluded: boolean) {
    if (!selection) return;
    setError(null);
    try {
      if (currentlyIncluded) await excludeContentItem(selection.id, contentItemId);
      else await includeContentItem(selection.id, contentItemId);
      setSelection((prev) =>
        prev
          ? { ...prev, contentItems: prev.contentItems.map((c) => (c.id === contentItemId ? { ...c, included: !currentlyIncluded } : c)) }
          : prev
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "포함/제외 변경에 실패했습니다.");
    }
  }

  async function handleAttachAndPin() {
    if (!selection || !sessionId) return;
    setError(null);
    try {
      if (!selection.sessionId) {
        await attachSelectionToSession(selection.id, sessionId);
      }
      await pinSessionSelection(sessionId);
      setSelection((prev) => (prev ? { ...prev, status: "pinned", sessionId, pinnedAt: new Date().toISOString() } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "세션 고정에 실패했습니다.");
    }
  }

  const keywordLabelById = new Map(keywords.map((k) => [k.id, k.label]));
  const unitTitleByOverlayUnitId = new Map(overlayUnits.map((u) => [u.id, u.unitTitle]));

  return (
    <div className="max-w-[640px] px-6 py-6">
      <button onClick={onBack} className="text-[13px] text-grey-500 font-semibold mb-4">
        ← 뒤로
      </button>
      <h2 className="text-[16px] font-extrabold text-ink mb-1">세션 준비</h2>
      {/* 2026-09-10(P0-2) — "이번 수업"을 학생·과목으로 식별해 상단에 표시 */}
      <div className="text-[12px] text-grey-500 font-semibold mb-2">
        {studentName} 학생 · {subjectName}
      </div>
      <p className="text-[12.5px] text-grey-500 mb-4">
        확정할 회차와 키워드를 고르면 그 키워드로 검색되는 공개 교재·문제
        후보가 아래에 뜹니다. 실제로 이 세션에 쓸 자료는 직접 골라야만
        붙습니다 — 키워드만으로 자동 첨부되지 않습니다.
      </p>

      {loading && <p className="text-[13px] text-grey-500">불러오는 중...</p>}
      {error && <p className="text-[12px] text-red mb-3">{error}</p>}

      {!loading && !selection && (
        <button
          onClick={handleStart}
          className="text-[12.5px] font-bold px-4 py-2.5 rounded-lg border-[1.5px] border-grey-200 text-ink w-full"
        >
          + 새 세션 준비 시작
        </button>
      )}

      {selection && selection.status === "pinned" && (
        <p className="text-[12.5px] text-ink bg-grey-100 rounded-lg px-3 py-2 mb-3">
          이 세션의 콘텐츠 구성은 이미 고정되었습니다({selection.pinnedAt}). 고정 후에는 이 화면에서 더 조정할 수 없습니다.
        </p>
      )}

      {selection && (
        <>
          <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1">
            이번 수업에 포함할 회차
          </div>
          {/* 2026-09-10(P0-2) — "포함할 회차"가 무슨 뜻인지(이번 수업에서
              참조할 커리큘럼 회차) 짧게 안내. P2-4에서 키워드 자동 구성으로
              바뀌면 이 문구·흐름도 그 정책에 맞게 다시 정리한다. */}
          <p className="text-[11px] text-grey-400 mb-2">
            이번 수업에서 다룰 커리큘럼 회차를 고르세요 — 고른 회차의 키워드로
            아래 교재·문제 후보가 검색됩니다.
          </p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {overlayUnits.map((u) => {
              const included = selection.units.some((su) => su.overlayUnitId === u.id);
              return (
                <button
                  key={u.id}
                  disabled={selection.status === "pinned"}
                  onClick={() => handleToggleUnit(u.id)}
                  className={
                    "text-[12px] font-semibold px-3 py-1.5 rounded-full border-[1.5px] disabled:opacity-50 " +
                    (included ? "bg-ink text-white border-ink" : "border-grey-200 text-ink")
                  }
                >
                  {u.unitTitle}
                </button>
              );
            })}
          </div>

          {selection.units.map((su) => (
            <div key={su.id} className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3 mb-3">
              <div className="text-[13px] font-bold text-ink mb-1.5">
                {unitTitleByOverlayUnitId.get(su.overlayUnitId) ?? "회차"}
              </div>
              <div className="text-[10.5px] font-bold text-grey-300 uppercase tracking-wide mb-1.5">
                검색 키워드
              </div>
              <div className="flex flex-wrap gap-1.5">
                {keywords.map((k) => {
                  const active = su.keywordIds.includes(k.id);
                  return (
                    <button
                      key={k.id}
                      disabled={selection.status === "pinned"}
                      onClick={() => handleToggleKeyword(su.id, k.id)}
                      className={
                        "text-[11.5px] font-semibold px-2.5 py-1 rounded-full border-[1.5px] disabled:opacity-50 " +
                        (active ? "bg-ink text-white border-ink" : "border-grey-200 text-grey-500")
                      }
                    >
                      {k.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3">
                <div className="text-[10.5px] font-bold text-grey-300 uppercase tracking-wide mb-1.5">
                  교재 후보
                </div>
                {eligible.materialSections.length === 0 && (
                  <p className="text-[12px] text-grey-500">키워드에 맞는 공개 교재가 없습니다.</p>
                )}
                {eligible.materialSections.map((s) => {
                  const picked = selection.contentItems.find(
                    (c) => c.preparedSelectionUnitId === su.id && c.contentType === "material_section" && c.contentId === s.sectionId
                  );
                  return (
                    <div key={s.sectionId} className="flex items-center justify-between text-[12.5px] px-2 py-1.5">
                      <span>
                        📖 {s.title}
                        {keywordLabelById.get(s.keywordId) && (
                          <span className="text-grey-500"> · {keywordLabelById.get(s.keywordId)}</span>
                        )}
                      </span>
                      {picked ? (
                        <button
                          disabled={selection.status === "pinned"}
                          onClick={() => handleToggleInclude(picked.id, picked.included)}
                          className={"text-[11.5px] font-bold disabled:opacity-50 " + (picked.included ? "text-ink" : "text-grey-500")}
                        >
                          {picked.included ? "포함됨(제외)" : "제외됨(포함)"}
                        </button>
                      ) : (
                        <button
                          disabled={selection.status === "pinned"}
                          onClick={() => handlePick(su.id, "material_section", s.sectionId)}
                          className="text-[11.5px] font-bold text-ink disabled:opacity-50"
                        >
                          선택
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-3">
                <div className="text-[10.5px] font-bold text-grey-300 uppercase tracking-wide mb-1.5">
                  문제 후보
                </div>
                {eligible.problems.length === 0 && (
                  <p className="text-[12px] text-grey-500">키워드에 맞는 확정된 문제가 없습니다.</p>
                )}
                {eligible.problems.map((p) => {
                  const picked = selection.contentItems.find(
                    (c) => c.preparedSelectionUnitId === su.id && c.contentType === "problem" && c.contentId === p.problemId
                  );
                  return (
                    <div key={p.problemId} className="flex items-center justify-between text-[12.5px] px-2 py-1.5">
                      <span className="truncate max-w-[380px]">
                        ✏️ {p.passage ?? "(지문 없음)"}
                        {keywordLabelById.get(p.keywordId) && (
                          <span className="text-grey-500"> · {keywordLabelById.get(p.keywordId)}</span>
                        )}
                      </span>
                      {picked ? (
                        <button
                          disabled={selection.status === "pinned"}
                          onClick={() => handleToggleInclude(picked.id, picked.included)}
                          className={"text-[11.5px] font-bold disabled:opacity-50 " + (picked.included ? "text-ink" : "text-grey-500")}
                        >
                          {picked.included ? "포함됨(제외)" : "제외됨(포함)"}
                        </button>
                      ) : (
                        <button
                          disabled={selection.status === "pinned"}
                          onClick={() => handlePick(su.id, "problem", p.problemId)}
                          className="text-[11.5px] font-bold text-ink disabled:opacity-50"
                        >
                          선택
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {sessionId && selection.status !== "pinned" && (
            <button
              onClick={handleAttachAndPin}
              className="text-[12.5px] font-bold px-4 py-2.5 rounded-lg bg-ink text-white w-full mt-2"
            >
              이 세션에 고정하기(이후 수정 불가)
            </button>
          )}
        </>
      )}
    </div>
  );
}
