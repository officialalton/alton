import type { Archetype } from "./types";
import { EE_ARCHETYPES } from "./skills/equivalent-expressions";
import { RR_ARCHETYPES } from "./skills/ratios-rates-units";
import { LE_ARCHETYPES } from "./skills/linear-equations-one-var";
import { PR_ARCHETYPES } from "./skills/probability";
import { NES_ARCHETYPES, NES_EM_ARCHETYPES } from "./skills/nonlinear-equations-systems";
import { NF_ARCHETYPES, NF_EM_ARCHETYPES } from "./skills/nonlinear-functions";
import { EE_EM_ARCHETYPES } from "./skills/ee-em";
import { LAT_HARD } from "./skills/lines-angles-triangles";
import { RT_HARD } from "./skills/right-triangles-trigonometry";
import { OVD_HARD } from "./skills/one-variable-data";
import { TVD_HARD } from "./skills/two-variable-data";
import { IME_HARD } from "./skills/inference-margin-error";
// --- B 담당(일차 계열) ---
import { LI_ARCHETYPES } from "./skills/linear-inequalities";
import { LF_ARCHETYPES } from "./skills/linear-functions";
import { L2_ARCHETYPES } from "./skills/linear-equations-two-var";
import { SL_ARCHETYPES } from "./skills/systems-linear";
import { LF_EM_ARCHETYPES } from "./skills/linear-functions.em";
import { L2_EM_ARCHETYPES } from "./skills/linear-equations-two-var.em";
import { SL_EM_ARCHETYPES } from "./skills/systems-linear.em";
import { LI_EM_ARCHETYPES } from "./skills/linear-inequalities.em";
import { LE_EM_ARCHETYPES } from "./skills/linear-equations-one-var.em";

/** hard 원형(세부 패턴 × 연산자). */
export const ARCHETYPES: Archetype[] = [
  ...EE_ARCHETYPES, ...RR_ARCHETYPES, ...LE_ARCHETYPES, ...PR_ARCHETYPES, ...NES_ARCHETYPES, ...NF_ARCHETYPES,
  // --- B 담당(일차 계열) ---
  ...LI_ARCHETYPES, ...LF_ARCHETYPES, ...L2_ARCHETYPES, ...SL_ARCHETYPES,
  // --- D 담당(기하·자료 계열) ---
  ...LAT_HARD, ...RT_HARD, ...OVD_HARD, ...TVD_HARD, ...IME_HARD,
];
/** easy/medium 원형(문장 틀 = 유사문항 그룹). Archetype.difficulty 가 easy|medium 이다. */
export const ARCHETYPES_EM: Archetype[] = [
  ...NES_EM_ARCHETYPES, ...NF_EM_ARCHETYPES, ...EE_EM_ARCHETYPES,
  // --- B 담당(일차 계열) ---
  ...LI_EM_ARCHETYPES, ...LE_EM_ARCHETYPES, ...LF_EM_ARCHETYPES, ...L2_EM_ARCHETYPES, ...SL_EM_ARCHETYPES,
];
/** B 담당 코드가 쓰는 별칭. */
export const EM_ARCHETYPES = ARCHETYPES_EM;
export const archetypeById = (id: string) => ARCHETYPES.find((a) => a.id === id) ?? ARCHETYPES_EM.find((a) => a.id === id);
