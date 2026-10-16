# AP English Language and Composition — 공식 사실 검증 (2026-10-14, 무료)

유료 호출·DB·키·생성 없음. 공개 AP Central 페이지만 사용, 문구는 요약(복제 없음).

**출처**
- [exam] https://apcentral.collegeboard.org/courses/ap-english-language-and-composition/exam (2026-10-14 조회)
- [course] https://apcentral.collegeboard.org/courses/ap-english-language-and-composition (2026-10-14 조회)
- [cr25] 2025 Chief Reader 보고서: https://apcentral.collegeboard.org/media/pdf/ap25-cr-report-english-language-set-1.pdf / `-set-2.pdf` (Q1 만점 6 확인, 소스 6개·3개 이상 사용 요구 확인)
- [data] `data/ap/curriculum-2027/ap_english_language.json` (CED ©2024 전사: 스킬 1.A–8.C, 단원 1–9, MC 스킬 범주 비중)

## 1. 검증된 사실

| 항목 | 확인 결과 | 출처 |
|---|---|---|
| 전달 방식 | **완전 디지털(Bluebook)**, 시간이 끝나면 자동 제출. → `frq-delivery.ts` `ap_english_language: "digital"` 과 **일치**(에세이 타이핑) | [exam] |
| MC | **45문항·60분·45%**. 두 묶음: **읽기·분석 23–25문항**(논픽션 지문), **글쓰기(수정) 20–22문항**(작가 관점에서 stimulus 텍스트를 고치는 문항) | [exam] |
| FRQ | **3 에세이·2시간 15분(읽기 15분 포함)·55%** | [exam] |
| FRQ 유형 | 종합(synthesis): 소스 **6개**(시각·정량 자료 포함), 3개 이상 사용해 논지 전개 / 수사 분석(rhetorical analysis): 작가의 표현 선택이 의미·목적에 미치는 영향 / 논증(argument): 주어진 주제에 근거 기반 논증 | [exam], [cr25] |
| 채점 | 에세이당 **6점**. 공개 루브릭 구조는 논지 0–1 · 증거와 해설 0–4 · 정교함(sophistication) 0–1(공식 SG PDF 문구는 이번에 직접 대조하지 못함 → **VERIFY**, 제3자 요약과 일치) | [cr25] 만점 6 / 구조는 UNVERIFIED |
| 계산기 | 페이지에 언급 없음(해당 없음). 앱은 계산기 끔 | [exam] |
| 스킬 범주(8) | 쌍 4개 × 읽기/쓰기: Rhetorical Situation · Claims and Evidence · Reasoning and Organization · Style. **MC 비중: 읽기 범주 각 11–16%, 쓰기 범주 각 11–14%**. 코드 `1.A–8.C`(22개), 범주별 비중은 [data] `weights`(RS-R 11–14, RS-W 11–14, CE-R 13–16, CE-W 11–14, RO-R 13–16, RO-W 11–14, S-R 11–14, S-W 11–14) | [course], [data] |
| 단원 | 9개, 각 약 15차시. **단원별 가중 미공표**(스킬만 가중) → "단원 가중 정확 충족" 제약은 없고 스킬 범주 비중만 조립 제약. 단원 제목·토픽은 ALTON 라벨 | [course], [data] |
| 2027 변경 | 페이지에 기재된 변경 없음, 시험일 2027-05-12(수) Session 1, 유형·배점은 해마다 일정 | [exam] |

## 2. UNVERIFIED / 열린 항목
1. 루브릭 3행의 공식 문구·성취 수준 설명(공식 SG PDF 직접 대조 필요 — 무료, 다음 단계에서 수행).
2. ~~MC 지문 개수·지문당 문항 수~~ **2026-10-15 해소**: CED(Exam Information, p.108)에 MC는 5묶음 — 읽기 2묶음(각 11–14문항), 글쓰기 3묶음(7–9 / 7–9 / 4–6문항). 지문 길이·글쓰기 지문이 학생 초안인지는 여전히 공식 미기재. 상세: `englang-structure-audit.md`.
3. 읽기 15분 동안 FRQ 화면 동작(소스만 열람·타이핑 제한 여부), 에세이 길이 제한 — 공식 미기재. 앱 정책은 §4 제안.
4. 종합 소스의 시각·정량 자료 개수 상세(공식: "시각·정량 포함" 까지).
5. 계산기 정책 문장 없음(해당 없음으로 처리).
