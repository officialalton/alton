"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MockExamAttemptSummary } from "@/lib/mock-exam/attempt-data";
import { loadChildMockExamAttemptsAction } from "./mock-exam-tab-actions";

const STATUS_LABEL: Record<string, string> = {
  assigned: "시작 전",
  in_progress: "진행 중",
  submitted: "제출됨 — 채점 대기",
  graded: "채점 완료",
};

// 2026-09-21(UAT 지적) — 학부모 홈의 "모의고사" 서브탭은 독립 라우트로 이동하지 않고 탭 안에서 자녀
// 응시 목록을 바로 보여준다(좌측 네비게이션 유지). 상세 결과만 기존 라우트로 연다.
export default function ParentMockExamTab({ studentId }: { studentId: string | null }) {
  const [attempts, setAttempts] = useState<MockExamAttemptSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    setAttempts(null);
    loadChildMockExamAttemptsAction(studentId)
      .then((rows) => {
        if (!cancelled) setAttempts(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "모의고사 목록을 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (!studentId) return <p className="p-8 text-[14px] text-grey-500">자녀를 먼저 선택하세요.</p>;
  if (error) return <p className="p-8 text-[14px] text-red">{error}</p>;
  if (attempts === null) return <p className="p-8 text-[14px] text-grey-500">불러오는 중...</p>;
  if (attempts.length === 0) return <p className="p-8 text-[14px] text-grey-500">배정된 모의고사가 없습니다.</p>;

  return (
    <ul className="px-6 py-5 flex flex-col gap-2">
      {attempts.map((a) => (
        <li key={a.id} className="rounded-lg border border-grey-200 bg-white p-4">
          <p className="text-[14px] font-bold">{a.examSetName}</p>
          <p className="mt-1 text-[12.5px] text-grey-500">
            {STATUS_LABEL[a.status] ?? a.status}
            {a.status === "graded" && a.correctCount !== null && ` · ${a.correctCount}/${a.totalCount} 정답`}
          </p>
          {a.status === "graded" && (
            <Link href={`/parent/mock-exam/${studentId}/${a.id}`} className="mt-2 inline-block text-[12.5px] font-bold text-ink underline">
              상세 결과 보기
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
