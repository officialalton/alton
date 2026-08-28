import { requireUser } from "@/lib/auth";
import { loadSessionReviewContext, loadExistingReview } from "./review-data";
import TeacherReviewPanel from "./TeacherReviewPanel";

export default async function TeacherReviewPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { supabase } = await requireUser();
  const { sessionId } = await params;

  const context = await loadSessionReviewContext(supabase, sessionId);
  if (!context) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <p className="text-[14px] text-grey-500">세션을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const existingReview = await loadExistingReview(supabase, sessionId);

  return <TeacherReviewPanel context={context} existingReview={existingReview} />;
}
