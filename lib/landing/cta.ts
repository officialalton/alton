import { getRoleHomePath } from "@/lib/session-view";

// 2026-10-05 랜딩 v2 — 계정 상태별 CTA 목적지. 목적지를 한 곳에서만 정해 헤더·섹션·푸터가 어긋나지 않게 한다.
export type LandingViewer =
  | { kind: "anonymous" }
  | { kind: "free_student" }
  | { kind: "tutoring_student" }
  | { kind: "parent" }
  | { kind: "other"; homePath: string };

export type LandingDestinations = {
  /** 무료 학습 CTA(Start Free / Start Practicing…). */
  freeLearning: string;
  /** 무료 공개 학습자료 목록. */
  studyMaterials: string;
  premium: string;
  /** Request a Consultation. */
  consult: string;
  /** 헤더의 계정 링크: 로그인 전엔 로그인, 후엔 내 홈. */
  account: { href: string; label: string };
  signedIn: boolean;
};

export const PREMIUM_PATH = "/premium-tutoring";
export const PUBLIC_CONSULT_PATH = "/#consult";

export function resolveLandingDestinations(viewer: LandingViewer): LandingDestinations {
  switch (viewer.kind) {
    case "anonymous":
      return {
        freeLearning: "/signup/student",
        studyMaterials: "/signup/student",
        premium: PREMIUM_PATH,
        consult: PUBLIC_CONSULT_PATH,
        account: { href: "/login", label: "Log In" },
        signedIn: false,
      };
    case "free_student":
      return {
        freeLearning: "/student?tab=mock-exam",
        studyMaterials: "/student?tab=materials",
        premium: PREMIUM_PATH,
        consult: "/student/tutoring",
        account: { href: "/student", label: "My Dashboard" },
        signedIn: true,
      };
    case "tutoring_student":
      return {
        freeLearning: "/student?tab=mock-exam",
        studyMaterials: "/student?tab=materials",
        premium: PREMIUM_PATH,
        consult: "/student?tab=consultant",
        account: { href: "/student", label: "My Dashboard" },
        signedIn: true,
      };
    case "parent":
      return {
        freeLearning: "/parent",
        studyMaterials: "/parent",
        premium: PREMIUM_PATH,
        consult: "/parent?tab=consult",
        account: { href: "/parent", label: "My Dashboard" },
        signedIn: true,
      };
    case "other":
      return {
        freeLearning: viewer.homePath,
        studyMaterials: viewer.homePath,
        premium: PREMIUM_PATH,
        consult: PUBLIC_CONSULT_PATH,
        account: { href: viewer.homePath, label: "My Dashboard" },
        signedIn: true,
      };
  }
}

export function viewerFromAccount(role: string | null | undefined, hasTutoringAccess: boolean): LandingViewer {
  if (role === "student") return hasTutoringAccess ? { kind: "tutoring_student" } : { kind: "free_student" };
  if (role === "parent") return { kind: "parent" };
  const home = getRoleHomePath(role);
  return home === "/login" ? { kind: "anonymous" } : { kind: "other", homePath: home };
}
