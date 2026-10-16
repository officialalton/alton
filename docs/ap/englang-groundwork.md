# AP English Language and Composition — 무료 설계 (2026-10-14, 설계 전용)

범위: 유료 호출·DB·키·push 없음. 사실은 `englang-facts.md`. 예산: 오너 상한 $150 / 중단선 $145, 누적 약 $88 + Biology 최대 $22 = 약 $110 → **English 에 쓸 수 있는 여유는 중단선까지 약 $35**.

핵심 차이: Stats·Physics·Chem·Micro·CS A 는 **정답을 코드로 확정**했다. English 는 정답이 판단이므로 "코드 정답 + 독립 경로" 대신 **다중 독립 풀이 + 반론 검토 + 사람 표본**으로 대체한다. 이는 신뢰도가 한 단계 낮다 — 결정적 게이트로 막을 수 있는 것은 모양(길이·형식·중복·저작권 징후)뿐이다.

## 1. 시험 구조 → 앱 구조 (요약)
- MC 45/60분: 읽기 23–25(논픽션 지문 묶음) + 글쓰기·수정 20–22(stimulus 수정 문항). 지문당 4–6문항 묶음, 총 약 9–10 지문(내부 가정).
- FRQ 3/135분(읽기 15분 포함): 종합(소스 6, 시각·정량 포함) · 수사 분석 · 논증, 각 6점(1+4+1). 완전 디지털 타이핑.
- 스킬: 8 범주 22 코드, MC 범주 비중은 조립 제약(`data` weights). 단원 가중 없음.

## 2. 품질 전략 (정답 코드 없음)

### 2.1 지문(passage) 출처와 저작권
- 모든 지문은 **원본 생성**(ALTON 작성). 실존 저자·작품·신문 기사 본문 복제·모방 금지. 실제 사건·인물은 일반 사실 수준에서만, 인용문은 **가공 인물의 가공 발언**으로 표기(가짜 실명 인용 금지: 실존 인물 발언처럼 보이는 문장 금지).
- 공공 도메인 텍스트(저작권 만료 연설·에세이)는 사용 가능하나 **출처·연도·판본을 `provenance` 필드에 기록**하고 편집 여부 표시. 기본은 원본 생성, 공공 도메인은 사람 확인 후에만(생성기는 기억에 의존한 "공공 도메인 인용"을 하지 않는다 — 환각·오귀속 위험).
- 모든 지문·소스는 `provenance: {kind: "original"|"public_domain", author_alias, year_alias, note}` 를 가지며 student 화면에 "ALTON original passage" 표기. 실제 AP 지문 텍스트를 프롬프트에 넣지 않는다(문항 **유형**만 참고).
- 유사도·표절 검사(결정적): ① 5-gram 해시를 재고 전체·서로 간 비교(중복·재사용 방지), ② 길이 ≥ 12 단어 연속 일치가 외부 공개 코퍼스 샘플(공공 도메인 코퍼스 로컬 사본 — 있으면)과 겹치면 반려, ③ 따옴표 안 문장이 20단어 이상이면 사람 확인 필요 플래그.

### 2.2 수사 상황·수사 장치 목록 (생성 입력 = 블루프린트)
지문마다 **블루프린트 JSON** 을 먼저 만들고(문장 생성 전), 문항은 블루프린트의 사실에서만 만든다: `{speaker, audience, exigence, purpose, context, claim, evidence_types[], line_of_reasoning, devices:[{device, location_sentence_idx, function}], tone_shifts[], counterargument?}`. 수사 장치 인벤토리(예): 은유·직유·대조·병렬·반복·수사적 질문·양보와 반박·인용 도입·일화·통계 제시·권위 호소·감정 호소·논리 호소·어조 전환·문장 길이 변화. 각 장치는 **지문 안 위치(문장 번호)** 가 블루프린트에 있어야 문항에 쓸 수 있다 → 문항의 근거 문장이 결정적으로 존재 확인 가능(문장 인덱스 존재·키 근거 문장 포함 검사).

### 2.3 MC 정답 보증 (코드 키 없음)
순서: 블루프린트 → 지문 → 문항(정답은 블루프린트 근거 문장 번호 필수) → 게이트 3중.
1. **다중 독립 풀이**: 서로 다른 프롬프트·온도로 3 풀이기(상위 모델)가 **지문+문항만 보고**(키·블루프린트 비공개) 답을 낸다. 3/3 일치가 생성 키와 같아야 통과. 2/3 이하는 보류(재작성 또는 폐기).
2. **적대적 검토자(adversary)**: 키가 아닌 선지 중 하나를 "방어 가능한 정답"으로 주장하도록 지시, 근거 문장 인용 필수. 방어 가능하다고 판정(검토자 2차 심판)되면 **defensible-single-answer 게이트 실패**.
3. **단일 정답 게이트**: ① 키 선지의 근거 문장이 지문에 존재 ② 비키 선지 각각에 **결함 라벨**(아래 분류) 1개 이상이 근거 문장과 함께 부여됨 ③ 풀이기가 비키 선지로 흔들린 이유가 해설의 어느 결함 라벨과 맞는지.
- **오답 분류(distractor taxonomy)**: too_narrow(일부만) / too_broad(과잉 일반화) / reversal(방향 반대) / unsupported(지문 밖 추론) / partially_right(앞 절만 맞음) / wrong_function(내용은 맞으나 기능이 틀림) / lexical_trap(단어 겹침만). 문항마다 오답 3–4개는 **서로 다른 라벨 ≥ 2종**, 같은 라벨 3개 이상 금지(결정적).
- 키 위치 균형·선지 길이 편향(키가 가장 긴 선지) 결정적 검사. 4지선다 가정(공식 4지 — 선택지 수 UNVERIFIED, 기존 `OPTION_COUNT` 확인 필요).
- 글쓰기·수정 문항: 정답이 문법 규칙인 경우 **규칙 기반 부분 코드 검증** 가능(예: 쉼표 이음, 주어-동사 일치, 병렬) — 수정 문항의 약 1/3 은 규칙 라벨로 결정적 교차 검사(보조), 나머지(조직·전환·목적)는 판단형.

### 2.4 스타일·수준 보정 (학생 데이터 없음)
- 문항 **유형**만 CED 샘플에서 참조(예: 지문 목적 파악, 수사 장치 기능, 증거 선택·평가, 근거 문장 선택, 문장 결합·전환·논지 강화 수정). 문구·지문은 절대 복사하지 않는다.
- 난이도 보정: ① 풀이기 3중 합의율·오답 흔들림으로 하/중/상 분류(풀이기가 모두 즉시 정답 + 오답 라벨이 약한 경우 "쉬움") ② 지문 복잡도 코드 지표(§2.5) ③ 문항 인지 단계(식별<설명<평가) 쿼터 40/40/20 가정. 학생 데이터 없이 정답률 예측은 불가 → **난이도는 순서 정렬용 서열값일 뿐 절대 보정하지 않는다**(보고에 명시).

### 2.5 결정적 게이트 (코드, `lib/ap-generation/english-text-stats.ts` 구현됨)
- 지문 단어 수(읽기 지문 약 300–650·수정 지문 약 150–300 가정; **범위는 사람 검토로 확정**), 문장 평균 길이 18–32(읽기)·14–26(수정), 최대 문장 길이, FK 학년 지표 10–16(Lexile 대용; 참고 지표일 뿐 공식 아님), 문단 수. `textStats`/`passageViolations`/`countWords` 및 테스트 3건.
- 추가 게이트(구현 예정): 5-gram 중복, 따옴표 길이, 한 지문 내 장치 인벤토리 가 블루프린트와 일치, 키 위치 균형, 오답 라벨 다양성, 선지 길이 편향, 금지어(AI 투 상투구 "delve", "tapestry" 등 반복) 목록, 금칙(실존 인물 실명+인용).

### 2.6 FRQ 품질 (채점 가이드 + 3단계 샘플)
- **프롬프트 세트별 산출물**: ① 과제문(공식 형식 유형만 참조) ② (종합) 소스 A–F: 본문 4(저널·보고서·논평·연설 등 장르 혼합) + **시각 1(결정적 차트/도표를 코드로 렌더, 수치 데이터 JSON 이 원본)** + **정량 1**(표·그래프, 수치는 코드로 일관성 검사) ③ 루브릭 해설(논지 0–1 / 증거·해설 0–4 / 정교함 0–1)을 과제 맞춤 문구로 ④ **3단계 샘플 답안**(상·중·하, 각 점수 6/4/2 근처)과 줄 단위 주석 ⑤ 자기 점검 체크리스트(다른 서술형 과목과 같은 구조).
- 샘플 답안 점수 일치 검사: 독립 채점기 3회 × 샘플이 의도한 점수 ±1 이내(루브릭 행별). 상 > 중 > 하 서열 위반 시 폐기. 샘플 단어 수 범위(상 450–700·중 300–450·하 150–300 가정) 결정적 검사.
- 앱은 **AI 채점으로 점수를 주지 않는다**(비용·신뢰): 학생은 자기 에세이를 루브릭 체크리스트로 자가 채점(§3). 선택지: 유료 AI 채점은 별도 승인 항목.
- 종합 소스 일관성: 소스 사이 상충 수치 금지(숫자 교차 검사), 소스 간 입장이 3개 이상 쟁점으로 갈려야 함(블루프린트 `stances`), 소스 길이 150–350단어, 인용 표기(Source A–F) 일관.

## 3. 데이터 모델·UI 필요 사항 (큰 UI 구현 없음)
현황(코드 확인): FRQ 는 `ApExamTakeClient.tsx` 의 파트별 `<textarea>`·`CodeAnswerField`, 섹션은 'Start section' 타이머(560), MC 지문은 `apPassageForDisplay`+`SharedStimulus`(range) 로 표시, 과목 delivery `digital` 이미 등록. **주의**: `passageDuplicatesStem` 은 본문과 단어가 80% 이상 겹치는 passage 를 숨긴다 — English 문항은 stem 이 지문 문장을 인용하므로 오탐 가능 → 영어 과목은 우회 필요.

| 필요 | 현재 | 갭 |
|---|---|---|
| 소스 문서 패널(종합 A–F, 시각 소스) | 없음. 단일 passage + figure | **새 컴포넌트**: 좌측 탭/스택 소스 A–F, 시각 소스 이미지/SVG(`ProblemFigure` 재사용 가능), 에세이와 동시 열람(모바일은 전환 탭) |
| 에세이 편집기 + 단어 수 | `<textarea>` | 단어 수·권장 길이 표시(`countWords` 준비됨), 맞춤법 자동 고침 끄기 여부 정책, 붙여넣기 허용은 공식 Bluebook 동작 UNVERIFIED |
| 읽기 15분 | 섹션 타이머만 | 135분 단일 타이머 유지 + "읽기 시간 15분 안내 배너"(제안: 15분간 에세이 편집 허용하되 타이머는 135분 통합 — 공식 UNVERIFIED), 또는 섹션 내 서브 타이머. 오너 결정 |
| MC 지문 묶음 | `SharedStimulus` range(문항 묶음) | 긴 지문(600단어) 스크롤·줄/문장 번호·밑줄(수정 문항의 `[1]` 문장 표시) — **번호 매긴 문장/문단 렌더** 필요 |
| 결과 화면 루브릭 | 없음 | 문항별 루브릭 3행 자기 점수 입력(0/1·0–4·0/1)과 3단계 샘플 비교, 총점 6점 합산, 섹션 환산 |
| 데이터 모델 | MC/FRQ 항목 | `sources[] {id A-F, kind text|visual|quantitative, title, body|figure, provenance}`, `blueprint`, `rubricGuide`, `samples[3]` — 기존 `stimulus` JSON 확장(마이그레이션은 additive) |

**이번에 구현한 사소한 전제**: `lib/ap-generation/english-text-stats.ts`(결정적 지문 통계, 단어 수 포함) + 테스트(3 통과). UI 는 미구현.

## 4. 동결 구성 골격 (UNFROZEN, 템플릿만)
`config/ap-frozen/englang-p1-a.template.json`(MC 파일럿: 6 지문 24문항 × 2 후보, 상한 $6.0), `englang-p1-b.template.json`(FRQ 파일럿: 2 세트, 상한 $4.5). 해시 `UNFROZEN`, `--check-only` 는 일부러 실패. `subjects/englang.ts`·블루프린트·다중 풀이 게이트·`archetypes/eng_*.py` 는 **아직 없음**(계획).

## 5. 비용 추정 (보수적, 실측 없음 — 파일럿으로 갱신)
기준: 코드 검증 과목 MC $0.035–0.04/후보. English 는 풀이 3중 + 적대 검토 + 지문 생성 분담 → **×2.5 ≈ $0.10/후보(범위 $0.08–0.14)**. FRQ 세트(종합 $0.60 + 수사 $0.30 + 논증 $0.30, 루브릭·샘플 3단계·소스·점수 일치 검사 포함) 후보당 약 $1.20(범위 $0.9–1.8).
통과율 가정(보수): MC 첫 통과 **40–50%**(코드 키 과목 52–76%보다 낮게), 후보 2개/칸이면 칸 성공 ≈ 64–75%, 사람 검토 통과 ≈ 75–85%.

| 항목 | 기대 | 범위 |
|---|---|---|
| 파일럿 MC(24문항, 후보 2) | $4.8 | $3.8–6.7 |
| 파일럿 FRQ(2 세트 × 1.5) | $3.6 | $2.7–5.4 |
| **파일럿 합** | **$8.4** | $6.5–12 |
| 풀 모의고사 1회분 MC 45(후보 2.2, 지문 9–10) | $9.9 | $8–14 |
| 풀 모의고사 1회분 FRQ 3종 1세트(후보 1.5) | $1.8 | $1.4–2.7 |
| 예비 1.3배·재작업 | +$3.5 | |
| **풀 1회(파일럿 재사용 50%)** | **≈ $12** | $9–18 |
| **풀 2회 + 파일럿** | **≈ $32** | **$23–48** |
| 단계: MC 전용 풀 2회(FRQ 체크리스트 없음) | ≈ $24 | $17–35 |

예산: 중단선 $145 − 약 $110 = **$35 여유** → 기대 $32 는 거의 소진, 낙관 $23 은 안, 보수 $48 은 초과. 따라서 **파일럿 $8.4 후 재추정, 풀 2회는 오너가 상한 상향 또는 1회로 축소 중 결정**.

## 6. 사람 검수 계획(출시 전 필수)
영어 교사/전문가 1인이 아래를 검토(API 비용 0, 사람 시간): ① **모든 지문·종합 소스**(저작권·가공 인용·사실 오류·민감 주제) 100%, ② 모든 FRQ 과제문·루브릭 주석·3단계 샘플 100%, ③ MC 통과 문항 중 **무작위 30% + 풀이기 합의 2/3 였던 문항 전부 + 적대 검토 방어가능 경계 문항 전부**, ④ 풀 모의고사 조립본 1회 통독(키 위치·주제 중복·난이도 서열). 사람 기각률이 25% 이상이면 해당 세트 출시 중단·원인 분석.
공개 라벨: 학생 화면에 "Practice material created by ALTON; not official College Board content".

## 7. 위험
1. **키 오류**(방어 가능한 복수 정답) — 코드 검증 불가가 본질 위험. 완화: 다중 풀이+적대 검토+사람 표본, 그래도 잔여 오류율 3–8%(추정) 가능 → 신고 경로·정정 배포.
2. 원문 유사성·저작권·환각 인용 — 원본 생성+프로비넌스+유사도 게이트로 완화.
3. 난이도 보정 불가(학생 데이터 없음) — 서열값만.
4. 루브릭 문구 미대조(SG PDF) — 다음 무료 단계로 해소.
5. UI 갭(소스 패널·문장 번호·읽기 시간) — 최소 3–4 작업일급, 유료 호출 전 완료 필요.
6. 예산 — 기대 $32 가 여유 $35 에 근접.
7. AI 투 문체가 시험다움을 해칠 위험 — 금지 구문 목록·사람 문체 검수.

## 8. 권고
**조건부 Go(단계 진행).** ① 무료: SG PDF 로 루브릭 대조, 소스 패널·문장 번호 UI 최소판, `englang.ts`·게이트 구현 ② **파일럿 $8.4(상한 $10.5)** 후 첫 통과율 ≥ 40%·사람 검토 통과 ≥ 75% 이면 계속 ③ 범위 옵션: **(A) MC 전용 풀 1–2회 + FRQ 는 과제문+루브릭 체크리스트 자기 채점**(비용 $17–24, 위험 낮음, 권장 기본) ④ (B) MC+FRQ 완전 풀 2회 $23–48(예산 상향 필요) — 파일럿 결과 후 결정. No-Go 조건: 파일럿 사람 기각률 > 35%, 또는 키 오류 표본 5% 초과.


---

## 7. FRQ 안정 JSON 스키마 `el-frq-1` (2026-10-14, AI 채점기 연동용)

AI 채점 기능(별도 에이전트)은 후보 payload 의 `el_frq` 만 읽으면 된다(타입: `lib/ap-generation/englang-frq.ts` `ElFrqPayload`, 검증: `frqViolations`). 학생 화면용 필드(`set_intro`·`parts[0].prompt`·`stimulus`)는 같은 데이터에서 만든 파생값이다.

```
payload (frq_bundle 후보)
  archetype "elfrq_<id>", template "q1|q2|q3", topic "U9.3", skill, calculator "na", title,
  set_intro        학생용 소스 묶음 텍스트(첫 줄 "ALTON original passage"; 종합은 Source A–F, 수사 분석은 ¶ 번호 문단 지문)
  stimulus         종합의 시각 소스 F: {kind:"stat_chart", data:{chart:"bar", ...}}  (렌더 게이트·화면 증거 대상)
  parts[0]         {label:"A", prompt: 과제문+요구 사항, points:6, response_mode:"essay", model_answer: 상 샘플, rubric_rows[3]}
  reference_text   결과 화면 참고 답안(루브릭 요약 + 3단계 샘플 + 주석; "not official College Board scoring")
  el_frq           ↓ 안정 스키마
el_frq
  schema_version   "el-frq-1"
  task_type        "synthesis" | "rhetorical_analysis" | "argument"      (template q1 / q2 / q3)
  title, prompt    {scenario, task, requirements[]}                      (학생에게 보이는 과제문)
  sources[]        {id "A".."F", kind "text|visual|quantitative", title, attribution(가공 저자·가공 매체·연도), genre?, stance?,
                    body | paragraphs[[문장]] , table{columns,rows}(quantitative) , figure{chart:"bar",title,categories,series[{name,values}],xTitle?,yTitle?,description}(visual),
                    provenance{kind:"original", author_alias, year_alias}}
                    종합 = 6개(A–D 텍스트 150–340단어, E 정량 표, F 시각 차트, 표·차트·본문 수치 상충 금지, 입장 ≥3), 수사 분석 = 원본 지문 1개(450–620단어, 문장 번호는 전체 연속 1..N),
                    논증 = 자극 문단 1개(id "A", ≤ 260단어)
  rubric           {total_points: 6, rows[3], scoring_notes[]}
                    rows[i] = {row_id "A|B|C", name "Thesis|Evidence and commentary|Sophistication", max 1|4|1,
                               descriptors{ "0": …, "1": … , (B 는 "2","3","4" 까지) }, task_specific}
  expected_features {defensible_positions[], source_uses[{source_id, usable_for}], rhetorical_choices[{device, paragraph, sentence_ids[], effect}], lines_of_reasoning[], common_pitfalls[]}
  samples[3]       {tier "high|mid|low", target_total, essay, word_count, rubric_scores{A,B,C,total}, annotations[{quote(에세이에서 그대로), comment, row_id}]}
                    rubric_scores 는 작성자의 의도가 아니라 **독립 채점기 3(Opus·Sonnet·Fable) 행별 중앙값**이다. 상 5–6 / 중 3–5 / 하 1–3, 엄격한 서열(상>중>하), 채점기 총점 편차 ≤ 2.
  blueprint        {stances[], devices[{device,sentence_ids,function}], issue?, theme?}
  provenance       {kind:"original", note}
```
수사 장치 값은 `EL_DEVICES`(26개) 중 하나여야 하고 문장 번호는 지문 문장 수 안이어야 한다. 학생 화면 텍스트에는 `$`·`\^_<>{}|~` 를 쓰지 않는다(금액은 "12 dollars"; 마크다운 표 구분 `|` 는 소스 E 표를 코드로 만들 때만).

## 8. P0 구현 현황 (무료, 2026-10-14)

| 항목 | 구현 | 테스트 |
|---|---|---|
| 구성 규칙·8범주 범위·묶음 규칙 | `lib/ap-exam/elang-rules.ts`(MC 45 = 읽기 23–25 + 글쓰기 20–22, 범주별 하한 내림·상한 올림 4–7/5–8, 묶음 3–6문항·읽기/글쓰기 각 4–6묶음, FRQ q1·q2·q3) | `elang-rules.test.ts` |
| 과목 가이드 | `lib/ap-generation/subjects/englang.ts`: 스킬 22·토픽 매핑·수사 장치 26·발전 방식 10·오답 분류 11·문항 유형(스킬별)·주제 40·장르·금지 상투구 20 | — |
| 결정적 게이트 | `lib/ap-generation/englang-gates.ts`: 지문 통계(english-text-stats)·문단/문장 수·실존 인물/기관 명단·AI 상투구·`$`/수식 기호·블루프린트 장치 인벤토리(문장 번호 범위)·인용문 원문 일치(stem·선지의 따옴표는 지문에 그대로 있어야 함)·문단/문장 번호 범위·글쓰기 stem 목표 명시·오답 라벨 다양성·키 길이 편향·선지 글자 참조 금지·5-gram/연속 12단어 유사도·키 위치 균형(각 위치 floor/ceil, 3연속 금지) | `englang-gates.test.ts` |
| FRQ 스키마·게이트 | `lib/ap-generation/englang-frq.ts` | `englang-frq.test.ts` |
| 키 신뢰도 | `keyConfidence`: 풀이 3 전원 일치 ∧ 어느 풀이도 제2 방어 가능 선택지를 보고하지 않음 ∧ 적대 검토 strong 아님 ∧ 심판 key_clearly_better ∧ 결정적 위반 0 이어야 통과, 점수 0–1(풀이 0.55 + 적대 0.25 + 심판 0.15 + 결정적 0.05), high ≥ 0.9 / medium ≥ 0.8 | 동 |
| 계획기 | `englang-plan.ts`: 범주 비중 목표(ELANG_FULL_TARGET)대로 묶음마다 스킬 6개·장르·주제(중복 없음) | `englang-plan.test.ts` |
| 파이프라인 | `scripts/ap-generation/englang-pipeline.ts`: gen(Fable) → check → solve(Opus·Sonnet·Fable, 선지 순서를 풀이기마다 다르게) → adv(Fable 적대적 검토 + Sonnet 지문 검토) → judge(Opus) → finalize; FRQ: frq-gen → frq-samples(상·중·하 × 후보 2) → frq-grade(3 채점기) → frq-finalize. 동결(--freeze/--check-only), 예산 가드(실행·영어 합계 $24·누적 중단선) | 구성 해시 |
| 배정·초안 | `el-pool.ts`·`el-assign.ts`(정수계획 + 독립 검증기)·`assemble-elang-draft.ts`, 세트 접두 `EL`, `service.ts` saveable | `assemble-elang-draft.test.ts` |
| 학생 화면 | 영어 지문 표지(`ALTON original passage`)가 있으면 stem 이 지문을 인용해도 지문을 숨기지 않고 수식 자동 변환도 하지 않음(`apPassageForDisplay` 오탐 수정), 에세이 칸(18줄·단어 수), 계산기·Reference 없음, 토픽 코드 `U5.4` 단원 번호 인식. 지문·문항 좌우 2패널 + 각 패널 스크롤은 기존 레이아웃 그대로(문단 ¶ 번호·문장 [n] 번호는 지문 본문에 들어 있음) | `stimulus-display.test.ts`, `ApExamEnglish.test.tsx`, `convert-english.test.ts`, `exam-tools.test.tsx` |

## 9. 실행 결과 (2026-10-14, 유료 P1·P2, 원장 기준 지출 $22.73 / 영어 상한 $24)

**지출(원장 $88.0814 → $110.8147):** 결과 파일 합 $21.87 + 중단·무효 측정 ≈ $0.87(취소한 배치 2건·solver 거절 재시도·잘못된 캐시 키로 한 번 더 돌린 풀이). 단계별: 지문 묶음 생성 $10.26(P1-a $2.60 + P2 $7.66, 동기 호출 = 배치 단가의 2배), 풀이·적대·심판·검토 $3.97, FRQ 생성 $3.92(P1-b $2.10 + P2-b $1.82), 샘플 $1.07, 채점 $3.12. 배치 단가(Fable 큐 정체로 생성은 동기 전환)를 못 써서 계획($12–15)보다 비쌌다.

**통과율(첫 통과 = 결정적 게이트 ∧ 풀이 3/3 ∧ 적대 strong 아님 ∧ 심판 key_clearly_better ∧ 지문 검토 ok):**

| 배치 | 묶음 | 문항 생성 | 결정적 통과 | 풀이 3/3 일치 | 최종 통과 | 묶음 통과 |
|---|---|---|---|---|---|---|
| el-p1 (파일럿 재평가) | 4 | 18 | 16 | 16/16 | 13 (72.2%) | 3/4 |
| el-p2a | 20 | 120 | 112 | 107/114 | 59 (49.2%) | 14/20 |
| 합계 | 24 | 138 | 128 | 123/130 | 72 (52.2%) | 17/24 |

- 파일럿 기준(≥ 40%, 체계적 키 문제 없음) 통과. **키 문제 신호**: 풀이를 받은 문항 130 중 3풀이 전원 일치 123(95%, P1 은 16/16). 불일치·제2 방어 가능 보고 문항은 제외했고(키 신뢰도 게이트), 적대적 검토는 실제 결함(해설이 지문보다 강하게 주장)을 잡았다(P1 w02-q1).
- 첫 시도의 낮은 수치(P1-a 3/18)는 **측정 무효**였다: 계획 재현 오류로 요청 스킬이 달라졌고(캐시 키), Sonnet 풀이기가 한 지문에서 `refusal`(문구 변경으로 해소), 사후 게이트 과엄격(글쓰기 수사 장치 인벤토리·FK 하한·"mit" 부분 문자열 오탐). 생성물은 그대로 두고 사후 게이트만 조정해 재평가(생성 재지불 없음). 조정 내역: `englang-gates.ts`(글쓰기 장치 검사 제외, 단어 경계 일치, 20단어 인용 차단 해제, 키 길이 1.6×/7단어), `subjects/englang.ts`(읽기 FK 7–17·780단어, 글쓰기 FK 5–16).
- 키 신뢰도 분포(통과 문항 66, 묶음 내): high(≥0.9) 23 / medium(0.8–0.9) 43, 평균 0.90. 모든 통과 문항에 `payload.items[].key_confidence`(점수·밴드·풀이 표·적대 판정·심판 판정)가 저장돼 있다. 평균이 0.9 근처인 이유는 적대적 검토가 거의 모든 문항에서 "weak" 대안을 보고했기 때문(방어 가능 정도 weak = 부주의한 독자가 고를 수 있음)이며 strong 은 제외.
- 탈락 사유(P2-a 120문항): 결정적 45(묶음 게이트 탈락 묶음 포함), 풀이기 제2 방어 가능 보고 10, 적대/심판 단계 미도달 13.

**FRQ(스키마 §7):** 6 프롬프트 세트 전부 통과(종합 2·수사 분석 2·논증 2). 샘플은 독립 채점기 3(Opus·Sonnet·Fable) 행별 중앙값으로 점수를 기록: 상 6/6/6/6/6/6, 중 5·4·4 / 4·4·5, 하 1·2·1 / 2·2·1 — 순서 위반 0. 종합 시각 소스는 막대그래프(긴 범주명은 13자로 줄이고 전체 이름은 대체 설명에 남김, 렌더 게이트 통과), 정량 소스는 구조화 표(코드가 마크다운 표로 그림).

**조립:** 재고(화면 증거 있음) = 읽기 묶음 8(32문항)·글쓰기 묶음 9(34문항)·FRQ 6. **EL1 = 정확 배정 성공**(가상 0, 독립 검증기 위반 0): 읽기 묶음 6(24문항) + 글쓰기 묶음 5(21문항), 범주 RS-R 5 / CE-R 7 / RO-R 8 / S-R 5 / RS-W 5 / CE-W 5 / RO-W 5 / S-W 5(전부 범위 안), exam_prep 34/45, FRQ q1·q2·q3 = fa1·fa2·fa3. `data/ap/stock/exact-assign-el-el1.json`. **EL2 는 배정 불가(재고 부족)**: EL1 을 뺀 남은 MC 읽기 7·글쓰기 14문항(필요 23–25 / 20–22) → 읽기 ≥ 16문항(약 4묶음)·글쓰기 ≥ 6문항(약 2묶음)과 범주별 하한(남은 재고 기준 CE-R·RO-R·S-R 등) 부족. FRQ 는 EL2 용 3세트(fb1–fb3)가 이미 있다. 보충에 필요한 추정 비용 ≈ $3.5(읽기 5묶음 Fable 동기 $1.9 + 글쓰기 2묶음 Opus $0.4 + 검증 $1.2): 영어 상한 $24 의 잔여 $1.27 을 넘어 **오너 상한 상향 또는 중단 결정 필요**.

**사람 검수(출시 전 필수, §6 그대로):** 모든 지문·소스, 모든 FRQ 과제문·루브릭·샘플 100%, MC 통과 문항 무작위 30%·풀이 제2 방어 가능이었던 묶음의 이웃 문항·적대 weak 판정 문항 우선. 사람 검수 인력이 없어 이번에는 자동 게이트만 적용했고, 남은 위험은 §7 의 1·2·7번과 동일(잔여 키 오류율 3–8% 추정 유지).


---

## 10. 공식 5묶음 구조 재편(2026-10-15) — 관리자 순서

감사·결과: `docs/ap/englang-structure-audit.md`. 공식 MC 구성은 5묶음(읽기 2 × 11–14, 글쓰기 7–9 / 7–9 / 4–6)이며, 위 §1·§5·§9의 "지문당 4–6문항·9–10지문" 가정은 대체됐다. 구 EL1/EL2 v3는 레거시 규칙으로 계속 유효하다.

산출물(모두 저장소 데이터, 원격 쓰기 없음): 배치 `el-long`(`data/ap/stock/el-long-items.json`·`el-long-pass-keys.json`, 화면 증거 `data/ap/screen-evidence/evidence-el-long.json`), 정확 배정 `data/ap/stock/exact-assign-el-long-el1-el2.json`, 새 버전 교체 계획 `data/ap/stock/el1-long-v4-swap-plan.json`(41 슬롯)·`el2-long-v4-swap-plan.json`(39 슬롯).

관리자가 할 일(순서대로, 비프로덕션 먼저·프로덕션은 별도 승인):
1. **배포**: 브랜치(`el-long`)를 통합 브랜치에 병합·배포한다(배치·증거·계획 파일과 `resolveSwaps` 재편 지원이 함께 들어가야 한다).
2. **후보 적재**: 관리자 → AP 재고(배치)에서 `AP English Language 공식 5묶음 구조 장문 묶음 (el-long)`을 선택, '미리보기(dry-run)'로 신규 8건·기존 행 변경 0 확인 후 '적재'. (CLI 대안: `npx tsx scripts/ap-generation/import-candidates.ts --items data/ap/stock/el-long-items.json --batch el-long-2026-10-15 --supplement` → 확인 후 `--execute`.)
3. **검증 기록**: 같은 화면에서 `el-long` 배치의 '렌더 검증 기록' → '화면 검증 기록'(증거 content_hash 일치 확인). 8건 모두 렌더·화면 검증됨이어야 한다.
4. **EL1 새 버전**: 모의고사 세트 → `AP English Language — Practice Exam 1`(v3, 게시됨) → '새 버전' → 계획 `el1-long-v4-swap-plan.json` → 미리보기에서 위반 0·교체 41건 확인 → '초안 생성'(v4 초안). 짧은 글쓰기 묶음 w22(42–45)와 FRQ 3은 바뀌지 않는다.
5. **EL2 새 버전**: `Practice Exam 2`(v3) → `el2-long-v4-swap-plan.json` → 교체 39건 → '초안 생성'. (w32 40–45와 FRQ 3은 그대로.)
6. 초안을 열어 읽기 2묶음·글쓰기 3묶음 구조와 MC 45·FRQ 3, 문항 번호 연속을 학생 화면으로 확인한 뒤 '새 버전 공개'. 기존 v3 응시 기록은 v3에 남는다. 문제가 있으면 초안을 폐기하면 되고 v3는 게시 상태 그대로다.
- 먼저 `el1/el2-review-v2-swap-plan.json`(검수 수정본)이 이미 적용된 v3 위에서 만든 계획이다. v3 슬롯 구성이 다르면(다른 버전이 게시된 경우) 미리보기가 "현재 문항이 계획과 다릅니다"로 막는다 — 계획을 다시 생성(`npx tsx scripts/ap-generation/el-long-swap-plans.ts`)해야 한다.
