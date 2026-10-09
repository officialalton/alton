// AP 커리큘럼 시드 → DB 행 계획(순수 함수; IO 없음). scripts/ap-curriculum/seed.ts 가 사용한다.
import { contentKey } from "./validate";
import type { ApCurriculumFile } from "./types";

export type PlannedUnit = { code: string; position: number; title: string; officialClassPeriods: string | null; suggestedLessons: number };
export type PlannedKeyword = {
  contentCode: string;
  contentKey: string;
  level: 1 | 2;
  label: string;
  unitCode: string;
  parentCode: string | null;
  kind: string | null;
  skillCodes: string[];
  requiresCodes: string[];
  estLessons: number;
  sortOrder: number;
  scope: string;
};

export const unitDisplayName = (code: string, title: string) => `Unit ${code}: ${title}`;

export function buildPlan(f: ApCurriculumFile) {
  const units: PlannedUnit[] = [];
  const keywords: PlannedKeyword[] = [];
  let sort = 0;
  f.units.forEach((u, ui) => {
    let unitLessons = 0;
    u.topics.forEach((t) => {
      unitLessons += t.estLessons;
      keywords.push({
        contentCode: t.code,
        contentKey: contentKey(f.subject.family, t.code),
        level: 1,
        label: t.title,
        unitCode: u.code,
        parentCode: null,
        kind: null,
        skillCodes: t.skills,
        requiresCodes: t.requires,
        estLessons: t.estLessons,
        sortOrder: ++sort,
        scope: t.scope,
      });
      t.subKeywords.forEach((k) =>
        keywords.push({
          contentCode: k.code,
          contentKey: contentKey(f.subject.family, k.code),
          level: 2,
          label: k.label,
          unitCode: u.code,
          parentCode: t.code,
          kind: k.kind,
          skillCodes: k.skills,
          requiresCodes: k.requires,
          estLessons: k.estLessons,
          sortOrder: ++sort,
          scope: t.scope,
        }),
      );
    });
    units.push({ code: u.code, position: ui + 1, title: u.title, officialClassPeriods: u.officialClassPeriods, suggestedLessons: Math.round(unitLessons * 10) / 10 });
  });
  return { units, keywords };
}

/** 기존 DB 행과 비교해 만들어야 할 코드 / 메타만 갱신할 코드를 가른다(관리자가 바꾼 이름은 건드리지 않는다). */
export function diffKeywords(planned: PlannedKeyword[], existingCodes: Set<string>) {
  const create = planned.filter((k) => !existingCodes.has(k.contentCode));
  const update = planned.filter((k) => existingCodes.has(k.contentCode));
  return { create, update };
}
