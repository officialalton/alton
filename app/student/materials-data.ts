import type { SupabaseClient } from "@supabase/supabase-js";
import { selectInChunks, orderComparator } from "@/lib/select-in-chunks";
import { loadLegacyProblemAnswers } from "@/lib/legacy-problem-answers";

export type LibraryDocSummary = {
  id: string;
  title: string;
  unitTitle: string | null;
};

export type LibrarySubject = {
  subjectId: string;
  subjectName: string;
  docs: LibraryDocSummary[];
};

export type LibraryProblem = {
  id: string;
  format: "mc" | "spr" | "essay" | "math";
  passage: string;
  options: string[] | null;
  correctIndex: number | null;
  explanation: string;
  difficulty: string | null;
  skillType: string | null;
  priorWrongCount: number;
  correct: boolean | null;
  done: boolean;
  submittedResponse: string | null;
};

export type LibrarySection = {
  id: string;
  title: string;
  body: string;
  teachingTip: string | null;
  problems: LibraryProblem[];
};

export type LibraryDocDetail = {
  id: string;
  title: string;
  /** 2026-09-15 — 과목별 전체 교재 보기의 이전/다음 탐색에 쓴다. */
  subjectId: string;
  sections: LibrarySection[];
  /** html = 섹션 본문. pdf/video = 파일 자료 — 지금 공개본(asset)을 뷰어가 연다(2026-09-14). */
  kind: "html" | "pdf" | "video";
  asset: {
    versionId: string;
    pageCount: number | null;
    mimeType: string;
  } | null;
};

/** 학생이 수강 중인(active) 과목 id 집합 — 레거시 enrollments + v3 subject_enrollments 합. */
export async function studentEnrolledSubjectIds(
  supabase: SupabaseClient,
  studentId: string
): Promise<Map<string, string>> {
  // 2026-09-09(UAT 지적, 제품 오너 승인): 레거시 enrollments만 보면 v3
  // subject_enrollments로만 수강 중인 학생은 공개된 교재가 있어도 라이브러리가
  // 항상 비어 보인다. 두 소스를 함께 조회해 합친다(신규 v3 흐름의 권한 원본은
  // subject_enrollments — RLS도 20261267000000에서 동일하게 확장됨).
  const [{ data: enrollments }, { data: subjectEnrollments }] = await Promise.all([
    supabase
      .from("enrollments")
      .select("subject_id, subject:subjects(name)")
      .eq("student_id", studentId)
      .eq("status", "active"),
    supabase
      .from("subject_enrollments")
      .select("subject_id, subject:subjects(name)")
      .eq("child_id", studentId)
      .eq("status", "active"),
  ]);

  const subjects = new Map<string, string>();
  for (const e of [...(enrollments ?? []), ...(subjectEnrollments ?? [])]) {
    const row = Array.isArray(e.subject) ? e.subject[0] : e.subject;
    subjects.set(e.subject_id, (row as { name?: string } | null)?.name ?? "");
  }
  return subjects;
}

export type FreePublishedDoc = {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  unitId: string | null;
};

/**
 * 2026-10-05 무료 회원 S3 — 무료 공개(access_tier='free') 중 배포·미보관 자료. 활성 학생 누구나
 * (무료 회원 포함) 본다. RLS(20262100000003)가 같은 조건으로 열어 주므로 쿼리 1회.
 */
export async function loadFreePublishedDocs(supabase: SupabaseClient): Promise<FreePublishedDoc[]> {
  const { data } = await supabase
    .from("curriculum_docs")
    .select("id, title, subject_id, unit_id, subject:subjects(name)")
    .eq("access_tier", "free")
    .eq("status", "published")
    .is("archived_at", null)
    .order("title", { ascending: true });
  return (data ?? []).map((d) => {
    const row = Array.isArray(d.subject) ? d.subject[0] : d.subject;
    return {
      id: d.id as string,
      title: d.title as string,
      subjectId: d.subject_id as string,
      unitId: (d.unit_id as string | null) ?? null,
      subjectName: (row as { name?: string } | null)?.name ?? "",
    };
  });
}

export type MaterialsLibraryOptions = {
  /**
   * false = 수강 과목 조회를 건너뛴다(무료 회원 — 수강 관계가 없으므로 쿼리 2회 절약).
   * 기본 true: 수강 과목 ∪ 무료 공개 자료.
   */
  includeEnrolled?: boolean;
};

/** 수강 과목(선택) ∪ 무료 공개 자료의 과목. 무료 공개만으로 들어온 과목은 freeOnly로 표시한다. */
async function resolveLibrarySubjects(
  supabase: SupabaseClient,
  studentId: string,
  options: MaterialsLibraryOptions
): Promise<{ subjects: Map<string, string>; freeOnly: Set<string>; freeDocs: FreePublishedDoc[] }> {
  const [enrolled, freeDocs] = await Promise.all([
    options.includeEnrolled === false ? Promise.resolve(new Map<string, string>()) : studentEnrolledSubjectIds(supabase, studentId),
    loadFreePublishedDocs(supabase),
  ]);
  const subjects = new Map(enrolled);
  const freeOnly = new Set<string>();
  for (const d of freeDocs) {
    if (subjects.has(d.subjectId)) continue;
    subjects.set(d.subjectId, d.subjectName);
    freeOnly.add(d.subjectId);
  }
  return { subjects, freeOnly, freeDocs };
}

export async function loadMaterialsLibraryTree(
  supabase: SupabaseClient,
  studentId: string,
  options: MaterialsLibraryOptions = {}
) {
  const { subjects, freeOnly } = await resolveLibrarySubjects(supabase, studentId, options);
  const { buildSubjectMaterialTree } = await import("@/lib/subject-material-library");
  return buildSubjectMaterialTree(supabase, Array.from(subjects.keys()), { freeOnlySubjectIds: freeOnly });
}

export async function loadMaterialsLibrary(
  supabase: SupabaseClient,
  studentId: string,
  options: MaterialsLibraryOptions = {}
): Promise<LibrarySubject[]> {
  const { subjects, freeOnly, freeDocs } = await resolveLibrarySubjects(supabase, studentId, options);
  const enrolledSubjectIds = Array.from(subjects.keys()).filter((id) => !freeOnly.has(id));
  if (subjects.size === 0) return [];

  const { data: enrolledDocs } = enrolledSubjectIds.length
    ? await selectInChunks(enrolledSubjectIds, (chunk) => supabase
        .from("curriculum_docs")
        .select("id, title, subject_id, unit_id")
        .in("subject_id", chunk)
        .eq("status", "published")
        .order("title", { ascending: true }), { sort: orderComparator(["title", true]) })
    : { data: [] as { id: string; title: string; subject_id: string; unit_id: string | null }[] };
  // 수강 과목의 문서 ∪ 무료 공개 문서(수강 과목 안의 무료 문서는 이미 들어 있으므로 id로 중복 제거).
  const seen = new Set((enrolledDocs ?? []).map((d) => d.id));
  const docs = [
    ...(enrolledDocs ?? []),
    ...freeDocs.filter((d) => !seen.has(d.id)).map((d) => ({ id: d.id, title: d.title, subject_id: d.subjectId, unit_id: d.unitId })),
  ];

  const unitIds = Array.from(
    new Set(docs.map((d) => d.unit_id).filter((id): id is string => !!id))
  );
  const { data: units } = unitIds.length
    ? await selectInChunks(unitIds, (chunk) => supabase
        .from("subject_template_units")
        .select("id, unit_title")
        .in("id", chunk))
    : { data: [] as { id: string; unit_title: string }[] };
  const unitTitleById = new Map((units ?? []).map((u) => [u.id, u.unit_title]));

  const bySubject = new Map<string, LibraryDocSummary[]>();
  for (const d of docs) {
    const list = bySubject.get(d.subject_id) ?? [];
    list.push({
      id: d.id,
      title: d.title,
      unitTitle: d.unit_id ? unitTitleById.get(d.unit_id) ?? null : null,
    });
    bySubject.set(d.subject_id, list);
  }

  return Array.from(subjects.entries())
    .filter(([subjectId]) => (bySubject.get(subjectId) ?? []).length > 0)
    .map(([subjectId, subjectName]) => ({
      subjectId,
      subjectName,
      docs: bySubject.get(subjectId) ?? [],
    }));
}

export async function loadLibraryDoc(
  supabase: SupabaseClient,
  docId: string,
  studentId: string | null
): Promise<LibraryDocDetail | null> {
  const { data: doc } = await supabase
    .from("curriculum_docs")
    .select("id, title, kind, subject_id")
    .eq("id", docId)
    .eq("status", "published")
    .maybeSingle();
  if (!doc) return null;

  const kind = ((doc as { kind?: string }).kind === "pdf" || (doc as { kind?: string }).kind === "video"
    ? (doc as { kind: "pdf" | "video" }).kind
    : "html") as "html" | "pdf" | "video";

  // 파일 자료 — 과목 전체 보기는 **지금 공개본**을 쓴다(과거 수업은 당시 고정본).
  if (kind !== "html") {
    const { data: version } = await supabase
      .from("curriculum_doc_versions")
      .select("id, snapshot")
      .eq("curriculum_doc_id", docId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const snap = version?.snapshot as { asset?: { pageCount?: number; mimeType?: string } } | null;
    return {
      id: doc.id,
      title: doc.title,
      subjectId: doc.subject_id as string,
      sections: [],
      kind,
      asset: version
        ? {
            versionId: version.id as string,
            pageCount: typeof snap?.asset?.pageCount === "number" ? snap.asset.pageCount : null,
            mimeType: snap?.asset?.mimeType ?? (kind === "pdf" ? "application/pdf" : "video/mp4"),
          }
        : null,
    };
  }

  const { data: sections } = await supabase
    .from("curriculum_doc_sections")
    .select("id, position, title, body, teaching_tip")
    .eq("curriculum_doc_id", docId)
    .order("position", { ascending: true });

  const sectionIds = (sections ?? []).map((s) => s.id);
  const { data: problems } = sectionIds.length
    ? await selectInChunks(sectionIds, (chunk) => supabase
        .from("problems")
        .select(
          "id, format, passage, options, difficulty, skill_type, section_id"
        )
        .in("section_id", chunk)
        .eq("status", "confirmed"))
    : { data: [] as never[] };

  const problemIds = (problems ?? []).map((p) => p.id);
  // 정답·해설은 컬럼 권한이 회수돼 서버 admin 으로만 읽는다. 화면 노출은 호출부가 기존 규칙으로 가린다.
  const answers = await loadLegacyProblemAnswers(problemIds);

  const { data: attempts } = studentId && problemIds.length
    ? await selectInChunks(problemIds, (chunk) => supabase
        .from("session_problem_attempts")
        .select("problem_id, correct, response")
        .is("session_id", null)
        .eq("student_id", studentId)
        .in("problem_id", chunk))
    : { data: [] as { problem_id: string; correct: boolean | null; response: unknown }[] };

  function buildProblem(p: NonNullable<typeof problems>[number]): LibraryProblem {
    const attemptsForProblem = (attempts ?? []).filter(
      (a) => a.problem_id === p.id
    );
    const wrongCount = attemptsForProblem.filter((a) => a.correct === false).length;
    const correctAttempt = attemptsForProblem.find((a) => a.correct === true);
    const correct = correctAttempt ? true : wrongCount >= 3 ? false : null;
    const done = correct !== null;
    const lastResponse = attemptsForProblem.at(-1)?.response ?? null;

    return {
      id: p.id,
      format: p.format,
      passage: p.passage,
      options: p.options,
      correctIndex: answers.get(p.id)?.correctIndex ?? null,
      explanation: answers.get(p.id)?.explanation ?? "",
      difficulty: p.difficulty,
      skillType: p.skill_type,
      priorWrongCount: wrongCount,
      correct,
      done,
      submittedResponse:
        p.format !== "mc" && typeof lastResponse === "string" ? lastResponse : null,
    };
  }

  const problemsBySection = new Map<string, LibraryProblem[]>();
  (problems ?? []).forEach((p) => {
    const list = problemsBySection.get(p.section_id) ?? [];
    list.push(buildProblem(p));
    problemsBySection.set(p.section_id, list);
  });

  return {
    id: doc.id,
    title: doc.title,
    subjectId: doc.subject_id as string,
    kind,
    asset: null,
    sections: (sections ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      body: s.body ?? "",
      teachingTip: s.teaching_tip,
      problems: problemsBySection.get(s.id) ?? [],
    })),
  };
}
