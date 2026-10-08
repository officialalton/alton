# AP 그림 렌더링 게이트 결과

생성: 2026-10-08T19:56:57.635Z · 대상: data/ap/stock/items.json (현재 재고 783행)

## 전체

- 전체 783행: 통과 547 / 실패 1 / 해당 없음(그림·표 없음) 235
- 현재 재고 중 게시 후보 상태(auto_passed + needs_revalidation) 353행: 통과 208 / 실패 0 / 해당 없음 145

## 유형별(렌더 유형)

| 유형 | 전체 | 통과 | 실패 | 해당 없음 |
|---|---:|---:|---:|---:|
| ap_diagram:replication_bubble | 1 | 1 | 0 | 0 |
| ap_diagram:ribosome | 1 | 1 | 0 | 0 |
| ap_diagram:strand_pair | 1 | 1 | 0 | 0 |
| ap_graph:bio_line | 8 | 8 | 0 | 0 |
| ap_graph:calc_function_or_derivative | 28 | 28 | 0 | 0 |
| ap_graph:calc_multi_curve | 13 | 12 | 1 | 0 |
| ap_graph:calc_piecewise_limits | 4 | 4 | 0 | 0 |
| ap_graph:calc_region_between_curves | 24 | 24 | 0 | 0 |
| ap_graph:econ_curves | 25 | 25 | 0 | 0 |
| ap_table | 379 | 379 | 0 | 0 |
| ap_table:given_info | 27 | 27 | 0 | 0 |
| ap_table:multi_panel | 29 | 29 | 0 | 0 |
| ap_table:payoff_matrix | 8 | 8 | 0 | 0 |
| none | 170 | 0 | 0 | 170 |
| none(diagram_text_only) | 1 | 0 | 0 | 1 |
| text | 64 | 0 | 0 | 64 |

## 과목별

| 과목 | 전체 | 통과 | 실패 | 해당 없음 |
|---|---:|---:|---:|---:|
| ap_calculus_ab | 340 | 186 | 1 | 153 |
| ap_biology | 200 | 199 | 0 | 1 |
| ap_microeconomics | 172 | 162 | 0 | 10 |
| ap_calculus_bc | 71 | 0 | 0 | 71 |

## 그림 필요 분류(그림이 있어야 풀리는가)

- required(그림·표가 있어야 풀림): 496
- supporting(보조 자료, 본문에도 정보 있음): 52
- text_only(본문만으로 충분): 235

## 실패 사유 코드

| 코드 | 건수 |
|---|---:|
| declared_intersection_mismatch | 2 |

## 경고 코드(실패 아님)

| 코드 | 건수 |
|---|---:|
| data_not_rendered | 128 |
| table_units_missing | 125 |
| table_no_title | 107 |
| stimulus_json_repaired | 93 |
| points_only_curve | 24 |
| axis_units_missing | 15 |
| shade_unparsed | 8 |
| axis_range_derived | 8 |
| axis_label_defaulted | 6 |
| axis_label_long | 3 |
| derivative_label | 1 |
| text_data_not_in_stem | 1 |

## 실패 목록(상위 60)

- `run1:ap_calculus_ab-f04-k8` [ap_graph:calc_multi_curve] declared_intersection_mismatch, declared_intersection_mismatch
