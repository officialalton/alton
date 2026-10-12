// dry-run 으로 본 계획과 execute 가 같은 계획인지 확인하는 해시(순수 함수). execute 는 계획을 다시 계산해 이 해시와 같을 때만 쓴다.
import { createHash } from "node:crypto";

function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, canon((v as Record<string, unknown>)[k])]));
  return v;
}
export const planHash = (action: string, scope: unknown, effect: unknown): string => createHash("sha256").update(JSON.stringify(canon({ action, scope, effect }))).digest("hex").slice(0, 32);
