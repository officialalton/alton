import { requireUser } from "@/lib/auth";

/** Shown to a teacher whose agreement has been sent but is not signed yet. English-only teacher-facing text. */
export default async function TeacherAgreementNotice() {
  const { user, supabase } = await requireUser();
  const { data } = await supabase
    .from("teacher_contracts")
    .select("id")
    .eq("teacher_id", user.id)
    .eq("status", "sent")
    .in("docusign_envelope_status", ["sent", "delivered"])
    .not("agreement_form", "is", null)
    .limit(1);
  if (!data || data.length === 0) return null;
  return (
    <div role="status" data-testid="teacher-agreement-notice" className="bg-amber-50 text-ink text-[13px] px-5 py-3 border-b border-grey-200">
      Your ALTON Teacher Agreement is waiting for your signature. Please check your ALTON email inbox for the DocuSign message and sign it.
    </div>
  );
}
