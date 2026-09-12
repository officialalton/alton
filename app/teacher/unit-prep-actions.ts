"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase-admin";
import type { EligibleSelectionContent } from "./session-prep-data";

// P2/P3 3단계(제품 오너 피드백 1) — 예약이 없어도 회차를 준비한다.
// 지금까지 준비의 최소 단위는 "세션에 붙는 준비된 선택"이라, 예약이 있어야만
// 준비를 시작할 수 있었다. 준비의 원본을 회차(overlay unit)로 올린다.
//
// 인가는 기존 관례를 그대로 따른다: 앱 레벨 선검사로 읽기 쉬운 오류를 주고,
// 실제 방어선은 curriculum_unit_preps/_items의 RLS다(20261296000000).

export type UnitPrep = {
  goal: string;
  items: { id: string; contentType: "material_section" | "problem"; contentId: string; position: number }[];
  /** 이 회차가 이미 연결된 예정 수업(없으면 빈 배열). */
  linkedLessons: { sessionId: string; startsAt: string | null; frozen: boolean }[];
};

async function requireTeacherOrAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "teacher" && profile?.role !== "admin") {
    throw new Error("선생님·관리자만 회차를 준비할 수 있습니다.");
  }
  return { supabase, user };
}

/** 회차 준비를 읽는다(없으면 빈 준비를 만들어 돌려준다 — 화면이 항상 편집 가능해야 한다). */
export async function loadUnitPrep(overlayUnitId: string): Promise<UnitPrep> {
  const { supabase, user } = await requireTeacherOrAdmin();

  let { data: prep } = await supabase
    .from("curriculum_unit_preps")
    .select("id, goal")
    .eq("overlay_unit_id", overlayUnitId)
    .maybeSingle();

  if (!prep) {
    const { data: created, error } = await supabase
      .from("curriculum_unit_preps")
      .insert({ overlay_unit_id: overlayUnitId, created_by: user.id })
      .select("id, goal")
      .single();
    if (error) throw new Error(error.message);
    prep = created;
  }

  const { data: items } = await supabase
    .from("curriculum_unit_prep_items")
    .select("id, content_type, content_id, position")
    .eq("prep_id", prep.id)
    .order("position", { ascending: true });

  const { data: linked } = await supabase
    .from("session_curriculum_units")
    .select("session_id")
    .eq("overlay_unit_id", overlayUnitId);
  const sessionIds = (linked ?? []).map((r) => r.session_id as string);

  const lessons: UnitPrep["linkedLessons"] = [];
  if (sessionIds.length) {
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, final_status, reservation:reservations!sessions_reservation_id_fkey(starts_at)")
      .in("id", sessionIds);
    for (const s of sessions ?? []) {
      const reservation = Array.isArray(s.reservation) ? s.reservation[0] : s.reservation;
      lessons.push({
        sessionId: s.id as string,
        startsAt: (reservation as { starts_at?: string } | null)?.starts_at ?? null,
        frozen: s.final_status !== "scheduled",
      });
    }
  }

  return {
    goal: (prep.goal as string | null) ?? "",
    items: (items ?? []).map((i) => ({
      id: i.id as string,
      contentType: i.content_type as "material_section" | "problem",
      contentId: i.content_id as string,
      position: i.position as number,
    })),
    linkedLessons: lessons,
  };
}

export async function saveUnitGoal(overlayUnitId: string, goal: string): Promise<void> {
  const { supabase } = await requireTeacherOrAdmin();
  const { error } = await supabase
    .from("curriculum_unit_preps")
    .update({ goal, updated_at: new Date().toISOString() })
    .eq("overlay_unit_id", overlayUnitId);
  if (error) throw new Error(error.message);
}

export async function addUnitPrepItem(
  overlayUnitId: string,
  contentType: "material_section" | "problem",
  contentId: string
): Promise<void> {
  const { supabase } = await requireTeacherOrAdmin();
  const { data: prep } = await supabase
    .from("curriculum_unit_preps")
    .select("id")
    .eq("overlay_unit_id", overlayUnitId)
    .maybeSingle();
  if (!prep) throw new Error("이 회차의 준비를 찾을 수 없습니다.");

  const { data: last } = await supabase
    .from("curriculum_unit_prep_items")
    .select("position")
    .eq("prep_id", prep.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("curriculum_unit_prep_items").insert({
    prep_id: prep.id,
    content_type: contentType,
    content_id: contentId,
    position: ((last?.position as number | undefined) ?? 0) + 1,
  });
  // 같은 자료를 두 번 담아도 오류로 보여주지 않는다 — 이미 담긴 상태가 맞다.
  if (error && error.code !== "23505") throw new Error(error.message);
}

export async function removeUnitPrepItem(itemId: string): Promise<void> {
  const { supabase } = await requireTeacherOrAdmin();
  const { error } = await supabase.from("curriculum_unit_prep_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
}

/** 이 회차의 키워드로 찾은 공개 교재·확정 문제 후보. */
export async function loadUnitEligibleContent(overlayUnitId: string): Promise<EligibleSelectionContent> {
  const { supabase } = await requireTeacherOrAdmin();

  const { data: keywordRows } = await supabase
    .from("curriculum_overlay_unit_keywords")
    .select("keyword_id")
    .eq("overlay_unit_id", overlayUnitId);
  const keywordIds = Array.from(new Set((keywordRows ?? []).map((k) => k.keyword_id as string)));
  if (!keywordIds.length) return { materialSections: [], problems: [] };

  const [{ data: sectionKeywordRows }, { data: problemKeywordRows }] = await Promise.all([
    supabase
      .from("curriculum_doc_section_keywords_selectable")
      .select("section_id, keyword_id")
      .in("keyword_id", keywordIds),
    supabase.from("problem_keywords_selectable").select("problem_id, keyword_id").in("keyword_id", keywordIds),
  ]);

  const sectionIds = Array.from(new Set((sectionKeywordRows ?? []).map((r) => r.section_id as string)));
  const problemIds = Array.from(new Set((problemKeywordRows ?? []).map((r) => r.problem_id as string)));

  const [{ data: sectionDetails }, { data: problemDetails }] = await Promise.all([
    sectionIds.length
      ? supabase.from("curriculum_doc_sections").select("id, title, curriculum_doc_id").in("id", sectionIds)
      : Promise.resolve({ data: [] as { id: string; title: string; curriculum_doc_id: string }[] }),
    problemIds.length
      ? supabase.from("problems").select("id, passage").in("id", problemIds)
      : Promise.resolve({ data: [] as { id: string; passage: string | null }[] }),
  ]);

  const sectionById = new Map((sectionDetails ?? []).map((s) => [s.id as string, s]));
  const problemById = new Map((problemDetails ?? []).map((p) => [p.id as string, p]));

  return {
    materialSections: (sectionKeywordRows ?? [])
      .map((row) => {
        const detail = sectionById.get(row.section_id as string);
        if (!detail) return null;
        return {
          sectionId: row.section_id as string,
          keywordId: row.keyword_id as string,
          title: detail.title as string,
          curriculumDocId: detail.curriculum_doc_id as string,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null),
    problems: (problemKeywordRows ?? [])
      .map((row) => {
        const detail = problemById.get(row.problem_id as string);
        if (!detail) return null;
        return {
          problemId: row.problem_id as string,
          keywordId: row.keyword_id as string,
          passage: (detail.passage as string | null) ?? null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null),
  };
}

/** 예정된 수업 중 이 회차를 연결할 수 있는 것들. */
export async function listBookedLessonsForUnit(
  overlayUnitId: string
): Promise<{ sessionId: string; startsAt: string | null; alreadyLinked: boolean }[]> {
  const { supabase } = await requireTeacherOrAdmin();

  const { data: unit } = await supabase
    .from("curriculum_overlay_units")
    .select("overlay:student_curriculum_overlays(subject_enrollment_id)")
    .eq("id", overlayUnitId)
    .maybeSingle();
  const overlay = Array.isArray(unit?.overlay) ? unit?.overlay[0] : unit?.overlay;
  const enrollmentId = (overlay as { subject_enrollment_id?: string } | null)?.subject_enrollment_id;
  if (!enrollmentId) return [];

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, final_status, reservation:reservations!sessions_reservation_id_fkey(starts_at, status)")
    .eq("subject_enrollment_id", enrollmentId)
    .eq("final_status", "scheduled");

  const { data: linked } = await supabase
    .from("session_curriculum_units")
    .select("session_id")
    .eq("overlay_unit_id", overlayUnitId);
  const linkedIds = new Set((linked ?? []).map((r) => r.session_id as string));

  return (sessions ?? [])
    .map((s) => {
      const reservation = Array.isArray(s.reservation) ? s.reservation[0] : s.reservation;
      const r = reservation as { starts_at?: string; status?: string } | null;
      if (r?.status !== "confirmed") return null;
      return {
        sessionId: s.id as string,
        startsAt: r?.starts_at ?? null,
        alreadyLinked: linkedIds.has(s.id as string),
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""));
}

/**
 * 회차 준비를 실제 수업에 연결한다. 고정하지 않는다 — 고정은 수업 시작
 * 시점에만 일어난다(20261296000000 freeze_session_content_at_start).
 */
export async function linkUnitPrepToLesson(
  overlayUnitId: string,
  sessionId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user } = await requireTeacherOrAdmin();
  const admin = createAdminClient();
  const { error } = await admin.rpc("link_unit_prep_to_session", {
    p_overlay_unit_id: overlayUnitId,
    p_session_id: sessionId,
    p_actor_id: user.id,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
