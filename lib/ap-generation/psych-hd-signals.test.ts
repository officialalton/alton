import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AP_PYTHON as PY } from "../../scripts/ap-generation/py";
import { gateMc, type McPack } from "./gates";
import { difficultyContext, gateDifficultySignals, structuralBand, type McWithSignals } from "./stats-difficulty";

// AP Psychology 고차 원형(psych-hard)의 난이도 신호 선언: 결정적 게이트(단계마다 그 단계에서 틀어지는 오답이 있는가)·구조 기준(3단계 + 2개념 → exam_prep)·판정 입력 문구. 무료(네트워크·DB·LLM 없음).
const ARCH = path.resolve(__dirname, "../../scripts/ap-generation/archetypes");
const havePy = spawnSync(PY, ["-c", "import scipy, numpy"], { encoding: "utf-8" }).status === 0;
const d = havePy ? describe : describe.skip;
d("psych-hard difficulty signals", () => {
  const code = "import json,registry as R\nn=[k for k in R.PSYCH_STAGES['psych_mc_all'] if k.startswith('ps_hd_')]\nprint(json.dumps({'names':n,'packs':{k:R.batch(k,4,700) for k in n}}))";
  const r = spawnSync(PY, ["-B", "-c", code], { cwd: ARCH, encoding: "utf-8", maxBuffer: 256 * 1024 * 1024, timeout: 170000 });
  const out = (r.status === 0 ? JSON.parse(r.stdout) : { names: [], packs: {} }) as { names: string[]; packs: Record<string, (McWithSignals & { archetype: string })[]> };
  it("모든 고차 원형 팩이 선언을 가지고 결정적 게이트·구조 기준을 통과한다(3단계 + 2개념 이상, 오답이 단계마다 갈린다)", () => {
    expect(r.status).toBe(0); expect(out.names.length).toBeGreaterThanOrEqual(60);
    for (const n of out.names) for (const p of out.packs[n]) {
      expect(p.difficulty_signals, n).toBeDefined(); expect(gateDifficultySignals(p), `${n}`).toEqual([]);
      const s = p.difficulty_signals!; expect(s.steps.length, n).toBeGreaterThanOrEqual(3); expect(s.concepts.length, n).toBeGreaterThanOrEqual(2); expect(structuralBand(s), n).toBe("exam_prep");
      expect(gateMc("ap_psychology", p as unknown as McPack).filter((x) => /difficulty_signals/.test(x)), n).toEqual([]);
    }
  });
  it("판정 입력 문구는 ap_psychology MC 에만 붙고 선언이 없으면 비어 있다", () => {
    const p = out.packs[out.names[0]][0];
    expect(difficultyContext("ap_psychology", "mc", p)).toMatch(/CODE-COUNTED STRUCTURE/); expect(difficultyContext("ap_psychology", "mc", { ...p, difficulty_signals: undefined })).toBe("");
    expect(difficultyContext("ap_psychology", "frq_bundle", p)).toBe(""); expect(difficultyContext("ap_biology", "mc", p)).toBe("");
  });
  it("단계 부풀리기를 잡는다: 오답이 한 단계에서만 틀어지는 선언은 거부", () => {
    const p = JSON.parse(JSON.stringify(out.packs[out.names[0]][0])) as McWithSignals; for (const k of Object.keys(p.difficulty_signals!.distractor_fail_step)) p.difficulty_signals!.distractor_fail_step[k] = 1;
    expect(gateDifficultySignals(p)).toContain("difficulty_signals_steps_not_load_bearing");
  });
});
