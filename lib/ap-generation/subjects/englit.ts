// AP English Literature and Composition 생성 가이드 설정(2026-10-14). 사실: docs/ap/englit-facts.md, 설계: docs/ap/englit-groundwork.md.
// 정답을 코드로 확정할 수 없는 과목 → 정답 보증은 다중 독립 풀이 + 적대적 검토 + 제2 모델 패널 + 결정적 게이트(lib/ap-generation/englit-gates.ts)가 맡는다.
// 모든 시·산문·희곡 지문은 ALTON 원본(가공 저자·가공 제목). 실제 작품 본문은 어디에도 쓰지 않는다(문항 유형만 참고).
import curriculum from "../../../data/ap/curriculum-2027/ap_english_literature.json";
import { englitCategoryOf, englitGroupOfUnit, type EnglitGroup } from "../../ap-exam/englit-rules";

type Cur = { skills: { code: string; category: string; label: string }[]; units: { code: string; title: string; topics: { code: string; title: string; skills: string[] }[] }[] };
const cur = curriculum as unknown as Cur;
export const LT_SKILLS = cur.skills.map((s) => ({ code: s.code, cat: englitCategoryOf(s.code)!, label: s.label }));
export const LT_MC_SKILL_CODES = LT_SKILLS.filter((s) => s.code !== "7.E").map((s) => s.code);
/** 스킬 → (장르 묶음별) CED 토픽 코드 목록. 문항 topic 은 코드가 정한다(모델은 고르지 않는다). */
const bySkill: Record<string, { code: string; group: EnglitGroup }[]> = {};
for (const u of cur.units) for (const t of u.topics) for (const s of t.skills) (bySkill[s] ??= []).push({ code: t.code, group: englitGroupOfUnit(u.code)! });
export const ltTopicFor = (skill: string, group: EnglitGroup, salt = 0): string => {
  const all = bySkill[skill] ?? []; const own = all.filter((x) => x.group === group); const l = own.length ? own : all;
  return l.length ? l[Math.abs(salt) % l.length].code : "";
};
export const LT_ALL_TOPICS = new Set(cur.units.flatMap((u) => u.topics.map((t) => t.code)));

export const LT_FORMS = ["poem", "prose", "drama"] as const;
export type LtForm = (typeof LT_FORMS)[number];
/** 문학 장치 인벤토리: 블루프린트 devices[].device 는 이 값이어야 한다. 근거 구절(quote)이 지문에 그대로 있어야 하며, 일부는 코드가 형태를 검증한다(simile·enjambment·caesura·alliteration·anaphora). */
export const LT_DEVICES = [
  "simile", "metaphor", "extended_metaphor", "personification", "allusion", "imagery", "symbol", "irony", "juxtaposition", "paradox", "oxymoron", "hyperbole", "understatement",
  "apostrophe", "anaphora", "repetition", "alliteration", "enjambment", "caesura", "volta", "refrain", "motif", "foreshadowing", "flashback", "dialogue", "free_indirect_discourse", "shift_in_tone", "contrast", "diction", "syntax",
] as const;
export const LT_CODE_CHECKED_DEVICES = ["simile", "enjambment", "caesura", "alliteration", "anaphora"] as const;
export const LT_DISTRACTOR_LABELS = ["too_narrow", "too_broad", "reversal", "unsupported", "partially_right", "wrong_function", "lexical_trap", "wrong_scope", "misread_speaker", "wrong_tone", "literal_for_figurative"] as const;
export const LT_COGNITIVE = ["identify", "explain", "evaluate"] as const;
export const LT_OPTION_COUNT = 4;

export const LT_PASSAGE_BOUNDS: Record<LtForm, { minWords: number; maxWords: number; minLines: number; maxLines: number }> = {
  poem: { minWords: 100, maxWords: 330, minLines: 14, maxLines: 44 },
  prose: { minWords: 480, maxWords: 800, minLines: 9, maxLines: 24 + 90 }, // 줄 수는 산문 접기 결과(폭 56자 기준 약 11~16줄/100단어) — 상한은 넉넉히 둔다
  drama: { minWords: 450, maxWords: 800, minLines: 9, maxLines: 24 + 90 },
};
export const LT_FRQ_BOUNDS = { poem: { minWords: 100, maxWords: 400 }, prose: { minWords: 600, maxWords: 800 } } as const;

/** AI 투 상투구(반복 시 사람 문체가 아니다). 지문·샘플 답안에서 개수를 센다. */
export const LT_BANNED_PHRASES = [
  "delve", "tapestry", "testament to", "a symphony of", "dance of", "whispers of", "echoes of", "a mosaic of", "the weight of", "the fabric of", "ever-evolving", "bittersweet symphony",
  "a kaleidoscope", "woven into", "a beacon", "shimmering", "ethereal", "a dance between", "silent witness", "the hum of", "the tapestry",
] as const;

/** 시·산문·희곡 문항 유형(문항 유형만 참고 — 문구·지문은 복사하지 않는다). 스킬별로 생성기 프롬프트에 들어간다. */
export const LT_ITEM_TYPES: Record<string, string[]> = {
  "1.A": ["what a specific detail of description or action reveals about a character's perspective or motive", "which quality of a character is best supported by a quoted passage"],
  "1.B": ["what the unchanged (or changed) condition of a character at the end shows", "how a character's attitude differs between two points in the text and what the difference accomplishes"],
  "1.C": ["how the contrast between two characters (foils) shapes the reader's understanding of one of them", "what a juxtaposed pair of characters or voices emphasizes"],
  "1.D": ["what a detail or exchange reveals about the nuance of a relationship between two characters", "the unspoken tension or tenderness conveyed by a particular gesture or silence"],
  "1.E": ["how a character's choice, action or speech reveals a complexity or inner conflict", "what the contradiction between a character's words and actions suggests"],
  "2.A": ["which details in a quoted stretch convey the time, place or atmosphere", "what sensory details establish about the setting"],
  "2.B": ["the function of the setting in the narrative (mood, conflict, theme)", "how a change of setting marks a change in a character or in the action"],
  "2.C": ["how a character's relationship to a place is shown (belonging, confinement, escape)", "how the setting reflects or pressures a character"],
  "3.A": ["how the order of events (flashback, interruption, a delayed reveal) affects the reader", "how the passage is arranged (chronological, circular, fragmentary) and why that matters"],
  "3.B": ["the function of a specific sequence of events (the order of three actions or images)", "what the placement of a sentence, stanza or exchange within the whole accomplishes"],
  "3.C": ["the function of a structural unit: stanza break, volta, paragraph transition, final line or last sentence", "how the form (line length, stanza pattern, paragraph length) supports the meaning"],
  "3.D": ["the function of a contrast between two images, tones, stanzas or paragraphs", "how a shift in diction or mood between two points reshapes the meaning"],
  "3.E": ["the function of a significant event (a revelation, an arrival, a decision) in the passage", "how a key event changes the situation or the characters' understanding"],
  "3.F": ["the function of a conflict (internal or external) as it is developed in the passage", "what is at stake in the conflict and how the passage's details show it"],
  "4.A": ["who the narrator or speaker is, what is their relation to the events or addressee, and what the text signals about them", "the situation of the speaker (time, place, listener) as implied by details"],
  "4.B": ["the effect of the point of view (first person, third-person limited, omniscient) on what the reader knows", "what a shift in perspective within the text accomplishes"],
  "4.C": ["what a narrator's or speaker's diction, syntax or detail reveals about attitude or perspective", "the tone created by a particular choice of word or sentence pattern"],
  "4.D": ["how the narrator's reliability (partial knowledge, self-deception, bias) affects the reader's interpretation", "how the reader can tell the narrator's account is limited"],
  "5.A": ["the literal versus the figurative sense of a phrase in context", "how a word or phrase works on two levels at once"],
  "5.B": ["the effect of a specific word choice (connotation, register) in context", "how one word or phrase contributes to the tone or meaning of a line or sentence"],
  "5.C": ["what a recurring object or image symbolizes and how the text shows it", "how a symbol develops across the passage"],
  "5.D": ["the function of a cluster of images (sensory detail) in conveying a mood or idea", "how a specific image contributes to the speaker's or narrator's perspective"],
  "6.A": ["what a simile compares and what the comparison conveys", "how the comparison in a simile shapes the reader's view of its subject"],
  "6.B": ["what a metaphor (or extended metaphor) equates and what associations it brings", "how a metaphor changes the way a subject is understood"],
  "6.C": ["how personification gives human qualities to a nonhuman thing and what that accomplishes", "what attitude toward a place or object personification suggests"],
  "6.D": ["what an allusion to a myth, tale, or well-known story adds to the meaning of the passage", "how a reference to a familiar story frames the speaker's or character's situation"],
  "7.A": ["which of four claims about the passage is best supported by the quoted evidence", "which short interpretive statement is defensible and needs textual evidence"],
  "7.B": ["which thesis statement is the most defensible, specific interpretation of the passage", "which of four theses responds to a prompt about a technique and a complex idea"],
  "7.C": ["which commentary best explains how a given piece of evidence supports a given claim", "which sentence of commentary most clearly links the evidence to the line of reasoning"],
  "7.D": ["which quotation is the best evidence for a stated line of reasoning", "which pair of details most fully supports a claim about the passage"],
};
/** 지문 분위기·주제 풀(다양성용). 시: 한 장면·한 목소리·한 이미지 계열. 모든 지문은 가공이며 실존 인물·작품을 흉내내지 않는다. */
export const LT_POEM_SUBJECTS = [
  "a ferry deckhand recalling the last crossing before the bridge opened", "an older sister packing a younger one's school trunk", "a baker's hands at four in the morning", "the speaker addresses a house being sold", "a night shift nurse watching snow", "a farmer talking to a drought-cracked field",
  "the speaker and a dog who has outlived the family", "a letter never mailed to a brother who emigrated", "market women at the close of a long day", "the speaker teaching a grandmother to use a phone", "a lighthouse keeper's last winter", "a boy learning to whistle a song his father never finished",
  "a clock repairer who cannot repair his own hours", "a dramatic monologue by a river addressing a dam", "an elegy for a neighbourhood tree cut down", "the speaker counting trains from a rented room", "a swimmer who returns to the pool after an illness", "an ode to a cracked teacup",
  "a persona poem spoken by a seed in a vault", "the speaker watching a mother fold laundry in lamplight", "a dock at low tide and what the tide leaves", "a soldier's daughter reading the map of a retired route", "fishermen mending nets while a storm decides", "a poem of two voices: a teacher and a leaving student",
  "a boarding school corridor at midnight", "the speaker finds a stranger's handwriting inside a library book", "a rooftop garden in a crowded city", "an apology to a field one has left fallow", "the speaker walks the length of a closed railway", "a grandfather's bench in the village square",
] as const;
export const LT_PROSE_PREMISES = [
  "a young apprentice delivers a repaired watch to the house of a customer who never pays", "two sisters sort their late mother's linens before the house is sold", "a ferry operator and a passenger who rides without a destination", "a village schoolteacher receives a visitor from the city ministry",
  "a boy is sent to carry a message across the salt flats and meets a stranger", "a widow rents her spare room to a quiet clerk", "a night-shift cook at a roadside inn and a traveller who orders the same dish each year", "a lamplighter's last evening before the electric lines arrive",
  "a girl returns to her grandmother's island to sell a boat", "a translator is asked to read a dying man's letter aloud", "a boarding house breakfast where each guest hides a small disappointment", "a clerk discovers an error in a ledger that would ruin a neighbour",
  "a father and son repair a fence line that marks a disputed border", "a schoolgirl is chosen to recite at a ceremony she does not believe in", "a pianist practises in an empty hall while the caretaker listens", "an old fisherman refuses the harbour master's offer of a pension",
  "a mother waits at a station for a train that does not stop there", "a surveyor stays a night with a family that does not want the road", "a cartographer's assistant corrects a map and loses her place", "a boy and a stray cat in a monsoon-season alley",
  "a seamstress is asked to alter a wedding dress for a bride she dislikes", "a retired teacher meets a former student who has become mayor", "a clockmaker's daughter inherits a shop of stopped clocks", "two brothers sit through a funeral meal without speaking",
  "a young nurse reads the diary of a patient who will not speak", "a trader arrives in a mountain town on the day of its yearly fast", "a lighthouse inspector finds the keeper's logbook unfinished", "a girl hides a failing mark inside a bread tin",
] as const;
export const LT_DRAMA_PREMISES = [
  "a mother and her adult daughter argue over whether to sell the family shop, interrupted by a customer", "two lighthouse keepers wait out a storm and a secret", "a brother returns from abroad to a house that has learned to manage without him",
  "an innkeeper and a stranger bargain over a room on the night before a wedding", "a clerk and her supervisor discuss a missing receipt in an empty office after hours", "two neighbours on a rooftop watch a flood rise and dispute whose fault it is",
  "a teacher and a student's father meet over an unpaid fee", "a tailor and a soldier haggle over the price of a repaired coat", "a grandmother and a granddaughter prepare a meal while a decision hangs unspoken",
] as const;
export const LT_ERAS = ["19th-century manner", "early 20th-century manner", "mid-20th-century manner", "contemporary"] as const;

/** FRQ Q3(문학 논증)에서 학생이 고를 수 있는 작품 목록(약 40편; 실제 출판된 소설·희곡의 제목·저자 — 본문 인용 없음). ALTON 자체 선정으로 공식 시험 목록과 무관하며, 실존 작품·저자 표기는 코드 검증용 고정 목록이다. */
export const LT_WORKS_LIST = [
  ["Things Fall Apart", "Chinua Achebe"], ["Pride and Prejudice", "Jane Austen"], ["Jane Eyre", "Charlotte Bronte"], ["Wuthering Heights", "Emily Bronte"], ["Great Expectations", "Charles Dickens"], ["Middlemarch", "George Eliot"],
  ["The Great Gatsby", "F. Scott Fitzgerald"], ["Their Eyes Were Watching God", "Zora Neale Hurston"], ["Beloved", "Toni Morrison"], ["Invisible Man", "Ralph Ellison"], ["The Color Purple", "Alice Walker"], ["Frankenstein", "Mary Shelley"],
  ["Hamlet", "William Shakespeare"], ["Macbeth", "William Shakespeare"], ["Othello", "William Shakespeare"], ["The Tempest", "William Shakespeare"], ["A Doll's House", "Henrik Ibsen"], ["Death of a Salesman", "Arthur Miller"],
  ["A Streetcar Named Desire", "Tennessee Williams"], ["The Importance of Being Earnest", "Oscar Wilde"], ["Heart of Darkness", "Joseph Conrad"], ["The Stranger", "Albert Camus"], ["The Metamorphosis", "Franz Kafka"], ["One Hundred Years of Solitude", "Gabriel Garcia Marquez"],
  ["The God of Small Things", "Arundhati Roy"], ["The Remains of the Day", "Kazuo Ishiguro"], ["Never Let Me Go", "Kazuo Ishiguro"], ["The Kite Runner", "Khaled Hosseini"], ["Mrs Dalloway", "Virginia Woolf"],
  ["To the Lighthouse", "Virginia Woolf"], ["Song of Solomon", "Toni Morrison"], ["A Raisin in the Sun", "Lorraine Hansberry"], ["The Bluest Eye", "Toni Morrison"], ["Brave New World", "Aldous Huxley"], ["Oedipus Rex", "Sophocles"], ["The Awakening", "Kate Chopin"], ["Anna Karenina", "Leo Tolstoy"],
  ["Crime and Punishment", "Fyodor Dostoevsky"], ["The Handmaid's Tale", "Margaret Atwood"], ["The Namesake", "Jhumpa Lahiri"],
] as const;
