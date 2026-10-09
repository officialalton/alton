# College Explore 확장 — 수집 담당자용 필드 정의·저장 형식(2026-09-23)

이 문서는 "대학 탐색 UI·데이터 구조 확장 지시서"(2026-09-23)를 구현하며 확정한
**신규 필드 목록·허용 값·연도/대상집단/출처 형식**을 수집 담당 세션(`feature/university-info-sources`)에
전달하기 위한 것이다. 스키마는 `supabase/migrations/20261700000000_college_db_p11_overview_costaid_expansion.sql`
(additive, 기존 테이블 삭제·변경 없음)에 이미 반영되어 있다.

**중요**: 아래 새 필드는 아직 UI가 검증을 마치기 전까지 봇이 공개 데이터에 직접 쓰지
않는다 — 관리자 검토(승인)를 거친 값만 학생 화면에 노출된다(기존 `university_source_urls`/
`university_update_proposals` 승인 흐름과 동일). 마이그레이션 번호 조율: 이 확장은
`20261700000000`을 썼다 — 수집 담당 브랜치는 **`20261700000000` 이상 번호를 쓰지 말고,
필요하면 그 세션 전용 번호대를 새로 배정받을 것**(기존 `20261600000000`대는 이미 이 브랜치가
정리를 위임했던 대역이라 겹칠 수 있음 — 새 마이그레이션이 필요하면 통합 세션에 먼저 물어볼 것).

## 1. 공통 원칙(모든 신규 필드에 적용)

- **값·단위·기준연도·대상집단·적용대상·출처·확인일·검증상태**를 항상 함께 채운다. 이 중
  하나라도 확인이 안 되면 그 행 자체를 만들지 않는다(추측 금지 원칙 유지).
- **"0" / "해당 없음" / "학교가 공개하지 않음" / "아직 수집 못함"을 구분**한다:
  - 실제 값이 0이면 `value`(또는 `pct`)에 `0`을 넣고 `value_status='reported'`.
  - 그 학교엔 원천적으로 해당 안 되는 항목(예: 편입 전용 학교의 SAT 요구)이면
    `value_status='not_applicable'`, `value`는 null.
  - 학교가 공식적으로 공개하지 않는 항목(CDS/카탈로그에 항목 자체가 없거나 "공개 안 함"이라고
    명시)이면 `value_status='not_disclosed_by_school'`, `value`는 null.
  - **아직 우리가 못 모은 것**은 행 자체를 만들지 않는다(화면은 "정보 확인 중" 표시).
- **verification_status**: `'official'`(1차 공식 출처: CDS·학교 공식 카탈로그/파이낸셜에이드 페이지)
  / `'secondary'`(신뢰할 수 있는 2차 집계, 예: IPEDS) / `'unverified'`(등록만 됨, 화면 비노출).
  `unverified` 상태 행은 RLS가 공개 조회를 막는다 — 관리자 화면에서만 보인다.
- **source_url_id**는 반드시 `university_source_urls`의 승인된(`status='approved'`) 행을 참조한다.
  이번에 그 테이블의 `source_type` 허용값에 `'demographics'`를 추가했다(재정지원은 기존
  `'financial_aid'` 재사용).

## 2. `universities` 추가 컬럼(설정성 정보, 거의 안 바뀜)

| 컬럼 | 형식 | 비고 |
|---|---|---|
| `official_address` | text | 학교가 공식 발행한 주소 원문(우편번호 포함) |
| `official_phone` | text | 공식 대표 전화번호. 학과·입학처 개별 번호 아님 |

## 3. `university_affiliations`(신규 테이블) — 소속·태그

Ivy League, NCAA 종목, 컨소시엄 등 "확인되지 않은 홍보성 태그를 만들지 않기" 위해 항목마다
개별 출처를 요구한다.

| 컬럼 | 허용 값 | 비고 |
|---|---|---|
| `kind` | `ncaa_sport` / `athletic_conference` / `ivy_league` / `consortium` / `other` | |
| `label` | 자유 텍스트 | 예: `"Basketball"`, `"Ivy League"`, `"Big Ten Conference"` |
| `division` | 자유 텍스트(nullable) | `kind='ncaa_sport'`일 때만: `"Division I"` 등 |
| `verification_status` | 공통 원칙 참고 | `unverified`면 화면에 안 보임 — 등록만 하지 말고 반드시 출처까지 확인 후 `official`/`secondary`로 올릴 것 |

## 4. `university_demographics`(신규 테이블) — 재학생 구성(성별·인종/민족)

**주의**: 이건 입시 코호트(지원자/합격자/등록자, `university_admission_metrics.cohort`)가
아니라 **현재 재학 중인 학생 집단의 구성**이다. 다른 개념이니 섞지 말 것.

| 컬럼 | 허용 값 | 비고 |
|---|---|---|
| `cycle_year` | 정수(학년도) | 원문이 명시한 학년도(예: Fall 2024 재학생 기준이면 2024) |
| `category` | `gender_male` / `gender_female` / `gender_other` / `race_white` / `race_black` / `race_hispanic` / `race_asian_pacific_islander` / `race_native_american` / `race_two_or_more` / `race_unknown` / `race_international` | 원문 분류를 이 표로 매핑하되, 원문에 없는 세부 구분을 만들지 말 것 — 원문 카테고리가 다르게 나뉘어 있으면(예: Asian과 Pacific Islander가 원문에서 분리) `notes`에 원문 표현을 그대로 남기고 가장 가까운 카테고리에 매핑 |
| `population_scope` | `all_students`(전체 재학생 대상) / `us_students_only`(미국 내/국내 학생만 대상) | 원문이 "Among domestic students"처럼 범위를 명시하면 반드시 `us_students_only`로. 범위 명시가 없으면 `all_students` |
| `pct` | 숫자(0~100) | 소수점 포함 가능 |
| `value_status` | 공통 원칙 참고 | |
| unique 제약 | `(university_id, cycle_year, category, population_scope)` | 같은 조합 중복 입력 시 `ON CONFLICT`로 갱신 |

**재학생 총수(인원수, 비율 아님)**는 이 테이블이 아니라 기존
`university_admission_metrics`에 새로 추가한 metric_key `total_undergrad_enrollment`
(cohort=`'enrolled'`, unit=`'count'`)로 넣는다 — 성별·인종 비율과 코호트 수치가 원래
연동되는 값이라 기존 패턴을 그대로 재사용했다.

## 5. `university_financial_aid_programs`(신규 테이블) — 장학금·대출·근로장학

| 컬럼 | 허용 값 | 비고 |
|---|---|---|
| `program_type` | `need_based_grant` / `merit_scholarship` / `federal_loan` / `work_study` | |
| `name` | 자유 텍스트 | 예: `"Federal Pell Grant"`, `"Presidential Scholarship"` |
| `eligibility_scope` | `us_citizen_permanent_resident` / `all_students` / `other` | **연방 대출·연방 근로장학은 거의 항상 `us_citizen_permanent_resident`** — 국제학생 화면에 적용 가능한 것처럼 보이면 안 되므로 이 값을 반드시 정확히 채울 것. 확실하지 않으면 `other` + `notes`에 원문 조건 그대로 |
| `recipient_pct` | 숫자(0~100, nullable) | 예: "전일제 신입생 중 연방 대출 수혜 2%" |
| `avg_award_amount` / `award_amount_min` / `award_amount_max` | 숫자(USD, nullable) | |
| `renewal_condition` | 자유 텍스트(nullable) | 예: "매년 재신청 필요", "GPA 3.0 이상 유지 조건" |
| `cycle_year` | 정수(nullable) | 원문이 특정 학년도 통계면 채움(예: Pell Grant 수혜율) |
| `value_status` | 공통 원칙 참고 | 학교가 특정 프로그램 자체를 운영 안 하면 그 프로그램 행 자체를 만들지 말 것(값이 아니라 존재 여부이므로) |

## 6. `university_majors` 추가 컬럼 — 전공/학위/트랙 구분

| 컬럼 | 허용 값 | 비고 |
|---|---|---|
| `degree_level` | 학교 카탈로그 표기 그대로(예: `"BA"`, `"BS"`, `"BFA"`, `"BArch"`) | 확인 안 되면 null(추측 금지) |
| `is_track` | `true`/`false` | 카탈로그에서 상위 전공 아래 "트랙/concentration"으로 나열된 항목이면 `true` |
| `parent_major_id` | 같은 테이블의 다른 행 id | `is_track=true`일 때만 채움. 독립 전공이면 null |

**전공 수 집계**(화면에 "OO대학은 N개 전공" 표시)는 `is_track=false`인 행만 센다 —
트랙까지 합쳐 전공 수를 부풀리지 않는다.

## 7. 변경안 제출 형식(봇 자동 수집 시)

기존 `university_update_proposals` 흐름을 그대로 쓴다 — `target_table`에 새 테이블 이름
(`universities` / `university_affiliations` / `university_demographics` /
`university_financial_aid_programs` / `university_majors`)을 그대로 채울 수 있게 CHECK
제약을 확장해뒀다. `target_record_key`(jsonb)에는 각 테이블의 unique key를 그대로 넣는다
— 예: 재학생 구성이면 `{"cycle_year":2024,"category":"race_white","population_scope":"us_students_only"}`.

**새 필드는 관리자 승인 전까지 공개 데이터에 반영되지 않는다**(기존 승인 게이트 재사용) —
봇이 이 필드들을 직접 `universities`/`university_demographics` 등에 UPSERT하지 말고,
반드시 `university_update_proposals`를 거쳐 관리자가 승인하게 할 것. UI가 아직 이 신규
데이터의 표시 방식을 최종 검증 중이므로, 검증 전 데이터가 쌓이면 나중에 표시 형식이
바뀔 때 재작업이 필요할 수 있다 — 통합 세션이 "이제 실데이터를 넣어도 된다"고 알리기 전에는
UAT용 소량 샘플 외에는 대량 수집을 미룰 것을 권장한다.

## 8. 명시적으로 만들지 않는 것

- 개인 합격 확률(`Your chances`, `Reach` 등급) — 근거 없는 예측이라 정책상 금지.
- "Estimate my personalized net cost" 같은 개인화 순부담액 계산기 — 검증된 계산 모델이
  없어 UI에도 동작하는 기능처럼 노출하지 않는다.
- 첨부 참고 화면(CollegeVine 등)의 숫자 자체 — UI 레이아웃 참고용일 뿐, 그 값을 DB에
  그대로 넣지 않는다.
