// 담당 A 원형 모음(개발·스윕·문서 생성용). 최종 registry 에는 skill 단위로 한 줄씩만 등록한다.
import type { Archetype } from "../types";
import { NES_ARCHETYPES, NES_EM_ARCHETYPES } from "./nonlinear-equations-systems";
import { NF_ARCHETYPES, NF_EM_ARCHETYPES } from "./nonlinear-functions";
import { EE_EM_ARCHETYPES } from "./ee-em";

export const A_HARD_ARCHETYPES: Archetype[] = [...NES_ARCHETYPES, ...NF_ARCHETYPES];
export const A_EM_ARCHETYPES: Archetype[] = [...NES_EM_ARCHETYPES, ...NF_EM_ARCHETYPES, ...EE_EM_ARCHETYPES];
export const A_ARCHETYPES: Archetype[] = [...A_HARD_ARCHETYPES, ...A_EM_ARCHETYPES];
