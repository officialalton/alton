// 초안 세트 계획(순수 함수): 미리 계산된 배정(exact-assign 보고서의 한 세트)을 독립 검증하고, DB 변환 결과와 대조해 초안 세트로 저장할 항목을 만든다.
// 무거운 정수계획(ILP, 분 단위)은 서버에서 돌리지 않는다 — 배정은 저장소에 커밋된 보고서를 읽고, 여기서 배정기와 별개인 verifyAssignment 로 전 조건을 다시 확인한다.
// 공개(publish)는 이 화면에 없다. 저장 상태는 항상 draft.
import { verifyAssignment, type SetResult, type Spec } from "../../scripts/ap-generation/exact-assign";
import { loadPool, type Item } from "../../scripts/ap-generation/assign-pool";
import { apSectionLayout } from "../ap-exam/layouts";
import { planStatsDraftSet } from "./assemble-stats-draft";
import type { StatsItem } from "../../scripts/ap-generation/stats-pool";

export type SetKeys = { mcA: string[]; mcB: string[]; frqA: string[]; frqB: string[] };
export const SECTION: Record<keyof SetKeys, string> = { mcA: "ap_mc_a", mcB: "ap_mc_b", frqA: "ap_frq_a", frqB: "ap_frq_b" };
export const DIFF: Record<string, "easy" | "medium" | "hard"> = { basic_learning: "easy", exam_prep: "medium", advanced_supplement: "hard" };

export type PoolRow = {
  candidate_key: string; kind: string; keyword_code: string; difficulty_provisional: string | null; purpose: string | null; is_current: boolean; render_verified: boolean; screen_verified: boolean;
  ap_candidate_problems: { item_index: number; problem_id: string; problem_version_id: string }[] | null;
};
export type FullSetUsage = { id: string; name: string; status: string; problemIds: string[]; candidateKeys: string[]; label?: string };

/** 세트 ID 접두 → AP 과목. 모르는 접두는 AB 로 가정하지 않고 거부한다(2026-10-12: 통계 등 새 과목이 AB 로 오판되던 문제). */
export const SET_PREFIX_SUBJECT: Record<string, string> = { AB: "ap_calculus_ab", BC: "ap_calculus_bc", ST: "ap_statistics" };
export const SET_ID_RE = /^(AB|BC|ST)\d$/;
export const subjectOfSetIdOrNull = (id: string): string | null => SET_PREFIX_SUBJECT[id.slice(0, 2)] ?? null;
export function subjectOfSetId(id: string): string { const s = subjectOfSetIdOrNull(id); if (!s) throw new Error(`알 수 없는 세트 ID 접두: ${id}`); return s; }
const SUBJECT_TITLE: Record<string, string> = { ap_calculus_ab: "AP Calculus AB", ap_calculus_bc: "AP Calculus BC", ap_statistics: "AP Statistics" };
export const defaultDraftName = (setId: string) => `${SUBJECT_TITLE[subjectOfSetId(setId)]} — Practice Exam ${setId.slice(2)}`;

let poolCache: Item[] | null = null;
/** 구조 묶음(structure-groups.json) 기준 문항군까지 반영한 화면 증거 보유 재고. 프로세스당 한 번만 계산한다. */
export function stockItems(): Item[] {
  return (poolCache ??= loadPool({ strictFamilies: true }).all.filter((c) => c.screen));
}

export type DraftPlan = {
  ok: boolean;
  setId: string; subject: string; name: string;
  problems: string[]; // 사람이 읽는 거부 사유(비어 있으면 저장 가능)
  composition: { mcA: number; mcB: number; frqA: number; frqB: number; mcTotal: number; frqTotal: number };
  items: { sectionKey: string; position: number; problemId: string; versionId: string; satDomain: string; difficulty: "easy" | "medium" | "hard"; candidateKey: string }[];
  layout: { sections: unknown[] };
};

export function planDraftSet(o: {
  setId: string; keys: SetKeys; hasVirtual: boolean; name?: string; pool: PoolRow[]; existingFullSets: FullSetUsage[]; publishedKeys: Set<string>; stock: Item[]; floor?: number; /** 통계 재고(테스트 주입용; 기본은 커밋된 재고 + 화면 증거). */ statsStock?: StatsItem[];
}): DraftPlan {
  const problems: string[] = [];
  const subjectKnown = subjectOfSetIdOrNull(o.setId); const subject = subjectKnown ?? "unknown";
  const name = o.name?.trim() || (subjectKnown ? defaultDraftName(o.setId) : o.setId);
  const need = Object.fromEntries((subjectKnown ? apSectionLayout(subject) : []).map((s) => [s.key, s.count]));
  const g = (k: keyof SetKeys) => o.keys[k] ?? [];
  const composition = { mcA: g("mcA").length, mcB: g("mcB").length, frqA: g("frqA").length, frqB: g("frqB").length, mcTotal: g("mcA").length + g("mcB").length, frqTotal: g("frqA").length + g("frqB").length };
  if (!SET_ID_RE.test(o.setId)) problems.push(`세트 이름 형식 오류: ${o.setId}`);
  else if (o.setId === "AB1") problems.push("AB#1 은 게시 고정 세트라 저장하지 않습니다.");
  if (subjectKnown === "ap_statistics" && SET_ID_RE.test(o.setId)) { // 통계: 공유 세트·FRQ 4유형 구조는 전용 계획기가 독립 검증한다
    const sp = planStatsDraftSet({ setId: o.setId, keys: o.keys, hasVirtual: o.hasVirtual, name, pool: o.pool, existingFullSets: o.existingFullSets, subject, stock: o.statsStock });
    return { ...sp, problems: [...problems, ...sp.problems], ok: problems.length === 0 && sp.ok };
  }
  if (o.hasVirtual) problems.push("이 배정에는 가상 문항(재고에 없는 칸)이 있어 저장하지 않습니다.");
  for (const k of Object.keys(SECTION) as (keyof SetKeys)[]) if (g(k).length !== need[SECTION[k]]) problems.push(`공식 구성 불일치 ${SECTION[k]}: ${g(k).length}/${need[SECTION[k]]}`);
  const all = (Object.keys(SECTION) as (keyof SetKeys)[]).flatMap((k) => g(k).map((key) => ({ key, sec: k })));
  if (new Set(all.map((x) => x.key)).size !== all.length) problems.push("세트 안에 같은 문항이 두 번 들어 있습니다.");

  // 변환·검증 상태(DB): 모의고사 용도로 변환된 현재 재고 + 렌더·화면 검증 완료 + 후보당 문제 1건
  const byKey = new Map(o.pool.map((r) => [r.candidate_key, r]));
  const notReady: string[] = [];
  for (const { key } of all) {
    const r = byKey.get(key);
    if (!r || r.purpose !== "mock_exam" || !r.is_current) { notReady.push(`${key}(변환 안 됨)`); continue; }
    if (!r.render_verified || !r.screen_verified) { notReady.push(`${key}(렌더·화면 검증 미완)`); continue; }
    if ((r.ap_candidate_problems ?? []).length !== 1) notReady.push(`${key}(변환 문제 ${(r.ap_candidate_problems ?? []).length}건 — 후보당 1건만 지원)`);
  }
  if (notReady.length) problems.push(`문제은행 변환·검증이 끝나지 않은 문항 ${notReady.length}건: ${notReady.slice(0, 8).join(", ")}${notReady.length > 8 ? " …" : ""}`);

  // 독립 검증(배정기와 별개): 단원·스킬·계산기·그래프·문항군(구조 묶음)·FRQ 유형 + 게시 AB#1·이미 저장된 풀 세트와 동일 문항 0
  const stockByKey = new Map(o.stock.map((c) => [c.key, c]));
  const blocked = new Set([...o.publishedKeys, ...o.existingFullSets.flatMap((s) => s.candidateKeys)]);
  const pick = (ks: string[]) => ks.map((k) => { const c = stockByKey.get(k); if (!c) problems.push(`재고(화면 증거 보유)에 없는 키 ${k}`); return c; }).filter((c): c is Item => !!c);
  const spec: Spec = { id: o.setId, subj: subjectKnown === "ap_calculus_bc" ? "bc" : "ab", floor: o.floor ?? 10 };
  const res: SetResult = { id: o.setId, mcA: pick(g("mcA")), mcB: pick(g("mcB")), frqA: pick(g("frqA")), frqB: pick(g("frqB")), virtual: [], frqVirtual: [] };
  problems.push(...verifyAssignment([spec], [res], blocked).map((v) => `독립 검증: ${v}`));

  // 중복 저장 거부: 같은 이름, 같은 문제 구성
  const mine = all.map(({ key }) => byKey.get(key)?.ap_candidate_problems?.[0]?.problem_id).filter((x): x is string => !!x);
  if (o.existingFullSets.some((s) => s.name === name)) problems.push(`같은 이름의 세트가 이미 있습니다: ${name}`);
  const sig = [...mine].sort().join(",");
  const same = o.existingFullSets.find((s) => mine.length > 0 && [...s.problemIds].sort().join(",") === sig);
  if (same) problems.push(`같은 문항 구성의 세트가 이미 있습니다: ${same.name}`);
  const overlap = o.existingFullSets.filter((s) => s.problemIds.some((p) => mine.includes(p)));
  for (const s of overlap) problems.push(`저장된 세트 "${s.name}"(${s.status})와 같은 문항이 있습니다.`);

  const items: DraftPlan["items"] = []; const pos: Record<string, number> = {};
  for (const { key, sec } of all) {
    const r = byKey.get(key); const p = r?.ap_candidate_problems?.[0]; if (!r || !p) continue;
    const sk = SECTION[sec]; pos[sk] = (pos[sk] ?? 0) + 1;
    items.push({ sectionKey: sk, position: pos[sk], problemId: p.problem_id, versionId: p.problem_version_id, satDomain: `ap:${r.keyword_code}`, difficulty: DIFF[r.difficulty_provisional ?? ""] ?? "medium", candidateKey: key });
  }
  return { ok: problems.length === 0, setId: o.setId, subject, name, problems, composition, items, layout: { sections: subjectKnown ? apSectionLayout(subject) : [] } };
}
