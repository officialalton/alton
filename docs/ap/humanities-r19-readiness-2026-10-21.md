# 인문·언어 R19 정확 배정 5세트 렌더·화면 증거 대조 (2026-10-21)

- 렌더 보고서(`data/ap/render-check/report.json`)를 render-check.ts 재실행으로 8499 → 8576행(+77)으로 갱신. 기존 행 소실·변경 0(키·contentHash·status 전부 동일). EL/LT/USH/WH 파일은 기존 이름 규칙 정규식에 이미 포함돼 코드 변경은 없었고, 보고서가 낡아 있었다.
- 배정 64키 전부 보고서에 contentHash와 함께 존재. 렌더 실패 0.
- 화면 증거: `data/ap/screen-evidence/evidence-*.json` 전체에서 키+content_hash 일치, 390x844·1280x800 전 항목 통과(pass/na)인 항목이 64키 전부 있다.
- DB 현재 내용 해시(itemContentHash) 대조: 이 세션에는 원격 접속값이 없어(.env.local은 로컬 54421, 비어 있음) **수행하지 못했다**. 렌더·증거 해시는 재고 파일 기준이므로 mark-verified.ts --render/--screen 드라이런(비프로덕션)에서 최종 불일치 목록을 확인해야 한다.

## fe1-k0 실패 원인

- `englang-r19-f2:ap_english_language-fe1-k0`: stat_chart 제목 "Preferred single use of a 10-million-dollar stormwater budget, Orvell, 2025"(75자)가 게이트 제한 70자를 초과 -> `stat_chart_invalid` -> 스펙 변환 실패로 `not_renderable`. 렌더러 결함이 아니라 데이터 길이 문제.
- 배정 문항 fc1-k0 등 선택 문항은 영향 없음(fc1-k0 stat_chart bar 통과, fa1-k0 통과). EL3/EL4 재배정 불필요, 배정 파일 변경 없음. fe1을 쓰려면 제목을 70자 이내로 줄이고 새 해시로 재검증해야 한다.

## 대조표

| 세트 | 키 | 렌더 | 유형 | 그림 필요 | 증거(해시 일치) | 뷰포트 |
|---|---|---|---|---|---|---|
| EL3 | `englang-r19-merged:ap_english_language-lr41-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| EL3 | `englang-r19-merged:ap_english_language-lr42-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| EL3 | `englang-r19-merged:ap_english_language-lw42-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| EL3 | `englang-r19-merged:ap_english_language-lw41-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| EL3 | `englang-p1-a2:ap_english_language-w01-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| EL3 | `englang-r19-f:ap_english_language-fc1-k0` | pass | ap_stat_chart:bar | supporting | yes | 1280x800,390x844 |
| EL3 | `englang-r19-f5:ap_english_language-fi2-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| EL3 | `englang-r19-f:ap_english_language-fc3-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| EL4 | `englang-r19-merged:ap_english_language-lr21-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| EL4 | `englang-r19-merged:ap_english_language-lr24-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| EL4 | `englang-r19-merged:ap_english_language-lw43-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| EL4 | `englang-r19-merged:ap_english_language-lw44-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| EL4 | `englang-r19-merged:ap_english_language-sw45-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| EL4 | `el-rv:ap_english_language-fa1-k0` | pass | ap_stat_chart:bar | supporting | yes | 1280x800,390x844 |
| EL4 | `englang-r19-f:ap_english_language-fd2-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| EL4 | `englang-r19-f:ap_english_language-fd3-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| WH3 | `wh-r19-m:ap_world_history-w301-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| WH3 | `wh-r19-m:ap_world_history-w302-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| WH3 | `wh-r19-m:ap_world_history-w303-k0` | pass | image:static | required | yes | 1280x800,390x844 |
| WH3 | `wh-r19-m:ap_world_history-w304-k0` | pass | image:static | required | yes | 1280x800,390x844 |
| WH3 | `wh-r19-m:ap_world_history-w305-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| WH3 | `wh-r19-m:ap_world_history-w306-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| WH3 | `wh-r19-m:ap_world_history-w308-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| WH3 | `wh-r19-m:ap_world_history-w309-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| WH3 | `wh-r19-m:ap_world_history-w310-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| WH3 | `wh-r19-m:ap_world_history-w311-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| WH3 | `wh-r19-m:ap_world_history-w312-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| WH3 | `wh-r19-m:ap_world_history-w313-k0` | pass | ap_table | required | yes | 1280x800,390x844 |
| WH3 | `wh-r19-m:ap_world_history-w314-k0` | pass | image:static | required | yes | 1280x800,390x844 |
| WH3 | `wh-r19-m:ap_world_history-w315-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| WH3 | `wh-r19-m:ap_world_history-w316-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| WH3 | `wh-r19-f7:ap_world_history-wh3_saq1-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| WH3 | `wh-r19-f:ap_world_history-wh3_saq2-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| WH3 | `wh-r19-f:ap_world_history-wh3_saq3-k0` | pass | image:static | required | yes | 1280x800,390x844 |
| WH3 | `wh-r19-f5:ap_world_history-wh3_dbq-k0` | pass | image:static | required | yes | 1280x800,390x844 |
| WH3 | `wh-r19-f3:ap_world_history-wh3_leq-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| US3 | `ush-real-e:ap_us_history-real_e_harriot-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| US3 | `ush-p1-a:ap_us_history-u201-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| US3 | `ush-p2-a:ap_us_history-u309-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| US3 | `ush-p2-a:ap_us_history-u310-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| US3 | `ush-p2-a:ap_us_history-u420-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| US3 | `ush-p2-a:ap_us_history-u422-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| US3 | `ush-p2-a:ap_us_history-u529-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| US3 | `ush-p3-a:ap_us_history-u509-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| US3 | `ush-p2-a:ap_us_history-u634-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| US3 | `ush-p3-a:ap_us_history-u612-k0` | pass | ap_table | required | yes | 1280x800,390x844 |
| US3 | `ush-p2-a:ap_us_history-u742-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| US3 | `ush-p3-a:ap_us_history-u718-k0` | pass | ap_table | required | yes | 1280x800,390x844 |
| US3 | `ush-p2-a:ap_us_history-u849-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| US3 | `ush-p2-a:ap_us_history-u851-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| US3 | `ush-p2-a:ap_us_history-u960-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| US3 | `ush-r19-f4:ap_us_history-saq1_r4-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| US3 | `ush-r19-f:ap_us_history-saq2_r1-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| US3 | `ush-r19-f4:ap_us_history-saq3_r4-k0` | pass | ap_table | required | yes | 1280x800,390x844 |
| US3 | `ush-r19-f:ap_us_history-dbq_r1-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| US3 | `ush-r19-f:ap_us_history-leq_r1-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| LT3 | `lt-real-3:ap_english_literature-real-rs13-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| LT3 | `lt-real-3:ap_english_literature-real-rs14-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| LT3 | `lt-real-3:ap_english_literature-real-rs11-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| LT3 | `lt-real-3:ap_english_literature-real-rs12-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| LT3 | `lt-real-3:ap_english_literature-real-rs15-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| LT3 | `lt-real-3:ap_english_literature-real-rf11-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| LT3 | `lt-real-3:ap_english_literature-real-rf12-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |
| LT3 | `englit-r19-q3:ap_english_literature-fc3-k0` | not_applicable | none | text_only | yes | 1280x800,390x844 |

## 공개 가능 / 막힌 세트

- 렌더·화면 증거 기준 공개 가능: EL3, EL4, WH3, US3, LT3 (5세트 전부).
- 막힌 세트: 없음. 단 DB 해시 대조는 미수행(위 참고).
