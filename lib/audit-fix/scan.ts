// DB 현재 공개 버전에 대한 결함 스캔(순수 함수): 빈칸 뒤 중복, 목표 문장 이중 표시, 평면 그림 교점 창 밖. 기계적으로 고칠 수 있는 것만 패치 후보를 만든다.
import { blankJunctionIssues } from "./plan";

export type ScanRow = { problem_id: string; version_id: string; gid: string | null; passage: string | null; question: string | null; options: string[] | null; correct_index: number | null; figure: unknown; sets: string[] };
export type ScanPatch = { id: string; problemId: string; expectVersionId: string; why: string; changes: { field: string; old: unknown; new: unknown }[]; kind: "sat" };
export type ScanFinding = { problemId: string; gid: string | null; sets: string[]; kind: "completion_duplicate" | "question_in_stimulus" | "intersection_off_axes"; detail: string; patch: ScanPatch | null; review: string | null };

const tok = (t: string) => t.toLowerCase().split(/\s+/).map((w) => w.replace(/[^a-z0-9']/g, "")).filter(Boolean);

/** 모든 선택지가 같은 마지막 k 단어로 끝나고 빈칸 뒤 글이 그 k 단어로 시작하면, 그 k 단어를 빈칸 뒤 글에서 지운다(기계 패치). 일부 선택지만 겹치면 null(사람이 본다). */
export function trimDuplicateContinuation(passage: string, options: string[]): { passage: string; removed: string } | { review: string } | null {
  const m = passage.match(/_{3,}/);
  if (!m || m.index === undefined) return null;
  const head = passage.slice(0, m.index + m[0].length); const after = passage.slice(m.index + m[0].length);
  const issues = blankJunctionIssues(passage, options);
  if (!issues.length) return null;
  // literal punctuation right after the blank that every option already ends with
  const afterTrim = after.replace(/^\s+/, "");
  const p = afterTrim[0];
  if (p && /[,;:]/.test(p) && options.every((o) => o.trim().endsWith(p))) return { passage: head + " " + afterTrim.slice(1).replace(/^\s+/, ""), removed: p };
  const ow = options.map((o) => tok(o));
  const at = tok(after).slice(0, 6);
  for (let k = Math.min(6, ...ow.map((x) => x.length), at.length); k >= 1; k--) {
    const tails = new Set(ow.map((x) => x.slice(-k).join(" ")));
    if (tails.size === 1 && at.slice(0, k).join(" ") === [...tails][0]) {
      // remove the first k words (with their original spelling/punctuation) from the continuation
      const re = new RegExp(`^(\\s*)(?:\\S+\\s+){${k - 1}}\\S+`);
      const rest = after.replace(re, "");
      if (rest === after) return { review: "could not remove the duplicated words from the continuation" };
      return { passage: head + rest, removed: at.slice(0, k).join(" ") };
    }
  }
  return { review: issues.join("; ") };
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
/** 지문(stimulus)에 질문 문장이 그대로 들어 있으면 지문에서 지운다(기계 패치). */
export function stripQuestionFromPassage(passage: string, question: string): string | null {
  const q = norm(question); if (q.length < 25) return null;
  const i = norm(passage).indexOf(q); if (i < 0) return null;
  // work on the raw passage: remove the raw occurrence allowing flexible whitespace
  const esc = q.split(" ").map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
  const re = new RegExp(esc);
  if (!re.test(passage)) return null;
  const out = passage.replace(re, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return out && out !== passage.trim() ? out : null;
}

type Line = { slope: number; intercept: number };
const planeLines = (fig: unknown): Line[] | null => {
  const f = fig as { type?: string; objects?: { kind?: string; slope?: number; intercept?: number; through?: [[number, number], [number, number]] }[] } | null;
  if (!f || f.type !== "plane" || !Array.isArray(f.objects)) return null;
  const out: Line[] = [];
  for (const o of f.objects) {
    if (o.kind !== "line") continue;
    if (typeof o.slope === "number" && typeof o.intercept === "number") out.push({ slope: o.slope, intercept: o.intercept });
    else if (Array.isArray(o.through) && o.through.length === 2 && o.through.every((q) => Array.isArray(q) && q.length === 2 && q.every((n) => typeof n === "number"))) {
      const [[a, b], [c, d]] = o.through; if (a === c) continue; const m = (d - b) / (c - a); out.push({ slope: m, intercept: b - m * a });
    }
  }
  return out;
};
/** 두 직선 연립 그림: 교점이 그려진 축 범위 밖이면 그 좌표를 돌려준다. */
export function intersectionOffAxes(fig: unknown): { x: number; y: number } | null {
  const lines = planeLines(fig); if (!lines || lines.length !== 2) return null;
  const [l1, l2] = lines; if (Math.abs(l1.slope - l2.slope) < 1e-12) return null;
  const x = (l2.intercept - l1.intercept) / (l1.slope - l2.slope); const y = l1.slope * x + l1.intercept;
  const ax = (fig as { axes: { x: { min: number; max: number }; y: { min: number; max: number } } }).axes;
  if (ax.x.min >= 0 && ax.y.min >= 0) return null; // first-quadrant word-problem windows (cost/time lines) may cut the crossing on purpose; only full-plane system figures are flagged
  return x < ax.x.min || x > ax.x.max || y < ax.y.min || y > ax.y.max ? { x, y } : null;
}

export function scanRows(rows: ScanRow[], existingPatchProblemIds: Set<string>): ScanFinding[] {
  const out: ScanFinding[] = [];
  for (const r of rows) {
    const base = { problemId: r.problem_id, gid: r.gid, sets: r.sets };
    if (r.passage && /_{3,}/.test(r.passage) && r.options && r.options.length >= 2) {
      const iss = blankJunctionIssues(r.passage, r.options);
      if (iss.length) {
        const t = trimDuplicateContinuation(r.passage, r.options);
        const covered = existingPatchProblemIds.has(r.problem_id);
        if (t && "passage" in t) out.push({ ...base, kind: "completion_duplicate", detail: `${iss[0]} — remove "${t.removed}"${covered ? " (already in the patch list)" : ""}`, patch: covered ? null : { id: `SCAN-R-${r.problem_id.slice(0, 8)}`, problemId: r.problem_id, expectVersionId: r.version_id, why: `blank continuation repeats the options' final words ("${t.removed}")`, changes: [{ field: "passage", old: r.passage, new: t.passage }], kind: "sat" }, review: null });
        else out.push({ ...base, kind: "completion_duplicate", detail: iss.join("; "), patch: null, review: covered ? "already in the patch list" : t && "review" in t ? t.review : "options disagree on the repeated words (needs a human rewrite)" });
      }
    }
    if (r.passage && r.question) {
      const np = stripQuestionFromPassage(r.passage, r.question);
      if (np && !existingPatchProblemIds.has(r.problem_id)) out.push({ ...base, kind: "question_in_stimulus", detail: "stimulus repeats the question sentence", patch: { id: `SCAN-D-${r.problem_id.slice(0, 8)}`, problemId: r.problem_id, expectVersionId: r.version_id, why: "question sentence is already part of the stimulus (shown twice)", changes: [{ field: "passage", old: r.passage, new: np }], kind: "sat" }, review: null });
    }
    const off = intersectionOffAxes(r.figure);
    if (off) out.push({ ...base, kind: "intersection_off_axes", detail: `lines meet at (${off.x.toFixed(2)}, ${off.y.toFixed(2)}) outside the drawn axes`, patch: null, review: existingPatchProblemIds.has(r.problem_id) ? "already in the patch list (F-*)" : "widen the axes (figure edit)" });
  }
  return out;
}
