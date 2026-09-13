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
