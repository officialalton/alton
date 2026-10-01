import type { Archetype } from "./types";
import { EE_ARCHETYPES } from "./skills/equivalent-expressions";
import { RR_ARCHETYPES } from "./skills/ratios-rates-units";
import { LE_ARCHETYPES } from "./skills/linear-equations-one-var";
import { PR_ARCHETYPES } from "./skills/probability";
import { NES_ARCHETYPES, NES_EM_ARCHETYPES } from "./skills/nonlinear-equations-systems";
import { NF_ARCHETYPES, NF_EM_ARCHETYPES } from "./skills/nonlinear-functions";
import { EE_EM_ARCHETYPES } from "./skills/ee-em";

/** hard 원형(세부 패턴 × 연산자). */
export const ARCHETYPES: Archetype[] = [...EE_ARCHETYPES, ...RR_ARCHETYPES, ...LE_ARCHETYPES, ...PR_ARCHETYPES, ...NES_ARCHETYPES, ...NF_ARCHETYPES];
/** easy/medium 원형(문장 틀 = 유사문항 그룹). Archetype.difficulty 가 easy|medium 이다. */
export const ARCHETYPES_EM: Archetype[] = [...NES_EM_ARCHETYPES, ...NF_EM_ARCHETYPES, ...EE_EM_ARCHETYPES];
export const archetypeById = (id: string) => ARCHETYPES.find((a) => a.id === id) ?? ARCHETYPES_EM.find((a) => a.id === id);
