import type { ArchetypeSpec, FrqTemplateSpec, SkillRule, SubjectGuide } from "./types";
import physicsArchetypes from "./physics1-archetypes.json";

// AP Physics 1(2027, 8단원, 알헤브라 기반) 생성 가이드 설정 — 본문: docs/ap/physics1-groundwork.md §10. 수치·키·그림 장면 모델은 Python 원형(scripts/ap-generation/archetypes/phys_p0_*.py)이
// 계산하고 sympy 기호 풀이와 numpy/RK4/이분법 수치 경로로 이중 계산한다. 원형 목록(physics1-archetypes.json)의 원천은 `registry.py guide-physics`.
// 근거: docs/ap/physics1-facts.md(CED 검증 사실). 공식 참조 정보 본문은 UNVERIFIED — 상수는 G 한 곳(phys_common.py)에서 바꾼다.

const sk = (code: string, name: string, mc: boolean, designRules: string[], banned: string[] = []): SkillRule => ({ code, name, mc, frq: true, designRules, banned });

export const physicsGuide: SubjectGuide = {
  subject: "ap_physics_1",
  guideDoc: "docs/ap/physics1-groundwork.md",
  examStructure: "2027: MC 42 questions/85 min (single-answer, four options, discrete questions and shared-stimulus sets; exact set counts are not published), 50%; FRQ 4 questions/95 min, 50%, fixed order and weights: Mathematical Routines 10 points, Translation Between Representations 12, Experimental Design and Analysis 10, Qualitative/Quantitative Translation 8 (40 total). Four-function, scientific and graphing calculators allowed throughout. Reference information is provided. Delivery is hybrid: questions in Bluebook, FRQ answers handwritten on paper.",
  units: [
    { unit: "1", title: "Kinematics", mcWeight: [10, 15], inScope: ["scalars and vectors in one dimension", "displacement, velocity and acceleration; motion graphs", "motion diagrams", "reference frames and relative motion", "vectors and projectile motion in two dimensions"], outOfScope: ["calculus-based derivations", "non-constant acceleration beyond graph reading"] },
    { unit: "2", title: "Force and Translational Dynamics", mcWeight: [18, 23], inScope: ["systems and center of mass", "free-body diagrams", "Newton's three laws", "gravitational force near and far from a planet", "kinetic and static friction", "ideal springs", "uniform circular motion"], outOfScope: ["drag and air resistance", "non-inertial frames"] },
    { unit: "3", title: "Work, Energy, and Power", mcWeight: [18, 23], inScope: ["translational kinetic energy", "work as force times displacement and as area under a force-position graph", "gravitational and spring potential energy", "conservation of energy with dissipation", "average and instantaneous power"], outOfScope: ["line integrals", "potential energy functions beyond spring and gravity"] },
    { unit: "4", title: "Linear Momentum", mcWeight: [10, 15], inScope: ["momentum and impulse", "force-time graphs", "conservation of linear momentum", "elastic and inelastic collisions in one dimension"], outOfScope: ["two-dimensional collisions with vector resolution"] },
    { unit: "5", title: "Torque and Rotational Dynamics", mcWeight: [10, 15], inScope: ["rotational kinematics", "v = omega r", "torque", "rotational inertia of point masses and given shapes", "rotational equilibrium", "Newton's second law in rotational form"], outOfScope: ["calculating rotational inertia by integration", "vector cross-product notation"] },
    { unit: "6", title: "Energy and Momentum of Rotating Systems", mcWeight: [5, 8], inScope: ["rotational kinetic energy", "torque and work", "angular momentum and angular impulse", "conservation of angular momentum", "rolling without slipping", "circular orbits of satellites"], outOfScope: ["gyroscopes and precession"] },
    { unit: "7", title: "Oscillations", mcWeight: [5, 8], inScope: ["simple harmonic motion", "period and frequency of mass-spring and simple pendulum systems", "position, velocity and acceleration graphs", "energy of oscillators"], outOfScope: ["damped and driven oscillation", "physical pendulum"] },
    { unit: "8", title: "Fluids", mcWeight: [10, 15], inScope: ["density", "pressure and pressure at depth", "buoyancy", "Pascal's principle", "continuity equation", "Bernoulli's equation and Torricelli's law"], outOfScope: ["viscosity and turbulence", "surface tension"] },
  ],
  skills: [
    sk("1.A", "Create representations that depict physical situations", false, ["free-body diagrams, motion diagrams, energy bar charts, graphs created by the student (FRQ only)"]),
    sk("1.B", "Select and describe representations that are appropriate", false, ["FRQ only"]),
    sk("1.C", "Re-express a representation as another", false, ["FRQ only"]),
    sk("2.A", "Identify an appropriate mathematical routine and derive an expression", true, ["derive a symbolic relationship before substituting numbers"]),
    sk("2.B", "Calculate a quantity", true, ["a short calculation whose route requires choosing the right law or reading a representation; never only a plug-in"], ["long arithmetic as the only difficulty"]),
    sk("2.C", "Compare quantities", true, ["rank or compare two quantities with justification from a relationship"]),
    sk("2.D", "Predict how a change in a quantity affects others", true, ["scaling prediction from proportional relationships"]),
    sk("3.A", "Create experimental procedures", false, ["FRQ only"]),
    sk("3.B", "Support a claim with a physical principle", true, ["fixed-sentence options: one correct claim and named misconceptions"]),
    sk("3.C", "Justify a claim using evidence", true, ["evidence from a graph, data table or calculation supports the claim"]),
  ],
  archetypes: physicsArchetypes as ArchetypeSpec[],
  frqTemplates: [
    { id: "phf_mr_table_block", template: "mr", topic: "2.5", extraTopics: ["2.2", "2.7"], skill: "2.B", calculator: "allowed", parts: "A free-body diagram(3) / B derivation(3) / C numeric(2) / D justified prediction(2)", points: 10, verifiedBy: ["sympy solves Newton's second law for both blocks; numpy linalg.solve recomputes the acceleration and tension; the sign of the derivative of tension in mu decides the prediction"] },
    { id: "phf_tbr_spring_shm", template: "tbr", topic: "7.3", extraTopics: ["7.2", "7.4", "3.4"], skill: "2.D", calculator: "allowed", parts: "A energy bars(3) / B derivation(2) / C x-t graph(4) / D prediction(3)", points: 12, verifiedBy: ["RK4 simulation recomputes the period and maximum speed"] },
    { id: "phf_lab_spring_k", template: "lab", topic: "7.2", extraTopics: ["7.3"], skill: "3.A", calculator: "allowed", parts: "A procedure(3) / B linearization(1) / C plot(3) / D slope and k(3)", points: 10, verifiedBy: ["normal equations recompute the slope; the fitted k is compared with the generating constant within four percent"] },
    { id: "phf_qqt_collision", template: "qqt", topic: "4.4", extraTopics: ["4.3", "3.1"], skill: "3.B", calculator: "allowed", parts: "A claim and justification(3) / B derivation(3) / C prediction(2)", points: 8, verifiedBy: ["sympy solves momentum conservation; the kinetic energy fraction is recomputed numerically"] },
    // 2026-10-13 두 번째 시나리오(유형마다 2개): 같은 유형·배점이고 상황이 다르다(phys_p0_frq2.py).
    { id: "phf_mr_incline_slide", template: "mr", topic: "2.7", extraTopics: ["2.5", "2.2", "1.2"], skill: "2.B", calculator: "allowed", parts: "A free-body diagram(3) / B derivation(3) / C numeric(2) / D justified prediction(2)", points: 10, verifiedBy: ["sympy solves the two Newton equations along and perpendicular to the incline; an RK4 integration of the motion recomputes the speed after the distance"] },
    { id: "phf_mr_energy_patch", template: "mr", topic: "3.4", extraTopics: ["3.2", "3.3", "2.7"], skill: "2.B", calculator: "allowed", parts: "A energy bars(3) / B derivation(3) / C numeric(2) / D justified prediction(2)", points: 10, verifiedBy: ["sympy solves the work-energy equation; an RK4 integration of the deceleration recomputes the stopping distance"] },
    { id: "phf_tbr_cart_vt", template: "tbr", topic: "1.3", extraTopics: ["1.2"], skill: "1.A", calculator: "allowed", parts: "A v-t graph(4) / B displacement from area(3) / C a-t graph(3) / D prediction(2)", points: 12, verifiedBy: ["exact fractions of the three areas versus trapezoid integration of a densely sampled velocity"] },
    { id: "phf_tbr_vertical_toss", template: "tbr", topic: "3.4", extraTopics: ["3.3", "3.1", "1.2"], skill: "1.A", calculator: "allowed", parts: "A energy bars(3) / B derivation(2) / C K and U graphs(4) / D prediction(3)", points: 12, verifiedBy: ["RK4 simulation recomputes the maximum height and the conserved energy"] },
    { id: "phf_lab_pendulum_g", template: "lab", topic: "7.2", extraTopics: ["7.1"], skill: "3.A", calculator: "allowed", parts: "A procedure(3) / B linearization(1) / C plot(3) / D slope and g(3)", points: 10, verifiedBy: ["normal equations recompute the slope; the fitted g is compared with 9.8 within four percent"] },
    { id: "phf_lab_sliding_friction", template: "lab", topic: "3.2", extraTopics: ["2.7", "3.1"], skill: "3.A", calculator: "allowed", parts: "A procedure(3) / B linearization(1) / C plot(3) / D slope and friction coefficient(3)", points: 10, verifiedBy: ["normal equations recompute the slope; the fitted coefficient is compared with the generating coefficient within four percent"] },
    { id: "phf_qqt_flat_curve", template: "qqt", topic: "2.9", extraTopics: ["2.7", "2.5"], skill: "3.B", calculator: "allowed", parts: "A claim and justification(3) / B derivation and value(3) / C prediction(2)", points: 8, verifiedBy: ["sympy solves the centripetal-force condition; a bisection root finder recomputes the maximum speed"] },
    { id: "phf_qqt_floating_block", template: "qqt", topic: "8.3", extraTopics: ["8.1", "2.4"], skill: "3.B", calculator: "allowed", parts: "A claim and justification(3) / B derivation and value(3) / C prediction(2)", points: 8, verifiedBy: ["sympy solves the force balance; a bisection root finder on the net force recomputes the submerged fraction"] },
    // 2026-10-19 세 번째 시나리오(PH6 이 앞선 세트와 FRQ 원형을 겹치지 않도록): phys_p0_frq3.py.
    { id: "phf_mr_atwood_machine", template: "mr", topic: "2.5", extraTopics: ["2.2", "2.4", "1.2"], skill: "2.B", calculator: "allowed", parts: "A free-body diagram(3) / B derivation(3) / C numeric(2) / D justified prediction(2)", points: 10, verifiedBy: ["sympy solves Newton's second law for both blocks; numpy linalg.solve recomputes the acceleration and tension; an RK4 integration over the height recomputes the final speed"] },
    { id: "phf_tbr_elevator_forces", template: "tbr", topic: "1.3", extraTopics: ["1.2", "2.5"], skill: "1.A", calculator: "allowed", parts: "A v-t graph(4) / B distance from area(3) / C scale reading(3) / D prediction(2)", points: 12, verifiedBy: ["exact fractions of the three areas versus trapezoid integration; the scale reading from a linear solve of Newton's second law"] },
    { id: "phf_lab_incline_g", template: "lab", topic: "2.5", extraTopics: ["1.2", "2.7"], skill: "3.A", calculator: "allowed", parts: "A procedure(3) / B linearization(1) / C plot(3) / D slope and g(3)", points: 10, verifiedBy: ["normal equations recompute the slope; the fitted g is compared with 9.8 within four percent"] },
    { id: "phf_qqt_orbit_speed", template: "qqt", topic: "6.6", extraTopics: ["2.6", "2.9"], skill: "3.B", calculator: "allowed", parts: "A claim and justification(3) / B derivation and value(3) / C prediction(2)", points: 8, verifiedBy: ["sympy solves the centripetal-force condition; an RK4 integration of the orbit confirms the speed and the period ratio"] },
  ] as FrqTemplateSpec[],
  notation: ["every number with a unit is written $12.3\\text{ m/s}$; symbols and expressions are inside $...$", "SI units only; g = 9.8 m/s^2 (reference constant stated once in the exam header, not in each item)", "three significant figures in options and answers unless the data have fewer; data given to two or three significant figures", "vectors in one dimension carry a sign with a stated positive direction"],
  calculatorRules: ["four-function, scientific and graphing calculators are allowed throughout; never make arithmetic the only demand", "option values differ by at least 8 percent so rounding cannot blur the key", "an interpretation or claim item uses four fixed sentences: one correct statement and three named misconceptions", "model assumptions (negligible air resistance, ideal strings, pulleys and springs) are stated in the stem or are the course default"],
  stimulusTypes: [
    { kind: "graph", howGenerated: "Python builds piecewise linear or dense curves for v-t, a-t, F-x, F-t, tau-t and x-t graphs from integer vertices or closed forms", howVerified: "areas and slopes are recomputed with exact fractions and numpy integration" },
    { kind: "diagram", howGenerated: "Python scene models (free-body diagram, energy bars, incline, pulley, collision, beam, U-tube, tank) rendered deterministically; text numbers come from the same variables", howVerified: "scene checks: arrow length proportional to force, equilibrium sums to zero, energy bars conserved, viewBox bounds; choice figures differ and carry no hint" },
    { kind: "table", howGenerated: "data tables computed by code with a seeded noise generator for experiments", howVerified: "least-squares fits recomputed by the normal equations" },
    { kind: "none", howGenerated: "scenario text with all values in the stem", howVerified: "sympy closed form versus numeric or ODE path" },
  ],
  difficultyAllowed: ["choosing the governing law", "a representation read or translated (graph, free-body diagram, energy bars)", "one proportional-reasoning prediction", "a unit conversion", "one additional reasoning step linking a result to a claim"],
  difficultyBanned: ["long or unrounded arithmetic", "ambiguous wording or unstated model assumptions", "circuits, waves, optics, thermodynamics or electrostatics (not in the 2027 course)", "calculus derivations", "irrelevant context or extra reading load", "reproducing a College Board sample item scenario"],
  loadLimits: { mcSeconds: [45, 130], stemWordsMax: 110, mcOptions: 4, frqMinutes: 27, frqPoints: 12 },
  frqRubricPatterns: ["analytic rows worth one point each", "diagram and graph rows use checklists (labels, directions, relative lengths, axes, scale, points, trend line)", "a numeric row carries units; an expression row accepts equivalent algebra", "justification rows require a named principle and a link to the claim"],
  frqAccepted: ["equivalent algebraic forms", "answers within rounding of the stated significant figures", "a different valid justification using Newton's second law, energy or momentum"],
  bannedTerms: [
    { pattern: "\\b(circuit|resistor|capacitor|voltage|electric (field|charge)|magnetic|photon|refraction|diffraction|thermodynamic|heat engine|sound wave)\\b", why: "circuits, waves, electromagnetism and thermodynamics are not in the 2027 AP Physics 1 course" },
    { pattern: "AP\\s*[345]|level 5|score of [345]", why: "never label items by AP score level" },
    { pattern: "\\b(air resistance|drag) is (included|significant)\\b", why: "drag is not modeled in this course unless stated and ignored by default" },
  ],
  validators: [
    { item: "mc", checks: ["four unique options; key index valid", "each wrong option has a named misconception", "option values at least 8 percent apart", "math wrapped in $...$", "skill is one of 2.A 2.B 2.C 2.D 3.B 3.C (never 1.x or 3.A)", "scene model passes the deterministic scene checks", "est_seconds within 30 to 150"] },
    { item: "frq", checks: ["total points equal the type weight (MR 10, TBR 12, LAB 10, QQT 8)", "rubric rows sum to each part's points", "row kinds limited to expression, numeric, diagram, graph, claim, justification, design", "dependent rows require an earlier row"] },
  ],
  acceptExamples: [
    { title: "representation translation (3.B)", text: "An energy bar chart choice for a frictionless slide: one chart conserves the total, three distractors change the total or the form of energy." },
    { title: "proportional reasoning (2.D)", text: "A mass-spring oscillator has its mass and spring constant changed; the student predicts the period scaling." },
  ],
  rejectExamples: [
    { title: "plug-in only", text: "Calculate the kinetic energy of a 2 kg object moving at 3 m/s.", reason: "calculation only with no law selection or representation reading" },
    { title: "out-of-scope content", text: "Find the equivalent resistance of two resistors in parallel.", reason: "circuits are not in the 2027 course" },
  ],
};

export function physicsWordingRules(): string {
  const g = physicsGuide;
  return [
    `SUBJECT GUIDE (${g.guideDoc}). Exam structure: ${g.examStructure}`,
    `Notation: ${g.notation.join("; ")}.`,
    `Calculator and style rules: ${g.calculatorRules.join("; ")}.`,
    `Never use: ${g.difficultyBanned.join("; ")}.`,
  ].join("\n");
}
