"use client";

import { useState } from "react";
import {
  createMyTemplate,
  addTemplateUnit,
  updateTemplateUnit,
  removeTemplateUnit,
  moveTemplateUnit,
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

  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">
        내 과목 커리큘럼
      </h1>
      <p className="text-[13px] text-grey-500 mb-5">
        여기서 만든 회차 구성은 학생에게 새로 배정할 때 기본값으로
        사용됩니다. 이미 배정된 학생의 진행 상황에는 영향을 주지 않습니다.
      </p>

      {subjects.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          담당 중인 과목이 없습니다.
        </div>
      ) : (
        subjects.map((s) => (
          <div
            key={s.subjectId}
            className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5 flex items-center justify-between"
          >
            <div>
              <div className="text-[13.5px] font-bold text-ink">
                {s.subjectName}
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
      <h1 className="text-[20px] font-extrabold text-ink mb-5">
        {subject.subjectName} 커리큘럼 편집
      </h1>

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
        className="text-[12.5px] font-bold px-4 py-2.5 rounded-lg border-[1.5px] border-grey-200 text-ink w-full"
      >
        + 회차 추가
      </button>
    </div>
  );
}
