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

## 7. 수업 연결 (D6)
단원 = 템플릿 단원(공식 단원 번호 `official_code`, 제안 수업 수 `suggested_lessons`, 공식 차시 `official_class_periods`). 단원-토픽 연결은 기존 `subject_template_unit_keywords`. 회차(오버레이)는 지금처럼 키워드 id 로 붙고, 세부 키워드는 `requires_codes`(선수 순서)·`est_lessons`(1회=50분 개인 수업 기준 제안값)로 수업 순서를 제안한다. 선생님 템플릿·학생 회차는 기존 상속 규칙(자동 반영 없음) 그대로.

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
