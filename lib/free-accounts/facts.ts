import type { AttemptFacts, SectionFacts } from "@/lib/mock-exam/score-aggregate";
import type { ScoreRoute } from "@/lib/mock-exam/score-estimate";
import type { AttemptHistoryRow } from "./types";

// admin_student_mock_attempt_facts 행(snake_case) -> 공유 점수 모듈 입력. 순수 변환.
export type FactsRpcRow = {
  attempt_id: string; exam_name: string; exam_track: string; ap_subject: string | null; difficulty_tier: string; format: string;
  status: string; started_at: string | null; submitted_at: string | null; graded_at: string | null;
  attempt_seq: number; score_adjusted: boolean;
  rw_total: number; rw_correct: number | null; rw_complete: boolean; rw_route: string | null;
  math_total: number; math_correct: number | null; math_complete: boolean; math_route: string | null;
};

const route = (r: string | null): ScoreRoute | null => (r === "higher" || r === "lower" ? r : null);
const section = (total: number, correct: number | null, complete: boolean, r: string | null): SectionFacts => ({ total, correct, complete, route: route(r) });

export function factsFromRpcRows(rows: FactsRpcRow[]): AttemptHistoryRow[] {
  return rows.map((r, i) => ({
    attemptId: r.attempt_id,
    examName: r.exam_name,
    track: r.exam_track === "ap" ? "ap" : "sat",
    apSubject: r.ap_subject,
    format: r.format === "mst" ? "mst" : "fixed",
    status: r.status as AttemptFacts["status"],
    startedAt: r.started_at,
    gradedAt: r.graded_at,
    attemptSeq: r.attempt_seq,
    sections: {
      rw: section(r.rw_total, r.rw_correct, r.rw_complete, r.rw_route),
      math: section(r.math_total, r.math_correct, r.math_complete, r.math_route),
    },
    difficultyTier: r.difficulty_tier,
    submittedAt: r.submitted_at,
    scoreAdjusted: r.score_adjusted,
    createdAtOrder: i,
  }));
}
