// 2026-09-14 문제 템플릿 ⑤ — 유형 코드 표준화 + 유형별 문항 말투.
// SAT Practice Test 5 분석(docs/2026-09-14-problem-template-design.md). 유형(skill_type)은 자유 입력을 막지 않지만
// 여기 있는 코드를 고르면 AI 가 실제 시험 문항 말투·자극 모양을 그대로 따른다.

export type ProblemSkill = {
  code: string;
  label: string;
  family: "SAT RW" | "SAT Math" | "AP";
  /** 기본 형식 — 새 문제 상자에서 이 유형을 고르면 이 형식으로 맞춘다. */
  defaultFormat: "mc" | "spr" | "essay" | "math";
  /** 생성 규칙 — 프롬프트에 그대로 들어간다(자극 모양·문항 말투·선택지 규칙). */
  rule: string;
};

export const PROBLEM_SKILLS: ProblemSkill[] = [
  // ---------------- SAT Reading and Writing (전부 4지선다)
  { code: "rw.words_in_context", label: "Words in Context", family: "SAT RW", defaultFormat: "mc",
    rule: "지문 1단락(50~120단어). 빈칸이면 ______ 를 **정확히 한 곳**에 두고 문항은 정확히 \"Which choice completes the text with the most logical and precise word or phrase?\". 인용 단어형이면 \"As used in the text, what does the word “…” most nearly mean?\". 선택지는 단어/짧은 구 4개." },
  { code: "rw.text_structure_purpose", label: "Text Structure and Purpose", family: "SAT RW", defaultFormat: "mc",
    rule: "지문 1단락. 문항은 \"Which choice best states the main purpose of the text?\" 또는 \"Which choice best describes the function of the underlined sentence in the text as a whole?\"(밑줄 문장은 지문 안에서 **정확히 한 문장**만 __문장__ 으로 표시하고, 밑줄이 없으면 'underlined' 를 묻지 않는다). 지문에 빈칸은 두지 않는다. 선택지는 To + 동사 구문." },
  { code: "rw.cross_text", label: "Cross-Text Connections", family: "SAT RW", defaultFormat: "mc",
    rule: "지문 두 개를 각각 'Text 1' 과 'Text 2' 라는 **제목 줄 한 줄**(그 줄에 다른 글자 없이) 아래에 쓴다(각 60~110단어, 관점이 다른 두 저자). 두 지문과 질문 사이는 빈 줄로 나눈다. 질문은 'Text 1'/'Text 2'/'both texts' 를 명시한다. 문항은 \"Based on the texts, how would the author of Text 2 most likely respond to …?\" 류. 선택지는 완결된 문장." },
  { code: "rw.central_ideas_details", label: "Central Ideas and Details", family: "SAT RW", defaultFormat: "mc",
    rule: "지문 1단락. 문항은 \"Which choice best states the main idea of the text?\" 또는 \"According to the text, …?\". 선택지는 완결된 문장." },
  { code: "rw.command_of_evidence_text", label: "Command of Evidence (Textual)", family: "SAT RW", defaultFormat: "mc",
    rule: "연구·주장 요약 지문. 문항은 \"Which finding, if true, would most directly support …?\" / \"Which quotation from … most effectively illustrates the claim?\". 선택지는 완결된 문장·인용." },
  { code: "rw.command_of_evidence_quant", label: "Command of Evidence (Quantitative)", family: "SAT RW", defaultFormat: "mc",
    rule: "표·그래프 자료는 **마크다운 표가 아니라 figure(type:'data')** 로 낸다(표·막대·선·산점도 중 하나). 지문은 그 자료를 설명하는 단락이고, 지문이 부르는 항목 이름·값·단위는 자료와 정확히 같아야 한다. 문항은 \"Which choice most effectively uses data from the table to complete the statement?\" 류. 선택지는 표의 수치를 인용한 문장." },
  { code: "rw.inferences", label: "Inferences", family: "SAT RW", defaultFormat: "mc",
    rule: "지문이 미완성 문장으로 끝난다(마지막에 ______ 를 정확히 한 곳). 문항은 정확히 \"Which choice most logically completes the text?\". 선택지는 문장 끝을 완성하는 절." },
  { code: "rw.boundaries", label: "Boundaries (Standard English Conventions)", family: "SAT RW", defaultFormat: "mc",
    rule: "지문 한 단락 안 한 문장에 ______ 빈칸을 정확히 한 곳. 문항은 정확히 \"Which choice completes the text so that it conforms to the conventions of Standard English?\". 선택지 4개는 문장부호·수일치·시제·대소문자만 다른 같은 어구." },
  { code: "rw.form_structure_sense", label: "Form, Structure, and Sense", family: "SAT RW", defaultFormat: "mc",
    rule: "Boundaries 와 같은 문항 말투. 선택지는 동사 형태·대명사·수 일치·수식어 위치가 다른 어구." },
  { code: "rw.transitions", label: "Transitions", family: "SAT RW", defaultFormat: "mc",
    rule: "두 문장 사이 ______ 빈칸을 정확히 한 곳. 문항은 정확히 \"Which choice completes the text with the most logical transition?\". 선택지는 접속 표현(However, / For example, / Therefore, / Similarly, 등)." },
  { code: "rw.rhetorical_synthesis", label: "Rhetorical Synthesis", family: "SAT RW", defaultFormat: "mc",
    rule: "첫 줄은 정확히 'While researching a topic, a student has taken the following notes:' 이고, 그 다음 줄부터 메모를 '- ' 로 시작하는 4~6줄 목록으로 쓴다(빈 줄 없이 이어서). 그 뒤 빈 줄 한 줄, 그리고 질문 단락. 문항은 \"The student wants to … Which choice most effectively uses relevant information from the notes to accomplish this goal?\". 선택지는 완결된 문장." },
  // ---------------- SAT Math
  { code: "math.algebra", label: "Algebra (선형식·연립·부등식)", family: "SAT Math", defaultFormat: "mc",
    rule: "일차식·연립방정식·부등식·선형 함수 해석. 수식은 $…$. 연립방정식은 $$…$$ 블록에 한 줄씩. 그래프가 필요하면 표준 좌표평면 figure(type:'plane')." },
  { code: "math.advanced", label: "Advanced Math (이차·지수·다항)", family: "SAT Math", defaultFormat: "mc",
    rule: "이차·지수·다항·유리식·절댓값·함수 표기. 수식은 $…$. 함수 그래프가 필요하면 표준 좌표평면 figure(type:'plane', objects 에 kind:'function')." },
  { code: "math.problem_solving_data", label: "Problem-Solving and Data Analysis", family: "SAT Math", defaultFormat: "mc",
    rule: "비율·비례·속도·단위 변환·백분율·확률·조건부확률·표본 통계·오차범위·평균/중앙값·관찰 연구와 실험의 주장 판단. 자료는 마크다운 표가 아니라 figure(type:'data' — 표·숫자 목록·막대/선·히스토그램·산점도·상자그림)로 낸다. 문맥 해석 문항 포함." },
  { code: "math.geometry_trig", label: "Geometry and Trigonometry", family: "SAT Math", defaultFormat: "mc",
    rule: "각·삼각형·원·부피·삼각비. 도형은 표준 템플릿 figure(type: parallel_transversal | triangle | circle | polygon | solid | composite — figure 설명의 리터럴 예시 모양 그대로)로 낸다. 좌표를 찍는 옛 형식(geometry)과 angles:[{line, quadrant}] 옛 표기는 쓰지 않는다. 그림에 답이 그대로 보이지 않게, notToScale 은 실제 비율이 아닐 때만." },
  { code: "math.spr", label: "Student-Produced Response (숫자 입력)", family: "SAT Math", defaultFormat: "spr",
    rule: "정답이 하나의 수(정수·소수·분수)로 정해지는 문항. 선택지 없음. answers 에 동치 표현을 모두 넣는다(7/2 와 3.5). 양수 5자·음수 6자 안." },
  // ---------------- AP
  { code: "ap.free_response", label: "AP Free Response (서술형)", family: "AP", defaultFormat: "essay",
    rule: "AP 자유 응답형. 자료(표·지문·그래프)와 (a)(b)(c) 소문항. explanation 에 채점 기준(rubric)을 항목별로." },
];

export const PROBLEM_SKILL_BY_CODE = new Map(PROBLEM_SKILLS.map((s) => [s.code, s]));

/** 코드 또는 라벨로 유형을 찾는다(자유 입력 호환). */
export function findProblemSkill(input: string | null | undefined): ProblemSkill | null {
  if (!input) return null;
  const q = input.trim().toLowerCase();
  return PROBLEM_SKILLS.find((s) => s.code === q || s.label.toLowerCase() === q) ?? null;
}
