"use server";

import { requireUser } from "@/lib/auth";
import type { TemplateUnit } from "./mysubjects-data";

export async function createMyTemplate(subjectId: string): Promise<{
  templateId: string;
  units: TemplateUnit[];
}> {
  const { supabase, user } = await requireUser();

  const { data: template, error } = await supabase
    .from("teacher_curriculum_templates")
    .insert({ teacher_id: user.id, subject_id: subjectId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { data: catalogUnits } = await supabase
    .from("subject_template_units")
    .select("id, position, unit_title, note")
    .eq("subject_id", subjectId)
    .order("position", { ascending: true });

  if (!catalogUnits || catalogUnits.length === 0) {
    return { templateId: template.id, units: [] };
  }

  // source_unit_id 를 채워야 관리자 기준본의 회차 키워드·기본 교재가 초기 상속된다
  // (teacher_curriculum_template_units_inherit 트리거, 20261317000000). 이게 없으면
  // 선생님이 배정받은 과목마다 키워드를 처음부터 다시 지정해야 한다.
  const { data: inserted, error: insertError } = await supabase
    .from("teacher_curriculum_template_units")
    .insert(
      catalogUnits.map((u) => ({
        template_id: template.id,
        source_unit_id: u.id,
        position: u.position,
        unit_title: u.unit_title,
        note: u.note,
      }))
    )
    .select("id, position, unit_title, note, teacher_comment, source_unit_id")
    .order("position", { ascending: true });
  if (insertError) throw new Error(insertError.message);

  // 키워드는 위 INSERT에 붙은 트리거가 관리자 기준본에서 내려준다. 삽입 응답에는
  // 담기지 않으므로 한 번 더 읽는다 — 만들자마자 화면에 보여야 "다시 지정해야
  // 하는 흐름"이 사라졌다는 것이 드러난다.
  const unitIds = (inserted ?? []).map((u) => u.id);
  const { data: keywordRows } = unitIds.length
    ? await supabase
        .from("teacher_curriculum_template_unit_keywords")
        .select("unit_id, keyword_id")
        .in("unit_id", unitIds)
    : { data: [] as { unit_id: string; keyword_id: string }[] };
  const keywordIdsByUnit = new Map<string, string[]>();
  for (const row of keywordRows ?? []) {
    const list = keywordIdsByUnit.get(row.unit_id) ?? [];
    list.push(row.keyword_id);
    keywordIdsByUnit.set(row.unit_id, list);
  }

  return {
    templateId: template.id,
    units: (inserted ?? []).map((u) => ({
      id: u.id,
      position: u.position,
      unitTitle: u.unit_title,
      note: u.note,
      teacherComment: u.teacher_comment,
      keywordIds: keywordIdsByUnit.get(u.id) ?? [],
      linkedToCatalog: Boolean(u.source_unit_id),
    })),
  };
}

export async function addTemplateUnit(
  templateId: string,
  nextPosition: number
): Promise<TemplateUnit> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("teacher_curriculum_template_units")
    .insert({
      template_id: templateId,
      position: nextPosition,
      unit_title: "새 회차",
    })
    .select("id, position, unit_title, note, teacher_comment, source_unit_id")
    .single();
  if (error) throw new Error(error.message);

  // 선생님이 직접 추가한 보충 회차다 — 관리자 기준본과 이어져 있지 않으므로
  // 물려받을 기본이 없다. 키워드는 여기서 직접 붙인다.
  return {
    id: data.id,
    position: data.position,
    unitTitle: data.unit_title,
    note: data.note,
    teacherComment: data.teacher_comment,
    keywordIds: [],
    linkedToCatalog: Boolean(data.source_unit_id),
  };
}

export type KeywordActionResult = { ok: true } | { ok: false; error: string };

/**
 * 회차에 키워드를 붙인다. 키워드가 붙으면 그 키워드의 기본 교재가 자동 구성으로
 * 따라 들어온다(sync_teacher_unit_auto_materials 트리거).
 *
 * 확정 정책대로 예외를 던지지 않는다 — 던진 예외는 Production에서 Minified React
 * error로 마스킹돼 사유가 사라진다.
 */
export async function addTemplateUnitKeyword(
  unitId: string,
  keywordId: string
): Promise<KeywordActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("teacher_curriculum_template_unit_keywords")
    .insert({ unit_id: unitId, keyword_id: keywordId });
  // 23505(이미 붙어 있음)는 멱등 처리 — 에러가 아니다.
  if (error && error.code !== "23505") {
    console.error(
      JSON.stringify({ event: "teacher_unit_keyword_add_failed", message: error.message })
    );
    return { ok: false, error: "키워드를 붙이지 못했습니다." };
  }
  return { ok: true };
}

export async function removeTemplateUnitKeyword(
  unitId: string,
  keywordId: string
): Promise<KeywordActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("teacher_curriculum_template_unit_keywords")
    .delete()
    .eq("unit_id", unitId)
    .eq("keyword_id", keywordId);
  if (error) {
    console.error(
      JSON.stringify({ event: "teacher_unit_keyword_remove_failed", message: error.message })
    );
    return { ok: false, error: "키워드를 떼지 못했습니다." };
  }
  return { ok: true };
}

/**
 * 이미 있는 회차에 관리자 기준본의 기본 키워드·교재를 물려받는다 — **보정**이다.
 *
 * 자동으로 돌지 않는다. 상속 누락(연결은 있는데 비어 있음)과 선생님이 일부러 뺀
 * 것을 코드가 구분할 수 없기 때문이다. 없는 것만 넣고 아무것도 지우지 않는다.
 */
export async function inheritUnitDefaults(
  unitId: string
): Promise<
  { ok: true; keywordsAdded: number; keywordIds: string[] } | { ok: false; error: string }
> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("inherit_teacher_unit_defaults_from_template", {
    p_unit_id: unitId,
  });
  if (error) {
    console.error(
      JSON.stringify({ event: "teacher_unit_inherit_failed", message: error.message })
    );
    return { ok: false, error: "기준본에서 가져오지 못했습니다." };
  }
  const row = Array.isArray(data) ? data[0] : data;

  // 화면은 추측이 아니라 **실제로 남은 상태**를 그려야 한다. 어떤 키워드가 들어왔는지
  // 클라이언트가 계산하면 선생님이 일부러 빼 둔 것을 되살린 것처럼 보일 수 있다.
  const { data: rows } = await supabase
    .from("teacher_curriculum_template_unit_keywords")
    .select("keyword_id")
    .eq("unit_id", unitId);

  return {
    ok: true,
    keywordsAdded: (row as { keywords_added?: number } | null)?.keywords_added ?? 0,
    keywordIds: (rows ?? []).map((r) => r.keyword_id as string),
  };
}

export async function updateTemplateUnit(
  unitId: string,
  fields: { unitTitle?: string; note?: string; teacherComment?: string }
): Promise<void> {
  const { supabase } = await requireUser();
  const patch: Record<string, string | null> = {};
  if (fields.unitTitle !== undefined) patch.unit_title = fields.unitTitle;
  if (fields.note !== undefined) patch.note = fields.note || null;
  if (fields.teacherComment !== undefined)
    patch.teacher_comment = fields.teacherComment || null;

  const { error } = await supabase
    .from("teacher_curriculum_template_units")
    .update(patch)
    .eq("id", unitId);
  if (error) throw new Error(error.message);
}

export async function removeTemplateUnit(unitId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("teacher_curriculum_template_units")
    .delete()
    .eq("id", unitId);
  if (error) throw new Error(error.message);
}

export async function moveTemplateUnit(
  unitId: string,
  otherUnitId: string
): Promise<void> {
  const { supabase } = await requireUser();
  const { data: rows, error } = await supabase
    .from("teacher_curriculum_template_units")
    .select("id, position")
    .in("id", [unitId, otherUnitId]);
  if (error) throw new Error(error.message);
  if (!rows || rows.length !== 2) return;

  const [a, b] = rows;
  const TEMP_OFFSET = -1000000;
  await supabase
    .from("teacher_curriculum_template_units")
    .update({ position: TEMP_OFFSET })
    .eq("id", a.id);
  await supabase
    .from("teacher_curriculum_template_units")
    .update({ position: a.position })
    .eq("id", b.id);
  await supabase
    .from("teacher_curriculum_template_units")
    .update({ position: b.position })
    .eq("id", a.id);
}
