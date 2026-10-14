// 재고 배치 레지스트리와 저장소 산출물 읽기. 배치 정의는 scripts/ap-generation/owner-load.sh(graph|siblings|supp)와 owner-run-bc-topup-load.md 의 값을 그대로 옮긴 것이다.
// 산출물(data/ap/stock/*, data/ap/screen-evidence/*.json, data/ap/render-check/report.json)은 배포 번들에 포함돼(next.config.ts outputFileTracingIncludes)
// 서버가 파일 시스템에서 읽는다. 업로드 경로는 없다 — 임의 파일을 올려 DB 에 쓰는 통로를 만들지 않는다. 새 배치는 저장소 커밋 → 배포로만 들어온다.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { RenderReportRow, ScreenEvidence } from "../ap-generation/verify-guard";
import type { StockItem } from "../ap-generation/stock";
import { PARTIAL_PLAN_FILE_RE, type PartialPlanFile } from "./partial-draft";

export type StockBatch = {
  id: string;
  /** 사람이 읽는 이름 */
  title: string;
  /** 후보 적재 대상 파일(data/ap/stock/<file>). 없으면 이미 적재된 배치(형제 21건 등)로 렌더·화면 기록만. */
  itemsFile: string | null;
  /** ap_load_batches.label (적재 시 새로 만든다) */
  loadLabel: string | null;
  /** 보조 적재 여부(--supplement) */
  supplement: boolean;
  passKeysFile: string;
  evidenceFile: string;
};

const GRAPH: [string, string][] = [["s1", "graph-s1-ab"], ["s2a", "graph-s2-ab"], ["s2b", "graph-s2-bc"], ["s3a", "graph-s3a-ab"], ["s3b", "graph-s3a-bc"], ["s3c", "graph-s3b-ab"], ["s3d", "graph-s3b-bc"], ["s3e", "graph-s3c-ab"], ["s3f", "graph-s3c-bc"], ["s3g", "graph-s3d-bc"]];
const SUPP = ["b1", "b2ab", "b2bc", "b3ab", "b3bc", "b4ab", "b5bc", "b6ab"];

export const STOCK_BATCHES: StockBatch[] = [
  ...GRAPH.map(([f, b]): StockBatch => ({ id: `graph-${f}`, title: `그래프 배치 ${f} (${b})`, itemsFile: `graph-${f}-items.json`, loadLabel: `${b}-2026-10-09`, supplement: true, passKeysFile: `graph-${f}-pass-keys.json`, evidenceFile: "evidence-graph-s1s3.json" })),
  { id: "siblings", title: "형제 21건 (이미 적재, 검증 기록만)", itemsFile: null, loadLabel: null, supplement: false, passKeysFile: "v1v45-siblings-keys.json", evidenceFile: "evidence-v1v45-siblings.json" },
  ...SUPP.map((n): StockBatch => ({ id: `supp-${n}`, title: `보강 배치 ${n}`, itemsFile: `supp-${n}-items.json`, loadLabel: `supp-${n}-2026-10-09`, supplement: true, passKeysFile: `supp-${n}-pass-keys.json`, evidenceFile: "evidence-supp.json" })),
  // 2026-10-12 예비 보충 2차(docs/ap/reserve-topup-2.md): 두 배치가 한 증거 파일을 공유한다.
  ...(["t2a", "t2b"] as const).map((n): StockBatch => ({ id: `supp-${n}`, title: `예비 보충 2차 ${n}`, itemsFile: `supp-${n}-items.json`, loadLabel: `supp-${n}-2026-10-12`, supplement: true, passKeysFile: `supp-${n}-pass-keys.json`, evidenceFile: "evidence-topup2.json" })),
  // 2026-10-12 예비 3차(docs/ap/reserve-r3-report.md): 다섯 배치(R3-A·B·B2·C·C2)가 한 증거 파일을 공유한다.
  ...(["r3a", "r3b", "r3b2", "r3c", "r3c2"] as const).map((n): StockBatch => ({ id: `supp-${n}`, title: `예비 3차 ${n}`, itemsFile: `supp-${n}-items.json`, loadLabel: `supp-${n}-2026-10-12`, supplement: true, passKeysFile: `supp-${n}-pass-keys.json`, evidenceFile: "evidence-r3.json" })),
  // 2026-10-12 AP Statistics S1 파일럿(docs/ap/statistics-pilot-report.md): 원형 20개 × 1(L 10·M 6·H 4), 세 런(stats-s1-l/m/h-final)이 한 증거 파일을 공유한다.
  { id: "stats-s1", title: "AP Statistics 파일럿 S1 (원형 20)", itemsFile: "stats-s1-items.json", loadLabel: "stats-s1-2026-10-12", supplement: true, passKeysFile: "stats-s1-pass-keys.json", evidenceFile: "evidence-stats-s1.json" },
  // 2026-10-12 AP Statistics S2-a(docs/ap/statistics-s2a-report.md): 단독 15 + 공유 자료 세트 2(3문항씩) + FRQ 2 후보, 세 런(stats-s2a-a/b/c)이 한 증거 파일을 공유한다.
  { id: "stats-s2a", title: "AP Statistics S2-a (단독 15 + 공유 세트 2 + FRQ 2)", itemsFile: "stats-s2a-items.json", loadLabel: "stats-s2a-2026-10-12", supplement: true, passKeysFile: "stats-s2a-pass-keys.json", evidenceFile: "evidence-stats-s2a.json" },
  // 2026-10-12 AP Statistics S2-b(docs/ap/statistics-s2b-report.md): 첫 풀 세트 마무리 — 단독 12 + 공유 세트 2(이항, 같은 원형 예비 1) + FRQ 6 후보(Q1·Q2·Q4 각 2), 세 런(stats-s2b-a/b/c)이 한 증거 파일을 공유한다.
  { id: "stats-s2b", title: "AP Statistics S2-b (단독 12 + 공유 세트 2 + FRQ 6)", itemsFile: "stats-s2b-items.json", loadLabel: "stats-s2b-2026-10-12", supplement: true, passKeysFile: "stats-s2b-pass-keys.json", evidenceFile: "evidence-stats-s2b.json" },
  // 2026-10-12 AP Statistics S3-a(docs/ap/statistics-s3a-report.md): 다단계 신규 MC 원형 10개 x 시드 2 = 단독 20 후보.
  { id: "stats-s3a", title: "AP Statistics S3-a (다단계 단독 20)", itemsFile: "stats-s3a-items.json", loadLabel: "stats-s3a-2026-10-12", supplement: true, passKeysFile: "stats-s3a-pass-keys.json", evidenceFile: "evidence-stats-s3a.json" },
  // 2026-10-13 AP Statistics S3-b(docs/ap/statistics-s3b-report.md): ST2 부족분 — 단독 37 후보(통과 34) + 단원 5 회귀 공유 세트 3 + FRQ 12(통과 5).
  { id: "stats-s3b", title: "AP Statistics S3-b (ST2 부족분: 단독 34 + 회귀 세트 3 + FRQ 5)", itemsFile: "stats-s3b-items.json", loadLabel: "stats-s3b-2026-10-13", supplement: true, passKeysFile: "stats-s3b-pass-keys.json", evidenceFile: "evidence-stats-s3b.json" },
  // 2026-10-13 AP Physics 1 P1-a(docs/ap/physics1-p1a-report.md): 단독 20 + 세트 1 원형 x 후보 2 = 44문항 후보, 통과 18(단독만; 세트 0, 선택지 그림 0). 한 증거 파일.
  { id: "phys-p1a", title: "AP Physics 1 P1-a (MC 파일럿, 통과 18)", itemsFile: "phys-p1a-items.json", loadLabel: "phys-p1a-2026-10-13", supplement: true, passKeysFile: "phys-p1a-pass-keys.json", evidenceFile: "evidence-phys-p1a.json" },
  // 2026-10-13 AP Physics 1 P1-a v2 재검증(docs/ap/physics1-groundwork.md §14): 같은 22칸 x 후보 2(수정된 원형·해설·그림 설명 포함), 첫 통과 30/44(68%). 세 배치(p1a2·p1b·s2)가 한 증거 파일을 공유한다.
  { id: "phys-p1a2", title: "AP Physics 1 P1-a v2 (MC 재검증, 통과 30)", itemsFile: "phys-p1a2-items.json", loadLabel: "phys-p1a2-2026-10-13", supplement: true, passKeysFile: "phys-p1a2-pass-keys.json", evidenceFile: "evidence-phys-s2.json" },
  // P1-b FRQ 파일럿: MR·TBR·LAB·QQT 각 1건, 통과 2(TBR·QQT).
  { id: "phys-p1b", title: "AP Physics 1 P1-b (FRQ 파일럿, 통과 2)", itemsFile: "phys-p1b-items.json", loadLabel: "phys-p1b-2026-10-13", supplement: true, passKeysFile: "phys-p1b-pass-keys.json", evidenceFile: "evidence-phys-s2.json" },
  // phys-s2: 풀 모의고사 2회(PH1·PH2) 부족분 — 신규 원형 48 + 세트 3 + 단독 136 후보·세트 10 후보·FRQ 28 후보(런 a–e, 비용 $6.6967).
  { id: "phys-s2", title: "AP Physics 1 phys-s2 (PH1·PH2 부족분: 단독·세트·FRQ)", itemsFile: "phys-s2-items.json", loadLabel: "phys-s2-2026-10-13", supplement: true, passKeysFile: "phys-s2-pass-keys.json", evidenceFile: "evidence-phys-s2.json" },
  // phys-s3: 스킬 범위 보강(2026-10-13) — 신규 원형 40(2.A 기호식 11·2.C 순위 10·2.D 예측 7·3.B 주장 7·3.C 자료 근거 5) x 후보 2 = 80, 런 phys-s3-a, 비용 $2.6406.
  { id: "phys-s3", title: "AP Physics 1 phys-s3 (스킬 범위 보강: 2.A·2.C·2.D·3.B·3.C 단독)", itemsFile: "phys-s3-items.json", loadLabel: "phys-s3-2026-10-13", supplement: true, passKeysFile: "phys-s3-pass-keys.json", evidenceFile: "evidence-phys-s3.json" },
  // phys-s4: FRQ 두 번째 시나리오(2026-10-13, 오너 결정) — 신규 원형 8(MR 2·TBR 2·LAB 2·QQT 2) x 후보 3 = 24(런 phys-s4-a, $1.3766) + 표·그림 설명 누락을 고친 3원형 재생성 9(런 phys-s4-b, $0.5157). 재고 고유 8(원형당 1), 합계 $1.8923.
  { id: "phys-s4", title: "AP Physics 1 phys-s4 (FRQ 두 번째 시나리오: MR·TBR·LAB·QQT 각 2)", itemsFile: "phys-s4-items.json", loadLabel: "phys-s4-2026-10-13", supplement: true, passKeysFile: "phys-s4-pass-keys.json", evidenceFile: "evidence-phys-s4.json" },
  // 2026-10-13 AP Chemistry(docs/ap/chemistry-groundwork.md): 파일럿 3 + chem-s2 부족분 4배치. 한 증거 파일(evidence-chem-s2.json)을 공유한다.
  { id: "chem-p1a", title: "AP Chemistry P1-a v1 (MC 파일럿) (통과 15)", itemsFile: "chem-p1a-items.json", loadLabel: "chem-p1a-2026-10-13", supplement: true, passKeysFile: "chem-p1a-pass-keys.json", evidenceFile: "evidence-chem-s2.json" },
  { id: "chem-p1a2", title: "AP Chemistry P1-a v2 (MC 재검증) (통과 32)", itemsFile: "chem-p1a2-items.json", loadLabel: "chem-p1a2-2026-10-13", supplement: true, passKeysFile: "chem-p1a2-pass-keys.json", evidenceFile: "evidence-chem-s2.json" },
  { id: "chem-p1b", title: "AP Chemistry P1-b (FRQ 파일럿) (통과 1)", itemsFile: "chem-p1b-items.json", loadLabel: "chem-p1b-2026-10-13", supplement: true, passKeysFile: "chem-p1b-pass-keys.json", evidenceFile: "evidence-chem-s2.json" },
  { id: "chem-s2f", title: "AP Chemistry chem-s2 FRQ (CH1·CH2 부족분) (통과 22)", itemsFile: "chem-s2f-items.json", loadLabel: "chem-s2f-2026-10-13", supplement: true, passKeysFile: "chem-s2f-pass-keys.json", evidenceFile: "evidence-chem-s2.json" },
  { id: "chem-s2ma", title: "AP Chemistry chem-s2 MC-a (통과 54)", itemsFile: "chem-s2ma-items.json", loadLabel: "chem-s2ma-2026-10-13", supplement: true, passKeysFile: "chem-s2ma-pass-keys.json", evidenceFile: "evidence-chem-s2.json" },
  { id: "chem-s2mb", title: "AP Chemistry chem-s2 MC-b (통과 38)", itemsFile: "chem-s2mb-items.json", loadLabel: "chem-s2mb-2026-10-13", supplement: true, passKeysFile: "chem-s2mb-pass-keys.json", evidenceFile: "evidence-chem-s2.json" },
  { id: "chem-s2mc", title: "AP Chemistry chem-s2 MC-c (통과 17)", itemsFile: "chem-s2mc-items.json", loadLabel: "chem-s2mc-2026-10-13", supplement: true, passKeysFile: "chem-s2mc-pass-keys.json", evidenceFile: "evidence-chem-s2.json" },
  // 2026-10-13 AP Microeconomics(docs/ap/microeconomics-groundwork.md): 파일럿 2 + P2 부족분 3배치. 한 증거 파일(evidence-micro-s2.json)을 공유한다.
  { id: "micro-p1a", title: "AP Microeconomics P1-a (MC 파일럿)", itemsFile: "micro-p1a-items.json", loadLabel: "micro-p1a-2026-10-13", supplement: true, passKeysFile: "micro-p1a-pass-keys.json", evidenceFile: "evidence-micro-s2.json" },
  { id: "micro-p1b", title: "AP Microeconomics P1-b (FRQ 파일럿)", itemsFile: "micro-p1b-items.json", loadLabel: "micro-p1b-2026-10-13", supplement: true, passKeysFile: "micro-p1b-pass-keys.json", evidenceFile: "evidence-micro-s2.json" },
  { id: "micro-p2f", title: "AP Microeconomics P2 FRQ (MI1·MI2 부족분)", itemsFile: "micro-p2f-items.json", loadLabel: "micro-p2f-2026-10-13", supplement: true, passKeysFile: "micro-p2f-pass-keys.json", evidenceFile: "evidence-micro-s2.json" },
  { id: "micro-p2a", title: "AP Microeconomics P2 MC-a (MI1·MI2 부족분)", itemsFile: "micro-p2a-items.json", loadLabel: "micro-p2a-2026-10-13", supplement: true, passKeysFile: "micro-p2a-pass-keys.json", evidenceFile: "evidence-micro-s2.json" },
  { id: "micro-p2b", title: "AP Microeconomics P2 MC-b (MI1·MI2 부족분)", itemsFile: "micro-p2b-items.json", loadLabel: "micro-p2b-2026-10-13", supplement: true, passKeysFile: "micro-p2b-pass-keys.json", evidenceFile: "evidence-micro-s2.json" },
  { id: "micro-p2c", title: "AP Microeconomics P2 MC-c (MI2 부족분·수정 원형)", itemsFile: "micro-p2c-items.json", loadLabel: "micro-p2c-2026-10-13", supplement: true, passKeysFile: "micro-p2c-pass-keys.json", evidenceFile: "evidence-micro-s2.json" },
  { id: "micro-p2d", title: "AP Microeconomics P2 MC-d (마지막 부족 칸)", itemsFile: "micro-p2d-items.json", loadLabel: "micro-p2d-2026-10-13", supplement: true, passKeysFile: "micro-p2d-pass-keys.json", evidenceFile: "evidence-micro-s2.json" },
  // 2026-10-13 AP Computer Science A(docs/ap/csa-groundwork.md §9): 파일럿 2 + s2 보충 5 + 부족분 2배치. 한 증거 파일(evidence-csa-s2.json)을 공유한다. CS1·CS2 정확 배정: data/ap/stock/exact-assign-csa-cs1-cs2.json
  { id: "csa-p1a", title: "AP Computer Science A P1-a (MC 파일럿) (통과 22)", itemsFile: "csa-p1a-items.json", loadLabel: "csa-p1a-2026-10-13", supplement: true, passKeysFile: "csa-p1a-pass-keys.json", evidenceFile: "evidence-csa-s2.json" },
  { id: "csa-p1b", title: "AP Computer Science A P1-b (FRQ 파일럿) (통과 3)", itemsFile: "csa-p1b-items.json", loadLabel: "csa-p1b-2026-10-13", supplement: true, passKeysFile: "csa-p1b-pass-keys.json", evidenceFile: "evidence-csa-s2.json" },
  { id: "csa-s2a", title: "AP Computer Science A s2 MC-a (통과 31)", itemsFile: "csa-s2a-items.json", loadLabel: "csa-s2a-2026-10-13", supplement: true, passKeysFile: "csa-s2a-pass-keys.json", evidenceFile: "evidence-csa-s2.json" },
  { id: "csa-s2b", title: "AP Computer Science A s2 MC-b (통과 30)", itemsFile: "csa-s2b-items.json", loadLabel: "csa-s2b-2026-10-13", supplement: true, passKeysFile: "csa-s2b-pass-keys.json", evidenceFile: "evidence-csa-s2.json" },
  { id: "csa-s2c", title: "AP Computer Science A s2 MC-c (통과 27)", itemsFile: "csa-s2c-items.json", loadLabel: "csa-s2c-2026-10-13", supplement: true, passKeysFile: "csa-s2c-pass-keys.json", evidenceFile: "evidence-csa-s2.json" },
  { id: "csa-s2fa", title: "AP Computer Science A s2 FRQ-a (Q1·Q2) (통과 5)", itemsFile: "csa-s2fa-items.json", loadLabel: "csa-s2fa-2026-10-13", supplement: true, passKeysFile: "csa-s2fa-pass-keys.json", evidenceFile: "evidence-csa-s2.json" },
  { id: "csa-s2fb", title: "AP Computer Science A s2 FRQ-b (Q3·Q4) (통과 4)", itemsFile: "csa-s2fb-items.json", loadLabel: "csa-s2fb-2026-10-13", supplement: true, passKeysFile: "csa-s2fb-pass-keys.json", evidenceFile: "evidence-csa-s2.json" },
  { id: "csa-s2sm", title: "AP Computer Science A s2 부족분 MC (수정 원형 재시도) (통과 12)", itemsFile: "csa-s2sm-items.json", loadLabel: "csa-s2sm-2026-10-13", supplement: true, passKeysFile: "csa-s2sm-pass-keys.json", evidenceFile: "evidence-csa-s2.json" },
  { id: "csa-s2sf", title: "AP Computer Science A s2 부족분 FRQ (Q4 재시도) (통과 1)", itemsFile: "csa-s2sf-items.json", loadLabel: "csa-s2sf-2026-10-13", supplement: true, passKeysFile: "csa-s2sf-pass-keys.json", evidenceFile: "evidence-csa-s2.json" },
  // 2026-10-14 AP Biology(docs/ap/biology-groundwork.md): 파일럿 2 + s2 3 + 부족분 4배치. 한 증거 파일(evidence-bio-s2.json)을 공유한다. BI1·BI2 정확 배정: data/ap/stock/exact-assign-bio-bi1-bi2.json
  { id: "bio-p1a", title: "AP Biology P1-a (MC 파일럿) (통과 20)", itemsFile: "bio-p1a-items.json", loadLabel: "bio-p1a-2026-10-14", supplement: true, passKeysFile: "bio-p1a-pass-keys.json", evidenceFile: "evidence-bio-s2.json" },
  { id: "bio-p1b", title: "AP Biology P1-b (FRQ 파일럿) (통과 2)", itemsFile: "bio-p1b-items.json", loadLabel: "bio-p1b-2026-10-14", supplement: true, passKeysFile: "bio-p1b-pass-keys.json", evidenceFile: "evidence-bio-s2.json" },
  { id: "bio-s2a", title: "AP Biology s2 MC-a (통과 39)", itemsFile: "bio-s2a-items.json", loadLabel: "bio-s2a-2026-10-14", supplement: true, passKeysFile: "bio-s2a-pass-keys.json", evidenceFile: "evidence-bio-s2.json" },
  { id: "bio-s2b", title: "AP Biology s2 MC-b (통과 37)", itemsFile: "bio-s2b-items.json", loadLabel: "bio-s2b-2026-10-14", supplement: true, passKeysFile: "bio-s2b-pass-keys.json", evidenceFile: "evidence-bio-s2.json" },
  { id: "bio-s2c", title: "AP Biology s2 세트·FRQ (통과 24)", itemsFile: "bio-s2c-items.json", loadLabel: "bio-s2c-2026-10-14", supplement: true, passKeysFile: "bio-s2c-pass-keys.json", evidenceFile: "evidence-bio-s2.json" },
  { id: "bio-r1", title: "AP Biology 부족분 R1 (MC·세트) (통과 21)", itemsFile: "bio-r1-items.json", loadLabel: "bio-r1-2026-10-14", supplement: true, passKeysFile: "bio-r1-pass-keys.json", evidenceFile: "evidence-bio-s2.json" },
  { id: "bio-r2", title: "AP Biology 부족분 R2 (MC·세트) (통과 17)", itemsFile: "bio-r2-items.json", loadLabel: "bio-r2-2026-10-14", supplement: true, passKeysFile: "bio-r2-pass-keys.json", evidenceFile: "evidence-bio-s2.json" },
  { id: "bio-r3", title: "AP Biology 부족분 R3 (시나리오 원형·세트) (통과 15)", itemsFile: "bio-r3-items.json", loadLabel: "bio-r3-2026-10-14", supplement: true, passKeysFile: "bio-r3-pass-keys.json", evidenceFile: "evidence-bio-s2.json" },
  { id: "bio-r4", title: "AP Biology 부족분 R4 (단원 6 원형·세트) (통과 7)", itemsFile: "bio-r4-items.json", loadLabel: "bio-r4-2026-10-14", supplement: true, passKeysFile: "bio-r4-pass-keys.json", evidenceFile: "evidence-bio-s2.json" },
  // 2026-10-14 AP English Language(docs/ap/englang-groundwork.md §9): 파일럿(MC 지문 묶음 3 + FRQ 3) + P2 MC 14묶음 + FRQ 3. 한 증거 파일(evidence-el.json)을 공유한다. EL1 정확 배정: data/ap/stock/exact-assign-el-el1.json
  { id: "el-p1", title: "AP English Language P1 (MC 파일럿 묶음 3 + FRQ 3)", itemsFile: "el-p1-items.json", loadLabel: "el-p1-2026-10-14", supplement: true, passKeysFile: "el-p1-pass-keys.json", evidenceFile: "evidence-el.json" },
  { id: "el-p2a", title: "AP English Language P2 MC (지문 묶음 14: 읽기 7 + 글쓰기 7)", itemsFile: "el-p2a-items.json", loadLabel: "el-p2a-2026-10-14", supplement: true, passKeysFile: "el-p2a-pass-keys.json", evidenceFile: "evidence-el.json" },
  { id: "el-p2b", title: "AP English Language P2 FRQ (종합·수사 분석·논증 각 1)", itemsFile: "el-p2b-items.json", loadLabel: "el-p2b-2026-10-14", supplement: true, passKeysFile: "el-p2b-pass-keys.json", evidenceFile: "evidence-el.json" },
  // 2026-10-14 EL2 보충(s2a 8묶음 + s2b 4묶음). 증거 파일 evidence-el-supp.json. EL1·EL2 정확 배정: data/ap/stock/exact-assign-el-el1-el2.json
  { id: "el-s2a", title: "AP English Language s2a MC (EL2 보충: 읽기 6 + 글쓰기 2묶음) (통과 27)", itemsFile: "el-s2a-items.json", loadLabel: "el-s2a-2026-10-14", supplement: true, passKeysFile: "el-s2a-pass-keys.json", evidenceFile: "evidence-el-supp.json" },
  { id: "el-s2b", title: "AP English Language s2b MC (EL2 보충 top-up: 읽기 2 + 글쓰기 2묶음) (통과 17)", itemsFile: "el-s2b-items.json", loadLabel: "el-s2b-2026-10-14", supplement: true, passKeysFile: "el-s2b-pass-keys.json", evidenceFile: "evidence-el-supp.json" },
  { id: "bc-topup", title: "BC 보충 (bc-topup)", itemsFile: "bc-topup-items.json", loadLabel: "bc-topup-2026-10-09", supplement: true, passKeysFile: "bc-topup-pass-keys.json", evidenceFile: "evidence-bc-topup.json" },
];

export const batchById = (id: string): StockBatch => {
  const b = STOCK_BATCHES.find((x) => x.id === id);
  if (!b) throw new Error(`알 수 없는 배치: ${id}`);
  return b;
};

const root = () => process.cwd();
const readJson = <T>(rel: string): T => JSON.parse(readFileSync(path.join(root(), rel), "utf-8")) as T;
const has = (rel: string) => existsSync(path.join(root(), rel));

export const stockFileExists = (f: string) => has(`data/ap/stock/${f}`);
export function readPassKeys(b: StockBatch): string[] {
  const raw = readJson<string[] | { keys?: string[] }>(`data/ap/stock/${b.passKeysFile}`);
  return Array.isArray(raw) ? raw : raw.keys ?? [];
}
export const readItems = (b: StockBatch): StockItem[] => (b.itemsFile ? readJson<StockItem[]>(`data/ap/stock/${b.itemsFile}`) : []);
export const readDefectScan = () => (has("data/ap/stock/defect-scan.json") ? readJson<{ key: string; flags: { code: string }[] }[]>("data/ap/stock/defect-scan.json") : []);
export const readRenderReport = () => readJson<{ results: RenderReportRow[] }>("data/ap/render-check/report.json");
export const readEvidence = (b: StockBatch) => readJson<ScreenEvidence>(`data/ap/screen-evidence/${b.evidenceFile}`);
export const batchArtifactsPresent = (b: StockBatch) => ({ items: b.itemsFile ? stockFileExists(b.itemsFile) : true, passKeys: stockFileExists(b.passKeysFile), evidence: has(`data/ap/screen-evidence/${b.evidenceFile}`) });

/** 배정 보고서(data/ap/stock/exact-assign-*.json): 미리 계산된 세트 배정. 무거운 ILP 는 서버에서 돌리지 않는다. */
export type AssignReport = { sets: { id: string; mcA: string[]; mcB: string[]; frqA: string[]; frqB: string[]; virtual?: unknown[]; frqVirtual?: unknown[] }[] };
export function listAssignReports(): string[] {
  // 목록은 고정 접두어 파일만(경로 주입 방지). 실제 읽기는 아래 readAssignReport 가 같은 규칙으로 검사한다.
  return readdirSync(path.join(root(), "data/ap/stock")).filter((f) => /^exact-assign-[A-Za-z0-9.-]+\.json$/.test(f)).sort();
}
export function readAssignReport(file: string): AssignReport {
  if (!/^exact-assign-[A-Za-z0-9.-]+\.json$/.test(file)) throw new Error("배정 보고서 파일 이름이 올바르지 않습니다.");
  const r = readJson<AssignReport>(`data/ap/stock/${file}`);
  if (!Array.isArray(r.sets)) throw new Error("배정 보고서 형식 오류(sets 없음).");
  return r;
}

/** 부분 연습 세트 재구성 계획(data/ap/stock/assembled/partial-rebuild-*.json, scripts/ap-generation/partial-rebuild-plan.ts 산출). 목록은 고정 접두어 파일만. */
export function listPartialPlans(): { file: string; sets: { id: string; name: string; partial: string }[] }[] {
  const dir = path.join(root(), "data/ap/stock/assembled");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => PARTIAL_PLAN_FILE_RE.test(f)).sort().map((f) => ({ file: f, sets: readPartialPlan(f).sets.map((s) => ({ id: s.id, name: s.name, partial: s.partial })) }));
}
export function readPartialPlan(file: string): PartialPlanFile {
  if (!PARTIAL_PLAN_FILE_RE.test(file)) throw new Error("부분 세트 계획 파일 이름이 올바르지 않습니다.");
  const r = readJson<PartialPlanFile>(`data/ap/stock/assembled/${file}`);
  if (r.kind !== "ap_partial_rebuild_plan" || !Array.isArray(r.sets)) throw new Error("부분 세트 계획 형식 오류.");
  return r;
}
