"use client";

import { useEffect, useState } from "react";
import type { MockExamAttemptSummary, MockExamAttemptDetail } from "@/lib/mock-exam/attempt-data";
import { loadSessionMockExamAttemptsAction, loadSessionMockExamAttemptDetailAction } from "./session-mock-exam-actions";
import MockExamTakeClient from "@/app/student/mock-exam/[attemptId]/MockExamTakeClient";
import MockExamResultView from "@/app/student/mock-exam/[attemptId]/MockExamResultView";
import TeacherMockExamAttemptViewer from "@/app/teacher/TeacherMockExamAttemptViewer";

const STATUS_LABEL: Record<string, string> = {
  assigned: "시작 전",
  in_progress: "진행 중",
  submitted: "채점 중",
  graded: "채점 완료",
};

/** 세션뷰 "모의고사" 탭 — 단어장 탭과 같은 방식으로, 별도 라우트로 나가지 않고 이
 * 탭 안에서 목록·응시·결과를 그대로 본다(2026-09-21 UAT 지적). 학생은 직접 풀고,
 * 교사는 읽기 전용으로 본다(진행 중이면 지금까지 푼 것을, 채점 완료면 결과를). */
export default function SessionMockExamTab({
  studentId,
  isTeacher,
  initialAttempts,
}: {
  studentId: string;
  isTeacher: boolean;
  /** 2026-09-22(UAT "모의고사 탭만 유독 로딩이 길다") — 세션 페이지가 SSR로 미리
   * 받아 두면(다른 탭과 동일한 패턴) 탭을 열 때 따로 왕복하지 않는다. 없으면(구
   * 호출 경로 대비) 기존처럼 클라이언트에서 받는다. */
  initialAttempts?: MockExamAttemptSummary[];
}) {
  const [attempts, setAttempts] = useState<MockExamAttemptSummary[] | null>(initialAttempts ?? null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MockExamAttemptDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialAttempts) return;
    let cancelled = false;
    loadSessionMockExamAttemptsAction(studentId)
      .then((rows) => {
        if (!cancelled) setAttempts(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "모의고사 목록을 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  function open(id: string) {
    setOpenId(id);
    setDetail(null);
    setError(null);
    loadSessionMockExamAttemptDetailAction(id)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했습니다."));
  }

  if (error) return <p className="p-6 text-[13px] text-red">{error}</p>;

  if (openId) {
    return (
      <div className="mx-auto max-w-[900px] px-6 py-6">
        <button
          type="button"
          onClick={() => setOpenId(null)}
          className="mb-4 rounded-lg border-[1.5px] border-grey-200 px-3 py-1.5 text-[13px] font-semibold text-grey-600 hover:bg-grey-100 active:scale-95"
        >
          ← 모의고사 목록으로
        </button>
        {!detail ? (
          <p className="text-[13px] text-grey-500">불러오는 중…</p>
        ) : detail.status === "graded" ? (
          <MockExamResultView attempt={detail} readOnly={isTeacher} />
        ) : isTeacher ? (
          <TeacherMockExamAttemptViewer attempt={detail} />
        ) : (
          <MockExamTakeClient attempt={detail} />
        )}
      </div>
    );
  }

  if (attempts === null) return <p className="p-6 text-[13px] text-grey-500">불러오는 중…</p>;
  if (attempts.length === 0) return <p className="p-6 text-[13px] text-grey-500">배정된 모의고사가 없습니다.</p>;

  return (
    <div className="mx-auto max-w-[720px] px-6 py-6">
      <ul className="flex flex-col gap-2">
        {attempts.map((a) => (
          <li key={a.id} className="rounded-lg border border-grey-200 bg-white p-4">
            <p className="text-[14px] font-bold">{a.examSetName}</p>
            <p className="mt-1 text-[12.5px] text-grey-500">
              {STATUS_LABEL[a.status] ?? a.status}
              {a.status === "graded" && a.correctCount !== null && ` · ${a.correctCount}/${a.totalCount} 정답`}
            </p>
            <button type="button" onClick={() => open(a.id)} className="mt-2 text-[12.5px] font-bold text-ink underline">
              {a.status === "graded" ? "결과 보기" : isTeacher ? "풀이 보기" : a.status === "assigned" ? "시험 시작" : "이어서 풀기"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
