// 2026-09-17(제품 오너 지시) — SPR(Student-Produced Response, 그리드 숫자 입력) 공용
// 답안 모델. 계산형 Math 컴파일러 19종이 각자 SPR 로직을 새로 만들지 않고, 이미
// 계산해 둔 정답 문자열("−3", "7/2" 같은 MC 정답 텍스트)을 그대로 넘기면 그리드
// 입력용 동치 정답 목록으로 바꿔주는 변환기 하나로 재사용한다.
//
// 실제 자동 채점(허용 오차·동치 판정)은 여기가 아니라 DB 함수
// public.spr_answer_matches(supabase/migrations/20261360000000_p3_spr_numeric_answer_format.sql)가
// 한다 — 분수/소수 정규화, 소수 4자리 반올림·절사 허용을 이미 구현해 두었다. 이
// 파일의 역할은 "저장할 동치 정답 목록 자체"를 만들고, 그 목록이 SAT 그리드 형식(문자
// 수 제한, 대분수 금지)에 실제로 들어맞는지 미리 걸러내는 것뿐이다 — 같은 규칙을
// lib/problem-content-check.ts의 checkContent()가 저장 시점에 다시 검사한다(이중
// 게이트). 두 곳의 규칙이 어긋나면 안 되므로 정규식·길이 상수를 그대로 맞췄다.
//
// 불확실성 메모(그대로 알림): College Board 공식 디지털 SAT SPR 그리드의 정확한
// 문자 수 상한(양수/음수 각각 몇 자까지인지, '/' '.' '-'를 자리수에 포함하는지)은
// 출처마다 표현이 조금씩 다르다. 이 저장소는 2026-09-14에 이미 "양수 5자·음수 6자"
// 규칙을 정책으로 확정해 checkContent()와 학생 입력 검증(answerSprText)에 반영해
// 두었으므로, 이 파일은 새 규칙을 만들지 않고 그 기존 정책을 그대로 재사용한다.
// 확정된 규칙 자체가 틀렸다면 이 파일이 아니라 그 정책을 먼저 바꿔야 한다.

export type SprAnswerModel = {
  /** 참고용 수치값 — 실제 채점은 DB의 spr_answer_matches가 answers 문자열로 한다. */
  value: number;
  /** problem_versions.answers 에 그대로 저장할 동치 정답 문자열 목록(최소 1개). */
  answers: string[];
  inputHint: string;
  inputHintEn: string;
};

const HINT_KO = "정수, 소수, 또는 분수로 입력하세요(예: 3.5 또는 7/2). 대분수는 입력할 수 없습니다.";
const HINT_EN = "Enter an integer, decimal, or fraction (e.g. 3.5 or 7/2). Mixed numbers are not allowed.";

/** checkContent()의 SPR 정답 형식 검사와 정확히 같은 규칙(2026-09-14 확정 정책). */
export function fitsSprFormat(s: string): boolean {
  if (!/^-?\d+(?:\.\d+)?(?:\/\d+)?$/.test(s)) return false;
  const body = s.replace("-", "").replace(/[./]/g, "");
  if (body.length > 6) return false;
  if (s.startsWith("-") ? s.length > 6 : s.length > 5) return false;
  return true;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

function trimZeros(s: string): string {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

function truncateTo(abs: number, decimals: number): string {
  const factor = 10 ** decimals;
  const t = Math.trunc(abs * factor + 1e-9) / factor;
  return trimZeros(t.toFixed(decimals));
}

/** 소수 표기 후보들 — 정확한 값, 그리고 4→0자리까지 반올림·절사한 값(SAT 규칙: 소수는
 * 끝까지 안 들어가면 반올림하거나 그 자리에서 끊어도 정답으로 인정한다). */
function decimalCandidates(abs: number): string[] {
  const out = new Set<string>();
  out.add(trimZeros(abs.toFixed(6)));
  for (let d = 4; d >= 0; d--) {
    out.add(abs.toFixed(d));
    out.add(truncateTo(abs, d));
  }
  return Array.from(out);
}

export function sprFromInteger(n: number): SprAnswerModel {
  const s = String(n);
  if (!fitsSprFormat(s)) throw new Error(`spr: 정수 ${n}이 그리드 형식에 들어가지 않습니다.`);
  return { value: n, answers: [s], inputHint: HINT_KO, inputHintEn: HINT_EN };
}

function sprFromDecimalOnly(value: number): SprAnswerModel {
  const neg = value < 0;
  const forms = new Set<string>();
  for (const d of decimalCandidates(Math.abs(value))) {
    const signed = neg ? `-${d}` : d;
    if (fitsSprFormat(signed)) forms.add(signed);
  }
  if (forms.size === 0) throw new Error(`spr: 값 ${value}이 그리드 형식에 들어가지 않습니다.`);
  return { value, answers: Array.from(forms), inputHint: HINT_KO, inputHintEn: HINT_EN };
}

/** num/den 분수 정답. 기약분수로 나누어떨어지면 정수로 취급한다. 기약·비기약 분수
 * 표기와 소수 표기를 모두 후보로 만들고, 그리드 형식(문자 수 제한)에 들어맞는 것만
 * 남긴다 — 하나도 안 들어가면 던진다(호출부가 그 후보를 실패로 집계하고 재시도한다). */
export function sprFromFraction(num: number, den: number): SprAnswerModel {
  if (den === 0) throw new Error("spr: 분모가 0입니다.");
  if (den < 0) {
    num = -num;
    den = -den;
  }
  const g = gcd(num, den);
  const rn = num / g;
  const rd = den / g;
  if (rd === 1) return sprFromInteger(rn);
  const value = num / den;
  const neg = value < 0;
  const forms = new Set<string>();
  const fracStr = `${rn}/${rd}`;
  const unreducedFracStr = num !== rn || den !== rd ? `${num}/${den}` : null;
  for (const f of [fracStr, unreducedFracStr]) {
    if (f && fitsSprFormat(f)) forms.add(f);
  }
  for (const d of decimalCandidates(Math.abs(value))) {
    const signed = neg ? `-${d}` : d;
    if (fitsSprFormat(signed)) forms.add(signed);
  }
  if (forms.size === 0) throw new Error(`spr: 값 ${fracStr}이 그리드 형식(양수 5자·음수 6자 이내)에 들어가지 않습니다.`);
  return { value, answers: Array.from(forms), inputHint: HINT_KO, inputHintEn: HINT_EN };
}

/**
 * MC 컴파일러가 이미 계산해 둔 정답 텍스트("−3", "7/2", "3.5" 같은 값 문자열)를 그대로
 * SPR 답안 모델로 바꾼다 — 컴파일러 19종마다 SPR 계산을 새로 만들지 않고 기존
 * generate*Model()의 정답 계산 하나만 재사용하기 위한 공용 진입점이다.
 *
 * 문장형 정답("Two distinct real solutions" 같은 판별식 부호 문제, 그래프/표 선택형
 * 문항)은 숫자로 파싱되지 않으므로 null을 돌려준다 — 그 문항 종류는 SPR 후보에서
 * 자연히 빠지고(배치 실행기가 실패로 집계해 다음 후보로 넘어간다), 제품 오너가 지정한
 * "판별식 부호형(num_real_solutions)은 SPR 대상이 아니다" 같은 종류별 제외를 별도
 * 분기 없이 만족시킨다.
 */
export function sprFromAnswerText(text: string): SprAnswerModel | null {
  const t = text.trim();
  if (!t) return null;

  const fracMatch = /^(-?\d+)\/(\d+)$/.exec(t);
  if (fracMatch) {
    try {
      return sprFromFraction(Number(fracMatch[1]), Number(fracMatch[2]));
    } catch {
      return null;
    }
  }
  if (/^-?\d+$/.test(t)) {
    try {
      return sprFromInteger(Number(t));
    } catch {
      return null;
    }
  }
  if (/^-?(\d+\.\d*|\.\d+)$/.test(t)) {
    const value = Number(t);
    if (!Number.isFinite(value)) return null;
    const decimalPlaces = t.replace("-", "").split(".")[1]?.length ?? 0;
    // 소수를 분수로도 근사해 동치 형태를 늘린다(예: "0.5" → "1/2"도 정답으로 저장).
    if (decimalPlaces > 0 && decimalPlaces <= 6) {
      const denom = 10 ** decimalPlaces;
      const numer = Math.round(value * denom);
      try {
        return sprFromFraction(numer, denom);
      } catch {
        /* 분수 표기가 그리드에 안 맞으면 소수 단독으로 폴백 */
      }
    }
    try {
      return sprFromDecimalOnly(value);
    } catch {
      return null;
    }
  }
  return null;
}
