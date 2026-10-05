import { describe, expect, it } from "vitest";
import {
  STUDENT_TERMS_VERSION,
  ageOnDate,
  isPendingFreeSignup,
  pendingFreeSignupDestination,
  readSignupMetadata,
  validateStudentSignup,
} from "./free-member-signup";

const TODAY = new Date(Date.UTC(2026, 9, 5)); // 2026-10-05

const base = {
  name: " 김학생 ",
  email: "Student@Example.com",
  password: "altonpass1",
  birthdate: "2010-05-01",
  grade: "10학년",
  school: "",
  termsAccepted: true,
};

describe("ageOnDate", () => {
  it("UTC 날짜 기준 만 나이, 생일 전날은 한 살 적다", () => {
    expect(ageOnDate("2013-10-05", TODAY)).toBe(13);
    expect(ageOnDate("2013-10-06", TODAY)).toBe(12);
    expect(ageOnDate("2013-02-30", TODAY)).toBeNull();
    expect(ageOnDate("not-a-date", TODAY)).toBeNull();
  });
});

describe("validateStudentSignup", () => {
  it("정상 입력은 소문자 이메일·trim된 이름·self_signup 표식·약관 버전을 가진 metadata를 만든다", () => {
    const r = validateStudentSignup(base, TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.email).toBe("student@example.com");
    expect(r.metadata).toEqual({
      signup_source: "self_signup",
      name: "김학생",
      birthdate: "2010-05-01",
      grade: "10학년",
      school: null,
      terms_version: STUDENT_TERMS_VERSION,
    });
  });

  it("만 13세 미만은 차단하고 상담 경로를 안내한다(생일 당일은 허용)", () => {
    const under = validateStudentSignup({ ...base, birthdate: "2013-10-06" }, TODAY);
    expect(under).toMatchObject({ ok: false, field: "birthdate" });
    expect((under as { message: string }).message).toContain("보호자가 상담");
    expect(validateStudentSignup({ ...base, birthdate: "2013-10-05" }, TODAY).ok).toBe(true);
  });

  it("약한 비밀번호(8자 미만·영문/숫자 미포함)를 거절한다", () => {
    expect(validateStudentSignup({ ...base, password: "abc1234" }, TODAY)).toMatchObject({ ok: false, field: "password" });
    expect(validateStudentSignup({ ...base, password: "abcdefgh" }, TODAY)).toMatchObject({ ok: false, field: "password" });
    expect(validateStudentSignup({ ...base, password: "12345678" }, TODAY)).toMatchObject({ ok: false, field: "password" });
  });

  it("이름·이메일 형식·학년·약관 동의는 필수, 학교는 선택", () => {
    expect(validateStudentSignup({ ...base, name: "  " }, TODAY)).toMatchObject({ ok: false, field: "name" });
    expect(validateStudentSignup({ ...base, email: "nope" }, TODAY)).toMatchObject({ ok: false, field: "email" });
    expect(validateStudentSignup({ ...base, grade: "" }, TODAY)).toMatchObject({ ok: false, field: "grade" });
    expect(validateStudentSignup({ ...base, termsAccepted: false }, TODAY)).toMatchObject({ ok: false, field: "termsAccepted" });
    const withSchool = validateStudentSignup({ ...base, school: " Seoul Intl " }, TODAY);
    expect(withSchool.ok && withSchool.metadata.school).toBe("Seoul Intl");
  });
});

describe("isPendingFreeSignup / readSignupMetadata / pendingFreeSignupDestination", () => {
  const confirmed = {
    email_confirmed_at: "2026-10-05T00:00:00Z",
    user_metadata: { signup_source: "self_signup", name: "김학생", birthdate: "2010-05-01", grade: "10학년", terms_version: "2026-10-05" },
  };

  it("표식+이메일 확인이 있어야 대기 가입자다", () => {
    expect(isPendingFreeSignup(confirmed)).toBe(true);
    expect(isPendingFreeSignup({ ...confirmed, email_confirmed_at: null })).toBe(false);
    expect(isPendingFreeSignup({ ...confirmed, user_metadata: { name: "고아 계정" } })).toBe(false);
    expect(isPendingFreeSignup(null)).toBe(false);
  });

  it("metadata에 필수 값이 비면 null(fail-closed)", () => {
    expect(readSignupMetadata(confirmed)).toMatchObject({ name: "김학생", school: null });
    expect(readSignupMetadata({ ...confirmed, user_metadata: { ...confirmed.user_metadata, grade: "" } })).toBeNull();
  });

  it("프로필이 이미 있으면 null, 표식 없는 프로필 없는 계정도 null(기존 fail-closed 유지)", () => {
    expect(pendingFreeSignupDestination(confirmed, true)).toBeNull();
    expect(pendingFreeSignupDestination(confirmed, false)).toBe("/signup/student/complete");
    expect(pendingFreeSignupDestination({ email_confirmed_at: "x", user_metadata: {} }, false)).toBeNull();
  });
});
