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
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">
        내 과목 커리큘럼
      </h1>
      <p className="text-[13px] text-grey-500 mb-5">
        과목을 맡으면 관리자 기준본의 회차와 키워드가 여기로 내려옵니다. 여기서 고친
        구성은 <strong className="text-ink font-bold">앞으로 새로 배정받는 학생</strong>의
        커리큘럼 기본값이 됩니다. 이미 배정된 학생의 진행 상황은 바뀌지 않습니다.
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
          보관된 과목은 새 배정에 쓰이지 않습니다. 지금까지 만든 회차 구성은 그대로 있으니 여기서 열어볼 수
          있습니다.
        </p>
      )}

      {visibleSubjects.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          {showArchived ? "보관된 과목이 없습니다." : "담당 중인 과목이 없습니다."}
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
                    보관됨
                  </span>
                )}
              </div>
              <div className="text-[12px] text-grey-500 mt-0.5">
                {s.templateId
                  ? `${s.units.length}개 회차 구성`
                  : "아직 템플릿이 없습니다"}
              </div>
            </div>
            {s.templateId ? (
              <button
                onClick={() => setOpenSubjectId(s.subjectId)}
                className="text-[12px] font-bold px-3.5 py-2 rounded-lg border-[1.5px] border-grey-200 text-ink"
              >
                편집
              </button>
            ) : (
              <button
                disabled={creating === s.subjectId}
                onClick={() => handleCreate(s.subjectId)}
                className="text-[12px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
              >
                템플릿 만들기
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
    await removeTemplateUnit(unitId);
    commit(units.filter((u) => u.id !== unitId));
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
        ? "기준본에서 더 가져올 것이 없습니다."
        : `기준본에서 키워드 ${result.keywordsAdded}개를 가져왔습니다.`
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
        ? "기준본에서 더 가져올 것이 없습니다."
        : `${result.keywordsAdded}개 키워드를 기준본에서 가져왔습니다.`
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
        className="text-[13px] text-grey-500 font-semibold mb-4"
      >
        ← 뒤로
      </button>
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">
        {subject.subjectName} 커리큘럼 편집
      </h1>
      <p className="text-[12.5px] text-grey-500 mb-4">
        회차에 붙인 키워드에 따라 기본 교재가 자동으로 구성됩니다. 여기서 정한 구성은
        앞으로 새로 배정받는 학생에게 내려갑니다.
      </p>

      {/* 마이그레이션 이전에 만들어진 템플릿은 연결만 복원되고 키워드는 비어 있다.
          회차마다 하나씩 누르게 하지 않는다 — 여기서 한 번에 가져온다. */}
      {pendingInherit > 0 && (
        <div className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3 mb-3 flex items-center justify-between gap-3">
          <p className="text-[12.5px] text-grey-500">
            키워드가 비어 있는 회차가 {pendingInherit}개 있습니다. 관리자 기준본에서 한 번에
            가져올 수 있습니다.
          </p>
          <button
            onClick={handleInheritAll}
            className="text-[12px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white shrink-0"
          >
            전체 가져오기
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
          <input
            defaultValue={u.teacherComment ?? ""}
            placeholder="선생님 코멘트 (선택)"
            onBlur={(e) => handleField(u.id, "teacherComment", e.target.value)}
            className="w-full px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px] mb-2"
          />
          {/* 회차 키워드 — 관리자 기준본에서 내려온 것과 선생님이 고친 것이 같은 줄에
              보인다. 붙이면 그 키워드의 기본 교재가 자동 구성으로 따라 들어온다. */}
          <div className="border-t-[1.5px] border-grey-100 pt-2.5 mb-2">
            <div className="text-[11.5px] font-bold text-grey-500 mb-1.5">회차 키워드</div>
            {subject.keywords.length === 0 ? (
              <p className="text-[12px] text-grey-500">
                이 과목에 등록된 키워드가 없습니다. 관리자가 과목 키워드를 만들면 여기에
                나타납니다.
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
                  ? "이 회차에 키워드가 없습니다. 기준본에서 가져오거나 직접 고르세요."
                  : "직접 추가한 회차라 물려받을 기준본이 없습니다. 키워드를 직접 고르세요."}
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
              수업 준비
            </a>
            {/* 보정은 수동이다 — 자동으로 돌면 선생님이 일부러 뺀 키워드를 되살린다. */}
            {u.linkedToCatalog && (
              <button
                onClick={() => handleInherit(u.id)}
                className="text-[12px] font-semibold text-grey-500"
              >
                기준본에서 가져오기
              </button>
            )}
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
        className="text-[12.5px] font-bold px-4 py-2.5 rounded-lg border-[1.5px] border-grey-200 text-ink w-full"
      >
        + 회차 추가
      </button>
    </div>
  );
}
