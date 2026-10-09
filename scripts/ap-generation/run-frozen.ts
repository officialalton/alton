// 동결 구성 유료 검증 실행기. 환경 변수·구성은 셸이 아니라 이 스크립트가 직접 설정하고, 해시가 커밋된 기대값과 다르면 첫 유료 호출 전에 중단한다.
//   npx tsx scripts/ap-generation/run-frozen.ts --config config/ap-frozen/bio-data-short.v9.json --freeze       # 현재 상태를 기대값으로 기록(유료 호출 없음)
//   npx tsx scripts/ap-generation/run-frozen.ts --config <cfg> --check-only                                     # 해시 대조만(유료 호출 없음). 불일치면 종료 코드 2
//   npx tsx scripts/ap-generation/run-frozen.ts --config <cfg>                                                  # 대조 통과 시 실행(수선 없음, 상한 capUsd 에 진행 중 호출 포함)
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileSetHash, verifyFrozen, type FrozenConfig, type FrozenExpected } from "../../lib/ap-generation/frozen-config";
import { ledgerTotal } from "./ledger-total";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const has = (n: string) => process.argv.includes(n);
const cfgPath = path.resolve(arg("--config", "config/ap-frozen/bio-data-short.v9.json")); const outPath = path.resolve(arg("--out", cfgPath));
const root = path.resolve("data/ap/sample-2027");
const expandFiles = (list: string[]) => list.flatMap((p) => (p.endsWith("/") ? readdirSync(p).filter((f) => /\.(py|ts)$/.test(f) && !f.endsWith(".test.ts")).map((f) => path.join(p, f)) : [p]));

/** 셸 환경을 상속하지 않는다: AP_* 는 모두 제거하고 구성의 값만 설정한다. */
export function controlledEnv(cfg: FrozenConfig, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env = {} as NodeJS.ProcessEnv; for (const [k, v] of Object.entries(base)) if (!k.startsWith("AP_") && v !== undefined) env[k] = v;
  Object.assign(env, cfg.env); env.AP_LIST = cfg.archetypeList; env.AP_CAP_NEW = String(cfg.capUsd); env.AP_FRQ_CANDS = String(cfg.candidatesPerCell); env.AP_ARM = `frozen ${cfg.version}`; delete env.AP_REPAIR; delete env.AP_FEEDBACK_FILE;
  return env;
}
function actualOf(cfg: FrozenConfig, env: NodeJS.ProcessEnv): FrozenExpected {
  const scratch = "_frozen_check"; mkdirSync(path.join(root, scratch), { recursive: true });
  const r = spawnSync("npx", ["tsx", "scripts/ap-generation/pipeline2.ts", "manifest", "--run", scratch, "--subject", cfg.subject, "--seed0", String(cfg.seed0)], { env, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`manifest 계산 실패: ${(r.stderr ?? "").slice(-300)}`);
  const m = JSON.parse(readFileSync(path.join(root, scratch, "run_manifest.json"), "utf-8")) as Record<string, unknown> & { flags: Record<string, unknown>; models: Record<string, string> };
  return { generatorHash: fileSetHash(expandFiles(cfg.generatorFiles)), reviewerPromptHash: String(m.reviewerPromptHash), difficultyPromptHash: String(m.difficultyPromptHash), parserHash: String(m.parserHash), models: m.models, flags: { flatReview: m.flags.flatReview, subjectNotes: m.flags.subjectNotes, requireBlueprint: m.flags.requireBlueprint, legacyItems: m.flags.legacyItems, repair: m.flags.repair } };
}
function stage(cfg: FrozenConfig, env: NodeJS.ProcessEnv, st: string) {
  const r = spawnSync("npx", ["tsx", "scripts/ap-generation/pipeline2.ts", st, "--run", cfg.run, "--subject", cfg.subject, "--seed0", String(cfg.seed0), "--sync"], { env, encoding: "utf-8" }); const last = (r.stdout ?? "").trim().split("\n").slice(-1)[0] ?? ""; console.log(`[${st}] ${last.slice(0, 150)}`); if (r.status !== 0) throw new Error(`${st} 실패: ${(r.stderr ?? "").slice(-300)}`);
}
const spentSince = (cfg: FrozenConfig) => { const b = path.join(root, cfg.run, "baseline.json"); if (!existsSync(b)) return 0; const base = (JSON.parse(readFileSync(b, "utf-8")) as { spent: number }).spent; return (JSON.parse(readFileSync(path.join(root, "ledger.json"), "utf-8")) as { spent: number }).spent - base; };

function main() {
  const cfg = JSON.parse(readFileSync(cfgPath, "utf-8")) as FrozenConfig; const env = controlledEnv(cfg);
  if (cfg.repair) throw new Error("이 실행기는 수선을 실행하지 않는다(repair=false 여야 함).");
  const actual = actualOf(cfg, env);
  if (has("--freeze")) { writeFileSync(outPath, JSON.stringify({ ...cfg, expected: actual }, null, 1)); console.log(`동결 구성 기록: ${path.relative(process.cwd(), outPath)}`, actual); return 0; }
  const mism = verifyFrozen(cfg.expected, actual);
  if (mism.length) { console.error("ABORT: 동결 구성 해시 불일치 — 유료 호출 전에 중단", JSON.stringify(mism, null, 1)); mkdirSync(path.join(root, "_frozen_check"), { recursive: true }); writeFileSync(path.join(root, "_frozen_check", "abort.json"), JSON.stringify({ at: new Date().toISOString(), config: cfg.version, mismatches: mism }, null, 1)); return 2; }
  console.log("동결 구성 일치(생성기·검토기·난이도·파서·모델·플래그)"); if (has("--check-only")) return 0;
  const before = ledgerTotal(); console.log(`시작 누적 $${before.cumulativeUsd} (무효 측정 포함: ${before.includesInvalidMeasurements.map((x) => `${x.run} $${x.usd}`).join(", ")})`);
  for (const st of ["plan", "blueprint", "gen", "check", "solve", "review", "review-retry", "review-retry2", "difficulty", "verdicts"]) {
    if (!["plan", "blueprint", "check", "verdicts"].includes(st) && spentSince(cfg) >= cfg.capUsd * 0.98) { console.log(`상한 근접(${spentSince(cfg).toFixed(3)} / ${cfg.capUsd}) — ${st} 전에 중단`); break; }
    stage(cfg, env, st);
    if (st === "plan") { const mp = path.join(root, cfg.run, "run_manifest.json"); const m = JSON.parse(readFileSync(mp, "utf-8")); writeFileSync(mp, JSON.stringify({ ...m, generatorHash: actual.generatorHash, frozenConfig: `${path.relative(process.cwd(), cfgPath)}@${cfg.version}`, validity: "valid", repairDefinition: "none (repair not run in this round)" }, null, 1)); }
  }
  const after = ledgerTotal(); console.log(`이번 실행 비용 $${spentSince(cfg).toFixed(4)} / 상한 $${cfg.capUsd}; 누적 $${after.cumulativeUsd} (무효 측정 포함: ${after.includesInvalidMeasurements.map((x) => `${x.run} $${x.usd}`).join(", ")}), 중단선 $${after.stopLine} 여유 $${after.headroomToStopLine}`);
  return 0;
}
if (require.main === module) { try { process.exit(main()); } catch (e) { console.error(e instanceof Error ? e.message : e); process.exit(1); } }
