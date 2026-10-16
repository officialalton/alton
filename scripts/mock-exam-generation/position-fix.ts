// 기존 문항 정답 위치 균등화 — 로컬 산출물 생성(2026-10-01). **DB·원격 접근 없음.** 원본 passed.json 은 건드리지 않는다.
//   plan   : npx tsx scripts/mock-exam-generation/position-fix.ts plan [--out data/mock-exam-generation/position-fix]
//            입력: 모의고사용 passed.json + 일반용 full/stage1 passed.json(경로는 --general 로 바꿀 수 있음).
//   verify : npx tsx scripts/mock-exam-generation/position-fix.ts verify [--budget 25] [--n-refs 60] [--n-plain 30] [--full-stratum <키>]
//            계층 표본을 Fable 5.1·Opus 5.5 독립 풀이 + 해설(한·영) 정합 감사로 검증. 층에 실패가 1건이라도 있으면 그 층을 전수로 확대(상한 안에서). 추정 비용 출력 후 실행.
// 섞기 규칙: 숫자 선택지 Math·선택지 안 글자·순서 의존 선택지("모두 …", "위의 …")·본문에 글자 토큰(도형 점·변수)·글자 참조 판정이 모호한 문항은 섞지 않는다(사유 기록).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { letterRefs, reorder, isNumericOptions, type Rec } from "./shuffle-adopted";
import { analyze, remapAll, staticAudit } from "./position-fix-rules";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const LETTERS = "ABCD";
const OUT = path.resolve(arg("--out") ?? "data/mock-exam-generation/position-fix");
const SOURCES: { source: "mock" | "general"; file: string }[] = [
  { source: "mock", file: path.resolve("data/mock-exam-generation/mockgen-20260929/final/passed.json") },
  { source: "general", file: path.resolve(arg("--general") ?? path.join(process.env.HOME ?? "", "Developer/ALTON-worktrees/general-problem-pool/data/general-generation/gen-20260930/full/final/passed.json")) },
  { source: "general", file: path.resolve(arg("--general-stage1") ?? path.join(process.env.HOME ?? "", "Developer/ALTON-worktrees/general-problem-pool/data/general-generation/gen-20260930/stage1/final/passed.json")) },
];

export type FixEntry = {
  gid: string; source: "mock" | "general"; runId: string; skill: string; section: "rw" | "math"; format: string;
  status: "shuffle" | "skip"; reason?: string;
  origIndex: number; newIndex?: number; perm?: number[];
  letterRefs: number; letterRefsEn: number; rewritten: boolean; rewriteMethod?: "deterministic" | "ai" | "none"; ambiguous: boolean;
  before: { options: string[]; correctIndex: number; explanation: string; explanationEn: string | null };
  after?: { options: string[]; correctIndex: number; explanation: string; explanationEn: string | null };
};

const ORDER_DEP = /\b(all|none|both|neither|any) of (the|these|those) (above|following|choices|options)\b|\bthe (previous|preceding|above|following) (option|choice|answer)s?\b|위의 (모두|보기)|모두 (맞|옳|해당)|(없음|해당 없음)|위 (보기|선택지)|\bnone of the above\b|\ball of the above\b/i;
const TOKEN = (s: string | undefined | null) => letterRefs(s ?? "").length;
const REFS = (s: string | undefined | null) => analyze(s ?? "").toks.length;

export function classify(r: Rec): { skip?: string; ambiguous: boolean } {
  const p = r.problem;
  if (r.format !== "mc" || !Array.isArray(p.options) || p.options.length !== 4) return { skip: "mc 4지선다 아님", ambiguous: false };
  if (!Number.isInteger(p.correctIndex) || p.correctIndex < 0 || p.correctIndex > 3) return { skip: "정답 위치 이상", ambiguous: false };
  if (r.examSystem === "sat_math" && isNumericOptions(p.options)) return { skip: "숫자 선택지(오름차순 관례 유지)", ambiguous: false };
  if (p.options.some((o) => letterRefs(o).length > 0)) return { skip: "선택지 안에 글자 토큰", ambiguous: false };
  if (p.options.some((o) => ORDER_DEP.test(o))) return { skip: "순서 의존 선택지(모두·위의 …)", ambiguous: false };
  const body = `${p.stimulus ?? ""} ${p.passage ?? ""} ${p.question ?? ""}`;
  if (TOKEN(body) > 0 || (p.figure && JSON.stringify(p.figure).match(/"id":"[A-D]"/))) return { skip: "본문·도형에 글자 토큰(점·변수) — 해설 글자와 구분 불가", ambiguous: true };
  const ex = String(p.explanation ?? ""), en = String((p as { explanationEn?: string }).explanationEn ?? "");
  const unc = [...analyze(ex).uncertain, ...analyze(en).uncertain];
  if (unc.length) return { skip: `해설 참조 불확실(규칙이 확신하지 못함): ${unc[0]}`, ambiguous: true };
  return { ambiguous: false };
}

function buildPlan(forceSkip: Map<string, string> = new Map(), prefer: Map<string, number> = new Map()) {
  const all: FixEntry[] = [];
  const seen = new Set<string>();
  const perSource: Record<string, { n: number }> = {};
  for (const { source, file } of SOURCES) {
    if (!existsSync(file)) { console.warn(`(없음) ${file}`); continue; }
    const recs = (JSON.parse(readFileSync(file, "utf-8")) as Rec[]).filter((r) => !seen.has(r.gid));
    recs.forEach((r) => seen.add(r.gid));
    perSource[source] = { n: (perSource[source]?.n ?? 0) + recs.length };
    // 섞을 수 있는 문항에만 목표 배정 — 결정 가능한 skip 은 미리 걸러서 plan() 에 넘기지 않는다(원본 위치로 카운트에 반영).
    const cls = new Map(recs.map((r) => { const c = classify(r); const f = forceSkip.get(r.gid); return [r.gid, f && !c.skip ? { skip: f, ambiguous: true } : c]; }));
    const sysTarget = new Map<string, number>();
    for (const system of ["sat_rw", "sat_math"]) {
      const sys = recs.filter((r) => r.examSystem === system);
      const counts = [0, 0, 0, 0];
      for (const r of sys) if (cls.get(r.gid)!.skip && r.format === "mc" && r.problem.correctIndex >= 0) counts[r.problem.correctIndex]++;
      const open = sys.filter((x) => !cls.get(x.gid)!.skip).sort((a, b) => a.gid.localeCompare(b.gid));
      // 이전에 검수를 거친 항목은 같은 목표 위치를 유지(검수 결과가 새 계획에서도 유효하도록)
      for (const r of open) { const pt = prefer.get(r.gid); if (pt !== undefined && pt !== r.problem.correctIndex) { counts[pt]++; sysTarget.set(r.gid, pt); } }
      for (const r of open.filter((x) => !sysTarget.has(x.gid))) {
        let best = 0;
        for (let k = 1; k < 4; k++) if (counts[k] < counts[best] || (counts[k] === counts[best] && best === r.problem.correctIndex && k !== r.problem.correctIndex)) best = k;
        counts[best]++; sysTarget.set(r.gid, best);
      }
    }
    for (const r of recs) {
      const p = r.problem, c = cls.get(r.gid)!;
      const ex = String(p.explanation ?? ""), en = ((p as { explanationEn?: string | null }).explanationEn ?? null) as string | null;
      const base = { gid: r.gid, source, runId: String(r.runId ?? ""), skill: r.skill, section: (r.examSystem === "sat_rw" ? "rw" : "math") as "rw" | "math", format: r.format, origIndex: p.correctIndex, letterRefs: REFS(ex), letterRefsEn: REFS(en), ambiguous: c.ambiguous, before: { options: p.options, correctIndex: p.correctIndex, explanation: ex, explanationEn: en } };
      const t = sysTarget.get(r.gid);
      if (c.skip || t === undefined) { all.push({ ...base, status: "skip", reason: c.skip ?? "대상 아님", rewritten: false }); continue; }
      if (t === p.correctIndex) { all.push({ ...base, status: "skip", reason: "이미 목표 위치", rewritten: false }); continue; }
      const { options, perm } = reorder(p.options, p.correctIndex, t);
      const nex = base.letterRefs ? remapAll(ex, perm).text : ex;
      const nen = en && base.letterRefsEn ? remapAll(en, perm).text : en;
      all.push({ ...base, status: "shuffle", newIndex: t, perm, rewritten: base.letterRefs > 0 || base.letterRefsEn > 0, rewriteMethod: base.letterRefs > 0 || base.letterRefsEn > 0 ? "deterministic" : "none", after: { options, correctIndex: t, explanation: nex, explanationEn: nen } });
    }
  }
  return all;
}
const dist = (es: FixEntry[], section: string, useAfter: boolean) => {
  const c = [0, 0, 0, 0];
  for (const e of es.filter((x) => x.section === section && x.format === "mc")) c[useAfter && e.after ? e.after.correctIndex : e.origIndex]++;
  const n = c.reduce((a, b) => a + b, 0) || 1; return { counts: c, pct: c.map((v) => Math.round((v / n) * 100)) };
};

function cmdPlan() {
  // 1차 계획 → 정적 감사 → 실패 문항은 '생략'으로 확정하고 목표 배정을 다시 계산(분포 균형 유지)
  const force = new Map<string, string>();
  const prefer = new Map<string, number>();
  for (const f of ["apply-candidates.v2-verified223.json", "apply-candidates.v2-static891.json", "apply-candidates.v3-1060.json", "apply-candidates.v3-needsrereview40.json"]) { const fp = path.join(OUT, f); if (existsSync(fp)) for (const e of JSON.parse(readFileSync(fp, "utf-8")) as FixEntry[]) if (e.newIndex !== undefined) prefer.set(e.gid, e.newIndex); }
  let all = buildPlan(new Map(), prefer);
  for (let round = 0; round < 3; round++) {
    let added = 0;
    for (const e of all) {
      if (e.status !== "shuffle" || !e.after || !e.perm) continue;
      const f = staticAudit({ options: e.before.options, origIndex: e.origIndex, newIndex: e.newIndex!, perm: e.perm, before: e.before, after: e.after });
      if (f.length) { force.set(e.gid, `정적 감사 실패: ${f[0]}`); added++; }
    }
    if (!added) break;
    all = buildPlan(force, prefer);
  }
  mkdirSync(OUT, { recursive: true });
  const sha = createHash("sha256").update(JSON.stringify(all.map((e) => [e.gid, e.status, e.after?.correctIndex]))).digest("hex").slice(0, 12);
  writeFileSync(path.join(OUT, "plan.json"), JSON.stringify(all));
  const by = (f: (e: FixEntry) => string) => { const m: Record<string, number> = {}; for (const e of all) m[f(e)] = (m[f(e)] ?? 0) + 1; return m; };
  const summary = {
    planSha: sha, total: all.length, bySource: by((e) => e.source), byStatus: by((e) => e.status),
    skipReasons: by((e) => (e.status === "skip" ? e.reason ?? "" : "-")), shuffled: all.filter((e) => e.status === "shuffle").length, rewritten: all.filter((e) => e.rewritten).length, ambiguous: all.filter((e) => e.ambiguous).length,
    before: { rw: dist(all, "rw", false), math: dist(all, "math", false) }, after: { rw: dist(all, "rw", true), math: dist(all, "math", true) },
    bySourceDist: Object.fromEntries(["mock", "general"].map((s) => { const es = all.filter((e) => e.source === s); return [s, { before: { rw: dist(es, "rw", false).pct, math: dist(es, "math", false).pct }, after: { rw: dist(es, "rw", true).pct, math: dist(es, "math", true).pct } }]; })),
  };
  writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 1));
  console.log(JSON.stringify(summary, null, 1));
}

if (process.argv[1]?.endsWith("position-fix.ts")) {
  const cmd = process.argv[2];
  if (cmd === "plan") cmdPlan();
  else if (cmd === "rewrite") import("./position-fix-verify").then((m) => m.rewrite(OUT)).catch((e) => { console.error(e); process.exit(1); });
  else if (cmd === "verify") import("./position-fix-verify").then((m) => m.run(OUT)).catch((e) => { console.error(e); process.exit(1); });
  else console.log("사용: position-fix.ts plan|rewrite|verify");
}
