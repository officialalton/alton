"use client";

import { useState } from "react";
import {
  generateProblems,
  finalizeProblemsToHomework,
  type DraftProblem,
  type ProblemDifficulty,
  type ProblemFormat,
} from "./aigen-actions";
import type { HomeworkItem } from "./homework-data";

const DIFFICULTY_OPTIONS: { id: ProblemDifficulty; label: string }[] = [
  { id: "easy", label: "쉬움" },
  { id: "medium", label: "보통" },
  { id: "hard", label: "어려움" },
];

const FORMAT_OPTIONS: { id: ProblemFormat; label: string }[] = [
  { id: "mc", label: "객관식" },
  { id: "essay", label: "서술형" },
  { id: "math", label: "풀이형(화이트보드)" },
];

type Draft = DraftProblem & { key: string; unitTitle: string };

export default function AigenTab({
  sessionId,
  subjectId,
  subjectName,
  unitOptions,
  onFinalized,
}: {
  sessionId: string;
  subjectId: string;
  subjectName: string;
  unitOptions: string[];
  onFinalized: (items: HomeworkItem[]) => void;
}) {
  const [unit, setUnit] = useState(unitOptions[0] ?? "");
  const [skillType, setSkillType] = useState("");
  const [difficulty, setDifficulty] = useState<ProblemDifficulty>("medium");
  const [format, setFormat] = useState<ProblemFormat>("mc");
  const [count, setCount] = useState(3);

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [generating, setGenerating] = useState(false);
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conditionsValid = unit.trim() !== "" && skillType.trim() !== "";

  async function handleGenerate() {
    if (!conditionsValid || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const results = await generateProblems({
        sessionId,
        subjectName,
        unitTitle: unit,
        skillType,
        difficulty,
        format,
        count,
      });
      setDrafts((prev) => [
        ...prev,
        ...results.map((r) => ({
          ...r,
          key: crypto.randomUUID(),
          unitTitle: unit,
        })),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성에 실패했습니다.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegenerate(draft: Draft) {
    setRegeneratingKey(draft.key);
    setError(null);
    try {
      const [result] = await generateProblems({
        sessionId,
        subjectName,
        unitTitle: draft.unitTitle,
        skillType: draft.skillType,
        difficulty: draft.difficulty,
        format: draft.format,
        count: 1,
      });
      setDrafts((prev) =>
        prev.map((d) =>
          d.key === draft.key
            ? { ...result, key: draft.key, unitTitle: draft.unitTitle }
            : d
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "재생성에 실패했습니다.");
    } finally {
      setRegeneratingKey(null);
    }
  }

  function handleRemove(key: string) {
    setDrafts((prev) => prev.filter((d) => d.key !== key));
  }

  function handleUpdate(key: string, patch: Partial<DraftProblem>) {
    setDrafts((prev) =>
      prev.map((d) => (d.key === key ? { ...d, ...patch } : d))
    );
  }

  function handleDiscardAll() {
    if (drafts.length === 0) return;
    if (!confirm("작성 중인 초안을 모두 삭제하시겠습니까?")) return;
    setDrafts([]);
  }

  async function handleFinalize() {
    if (drafts.length === 0 || finalizing) return;
    setFinalizing(true);
    setError(null);
    try {
      const created = await finalizeProblemsToHomework(
        sessionId,
        subjectId,
        drafts.map(({ key, unitTitle, ...d }) => d)
      );
      onFinalized(
        created.map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          studentAnswer: null,
        }))
      );
      setDrafts([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "확정에 실패했습니다.");
    } finally {
      setFinalizing(false);
    }
  }

  return (
    <div className="max-w-[720px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">문제 생성</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        조건을 선택해 AI로 문제를 생성한 뒤, 검토·수정하고 &quot;과제로
        확정&quot;하면 학생의 과제 탭에 들어갑니다.
      </p>

      <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5 mb-6">
        <Field label="단원">
          {unitOptions.length > 0 ? (
            <ChipGroup
              options={unitOptions.map((u) => ({ id: u, label: u }))}
              value={unit}
              onChange={setUnit}
            />
          ) : (
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="단원명을 입력하세요"
              className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
            />
          )}
        </Field>

        <Field label="문제 유형">
          <input
            value={skillType}
            onChange={(e) => setSkillType(e.target.value)}
            placeholder="예: 개념 문제, 응용 문제, Words in Context"
            className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
          />
        </Field>

        <Field label="난이도">
          <ChipGroup
            options={DIFFICULTY_OPTIONS}
            value={difficulty}
            onChange={setDifficulty}
          />
        </Field>

        <Field label="답안 형식">
          <ChipGroup
            options={FORMAT_OPTIONS}
            value={format}
            onChange={setFormat}
          />
        </Field>

        <Field label="개수">
          <input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) =>
              setCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))
            }
            className="w-20 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
          />
        </Field>

        <button
          onClick={handleGenerate}
          disabled={!conditionsValid || generating}
          className="mt-2 text-[13px] font-bold px-4 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
        >
          {generating ? "생성 중..." : "생성하기"}
        </button>
      </div>

      {error && (
        <div className="text-[13px] text-red bg-red-bg rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {drafts.map((draft, idx) => (
        <DraftCard
          key={draft.key}
          index={idx}
          draft={draft}
          regenerating={regeneratingKey === draft.key}
          onChange={(patch) => handleUpdate(draft.key, patch)}
          onRegenerate={() => handleRegenerate(draft)}
          onRemove={() => handleRemove(draft.key)}
        />
      ))}

      {drafts.length > 0 && (
        <div className="flex items-center gap-4 mt-2">
          <button
            onClick={handleFinalize}
            disabled={finalizing}
            className="text-[13px] font-bold px-4 py-2 rounded-lg bg-green text-white disabled:opacity-50"
          >
            {finalizing ? "확정 중..." : `✓ 과제로 확정 (${drafts.length})`}
          </button>
          <button
            onClick={handleDiscardAll}
            className="text-[13px] font-semibold text-grey-500"
          >
            전체 취소
          </button>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="text-[12px] font-bold text-ink mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={
            "text-[12.5px] font-semibold px-3.5 py-1.5 rounded-full border-[1.5px] " +
            (value === opt.id
              ? "bg-ink text-white border-ink"
              : "border-grey-200 text-grey-500")
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function DraftCard({
  index,
  draft,
  regenerating,
  onChange,
  onRegenerate,
  onRemove,
}: {
  index: number;
  draft: Draft;
  regenerating: boolean;
  onChange: (patch: Partial<DraftProblem>) => void;
  onRegenerate: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5 mb-3">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[12px] font-bold text-grey-500">
          초안 {index + 1}
        </span>
        <div className="flex gap-3">
          <button
            onClick={onRegenerate}
            disabled={regenerating}
            className="text-[12px] font-semibold text-grey-500 disabled:opacity-50"
          >
            {regenerating ? "재생성 중..." : "🔄 이 문제만 다시 생성"}
          </button>
          <button onClick={onRemove} className="text-[12px] font-semibold text-red">
            삭제
          </button>
        </div>
      </div>

      <label className="block text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1">
        지문 / 문제
      </label>
      <textarea
        value={draft.passage}
        onChange={(e) => onChange({ passage: e.target.value })}
        className="w-full min-h-[70px] mb-3 px-3 py-2.5 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
      />

      {draft.format === "mc" && draft.options && (
        <div className="mb-3">
          <label className="block text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1">
            선택지 (정답 선택)
          </label>
          {draft.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2 mb-1.5">
              <input
                type="radio"
                checked={draft.correctIndex === i}
                onChange={() => onChange({ correctIndex: i })}
              />
              <input
                value={opt}
                onChange={(e) => {
                  const next = [...(draft.options ?? [])];
                  next[i] = e.target.value;
                  onChange({ options: next });
                }}
                className="flex-1 px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
              />
            </div>
          ))}
        </div>
      )}

      <label className="block text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1">
        해설
      </label>
      <textarea
        value={draft.explanation}
        onChange={(e) => onChange({ explanation: e.target.value })}
        className="w-full min-h-[60px] px-3 py-2.5 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
      />
    </div>
  );
}
