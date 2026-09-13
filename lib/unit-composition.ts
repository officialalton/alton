import type { SupabaseClient } from "@supabase/supabase-js";

// 세 계층의 회차 구성을 같은 모양으로 다룬다.
//
// 2026-09-13 지시 4절: "세 계층은 같은 UI를 재사용한다. 상단에 관리자 기준본 /
// 내 기본 구성 / ○○ 학생과 과목·회차를 표시해 수정 대상을 분명히 한다."
//
// 화면 하나가 세 층을 다루려면 데이터도 한 모양이어야 한다. 층마다 테이블 이름과
// 외래키 컬럼만 다르고 규칙은 같으므로(20261309·20261317·20261320에서 맞췄다),
// 그 차이를 여기 한 곳에 모은다. 화면과 서버 액션은 층을 값으로 받는다.
//
// 권한은 여기서 다루지 않는다 — 호출하는 쪽이 requireAdmin / requireUser /
// requireAssignedTeacherOrAdmin 으로 먼저 가르고, RLS가 실제 방어선이다.

export type PrepLayer = "catalog" | "teacher" | "student";

export type LayerSpec = {
  /** 회차 테이블. */
  unitTable: string;
  /** 키워드·교재 테이블이 회차를 가리키는 컬럼 이름. */
  unitFk: string;
  keywordTable: string;
  materialTable: string;
  exclusionTable: string;
  /** 화면 상단에 무엇을 고치는 중인지 쓰는 말. 학생 층은 이름이 붙는다. */
  label: string;
};

export const LAYERS: Record<PrepLayer, LayerSpec> = {
  catalog: {
    unitTable: "subject_template_units",
    unitFk: "unit_id",
    keywordTable: "subject_template_unit_keywords",
    materialTable: "subject_template_unit_materials",
    exclusionTable: "subject_template_unit_material_exclusions",
    label: "관리자 기준본",
  },
  teacher: {
    unitTable: "teacher_curriculum_template_units",
    unitFk: "unit_id",
    keywordTable: "teacher_curriculum_template_unit_keywords",
    materialTable: "teacher_curriculum_template_unit_materials",
    exclusionTable: "teacher_curriculum_template_unit_material_exclusions",
    label: "내 기본 구성",
  },
  student: {
    unitTable: "curriculum_overlay_units",
    unitFk: "overlay_unit_id",
    keywordTable: "curriculum_overlay_unit_keywords",
    materialTable: "curriculum_overlay_unit_materials",
    exclusionTable: "curriculum_overlay_unit_material_exclusions",
    label: "학생",
  },
};

export type UnitKeyword = { id: string; label: string };

export type UnitMaterial = {
  curriculumDocId: string;
  title: string;
  position: number;
  /** auto = 회차 키워드에서 자동으로 들어온 것. manual = 사람이 직접 담은 것. */
  source: "auto" | "manual";
};

export type UnitComposition = {
  layer: PrepLayer;
  unitId: string;
  unitTitle: string;
  subjectId: string;
  subjectName: string;
  /** 화면 머리말. 학생 층이면 학생 이름이 들어간다. */
  scopeLabel: string;
  keywords: UnitKeyword[];
  materials: UnitMaterial[];
  /** 과목 전체 키워드 후보. */
  subjectKeywords: UnitKeyword[];
  /** 위 계층에서 물려받을 기본이 있는가(기준본 층은 자기가 기준이라 항상 false). */
  hasInheritableDefaults: boolean;
};

/**
 * 회차가 어느 과목에 속하고 무엇이라 불리는지. 층마다 찾아가는 길이 다르다.
 *
 *   catalog  회차 → 과목
 *   teacher  회차 → 템플릿 → 과목
 *   student  회차 → 오버레이 → 수강 → 과목, 그리고 학생 이름
 */
export async function resolveUnitScope(
  supabase: SupabaseClient,
  layer: PrepLayer,
  unitId: string
): Promise<{
  unitTitle: string;
  subjectId: string;
  subjectName: string;
  scopeLabel: string;
  sourceUnitId: string | null;
} | null> {
  if (layer === "catalog") {
    const { data } = await supabase
      .from("subject_template_units")
      .select("unit_title, subject_id, subject:subjects(name)")
      .eq("id", unitId)
      .maybeSingle();
    if (!data) return null;
    return {
      unitTitle: data.unit_title as string,
      subjectId: data.subject_id as string,
      subjectName: relName(data.subject),
      scopeLabel: LAYERS.catalog.label,
      // 기준본이 곧 기준이다 — 위에서 물려받을 것이 없다.
      sourceUnitId: null,
    };
  }

  if (layer === "teacher") {
    const { data } = await supabase
      .from("teacher_curriculum_template_units")
      .select(
        "unit_title, source_unit_id, template:teacher_curriculum_templates!inner(subject_id, subject:subjects(name))"
      )
      .eq("id", unitId)
      .maybeSingle();
    if (!data) return null;
    const template = one(data.template) as
      | { subject_id?: string; subject?: unknown }
      | undefined;
    return {
      unitTitle: data.unit_title as string,
      subjectId: (template?.subject_id as string) ?? "",
      subjectName: relName(template?.subject),
      scopeLabel: LAYERS.teacher.label,
      sourceUnitId: (data.source_unit_id as string | null) ?? null,
    };
  }

  // 학생 층은 회차 → 오버레이 → 수강 → 과목·학생으로 두 단계를 더 간다.
  // 한 번의 중첩 embed로 쓰면 생성된 타입이 이를 풀지 못해 빌드가 깨진다.
  // 단계별로 나눠 읽는다 — 쿼리 수는 늘지만 무엇을 읽는지가 분명하다.
  const { data: unitRow } = await supabase
    .from("curriculum_overlay_units")
    .select("unit_title, source_unit_id, overlay_id")
    .eq("id", unitId)
    .maybeSingle();
  if (!unitRow) return null;

  const { data: overlayRow } = await supabase
    .from("student_curriculum_overlays")
    .select("subject_enrollment_id")
    .eq("id", unitRow.overlay_id as string)
    .maybeSingle();

  const { data: enrollmentRow } = overlayRow
    ? await supabase
        .from("subject_enrollments")
        .select("subject_id, subject:subjects(name), child:profiles(name)")
        .eq("id", overlayRow.subject_enrollment_id as string)
        .maybeSingle()
    : { data: null };

  const studentName = relName(enrollmentRow?.child);
  return {
    unitTitle: unitRow.unit_title as string,
    subjectId: (enrollmentRow?.subject_id as string) ?? "",
    subjectName: relName(enrollmentRow?.subject),
    // 학생 층은 누구의 것인지가 제일 중요하다 — 이름을 그대로 쓴다.
    scopeLabel: studentName ? `${studentName} 학생` : LAYERS.student.label,
    sourceUnitId: (unitRow.source_unit_id as string | null) ?? null,
  };
}

/** 층을 값으로 받아 회차 구성을 같은 모양으로 읽는다. */
export async function loadComposition(
  supabase: SupabaseClient,
  layer: PrepLayer,
  unitId: string
): Promise<UnitComposition | null> {
  const spec = LAYERS[layer];
  const scope = await resolveUnitScope(supabase, layer, unitId);
  if (!scope) return null;

  const [{ data: linkRows }, { data: materialRows }, { data: subjectKeywordRows }] =
    await Promise.all([
      supabase.from(spec.keywordTable).select("keyword_id").eq(spec.unitFk, unitId),
      supabase
        .from(spec.materialTable)
        .select("curriculum_doc_id, position, source")
        .eq(spec.unitFk, unitId)
        .order("position", { ascending: true }),
      scope.subjectId
        ? supabase
            .from("subject_keywords")
            .select("id, label")
            .eq("subject_id", scope.subjectId)
            .eq("status", "active")
            .order("label", { ascending: true })
        : Promise.resolve({ data: [] as { id: string; label: string }[] }),
    ]);

  const labelById = new Map(
    (subjectKeywordRows ?? []).map((k) => [k.id as string, k.label as string])
  );

  const docIds = (materialRows ?? []).map((m) => m.curriculum_doc_id as string);
  const { data: docs } = docIds.length
    ? await supabase.from("curriculum_docs").select("id, title").in("id", docIds)
    : { data: [] as { id: string; title: string }[] };
  const titleById = new Map((docs ?? []).map((d) => [d.id as string, d.title as string]));

  return {
    layer,
    unitId,
    unitTitle: scope.unitTitle,
    subjectId: scope.subjectId,
    subjectName: scope.subjectName,
    scopeLabel: scope.scopeLabel,
    // 과목 키워드 목록에서 이름을 찾는다. 못 찾으면(비활성 등) 목록에서 빼지 않고
    // 붙어 있다는 사실을 그대로 보여준다 — 조용히 사라지면 왜 저런지 알 수 없다.
    keywords: (linkRows ?? []).map((r) => ({
      id: r.keyword_id as string,
      label: labelById.get(r.keyword_id as string) ?? "(더 이상 쓰지 않는 키워드)",
    })),
    materials: (materialRows ?? []).map((m) => ({
      curriculumDocId: m.curriculum_doc_id as string,
      title: titleById.get(m.curriculum_doc_id as string) ?? "(제목 없음)",
      position: m.position as number,
      source: ((m.source as string) === "auto" ? "auto" : "manual") as "auto" | "manual",
    })),
    subjectKeywords: (subjectKeywordRows ?? []).map((k) => ({
      id: k.id as string,
      label: k.label as string,
    })),
    hasInheritableDefaults: Boolean(scope.sourceUnitId),
  };
}

function one(rel: unknown): unknown {
  return Array.isArray(rel) ? rel[0] : rel;
}

function relName(rel: unknown): string {
  return ((one(rel) as { name?: string } | null)?.name ?? "").trim();
}

export type PickableMaterial = {
  curriculumDocId: string;
  title: string;
  primaryKeywordLabel: string | null;
  /** 이미 이 회차 구성에 들어 있는가. */
  picked: boolean;
};

/**
 * 이 회차에 담을 수 있는 교재 목록.
 *
 * 공개된 것만 보여준다 — draft 교재는 학생에게 갈 수 없으므로 구성 후보도 아니다.
 * 보관된 교재도 뺀다: 보관은 "신규 선택에서 제외"이지 삭제가 아니므로, 이미 담겨
 * 있는 것은 그대로 두고 **새로 고르는 목록에서만** 빠진다.
 */
export async function loadPickableMaterials(
  supabase: SupabaseClient,
  subjectId: string,
  pickedDocIds: string[]
): Promise<PickableMaterial[]> {
  if (!subjectId) return [];

  const { data: docs } = await supabase
    .from("curriculum_docs")
    .select("id, title, primary_keyword_id")
    .eq("subject_id", subjectId)
    .eq("status", "published")
    .is("archived_at", null)
    .order("title", { ascending: true });

  const keywordIds = Array.from(
    new Set((docs ?? []).map((d) => d.primary_keyword_id as string | null).filter(Boolean))
  ) as string[];
  const { data: keywords } = keywordIds.length
    ? await supabase.from("subject_keywords").select("id, label").in("id", keywordIds)
    : { data: [] as { id: string; label: string }[] };
  const labelById = new Map((keywords ?? []).map((k) => [k.id as string, k.label as string]));

  const picked = new Set(pickedDocIds);
  return (docs ?? []).map((d) => ({
    curriculumDocId: d.id as string,
    title: d.title as string,
    primaryKeywordLabel: d.primary_keyword_id
      ? labelById.get(d.primary_keyword_id as string) ?? null
      : null,
    picked: picked.has(d.id as string),
  }));
}
