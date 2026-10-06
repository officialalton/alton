/** 저장된 학년 값('11th grade', '11', 'Grade 11', '11학년' …)을 항상 'Grade 11' 한 형태로 만든다. 모르는 형태는 그대로 돌려준다. */
export function formatGradeLabel(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const m = v.match(/^(?:grade\s*)?(\d{1,2})(?:\s*(?:st|nd|rd|th))?(?:\s*grade|\s*학년)?$/i);
  if (m) return `Grade ${m[1]}`;
  return v;
}

/** 이메일 등 평문에 마크다운 강조 기호(*, _, `, ~)가 새지 않게 이름에서 제거한다. */
export function plainName(raw: string | null | undefined): string {
  return (raw ?? "").replace(/[*_`~]/g, "").trim();
}
