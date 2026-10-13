// AP Physics 1 시험 참조 패널 — ALTON 자체 문구(공식 시트 본문을 복제하지 않는다).
// 공식 근거: AP Physics 1 Exam Reference Information (© 2025 College Board, https://apcentral.collegeboard.org/media/pdf/ap-physics-1-equations-sheet.pdf)에서
// 확인한 항목 = 상수(만유인력 상수 G, g = 9.8 m/s² = 9.8 N/kg, 1 atm), 접두어, 대표 각의 삼각함수 값, 규약 4가지(관성계·공기저항 무시·이상적 용수철/줄·이상 유체).
// 수식 목록 자체는 PDF 텍스트 추출에서 글리프가 빠져 대조하지 못했다 → 아래 수식은 교과 표준식으로 ALTON 이 구성한 것이며 공식 시트와의 1:1 일치는 UNVERIFIED.
export const PHYSICS_REF_DISCLAIMER = "ALTON study reference — not the official College Board sheet. Use the official Exam Reference Information for exam preparation.";
export type RefGroup = { id: string; title: string; items: { name: string; expr: string }[] };
export const PHYSICS_CONSTANTS: { name: string; value: string }[] = [
  { name: "Acceleration due to gravity at Earth's surface, g", value: "9.8 m/s² (equivalently 9.8 N/kg)" },
  { name: "Universal gravitational constant, G", value: "6.67 × 10⁻¹¹ N·m²/kg²" },
  { name: "1 atmosphere of pressure", value: "1.01 × 10⁵ Pa" },
];
export const PHYSICS_CONVENTIONS = [
  "Reference frames are inertial unless a problem says otherwise.",
  "Air resistance is negligible unless a problem says otherwise.",
  "Springs and strings are ideal unless a problem says otherwise.",
  "Fluids are ideal and pipes are completely full unless a problem says otherwise.",
];
export const PHYSICS_PREFIXES: [string, string, string][] = [["tera", "T", "10¹²"], ["giga", "G", "10⁹"], ["mega", "M", "10⁶"], ["kilo", "k", "10³"], ["centi", "c", "10⁻²"], ["milli", "m", "10⁻³"], ["micro", "μ", "10⁻⁶"], ["nano", "n", "10⁻⁹"], ["pico", "p", "10⁻¹²"]];
export const PHYSICS_GROUPS: RefGroup[] = [
  { id: "kin", title: "Kinematics (Unit 1)", items: [{ name: "Velocity from constant acceleration", expr: "v = v₀ + at" }, { name: "Position", expr: "x = x₀ + v₀t + ½at²" }, { name: "Velocity–position", expr: "v² = v₀² + 2a(x − x₀)" }] },
  { id: "dyn", title: "Forces (Unit 2)", items: [{ name: "Newton's second law", expr: "a = ΣF / m" }, { name: "Friction (maximum static, kinetic)", expr: "F_f ≤ μN  (kinetic: F_f = μN)" }, { name: "Spring force", expr: "F_s = −kx" }, { name: "Centripetal acceleration", expr: "a_c = v² / r" }, { name: "Gravitational force", expr: "F_g = G m₁m₂ / r²" }, { name: "Weight near Earth", expr: "F_g = mg" }] },
  { id: "en", title: "Work, energy, power (Unit 3)", items: [{ name: "Kinetic energy", expr: "K = ½mv²" }, { name: "Work", expr: "W = F d cos θ" }, { name: "Work–energy", expr: "ΔK = ΣW" }, { name: "Gravitational PE near Earth", expr: "ΔU_g = mgΔy" }, { name: "Spring PE", expr: "U_s = ½kx²" }, { name: "Power", expr: "P = ΔE/Δt = F v cos θ" }] },
  { id: "mom", title: "Linear momentum (Unit 4)", items: [{ name: "Momentum", expr: "p = mv" }, { name: "Impulse", expr: "J = FΔt = Δp" }] },
  { id: "rot", title: "Torque and rotation (Units 5–6)", items: [{ name: "Torque", expr: "τ = r F sin θ" }, { name: "Rotational Newton's second law", expr: "α = Στ / I" }, { name: "Rotational inertia of point masses", expr: "I = Σ m r²" }, { name: "Rolling or circular motion", expr: "v = ωr,  Δθ = ωΔt" }, { name: "Rotational kinetic energy", expr: "K = ½Iω²" }, { name: "Angular momentum", expr: "L = Iω" }] },
  { id: "osc", title: "Oscillations (Unit 7)", items: [{ name: "Period and frequency", expr: "T = 1/f" }, { name: "Mass on a spring", expr: "T = 2π√(m/k)" }, { name: "Simple pendulum", expr: "T = 2π√(ℓ/g)" }] },
  { id: "flu", title: "Fluids (Unit 8)", items: [{ name: "Density", expr: "ρ = m/V" }, { name: "Pressure", expr: "P = F/A" }, { name: "Pressure at depth h", expr: "P = P₀ + ρgh" }, { name: "Buoyant force", expr: "F_b = ρ_fluid V_displaced g" }, { name: "Continuity", expr: "A₁v₁ = A₂v₂" }, { name: "Bernoulli", expr: "P + ρgy + ½ρv² = constant" }] },
];
export const PHYSICS_TRIG: { angle: string; sin: string; cos: string; tan: string }[] = [
  { angle: "0°", sin: "0", cos: "1", tan: "0" }, { angle: "30°", sin: "1/2", cos: "√3/2", tan: "√3/3" }, { angle: "37°", sin: "3/5", cos: "4/5", tan: "3/4" },
  { angle: "45°", sin: "√2/2", cos: "√2/2", tan: "1" }, { angle: "53°", sin: "4/5", cos: "3/5", tan: "4/3" }, { angle: "60°", sin: "√3/2", cos: "1/2", tan: "√3" }, { angle: "90°", sin: "1", cos: "0", tan: "—" },
];
