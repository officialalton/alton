// 풀 모의고사 과목별 구성 규칙(순수). 단원 범위는 공식 비중(data/ap/curriculum-2027/<과목>.json weights)을 42문항 등 실제 문항 수에 맞춰 정수로 바꾼 값이다.
// AB 는 기존 OFFICIAL.unitBounds(ab-select.ts)를 그대로 쓴다. 통계는 공식 MC 비중 20-30/15-25/15-25/10-20/10-20 % × 42 → [9,12]/[7,10]/[7,10]/[5,8]/[5,8],
// 스킬(Practice) 5-10/20-30/25-35/25-35 % → [3,4]/[9,12]/[11,14]/[11,14]. 목표 배분(제안, 공식 고정 아님)은 STATS_FULL_TARGET.
import { OFFICIAL } from "./ab-select";
import { microUnitBounds } from "./micro-rules";
import { macroUnitBounds } from "./macro-rules";
import { psychUnitBounds } from "./psych-rules";

export type UnitBounds = Record<string, { min: number; max: number }>;
export const rangeFromPct = ([lo, hi]: [number, number], n: number) => ({ min: Math.ceil((lo * n) / 100 - 1e-9), max: Math.floor((hi * n) / 100 + 1e-9) });

export const STATS_MC_COUNT = 42;
export const STATS_MC_UNIT_PCT: Record<string, [number, number]> = { "1": [20, 30], "2": [15, 25], "3": [15, 25], "4": [10, 20], "5": [10, 20] };
export const STATS_MC_SKILL_PCT: Record<string, [number, number]> = { "1": [5, 10], "2": [20, 30], "3": [25, 35], "4": [25, 35] };
/** 공유 자료 세트: 3문항 세트 2개(CED p.160 샘플·AP Central) — 하나는 확률·확률변수·분포(단원 2), 하나는 회귀(단원 5). 세트의 세 문항은 함께 있어야 한다. */
export const STATS_SETS = [{ unit: "2", items: 3 }, { unit: "5", items: 3 }] as const;
export const STATS_FULL_TARGET = { units: { "1": 10, "2": 9, "3": 9, "4": 7, "5": 7 } as Record<string, number>, skills: { "1": 4, "2": 10, "3": 14, "4": 14 } as Record<string, number> };
export const STATS_FRQ_COUNT = 4;
export const STATS_FRQ_POINTS = 10;

const mapBounds = (pct: Record<string, [number, number]>, n: number): UnitBounds => Object.fromEntries(Object.entries(pct).map(([k, v]) => [k, rangeFromPct(v, n)]));
export const statsUnitBounds = (): UnitBounds => mapBounds(STATS_MC_UNIT_PCT, STATS_MC_COUNT);
export const statsSkillBounds = (): UnitBounds => mapBounds(STATS_MC_SKILL_PCT, STATS_MC_COUNT);

/** 풀 모의고사의 MC 단원 허용 범위. 풀 세트가 아니거나 규칙이 없는 과목은 undefined(단원 점검 안 함). 과목을 AB 로 가정하지 않는다. */
export function fullPracticeUnitBounds(subject: string | null | undefined, label: string | null | undefined): UnitBounds | undefined {
  if (label !== "full_practice") return undefined;
  if (subject === "ap_calculus_ab") return Object.fromEntries(Object.entries(OFFICIAL.unitBounds).map(([u, [min, max]]) => [u, { min, max }]));
  if (subject === "ap_statistics") return statsUnitBounds();
  if (subject === "ap_physics_1") return physUnitBounds();
  if (subject === "ap_chemistry") return chemUnitBounds();
  if (subject === "ap_microeconomics") return microUnitBounds();
  if (subject === "ap_macroeconomics") return macroUnitBounds();
  if (subject === "ap_psychology") return psychUnitBounds();
  if (subject === "ap_computer_science_a") return csaUnitBounds();
  if (subject === "ap_biology") return bioUnitBounds();
  return undefined;
}

export type StatsSetItem = { kind: "mc" | "frq"; unit: string | null; skillCat: string | null; candidateKey: string | null; position: number };
/** 통계 풀 세트 구성 검증(순수): MC 42·FRQ 4, 단원·스킬 범위, 공유 세트 2개(각 3문항, 연속 위치, 단원 2·5). 위반 코드 배열. */
export function verifyStatsFullComposition(items: StatsSetItem[]): string[] {
  const out: string[] = [];
  const mc = items.filter((i) => i.kind === "mc"), frq = items.filter((i) => i.kind === "frq");
  if (mc.length !== STATS_MC_COUNT) out.push(`mc_count_${mc.length}/${STATS_MC_COUNT}`);
  if (frq.length !== STATS_FRQ_COUNT) out.push(`frq_count_${frq.length}/${STATS_FRQ_COUNT}`);
  for (const [u, b] of Object.entries(statsUnitBounds())) { const n = mc.filter((i) => i.unit === u).length; if (n < b.min || n > b.max) out.push(`unit_${u}_${n}_not_in_${b.min}-${b.max}`); }
  for (const [c, b] of Object.entries(statsSkillBounds())) { const n = mc.filter((i) => i.skillCat === c).length; if (n < b.min || n > b.max) out.push(`skill_${c}_${n}_not_in_${b.min}-${b.max}`); }
  const byKey = new Map<string, StatsSetItem[]>();
  for (const i of mc) if (i.candidateKey) byKey.set(i.candidateKey, [...(byKey.get(i.candidateKey) ?? []), i]);
  const sets = [...byKey.values()].filter((v) => v.length > 1);
  if (sets.length !== STATS_SETS.length) out.push(`shared_sets_${sets.length}/${STATS_SETS.length}`);
  for (const s of sets) {
    if (s.length !== 3) out.push(`set_size_${s.length}_not_3`);
    const pos = s.map((x) => x.position).sort((a, b) => a - b);
    if (pos.some((p, i) => i > 0 && p !== pos[i - 1] + 1)) out.push(`set_not_contiguous_${s[0].candidateKey}`);
  }
  const units = sets.map((s) => s[0].unit).sort();
  if (sets.length === STATS_SETS.length && units.join() !== STATS_SETS.map((x) => x.unit).sort().join()) out.push(`set_units_${units.join("+")}_not_${STATS_SETS.map((x) => x.unit).join("+")}`);
  return out;
}

// ---- AP Physics 1 (2027 CED p.170–172, docs/ap/physics1-facts.md) ----
// MC 42 = 단독 + 2문항 공유 세트(공식 세트 수는 미공표 — 우리 구성은 2문항 세트 2개이며 "공식 구성"이라 주장하지 않는다), FRQ 4 = MR/TBR/LAB/QQT 각 1(순서 고정).
// 단원 비중 10-15/18-23/18-23/10-15/10-15/5-8/5-8/10-15 % × 42 → [5,6]/[8,9]/[8,9]/[5,6]/[5,6]/[3,3]/[3,3]/[5,6] (하한 합 = 42 이므로 단원별 문항 수가 한 가지로 정해진다: 5/8/8/5/5/3/3/5).
// 스킬 2.A 15-20 / 2.B 20-25 / 2.C 10-15 / 2.D 10-15 / 3.B 20-25 / 3.C 5-10 % → [7,8]/[9,10]/[5,6]/[5,6]/[9,10]/[3,4] (공식 범위). 현재 원형 재고는 2.B 편중이라 스킬 범위는 목표(비차단 경고)로만 다룬다.
export const PHYS_MC_COUNT = 42;
export const PHYS_MC_UNIT_PCT: Record<string, [number, number]> = { "1": [10, 15], "2": [18, 23], "3": [18, 23], "4": [10, 15], "5": [10, 15], "6": [5, 8], "7": [5, 8], "8": [10, 15] };
export const PHYS_MC_SKILL_PCT: Record<string, [number, number]> = { "2.A": [15, 20], "2.B": [20, 25], "2.C": [10, 15], "2.D": [10, 15], "3.B": [20, 25], "3.C": [5, 10] };
export const PHYS_SET_COUNT = 2;
export const PHYS_SET_SIZE = 2;
export const PHYS_FULL_TARGET = { units: { "1": 5, "2": 8, "3": 8, "4": 5, "5": 5, "6": 3, "7": 3, "8": 5 } as Record<string, number> };
export const PHYS_FRQ_TEMPLATES = ["mr", "tbr", "lab", "qqt"] as const;
export const PHYS_FRQ_COUNT = 4;
export const physUnitBounds = (): UnitBounds => mapBounds(PHYS_MC_UNIT_PCT, PHYS_MC_COUNT);
export const physSkillBounds = (): UnitBounds => mapBounds(PHYS_MC_SKILL_PCT, PHYS_MC_COUNT);

export type PhysSetItem = { kind: "mc" | "frq"; unit: string | null; skill: string | null; candidateKey: string | null; position: number };
/** 물리 풀 세트 구성 검증(순수, 차단 위반만): MC 42·FRQ 4, 단원 범위, 2문항 공유 세트 2개(연속 위치). 스킬 범위는 physSkillWarnings 로 따로 본다. */
export function verifyPhysFullComposition(items: PhysSetItem[]): string[] {
  const out: string[] = [];
  const mc = items.filter((i) => i.kind === "mc"), frq = items.filter((i) => i.kind === "frq");
  if (mc.length !== PHYS_MC_COUNT) out.push(`mc_count_${mc.length}/${PHYS_MC_COUNT}`);
  if (frq.length !== PHYS_FRQ_COUNT) out.push(`frq_count_${frq.length}/${PHYS_FRQ_COUNT}`);
  for (const [u, b] of Object.entries(physUnitBounds())) { const n = mc.filter((i) => i.unit === u).length; if (n < b.min || n > b.max) out.push(`unit_${u}_${n}_not_in_${b.min}-${b.max}`); }
  const byKey = new Map<string, PhysSetItem[]>();
  for (const i of mc) if (i.candidateKey) byKey.set(i.candidateKey, [...(byKey.get(i.candidateKey) ?? []), i]);
  const sets = [...byKey.values()].filter((v) => v.length > 1);
  if (sets.length !== PHYS_SET_COUNT) out.push(`shared_sets_${sets.length}/${PHYS_SET_COUNT}`);
  for (const s of sets) {
    if (s.length !== PHYS_SET_SIZE) out.push(`set_size_${s.length}_not_${PHYS_SET_SIZE}`);
    const pos = s.map((x) => x.position).sort((a, b) => a - b);
    if (pos.some((p, i) => i > 0 && p !== pos[i - 1] + 1)) out.push(`set_not_contiguous_${s[0].candidateKey}`);
  }
  const ft = frq.map((i) => i.candidateKey).filter(Boolean);
  if (new Set(ft).size !== ft.length) out.push("frq_duplicate_key");
  return out;
}
/** 스킬 범위 이탈(경고): 공식 MC 스킬 비중 범위를 벗어난 스킬과 실제 수. */
export function physSkillWarnings(items: PhysSetItem[]): string[] {
  const mc = items.filter((i) => i.kind === "mc");
  return Object.entries(physSkillBounds()).flatMap(([k, b]) => { const n = mc.filter((i) => i.skill === k).length; return n < b.min || n > b.max ? [`skill_${k}_${n}_not_in_${b.min}-${b.max}`] : []; });
}

// ---- AP Chemistry (2027 CED p.205-207, docs/ap/chemistry-facts.md) ----
// MC 60 = 단독 56 + 2문항 공유 세트 2(공식 세트 수·크기는 미공표 — 우리 구성이며 "공식 구성"이라 주장하지 않는다), FRQ 7 = 긴 문항 3(각 10점) + 짧은 문항 4(각 4점) = 7유형 각 1.
// 단원 MC 비중 U3 18-22 / U8 11-15 / 나머지 7-9 % 와 Practice MC 비중 P1 8-12 / P2 8-12 / P4 23-30 / P5 35-42 / P6 8-12 % (Practice 3 은 MC 에서 평가하지 않음)를 60문항에 옮길 때
// 하한은 내림, 상한은 올림(퍼센트 범위를 정수 문항 수로 옮기는 관용 — chem_coverage.count_bounds 와 같음; 비중 합이 78-100% 라 엄격히 올림·내림하면 해가 없다).
// 물리와 달리 스킬(Practice) 범위는 차단 조건이다(2026-10-13 오너: 이번에는 공식 범위 안으로).
export const CHEM_MC_COUNT = 60;
export const CHEM_MC_UNIT_PCT: Record<string, [number, number]> = { "1": [7, 9], "2": [7, 9], "3": [18, 22], "4": [7, 9], "5": [7, 9], "6": [7, 9], "7": [7, 9], "8": [11, 15], "9": [7, 9] };
export const CHEM_MC_PRACTICE_PCT: Record<string, [number, number]> = { "1": [8, 12], "2": [8, 12], "4": [23, 30], "5": [35, 42], "6": [8, 12] };
export const CHEM_SET_COUNT = 2;
export const CHEM_SET_SIZE = 2;
export const CHEM_FRQ_TYPES = ["chf_long_titration", "chf_long_thermo", "chf_long_kinetics", "chf_short_pes", "chf_short_stoich", "chf_short_bonding", "chf_short_equilibrium"] as const;
export const CHEM_FRQ_COUNT = 7;
const floorCeil = ([lo, hi]: [number, number], n: number) => ({ min: Math.floor((lo * n) / 100 + 1e-9), max: Math.ceil((hi * n) / 100 - 1e-9) });
const mapFloorCeil = (pct: Record<string, [number, number]>, n: number): UnitBounds => Object.fromEntries(Object.entries(pct).map(([k, v]) => [k, floorCeil(v, n)]));
export const chemUnitBounds = (): UnitBounds => mapFloorCeil(CHEM_MC_UNIT_PCT, CHEM_MC_COUNT);
export const chemPracticeBounds = (): UnitBounds => mapFloorCeil(CHEM_MC_PRACTICE_PCT, CHEM_MC_COUNT);
/** 공식 비중 상한×60 — 비중 합이 100% 에 닿으려면 모든 단원이 상한 근처여야 해서 실수 목표로 쓴다(U1·2·4·5·6·7·9 5.4, U3 13.2, U8 9.0). */
export const CHEM_FULL_TARGET = { units: Object.fromEntries(Object.entries(CHEM_MC_UNIT_PCT).map(([u, [, hi]]) => [u, (hi * CHEM_MC_COUNT) / 100])) as Record<string, number> };

export type ChemSetItem = { kind: "mc" | "frq"; unit: string | null; skill: string | null; candidateKey: string | null; position: number };
/** 화학 풀 세트 구성 검증(순수, 차단 위반): MC 60·FRQ 7, 단원 범위, Practice(스킬) 범위, 2문항 공유 세트 2개(연속 위치). FRQ 유형·문항군은 계획기가 재고로 따로 본다. */
export function verifyChemFullComposition(items: ChemSetItem[]): string[] {
  const out: string[] = [];
  const mc = items.filter((i) => i.kind === "mc"), frq = items.filter((i) => i.kind === "frq");
  if (mc.length !== CHEM_MC_COUNT) out.push(`mc_count_${mc.length}/${CHEM_MC_COUNT}`);
  if (frq.length !== CHEM_FRQ_COUNT) out.push(`frq_count_${frq.length}/${CHEM_FRQ_COUNT}`);
  for (const [u, b] of Object.entries(chemUnitBounds())) { const n = mc.filter((i) => i.unit === u).length; if (n < b.min || n > b.max) out.push(`unit_${u}_${n}_not_in_${b.min}-${b.max}`); }
  for (const [p, b] of Object.entries(chemPracticeBounds())) { const n = mc.filter((i) => (i.skill ?? "").startsWith(`${p}.`)).length; if (n < b.min || n > b.max) out.push(`practice_${p}_${n}_not_in_${b.min}-${b.max}`); }
  if (mc.some((i) => (i.skill ?? "").startsWith("3."))) out.push("practice_3_not_assessed_in_mc");
  const byKey = new Map<string, ChemSetItem[]>();
  for (const i of mc) if (i.candidateKey) byKey.set(i.candidateKey, [...(byKey.get(i.candidateKey) ?? []), i]);
  const sets = [...byKey.values()].filter((v) => v.length > 1);
  if (sets.length !== CHEM_SET_COUNT) out.push(`shared_sets_${sets.length}/${CHEM_SET_COUNT}`);
  for (const s of sets) {
    if (s.length !== CHEM_SET_SIZE) out.push(`set_size_${s.length}_not_${CHEM_SET_SIZE}`);
    const pos = s.map((x) => x.position).sort((a, b) => a - b);
    if (pos.some((p, i) => i > 0 && p !== pos[i - 1] + 1)) out.push(`set_not_contiguous_${s[0].candidateKey}`);
  }
  const ft = frq.map((i) => i.candidateKey).filter(Boolean);
  if (new Set(ft).size !== ft.length) out.push("frq_duplicate_key");
  return out;
}

// ---- AP Computer Science A (2027 CED, docs/ap/csa-facts.md) ----
// MC 42 = 단독 + 2문항 세트(공식은 "대부분 단독 문항, 가끔 2문항 세트"라고만 밝힌다 — 세트 수는 미공표라 우리 구성은 회마다 1~3개이며 "공식 구성"이라 주장하지 않는다), FRQ 4 = Q1 메서드·제어문 / Q2 클래스 설계 / Q3 ArrayList / Q4 2D 배열 각 1(문항당 9점).
// 단원 MC 비중 U1 15-25 / U2 25-35 / U3 10-18 / U4 30-40 % 와 Practice MC 비중 P1 2-10 / P2 22-38 / P3 37-53 / P4 10-15 / P5 2-10 % 를 42문항에 옮길 때 하한은 내림, 상한은 올림(csa_coverage.count_bounds 와 같음).
// Practice 1·5 는 코드 실행으로 정답을 검증할 수 없어 재고에 없다(하한이 0문항이라 범위 안 조립은 가능). 단원·Practice 범위는 모두 차단 조건이다.
export const CSA_MC_COUNT = 42;
export const CSA_MC_UNIT_PCT: Record<string, [number, number]> = { "1": [15, 25], "2": [25, 35], "3": [10, 18], "4": [30, 40] };
export const CSA_MC_PRACTICE_PCT: Record<string, [number, number]> = { "1": [2, 10], "2": [22, 38], "3": [37, 53], "4": [10, 15], "5": [2, 10] };
export const CSA_SET_SIZE = 2;
export const CSA_SET_COUNT = { min: 1, max: 3 } as const;
export const CSA_FRQ_TYPES = ["q1", "q2", "q3", "q4"] as const;
export const CSA_FRQ_COUNT = 4;
export const csaUnitBounds = (): UnitBounds => mapFloorCeil(CSA_MC_UNIT_PCT, CSA_MC_COUNT);
export const csaPracticeBounds = (): UnitBounds => mapFloorCeil(CSA_MC_PRACTICE_PCT, CSA_MC_COUNT);
/** 공식 비중 중앙값을 42 문항으로 정수화한 목표(제안): U1 8·U2 13·U3 6·U4 15. */
export const CSA_FULL_TARGET = { units: { "1": 8, "2": 13, "3": 6, "4": 15 } as Record<string, number> };

export type CsaSetItem = { kind: "mc" | "frq"; unit: string | null; skill: string | null; candidateKey: string | null; position: number };
/** CS A 풀 세트 구성 검증(순수, 차단 위반): MC 42·FRQ 4, 단원 범위, Practice 범위, 2문항 세트 1~3개(연속 위치). FRQ 유형·문항군·시험 간 구조 중복은 계획기·배정기가 재고로 따로 본다. */
export function verifyCsaFullComposition(items: CsaSetItem[]): string[] {
  const out: string[] = [];
  const mc = items.filter((i) => i.kind === "mc"), frq = items.filter((i) => i.kind === "frq");
  if (mc.length !== CSA_MC_COUNT) out.push(`mc_count_${mc.length}/${CSA_MC_COUNT}`);
  if (frq.length !== CSA_FRQ_COUNT) out.push(`frq_count_${frq.length}/${CSA_FRQ_COUNT}`);
  for (const [u, b] of Object.entries(csaUnitBounds())) { const n = mc.filter((i) => i.unit === u).length; if (n < b.min || n > b.max) out.push(`unit_${u}_${n}_not_in_${b.min}-${b.max}`); }
  for (const [p, b] of Object.entries(csaPracticeBounds())) { const n = mc.filter((i) => (i.skill ?? "").startsWith(`${p}.`)).length; if (n < b.min || n > b.max) out.push(`practice_${p}_${n}_not_in_${b.min}-${b.max}`); }
  const byKey = new Map<string, CsaSetItem[]>();
  for (const i of mc) if (i.candidateKey) byKey.set(i.candidateKey, [...(byKey.get(i.candidateKey) ?? []), i]);
  const sets = [...byKey.values()].filter((v) => v.length > 1);
  if (sets.length < CSA_SET_COUNT.min || sets.length > CSA_SET_COUNT.max) out.push(`shared_sets_${sets.length}_not_in_${CSA_SET_COUNT.min}-${CSA_SET_COUNT.max}`);
  for (const s of sets) {
    if (s.length !== CSA_SET_SIZE) out.push(`set_size_${s.length}_not_${CSA_SET_SIZE}`);
    const pos = s.map((x) => x.position).sort((a, b) => a - b);
    if (pos.some((p, i) => i > 0 && p !== pos[i - 1] + 1)) out.push(`set_not_contiguous_${s[0].candidateKey}`);
  }
  const ft = frq.map((i) => i.candidateKey).filter(Boolean);
  if (new Set(ft).size !== ft.length) out.push("frq_duplicate_key");
  return out;
}

// ---- AP Biology (2027 CED V.1 p.197–201, docs/ap/biology-facts.md) ----
// MC 60 = 단독 + 4문항 공유 세트(공식 "typically 4–5 questions each"; 세트 개수는 미공표 — 우리 구성은 회당 정확히 2개이며 "공식 구성"이라 주장하지 않는다), FRQ 6 = Q1·Q2 긴 문항(각 9점) + Q3–Q6 짧은 문항(각 4점) = 6유형 각 1(34점).
// 단원 MC 비중 U1 8-11 / U2 10-13 / U3 12-16 / U4 10-15 / U5 8-11 / U6 12-16 / U7 13-20 / U8 10-15 % 와 Practice MC 비중 P1 25-33 / P2 16-24 / P3 8-14 / P4 8-14 / P5 8-14 / P6 20-26 % 를 60문항에 옮길 때
// 하한은 내림, 상한은 올림(bio_coverage.count_bounds 와 같음). 둘 다 차단 조건이다(오너 2026-10-13: 공식 단원·Practice 범위를 처음부터 계획에 넣는다).
export const BIO_MC_COUNT = 60;
export const BIO_MC_UNIT_PCT: Record<string, [number, number]> = { "1": [8, 11], "2": [10, 13], "3": [12, 16], "4": [10, 15], "5": [8, 11], "6": [12, 16], "7": [13, 20], "8": [10, 15] };
export const BIO_MC_PRACTICE_PCT: Record<string, [number, number]> = { "1": [25, 33], "2": [16, 24], "3": [8, 14], "4": [8, 14], "5": [8, 14], "6": [20, 26] };
export const BIO_SET_SIZE = 4;
export const BIO_SET_COUNT = 2;
export const BIO_FRQ_TYPES = ["bio_q1_results", "bio_q2_graphing", "bio_q3_investigation", "bio_q4_conceptual", "bio_q5_model", "bio_q6_data"] as const;
export const BIO_FRQ_COUNT = 6;
export const bioUnitBounds = (): UnitBounds => mapFloorCeil(BIO_MC_UNIT_PCT, BIO_MC_COUNT);
export const bioPracticeBounds = (): UnitBounds => mapFloorCeil(BIO_MC_PRACTICE_PCT, BIO_MC_COUNT);
/** 공식 비중 중앙값 × 60(제안, 공식 고정 아님; 중앙값 합이 정확히 100% 라 문항 수 합 60): U1 5.7·U2 6.9·U3 8.4·U4 7.5·U5 5.7·U6 8.4·U7 9.9·U8 7.5. */
export const BIO_FULL_TARGET = { units: Object.fromEntries(Object.entries(BIO_MC_UNIT_PCT).map(([u, [lo, hi]]) => [u, ((lo + hi) / 2 * BIO_MC_COUNT) / 100])) as Record<string, number> };

export type BioSetItem = { kind: "mc" | "frq"; unit: string | null; skill: string | null; candidateKey: string | null; position: number };
/** Biology 풀 세트 구성 검증(순수, 차단 위반): MC 60·FRQ 6, 단원 범위, Practice 범위, 4문항 공유 세트 정확히 2개(연속 위치). FRQ 유형·문항군·시험 간 구조 중복은 계획기·배정기가 재고로 따로 본다. */
export function verifyBioFullComposition(items: BioSetItem[]): string[] {
  const out: string[] = [];
  const mc = items.filter((i) => i.kind === "mc"), frq = items.filter((i) => i.kind === "frq");
  if (mc.length !== BIO_MC_COUNT) out.push(`mc_count_${mc.length}/${BIO_MC_COUNT}`);
  if (frq.length !== BIO_FRQ_COUNT) out.push(`frq_count_${frq.length}/${BIO_FRQ_COUNT}`);
  for (const [u, b] of Object.entries(bioUnitBounds())) { const n = mc.filter((i) => i.unit === u).length; if (n < b.min || n > b.max) out.push(`unit_${u}_${n}_not_in_${b.min}-${b.max}`); }
  for (const [p, b] of Object.entries(bioPracticeBounds())) { const n = mc.filter((i) => (i.skill ?? "").startsWith(`${p}.`)).length; if (n < b.min || n > b.max) out.push(`practice_${p}_${n}_not_in_${b.min}-${b.max}`); }
  if (mc.some((i) => (i.skill ?? "") === "4.A")) out.push("skill_4A_not_assessed_in_mc");
  const byKey = new Map<string, BioSetItem[]>();
  for (const i of mc) if (i.candidateKey) byKey.set(i.candidateKey, [...(byKey.get(i.candidateKey) ?? []), i]);
  const sets = [...byKey.values()].filter((v) => v.length > 1);
  if (sets.length !== BIO_SET_COUNT) out.push(`shared_sets_${sets.length}/${BIO_SET_COUNT}`);
  for (const s of sets) {
    if (s.length !== BIO_SET_SIZE) out.push(`set_size_${s.length}_not_${BIO_SET_SIZE}`);
    const pos = s.map((x) => x.position).sort((a, b) => a - b);
    if (pos.some((p, i) => i > 0 && p !== pos[i - 1] + 1)) out.push(`set_not_contiguous_${s[0].candidateKey}`);
  }
  const ft = frq.map((i) => i.candidateKey).filter(Boolean);
  if (new Set(ft).size !== ft.length) out.push("frq_duplicate_key");
  return out;
}
