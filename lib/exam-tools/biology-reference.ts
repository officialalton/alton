// AP Biology 학습용 참조 패널 — ALTON 자체 문구(공식 시트 본문을 복제하지 않는다).
// 공식 근거: AP Biology CED(V.1, ©2025) 부록 "AP Biology Equations and Formulas"(Appendix p.230–231, https://apcentral.collegeboard.org/media/pdf/ap-biology-course-and-exam-description.pdf)에서 확인한 항목 =
// 통계(평균·표준편차·표준오차·카이제곱과 임계값 표), 확률 법칙, 하디–바인베르크, 속도·개체군 증가(지수·로지스틱), 수분 퍼텐셜(R = 0.0831), 심프슨 다양도 지수, 표면적·부피, 접두어.
// 아래 식은 같은 내용을 ALTON 이 다시 쓴 것이며 공식 시트와의 1:1 일치는 UNVERIFIED(시험 중에는 인쇄본·Bluebook 으로 공식 시트가 제공된다).
export const BIOLOGY_REF_DISCLAIMER = "ALTON study reference — not the official College Board sheet. Use the official AP Biology Equations and Formulas sheet for exam preparation.";
export type BioRefGroup = { id: string; title: string; items: { name: string; expr: string }[] };
export const BIOLOGY_GROUPS: BioRefGroup[] = [
  { id: "stat", title: "Statistical analysis and probability", items: [
    { name: "Sample mean", expr: "x̄ = (1/n) Σ xᵢ" },
    { name: "Sample standard deviation", expr: "s = √[ Σ (xᵢ − x̄)² / (n − 1) ]" },
    { name: "Standard error of the mean", expr: "SE = s / √n   (mean ± 2SE gives an approximate 95% range)" },
    { name: "Chi-square", expr: "χ² = Σ (o − e)² / e   (degrees of freedom = number of distinct possible outcomes − 1)" },
    { name: "Mutually exclusive events", expr: "P(A or B) = P(A) + P(B)" },
    { name: "Independent events", expr: "P(A and B) = P(A) × P(B)" },
    { name: "Center and spread", expr: "mode = most frequent value;  median = middle value;  range = maximum − minimum" },
  ] },
  { id: "hw", title: "Hardy–Weinberg", items: [
    { name: "Genotype frequencies", expr: "p² + 2pq + q² = 1" },
    { name: "Allele frequencies", expr: "p + q = 1   (p = frequency of allele 1, q = frequency of allele 2)" },
  ] },
  { id: "rate", title: "Rate and growth", items: [
    { name: "Rate", expr: "rate = dY/dt = change in amount ÷ change in time" },
    { name: "Population growth", expr: "dN/dt = B − D   (births minus deaths)" },
    { name: "Exponential growth", expr: "dN/dt = r_max N" },
    { name: "Logistic growth", expr: "dN/dt = r_max N (K − N) / K   (K = carrying capacity)" },
    { name: "Simpson's diversity index", expr: "Diversity = 1 − Σ (n/N)²   (n = individuals of one species, N = all individuals)" },
  ] },
  { id: "wp", title: "Water potential", items: [
    { name: "Water potential", expr: "Ψ = Ψ_P + Ψ_S   (pressure potential + solute potential)" },
    { name: "Open container", expr: "the pressure potential of a solution in an open container is zero, so Ψ = Ψ_S" },
    { name: "Solute potential", expr: "Ψ_S = −iCRT   (i = ionization constant, C = molar concentration, R = 0.0831 liter·bar/(mol·K), T = °C + 273)" },
  ] },
  { id: "geo", title: "Surface area and volume", items: [
    { name: "Sphere", expr: "SA = 4πr²;  V = (4/3)πr³" },
    { name: "Rectangular solid", expr: "SA = 2lh + 2lw + 2wh;  V = lwh" },
    { name: "Cylinder", expr: "SA = 2πrh + 2πr²;  V = πr²h" },
    { name: "Cube", expr: "SA = 6s²;  V = s³" },
  ] },
];
export const BIOLOGY_CHI_TABLE = { dfs: [1, 2, 3, 4, 5, 6, 7, 8], p05: [3.84, 5.99, 7.81, 9.49, 11.07, 12.59, 14.07, 15.51], p01: [6.63, 9.21, 11.34, 13.28, 15.09, 16.81, 18.48, 20.09] };
export const BIOLOGY_PREFIXES: [string, string, string][] = [["giga", "G", "10⁹"], ["mega", "M", "10⁶"], ["kilo", "k", "10³"], ["deci", "d", "10⁻¹"], ["centi", "c", "10⁻²"], ["milli", "m", "10⁻³"], ["micro", "µ", "10⁻⁶"], ["nano", "n", "10⁻⁹"], ["pico", "p", "10⁻¹²"]];
