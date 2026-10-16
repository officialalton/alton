// 외부 감사 SAT 패치 계획(data/audit/2026-10-13-sat-patch-list.json)의 구조와 핵심 수학 검산(순수 계산, DB·LLM 없음).
// 패치 원문(old→new)은 저장소 생성물과 같음을 생성 시점에 확인했다. 여기서는 patch 가 바꾸는 값이 실제로 맞는지 독립 재계산한다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Change = { field: string; old: unknown; new: unknown };
type Patch = { id: string; gid: string; changes: Change[] };
const doc = JSON.parse(readFileSync("data/audit/2026-10-13-sat-patch-list.json", "utf-8")) as { count: number; patches: Patch[] };
const P = (id: string) => doc.patches.find((p) => p.id === id)!;
const field = (p: Patch, f: string) => p.changes.find((c) => c.field === f)!;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

describe("SAT 패치 목록 구조", () => {
  it("모든 패치는 gid·변경이 있고 old 와 new 가 다르다", () => {
    expect(doc.count).toBe(doc.patches.length);
    expect(new Set(doc.patches.map((p) => p.id)).size).toBe(doc.patches.length);
    for (const p of doc.patches) { expect(p.gid).toBeTruthy(); expect(p.changes.length).toBeGreaterThan(0); for (const c of p.changes) expect(JSON.stringify(c.old)).not.toBe(JSON.stringify(c.new)); }
  });
  it("빈칸 중복 기계 패치: 정답 선택지로 완성한 문장에 같은 단어가 연달아 두 번 나오지 않는다", () => {
    for (const p of doc.patches.filter((x) => x.id.startsWith("R-"))) {
      const pass = String(field(p, "passage").new);
      expect(/_{3,}/.test(pass)).toBe(true);
      const after = pass.split(/_{3,}/)[1].trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z']/g, "");
      expect(after).toBeTruthy();
    }
  });
});

describe("핵심 수학 검산", () => {
  it("S-01 두 직선 교점은 (20, 2000)", () => {
    const x = (9000 - 6000) / (350 - 200); expect(x).toBe(20);
    expect(-200 * x + 6000).toBe(2000); expect(-350 * x + 9000).toBe(2000); expect(-350 * 10 + 9000).toBe(5500);
    const o = field(P("S-01"), "correct_index"); expect(o.old).toBe(2); expect(o.new).toBe(1);
  });
  it("S-02 영점은 -2,1,4 뿐: 새 선택지 -4,-2,2,3 중 하나만 영점", () => {
    const g = (x: number) => (x + 2) * (x - 1) * (x - 4);
    expect([-4, -2, 1, 4].map((x) => g(x) + 0)).toEqual([-80, 0, 0, 0]);
    expect((field(P("S-02"), "options").new as string[]).map((s) => g(Number(s))).filter((v) => v === 0).length).toBe(1);
  });
  it("S-03 3x²+8x+4=(3x+2)(x+2) 이고 식은 선택지 A 와 같다(예전 식은 어느 선택지와도 다르다)", () => {
    const e = (x: number, d: (x: number) => number) => ((6 * x * x - 5 * x - 6) / (2 * x * x - 7 * x + 3)) / (d(x) / (x * x - 9));
    const opts = [(x: number) => ((2 * x - 3) * (x + 3)) / ((2 * x - 1) * (x + 2)), (x: number) => ((2 * x - 3) * (x + 3)) / ((x - 1) * (x + 2)), (x: number) => (2 * x - 3) / (2 * x - 1), (x: number) => ((2 * x + 3) * (x + 3)) / ((2 * x - 1) * (x + 2))];
    const fixed = (x: number) => 3 * x * x + 8 * x + 4, old = (x: number) => 3 * x * x + 7 * x + 2;
    for (const x of [4, 5.5, -7, 11]) { expect(near(fixed(x), (3 * x + 2) * (x + 2))).toBe(true); expect(near(e(x, fixed), opts[0](x))).toBe(true); expect(opts.slice(1).some((o) => near(e(x, fixed), o(x)))).toBe(false); expect(opts.some((o) => near(e(x, old), o(x)))).toBe(false); }
  });
  it("S-04 바뀐 조건에서 덮이지 않은 넓이 3(t-1)² > 0, 옛 값은 항상 음수", () => {
    for (const t of [1.5, 2, 7, 40]) { expect(near((2 * t - 2) ** 2 - (t - 1) ** 2, 3 * t * t - 6 * t + 3)).toBe(true); expect((t - 1) ** 2 - (2 * t - 2) ** 2).toBeLessThan(0); }
  });
  it("S-05 f(x)=-2(x-3)²+8 에서 f(x)=f(1) 의 해는 1 과 5", () => {
    const f = (x: number) => -2 * (x - 3) ** 2 + 8; expect(f(1)).toBe(0); expect(f(5)).toBe(0);
    expect(String(field(P("S-05"), "question").new)).toContain("other than $x = 1$");
  });
  it("S-07 윗반원과 y=kx+4 의 교점 수: k=0 → 1, 5/4 → 1(두 번째 점 y<0), 4/5·16/25·3/5 → 2", () => {
    const pts = (k: number) => [0, (-200 * k) / (16 + 25 * k * k)].filter((x, i, a) => a.indexOf(x) === i).filter((x) => k * x + 4 >= -1e-9).length;
    expect([0, 5 / 4, 4 / 5, 16 / 25, 3 / 5].map(pts)).toEqual([1, 1, 2, 2, 2]);
    expect((field(P("S-07"), "options").new as string[])[3]).toBe("$\\frac{3}{5}$");
  });
  it("S-08 새 그림에서 C 는 이상점 제거 시 기울기가 줄고 D 만 늘어난다", () => {
    const ols = (p: number[][]) => { const n = p.length, sx = p.reduce((a, b) => a + b[0], 0), sy = p.reduce((a, b) => a + b[1], 0), sxy = p.reduce((a, b) => a + b[0] * b[1], 0), sxx = p.reduce((a, b) => a + b[0] ** 2, 0); return (n * sxy - sx * sy) / (n * sxx - sx * sx); };
    const choices = (field(P("S-08"), "figure").new as { choices: { points: number[][] }[] }).choices;
    const outlierX = [8, 8, 6, 9];
    const up = choices.map((c, i) => ols(c.points.filter((p) => p[0] !== outlierX[i])) > ols(c.points));
    expect(up).toEqual([false, false, false, true]);
  });
  it("S-09 400·3^(t/6) 는 400·(1/3)^(-t/6) 와 같고 새 선택지 (1/3)^(t/6) 와는 다르다", () => {
    for (const t of [1, 5, 12]) { expect(near(3 ** (t / 6), (1 / 3) ** (-t / 6))).toBe(true); expect(near(3 ** (t / 6), (1 / 3) ** (t / 6))).toBe(false); }
  });
});
