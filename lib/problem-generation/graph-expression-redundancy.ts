// 외부 검수(2026-10-18, SAT Practice Test 1 Math 10·11·15·19번) — 같은 함수·직선을 그래프와 식으로 둘 다 주면
// 한쪽만으로 풀려서 "읽기"와 "계산" 중 무엇을 묻는지 흐려진다. 문항 하나는 한 표현만 제시한다.
// 순수 함수(DB·LLM 없음): 컴파일러 단위 테스트와 전수 점검 스크립트가 같이 쓴다.

type PlaneLikeFigure = { type?: string; objects?: { kind?: string }[] } | null | undefined;

const DRAWN_KINDS = new Set(["line", "function", "piecewise", "circle", "inequality"]);

/** 좌표평면에 그려진 직선·함수 곡선 수. */
export function drawnCurveCount(figure: PlaneLikeFigure): number {
  if (!figure || figure.type !== "plane") return 0;
  return (figure.objects ?? []).filter((o) => o.kind && DRAWN_KINDS.has(o.kind)).length;
}

/** 지문에서 "y = …"·"f(x) = …" 꼴로 수치가 모두 정해진 식(미지 상수 a·b·c 없음)을 중복 없이 센다. */
export function explicitEquations(text: string): string[] {
  const plain = text.replace(/\$/g, "").replace(/\\left|\\right/g, "").replace(/\\cdot/g, "*");
  const found = new Set<string>();
  for (const m of plain.matchAll(/(?:\b[a-zA-Z]\(\s*[a-z]\s*\)|\by)\s*=\s*([^,;.?\n]*?)(?=\s*(?:,|;|\.|\?|\n|\band\b|\bwhere\b|$))/g)) {
    const rhs = m[1].split(/\s+(?:is|are|and|where|for|in|on|at|that|which|with|shown|has|have|so|if|when)\b/)[0].trim();
    if (!/\d/.test(rhs) || !/[xt]/.test(rhs.replace(/\\frac|\\sqrt|\\cdot/g, ""))) continue; // f(x) = 0 처럼 변수 없는 값은 곡선 정의가 아니다
    const stripped = rhs.replace(/\\frac|\\sqrt/g, "").replace(/[xt]/g, "");
    if (/[A-Za-z]/.test(stripped)) continue; // g(x) 같은 다른 함수·a, b 같은 문자 상수가 섞인 식은 완결된 정의가 아니다
    found.add(m[0].replace(/\s+/g, ""));
  }
  // 원의 방정식 (x - h)^2 + (y - k)^2 = r^2, 일차 부등식 y > mx + b
  for (const m of plain.matchAll(/\(\s*x\s*[-+]?\s*\d*\s*\)\s*\^\s*2\s*\+\s*\(\s*y\s*[-+]?\s*\d*\s*\)\s*\^\s*2\s*=\s*\d+/g)) found.add(m[0].replace(/\s+/g, ""));
  for (const m of plain.matchAll(/\by\s*(?:<=|>=|<|>|\\le(?:q)?|\\ge(?:q)?|≤|≥)\s*[^,;.?\n]*\bx\b[^,;.?\n]*/g)) found.add(m[0].replace(/\s+/g, ""));
  return [...found];
}

/** 그려진 곡선마다 같은 곡선을 정의하는 식이 지문에 있으면 true(그래프가 새 정보를 주지 않는다). */
export function hasGraphAndExpressionForSameCurves(figure: PlaneLikeFigure, passage: string): boolean {
  const d = drawnCurveCount(figure);
  if (d === 0) return false;
  return explicitEquations(passage).length >= d;
}
