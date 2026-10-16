// 묶음 T7-statement-claims — inference·evaluating_statistical_claims 7항목. 조합 파일(items/<조합ID>.ts)의 ITEM 을 여기에 펼친다(이 묶음 담당 에이전트만 고친다).
import type { LArch } from "../../../levels-d";
import { ITEM as IME_POP } from "../items/inference_margin_error.population_estimate.ST.P";
import { ITEM as IME_INT } from "../items/inference_margin_error.margin_interval.ST.P";
import { ITEM as IME_SSE } from "../items/inference_margin_error.sample_size_effect.ST.P";
import { ITEM as ESC_SG } from "../items/evaluating_statistical_claims.sampling_generalization.ST.P";
import { ITEM as ESC_SGT } from "../items/evaluating_statistical_claims.sampling_generalization.TB.P";
import { ITEM as ESC_CA } from "../items/evaluating_statistical_claims.causal_vs_association.ST.P";
import { ITEM as ESC_SD } from "../items/evaluating_statistical_claims.study_design_random_assignment.ST.P";

export const BUNDLE: LArch[] = [...IME_POP, ...IME_INT, ...IME_SSE, ...ESC_SG, ...ESC_SGT, ...ESC_CA, ...ESC_SD];
