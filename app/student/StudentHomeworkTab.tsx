"use client";

import { useEffect, useState } from "react";
import type { StudentHomeworkSet } from "./homework-v3-data";
import type { SessionProblem } from "@/app/session/[id]/session-problem-data";
import { refreshSessionProblems } from "@/app/session/[id]/problem-work-actions";
import ProblemsPanel from "@/app/session/[id]/ProblemsPanel";

// 2026-09-14 과제 v3 통일 — 학생 포털 과제 탭.
//   위: 수업별 과제 묶음 탭("9월 15일 · SAT Reading 수업 과제").
//   아래: 그 수업의 과제 문제를 **수업 화면 문제 탭과 같은 패널**(슬라이드·연습장·채점 결과)로 푼다.
// 레거시 homework_items(작성 필요/작성 완료)는 이 화면에서 뺐다 — 신규 쓰기 없음, 기록은 수업 화면에서만.

function setLabel(set: StudentHomeworkSet): string {
  const date = set.startsAt
    ? new Date(set.startsAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })
    : new Date(set.composedAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
  return `${date} · ${set.subjectName ? `${set.subjectName} ` : ""}수업 과제`;
}

export default function StudentHomeworkTab({
  studentId,
  homeworkSets,
}: {
  /** 학생 본인 id — 과제 패널이 풀이판·답을 이 학생 것으로 연다. */
  studentId: string;
  homeworkSets?: StudentHomeworkSet[];
}) {
  const sets = homeworkSets ?? [];
  const [activeSessionId, setActiveSessionId] = useState<string | null>(sets[0]?.sessionId ?? null);
  const [problemsBySession, setProblemsBySession] = useState<Record<string, SessionProblem[]>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  const active = sets.find((s) => s.sessionId === activeSessionId) ?? null;
  const problems = active ? problemsBySession[active.sessionId] : undefined;

  useEffect(() => {
    if (!active || problemsBySession[active.sessionId]) return;
    const sessionId = active.sessionId;
    let cancelled = false;
    refreshSessionProblems(sessionId, "homework")
      .then((list) => {
        if (!cancelled) setProblemsBySession((prev) => ({ ...prev, [sessionId]: list }));
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "과제를 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, [active, problemsBySession]);

  return (
    <div className="py-6">
      <div className="px-8">
        <h1 className="text-[20px] font-extrabold text-ink mb-1.5">과제</h1>
        <p className="text-[13px] text-grey-500 mb-4">
          선생님이 수업마다 낸 과제입니다. 수업 문제와 같은 방식으로 풀고, 채점이 끝나면 정답과 해설이 열립니다.
        </p>
      </div>

      {sets.length === 0 ? (
        <div className="mx-8 text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          아직 발급된 과제가 없습니다. 선생님이 내면 여기에 나타납니다.
        </div>
      ) : (
        <>
          <div className="flex gap-2 px-8 mb-2 overflow-x-auto border-b border-grey-200" role="tablist" aria-label="수업별 과제">
            {sets.map((set) => {
              const selected = set.sessionId === activeSessionId;
              const status =
                set.graded === set.total ? "채점 완료" : set.answered === set.total ? "채점 대기" : `${set.total - set.answered}문제 남음`;
              return (
                <button
                  key={set.sessionId}
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveSessionId(set.sessionId)}
                  className={
                    "text-[13px] font-semibold pb-2.5 -mb-px border-b-2 whitespace-nowrap flex items-center gap-2 " +
                    (selected ? "text-ink border-ink" : "text-grey-500 border-transparent")
                  }
                >
                  {setLabel(set)}
                  <span
                    className={
                      "text-[10.5px] font-bold px-2 py-0.5 rounded-full " +
                      (set.graded === set.total ? "bg-green/10 text-green" : set.answered === set.total ? "bg-grey-100 text-grey-500" : "bg-red-bg text-red")
                    }
                  >
                    {status}
                  </span>
                </button>
              );
            })}
          </div>

          {loadError && <p className="px-8 text-[12.5px] text-red">{loadError}</p>}
          {active && !problems && !loadError && (
            <p className="px-8 py-6 text-[12.5px] text-grey-500">과제를 불러오는 중…</p>
          )}
          {active && problems && (
            <ProblemsPanel
              key={active.sessionId}
              sessionId={active.sessionId}
              studentId={studentId}
              problems={problems}
              viewerRole="student"
              viewerUserId={studentId}
              source="homework"
            />
          )}
        </>
      )}
    </div>
  );
}
