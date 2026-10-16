// AP Statistics 공유 자료 세트(3문항) 모델(2026-10-12 S2-a). 공식 MC 에는 하나의 자료에 3문항이 딸린 세트가 2개(확률·이항·분포 / 회귀) 있다.
// 후보 모델: 세트 1개 = 후보 1개(payload.items 3개 + 공유 stimulus 1개 + set_intro). 생성 파이프라인은 문항을 하나씩 게이트·풀이·검토(flatten)하고,
// 세트는 세 문항이 모두 통과해야 통과(mergeSet)한다. DB 변환(convert.ts)은 문항 3개를 같은 후보 키로 묶어 문제 3건으로 만든다(ap_candidate_problems.item_index).
import type { McPack } from "./gates";

type Json = Record<string, unknown>;
export const STATS_SET_SIZE = 3;
/** 과목별 공유 자료 세트 크기: Statistics 3문항, Physics 1·Chemistry 는 2문항(공식 세트 크기는 미공표 — Chemistry 는 CED 가 "shared stimulus 세트"만 언급). */
export const setSizeOf = (subject: string) => (subject === "ap_biology" ? 4 : subject === "ap_physics_1" || subject === "ap_chemistry" || subject === "ap_computer_science_a" ? 2 : STATS_SET_SIZE); // Biology 공유 자료 세트는 공식 "typically 4–5 questions each" 에 맞춰 4문항
/** 세트 팩(Python 원형 출력): 문항은 각각 독립 MC 팩(자체 설계도·정답·오답 근거)이고 자료는 세트가 한 번만 갖는다. */
export type SetPack = {
  archetype: string; topic: string; skill: string; calculator: string; set_intro: string; stimulus: McPack["stimulus"];
  seed?: number; items: (Omit<McPack, "stimulus"> & { blueprint?: Json })[]; set_size: number; est_seconds: number; facts: string[];
};
export type SetMeta = { id: string; base: string; index: number; size: number; question: string; intro: string };
export type SetMember = McPack & { set: SetMeta; blueprint?: Json };

export const isSetPack = (p: unknown): p is SetPack => !!p && typeof p === "object" && Array.isArray((p as SetPack).items) && typeof (p as SetPack).set_intro === "string";
export const memberKey = (baseKey: string, index: number) => `${baseKey}-q${index + 1}`;
export const baseKeyOf = (key: string) => key.replace(/-q\d+$/, "");
export const setIdOf = (m: { set?: SetMeta }) => m.set?.id ?? null;

/** 세트 팩 → 문항별 McPack(공유 자료 + 세트 소개 문장을 각 문항에 붙여 한 문항만 봐도 풀 수 있게). */
export function flattenSet(pack: SetPack, baseKey: string): SetMember[] {
  return pack.items.map((it, j) => ({
    ...(it as unknown as McPack), stimulus: pack.stimulus, calculator: pack.calculator, facts: pack.facts,
    stem: `${pack.set_intro}\n\n${it.stem}`,
    set: { id: baseKey, base: pack.archetype, index: j, size: pack.items.length, question: it.stem, intro: pack.set_intro },
  } as SetMember));
}

/** 세트 수준 결정적 검사(문항 게이트와 별개): 크기·자료·소개·문항 독립성(한 문항의 정답이 다른 문항 본문에 드러나지 않음). */
export function gateStatsSet(pack: SetPack, opts: { unit?: string; size?: number } = {}): string[] {
  const r: string[] = [];
  const size = opts.size ?? STATS_SET_SIZE;
  if (!Array.isArray(pack.items) || pack.items.length !== size) return [`set_size_${pack.items?.length ?? 0}_not_${size}`];
  if (!pack.set_intro || pack.set_intro.trim().length < 40) r.push("set_intro_missing");
  if (!pack.stimulus || pack.stimulus.kind === "none") r.push("set_without_shared_stimulus");
  const stems = pack.items.map((i) => i.stem.trim().toLowerCase());
  if (new Set(stems).size !== stems.length) r.push("set_duplicate_question");
  pack.items.forEach((it, i) => {
    if (it.options.length !== 4) r.push(`set_item_${i + 1}_option_count_${it.options.length}`);
    const key = (it.options[it.key_index]?.text ?? "").replace(/\$/g, "").trim();
    if (key.length >= 6) pack.items.forEach((o, j) => { if (i !== j && o.stem.replace(/\$/g, "").includes(key)) r.push(`set_item_${j + 1}_stem_contains_item_${i + 1}_answer`); });
  });
  const units = new Set(pack.items.map((i) => i.topic.split(".")[0]));
  if (units.size !== 1) r.push(`set_spans_units_${[...units].sort().join("+")}`);
  if (opts.unit && !units.has(opts.unit)) r.push(`set_unit_${[...units][0]}_not_${opts.unit}`);
  return [...new Set(r)];
}

export type MemberVerdict = { passed: boolean; reasons: string[] };
/** 세트 통과 규칙: 세 문항이 모두 통과해야 하고, 한 문항이라도 반려면 세트 전체가 반려된다(사유에 문항 번호를 붙임). */
export function setVerdict(members: MemberVerdict[], size = STATS_SET_SIZE): MemberVerdict {
  if (members.length !== size) return { passed: false, reasons: [`set_members_${members.length}_of_${size}`] };
  const reasons = members.flatMap((m, i) => (m.passed ? [] : (m.reasons.length ? m.reasons : ["not_passed"]).map((x) => `set_item_${i + 1}:${x}`)));
  return { passed: reasons.length === 0, reasons };
}

/** 통과한 문항(해설 포함 McPack)들을 세트 후보 payload 로 되돌린다(DB 후보 형식: items[] + 공유 stimulus + set_intro). */
export function mergeSet(members: SetMember[]): Json {
  const first = members[0];
  return {
    archetype: first.set.base, topic: first.topic, skill: first.skill, calculator: first.calculator, set_intro: first.set.intro, stimulus: first.stimulus,
    items: members.map((m) => ({ archetype: m.archetype, topic: m.topic, skill: m.skill, stem: m.set.question, options: m.options, key_index: m.key_index, explanation_en: m.explanation_en, est_seconds: m.est_seconds, blueprint: m.blueprint })),
    set_size: members.length, est_seconds: members.reduce((a, m) => a + m.est_seconds, 0), facts: first.facts,
  };
}
