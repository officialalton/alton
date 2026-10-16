import type { SupabaseClient } from "@supabase/supabase-js";
import { satDomainDisplayName, satSkillDisplayName } from "@/lib/sat-keywords/taxonomy";
import { weakSkills, type BreakdownRow } from "./report";

// 2026-10-05 무료 회원 S2 — 누적(응시 간) 약점 요약. 집계는 RPC mock_exam_weakness_summary
// (20262100000001, 채점 확정 응시 전체·조정 채점 반영)가 하고, 표시 이름·약점 순위는 응시 1회
// 리포트(report.ts weakSkills·taxonomy 표시명)와 같은 규칙을 여기서 적용한다.
// 열람 권한은 RPC 안 _mock_exam_can_view(본인·보호자·담당 교사·컨설턴트·관리자).

export type MockExamWeaknessSummary = {
  attemptCount: number;
  gradedAttemptCount: number;
  byDomain: BreakdownRow[];
  bySkill: BreakdownRow[];
};

type RawRow = { key: string; section: "rw" | "math"; total: number; correct: number };

function toRows(raw: unknown, label: (code: string) => string): BreakdownRow[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RawRow[]).map((r) => ({ key: r.key, label: label(r.key), section: r.section, total: Number(r.total), correct: Number(r.correct) }));
}

export async function loadMockExamWeaknessSummary(supabase: SupabaseClient, studentId: string): Promise<MockExamWeaknessSummary> {
  const { data, error } = await supabase.rpc("mock_exam_weakness_summary", { p_student_id: studentId });
  if (error) throw new Error(error.message);
  const d = (data ?? {}) as { attemptCount?: number; gradedAttemptCount?: number; byDomain?: unknown; bySkill?: unknown };
  return {
    attemptCount: Number(d.attemptCount ?? 0),
    gradedAttemptCount: Number(d.gradedAttemptCount ?? 0),
    byDomain: toRows(d.byDomain, satDomainDisplayName),
    bySkill: toRows(d.bySkill, satSkillDisplayName),
  };
}

/** 홈 카드용 약점 상위 N — 세부기술 기준(2문항 이상·정답률 60% 미만, report.ts weakSkills). 세부기술이 모자라면 영역으로 보충. */
export function topWeaknesses(summary: MockExamWeaknessSummary, limit = 3): BreakdownRow[] {
  const skills = weakSkills(summary.bySkill, limit);
  if (skills.length >= limit) return skills;
  const domains = weakSkills(summary.byDomain, limit).filter((d) => !skills.some((s) => s.key === d.key));
  return [...skills, ...domains].slice(0, limit);
}
