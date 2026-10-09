# AP 그림 렌더링 게이트 결과

생성: 2026-10-09T05:30:56.544Z · 대상: data/ap/stock/items.json + s1a-items.json + v1ab-items.json + v45ab-items.json (884행)

## 전체

- 전체 884행: 통과 579 / 실패 1 / 해당 없음(그림·표 없음) 304
- 현재 재고 중 게시 후보 상태(auto_passed + needs_revalidation) 460행: 통과 249 / 실패 0 / 해당 없음 211

## 유형별(렌더 유형)

| 유형 | 전체 | 통과 | 실패 | 해당 없음 |
|---|---:|---:|---:|---:|
| ap_diagram:replication_bubble | 1 | 1 | 0 | 0 |
| ap_diagram:ribosome | 1 | 1 | 0 | 0 |
| ap_diagram:strand_pair | 1 | 1 | 0 | 0 |
| ap_graph:bio_line | 8 | 8 | 0 | 0 |
| ap_graph:calc_function_or_derivative | 38 | 38 | 0 | 0 |
| ap_graph:calc_multi_curve | 15 | 14 | 1 | 0 |
| ap_graph:calc_piecewise_limits | 4 | 4 | 0 | 0 |
| ap_graph:calc_region_between_curves | 24 | 24 | 0 | 0 |
| ap_graph:econ_curves | 25 | 25 | 0 | 0 |
| ap_table | 399 | 399 | 0 | 0 |
| ap_table:given_info | 27 | 27 | 0 | 0 |
| ap_table:multi_panel | 29 | 29 | 0 | 0 |
| ap_table:payoff_matrix | 8 | 8 | 0 | 0 |
| none | 232 | 0 | 0 | 232 |
| none(diagram_text_only) | 1 | 0 | 0 | 1 |
| text | 71 | 0 | 0 | 71 |

## 과목별

| 과목 | 전체 | 통과 | 실패 | 해당 없음 |
|---|---:|---:|---:|---:|
| ap_calculus_ab | 441 | 218 | 1 | 222 |
| ap_biology | 200 | 199 | 0 | 1 |
| ap_microeconomics | 172 | 162 | 0 | 10 |
| ap_calculus_bc | 71 | 0 | 0 | 71 |

## 그림 필요 분류(그림이 있어야 풀리는가)

- required(그림·표가 있어야 풀림): 528
- supporting(보조 자료, 본문에도 정보 있음): 52
- text_only(본문만으로 충분): 304

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
| points_only_curve | 24 |
| axis_range_derived | 20 |
| axis_units_missing | 15 |
| shade_unparsed | 10 |
| axis_label_defaulted | 6 |
| axis_label_long | 3 |
| derivative_label | 1 |
| text_data_not_in_stem | 1 |

## 실패 목록(상위 60)

- `run1:ap_calculus_ab-f04-k8` [ap_graph:calc_multi_curve] declared_intersection_mismatch, declared_intersection_mismatch
