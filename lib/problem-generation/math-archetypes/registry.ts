import type { Archetype } from "./types";
import { EE_ARCHETYPES } from "./skills/equivalent-expressions";
import { RR_ARCHETYPES } from "./skills/ratios-rates-units";
import { LE_ARCHETYPES } from "./skills/linear-equations-one-var";
import { PR_ARCHETYPES } from "./skills/probability";
import { PCT_ARCHETYPES } from "./skills/percentages";
import { AV_ARCHETYPES } from "./skills/area-volume";
import { CI_ARCHETYPES } from "./skills/circles";

export const ARCHETYPES: Archetype[] = [...EE_ARCHETYPES, ...RR_ARCHETYPES, ...LE_ARCHETYPES, ...PR_ARCHETYPES,
  ...PCT_ARCHETYPES, ...AV_ARCHETYPES, ...CI_ARCHETYPES];
export const archetypeById = (id: string) => ARCHETYPES.find((a) => a.id === id);
