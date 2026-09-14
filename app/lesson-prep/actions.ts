"use server";

import { createClient } from "@/utils/supabase/server";
import { LAYERS, type PrepLayer } from "@/lib/unit-composition";

// 수업 준비 화면의 구성 편집 — 세 계층 공용.
//
// 층마다 다른 것은 테이블 이름과 앱 레벨 선인가뿐이고, 규칙은 같다. 실제 방어선은
// 언제나 RLS다:
//   catalog  기준본은 관리자만 쓴다 (subject_template_unit_keywords "관리자만 쓰기")
//   teacher  본인 템플릿만 (teacher_curriculum_template_unit_keywords "본인 선생님/관리자")
//   student  담당 선생님·관리자만 (curriculum_overlay_unit_keywords)
//
// 확정 정책대로 예외를 던지지 않고 { ok, error }로 돌려준다 — 던진 예외는
// Production에서 Minified React error로 마스킹돼 사유가 사라진다.

export type PrepResult = { ok: true } | { ok: false; error: string };

/**
 * 층에 맞는 앱 레벨 선인가. 읽기 쉬운 사유를 주기 위한 것이고, 권한 자체는
 * RLS가 막는다 — 여기를 통과해도 쓰기는 정책에서 다시 걸린다.
 */
async function gate(layer: PrepLayer) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase: null, error: "로그인이 필요합니다." } as const;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = profile?.role as string | undefined;

  if (layer === "catalog" && role !== "admin") {
    return { supabase: null, error: "관리자만 기준본을 고칠 수 있습니다." } as const;
  }
  if (layer !== "catalog" && role !== "teacher" && role !== "admin") {
    return { supabase: null, error: "선생님·관리자만 수업을 준비할 수 있습니다." } as const;
  }
  return { supabase, error: null } as const;
}

export async function addKeyword(
  layer: PrepLayer,
  unitId: string,
  keywordId: string
): Promise<PrepResult> {
  const { supabase, error: denied } = await gate(layer);
  if (!supabase) return { ok: false, error: denied };

  const spec = LAYERS[layer];
  const { error } = await supabase
    .from(spec.keywordTable)
    .insert({ [spec.unitFk]: unitId, keyword_id: keywordId });
  // 23505(이미 붙어 있음)는 오류가 아니다 — 원하는 상태가 이미 맞다.
  if (error && error.code !== "23505") {
    console.error(JSON.stringify({ event: "prep_keyword_add_failed", layer, message: error.message }));
    return { ok: false, error: "키워드를 붙이지 못했습니다." };
  }
  return { ok: true };
}

export async function removeKeyword(
  layer: PrepLayer,
  unitId: string,
  keywordId: string
): Promise<PrepResult> {
  const { supabase, error: denied } = await gate(layer);
  if (!supabase) return { ok: false, error: denied };

  const spec = LAYERS[layer];
  const { error } = await supabase
    .from(spec.keywordTable)
    .delete()
    .eq(spec.unitFk, unitId)
    .eq("keyword_id", keywordId);
  if (error) {
    console.error(JSON.stringify({ event: "prep_keyword_remove_failed", layer, message: error.message }));
    return { ok: false, error: "키워드를 떼지 못했습니다." };
  }
  return { ok: true };
}

/**
 * 구성에서 교재를 뺀다.
 *
 * 자동으로 들어온 교재(source='auto')를 빼면 제외 기록을 남긴다. 그러지 않으면
 * 다음 동기화가 방금 뺀 것을 다시 넣는다 — 사람이 뺀 것을 자동이 되살리면 안 된다.
 */
export async function removeMaterial(
  layer: PrepLayer,
  unitId: string,
  curriculumDocId: string
): Promise<PrepResult> {
  const { supabase, error: denied } = await gate(layer);
  if (!supabase) return { ok: false, error: denied };

  const spec = LAYERS[layer];
  const { data: row } = await supabase
    .from(spec.materialTable)
    .select("source")
    .eq(spec.unitFk, unitId)
    .eq("curriculum_doc_id", curriculumDocId)
    .maybeSingle();

  const { error } = await supabase
    .from(spec.materialTable)
    .delete()
    .eq(spec.unitFk, unitId)
    .eq("curriculum_doc_id", curriculumDocId);
  if (error) {
    console.error(JSON.stringify({ event: "prep_material_remove_failed", layer, message: error.message }));
    return { ok: false, error: "교재를 빼지 못했습니다." };
  }

  if ((row?.source as string) === "auto") {
    const { error: exclusionError } = await supabase
      .from(spec.exclusionTable)
      .insert({ [spec.unitFk]: unitId, curriculum_doc_id: curriculumDocId });
    if (exclusionError && exclusionError.code !== "23505") {
      // 뺀 것 자체는 성공했다. 다만 다음 동기화가 되살릴 수 있다는 것을 알린다 —
      // 조용히 넘어가면 "왜 다시 생겼는지" 알 수 없다.
      console.error(
        JSON.stringify({ event: "prep_exclusion_failed", layer, message: exclusionError.message })
      );
      return { ok: false, error: "교재를 뺐지만 다시 들어올 수 있습니다. 한 번 더 확인해 주세요." };
    }
  }
  return { ok: true };
}

/**
 * 구성에 교재를 직접 담는다 — source='manual'이라 키워드를 떼도 사라지지 않는다.
 * 같은 교재를 다시 담으면 제외 기록은 지운다(사람의 최신 의사가 우선이다).
 */
export async function addMaterial(
  layer: PrepLayer,
  unitId: string,
  curriculumDocId: string
): Promise<PrepResult> {
  const { supabase, error: denied } = await gate(layer);
  if (!supabase) return { ok: false, error: denied };

  const spec = LAYERS[layer];
  await supabase
    .from(spec.exclusionTable)
    .delete()
    .eq(spec.unitFk, unitId)
    .eq("curriculum_doc_id", curriculumDocId);

  const { error } = await supabase
    .from(spec.materialTable)
    .insert({ [spec.unitFk]: unitId, curriculum_doc_id: curriculumDocId, source: "manual" });
  if (error && error.code !== "23505") {
    console.error(JSON.stringify({ event: "prep_material_add_failed", layer, message: error.message }));
    return { ok: false, error: "교재를 담지 못했습니다." };
  }
  return { ok: true };
}

/** 인접한 두 교재의 순서를 맞바꾼다. */
export async function swapMaterialOrder(
  layer: PrepLayer,
  unitId: string,
  docIdA: string,
  docIdB: string
): Promise<PrepResult> {
  const { supabase, error: denied } = await gate(layer);
  if (!supabase) return { ok: false, error: denied };

  const spec = LAYERS[layer];
  const { data: rows } = await supabase
    .from(spec.materialTable)
    .select("curriculum_doc_id, position")
    .eq(spec.unitFk, unitId)
    .in("curriculum_doc_id", [docIdA, docIdB]);
  if (!rows || rows.length !== 2) return { ok: false, error: "순서를 바꾸지 못했습니다." };

  const a = rows.find((r) => r.curriculum_doc_id === docIdA);
  const b = rows.find((r) => r.curriculum_doc_id === docIdB);
  if (!a || !b) return { ok: false, error: "순서를 바꾸지 못했습니다." };

  // position에 unique 제약은 없지만, 중간값을 거쳐 바꿔 두 행이 같은 값을 갖는
  // 순간을 만들지 않는다 — 그 사이에 목록을 읽으면 순서가 뒤집혀 보인다.
  const TEMP = -1000000;
  await supabase
    .from(spec.materialTable)
    .update({ position: TEMP })
    .eq(spec.unitFk, unitId)
    .eq("curriculum_doc_id", docIdA);
  await supabase
    .from(spec.materialTable)
    .update({ position: a.position })
    .eq(spec.unitFk, unitId)
    .eq("curriculum_doc_id", docIdB);
  const { error } = await supabase
    .from(spec.materialTable)
    .update({ position: b.position })
    .eq(spec.unitFk, unitId)
    .eq("curriculum_doc_id", docIdA);
  if (error) {
    console.error(JSON.stringify({ event: "prep_material_move_failed", layer, message: error.message }));
    return { ok: false, error: "순서를 바꾸지 못했습니다." };
  }
  return { ok: true };
}

/**
 * 회차 목표를 저장한다.
 *
 * 빈 문자열과 null 을 구분해 넘긴다 — 사람이 일부러 비운 것(`""`)과 아직 아무도
 * 정하지 않은 것(`null`)은 다르다. 앞엣것은 상속으로 되살아나면 안 된다.
 *
 * 학생 층의 목표는 회차 준비(curriculum_unit_preps)에 있다. 준비 행이 없으면
 * 만든다 — 준비 화면이 어차피 만들던 행이라 새 상태를 더하지 않는다.
 */
export async function saveGoal(
  layer: PrepLayer,
  unitId: string,
  goal: string
): Promise<PrepResult> {
  const { supabase, error: denied } = await gate(layer);
  if (!supabase) return { ok: false, error: denied };

  // 화면에서 지운 것은 "일부러 비움"이다. null 로 되돌리지 않는다.
  const value = goal;

  if (layer === "student") {
    const { error } = await supabase
      .from("curriculum_unit_preps")
      .upsert({ overlay_unit_id: unitId, goal: value }, { onConflict: "overlay_unit_id" });
    if (error) {
      console.error(JSON.stringify({ event: "prep_goal_save_failed", layer, message: error.message }));
      return { ok: false, error: "목표를 저장하지 못했습니다." };
    }
    return { ok: true };
  }

  const { error } = await supabase
    .from(LAYERS[layer].unitTable)
    .update({ goal: value })
    .eq("id", unitId);
  if (error) {
    console.error(JSON.stringify({ event: "prep_goal_save_failed", layer, message: error.message }));
    return { ok: false, error: "목표를 저장하지 못했습니다." };
  }
  return { ok: true };
}

// =========================================================================
// 다시 구성 — 사람이 눌렀을 때만
// =========================================================================
// 2026-09-13 확정(A안): 키워드·조건이 바뀌어도 자동으로 재계산하지 않는다. 화면이
// "구성에 반영되지 않은 변경 있음"을 띄우고, 여기서 무엇이 달라지는지 먼저 보여준 뒤
// 사람이 적용을 누른다. 취소하면 기존 구성이 그대로 남는다.

export type RecompositionSummary = {
  materialsAdded: number;
  materialsRemoved: number;
  problemsAdded: number;
  problemsRemoved: number;
  /** 조건에 맞는 문제가 몇 개 있는가. 모자라도 채우지 않는다 — 숫자로만 알린다. */
  problemsAvailable: number;
  /** 담을 때의 버전에서 지금 공개본으로 올라갈 항목 수. */
  versionsUpdated: number;
  /**
   * 미리 본 시점의 입력 지문. 적용할 때 그대로 들고 간다 — 그 사이에 무언가
   * 바뀌었으면 서버가 적용을 거절한다(다른 결과를 조용히 넣지 않는다).
   */
  fingerprint: string | null;
};

function asSummary(value: unknown): RecompositionSummary {
  const v = (value ?? {}) as Record<string, unknown>;
  const n = (k: string) => Number(v[k] ?? 0);
  return {
    materialsAdded: n("materialsAdded"),
    materialsRemoved: n("materialsRemoved"),
    problemsAdded: n("problemsAdded"),
    problemsRemoved: n("problemsRemoved"),
    problemsAvailable: n("problemsAvailable"),
    versionsUpdated: n("versionsUpdated"),
    fingerprint: typeof v.fingerprint === "string" ? v.fingerprint : null,
  };
}

/** 다시 구성하면 무엇이 달라지는지. 아무것도 바꾸지 않는다. */
export async function previewRecomposition(
  layer: PrepLayer,
  unitId: string
): Promise<{ ok: true; value: RecompositionSummary } | { ok: false; error: string }> {
  const { supabase, error: denied } = await gate(layer);
  if (!supabase) return { ok: false, error: denied };

  const { data, error } = await supabase.rpc("preview_unit_recomposition", {
    p_layer: layer,
    p_unit_id: unitId,
  });
  if (error) {
    console.error(JSON.stringify({ event: "prep_recompose_preview_failed", layer, message: error.message }));
    return { ok: false, error: "변경 내용을 확인하지 못했습니다." };
  }
  return { ok: true, value: asSummary(data) };
}

/** 실제로 적용한다. 수동 선택·제외·순서는 그대로 남는다. */
export async function applyRecomposition(
  layer: PrepLayer,
  unitId: string,
  /** 미리 본 시점의 지문. 그 사이에 바뀌었으면 서버가 거절한다. */
  expectedFingerprint: string | null
): Promise<
  | { ok: true; value: RecompositionSummary }
  | { ok: false; error: string; stale?: true }
> {
  const { supabase, error: denied } = await gate(layer);
  if (!supabase) return { ok: false, error: denied };

  const { data, error } = await supabase.rpc("recompose_unit", {
    p_layer: layer,
    p_unit_id: unitId,
    p_expected_fingerprint: expectedFingerprint,
  });
  if (error) {
    console.error(JSON.stringify({ event: "prep_recompose_failed", layer, message: error.message }));
    // ALT02 = 미리 본 뒤에 입력이 바뀌었다. 사용자가 다시 확인해야 하므로 일반
    // 실패와 구분해 알린다.
    if (error.code === "ALT02") {
      return {
        ok: false,
        stale: true,
        error: "미리 본 뒤에 구성이나 교재·문제가 바뀌었습니다. 변경분을 다시 확인해주세요.",
      };
    }
    return { ok: false, error: "다시 구성하지 못했습니다." };
  }
  return { ok: true, value: asSummary(data) };
}

// =========================================================================
// 위 계층 구성 물려받기
// =========================================================================
// 2026-09-13 제품 오너: "초기 셋업 후 교사가 학생마다 교재·문제를 다시 담아야 하는
// 상태는 최종 요구를 충족하지 못합니다."
//
// 회차가 **새로 만들어질 때는** 상속이 자동으로 끝난다(20261340000000). 그 전에
// 만들어진 회차는 트리거가 돌지 않았으므로 여기서 부른다. 소급해서 자동으로 채우지
// 않는 이유는, 선생님이 일부러 비워 둔 것과 구분할 수 없기 때문이다.

export type InheritSummary = {
  keywordsAdded: number;
  materialsAdded: number;
  problemsAdded: number;
};

export async function inheritDefaults(
  layer: PrepLayer,
  unitId: string
): Promise<{ ok: true; value: InheritSummary } | { ok: false; error: string }> {
  const { supabase, error: denied } = await gate(layer);
  if (!supabase) return { ok: false, error: denied };

  if (layer === "catalog") {
    // 기준본이 곧 기준이다 — 위에서 물려받을 것이 없다.
    return { ok: false, error: "관리자 기준본은 물려받을 상위 구성이 없습니다." };
  }

  const fn =
    layer === "teacher"
      ? "inherit_teacher_unit_defaults_from_template"
      : "inherit_unit_defaults_from_template";
  const arg =
    layer === "teacher" ? { p_unit_id: unitId } : { p_overlay_unit_id: unitId };

  const { data, error } = await supabase.rpc(fn, arg).maybeSingle();
  if (error) {
    console.error(
      JSON.stringify({ event: "prep_inherit_failed", layer, message: error.message })
    );
    return { ok: false, error: "상위 구성을 가져오지 못했습니다." };
  }
  const row = (data ?? {}) as Record<string, number | undefined>;
  return {
    ok: true,
    value: {
      keywordsAdded: Number(row.keywords_added ?? 0),
      materialsAdded: Number(row.materials_added ?? 0),
      problemsAdded: Number(row.problems_added ?? 0),
    },
  };
}

// =========================================================================
// 문제 담기 · 빼기 · 순서
// =========================================================================
// 2026-09-13 지시 3번: "별도 '회차 준비' 화면에서만 가능한 필수 작업을 남기지
// 않습니다." 예전에는 문제를 담는 일이 교사 전용 '회차 준비' 화면에만 있었다.
//
// 층마다 담기는 자리가 다르다 — 학생 층은 준비안(curriculum_unit_prep_items),
// 위 두 층은 각자의 구성 표다. 화면은 그 차이를 모르게 한다.

/** 학생 층의 준비안 id. 없으면 만든다 — 화면이 항상 담을 수 있어야 한다. */
async function prepIdFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  overlayUnitId: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("curriculum_unit_preps")
    .select("id")
    .eq("overlay_unit_id", overlayUnitId)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data: created } = await supabase
    .from("curriculum_unit_preps")
    .insert({ overlay_unit_id: overlayUnitId })
    .select("id")
    .maybeSingle();
  return (created?.id as string | undefined) ?? null;
}

export async function addProblem(
  layer: PrepLayer,
  unitId: string,
  problemId: string
): Promise<PrepResult> {
  const { supabase, error: denied } = await gate(layer);
  if (!supabase) return { ok: false, error: denied };

  if (layer === "student") {
    const prepId = await prepIdFor(supabase, unitId);
    if (!prepId) return { ok: false, error: "이 회차의 준비를 만들지 못했습니다." };

    const { data: last } = await supabase
      .from("curriculum_unit_prep_items")
      .select("position")
      .eq("prep_id", prepId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await supabase.from("curriculum_unit_prep_items").insert({
      prep_id: prepId,
      content_type: "problem",
      content_id: problemId,
      position: ((last?.position as number | undefined) ?? 0) + 1,
    });
    if (error && error.code !== "23505") {
      console.error(JSON.stringify({ event: "prep_problem_add_failed", layer, message: error.message }));
      return { ok: false, error: readableWriteError(error.message, "문제를 담지 못했습니다.") };
    }
    return { ok: true };
  }

  const table =
    layer === "catalog"
      ? "subject_template_unit_problems"
      : "teacher_curriculum_template_unit_problems";

  const { data: last } = await supabase
    .from(table)
    .select("position")
    .eq("unit_id", unitId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from(table).insert({
    unit_id: unitId,
    problem_id: problemId,
    position: ((last?.position as number | undefined) ?? 0) + 1,
    source: "manual",
  });
  if (error && error.code !== "23505") {
    console.error(JSON.stringify({ event: "prep_problem_add_failed", layer, message: error.message }));
    return { ok: false, error: readableWriteError(error.message, "문제를 담지 못했습니다.") };
  }
  return { ok: true };
}

export async function removeProblem(
  layer: PrepLayer,
  unitId: string,
  problemId: string
): Promise<PrepResult> {
  const { supabase, error: denied } = await gate(layer);
  if (!supabase) return { ok: false, error: denied };

  if (layer === "student") {
    const prepId = await prepIdFor(supabase, unitId);
    if (!prepId) return { ok: true };
    const { error } = await supabase
      .from("curriculum_unit_prep_items")
      .delete()
      .eq("prep_id", prepId)
      .eq("content_type", "problem")
      .eq("content_id", problemId);
    if (error) return { ok: false, error: "문제를 빼지 못했습니다." };
    return { ok: true };
  }

  const table =
    layer === "catalog"
      ? "subject_template_unit_problems"
      : "teacher_curriculum_template_unit_problems";
  const exclusionTable =
    layer === "catalog"
      ? "subject_template_unit_problem_exclusions"
      : "teacher_curriculum_template_unit_problem_exclusions";

  const { error } = await supabase
    .from(table)
    .delete()
    .eq("unit_id", unitId)
    .eq("problem_id", problemId);
  if (error) return { ok: false, error: "문제를 빼지 못했습니다." };

  // 뺀 기록을 남긴다 — 없으면 다음 '다시 구성'에서 자동으로 되살아난다.
  await supabase.from(exclusionTable).insert({ unit_id: unitId, problem_id: problemId });
  return { ok: true };
}

/** 쓰기 가드가 올려주는 한국어 사유는 그대로 보여준다 — 사람이 조치할 수 있는 사실이다. */
function readableWriteError(message: string, fallback: string): string {
  return /[가-힣]/.test(message) ? message.replace(/^.*?:\s*/, "") : fallback;
}

// =========================================================================
// 수업 연결과 수업 시작
// =========================================================================
// 2026-09-13 확정 1번: "수업 준비에 들어간 뒤 다시 '수업 열기'를 눌러 다른 화면으로
// 이동하는 구조는 없앱니다. '수업 시작'만 별도 행동입니다."
//
// 그래서 연결과 시작을 이 화면에서 한다. 연결은 아무것도 고정하지 않고, 시작이
// 그 시점의 준비안을 고정한다(mark_lesson_session_started → pin_session_selection).

export type PrepLesson = {
  sessionId: string;
  startsAt: string | null;
  linked: boolean;
};

export async function listLessonsForUnit(
  layer: PrepLayer,
  unitId: string
): Promise<PrepLesson[]> {
  if (layer !== "student") return [];
  const { supabase } = await gate(layer);
  if (!supabase) return [];

  const { listBookedLessonsForUnit } = await import("@/app/teacher/unit-prep-actions");
  const rows = await listBookedLessonsForUnit(unitId);
  return rows.map((r) => ({
    sessionId: r.sessionId,
    startsAt: r.startsAt,
    linked: r.alreadyLinked,
  }));
}

export async function linkLesson(unitId: string, sessionId: string): Promise<PrepResult> {
  const { supabase } = await gate("student");
  if (!supabase) return { ok: false, error: "선생님·관리자만 수업을 준비할 수 있습니다." };

  const { linkUnitPrepToLesson } = await import("@/app/teacher/unit-prep-actions");
  const result = await linkUnitPrepToLesson(unitId, sessionId);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

/**
 * 수업을 시작한다 — **여기서만** 준비안이 고정된다.
 *
 * 화면 진입·저장·예약 연결은 아무것도 고정하지 않는다. 쓸 수 없는 항목이 있으면
 * 서버가 사유를 붙여 거절하고, 매니페스트는 한 줄도 쓰이지 않는다.
 */
export async function startLesson(sessionId: string): Promise<PrepResult> {
  const { supabase } = await gate("student");
  if (!supabase) return { ok: false, error: "선생님·관리자만 수업을 시작할 수 있습니다." };

  const { startMyLessonSession } = await import("@/app/teacher/lesson-schedule-actions");
  const result = await startMyLessonSession(sessionId);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}
