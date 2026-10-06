// 묶음 G8 — 다각형·원·합성도형(PG·CI·CM 23조합). 조합 파일(items/<조합ID>.ts)의 ITEM 을 여기에 펼친다.
import type { LArch } from "../../../levels-d";
import { ITEM as avRectPg } from "../items/area_volume.rectangle_area.PG.P";
import { ITEM as avRectPgC } from "../items/area_volume.rectangle_area.PG.C";
import { ITEM as avTriPg } from "../items/area_volume.triangle_area.PG.P";
import { ITEM as latPolyPg } from "../items/lines_angles_triangles.polygon_interior_angle.PG.P";
import { ITEM as eePolyPg } from "../items/equivalent_expressions.polynomial_distribution.PG.P";
import { ITEM as lePg } from "../items/linear_equations_one_var.literal_rearrange.PG.P";
import { ITEM as avTrapPg } from "../items/area_volume.trapezoid_parallelogram_area.PG.P";

export const BUNDLE: LArch[] = [...avRectPg, ...avRectPgC, ...avTriPg, ...avTrapPg, ...latPolyPg, ...eePolyPg, ...lePg];
