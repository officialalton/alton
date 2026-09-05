import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { logout } from "@/app/login/actions";
import CompleteProfileForm from "./CompleteProfileForm";

/**
 * M4 UAT #2 — 학생 최초 로그인 직후(비밀번호 설정 이후) 반드시 거쳐야 하는
 * 필수 프로필 완성 화면. requireUser()를 쓰지 않는다 — requireUser()는 이미
 * 완료된 학생만 여길 통과시키지 않게 돼 있어(lib/auth.ts
 * resolveAccountDestination), 여기서 또 requireUser()를 부르면 무한
 * 리다이렉트가 된다(account-pending/consent-pending과 동일 패턴).
 *
 * 완료 후에는 이 페이지로 다시 오지 않는다 — profile_completed_at이 채워지면
 * resolveAccountDestination()이 정상 학생 홈으로 보낸다. 이미 완료된 학생이
 * 직접 URL로 들어오면 학생 홈으로 되돌려보낸다(건너뛰기 화면이 아니라 일회성
 * 필수 단계이므로 다시 열람하지 않음).
 */
export default async function CompleteProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, date_of_birth")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "student") {
    redirect("/post-auth");
  }

  const { data: student } = await supabase
    .from("students")
    .select(
      "school_name, grade, sat_score, gpa, target_colleges, intended_majors, profile_completed_at"
    )
    .eq("id", user.id)
    .single();

  if (student?.profile_completed_at) {
    redirect("/student");
  }

  const [{ data: apCourses }, { data: activities }] = await Promise.all([
    supabase
      .from("student_ap_courses")
      .select("id, course_name, status, exam_year, score")
      .eq("student_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("student_extracurricular_activities")
      .select("id, activity_name, description, start_date, end_date, is_ongoing")
      .eq("student_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  return (
    <main className="min-h-screen bg-grey-100 flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-[560px] rounded-[14px] bg-white p-11 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="text-center font-extrabold text-lg tracking-[0.02em] text-ink mb-1.5">
          ALTON <span className="text-red">EDUCATION</span>
        </div>
        <h1 className="text-center text-[21px] font-extrabold text-ink mb-2">
          프로필을 완성해주세요
        </h1>
        <p className="text-center text-[13.5px] text-grey-500 mb-8 leading-[1.6]">
          아래 정보를 입력해야 학생 포털을 이용할 수 있습니다.
          <br />
          최초 1회만 진행되며, 이후 필요 시 정보를 다시 수정할 수 있습니다.
        </p>

        <CompleteProfileForm
          hasDateOfBirth={Boolean(profile?.date_of_birth)}
          initialSchoolName={student?.school_name ?? ""}
          initialGrade={student?.grade ?? ""}
          initialSatScore={student?.sat_score ?? 0}
          initialGpa={student?.gpa ?? null}
          initialTargetColleges={student?.target_colleges ?? []}
          initialIntendedMajors={student?.intended_majors ?? []}
          initialApCourses={apCourses ?? []}
          initialActivities={activities ?? []}
        />

        <form action={logout} className="mt-6">
          <button
            type="submit"
            className="block w-full text-center text-grey-500 text-[12.5px] py-2 hover:underline"
          >
            로그아웃
          </button>
        </form>
      </div>
    </main>
  );
}
