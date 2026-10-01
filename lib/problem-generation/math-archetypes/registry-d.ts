// 담당 D 의 원형 전체(hard + easy/medium) — 난이도 구분이 있는 LArch 목록. hard 수치형 원형은 registry.ts 에도 한 줄씩 등록된다.
import type { LArch } from "./levels-d";
import { LAT_ALL } from "./skills/lines-angles-triangles";
import { RT_ALL } from "./skills/right-triangles-trigonometry";
import { OVD_ALL } from "./skills/one-variable-data";

export const D_ARCHETYPES: LArch[] = [...LAT_ALL, ...RT_ALL, ...OVD_ALL];
