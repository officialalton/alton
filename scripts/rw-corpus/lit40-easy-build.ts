// 문학 40% 계획 easy 발췌 지문 구축기(2026-10-01). 코퍼스(읽기 전용)에서 easy 후보에 대응하는 발췌 지문 파일을 만든다.
//   node scripts/rw-corpus/lit40-easy-build.ts          (Node 25 타입 제거 실행, 네트워크·API 없음)
// 산출: data/rw-generation/excerpts/lit40-easy.jsonl(전체 고유 발췌) · lit40-easy-0N.jsonl(배치별 정렬 파일) · lit40-easy.summary.json · lit40-easy.index.json
// 모든 발췌는 quote-verify(글자 그대로 일치)와 SHA 재계산을 통과해야 하며, 통과분만 기록한다.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { verifyExcerpt, normalize } from "./quote-verify";

const HOME = process.env.HOME ?? "";
const ROOT = path.join(HOME, "Developer/ALTON-data/rw-corpus");
const REPO = path.join(HOME, "Developer/ALTON");
const OUT = path.join(REPO, "data/rw-generation/excerpts");
mkdirSync(OUT, { recursive: true });

type Genre = "short_story" | "novel_excerpt" | "personal_essay" | "memoir" | "poetry" | "letter" | "drama" | "fable_or_folktale_retelling";
// 작품 -> 장장르. 같은 작품은 한 장르로만 쓴다(작품당 5개 상한).
const WORKS: Record<Genre, number[]> = {
  short_story: [912, 1993, 35641, 75587, 3189, 2280, 5705, 21771, 21971, 2723, 40692, 40683, 18126, 18725, 6054, 23165, 23174, 23182, 23694, 15709, 78045, 16858, 5647, 23694, 18629, 12481],
  novel_excerpt: [1033, 18666, 21240, 28856, 24283, 60838, 335, 33601, 433, 35548, 49903, 57464, 54463, 55166, 78772, 8942, 9965, 70134, 41134, 53423, 54097, 57099, 66587, 73223, 75486, 79372, 76371, 78143, 52548, 2762, 14813, 219, 30393, 201],
  personal_essay: [22838, 36167, 19938, 11990, 9247, 54219, 10417, 3252, 7257, 20755, 17437, 1486, 45307, 22050, 27563, 6570, 70670, 41632, 44416, 74254, 40701, 38954, 4065, 69345, 72776, 19872, 29018, 36084, 64402],
  memoir: [8473, 11982, 38497, 57801, 6960, 18615, 31969, 13945, 39179, 40281, 78758, 22117, 54046, 5005, 35040, 19652, 24356, 45848, 1866, 1409, 32609, 45502, 38418, 5334, 16914, 77277],
  poetry: [25281, 3039, 75529, 35922, 42667, 4007, 3252, 16858],
  letter: [18725, 57985, 63753, 2157, 13945, 39179, 28303],
  drama: [28303],
  fable_or_folktale_retelling: [163, 4925],
};
// 한 작품이 여러 장르 목록에 있으면 아래 우선순위로 한 곳에만 둔다.
const WORK_GENRE = new Map<number, Genre>();
for (const g of ["drama", "letter", "fable_or_folktale_retelling", "poetry", "memoir", "personal_essay", "short_story", "novel_excerpt"] as Genre[]) for (const id of WORKS[g]) if (!WORK_GENRE.has(id)) WORK_GENRE.set(id, g);
// 시집·수필 등 일부 작품은 다른 장르로도 후보를 뽑는다(작품당 총합 5개 상한은 선택 단계에서 적용).
const EXTRA_GENRES: Record<number, Genre[]> = { 3252: ["personal_essay", "poetry"], 16858: ["short_story", "poetry"], 28303: ["drama", "letter"], 18725: ["short_story", "letter"], 13945: ["memoir", "letter"], 39179: ["memoir", "letter"] };

const PER_WORK = 5;
const DBG: Record<string, number> = {};
const bump = (k: string) => { DBG[k] = (DBG[k] ?? 0) + 1; };
const norm = (s: string) => s.replace(/[‘’‛′]/g, "'").replace(/[“”‟″]/g, '"');
const wc = (s: string) => s.split(/\s+/).filter(Boolean).length;
// ---------- 어휘 통계 (문서 빈도 DF) ----------
function itemPaths(): { id: number; dir: string; file: string }[] {
  const out: { id: number; dir: string; file: string }[] = [];
  for (const dir of ["gutenberg", "gutenberg_humanities"]) {
    const d = path.join(ROOT, "items", dir);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d)) { const m = f.match(/^gutenberg-(\d+)\.txt$/); if (m) out.push({ id: Number(m[1]), dir, file: path.join(d, f) }); }
  }
  return out;
}
const ITEMS = itemPaths();
const TEXT = new Map<number, string>();
const RAW = new Map<number, string>();
for (const it of ITEMS) { const r = readFileSync(it.file, "utf-8"); RAW.set(it.id, r); TEXT.set(it.id, r.replace(/\r\n?/g, "\n")); }
const DF = new Map<string, number>();
for (const [, t] of TEXT) { const seen = new Set(norm(t).toLowerCase().match(/[a-z]+/g) ?? []); for (const w of seen) DF.set(w, (DF.get(w) ?? 0) + 1); }
const COMMON_DF = 25;

// ---------- 필터 사전 ----------
const ARCHAIC = /\b(thou|thee|thy|thine|thyself|hath|hast|doth|dost|didst|wouldst|couldst|shalt|wilt|ye|ere|o'er|e'er|e'en|whence|whither|verily|forsooth|methinks|methought|prithee|wherefore|anon|albeit|betwixt|perchance|hitherto|heretofore|thereof|whereof|thence|nay|yea|oft|alas|behold|'tis|'twas|'twere|'twill|'twixt|ne'er|ofttimes|aught|naught)\b/i;
const DIALECT = /\b(ain't|yo'|yer|thar|dat|dem|dis|wid|wot|gwine|sich|kinder|mebbe|jes|nuthin|somethin|'cause|fo'|mah|massa|marse|mistah|sah|dollah)\b|'em\b|'im\b|\b\w+in'(?=\W)/i;
const BLOCK = /\b(dead|death|breast|breasts|bosom|pistol|pistols|revolver|drunkenness|beer|murderers|darkey|darkeys|colored|pickaninny|mammy|nigger|negro|negroes|darky|darkies|coon|injun|injuns|redskin|redskins|squaw|savage|savages|heathen|coolie|chinaman|mohammedan|half-breed|gipsy|gipsies|gypsy|gypsies|jew|jews|jewish|slave|slaves|slavery|kill|killed|killing|murder|murdered|murderer|murders|corpse|corpses|suicide|rape|ravish|whore|harlot|mistress|naked|lust|drunk|drunken|drunkard|whisky|whiskey|rum|brandy|opium|cocaine|damn|damned|hell|devil|devils|christ|jesus|lord|saviour|redeemer|sin|sins|sinner|sinners|hanged|gallows|execution|blood|bloody|bleeding|massacre|tortur\w*|scalp|scalped|slaughter\w*|cannibal\w*|lynch\w*|whipped|flogg\w*|stabbed|dagger|pirate|pirates|buccaneer\w*|poison\w*|ghost|ghosts|coffin|funeral|insane|lunatic|madman|asylum|idiot|tobacco|cigar|cigars|religion|religious|priest|priests|preacher|preachers|clergyman|sermon|superstition|atheism|infidel|infidels|bled|bleed|beaten|beating|lash|lashes|scourge|mutilat\w*|disfigur\w*|dying|dies|death|deadly|plague|epidemic|bomb|bombs|cannon|musket)\b/i;
const BLOCK_CORE = /\b(dead|death|pistol|drunkenness|murderers|darkey|darkeys|colored|pickaninny|mammy|nigger|negro|negroes|darky|darkies|coon|injun|injuns|redskin|redskins|squaw|savage|savages|heathen|coolie|chinaman|half-breed|gipsy|gypsy|jew|jews|slave|slaves|kill|killed|killing|murder|murdered|murderer|corpse|corpses|suicide|rape|ravish|whore|harlot|mistress|naked|lust|drunk|drunken|whisky|whiskey|rum|brandy|opium|damn|damned|hell|devil|devils|christ|jesus|blood|bloody|bleeding|massacre|tortur\w*|hanged|gallows|scalp|slaughter\w*|stabbed|dagger|poison\w*|ghost|ghosts|coffin|insane|lunatic|idiot|tobacco|cigar|breast|breasts|bosom)\b/i;
const BLOCK_NONFIC = /\b(war|wars|battle|battles|battle-ground|battlefield|soldier|soldiers|regiment|enemy|enemies|rebel|rebels|army|armies|rifle|rifles|bullet|bullets|limbs|bleaching|bones|skeleton|skull|carcass|hospital|prison|prisoner|prisoners|jail|convict|convicts|wounded|wound|wounds|fever|disease|famine|starv\w*|dead|grave|graves)\b/i;
const OPENERS = /^["“‘']?(he|she|it|they|his|her|their|its|this|that|these|those|but|and|or|nor|so|however|then|yet|also|thus|therefore|moreover|meanwhile|afterward|afterwards|presently|next|such|both|neither|either|another|one of them|the next|the following|the same|the other|the latter|the former|on the following|on the next|at last|at length|in the meantime|too|well|oh|why|yes|no)\b/i;
const NOT_NAMES = new Set(["I", "The", "A", "An", "He", "She", "It", "They", "We", "You", "His", "Her", "Their", "My", "Our", "Your", "In", "On", "At", "Of", "To", "For", "But", "And", "Or", "So", "If", "When", "As", "That", "This", "There", "Then", "What", "Who", "How", "Why", "Where", "No", "Yes", "Oh", "Not", "With", "From", "By", "All", "One", "Mr", "Mrs", "Miss", "Dr", "St", "Sir", "Madam", "Lady", "Lord", "God", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December", "English", "French", "American", "Spring", "Summer", "Autumn", "Winter", "Christmas", "Is", "Was", "Are", "Do", "Did", "Let", "Now", "Here", "Some", "Every", "Each", "Such", "Never", "Nothing", "Everything", "Perhaps", "Indeed", "Still", "Yet", "Once", "Even", "Just", "Only", "Her", "Him", "Them", "Its"]);
const ABBREV = /\b(Mr|Mrs|Messrs|Dr|St|Mt|Col|Capt|Gen|Prof|Rev|Hon|vs|No|Mme|Mlle|M|Jr|Sr|Lt|Sgt|Gov|Sen|Rep|Co|Bros|Esq|etc|viz|cf|Ft|Mts)$/;

// ---------- 사전적 단서(문항 유형 적합도) ----------
const POS = new Set("happy glad joy joyful merry cheerful delight delighted delightful pleasant pleasure laughed laughing smile smiled smiling bright warm sweet kind gentle lovely beautiful dear fond proud hope hopeful eager gay lively comfort comfortable peaceful calm tender grateful thankful bless blessed fortunate lucky wonderful charming splendid noble brave generous honest cheery radiant sunny golden fresh gladly welcome love loved loving friendly pretty fine good fair".split(" "));
const NEG = new Set("sad sorrow sorrowful grief gloomy gloom dark darkness cold bitter angry anger fear afraid frightened terror terrible dreadful weary tired lonely alone silent silence sigh sighed weep wept tears cry cried sullen sulky cruel harsh heavy trouble troubled worry worried anxious dull dreary miserable wretched pity pitiful shame ashamed regret regretted doubt doubtful lost empty hopeless unhappy poor mournful melancholy desolate stern coldly bleak grim scorn contempt foolish silly stupid vain idle disappointed disappointment failure".split(" "));
const EVAL = new Set("foolish silly stupid absurd ridiculous clever wise wisely sensible vain idle proud humble modest charming delightful dreadful wretched splendid wonderful excellent admirable remarkable curious strange queer odd pleasant disagreeable tiresome tedious amusing droll comical pathetic pitiful shameful honest noble generous selfish cruel kind unfortunately fortunately certainly surely evidently apparently doubtless indeed rather quite really actually truly simply merely exceedingly extremely perfectly utterly".split(" "));
const DESIRE = /\b(wanted|wished|hoped|longed|determined|decided|resolved|tried|wished|meant|intended|eager|anxious|afraid|feared|dreaded|desire|desired|ambition|ambitious|promised|planned|hurried|refused|insisted|begged|pleaded|struggled|worked hard|set out|made up (his|her) mind|in order to|so that|hoping|wishing|longing|determined)\b/i;
const KIN = /\b(mother|father|mama|papa|mamma|sister|brother|aunt|uncle|cousin|grandmother|grandfather|husband|wife|daughter|son|friend|neighbor|neighbour|master|servant|teacher|pupil|child|children|boy|girl|lady|gentleman|captain|doctor|nurse|stranger|companion|sweetheart|lover|guest|host)\b/ig;
const SYMBOL = /\b(light|lamp|candle|dark|shadow|shadows|fire|flame|door|doors|window|windows|gate|garden|river|stream|sea|ocean|wave|waves|storm|rain|snow|winter|spring|autumn|summer|moon|sun|star|stars|rose|roses|flower|flowers|tree|trees|bird|birds|nest|bell|bells|clock|mirror|key|road|path|bridge|hill|mountain|wall|walls|house|home|hearth|ship|sail|anchor|harbor|harbour|wind|cloud|clouds|dawn|twilight|sunset|feather|gold|silver|stone|dust|ashes|seed|harvest|thorn|vine|bread|wine|crown|chain|cage|wings)\b/ig;
const SIMILE = /\b(like (a|an|the|some|two|any|one)|as if|as though|as (\w+) as (a|an|the)|seemed (to|like|as)|resembled|reminded|metaphor|was a (\w+ )?(of|that)|were (so many|a)|fell like|rose like|drifted like)\b/ig;
const CONTRAST = /\b(but|yet|however|although|though|still|instead|nevertheless|whereas|while|except|only|until|unless|even so|on the other hand|nonetheless|rather than|at first|later|suddenly)\b/ig;
const POLY = new Set("address bank bar bark bear bill bolt bound bow bright broke capital case cast charge check class close cold company content cool course crack crown cross cut dark date deal dear delicate dim direct discharge draw dry dull fair fine firm flat fly forced gloss grave hail hand hard heavy hold issue just keen kind lead leave light like long mean mind mine mint miss note object odd order pass patient pitch plain plant plate play point pool present press pretty prime pupil quarter quiet raise range rank rare rest ring rock rough round row rule run saw scale second sense serve set settle shed shot sharp sign slight sound spare spell spirit spot spread spring square stand state stick strain stroke strike subject suit swallow table tear tender tie tip train trip trouble trunk turn watch wave well wind yard".split(" "));
const ADV_UNUSUAL = new Set<string>();

type Feat = { fig: number; shift: number; evalw: number; desire: number; people: number; symbol: number; mood: number; contrast: number; poly: number; firstPerson: number; sentences: number; names: string[]; rare: number };
function features(text: string): Feat {
  const t = norm(text);
  const lower = t.toLowerCase();
  const toks = lower.match(/[a-z']+/g) ?? [];
  const half = Math.floor(toks.length / 2);
  const pol = (arr: string[]) => arr.reduce((s, w) => s + (POS.has(w) ? 1 : NEG.has(w) ? -1 : 0), 0);
  const p1 = pol(toks.slice(0, half)), p2 = pol(toks.slice(half));
  const shift = p1 * p2 < 0 ? Math.min(Math.abs(p1), Math.abs(p2)) + 1 : 0;
  const mood = toks.filter((w) => POS.has(w) || NEG.has(w)).length;
  const evalw = toks.filter((w) => EVAL.has(w)).length;
  const sentences = (t.match(/[.!?]["')\]]?(\s|$)/g) ?? []).length;
  const kin = new Set((t.match(KIN) ?? []).map((x) => x.toLowerCase()));
  const names = capNames(text);
  const symbols = new Set((lower.match(SYMBOL) ?? []));
  const rareN = toks.filter((w) => w.length > 3 && (DF.get(w) ?? 0) < COMMON_DF).length;
  return {
    fig: (t.match(SIMILE) ?? []).length,
    shift, evalw, desire: DESIRE.test(t) ? (t.match(new RegExp(DESIRE.source, "ig")) ?? []).length : 0,
    people: kin.size + Math.min(names.length, 3), symbol: symbols.size, mood, contrast: (lower.match(CONTRAST) ?? []).length,
    poly: toks.filter((w) => POLY.has(w)).length, firstPerson: (t.match(/\b(I|my|me|myself|we|our)\b/g) ?? []).length,
    sentences, names, rare: rareN / Math.max(1, toks.length),
  };
}
function capNames(text: string): string[] {
  const out = new Set<string>();
  const t = norm(text);
  const re = /(?<![.!?"]\s)(?<!^)\b([A-Z][a-z]{2,})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) { const prev = t.slice(Math.max(0, m.index - 3), m.index); if (/[.!?"]\s*$/.test(prev) || /^\s*$/.test(prev)) continue; if (!NOT_NAMES.has(m[1])) out.add(m[1]); }
  return [...out];
}

// ---------- 단락·문장 분해 ----------
type Para = { start: number; end: number; text: string };
function paragraphs(src: string): Para[] {
  const out: Para[] = [];
  const re = /\S[\s\S]*?(?=\n[ \t]*\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) { out.push({ start: m.index, end: m.index + m[0].length, text: m[0] }); if (m[0].length === 0) re.lastIndex++; }
  return out;
}
function sentenceSpans(p: Para): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  const t = p.text;
  let s = 0;
  const re = /[.!?]+["”’')\]]*(?=\s+["“‘'(]?[A-Z]|\s*$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const endIdx = m.index + m[0].length;
    const before = t.slice(Math.max(0, m.index - 6), m.index);
    if (m[0].startsWith(".") && (ABBREV.test(before) || /(^|\s)[A-Z]$/.test(before))) continue;
    out.push({ start: p.start + s, end: p.start + endIdx });
    const rest = t.slice(endIdx); const lead = rest.match(/^\s*/)![0].length; s = endIdx + lead;
  }
  return out;
}
const proseLike = (p: Para) => {
  const lines = p.text.split("\n");
  if (lines.some((l) => /^\s{2,}\S/.test(l)) && lines.length > 1) return false; // 들여쓴 인용·표
  if (lines.length > 1 && lines.reduce((s, l) => s + l.length, 0) / lines.length < 38) return false; // 시행
  return /^["“‘']?[A-Z]/.test(p.text.trim()) && /[.!?]["”’')]?\s*$/.test(p.text.trim()) && p.text.length > 60;
};

type Cand = { id: number; genre: Genre; start: number; end: number; text: string; words: number; q: number; feat: Feat; tags: string[] };

function unwrap(raw: string, keepLines: boolean): string {
  if (keepLines) return raw.replace(/[ \t]+$/gm, "");
  return raw.replace(/[ \t]*\n[ \t]*\n[ \t\n]*/g, "\u0000").replace(/[ \t]*\n[ \t]*/g, " ").replace(/\u0000/g, "\n\n").replace(/[ \t]{2,}/g, " ");
}
function textChecks(text: string, genre: Genre): boolean {
  const r = textChecks0(text, genre); if (r) { bump(r); return false; } return true;
}
function textChecks0(text: string, genre: Genre): string | null {
  const t = norm(text);
  if (/[\[\]*<>{}|]/.test(t)) return "chk843";
  if (genre !== "drama" && /_/.test(t)) return "chk388";
  if (/\bIllustration|\bCHAPTER\b|\bFig\.|\bp\. \d|ibid|\bviz\b|&c\b|\bq\.v\./i.test(t)) return "chk451";
  if (BLOCK.test(t)) return "chk231";
  if (genre !== "poetry" && (ARCHAIC.test(t) || DIALECT.test(t))) return "chk986";
  if (genre === "poetry" && (/\b(thou|thee|thy|thine|hath|hast|doth|dost|wilt|shalt)\b/i.test(t) || DIALECT.test(t))) return "chk699";
  const digits = (t.match(/[0-9]/g) ?? []).length;
  if (digits > 4) return "chk896";
  const caps = t.match(/\b[A-Z]{3,}\b/g) ?? [];
  if (genre !== "drama" && caps.length > 0) return "chk990";
  if (genre === "drama" && caps.filter((c) => !/^[A-Z]{3,}$/.test(c)).length > 0) return "chk227";
  if (/--/.test(t) && (t.match(/--/g) ?? []).length > 3) return "chk883";
  if (/[^\x00-\x7F’‘“”—–…]/.test(t)) return "chk146";
  return null;
}
function quotesBalanced(text: string): boolean {
  // 따옴표가 열림-닫힘 순서로 짝이 맞는지(발췌가 대사 중간에서 시작·종료하지 않는지) 확인한다.
  let open = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "“") { if (open) return false; open = true; }
    else if (c === "”") { if (!open) return false; open = false; }
    else if (c === '"') {
      const prev = i === 0 ? " " : text[i - 1];
      const isOpener = /[\s(\u2014\u2013-]/.test(prev) && !(open === true && /[.,!?;:]/.test(prev));
      if (isOpener && !open) open = true; else if (open) open = false; else return false;
    } else if (c === "‘") { if (open) return false; open = true; }
    else if (c === "’" && open && /[.,!?;:]/.test(text[i - 1] ?? "") && !/[A-Za-z]/.test(text[i + 1] ?? " ")) {
      // 작은따옴표 닫힘일 수 있음: 짝이 맞는 ‘ 가 있었는지는 아래 최종 검사에서 본다
    }
  }
  if (open) return false;
  // 작은따옴표 대사(영국식 '...')가 중간에서 시작·종료하는지: 열림 없이 문장부호 뒤에 닫힘이 먼저 나오면 불일치
  let sq = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], prev = i === 0 ? " " : text[i - 1], nxt = text[i + 1] ?? " ";
    if (c === "'" || c === "‘" || c === "’") {
      const opener = (c !== "’") && /[\s(\u2014-]/.test(prev) && /[A-Za-z]/.test(nxt);
      const closer = /[.,!?;:]/.test(prev) && !/[A-Za-z]/.test(nxt);
      if (opener && !sq) sq = true;
      else if (closer) { if (!sq) return false; sq = false; }
    }
  }
  return !sq;
}
function quoteFraction(text: string): number {
  const t = norm(text);
  let inQ = 0;
  for (const m of t.matchAll(/"[^"]*"/g)) inQ += wc(m[0]);
  for (const m of t.matchAll(/(^|[\s(])'[A-Za-z][^']{4,}?'(?=[\s.,;:!?)]|$)/g)) inQ += wc(m[0]);
  if (!quotesBalanced(text)) return 1;
  return inQ / Math.max(1, wc(t));
}
const NONFIC = new Set<Genre>(["memoir", "letter", "personal_essay"]);
function proseQuality(text: string, genre: Genre): { ok: boolean; q: number; f: Feat } {
  const t = norm(text);
  const f = features(text);
  const ss = text.split(/(?<=[.!?]["”’')]?)\s+/).filter(Boolean);
  const lens = ss.map(wc);
  const avg = lens.reduce((a, b) => a + b, 0) / Math.max(1, lens.length);
  const mx = Math.max(...lens);
  if (genre !== "drama") {
    if (wc(t.trim().split(/(?<=[.!?]["”’')]?)\s/)[0]) < 7) return (bump("pq12"), { ok: false, q: 0, f });
    if (!/^[A-Za-z]/.test(t.trim())) return (bump("pq8"), { ok: false, q: 0, f });
    if (/\b(this (book|volume|story|chapter|essay|work|paper|lecture)|these (pages|sketches|stories|essays|chapters|lectures)|the reader|readers|the author|my publisher|preface|introduction|footnote|note\b|volume|edition|the following (pages|chapter)|vol\.|ch\.)\b/i.test(t)) return (bump("pq9"), { ok: false, q: 0, f });
    {
      const fs = t.trim().split(/(?<=[.!?])\s/)[0];
      const toks = fs.split(/\s+/);
      const pi = toks.findIndex((w) => /^(he|she|they|his|her|him|them|their|hers|himself|herself|themselves)[,;.!?]?$/i.test(w));
      if (pi >= 0 && !toks.slice(0, pi).some((w, k) => (k > 0 && /^[A-Z][a-z]/.test(w)) || /^(the|a|an)$/i.test(w))) return (bump("pq10"), { ok: false, q: 0, f });
    }
    if (OPENERS.test(t.trim())) return (bump("pq1"), { ok: false, q: 0, f });
    if (f.sentences < 4) return (bump("pq2"), { ok: false, q: 0, f });
    if (avg > 27 || mx > 55) return (bump("pq3"), { ok: false, q: 0, f });
    if (quoteFraction(text) > (genre === "fable_or_folktale_retelling" ? 0.35 : 0.3)) return (bump("pq4"), { ok: false, q: 0, f });
  }
  if (f.rare > 0.045) return (bump("pq5"), { ok: false, q: 0, f });
  if (NONFIC.has(genre) && BLOCK_NONFIC.test(t)) return (bump("pq11"), { ok: false, q: 0, f });
  const names = f.names.length;
  if (names > 4) return (bump("pq6"), { ok: false, q: 0, f });
  // 미완 맥락 지시어: 지문만으로 대상이 안 보이는 시작
  if (/^(Mr|Mrs|Miss)\.?\s/.test(t.trim()) === false && /\b(the said|aforesaid|the above|the preceding|the former|the latter|the last chapter|the next chapter|as I said|as before)\b/i.test(t)) return (bump("pq7"), { ok: false, q: 0, f });
  const q = 1 - f.rare / 0.045 * 0.5 - Math.max(0, avg - 18) / 30 - names * 0.04 + Math.min(f.mood, 4) * 0.02 + Math.min(f.fig, 2) * 0.03;
  return { ok: true, q, f };
}
function tagsOf(f: Feat, genre: Genre, text: string): string[] {
  const t: string[] = [];
  if (f.fig >= 1) t.push("fig");
  if (f.fig >= 2 || (f.fig >= 1 && f.symbol >= 2)) t.push("fig2");
  if (f.shift >= 1 && f.contrast >= 1) t.push("shift");
  if (f.evalw >= 2 || f.firstPerson >= 3) t.push("attitude");
  if (f.desire >= 1 && f.people >= 1) t.push("motive");
  if (f.people >= 3 || (f.people >= 2 && f.names.length >= 2)) t.push("relation");
  if (f.symbol >= 3 && f.fig >= 1) t.push("symbol");
  if (f.mood >= 3) t.push("mood");
  if (f.contrast >= 2 || f.sentences >= 5) t.push("structure");
  if (f.poly >= 1) t.push("poly");
  if (f.sentences >= 4) t.push("main");
  if (f.contrast >= 1 && f.sentences >= 4) t.push("underline");
  return t;
}

function proseCands(id: number, genre: Genre, src: string, startFrac = 0.08, endFrac = 0.95, stride = 1): Cand[] {
  const ps = paragraphs(src);
  const lo = src.length * startFrac, hi = src.length * endFrac;
  const out: Cand[] = [];
  const isDrama = genre === "drama";
  for (let a = 0; a < ps.length; a += stride) {
    const p = ps[a];
    if (p.start < lo || p.end > hi) continue;
    if (!isDrama && !proseLike(p)) continue;
    if (isDrama && !/^[A-Z][A-Z' ]{1,20}\.\s*$/.test(p.text.trim())) continue; // 화자 표시에서 시작
    // 창 확장: 시작 문장부터 문단 단위로 최대 3문단(드라마는 최대 12 덩어리)
    const sentAll: { start: number; end: number; para: number }[] = [];
    const maxPara = isDrama ? 12 : 4;
    let bad = false;
    for (let b = a; b < Math.min(ps.length, a + maxPara); b++) {
      const q = ps[b];
      if (!isDrama && !proseLike(q)) { if (b === a) bad = true; break; }
      if (b > a && (src.slice(ps[b - 1].end, q.start).match(/\n/g) ?? []).length > 2) { bad = true; break; }
      if (isDrama) { sentAll.push({ start: q.start, end: q.end, para: b }); continue; }
      for (const s of sentenceSpans(q)) sentAll.push({ ...s, para: b });
    }
    if (bad && sentAll.length === 0) continue;
    // 시작 문장은 첫 문단의 첫 문장 또는 둘째 문장
    const startIdxs = isDrama ? [0] : [0, 1, 2, 3, 4];
    for (const si of startIdxs) {
      if (si >= sentAll.length) continue;
      let wordsAcc = 0;
      for (let ei = si; ei < sentAll.length; ei++) {
        const raw = src.slice(sentAll[si].start, sentAll[ei].end);
        wordsAcc = wc(raw);
        if (wordsAcc > 185) break;
        const lastTerm = isDrama ? /[.!?]["”’')_]*\s*$/.test(raw) : /[.!?]["”’')]?\s*$/.test(raw);
        if (wordsAcc >= 88 + (sentAll[si].start % 45) && lastTerm) {
          const text = unwrap(raw, false);
          if (isDrama) break;
          if (!textChecks(text, genre)) break;
          const pq = proseQuality(text, genre);
          if (!pq.ok) break;
          out.push({ id, genre, start: sentAll[si].start, end: sentAll[ei].end, text, words: wc(text), q: pq.q, feat: pq.f, tags: tagsOf(pq.f, genre, text) });
          break;
        }
      }
    }
  }
  return out;
}

// 드라마: 화자 표시 + 대사 반복(스머트셋). 무대 지시문·밑줄 표기 허용, 80~180단어, 마지막은 대사 끝
function dramaCands(id: number, src: string): Cand[] {
  const ps = paragraphs(src);
  const out: Cand[] = [];
  for (let a = 0; a < ps.length; a++) {
    if (!/^[A-Z][A-Z' ]{1,20}\.\s*$/.test(ps[a].text.trim())) continue;
    let acc = 0;
    for (let b = a; b < Math.min(ps.length, a + 14); b++) {
      acc += wc(ps[b].text);
      if (acc > 185) break;
      const raw = src.slice(ps[a].start, ps[b].end);
      if (acc >= 95 && b > a + 3 && !/^[A-Z][A-Z' ]{1,20}\.\s*$/.test(ps[b].text.trim()) && /[.!?]["”’')_]*\s*$/.test(raw.trim())) {
        const text = raw.replace(/[ \t]*\n[ \t]*\n[ \t\n]*/g, "\n\n").replace(/([^\n])\n(?!\n)[ \t]*/g, "$1 ");
        const t = norm(text);
        if (/[\[\]*<>{}|]/.test(t) || BLOCK.test(t) || DIALECT.test(t) || /\b(god|die|dead|soul|heaven|wicked|hell|drunk)\b/i.test(t) || /[0-9]/.test(t) || /[^\x00-\x7F’‘“”—–…]/.test(t) || (t.match(/_/g) ?? []).length > 6) break;
        if (/^[IVXL]+\s*$/m.test(text) || /\b(Letter from|Dear|Yours|Sincerely|Telegram)\b|^\s*_?(To|From):/m.test(text)) break;
        const turns = [...text.matchAll(/^([A-Z][A-Z' ]{1,20})\.\s*$/gm)].length;
        if (turns < 4) break;
        const speakers = new Set([...text.matchAll(/^([A-Z][A-Z' ]{1,20})\.\s*$/gm)].map((m) => m[1]));
        if (speakers.size < 2) break;
        const f = features(text);
        const q = 0.8 - f.rare * 5;
        out.push({ id, genre: "drama", start: ps[a].start, end: ps[b].end, text, words: wc(text), q, feat: f, tags: ["structure", "shift", "relation", "attitude", "mood", "poly", "main", "motive", "underline", "fig", "symbol", "fig2"].filter(() => true) });
        break;
      }
    }
  }
  return out;
}

// 시: 연(빈 줄로 구분) 단위, 한 시 안에서 연속 연 2~5개, 60~180단어
function poemCands(id: number, src: string): Cand[] {
  const ps = paragraphs(src);
  const lo = src.length * 0.03, hi = src.length * 0.97;
  const isStanza = (p: Para) => {
    const lines = p.text.split("\n");
    if (lines.length < 3 || lines.length > 24) return false;
    const avg = lines.reduce((s, l) => s + l.trim().length, 0) / lines.length;
    if (avg > 54 || avg < 14) return false;
    if (lines.slice(0, -1).some((l) => l.trim().length > 58)) return false; // 줄바꿈된 산문이 아니라 시행인지(행 길이 상한)
    if (/^\s*[A-Z0-9 ,.'"-]{6,}\s*$/.test(p.text.trim()) ) return false;
    const caps = lines.filter((l) => /^\s*["“‘']?[A-Z]/.test(l)).length;
    return caps >= lines.length * 0.6;
  };
  const out: Cand[] = [];
  for (let a = 0; a < ps.length; a++) {
    if (ps[a].start < lo || ps[a].end > hi || !isStanza(ps[a])) continue;
    let acc = 0, b = a;
    for (; b < Math.min(ps.length, a + 6); b++) {
      if (!isStanza(ps[b]) || (b > a && (src.slice(ps[b - 1].end, ps[b].start).match(/\n/g) ?? []).length > 2)) { b--; break; }
      acc += wc(ps[b].text);
      if (acc >= 74) break;
      if (b === Math.min(ps.length, a + 6) - 1) break;
    }
    if (b < a || acc < 74 || acc > 185 || b >= ps.length) { bump("pm1"); continue; }
    // 첫 연이 앞선 시에서 이어지는지 확인(앞 문단이 연이면 시 중간에서 시작 — 허용하되 제목행 포함 금지)
    const raw = src.slice(ps[a].start, ps[b].end);
    const text = raw.split("\n").map((l) => l.trim()).join("\n").replace(/\n{2,}/g, "\n\n");
    const t = norm(text);
    if (/[\[\]*<>{}|_]/.test(t) || BLOCK_CORE.test(t) || /\b(god|lord|heaven|faith|hymn|prayer|savior|saviour)\b/i.test(t) || /[0-9]/.test(t) || /[^\x00-\x7F’‘“”—–…]/.test(t)) { bump("pm2"); continue; }
    if (/\b(thou|thee|thy|thine|hath|hast|doth|dost|wilt|shalt|o'er|e'er|ne'er)\b/i.test(t)) { bump("pm3"); continue; }
    const f = features(text);
    if (f.rare > 0.07) { bump("pm4"); continue; }
    if (!/[.!?]["”’')]?\s*$/.test(text.trim())) { bump("pm5"); continue; }
    out.push({ id, genre: "poetry", start: ps[a].start, end: ps[b].end, text, words: wc(text), q: 0.8 - f.rare * 4 + f.fig * 0.02, feat: f, tags: tagsOf(f, "poetry", text).concat(["main"]) });
  }
  return out;
}

// ---------- 메타 ----------
const CATALOG = new Map<number, { birth: number | null }>();
for (const f of ["gutenberg_selected.json", "gutenberg_selected_humanities.json"]) { const fp = path.join(ROOT, "catalog", f); if (existsSync(fp)) for (const x of JSON.parse(readFileSync(fp, "utf-8"))) CATALOG.set(x.id, { birth: x.birth ?? null }); }
function metaOf(id: number) {
  const it = ITEMS.find((x) => x.id === id)!;
  const m = JSON.parse(readFileSync(it.file + ".meta.json", "utf-8"));
  const t = TEXT.get(id)!;
  let year: number | null = null;
  const head = t.slice(0, 6000);
  const cat = CATALOG.get(id);
  const lo = (cat?.birth ?? 1700) + 18, hi = (m.authorDeathYear ?? 1930) + 3;
  const ym = head.match(/(?:copyright|published|©|printed|first edition|\(c\))[^0-9]{0,30}(1[6-9][0-9]{2})/i);
  if (ym && Number(ym[1]) >= lo && Number(ym[1]) <= hi) year = Number(ym[1]);
  return { m, year, sha: m.textSha256 as string };
}

// ---------- 후보 수집 ----------
const allCands: Cand[] = [];
const supply: Record<string, number> = {};
const SCR = process.env.LIT40_TMP ?? OUT;
const ONLY = process.env.LIT40_ONLY ? process.env.LIT40_ONLY.split(",").map(Number) : null;
const workIds = [...new Set(Object.values(WORKS).flat())].filter((id) => !ONLY || ONLY.includes(id));
for (const id of workIds) {
  const src = TEXT.get(id);
  if (!src) { console.error("본문 없음", id); continue; }
  const gs = new Set<Genre>([WORK_GENRE.get(id)!, ...(EXTRA_GENRES[id] ?? [])]);
  for (const g of gs) {
    let c: Cand[] = [];
    if (g === "drama") c = dramaCands(id, src);
    else if (g === "poetry") c = poemCands(id, src);
    else {
      c = proseCands(id, g, src);
      if (g === "letter") c = c.filter((x) => x.feat.firstPerson >= 2);
      if (g === "memoir") c = c.filter((x) => x.feat.firstPerson >= 1);
      if (g === "personal_essay") c = c.filter((x) => x.feat.firstPerson >= 1 || x.feat.evalw >= 2);
    }
    for (const x of c) allCands.push(x);
    supply[`${id}:${g}`] = c.length;
  }
}
const AUTO_POETRY_EXCLUDE = new Set([52156, 10622, 10598, 38497, 47348, 33601, 28856, 57099, 73223, 4925]);
for (const it of ITEMS) {
  if (WORKS.poetry.includes(it.id) || AUTO_POETRY_EXCLUDE.has(it.id) || (ONLY && !ONLY.includes(it.id))) continue;
  const c = poemCands(it.id, TEXT.get(it.id)!);
  if (c.length >= 4) { for (const x of c) allCands.push(x); supply[`${it.id}:poetry(auto)`] = c.length; }
}
writeFileSync(path.join(SCR, "supply.tmp.json"), JSON.stringify(supply));
console.log("후보 총", allCands.length);

// ---------- 선택 ----------
function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
const rand = rng(20261001);
const DEMAND: Record<Genre, number> = { short_story: 137, novel_excerpt: 98, personal_essay: 71, memoir: 65, poetry: 35, letter: 12, drama: 12, fable_or_folktale_retelling: 8 };
const TARGET: Record<Genre, number> = Object.fromEntries(Object.entries(DEMAND).map(([g, n]) => [g, Math.ceil(n * 1.22)])) as Record<Genre, number>;
type Pick = Cand & { poolGenre: Genre; fallback: boolean };
const picked: Pick[] = [];
const perWork = new Map<number, number>();
const nameUse = new Map<string, number>();
const GAP = (g: Genre) => (g === "drama" || g === "poetry" ? 0 : 6000);
const clash = (c: Cand) => picked.some((p) => p.id === c.id && c.start < p.end + GAP(c.genre) && p.start < c.end + GAP(c.genre));
const shortages: Record<string, { target: number; demand: number; got: number; reason: string }> = {};
const genreOrder: Genre[] = ["drama", "letter", "fable_or_folktale_retelling", "poetry", "memoir", "personal_essay", "novel_excerpt", "short_story"];
function fill(g: Genre, pool: Cand[], target: number, fallback: boolean): number {
  const byWork = new Map<number, Cand[]>();
  for (const c of pool) (byWork.get(c.id) ?? byWork.set(c.id, []).get(c.id)!).push(c);
  for (const [, arr] of byWork) arr.sort((a, b) => b.q + rand() * 0.2 - (a.q + rand() * 0.2));
  let got = 0, guard = 0;
  while (got < target && guard++ < 60) {
    let progressed = false;
    const order = [...byWork.keys()].sort(() => rand() - 0.5);
    for (const id of order) {
      if (got >= target) break;
      if ((perWork.get(id) ?? 0) >= PER_WORK) continue;
      const arr = byWork.get(id)!;
      while (arr.length) {
        const c = arr.shift()!;
        if (clash(c)) continue;
        if (c.feat.names.some((n) => (nameUse.get(n) ?? 0) >= 2)) continue;
        picked.push({ ...c, poolGenre: g, fallback }); perWork.set(id, (perWork.get(id) ?? 0) + 1);
        for (const n of c.feat.names) nameUse.set(n, (nameUse.get(n) ?? 0) + 1);
        got++; progressed = true; break;
      }
    }
    if (!progressed) break;
  }
  return got;
}
for (const g of genreOrder) {
  const own = allCands.filter((c) => c.genre === g);
  let got = fill(g, own, TARGET[g], false);
  if (g === "short_story" && got < TARGET[g]) {
    // 대안: 소설 작품의 남은 작품당 한도에서 자족적 장면을 단편 슬롯으로 돌린다(출처에 workForm=novel 표시).
    const novelPool = allCands.filter((c) => c.genre === "novel_excerpt" && !clash(c));
    got += fill(g, novelPool.map((c) => ({ ...c })), TARGET[g] - got, true);
  }
  const nWorks = new Set(picked.filter((p) => p.poolGenre === g).map((p) => p.id)).size;
  console.log(g, "선택", got, "/", TARGET[g], "(수요", DEMAND[g], ") 작품", nWorks);
  if (got < TARGET[g]) shortages[g] = { target: TARGET[g], demand: DEMAND[g], got, reason: "작품당 5개 상한 + 필터 통과 후보 부족" };
}
console.log("총", picked.length);

// ======================= 2단계: 슬롯 배정·출력·검증 =======================
type PlanCell = { skill: string; questionType: string; genre: string; count: number };
type PlanBatch = { batchId: string; route: string; difficulty: string; candidates: number; cells: PlanCell[] };
const plan = JSON.parse(readFileSync(path.join(REPO, "data/rw-generation/plan-literary-40.json"), "utf-8")) as { batches: PlanBatch[] };
const easyBatches = plan.batches.filter((b) => b.route === "excerpt");
type Slot = { batchId: string; idx: number; candidateId: string; skill: string; questionType: string; genre: Genre };
const slots: Slot[] = [];
for (const b of easyBatches) {
  const flat: { skill: string; questionType: string; genre: string }[] = [];
  const left = b.cells.map((c) => ({ ...c }));
  while (left.some((c) => c.count > 0)) for (const c of left) if (c.count > 0) { flat.push(c); c.count--; } // expandBatch 와 같은 순서
  flat.forEach((f, i) => slots.push({ batchId: b.batchId, idx: i, candidateId: `${b.batchId}-${String(i + 1).padStart(3, "0")}`, skill: f.skill, questionType: f.questionType, genre: f.genre as Genre }));
}
function fit(qt: string, p: Pick): number {
  const f = p.feat, t = new Set(p.tags);
  switch (qt) {
    case "narrator_attitude": return (t.has("attitude") ? 2 : 0) + (f.firstPerson >= 2 ? 1 : 0) + Math.min(f.evalw, 3) * 0.3;
    case "tone_shift": return t.has("shift") ? 3 : f.contrast >= 2 ? 1 : 0;
    case "main_idea_or_purpose": return (t.has("main") ? 1 : 0) + (f.sentences >= 5 ? 0.5 : 0) + (f.names.length <= 1 ? 0.3 : 0);
    case "figurative_language": return t.has("fig2") ? 3 : t.has("fig") ? 2 : t.has("symbol") ? 1 : 0;
    case "word_in_context": return Math.min(f.poly, 3);
    case "text_structure": return (t.has("structure") ? 1 : 0) + Math.min(f.contrast, 3) * 0.5;
    case "underlined_portion_function": return (t.has("underline") ? 1 : 0) + Math.min(f.contrast, 3) * 0.5;
    case "character_motivation": return t.has("motive") ? 3 : f.desire > 0 ? 1.5 : 0;
    case "tone_or_mood": return Math.min(f.mood, 5) * 0.6;
    case "relationship_between_characters": return t.has("relation") ? 3 : f.people >= 2 ? 1.5 : 0;
    case "symbolism": return t.has("symbol") ? 3 : t.has("fig") ? 1 : f.symbol * 0.3;
    default: return 0;
  }
}
const FIT_OK = 1;
const STRICT = ["symbolism", "tone_shift", "relationship_between_characters", "character_motivation", "figurative_language", "narrator_attitude", "underline_portion_function", "underlined_portion_function", "tone_or_mood", "text_structure", "word_in_context", "main_idea_or_purpose"];
const taken = new Set<Pick>();
const assign = new Map<string, { p: Pick; fit: number; substituteFor?: Genre }>();
const unmet: Slot[] = [];
for (const qt of STRICT) {
  for (const sl of slots.filter((x) => x.questionType === qt)) {
    const pool = picked.filter((p) => p.poolGenre === sl.genre && !taken.has(p));
    if (pool.length === 0) { unmet.push(sl); continue; }
    pool.sort((a, b) => fit(qt, b) + b.q * 0.4 + rand() * 0.05 - (fit(qt, a) + a.q * 0.4 + rand() * 0.05));
    const p = pool[0];
    taken.add(p); assign.set(sl.candidateId, { p, fit: fit(qt, p) });
  }
}
// 장르 부족 슬롯은 남은 발췌 중에서 대체한다(대체 사실을 인덱스에 표시). 선호 순서는 슬롯 장르별로 다르다.
const SUBST: Record<Genre, Genre[]> = {
  drama: ["short_story", "novel_excerpt", "memoir"], poetry: ["fable_or_folktale_retelling", "short_story", "personal_essay"],
  letter: ["memoir", "personal_essay"], short_story: ["novel_excerpt", "memoir"], novel_excerpt: ["short_story", "memoir"],
  memoir: ["personal_essay", "letter"], personal_essay: ["memoir"], fable_or_folktale_retelling: ["short_story", "novel_excerpt"],
};
for (const sl of unmet) {
  let done = false;
  for (const g of SUBST[sl.genre]) {
    const pool = picked.filter((p) => p.poolGenre === g && !taken.has(p));
    if (!pool.length) continue;
    pool.sort((a, b) => fit(sl.questionType, b) + b.q * 0.4 - (fit(sl.questionType, a) + a.q * 0.4));
    const p = pool[0]; taken.add(p); assign.set(sl.candidateId, { p, fit: fit(sl.questionType, p), substituteFor: sl.genre }); done = true; break;
  }
  if (!done) console.error("대체 발췌도 없음", sl.candidateId);
}
// 같은 질문 유형·같은 작품이 한 배치에서 몰리지 않는지는 보고서에서 점검.

// ---------- 출처 메타·기록 ----------
const hash = (x: string) => createHash("sha256").update(x).digest("hex");
function sourceOf(p: Pick, sl: Slot, extra: { fit: number; substituteFor?: Genre }) {
  const { m, year } = metaOf(p.id);
  const lf = TEXT.get(p.id)!;
  const rawSlice = lf.slice(p.start, p.end);
  return {
    author: m.author, work: m.work, year: year ?? null, yearSource: year ? "text-header(copyright/published line)" : "unknown(코퍼스 메타에 발행연도 없음)", authorDeathYear: m.authorDeathYear ?? null,
    sourceUrl: m.sourceUrl, license: m.license, licenseEvidenceUrl: m.licenseEvidenceUrl, corpusId: m.corpusId, corpusTextSha256: m.textSha256,
    excerptSha256: hash(p.text), sliceSha256: hash(rawSlice), location: { startChar: p.start, endChar: p.end, basis: "LF-normalized corpus text", approxPercent: Math.round((p.start / lf.length) * 100) },
    genre: p.poolGenre, workForm: p.fallback ? "novel(scene used for short_story slot)" : WORK_GENRE.get(p.id) ?? p.poolGenre,
  };
}
type Row = { text: string; source: ReturnType<typeof sourceOf> };
const index: Record<string, unknown>[] = [];
const perBatch: Record<string, Row[]> = {};
const usedTexts = new Set<string>();
for (const sl of slots) {
  const a = assign.get(sl.candidateId);
  if (!a) continue;
  const row: Row = { text: a.p.text, source: sourceOf(a.p, sl, a) };
  (perBatch[sl.batchId] ??= []).push(row);
  usedTexts.add(a.p.text);
  index.push({ batch: sl.batchId, line: sl.idx + 1, candidateId: sl.candidateId, skill: sl.skill, questionType: sl.questionType, slotGenre: sl.genre, excerptGenre: a.p.poolGenre, substituteFor: a.substituteFor ?? null, fit: Number(a.fit.toFixed(2)), weakFit: a.fit < FIT_OK, words: a.p.words, work: row.source.work, author: row.source.author });
}
// 예비분: 배정되지 않은 발췌
const reserve = picked.filter((p) => !taken.has(p));
const reserveRows: Row[] = reserve.map((p) => ({ text: p.text, source: sourceOf(p, slots[0], { fit: 0 }) }));
const writeJsonl = (file: string, rows: Row[]) => writeFileSync(path.join(OUT, file), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
const master: Row[] = [];
for (const b of easyBatches) { writeJsonl(`${b.batchId.replace("lit40-easy-", "lit40-easy-")}.jsonl`, perBatch[b.batchId] ?? []); master.push(...(perBatch[b.batchId] ?? [])); }
writeJsonl("lit40-easy-reserve.jsonl", reserveRows);
writeJsonl("lit40-easy.jsonl", [...master, ...reserveRows]);
writeFileSync(path.join(OUT, "lit40-easy.index.json"), JSON.stringify({ note: "master 파일의 앞 438줄은 배치 순서(01..05)대로 prepare 의 후보 순서와 정렬. 배치별 파일 lit40-easy-0N.jsonl 은 해당 배치 후보 순서로 정렬된 줄만 담음. 예비분은 lit40-easy-reserve.jsonl.", slots: index }, null, 1));

// ---------- 최종 검증(디스크에서 다시 읽어 확인) ----------
import("node:fs").then(() => {});
const check = readFileSync(path.join(OUT, "lit40-easy.jsonl"), "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Row);
let okQuote = 0, okSha = 0, okLf = 0;
const normCache = new Map<number, string>();
const idOf = (r: Row) => Number(String(r.source.corpusId).split("-").pop());
for (const r of check) {
  const id = idOf(r);
  if (verifyExcerpt(RAW.get(id)!, r.text).ok) okQuote++;
  const lf = TEXT.get(id)!;
  const slice = lf.slice(r.source.location.startChar, r.source.location.endChar);
  if (hash(slice) === r.source.sliceSha256 && hash(r.text) === r.source.excerptSha256) okSha++;
  if (verifyExcerpt(lf, r.text).ok) okLf++;
}
// 모든 후보(필터 통과 전체)의 인용 일치율: 작품별 정규화 1회 캐시
let candVerified = 0;
for (const c of allCands) {
  let n = normCache.get(c.id); if (n === undefined) { n = normalize(RAW.get(c.id)!); normCache.set(c.id, n); }
  const parts = c.text.split("[…]").map((x) => normalize(x)).filter(Boolean);
  if (parts.every((x) => n!.includes(x))) candVerified++;
}
// 유사도: 5-gram 집합 자카드 최대
const grams = (t: string) => { const w = norm(t).toLowerCase().match(/[a-z']+/g) ?? []; const g = new Set<string>(); for (let i = 0; i + 5 <= w.length; i++) g.add(w.slice(i, i + 5).join(" ")); return g; };
const gs = check.map((r) => grams(r.text));
const inv = new Map<string, number[]>();
gs.forEach((g, i) => { for (const x of g) (inv.get(x) ?? inv.set(x, []).get(x)!).push(i); });
let maxJ = 0; const pairHits = new Map<string, number>();
for (const [, ids] of inv) { for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) { const k = ids[a] + "," + ids[b]; pairHits.set(k, (pairHits.get(k) ?? 0) + 1); } }
for (const [k, h] of pairHits) { const [a, b] = k.split(",").map(Number); const j = h / (gs[a].size + gs[b].size - h); if (j > maxJ) maxJ = j; }
const uniq = new Set(check.map((r) => r.text)).size;
const perWorkCount = new Map<string, number>(); for (const r of check) perWorkCount.set(String(r.source.corpusId), (perWorkCount.get(String(r.source.corpusId)) ?? 0) + 1);
const overlaps = (() => { let n = 0; const by = new Map<string, Row[]>(); for (const r of check) (by.get(r.source.corpusId) ?? by.set(r.source.corpusId, []).get(r.source.corpusId)!).push(r); for (const [, rs] of by) for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) if (rs[i].source.location.startChar < rs[j].source.location.endChar && rs[j].source.location.startChar < rs[i].source.location.endChar) n++; return n; })();
// 통계
const nameFreq = new Map<string, number>(); for (const p of picked) for (const n of p.feat.names) nameFreq.set(n, (nameFreq.get(n) ?? 0) + 1);
const firstWord = new Map<string, number>(); for (const r of check) { const w = r.text.trim().split(/\s+/)[0].toLowerCase(); firstWord.set(w, (firstWord.get(w) ?? 0) + 1); }
const byGenre: Record<string, { n: number; works: number; avgWords: number }> = {};
for (const g of genreOrder) { const xs = picked.filter((p) => p.poolGenre === g); byGenre[g] = { n: xs.length, works: new Set(xs.map((p) => p.id)).size, avgWords: Number((xs.reduce((a, p) => a + p.words, 0) / Math.max(1, xs.length)).toFixed(1)) }; }
const aligned = index.length;
const weak = (index as { weakFit: boolean; questionType: string; slotGenre: string }[]).filter((x) => x.weakFit);
const subst = (index as { substituteFor: string | null; excerptGenre: string; slotGenre: string }[]).filter((x) => x.substituteFor);
const weakByType: Record<string, number> = {}; for (const w of weak) weakByType[w.questionType] = (weakByType[w.questionType] ?? 0) + 1;
const substByPair: Record<string, number> = {}; for (const x of subst) { const k = `${x.slotGenre}<-${x.excerptGenre}`; substByPair[k] = (substByPair[k] ?? 0) + 1; }
const words = check.map((r) => wc(r.text));
const summary = {
  generatedAt: new Date().toISOString(), script: "scripts/rw-corpus/lit40-easy-build.ts",
  totals: { candidatesInPlan: slots.length, alignedLines: aligned, reserveLines: reserveRows.length, totalUniqueExcerpts: uniq, totalLines: check.length, works: perWorkCount.size, maxPerWork: Math.max(...perWorkCount.values()) },
  words: { mean: Number((words.reduce((a, b) => a + b, 0) / words.length).toFixed(1)), min: Math.min(...words), max: Math.max(...words) },
  byGenre, demandByGenre: DEMAND, shortages,
  slotGenreSubstitutions: { count: subst.length, byPair: substByPair },
  weakFit: { count: weak.length, byQuestionType: weakByType, note: "발췌가 해당 문항 유형의 사전적 단서(비유·어조 전환·동기 등)를 충분히 갖지 못한 슬롯(휴리스틱). 생성 에이전트가 레시피 부적합로 표시할 수 있음." },
  verification: { quoteMatchAgainstRawCorpus: `${okQuote}/${check.length}`, quoteMatchAgainstLfCorpus: `${okLf}/${check.length}`, shaRecompute: `${okSha}/${check.length}`, allFilteredCandidatesQuoteMatch: `${candVerified}/${allCands.length}`, rate: Number((okQuote / check.length).toFixed(4)) },
  diversity: { exactDuplicates: check.length - uniq, sameWorkOverlaps: overlaps, max5gramJaccard: Number(maxJ.toFixed(3)), topNames: [...nameFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12), topFirstWords: [...firstWord.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10), licenses: [...new Set(check.map((r) => r.source.license))] },
  substitutedCells: Object.entries((index as { substituteFor: string | null; slotGenre: string; questionType: string; excerptGenre: string }[]).filter((x) => x.substituteFor).reduce<Record<string, number>>((m, x) => { const k = `${x.slotGenre} / ${x.questionType} <- ${x.excerptGenre}`; m[k] = (m[k] ?? 0) + 1; return m; }, {})).map(([cell, n]) => ({ cell, n })),
  shortageReasons: {
    drama: "코퍼스에서 희곡 형식(화자 표시 + 대사) 작품이 Clyde Fitch 『The Smart Set』 하나뿐이고 작품당 5개 상한 + 편지·종교·사망 표현 제외 후 3개만 남음(필요 12).",
    poetry: "시 작품이 소수(시집 3~4권, 시를 담은 산문집)이고 고어체·비ASCII·종교·전쟁 표현 필터 후 8작품 26개(필요 35).",
    short_story: "단편집이 적고(작품 약 25) 작품당 5개 상한 + 대사 위주·고유명사 과다·불쾌 표현 제외 후 117개(필요 137). 소설 작품의 남은 한도에서 자족적 장면으로 보충(workForm 표시).",
  },
  usage: "npx tsx scripts/rw-generation/session-cli.ts prepare --run <runId> --batch lit40-easy-0N --excerpts data/rw-generation/excerpts/lit40-easy-0N.jsonl  (배치별 파일은 후보 순서와 정렬됨)",
  rejectionCounts: DBG,
};
writeFileSync(path.join(OUT, "lit40-easy.summary.json"), JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1).slice(0, 4500));
