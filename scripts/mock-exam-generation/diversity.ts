// 생성 다양성 도구(2026-10-01): (1) 소재 씨앗 배정 (2) 목표 정답 위치 배정·강제 (3) 전역 유사도 인덱스(MinHash)와 문두 집중 게이트. 순수 함수 — DB·API 없음.
import { readFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { reorder, remapExplanation, letterRefs } from "./shuffle-adopted";

const LETTERS = "ABCD";
export type Seed = { category: string; topic: string };
export function loadSeeds(file = "data/mock-exam-generation/seeds.json"): Seed[] {
  const d = JSON.parse(readFileSync(file, "utf-8")) as { categories: Record<string, string[]> };
  // 범주를 번갈아 돌려 인접 후보가 같은 범주가 되지 않게 한다.
  const cats = Object.entries(d.categories);
  const out: Seed[] = [];
  const max = Math.max(...cats.map(([, t]) => t.length));
  for (let i = 0; i < max; i++) for (const [category, topics] of cats) if (topics[i]) out.push({ category, topic: topics[i] });
  return out;
}
/** 후보 n개에 씨앗을 결정적으로 배정: 풀을 (skill 해시)로 회전해 skill 마다 다른 순서, 같은 소재는 풀 전체에서 maxPerTopic 회까지(skill 안에서는 1회). */
export function scheduleSeeds(cands: { skill: string }[], seeds: Seed[], maxPerTopic = 2): Seed[] {
  const total = new Map<string, number>();
  const perSkill = new Map<string, Set<string>>();
  const out: Seed[] = [];
  for (const c of cands) {
    const used = perSkill.get(c.skill) ?? perSkill.set(c.skill, new Set()).get(c.skill)!;
    const offset = parseInt(createHash("md5").update(c.skill).digest("hex").slice(0, 6), 16) % seeds.length;
    let picked: Seed | null = null;
    for (let k = 0; k < seeds.length * 2 && !picked; k++) {
      const s = seeds[(offset + used.size * 7 + k) % seeds.length];
      const key = `${s.category}|${s.topic}`;
      if (used.has(key) || (total.get(key) ?? 0) >= maxPerTopic) continue;
      picked = s;
    }
    if (!picked) throw new Error("씨앗 풀이 후보 수보다 작습니다 — 씨앗 풀을 늘리세요");
    const key = `${picked.category}|${picked.topic}`;
    used.add(key);
    total.set(key, (total.get(key) ?? 0) + 1);
    out.push(picked);
  }
  return out;
}
/** 목표 정답 위치: (skill, idx) 기준 A~D 균등 순환. skill 해시로 시작 위치를 어긋나게 해 전체도 균등. */
export function targetLetterFor(skill: string, idx: number): string {
  const off = parseInt(createHash("md5").update(skill).digest("hex").slice(0, 4), 16) % 4;
  return LETTERS[(idx + off) % 4];
}
const isNumericOptions = (opts: string[]) => opts.every((o) => /^[-+$\s\d.,/%^(){}\\a-z]*\d[-+$\s\d.,/%^(){}\\a-z]*$/i.test(o) && !/[A-Za-z]{4,}/.test(o.replace(/\\[a-z]+/g, "")));
/** 생성 결과의 정답이 목표 위치가 아니면 코드가 선택지를 재배치하고 해설의 글자 참조를 치환한다(숫자 선택지는 오름차순 관례라 건드리지 않음). 변경 여부를 돌려준다. */
export function enforceTarget<G extends { options: string[]; correct_letter: string; explanation: string }>(g: G, target: string): { g: G; changed: boolean; skipped?: string } {
  const cur = LETTERS.indexOf(g.correct_letter), t = LETTERS.indexOf(target);
  if (cur === t) return { g, changed: false };
  if (isNumericOptions(g.options)) return { g, changed: false, skipped: "숫자 선택지" };
  if (g.options.some((o) => letterRefs(o).length)) return { g, changed: false, skipped: "선택지 안 글자 참조" };
  const { options, perm } = reorder(g.options, cur, t);
  const map: Record<string, string> = {};
  perm.forEach((oldIdx, newIdx) => { map[LETTERS[oldIdx]] = LETTERS[newIdx]; });
  return { g: { ...g, options, correct_letter: target, explanation: remapExplanation(g.explanation, map) }, changed: true };
}

// ---- 유사도 인덱스(MinHash) ---------------------------------------------------
const K = 64;
const hashSeed = (s: string, seed: number) => { let h = 2166136261 ^ seed; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export function tokens(text: string): string[] { return text.toLowerCase().replace(/[0-9]+([.,][0-9]+)*/g, "#").replace(/[^a-z#\s가-힣]+/g, " ").split(/\s+/).filter(Boolean); }
export function minhash(text: string): number[] {
  const w = tokens(text), sh = new Set<string>();
  for (let i = 0; i + 3 <= w.length; i++) sh.add(w.slice(i, i + 3).join(" "));
  const sig = new Array(K).fill(0xffffffff);
  for (const s of sh) for (let k = 0; k < K; k++) { const h = hashSeed(s, k * 2654435761); if (h < sig[k]) sig[k] = h; }
  return sig;
}
export const jaccardEst = (a: number[], b: number[]) => a.reduce((n, x, i) => n + (x === b[i] ? 1 : 0), 0) / K;
export const openingKey = (text: string) => tokens(text).slice(0, 3).join(" ");
export type IndexEntry = { id: string; skill: string; sig: number[]; opening: string };
export class SimIndex {
  entries: IndexEntry[] = [];
  constructor(private file?: string) { if (file && existsSync(file)) for (const l of readFileSync(file, "utf-8").split("\n").filter(Boolean)) this.entries.push(JSON.parse(l)); }
  static textOf(p: { stimulus?: string | null; passage?: string | null; question?: string | null; options?: string[] | null }) { return `${p.stimulus ?? p.passage ?? ""} ${p.question ?? ""} ${(p.options ?? []).join(" ")}`; }
  /** 같은 skill 안의 최대 유사도 추정과 그 항목, 그리고 문두 집중도. */
  query(skill: string, text: string): { maxSim: number; of: string | null; openingCount: number } {
    const sig = minhash(text), op = openingKey(text);
    let maxSim = 0, of: string | null = null, openingCount = 0;
    for (const e of this.entries) { if (e.skill !== skill) continue; const s = jaccardEst(sig, e.sig); if (s > maxSim) { maxSim = s; of = e.id; } if (e.opening === op && op) openingCount++; }
    return { maxSim, of, openingCount };
  }
  add(id: string, skill: string, text: string) {
    const e: IndexEntry = { id, skill, sig: minhash(text), opening: openingKey(text) };
    this.entries.push(e);
    if (this.file) { mkdirSync(path.dirname(this.file), { recursive: true }); appendFileSync(this.file, JSON.stringify(e) + "\n"); }
  }
}
export const SIM_BLOCK = 0.6;
export const OPENING_CAP = 3; // 같은 skill 안 같은 문두(처음 3단어) 최대 허용 수
/** 생성 직후(검수 전) 게이트: 유사도 ≥ 0.6 또는 문두 집중이면 사유 문자열을, 통과면 null. */
export function gate(index: SimIndex, skill: string, text: string): string | null {
  const q = index.query(skill, text);
  if (q.maxSim >= SIM_BLOCK) return `유사도 ${q.maxSim.toFixed(2)} ≥ ${SIM_BLOCK} (${q.of})`;
  if (q.openingCount >= OPENING_CAP) return `문두 집중(${q.openingCount}건 이미 같은 문두)`;
  return null;
}
