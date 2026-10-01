// 묶음 T6-inequality-system-tables — linear_inequalities·systems_linear 4항목. 조합 파일(items/<조합ID>.ts)의 ITEM 을 여기에 펼친다(이 묶음 담당 에이전트만 고친다).
import type { LArch } from "../../../levels-d";
import { ITEM as liPoint } from "../items/linear_inequalities.point_in_solution.TB.P";
import { ITEM as liVerify } from "../items/linear_inequalities.table_verification.TB.P";
import { ITEM as slSubst } from "../items/systems_linear.substitution_solve.TB.P";
import { ITEM as slWord } from "../items/systems_linear.word_system.TB.P";

export const BUNDLE: LArch[] = [...liPoint, ...liVerify, ...slSubst, ...slWord];
