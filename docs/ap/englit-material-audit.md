# AP English Literature — 자료 분포 감사와 실제 작품 보강 계획 (2026-10-15, Phase 1)

오너 정책(`docs/POLICY-DECISIONS.md` 2026-10-15): English Literature 는 재사용 권리가 확인된 **실제 작품** 중심으로 보강한다. 기존 ALTON 창작 지문은 **삭제하지 않고** 구분 보존하며 '실전 대표성 확인'으로 처리하지 않는다. 자료를 먼저 확정한 뒤 스킬·질문·정답/오답 근거를 설계한다. 일괄 폐기·대량 재생성 금지.

이 문서는 Phase 1(감사 + 우선순위 + 실제 출처 등록부 샘플 + source-first 샘플 + 화면 배치 검증)의 결과다. **DB 적재·게시본 변경·원격 DB 접근 없음.** 산출물은 전부 `englit-real-1` 브랜치 파일이다.

- 감사 원자료: `data/ap/englit-material-audit.json` (생성기 `scripts/ap-generation/englit-audit.ts`, 무료·읽기 전용)
- 출처 등록부: `data/ap/englit-sources/registry.json` + `texts/*.txt` (빌더 `scripts/ap-generation/englit-sources-build.ts`)
- 샘플 후보: `data/ap/englit-sources/sample/real-sample-items.json`, `real-sample-frq.json` (**stock 폴더 밖** — 풀 로더가 읽지 않는다)
- 화면 배치: `docs/ap/englit-layout/*.png`, `layout-before.json`, `layout-after.json`

## 1. 공식 기준(비교 대상)

출처는 `docs/ap/englit-facts.md`(CED V.1 Fall 2024 PDF 를 2026-10-14 에 직접 읽고 정리). **이번 세션에서는 AP Central 을 다시 내려받지 않았다**(다운로드 허용 도메인 밖) — CED 수치는 위 문서를 인용하며 재검증하지 않았다(UNVERIFIED 목록 참고).

| 항목 | 공식(CED) | 앱 규칙 코드 |
|---|---|---|
| MC | 55문항·5묶음·묶음당 8–13문항, 묶음마다 시 또는 산문(희곡 포함), 산문 ≥ 2·시 ≥ 2 | `lib/ap-exam/englit-rules.ts` |
| 장르 비중(MC) | 단편 소설 42–49% · 시 36–45% · 장편 소설·희곡 15–18%; 20·21세기 텍스트가 그 이전보다 많다 | 55문항 환산: 단편 23–27 / 시 19–25 / 장편·희곡 8–10 (하한 내림·상한 올림) |
| FRQ | Q1 시 분석(약 100–400단어) · Q2 산문 분석(약 600–800단어, 희곡 가능) · Q3 문학 논증(학생이 작품 선택), 각 6점 | `LT_FRQ_BOUNDS` |

## 2. 현재 LT1/LT2 분포

**전체 요약: 지문 14편(MC 10 + FRQ Q1·Q2 4) 전부 ALTON 창작(가공 저자·제목·배경). 실제 작품 0편.** 장르 비중 숫자는 공식 범위 안(LT2 장편·희곡 8문항 = 14.5% 는 반올림 허용 범위의 하한).

### LT1

| 위치 | 세트 | 장르 | 시기(가공 저자 연도) | 출처 | 문항 | 단어/줄 |
|---|---|---|---|---|---|---|
| 1 | s01 The Harlan Narrows Crossing | 단편 산문 | mid-20th manner (1954) | ALTON 창작 | 11 | 685 / 67 |
| 2 | s05 The Danner Account | 단편 산문 | mid-20th manner (1958) | ALTON 창작 | 13 | 649 / 63 |
| 3 | p01 To the House on Tenney Street, Before the Closing | 시 | mid-20th manner (1957) | ALTON 창작 | 13 | 223 / 26 |
| 4 | p03 The Bench in Vrana Square | 시 | mid-20th manner (1961) | ALTON 창작 | 8 | 310 / 37 |
| 5 | l04 Breakfast Is at Seven | 장편 산문 발췌 | mid-20th manner (1954) | ALTON 창작 | 10 | 671 / 64 |
| FRQ Q1 | fb1 To the Ellery Orchard, at Picking's End | 시 분석 | 1914 manner | ALTON 창작 | — | 270 |
| FRQ Q2 | fb2 The Letter on the Net Box | 산문 분석 | 1953 manner | ALTON 창작 | — | 758 |
| FRQ Q3 | fb3 문학 논증 | 지문 없음 | — | 작품 목록 40편은 실제 출판 작품(ALTON 선정, 공식 목록 아님) | — | — |

장르 문항: 단편 24 (43.6%) · 시 21 (38.2%) · 장편 10 (18.2%) → 모두 범위 안. 묶음 크기 11/13/13/8/10(모두 8–13). 시 묶음 2·산문 묶음 3.

### LT2

| 위치 | 세트 | 장르 | 시기 | 출처 | 문항 | 단어/줄 |
|---|---|---|---|---|---|---|
| 1 | s02 The Patience | 단편 산문 | 19th manner (1871) | ALTON 창작 | 12 | 582 / 58 |
| 2 | s03 Canon One | 단편 산문 | contemporary (2019) | ALTON 창작 | 12 | 649 / 65 |
| 3 | p02 Trackbed, Kell Valley Branch | 시 | contemporary (2019) | ALTON 창작 | 10 | 275 / 33 |
| 4 | p05 Accession 4471-B | 시 | contemporary (2019) | ALTON 창작 | 13 | 280 / 32 |
| 5 | l01 The Kitchen Room | 희곡 | mid-20th manner (1953) | ALTON 창작 | 8 | 693 / 78 |
| FRQ Q1 | fa1 Spin Cycle, Ellery Street | 시 분석 | contemporary (2019) | ALTON 창작 | — | 230 |
| FRQ Q2 | fa2 The Second Lesson | 산문 분석 | 1861 manner | ALTON 창작 | — | 685 |
| FRQ Q3 | fa3 문학 논증 | 지문 없음 | — | 실제 작품 목록 | — | — |

장르 문항: 단편 24 (43.6%) · 시 23 (41.8%) · 장편·희곡 8 (14.5%, 55문항 환산 8–10 안). 묶음 크기 12/12/10/13/8. 시 2·산문 3.

### 감사 소견

1. **실제 작품 비율 0%**: 14개 지문 모두 가공 저자·가공 배경. 실전의 '실제 작품·실제 저자 관점·실제 지역/시대 다양성'은 이 자료로 확인할 수 없다 — 지역·관점은 전부 '가공 설정'이다.
2. **시기 분포가 한쪽으로 치우침**: LT1 MC 5묶음이 전부 'mid-20th-century manner' (19세기·21세기 없음), FRQ 는 1914/1953 스타일. LT2 는 19세기 1·mid-20세기 1·contemporary 3. 모두 *작풍 모방*이지 실제 시기 텍스트가 아니다.
3. **장편 소설·희곡 비중이 가장 취약**: LT1 은 희곡이 없고, LT2 의 희곡 1묶음이 8문항(14.5%)으로 범위 하한이다. 장편 발췌(L)는 가공 헤드노트로 '장편의 일부'를 흉내 낸다.
4. **상태**: 14개 세트 모두 `releaseTier: candidate`, `expertStatus: unreviewed`, `renderVerified: false`. 어떤 것도 '실전 대표성 확인'으로 처리되지 않는다 — `data/ap/englit-material-audit.json` 의 모든 행이 `representative_of_real_exam: false` 와 라벨 `ALTON original; not confirmed representative of the real exam` 을 가진다(재고 23행: LT1/LT2 사용분 + 미사용·거절분 포함. 원본 stock 파일은 수정하지 않았다).
5. Q3 작품 목록은 ALTON 이 고른 실제 출판 작품 40편이며 공식 목록과 대조하지 않았다.

## 3. 보강 대상 우선순위(작은 단계, 기존 새 버전 흐름)

각 단계는 기존 '새 버전' 흐름(교체 계획 `*swap-plan*.json` → 미리보기 → 초안 → 별도 공개)으로 적용하고, 단계마다 `verifyEnglitFullComposition`(55문항·묶음 8–13·장르 범위·시/산문 ≥ 2)을 통과해야 한다. 아래 목록은 계획이며 이 브랜치는 어떤 교체도 적용하지 않는다.

| 순위 | 단계 | 슬롯 | 현재 | 실제 작품 | 상태 |
|---|---|---|---|---|---|
| 1 | 1 | LT1 FRQ Q1 (fb1) | ALTON 시(1914 manner) | Hopkins "God's Grandeur" | **FRQ 샘플 작성(rf1)** — 가장 싸고 충실도 이득이 크다 |
| 2 | 1 | LT2 FRQ Q2 (fa2) | ALTON 산문(1861 manner) | Chekhov "The Lady with the Dog" §I (Garnett 번역) | **FRQ 샘플 작성(rf2)** (689단어, Q2 범위 600–800 안) |
| 3 | 2 | LT1 MC p03 (시, 8문항) | ALTON "The Bench in Vrana Square" | Dickinson "The Chariot" | **MC 샘플 세트 작성(rs1)** — 8문항 슬롯이라 1:1 교체 가능 |
| 4 | 2 | LT2 MC p05 (시, 13문항) | ALTON "Accession 4471-B" | 등록부 공백: 30행 이상 PD 시 필요 | 15행 시(Dunbar, rs2)로는 13문항을 못 채운다 |
| 5 | 3 | LT1 MC s05 (단편, 13문항) | ALTON "The Danner Account" | Chopin "A Pair of Silk Stockings" (rs3) | 샘플은 ≤ 10문항 — 더 긴 발췌 또는 크기 보상 교체 필요 |
| 6 | 3 | LT2 MC l01 (희곡, 8문항) | ALTON "The Kitchen Room" | Ibsen *A Doll's House* 발췌 | 등록부 텍스트 준비됨, 세트 미작성 |
| 7 | 4 | LT1 FRQ Q2 (fb2) | ALTON 산문(1953 manner) | Crane "The Open Boat" | 등록부 531단어 — Q2 범위 600–800 미달, 경계 확장 필요 |
| 8 | 4 | LT1 MC l04 (장편 산문, 10문항) | ALTON "Breakfast Is at Seven" | 등록부 공백(PD 장편 소설 발췌 필요) | |
| 9 | 5 | LT1 p01·s01, LT2 p02·s02·s03, LT2 FRQ Q1(fa1) | ALTON 지문 | 추가 등록부 필요 | **현대(2019 alias) 슬롯은 1929 이전 PD 로 대체 불가** — 오너 결정(라이선스 또는 명시 PD 현대 텍스트) 전까지 라벨 붙은 ALTON 창작을 유지 |

**시기 균형 제약(오너 결정 필요)**: CED 는 20·21세기 텍스트가 이전보다 많다고 한다. 1929 이전(미국 PD) 텍스트만으로 전부 교체하면 현대 비중이 공식보다 낮아진다. 해결 옵션은 (a) 현대 슬롯은 ALTON 창작을 라벨 보존하며 유지, (b) 저작권자 허락·라이선스 확보, (c) 1929–1963 작품의 갱신 누락(저작권 소멸) 여부를 Catalog of Copyright Entries 로 개별 확인. 이 단계에서는 어느 쪽도 선택하지 않았다.

## 4. 실제 작품 출처 등록부 샘플 (`data/ap/englit-sources/registry.json`)

지문은 **코드가 저장소 원문의 줄 범위를 잘라** 만들었다(기억에서 옮기지 않음). 등록부 항목마다 제목·저자(번역자)·연도/판본·저장소·URL·재사용 근거·발췌 경계(원문 줄 번호 범위, 작품 안의 줄/문단 번호)·변경 사항·원문 파일 sha256(+바이트)·저장 텍스트 sha256 을 기록한다. 원문 파일은 저장소에 커밋하지 않는다(sha256 만). 재생성: `RAW_DIR=<원문 폴더> npx tsx scripts/ap-generation/englit-sources-build.ts`. 검증 함수 `validateEntry` 는 해시·줄/문단 수·1929 이전 발행·허용 저장소·재사용 근거를 확인한다(`lib/ap-generation/englit-sources.test.ts`).

| id | 작품 | 장르·시기·지역 | 판본(저장소) | 발췌(원문 줄) | 저장 텍스트 |
|---|---|---|---|---|---|
| dickinson-chariot | Emily Dickinson, "The Chariot" (Because I could not stop for Death) | 시 · 19세기 · 미국 | 1890 Todd/Higginson 편집본 — Gutenberg #12242. **1890 편집 텍스트(5연 20행)이며 후대 원고 기반 텍스트와 다르다** | 전체 20행 (raw 2533–2556) | 107단어 |
| whitman-spider | Walt Whitman, "A Noiseless Patient Spider" | 시 · 19세기 · 미국 · 자유시 긴 줄 | Leaves of Grass — Gutenberg #1322 (**정확한 판본 연도는 파일에 없음: UNVERIFIED**; 1881 이전 수록) | 전체 10행 (raw 14563–14574) | 87단어 |
| dunbar-mask | Paul Laurence Dunbar, "We Wear the Mask" | 시 · 19세기 말 · 미국(아프리카계) | Complete Poems 1913 — Gutenberg #18338 (시는 1896) | 전체 15행 (raw 4728–4744) | 98단어 |
| hopkins-grandeur | Gerard Manley Hopkins, "God's Grandeur" | 시(소네트) · 빅토리아·1918 사후 출판 · 영국 | Poems, ed. Bridges 1918 — Gutenberg #22403 | 전체 14행 (raw 903–920) | 125단어 |
| chopin-silk-stockings | Kate Chopin, "A Pair of Silk Stockings" | 단편 · 19세기 말 · 미국(뉴올리언스) | Gutenberg #160 (1897 Vogue) | 문단 1–7 (raw 6928–6988) | 640단어 |
| chekhov-lady-dog | Anton Chekhov, "The Lady with the Dog" §I (Constance Garnett 번역) | 단편 · 20세기 전환기 · 러시아(번역) | Garnett 1917 — Gutenberg #13415 (원작 1899) | §I 문단 1–8 (raw 76–139) | 689단어 |
| crane-open-boat | Stephen Crane, "The Open Boat" §I | 단편 · 19세기 말 · 미국 자연주의 | Heinemann 1898 print — Gutenberg #45524 (1897 Scribner's) | §I 문단 1–9 (raw 164–215) | 531단어 |
| ibsen-dolls-house | Henrik Ibsen, *A Doll's House* Act III 대화 (R. Farquharson Sharp 번역) | 희곡 · 19세기 · 노르웨이(번역) | Everyman 1910 — Gutenberg #2542 (원작 1879) | 21 대사 (raw 4716–4806) | 538단어 |

- **재사용 근거(전 항목)**: 미국 공유 영역 — 1929 이전 발행(번역본도 1917·1910 발행), 저자 사망 후 오래 경과, 저장소가 미국 저작권 비보호임을 명시. 저장소 상표·라이선스 머리말은 텍스트에 넣지 않았다. **법률 검토는 아니다**: 사용 기준은 '미국 내 1929 이전 발행'이며 한국 등 다른 관할 판단은 하지 않았다.
- **변경 사항(전부 등록부 `modifications` 에 기록)**: 제목 줄·절 번호 제거, 저장소 줄바꿈(하드랩)을 문단 단위로 복원, `_이탤릭_` 표기 제거, 희곡은 화자 줄을 대사에 합쳐 `NAME. text` 형식. **원문 줄 구조를 보존하는 변경**: Whitman 8행째와 Hopkins 소네트 3행은 저장소가 접어 둔 줄이라 이어 붙여 '원문 한 줄 = 저장 한 줄'로 만들었다. 인용부호·철자는 원문 그대로(Whitman 의 mark’d 등).
- 다운로드(plain text, `https://www.gutenberg.org/cache/epub/<번호>/pg<번호>.txt`): pg12242.txt 206,765 B · pg1322.txt 780,492 B · pg18338.txt 566,810 B · pg22403.txt 192,791 B · pg160.txt 392,860 B · pg13415.txt 423,298 B · pg45524.txt 398,135 B · pg2542.txt 169,080 B (모두 gutenberg.org, 스크래치패드의 별도 폴더에 저장, 실행하지 않음). 제목 검색용으로 gutenberg.org 검색 결과 HTML 몇 쪽을 읽기만 했다(저장 안 함).

## 5. source-first 샘플 후보 (DB 미적재, `data/ap/englit-sources/sample/`)

순서: **지문 확정(코드) → 모델이 text_map(중심 생각·화자·구조·장치·지문이 실제로 받쳐 주는 스킬) 작성 → 그 스킬에서 문항·정답 근거·오답 근거 설계**. 모델은 지문을 쓰지 않고 줄 번호도 쓰지 않는다. 근거 구절은 지문에서 정확히 한 번 나오는 3–14단어 인용이어야 하고, 코드가 **원문 줄·연/문단 위치를 계산**해 문항 `real_text.key_evidence` / `distractor_evidence` 에 저장한다(정답은 반드시 지문 근거, 오답은 지문 반박 근거 ≥ 2개, 나머지는 '지문에 없음(absence)'을 명시). 결정적 게이트는 기존 `itemViolations`(손으로 쓴 줄 번호·지문에 없는 인용·장치·길이 단서 등) + 근거 규칙을 적용한다.

검증(문항마다 `real_text.verification`): 맹검 독립 풀이 2(Opus 5.5·Sonnet 5.5, 선지 순서 달리함) 전원 일치 → 적대 검토(Opus) → 심판(Opus) → **제2 모델 패널(Fable 5.1, 선지 순서 변경, 맹검)** 일치. 키 신뢰도 ≥ 0.8. 하나라도 어긋나거나 두 번째 방어 가능 선지가 보고되면 제외하고 미해결 목록에 올렸다.

| 세트 | 지문 | 생성 | 검증 통과 | 제외 | 비고 |
|---|---|---|---|---|---|
| real-rs1 | Dickinson "The Chariot" (시, 20행) | 10 | **8** | 2 | 8문항 = 공식 묶음 하한. LT1 p03(8문항) 슬롯 크기와 일치 |
| real-rs2 | Dunbar "We Wear the Mask" (시, 15행) | 9 + 보충 7 = 16 | **11** | 5 | 첫 라운드 통과가 5문항뿐이라 겹치지 않는 문항 7개를 보충 생성(비용 포함). 15행 시에 11문항은 많은 편 — 13문항 슬롯에는 못 쓰고 질문 각도가 좁아질 수 있다 |
| real-rs3 | Chopin "A Pair of Silk Stockings" (산문, 문단 1–7) | 10 | **10** | 0 | 단편 슬롯 크기(10–13) 안 |

- 합계 29(+7 보충) 문항 중 **29 통과 / 7 제외**: 풀이 전원 일치·패널 일치 19/19(1차)+6/6(보충 포함)에서 패널 불일치 0. 제외 7건은 모두 **'키가 틀렸다'가 아니라 신뢰도 하한 미달 또는 풀이기가 두 번째 방어 가능 선지를 보고한 경우**다 — 미해결 목록(아래)에 문항·사유를 남겼다.
- 스킬 분포: rs1 6.C·1.E·4.C·4.D·3.C·5.B·4.A·7.B / rs2 6.B·1.E·4.A·3.D·7.B·7.C·3.B·1.D·7.A·4.B·3.F / rs3 5.B·1.A·4.C·6.A·3.D·4.B·4.C·3.E·1.E·7.B (표시 순서). 시 세트에 비교(6.x)는 지문이 실제로 비유를 가질 때만 출제됐다.
- 세트 JSON 은 기존 `lt-*-items.json` 과 같은 필드 + `real_text`(skill·근거·검증), `provenance.kind = "public_domain"`(등록부 id·URL·재사용 근거·sha256), `set_intro` 첫 줄 `Public-domain source text`(학생 화면 표지, `lib/ap-exam/stimulus-display.ts` 에 추가한 표지로 영어 지문과 같이 처리). `releaseTier: sample_not_loaded` 이며 `data/ap/stock/` 밖이라 풀 로더가 읽지 않는다.

### 미해결(제외) 문항 — 공개 후보에서 제외

| 세트 | 문항(스킬) | 사유 |
|---|---|---|
| rs1 | 1.D 마차 동승자 묘사 | 풀이기가 두 번째 방어 가능 선지 보고 |
| rs1 | 3.B 3연 이미지 순서 | 풀이기가 두 번째 방어 가능 선지 보고 |
| rs2 | 5.B "debt" | 키 신뢰도 0.788 < 0.8 (심판은 key_clearly_better, 적대 weak) |
| rs2 | 4.C 수사 의문문과 답 | 동일 |
| rs2 | 5.A "clay"·"mile" 이미지 | 동일 |
| rs2 | 3.C 마지막 행 기능 | 동일 |
| rs2 | 1.A "mouth with myriad subtleties" (보충 라운드) | 동일 |

### FRQ 샘플 2종 (`real-sample-frq.json`)

| 과제 | 지문 | 샘플 답안 (채점 2 독립 채점자, englit-v1 루브릭 행 기준) |
|---|---|---|
| rf1 Q1 시 분석 | Hopkins "God's Grandeur" (125단어) | high 6/6 (1·4·1), mid 4/6 (1·3·0), low 2/6 (0·2·0) — 두 채점자 점수 차 0 |
| rf2 Q2 산문 분석 | Chekhov "The Lady with the Dog" §I (689단어) | high 6/6, mid 4/6, low 2/6 — 후보 2개 중 점수 차 ≤ 2 인 후보를 채택, 두 채점자 점수 차 0 |

- 과제문은 지문을 먼저 읽은 뒤 `addressed`·`focus` 절과 과제 맞춤 루브릭 지침을 설계했다. 채점은 운영 채점 경로의 **englit-v1 행 설명**(`RUBRIC_ROWS_ENGLIT`: 논지 0–1 · 증거와 해설 0–4 · 정교함 0–1)을 두 독립 채점자(Opus 5.5 · Sonnet 5.5, 서로 다른 채점 프롬프트)에게 그대로 주어 수행했다. 운영 `processEssay` 경로(`scripts/essay-calibration.ts`)로는 **이번에 다시 채점하지 않았다**(비용·범위; 해당 스크립트는 stock 파일만 읽음).
- 후보 6개 중 의도 단계와 한 점 이상 어긋난 것은 rf2 mid k0(채점자 4·5, 최종 5)와 low k1(3)이며 이들은 채택하지 않았다.
- 한계: 샘플 답안·루브릭 지침은 ALTON 작성(공식 College Board 채점 아님)이며, 모델 채점자끼리의 일치는 인간 채점자 일치를 보증하지 않는다.

### 비용
이번 단계 모델 지출 **$1.90**(상한 $6; 원장 누적 $202.64 → **$204.54**, 중단선 $235 여유 $30.46). 단계별: 문항 생성 $0.88(보충 포함), 풀이·적대·심판·패널 $0.65 안팎, FRQ 과제·샘플·채점 약 $0.40. 원장 항목은 `data/ap/sample-2027/ledger.json`, 실행 원자료는 `data/ap/sample-2027/englit-real-1/`.

## 6. 화면 배치 검증 (`docs/ap/englit-layout/`)

방법: 로컬 목업(DB·Supabase 스택 없음). 실제 `PassageBlock` 컴포넌트를 서버 렌더링하고 Tailwind 를 실제로 컴파일해 Playwright(Chromium)로 측정·촬영. 지문 칸 폭은 `ApExamTakeClient` 의 실제 `section` 클래스를 흉내 냈다 — 모바일 390px: 칸 358px(px-4), 줄 번호 열 32px 제외 텍스트 326px / 데스크톱 1280px: 지문 칸 640px(md:w-1/2, px-8) → 텍스트 544px. **실제 학생 화면의 다른 요소(상단 바 등)·실제 브라우저 UA 는 확인하지 못했다**. 재실행: `LABEL=<이름> npx tsx scripts/ap-generation/englit-real-layout.tsx`.

결과(8개 등록부 텍스트 × 2 폭, 측정 `layout-before.json` / `layout-after.json`):

1. **번호는 항상 원문 줄 첫 행에 붙는다** — 16개 조합 전부에서 번호 상자의 top == 텍스트 첫 행 top (줄이 접혀도). 5줄마다 번호(5·10·15…)가 '세는 줄'(빈 줄 제외) 기준으로 나온다(예: Chariot 20행 → 번호 4개, Hopkins 14행 → 2개).
2. **1280px**: 모든 텍스트가 한 줄 = 한 행(접힘 0). 가장 긴 시 줄 484px(Whitman) < 544px.
3. **390px 시**: Chariot·Dunbar 접힘 0. Whitman 6/10줄, Hopkins 5/14줄이 한 번 접힌다(긴 줄은 휴대폰에서 접히는 게 불가피).
   - **발견한 결함(수정함)**: 접힌 이어지는 행이 *첫 행 글자보다 왼쪽*(Hopkins 들여쓴 줄에서 -10px)·같은 위치(Whitman 0px)에서 시작해 번호 없는 '새 줄'처럼 읽혔다(번호는 원문 줄에 맞게 정확). `PassageBlock` 텍스트 칸에 내어쓰기(`pl-6 -indent-6`)를 추가해 이어지는 행이 +14/+24px 들여써지게 했다(`layout-after.json`: Hopkins +14, Whitman +24). 번호 정렬은 변경 전후 동일. 테스트: `LearningText.passage.test.tsx`. **공유 컴포넌트 변경이라 기존 ALTON 지문의 줄 접힘 표시도 같이 바뀐다** — 오너 확인 권장.
4. **390px 산문(미해결 설계 쟁점)**: 코드가 56자로 접은 줄(번호 기준)이 휴대폰 텍스트 칸(326px)보다 길어 **Chopin 44/70, Chekhov 38/74, Crane 29/55, Ibsen 32/62줄이 한 번 더 접힌다**. 번호는 여전히 '56자 줄' 기준이라 5줄 간격이 화면상 약 7–10행으로 늘어나 보인다. 가장 긴 산문 줄은 14px 기준 385px → 326px 칸에 맞추려면 약 11.8px 이하가 필요. 선택지: (a) 모바일 산문 글자 크기 축소(≈11.5px), (b) 산문 줄에서 접힘 금지+가로 스크롤(`section` 은 이미 overflow-x-auto), (c) 접힌 행 수 기준으로 번호를 다시 세는 반응형(번호가 폭에 따라 달라져 문항의 'line N' 과 어긋나므로 비권장). **이번 단계에서는 바꾸지 않았다** — 사용자 경험이 갈리는 결정이다.
5. 시의 들여쓰기(Dunbar 후렴 4칸, Hopkins 교대 3칸)는 보존돼 표시된다(`white-space: pre-wrap`).

**공식 미리보기와의 비교**: AP Central 공개 샘플 쪽은 이번 세션에서 가져오지 않았다(다운로드 허용 도메인 밖). 따라서 위 배치는 **'공식 미리보기와 동일함이 검증되지 않음(not verified identical)'** 이다. 샘플 JSON 의 모든 `payload.layout_status` 에 같은 문구를 넣었다. 학생 화면 UI 에 별도 표시는 넣지 않았다(샘플이 DB 에 적재되지 않아 학생에게 노출되지 않음) — 적재 시점 전에 공식 미리보기의 줄 번호 위치·접힘 방식과 대조해야 한다.

## 7. UNVERIFIED / 오너 확인 필요

1. **CED 수치 재확인 안 함**: 장르 비중·묶음 크기·FRQ 단어 범위는 `docs/ap/englit-facts.md`(2026-10-14, CED PDF 직접 읽음) 인용. 이번 세션에서 AP Central 을 다시 열지 않았다.
2. **공식 미리보기와의 배치 비교**: 위 6절 — 미검증.
3. **Whitman 판본 연도**: Gutenberg #1322 파일이 판본 연도를 밝히지 않는다(시 자체는 1881 이전 발행이라 PD 판단에는 영향 없음).
4. **Dickinson 텍스트는 1890 편집본**: 후대 원고 기반 판본과 구두점·연 수가 다르다. 학습용으로는 문제없으나 '정본'으로 표기하면 안 된다.
5. **재사용 근거는 미국 1929 이전 발행 기준**이며 법률 자문이 아니다. 번역본(Garnett 1917, Sharp 1910)은 발행연도 기준으로 판단했다.
6. **현대(21세기·1929 이후) 텍스트 공백**: 1929 이전 PD 만으로는 CED 의 '20·21세기 우세'를 만족시킬 수 없다 — 오너 결정 필요(3절 끝).
7. **세트 크기 제약**: 55문항 합계와 묶음 8–13 때문에 샘플 세트를 슬롯에 넣으려면 같은 크기여야 한다(rs1=8 은 LT1 p03 에 맞음, rs2=11·rs3=10 은 정확히 맞는 슬롯이 없음 — 단계 적용 시 크기 보상 교체 필요).
8. **전문가 검수 없음**: 모든 문항 `expertStatus: unreviewed`. 출시 후 오류 신고로 보완한다는 정책에 따라 자동 검사·독립 풀이만 수행했다.
9. 샘플 답안을 운영 `processEssay` 경로로 다시 채점하지 않았다.
10. 학생 화면 전체(상단 바·문항 전환)에서의 배치와 실제 휴대폰 브라우저는 확인하지 못했다(목업 폭 재현).
