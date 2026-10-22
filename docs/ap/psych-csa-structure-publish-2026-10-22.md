# Psychology PS3·PS4 공개, CS A·PS5 미공개 — 구조 규칙 점검·적재·공개 기록 (2026-10-22)

범위: 브랜치 `ap-topup-5sets-sci3`를 통합본에 병합(원장 합집합), Psychology PS3·PS4·PS5와 CS A CS4·CS5의 오너 구조 규칙 점검, 통과 세트 적재·화면 증거·변환·공개. 유료 호출 없음.

## 결과
| 세트 | 결과 | 사유 |
|---|---|---|
| **Psychology PS3** | **공개**(`64b267bd-e854-4b2b-ab63-6cf7b28af2b8`, 문항 77 = MC 75 + FRQ 2, 2026-10-22 02:38Z, 무료) | 모든 게이트 통과 |
| **Psychology PS4** | **공개**(`3dcf297e-24de-4f8f-8a9a-d16c37e1610b`, 문항 77, 02:38Z, 무료) | 모든 게이트 통과 |
| Psychology PS5 | 미공개 — 공유 세트 1개 부족 | 구조 쌍둥이 4쌍을 막은 뒤 재배정: 단독 66 + 세트 2(+가상 1: `pss_u5_panic_case`, 3문항) + FRQ 2. 새 3문항 세트 1개 필요 |
| CS A CS4 | 미공개 — 구조 규칙 | 42 문항 단위 중 독립 38, 교체 필요 4 |
| CS A CS5 | 미공개 — 구조 규칙 | 42 문항 단위 중 독립 24, 교체 필요 18 |

## 구조 규칙 점검 방법(오너 규칙: 자료·조건·질문·필요 추론 단계. 원형명·주제·문자열 유사도 단독 판정 금지)
- 비교 대상: 같은 과목의 공개 세트 문항(DB 현재 값) 및 새 세트들 사이.
- 1차 후보 선별만 자동: 숫자를 가린 질문 토큰 유사도, 선택지 유사도, (CS A) 코드 토큰 열에서 식별자·숫자·문자열 리터럴을 가린 뒤 순서 유사도. 판정은 선별된 쌍을 문제 문장·보기·코드로 직접 읽고 했다. 그래프·표 데이터 값은 열지 않았다.
- 한계: 자동 선별이 다시 쓴 문장의 쌍둥이를 놓칠 수 있다(독립 수는 상한). 경계 사례는 오너 규칙에 따라 "명백히 다르지 않으면 독립 아님"으로 셌다.

### Psychology
- 공개 세트 비교: 선별 7개 단위 모두 일반적인 질문 문구("Which conclusion is best supported by the table?" 등)만 같고 표·자료·선택지가 달라 독립. 구조 쌍둥이 0.
- 새 세트끼리 구조 쌍둥이 4쌍(숫자만 다른 변형 또는 같은 개념·같은 시나리오): 
  - 쥐 미로 시도 횟수 범위 `m24-k0`/`m24-k1`(표 값만 다름) — PS3·PS4
  - 스트레스 점수 평균·중앙값 `m28-k0`/`m28-k1` — PS3·PS5
  - 발 들여놓기 기법 petition→lawn sign `m17`/`m19` — PS3·PS5
  - 윤리 지침(동의·비밀보장) 시나리오 `m22-k1`/`m10-k0` — PS4·PS5
- 뒤 세트(PS4·PS5)의 해당 키를 차단하고 재배정(`topup-structure-block.ts --extra-block`)을 반복해 새 쌍둥이 쌍이 0이 될 때까지 돌렸다(2회). 결과 `data/ap/stock/exact-assign-psych-ps3-ps5-twinfree.json`.
- 독립 문항 수(단위별): PS3·PS4 = 독립 MC 75(단독 66 + 3문항 세트 3개 9문항 = 자료 묶음 3개) + FRQ 2. PS5 = 단독 66 + 세트 2 + FRQ 2 (세트 1 부족).

### CS A (코드 토큰 마스킹 비교)
- CS4: 문항 단위 42 → 공개 세트와 쌍둥이 3, 교체 필요 4(세트 안 쌍둥이·세트 간 쌍둥이 포함), 독립 38.
- CS5: 문항 단위 42 → 공개 세트와 쌍둥이 10, 교체 필요 18, 독립 24. CS4·CS5 사이 쌍둥이 14쌍(같은 세트 안 4쌍 포함: 같은 코드 구조에서 반복문 경계·리터럴만 다른 k0/k1).
- 대표 쌍:
  - 쌍둥이: `gcd`(새 `m29-k0` vs 공개 Exam 1 `m08-k0`: 같은 유클리드 호제법·`r = a % b` 교환, 빠진 코드 위치만 다름), `distance`(새 `m09-k0` vs 공개 Exam 1 `m08-k0`: 같은 거리 공식 선택지), `countMultiples`(새 `m23-k0` vs 공개 Exam 2 `m07-k0`: 경계), 중첩 for 출력 값 세기(새 `m41-k0`과 `m41-k1`: 반복 경계 숫자만 다름).
  - 독립: `lastIndexOf` vs 공개 `firstIndex`(역방향 순회·경계 오류가 필요), 문자열 짝수 인덱스 역순 `mystery` vs 공개 정방향 짝수 인덱스, `Probe.mystery("bccaccc")`(인접 중복 개수) vs 공개 `Probe.mystery("cbabbacb")`(첫 글자 일치 개수; 코드·풀이가 다름).
- CS A FRQ(각 4개)는 이번에 구조 비교하지 않았다.
- CS4·CS5는 독립 문항으로 채우려면 CS4 약 4개, CS5 약 18개 새 문항이 필요하다(재배정 전 숫자). 이 결과로 CS A 부족분은 CS A 문항 제작 쪽에서 새로 계산해야 한다.

## 적재·증거 단계(Psychology)
- 브랜치 병합: 통합본 `51573c138`(원장 합집합, 누계 $541.2596 = 532.6859 + 8.5737, 중단선 690/상한 700으로 요약 파일 갱신). 새 배치 6개 `psych-t5-*` 등록(`lib/ap-admin/batches.ts`), `data/ap/screen-evidence/evidence-psych-t5.json`.
- 화면 증거: 격리 스택 `ALTON_appsy`(PORT_OFFSET 5200), 89개 후보 × 2뷰포트 = 214항목, 점검 7종 실패 0(스크린샷 `docs/ap/screen-evidence/psych-t5/` 208장). 옛 배치(p1a·p2a·p4a·r19) 키의 항목은 각 배치의 증거 파일(`evidence-psych-s2.json` +86, `evidence-psych-r19.json` +6)로 옮겼다. 스택 정지·`config.toml` 원복·시드 정리 완료.
- 렌더 보고서 재생성: 269행 추가, 기존 해시 변경 0.
- 관리자 화면(review 호스트): `psych-r19`·`psych-t5-mc2/sets/sets2/frq/frq2`는 ①–④ 한 번에 완료. `psych-t5-mc`는 ③ 증거 없는 1건(`m19-k0`, 배정 미사용)을 빼고 27건 ③④. `psych-p1a/p2a/p4a`는 ① 미리보기가 "내용이 바뀐 검증된 행"으로 멈춰 ②③④ 단일 단계로 처리(③ 건너뜀: p1a 9건·p2a 1건·p4a 2건, 모두 배정 미사용 키).
- 초안 검증(최신 DB): PS3·PS4 모두 MC 75·FRQ 2·문항 77·problems 0, 다른 세트와 겹치는 문항 0(DB 쿼리로 재확인).

## 학생 화면 확인(Production, 학생 테스트22)
| 세트 | 본 것 | 못 본 것 |
|---|---|---|
| PS3 | 목록("AP Psychology 4"), 시작, 1·20·40·60·75번 문항(표 없는 문항) | 표·세트 문항, FRQ |
| PS4 | 목록, 시작, 1·15·38·57·75번 문항(75번은 표가 있는 3문항 세트의 첫 화면) | 나머지, FRQ |
Preview 확인은 하지 않았다. 확인용 새 테스트 응시 2건(제출 안 함, 테스트 계정이라 통계 제외 대상, 정리 대기): PS3 `5d0a2fa5-2edb-4a24-b7a1-f67e20ba6fc5`, PS4 `57081367-5e50-489b-a92b-0ecf13ad6706`.

## 공개 후 DB(2026-10-22 02:40Z 전후)
- 풀 모의고사 70, 부분 연습 3. Psychology 풀 모의고사 4(Exam 1–4).
- 과목별 풀 모의고사: Biology 5, Calc AB 3, Calc BC 5, Chemistry 3, CS A 3, English Language 5, Eng Lit 4, European History 2, Macro 3, Micro 3, Physics 1 4, Physics C E&M 5, Physics C Mech 5, Precalculus 5, Psychology 4, Statistics 5, US History 3, World History 3.

## 남은 부족
- Psychology PS5: 새 3문항 세트 1개(unit 5, `pss_u5_panic_case`).
- CS A CS4·CS5: 위 대표 쌍 기준 교체 문항 필요(CS4 약 4, CS5 약 18) + FRQ 구조 비교 미실시.
- Chemistry는 이번 작업 범위 아님.
- 원장: 유료 호출 0, 누계 $541.2596(진행 중 예약 없음). SAT 원장 별도 $23.607.
