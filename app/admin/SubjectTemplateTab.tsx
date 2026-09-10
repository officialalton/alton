"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import {
  createSubject,
  renameSubject,
  deleteSubject,
  addSubjectUnit,
  updateSubjectUnit,
  removeSubjectUnit,
  moveSubjectUnit,
  createSubjectKeyword,
  assignUnitKeyword,
  removeUnitKeyword,
} from "./subject-actions";
import type { AdminSubject, SubjectKeyword, SubjectUnit } from "./subject-data";

export default function SubjectTemplateTab({
  subjects,
  setSubjects,
}: {
  subjects: AdminSubject[];
  setSubjects: Dispatch<SetStateAction<AdminSubject[]>>;
}) {
  const [openSubjectId, setOpenSubjectId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const open = subjects.find((s) => s.subjectId === openSubjectId);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    try {
      const created = await createSubject(name);
      setSubjects((prev) =>
        [...prev, { subjectId: created.id, subjectName: created.name, units: [] }].sort(
          (a, b) => a.subjectName.localeCompare(b.subjectName)
        )
      );
      setNewName("");
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "과목 추가에 실패했습니다.");
    }
  }

  function patchSubject(subjectId: string, patch: Partial<AdminSubject>) {
    setSubjects((prev) =>
      prev.map((s) => (s.subjectId === subjectId ? { ...s, ...patch } : s))
    );
  }

  function removeSubjectFromList(subjectId: string) {
    setSubjects((prev) => prev.filter((s) => s.subjectId !== subjectId));
  }

  if (open) {
    return (
      <SubjectDetailEditor
        subject={open}
        onBack={() => setOpenSubjectId(null)}
        onRenamed={(name) => patchSubject(open.subjectId, { subjectName: name })}
        onDeleted={() => {
          removeSubjectFromList(open.subjectId);
          setOpenSubjectId(null);
        }}
        onUnitsChange={(units) => patchSubject(open.subjectId, { units })}
        onKeywordsChange={(keywords) => patchSubject(open.subjectId, { keywords })}
        onArchived={(reason) =>
          patchSubject(open.subjectId, { archivedAt: new Date().toISOString(), archivedReason: reason })
        }
      />
    );
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">과목 템플릿</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        여기서 관리하는 과목·회차는 선생님의 커리큘럼 템플릿, 교재 생성 폼 등
        다른 화면의 선택지로 그대로 사용됩니다.
      </p>

      {subjects.map((s) => (
        <div
          key={s.subjectId}
          className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5 flex items-center justify-between"
        >
          <div>
            <div className="text-[13.5px] font-bold text-ink flex items-center gap-1.5">
              {s.subjectName}
              {s.archivedAt && (
                <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-grey-100 text-grey-500">
                  보관됨
                </span>
              )}
            </div>
            <div className="text-[12px] text-grey-500 mt-0.5">
              {s.units.length}개 회차
              {s.archivedAt && s.archivedReason ? ` · ${s.archivedReason}` : ""}
            </div>
          </div>
          <button
            onClick={() => setOpenSubjectId(s.subjectId)}
            className="text-[12px] font-bold px-3.5 py-2 rounded-lg border-[1.5px] border-grey-200 text-ink"
          >
            편집
          </button>
        </div>
      ))}

      {adding ? (
        <div className="flex gap-2 mt-3">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="새 과목명"
            className="flex-1 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
          />
          <button
            onClick={handleCreate}
            className="text-[12px] font-bold px-4 py-2 rounded-lg bg-ink text-white"
          >
            추가
          </button>
          <button
            onClick={() => {
              setAdding(false);
              setNewName("");
              setError(null);
            }}
            className="text-[12px] font-semibold text-grey-500 px-2"
          >
            취소
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="text-[12.5px] font-bold px-4 py-2.5 rounded-lg border-[1.5px] border-grey-200 text-ink w-full mt-2"
        >
          + 과목 추가
        </button>
      )}
      {error && <p className="text-[12px] text-red mt-2">{error}</p>}
    </div>
  );
}

function SubjectDetailEditor({
  subject,
  onBack,
  onRenamed,
  onDeleted,
  onUnitsChange,
  onKeywordsChange,
  onArchived,
}: {
  subject: AdminSubject;
  onBack: () => void;
  onRenamed: (name: string) => void;
  onDeleted: () => void;
  onUnitsChange: (units: SubjectUnit[]) => void;
  onKeywordsChange: (keywords: SubjectKeyword[]) => void;
  onArchived: (reason: string | null) => void;
}) {
  const [units, setUnits] = useState(subject.units);
  const [keywords, setKeywords] = useState(subject.keywords ?? []);
  const [newKeyword, setNewKeyword] = useState("");
  const [keywordError, setKeywordError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [archivedNotice, setArchivedNotice] = useState<string | null>(
    subject.archivedAt ? subject.archivedReason ?? "이 과목은 보관 처리되어 있습니다." : null
  );

  function commit(next: SubjectUnit[]) {
    setUnits(next);
    onUnitsChange(next);
  }

  async function handleCreateKeyword() {
    const label = newKeyword.trim();
    if (!label) return;
    setKeywordError(null);
    // 2026-09-10(P0-2) — createSubjectKeyword()가 이제 던지지 않고 { ok, error }를
    // 반환한다(Minified React error #441 마스킹 버그 수정 — production에서 서버
    // 액션이 throw하면 이 화면에 그 마스킹된 문구가 그대로 노출됐다).
    const result = await createSubjectKeyword(subject.subjectId, label);
    if (!result.ok) {
      setKeywordError(result.error);
      return;
    }
    const next = [...keywords, result.value].sort((a, b) => a.label.localeCompare(b.label));
    setKeywords(next);
    onKeywordsChange(next);
    setNewKeyword("");
  }

  async function handleToggleUnitKeyword(unitId: string, keywordId: string, currentlyTagged: boolean) {
    setKeywordError(null);
    const result = currentlyTagged
      ? await removeUnitKeyword(unitId, keywordId)
      : await assignUnitKeyword(unitId, keywordId);
    if (!result.ok) {
      setKeywordError(result.error);
      return;
    }
    commit(
      units.map((u) =>
        u.id === unitId
          ? {
              ...u,
              keywordIds: currentlyTagged
                ? (u.keywordIds ?? []).filter((id) => id !== keywordId)
                : [...(u.keywordIds ?? []), keywordId],
            }
          : u
      )
    );
  }

  async function handleRename(name: string) {
    if (!name.trim() || name === subject.subjectName) return;
    await renameSubject(subject.subjectId, name.trim());
    onRenamed(name.trim());
  }

  async function handleDelete() {
    setDeleteError(null);
    try {
      const result = await deleteSubject(subject.subjectId);
      setConfirmingDelete(false);
      if (result.archived) {
        setArchivedNotice(result.reason ?? "이 과목은 보관 처리되었습니다.");
        onArchived(result.reason);
        return;
      }
      onDeleted();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "삭제에 실패했습니다.");
      setConfirmingDelete(false);
    }
  }

  async function handleAdd() {
    const nextPosition =
      units.length === 0 ? 1 : Math.max(...units.map((u) => u.position)) + 1;
    const unit = await addSubjectUnit(subject.subjectId, nextPosition);
    commit([...units, unit]);
  }

  async function handleRemove(unitId: string) {
    await removeSubjectUnit(unitId);
    commit(units.filter((u) => u.id !== unitId));
  }

  async function handleField(unitId: string, field: "unitTitle" | "note", value: string) {
    commit(units.map((u) => (u.id === unitId ? { ...u, [field]: value } : u)));
    await updateSubjectUnit(unitId, { [field]: value });
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= units.length) return;
    const a = units[index];
    const b = units[target];
    await moveSubjectUnit(a.id, b.id);
    const next = [...units];
    next[index] = { ...b, position: a.position };
    next[target] = { ...a, position: b.position };
    next.sort((x, y) => x.position - y.position);
    commit(next);
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      <button
        onClick={onBack}
        className="text-[13px] text-grey-500 font-semibold mb-4"
      >
        ← 뒤로
      </button>

      <input
        defaultValue={subject.subjectName}
        onBlur={(e) => handleRename(e.target.value)}
        className="text-[20px] font-extrabold text-ink mb-5 w-full px-2 py-1 border-[1.5px] border-transparent hover:border-grey-200 focus:border-grey-200 rounded-lg -ml-2"
      />

      {/* 2026-09-09(UAT 지적, 제품 오너 승인) — 과목 공용 키워드 사전. 여기서
          만든 키워드가 아래 회차별 태깅, 교사 운영 커리큘럼 오버레이, 교재/문제
          태깅에서 그대로 재사용되는 원본이다. */}
      <div className="mb-5">
        <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">
          과목 키워드 사전
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {keywords.length === 0 && (
            <span className="text-[12px] text-grey-500">아직 등록된 키워드가 없습니다.</span>
          )}
          {keywords.map((k) => (
            <span
              key={k.id}
              className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full bg-grey-100 text-ink"
            >
              {k.label}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="새 키워드 (예: 이차방정식)"
            className="flex-1 px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
          />
          <button
            onClick={handleCreateKeyword}
            disabled={!newKeyword.trim()}
            className="text-[12px] font-bold px-3.5 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
          >
            추가
          </button>
        </div>
        {keywordError && <p className="text-[12px] text-red mt-1.5">{keywordError}</p>}
      </div>

      {units.map((u, idx) => (
        <div
          key={u.id}
          className="border-[1.5px] border-grey-200 rounded-xl px-5 py-3.5 mb-2.5"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[12px] font-bold text-grey-500 w-14 shrink-0">
              {u.position}회차
            </span>
            <input
              defaultValue={u.unitTitle}
              onBlur={(e) => handleField(u.id, "unitTitle", e.target.value)}
              className="flex-1 px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[13px] font-semibold"
            />
          </div>
          <input
            defaultValue={u.note ?? ""}
            placeholder="메모 (선택)"
            onBlur={(e) => handleField(u.id, "note", e.target.value)}
            className="w-full px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px] mb-2"
          />
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {keywords.map((k) => {
                const tagged = (u.keywordIds ?? []).includes(k.id);
                return (
                  <button
                    key={k.id}
                    onClick={() => handleToggleUnitKeyword(u.id, k.id, tagged)}
                    className={
                      "text-[11px] font-semibold px-2 py-1 rounded-full border-[1.5px] " +
                      (tagged ? "bg-ink text-white border-ink" : "border-grey-200 text-grey-500")
                    }
                  >
                    {k.label}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              disabled={idx === 0}
              onClick={() => handleMove(idx, -1)}
              className="text-[12px] font-semibold text-grey-500 disabled:opacity-30"
            >
              ↑ 위로
            </button>
            <button
              disabled={idx === units.length - 1}
              onClick={() => handleMove(idx, 1)}
              className="text-[12px] font-semibold text-grey-500 disabled:opacity-30"
            >
              ↓ 아래로
            </button>
            <button
              onClick={() => handleRemove(u.id)}
              className="text-[12px] font-semibold text-red ml-auto"
            >
              삭제
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={handleAdd}
        className="text-[12.5px] font-bold px-4 py-2.5 rounded-lg border-[1.5px] border-grey-200 text-ink w-full mb-8"
      >
        + 회차 추가
      </button>

      <div className="border-t border-grey-200 pt-5">
        {archivedNotice && (
          <p className="text-[12.5px] text-ink bg-grey-100 rounded-lg px-3 py-2 mb-3">
            이 과목은 보관 처리되었습니다: {archivedNotice}
            <br />
            <span className="text-grey-500">
              이름·기존 이력은 그대로 유지되며, 신규 배정·템플릿 선택·교재 연결
              후보에서만 제외됩니다.
            </span>
          </p>
        )}
        {confirmingDelete ? (
          <div className="flex items-center gap-3">
            <span className="text-[12.5px] text-ink">
              정말 &quot;{subject.subjectName}&quot; 과목을 삭제하시겠습니까? 사용
              이력이 있으면 삭제 대신 보관 처리됩니다.
            </span>
            <button
              onClick={handleDelete}
              className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-red text-white"
            >
              삭제
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="text-[12px] font-semibold text-grey-500"
            >
              취소
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="text-[12.5px] font-semibold text-red"
          >
            이 과목 삭제
          </button>
        )}
        {deleteError && <p className="text-[12px] text-red mt-2">{deleteError}</p>}
      </div>
    </div>
  );
}
