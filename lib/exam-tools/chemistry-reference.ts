// AP Chemistry 시험 참조 패널 — ALTON 자체 문구(공식 시트 본문을 복제하지 않는다).
// 공식 근거: AP Chemistry CED(©2024) 부록 "Equations and Constants, effective 2025"와 주기율표(https://apcentral.collegeboard.org/media/pdf/ap-chemistry-course-and-exam-description.pdf)에서
// 확인한 항목 = 사용 상수(R·F·h·c·N_A·Kw·STP), 단위 환산, 접두어, 식 범주(원자 구조·기체/용액·반응속도·평형·열역학/전기화학). 시험 중에는 주기율표와 식 시트가 인쇄·Bluebook 으로 제공된다.
// 아래 식은 교과 표준식을 ALTON 이 구성한 것이며 공식 시트와의 1:1 일치는 UNVERIFIED. 주기율표는 원소 1–86 만 싣는다(87–118 생략, 공식 표와 다름).
export const CHEMISTRY_REF_DISCLAIMER = "ALTON study reference — not the official College Board sheet. Use the official periodic table and equation sheet for exam preparation.";
export type ChemRefGroup = { id: string; title: string; items: { name: string; expr: string }[] };
export const CHEMISTRY_CONSTANTS: { name: string; value: string }[] = [
  { name: "Gas constant, R", value: "8.314 J/(mol·K) = 0.08206 L·atm/(mol·K)" },
  { name: "Faraday constant, F", value: "96,485 C per mole of electrons" },
  { name: "Planck's constant, h", value: "6.626 × 10⁻³⁴ J·s" },
  { name: "Speed of light, c", value: "2.998 × 10⁸ m/s" },
  { name: "Avogadro's number", value: "6.022 × 10²³ mol⁻¹" },
  { name: "Ion-product constant of water, Kw (25 °C)", value: "1.0 × 10⁻¹⁴" },
  { name: "Standard temperature and pressure", value: "273.15 K and 1.0 atm; ideal gas at STP: 22.4 L/mol" },
];
export const CHEMISTRY_CONVERSIONS = ["1 atm = 760 mm Hg = 760 torr", "K = °C + 273.15", "1 V = 1 J/C", "1 A = 1 C/s"];
export const CHEMISTRY_PREFIXES: [string, string, string][] = [["giga", "G", "10⁹"], ["mega", "M", "10⁶"], ["kilo", "k", "10³"], ["centi", "c", "10⁻²"], ["milli", "m", "10⁻³"], ["micro", "μ", "10⁻⁶"], ["nano", "n", "10⁻⁹"], ["pico", "p", "10⁻¹²"]];
export const CHEMISTRY_GROUPS: ChemRefGroup[] = [
  { id: "atom", title: "Atomic structure", items: [{ name: "Photon energy", expr: "E = hν = hc/λ" }, { name: "Coulomb's law (relative scaling)", expr: "F ∝ q₁q₂ / r²" }] },
  { id: "gas", title: "Gases, liquids, and solutions", items: [{ name: "Combined gas law", expr: "P₁V₁/T₁ = P₂V₂/T₂" }, { name: "Ideal gas law", expr: "PV = nRT" }, { name: "Partial pressure", expr: "P_A = P_total · X_A,  X_A = moles A / total moles" }, { name: "Dalton's law", expr: "P_total = P_A + P_B + P_C + …" }, { name: "Moles", expr: "n = m / M" }, { name: "Density", expr: "D = m / V" }, { name: "Kinetic energy", expr: "KE = ½mv²" }, { name: "Molarity", expr: "M = moles solute / liters solution" }, { name: "Beer–Lambert law", expr: "A = εbc" }] },
  { id: "kin", title: "Kinetics", items: [{ name: "Zero order", expr: "[A]ₜ − [A]₀ = −kt" }, { name: "First order", expr: "ln[A]ₜ − ln[A]₀ = −kt" }, { name: "Second order", expr: "1/[A]ₜ − 1/[A]₀ = kt" }, { name: "First-order half-life", expr: "t½ = 0.693 / k" }] },
  { id: "eq", title: "Equilibrium", items: [{ name: "Equilibrium constant, a A + b B ⇌ c C + d D", expr: "K_c = [C]ᶜ[D]ᵈ / ([A]ᵃ[B]ᵇ)" }, { name: "Pressure form", expr: "K_p = (P_C)ᶜ(P_D)ᵈ / ((P_A)ᵃ(P_B)ᵇ)" }, { name: "Water", expr: "K_w = [H₃O⁺][OH⁻] = 1.0 × 10⁻¹⁴ (25 °C);  pK_w = pH + pOH = 14" }, { name: "pH and pOH", expr: "pH = −log[H₃O⁺],  pOH = −log[OH⁻]" }, { name: "Weak acid and base", expr: "K_a = [H₃O⁺][A⁻]/[HA],  K_b = [OH⁻][HB⁺]/[B]" }, { name: "Conjugate pair", expr: "K_a × K_b = K_w,  pK_a + pK_b = pK_w" }, { name: "Buffer (Henderson–Hasselbalch)", expr: "pH = pK_a + log([A⁻]/[HA])" }] },
  { id: "thermo", title: "Thermodynamics and electrochemistry", items: [{ name: "Heat transfer", expr: "q = mcΔT" }, { name: "Standard free energy from enthalpy and entropy", expr: "ΔG° = ΔH° − TΔS°" }, { name: "Free energy and K", expr: "ΔG° = −RT ln K" }, { name: "Free energy and cell potential", expr: "ΔG° = −nFE°" }, { name: "Current", expr: "I = q / t" }, { name: "Nonstandard cell potential (Nernst)", expr: "E = E° − (RT/nF) ln Q" }] },
];
// 원소: [원자번호, 기호, 원자량]. 괄호 값은 가장 안정한 동위원소의 질량수.
export const CHEMISTRY_ELEMENTS: [number, string, string][] = [
  [1, "H", "1.008"], [2, "He", "4.003"], [3, "Li", "6.94"], [4, "Be", "9.012"], [5, "B", "10.81"], [6, "C", "12.011"], [7, "N", "14.007"], [8, "O", "15.999"], [9, "F", "18.998"], [10, "Ne", "20.180"],
  [11, "Na", "22.990"], [12, "Mg", "24.305"], [13, "Al", "26.982"], [14, "Si", "28.085"], [15, "P", "30.974"], [16, "S", "32.06"], [17, "Cl", "35.45"], [18, "Ar", "39.95"],
  [19, "K", "39.098"], [20, "Ca", "40.078"], [21, "Sc", "44.956"], [22, "Ti", "47.867"], [23, "V", "50.942"], [24, "Cr", "51.996"], [25, "Mn", "54.938"], [26, "Fe", "55.845"], [27, "Co", "58.933"], [28, "Ni", "58.693"], [29, "Cu", "63.546"], [30, "Zn", "65.38"],
  [31, "Ga", "69.723"], [32, "Ge", "72.630"], [33, "As", "74.922"], [34, "Se", "78.971"], [35, "Br", "79.904"], [36, "Kr", "83.798"],
  [37, "Rb", "85.468"], [38, "Sr", "87.62"], [39, "Y", "88.906"], [40, "Zr", "91.224"], [41, "Nb", "92.906"], [42, "Mo", "95.95"], [43, "Tc", "(98)"], [44, "Ru", "101.07"], [45, "Rh", "102.91"], [46, "Pd", "106.42"], [47, "Ag", "107.87"], [48, "Cd", "112.41"],
  [49, "In", "114.82"], [50, "Sn", "118.71"], [51, "Sb", "121.76"], [52, "Te", "127.60"], [53, "I", "126.90"], [54, "Xe", "131.29"],
  [55, "Cs", "132.91"], [56, "Ba", "137.33"], [57, "La", "138.91"], [58, "Ce", "140.12"], [59, "Pr", "140.91"], [60, "Nd", "144.24"], [61, "Pm", "(145)"], [62, "Sm", "150.36"], [63, "Eu", "151.96"], [64, "Gd", "157.25"], [65, "Tb", "158.93"], [66, "Dy", "162.50"], [67, "Ho", "164.93"], [68, "Er", "167.26"], [69, "Tm", "168.93"], [70, "Yb", "173.05"], [71, "Lu", "174.97"],
  [72, "Hf", "178.49"], [73, "Ta", "180.95"], [74, "W", "183.84"], [75, "Re", "186.21"], [76, "Os", "190.23"], [77, "Ir", "192.22"], [78, "Pt", "195.08"], [79, "Au", "196.97"], [80, "Hg", "200.59"], [81, "Tl", "204.38"], [82, "Pb", "207.2"], [83, "Bi", "208.98"], [84, "Po", "(209)"], [85, "At", "(210)"], [86, "Rn", "(222)"],
];
/** 원소의 (period, group) 위치. 란타넘족(57–71)은 group 0(별도 행)으로 둔다. */
export function elementPosition(z: number): { period: number; group: number } {
  if (z === 1) return { period: 1, group: 1 };
  if (z === 2) return { period: 1, group: 18 };
  if (z <= 4) return { period: 2, group: z - 2 };
  if (z <= 10) return { period: 2, group: z + 8 };
  if (z <= 12) return { period: 3, group: z - 10 };
  if (z <= 18) return { period: 3, group: z };
  if (z <= 36) return { period: 4, group: z - 18 };
  if (z <= 54) return { period: 5, group: z - 36 };
  if (z <= 56) return { period: 6, group: z - 54 };
  if (z <= 71) return { period: 6, group: 0 };
  return { period: 6, group: z - 68 };
}
