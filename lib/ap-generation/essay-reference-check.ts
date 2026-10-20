// 에세이형 FRQ(WH·USH·EngLit 등) 참고답 점수·설명 충돌 점검기(백로그 B2, 2026-10-19).
// 참고답(reference_text)의 "Sample response/essay (밴드; 총점/만점; 영역별 점수)" 머리글과, 각 샘플 아래 "- 인용 - 설명" 줄을 읽어
//  1) 영역 점수 합 = 표시 총점, 2) 영역 점수 ≤ 채점 지침의 영역 만점, 만점 합 = 문항 만점, 3) 밴드 순서(high ≥ mid ≥ low),
//  4) 설명이 영역 점수와 모순되지 않음(예: 설명은 "complexity 없음"인데 점수는 만점)을 검사한다.
// 순수 함수라 텍스트만 있으면 어디서든(스캔 스크립트·게이트·테스트) 돌릴 수 있다.

export type AreaKey = "thesis" | "context" | "evidence" | "evidence_docs" | "evidence_outside" | "sourcing" | "reasoning" | "complexity" | "commentary" | "part" | "other";
export type SampleArea = { name: string; score: number; key: AreaKey; max?: number };
export type SampleBullet = { row?: string; quote: string; explanation: string };
export type EssaySample = { band: string; total: number; max: number; areas: SampleArea[]; bullets: SampleBullet[]; heading: string };
export type RefViolation = { code: string; band?: string; detail: string; fix?: string; proposal?: { area?: string; from?: number; to: number; total: number } };
/** 점수 쪽을 고치는 제안이 있으면 새 머리글 문자열을 만든다(설명이 더 구체적이라 기본은 점수를 설명에 맞춘다). */
export function proposedHeading(heading: string, p: NonNullable<RefViolation["proposal"]>): string {
  let h = heading.replace(/(\d+)(\s*\/\s*\d+)/, `${p.total}$2`);
  if (p.area) h = h.replace(new RegExp(`(${p.area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+)${p.from}(?=\\s*(?:,|\\)|:|$))`), `$1${p.to}`);
  return h;
}

export const areaKey = (name: string): AreaKey => {
  const n = name.toLowerCase();
  if (/^part [a-z]/.test(n)) return "part";
  if (/beyond the documents|outside/.test(n)) return "evidence_outside";
  if (/from the documents|documents/.test(n)) return "evidence_docs";
  if (/evidence and commentary|commentary/.test(n)) return "commentary";
  if (/thesis|claim/.test(n)) return "thesis";
  if (/context/.test(n)) return "context";
  if (/sourcing/.test(n)) return "sourcing";
  if (/complex|sophisticat/.test(n)) return "complexity";
  if (/reasoning|analysis/.test(n)) return "reasoning";
  if (/evidence/.test(n)) return "evidence";
  return "other";
};

/** 채점 지침 줄 "Thesis/claim (0-1): …" 에서 영역 만점을 읽는다. */
export function parseGuideMax(text: string): { name: string; key: AreaKey; max: number }[] {
  const out: { name: string; key: AreaKey; max: number }[] = [];
  for (const m of text.matchAll(/^([A-Z][A-Za-z/ ]*?(?: \([^)(]*\))?) \(0-(\d+)\)[:\s]/gm)) out.push({ name: m[1].trim(), key: areaKey(m[1]), max: Number(m[2]) });
  return out;
}

export function parseSamples(text: string): EssaySample[] {
  const lines = text.split("\n");
  const out: EssaySample[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^Sample (response|essay)\b/.test(lines[i])) continue;
    const h = lines[i];
    const band = (/\b(high|middle|mid|low)\b/i.exec(h)?.[1] ?? "").toLowerCase().replace("middle", "mid");
    const tot = /(\d+)\s*\/\s*(\d+)/.exec(h);
    if (!tot) continue;
    const rest = h.slice(h.indexOf(tot[0]) + tot[0].length).replace(/^[;:\s]+/, "").replace(/\)?:?\s*$/, "");
    const areas: SampleArea[] = [];
    for (const m of rest.matchAll(/([A-Za-z][A-Za-z/ ]*?(?: \([^)(]*\))?)\s+(\d+)(?=\s*(?:,|$))/g)) areas.push({ name: m[1].trim(), score: Number(m[2]), key: areaKey(m[1]) });
    const bullets: SampleBullet[] = [];
    for (let j = i + 1; j < lines.length && !/^Sample (response|essay)\b/.test(lines[j]); j++) {
      const b = /^\s*-\s*(?:Row ([A-Z]):\s*)?(".*)$/.exec(lines[j]);
      if (!b) continue;
      const k = b[2].indexOf('" - ');
      if (k < 0) continue;
      bullets.push({ row: b[1], quote: b[2].slice(0, k + 1), explanation: b[2].slice(k + 4).trim() });
    }
    out.push({ band, total: Number(tot[1]), max: Number(tot[2]), areas, bullets, heading: h });
  }
  return out;
}

const KEY_WORDS: [AreaKey[], string][] = [
  [["thesis"], "thesis|claim"],
  [["context"], "contextuali[sz]ation|context"],
  [["sourcing"], "sourcing"],
  [["complexity", "reasoning"], "complexity|complex understanding|sophistication"],
  [["reasoning"], "reasoning|analysis"],
  [["evidence", "evidence_docs", "evidence_outside", "commentary"], "evidence|commentary"],
];

/** 설명 문장에서 "이 영역은 점수를 못 받았다" / "받았다" 신호를 찾는다. 문장 단위로 보며, 부정 표현이 있는 문장에서는 긍정 신호를 세지 않는다.
 *  영역 이름이 같이 있을 때만 영역을 특정한다. earns N of M / stops at N 은 숫자 신호로 따로 돌려준다. */
export function explanationSignals(expl: string): { neg: AreaKey[][]; pos: AreaKey[][]; negAny: boolean; posAny: boolean; earns: { n: number; of?: number }[]; stops: number[] } {
  const neg: AreaKey[][] = [], pos: AreaKey[][] = [];
  const kw = (w: string) => KEY_WORDS.find(([, re]) => new RegExp(`^(?:${re})$`, "i").test(w.trim()))?.[0];
  const W = "(thesis|claim|contextuali[sz]ation|context|sourcing|complexity|complex understanding|sophistication|reasoning|analysis|evidence|commentary)";
  let negAny = false, posAny = false;
  const earns: { n: number; of?: number }[] = [], stops: number[] = [];
  for (const sent of expl.split(/(?<=[.;!?])\s+/)) {
    const negRes = [new RegExp(`\\bno ${W}(?: point| credit)?`, "gi"), new RegExp(`\\b${W}(?: point| credit)?(?: is| are| was)?(?: still| also| therefore)? not (?:earned|awarded)`, "gi"),
      new RegExp(`\\b(?:does|did|do) not (?:earn|reach)(?: the)?(?: second)? ${W}`, "gi"), new RegExp(`\\bnot (?:enough for|sufficient for)(?: the)? ${W}`, "gi")];
    const anyNeg = /\b(?:not earned|not awarded|no credit|no point|does not earn|did not earn|do not earn|is not earned|no [a-z ]{1,25}(?:credit|point))\b/i.test(sent);
    let hit = false;
    for (const re of negRes) for (const m of sent.matchAll(re)) { const w = m.slice(1).find((x) => x && kw(x)); if (w) { neg.push(kw(w)!); hit = true; } }
    if (anyNeg) negAny = true;
    if (anyNeg || hit) continue;
    const posRes = [new RegExp(`\\bearns? the ${W}(?: point| credit)?`, "gi"), new RegExp(`\\b${W}(?: point| credit)?(?: is| are| was) (?:earned|awarded)`, "gi")];
    for (const re of posRes) for (const m of sent.matchAll(re)) { const w = m.slice(1).find((x) => x && kw(x)); if (w) pos.push(kw(w)!); }
    if (/\b(?:earns the point|earns the \w+ point|the point is earned|point is earned)\b/i.test(sent)) posAny = true;
    for (const m of sent.matchAll(/\bearns? (\d)(?: of (\d))?(?!\d)/gi)) earns.push({ n: Number(m[1]), of: m[2] ? Number(m[2]) : undefined });
    for (const m of sent.matchAll(/\bstops at (\d)/gi)) stops.push(Number(m[1]));
  }
  return { neg, pos, negAny, posAny, earns, stops };
}

const rowAreaIndex = (row: string | undefined) => (row ? row.charCodeAt(0) - 65 : -1);

export function checkEssayReference(text: string, opts: { expectedMax?: number } = {}): RefViolation[] {
  const v: RefViolation[] = [];
  const samples = parseSamples(text);
  if (!samples.length) return [{ code: "no_samples", detail: "no 'Sample response/essay' headings found" }];
  const guide = parseGuideMax(text);
  const guideSum = guide.reduce((a, g) => a + g.max, 0);
  const stated = /(?:worth|Scoring guide \()(\d+) points?/.exec(text);
  const maxPts = opts.expectedMax ?? (stated ? Number(stated[1]) : guideSum || undefined);
  for (const s of samples) {
    const tag = s.band || s.heading.slice(0, 30);
    const sum = s.areas.reduce((a, x) => a + x.score, 0);
    if (!s.areas.length) v.push({ code: "areas_unparsed", band: tag, detail: `no area scores parsed from "${s.heading}"` });
    else if (sum !== s.total) v.push({ code: "area_sum_ne_total", band: tag, detail: `areas sum to ${sum} but the heading says ${s.total}/${s.max}`, fix: `set the heading total to ${sum}/${s.max}, or change an area score so the areas add up to ${s.total}`, proposal: { to: sum, total: sum } });
    if (maxPts && s.max !== maxPts) v.push({ code: "max_ne_question_points", band: tag, detail: `heading max ${s.max} vs question ${maxPts}` });
    if (s.total > s.max) v.push({ code: "total_gt_max", band: tag, detail: `${s.total} > ${s.max}` });
    for (const a of s.areas) {
      const g = guide.find((x) => x.key === a.key && (a.key !== "other") && (a.key !== "part") && x.name.toLowerCase().startsWith(a.name.toLowerCase().slice(0, 8)))
        ?? guide.find((x) => x.key === a.key && a.key !== "other" && a.key !== "part");
      if (g) { a.max = g.max; if (a.score > g.max || a.score < 0) v.push({ code: "area_gt_row_max", band: tag, detail: `${a.name} ${a.score} > row max ${g.max}` }); }
    }
    if (guide.length && s.areas.length && guide.length === s.areas.length && s.areas.every((a) => a.key === "part" || a.key !== "other")) { /* 영역 수 일치 */ }
    // 설명 ↔ 점수
    for (const b of s.bullets) {
      const sig = explanationSignals(b.explanation);
      const idx = rowAreaIndex(b.row);
      const partM = /\bPart ([A-Z])\b/.exec(b.explanation);
      const direct: SampleArea | undefined = idx >= 0 ? s.areas[idx] : partM ? s.areas.find((a) => a.name === `Part ${partM[1]}`) : undefined;
      const full = (a: SampleArea) => (a.max !== undefined ? a.score >= a.max : a.key === "part" ? a.score >= 1 : false);
      const areasFor = (keys: AreaKey[]) => s.areas.filter((a) => keys.includes(a.key));
      const quote = b.quote.slice(0, 50);
      for (const keys of sig.neg) {
        const cands = direct && keys.includes(direct.key) ? [direct] : areasFor(keys);
        for (const a of cands) {
          // complexity/reasoning 이 한 영역(만점 2)이면 "complexity 없음" 은 만점과 모순
          const isFull = full(a);
          if (isFull) v.push({ code: "expl_denies_but_full", band: tag, detail: `bullet ${quote}… says the ${keys[0]} point is not earned, but ${a.name} is ${a.score}${a.max !== undefined ? `/${a.max}` : ""}`, fix: `lower ${a.name} to ${a.score - 1} (total ${s.total - 1}/${s.max}), or rewrite the explanation to say the point is earned`, proposal: { area: a.name, from: a.score, to: a.score - 1, total: s.total - 1 } });
        }
      }
      for (const keys of sig.pos) {
        const cands = direct && keys.includes(direct.key) ? [direct] : areasFor(keys);
        for (const a of cands) if (a.score === 0) v.push({ code: "expl_credits_but_zero", band: tag, detail: `bullet ${quote}… says the ${keys[0]} point is earned, but ${a.name} is 0`, fix: `raise ${a.name} to 1 (total ${s.total + 1}/${s.max}), or rewrite the explanation`, proposal: { area: a.name, from: 0, to: 1, total: s.total + 1 } });
      }
      if (direct && sig.negAny && !sig.neg.length && full(direct)) v.push({ code: "expl_denies_but_full", band: tag, detail: `bullet ${quote}… denies credit but ${direct.name} is ${direct.score}`, fix: `lower ${direct.name} or rewrite the explanation`, proposal: { area: direct.name, from: direct.score, to: direct.score - 1, total: s.total - 1 } });
      if (direct && sig.posAny && direct.score === 0) v.push({ code: "expl_credits_but_zero", band: tag, detail: `bullet ${quote}… grants credit but ${direct.name} is 0`, fix: `raise ${direct.name} or rewrite the explanation`, proposal: { area: direct.name, from: 0, to: 1, total: s.total + 1 } });
      for (const e of sig.earns) {
        // 영역: 행 글자/Part 로 특정되면 그 영역, 아니면 "N of M" 의 M 이 만점인 영역이 하나뿐일 때 그 영역
        const byMax = e.of !== undefined ? s.areas.filter((x) => x.max === e.of) : [];
        const named = byMax.filter((x) => new RegExp(KEY_WORDS.filter(([ks]) => ks.includes(x.key)).map(([, re]) => re).join("|") || "$^", "i").test(b.explanation));
        const cand = direct ?? (byMax.length === 1 ? byMax[0] : named.length === 1 ? named[0] : undefined);
        if (cand && cand.score !== e.n) v.push({ code: "expl_earns_n_mismatch", band: tag, detail: `bullet ${quote}… says "earns ${e.n}${e.of !== undefined ? ` of ${e.of}` : ""}" but ${cand.name} is ${cand.score}`, fix: `set ${cand.name} to ${e.n} (total ${s.total - cand.score + e.n}/${s.max}), or rewrite the explanation`, proposal: { area: cand.name, from: cand.score, to: e.n, total: s.total - cand.score + e.n } });
      }
      for (const n of sig.stops) if (direct && direct.score !== n) v.push({ code: "expl_stops_at_mismatch", band: tag, detail: `bullet ${quote}… says "stops at ${n}" but ${direct.name} is ${direct.score}` });
    }
    // 총점 문구: "scores 6, not 7" 같은 설명 안의 총점 언급
    for (const b of s.bullets) {
      const m = /\bscores? (\d+)(?:,| and) not (\d+)/i.exec(b.explanation);
      if (m && Number(m[1]) !== s.total) v.push({ code: "expl_total_mismatch", band: tag, detail: `explanation says the response scores ${m[1]} but the heading total is ${s.total}` });
    }
  }
  // 밴드 순서
  const order: Record<string, number> = { high: 3, mid: 2, low: 1 };
  const bt = samples.filter((s) => order[s.band]).sort((a, b) => order[b.band] - order[a.band]);
  for (let i = 1; i < bt.length; i++) if (bt[i].total >= bt[i - 1].total) v.push({ code: "band_order", band: bt[i].band, detail: `${bt[i].band} ${bt[i].total} is not below ${bt[i - 1].band} ${bt[i - 1].total}` });
  if (guide.length && maxPts && guideSum && guideSum !== maxPts) v.push({ code: "guide_max_sum_ne_question", detail: `row maxima sum to ${guideSum} but the question is worth ${maxPts}` });
  return v;
}

