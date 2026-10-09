// ab-select 출력 계획(순수 함수). 기본은 아무것도 쓰지 않는다. 게시본(docs/ap/ab-full-set-selection.md, data/ap/stock/ab-full-set-selection.json)은
// --write-published 를 명시했을 때만 덮어쓴다. --dry-run 은 어떤 쓰기 옵션과도 함께 쓸 수 없다(디스크·DB 무변경 보장).
export const PUBLISHED_MD = "docs/ap/ab-full-set-selection.md";
export const PUBLISHED_JSON = "data/ap/stock/ab-full-set-selection.json";
export type OutputPlan = { error?: string; writeReport?: string; writePublished: boolean };

export function planOutputs(argv: string[]): OutputPlan {
  const flag = (n: string) => argv.includes(n);
  const val = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const writePublished = flag("--write-published");
  const wr = val("--write-report"); if (flag("--write-report") && (!wr || wr.startsWith("--"))) return { error: "--write-report 는 경로가 필요하다", writePublished: false };
  if (flag("--dry-run") && (writePublished || wr)) return { error: "--dry-run 은 --write-report/--write-published 와 함께 쓸 수 없다(dry-run 은 아무것도 쓰지 않는다)", writePublished: false };
  if (wr && [PUBLISHED_MD, PUBLISHED_JSON].some((p) => wr.replace(/^\.\//, "") === p)) return { error: "게시본 경로는 --write-report 로 덮어쓸 수 없다(--write-published 사용)", writePublished: false };
  return { writeReport: wr, writePublished };
}
