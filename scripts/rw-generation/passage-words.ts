// 지문 단어 수 코드 강제(2026-10-01): 규격(lib/rw-passages/schema.ts)은 60~220 단어, 레시피는 더 좁은 범위를 가질 수 있다.
// 직접 생성 테스트에서 프롬프트가 80~160단어를 요구했는데도 11/60건이 220단어를 넘었다 — 모델 지시에 의존하지 않고 코드가 판정한다.
export const SCHEMA_WORD_RANGE = { min: 60, max: 220 } as const;
export type WordRange = { min: number; max: number };

export const countWords = (t: string) => (t.replace(/<\/?u>/g, "").replace(/__/g, "").trim().match(/\S+/g) ?? []).length;

/** 레시피 범위를 규격 범위 안으로 좁힌다(규격 밖 값은 규격으로 자른다). */
export function effectiveRange(recipe?: Partial<WordRange> | null): WordRange {
  const min = Math.max(SCHEMA_WORD_RANGE.min, recipe?.min ?? SCHEMA_WORD_RANGE.min);
  const max = Math.min(SCHEMA_WORD_RANGE.max, recipe?.max ?? SCHEMA_WORD_RANGE.max);
  if (min > max) throw new Error(`단어 범위가 규격과 겹치지 않습니다: ${JSON.stringify(recipe)}`);
  return { min, max };
}

export type WordVerdict =
  | { action: "ok"; count: number }
  | { action: "retry"; count: number; instruction: string }
  | { action: "reject"; count: number; reason: string };

/**
 * attempt: 이미 재요청한 횟수(0 이면 첫 생성 결과). 범위 밖이면 maxRetries 까지 재요청, 넘으면 탈락.
 * 규격 한도(60~220)를 넘은 경우도 같은 규칙이다. 재요청 지시문은 몇 단어였고 목표가 몇 단어인지 알려준다.
 */
export function judgeWordCount(text: string, range: WordRange, attempt = 0, maxRetries = 1): WordVerdict {
  const count = countWords(text);
  if (count >= range.min && count <= range.max) return { action: "ok", count };
  const dir = count < range.min ? "짧습니다" : "깁니다";
  const target = Math.round((range.min + range.max) / 2);
  if (attempt >= maxRetries) return { action: "reject", count, reason: `지문 ${count}단어 — ${range.min}~${range.max} 범위 밖(재요청 ${attempt}회 후에도)` };
  return {
    action: "retry",
    count,
    instruction: `지문이 ${count}단어로 ${dir}. 같은 장면·같은 문항 설계를 유지하되 지문을 ${range.min}~${range.max}단어(목표 약 ${target}단어)로 다시 쓰고, 문항 전체를 새 지문에 맞게 다시 제출하라.`,
  };
}
