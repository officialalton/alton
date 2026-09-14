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

// 2026-09-14 성능 추적 — 수업 준비 조회가 원격에서 16~72초. 어느 쿼리인지 서버 로그로 가른다.
// 값이 아니라 소요(ms)만 남긴다. 원인이 잡히면 뺀다.
async function timed<T>(label: string, sink: Record<string, number>, run: () => PromiseLike<T>): Promise<T> {
  const t = Date.now();
  try {
    return await run();
  } finally {
    sink[label] = Date.now() - t;
  }
}

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

/**
 * 층마다 담긴 문제를 어디서 읽는지.
 *
 * 학생 층만 모양이 다르다 — 문제는 회차가 아니라 **준비안**에 매달린다
 * (curriculum_unit_prep_items). 그래서 회차 → 준비안 한 단계를 더 간다.
 */
async function loadUnitProblems(
  supabase: SupabaseClient,
  layer: PrepLayer,
  unitId: string
): Promise<UnitProblem[]> {
  let rows: { problem_id: string; position: number; source: string; problem_version_id: string | null }[] = [];

  if (layer === "student") {
    const { data: prep } = await supabase
      .from("curriculum_unit_preps")
      .select("id")
      .eq("overlay_unit_id", unitId)
      .maybeSingle();
    if (!prep) return [];
    const { data } = await supabase
      .from("curriculum_unit_prep_items")
      .select("content_id, position, problem_version_id")
      .eq("prep_id", prep.id as string)
      .eq("content_type", "problem")
      .order("position", { ascending: true });
    rows = (data ?? []).map((r) => ({
      problem_id: r.content_id as string,
      position: r.position as number,
      // 준비안에는 출처 구분이 없다 — 담긴 것은 전부 사람이 고른 결과로 본다.
      source: "manual",
      problem_version_id: (r.problem_version_id as string | null) ?? null,
    }));
  } else {
    const table =
      layer === "catalog"
        ? "subject_template_unit_problems"
        : "teacher_curriculum_template_unit_problems";
    const { data } = await supabase
      .from(table)
      .select("problem_id, position, source, problem_version_id")
      .eq("unit_id", unitId)
      .order("position", { ascending: true });
    rows = (data ?? []).map((r) => ({
      problem_id: r.problem_id as string,
      position: r.position as number,
      source: (r.source as string) ?? "manual",
      problem_version_id: (r.problem_version_id as string | null) ?? null,
    }));
  }

  if (rows.length === 0) return [];

  const { data: problems } = await supabase
    .from("problems")
    .select("id, passage, skill_type, difficulty")
    .in(
      "id",
      rows.map((r) => r.problem_id)
    );
  const byId = new Map((problems ?? []).map((p) => [p.id as string, p]));

  return rows.map((r) => {
    const p = byId.get(r.problem_id);
    const passage = ((p?.passage as string | null) ?? "").trim();
    const skill = ((p?.skill_type as string | null) ?? "").trim();
    const snippet = passage.length > 60 ? `${passage.slice(0, 60)}…` : passage;
    return {
      problemId: r.problem_id,
      label: snippet || skill || "(본문 없음)",
      position: r.position,
      difficulty: (p?.difficulty as string | null) ?? null,
      source: r.source === "auto" ? ("auto" as const) : ("manual" as const),
      problemVersionId: r.problem_version_id,
    };
  });
}

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
  /**
   * 이 회차에서 달성할 것.
   *
   * null 과 빈 문자열을 구분한다 — null 은 "아직 아무도 정하지 않았다(상속 대상)",
   * 빈 문자열은 "사람이 일부러 비웠다". 둘을 같게 다루면 일부러 지운 목표가 상속으로
   * 되살아난다.
   */
  goal: string | null;
  /**
   * 구성이 한 번이라도 만들어졌는가. false 면 키워드를 붙이는 순간 자동으로
   * 구성된다(신규 생성·최초 상속). true 면 이후 변경은 '다시 구성'을 눌러야 반영된다.
   */
  composed: boolean;
  /** 구성에 반영되지 않은 변경이 있는가(키워드·조건·교재 공개 등). */
  hasUnappliedChanges: boolean;
  /** 담을 때의 버전과 지금 공개된 버전이 다른 항목 수. */
  outdatedVersionCount: number;
  /**
   * 상위와 어긋난 항목 수 — 상위에 있는데 아직 없는 것 + 내려온 뒤 상위에서 없어진 것.
   * 사람이 뺀 것(제외 기록)과 직접 담은 것은 세지 않는다.
   */
  parentPendingCount: number;
  /**
   * 이 회차에 **실제로 담긴** 문제. 세 계층이 같은 모양으로 다룬다 — 학생 층은
   * 준비안(curriculum_unit_prep_items), 위 두 층은 각자의 구성 표에 담긴다.
   */
  problems: UnitProblem[];
};

export type UnitProblem = {
  problemId: string;
  /** 목록에서 알아볼 만큼의 짧은 설명. 문제 전문을 늘어놓지 않는다. */
  label: string;
  position: number;
  difficulty: string | null;
  /** auto = 키워드·조건에서 들어온 것. manual = 사람이 직접 담은 것. */
  source: "auto" | "manual";
  /** 담을 때의 공개 버전. null 이면 버전 제도 이전에 담긴 것이다. */
  problemVersionId: string | null;
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
  goal: string | null;
  composed: boolean;
  dirty: boolean;
} | null> {
  if (layer === "catalog") {
    const { data } = await supabase
      .from("subject_template_units")
      .select("unit_title, goal, subject_id, composed_at, composition_dirty, subject:subjects(name)")
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
      goal: (data.goal as string | null) ?? null,
      composed: Boolean(data.composed_at),
      dirty: Boolean(data.composition_dirty),
    };
  }

  if (layer === "teacher") {
    const { data } = await supabase
      .from("teacher_curriculum_template_units")
      .select(
        "unit_title, goal, source_unit_id, composed_at, composition_dirty, template:teacher_curriculum_templates!inner(subject_id, subject:subjects(name))"
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
      goal: (data.goal as string | null) ?? null,
      composed: Boolean(data.composed_at),
      dirty: Boolean(data.composition_dirty),
    };
  }

  // 학생 층은 회차 → 오버레이 → 수강 → 과목·학생으로 두 단계를 더 간다.
  // 한 번의 중첩 embed로 쓰면 생성된 타입이 이를 풀지 못해 빌드가 깨진다.
  // 단계별로 나눠 읽는다 — 쿼리 수는 늘지만 무엇을 읽는지가 분명하다.
  const { data: unitRow } = await supabase
    .from("curriculum_overlay_units")
    .select(
      "unit_title, source_unit_id, source_teacher_template_unit_id, overlay_id, composed_at, composition_dirty"
    )
    .eq("id", unitId)
    .maybeSingle();
  if (!unitRow) return null;

  // 2026-09-14 성능: 서로 기다릴 필요 없는 조회는 함께 보낸다. 수업 준비 화면이 15초 가까이
  // 걸린 원인의 하나가 회차 하나를 여는 데 왕복 15번을 **차례로** 하던 것이다.
  const [{ data: overlayRow }, { data: prepRow }] = await Promise.all([
    supabase
      .from("student_curriculum_overlays")
      .select("subject_enrollment_id")
      .eq("id", unitRow.overlay_id as string)
      .maybeSingle(),
    // 학생 층의 목표는 회차 준비에 있다(20261296000000). 준비 행이 없으면 아직
    // 아무도 정하지 않은 것이므로 null 이다.
    supabase.from("curriculum_unit_preps").select("goal").eq("overlay_unit_id", unitId).maybeSingle(),
  ]);

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
    // 물려받을 상위가 있는가 — 교사 회차를 직접 가리키는 경우도 포함한다.
    // 매칭 시딩은 교사 회차만 적었고, 그래서 이 회차들이 상속 대상이 아닌 것처럼
    // 보였다(20261344000000).
    sourceUnitId:
      (unitRow.source_unit_id as string | null) ??
      (unitRow.source_teacher_template_unit_id as string | null) ??
      null,
    goal: (prepRow?.goal as string | null) ?? null,
    composed: Boolean(unitRow.composed_at),
    dirty: Boolean(unitRow.composition_dirty),
  };
}

/** 층을 값으로 받아 회차 구성을 같은 모양으로 읽는다. */
export async function loadComposition(
  supabase: SupabaseClient,
  layer: PrepLayer,
  unitId: string
): Promise<UnitComposition | null> {
  const spec = LAYERS[layer];
  const timing: Record<string, number> = {};
  const scope = await timed("scope", timing, () => resolveUnitScope(supabase, layer, unitId));
  if (!scope) return null;

  const [
    { data: linkRows },
    { data: materialRows },
    { data: subjectKeywordRows },
    { data: countsRow },
    problems,
  ] =
    await Promise.all([
      timed("keywords", timing, () => supabase.from(spec.keywordTable).select("keyword_id").eq(spec.unitFk, unitId)),
      timed("materials", timing, () =>
        supabase
          .from(spec.materialTable)
          .select("curriculum_doc_id, position, source")
          .eq(spec.unitFk, unitId)
          .order("position", { ascending: true })
      ),
      timed("subjectKeywords", timing, async () =>
        scope.subjectId
          ? await supabase
              .from("subject_keywords")
              .select("id, label")
              .eq("subject_id", scope.subjectId)
              .eq("status", "active")
              .order("label", { ascending: true })
          : { data: [] as { id: string; label: string }[] }
      ),
      // 버전이 낡은 항목 수 + 상위와 어긋난 항목 수 — 회차 하나짜리 함수 한 번(20261354000000).
      // 두 뷰를 직접 세면 원격에서 RLS 가 행마다 붙어 10~17초가 걸렸다.
      timed("counts", timing, () =>
        supabase.rpc("unit_composition_counts", { p_layer: layer, p_unit_id: unitId }).maybeSingle()
      ),
      timed("problems", timing, () => loadUnitProblems(supabase, layer, unitId)),
    ]);

  const labelById = new Map(
    (subjectKeywordRows ?? []).map((k) => [k.id as string, k.label as string])
  );

  const docIds = (materialRows ?? []).map((m) => m.curriculum_doc_id as string);
  const { data: docs } = await timed("docTitles", timing, async () =>
    docIds.length
      ? await supabase.from("curriculum_docs").select("id, title").in("id", docIds)
      : { data: [] as { id: string; title: string }[] }
  );
  const titleById = new Map((docs ?? []).map((d) => [d.id as string, d.title as string]));
  console.log(JSON.stringify({ event: "composition_timing", layer, unitId, ...timing }));

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
    goal: scope.goal,
    composed: scope.composed,
    hasUnappliedChanges: scope.dirty,
    outdatedVersionCount: Number((countsRow as { drift_count?: number } | null)?.drift_count ?? 0),
    parentPendingCount: Number((countsRow as { parent_pending_count?: number } | null)?.parent_pending_count ?? 0),
    problems,
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

export type KeywordProblem = {
  problemId: string;
  /** 목록에서 알아볼 수 있을 만큼의 짧은 설명. 문제 전문을 늘어놓지 않는다. */
  label: string;
  difficulty: string | null;
  format: string;
};

/**
 * 이 회차의 키워드로 들어올 문제 미리보기.
 *
 * 2026-09-13 지시 4절: "관리자·선생님 기본 화면은 교재·문제를 미리보고 기본 구성을
 * 편집한다." 문제 선택은 학생별 운영본(curriculum_unit_prep_items)에만 있으므로,
 * 위 두 계층에서는 **무엇이 들어올지**만 보여준다. 여기서 고르게 하면 학생 문맥
 * 없이 문제를 확정하는 셈이 되고, 그건 이 화면이 할 일이 아니다.
 *
 * problem_auto_composition_candidates 를 쓴다 — 확정·미보관에 더해 **공개된 버전이
 * 있는 문제만**. 관계가 있다는 것만으로 선택 가능으로 보지 않는다(R9 corrective 2).
 */
export async function loadKeywordProblems(
  supabase: SupabaseClient,
  keywordIds: string[]
): Promise<KeywordProblem[]> {
  if (keywordIds.length === 0) return [];

  const { data: links } = await supabase
    .from("problem_auto_composition_candidates")
    .select("problem_id")
    .in("keyword_id", keywordIds);

  const problemIds = Array.from(new Set((links ?? []).map((l) => l.problem_id as string)));
  if (problemIds.length === 0) return [];

  const { data: problems } = await supabase
    .from("problems")
    .select("id, format, passage, skill_type, difficulty")
    .in("id", problemIds)
    .order("created_at", { ascending: true });

  return (problems ?? []).map((p) => {
    const passage = ((p.passage as string | null) ?? "").trim();
    const skill = ((p.skill_type as string | null) ?? "").trim();
    const snippet = passage.length > 60 ? `${passage.slice(0, 60)}…` : passage;
    return {
      problemId: p.id as string,
      label: snippet || skill || "(본문 없음)",
      difficulty: (p.difficulty as string | null) ?? null,
      format: p.format as string,
    };
  });
}
