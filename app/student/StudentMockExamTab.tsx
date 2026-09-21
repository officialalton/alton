"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MockExamAttemptSummary } from "@/lib/mock-exam/attempt-data";
import { loadMyMockExamAttemptsAction } from "./mock-exam-tab-actions";

const STATUS_LABEL: Record<string, string> = {
  assigned: "시작 전",
  in_progress: "진행 중",
  submitted: "제출됨 — 채점 대기",
  graded: "채점 완료",
};

// 2026-09-21(UAT 지적) — 모의고사 목록은 독립 라우트(/student/mock-exam)가 아니라 StudentShell 의
// 탭 안에서 동작한다(좌측 네비게이션 유지). 실제 응시·결과 화면(/student/mock-exam/[attemptId])만
// 전체 화면 독립 라우트로 남긴다.
export default function StudentMockExamTab() {
  const [attempts, setAttempts] = useState<MockExamAttemptSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadMyMockExamAttemptsAction()
      .then((rows) => {
        if (!cancelled) setAttempts(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "모의고사 목록을 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="text-[13px] text-red">{error}</p>;
  if (attempts === null) return <p className="text-[13px] text-grey-500">불러오는 중…</p>;
  if (attempts.length === 0) return <p className="text-[13px] text-grey-500">배정된 모의고사가 없습니다.</p>;

  return (
    <ul className="flex flex-col gap-2">
      {attempts.map((a) => (
        <li key={a.id} className="rounded-lg border border-grey-200 bg-white p-4">
          <p className="text-[14px] font-bold">{a.examSetName}</p>
          <p className="mt-1 text-[12.5px] text-grey-500">
            {STATUS_LABEL[a.status] ?? a.status}
            {a.status === "graded" && a.correctCount !== null && ` · ${a.correctCount}/${a.totalCount} 정답`}
          </p>
          <Link href={`/student/mock-exam/${a.id}`} className="mt-2 inline-block text-[12.5px] font-bold text-ink underline">
            {a.status === "graded" ? "결과 보기" : a.status === "assigned" ? "시험 시작" : "이어서 풀기"}
          </Link>
        </li>
      ))}
    </ul>
  );
}
