// FRQ 응답 직렬화: 파트 라벨 → 텍스트 맵을 JSON 문자열로 저장한다(mock_exam_answers.response 한 칸, 기존 save RPC 재사용).
export function parseFrqAnswer(raw: string): Record<string, string> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === "object" && !Array.isArray(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === "string" ? x : String(x ?? "")]));
  } catch { /* 옛 형식(평문)은 파트 a 로 */ }
  return { a: raw };
}
export function frqAnswerToJson(parts: Record<string, string>): string {
  return JSON.stringify(parts);
}
