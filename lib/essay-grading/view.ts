import { RUBRIC_VERSION } from "./rubric";

// 화면용 점수 행(학생·보호자가 RLS 로 읽는다). 에세이 원문은 없다.
export type EssayScoreView = {
  setItemId: string; partLabel: string;
  status: "pending" | "processing" | "done" | "failed" | "dead" | "skipped";
  scores: { thesis: number; evidence: number; sophistication: number; total: number; disagreement?: boolean } | null;
  rationale: { thesis: string; evidence: string; sophistication: string; improve: string[] } | null;
  lastError: string | null;
};

type Sb = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

/** 응시 하나의 점수 행(쿼리 1회). 테이블이 없거나 오류면 빈 목록 — 결과 화면은 점수 없이도 정상 동작해야 한다. */
export async function loadEssayScores(supabase: Sb, attemptId: string, rubricVersion: string = RUBRIC_VERSION): Promise<EssayScoreView[]> {
  try {
    const { data, error } = await supabase.from("mock_exam_essay_scores")
      .select("set_item_id, part_label, status, scores, rationale, last_error").eq("attempt_id", attemptId).eq("rubric_version", rubricVersion);
    if (error || !Array.isArray(data)) return [];
    return data.map((r: Record<string, unknown>) => ({ setItemId: r.set_item_id, partLabel: r.part_label, status: r.status, scores: r.scores ?? null, rationale: r.rationale ?? null, lastError: (r.last_error as string) ?? null })) as EssayScoreView[];
  } catch { return []; }
}
