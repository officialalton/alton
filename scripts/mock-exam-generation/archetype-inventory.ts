// 원형 재고표: skill × 난이도별 원형 수와 자료 조합(figureItem) 커버리지. DB·API 없음. 실행: npx tsx scripts/mock-exam-generation/archetype-inventory.ts
import { ARCHETYPES } from "../../lib/problem-generation/math-archetypes/registry";
import { D_ARCHETYPES } from "../../lib/problem-generation/math-archetypes/registry-d";
import { LITE_C_ARCHETYPES } from "../../lib/problem-generation/math-archetypes/lite-c";
import { levelOf, sprCapability } from "../../lib/problem-generation/math-archetypes/spr-capability";
import { FIGURE_ITEMS } from "../../lib/problem-generation/math-archetypes/figure-coverage-manifest";
const cell: Record<string, { arch: number; spr: number }> = {};
const add = (k: string, spr: boolean) => { const c = (cell[k] ??= { arch: 0, spr: 0 }); c.arch++; if (spr) c.spr++; };
for (const a of ARCHETYPES) add(`${a.skill}|${levelOf(a)}|hardset`, sprCapability(a).capable);
for (const a of D_ARCHETYPES) add(`${a.skill}|${levelOf(a)}|D`, sprCapability(a).capable);
for (const a of LITE_C_ARCHETYPES) for (const lv of a.levels) add(`${a.skill}|${lv}|lite`, false);
for (const k of Object.keys(cell).sort()) console.log(k, JSON.stringify(cell[k]));
const figs = new Set([...ARCHETYPES, ...D_ARCHETYPES].map((a) => a.figureItem).filter(Boolean));
console.log("manifest", FIGURE_ITEMS.length, "with archetype", FIGURE_ITEMS.filter((r) => figs.has(r.id)).length);
