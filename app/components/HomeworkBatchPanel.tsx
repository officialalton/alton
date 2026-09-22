"use client";

import { useState } from "react";
import type { HomeworkBatch, HomeworkBatchItem } from "@/lib/homework-batch-data";
import { submitHomeworkAnswerAction, gradeHomeworkBatchAction } from "@/lib/homework-batch-actions";
import ProblemFigure from "@/app/session/[id]/ProblemFigure";
import MockExamMathTools, { MockExamToolButtons, type MathToolsOpen } from "@/app/session/[id]/MockExamMathTools";
import ProblemNoteCanvas from "@/app/components/ProblemNoteCanvas";

const FORMAT_LABEL: Record<HomeworkBatchItem["format"], string> = { mc: "객관식", spr: "숫자 입력", essay: "서술형", math: "풀이형" };

/** 2026-09-21(UAT 지적) — 수학 과제에는 모의고사와 같은 그래프 계산기·참조표를 붙인다(사양 6절 "같은
 * 렌더러"). 배치의 과목명이 Math 이거나 숫자 입력/풀이형 문항이 있으면 수학 과제로 본다. */
function isMathBatch(batch: HomeworkBatch): boolean {
  if (/math|수학/i.test(batch.subjectName ?? "")) return true;
  return batch.items.some((i) => i.format === "spr" || i.format === "math");
}

function isGraded(b: HomeworkBatch): boolean {
  return b.items.length > 0 && b.items.every((i) => i.graded);
}

/** 2026-09-16 — 과제 배치 목록 + 배치 하나를 눌렀을 때의 목차·슬라이드 화면. 수업(세션)과 무관하게
 * 학생 포털·교사 포털·세션뷰 어디서나 같은 화면을 쓴다. "예정 과제"(채점 전)와 "지난 과제"(채점
 * 완료, 과목별 필터 + 누적 리스트)로 나눈다(2026-09-16 제품 오너 지시). */
export default function HomeworkBatchPanel({
  batches: initialBatches, viewerRole, readOnly,
}: {
  batches: HomeworkBatch[];
  viewerRole: "student" | "teacher";
  /** 보호자 등 읽기 전용 뷰어 — 답 제출·채점 버튼이 전부 숨는다(내용은 그대로 볼 수 있다). */
  readOnly?: boolean;
}) {
  const [batches, setBatches] = useState(initialBatches);
  const [subTab, setSubTab] = useState<"upcoming" | "past">("upcoming");
  const [mathToolsOpen, setMathToolsOpen] = useState<MathToolsOpen>(null);
  const toggleMathTools = (which: "calculator" | "reference") => setMathToolsOpen((cur) => (cur === which ? null : which));
  const upcoming = batches.filter((b) => !isGraded(b));
  const past = batches.filter(isGraded);
  const [activeId, setActiveId] = useState<string | null>(upcoming[0]?.id ?? null);
  const [pastDetailId, setPastDetailId] = useState<string | null>(null);
  const active = batches.find((b) => b.id === activeId) ?? null;
  const pastDetail = batches.find((b) => b.id === pastDetailId) ?? null;

  function updateBatch(updated: HomeworkBatch) {
    setBatches((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  }

  if (batches.length === 0) {
    return (
      <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
        {viewerRole === "student" ? "아직 발급된 과제가 없습니다." : "아직 낸 과제가 없습니다."}
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-1 border-b border-grey-200 mb-4">
        {(["upcoming", "past"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={"text-[13.5px] font-bold px-3 pb-2.5 -mb-px border-b-2 " + (subTab === t ? "text-ink border-ink" : "text-grey-500 border-transparent")}
          >
            {t === "upcoming" ? "예정 과제" : "지난 과제"}
          </button>
        ))}
      </div>

      {subTab === "upcoming" ? (
        upcoming.length === 0 ? (
          <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">예정된 과제가 없습니다.</div>
        ) : (
          <div>
            <div className="flex gap-2 mb-4 overflow-x-auto border-b border-grey-200" role="tablist" aria-label="과제 배치">
              {upcoming.map((b) => {
                const total = b.items.length;
                const answered = b.items.filter((i) => i.submittedAt).length;
                const status = answered === total ? "채점 대기" : `${total - answered}문제 남음`;
                const selected = b.id === activeId;
                return (
                  <button
                    key={b.id}
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveId(b.id)}
                    className={"text-[13px] font-semibold pb-2.5 -mb-px border-b-2 whitespace-nowrap flex items-center gap-2 " + (selected ? "text-ink border-ink" : "text-grey-500 border-transparent")}
                  >
                    {b.label}
                    <span className={"text-[10.5px] font-bold px-2 py-0.5 rounded-full " + (answered === total ? "bg-grey-100 text-grey-500" : "bg-red-bg text-red")}>
                      {status}
                    </span>
                  </button>
                );
              })}
            </div>
            {active && isMathBatch(active) && (
              <div className="mb-3">
                <MockExamToolButtons calculatorAllowed referenceSheetAllowed open={mathToolsOpen} onToggle={toggleMathTools} />
              </div>
            )}
            {active && <BatchRunner batch={active} viewerRole={viewerRole} readOnly={readOnly} onChange={updateBatch} />}
            {active && isMathBatch(active) && (
              <MockExamMathTools calculatorAllowed referenceSheetAllowed open={mathToolsOpen} onClose={() => setMathToolsOpen(null)} />
            )}
          </div>
        )
      ) : pastDetail ? (
        <div>
          <button onClick={() => setPastDetailId(null)} className="text-[12px] font-semibold text-grey-500 mb-3">← 지난 과제 목록으로</button>
          {isMathBatch(pastDetail) && (
            <div className="mb-3">
              <MockExamToolButtons calculatorAllowed referenceSheetAllowed open={mathToolsOpen} onToggle={toggleMathTools} />
            </div>
          )}
          <BatchRunner batch={pastDetail} viewerRole={viewerRole} readOnly={readOnly} onChange={updateBatch} />
          {isMathBatch(pastDetail) && (
            <MockExamMathTools calculatorAllowed referenceSheetAllowed open={mathToolsOpen} onClose={() => setMathToolsOpen(null)} />
          )}
        </div>
      ) : (
        <PastBatchList batches={past} onOpen={(id) => setPastDetailId(id)} />
      )}
    </div>
  );
}

function PastBatchList({ batches, onOpen }: { batches: HomeworkBatch[]; onOpen: (id: string) => void }) {
  const [subjectFilter, setSubjectFilter] = useState<string | "all">("all");
  const subjects = Array.from(new Map(batches.filter((b) => b.subjectId).map((b) => [b.subjectId as string, b.subjectName ?? "과목"])).entries());
  const filtered = subjectFilter === "all" ? batches : batches.filter((b) => b.subjectId === subjectFilter);

  if (batches.length === 0) {
    return <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">지난 과제가 없습니다.</div>;
  }

  return (
    <div>
      {subjects.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setSubjectFilter("all")}
            className={"text-[12.5px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] " + (subjectFilter === "all" ? "border-ink bg-ink text-white" : "border-grey-200 text-ink")}
          >
            전체
          </button>
          {subjects.map(([id, name]) => (
            <button
              key={id}
              onClick={() => setSubjectFilter(id)}
              className={"text-[12.5px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] " + (subjectFilter === id ? "border-ink bg-ink text-white" : "border-grey-200 text-ink")}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      {filtered.map((b) => {
        const correct = b.items.filter((i) => i.grade === "correct").length;
        return (
          <button
            key={b.id}
            onClick={() => onOpen(b.id)}
            className="w-full text-left border border-grey-200 rounded-xl px-4 py-3 mb-2 flex items-center justify-between hover:bg-grey-100"
          >
            <span className="text-[13px] font-bold text-ink">{b.label}</span>
            <span className="text-[12.5px] text-grey-500">{b.items.length}문항 · <span className="font-bold text-ink">{correct}/{b.items.length}점</span></span>
          </button>
        );
      })}
    </div>
  );
}

function BatchRunner({
  batch, viewerRole, readOnly, onChange,
}: {
  batch: HomeworkBatch; viewerRole: "student" | "teacher"; readOnly?: boolean; onChange: (b: HomeworkBatch) => void;
}) {
  const [i, setI] = useState(0);
  const [response, setResponse] = useState(batch.items[i]?.response ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, { grade: "correct" | "incorrect"; comment?: string }>>({});
  const [grading, setGrading] = useState(false);

  const item = batch.items[i];
  if (!item) return null;
  const allGraded = batch.items.every((it) => it.graded);

  function goTo(idx: number) {
    setI(idx);
    setResponse(batch.items[idx]?.response ?? "");
    setError(null);
  }

  async function submit() {
    setSaving(true);
    setError(null);
    const r = await submitHomeworkAnswerAction(batch.id, item.problemId, response);
    setSaving(false);
    if (!r.ok) { setError(r.error); return; }
    onChange({ ...batch, items: batch.items.map((it) => (it.problemId === item.problemId ? { ...it, response, submittedAt: new Date().toISOString() } : it)) });
  }

  function setOverride(problemId: string, grade: "correct" | "incorrect") {
    setOverrides((prev) => ({ ...prev, [problemId]: { grade, comment: prev[problemId]?.comment } }));
  }
  function setComment(problemId: string, comment: string) {
    setOverrides((prev) => ({ ...prev, [problemId]: { grade: prev[problemId]?.grade ?? (item.autoCorrect ? "correct" : "incorrect"), comment } }));
  }

  async function finalizeGrading() {
    setGrading(true);
    setError(null);
    const list = Object.entries(overrides).map(([problemId, o]) => ({ problemId, grade: o.grade, comment: o.comment }));
    const r = await gradeHomeworkBatchAction(batch.id, list);
    setGrading(false);
    if (!r.ok) { setError(r.error); return; }
    const now = new Date().toISOString();
    onChange({
      ...batch,
      items: batch.items.map((it) => {
        const o = overrides[it.problemId];
        const grade = o ? o.grade : it.autoCorrect === null ? null : it.autoCorrect ? "correct" : "incorrect";
        return { ...it, graded: true, gradedAt: now, grade, gradeComment: o?.comment ?? it.gradeComment };
      }),
    });
  }

  const showAnswer = item.graded;
  const currentOverride = overrides[item.problemId];
  const currentGrade = currentOverride?.grade ?? (item.autoCorrect === null ? null : item.autoCorrect ? "correct" : "incorrect");

  return (
    <div className="flex gap-6">
      <div className="w-[120px] shrink-0">
        <p className="text-[11px] font-bold text-grey-400 uppercase mb-2">목차</p>
        <div className="flex flex-col gap-1">
          {batch.items.map((it, idx) => {
            const pendingGrade = it.submittedAt && !it.graded;
            return (
              <button
                key={it.problemId}
                onClick={() => goTo(idx)}
                className={
                  "text-[12.5px] text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-1.5 " +
                  (idx === i ? "bg-ink text-white font-bold" : it.graded ? (it.grade === "correct" ? "bg-green/10 text-green" : "bg-red-bg text-red") : pendingGrade ? "bg-grey-100 text-ink" : "text-grey-500")
                }
              >
                <span>과제 {it.position}</span>
                {pendingGrade && <span className={"text-[10px] font-bold " + (idx === i ? "text-white/80" : "text-grey-500")}>채점 대기</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[12px] font-bold text-grey-500">과제 {item.position} · {FORMAT_LABEL[item.format]}</span>
          <div className="flex gap-2">
            <button disabled={i === 0} onClick={() => goTo(i - 1)} className="text-[12px] font-semibold text-grey-500 disabled:opacity-30">이전 과제</button>
            <button disabled={i === batch.items.length - 1} onClick={() => goTo(i + 1)} className="text-[12px] font-semibold text-ink disabled:opacity-30">다음 과제</button>
          </div>
        </div>

        {item.passage && <p className="text-[13.5px] text-ink whitespace-pre-wrap mb-3">{item.passage}</p>}
        {item.figure != null && <ProblemFigure spec={item.figure} className="mb-3" />}
        {item.question && <p className="text-[14px] font-bold text-ink mb-3">{item.question}</p>}

        {viewerRole === "student" && !item.graded && readOnly && (
          <div className="mb-3">
            <p className="text-[13px] text-ink">
              제출한 답: {item.format === "mc" && item.options && item.response !== null ? item.options[Number(item.response)] : item.response || "(아직 제출하지 않음)"}
            </p>
          </div>
        )}

        {viewerRole === "student" && !item.graded && !readOnly && (
          <div className="mb-3">
            {item.format === "mc" && item.options ? (
              <div className="flex flex-col gap-2">
                {item.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setResponse(String(idx)); }}
                    className={"text-left text-[13.5px] px-3.5 py-2.5 rounded-[10px] border-[1.5px] " + (response === String(idx) ? "border-ink bg-grey-100" : "border-grey-200")}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder={item.format === "spr" ? "답을 입력하세요" : "풀이·답안을 입력하세요"}
                className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13.5px] min-h-[80px]"
              />
            )}
            {error && <p className="text-[12px] text-red mt-2">{error}</p>}
            <button
              disabled={saving || !response.trim()}
              onClick={() => void submit()}
              className="mt-2 text-[12.5px] font-bold px-3.5 py-2 rounded-lg bg-green text-white disabled:opacity-50"
            >
              {saving ? "저장 중…" : item.submittedAt ? "답 다시 저장" : "답 제출"}
            </button>
          </div>
        )}

        {viewerRole === "student" && item.graded && (
          <div className="mb-3">
            <p className="text-[13px] text-ink mb-1">내 답: {item.format === "mc" && item.options && item.response !== null ? item.options[Number(item.response)] : item.response || "(제출 안 함)"}</p>
            <p className={"text-[13px] font-bold " + (item.grade === "correct" ? "text-green" : "text-red")}>
              {item.grade === "correct" ? "정답" : "오답"}
            </p>
          </div>
        )}

        {viewerRole === "teacher" && (
          <div className="mb-3 border-[1.5px] border-grey-200 rounded-xl px-4 py-3">
            <p className="text-[12.5px] text-grey-500 mb-1">학생 답</p>
            <p className="text-[13.5px] text-ink mb-2">
              {item.format === "mc" && item.options && item.response !== null ? item.options[Number(item.response)] : item.response || "(제출 안 함)"}
            </p>
            {!allGraded ? (
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setOverride(item.problemId, "correct")}
                  className={"text-[12px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] " + (currentGrade === "correct" ? "border-green bg-green/10 text-green" : "border-grey-200 text-grey-500")}
                >
                  정답 처리
                </button>
                <button
                  onClick={() => setOverride(item.problemId, "incorrect")}
                  className={"text-[12px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] " + (currentGrade === "incorrect" ? "border-red bg-red-bg text-red" : "border-grey-200 text-grey-500")}
                >
                  오답 처리
                </button>
                {item.autoCorrect !== null && <span className="text-[11px] text-grey-400">(자동 판정: {item.autoCorrect ? "정답" : "오답"})</span>}
              </div>
            ) : (
              <p className={"text-[13px] font-bold mb-2 " + (item.grade === "correct" ? "text-green" : "text-red")}>{item.grade === "correct" ? "정답" : "오답"}</p>
            )}
            <textarea
              defaultValue={item.gradeComment ?? ""}
              onBlur={(e) => setComment(item.problemId, e.target.value)}
              placeholder="코멘트(선택)"
              disabled={allGraded}
              className="w-full border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[12.5px] disabled:bg-grey-100"
            />
          </div>
        )}

        {/* 2026-09-21(사용자 지시) — 과제 풀이 중 필기. 세션 안 "문제" 탭은 이미 실시간 공유
            필기(PdfPageAnnotationLayer)가 있어 그대로 두고, 세션 밖에서도 쓰는 이 배치 화면
            (홈워크 배치)에는 없었다 — 저장/재생 방식(ProblemNoteCanvas)으로 채운다. */}
        <ProblemNoteCanvas
          context="homework"
          targetId={batch.id}
          itemId={item.problemId}
          authorId={viewerRole === "student" && !readOnly ? undefined : batch.studentId}
          readOnly={!(viewerRole === "student" && !readOnly)}
        />

        {(showAnswer || (viewerRole === "teacher" && item.explanation)) && item.explanation && (
          <div className="border-t border-grey-100 pt-3">
            <p className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1">해설</p>
            <p className="text-[13px] text-ink whitespace-pre-wrap">{item.explanation}</p>
          </div>
        )}

        {viewerRole === "teacher" && !allGraded && (
          <button
            onClick={() => void finalizeGrading()}
            disabled={grading}
            className="mt-4 text-[12.5px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
          >
            {grading ? "채점 중…" : "채점 완료(전체)"}
          </button>
        )}
        {error && viewerRole === "teacher" && <p className="text-[12px] text-red mt-2">{error}</p>}
      </div>
    </div>
  );
}
