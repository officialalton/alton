// AP Precalculus 풀 모의고사 배정용 재고 로더(읽기 전용, DB 없음). phys-pool.ts 와 같은 재고 정의(자동 통과·결함 0·완전 중복 제외·렌더 게이트 통과·화면 증거 보유)를 Precalculus 에 적용한다.
// 후보 모델: 단독 MC 1개 = 후보 1개(공유 세트 없음), FRQ 번들 = 후보 1개(유형 = payload.template: fc·mn·mp·sy).
// 문항군(fam)은 buildStock 의 원형+토픽 묶음에 구조 look-alike 군집(lib/ap-exam/look-alike.ts)을 합친 값이다 — 한 세트에 같은 군을 두 번 넣지 않는다.
import { existsSync, readdirSync, readFileSync } from "../../lib/ap-generation/data-fs";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { clusterLookAlikes } from "../../lib/ap-exam/look-alike";
import { STOCK_FILES } from "./keys-file";

type Json = Record<string, unknown>;
type Raw = { stockKey: string; apSubjectCode: string; kind: "mc" | "frq_bundle"; validation: string; keywordCode: string; skillPrimary?: string; itemFamilyId: string; payload: Json; duplicateOf?: string | null; archetype?: string; structure?: string; difficultyProvisional?: string | null; difficulty?: unknown };
/** unit: 1–3, skill: "1"·"2"·"3", topic: "2.13", calc: required|not_allowed. */
export type PreItem = { key: string; kind: "mc" | "frq"; unit: number; skill: string; topic: string; calc: string; fam: string; template: string; archetype: string; screen: boolean; batch: string; renderType: string; stimKind: string; /** 이 후보가 기여하는 exam_prep MC 문항 수. */ exam: number };
export const PRE_SUBJECT = "ap_precalculus";

export function preExamCount(r: { kind: string; difficultyProvisional?: string | null; difficulty?: unknown }): number {
  if (r.kind !== "mc") return 0;
  if (Array.isArray(r.difficulty)) return (r.difficulty as ({ label?: string } | null)[]).filter((d) => d?.label === "exam_prep").length;
  return r.difficultyProvisional === "exam_prep" ? 1 : 0;
}

export function loadPrePool(opts: { requireScreen?: boolean; files?: string[] } = {}) {
  const scan = new Set((JSON.parse(readFileSync("data/ap/stock/defect-scan.json", "utf-8")) as { key: string }[]).map((r) => r.key));
  const ev = new Set<string>();
  for (const f of readdirSync("data/ap/screen-evidence").filter((x) => /^evidence-.*\.json$/.test(x))) for (const e of (JSON.parse(readFileSync(`data/ap/screen-evidence/${f}`, "utf-8")) as { entries: { candidate_key: string }[] }).entries) ev.add(e.candidate_key);
  const batchOf = new Map<string, string>(); const raws: Raw[] = [];
  for (const f of opts.files ?? STOCK_FILES) { const p = `data/ap/stock/${f}.json`; if (!existsSync(p)) continue; for (const r of JSON.parse(readFileSync(p, "utf-8")) as Raw[]) { if (r.apSubjectCode !== PRE_SUBJECT || batchOf.has(r.stockKey)) continue; batchOf.set(r.stockKey, f); raws.push(r); } }
  const live = raws.filter((i) => i.validation === "auto_passed" && !scan.has(i.stockKey) && !i.duplicateOf);
  const gated = live.map((i) => ({ i, g: gateCandidate({ stockKey: i.stockKey, candidateKey: i.stockKey, apSubjectCode: i.apSubjectCode, kind: i.kind, payload: i.payload }) })).filter((x) => x.g.status !== "fail");
  const mc = gated.filter((x) => x.i.kind === "mc");
  const cl = clusterLookAlikes(mc.map(({ i }) => ({ key: i.stockKey, family: i.itemFamilyId, archetype: String(i.payload.archetype ?? i.archetype ?? ""), topic: i.keywordCode, stimKind: (i.payload.stimulus as { kind?: string } | undefined)?.kind ?? "none", stem: String((i.payload as { stem?: string }).stem ?? ""), thinking: (i.payload as { blueprint?: { student_thinking?: string[] } }).blueprint?.student_thinking })));
  const all: PreItem[] = gated.map(({ i, g }) => ({
    key: i.stockKey, kind: i.kind === "mc" ? "mc" : "frq", unit: Number(i.keywordCode.split(".")[0]), skill: String(i.skillPrimary ?? ""), topic: i.keywordCode, calc: String((i.payload as { calculator?: string }).calculator ?? ""),
    fam: i.kind === "mc" ? (cl.effectiveFamily.get(i.stockKey) ?? i.itemFamilyId) : i.itemFamilyId, template: i.kind === "frq_bundle" ? String(i.payload.template ?? "") : "",
    archetype: String(i.payload.archetype ?? i.archetype ?? ""), screen: ev.has(i.stockKey), batch: batchOf.get(i.stockKey) ?? "", renderType: g.renderType, stimKind: g.stimKind, exam: preExamCount(i),
  }));
  const pool = opts.requireScreen === false ? all : all.filter((c) => c.screen);
  return { all, pool };
}
