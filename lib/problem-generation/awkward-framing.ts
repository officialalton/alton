// SAT 수학 문항 서두·문법 점검 규칙(2026-10-20). 결정론 컴파일러가 만든 신규 hard 문항에서 실제 SAT에 없는 어색한 상황 설명과
// 단수 주어 + 복수 동사 오류를 걸러낸다. DB 접근 없음(순수 함수). 규칙 하나라도 걸리면 세트에 쓰지 않는다.
//   F1 메타 서두: 교사·튜터·저자가 문제 자체(old test item, warm-up question, homework item …)를 점검·제시·채점하는 상황 설명
//   F2 메타 지시: "The following scenario comes from…", "Think about the everyday situation described in this passage" 같은 본문 없는 안내문
//   F3 시제 불일치: "Last week, … is working …" (과거 시간 표지 + 현재진행)
//   F4 주어-동사 수 불일치: "The equation … are …" (단수 equation/expression/function/system/line/graph 바로 뒤의 are)
export type FramingHit = { rule: "F1_meta_framing" | "F2_meta_pointer" | "F3_tense_clash" | "F4_subject_verb_number"; match: string };

const ROLE = "(?:tutor|teaching assistant|textbook author|quiz writer|club advisor|study group|instructor|math teacher|teacher|student)";
const ITEM = "(?:old test item|warm-up question|homework item|practice problem|review exercise|worksheet problem|quiz question|test item|practice item|exam question)";
const F1 = [
  new RegExp(`\\b${ROLE}\\b[^.?!]{0,40}\\b(?:is|are)\\s+(?:checking|reviewing|presenting|grading|revising|preparing|writing up|working through|setting up|going over)\\s+(?:an?|the)\\s+${ITEM}`, "i"),
  /\bat the whiteboard\b/i,
  /\b(?:wonders|is unsure|are unsure|hopes) (?:which method|to double-check|how)\b/i,
  /\bwants? to (?:double-check the result|see a clean solution)\b/i,
  /\b(?:warm-up question|homework item|old test item|review exercise|practice problem|quiz question) (?:during|for) (?:a )?study session\b/i,
];
const F2 = [
  /\bthe following scenario comes from\b/i,
  /\bthink about the everyday situation described in this passage\b/i,
  /\bthe next few lines describe a scenario\b/i,
  /\bhere are the details of a realistic scenario\b/i,
  /\bthis situation is taken from a workbook\b/i,
  /\ba review handout presents the situation\b/i,
  /\b(?:scenario|situation) (?:used|described) in (?:a )?(?:study session|worksheet|workbook|handout)\b/i,
];
const F3 = /\b(?:last week|yesterday|last month|last year|earlier today)\b[^.?!]{0,60}\b(?:is|are)\s+\w+ing\b/i;
const F4 = /(?:^|[.?!,:]\s+)(?:the|this|that|an?|one)\s+(?:equation|expression|function|system|line|graph)\b(?:\s+\$[^$]*\$)?\s+are\b/i; // 문장·절 첫머리 주어만("points on the graph are" 같은 전치사구 뒤는 제외)

export function findAwkwardFraming(text: string): FramingHit | null {
  const t = text.replace(/\s+/g, " ");
  for (const r of F1) { const m = t.match(r); if (m) return { rule: "F1_meta_framing", match: m[0].slice(0, 80) }; }
  for (const r of F2) { const m = t.match(r); if (m) return { rule: "F2_meta_pointer", match: m[0].slice(0, 80) }; }
  { const m = t.match(F3); if (m) return { rule: "F3_tense_clash", match: m[0].slice(0, 80) }; }
  { const m = t.match(F4); if (m) return { rule: "F4_subject_verb_number", match: m[0].slice(0, 80) }; }
  return null;
}

// 결정론 컴파일러(skills/a-kit.ts lead())가 문항 앞에 붙이는 한 문장 상황 설정. 수식·정답과 무관한 서술이라 통째로 빼도 문제는 그대로다.
const LEAD = /^(?:Today,|During tutoring,|As part of a unit review,|In a practice session,|Last week,|For extra practice,|At the start of class,) [^.\n]*\.\s+/;
/** 문항 맨 앞의 lead() 문장을 제거한다(없으면 그대로). */
export function stripMetaLead(stimulus: string): string {
  return stimulus.replace(LEAD, "");
}
