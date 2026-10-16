import { RUBRIC_IDS } from "./rubric";

// 화면용 점수 행(학생·보호자가 RLS 로 읽는다). 에세이 원문은 없다.
export type EssayScoreView = {
  setItemId: string; partLabel: string;
  status: "pending" | "processing" | "done" | "failed" | "dead" | "skipped";
  /** 저장된 루브릭 id(englang-v2 | ushistory-v1 | whap-v1). 생략 = 영어. */
  rubricVersion?: string;
  /** 행 키는 루브릭마다 다르다(영어: thesis/evidence/sophistication, History: 과제 유형별). taskType 은 History 에서만. */
  scores: { total: number; disagreement?: boolean; rubricVersion?: string; taskType?: string; [row: string]: number | boolean | string | undefined } | null;
  rationale: { improve: string[]; [row: string]: string | string[] } | null;
  lastError: string | null;
};

type Sb = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

/** 응시 하나의 점수 행(쿼리 1회). 테이블이 없거나 오류면 빈 목록 — 결과 화면은 점수 없이도 정상 동작해야 한다. */
export async function loadEssayScores(supabase: Sb, attemptId: string): Promise<EssayScoreView[]> {
  try {
    const { data, error } = await supabase.from("mock_exam_essay_scores")
      .select("set_item_id, part_label, status, scores, rationale, last_error, rubric_version").eq("attempt_id", attemptId).in("rubric_version", [...RUBRIC_IDS]);
    if (error || !Array.isArray(data)) return [];
    return data.map((r: Record<string, unknown>) => ({ setItemId: r.set_item_id, rubricVersion: r.rubric_version, partLabel: r.part_label, status: r.status, scores: r.scores ?? null, rationale: r.rationale ?? null, lastError: (r.last_error as string) ?? null })) as EssayScoreView[];
  } catch { return []; }
}
