import type { ArchetypeSpec, FrqTemplateSpec, SubjectGuide } from "./types";
import { physicsGuide } from "./physics1";
import physicsCArchetypes from "./physics-c-mech-archetypes.json";

// AP Physics C: Mechanics(2027, 7단원, 미적분 기반) 생성 가이드 — 본문: docs/ap/physics-c-mechanics-groundwork.md. 구조·검증 방식은 Physics 1 가이드(physics1.ts)와 같고 단원 7개·미적분 풀이 단계·저항력·물리 진자·회전 관성 적분이 다르다.
// 수치·키·그림 장면 모델은 Python 원형(scripts/ap-generation/archetypes/physc_p0_*.py)이 계산하고 sympy 기호 풀이와 numpy 수치 미분·적분·RK4·이분법으로 이중 계산한다. 원형 목록의 원천은 `registry.py guide-physc`.
// 시험 형식(MC 42/85분·FRQ 4/95분)과 FRQ 배점(MR 10·TBR 12·EDA 10·QQT 8)은 같은 계열 CED(Physics C: E&M·Physics 2)의 값이며 Mechanics 자체 CED 전문으로는 확인하지 못했다(공개 전 재확인).

export const physicsCGuide: SubjectGuide = {
  ...physicsGuide,
  subject: "ap_physics_c_mechanics",
  guideDoc: "docs/ap/physics-c-mechanics-groundwork.md",
  examStructure: "2027 (provisional, to be confirmed against the Physics C: Mechanics CED): MC 42 questions/85 min (single-answer, four options, discrete questions and shared-stimulus sets), 50%; FRQ 4 questions/95 min, 50% — Mathematical Routines 10 points, Translation Between Representations 12, Experimental Design and Analysis 10, Qualitative/Quantitative Translation 8 (same four types as the sibling Physics C: E&M and Physics 2 courses). Calculus-based. Calculators allowed. Delivery is hybrid: questions in Bluebook, FRQ answers handwritten on paper.",
  units: [
    { unit: "1", title: "Kinematics", mcWeight: [10, 15], inScope: ["derivatives and integrals of motion functions", "displacement, velocity and acceleration; motion graphs", "reference frames and relative motion", "vectors and projectile motion in two dimensions"], outOfScope: ["differential equations beyond those given in the stem"] },
    { unit: "2", title: "Force and Translational Dynamics", mcWeight: [20, 25], inScope: ["systems and center of mass, including integration for continuous objects", "free-body diagrams", "Newton's three laws", "gravitational force", "kinetic and static friction", "ideal springs", "resistive forces linear and quadratic in speed, terminal speed and the exponential approach", "circular motion"], outOfScope: ["non-inertial frames", "solving nonlinear differential equations in closed form"] },
    { unit: "3", title: "Work, Energy, and Power", mcWeight: [15, 25], inScope: ["work as the integral of force over displacement", "kinetic and potential energy; force as the negative gradient of potential energy in one dimension", "conservation of energy with dissipation", "equilibrium and stability from potential energy graphs", "power as P = F v and as the rate of work"], outOfScope: ["line integrals in three dimensions"] },
    { unit: "4", title: "Linear Momentum", mcWeight: [10, 20], inScope: ["momentum and impulse as the integral of force over time", "conservation of linear momentum", "elastic and inelastic collisions in one dimension", "center-of-mass velocity"], outOfScope: ["variable-mass systems such as rockets"] },
    { unit: "5", title: "Torque and Rotational Dynamics", mcWeight: [10, 15], inScope: ["rotational kinematics with derivatives", "tangential and centripetal acceleration", "torque", "rotational inertia by integration, the parallel-axis theorem", "rotational equilibrium", "Newton's second law in rotational form"], outOfScope: ["tensor rotational inertia", "gyroscopes"] },
    { unit: "6", title: "Energy and Momentum of Rotating Systems", mcWeight: [10, 15], inScope: ["rotational kinetic energy", "work done by a torque", "angular momentum of particles and rigid bodies and angular impulse", "conservation of angular momentum", "rolling without slipping", "orbits: speed, energy, Kepler's third law, escape speed"], outOfScope: ["precession"] },
    { unit: "7", title: "Oscillations", mcWeight: [10, 15], inScope: ["simple harmonic motion and its differential equation", "period and frequency of mass-spring systems, simple and physical pendulums", "position, velocity and acceleration as functions of time", "energy of oscillators"], outOfScope: ["damped and driven oscillation", "coupled oscillators"] },
  ],
  archetypes: physicsCArchetypes as ArchetypeSpec[],
  frqTemplates: [
    { id: "pcf_mr_variable_force_block", template: "mr", topic: "2.5", extraTopics: ["1.2", "2.2"], skill: "2.B", calculator: "allowed", parts: "A free-body diagram(3) / B derivation by integration(3) / C numeric(2) / D justified prediction(2)", points: 10, verifiedBy: ["sympy integrates the acceleration; an RK4 integration recomputes the speed and the distance"] },
    { id: "pcf_mr_drag_fall", template: "mr", topic: "2.9", extraTopics: ["2.5", "2.2", "1.2"], skill: "2.B", calculator: "allowed", parts: "A free-body diagram(3) / B derivation of terminal speed(3) / C numeric(2) / D justified prediction(2)", points: 10, verifiedBy: ["an RK4 integration of the drag equation over many time constants recomputes the terminal speed"] },
    { id: "pcf_tbr_shm_blocks", template: "tbr", topic: "7.3", extraTopics: ["7.2", "7.4", "3.4"], skill: "2.D", calculator: "allowed", parts: "A x-t graph(4) / B derivation(3) / C numeric(3) / D prediction(2)", points: 12, verifiedBy: ["an RK4 simulation recomputes the period and the maximum speed; the maximum acceleration follows from Hooke's law"] },
    { id: "pcf_tbr_work_energy_graph", template: "tbr", topic: "3.2", extraTopics: ["3.1", "1.2"], skill: "1.C", calculator: "allowed", parts: "A F-x graph(4) / B K(x) by integration(3) / C numeric(3) / D prediction(2)", points: 12, verifiedBy: ["sympy integrates the force; a Simpson integration recomputes the work"] },
    { id: "pcf_lab_rolling_incline", template: "lab", topic: "6.5", extraTopics: ["5.4", "3.4"], skill: "3.A", calculator: "allowed", parts: "A procedure(3) / B linearization(1) / C plot(3) / D slope and rotational inertia coefficient(3)", points: 10, verifiedBy: ["normal equations recompute the slope; the fitted coefficient is compared with the generating value within twelve percent"] },
    { id: "pcf_lab_terminal_speed", template: "lab", topic: "2.9", extraTopics: ["2.5", "1.2"], skill: "3.A", calculator: "allowed", parts: "A procedure(3) / B linearization(1) / C plot(3) / D slope and drag coefficient(3)", points: 10, verifiedBy: ["normal equations recompute the slope; the fitted coefficient is compared with the generating value within five percent"] },
    { id: "pcf_qqt_rolling_race", template: "qqt", topic: "6.5", extraTopics: ["6.1", "3.4"], skill: "3.B", calculator: "allowed", parts: "A claim and justification(3) / B derivation and ratio(3) / C prediction(2)", points: 8, verifiedBy: ["the energy balance is recomputed numerically for the stated coefficient and for a hoop"] },
    { id: "pcf_qqt_bullet_rod", template: "qqt", topic: "6.4", extraTopics: ["6.3", "5.4", "3.4"], skill: "3.B", calculator: "allowed", parts: "A claim and justification(3) / B derivation and value(3) / C energy fraction(2)", points: 8, verifiedBy: ["numpy linalg.solve of the angular momentum balance recomputes the angular speed"] },
    // 2026-10-20 2차 저작 시나리오(유형마다 3개): physc_p0_frq2.py.
    { id: "pcf_mr_pulley_disk", template: "mr", topic: "5.6", extraTopics: ["2.5", "5.4", "1.2"], skill: "2.B", calculator: "allowed", parts: "A free-body diagram(3) / B derivation with a rotating pulley(3) / C numeric(2) / D justified prediction(2)", points: 10, verifiedBy: ["numpy linalg.solve of the translational and rotational equations recomputes the acceleration and the tension"] },
    { id: "pcf_tbr_drag_graph", template: "tbr", topic: "2.9", extraTopics: ["2.5", "1.2", "1.3"], skill: "1.C", calculator: "allowed", parts: "A v-t graph(4) / B derivation of terminal speed(3) / C numeric(3) / D prediction(2)", points: 12, verifiedBy: ["an RK4 integration of the drag equation recomputes the speed at one time constant"] },
    { id: "pcf_lab_pendulum_g", template: "lab", topic: "7.5", extraTopics: ["7.2", "3.4"], skill: "3.A", calculator: "allowed", parts: "A procedure(3) / B linearization(1) / C plot(3) / D slope and g(3)", points: 10, verifiedBy: ["normal equations recompute the slope; the fitted g is compared with 9.8 within four percent"] },
    { id: "pcf_qqt_orbit_energy", template: "qqt", topic: "6.6", extraTopics: ["3.4", "2.6"], skill: "3.B", calculator: "allowed", parts: "A claim and justification(3) / B derivation and energy change(3) / C speed ratio(2)", points: 8, verifiedBy: ["the energies are recomputed numerically from the orbital speeds at the two radii"] },
    // 2026-10-20 3차 저작 시나리오(유형마다 4개): physc_p0_frq3.py.
    { id: "pcf_mr_ramp_friction", template: "mr", topic: "3.4", extraTopics: ["2.7", "2.2", "3.2"], skill: "2.B", calculator: "allowed", parts: "A free-body diagram(3) / B derivation with the work-energy theorem(3) / C numeric(2) / D justified prediction(2)", points: 10, verifiedBy: ["an RK4 integration of the constant acceleration along the incline recomputes the distance and the speed"] },
    { id: "pcf_tbr_spring_energy_graph", template: "tbr", topic: "7.4", extraTopics: ["3.3", "3.4", "7.2"], skill: "1.C", calculator: "allowed", parts: "A K and U graphs(4) / B derivation(3) / C numeric(3) / D prediction(2)", points: 12, verifiedBy: ["the energies and the speeds are recomputed numerically from the closed forms"] },
    { id: "pcf_lab_disk_inertia", template: "lab", topic: "5.6", extraTopics: ["5.4", "2.5"], skill: "3.A", calculator: "allowed", parts: "A procedure(3) / B linearization(1) / C plot(3) / D slope and rotational inertia(3)", points: 10, verifiedBy: ["normal equations recompute the slope; the fitted inertia is compared with the generating value within eight percent"] },
    { id: "pcf_qqt_skater", template: "qqt", topic: "6.4", extraTopics: ["6.1", "5.4"], skill: "3.B", calculator: "allowed", parts: "A claim and justification(3) / B derivation and value(3) / C energy ratio(2)", points: 8, verifiedBy: ["the angular momentum and the kinetic energies are recomputed numerically before and after"] },
    // 2026-10-20 4차 저작 시나리오(유형마다 5개): physc_p0_frq4.py.
    { id: "pcf_mr_rod_release", template: "mr", topic: "5.6", extraTopics: ["6.1", "5.4", "2.2"], skill: "2.B", calculator: "allowed", parts: "A free-body diagram(3) / B derivation of the angular acceleration(3) / C numeric(2) / D justified prediction(2)", points: 10, verifiedBy: ["the torque and the rotational inertia are combined numerically; the angular speed is recomputed from the energy balance"] },
    { id: "pcf_tbr_shm_phase_graphs", template: "tbr", topic: "7.3", extraTopics: ["7.1", "7.2", "1.3"], skill: "2.D", calculator: "allowed", parts: "A x-t and v-t graphs(4) / B derivation(3) / C numeric(3) / D prediction(2)", points: 12, verifiedBy: ["an RK4 simulation recomputes the period and the maximum speed; the maximum acceleration follows from Hooke's law"] },
    { id: "pcf_lab_spring_period_k", template: "lab", topic: "7.2", extraTopics: ["7.1", "3.4"], skill: "3.A", calculator: "allowed", parts: "A procedure(3) / B linearization(1) / C plot(3) / D slope and k(3)", points: 10, verifiedBy: ["normal equations recompute the slope; the fitted k is compared with the generating value within four percent"] },
    { id: "pcf_qqt_inelastic_collision", template: "qqt", topic: "4.4", extraTopics: ["4.3", "3.1"], skill: "3.B", calculator: "allowed", parts: "A claim and justification(3) / B derivation(3) / C prediction(2)", points: 8, verifiedBy: ["numpy linalg.solve of the momentum balance recomputes the final speed; the kinetic energies are compared numerically"] },
  ] as FrqTemplateSpec[],
  notation: ["every number with a unit is written $12.3\\text{ m/s}$; symbols and expressions are inside $...$", "SI units only; g = 9.8 m/s^2 (reference constant stated once in the exam header, not in each item)", "three significant figures in options and answers unless the data have fewer; data given to two or three significant figures", "derivatives and integrals use standard calculus notation; position functions and force functions are given explicitly in the stem", "vectors in one dimension carry a sign with a stated positive direction"],
  difficultyBanned: ["long or unrounded arithmetic", "ambiguous wording or unstated model assumptions", "circuits, waves, optics, thermodynamics or electrostatics (not in the course)", "calculus techniques beyond polynomial, exponential, sine and cosine functions of one variable", "irrelevant context or extra reading load", "reproducing a College Board sample item scenario"],
  bannedTerms: [
    { pattern: "\\b(circuit|resistor|capacitor|voltage|electric (field|charge)|magnetic|photon|refraction|diffraction|thermodynamic|heat engine|sound wave|fluid pressure|buoyant)\\b", why: "circuits, waves, electromagnetism, thermodynamics and fluids are not in the Physics C: Mechanics course" },
    { pattern: "AP\\s*[345]|level 5|score of [345]", why: "never label items by AP score level" },
  ],
  acceptExamples: [
    { title: "calculus step with a named misconception (2.B)", text: "A particle has position $x(t)=t^3-9t^2+24t$; the acceleration at the later time at rest requires finding the times from the derivative and then differentiating again." },
    { title: "scaling prediction (2.D)", text: "The terminal speed under linear drag when the drag coefficient is doubled." },
  ],
  rejectExamples: [
    { title: "plug-in only", text: "Calculate the kinetic energy of a 2 kg object moving at 3 m/s.", reason: "calculation only with no law selection or representation reading" },
    { title: "out-of-scope content", text: "Find the equivalent resistance of two resistors in parallel.", reason: "circuits are not in the course" },
  ],
};

export function physicsCWordingRules(): string {
  const g = physicsCGuide;
  return [
    `SUBJECT GUIDE (${g.guideDoc}). Exam structure: ${g.examStructure}`,
    `Notation: ${g.notation.join("; ")}.`,
    `Calculator and style rules: ${g.calculatorRules.join("; ")}.`,
    `Never use: ${g.difficultyBanned.join("; ")}.`,
  ].join("\n");
}
