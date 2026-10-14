// 해설 표시용 줄바꿈 — 저장된 해설 문자열은 그대로 두고 화면에서만 선택지(A–E)별 설명을 줄로 나눈다.
// 규칙: 문장 시작에서 B/C/D/E 문자가 소문자 단어(영어) 또는 조사(한국어)로 이어지고, 서로 다른 선택지 문자가 2개 이상 있을 때만 나눈다.
// "A"는 관사로 쓰이는 문장이 많아 나누지 않는다(정답 문장 "… makes A the answer." 처럼 문장 중간에 있는 A 는 건드리지 않는다).
const EN_BREAK = /([.!?]["')\]]?)\s+(?=[B-E]\s+[a-z])/g;
const KO_BREAK = /([.!?다요]["')\]]?)\s+(?=[B-E](?:는|은|가|이|도|만|와|과|의)\s)/g;

function distinctOptionStarts(text: string): number {
  const found = new Set<string>();
  for (const m of text.matchAll(/(?:^|[.!?]["')\]]?\s+)([B-E])(?=\s+[a-z]|(?:는|은|가|이|도|만|와|과|의)\s)/g)) found.add(m[1]);
  return found.size;
}

export function breakOptionAnalysis(text: string): string {
  if (!text || text.includes("\n[A-E] ")) return text;
  if (distinctOptionStarts(text) < 2) return text;
  return text.replace(EN_BREAK, "$1\n").replace(KO_BREAK, "$1\n");
}
