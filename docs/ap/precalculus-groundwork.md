# AP Precalculus 원형·세트 저작 라운드 (2026-10-20)

범위: `docs/ap/new-subjects-plan-2026-10-20.md` §4.6 착수 순서 2번. 원격 DB 쓰기·시드 SQL 적용·공개·Production 은 하지 않았다(총괄이 한다). 최종 수치(통과 수·배정·비용)는 아래 "결과" 절.

## 1. 시험 형식 재확인(2026-10-20, AP Central 시험 페이지 `apcentral.collegeboard.org/courses/ap-precalculus/exam`)

| 항목 | 값 | 비고 |
|---|---|---|
| MC | 42문항 / 1시간 45분 / 62.5% | 파트 A 29문항 65분 계산기 불가(43.75%), 파트 B 13문항 40분 그래핑 계산기 필수(18.75%) |
| FRQ | 4문항 / 1시간 10분 / 37.5% | 파트 A 2문항 35분 그래핑 계산기 필수(FRQ 1 Function Concepts, FRQ 2 Modeling a Non-Periodic Context), 파트 B 2문항 35분 계산기 불가(FRQ 3 Modeling a Periodic Context, FRQ 4 Symbolic Manipulations) |
| 계획서 값과 대조 | 일치 | 42/29/13, 65/40분, FRQ 2+2·35/35분 모두 같다 |
| 문항별 6점·비중 근거 | 오너 확인(2026-10-20): FRQ 6/6/6/6점, 2027 시험 MC 62.5%·FRQ 37.5% | 원문 페이지 번호는 미기재. 같은 값이 `data/ap/curriculum-2027/ap_precalculus.json` `subject.designNotes`("each 6 points, scored analytically, equal weight"; MC 62.5%, 파트 A 43.75%·B 18.75%)에 CED(effective Fall 2026) 시험 개요로 기록돼 있다. 코드: `lib/ap-exam/layouts.ts` `AP_NEW_SUBJECT_FRQ_TYPES`·`AP_SECTION_WEIGHTS_PCT`. 파트 A/B 비중은 문항 수 비례(29:13)가 아니라 7:3 이다 |
| 2027 변경 | 페이지가 "MC 수·FRQ 1·2·시간이 갱신된다"고만 하고 새 수치는 별도 PDF | 위 값은 2027 시험 형식 값이다 |

단원 MC 비중(CED, 커리큘럼 JSON): 1단원 30–40%, 2단원 25–40%, 3단원 30–35% → 42문항 [13,16]/[11,16]/[13,14], 목표 15/13/14(`lib/ap-exam/full-set-rules.ts` `PRE_*`).

## 2. 구성

- 도구: `pre_common.py`(선택지·설계도 도우미), 원형 `pre_p0_{a..l}.py`(MC, 접두 `pre_`), `pre_p0_frq.py`·`pre_p0_frq2.py`(FRQ, 접두 `pref_`). `registry.py` 자동 등록(`pre_all`, `pre_batch2`, `pre_frq2`; `registry.py guide-pre`).
- 정답·수치는 코드가 두 경로로 계산한다: sympy 기호 풀이 대 numpy·scipy 수치(brentq 근 찾기, 정규방정식 회귀, 표본·부호 변화 탐색). 계산기 불가 문항은 정확값(정수·분수·근호·π 배수·식), 계산기 필수 문항은 소수 셋째 자리.
- 그래프·표 자료: 함수 그래프(다항·지수·로그·정현)는 닫힌 형태에서 점 목록으로, 데이터 표는 시드 잡음으로 만든다. AB 의 그래프 단계 인프라(`ap_graph` 스펙·`calc_*` 게이트)를 그대로 썼고 계산기 파트 분리는 `ap_mc_a`/`ap_mc_b`·`ap_frq_a`/`ap_frq_b` 섹션 규칙(AB 와 같다)을 따른다.
- 파이프라인 연결: `lib/ap-generation/subjects/precalculus.ts`(+`precalculus-archetypes.json`), `pipeline2.ts`(가이드·과목 라벨·SUBJECT NOTES), `gates.ts`(FRQ 프로필 6점, 수식 구분자 규칙), `full-set-rules.ts`(단원 비중·구성 검증), 배정 `pre-pool.ts`·`pre-assign.ts`·`pre-finalize.ts`·`pre-evidence-keys.ts`.
- FRQ 4유형(템플릿 id): `fc`(계산기), `mn`(계산기), `mp`(불가), `sy`(불가). 각 유형 시나리오 5개.

## 3. 검토기에서 배운 점(1차 런 pre-mc, 282후보 중 68% 통과)

- 통과 실패의 대부분은 "오답 설명이 선택지 값을 실제로 만들지 않는다/비현실적 오개념"이었다. 오답 이유에 계산 결과 수치를 직접 적고 정의되지 않은 기호를 쓰지 않는다. 정답 해설은 풀이 수치를 보여야 한다(일반 힌트 문구 금지) — `MQ` 가 항상 구체 해설을 정답 해설로 쓴다.
- 문항이 그림·표 없이 한 단계로 끝나거나 선택지가 범위 밖(정의역 밖 값)이면 반려된다. 법칙(코사인 법칙) 범위 밖 항목은 제거했다.

## 4. 결과 (2026-10-20)

- **세트 4개 배정 완료**: `data/ap/stock/exact-assign-pre-pc1-pc4.json`(PC1–PC4). 세트당 MC 42 = 파트 A 29(계산기 불가) + 파트 B 13(계산기 필수), 단원 15/13/14(PC2 13/15/14, PC3 14/14/14 등 공식 범위 [13,16]/[11,16]/[13,14] 안), FRQ 4(fc·mn·mp·sy 각 1; A=fc·mn, B=mp·sy). 가상 칸 0, 독립 검증기(`verifyPreAssignment`) 위반 0, **세트 간 원형 겹침 0**(같은 원형의 다른 시드도 쓰지 않음), 화면 증거 보유 항목만 사용. 명령: `npx tsx scripts/ap-generation/pre-assign.ts --sets PC1,PC2,PC3,PC4 --prefer-exam-prep --joint --time-ms 300000 --write-report data/ap/stock/exact-assign-pre-pc1-pc4.json`.
- **exam_prep 비율**: 세트마다 12/42(29%) — 세트 간 균형을 위해 공동 풀이(최소값 최대화). 순차 풀이는 PC1 에 몰린다(93%/19%/2%/0%).
- **5세트는 못 만들었다**: 통과 원형 179(MC)로 4세트(168원형)가 한계이고 FRQ 는 fc 5·mn 5·mp 5·sy 5 시나리오가 필요한데 통과 시나리오는 fc 5·mn 4·mp 5·sy 4 다(mn·sy 에서 부족). 5세트는 MC 원형 약 40개와 mn·sy 시나리오 1–2개를 더 저작해야 한다(약 $6 추가 예상).
- 원형: MC 200(단원 1 68·2 69·3 63... 정확 수치는 `precalculus-archetypes.json`, 계산기 필수 약 58) + FRQ 시나리오 22(fc 7·mn 5·mp 6·sy 4). 단위 테스트 `lib/ap-generation/precalculus-archetypes.test.ts`.
- 생성 런(동결 구성 `config/ap-frozen/pre-*.v1.json`): pre-mc(원형 94 x 후보 3, 282후보, 통과 68%, 비용 $8.19) → pre-mc2(원형 115 x 3, 345후보, 통과 59%, $9.84) → pre-frq(12시나리오 x 3, 60후보, $2.96) → pre-frq2(fc 2 추가·검토기 지적 수정 4 시나리오 x 3, $0.80). **합계 약 $21.79**(Precalculus 한도 $44). 재고 배치 `data/ap/stock/pre-{a,b,f}-{items,pass-keys,summary}.json`(`STOCK_FILES`·`lib/ap-admin/batches.ts` 등록).
- 화면 증거 `data/ap/screen-evidence/evidence-pre.json`(격리 스택 `ALTON_pc6`, PORT_OFFSET=600): 428후보 x 390/1280 = 856건 전부 통과(figure 76·FRQ 입력 34·원문 수식 노출 0·잘림 0). 그림·표 문항 스크린샷 152장 동봉. 이 점검은 표시·입력·노출·잘림의 자동 점검이며 그래프 의미·문장 자연스러움 검토가 아니다.
- 검토기가 통과시켰지만 지적한 FRQ 결함 4건(tide 해 3개 모호·spring 소수 키·daylight 날짜 불일치·body temperature 루브릭 경직)은 시나리오를 고쳐 재생성했고 옛 후보는 재고에서 뺐다(`pre-finalize --exclude`). 그 밖에 검토 메모가 남은 항목(sy 묶음의 연결성 지적 등)은 공개 전 사람 검수 대상이다.

## 5. 남은 연결(총괄)

시드 SQL(`data/ap/seed-sql/ap_precalculus.*`)·마이그레이션 `…620` 원격 적용, `SET_PREFIX_SUBJECT`(`PC`)·세트 조립 과목 일반화(`assemble-*-draft.ts` 는 Precalculus 미지원), `AP_PENDING_PUBLIC_SUBJECTS` 해제, 6점 배점(문항별)·MC 스킬 비중의 Precalculus CED 재확인, 부분 세트(`AP_PARTIAL_SUBJECTS`) 미지원. SAT 와 무관.
