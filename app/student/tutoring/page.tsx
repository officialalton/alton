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
          <p className="text-[12px] font-bold text-brand-red mb-1">ALTON 1:1 Tutoring</p>
          <h2 className="text-[20px] font-extrabold text-navy mb-3">Talk with a tutor</h2>
          <ul className="text-[13.5px] text-grey-500 leading-[1.8] list-disc pl-5 mb-2">
            <li>1:1 online SAT/AP lessons with tutors from Korea&apos;s top graduate programs</li>
            <li>A personalized plan and homework built from your practice-test results and weak areas</li>
            <li>How it works: free consultation with a consultant → trial lesson → regular lessons</li>
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
