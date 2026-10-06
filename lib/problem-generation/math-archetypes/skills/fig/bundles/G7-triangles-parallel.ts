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

export const BUNDLE: LArch[] = [...latAngleSum, ...rttHyp, ...rttLeg, ...latIso, ...rttTrig, ...rttSpecial, ...rttComp, ...rttElev];
