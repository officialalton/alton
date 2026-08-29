import { requireUser } from "@/lib/auth";
import { loadLibraryDoc } from "@/app/student/materials-data";
import LibraryDocView from "./LibraryDocView";
import type { SessionViewViewer } from "@/lib/session-view";

export default async function MaterialsLibraryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, profile, supabase } = await requireUser();

  const role = (profile?.role ?? "parent") as SessionViewViewer;
  const studentId = role === "student" ? user.id : null;

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

  return <LibraryDocView doc={doc} viewerRole={role} studentId={studentId} />;
}
