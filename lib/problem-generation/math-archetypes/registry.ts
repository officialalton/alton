import type { Archetype } from "./types";
import { EE_ARCHETYPES } from "./skills/equivalent-expressions";
import { RR_ARCHETYPES } from "./skills/ratios-rates-units";
import { LE_ARCHETYPES } from "./skills/linear-equations-one-var";
import { PR_ARCHETYPES } from "./skills/probability";
// --- B 담당(일차 계열) ---
import { LI_ARCHETYPES } from "./skills/linear-inequalities";
import { LF_ARCHETYPES } from "./skills/linear-functions";
import { L2_ARCHETYPES } from "./skills/linear-equations-two-var";
import { LF_EM_ARCHETYPES } from "./skills/linear-functions.em";
import { LI_EM_ARCHETYPES } from "./skills/linear-inequalities.em";
import { LE_EM_ARCHETYPES } from "./skills/linear-equations-one-var.em";

export const ARCHETYPES: Archetype[] = [
  ...EE_ARCHETYPES, ...RR_ARCHETYPES, ...LE_ARCHETYPES, ...PR_ARCHETYPES,
  // --- B 담당(일차 계열) ---
  ...LI_ARCHETYPES,
  ...LF_ARCHETYPES,
  ...L2_ARCHETYPES,
];
/** easy/medium 원형(문장 틀 = 유사문항 그룹). hard 원형 ARCHETYPES 와 분리해 둔다(id 규칙·연산자 4개 규칙이 다름). */
export const EM_ARCHETYPES: Archetype[] = [
  // --- B 담당(일차 계열) ---
  ...LI_EM_ARCHETYPES,
  ...LE_EM_ARCHETYPES,
  ...LF_EM_ARCHETYPES,
];
export const archetypeById = (id: string) => [...ARCHETYPES, ...EM_ARCHETYPES].find((a) => a.id === id);
