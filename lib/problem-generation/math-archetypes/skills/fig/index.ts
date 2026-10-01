// 자료 원형 1단계 이후(표·그래프·도형 계열) 조합 모음 — 묶음(bundle) 파일을 미리 다 import 해 둔다.
// 병렬 작업 규칙: 에이전트는 자기 묶음 파일(bundles/<묶음>.ts)과 그 묶음의 조합 파일(items/<조합ID>.ts)만 고친다. 이 파일·registry 는 고치지 않는다.
import type { LArch } from "../../levels-d";
import { BUNDLE as T1 } from "./bundles/T1-linear-tables";
import { BUNDLE as T2 } from "./bundles/T2-one-var-tables";
import { BUNDLE as T3 } from "./bundles/T3-probability-tables";
import { BUNDLE as T4 } from "./bundles/T4-percent-ratio-tables";
import { BUNDLE as T5 } from "./bundles/T5-nonlinear-tables";
import { BUNDLE as T6 } from "./bundles/T6-inequality-system-tables";
import { BUNDLE as T7 } from "./bundles/T7-statement-claims";
import { BUNDLE as T8 } from "./bundles/T8-table-choices";

export const FIG_ALL: LArch[] = [...T1, ...T2, ...T3, ...T4, ...T5, ...T6, ...T7, ...T8];
export const FIG_HARD: LArch[] = FIG_ALL.filter((a) => a.level === "hard");
