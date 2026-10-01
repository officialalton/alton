# command_of_evidence_quant medium n=10 — 실패 전수 상세(2026-09-18 05:31)

accepted=10/10, 후보 평가 수=10, 문항당 평균 호출=4.5, 총 152초

미해소 실패=4건, 해소된 실패(재생성으로 통과)=1건

## 미해소 실패 전체 상세

### 실패 1 — [contract] 지문은 'kilometers' 단위를 쓰지만 표·그래프의 열 이름이나 축 제목에 단위가 없습니다(예: 'Cost (dollars)').

**passage**:
```
Astronomers tracking a newly discovered exoplanet recorded its distance from its host star, in astronomical units (AU), at four points during its orbit, along with the planet's orbital velocity, in kilometers per second (km/s), at each point.

Orbital Position | Distance from Host Star (AU) | Orbital Velocity (km/s)
P1 | 0.8 | 42
P2 | 1.5 | 29
P3 | 2.3 | 21
P4 | 0.5 | 51

Which choice most effectively uses data from the table to complete the statement: "According to the table, the exoplanet's orbital velocity was greatest when its distance from the host star was ______"?
```
**question**:
```
Which choice most effectively uses data from the table to complete the statement: "According to the table, the exoplanet's orbital velocity was greatest when its distance from the host star was ______"?
```
**options** (정답 인덱스: 3):
- A: 0.8 AU, with a velocity of 42 km/s
- B: 1.5 AU, with a velocity of 29 km/s
- C: 2.3 AU, with a velocity of 21 km/s
- D (정답): 0.5 AU, with a velocity of 51 km/s

**figure**:
```json
{
  "type": "data",
  "kind": "table",
  "title": "Exoplanet Orbital Data",
  "columns": [
    "Orbital Position",
    "Distance from Host Star (AU)",
    "Orbital Velocity (km/s)"
  ],
  "rows": [
    [
      "P1",
      0.8,
      42
    ],
    [
      "P2",
      1.5,
      29
    ],
    [
      "P3",
      2.3,
      21
    ],
    [
      "P4",
      0.5,
      51
    ]
  ]
}
```
**evidence_span (target=MAX)**: Row: P4, Columns: Distance from Host Star (AU) = 0.5, Orbital Velocity (km/s) = 51
**answer_rationale**: 표에서 궤도 속도의 최댓값은 51 km/s이며, 이는 P4 행의 거리 0.5 AU에 대응한다.
**distractor_error_types**: ["WRONG_ROW","WRONG_ROW","WRONG_ROW"]

### 실패 2 — [contract] 지문은 'kilometers' 단위를 쓰지만 표·그래프의 열 이름이나 축 제목에 단위가 없습니다(예: 'Cost (dollars)').

**passage**:
```
Astronomers tracking a newly discovered exoplanet recorded its distance from its host star, in astronomical units (AU), at four points during its orbit, along with the orbital velocity of the planet at each point, in kilometers per second.

Which choice most effectively uses data from the table to complete the statement: "According to the table, the exoplanet's orbital velocity was greatest when its distance from the host star was ______"?
```
**question**:
```
Which choice most effectively uses data from the table to complete the statement: "According to the table, the exoplanet's orbital velocity was greatest when its distance from the host star was ______"?
```
**options** (정답 인덱스: 3):
- A: 0.8 AU, with a velocity of 42 km/s
- B: 1.5 AU, with a velocity of 29 km/s
- C: 2.3 AU, with a velocity of 21 km/s
- D (정답): 0.5 AU, with a velocity of 51 km/s

**figure**:
```json
{
  "type": "data",
  "kind": "table",
  "title": "Exoplanet Orbital Data",
  "columns": [
    "Point",
    "Distance from host star (AU)",
    "Orbital velocity (km/s)"
  ],
  "rows": [
    [
      "P1",
      0.8,
      42
    ],
    [
      "P2",
      1.5,
      29
    ],
    [
      "P3",
      2.3,
      21
    ],
    [
      "P4",
      0.5,
      51
    ]
  ]
}
```
**evidence_span (target=MAX)**: Column: Orbital Velocity (km/s), row P4 = 51, Distance = 0.5 AU
**answer_rationale**: 51 km/s는 Orbital Velocity 열의 최댓값이며 이때 거리는 0.5 AU(P4 행)이다.
**distractor_error_types**: ["WRONG_ROW","WRONG_ROW","WRONG_ROW"]

### 실패 3 — [contract] 지문의 "question" 가 표·그래프의 항목(열·범주·계열·제목)에 없습니다. / 지문은 'Year -5'(Inflation rate) 값을 -5 로 말하지만 그래프의 값은 8 입니다.

**passage**:
```
Economic historians studying the effects of a nineteenth-century currency reform compared the annual inflation rate, in percent, of a country in the five years before and the five years after the reform was enacted. The line graph below shows the inflation rate for each year from Year -5 (five years before the reform) through Year +5 (five years after the reform). The reform was enacted between Year -1 and Year +1, so Year -1 is the year immediately before the reform and Year +1 is the year immediately after the reform. Recorded values are as follows: Year -5: 8%; Year -4: 10%; Year -3: 12%; Year -2: 13%; Year -1: 15%; Year +1: 6%; Year +2: 5%; Year +3: 4%; Year +4: 3%; Year +5: 2%.</passage>
<parameter name="question">Which choice most effectively uses data from the line graph to complete the statement: "The difference between the inflation rate in the year immediately before the reform and the inflation rate in the year immediately after the reform was ______"?
```
**question**:
```
Economic historians studying the effects of a nineteenth-century currency reform compared the annual inflation rate, in percent, of a country in the five years before and the five years after the reform was enacted. The line graph below shows the inflation rate for each year from Year -5 (five years before the reform) through Year +5 (five years after the reform). The reform was enacted between Year -1 and Year +1, so Year -1 is the year immediately before the reform and Year +1 is the year immediately after the reform. Recorded values are as follows: Year -5: 8%; Year -4: 10%; Year -3: 12%; Year -2: 13%; Year -1: 15%; Year +1: 6%; Year +2: 5%; Year +3: 4%; Year +4: 3%; Year +5: 2%.</passage>
<parameter name="question">Which choice most effectively uses data from the line graph to complete the statement: "The difference between the inflation rate in the year immediately before the reform and the inflation rate in the year immediately after the reform was ______"?
```
**options** (정답 인덱스: 2):
- A: 2 percentage points
- B: 7 percentage points
- C (정답): 9 percentage points
- D: 13 percentage points

**figure**:
```json
{
  "type": "data",
  "kind": "line",
  "categories": [
    "Year -5",
    "Year -4",
    "Year -3",
    "Year -2",
    "Year -1",
    "Year +1",
    "Year +2",
    "Year +3",
    "Year +4",
    "Year +5"
  ],
  "series": [
    {
      "name": "Inflation rate",
      "values": [
        8,
        10,
        12,
        13,
        15,
        6,
        5,
        4,
        3,
        2
      ]
    }
  ],
  "xTitle": "Year",
  "yTitle": "Inflation rate (percent)"
}
```
**evidence_span (target=DIFFERENCE)**: Row: Year -1 (15%) and Row: Year +1 (6%)
**answer_rationale**: 15%(Year -1) - 6%(Year +1) = 9 percentage points, 자료의 두 인접 연도 값을 그대로 뺀 결과와 일치한다.
**distractor_error_types**: ["ADJACENT_CELL","OFF_BY_ONE_INDEX","WRONG_ROW"]

### 실패 4 — [review] 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)

**passage**:
```
Economic historians studying the effects of a nineteenth-century currency reform compared the annual inflation rate, in percent, of a country in the five years before and the five years after the reform was enacted.

Which choice most effectively uses data from the line graph to complete the statement: "The difference between the inflation rate in the year immediately before the reform and the inflation rate in the year immediately after the reform was ______"?
```
**question**:
```
Which choice most effectively uses data from the line graph to complete the statement: "The difference between the inflation rate in the year immediately before the reform and the inflation rate in the year immediately after the reform was ______"?
```
**options** (정답 인덱스: 2):
- A: 2 percentage points
- B: 6 percentage points
- C (정답): 9 percentage points
- D: 15 percentage points

**figure**:
```json
{
  "type": "data",
  "kind": "line",
  "categories": [
    "Year -2",
    "Year -1",
    "Reform Year",
    "Year +1",
    "Year +2"
  ],
  "series": [
    {
      "name": "Inflation Rate (%)",
      "values": [
        11,
        15,
        9,
        6,
        4
      ]
    }
  ],
  "xTitle": "Year Relative to Reform",
  "yTitle": "Inflation Rate (%)"
}
```
**evidence_span (target=DIFFERENCE)**: Values at Year -1 = 15 and Year +1 = 6
**answer_rationale**: 15%(개혁 직전 해)와 6%(개혁 직후 해)의 차이는 9 percentage point가 아니라 15-6=9... (재계산: 15-6=9)
**distractor_error_types**: ["ADJACENT_CELL","WRONG_ROW","WRONG_ROW"]

## 해소된 실패(재생성으로 통과 — 참고용, 첫 시도가 왜 걸렸는지)

### 해소 1 — [contract] 범주 이름 'Monet Retrospective' 가 너무 길어 축 아래에 놓을 수 없습니다 — 짧게 줄이세요. / 범주 이름 'Renoir Collection' 가 너무 길어 축 아래에 놓을 수 없습니다 — 짧게 줄이세요.
