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
  renameSubjectKeyword,
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
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState("");
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

  // 보관됨과 현재를 한 목록에 섞지 않는다. 기본 진입은 현재이고, 검색도 지금
  // 보고 있는 구분 안에서만 동작한다 — 섞으면 "왜 이게 선택지에 안 나오지"를
  // 목록만 보고 알 수 없다.
  const visibleSubjects = subjects.filter((s) =>
    (showArchived ? Boolean(s.archivedAt) : !s.archivedAt) &&
    (query.trim() === "" || s.subjectName.toLowerCase().includes(query.trim().toLowerCase()))
  );

  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">과목 템플릿</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        여기서 관리하는 과목·회차는 선생님의 커리큘럼 템플릿, 교재 생성 폼 등
        다른 화면의 선택지로 그대로 사용됩니다.
      </p>

      <div className="flex gap-1 mb-3 border-b-[1.5px] border-grey-200">
        {[
          { archived: false, label: "현재" },
          { archived: true, label: "보관됨" },
        ].map((t) => (
          <button
            key={t.label}
            onClick={() => setShowArchived(t.archived)}
            className={
              "text-[13px] font-bold px-3.5 py-2 -mb-[1.5px] border-b-[2px] " +
              (showArchived === t.archived
                ? "border-ink text-ink"
                : "border-transparent text-grey-500")
            }
          >
            {t.label}
            <span className="text-grey-300 font-semibold ml-1">
              {subjects.filter((s) => (t.archived ? Boolean(s.archivedAt) : !s.archivedAt)).length}
            </span>
          </button>
        ))}
      </div>

      <input
        aria-label="과목 검색"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={showArchived ? "보관된 과목에서 찾기" : "과목 이름으로 찾기"}
        className="w-full text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 mb-3"
      />

      {showArchived && (
        <p className="text-[12px] text-grey-500 mb-3">
          보관된 과목은 새 배정·교재 생성 선택지에 나오지 않습니다. 기존 연결과 과거 기록은 그대로 남아 있어
          여기서 열어볼 수 있습니다.
        </p>
      )}

      {visibleSubjects.length === 0 && (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center mb-3">
          {query.trim()
            ? "찾는 과목이 없습니다."
            : showArchived
              ? "보관된 과목이 없습니다."
              : "아직 만든 과목이 없습니다."}
        </div>
      )}

      {visibleSubjects.map((s) => (
        <div
          key={s.subjectId}
          className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5 flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <div className="text-[13.5px] font-bold text-ink flex items-center gap-1.5 min-w-0">
              <span className="truncate">{s.subjectName}</span>
              {s.archivedAt && (
                <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-grey-100 text-grey-500">
                  보관됨
                </span>
              )}
            </div>
            {/* 보관 사유가 길면 예전에는 이 줄이 늘어나 '편집' 버튼을 밀어
                두 줄로 깨뜨렸다. 설명 쪽이 줄어들게 한다. */}
            <div className="text-[12px] text-grey-500 mt-0.5 truncate">
              {s.units.length}개 회차
              {s.archivedAt && s.archivedReason ? ` · ${s.archivedReason}` : ""}
            </div>
          </div>
          <button
            onClick={() => setOpenSubjectId(s.subjectId)}
            className="text-[12px] font-bold px-3.5 py-2 rounded-lg border-[1.5px] border-grey-200 text-ink whitespace-nowrap flex-shrink-0"
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
  const [removingUnitId, setRemovingUnitId] = useState<string | null>(null);
  const [keywords, setKeywords] = useState(subject.keywords ?? []);
  const [newKeyword, setNewKeyword] = useState("");
  const [keywordError, setKeywordError] = useState<string | null>(null);
  // 이름을 고치는 중인 키워드. 키워드는 교재·문제·회차가 전부 id로 참조하므로
  // 이름만 바뀌고 이미 붙은 연결은 그대로다.
  const [editingKeywordId, setEditingKeywordId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");

  async function handleRenameKeyword(keywordId: string) {
    const label = editingLabel.trim();
    const current = keywords.find((k) => k.id === keywordId);
    if (!label || label === current?.label) {
      setEditingKeywordId(null);
      return;
    }
    setKeywordError(null);
    const result = await renameSubjectKeyword(keywordId, label);
    if (!result.ok) {
      setKeywordError(result.error);
      return;
    }
    const next = keywords
      .map((k) => (k.id === keywordId ? result.value : k))
      .sort((a, b) => a.label.localeCompare(b.label));
    setKeywords(next);
    onKeywordsChange(next);
    setEditingKeywordId(null);
  }
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
    setRemovingUnitId(unitId);
    try {
      await removeSubjectUnit(unitId);
      commit(units.filter((u) => u.id !== unitId));
    } finally {
      setRemovingUnitId(null);
    }
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
        className="text-[13px] text-grey-600 font-semibold mb-4 border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 hover:bg-grey-100 active:scale-95 transition-transform"
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
          {keywords.map((k) =>
            editingKeywordId === k.id ? (
              <input
                key={k.id}
                autoFocus
                aria-label={`${k.label} 이름 고치기`}
                value={editingLabel}
                onChange={(e) => setEditingLabel(e.target.value)}
                onBlur={() => void handleRenameKeyword(k.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleRenameKeyword(k.id);
                  if (e.key === "Escape") setEditingKeywordId(null);
                }}
                className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full border-[1.5px] border-grey-200 max-w-[180px]"
              />
            ) : (
              <button
                key={k.id}
                title="이름 고치기"
                onClick={() => {
                  setEditingKeywordId(k.id);
                  setEditingLabel(k.label);
                  setKeywordError(null);
                }}
                className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full bg-grey-100 text-ink"
              >
                {k.label}
              </button>
            )
          )}
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
                    // 사전 칩과 회차 태그 버튼이 같은 글자를 갖는다 — 무엇을 누르는
                    // 자리인지 이름으로 구분해 둔다.
                    aria-label={`${u.unitTitle} 회차에 ${k.label} ${tagged ? "해제" : "태그"}`}
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
            {/* 4절 — 관리자 기준본 회차에서도 같은 준비 화면으로 들어간다.
                이름은 세 계층 모두 "수업 준비"로 같다. */}
            <a
              href={`/lesson-prep/catalog/${u.id}`}
              className="text-[12px] font-bold text-ink underline underline-offset-2"
            >
              수업 준비
            </a>
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
              disabled={removingUnitId === u.id}
              onClick={() => handleRemove(u.id)}
              className="text-[12px] font-semibold text-red border border-red/30 rounded px-2 py-1 ml-auto disabled:opacity-50"
            >
              {removingUnitId === u.id ? "삭제 중..." : "삭제"}
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
