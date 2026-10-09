// 시각 검수 판정의 유효성 — 코드 해시가 바뀌면 판정이 무효가 되고, 판정이 없거나 불완전하면 게이트가 막는다.
import { FIG_HARD } from "./skills/fig";
import { afterAll, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { QA_DIR, REVIEW_KEYS, codeHash, metaPath, reviewPath, reviewStatus, sourceFilesFor, type QaMeta, type ReviewFile } from "./figure-qa-hash";
import { FIGURE_ITEMS } from "./figure-coverage-manifest";
import { qaItemIds, qaSamples } from "./figure-qa-samples";

const ITEM = "two_variable_data.scatter_equation.SC.P"; const TYPES = ["data"];
const root = mkdtempSync(path.join(tmpdir(), "qa-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const put = (rel: string, body: string) => { const f = path.join(root, rel); mkdirSync(path.dirname(f), { recursive: true }); writeFileSync(f, body); };
const seedSources = () => { for (const f of sourceFilesFor(ITEM, TYPES)) put(f, `// ${f} v1`); };
const checklist = Object.fromEntries(REVIEW_KEYS.map((k) => [k, "pass"])) as ReviewFile["checklist"];
const meta = (hash: string): QaMeta => ({ itemId: ITEM, generatedAt: "t", codeHash: hash, sources: [], samples: [{ file: `${ITEM}.png`, mobileFile: `${ITEM}.m375.png`, archetypeId: "x", seed: 11, signature: "data:scatter", stimulus: "s", question: "q", options: [], correctIndex: 0, answer: "1", explanation: "e", structuralIssues: [] }] });
const review = (hash: string, over: Partial<ReviewFile> = {}): ReviewFile => ({ itemId: ITEM, verdict: "pass", reviewedAt: "t", reviewer: "r", codeHash: hash, samples: [`${ITEM}.png`], checklist, defects: [], ...over });
const writeMeta = (m: QaMeta) => put(metaPath(ITEM), JSON.stringify(m)); const writeReview = (r: ReviewFile) => put(reviewPath(ITEM), JSON.stringify(r));

describe("코드 해시 — 생성기·렌더러가 바뀌면 판정이 무효가 된다", () => {
  it("원형 정의 파일·공용 빌더·렌더러·ProblemFigure 가 해시 대상이고, 한 파일만 바뀌어도 해시가 달라진다", () => {
    seedSources(); const files = sourceFilesFor(ITEM, TYPES);
    expect(files.some((f) => f.endsWith("skills/tvd-fig-lines.ts"))).toBe(true); expect(files.some((f) => f.endsWith("figure-kit.ts"))).toBe(true); expect(files.some((f) => f.endsWith("templates/data.ts"))).toBe(true); expect(files.some((f) => f.endsWith("ProblemFigure.tsx"))).toBe(true);
    const h1 = codeHash(ITEM, TYPES, root).hash; expect(codeHash(ITEM, TYPES, root).hash).toBe(h1);
    put("lib/problem-generation/math-archetypes/skills/tvd-fig-lines.ts", "// changed"); const h2 = codeHash(ITEM, TYPES, root).hash; expect(h2).not.toBe(h1);
    seedSources(); expect(codeHash(ITEM, TYPES, root).hash).toBe(h1);
    put("lib/problem-figures/templates/data.ts", "// renderer changed"); expect(codeHash(ITEM, TYPES, root).hash).not.toBe(h1);
  });
  it("쓰는 렌더러가 다르면 해시 대상 파일도 다르다(선택지형은 figure-choice 포함)", () => { expect(sourceFilesFor(ITEM, ["figure_choice", "plane"]).some((f) => f.endsWith("figure-choice.ts"))).toBe(true); expect(sourceFilesFor(ITEM, ["data"]).some((f) => f.endsWith("figure-choice.ts"))).toBe(false); });
});

describe("검수 상태 — pass/defect/missing/stale/snapshot_stale/no_snapshot/incomplete", () => {
  it("스냅샷이 없으면 no_snapshot", () => { const r2 = mkdtempSync(path.join(tmpdir(), "qa2-")); expect(reviewStatus(ITEM, { hash: "h" }, r2).state).toBe("no_snapshot"); rmSync(r2, { recursive: true, force: true }); });
  it("판정이 없으면 missing", () => { seedSources(); const h = codeHash(ITEM, TYPES, root).hash; writeMeta(meta(h)); rmSync(path.join(root, reviewPath(ITEM)), { force: true }); expect(reviewStatus(ITEM, { hash: h }, root).state).toBe("missing"); });
  it("해시가 같고 모든 샘플·항목을 덮고 결함이 없으면 pass", () => { const h = codeHash(ITEM, TYPES, root).hash; writeMeta(meta(h)); writeReview(review(h)); expect(reviewStatus(ITEM, { hash: h }, root).state).toBe("pass"); });
  it("판정 이후 코드가 바뀌면 stale(스냅샷이 현재 코드와 다르면 snapshot_stale) — 재검수 대상", () => {
    const h = codeHash(ITEM, TYPES, root).hash; writeMeta(meta(h)); writeReview(review(h));
    put("lib/problem-generation/math-archetypes/figure-kit.ts", "// generator helper changed"); const h2 = codeHash(ITEM, TYPES, root).hash; expect(h2).not.toBe(h);
    expect(reviewStatus(ITEM, { hash: h2 }, root).state).toBe("snapshot_stale"); // 스냅샷(meta)이 옛 해시
    writeMeta(meta(h2)); expect(reviewStatus(ITEM, { hash: h2 }, root).state).toBe("stale"); // 스냅샷만 다시 만들었고 판정은 옛 해시
    writeReview(review(h2)); expect(reviewStatus(ITEM, { hash: h2 }, root).state).toBe("pass");
  });
  it("판정이 샘플 일부·체크리스트 항목 일부만 덮으면 incomplete", () => {
    const h = codeHash(ITEM, TYPES, root).hash; writeMeta(meta(h)); writeReview(review(h, { samples: [] })); expect(reviewStatus(ITEM, { hash: h }, root).state).toBe("incomplete");
    const cl = { ...checklist } as Record<string, string>; delete cl.sat_visual_style; writeReview(review(h, { checklist: cl as ReviewFile["checklist"] })); expect(reviewStatus(ITEM, { hash: h }, root).state).toBe("incomplete");
  });
  it("결함이 있거나 체크리스트에 fail 이 있으면 defect", () => {
    const h = codeHash(ITEM, TYPES, root).hash; writeMeta(meta(h));
    writeReview(review(h, { verdict: "defect", defects: [{ sample: `${ITEM}.png`, check: "proportion_matches_values", description: "추세선이 격자점을 지나지 않는다" }], checklist: { ...checklist, proportion_matches_values: "fail" } })); const st = reviewStatus(ITEM, { hash: h }, root); expect(st.state).toBe("defect"); expect(st.detail).toContain("추세선");
    writeReview(review(h, { checklist: { ...checklist, sat_visual_style: "fail" } })); expect(reviewStatus(ITEM, { hash: h }, root).state).toBe("defect");
  });
});

describe("매니페스트 전체 — 검수 상태 열은 조합 303개를 모두 덮는다", () => {
  it("파일럿 15조합에는 샘플이 있고(선택지형·복수 자료 포함), 샘플 id 는 조합 id 로 시작한다", () => {
    const ids = qaItemIds(); expect(ids.filter((id) => id.startsWith("two_variable_data.") && !FIG_HARD.some((a) => a.figureItem === id))).toHaveLength(15); expect(ids.length).toBeGreaterThanOrEqual(15); for (const id of ids) { expect(FIGURE_ITEMS.some((r) => r.id === id), id).toBe(true); const ss = qaSamples(id); expect(ss.length, id).toBeGreaterThan(0); for (const s of ss) expect(s.file.startsWith(id)).toBe(true); }
    expect(qaSamples("two_variable_data.association_direction_strength.SC.P").length).toBe(2); // 단일 산점도 + figure_set(Plot A/B)
    expect(QA_DIR).toContain("figure-qa");
  });
  it("1단계 조합(skills/fig/items)의 해시 대상은 그 조합 파일 하나 + DSL·표 키트 + 공용(파일럿 규칙은 그대로)", () => {
    const id = "linear_functions.evaluate.TB.P"; const fs = sourceFilesFor(id, ["data"]);
    expect(fs).toContain(`lib/problem-generation/math-archetypes/skills/fig/items/${id}.ts`); expect(fs.some((f) => f.endsWith("table-kit.ts"))).toBe(true);
    expect(fs.some((f) => f.includes("items/") && !f.endsWith(`${id}.ts`))).toBe(false); // 다른 조합 파일을 고쳐도 이 조합 판정은 유지된다
    expect(sourceFilesFor(ITEM, TYPES)).toContain("lib/problem-generation/math-archetypes/skills/tvd-fig-lines.ts");
  });
});
