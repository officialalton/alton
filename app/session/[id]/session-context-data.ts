import type { SupabaseClient } from "@supabase/supabase-js";

// P2/P3 5단계 — 수업 화면 맨 위에 "지금 어디에 있는가"를 보여주기 위한 조회.
// 커리큘럼 → 회차 준비 → 수업 → 복습이 한 줄기로 읽히려면, 수업 화면에서도
// 이 수업이 커리큘럼의 어느 회차이고 그 회차의 목표가 무엇인지 보여야 한다.
export type SessionLessonContext = {
  /** 이 수업이 다루는 기본 회차 이름. */
  unitTitle: string | null;
  /** 그 회차의 목표(교사가 준비 화면에서 적은 문장). */
  goal: string | null;
  /** 보강으로 함께 다루는 회차 이름들. */
  supplementTitles: string[];
};

export async function loadSessionLessonContext(
  supabase: SupabaseClient,
  sessionId: string
): Promise<SessionLessonContext> {
  const { data: links } = await supabase
    .from("session_curriculum_units")
    .select("overlay_unit_id, role")
    .eq("session_id", sessionId);
  if (!links?.length) return { unitTitle: null, goal: null, supplementTitles: [] };

  const unitIds = links.map((l) => l.overlay_unit_id as string);
  const { data: units } = await supabase
    .from("curriculum_overlay_units")
    .select("id, unit_title")
    .in("id", unitIds);
  const titleById = new Map((units ?? []).map((u) => [u.id as string, u.unit_title as string]));

  const primaryId = links.find((l) => l.role === "primary")?.overlay_unit_id as string | undefined;

  let goal: string | null = null;
  if (primaryId) {
    const { data: prep } = await supabase
      .from("curriculum_unit_preps")
      .select("goal")
      .eq("overlay_unit_id", primaryId)
      .maybeSingle();
    goal = (prep?.goal as string | null) ?? null;
  }

  return {
    unitTitle: primaryId ? (titleById.get(primaryId) ?? null) : null,
    goal,
    supplementTitles: links
      .filter((l) => l.role !== "primary")
      .map((l) => titleById.get(l.overlay_unit_id as string))
      .filter((t): t is string => Boolean(t)),
  };
}
