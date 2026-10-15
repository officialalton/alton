# AP Biology BI1·BI2 주제 분산 점검과 v4 배정 (2026-10-15, 브랜치 `bio-spread`)

범위: 읽기 전용 점검 + 새 재고 생성(모델 비용 $3.05) + 정확 배정 + 새 버전 교체 계획. **DB 적재·쓰기 없음**(`supabase db query --linked` SELECT 만). 점검·재현 도구: `scripts/audit/bio-topic-spread.ts`(이 문서의 표 생성), `lib/ap-exam/bio-frq-spread.ts`(규칙).

## 1. 현재 게시본 점검 (DB 확인: BI1 = v3 게시, BI2 = v4 게시 — 둘 다 2026-10-14 v3 배정, `data/ap/stock/bio-bi1-bi2-published-v3v4-slots.json`)

버전 번호 주의: 새 버전 번호는 "v1 → v2 → v3 …" 의 DB `version_no` 이고, 이전 문서의 "v3 배정"은 배정 이름이다. 지금 게시 중인 것은 BI1 `version_no` 3, BI2 `version_no` 4 이며 둘 다 v3 배정(exam_prep 26/60)이다(BI1 은 변환 안 된 `bio-r2:…m18-k0` 대신 같은 칸의 `bio-s2-mc-b:…m20-k0`).

### FRQ (공식 구조: Q1·Q2 각 9점, Q3~Q6 각 4점 = 34점; 주제 영역 = 대표 CED 토픽의 단원)

| 시험 | FRQ1 (9) | FRQ2 (9) | FRQ3 (4) | FRQ4 (4) | FRQ5 (4) | FRQ6 (4) | 단원별 점수 | 최대 영역 |
|---|---|---|---|---|---|---|---|---|
| BI1 (v3 게시) | 억제제 3.1 | 효소 온도 3.2 | 카탈레이스 3.2 | 염분 토양 뿌리 2.7 | 가계도 5.3 | 유사분열 4.6 | **U3 22점**, U2 4, U4 4, U5 4 | **65 %** (영역 4개) |
| BI2 (v4 게시) | 염분 2.7 | 광합성 3.4 | 밀도 8.4 | 유출 8.7 | 에너지 도표 3.1 | 광합성 색 3.4 | **U3 17점**, U2 9, U8 8 | **50 %** (영역 3개) |

- 문제의 핵심은 BI1 에서 **효소 3종이 FRQ1~3(22/34점)** 을 차지하는 것이고, BI2 도 단원 3(대사) 이 17점이며 영역이 3개뿐이다. 유전(U5·U6)·진화(U7)·세포 소통(U4)·실험 설계 시나리오는 두 시험에 거의 없다.
- 원인: (a) 정확 배정의 목적식이 **FRQ 주제를 전혀 보지 않았다**(유형 6개 각 1개만 강제). (b) 재고에 통과한 FRQ 시나리오가 24개뿐이고 그중 단원 3 이 8개(효소·광합성·호흡·에너지)였다. (c) 두 시험은 원형 서로소여서 같은 유형에서 서로 다른 시나리오를 써야 하므로 선택지가 더 좁다.

### MC (60문항, 범위는 하한 내림·상한 올림 정수, CED 비중 단원 8–11/10–13/12–16/10–15/8–11/12–16/13–20/10–15 %, Practice 25–33/16–24/8–14/8–14/8–14/20–26 %)

| 단원 | 범위(정수) | 중앙값 | BI1 | BI2 |  | Practice | 범위(정수) | 중앙값 | BI1 | BI2 |
|---|---|---|---|---|---|---|---|---|---|---|
| U1 | 4–7 | 5.7 | 6 | 5 |  | P1 | 15–20 | 17.4 | 15 | 16 |
| U2 | 6–8 | 6.9 | 7 | 6 |  | P2 | 9–15 | 12.0 | 12 | 9 |
| U3 | 7–10 | 8.4 | 9 | 8 |  | P3 | 4–9 | 6.6 | **5** | 6 |
| U4 | 6–9 | 7.5 | 7 | 8 |  | P4 | 4–9 | 6.6 | **5** | 6 |
| U5 | 4–7 | 5.7 | **5** | 6 |  | P5 | 4–9 | 6.6 | **9** | **9** |
| U6 | 7–10 | 8.4 | 9 | 9 |  | P6 | 12–16 | 13.8 | 14 | 14 |
| U7 | 7–12 | 9.9 | 10 | 10 |  |  |  |  |  |  |
| U8 | 6–9 | 7.5 | 7 | 8 |  |  |  |  |  |  |

- MC 단원 분포는 모두 공식 범위 안이고 편차가 ±1 이내여서 **단원 불균형은 작다**. 가장 큰 불균형은 **Practice**: P5(수학 계산) 가 두 시험 모두 9(상한)로 중앙값보다 +2.4, P3·P4(질문·방법·자료 기술) 는 BI1 5·5 로 하한 근처, BI2 P2 는 하한(9).
- P5 과다는 exam_prep(다단계 계산) 하한 26/60 을 맞추려고 P5 계산형 원형을 몰아 쓴 결과다(`biology-groundwork.md` §11). P3 는 재고 원형이 가장 적다(3.A–3.D 합쳐 15개 미만).

## 2. 새로 만든 재고 (모델 비용 $3.05, 원장 204.0787 → 207.1289; 하드 캡 $5)

| 배치 | 내용 | 후보 | 통과 | 비용 |
|---|---|---|---|---|
| `bio-v3a` | FRQ 시나리오 14개(Q1 2·Q2 2·Q3 4·Q4 3·Q6 3), 후보 시나리오당 1–2 | 21 | 12 (시나리오 11/14) | $1.26 |
| `bio-v3b` | P3·P4 MC 원형 11개 x 후보 3 | 33 | 12 (원형 10/11) | $1.17 |
| `bio-v3c` | 재시도: 검토기가 스킬 적합성·문구를 지적한 MC 4원형 + FRQ 3시나리오 | 17 | 13 (원형 7/7) | $0.62 |

- 합: **FRQ 시나리오 14/14, MC 원형 11/11 이 1개 이상 통과**(`bio-v3a/b/c-items.json`, 통과 키 37).
- 새 FRQ 시나리오(주제 영역): Q1 `fliesselection` 7.3(인위 선택)·`lacoperon` 6.5(유전자 조절) / Q2 `receptorsat` 4.2(수용체 포화·신호 전달)·`allelefreq` 7.4(대립유전자 빈도 변화) / Q3 `flycross` 5.3(검정 교배·카이제곱)·`uvbacteria` 6.7(돌연변이)·`ethylene` 4.1(세포 소통)·`beetlecolor` 7.2(자연 선택) / Q4 `crossingover` 5.2·`bottleneck` 7.4(유전적 부동)·`keystone` 8.5(군집) / Q6 `lacz` 6.5·`moth` 7.2·`agemeiosis` 5.1(감수 분열 오류). 공식 구조(6유형·9/9/4/4/4/4점)는 그대로이고 시나리오 딕셔너리만 더했다(`archetypes/bio_p0_l.py`; 빌더 `bio_p0_frq.py` 에 변화율+포화/기준값 보간 분기와 Q6 순서·범주 옵션 추가).
- 새 MC 원형(`archetypes/bio_p0_m.py`, 시나리오 은행 3개씩): P3 실험 설계·가설·오차 9개(투석막·한천 육면체·카탈레이스 오차·단백질 pH·환경과 표현형·초파리 교배 가설·선택 상자·방형구 오차) + P4 표 기술 3개(물 성질·자손 수·표면적/부피).
- 동결 절차: 구성 `config/ap-frozen/bio-v3{a,b,c}.v1.json` → `--freeze` → 커밋 → `--check-only` → 실행(해시 일치). 모든 게이트(결정적 게이트 → 독립 풀이 Opus → 검토기 Sonnet 평면 검토 → 제2 모델 spot → 난이도 → 판정)는 이전 배치와 같은 파이프라인이다.
- **1차 실패 원인과 수정**: ① FRQ 3개 — flycross(자료에 "모든 교배"가 있으나 한 교배만 서술), agemeiosis(백분율 변화 방향이 시간 역순), moth(순서 없는 범주를 감소 추세로 서술·유전성 전제 누락) → 문구·빌더 옵션(`pct`, `categorical`) 수정. ② MC 4개 — 검토기가 스킬(3.A·3.C·3.D)이 실제로 묻는 것과 다르다고 지적 → 3.D 는 "개선안 제시", 3.A 는 "검증 가능한 질문", 3.C 는 "통제군/변수"를 묻도록 선택지를 다시 썼다. 재시도 7/7 통과.
- 화면 증거: 격리 스택 `ALTON_apbio3`(API 54521/DB 54522, 가드 통과, 종료 후 `isolated-stack.sh stop`·`supabase/config.toml` 원복·컨테이너 0·시드 `cleanup` 완료): 후보 37 x 390x844·1280x800 = **74항목, fail 0**(`data/ap/screen-evidence/evidence-bio-v3.json`, 스크린샷 `docs/ap/screen-evidence/bio-v3/`). `render-check` 재생성: Biology 794건, pass 470, fail 0, 해당 없음 324(다른 과목 스냅샷 변동분은 되돌리고 Biology·보고서만 포함).
- 등록: `lib/ap-admin/batches.ts` 에 `bio-v3a`·`bio-v3b`·`bio-v3c`(증거 `evidence-bio-v3.json`). 키 파일·렌더 목록은 `bio-*-items.json` 이름 규칙으로 자동 발견된다.

## 3. v4 정확 배정 (`data/ap/stock/exact-assign-bio-bi1-bi2-v4.json`)

- 입력: 변환 완료 키(스냅샷 `convertedKeys` 230개) + 새 배치 `bio-v3a/b/c` 통과 키만(`--converted-snapshot … --new-batches …`). 변환 안 된 옛 재고(`bio-r2:…m18-k0` 등)는 쓰지 않는다.
- 새 규칙(`bio-assign.ts --frq-spread`): **한 시험에서 한 영역(단원)이 FRQ 총점의 35 % 이하(= 11점 이하)이고 서로 다른 영역이 4개 이상**(차단 조건), 영역 수는 목적식에서 약하게 장려. 기존 조건 그대로: exam_prep MC ≥ 26/60, 가상 칸 0, 독립 검증기 위반 0, BI1·BI2 문항·구조(원형) 서로소, 한 시험 문항군 1.
- 추가 제약 `--forbid-swap-sets`: 지금 한 시험이 쓰는 공유 세트는 다른 시험에 넣지 않는다. 세트는 같은 크기 세트로만 통째 교체되므로, 두 시험이 세트를 맞바꾸면 중간판을 채울 자유 세트가 없어 새 버전 순환 교체가 풀리지 않는다(첫 시도에서 실제로 막혔다).
- 결과(두 시험 모두 가상 0, 독립 검증기 위반 0, exam_prep MC 26/60, 문항 서로소, 영역 6개·최대 영역 26 %):

| 시험 | FRQ1 (9) | FRQ2 (9) | FRQ3 (4) | FRQ4 (4) | FRQ5 (4) | FRQ6 (4) | 단원별 점수 |
|---|---|---|---|---|---|---|---|
| BI1 v4 | 인위 선택 7.3 (**신규**) | 감자 삼투 2.7 | 자외선·돌연변이 6.7 (**신규**) | 불가사리 제거(군집) 8.5 (**신규**) | 에너지 도표 3.1 | 유사분열 4.6 | U7 9, U2 9, U3 4, U4 4, U6 4, U8 4 |
| BI2 v4 | 성장 인자 4.2 | 대립유전자 빈도 7.4 (**신규**) | 카탈레이스 3.2 | 비료 유출 8.7 | 복제 포크 6.2 | 나이와 감수 분열 오류 5.1 (**신규**) | U4 9, U7 9, U3 4, U5 4, U6 4, U8 4 |

  효소(3.1·3.2) FRQ 는 두 시험 모두 4점 1개(12 %)이고 영역당 최대 26 %. 유전(U5·U6)·진화(U7)·세포 소통(U4)·생태(U8)가 모두 들어갔다. (참고: 기존 재고만의 단순 재배열도 규칙은 만족했지만(이 문서 작성 중 시도) 영역이 5개였고, 새 시나리오가 있어서 6개 영역·진화/유전 양쪽 균형이 가능해졌다.)
- MC: 새 배치에서 BI1 2·BI2 2 문항이 들어갔다. 단원 편차는 BI1 U1 5·U2 7·U3 8·U4 7·U5 6·U6 9·U7 10·U8 8 / BI2 5·7·9·8·6·8·10·7 (전부 공식 범위, 편차 ±1 이내). Practice BI1 {16,10,6,6,8,14}, BI2 {15,10,6,6,9,14}: **P3·P4 가 5·5 → 6·6** 으로 중앙값에 다가갔고 P5 는 BI1 에서 9 → 8. 남은 불균형: **P5 BI2 9, P2 BI1·BI2 10(중앙값 12 보다 -2)**. exam_prep ≥ 26 을 유지하려면 다단계 계산(P5) 원형이 필요해서 더 줄이면 exam_prep 하한을 깨므로 MC Practice 는 여기서 멈췄다(P2·P5 를 더 줄이려면 다단계이면서 P2 인 새 원형이 필요).

## 4. 재현

```
python3 -m venv .venv-ap && .venv-ap/bin/pip install -r scripts/ap-generation/requirements.txt   # HiGHS(scipy), 끝나면 .venv-ap 삭제
FILES=bio-p1a-items,bio-p1b-items,bio-s2a-items,bio-s2b-items,bio-s2c-items,bio-r1-items,bio-r2-items,bio-r3-items,bio-r4-items,bio-v2a-items,bio-v2b-items,bio-v2c-items,bio-v3a-items,bio-v3b-items,bio-v3c-items
npx tsx scripts/ap-generation/bio-assign.ts --sets BI1,BI2 --time-ms 170000 --prefer-exam-prep --min-exam-prep 26 --frq-spread \
  --forbid-swap-sets data/ap/stock/bio-bi1-bi2-published-v3v4-slots.json --converted-snapshot data/ap/stock/bio-bi1-bi2-published-v3v4-slots.json \
  --new-batches bio-v3a-items,bio-v3b-items,bio-v3c-items --files $FILES --write-report data/ap/stock/exact-assign-bio-bi1-bi2-v4.json
npx tsx scripts/audit/bio-topic-spread.ts --assign data/ap/stock/exact-assign-bio-bi1-bi2-v4.json      # 이 문서 §1·§3 표
```

새 버전 교체 계획과 관리자 절차는 `biology-groundwork.md` §12.
