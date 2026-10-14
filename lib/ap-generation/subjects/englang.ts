// AP English Language and Composition 생성 가이드 설정(2026-10-14). 본문: docs/ap/englang-groundwork.md, 사실: docs/ap/englang-facts.md.
// 이 과목은 정답을 코드로 확정할 수 없다 → 정답 보증은 다중 독립 풀이 + 적대적 검토 + 결정적 형식 게이트(lib/ap-generation/englang-gates.ts)가 맡는다.
// 모든 지문은 ALTON 원본 생성(provenance.kind = "original"). 실제 AP 지문 본문은 어디에도 쓰지 않는다(문항 유형만 참고).
import curriculum from "../../../data/ap/curriculum-2027/ap_english_language.json";
import { elangCategoryOf, elangSectionOf } from "../../ap-exam/elang-rules";

export type ElSkill = { code: string; category: string; section: "reading" | "writing"; label: string };
type Cur = { skills: { code: string; category: string; label: string }[]; units: { code: string; title: string; topics: { code: string; title: string; skills: string[] }[] }[] };
const cur = curriculum as unknown as Cur;
export const EL_SKILLS: ElSkill[] = cur.skills.map((s) => ({ code: s.code, category: elangCategoryOf(s.code)!, section: elangSectionOf(s.code)!, label: s.label }));
export const EL_SKILL_CODES = EL_SKILLS.map((s) => s.code);
export const EL_READING_SKILLS = EL_SKILLS.filter((s) => s.section === "reading").map((s) => s.code);
export const EL_WRITING_SKILLS = EL_SKILLS.filter((s) => s.section === "writing").map((s) => s.code);
/** 스킬 → 그 스킬을 다루는 CED 토픽 코드 목록(예: "3.C" → U7.1, U9.1). 문항 keywordCode/topic 은 이 목록에서 고른다. */
export const EL_TOPICS_FOR_SKILL: Record<string, string[]> = (() => {
  const m: Record<string, string[]> = {};
  for (const u of cur.units) for (const t of u.topics) for (const s of t.skills) (m[s] ??= []).push(t.code);
  return m;
})();
export const EL_ALL_TOPICS = new Set(cur.units.flatMap((u) => u.topics.map((t) => t.code)));
export const elTopicFor = (skill: string, salt = 0): string => { const l = EL_TOPICS_FOR_SKILL[skill] ?? []; return l.length ? l[Math.abs(salt) % l.length] : ""; };

/** 수사 장치 인벤토리: 블루프린트의 devices[].device 는 이 목록의 값이어야 하고, 문항이 장치를 다루면 그 장치는 블루프린트에 지문 안 문장 번호와 함께 있어야 한다. */
export const EL_DEVICES = [
  "metaphor", "simile", "analogy", "antithesis", "parallelism", "repetition", "rhetorical_question", "concession_and_rebuttal", "anecdote", "statistic", "appeal_to_authority",
  "pathos", "logos", "ethos", "tone_shift", "sentence_length_variation", "direct_address", "understatement", "irony", "personification", "juxtaposition", "definition", "cause_effect_chain", "enumeration", "qualification", "dash_or_colon_emphasis",
] as const;
/** 발전 방식(methods of development, 스킬 5.C·6.C). */
export const EL_METHODS = ["narration", "description", "process", "comparison_contrast", "cause_effect", "classification", "definition", "exemplification", "problem_solution", "analogy"] as const;
/** 오답 분류(distractor taxonomy). 문항의 오답마다 정확히 하나가 붙는다. */
export const EL_DISTRACTOR_LABELS = ["too_narrow", "too_broad", "reversal", "unsupported", "partially_right", "wrong_function", "lexical_trap", "wrong_scope", "illogical_relationship", "wrong_tone", "convention_error"] as const;
export type ElDistractorLabel = (typeof EL_DISTRACTOR_LABELS)[number];
export const EL_COGNITIVE = ["identify", "explain", "evaluate"] as const;
/** 인지 단계 쿼터 가정(식별 < 설명 < 평가, 40/40/20). 난이도 절대 보정 아님 — 서열값 용도. */
export const EL_COGNITIVE_QUOTA = { identify: 0.4, explain: 0.4, evaluate: 0.2 } as const;

/** 지문 통계 경계(가정 — 사람 검토로 확정; docs/ap/englang-groundwork.md §2.5). */
export const EL_READING_BOUNDS = { minWords: 380, maxWords: 780, minAvgSentence: 15, maxAvgSentence: 34, minGrade: 7, maxGrade: 17 } as const;
export const EL_WRITING_BOUNDS = { minWords: 170, maxWords: 360, minAvgSentence: 12, maxAvgSentence: 28, minGrade: 5, maxGrade: 16 } as const;
export const EL_SOURCE_BOUNDS = { minWords: 120, maxWords: 380 } as const;
export const EL_OPTION_COUNT = 4;

/** AI 투 상투구(반복 시 사람 문체가 아니다). 지문·소스·샘플 답안에서 개수를 센다(결정적). */
export const EL_BANNED_PHRASES = [
  "delve", "tapestry", "testament to", "in today's fast-paced world", "in today's digital age", "rich tapestry", "navigate the complexities", "it is important to note", "ever-evolving", "double-edged sword",
  "a beacon of", "stands as a", "game-changer", "paradigm shift", "unlock the potential", "in the realm of", "at the end of the day", "only time will tell", "the fabric of society", "plays a crucial role",
] as const;

/** 읽기·글쓰기 문항 유형(문항 유형만 참고 — 문구·지문은 복사하지 않는다). 스킬별로 생성기 프롬프트에 들어간다. */
export const EL_ITEM_TYPES: Record<string, string[]> = {
  "1.A": ["the primary purpose of the passage or of one paragraph", "the situation (exigence, occasion) the passage responds to, inferred from details", "the intended audience as signalled by assumptions, vocabulary and examples", "the writer's stance toward the subject"],
  "1.B": ["how a specific appeal or example speaks to the audience's values, beliefs or needs", "why a particular concession or framing would matter to this audience", "which audience would be most persuaded by a described strategy"],
  "3.A": ["whether a quoted sentence is a claim or evidence and what it does", "what a specific piece of evidence is used to support", "which claim in the passage a specific example best supports"],
  "3.B": ["the overarching thesis of the passage", "how the thesis (or opening paragraph) previews the structure of the argument", "which sentence best states the central claim"],
  "3.C": ["how a modifier, concession or counterargument qualifies a claim and what that does for the argument", "what alternative perspective the writer acknowledges and how it is handled"],
  "5.A": ["the line of reasoning across the passage (how one claim leads to the next)", "whether and how a paragraph supports the thesis", "the logical relationship between two adjacent claims"],
  "5.B": ["the function of a paragraph within the whole text", "how sequencing or a transitional sentence creates coherence", "what the placement of a particular sentence accomplishes"],
  "5.C": ["the method of development in a paragraph (e.g. cause-effect, comparison, exemplification) and why the writer uses it", "how an analogy or anecdote advances the writer's purpose"],
  "7.A": ["the effect of a specific word, connotation or figure of speech on tone", "how a shift in tone or diction between two points affects the argument", "how a short sentence after longer ones (syntax) creates emphasis"],
  "7.B": ["how the structure of a sentence (subordination, parallel clauses, sentence length) shows the relationship between ideas", "what placing a dependent clause first or last emphasizes"],
  "7.C": ["how punctuation (dash, colon, parenthesis, semicolon) affects clarity or emphasis in a specific sentence", "why a grammatical choice (voice, tense, pronoun) suits the purpose"],
  "2.A": ["choose the best opening or closing sentence for a stated purpose and context", "revise an introduction or conclusion so it fits the context the writer names"],
  "2.B": ["revise a sentence or add one so it fits a named audience's beliefs, values or needs"],
  "4.A": ["choose the sentence that best develops a paragraph with evidence for a stated claim", "choose evidence that supports the specific claim (not merely the topic)"],
  "4.B": ["choose the thesis statement that requires proof and previews the structure, given the writer's stated goal"],
  "4.C": ["qualify an overstated claim with a modifier, counterargument or alternative perspective as the writer wants"],
  "6.A": ["add commentary that explains how the evidence supports the claim", "choose the commentary sentence that links evidence to the line of reasoning"],
  "6.B": ["choose the transitional word, phrase or sentence that shows the specific logical relationship between two points", "place or reorder a sentence for coherence"],
  "6.C": ["choose the addition (example, analogy, definition, comparison) that best advances the writer's stated argument", "choose the method of development that suits the writer's stated aim"],
  "8.A": ["choose the wording that conveys a stated tone for a stated audience", "replace a word or phrase to fit the intended tone"],
  "8.B": ["combine sentences clearly and concisely, keeping a stated relationship between ideas", "revise a wordy, ambiguous or non-parallel sentence"],
  "8.C": ["correct a punctuation, agreement, pronoun, modifier or parallelism problem in a sentence", "choose the punctuation that correctly joins or separates clauses"],
};

/** 지문 장르·주제 풀(다양성용; 모든 지문은 가공이며 실존 인물·기관의 발언처럼 보이면 안 된다). 계획기가 시드로 고른다. */
export const EL_READING_GENRES = ["op-ed column", "personal essay", "public lecture excerpt", "letter to the editor", "commencement-style address", "magazine feature essay", "review essay", "open letter from an organisation", "reflective essay on a hobby or craft", "policy brief introduction", "town-hall speech", "newsletter column by a professional", "obituary-style tribute essay", "blog-style long-form argument", "historical-narrative essay"] as const;
export const EL_WRITING_GENRES = ["student council proposal", "local newspaper column draft", "museum exhibit essay draft", "science-club newsletter article draft", "college application essay draft", "public library blog post draft", "city-council testimony draft", "school-paper editorial draft", "community garden flyer essay draft", "report on a school project draft"] as const;
export const EL_THEMES = [
  "the value of public libraries in the age of search engines", "why small towns should keep their local newspapers", "walkable city design and neighbourhood life", "the ethics of wearing and sharing hand-me-down clothing", "amateur astronomy and the dark-sky movement",
  "school start times and adolescent sleep", "the case for teaching cursive handwriting", "urban beekeeping", "the economics of repair versus replacement", "language revival of a small regional dialect",
  "volunteer fire departments in rural counties", "the role of failure in learning a musical instrument", "commuting by bicycle in winter", "preserving old-growth street trees", "what community orchestras teach about cooperation",
  "the quiet value of boredom", "coastal erosion and the towns that adapt to it", "open-source software maintained by volunteers", "the history and revival of heirloom seed saving", "public transit as a civic institution",
  "citizen science and bird counts", "slow food and the school cafeteria", "why museums should lend objects to small towns", "sports officials and the culture of respect", "the case for mandatory community service in secondary school",
  "map-making and how maps persuade", "the decline and return of the pay phone as an art object", "noise pollution in public spaces", "translators as invisible authors", "the economics of free public parks",
  "mentorship between generations in skilled trades", "restoring a wetland near a suburb", "the ethics of zoos and wildlife sanctuaries", "tutoring programs run by teenagers", "preserving a night market's character during redevelopment",
  "learning to read data visualisations critically", "the first season of a school robotics team", "community radio in the streaming age", "how a seaside lighthouse became a classroom", "technology curfews at home and the family dinner table",
] as const;

export const EL_SOURCE_KINDS = ["text", "visual", "quantitative"] as const;
export const EL_FRQ_TYPE_BY_TEMPLATE = { q1: "synthesis", q2: "rhetorical_analysis", q3: "argument" } as const;
/** FRQ 루브릭 3행(공식 구조: 논지 0–1 · 증거와 해설 0–4 · 정교함 0–1; 공식 문구는 직접 대조 전까지 UNVERIFIED — 문안은 ALTON 요약). */
export const EL_RUBRIC_ROWS = [{ row_id: "A", name: "Thesis", max: 1 }, { row_id: "B", name: "Evidence and commentary", max: 4 }, { row_id: "C", name: "Sophistication", max: 1 }] as const;
export const EL_SAMPLE_WORDS = { high: [380, 780], mid: [260, 580], low: [110, 360] } as const;
