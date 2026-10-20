# AP Physics C: Electricity and Magnetism 원형·세트 저작 라운드 (2026-10-20)

범위: `docs/ap/new-subjects-plan-2026-10-20.md` §4.6 3번. 원격 DB 쓰기·시드 SQL 적용·공개는 하지 않았다(총괄이 한다).

## 1. 시험 형식 재확인(2026-10-20)
- AP Central 시험 페이지(`apcentral.collegeboard.org/courses/ap-physics-c-electricity-and-magnetism/exam`): MC 42문항·85분·50%, FRQ 4문항·95분·50%, 하이브리드 디지털(문제 Bluebook, FRQ 종이 손글씨), 계산기 허용, 2027-05-05 2교시. "MC 수와 시간이 2027 시험부터 갱신"이라고 명시.
- FRQ 유형 4(수학적 절차·표현 변환·실험 설계/분석·정성/정량 변환)와 배점 10/12/10/8은 CED(Course Framework V.1, 2026) 전문에서 읽은 값(`data/ap/curriculum-2027/ap_physics_c_electricity_and_magnetism.json`). 시험 페이지에는 배점이 없다.
- 단원 MC 비중(CED): 8 15–25, 9 10–20, 10 10–15, 11 15–25, 12 10–20, 13 10–20 % → 42문항 [7,10]/[5,8]/[5,6]/[7,10]/[5,8]/[5,8], 목표 8/6/5/9/7/7(`PHYSE_FULL_TARGET`). 스킬 비중 2.A 25–30·2.B 20–25·2.C 10–15·2.D 10–15·3.B 15–25·3.C 5–10 %(`PHYSE_MC_SKILL_PCT`, 차단하지 않는 경고).

## 2. 구성(Mechanics 방식 일반화)
- 도구: `physe_common.py`(상수 k·ε0·μ0·e 와 단위 TeX), 원형 모듈 `physe_p0_{a..e,h,i,j,k,l,m,n,o,q}.py`·`physe_p0_frq{,2,3}.py`·`physe_p0_fix.py`(재생성 목록). 접두 `pe_`(단독)·`pes_`(2문항 세트)·`pef_`(FRQ). `registry.py` 가 자동 등록(`physe_*` 목록, `guide-physe`).
- 정답은 sympy 기호 풀이와 수치 적분·중심 차분·RK4·이분법·선형계로 이중 계산. 오답은 이름 붙은 오개념, 선택지 8% 이상 간격, 필요한 상수는 본문에 적는다.
- 연결: `lib/ap-generation/subjects/physics-c-em{,-archetypes.json}.ts`, `pipeline2.ts`(가이드·검토 노트·라벨), `gates.ts`·`stats-set.ts`·`ap-figures/gate.ts`·`full-set-rules.ts`(E&M 단원·스킬 비중, `physUnitBounds/physFullTarget/physSkillBounds(subject)`), `phys-assign.ts`(`PHYS_SUBJECT=ap_physics_c_electricity_and_magnetism`), `local-demo-seed.ts`, `keys-file.ts`(STOCK_FILES), `lib/ap-admin/batches.ts`(배치 9개).
- 테스트: `lib/ap-generation/physics-c-em-archetypes.test.ts`(TS 게이트·설계도·가이드 일관성).

## 3. 결과
- 원형: 단독 MC 약 190 + 2문항 세트 12 + FRQ 20 시나리오(유형당 5). 생성 런 `config/ap-frozen/physe-{mc,s,f,b,fix1,c,fix2,d,fix3}.v1.json`.
- 세트 5개 `EM1–EM5`(`data/ap/stock/exact-assign-physe-em1-em5.json`): MC 42 = 단독 38 + 2문항 세트 2, FRQ 4(MR·TBR·LAB·QQT 각 1), 단원 8/6/5/9/7/7(±1 범위 안), 가상 칸 0, 독립 검증기 위반 0, 세트 간 문항 겹침 0. 스킬 비중은 EM4·EM5 가 2.B 편중(비차단 경고).
- 화면 증거: 격리 스택(`ALTON_pe9`, 오프셋 900)에서 233건·516항목 전부 통과(`data/ap/screen-evidence/evidence-physe.json`, 스크린샷 `docs/ap/screen-evidence/physe/`). 자동 점검(표시·입력·노출·잘림)이며 그래프 의미·문장 자연스러움 검토가 아니다.
- 실제 비용 $22.01(원장 474.8664 → 496.8784).

## 4. 남은 연결(총괄)
시드 SQL(`data/ap/seed-sql/ap_physics_c_electricity_and_magnetism.*`)·마이그레이션 `…620` 원격 적용, `SET_PREFIX_SUBJECT`(`EM`)·`assemble-phys-draft.ts` 과목 일반화, 배치 적재, `AP_PENDING_PUBLIC_SUBJECTS` 해제. 공개 전 점검: 참조 정보(식 시트) 패널 비어 있음(본문이 상수를 적는다), 사람의 그래프 의미 검토.
