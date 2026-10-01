import type { Archetype } from "./types";
import { EE_ARCHETYPES } from "./skills/equivalent-expressions";
import { RR_ARCHETYPES } from "./skills/ratios-rates-units";
import { LE_ARCHETYPES } from "./skills/linear-equations-one-var";
import { PR_ARCHETYPES } from "./skills/probability";
import { LAT_HARD } from "./skills/lines-angles-triangles";
import { RT_HARD } from "./skills/right-triangles-trigonometry";
import { OVD_HARD } from "./skills/one-variable-data";

export const ARCHETYPES: Archetype[] = [...EE_ARCHETYPES, ...RR_ARCHETYPES, ...LE_ARCHETYPES, ...PR_ARCHETYPES, ...LAT_HARD, ...RT_HARD, ...OVD_HARD];
export const archetypeById = (id: string) => ARCHETYPES.find((a) => a.id === id);
