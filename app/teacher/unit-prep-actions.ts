"use server";

import { toDocKind } from "@/lib/unit-composition";

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
  if (!keywordIds.length) return { materialSections: [], problems: [], keywordCount: 0 };

  const [{ data: sectionKeywordRows }, { data: problemKeywordRows }] = await Promise.all([
    supabase
      .from("curriculum_doc_section_keywords_selectable")
      .select("section_id, keyword_id")
      .in("keyword_id", keywordIds),
    // 2026-09-13 정정: 신규 선택 후보는 **공개된 버전이 있는 문제**로 좁힌다.
    // problem_keywords_selectable 은 problems.status='confirmed' 만 보므로, 검수
    // 중이거나 AI가 만든 초안 — 내용을 읽을 수조차 없는 문제 — 도 후보로 잡혔다.
    // 이미 고정된 문제를 **읽는** 경로는 그대로 둔다(보관됐다고 과거 수업에서
    // 사라지면 안 된다).
    supabase
      .from("problem_auto_composition_candidates")
      .select("problem_id, keyword_id")
      .in("keyword_id", keywordIds),
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
    keywordCount: keywordIds.length,
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

// P2/P3 6단계 — 커리큘럼 목록에서 "전체 회차와 준비 상태"를 한눈에 본다.
// 회차를 하나씩 열어보지 않고도 어디까지 준비했는지 알 수 있어야 한다.
export type UnitPrepSummary = {
  overlayUnitId: string;
  /** 이 회차의 준비된 문제 수(curriculum_unit_prep_items, content_type='problem'). */
  problemCount: number;
  /** 이 회차의 교재 수(curriculum_overlay_unit_materials, 문서 단위). */
  materialCount: number;
  /** 이미 시작·종료돼 내용이 고정된 수업이 있는지. */
  hasFrozenLesson: boolean;
  /** hasFrozenLesson이 true일 때 그 수업 id — "수업 준비"를 눌렀을 때 준비
   * 편집 화면 대신 실제 수업 화면(/session/[id])으로 보내는 데 쓴다
   * (2026-09-17 UAT 지적: 취소된 예약을 "고정된 수업"으로 잘못 셌던 버그도
   * 여기서 함께 고쳤다 — 취소는 실사용이 아니다). */
  frozenSessionId: string | null;
  /** 2026-09-18(제품 오너 지시) — "수업 1개 연결됨" 같은 개수 배지 대신, 가장
   * 가까운 예정(scheduled) 또는 진행 중(live) 수업의 실제 시작 시각. 없으면
   * null(화면은 "다음 예약 없음"으로 보여준다). */
  nearestSessionStartsAt: string | null;
};

export async function loadUnitPrepSummaries(
  overlayUnitIds: string[]
): Promise<Record<string, UnitPrepSummary>> {
  if (overlayUnitIds.length === 0) return {};
  const { supabase } = await requireTeacherOrAdmin();

  const [{ data: preps }, { data: materialRows }] = await Promise.all([
    supabase.from("curriculum_unit_preps").select("id, overlay_unit_id").in("overlay_unit_id", overlayUnitIds),
    supabase
      .from("curriculum_overlay_unit_materials")
      .select("overlay_unit_id")
      .in("overlay_unit_id", overlayUnitIds),
  ]);

  const materialCountByUnit = new Map<string, number>();
  for (const row of materialRows ?? []) {
    const key = row.overlay_unit_id as string;
    materialCountByUnit.set(key, (materialCountByUnit.get(key) ?? 0) + 1);
  }

  const prepIds = (preps ?? []).map((p) => p.id as string);
  const problemCountByPrep = new Map<string, number>();
  if (prepIds.length) {
    const { data: items } = await supabase
      .from("curriculum_unit_prep_items")
      .select("prep_id")
      .eq("content_type", "problem")
      .in("prep_id", prepIds);
    for (const item of items ?? []) {
      const key = item.prep_id as string;
      problemCountByPrep.set(key, (problemCountByPrep.get(key) ?? 0) + 1);
    }
  }

  const { data: links } = await supabase
    .from("session_curriculum_units")
    .select("overlay_unit_id, session_id")
    .eq("role", "primary")
    .in("overlay_unit_id", overlayUnitIds);
  const sessionIds = Array.from(new Set((links ?? []).map((l) => l.session_id as string)));
  // 2026-09-17(UAT 지적) — 취소된 예약(final_status가 취소 계열)은 실제로 아무
  // 수업도 일어나지 않았다. "scheduled만 아니면 고정"으로 셌던 예전 판정은
  // 취소된 예약까지 "진행한 수업 있음"으로 잘못 표시하고, 그 죽은 세션으로
  // 리다이렉트하는 버그로 이어졌다.
  const NOT_FROZEN = new Set(["scheduled", "student_cancelled", "teacher_cancelled", "company_cancelled"]);
  const sessionById = new Map<string, { finalStatus: string; startsAt: string | null }>();
  if (sessionIds.length) {
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, final_status, reservation:reservations(starts_at)")
      .in("id", sessionIds);
    for (const s of sessions ?? []) {
      const reservation = Array.isArray(s.reservation) ? s.reservation[0] : s.reservation;
      sessionById.set(s.id as string, {
        finalStatus: s.final_status as string,
        startsAt: (reservation as { starts_at?: string } | undefined)?.starts_at ?? null,
      });
    }
  }

  const summaries: Record<string, UnitPrepSummary> = {};
  for (const unitId of overlayUnitIds) {
    const prep = (preps ?? []).find((p) => p.overlay_unit_id === unitId);
    const unitLinks = (links ?? []).filter((l) => l.overlay_unit_id === unitId);
    const frozenLink = unitLinks.find((l) => {
      const s = sessionById.get(l.session_id as string);
      return s && !NOT_FROZEN.has(s.finalStatus);
    });
    // 2026-09-18 — "가장 가까운 연결 수업의 실제 일시": 아직 시작하지 않았거나(scheduled)
    // 지금 진행 중인(live) 세션의 예약 시각 중 가장 이른 것. 완료·취소·노쇼는 "다음"이
    // 아니므로 뺀다.
    const nearestStartsAt = unitLinks
      .map((l) => sessionById.get(l.session_id as string))
      .filter((s): s is { finalStatus: string; startsAt: string | null } => Boolean(s) && (s!.finalStatus === "scheduled" || s!.finalStatus === "live"))
      .map((s) => s.startsAt)
      .filter((v): v is string => Boolean(v))
      .sort()[0] ?? null;

    summaries[unitId] = {
      overlayUnitId: unitId,
      problemCount: prep ? (problemCountByPrep.get(prep.id as string) ?? 0) : 0,
      materialCount: materialCountByUnit.get(unitId) ?? 0,
      hasFrozenLesson: Boolean(frozenLink),
      frozenSessionId: frozenLink ? (frozenLink.session_id as string) : null,
      nearestSessionStartsAt: nearestStartsAt,
    };
  }
  return summaries;
}

/**
 * "문제 20개 업데이트" — 개별 선택 없이, 지금 이 회차의 키워드와 일치하는 공개
 * 문제 후보(problem_auto_composition_candidates, 확정+공개 버전만) 중 최대
 * 20개로 회차 준비의 문제 구성을 통째로 다시 만든다.
 *
 * 다시 눌러도 항상 "지금 키워드 기준 전체 재구성"이다 — 기존 문제를 남기고
 * 보충하는 방식이 아니다(2026-09-18 제품 오너 지시: "개별 선택 없이 문제 20개
 * 업데이트로만 구성"). 이미 세션에 고정된 사본(session_prepared_selection_*)은
 * 이 함수가 건드리는 curriculum_unit_prep_items와 완전히 분리된 테이블이라
 * 영향을 받지 않는다.
 */
export async function composeUnitPrepProblems(
  overlayUnitId: string
): Promise<{ ok: true; composedCount: number; availableCount: number } | { ok: false; error: string }> {
  const { supabase } = await requireTeacherOrAdmin();

  const { data: keywordRows } = await supabase
    .from("curriculum_overlay_unit_keywords")
    .select("keyword_id")
    .eq("overlay_unit_id", overlayUnitId);
  const keywordIds = Array.from(new Set((keywordRows ?? []).map((k) => k.keyword_id as string)));
  if (!keywordIds.length) {
    return { ok: false, error: "이 회차에 아직 키워드가 없습니다. 키워드를 먼저 선택하세요." };
  }

  const { data: prep } = await supabase
    .from("curriculum_unit_preps")
    .select("id")
    .eq("overlay_unit_id", overlayUnitId)
    .maybeSingle();
  if (!prep) return { ok: false, error: "이 회차의 준비를 찾을 수 없습니다." };

  const { data: candidateRows } = await supabase
    .from("problem_auto_composition_candidates")
    .select("problem_id, created_at")
    .in("keyword_id", keywordIds);

  const byProblem = new Map<string, string>();
  for (const row of candidateRows ?? []) {
    const id = row.problem_id as string;
    if (!byProblem.has(id)) byProblem.set(id, row.created_at as string);
  }
  const ordered = Array.from(byProblem.entries()).sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  const availableCount = ordered.length;
  const picked = ordered.slice(0, 20).map(([problemId]) => problemId);

  const { error: deleteError } = await supabase
    .from("curriculum_unit_prep_items")
    .delete()
    .eq("prep_id", prep.id)
    .eq("content_type", "problem");
  if (deleteError) return { ok: false, error: "기존 문제 구성을 정리하지 못했습니다." };

  if (picked.length > 0) {
    const { error: insertError } = await supabase.from("curriculum_unit_prep_items").insert(
      picked.map((problemId, index) => ({
        prep_id: prep.id,
        content_type: "problem" as const,
        content_id: problemId,
        position: index + 1,
      }))
    );
    if (insertError) return { ok: false, error: "문제 구성을 저장하지 못했습니다." };
  }

  return { ok: true, composedCount: picked.length, availableCount };
}

// =========================================================================
// P2/P3 2차 — 회차의 키워드와 교재 기본 구성
// =========================================================================
// 회차는 키워드 없이 초안으로 존재할 수 있다(2026-09-12 확정). 그래서 준비
// 화면은 "키워드가 없습니다"라고만 말하고 끝내면 안 되고, 그 자리에서 설정할 수
// 있어야 한다. 아래 셋이 그 진입점이다.

export type UnitKeyword = { id: string; label: string };
export type UnitMaterial = {
  curriculumDocId: string;
  title: string;
  position: number;
  /** auto = 회차 키워드에서 자동으로 들어온 것. manual = 선생님이 직접 담은 것. */
  source: "auto" | "manual";
};

/** 회차 구성에 담을 수 있는 교재 전체 목록의 한 줄. */
export type CatalogMaterial = {
  curriculumDocId: string;
  title: string;
  primaryKeywordLabel: string | null;
  kind: "html" | "pdf" | "video";
  /** 이미 이 회차 구성에 들어 있는가. */
  picked: boolean;
};

/** 이 회차의 준비된 문제 수만 가볍게 읽는다(수업 준비 화면 초기 로드용). */
export async function loadProblemCount(overlayUnitId: string): Promise<number> {
  const { supabase } = await requireTeacherOrAdmin();
  const { data: prep } = await supabase
    .from("curriculum_unit_preps")
    .select("id")
    .eq("overlay_unit_id", overlayUnitId)
    .maybeSingle();
  if (!prep) return 0;
  const { count } = await supabase
    .from("curriculum_unit_prep_items")
    .select("id", { count: "exact", head: true })
    .eq("prep_id", prep.id)
    .eq("content_type", "problem");
  return count ?? 0;
}

export type UnitComposition = {
  keywords: UnitKeyword[];
  materials: UnitMaterial[];
  /** 이 회차가 과목 템플릿 단원에서 갈라져 나왔는가 — 물려받을 기본이 있는지. */
  hasTemplateDefaults: boolean;
  /** 과목 전체 키워드 후보(선생님이 고를 수 있는 것). */
  subjectKeywords: UnitKeyword[];
};

export async function loadUnitComposition(overlayUnitId: string): Promise<UnitComposition> {
  const { supabase } = await requireTeacherOrAdmin();

  const { data: unit } = await supabase
    .from("curriculum_overlay_units")
    .select("source_unit_id, overlay:student_curriculum_overlays!inner(subject_enrollment_id)")
    .eq("id", overlayUnitId)
    .maybeSingle();

  const overlay = Array.isArray(unit?.overlay) ? unit?.overlay[0] : unit?.overlay;
  const enrollmentId = (overlay as { subject_enrollment_id?: string } | undefined)?.subject_enrollment_id;

  const { data: enrollment } = enrollmentId
    ? await supabase.from("subject_enrollments").select("subject_id").eq("id", enrollmentId).maybeSingle()
    : { data: null };
  const subjectId = enrollment?.subject_id as string | undefined;

  const [{ data: linkRows }, { data: materialRows }, { data: subjectKeywordRows }] = await Promise.all([
    supabase.from("curriculum_overlay_unit_keywords").select("keyword_id").eq("overlay_unit_id", overlayUnitId),
    supabase
      .from("curriculum_overlay_unit_materials")
      .select("curriculum_doc_id, position, source")
      .eq("overlay_unit_id", overlayUnitId)
      .order("position", { ascending: true }),
    subjectId
      ? supabase
          .from("subject_keywords")
          .select("id, label")
          .eq("subject_id", subjectId)
          .eq("status", "active")
          .order("label", { ascending: true })
      : Promise.resolve({ data: [] as { id: string; label: string }[] }),
  ]);

  const keywordIds = (linkRows ?? []).map((r) => r.keyword_id as string);
  const byId = new Map((subjectKeywordRows ?? []).map((k) => [k.id as string, k.label as string]));

  const docIds = (materialRows ?? []).map((m) => m.curriculum_doc_id as string);
  const { data: docs } = docIds.length
    ? await supabase.from("curriculum_docs").select("id, title").in("id", docIds)
    : { data: [] as { id: string; title: string }[] };
  const titleById = new Map((docs ?? []).map((d) => [d.id as string, d.title as string]));

  return {
    // 과목 키워드 목록에서 이름을 찾는다. 못 찾으면(비활성 등) 목록에서 빼지 않고
    // 붙어 있다는 사실을 그대로 보여준다 — 조용히 사라지면 왜 후보가 저런지 모른다.
    keywords: keywordIds.map((id) => ({ id, label: byId.get(id) ?? "(더 이상 쓰지 않는 키워드)" })),
    materials: (materialRows ?? []).map((m) => ({
      curriculumDocId: m.curriculum_doc_id as string,
      title: titleById.get(m.curriculum_doc_id as string) ?? "(제목 없음)",
      position: m.position as number,
      source: (m.source as "auto" | "manual") ?? "manual",
    })),
    hasTemplateDefaults: Boolean(unit?.source_unit_id),
    subjectKeywords: (subjectKeywordRows ?? []).map((k) => ({ id: k.id as string, label: k.label as string })),
  };
}

/** 회차에 키워드를 붙인다 — 준비 화면에서 바로 설정할 수 있게 하는 진입점. */
export async function addUnitKeyword(
  overlayUnitId: string,
  keywordId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase } = await requireTeacherOrAdmin();
  const { error } = await supabase
    .from("curriculum_overlay_unit_keywords")
    .insert({ overlay_unit_id: overlayUnitId, keyword_id: keywordId });
  // 이미 붙어 있는 것은 오류가 아니다 — 원하는 상태가 이미 맞다.
  if (error && error.code !== "23505") return { ok: false, error: "키워드를 붙이지 못했습니다." };
  return { ok: true };
}

export async function removeUnitKeyword(
  overlayUnitId: string,
  keywordId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase } = await requireTeacherOrAdmin();
  const { error } = await supabase
    .from("curriculum_overlay_unit_keywords")
    .delete()
    .eq("overlay_unit_id", overlayUnitId)
    .eq("keyword_id", keywordId);
  if (error) return { ok: false, error: "키워드를 떼지 못했습니다." };
  return { ok: true };
}

/**
 * 과목 템플릿의 기본 구성을 이 회차로 물려받는다.
 *
 * 선생님이 눌러야 돈다. 이미 고른 것은 덮어쓰지 않고 없는 것만 내려온다
 * (inherit_unit_defaults_from_template, 20261308000000).
 */
export async function inheritUnitDefaults(overlayUnitId: string): Promise<
  | { ok: true; keywordsAdded: number; materialsAdded: number; problemsAdded: number }
  | { ok: false; error: string }
> {
  const { supabase } = await requireTeacherOrAdmin();
  const { data, error } = await supabase
    .rpc("inherit_unit_defaults_from_template", { p_overlay_unit_id: overlayUnitId })
    .maybeSingle();
  if (error) return { ok: false, error: "기본 구성을 가져오지 못했습니다." };
  const row = data as {
    keywords_added?: number;
    materials_added?: number;
    problems_added?: number;
  } | null;
  return {
    ok: true,
    keywordsAdded: row?.keywords_added ?? 0,
    materialsAdded: row?.materials_added ?? 0,
    problemsAdded: row?.problems_added ?? 0,
  };
}

/** 회차 교재 구성의 순서를 바꾼다. 인접한 둘을 맞바꾼다. */
export async function moveUnitMaterial(
  overlayUnitId: string,
  curriculumDocId: string,
  direction: "up" | "down"
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase } = await requireTeacherOrAdmin();
  const { data: rows } = await supabase
    .from("curriculum_overlay_unit_materials")
    .select("curriculum_doc_id, position")
    .eq("overlay_unit_id", overlayUnitId)
    .order("position", { ascending: true });

  const list = rows ?? [];
  const index = list.findIndex((r) => r.curriculum_doc_id === curriculumDocId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= list.length) return { ok: true };

  const a = list[index];
  const b = list[target];
  // position에 고유 제약이 없으므로 잠깐 같은 값이 되어도 깨지지 않는다.
  const { error } = await supabase
    .from("curriculum_overlay_unit_materials")
    .update({ position: b.position })
    .eq("overlay_unit_id", overlayUnitId)
    .eq("curriculum_doc_id", a.curriculum_doc_id);
  if (error) return { ok: false, error: "순서를 바꾸지 못했습니다." };
  const { error: secondError } = await supabase
    .from("curriculum_overlay_unit_materials")
    .update({ position: a.position })
    .eq("overlay_unit_id", overlayUnitId)
    .eq("curriculum_doc_id", b.curriculum_doc_id);
  if (secondError) return { ok: false, error: "순서를 바꾸지 못했습니다." };
  return { ok: true };
}

/**
 * 회차 구성에서 교재를 뺀다.
 *
 * 뺐다는 사실을 남긴다 — 그러지 않으면 다음 자동 동기화가 방금 뺀 것을 그대로
 * 되돌려 놓는다. 선생님이 같은 교재를 다시 담으면 이 기록은 지워진다.
 */
export async function removeUnitMaterial(
  overlayUnitId: string,
  curriculumDocId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, user } = await requireTeacherOrAdmin();
  const { error: excludeError } = await supabase
    .from("curriculum_overlay_unit_material_exclusions")
    .insert({ overlay_unit_id: overlayUnitId, curriculum_doc_id: curriculumDocId, created_by: user.id });
  if (excludeError && excludeError.code !== "23505") {
    return { ok: false, error: "교재를 빼지 못했습니다." };
  }
  const { error } = await supabase
    .from("curriculum_overlay_unit_materials")
    .delete()
    .eq("overlay_unit_id", overlayUnitId)
    .eq("curriculum_doc_id", curriculumDocId);
  if (error) return { ok: false, error: "교재를 빼지 못했습니다." };
  return { ok: true };
}

/**
 * 회차 구성에 담을 수 있는 교재 목록 — 이 회차에 선택된 키워드를 대표 키워드로
 * 가진, 공개된 교재만(2026-09-18 제품 오너 지시: "목록은 선택된 키워드와 같은
 * 과목의 공개 교재만 보여준다"). 키워드가 하나도 없으면 담을 대상이 없으므로
 * 빈 목록을 준다 — 화면은 "키워드를 먼저 고르라"고 안내한다.
 */
export async function loadUnitMaterialCatalog(overlayUnitId: string): Promise<CatalogMaterial[]> {
  const { supabase } = await requireTeacherOrAdmin();

  const { data: unit } = await supabase
    .from("curriculum_overlay_units")
    .select("overlay:student_curriculum_overlays!inner(subject_enrollment_id)")
    .eq("id", overlayUnitId)
    .maybeSingle();
  const overlay = Array.isArray(unit?.overlay) ? unit?.overlay[0] : unit?.overlay;
  const enrollmentId = (overlay as { subject_enrollment_id?: string } | undefined)?.subject_enrollment_id;
  if (!enrollmentId) return [];

  const { data: enrollment } = await supabase
    .from("subject_enrollments")
    .select("subject_id")
    .eq("id", enrollmentId)
    .maybeSingle();
  if (!enrollment?.subject_id) return [];

  const { data: keywordRows } = await supabase
    .from("curriculum_overlay_unit_keywords")
    .select("keyword_id")
    .eq("overlay_unit_id", overlayUnitId);
  const keywordIds = Array.from(new Set((keywordRows ?? []).map((k) => k.keyword_id as string)));
  if (!keywordIds.length) return [];

  const [{ data: docs }, { data: picked }] = await Promise.all([
    supabase
      .from("curriculum_docs")
      .select("id, title, primary_keyword_id, kind")
      .eq("subject_id", enrollment.subject_id)
      .eq("status", "published")
      .is("archived_at", null)
      .in("primary_keyword_id", keywordIds)
      .order("title", { ascending: true }),
    supabase
      .from("curriculum_overlay_unit_materials")
      .select("curriculum_doc_id")
      .eq("overlay_unit_id", overlayUnitId),
  ]);

  const docKeywordIds = Array.from(
    new Set((docs ?? []).map((d) => d.primary_keyword_id as string | null).filter(Boolean) as string[])
  );
  const { data: keywords } = docKeywordIds.length
    ? await supabase.from("subject_keywords").select("id, label").in("id", docKeywordIds)
    : { data: [] as { id: string; label: string }[] };
  const labelById = new Map((keywords ?? []).map((k) => [k.id as string, k.label as string]));
  const pickedIds = new Set((picked ?? []).map((p) => p.curriculum_doc_id as string));

  return (docs ?? []).map((d) => ({
    curriculumDocId: d.id as string,
    title: d.title as string,
    primaryKeywordLabel: d.primary_keyword_id ? labelById.get(d.primary_keyword_id as string) ?? null : null,
    kind: toDocKind((d as { kind?: string | null }).kind),
    picked: pickedIds.has(d.id as string),
  }));
}

/** 교재 미리보기 — 구성에 담기 전에 무엇인지 확인한다. 섹션 제목만 준다. */
export async function previewUnitMaterial(
  curriculumDocId: string
): Promise<{ title: string; sectionTitles: string[] }> {
  const { supabase } = await requireTeacherOrAdmin();
  const [{ data: doc }, { data: sections }] = await Promise.all([
    supabase.from("curriculum_docs").select("title").eq("id", curriculumDocId).maybeSingle(),
    supabase
      .from("curriculum_doc_sections")
      .select("title, position")
      .eq("curriculum_doc_id", curriculumDocId)
      .order("position", { ascending: true }),
  ]);
  return {
    title: (doc?.title as string) ?? "(제목 없음)",
    sectionTitles: (sections ?? []).map((s) => s.title as string),
  };
}

/**
 * 선생님이 교재를 직접 담는다.
 *
 * 직접 담은 것은 manual이라 키워드를 떼도 사라지지 않는다. 전에 뺐던 교재라면
 * 그 기록을 지운다 — 다시 담았다는 건 마음이 바뀌었다는 뜻이다.
 *
 * 배포된 교재만 담을 수 있다. 키워드 조건을 벗어나 고르는 것과, 학생에게 갈 수
 * 없는 초안·보관 교재를 담는 것은 다른 이야기다. 목록도 배포된 것만 주지만,
 * 목록을 연 사이에 배포가 내려갈 수 있으므로 서버에서 다시 확인한다.
 */
export async function addUnitMaterial(
  overlayUnitId: string,
  curriculumDocId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, user } = await requireTeacherOrAdmin();

  const { data: doc } = await supabase
    .from("curriculum_docs")
    .select("status")
    .eq("id", curriculumDocId)
    .maybeSingle();
  if (!doc) return { ok: false, error: "존재하지 않는 교재입니다." };
  if (doc.status !== "published") {
    return { ok: false, error: "배포된 교재만 담을 수 있습니다." };
  }

  await supabase
    .from("curriculum_overlay_unit_material_exclusions")
    .delete()
    .eq("overlay_unit_id", overlayUnitId)
    .eq("curriculum_doc_id", curriculumDocId);

  const { error } = await supabase
    .from("curriculum_overlay_unit_materials")
    .insert({
      overlay_unit_id: overlayUnitId,
      curriculum_doc_id: curriculumDocId,
      source: "manual",
      created_by: user.id,
    });
  // 이미 담겨 있는 것은 오류가 아니다.
  if (error && error.code !== "23505") return { ok: false, error: "교재를 담지 못했습니다." };
  return { ok: true };
}

/** "교재 전체 담기" — 지금 목록(선택된 키워드의 공개 교재)에서 아직 안 담은 것을 한 번에 담는다. */
export async function addAllUnitMaterials(
  overlayUnitId: string
): Promise<{ ok: true; addedCount: number } | { ok: false; error: string }> {
  const catalog = await loadUnitMaterialCatalog(overlayUnitId);
  const toAdd = catalog.filter((c) => !c.picked);
  for (const c of toAdd) {
    const result = await addUnitMaterial(overlayUnitId, c.curriculumDocId);
    if (!result.ok) return result;
  }
  return { ok: true, addedCount: toAdd.length };
}
