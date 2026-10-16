// 빈칸 이음새 검사(순수): 빈칸 뒤에 이어지는 지문이 선택지 끝 단어와 겹치거나(단어 중복), 빈칸 뒤 리터럴 구두점이 선택지 끝 구두점과 겹치는지(이중 쉼표) 찾는다.
// 2026-10-13 외부 감사 근본 원인: 생성기가 빈칸 뒤 원문을 그대로 두고 선택지에도 그 단어를 넣어 "완성문이 성립하지 않는" 문항이 게시됐다(RW 26건).
// 임포트·관리자 저장 게이트(draftBankGateError)와 감사 계획기(lib/audit-fix/plan.ts)가 같은 함수를 쓴다.

/** 빈칸 뒤 이어지는 글과 선택지가 겹치는지(빈칸 뒤 단어 중복·이중 쉼표). 문제 없으면 []. */
export function blankJunctionIssues(passage: string, options: string[]): string[] {
  const m = passage.match(/_{3,}/);
  if (!m || m.index === undefined) return [];
  const after = passage.slice(m.index + m[0].length);
  const tok = (t: string) => t.toLowerCase().split(/\s+/).map((w) => w.replace(/[^a-z0-9']/g, "")).filter(Boolean);
  const afterTok = tok(after).slice(0, 6);
  const afterPunct = after.replace(/^\s+/, "")[0] ?? "";
  const out: string[] = [];
  options.forEach((o, i) => {
    const t = o.trim(); const ot = tok(t);
    for (let k = Math.min(6, ot.length, afterTok.length); k >= 1; k--) {
      const tail = ot.slice(-k).join(" "); const head = afterTok.slice(0, k).join(" ");
      if (tail === head && !(k === 1 && head.length < 2)) { out.push(`option ${i + 1} ends with "${tail}" which the passage repeats right after the blank`); break; }
    }
    if (/[,;:]$/.test(t) && afterPunct && afterPunct === t[t.length - 1]) out.push(`option ${i + 1} ends with "${t[t.length - 1]}" and the passage repeats it after the blank`);
  });
  return out;
}
