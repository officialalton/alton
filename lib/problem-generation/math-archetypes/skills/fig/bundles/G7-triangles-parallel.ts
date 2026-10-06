// 묶음 G7 — 삼각형·평행선·횡단선(TR·PT 21조합). 조합 파일(items/<조합ID>.ts)의 ITEM 을 여기에 펼친다.
import type { LArch } from "../../../levels-d";
import { ITEM as latAngleSum } from "../items/lines_angles_triangles.triangle_angle_sum.TR.P";
import { ITEM as rttHyp } from "../items/right_triangles_trigonometry.pythagorean_hypotenuse.TR.P";
import { ITEM as rttLeg } from "../items/right_triangles_trigonometry.pythagorean_leg.TR.P";
import { ITEM as latIso } from "../items/lines_angles_triangles.isosceles_base_angle.TR.P";
import { ITEM as rttTrig } from "../items/right_triangles_trigonometry.trig_ratio.TR.P";
import { ITEM as rttSpecial } from "../items/right_triangles_trigonometry.special_right_triangles.TR.P";
import { ITEM as rttComp } from "../items/right_triangles_trigonometry.sin_cos_complementary.TR.P";
import { ITEM as rttElev } from "../items/right_triangles_trigonometry.trig_application_elevation.TR.P";
import { ITEM as latSim } from "../items/lines_angles_triangles.similar_triangles.TR.P";
import { ITEM as latCong } from "../items/lines_angles_triangles.congruent_triangles.TR.P";
import { ITEM as latTi } from "../items/lines_angles_triangles.triangle_inequality.TR.P";
import { ITEM as avTriArea } from "../items/area_volume.triangle_area.TR.P";
import { ITEM as latExt } from "../items/lines_angles_triangles.exterior_angle.TR.P";
import { ITEM as latAsC } from "../items/lines_angles_triangles.triangle_angle_sum.TR.C";
import { ITEM as latIsoC } from "../items/lines_angles_triangles.isosceles_base_angle.TR.C";
import { ITEM as latExtPt } from "../items/lines_angles_triangles.exterior_angle.PT.P";
import { ITEM as latAsPt } from "../items/lines_angles_triangles.triangle_angle_sum.PT.P";
import { ITEM as latVsTr } from "../items/lines_angles_triangles.vertical_supplementary_angles.TR.P";
import { ITEM as latPtPar } from "../items/lines_angles_triangles.parallel_lines_transversal_angles.PT.P";
import { ITEM as latPtVert } from "../items/lines_angles_triangles.vertical_supplementary_angles.PT.P";

export const BUNDLE: LArch[] = [...latSim, ...latPtVert, ...latPtPar, ...avTriArea, ...latExt, ...latVsTr, ...latAsC, ...latIsoC, ...latExtPt, ...latAsPt, ...latTi, ...latCong, ...latAngleSum, ...rttHyp, ...rttLeg, ...latIso, ...rttTrig, ...rttSpecial, ...rttComp, ...rttElev];
