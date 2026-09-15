// 문제 생성 코어(2026-09-15) — 서버 액션(app/admin/curriculum-doc-actions.ts)에서 분리했다.
// 인증은 여기서 하지 않는다: 서버 액션이 requireAdmin 을 거친 뒤 호출하고, 표본 검증 스크립트(scripts/)도 같은 경로를 쓴다.
// 내용은 그대로 옮겼다 — AI 는 관계·의미만 내고 좌표·라벨 자리는 표준 렌더러가 정한다.
import Anthropic from "@anthropic-ai/sdk";
import { stripInlineOptions } from "@/lib/problem-text";
import { composeProblemText, splitLegacyQuestion } from "@/lib/problem-question";
import { GEOMETRY_TEMPLATE_TYPES, validateFigureSpec } from "@/lib/problem-figures/spec";
import { placeCorrectChoice } from "@/lib/problem-figures/templates/figure-choice";
import { findProblemSkill } from "@/lib/problem-skills";
import { SKILL_BY_CODE, domainLabel } from "@/lib/problem-taxonomy";
import type { DocProblem } from "@/app/admin/curriculum-doc-data";

// 클라이언트는 호출 시점에 만든다 — 모듈 로드만 하는 테스트(jsdom)에서 SDK 가 브라우저 환경으로 오해하지 않게.
let anthropicClient: Anthropic | null = null;
const getAnthropic = () => (anthropicClient ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

export type ProblemFormat = "mc" | "spr" | "essay" | "math";
/** 그림 요구(2026-09-14): 모델 재량에 맡기면 도형이 거의 안 나온다 — 필수면 그림 없는 문항은 버린다. */
export type FigurePolicy = "none" | "optional" | "require_plane" | "require_geometry" | "require_data" | "require_figure_choice";
const FIGURE_CHOICE_DESC = "그래프/도형 선택지(figure_choice): 선택지 4개가 그림인 문항. 각 선택지는 아래 좌표평면 스키마를 **그대로** 쓴다(다른 키 이름 금지). 예: {\"type\":\"figure_choice\",\"choices\":[{\"type\":\"plane\",\"axes\":{\"x\":{\"min\":-5,\"max\":5},\"y\":{\"min\":-5,\"max\":5}},\"objects\":[{\"id\":\"l\",\"kind\":\"line\",\"slope\":-2,\"intercept\":3}]},{\"type\":\"plane\",\"axes\":{\"x\":{\"min\":-5,\"max\":5},\"y\":{\"min\":-5,\"max\":5}},\"objects\":[{\"id\":\"l\",\"kind\":\"line\",\"slope\":2,\"intercept\":3}]},…4개]}. 모든 선택지는 같은 axes(범위·눈금 완전히 동일)·같은 객체 수·같은 kind, 라벨(label)과 점(point) 없음. 곡선은 {\"kind\":\"function\",\"fn\":\"quadratic\",\"params\":[a,b,c]} 로. options 는 ['A','B','C','D'], correct_index 가 정답 그래프의 자리(선택지 i ↔ 그림 i). 정답을 암시하는 보조 점·라벨·색 차이를 두지 않는다.";
const FIGURE_SET_DESC = "복수 자료(figure_set): 그림·표가 둘 이상 필요한 문항. {type:'figure_set', figures:[{id:'A', title:'Figure A', spec:그림 데이터}, {id:'B', title:'Table B', spec:…}]}. 지문은 'Figure A', 'Table B' 로 자료를 가리킨다.";

/** 표준 렌더링 엔진 템플릿 4 — 표·데이터 그래프(값만). */
const DATA_DESC = "표·데이터 그래프(표준 템플릿, 값만). 모든 필드는 객체 최상위에 둔다(kind 이름 아래에 넣지 않는다). 예: {\"type\":\"data\",\"kind\":\"table\",\"title\":\"Bottle Inspection by Shift\",\"columns\":[\"Shift\",\"Bottles Inspected\",\"Defective Bottles\"],\"rows\":[[\"1\",240,6],[\"4\",350,14]]} / {\"type\":\"data\",\"kind\":\"bar\",\"categories\":[\"Jan\",\"Feb\"],\"series\":[{\"name\":\"Store A\",\"values\":[1200,1500]}],\"yTitle\":\"Sales (dollars)\"} / {\"type\":\"data\",\"kind\":\"line\",\"categories\":[\"0\",\"1\",\"2\"],\"series\":[{\"values\":[0,40,80]}],\"xTitle\":\"Time (hours)\",\"yTitle\":\"Distance (miles)\"} / {\"type\":\"data\",\"kind\":\"histogram\",\"bins\":[{\"from\":0,\"to\":10,\"count\":3},{\"from\":10,\"to\":20,\"count\":7}],\"xTitle\":\"Minutes\",\"yTitle\":\"Number of students\"} / {\"type\":\"data\",\"kind\":\"scatter\",\"points\":[[1,2.1],[2,2.9],[3,4.2]],\"fitLine\":{\"slope\":0.95,\"intercept\":1.1},\"xTitle\":\"Hours studied\",\"yTitle\":\"Score (points)\"} / {\"type\":\"data\",\"kind\":\"boxplot\",\"boxes\":[{\"name\":\"Class A\",\"min\":55,\"q1\":65,\"median\":72,\"q3\":80,\"max\":95}],\"xTitle\":\"Test score\"} / {\"type\":\"data\",\"kind\":\"number_list\",\"values\":[3,5,5,8,12],\"label\":\"Data set A\"}. 추가 종류: {\"type\":\"data\",\"kind\":\"dot_plot\",\"dots\":[{\"value\":1,\"count\":2},{\"value\":2,\"count\":4}],\"xTitle\":\"Number of pets\"} / {\"type\":\"data\",\"kind\":\"two_way\",\"rowHeader\":\"Grade\",\"rowLabels\":[\"9th\",\"10th\"],\"colLabels\":[\"Bus\",\"Walk\"],\"cells\":[[42,18],[36,24]]}(합계 행·열은 넣지 않는다 — 렌더러가 계산) / {\"type\":\"data\",\"kind\":\"statement\",\"title\":\"Survey summary\",\"facts\":[{\"label\":\"Sample size\",\"value\":400},{\"label\":\"Margin of error\",\"value\":4,\"unit\":\"percentage points\"}],\"note\":\"random sample\"}(표본 추정·오차범위·연구 설계의 문장형 자료). kind 는 table|two_way|number_list|bar|line|histogram|scatter|boxplot|dot_plot|statement 중 하나(원그래프 등 다른 것은 만들지 않는다). 축 범위·눈금·막대 폭·범례·라벨 자리는 렌더러가 정한다. 지문이 부르는 항목 이름·값·단위는 데이터와 정확히 같아야 하고(지문 'Shift 4 had 14 defective' 이면 표의 그 칸이 14), 단위는 열 이름·축 제목에 괄호로 쓴다('Cost (dollars)'). 지문에 없는 항목을 만들지 않는다. 값은 모두 숫자여야 한다(null 금지) — 지문에 없는 칸은 지문의 값·비율과 모순되지 않는 그럴듯한 값으로 채운다(시험 자료는 빈칸이 없다).";

/** 표준 렌더링 엔진 템플릿 1 — AI 도구 스키마 설명(2026-09-14). 좌표 없이 관계만. */
const PARALLEL_TRANSVERSAL_DESC =
  "평행선·횡단선·각(표준 템플릿, 좌표 없음 — 관계만): {type:'parallel_transversal', parallel:['m','n'](위,아래 평행선 이름 2개), transversals:[{id:'k'}](1~2개; 평행선에 수직이면 {id:'k', perpendicular:true}), points:[{id:'A', on:['m','k']}](교점 이름, 선택), angles:[{at:['m','k'], region:'NE'|'NW'|'SE'|'SW', label:'x°'}](어느 교점·어느 사분면·라벨; 라벨은 평문 'x°','37°','(2x + 10)°'; 직각 표시는 {at, region, right:true} — 수직 횡단선의 교점에서만), notToScale:true}. 지문이 말하는 선·점·각 이름은 여기 반드시 있어야 하고, 지문에 없는 것을 넣지 않는다. region 은 그림 배치용 내부 값이다 — **지문에는 north/south/east/west, region, quadrant 같은 방위 표현을 절대 쓰지 말고**(쓰면 검증에서 거부된다) 예: 'In the figure, lines m and n are parallel and line k is a transversal. If the angle marked 37° ... , what is the value of x?' 처럼 시험 문제처럼 \"the angle marked (3x + 25)°\", \"the angle at A\" 로 부른다. 두 횡단선이 서로 만나 평행선과 삼각형을 이루는 그림(예: 'lines k and j meet at point E below line n')도 그릴 수 있다: transversals 를 2개 두고 그 교점을 points:[{id:'E', on:['k','j']}] 로, 교점의 각은 angles:[{at:['k','j'], region:'N'|'S'|'E'|'W', label:'x°'}](N = 평행선 쪽·삼각형 안), 만나는 자리는 crossing:{side:'below'|'above'}. 평행선 3개 이상은 아직 구현 대기다 — 구현 전에는 그런 문항을 만들지 않는다.";
/** 표준 렌더링 엔진 템플릿 3 — 좌표평면(객체 id 기반). */
const PLANE_DESC =
  "좌표평면(표준 템플릿, 객체 id 기반): {type:'plane', axes:{x:{min,max,step?,title?:'Time (hours)'}, y:{min,max,step?,title?:'Cost (dollars)'}}, objects:[ {id:'P', kind:'point', at:[x,y], label:'P', open?}, {id:'l1', kind:'line', slope, intercept, label:'ℓ'} 또는 {kind:'line', through:['P','Q']}, {id:'f', kind:'function', fn:'linear'|'quadratic'|'exponential'|'abs'|'sqrt'|'cubic', params:[...](linear [a,b]=ax+b, quadratic [a,b,c], cubic [a,b,c,d], exponential [a,base,c]=a·base^x+c, abs [a,h,k]=a|x−h|+k, sqrt [a,h,k]=a√(x−h)+k), label:'f', domain?}, {id:'s', kind:'segment', from:'A', to:'B'}, {id:'q', kind:'inequality', op:'<='|'<'|'>='|'>', slope, intercept, label:'y ≤ x + 2'}(경계 실선/점선·음영은 렌더러), {id:'g', kind:'piecewise', pieces:[{from:-4,to:0,slope:1,intercept:2,openTo:true},{from:0,to:4,slope:-0.5,intercept:3}], label:'g'}(열린 끝 openFrom/openTo), 포물선과 직선의 교점은 {id:'X', kind:'intersection', of:['l1','l2']} 는 직선끼리만 — 곡선 교점은 점 객체로 좌표를 직접 넣는다(예: {id:'P', kind:'point', at:[2,1], label:'P'}). 좌표기하: {id:'T', kind:'polygon', vertices:['A','B','C'], fill?}(꼭짓점이 이름 붙은 점이면 label 은 두지 않는다), {id:'c', kind:'circle', center:'O'|[x,y], radius}, {id:'M', kind:'midpoint', of:['P','Q'], label:'M'}, {id:'X', kind:'intersection', of:['l1','l2'], label:'X'}, {id:'T2', kind:'transform', of:'T', op:{type:'translate',dx,dy}|{type:'reflect',over:'x-axis'|'y-axis'|'y=x'|'y=-x'}|{type:'dilate',k}|{type:'rotate',deg:90|180|270}}(상은 점선·프라임 라벨). 유리함수는 fn:'rational', params:[a,b,c,d]=(ax+b)/(cx+d)(점근선은 렌더러가 점선으로), {id:'d', kind:'scatter', points:[[x,y],...], fitLine?:{slope,intercept}} ]}. 격자·축·화살표·눈금 숫자·원점 O·라벨 자리는 렌더러가 정한다 — 좌표만 정확히. 지문에 나오는 좌표·점 이름·직선 이름·식(y = 2x − 3 등)은 데이터와 정확히 같아야 하고, 지문의 (x, y) 좌표는 점 객체이거나 어떤 그래프 위에 있어야 한다. 그래프가 축 범위 안에 잘 보이도록 min/max 를 잡는다. **선택지에 나오는 좌표는 그림에 점으로 찍지 않는다**(정답이 드러난다) — 지문이 직접 이름 붙인 점만 찍는다.";
/** 표준 렌더링 엔진 템플릿 6·7 — 사각형·다각형, 입체 도식. */
const POLYGON_DESC = "사각형·다각형(표준 템플릿, 관계만): {type:'polygon', kind:'rectangle'|'square'|'parallelogram'|'rhombus'|'trapezoid'|'regular', sides:5(regular 일 때 3~8), vertices:['A','B','C','D'](왼쪽 아래부터 반시계), sideLabels:[{between:['A','B'], label:'12', tick:1}](이웃 꼭짓점만), angles:[{at:'A', label:'110°', right:false}], diagonals:[{between:['A','C'], label:'13'}], height:{from:'D', label:'h', foot:'E'}(밑변으로 수선), notToScale:true}. 지문의 도형 이름·변·대각선·각·길이가 데이터와 같아야 하고 구하라는 값은 미지수 문자.";
const COMPOSITE_DESC = "복합 도형(composite, 음영 영역): {type:'composite', outer:{kind:'square'|'rectangle'|'circle', side|width|height|radius|diameter:'라벨'}, inner:{kind:'circle'|'square'|'rectangle'|'semicircle'|'triangle', side|width|height|radius|diameter:'라벨', placement?:'center'|'on_base'|'corner'}, shaded:'outer_minus_inner'|'inner'|'none', notToScale:true}. 예: 정사각형에 내접한 원의 바깥 음영 → {outer:{kind:'square', side:'10'}, inner:{kind:'circle', radius:'5'}, shaded:'outer_minus_inner'}. 지문의 도형 낱말·치수가 라벨과 같아야 한다.";
const SOLID_DESC = "입체도형(표준 2.5D 도식, 치수 라벨만): {type:'solid', kind:'rectangular_prism'|'cube'|'cylinder'|'cone'|'sphere'|'square_pyramid', dims:{length:'8', width:'5', height:'3'} 또는 {edge:'4'} 또는 {radius:'3', height:'10'} 또는 {radius:'r', height:'h', slant:'l'} 또는 {radius:'6'} 또는 {edge:'6', height:'4', slant:'5'}, notToScale:true}. 숨은 모서리 점선·라벨 자리는 렌더러가 정한다. 지문의 반지름·높이·모서리 값이 라벨과 같아야 하고, 구하라는 치수는 미지수 문자로.";
/** 표준 렌더링 엔진 템플릿 5 — 원. 점은 각도로 자리만. */
const CIRCLE_DESC = "원(표준 템플릿, 관계만): {type:'circle', center:'O'(중심 이름, 없으면 null), points:[{id:'A', angle:30},{id:'B', angle:150}](원 위의 점과 자리 각도 0~360, 좌표 아님), radii:[{to:'A', label:'5'}], chords:[{between:['A','B'], label:'8', diameter:true|false}](지름이면 두 점 각이 180° 차이), arcs:[{from:'A', to:'B', label:'2π'}](반시계), sector:{from:'A', to:'B', label:'S'}, centralAngles:[{between:['A','B'], label:'120°', right:false}], inscribedAngles:[{at:'C', between:['A','B'], label:'x°'}], tangents:[{at:'A', external:'P', label:'ℓ'}], notToScale:true}. 지문의 중심·점·현·호·접선·각 이름과 길이·각 라벨이 데이터와 정확히 같아야 하고, 구하라는 값은 라벨에 쓰지 않는다(미지수 문자).";
/** 표준 렌더링 엔진 템플릿 2 — 삼각형·직각삼각형·합동/닮음. 좌표 없이 관계만. */
const TRIANGLE_DESC =
  "삼각형(표준 템플릿, 좌표 없음 — 관계만): {type:'triangle', vertices:['A','B','C'](꼭짓점 3개; 표준 배치는 첫째 위, 둘째 왼쪽 아래, 셋째 오른쪽 아래), kind:'right'|'isosceles'|'equilateral'|'scalene', rightAngleAt:'B'(직각 꼭짓점; kind 'right' 면 필수), sides:[{between:['A','B'], label:'6', tick:1}](변 길이 라벨·등변 눗금 1~3), angles:[{at:'C', label:'37°', tick:1}](각 라벨·등각 호 1~2; 직각 꼭짓점엔 라벨 없음), altitude:{from:'A', foot:'D', label:'h'}(높이, 선택), second:{vertices:['D','E','F'], scale:0.6, sides, angles}(합동·닮음용 두 번째 삼각형, 다른 이름), notToScale:true}. " +
  "지문이 부르는 점·변·각·길이·직각은 데이터에 반드시 있고 값이 같아야 한다(지문 AB = 6 이면 sides 에 AB 라벨 '6'). 지문에 없는 라벨을 넣지 않는다. 라벨은 평문('6', 'x', '37°', 'θ', '√2').";
const FIGURE_POLICY_RULE: Record<FigurePolicy, string> = {
  none: "figure 를 만들지 않는다. 그림 없이 풀 수 있는 문항만 만든다.",
  optional: "그래프·도형이 꼭 필요한 문항에만 figure 데이터를 넣는다.",
  require_plane: "**모든 문항에 figure(type:'plane') 데이터가 있어야 한다.** 그래프를 읽어야만 풀 수 있는 문항(절편·교점·기울기·해 읽기·최솟값 등)으로 만든다. AI 는 좌표와 식만 정확히 내고 그림은 그리지 않는다. 지문의 좌표·점·직선 이름·식이 데이터와 정확히 같아야 하고, 답이 그림에 글자로 드러나지 않게 한다. 좌표를 자유롭게 찍는 옛 형식(type:'coordinate_plane')은 쓰지 않는다.",
  require_geometry: "**모든 문항에 표준 도형 템플릿 figure 데이터가 있어야 한다** — type 'parallel_transversal'(평행선·횡단선 각), 'triangle'(삼각형·직각삼각형·합동/닮음), 'circle'(원·현·호·부채꼴·접선·중심각·원주각), 'polygon'(직사각형·정사각형·평행사변형·마름모·사다리꼴·정n각형), 'solid'(직육면체·정육면체·원기둥·원뿔·구·사각뿔 2.5D), 'composite'(도형 안 도형·음영 영역) 중 하나. AI 는 좌표나 그림을 그리지 않고 **관계만** 낸다. 지문에서 부르는 선·점·변·각 이름과 값이 데이터와 정확히 같아야 한다. 라벨은 평문. 지문에는 north/south/east/west, region, quadrant 같은 방위 표현을 절대 쓰지 말고(검증에서 거부된다) 시험 문제처럼 \"the angle marked 37°\", \"the angle at A\", \"AB = 6\" 으로 부른다. 구현 대기 모양(평행선 3개 이상, 둔각삼각형에서 밖으로 떨어지는 높이, 트랙형(직사각형 양끝 반원)·삼각형 안 내접원처럼 셋 이상 겹친 도형)은 구현 전까지 만들지 않는다. 두 횡단선이 만나 삼각형을 이루는 평행선 문항(crossing)과 수직 횡단선·직각 표시(perpendicular)는 그릴 수 있다.",
  require_data: "**모든 문항에 figure(type:'data') 자료가 있어야 한다** — 표(함수표·값 표·빈도/비율표)·숫자 목록·막대/선그래프·히스토그램·산점도(추세선)·상자그림 중 문항에 맞는 하나. AI 는 값·이름·단위만 내고 그림은 그리지 않는다. 지문은 자료를 읽어야 풀 수 있게(비율·백분율·단위 변환·확률·조건부확률·표본 통계·오차범위·관찰 연구/실험 판단 등) 쓰고, 지문의 항목 이름·값·단위가 데이터와 정확히 같아야 한다. 마크다운 표는 쓰지 않고 이 figure 로 낸다.",
  require_figure_choice: "**모든 문항이 그래프 선택지 문항이어야 한다** — figure(type:'figure_choice') 에 같은 축·같은 객체 수의 그래프 4개, options 는 ['A','B','C','D'], correct_index 가 정답 그래프. 지문은 식·조건을 주고 \"Which of the following graphs …?\" 로 묻는다. 그림에 라벨·보조 점을 두지 않는다.",
};
export type ProblemDifficulty = "easy" | "medium" | "hard";

const FORMAT_LABEL: Record<ProblemFormat, string> = {
  mc: "객관식",
  spr: "숫자 입력(SPR)",
  essay: "서술형",
  math: "풀이형",
};


export async function generateSectionProblemsCore(params: {
  sectionTitle: string;
  subjectName: string;
  skillType: string;
  difficulty: ProblemDifficulty;
  format: ProblemFormat;
  count: number;
  figurePolicy?: FigurePolicy;
  /** 세부 기술 코드(lib/problem-taxonomy) — 영역·기술 힌트를 프롬프트에 넣는다. */
  skillCode?: string;
  /** 자료가 빠진(또는 규격에 안 맞는) 결과를 버리지 않고 figure:null 로 돌려준다 — 호출자가 2차 자료 생성으로 채운다(문제은행, 2026-09-15). */
  keepFigureless?: boolean;
}): Promise<(Omit<DocProblem, "id" | "keywords"> & { stimulus?: string; question?: string | null; needsFigure?: boolean; distractorRationales?: { index: number; plausible_because: string; matches: string; why_wrong: string; kind: string }[]; difficultyRationale?: string; design?: { key_relations?: string[]; answer_uses_relations?: string; distractor_design?: { index: number; relation: string; error_type: string }[]; target_difficulty_note?: string } | null })[]> {
  const { sectionTitle, subjectName, skillType, difficulty, format, count } = params;
  const skillMeta = params.skillCode ? SKILL_BY_CODE.get(params.skillCode) ?? null : null;
  const ruleSkill = findProblemSkill(skillType) ?? (skillMeta ? findProblemSkill(skillMeta.legacySkill) : null);
  const figurePolicy: FigurePolicy = params.figurePolicy ?? "optional";
  const clampedCount = Math.max(1, Math.min(10, count));

  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 4000,
    tools: [
      {
        name: "generate_problems",
        description: "SAT/AP 교재 섹션에 귀속될 문제 은행용 문제를 조건에 맞춰 생성한다.",
        input_schema: {
          type: "object",
          properties: {
            problems: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  passage: {
                    type: "string",
                    description:
                      "지문/자료 본문만(질문 문장은 question 에 따로). 빈칸이 필요하면 ______로 표시. 선택지(A~D)는 여기에 쓰지 말고 options 에만 넣는다. 수학 문항처럼 조건과 질문이 한 문장이면 조건만 여기에, 묻는 문장은 question 에. 지문이 따로 없으면 빈 문자열.",
                  },
                  question: {
                    type: "string",
                    description:
                      "질문 문장(필수). 실제 SAT 문항 말투 그대로, 물음표로 끝난다. 예: \"Which choice completes the text with the most logical and precise word or phrase?\", \"What is the value of x?\". Rhetorical Synthesis 는 \"The student wants to … Which choice …?\" 두 문장.",
                  },
                  options: {
                    type: "array",
                    items: { type: "string" },
                    ...(format === "mc" ? { minItems: 4, maxItems: 4 } : {}),
                    description: "객관식일 때만 정확히 4개의 선택지(A~D). 5개 이상 금지.",
                  },
                  correct_index: {
                    type: "number",
                    description: "객관식일 때만, 정답 선택지의 0-based 인덱스",
                  },
                  answers: {
                    type: "array",
                    items: { type: "string" },
                    description:
                      "숫자 입력(SPR)일 때만. 동치 정답 목록(예: [\"7/2\",\"3.5\"]). 정수·소수·분수 문자열, 기호 없이.",
                  },
                  figure: {
                    type: "object",
                    description:
                      "그래프·도형·표 자료가 꼭 필요한 문항에만(수학, 그리고 Reading & Writing 의 Command of Evidence (Quantitative)). 그림 파일이 아니라 데이터다. " +
                      PLANE_DESC + " " +
                      "기하(하나): " + PARALLEL_TRANSVERSAL_DESC + " " + TRIANGLE_DESC + " " + CIRCLE_DESC + " " + POLYGON_DESC + " " + SOLID_DESC + " " + COMPOSITE_DESC + " " + DATA_DESC + " " + FIGURE_CHOICE_DESC + " " + FIGURE_SET_DESC + " " +
                      "좌표평면의 좌표는 문제의 수치와 정확히 일치해야 한다. 좌표를 직접 찍는 옛 기하 형식(type:'geometry')은 쓰지 않는다.",
                  },
                  statements: {
                    type: "array",
                    items: { type: "string" },
                    description:
                      "로마숫자 진술 문항일 때만: 진술 I, II, III 의 내용(수식은 $…$). 이때 options 는 'I only', 'II only', 'I and II', 'I, II, and III', 'Neither' 같은 조합만. 진술이 없으면 비워 둔다.",
                  },
                  explanation: {
                    type: "string",
                    description: format === "mc" ? "정답 해설" : format === "spr" ? "풀이 과정과 정답" : "모범 답안 또는 풀이 과정",
                  },
                  distractor_rationales: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        index: { type: "number", description: "오답 선택지의 0-based 자리" },
                        plausible_because: { type: "string", description: "피상적으로 읽은 학생에게 왜 그럴듯한가" },
                        matches: { type: "string", description: "지문·자료의 어느 정보와 일부 일치하는가" },
                        why_wrong: { type: "string", description: "정답이 될 수 없는 정확한 이유" },
                        kind: { type: "string", description: "오답 유형: partial|scope|relation_distortion|speaker_confusion|evidence_off_question|sign_error|unit_error|step_missing|axis_misread|condition_ignored|formula_misuse|geometry_misapplied" },
                      },
                      required: ["index", "plausible_because", "matches", "why_wrong", "kind"],
                    },
                    description: "객관식이면 정답 외 세 선택지 각각의 오답 근거(학생에게 보이지 않음). 정반대 말·무관·all/never/only 과장어만으로 지워지는 오답은 만들지 않는다(내용상 필요한 경우 제외).",
                  },
                  difficulty_rationale: {
                    type: "string",
                    description: "이 문항이 요청 난이도인 이유 — 추론 단계 수, 종합해야 하는 문장·자료 수, 핵심 관계(원인/결과·조건·범위·비교·화자·시간)의 미묘함, 오답이 정답과 공유하는 정보, 자료 해석 부담. 지문 길이·어휘 난도는 근거가 아니다.",
                  },
                  design: {
                    type: "object",
                    description: "어려움(hard) 문항 전용 설계 — 지문을 쓰기 **전에** 먼저 정한다(2026-09-15). 이 설계에 맞춰 지문·질문·선택지를 쓴다.",
                    properties: {
                      key_relations: { type: "array", items: { type: "string" }, description: "학생이 종합해야 하는 핵심 관계 2~3개(원인/결과·조건·범위·비교·화자 관점·시간 관계 등). 한국어로 간단히." },
                      answer_uses_relations: { type: "string", description: "정답이 이 관계들을 어떻게 함께 만족하는지." },
                      distractor_design: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            index: { type: "number" },
                            relation: { type: "string", description: "이 오답이 부분적으로 맞춘 관계(key_relations 중 하나 또는 그 일부)." },
                            error_type: { type: "string", description: "어디서 틀렸는가: scope(범위 과장/축소) | causal(인과 왜곡) | intensity(강도 왜곡) | temporal(시간 관계 왜곡) | speaker(화자 혼동) | condition(조건 무시) | partial_computation(부분 계산) | unit(단위 오류) | sign(부호 오류) | other." },
                          },
                          required: ["index", "relation", "error_type"],
                        },
                      },
                      target_difficulty_note: { type: "string", description: "목표 난이도(hard)와 그 근거 — difficulty_rationale 과 같은 기준." },
                    },
                    required: ["key_relations", "answer_uses_relations", "distractor_design"],
                  },
                },
                required: difficulty === "hard" ? ["passage", "question", "explanation", "design"] : ["passage", "question", "explanation"],
              },
            },
          },
          required: ["problems"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "generate_problems" },
    messages: [
      {
        role: "user",
        content: `다음 조건에 맞는 SAT/AP 교재용 문제 ${clampedCount}개를 생성해주세요.
- 과목: ${subjectName}
- 교재 섹션: ${sectionTitle}
- 문제 유형(스킬): ${ruleSkill?.label ?? skillType}
${skillMeta ? `- SAT 영역: ${domainLabel(skillMeta.domain)} / 세부 기술: ${skillMeta.label}${skillMeta.hint ? ` — ${skillMeta.hint}` : ""}. 모든 문항이 이 세부 기술을 묻는 문항이어야 한다(다른 기술로 새지 않는다).` : ""}
- 난이도: ${difficulty === "easy" ? "쉬움" : difficulty === "medium" ? "보통" : "어려움"}
- 답안 형식: ${FORMAT_LABEL[format]}
${ruleSkill ? `유형 규칙(실제 SAT/AP 문항 말투를 그대로 따른다): ${ruleSkill.rule}` : ""}
${format === "mc" ? "객관식은 반드시 선택지 **정확히 4개**(더도 덜도 아님)와 정답 인덱스를 포함해주세요. 선택지는 값만(\"x = 3\" 금지)." : ""}
수식은 항상 $…$ 안에(인라인) 또는 $$…$$(블록) 안에 씁니다. 연립방정식은 $$\\begin{cases} … \\\\ … \\end{cases}$$, 분수는 \\frac{a}{b}, 근호는 \\sqrt{…}, 부등식 연쇄는 $1 < x \\le 5$, 구간은 $[a, b)$. 수식 밖에 \\frac 같은 LaTeX 명령을 두지 않습니다(그대로 노출됩니다).
${format === "spr" ? "숫자 입력(SPR)은 SAT Math 학생 직접 입력 문항입니다: 정답이 하나의 수(정수·소수·분수)로 정해져야 하고, answers 에 동치 표현을 모두 넣어주세요(예: 7/2 와 3.5). 선택지는 만들지 마세요. 양수는 5자, 음수는 6자 안에 쓸 수 있는 값이어야 합니다." : ""}
언어: 문항(지문·질문·선택지·SPR 정답)은 실제 SAT/AP 시험과 같이 **영어**로 쓴다. 해설(explanation)만 한국어로 쓴다.
표기 규칙: 수식은 LaTeX 로 $…$(인라인)·$$…$$(블록) 안에 쓴다. 표·그래프 자료는 마크다운 표가 아니라 figure(type:'data') 데이터로 낸다.
Reading & Writing 구조 규칙: 지문 본문과 질문 단락은 빈 줄로 나누고 질문은 물음표로 끝난다. 빈칸은 ______ 로 **정확히 한 곳**, 밑줄 친 문장은 __문장__ 으로 **정확히 한 문장**(Text Structure 의 'underlined' 문항에서만). Cross-Text 는 'Text 1' / 'Text 2' 제목 줄, Rhetorical Synthesis 는 "…the following notes:" 줄 + '- ' 메모 목록 + "The student wants to …" 질문. 선택지에는 빈칸을 두지 않는다.
그림 규칙: ${FIGURE_POLICY_RULE[figurePolicy]}
선택지 규칙: 값이 숫자·식이면 선택지에 "x =" 같은 변수 이름을 붙이지 않고 값만 쓴다(예: "118", "$\\frac{3}{2}$", "$4x^2 - 1$"). 단위·기호(°, $, %)는 문제 문장에 두고 선택지에는 붙이지 않는다(SAT 관례). 각도는 LaTeX 로 $118^\\circ$ 로 쓴다.
난이도 규칙: 난이도는 지문 길이·낯선 고유명사·어려운 어휘로 만들지 않는다. 학생이 지문·자료의 핵심 관계(원인/결과·조건·범위·비교·화자 관점·시간 관계)를 얼마나 정확히 구분해야 하는지로 설계한다. 어려움(hard)이면 정답은 여러 문장 또는 자료의 관계를 종합해야 하고, 오답은 각각 그중 일부만 포착해야 한다.
오답 규칙(객관식): 각 오답은 지문·자료의 일부를 맞게 반영하되 핵심 관계 하나를 빠뜨리거나 잘못 해석해야 한다. 어휘 문항의 오답은 그 단어의 다른 뜻이나 문맥에 그럴듯한 다른 단어여야 하고, 지문과 무관한 낱말·문장은 쓰지 않는다. 독해 문항(중심 생각·추론·근거·구조·비교)의 오답 셋은 서로 다른 오류 유형이어야 한다 — 예: 하나는 지문의 세부는 맞지만 범위를 과장/축소, 하나는 인과·비교·시간 관계를 뒤바꿈, 하나는 화자·대상을 혼동하거나 증거는 맞지만 질문에 답하지 않음. 지문에 없는 내용의 선택지는 오답으로 쓰지 않는다. 지문과 무관한 선택지, 명백한 반대말, 불필요한 과장(all/never/only)만으로 지워지는 오답은 만들지 않는다(내용상 그 표현이 정답이거나 필요한 오답이면 예외). Math 오답은 실제 풀이 오류 모델(부호·단위 변환·한 단계 누락·축/눈금 오독·조건 무시·평균/비율/확률 계산 오류·도형 관계 오적용)에서 나와야 하고, 정답과 오답 모두 질문의 조건을 다 고려한 값이어야 한다. distractor_rationales 에 오답 셋의 근거를 적는다.
${difficulty === "hard" ? `어려움(hard) 전용 절차 — **지문을 쓰기 전에** design 을 먼저 채운다: (1) key_relations 에 학생이 종합해야 하는 핵심 관계 2~3개를 정한다. (2) answer_uses_relations 에 정답이 그 관계들을 어떻게 함께 만족하는지 적는다. (3) distractor_design 에 각 오답이 어느 관계를 부분적으로 맞추는지와 정확히 어디서 틀리는지(scope·causal·intensity·temporal·speaker·condition·partial_computation·unit·sign 중 하나)를 적는다. 그 다음에만 이 설계에 맞춰 지문·질문·선택지·해설을 쓴다. 설계와 실제 문항이 어긋나면(예: distractor_design 에 적은 오류가 실제 선택지 문장에 드러나지 않음) 안 된다.` : ""}
이 문제들은 특정 학생이 아니라 이 교재를 배정받는 어떤 학생에게도 재사용될 문제
은행에 들어갑니다. 실전 SAT/AP 시험에 나올 법한 퀄리티로 만들어주세요.`,
      },
    ],
  });

  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI 응답을 처리할 수 없습니다.");
  }
  type RawProblem = {
    passage: string;
    question?: string;
    options?: string[];
    correct_index?: number;
    answers?: string[];
    figure?: unknown;
    explanation: string;
    statements?: unknown;
    distractor_rationales?: { index: number; plausible_because: string; matches: string; why_wrong: string; kind: string }[];
    difficulty_rationale?: string;
    design?: { key_relations?: string[]; answer_uses_relations?: string; distractor_design?: { index: number; relation: string; error_type: string }[]; target_difficulty_note?: string };
};
  const input = toolUse.input as { problems?: unknown };
  // 모델이 배열 대신 객체({"0": {...}} 또는 문제 하나)를 주는 경우가 있다 — 배열로 정규화한다.
  const rawList: RawProblem[] = Array.isArray(input.problems)
    ? (input.problems as RawProblem[])
    : input.problems && typeof input.problems === "object"
      ? ("passage" in (input.problems as object)
          ? [input.problems as RawProblem]
          : (Object.values(input.problems as Record<string, RawProblem>) as RawProblem[]))
      : [];
  const raw = rawList.filter((p) => p && (typeof p.passage === "string" || typeof p.question === "string"));
  if (raw.length === 0) throw new Error("AI 응답에 문제가 없습니다.");

  const requiredTypes: readonly string[] | null =
    figurePolicy === "require_plane" ? ["plane"] : figurePolicy === "require_data" ? ["data"] : figurePolicy === "require_figure_choice" ? ["figure_choice"] : figurePolicy === "require_geometry" ? GEOMETRY_TEMPLATE_TYPES : null;
  const hasRequiredFigure = (p: RawProblem) => {
    if (!requiredTypes) return true;
    const v = p.figure ? validateFigureSpec(p.figure) : null;
    return Boolean(v && v.ok && requiredTypes.includes(v.spec.type));
  };
  const kept = requiredTypes && !params.keepFigureless ? raw.filter(hasRequiredFigure) : raw;
  if (kept.length === 0) {
    // 어떤 모양으로 왔는지 서버 로그에 남긴다 — 스키마 설명을 고칠 근거(2026-09-14).
    console.error("[generateSectionProblems] 요구한 그림이 없어 버림:", figurePolicy, raw.map((p) => (p.figure ? `${JSON.stringify(p.figure).slice(0, 400)} → ${validateFigureSpec(p.figure).ok ? "ok" : (validateFigureSpec(p.figure) as { error?: string }).error}` : "figure 없음")));
    throw new Error("요구한 그림이 있는 문항이 하나도 만들어지지 않았습니다. 유형·개수를 바꿔 다시 시도하세요.");
  }

  return kept.map((p) => {
    // 질문은 따로 받는다(2026-09-14 복수 생성 질문 누락 수정). 모델이 question 을 비우고 지문 끝에 질문을 썼으면 갈라낸다.
    const stimulusRaw = stripInlineOptions(typeof p.passage === "string" ? p.passage : "", p.options ?? null);
    let question = typeof p.question === "string" ? p.question.trim() : "";
    let stimulus = stimulusRaw;
    if (!question) {
      const split = splitLegacyQuestion(stimulusRaw);
      if (split.question) { question = split.question; stimulus = split.passage; }
    }
    return {
    format,
    // 그림 데이터는 모양이 맞을 때만 받는다 — 틀리면 그림 없는 문제로 두고 사람이 붙인다.
    figure: (() => { const fv = p.figure ? validateFigureSpec(p.figure) : null; return fv && fv.ok ? fv.spec : null; })(),
    // passage 는 옛 소비자(교재 편집기)용 "지문 + 질문" 한 덩어리. 문제은행은 stimulus / question 을 따로 저장한다.
    passage: composeProblemText(stimulus, question),
    stimulus,
    question: question || null,
    needsFigure: Boolean(requiredTypes) && !hasRequiredFigure(p),
    options: format === "mc" ? p.options ?? null : null,
    correctIndex: format === "mc" ? p.correct_index ?? null : null,
    answers: format === "spr" ? (p.answers ?? []).map(String).filter(Boolean) : null,
    statements: Array.isArray(p.statements) && p.statements.length ? (p.statements as unknown[]).map(String).filter(Boolean) : null,
    explanation: p.explanation,
    difficulty,
    distractorRationales: Array.isArray(p.distractor_rationales) ? p.distractor_rationales : [],
    difficultyRationale: typeof p.difficulty_rationale === "string" ? p.difficulty_rationale : "",
    design: p.design && typeof p.design === "object" ? p.design : null,
    };
  });
}

export async function regenerateProblemCore(params: {
  sectionTitle: string;
  subjectName: string;
  skillType: string;
  difficulty: ProblemDifficulty;
  format: ProblemFormat;
  current: Omit<DocProblem, "id" | "keywords">;
  feedback: string;
}): Promise<Omit<DocProblem, "id" | "keywords"> & { stimulus?: string; question?: string | null }> {
  const { sectionTitle, subjectName, skillType, difficulty, format, current, feedback } = params;

  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2000,
    tools: [
      {
        name: "regenerate_problem",
        description: "기존 문제 초안을 선생님 피드백에 맞춰 수정한 새 버전을 생성한다.",
        input_schema: {
          type: "object",
          properties: {
            passage: { type: "string", description: "지문/자료 본문만(질문 문장은 question 에). 선택지(A~D)는 여기에 쓰지 말고 options 에만 넣는다." },
            question: { type: "string", description: "질문 문장(필수). 실제 SAT 문항 말투, 물음표로 끝난다." },
            options: {
              type: "array",
              items: { type: "string" },
              description: "객관식일 때만 정확히 4개의 선택지",
            },
            correct_index: {
              type: "number",
              description: "객관식일 때만, 정답 선택지의 0-based 인덱스",
            },
            answers: {
              type: "array",
              items: { type: "string" },
              description: "숫자 입력(SPR)일 때만. 동치 정답 목록(예: [\"7/2\",\"3.5\"]).",
            },
            figure: { type: "object", description: "그래프·도형 데이터(generate_problems 의 figure 와 같은 모양). 필요할 때만." },
            explanation: {
              type: "string",
              description: format === "mc" ? "정답 해설" : format === "spr" ? "풀이 과정과 정답" : "모범 답안 또는 풀이 과정",
            },
          },
          required: ["passage", "question", "explanation"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "regenerate_problem" },
    messages: [
      {
        role: "user",
        content: `아래 문제 초안을 선생님 피드백에 맞춰 수정해주세요.
- 과목: ${subjectName}
- 교재 섹션: ${sectionTitle}
- 문제 유형(스킬): ${skillType}
- 난이도: ${difficulty === "easy" ? "쉬움" : difficulty === "medium" ? "보통" : "어려움"}
- 답안 형식: ${FORMAT_LABEL[format]}

현재 초안:
지문: ${current.passage}
${current.options ? `선택지: ${current.options.join(" / ")}` : ""}
${current.correctIndex !== null ? `정답 인덱스: ${current.correctIndex}` : ""}
해설/모범답안: ${current.explanation}

선생님 피드백: ${feedback}

이 피드백을 반영해 문제를 다시 작성해주세요.${
          format === "mc" ? " 객관식은 반드시 선택지 4개와 정답 인덱스를 포함해주세요." : ""
        }`,
      },
    ],
  });

  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI 응답을 처리할 수 없습니다.");
  }
  const raw = toolUse.input as {
    passage: string;
    question?: string;
    options?: string[];
    correct_index?: number;
    answers?: string[];
    figure?: unknown;
    explanation: string;
  };

  const stimulusRaw = stripInlineOptions(raw.passage ?? "", raw.options ?? null);
  let question = (raw.question ?? "").trim();
  let stimulus = stimulusRaw;
  if (!question) { const sp = splitLegacyQuestion(stimulusRaw); if (sp.question) { question = sp.question; stimulus = sp.passage; } }
  return {
    format,
    passage: composeProblemText(stimulus, question),
    stimulus,
    question: question || null,
    options: format === "mc" ? raw.options ?? null : null,
    correctIndex: format === "mc" ? raw.correct_index ?? null : null,
    answers: format === "spr" ? (raw.answers ?? []).map(String).filter(Boolean) : null,
    figure: (() => { const fv = raw.figure ? validateFigureSpec(raw.figure) : null; return fv && fv.ok ? fv.spec : null; })(),
    explanation: raw.explanation,
    difficulty,
  };
}

export async function generateFigureForProblemCore(params: {
  passage: string;
  options: string[] | null;
  explanation: string;
  kind: "plane" | "parallel_transversal" | "triangle" | "circle" | "polygon" | "solid" | "composite" | "data" | "figure_choice" | "figure_set";
  /** 그래프 선택지일 때 정답 자리(0-based) — 정답 그래프를 그 자리에 두게 한다. */
  correctIndex?: number | null;
}): Promise<{ ok: true; figure: unknown } | { ok: false; error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "이 환경에는 AI 생성이 설정되어 있지 않습니다." };
  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2000,
    tools: [
      {
        name: "make_figure",
        description: "주어진 수학 문제에 맞는 그림 데이터 하나를 만든다.",
        input_schema: {
          type: "object",
          properties: {
            figure: {
              type: "object",
              description:
                params.kind === "plane"
                  ? PLANE_DESC
                  : params.kind === "triangle"
                    ? TRIANGLE_DESC
                    : params.kind === "figure_choice"
                      ? FIGURE_CHOICE_DESC + " 도형 선택지(어느 삼각형/사각형이 …인가)면 choices 를 아래 도형 스키마 그대로 4개(같은 type·같은 꼭짓점 수; 좌표 금지, 문제 조건 라벨은 허용). " + TRIANGLE_DESC + " " + POLYGON_DESC + " " + CIRCLE_DESC
                      : params.kind === "figure_set"
                        ? FIGURE_SET_DESC + " " + PLANE_DESC + " " + DATA_DESC
                        : params.kind === "composite"
                          ? COMPOSITE_DESC
                      : params.kind === "data"
                      ? DATA_DESC
                      : params.kind === "circle"
                        ? CIRCLE_DESC
                        : params.kind === "polygon"
                          ? POLYGON_DESC
                          : params.kind === "solid"
                            ? SOLID_DESC
                            : PARALLEL_TRANSVERSAL_DESC,
            },
          },
          required: ["figure"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "make_figure" },
    messages: [
      {
        role: "user",
        content: `다음 문제에 맞는 그림 데이터(${params.kind})를 만들어주세요. ${params.kind === "data" ? "표·그래프를 그리지 말고 값·항목 이름·단위만 적으세요. 지문이 말하는 항목·값·단위와 정확히 같게, 지문에 없는 항목은 넣지 마세요. 자료 유형(kind)은 지문에 맞는 하나만." : params.kind === "plane" ? "그림을 그리지 말고 축 범위와 객체(점·직선·함수·선분·산점도)의 수학적 정의만 적으세요. 지문의 좌표·점 이름·직선 이름·식과 정확히 같게, 정답이 라벨로 드러나면 안 됩니다." : params.kind === "parallel_transversal" ? "좌표나 그림을 그리지 말고 관계만 적으세요 — 평행선·횡단선·교점 이름과 각의 자리(어느 교점, 어느 사분면)·라벨. 지문이 부르는 이름과 정확히 같게, 지문에 없는 이름은 넣지 마세요. 정답 각의 크기가 라벨로 드러나면 안 됩니다." : params.kind === "polygon" ? "좌표를 쓰지 말고 관계만 적으세요 — 종류·꼭짓점 이름(왼쪽 아래부터 반시계)·변 라벨·각·대각선·높이. 지문의 이름·값과 정확히 같게, 구하라는 값은 미지수 문자로." : params.kind === "solid" ? "그림을 그리지 말고 종류와 치수 라벨만 적으세요. 지문의 반지름·높이·모서리 값과 같게, 구하라는 치수는 미지수 문자로." : params.kind === "circle" ? "좌표를 쓰지 말고 관계만 적으세요 — 중심·원 위의 점(자리 각도)·반지름·현/지름·호·부채꼴·중심각·원주각·접선. 지문이 부르는 이름·길이·각과 정확히 같게, 구하라는 값은 미지수 문자로." : params.kind === "triangle" ? "좌표나 그림을 그리지 말고 관계만 적으세요 — 꼭짓점 이름, 종류(직각·이등변·정삼각형·일반), 직각 위치, 지문이 준 변 길이·각 라벨(값 그대로), 등변·등각 표시, 높이, 닮음·합동이면 두 번째 삼각형. 지문에 없는 라벨은 넣지 말고, 구하라는 값(정답)은 라벨에 쓰지 마세요(미지수 문자면 됩니다)." : "좌표·길이·각은 문제의 수치와 정확히 일치해야 하고, 정답이 그림에 글자로 드러나면 안 됩니다."} 라벨은 문제의 기호와 같게, 각 라벨은 선과 겹치지 않게. 라벨은 LaTeX 가 아니라 평문으로(예: 'x°', '37°', 'AB' — '$x^\\circ$' 금지). 한 그림에는 문제에 필요한 한 가지 상황만 그리고 여러 도형을 섞지 않습니다.
지문: ${params.passage}
${params.options ? `선택지: ${params.options.join(" / ")}` : ""}
해설: ${params.explanation}`,
      },
    ],
  });
  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return { ok: false, error: "AI 응답을 처리할 수 없습니다." };
  let figure = (toolUse.input as { figure?: unknown }).figure;
  // 그래프 선택지: 모델이 정답 자리를 안 지키는 일이 잦다 — 지문의 식과 같은 그래프를 correct_index 자리로 옮긴다(그림만 옮기면 뜻이 같다).
  if (params.kind === "figure_choice" && figure && typeof figure === "object" && params.correctIndex !== null && params.correctIndex !== undefined) {
    const v0 = validateFigureSpec(figure);
    if (v0.ok && v0.spec.type === "figure_choice") figure = placeCorrectChoice(v0.spec, params.passage, params.correctIndex);
  }
  const v = validateFigureSpec(figure);
  if (!v.ok) {
    // 관리자가 무엇이 왔는지 볼 수 있게 원문 일부를 붙인다(고칠 수 있어야 한다).
    const raw = JSON.stringify(figure ?? null);
    return { ok: false, error: `AI 가 만든 그림 데이터가 규격에 맞지 않습니다 — ${v.error} (받은 데이터: ${raw.length > 400 ? raw.slice(0, 400) + "…" : raw})` };
  }
  if (v.spec.type !== params.kind) return { ok: false, error: "요구한 종류의 그림이 아닙니다. 다시 시도하세요." };
  // 정규화된 spec 을 돌려준다 — 원문(옛 표기·교점 아닌 점)이 그대로 저장되면 렌더·alt 가 깨진다(2026-09-15).
  return { ok: true, figure: v.spec };
}

/**
 * 오답 부분 수정(2026-09-15 제품 오너: "문제를 검수해서 수정하는 방향").
 *
 * 지문·질문·정답·해설은 이미 계약·독립 검사를 통과했고, **오답 근거만** 걸렸을 때 문항 전체를 다시 만들지 않고
 * 지목된 오답 자리만 고친다. 정답 자리와 다른 오답은 그대로 둔다 — 전체 재생성보다 해소율이 훨씬 높다(2026-09-15 표본 배치 확인).
 */
export async function repairDistractorsCore(params: {
  skillType: string;
  subjectName: string;
  difficulty: ProblemDifficulty;
  stimulus: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  /** 고칠 자리와 그 사유(독립 검사가 낸 오답 근거 문장). */
  targets: { index: number; reason: string }[];
}): Promise<{ ok: true; options: string[] } | { ok: false; error: string }> {
  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1200,
    tools: [
      {
        name: "repair_distractors",
        description: "지정된 오답 선택지만 다시 쓴다. 지문·질문·정답·다른 선택지는 바꾸지 않는다.",
        input_schema: {
          type: "object",
          properties: {
            replacements: {
              type: "array",
              items: { type: "object", properties: { index: { type: "number" }, text: { type: "string" } }, required: ["index", "text"] },
              description: "고친 선택지만, {index, text} 쌍으로. 요청받지 않은 자리는 넣지 않는다.",
            },
          },
          required: ["replacements"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "repair_distractors" },
    messages: [
      {
        role: "user",
        content: `아래 SAT/AP 문항의 오답 선택지 중 지목된 자리만 다시 씁니다. 지문·질문·정답·다른 선택지·해설은 그대로 둡니다.
- 과목: ${params.subjectName} · 유형: ${params.skillType} · 난이도: ${params.difficulty}

지문/자료: ${params.stimulus}
질문: ${params.question}
선택지: ${params.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}${i === params.correctIndex ? " (정답 — 바꾸지 않음)" : ""}`).join("\n")}
해설: ${params.explanation}

고칠 자리와 사유:
${params.targets.map((t) => `${String.fromCharCode(65 + t.index)}) — ${t.reason}`).join("\n")}

새 오답 규칙: 지문·자료의 일부를 맞게 반영하되 핵심 관계(원인/결과·조건·범위·비교·화자·시간, 또는 Math 라면 부호·단위·한 단계 누락·축 오독·조건 무시·계산 오류) 하나를 놓치거나 잘못 해석해야 한다. 지문과 무관한 내용, 명백한 반대말, all/never/only 같은 과장만으로 이루어진 선택지는 쓰지 않는다(어려움 난이도에서는 특히). 다른 선택지·정답과 겹치지 않게 한다.`,
      },
    ],
  });
  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return { ok: false, error: "오답 수정 응답을 처리할 수 없습니다." };
  const raw = (toolUse.input as { replacements?: { index: number; text: string }[] }).replacements ?? [];
  const options = [...params.options];
  for (const r of raw) {
    if (typeof r.index === "number" && r.index >= 0 && r.index < options.length && r.index !== params.correctIndex && typeof r.text === "string" && r.text.trim()) {
      options[r.index] = r.text.trim();
    }
  }
  const changed = params.targets.some((t) => options[t.index] !== params.options[t.index]);
  if (!changed) return { ok: false, error: "오답을 바꾸지 못했습니다." };
  return { ok: true, options };
}

/**
 * 범위가 명확한 부분 수정(2026-09-15 제품 오너: "부분 수정이 기본 경로"). 빈칸 개수·수식 미닫힘·선택지 개수처럼
 * 지문/질문/선택지/진술/해설 중 **일부 필드만** 고치면 되는 계약 실패에 쓴다. 자료(figure)·정답의 타당성 자체가
 * 걸린 문제는 이 경로로 다루지 않는다(구조적 실패로 분류되어 전체 재생성으로 간다).
 *
 * 모델은 바꿀 필드만 돌려준다 — 응답에 없는 필드는 호출자가 원래 값을 그대로 유지한다(결정적 보존).
 */
export async function repairFieldsCore(params: {
  skillType: string;
  subjectName: string;
  difficulty: ProblemDifficulty;
  format: ProblemFormat;
  passage: string;
  question: string;
  options: string[] | null;
  correctIndex: number | null;
  statements: string[] | null;
  explanation: string;
  /** 걸린 사유 문장들. */
  issues: string[];
}): Promise<{ ok: true; passage: string; question: string; options: string[] | null; correctIndex: number | null; statements: string[] | null; explanation: string; changedFields: string[] } | { ok: false; error: string }> {
  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2000,
    tools: [
      {
        name: "repair_fields",
        description: "검증에 걸린 부분만 고친다. 문제없는 필드는 응답에 넣지 않는다(그대로 유지된다).",
        input_schema: {
          type: "object",
          properties: {
            passage: { type: "string", description: "지문/자료를 고쳐야 할 때만." },
            question: { type: "string", description: "질문을 고쳐야 할 때만." },
            options: { type: "array", items: { type: "string" }, description: "선택지를 고쳐야 할 때만(개수·중복·형식). 바꾸면 correct_index 도 함께 준다." },
            correct_index: { type: "number", description: "options 를 바꿨다면 새 정답 자리(0-based)." },
            statements: { type: "array", items: { type: "string" }, description: "로마숫자 진술을 고쳐야 할 때만." },
            explanation: { type: "string", description: "해설을 고쳐야 할 때만(예: 수식 표기)." },
          },
        },
      },
    ],
    tool_choice: { type: "tool", name: "repair_fields" },
    messages: [
      {
        role: "user",
        content: `아래 SAT/AP 문항이 검증에 걸렸습니다. 걸린 사유를 해소하도록 **필요한 필드만** 고쳐 돌려주세요. 문제없는 필드는 응답에 넣지 마세요(원본이 그대로 유지됩니다).
- 과목: ${params.subjectName} · 유형: ${params.skillType} · 난이도: ${params.difficulty} · 답안 형식: ${params.format}

지문/자료: ${params.passage || "(없음)"}
질문: ${params.question}
${params.options ? `선택지: ${params.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join(" / ")} (정답 ${params.correctIndex !== null ? String.fromCharCode(65 + params.correctIndex) : "?"})` : ""}
${params.statements?.length ? `진술: ${params.statements.join(" / ")}` : ""}
해설: ${params.explanation}

걸린 사유:
${params.issues.map((r) => `- ${r}`).join("\n")}

지문/질문/선택지/진술/해설이 서로 계속 맞아야 합니다(빈칸이면 지문에 정확히 하나, 선택지를 4개로 맞추면 정답 자리도 같이, 수식은 $…$ 로 닫기 등).`,
      },
    ],
  });
  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return { ok: false, error: "부분 수정 응답을 처리할 수 없습니다." };
  const raw = toolUse.input as { passage?: string; question?: string; options?: string[]; correct_index?: number; statements?: string[]; explanation?: string };
  const changedFields: string[] = [];
  const passage = typeof raw.passage === "string" && raw.passage.trim() ? (changedFields.push("passage"), raw.passage) : params.passage;
  const question = typeof raw.question === "string" && raw.question.trim() ? (changedFields.push("question"), raw.question) : params.question;
  const options = Array.isArray(raw.options) && raw.options.length ? (changedFields.push("options"), raw.options) : params.options;
  const correctIndex = Array.isArray(raw.options) && typeof raw.correct_index === "number" ? raw.correct_index : params.correctIndex;
  const statements = Array.isArray(raw.statements) ? (changedFields.push("statements"), raw.statements) : params.statements;
  const explanation = typeof raw.explanation === "string" && raw.explanation.trim() ? (changedFields.push("explanation"), raw.explanation) : params.explanation;
  if (!changedFields.length) return { ok: false, error: "고친 필드가 없습니다." };
  return { ok: true, passage, question, options, correctIndex, statements, explanation, changedFields };
}
