# AP English Language Practice Exam 4 재배정 점검 (2026-10-21)

결론: **현재 증거가 있는 재고만으로는 EL4를 만들 수 없다.** 부족한 것은 q1(종합) FRQ 프롬프트 1개뿐이고, 나머지 7개 키(MC 5 묶음 + q2 + q3)는 공개 세트와 겹치지 않는다. 새 `exact-assign-el-el4-v2.json`은 유효한 해가 없어 만들지 않았다(기존 `exact-assign-el-el3-el4.json`은 변경 없음, EL3 항목 sha256 `53b90a79a196c1496d199d51bd90a229c2e2c4b304e4542e7663b69c71308527` 그대로).

## 정정 이력

- 이전 보고 "겹침 0"은 틀렸다. EL4의 q1 `el-rv:ap_english_language-fa1-k0`는 이미 공개된 Practice Exam 2 v4(published)가 쓰는 문항이다(문제 2건 포함 겹침).
- 원인: 배정(`el-assign.ts --official`)과 `humanities-r19-readiness-2026-10-21.md`의 점검은 **로컬 재고 파일**(`data/ap/stock/el-*-items.json`, 화면 증거 JSON) 기준이었다. 배정기의 차단 목록은 EL3·EL4 사이 중복과 문항군만 막았고 **원격 DB의 공개 세트가 실제로 쓰는 키·문제 ID는 읽지 않았다.** 준비도 문서도 "DB 해시 대조는 미수행"이라고 적고 있었다. Exam 2 v4는 개정본(`el-rv`) 키로 교체돼 있었는데, 로컬 배정기는 그 키를 "미사용 재고"로 보았다.
- 관리자 화면의 독립 검증(`planElDraftSet`)은 원격 DB의 비보관 풀 세트 문제 ID와 대조하므로 이를 잡아냈다.

## 이번 점검의 방법

- 원격 비프로덕션 DB(`worpsqwqgnspddnrtnvq`) 읽기 전용 SELECT만 사용: English Language 세트·세트 항목·문제 연결, `ap_candidate_items`(mock_exam 83건: 현재 버전·렌더/화면 검증 플래그·문제·버전 ID·렌더/화면 해시). 스냅샷: `data/ap/stock/el4-reassign-db-snapshot-2026-10-21.json`. 쓰기·생성·유료 호출 없음.
- 공개 세트: Exam 1 v4, Exam 2 v4, Exam 3 v1 = 키 24개(세트당 8), 문제 ID 144개.
- 차단 목록(스크립트 `scripts/ap-generation/el4-reassign.ts`): 공개 세트의 키 24 + 같은 문제 ID를 가진 키(추가 0) + 공개 세트 키의 문항군(구조 look-alike 포함) 21 + **개정본·원본 계보** 6(예: `englang-p1-b2` fa1은 Exam 2의 `el-rv` fa1과 같은 제목·지문의 원본) + DB에서 변환·검증이 끝나지 않은 20 = 로컬 재고 103 중 차단.
- 보수적 차단(archived 세트 키까지 전부, 키 72·문제 ID 320)은 **이번 편성에서만** 한 선택이며 서비스 전체 정책이 아니다. 이 경우도 해 없음.
- 관리자 화면과 같은 코드 경로(`lib/ap-admin/assemble-elang-draft.ts` `planElDraftSet`, DB 풀 행 + 비보관 풀 세트)로 선검증: 대상 키가 있을 때 위반 0까지 확인하는 흐름이며, q1이 없어 최종 통과는 얻지 못했다.

## q1 재고 현황 (공식 FRQ q1 = 종합 1개 필요)

| 후보 | 상태 |
|---|---|
| `el-rv` fa1 | Exam 2 v4 사용 중 |
| `englang-p1-b2` fa1 | Exam 2의 같은 프롬프트(개정 전 원본), 차단 |
| `el-rv` fb1 | Exam 1 v4 사용 중 |
| `englang-p2-b` fb1 | Exam 1의 같은 프롬프트(개정 전 원본), 차단 |
| `englang-r19-f` fc1 | Exam 3 v1 사용 중 |
| `englang-r19-f2` fe1 | 화면 증거 없음, DB 미적재, 렌더 게이트 실패(stat_chart 제목 75자 > 70자, `not_renderable`) |

## 나머지 7개 키 (EL4에서 유지, 공개 세트와 겹침 없음)

| 키 | 문제 ID(앞 8자) | 렌더 | 증거 | 해시(앞 12자, DB 렌더·화면·로컬 증거 일치) |
|---|---|---|---|---|
| `englang-r19-merged:…-lr21-k0` (읽기 12문항) | 21ed3ae3 외 11 | not_applicable | yes | b140ea0b9f22 |
| `englang-r19-merged:…-lr24-k0` (읽기 13) | 90d5f561 외 12 | not_applicable | yes | c58972f06359 |
| `englang-r19-merged:…-lw43-k0` (글쓰기 8) | e02824f8 외 7 | not_applicable | yes | f35e1110f04b |
| `englang-r19-merged:…-lw44-k0` (글쓰기 8) | 166b2611 외 7 | not_applicable | yes | 7f6cd77dd1a3 |
| `englang-r19-merged:…-sw45-k0` (글쓰기 4) | ca90d6cf 외 3 | not_applicable | yes | aa3ff946fca3 |
| `englang-r19-f:…-fd2-k0` (q2) | 8fced6cc | not_applicable | yes | 99cedfde7679 |
| `englang-r19-f:…-fd3-k0` (q3) | 645e591f | not_applicable | yes | 727e8bef332e |

(키 전체: `englang-r19-merged:ap_english_language-…`, `englang-r19-f:ap_english_language-…`.) 모두 DB에 적재·현재 버전·렌더/화면 검증 완료 상태다. 구조는 읽기 묶음 2(12+13=25문항) + 글쓰기 묶음 3(8+8+4=20문항) = MC 45, 공식 5묶음 구조 통과(독립 검증기 위반 0은 q1을 넣은 가정 해에서 확인).

## 필요한 것 (생성·유료 호출은 하지 않았음)

1. **권장: fe1 수선.** fe1의 stat_chart 제목을 70자 이내로 줄이고(새 콘텐츠 해시), render-check → 화면 증거 → DB 변환 적재. LLM 생성 비용 없음(결정적 렌더·로컬 증거 수집). 이후 EL4 q1 = fe1, 나머지 7키 그대로 배정 가능(문항군·주제는 다른 공개 세트와 달라야 하며, 그 확인은 적재 뒤 `el4-reassign.ts`로 재실행).
2. 또는 **새 q1 프롬프트 1개 생성**: 화면 증거가 필요한 새 후보 1건. 과거 EL FRQ 검수 기준으로 생성·평가·감사 합쳐 약 US$1~3 예상(화면 증거 수집 별도, 추가 비용 없음).

재실행: `npx tsx scripts/ap-generation/el4-reassign.ts [--conservative] [--no-pins] [--write data/ap/stock/exact-assign-el-el4-v2.json]` (해가 있으면 독립 검증기·`planElDraftSet`·해시 대조 통과 시에만 파일 기록).

## 후속 (2026-10-21 오후): fe1 수선과 EL4 재배정 성공

결과: **EL4 재배정 해를 얻어 `data/ap/stock/exact-assign-el-el4-v2.json` 을 만들었다.** q1 = `englang-r19-f2:ap_english_language-fe1-k0` + 유지 7키. 기존 `exact-assign-el-el3-el4.json` 은 변경 없음(EL3 항목 sha256 `53b90a79a196c1496d199d51bd90a229c2e2c4b304e4542e7663b69c71308527` 그대로 재확인). LLM 호출·원격 쓰기 없음.

1. **fe1 수선(최소)**: stat_chart 제목 "Preferred single use of a 10-million-dollar stormwater budget, Orvell, 2025"(75자) → "Preferred use of a 10-million-dollar stormwater budget, Orvell, 2025"(68자). 제목은 질문·참고답·루브릭에서 인용되지 않고(검색 결과 차트 데이터 2곳뿐), 본문의 "single use"·yTitle "Preferred use of the budget"과 의미가 일치한다. 데이터·질문·참고답·루브릭은 변경 없음. 수정 파일: `data/ap/stock/el-r19f2-items.json`, `data/ap/sample-2027/englang-r19-f2/{candidates.json,frq.json,frq-gen.results.jsonl}`(같은 문자열 치환).
2. **해시 규칙**: 아이템 content hash(`itemContentHash(payload)`)는 payload 내용 해시라 제목 변경으로 새 해시 `382123ba59dd…`(전체 `382123ba59dd9f01088d5ae2444d3d8af89064677e68404c4acc475f4332f89a`)가 되었다(구 `bccad5fb…`). 생성기 파일 변경이 아니므로 frozen config(`config/ap-frozen/englang-r19-f2.v1.json`) 해시와 무관하다. `el-r19f2-pass-keys.json` 은 stockKey 목록이라 변경 불필요. 증거가 없던 후보라 기존 검증 기록과의 충돌도 없다.
3. **렌더 게이트**: `render-check.ts` 재실행 → fe1 `stat_chart` pass(전체 pass 2405→2406, fail 32→31), 다른 행의 결과·해시 변화 없음(`report.json`에서 fe1 행과 집계만 변경).
4. **화면 증거(격리 스택 `ALTON_apel4`, 포트 +2500)**: `local-demo-seed.ts seed --keys-file <fe1> --practice-sets` → `screen-evidence.ts` 390x844·1280x800 = 2항목, 점검 7종 전부 pass(보기·그림 렌더 2요소·가림 없음·정답/해설 비노출·FRQ 입력·원문 TeX 없음). `evidence-el-r19.json` 에 병합(544→546항목, 기존 행 보존), 해시 = 렌더 보고서 해시. 스크린샷: `docs/ap/screen-evidence/el-r19/englang-r19-f2_ap_english_language-fe1-k0-{390x844,1280x800}.jpg`.
5. **재배정**: 원격 비프로덕션 DB 읽기 전용 SELECT로 스냅샷 재취득(`data/ap/stock/el4-reassign-db-snapshot-2026-10-21.json`) — 공개 세트(Exam 1 v4, Exam 2 v4, Exam 3 v1)·풀 83행·문제 ID 모두 이전 스냅샷과 동일(변경 없음). `el4-reassign.ts` 에 `--pending-key`(DB 미적재 수선 키를 가상 행으로 취급, 렌더 보고서·로컬 증거 해시 일치를 필수 확인) 추가. 실행: status=optimal, 독립 검증기 위반 0, `planElDraftSet` ok=true 위반 0 items=48, 공개 세트 키·문제 ID·문항군·계보 겹침 0(fe1 는 차단 목록에 걸리지 않음), 해시 불일치 0.
   - EL4: mcA = lr21·lr24·lw43·lw44·sw45(변경 없음), frqA = fe1(q1)·fd2(q2)·fd3(q3). 구 q1 `el-rv fa1`(Exam 2 사용 중)만 교체.
   - 한계: fe1 의 문제 ID·버전 ID 는 DB 적재 전이라 `planElDraftSet` 은 가상 ID(`00000000-…f1`)로 검증했다. fe1 의 실제 문제 ID 겹침은 적재 뒤 확인해야 한다(키·문항군·계보 겹침은 사전 확인 완료, 새 문항이라 기존 문제 ID 와 겹칠 수 없음).

### 총괄이 해야 할 적재 단계

fe1 은 아직 DB 에 없다. 관리자 화면에서 batch **`el-r19f2`**(`lib/ap-admin/batches.ts`: items `el-r19f2-items.json`, pass-keys `el-r19f2-pass-keys.json`(fe1 1키), evidence `evidence-el-r19.json`)를 적재(변환)하고 렌더·화면 검증 기록을 남긴다. 기대: 새 키 1개, 렌더·화면 해시 `382123ba59dd…` 일치. 이후 `el4-reassign.ts`(스냅샷 갱신 후, `--pending-key` 없이)를 다시 돌려 DB 행 기준으로 위반 0·해시 일치를 확인하고 `exact-assign-el-el4-v2.json` 으로 EL4 초안을 조립한다.

### 부수 발견

- 신규 마이그레이션 `20261101100000_essay_ai_cost_events.sql` 이 `20262100000600_essay_ai_scores.sql`(mock_exam_essay_scores 생성)보다 버전 번호가 앞서, 빈 DB 에서 `supabase start` 가 `relation "public.mock_exam_essay_scores" does not exist` 로 실패한다(격리 스택 시작 시 확인, 해당 파일을 임시로 빼고 기동). 원격에 이미 적용돼 있으면 영향이 없지만, 신규 환경·reset 에서는 깨진다. 별도 정정 필요(적용 완료 번호는 고치지 않고 새 번호로).
