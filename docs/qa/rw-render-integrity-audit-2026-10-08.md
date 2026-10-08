# RW 렌더 무결성 감사 (2026-10-08)

대상: 원격 non-prod 게시 RW 문항(보관 제외, usage_scope mock_exam/both) 1163개의 게시 버전. 읽기 전용 SELECT 만 사용. 재현: `scripts/qa/rw-render-integrity-audit.ts`.

## 결론
- 신고 1(05436224…, 표 누락처럼 보임): **데이터 정상, 관리자 신고 상세 화면의 렌더러 결함**. 학생 응시·결과·세트 미리보기·노트는 이미 figure 를 그린다. 상세 RPC 가 figure 를 내려주지 않고 화면도 그리지 않았다 → 수정(마이그레이션 20262100000360 + ReportedProblemsPanel).
- 신고 2(00d74665…, 밑줄 없음): **데이터 정상, 렌더러 결함**. 파이프라인은 Words in Context 인용형 문항의 대상 구절을 렌더러가 자동 밑줄(RwStimulusView.underlineTarget)로 그리도록 설계돼 있다(저작 규칙: 질문의 “…” 를 지문에서 찾아 그림, 지문에는 따옴표/__ 를 넣지 않음). 그러나 학생 응시·결과·세트 미리보기는 질문을 지문과 따로 저장·전달하므로 `s.question` 이 비어 밑줄이 한 번도 그려지지 않았다(관리자 초안 편집기는 질문이 합쳐진 fullText 라 정상이어서 발견 못 함). → `question` 속성 추가·전달로 수정.
- 명시적 표/그래프 참조(…below/above, shown in the table …)인데 figure·표가 없는 문항: **0건**. Command of Evidence (Quantitative) 중 figure 없는 문항: **0건**. underlined 를 가리키는데 __ 표시 없는 문항: **0건**(78개 전부 Text Structure and Purpose, 모두 표시 있음). 세트 스냅샷의 figure·본문은 게시 버전과 불일치 0건.
- 따라서 **데이터 수정용 새 초안 스크립트가 필요한 문항은 없다**(스크립트 미작성). 세트 content_snapshot 재조립도 불필요 — 렌더러 수정은 모든 기존 세트·응시에 즉시 적용된다.

## 영향 문항: 렌더러 수정으로만 해결(재렌더링만)
Words in Context 인용형, 지문에 밑줄 표시 없음(렌더러 자동 밑줄 대상): **104건**, 스킬별 {"words_in_context":104}. 인용 구절이 지문에 없는 문항(target_missing): 0건.

세트 포함 현황(게시 세트 기준, 보관 세트 제외): SAT Practice Test 1 에 7건(응시 2건 시작됨: 1 assigned+graded 포함 기록), Test 2~9 에 각 7~10건, 모두 응시 0건. 응시가 시작된 세트는 Practice Test 1 뿐이며, 렌더러 수정은 데이터를 바꾸지 않으므로 응시 기록·채점에 영향이 없다.

## 느슨한 단어 단서(표·그래프 낱말) — 모두 오탐
table/chart/diagram 낱말만 걸린 61건({"central_ideas_details":34,"text_structure_purpose":21,"boundaries":1,"words_in_context":5})은 전부 문학 지문의 일반 명사(kitchen table, cutting table, tide tables 등). 결함 아님. 엄격한 구조 표현만 게이트에 쓴다.

## 항목 목록(렌더러 수정 대상, 104건)
| 문항 ID | 게시 세트 | 대상 구절 |
|---|---|---|
| 00d74665-1500-4dcf-9e8e-b7c56218c96f | SAT Practice Test 1 (응시 2) | “receive the Atlantic on my back” |
| 01990482-cf4d-443a-a8bc-90dc787457a7 | SAT Practice Test 1 (응시 2) | “a lamp in the next room” |
| 07f27297-3792-4f5d-81af-faa2ed412ae4 | SAT Practice Test 1 (응시 2) | “brave the December frost” |
| 0b9961a8-1338-46bf-a570-e6631d3f8aac | SAT Practice Test 2 | “With this passion burn in hard and gem-like flame” |
| 0bf06ed0-31c8-452f-927a-348c75e1049c | SAT Practice Test 2 | “played to a steel undertone” |
| 0fdaa30c-f654-4f14-bf0f-bb7f05ce0165 | SAT Practice Test 1 (응시 2) | “a seam sewn so neatly” |
| 10ca55a7-0be9-49c9-a249-5a618966af91 | SAT Practice Test 1 (응시 2) | “the silence tuned itself to a single string” |
| 11b60a2c-9290-4c12-8ea7-19babf0f9b7b | SAT Practice Test 1 (응시 2) | “corroborated” |
| 129a993a-d654-45a1-8216-8b518001a42c | SAT Practice Test 3 | “the days passing over his head” |
| 13476e45-a6a3-41d4-8a30-aa03f31dc63f | SAT Practice Test 1 (응시 2) | “conceal” |
| 14c97a4d-be02-4b58-9f53-659355ed537e | SAT Practice Test 2 | “a medal pinned on the wrong chest” |
| 1661cc3f-6d9a-47ed-947f-1e6a39bc9d65 | SAT Practice Test 2 | “heighten” |
| 16ca0fbc-28c2-4f33-becd-8b6477190251 | SAT Practice Test 2 | “erosion” |
| 17d404a6-b21c-4893-8168-511c33596b89 | SAT Practice Test 2 | “pick out in a crowd” |
| 186537f7-9639-4787-8ecb-9f10d6517596 | SAT Practice Test 2 | “a lantern, not a stone” |
| 18cce398-c287-4e30-8c1f-25757e02e030 | SAT Practice Test 3 | “sudden resurrection of the proof” |
| 1ac4e5b2-9bd9-41d7-ac24-801bc90269d9 | SAT Practice Test 2 | “calculated” |
| 1c9f6208-0731-435c-8d1e-92c1a06e8ae9 | SAT Practice Test 2 | “a pocket sewn inside the silence” |
| 1db1254d-a211-4923-8c8f-d5564e9afd9d | SAT Practice Test 3 | “a door we had painted shut together” |
| 212409e8-09be-4937-904f-ac092fb2703f | SAT Practice Test 3 | “a bridge built perfectly to the wrong shore” |
| 284447eb-134f-44a7-a0db-e23728b9995a | SAT Practice Test 3 | “elaborate” |
| 2aae10a7-177e-4caa-8162-e51e1018e7cd | SAT Practice Test 4 | “Even like a stone” |
| 2d0accc8-6926-4e9d-a6d2-26380c0293b7 | SAT Practice Test 3 | “residue” |
| 2d735b6d-0dd0-46aa-82db-39e82ce16f46 | SAT Practice Test 2 | “a line strung with pegs and little else” |
| 30215904-2858-415d-b951-ba92a909d2ed | SAT Practice Test 5 | “like a flash of light in the darkness” |
| 33741737-6207-4394-ae75-2c2f5ee7b92c | SAT Practice Test 4 | “dwindled” |
| 40bfffe4-439e-4911-921a-88c603385184 | SAT Practice Test 5 | “a small country she could steep and drink alone” |
| 42855d20-329a-485e-9d0a-6aedee02f235 | SAT Practice Test 8 | “vigorous stirring-up of the minds of the masses” |
| 47c8f3d1-e260-46a7-bbd0-91776f1bc277 | SAT Practice Test 6 | “a locked chest washed ashore” |
| 4ab864e3-6d02-4009-8e83-959e2c6d9ae4 | SAT Practice Test 9 | “very much broken down” |
| 4c5016a5-4657-4d6c-b0a6-1c48a0f09605 | SAT Practice Test 5 | “her easily influenced spirits sprang again to hope” |
| 51a15833-6654-45a5-a644-9adf04873a52 | SAT Practice Test 6 | “he could stick on a saddle” |
| 55e7c384-a484-4bd0-b512-6e69263a3bcc | SAT Practice Test 7 | “resolve” |
| 578cb18d-dba1-4e2b-9041-53504a1ce126 | SAT Practice Test 7 | “like an accusation” |
| 58bb07a8-311f-4a1b-b051-301ed0b9c068 | SAT Practice Test 8 | “grazed our talk around the edges of one pasture” |
| 5959f6f9-4626-4e6f-819a-aa448ce10fa9 | SAT Practice Test 9 | “a door that opens from one side only” |
| 60283760-3701-4620-aff6-30da28ce6e53 | SAT Practice Test 4 | “stitching a new sentence onto a closed book” |
| 646407d2-4f16-4a05-b36d-10eb89527ae3 | SAT Practice Test 8 | “curtseying to one another” |
| 650d79b4-9299-4a24-9b78-7d9f39657a2e | SAT Practice Test 5 | “a fence he had built himself” |
| 676ca029-4ffc-4bd8-8099-70a1a5d29699 | SAT Practice Test 3 | “a tide line” |
| 681ce2c4-cb3b-40d8-8f20-b63cf1127745 | SAT Practice Test 9 | “enlist them in our cause” |
| 6858adae-d315-4db7-a97c-b7ffbc63f6c2 | SAT Practice Test 6 | “a verdict wrapped in tissue paper” |
| 68f11a7d-316e-4870-8262-0c56b644ccd6 | SAT Practice Test 4 | “dramatic” |
| 6c71ffbd-9e04-4ca1-af74-d278de04b8d3 | SAT Practice Test 4 | “as fast as if it was fixed on the ground” |
| 6f3efbc8-7387-4e90-8873-dd36e55084a1 | SAT Practice Test 8 | “the meal tilt on its hinge” |
| 7779ffb4-4aa3-4d1c-b735-9e70ba1ec2ee | SAT Practice Test 5 | “as a flower rejoices in sunshine” |
| 7880e283-b164-4ab4-9ad1-128abdc70ae2 | SAT Practice Test 9 | “Rules are coats” |
| 7aaf70fb-47f9-43e2-b7e7-a71edde449cb | SAT Practice Test 4 | “arrest” |
| 7f0f959b-855d-4311-9377-671235b5ddb4 | SAT Practice Test 5 | “before the pattern goes to sleep in your hands” |
| 8014d959-b56d-49b5-812f-630558787567 | SAT Practice Test 6 | “normalized” |
| 83241ccd-72ab-4c26-883f-b46cd1f62589 | SAT Practice Test 6 | “Colder than any stone” |
| 85518a57-68d2-49ee-bfac-cd3f21278932 | SAT Practice Test 7 | “a dumb immobility sat on the banks” |
| 89549a43-4409-4cc2-b512-0028b51c38f1 | SAT Practice Test 8 | “too weak for the ordinary incidents of life” |
| 8d966e98-d0f3-4aaf-b1c7-9de0f9f8e66f | SAT Practice Test 9 | “encoded” |
| 8ddfb1a7-17cb-4285-a549-84979fb5c5a3 | - | “discern” |
| 8f0cc319-75dc-4259-9320-ea7780fa9434 | - | “the ruling spirit of this place was Mrs. Barr” |
| 92292bb5-68d4-4dfe-a116-f4bd3a45a769 | SAT Practice Test 8 | “little tide” |
| 9731cddf-7cd9-4579-b641-2a5ed9403501 | SAT Practice Test 7 | “a language with one speaker left” |
| 9b74174c-7d1e-46d5-8bb3-20f10d8d10c3 | SAT Practice Test 7 | “a riverbed of linoleum” |
| 9bbd0a95-4736-4e61-8359-33f5f1c59aef | - | “respond” |
| 9e186974-265a-4728-b4ca-d2ae8f03a615 | - | “the slightest dribble of gold” |
| a432ce4c-cfac-4fd6-b9cc-1ada6eed7741 | - | “summoned from its grave” |
| a664a8d0-7ccf-44c0-adc7-9092bee7da11 | - | “scuttled like a frightened rabbit” |
| a7820628-0425-449b-84ce-9553b7b0eff6 | - | “slid up alongside of each other” |
| a79f6e53-f1c6-4784-8496-bdee02dd0254 | SAT Practice Test 8 | “a paper boat set on a calm puddle” |
| a7bed71d-1704-43cf-b60f-aa7f0f9638b0 | - | “eminently alive” |
| a95afcf3-2b2e-4835-a1ac-f77523a0343b | - | “we cheat ourselves with words” |
| b07e02d5-4b6b-43f1-b051-4b52a93fe760 | - | “yielded to his fingers like the wax of Hymettus” |
| b2577f75-11a5-4676-a8b2-70a38a348415 | SAT Practice Test 9 | “broker” |
| b290b95b-f7bc-4427-93e2-7bfb1a29e79d | - | “folded their shadowy garments round them” |
| b3d1da4a-3f67-493c-af19-4cd5e3f669e5 | SAT Practice Test 4 | “like an anchor fouled on the seabed” |
| b89ffea4-6186-4922-a91e-3fe3f1bf6d34 | SAT Practice Test 4 | “a lid pressed down on a simmering pot” |
| bc91cc0e-10fb-48f2-8f69-95f9235e10f8 | SAT Practice Test 4 | “a dry basin waiting for the thaw” |
| bfe74c4f-64b6-4904-a78d-2bf538fe760c | - | “she will not listen to reason” |
| c40eda06-e1ec-4c4f-ac06-ae7bab36fedb | SAT Practice Test 6 | “a book sewn with too few stitches” |
| c4270871-36d3-4874-af5c-b02123bddedb | SAT Practice Test 6 | “deciphered” |
| c76ca6bb-27c0-4aa2-879a-eb0351fd3241 | - | “as merry as the day was long” |
| c8bf64ed-7e0b-4e37-b49e-cb57f7d67814 | SAT Practice Test 7 | “like weather through a screen door” |
| c9c51221-93ac-4810-bb5e-9e77ced568b9 | SAT Practice Test 8 | “a lantern without oil” |
| ca177c8a-140d-4031-a950-4e3a8abe1f62 | SAT Practice Test 8 | “borrowed bread” |
| ca3cb485-047f-4948-8272-116e5d7e5682 | - | “permitted it to creep in and fill my heart” |
| cd0fc58f-36ff-434f-8550-3de668498947 | - | “The morning of my childish, happy days” |
| d07ca7d3-eec2-4221-bdd6-7fbca6489315 | SAT Practice Test 9 | “the only lease she had ever meant” |
| d2b2a8f2-7856-477f-ac27-617902131f00 | - | “so untutored” |
| d2c7728c-dac2-4ede-9c0b-8c052acabebd | - | “a distinct, unmistakable gap in her existence” |
| d3c1a6a7-6127-4428-9581-6ba425794916 | SAT Practice Test 4 | “like a coal I kept from going out” |
| d94032f8-5e49-4752-8be3-d686a280b7a4 | SAT Practice Test 5 | “a kite with no string” |
| d9d1abd7-933a-46aa-af35-32fae1634071 | - | “hung over us like a thunder-cloud” |
| d9dacc70-bb7e-434b-9392-e373c3f407d9 | SAT Practice Test 5 | “practicing the silence” |
| d9fe8b62-9cc1-4d03-825b-0656ffc9b5fe | - | “on the same principle by which a butcher weighs a ham” |
| e2e5a201-6162-4162-b367-cd86931b0300 | - | “placed in the field of a magnetic force” |
| e60ce1ba-948a-4488-a8fd-6d953e3ebf8f | SAT Practice Test 6 | “a sealed envelope” |
| e77eda01-a1c8-492f-92ff-a5f8efda3324 | SAT Practice Test 7 | “blight” |
| e845da6e-e7c1-4e75-883a-fb7148fd06cd | - | “a swallow perched on a wire that hums” |
| ea28ad20-dc0a-4755-90ac-ee14e92f1478 | - | “tended” |
| ea7465ec-8ef3-4f4a-adce-63e01d2c095e | SAT Practice Test 7 | “where nothing sinks quite all the way” |
| eac2f683-39d9-40bc-b289-161597f5a690 | SAT Practice Test 8 | “lending the stranger his own evening” |
| ebb5fbf0-6b9f-4e21-8aea-03857ab95954 | - | “as if she had just come from the class-room of a convent school” |
| ebd59088-8e38-4d27-80f4-af7b20ca2a49 | SAT Practice Test 9 | “wears his smile like a borrowed coat” |
| ed4f7512-c72e-4bc3-86c0-5e63fa825f0c | - | “as cold as ice” |
| f194a236-d663-4531-abf8-de31b8473ffe | SAT Practice Test 9 | “his plans had gone out with the wash” |
| f33f664f-f5a4-4dba-94fc-722b2cc50d48 | - | “survives on small deposits” |
| f8035f24-d038-4938-a772-00acde6199ac | - | “stirring the same pot of silence” |
| fa633ebd-971f-48ef-b826-4d6004b774e5 | - | “the rumor had found the one door left unlocked” |

## 게이트 강화(lib/rw-stimulus.ts checkRwStructure → 품질 계약 → 초안·임포트·공개 게이트)
- 질문·지문이 `… table/graph/chart/figure/diagram below/above`, `shown in the table`, `data from the table`, `the table shows` 등 **명시적 표현**으로 자료를 가리키면 figure 또는 표가 있어야 함(`rw_data_missing`). 기존 Quant 규칙은 유지.
- 질문이 `underlined` 를 가리키면(TSP 외 모든 RW 유형 포함) 지문에 `__…__` 표시 필수(`rw_target`).
- 현재 게시 문항 1163개에 새 규칙을 돌린 결과 위반 0건(기존 게시본이 새로 막히지 않음).
