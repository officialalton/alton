// AP 문항 텍스트의 수식 구분자 규칙(생성 게이트 + 해설 문장 조립 공용). 화면은 `$...$` 안의 수식만 KaTeX 로 그린다.
import { findUnwrappedMath } from "../ap-exam/tex-audit";

/** 해설 문장에 선택지 글자를 넣을 때: TeX 가 든 선택지(`$\frac{1}{10}$`, `$e^{-t}$`)는 `$` 를 유지하고, 단순 숫자·글자는 기존처럼 `$` 를 뗀다. */
export const answerTextForExplanation = (t: string): string => (/[\\^_]/.test(t) ? t : t.replace(/\$/g, ""));

/** 새로 생성한 항목은 저장 단계에서부터 수식이 구분자 안에 있어야 한다(화면 변환에 기대지 않는다). 막는 종류: TeX 명령·`^{`·`_{`·유니코드 첨자 뒤 캐럿. */
const BLOCKING = new Set(["tex-command", "tex-double-backslash", "tex-script", "unicode-script-caret", "unicode-escape"]);
export function unwrappedMathReasons(label: string, text: string | undefined | null): string[] {
  if (!text) return [];
  const kinds = [...new Set(findUnwrappedMath(text).filter((h) => BLOCKING.has(h.kind)).map((h) => h.kind))];
  return kinds.map((k) => `unwrapped_math:${label}:${k}`);
}

type Pack = { stem?: string; options?: { text: string }[]; explanation_en?: string; parts?: { label?: string; prompt?: string; model_answer?: string }[] };
/** 생성 게이트용: 학생이 읽는 필드(본문·선지·해설·FRQ 문제·모범 답안)의 구분자 밖 원문 수식. */
export function gateMathWrapping(p: Pack): string[] {
  return [
    ...unwrappedMathReasons("stem", p.stem),
    ...(p.options ?? []).flatMap((o, i) => unwrappedMathReasons(`option${i}`, o.text)),
    ...unwrappedMathReasons("explanation", p.explanation_en),
    ...(p.parts ?? []).flatMap((x) => [...unwrappedMathReasons(`part_${x.label ?? "?"}_prompt`, x.prompt), ...unwrappedMathReasons(`part_${x.label ?? "?"}_answer`, x.model_answer)]),
  ];
}
