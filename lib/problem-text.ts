// 객관식 지문 정리 — 지문 끝에 붙은 "A) … D) …" 선택지 줄을 뗀다.
//
// 2026-09-14 UAT: AI 가 만든 객관식 지문 끝에 선택지 네 줄이 그대로 들어 있어, 화면의 클릭용
// 선택지와 겹쳐 두 번 보였다. 선택지는 options 에만 둔다. 이미 저장된 문제도 화면에서 같은
// 규칙으로 정리한다(내용은 바꾸지 않는다 — 보여줄 때만).
//
// 지문 **끝**에 있는 연속된 선택지 줄만 뗀다. 본문 중간의 "A)" 같은 표기는 건드리지 않는다.
// 선택지 줄 판정: `A)`, `(A)`, `A.`, `①` 류로 시작하고, options 가 주어지면 그 내용과 맞아야 한다.

const LABEL_RE = /^\s*(?:\(?([A-Ea-e])[).]|[①②③④⑤])\s*(.*)$/;

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * 2026-09-15 — AI가 지시를 어기고 선택지 문자열 안에 "B) …", "(D) …" 같은 자기 라벨을
 * 그대로 남길 때가 있다. 화면은 앞에 A)~D)를 따로 붙이므로 그대로 두면 "B)  B) …"처럼
 * 겹쳐 보인다. 각 선택지 맨 앞의 라벨만 떼고 내용은 그대로 둔다(라벨이 없으면 그대로).
 */
export function stripOptionSelfLabels(options: string[]): string[] {
  return options.map((o) => o.replace(/^\s*(?:\(?[A-Da-d][).]|[①②③④])\s*/, "").trim());
}

export function stripInlineOptions(passage: string | null | undefined, options?: string[] | null): string {
  if (!passage) return "";
  const lines = passage.replace(/\r\n/g, "\n").split("\n");
  const normalizedOptions = (options ?? []).map(normalize);

  let end = lines.length;
  // 끝의 빈 줄은 건너뛴다.
  while (end > 0 && lines[end - 1].trim() === "") end -= 1;

  let cut = end;
  let matched = 0;
  for (let i = end - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (line.trim() === "") {
      // 선택지 묶음 안의 빈 줄은 허용하되, 묶음 시작 전 빈 줄에서 멈춘다.
      if (matched > 0) continue;
      break;
    }
    const m = LABEL_RE.exec(line);
    if (!m) break;
    const body = normalize(m[2] ?? "");
    if (normalizedOptions.length > 0 && !normalizedOptions.includes(body)) break;
    matched += 1;
    cut = i;
  }

  // 선택지가 주어졌으면 그 개수(보통 4)만큼 맞아야 뗀다. 없으면 2줄 이상일 때만.
  const need = normalizedOptions.length > 0 ? Math.min(normalizedOptions.length, 2) : 2;
  if (matched < need) return passage.trim();
  return lines.slice(0, cut).join("\n").trim();
}
