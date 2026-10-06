// POLICY-DECISIONS: 관리자 포털 제외 전부 영어(미국 타겟) — 고객 화면 소스에 한글 리터럴 금지
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const SCAN = [
  "app/student", "app/parent", "app/about", "app/contact", "app/consult", "app/privacy", "app/terms",
  "app/premium-tutoring", "app/practice-tests", "app/learning-tools", "app/under-13-notice",
  "app/page.tsx", "app/LandingView.tsx", "app/ConsultForm.tsx", "app/landing-icons.tsx",
];
// 허용: 한국어 해설 토글 라벨(해설은 영어 기본+한국어 토글), 서버 에러 메시지 매칭(화면에 표시되지 않음).
const ALLOW = [">한국어<", "한국어\n", '"제출된 모듈"', '"제출한 시험"'];
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
      if (!/\.tsx$/.test(f) || /\.test\.tsx$/.test(f)) continue;
      const lines = stripComments(readFileSync(path.join(root, f), "utf8")).split("\n");
      lines.forEach((l, i) => {
        if (!HANGUL.test(l)) return;
        const rest = ALLOW.reduce((t, a) => t.split(a.trim()).join(""), l);
        if (HANGUL.test(rest)) offenders.push(`${f}:${i + 1}: ${l.trim().slice(0, 80)}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
