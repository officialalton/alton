// 재고 배치 레지스트리와 저장소 산출물 읽기. 배치 정의는 scripts/ap-generation/owner-load.sh(graph|siblings|supp)와 owner-run-bc-topup-load.md 의 값을 그대로 옮긴 것이다.
// 산출물(data/ap/stock/*, data/ap/screen-evidence/*.json, data/ap/render-check/report.json)은 배포 번들에 포함돼(next.config.ts outputFileTracingIncludes)
// 서버가 파일 시스템에서 읽는다. 업로드 경로는 없다 — 임의 파일을 올려 DB 에 쓰는 통로를 만들지 않는다. 새 배치는 저장소 커밋 → 배포로만 들어온다.
import { existsSync, readdirSync, readFileSync } from "../ap-generation/data-fs";
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
  // 2026-10-19 MI3 가 쓰는 기존 run1 후보 18건(이미 적재됨·화면 증거 보유, 변환만 안 됨) — 렌더·화면 기록과 변환만 한다.
  { id: "micro-mi3-base", title: "AP Microeconomics MI3 기존 run1 후보 18건 (이미 적재, 검증 기록·변환만)", itemsFile: null, loadLabel: null, supplement: false, passKeysFile: "micro-mi3-base-pass-keys.json", evidenceFile: "evidence-2026-10-09c.json" },
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
  // 2026-10-19 AP Physics 1 PH5·PH6(docs/ap/ap-bi-ph-ch-expansion-20261019.md): 공개 세트(PH3·PH4)와 풀이 틀(원형)이 겹치지 않는 세트 2개 — 새 원형 MC 51·세트 4·FRQ 4 시나리오. 증거 파일은 evidence-phys-s5.json. PH5·PH6 정확 배정: data/ap/stock/exact-assign-phys-ph5-ph6.json
  { id: "phys-s5a", title: "AP Physics 1 phys-s5a (PH5·PH6 새 원형 단독 MC: 2.A·2.C·2.D·3.B·3.C) (통과 99)", itemsFile: "phys-s5a-items.json", loadLabel: "phys-s5a-2026-10-19", supplement: true, passKeysFile: "phys-s5a-pass-keys.json", evidenceFile: "evidence-phys-s5.json" },
  { id: "phys-s5s", title: "AP Physics 1 phys-s5s (PH5·PH6 새 2문항 세트 4) (통과 10)", itemsFile: "phys-s5s-items.json", loadLabel: "phys-s5s-2026-10-19", supplement: true, passKeysFile: "phys-s5s-pass-keys.json", evidenceFile: "evidence-phys-s5.json" },
  { id: "phys-s5f", title: "AP Physics 1 phys-s5f (PH6 FRQ 세 번째 시나리오: MR 아트우드) (통과 1)", itemsFile: "phys-s5f-items.json", loadLabel: "phys-s5f-2026-10-19", supplement: true, passKeysFile: "phys-s5f-pass-keys.json", evidenceFile: "evidence-phys-s5.json" },
  { id: "phys-s5b", title: "AP Physics 1 phys-s5b (2차: 표기·stem 길이·오답 설명을 고친 원형 + 예비 3) (통과 35)", itemsFile: "phys-s5b-items.json", loadLabel: "phys-s5b-2026-10-19", supplement: true, passKeysFile: "phys-s5b-pass-keys.json", evidenceFile: "evidence-phys-s5.json" },
  { id: "phys-s5g", title: "AP Physics 1 phys-s5g (PH6 FRQ: TBR 엘리베이터·QQT 위성) (통과 2)", itemsFile: "phys-s5g-items.json", loadLabel: "phys-s5g-2026-10-19", supplement: true, passKeysFile: "phys-s5g-pass-keys.json", evidenceFile: "evidence-phys-s5.json" },
  { id: "phys-s5h", title: "AP Physics 1 phys-s5h (PH6 FRQ: LAB 경사면 g) (통과 1)", itemsFile: "phys-s5h-items.json", loadLabel: "phys-s5h-2026-10-19", supplement: true, passKeysFile: "phys-s5h-pass-keys.json", evidenceFile: "evidence-phys-s5.json" },
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
  // 2026-10-19 확대(MI3, 공개 세트와 풀이 틀·자료 형태가 다른 신규 세트): 신규 원형 + 미사용 라이브러리 원형. 한 증거 파일(evidence-micro-s5.json)을 공유한다. MI3 정확 배정: data/ap/stock/exact-assign-micro-mi3.json, 설계표: design-table-micro-mi3.json
  { id: "micro-s5a", title: "AP Microeconomics MI3 s5-a 미사용 라이브러리 원형 + 짧은 FRQ(노동)", itemsFile: "micro-s5a-items.json", loadLabel: "micro-s5a-2026-10-19", supplement: true, passKeysFile: "micro-s5a-pass-keys.json", evidenceFile: "evidence-micro-s5.json" },
  { id: "micro-s5b", title: "AP Microeconomics MI3 s5-b 신규 원형 31 (비교·식별·수치)", itemsFile: "micro-s5b-items.json", loadLabel: "micro-s5b-2026-10-19", supplement: true, passKeysFile: "micro-s5b-pass-keys.json", evidenceFile: "evidence-micro-s5.json" },
  { id: "micro-s5c", title: "AP Microeconomics MI3 s5-c 단원 5 보충 + 짧은 FRQ(가동 중단)", itemsFile: "micro-s5c-items.json", loadLabel: "micro-s5c-2026-10-19", supplement: true, passKeysFile: "micro-s5c-pass-keys.json", evidenceFile: "evidence-micro-s5.json" },
  { id: "micro-s5d", title: "AP Microeconomics MI3 s5-d 단원 1 보충 원형 2", itemsFile: "micro-s5d-items.json", loadLabel: "micro-s5d-2026-10-19", supplement: true, passKeysFile: "micro-s5d-pass-keys.json", evidenceFile: "evidence-micro-s5.json" },
  // 2026-10-19 확대(CS3, 공개 세트 CS1·CS2 와 원형·코드 모양이 다른 신규 세트): 신규 원형 44(단독 41 + 2문항 세트 3). 한 증거 파일(evidence-csa-x.json)을 공유한다. CS3 정확 배정: data/ap/stock/exact-assign-csa-cs3.json, 설계표: design-table-csa-cs3.json
  { id: "csa-xa", title: "AP Computer Science A CS3 x-a 신규 원형 전체(단독 37 + 세트 3)", itemsFile: "csa-xa-items.json", loadLabel: "csa-xa-2026-10-19", supplement: true, passKeysFile: "csa-xa-pass-keys.json", evidenceFile: "evidence-csa-x.json" },
  { id: "csa-xb", title: "AP Computer Science A CS3 x-b 질문 문장을 고친 출력 추적 원형 15 + 오류 종류", itemsFile: "csa-xb-items.json", loadLabel: "csa-xb-2026-10-19", supplement: true, passKeysFile: "csa-xb-pass-keys.json", evidenceFile: "evidence-csa-x.json" },
  { id: "csa-xc", title: "AP Computer Science A CS3 x-c 도우미 메서드 코드 완성 3 + 사전·사후조건", itemsFile: "csa-xc-items.json", loadLabel: "csa-xc-2026-10-19", supplement: true, passKeysFile: "csa-xc-pass-keys.json", evidenceFile: "evidence-csa-x.json" },
  { id: "csa-xd", title: "AP Computer Science A CS3 x-d 사전·사후조건 재작성 2", itemsFile: "csa-xd-items.json", loadLabel: "csa-xd-2026-10-19", supplement: true, passKeysFile: "csa-xd-pass-keys.json", evidenceFile: "evidence-csa-x.json" },
  { id: "csa-xe", title: "AP Computer Science A CS3 x-e 단원 1·2 사전·사후조건 보충 2", itemsFile: "csa-xe-items.json", loadLabel: "csa-xe-2026-10-19", supplement: true, passKeysFile: "csa-xe-pass-keys.json", evidenceFile: "evidence-csa-x.json" },
  { id: "csa-xf", title: "AP Computer Science A CS3 x-f Shelf 세트 재생성(세트 문항의 중복 코드 자료 결함 수정)", itemsFile: "csa-xf-items.json", loadLabel: "csa-xf-2026-10-19", supplement: true, passKeysFile: "csa-xf-pass-keys.json", evidenceFile: "evidence-csa-x.json" },
  // 2026-10-19 확대(MA3, 공개 세트 MA1·MA2 와 풀이 틀·자료 형태가 다른 신규 세트): 신규 원형 + 미사용 라이브러리 원형. 한 증거 파일(evidence-macro-x.json)을 공유한다. MA3 정확 배정: data/ap/stock/exact-assign-macro-ma3.json, 설계표: design-table-macro-ma3.json
  { id: "macro-xa", title: "AP Macroeconomics MA3 x-a 신규 원형 + 미사용 라이브러리 원형", itemsFile: "macro-xa-items.json", loadLabel: "macro-xa-2026-10-19", supplement: true, passKeysFile: "macro-xa-pass-keys.json", evidenceFile: "evidence-macro-x.json" },
  { id: "macro-xb", title: "AP Macroeconomics MA3 x-b 비수치 보충 11 + 키 문장을 고친 원형 10", itemsFile: "macro-xb-items.json", loadLabel: "macro-xb-2026-10-19", supplement: true, passKeysFile: "macro-xb-pass-keys.json", evidenceFile: "evidence-macro-x.json" },
  { id: "macro-xc", title: "AP Macroeconomics MA3 x-c 설명·다변수 보충 9", itemsFile: "macro-xc-items.json", loadLabel: "macro-xc-2026-10-19", supplement: true, passKeysFile: "macro-xc-pass-keys.json", evidenceFile: "evidence-macro-x.json" },
  { id: "macro-xd", title: "AP Macroeconomics MA3 x-d 단원 6 비교 보충 2", itemsFile: "macro-xd-items.json", loadLabel: "macro-xd-2026-10-19", supplement: true, passKeysFile: "macro-xd-pass-keys.json", evidenceFile: "evidence-macro-x.json" },
  { id: "macro-xf", title: "AP Macroeconomics MA3 x-f FRQ 재생성(긴 열린 경제 + 짧은 3유형)", itemsFile: "macro-xf-items.json", loadLabel: "macro-xf-2026-10-19", supplement: true, passKeysFile: "macro-xf-pass-keys.json", evidenceFile: "evidence-macro-x.json" },
  // 2026-10-19 한계 보완 A1(MA3 그림·표 비율 14% → 40%): 새 그림 원형 16(시계열 선 그래프·가격통제 그래프·AD 이동폭·필립스 이동·교차가격·예금창출·채권가격·누진 세수·성장 원천·부채 표). 교체안: data/ap/stock/ma3-v2-swap-plan.json(MA3 v1 → v2, 16칸), 구성: exact-assign-macro-ma3-v2.json, 설계표: design-table-macro-ma3-v2.json
  { id: "macro-fga", title: "AP Macroeconomics MA3 v2 그림·표 보강(새 그림 원형 16, 통과 44)", itemsFile: "macro-fga-items.json", loadLabel: "macro-fga-2026-10-19", supplement: true, passKeysFile: "macro-fga-pass-keys.json", evidenceFile: "evidence-macro-fg.json" },
  // 2026-10-14 AP Macroeconomics(docs/ap/macroeconomics-groundwork.md): 파일럿 2 + P2 3 + 보충 1배치. 한 증거 파일(evidence-macro-s2.json)을 공유한다. MA1·MA2 정확 배정: data/ap/stock/exact-assign-macro-ma1-ma2.json
  { id: "macro-p1a", title: "AP Macroeconomics P1-a (MC 파일럿) (통과 37)", itemsFile: "macro-p1a-items.json", loadLabel: "macro-p1a-2026-10-14", supplement: true, passKeysFile: "macro-p1a-pass-keys.json", evidenceFile: "evidence-macro-s2.json" },
  { id: "macro-p1b", title: "AP Macroeconomics P1-b (FRQ 파일럿) (통과 5)", itemsFile: "macro-p1b-items.json", loadLabel: "macro-p1b-2026-10-14", supplement: true, passKeysFile: "macro-p1b-pass-keys.json", evidenceFile: "evidence-macro-s2.json" },
  { id: "macro-p2a", title: "AP Macroeconomics P2 MC-a (통과 85)", itemsFile: "macro-p2a-items.json", loadLabel: "macro-p2a-2026-10-14", supplement: true, passKeysFile: "macro-p2a-pass-keys.json", evidenceFile: "evidence-macro-s2.json" },
  { id: "macro-p2b", title: "AP Macroeconomics P2 MC-b (통과 62)", itemsFile: "macro-p2b-items.json", loadLabel: "macro-p2b-2026-10-14", supplement: true, passKeysFile: "macro-p2b-pass-keys.json", evidenceFile: "evidence-macro-s2.json" },
  { id: "macro-p2f", title: "AP Macroeconomics P2 FRQ (통과 9)", itemsFile: "macro-p2f-items.json", loadLabel: "macro-p2f-2026-10-14", supplement: true, passKeysFile: "macro-p2f-pass-keys.json", evidenceFile: "evidence-macro-s2.json" },
  { id: "macro-p3", title: "AP Macroeconomics P3 MC 보충(마지막 부족 칸) (통과 5)", itemsFile: "macro-p3-items.json", loadLabel: "macro-p3-2026-10-14", supplement: true, passKeysFile: "macro-p3-pass-keys.json", evidenceFile: "evidence-macro-s2.json" },
  // 2026-10-15 AP Macroeconomics macro-hard(exam_prep 보강, docs/ap/macroeconomics-groundwork.md §8): 2배치. 증거 파일은 evidence-macro-hard.json. MA1·MA2 v3 정확 배정: data/ap/stock/exact-assign-macro-ma1-ma2-v3.json
  { id: "macro-hard-a", title: "AP Macroeconomics hard-a exam_prep 보강 (단원 1·2·4·6 다단계 계산·해석) (통과 42)", itemsFile: "macro-hard-a-items.json", loadLabel: "macro-hard-a-2026-10-15", supplement: true, passKeysFile: "macro-hard-a-pass-keys.json", evidenceFile: "evidence-macro-hard.json" },
  { id: "macro-hard-b", title: "AP Macroeconomics hard-b exam_prep 보강 (단원 3·4·5·6 다단계 계산·해석) (통과 29)", itemsFile: "macro-hard-b-items.json", loadLabel: "macro-hard-b-2026-10-15", supplement: true, passKeysFile: "macro-hard-b-pass-keys.json", evidenceFile: "evidence-macro-hard.json" },
  // 2026-10-14 AP Psychology(docs/ap/psychology-groundwork.md): 파일럿 2 + 본 실행 + 보강 3배치. 한 증거 파일(evidence-psych-s2.json)을 공유한다. PS1·PS2 정확 배정: data/ap/stock/exact-assign-psych-ps1-ps2.json
  { id: "psych-p1a", title: "AP Psychology P1-a MC 파일럿 (통과 52)", itemsFile: "psych-p1a-items.json", loadLabel: "psych-p1a-2026-10-14", supplement: true, passKeysFile: "psych-p1a-pass-keys.json", evidenceFile: "evidence-psych-s2.json" },
  { id: "psych-p1b", title: "AP Psychology P1-b FRQ (통과 5)", itemsFile: "psych-p1b-items.json", loadLabel: "psych-p1b-2026-10-14", supplement: true, passKeysFile: "psych-p1b-pass-keys.json", evidenceFile: "evidence-psych-s2.json" },
  { id: "psych-p2a", title: "AP Psychology P2 MC 본 실행 (통과 138)", itemsFile: "psych-p2a-items.json", loadLabel: "psych-p2a-2026-10-14", supplement: true, passKeysFile: "psych-p2a-pass-keys.json", evidenceFile: "evidence-psych-s2.json" },
  { id: "psych-p3a", title: "AP Psychology P3 MC 세트 보강 (통과 2)", itemsFile: "psych-p3a-items.json", loadLabel: "psych-p3a-2026-10-14", supplement: true, passKeysFile: "psych-p3a-pass-keys.json", evidenceFile: "evidence-psych-s2.json" },
  { id: "psych-p3b", title: "AP Psychology P3 FRQ(EBQ) 보강 (통과 2)", itemsFile: "psych-p3b-items.json", loadLabel: "psych-p3b-2026-10-14", supplement: true, passKeysFile: "psych-p3b-pass-keys.json", evidenceFile: "evidence-psych-s2.json" },
  { id: "psych-p4a", title: "AP Psychology P4 MC 세트·연구 방법 보강 (통과 9)", itemsFile: "psych-p4a-items.json", loadLabel: "psych-p4a-2026-10-14", supplement: true, passKeysFile: "psych-p4a-pass-keys.json", evidenceFile: "evidence-psych-s2.json" },
  // 2026-10-15 AP Psychology psych-hard(docs/ap/psychology-groundwork.md §9, docs/ap/psychology-difficulty-audit.md): 다단계·고차 원형(응용 체인·연구 설계 평가·코드 계산 자료 해석) + 표 비율 정수 인원 수정 세트. 한 증거 파일(evidence-psych-hard.json)을 공유한다. PS1·PS2 v3 배정: data/ap/stock/exact-assign-psych-ps1-ps2-v3.json, 새 버전 계획: ps1-v3-swap-plan.json·ps2-v3-swap-plan.json
  { id: "psych-hard-a", title: "AP Psychology psych-hard-a 다단계 개념 적용 MC (통과 70)", itemsFile: "psych-hard-a-items.json", loadLabel: "psych-hard-a-2026-10-15", supplement: true, passKeysFile: "psych-hard-a-pass-keys.json", evidenceFile: "evidence-psych-hard.json" },
  { id: "psych-hard-b", title: "AP Psychology psych-hard-b 연구 설계·자료 해석 MC·수정 세트 (통과 69)", itemsFile: "psych-hard-b-items.json", loadLabel: "psych-hard-b-2026-10-15", supplement: true, passKeysFile: "psych-hard-b-pass-keys.json", evidenceFile: "evidence-psych-hard.json" },
  // 2026-10-19 AP Psychology PS3(추가 라운드): 새 공유 세트 원형 2종 중 통과 1종(pss_u4_dissonance_pay, 3문항). 화면 증거는 아직 없다(적재 뒤 관리자 화면 기록 필요). PS3 정확 배정: data/ap/stock/exact-assign-psych-ps3.json
  { id: "psych-r19", title: "AP Psychology r19 공유 세트 보강 (통과 1세트: 인지 부조화·평가자 맹검)", itemsFile: "psych-r19-items.json", loadLabel: "psych-r19-2026-10-19", supplement: true, passKeysFile: "psych-r19-pass-keys.json", evidenceFile: "evidence-psych-r19.json" },
  // 2026-10-14 AP U.S. History(docs/ap/ushistory-groundwork.md): 파일럿 + 본 실행 + 퀀트 보충 + FRQ(SAQ 3유형·DBQ·LEQ). 한 증거 파일(evidence-ush-s2.json)을 공유한다. US1·US2 정확 배정: data/ap/stock/exact-assign-ushistory-us1-us2.json
  { id: "ush-p1a", title: "AP U.S. History P1-a MC 파일럿 (통과 세트 2)", itemsFile: "ush-p1a-items.json", loadLabel: "ush-p1a-2026-10-14", supplement: true, passKeysFile: "ush-p1a-pass-keys.json", evidenceFile: "evidence-ush-s2.json" },
  { id: "ush-p2a", title: "AP U.S. History P2 MC 본 실행 (통과 세트 48)", itemsFile: "ush-p2a-items.json", loadLabel: "ush-p2a-2026-10-14", supplement: true, passKeysFile: "ush-p2a-pass-keys.json", evidenceFile: "evidence-ush-s2.json" },
  { id: "ush-p3a", title: "AP U.S. History P3 MC 보충(표·그래프 자료 중심) (통과 세트 24)", itemsFile: "ush-p3a-items.json", loadLabel: "ush-p3a-2026-10-14", supplement: true, passKeysFile: "ush-p3a-pass-keys.json", evidenceFile: "evidence-ush-s2.json" },
  { id: "ush-p1b", title: "AP U.S. History FRQ (SAQ·DBQ·LEQ) (통과 10)", itemsFile: "ush-p1b-items.json", loadLabel: "ush-p1b-2026-10-14", supplement: true, passKeysFile: "ush-p1b-pass-keys.json", evidenceFile: "evidence-ush-s2.json" },
  // 2026-10-15 US History Stage A(docs/ap/ushistory-groundwork.md "Stage A"): US1 saq3_1·u747 과 US2 saq3_3·u719 의 가공 표를 실제 Census 자료로 교체하는 4건. 새 버전 계획: data/ap/stock/us1-v2-real-a-swap-plan.json, us2-v2-real-a-swap-plan.json
  { id: "ush-real-a", title: "AP U.S. History Stage A 실제 Census 자료 4건 (MC 세트 2 + SAQ3 2)", itemsFile: "ush-real-a-items.json", loadLabel: "ush-real-a-2026-10-15", supplement: true, passKeysFile: "ush-real-a-pass-keys.json", evidenceFile: "evidence-ush-real-a.json" },
  // 2026-10-15 US History Stage B(docs/ap/ushistory-groundwork.md §10): 게시 US2 dbq_1·US1 dbq_2 의 가공 문서 7개 세트를 실제 자료 7개 DBQ 로 교체하는 2건. 새 버전 계획: data/ap/stock/us2-v3-real-b-swap-plan.json, us1-v3-real-b-swap-plan.json. 한 증거 파일(evidence-ush-real-b.json).
  { id: "ush-real-b", title: "AP U.S. History Stage B 실제 자료 DBQ 2건 (US2 시장 혁명 + US1 기업 규제)", itemsFile: "ush-real-b-items.json", loadLabel: "ush-real-b-2026-10-15", supplement: true, passKeysFile: "ush-real-b-pass-keys.json", evidenceFile: "evidence-ush-real-b.json" },
  // 2026-10-15 US History Stage C(docs/ap/ushistory-groundwork.md §11): 게시 US2 u526·u408 과 US1 u528·u531 의 ALTON 작성 1차 자료 세트 4개를 실제 1차 자료 세트로 교체. 새 버전 계획: data/ap/stock/us1-v4-real-cd-swap-plan.json, us2-v4-real-cd-swap-plan.json(Stage D 와 한 계획). 한 증거 파일(evidence-ush-real-c.json).
  { id: "ush-real-c", title: "AP U.S. History Stage C 실제 1차 자료 MC 세트 4건 (Emancipation·Monroe·Fugitive Slave Act·Richmond diary)", itemsFile: "ush-real-c-items.json", loadLabel: "ush-real-c-2026-10-15", supplement: true, passKeysFile: "ush-real-c-pass-keys.json", evidenceFile: "evidence-ush-real-c.json" },
  // 2026-10-15 US History Stage D(§11): 게시 US2 u527·u720 과 US1 u616 의 2차 자료(텍스트) MC 세트 3개를 실제 지도·만평 세트로 교체(US2 u617 은 변환하지 않음). 한 증거 파일(evidence-ush-real-d.json).
  { id: "ush-real-d", title: "AP U.S. History Stage D 실제 지도·만평 MC 세트 3건 (Reynolds 1856·School Begins 1899·Indian reservations 1892)", itemsFile: "ush-real-d-items.json", loadLabel: "ush-real-d-2026-10-15", supplement: true, passKeysFile: "ush-real-d-pass-keys.json", evidenceFile: "evidence-ush-real-d.json" },
  // 2026-10-15 AP World History: Modern(docs/ap/worldhistory-groundwork.md): 실제 자료 우선 파이프라인. 파일럿 MC 4세트 + 본 MC 26세트 + FRQ 10(SAQ 6·DBQ 2·LEQ 2). 한 증거 파일(evidence-wh-s1.json)을 공유한다. WH1·WH2 정확 배정: data/ap/stock/exact-assign-worldhistory-wh1-wh2.json
  { id: "wh-p1", title: "AP World History P1 MC 파일럿 (실제 자료 4세트)", itemsFile: "wh-p1-items.json", loadLabel: "wh-p1-2026-10-15", supplement: true, passKeysFile: "wh-p1-pass-keys.json", evidenceFile: "evidence-wh-s1.json" },
  { id: "wh-m1", title: "AP World History MC 본 실행 (실제 자료 26세트)", itemsFile: "wh-m1-items.json", loadLabel: "wh-m1-2026-10-15", supplement: true, passKeysFile: "wh-m1-pass-keys.json", evidenceFile: "evidence-wh-s1.json" },
  { id: "wh-m2", title: "AP World History MC 재시도 (Ghana 세트 w114)", itemsFile: "wh-m2-items.json", loadLabel: "wh-m2-2026-10-15", supplement: true, passKeysFile: "wh-m2-pass-keys.json", evidenceFile: "evidence-wh-s1.json" },
  { id: "wh-f2", title: "AP World History FRQ 재생성(SAQ·DBQ·LEQ, 실제 자료)", itemsFile: "wh-f2-items.json", loadLabel: "wh-f2-2026-10-15", supplement: true, passKeysFile: "wh-f2-pass-keys.json", evidenceFile: "evidence-wh-s1.json" },
  { id: "wh-f3", title: "AP World History FRQ 재생성 2(실제 자료)", itemsFile: "wh-f3-items.json", loadLabel: "wh-f3-2026-10-15", supplement: true, passKeysFile: "wh-f3-pass-keys.json", evidenceFile: "evidence-wh-s1.json" },
  { id: "wh-f4", title: "AP World History FRQ 재생성 3(실제 자료)", itemsFile: "wh-f4-items.json", loadLabel: "wh-f4-2026-10-15", supplement: true, passKeysFile: "wh-f4-pass-keys.json", evidenceFile: "evidence-wh-s1.json" },
  { id: "wh-f1", title: "AP World History FRQ (SAQ·DBQ·LEQ, 실제 자료)", itemsFile: "wh-f1-items.json", loadLabel: "wh-f1-2026-10-15", supplement: true, passKeysFile: "wh-f1-pass-keys.json", evidenceFile: "evidence-wh-s1.json" },
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
  // 2026-10-14 AP Biology v2(exam_prep 보강, docs/ap/biology-groundwork.md §11): 3배치. 증거 파일은 evidence-bio-v2.json. BI1·BI2 정확 배정: data/ap/stock/exact-assign-bio-bi1-bi2-v3.json
  { id: "bio-v2a", title: "AP Biology v2a exam_prep 보강 (Practice 5 다단계 계산·고친 세트) (통과 62)", itemsFile: "bio-v2a-items.json", loadLabel: "bio-v2a-2026-10-14", supplement: true, passKeysFile: "bio-v2a-pass-keys.json", evidenceFile: "evidence-bio-v2.json" },
  { id: "bio-v2b", title: "AP Biology v2b exam_prep 보강 (예측·근거·모델 해석) (통과 27)", itemsFile: "bio-v2b-items.json", loadLabel: "bio-v2b-2026-10-14", supplement: true, passKeysFile: "bio-v2b-pass-keys.json", evidenceFile: "evidence-bio-v2.json" },
  { id: "bio-v2c", title: "AP Biology v2c exam_prep 보강 (단원 1·2·4 자료 서술·예측) (통과 17)", itemsFile: "bio-v2c-items.json", loadLabel: "bio-v2c-2026-10-14", supplement: true, passKeysFile: "bio-v2c-pass-keys.json", evidenceFile: "evidence-bio-v2.json" },
  // 2026-10-15 AP Biology 주제 분산(docs/ap/biology-topic-spread.md): FRQ 시나리오 14개(유전·진화·세포 소통·생태) + P3/P4 MC 11개. 증거 파일은 evidence-bio-v3.json. BI1·BI2 정확 배정: data/ap/stock/exact-assign-bio-bi1-bi2-v4.json
  { id: "bio-v3a", title: "AP Biology v3a 주제 분산 FRQ 시나리오 (통과 12)", itemsFile: "bio-v3a-items.json", loadLabel: "bio-v3a-2026-10-15", supplement: true, passKeysFile: "bio-v3a-pass-keys.json", evidenceFile: "evidence-bio-v3.json" },
  { id: "bio-v3b", title: "AP Biology v3b 주제 분산 MC (Practice 3·4) (통과 12)", itemsFile: "bio-v3b-items.json", loadLabel: "bio-v3b-2026-10-15", supplement: true, passKeysFile: "bio-v3b-pass-keys.json", evidenceFile: "evidence-bio-v3.json" },
  { id: "bio-v3c", title: "AP Biology v3c 주제 분산 재시도 (MC 4 원형·FRQ 3 시나리오) (통과 13)", itemsFile: "bio-v3c-items.json", loadLabel: "bio-v3c-2026-10-15", supplement: true, passKeysFile: "bio-v3c-pass-keys.json", evidenceFile: "evidence-bio-v3.json" },
  // 2026-10-19 AP Biology BI3·BI4(docs/ap/ap-bi-ph-ch-expansion-20261019.md): 공개 세트와 풀이 틀(원형)이 겹치지 않는 세트 2개 — 새 원형 30(P1·P2·P6) + 새 4문항 세트 1 + 라이브러리 미생성 원형. 증거 파일은 evidence-bio-b34.json. BI3·BI4 정확 배정: data/ap/stock/exact-assign-bio-bi3-bi4.json
  { id: "bio-b34a", title: "AP Biology b34a BI3·BI4 새 원형·미생성 원형 MC (통과 64)", itemsFile: "bio-b34a-items.json", loadLabel: "bio-b34a-2026-10-19", supplement: true, passKeysFile: "bio-b34a-pass-keys.json", evidenceFile: "evidence-bio-b34.json" },
  { id: "bio-b34b", title: "AP Biology b34b BI3·BI4 2차 MC (새 원형 14 포함) (통과 36)", itemsFile: "bio-b34b-items.json", loadLabel: "bio-b34b-2026-10-19", supplement: true, passKeysFile: "bio-b34b-pass-keys.json", evidenceFile: "evidence-bio-b34.json" },
  { id: "bio-b34bf", title: "AP Biology b34bf BI4 FRQ 시나리오 (통과 1)", itemsFile: "bio-b34bf-items.json", loadLabel: "bio-b34bf-2026-10-19", supplement: true, passKeysFile: "bio-b34bf-pass-keys.json", evidenceFile: "evidence-bio-b34.json" },
  { id: "bio-b34c", title: "AP Biology b34c 3차 MC (통과 1)", itemsFile: "bio-b34c-items.json", loadLabel: "bio-b34c-2026-10-19", supplement: true, passKeysFile: "bio-b34c-pass-keys.json", evidenceFile: "evidence-bio-b34.json" },
  { id: "bio-b34d", title: "AP Biology b34d 새 4문항 세트 (세포 주기 표) (통과 3)", itemsFile: "bio-b34d-items.json", loadLabel: "bio-b34d-2026-10-19", supplement: true, passKeysFile: "bio-b34d-pass-keys.json", evidenceFile: "evidence-bio-b34.json" },
  // 2026-10-19 BI3·BI4 재배정(r2): 원격 SELECT 로 읽은 현재 공개 Biology 1·2 의 실제 문항·원형을 막고 다시 배정. 비는 4칸(단원6×P1, 단원7×P1 2, 단원7×P2)용 새 원형 4. 증거 파일 evidence-bio-b34r2.json. 정확 배정: data/ap/stock/exact-assign-bio-bi3-bi4-r2.json
  { id: "bio-b34e", title: "AP Biology b34e BI3·BI4 r2 새 원형 MC (유전자 조절·자연선택·생식적 격리) (통과 7)", itemsFile: "bio-b34e-items.json", loadLabel: "bio-b34e-2026-10-19", supplement: true, passKeysFile: "bio-b34e-pass-keys.json", evidenceFile: "evidence-bio-b34r2.json" },
  { id: "bio-b34f", title: "AP Biology b34f BI3·BI4 r2 새 원형 MC (대립유전자 빈도 그래프) (통과 1)", itemsFile: "bio-b34f-items.json", loadLabel: "bio-b34f-2026-10-19", supplement: true, passKeysFile: "bio-b34f-pass-keys.json", evidenceFile: "evidence-bio-b34r2.json" },
  // 2026-10-14 AP English Language(docs/ap/englang-groundwork.md §9): 파일럿(MC 지문 묶음 3 + FRQ 3) + P2 MC 14묶음 + FRQ 3. 한 증거 파일(evidence-el.json)을 공유한다. EL1 정확 배정: data/ap/stock/exact-assign-el-el1.json
  { id: "el-p1", title: "AP English Language P1 (MC 파일럿 묶음 3 + FRQ 3)", itemsFile: "el-p1-items.json", loadLabel: "el-p1-2026-10-14", supplement: true, passKeysFile: "el-p1-pass-keys.json", evidenceFile: "evidence-el.json" },
  { id: "el-p2a", title: "AP English Language P2 MC (지문 묶음 14: 읽기 7 + 글쓰기 7)", itemsFile: "el-p2a-items.json", loadLabel: "el-p2a-2026-10-14", supplement: true, passKeysFile: "el-p2a-pass-keys.json", evidenceFile: "evidence-el.json" },
  { id: "el-p2b", title: "AP English Language P2 FRQ (종합·수사 분석·논증 각 1)", itemsFile: "el-p2b-items.json", loadLabel: "el-p2b-2026-10-14", supplement: true, passKeysFile: "el-p2b-pass-keys.json", evidenceFile: "evidence-el.json" },
  // 2026-10-14 EL1/EL2 독립 검수 수정본(docs/ap/englang-review-report.md): 원본 28개(MC 22 묶음 + FRQ 6)와 같은 칸의 교정 후보. 적재 뒤 el1/el2-review-v2-swap-plan.json 으로 새 버전을 만든다.
  { id: "el-rv", title: "AP English Language 검수 수정본 (MC 묶음 22 + FRQ 6)", itemsFile: "el-rv-items.json", loadLabel: "el-rv-2026-10-14", supplement: true, passKeysFile: "el-rv-pass-keys.json", evidenceFile: "evidence-el-rv.json" },
  // 2026-10-15 EL 공식 5묶음 구조(docs/ap/englang-structure-audit.md): 검증된 el-rv 묶음 8개에 문항을 더해 읽기 11–13문항·글쓰기 7–9문항으로 확장한 묶음(MC 8). EL1·EL2 정확 배정: data/ap/stock/exact-assign-el-long-el1-el2.json
  { id: "el-long", title: "AP English Language 공식 5묶음 구조 장문 묶음 (MC 8: 읽기 4 + 글쓰기 4)", itemsFile: "el-long-items.json", loadLabel: "el-long-2026-10-15", supplement: true, passKeysFile: "el-long-pass-keys.json", evidenceFile: "evidence-el-long.json" },
  // 2026-10-14 EL2 보충(s2a 8묶음 + s2b 4묶음). 증거 파일 evidence-el-supp.json. EL1·EL2 정확 배정: data/ap/stock/exact-assign-el-el1-el2.json
  { id: "el-s2a", title: "AP English Language s2a MC (EL2 보충: 읽기 6 + 글쓰기 2묶음) (통과 27)", itemsFile: "el-s2a-items.json", loadLabel: "el-s2a-2026-10-14", supplement: true, passKeysFile: "el-s2a-pass-keys.json", evidenceFile: "evidence-el-supp.json" },
  { id: "el-s2b", title: "AP English Language s2b MC (EL2 보충 top-up: 읽기 2 + 글쓰기 2묶음) (통과 17)", itemsFile: "el-s2b-items.json", loadLabel: "el-s2b-2026-10-14", supplement: true, passKeysFile: "el-s2b-pass-keys.json", evidenceFile: "evidence-el-supp.json" },
  // 2026-10-15 AP English Literature(docs/ap/englit-groundwork.md): 파일럿 지문 묶음 1(p0) + MC 지문 묶음 11(p1a 시 5·단편 4·장편 2)·FRQ 6(p1b)·장편 1(p1c). 한 증거 파일(evidence-lt.json)을 공유한다. LT1·LT2 정확 배정: data/ap/stock/exact-assign-englit-lt1-lt2.json
  { id: "lt-p0", title: "AP English Literature P0 MC (파일럿 단편 묶음 1)", itemsFile: "lt-p0-items.json", loadLabel: "lt-p0-2026-10-15", supplement: true, passKeysFile: "lt-p0-pass-keys.json", evidenceFile: "evidence-lt.json" },
  { id: "lt-p1a", title: "AP English Literature P1-a MC (지문 묶음 11: 시 5 + 단편 4 + 장편·희곡 2)", itemsFile: "lt-p1a-items.json", loadLabel: "lt-p1a-2026-10-15", supplement: true, passKeysFile: "lt-p1a-pass-keys.json", evidenceFile: "evidence-lt.json" },
  { id: "lt-p1b", title: "AP English Literature P1-b FRQ (시 분석·산문 분석·문학 논증 각 2)", itemsFile: "lt-p1b-items.json", loadLabel: "lt-p1b-2026-10-15", supplement: true, passKeysFile: "lt-p1b-pass-keys.json", evidenceFile: "evidence-lt.json" },
  { id: "lt-p1c", title: "AP English Literature P1-c MC (장편 묶음 1)", itemsFile: "lt-p1c-items.json", loadLabel: "lt-p1c-2026-10-15", supplement: true, passKeysFile: "lt-p1c-pass-keys.json", evidenceFile: "evidence-lt.json" },
  // 2026-10-15 AP English Literature Stage 1 실제 작품(공유 영역) 3건: LT1 시 세트 p03 → Dickinson, LT1 FRQ Q1 → Hopkins, LT2 FRQ Q2 → Chekhov(docs/ap/englit-groundwork.md "Stage 1"). 새 버전 계획: data/ap/stock/lt1-v2-real-1-swap-plan.json, lt2-v2-real-1-swap-plan.json
  { id: "lt-real-1", title: "AP English Literature Stage 1 실제 작품 3건 (시 MC 세트 1 + FRQ Q1·Q2)", itemsFile: "lt-real-1-items.json", loadLabel: "lt-real-1-2026-10-15", supplement: true, passKeysFile: "lt-real-1-pass-keys.json", evidenceFile: "evidence-lt-real-1.json" },
  // 2026-10-15 AP English Literature Stage 2 실제 작품(공유 영역) 5건: LT1 단편 세트 s05 → Chopin, LT1 장편 세트 l04 → Austen, LT1 FRQ Q2 → Crane, LT2 시 세트 p05 → Arnold, LT2 희곡 세트 l01 → Ibsen(docs/ap/englit-groundwork.md "Stage 2"). 새 버전 계획(게시 v2 → v3): data/ap/stock/lt1-v3-real-2-swap-plan.json, lt2-v3-real-2-swap-plan.json
  { id: "lt-real-2", title: "AP English Literature Stage 2 실제 작품 5건 (MC 세트 4 + FRQ Q2)", itemsFile: "lt-real-2-items.json", loadLabel: "lt-real-2-2026-10-15", supplement: true, passKeysFile: "lt-real-2-pass-keys.json", evidenceFile: "evidence-lt-real-2.json" },
  // 2026-10-15 외부 AP 전체 검수 확정 수정본(docs/audits/ap-external-audit-20261015-confirmed-fixes.csv): 게시 문항은 불변이라 고친 복제 후보(Micro·Bio·Stats·Physics 11건)를 새 후보로 두고 *-audit-1015-swap-plan.json 으로 칸을 교체한다.
  { id: "supp-fix1015", title: "AP 외부 검수 수정본 (Micro 1·Bio 5·Stats 4·Physics 1)", itemsFile: "supp-fix1015-items.json", loadLabel: "supp-fix1015-2026-10-15", supplement: true, passKeysFile: "supp-fix1015-pass-keys.json", evidenceFile: "evidence-fix1015.json" },
  // 2026-10-19 외부 AP 검수 유형 단위 수정(scripts/audit/ap-audit-typefix-1019.ts): 원형 결함을 고쳐도 저장된 문항은 그대로라서, 같은 결함 유형의 *공개* 문항 복제 후보(Bio 4·Chem 2·Micro 1·Stats 2·Calc 2)를 새 후보로 두고 *-audit-1019-swap-plan.json 으로 칸을 교체한다.
  { id: "supp-fix1019", title: "AP 외부 검수 유형 단위 수정본 (Bio 4·Chem 2·Micro 1·Stats 2·Calc 2)", itemsFile: "supp-fix1019-items.json", loadLabel: "supp-fix1019-2026-10-19", supplement: true, passKeysFile: "supp-fix1019-pass-keys.json", evidenceFile: "evidence-fix1019.json" },
  // 2026-10-20 BC 확대(BC4·BC5): 공개 세트와 풀이 틀이 다른 새 원형 39종(MC 32·FRQ 7) 후보. 통과 키 = 두 신규 세트에 배정된 신규 문항(화면 증거 보유). 배정: data/ap/stock/exact-assign-bc-bc4.json, exact-assign-bc-bc5.json
  { id: "bcx1", title: "AP Calculus BC 확대 BC4·BC5 신규 원형 (MC·FRQ)", itemsFile: "bcx1-items.json", loadLabel: "bcx1-2026-10-20", supplement: true, passKeysFile: "bcx1-pass-keys.json", evidenceFile: "evidence-bcx1.json" },
  { id: "bc-topup", title: "BC 보충 (bc-topup)", itemsFile: "bc-topup-items.json", loadLabel: "bc-topup-2026-10-09", supplement: true, passKeysFile: "bc-topup-pass-keys.json", evidenceFile: "evidence-bc-topup.json" },
  // 2026-10-15 외부 AP 전체 검수 확정 수정(docs/audits/ap-external-audit-20261015-confirmed-fixes.csv) — World History(MC 세트 5 + FRQ 6)·US History(FRQ 4)·English Literature(FRQ 4) 수정본 19건. 원본과 같은 칸의 교정 후보이며 한 증거 파일을 공유한다. 새 버전 계획: data/ap/stock/wh1-v2-, wh2-v2-, us1-v5-, us2-v5-, lt1-v4-, lt2-v4-audit-wuel-swap-plan.json (scripts/ap-generation/audit-wuel-build.ts)
  { id: "audit-wuel", title: "AP 외부 검수 수정본 (World History·US History·English Literature, MC 5 + FRQ 14)", itemsFile: "audit-wuel-items.json", loadLabel: "audit-wuel-2026-10-15", supplement: true, passKeysFile: "audit-wuel-pass-keys.json", evidenceFile: "evidence-audit-wuel.json" },
  // 2026-10-15 외부 AP 검수 확정 수정 — CSA(FRQ 배점 7·7·5·6, 범위 밖 문항 교체, Practice 5 2문항) 14건과 Calculus AB·BC(전제·문구) 11건의 수정본. 한 증거 파일(evidence-aud1015.json)을 공유한다. 새 버전 계획: data/ap/stock/ab1-v5-, ab3-v3-, abfrq-v2-, bc1-v5-, bc2-v3-, bc3-v2-, csa1-v2-, csa2-v3-audit-aud1015-swap-plan.json (scripts/audit/ap-aud1015-csa-calc-build.py)
  { id: "csa-aud1015", title: "AP 외부 검수 수정본 (Computer Science A, FRQ 8 + MC 4 + Practice 5 신규 2)", itemsFile: "csa-aud1015-items.json", loadLabel: "csa-aud1015-2026-10-15", supplement: true, passKeysFile: "csa-aud1015-pass-keys.json", evidenceFile: "evidence-aud1015.json" },
  { id: "supp-aud1015-final", title: "AP 외부 검수 수정본 (Calculus AB·BC, 11건)", itemsFile: "supp-aud1015-items.json", loadLabel: "supp-aud1015-final-2026-10-15", supplement: true, passKeysFile: "supp-aud1015-pass-keys.json", evidenceFile: "evidence-aud1015.json" },
  // 2026-10-19 에세이 참고답 점수·설명 충돌 점검기(lib/ap-generation/essay-reference-check.ts) 교체 후보: EngLit fa2(LT2) low 샘플 헤딩 3/6→2/6. 새 버전 계획: data/ap/stock/lt2-v5-audit-score1019-swap-plan.json (scripts/ap-generation/audit-score1019-build.ts)
  { id: "audit-score1019", title: "AP 참고답 점수·설명 정정 (English Literature FRQ 1)", itemsFile: "audit-score1019-items.json", loadLabel: "audit-score1019-2026-10-19", supplement: true, passKeysFile: "audit-score1019-pass-keys.json", evidenceFile: "evidence-lt.json" },
  { id: "supp-aud1015b", title: "AP 외부 검수 수정본 (Calculus AB FRQ B 교정 복제 2건)", itemsFile: "supp-aud1015b-items.json", loadLabel: "supp-aud1015b-2026-10-19", supplement: true, passKeysFile: "supp-aud1015b-pass-keys.json", evidenceFile: "evidence-aud1015.json" },
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
