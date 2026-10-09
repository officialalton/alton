// 동결 구성(frozen config): 유료 검증 실행 전에 생성기·검토기 프롬프트·난이도 프롬프트·파서·플래그·모델 해시를 커밋된 파일의 기대값과 대조한다.
// 하나라도 다르면 첫 유료 호출 전에 중단한다. 환경 변수는 셸이 아니라 실행 스크립트가 직접 설정한다(셸 환경 누락으로 인한 무효 측정 방지).
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
export type FrozenExpected = { generatorHash: string; reviewerPromptHash: string; difficultyPromptHash: string; parserHash: string; models: Record<string, string>; flags: Record<string, unknown> };
export type FrozenConfig = { version: string; run: string; subject: string; archetypeList: string; seed0: number; candidatesPerCell: number; capUsd: number; repair: boolean; env: Record<string, string>; generatorFiles: string[]; expected: FrozenExpected };
export const sha12 = (t: string | Buffer) => createHash("sha1").update(t).digest("hex").slice(0, 12);
/** 파일 집합 해시: 경로 정렬 + 각 파일 내용 해시(없는 파일은 'missing'). 경로가 달라지면 해시도 달라진다. */
export function fileSetHash(paths: string[], read: (p: string) => Buffer | null = (p) => (existsSync(p) ? readFileSync(p) : null)): string {
  return sha12([...paths].sort().map((p) => { const b = read(p); return `${p}:${b ? sha12(b) : "missing"}`; }).join("\n"));
}
export type Mismatch = { field: string; expected: unknown; actual: unknown };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function verifyFrozen(expected: FrozenExpected, actual: FrozenExpected): Mismatch[] {
  const out: Mismatch[] = [];
  for (const k of ["generatorHash", "reviewerPromptHash", "difficultyPromptHash", "parserHash"] as const) if (expected[k] !== actual[k]) out.push({ field: k, expected: expected[k], actual: actual[k] });
  if (!same(expected.models, actual.models)) out.push({ field: "models", expected: expected.models, actual: actual.models });
  const keys = new Set([...Object.keys(expected.flags), ...Object.keys(actual.flags)]); for (const k of keys) if (!same(expected.flags[k], actual.flags[k])) out.push({ field: `flags.${k}`, expected: expected.flags[k], actual: actual.flags[k] });
  return out;
}
/** 승격 증거로 쓸 수 있는 실행인지: run 디렉터리의 validity.json 이 invalid 이면 제외한다(무효 측정). */
export function isRunValidForPromotion(runDir: string, read: (p: string) => string | null = (p) => (existsSync(p) ? readFileSync(p, "utf-8") : null)): boolean {
  const t = read(`${runDir}/validity.json`); if (!t) return true; try { const v = JSON.parse(t) as { valid?: boolean; excludedFromPromotionEvidence?: boolean }; return v.valid !== false && v.excludedFromPromotionEvidence !== true; } catch { return false; }
}
