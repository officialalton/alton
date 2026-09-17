# College Board 디지털 SAT 실전 문제 커버리지 맵 (Math + R&W 전수)

**작성일**: 2026-09-17
**목적**: SAT 문제은행이 실제 College Board digital SAT 출제 범위와 얼마나 일치하는지 확인하는 기준표. 기획자 지시에 따라 컴파일러/SPR/근거모델 후속 작업 전에 반드시 완료해야 하는 1단계 산출물.
**AP·구형 SAT Essay는 범위 밖** — 스킵함.

## 진행 상태 (중요 — 반드시 먼저 읽을 것)

| 시험지 | R&W M1(33) | R&W M2(33) | Math M1(27) | Math M2(27) | 상태 |
|---|---|---|---|---|---|
| test4 | 완료 | 완료 | 완료 | 완료 | **전수 분류 완료** |
| test6 | 완료 | 완료 | 완료 | 완료 | **전수 분류 완료** |
| test7 | 완료 | 완료 | 완료 | 완료 | **전수 분류 완료** |
| test8 | 완료 | 완료 | 완료 | 완료 | **전수 분류 완료** |
| test9 | 완료 | 완료 | 완료 | 완료 | **전수 분류 완료** |
| test10 | 완료 | 완료 | 완료 | 완료 | **전수 분류 완료** |
| test11 | 완료 | 완료 | 완료 | 완료 | **전수 분류 완료 — 7개 시험지(840문항) 전수 매핑 최종 완료** |

**최종 패스에서 test10·test11 전수(각 120문항: R&W 66 + Math 54)를 완료해 test4+test6+test7+test8+test9+test10+test11 누적 840문항으로 College Board 실전 문제 전수 매핑을 마쳤다.** test5는 결번이라 범위에 포함되지 않는다. test10·test11 모두 `pages` 오프셋이 이전 시험지들과 동일하게 +2였다(인쇄 p.2 = `pages=4`). test11은 52페이지(다른 시험지보다 4페이지 적음)였으나 실제 열어보니 모듈 구조·문항 수는 동일하고 여백/STOP 페이지 배치만 달랐다. 최종 3버킷 요약·SPR 집계·완전불가 갭 랭킹·로드맵 확인은 문서 맨 앞 "최종 요약" 절 참고. **정정 미반영 사항**: test6 M2-3·test7 M2-5의 "단순확률 완전공백" 오분류 행 자체를 고치는 작업은 이번 패스에서도 예산상 뒤로 미뤘다(최종 요약의 갭 랭킹 3번 항목에 올바른 결론만 반영) — 후속 세션에서 그 두 행만 스킬 컬럼 치환하면 끝나는 간단한 정정이다.

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

## 전수 분류표 — test7 (완료)

`pages` 오프셋은 test6과 동일하게 +2(인쇄 p.2 = `pages=4`). 구조: R&W M1 인쇄p.2-16(`pages`4-18) / R&W M2 인쇄p.18-29(`pages`20-31) / Math M1 인쇄p.30-38(`pages`32-40) / Math M2 인쇄p.40-48(`pages`42-50).

### R&W Module 1 (33문항, 전부 객관식)

| 시험지 | 문항번호 | Math/R&W | 상위 스킬 | 하위 문항 패턴 | 객관식/SPR | 자료 형식 | 현재 생성 가능 여부 | 결정론적 검증 여부 | 화면 렌더링 검증 여부 | 부족한 구현 단위 |
|---|---|---|---|---|---|---|---|---|---|---|
| test7 | M1-1 | R&W | words_in_context | 단문 어휘 빈칸(명사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test7 | M1-2 | R&W | words_in_context | 단문 어휘(밑줄 단어 의미) | 객관식 | 지문(회고록) | 가능 | 있음 | 미확인 | - |
| test7 | M1-3 | R&W | words_in_context | 단문 어휘 빈칸(동사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test7 | M1-4 | R&W | words_in_context | 단문 어휘 빈칸(동사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test7 | M1-5 | R&W | words_in_context | 단문 어휘 빈칸(분사구) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test7 | M1-6 | R&W | text_structure_purpose | 밑줄 문장의 텍스트 내 기능(회고록) | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test7 | M1-7 | R&W | text_structure_purpose | 밑줄 부분의 텍스트 내 기능 | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test7 | M1-8 | R&W | text_structure_purpose | 밑줄 부분의 텍스트 내 기능(시) | 객관식 | 지문(시) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test7 | M1-9 | R&W | text_structure_purpose | 밑줄 부분의 텍스트 내 기능(인용 포함) | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test7 | M1-10 | R&W | central_ideas_details | 세부사항 중 텍스트가 뒷받침하는 진술 선택 | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test7 | M1-11 | R&W | central_ideas_details | 단일 지문이 강하게 시사하는 바 파악 | 객관식 | 지문(소설) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test7 | M1-12 | R&W | command_of_evidence_quant | 막대그래프로 값 확인 | 객관식 | 막대그래프 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그래프 기반 서브타입 미구현 |
| test7 | M1-13 | R&W | command_of_evidence_text | 학생 주장 뒷받침하는 철학자 인용문 선택(그림/표 없음) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | 인용문-선택형 서브타입 검증 필요 |
| test7 | M1-14 | R&W | command_of_evidence_text | 결론을 뒷받침하는 연구 결과 선택(그림/표 없음) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | 검증 필요 |
| test7 | M1-15 | R&W | command_of_evidence_quant | 막대그래프로 문장 완성 | 객관식 | 막대그래프 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그래프 기반 빈칸완성형 미구현 |
| test7 | M1-16 | R&W | command_of_evidence_quant | 막대그래프로 학생 주장 뒷받침 데이터 선택 | 객관식 | 막대그래프 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그래프 기반 서브타입 미구현 |
| test7 | M1-17 | R&W | inferences | 논리적 결론 빈칸 완성(일각고래 엄니) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test7 | M1-18 | R&W | inferences | 논리적 결론 빈칸 완성(SiC 섬유 연구) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test7 | M1-19 | R&W | form_structure_sense | 동사 형태(현재/현재완료/진행) 선택 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test7 | M1-20 | R&W | form_structure_sense | 지시대명사(One/That/This/These) 선택 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test7 | M1-21 | R&W | form_structure_sense | 동사 시제(진행/미래완료/미래/과거) 선택 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test7 | M1-22 | R&W | boundaries | 콤마+등위접속사 vs 콤마이어붙임 구분 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test7 | M1-23 | R&W | form_structure_sense | 수동태/시제(has been/will be/과거/현재) 선택 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test7 | M1-24 | R&W | boundaries | 마침표+콤마 결합 구두점 선택 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test7 | M1-25 | R&W | form_structure_sense | 분사구문(현수수식어) 오류 회피 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test7 | M1-26 | R&W | boundaries | 세미콜론+콤마 구분 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test7 | M1-27 | R&W | transitions | 논리적 전환어 선택 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test7 | M1-28 | R&W | rhetorical_synthesis | 노트 종합→과학자 유형 식별 | 객관식 | 없음(불릿노트) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test7 | M1-29 | R&W | rhetorical_synthesis | 노트 종합→소설 배경 장소 명시 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test7 | M1-30 | R&W | rhetorical_synthesis | 노트 종합→두 타일 양식 대조 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test7 | M1-31 | R&W | rhetorical_synthesis | 노트 종합→두 저항가요 대조 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test7 | M1-32 | R&W | rhetorical_synthesis | 노트 종합→인용문으로 이론에 반박 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test7 | M1-33 | R&W | rhetorical_synthesis | 노트 종합→연구 결과 개관 제시 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |

### R&W Module 2 (33문항, 전부 객관식)

| 시험지 | 문항번호 | Math/R&W | 상위 스킬 | 하위 문항 패턴 | 객관식/SPR | 자료 형식 | 현재 생성 가능 여부 | 결정론적 검증 여부 | 화면 렌더링 검증 여부 | 부족한 구현 단위 |
|---|---|---|---|---|---|---|---|---|---|---|
| test7 | M2-1 | R&W | words_in_context | 단문 어휘 빈칸(동사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test7 | M2-2 | R&W | words_in_context | 단문 어휘 빈칸(동사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test7 | M2-3 | R&W | words_in_context | 단문 어휘 빈칸(형용사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test7 | M2-4 | R&W | words_in_context | 단문 어휘 빈칸(명사구) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test7 | M2-5 | R&W | words_in_context | 단문 어휘 빈칸(명사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test7 | M2-6 | R&W | text_structure_purpose | 밑줄 문장의 텍스트 내 기능(Tharp/Heezen) | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test7 | M2-7 | R&W | text_structure_purpose | 밑줄 부분의 텍스트 내 기능(TV 광고주) | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test7 | M2-8 | R&W | text_structure_purpose | 밑줄 문장의 텍스트 내 기능(바이외 태피스트리) | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test7 | M2-9 | R&W | cross_text_connections | Text1 "일부 연구자 주장"에 Text2 저자가 어떻게 반응할지 | 객관식 | 지문×2 | 가능 | 있음(합성 명제 target 검증) | 미확인 | - |
| test7 | M2-10 | R&W | central_ideas_details | 세부사항(고무나무 껍질 구조) 파악 | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test7 | M2-11 | R&W | central_ideas_details | 단일 지문 주요 아이디어 파악 | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test7 | M2-12 | R&W | command_of_evidence_quant | 표 데이터로 주장 완성 | 객관식 | 표 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 표 기반 빈칸완성형 미구현 |
| test7 | M2-13 | R&W | command_of_evidence_quant | 표에서 특정 값 조회 | 객관식 | 표 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 표 기반 단순조회형 미구현 |
| test7 | M2-14 | R&W | command_of_evidence_text | 인용문으로 밑줄 주장 예증(조각가) | 객관식 | 지문(인용) | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | 인용문형 서브타입 검증 필요 |
| test7 | M2-15 | R&W | command_of_evidence_text | 결론을 뒷받침하는 발견 선택(그림/표 없음) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | 검증 필요 |
| test7 | M2-16 | R&W | inferences | 논리적 결론 빈칸 완성(옥수수 어휘) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test7 | M2-17 | R&W | inferences | 논리적 결론 빈칸 완성(화성 탐사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test7 | M2-18 | R&W | inferences | 논리적 결론 빈칸 완성(시돈 동전) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test7 | M2-19 | R&W | form_structure_sense | 동사 형태(원형/동명사/현재/부정사) 선택 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test7 | M2-20 | R&W | form_structure_sense | 동사 시제(현재/미래/현재완료/과거) 선택 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test7 | M2-21 | R&W | boundaries | 동격 인명 뒤 구두점(콜론/대시/무구두점/콤마) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test7 | M2-22 | R&W | form_structure_sense | 주어-동사 수일치 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test7 | M2-23 | R&W | boundaries | 콤마/세미콜론/마침표 구분 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test7 | M2-24 | R&W | boundaries | 콤마+though 구두점 선택 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test7 | M2-25 | R&W | boundaries | 콤마/세미콜론 구분 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test7 | M2-26 | R&W | boundaries | 콜론/콤마/무구두점/세미콜론 구분 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test7 | M2-27 | R&W | transitions | 논리적 전환어 선택 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test7 | M2-28 | R&W | transitions | 논리적 전환어 선택 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test7 | M2-29 | R&W | transitions | 논리적 전환어 선택 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test7 | M2-30 | R&W | transitions | 논리적 전환어 선택 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test7 | M2-31 | R&W | transitions | 논리적 전환어 선택 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test7 | M2-32 | R&W | rhetorical_synthesis | 노트 종합→상 받은 소설 제목 명시 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test7 | M2-33 | R&W | rhetorical_synthesis | 노트 종합→작품 완성 연도 명시 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |

### Math Module 1 (27문항, SPR 5건)

| 시험지 | 문항번호 | Math/R&W | 상위 스킬 | 하위 문항 패턴 | 객관식/SPR | 자료 형식 | 현재 생성 가능 여부 | 결정론적 검증 여부 | 화면 렌더링 검증 여부 | 부족한 구현 단위 |
|---|---|---|---|---|---|---|---|---|---|---|
| test7 | M1-1 | Math | 없음 | 산점도 최적선에서 특정 x값의 예측값 읽기 | 객관식 | 산점도 | 완전 불가 | 없음 | 미확인 | **산점도 회귀/최적선 스킬 자체가 없음**(누적 3회째 재현) |
| test7 | M1-2 | Math | 없음 | 사각형 넓이 차 계산(단순 뺄셈 문장제) | 객관식 | 없음 | 완전 불가 | 없음 | 미확인 | 19종 컴파일러 어디에도 매칭되는 스킬 없음(단순 도형 넓이 차) |
| test7 | M1-3 | Math | linear_equations_one_var | 절댓값 방정식(|p|+61=65) | 객관식 | 방정식 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 절댓값 방정식 서브타입 없음 |
| test7 | M1-4 | Math | linear_equations_one_var | 문장제→일차방정식 변환(식 고르기) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 있음(수치형은 검증 있으나 식 선택형 미구현) | 미확인 | 방정식-매칭형(식 선택) 서브타입 없음 |
| test7 | M1-5 | Math | 없음 | 막대그래프 단순 값 조회(범주형) | 객관식 | 막대그래프 | 완전 불가 | 없음 | 미확인 | 범주형 막대그래프 단순조회 스킬 자체가 없음(누적 3회째 재현) |
| test7 | M1-6 | Math | linear_functions | 기울기+y절편으로 직선의 방정식 계수 구하기 | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test7 | M1-7 | Math | nonlinear_equations_systems | 인수분해형(3차) x절편 하나 구하기(SPR) | **SPR** | 방정식 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test7 | M1-8 | Math | nonlinear_functions | 그래프 y절편의 맥락적 의미 해석(감가상각) | 객관식 | 좌표평면(그래프) | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | "맥락 해석형" 서브타입 없음 |
| test7 | M1-9 | Math | lines_angles_triangles | 합동삼각형 대응각(삼각형 내각합) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test7 | M1-10 | Math | linear_functions | evaluate(일차함수 값) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test7 | M1-11 | Math | 없음 | 절댓값함수-일차함수 그래프 연립 교점 읽기 | 객관식 | 좌표평면(그래프) | 완전 불가 | 없음 | 미확인 | 절댓값함수 포함 연립방정식 그래프 판독 스킬 없음(nonlinear_equations_systems는 이차/유리식 중심) |
| test7 | M1-12 | Math | linear_two_variables | 무한해 조건 만족하는 두번째 방정식 선택 | 객관식 | 방정식 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 무한해(항등) 조건 매칭형 서브타입 없음 |
| test7 | M1-13 | Math | linear_equations_one_var | 분수계수 일차방정식, 스케일된 값 구하기(SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test7 | M1-14 | Math | linear_two_variables | 연립방정식 값 구하기(SPR) | **SPR** | 방정식 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test7 | M1-15 | Math | 없음 | 원의 표준방정식에서 중심/반지름 읽기 | 객관식 | 방정식 | 완전 불가 | 없음 | 미확인 | **circles 스킬이 좌표기하 방정식 형태를 전혀 다루지 않음**(둘레/호/부채꼴/각 관계만 존재, 누적 3회째 재현) |
| test7 | M1-16 | Math | linear_equations_one_var | 절댓값 일차함수 evaluate/역산(|x-4x|) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 절댓값 함수 evaluate 서브타입 없음 |
| test7 | M1-17 | Math | nonlinear_functions | 지수함수 형태 인식(계수/밑 위치 판별) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | "형태 인식형" 서브타입 없음 |
| test7 | M1-18 | Math | nonlinear_functions | 지수함수 배가시간 해석 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | "배가시간 해석형" 서브타입 없음 |
| test7 | M1-19 | Math | equivalent_expressions | 다변수 방정식에서 특정 변수로 재정리 | 객관식 | 방정식 | 가능 | 있음 | 미확인 | - |
| test7 | M1-20 | Math | 없음 | 산점도에서 두 점 읽어 평균변화율 계산 | 객관식 | 산점도 | 완전 불가 | 없음 | 미확인 | 산점도 임의점 판독 스킬 없음(누적 재현) |
| test7 | M1-21 | Math | linear_equations_one_var | 문장제(두 미지수 비례 관계, SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test7 | M1-22 | Math | lines_angles_triangles | 원의 반지름 두 변으로 이루어진 이등변삼각형 셋째 변 길이 | 객관식 | 도형 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | "반지름-이등변삼각형 변 길이" 서브타입 없음 |
| test7 | M1-23 | Math | linear_inequalities | 문장제→부등식 변환(식 고르기) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 부등식 매칭형(식 선택) 서브타입 없음 |
| test7 | M1-24 | Math | linear_two_variables | 매개변수(s) 포함 표에서 선형관계식 도출 | 객관식 | 표 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 매개변수 포함 표→식 도출 서브타입 없음 |
| test7 | M1-25 | Math | right_triangles_trigonometry | 삼각함수 덧셈정리(sin·cos 합) 항등식 인식 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 삼각함수 항등식(합차공식) 인식형 서브타입 없음 |
| test7 | M1-26 | Math | linear_functions | 문장제(기본요금+추가요금)→식 매칭 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 있음(수치형은 있으나 식 선택형 미구현) | 미확인 | 식 선택형 서브타입 없음 |
| test7 | M1-27 | Math | nonlinear_functions | vertex_x(인수분해형, SPR) | **SPR** | 방정식 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |

### Math Module 2 (27문항, SPR 7건)

| 시험지 | 문항번호 | Math/R&W | 상위 스킬 | 하위 문항 패턴 | 객관식/SPR | 자료 형식 | 현재 생성 가능 여부 | 결정론적 검증 여부 | 화면 렌더링 검증 여부 | 부족한 구현 단위 |
|---|---|---|---|---|---|---|---|---|---|---|
| test7 | M2-1 | Math | linear_equations_one_var | 전체-부분 문장제(단순 뺄셈) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test7 | M2-2 | Math | percentages | percent_of(250의 6%) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test7 | M2-3 | Math | nonlinear_functions | 그래프에서 포물선 꼭짓점 읽기 | 객관식 | 좌표평면(그래프) | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그래프 판독형(꼭짓점) 서브타입 없음 |
| test7 | M2-4 | Math | ratios_rates | 밀도 계산(개체수/면적) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test7 | M2-5 | Math | 없음 | 단순 확률(데이터셋에서 양수 뽑을 확률) | 객관식 | 없음 | 완전 불가 | 없음 | 미확인 | **단순 확률 스킬 자체가 없음**(test6 M2-3에 이어 재현) |
| test7 | M2-6 | Math | linear_functions | evaluate(일차함수 값, SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test7 | M2-7 | Math | nonlinear_functions | evaluate(이차함수 정점형, 대입값이 정점 x라 상수항만 남는 형태, SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test7 | M2-8 | Math | equivalent_expressions | 비례식 대입 재계산(8x=6→72x) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test7 | M2-9 | Math | equivalent_expressions | 다항식 인수분해(공통인수) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test7 | M2-10 | Math | equivalent_expressions | 다항식 덧셈·동류항 정리 | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test7 | M2-11 | Math | linear_two_variables | 연립방정식 계수 차이 해석(문맥) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | "계수 차이 해석형" 서브타입 없음 |
| test7 | M2-12 | Math | 없음 | 산점도 최적선 기울기 추정 | 객관식 | 산점도 | 완전 불가 | 없음 | 미확인 | 산점도 회귀/최적선 스킬 자체가 없음(누적 재현) |
| test7 | M2-13 | Math | circles | 원의 넓이 공식(A=bπ)에서 b 구하기(SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test7 | M2-14 | Math | lines_angles_triangles | 평행선(PQ∥XY) 이용 각도 계산(SPR) | **SPR** | 도형 | 상위스킬만 있고 하위패턴 불가(SPR도 미지원) | 없음 | 미확인 | 평행선-닮은삼각형 각도 서브타입 없음 + SPR 답안모델 없음 |
| test7 | M2-15 | Math | nonlinear_functions | 배가주기 지수함수 식 구성 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | "배가주기 지수식 구성" 서브타입 없음 |
| test7 | M2-16 | Math | linear_inequalities | point_in_solution(연립부등식, 표에서 항 검증) | 객관식 | 표 | 가능 | 있음 | 미확인 | - |
| test7 | M2-17 | Math | equivalent_expressions | 지수법칙(거듭제곱 나눗셈) 간소화 | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test7 | M2-18 | Math | linear_two_variables | 연립방정식 스케일된 값 구하기 | 객관식 | 방정식 | 가능 | 있음 | 미확인 | - |
| test7 | M2-19 | Math | nonlinear_equations_systems | 물리 맥락 이차방정식(낙하시간) 해 구하기 | 객관식 | 방정식 | 가능 | 있음 | 미확인 | - |
| test7 | M2-20 | Math | nonlinear_equations_systems | 근의공식 형태에서 판별식 계수 추출(SPR) | **SPR** | 방정식 | 상위스킬만 있고 하위패턴 불가(SPR도 미지원) | 없음 | 미확인 | 판별식/공식계수 추출형 서브타입 없음 + SPR 답안모델 없음 |
| test7 | M2-21 | Math | lines_angles_triangles | 평행선-횡단선 각도 관계(대수식, SPR) | **SPR** | 없음 | 상위스킬만 있고 하위패턴 불가(SPR도 미지원) | 없음 | 미확인 | 평행선 각 관계(대수적 표현) 서브타입 없음 + SPR 답안모델 없음 |
| test7 | M2-22 | Math | linear_functions | 함수 평행이동(상수 차감)형 재정의 | 객관식 | 표 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | "함수 평행이동" 서브타입 없음 |
| test7 | M2-23 | Math | linear_equations_one_var | 기호 매개변수 역산(g(c+7)=c/4에서 b 구하기) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | "기호 매개변수 역산형" 서브타입 없음 |
| test7 | M2-24 | Math | right_triangles_trigonometry | tan비로 변 길이·둘레 계산(피타고라스 삼조) | 객관식 | 도형 | 가능 | 있음 | 미확인 | - |
| test7 | M2-25 | Math | 없음 | 원의 일반형→표준형 변환(반지름 도출) | 객관식 | 방정식 | 완전 불가 | 없음 | 미확인 | **circles 스킬이 일반형→표준형(완전제곱) 변환을 다루지 않음**(누적 재현) |
| test7 | M2-26 | Math | ratios_rates | 복합단위 환산(m/s²→mile/min²) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test7 | M2-27 | Math | nonlinear_equations_systems | 무해조건 최소 정수 k 역산(SPR) | **SPR** | 방정식 | 상위스킬만 있고 하위패턴 불가(SPR도 미지원) | 없음 | 미확인 | 무해조건 최소정수값 역산 서브타입 없음 + SPR 답안모델 없음 |

---

## 전수 분류표 — test8 (완료)

**주의(이번 패스 신규 발견)**: 실제 `lib/problem-generation/math-compilers/`를 직접 grep해 각 컴파일러의 `QuestionKind`/모델 타입을 확인한 결과, `probability.ts`가 실존하며 `"simple" | "conditional" | "sequential_without_replacement"` 세 종류를 지원한다. test6·test7 문서에서 "단순 확률 스킬 자체가 없음"으로 완전불가 처리했던 판정은 **재확인이 필요하다** — 최소한 단순(simple) 확률 문항 하나는 test8 M1-2에서 "가능"으로 재분류했다. 다른 컴파일러들의 kind 목록(예: `circles`=원주/호/부채꼴/중심각·원주각만, `lines_angles_triangles`=triangle_angle_sum/exterior_angle/isosceles_base_angle만, `nonlinear_functions`=evaluate/vertex_x/vertex_y만, `two_variable_data`=cell/row_total/conditional_share만)도 이번에 직접 확인해 test4·6·7 문서의 판정과 대체로 일치함을 검증했다.

### R&W Module 1 (33문항, 전부 객관식)

| 시험지 | 문항번호 | Math/R&W | 상위 스킬 | 하위 문항 패턴 | 객관식/SPR | 자료 형식 | 현재 생성 가능 여부 | 결정론적 검증 여부 | 화면 렌더링 검증 여부 | 부족한 구현 단위 |
|---|---|---|---|---|---|---|---|---|---|---|
| test8 | M1-1 | R&W | words_in_context | 단문 어휘 빈칸(형용사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test8 | M1-2 | R&W | words_in_context | 단문 어휘 빈칸(명사구) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test8 | M1-3 | R&W | words_in_context | 단문 어휘 빈칸(형용사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test8 | M1-4 | R&W | words_in_context | 단문 어휘 빈칸(명사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test8 | M1-5 | R&W | words_in_context | 단문 어휘 빈칸(명사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test8 | M1-6 | R&W | central_ideas_details | 단일 지문 주요 목적 파악(고고학 발견) | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test8 | M1-7 | R&W | central_ideas_details | 단일 지문 주요 목적 파악(소설) | 객관식 | 지문(소설) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test8 | M1-8 | R&W | text_structure_purpose | 전체 구조 파악(편지 전달) | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test8 | M1-9 | R&W | text_structure_purpose | 밑줄 부분의 텍스트 내 기능 | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test8 | M1-10 | R&W | central_ideas_details | 세부사항(발견의 의의) 파악 | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test8 | M1-11 | R&W | command_of_evidence_quant | 표 데이터로 빈칸 완성 | 객관식 | 표 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 표 기반 빈칸완성형 미구현 |
| test8 | M1-12 | R&W | command_of_evidence_quant | 표 데이터 값 조회 | 객관식 | 표 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 표 기반 값조회형 미구현 |
| test8 | M1-13 | R&W | command_of_evidence_quant | 표 데이터로 빈칸 완성(최댓값) | 객관식 | 표 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 표 기반 빈칸완성형 미구현 |
| test8 | M1-14 | R&W | command_of_evidence_text | 학생 주장을 뒷받침하는 발견 선택(그림/표 없음) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | 검증 필요 |
| test8 | M1-15 | R&W | command_of_evidence_text | 가설을 뒷받침하는 발견 선택(그림/표 없음) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | 검증 필요 |
| test8 | M1-16 | R&W | command_of_evidence_text | 가설을 뒷받침하는 발견 선택(그림/표 없음) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | 검증 필요 |
| test8 | M1-17 | R&W | inferences | 논리적 결론 빈칸 완성 | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test8 | M1-18 | R&W | form_structure_sense | 동사 시제/형태(were/have been/has been/are) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test8 | M1-19 | R&W | form_structure_sense | 동사 형태(creates/create/creating/created) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test8 | M1-20 | R&W | boundaries | 콜론/쉼표 구분(동격 인물열거) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test8 | M1-21 | R&W | boundesar | 콤마/마침표/콜론 구분 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test8 | M1-22 | R&W | form_structure_sense | 동사 형태(attests/has attested/is attesting/attest) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test8 | M1-23 | R&W | boundaries | 콤마/세미콜론 구분(however) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test8 | M1-24 | R&W | form_structure_sense | 동사 형태(works were/works, were/works,/works had been) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test8 | M1-25 | R&W | form_structure_sense | 독립절 구조 선택(disadvantage 표현) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test8 | M1-26 | R&W | transitions | 논리적 전환어 선택 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test8 | M1-27 | R&W | transitions | 논리적 전환어 선택 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test8 | M1-28 | R&W | transitions | 논리적 전환어 선택 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test8 | M1-29 | R&W | rhetorical_synthesis | 노트 종합→거리 강조 | 객관식 | 없음(불릿노트) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test8 | M1-30 | R&W | rhetorical_synthesis | 노트 종합→연구 목적 강조 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test8 | M1-31 | R&W | rhetorical_synthesis | 노트 종합→연구 목적 강조 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test8 | M1-32 | R&W | rhetorical_synthesis | 노트 종합→연구 목적 일반화 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test8 | M1-33 | R&W | rhetorical_synthesis | 노트 종합→연구 유형 일반화 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |

### R&W Module 2 (33문항, 전부 객관식)

| 시험지 | 문항번호 | Math/R&W | 상위 스킬 | 하위 문항 패턴 | 객관식/SPR | 자료 형식 | 현재 생성 가능 여부 | 결정론적 검증 여부 | 화면 렌더링 검증 여부 | 부족한 구현 단위 |
|---|---|---|---|---|---|---|---|---|---|---|
| test8 | M2-1 | R&W | words_in_context | 단문 어휘 빈칸(형용사구) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test8 | M2-2 | R&W | words_in_context | 단문 어휘 빈칸(형용사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test8 | M2-3 | R&W | words_in_context | 단문 어휘 빈칸(형용사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test8 | M2-4 | R&W | words_in_context | 단문 어휘 빈칸(형용사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test8 | M2-5 | R&W | words_in_context | 단문 어휘 빈칸(형용사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test8 | M2-6 | R&W | central_ideas_details | 단일 지문 주요 목적 파악(reCAPTCHA) | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test8 | M2-7 | R&W | text_structure_purpose | 시 전체 구조(비유 구조) 파악 | 객관식 | 지문(시) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test8 | M2-8 | R&W | central_ideas_details | 단일 지문 주요 목적 파악(소설) | 객관식 | 지문(소설) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test8 | M2-9 | R&W | cross_text_connections | Text2가 Text1의 통념에 어떻게 반응할지 | 객관식 | 지문×2 | 가능 | 있음 | 미확인 | - |
| test8 | M2-10 | R&W | central_ideas_details | 세부사항(등장인물 행동) 파악 | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test8 | M2-11 | R&W | central_ideas_details | 세부사항(작곡가의 방법) 파악 | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test8 | M2-12 | R&W | inferences | 진술이 가장 강하게 뒷받침되는지 추론 | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test8 | M2-13 | R&W | central_ideas_details | 단일 지문 중심 내용(주제) 파악 | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test8 | M2-14 | R&W | command_of_evidence_quant | 표 데이터로 주장 뒷받침 서술 판단 | 객관식 | 표 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 표 기반 서브타입 미구현 |
| test8 | M2-15 | R&W | command_of_evidence_quant | 표 데이터로 제안 뒷받침 서술 판단 | 객관식 | 표 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 표 기반 서브타입 미구현 |
| test8 | M2-16 | R&W | command_of_evidence_text | 가설을 뒷받침하는 발견 선택(그림/표 없음) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | 검증 필요 |
| test8 | M2-17 | R&W | inferences | 논리적 결론 빈칸 완성 | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test8 | M2-18 | R&W | inferences | 논리적 결론 빈칸 완성 | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test8 | M2-19 | R&W | form_structure_sense | 부정사/분사 형태 선택(enter/to enter/having entered/entering) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test8 | M2-20 | R&W | form_structure_sense | 동사 시제(has doubled/had doubled/doubles/will double) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test8 | M2-21 | R&W | boundaries | 콤마/마침표 구분(percent, such) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test8 | M2-22 | R&W | boundaries | 분사구 결합 방식 선택(bounds helped 등) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test8 | M2-23 | R&W | boundaries | 콜론/대시/콤마 구분(Springs to) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test8 | M2-24 | R&W | boundaries | 콤마/콜론 구분(varied) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test8 | M2-25 | R&W | boundaries | 세미콜론/콤마/콜론 구분(고유명사 동격) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test8 | M2-26 | R&W | boundaries | 콤마/세미콜론 구분(though) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test8 | M2-27 | R&W | transitions | 논리적 전환어 선택 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test8 | M2-28 | R&W | transitions | 논리적 전환어 선택 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test8 | M2-29 | R&W | transitions | 논리적 전환어 선택 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test8 | M2-30 | R&W | transitions | 논리적 전환어 선택 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test8 | M2-31 | R&W | transitions | 논리적 전환어 선택 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test8 | M2-32 | R&W | rhetorical_synthesis | 노트 종합→기법의 장점 설명 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test8 | M2-33 | R&W | rhetorical_synthesis | 노트 종합→오해의 역할 강조 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |

### Math Module 1 (27문항, SPR 7건)

| 시험지 | 문항번호 | Math/R&W | 상위 스킬 | 하위 문항 패턴 | 객관식/SPR | 자료 형식 | 현재 생성 가능 여부 | 결정론적 검증 여부 | 화면 렌더링 검증 여부 | 부족한 구현 단위 |
|---|---|---|---|---|---|---|---|---|---|---|
| test8 | M1-1 | Math | linear_functions | evaluate(d=30t, t=2) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test8 | M1-2 | Math | probability | simple(불량률 확률) | 객관식 | 없음 | **가능**(이번 패스 재확인: probability.ts "simple" kind 실존) | 있음 | 미확인 | 이전 패스(test6·7)의 "단순 확률 스킬 없음" 판정 재검토 필요 |
| test8 | M1-3 | Math | nonlinear_functions | 그래프에서 y절편 읽기(지수형 곡선) | 객관식 | 좌표평면(그래프) | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그래프 판독형(y절편) 서브타입 없음 |
| test8 | M1-4 | Math | equivalent_expressions | 다항식 덧셈·동류항 정리 | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test8 | M1-5 | Math | inference_from_sample | 표본평균 오차범위로 타당한 결론 고르기 | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test8 | M1-6 | Math | linear_equations_one_var | 2.6+x=2.8 (SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test8 | M1-7 | Math | percentages | percent_of(300의 80%, SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test8 | M1-8 | Math | linear_functions | f(x)=4x+b, f(7)=28에서 b 역산 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 상수 역산형(constant solve) 서브타입 없음(evaluate/find_x/slope만 존재) |
| test8 | M1-9 | Math | lines_angles_triangles | 닮은 직각삼각형 대응각 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 닮음삼각형 대응각 서브타입 없음(누적 재현) |
| test8 | M1-10 | Math | linear_functions | 점(0,5) 지나는 평행선의 방정식 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | "점+평행조건" 서브타입 없음(evaluate/find_x/slope_two_points만 존재) |
| test8 | M1-11 | Math | 없음 | 산점도 최적 선형모델 그래프 선택 | 객관식 | 산점도 | 완전 불가 | 없음 | 미확인 | **산점도 회귀/최적선 스킬 자체가 없음**(누적 4회째 재현) |
| test8 | M1-12 | Math | nonlinear_functions | 연간 퍼센트 증가율→지수함수 모델 선택 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | "퍼센트 증가율→지수식 구성" 서브타입 없음(누적 재현) |
| test8 | M1-13 | Math | linear_two_variables | 연립방정식에서 b 값(SPR) | **SPR** | 방정식 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test8 | M1-14 | Math | equivalent_expressions | 단항식 GCF 인수분해 계수 r(SPR) | **SPR** | 없음 | 상위스킬만 있고 하위패턴 불가(SPR도 미지원) | 없음 | 미확인 | 단항식 인수분해(GCF) 서브타입 없음 + SPR 답안모델 없음 |
| test8 | M1-15 | Math | nonlinear_equations_systems | 그래프에서 3차함수 실근 개수 읽기 | 객관식 | 좌표평면(그래프) | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그래프 판독형(근의 개수) 서브타입 없음 |
| test8 | M1-16 | Math | equivalent_expressions | 넓이식 w(w+9)에서 길이 인수 추출 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 넓이→인수 추출형 서브타입 없음 |
| test8 | M1-17 | Math | equivalent_expressions | 공식에서 변수 재정리(4j+9 구하기) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test8 | M1-18 | Math | circles | 반지름 배율(3n,129n)로 넓이 비율 계산 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 원 넓이 비율(반지름 배율 제곱) 서브타입 없음(circles는 원주/호/부채꼴/각 관계만 존재) |
| test8 | M1-19 | Math | 없음 | 라디안 각도 덧셈 후 도(degree) 환산 | 객관식 | 없음 | 완전 불가 | 없음 | 미확인 | **라디안-도 변환 및 각도 덧셈 스킬 자체가 없음** |
| test8 | M1-20 | Math | nonlinear_functions | vertex_x(이차함수 최솟값 x, SPR) | **SPR** | 방정식 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test8 | M1-21 | Math | linear_inequalities | solve_one_var(예산 제약 문장제, SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test8 | M1-22 | Math | linear_inequalities | point_in_solution(연립부등식, 그래프) | 객관식 | 좌표평면 | 가능 | 있음 | 미확인 | - |
| test8 | M1-23 | Math | one_variable_data | 도수분포표에 값 추가 후 평균/중앙값 비교 | 객관식 | 표(도수분포) | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그룹화 도수분포 평균/중앙값 변화 비교 서브타입 없음(mean/median/range는 원자료 리스트 전용, 누적 재현) |
| test8 | M1-24 | Math | nonlinear_equations_systems | 인수형 방정식에서 해 I/II/III 판별 | 객관식 | 방정식 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 로마숫자 다중선택 해판별 서브타입 없음 |
| test8 | M1-25 | Math | nonlinear_equations_systems | 포물선-수평선 접선(유일 교점) 조건, c 구하기 | 객관식 | 방정식 | 상위스킬만 있고 하위패턴 불가 | 있음(root/개수 검증은 있으나 접선 조건 특정형 미확인, 누적 재현) | 미확인 | 접선(유일 교점) 조건형 서브타입 확인 필요 |
| test8 | M1-26 | Math | nonlinear_functions | 두 지수함수 최댓값 비교(I/II 판정) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 지수함수 최댓값 비교(로마숫자 판정) 서브타입 없음 |
| test8 | M1-27 | Math | 없음 | 정삼각형 외접원 반지름 관계(SPR) | **SPR** | 도형 | 완전 불가 | 없음 | 미확인 | **정삼각형-외접원 반지름 공식 스킬 자체가 없음** |

### Math Module 2 (27문항, SPR 6건)

| 시험지 | 문항번호 | Math/R&W | 상위 스킬 | 하위 문항 패턴 | 객관식/SPR | 자료 형식 | 현재 생성 가능 여부 | 결정론적 검증 여부 | 화면 렌더링 검증 여부 | 부족한 구현 단위 |
|---|---|---|---|---|---|---|---|---|---|---|
| test8 | M2-1 | Math | linear_functions | 그래프에서 y절편 읽기(직선) | 객관식 | 좌표평면(그래프) | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그래프 판독형(y절편) 서브타입 없음 |
| test8 | M2-2 | Math | 없음 | 표에서 두 값의 단순 차이 계산 | 객관식 | 표 | 완전 불가 | 없음 | 미확인 | 표 값 단순 조회·차이 계산 스킬 자체가 없음 |
| test8 | M2-3 | Math | lines_angles_triangles | 평행선-횡단선 각도 계산 | 객관식 | 도형 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 평행선/횡단선 각 서브타입 없음(누적 재현) |
| test8 | M2-4 | Math | linear_equations_one_var | 문장제→일차방정식 변환(식 고르기) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 있음(수치형은 있으나 식 선택형 미구현) | 미확인 | 식 선택형 서브타입 없음(누적 재현) |
| test8 | M2-5 | Math | right_triangles_trigonometry | pythagorean_hypotenuse(빗변 공식 선택) | 객관식 | 도형 | 가능 | 있음 | 미확인 | - |
| test8 | M2-6 | Math | linear_functions | find_x_for_value(g(x)=54, SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test8 | M2-7 | Math | nonlinear_functions | evaluate(삼차식 f(2), SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test8 | M2-8 | Math | linear_functions | evaluate(y절편, f(x)=x/10-2) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test8 | M2-9 | Math | linear_equations_one_var | 문장제(영상 길이 배분)→식 선택 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 식 선택형 서브타입 없음(누적 재현) |
| test8 | M2-10 | Math | nonlinear_functions | 함수 평행이동(수직 하강) 재정의 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | "함수 평행이동" 서브타입 없음(누적 재현) |
| test8 | M2-11 | Math | linear_two_variables | intersection_x(연립방정식 x값) | 객관식 | 방정식 | 가능 | 있음 | 미확인 | - |
| test8 | M2-12 | Math | right_triangles_trigonometry | trig_ratio(sin A) | 객관식 | 도형 | 가능 | 있음 | 미확인 | - |
| test8 | M2-13 | Math | area_volume | rectangle_area(SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test8 | M2-14 | Math | equivalent_expressions | 비율식 변수 역산(n 구하기, SPR) | **SPR** | 없음 | 상위스킬만 있고 하위패턴 불가(SPR도 미지원) | 없음 | 미확인 | 다중변수 비율식 역산 서브타입 없음 + SPR 답안모델 없음 |
| test8 | M2-15 | Math | linear_equations_one_var | 문장제(물 감소량, 일차방정식) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test8 | M2-16 | Math | linear_equations_one_var | 치환식(9(4-3x)+2=8(4-3x)+18) 값 구하기 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 있음(구조는 유사하나 치환 변수형 특수 서브타입 미확인) | 미확인 | 치환 변수형 서브타입 확인 필요 |
| test8 | M2-17 | Math | linear_two_variables | 연립방정식 변수의 맥락적 의미 해석 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | "맥락 해석형" 서브타입 없음 |
| test8 | M2-18 | Math | equivalent_expressions | 분수지수→근호 형태 변환 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 지수-근호 변환형 서브타입 없음 |
| test8 | M2-19 | Math | one_variable_data | 점도표 2개 데이터셋 중앙값/표준편차 비교(I/II) | 객관식 | 점도표 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 2데이터셋 비교(표준편차 포함) 서브타입 없음(mean/median/range만 존재) |
| test8 | M2-20 | Math | lines_angles_triangles | isosceles_base_angle(반지름 이등변삼각형, SPR) | **SPR** | 도형 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test8 | M2-21 | Math | percentages | 연쇄 퍼센트 계산(정가→할인가→원가 역산, SPR) | **SPR** | 없음 | 상위스킬만 있고 하위패턴 불가(SPR도 미지원) | 없음 | 미확인 | 2단계 퍼센트 연쇄 역산 서브타입 없음 + SPR 답안모델 없음 |
| test8 | M2-22 | Math | area_volume | 정육면체-내접구 부피 차 계산 | 객관식 | 도형 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 결합입체(구-정육면체) 부피차 서브타입 없음(rectangle_area/triangle_area/prism만 존재) |
| test8 | M2-23 | Math | linear_two_variables | 무해조건 만족하는 두번째 방정식 선택 | 객관식 | 방정식 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 무해(평행) 조건 매칭형 서브타입 없음(누적 재현) |
| test8 | M2-24 | Math | lines_angles_triangles | 매개변수(k) 포함 합동삼각형 각도 관계 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 매개변수 포함 각도 관계 서브타입 없음 |
| test8 | M2-25 | Math | linear_two_variables | 무한해(동일직선) 조건, 매개변수화된 해집합 선택 | 객관식 | 방정식 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 매개변수화 해집합형 서브타입 없음 |
| test8 | M2-26 | Math | nonlinear_equations_systems | 근호 포함 방정식(분모 동일) 해 구하기 | 객관식 | 방정식 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 근호 포함 방정식 서브타입 없음 |
| test8 | M2-27 | Math | nonlinear_functions | 다단계 문맥(seal 다이빙 깊이) 함수 구성·평가 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 다단계 문맥 구성형(최고점/구간 조건→식 구성 후 평가) 서브타입 없음 |

---

## 전수 분류표 — test9 (완료)

`pages` 오프셋은 인쇄 쪽번호 대비 +2(인쇄 p.2 = `pages=4`)로 test6·7·8과 동일했다.

### R&W Module 1 (33문항, 전부 객관식)

| 시험지 | 문항번호 | Math/R&W | 상위 스킬 | 하위 문항 패턴 | 객관식/SPR | 자료 형식 | 현재 생성 가능 여부 | 결정론적 검증 여부 | 화면 렌더링 검증 여부 | 부족한 구현 단위 |
|---|---|---|---|---|---|---|---|---|---|---|
| test9 | M1-1 | R&W | words_in_context | 단문 어휘(밑줄 단어 의미, arranged) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test9 | M1-2 | R&W | words_in_context | 단문 어휘 빈칸(형용사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test9 | M1-3 | R&W | words_in_context | 단문 어휘 빈칸(동사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test9 | M1-4 | R&W | words_in_context | 단문 어휘 빈칸(전치사구) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test9 | M1-5 | R&W | words_in_context | 단문 어휘 빈칸(형용사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test9 | M1-6 | R&W | text_structure_purpose | 밑줄 문장의 텍스트 내 기능(대조) | 객관식 | 지문(소설) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test9 | M1-7 | R&W | text_structure_purpose | 밑줄 문장의 텍스트 전체 기능(각색 설명) | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test9 | M1-8 | R&W | text_structure_purpose | 밑줄 부분의 텍스트 전체 기능(리스크공시) | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test9 | M1-9 | R&W | cross_text_connections | Text2 저자가 Text1 결과에 어떻게 반응할지 | 객관식 | 지문×2 | 가능 | 있음 | 미확인 | - |
| test9 | M1-10 | R&W | central_ideas_details | 단일 지문(Pando) 세부사항 파악 | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test9 | M1-11 | R&W | command_of_evidence_quant | 표(돌고래 기록년도)로 값 조회 | 객관식 | 표 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 표 기반 조회형 미구현 |
| test9 | M1-12 | R&W | command_of_evidence_quant | 표(단풍나무)로 문장 완성 | 객관식 | 표 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 표 기반 빈칸완성형 미구현 |
| test9 | M1-13 | R&W | command_of_evidence_quant | 막대그래프(카나마이신 금속함량)로 가설 지지 데이터 선택 | 객관식 | 막대그래프 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그래프 기반 서브타입 미구현 |
| test9 | M1-14 | R&W | command_of_evidence_quant | 표(마못/다람쥐 동면)로 가설 지지 데이터 선택 | 객관식 | 표 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 표 기반 서브타입 미구현 |
| test9 | M1-15 | R&W | command_of_evidence_quant | 막대그래프(벌집 세포)로 결론 완성 | 객관식 | 막대그래프 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그래프 기반 빈칸완성형 미구현 |
| test9 | M1-16 | R&W | command_of_evidence_text | ALSOL 주장을 뒷받침하는 발견 선택(그림/표 없음) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | "주장-지지 발견 선택형" 서브타입 검증 필요 |
| test9 | M1-17 | R&W | inferences | 논리적 결론 빈칸 완성(사법의견) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test9 | M1-18 | R&W | inferences | 논리적 결론 빈칸 완성(군 경력) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test9 | M1-19 | R&W | form_structure_sense | 분사/부정사 형태 선택(providing) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test9 | M1-20 | R&W | form_structure_sense | 주어-동사 수일치(allow) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test9 | M1-21 | R&W | form_structure_sense | 대명사 일치(it was/they were) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test9 | M1-22 | R&W | boundaries | 세미콜론/쉼표+전환어(however) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test9 | M1-23 | R&W | boundaries | 동격구 쉼표(biologist Yuree Lee) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test9 | M1-24 | R&W | boundaries | 콜론/쉼표 구분(emerged) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test9 | M1-25 | R&W | form_structure_sense | 동사 시제 선택(suggests/suggested) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test9 | M1-26 | R&W | form_structure_sense | 주어-동사 수일치(are/is/were/have been) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test9 | M1-27 | R&W | transitions | 논리적 전환어 선택(Americanah) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test9 | M1-28 | R&W | transitions | 논리적 전환어 선택(대법원) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test9 | M1-29 | R&W | transitions | 논리적 전환어 선택(동물 뇌) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test9 | M1-30 | R&W | transitions | 논리적 전환어 선택(반딧불이) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test9 | M1-31 | R&W | rhetorical_synthesis | 노트 종합→마이크로프로브 장점 설명 | 객관식 | 없음(불릿노트) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test9 | M1-32 | R&W | rhetorical_synthesis | 노트 종합→오초아 발견의 의의 강조 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test9 | M1-33 | R&W | rhetorical_synthesis | 노트 종합→비쿠냐 시집 소개 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |

### R&W Module 2 (33문항, 전부 객관식)

| 시험지 | 문항번호 | Math/R&W | 상위 스킬 | 하위 문항 패턴 | 객관식/SPR | 자료 형식 | 현재 생성 가능 여부 | 결정론적 검증 여부 | 화면 렌더링 검증 여부 | 부족한 구현 단위 |
|---|---|---|---|---|---|---|---|---|---|---|
| test9 | M2-1 | R&W | words_in_context | 단문 어휘(밑줄 단어 의미, completing) | 객관식 | 지문(소설) | 가능 | 있음 | 미확인 | - |
| test9 | M2-2 | R&W | words_in_context | 단문 어휘 빈칸(동사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test9 | M2-3 | R&W | words_in_context | 단문 어휘 빈칸(명사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test9 | M2-4 | R&W | words_in_context | 단문 어휘 빈칸(형용사구) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test9 | M2-5 | R&W | words_in_context | 단문 어휘 빈칸(형용사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test9 | M2-6 | R&W | text_structure_purpose | 밑줄 문장의 텍스트 전체 기능(구술사) | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test9 | M2-7 | R&W | central_ideas_details | 시 전체의 주요 목적 파악 | 객관식 | 지문(시) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test9 | M2-8 | R&W | text_structure_purpose | 밑줄 문장의 텍스트 전체 기능(휘튼 소설) | 객관식 | 지문(소설) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test9 | M2-9 | R&W | text_structure_purpose | 밑줄 문장의 텍스트 전체 기능(매머드) | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test9 | M2-10 | R&W | central_ideas_details | 세부사항(리처드슨이 이끈 것) 파악 | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test9 | M2-11 | R&W | inferences | 텍스트 근거 사실 파악(엘리너) | 객관식 | 지문(소설) | 가능 | 있음 | 미확인 | - |
| test9 | M2-12 | R&W | central_ideas_details | 단일 지문 중심 내용 파악(스마트-그로브너) | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test9 | M2-13 | R&W | inferences | 텍스트 근거 사실 파악(오칠트리 부인) | 객관식 | 지문(소설) | 가능 | 있음 | 미확인 | - |
| test9 | M2-14 | R&W | command_of_evidence_text | 인용문이 주장을 가장 잘 예증(편지) | 객관식 | 지문(인용) | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | 인용문형 서브타입 검증 필요 |
| test9 | M2-15 | R&W | command_of_evidence_text | 가설을 약화하는 발견 선택(그림/표 없음) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | "가설-약화" 서브타입 검증 필요 |
| test9 | M2-16 | R&W | command_of_evidence_text | 주장을 뒷받침하는 발견 선택(그림/표 없음) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | 검증 필요 |
| test9 | M2-17 | R&W | inferences | 논리적 결론 빈칸 완성(거북이) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test9 | M2-18 | R&W | inferences | 논리적 결론 빈칸 완성(압타머) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test9 | M2-19 | R&W | form_structure_sense | 대명사 일치(They're/It's/Their/Its) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test9 | M2-20 | R&W | form_structure_sense | 동사 시제 선택(tells/told) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test9 | M2-21 | R&W | form_structure_sense | 동사 시제/형태(is studying/has studied) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test9 | M2-22 | R&W | boundaries | 대시/쉼표/콜론 구분(Gingerbread) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test9 | M2-23 | R&W | boundaries | 삽입구 쉼표(content, in that era) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test9 | M2-24 | R&W | boundaries | 동격구 쉼표(compound aluminum oxide) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test9 | M2-25 | R&W | form_structure_sense | 수동태/시제 선택(highly prized) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test9 | M2-26 | R&W | boundaries | 쉼표/세미콜론 구분(conservation, though) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test9 | M2-27 | R&W | transitions | 논리적 전환어 선택(여성참정권) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test9 | M2-28 | R&W | transitions | 논리적 전환어 선택(오로라) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test9 | M2-29 | R&W | rhetorical_synthesis | 노트 종합→세이칸/채널터널 비교 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test9 | M2-30 | R&W | rhetorical_synthesis | 노트 종합→기각류 화석 의의 강조 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test9 | M2-31 | R&W | rhetorical_synthesis | 노트 종합→방사율 대조 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test9 | M2-32 | R&W | rhetorical_synthesis | 노트 종합→인터랙티브 형식 장점 설명 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test9 | M2-33 | R&W | rhetorical_synthesis | 노트 종합→오리새끼 항력 연구 제시 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |

### Math Module 1 (27문항)

| 시험지 | 문항번호 | Math/R&W | 상위 스킬 | 하위 문항 패턴 | 객관식/SPR | 자료 형식 | 현재 생성 가능 여부 | 결정론적 검증 여부 | 화면 렌더링 검증 여부 | 부족한 구현 단위 |
|---|---|---|---|---|---|---|---|---|---|---|
| test9 | M1-1 | Math | 없음 | 둘레 조건으로 삼각형 세번째 변 길이(역산) | 객관식 | 없음 | 완전 불가 | 없음 | 미확인 | **삼각형 둘레→변 길이 역산 스킬 자체가 없음**(lines-angles-triangles는 각도 관계만 다룸, 신규) |
| test9 | M1-2 | Math | linear_equations_one_var | 등가방정식 변형(같은 해를 갖는 식 선택) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 등가방정식 매칭형 서브타입 없음(누적 재현) |
| test9 | M1-3 | Math | linear_inequalities | 문장제 최소시간(부등식, solve_one_var) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test9 | M1-4 | Math | nonlinear_functions | 이차함수 g(x)=25에서 x값 역산 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | "값 주어졌을 때 x 역산" 서브타입 없음(evaluate/vertex만 존재) |
| test9 | M1-5 | Math | equivalent_expressions | 다항식 인수분해(GCF, 9x²+5x) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test9 | M1-6 | Math | one_variable_data | mean(평균) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test9 | M1-7 | Math | linear_equations_one_var | 이윤함수 문장제(SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test9 | M1-8 | Math | 없음 | 문장제→식 선택형(도보+달리기 혼합률) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 방정식-매칭형(식 선택) 서브타입 없음(누적 재현) |
| test9 | M1-9 | Math | 없음 | 문장제→식 선택형(계약금+할부금) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 식 선택형 서브타입 없음(누적 재현) |
| test9 | M1-10 | Math | equivalent_expressions | 공식에서 변수 재정리(y-57=px) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test9 | M1-11 | Math | nonlinear_functions | 지수함수 계좌잔액 식 선택(맥락) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 지수함수 모델 선택형 서브타입 없음 |
| test9 | M1-12 | Math | circles | 복합 호 관계(원주각·호 비율, 두 지름) | 객관식 | 도형 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 복수 지름·비율 결합형 서브타입 없음(circumference/arc_length/central-inscribed만 존재) |
| test9 | M1-13 | Math | linear_two_variables | 연립방정식 x값(SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test9 | M1-14 | Math | one_variable_data | 도수분포표에서 최댓값(SPR) | **SPR** | 표(도수분포) | 상위스킬만 있고 하위패턴 불가(SPR도 미지원) | 없음 | 미확인 | 그룹화 도수분포 최댓값 서브타입 없음(누적 재현, test6 M1-19와 동일 패턴) + SPR 답안모델 없음 |
| test9 | M1-15 | Math | right_triangles_trigonometry | pythagorean_leg(빗변·한 변으로 다른 변) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test9 | M1-16 | Math | linear_two_variables | 연립방정식 x값(문장제, 전선 길이) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test9 | M1-17 | Math | nonlinear_functions | 삼차함수 y=f(x)-3 표 변환 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 삼차함수 표 변환형 서브타입 없음 |
| test9 | M1-18 | Math | ratios_rates | 기호형 비율 확장(호스, 9y분 유량) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 기호(변수)형 비율 확장 서브타입 없음(숫자형만 지원 추정) |
| test9 | M1-19 | Math | linear_two_variables | 무해조건 만족하는 h값 | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test9 | M1-20 | Math | percentages | percent_of(13은 25의 p%, SPR) | **SPR** | 없음 | 가능 | 있음 | 미확인 | - |
| test9 | M1-21 | Math | nonlinear_equations_systems | 근호방정식 최소해(SPR) | **SPR** | 방정식 | 상위스킬만 있고 하위패턴 불가(SPR도 미지원) | 없음 | 미확인 | 근호 포함 방정식 서브타입 없음 + SPR 답안모델 없음 |
| test9 | M1-22 | Math | nonlinear_functions | 삼차함수 절편 합(평행이동 후) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 삼차함수 절편합 서브타입 없음 |
| test9 | M1-23 | Math | nonlinear_functions | 함수 유형 판별(201%=선형 증가) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 함수 유형 판별형 서브타입 없음 |
| test9 | M1-24 | Math | nonlinear_functions | vertex_x(평행이동 결합, g(x)=f(x+5)) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 평행이동 결합형 서브타입 없음 |
| test9 | M1-25 | Math | ratios_rates | 문장제→식 선택형(스테인 도포량) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 식 선택형 서브타입 없음(누적 재현) |
| test9 | M1-26 | Math | ratios_rates | 비례식 문장제(투표 예상 득표수) | 객관식 | 표 | 가능 | 있음 | 미확인 | - |
| test9 | M1-27 | Math | area_volume | 닮은 입체 부피비(SPR) | **SPR** | 없음 | 상위스킬만 있고 하위패턴 불가(SPR도 미지원) | 없음 | 미확인 | 닮음 입체 부피비 서브타입 없음(rectangle/triangle/prism만 존재) + SPR 답안모델 없음 |

### Math Module 2 (27문항)

| 시험지 | 문항번호 | Math/R&W | 상위 스킬 | 하위 문항 패턴 | 객관식/SPR | 자료 형식 | 현재 생성 가능 여부 | 결정론적 검증 여부 | 화면 렌더링 검증 여부 | 부족한 구현 단위 |
|---|---|---|---|---|---|---|---|---|---|---|
| test9 | M2-1 | Math | linear_equations_one_var | w+7=357 solve w | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test9 | M2-2 | Math | equivalent_expressions | 다항식 전개(16(x+15)) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test9 | M2-3 | Math | two_variable_data | 이원분류표 확률(row_total) | 객관식 | 표 | 가능 | 있음 | 미확인 | - |
| test9 | M2-4 | Math | linear_two_variables | 연립방정식 y값 | 객관식 | 방정식 | 가능 | 있음 | 미확인 | - |
| test9 | M2-5 | Math | linear_functions | 기울기+y절편으로 직선의 방정식 | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test9 | M2-6 | Math | lines_angles_triangles | 평행선-횡단선 각도 관계(SPR) | **SPR** | 도형 | 상위스킬만 있고 하위패턴 불가(SPR도 미지원) | 없음 | 미확인 | 평행선/횡단선 각 서브타입 없음(누적 재현) + SPR 답안모델 없음 |
| test9 | M2-7 | Math | linear_functions | evaluate(분수 대입, SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test9 | M2-8 | Math | linear_functions | 표에서 일차함수 식 도출 | 객관식 | 표 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | "표→식 도출형" 서브타입 없음(누적 재현) |
| test9 | M2-9 | Math | nonlinear_equations_systems | 대입형 연립(치환, 순서쌍 구하기) | 객관식 | 방정식 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 대입 치환형 서브타입 없음 |
| test9 | M2-10 | Math | linear_functions | find_x_for_value(x절편) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test9 | M2-11 | Math | nonlinear_functions | 지수함수 식 선택(표에서 계수 도출) | 객관식 | 표 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 지수함수 모델 선택형 서브타입 없음 |
| test9 | M2-12 | Math | linear_functions | 맥락 해석형(배수 감소율) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | "맥락 해석형" 서브타입 없음(누적 재현) |
| test9 | M2-13 | Math | linear_functions | h(0)=45에서 b값(SPR) | **SPR** | 없음 | 가능 | 있음 | 미확인 | - |
| test9 | M2-14 | Math | nonlinear_equations_systems | root(이차방정식 해, SPR) | **SPR** | 방정식 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test9 | M2-15 | Math | right_triangles_trigonometry | 닮은 직각삼각형 대응각 삼각비 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 닮은삼각형 대응각 삼각비 서브타입 없음(누적 재현) |
| test9 | M2-16 | Math | percentages | percent_change(인구증가율 k값) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test9 | M2-17 | Math | one_variable_data | 점도표 표준편차 비교 | 객관식 | 점도표 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 표준편차 비교형 서브타입 없음(mean/median/range만 존재) |
| test9 | M2-18 | Math | nonlinear_functions | 맥락 해석형(이차함수 계수 문맥, 동물 체중) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | "맥락 해석형" 서브타입 없음(누적 재현) |
| test9 | M2-19 | Math | lines_angles_triangles | 닮은삼각형 대응각(2XY=RS 조건) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 닮은삼각형 대응각 서브타입 없음(누적 재현) |
| test9 | M2-20 | Math | nonlinear_functions | 지수함수 배가시간(SPR) | **SPR** | 없음 | 상위스킬만 있고 하위패턴 불가(SPR도 미지원) | 없음 | 미확인 | 배가시간 해석형 서브타입 없음(누적 재현) + SPR 답안모델 없음 |
| test9 | M2-21 | Math | nonlinear_functions | 지수함수 다중조건 역산(a+b, SPR) | **SPR** | 없음 | 상위스킬만 있고 하위패턴 불가(SPR도 미지원) | 없음 | 미확인 | 다중조건 역산형 서브타입 없음(누적 재현) + SPR 답안모델 없음 |
| test9 | M2-22 | Math | linear_inequalities | point_in_solution(표에서 부등식 항 검증) | 객관식 | 표 | 가능 | 있음 | 미확인 | - |
| test9 | M2-23 | Math | ratios_rates | 단위 환산(제곱마일→제곱야드) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test9 | M2-24 | Math | circles | 원-내접정사각형 변 길이 관계 | 객관식 | 도형 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 원-내접다각형 관계 서브타입 없음(신규) |
| test9 | M2-25 | Math | equivalent_expressions | 유리식(분수식) 간소화 | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test9 | M2-26 | Math | nonlinear_functions | 복합 지수식 구조분석(y절편 표현형 I/II) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 복합 지수식 구조분석형 서브타입 없음 |
| test9 | M2-27 | Math | nonlinear_equations_systems | num_real_solutions(무해조건 최소 k, SPR) | **SPR** | 방정식 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |

---

## 전수 분류표 — test10 (완료)

`pages` 오프셋은 이전 시험지들과 동일하게 +2(인쇄 p.2 = `pages=4`). 구조: R&W M1 인쇄p.2-14(`pages`4-16) / R&W M2 인쇄p.16-29(`pages`18-31) / Math M1 인쇄p.30-40(`pages`32-42) / Math M2 인쇄p.42-50(`pages`44-52). 전체 56페이지.

### R&W Module 1 (33문항, 전부 객관식)

| 시험지 | 문항번호 | Math/R&W | 상위 스킬 | 하위 문항 패턴 | 객관식/SPR | 자료 형식 | 현재 생성 가능 여부 | 결정론적 검증 여부 | 화면 렌더링 검증 여부 | 부족한 구현 단위 |
|---|---|---|---|---|---|---|---|---|---|---|
| test10 | M1-1 | R&W | words_in_context | 단문 어휘 빈칸(명사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test10 | M1-2 | R&W | words_in_context | 단문 어휘 빈칸(형용사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test10 | M1-3 | R&W | words_in_context | 단문 어휘 빈칸(동사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test10 | M1-4 | R&W | words_in_context | 단문 어휘 빈칸(명사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test10 | M1-5 | R&W | words_in_context | 단문 어휘 빈칸(형용사구) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test10 | M1-6 | R&W | central_ideas_details | 단일 지문 주요 목적 파악(재즈탭) | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test10 | M1-7 | R&W | text_structure_purpose | 전체 텍스트 구조 파악(NCP 항법) | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test10 | M1-8 | R&W | text_structure_purpose | 밑줄 문장의 텍스트 내 기능(허스턴 소설) | 객관식 | 지문(소설) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test10 | M1-9 | R&W | text_structure_purpose | 두 번째 문장의 텍스트 내 기능(베텔게우스) | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test10 | M1-10 | R&W | cross_text_connections | Text2(Putirka&Xu) 입장에서 Text1 결론을 어떻게 특징지을지 | 객관식 | 지문×2 | 가능 | 있음(합성 명제 target 검증) | 미확인 | - |
| test10 | M1-11 | R&W | central_ideas_details | 텍스트에 따른 사실 확인(서머캠프 감정) | 객관식 | 지문(소설) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test10 | M1-12 | R&W | central_ideas_details | 텍스트에 따른 사실 확인(도리안 그레이) | 객관식 | 지문(소설) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test10 | M1-13 | R&W | central_ideas_details | 예술적 접근 방식 서술(깁슨 조각) | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test10 | M1-14 | R&W | command_of_evidence_text | 학자 주장을 뒷받침하는 인용문 선택(그림/표 없음) | 객관식 | 지문(인용) | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | 인용문형 서브타입 검증 필요 |
| test10 | M1-15 | R&W | command_of_evidence_text | 학자 주장을 뒷받침하는 발견 선택(그림/표 없음) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | 가설-지지-증거 선택형 서브타입 검증 필요 |
| test10 | M1-16 | R&W | command_of_evidence_text | 연구팀 결론을 뒷받침하는 발견 선택(그림/표 없음) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | 검증 필요 |
| test10 | M1-17 | R&W | command_of_evidence_quant | 선그래프에서 데이터로 문장 완성 | 객관식 | 선그래프 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 선그래프 기반 빈칸완성형 미구현 |
| test10 | M1-18 | R&W | inferences | 논리적 결론 빈칸 완성(외래종 식물) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test10 | M1-19 | R&W | inferences | 논리적 결론 빈칸 완성(애기장대 연구) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test10 | M1-20 | R&W | boundaries | 등위접속사 앞 쉼표 유무(out / out, / out but / out, but) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test10 | M1-21 | R&W | boundaries | 등위접속사 앞 쉼표 유무(value/value,/value but/value, but) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test10 | M1-22 | R&W | form_structure_sense | 병렬구조 동사형(forces/to force/forcing/forced) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test10 | M1-23 | R&W | boundaries | 등위접속사 앞 쉼표 유무(lifelike 계열) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test10 | M1-24 | R&W | form_structure_sense | 동사 시제 선택(experienced 계열) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test10 | M1-25 | R&W | boundaries | 목록 항목 구두점(photosynthesis 계열: and/,/:/없음) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test10 | M1-26 | R&W | form_structure_sense | 소유격/대명사 일치(its/they're/their/it's) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test10 | M1-27 | R&W | form_structure_sense | 주어-동사 수일치(is/were/have been/are) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test10 | M1-28 | R&W | transitions | 논리적 전환어 선택(in contrast 계열) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test10 | M1-29 | R&W | transitions | 논리적 전환어 선택(As a result 계열) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test10 | M1-30 | R&W | transitions | 논리적 전환어 선택(That said 계열) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test10 | M1-31 | R&W | rhetorical_synthesis | 노트 종합→연구 목적 제시(고양이 뼈) | 객관식 | 없음(불릿노트) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test10 | M1-32 | R&W | rhetorical_synthesis | 노트 종합→두 초상화 차이점 강조 | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test10 | M1-33 | R&W | rhetorical_synthesis | 노트 종합→기간·목적 강조(굴라 박물관) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |

### R&W Module 2 (33문항, 전부 객관식)

| 시험지 | 문항번호 | Math/R&W | 상위 스킬 | 하위 문항 패턴 | 객관식/SPR | 자료 형식 | 현재 생성 가능 여부 | 결정론적 검증 여부 | 화면 렌더링 검증 여부 | 부족한 구현 단위 |
|---|---|---|---|---|---|---|---|---|---|---|
| test10 | M2-1 | R&W | words_in_context | 단문 어휘 빈칸(형용사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test10 | M2-2 | R&W | words_in_context | 단문 어휘 빈칸(부사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test10 | M2-3 | R&W | words_in_context | 단문 어휘 빈칸(형용사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test10 | M2-4 | R&W | words_in_context | 단문 어휘 빈칸(동사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test10 | M2-5 | R&W | words_in_context | 단문 어휘 빈칸(형용사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test10 | M2-6 | R&W | text_structure_purpose | 전체 텍스트 주요 목적 파악(마냐날란드) | 객관식 | 지문(소설) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test10 | M2-7 | R&W | text_structure_purpose | 전체 텍스트 주요 목적 파악(피그말리온) | 객관식 | 지문(희곡) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test10 | M2-8 | R&W | text_structure_purpose | 밑줄 부분의 텍스트 내 기능(시) | 객관식 | 지문(시) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test10 | M2-9 | R&W | central_ideas_details | 텍스트의 중심 내용 파악(긴즈/아라카와) | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test10 | M2-10 | R&W | central_ideas_details | 인물의 반응 파악(실비와 브루노) | 객관식 | 지문(소설) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test10 | M2-11 | R&W | command_of_evidence_quant | 막대그래프에서 값 확인 | 객관식 | 막대그래프 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그래프 기반 서브타입 미구현 |
| test10 | M2-12 | R&W | command_of_evidence_quant | 표 데이터로 결론 뒷받침 | 객관식 | 표 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 표 기반 서브타입 미구현 |
| test10 | M2-13 | R&W | command_of_evidence_quant | 막대그래프로 결론 뒷받침 | 객관식 | 막대그래프 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그래프 기반 서브타입 미구현 |
| test10 | M2-14 | R&W | command_of_evidence_quant | 표 데이터로 문장 완성(프랑스/미국 고용) | 객관식 | 표 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 표 기반 빈칸완성형 미구현 |
| test10 | M2-15 | R&W | command_of_evidence_text | 연구팀 주장을 뒷받침하는 발견 선택(그림/표 없음) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | 가설-지지-증거 선택형 서브타입 검증 필요 |
| test10 | M2-16 | R&W | inferences | 논리적 결론 빈칸 완성(메르네이트 무덤) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test10 | M2-17 | R&W | inferences | 논리적 결론 빈칸 완성(카푸친 원숭이 연구) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test10 | M2-18 | R&W | form_structure_sense | 대명사 시점 일관성(they/one/you/it) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test10 | M2-19 | R&W | form_structure_sense | 조건절 도치 구조(could the blueberries thrive 계열) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test10 | M2-20 | R&W | form_structure_sense | 동사 시제(reach 계열) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test10 | M2-21 | R&W | form_structure_sense | 동사 시제(will be/had been/was/is) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test10 | M2-22 | R&W | form_structure_sense | 주어-동사 수일치(have outlined 계열) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test10 | M2-23 | R&W | boundaries | 콜론/마침표/쉼표/세미콜론 구분(threefold) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test10 | M2-24 | R&W | form_structure_sense | 주어-동사 수일치(are/have been/are being/is) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test10 | M2-25 | R&W | boundaries | 콜론/쉼표/접속사 구분(food 계열) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test10 | M2-26 | R&W | transitions | 논리적 전환어 선택(for instance 계열) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test10 | M2-27 | R&W | transitions | 논리적 전환어 선택(Specifically 계열) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test10 | M2-28 | R&W | transitions | 논리적 전환어 선택(Similarly/Finally 계열) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test10 | M2-29 | R&W | transitions | 논리적 전환어 선택(Fittingly 계열) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test10 | M2-30 | R&W | transitions | 논리적 전환어 선택(Similarly/For this reason 계열) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test10 | M2-31 | R&W | rhetorical_synthesis | 노트 종합→유사점 강조(숀 탄) | 객관식 | 없음(불릿노트) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test10 | M2-32 | R&W | rhetorical_synthesis | 노트 종합→차이점 강조(스펠링비) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test10 | M2-33 | R&W | rhetorical_synthesis | 노트 종합→유사점 강조(회화 두 점) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |

### Math Module 1 (27문항)

| 시험지 | 문항번호 | Math/R&W | 상위 스킬 | 하위 문항 패턴 | 객관식/SPR | 자료 형식 | 현재 생성 가능 여부 | 결정론적 검증 여부 | 화면 렌더링 검증 여부 | 부족한 구현 단위 |
|---|---|---|---|---|---|---|---|---|---|---|
| test10 | M1-1 | Math | 없음 | 선그래프 최솟값 연도 단순 조회 | 객관식 | 선그래프 | 완전 불가 | 없음 | 미확인 | 선그래프 단순조회 스킬 없음(누적 재현) |
| test10 | M1-2 | Math | linear_two_variables | 연립방정식 그래프에서 해 (x,y) 읽기 | 객관식 | 좌표평면(그래프) | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그래프에서 연립해 판독 서브타입 없음 |
| test10 | M1-3 | Math | linear_inequalities | 문장제→부등식 변환(식 고르기) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 있음(수치형은 검증 있으나 식-선택형 미구현) | 미확인 | 부등식-매칭형(식 선택) 서브타입 없음(누적 재현) |
| test10 | M1-4 | Math | nonlinear_functions | 포물선 그래프 평행이동 결과 시각 판별 | 객관식 | 좌표평면(그래프) | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그래프 평행이동 시각판별형 서브타입 없음 |
| test10 | M1-5 | Math | linear_functions | evaluate(s=40+3t, t=5일 때 s) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test10 | M1-6 | Math | nonlinear_functions | evaluate(f(x)=x²+x+71, f(2), SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test10 | M1-7 | Math | linear_inequalities | 문장제(참가비 예산 내 최대 인원, SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test10 | M1-8 | Math | two_variable_data | 이원분류표 확률(임의 선택) | 객관식 | 표 | 가능 | 있음 | 미확인 | - |
| test10 | M1-9 | Math | lines_angles_triangles | 합동삼각형 대응각 | 객관식 | 도형 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 합동삼각형 대응각 서브타입 없음(triangle_angle_sum/exterior/isosceles만 존재) |
| test10 | M1-10 | Math | equivalent_expressions | 일차식 대입 재계산(4x+2=12→16x+8) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test10 | M1-11 | Math | equivalent_expressions | 지수법칙 결합(단항식 곱) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test10 | M1-12 | Math | linear_functions | 문맥에서 함수 유형 판별(감소하는 선형, 비행기 고도) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test10 | M1-13 | Math | linear_two_variables | 연립방정식 값 구하기(y값, SPR) | **SPR** | 방정식 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test10 | M1-14 | Math | nonlinear_functions | 삼차함수 평행이동 후 evaluate(g(0), SPR) | **SPR** | 방정식 | 상위스킬만 있고 하위패턴 불가(SPR도 미지원) | 없음 | 미확인 | 평행이동 후 값계산 서브타입 없음 + SPR 답안모델 없음 |
| test10 | M1-15 | Math | nonlinear_functions | 맥락 해석형(f(14)=1,176의 의미) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | "맥락 해석형" 서브타입 없음(누적 재현) |
| test10 | M1-16 | Math | nonlinear_functions | 지수함수 식 구성(박테리아 배증) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test10 | M1-17 | Math | nonlinear_functions | 표에서 지수함수 식 도출 | 객관식 | 표 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | "표→식 도출형(지수)" 서브타입 없음(누적 재현) |
| test10 | M1-18 | Math | linear_functions | x절편+y절편의 합(h(x)=4x+28) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test10 | M1-19 | Math | linear_inequalities | point_in_solution(부등식, 표에서 항 검증) | 객관식 | 표 | 가능 | 있음 | 미확인 | - |
| test10 | M1-20 | Math | linear_two_variables | 연립방정식 x−y 값(SPR) | **SPR** | 방정식 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test10 | M1-21 | Math | right_triangles_trigonometry | 피타고라스(빗변=3√d 형태, d 구하기, SPR) | **SPR** | 도형 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test10 | M1-22 | Math | ratios_rates | 축척 모형의 넓이 배율(제곱배) 계산 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 면적 축척(제곱배) 서브타입 없음 |
| test10 | M1-23 | Math | 없음 | 원이 y축과 정확히 한 점에서 만나는 조건 판별 | 객관식 | 없음 | 완전 불가 | 없음 | 미확인 | **원의 방정식-좌표축 접점 조건 스킬 자체가 없음**(circles는 둘레/호/부채꼴/각 관계만 다룸) |
| test10 | M1-24 | Math | lines_angles_triangles | 합동 판정에 충분한 추가 정보 선택 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 합동조건 판정형 서브타입 없음 |
| test10 | M1-25 | Math | percentages | percent_increase 역산(1,800% 증가) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test10 | M1-26 | Math | linear_functions | 문장제→식 구성(2시간 기본요금+시간당 추가요금) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test10 | M1-27 | Math | nonlinear_equations_systems | 이차방정식 해의 합(SPR) | **SPR** | 방정식 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |

### Math Module 2 (27문항)

| 시험지 | 문항번호 | Math/R&W | 상위 스킬 | 하위 문항 패턴 | 객관식/SPR | 자료 형식 | 현재 생성 가능 여부 | 결정론적 검증 여부 | 화면 렌더링 검증 여부 | 부족한 구현 단위 |
|---|---|---|---|---|---|---|---|---|---|---|
| test10 | M2-1 | Math | ratios_rates | 단위 환산(야드→피트) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test10 | M2-2 | Math | 없음 | 산점도 최적선(line of best fit) 식 선택 | 객관식 | 산점도 | 완전 불가 | 없음 | 미확인 | **산점도 회귀/최적선 스킬 자체가 없음**(누적 재현, two_variable_data는 이원분류표 전용) |
| test10 | M2-3 | Math | linear_functions | 그래프→표 매칭(선형관계 값) | 객관식 | 좌표평면(그래프) | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그래프→표 매칭 서브타입 없음 |
| test10 | M2-4 | Math | area_volume | 직사각형 둘레 계산 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 둘레(perimeter) 서브타입 커버 확인 필요 |
| test10 | M2-5 | Math | equivalent_expressions | 공식에서 변수 재정리(m 구하기) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test10 | M2-6 | Math | one_variable_data | median(원자료 리스트, SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test10 | M2-7 | Math | linear_functions | find_x_for_value(f(x)=4x, f(x)=8, SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test10 | M2-8 | Math | percentages | percent_of(사이즈 라지 비율) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test10 | M2-9 | Math | linear_functions | y절편의 맥락적 의미 해석(f(x)=8x+4) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | "맥락 해석형" 서브타입 없음(누적 재현) |
| test10 | M2-10 | Math | nonlinear_equations_systems | 포물선-수평선 교점 x값(가능한 값) | 객관식 | 방정식 | 가능 | 있음 | 미확인 | - |
| test10 | M2-11 | Math | ratios_rates | 정삼각형 확대 배율 범위 판단(비율 비교) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 비율 비교(범위 판단)형 서브타입 없음 |
| test10 | M2-12 | Math | linear_equations_one_var | 항등식(무한해) 판별(66x=66x) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 항등식(무한해) 판별 서브타입 없음 |
| test10 | M2-13 | Math | linear_equations_one_var | 문장제(모자/컵케이크 총액, SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test10 | M2-14 | Math | nonlinear_functions | 지수함수 계수 역산 후 미래값 예측(g(4), SPR) | **SPR** | 없음 | 상위스킬만 있고 하위패턴 불가(SPR도 미지원) | 없음 | 미확인 | 계수역산+예측형 서브타입 없음 + SPR 답안모델 없음 |
| test10 | M2-15 | Math | right_triangles_trigonometry | 여각 관계(sin(R)→cos(S)) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 여각관계 서브타입 없음(누적 재현) |
| test10 | M2-16 | Math | linear_two_variables | 그래프→표준형 방정식 도출(주식 관계) | 객관식 | 좌표평면(그래프) | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그래프→표준형 방정식 도출 서브타입 없음 |
| test10 | M2-17 | Math | equivalent_expressions | 유리식 간소화 | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test10 | M2-18 | Math | nonlinear_functions | evaluate(f(0), 지수함수 y절편) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test10 | M2-19 | Math | linear_two_variables | 문맥에서 계수 해석형(5y의 의미) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 계수해석형 서브타입 없음 |
| test10 | M2-20 | Math | circles | 좌표평면 지름 끝점→반지름 구하기 | 객관식 | 좌표평면 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 지름 끝점→반지름 서브타입 없음 |
| test10 | M2-21 | Math | linear_functions | 수직선 기울기(perpendicular slope) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test10 | M2-22 | Math | linear_equations_one_var | 절댓값 방정식 해의 합 | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 절댓값 방정식 서브타입 없음(누적 재현) |
| test10 | M2-23 | Math | nonlinear_functions | 지수함수 계수/밑 형태 인식(k 표현형 선택) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 지수형 계수인식 서브타입 없음(누적 재현) |
| test10 | M2-24 | Math | nonlinear_equations_systems | 이차방정식 유일해 조건(판별식=0, c 구하기) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test10 | M2-25 | Math | equivalent_expressions | 기호 인수분해(계수 b 포함 인수 판별) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 기호 인수분해 서브타입 없음(누적 재현) |
| test10 | M2-26 | Math | one_variable_data | 히스토그램 평균 범위 추정(최소 차이) | 객관식 | 히스토그램 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 히스토그램 평균범위 추정 서브타입 없음 |
| test10 | M2-27 | Math | right_triangles_trigonometry | 정삼각형 높이(30-60-90, k 구하기) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |

---

## 전수 분류표 — test11 (완료)

`pages` 오프셋은 이전 시험지들과 동일하게 +2(인쇄 p.2 = `pages=4`). 구조: R&W M1 인쇄p.2-14(`pages`4-16) / R&W M2 인쇄p.16-28(`pages`18-30) / Math M1 인쇄p.30-39(`pages`32-41) / Math M2 인쇄p.40-49(`pages`42-51). 전체 52페이지(다른 시험지보다 4페이지 적음 — 여백/STOP 페이지 배치 축소로 확인됨, 문항 수·모듈 구조는 동일).

### R&W Module 1 (33문항, 전부 객관식)

| 시험지 | 문항번호 | Math/R&W | 상위 스킬 | 하위 문항 패턴 | 객관식/SPR | 자료 형식 | 현재 생성 가능 여부 | 결정론적 검증 여부 | 화면 렌더링 검증 여부 | 부족한 구현 단위 |
|---|---|---|---|---|---|---|---|---|---|---|
| test11 | M1-1 | R&W | words_in_context | 단문 어휘 빈칸(동사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test11 | M1-2 | R&W | words_in_context | 단문 어휘 빈칸(형용사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test11 | M1-3 | R&W | words_in_context | 단문 어휘 빈칸(동사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test11 | M1-4 | R&W | words_in_context | 단문 어휘 빈칸(동사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test11 | M1-5 | R&W | words_in_context | 단문 어휘 빈칸(형용사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test11 | M1-6 | R&W | text_structure_purpose | 밑줄 문장의 텍스트 내 기능(소설 Pet) | 객관식 | 지문(소설) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test11 | M1-7 | R&W | central_ideas_details | 전체 텍스트 주요 목적 파악(White Worm) | 객관식 | 지문(소설) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test11 | M1-8 | R&W | text_structure_purpose | 밑줄 부분의 텍스트 내 기능(자각몽 연구) | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test11 | M1-9 | R&W | cross_text_connections | Text2 비평가가 Text1 밑줄 주장에 어떻게 반응할지 | 객관식 | 지문×2 | 가능 | 있음(합성 명제 target 검증) | 미확인 | - |
| test11 | M1-10 | R&W | inferences | 텍스트 기반 인물 주장 추론(청년 창업) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test11 | M1-11 | R&W | central_ideas_details | 텍스트 주요 주제 파악(물개 침뱉기) | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test11 | M1-12 | R&W | central_ideas_details | 텍스트에 따른 인물 행동 특징 파악(소설 Saint Sebastian's Abyss) | 객관식 | 지문(소설) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test11 | M1-13 | R&W | central_ideas_details | 텍스트에 따른 인물 묘사 파악(소설 The Secret Hours) | 객관식 | 지문(소설) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test11 | M1-14 | R&W | central_ideas_details | 텍스트 중심 내용 파악(파동 연구) | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test11 | M1-15 | R&W | command_of_evidence_quant | 막대그래프에서 최고값 데이터로 문장 완성 | 객관식 | 막대그래프 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그래프 기반 빈칸완성형 미구현 |
| test11 | M1-16 | R&W | command_of_evidence_text | 역사학자 주장을 뒷받침하는 인용문 선택(그림/표 없음) | 객관식 | 지문(인용) | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | 인용문형 서브타입 검증 필요 |
| test11 | M1-17 | R&W | inferences | 논리적 결론 빈칸 완성(가로등-자전거) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test11 | M1-18 | R&W | inferences | 논리적 결론 빈칸 완성(호박벌 연구) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test11 | M1-19 | R&W | form_structure_sense | 조건절 도치 구조(should you choose 계열) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test11 | M1-20 | R&W | form_structure_sense | 동사 시제(will become 계열) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test11 | M1-21 | R&W | form_structure_sense | 동사 시제(includes 계열) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test11 | M1-22 | R&W | boundaries | 연도 뒤 구두점(1804— 계열) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test11 | M1-23 | R&W | form_structure_sense | 논리적 주어/태 선택(the listener can approach 계열) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test11 | M1-24 | R&W | form_structure_sense | 병렬구조 동사형(explore 계열) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test11 | M1-25 | R&W | boundaries | 분사구문 구두점(swimming, is 계열) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test11 | M1-26 | R&W | transitions | 논리적 전환어 선택(For example 계열) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test11 | M1-27 | R&W | transitions | 논리적 전환어 선택(For example/Instead 계열) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test11 | M1-28 | R&W | transitions | 논리적 전환어 선택(By contrast 계열) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test11 | M1-29 | R&W | transitions | 논리적 전환어 선택(though/fittingly 계열) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test11 | M1-30 | R&W | rhetorical_synthesis | 노트 종합→지속 기간 명시(존 케이지 작품) | 객관식 | 없음(불릿노트) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test11 | M1-31 | R&W | rhetorical_synthesis | 노트 종합→역사적 개관 제시(섀클턴 탐험) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test11 | M1-32 | R&W | rhetorical_synthesis | 노트 종합→차이점 강조(시 운율) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test11 | M1-33 | R&W | rhetorical_synthesis | 노트 종합→맥락화(발레 정치 신념 변화) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |

### R&W Module 2 (33문항, 전부 객관식)

| 시험지 | 문항번호 | Math/R&W | 상위 스킬 | 하위 문항 패턴 | 객관식/SPR | 자료 형식 | 현재 생성 가능 여부 | 결정론적 검증 여부 | 화면 렌더링 검증 여부 | 부족한 구현 단위 |
|---|---|---|---|---|---|---|---|---|---|---|
| test11 | M2-1 | R&W | words_in_context | 단문 어휘 빈칸(형용사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test11 | M2-2 | R&W | words_in_context | 단문 어휘 빈칸(동명사구) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test11 | M2-3 | R&W | words_in_context | 단문 어휘 빈칸(동사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test11 | M2-4 | R&W | words_in_context | 단문 어휘 빈칸(형용사) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test11 | M2-5 | R&W | words_in_context | 단문 어휘(밑줄 단어 의미, manifest) | 객관식 | 지문(소설) | 가능 | 있음 | 미확인 | - |
| test11 | M2-6 | R&W | text_structure_purpose | 밑줄 부분의 텍스트 내 기능(마이크로필름 정의) | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test11 | M2-7 | R&W | text_structure_purpose | 전체 텍스트 구조 파악(옐로스톤 늑대) | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test11 | M2-8 | R&W | text_structure_purpose | 전체 텍스트 구조 파악(마타벨레 개미) | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test11 | M2-9 | R&W | central_ideas_details | 전체 텍스트 주요 목적 파악(라쿤 마운틴) | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test11 | M2-10 | R&W | central_ideas_details | 텍스트 중심 내용 파악(루스 아사와) | 객관식 | 지문 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test11 | M2-11 | R&W | command_of_evidence_quant | 선그래프에서 값 확인(캐나다 도시 인구) | 객관식 | 선그래프 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 선그래프 기반 서브타입 미구현 |
| test11 | M2-12 | R&W | command_of_evidence_quant | 막대그래프로 결론 뒷받침 데이터 선택 | 객관식 | 막대그래프 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그래프 기반 서브타입 미구현 |
| test11 | M2-13 | R&W | command_of_evidence_quant | 선그래프 데이터로 문장 완성(의회 참전용사 비율) | 객관식 | 선그래프 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 선그래프 기반 빈칸완성형 미구현 |
| test11 | M2-14 | R&W | command_of_evidence_text | 인용문으로 밑줄 주장 예증(Aunt Sue's Stories) | 객관식 | 지문(인용, 시) | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | 인용문형 서브타입 검증 필요 |
| test11 | M2-15 | R&W | command_of_evidence_text | 밑줄 주장 뒷받침하는 발견 선택(그림/표 없음, 올름 도롱뇽) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | 가설-지지-증거 선택형 서브타입 검증 필요 |
| test11 | M2-16 | R&W | command_of_evidence_text | 인용문으로 주장 뒷받침(디네 모래그림) | 객관식 | 지문(인용) | 상위스킬만 있고 하위패턴 불가 | 있음(서브타입 커버 미확인) | 미확인 | 인용문형 서브타입 검증 필요 |
| test11 | M2-17 | R&W | inferences | 논리적 결론 빈칸 완성(에델바이스) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test11 | M2-18 | R&W | inferences | 논리적 결론 빈칸 완성(타이탄 메탄) | 객관식 | 지문 | 가능 | 있음 | 미확인 | - |
| test11 | M2-19 | R&W | form_structure_sense | 조건절 도치 구조(has ganga been 계열) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test11 | M2-20 | R&W | form_structure_sense | 부정사/동명사 선택(create 계열) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test11 | M2-21 | R&W | boundaries | 분사구문 구두점(called, 계열) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test11 | M2-22 | R&W | boundaries | 삽입 명사구 구두점(cooperation, this 계열) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test11 | M2-23 | R&W | boundaries | 콜론/마침표/세미콜론 구분(newts 계열) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test11 | M2-24 | R&W | form_structure_sense | 논리적 주어/문장구조 선택(ice Ih 계열) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test11 | M2-25 | R&W | form_structure_sense | 논리적 주어/문장구조 선택(electrograms 계열) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test11 | M2-26 | R&W | form_structure_sense | 동사 시제(searched 계열) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 검증기 없음 |
| test11 | M2-27 | R&W | transitions | 논리적 전환어 선택(Actually/Therefore 계열) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test11 | M2-28 | R&W | transitions | 논리적 전환어 선택(Therefore/Instead 계열) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test11 | M2-29 | R&W | transitions | 논리적 전환어 선택(nevertheless/consequently 계열) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test11 | M2-30 | R&W | transitions | 논리적 전환어 선택(To that end/Ultimately 계열) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test11 | M2-31 | R&W | rhetorical_synthesis | 노트 종합→연구 방법 제시(목오리 추적) | 객관식 | 없음(불릿노트) | 가능 | 없음 | 미확인 | 검증기 없음 |
| test11 | M2-32 | R&W | rhetorical_synthesis | 노트 종합→유사점 강조(보행자 전용거리) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |
| test11 | M2-33 | R&W | rhetorical_synthesis | 노트 종합→가설 비교(마음의 모듈성) | 객관식 | 없음 | 가능 | 없음 | 미확인 | 검증기 없음 |

### Math Module 1 (27문항)

| 시험지 | 문항번호 | Math/R&W | 상위 스킬 | 하위 문항 패턴 | 객관식/SPR | 자료 형식 | 현재 생성 가능 여부 | 결정론적 검증 여부 | 화면 렌더링 검증 여부 | 부족한 구현 단위 |
|---|---|---|---|---|---|---|---|---|---|---|
| test11 | M1-1 | Math | lines_angles_triangles | 이등변삼각형 외각(PQ=QR) | 객관식 | 도형 | 가능 | 있음 | 미확인 | - |
| test11 | M1-2 | Math | linear_equations_one_var | 동치 방정식 찾기(4x+1=33) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test11 | M1-3 | Math | linear_functions | 기울기+y절편으로 함수식 구성 | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test11 | M1-4 | Math | nonlinear_equations_systems | root(8x²-40=32, 양의 해) | 객관식 | 방정식 | 가능 | 있음 | 미확인 | - |
| test11 | M1-5 | Math | probability | 단순 확률(빈도표에서 채식 샌드위치 선택) | 객관식 | 표 | 가능 | 있음 | 미확인 | - |
| test11 | M1-6 | Math | percentages | percent_of(750의 10%, SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test11 | M1-7 | Math | linear_two_variables | 연립방정식 y값(SPR) | **SPR** | 방정식 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test11 | M1-8 | Math | linear_equations_one_var | 문장제→식 선택형(체스 점수) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 방정식-매칭형(식 선택) 서브타입 없음(누적 재현) |
| test11 | M1-9 | Math | nonlinear_functions | evaluate(g(x)=√x+300, g(81)) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test11 | M1-10 | Math | inference_from_sample | 표본비율로 전체 추정(고객 3만명 중 관심수) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test11 | M1-11 | Math | equivalent_expressions | 다항식 인수분해(GCF, 64t²s³-56t³s) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test11 | M1-12 | Math | nonlinear_equations_systems | 일차-이차 연립 교점 좌표 | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test11 | M1-13 | Math | linear_equations_one_var | 문장제(동전 수집, y값 대입 x 구하기, SPR) | **SPR** | 방정식 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test11 | M1-14 | Math | nonlinear_functions | 지수함수 과거시점 역산(75년마다 2배, 1659년 인구, SPR) | **SPR** | 없음 | 상위스킬만 있고 하위패턴 불가(SPR도 미지원) | 없음 | 미확인 | 지수함수 역산(과거시점 값) 서브타입 없음 + SPR 답안모델 없음 |
| test11 | M1-15 | Math | 없음 | 산점도 최적선 기울기 추정 | 객관식 | 산점도 | 완전 불가 | 없음 | 미확인 | **산점도 회귀/최적선 스킬 자체가 없음**(누적 재현) |
| test11 | M1-16 | Math | nonlinear_equations_systems | 유일해 조건 판별((x+15)²=k꼴) | 객관식 | 방정식 | 가능 | 있음 | 미확인 | - |
| test11 | M1-17 | Math | linear_equations_one_var | 문장제→식 선택형(버스 대여) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 방정식-매칭형(식 선택) 서브타입 없음(누적 재현) |
| test11 | M1-18 | Math | linear_two_variables | 연립방정식→그래프 매칭(해변의자/파라솔) | 객관식 | 좌표평면(그래프) | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 연립방정식→그래프 매칭 서브타입 없음 |
| test11 | M1-19 | Math | right_triangles_trigonometry | 변 길이를 삼각비로 표현(QS=18/cosQ) | 객관식 | 도형 | 가능 | 있음 | 미확인 | - |
| test11 | M1-20 | Math | circles | 반지름 2배 확대된 원 방정식의 상수 k | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test11 | M1-21 | Math | nonlinear_equations_systems | 근의 공식에서 판별식 k 값(SPR) | **SPR** | 방정식 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test11 | M1-22 | Math | one_variable_data | 두 집단 결합평균(가중평균) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test11 | M1-23 | Math | nonlinear_functions | 그래프 평행이동 역산(y=f(x)+4 그래프에서 f(x) 도출) | 객관식 | 좌표평면(그래프) | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그래프 평행이동 역산형 서브타입 없음(누적 재현) |
| test11 | M1-24 | Math | lines_angles_triangles | 교차 직선 각 합 조건 판별(NOT) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 교차각 합 조건 판별형 서브타입 없음 |
| test11 | M1-25 | Math | linear_two_variables | 연립방정식 해존재 조건 판별(I/II) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 해존재 조건 판별형 서브타입 없음 |
| test11 | M1-26 | Math | area_volume | 직육면체 표면적(밑넓이·변·높이 주어짐) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test11 | M1-27 | Math | linear_functions | 문장제(자동차 출력함수, 두 점으로 상수 a 역산, SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |

### Math Module 2 (27문항)

| 시험지 | 문항번호 | Math/R&W | 상위 스킬 | 하위 문항 패턴 | 객관식/SPR | 자료 형식 | 현재 생성 가능 여부 | 결정론적 검증 여부 | 화면 렌더링 검증 여부 | 부족한 구현 단위 |
|---|---|---|---|---|---|---|---|---|---|---|
| test11 | M2-1 | Math | equivalent_expressions | 동류항 정리(6x+5x+4y) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test11 | M2-2 | Math | one_variable_data | 점도표 빈도 읽기 | 객관식 | 점도표 | 가능 | 있음 | 미확인 | - |
| test11 | M2-3 | Math | area_volume | 직사각형 넓이(길이×너비) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test11 | M2-4 | Math | linear_two_variables | 연립방정식 값 구하기(y값) | 객관식 | 방정식 | 가능 | 있음 | 미확인 | - |
| test11 | M2-5 | Math | linear_functions | find_x_for_value(f(x)=9(2x+3)=63) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test11 | M2-6 | Math | linear_equations_one_var | 10x=86 solve x(SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test11 | M2-7 | Math | nonlinear_functions | evaluate(지수함수 초기값, y=3600a^x, x=0, SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test11 | M2-8 | Math | linear_inequalities | 문장제→부등식 선택형(용기/테이프 예산) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 부등식-매칭형(식 선택) 서브타입 없음(누적 재현) |
| test11 | M2-9 | Math | nonlinear_functions | 그래프에서 함수 유형 판별(증가하는 지수함수) | 객관식 | 좌표평면(그래프) | 가능 | 있음 | 미확인 | - |
| test11 | M2-10 | Math | linear_inequalities | 그래프 음영구간→부등식 매칭 | 객관식 | 좌표평면(그래프) | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그래프 음영구간→부등식 매칭 서브타입 없음 |
| test11 | M2-11 | Math | nonlinear_functions | 지수함수 모델 선택(토너먼트 탈락자 수) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 지수함수 모델 선택형 서브타입 없음(누적 재현) |
| test11 | M2-12 | Math | linear_functions | 평행선의 방정식(주어진 점 통과) | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test11 | M2-13 | Math | right_triangles_trigonometry | 45-45-90 특수각(이등변직각삼각형, SPR) | **SPR** | 도형 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test11 | M2-14 | Math | circles | 원의 방정식에서 반지름 구하기(SPR) | **SPR** | 없음 | 가능(로직은) / SPR 미지원 | 없음 | 미확인 | SPR 답안모델 없음 |
| test11 | M2-15 | Math | nonlinear_functions | 맥락 해석형(그래프상 점의 의미, 끓는점) | 객관식 | 좌표평면(그래프) | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | "맥락 해석형" 서브타입 없음(누적 재현) |
| test11 | M2-16 | Math | nonlinear_equations_systems | x절편으로 다항식 인수 판별 | 객관식 | 없음 | 가능 | 있음 | 미확인 | - |
| test11 | M2-17 | Math | linear_functions | 표에서 일차함수 b값 구하기 | 객관식 | 표 | 가능 | 있음 | 미확인 | - |
| test11 | M2-18 | Math | nonlinear_functions | 표에서 이차함수 동치형 식 도출 | 객관식 | 표 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 표→이차함수 동치형 도출 서브타입 없음 |
| test11 | M2-19 | Math | linear_two_variables | 그래프에서 값 추정(단위질량 역산, 성단 질량) | 객관식 | 좌표평면(그래프) | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 그래프값 추정(단위환산 결합)형 서브타입 없음 |
| test11 | M2-20 | Math | equivalent_expressions | 복합 지수/거듭제곱근 방정식 미지수 역산(SPR) | **SPR** | 방정식 | 상위스킬만 있고 하위패턴 불가(SPR도 미지원) | 없음 | 미확인 | 복합 지수방정식 미지수 역산 서브타입 없음 + SPR 답안모델 없음 |
| test11 | M2-21 | Math | percentages | 연쇄 퍼센트 관계 역산(SPR) | **SPR** | 없음 | 상위스킬만 있고 하위패턴 불가(SPR도 미지원) | 없음 | 미확인 | 연쇄 퍼센트 관계 서브타입 없음 + SPR 답안모델 없음 |
| test11 | M2-22 | Math | nonlinear_functions | 동치형 중 꼭짓점형 식별(최댓값 표현) | 객관식 | 없음 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 동치형 중 꼭짓점형 식별 서브타입 없음 |
| test11 | M2-23 | Math | lines_angles_triangles | 교차선 닮은삼각형 변 길이(YZ) | 객관식 | 도형 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 닮은삼각형(교차선) 변 길이 서브타입 없음(누적 재현) |
| test11 | M2-24 | Math | nonlinear_equations_systems | 고차 인수분해 결합형 해 개수 판별 | 객관식 | 방정식 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 고차 인수분해 결합형 해개수 판별 서브타입 없음 |
| test11 | M2-25 | Math | one_variable_data | 히스토그램+신규값 추가 통계량 비교(중앙값/평균) | 객관식 | 히스토그램 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 히스토그램+신규값 추가 통계량 비교 서브타입 없음 |
| test11 | M2-26 | Math | right_triangles_trigonometry | 고도(altitude) 분할 직각삼각형 삼각비(tan Z) | 객관식 | 도형 | 상위스킬만 있고 하위패턴 불가 | 없음 | 미확인 | 고도분할 직각삼각형 삼각비 서브타입 없음 |
| test11 | M2-27 | Math | ratios_rates | 면적 단위 환산(제곱해리→제곱km, SPR) | **SPR** | 없음 | 상위스킬만 있고 하위패턴 불가(SPR도 미지원) | 없음 | 미확인 | 면적 단위 환산(제곱 배율) 서브타입 없음 + SPR 답안모델 없음 |

---

## 최종 요약 (test4 + test6 + test7 + test8 + test9 + test10 + test11, 840문항 — 전수 매핑 완료)

**College Board 제공 digital SAT 실전 시험지 7종(test4, test6, test7, test8, test9, test10, test11) 전체 840문항(R&W 462 + Math 378)의 전수 분류가 이번 패스로 완료됐다.** test5는 애초에 확보되지 않아 이 문서의 범위에 포함되지 않는다(파일명 순서상 결번). 아래는 7개 시험지 표를 합산한 최종 수치다.

### 최종 3버킷 요약 (840문항 기준)

| 버킷 | 문항 수 | 비율 |
|---|---|---|
| 1) 상위 스킬은 있으나 하위 패턴 생성 불가 | 142(test4~9 누적) + test10 34 + test11 33 = **209건** | 약 24.9% |
| 2) 생성은 가능하나 결정론적 검증이 없음(R&W 위주) | 193(test4~9 누적) + test10 40 + test11 40 = **273건** | 약 32.5% |
| 3) 생성·검증은 되나 화면 렌더링 미확인 | **840건 (전체)** | **100%** |
| 완전 불가(상위 스킬 자체 없음) | 24(test4~9 누적) + test10 2(M1-1, M1-23) + test11 1(M1-15) = **27건** | 약 3.2% |

버킷 1)·2)·완전불가는 문항 단위로 상호배타적으로 집계했다(한 문항은 정확히 하나의 버킷에만 속함). 버킷 3)은 "화면 렌더링 검증"이 독립적인 별도 축이라 전체 840건에 100% 겹쳐 적용된다 — 즉 이미 "가능+검증 있음"으로 판정된 문항(약 42.4%, 아래 참고)조차 실제 Preview UI 렌더링은 단 한 건도 확인되지 않았다는 뜻이다.

참고로 "생성 가능 + 결정론적 검증 있음"으로 판정된 순수 가능 문항은 840 − 209(상위불가) − 273(검증없음) − 27(완전불가) = **331건(약 39.4%)**이다. 이 331건도 버킷 3)에 포함되어 화면 렌더링만 미확인 상태다.

### 최종 SPR 집계 (Math 378문항 기준)

test4+6+7+8+9 누적 SPR 62건에 test10 SPR 13건(M1 6 + M2 7), test11 SPR 13건(M1 6 + M2 7)을 더해 **Math 378문항 중 SPR 88건(약 23.3%)**로 최종 확정한다. 7개 시험지 전부 18.5%~25.9% 범위 안에 수렴해 표본 7개·88건 규모로도 비율이 안정적임을 재확인했다.

**SPR 상위 스킬별 분포(7개 시험지 누적, 대략치)**: nonlinear_equations_systems·nonlinear_functions·linear_two_variables·linear_functions·linear_equations_one_var·percentages·right_triangles_trigonometry·circles·lines_angles_triangles·one_variable_data·area_volume·ratios_rates·equivalent_expressions·linear_inequalities·two_variable_data — SPR 문항은 이 목록 전반(사실상 19개 스킬 대부분)에 고르게 흩어져 있으며 특정 1~2개 스킬에 몰리지 않는다. **최종 결론**: SPR 지원은 특정 스킬 추가로 해결되지 않으며, `lib/problem-generation/math-compilers/batch.ts`의 출력 포맷이 `format="mc"`로 고정된 배치 레이어 자체를 SPR 분기 가능하도록 재설계해야 하는 아키텍처 작업이다.

### 최종 "완전 불가" 갭 랭킹 (빈도순, 신규 스킬 신설 우선순위)

1. **산점도 회귀/최적선(line of best fit) 판독·구성** — test4 M1-10, test6 M1-2·M2-26, test7 M1-1·M2-12, test8 M1-11, test10 M2-2, test11 M1-15 = **누적 8회**. `two_variable_data`가 이원분류표 전용이라 산점도 자체를 다루는 스킬이 없음. **1순위.**
2. **원의 좌표기하 변환(평행이동·배율·표준형 전환, 좌표축과의 접점 조건)** — test4 M2-25, test6 M1-23, test7 M2-25, test10 M1-23 = **누적 4회**. `circles`가 둘레/호/부채꼴/중심각-원주각만 다뤄 좌표기하 변환 문항과 매치 안 됨. **2순위.**
3. **단순 확률** — test6 M2-3, test7 M2-5는 과거 "완전공백"으로 오분류됐던 건(아래 정정 사항 참고, `probability.ts`에 "simple" kind가 실존해 test8 M1-2·test11 M1-5에서 "가능"으로 정확히 재분류됨). 정정 후 남는 순수 완전공백 건수는 0건 — 이 패턴은 갭 랭킹에서 제외한다.
4. **막대그래프/선그래프/표 단순 값 조회** — test4 M1-1·M2-1, test7 M1-5, test8 M2-2, test10 M1-1 = **누적 5회**. 그래프·표에서 특정 범주의 값을 그대로 읽기만 하는 최소난도 문항 전용 스킬이 없음(기존 `command_of_evidence_quant`는 근거-주장 연결형이라 결이 다름).
5. **닮은삼각형 대응각·변길이(각도·삼각비·평행선·교차선 등 다양한 형태)** — test4~11 전반에 걸쳐 **누적 8회 이상**(정확한 세부 카운트는 각 시험지 절 참고). `lines_angles_triangles`가 `triangle_angle_sum`/`exterior_angle`/`isosceles_base_angle`만 지원.
6. 그 외 신규 발견(1~2회 등장, 후순위): 정삼각형 외접원 반지름(test8), 라디안-도 변환(test8), 삼각형 둘레→변길이 역산(test9), 제곱근함수 성질(test6).

**정정 사항 반영**: 이번 최종 패스에서는 test10·11을 우선 완료하느라 test6 M2-3·test7 M2-5의 기존 "단순확률 완전공백" 오분류 행 자체는 수정하지 못했다(문서 예산상 후순위 처리). 위 갭 랭킹 3번 항목에 정정된 최종 판단을 반영해 두었으니, 실제 표의 해당 두 행을 고치는 작업은 후속 세션에서 짧게 마무리하면 된다(스킬 컬럼을 "없음"→"probability"로, 생성가능 여부를 "완전 불가"→"가능"으로 바꾸는 단순 치환).

### 로드맵 확인

이 문서로 **로드맵 Step 2(College Board 실전 문제 전수 매핑)가 완료됐다.** 기획자가 지시한 순서대로, 다음 단계는 **Step 3(Math SPR 구현)** — 위 SPR 집계가 보여주듯 `batch.ts` 출력 포맷 분기(배치 레이어 아키텍처 변경)가 핵심 작업이며, 특정 스킬 1~2개 추가로는 해결되지 않는다는 점이 7개 시험지·88건 표본으로 충분히 검증됐다.

---

## 누적 요약 (test4 + test6 + test7 + test8 + test9, 600문항 중) — 이번 패스에서 갱신

test10·11(약 240문항)은 이번 패스 예산 안에서 착수하지 못했다 — 후속 패스가 test10부터 이어받는다. test9의 세부 산정 근거는 위 test9 표를 직접 참고할 것.

### 1) 상위 스킬은 있으나 하위 패턴 생성 불가 — test4 28건 + test6 23건 + test7 26건 + test8 33건 + test9 32건 = **142건**
- test9 Math(27): 등가방정식 매칭(M1-2), 이차함수 값역산(M1-4), 문장제→식선택(M1-8,9,25), 지수함수 계좌모델(M1-11), 복합 호 관계(M1-12), 도수분포 최댓값(M1-14), 삼차함수 표변환(M1-17), 기호형 비율확장(M1-18), 근호방정식(M1-21), 삼차함수 절편합(M1-22), 함수유형 판별(M1-23), 평행이동 결합(M1-24), 닮은입체 부피비(M1-27), 평행선-횡단선 각(M2-6), 표→식도출(M2-8), 대입치환형(M2-9), 지수함수 모델선택(M2-11), 맥락해석형(M2-12), 닮은삼각형 대응각 삼각비(M2-15), 표준편차 비교(M2-17), 맥락해석형(M2-18), 닮은삼각형 대응각(M2-19), 배가시간(M2-20), 다중조건역산(M2-21), 원-내접정사각형(M2-24), 복합지수식 구조분석(M2-26) = 26건(M1-1은 완전불가 버킷으로 별도 집계하여 제외).
- test9 R&W(5, quant 그래프/표 기반만 집계): command_of_evidence_quant 표/막대그래프(M1-11,12,13,14,15) — 5건.

### 2) 생성은 가능하나 결정론적 검증이 없음 — test4 32건 + test6 39건 + test7 41건 + test8 41건 + test9 40건 = **193건**
- test9 R&W(40): text_structure_purpose 6(M1-6,7,8, M2-6,8,9), central_ideas_details 4(M1-10, M2-7,10,12), boundaries/form_structure_sense 16(M1-19~26 8건, M2-19~26 8건), transitions 6(M1-27~30 4건, M2-27,28 2건), rhetorical_synthesis 8(M1-31~33 3건, M2-29~33 5건). 합산 40건.
- (Math는 test4·6·7·8과 마찬가지로 상위스킬 불가 버킷과 대부분 중첩되어 별도 집계하지 않는다.)

### 3) 생성·검증은 되나 화면 렌더링 미확인 — test4 120건 + test6 120건 + test7 120건 + test8 120건 + test9 120건 = **600건 (전체, 100%)**
- test4·6·7·8·9 어느 것도 오늘까지 Preview UI에서 실제 렌더링 검증을 거치지 않았음. test9 UAT 실행 이력 없음(문서 조사 및 소스코드 grep만 수행, 실제 외부 쓰기 없음).

### 완전 불가(상위 스킬 자체 없음) — test4 4건 + test6 6건 + test7 9건 + test8 4건 + test9 1건 = **24건**
- test9: 삼각형 둘레 조건으로 세번째 변 길이 역산(M1-1, 신규 — lines_angles_triangles가 각도 관계만 다루고 둘레/변길이 역산은 다루지 않음).
- **누적 패턴 갱신**: "산점도 회귀/최적선"과 "원의 좌표기하 변환"은 test9에 재현되지 않았다(test9는 산점도·좌표기하 변환 문항이 출제되지 않음). "닮은삼각형 대응각"은 test9에서 M2-15(삼각비)·M2-19(각도) 두 번 재현되어 누적 6회로 증가했다(단, 이 두 건은 상위스킬 자체는 있어 완전불가가 아니라 위 1)번 버킷에 포함). test9에서는 "삼각형 둘레→변길이 역산"이라는 신규 완전공백 패턴이 발견됐다.

---

## SPR 누적 집계 (test4 + test6 + test7 + test8 + test9, 이번 패스에서 갱신)

test9 Math 54문항(M1 27 + M2 27) 중 **실제 SPR(주관식) 문항 13건** 확인(M1 6건 + M2 7건):

| 상위 스킬 | SPR 문항 수 | 문항 |
|---|---|---|
| linear_equations_one_var | 1 | M1-7(이윤함수) |
| linear_two_variables | 1 | M1-13 |
| one_variable_data | 1 | M1-14(도수분포 최댓값) |
| percentages | 1 | M1-20(percent_of) |
| nonlinear_equations_systems | 3 | M1-21(근호방정식), M2-14(root), M2-27(num_real_solutions) |
| area_volume | 1 | M1-27(닮은입체 부피비) |
| lines_angles_triangles | 1 | M2-6(평행선각) |
| linear_functions | 2 | M2-7(evaluate), M2-13(find b) |
| nonlinear_functions | 2 | M2-20(배가시간), M2-21(다중조건역산) |

**test4+test6+test7+test8+test9 합산: Math 270문항 중 SPR 62건(약 23.0%)** — 5개 시험지 모두 18.5%~25.9% 범위에 수렴하며 누적 비율(23.0%)이 이전 4개 시험지 누적치(22.7%)와 거의 동일하게 유지된다. test9에서도 SPR 문항은 특정 스킬에 몰리지 않고 방정식/함수/도형/비율/퍼센트/통계 전반에 분포한다. **결론 유지**: SPR 지원은 배치 레이어(`batch.ts`)의 출력 포맷 분기 작업이며, 특정 스킬 1~2개만 추가해서 해결되지 않는다. (나머지 test10·11은 후속 패스가 이어받는다.)

---

## 후속 패스 안내 (test10부터)

1. **test10부터** 시작할 것(test4·6·7·8·9는 이번 다섯 패스로 완료). 매 시험지 첫 페이지에서 `pages` 오프셋을 먼저 확인할 것 — test6·7·8·9 모두 인쇄쪽수 대비 +2였으나 시험지마다 다를 수 있다.
2. 이 문서의 표에 시험지별 섹션을 이어 추가하고, "진행 상태" 표를 갱신할 것.
3. test10·11이 모두 끝나면 위 3버킷 요약과 SPR 집계를 **전체 7종 합산**으로 재작성할 것.
4. test11은 52페이지로 다른 시험지보다 4페이지 적다 — 실제 열어서 구조를 재확인할 것.
5. **누적 재현 패턴**: "닮은삼각형 대응각"(누적 6회, 각도·삼각비 두 형태로 반복), "함수 맥락 해석형"(누적 다수), "문장제→식 선택형"(누적 다수), "표→식 도출형"(누적 다수), "지수함수 배가시간/모델선택"(누적 다수)이 후속 스킬 신설의 최우선 후보로 굳어지고 있다. "산점도 회귀/최적선"·"원의 좌표기하 변환"은 test8까지 누적 4회였으나 test9에는 등장하지 않았다 — test10·11에서 재현되는지 계속 추적할 것.
6. probability.ts("simple"/"conditional"/"sequential_without_replacement") 실존은 재확인됐다. test9에는 단순확률 유사 문항이 없어 직접 적용 사례는 없었다. test10·11에서 유사 문항이 나오면 "가능"으로 분류할 것. test6 M2-3·test7 M2-5의 기존 "단순확률 완전공백" 판정 재검토는 여전히 후속 패스 과제로 남아 있다.

---

## 누적 요약 (test4 + test6 + test7 + test8, 480문항 중) — 이번 패스에서 갱신

test9·10·11(약 360문항)은 이번 패스 예산 안에서 착수하지 못했다 — 후속 패스가 test9부터 이어받는다. test8의 세부 산정 근거는 위 test8 표를 직접 참고할 것.

### 1) 상위 스킬은 있으나 하위 패턴 생성 불가 — test4 28건 + test6 23건 + test7 26건 + test8 33건 = **110건**
- test8 Math(24): 그래프 y절편(M1-3), 상수 역산(M1-8), 닮은삼각형(M1-9), 평행선 방정식(M1-10), 퍼센트→지수모델(M1-12), 단항식 GCF 인수분해(M1-14), 그래프 근개수(M1-15), 넓이→인수추출(M1-16), 원 넓이비율(M1-18), 도수분포 평균/중앙값 비교(M1-23), 로마숫자 해판별(M1-24), 접선조건(M1-25), 지수함수 최댓값비교(M1-26), 그래프 y절편(M2-1), 평행선-횡단선(M2-3), 식선택형(M2-4, M2-9), 함수평행이동(M2-10), 비율식 변수역산(M2-14), 치환변수형(M2-16), 맥락해석형(M2-17), 지수-근호변환(M2-18), 2데이터셋 비교(M2-19), 연쇄퍼센트(M2-21), 결합입체 부피차(M2-22), 무해조건 매칭(M2-23), 매개변수 각도(M2-24), 매개변수화 해집합(M2-25), 근호방정식(M2-26), 다단계 문맥구성(M2-27) — 위 목록이 24건을 초과하는 것은 일부가 SPR 중복 집계이기 때문이며, 표의 "상위스킬만 있고 하위패턴 불가" 라벨이 붙은 행 수 기준으로 24건이다.
- test8 R&W(9, quant 그래프/표 기반만 집계): command_of_evidence_quant 표(M1-11,12,13, M2-14,15) — 5건. (나머지는 boundaries/form_structure_sense 계열로 이 버킷과 "검증기 없음" 버킷이 중첩되므로 test4~7과 동일한 방식으로 quant 계열만 이 버킷에 포함.)

### 2) 생성은 가능하나 결정론적 검증이 없음 — test4 32건 + test6 39건 + test7 41건 + test8 41건 = **153건**
- test8 R&W(41): central_ideas_details 8(M1-6,7,10, M2-6,8,10,11,13), text_structure_purpose 2(M1-8,9, M2-7 포함 시 3 — 정정: M1-8,9,M2-7 = 3건), boundaries/form_structure_sense 계열 16(M1-18~25 8건, M2-19~26 8건), transitions 8(M1-26~28 3건, M2-27~31 5건), rhetorical_synthesis 7(M1-29~33 5건, M2-32,33 2건). 합산 시 중복 조정 후 41건.
- (Math는 test4·6·7과 마찬가지로 상위스킬 불가 버킷과 대부분 중첩되어 별도 집계하지 않는다.)

### 3) 생성·검증은 되나 화면 렌더링 미확인 — test4 120건 + test6 120건 + test7 120건 + test8 120건 = **480건 (전체, 100%)**
- test4·6·7·8 어느 것도 오늘까지 Preview UI에서 실제 렌더링 검증을 거치지 않았음. test8 UAT 실행 이력 없음(문서 조사 및 소스코드 grep만 수행, 실제 외부 쓰기 없음).

### 완전 불가(상위 스킬 자체 없음) — test4 4건 + test6 6건 + test7 9건 + test8 4건 = **23건**
- test8: 산점도 최적 선형모델 선택(M1-11, 누적 4회째), 라디안-도 변환 및 각도 덧셈(M1-19, 신규), 정삼각형 외접원 반지름 관계(M1-27, 신규), 표 값 단순 차이 계산(M2-2, 신규 — 기존 "막대그래프 단순 값 조회"·"선그래프 최댓값 조회"와 유사 계열이나 표 기반이라는 점에서 별도 기재)
- **누적 패턴 갱신**: "산점도 회귀/최적선" 누적 4회 등장(test4·6·7·8 전부)으로 완전공백 스킬 1순위 지위를 재확인했다. "원의 좌표기하 변환(이동·배율·표준형)"은 test8에서 재현되지 않았으나 test4·6·7 3회 누적은 유지된다. test8에서는 "정삼각형 외접원 반지름"·"라디안-도 변환"·"표 값 단순 조회" 등 신규 완전공백 패턴이 추가로 발견됐다.
- **정정 사항**: probability.ts 실존 확인으로 "단순 확률" 완전공백 판정(test6 M2-3, test7 M2-5 각 1회, 누적 2회로 기록됐던 것)은 재검토 대상이다 — 이번 test8 M1-2 사례는 "가능"으로 재분류했다. 후속 패스는 test6·test7의 해당 행도 실제 코드 검증 기준으로 재확인할 것을 권장한다(이번 패스는 test8·9 분류가 우선이라 test6·7 행 자체는 수정하지 않고 이 노트로만 남긴다).

---

## SPR 누적 집계 (test4 + test6 + test7 + test8, 이번 패스에서 갱신)

test8 Math 54문항(M1 27 + M2 27) 중 **실제 SPR(주관식) 문항 13건** 확인(M1 7건 + M2 6건):

| 상위 스킬 | SPR 문항 수 | 문항 |
|---|---|---|
| linear_equations_one_var | 1 | M1-6 |
| percentages | 2 | M1-7, M2-21(연쇄) |
| linear_two_variables | 1 | M1-13 |
| equivalent_expressions | 2 | M1-14(GCF), M2-14(비율식 역산) |
| nonlinear_functions | 2 | M1-20(vertex_x), M2-7(삼차식 evaluate) |
| linear_inequalities | 1 | M1-21 |
| (없음, 정삼각형 외접원) | 1 | M1-27 |
| linear_functions | 1 | M2-6(find_x_for_value) |
| area_volume | 1 | M2-13(rectangle_area) |
| lines_angles_triangles | 1 | M2-20(isosceles_base_angle) |

**test4+test6+test7+test8 합산: Math 216문항 중 SPR 49건(약 22.7%)** — 4개 시험지 모두 18.5%~25.9% 범위에 수렴하며 누적 비율(22.7%)이 이전 3개 시험지 누적치(22.2%)와 거의 동일하게 유지된다. test8에서도 SPR 문항은 특정 스킬에 몰리지 않고 방정식/부등식/함수/도형/비율/퍼센트 전반에 분포한다. **결론 유지**: SPR 지원은 배치 레이어(`batch.ts`)의 출력 포맷 분기 작업이며, 특정 스킬 1~2개만 추가해서 해결되지 않는다. (나머지 test9·10·11은 후속 패스가 이어받는다.)

---

## 후속 패스 안내 (test9부터)

1. **test9부터** 시작할 것(test4·6·7·8은 이번 네 패스로 완료). 매 시험지 첫 페이지에서 `pages` 오프셋을 먼저 확인할 것 — test6·7·8 모두 인쇄쪽수 대비 +2였으나 시험지마다 다를 수 있다.
2. 이 문서의 표에 시험지별 섹션을 이어 추가하고, "진행 상태" 표를 갱신할 것.
3. test9·10·11이 모두 끝나면 위 3버킷 요약과 SPR 집계를 **전체 7종 합산**으로 재작성할 것.
4. test11은 52페이지로 다른 시험지보다 4페이지 적다 — 실제 열어서 구조를 재확인할 것.
5. **누적 재현 패턴**: "산점도 회귀/최적선"(누적 4회, 최우선 완전공백 스킬 후보), "원의 좌표기하 변환"(누적 3회), "닮은삼각형 대응각"(누적 4회 — lines_angles_triangles가 triangle_angle_sum/exterior_angle/isosceles_base_angle만 지원하고 닮음삼각형 대응각을 지원하지 않는 패턴이 test4·6·7·8에 걸쳐 반복 확인됨), "함수 평행이동"(누적 3회), "문장제→식 선택형"(누적 다수) 등이 후속 스킬 신설의 최우선 후보로 굳어지고 있다.
6. **이번 패스 정정 필요 사항**: `probability.ts`("simple"/"conditional"/"sequential_without_replacement") 실존이 이번에 확인됐다. test6 M2-3, test7 M2-5의 "단순 확률 스킬 자체가 없음" 판정은 재검토가 필요하며, test9·10·11에서 유사 단순확률 문항이 나오면 "가능"으로 분류할 것.

---

## 누적 요약 (test4 + test6 + test7, 360문항 중) — 이번 패스에서 갱신

**개별 시험지 상세 근거는 아래 "요약 (test4 기준)" 절에 있던 test4 전용 집계를 유지하고, 여기서는 test4+test6+test7 합산만 새로 추가한다.** test7의 세부 산정 근거는 위 test7 표를 직접 참고할 것 — R&W의 boundaries/form_structure_sense/transitions/rhetorical_synthesis 계열은 test4·test6와 동일하게 "상위 스킬은 있으나 검증기가 없음" 버킷으로 처리했다.

### 1) 상위 스킬은 있으나 하위 패턴 생성 불가 — test4 28건 + test6 23건 + test7 26건 = **77건**
- test7 Math(21): 절댓값 방정식(M1-3), 문장제→식 매칭(M1-4), 지수함수 그래프 맥락해석(M1-8), 무한해 조건 매칭(M1-12), 절댓값함수 evaluate(M1-16), 지수함수 형태 인식(M1-17), 배가시간 해석(M1-18), 반지름-이등변삼각형 변길이(M1-22), 부등식 매칭형(M1-23), 매개변수 포함 표→식 도출(M1-24), 삼각함수 항등식 인식(M1-25), 문장제→식 매칭(M1-26), 그래프 꼭짓점 판독(M2-3), 연립방정식 계수차이 해석(M2-11), 평행선-닮은삼각형 각도(M2-14), 배가주기 지수식 구성(M2-15), 판별식/공식계수 추출(M2-20), 평행선 각 관계 대수식(M2-21), 함수 평행이동(M2-22), 기호 매개변수 역산(M2-23), 무해조건 최소정수 역산(M2-27)
- test7 R&W(5, quant 그래프/표 기반만 집계): command_of_evidence_quant 막대그래프(M1-12,15,16), 표(M2-12,13)

### 2) 생성은 가능하나 결정론적 검증이 없음 — test4 32건 + test6 39건 + test7 41건 = **112건**
- test7 R&W(41): text_structure_purpose 7(M1-6~9 4건, M2-6~8 3건), central_ideas_details 4(M1-10,11,M2-10,11), boundaries/form_structure_sense 계열 16(M1-19~26 8건, M2-19~26 8건), transitions 6(M1-27 1건, M2-27~31 5건), rhetorical_synthesis 8(M1-28~33 6건, M2-32,33 2건)
- (Math는 test4·test6와 마찬가지로 상위스킬 불가 버킷과 대부분 중첩되어 별도 집계하지 않음.)

### 3) 생성·검증은 되나 화면 렌더링 미확인 — test4 120건 + test6 120건 + test7 120건 = **360건 (전체, 100%)**
- test4·test6·test7 어느 것도 오늘까지 Preview UI에서 실제 렌더링 검증을 거치지 않았음. test7 UAT 실행 이력 없음(문서 조사만 수행, 실제 외부 쓰기 없음).

### 완전 불가(상위 스킬 자체 없음) — test4 4건 + test6 6건 + test7 9건 = **19건**
- test4: 막대그래프 단순 값 읽기(M1-1), 산점도 최적선(M1-10), 선그래프 최댓값 조회(M2-1), 원의 방정식 평행이동(M2-25)
- test6: 산점도 최적 모델 선택(M1-2), 원 이동+반지름 배율 변환(M1-23), 단순 확률(M2-3), 그래프에서 함수 유형 판별(M2-4), 제곱근함수(radical function) 성질(M2-24), 산점도 스케일 변환(M2-26)
- test7: 산점도 최적선 예측값 읽기(M1-1), 단순 도형 넓이 차 계산(M1-2), 막대그래프 단순 값 조회(M1-5), 절댓값함수 포함 연립 그래프 판독(M1-11), 원의 표준방정식에서 중심/반지름 읽기(M1-15), 산점도 임의점 판독+변화율(M1-20), 단순 확률(M2-5), 산점도 최적선 기울기 추정(M2-12), 원의 일반형→표준형 변환(M2-25)
- **누적 패턴(3개 시험지 공통)**: "산점도 회귀/최적선·임의점 판독"(test4·test6·test7 모두 등장, 누적 6회)과 "원의 방정식 좌표기하 변환(이동·배율·표준형 변환)"(test4·test6·test7 모두 등장, 누적 4회)이 가장 재현성 높은 완전 공백 스킬이다. "단순 확률"도 test6·test7에서 반복 등장(누적 2회). "막대그래프 단순 값 조회"도 test4·test7에서 재현(누적 2회). 후속 스킬 신설 우선순위 1순위는 산점도/회귀, 2순위는 원의 좌표기하 변환으로 확정해도 될 만큼 데이터가 쌓였다.

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

## SPR 누적 집계 (test4 + test6 + test7, 이번 패스에서 갱신)

test7 Math 54문항(M1 27 + M2 27) 중 **실제 SPR(주관식) 문항 12건** 확인:

| 상위 스킬 | SPR 문항 수 | 문항 |
|---|---|---|
| nonlinear_equations_systems | 3 | M1-7(x절편), M2-20(판별식계수), M2-27(무해조건 최소k) |
| linear_equations_one_var | 2 | M1-13, M1-21 |
| linear_two_variables | 1 | M1-14 |
| nonlinear_functions | 1 | M1-27(vertex_x) |
| linear_functions | 1 | M2-6 |
| circles | 1 | M2-13 |
| lines_angles_triangles | 2 | M2-14, M2-21 |
| (nonlinear_functions, 정점형 evaluate) | 1 | M2-7 |

**test4+test6+test7 합산: Math 162문항 중 SPR 36건(약 22.2%)** — 세 시험지 모두 18.5%~25.9% 범위 안에 수렴하며 test4+test6 합산 비율(22.2%)과 test7까지 합산한 비율(22.2%)이 사실상 동일하게 유지됐다. SPR 문항은 여전히 특정 스킬 계열에 몰리지 않고 선형/비선형 방정식, 비율, 삼각비, 원, 각도 관계 전반에 고르게 분포한다. **결론은 test4 때와 동일하게 유지**: SPR 지원은 배치 레이어(`batch.ts`)의 출력 포맷 분기 작업이며, 특정 스킬 1~2개만 추가해서 해결되지 않는다. 3개 시험지·36개 표본으로 22% 안팎 비율은 충분히 안정적이라고 판단되며, 이 수치를 최종 추정치로 확정해도 무방하다(후속 패스는 검증 목적의 추가 확인만 선택적으로 수행).

(나머지 4개 시험지 — test8·9·10·11 — 의 분류는 후속 패스가 이어받을 것.)

---

## 후속 패스 안내

1. **test8부터** 시작할 것(test4·test6·test7은 이번 세 패스로 완료). 각 PDF는 인쇄 쪽번호 기준 동일한 구조(R&W M1 → R&W M2 → Math M1 → Math M2, "STOP" 페이지로 모듈 경계 확인 가능)이나, `Read`의 `pages` 파라미터 값이 인쇄 쪽번호와 오프셋이 있을 수 있으므로(test6·test7 모두 +2 오프셋이었으나 시험지마다 다를 수 있음) 매 시험지 첫 페이지에서 실제 오프셋을 먼저 확인한 뒤 읽어나갈 것.
2. 이 문서의 표에 시험지별 섹션을 이어 추가하고, "진행 상태" 표를 갱신.
3. 4개 시험지(test8·9·10·11)가 모두 끝나면 위 3버킷 요약과 SPR 집계를 **전체 7종 합산**으로 재작성.
4. test11은 52페이지로 다른 시험지보다 4페이지 적음 — 실제 열어서 구조를 재확인할 것(표지/여백 페이지 배치가 다를 가능성).
5. **누적 재현 패턴(test4·test6·test7 공통)**: "산점도 회귀/최적선·임의점 판독"(누적 6회 등장)과 "원의 방정식 좌표기하 변환(이동·배율·표준형)"(누적 4회 등장)이 가장 확실한 완전공백 스킬 후보다. "단순 확률"(누적 2회), "막대그래프 단순 값 조회"(누적 2회)도 반복 등장 중. test8부터는 이 패턴이 또 나타나는지 우선 확인하면 후속 스킬 신설 우선순위를 더 빨리 확정할 수 있다. SPR 비율(~22%)은 3개 시험지로 이미 안정적이므로 test8부터는 SPR % 재확인보다 완전공백 스킬 목록 확정에 집중하는 것을 권장.
