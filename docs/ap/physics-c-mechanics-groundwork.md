# AP Physics C: Mechanics 원형·세트 저작 라운드 (2026-10-20)

범위: `docs/ap/new-subjects-plan-2026-10-20.md` §4.6 착수 순서 1번. 원격 DB 쓰기·시드 SQL 적용·공개·Production 은 하지 않았다(총괄이 한다). 이 문서는 시험 형식 확인 결과, 원형 구성, 파이프라인 연결, 결과를 한곳에 둔다. 최종 수치(통과 수·배정·비용)는 아래 "결과" 절에 있다.

## 1. 시험 형식 확인(2026-10-20 읽음)

| 항목 | 값 | 출처 |
|---|---|---|
| MC | 42문항 / 85분 / 50% | AP Central 과목 시험 페이지(`apcentral.collegeboard.org/courses/ap-physics-c-mechanics/exam`: "42 Questions \| 85 Minutes", 문항 수·시간이 "May 2027 시험부터" 갱신됐다고 명시), AP Students 평가 페이지(`apstudents.collegeboard.org/courses/ap-physics-c-mechanics/assessment`: "42 questions, 1 hour 25 minutes") |
| FRQ | 4문항 / 95분 / 50% | 같은 두 페이지("4 Questions \| 95 Minutes", "1 hour 35 minutes") |
| 전달 | 하이브리드 디지털: 문제는 Bluebook, FRQ 답은 종이 손글씨 | AP Students 페이지 |
| 계산기 | 허용 | 두 페이지 |
| 2027 시험일 | 2027-05-03 1교시 | 두 페이지 |

- **확인된 것**: 42/85, 4/95 는 College Board 공식 페이지 두 곳에서 직접 확인했다(계획서의 "간접 확인" 해소). 일부 서드파티 페이지의 "40/80, 4/100" 은 2026 시험(구형식)이다.
- **확인 못 한 것**: FRQ 문항별 배점·유형(MR/TBR/EDA/QQT 가정), MC 스킬 비중, 참조 정보(식 시트) 본문. CED 전문(10MB 초과)과 Exam Updates PDF 를 읽지 못했다. **2026-10-20 갱신: FRQ 10/12/10/8점과 MC 50%·FRQ 50% 는 오너가 공식 자료로 확인했다(원문 페이지 번호는 미기재; `lib/ap-exam/layouts.ts` `AP_NEW_SUBJECT_FRQ_TYPES`·`AP_SECTION_WEIGHTS_PCT`).** 아래 "임시" 서술은 이 라운드 당시 기록이며 현재는 확정값이다. 당시에는 같은 계열 CED(Physics C: E&M·Physics 2)의 값을 임시로 쓴 것이며, 가이드·프롬프트·루브릭 모두 "provisional"로 표기했다. **공개 전 Mechanics CED 재확인 필요.**
- 단원 MC 비중(공식 범위, Course at a Glance 2026): 1 10–15 · 2 20–25 · 3 15–25 · 4 10–20 · 5 10–15 · 6 10–15 · 7 10–15 %. 42문항 환산 [5,6]/[9,10]/[7,10]/[5,8]/[5,6]/[5,6]/[5,6], 목표 배분 5/9/8/5/5/5/5(`lib/ap-exam/full-set-rules.ts` `PHYSC_*`). 7단원이고 유체가 없다(Physics 1 은 8단원).

## 2. 구성(Physics 1 재사용 방식)

- 도구: `phys_common.py`(이중 경로 보조·선택지 생성), `phys_sym.py`(기호식·순위), `phys_p0_frq.py`(행·FRQ 팩), `calc_ab_frq.py`(part/row). 과목 코드만 바꾼 `physc_common.py`(mk·pbp)를 두었다.
- 원형 모듈: `scripts/ap-generation/archetypes/physc_p0_{a..h}.py`(MC·세트), `physc_p0_frq.py`(FRQ). 접두 `pc_`(단독 MC)·`pcs_`(2문항 세트)·`pcf_`(FRQ). `registry.py` 가 `physc_p0_*.py` 를 자동 등록(`physc_u1…u7`, `physc_sets`, `physc_frq`, `physc_all`; `registry.py guide-physc`).
- 정답·수치는 코드가 이중 경로로 계산한다: sympy 도함수·적분 대 중심 차분·Simpson·RK4·이분법·numpy 선형계. 오답은 이름 붙은 오개념, 선택지 8% 이상 간격, 필요한 값은 모두 학생 화면 본문에 둔다.
- **미적분 풀이 단계**(Physics 1 에 없는 것): 위치·속도·가속도 다항식 미적분, 변하는 힘의 일·충격량 적분, 퍼텐셜 에너지에서 힘, 저항력(선형·이차) 종단 속력과 지수 접근, 연속체 질량 중심·회전 관성 적분, 회전 일(돌림힘 적분), 물리 진자, 단진동 미분 방정식.

| 단원 | 단독 원형 | 비고 |
|---|---|---|
| 1 운동학 | 13 | 다항식 미분·적분, 투사체, 상대 운동, 그래프 순위 |
| 2 힘과 병진 동역학 | 22 | 저항력 5, 원운동 3, 질량 중심 2(적분 포함), 마찰·경사면·장력 |
| 3 일·에너지·일률 | 20 | 변하는 힘 적분, U→F, 안정 평형, 일률 적분 |
| 4 선운동량 | 13 | 충격량 적분, 충돌, 탄동 진자 |
| 5 돌림힘·회전 역학 | 14 | 회전 관성 적분, 평행축, 도르래 |
| 6 회전계 에너지·운동량 | 14 | 각운동량 보존, 구름, 궤도, 탈출 속력 |
| 7 진동 | 14 | SHM ODE, 물리 진자, 에너지 |
| 2문항 세트 | 5 | F(x) 다항식·x(t) 3차·F(t) 사인·U(x) 포물선·v(t) 지수 |
| FRQ | 8 시나리오 | MR 2·TBR 2·LAB 2·QQT 2 |

## 3. 파이프라인 연결(코드)

- `lib/ap-generation/subjects/physics-c-mech.ts`(가이드) + `physics-c-mech-archetypes.json`(원형 가이드 항목), `pipeline2.ts`(프롬프트·단원 범위·SUBJECT NOTES·과목 라벨), `gates.ts`(MC 미평가 스킬 1.A·1.B·1.C·3.A, FRQ 프로필, est 시간), `ap-figures/gate.ts`(그래프 렌더 유형), `stats-set.ts`(세트 크기 2), `full-set-rules.ts`(C: Mechanics 단원 비중·`physUnitBounds(subject)`·`verifyPhysFullComposition(items, subject)`), `phys-assign.ts`·`phys-pool.ts`(`PHYS_SUBJECT=ap_physics_c_mechanics` 환경 변수로 7단원 배정).
- 테스트: `lib/ap-generation/physics-c-mech-archetypes.test.ts`(TS 게이트·설계도·가이드 일관성), `scripts/ap-generation/archetypes/test_physc_p0.py`(Python 이중 경로·구조).

## 4. 결과 (2026-10-20)

- **세트 5개 배정 완료**: `data/ap/stock/exact-assign-physc-pm1-pm5.json`(PM1–PM5, 세트당 MC 42 = 단독 38 + 2문항 세트 2, FRQ 4 = MR·TBR·LAB·QQT 각 1; 단원 5/9/8/5/5/5/5; 가상 칸 0; 독립 검증기(`verifyPhysAssignment`) 위반 0; 세트 간 문항 겹침 0 — 순차 풀이에서 앞 세트 문항을 막는다). 실행: `PHYS_SUBJECT=ap_physics_c_mechanics npx tsx scripts/ap-generation/phys-assign.ts --sets PM1,PM2,PM3,PM4,PM5 --no-screen --prefer-exam-prep --time-ms 90000 --write-report …`.
- 원형: 단독 MC 204 + 2문항 세트 11 + FRQ 20 시나리오(유형당 5)를 작성했고(4개 라운드), 검토를 통과한 재고로 위 5세트를 구성했다. 원형 단위 테스트: `lib/ap-generation/physics-c-mech-archetypes.test.ts` 5건 통과.
- 생성 런(동결 구성 `config/ap-frozen/physc-*.v1.json`): physc-mc / physc-sets / physc-frq(1차) → physc-fix1(1차 검토 반영) → physc-b(2차 저작) → physc-fix2 → physc-g(3차) → physc-fix3 → physc-h(4차) → physc-fix4 → physc-fix5. 같은 원형을 고쳐 다시 생성한 경우 가장 늦게 통과한 런의 후보만 재고에 둔다(`phys-finalize.ts --exclude`). 재고 배치 파일: `data/ap/stock/physc-{a,s,f,c,d,e,g,i,h,k,m}-items.json`(+`-pass-keys`·`-summary`), `STOCK_FILES` 등록.
- **스킬 분포**: 2.B 가 많다(세트당 14–34문항). 공식 MC 스킬 비중이 확인되지 않아(위 §1) 스킬 범위는 차단하지 않았다(비차단 경고만). PM5 는 2.B 34·2.D 5·3.C 2·3.B 1 로 가장 치우쳤고 exam_prep 비율도 낮다(13/42) — 원형 보강 필요 시 2.A·2.C·3.B 원형을 더 쓴다.
- **화면 증거(스크린샷) 미생성**: 이 환경의 Docker 데몬이 응답하지 않아 격리 Supabase 스택(`screen-evidence.ts` 의 전제)을 띄우지 못했다. 배정은 `--no-screen` 이다. 총괄은 격리 스택에서 `phys-evidence-keys.ts`(PHYS_SUBJECT 지정) → `local-demo-seed.ts`(과목 맵에 C: Mechanics 추가함) → `screen-evidence.ts` 를 돌려 증거를 만들어야 한다.
- 남은 연결(총괄): 시드 SQL·마이그레이션 `…620` 원격 적용, `SET_PREFIX_SUBJECT`(`PM`)·`assemble-phys-draft.ts` 과목 일반화, `lib/ap-admin/batches.ts` 배치 등록, `AP_PENDING_PUBLIC_SUBJECTS` 해제, FRQ 배점·MC 스킬 비중의 Mechanics CED 재확인.
