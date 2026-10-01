// 30세트 필요량 정밀 계산 (2026-10-01). 순수 계산 — DB·API 호출 없음. 실행: npx tsx scripts/mock-exam-generation/thirty-need.ts [--sets 30]
// 세트 구조: RW 81(= M1 27 + M2 lower 27 + M2 higher 27) · Math 66(22 x 3), 세트 안 중복 0, 세트 간 재사용 없음.
// 모듈별 난이도: M1·lower = easy·medium, higher = medium·hard (기존 조립기 `difficultyAllowedForModule`), 영역·난이도 비중 = 표준 tier(영역 RW 26/28/20/26·Math 35/35/15/15, 난이도 25/50/25 를 모듈 허용 난이도로 재정규화), Math 형식 mc 75·spr 25.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { allocateCounts, buildTargetCells, mstModulePlans, difficultyAllowedForModule, type DifficultyWeight, type DomainWeight } from "../../lib/mock-exam/assemble";
import { DOMAINS } from "./plan";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const SETS = Number(arg("--sets") ?? 30);
type D = "easy" | "medium" | "hard";
const DOM_W: Record<"rw" | "math", DomainWeight[]> = {
  rw: [{ satDomain: "rw_information_ideas", weightPct: 26 }, { satDomain: "rw_craft_structure", weightPct: 28 }, { satDomain: "rw_expression_ideas", weightPct: 20 }, { satDomain: "rw_standard_english", weightPct: 26 }],
  math: [{ satDomain: "algebra", weightPct: 35 }, { satDomain: "advanced_math", weightPct: 35 }, { satDomain: "problem_solving_data", weightPct: 15 }, { satDomain: "geometry_trig", weightPct: 15 }],
};
const DIFF_W: DifficultyWeight[] = [{ difficulty: "easy", weightPct: 25 }, { difficulty: "medium", weightPct: 50 }, { difficulty: "hard", weightPct: 25 }];
const MATH_FMT = [{ format: "mc" as const, weightPct: 75 }, { format: "spr" as const, weightPct: 25 }];

// 1) 세트 1개 필요량: (섹션, 영역, 난이도, 형식) — 조립기와 같은 순수 함수로 모듈마다 셀을 만든다.
const perSet: Record<string, number> = {};
for (const mod of mstModulePlans(true)) {
  const sec = mod.section;
  const dw = DIFF_W.filter((d) => difficultyAllowedForModule(mod, d.difficulty));
  const cells = buildTargetCells(DOM_W[sec], dw, mod.count, sec === "math" ? MATH_FMT : undefined);
  for (const c of cells) if (c.targetCount > 0) { const k = `${sec}|${c.satDomain}|${c.difficulty}|${c.format ?? "mc"}`; perSet[k] = (perSet[k] ?? 0) + c.targetCount; }
}
const sumSet = (f: (k: string[]) => boolean) => Object.entries(perSet).filter(([k]) => f(k.split("|"))).reduce((a, [, v]) => a + v, 0);
const secDiffPerSet = (sec: string, d: D) => sumSet((k) => k[0] === sec && k[2] === d);

// 2) skill 단위 배분: 영역 안 skill 비중 = plan.ts 의 SAT 블루프린트 근사 비중.
type Row = { system: "sat_rw" | "sat_math"; domain: string; skill: string; total: number; byDiff: Record<D, number>; propHard: number; floorApplied: boolean };
const rows: Row[] = [];
for (const sec of ["rw", "math"] as const) {
  const system = sec === "rw" ? "sat_rw" : "sat_math";
  const doms = DOMAINS.filter((d) => d.system === system);
  const secTotal = (sec === "rw" ? 81 : 66) * SETS;
  // (a) 기존 풀 비율 비례 방식과 같은 '영역 경유' hard: 영역별 hard(세트 x SETS)를 skill 비중으로 나눔.
  const hardByDomain: Record<string, number> = {};
  for (const d of doms) hardByDomain[d.domain] = sumSet((k) => k[0] === sec && k[1] === d.domain && k[2] === "hard") * SETS;
  // (b) skill 총량 = 섹션 총량 x 영역 비중 x skill 비중(최대 나머지법).
  const domTotals = allocateCounts(DOM_W[sec].map((w) => ({ key: w.satDomain, weightPct: w.weightPct })), secTotal);
  const skillTotals: Record<string, number> = {};
  const skillDomain: Record<string, string> = {};
  for (const d of doms) { const t = allocateCounts(d.skills.map((s) => ({ key: s.code, weightPct: s.w })), domTotals[d.domain]); for (const [k, v] of Object.entries(t)) { skillTotals[k] = v; skillDomain[k] = d.domain; } }
  // (c) hard: 섹션 hard 총량을 (영역 hard 경유 비례) 대신 '바닥값 + 블루프린트 비중'으로: skill 별 최소 ceil(SETS/3), 나머지는 skill 총량 비중으로.
  const hardTotal = secDiffPerSet(sec, "hard") * SETS;
  const skills = Object.keys(skillTotals);
  const floor = Math.ceil(SETS / 3);
  const hardBySkill: Record<string, number> = {};
  const remaining = hardTotal - floor * skills.length;
  const extra = allocateCounts(skills.map((k) => ({ key: k, weightPct: skillTotals[k] })), Math.max(0, remaining));
  for (const k of skills) hardBySkill[k] = floor + (extra[k] ?? 0);
  const easyTotal = secDiffPerSet(sec, "easy") * SETS;
  const nonHardTotal = secTotal - hardTotal;
  const easyShare = easyTotal / Math.max(1, nonHardTotal);
  // 비-hard 는 skill 별 (총량 - hard) 를 easy:medium = 섹션 전체 비율로 나눔.
  for (const d of doms) for (const s of d.skills) {
    const total = skillTotals[s.code];
    const nonHard = total - hardBySkill[s.code];
    const easy = Math.round(nonHard * easyShare);
    // 기존 방식(영역 경유)의 hard: 영역 hard 를 skill 비중으로 나눈 값(반올림) — 비교용
    const propHard = Math.round((hardByDomain[d.domain] * s.w) / d.skills.reduce((a, x) => a + x.w, 0));
    rows.push({ system, domain: d.domain, skill: s.code, total, byDiff: { easy, medium: nonHard - easy, hard: hardBySkill[s.code] }, propHard, floorApplied: hardBySkill[s.code] > propHard });
  }
}

// 3) 공급 차감: 원격 실측(easy/medium/hard, hard 중 AI 생성분 별도) + 로컬 통과 easy/medium + 임포트 전 채택 hard 59(잠정).
const IN = path.resolve("data/mock-exam-generation");
const remote = JSON.parse(readFileSync(path.join(IN, "inputs/remote-supply.json"), "utf-8")) as Record<string, Record<D, number>>;
const remoteAi = JSON.parse(readFileSync(path.join(IN, "inputs/remote-hard-ai-split.json"), "utf-8")) as Record<string, { hard: number; ai_generated: number; non_ai: number }>;
const passed = JSON.parse(readFileSync(path.join(IN, "mockgen-20260929/final/passed.json"), "utf-8")) as { skill: string; difficulty: D }[];
const adopted = JSON.parse(readFileSync(path.join(IN, "mockgen-20260929/final/adopted-hard-all.json"), "utf-8")) as { skill: string }[];
const cnt = (arr: { skill: string; difficulty?: string }[], d?: string) => { const m: Record<string, number> = {}; for (const r of arr) if (!d || r.difficulty === d) m[r.skill] = (m[r.skill] ?? 0) + 1; return m; };
// 로컬 통과 문항 중 hard 라벨은 구 기준(Sonnet 검수)이라 hard 로 세지 않고 medium 으로 취급한다.
const passedEasy = cnt(passed, "easy"), passedMed = cnt(passed.map((p) => ({ skill: p.skill, difficulty: p.difficulty === "hard" ? "medium" : p.difficulty })), "medium"), adoptedHard = cnt(adopted);
// Math 컴파일러 용량: 세트당 같은 (skill, 세부 패턴) 유사 그룹은 1문항 → 30세트 x 패턴 수가 '세트 간 재사용 없음' 하의 최대 세트 배치 가능량 상한이 아니라 세트당 최대 문항 수(= 패턴 수)를 뜻한다.
const kindsSrc = readFileSync("lib/problem-generation/math-compilers/kind-catalog.ts", "utf-8");
const kinds: Record<string, number> = {};
for (const m of kindsSrc.matchAll(/\n  (\w+): \[\n((?:    \{[^\n]*\n)+)  \],/g)) kinds[m[1]] = (m[2].match(/value:/g) ?? []).length;

const out = rows.map((r) => {
  const rs = remote[r.skill] ?? { easy: 0, medium: 0, hard: 0 };
  const ai = remoteAi[r.skill]?.ai_generated ?? 0;
  const supply = { easy: (rs.easy ?? 0) + (passedEasy[r.skill] ?? 0), medium: (rs.medium ?? 0) + (passedMed[r.skill] ?? 0), hardRemoteNonAi: Math.max(0, (rs.hard ?? 0) - ai), hardRemoteAiProvisional: ai, hardLocalAdoptedProvisional: adoptedHard[r.skill] ?? 0 };
  const hardSupply = supply.hardRemoteNonAi + supply.hardRemoteAiProvisional + supply.hardLocalAdoptedProvisional;
  const short = { easy: Math.max(0, r.byDiff.easy - supply.easy), medium: Math.max(0, r.byDiff.medium - supply.medium), hard: Math.max(0, r.byDiff.hard - hardSupply) };
  const perSetSkill = r.total / SETS;
  const compilerPerSetCap = kinds[r.skill] ?? 0;
  return { ...r, supply, short, shortTotal: short.easy + short.medium + short.hard, perSetSkill: +perSetSkill.toFixed(2), compiler: r.system === "sat_math" ? { kinds: compilerPerSetCap, perSetOverCap: perSetSkill > compilerPerSetCap ? +(perSetSkill - compilerPerSetCap).toFixed(2) : 0 } : null };
});
writeFileSync(path.join(IN, "mockgen-20260929/final/thirty-need.json"), JSON.stringify({ sets: SETS, perSet, rows: out }, null, 1));
const tot = (sys: string, f: (r: (typeof out)[number]) => number) => out.filter((r) => r.system === sys).reduce((a, r) => a + f(r), 0);
console.log(JSON.stringify({ sets: SETS, perSetDiff: { rw: { easy: secDiffPerSet("rw", "easy"), medium: secDiffPerSet("rw", "medium"), hard: secDiffPerSet("rw", "hard") }, math: { easy: secDiffPerSet("math", "easy"), medium: secDiffPerSet("math", "medium"), hard: secDiffPerSet("math", "hard") } }, need: { rw: tot("sat_rw", (r) => r.total), math: tot("sat_math", (r) => r.total) }, short: { rw: tot("sat_rw", (r) => r.shortTotal), math: tot("sat_math", (r) => r.shortTotal) } }, null, 1));
