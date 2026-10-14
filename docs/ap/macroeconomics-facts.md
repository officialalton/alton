# AP Macroeconomics 공식 사실 검증 (2026-10-14, 무료)

유료 호출·DB·키·생성 없음. 공개 College Board 자료(AP Macroeconomics CED V.1, ©2026)만 사용했고 문구는 짧은 요약만 쓴다(시험 문항·채점 문구 복제 없음). 샘플 문항의 장면·수치는 쓰지 않는다.

**출처**
- [CED] AP Macroeconomics Course and Exam Description (V.1, ©2026): https://apcentral.collegeboard.org/media/pdf/ap-macroeconomics-course-and-exam-description.pdf — 공개 PDF 를 로컬에서 `pdftotext -layout` 으로 추출해 대조(2026-10-14). 쪽 번호는 CED 인쇄 쪽("Exam Information V.1 | n", "Course Framework V.1 | n").
- [data] `data/ap/curriculum-2027/ap_macroeconomics.json`(repo 전사본: 단원·토픽·스킬 코드·가중) — 아래 §1 항목과 대조해 일치 확인.

## 1. 검증된 사실

| 항목 | 확인 결과 | 출처 |
|---|---|---|
| 시험 총 길이 | **2시간 10분**: MC 60문항·70분·66.65% + FRQ 3문항·60분(읽기 10분 포함)·33.35% | CED p.129 |
| MC 선택지 | **5지선다(A–E)** — 샘플 MC 15개 전부 A–E. `layouts.ts`·`OPTION_COUNT` 5 와 일치 | CED p.134–138 |
| MC 공유 자료 | 샘플 15문항 모두 **단독 문항**(그래프는 문항 하나에 딸린다). 공유 그래프 세트 없음 → 우리 구성도 단독 문항만 쓴다 | CED p.134–138 |
| FRQ | **3문항**: 긴 문항 1개(**10점**) + 짧은 문항 2개(각 **5점**) = **20점** | CED p.129 |
| FRQ 문항별 시간 | **공식 미공표**(60분 중 10분은 읽기). 내부 추정: 쓰기 50분 / 20점 = 점당 2.5분 → 긴 약 25분, 짧은 약 12.5분. `MICRO_PROFILE`(긴 10·짧은 5점)을 그대로 쓴다 | CED p.129 |
| FRQ 샘플 형태 | 긴 문항: AD–AS 그래프(Y1·PL1·YF) → 장기 조정 → 통화정책(지급준비금이 충분한 경제) → 채권 가격·실질 GDP·자본 유입 → 외환시장 그래프 → 수출. 짧은 문항: 명목 GDP·디플레이터·인구 표 → 실질 GDP·인플레이션 계산 → 환율·생활수준·국가 부채 | CED p.138–140 |
| 단원 MC 가중 | U1 5–10 · U2 12–17 · U3 17–27 · U4 18–23 · U5 20–30 · U6 10–13 (%) | CED p.130, [data] 일치 |
| 스킬 범주 MC 가중 | 범주 1 **30–40%** · 범주 2 **25–32%** · 범주 3 **30–40%**; **범주 4(그래프 그리기)는 MC 에서 평가하지 않고** MC 는 그래프를 읽는 문항만 낸다 | CED p.131, [data] 일치 |
| 수치 분석(MC) | 범주 1·2·3 의 수치 스킬(1.C·2.C·3.C)이 **MC 의 16–20%** (Micro 의 20–30% 와 다르다) | CED p.131 |
| FRQ 과제 유형 비중(FRQ 점수 기준) | 단언(assertion) **10–20%**, 설명(explain) **25–35%**, 수치 분석 **10–25%**, 그래프·시각 표현(범주 4) **30–50%** (Micro 의 수치 15–30% 와 다르다) | CED p.132 |
| 스킬 코드 | 4 범주·13 코드: 1.A–1.D, 2.A–2.C, 3.A–3.C, 4.A–4.C | [data] |
| FRQ task verb | Identify · Explain · Calculate(풀이 과정 필수) · Draw a correctly labeled · Show/Label/Plot/Indicate(축·곡선 라벨과 이동 방향 필수) | CED p.133 |
| **계산기** | **사칙(four-function) 계산기가 두 섹션 모두에서 허용**(2022–23 학년도부터). 그래핑·공학용은 요구되지 않는다. Bluebook 내장 계산기 형태·Desmos 제공 여부는 **UNVERIFIED** | CED p.129 |
| **참조 자료** | CED 의 시험 안내에 **공식 제공 수식 시트·참조 시트 언급이 없다**(`formula` 검색 결과: 본문 문맥 1건, 시험 자료 언급 없음). → **ALTON 은 Reference 패널을 만들지 않는다**(Micro 와 달리 수식 요약 패널도 두지 않음: 없는 시트를 지어내지 않는다) | CED 전반 |
| 통화정책 설명 방식 | **지급준비금이 제한적인 경제**(통화승수·공개시장조작이 통화량을 바꾼다)와 **충분한 경제**(미국: 지급준비금 이자율 등 관리금리가 핵심 도구, 통화량 변화는 금리를 효과적으로 바꾸지 못한다)를 구분해 가르친다. 화폐시장·준비금시장·AD–AS 모형 중 어느 것으로도 설명할 수 있다 | CED p.82–83(POL-1.D.2–D.9) |
| 전달 방식 | 하이브리드(MC Bluebook, FRQ 답은 종이). `lib/ap-exam/frq-delivery.ts` `ap_macroeconomics: "paper"` 와 일치. AP Central 시험 페이지로의 재확인은 Micro 문서의 확인을 따랐다(별도 조회 안 함) → **UNVERIFIED(Macro 페이지)** | frq-delivery.ts |
| 내용 범위 | 6단원 · 토픽 42개(`ap_macroeconomics.json`). 미시 기업 이론·계량·수식 미적분은 범위 밖 | CED 단원 표, [data] |

## 2. repo 와의 대조 — 불일치·정정 목록

| # | 위치 | 내용 | 조치 |
|---|---|---|---|
| 1 | `lib/ap-exam/layouts.ts` `ap_macroeconomics` | MC 60·70분·**5지선다**·FRQ 3·60분·`allowed` — **공식과 일치** | 변경 없음 |
| 2 | `lib/ap-generation/gates.ts` | `NOT_ASSESSED_MC` 에 `ap_macroeconomics` 없음, `OPTION_COUNT` 5 없음, FRQ 프로필(긴 10 / 짧은 5, 점당 2.5분)·시간 상한이 Micro 만 | Macro 를 같은 표에 추가(NOT_ASSESSED 4.A–4.C, 5지선다, `MICRO_PROFILE` 공용, 시간 상한 32분) |
| 3 | `lib/exam-tools/subject-tools.ts` | `ap_macroeconomics` 항목이 없었다(기본 Desmos 탭) | 사칙 계산기만 제공(`calculatorTabs: ["basic"]`, `reference: null`) |
| 4 | `lib/ap-admin/assemble-draft.ts` | `SET_PREFIX_SUBJECT` 에 `MA` 없음 | `MA` → `ap_macroeconomics` 추가, `SET_ID_RE`·`service.ts` 저장 가능 정규식·`full-set-rules.ts` 단원 범위 |
| 5 | `lib/ap-figures/gate.ts` | 그래프 렌더 유형이 `ap_microeconomics` 만 `ap_graph:econ_curves` | Macro 도 같은 곡선 그림(AD–AS·화폐·대부자금·외환·필립스·PPC) |

## 3. 남은 UNVERIFIED
1. Bluebook 내장 계산기 형태(Desmos 제공 여부). 앱은 사칙 계산기를 제공한다.
2. 공식 수식 시트 존재 여부(CED 에 언급 없음 → 없다고 가정하지만 확정 아님). 그래서 Reference 패널을 두지 않는다.
3. FRQ 문항별 시간(내부 추정).
4. AP Central Macro 시험 페이지의 전달 방식(하이브리드) 직접 재확인.
5. FRQ 답안을 **앱에서 어떻게 받을지**는 제품 결정(실제 시험은 종이 손글씨·그래프 그리기; 현재 구현은 타이핑·Handwrite 둘 다 허용).
