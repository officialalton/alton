import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { test, expect, devices } from "@playwright/test";
import { loginAs, ACCOUNTS } from "./helpers";

// 모바일 응시 화면 — 터치 하이라이트·오류 신고 시트·44px 탭 영역·가로 스크롤 없음.
// SHOTS_DIR 이 있으면 화면 캡처를 저장한다(before/after 비교용). 세트·배정은 psql 로 직접 만든다.

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const SHOTS = process.env.SHOTS_DIR;
const BEFORE = process.env.BEFORE === "1";
const ex = (BEFORE ? expect.soft : expect) as typeof expect;

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}

const PASSAGE =
  "Marine biologists studying coral reefs have long observed that the symbiotic algae living inside coral tissue provide most of the energy the coral needs. When ocean temperatures rise, the coral expels these algae, a process known as bleaching, and the reef becomes pale and vulnerable. Recent surveys suggest that some reefs recover faster than expected when nearby populations of herbivorous fish keep competing seaweed in check.";

const profiles = { "iPhone 14": devices["iPhone 14"], "Pixel 7": devices["Pixel 7"] } as const;

test.describe.configure({ mode: "serial" });

for (const [name, profile] of Object.entries(profiles)) {
  test.describe(`모바일 응시 — ${name}`, () => {
    // WebKit 이 설치돼 있지 않아 크로미엄 위에 기기 프로필(뷰포트·UA·터치)만 얹는다.
    const { defaultBrowserType: _ignored, ...device } = profile;
    void _ignored;
    test.use(device);
    let attemptId: string;
    const slug = name.replace(/\s/g, "").toLowerCase();

    test.beforeAll(() => {
      const setId = psql(
        `insert into mock_exam_sets (name, difficulty_tier, status, format, module_item_counts, created_by)
         values ('E2E MOBILE ${Date.now()}', 'standard', 'draft', 'mst', '{"rw_m1":2,"rw_m2":2,"math_m1":2,"math_m2":2}', '${ADMIN_ID}') returning id;`,
      );
      const plan = [
        ["rw_m1", "rw", 1, "mc", "rw_craft_structure"], ["rw_m1", "rw", 2, "mc", "rw_craft_structure"],
        ["rw_m2", "rw", 3, "mc", "rw_information_ideas"], ["rw_m2", "rw", 4, "mc", "rw_information_ideas"],
        ["math_m1", "math", 1, "mc", "algebra"], ["math_m1", "math", 2, "spr", "algebra"],
        ["math_m2", "math", 3, "mc", "advanced_math"], ["math_m2", "math", 4, "spr", "advanced_math"],
      ] as const;
      plan.forEach(([key, section, pos, format, domain], i) => {
        const pid = psql(
          `insert into problems (format, passage, subject_id, status, created_by, sat_domain) values ('${format}', '${PASSAGE}', '${SUBJECT_ID}', 'confirmed', '${TEACHER_ID}', '${domain}') returning id;`,
        );
        const content = format === "mc" ? `options = '["Coral reefs recover only when fish populations decline","Herbivorous fish may help bleached reefs recover","Warm water causes algae to multiply inside coral","Seaweed is the main energy source for coral"]'::jsonb, correct_index = 1` : `answers = '["3.25","13/4"]'::jsonb`;
        psql(`select set_config('alton.version_content_edit', 'on', true); update problem_versions set ${content}, question = 'Which choice best states the main idea of the text? (${i + 1})', explanation = 'E2E explanation', render_check = '{"ok":true,"issues":[]}'::jsonb, explanation_en = 'E2E explanation', difficulty = 'medium', status = 'published', published_at = now() where problem_id = '${pid}' and version_no = 1;`);
        const vid = psql(`select id from problem_versions where problem_id = '${pid}' and version_no = 1;`);
        psql(`insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, difficulty, module_key) values ('${setId}', '${section}', ${pos}, '${pid}', '${vid}', '${domain}', 'medium', '${key}');`);
      });
      expect(psql(`select (mock_exam_validate_mst_set('${setId}')->>'ready');`)).toBe("true");
      psql(`update mock_exam_sets set readiness_status = 'ready', readiness_checked_at = now() where id = '${setId}';`);
      psql(`update mock_exam_sets set status = 'published' where id = '${setId}';`);
      attemptId = psql(`insert into mock_exam_attempts (student_id, exam_set_id, status) values ('${STUDENT_ID}', '${setId}', 'assigned') returning id;`);
      if (SHOTS) mkdirSync(SHOTS, { recursive: true });
    });

    test("레이아웃·탭 영역·터치 하이라이트·오류 신고", async ({ page }) => {
      const shot = async (n: string) => {
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${slug}-${n}.png` });
      };
      await loginAs(page, ACCOUNTS.student);
      await page.goto(`/student/mock-exam/${attemptId}`);
      await shot("00-start");
      await page.getByTestId("mst-start").click();
      await ex(page.getByTestId("mst-qbar")).toBeVisible();
      await shot("01-question");

      // 가로 스크롤 없음
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      ex(overflow).toBeLessThanOrEqual(0);

      // 탭 영역 44px
      for (const sel of ['[data-testid="mst-highlight-toggle"]', '[data-testid="mst-eliminate-toggle"]', '[data-testid="mst-whiteboard-toggle"]', '[data-testid="problem-error-report"] button', '[data-testid="mst-submit-module"]', 'button[aria-label="Next question"]', 'nav[aria-label="Question navigator"] button']) {
        const box = await page.locator(sel).first().boundingBox();
        ex(box, sel).not.toBeNull();
        ex(Math.min(box!.width, box!.height), sel).toBeGreaterThanOrEqual(43.5);
      }

      // 선택지·소거
      await page.getByTestId("mst-eliminate-toggle").tap();
      await page.getByRole("radio").nth(0).tap();
      await shot("02-eliminate");
      await page.getByTestId("mst-eliminate-toggle").tap();

      // 터치 하이라이트: 롱프레스 선택 핸들 → selectionchange 만 발생(mouseup 없음)
      await page.getByTestId("mst-highlight-toggle").tap();
      await page.evaluate(() => {
        const root = document.querySelector('[data-testid="annotation-root"]')!;
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let n: Node | null;
        while ((n = w.nextNode())) {
          if ((n.textContent ?? "").includes("symbiotic algae")) break;
        }
        const t = n as Text;
        const i = t.data.indexOf("symbiotic algae");
        const r = document.createRange();
        r.setStart(t, i);
        r.setEnd(t, i + "symbiotic algae".length);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(r);
        document.dispatchEvent(new Event("selectionchange"));
      });
      await ex.poll(() => page.evaluate(() => (CSS as unknown as { highlights: Map<string, { size: number }> }).highlights.get("exam-annot")?.size ?? 0)).toBeGreaterThan(0);
      await shot("03-highlight");

      // 오류 신고 시트
      await page.getByTestId("problem-error-report").getByRole("button").first().tap();
      const form = page.getByRole("form", { name: /report/i }).or(page.locator("form[aria-label]").first());
      await ex(form).toBeVisible();
      const fb = await form.boundingBox();
      const vp = page.viewportSize()!;
      ex(fb!.x).toBeGreaterThanOrEqual(0);
      ex(fb!.x + fb!.width).toBeLessThanOrEqual(vp.width + 0.5);
      ex(fb!.y + fb!.height).toBeLessThanOrEqual(vp.height + 0.5);
      await shot("04-report-open");
      await form.locator('input[type="radio"]').first().check();
      await form.locator("textarea").tap();
      const fontSize = await form.locator("textarea").evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
      ex(fontSize).toBeGreaterThanOrEqual(16);
      await ex(form.locator('button[type="submit"]')).toBeVisible();
      await shot("05-report-filled");
      await form.getByRole("button").filter({ hasText: /cancel/i }).tap();

      // 다음 문항 → 마지막 문항 하단 막대
      await page.getByRole("button", { name: "Next question" }).tap();
      await shot("06-q2");
    });
  });
}
