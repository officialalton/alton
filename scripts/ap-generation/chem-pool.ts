// AP Chemistry 풀 모의고사 배정용 재고 로더(읽기 전용, DB 없음). stats-pool.ts 와 같은 재고 정의(자동 통과·결함 0·완전 중복 제외·렌더 게이트 통과·화면 증거 보유)를 화학 과목에 적용한다.
// 후보 모델: 단독 MC 1개 = 후보 1개(문항 1), 공유 세트 = 후보 1개(문항 2: payload.items 의 topic·skill 이 문항별), FRQ 번들 = 후보 1개(유형 = payload.archetype: chf_long_titration … chf_short_equilibrium 7유형).
// 문항군(fam)은 buildStock 의 원형+토픽 묶음에 구조 look-alike 군집(lib/ap-exam/look-alike.ts)을 합친 값이다 — 한 세트에 같은 군을 두 번 넣지 않는다.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { clusterLookAlikes } from "../../lib/ap-exam/look-alike";
import { STOCK_FILES } from "./keys-file";

type Json = Record<string, unknown>;
type Raw = { stockKey: string; apSubjectCode: string; kind: "mc" | "frq_bundle"; validation: string; keywordCode: string; skillPrimary?: string; itemFamilyId: string; payload: Json; duplicateOf?: string | null; archetype?: string; structure?: string; difficultyProvisional?: string | null; difficulty?: unknown };
/** unit: 1–9, skill: 스킬 코드 문자열("2.B"), topic: "3.4". */
export type ChemMember = { unit: number; skill: string; topic: string };
export type ChemItem = { key: string; kind: "mc" | "frq"; shared: boolean; members: ChemMember[]; fam: string; frqType: string; archetype: string; screen: boolean; batch: string; renderType: string; stimKind: string; /** 이 후보가 기여하는 exam_prep MC 문항 수. */ exam?: number };

export function chemMembers(r: Pick<Raw, "kind" | "keywordCode" | "skillPrimary" | "payload">): ChemMember[] {
  const items = Array.isArray(r.payload.items) ? (r.payload.items as Json[]) : null;
  if (r.kind === "mc" && items) return items.map((it) => ({ unit: Number(String(it.topic).split(".")[0]), skill: String(it.skill), topic: String(it.topic) }));
  if (r.kind === "mc") return [{ unit: Number(r.keywordCode.split(".")[0]), skill: String(r.skillPrimary ?? ""), topic: r.keywordCode }];
  return []; // FRQ 번들은 문항 단위 단원·스킬 배분 대상이 아니다(유형 4개 각 1개)
}

export function chemExamCount(r: { kind: string; difficultyProvisional?: string | null; difficulty?: unknown }): number {
  if (r.kind !== "mc") return 0;
  if (Array.isArray(r.difficulty)) return (r.difficulty as ({ label?: string } | null)[]).filter((d) => d?.label === "exam_prep").length;
  return r.difficultyProvisional === "exam_prep" ? 1 : 0;
}

export function loadChemPool(opts: { requireScreen?: boolean; files?: string[] } = {}) {
  const scan = new Set((JSON.parse(readFileSync("data/ap/stock/defect-scan.json", "utf-8")) as { key: string }[]).map((r) => r.key));
  const ev = new Set<string>();
  for (const f of readdirSync("data/ap/screen-evidence").filter((x) => /^evidence-.*\.json$/.test(x))) for (const e of (JSON.parse(readFileSync(`data/ap/screen-evidence/${f}`, "utf-8")) as { entries: { candidate_key: string }[] }).entries) ev.add(e.candidate_key);
  const batchOf = new Map<string, string>(); const raws: Raw[] = [];
  for (const f of opts.files ?? STOCK_FILES) { const p = `data/ap/stock/${f}.json`; if (!existsSync(p)) continue; for (const r of JSON.parse(readFileSync(p, "utf-8")) as Raw[]) { if (r.apSubjectCode !== "ap_chemistry" || batchOf.has(r.stockKey)) continue; batchOf.set(r.stockKey, f); raws.push(r); } }
  const live = raws.filter((i) => i.validation === "auto_passed" && !scan.has(i.stockKey) && !i.duplicateOf);
  const gated = live.map((i) => ({ i, g: gateCandidate({ stockKey: i.stockKey, candidateKey: i.stockKey, apSubjectCode: i.apSubjectCode, kind: i.kind, payload: i.payload }) })).filter((x) => x.g.status !== "fail");
  const first = (r: Raw) => (Array.isArray(r.payload.items) ? (r.payload.items as Json[])[0] : r.payload) as { stem?: string; blueprint?: { student_thinking?: string[] } };
  const mc = gated.filter((x) => x.i.kind === "mc");
  const cl = clusterLookAlikes(mc.map(({ i }) => ({ key: i.stockKey, family: i.itemFamilyId, archetype: String(i.payload.archetype ?? i.archetype ?? ""), topic: i.keywordCode, stimKind: (i.payload.stimulus as { kind?: string } | undefined)?.kind ?? "none", stem: String(first(i).stem ?? ""), thinking: first(i).blueprint?.student_thinking })));
  const all: ChemItem[] = gated.map(({ i, g }) => ({
    key: i.stockKey, kind: i.kind === "mc" ? "mc" : "frq", shared: i.kind === "mc" && Array.isArray(i.payload.items), members: chemMembers(i),
    fam: i.kind === "mc" ? (cl.effectiveFamily.get(i.stockKey) ?? i.itemFamilyId) : i.itemFamilyId, frqType: i.kind === "frq_bundle" ? String(i.payload.archetype ?? i.archetype ?? i.keywordCode) : "",
    archetype: String(i.payload.archetype ?? i.archetype ?? ""), screen: ev.has(i.stockKey), batch: batchOf.get(i.stockKey) ?? "", renderType: g.renderType, stimKind: g.stimKind, exam: chemExamCount(i),
  }));
  const pool = opts.requireScreen === false ? all : all.filter((c) => c.screen);
  return { all, pool };
}
