// 묶음 G8 — 다각형·원·합성도형(PG·CI·CM 23조합). 조합 파일(items/<조합ID>.ts)의 ITEM 을 여기에 펼친다.
import type { LArch } from "../../../levels-d";
import { ITEM as avRectPg } from "../items/area_volume.rectangle_area.PG.P";
import { ITEM as avRectPgC } from "../items/area_volume.rectangle_area.PG.C";
import { ITEM as avTriPg } from "../items/area_volume.triangle_area.PG.P";
import { ITEM as latPolyPg } from "../items/lines_angles_triangles.polygon_interior_angle.PG.P";
import { ITEM as eePolyPg } from "../items/equivalent_expressions.polynomial_distribution.PG.P";
import { ITEM as lePg } from "../items/linear_equations_one_var.literal_rearrange.PG.P";
import { ITEM as ciCircR } from "../items/circles.circumference_radius.CI.P";
import { ITEM as ciCircD } from "../items/circles.circumference_diameter.CI.P";
import { ITEM as ciArc } from "../items/circles.arc_length.CI.P";
import { ITEM as ciSec } from "../items/circles.sector_area.CI.P";
import { ITEM as ciCfi } from "../items/circles.central_from_inscribed.CI.P";
import { ITEM as ciIfc } from "../items/circles.inscribed_from_central.CI.P";
import { ITEM as ciTan } from "../items/circles.tangent_radius_perpendicular.CI.P";
import { ITEM as ciChord } from "../items/circles.chord_length.CI.P";
import { ITEM as ciCfiC } from "../items/circles.central_from_inscribed.CI.C";
import { ITEM as avRectCm } from "../items/area_volume.rectangle_area.CM.P";
import { ITEM as ciCircCm } from "../items/circles.circumference_radius.CM.P";
import { ITEM as ciArcCm } from "../items/circles.arc_length.CM.P";
import { ITEM as ciSecCm } from "../items/circles.sector_area.CM.P";
import { ITEM as avShadedCm } from "../items/area_volume.shaded_region_area.CM.P";
import { ITEM as avShadedCmC } from "../items/area_volume.shaded_region_area.CM.C";
import { ITEM as ciInscCm } from "../items/circles.inscribed_circumscribed_polygon.CM.P";
import { ITEM as avTrapPg } from "../items/area_volume.trapezoid_parallelogram_area.PG.P";

export const BUNDLE: LArch[] = [...avRectPg, ...avRectPgC, ...avTriPg, ...avTrapPg, ...latPolyPg, ...eePolyPg, ...lePg, ...ciCircR, ...ciCircD, ...ciArc, ...ciSec, ...ciCfi, ...ciIfc, ...ciTan, ...ciChord, ...ciCfiC, ...avRectCm, ...ciCircCm, ...ciArcCm, ...ciSecCm, ...avShadedCm, ...avShadedCmC, ...ciInscCm];
