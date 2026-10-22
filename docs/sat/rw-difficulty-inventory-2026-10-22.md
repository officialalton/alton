# SAT R&W 난이도 재고 조사 (2026-10-22, 무료·읽기 전용)

범위: 유료 호출·DB 쓰기·공개 세트 변경 없음. 대상은 공개 SAT 30세트의 R&W 81문항(M1 27 + M2 쉬운 27 + M2 어려운 27)과 문제은행 재고. 기준 시각: 조사 시점의 원격 DB(`worpsqwqgnspddnrtnvq`) 읽기 결과.

## 1. 모듈별 난이도 분포 (공개 30세트, 전부 동일 구성)
| 모듈 | Easy | Medium | Hard |
|---|---|---|---|
| M1 (27) | 9 (33%) | 18 (67%) | 0 |
| M2 쉬운 (27) | 9 (33%) | 18 (67%) | 0 |
| M2 어려운 (27) | 0 | 18 (67%) | 9 (33%) |

- 30세트 모두 세트별 분포가 같다(세트 간 편차 0). 총 2,430문항은 모두 서로 다른 문항이다(세트 간 재사용 없음).
- 영역별 분포도 모듈마다 동일: Craft&Structure 8 / Information&Ideas 7 / Standard English 7 / Expression of Ideas 5. 영역 안 난이도 순서는 섞여 있다.
- M1·M2 쉬운 버전의 Hard는 0이다. 수학은 M1·M2 쉬운에서 Hard 약 23%(150/660)다. 이 비율을 R&W에 그대로 적용하지 않는다(아래 4절).

## 2. Hard 재고 (문제은행, 확정·미배정)
조건: `exam_system=sat_rw`, `format=mc`, `status=confirmed`, 보관 안 됨, `usage_scope in (mock_exam,both)`, 게시 버전 `render_check.ok`, `explanation_en` 있음, 본문에 한글 없음, 공개 또는 초안 세트에 배정되지 않음.

| 난이도 | 공개·초안 세트에 사용 | 미배정(사용 가능) |
|---|---|---|
| Easy | 540 | 77 |
| Medium | 1,620 | 128 |
| Hard | 270 | **71** |

미배정 Hard 71개의 영역·기술(skill) 분포:
| 영역 | 개수 | 기술 |
|---|---|---|
| Information & Ideas | 46 | central_ideas_details 39, command_of_evidence_text 4, inferences 3 |
| Craft & Structure | 20 | text_structure_purpose 13, cross_text_connections 6, words_in_context 1 |
| Standard English | 3 | boundaries 2, form_structure_sense 1 |
| Expression of Ideas | 2 | rhetorical_synthesis 2 |

- 재고가 central_ideas_details(39)와 text_structure_purpose(13)에 쏠려 있다. Standard English·Expression of Ideas는 5개뿐이다.
- 이 71개가 구조 중복·정답 위치·답 누설 검사를 별도로 통과했는지는 이번 조사에서 확인하지 않았다(공개 가능 게이트인 render/explanation_en/한글만 확인).

## 3. 난이도 라벨의 근거
- 라벨은 **생성 시 목표 난이도**다(`scripts/mock-exam-generation/batch-pipeline.ts`: 후보마다 `difficulty`를 지정하고 문항 생성 프롬프트에 "easy/medium/hard 문항 1개"로 요청).
- Easy/Medium은 `scripts/mock-exam-generation/rw-level.ts`의 `LEVEL_RULE`(추론 단계 수·오답 매력도 기준)로 생성하고, 독립 AI 감사가 `level_verdict`(too_easy/fits/too_hard)로 목표 난이도 적합성을 판정한다.
- Hard는 레시피(beyond medium)로 생성한다. 2026-09-18 표본 보고서(`docs/2026-09-17-step6-rw-batch-hard.md`)에는 "어려움으로 요청했지만 독립 검사 추정 난이도가 easy" 같은 미해소 검토 항목이 남아 있다.
- 캘리브레이션 증거 없음: `docs/2026-09-28-sat-adaptive-mock-exam-redesign-plan.md`는 "캘리브레이션·IRT·노출 이력 없음"을 명시하고, `docs/POLICY-DECISIONS.md`(2026-10-15)는 학생 응시 기반 난도 보정(정답률·풀이 시간·오답 분포·변별도)을 무료 공개 후 실제 응시 데이터로 하기로 확정했다.
- 결론: 라벨은 생성 목표+AI 감사 기반이고 실제 학생 데이터로 검증되지 않았다. 따라서 **라벨만 바꿔 Hard를 채우는 것은 근거가 없고 제안하지 않는다.**

## 4. 실제 SAT 모듈 난이도 구성: 문서로 확인된 것 / 모르는 것
(이번 조사에서 웹을 재확인하지 않았다. 아래는 일반적으로 알려진 College Board 공개 설명이며 재검증 필요.)
- 알려진 것: 디지털 SAT R&W는 모듈 2개, 모듈당 27문항, 모듈 2 난이도가 모듈 1 성적에 따라 적응된다. 모듈 1은 여러 난이도가 섞여 있다고 설명된다.
- 모르는 것: 모듈별 Easy/Medium/Hard 정확한 개수·비율은 공개 문서로 확인하지 못했다. 쉬운 모듈 2에 Hard가 들어가는지도 확인하지 못했다. 따라서 목표 구성은 오너가 정해야 한다.

## 5. 재편성 가능 여부
- 영역 정원(M1 기준 8/7/7/5)과 기술별 문항 수를 유지한 채 같은 기술·같은 슬롯의 Medium/Easy를 Hard로 교체하는 것만 가능하다. 기존 기능(`createMockExamNewVersionAction`: 공개 세트의 같은 그룹에 version+1 초안을 만들고 슬롯만 교체, 응시·답안·결과 보존, 공개는 원자적 교체)을 쓸 수 있다.
- 무료 재고만으로 가능한 상한: 미배정 Hard 71개 = 60개 모듈(30세트 × M1·M2 쉬운)에 평균 약 1.2개(약 4%). 기술이 쏠려 있어서, 해당 기술이 슬롯에 있는 모듈에만 들어간다. Standard English·Expression of Ideas 슬롯에 넣을 Hard는 5개뿐이다.
- 교체로 빠진 Medium/Easy 문항은 미배정 재고로 돌아간다(삭제 없음).
- 품질 유지 조건: 교체 문항도 구조 중복·답 누설·렌더 검사를 통과해야 한다(이번 조사는 미확인).

## 6. 유료 생성 결정 선택지 (실행 결정 아님)
기존 R&W 생성 실측: 2026-10-15 확장 실행에서 R&W 476개 채택에 $48.51(채택당 약 $0.121, `data/mock-exam-generation/sat-expand-20261015/gen/run.log`). Hard는 수율이 낮을 가능성이 커서 채택당 $0.12~0.25로 가정한다(추정, 미검증).

| 선택지 | 내용 | 비용 | 영향 |
|---|---|---|---|
| A | 변경 없음 | $0 | M1·M2 쉬운 Hard 0% 유지 |
| B | 미배정 Hard 71개만 새 버전 초안으로 교체 | $0 | 공개 세트 일부 변경. 기술 쏠림, 평균 모듈당 약 1.2개 |
| C | 오너가 목표 구성을 정한 뒤 부족한 Hard를 기술별로 생성 후 교체 | 예: 모듈당 Hard 3개(약 10%) 목표 시 180개 중 신규 약 110개 → $13~28(추정) | 공개 세트 일부 변경. 목표·예산 오너 결정 필요 |

필요한 오너 결정: M1과 M2 쉬운 버전의 Hard 목표(개수·비율), 교체 방식(새 버전 초안), 예산. 이 문서는 실행을 권고하지 않는다.
