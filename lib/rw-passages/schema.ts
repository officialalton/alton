// R&W 문학 지문 수집 규격(2026-10-01) — 기획 세션 등이 AI 로 쓴 '문학 스타일 새 글'을 저장하는 형식의 검증기.
// 실제 작품 발췌는 코퍼스(~/Developer/ALTON-data/rw-corpus)에서 따로 관리하고, 이 규격은 'origin = original_ai' 새 글만 받는다.
export const GENRES = [
  "short_story", "novel_excerpt", "poetry", "drama", "personal_essay", "memoir", "letter", "diary", "fable_or_folktale_retelling",
] as const;
export const POVS = ["first", "second", "third_limited", "third_omniscient", "mixed_or_none"] as const;
export const STYLE_ERAS = ["contemporary", "late_20c", "early_20c", "19c"] as const; // 문체의 분위기일 뿐 실제 작가·작품과 무관
export const INFERENCE_TARGETS = [
  "character_motivation", "tone_or_mood", "narrator_attitude", "tone_shift", "figurative_language", "symbolism",
  "relationship_between_characters", "word_in_context", "text_structure", "main_idea_or_purpose", "underlined_portion_function",
] as const;
export const INTENDED_DIFFICULTY = ["easy", "medium", "hard"] as const;

export type LiteraryPassage = {
  id: string;
  batchId: string;
  origin: "original_ai";
  producer: { model: string; session?: string; date: string };
  genre: (typeof GENRES)[number];
  styleEra: (typeof STYLE_ERAS)[number];
  pov: (typeof POVS)[number];
  topicSeed: string; // 한 줄: 장소·인물 관계·갈등(중복 방지 키)
  text: string; // 60~220 단어(영어). 시는 줄바꿈 \n 유지
  features: { tone: string[]; devices: string[]; inferenceTargets: (typeof INFERENCE_TARGETS)[number][] };
  intendedDifficulty: (typeof INTENDED_DIFFICULTY)[number];
  declaration: { original: true; noRealWorkQuoted: true; noCopyrightedSource: true };
  notes?: string;
};

export type Issue = { id: string; field: string; message: string };

const words = (t: string) => (t.trim().match(/\S+/g) ?? []).length;
const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const shingles = (t: string, n = 5) => {
  const w = norm(t).split(" ");
  const s = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) s.add(w.slice(i, i + n).join(" "));
  return s;
};
const jaccard = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
};

/** 한 배치(여러 줄 JSONL 을 파싱한 배열)를 검증한다. 같은 배치 안 중복·유사도도 본다. */
export function validatePassages(items: unknown[]): { issues: Issue[]; ok: number } {
  const issues: Issue[] = [];
  const seenId = new Set<string>();
  const seenSeed = new Set<string>();
  const sh: { id: string; s: Set<string> }[] = [];
  let ok = 0;
  for (const raw of items) {
    const p = raw as Partial<LiteraryPassage>;
    const id = typeof p.id === "string" ? p.id : "(id 없음)";
    const before = issues.length;
    const bad = (field: string, message: string) => issues.push({ id, field, message });
    if (typeof p.id !== "string" || !/^[a-z0-9][a-z0-9\-_.]{5,80}$/.test(p.id)) bad("id", "영문 소문자·숫자·-_. 6~80자");
    else if (seenId.has(p.id)) bad("id", "같은 배치에 중복 id");
    else seenId.add(p.id);
    if (typeof p.batchId !== "string" || !p.batchId) bad("batchId", "필수");
    if (p.origin !== "original_ai") bad("origin", "original_ai 만 허용(실제 작품 발췌는 코퍼스 경로로)");
    if (!p.producer || typeof p.producer.model !== "string" || !p.producer.model || !/^\d{4}-\d{2}-\d{2}/.test(p.producer.date ?? "")) bad("producer", "{model, date(YYYY-MM-DD)} 필수");
    if (!GENRES.includes(p.genre as never)) bad("genre", `허용: ${GENRES.join(", ")}`);
    if (!STYLE_ERAS.includes(p.styleEra as never)) bad("styleEra", `허용: ${STYLE_ERAS.join(", ")}`);
    if (!POVS.includes(p.pov as never)) bad("pov", `허용: ${POVS.join(", ")}`);
    if (typeof p.topicSeed !== "string" || p.topicSeed.trim().length < 12) bad("topicSeed", "장소·인물 관계·갈등을 한 줄(12자 이상)");
    else {
      const k = norm(p.topicSeed);
      if (seenSeed.has(k)) bad("topicSeed", "같은 배치에 같은 소재");
      seenSeed.add(k);
    }
    const t = typeof p.text === "string" ? p.text : "";
    const wc = words(t);
    if (wc < 60 || wc > 220) bad("text", `단어 수 ${wc} — 60~220 이어야 함`);
    if (/[가-힣]/.test(t)) bad("text", "영어 지문이어야 함(한글 포함)");
    if (/<\/?[a-z_]+[^>]*>|```|\bas an ai\b|\bI cannot\b|\[(?:insert|placeholder)/i.test(t)) bad("text", "마크업·모델 잔재·플레이스홀더");
    if (/\bchapter \d+\b|^\s*["“]?from\s+.+\bby\b/i.test(t.split("\n")[0] ?? "")) bad("text", "실제 출처 표기처럼 보이는 머리글 금지");
    const f = p.features;
    if (!f || !Array.isArray(f.tone) || f.tone.length === 0 || !Array.isArray(f.devices) || !Array.isArray(f.inferenceTargets) || f.inferenceTargets.length === 0) bad("features", "tone·devices·inferenceTargets(1개 이상) 필수");
    else for (const x of f.inferenceTargets) if (!INFERENCE_TARGETS.includes(x as never)) bad("features.inferenceTargets", `허용 밖 값 ${x}`);
    if (!INTENDED_DIFFICULTY.includes(p.intendedDifficulty as never)) bad("intendedDifficulty", "medium|hard");
    const d = p.declaration;
    if (!d || d.original !== true || d.noRealWorkQuoted !== true || d.noCopyrightedSource !== true) bad("declaration", "original·noRealWorkQuoted·noCopyrightedSource 모두 true 여야 함");
    const s = shingles(t);
    for (const o of sh) if (jaccard(s, o.s) >= 0.3) bad("text", `${o.id} 와 5-gram 유사도 0.3 이상`);
    sh.push({ id, s });
    if (issues.length === before) ok++;
  }
  return { issues, ok };
}
