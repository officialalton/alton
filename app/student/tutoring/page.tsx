import Link from "next/link";
import { requireStudentFeature } from "@/lib/feature-access";
import PageFrame from "@/app/components/PageFrame";
import { loadMyTutoringInterestStateAction } from "../tutoring-actions";
import TutoringInterestPanel from "./TutoringInterestPanel";

// 2026-10-05 무료 회원 S4 — 과외 안내 + 관심 등록·보호자 초대(브리프 §3.3·§3.6). 학생 대면 문구는 영어(오너 결정).
export default async function StudentTutoringPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  await requireStudentFeature("tutoring_info", { redirectTo: "/student" });
  const { from } = await searchParams;
  const state = await loadMyTutoringInterestStateAction();
  return (
    <div className="min-h-screen bg-cream">
      <PageFrame title="1:1 Tutoring">
        <div className="rounded-xl bg-white border border-brand-border p-6 mb-4">
          <p className="text-[12px] font-bold text-brand-red mb-1">ALTON PRIVATE INSTRUCTION</p>
          <h2 className="text-[20px] font-extrabold text-navy mb-2">Premium 1:1 Online Tutoring</h2>
          <p className="text-[15px] font-bold text-ink mb-2">Practice reveals the gaps. Expert instruction closes them.</p>
          <p className="text-[13.5px] text-grey-500 leading-[1.7] mb-4">
            ALTON pairs your practice-test data with expert tutors from Korea&apos;s top graduate programs to build a plan around your goals.
          </p>
          <ul className="text-[13.5px] text-grey-500 leading-[1.7] space-y-3">
            <li><strong className="text-ink">Precision Diagnostics.</strong> Your practice-test results reveal exactly where points are being lost.</li>
            <li><strong className="text-ink">Expert 1:1 Instruction.</strong> Live online lessons with a tutor matched to your target score and schedule.</li>
            <li><strong className="text-ink">Targeted Practice &amp; Progression.</strong> Homework and review built from your weak areas, adjusted as you improve.</li>
          </ul>
        </div>
        {state.kind === "tutoring_member" ? (
          <div className="rounded-xl bg-white border border-brand-border p-6">
            <p className="text-[13px] text-grey-500">You already have access to Alton tutoring.</p>
            <Link href="/student?tab=consultant" className="inline-block mt-4 px-4 py-2.5 rounded-lg border border-brand-border text-navy text-[13px] font-bold">
              Open consultant tab
            </Link>
          </div>
        ) : (
          <TutoringInterestPanel initialState={state} entryPoint={from === "result" ? "result_page" : from === "home" ? "home" : "tutoring_page"} />
        )}
        <Link href="/student" className="inline-block mt-4 text-[13px] text-grey-500 underline">
          Back to home
        </Link>
      </PageFrame>
    </div>
  );
}
