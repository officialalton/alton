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
