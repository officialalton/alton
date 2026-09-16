"use client";

import { useState } from "react";
import type { SessionViewViewer } from "@/lib/session-view";
import type { KeywordProblem } from "@/lib/unit-composition";
import type { HomeworkItem } from "./homework-data";
import type { SessionProblem } from "./session-problem-data";
import type { IssuedHomeworkItem } from "./homework-v3-data";
import { withdrawHomework } from "./homework-v3-actions";
import ProblemsPanel from "./ProblemsPanel";

// 2026-09-16(개정) — 과제 발급은 교사 포털 "과제" 탭(학생·수업·키워드를 한 번에 골라 즉시 발급)
// 에서만 한다. 세션뷰에는 발급 UI가 없다 — 발급된 순간 이 화면 아래 과제 문제 패널에 그대로 뜬다
// (수업 '문제' 탭과 완전히 같은 화면·풀이·채점, ProblemsPanel source="homework").
// docs/2026-09-16-homework-direct-issue-plan.md 참고. 위: 발급된 목록 + 회수(학생이 시작하기 전까지).

const FORMAT_LABEL: Record<string, string> = { mc: "객관식", spr: "숫자 입력", essay: "서술형", math: "풀이형" };

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
}: {
  sessionId: string;
  studentId: string;
  viewerUserId?: string;
  /** 레거시 homework_items — 읽기 전용. */
  initialItems: HomeworkItem[];
  viewerRole: SessionViewViewer;
  sessionSource?: "legacy" | "v3";
  /** 데모션되지 않은 실제 역할 — 회수는 실제 교사·관리자만. */
  realViewerRole?: SessionViewViewer;
  homeworkProblems?: SessionProblem[];
  /** 발급된 목록의 이름 표시용. */
  pool?: KeywordProblem[];
  issued?: IssuedHomeworkItem[];
}) {
  const canManage = sessionSource === "v3" && (realViewerRole === "teacher" || realViewerRole === "admin");
  const panelRole: "student" | "teacher" | "parent" | "admin" =
    viewerRole === "teacher" || viewerRole === "student" || viewerRole === "parent" || viewerRole === "admin"
      ? viewerRole
      : "student";

  return (
    <div>
      {canManage && issued.length > 0 && <IssuedList sessionId={sessionId} pool={pool} issued={issued} />}

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

function IssuedList({ pool, issued }: { sessionId: string; pool: KeywordProblem[]; issued: IssuedHomeworkItem[] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const labelById = new Map(pool.map((p) => [p.problemId, p]));

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
          <h2 className="text-[14px] font-extrabold text-ink">발급된 과제</h2>
          <span className="text-[12px] text-grey-500">{issued.length}개 · 교사 포털 “과제” 탭에서 낼 수 있습니다.</span>
        </div>
        {error && <p className="text-[12.5px] text-red mb-2">{error}</p>}
        <ul>
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
      </div>
    </section>
  );
}
