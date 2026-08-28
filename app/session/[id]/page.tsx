import { notFound } from "next/navigation";
import {
  requireUser,
  getRoleHomePath,
  computeSessionViewState,
  type SessionViewViewer,
} from "@/lib/auth";
import SessionShell from "./SessionShell";
import { loadMaterialData } from "./material-data";
import { loadVocabWords } from "./vocab-data";
import { loadHomeworkItems } from "./homework-data";
import { loadUnitOptions } from "./aigen-data";
import { loadDocLinks, parseWhiteboardStrokes } from "./scratchpad-data";

function extractSubjectName(subject: unknown): string {
  const row = Array.isArray(subject) ? subject[0] : subject;
  return (row as { name?: string } | null)?.name ?? "";
}

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const { user, profile, supabase } = await requireUser();

  const { data: session } = await supabase
    .from("sessions")
    .select(
      "id, session_number, unit_title, status, scheduled_at, duration_minutes, enrollment_id, curriculum_doc_id, whiteboard_strokes"
    )
    .eq("id", id)
    .single();

  if (!session) notFound();

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("student_id, teacher_id, subject_id, subject:subjects(name)")
    .eq("id", session.enrollment_id)
    .single();

  if (!enrollment) notFound();

  const { data: people } = await supabase
    .from("profiles")
    .select("id, name")
    .in("id", [enrollment.student_id, enrollment.teacher_id]);

  const studentName =
    people?.find((p) => p.id === enrollment.student_id)?.name ?? "학생";

  let viewerRole: SessionViewViewer;
  if (user.id === enrollment.student_id) {
    viewerRole = "student";
  } else if (user.id === enrollment.teacher_id) {
    viewerRole = "teacher";
  } else if (profile?.role === "parent") {
    viewerRole = "parent";
  } else if (profile?.role === "admin") {
    viewerRole = "admin";
  } else {
    // RLS가 이미 막았어야 하는 경우지만, 방어적으로 한 번 더 확인.
    notFound();
  }

  const initialState = computeSessionViewState(
    session.status,
    session.scheduled_at,
    session.duration_minutes
  );

  const material = await loadMaterialData(
    supabase,
    session.curriculum_doc_id,
    session.id,
    enrollment.student_id
  );

  const vocabWords = await loadVocabWords(supabase, enrollment.student_id);
  const homeworkItems = await loadHomeworkItems(supabase, session.id);
  const unitOptions = await loadUnitOptions(supabase, enrollment.subject_id);
  const docLinks = await loadDocLinks(supabase, session.id);
  const whiteboardStrokes = parseWhiteboardStrokes(session.whiteboard_strokes);

  return (
    <SessionShell
      sessionId={session.id}
      studentId={enrollment.student_id}
      unitTitle={session.unit_title ?? `${session.session_number}회차`}
      subjectName={extractSubjectName(enrollment.subject)}
      studentName={studentName}
      sessionNumber={session.session_number}
      viewerRole={viewerRole}
      initialTab={tab}
      initialState={initialState}
      status={session.status}
      scheduledAt={session.scheduled_at}
      durationMinutes={session.duration_minutes}
      backHref={getRoleHomePath(profile?.role)}
      material={material}
      vocabWords={vocabWords}
      homeworkItems={homeworkItems}
      subjectId={enrollment.subject_id}
      unitOptions={unitOptions}
      docLinks={docLinks}
      whiteboardStrokes={whiteboardStrokes}
    />
  );
}
