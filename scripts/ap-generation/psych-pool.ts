// AP Psychology 풀 모의고사 배정용 재고 로더(읽기 전용, DB 없음). macro-pool.ts·bio-pool.ts 와 같은 재고 정의(자동 통과·결함 0·완전 중복 제외·렌더 게이트 통과·화면 증거 보유)를 Psychology 에 적용한다.
// 후보 모델: 단독 MC 1개 = 후보 1개(문항 1), 공유 세트 = 후보 1개(문항 3: payload.items 의 topic·skill 이 문항별), FRQ 번들 = 후보 1개(유형 = payload.template: aaq / ebq, 시나리오 = payload.archetype psf_*).
// 문항군(fam)은 buildStock 의 원형+토픽 묶음에 구조 look-alike 군집(lib/ap-exam/look-alike.ts)을 합친 값이다 — 한 시험에 같은 군을 두 번 넣지 않는다.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { clusterLookAlikes } from "../../lib/ap-exam/look-alike";
import { STOCK_FILES } from "./keys-file";

type Json = Record<string, unknown>;
type Raw = { stockKey: string; apSubjectCode: string; kind: "mc" | "frq_bundle"; validation: string; keywordCode: string; skillPrimary?: string; itemFamilyId: string; payload: Json; duplicateOf?: string | null; archetype?: string; structure?: string; difficultyProvisional?: string | null; difficulty?: unknown };
/** unit: 1–5, skill: 스킬 코드 문자열("2.B"), topic: "3.7". */
export type PsychMember = { unit: number; skill: string; topic: string };
export type PsychItem = { key: string; kind: "mc" | "frq"; shared: boolean; members: PsychMember[]; fam: string; frqType: string; archetype: string; screen: boolean; batch: string; renderType: string; stimKind: string; /** 같은 질문·같은 정답 문장·같은 자료이면 같은 값(같은 변형의 다른 후보를 두 시험에 넣지 않으려는 지문). */ sig: string; /** 이 후보가 기여하는 exam_prep MC 문항 수. */ exam?: number; /** 고차 원형(ps_hd_*) 문항 수(판정기 라벨과 별개인 모델 없는 대리 지표). */ hd?: number; /** 관리자 새 버전·초안이 단원 수에 쓰는 값 = 후보 keyword_code 의 단원(세트는 전 문항에 같은 값). 배정기는 이 값과 문항 토픽 단원이 같은 후보만 쓴다. */ keyUnit: number };

export function psychMembers(r: Pick<Raw, "kind" | "keywordCode" | "skillPrimary" | "payload">): PsychMember[] {
  const items = Array.isArray(r.payload.items) ? (r.payload.items as Json[]) : null;
  if (r.kind === "mc" && items) return items.map((it) => ({ unit: Number(String(it.topic).split(".")[0]), skill: String(it.skill), topic: String(it.topic) }));
  if (r.kind === "mc") return [{ unit: Number(r.keywordCode.split(".")[0]), skill: String(r.skillPrimary ?? (r.payload as { skill?: string }).skill ?? ""), topic: r.keywordCode }];
  return []; // FRQ 번들은 문항 단위 단원·스킬 배분 대상이 아니다(AAQ 1 + EBQ 1)
}

/** 고차 원형(ps_hd_*) 문항 수: 모델 없는 대리 지표(풀이 단계를 설계 기록에 선언한 원형). */
export function hdCount(r: { kind: string; payload: Json }): number { if (r.kind !== "mc") return 0; const its = Array.isArray(r.payload.items) ? (r.payload.items as Json[]) : [r.payload]; return its.filter((it) => /^ps_hd_|^pss_hd_/.test(String(it.archetype ?? ""))).length; }
export function psychExamCount(r: { kind: string; difficultyProvisional?: string | null; difficulty?: unknown }): number {
  if (r.kind !== "mc") return 0;
  if (Array.isArray(r.difficulty)) return (r.difficulty as ({ label?: string } | null)[]).filter((d) => d?.label === "exam_prep").length;
  return r.difficultyProvisional === "exam_prep" ? 1 : 0;
}

/** 질문 + 자료 + 정답 문장(세트는 세 문항 전부)의 해시: 두 후보의 값이 같으면 학생이 보는 문제가 사실상 같다(선택지 순서만 다름). */
export function mcSig(payload: Json): string {
  const one = (it: Json) => { const opts = (it.options ?? []) as { text?: string }[]; const ki = Number(it.key_index ?? -1); return `${String(it.stem ?? "")}|${String(opts[ki]?.text ?? "")}`; };
  const items = Array.isArray(payload.items) ? (payload.items as Json[]) : [payload];
  return createHash("sha1").update(`${items.map(one).join("#")}|${JSON.stringify(payload.stimulus ?? null)}|${String(payload.set_intro ?? "")}`).digest("hex").slice(0, 12);
}

export function loadPsychPool(opts: { requireScreen?: boolean; files?: string[]; ignorePctFlags?: boolean } = {}) {
  const scan = new Set((JSON.parse(readFileSync("data/ap/stock/defect-scan.json", "utf-8")) as { key: string }[]).map((r) => r.key));
  const ev = new Set<string>();
  for (const f of readdirSync("data/ap/screen-evidence").filter((x) => /^evidence-.*\.json$/.test(x))) for (const e of (JSON.parse(readFileSync(`data/ap/screen-evidence/${f}`, "utf-8")) as { entries: { candidate_key: string }[] }).entries) ev.add(e.candidate_key);
  const batchOf = new Map<string, string>(); const raws: Raw[] = [];
  for (const f of opts.files ?? STOCK_FILES) { const p = `data/ap/stock/${f}.json`; if (!existsSync(p)) continue; for (const r of JSON.parse(readFileSync(p, "utf-8")) as Raw[]) { if (r.apSubjectCode !== "ap_psychology" || batchOf.has(r.stockKey)) continue; batchOf.set(r.stockKey, f); raws.push(r); } }
  const panel = existsSync("data/ap/stock/psych-panel-flags.json") ? new Set(Object.keys(JSON.parse(readFileSync("data/ap/stock/psych-panel-flags.json", "utf-8")) as Record<string, string[]>)) : new Set<string>(); // 두 번째 모델 패널이 반려한 키
  // 감사 지적(2026-10-15): 표의 백분율이 정수 인원과 맞지 않는 후보는 재고에서 뺀다(scripts/audit/psych-table-pct-scan.ts --write 가 만든 목록; 같은 원형의 고친 후보가 새 배치에 있다).
  const pctFlags = existsSync("data/ap/stock/psych-table-pct-flags.json") ? new Set(Object.keys(JSON.parse(readFileSync("data/ap/stock/psych-table-pct-flags.json", "utf-8")) as Record<string, string[]>)) : new Set<string>();
  const live = raws.filter((i) => i.validation === "auto_passed" && !scan.has(i.stockKey) && !i.duplicateOf && !panel.has(i.stockKey) && (opts.ignorePctFlags || !pctFlags.has(i.stockKey)));
  const gated = live.map((i) => ({ i, g: gateCandidate({ stockKey: i.stockKey, candidateKey: i.stockKey, apSubjectCode: i.apSubjectCode, kind: i.kind, payload: i.payload }) })).filter((x) => x.g.status !== "fail");
  const first = (r: Raw) => (Array.isArray(r.payload.items) ? (r.payload.items as Json[])[0] : r.payload) as { stem?: string; blueprint?: { student_thinking?: string[] } };
  const mc = gated.filter((x) => x.i.kind === "mc");
  const cl = clusterLookAlikes(mc.map(({ i }) => ({ key: i.stockKey, family: i.itemFamilyId, archetype: String(i.payload.archetype ?? i.archetype ?? ""), topic: i.keywordCode, stimKind: (i.payload.stimulus as { kind?: string } | undefined)?.kind ?? "none", stem: String(first(i).stem ?? ""), thinking: first(i).blueprint?.student_thinking })));
  const all: PsychItem[] = gated.map(({ i, g }) => ({
    key: i.stockKey, kind: i.kind === "mc" ? "mc" : "frq", shared: i.kind === "mc" && Array.isArray(i.payload.items), members: psychMembers(i),
    fam: i.kind === "mc" ? (cl.effectiveFamily.get(i.stockKey) ?? i.itemFamilyId) : i.itemFamilyId, frqType: i.kind === "frq_bundle" ? String(i.payload.template ?? "") : "",
    archetype: String(i.payload.archetype ?? i.archetype ?? ""), screen: ev.has(i.stockKey), batch: batchOf.get(i.stockKey) ?? "", renderType: g.renderType, stimKind: g.stimKind, sig: i.kind === "mc" ? mcSig(i.payload) : "", exam: psychExamCount(i), hd: hdCount(i), keyUnit: Number(String(i.keywordCode).split(".")[0]),
  }));
  const pool = opts.requireScreen === false ? all : all.filter((c) => c.screen);
  return { all, pool };
}
