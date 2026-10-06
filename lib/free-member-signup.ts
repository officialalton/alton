/**
 * 2026-10-05 무료 학습 회원 셀프 가입(S1) — 가입 폼·확인 화면·프로비저닝 액션이 공유하는 순수 모듈.
 * 설계: docs/briefs/2026-10-05-free-member-tutoring-design.md §3.2. DB 쪽 최종 방어는
 * provision_free_member()(20262100000000)이고, 여기 검증은 왕복 없이 한국어 오류를 먼저 돌려주기 위한 층이다.
 *
 * 프로비저닝 표식 설계(브리프 §3.2 (c)·고아 Auth 계정 fail-closed 유지):
 *   - 공개 가입 폼은 supabase.auth.signUp()의 user_metadata에 SIGNUP_SOURCE_FLAG(signup_source='self_signup')와
 *     폼 입력(name/birthdate/grade/school/terms_version)을 넣는다.
 *   - 이메일 확인 후 서버는 getUser()(Auth 서버가 검증한 사용자)의 metadata에서 이 표식을 읽어
 *     provision_free_member RPC를 호출한다. 역할은 metadata에서 읽지 않는다(RPC가 student/free 고정).
 *   - 표식이 없는 "프로필 없는 Auth 계정"(체험 온보딩·초대 경로의 고아 계정)은 종전대로
 *     resolveAccountDestination()의 unknown → 로그아웃 처리를 그대로 받는다.
 *   - 표식 위조로 얻을 수 있는 것은 공개 폼으로도 얻는 무료 계정뿐이므로 서명 쿠키는 두지 않는다
 *     (다른 기기에서 확인 메일을 열어도 진행 가능해야 한다는 요구와도 맞다).
 */

export const STUDENT_TERMS_VERSION = "2026-10-06-v2";

export const SIGNUP_SOURCE_FLAG = { key: "signup_source", value: "self_signup" } as const;

export const MIN_SIGNUP_AGE = 13;
export const MIN_PASSWORD_LENGTH = 8;

export type StudentSignupInput = {
  name: string;
  email: string;
  password: string;
  birthdate: string; // YYYY-MM-DD
  grade: string;
  school?: string | null;
  termsAccepted: boolean;
};

export type StudentSignupMetadata = {
  signup_source: "self_signup";
  name: string;
  birthdate: string;
  grade: string;
  school: string | null;
  terms_version: string;
};

/** 만 나이(UTC 날짜 기준, DB is_under_13·provision_free_member와 같은 규칙). */
export function ageOnDate(birthdate: string, today: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdate);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const birth = new Date(Date.UTC(y, mo - 1, d));
  if (birth.getUTCFullYear() !== y || birth.getUTCMonth() !== mo - 1 || birth.getUTCDate() !== d) return null;
  const ty = today.getUTCFullYear();
  const tm = today.getUTCMonth();
  const td = today.getUTCDate();
  let age = ty - y;
  if (tm < mo - 1 || (tm === mo - 1 && td < d)) age -= 1;
  return age;
}

export type SignupValidation =
  | { ok: true; metadata: StudentSignupMetadata; email: string; password: string }
  | { ok: false; field: keyof StudentSignupInput; message: string };

export function validateStudentSignup(input: StudentSignupInput, today: Date = new Date()): SignupValidation {
  const name = input.name.trim();
  if (!name) return { ok: false, field: "name", message: "Please enter your name." };
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, field: "email", message: "Please enter a valid email address." };
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, field: "password", message: `Your password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (!/[A-Za-z]/.test(input.password) || !/\d/.test(input.password)) {
    return { ok: false, field: "password", message: "Your password must include both letters and numbers." };
  }
  const age = ageOnDate(input.birthdate, today);
  if (age === null) return { ok: false, field: "birthdate", message: "Please enter a valid date of birth." };
  if (age < 0) return { ok: false, field: "birthdate", message: "That date of birth is not valid." };
  if (age < MIN_SIGNUP_AGE) {
    return {
      ok: false,
      field: "birthdate",
      message: `You must be at least ${MIN_SIGNUP_AGE} to sign up on your own. A parent or guardian can request a consultation instead.`,
    };
  }
  const grade = input.grade.trim();
  if (!grade) return { ok: false, field: "grade", message: "Please enter your grade." };
  if (!input.termsAccepted) return { ok: false, field: "termsAccepted", message: "Please agree to the Terms of Service and Privacy Policy." };
  const school = (input.school ?? "").trim();
  return {
    ok: true,
    email,
    password: input.password,
    metadata: {
      signup_source: "self_signup",
      name,
      birthdate: input.birthdate,
      grade,
      school: school || null,
      terms_version: STUDENT_TERMS_VERSION,
    },
  };
}

type AuthUserLike = {
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

/** 셀프 가입 표식이 있고 이메일이 확인된 Auth 사용자인가(프로필 유무는 호출자가 본다). */
export function isPendingFreeSignup(user: AuthUserLike | null | undefined): boolean {
  if (!user || !user.email_confirmed_at) return false;
  return user.user_metadata?.[SIGNUP_SOURCE_FLAG.key] === SIGNUP_SOURCE_FLAG.value;
}

/** metadata에서 RPC 인자를 꺼낸다. 표식이 없거나 필수 값이 비면 null(호출자는 fail-closed). */
export function readSignupMetadata(user: AuthUserLike | null | undefined): StudentSignupMetadata | null {
  if (!isPendingFreeSignup(user)) return null;
  const m = user!.user_metadata ?? {};
  const name = typeof m.name === "string" ? m.name.trim() : "";
  const birthdate = typeof m.birthdate === "string" ? m.birthdate : "";
  const grade = typeof m.grade === "string" ? m.grade.trim() : "";
  const school = typeof m.school === "string" && m.school.trim() ? m.school.trim() : null;
  const terms_version = typeof m.terms_version === "string" ? m.terms_version : "";
  if (!name || !birthdate || !grade || !terms_version) return null;
  return { signup_source: "self_signup", name, birthdate, grade, school, terms_version };
}

/** 로그인/post-auth에서 프로필 없는 사용자를 어디로 보낼지. 셀프 가입 대기자만 완료 화면으로. */
export const FREE_SIGNUP_COMPLETE_PATH = "/signup/student/complete";

export function pendingFreeSignupDestination(user: AuthUserLike | null | undefined, hasProfile: boolean): string | null {
  if (hasProfile) return null;
  return isPendingFreeSignup(user) ? FREE_SIGNUP_COMPLETE_PATH : null;
}
