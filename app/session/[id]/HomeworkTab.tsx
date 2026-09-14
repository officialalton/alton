"use client";

import { useState } from "react";
import type { SessionViewViewer } from "@/lib/session-view";
import type { KeywordProblem } from "@/lib/unit-composition";
import type { HomeworkItem } from "./homework-data";
import type { SessionProblem } from "./session-problem-data";
import type { IssuedHomeworkItem } from "./homework-v3-data";
import { issueHomework, withdrawHomework } from "./homework-v3-actions";
import ProblemsPanel from "./ProblemsPanel";

// 2026-09-14 과제 v3 통일(docs/2026-09-14-homework-v3-unification.md)
//
//   위: [교사만] 발급 구역 — 이 회차 키워드 풀의 문제를 직접 골라 과제로 낸다. 발급된 항목은 학생이
//       시작하기 전까지 회수할 수 있다.
//   아래: 과제 문제 패널 — 수업 '문제' 탭과 **완전히 같은** 화면·풀이·채점(ProblemsPanel source="homework").
//   레거시 homework_items 는 기록이 있을 때만 읽기 전용으로 보여준다. 신규 쓰기는 없다.

const FORMAT_LABEL: Record<string, string> = { mc: "객관식", essay: "서술형", math: "풀이형" };
const DIFFICULTY_LABEL: Record<string, string> = { easy: "쉬움", medium: "보통", hard: "어려움" };

export default function HomeworkTab({
  sessionId,
  studentId,
  viewerUserId,
  initialItems,
  viewerRole,
  sessionSource = "legacy",
  realViewerRole,
  homeworkProblems = [],
  pool = [],
  issued = [],
  usedInLessonIds = [],
}: {
  sessionId: string;
  studentId: string;
  viewerUserId?: string;
  /** 레거시 homework_items — 읽기 전용. */
  initialItems: HomeworkItem[];
  viewerRole: SessionViewViewer;
  sessionSource?: "legacy" | "v3";
  /** 데모션되지 않은 실제 역할 — 발급·회수는 실제 교사·관리자만. */
  realViewerRole?: SessionViewViewer;
  homeworkProblems?: SessionProblem[];
  /** 이 회차 키워드 풀의 문제(교사에게만 내려온다). */
  pool?: KeywordProblem[];
  issued?: IssuedHomeworkItem[];
  /** 수업에서 다룬(고정된) 문제 — 기본으로 목록에서 숨긴다. */
  usedInLessonIds?: string[];
}) {
  const canIssue = sessionSource === "v3" && (realViewerRole === "teacher" || realViewerRole === "admin");
  const panelRole: "student" | "teacher" | "parent" | "admin" =
    viewerRole === "teacher" || viewerRole === "student" || viewerRole === "parent" || viewerRole === "admin"
      ? viewerRole
      : "student";

  return (
    <div>
      {canIssue && (
        <IssueBox sessionId={sessionId} pool={pool} issued={issued} usedInLessonIds={usedInLessonIds} />
      )}

      {sessionSource === "v3" ? (
        <ProblemsPanel
          sessionId={sessionId}
          studentId={studentId}
          problems={homeworkProblems}
          viewerRole={panelRole}
          viewerUserId={viewerUserId}
          source="homework"
        />
      ) : null}

      {initialItems.length > 0 && (
        <section className="max-w-[760px] mx-auto px-5 sm:px-8 py-6 border-t border-grey-200">
          <h2 className="text-[13px] font-bold text-ink mb-1">예전 과제 기록</h2>
          <p className="text-[12px] text-grey-500 mb-3">이전 방식으로 낸 과제입니다. 읽기만 합니다.</p>
          {initialItems.map((item) => (
            <div key={item.id} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
              <h3 className="text-[14px] font-bold text-ink mb-1">{item.title}</h3>
              {item.description && <p className="text-[13px] text-grey-500 leading-[1.6] mb-2">{item.description}</p>}
              <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mt-2">학생 답안</div>
              <div className="text-[13px] text-ink whitespace-pre-wrap">{item.studentAnswer || "제출하지 않았습니다."}</div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function IssueBox({
  sessionId,
  pool,
  issued,
  usedInLessonIds,
}: {
  sessionId: string;
  pool: KeywordProblem[];
  issued: IssuedHomeworkItem[];
  usedInLessonIds: string[];
}) {
  const [open, setOpen] = useState(issued.length === 0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showUsed, setShowUsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const issuedIds = new Set(issued.map((i) => i.problemId));
  const used = new Set(usedInLessonIds);
  const candidates = pool.filter((p) => !issuedIds.has(p.problemId) && (showUsed || !used.has(p.problemId)));
  const hiddenUsed = pool.filter((p) => !issuedIds.has(p.problemId) && used.has(p.problemId)).length;
  const labelById = new Map(pool.map((p) => [p.problemId, p]));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function issue() {
    if (selected.size === 0) return;
    setBusy(true);
    setError(null);
    const r = await issueHomework(sessionId, Array.from(selected));
    if (!r.ok) {
      setError(r.error);
      setBusy(false);
      return;
    }
    // 발급 결과(과제 문제 패널·목록)는 서버 데이터라 한 번 다시 읽는다.
    window.location.reload();
  }

  async function withdraw(item: IssuedHomeworkItem) {
    setBusy(true);
    setError(null);
    const r = await withdrawHomework(item.itemId);
    if (!r.ok) {
      setError(r.error);
      setBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <section className="border-b border-grey-200 px-5 sm:px-8 py-5" data-testid="homework-issue">
      <div className="max-w-[760px] mx-auto">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h2 className="text-[14px] font-extrabold text-ink">과제 발급</h2>
          <span className="text-[12px] text-grey-500">
            발급 {issued.length}개 · 풀에 {pool.length}개
          </span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="ml-auto text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink"
          >
            {open ? "접기" : "문제 고르기"}
          </button>
        </div>
        {error && <p className="text-[12.5px] text-red mb-2">{error}</p>}

        {issued.length > 0 && (
          <ul className="mb-3">
            {issued.map((i) => {
              const p = labelById.get(i.problemId);
              return (
                <li key={i.itemId} className="flex items-center gap-2 text-[12.5px] py-1 border-b border-grey-100">
                  <span className="font-bold text-ink shrink-0">과제 {i.position}</span>
                  <span className="text-grey-500 truncate flex-1">
                    {p ? `${FORMAT_LABEL[p.format] ?? p.format} · ${p.label}` : "문제"}
                  </span>
                  <button
                    type="button"
                    disabled={busy || i.started}
                    title={i.started ? "학생이 이미 풀기 시작해 회수할 수 없습니다" : undefined}
                    onClick={() => void withdraw(i)}
                    className="text-[11.5px] font-bold text-red disabled:opacity-40 shrink-0"
                  >
                    {i.started ? "풀이 시작함" : "회수"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {open && (
          <div className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <p className="text-[12px] text-grey-500">
                이 회차 키워드의 문제입니다. 골라서 과제로 냅니다 — 학생은 수업 문제와 같은 방식으로 풀고, 채점 뒤 정답·해설이 열립니다.
              </p>
              {hiddenUsed > 0 && (
                <label className="text-[12px] text-ink flex items-center gap-1.5">
                  <input type="checkbox" checked={showUsed} onChange={(e) => setShowUsed(e.target.checked)} />
                  수업에서 다룬 문제 {hiddenUsed}개도 보기
                </label>
              )}
            </div>
            {candidates.length === 0 ? (
              <p className="text-[12.5px] text-grey-500">낼 수 있는 문제가 없습니다.</p>
            ) : (
              <ul className="max-h-[320px] overflow-y-auto">
                {candidates.map((p) => (
                  <li key={p.problemId}>
                    <label className="flex items-start gap-2 py-1.5 text-[12.5px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected.has(p.problemId)}
                        onChange={() => toggle(p.problemId)}
                        aria-label={p.label}
                      />
                      <span className="text-[10.5px] font-bold text-grey-500 border border-grey-200 rounded-full px-1.5 py-0.5 shrink-0">
                        {FORMAT_LABEL[p.format] ?? p.format}
                      </span>
                      {p.difficulty && (
                        <span className="text-[10.5px] font-bold text-grey-500 border border-grey-200 rounded-full px-1.5 py-0.5 shrink-0">
                          {DIFFICULTY_LABEL[p.difficulty] ?? p.difficulty}
                        </span>
                      )}
                      <span className="text-ink">{p.label}</span>
                      {used.has(p.problemId) && <span className="text-[10.5px] text-grey-500 shrink-0">수업에서 다룸</span>}
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              disabled={busy || selected.size === 0}
              onClick={() => void issue()}
              className="mt-2 text-[12.5px] font-bold px-4 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
            >
              {busy ? "발급 중…" : `과제로 발급 (${selected.size})`}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
