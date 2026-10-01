// C 담당 easy/medium 원형(lite) 목록 — 퍼센트·넓이/부피·원·비/비율·확률.
import type { LiteArchetype } from "./c-lite";
import { PCT_LITE } from "./skills/percentages";
import { AV_LITE } from "./skills/area-volume";
import { CI_LITE } from "./skills/circles";

export const LITE_C_ARCHETYPES: LiteArchetype[] = [...PCT_LITE, ...AV_LITE, ...CI_LITE];
