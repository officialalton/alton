// 코드 답안 입력 키 처리(AP Computer Science A FRQ, 2026-10-13). 순수 함수 — 컴포넌트(CodeAnswerField)가 textarea 의 값·선택 범위를 넘기고 결과를 되돌려 받는다.
// 규칙: Tab = 들여쓰기(공백 4칸, 여러 줄 선택이면 줄마다), Shift+Tab = 내어쓰기, Enter = 이전 줄 들여쓰기 유지(줄이 `{` 로 끝나면 한 단계 더), Escape = 다음 Tab 이 포커스를 옮기게 한다(키보드 함정 방지, 접근성).
export const CODE_INDENT = "    ";
export type CodeEdit = { value: string; selStart: number; selEnd: number };
export type CodeKeyInput = { value: string; selStart: number; selEnd: number; key: string; shiftKey?: boolean; escapeArmed?: boolean };

const lineStart = (v: string, i: number) => v.lastIndexOf("\n", i - 1) + 1;

/** 편집이 필요하면 새 상태를, 브라우저 기본 동작에 맡기면 null 을 돌려준다. */
export function applyCodeKey(i: CodeKeyInput): CodeEdit | null {
  const { value, selStart, selEnd, key, shiftKey } = i;
  if (key === "Tab") {
    if (i.escapeArmed) return null; // Escape 를 눌렀다면 이번 Tab 은 포커스 이동
    const multi = value.slice(selStart, selEnd).includes("\n");
    if (!multi && !shiftKey) {
      return { value: value.slice(0, selStart) + CODE_INDENT + value.slice(selEnd), selStart: selStart + CODE_INDENT.length, selEnd: selStart + CODE_INDENT.length };
    }
    const from = lineStart(value, selStart);
    const endRef = selEnd > selStart && value[selEnd - 1] === "\n" ? selEnd - 1 : selEnd;
    const nl = value.indexOf("\n", endRef);
    const to = nl === -1 ? value.length : nl;
    const block = value.slice(from, to);
    const lines = block.split("\n");
    let delta = 0, firstDelta = 0;
    const out = lines.map((ln, idx) => {
      if (!shiftKey) { delta += CODE_INDENT.length; if (idx === 0) firstDelta = CODE_INDENT.length; return CODE_INDENT + ln; }
      const m = /^( {1,4}|\t)/.exec(ln);
      const cut = m ? m[0].length : 0;
      delta -= cut; if (idx === 0) firstDelta = -cut;
      return ln.slice(cut);
    });
    return { value: value.slice(0, from) + out.join("\n") + value.slice(to), selStart: Math.max(from, selStart + firstDelta), selEnd: Math.max(from, selEnd + delta) };
  }
  if (key === "Enter" && !shiftKey) {
    const from = lineStart(value, selStart);
    const current = value.slice(from, selStart);
    const indent = /^[ \t]*/.exec(current)![0];
    const extra = /\{\s*$/.test(current) ? CODE_INDENT : "";
    const ins = "\n" + indent + extra;
    return { value: value.slice(0, selStart) + ins + value.slice(selEnd), selStart: selStart + ins.length, selEnd: selStart + ins.length };
  }
  return null;
}

/** textarea 에 붙일 속성: 맞춤법·자동 고침·자동 대문자 끔, 줄 바꿈 없이 가로 스크롤. */
export const CODE_FIELD_ATTRS = { spellCheck: false, autoCapitalize: "off", autoCorrect: "off", autoComplete: "off", wrap: "off" } as const;
export const CODE_FIELD_HINT = "Code editor: Tab indents. Press Escape, then Tab, to move to the next control.";
