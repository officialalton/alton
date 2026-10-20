# AP 확대 라운드(2026-10-19) — Microeconomics MI3 · CS A CS3 · Macroeconomics MA3

오너 확정(2026-10-19): 기존 공개 세트와 (a) 문항이 겹치지 않고 (b) 풀이 틀·자료 형태가 달라야 하는 신규 풀 세트. 이 문서는 이 라운드에서 만든 세트 3개와 못 만든 세트의 수치를 기록한다. 관리자 화면 적재·원격 DB 쓰기·Production 은 하지 않았다(총괄이 한다).

## 엄격 규칙을 구현한 방식

- **공개 세트와 겹침 0**: 공개 세트·교체안(swap plan)·배정 보고서에 나온 모든 키를 "사용됨"으로 보고, 그 문항군(fam, 구조 look-alike 군집 포함)·원형을 가진 재고는 전부 막는다. 가상 칸(아직 없는 문항)은 **새로 저작한 원형**과 한 번도 쓰이지 않은 라이브러리 원형으로만 채웠다.
- **문장 유사도**: 공개 문항과 문장 단어 집합 자카드 0.5 이상이면 막는다(Micro·Macro, 본문+선택지). CS A 는 코드 자료의 식별자·키워드 단어 집합 0.85 이상(숫자·문자열 상수는 가림). `scripts/ap-generation/_strict-lib.ts`.
- **구조 look-alike**: 같은 토픽·같은 질문 문장 틀이면 같은 군으로 묶이므로(lib/ap-exam/look-alike.ts), CS A 출력 추적 원형 15개는 질문 문장에 코드 목적을 넣어 고쳤다(`STAGE_X_B`).
- **배정**: `scripts/ap-generation/_strict-micro.ts`, `_strict-csa.ts`, `_strict-macro.ts` — 기존 정수계획(micro/cs/macro-assign)을 그대로 쓰되 재고를 위 규칙으로 걸러 낸 풀로 풀고, 독립 검증기(verify*Assignment) 위반 0 을 확인해 `data/ap/stock/exact-assign-{micro-mi3,csa-cs3,macro-ma3}.json` 과 `*-verifier.txt` 를 쓴다.
- **문항 설계표**(내용·기능·표현·추론·중복): `data/ap/stock/design-table-{micro-mi3,csa-cs3,macro-ma3}.json`(`scripts/ap-generation/design-table.ts`). 중복 칸은 공개 세트와 원형·문항군 겹침(0), 가장 가까운 공개 문항과의 문장 유사도, 세트 안 같은 원형 형제(0)를 담는다.
- **정답 유일성**: 파이프라인의 독립 풀이(Opus, 키 비공개) + 검토기 5기준 통과 문항만 재고(`auto_passed`). Java 문항은 실제 javac/java 실행 결과를 정답으로 하고 Python 참조가 같은 값을 내야 한다. 수치 문항은 정확 분수·sympy 이중 계산.
- **게이트**: `render-check.ts`(실패 0), 격리 스택(`ALTON_apx19`, API 56121/DB 56122)에서 실제 학생 화면 증거(390x844·1280x800, 실패 0): `data/ap/screen-evidence/evidence-{micro-s5,csa-x,macro-x}.json`, 스크린샷 `docs/ap/screen-evidence/{micro-s5,csa-x,macro-x}/`. 종료 후 `isolated-stack.sh stop`, config 원복 확인.

## 결과

| 세트 | 구성 | 신규 문항 | 기존(증거 보유) 문항 | 배치 키 | 배정 파일 |
|---|---|---|---|---|---|
| Microeconomics MI3 | MC 60 + FRQ 3(긴 독점·짧은 MC·새 짧은 FRQ 가동 중단) | MC 42 + FRQ 1 | MC 18 + FRQ 2 | micro-s5a/b/c/d | exact-assign-micro-mi3.json |
| CS A CS3 | MC 42(단독 40 + 2문항 세트 1) + FRQ 4 | 단독 37 + 세트 1 | 단독 3 + FRQ 4 | csa-xa/xb/xc/xd/xe/xf | exact-assign-csa-cs3.json |
| Macroeconomics MA3 | MC 60 + FRQ 3(긴 열린 경제·짧은 2) | MC 52 + FRQ 2 | MC 8 + FRQ 1 | macro-xa/xb/xc/xd/xf | exact-assign-macro-ma3.json |

신규 원형: Micro 33 MC + 1 FRQ 템플릿(`mif_short_shutdown`, `lib/ap-exam/micro-rules.ts`·`subjects/micro.ts` 등록), CS A 44(단독 41 + 세트 3), Macro 51. 가이드 JSON(`lib/ap-generation/subjects/{micro,csa,macro}-archetypes.json`)은 레지스트리 순서로 갱신.

## 한계(숨기지 않는 항목)

- **Macro MA3 는 그림 자료가 적다**: 63개 중 그림·표 9개(14%). 공개 세트(MA1·MA2 v3)는 126개 중 45개(36%). 풀이 틀이 달라야 한다는 규칙을 지키려고 고정 문장 비교·식별 문항과 수치 문항을 많이 썼고, AD-AS·화폐시장 그래프형 새 원형은 저작하지 못했다. 화면 공개 전 판단이 필요하다.
- **CS3 와 MI3·MA3 의 '틀이 다름'은 원형 id·문항군·문장/코드 유사도로 판정**했다. 사람이 읽고 확인한 것이 아니다(정책상 출시 후 오류 신고로 보완).
- 유사도 임계값(0.5/0.85)은 휴리스틱이다. 가장 가까운 공개 문항과의 최대 유사도는 설계표에 있다(MI3 0.49, MA3 0.49, CS3 0.64).
- 일부 원형은 반려되어 쓰지 못했다: Macro 범위 밖(rule of 70·채권 가격 계산·성장 회계, 삭제), Micro `mi_model_limitations`·`mi_profit_measures_compare`·`mi_price_discrim_effect`·`mi_mu_per_dollar_table`, CS A 일부 후보 등. 반려 전체는 각 `*-summary.json` 의 `failedArchetypes`.
- 세트 문항에 자기 코드 자료를 따로 싣던 결함(css_shelf_set)을 찾아 고쳐 재생성했고(csa-x-f), 옛 후보 3행은 `csa-xa-items.json` 에서 `rejected`(superseded)로 표시했다.
- 이미 만든 후보의 생성기 문구를 후속 점검(key_much_longer·문장 구조 중복·U.S. 마침표) 때문에 일부 고쳤다(Micro `mi_policy_compare`·`mi_model_limitations`, Macro 몇 원형). 재고 항목 본문은 그대로이고 생성기만 바뀌었다.

## 미달(수치) — 이 에이전트 배정 8세트 중 5세트 미작성

| 과목 | 미작성 | 이유(엄격 규칙 하의 신규 저작 필요량) |
|---|---|---|
| Calculus AB +2 | 2 | 이전 보충 라운드 산출물(supp-c25*)은 통합 브랜치에 없고(ap-expand-5sets 브랜치의 숫자 형제 후보, 일시중지) 새 풀이 틀 원형(미분·적분·그래프)을 세트당 약 50개씩 저작해야 한다 |
| Calculus BC +1 | 1 | 위와 같음(BC 전용 FRQ 2 포함) |
| Statistics +2 | 2 | 공개 세트와 겹치지 않는 재고가 단독 MC 1·FRQ 0 뿐 — 세트당 MC 40(공유 자료 세트 포함)·FRQ 6 을 새로 저작해야 한다 |

사용 비용(이 에이전트 로컬 원장 기준): 약 $21.4(상한 $85 중). 비용이 아니라 원형 저작 분량이 한도였다.
