// POLICY-DECISIONS: 관리자 포털 제외 전부 영어(미국 타겟) — 고객 화면 소스에 한글 리터럴 금지
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const SCAN = [
  "app/student", "app/parent", "app/about", "app/contact", "app/consult", "app/privacy", "app/terms",
  "app/premium-tutoring", "app/practice-tests", "app/learning-tools", "app/under-13-notice",
  "app/page.tsx", "app/LandingView.tsx", "app/ConsultForm.tsx", "app/landing-icons.tsx",
  // 2026-10-07 확장: 인증·세션뷰·예약 링크·초대 진입점과 고객에게 에러 문구가 노출되는 lib 모듈.
  "app/login", "app/signup", "app/reset-password", "app/set-password", "app/complete-profile", "app/schedule",
  "app/guardian-link", "app/invite", "app/consent-pending", "app/account-pending", "app/account-suspended",
  "app/post-auth", "app/session", "app/unit-preview", "app/materials",
  "app/api/invite", "app/api/trial-onboarding", "app/components/MobileDrawerNav.tsx",
  "lib/board/data.ts", "lib/booking/authorization.ts", "lib/booking/create-booking.ts", "lib/booking/overlap-errors.ts",
  "lib/booking/calendar-sync.ts", "lib/problem-error-reports/actions.ts",
  "lib/timezone-actions.ts", "lib/student-stats/metrics.ts", "lib/subject-material-library.ts",
  "lib/legacy-problem-answers.ts", "lib/feature-access.ts",
];
// 허용: 한국어 해설 토글 라벨(해설은 영어 기본+한국어 토글), 서버 에러 메시지 매칭(화면에 표시되지 않음).
const ALLOW = [">한국어<", "한국어\n", '"제출된 모듈"', '"제출한 시험"'];
// 허용 줄: DB/RPC 가 던지는 한국어 원문을 알아보는 매처(.includes/.test/.match)와 DB 값 키(저장된 한국어 enum).
const ALLOW_LINE = [
  /\.(includes|test|match)\(/,
  /가-힣ㄱ-ㆎ/, // 단어 문자 정규식(한글 단어 클릭 지원)
  /console\.(log|warn|error|info)\(/, // 로그
  // 운영자(관리자 예약 정합성 화면·로그)용 내부 오류 — 고객 화면에는 매핑된 영어 문구만 나간다.
  /teacher_freebusy_conflict: |workspace_email이|계정 정보를 찾을 수|계정에 이메일이 없|계정 이메일이 아직 검증/,
  /REASONS = \[|REASON_LABEL|reasons\.includes|"기타"/, // ProblemLogTab 사유 DB 값(화면에는 REASON_LABEL 영어 표시)
  /description: "학생 단어장에 저장할/, // AI 도구 내부 설명(화면 비노출)
  /student_feature_access 조회 실패|startsWith/, // 사용 안 함(자리 표시)
];
const HANGUL = /[가-힣]/;

function walk(p: string): string[] {
  const abs = path.join(root, p);
  if (statSync(abs).isFile()) return [p];
  return readdirSync(abs).flatMap((n) => walk(path.join(p, n)));
}
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

describe("customer-facing source has no Korean string literals", () => {
  it("only allowlisted tokens appear outside comments/tests", () => {
    const offenders: string[] = [];
    for (const f of SCAN.flatMap(walk)) {
      if (!/\.tsx?$/.test(f) || /\.test\.tsx?$/.test(f) || /integration/.test(f)) continue;
      const lines = stripComments(readFileSync(path.join(root, f), "utf8")).split("\n");
      lines.forEach((l, i) => {
        if (!HANGUL.test(l) || ALLOW_LINE.some((re) => re.test(l))) return;
        const rest = ALLOW.reduce((t, a) => t.split(a.trim()).join(""), l);
        if (HANGUL.test(rest)) offenders.push(`${f}:${i + 1}: ${l.trim().slice(0, 80)}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
