import { requireUser } from "@/lib/auth";
import { loadLibraryDoc } from "@/app/student/materials-data";
import { loadChildren } from "@/app/parent/children-data";
import { buildSubjectMaterialTree, findAdjacentDocs } from "@/lib/subject-material-library";
import LibraryDocView from "./LibraryDocView";
import { redactProblem } from "./redact";
import type { SessionViewViewer } from "@/lib/session-view";

export default async function MaterialsLibraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ childId?: string }>;
}) {
  const { id } = await params;
  const { childId } = await searchParams;
  const { user, profile, supabase } = await requireUser();

  const role = (profile?.role ?? "parent") as SessionViewViewer;
  // 2026-09-15 — 과목별 전체 교재 보기: 보호자는 자녀를 골라 그 자녀 기준으로 정답·해설
  // 노출 여부(done/submittedResponse)를 판정한다. childId는 신뢰하지 않고, 이 보호자의
  // 실제 자녀인지 먼저 확인한다(다른 학생 진행 상태를 URL 조작으로 엿보지 못하게).
  let studentId: string | null = role === "student" ? user.id : null;
  if (role === "parent" && childId) {
    const children = await loadChildren(supabase, user.id);
    if (children.some((c) => c.studentId === childId)) studentId = childId;
  }

  const doc = await loadLibraryDoc(supabase, id, studentId);

  if (!doc) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <p className="text-[14px] text-grey-500">
          교재를 찾을 수 없습니다.
        </p>
      </div>
    );
  }

  const isTeacherLike = role === "teacher" || role === "admin";
  const redactedDoc = {
    ...doc,
    sections: doc.sections.map((s) => ({
      ...s,
      problems: s.problems.map((p) =>
        redactProblem(
          p,
          isTeacherLike || p.done || !!p.submittedResponse
        )
      ),
    })),
  };

  // 이전/다음 자료 — 이 교재가 속한 과목 하나만 트리로 만들어 순서를 찾는다.
  const [tree] = await buildSubjectMaterialTree(supabase, [doc.subjectId]);
  const { prev, next } = tree ? findAdjacentDocs([tree], id) : { prev: null, next: null };
  const adjacentHref = (docId: string) => (childId ? `/materials/${docId}?childId=${childId}` : `/materials/${docId}`);

  // 읽던 위치(HTML만, 본인 기준 — 보호자가 자녀 화면을 볼 때도 보호자 자신의 위치를 쓴다).
  let initialSectionId: string | null = null;
  if (doc.kind === "html") {
    const { data: pos } = await supabase
      .from("material_reading_positions")
      .select("section_id")
      .eq("user_id", user.id)
      .eq("curriculum_doc_id", id)
      .maybeSingle();
    const sectionId = (pos as { section_id: string | null } | null)?.section_id ?? null;
    // 재공개로 섹션 구성이 바뀌어 더는 없는 위치를 가리키면 무시한다(깨진 위치로 스크롤하지 않음).
    initialSectionId = sectionId && doc.sections.some((s) => s.id === sectionId) ? sectionId : null;
  }

  return (
    <LibraryDocView
      doc={redactedDoc}
      viewerRole={role}
      prevDoc={prev ? { id: prev.id, title: prev.title, href: adjacentHref(prev.id) } : null}
      nextDoc={next ? { id: next.id, title: next.title, href: adjacentHref(next.id) } : null}
      initialSectionId={initialSectionId}
    />
  );
}
