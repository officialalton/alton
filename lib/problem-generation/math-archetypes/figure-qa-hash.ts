// 시각 검수 판정의 유효성 — 조합(항목)별 '현재 생성기·렌더 코드 해시'. 코드가 바뀌면 판정이 무효(stale)가 되어 재검수 대상이다.
//   해시 대상 = 그 항목의 원형 정의 파일 + 공용 빌더·장면 풀 + 쓰는 렌더러(figure type 별) + 앱 그림 컴포넌트(ProblemFigure). easy/medium 틀 파일도 포함한다(같은 렌더 경로를 쓰므로 보수적으로).
//   한 파일이 여러 항목을 정의하므로 그 파일을 고치면 같은 파일의 모든 항목이 재검수 대상이 된다(보수적).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

export const QA_DIR = path.join("data", "mock-exam-generation", "figure-qa");
export const QA_HTML_DIR = path.join(QA_DIR, "_html");
const AR = "lib/problem-generation/math-archetypes";
const FG = "lib/problem-figures";
const COMMON = [`${AR}/figure-kit.ts`, `${AR}/figure-topics.ts`, `${AR}/skills/tvd-fig-levels.ts`, `${FG}/render.ts`, `${FG}/templates/_layout.ts`, "app/session/[id]/ProblemFigure.tsx", `${AR}/figure-qa-snapshot.test.ts`, `${AR}/figure-qa-samples.ts`, "scripts/mock-exam-generation/figure-qa-render.mjs"];
const RENDERER: Record<string, string[]> = { data: [`${FG}/templates/data.ts`], plane: [`${FG}/templates/coordinate-plane.ts`], figure_choice: [`${FG}/templates/figure-choice.ts`], figure_set: [`${FG}/templates/figure-choice.ts`] };

/** 항목 id → 원형 정의 파일(이 파일럿의 two_variable_data 자료 원형). 새 skill 파일이 생기면 여기에 규칙을 더한다. */
export function archetypeSourceFor(itemId: string): string[] {
  const [skill, kind, fig, loc] = itemId.split(".");
  if (skill !== "two_variable_data") throw new Error(`시각 검수 해시 규칙이 없는 skill: ${skill}`);
  if (loc === "C" || kind === "association_direction_strength") return [`${AR}/skills/tvd-fig-choice.ts`];
  if (fig === "TW") return [`${AR}/skills/tvd-fig-tables.ts`];
  return [`${AR}/skills/tvd-fig-lines.ts`];
}
export function sourceFilesFor(itemId: string, figureTypes: string[]): string[] {
  const set = new Set<string>([...archetypeSourceFor(itemId), ...COMMON]);
  for (const t of figureTypes) for (const f of RENDERER[t] ?? []) set.add(f);
  return [...set].sort();
}
export function codeHash(itemId: string, figureTypes: string[], root = process.cwd()): { hash: string; files: string[] } {
  const files = sourceFilesFor(itemId, figureTypes); const h = createHash("sha256");
  for (const f of files) { h.update(f); h.update("\0"); h.update(readFileSync(path.join(root, f))); h.update("\0"); }
  return { hash: h.digest("hex"), files };
}

// ── 판정 파일 ──
export type ReviewChecklistKey = "figure_present" | "proportion_matches_values" | "labels_placed_and_legible" | "multi_figure_consistent" | "text_matches_figure_and_solvable" | "axes_ticks_units_legend" | "choice_distinct_one_rule" | "sat_visual_style" | "mobile_375_readable";
export type ReviewFile = {
  itemId: string; verdict: "pass" | "defect"; reviewedAt: string; reviewer: string; codeHash: string; samples: string[];
  checklist: Record<ReviewChecklistKey, "pass" | "fail" | "n/a">; defects: { sample: string; check: ReviewChecklistKey | "other"; description: string }[]; notes?: string;
};
export const REVIEW_KEYS: ReviewChecklistKey[] = ["figure_present", "proportion_matches_values", "labels_placed_and_legible", "multi_figure_consistent", "text_matches_figure_and_solvable", "axes_ticks_units_legend", "choice_distinct_one_rule", "sat_visual_style", "mobile_375_readable"];
export type QaMeta = { itemId: string; generatedAt: string; codeHash: string; sources: string[]; samples: { file: string; mobileFile: string; archetypeId: string; seed: number; signature: string; stimulus: string; question: string; options: string[]; correctIndex: number; answer: string; explanation: string; structuralIssues: { code: string; message: string }[] }[] };
export type ReviewState = "pass" | "defect" | "missing" | "stale" | "snapshot_stale" | "no_snapshot" | "incomplete" | "unimplemented";
const readJson = <T,>(p: string): T | null => { try { return JSON.parse(readFileSync(p, "utf-8")) as T; } catch { return null; } };
export const metaPath = (itemId: string) => path.join(QA_DIR, `${itemId}.meta.json`);
export const reviewPath = (itemId: string) => path.join(QA_DIR, `${itemId}.review.json`);
export const loadMeta = (itemId: string, root = process.cwd()) => readJson<QaMeta>(path.join(root, metaPath(itemId)));
export const loadReview = (itemId: string, root = process.cwd()) => readJson<ReviewFile>(path.join(root, reviewPath(itemId)));

/** 현재 코드 해시 기준 검수 상태. */
export function reviewStatus(itemId: string, current: { hash: string }, root = process.cwd()): { state: ReviewState; detail: string; review?: ReviewFile } {
  const meta = loadMeta(itemId, root); if (!meta) return { state: "no_snapshot", detail: "조합 샘플 PNG·메타가 없다(스냅샷 도구를 실행해야 함)" };
  if (meta.codeHash !== current.hash) return { state: "snapshot_stale", detail: "스냅샷이 현재 생성기·렌더 코드 해시와 다르다 — 스냅샷을 다시 만들고 재검수해야 한다" };
  const rv = loadReview(itemId, root); if (!rv) return { state: "missing", detail: "검수 판정 파일이 없다" };
  if (rv.codeHash !== current.hash) return { state: "stale", detail: "판정 이후 생성기·렌더 코드가 바뀌어 판정이 무효다 — 재검수 대상", review: rv };
  const want = meta.samples.map((s) => s.file).sort().join("|"), got = [...rv.samples].sort().join("|");
  if (want !== got || REVIEW_KEYS.some((k) => !rv.checklist?.[k])) return { state: "incomplete", detail: "판정이 모든 샘플·모든 체크리스트 항목을 덮지 않는다", review: rv };
  if (rv.verdict !== "pass" || Object.values(rv.checklist).includes("fail") || rv.defects.length) return { state: "defect", detail: `결함 ${rv.defects.length}건: ${rv.defects.map((d) => d.description).join(" / ").slice(0, 160)}`, review: rv };
  return { state: "pass", detail: `${rv.reviewer} · ${rv.reviewedAt}`, review: rv };
}
