import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { logout } from "@/app/login/actions";

/**
 * R2 Task 6 §5: 13세 미만 미동의 학생이 로그인 시 도달하는 제한 화면.
 * requireUser()를 쓰지 않는다 — requireUser()는 이 계정을 계속 여기로
 * 리다이렉트하므로, 여기서 또 requireUser()를 부르면 무한 리다이렉트가
 * 된다(account-pending/account-suspended와 동일 패턴).
 *
 * 허용 기능은 동의 상태 안내 · 보호자 통지 여부 · 로그아웃 · 최소한의
 * 개인정보/문의 링크뿐이다 — 메시지·과제·문제풀이·업로드·화이트보드·
 * 세션 참여·예약 등 다른 모든 기능은 이 페이지에서 노출하지 않는다.
 */
export default async function ConsentPendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: household } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", user.id)
    .eq("role", "child")
    .maybeSingle();

  let guardianNames: string[] = [];
  if (household) {
    const { data: guardianRows } = await supabase
      .from("household_members")
      .select("profile_id, profiles(name)")
      .eq("household_id", household.household_id)
      .eq("role", "guardian");
    guardianNames = (guardianRows ?? [])
      .map((row) => (row.profiles as unknown as { name: string } | null)?.name)
      .filter((name): name is string => Boolean(name));
  }

  const { data: latestConsent } = await supabase
    .from("guardian_consents")
    .select("notice_delivered_at, consented_at, revoked_at")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const noticeDelivered = Boolean(latestConsent?.notice_delivered_at);
  const wasRevoked = Boolean(latestConsent?.revoked_at);

  return (
    <main className="min-h-screen bg-grey-100 flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-[460px] rounded-[14px] bg-white p-11 shadow-[0_1px_3px_rgba(0,0,0,0.06)] text-center">
        <div className="font-extrabold text-lg tracking-[0.02em] text-ink mb-1.5">
          ALTON <span className="text-red">EDUCATION</span>
        </div>
        <h1 className="text-[21px] font-extrabold text-ink mb-3">
          Parent or guardian consent required
        </h1>
        <p className="text-[13.5px] text-grey-500 mb-6 leading-[1.6]">
          Students under 13 need a parent or guardian&apos;s consent before using
          the service.
          <br />
          {wasRevoked
            ? "A previously recorded consent was withdrawn, so access is restricted again."
            : "No parent or guardian consent has been recorded yet."}
        </p>

        <div className="rounded-lg bg-grey-100 p-4 mb-6 text-left text-[13px] text-grey-600 leading-[1.6]">
          {guardianNames.length > 0 ? (
            <p>
              Parent/guardian on file: <strong>{guardianNames.join(", ")}</strong>
            </p>
          ) : (
            <p>We couldn&apos;t find a parent or guardian on file. Please contact support.</p>
          )}
          <p className="mt-1.5">
            {noticeDelivered
              ? "A consent request has been sent to your parent or guardian."
              : "A consent request has not been sent to your parent or guardian yet."}
          </p>
        </div>

        <p className="text-[12.5px] text-grey-400 mb-8 leading-[1.6]">
          Ask your parent or guardian to log in to their account and complete the
          consent step. Once it&apos;s done, you can use the service right away.
        </p>

        <form action={logout}>
          <button
            type="submit"
            className="block w-full text-center bg-grey-200 text-ink font-bold text-[15px] py-3.5 rounded-lg hover:bg-grey-300"
          >
            Log out
          </button>
        </form>
        <a
          href="mailto:support@alton.education"
          className="block mt-4 text-[12.5px] text-grey-400 underline"
        >
          Contact support
        </a>
      </div>
    </main>
  );
}
