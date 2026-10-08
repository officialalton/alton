# RW 정답 누설 감사 (2026-10-08)

대상: 게시(published) 버전의 RW 선택형 1295건(문제은행 mock_exam/both, 보관 제외). 그중 게시 세트에 들어간 문항 727건.
방법: (a) 질문↔선택지 어휘·주체 겹침, (b) 선택지 틀·길이 비대칭 — 감지기 `scripts/mock-exam-generation/answer-leak-detector.ts`; (c) 블라인드 풀이 — claude-haiku-4-5 가 지문·자료 없이 질문+선택지만 보고 2회(원래 순서/뒤집은 순서) 풀이. 전수 실행. 모델 비용 합계 $1.12.

판정: **confirmed** = 2회 모두 정답을 맞히고 둘 다 확신 high(어휘·구두점·전환·형식·수사 합성은 지식·목표 문구 때문일 수 있어 감지기 신호가 함께 있을 때만 확정). **suspect** = 감지기 신호만 있거나 한 번이라도 high 로 맞힘. 우연 기대치는 정답률 25%.

## 1. 유형별 집계

| 유형 | 문항 | 감지기 플래그 | 강한 신호 | 블라인드 평균 정답률 | 2회 모두 정답 | 2회 모두 high | confirmed | suspect |
|---|---|---|---|---|---|---|---|---|
| central_ideas_details | 381 | 6 (2%) | 0 | 86% | 80% | 0% | 0 (0%) | 7 |
| text_structure_purpose | 220 | 4 (2%) | 0 | 83% | 74% | 0% | 0 (0%) | 4 |
| form_structure_sense | 139 | 0 (0%) | 0 | 44% | 27% | 0% | 0 (0%) | 0 |
| boundaries | 138 | 0 (0%) | 0 | 36% | 17% | 2% | 0 (0%) | 0 |
| words_in_context | 129 | 0 (0%) | 0 | 87% | 81% | 9% | 0 (0%) | 0 |
| rhetorical_synthesis | 105 | 1 (1%) | 1 | 97% | 94% | 72% | 1 (1%) | 0 |
| transitions | 90 | 0 (0%) | 0 | 34% | 17% | 0% | 0 (0%) | 0 |
| command_of_evidence_text | 32 | 15 (47%) | 3 | 89% | 84% | 53% | 17 (53%) | 10 |
| inferences | 21 | 3 (14%) | 1 | 86% | 76% | 0% | 0 (0%) | 3 |
| command_of_evidence_quant | 20 | 5 (25%) | 1 | 90% | 85% | 40% | 8 (40%) | 2 |
| cross_text_connections | 20 | 2 (10%) | 0 | 93% | 85% | 0% | 0 (0%) | 2 |
| **합계** | 1295 | 36 | 6 | | | | 26 | 28 |

해석 메모: 블라인드 정답률이 높은 서사·추론 유형(central_ideas·text_structure·cross_text)은 대부분 확신이 low/medium 이다 — 오답이 '그럴듯하지 않아서' 지문 없이 일반 상식으로 소거되는 약한 형태의 누설(기저율 25% 대비 80% 이상)로, 이번 확정 기준(high×2)에는 안 걸리지만 오답 품질 개선 후보다. rhetorical_synthesis 는 질문에 목표가 있어 정답률이 높은 것이 구조상 자연스럽다(감지기 신호가 있는 것만 확정). form_structure_sense·transitions·boundaries 는 25~44%로 정상.

## 2. confirmed / suspect 문항

| 판정 | problem id | version | 유형 | 난이도 | 게시 세트(모듈 위치) | 사유 | 블라인드(원/역, 확신) |
|---|---|---|---|---|---|---|---|
| confirmed | e02951c8-3dcc-492b-82a3-e147fd30c1b0 | v1 | command_of_evidence_quant | medium | SAT Practice Test 3 (replaced, had duplicates) rw_m2#54; SAT Practice Test 3 rw_m2#54; SAT Practice Test 3 (new) failed 1791402627358 rw_m2#54 | 정답이 가장 긴 선택지(25단어, 오답 최대 19) | 정답(high) / 정답(high) |
| confirmed | 6d506f25-30d9-4cb9-a576-062b2a0318ef | v1 | command_of_evidence_quant | medium | SAT Practice Test 8 (replaced, had duplicates) rw_m1#23; 테스트 세트 4 null#7; SAT Practice Test 12 rw_m1#23; SAT Practice Test 7 (replaced, had duplicates) rw_m1#23; SAT Practice Test 16 rw_m1#23; SAT Practice Test 6 (replaced, had duplicates) rw_m1#25; SAT Practice Test 5 (replaced, had duplicates) rw_m1#17; SAT Practice Test 4 rw_m1#22; SAT Practice Test 13 rw_m1#23; SAT Practice Test 9 (replaced, had duplicates) rw_m1#23; SAT Practice Test 4 (replaced, had duplicates) rw_m1#25; SAT Practice Test 11 rw_m1#21; SAT Practice Test 14 rw_m1#23; SAT Practice Test 10 rw_m1#23; SAT Practice Test 15 rw_m1#23; 테스트 세트 2 null#7; 테스트 세트 3 null#7 | 정답이 가장 긴 선택지(39단어, 오답 최대 23) | 정답(high) / 정답(high) |
| confirmed | 1d6de7ce-e2e7-456b-aa9c-a6ba4d7ecff4 | v1 | command_of_evidence_quant | easy | SAT Practice Test 1 rw_m2#31 | 블라인드 high 정답 | 정답(high) / 정답(high) |
| confirmed | d0d1f13b-3c71-402c-8c24-d38331a0a400 | v1 | command_of_evidence_quant | medium | SAT Practice Test 3 (replaced, had duplicates) rw_m2#51; SAT Practice Test 3 rw_m2#51; SAT Practice Test 3 (new) failed 1791402627358 rw_m2#51 | 정답이 가장 긴 선택지(32단어, 오답 최대 20) | 정답(high) / 정답(high) |
| confirmed | d5b2f6f8-ab0a-44e5-b19e-cf9ed6786364 | v1 | command_of_evidence_quant | easy | SAT Practice Test 8 rw_m2#34; SAT Practice Test 8 (replaced, had duplicates) rw_m1#8 | 블라인드 high 정답 | 정답(high) / 정답(high) |
| confirmed | 05436224-0db3-4638-a706-62f214e86c80 | v1 | command_of_evidence_quant | easy | SAT Practice Test 1 rw_m1#4 | 질문이 지목한 대상을 주어로 삼은 선택지가 정답뿐 | 정답(high) / 정답(high) |
| confirmed | ea00034d-78e3-4765-80c2-99937809f69c | v1 | command_of_evidence_quant | medium | SAT Practice Test 3 (replaced, had duplicates) rw_m2#67; SAT Practice Test 3 rw_m2#67; SAT Practice Test 3 (new) failed 1791402627358 rw_m2#67 | 블라인드 high 정답 | 정답(high) / 정답(high) |
| confirmed | 914d89ba-1dd4-400f-911f-a7f5eb7fd027 | v1 | command_of_evidence_quant | hard | SAT Practice Test 8 rw_m2#76; 테스트 세트 4 null#10; SAT Practice Test 6 (replaced, had duplicates) rw_m2#77; 테스트 세트 2 null#13; 테스트 세트 3 null#10 | 정답이 가장 긴 선택지(29단어, 오답 최대 21) | 정답(high) / 정답(high) |
| confirmed | 35a1d518-f01b-4d98-819f-a8fffe2e5c8e | v1 | command_of_evidence_text | medium | SAT Practice Test 1 rw_m2#52 | 블라인드 high 정답 | 정답(high) / 정답(high) |
| confirmed | 9b3cf629-1b44-4181-a1d1-896e0c67b2c8 | v1 | command_of_evidence_text | easy | SAT Practice Test 6 (replaced, had duplicates) rw_m2#32; SAT Practice Test 6 rw_m1#7 | 질문이 지목한 대상을 주어로 삼은 선택지가 정답뿐 | 정답(high) / 정답(high) |
| confirmed | f7249169-66be-455f-9b8e-3baad7409b1b | v1 | command_of_evidence_text | medium | SAT Practice Test 8 (replaced, had duplicates) rw_m1#26; SAT Practice Test 12 rw_m1#26; SAT Practice Test 7 (replaced, had duplicates) rw_m1#26; SAT Practice Test 16 rw_m1#26; SAT Practice Test 6 (replaced, had duplicates) rw_m1#26; SAT Practice Test 5 (replaced, had duplicates) rw_m1#26; SAT Practice Test 13 rw_m1#26; SAT Practice Test 6 rw_m1#27; SAT Practice Test 9 (replaced, had duplicates) rw_m1#26; SAT Practice Test 4 (replaced, had duplicates) rw_m1#26; SAT Practice Test 11 rw_m1#26; SAT Practice Test 14 rw_m1#26; SAT Practice Test 10 rw_m1#26; SAT Practice Test 15 rw_m1#26 | 질문의 주체·수치를 정답만 반복(정답 1개 고유 일치, 오답 0); 정답이 가장 긴 선택지(22단어, 오답 최대 13) | 정답(high) / 정답(high) |
| confirmed | 63092332-9f6c-4ee4-8eec-5e8a64073230 | v1 | command_of_evidence_text | hard | SAT Practice Test 7 rw_m2#76; SAT Practice Test 6 (replaced, had duplicates) rw_m2#74 | 블라인드 high 정답 | 정답(high) / 정답(high) |
| confirmed | 605ae0bd-51a5-4bbe-a0e4-7b10e3f823b4 | v1 | command_of_evidence_text | medium | SAT Practice Test 8 (replaced, had duplicates) rw_m2#60; SAT Practice Test 12 rw_m2#60; SAT Practice Test 7 (replaced, had duplicates) rw_m2#44; SAT Practice Test 16 rw_m2#60; SAT Practice Test 6 (replaced, had duplicates) rw_m2#60; SAT Practice Test 5 (replaced, had duplicates) rw_m2#49; SAT Practice Test 13 rw_m2#60; SAT Practice Test 1 rw_m2#71; SAT Practice Test 9 (replaced, had duplicates) rw_m2#58; SAT Practice Test 4 (replaced, had duplicates) rw_m2#62; SAT Practice Test 11 rw_m2#58; SAT Practice Test 14 rw_m2#60; SAT Practice Test 10 rw_m2#58; SAT Practice Test 15 rw_m2#60 | 블라인드 high 정답 | 정답(high) / 정답(high) |
| confirmed | 94c916b3-ade5-457c-ab91-f23d936dfb24 | v1 | command_of_evidence_text | hard | SAT Practice Test 9 (replaced, had duplicates) rw_m2#75 | 정답이 가장 긴 선택지(38단어, 오답 최대 27) | 정답(high) / 정답(high) |
| confirmed | d70c7540-c2b8-4eca-ad1b-de61606b9794 | v1 | command_of_evidence_text | medium | SAT Practice Test 3 (replaced, had duplicates) rw_m2#64; SAT Practice Test 3 rw_m2#64; SAT Practice Test 3 (new) failed 1791402627358 rw_m2#64 | 정답이 가장 긴 선택지(24단어, 오답 최대 16) | 정답(high) / 정답(high) |
| confirmed | a69f456b-e0c1-4d2e-bedd-a0705c3ce53f | v1 | command_of_evidence_text | medium | SAT Practice Test 2 (replaced, had duplicates) rw_m2#54; SAT Practice Test 2 rw_m2#54; SAT Practice Test 2 (new) failed 1791402627213 rw_m2#54 | 블라인드 high 정답 | 정답(high) / 정답(high) |
| confirmed | fe440ce7-9ba1-4459-8391-e6c70de73637 | v1 | command_of_evidence_text | medium | SAT Practice Test 8 (replaced, had duplicates) rw_m1#27; SAT Practice Test 12 rw_m1#27; SAT Practice Test 7 (replaced, had duplicates) rw_m1#27; SAT Practice Test 16 rw_m1#27; SAT Practice Test 6 (replaced, had duplicates) rw_m1#27; SAT Practice Test 5 (replaced, had duplicates) rw_m1#27; SAT Practice Test 13 rw_m1#27; SAT Practice Test 6 rw_m2#54; SAT Practice Test 9 (replaced, had duplicates) rw_m1#27; SAT Practice Test 4 (replaced, had duplicates) rw_m1#27; SAT Practice Test 11 rw_m1#27; SAT Practice Test 14 rw_m1#27; SAT Practice Test 10 rw_m1#27; SAT Practice Test 15 rw_m1#27 | 정답이 가장 긴 선택지(33단어, 오답 최대 14) | 정답(high) / 정답(high) |
| confirmed | cc982d94-1094-4244-ad62-b0fedf885951 | v1 | command_of_evidence_text | medium | SAT Practice Test 3 (replaced, had duplicates) rw_m1#26; SAT Practice Test 3 rw_m1#26; SAT Practice Test 3 (new) failed 1791402627358 rw_m1#26 | 질문의 주체·수치를 정답만 반복(정답 1개 고유 일치, 오답 0) | 정답(high) / 정답(high) |
| confirmed | a3d1c15b-750e-46e6-b883-061efe1f7a19 | v1 | command_of_evidence_text | medium | SAT Practice Test 2 (replaced, had duplicates) rw_m2#53; SAT Practice Test 2 rw_m2#53; SAT Practice Test 2 (new) failed 1791402627213 rw_m2#53 | 블라인드 high 정답 | 정답(high) / 정답(high) |
| confirmed | 1595e9a1-2f19-4ab6-a786-2d214e8ce9d4 | v1 | command_of_evidence_text | medium | SAT Practice Test 1 rw_m1#22 | 정답이 가장 긴 선택지(28단어, 오답 최대 21) | 정답(high) / 정답(high) |
| confirmed | 549aa1a3-d7a2-4dd7-8e68-29953aa6f10c | v1 | command_of_evidence_text | hard | SAT Practice Test 7 rw_m2#74; SAT Practice Test 4 (replaced, had duplicates) rw_m2#77 | 블라인드 high 정답 | 정답(high) / 정답(high) |
| confirmed | 0fb15d18-04f9-4ccb-9a14-0b767224c1ac | v1 | command_of_evidence_text | medium | SAT Practice Test 1 rw_m1#20 | 블라인드 high 정답 | 정답(high) / 정답(high) |
| confirmed | d20c7b33-a3e4-45a7-be83-75556c6f8a96 | v1 | command_of_evidence_text | medium | SAT Practice Test 3 (replaced, had duplicates) rw_m2#53; SAT Practice Test 3 rw_m2#53; SAT Practice Test 3 (new) failed 1791402627358 rw_m2#53 | 블라인드 high 정답 | 정답(high) / 정답(high) |
| confirmed | f74978a4-0460-43af-aea4-d908855189c5 | v1 | command_of_evidence_text | easy | SAT Practice Test 9 rw_m2#35; SAT Practice Test 9 (replaced, had duplicates) rw_m2#36 | 블라인드 high 정답 | 정답(high) / 정답(high) |
| confirmed | 745b388d-1fb9-479b-9e93-330f2284930a | v1 | command_of_evidence_text | hard | SAT Practice Test 7 (replaced, had duplicates) rw_m2#74; SAT Practice Test 9 rw_m2#76 | 블라인드 high 정답 | 정답(high) / 정답(high) |
| confirmed | 92bdadff-e8f7-4f0c-acae-c15ca738fbfb | v1 | rhetorical_synthesis | medium | SAT Practice Test 8 rw_m1#22 | 질문 문구 그대로 반복: 정답만 7토큰 연속 일치(오답 최대 3) | 정답(high) / 정답(high) |
| suspect | 424b7610-b0eb-4bb5-a478-871cce4fe78f | v1 | central_ideas_details | easy | SAT Practice Test 11 rw_m2#29 | 정답이 가장 긴 선택지(23단어, 오답 최대 16) | 정답(medium) / 정답(medium) |
| suspect | 069e774f-1a8d-4969-b457-a1234ebd02d4 | v1 | central_ideas_details | medium | SAT Practice Test 2 (replaced, had duplicates) rw_m2#55; SAT Practice Test 2 rw_m2#55; SAT Practice Test 2 (new) failed 1791402627213 rw_m2#55 | 정답이 가장 긴 선택지(25단어, 오답 최대 18) | 정답(medium) / 정답(medium) |
| suspect | 831a4f88-9baf-4481-b907-5e2454933f94 | v1 | central_ideas_details | medium | - | 정답이 가장 긴 선택지(22단어, 오답 최대 15) | 정답(medium) / 정답(medium) |
| suspect | 9543e92d-f90c-4314-bfa1-50d02d356866 | v1 | central_ideas_details | medium | - | 정답이 가장 긴 선택지(28단어, 오답 최대 20) | 정답(medium) / 정답(medium) |
| suspect | ce8735fe-9db0-479d-8204-5445b46f9586 | v1 | central_ideas_details | medium | - | 블라인드 high 정답 | 정답(high) / 정답(medium) |
| suspect | b508909d-82cb-4caf-ae0b-d437947f0d52 | v1 | central_ideas_details | medium | - | 정답이 가장 긴 선택지(26단어, 오답 최대 19) | 정답(medium) / 정답(medium) |
| suspect | dd2b12c8-2b5d-4987-88ab-eeabafbc46b0 | v1 | central_ideas_details | easy | - | 선택지 틀 비대칭: 오답끼리 0.57 vs 정답↔오답 0.03 | 정답(low) / 정답(low) |
| suspect | 70617e07-2592-4bd7-897a-adc4ee5d07d3 | v1 | command_of_evidence_quant | hard | SAT Practice Test 4 rw_m2#76; SAT Practice Test 4 (replaced, had duplicates) rw_m2#79 | 블라인드 high 정답 | 정답(medium) / 정답(high) |
| suspect | a1c0cfcb-8bac-4258-8259-a90043442d36 | v1 | command_of_evidence_quant | easy | SAT Practice Test 7 (replaced, had duplicates) rw_m1#6; SAT Practice Test 6 rw_m2#35 | 블라인드 high 정답 | 정답(high) / 정답(medium) |
| suspect | 985be8e6-ba0e-4633-8c87-671482436754 | v1 | command_of_evidence_text | hard | SAT Practice Test 10 rw_m2#78 | 정답이 가장 긴 선택지(42단어, 오답 최대 29) | 정답(medium) / 정답(medium) |
| suspect | bdbd62b8-3068-4bcb-91f9-0f2914ea84bf | v1 | command_of_evidence_text | medium | SAT Practice Test 2 (replaced, had duplicates) rw_m2#71; SAT Practice Test 2 rw_m2#71; SAT Practice Test 2 (new) failed 1791402627213 rw_m2#71 | 블라인드 high 정답 | 정답(high) / 정답(medium) |
| suspect | 82529d72-9351-4e2e-8132-e0603afdf013 | v1 | command_of_evidence_text | easy | SAT Practice Test 12 rw_m2#31; SAT Practice Test 16 rw_m2#31; SAT Practice Test 4 rw_m2#35; SAT Practice Test 13 rw_m2#31; SAT Practice Test 4 (replaced, had duplicates) rw_m2#33; SAT Practice Test 11 rw_m2#32; SAT Practice Test 14 rw_m2#31; SAT Practice Test 10 rw_m2#33; SAT Practice Test 15 rw_m2#31 | 정답이 가장 긴 선택지(25단어, 오답 최대 17) | 정답(medium) / 정답(medium) |
| suspect | 300cb371-bf71-4f18-8f1f-9112ff40fe3d | v1 | command_of_evidence_text | easy | SAT Practice Test 2 (replaced, had duplicates) rw_m1#6; SAT Practice Test 2 rw_m1#6; SAT Practice Test 2 (new) failed 1791402627213 rw_m1#6 | 정답이 가장 긴 선택지(30단어, 오답 최대 19) | 정답(medium) / 정답(medium) |
| suspect | 8f0ada5b-ea50-46ea-84df-1eefa5e90fba | v1 | command_of_evidence_text | hard | SAT Practice Test 8 (replaced, had duplicates) rw_m2#75 | 정답이 가장 긴 선택지(34단어, 오답 최대 25) | 정답(medium) / 정답(medium) |
| suspect | 6f9f27c9-ca35-4f65-83f5-0e74223a6900 | v1 | command_of_evidence_text | medium | SAT Practice Test 2 (replaced, had duplicates) rw_m1#26; SAT Practice Test 7 (replaced, had duplicates) rw_m2#61; SAT Practice Test 5 (replaced, had duplicates) rw_m2#67; SAT Practice Test 2 rw_m1#26; SAT Practice Test 2 (new) failed 1791402627213 rw_m1#26 | 정답이 가장 긴 선택지(25단어, 오답 최대 19) | 오답(medium) / 오답(medium) |
| suspect | 412f64f2-e6a3-4057-80ee-cb21048836f6 | v1 | command_of_evidence_text | medium | SAT Practice Test 8 (replaced, had duplicates) rw_m2#38; SAT Practice Test 12 rw_m2#39; SAT Practice Test 7 (replaced, had duplicates) rw_m2#38; SAT Practice Test 16 rw_m2#39; SAT Practice Test 6 (replaced, had duplicates) rw_m2#39; SAT Practice Test 5 (replaced, had duplicates) rw_m2#43; SAT Practice Test 13 rw_m2#39; SAT Practice Test 1 rw_m2#63; SAT Practice Test 9 (replaced, had duplicates) rw_m2#38; SAT Practice Test 4 (replaced, had duplicates) rw_m2#41; SAT Practice Test 11 rw_m2#38; SAT Practice Test 14 rw_m2#39; SAT Practice Test 10 rw_m2#38; SAT Practice Test 15 rw_m2#39 | 블라인드 high 정답 | 정답(high) / 정답(medium) |
| suspect | cde7ef56-02cd-4012-988b-ece4669db8ef | v1 | command_of_evidence_text | medium | SAT Practice Test 3 (replaced, had duplicates) rw_m2#49; SAT Practice Test 3 rw_m2#49; SAT Practice Test 3 (new) failed 1791402627358 rw_m2#49 | 선택지 틀 비대칭: 오답끼리 0.22 vs 정답↔오답 0.01 | 정답(medium) / 정답(medium) |
| suspect | 2fe46f9c-3dc7-49f8-93b7-56892a11040f | v1 | command_of_evidence_text | hard | SAT Practice Test 3 (replaced, had duplicates) rw_m2#74; SAT Practice Test 3 rw_m2#74; SAT Practice Test 3 (new) failed 1791402627358 rw_m2#74 | 정답이 가장 긴 선택지(40단어, 오답 최대 28) | 정답(high) / 정답(medium) |
| suspect | 4b2c4ad1-3a9a-47eb-8b34-ead73313e905 | v1 | command_of_evidence_text | easy | SAT Practice Test 3 (replaced, had duplicates) rw_m1#7; SAT Practice Test 3 rw_m1#7; SAT Practice Test 3 (new) failed 1791402627358 rw_m1#7 | 정답이 가장 긴 선택지(25단어, 오답 최대 17) | 정답(medium) / 정답(medium) |
| suspect | 4afabf84-e589-4100-8833-1f29469ca2df | v1 | cross_text_connections | easy | SAT Practice Test 3 (replaced, had duplicates) rw_m1#6; SAT Practice Test 1 rw_m2#35 | 정답이 가장 긴 선택지(21단어, 오답 최대 16) | 정답(medium) / 정답(medium) |
| suspect | b7b12e03-7848-424f-99c8-6790ef461744 | v1 | cross_text_connections | medium | SAT Practice Test 2 (replaced, had duplicates) rw_m2#70; SAT Practice Test 2 rw_m2#70; SAT Practice Test 2 (new) failed 1791402627213 rw_m2#70 | 정답이 가장 긴 선택지(23단어, 오답 최대 16) | 정답(low) / 정답(low) |
| suspect | 4e26f3fb-b3ed-458a-923c-28c851d2237f | v1 | inferences | easy | SAT Practice Test 3 (replaced, had duplicates) rw_m2#32; SAT Practice Test 3 rw_m2#32; SAT Practice Test 3 (new) failed 1791402627358 rw_m2#32 | 정답이 가장 긴 선택지(22단어, 오답 최대 16) | 정답(medium) / 정답(low) |
| suspect | f590d74f-f49b-4cae-9638-d93762012314 | v1 | inferences | easy | SAT Practice Test 9 rw_m1#8; SAT Practice Test 9 (replaced, had duplicates) rw_m1#9 | 정답이 가장 긴 선택지(16단어, 오답 최대 12) | 정답(medium) / 정답(low) |
| suspect | 52dbdfbf-17fb-4b6f-9804-ca76a2d60ebd | v1 | inferences | easy | SAT Practice Test 12 rw_m1#5; SAT Practice Test 16 rw_m1#4; SAT Practice Test 4 rw_m1#5; SAT Practice Test 13 rw_m1#5; SAT Practice Test 4 (replaced, had duplicates) rw_m1#7; SAT Practice Test 11 rw_m1#5; SAT Practice Test 14 rw_m1#5; SAT Practice Test 10 rw_m1#5; SAT Practice Test 15 rw_m1#5 | 질문의 주체·수치를 정답만 반복(정답 1개 고유 일치, 오답 0) | 정답(low) / 정답(low) |
| suspect | 97d50145-2e13-4e97-b8da-b47d9c5a4942 | v1 | text_structure_purpose | hard | 테스트 세트 4 null#11; SAT Practice Test 12 rw_m2#77; 테스트 세트 2 null#14; 테스트 세트 3 null#11 | 정답이 가장 긴 선택지(23단어, 오답 최대 17) | 정답(low) / 오답(low) |
| suspect | bb1623dd-e7fd-46d7-b5de-17aedcb3f3ff | v1 | text_structure_purpose | medium | SAT Practice Test 16 rw_m2#72 | 정답이 가장 긴 선택지(19단어, 오답 최대 14) | 정답(medium) / 정답(medium) |
| suspect | ba3ff582-4053-43a5-9d7c-0af0207593c0 | v1 | text_structure_purpose | hard | SAT Practice Test 14 rw_m2#79 | 정답이 가장 긴 선택지(25단어, 오답 최대 19) | 정답(low) / 정답(low) |
| suspect | a70180c2-9bb5-452d-8e6e-f52d17e70451 | v1 | text_structure_purpose | hard | SAT Practice Test 13 rw_m2#78 | 정답이 가장 긴 선택지(31단어, 오답 최대 21) | 정답(medium) / 정답(medium) |

## 3. command_of_evidence_quant 전수 (20건)

| problem id | 난이도 | 형식 | 감지기 | 블라인드(확신) | 판정 | 질문 |
|---|---|---|---|---|---|---|
| e02951c8-3dcc-492b-82a3-e147fd30c1b0 | medium | complete-the-text | 정답이 가장 긴 선택지(25단어, 오답 최대 19) | 정답(high) / 정답(high) | confirmed | Which choice most effectively uses data from the table to complete the statement: "The star's brightness chang |
| 8ee2d721-5afd-4535-99cc-9765f6781d4b | hard | claim-in-passage | - | 오답(medium) / 오답(medium) | clear | Which choice most effectively uses data from the table to support the student's claim? |
| 6d506f25-30d9-4cb9-a576-062b2a0318ef | medium | claim-in-question | 정답이 가장 긴 선택지(39단어, 오답 최대 23) | 정답(high) / 정답(high) | confirmed | Which choice most effectively uses data from the table to illustrate that increases in bicycle commuting were  |
| 1d6de7ce-e2e7-456b-aa9c-a6ba4d7ecff4 | easy | claim-in-question | - | 정답(high) / 정답(high) | confirmed | Which choice most effectively uses data from the table to support the claim that export value grew the most be |
| c3c6772d-ed56-4238-9b0a-5ea747cceb5e | medium | claim-in-passage | - | 정답(medium) / 정답(medium) | clear | Which choice most effectively uses data from the table to support the reporter's statement? |
| 80571cb5-de3c-4ee5-925c-192a362a2b12 | medium | complete-the-text | - | 정답(low) / 정답(low) | clear | Which choice most effectively uses data from the graph to complete the statement: "The difference in per-capit |
| fdb934d2-72f1-472c-80ef-616551abc292 | medium | complete-the-text | - | 정답(medium) / 정답(medium) | clear | Which choice most effectively uses data from the graph to complete the statement: "The greatest increase in av |
| abc08190-cb4e-4189-a3e6-325fb165a973 | easy | claim-in-passage | - | 정답(low) / 정답(low) | clear | Which choice most effectively uses data from the table to support the biologist's claim? |
| d0d1f13b-3c71-402c-8c24-d38331a0a400 | medium | complete-the-text | 정답이 가장 긴 선택지(32단어, 오답 최대 20) | 정답(high) / 정답(high) | confirmed | Which choice most effectively uses data from the table to complete the statement: "Among the reef sites studie |
| d5b2f6f8-ab0a-44e5-b19e-cf9ed6786364 | easy | claim-in-question | - | 정답(high) / 정답(high) | confirmed | Which choice most effectively uses data from the table to support the claim that Planet Y takes longer to orbi |
| 70617e07-2592-4bd7-897a-adc4ee5d07d3 | hard | claim-in-question | - | 정답(medium) / 정답(high) | suspect | Which choice most effectively uses data from the table to support the researchers' hypothesis that greater dec |
| 05436224-0db3-4638-a706-62f214e86c80 | easy | claim-in-question | 질문이 지목한 대상을 주어로 삼은 선택지가 정답뿐 | 정답(high) / 정답(high) | confirmed | Which choice most effectively uses data from the table to support the claim that Painter C has the fewest surv |
| 64c687f2-1a2e-4d38-b944-863769699de5 | medium | claim-in-passage | - | 오답(medium) / 정답(medium) | clear | Which choice most effectively uses data from the table to support the engineer's statement? |
| a1c0cfcb-8bac-4258-8259-a90043442d36 | easy | claim-in-question | - | 정답(high) / 정답(medium) | suspect | Which choice most effectively uses data from the graph to illustrate the claim that Route 12 experienced the g |
| ccae2278-a9e8-469d-ab08-7df7addf9ea7 | medium | claim-in-passage | - | 정답(medium) / 정답(medium) | clear | Which choice most effectively uses data from the table to support the student's claim? |
| 62921559-c13b-41b6-a1c2-040eafd6b26c | medium | claim-in-passage | - | 정답(medium) / 정답(medium) | clear | Which choice most effectively uses data from the table to illustrate the claim? |
| 2fd13ae3-fb83-4f61-9de0-f2afd4d524e5 | medium | complete-the-text | - | 정답(medium) / 오답(medium) | clear | Which choice most effectively uses data from the graph to complete the statement: "The largest decrease in ave |
| ea00034d-78e3-4765-80c2-99937809f69c | medium | complete-the-text | - | 정답(high) / 정답(high) | confirmed | Which choice most effectively uses data from the table to complete the statement: "Across the ten-year period, |
| 917ba514-88f6-4631-92c8-fcb7b686702f | easy | complete-the-text | - | 정답(medium) / 정답(medium) | clear | Which choice most effectively uses data from the table to complete the following statement: A researcher claim |
| 914d89ba-1dd4-400f-911f-a7f5eb7fd027 | hard | claim-in-question | 정답이 가장 긴 선택지(29단어, 오답 최대 21) | 정답(high) / 정답(high) | confirmed | Which choice most effectively uses data from the graph to support the botanist's hypothesis that germination r |

형식 분포: {"complete-the-text":7,"claim-in-passage":6,"claim-in-question":7}

