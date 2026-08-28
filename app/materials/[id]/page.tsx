import { requireUser } from "@/lib/auth";
import { loadLibraryDoc } from "@/app/student/materials-data";
import LibraryDocView from "./LibraryDocView";

export default async function MaterialsLibraryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const doc = await loadLibraryDoc(supabase, id);

  if (!doc) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <p className="text-[14px] text-grey-500">
          교재를 찾을 수 없습니다.
        </p>
      </div>
    );
  }

  return <LibraryDocView doc={doc} />;
}
