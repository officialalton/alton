# AB 풀 모의고사 1세트 선택 결과 (자동 생성 — `ab-select.ts`)

결과: **모든 제약 통과(검증기 재계산)**. 방식은 고정 시드 탐색 + 독립 검증기이며, 못 찾은 경우가 불가능의 증명은 아니다. 사용 이력(겹침): **미반영** — 비프로덕션 사용 이력을 `published-usage.json` 으로 주면 풀 모의고사 겹침 0 · 연습 세트 재노출을 계산한다.

## 제약 (official = 공식, internal = 내부 설계 조건; 서로 섞어 표기하지 않는다)
| 구분 | 제약 | 결과 | 값 |
|---|---|---|---|
| official | MC Part A 29(계산기 불가) + Part B 13(계산기 필수) | 통과 | 29+13 |
| official | FRQ Part A 2(계산기) + Part B 4(계산기 불가) | 통과 | 2+4 |
| official | MC 단원 비중(공식 범위) | 통과 | 1:5 2:5 3:3 4:5 5:8 6:7 7:4 8:5 |
| official | MC 스킬 범주 비중(공식 범위) | 통과 | 1:27 2:10 3:5 |
| internal | MC 문항군당 2개 이하 | 통과 | 최대 2 |
| internal | MC 서로 다른 문항군 >= 21 | 통과 | 33 |
| internal | 그래프가 풀이에 필수인 MC >= 10(장식·보조 그래프 제외, 공식 기준 아님) | 통과 | 10 |
| internal | FRQ 6개 모두 다른 유형·문항군 | 통과 | 6유형 |
| internal | 항목 중복 없음 | 통과 |  |
| internal | 다른 풀 모의고사와 겹침 0(기본 정책) | 통과 | 0 |

## 단원 구성 (코드 = CED 단원 번호, 이름 = 커리큘럼 파일의 CED 이름)
| 단원 | 이름 | MC A | MC B | 합계 |
|---|---|---|---|---|
| 1 | Limits and Continuity | 3 | 2 | 5 |
| 2 | Differentiation: Definition and Fundamental Properties | 5 | 0 | 5 |
| 3 | Differentiation: Composite, Implicit, and Inverse Functions | 3 | 0 | 3 |
| 4 | Contextual Applications of Differentiation | 2 | 3 | 5 |
| 5 | Analytical Applications of Differentiation | 5 | 3 | 8 |
| 6 | Integration and Accumulation of Change | 6 | 1 | 7 |
| 7 | Differential Equations | 3 | 1 | 4 |
| 8 | Applications of Integration | 2 | 3 | 5 |

학생 화면의 `Covers Units …` 문구는 단원 번호(코드)만 쓴다(`lib/ap-exam/layouts.ts`); 이름을 쓰는 화면은 위 CED 이름과 일치해야 한다.

## 48건 목록 (검증 에이전트 입력) — 화면 검증 완료 40 / 검증 대기 8
| 구역 | # | 키 | 단원.키워드 | 스킬 | 문항군 | 그래프 필수 | 상태 |
|---|---|---|---|---|---|---|---|
| MC Part A (계산기 불가, 62분) | 1 | run1:ap_calculus_ab-c029-k2 | 8.8 | 2 | fam:run1:ap_calculus_ab-c029-k2 | 예 | 화면 검증 완료 |
| MC Part A (계산기 불가, 62분) | 2 | run1:ap_calculus_ab-c007-k2 | 2.7 | 1 | fam:run1:ap_calculus_ab-c007-k2 |  | 화면 검증 완료 |
| MC Part A (계산기 불가, 62분) | 3 | run1:ap_calculus_ab-c008-k3 | 2.9 | 1 | fam:run1:ap_calculus_ab-c008-k3 |  | 화면 검증 완료 |
| MC Part A (계산기 불가, 62분) | 4 | run2:ap_calculus_ab-m04-k1 | 1.16 | 3 | fam:run2:ap_calculus_ab-m04-k0 |  | 화면 검증 완료 |
| MC Part A (계산기 불가, 62분) | 5 | run2:ap_calculus_ab-m13-k1 | 4.6 | 1 | fam:run2:ap_calculus_ab-m13-k0 |  | 화면 검증 완료 |
| MC Part A (계산기 불가, 62분) | 6 | v45ab-final:v4-ab:ap_calculus_ab-m02-k2 | 6.4 | 2 | fam:v45ab-final:v4-ab:ap_calculus_ab-m02-k0 | 예 | 검증 대기 |
| MC Part A (계산기 불가, 62분) | 7 | v45ab-final:v4-ab:ap_calculus_ab-m01-k2 | 5.4 | 2 | fam:v45ab-final:v4-ab:ap_calculus_ab-m01-k0 | 예 | 검증 대기 |
| MC Part A (계산기 불가, 62분) | 8 | run2:ap_calculus_ab-m10-k0 | 3.2 | 1 | fam:run2:ap_calculus_ab-m10-k0 |  | 화면 검증 완료 |
| MC Part A (계산기 불가, 62분) | 9 | run2:ap_calculus_ab-m16-k0 | 5.4 | 3 | fam:run2:ap_calculus_ab-m16-k0 |  | 화면 검증 완료 |
| MC Part A (계산기 불가, 62분) | 10 | run2:ap_calculus_ab-m08-k2 | 2.9 | 1 | fam:run2:ap_calculus_ab-m08-k0 |  | 화면 검증 완료 |
| MC Part A (계산기 불가, 62분) | 11 | v45ab-final:v4-ab:ap_calculus_ab-m02-k1 | 6.4 | 2 | fam:v45ab-final:v4-ab:ap_calculus_ab-m02-k0 | 예 | 검증 대기 |
| MC Part A (계산기 불가, 62분) | 12 | run2:ap_calculus_ab-m08-k1 | 2.9 | 1 | fam:run2:ap_calculus_ab-m08-k0 |  | 화면 검증 완료 |
| MC Part A (계산기 불가, 62분) | 13 | run1:ap_calculus_ab-c022-k2 | 6.6 | 1 | fam:run1:ap_calculus_ab-c022-k2 |  | 화면 검증 완료 |
| MC Part A (계산기 불가, 62분) | 14 | s1a-final:ap_calculus_ab-m19-k0 | 5.11 | 1 | fam:run2:ap_calculus_ab-m19-k0 |  | 화면 검증 완료 |
| MC Part A (계산기 불가, 62분) | 15 | run2:ap_calculus_ab-m25-k1 | 7.3 | 2 | fam:run2:ap_calculus_ab-m25-k0 |  | 화면 검증 완료 |
| MC Part A (계산기 불가, 62분) | 16 | run1:ap_calculus_ab-c020-k0 | 6.2 | 1 | fam:run1:ap_calculus_ab-c020-k0 | 예 | 화면 검증 완료 |
| MC Part A (계산기 불가, 62분) | 17 | run1:ap_calculus_ab-c010-k0 | 3.5 | 1 | fam:run1:ap_calculus_ab-c010-k0 |  | 화면 검증 완료 |
| MC Part A (계산기 불가, 62분) | 18 | v45ab-final:v4-ab:ap_calculus_ab-m01-k3 | 5.4 | 2 | fam:v45ab-final:v4-ab:ap_calculus_ab-m01-k0 | 예 | 검증 대기 |
| MC Part A (계산기 불가, 62분) | 19 | run2:ap_calculus_ab-m22-k2 | 6.6 | 1 | fam:run2:ap_calculus_ab-m22-k0 |  | 화면 검증 완료 |
| MC Part A (계산기 불가, 62분) | 20 | run1:ap_calculus_ab-c004-k2 | 1.15 | 2 | fam:run1:ap_calculus_ab-c004-k2 | 예 | 화면 검증 완료 |
| MC Part A (계산기 불가, 62분) | 21 | run1:ap_calculus_ab-c027-k3 | 8.2 | 1 | fam:run1:ap_calculus_ab-c027-k3 | 예 | 화면 검증 완료 |
| MC Part A (계산기 불가, 62분) | 22 | s1a-final:ap_calculus_ab-m14-k1 | 4.7 | 1 | fam:run2:ap_calculus_ab-m14-k0 |  | 화면 검증 완료 |
| MC Part A (계산기 불가, 62분) | 23 | run2:ap_calculus_ab-m19-k1 | 5.11 | 1 | fam:run2:ap_calculus_ab-m19-k0 |  | 화면 검증 완료 |
| MC Part A (계산기 불가, 62분) | 24 | run2:ap_calculus_ab-m26-k1 | 7.7 | 1 | fam:run2:ap_calculus_ab-m26-k0 |  | 화면 검증 완료 |
| MC Part A (계산기 불가, 62분) | 25 | run1:ap_calculus_ab-c001-k2 | 1.3 | 2 | fam:run1:ap_calculus_ab-c001-k2 | 예 | 화면 검증 완료 |
| MC Part A (계산기 불가, 62분) | 26 | run2:ap_calculus_ab-m06-k1 | 2.4 | 3 | fam:run2:ap_calculus_ab-m06-k0 |  | 화면 검증 완료 |
| MC Part A (계산기 불가, 62분) | 27 | run2:ap_calculus_ab-m20-k1 | 6.2 | 2 | fam:run2:ap_calculus_ab-m20-k0 |  | 화면 검증 완료 |
| MC Part A (계산기 불가, 62분) | 28 | run1:ap_calculus_ab-c026-k2 | 7.7 | 1 | fam:run1:ap_calculus_ab-c026-k2 |  | 화면 검증 완료 |
| MC Part A (계산기 불가, 62분) | 29 | run2:ap_calculus_ab-m10-k2 | 3.2 | 1 | fam:run2:ap_calculus_ab-m10-k0 |  | 화면 검증 완료 |
| MC Part B (계산기 필수, 38분) | 1 | v1ab-final:ap_calculus_ab-m02-k5 | 1.16 | 1 | fam:v1ab-final:ap_calculus_ab-m02-k0 |  | 검증 대기 |
| MC Part B (계산기 필수, 38분) | 2 | v1ab-final:ap_calculus_ab-m03-k0 | 7.7 | 1 | fam:v1ab-final:ap_calculus_ab-m03-k0 |  | 검증 대기 |
| MC Part B (계산기 필수, 38분) | 3 | run1:ap_calculus_ab-c011-k2 | 4.1 | 1 | fam:run1:ap_calculus_ab-c011-k2 |  | 화면 검증 완료 |
| MC Part B (계산기 필수, 38분) | 4 | run2:ap_calculus_ab-m11-k0 | 4.2 | 1 | fam:run2:ap_calculus_ab-m11-k0 |  | 화면 검증 완료 |
| MC Part B (계산기 필수, 38분) | 5 | run1:ap_calculus_ab-c018-k1 | 5.9 | 2 | fam:run1:ap_calculus_ab-c018-k1 | 예 | 화면 검증 완료 |
| MC Part B (계산기 필수, 38분) | 6 | run2:ap_calculus_ab-m15-k3 | 5.1 | 3 | fam:run2:ap_calculus_ab-m15-k0 |  | 화면 검증 완료 |
| MC Part B (계산기 필수, 38분) | 7 | run2:ap_calculus_ab-m29-k3 | 8.7 | 1 | fam:run2:ap_calculus_ab-m29-k0 |  | 화면 검증 완료 |
| MC Part B (계산기 필수, 38분) | 8 | v1ab-final:ap_calculus_ab-m02-k0 | 1.16 | 1 | fam:v1ab-final:ap_calculus_ab-m02-k0 |  | 검증 대기 |
| MC Part B (계산기 필수, 38분) | 9 | run2:ap_calculus_ab-m23-k1 | 6.7 | 1 | fam:run2:ap_calculus_ab-m23-k1 |  | 화면 검증 완료 |
| MC Part B (계산기 필수, 38분) | 10 | run2:ap_calculus_ab-m30-k1 | 8.3 | 1 | fam:run2:ap_calculus_ab-m30-k0 |  | 화면 검증 완료 |
| MC Part B (계산기 필수, 38분) | 11 | s1a-final:ap_calculus_ab-m15-k0 | 5.1 | 3 | fam:run2:ap_calculus_ab-m15-k0 |  | 화면 검증 완료 |
| MC Part B (계산기 필수, 38분) | 12 | run2:ap_calculus_ab-m29-k0 | 8.7 | 1 | fam:run2:ap_calculus_ab-m29-k0 |  | 화면 검증 완료 |
| MC Part B (계산기 필수, 38분) | 13 | s1a-final:ap_calculus_ab-m11-k1 | 4.2 | 1 | fam:run2:ap_calculus_ab-m11-k0 |  | 화면 검증 완료 |
| FRQ Part A (계산기, 30분) | 1 | run1:ap_calculus_ab-f01-k6 | 6.2 | 2 | fam:run1:ap_calculus_ab-f01-k6 |  | 화면 검증 완료 |
| FRQ Part A (계산기, 30분) | 2 | run2:ap_calculus_ab-f04-k0 | 8.4 | 1 | fam:run2:ap_calculus_ab-f04-k0 | 예 | 화면 검증 완료 |
| FRQ Part B (계산기 불가, 60분) | 1 | run1:ap_calculus_ab-f02-k5 | 5.9 | 3 | fam:run1:ap_calculus_ab-f02-k5 | 예 | 화면 검증 완료 |
| FRQ Part B (계산기 불가, 60분) | 2 | run1:ap_calculus_ab-f03-k1 | 7.6 | 1 | fam:run1:ap_calculus_ab-f03-k1 |  | 화면 검증 완료 |
| FRQ Part B (계산기 불가, 60분) | 3 | run2:ap_calculus_ab-f03-k0 | 7.7 | 1 | fam:run2:ap_calculus_ab-f03-k0 |  | 화면 검증 완료 |
| FRQ Part B (계산기 불가, 60분) | 4 | v45ab-final:v4-ab:ap_calculus_ab-f02-k0 | 4.5 | 1 | fam:v45ab-final:v4-ab:ap_calculus_ab-f02-k0 |  | 검증 대기 |

## 실패 시 교체 절차(재고 우선, 생성 없음)
1. 검증 에이전트가 탈락 키를 모은다.
2. `npx tsx scripts/ap-generation/ab-select.ts --prev data/ap/stock/ab-full-set-selection.json --exclude <키1,키2>` — 탈락 슬롯만 재고에서 교체하고 **세트 전체 제약을 다시 검증**한다(같은 구역 교체 우선, 실패하면 전체 재탐색).
3. 해가 없으면(종료 코드 3) 부족한 구조(단원·계산기·그래프 필수·FRQ 유형)와 최소 생성 비용을 적어 별도 승인을 요청한다(예비 생성은 이번에 미승인).

## 비프로덕션 조립 명령 (dry-run — 실행하지 않음)
```
npx tsx scripts/ap-generation/ab-select.ts            # 선택 + 검증 + 이 문서/JSON 재생성(무료)
npx tsx scripts/ap-generation/ab-select.ts --exclude <키들> --prev data/ap/stock/ab-full-set-selection.json   # 탈락 교체
# 조립·게시는 오너/배포 담당: 위 48건의 problem_version 으로 ap_mock_exam 풀 세트 행을 비프로덕션에 만드는 단계(기존 연습 세트 게시 스크립트와 동일 경로). 이 문서는 조립을 실행하지 않는다.
```
