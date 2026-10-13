// 풀 모의고사가 쓰거나 쓰기로 예약한 문항(저장소 산출물 기준) — 부분 연습 세트 재구성의 제외 목록. 파일 읽기만 한다(DB 없음).
import { existsSync, readFileSync } from "node:fs";
import { published } from "../../scripts/ap-generation/assign-pool";

type G = "mcA" | "mcB" | "frqA" | "frqB";
/** 풀 모의고사 6세트가 쓰는(또는 쓰기로 예약된) 문항. v2 가 빼는 AB#1 문항은 예비로 돌아온다. */
export function fullExamKeys(root = "data/ap/stock") {
  const pub = published(); const pubKeys = [...pub.mcA, ...pub.mcB, ...pub.frqA, ...pub.frqB];
  const v2 = JSON.parse(readFileSync(`${root}/ab1-v2-swap-plan.json`, "utf-8")) as { swaps: { removeKey: string; addKey: string }[] };
  const removed = new Set(v2.swaps.map((s) => s.removeKey)); const adds = v2.swaps.map((s) => s.addKey);
  const drafts: Record<string, string[]> = {};
  for (const s of (JSON.parse(readFileSync(`${root}/exact-assign-5sets-cons.json`, "utf-8")) as { sets: ({ id: string } & Record<G, string[]>)[] }).sets) drafts[s.id] = [...s.mcA, ...s.mcB, ...s.frqA, ...s.frqB];
  const ab1v2 = [...pubKeys.filter((k) => !removed.has(k)), ...adds];
  return { ab1v1: pubKeys, ab1v2, removedByV2: [...removed], draftSets: drafts, all: new Set([...ab1v2, ...Object.values(drafts).flat()]) };
}
export function oldPartialKeys(): Set<string> {
  const f = "data/ap/stock/published-usage.json"; if (!existsSync(f)) return new Set();
  return new Set((JSON.parse(readFileSync(f, "utf-8")) as { stockKey: string; practice: string[] }[]).filter((r) => r.practice?.length).map((r) => r.stockKey));
}


/** 저장 때 겹침 검사에 쓰는 예약 문항 → 사유. DB 에 아직 없는 AB#1 새 버전 추가분과 초안 5세트(저장 여부와 무관)를 막는다. */
export function reservedKeyMap(root = "data/ap/stock"): Map<string, string> {
  const f = fullExamKeys(root); const m = new Map<string, string>();
  for (const k of f.ab1v2) m.set(k, "AB#1 게시본·새 버전(v2) 계획");
  for (const [id, ks] of Object.entries(f.draftSets)) for (const k of ks) m.set(k, `풀 모의고사 초안 ${id}`);
  return m;
}
