# AP 그림 렌더링 게이트 결과

생성: 2026-10-09T08:50:43.993Z · 대상: data/ap/stock/items.json + s1a-items.json + v1ab-items.json + v45ab-items.json + bc-topup-items.json + graph-s1-items.json + graph-s2a-items.json + graph-s2b-items.json + graph-s3a-items.json + graph-s3b-items.json + graph-s3c-items.json + graph-s3d-items.json + graph-s3e-items.json + graph-s3f-items.json + graph-s3g-items.json (998행)

## 전체

- 전체 998행: 통과 671 / 실패 1 / 해당 없음(그림·표 없음) 326
- 현재 재고 중 게시 후보 상태(auto_passed + needs_revalidation) 546행: 통과 323 / 실패 0 / 해당 없음 223

## 유형별(렌더 유형)

| 유형 | 전체 | 통과 | 실패 | 해당 없음 |
|---|---:|---:|---:|---:|
| ap_diagram:replication_bubble | 1 | 1 | 0 | 0 |
| ap_diagram:ribosome | 1 | 1 | 0 | 0 |
| ap_diagram:strand_pair | 1 | 1 | 0 | 0 |
| ap_graph:bio_line | 8 | 8 | 0 | 0 |
| ap_graph:calc_function_or_derivative | 100 | 100 | 0 | 0 |
| ap_graph:calc_multi_curve | 34 | 33 | 1 | 0 |
| ap_graph:calc_piecewise_limits | 7 | 7 | 0 | 0 |
| ap_graph:calc_region_between_curves | 24 | 24 | 0 | 0 |
| ap_graph:econ_curves | 25 | 25 | 0 | 0 |
| ap_table | 407 | 407 | 0 | 0 |
| ap_table:given_info | 27 | 27 | 0 | 0 |
| ap_table:multi_panel | 29 | 29 | 0 | 0 |
| ap_table:payoff_matrix | 8 | 8 | 0 | 0 |
| none | 250 | 0 | 0 | 250 |
| none(diagram_text_only) | 1 | 0 | 0 | 1 |
| text | 75 | 0 | 0 | 75 |

## 과목별

| 과목 | 전체 | 통과 | 실패 | 해당 없음 |
|---|---:|---:|---:|---:|
| ap_calculus_ab | 520 | 282 | 1 | 237 |
| ap_biology | 200 | 199 | 0 | 1 |
| ap_microeconomics | 172 | 162 | 0 | 10 |
| ap_calculus_bc | 106 | 28 | 0 | 78 |

## 그림 필요 분류(그림이 있어야 풀리는가)

- required(그림·표가 있어야 풀림): 620
- supporting(보조 자료, 본문에도 정보 있음): 52
- text_only(본문만으로 충분): 326

## 실패 사유 코드

| 코드 | 건수 |
|---|---:|
| declared_intersection_mismatch | 2 |

## 경고 코드(실패 아님)

| 코드 | 건수 |
|---|---:|
| table_units_missing | 135 |
| data_not_rendered | 128 |
| table_no_title | 107 |
| stimulus_json_repaired | 93 |
| axis_range_derived | 28 |
| points_only_curve | 24 |
| axis_units_missing | 15 |
| shade_unparsed | 10 |
| derivative_label | 6 |
| axis_label_defaulted | 6 |
| axis_label_long | 4 |
| text_data_not_in_stem | 1 |

## 실패 목록(상위 60)

- `run1:ap_calculus_ab-f04-k8` [ap_graph:calc_multi_curve] declared_intersection_mismatch, declared_intersection_mismatch
