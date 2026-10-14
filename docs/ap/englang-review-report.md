# AP English Language — EL1/EL2 독립 품질 검수 보고서 (2026-10-14)

범위: 게시된 AP English Language Practice Exam 1·2(`data/ap/stock/exact-assign-el-el1-el2.json`, DB 게시본과 키 일치 확인) — MC 90문항(22개 지문 묶음), 지문 22개, FRQ 6개(과제문·소스·루브릭·샘플 18편·주석).
방법은 생성 파이프라인과 다르게 잡았다. 키를 숨기고 "두 번째 방어 가능한 답을 찾는" 적대적 맹검 풀이(Opus 5.5·Fable 5.1 각 90문항), 사람 독자 역할의 전수 통독(본 보고서 작성자), FRQ는 맹검 채점(Opus)과 적대적 패키지 감사(Fable)를 썼다.
DB 쓰기 없음(`supabase db query --linked` SELECT만 2회). 수정본은 모두 `data/audit/` 데이터이며 원본 재고 파일은 건드리지 않았다.

## 결론

- **키 오류율**: 의심 키 0/90. 두 모델이 180건(90×2) 전부 키와 같은 답을 골랐고 전부 `clear`(두 번째 방어 가능 선지 0), 사람 통독에서도 틀린 키·복수 정답 없음. 95% 상한은 3.3%(rule of three)이나, 모델과 같은 사각지대를 공유하는 오류는 이 방식으로 못 잡으므로 **잔여 키 오류율 추정 0–2%(최선 추정 ≈1%)**, 그라운드워크의 사전 추정 3–8%보다 낮다. 사람 검수 없이 이 수치를 확정치로 쓰지 말 것(아래 한계).
- 문제는 키가 아니라 **시험 타당도 단서와 FRQ 패키지 정합성**이었다. 가장 큰 것은 정답 선지가 가장 긴 선지인 비율 84%(76/90)였고, 이는 학생이 지문을 안 읽고도 맞힐 수 있는 단서다. FRQ는 6개 중 6개에서 학생 노출 텍스트·루브릭·샘플의 정합성 결함이 나왔다.
- 이번 검수의 심각도별 건수: **치명(키 오류·풀 수 없음) 0 / 중간 9 / 낮음 8 / 정보 8**. 중간·낮음 17건은 전부 수정본을 만들었다. 교체 문항으로 쓸 예비 재고는 필요하지 않았다(키 결함 0).
- 수정본 검증: 수정 후 MC 90문항을 Opus가 다시 맹검 풀이 → 90/90 키 일치, 두 번째 방어 가능 0, 전부 `clear`, Opus의 길이 단서 지적 18문항 → 5문항. FRQ 수정본은 `frqViolations` 0건, 샘플 재채점은 18편 중 14편이 저장 점수와 정확히 일치(최대 총점 편차 2, 수정 전과 같은 수준이며 fa1 low는 일치로 바뀜).

## 건수·표

| 구분 | 건수 |
| --- | --- |
| 검토 MC 문항 / 지문 묶음 | 90 / 22 |
| 모델 맹검 풀이 | 180회(Opus 90 + Fable 90) — 키 불일치 0, 복수 정답 0 |
| 모델이 단 문항 수준 지적(대부분 길이 단서) | 69건(길이 단서 지적 문항: Fable 25·Opus 18), 지문 수준 지적 37건 |
| FRQ 샘플 맹검 채점 | 18편 — 수정 전 14/18 정확 일치, 총점 편차 ≤ 2 |
| FRQ 적대 감사 지적 | 53건(blocker 2·major 11·minor 24·nit 16) — blocker 2건은 검수 하네스의 렌더 누락(실결함 아님, EL-24) |

## 지적 사항(id · 심각도 · 근거 · 조치)

심각도: 치명 = 키가 틀렸거나 풀 수 없음, 중간 = 학생 노출 결함 또는 구조적 타당도 위협, 낮음 = 문구·정합성 결함, 정보 = 조치 없음.
문항은 `세트 키 접미사 + 세트 안 순번`으로 표기한다(예: `EL1 r03 #2`).

| id | 심각도 | 대상 | 근거 | 조치 |
| --- | --- | --- | --- | --- |
| EL-01 | 중간 | MC 전체(22세트) | 정답이 가장 긴 선지: 76/90(84%, 글자 수), 단어 수로 엄격히 가장 긴 문항 60/90. 키/오답 평균 길이비 1.16. 생성기 자체 게이트(세트 안 60% 초과)로 보면 8개 세트(r11 5/5, r23 4/5, r25 3/4, w22 4/4, EL2 r01 4/5, r26 4/5, w04 4/6, w32 5/6)가 불합격 수준. 두 모델이 각각 길이 단서를 다수 지적(Fable 25문항·Opus 18문항). | 키 문구·키 위치·줄기는 그대로 두고 오답 선지를 키 길이의 85–115%로 다듬은 수정본 22세트. 글자 기준 76→18/90, 단어 기준 60→12/90, 길이비 1.16→1.00. 모델이 인용문 선지에 문장을 이어 붙인 1건(EL2 r26 #2)과 키 문구 변경·길이 초과 3건은 자동으로 원본 유지. Opus 재풀이 90/90 일치, 길이 지적 18→5문항. |
| EL-02 | 중간 | 읽기 12문항(r03 2·r23 5·r26 5) | 읽기 지문은 문단 번호(¶N)만 보이는데 해설이 "Sentence 19", "sentences 23-26", "(13-15)"처럼 보이지 않는 번호를 가리킴(읽기 49문항 중 12). | 해설을 문단 번호·짧은 원문 구절로 바꿈. 수정본에서 숨은 문장 번호 0건(테스트로 고정). |
| EL-03 | 중간 | fb1·fa1 높음 샘플 | 텍스트 손상: fb1 `410,000, dollars "close to 2 percent…`, fa1 `7.50, dollars and Source F charts the hub at 11.40. dollars That looks…`와 주석 `11.40. dollars The rubric…`(model_answer·reference_text에도 복제). 영어 재고 전체를 스캔해 이 두 후보뿐임을 확인. | 해당 문장 3곳 교정. 파생 필드는 원본과 같은 함수로 재생성. |
| EL-04 | 중간 | fb2·fa2 과제문 | 학생에게 보이는 Speaker/Audience/Exigence/Purpose 블록의 Purpose 줄이 연설의 핵심 전략을 먼저 말함. fa2는 "failing business가 아니라 infrastructure로 재정의하되 재정 압박을 인정"으로 높음 샘플의 논지와 거의 같음. 실제 AP는 화자·청중·상황만 제공. | scenario를 화자·청중·상황 3요소로 축소(목표는 Task 문장이 이미 제시). |
| EL-05 | 중간 | fb1 Source A↔F | Source A "most of it from parking the bus fleet" vs Source F 교통 165/410 = 40%(과반 아님). 두 소스가 서로 어긋나 학생이 인용하면 모순. | Source A를 "the largest share of it"로 정정. |
| EL-06 | 중간 | fa1 높음 샘플·주석 | "The hub saves money overall only because it expects 37,000 fewer visits": 30만 달러 절감(1.9M→1.6M)은 방문 수와 무관하고 방문이 줄면 방문당 비용이 오름. 주석이 이 추론을 모범으로 칭찬. | 문장을 "총액은 줄지만 방문이 3.7만 줄어 방문당 비용은 오른다"로 바로잡고 주석 정정. |
| EL-07 | 중간 | fa3 루브릭 C·높음 주석 | 루브릭과 주석이 "양쪽이 공유하는 가정: wobbling chair는 실패"라 하나 지문의 위원장은 "not about chairs"로 그 틀을 거부(실패로 보는 쪽은 부모). 높음 샘플의 "both sides…"가 이를 오독. | 루브릭 C에서 해당 예시 제거(위원장 입장의 반복은 정교함이 아님을 명시), 샘플의 "both sides"를 "the parents"로, 주석 정정. |
| EL-08 | 중간 | fa2 루브릭 B·높음 샘플 | "shrinking sentences (18-21)": 19·20은 짧지만 21이 네 문장 중 가장 길다(4·3·21단어). 샘플과 주석이 같은 오독을 모범으로 제시. | 루브릭을 "19–20의 짧은 두 문장과 이어지는 긴 21"로, 샘플·주석 문구 정정. |
| EL-09 | 중간 | fb3 중간·fa1 낮음 샘플 점수 | fb3 mid: 점수 C=1(총 5)인데 유일한 C 주석은 "정교함 미획득". Opus 맹검도 C=0. fa1 low: 루브릭이 "소스 5개를 한 문장씩 인용하고 해설이 없으면 2에 머문다"고 쓰는데 샘플은 B=1. Opus 맹검 B=2. | fb3 mid: C=0, 총 4(서열 6>4>1 유지). fa1 low: B=2, 총 2(서열 6>5>2 유지). 수정본 재채점에서 fa1 low 일치. |
| EL-10 | 낮음 | fb1 Source D | "between 2021 and 2023" 채택 학교가 2025 보고서에서 3년 자료·"year three"를 가질 수 없음. | "between 2020 and 2022". |
| EL-11 | 낮음 | fb1 Source F 차트 | 렌더러 13자 제한 때문에 라벨이 `Transportati.`, `Custodial and`로 잘려 학생에게 보임. | `Transport`, `Utilities`, `Substitutes`, `Food service`, `Custodial`(전체 이름은 대체 설명에 유지). 라벨이 바뀌었으므로 화면 검증 증거는 새 키 기준으로 다시 받아야 함. |
| EL-12 | 낮음 | 읽기 8문항 | 지문이 성별을 밝히지 않은 필자·화자에 she/her/his(r04 #1–3, r11 #1·4·5, r25 #3, r10 #1 오답). 두 모델 모두 지적. | 중립 표현("the writer/speaker")으로 교체, 따옴표·구조·길이는 검증기로 보존 확인. r11 #1의 해설 한 줄은 자동 검증을 통과하지 못해 "she"가 남음(영향 미미). |
| EL-13 | 낮음 | FRQ 샘플 | fb3 high가 Source A에 없는 문장을 따옴표 인용; fa2 high가 지문에 없는 사실("developer from out of town", 브로셔가 세금·배수로를 홍보); fa2 mid 인용 `belong`(원문 `belongs`); fb3 mid "six blocks from a garage"(6은 폐쇄 구간 수); fb1 mid "employers mostly want to go back"(49%는 과반 아님). | 각각 원문에 맞게 정정. 전체 인용 검사 통과. |
| EL-14 | 낮음 | FRQ 루브릭·주석 | fb2: "Listen anyway"(47)를 마지막 문장이라 함(48이 마지막)·Row A 문구가 장치 나열에 점수를 줄 수 있게 읽힘·존재하지 않는 "rubric warns"; fb3: Row A가 "opening"과 "anywhere"를 동시에 요구·mid 주석이 지문 의존을 감점; fa2: Row A "opening sentences"·"Row 4"·mid에 Row A 주석 없음; fb1: 루브릭에 없는 "moves the rubric lists"·에세이에 없는 "the lunch line"·Source E에 없는 "grade-level" 연결. | 문구 정정, fa2 mid에 Row A 주석 추가. |
| EL-15 | 낮음 | fb1·fa1 과제 배경 | "Some observers argue … only under specific conditions"/"Others argue … only if … transportation and some form of local presence" 문장이 Source D의 권고이자 두 상위 샘플의 논지를 미리 줌(감사 모델 2건). | 해당 문장 삭제(양측 입장 소개는 유지). |
| EL-16 | 낮음 | fa3 Source A | 첫 문장의 공예 목록이 쉼표만으로 이어져 run-on처럼 읽힘. | 괄호로 묶음. |
| EL-17 | 낮음 | MC 문구 | w06 #1 줄기 "panel members"(지문은 council); w11 "neighbourhood"(영국식 철자); w32 #6 "underlined portion"(밑줄 표시 없음); w32 #5 키 "close to remarkable"; r03 P2 "roughly one hundred and twenty working days" (11–3월 평일은 약 108일); r11 #5 선지 `'circular'` 작은따옴표; w22 #1 키 "forty others…softer"(지문은 oboe를 뺀 모든 파트). | 각각 정정(r03 "one hundred and ten", w22 "everyone else"). 키의 의미는 불변. |
| EL-18 | 정보 | MC 키 정확성 | 위 결론 참고. 90문항 전부 모델 2종+통독에서 키가 유일 정답. 파이프라인 신뢰도 필드: 36문항 high, 54문항 medium(적대 검토 weak·심판 key_clearly_better) — 54문항에서도 불일치 0. | 조치 없음. |
| EL-19 | 정보 | 지문 독창성·민감성·난이도 | 저작권 문제·가공 인용·부적절·편향 내용 없음. 읽기 수준·길이 적정. EL2 r01은 2016 left-pad npm 사건과 OpenSSL 재정난을 연상시키나 이름·사건이 가공이라 허용. | 조치 없음. |
| EL-20 | 정보 | 글쓰기 지문의 미출제 결함 | 의도된 초안 오류가 일부 문항에서 다뤄지지 않음(w07 s13 "it's", w11 s11·w22 s11 쉼표 이음, w22 s12 쉼표 누락, w05 s3·s10). | 조치 없음(실제 시험도 모든 결함을 묻지는 않음). |
| EL-21 | 정보 | 가공 이름 동질성 | 28개 텍스트 중 "Pell" 10곳, "Harrow/Harlow" 12곳, "Marisol" 5곳(fb1·fb2·fb3·fa1·r31), Delia·Delphine·Imogen·Dolores·Odile 쌍 반복. AI 생성 지문의 지문(fingerprint)이 될 수 있음. | 변경 안 함(광범위 본문 수정이라 별도 이름 정리 라운드 권고). |
| EL-22 | 정보 | 3문항 묶음 7개 | 생성 게이트 "묶음 ≥4문항"에는 못 미치나 시험 규칙(묶음 3–6)과 조립 검증은 통과. | 조치 없음. |
| EL-23 | 정보 | "relationship between paragraph X and Y" 줄기 7문항 | 같은 유형 반복(EL1 3, EL2 4). 실제 시험에도 나오는 유형. | 조치 없음. |
| EL-24 | 정보 | 검수 도구 지적 중 결함이 아닌 것 | fb1·fa1 "Source F 누락"(검수 하네스가 학생용 텍스트만 보내 차트가 빠진 것, 실제로는 stimulus로 전달됨)·"ALTON original passage" 줄(공개 라벨 정책)·fa2 선장과 어선 개연성·fa3 전제 문구·fa3/fb3 높음-중간 샘플 유사·fb1 low "scores went down"·r08 어머니 나이·r10 필자 역할·r01 "wry understatement" 라벨. | 조치 없음. |
| EL-25 | 정보 | FRQ 샘플 보정 | 수정 전 맹검 채점: 18편 중 14편 정확 일치(불일치 fb2 low A·fb3 mid B/C·fb3 low A/B·fa1 low B), 최대 총점 편차 2(fb3 low 저장 1 vs 3). 서열(high>mid>low)은 6/6 유지. 수정 후: 14/18 정확 일치(fa1 low 일치로 바뀜, fb1 low는 Opus 실행마다 B 1~2로 흔들림, fb3 mid는 저장 4 vs 채점 5). 저장 점수는 3채점기 중앙값이므로 단일 채점기 편차는 허용 범위로 본다. | 조치 없음. |

## 수정본과 교체 계획

- 신규 후보: `data/audit/el-review-fix-items.json` — 28개 StockItem(MC 22 + FRQ 6), 키 `el-review-fix:<원본 candidateKey>`, 원본과 같은 칸. 원본 DB 문항은 그대로 남는다.
- 교체 계획(형식은 `ab1-v2-swap-plan.json` 등과 동일, 섹션 `ap_mc`/`ap_frq`):
  - `data/audit/el-review-el1-v2-swap-plan.json` — 15건(필수 11, 권장 4)
  - `data/audit/el-review-el2-v2-swap-plan.json` — 13건(필수 6, 권장 7)
  - `tier: required`는 내용·과제문·해설·점수 결함(EL-02~EL-17) 수정, `tier: recommended`는 EL-01(길이 보정)만 해당하는 세트. 지문 묶음은 슬롯이 여러 개여도 계획에는 항목 하나(`resolveSwaps`가 세트 전체 슬롯으로 펼침).
  - 계획 파일은 `data/audit/`에 두었다. 관리자 '새 버전' 화면은 `data/ap/stock/`만 읽으므로 반영하려면 후보 적재 뒤 파일을 그쪽으로 복사해야 하고, `lib/ap-admin/audit-swap-plans.test.ts`가 `-audit-swap-plan.json` 이름의 파일 수를 고정하므로 파일명은 `…-review-v2-swap-plan.json` 계열을 유지할 것.
- 적용 순서(소유자 실행): 1) `npx tsx scripts/ap-generation/import-candidates.ts --items data/audit/el-review-fix-items.json --batch el-review-fix-2026-10-14 --supplement`(기본 dry-run, 확인 후 `--execute`) 2) 새 후보의 render/screen 검증 증거 확보(특히 fb1은 차트 라벨 변경) 3) 계획 파일을 `data/ap/stock/`로 복사 → 관리자 화면에서 EL1·EL2 새 버전 초안 생성 → 미리보기에서 위반 0 확인 후 공개.
- 예비 재고(교체가 필요해질 경우): 통과한 읽기·글쓰기 묶음 5개가 남아 있다 — 2.A `w01`, 1.B `r21`·`r24`, 1.A `r07`, 4.A `w08`(auto_passed). FRQ 예비는 없다.
- 새 후보의 `key_confidence`(솔버 표)는 원본 값을 그대로 복사한 것이라 수정 선지에 대한 값이 아니다. 대신 `data/audit/el-review-raw-verify.json`에 수정본 재풀이 결과가 있다.

## 재현 가능한 산출물

- 스크립트: `scripts/ap-generation/el-review-run.ts`(맹검 풀이·FRQ 채점·FRQ 감사), `el-review-rewrite.ts`(선지 길이 보정), `el-review-refs.ts`(해설 문장 번호 제거), `el-review-pron.ts`(성별 대명사), `el-review-build-fixes.ts`(병합·수기 정정·FRQ 패치·게이트 검증·계획 생성), `el-review-fixes.test.ts`(불변식 6개).
- 원시 응답: `data/audit/el-review-raw-*.json`, 패치 목록 `el-review-frq-patches.json`, 결정 `el-review-decisions.json`, 병합 MC `el-review-merged-mc.json`.
- 테스트: `npx vitest run scripts/ap-generation/el-review-fixes.test.ts lib/ap-generation/englang-gates.test.ts lib/ap-generation/englang-frq.test.ts lib/ap-admin/audit-swap-plans.test.ts` 통과(수정본의 키 위치·키 문구 유지·게이트·숨은 문장 번호 0·길이 단서 40% 미만·FRQ 게이트·계획 형식).

## 비용(원장)

- 이 검수의 모델 비용 약 $5.9(예산 $12 이내): 맹검 풀이 $1.72(Fable 1.24·Opus 0.48), 선지 보정 $0.88, 수정 전후 재풀이 $0.49+약 0.5, FRQ 채점 $0.32+0.3, FRQ 감사 약 $1.4, 해설·대명사 $0.23.
- `scripts/ap-generation/ledger-total.ts`: 시작 $135.8772 → 종료 $141.756(중단선 $195 대비 여유 $53.2). 원장 파일 변경과 `data/ap/sample-2027/englang-review/` 응답 기록을 함께 커밋했다.

## 한계·위험

1. **사람 검수가 아니다.** 같은 계열 모델 3종(+작성자)의 합의는 공유 사각지대(예: 지나치게 선지 문구에 의존하는 해석, 시험 직전 학생의 실제 오독 패턴)를 못 잡는다. 키 오류율 0–2%는 "자동·모델 검수 후 잔여 추정"이며, 그라운드워크 §6의 사람 표본 30%·지문 100%는 여전히 남는다. 정정 신고 경로는 유지할 것.
2. 수정본은 모델이 다시 쓴 오답 선지를 포함한다. 맹검 재풀이(Opus)와 결정적 게이트는 통과했지만 **학생 데이터 없이는 오답 선지의 매력도(난이도)가 달라졌는지 확인할 수 없다.** 권장(recommended) 계획은 그 위험을 받아들이고 길이 단서를 없애는 선택이다.
3. 새 후보는 적재 뒤 render/screen 검증 증거가 새로 필요하다(원본 증거는 키가 달라 승계되지 않음). 검증을 건너뛰면 검수 환경 게시 조건에서 막힐 수 있다.
4. FRQ 샘플 점수는 저장값(3채점기 중앙값)과 이번 단일 채점기 결과가 최대 2점 차이난다. 경계 사례(fb2·fb3 low의 Thesis)는 사람 채점 보정이 필요하다.
5. EL-12의 r11 #1 해설 한 줄, EL-21(이름 동질성)은 남겨 두었다.
