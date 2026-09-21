"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MockExamAttemptDetail, MockExamAttemptSummary } from "@/lib/mock-exam/attempt-data";
import { loadMyMockExamAttemptsAction, loadMockExamAttemptDetailAction } from "./mock-exam-tab-actions";
import MockExamResultView from "./mock-exam/[attemptId]/MockExamResultView";

const STATUS_LABEL: Record<string, string> = {
  assigned: "시작 전",
  in_progress: "진행 중",
  submitted: "채점 중",
  graded: "채점 완료",
};

// 2026-09-21(UAT 지적) — 모의고사 목록·결과는 독립 라우트가 아니라 StudentShell 의 탭 안에서
// 왼쪽 네비게이션을 유지한 채 봐야 한다. 실제로 시험을 보는 화면(집중이 필요한 타이머 있는 화면)만
// 예외적으로 /student/mock-exam/[attemptId] 독립 라우트로 남긴다.
export default function StudentMockExamTab() {
  const [attempts, setAttempts] = useState<MockExamAttemptSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MockExamAttemptDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

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

  function openResult(id: string) {
    setOpenId(id);
    setDetail(null);
    setDetailError(null);
    loadMockExamAttemptDetailAction(id)
      .then((d) => setDetail(d))
      .catch((e) => setDetailError(e instanceof Error ? e.message : "결과를 불러오지 못했습니다."));
  }

  if (error) return <p className="text-[13px] text-red">{error}</p>;
  if (attempts === null) return <p className="text-[13px] text-grey-500">불러오는 중…</p>;

  if (openId) {
    return (
      <div>
        <button type="button" onClick={() => setOpenId(null)} className="mb-3 text-[12px] font-semibold text-grey-500">
          ← 모의고사 목록으로
        </button>
        {detailError ? (
          <p className="text-[13px] text-red">{detailError}</p>
        ) : !detail ? (
          <p className="text-[13px] text-grey-500">불러오는 중…</p>
        ) : (
          <MockExamResultView attempt={detail} readOnly={false} />
        )}
      </div>
    );
  }

  if (attempts.length === 0) return <p className="text-[13px] text-grey-500">배정된 모의고사가 없습니다.</p>;

  return (
    <ul className="flex flex-col gap-2">
      {attempts.map((a) => {
        const isGraded = a.status === "graded" || a.status === "submitted";
        return (
          <li key={a.id} className="rounded-lg border border-grey-200 bg-white p-4">
            <p className="text-[14px] font-bold">{a.examSetName}</p>
            <p className="mt-1 text-[12.5px] text-grey-500">
              {STATUS_LABEL[a.status] ?? a.status}
              {a.status === "graded" && a.correctCount !== null && ` · ${a.correctCount}/${a.totalCount} 정답`}
            </p>
            {isGraded ? (
              <button type="button" onClick={() => openResult(a.id)} className="mt-2 inline-block text-[12.5px] font-bold text-ink underline">
                결과 보기
              </button>
            ) : (
              <Link href={`/student/mock-exam/${a.id}`} className="mt-2 inline-block text-[12.5px] font-bold text-ink underline">
                {a.status === "assigned" ? "시험 시작" : "이어서 풀기"}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
