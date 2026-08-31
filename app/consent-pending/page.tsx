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
          보호자 동의가 필요합니다
        </h1>
        <p className="text-[13.5px] text-grey-500 mb-6 leading-[1.6]">
          만 13세 미만 학생은 보호자의 동의가 확인되어야 서비스를 이용할 수
          있습니다.
          <br />
          {wasRevoked
            ? "이전에 등록된 보호자 동의가 철회되어 이용이 다시 제한된 상태입니다."
            : "아직 보호자 동의가 등록되지 않았습니다."}
        </p>

        <div className="rounded-lg bg-grey-100 p-4 mb-6 text-left text-[13px] text-grey-600 leading-[1.6]">
          {guardianNames.length > 0 ? (
            <p>
              등록된 보호자: <strong>{guardianNames.join(", ")}</strong>
            </p>
          ) : (
            <p>등록된 보호자 정보를 확인할 수 없습니다. 관리자에게 문의해주세요.</p>
          )}
          <p className="mt-1.5">
            {noticeDelivered
              ? "보호자에게 동의 관련 안내가 전달된 기록이 있습니다."
              : "보호자에게 아직 동의 요청 안내가 전달되지 않았습니다."}
          </p>
        </div>

        <p className="text-[12.5px] text-grey-400 mb-8 leading-[1.6]">
          보호자 계정으로 로그인해 동의 절차를 진행해주세요. 동의가
          완료되면 별도 절차 없이 정상적으로 서비스를 이용하실 수 있습니다.
        </p>

        <form action={logout}>
          <button
            type="submit"
            className="block w-full text-center bg-grey-200 text-ink font-bold text-[15px] py-3.5 rounded-lg hover:bg-grey-300"
          >
            로그아웃
          </button>
        </form>
        <a
          href="mailto:support@alton.education"
          className="block mt-4 text-[12.5px] text-grey-400 underline"
        >
          문의하기
        </a>
      </div>
    </main>
  );
}
