# 재검증 통과 143건의 상태 갱신 (2026-10-09)

**규칙**: LLM 재검증(S2/S3: Opus 독립 풀이 + Sonnet 5기준 검토, 과목별 변형·파서 66ad0da7e962) 통과 **그리고** 최신 결정적 검사 전부 통과일 때만 `auto_passed`(게이트 라벨 `v2-legacy-revalidated-2026-10-09`). LLM 이 결함 문항 9개 중 7개를 통과시킨 전례가 있어 **모든 결정적 검사를 대상 전체에 다시 돌렸다**: 무료 선별 생존(구조·계산·범위·중복), 구조 게이트 v2(`gateMc`/`gateFrq`/`calibrate*`/`gateNoCalcExact`), 생성기 결함(`generator-defects`), 표↔본문 모순(`table-consistency`), 완전 중복 아님. 결과: **143건 전부 통과(보류 0)**. 이력에 검증 방법·버전을 기록한다(history run `revalidated-s2|s3`, 사유 문자열에 방법·파서 버전 포함).
- 승격 구성: AB MC 38, AB FRQ 7, Bio MC 44, Micro MC 53, Micro FRQ 1. 결함 플래그 문항·S2 규칙 탈락 8건·공유 세트는 제외.
- **게시 전 필수**: 렌더 검증 + 학생 화면 검증(미실시). 전문가 검수는 게시 후 오류 신고 흐름.
- 스크립트: `npx tsx scripts/ap-generation/apply-revalidation.ts`(dry-run 기본, 결정과 예상 건수 출력) → `--write` 가 `data/ap/stock/revalidation-apply.json` 기록 → `npx tsx scripts/ap-generation/stock.ts` 가 읽어 상태 반영(items.json·s1a-items.json 동시 갱신) → `import-candidates.ts`(기본 배치)·S1a 보조 배치 import 는 같은 키 upsert.
- **예상 건수(DB 적재 후 `ap_stock_summary_v` 와 일치해야 함)**: 기준 배치 783행 = rejected 402 / needs_revalidation 77 / auto_passed 296 / exact_duplicate 8. S1a 보조 68행 = auto_passed 56 / rejected 8 / exact_duplicate 4. 합계 851행 = rejected 410 / needs_revalidation 77 / auto_passed 352 / exact_duplicate 12. 과목×종류 auto_passed(결함 없음): AB MC 178·FRQ 28, BC MC 44·FRQ 4, Bio MC 44, Micro MC 53·FRQ 1.
- 점검: `npx tsx scripts/ap-generation/stock-consistency.ts`(파일 두 개 합쳐 DB 현재 배치와 8개 과목×종류 비교). 로컬 롤백 트랜잭션(402+403 적용)에서 8/8 일치 확인. 단일 재고 표: `stock.ts` 가 **한 번의 계산**으로 items.json(기준 배치)과 s1a-items.json(보조 배치)을 함께 쓰므로 둘의 중복·문항군 판정이 어긋나지 않는다.
