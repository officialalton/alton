# College Board 디지털 SAT 실전 문제 커버리지 맵 (Math + R&W 전수)

**작성일**: 2026-09-17
**목적**: SAT 문제은행이 실제 College Board digital SAT 출제 범위와 얼마나 일치하는지 확인하는 기준표. 기획자 지시에 따라 컴파일러/SPR/근거모델 후속 작업 전에 반드시 완료해야 하는 1단계 산출물.
**AP·구형 SAT Essay는 범위 밖** — 스킵함.

## 진행 상태 (중요 — 반드시 먼저 읽을 것)

| 시험지 | R&W M1(33) | R&W M2(33) | Math M1(27) | Math M2(27) | 상태 |
|---|---|---|---|---|---|
| test4 | 완료 | 완료 | 완료 | 완료 | **전수 분류 완료** |
| test6 | 완료 | 완료 | 완료 | 완료 | **전수 분류 완료** |
| test7 | - | - | - | - | 미착수(이번 패스 예산 소진으로 착수 못함 — 후속 패스가 이어받을 것) |
| test8 | - | - | - | - | 미착수 |
| test9 | - | - | - | - | 미착수 |
| test10 | - | - | - | - | 미착수 |
| test11 | - | - | - | - | 미착수 |

**이번 패스는 test4·test6 두 종의 전수(각 120문항: R&W 66 + Math 54, 합계 240문항) 분류를 완료했다.** test7·8·9·10·11(약 600문항)은 이번 세션 예산 안에서 끝내지 못했다 — 후속 패스가 이 문서의 표 구조와 스킬 코드 판정 기준을 그대로 이어받아 test7부터 순서대로 채우면 된다.

각 PDF는 인쇄 쪽번호 기준 50페이지(R&W M1 인쇄p.2-15 / R&W M2 인쇄p.16-28 / Math M1 인쇄p.30-40 / Math M2 인쇄p.42-50) 고정 구조다. **주의**: `Read` 도구의 `pages` 파라미터 값은 PDF의 실제 페이지 인덱스이며 인쇄된 쪽번호와 정확히 일치하지 않을 수 있다(test6은 `pages` 값이 인쇄 쪽번호보다 +2 오프셋이었다 — 예: 인쇄 p.2가 `pages=4`). 시험지마다 표지/여백 페이지 배치가 다를 수 있으므로 매 시험지마다 처음 몇 페이지를 열어 실제 오프셋을 확인할 것. Math를 먼저 끝내라는 지시가 있었지만, R&W와 Math가 같은 PDF의 연속된 섹션이라 시험지 단위로 전수 처리하는 것이 더 효율적이라 판단해 test4·test6 모두 두 섹션을 함께 끝냈다. 후속 패스도 "시험지 단위 전수 → 다음 시험지"로 진행하되, 만약 다시 예산이 부족해지면 그 시점부터는 지시대로 나머지 Math 모듈들을 R&W보다 먼저 채울 것.

## 스킬 코드 판정 기준 (근거)

- **Math 19종**: `lib/problem-generation/math-compilers/*.ts` (batch.ts 제외) 각 파일의 `export type ...QuestionKind` / `...Difficulty` 를 기준으로 매핑. 컴파일러는 전부 `format="mc"`로 고정되어 있고(batch.ts), **SPR(주관식 답안) 생성은 컴파일러 레이어에 전혀 없다** — DB/UI/구형 AI 프롬프트에만 존재.
- **R&W 11종**: `words_in_context, central_ideas_details, inferences, command_of_evidence_text, command_of_evidence_quant, text_structure_purpose, cross_text_connections, rhetorical_synthesis, transitions, boundaries, form_structure_sense`. 이 중 앞의 5개(words_in_context, central_ideas_details, inferences, command_of_evidence_text, cross_text_connections)만 "얇은 근거 모델"(target/evidence_span/answer_rationale/distractor_error_types + 결정론적 검증) 보유. 나머지 6개는 생성은 되나 이 검증 계층이 없음.
- **화면 렌더링 검증**: 오늘 세션 기준 Math·R&W 문제 어느 것도 실제 Preview UI를 통해 렌더링 확인된 적이 없음을 재확인함(`git log`/`docs/CURRENT.md`에 관련 UAT 기록 없음). 따라서 이 문서의 모든 행은 "미확인"이다.

---

## 전수 분류표 — test4 (완료)

### R&W Module 1 (33문항, 전부 객관식)

| 시험지 | 문항번호 | Math/R&W | 상위 스킬 | 하위 문항 패턴 | 객관식/SPR | 자료 형식 | 현재 생성 가능 여부 | 결정론적 검증 여부 | 화면 렌더링 검증 여부 | 부족한 구현 단위 |
|---|---|---|---|---|---|---|---|---|---|---|
| test4 | M1-1 | R&W | words_in_context | 단문 어휘 빈칸(동사 선택) | 객관식 | 지문 | 가능 | 있음(정답 verbatim/rationale 검증) | 미확인 | - |
| test4 | M1-2 | R&W | words_in_context | 단문 어휘 빈칸(동사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test4 | M1-3 | R&W | words_in_context | 단문 어휘 빈칸(형용사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test4 | M1-4 | R&W | words_in_context | 단문 어휘 빈칸(형용사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test4 | M1-5 | R&W | central_ideas_details | 단일 문학 지문 주제/목적 파악 | 객관식 | 지문(소설) | 가능 | 없음 | 미확인 | central_ideas_details 결정론적 검증기 없음 |
| test4 | M1-6 | R&W | text_structure_purpose | 시 전체 구조 파악 | 객관식 | 지문(시) | 가능 | 없음 | 미확인 | text_structure_purpose 검증기 없음 |
| test4 | M1-7 | R&W | text_structure_purpose | 시 전체 구조 파악 | 객관식 | 지문(시) | 가능 | 없음 | 미확인 | text_structure_purpose 검증기 없음 |
| test4 | M1-8 | R&W | text_structure_purpose | 특정 문장의 기능 파악 | 객관식 | 지문 | 가능 | 없음 | 미확인 | text_structure_purpose 검증기 없음 |
| test4 | M1-9 | R&W | cross_text_connections | Text1/Text2 입장 비교, 한쪽이 다른쪽에 어떻게 반응할지 | 객관식 | 지문×2 | 가능 | 있음(합성 명제 target 검증) | 미확인 | - |
| test4 | M1-10 | R&W | central_ideas_details | 단일 지문 중심 내용 파악 | 객관식 | 지문(소설) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test4 | M1-11 | R&W | inferences | 비유(꽃=마음) 추론 | 객관식 | 지문(시) | 가능 | 있음 | 미확인 | - |
| test4 | M1-12 | R&W | central_ideas_details | 단일 지문 중심 내용 파악 | 객관식 | 지문(소설) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test4 | M1-13 | R&W | command_of_evidence_quant | 막대그래프 값으로 빈칸 완성 | 객관식 | 막대그래프 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그래프(막대) 기반 빈칸완성형 서브타입 미구현, 검증기 없음 |
| test4 | M1-14 | R&W | command_of_evidence_text | 가설을 뒷받침하는 발견 선택(그림/도표 없음) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 있음(공식 target은 있으나 이 "가설 지지 발견 선택형" 서브타입 커버 확인 안 됨) | 미확인 | 가설-지지-증거 선택형 서브타입 검증 필요 |
| test4 | M1-15 | R&W | command_of_evidence_quant | 표 데이터로 빈칸 완성 | 객관식 | 표 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 표 기반 빈칸완성형 미구현 |
| test4 | M1-16 | R&W | command_of_evidence_text | 인터뷰 인용문으로 주장 뒷받침 | 객관식 | 지문(인용) | 상위스킬만 있고 하위패턴 불가 | 있음(target은 있으나 인용문 선택형 서브타입 커버 미확인) | 미확인 | 인용문-선택형 서브타입 검증 필요 |
| test4 | M1-17 | R&W | command_of_evidence_quant | 표 데이터로 빈칸 완성 | 객관식 | 표 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 표 기반 빈칸완성형 미구현 |
| test4 | M1-18 | R&W | inferences | 논리적 결론 빈칸 완성 | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test4 | M1-19 | R&W | form_structure_sense | 소유격 아포스트로피(people's) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 소유격 서브타입 검증기 없음 |
| test4 | M1-20 | R&W | form_structure_sense | 동사 시제/형태 일치 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test4 | M1-21 | R&W | boundaries | 대시/쉼표로 부사구 연결 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test4 | M1-22 | R&W | form_structure_sense | 주어-동사 수일치(단수/복수) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test4 | M1-23 | R&W | boundaries | 삽입구 쉼표(sampler,) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test4 | M1-24 | R&W | form_structure_sense | 분사구문/현수수식어 오류 회피 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test4 | M1-25 | R&W | boundaries | 세미콜론/쉼표+동격구 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test4 | M1-26 | R&W | boundaries | 세미콜론+전환어(however) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test4 | M1-27 | R&W | transitions | 논리적 전환어 선택 | 객관식 | 없음 | 가능 | 없음 | 미확인 | transitions 검증기 없음 |
| test4 | M1-28 | R&W | transitions | 논리적 전환어 선택 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test4 | M1-29 | R&W | transitions | 논리적 전환어 선택 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test4 | M1-30 | R&W | transitions | 논리적 전환어 선택 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test4 | M1-31 | R&W | rhetorical_synthesis | 노트 종합→차이점 강조 | 객관식 | 없음(불릿노트) | 가능 | 없음 | 미확인 | rhetorical_synthesis 검증기 없음 |
| test4 | M1-32 | R&W | rhetorical_synthesis | 노트 종합→낯선 청중에게 소개 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test4 | M1-33 | R&W | rhetorical_synthesis | 노트 종합→낯선 청중에게 연구 소개 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |

### R&W Module 2 (33문항, 전부 객관식)

| 시험지 | 문항번호 | Math/R&W | 상위 스킬 | 하위 문항 패턴 | 객관식/SPR | 자료 형식 | 현재 생성 가능 여부 | 결정론적 검증 여부 | 화면 렌더링 검증 여부 | 부족한 구현 단위 |
|---|---|---|---|---|---|---|---|---|---|---|
| test4 | M2-1 | R&W | words_in_context | 단문 어휘 빈칸 | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test4 | M2-2 | R&W | words_in_context | 단문 어휘 빈칸(동사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test4 | M2-3 | R&W | words_in_context | 단문 어휘 빈칸(동명사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test4 | M2-4 | R&W | words_in_context | 단문 어휘 빈칸(형용사구) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test4 | M2-5 | R&W | words_in_context | 단문 어휘 빈칸(형용사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test4 | M2-6 | R&W | words_in_context | 단문 어휘 빈칸(동사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test4 | M2-7 | R&W | words_in_context | 단문 어휘 빈칸(명사구) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test4 | M2-8 | R&W | words_in_context | 단문 어휘 빈칸(동사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test4 | M2-9 | R&W | text_structure_purpose | 밑줄 문장의 텍스트 내 기능 | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test4 | M2-10 | R&W | central_ideas_details | 세부사항(연구 방법) 파악 | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test4 | M2-11 | R&W | command_of_evidence_text | 가설을 약화하는 발견 선택 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | "가설-약화" 서브타입 검증 필요 |
| test4 | M2-12 | R&W | command_of_evidence_text | 인용문으로 주장 예시 | 객관식 | 지문(인용) | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | 인용문형 서브타입 검증 필요 |
| test4 | M2-13 | R&W | command_of_evidence_quant | 막대그래프로 주장 뒷받침 | 객관식 | 막대그래프 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그래프 기반 서브타입 미구현 |
| test4 | M2-14 | R&W | command_of_evidence_text | 가설 지지 결과 선택(그림 없음) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | 검증 필요 |
| test4 | M2-15 | R&W | command_of_evidence_text | 인용문으로 주장 예시(문학) | 객관식 | 지문(인용) | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | 검증 필요 |
| test4 | M2-16 | R&W | inferences | 논리적 결론 빈칸 완성 | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test4 | M2-17 | R&W | inferences | 논리적 결론 빈칸 완성 | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test4 | M2-18 | R&W | inferences | 논리적 결론 빈칸 완성 | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test4 | M2-19 | R&W | form_structure_sense | 소유격/복수형 구분 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test4 | M2-20 | R&W | boundaries | 콜론/쉼표/대시/세미콜론 구분 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test4 | M2-21 | R&W | boundaries | 제한적 관계절 쉼표 유무 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test4 | M2-22 | R&W | boundaries | 삽입 약어 괄호/쉼표 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test4 | M2-23 | R&W | boundaries | 전치사구 뒤 마침표/쉼표 구분 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test4 | M2-24 | R&W | form_structure_sense | 부정사/분사 형태 선택 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test4 | M2-25 | R&W | form_structure_sense | 능동/수동태 및 절 구조 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test4 | M2-26 | R&W | boundaries | 콜론/세미콜론/마침표 구분 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test4 | M2-27 | R&W | transitions | 논리적 전환어 선택 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test4 | M2-28 | R&W | transitions | 논리적 전환어 선택 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test4 | M2-29 | R&W | rhetorical_synthesis | 노트 종합→장점 설명 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test4 | M2-30 | R&W | rhetorical_synthesis | 노트 종합→낯선 청중 소개 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test4 | M2-31 | R&W | rhetorical_synthesis | 노트 종합→비교 강조 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test4 | M2-32 | R&W | rhetorical_synthesis | 노트 종합→친숙 청중 소개 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test4 | M2-33 | R&W | rhetorical_synthesis | 노트 종합→유사점 강조 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |

### Math Module 1 (27문항)

| 시험지 | 문항번호 | Math/R&W | 상위 스킬 | 하위 문항 패턴 | 객관식/SPR | 자료 형식 | 현재 생성 가능 여부 | 결정론적 검증 여부 | 화면 렌더링 검증 여부 | 부족한 구현 단위 |
|---|---|---|---|---|---|---|---|---|---|---|
| test4 | M1-1 | Math | 없음 | 막대그래프 단순 값 읽기(범주형) | 객관식 | 막대그래프 | 완전 불가 | 없음 | 미확인 | 범주형 막대그래프 단순조회 스킬 자체가 없음 |
| test4 | M1-2 | Math | percentages | percent_of(75가 300의 몇%) | 객관식 | 없음 | 가능 | 있음(수치 재계산 검증) | 미확인 | - |
| test4 | M1-3 | Math | nonlinear_equations_systems | root(x²/25=36 형태) | 객관식 | 방정식 | 가능 | 있음 | 미확인 | - |
| test4 | M1-4 | Math | linear_equations_one_var | 문장제→일차방정식 변환(식 고르기) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 있음(수치형은 검증 있으나 "식 자체를 고르는" 변환형 미구현) | 미확인 | 방정식-매칭형(식 선택) 서브타입 없음 |
| test4 | M1-5 | Math | linear_functions | 일차함수 기울기의 맥락적 의미 해석 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | "맥락 해석형" 서브타입 없음(evaluate/find_x/slope_two_points만 존재) |
| test4 | M1-6 | Math | ratios_rates | 단가→수량 계산(SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음(SPR 답 모델 없음) | 미확인 | SPR 답안모델 없음 |
| test4 | M1-7 | Math | linear_equations_one_var | 쿠폰 할인 문장제(SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test4 | M1-8 | Math | linear_functions | 표에서 일차함수 식 도출 | 객관식 | 표 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | "표→식 도출형" 서브타입 없음 |
| test4 | M1-9 | Math | lines_angles_triangles | 닮은 삼각형 대응각 | 객관식 | 도형 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 닮음삼각형 대응각 서브타입 없음(triangle_angle_sum/exterior/isosceles만 존재) |
| test4 | M1-10 | Math | 없음 | 산점도 최적선(회귀식) 선택 | 객관식 | 산점도 | 완전 불가 | 없음 | 미확인 | **산점도 회귀/최적선 스킬 자체가 없음**(two_variable_data는 이원분류표 전용) |
| test4 | M1-11 | Math | linear_two_variables | 이변수 선형관계 문장제 | 객관식 | 방정식 | 가능 | 있음 | 미확인 | - |
| test4 | M1-12 | Math | linear_functions | 그래프→일차함수식 도출 | 객관식 | 좌표평면 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | "그래프→식" 서브타입 없음 |
| test4 | M1-13 | Math | equivalent_expressions | 비례식 대입 재계산(8/x) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test4 | M1-14 | Math | linear_two_variables | 연립방정식 값 구하기 | 객관식 | 방정식 | 가능 | 있음 | 미확인 | - |
| test4 | M1-15 | Math | linear_functions | 점+기울기로 직선의 방정식 | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test4 | M1-16 | Math | nonlinear_functions | 지수함수 문맥해석(배수 증가) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | "지수함수 문맥해석형" 서브타입 없음(evaluate/vertex만 존재) |
| test4 | M1-17 | Math | ratios_rates | 비율 유지 위한 변화량 계산 | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test4 | M1-18 | Math | nonlinear_functions | 둘레→넓이 합성함수 도출 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 합성함수 도출형 서브타입 없음 |
| test4 | M1-19 | Math | equivalent_expressions | 근호 포함 공식 변수 재정리(w 구하기) | 객관식 | 방정식 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 무리식 포함 공식 재배열 서브타입 없음 |
| test4 | M1-20 | Math | circles | 호의 각도=중심각(SPR) | **SPR** | 도형 | 가능(로직은 단순) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test4 | M1-21 | Math | equivalent_expressions | 거듭제곱근·지수 결합식 간소화(SPR) | **SPR** | 없음 | 상위스킬만 있고 하위패턴 불가(SPR도 미지원) | 없음 | 미확인 | 다중 거듭제곱근 결합형 서브타입 없음 + SPR 답안모델 없음 |
| test4 | M1-22 | Math | right_triangles_trigonometry | 무리수 변 길이로 넓이(SPR류 계산이나 실제는 MC) | 객관식 | 도형 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 무리수(제곱근) 변 길이 서브타입 없음 |
| test4 | M1-23 | Math | equivalent_expressions | 인수분해 계수관계 추론(h,k,j 정수조건) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 기호 인수분해(계수 조건 추론) 서브타입 없음 |
| test4 | M1-24 | Math | nonlinear_equations_systems | 이차-일차 연립, 접점(유일해) 조건 | 객관식 | 방정식 | 상위스킬만 있고 하위패턴 불가 | 있음(root/개수 검증은 있으나 접선 조건 특정형 미확인) | 미확인 | 접선(유일 교점) 조건형 서브타입 확인 필요 |
| test4 | M1-25 | Math | right_triangles_trigonometry | 45-45-90 특수각 삼각형 둘레 | 객관식 | 도형 | 가능 | 있음 | 미확인 | - |
| test4 | M1-26 | Math | nonlinear_functions | 포물선 꼭짓점→표준형 계수합 | 객관식 | 방정식 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 꼭짓점→표준형 전개 후 계수합 서브타입 없음 |
| test4 | M1-27 | Math | nonlinear_functions | 지수함수 y절편·계수곱 조건으로 역산 | 객관식 | 방정식 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 다중 조건 역산형 서브타입 없음 |

### Math Module 2 (27문항)

| 시험지 | 문항번호 | Math/R&W | 상위 스킬 | 하위 문항 패턴 | 객관식/SPR | 자료 형식 | 현재 생성 가능 여부 | 결정론적 검증 여부 | 화면 렌더링 검증 여부 | 부족한 구현 단위 |
|---|---|---|---|---|---|---|---|---|---|---|
| test4 | M2-1 | Math | 없음 | 선그래프 최댓값 연도 단순 조회 | 객관식 | 선그래프 | 완전 불가 | 없음 | 미확인 | 선그래프 단순조회 스킬 없음 |
| test4 | M2-2 | Math | ratios_rates | 단위 환산(야드→마일) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test4 | M2-3 | Math | equivalent_expressions | 동류항 정리 | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test4 | M2-4 | Math | linear_two_variables | 연립방정식 해 (x,y) | 객관식 | 방정식 | 가능 | 있음 | 미확인 | - |
| test4 | M2-5 | Math | linear_inequalities | point_in_solution(부등식 연립, 점 검증) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test4 | M2-6 | Math | linear_equations_one_var | 절댓값 방정식(SPR) | **SPR** | 없음 | 상위스킬만 있고 하위패턴 불가(SPR 미지원) | 없음 | 미확인 | 절댓값 방정식 서브타입 없음 + SPR 답안모델 없음 |
| test4 | M2-7 | Math | linear_functions | evaluate(일차함수 값, SPR) | **SPR** | 없음 | 가능(로직은)/SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test4 | M2-8 | Math | nonlinear_functions | evaluate(표에서 이차함수 값 매칭) | 객관식 | 표 | 가능 | 있음 | 미확인 | - |
| test4 | M2-9 | Math | nonlinear_functions | evaluate(지수함수 f(0)) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test4 | M2-10 | Math | inference_from_sample | 표본비율 오차범위로 타당한 결론 고르기 | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test4 | M2-11 | Math | linear_inequalities | solve_one_var(문장제, 최대개수) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test4 | M2-12 | Math | nonlinear_equations_systems | root(양의 해, SPR) | **SPR** | 없음 | 가능(로직은)/SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test4 | M2-13 | Math | two_variable_data | cell(이원분류표 확률, SPR) | **SPR** | 표 | 가능(로직은)/SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test4 | M2-14 | Math | linear_functions | 평행선 기울기 동일 조건(SPR) | **SPR** | 없음 | 상위스킬만 있고 하위패턴 불가(SPR 미지원) | 없음 | 미확인 | "평행선 기울기" 서브타입 없음 + SPR 미지원 |
| test4 | M2-15 | Math | linear_equations_one_var | 비율 문장제(찬성/반대 표 수) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test4 | M2-16 | Math | lines_angles_triangles | 평행선-횡단선 각도 관계 | 객관식 | 도형 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 평행선/횡단선 각 서브타입 없음(triangle_angle_sum 등만 존재) |
| test4 | M2-17 | Math | linear_equations_one_var | 무해(no solution) 조건의 계수 p | 객관식 | 방정식 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 무해조건 역산 서브타입 없음 |
| test4 | M2-18 | Math | nonlinear_functions | vertex_x(인수분해형 최소값 x) | 객관식 | 방정식 | 가능 | 있음 | 미확인 | - |
| test4 | M2-19 | Math | nonlinear_functions | vertex_y 맥락 해석(최소 높이) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | "맥락 해석형" 서브타입 없음 |
| test4 | M2-20 | Math | right_triangles_trigonometry | 여각 관계(cos K→cos L, SPR) | **SPR** | 없음 | 상위스킬만 있고 하위패턴 불가(SPR 미지원) | 없음 | 미확인 | 여각관계(sin/cos complement) 서브타입 없음 + SPR 미지원 |
| test4 | M2-21 | Math | nonlinear_equations_systems | num_real_solutions(무해조건, 최댓값 b, SPR) | **SPR** | 방정식 | 가능(로직은)/SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test4 | M2-22 | Math | linear_two_variables | 3원 연립 해의 개수 판정 | 객관식 | 좌표평면 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 3식 연립 해개수 서브타입 없음 |
| test4 | M2-23 | Math | percentages | 월별→연간 복리 감가율 역산 | 객관식 | 방정식 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 복리 기간환산형 서브타입 없음(percent_change는 단순 변화만) |
| test4 | M2-24 | Math | one_variable_data | median/range 이동(상수 더하기) 비교 | 객관식 | 점도표 | 가능 | 있음 | 미확인 | - |
| test4 | M2-25 | Math | 없음 | 원의 방정식 평행이동 | 객관식 | 없음 | 완전 불가 | 없음 | 미확인 | **원의 방정식 변환(이동) 스킬 자체가 없음**(circles는 둘레/호/부채꼴/각 관계만 다룸) |
| test4 | M2-26 | Math | area_volume | 정육면체 결합 표면적 역산(변 길이) | 객관식 | 도형 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 결합입체 표면적 역산 서브타입 확인 필요 |
| test4 | M2-27 | Math | percentages | percent_change(몇 % 증가) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |

---

## 전수 분류표 — test6 (완료)

### R&W Module 1 (33문항, 전부 객관식)

| 시험지 | 문항번호 | Math/R&W | 상위 스킬 | 하위 문항 패턴 | 객관식/SPR | 자료 형식 | 현재 생성 가능 여부 | 결정론적 검증 여부 | 화면 렌더링 검증 여부 | 부족한 구현 단위 |
|---|---|---|---|---|---|---|---|---|---|---|
| test6 | M1-1 | R&W | words_in_context | 단문 어휘 빈칸(명사구) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test6 | M1-2 | R&W | words_in_context | 단문 어휘 빈칸(형용사구) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test6 | M1-3 | R&W | words_in_context | 단문 어휘 빈칸(동명사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test6 | M1-4 | R&W | words_in_context | 단문 어휘(밑줄 단어 의미) | 객관식 | 지문(소설) | 가능 | 있음 | 미확인 | - |
| test6 | M1-5 | R&W | words_in_context | 단문 어휘 빈칸(형용사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test6 | M1-6 | R&W | text_structure_purpose | 밑줄 문장의 텍스트 내 기능 | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test6 | M1-7 | R&W | central_ideas_details | 단일 지문 주요 목적 파악 | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test6 | M1-8 | R&W | text_structure_purpose | 밑줄 부분의 텍스트 내 기능 | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test6 | M1-9 | R&W | cross_text_connections | Text1 주장에 Text2 저자가 어떻게 반응할지 | 객관식 | 지문×2 | 가능 | 있음 | 미확인 | - |
| test6 | M1-10 | R&W | central_ideas_details | 단일 지문 중심 내용 파악 | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test6 | M1-11 | R&W | command_of_evidence_quant | 표 데이터로 문장 완성 | 객관식 | 표 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 표 기반 빈칸완성형 미구현 |
| test6 | M1-12 | R&W | command_of_evidence_text | 연구 설명을 뒷받침하는 설문응답 선택(그림/표 없음) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | "설명-지지 응답 선택형" 서브타입 검증 필요 |
| test6 | M1-13 | R&W | command_of_evidence_text | 밑줄 주장 뒷받침 사실 선택(그림/표 없음) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | 검증 필요 |
| test6 | M1-14 | R&W | command_of_evidence_quant | 막대그래프로 결론 뒷받침 데이터 선택 | 객관식 | 막대그래프 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그래프 기반 서브타입 미구현 |
| test6 | M1-15 | R&W | command_of_evidence_quant | 막대그래프로 문장 완성 | 객관식 | 막대그래프 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그래프 기반 빈칸완성형 미구현 |
| test6 | M1-16 | R&W | command_of_evidence_text | 가설을 뒷받침하는 발견 선택(그림/표 없음) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | 가설-지지-증거 선택형 서브타입 검증 필요 |
| test6 | M1-17 | R&W | inferences | 논리적 결론 빈칸 완성 | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test6 | M1-18 | R&W | inferences | 논리적 결론 빈칸 완성 | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test6 | M1-19 | R&W | form_structure_sense | 동사 형태/시제 선택 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test6 | M1-20 | R&W | boundaries | 세미콜론/쉼표 구분 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test6 | M1-21 | R&W | form_structure_sense | 동사 형태/시제 선택 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test6 | M1-22 | R&W | form_structure_sense | 평서문/의문문 구조 선택 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test6 | M1-23 | R&W | form_structure_sense | 동사 시제 선택 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test6 | M1-24 | R&W | boundaries | 콤마/마침표(동격구) 구분 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test6 | M1-25 | R&W | boundaries | 콜론/마침표(원인절) 구분 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test6 | M1-26 | R&W | transitions | 논리적 전환어 선택 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test6 | M1-27 | R&W | transitions | 논리적 전환어 선택 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test6 | M1-28 | R&W | transitions | 논리적 전환어 선택 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test6 | M1-29 | R&W | transitions | 논리적 전환어 선택 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test6 | M1-30 | R&W | transitions | 논리적 전환어 선택 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test6 | M1-31 | R&W | rhetorical_synthesis | 노트 종합→업적 강조 | 객관식 | 없음(불릿노트) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test6 | M1-32 | R&W | rhetorical_synthesis | 노트 종합→유사점 강조 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test6 | M1-33 | R&W | rhetorical_synthesis | 노트 종합→일반화 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |

### R&W Module 2 (33문항, 전부 객관식)

| 시험지 | 문항번호 | Math/R&W | 상위 스킬 | 하위 문항 패턴 | 객관식/SPR | 자료 형식 | 현재 생성 가능 여부 | 결정론적 검증 여부 | 화면 렌더링 검증 여부 | 부족한 구현 단위 |
|---|---|---|---|---|---|---|---|---|---|---|
| test6 | M2-1 | R&W | words_in_context | 단문 어휘 빈칸(동사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test6 | M2-2 | R&W | words_in_context | 단문 어휘 빈칸(형용사구) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test6 | M2-3 | R&W | words_in_context | 단문 어휘 빈칸(형용사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test6 | M2-4 | R&W | words_in_context | 단문 어휘 빈칸(전치사구) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test6 | M2-5 | R&W | words_in_context | 단문 어휘 빈칸(형용사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test6 | M2-6 | R&W | central_ideas_details | 단일 지문 주요 목적 파악 | 객관식 | 지문(소설) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test6 | M2-7 | R&W | central_ideas_details | 단일 지문 주요 목적 파악 | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test6 | M2-8 | R&W | text_structure_purpose | 밑줄 부분의 텍스트 내 기능 | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test6 | M2-9 | R&W | text_structure_purpose | 밑줄 부분의 텍스트 내 기능 | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test6 | M2-10 | R&W | central_ideas_details | 단일 지문 중심 내용 파악 | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test6 | M2-11 | R&W | inferences | 세부사항 배제(추론)의 이유 파악 | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test6 | M2-12 | R&W | inferences | 저자 입장으로 가장 동의할 진술 선택 | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test6 | M2-13 | R&W | command_of_evidence_quant | 선그래프에서 조건 만족 항목 선택 | 객관식 | 선그래프 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 선그래프 기반 서브타입 미구현 |
| test6 | M2-14 | R&W | command_of_evidence_text | 인용문이 주장을 가장 잘 예증 | 객관식 | 지문(인용, 시) | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | 인용문형 서브타입 검증 필요 |
| test6 | M2-15 | R&W | command_of_evidence_quant | 표 데이터로 문장 완성 | 객관식 | 표 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 표 기반 빈칸완성형 미구현 |
| test6 | M2-16 | R&W | command_of_evidence_text | 가설을 뒷받침하는 발견 선택(그림/표 없음) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | 검증 필요 |
| test6 | M2-17 | R&W | inferences | 논리적 결론 빈칸 완성 | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test6 | M2-18 | R&W | inferences | 논리적 결론 빈칸 완성 | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test6 | M2-19 | R&W | form_structure_sense | 평서문/의문문 구조 선택 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test6 | M2-20 | R&W | boundaries | 문장 결합(동격/관계절 구조) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test6 | M2-21 | R&W | boundaries | 관계절/분사구 결합 방식 선택 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test6 | M2-22 | R&W | boundaries | 콤마/세미콜론 구분(비교구) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test6 | M2-23 | R&W | boundaries | 세미콜론/콤마 구분(동격 열거) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test6 | M2-24 | R&W | boundaries | 콤마/세미콜론/콜론 구분 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test6 | M2-25 | R&W | boundaries | 콜론/콤마 구분 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test6 | M2-26 | R&W | form_structure_sense | 동사 형태/시제 선택 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test6 | M2-27 | R&W | transitions | 논리적 전환어 선택 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test6 | M2-28 | R&W | transitions | 논리적 전환어 선택 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test6 | M2-29 | R&W | transitions | 논리적 전환어 선택 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test6 | M2-30 | R&W | rhetorical_synthesis | 노트 종합→유사점 강조 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test6 | M2-31 | R&W | rhetorical_synthesis | 노트 종합→대조 강조 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test6 | M2-32 | R&W | rhetorical_synthesis | 노트 종합→특정 사례 강조 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test6 | M2-33 | R&W | rhetorical_synthesis | 노트 종합→분류 판단 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |

### Math Module 1 (27문항)

| 시험지 | 문항번호 | Math/R&W | 상위 스킬 | 하위 문항 패턴 | 객관식/SPR | 자료 형식 | 현재 생성 가능 여부 | 결정론적 검증 여부 | 화면 렌더링 검증 여부 | 부족한 구현 단위 |
|---|---|---|---|---|---|---|---|---|---|---|
| test6 | M1-1 | Math | linear_equations_one_var | (p+3)+8=10 solve p | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test6 | M1-2 | Math | 없음 | 산점도 최적 모델(선형/지수) 그래프 선택 | 객관식 | 산점도 | 완전 불가 | 없음 | 미확인 | **산점도 회귀/최적선 스킬 자체가 없음**(two_variable_data는 이원분류표 전용) |
| test6 | M1-3 | Math | nonlinear_equations_systems | k²-53=91 양의 해 | 객관식 | 방정식 | 가능 | 있음 | 미확인 | - |
| test6 | M1-4 | Math | linear_inequalities | 범위 부등식 표현(문장제) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test6 | M1-5 | Math | nonlinear_functions | 그래프에서 증가 구간 식별 | 객관식 | 좌표평면(그래프) | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그래프 구간 판독형 서브타입 없음 |
| test6 | M1-6 | Math | ratios_rates | 단위 환산(인치→야드, SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test6 | M1-7 | Math | linear_equations_one_var | 문장제(비용함수, 게임수, SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test6 | M1-8 | Math | linear_functions | f(x)=x+b, x=0일 때 b 구하기 | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test6 | M1-9 | Math | nonlinear_functions | 지수함수 P(0) 맥락 해석 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | "맥락 해석형" 서브타입 없음 |
| test6 | M1-10 | Math | linear_equations_one_var | 재고 소진 문장제(일차방정식) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test6 | M1-11 | Math | linear_inequalities | point_in_solution(부등식, 표에서 항 검증) | 객관식 | 표 | 가능 | 있음 | 미확인 | - |
| test6 | M1-12 | Math | equivalent_expressions | 다항식 전개·동류항 정리 | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test6 | M1-13 | Math | nonlinear_functions | 유리함수 h(2) 계산(SPR) | **SPR** | 없음 | 상위스킬만 있고 하위패턴 불가(SPR도 미지원) | 없음 | 미확인 | 유리함수 evaluate 서브타입 없음 + SPR 답안모델 없음 |
| test6 | M1-14 | Math | right_triangles_trigonometry | 두 변 길이로 넓이 계산(SPR) | **SPR** | 도형 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test6 | M1-15 | Math | nonlinear_functions | 그래프에서 값 읽기(맥락 해석) | 객관식 | 좌표평면(그래프) | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그래프 판독형 서브타입 없음 |
| test6 | M1-16 | Math | linear_functions | 일차관계 문장제→식 구성 | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test6 | M1-17 | Math | equivalent_expressions | 공식에서 변수 재정리(C 구하기) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test6 | M1-18 | Math | nonlinear_equations_systems | w²+12w-40=0 근 구하기 | 객관식 | 방정식 | 가능 | 있음 | 미확인 | - |
| test6 | M1-19 | Math | one_variable_data | 도수분포표에서 중앙값 추정 | 객관식 | 표(도수분포) | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그룹화 도수분포 중앙값 서브타입 없음(one_variable_data는 원자료 리스트 전용) |
| test6 | M1-20 | Math | linear_functions | 방정식에서 y절편 구하기(SPR) | **SPR** | 방정식 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test6 | M1-21 | Math | nonlinear_functions | 그래프에서 계수 bc 값 추출(SPR) | **SPR** | 좌표평면(그래프) | 상위스킬만 있고 하위패턴 불가(SPR도 미지원) | 없음 | 미확인 | 그래프→계수 추출 서브타입 없음 + SPR 답안모델 없음 |
| test6 | M1-22 | Math | percentages | 연속 퍼센트 증가(14%→4%) 배수 역산 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 연속(2단계) 퍼센트 증가 합성 서브타입 없음 |
| test6 | M1-23 | Math | 없음 | 원의 이동+반지름 배율 변환 | 객관식 | 좌표평면 | 완전 불가 | 없음 | 미확인 | **원의 방정식 평행이동/배율 변환 스킬 자체가 없음**(circles는 둘레/호/부채꼴/각 관계만 다룸) |
| test6 | M1-24 | Math | right_triangles_trigonometry | 특수각(30°) tan 비율 계산 | 객관식 | 도형 | 가능 | 있음 | 미확인 | - |
| test6 | M1-25 | Math | nonlinear_functions | 퍼센트 증가율→지수함수 식 구성 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 퍼센트 증가율→지수식 구성 서브타입 없음 |
| test6 | M1-26 | Math | linear_functions | 합성함수(g=f/(x+3))에서 f의 y절편 역산 | 객관식 | 표 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 합성함수 역산형 서브타입 없음 |
| test6 | M1-27 | Math | lines_angles_triangles | 닮은 삼각형(평행선) 변 길이 계산(SPR) | **SPR** | 도형 | 상위스킬만 있고 하위패턴 불가(SPR도 미지원) | 없음 | 미확인 | 닮음삼각형 변길이(평행선) 서브타입 없음 + SPR 답안모델 없음 |

### Math Module 2 (27문항)

| 시험지 | 문항번호 | Math/R&W | 상위 스킬 | 하위 문항 패턴 | 객관식/SPR | 자료 형식 | 현재 생성 가능 여부 | 결정론적 검증 여부 | 화면 렌더링 검증 여부 | 부족한 구현 단위 |
|---|---|---|---|---|---|---|---|---|---|---|
| test6 | M2-1 | Math | linear_functions | f(x)=8x, f(x)=72 solve x | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test6 | M2-2 | Math | lines_angles_triangles | 맞꼭지각(vertical angles) 측정 | 객관식 | 도형 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 맞꼭지각 서브타입 없음(triangle_angle_sum/exterior/isosceles만 존재) |
| test6 | M2-3 | Math | 없음 | 단순 확률(전체 중 특정 개수 비율) | 객관식 | 없음 | 완전 불가 | 없음 | 미확인 | **단순 확률 스킬 자체가 없음**(19종 컴파일러에 확률 스킬 없음) |
| test6 | M2-4 | Math | 없음 | 그래프 유형 판별(증가/감소·선형/지수) | 객관식 | 좌표평면(그래프) | 완전 불가 | 없음 | 미확인 | **그래프에서 함수 유형 판별 스킬 자체가 없음** |
| test6 | M2-5 | Math | linear_functions | 그래프에서 y절편 읽기 | 객관식 | 좌표평면(그래프) | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그래프 판독형 서브타입 없음 |
| test6 | M2-6 | Math | linear_two_variables | 연립방정식 값 구하기(SPR) | **SPR** | 방정식 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test6 | M2-7 | Math | percentages | percent_of(팁 금액, SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test6 | M2-8 | Math | equivalent_expressions | 다항식 인수분해(공통인수) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test6 | M2-9 | Math | ratios_rates | 비례식(선분 길이 비) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test6 | M2-10 | Math | linear_equations_one_var | 동치 방정식 찾기 | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test6 | M2-11 | Math | linear_functions | 일차함수 y절편의 맥락적 의미 해석 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | "맥락 해석형" 서브타입 없음(evaluate/find_x/slope_two_points만 존재) |
| test6 | M2-12 | Math | nonlinear_equations_systems | 인수분해형(3차) 양의 해 | 객관식 | 방정식 | 가능 | 있음 | 미확인 | - |
| test6 | M2-13 | Math | ratios_rates | 비율 문장제(주급 저축액, SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test6 | M2-14 | Math | nonlinear_equations_systems | 이차방정식 문장제(넓이, 폭, SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test6 | M2-15 | Math | one_variable_data | median(원자료 리스트) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test6 | M2-16 | Math | area_volume | 원기둥 부피=밑면적×높이, h 구하기 | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test6 | M2-17 | Math | nonlinear_equations_systems | num_real_solutions(x²=음수) | 객관식 | 방정식 | 가능 | 있음 | 미확인 | - |
| test6 | M2-18 | Math | linear_functions | 수직선 기울기(perpendicular slope) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test6 | M2-19 | Math | linear_functions | 표에서 일차함수 식 도출 | 객관식 | 표 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | "표→식 도출형" 서브타입 없음 |
| test6 | M2-20 | Math | equivalent_expressions | 지수방정식(밑 동일, 지수 등식)에서 c 구하기(SPR) | **SPR** | 방정식 | 상위스킬만 있고 하위패턴 불가(SPR도 미지원) | 없음 | 미확인 | 지수방정식 미지수 역산 서브타입 없음 + SPR 답안모델 없음 |
| test6 | M2-21 | Math | linear_two_variables | 연립방정식에서 선형결합 값 구하기(SPR) | **SPR** | 방정식 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test6 | M2-22 | Math | right_triangles_trigonometry | 피타고라스(변 길이, 무리수 계수) | 객관식 | 도형 | 가능 | 있음 | 미확인 | - |
| test6 | M2-23 | Math | nonlinear_functions | 지수함수 밑을 성장률(p%)로 변환 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 지수 변환/성장률 도출 서브타입 없음 |
| test6 | M2-24 | Math | 없음 | 제곱근함수(radical function) 성질 추론 | 객관식 | 없음 | 완전 불가 | 없음 | 미확인 | **제곱근함수(radical function) 스킬 자체가 없음** |
| test6 | M2-25 | Math | circles | 원 위의 두 점(직각내접) 거리 계산 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 원주각-지름(Thales) 서브타입 없음 |
| test6 | M2-26 | Math | 없음 | 산점도 최적선 스케일 변환(y좌표 배율) | 객관식 | 산점도 | 완전 불가 | 없음 | 미확인 | **산점도 회귀/최적선 스킬 자체가 없음**(two_variable_data는 이원분류표 전용) |
| test6 | M2-27 | Math | linear_two_variables | 무해(no solution) 조건의 계수 r(SPR) | **SPR** | 방정식 | 상위스킬만 있고 하위패턴 불가(SPR도 미지원) | 없음 | 미확인 | 무해조건 2변수 역산 서브타입 없음 + SPR 답안모델 없음 |

---

## 누적 요약 (test4 + test6, 240문항 중) — 이번 패스에서 갱신

**개별 시험지 상세 근거는 아래 "요약 (test4 기준)" 절에 있던 test4 전용 집계를 유지하고, 여기서는 test4+test6 합산만 새로 추가한다.** test6의 세부 산정 근거는 위 test6 표를 직접 참고할 것 — 특히 R&W의 boundaries/form_structure_sense/transitions/rhetorical_synthesis 계열은 "상위 스킬은 있으나 검증기가 없음" 버킷에 넣었다(test4와 동일한 처리 방식).

### 1) 상위 스킬은 있으나 하위 패턴 생성 불가 — test4 28건 + test6 23건 = **51건**
- test6 Math(18): 그래프 구간 판독(M1-5), 지수함수 맥락해석(M1-9), 유리함수 evaluate(M1-13), 그래프 판독(M1-15), 그룹화 도수분포 중앙값(M1-19), 그래프→계수 추출(M1-21), 연속 퍼센트 증가(M1-22), 퍼센트→지수식 구성(M1-25), 합성함수 역산(M1-26), 닮음삼각형(평행선) 변길이(M1-27), 맞꼭지각(M2-2), 그래프 y절편 판독(M2-5), 일차함수 맥락해석(M2-11), 표→식 도출(M2-19), 지수방정식 미지수 역산(M2-20), 지수 변환/성장률 도출(M2-23), 원주각-지름(Thales, M2-25), 무해조건 2변수 역산(M2-27)
- test6 R&W(5, quant 그래프/표 기반만 집계 — text/인용형은 "있음+서브타입 미확인"으로 별도 취급): command_of_evidence_quant 표(M1-11), 막대그래프(M1-14,15), 선그래프(M2-13), 표(M2-15)

### 2) 생성은 가능하나 결정론적 검증이 없음 — test4 32건 + test6 39건 = **71건**
- test6 R&W(39): central_ideas_details 5(M1-7,10,M2-6,7,10), text_structure_purpose 4(M1-6,8,M2-8,9), boundaries/form_structure_sense 계열 15(M1-19~25 7건, M2-19~26 8건), transitions 8(M1-26~30 5건, M2-27~29 3건), rhetorical_synthesis 7(M1-31~33 3건, M2-30~33 4건)
- (Math는 test4와 마찬가지로 상위스킬 불가 버킷과 대부분 중첩되어 별도 집계하지 않음.)

### 3) 생성·검증은 되나 화면 렌더링 미확인 — test4 120건 + test6 120건 = **240건 (전체, 100%)**
- test4·test6 어느 것도 오늘까지 Preview UI에서 실제 렌더링 검증을 거치지 않았음. test6 UAT 실행 이력 없음(문서 조사만 수행, 실제 외부 쓰기 없음).

### 완전 불가(상위 스킬 자체 없음) — test4 4건 + test6 6건 = **10건**
- test4: 막대그래프 단순 값 읽기(M1-1), 산점도 최적선(M1-10), 선그래프 최댓값 조회(M2-1), 원의 방정식 평행이동(M2-25)
- test6: 산점도 최적 모델 선택(M1-2), 원 이동+반지름 배율 변환(M1-23), 단순 확률(M2-3), 그래프에서 함수 유형 판별(M2-4), 제곱근함수(radical function) 성질(M2-24), 산점도 스케일 변환(M2-26)
- **누적 패턴**: "산점도/선그래프/막대그래프 단순조회·회귀"와 "원의 방정식 변환(이동·배율)" 두 계열이 test4·test6 양쪽에서 반복 등장 — 후속 스킬 신설 시 최우선 후보로 확정해도 될 만큼 재현성이 높다. 여기에 test6에서 새로 발견된 "단순 확률"과 "제곱근함수(radical function)"도 완전 공백 스킬로 추가.

---

## 요약 (test4 기준, 120문항 중)

### 1) 상위 스킬은 있으나 하위 패턴 생성 불가 — **28건**
- Math (18건): 문장제→식 매칭(1), 일차함수 맥락해석(2: M1-5, M2-19 유사), 표→식 도출(1), 닮은삼각형 대응각(1), 그래프→식(1), 지수함수 문맥해석(1), 합성함수 도출(1), 무리식 공식 재배열(1), 기호 인수분해(1), 접선조건(1), 꼭짓점→표준형 계수합(1), 다중조건 역산(1), 절댓값방정식(1), 평행선기울기(1), 평행선/횡단선 각(1), 무해조건 역산(1), 복리기간환산(1), 결합입체 표면적역산(1)
- R&W (10건): command_of_evidence_quant 그래프/표 기반(3), command_of_evidence_quant 표(1), 소유격/형태(2), boundaries 세부구두점(2, 대표사례), form_structure_sense(2)
  (R&W는 boundaries/form_structure_sense 세부 서브타입 자체는 이론상 다양하게 생성 가능하나, 검증기가 없어 "결정론적 검증 없음" 버킷과 중첩 — 상위스킬 존재+하위패턴 자체는 대체로 가능하므로 이 버킷에는 그래프/표 기반 유형만 포함시킴)

### 2) 생성은 가능하나 결정론적 검증이 없음 — **32건**
- Math: 없음 스킬 매치 문항 제외, "가능" 판정 받은 문항 중 검증 있는 것 다수지만, nonlinear_functions의 M2-8/9/18은 있음으로 표기(재계산 가능) — 실제 없음 버킷은 상위스킬 불가 판정과 겹치는 문항 제외 시 이 표에서 "없음" 단독 표기된 항목들: text_structure_purpose(3), central_ideas_details(3), transitions(6), rhetorical_synthesis(8), form_structure_sense(6, boundaries 포함 세부구두점 다수), 그 외 R&W 다수
- 정확히는: **transitions 6건, rhetorical_synthesis 8건, text_structure_purpose 3건, central_ideas_details 3건, boundaries/form_structure_sense 계열 12건** = R&W만 32건. (Math는 상위스킬 불가 버킷과 대부분 중첩되어 별도 집계하지 않음.)

### 3) 생성·검증은 되나 화면 렌더링 미확인 — **120건 (전체)**
- Math·R&W 어느 것도 오늘 세션까지 Preview UI에서 실제 렌더링 검증을 거치지 않았음을 재확인. 즉 "가능+검증 있음"으로 판정된 문항(Math 약 14건: percentages 3, nonlinear_equations_systems 3, linear_equations_one_var 계열, linear_two_variables 3, linear_functions 3, equivalent_expressions 2, ratios_rates 2, right_triangles_trigonometry 1, inference_from_sample 1, one_variable_data 1, linear_inequalities 2 / R&W 약 13건: words_in_context 12, cross_text_connections 1, inferences 4)조차 화면 렌더링은 전부 미확인.

### 완전 불가(상위 스킬 자체 없음) — 별도 표기, **3건**
- Math M1-1: 막대그래프 단순 값 읽기(범주형)
- Math M1-10: **산점도 회귀/최적선(line of best fit) — two_variable_data는 이원분류표 전용이라 대응 스킬 없음**
- Math M2-1: 선그래프 최댓값 연도 단순 조회
- Math M2-25: **원의 방정식 평행이동 — circles 스킬이 둘레/호/부채꼴/중심각-원주각만 다뤄 좌표기하 변환 문항과 매치 안 됨**
(4건으로 정정 — 위 3)+1)

---

## SPR 전용 집계 (test4 기준, 다음 단계 최우선 확인사항)

test4 Math 54문항(M1 27 + M2 27) 중 **실제 SPR(주관식) 문항 10건** 확인:

| 상위 스킬 | SPR 문항 수 | 문항 |
|---|---|---|
| linear_equations_one_var | 2 | M1-7, M2-6(절댓값) |
| ratios_rates | 1 | M1-6 |
| circles | 1 | M1-20 |
| equivalent_expressions | 1 | M1-21 |
| linear_functions | 2 | M2-7, M2-14(평행선) |
| nonlinear_equations_systems | 2 | M2-12, M2-21 |
| two_variable_data | 1 | M2-13 |
| right_triangles_trigonometry | 1 | M2-20 |

**핵심 확인**: SPR 문항은 Math 54문항 중 약 18.5%(10/54)를 차지하며, 스킬 코드가 특정 계열에 몰려 있지 않고 거의 전 영역(선형/비선형방정식, 삼각비, 원, 이원표, 식 정리)에 고르게 분포한다. 현재 컴파일러 레이어는 이 10건 전부에 대해 SPR 답안모델이 없다(batch.ts가 format="mc" 하드코딩) — **SPR 지원은 특정 스킬 1~2개만 추가하는 문제가 아니라 배치 레이어 자체의 출력 포맷 분기 작업**이 필요함을 시사.

## SPR 누적 집계 (test4 + test6, 이번 패스에서 갱신)

test6 Math 54문항(M1 27 + M2 27) 중 **실제 SPR(주관식) 문항 14건** 확인:

| 상위 스킬 | SPR 문항 수 | 문항 |
|---|---|---|
| ratios_rates | 2 | M1-6, M2-13 |
| linear_equations_one_var | 1 | M1-7 |
| nonlinear_functions | 2 | M1-13(유리함수), M1-21(그래프계수) |
| right_triangles_trigonometry | 1 | M1-14 |
| linear_functions | 1 | M1-20 |
| lines_angles_triangles | 1 | M1-27 |
| linear_two_variables | 3 | M2-6, M2-21, M2-27(무해조건) |
| percentages | 1 | M2-7 |
| nonlinear_equations_systems | 1 | M2-14 |
| equivalent_expressions | 1 | M2-20(지수방정식) |

**test4+test6 합산: Math 108문항 중 SPR 24건(약 22.2%)** — test4(10/54, 18.5%)보다 test6(14/54, 25.9%)가 다소 높지만 두 시험지 모두 20% 안팎으로 수렴하며, 스킬 코드 분포도 특정 계열에 몰리지 않고 선형/비선형 방정식, 비율, 삼각비, 지수식 전반에 걸쳐 나타난다. **결론은 test4 때와 동일하게 유지**: SPR 지원은 배치 레이어(`batch.ts`)의 출력 포맷 분기 작업이며, 특정 스킬 1~2개만 추가해서 해결되지 않는다.

(나머지 5개 시험지 — test7·8·9·10·11 — 의 SPR 표본은 후속 패스에서 계속 누적 집계할 것. test4+test6 두 종만으로도 20% 안팎 비율은 상당히 안정적으로 보이지만, 스킬별 분포가 시험지마다 바뀔 수 있으므로 최소 1~2종 추가 확인 후 최종 %를 확정하는 것을 권장.)

---

## 후속 패스 안내

1. **test7부터** 시작할 것(test4·test6은 이번 두 패스로 완료). 각 PDF는 인쇄 쪽번호 기준 동일한 구조(R&W M1 → R&W M2 → Math M1 → Math M2, "STOP" 페이지로 모듈 경계 확인 가능)이나, `Read`의 `pages` 파라미터 값이 인쇄 쪽번호와 오프셋이 있을 수 있으므로(test6은 +2 오프셋) 매 시험지 첫 페이지에서 실제 오프셋을 먼저 확인한 뒤 읽어나갈 것.
2. 이 문서의 표에 시험지별 섹션을 이어 추가하고, "진행 상태" 표를 갱신.
3. 5개 시험지(test7·8·9·10·11)가 모두 끝나면 위 3버킷 요약과 SPR 집계를 **전체 7종 합산**으로 재작성.
4. test11은 52페이지로 다른 시험지보다 4페이지 적음 — 실제 열어서 구조를 재확인할 것(표지/여백 페이지 배치가 다를 가능성).
5. **이번 패스에서 확인된 재현 패턴**: "산점도 회귀/최적선", "막대·선그래프 단순조회", "원의 방정식 이동·배율 변환"이 test4·test6 양쪽에서 반복 등장했고, test6에서 "단순 확률", "제곱근함수(radical function)"도 새로 발견됐다. test7부터는 이 6개 완전공백 스킬이 또 나타나는지 우선 확인하면 후속 스킬 신설 우선순위를 더 빨리 확정할 수 있다.
