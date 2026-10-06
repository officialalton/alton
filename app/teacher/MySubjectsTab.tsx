"use client";

import { useState } from "react";
import {
  createMyTemplate,
  addTemplateUnit,
  updateTemplateUnit,
  removeTemplateUnit,
  moveTemplateUnit,
  addTemplateUnitKeyword,
  removeTemplateUnitKeyword,
  inheritUnitDefaults,
  inheritTemplateDefaults,
} from "./mysubjects-actions";
import type { MySubject, TemplateUnit } from "./mysubjects-data";

export default function MySubjectsTab({
  initialSubjects,
}: {
  initialSubjects: MySubject[];
}) {
  const [subjects, setSubjects] = useState(initialSubjects);
  const [openSubjectId, setOpenSubjectId] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  // 보관된 과목은 새 작업 대상이 아니지만, 쌓아 둔 커리큘럼은 계속 열어볼 수
  // 있어야 한다. 목록에서 빼는 대신 구분해서 보여준다.
  const [showArchived, setShowArchived] = useState(false);

  const open = subjects.find((s) => s.subjectId === openSubjectId);

  async function handleCreate(subjectId: string) {
    setCreating(subjectId);
    try {
      const { templateId, units } = await createMyTemplate(subjectId);
      setSubjects((prev) =>
        prev.map((s) =>
          s.subjectId === subjectId ? { ...s, templateId, units } : s
        )
      );
      setOpenSubjectId(subjectId);
    } finally {
      setCreating(null);
    }
  }

  function patchUnits(subjectId: string, units: TemplateUnit[]) {
    setSubjects((prev) =>
      prev.map((s) => (s.subjectId === subjectId ? { ...s, units } : s))
    );
  }

  if (open) {
    return (
      <TemplateEditor
        subject={open}
        onBack={() => setOpenSubjectId(null)}
        onUnitsChange={(units) => patchUnits(open.subjectId, units)}
      />
    );
  }

  const visibleSubjects = subjects.filter((s) => Boolean(s.archived) === showArchived);

  return (
    <div className="max-w-[640px] px-8 py-8">
      {/* 2026-09-22(사용자 지시) — 설명 문단을 없애고, 현재/보관됨 서브탭이
          "내 과목" 바로 아래에 오도록 한다. */}
      <div className="flex gap-1 mb-3 border-b-[1.5px] border-grey-200">
        {[
          { archived: false, label: "Current" },
          { archived: true, label: "Archived" },
        ].map((t) => (
          <button
            key={t.label}
            onClick={() => setShowArchived(t.archived)}
            className={
              "text-[13px] font-bold px-3.5 py-2 -mb-[1.5px] border-b-[2px] " +
              (showArchived === t.archived ? "border-ink text-ink" : "border-transparent text-grey-500")
            }
          >
            {t.label}
            <span className="text-grey-300 font-semibold ml-1">
              {subjects.filter((s) => Boolean(s.archived) === t.archived).length}
            </span>
          </button>
        ))}
      </div>

      {showArchived && (
        <p className="text-[12px] text-grey-500 mb-3">
          Archived subjects aren&apos;t used for new assignments. The session compositions you built are kept and
          can still be opened here.
        </p>
      )}

      {visibleSubjects.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          {showArchived ? "No archived subjects." : "No subjects assigned yet."}
        </div>
      ) : (
        visibleSubjects.map((s) => (
          <div
            key={s.subjectId}
            className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5 flex items-center justify-between"
          >
            <div>
              <div className="text-[13.5px] font-bold text-ink flex items-center gap-1.5">
                {s.subjectName}
                {s.archived && (
                  <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-grey-100 text-grey-500">
                    Archived
                  </span>
                )}
              </div>
              <div className="text-[12px] text-grey-500 mt-0.5">
                {s.templateId
                  ? `${s.units.length} sessions composed`
                  : "No template yet"}
              </div>
            </div>
            {s.templateId ? (
              <button
                onClick={() => setOpenSubjectId(s.subjectId)}
                className="text-[12px] font-bold px-3.5 py-2 rounded-lg border-[1.5px] border-grey-200 text-ink"
              >
                Edit
              </button>
            ) : (
              <button
                disabled={creating === s.subjectId}
                onClick={() => handleCreate(s.subjectId)}
                className="text-[12px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
              >
                Create template
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function TemplateEditor({
  subject,
  onBack,
  onUnitsChange,
}: {
  subject: MySubject;
  onBack: () => void;
  onUnitsChange: (units: TemplateUnit[]) => void;
}) {
  const [units, setUnits] = useState(subject.units);
  const [removingUnitId, setRemovingUnitId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // 기준본과 이어져 있는데 키워드가 비어 있는 회차 — 보정 대상이다. 보충 회차는
  // 물려받을 것이 없으므로 세지 않는다.
  const pendingInherit = units.filter(
    (u) => u.linkedToCatalog && u.keywordIds.length === 0
  ).length;

  function commit(next: TemplateUnit[]) {
    setUnits(next);
    onUnitsChange(next);
  }

  async function handleAdd() {
    const nextPosition =
      units.length === 0 ? 1 : Math.max(...units.map((u) => u.position)) + 1;
    const unit = await addTemplateUnit(subject.templateId!, nextPosition);
    commit([...units, unit]);
  }

  async function handleRemove(unitId: string) {
    setRemovingUnitId(unitId);
    try {
      await removeTemplateUnit(unitId);
      commit(units.filter((u) => u.id !== unitId));
    } finally {
      setRemovingUnitId(null);
    }
  }

  async function handleField(
    unitId: string,
    field: "unitTitle" | "note" | "teacherComment",
    value: string
  ) {
    commit(
      units.map((u) => (u.id === unitId ? { ...u, [field]: value } : u))
    );
    await updateTemplateUnit(unitId, { [field]: value });
  }

  async function handleToggleKeyword(unitId: string, keywordId: string, attached: boolean) {
    const result = attached
      ? await removeTemplateUnitKeyword(unitId, keywordId)
      : await addTemplateUnitKeyword(unitId, keywordId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    commit(
      units.map((u) =>
        u.id === unitId
          ? {
              ...u,
              keywordIds: attached
                ? u.keywordIds.filter((k) => k !== keywordId)
                : [...u.keywordIds, keywordId],
            }
          : u
      )
    );
  }

  async function handleInherit(unitId: string) {
    const result = await inheritUnitDefaults(unitId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setNotice(
      result.keywordsAdded === 0
        ? "Nothing more to import from the base curriculum."
        : `Imported ${result.keywordsAdded} keywords from the base curriculum.`
    );
    commit(units.map((u) => (u.id === unitId ? { ...u, keywordIds: result.keywordIds } : u)));
  }

  async function handleInheritAll() {
    const result = await inheritTemplateDefaults(subject.templateId!);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setNotice(
      result.keywordsAdded === 0
        ? "Nothing more to import from the base curriculum."
        : `Imported ${result.keywordsAdded} keywords from the base curriculum.`
    );
    commit(
      units.map((u) => ({ ...u, keywordIds: result.keywordIdsByUnit[u.id] ?? u.keywordIds }))
    );
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= units.length) return;
    const a = units[index];
    const b = units[target];
    await moveTemplateUnit(a.id, b.id);
    const next = [...units];
    const swappedA = { ...a, position: b.position };
    const swappedB = { ...b, position: a.position };
    next[index] = swappedB;
    next[target] = swappedA;
    next.sort((x, y) => x.position - y.position);
    commit(next);
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      <button
        onClick={onBack}
        className="text-[13px] text-grey-600 font-semibold mb-4 border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 hover:bg-grey-100 active:scale-95 transition-transform"
      >
        ← Back
      </button>
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">
        Edit {subject.subjectName} Curriculum
      </h1>
      <p className="text-[12.5px] text-grey-500 mb-4">
        Default materials are composed automatically from the keywords attached to each session. The
        composition you set here flows down to students assigned to you from now on.
      </p>

      {/* 마이그레이션 이전에 만들어진 템플릿은 연결만 복원되고 키워드는 비어 있다.
          회차마다 하나씩 누르게 하지 않는다 — 여기서 한 번에 가져온다. */}
      {pendingInherit > 0 && (
        <div className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3 mb-3 flex items-center justify-between gap-3">
          <p className="text-[12.5px] text-grey-500">
            {pendingInherit} sessions have no keywords yet. You can import them all at once from the admin
            base curriculum.
          </p>
          <button
            onClick={handleInheritAll}
            className="text-[12px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white shrink-0"
          >
            Import all
          </button>
        </div>
      )}

      {error && (
        <div className="text-[12.5px] text-red bg-red/5 border-[1.5px] border-red/20 rounded-lg px-4 py-2.5 mb-3">
          {error}
        </div>
      )}
      {notice && !error && (
        <div className="text-[12.5px] text-grey-500 bg-grey-100 rounded-lg px-4 py-2.5 mb-3">
          {notice}
        </div>
      )}

      {units.map((u, idx) => (
        <div
          key={u.id}
          className="border-[1.5px] border-grey-200 rounded-xl px-5 py-3.5 mb-2.5"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[12px] font-bold text-grey-500 w-14 shrink-0">
              Session {u.position}
            </span>
            <input
              defaultValue={u.unitTitle}
              onBlur={(e) => handleField(u.id, "unitTitle", e.target.value)}
              className="flex-1 px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[13px] font-semibold"
            />
          </div>
          <input
            defaultValue={u.note ?? ""}
            placeholder="Note (optional)"
            onBlur={(e) => handleField(u.id, "note", e.target.value)}
            className="w-full px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px] mb-2"
          />
          <input
            defaultValue={u.teacherComment ?? ""}
            placeholder="Teacher comment (optional)"
            onBlur={(e) => handleField(u.id, "teacherComment", e.target.value)}
            className="w-full px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px] mb-2"
          />
          {/* 회차 키워드 — 관리자 기준본에서 내려온 것과 선생님이 고친 것이 같은 줄에
              보인다. 붙이면 그 키워드의 기본 교재가 자동 구성으로 따라 들어온다. */}
          <div className="border-t-[1.5px] border-grey-100 pt-2.5 mb-2">
            <div className="text-[11.5px] font-bold text-grey-500 mb-1.5">Session keywords</div>
            {subject.keywords.length === 0 ? (
              <p className="text-[12px] text-grey-500">
                No keywords registered for this subject yet. They will appear here once an admin creates
                subject keywords.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {subject.keywords.map((k) => {
                  const attached = u.keywordIds.includes(k.id);
                  return (
                    <button
                      key={k.id}
                      onClick={() => handleToggleKeyword(u.id, k.id, attached)}
                      aria-pressed={attached}
                      className={
                        "text-[11.5px] font-semibold px-2.5 py-1 rounded-full border-[1.5px] " +
                        (attached
                          ? "bg-ink text-white border-ink"
                          : "bg-white text-grey-500 border-grey-200")
                      }
                    >
                      {k.label}
                    </button>
                  );
                })}
              </div>
            )}
            {u.keywordIds.length === 0 && subject.keywords.length > 0 && (
              <p className="text-[11.5px] text-grey-500 mt-1.5">
                {u.linkedToCatalog
                  ? "This session has no keywords. Import from the base curriculum or pick them yourself."
                  : "This session was added manually, so there is no base to inherit from. Pick keywords yourself."}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* 4절 — 모든 진입 버튼 이름은 "수업 준비"로 통일한다. 예약이나 실제
                수업 기록 없이 회차 기준으로 열린다. */}
            <a
              href={`/lesson-prep/teacher/${u.id}`}
              className="text-[12px] font-bold text-ink underline underline-offset-2"
            >
              Lesson prep
            </a>
            {/* 보정은 수동이다 — 자동으로 돌면 선생님이 일부러 뺀 키워드를 되살린다. */}
            {u.linkedToCatalog && (
              <button
                onClick={() => handleInherit(u.id)}
                className="text-[12px] font-semibold text-grey-500"
              >
                Import from base
              </button>
            )}
            <button
              disabled={idx === 0}
              onClick={() => handleMove(idx, -1)}
              className="text-[12px] font-semibold text-grey-500 disabled:opacity-30"
            >
              ↑ Up
            </button>
            <button
              disabled={idx === units.length - 1}
              onClick={() => handleMove(idx, 1)}
              className="text-[12px] font-semibold text-grey-500 disabled:opacity-30"
            >
              ↓ Down
            </button>
            <button
              disabled={removingUnitId === u.id}
              onClick={() => handleRemove(u.id)}
              className="text-[12px] font-semibold text-red border border-red/30 rounded px-2 py-1 ml-auto disabled:opacity-50"
            >
              {removingUnitId === u.id ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={handleAdd}
        className="text-[12.5px] font-bold px-4 py-2.5 rounded-lg border-[1.5px] border-grey-200 text-ink w-full"
      >
        + Add session
      </button>
    </div>
  );
}
