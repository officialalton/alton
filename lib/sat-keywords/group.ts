// 키워드 선택 UI 공용 그룹핑: domain_code(없으면 skill_code 로 추론)별로 묶고, 도메인이 없는 구 키워드는 "Other" 로 모은다.
import { SAT_DOMAINS, SKILL_CODES } from "../problem-taxonomy";
import { SAT_KEYWORD_BY_SKILL, satDomainDisplayName } from "./taxonomy";

export type KeywordLike = { id: string; label: string; domainCode?: string | null; skillCode?: string | null };
export type KeywordGroup<T extends KeywordLike> = { key: string; label: string; items: T[] };

export const OTHER_GROUP_KEY = "__other";
const DOMAIN_ORDER = new Map(SAT_DOMAINS.map((d, i) => [d.code as string, i]));
const SKILL_ORDER = new Map(SKILL_CODES.map((s, i) => [s.code, i]));

export function keywordDomainCode(k: KeywordLike): string | null {
  const direct = k.domainCode && DOMAIN_ORDER.has(k.domainCode) ? k.domainCode : null;
  return direct ?? (k.skillCode ? SAT_KEYWORD_BY_SKILL.get(k.skillCode)?.domainCode ?? null : null);
}

/** 도메인 순서(College Board 순)로 그룹을 돌려준다. 그룹 안은 스킬 사전 순서, 그 외는 입력 순서. 값·id 는 건드리지 않는다. */
export function groupKeywordsByDomain<T extends KeywordLike>(items: T[], otherLabel = "Other"): KeywordGroup<T>[] {
  const buckets = new Map<string, T[]>();
  for (const k of items) {
    const key = keywordDomainCode(k) ?? OTHER_GROUP_KEY;
    const list = buckets.get(key);
    if (list) list.push(k);
    else buckets.set(key, [k]);
  }
  const rank = (key: string) => (key === OTHER_GROUP_KEY ? 1e6 : DOMAIN_ORDER.get(key) ?? 1e5);
  return [...buckets.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]))
    .map(([key, list]) => ({
      key,
      label: key === OTHER_GROUP_KEY ? otherLabel : satDomainDisplayName(key),
      items: key === OTHER_GROUP_KEY
        ? list
        : [...list].sort((a, b) => (SKILL_ORDER.get(a.skillCode ?? "") ?? 1e3) - (SKILL_ORDER.get(b.skillCode ?? "") ?? 1e3)),
    }));
}

/** SAT 도메인이 하나도 없으면(구 과목) 그룹 헤더 없이 기존 평면 목록을 유지한다. */
export const hasDomainGroups = (groups: KeywordGroup<KeywordLike>[]) => groups.some((g) => g.key !== OTHER_GROUP_KEY);
