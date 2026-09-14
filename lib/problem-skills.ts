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
    rule: "지문 1단락(50~120단어). 빈칸이면 ______ 로 두고 문항은 정확히 \"Which choice completes the text with the most logical and precise word or phrase?\". 인용 단어형이면 \"As used in the text, what does the word “…” most nearly mean?\". 선택지는 단어/짧은 구 4개." },
  { code: "rw.text_structure_purpose", label: "Text Structure and Purpose", family: "SAT RW", defaultFormat: "mc",
    rule: "지문 1단락. 문항은 \"Which choice best states the main purpose of the text?\" 또는 \"Which choice best describes the function of the underlined sentence in the text as a whole?\"(밑줄 문장은 __문장__ 으로 표시). 선택지는 To + 동사 구문." },
  { code: "rw.cross_text", label: "Cross-Text Connections", family: "SAT RW", defaultFormat: "mc",
    rule: "지문 두 개를 'Text 1' / 'Text 2' 제목으로 나눠 쓴다(각 60~110단어, 관점이 다른 두 저자). 문항은 \"Based on the texts, how would the author of Text 2 most likely respond to …?\" 류. 선택지는 완결된 문장." },
  { code: "rw.central_ideas_details", label: "Central Ideas and Details", family: "SAT RW", defaultFormat: "mc",
    rule: "지문 1단락. 문항은 \"Which choice best states the main idea of the text?\" 또는 \"According to the text, …?\". 선택지는 완결된 문장." },
  { code: "rw.command_of_evidence_text", label: "Command of Evidence (Textual)", family: "SAT RW", defaultFormat: "mc",
    rule: "연구·주장 요약 지문. 문항은 \"Which finding, if true, would most directly support …?\" / \"Which quotation from … most effectively illustrates the claim?\". 선택지는 완결된 문장·인용." },
  { code: "rw.command_of_evidence_quant", label: "Command of Evidence (Quantitative)", family: "SAT RW", defaultFormat: "mc",
    rule: "마크다운 파이프 표(| 항목 | 값 |)를 지문 앞에 두고 그 표를 설명하는 단락을 쓴다. 문항은 \"Which choice most effectively uses data from the table to complete the statement?\" 류. 선택지는 표의 수치를 인용한 문장." },
  { code: "rw.inferences", label: "Inferences", family: "SAT RW", defaultFormat: "mc",
    rule: "지문이 미완성 문장으로 끝난다(마지막에 ______). 문항은 정확히 \"Which choice most logically completes the text?\". 선택지는 문장 끝을 완성하는 절." },
  { code: "rw.boundaries", label: "Boundaries (Standard English Conventions)", family: "SAT RW", defaultFormat: "mc",
    rule: "문장 하나에 ______ 빈칸. 문항은 정확히 \"Which choice completes the text so that it conforms to the conventions of Standard English?\". 선택지 4개는 문장부호·수일치·시제·대소문자만 다른 같은 어구." },
  { code: "rw.form_structure_sense", label: "Form, Structure, and Sense", family: "SAT RW", defaultFormat: "mc",
    rule: "Boundaries 와 같은 문항 말투. 선택지는 동사 형태·대명사·수 일치·수식어 위치가 다른 어구." },
  { code: "rw.transitions", label: "Transitions", family: "SAT RW", defaultFormat: "mc",
    rule: "두 문장 사이 ______ 빈칸. 문항은 정확히 \"Which choice completes the text with the most logical transition?\". 선택지는 접속 표현(However, / For example, / Therefore, / Similarly, 등)." },
  { code: "rw.rhetorical_synthesis", label: "Rhetorical Synthesis", family: "SAT RW", defaultFormat: "mc",
    rule: "'While researching a topic, a student has taken the following notes:' 다음에 메모를 '- ' 로 시작하는 4~6줄 목록으로 쓴다. 문항은 \"The student wants to … Which choice most effectively uses relevant information from the notes to accomplish this goal?\". 선택지는 완결된 문장." },
  // ---------------- SAT Math
  { code: "math.algebra", label: "Algebra (선형식·연립·부등식)", family: "SAT Math", defaultFormat: "mc",
    rule: "일차식·연립방정식·부등식·선형 함수 해석. 수식은 $…$. 연립방정식은 $$…$$ 블록에 한 줄씩. 그래프가 꼭 필요하면 figure(coordinate_plane)." },
  { code: "math.advanced", label: "Advanced Math (이차·지수·다항)", family: "SAT Math", defaultFormat: "mc",
    rule: "이차·지수·다항·유리식·절댓값·함수 표기. 수식은 $…$. 함수 그래프가 필요하면 figure(function 항목)." },
  { code: "math.problem_solving_data", label: "Problem-Solving and Data Analysis", family: "SAT Math", defaultFormat: "mc",
    rule: "비율·백분율·단위·확률·표본·평균/중앙값·산점도. 데이터는 마크다운 표 또는 figure(points/polyline). 문맥 해석 문항 포함." },
  { code: "math.geometry_trig", label: "Geometry and Trigonometry", family: "SAT Math", defaultFormat: "mc",
    rule: "각·삼각형·원·부피·삼각비. 도형이 필요하면 figure(geometry). 평행선·횡단선의 각은 반드시 angles:[{line, quadrant, text}] 로 교점·사분면을 지정한다(호가 그려진다). 다각형의 각은 angleLabels:[{at: 꼭짓점 인덱스, text}]. 변 라벨은 sideLabels(변 i = 점 i→i+1). 그림에 답이 그대로 보이지 않게, notToScale 은 실제 비율이 아닐 때만." },
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
