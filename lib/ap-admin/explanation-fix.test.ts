import { describe, expect, it } from "vitest";
import katex from "katex";
import { autoMathExplanation } from "../ap-exam/explanation-math";
import { findUnwrappedMath } from "../ap-exam/tex-audit";
import { applyEntry, correctionsForStock, planEntries, readCorrectionFile, runExplanationFix, runExplanationFixPreview, runRefreshDraft, sha256, type CorrectionFile } from "./explanation-fix";
import type { Ctx } from "./service";

const EXPL = "The correct answer is \\frac{1}{10}. Limit read from the values the function approaches (rationalizing gives 1/(2c)).\nThe limit does not exist is incorrect: Believes a mismatch means the limit fails to exist.\n5 is incorrect: Treats f(a) as the limit.\n0 is incorrect: Reads 0/0 as 0.";
const entry = (o: Record<string, unknown> = {}) => ({ candidateKey: "run2:ap_calculus_ab-m01-k0", itemIndex: 0, sets: ["AB1 v1(공개본)"], beforeSha256: sha256(EXPL), afterSha256: sha256(autoMathExplanation(EXPL)), after: autoMathExplanation(EXPL), ...o });
const file = (entries: unknown[]): CorrectionFile => ({ kind: "ap_explanation_math_correction", version: 1, generatedBy: "t", note: "", count: entries.length, entries: entries as never });

type Row = Record<string, unknown>;
/** 필요한 만큼만 흉내 내는 DB: select().in()/eq() 체인 + rpc 기록. 감사 insert 는 audit 에 쌓는다. */
function fakeDb(opts: { problems: Row[]; versions: Row[]; open?: string[]; sets?: Row[]; items?: Row[]; drafts?: number }) {
  const calls: { fn: string; args: Record<string, unknown> }[] = []; const audit: Row[] = []; const writes: string[] = [];
  const table = (name: string) => {
    const filt: ((r: Row) => boolean)[] = []; let head = false;
    const rows = (): Row[] => {
      const all = name === "problems" ? opts.problems : name === "problem_versions" ? [...opts.versions, ...(opts.open ?? []).map((p) => ({ problem_id: p, status: "draft" }))] : name === "mock_exam_sets" ? (opts.sets ?? []) : name === "mock_exam_set_items" ? (opts.items ?? []) : [];
      return all.filter((r) => filt.every((f) => f(r)));
    };
    const q: Record<string, unknown> = {
      select: (_c?: string, o?: { head?: boolean }) => { head = !!o?.head; return q; },
      in: (col: string, vals: unknown[]) => { filt.push((r) => vals.includes(r[col])); return q; },
      eq: (col: string, v: unknown) => { if (name === "mock_exam_sets" && col === "status" && v === "draft") { return { then: (res: (x: unknown) => void) => res({ count: opts.drafts ?? 0, error: null }) }; } filt.push((r) => r[col] === v); return q; },
      limit: () => q,
      single: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
      insert: (r: Row) => { writes.push(`${name}:insert`); if (name === "ap_stock_admin_runs") audit.push(r); return Promise.resolve({ error: null }); },
      update: () => { writes.push(`${name}:update`); return q; },
      then: (res: (x: unknown) => void) => res(head ? { count: rows().length, data: null, error: null } : { data: rows(), error: null }),
    };
    return q;
  };
  const db = {
    from: (n: string) => table(n),
    rpc: (fn: string, args: Record<string, unknown>) => { calls.push({ fn, args }); return Promise.resolve({ data: fn === "save_problem_draft_version" ? "new-version-id" : fn === "mock_exam_refresh_explanations" ? { newSetId: "ns", versionNo: 2, refreshed: 3 } : null, error: null }); },
  };
  return { db: db as never, calls, audit, writes };
}
const target = (canWrite: boolean) => ({ kind: "remote" as const, ref: "nonprod", canWrite, reason: canWrite ? null : "쓰기 금지 환경" });
const ver = (o: Row = {}) => ({ id: "v1", passage: null, question: "Q", options: ["a", "b"], correct_index: 0, explanation: EXPL, explanation_en: EXPL, difficulty: "easy", answers: null, figure: null, figure_checked: true, statements: null, render_check: { ok: true }, evidence_target: null, evidence_span: null, answer_rationale: null, distractor_error_types: null, ...o });
const prob = { id: "p1", ap_candidate_key: "run2:ap_calculus_ab-m01-k0", ap_item_index: 0, published_version_id: "v1" };

describe("교정 파일(저장소)", () => {
  it("읽히고, 모든 교정 문안이 구분자 밖 TeX 없이 KaTeX 로 파싱되며 멱등이다", () => {
    const f = readCorrectionFile();
    expect(f.count).toBe(f.entries.length); expect(f.count).toBeGreaterThan(0);
    const bad: string[] = [];
    for (const e of f.entries) {
      if (autoMathExplanation(e.after) !== e.after) bad.push(`${e.candidateKey}#${e.itemIndex}: 멱등 아님`);
      if (findUnwrappedMath(e.after).some((h) => h.kind === "tex-command" || h.kind === "tex-script")) bad.push(`${e.candidateKey}: TeX 남음`);
      for (const m of e.after.matchAll(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g)) { try { katex.renderToString(m[1] ?? m[2], { throwOnError: true }); } catch { bad.push(`${e.candidateKey}: KaTeX 실패 ${(m[1] ?? m[2]).slice(0, 40)}`); } }
    }
    expect(bad).toEqual([]);
  });
  it("보고된 MC 해설 사례가 교정 대상에 있다(\\frac{1}{10})", () => {
    const f = readCorrectionFile();
    const e = f.entries.find((x) => x.candidateKey.endsWith("ap_calculus_ab-m01-k0") && x.after.startsWith("The correct answer is $\\frac{1}{10}$."));
    expect(e).toBeTruthy();
  });
  it("보고된 FRQ 참고 답안 사례(\\pi\\int … \\left[ … )가 교정 대상에 있고 $ 로 감싸졌다", () => {
    const f = readCorrectionFile();
    const e = f.entries.find((x) => x.after.includes("\\pi\\int_0^2.746\\left[(\\sin x+2.5+2)^2"));
    expect(e).toBeTruthy();
    expect(e!.after).toMatch(/\$\\pi\\int_0\^2\.746/);
  });
  it("correctionsForStock: 이미 감싸진 해설은 교정 대상이 아니다", () => {
    const it0 = { stockKey: "x", apSubjectCode: "ap_calculus_ab", kind: "mc" as const, payload: {} };
    expect(correctionsForStock(it0, [])).toEqual([]);
  });
});

describe("planEntries·미리보기", () => {
  it("상태 분류: 교정 대상 / 이미 교정됨 / 변환 전 / 해설 불일치 / 진행 중 초안", async () => {
    const e = (k: string, o: Row = {}) => entry({ candidateKey: k, ...o });
    const { db } = fakeDb({
      problems: [prob, { ...prob, id: "p2", ap_candidate_key: "k2", published_version_id: "v2" }, { ...prob, id: "p3", ap_candidate_key: "k3", published_version_id: "v3" }, { ...prob, id: "p4", ap_candidate_key: "k4", published_version_id: "v4" }],
      versions: [ver(), ver({ id: "v2", explanation_en: autoMathExplanation(EXPL) }), ver({ id: "v3", explanation_en: "edited by hand" }), ver({ id: "v4" })], open: ["p4"],
    });
    const plans = await planEntries({ db, target: target(true) as never, actorId: "a" }, [e(prob.ap_candidate_key), e("k2"), e("k3"), e("k4"), e("nope")]);
    expect(plans.map((p) => p.state)).toEqual(["apply", "already", "drift", "pending_draft", "not_converted"]);
  });
  it("미리보기는 읽기 전용(쓰기 RPC·테이블 쓰기 없음)이고 계획 해시를 낸다", async () => {
    const f = fakeDb({ problems: [prob], versions: [ver()] });
    const r = await runExplanationFixPreview({ db: f.db, target: target(true) as never, actorId: "a" }, file([entry()]));
    expect(r.ok).toBe(true); expect(r.planHash).toBeTruthy(); expect(r.counts.apply).toBe(1);
    expect(f.calls).toEqual([]); expect(f.writes).toEqual([]);
  });
});

describe("runExplanationFix — 실행", () => {
  const ctx = (f: ReturnType<typeof fakeDb>, canWrite = true): Ctx => ({ db: f.db, target: target(canWrite) as never, actorId: "admin-1" });
  it("환경 가드: 쓰기 금지 환경이면 RPC 를 하나도 부르지 않는다", async () => {
    const f = fakeDb({ problems: [prob], versions: [ver()] });
    const r = await runExplanationFix(ctx(f, false), file([entry()]), "h");
    expect(r.blocked).toContain("쓰기 금지"); expect(f.calls).toEqual([]);
  });
  it("미리보기 해시 없이는 실행하지 않는다", async () => {
    const f = fakeDb({ problems: [prob], versions: [ver()] });
    const r = await runExplanationFix(ctx(f), file([entry()]), null);
    expect(r.ok).toBe(false); expect(f.calls).toEqual([]);
  });
  it("계획이 바뀌면(해시 불일치) 실행하지 않는다", async () => {
    const f = fakeDb({ problems: [prob], versions: [ver()] });
    const r = await runExplanationFix(ctx(f), file([entry()]), "stale-hash");
    expect(r.blocked).toContain("계획이 달라졌습니다"); expect(f.calls).toEqual([]);
  });
  it("정상: 새 초안(해설만 교체) → 렌더 점검 복사 → 공개 → 연결 순서로, 허용된 RPC 만 부른다(응시·답안·결과 쓰기 없음)", async () => {
    const f = fakeDb({ problems: [prob], versions: [ver()] });
    const pv = await runExplanationFixPreview(ctx(f), file([entry()]));
    const r = await runExplanationFix(ctx(f), file([entry()]), pv.planHash);
    expect(r.executed).toBe(true); expect(r.counts.appliedNow).toBe(1);
    expect(f.calls.map((c) => c.fn)).toEqual(["save_problem_draft_version", "set_problem_render_check", "confirm_and_publish_problem_version", "ap_attach_new_version"]);
    const save = f.calls[0].args;
    expect(save.p_explanation).toBe(autoMathExplanation(EXPL)); expect(save.p_explanation_en).toBe(autoMathExplanation(EXPL));
    expect(save.p_question).toBe("Q"); expect(save.p_options).toEqual(["a", "b"]); expect(save.p_correct_index).toBe(0);
    expect(f.calls[1].args).toEqual({ p_version_id: "new-version-id", p_check: { ok: true } });
    expect(f.calls[3].args).toEqual({ p_candidate_key: prob.ap_candidate_key, p_item_index: 0, p_version_id: "new-version-id", p_actor_id: "admin-1" });
    expect(f.writes.filter((w) => !w.startsWith("ap_stock_admin_runs"))).toEqual([]); // 문제·세트·응시 테이블 직접 쓰기 없음
  });
  it("이미 교정된 항목·해설 불일치·진행 중 초안은 건드리지 않는다(교정 대상 0 이면 차단)", async () => {
    const f = fakeDb({ problems: [prob], versions: [ver({ explanation_en: "hand edited" })] });
    const r = await runExplanationFix(ctx(f), file([entry()]), "x");
    expect(r.ok).toBe(false); expect(f.calls).toEqual([]);
  });
  it("RPC 가 중간에 실패하면 거기서 멈추고 오류를 보고한다", async () => {
    const f = fakeDb({ problems: [prob], versions: [ver()] });
    const pv = await runExplanationFixPreview(ctx(f), file([entry()]));
    const bad = { ...(f.db as object), rpc: (fn: string, a: Record<string, unknown>) => (fn === "confirm_and_publish_problem_version" ? Promise.resolve({ data: null, error: { message: "gate refused" } }) : (f.db as never as { rpc: (x: string, y: unknown) => Promise<unknown> }).rpc(fn, a)) };
    const r = await runExplanationFix({ ...ctx(f), db: bad as never }, file([entry()]), pv.planHash);
    expect(r.ok).toBe(false); expect(r.blocked).toContain("gate refused");
    expect(f.calls.map((c) => c.fn)).not.toContain("ap_attach_new_version");
  });
  it("applyEntry 단독: 순서·인자", async () => {
    const calls: string[] = [];
    await applyEntry(async (fn) => { calls.push(fn); return "vid"; }, "a", { entry: entry() as never, state: "apply", problemId: "p1", version: ver() as never });
    expect(calls).toEqual(["save_problem_draft_version", "set_problem_render_check", "confirm_and_publish_problem_version", "ap_attach_new_version"]);
  });
});

describe("runRefreshDraft — 세트 반영", () => {
  const sets = [{ id: "S", name: "AP Calculus AB — Practice Exam", version_no: 1, status: "published", exam_program: "ap", format: "ap_fixed", set_group_id: "G" }];
  const ctx = (f: ReturnType<typeof fakeDb>): Ctx => ({ db: f.db, target: target(true) as never, actorId: "admin-1" });
  it("교정된 새 버전을 쓰는 문항이 있을 때만 초안을 만든다(미리보기 → 같은 해시로 실행)", async () => {
    const f = fakeDb({ problems: [{ id: "p1", published_version_id: "v2" }, { id: "p2", published_version_id: "v9" }], versions: [], sets, items: [{ exam_set_id: "S", problem_id: "p1", problem_version_id: "v1", section: "ap_mc_a", position: 1 }, { exam_set_id: "S", problem_id: "p2", problem_version_id: "v9", section: "ap_mc_a", position: 2 }] });
    const pv = await runRefreshDraft(ctx(f), "S", false, null, async () => { throw new Error("no"); });
    expect(pv.ok).toBe(true); expect(pv.counts.refreshed).toBe(1); expect(pv.planHash).toBeTruthy();
    const r = await runRefreshDraft(ctx(f), "S", true, pv.planHash, async (id) => { const { data } = await (f.db as never as { rpc: (a: string, b: unknown) => Promise<{ data: { newSetId: string; versionNo: number; refreshed: number } }> }).rpc("mock_exam_refresh_explanations", { p_source_set_id: id }); return data; });
    expect(r.executed).toBe(true); expect(r.scope.newSetId).toBe("ns");
  });
  it("바뀌는 문항이 없으면 차단", async () => {
    const f = fakeDb({ problems: [{ id: "p1", published_version_id: "v1" }], versions: [], sets, items: [{ exam_set_id: "S", problem_id: "p1", problem_version_id: "v1", section: "ap_mc_a", position: 1 }] });
    const r = await runRefreshDraft(ctx(f), "S", false, null, async () => { throw new Error("no"); });
    expect(r.ok).toBe(false); expect(r.blocked).toBeTruthy();
  });
  it("같은 계열에 초안이 있으면 차단", async () => {
    const f = fakeDb({ problems: [{ id: "p1", published_version_id: "v2" }], versions: [], sets, items: [{ exam_set_id: "S", problem_id: "p1", problem_version_id: "v1", section: "ap_mc_a", position: 1 }], drafts: 1 });
    const r = await runRefreshDraft(ctx(f), "S", false, null, async () => { throw new Error("no"); });
    expect(r.ok).toBe(false); expect(r.lines.join(" ")).toContain("초안");
  });
});
