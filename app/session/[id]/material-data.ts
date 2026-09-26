import type { SupabaseClient } from "@supabase/supabase-js";

export type MaterialProblem = {
  id: string;
  format: "mc" | "essay" | "math";
  passage: string;
  options: string[] | null;
  correctIndex: number | null;
  explanation: string;
  difficulty: string | null;
  skillType: string | null;
  // 새로고침해도 유지되도록, 기존 시도 기록에서 재구성한 현재 상태.
  priorWrongCount: number;
  correct: boolean | null; // true=정답, false=오답으로 종료(3회 소진), null=아직 안 끝남
  done: boolean;
  submittedResponse: string | null; // essay/math 이미 제출한 응답
};

export type MaterialSection = {
  id: string;
  title: string;
  body: string;
  teachingTip: string | null;
  problems: MaterialProblem[];
};

export type CanvasStroke = {
  /** 그릴 때의 캔버스 너비(px). 화면 크기가 바뀌어도 필기 위치를 유지하는 기준. */
  w?: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  tool: "pen" | "eraser";
};

/**
 * 파일 자료(PDF·영상) 한 건 — 수업이 쓰는 **공개 버전** 기준이다.
 *
 * 2026-09-14: 파일 자료는 curriculum_docs 의 한 종류(kind)이고 내용은 공개 시점 고정
 * 사본에 있다(버전 스냅샷 asset). 화면은 versionId 로 서명 URL 을 받아 연다 — 원본
 * Drive 파일이 바뀌거나 지워져도 이 버전은 그대로다.
 */
export type MaterialAsset = {
  docId: string;
  versionId: string;
  kind: "pdf" | "video";
  title: string;
  pageCount: number | null;
  mimeType: string;
  /** 고정 사본이 기록되지 않은 버전 — 화면이 사유를 말한다. */
  unavailable?: boolean;
};

export type MaterialData = {
  docId: string;
  title: string;
  sections: MaterialSection[];
  canvasStrokes: CanvasStroke[];
  /** 이 수업의 파일 자료(PDF·영상), 표시 순서대로. HTML 섹션과 함께 있을 수 있다. */
  assets?: MaterialAsset[];
  /**
   * 이 수업이 쓴 교재 내용이 보존돼 있지 않다.
   *
   * 2026-09-13 확정: 고정된 버전이 없거나 그 내용을 확인할 수 없으면 **현재 교재로
   * 조용히 대체하지 않는다.** 지금 내용을 보여주면 그 수업이 실제로 쓴 것이라는
   * 거짓말이 된다. sections 는 비어 있고 화면이 사유를 말한다.
   */
  preservedUnavailable?: boolean;
} | null;

export async function loadMaterialData(
  supabase: SupabaseClient,
  curriculumDocId: string | null,
  sessionId: string,
  studentId: string
): Promise<MaterialData> {
  if (!curriculumDocId) return null;

  const { data: doc } = await supabase
    .from("curriculum_docs")
    .select("id, title")
    .eq("id", curriculumDocId)
    .single();
  if (!doc) return null;

  const { data: sections } = await supabase
    .from("curriculum_doc_sections")
    .select("id, position, title, body, teaching_tip")
    .eq("curriculum_doc_id", curriculumDocId)
    .order("position", { ascending: true });

  const sectionIds = (sections ?? []).map((s) => s.id);

  const { data: problems } = sectionIds.length
    ? await supabase
        .from("problems")
        .select(
          "id, format, passage, options, correct_index, explanation, difficulty, skill_type, section_id"
        )
        .in("section_id", sectionIds)
        .eq("status", "confirmed")
    : { data: [] as never[] };

  const problemIds = (problems ?? []).map((p) => p.id);

  const { data: attempts } = problemIds.length
    ? await supabase
        .from("session_problem_attempts")
        .select("problem_id, correct, response, attempted_at")
        .eq("session_id", sessionId)
        .eq("student_id", studentId)
        .in("problem_id", problemIds)
        .order("attempted_at", { ascending: true })
    : { data: [] as never[] };

  function buildProblem(p: NonNullable<typeof problems>[number]): MaterialProblem {
    const attemptsForProblem = (attempts ?? []).filter(
      (a) => a.problem_id === p.id
    );
    const wrongCount = attemptsForProblem.filter(
      (a) => a.correct === false
    ).length;
    const correctAttempt = attemptsForProblem.find((a) => a.correct === true);
    const correct = correctAttempt ? true : wrongCount >= 3 ? false : null;
    const done = correct !== null;
    const lastResponse = attemptsForProblem.at(-1)?.response ?? null;

    return {
      id: p.id,
      format: p.format,
      passage: p.passage,
      options: p.options,
      correctIndex: p.correct_index,
      explanation: p.explanation,
      difficulty: p.difficulty,
      skillType: p.skill_type,
      priorWrongCount: wrongCount,
      correct,
      done,
      submittedResponse:
        p.format !== "mc" && typeof lastResponse === "string"
          ? lastResponse
          : null,
    };
  }

  const problemsBySection = new Map<string, MaterialProblem[]>();
  (problems ?? []).forEach((p) => {
    const list = problemsBySection.get(p.section_id) ?? [];
    list.push(buildProblem(p));
    problemsBySection.set(p.section_id, list);
  });

  const { data: annotation } = await supabase
    .from("canvas_annotations")
    .select("strokes")
    .eq("session_id", sessionId)
    .eq("curriculum_doc_id", curriculumDocId)
    .maybeSingle();

  return {
    docId: doc.id,
    title: doc.title,
    sections: (sections ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      body: s.body ?? "",
      teachingTip: s.teaching_tip,
      problems: problemsBySection.get(s.id) ?? [],
    })),
    canvasStrokes: (annotation?.strokes as CanvasStroke[] | null) ?? [],
  };
}

// P2/P3 5단계 — 수업 시작 시 고정된 교재를 읽는다.
//
// loadMaterialData()는 세션 행의 curriculum_doc_id 하나를 통째로 펼친다(레거시
// 경로). v3 수업에서 실제로 다루는 교재는 "선생님이 준비 화면에서 고르고 수업
// 시작 시 고정된 조각들"(session_content_manifest)이라, 그 목록을 그대로 읽어야
// 화면과 준비 내용이 일치한다. 고정된 교재가 없으면 null을 돌려주고, 호출하는
// 쪽이 기존 경로로 넘어간다.
export async function loadPinnedMaterialData(
  supabase: SupabaseClient,
  sessionId: string
): Promise<MaterialData> {
  // 교재 전체(material_doc)와 과거의 조각 단위(material_section)를 함께 읽는다.
  const { data: manifest } = await supabase
    .from("session_content_manifest")
    .select("content_type, content_id, display_position, curriculum_doc_version_id")
    .eq("session_id", sessionId)
    .in("content_type", ["material_doc", "material_section"])
    .order("display_position", { ascending: true });
  if (!manifest?.length) return null;

  const docId = manifest[0].content_type === "material_doc"
    ? (manifest[0].content_id as string)
    : await resolveSectionDocId(supabase, manifest[0].content_id as string);

  const { data: annotation } = docId
    ? await supabase
        .from("canvas_annotations")
        .select("strokes")
        .eq("session_id", sessionId)
        .eq("curriculum_doc_id", docId)
        .maybeSingle()
    : { data: null };
  const canvasStrokes = (annotation?.strokes as CanvasStroke[] | null) ?? [];

  // 고정된 버전이 있으면 **그 버전의 스냅샷만** 읽는다. 살아 있는 본문은 보지
  // 않는다 — 교재를 고쳐도 이 수업의 화면이 바뀌면 안 된다.
  const versionIds = Array.from(
    new Set(
      manifest
        .map((m) => m.curriculum_doc_version_id as string | null)
        .filter((v): v is string => Boolean(v))
    )
  );

  if (versionIds.length === 0) {
    // 버전이 기록되지 않았다. 현재 내용으로 대체하지 않는다.
    return {
      docId: docId ?? "",
      title: "이번 수업 교재",
      sections: [],
      canvasStrokes,
      preservedUnavailable: true,
    };
  }

  const { data: versions } = await supabase
    .from("curriculum_doc_versions")
    .select("id, curriculum_doc_id, snapshot")
    .in("id", versionIds);

  const snapshotById = new Map(
    (versions ?? []).map((v) => [v.id as string, v.snapshot as DocSnapshot | null])
  );

  const ordered: MaterialSection[] = [];
  const assets: MaterialAsset[] = [];
  let title: string | null = null;

  for (const row of manifest) {
    const snapshot = snapshotById.get(row.curriculum_doc_version_id as string);
    const snapSections = snapshot?.sections ?? [];
    if (title === null && snapshot?.title) title = snapshot.title;

    // 파일 자료 — 고정 사본 참조를 그대로 넘긴다. 섹션은 없다.
    if (row.content_type === "material_doc" && snapshot?.kind && snapshot.kind !== "html") {
      assets.push(assetFromSnapshot(row.content_id as string, row.curriculum_doc_version_id as string, snapshot));
      continue;
    }

    if (row.content_type === "material_doc") {
      for (const sec of [...snapSections].sort((a, b) => a.position - b.position)) {
        ordered.push(toMaterialSection(sec));
      }
    } else {
      const sec = snapSections.find((x) => x.id === row.content_id);
      if (sec) ordered.push(toMaterialSection(sec));
    }
  }

  // 2026-09-14 UAT: "교재 이름을 다 바꿨는데 반영이 안 됐네" — 고정되는 것은 **내용**(고정 사본)이고,
  // 노출용 이름은 표시 문제라 지금 이름을 따른다. 읽지 못하면(권한·삭제) 고정 당시 이름으로 둔다.
  if (assets.length > 0) {
    const { data: docs } = await supabase
      .from("curriculum_docs")
      .select("id, title")
      .in("id", assets.map((a) => a.docId));
    const titleById = new Map((docs ?? []).map((d) => [d.id as string, (d.title as string | null)?.trim() || null]));
    for (const a of assets) {
      const now = titleById.get(a.docId);
      if (now) a.title = now;
    }
  }

  if (ordered.length === 0 && assets.length === 0) {
    // 버전은 가리키는데 내용이 비어 있다 — 스냅샷이 불완전하다.
    return {
      docId: docId ?? "",
      title: title ?? "이번 수업 교재",
      sections: [],
      canvasStrokes,
      preservedUnavailable: true,
    };
  }

  return {
    docId: docId ?? "",
    title: title ?? "이번 수업 교재",
    sections: ordered,
    canvasStrokes,
    ...(assets.length ? { assets } : {}),
  };
}

/** 버전 스냅샷의 모양(curriculum_doc_snapshot 이 만든다). */
type DocSnapshot = {
  title?: string;
  kind?: string;
  asset?: { pageCount?: number; mimeType?: string; path?: string };
  sections?: { id: string; position: number; title: string; body: string | null; teachingTip: string | null }[];
};

function assetFromSnapshot(docId: string, versionId: string, snapshot: DocSnapshot): MaterialAsset {
  const kind = snapshot.kind === "video" ? "video" : "pdf";
  return {
    docId,
    versionId,
    kind,
    title: snapshot.title ?? "자료",
    pageCount: typeof snapshot.asset?.pageCount === "number" ? snapshot.asset.pageCount : null,
    mimeType: snapshot.asset?.mimeType ?? (kind === "pdf" ? "application/pdf" : "video/mp4"),
    ...(snapshot.asset?.path ? {} : { unavailable: true }),
  };
}

function toMaterialSection(sec: {
  id: string;
  title: string;
  body: string | null;
  teachingTip: string | null;
}): MaterialSection {
  return {
    id: sec.id,
    title: sec.title,
    body: sec.body ?? "",
    teachingTip: sec.teachingTip ?? null,
    // 문제는 "문제" 탭에서 고정된 버전으로 다룬다 — 교재 안에 섞지 않는다.
    problems: [],
  };
}

async function resolveSectionDocId(
  supabase: SupabaseClient,
  sectionId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("curriculum_doc_sections")
    .select("curriculum_doc_id")
    .eq("id", sectionId)
    .maybeSingle();
  return (data?.curriculum_doc_id as string | null) ?? null;
}

/**
 * 수업 시작 전의 교재 — 회차 교재 구성을 그대로 보여준다.
 *
 * session_content_manifest는 **수업 시작 시점에** 채워진다(고정). 그래서 준비
 * 중인 수업은 매니페스트가 비어 있고, 그것만 읽으면 화면이 "배정된 교재가
 * 없습니다"가 된다 — 선생님이 회차에 교재를 다 넣어 뒀는데도 그렇다.
 *
 * 여기서 보여주는 것은 **아직 고정되지 않은 예정 내용**이다. 지금 바뀌면 화면도
 * 바뀌고, 수업이 시작되면 그 시점 내용으로 고정된다. 고정된 뒤에는 매니페스트가
 * 우선이므로 이 함수는 쓰이지 않는다.
 */
export async function loadPlannedMaterialData(
  supabase: SupabaseClient,
  sessionId: string
): Promise<MaterialData> {
  const { data: link } = await supabase
    .from("session_curriculum_units")
    .select("overlay_unit_id")
    .eq("session_id", sessionId)
    .eq("role", "primary")
    .maybeSingle();
  const overlayUnitId = link?.overlay_unit_id as string | undefined;
  if (!overlayUnitId) return null;

  const { data: materials } = await supabase
    .from("curriculum_overlay_unit_materials")
    .select("curriculum_doc_id, position, curriculum_doc_version_id")
    .eq("overlay_unit_id", overlayUnitId)
    .order("position", { ascending: true });
  if (!materials?.length) return null;

  const docIds = materials.map((m) => m.curriculum_doc_id as string);
  // 배포됐고 보관되지 않은 교재만 — 학생에게 갈 수 없는 것을 미리 보여주지 않는다.
  const { data: docs } = await supabase
    .from("curriculum_docs")
    .select("id, title, kind")
    .in("id", docIds)
    .eq("status", "published")
    .is("archived_at", null);
  if (!docs?.length) return null;

  const visibleIds = docIds.filter((id) => docs.some((d) => d.id === id));
  const htmlIds = visibleIds.filter((id) => ((docs.find((d) => d.id === id)?.kind as string) ?? "html") === "html");
  const assetIds = visibleIds.filter((id) => !htmlIds.includes(id));

  // 파일 자료 — 준비안이 담을 때 고른 버전, 없으면 지금 공개본. 시작 전이므로 바뀔 수 있다.
  const assets: MaterialAsset[] = [];
  if (assetIds.length) {
    const { data: versions } = await supabase
      .from("curriculum_doc_versions")
      .select("id, curriculum_doc_id, version_number, snapshot")
      .in("curriculum_doc_id", assetIds)
      .order("version_number", { ascending: false });
    for (const docId of assetIds) {
      const picked = materials.find((m) => m.curriculum_doc_id === docId)?.curriculum_doc_version_id as string | null;
      const v =
        (versions ?? []).find((x) => x.id === picked) ??
        (versions ?? []).find((x) => x.curriculum_doc_id === docId);
      const snap = v?.snapshot as DocSnapshot | undefined;
      if (v && snap?.kind && snap.kind !== "html") {
        assets.push(assetFromSnapshot(docId, v.id as string, snap));
      }
    }
  }

  const { data: sections } = htmlIds.length
    ? await supabase
        .from("curriculum_doc_sections")
        .select("id, title, body, teaching_tip, curriculum_doc_id, position")
        .in("curriculum_doc_id", htmlIds)
        .order("position", { ascending: true })
    : { data: [] as { id: string; title: string; body: string | null; teaching_tip: string | null; curriculum_doc_id: string; position: number }[] };

  // 교재 순서를 지키고, 각 교재 안에서는 조각 순서를 지킨다.
  const ordered = htmlIds.flatMap((docId) =>
    (sections ?? []).filter((s) => s.curriculum_doc_id === docId)
  );
  if (!ordered.length && !assets.length) return null;

  const firstDocId = htmlIds[0] ?? visibleIds[0];
  const { data: annotation } = await supabase
    .from("canvas_annotations")
    .select("strokes")
    .eq("session_id", sessionId)
    .eq("curriculum_doc_id", firstDocId)
    .maybeSingle();

  return {
    docId: firstDocId,
    title: (docs.find((d) => d.id === firstDocId)?.title as string) ?? "이번 회차 교재",
    sections: ordered.map((s) => ({
      id: s.id as string,
      title: s.title as string,
      body: (s.body as string) ?? "",
      teachingTip: (s.teaching_tip as string | null) ?? null,
      problems: [],
    })),
    canvasStrokes: (annotation?.strokes as CanvasStroke[] | null) ?? [],
    ...(assets.length ? { assets } : {}),
  };
}

/**
 * 고정된 교재가 없을 때 "예정 구성"으로 내려가도 되는가.
 *
 * 2026-09-13 정정: **시작 전 수업에만** 내려간다. 시작·완료된 수업에 고정 자료가
 * 없다고 해서 최신 예정 구성을 끼워 넣으면, 그 수업이 실제로 쓰지 않은 내용을 그
 * 수업의 내용처럼 보여주게 된다. 회차 구성은 그 뒤로도 계속 바뀌므로, 같은 과거
 * 수업을 열 때마다 다른 것이 보이게 된다.
 *
 * 시작·완료됐는데 고정 자료가 없는 수업(준비 없이 시작한 경우)은 비어 있는 채로
 * 둔다 — 없었다는 사실이 사실이다.
 */
export function shouldFallBackToPlannedMaterial(
  sessionSource: "v3" | "legacy",
  state: "prep" | "live" | "completed"
): boolean {
  return sessionSource === "v3" && state === "prep";
}

/**
 * 이 수업에 고정 기록이 남아 있는가.
 *
 * 2026-09-13 지시: "실제로 자료 없이 시작한 수업과 고정 기록을 확인할 수 없는
 * 수업을 구분할 수 있는지 확인해주세요."
 *
 * 구분할 수 있다. session_content_manifest 에 **어떤 종류든 행이 있으면** 시작
 * 시점에 고정이 일어난 것이다. loadPinnedMaterialData 는 교재 종류만 읽으므로
 * "문제만 고정된 수업"에서도 null 을 돌려주는데, 그것은 기록이 없는 것과 다르다.
 *
 *   frozen_with_materials     고정됐고 교재도 있다
 *   frozen_without_materials  고정은 됐는데 교재가 없다 — 문제만 있는 수업 등.
 *                             **정상이다.** 교재가 없다고 오류로 만들지 않는다.
 *   no_freeze_record          고정 기록 자체가 없다 — "없었다"고 단정할 수 없고,
 *                             확인할 수 없다고 말해야 한다.
 */
export type SessionFreezeState =
  | "frozen_with_materials"
  | "frozen_without_materials"
  | "no_freeze_record";

export async function loadSessionFreezeState(
  supabase: SupabaseClient,
  sessionId: string
): Promise<SessionFreezeState> {
  const { data } = await supabase
    .from("session_content_manifest")
    .select("content_type")
    .eq("session_id", sessionId);

  if (!data?.length) return "no_freeze_record";
  const hasMaterial = data.some(
    (row) => row.content_type === "material_doc" || row.content_type === "material_section"
  );
  return hasMaterial ? "frozen_with_materials" : "frozen_without_materials";
}

/**
 * 시작·완료된 수업에서 교재 자리에 무엇이라고 쓸 것인가.
 * 시작 전 수업과 교재가 실제로 고정된 수업에는 아무 말도 덧붙이지 않는다.
 */
export function frozenMaterialNotice(
  state: "prep" | "live" | "completed",
  freezeState: SessionFreezeState
): string | null {
  if (state === "prep") return null;
  if (freezeState === "frozen_with_materials") return null;
  if (freezeState === "frozen_without_materials") {
    return "이 수업에는 고정된 교재가 없습니다. 문제만으로 진행한 수업일 수 있습니다.";
  }
  // 기록이 없다 — 자료 없이 시작했는지, 기록이 남지 않았는지 구분할 근거가 없다.
  return "이 수업의 고정된 교재 구성을 확인할 수 없습니다.";
}
