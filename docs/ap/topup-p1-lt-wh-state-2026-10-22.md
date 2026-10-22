# Physics 1 5th · Eng Lit 5th · World History 4th — 상태 노트 (체크포인트, 2026-10-22)

브랜치 `ap-topup-p1-lt-wh` (워크트리 `~/Developer/ALTON-worktrees/ap-topup-p1lw`). main·통합 브랜치는 건드리지 않았다. DB·관리자 화면·Production 접근 없음(읽기도 없음).

## Physics 1 PH5 — 파일 수준 "계산상 조립 가능" (준비 완료 아님)
- 배정 파일 `data/ap/stock/exact-assign-phys-ph5-structure.json`: 단독 38 + 공유 세트 2 + FRQ 4, 가상 칸 0, 독립 검증기 위반 0, 스킬 하드 범위 충족(2.A 8·2.B 10·2.C 6·2.D 6·3.B 9·3.C 3), 단원 {1:5, 2:8, 3:8, 4:5, 5:5, 6:3, 7:3, 8:5}.
- **아직 준비 완료가 아닌 이유**: ① 화면 증거(③)·적재(①)·변환(④)·최신 DB 대조 미실시(운영 에이전트 몫) ② 자동 구조 비교는 후보 선별용이라, 선택된 기존 재고 11개(`ph_beam_balance`, `ph_crate_stop_distance`, `ph_incline_pulley`, `ph_net_work_speed`, `ph_rank_period`, `ph_rim_acceleration`, `ph_torque_angle`, `ph_claim_satellite_speed`, `ph_sym_continuity_pipe`(변형이 다른 질문), `ph_sym_free_fall_time`(다른 질문) 등)는 공개 문항과 내용 비교를 운영 단계에서 해야 한다.
- 새로 쓴 것(코드 이중 경로 검증, 모델 검토 통과): 단독 원형 33(`phys_p0_t5.py` 4 · `t5b` 12 · `t5c` 17), 세트 2(`phs_xt_set`, `phs_slide_stop_set`), FRQ 4(`phf_mr_rope_crate`, `phf_tbr_ball_wall_impulse`, `phf_lab_apparent_weight`, `phf_qqt_drop_vs_launch`).
- 구조 쌍둥이로 판명돼 등록에서 뺀 원형 9(수동 판정 근거: `data/ap/stock/structure-manual-verdicts-phys1.json`). 자동 비교가 쌍둥이로 본 것 중 수동으로 독립이라 판정한 3(`ph_t5_sym_elastic_rebound_speed`, `ph_t5_sym_block_ramp_friction_speed`, `ph_t5_pred_shm_max_speed`)도 같은 파일에 근거를 적었다.
- 단위 (독립 문항 / 자료 묶음 / 묶음 내 문항 / 구조 문항군): 독립 단독 38, 묶음 2(묶음 내 4), 구조 문항군은 세트 내 1개 규칙으로 42문항 모두 서로 다른 군.
- 배치(적재용, `lib/ap-admin/batches.ts`): `phys-t5mc3`(단독 24 재생성), `phys-t5mc4`(13), `phys-t5mc5`(2), `phys-t5mc6`(3+1), `phys-t5s3`(세트), `phys-t5f2`(TBR·LAB·QQT), `phys-t5f3`(MR). 증거 파일명 `evidence-phys-t5.json` 은 아직 만들지 않았다(격리 스택 필요).
- 비용: 이 작업 $8.23(원장 $556.9358 → $565.1648), 한도 $10 안. 이 중 약 $2.5는 주제 코드 오기·쌍둥이 판정으로 다시 만든 비용이다.

## English Literature LT5 — 파일 수준 "계산상 조립 가능"(준비 완료 아님)
- 무료 가상 FRQ 실험으로 부족분이 정확히 **q1 시 분석 FRQ 1 + q3 문학 논증 FRQ 1**임을 확인한 뒤 둘 다 새로 만들었다.
  - q3 `englit-t5-q3`(fc5, 장소가 자아에 미치는 영향): 통과 1, 비용 $0.6336.
  - q1 `englit-real-12`(rf22, Hardy "The Darkling Thrush", 160단어): 통과 1, 비용 $0.2566(1차 실행 `englit-real-11` 은 모델이 rubric 을 XML 로 깨뜨려 $0.0348 에 실패, `englit-real-10` Dunbar 는 지문 98단어로 100–400단어 규칙 탈락 $0.0402). 등록부의 미사용 시(Whitman 87·Dunbar 98단어)는 모두 규칙보다 짧아 Hardy 를 썼다. Hardy 는 다른 시험 MC 묶음에도 있으나 LT5 의 MC 묶음에는 없다.
- 배정 `data/ap/stock/exact-assign-englit-lt5-structure.json`: MC 5묶음(시 21·단편 26·장편 8 문항 = 55), FRQ 3(q1 Hardy 새 시·q2 `englit-p1-b fa2`·q3 fc5), 독립 검증기 위반 0.
- 배치: `lt-t5q3`(q3), `lt-real-6`(q1, 새 빌더 `englit-real-stage6-build.ts`). 증거 파일 `evidence-lt-t5.json` 은 아직 없다(격리 스택 필요).
- **준비 완료가 아닌 이유**: 화면 증거·적재·변환·최신 DB 대조 미실시. MC 묶음 일부(`englit-p1-a s05·p06·l01`, ALTON 작성 원문)는 과거 공개 v1 에 있던 재고라, 운영 단계에서 현재 공개 LT1~LT4 와 내용 중복이 없는지 확인해야 한다. 오너 구조 규칙(질문·자료·풀이 단계)으로 q2 `fa2`와 위 묶음을 읽어 판정할 것.
- 비용: Eng Lit 합계 $0.9308(원장 $565.1648 → $566.1299 이후 q1 시도 포함 $566.1299), 한도 $10 안.

## World History WH4 — 미착수(부족분 확정)
- 차단 후 남은 재고: MC 세트 10(문항 38), FRQ 2(saq2 era3, saq3 era2). 필요: 단원 U2 ≥4, U7 ≥4, U4 +2, U5 +2 문항(총 55까지 약 17문항 = 세트 5개), 자료 유형 quantitative ≥1·image +1·primary ≥4, SAQ1(시대 1 또는 4)·DBQ·LEQ 새로 필요. 모두 권리 확인된 실제 출처를 골라 사실 검증해야 하는 작업이다.

## chf_short_bonding
- Chemistry CH4·CH5 배정(`exact-assign-chem-ch4-ch5-structure-v2.json`)의 FRQ 14개 어디에도 `chf_short_bonding` 은 쓰이지 않는다. 슬롯은 독립 번들 `chf_short_solid_types`·`chf_short_resonance_bond_order` 등이 채웠다. 보류 후보(ClF3)는 제외 유지, 원형 수정 없음.

## 재개 절차
1. `ledger.json` 은 합집합 병합. 통합 브랜치에 이 브랜치를 합친 뒤 운영 에이전트가 PH5 를 적재·화면 증거·변환·공개 관문 검증.
2. LT5: q3 실행 결과(`data/ap/sample-2027/englit-t5-q3/`)를 `lt-finalize.ts` 로 재고화, q1 은 위 실행 후 `lt-assign.ts --sets LT5 --block-file …` 재확인.
3. WH4: 위 부족분 스펙대로 출처 선정부터.
