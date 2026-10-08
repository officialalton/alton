"use client";

import type { ReactNode } from "react";
import { groupKeywordsByDomain, hasDomainGroups, keywordDisplayLabel, type KeywordLike } from "@/lib/sat-keywords/group";

/** <select> 안의 옵션을 도메인별 <optgroup> 으로 묶는다. SAT 도메인이 없으면 평면 <option> 그대로. */
export function GroupedKeywordOptions<T extends KeywordLike>({ items, otherLabel = "Other", optionLabel }: { items: T[]; otherLabel?: string; optionLabel?: (k: T) => string }) {
  const groups = groupKeywordsByDomain(items, otherLabel);
  const text = optionLabel ?? ((k: T) => keywordDisplayLabel(k));
  if (!hasDomainGroups(groups)) return <>{items.map((k) => <option key={k.id} value={k.id}>{text(k)}</option>)}</>;
  return (
    <>
      {groups.map((g) => (
        <optgroup key={g.key} label={g.label}>
          {g.items.map((k) => <option key={k.id} value={k.id}>{text(k)}</option>)}
        </optgroup>
      ))}
    </>
  );
}

/** 칩/행 목록을 도메인 제목 아래 접이식(details) 섹션으로 묶는다. 선택 수를 제목에 보여 주고 기본은 펼침. SAT 도메인이 없으면 평면 그대로. */
export function GroupedKeywordList<T extends KeywordLike>({
  items, otherLabel = "Other", selectedIds, renderItem, wrapClassName = "flex flex-wrap gap-1.5", flatWrap,
}: {
  items: T[]; otherLabel?: string; selectedIds?: ReadonlySet<string> | string[]; renderItem: (k: T) => ReactNode; wrapClassName?: string; flatWrap?: (children: ReactNode) => ReactNode;
}) {
  const groups = groupKeywordsByDomain(items, otherLabel);
  const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds ?? []);
  const body = (list: T[]) => (flatWrap ? flatWrap(list.map(renderItem)) : <div className={wrapClassName}>{list.map(renderItem)}</div>);
  if (!hasDomainGroups(groups)) return <>{body(items)}</>;
  return (
    <div className="flex flex-col gap-2">
      {groups.map((g) => {
        const n = g.items.filter((k) => selected.has(k.id)).length;
        return (
          <details key={g.key} open className="group" data-testid={`keyword-group-${g.key}`}>
            <summary className="cursor-pointer select-none text-[11px] font-bold text-grey-500 uppercase tracking-wide mb-1 focus-visible:outline focus-visible:outline-2 rounded">
              {g.label}
              {n > 0 && <span className="ml-1.5 normal-case text-ink">({n})</span>}
            </summary>
            {body(g.items)}
          </details>
        );
      })}
    </div>
  );
}
