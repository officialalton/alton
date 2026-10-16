// RW 선택형 문항 '정답 누설' 탐지기(2026-10-08). 순수 함수만 — 부수효과·DB·모델 호출 없음(게이트·감사 스크립트가 가져다 쓴다).
// 사건: 질문이 주장을 그대로 말하고 정답이 그것을 거의 그대로 반복하는데 오답은 구조가 달라, 자료를 안 읽어도 질문과 닮은 선택지를 고르면 맞는다.
// 실제 시험은 오답도 정답의 틀(문장 구조·어휘)을 흉내 내되 자료와 어긋나게 만든다.
// 신호: (a) 질문↔선택지 어휘 겹침(정답이 단독 최고 + 마진), (b) 질문과 같은 n-gram 을 정답만 그대로 반복(mirror),
//       (c) 선택지 구조 비대칭(정답만 틀이 다름)·길이 이상치. 최종 판정은 LLM 블라인드 풀이(질문+선택지만, 지문·자료 없이)로 확인한다.

export type LeakInput = { question: string; options: string[]; correctIndex: number; skill: string; passage?: string | null };

const STOP = new Set(("a an the of to in on at by for with from as is are was were be been being it its this that these those and or but not no nor so than then there their they them he she his her we our you your i which who whom whose what when where while about into over under between among across per such more most less least very also can could may might would should will shall do does did has have had any each both either neither one two three four other another only just same some many much how why choice choices most effectively uses use data support supports statement complete following text claim claims").split(" "));

const stem = (w: string) => w.replace(/(?:ing|ed|es|s|ly)$/, "").replace(/(.)\1$/, "$1");
export const tokens = (s: string) => s.replace(/<\/?u>/g, "").toLowerCase().replace(/[$\\^{}]/g, " ").replace(/[^a-z0-9.%\s]/g, " ").replace(/\.(?!\d)/g, " ").split(/\s+/).filter(Boolean);
export const contentWords = (s: string) => tokens(s).filter((t) => !STOP.has(t)).map(stem);
const wordCount = (s: string) => (s.match(/\S+/g) ?? []).length;

export type Idf = Map<string, number>;
/** 문서 모음(질문·선택지 텍스트)에서 IDF 를 만든다. 유형별로 따로 만들어 그 유형의 흔한 어휘가 가중치를 낮게 받게 한다. */
export function buildIdf(docs: string[]): Idf {
  const df = new Map<string, number>();
  for (const d of docs) for (const w of new Set(contentWords(d))) df.set(w, (df.get(w) ?? 0) + 1);
  const n = Math.max(1, docs.length);
  const out: Idf = new Map();
  for (const [w, c] of df) out.set(w, Math.log((n + 1) / (c + 1)) + 1);
  return out;
}
const vec = (s: string, idf: Idf) => {
  const v = new Map<string, number>();
  for (const w of contentWords(s)) v.set(w, (v.get(w) ?? 0) + (idf.get(w) ?? Math.log(2) + 1));
  return v;
};
const cosine = (a: Map<string, number>, b: Map<string, number>) => {
  let dot = 0, na = 0, nb = 0;
  for (const [k, x] of a) { na += x * x; const y = b.get(k); if (y) dot += x * y; }
  for (const y of b.values()) nb += y * y;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
};
const jaccard = (a: string, b: string) => {
  const A = new Set(contentWords(a)), B = new Set(contentWords(b));
  if (!A.size || !B.size) return 0;
  let i = 0; for (const x of A) if (B.has(x)) i++;
  return i / (A.size + B.size - i);
};
/** 질문과 같은 연속 토큰열(불용어 제외 내용어 ≥3 포함)의 최대 길이. */
export function mirrorRun(question: string, option: string): number {
  const q = tokens(question), o = tokens(option);
  let best = 0;
  const dp = new Array(o.length + 1).fill(0);
  for (let i = 1; i <= q.length; i++) {
    for (let j = o.length; j >= 1; j--) {
      dp[j] = q[i - 1] === o[j - 1] ? dp[j - 1] + 1 : 0;
      if (dp[j] > best) {
        const run = o.slice(j - dp[j], j);
        if (run.filter((t) => !STOP.has(t)).length >= 3) best = dp[j];
      }
    }
  }
  return best;
}
const shape = (s: string) => tokens(s).map((t) => (/\d/.test(t) ? "#" : t));
const bigrams = (s: string) => { const t = shape(s), r = new Set<string>(); for (let i = 0; i < t.length - 1; i++) r.add(`${t[i]} ${t[i + 1]}`); return r; };
const setSim = (a: Set<string>, b: Set<string>) => { if (!a.size || !b.size) return 0; let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i); };
/** 틀(구조) 유사도: 숫자를 #로 접은 bigram Jaccard 와 첫 세 토큰 일치의 평균. */
export function frameSim(a: string, b: string): number {
  const ta = shape(a).slice(0, 3).join(" "), tb = shape(b).slice(0, 3).join(" ");
  return (setSim(bigrams(a), bigrams(b)) + (ta === tb ? 1 : 0)) / 2;
}

/** 질문 내용어 중 '그 선택지에만(4개 중 1개에만)' 나오는 토큰 수 — 질문이 말한 주체(예: Painter C)를 정답만 반복하면 정답이 눈에 띈다. */
export function discriminatingOverlap(question: string, options: string[]): number[] {
  const q = new Set(contentWords(question));
  const sets = options.map((o) => new Set(contentWords(o)));
  return sets.map((s, i) => [...s].filter((w) => q.has(w) && sets.filter((t) => t.has(w)).length === 1 && sets[i].has(w)).length);
}

/** 선택지 앞부분(주어) 토큰 중 질문에 나오고 다른 선택지의 주어에는 없는 것 — 질문이 지목한 대상(Painter C)을 주어로 삼은 선택지가 정답뿐이면 눈에 띈다. */
export function subjectMatches(question: string, options: string[]): number[] {
  const q = new Set(contentWords(question));
  const subj = options.map((o) => new Set(contentWords(tokens(o).slice(0, 4).join(" "))));
  return subj.map((s, i) => [...s].filter((w) => q.has(w) && subj.every((t, j) => j === i || !t.has(w))).length);
}

export type SkillPolicy = { lexical: boolean; parity: boolean; marginCos: number; minCos: number; mirrorMin: number; mirrorGap: number; frameGap: number; lengthRatio: number; uniqueMin: number; entity: boolean };
const DEFAULT: SkillPolicy = { lexical: true, parity: true, marginCos: 0.18, minCos: 0.35, mirrorMin: 5, mirrorGap: 3, frameGap: 0.2, lengthRatio: 1.3, uniqueMin: 1, entity: false };
/** entity(주체·수치 일치) 검사는 서사 유형에서는 질문 어휘가 자연스레 정답에 반복돼 오탐이 많아 기본 꺼 둔다(2026-10-08 보정). */
/** 질문이 지문과 무관한 고정 문구뿐인 유형(어휘·구두점·전환·형식)은 질문↔선택지 겹침이 정보가 아니므로 어휘 검사를 끈다. */
export const SKILL_POLICY: Record<string, Partial<SkillPolicy>> = {
  // 질문에 목표(goal)가 들어 있고 정답이 그 목표를 반영하는 것이 정상 — 마진을 크게 본다.
  rhetorical_synthesis: { marginCos: 0.3, minCos: 0.5, mirrorMin: 7, mirrorGap: 4, parity: false, entity: false },
  words_in_context: { lexical: false, parity: false },
  boundaries: { lexical: false, parity: false },
  form_structure_sense: { lexical: false, parity: false },
  transitions: { lexical: false, parity: false },
  text_structure_purpose: { lexical: false, parity: true },
  central_ideas_details: { marginCos: 0.25, minCos: 0.4 },
  // 데이터·증거 유형: 질문이 주장(대상·수치)을 직접 말하고 정답이 그것을 반복하는 사고가 이 유형에서 났다 — 주체 일치 검사를 켠다.
  command_of_evidence_quant: { entity: true },
  command_of_evidence_text: { entity: true },
  inferences: { entity: true },
};
export const policyFor = (skill: string): SkillPolicy => ({ ...DEFAULT, ...(SKILL_POLICY[skill] ?? {}) });

export type LeakAnalysis = {
  flagged: boolean;
  /** 'lexical' 또는 'mirror' 가 있으면 강한 신호, 'frame'·'length' 만이면 약한 신호. */
  strong: boolean;
  reasons: string[];
  stats: { subject: number[]; unique: number[]; cos: number[]; jac: number[]; mirror: number[]; words: number[]; frameCorrect: number; frameDistractors: number };
};

export function analyzeLeak(input: LeakInput, idf: Idf, override?: Partial<SkillPolicy>): LeakAnalysis {
  const pol = { ...policyFor(input.skill), ...(override ?? {}) };
  const opts = input.options, ci = input.correctIndex;
  const empty: LeakAnalysis = { flagged: false, strong: false, reasons: [], stats: { subject: [], unique: [], cos: [], jac: [], mirror: [], words: [], frameCorrect: 0, frameDistractors: 0 } };
  if (opts.length !== 4 || ci < 0 || ci > 3) return empty;
  const qv = vec(input.question, idf);
  const cos = opts.map((o) => cosine(vec(o, idf), qv));
  const jac = opts.map((o) => jaccard(o, input.question));
  const mirror = opts.map((o) => mirrorRun(input.question, o));
  const words = opts.map(wordCount);
  const dIdx = [0, 1, 2, 3].filter((i) => i !== ci);
  const unique = discriminatingOverlap(input.question, opts);
  const subject = subjectMatches(input.question, opts);
  const reasons: string[] = [];
  let strong = false;

  if (pol.lexical) {
    const maxD = Math.max(...dIdx.map((i) => cos[i]));
    if (cos[ci] >= pol.minCos && cos[ci] - maxD >= pol.marginCos) { reasons.push(`어휘 겹침: 정답 cos ${cos[ci].toFixed(2)} vs 오답 최대 ${maxD.toFixed(2)}`); strong = true; }
    const maxU = !pol.entity ? Infinity : Math.max(...dIdx.map((i) => unique[i]));
    if (pol.entity && unique[ci] >= pol.uniqueMin && maxU === 0) { reasons.push(`질문의 주체·수치를 정답만 반복(정답 ${unique[ci]}개 고유 일치, 오답 0)`); strong = true; }
    const maxS = Math.max(...dIdx.map((i) => subject[i]));
    if (pol.entity && subject[ci] >= 1 && maxS === 0 && unique[ci] === 0) { reasons.push("질문이 지목한 대상을 주어로 삼은 선택지가 정답뿐"); strong = true; }
    const maxM = Math.max(...dIdx.map((i) => mirror[i]));
    if (mirror[ci] >= pol.mirrorMin && mirror[ci] - maxM >= pol.mirrorGap) { reasons.push(`질문 문구 그대로 반복: 정답만 ${mirror[ci]}토큰 연속 일치(오답 최대 ${maxM})`); strong = true; }
  }
  const frameC = dIdx.reduce((s, i) => s + frameSim(opts[ci], opts[i]), 0) / 3;
  let pairs = 0, pairSum = 0;
  for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) { pairSum += frameSim(opts[dIdx[a]], opts[dIdx[b]]); pairs++; }
  const frameD = pairSum / pairs;
  const avgWords = words.reduce((a, b) => a + b, 0) / 4;
  if (pol.parity && avgWords >= 6) {
    if (frameD - frameC >= pol.frameGap && frameD >= 0.2) reasons.push(`선택지 틀 비대칭: 오답끼리 ${frameD.toFixed(2)} vs 정답↔오답 ${frameC.toFixed(2)}`);
    const sd = dIdx.map((i) => words[i]).sort((a, b) => b - a);
    if (words[ci] >= sd[0] * pol.lengthRatio && words[ci] - sd[0] >= 4) reasons.push(`정답이 가장 긴 선택지(${words[ci]}단어, 오답 최대 ${sd[0]})`);
    else if (words[ci] * pol.lengthRatio <= sd[2] && sd[2] - words[ci] >= 4) reasons.push(`정답이 가장 짧은 선택지(${words[ci]}단어, 오답 최소 ${sd[2]})`);
  }
  return { flagged: reasons.length > 0, strong, reasons, stats: { subject, unique, cos, jac, mirror, words, frameCorrect: frameC, frameDistractors: frameD } };
}

/** 생성 게이트용: 코드로 확정 가능한 강한 신호만 탈락 사유로 낸다(약한 신호는 감사 보고에만). */
export function answerLeakGate(input: LeakInput, idf: Idf): { ok: boolean; reasons: string[] } {
  const a = analyzeLeak(input, idf);
  return a.strong ? { ok: false, reasons: a.reasons } : { ok: true, reasons: [] };
}

/** 게이트 대상 유형: 질문이 주장·대상을 직접 말하는 RW 유형(어휘·구두점·전환·형식은 질문이 고정 문구라 제외). */
export const LEAK_CHECKED_SKILLS = new Set(["command_of_evidence_text", "command_of_evidence_quant", "inferences", "central_ideas_details", "text_structure_purpose", "cross_text_connections", "rhetorical_synthesis"]);
export const isLeakCheckedSkill = (skill: string) => LEAK_CHECKED_SKILLS.has(skill);
