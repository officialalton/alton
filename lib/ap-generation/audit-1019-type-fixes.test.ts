// 외부 AP 검수(2026-10-15) 유형 단위 수정(2026-10-19) 회귀 테스트. DB·네트워크 없음.
// (1) 원형 코드: Python unittest(test_audit_1019.py)를 돌린다 — 같은 생성기 결함이 새 문항에 다시 나오지 않는다.
// (2) 공개 문항 교체 후보(supp-fix1019): 저장본이 생성기 출력과 같고, 게이트를 통과하고, 지적 유형이 실제로 사라졌다.
// (3) 교체안: 독립 검증기 위반이 늘지 않고, 칸(removeKey)이 현재 게시 구성에서 풀린다.
// (4) 유형 전수 스캔: 공개 구성에 남은 같은 유형 결함은 알려진 예외(EL 차트 대체 글)뿐이다.
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { gateCandidate } from "../ap-figures/gate";
import { planConversion } from "../ap-exam/convert";
import { STOCK_BATCHES } from "../ap-admin/batches";
import { parseSwapPlan } from "../ap-admin/new-version";
import { AP_PYTHON as PY } from "../../scripts/ap-generation/py";
import { FIXES, RUN, buildRecord } from "../../scripts/audit/ap-audit-typefix-1019";
import { runGates } from "../../scripts/audit/ap-audit-fix-1015";
import { PLANS, CALC_PLANS, buildAll } from "../../scripts/audit/ap-audit-typefix-1019-plans";
import { verifyCalc } from "../../scripts/audit/ap-typefix-1019-verify";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = any;
const rd = (p: string): J => JSON.parse(readFileSync(p, "utf-8"));
const ARCH = path.resolve(__dirname, "../../scripts/ap-generation/archetypes");
const havePy = spawnSync(PY, ["-c", "import scipy, numpy, sympy"], { encoding: "utf-8" }).status === 0;
const items: J[] = rd("data/ap/stock/supp-fix1019-items.json");
const byNew = new Map(items.map((r) => [r.candidateKey, r]));

(havePy ? describe : describe.skip)("원형 코드(Python unittest)", () => {
  it("test_audit_1019: 카이제곱 동치 귀무·표 자료 설정 가시성·필수 값·반복 유형이 모두 고쳐졌다", () => {
    const r = spawnSync(PY, ["-B", "-m", "unittest", "test_audit_1019"], { cwd: ARCH, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024, timeout: 280000 });
    expect(r.stderr + r.stdout, "python unittest output").toMatch(/OK/);
    expect(r.status).toBe(0);
  }, 300000);
});

describe("교체 후보 배치 등록·재현", () => {
  it("배치 등록·통과 키", () => {
    expect(STOCK_BATCHES.find((b) => b.id === "supp-fix1019")).toMatchObject({ itemsFile: "supp-fix1019-items.json", passKeysFile: "supp-fix1019-pass-keys.json", evidenceFile: "evidence-fix1019.json", supplement: true });
    const pass = new Set(rd("data/ap/stock/supp-fix1019-pass-keys.json") as string[]);
    expect(pass.size).toBe(items.length);
    for (const r of items) { expect(pass.has(r.stockKey)).toBe(true); expect(r.validation).toBe("auto_passed"); expect(r.stockKey).toBe(`${RUN}:${r.candidateKey}`); }
  });
  it("저장된 후보는 생성기 출력과 같다(손으로 고친 흔적 없음)", () => {
    expect(items.map((r) => r.stockKey)).toEqual(FIXES.map((f) => `${RUN}:${f.newKey}`));
    for (const f of FIXES) expect(byNew.get(f.newKey)!.payload).toEqual(buildRecord(f).payload);
  });
  it("모든 후보가 렌더·변환·결정적 게이트를 통과하고 원본 대비 새 위반이 없다", () => {
    for (const r of items) {
      const g = gateCandidate(r); expect(["pass", "not_applicable"], r.stockKey).toContain(g.status);
      expect(planConversion(r).ok, r.stockKey).toBe(true);
      const x = runGates(r); expect(x.defects, r.stockKey).toEqual([]);
      const b = runGates(buildRecord(FIXES.find((f) => `${RUN}:${f.newKey}` === r.stockKey)!)); expect(x.det).toEqual(b.det);
    }
    const rep = rd("data/ap/render-check/report-fix1019.json"); expect(rep.all.fail).toBe(0); expect(rep.all.total).toBe(items.length);
  });
});

describe("지적 유형이 후보에서 실제로 사라졌다", () => {
  const stripPunct = (t: string) => t.replace(/[$\\,]/g, "");
  it("setup_hidden 유형: 설명(description)의 주어진 값·소개가 학생이 보는 제목에 있다", () => {
    for (const f of FIXES.filter((x) => x.type === "b_setup_hidden" || x.type === "c_required_info_hidden")) {
      const r = byNew.get(f.newKey)!; const d = String(r.payload.stimulus.description).replace(/[ .;]+$/, "").split(/\s+/).join(" ");
      expect(stripPunct(r.payload.title), f.id).toContain(stripPunct(d));
    }
  });
  it("MI1 FRQ3: 산출물 가격 $3 과 임금 $55 가 제목에 있다", () => {
    const t = byNew.get("ap_microeconomics-tf07-k0")!.payload.title; expect(t).toContain("$3 each"); expect(t).toContain("$55 per day");
  });
  it("Calc: 오목성 이유 행이 f′ 증가만 요구하고 f″ > 0 을 강제하지 않는다", () => {
    for (const k of ["ap_calculus_ab-tf11-k0", "ap_calculus_ab-tf12-k0"]) {
      const s = JSON.stringify(byNew.get(k)!.payload); expect(s).toContain("Reason: f' is increasing on those intervals"); expect(s).not.toContain("so f'' > 0"); expect(s).not.toContain("f'' is positive");
    }
  });
});

describe("교체안", () => {
  it("비미적분 7개 교체안: 독립 검증기 위반이 늘지 않고 저장된 파일이 생성기 출력과 같다", () => {
    const r = buildAll(false);
    expect(r.map((x) => x.file)).toEqual(PLANS.map((p) => p.file));
    for (const x of r) expect(x.introduced, x.file).toEqual([]);
    for (const def of PLANS) {
      const f = rd(`data/ap/stock/${def.file}`); const plan = parseSwapPlan(f);
      expect(plan.set).toBe(def.a.set); expect(plan.sourceVersionNo).toBe(def.src); expect(plan.swaps).toHaveLength(def.swaps.length);
      expect(f.verifierViolations).toEqual([]); expect(f.requiresConvertedCandidates).toEqual(def.swaps.map((s) => s.addKey));
      for (const [i, s] of def.swaps.entries()) { expect(f.swaps[i]).toMatchObject({ section: s.section, removeKey: s.removeKey, addKey: s.addKey }); expect(byNew.has(s.addKey.slice(RUN.length + 1))).toBe(true); }
    }
  });
  it("미적분 AB2·AB3 교체안: 게시 구성 6세트에 적용해도 위반이 늘지 않고 칸이 풀린다", () => {
    const base = verifyCalc(false); const after = verifyCalc(true);
    expect(after.missing).toEqual([]); expect(after.violations.filter((x) => !base.violations.includes(x))).toEqual([]);
    for (const c of CALC_PLANS) { expect(after.log.filter((l) => l.includes(c.file) && l.startsWith("applied"))).toHaveLength(c.swaps.length); parseSwapPlan(rd(`data/ap/stock/${c.file}`)); }
  });
  it("교체안 이름 규칙(swap-plan)과 후보가 지정하는 원본 키가 실제 재고에 있다", () => {
    for (const f of [...PLANS.map((p) => p.file), ...CALC_PLANS.map((p) => p.file)]) expect(f).toMatch(/^[A-Za-z0-9._-]*swap-plan[A-Za-z0-9._-]*\.json$/);
    for (const fx of FIXES) expect(buildRecord(fx).fixOf).toBe(fx.src);
  });
});

describe("유형 전수 스캔(data/audit/ap-type-defect-scan-20261019.json)", () => {
  const scanFile = "data/audit/ap-type-defect-scan-20261019.json";
  const scan = existsSync(scanFile) ? rd(scanFile) : null;
  it("공개 구성에 남은 같은 유형 결함은 알려진 예외뿐이다(EL 차트 대체 글)", () => {
    expect(scan).not.toBeNull();
    const left = Object.entries(scan.detectors as Record<string, J>).flatMap(([code, e]) => (e.published as J[]).map((p) => `${code}:${p.key}`));
    expect(left).toEqual(["b_setup_hidden:el-rv:ap_english_language-fb1-k0"]);
  });
  it("각 유형의 재고·이미 교체안으로 덮인 문항 수가 기록돼 있다", () => {
    for (const code of ["a_chisq_equivalent_nulls", "b_setup_hidden", "b_title_truncated", "d_bio_fork_direction", "d_stats_phat_not_count_over_n", "d_phys_collision_rounded_premise", "d_calc_smoothness_premise", "d_calc_concavity_reference"]) {
      expect(scan.detectors[code], code).toBeTruthy(); expect(scan.detectors[code].stockTotal, code).toBeGreaterThan(0);
    }
    expect(scan.detectors.a_chisq_equivalent_nulls.coveredByExistingPlan).toHaveLength(3);
  });
});
