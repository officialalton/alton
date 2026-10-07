// 2026-10-02 모의고사 UAT(C1·C2) — 문항 텍스트 공용 방어 함수.
// 렌더 경로(응시·결과·오답)와 임포트·조립 경로가 같은 규칙을 쓰도록 한 곳에 둔다.

const HANGUL = /[ㄱ-ㆎ가-힣]/;

/** 문자열에 한글(자모·음절)이 있는지. */
export function hasHangul(text: string | null | undefined): boolean {
  return !!text && HANGUL.test(text);
}

export type StemFields = {
  passage?: string | null;
  stimulus?: string | null;
  question?: string | null;
  options?: (string | null)[] | null;
  statements?: (string | null)[] | null;
};

/**
 * C1 — 영어 SAT 문항의 학생 노출 본문(지문·질문·선택지·진술)에 한글이 있으면 그 필드 이름을 돌려준다.
 * 해설(explanation)은 한국어 해설이 정상이므로 검사하지 않는다.
 */
export function findHangulInStem(p: StemFields): string[] {
  const out: string[] = [];
  if (hasHangul(p.passage)) out.push("passage");
  if (hasHangul(p.stimulus)) out.push("stimulus");
  if (hasHangul(p.question)) out.push("question");
  (p.options ?? []).forEach((o, i) => { if (hasHangul(o)) out.push(`options[${i}]`); });
  (p.statements ?? []).forEach((o, i) => { if (hasHangul(o)) out.push(`statements[${i}]`); });
  return out;
}

/** 모의고사 풀 조립 후보에서 한글 본문 문항을 뺀다(순수 함수). */
export function excludeHangulStem<T extends StemFields>(rows: T[]): T[] {
  return rows.filter((r) => findHangulInStem(r).length === 0);
}

/** 비교용 정규화: 공백·수식 구분자($)·백슬래시 제거, 소문자. */
export function normalizeStem(text: string | null | undefined): string {
  return (text ?? "").replace(/[\s$\\]/g, "").toLowerCase();
}

/**
 * C2 — 지문이 질문과 사실상 같은 문장이면 지문을 비우고(질문만 표시),
 * 지문이 질문을 그대로 포함하면서 길이가 질문의 1.3배 이내면 중복 부분만 뺀다.
 * 그 밖(R&W 지문처럼 긴 본문)은 절대 건드리지 않는다.
 */
export function dedupeStem(passage: string | null | undefined, question: string | null | undefined): string {
  const p = passage ?? "";
  const q = (question ?? "").trim();
  if (!p.trim() || !q) return p;
  const np = normalizeStem(p);
  const nq = normalizeStem(q);
  if (!nq) return p;
  if (np === nq) return "";
  if (!np.includes(nq) || p.trim().length > q.length * 1.3) return p;
  const idx = p.lastIndexOf(q);
  if (idx < 0) return p; // 정규화로만 같고 원문 위치를 못 찾으면 안전하게 그대로 둔다.
  return (p.slice(0, idx) + p.slice(idx + q.length)).trim();
}

/**
 * 2026-10-06 은행 게이트 — 초안 저장 시점의 공통 차단 사유(없으면 null).
 *  · sat_* 문항의 본문(지문·질문·선택지·진술)과 영어 해설에 한글이 있으면 저장하지 않는다.
 *  · 모의고사용(mock_exam)·양쪽(both) 문항은 영어 해설(explanationEn)이 비어 있으면 저장하지 않는다.
 */
export function draftBankGateError(p: {
  examSystem: string | null | undefined;
  usageScope: string | null | undefined;
  passage?: string | null;
  question?: string | null;
  options?: (string | null)[] | null;
  statements?: (string | null)[] | null;
  explanationEn?: string | null;
}): string | null {
  if ((p.examSystem ?? "").startsWith("sat_")) {
    const fields = findHangulInStem({ passage: p.passage, question: p.question, options: p.options, statements: p.statements });
    if (hasHangul(p.explanationEn)) fields.push("explanation_en");
    if (fields.length) return `영어 SAT 문항의 본문·선택지·영어 해설에 한글이 있어 저장하지 않았습니다 (${fields.join(", ")}).`;
  }
  if ((p.usageScope === "mock_exam" || p.usageScope === "both") && !(p.explanationEn ?? "").trim()) {
    return "모의고사용 문항은 영어 해설(explanation_en)이 있어야 저장할 수 있습니다.";
  }
  return null;
}

/** 객관식 정답 키 정합: 정답 번호가 선택지 범위 안이고 선택지가 서로 다르다. 문제 없으면 null. */
export function answerKeyError(options: (string | null)[] | null | undefined, correctIndex: number | null | undefined): string | null {
  if (!options || options.length < 2) return "선택지가 2개 미만입니다.";
  if (correctIndex == null || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) return "정답 번호가 선택지 범위를 벗어났습니다.";
  const norm = options.map((o) => (o ?? "").trim().toLowerCase());
  if (new Set(norm).size !== norm.length) return "선택지에 같은 내용이 중복돼 있습니다.";
  return null;
}
