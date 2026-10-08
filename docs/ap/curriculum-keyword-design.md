# AP 커리큘럼·키워드 설계 (2026-10-08, 오너 부재로 총괄이 권장안을 직접 결정)

원칙: **공식 CED의 단원·토픽을 단일 뼈대**로 삼고, 한 번 만들면 바꾸기 어려우므로 안정 코드·버전·보호 규칙을 먼저 정한다. 키워드는 **내용 축**만이다. 스킬·문항 구조는 별도 축이며 키워드를 문제 유형으로 쓰지 않는다. 생성 계획 단위 = **키워드 코드 × 스킬 × 구조**(`ap_stock_cells`).

## 1. 현재 구조 조사 결과(코드 근거)
- 과목 `subjects(name unique, archived_at)` → 템플릿 단원 `subject_template_units(subject_id, position, unit_title)` → 단원-키워드 `subject_template_unit_keywords` → 키워드 `subject_keywords(subject_id, label, normalized_label unique per subject, status, domain_code, skill_code, folder_id, sort_order)`. 회차·교재·문제(`problem_keywords`, confirmed 문제만·과목 일치 트리거)는 모두 **keyword id** 로 참조.
- 키워드 폴더 `subject_keyword_folders`(20262100000331): 관리자가 이름·순서를 바꾸는 UI 분류. SAT 키워드는 "College Board 스킬 = 키워드"라서 키워드와 스킬이 같은 축이었다 — **AP에서는 분리**한다.
- `problems.exam_system('sat_rw'|'sat_math'|'ap')`, `problems.ap_subject`(코드), 앱 상수 `AP_SUBJECTS`(14개, 전부 `supported:false`)가 하드코딩 목록이다 → 기준을 DB(`subjects.ap_subject_code`)로 옮긴다.
- 선택 UI(`GroupedKeywordList/Options`, `KeywordDictionaryManager`)는 `group.ts` 폴더 모드로 "폴더 > 키워드"를 이미 그린다 → AP 단원 = 폴더로 시드하면 새 컴포넌트 없이 "과목 > 단원 > 토픽"이 나온다.

## 2. 계층 (결정 D1)
`AP 과목(subjects 행) > 공식 단원(템플릿 단원 + 폴더) > 공식 토픽(키워드 level 1) > 세부 키워드(키워드 level 2)`. 깊이 상한 4단. 세부 키워드는 **출시 시점부터 허용**(수업 구성 단위). 세부 키워드 아래 하위 단계는 만들지 않는다.

## 3. 안정 ID·코드 (D2)
- 불변 코드는 별도 컬럼: 단원 `official_code`(1~10), 토픽 `content_code`=공식 CED 코드("5.3"), 세부 `content_code`="<토픽>#<번호>". 표시 이름(label)은 바꿔도 코드는 변하지 않는다. DB id(uuid)는 문제·회차 연결용이고, 코드는 시드·재생성·타 시스템 연결용.
- `source='ced'` 행은 **트리거로 보호**: 코드·출처·레벨·부모·과목 변경 불가, 삭제 불가(보관은 `status='archived'`). 이름·폴더 이동·순서는 관리자가 바꿔도 된다.
- 세부 키워드를 관리자가 추가하면 `source='admin'` + 코드 없음(또는 `x#…`): 공식 코드와 충돌하지 않는다. ALTON이 시드한 세부는 `source='ced'`(데이터 파일 기반)로 두되 코드·부모 보호, 이름만 수정 가능(공식 토픽과 같은 정책).

## 4. 버전 (D3)
- `ap_curriculum_editions(subject_id, edition='ced-2027', ced_version, source_url, exam_year, family, official_topic_codes)` — 과목별 현재 판. 키워드 행에 `edition`. 새 CED가 나오면 **새 edition 으로 신규 시드**: 같은 코드의 같은 토픽은 유지, 폐지 토픽은 `status='archived'`(삭제 금지), 의미가 바뀐 코드는 `content_code` 에 판 접미사(`3.1~2028`)로 새로 만든다. 연결(`problem_keywords`)은 항상 id 기반이라 옛 문제는 옛 토픽에 남는다.
- 2027 판 데이터 파일: `data/ap/curriculum-2027/<ap_subject_code>.json`(출처 URL·CED 버전 포함, 긴 공식 문구 미복제).

## 5. 공식 비중 (D4)
`ap_exam_weights(subject, edition, axis[unit|skill], code, section[mc|frq], min_pct, max_pct, source)` — 공식에 있는 수치만, **출처 설명 필수**. 비공식 비중은 이 테이블에 넣지 않는다(세트 구성 쪽 internal 표기).

## 6. 공식 스킬 매핑 (D5)
`ap_skills(subject, edition, code, category, label)` + 키워드의 `skill_codes[]`(CED가 토픽에 제시하는 권장 스킬, 세부 키워드는 수업에서 다루는 스킬). 키워드↔스킬은 "권장 연결"이지 일대일이 아니다. 문항의 `primary_skill`은 문항이 정한다(키워드와 독립).

## 7. 수업 연결 (D6) — 14절로 정정됨(템플릿 행은 단원이 아니라 회차)
(정정 전 기술) 단원 = 템플릿 단원(공식 단원 번호 `official_code`, 제안 수업 수 `suggested_lessons`, 공식 차시 `official_class_periods`). 단원-토픽 연결은 기존 `subject_template_unit_keywords`. 회차(오버레이)는 지금처럼 키워드 id 로 붙고, 세부 키워드는 `requires_codes`(선수 순서)·`est_lessons`(1회=50분 개인 수업 기준 제안값)로 수업 순서를 제안한다. 선생님 템플릿·학생 회차는 기존 상속 규칙(자동 반영 없음) 그대로.

## 8. 관리자가 더 세밀한 키워드를 추가하는 방법 (D7)
관리자가 폴더(단원) 안에 키워드를 추가하는 기존 UI가 그대로 동작한다. 새 키워드는 level 0(독립)이거나 토픽 아래 세부(level 2). 공식(ced) 행은 이름 변경만 가능, 삭제·코드 변경은 DB가 막는다.

## 9. Calculus AB / BC (D8)
**두 개의 과목 행**(AP Calculus AB, AP Calculus BC)을 각자 키워드 집합으로 가진다(비중·범위가 다름). 공유 토픽은 같은 공식 코드·같은 `content_key`(`calculus:5.3`)로 양쪽에 존재하고 BC 전용 토픽은 `scope='bc_only'`. 문제는 한 과목에 속하며, BC에서 AB 문제를 재사용하려면 `content_key` 로 대응 토픽을 찾는다(복사 대신 연결 규칙은 후속).

## 10. English Language (D9)
CED가 토픽 번호 없이 단원별 스킬 중심이라 `official_topic_codes=false`, 토픽 코드는 `U<단원>.<번호>`(근거는 편집본 designNotes). 코드는 우리 소유이므로 한 번 쓰면 불변.

## 11. 안전 (D10)
- 마이그레이션 **20262100000380**: additive·`if not exists`·재실행 안전(로컬 공유 DB에서 트랜잭션+롤백으로 2회 실행·보호 트리거 동작 확인). 기존 SAT 행은 level 0/source 'admin' 기본값으로 불변.
- 롤백: 마이그레이션 파일 머리 주석의 순서(세부→토픽→단원 행 `source='ced'` 삭제 후 테이블·컬럼 drop). 적용 전에는 `seed.ts`를 `--offline`/dry-run 으로만.
- 로더는 비프로덕션 호스트만 허용(`local`, 공유 비프로덕션), 관리자가 바꾼 이름은 덮어쓰지 않는다.

## 12. 총괄이 오너 대신 내린 결정 목록
| # | 결정 | 이유 |
|---|---|---|
| D1 | 4단(과목>단원>토픽>세부), 세부 키워드는 출시부터 허용 | 튜터가 수업 단위로 쓰려면 토픽보다 세밀한 층이 필요, 5단 이상은 관리 비용 |
| D2 | 단원·토픽·세부에 이름과 분리된 불변 코드 + ced 행 DB 보호 | "나중에 바꾸기 어려움"의 핵심 위험 제거 |
| D3 | 판(edition) 테이블 + 새 판은 신규 시드, 폐지는 archived | 2027 이후 CED 개정에도 옛 문제 연결 보존 |
| D4 | 공식 비중은 출처 필수 테이블로만 저장 | 비공식 수치 혼입 방지 |
| D5 | 키워드와 스킬은 별도 축, 키워드의 skill_codes 는 권장 연결 | 오너 지시(키워드=내용 축) |
| D6 | 공식 단원을 템플릿 단원으로도 시드(수업 제안 수 포함) | 기존 Curriculum 화면에서 바로 보이게 |
| D7 | 관리자 추가 키워드 허용, 공식 행은 이름만 수정 | 현장 수정과 공식 뼈대 공존 |
| D8 | Calculus AB·BC는 별개 과목 + content_key 공유 | 비중·범위가 다르고 문제 소속이 명확 |
| D9 | English Language 코드는 U<단원>.<번호> | CED에 토픽 번호가 없음 |
| D10 | 시드는 코드로만(UI 하드코딩 목록 폐기, `subjects.ap_subject_code`) | CLAUDE.md "하드코딩 목록 금지" |

## 13. 시드 현황(2026-10-08, 로컬 검증)
| 과목 | 단원 | 토픽 | 세부 키워드 |
|---|---|---|---|
| AP Calculus AB | 8 | 81 | 219 |
| AP Calculus BC | 10 | 111(AB 공통 81 + BC 전용 30) | 296 |
| AP Statistics(신 5단원 CED) | 5 | 55 | 200 |
| AP Biology | 8 | 60 | 223 |
| AP Chemistry | 9 | 91 | 229 |
| AP Physics 1(8단원, 유체 포함) | 8 | 43 | 153 |
| AP Computer Science A | 4 | 53 | 183 |
| AP Microeconomics | 6 | 36 | 122 |
| AP Macroeconomics | 6 | 42 | 139 |
| AP English Language(토픽 코드 U<단원>.<번호>) | 9 | 35 | 93 |
| **합계** | **73** | **607** | **1,857** |
- 로컬 공유 DB에서 마이그레이션 380 적용 → `seed.ts --execute` 2회(2회차는 전 과목 "생성 0", 멱등) → 단원 73·폴더 73·단원-토픽 연결 607·스킬 184·공식 비중 117행 확인 → 시드 데이터 정리(로컬 DB에는 스키마만 남김).
- 검증: `lib/ap-curriculum/*.test.ts` — 10과목 구조 완전성(토픽→단원, 코드 유일, 선수 순서, 비중 합 정합), BC ⊇ AB, Stats 5단원, Physics 1 유체 포함 등.
- **출처 한계(데이터 품질 주의)**: 토픽 코드·제목·권장 스킬·차시·MC 비중은 CED 텍스트 추출 기반이며, 일부 과목(Chemistry 일부 토픽 스킬, Physics 1 일부 권장 스킬, CS A 일부 토픽 스킬, English Language 단원 제목)은 추출 한계로 근사값이다. **세부 키워드·선수 관계·수업 횟수는 ALTON 설계(비공식)**이며 전문가 검수가 필요하다. 각 파일의 `designNotes`와 에이전트 보고에 한계가 기록되어 있다.

## 14. 회차(lesson-level) 템플릿 (2026-10-08, 오너 지적으로 정정, 마이그레이션 20262100000390)

### 14.1 8회차만 보인 원인(코드 근거)
- 관리자 Curriculum 템플릿의 "N회차" 한 줄은 `subject_template_units` 한 행이다(`app/admin/SubjectTemplateTab.tsx` 의 `{u.position}회차`, `loadSubjectCatalog`(`app/admin/subject-data.ts`)가 이 테이블을 `position` 순으로 읽어 `units` 로 노출; 연결 키워드는 `subject_template_unit_keywords`). 선생님 템플릿·학생 회차도 이 행을 복사해 상속하므로(`teacher_curriculum_template_units.source_unit_id`) **템플릿 행 = 회차**다.
- 380 시드(`scripts/ap-curriculum/seed.ts`의 구 "단원: 템플릿 단원 + 폴더" 블록)가 **CED 단원 8개를 이 행에 그대로 넣었고**(`subject_template_units`, `suggested_lessons`만 합계로 기록), 연결도 `plan.keywords.filter(k => k.level === 1)` 즉 **토픽 81개만** 걸었다. 세부 키워드 219개는 연결이 하나도 없었다(폴더 목록에는 있으나 회차 어디에도 없음). 설계 문서 7절의 "단원 = 템플릿 단원" 가정이 틀렸다.
- 결과: 8회차 × (토픽 평균 10개), 세부 키워드 0개 연결, 회차당 est_lessons 합이 4~12(50분 수업 4~12회분)로 한 회차에 수업 몇 회분이 몰림.

### 14.2 구조
- **템플릿 행(`subject_template_units`) = 50분 수업 1회.** 컬럼 추가: `lesson_kind`(content|unit_review|exam_prep), `ced_unit_code`, `est_minutes`, `track`(core|full). CED 단원은 키워드 폴더(공식 단원 코드)로만 남고 회차 제목에 "Unit n · Lesson k"로 표시한다.
- 회차-키워드 연결에 `role`: primary(처음 가르치는 회차) / continued(토픽이 다음 회차로 이어짐) / review(복습). **모든 토픽·세부 키워드는 정확히 한 회차에서 primary**(DB 트리거 `subject_unit_keywords_single_primary` + 테스트). 복습·시험 회차는 review 만 가진다.
- 상속 규칙 불변: 관리자 기준본 → 선생님 템플릿 → 학생 회차, 자동 전파 없음. 기존 복사 함수가 회차·연결을 그대로 복사한다(role 은 관리자 층에서만 쓰는 정보).

### 14.3 생성 규칙(`lib/ap-curriculum/lessons.ts`, 순수 함수·테스트 포함)
1. 단원 안에서 파일 순서(토픽 순서 + 세부 키워드 순서, 선수 `requires` 를 지킴)로 **세부 키워드(원자)** 를 채운다. 원자 부하 = 세부 키워드 `estLessons` 의 합(토픽 값은 설계자 추정이라 일부 과목에서 합과 불일치 → 세부 합 사용).
2. 회차 목표 부하 1.0(50분), 상한 1.25, 세부 키워드 최대 6개. 단원 경계는 넘지 않고 순서는 바꾸지 않는다. 마지막 꼬리 회차가 0.5 미만이면 상한 안에서 앞 회차에 합친다.
3. 단원마다 **복습·혼합 MCQ+FRQ 회차** 1회(내용 회차가 8회 초과이면 2회: 중간·끝). 첫 복습은 core, 두 번째는 full 전용.
4. 과정 끝에 **누적 시험 준비 6회**: 누적 복습 A/B(전반·후반 단원), 모의고사 1 해설, FRQ 클리닉, 모의고사 2 해설, 최종 약점 보강.
5. 검사(`checkLessonPlan`): 100% 커버·primary 중복 0·선수 순서(선수 키워드의 마지막 primary 회차 ≤ 후행의 첫 primary 회차)·회차 부하·세부 키워드 수·복습 회차는 primary 금지.
6. BC: BC 파일 자체로 생성. 공유 토픽은 같은 `content_key`(calculus:5.3)로 AB와 대응하고 BC 전용 30토픽(scope='bc_only')은 BC 회차에 들어간다.

### 14.4 회차 수와 페이스 결정
| 과목 | 내용 | 단원복습 | 시험준비 | 전체 과정 | 최소(core) |
|---|---|---|---|---|---|
| Calculus AB | 63 | 12 | 6 | **81** | 77 |
| Calculus BC | 85 | 15 | 6 | **106** | 101 |
| Statistics | 56 | 9 | 6 | 71 | 67 |
| Biology | 68 | 11 | 6 | 85 | 82 |
| Chemistry | 80 | 15 | 6 | 101 | 95 |
| Physics 1 | 94 | 15 | 6 | 115 | 108 |
| CS A | 64 | 8 | 6 | 78 | 74 |
| Microeconomics | 39 | 7 | 6 | 52 | 51 |
| Macroeconomics | 38 | 6 | 6 | 50 | 50 |
| English Language | 58 | 9 | 6 | 73 | 73 |
- **결정**: 템플릿 하나를 "전체 과정"(AB 81회)으로 둔다. 근거: 내용 61~63회가 이미 1:1 압축 추정이고(공식 CED는 학급 수업 ~140차시), 복습·누적 단계가 없으면 FRQ 훈련이 빠진다. 시험 직전 속성반(AP 준비 빠른 과정)은 **별도 템플릿을 만들지 않고** 학생 회차에서 진단 결과로 건너뛰기(기존 학생 층 편집)로 처리한다; `track='core'`는 속성반에서도 반드시 남길 회차(내용 전부 + 단원당 복습 1 + 시험 준비 6)의 최소 표시다. 권장 페이스: 주 1회 = 학년도 전체(약 36주 → 후반 압축 필요), 주 2회 = 약 40주 중 AB 완주, 속성반은 진단 후 약 40~50회.
- Physics 1·Chemistry 는 세부 키워드 부하(0.5 단위)가 토픽 추정보다 커서 회차 수가 많게 나온다 — 전문가 검수 항목(출처 한계와 동일).

### 14.5 적용·롤백
- 마이그레이션 `20262100000390`(additive, 재실행 안전; 로컬 공유 DB에서 트랜잭션+롤백으로 380+390 2회 실행 및 단일-primary 트리거 거부 확인). **비프로덕션 적용은 총괄이**: 390 적용 → `npx tsx scripts/ap-curriculum/seed.ts`(기본 dry-run) 확인 → `--execute`. 시드는 380이 만든 CED 단원 단위 템플릿 행(source='ced', lesson_kind null)을 정리하고 회차 행·연결을 만든다. 관리자가 바꾼 회차 제목·키워드 이름은 재실행해도 덮어쓰지 않는다. 회차 출력만 보려면 `npx tsx scripts/ap-curriculum/lessons.ts [--list]`.
- 남은 일: 관리자 템플릿 화면에 회차 종류·단원 구분 배지·"전체 과정/최소" 필터(UI 폴리싱 라운드), 전문가 검수로 부하·순서 보정.

## 15. 컴팩트 과정(기본) vs 전체 과정 (2026-10-08, 오너 지시: 81회는 너무 길다, AB 약 30회)
### 15.1 부하 계산(정직하게)
- 세부 키워드 est_lessons 합 ≈ AB 61회 × 50분 ≈ 51시간. 30회로 줄이려면 (a) 회차를 100분으로 늘리거나 (b) 일부 키워드를 가볍게 다뤄야 한다. 두 가지를 함께 쓴다: 회차 100분(두 배) + light 키워드는 부하 50%로 계산 + 단원 복습 별도 회차 폐지 + 시험 준비 3회.
- 결과: AB 총 수업 시간 68시간(전체 81×50분) → 53시간(32×100분). 줄어드는 것은 **회차 수보다 시간 자체**(약 15시간 = 복습 12회·시험준비 3회·light 압축분)이므로, 오너가 "30회"를 지키려면 학생은 100분 수업을 받아야 한다. 50분 수업만 가능하면 같은 내용이 약 64회다.
### 15.2 생성기 매개변수(`lib/ap-curriculum/lessons.ts`, `TRACK_DEFAULTS`)
`minutes`(회차 길이, 기본 100), `lightFactor`(0.5), `examPrepSessions`(3), `foldReview`(true). 용량 = minutes/50, 상한 = 용량×1.25, 세부 키워드 상한 = 6×용량. 순서·선수 규칙·100% 커버·단일 primary는 전체 과정과 동일하게 검사한다(`checkLessonPlan`).
- **깊이 2단계**: core = 충분히 가르침, light = 오개념(misconception)·표현(representation) 종류의 세부 키워드 — 개요와 예제 수준으로 다루고 연습 세트에서 드릴로 보강. 키워드는 여전히 정확히 한 회차의 primary(연결 `depth` 컬럼에 core/light 저장).
- **복습 접기**: 단원 마지막 회차를 짧은 혼합 MCQ+FRQ 세트로 마무리하고, 다음 단원 첫 회차에 이전 단원 마지막 회차 토픽을 review 연결(워밍업)로 건다. 마지막 단원 복습은 시험 준비 1회에 포함.
- **시험 준비 3회**: 누적 복습(전반)+모의고사 1 해설 / 누적 복습(후반)+FRQ 클리닉+모의고사 2 해설 / 최종 약점 보강·시험 당일 전략.
### 15.3 과목별 결과(기본 compact: 100분/회, 전체 과정은 비교용 full 50분)
| 과목 | compact 회차(내용+시험준비) | 총 시간 | 세부 core/light | full 회차(총 시간) |
|---|---|---|---|---|
| Calculus AB | **32** (29+3) | 53h | 165/54 | 81 (68h) |
| Calculus BC | **43** (40+3) | 72h | 229/67 | 106 |
| Statistics | 27 (24+3) | 45h | 137/63 | 71 |
| Biology | 32 (29+3) | 53h | 158/65 | 85 |
| Chemistry | 39 (36+3) | 65h | 167/62 | 101 |
| Physics 1 | 43 (40+3) | 72h | 110/43 | 115 |
| CS A | 29 (26+3) | 48h | 139/44 | 78 |
| Microeconomics | 20 (17+3) | 33h | 87/35 | 52 |
| Macroeconomics | 21 (18+3) | 35h | 92/47 | 50 |
| English Language | 30 (27+3) | 50h | 79/14 | 73 |
AB 32는 목표 30의 +6.7%, BC 43은 40의 +7.5%(±10% 안). 모든 토픽·세부 키워드는 두 과정 모두 100% 커버·정확히 한 primary.
### 15.4 스키마·시드(마이그레이션 20262100000391, 390 파일은 수정하지 않음)
- `subject_template_units.track_set`(compact|full), `subject_template_unit_keywords.depth`(core|light). 390이 만든 81회 행은 391이 `track_set='full'`로 표시.
- 회차 코드: compact = `C<단원>.<nn>`, `CX.<n>`; full = `L/R/X`(충돌 없음). `seed.ts --track compact|full`(기본 compact, dry-run 기본). 과정을 바꿔 시드하면 다른 과정의 시드 회차를 **학생·선생님 층이 참조하지 않을 때만 삭제**하고, 참조 중이면 남기되 primary 를 review 로 내려 단일-primary 규칙과 충돌하지 않게 하고 순서를 뒤로 보낸다.
- 한계: 한 과목 템플릿에는 한 과정만 활성으로 둔다(관리자 화면에서 학생별로 과정을 고르는 UI는 후속). 학생별 선택은 지금은 "어느 과정을 선생님 템플릿에 시드/상속하느냐"로만 가능하고, 학생 단위 전환 UI·컴팩트 압축에 대한 전문가 검수가 남았다.
