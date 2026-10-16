// AP 재고 텍스트의 "수식 구분자 밖 원문 수식" 점검(순수 함수, DB·네트워크 없음).
// 학생·관리자 화면은 `$...$`·`$$...$$`·`\(...\)`·`\[...\]` 안의 수식만 KaTeX 로 그린다. 그 밖의 `\frac`·`\int`·`\left`·`^{`·"∫₀^2" 는 글자 그대로 보인다.
// 두 단계로 센다: (1) stored = 저장된 원문 그대로, (2) display = 화면 변환(autoMathExplanation)을 거친 뒤. 생성 게이트는 (1) 을 막고, 화면 점검은 (2) 를 막는다.
import { autoMathExplanation } from "./explanation-math";

export type TexHit = { kind: string; token: string; context: string };

const MATH_SEG = /\\\$|\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/g;
/** 수식 구분자 안과 이스케이프된 달러를 걷어낸 "평문"만 남긴다(통화 `\$5` 는 글자). */
export function outsideMath(text: string): string {
  // 코드 블록(```)·한 줄 코드(`x`)는 렌더러(render-learning-content)가 코드로 그리므로 `i <= 7` 같은 코드 연산자는 원문 수식이 아니다.
  return text.replace(/```[\s\S]*?```|`[^`\n]+`/g, " ").replace(MATH_SEG, (m) => (m === "\\$" ? "\u00a4" : " "));
}

const DETECTORS: { kind: string; re: RegExp }[] = [
  // 백슬래시 명령 전반(\frac, \int, \left, \sin, \pi …). 줄바꿈 이스케이프(\n)나 단독 역슬래시는 제외.
  { kind: "tex-command", re: /\\(?:[A-Za-z]{2,}|[,;!:{}|])/ },
  { kind: "tex-double-backslash", re: /\\\\/ },
  { kind: "tex-script", re: /[\^_]\{/ },
  { kind: "plain-exponent", re: /(?:^|[^A-Za-z0-9_])[A-Za-z0-9)\]][ ]?\^[ ]?[({A-Za-z0-9−-]/ },
  // 유니코드 아래첨자·∫ 뒤의 캐럿("∫₀^2.746"): 글자 그대로 ^ 가 보인다.
  { kind: "unicode-script-caret", re: /[₀-₉∀-⋿][₀-₉]?\^/ },
  { kind: "ascii-inequality", re: /\S[ ]?(?:<=|>=)[ ]?\S/ },
  { kind: "unicode-escape", re: /\\u[0-9a-fA-F]{4}/ },
  { kind: "unrendered-dollar-math", re: /(?:^|[^\\])\$[^$\n]{1,120}[^\\ $]\$/ },
];

/** 수식 구분자 밖(평문)에 남은 원문 수식 흔적. */
export function findUnwrappedMath(text: string): TexHit[] {
  const plain = outsideMath(text);
  const hits: TexHit[] = [];
  for (const d of DETECTORS) {
    const m = d.re.exec(plain);
    if (!m) continue;
    hits.push({ kind: d.kind, token: m[0].trim(), context: plain.slice(Math.max(0, m.index - 25), m.index + m[0].length + 25).replace(/\s+/g, " ") });
  }
  return hits;
}

/** 화면 변환(자동 수식 입히기)을 거친 뒤에도 남는 흔적 = 학생·관리자가 실제로 보는 원문. */
export function findUnwrappedAfterDisplay(text: string): TexHit[] {
  return findUnwrappedMath(autoMathExplanation(text));
}

const SKIP_KEYS = new Set(["verification_code", "design_note", "label", "response_mode", "skill_codes", "skill_primary", "keyword_codes", "kind", "row_id", "numeric_tolerance", "archetype", "partial", "calculator_part", "value"]);
export type TextField = { path: string; norm: string; text: string };

/** 문항 payload 의 모든 문자열(자료 JSON 문자열 포함)과 경로. norm 은 배열 인덱스를 [] 로 접은 필드 이름. */
export function collectTexts(payload: unknown, base = ""): TextField[] {
  const out: TextField[] = [];
  const walk = (v: unknown, path: string) => {
    if (typeof v === "string") {
      const t = v.trim();
      if ((t.startsWith("{") || t.startsWith("[")) && path.endsWith("stimulus")) { try { walk(JSON.parse(t), path); return; } catch { /* 일반 문자열 */ } }
      if (v) out.push({ path, norm: path.replace(/\[\d+\]/g, "[]"), text: v });
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v as Record<string, unknown>)) { if (!SKIP_KEYS.has(k)) walk(x, path ? `${path}.${k}` : k); }
  };
  walk(payload, base);
  return out;
}

export type TextVerdict = { path: string; norm: string; stored: TexHit[]; display: TexHit[] };
/** 문항 하나: 저장 원문 / 화면 변환 뒤 흔적이 있는 필드만 돌려준다. */
export function auditPayload(payload: unknown): TextVerdict[] {
  const rows: TextVerdict[] = [];
  for (const f of collectTexts(payload)) {
    const stored = findUnwrappedMath(f.text);
    if (!stored.length) continue;
    rows.push({ path: f.path, norm: f.norm, stored, display: findUnwrappedAfterDisplay(f.text) });
  }
  return rows;
}
