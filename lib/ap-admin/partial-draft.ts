// 부분 연습 세트(Non-Calculator / Calculator / Free-Response) 초안 계획(순수 함수, 2026-10-12 오너: 풀 모의고사·부분 세트끼리 문항 겹침 0으로 재구성).
// 계획 파일(data/ap/stock/assembled/partial-rebuild-*.json)에서 세트 하나를 골라 배정기와 별개인 검증을 다시 하고, DB 변환 결과와 대조해 초안으로 저장할 항목을 만든다.
// 공개는 이 화면에 없다. 저장 상태는 항상 draft. 겹침 기준은 "비보관 AP 세트 전부(풀·부분) + 예약 문항(AB#1 새 버전 추가분, 저장 예정 초안)" 이다.
import type { Item } from "../../scripts/ap-generation/assign-pool";
import { shortFrqLayout } from "../ap-exam/assemble";
import { AP_PARTIAL_SUBJECTS, AP_PARTIALS, apUnitsFromDomains, partialLabelAllowed, partialSetName, sectionsForPartial, type ApPartialId, type ApSection } from "../ap-exam/layouts";
import { DIFF, SECTION, type FullSetUsage, type PoolRow, type SetKeys } from "./assemble-draft";

export type PartialPlanSet = { id: string; partial: ApPartialId; name: string; keys: SetKeys };
export type PartialPlanFile = { kind: "ap_partial_rebuild_plan"; subject: string; sets: PartialPlanSet[] };
export const PARTIAL_PLAN_FILE_RE = /^partial-rebuild-[A-Za-z0-9.-]+\.json$/;
const SEC_KEYS = ["mcA", "mcB", "frqA", "frqB"] as const;
/** MC 문항군당 최대 문항 수(기존 부분 세트 규칙 2 — 구조 묶음 기준). 1 이 권장이며 2 이상은 점검 결과에 별도 표시한다. */
export const PARTIAL_MC_FAMILY_CAP = 2;

export type PartialDraftPlan = {
  ok: boolean; id: string; subject: string; partial: ApPartialId; name: string; label: "mc_practice" | "frq_practice";
  problems: string[];
  composition: { mcA: number; mcB: number; frqA: number; frqB: number; mcTotal: number; frqTotal: number };
  /** 이 세트가 다루는 단원(번호 오름차순). 시작·결과 화면의 "Covers Units …" 안내와 같은 값. */
  units: string[];
  stats: { graphMc: number; doubledFamilies: number; short: boolean };
  items: { sectionKey: string; position: number; problemId: string; versionId: string; satDomain: string; difficulty: "easy" | "medium" | "hard"; candidateKey: string }[];
  layout: { sections: ApSection[] };
};

/** 부분 세트가 요구하는 섹션별 문항 수. FRQ 는 공식(2+4) 또는 짧은 연습(2~4 묶음). */
export function expectedCounts(subject: string, partial: ApPartialId, k: SetKeys): { need: Record<keyof SetKeys, number>; short: boolean; layout: ApSection[]; problems: string[] } {
  const secs = sectionsForPartial(subject, partial); const cnt = (key: string) => secs.find((x) => x.key === key)?.count ?? 0;
  const problems: string[] = [];
  if (partial === "noncalc_mc") return { need: { mcA: cnt("ap_mc_a"), mcB: 0, frqA: 0, frqB: 0 }, short: false, layout: secs, problems };
  if (partial === "calc_mc") return { need: { mcA: 0, mcB: cnt("ap_mc_b"), frqA: 0, frqB: 0 }, short: false, layout: secs, problems };
  const a = k.frqA.length, b = k.frqB.length;
  if (a === cnt("ap_frq_a") && b === cnt("ap_frq_b")) return { need: { mcA: 0, mcB: 0, frqA: a, frqB: b }, short: false, layout: secs, problems };
  if (a + b >= 2 && a + b <= 4) return { need: { mcA: 0, mcB: 0, frqA: a, frqB: b }, short: true, layout: shortFrqLayout(subject, a, b), problems };
  problems.push(`Free-Response 구성 오류: 공식(Part A ${cnt("ap_frq_a")} + Part B ${cnt("ap_frq_b")}) 또는 짧은 연습(2~4 묶음)이어야 합니다(현재 A ${a} + B ${b}).`);
  return { need: { mcA: 0, mcB: 0, frqA: a, frqB: b }, short: false, layout: secs, problems };
}

export function planPartialDraftSet(o: {
  set: PartialPlanSet; subject: string; name?: string; pool: PoolRow[];
  /** DB 의 비보관 AP 세트 전부(풀 + 부분 연습). 같은 이름·같은 문항 거부와 겹침 0 검사에 쓴다. */
  existingSets: FullSetUsage[];
  /** 아직 DB 에 없지만 쓰면 안 되는 예약 문항(AB#1 새 버전 추가분, 저장 예정 초안 세트 문항 등) → 사유 */
  reservedKeys: Map<string, string>;
  /** 구조 묶음 문항군까지 반영한 화면 증거 보유 재고. */
  stock: Item[];
}): PartialDraftPlan {
  const { set } = o; const problems: string[] = [];
  const name = o.name?.trim() || set.name;
  const g = (k: keyof SetKeys) => set.keys[k] ?? [];
  const composition = { mcA: g("mcA").length, mcB: g("mcB").length, frqA: g("frqA").length, frqB: g("frqB").length, mcTotal: g("mcA").length + g("mcB").length, frqTotal: g("frqA").length + g("frqB").length };
  if (!AP_PARTIAL_SUBJECTS.includes(o.subject)) problems.push(`부분 연습 세트를 지원하지 않는 과목: ${o.subject}`);
  if (!(set.partial in AP_PARTIALS)) { problems.push(`알 수 없는 부분 세트 종류: ${set.partial}`); return empty(o, name, composition, problems); }
  const officialName = partialSetName(o.subject, set.partial);
  const ex = expectedCounts(o.subject, set.partial, set.keys); problems.push(...ex.problems);
  // 이름: 공식 이름이거나 번호 접미("… 2")만 허용 — 임의 이름·번호 없는 변형으로 라벨을 흉내 내지 않는다.
  if (name !== officialName && !new RegExp(`^${officialName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} [2-9]$`).test(name)) problems.push(`이름은 공식 부분 연습 이름(${officialName}) 또는 번호 접미만 쓸 수 있습니다: ${name}`);
  for (const k of SEC_KEYS) if (!ex.problems.length && g(k).length !== ex.need[k]) problems.push(`공식 구성 불일치 ${SECTION[k]}: ${g(k).length}/${ex.need[k]}`);
  if (!ex.short && !ex.problems.length) { const filled = Object.fromEntries(SEC_KEYS.map((k) => [SECTION[k], g(k).length])); if (!partialLabelAllowed(o.subject, set.partial, filled)) problems.push("공식 문항 수를 채우지 못해 이 세트 이름·배지를 쓸 수 없습니다."); }
  const all = SEC_KEYS.flatMap((k) => g(k).map((key) => ({ key, sec: k })));
  if (new Set(all.map((x) => x.key)).size !== all.length) problems.push("세트 안에 같은 문항이 두 번 들어 있습니다.");

  // 변환·검증 상태(DB)
  const byKey = new Map(o.pool.map((r) => [r.candidate_key, r]));
  const notReady: string[] = [];
  for (const { key } of all) {
    const r = byKey.get(key);
    if (!r || r.purpose !== "mock_exam" || !r.is_current) { notReady.push(`${key}(변환 안 됨)`); continue; }
    if (!r.render_verified || !r.screen_verified) { notReady.push(`${key}(렌더·화면 검증 미완)`); continue; }
    if ((r.ap_candidate_problems ?? []).length !== 1) notReady.push(`${key}(변환 문제 ${(r.ap_candidate_problems ?? []).length}건 — 후보당 1건만 지원)`);
  }
  if (notReady.length) problems.push(`문제은행 변환·검증이 끝나지 않은 문항 ${notReady.length}건: ${notReady.slice(0, 8).join(", ")}${notReady.length > 8 ? " …" : ""}`);

  // 독립 검증: 재고 존재·AB 전용·계산기·문항군·FRQ 유형
  const stockByKey = new Map(o.stock.map((c) => [c.key, c]));
  const pick = (ks: string[]) => ks.map((k) => { const c = stockByKey.get(k); if (!c) problems.push(`재고(화면 증거 보유)에 없는 키 ${k}`); return c; }).filter((c): c is Item => !!c);
  const sec = { mcA: pick(g("mcA")), mcB: pick(g("mcB")), frqA: pick(g("frqA")), frqB: pick(g("frqB")) };
  const every = [...sec.mcA, ...sec.mcB, ...sec.frqA, ...sec.frqB];
  const subj = o.subject === "ap_calculus_bc" ? "bc" : "ab";
  for (const c of every) {
    if (c.subj !== subj) problems.push(`${c.key}: ${subj.toUpperCase()} 세트에 다른 과목 문항`);
    if (c.bcOnly) problems.push(`${c.key}: BC 전용 주제 문항은 부분 연습 세트에 넣지 않습니다.`);
    if (subj === "ab" && c.native) problems.push(`${c.key}: BC 전용 FRQ 는 AB 세트에 넣지 않습니다.`);
  }
  if (sec.mcA.some((c) => c.kind !== "mc" || c.calc !== "not_allowed") || sec.mcB.some((c) => c.kind !== "mc" || c.calc !== "required")) problems.push("계산기 조건 위반(Part A MC = 계산기 불가, Part B MC = 그래핑 계산기 필수).");
  if (sec.frqA.some((c) => c.kind !== "frq" || c.calc !== "required") || sec.frqB.some((c) => c.kind !== "frq" || c.calc === "required")) problems.push("FRQ 계산기 조건 위반(Part A = 계산기 허용, Part B = 계산기 불가).");
  const mc = [...sec.mcA, ...sec.mcB]; const fr = [...sec.frqA, ...sec.frqB];
  const famCount = new Map<string, number>(); for (const c of mc) famCount.set(c.fam, (famCount.get(c.fam) ?? 0) + 1);
  const over = [...famCount].filter(([, n]) => n > PARTIAL_MC_FAMILY_CAP); if (over.length) problems.push(`MC 문항군 상한 ${PARTIAL_MC_FAMILY_CAP} 초과: ${over.map(([f, n]) => `${f}(${n})`).join(", ")}`);
  if (fr.length && (new Set(fr.map((c) => c.type)).size !== fr.length || new Set(fr.map((c) => c.fam)).size !== fr.length)) problems.push("FRQ 서로 다른 유형·문항군 조건 위반.");

  // 겹침 0: 비보관 AP 세트 전부(풀·부분) + 예약 문항. 이름이 같은 세트가 있으면 먼저 보관해야 한다.
  const mine = all.map(({ key }) => byKey.get(key)?.ap_candidate_problems?.[0]?.problem_id).filter((x): x is string => !!x);
  const dupName = o.existingSets.find((s) => s.name === name);
  if (dupName) problems.push(`같은 이름의 비보관 세트가 이미 있습니다: ${name} (${dupName.status}). 이전 세트를 먼저 '보관' 처리한 뒤 저장하세요.`);
  const sig = [...mine].sort().join(",");
  const same = o.existingSets.find((s) => mine.length > 0 && [...s.problemIds].sort().join(",") === sig);
  if (same) problems.push(`같은 문항 구성의 세트가 이미 있습니다: ${same.name}`);
  for (const s of o.existingSets) { const n = s.problemIds.filter((p) => mine.includes(p)).length; if (n) problems.push(`비보관 세트 "${s.name}"(${s.status})와 같은 문항 ${n}건 — 겹침 0 위반${s.status === "published" ? "(보관 처리 후 다시 시도)" : ""}.`); }
  for (const { key } of all) { const why = o.reservedKeys.get(key); if (why) problems.push(`${key}: 예약된 문항(${why})`); }

  const items: PartialDraftPlan["items"] = []; const pos: Record<string, number> = {};
  for (const { key, sec: s2 } of all) {
    const r = byKey.get(key); const p = r?.ap_candidate_problems?.[0]; if (!r || !p) continue;
    const sk = SECTION[s2]; pos[sk] = (pos[sk] ?? 0) + 1;
    items.push({ sectionKey: sk, position: pos[sk], problemId: p.problem_id, versionId: p.problem_version_id, satDomain: `ap:${r.keyword_code}`, difficulty: DIFF[r.difficulty_provisional ?? ""] ?? "medium", candidateKey: key });
  }
  const units = apUnitsFromDomains(items.map((i) => i.satDomain));
  if (!units.length) problems.push("다루는 단원을 알 수 없습니다(문항에 단원 코드가 없음).");
  return {
    ok: problems.length === 0, id: set.id, subject: o.subject, partial: set.partial, name, label: AP_PARTIALS[set.partial].label as "mc_practice" | "frq_practice", problems, composition, units,
    stats: { graphMc: mc.filter((c) => c.graph).length, doubledFamilies: [...famCount].filter(([, n]) => n > 1).length, short: ex.short },
    items, layout: { sections: ex.layout },
  };
}

function empty(o: { set: PartialPlanSet; subject: string }, name: string, composition: PartialDraftPlan["composition"], problems: string[]): PartialDraftPlan {
  return { ok: false, id: o.set.id, subject: o.subject, partial: o.set.partial, name, label: "mc_practice", problems, composition, units: [], stats: { graphMc: 0, doubledFamilies: 0, short: false }, items: [], layout: { sections: [] } };
}
