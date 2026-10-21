# US History Practice Exam 3 (US3): 실제 출처 전환 계획 (조사·계획·비용 산정만)

2026-10-21. 상태: **US3 공개 보류**(오너 지시). 이 문서는 조사·계획이며 유료 호출·생성·DB 쓰기·공개는 하지 않았다. 실제 출처 중심 정책(`docs/POLICY-DECISIONS.md` 2026-10-15)은 완화하지 않는다: 합성 자료에 출처 이름만 붙이거나 실제처럼 표시하지 않고, 자료를 먼저 고정한 뒤 질문·정답·루브릭을 설계하며, 미해결 문항은 공개에서 제외한다.

근거 파일: `data/ap/stock/exact-assign-ushistory-us3.json`, `ush-r19f-items.json`, `ush-r19f4-items.json`, `ush-real-*-items.json`, `data/ap/ush-sources/registry.json`(31건), `docs/ap/ushistory-groundwork.md` §9–11, `docs/ap/ushistory-material-audit.md`, `lib/ap-admin/batches.ts`(US3 주석), `scripts/ap-generation/ledger-total.ts`(실행 결과 누적 $504.01 / 중단선 $640, 여유 $135.99).

## 1. US3 FRQ 5개 현재 상태

모두 `pipeline: code_first_v2`, `provenance.kind: alton_composed`("fictional sources and attributions"), `stimulusOrigin`·`sourceRegistryIds` 없음 = **실제 출처 0건**. 참고답·루브릭은 'ALTON practice rubric, not official College Board scoring' 표지가 붙어 있다.

| 칸 | 키 (run) | 단원·스킬 | 자료 | 합성/실제 | 표시 문구(학생 화면) | 질문 / 참고답 요약 |
|---|---|---|---|---|---|---|
| SAQ1 | `ush-r19-f4:saq1_r4` | 9.1 · 3.C | 2차 자료 2개(Holloway, Amberg) | **합성**: 가상 저자·가상 저서(`(fictional book)`) | "ALTON-composed stimulus" + "(fictional book) (ALTON-composed, in the style of a recent scholarly monograph)" | Sun Belt 성장 해석 차이(A), 발췌에 없는 사건으로 두 해석 각각 지지(B,C). 참고답이 Interstate Highway 1956 등 외부 사실에 의존 |
| SAQ2 | `ush-r19-f:saq2_r1` | 2.1 · 3.A | 1차 자료: 펜실베이니아 독일계 농부의 1746 편지 | **합성**: "a fictional German-speaking farmer" | "ALTON-composed stimulus (primary source)… fictional… ALTON-composed, in the style of letters home" | A 발췌 속 주장 1개 식별, B 1680–1754 독일계 이주 요인, C 비영국계 이민 증가의 식민지 영향. B·C 참고답은 자료 비의존 사실(Penn 1681, redemptioner 등), A만 합성 발췌에 의존 |
| SAQ3 | `ush-r19-f4:saq3_r4` | 5.1 · 1.B | 표: 북부·남부 철도 마일 1850·1860 | **합성 수치**: "Illustrative composite… not real census data" | "ALTON-composed stimulus (table)… Illustrative Composite… not real census data" | A 추세, B 격차 변화(4,600 → 12,700마일), C 북부 철도망이 더 큼. **A·B·C 전부 가상 수치에서 계산** (정답 숫자도 가상) |
| DBQ | `ush-r19-f:dbq_r1` | 8.1 · 6.A | 문서 7개: 연방 직원 편지·편집 사설·카운티 civil defense 팸플릿·교사 증언·차트·평화위원회 편지·2차 자료(가상 Venn 2009) | **전부 합성**(가상 인물·가상 카운티·가상 신문·합성 차트) | 문서마다 "ALTON-composed, in the style of…" | "Evaluate the extent to which fear was the primary force shaping Americans' responses… 1945–1963". 7점 루브릭 + 참고답이 **7개 합성 문서의 내용**을 인용 |
| LEQ | `ush-r19-f:leq_r1` | 3.1 · 6.A | **자료 없음(프롬프트만)**, 시험 그대로 | 합성 자료 없음. 프롬프트·루브릭은 ALTON 작성(역사 서술은 사실) | provenance 가 `alton_composed`/"fictional sources" 로 되어 있어 표시가 실제와 맞지 않음(표시가 '가상 자료'를 말하지만 실제로는 자료가 없음) | "Evaluate the extent to which the American Revolution changed social and political life… 1763–1877". 참고답은 일반 사실 서술 |

요약: 5개 중 **4개(SAQ1·SAQ2·SAQ3·DBQ)가 합성 자료 의존**, LEQ 는 자료가 없어 교체할 자료가 없다(프롬프트·참고답의 사실 점검과 표지 정정만 필요). SAQ1 은 후보 키가 있지만 `ush-r19f` 의 SAQ1·SAQ3(`saq1_r1`·`saq3_r1`)는 탈락(rejected) 상태로 US3 에는 r19-f4 판을 썼다.

## 2. 이미 확보된 실제 자료와 US3 FRQ 구성 가능 범위

레지스트리 31건(`data/ap/ush-sources/registry.json`, 각 항목에 저자·연도·저장소·call number·rights_statement·reuse_basis·modified·retrieved·sha256, 원본 발췌와 이미지는 `data/ap/ush-sources/files/<id>/SOURCE.md`, 이미지는 `public/ap-sources/<id>/`). 재사용 근거 기록 위치는 그 registry 의 `reuse_basis`·`rights_statement` 필드다.

**US1·US2 가 이미 쓴 것**(같은 자료를 US3 에 또 쓰면 시험 간 반복): DBQ 시장 혁명(Jackson veto, Robinson, Tocqueville, Lowell 판화, Thoreau, 지역별 인구 1800–1860, 노예 인구 지도 1861), DBQ 규제(Sumner, ICA, Keppler 'Bosses', Sherman, Tarbell, 'Next!', The Jungle), SAQ3(주택 보유율, 평원 인구), MC(흑인 인구, 외국 출생 1850–1940, Emancipation, Monroe, 도망노예법, Jones 일기, Reynolds 지도, 'School begins', 1892 보호구역 지도), US3 MC(Harriot).

**아직 어느 출시 후보에도 안 쓰인 실제 자료(US3 후보)**:

| id | 유형 | 연도 | 재사용 근거(registry) | US3 FRQ 활용 |
|---|---|---|---|---|
| `img-migrant-mother-1936` | 사진(비텍스트) | 1936 | 연방기관 직원 작품 + LoC 'no known restrictions' | **SAQ3** (비텍스트 칸). 이미 `ush-real-1:ap_us_history-real_saq3_1-k0`(단원 7.9, 스킬 3.A) 샘플 SAQ3 가 있고 Opus·Sonnet 풀이·Fable 점검을 거쳤으나(`data/ap/ush-sources/sample-frq.json`, `sample-verification.json`) **어느 `exact-assign`·배치에도 적재되지 않았다**. 시대 7 이라 US3 SAQ 시대(9/2/5)와 겹치지 않아 쓸 수 있다 |
| `txt-truman-1947` | 1차(대통령 연설) | 1947 | 미국 정부 저작물 | DBQ(8.1) 문서 1개 |
| `txt-fed10-1787` | 1차 | 1787 | PD(1929 이전) | US3 FRQ 에는 시대가 안 맞음(MC 3.x 후보 또는 LEQ 시대 자료로는 쓰지 않음) |
| `stat-foreign-born-region-1900-1990` | 통계표 | 2006(센서스 WP81) | 미국 정부 저작물 | SAQ3 대체 후보(시대 7·8·9, 이민 구성 변화) 또는 DBQ 정량 문서 |
| `txt-tordesillas-1494` | 1차 | 1494 | PD | 시대 1 이라 FRQ 칸 없음(US3 MC 후보로는 이미 통과 키 `real_e_tordesillas`가 있으나 배정 안 됨) |

결론: **이미 확보된 자료만으로 구성할 수 있는 US3 FRQ 는 SAQ3 1개**(Lange 사진 샘플을 정식 적재). DBQ 는 문서 7개 중 1개(Truman)만 있고 SAQ1·SAQ2·LEQ 는 해당 시대·유형의 확보 자료가 없다. US1·US2 가 쓴 자료를 US3 에 중복 사용하는 것은 법적으로는 가능하나(registry 재사용 근거 동일) 문제군·자료 반복을 줄인다는 오너 기준(2026-10-15)과 어긋나므로 권장하지 않는다.

## 3. 새로 확보할 자료: 후보와 재사용 근거 확인 방법

**2027 시험 구조 확인 필요(UNVERIFIED)**: 기존 감사(`ushistory-material-audit.md` §2, AP Central 2026-10-15 조회)는 SAQ1=2차 자료, SAQ2=1차 자료, SAQ3=1·2차 **비텍스트**, DBQ 7문서(글·정량·시각), LEQ 프롬프트만, SAQ·LEQ 는 2027년 5월 시험부터 개정 예정이라고 적었다. 'SAQ3 또는 최신 구조'(선택지 여부)는 이번에 새로 조회하지 못했다(웹 도구 미사용). **착수 전 AP Central 의 US History 시험 페이지·CED 를 다시 열어 SAQ 개수·선택 여부·문서 형식을 확인한다(첫 단계, 비용 0).**

**퍼블릭 도메인 판정 기준(기존 파이프라인과 동일)**: ① 미국 연방 정부 간행물·법률·대통령 문서(17 U.S.C. 105) ② 1929년 이전 간행물(registry 기존 기록과 동일하게 1929 기준 사용; 오너가 말한 1930 이전과 같은 취지이며 1929 이전 출판은 현재 확실히 PD) ③ 15세기 등 오래된 문서의 1929 이전 번역 ④ LoC 항목 페이지의 'No known restrictions' / GMD free to use and reuse + 간행 연도 확인. 현대 학술 서술(2차 자료)은 저작권이라 사용하지 않는다. 확인 방법: 저장소 항목 페이지의 권리 문구를 캡처해 registry 의 `rights_statement`·`reuse_basis` 에 기록, 원문에서 발췌를 **코드로 잘라 sha256 고정**(`ush-real-*-sources.py` 방식), 허용 도메인(loc.gov·avalon·gutenberg·archives.gov·census.gov 등)만 사용. 아래 후보의 구체 URL·권리 문구는 **아직 확인하지 않았다(UNVERIFIED)**; 확인 전에는 후보일 뿐이다.

| 칸 | 현재 시대 | 후보 자료(실제) | 근거 유형 | 비고·위험 |
|---|---|---|---|---|
| SAQ2 (1차 텍스트, 시대 2) | 2.1 독일계 이주 | Gottlieb Mittelberger, *Journey to Pennsylvania*(1750, 영역 1898); William Penn, *Some Account of the Province of Pennsylvania*(1681); Franklin, *Observations Concerning the Increase of Mankind*(1751) | 1929 이전 출판·번역 | 시대 2·단원 2.1 유지 가능. 질문 A 는 새 발췌로 다시 쓰고 B·C 는 사실 점검만. 후보 중 판본·번역 연도는 확인 필요 |
| SAQ1 (2차 텍스트 2개, 해석 대비) | 9.1 Sun Belt | **시대 9 는 PD 2차 자료가 거의 없다**(현대 역사가 저작물은 저작권). 선택지 (a) 연방 간행물(Census *Demographic Trends in the 20th Century*, 2002 등)은 PD이나 '서로 다른 해석' 대비를 만들기 어렵다. (b) **시대를 바꿔** PD 역사가 쌍 사용: Reconstruction(Dunning 1907, *Reconstruction, Political and Economic* vs Du Bois, "Reconstruction and Its Benefits", AHR 1910), 또는 프런티어(Turner 1893 vs 1900년대 비평) | (a) 정부 저작물 (b) 1929 이전 | (b)는 시대 변경 → US3 SAQ 시대(서로 달라야 함)와 exact-assign 검증기 재실행 필요. 오너 결정 사항. 여러 시대 자료의 인종차별적 서술(Dunning)은 자료 소개가 관점을 밝힘 |
| SAQ3 (비텍스트) | 5.1 철도(합성 표) | **권장: 기존 Lange 사진 SAQ3 정식화(신규 확보 0)**. 원래 주제(철도, 시대 5) 유지 시: 1860년 전후 철도 지도(LoC 지도과, 간행 1860년 전후)·센서스 1860 보고서의 철도 마일 표 | LoC 지도 / 정부 통계 | 센서스 1850·1860 철도 마일 표는 스캔본(텍스트층 없음, Stage B 에서 같은 문제로 폐기한 전례). LoC 철도 지도는 URL 미확인 |
| DBQ (7문서, 시대 8, 냉전 국내 대응) | 8.1 | Truman Doctrine 1947(기존), E.O. 9835 충성 심사 1947, Margaret Chase Smith 'Declaration of Conscience' 1950(의회 기록), FCDA 민방위 소책자 *Survival Under Atomic Attack* 1950(연방기관), National Defense Education Act 1958(법률), NCES 이공계 등록 통계표(연방 통계), Eisenhower 고별연설 1961(대통령), LoC 민방위·방공호 사진(권리 확인 필요) | 연방 문서 대부분 | 대부분 연방 저작물이라 PD 판정 쉬움. 만평(Herblock 등)은 저작권으로 불가. 시각 자료는 LoC 'no known restrictions' 항목만. 2차 자료 1개는 연방 CRS·역사실 간행물이 후보 |
| LEQ (프롬프트만) | 3.1 | 자료 없음 | — | 자료 확보 불필요. 프롬프트 사실 정합성·표지 정정만 |

## 4. 단계별 비용 (기존 실측 단가 기반, 계산식)

실측 단가(`ushistory-groundwork.md`): ① 실제 자료 DBQ 1건, 3라운드(자료 고정 → 생성 → 독립 풀이·채점 → 수정) **$1.89**($3.78/2, §10) ② MC 세트(3–4문항, 풀이 2모델 + 사실 점검) **$0.26**($1.79/7세트, §11) ③ p1b FRQ 생성 전 과정 **$5.32/18세트**(통과 10) = 통과 세트당 약 $0.53. 실측이 없는 SAQ 단가는 DBQ 의 40%(SAQ 는 문서 1–2개, 채점 3단계 샘플 동일)로 가정한 **추정**이다.

| 항목 | 계산식 | 예상 |
|---|---|---|
| SAQ2 신규 1차 자료(Mittelberger) | 0.40 × 1.89 | $0.76 |
| SAQ1 신규 2차 자료 쌍 | 0.40 × 1.89 × 1.3(2자료) | $0.98 |
| SAQ3 Lange 정식화(풀이·채점 재확인만) | 0.40 × 1.89 × 0.4 | $0.30 |
| DBQ 7문서 재설계(자료 6건 신규) | 1.89 × 1.2 | $2.27 |
| LEQ 사실 점검·루브릭 재검증 | 0.40 × 1.89 × 0.7 | $0.53 |
| **FRQ 소계** | | **$4.84**, 재시도 여유 +45% → **상한 제안 $7** |
| MC 14세트 중 실제 전환 | 14 × 0.26 ~ 14 × 0.45(신규 자료 비중 큰 세트) | $3.6–6.3, **상한 제안 $6** |

합계 **상한 제안 $13**(FRQ $7 + MC $6, 한 번에 소진해도 장부 $504 → $517, 중단선 $640 여유 내). 오너 승인 전이므로 지금은 집행하지 않는다. 이전 단계의 한도 관행(브랜치당 한도 두고 전후 장부 확인)을 그대로 쓴다. 비용에는 자료 다운로드·추출(코드, $0)과 화면 증거(격리 스택, $0)는 포함하지 않는다.

## 5. 질문·참고답·루브릭 재검증 계획과 코드 변경

원칙: 자료를 바꾸면 그 자료에 의존하는 질문·허용 답안·참고답·루브릭·3단계 샘플 전체를 **그 자료에서 다시 설계**한다. 구 참고답을 새 자료 위에 두거나 숫자·문구만 치환하지 않는다.

1. SAQ1·SAQ2·SAQ3: 새 자료 발췌에서 부분 A(식별/해석)를 처음부터 작성, B·C 의 외부 증거 허용 답안은 사실 점검 후 필요 시 수정. 루브릭 행·`expected_features`·3단계 샘플(high/mid/low)·**독립 채점기 2모델(Opus·Sonnet) 총점이 의도(3/2/1)와 일치**하는지 재확인(Stage A·B 와 동일 절차).
2. DBQ: 7문서 확정 → 논지 공간·`evidence_map`·`doc_uses`(문서별 출처 분석)·참고답·샘플 재설계. 프롬프트(냉전 국내 대응, 1945–1963)는 새 문서가 뒷받침하는지 보고 필요하면 수정(오너 결정 아님, 개발자 판단).
3. LEQ: 프롬프트·참고답을 Fable 사실 점검, 표지(`provenance`)를 "prompt only"로 정정.
4. 공통: 블라인드 풀이·사실 점검 모델은 이전 단계와 동일(Opus·Sonnet·Fable), 화면 증거(390×844·1280×800, 격리 스택), '역사 교사 검수 아님' 한계 기록.

**코드 변경 필요**:
- `realFrqViolations`는 현재 **SAQ 표**(레지스트리와 같은지·ALTON 표지 금지)와 DBQ(`realDbqPassage`)만 점검한다. SAQ1·SAQ2 의 텍스트 자료(레지스트리 발췌와 글자 일치), SAQ3 의 이미지, LEQ 표지 정정 게이트가 필요하다(`ush-real-verify.ts` 확장).
- 새 빌드·콘텐츠 스크립트(`ush-real-f-build.ts`·`ush-real-f-content.ts`·`ush-real-f-sources.py`, Stage B 복제), 새 배치 `ush-real-f`(`lib/ap-admin/batches.ts`), 새 레지스트리 항목.
- `exact-assign-ushistory-us3.json` 의 `frqA` 5키를 새 키로 교체하고 독립 검증기(`ush-assign.ts`, 구성 규칙: SAQ 시대 서로 다름·FRQ 5)·`ush-assign.test.ts` 로 재검증. SAQ1 시대를 바꾸면 이 검증이 필수.
- `batches.ts` 의 US3 주석(r19-f/f4 가 ALTON 작성)을 새 상태로 갱신. 기존 r19-f/f4 키는 삭제하지 않고 'ALTON 작성(예시)' 표지로 보존(정책).

## 6. US3 MC 현황과 실제 출처 정책 적합성

`exact-assign-ushistory-us3.json` mcA 15세트: **실제 출처 1세트**(`ush-real-e:real_e_harriot`, Harriot 1588) / **ALTON 작성 14세트**(p1a·p2a·p3a 재고, 전부 "ALTON-composed stimulus", 가상 저자·가상 저서·가상 표). 비율 **실제 1 : 합성 14 (6.7% 실제)**. 이용 가능 여부: 배정은 독립 검증기 위반 0이고 DB 적재 가능하지만, **정책 적합성은 낮다**.

| 세트 | 단원 | 유형 | 현재 | 전환 시 필요한 실제 자료(후보, 모두 UNVERIFIED) |
|---|---|---|---|---|
| u201 | 2.7 | 2차 | Great Awakening 2차(가상 역사가) | 연방 자료로는 어려움 → 1차로 유형 변경(Edwards *Sinners in the Hands*, 1741, PD) 또는 Whitefield 일기 |
| u309 | 3.6 | 1차 | NJ 점진적 해방 청원(가상) | New Jersey 1804 gradual abolition act 또는 Pennsylvania 1780 act(법률, PD) |
| u310 | 3.5 | 2차 | 독립전쟁 향촌(가상 역사가) | 1차로 변경: Common Sense 1776, 독립선언 비판문 |
| u420 | 4.13 | 1차 | 남서부 면화 농장주 편지(가상) | Solomon Northup 1853 또는 Frederick Law Olmsted 1850s 기행(1929 이전) |
| u422 | 4.11 | 짝지은 2차 | 서부 뉴욕 부흥·개혁(가상 역사가 둘) | Finney 회고(1876), Seneca Falls Declaration 1848 |
| u529 | 5.10 | 2차 | Freedmen's Bureau·Black Codes(가상) | Freedmen's Bureau Act 1865, Mississippi Black Codes 1865(법) |
| u509 | 5.10 | 2차 | 정착 표·정치(가상) | 1868 Fourteenth Amendment 또는 Reconstruction Acts(법률) |
| u634 | 6.11 | 1차 | Farmers' Alliance 연설(가상) | Omaha Platform 1892(PD) |
| u612 | 6.8 | 표 | Port Kessling 항구 표(가상) | Census 도시 인구 표(WP 27 등, 연방 통계) 또는 Jacob Riis 사진 |
| u742 | 7.8 | 1차 | Dayton 재판 투고(가상) | Scopes 재판 발췌(1925, PD 여부 확인), Tennessee Butler Act 1925(법률) |
| u718 | 7.12 | 표 | 조선소 노동력(가상) | WWII 징집·여성 취업 연방 통계(BLS·Census), WPB 포스터(연방) |
| u849 | 8.2 | 2차 | 원조 2차(가상) | **기존 `txt-truman-1947`**(1차로 변경) 또는 Marshall Plan 연설 1947 |
| u851 | 8.6 | 2차 | GI Bill 주택(가상) | Servicemen's Readjustment Act 1944(법률) 또는 `stat-homeownership-1900-1980`(US1 SAQ3 사용 → 반복) |
| u960 | 9.3 | 1차 | 걸프전 공청회 발언(가상) | 1991 대통령 연설·의회 결의안(정부 저작물) |

필요 전환량: **14세트 전부**(기존 확보 자료로 바로 가능한 것은 Truman→u849 1세트, 여유 자료 `tordesillas`는 시대 1 이라 배정 칸 없음). 단 유형 변경(2차 → 1차)은 시험의 자료 유형 최소 규칙(짝지은≥1·정량≥1·1차≥5·2차≥2, `ush-assign.ts`)을 다시 만족해야 한다. 참고: US1·US2 의 MC 도 현재 합성 세트 약 21세트가 라벨 표기 상태로 게시되어 있다(감사 §1; Stage A·C·D 로 일부만 교체 및 공개 대기). 따라서 "US3 만 MC 전량 교체"는 US1·US2 와의 일관성 문제를 낳는다(오너 결정 필요).

## 7. 실행 단계(제안, 승인 전 집행 없음)

0. (비용 0) AP Central 로 2027 US History 구조 재확인(SAQ 개수·SAQ3 선택·DBQ 문서 요건), 후보 자료의 저장소 권리 문구 확인, 오너 결정 사항 확정.
1. (비용 0) 자료 고정: 후보 다운로드(허용 도메인), 코드로 발췌·해시, registry 기록. 확인 실패 자료는 폐기하고 대체.
2. SAQ3(Lange 정식화) → SAQ2 → LEQ 사실 점검 → DBQ → SAQ1 순(위험 낮은 순). 각 단계 소량(Message Batches 아님, 동기 호출) 실행 후 장부 전후 확인.
3. 독립 검증(풀이·채점·사실 점검), 화면 증거, 배치 `ush-real-f` 등록, `exact-assign` 교체와 검증기 재실행.
4. (MC 포함 시) MC 14세트를 같은 절차로 소량 단계 교체(Stage C·D 방식, 세트 단위 새 키).
5. 문서·CURRENT 갱신, 테스트(`ush-assign.test.ts`·신규 배치 테스트), 푸시. DB 적재·US3 새 시험 생성·공개는 별도 승인.

## 8. 오너 결정 필요 사항

1. **MC 범위**: (a) FRQ 만 교체하고 MC 는 US1·US2 와 동일하게 라벨 표기 합성을 유지, (b) US3 MC 14세트도 전부 실제 자료로 교체(약 $6, 단계 4 추가). 권장: 오너 지시(정책 완화 금지)에 맞춰 (b), 단 US1·US2 합성 MC 약 21세트 처리 방침을 함께 정한다.
2. **SAQ1 시대 변경 허용**: 시대 9 PD 2차 자료 부재 때문에, PD 역사가 쌍(Dunning 1907 vs Du Bois 1910 등)을 쓰려면 SAQ1 시대를 바꾸고 US3 SAQ 시대 구성을 재배정해야 한다. 권장: 허용.
3. **자료 반복**: US3 가 US1·US2 의 실제 자료(DBQ 문서, Census 표)를 다시 쓰는 것은 막는다(권장). 허용하면 확보 비용은 줄지만 시험 간 반복이 늘어난다.
4. **비용 상한**: FRQ $7(필수) + MC $6(결정 1에 따라) = $13 제안. 승인 전까지 집행 없음.
5. **LEQ**: 자료가 없으므로 사실 점검과 표지 정정만 하고 유지(권장) 할지, 프롬프트를 새로 쓸지.

## 9. UNVERIFIED·한계

- 2027 SAQ/LEQ 개정 구조와 'SAQ3 선택' 여부는 이번에 재조회하지 않았다(§3).
- 3·6절 후보 자료의 URL·권리 문구·판본은 확인하지 않은 후보이며 전부 확인 전에는 '확보'가 아니다.
- SAQ 단가는 실측이 없어 DBQ 비례 추정이다(§4). 사실 점검은 LLM 이며 역사 교사 검수가 아니다.
- 기존 r19-f/f4 키의 합성 자료는 삭제·표지 변경 없이 보존 구분하며, 새 키로 교체해도 이전 키는 재고에 남는다.
