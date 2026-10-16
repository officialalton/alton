"use server";

import { requireUser } from "@/lib/auth";

// 2026-10-05 무료 회원 S5 — 담당 컨설턴트(또는 관리자)의 읽기 전용 학습 요약. RPC(free_member_learning_summary)가
// 활성 동의·담당 상담·감사 기록을 모두 처리한다. 호출마다 감사 행이 남으므로 사용자가 버튼을 눌렀을 때만 호출한다.
export type FreeMemberLearningSummary = {
  attemptCount: number;
  gradedAttemptCount: number;
  vocabWordCount: number;
  lastActivityAt: string | null;
  recentAttempts: { examSetName: string; submittedAt: string | null; rw: { correct: number; total: number }; math: { correct: number; total: number } }[];
  weakestDomains: { key: string; section: string; total: number; correct: number }[];
  weakestSkills: { key: string; section: string; total: number; correct: number }[];
};

export async function loadFreeMemberLearningSummaryAction(
  studentId: string
): Promise<{ ok: true; summary: FreeMemberLearningSummary } | { ok: false; error: string }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("free_member_learning_summary", { p_student_id: studentId });
  if (error) {
    if (error.message.includes("no_active_grant")) return { ok: false, error: "The guardian hasn't shared a learning summary, or sharing was stopped." };
    if (error.message.includes("not_assigned_consultant")) return { ok: false, error: "You can view this summary only while this consultation is yours." };
    return { ok: false, error: "We couldn't load the learning summary." };
  }
  return { ok: true, summary: data as FreeMemberLearningSummary };
}
