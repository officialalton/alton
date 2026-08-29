"use client";

import { useState } from "react";
import {
  updateDocTitle,
  setDocPublished,
  addSection,
  updateSection,
  removeSection,
  moveSection,
  generateSectionProblems,
  regenerateProblem,
  confirmSectionProblems,
  removeSectionProblem,
  deleteCurriculumDoc,
  type ProblemFormat,
  type ProblemDifficulty,
} from "./curriculum-doc-actions";
import RichTextEditable from "./RichTextEditable";
import ProblemDraftFields from "./ProblemDraftFields";
import type { DocEditorData, DocProblem, DocSection } from "./curriculum-doc-data";

const FORMAT_LABEL: Record<ProblemFormat, string> = {
  mc: "객관식",
  essay: "서술형",
  math: "풀이형",
};

export default function CurriculumDocEditor({
  doc,
  onBack,
  onDeleted,
}: {
  doc: DocEditorData;
  onBack: (updated: DocEditorData) => void;
  onDeleted: (docId: string) => void;
}) {
  const [title, setTitle] = useState(doc.title);
  const [status, setStatus] = useState(doc.status);
  const [sections, setSections] = useState(doc.sections);
  const [publishing, setPublishing] = useState(false);
  const [pickingSectionType, setPickingSectionType] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function handleBack() {
    onBack({ ...doc, title, status, sections });
  }

  async function handleTitleBlur(value: string) {
    if (!value.trim() || value === title) return;
    setTitle(value);
    await updateDocTitle(doc.id, value);
  }

  async function handleTogglePublish() {
    setPublishing(true);
    try {
      const next = status === "published" ? "draft" : "published";
      await setDocPublished(doc.id, next === "published");
      setStatus(next);
    } finally {
      setPublishing(false);
    }
  }

  async function handleAddSection(sectionType: "concept" | "problem") {
    const nextPosition =
      sections.length === 0 ? 1 : Math.max(...sections.map((s) => s.position)) + 1;
    const section = await addSection(doc.id, nextPosition, sectionType);
    setSections((prev) => [...prev, section]);
    setPickingSectionType(false);
  }

  async function handleDelete() {
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteCurriculumDoc(doc.id);
      onDeleted(doc.id);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "삭제에 실패했습니다.");
      setConfirmingDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  function patchSection(sectionId: string, patch: Partial<DocSection>) {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, ...patch } : s))
    );
  }

  async function handleRemoveSection(sectionId: string) {
    await removeSection(sectionId);
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
  }

  async function handleMoveSection(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const a = sections[index];
    const b = sections[target];
    await moveSection(a.id, b.id);
    const next = [...sections];
    next[index] = { ...b, position: a.position };
    next[target] = { ...a, position: b.position };
    next.sort((x, y) => x.position - y.position);
    setSections(next);
  }

  return (
    <div className="max-w-[720px] px-8 py-8">
      <button onClick={handleBack} className="text-[13px] text-grey-500 font-semibold mb-4">
        ← 뒤로
      </button>

      <div className="flex items-center justify-between mb-1.5">
        <input
          defaultValue={title}
          onBlur={(e) => handleTitleBlur(e.target.value)}
          className="text-[20px] font-extrabold text-ink flex-1 px-2 py-1 border-[1.5px] border-transparent hover:border-grey-200 focus:border-grey-200 rounded-lg -ml-2"
        />
        <button
          disabled={publishing}
          onClick={handleTogglePublish}
          className={
            "text-[12px] font-bold px-4 py-2 rounded-lg disabled:opacity-50 shrink-0 " +
            (status === "published" ? "bg-grey-100 text-ink" : "bg-green text-white")
          }
        >
          {status === "published" ? "배포 취소(초안으로)" : "배포하기"}
        </button>
      </div>
      <p className="text-[13px] text-grey-500 mb-6">
        {doc.subjectName}
        {doc.unitTitle ? ` · ${doc.unitTitle}` : ""} ·{" "}
        {status === "published" ? "배포됨" : "초안"}
      </p>

      {sections.map((section, idx) => (
        <SectionEditor
          key={section.id}
          section={section}
          index={idx}
          isFirst={idx === 0}
          isLast={idx === sections.length - 1}
          subjectId={doc.subjectId}
          subjectName={doc.subjectName}
          onPatch={(patch) => patchSection(section.id, patch)}
          onRemove={() => handleRemoveSection(section.id)}
          onMove={(dir) => handleMoveSection(idx, dir)}
        />
      ))}

      {pickingSectionType ? (
        <div className="flex gap-3">
          <button
            onClick={() => handleAddSection("concept")}
            className="flex-1 text-[12.5px] font-bold px-4 py-2.5 rounded-lg border-[1.5px] border-grey-200 text-ink"
          >
            개념 설명 섹션
          </button>
          <button
            onClick={() => handleAddSection("problem")}
            className="flex-1 text-[12.5px] font-bold px-4 py-2.5 rounded-lg border-[1.5px] border-grey-200 text-ink"
          >
            문제 생성 섹션
          </button>
          <button
            onClick={() => setPickingSectionType(false)}
            className="text-[12.5px] font-semibold text-grey-500 px-2"
          >
            취소
          </button>
        </div>
      ) : (
        <button
          onClick={() => setPickingSectionType(true)}
          className="text-[12.5px] font-bold px-4 py-2.5 rounded-lg border-[1.5px] border-grey-200 text-ink w-full"
        >
          + 섹션 추가
        </button>
      )}

      <div className="border-t border-grey-200 pt-5 mt-8">
        {confirmingDelete ? (
          <div className="flex items-center gap-3">
            <span className="text-[12.5px] text-ink">
              정말 &quot;{title}&quot; 교재를 삭제하시겠습니까?
            </span>
            <button
              disabled={deleting}
              onClick={handleDelete}
              className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-red text-white disabled:opacity-50"
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
          <>
            <button
              disabled={status === "published"}
              onClick={() => setConfirmingDelete(true)}
              className="text-[12.5px] font-semibold text-red disabled:opacity-30 disabled:cursor-not-allowed"
            >
              이 교재 삭제
            </button>
            {status === "published" && (
              <p className="text-[12px] text-grey-500 mt-1.5">
                배포 취소 후 삭제할 수 있습니다.
              </p>
            )}
          </>
        )}
        {deleteError && <p className="text-[12px] text-red mt-2">{deleteError}</p>}
      </div>
    </div>
  );
}

function SectionEditor({
  section,
  index,
  isFirst,
  isLast,
  subjectId,
  subjectName,
  onPatch,
  onRemove,
  onMove,
}: {
  section: DocSection;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  subjectId: string;
  subjectName: string;
  onPatch: (patch: Partial<DocSection>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const [problems, setProblems] = useState(section.problems);
  const [showProblemForm, setShowProblemForm] = useState(
    section.sectionType === "problem" && section.problems.length === 0
  );

  function commitProblems(next: DocProblem[]) {
    setProblems(next);
    onPatch({ problems: next });
  }

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[12px] font-bold text-grey-500 w-14 shrink-0">
          {index + 1}번
        </span>
        <input
          defaultValue={section.title}
          onBlur={(e) => {
            if (e.target.value.trim() && e.target.value !== section.title) {
              onPatch({ title: e.target.value });
              updateSection(section.id, { title: e.target.value });
            }
          }}
          className="flex-1 px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[13.5px] font-bold"
        />
        <button
          disabled={isFirst}
          onClick={() => onMove(-1)}
          className="text-[12px] font-semibold text-grey-500 disabled:opacity-30"
        >
          ↑
        </button>
        <button
          disabled={isLast}
          onClick={() => onMove(1)}
          className="text-[12px] font-semibold text-grey-500 disabled:opacity-30"
        >
          ↓
        </button>
        <button onClick={onRemove} className="text-[12px] font-semibold text-red">
          삭제
        </button>
      </div>

      {section.sectionType === "concept" && (
        <>
          <div className="mb-3">
            <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1">
              본문
            </div>
            <RichTextEditable
              initialHtml={section.body}
              placeholder="섹션 본문을 작성하세요"
              onChange={(html) => {
                onPatch({ body: html });
                updateSection(section.id, { body: html });
              }}
            />
          </div>

          <div className="mb-4">
            <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1">
              티칭 팁 (선생님 전용)
            </div>
            <RichTextEditable
              initialHtml={section.teachingTip ?? ""}
              placeholder="이 섹션을 가르칠 때 선생님에게 도움이 될 팁"
              minHeight="60px"
              onChange={(html) => {
                onPatch({ teachingTip: html });
                updateSection(section.id, { teachingTip: html });
              }}
            />
          </div>
        </>
      )}

      <div
        className={
          section.sectionType === "concept" ? "border-t border-grey-200 pt-3" : ""
        }
      >
        <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">
          문제 ({problems.length})
        </div>
        {problems.map((p) => (
          <div
            key={p.id}
            className="flex items-start justify-between gap-3 bg-grey-100 rounded-lg px-3 py-2.5 mb-2"
          >
            <div className="text-[12.5px] text-ink">
              <span className="font-bold">[{FORMAT_LABEL[p.format]}]</span> {p.passage}
              {p.format !== "mc" && (
                <p className="text-grey-500 mt-1">
                  {p.format === "essay" ? "모범답안: " : "모범풀이: "}
                  {p.explanation}
                </p>
              )}
            </div>
            <button
              onClick={async () => {
                await removeSectionProblem(p.id);
                commitProblems(problems.filter((x) => x.id !== p.id));
              }}
              className="text-[11.5px] font-semibold text-red shrink-0"
            >
              삭제
            </button>
          </div>
        ))}

        {showProblemForm ? (
          <ProblemGenPanel
            sectionId={section.id}
            sectionTitle={section.title}
            subjectId={subjectId}
            subjectName={subjectName}
            onConfirmed={(created) => {
              commitProblems([...problems, ...created]);
              setShowProblemForm(false);
            }}
            onCancel={() => setShowProblemForm(false)}
          />
        ) : (
          <button
            onClick={() => setShowProblemForm(true)}
            className="text-[12px] font-bold px-3.5 py-2 rounded-lg border-[1.5px] border-grey-200 text-ink"
          >
            + 문제 추가
          </button>
        )}
      </div>
    </div>
  );
}

function ProblemGenPanel({
  sectionId,
  sectionTitle,
  subjectId,
  subjectName,
  onConfirmed,
  onCancel,
}: {
  sectionId: string;
  sectionTitle: string;
  subjectId: string;
  subjectName: string;
  onConfirmed: (created: DocProblem[]) => void;
  onCancel: () => void;
}) {
  const [skillType, setSkillType] = useState("");
  const [difficulty, setDifficulty] = useState<ProblemDifficulty>("medium");
  const [format, setFormat] = useState<ProblemFormat>("mc");
  const [count, setCount] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [drafts, setDrafts] = useState<Omit<DocProblem, "id">[] | null>(null);
  const [feedbacks, setFeedbacks] = useState<string[]>([]);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);

  async function handleGenerate() {
    if (!skillType.trim() || generating) return;
    setGenerating(true);
    try {
      const result = await generateSectionProblems({
        sectionTitle,
        subjectName,
        skillType: skillType.trim(),
        difficulty,
        format,
        count,
      });
      setDrafts(result);
      setFeedbacks(result.map(() => ""));
    } finally {
      setGenerating(false);
    }
  }

  function patchDraft(index: number, patch: Partial<Omit<DocProblem, "id">>) {
    setDrafts((prev) =>
      prev ? prev.map((d, i) => (i === index ? { ...d, ...patch } : d)) : prev
    );
  }

  async function handleRegenerate(index: number) {
    if (!drafts || regeneratingIndex !== null) return;
    const feedback = feedbacks[index]?.trim();
    if (!feedback) return;
    setRegeneratingIndex(index);
    try {
      const revised = await regenerateProblem({
        sectionTitle,
        subjectName,
        skillType: skillType.trim(),
        difficulty,
        format: drafts[index].format,
        current: drafts[index],
        feedback,
      });
      setDrafts((prev) => (prev ? prev.map((d, i) => (i === index ? revised : d)) : prev));
      setFeedbacks((prev) => prev.map((f, i) => (i === index ? "" : f)));
    } finally {
      setRegeneratingIndex(null);
    }
  }

  async function handleConfirm() {
    if (!drafts || confirming) return;
    setConfirming(true);
    try {
      const created = await confirmSectionProblems(sectionId, subjectId, drafts);
      onConfirmed(created);
    } finally {
      setConfirming(false);
    }
  }

  if (drafts) {
    return (
      <div className="border-[1.5px] border-grey-200 rounded-lg px-4 py-3.5">
        <div className="text-[12.5px] font-bold text-ink mb-2">AI 초안 ({drafts.length}개)</div>
        {drafts.map((d, i) => (
          <div key={i} className="bg-grey-100 rounded-lg px-3 py-2.5 mb-2">
            <span className="text-[11px] font-bold text-grey-500">
              [{FORMAT_LABEL[d.format]}]
            </span>
            <ProblemDraftFields draft={d} onChange={(patch) => patchDraft(i, patch)} />
            <div className="flex gap-2 mt-2">
              <input
                value={feedbacks[i] ?? ""}
                onChange={(e) =>
                  setFeedbacks((prev) => prev.map((f, fi) => (fi === i ? e.target.value : f)))
                }
                placeholder="이 문제에 대한 피드백을 입력하세요"
                className="flex-1 px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12px]"
              />
              <button
                type="button"
                disabled={!feedbacks[i]?.trim() || regeneratingIndex !== null}
                onClick={() => handleRegenerate(i)}
                className="text-[11.5px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50 shrink-0"
              >
                {regeneratingIndex === i ? "재생성 중..." : "피드백 반영 재생성"}
              </button>
            </div>
          </div>
        ))}
        <div className="flex gap-3 mt-2">
          <button
            disabled={confirming}
            onClick={handleConfirm}
            className="text-[12px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
          >
            {confirming ? "추가 중..." : "문제로 추가"}
          </button>
          <button
            onClick={() => setDrafts(null)}
            className="text-[12px] font-semibold text-grey-500"
          >
            다시 조건 입력
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-[1.5px] border-grey-200 rounded-lg px-4 py-3.5">
      <div className="grid grid-cols-2 gap-2 mb-2.5">
        <input
          value={skillType}
          onChange={(e) => setSkillType(e.target.value)}
          placeholder="문제 유형 (예: 판별식 응용)"
          className="col-span-2 px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
        />
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as ProblemFormat)}
          className="px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
        >
          <option value="mc">객관식</option>
          <option value="essay">서술형</option>
          <option value="math">풀이형</option>
        </select>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as ProblemDifficulty)}
          className="px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
        >
          <option value="easy">쉬움</option>
          <option value="medium">보통</option>
          <option value="hard">어려움</option>
        </select>
        <input
          type="number"
          min={1}
          max={10}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
        />
      </div>
      <div className="flex gap-3">
        <button
          disabled={!skillType.trim() || generating}
          onClick={handleGenerate}
          className="text-[12px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
        >
          {generating ? "생성 중..." : "✨ AI로 생성하기"}
        </button>
        <button onClick={onCancel} className="text-[12px] font-semibold text-grey-500">
          취소
        </button>
      </div>
    </div>
  );
}
