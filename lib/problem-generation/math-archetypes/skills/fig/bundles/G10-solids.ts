// 묶음 G10 — 입체도형(SO 8조합). 조합 파일(items/<조합ID>.ts)의 ITEM 을 여기에 펼친다.
import type { LArch } from "../../../levels-d";
import { ITEM as avPrismVol } from "../items/area_volume.prism_volume.SO.P";
import { ITEM as avPrismMissC } from "../items/area_volume.prism_missing_dimension.SO.C";
import { ITEM as avCylR } from "../items/area_volume.cylinder_volume_radius.SO.P";
import { ITEM as avCylD } from "../items/area_volume.cylinder_volume_diameter.SO.P";
import { ITEM as avPrismMiss } from "../items/area_volume.prism_missing_dimension.SO.P";

export const BUNDLE: LArch[] = [...avPrismVol, ...avPrismMiss, ...avPrismMissC, ...avCylR, ...avCylD];
