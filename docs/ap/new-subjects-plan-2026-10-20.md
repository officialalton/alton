# AP 신규 10과목 기반 작업 결과 + 원형 라이브러리 저작 계획 (2026-10-20)

오너 지시(2026-10-20): 기존 14개 AP 과목 외에 10과목을 더하고 과목당 모의고사 5세트가 목표. 이 문서는 첫 단계(기반 작업)의 결과와 다음 단계(원형 저작) 계획이다. 원격 DB 쓰기·공개·유료 API 호출은 하지 않았다.

## 1. 이번에 끝난 것

| 항목 | 위치 |
|---|---|
| 과목별 CED 조사 → 커리큘럼 JSON 10개(기존 14과목과 같은 구조, 구조 검증 오류 0) | `data/ap/curriculum-2027/<code>.json` |
| 코드·표시 이름·섹션 레이아웃·FRQ 유형·종이/디지털 전달·시험 도구·MC 선택지 수·MC 미평가 스킬 | `lib/ap-exam/layouts.ts`, `lib/problem-taxonomy.ts`, `lib/ap-exam/frq-delivery.ts`, `lib/exam-tools/subject-tools.ts`, `lib/ap-generation/gates.ts`, `lib/ap-curriculum/types.ts` |
| 시드 SQL(`.sql/.verify.sql/.rollback.sql`, **원격 미적용**) | `data/ap/seed-sql/<code>.*` |
| 종이 FRQ 과목 DB 함수 갱신 마이그레이션(**미적용**; 총괄이 번호 확정·적용) | `supabase/migrations/20262100000620_ap_frq_paper_new_subjects.sql` |
| 단위 테스트(레이아웃 값·이름·분류·FRQ 유형·기존 14과목 불변·공개 노출 차단) | `lib/ap-exam/layouts-new-subjects.test.ts`, `lib/landing/subjects.test.ts` 외 |

**공개 노출 차단**: `AP_SUBJECT_NAME`에 넣으면 공개 과목 페이지(`/practice-tests/ap-…`)와 목록이 자동으로 생기므로, 세트가 공개되기 전까지는 `AP_PENDING_PUBLIC_SUBJECTS`(layouts.ts)로 공개 페이지·목록·slug를 막았다(404). 세트를 공개할 때 총괄이 해당 과목을 이 배열에서 뺀다.

## 2. 과목별 조사 결과(2027 시험 형식, 출처 AP Central·CED PDF, 2026-10-20 읽음)

| 과목 | MC | FRQ | 계산기 | 단원 | 검증 수준 |
|---|---|---|---|---|---|
| Physics 2 | 42 / 85분 | 4 / 95분(MR 10·TBR 12·EDA 10·QQT 8) | 허용 | 7(번호 9–15) | CED 전문 확인 |
| Physics C: Mechanics | 42 / 85분 | 4 / 95분 | 허용 | 7 | **CED 전문이 10MB 초과로 못 읽음** → AP Central 페이지(2027 MC 수·시간 변경만 명시)와 같은 계열 CED의 값 인용. FRQ 배점·스킬 가중치 비움. **공개 전 CED 재확인 필요** |
| Physics C: E&M | 42 / 85분 | 4 / 95분(10/12/10/8) | 허용 | 6(번호 8–13) | CED 전문 확인 |
| Environmental Science | 80 / 90분 | 3 / 70분(설계·데이터·계산) | 허용 | 9(99토픽) | 시험 페이지·Course at a Glance만(CED 전문 10MB 초과). 선택지 수·FRQ 배점 미확인 |
| US Government & Politics | 55 / 80분 | 4 / 100분(3·4·4·6점) | 언급 없음 | 5 | CED 전문 확인 |
| Comparative Government & Politics | 55 / 60분 | 4 / 90분(4·5·5·5점) | 언급 없음 | 5 | CED 전문 확인 |
| Human Geography | 60 / 60분 | 3 / 75분(각 7점) | 언급 없음 | 7 | 게시된 CED(2020판)+시험 페이지. 선택지 수 5는 CED 샘플 근거, 2027 재확인 필요 |
| Computer Science Principles | 70 / 120분(다중 선택 8) | 작성형 2문항(WR1·2a·2b·2c) / 60분 + **Create 수행평가 30%(시험 당일 밖)** | 해당 없음 | 5 빅 아이디어 | CED 전문 확인 |
| European History | 55 / 55분 | SAQ 3 / 40분 + DBQ 60분(읽기 15 포함) + LEQ 40분 | 없음 | 9(단원별 10–15%) | CED 전문 확인. 2027 SAQ·LEQ 문항 형식 개편 내용은 확인 못 함 |
| Precalculus | 42(파트 A 29·65분 계산기 불가 / 파트 B 13·40분 그래핑 필수) | 4(파트 A 2·35분 계산기 / 파트 B 2·35분 불가, 각 6점) | 파트별 | 3(단원 4는 시험 제외) | CED(effective Fall 2026) 전문 확인 |

단원 MC 가중치는 10과목 모두 공식 값(범위)을 `weights`에 기록했다. 스킬 가중치는 Physics 2·C:E&M·Human Geography만 기록했다(나머지는 CED에서 읽지 못함). 토픽별 스킬은 공식 "권장 스킬"이 아니라 ALTON 편집 매핑이다(각 JSON `designNotes` 명시).

## 3. 주의할 점(결정 필요·후속)

1. **CS Principles는 "Full Practice Exam"으로 부르면 안 된다.** 시험 당일 레이아웃에는 MC + 작성형만 있고 Create 수행평가(30%)가 빠진다. 작성형은 학생 자신의 Create 과제를 전제로 하므로 ALTON이 완전히 재현할 수 없다. 권장: MC Practice 세트 + 작성형은 연습 형식으로 별도 표기.
2. **Precalculus 부분 세트(계산기 불가 MC / 계산기 MC / FRQ)**는 `AP_PARTIAL_SUBJECTS`(AB·BC 전용)를 건드리지 않아 아직 지원되지 않는다. 풀 세트 중심이면 필요 없다.
3. **다중 선택 MC**(CSP 8문항, 2개 선택) 렌더·채점 지원 여부 미확인. 사용하려면 응시 화면·채점 확장이 필요하다.
4. 신규 물리 3과목·APES·CSP의 시험 중 참조 패널(식 시트·Exam Reference Sheet)은 Physics 1 패널을 재사용하지 않고 비워 두었다(자체 문구 필요, 후속).
5. 마이그레이션 `…620`은 번호 충돌 가능성이 있으므로 총괄이 확인 후 적용(내용은 `create or replace`라 재실행 안전).
6. 확인 못 한 값은 임의로 채우지 않았다: C:Mechanics FRQ 배점, APES FRQ 배점·MC 선택지 수, CSP 작성형 배점(WR1 3점만 CED 사례 확인).

## 4. 원형(archetype) 라이브러리 저작 계획

### 4.1 엄격 규칙에서 필요한 규모(세트 5개, 세트 간 원형 겹침 0)
한 세트의 MC 문항은 모두 서로 다른 풀이 틀·자료 형태여야 한다(BI3·BI4/PH5·PH6 라운드 방식과 같다). 과목당 5세트 = **MC 원형 약 (세트당 MC 수 − 세트 문항 보정) × 5**, FRQ는 세트당 유형 수 × 5 시나리오.

| 과목 | 세트당 MC | 5세트 MC 원형(대략) | 5세트 FRQ 시나리오 | 자료 형태 부담 |
|---|---|---|---|---|
| Physics C: Mechanics | 42 | 200 | 20 | 그림(자유물체도·그래프) 필수 문항 다수 |
| Physics C: E&M | 42 | 200 | 20 | 회로도·장 그림 |
| Physics 2 | 42 | 200 | 20 | 회로·광선·PV 그래프·스펙트럼 |
| Precalculus | 42 | 200 | 20 | 그래프 필수(계산기 파트), 극좌표·삼각 그래프 |
| CS Principles | 70 | 330 | 해당 없음(작성형 템플릿 20) | 의사코드 추적, 읽기 지문 세트(5문항), 다중 선택 |
| Environmental Science | 80 | 380 | 15 | 데이터 표·그래프·모형 세트(세트당 6–10묶음) |
| US Government | 55 | 260 | 20 | 정량 세트 5·텍스트 세트 2, SCOTUS 지식 문항 |
| Comparative Government | 55 | 260 | 20 | 6개국 비교 문항, 정량 세트 3·정성 세트 2 |
| Human Geography | 60 | 285 | 15 | 지도·사진·정량 자료 30–40%(공개 가능한 지도 출처 필요) |
| European History | 55 | 260 | SAQ 15 + DBQ 5 + LEQ 5 | 실제 출처 문서(출처 표기 필수, 공공 도메인 확인) |

지식형 과목(Gov·Euro·HuGeo·APES MC)은 숫자 템플릿이 아니라 문항 단위 저작·검증이라 "원형 수 = 문항 수"에 가깝고, 한계는 API 비용보다 **저작·검증 분량**이다(2026-10-19 라운드 문서도 같은 결론).

### 4.2 기존 14과목 구조 재사용 가능성

| 신규 과목 | 재사용 대상 | 재사용 가능 범위(추정) | 새로 만들어야 하는 것 |
|---|---|---|---|
| Physics C: Mechanics | Physics 1 원형·`phys_common.py`·FRQ 4유형 틀·`physics1.ts` 게이트 | 구조·도우미·게이트 약 60%(단원 1–7이 거의 1:1, 미적분 단계 추가) | 미분·적분 풀이 단계, 회전·진동·궤도 확장 |
| Physics C: E&M | Physics 1 틀 + Physics 2 신규 원형(회로·정전기) | 틀 약 50% | 가우스 법칙·비오-사바르·암페어·유도·RL/LC |
| Physics 2 | Physics 1 틀·그림 갤러리 | 틀·FRQ 유형 슬롯 약 40%, 내용은 거의 신규(열·전기·광학·현대) | 단원 9–15 전부 |
| Precalculus | Calculus AB(그래프 단계 59원형·계산기 파트 분리·`calc_*` 도구) | 함수 그래프·표 읽기 약 40% | 지수·로그 모델, 삼각·극좌표, FRQ 4유형(모델링 2) |
| CS Principles | CS A(코드 추적 18 원형) | 코드 읽기·추적 약 25% | 데이터·네트워크·영향 지문 세트, 의사코드 참조표 |
| Environmental Science | Biology·Chemistry 데이터/계산 FRQ 틀 | 약 35% | 80문항 구성, 정량·정성 세트 |
| US / Comparative Government | US History 정량·텍스트 세트 생성기, Micro/Macro 자료 세트, 에세이 AI 채점 인프라 | 인프라 약 40% | SCOTUS·필수 문서·6개국 지식, 논증 에세이·SCOTUS 비교 루브릭(보정 필요) |
| Human Geography | US/World History 출처 기반 틀·그림 게이트 | 약 30% | 지도·이미지 자료 출처 |
| European History | US/World History 파이프라인·`*-sources`·에세이 채점 | 인프라 약 70%(내용은 전부 신규) | 단원 1–9 문서·SAQ·DBQ·LEQ |

### 4.3 난이도·자료 형태 원칙
공식 비중(단원·스킬·자료 비율)을 따르고 1/2/3 난이도 신호를 세트 안에서 분산한다. 그림이 필요한 문항은 학생 화면 본문에 정보가 있어야 하며(설명에만 있는 값 금지), 실제 출처 과목(Euro·Gov·HuGeo)은 출처 표기를 필수로 한다.

### 4.4 예상 비용·소요(추정, 신규 과목 실측 아님)
근거: 이전 라운드 원장 — Bio+Phys 4세트 약 $17.3(세트당 약 $4.3), World History 기초 약 $16, US History 기초 약 $14.5, English Lit 기초 약 $12, 마이크로·CSA·매크로 확장 라운드 약 $21.4. 구성: **기초(첫 2세트, 원형·게이트·검증 포함) + 이후 세트당 증분**.

| 순서 | 과목 | 기초(2세트) | 증분/세트 | 5세트 합계 | 3세트 합계 |
|---|---|---|---|---|---|
| 1 | Physics C: Mechanics | $12 | $4.5 | **약 $26** | $16.5 |
| 2 | Precalculus | $14 | $4 | **약 $26** | $18 |
| 3 | Physics C: E&M | $16 | $5 | **약 $31** | $21 |
| 4 | Physics 2(E&M 이후) | $15 | $4.5 | **약 $28** | $19.5 |
| 5 | European History | $16 | $5.5 | **약 $32** | $21.5 |
| 6 | CS Principles(MC 중심) | $15 | $4.5 | **약 $28** | $19.5 |
| 7 | US Government | $18 | $6 | **약 $36** | $24 |
| 8 | Comparative Government(US Gov 이후) | $17 | $5.5 | **약 $34** | $22.5 |
| 9 | Human Geography | $20 | $6.5 | **약 $40** | $26.5 |
| 10 | Environmental Science(80문항) | $20 | $8 | **약 $44** | $28 |
| | 합계 | | | **약 $325** | **약 $217** |

범위는 ±25%로 본다. 원장 상태(2026-10-20 `ledger-total.ts`): 누적 $355.6 / 중단선 $640 / 여유 **$284.4**.

### 4.5 5세트 달성 현실성(예산 상한 $650, 여유 약 $280 기준)
- **10과목 × 5세트는 예산 안에서 불가능하다**: 약 $325 필요 > 여유 $284, 그리고 같은 상한을 SAT 30세트·기존 AP 20세트 확장이 함께 쓴다.
- **3세트씩 10과목**도 약 $217(여유의 76%)로 다른 작업과 충돌한다.
- 권장 구성(예산 약 $245, 중단선 $640 준수, 과목별로 첫 라운드 실측 비용을 보고 다음 과목 진행 여부를 판단):
  - **5세트**: Physics C: Mechanics, Precalculus, Physics C: E&M, European History(합 약 $115)
  - **3세트**: Physics 2, CS Principles(MC 중심), US Government(합 약 $68)
  - **2세트(기초만)**: Comparative Government, Human Geography, Environmental Science(합 약 $60)
- 비용보다 큰 제약: **원형 저작 분량**. 과목당 위 표의 200~380 원형을 한 번에 쓸 수 없으므로 BI3·BI4 라운드처럼 "과목당 2세트 단위 라운드"로 나누고 라운드마다 정확 배정·화면 증거를 남긴다. 한 에이전트가 하루에 소화한 규모는 약 2과목 × 2세트(위 Bio·Phys 라운드)였다.

### 4.6 권장 착수 순서와 이유
1. **Physics C: Mechanics** — Physics 1 틀·게이트 재사용이 가장 크고 단원 구성이 안정적.
2. **Precalculus** — Calculus AB 그래프·계산기 파트 인프라 재사용, 공식 형식이 AB와 같은 분할.
3. **Physics C: E&M** → 4. **Physics 2** — 전기·회로 원형을 먼저 만들어 Physics 2와 공유(Physics 2는 열·광학·현대 물리가 별도).
5. **European History** — US/World History 파이프라인·루브릭 인프라를 거의 그대로 사용(내용만 신규).
6. **CS Principles** — MC 위주로 먼저(작성형·다중 선택 이슈 결정 필요).
7. **US Government** → 8. **Comparative Government** — 정량·텍스트 세트와 논증 에세이 파이프라인을 US Gov에서 만들고 Comp Gov가 재사용(AI 채점 루브릭 보정이 추가 $2–3).
9. **Human Geography**(지도·이미지 출처 확보 선행) → 10. **Environmental Science**(80문항으로 가장 비쌈, 마지막).

### 4.7 각 과목 착수 전 필요한 기반(총괄 작업)
시드 SQL 원격 적용(`supabase db query --linked -f data/ap/seed-sql/<code>.sql`, 검증 SQL로 확인), 마이그레이션 `…620` 적용, 과목별 생성 플러그인(`lib/ap-generation/subjects/*.ts`)·세트 ID 접두(`assemble-draft.ts`의 `SET_PREFIX_SUBJECT`, 현재 신규 과목 미등록)·배치 등록(`lib/ap-admin/batches.ts`), 공개 시 `AP_PENDING_PUBLIC_SUBJECTS`에서 제거.
