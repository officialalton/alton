# 운영 작업 체크포인트 — PS5·CH4·CH5·CS4 적재 (2026-10-22, 주간 사용량 약 82%에서 중단)

## 끝낸 것
- 브랜치 `ap-topup-5sets-sci3`(c6d70b8be)를 통합본에 병합(`a861acb8c`). 원장 합집합: base 580.7027 + 통합본 신규 129건 20.5065 + sci3 신규 72건 15.6766(공유 항목 0) = ledger.spent 616.885833 → **누적 $556.9358**(중단선 690 기준 여유 $133.0642, 진행 중 예약 0). `ledger-total.ts`로 `ledger-summary.json` 갱신.
- Psychology PS5용 `psych-t5-sets3` 배치 등록(`lib/ap-admin/batches.ts`), 렌더 보고서 재생성(기존 해시 변경 0, 새 행 추가), 화면 증거 6항목(3문항 × 2뷰포트, 실패 0, `data/ap/screen-evidence/evidence-psych-t5.json`, 스크린샷 `docs/ap/screen-evidence/psych-t5/`). 격리 스택 `ALTON_apps5`(PORT_OFFSET 7300) 사용 후 정지·config 원복·시드 정리 완료.
- review 주소는 이전에 수동으로 오래된 빌드(3hbihvn4m)에 붙어 있었다 → 최신 review 브랜치 빌드(`alton-hseankuri`)로 다시 연결.
- 관리자 화면(review 호스트)에서 `psych-t5-sets3` ①–④ 실행 완료(적재 3, 렌더 기록 1, 화면 기록 1, 변환 1). 공유 DB에 적재만 했고 공개 세트·응시·답안은 건드리지 않았다.

## PS5: 공개하지 않음 — 구조 규칙 위반(쌍둥이)
- 통과한 새 세트는 `pss_t5c_u5_light_therapy`(키 `psych-t5-sets3:ap_psychology-m03-k0`) 하나.
- 공개 Exam 4의 문항과 구조가 같다: Exam 4 "200 adults with depression … new antidepressant or identical-looking inactive pill … If the inactive-pill group's decrease reflects improvement that occurs without the active drug, about how much of the antidepressant group's mean decrease is attributable to the drug beyond that improvement?" vs 새 세트 q1 "…dim inactive lamp … about how much of the bright-light group's mean decrease is attributable to the treatment beyond that improvement?". 자료(무작위·이중맹검, 평균 감소 + 부작용 인원 표), 조건(대조군 개선 보정), 질문(대조군 감소를 빼서 치료 기여분), 추론 단계(treatment − control)가 같고 맥락(약→램프, 오심→두통)과 숫자만 다르다 → 쌍둥이, 독립 아님.
- 결론: PS5의 공유 세트 1개(3문항)는 여전히 부족. 이 세트의 나머지 2문항은 비교하지 않았다. 적재된 세트는 변환·미배정 재고로 남는다.

## 하지 못한 것(재개 절차)
1. **Chemistry CH4·CH5**: `chem-t5-*` 배치 13개(bank, bank2, frq~frq5, mc~mc3, sets, sets2)가 `lib/ap-admin/batches.ts`에 등록돼 있지 않다 → 등록 → 렌더 보고서 재생성 → 화면 증거(격리 스택, `chem-evidence-keys.ts`로 대상 키 선별) → 관리자 ①–④ → 초안 → 구조 규칙(FRQ·세트는 시나리오 id가 아니라 내용으로 판정) → 공개.
2. **CS A CS4**: `csa-t5-*` 배치도 미등록. CS5는 3칸 부족이라 공개하지 않는다.
3. 관리자 브라우저 탭은 `tab-7`(review 호스트), 헬퍼는 `[data-testid=ap-stock-panel]` 안의 "배치 전체 적재" 체크박스(`aria-label="<배치 제목> 선택"`) → 미리보기 → "미리보기 결과를 확인했습니다" → "선택한 배치 전체 적재 실행".
4. 정리 대상 테스트 응시는 이번 작업에서 새로 만들지 않았다.

## 미반영 비용: 없음(이번 작업 유료 호출 0).

## 추가 기록 — 결함 후보 제외 (2026-10-22, 화면 증거 단계에서 발견)
- 화면 점검에서 `stimulus_no_raw_tex`(`$...\text{ %}$`의 `%`가 LaTeX 주석이 되어 원문 수식이 학생 화면에 보임) 실패 3건: `chem-ch3-mc:ap_chemistry-m63-k2`, `chem-t5-mc:ap_chemistry-m20-k0`, `chem-t5-mc2:ap_chemistry-m18-k2`. 이 후보는 관리자 ③에서 "허용되지 않는 건너뜀"이라 배치 전체 적재를 중단시키므로 `chem-t5-mc`·`chem-t5-mc2`의 pass-keys에서 뺐다(내용 수정은 하지 않았다 — 고치려면 `\%`로 바꾼 새 해시와 증거 재생성이 필요).
- 변환 시 표준 렌더링 검증 실패(지문이 그림을 가리키는데 그림 없음) 3건: `chem-ch3-mc:ap_chemistry-m51-k0`, `chem-t5-bank:ap_chemistry-m33-k1`, `chem-t5-bank2:ap_chemistry-m07-k0`. 증거가 없어 건너뜀으로 처리된다.
- 위 6건과 오너 판단 보류 2건(`chem-s2-f3:f01-k2`, `chem-ch3-mc:m13-k0`), 내용 대조로 확인한 쌍둥이 2건(`chem-t5-bank:m46-k0`는 공개 Exam 3의 에탄올 입자 그림 문항과 같은 문항, `chem-s2-m-b:m22-k0`는 공개 Exam 1·2의 탄산·질산 이온 결합 길이 평가 문항과 같은 틀)은 `data/ap/stock/blocked-chem-defects-20261022.json`로 CH4·CH5 배정에서 제외했다(`chem-structure-block.ts --extra-block`).

## 결과 (2026-10-22 05:17Z) — CH4·CS4 공개, CH5·CS5 보류
- **AP Chemistry — Practice Exam 4**: 공개(`856cfaad-6c1a-468e-9b16-c6c097a680a0`, 문항 67 = MC 60(단독 56 + 2문항 세트 2) + FRQ 7, 05:14:19Z, 무료). 같은 과목 다른 공개 세트와 겹치는 문제 0(DB 쿼리).
- **AP Computer Science A — Practice Exam 4**: 공개(`b25f8cae-c334-496d-a1e9-7971d1c369e3`, 문항 46 = MC 42 + FRQ 4, 05:17:31Z, 무료). 겹침 0.
- **CH5 미공개**: v2 배정에서 결함·쌍둥이·판단 보류 후보를 막으면 단독 6칸(1단원 반지름 추세, 3단원 용해 절차, 4단원 산화환원 모형, 8단원 적정점·약산 pH·Ka(pH))이 부족. 계산상 조립 불가.
- **CS5 미공개**: FRQ 1개(`csa-t5-frq4:ap_computer_science_a-f01-k0`, DigitTools digitSum + firstHarshad)의 부분 (a)가 공개 Exam 2 DigitTools의 부분 (a)와 같은 메서드·같은 시그니처·같은 조건(digitSum(int n), n >= 0)이다. 부분 (b)는 다르지만 한 문항의 일부가 쌍둥이이므로 독립으로 세지 않았다 → FRQ 1개 부족. MC·세트는 코드 토큰 마스킹 비교에서 공개 세트와 쌍둥이 없음.
- **내용 대조로 제외한 Chemistry 쌍둥이**: `chem-t5-bank:m46-k0`(에탄올 수용액 입자 그림 = 공개 Exam 3과 같은 문항), `chem-s2-m-b:m22-k0`(오존 결합 길이 모형 평가 = 공개 Exam 1 탄산·Exam 2 질산 이온과 같은 틀). 렌더/변환 결함 6 + 오너 판단 보류 2 + 증거 없는 3(`m64-k1`, `m12-k0`, `m16-k0`은 증거를 새로 만들어 CH4에 사용)은 위 기록 참고.
- **FRQ 경계 사례(독립으로 판정, 부분 겹침 기록)**: Nernst 전지(공개 #2의 E°cell·ΔG° 부분과 겹치고 Nernst Q가 새로움 — 자료·추론이 다르다고 판정), 약산 Ka(공개 적정 문항 부분 A와 pH 계산이 겹침), 이온화 에너지·전자 배치(공개 PES와 원자 구조 자료로 겹침), ICE 표·공명(공개 평형·Lewis 문항과 일부 겹침). 이 FRQ들은 CH4(공명·ICE·전자 배치 포함)/CH5(미공개)에 들어 있다.
- **CS A FRQ**: CS4의 averagePositive(공개 Exam 1 ReviewStats와 같은 필터·평균 골격이나 자료·조건이 다름), flipRows(공개 GridShift와 변환이 다름), Stock 클래스(공개 클래스 설계 FRQ와 책임이 다름)는 독립으로 판정(경계 기록).
- **학생 화면(Production, 학생 테스트22)**: CH4 — 목록(Chemistry 4세트), 시작, 60문항 구성, 1번 문항(수화물 오차) 확인. CS4 — 목록, 시작, 42문항, 1번 문항 코드 표시 확인. FRQ·이후 문항·Preview는 보지 않았다. 확인용 새 테스트 응시 2건(제출 안 함, 정리 대기): CH4 `5a18e9ff-18a6-4706-9870-8394258bc78c`, CS4 `04ffc137-f1ec-4bff-a6bd-aaf614a91d6e`.
- **풀 모의고사 공개 수(DB)**: 71, 부분 연습 3(mc_practice 2 + frq_practice 1).
- **원장**: 누적 $556.9358(이번 작업 유료 호출 0, 진행 중 예약 0). 상한 730/740으로 갱신(`ledger-total.ts`, `ledger-summary.json`).
- **도구 변경**: `chem-structure-block.ts --extra-block`, `local-demo-seed.ts --skip-convert-failures`, `render-check.ts`에 chem-t5-* 추가, 배치 26개 등록(chem-t5-* 12 + 복구 1 + csa-t5-* 13) — 화면 증거 파일 `evidence-chem-t5.json`·`evidence-csa-t5.json`.

## 최종 체크포인트 (2026-10-22 08:15Z, 주간 사용량 약 90%)
- 공개(DB 검증): CH4 `856cfaad…`, CS4 `b25f8cae…`, PS3 `64b267bd…`, PS4 `3dcf297e…`, PS5 `a2e38fff…`. CS5 `7c42225c…`는 공개 25분 뒤 쌍둥이 발견으로 보관(archived_at 08:12:39Z). 풀 모의고사 73·부분 3.
- 미공개: CH5(unit 3.4 기체 단독 1개 부족, v7 배정 파일은 CH4와 구조 쌍둥이를 막은 최종본), PH5·LT5(처리 안 함).
- 원장 $557.9848(합집합, 이번 작업 유료 호출 0), 상한 730/740(`ledger-total.ts`·`ledger-summary.json`·`POLICY-DECISIONS.md`). 진행 중 예약 0.
- 미반영·미커밋 변경 없음(모든 변경 integration·review에 푸시). 격리 스택 모두 정지, `config.toml` 원복.
- 재개 절차: (1) 교체 재고를 만든 뒤 `post-publish-twin-audit` 목록으로 새 버전 초안 교체(관리자 'AP 재고 관리' → AB/AP 세트 새 버전), (2) CH5는 unit 3.4 기체 문항 1개 작성 후 `chem-structure-block.ts --extra-block data/ap/stock/blocked-chem-defects-20261022.json` + CH4 키 차단으로 재배정, (3) 공개 전 `structure-rule-scope.md`의 엄격 게이트를 먼저 수행, (4) PH5·LT5는 `ap-topup-p1-lt-wh` 병합(ledger.json 합집합·keys-file.ts 충돌 해결) 뒤에.
- 테스트 응시 정리 대기(미제출, 테스트 계정): CH4 `5a18e9ff-18a6-4706-9870-8394258bc78c`, CS4 `04ffc137-f1ec-4bff-a6bd-aaf614a91d6e`, CS5 `be9004fc-dcb5-4395-b7b0-2a85b53f710e`, PS5 `86f54d8b-3195-402b-82c2-f49694adc20d`, 이전 실행분(PC5·BI5·EL5·LT4·PS3·PS4·SAT·US3)은 기존 목록.

## PH5·LT5 엄격 게이트 결과 (2026-10-22, 둘 다 미공개 — "계산상 조립 가능"이 아니라 부족분 있음)
- 통합본 병합 후 원장 누적 **$567.1786**(이번 처리 유료 호출 0). 상한 730/740.
### Physics 1 PH5 (`exact-assign-phys-ph5-structure.json`)
- 공개 Physics 1 Exam 1–4의 객관식 168개와 문장 순서 유사도(숫자·LaTeX 가림)로 비교하고 상위 쌍을 읽었다.
- 코디네이터 배정의 쌍둥이: `phys-s3-a:ap_physics_1-m26-k1`(스케이터 팔 접기 각운동량·회전 운동 에너지)는 공개 Exam 2의 스케이터(관성 5→1.25, 운동 에너지 배율)와 같은 장면·조건·풀이(L 보존)이고 질문 형식만 다르다 → **쌍둥이**. `phys-t5-mc4:m05-k0`(경사에서 거리 d 뒤 속력)는 Exam 1 하강 가속도 문항과 같은 자유물체도에서 일-에너지 한 단계가 더해진 것이라 질문·풀이가 달라 **독립(경계)**. `phys-s5n-mc:m43-k1`(자유낙하 시간)은 Exam 3 던진 공 총 시간과 식이 달라 **독립**. FRQ 4개(로프로 당기는 상자, 벽 충돌 충격량, 겉보기 무게 실험, 떨어뜨린/수평 발사 공 주장)는 공개 FRQ 16개와 소재·과제가 달라 독립.
- 공개 키와 숫자만 다른 변형(유사도 0.65 이상)을 재고 505개 중 **291개 차단**하고(`/tmp` 차단 목록 → `data/ap/stock/blocked-twins-phys1-strict-20261022.json`은 0.8 이상 272개) 다시 풀면 **단독 37 + 가상 1(단원 1), 2문항 세트 가상 2(단원 1, 단원 2), FRQ 4(가상 0)**. 부족분: 단원 1 단독 1개, 2문항 세트 2개(단원 1·2) = 5문항.
- 참고: 0.8 이상만 막으면 가상 2세트(단원 1·2)뿐이지만 0.69–0.76 구간에 Atwood 도르래(3·5 kg ↔ Exam 2 2·6 kg), 같은 시나리오 완전 비탄성 충돌(Exam 3), 컨테이너 액체 압력(Exam 1) 등 숫자만 다른 쌍둥이가 남는다.
### Eng Lit LT5 (`exact-assign-englit-lt5-structure.json`)
- MC 지문 5개: Danner Account(s05), Wharton *The Other Two*(rs32), Room Above the Coal Merchant's(p06), Hughes *The Weary Blues*(rs33), The Kitchen Room(l01). 현재 공개 LT1–LT4의 MC 지문 목록과 제목·저자로 대조: 겹치는 지문 없음.
- FRQ: q1 Hardy *The Darkling Thrush* — **공개 Exam 3의 객관식 지문(같은 시, 13문항)과 같은 작품**이다. 과제(시 분석 에세이 vs 객관식)는 다르지만 같은 지문을 이미 읽은 응시자가 생기므로 독립으로 세지 않았다. q2 *The Pupil at Harrowgate Lodge*(ALTON 원본 소설): 공개 FRQ 지문과 제목·장면 모두 달라 독립. q3 *The Place That Holds a Character*: 공개 Exam 2(*The House That Holds*, 집이 배경 이상의 의미) · Exam 4(*The Debt and the Door*, 실패한 농장과 빚)와 주제가 겹치는 개념형 프롬프트(경계, 독립으로 세지 않음).
- 부족분: FRQ q1(시) 1개, q3 1개 — 대체 지문·프롬프트가 필요. MC 5개 지문은 독립이라 새 항목은 필요 없다.
### 다음 작업
- PH5: 단원 1 단독 1개 + 2문항 세트 2개를 작성한 뒤 재배정. LT5: 시 FRQ 1개와 q3 프롬프트 1개를 교체(또는 q3는 경계로 판단해 유지).

## PH5 공개 (2026-10-22, 코디네이터 v6 재료)
- **AP Physics 1 — Practice Exam 5**: 공개(`6935d468-6e99-4374-8fdf-4b6685134854`, 문항 46 = MC 42(단독 38 + 2문항 세트 2) + FRQ 4, 무료). 다른 Physics 1 공개 세트와 겹치는 문항 0(DB 쿼리). 풀 모의고사 74·부분 3.
- 배정 `exact-assign-phys-ph5-v6.json`(--no-screen 풀이) 최신 DB 검증 통과: MC 42, FRQ 4, items 46, problems 0.
- 엄격 쌍둥이 게이트: 공개 Physics 1 Exam 1–4 객관식과 문장 순서 유사도로 비교, 상위 쌍(≥0.55 및 근접 쌍)을 읽음. 결과: 쌍둥이 없음. 경계로 독립 처리: `phys-t5-mc4:m05-k0`(경사 하강 속력 ↔ Exam 1 가속도: 질문·일-에너지 단계가 다름), `phys-s5n-mc:m25-k0`(위성 속력 ↔ Exam 3 주기 비: 구하는 양과 법칙이 다름), `phys-t5-mc4:m01-k0`(공 4개 사거리 순위 ↔ Exam 4 사거리 1개 계산: 질문 형식·비교 추론이 다름), `phys-t5-sets6:m01-k1`(킥 최고점 속력·최대 높이 ↔ Exam 4 사거리: 구하는 양·풀이가 다름). FRQ 4개는 공개 FRQ 16개와 내용이 다르다.
- 증거·적재: 격리 스택 `ALTON_appz8`로 36후보·78항목 화면 증거(실패 0), 관리자 12배치 ①–④(render-check에 `phys-t5mc10/11/12/s4/s6`가 빠져 있어 추가 후 재실행).
- 학생 화면(Production, 테스트22): 목록 "AP Physics 1 5", 시작, 42문항 구성, 1번 문항(강을 가로지르는 배의 속도) 확인. 이후 문항·FRQ·Preview 미확인. 새 테스트 응시(미제출, 정리 대기): `aae2a3d5-8b0f-4575-89b3-9acfa2631ee9`.
- 원장 $568.6353(합집합 후 `ledger-total.ts`, 이번 작업 유료 호출 0). 진행 중 예약 0. LT5는 처리 안 함(코디네이터 지시: 유료 배치 2개 대기).

## LT5 공개 (2026-10-22, 코디네이터 v3 재료)
- **AP English Literature — Practice Exam 5**: 공개(`4cf9f1f2-3547-4b7f-b7fd-033becfa3ab7`, 문항 58 = MC 55(5 묶음) + FRQ 3, 무료). 같은 과목 다른 공개 세트와 겹치는 문항 0(DB 쿼리). 풀 모의고사 75·부분 3. 최신 DB 초안 검증: MC 55, FRQ 3, items 58, problems 0.
- 구성: MC 묶음 Coal Merchant's(시), Danner Account(단편), Kitchen Room(희곡), Wharton *The Other Two*(단편), Hughes *The Weary Blues*(시). FRQ q1 Frost *Mending Wall*, q2 *The Pupil at Harrowgate Lodge*, q3 *The Unfinished Debt*.
- 엄격 쌍둥이 게이트(키 접두사 `audit-wuel:…`로 저장된 공개 항목은 키 차단이 걸러내지 못하므로 내용으로 비교): 현재 공개 LT1–LT4 DB 내용과 지문 앞부분 문장 순서 유사도 0.10–0.24(같은 지문 없음), MC 질문 문장은 다른 지문의 일반 질문 틀과만 높게 나옴(지문별 내용이 다름). ALTON 원본 3 묶음(Coal Merchant's·Danner Account·Kitchen Room)은 공개 ALTON 원본 지문(Harlan Narrows Crossing, Tenney Street, The Patience, Canon One, Trackbed, Bench in Vrana Square, Accession 4471-B, The Fen Parish)과 제목·장면 모두 다르다. FRQ: Mending Wall은 공개 FRQ 시(God's Grandeur, An Old Man's Winter Night 등)와 다른 작품이고 MC 지문에도 없다. q3 *The Unfinished Debt*(과거 잘못의 속죄)는 Exam 4 *The Debt and the Door*(가족·공동체 의무 대 개인의 자유)와 '빚'이라는 비유어만 같고 과제·소재가 다르다 → 독립. 다른 q3(Shared Secret·House That Holds·Ambition and Belonging)와도 다르다.
- 증거: 격리 스택 `ALTON_appa9`로 FRQ 2개(rf23·fc8) 화면 증거 4항목(실패 0). 관리자 ①–④: Mending Wall·fc8 배치 적재·렌더·화면·변환 완료(나머지 키는 이미 변환 상태).
- 학생 화면(Production, 테스트22): 목록 "AP English Literature 5", 시작, 55문항 구성, 첫 묶음(Danner Account) 확인. 이후 문항·FRQ·Preview 미확인.
- **테스트 응시 정리 실행**: `docs/ops/test-attempt-cleanup-2026-10-22-b.sql`(테스트 계정·미제출·새 공개 세트 6개로 한정, 보호 검사 포함)을 실행해 CH4·CS4·CS5·PS5·PH5·LT5 테스트 응시(6건)를 삭제했다. 실제 학생 응시 22건 그대로, 남은 테스트 응시 0(이 6개 세트 기준). 답안·채점·비용 기록은 없었다.
- 원장 $572.7657(합집합 후 `ledger-total.ts`, 이번 작업 유료 호출 0), 상한 730/740.

## CH5 v13 엄격 게이트 결과 (2026-10-22, 미공개 — 쌍둥이 1개 + 대체 재고 부족)
- 코디네이터 `exact-assign-chem-ch5-v13.json`(58 MC 단위 + FRQ 7, 가상 0)을 병합했다(원장 $573.4829). 공개 Chemistry Exam 1–4(CH4 포함)의 객관식과 문장 순서 유사도로 비교하고 상위 쌍을 읽었다.
- **쌍둥이**: `chem-t5-mc2:ap_chemistry-m21-k2`(A+B⇌2C의 반응 지수 Q 계산)는 공개 Exam 3의 "2X+Y⇌2Z 평형 농도로 K 계산"과 같은 풀이(반응식으로 식을 세워 농도 대입, 반응과 라벨만 다름)라서 독립으로 세지 않았다.
- 경계로 독립 처리: `chem-ch3-mcr2:m01-k0`(2차 반응 시간) ↔ Exam 4 0차 반응 시간(차수가 달라 적분식이 다름), `chem-t5-mc4:m06-k0`(Ka·부피로 계산하는 당량점 pH) ↔ Exam 1·2(적정 곡선을 읽는 당량점 pH; 계산 대 그래프 읽기).
- 이 항목을 막고 다시 풀면(CH4·결함·보류 항목 차단 + `ch_t5_q_value` 계열 차단) 가상 0이지만 대신 들어오는 항목이 다시 Exam 3·Exam 1의 쌍둥이다: `chem-t5-mc:m18-k2`(평형 농도로 K 계산, Exam 3과 같은 풀이), `chem-t5-mc:m08-k2`(몰 수로 부분 압력, Exam 1과 같은 틀), `chem-ch3-mc:m66-k0`(강산 pH, Exam 2와 같은 풀이)는 쌍둥이이고 입자 그림 3개(NaCl 용액, CaF2, 다이아몬드)는 경계 독립이다. 재배정 `exact-assign-chem-ch5-v14.json`은 쌍둥이를 포함하므로 사용하지 않는다.
- 부족분: 평형 단원(unit 7)의 K/Q 식 평가가 아닌 단독 문항 1개(예: ICE 표 또는 Le Chatelier 조건 비교)와, 위 대체 쌍둥이를 피하려면 단독 2개 정도. 증거·적재는 하지 않았다(격리 스택 `ALTON_appb10` 중단·정리, `config.toml` 원복). 원장 유료 호출 0.
- 부가 변경: `chem-t5-rec` 배치에 키 2개 추가(`chem-ch3-mc:m29-k1`, `chem-ch3-mcr2:m01-k0`; 둘 다 구조 검토 대상이었으나 v13 배정에 들어 있어 등록 누락을 메움).
