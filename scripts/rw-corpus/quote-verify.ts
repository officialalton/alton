// 인용 일치 검증(초안, 순수 함수): 문항의 지문이 원문 코퍼스에서 **글자 그대로** 나온 것인지 코드로 확인한다.
// 허용 정규화는 공백·개행 접기와 따옴표·대시 통일뿐이다(철자·구두점·대소문자는 고치지 않는다). 생략 표기 `[…]` 는 앞뒤 구간이 각각 원문에 연속으로 있어야 한다.
export const ELISION = "[…]";
export function normalize(s: string): string {
  return s
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[–—―]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}
export type VerifyResult = { ok: true; segments: { start: number; end: number }[] } | { ok: false; reason: string };
/** 정규화된 원문 안에서 발췌(생략 표기로 나뉜 구간 전부)가 차례대로, 각각 연속으로 나타나는지 확인한다. */
export function verifyExcerpt(sourceText: string, excerpt: string): VerifyResult {
  const src = normalize(sourceText);
  const parts = excerpt.split(ELISION).map((p) => normalize(p)).filter((p) => p.length > 0);
  if (parts.length === 0) return { ok: false, reason: "빈 발췌" };
  if (excerpt.includes("…") && !excerpt.includes(ELISION)) return { ok: false, reason: "생략은 [...] 표기(대괄호 + 줄임표)만 허용" };
  const segments: { start: number; end: number }[] = [];
  let from = 0;
  for (const part of parts) {
    const idx = src.indexOf(part, from);
    if (idx < 0) return { ok: false, reason: `구간이 원문에 글자 그대로 없음: "${part.slice(0, 30)}…"` };
    segments.push({ start: idx, end: idx + part.length });
    from = idx + part.length;
  }
  return { ok: true, segments };
}
/** 문항의 밑줄·인용 단어·증거 구간이 지문 안에 그대로 있는지(AI 가 인용을 지어내는 것 차단). */
export function verifyInsideExcerpt(excerpt: string, quote: string): boolean {
  return normalize(excerpt).includes(normalize(quote));
}
