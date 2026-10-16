// 외부 감사 수정 계획(순수 함수, DB·네트워크 없음). 패치 목록 + DB 읽기 결과(readout) → 문항 새 버전 계획 → 세트 새 버전 계획.
// 규칙: 선택지는 글자(A~D)가 아니라 "텍스트"로 대조한다(position-fix 가 DB 선택지 순서를 섞었다). 이미 같은 내용이면 건너뛰고(멱등), 기대한 옛 값과 다르면 사람이 본다(needs_owner).
// SQL 생성은 sql.ts, 실행은 scripts/audit/apply-audit-fixes.ts(총괄이 service 권한으로 SQL 파일만 실행).
import { checkFigure, type RenderCheck } from "../problem-figures/check";
import { validateFigureSpec } from "../problem-figures/spec";
import { checkContent } from "../problem-content-check";
import { composeProblemText } from "../problem-question";

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
export const FIELDS = ["passage", "question", "options", "correct_index", "answers", "explanation", "explanation_en", "figure", "statements"] as const;
export type Field = (typeof FIELDS)[number];

export type PatchChange = { field: string; old?: unknown; new?: unknown; /** 문자열 필드 부분 치환(전체 새 문안 대신). from 이 정확히 한 번 있어야 한다. */ ops?: { from: string; to: string }[] };
export type Patch = { id: string; gid?: string; /** gid 로 못 찾는 항목(DB 해설 오류 등)용 직접 지정. */ problemId?: string; /** AP 문항(FRQ 번들) 매칭 키. */ apCandidateKey?: string; expectVersionId?: string; changes: PatchChange[]; why?: string; validation?: string; routeNote?: string; kind?: "sat" | "ap" };
export type Overrides = Record<string, { keyText?: string; explanation?: string; explanation_en?: string; figure?: unknown; skip?: string; note?: string }>;

export type VersionRow = {
  id: string; problem_id?: string; version_no: number; status: string; passage: string | null; question: string | null; options: string[] | null; correct_index: number | null; answers: unknown;
  explanation: string | null; explanation_en: string | null; difficulty: string | null; figure: unknown; figure_checked: boolean | null; statements: unknown; render_check: unknown; quality: Record<string, unknown> | null;
  evidence_target: string | null; evidence_span: string | null; answer_rationale: string | null; distractor_error_types: unknown;
};
export type Placement = { set_id: string; set_name: string; set_version: number; set_status: string; format: string; section: string; position: number; module_key: string | null; route: string | null; item_version_id: string };
export type ProblemReadout = {
  gid?: string | null; problem_id: string; published_version_id: string | null; pstatus: string; pformat: string; usage_scope: string; exam_system: string | null; skill_code?: string | null;
  ap_candidate_key?: string | null; ap_item_index?: number | null;
  versions: { id: string; no: number; status: string }[]; pub: VersionRow | null; placements: Placement[] | null;
};

export type FullArgs = {
  passage: string | null; question: string | null; options: string[] | null; correct_index: number | null; answers: unknown; explanation: string | null; explanation_en: string | null; difficulty: string | null;
  figure: unknown; figure_checked: boolean; statements: unknown; evidence_target: string | null; evidence_span: string | null; answer_rationale: string | null; distractor_error_types: unknown;
};
export type Status = "apply" | "already" | "needs_owner" | "not_in_db" | "blocked";
export type PatchPlan = {
  patchId: string; gid: string | null; problemId: string | null; status: Status; reasons: string[]; warnings: string[];
  fromVersionId: string | null; fromVersionNo: number | null;
  changed: Field[]; before: Partial<Record<Field, unknown>>; after: Partial<Record<Field, unknown>>;
  expect: Record<string, unknown>; set: Record<string, unknown>; target: Record<string, unknown>; args: FullArgs | null; renderCheck: RenderCheck | null; quality: Record<string, unknown> | null; auditFix: Record<string, unknown> | null;
  placements: Placement[]; ap?: { candidate_key: string; item_index: number };
};

const eq = (a: unknown, b: unknown) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
function canon(v: unknown): unknown { if (Array.isArray(v)) return v.map(canon); if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, canon(x)])); return v ?? null; }
const norm = (s: unknown) => (typeof s === "string" ? s.replace(/\r\n/g, "\n").trim() : s);
const HANGUL = /[ㄱ-ㆎ가-힣]/;
const BLANK = /_{3,}/g;

/** 학생 화면 텍스트에서 구분자 $ 쌍이 맞는가(이스케이프 \$ 제외). */
export function mathDelimitersBalanced(text: string | null | undefined): boolean {
  if (!text) return true;
  const t = text.replace(/\\\$/g, "").replace(/\$\$/g, "");
  return (t.match(/\$/g)?.length ?? 0) % 2 === 0;
}

export { blankJunctionIssues } from "../problem-blank-junction";
import { blankJunctionIssues } from "../problem-blank-junction";

/** 정답 선택지 글자를 선언하는 문장(해설)에서 글자들을 뽑는다. 키 글자와 다르면 해설이 거짓이 된다. */
export function statedAnswerLetters(text: string | null | undefined): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const m of text.matchAll(/(?:answer is(?: choice| option)?|correct answer is(?: choice| option)?|the answer is)\s+\(?([A-D])\b/g)) out.push(m[1]);
  for (const m of text.matchAll(/(?:Therefore|So),?\s+\(?([A-D])\)? is (?:correct|the answer)/g)) out.push(m[1]);
  for (const m of text.matchAll(/정답은\s*([A-D])/g)) out.push(m[1]);
  for (const m of text.matchAll(/(?:^|[^A-Za-z])([A-D])(?:이|가) 맞다/g)) out.push(m[1]);
  return out;
}

function applyOps(cur: string, ops: { from: string; to: string }[]): { ok: true; value: string; already: boolean } | { ok: false; why: string } {
  let v = cur; let already = true;
  for (const op of ops) {
    const n = v.split(op.from).length - 1;
    if (n === 1) { v = v.replace(op.from, () => op.to); already = false; }
    else if (n === 0 && op.to && v.includes(op.to)) continue; // 이미 적용됨
    else return { ok: false, why: `치환 대상 문구가 ${n}번 나옵니다(1번이어야 함): "${op.from.slice(0, 60)}"` };
  }
  return { ok: true, value: v, already };
}

export type PlanOpts = { overrides?: Overrides; repoOptions?: string[] | null; now?: string; skillCode?: string | null };

/** 패치 하나를 DB 의 현재 공개 버전에 대조해 계획한다. */
export function planPatch(patch: Patch, pr: ProblemReadout | null, opts: PlanOpts = {}): PatchPlan {
  const base: PatchPlan = { patchId: patch.id, gid: patch.gid ?? null, problemId: pr?.problem_id ?? null, status: "apply", reasons: [], warnings: [], fromVersionId: pr?.published_version_id ?? null, fromVersionNo: pr?.pub?.version_no ?? null, changed: [], before: {}, after: {}, expect: {}, set: {}, target: {}, args: null, renderCheck: null, quality: null, auditFix: null, placements: [] };
  const ov = opts.overrides?.[patch.id];
  if (ov?.skip) return { ...base, status: "needs_owner", reasons: [`skipped: ${ov.skip}`] };
  if (!pr || !pr.pub) return { ...base, status: "not_in_db", reasons: ["문항이 DB 공개 버전으로 없음(문제은행에 임포트되지 않았거나 gid/본문이 다름)"] };
  const cur = pr.pub;
  if (patch.expectVersionId && cur.id !== patch.expectVersionId) return { ...base, status: "needs_owner", reasons: [`현재 공개 버전(${cur.id})이 기대한 버전(${patch.expectVersionId})과 다름`] };
  if (pr.pstatus !== "confirmed") return { ...base, status: "blocked", reasons: [`problem status=${pr.pstatus}`] };
  if (pr.versions.some((v) => v.status === "draft" || v.status === "in_review")) return { ...base, status: "blocked", reasons: ["이미 진행 중인 초안/검수 버전이 있음(save_problem_draft_version 이 그 초안을 덮어쓴다)"] };

  const curVals: Record<Field, unknown> = { passage: cur.passage, question: cur.question, options: cur.options, correct_index: cur.correct_index, answers: cur.answers ?? null, explanation: cur.explanation, explanation_en: cur.explanation_en, figure: cur.figure ?? null, statements: cur.statements ?? null };
  const next: Record<Field, unknown> = { ...curVals };
  const reasons: string[] = []; const warnings: string[] = [];
  let alreadyAll = true; let anyChange = false;
  const mark = (f: Field, before: unknown, after: unknown) => { base.changed.push(f); base.before[f] = before; base.after[f] = after; anyChange = true; alreadyAll = false; };

  // 선택지: 텍스트 대응(옛 → 새)으로 DB 순서를 유지한 채 바꾼다.
  const optCh = patch.changes.find((c) => c.field === "options");
  const keyCh = patch.changes.find((c) => c.field === "correct_index");
  let newKeyText: string | null = null;
  if (optCh) {
    const oldO = optCh.old as string[], newO = optCh.new as string[]; const dbO = cur.options ?? [];
    const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join("\u0000") === [...b].sort().join("\u0000");
    if (sameSet(dbO, newO) && !sameSet(dbO, oldO)) { /* already */ }
    else if (sameSet(dbO, oldO)) {
      const sub = new Map<string, string>(); oldO.forEach((o, i) => { if (o !== newO[i]) sub.set(o, newO[i]); });
      const out = dbO.map((o) => sub.get(o) ?? o);
      next.options = out; mark("options", dbO, out);
      const k = cur.correct_index; if (k == null || k < 0 || k >= dbO.length) reasons.push("DB 정답 번호가 범위 밖");
      else newKeyText = sub.get(dbO[k]) ?? dbO[k];
    } else reasons.push(`DB 선택지가 패치의 옛/새 선택지와 텍스트 집합이 다름: ${JSON.stringify(dbO)}`);
  }
  const optionsNow = (next.options as string[] | null) ?? cur.options ?? [];
  if (keyCh) {
    // 정답 번호는 DB 순서에서 정답 "텍스트"로 정한다(키 텍스트는 override 또는 옛 정답 선택지 텍스트).
    const kt = ov?.keyText ?? newKeyText;
    if (!kt) reasons.push("정답 번호 변경은 정답 텍스트(overrides.keyText)가 필요");
    else { const idx = optionsNow.indexOf(kt); if (idx < 0) reasons.push(`새 정답 텍스트가 DB 선택지에 없음: ${kt}`); else if (idx !== cur.correct_index) { next.correct_index = idx; mark("correct_index", cur.correct_index, idx); } }
  } else if (newKeyText && optionsNow.indexOf(newKeyText) !== cur.correct_index) { next.correct_index = optionsNow.indexOf(newKeyText); mark("correct_index", cur.correct_index, next.correct_index); }

  // 나머지 필드
  for (const c of patch.changes) {
    const f = c.field as Field;
    if (f === "options" || f === "correct_index") continue;
    if (!(FIELDS as readonly string[]).includes(f)) { reasons.push(`알 수 없는 필드 ${c.field}`); continue; }
    const curV = curVals[f];
    const over = f === "explanation" ? ov?.explanation : f === "explanation_en" ? ov?.explanation_en : f === "figure" ? ov?.figure : undefined;
    let newV: unknown = over ?? c.new;
    if (c.ops) {
      const r = applyOps(String(curV ?? ""), c.ops);
      if (!r.ok) { reasons.push(`${f}: ${r.why}`); continue; }
      if (r.already) continue;
      newV = r.value;
    } else {
      if (eq(norm(curV), norm(newV))) continue; // 이미 반영됨
      const stringy = f === "explanation" || f === "explanation_en";
      if (!stringy && !eq(norm(curV), norm(c.old))) { reasons.push(`${f}: 현재 DB 값이 패치의 옛 값과 다름(수동 확인 필요)`); continue; }
      if (stringy && !eq(norm(curV), norm(c.old))) warnings.push(`${f}: DB 해설이 패치 옛 값과 다름(해설 재작성·백필 반영됨) — 패치의 새 문안으로 전체 교체, 아래 diff 확인`);
    }
    next[f] = newV; mark(f, curV, newV);
  }
  if (reasons.length) return { ...base, status: "needs_owner", reasons, warnings, changed: [], before: {}, after: {} };
  if (!anyChange) return { ...base, status: "already", reasons: ["이미 패치 내용이 반영돼 있음"], warnings, changed: [], before: {}, after: {}, placements: (pr.placements ?? []).filter((p) => p.set_status === "published") };

  // ── 기계 검증 ────────────────────────────────────────────
  const ap = pr.ap_candidate_key ? { candidate_key: pr.ap_candidate_key, item_index: pr.ap_item_index ?? 0 } : undefined;
  const nO = next.options as string[] | null; const nK = next.correct_index as number | null;
  const blocks: string[] = [];
  if (pr.pformat === "mc") {
    if (!nO || nO.length < 2) blocks.push("선택지 2개 미만");
    else {
      const t = nO.map((o) => o.trim().toLowerCase());
      if (t.some((x) => !x)) blocks.push("빈 선택지");
      if (new Set(t).size !== t.length) blocks.push("선택지 중복");
      if (nK == null || nK < 0 || nK >= nO.length) blocks.push("정답 번호 범위 밖");
    }
  }
  if (cur.passage && base.changed.includes("passage") && (cur.passage.match(BLANK)?.length ?? 0) !== ((next.passage as string | null)?.match(BLANK)?.length ?? 0)) blocks.push("빈칸(______) 개수가 바뀜");
  for (const f of ["passage", "question", "explanation", "explanation_en"] as const) if (base.changed.includes(f) && !mathDelimitersBalanced(next[f] as string | null)) blocks.push(`${f}: 수식 구분자 $ 쌍이 안 맞음`);
  if (base.changed.some((f) => f === "passage" || f === "question" || f === "options") && HANGUL.test([next.passage, next.question, ...(nO ?? [])].filter(Boolean).join(" "))) blocks.push("학생 화면 텍스트에 한글");
  if (!String(next.explanation_en ?? "").trim()) blocks.push("영어 해설 비어 있음");
  if (HANGUL.test(String(next.explanation_en ?? ""))) blocks.push("영어 해설에 한글");
  if (nO && nK != null && pr.pformat === "mc" && (base.changed.includes("explanation") || base.changed.includes("explanation_en") || base.changed.includes("correct_index") || base.changed.includes("options"))) {
    const L = "ABCD"[nK];
    for (const f of ["explanation", "explanation_en"] as const) { const letters = statedAnswerLetters(next[f] as string | null); if (letters.some((x) => x !== L)) blocks.push(`${f}: 해설이 정답을 ${letters.join("/")} 로 말하지만 DB 정답 글자는 ${L}`); }
  }
  if (base.changed.includes("passage") && nO && /_{3,}/.test(String(next.passage))) {
    const before = blankJunctionIssues(String(curVals.passage ?? ""), cur.options ?? []);
    const after = blankJunctionIssues(String(next.passage), nO);
    if (after.length) blocks.push(`빈칸 뒤 중복 남음: ${after.join("; ")}`);
    else if (!before.length && String(patch.id).startsWith("R-")) warnings.push("옛 지문에서는 빈칸 중복이 기계적으로 검출되지 않았음(패치 검토)");
  }
  // 렌더 검사(저장·공개 게이트와 같은 함수)
  const figureToSave = next.figure == null ? null : (() => { const fv = validateFigureSpec(next.figure); return fv.ok ? fv.spec : next.figure; })();
  const fullText = composeProblemText(next.passage as string | null, next.question as string | null);
  const figCheck = checkFigure(figureToSave, fullText, nO, nK);
  const contentIssues = checkContent({ format: pr.pformat, passage: fullText, options: nO, correctIndex: nK, explanation: String(next.explanation ?? ""), answers: (next.answers as string[] | null) ?? null, statements: pr.pformat === "mc" ? (next.statements as string[] | null) : null, skillCode: opts.skillCode ?? pr.skill_code ?? null, figure: figureToSave });
  const renderCheck: RenderCheck = { ...figCheck, issues: [...figCheck.issues, ...contentIssues], ok: figCheck.ok && contentIssues.length === 0, checkedAt: opts.now ?? new Date().toISOString() };
  if (!renderCheck.ok) blocks.push(`렌더 검사 실패: ${renderCheck.issues.map((i) => i.message).join(" / ").slice(0, 300)}`);
  if (blocks.length) return { ...base, status: "blocked", reasons: blocks, warnings, changed: base.changed, before: base.before, after: base.after };

  const figureChanged = base.changed.includes("figure");
  const args: FullArgs = {
    passage: next.passage as string | null, question: next.question as string | null, options: nO, correct_index: nK, answers: next.answers ?? null, explanation: next.explanation as string | null, explanation_en: next.explanation_en as string | null,
    difficulty: cur.difficulty, figure: figureToSave, figure_checked: figureChanged ? false : !!cur.figure_checked, statements: next.statements ?? null,
    evidence_target: cur.evidence_target, evidence_span: cur.evidence_span, answer_rationale: cur.answer_rationale, distractor_error_types: cur.distractor_error_types ?? null,
  };
  if (figureChanged) warnings.push("그림이 바뀌어 figure_checked=false 로 저장됨(관리자 편집기에서 그림 확인 필요; 게시·세트 공개는 막지 않음)");
  // SQL 에 싣는 최소 정보: expect = 바뀌는 필드의 DB 현재(옛) 값, set = 그 필드의 새 값(+ 그림 정규화·figure_checked). 나머지 필드는 SQL 이 현재 공개 버전에서 그대로 복사한다.
  const expect: Record<string, unknown> = {}, set: Record<string, unknown> = {};
  for (const f of base.changed) { expect[f] = curVals[f] ?? null; set[f] = f === "figure" ? figureToSave ?? null : next[f] ?? null; }
  if (!base.changed.includes("figure") && !eq(figureToSave, cur.figure ?? null)) { expect.figure = curVals.figure ?? null; set.figure = figureToSave ?? null; } // 옛 표기를 표준 모양으로 정규화
  if (figureChanged) set.figure_checked = false;
  const quality = { ...(cur.quality ?? {}), auditFix: { source: "external_audit_2026-10-13", patch: patch.id, fromVersionId: cur.id, fromVersionNo: cur.version_no } };
  const auditFix = { source: "external_audit_2026-10-13", patch: patch.id, fromVersionId: cur.id, fromVersionNo: cur.version_no };
  return { ...base, status: "apply", warnings, args, expect, set, target: set, renderCheck, quality, auditFix, ap, placements: (pr.placements ?? []).filter((p) => p.set_status === "published") };
}

// ── 세트 계획 ───────────────────────────────────────────────
export type SetPlan = { setGroupId: string; setId: string; name: string; versionNo: number; format: string; accessTier: string | null; publishedAt: string | null; publishedBy: string | null; problemIds: string[]; patchIds: string[]; slots: { section: string; position: number; module_key: string | null; route: string | null; problemId: string }[] };
export type SetRow = { id: string; set_group_id: string; name: string; version_no: number; status: string; format: string; access_tier: string | null; published_at: string | null; published_by: string | null; archived_at: string | null };

/** 문항 계획(apply·already)에서 영향받는 공개 세트를 모은다. already 문항도 세트가 아직 옛 버전을 가리키면 포함한다(세트만 갱신). */
export function planSets(plans: PatchPlan[], sets: SetRow[], pubVersionByProblem: Map<string, string | null>): { sets: SetPlan[]; issues: string[] } {
  const by = new Map<string, SetPlan>(); const issues: string[] = [];
  for (const p of plans) {
    if (!p.problemId || (p.status !== "apply" && p.status !== "already")) continue;
    for (const pl of p.placements) {
      const row = sets.find((s) => s.id === pl.set_id);
      if (!row || row.status !== "published" || row.archived_at) { issues.push(`${p.patchId}: 세트 ${pl.set_name} v${pl.set_version} 는 공개 상태가 아님`); continue; }
      if (p.status === "already" && pl.item_version_id === pubVersionByProblem.get(p.problemId)) continue; // 세트도 이미 최신
      let sp = by.get(row.id);
      if (!sp) { sp = { setGroupId: row.set_group_id, setId: row.id, name: row.name, versionNo: row.version_no, format: row.format, accessTier: row.access_tier, publishedAt: row.published_at, publishedBy: row.published_by, problemIds: [], patchIds: [], slots: [] }; by.set(row.id, sp); }
      if (!sp.problemIds.includes(p.problemId)) { sp.problemIds.push(p.problemId); sp.patchIds.push(p.patchId); sp.slots.push({ section: pl.section, position: pl.position, module_key: pl.module_key, route: pl.route, problemId: p.problemId }); }
    }
  }
  return { sets: [...by.values()].sort((a, b) => a.name.localeCompare(b.name)), issues };
}

/** 사람이 읽는 문항별 전/후 diff(변경 필드만). */
export function formatDiff(p: PatchPlan, maxLen = 400): string {
  const cut = (v: unknown) => { const s = typeof v === "string" ? v : JSON.stringify(v); return s.length > maxLen ? `${s.slice(0, maxLen)}… (${s.length} chars)` : s; };
  const lines = [`[${p.patchId}] ${p.status}${p.gid ? ` gid=${p.gid}` : ""}${p.problemId ? ` problem=${p.problemId.slice(0, 8)} v${p.fromVersionNo}` : ""}`];
  for (const r of p.reasons) lines.push(`    reason: ${r}`);
  for (const w of p.warnings) lines.push(`    warn: ${w}`);
  for (const f of p.changed) { lines.push(`    ${f}:`); lines.push(`      - ${cut(p.before[f])}`); lines.push(`      + ${cut(p.after[f])}`); }
  for (const pl of p.placements) lines.push(`    in: ${pl.set_name} v${pl.set_version} ${pl.section}${pl.module_key ? `/${pl.module_key}` : ""}#${pl.position}`);
  return lines.join("\n");
}
