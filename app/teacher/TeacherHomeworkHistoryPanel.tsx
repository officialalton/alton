"use client";

import { useEffect, useState } from "react";
import type { StudentHomeworkSet } from "./homework-direct-data";
import { loadStudentHomeworkHistoryAction } from "./homework-direct-client-data";
import type { SessionProblem } from "@/app/session/[id]/session-problem-data";
import { refreshSessionProblems } from "@/app/session/[id]/problem-work-actions";
import ProblemsPanel from "@/app/session/[id]/ProblemsPanel";

// 2026-09-16 — "과제 내역"(교사). 학생 포털 과제 탭과 같은 패턴(회차별 묶음 → 그 회차 것을
// 클릭하면 아래에 기존 과제 패널 그대로) — 교사는 여기서 바로 정답·해설을 보고 채점할 수 있다.
function setLabel(set: StudentHomeworkSet): string {
  const date = set.startsAt
    ? new Date(set.startsAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })
    : new Date(set.composedAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
  return `${date} · ${set.subjectName ? `${set.subjectName} ` : ""}수업 과제`;
}

export default function TeacherHomeworkHistoryPanel({ studentId }: { studentId: string }) {
  const [sets, setSets] = useState<StudentHomeworkSet[] | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [problemsBySession, setProblemsBySession] = useState<Record<string, SessionProblem[]>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setSets(null);
    setActiveSessionId(null);
    loadStudentHomeworkHistoryAction(studentId).then((list) => {
      setSets(list);
      setActiveSessionId(list[0]?.sessionId ?? null);
    });
  }, [studentId]);

  const active = sets?.find((s) => s.sessionId === activeSessionId) ?? null;
  const problems = active ? problemsBySession[active.sessionId] : undefined;

  useEffect(() => {
    if (!active || problemsBySession[active.sessionId]) return;
    const sessionId = active.sessionId;
    let cancelled = false;
    refreshSessionProblems(sessionId, "homework")
      .then((list) => { if (!cancelled) setProblemsBySession((prev) => ({ ...prev, [sessionId]: list })); })
      .catch((e) => { if (!cancelled) setLoadError(e instanceof Error ? e.message : "과제를 불러오지 못했습니다."); });
    return () => { cancelled = true; };
  }, [active, problemsBySession]);

  if (sets === null) return <p className="text-[13px] text-grey-500">불러오는 중…</p>;

  if (sets.length === 0) {
    return <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">아직 이 학생에게 낸 과제가 없습니다.</div>;
  }

  return (
    <div>
      <div className="flex gap-2 mb-2 overflow-x-auto border-b border-grey-200" role="tablist" aria-label="회차별 과제">
        {sets.map((set) => {
          const selected = set.sessionId === activeSessionId;
          const status = set.graded === set.total ? "채점 완료" : set.answered === set.total ? "채점 대기" : `${set.total - set.answered}문제 남음`;
          return (
            <button
              key={set.sessionId}
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveSessionId(set.sessionId)}
              className={"text-[13px] font-semibold pb-2.5 -mb-px border-b-2 whitespace-nowrap flex items-center gap-2 " + (selected ? "text-ink border-ink" : "text-grey-500 border-transparent")}
            >
              {setLabel(set)}
              <span className={"text-[10.5px] font-bold px-2 py-0.5 rounded-full " + (set.graded === set.total ? "bg-green/10 text-green" : set.answered === set.total ? "bg-grey-100 text-grey-500" : "bg-red-bg text-red")}>
                {status}
              </span>
            </button>
          );
        })}
      </div>

      {loadError && <p className="text-[12.5px] text-red mt-3">{loadError}</p>}
      {active && !problems && !loadError && <p className="py-6 text-[12.5px] text-grey-500">과제를 불러오는 중…</p>}
      {active && problems && (
        <ProblemsPanel
          key={active.sessionId}
          sessionId={active.sessionId}
          studentId={studentId}
          problems={problems}
          viewerRole="teacher"
          source="homework"
        />
      )}
    </div>
  );
}
