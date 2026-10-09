// 문학 소재 씨앗 조립기(2026-10-01): 배치마다 결정론으로 (장르·시점·시대·이름·장소·배경·관계·갈등·도입 방식)을 배정한다.
// 덜 쓴 항목을 우선 고르는 후보 표본 방식이라 소량 배치에서도, 전체 누적에서도 고르게 퍼지고 UsageLedger 상한을 넘지 않는다.
import { createHash } from "node:crypto";
import { NAME_POOL, BANNED_NAMES, type NameEntry } from "./name-pool";
import { SETTINGS, LOCALES, CONFLICTS, RELATIONSHIPS, GENRE_WEIGHTS, GENRES_LIT, ERAS, POVS_LIT, type LitGenre } from "./seed-bank";
import { UsageLedger, type Scopes } from "./usage-caps";

export type LiterarySeed = {
  index: number;
  genre: LitGenre;
  pov: (typeof POVS_LIT)[number];
  styleEra: (typeof ERAS)[number];
  names: string[];
  nameCultures: string[];
  locale: string;
  setting: string;
  relationship: string;
  conflict: string;
  openingStyle: string;
  /** 규격(lib/rw-passages/schema.ts) topicSeed 용 한 줄. */
  topicSeed: string;
};

/** 도입 방식: 'The' 25·'You' 10/60 쏠림을 막기 위해 첫 문장 형태를 순환 배정하고, 금지 첫 단어를 함께 지시한다. */
export const OPENING_STYLES = [
  "구체적인 사물이나 동작으로 시작(관사 The 로 시작하지 말 것)", "인물의 이름으로 시작", "대화 한 줄로 시작", "시간·날짜 표현으로 시작('By', 'On', 'After' 등)",
  "감각 묘사(소리·냄새·촉감)로 시작", "짧은 단언문으로 시작", "부사절·전치사구로 시작('When', 'Although', 'Beside' 등)", "숫자·목록·규칙을 말하며 시작",
  "대명사 I 또는 We 로 시작", "의문문으로 시작", "장소 이름으로 시작", "과거를 회상하는 문장으로 시작('Years later', 'Once' 등)",
];
export const AVOID_FIRST_WORDS = ["the", "you", "it", "there"];

export const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const seedOf = (s: string) => parseInt(createHash("md5").update(s).digest("hex").slice(0, 8), 16);

const POOL = NAME_POOL.filter((n) => !BANNED_NAMES.includes(n.name.toLowerCase()));
const NAMES_BY_CULTURE = POOL.reduce<Record<string, NameEntry[]>>((m, n) => ((m[n.culture] ??= []).push(n), m), {});

/** 가중 순환으로 n건에 장르를 고르게 배분(누적 편차 최소). */
export function allocateGenres(n: number, offset = 0): LitGenre[] {
  const total = Object.values(GENRE_WEIGHTS).reduce((a, b) => a + b, 0);
  const got: Record<string, number> = {};
  const out: LitGenre[] = [];
  for (let i = 0; i < n; i++) {
    const t = offset + i + 1;
    // 누적 목표 대비 가장 모자란 장르를 고른다(결정론, 동률이면 목록 순서).
    let best: LitGenre = GENRES_LIT[0], bestGap = -Infinity;
    for (const g of GENRES_LIT) {
      const gap = (GENRE_WEIGHTS[g] / total) * t - (got[g] ?? 0);
      if (gap > bestGap + 1e-9) { best = g; bestGap = gap; }
    }
    got[best] = (got[best] ?? 0) + 1;
    out.push(best);
  }
  return out;
}

const povFor = (genre: LitGenre, rnd: () => number, secondBudgetOk: boolean): LiterarySeed["pov"] => {
  if (genre === "poetry" || genre === "drama") return "mixed_or_none";
  if (genre === "letter" || genre === "diary" || genre === "memoir" || genre === "personal_essay") return "first";
  const r = rnd();
  if (r < 0.28) return "first";
  if (r < 0.55) return "third_limited";
  if (r < 0.8) return "third_omniscient";
  if (r < 0.9 && secondBudgetOk) return "second";
  return "mixed_or_none";
};

export type ComposeOptions = { n: number; batchId: string; ledger: UsageLedger; scopes?: Partial<Scopes>; indexOffset?: number; samples?: number };

/** n개의 씨앗을 결정론으로 만든다. 상한을 넘지 않는 조합만 장부에 기록한다. 풀이 모자라면 예외. */
export function composeSeeds(opts: ComposeOptions): LiterarySeed[] {
  const { n, batchId, ledger } = opts;
  const scopes: Scopes = { batchId, setId: opts.scopes?.setId };
  const offset = opts.indexOffset ?? 0;
  const genres = allocateGenres(n, offset);
  const out: LiterarySeed[] = [];
  for (let i = 0; i < n; i++) {
    const index = offset + i;
    const rnd = mulberry32(seedOf(`${batchId}|${index}`));
    const genre = genres[i];
    const samples = opts.samples ?? 16;
    let chosen: LiterarySeed | null = null;
    for (let attempt = 0; attempt < 40 && !chosen; attempt++) {
      const pick = <T>(arr: T[], kindOf: (x: T) => [string, string]): T => {
        let best: T = arr[Math.floor(rnd() * arr.length)], bestScore = Infinity;
        for (let k = 0; k < samples + attempt * 4; k++) {
          const c = arr[Math.floor(rnd() * arr.length)];
          const [kind, value] = kindOf(c);
          const score = ledger.globalCount(kind, value) + ledger.count("batch", batchId, kind, value) * 3 + rnd() * 0.5;
          if (score < bestScore) { best = c; bestScore = score; }
        }
        return best;
      };
      const locale = pick(LOCALES, (l) => ["locale", l.place]);
      const setting = pick(SETTINGS, (s) => ["setting", s]);
      const relationship = pick(RELATIONSHIPS, (r) => ["relationship", r]);
      const conflict = pick(CONFLICTS, (c) => ["conflict", c]);
      const styleEra = ERAS[Math.floor(rnd() * ERAS.length)];
      const wantCount = /^(?:two|a pair|cousins|best|old|twin)/.test(relationship) || /\band\b/.test(relationship) ? 2 : 1;
      const names: NameEntry[] = [];
      for (let k = 0; k < wantCount; k++) {
        const useLocaleCulture = rnd() < 0.65;
        const cultures = useLocaleCulture && attempt < 3 ? [locale.culture] : Object.keys(NAMES_BY_CULTURE);
        const cult = cultures[Math.floor(rnd() * cultures.length)];
        const eraPref = styleEra === "19c" || styleEra === "early_20c" ? "classic" : "modern";
        let cands = NAMES_BY_CULTURE[cult].filter((x) => x.era === (rnd() < 0.8 ? eraPref : eraPref === "classic" ? "modern" : "classic"));
        if (!cands.length) cands = NAMES_BY_CULTURE[cult];
        // 이미 상한에 닿은 이름은 후보에서 뺀다(작은 문화권 목록이 먼저 소진돼도 전체가 막히지 않게).
        const open = cands.filter((x) => ledger.globalCount("name", x.name) < ledger.caps.counted.name.global && ledger.count("batch", batchId, "name", x.name) < ledger.caps.counted.name.batch);
        cands = open.length ? open : Object.values(NAMES_BY_CULTURE).flat().filter((x) => ledger.globalCount("name", x.name) < ledger.caps.counted.name.global);
        if (!cands.length) cands = POOL;
        const nm = (() => {
          let best = cands[Math.floor(rnd() * cands.length)], bestScore = Infinity;
          for (let j = 0; j < samples + attempt * 4; j++) {
            const c = cands[Math.floor(rnd() * cands.length)];
            if (names.some((x) => x.name === c.name)) continue;
            const score = ledger.globalCount("name", c.name) + ledger.count("batch", batchId, "name", c.name) * 3 + rnd() * 0.5;
            if (score < bestScore) { best = c; bestScore = score; }
          }
          return best;
        })();
        if (!names.some((x) => x.name === nm.name)) names.push(nm);
      }
      const pov = povFor(genre, rnd, true);
      const cand: LiterarySeed = {
        index, genre, pov, styleEra, names: names.map((x) => x.name), nameCultures: names.map((x) => x.culture),
        locale: locale.place, setting, relationship, conflict,
        openingStyle: OPENING_STYLES[(index * 5 + Math.floor(rnd() * 3)) % OPENING_STYLES.length],
        topicSeed: `${setting} in ${locale.place}; ${relationship} ${conflict}`,
      };
      const v = ledger.check({ names: cand.names, firstWord: "", locale: cand.locale, setting: cand.setting, conflict: cand.conflict, relationship: cand.relationship, pov: cand.pov }, scopes);
      if (v.length === 0) chosen = cand;
    }
    if (!chosen) throw new Error(`씨앗 배정 실패(index ${index}) — 이름·장소·갈등·관계 풀이 상한에 비해 모자랍니다`);
    ledger.commit({ names: chosen.names, firstWord: "", locale: chosen.locale, setting: chosen.setting, conflict: chosen.conflict, relationship: chosen.relationship, pov: chosen.pov }, scopes);
    out.push(chosen);
  }
  return out;
}
