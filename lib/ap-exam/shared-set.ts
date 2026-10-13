// 공유 자료 세트(AP Statistics 13–15·31–33 등) 감지(순수). 저장 데이터는 바꾸지 않고, 같은 섹션에서 연속하며 자료(passage)가 같은 문항을 한 묶음으로 본다.
// 화면 번호는 섹션 내 순서(index+1)와 같다. 묶음은 2문항 이상이고 자료가 비어 있지 않을 때만 인정한다.
const norm = (t: string | null | undefined) => (t ?? "").replace(/\s+/g, " ").trim();

export type SharedSetRange = { start: number; end: number; key: string };

/** items[index] 가 속한 공유 세트의 표시 번호 범위(1-based, 양끝 포함). 세트가 아니면 null. */
export function sharedSetRange(items: { passage: string | null }[], index: number): SharedSetRange | null {
  const p = norm(items[index]?.passage);
  if (!p) return null;
  let s = index, e = index;
  while (s > 0 && norm(items[s - 1].passage) === p) s--;
  while (e < items.length - 1 && norm(items[e + 1].passage) === p) e++;
  if (e === s) return null;
  return { start: s + 1, end: e + 1, key: `${s + 1}-${e + 1}` };
}

export const sharedSetHeading = (r: SharedSetRange) => `Questions ${r.start}–${r.end} refer to the following information.`;
