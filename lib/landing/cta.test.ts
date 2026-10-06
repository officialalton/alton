import { describe, expect, it } from "vitest";
import { resolveLandingDestinations, viewerFromAccount } from "./cta";

describe("resolveLandingDestinations", () => {
  it("비로그인", () => {
    const d = resolveLandingDestinations({ kind: "anonymous" });
    expect(d).toMatchObject({ freeLearning: "/signup/student", premium: "/premium-tutoring", consult: "/#consult", signedIn: false });
    expect(d.account.href).toBe("/login");
  });
  it("무료 학생", () => {
    expect(resolveLandingDestinations({ kind: "free_student" })).toMatchObject({ freeLearning: "/student?tab=mock-exam", consult: "/student/tutoring" });
  });
  it("과외 학생", () => {
    expect(resolveLandingDestinations({ kind: "tutoring_student" })).toMatchObject({ freeLearning: "/student?tab=mock-exam", consult: "/student?tab=consultant" });
  });
  it("학부모", () => {
    expect(resolveLandingDestinations({ kind: "parent" })).toMatchObject({ consult: "/parent?tab=consult" });
  });
  it("viewerFromAccount", () => {
    expect(viewerFromAccount("student", false)).toEqual({ kind: "free_student" });
    expect(viewerFromAccount("student", true)).toEqual({ kind: "tutoring_student" });
    expect(viewerFromAccount("teacher", false)).toEqual({ kind: "other", homePath: "/teacher" });
    expect(viewerFromAccount(null, false)).toEqual({ kind: "anonymous" });
  });
});
