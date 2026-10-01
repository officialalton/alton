import { createAdminClient } from "@/lib/supabase-admin";
import { selectInChunks } from "@/lib/select-in-chunks";

// 2026-09-29 — 레거시 problems.correct_index / explanation 은 anon·authenticated 의 SELECT 가 회수됐다
// (20261904000000). 학생·학부모·교사 세션으로는 REST 로 읽을 수 없으므로 서버에서 admin 클라이언트로만
// 읽는다. 호출자는 **이미 사용자 세션의 RLS 로 볼 수 있다고 확인한 problem id 만** 넘기고, 결과를
// 화면에 싣기 전 기존과 같은 조건(교사·관리자 / 시도 종료 / 채점 뒤)으로 가려야 한다.
export type LegacyProblemAnswer = { correctIndex: number | null; explanation: string };

export async function loadLegacyProblemAnswers(problemIds: readonly string[]): Promise<Map<string, LegacyProblemAnswer>> {
  const out = new Map<string, LegacyProblemAnswer>();
  if (problemIds.length === 0) return out;
  const admin = createAdminClient();
  const { data, error } = await selectInChunks(problemIds, (chunk) =>
    admin.from("problems").select("id, correct_index, explanation").in("id", chunk)
  );
  if (error) throw new Error(error.message ?? "문제 정답을 읽지 못했습니다.");
  for (const r of data) {
    out.set(r.id as string, {
      correctIndex: (r.correct_index as number | null) ?? null,
      explanation: (r.explanation as string | null) ?? "",
    });
  }
  return out;
}
