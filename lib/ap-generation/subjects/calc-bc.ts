import type { SubjectGuide } from "./types";
import { calcAbGuide } from "./calc-ab";

// AP Calculus BC = 공통 코어 + AB 공유분 + BC 델타(docs/ap/generation-guides/calc-bc.md). 공유 토픽 문항은 AB 에서 한 번 생성해 content_key 로 태깅한다.
export const BC_ONLY_TOPICS = ["6.11", "6.12", "6.13", "7.5", "7.9", "8.13", "9.1", "9.2", "9.3", "9.4", "9.5", "9.6", "9.7", "9.8", "9.9", "10.1", "10.2", "10.3", "10.4", "10.5", "10.6", "10.7", "10.8", "10.9", "10.10", "10.11", "10.12", "10.13", "10.14", "10.15"];

export const calcBcGuide: SubjectGuide = {
  ...calcAbGuide,
  subject: "ap_calculus_bc",
  guideDoc: "docs/ap/generation-guides/calc-bc.md",
  examStructure: calcAbGuide.examStructure.replace("MC skills assessed", "BC adds units 9 (parametric, polar, vector) and 10 (series). MC skills assessed"),
  units: [
    ...calcAbGuide.units.map((u) => {
      const bcW: Record<string, [number, number]> = { "1": [5, 10], "2": [5, 10], "3": [5, 10], "4": [5, 10], "5": [10, 15], "6": [15, 20], "7": [5, 10], "8": [5, 10] };
      const extra: Record<string, string[]> = { "6": ["integration by parts (6.11)", "partial fractions (6.12)", "improper integrals (6.13)"], "7": ["Euler's method (7.5)", "logistic models (7.9)"], "8": ["arc length (8.13)"] };
      return { ...u, mcWeight: bcW[u.unit], inScope: [...u.inScope, ...(extra[u.unit] ?? [])], outOfScope: u.outOfScope.filter((o) => !/\(BC\)|BC/.test(o)) };
    }),
    { unit: "9", title: "Parametric Equations, Polar Coordinates, and Vector-Valued Functions", mcWeight: [15, 20], inScope: ["dy/dx and d2y/dx2 of parametric curves", "arc length and speed", "vector-valued position, velocity, acceleration", "polar coordinates, polar derivatives, area of polar regions"], outOfScope: ["3-D vectors", "cross products", "polar arc length (not required)"] },
    { unit: "10", title: "Infinite Sequences and Series", mcWeight: [15, 20], inScope: ["convergence/divergence, geometric and p-series", "nth-term, integral, comparison, alternating series, ratio tests", "absolute vs conditional convergence", "alternating series and Lagrange error bounds", "Taylor/Maclaurin series, radius and interval of convergence, power series representations"], outOfScope: ["Fourier series", "root test details beyond recognition", "Taylor series of multivariable functions"] },
  ],
  archetypes: [
    ...calcAbGuide.archetypes,
    { id: "int_by_parts", topic: "6.11", skill: "1.C", calculator: "not_allowed", stimulus: "none", verifiedBy: ["sympy integrate", "numeric quad"], misconceptions: ["sign error", "uv term only", "adds remaining integral"] },
    { id: "partial_fractions", topic: "6.12", skill: "1.C", calculator: "not_allowed", stimulus: "none", verifiedBy: ["sympy integrate", "numeric quad"], misconceptions: ["log order reversed", "single logarithm", "same coefficient"] },
    { id: "improper_integral", topic: "6.13", skill: "3.D", calculator: "not_allowed", stimulus: "none", verifiedBy: ["p-integral criterion"], misconceptions: ["always diverges", "reports exponent"] },
    { id: "euler_method", topic: "7.5", skill: "1.E", calculator: "not_allowed", stimulus: "none", verifiedBy: ["two-step recompute"], misconceptions: ["one step", "x not advanced", "step size forgotten"] },
    { id: "logistic", topic: "7.9", skill: "3.D", calculator: "not_allowed", stimulus: "none", verifiedBy: ["limit and numeric maximization of growth rate"], misconceptions: ["K/2 vs K"] },
    { id: "arc_length_calc", topic: "8.13", skill: "1.E", calculator: "required", stimulus: "none", verifiedBy: ["scipy quad"], misconceptions: ["y instead of y'", "no square root", "area"] },
    { id: "param_dydx", topic: "9.1", skill: "1.E", calculator: "not_allowed", stimulus: "none", verifiedBy: ["sympy"], misconceptions: ["dx/dy", "dy/dt only"] },
    { id: "param_second", topic: "9.2", skill: "1.E", calculator: "not_allowed", stimulus: "none", verifiedBy: ["sympy"], misconceptions: ["no division by x'", "y''/x''"] },
    { id: "param_arclength_calc", topic: "9.3", skill: "1.D", calculator: "required", stimulus: "none", verifiedBy: ["scipy quad"], misconceptions: ["component sum", "no sqrt"] },
    { id: "param_speed_calc", topic: "9.6", skill: "1.E", calculator: "required", stimulus: "none", verifiedBy: ["sympy + numeric"], misconceptions: ["component sum", "dy/dx"] },
    { id: "polar_area_calc", topic: "9.8", skill: "1.D", calculator: "required", stimulus: "none", verifiedBy: ["scipy quad"], misconceptions: ["r not r^2", "missing 1/2"] },
    { id: "series_test", topic: "10.9", skill: "3.D", calculator: "not_allowed", stimulus: "none", verifiedBy: ["family classification", "partial sums"], misconceptions: ["nth-term test proves convergence", "absolute vs conditional"] },
    { id: "taylor_coeff", topic: "10.14", skill: "1.E", calculator: "not_allowed", stimulus: "none", verifiedBy: ["sympy series"], misconceptions: ["n! missing", "k^n missing"] },
    { id: "radius_interval", topic: "10.13", skill: "1.E", calculator: "not_allowed", stimulus: "none", verifiedBy: ["ratio test", "endpoint partial sums"], misconceptions: ["endpoints untested", "divergent endpoint included"] },
    { id: "geometric_sum", topic: "10.2", skill: "1.E", calculator: "not_allowed", stimulus: "none", verifiedBy: ["partial sums"], misconceptions: ["wrong first term", "1+r"] },
    { id: "lagrange_error", topic: "10.12", skill: "3.D", calculator: "not_allowed", stimulus: "none", verifiedBy: ["formula recompute"], misconceptions: ["wrong power/factorial"] },
  ],
  frqTemplates: [
    ...calcAbGuide.frqTemplates,
    { id: "frq_series", template: "series_taylor_convergence", topic: "10.14", extraTopics: ["10.13", "10.10"], skill: "1.E", calculator: "not_allowed", parts: "a Maclaurin terms + general term (3) / b radius and interval incl. endpoint test (3) / c alternating error bound (2) / d term-by-term integral (1)", points: 9, verifiedBy: ["sympy series", "ratio test", "alternating series conditions"] },
    { id: "frq_parametric", template: "parametric_motion_calc", topic: "9.6", extraTopics: ["9.1", "9.2", "9.3"], skill: "1.E", calculator: "required", parts: "a speed + acceleration vector (3) / b tangent line (2) / c total distance (2) / d d2y/dx2 (2)", points: 9, verifiedBy: ["sympy", "scipy quad"] },
  ],
  bannedTerms: calcAbGuide.bannedTerms.filter((b) => b.why !== "BC-only content").concat([{ pattern: "\\b(Fourier|cross product|multivariable|3-D vector)\\b", why: "outside BC course framework" }]),
};
export const isBcOnlyTopic = (t: string) => BC_ONLY_TOPICS.includes(t);
export const GUIDES = { ap_calculus_ab: calcAbGuide, ap_calculus_bc: calcBcGuide } as const;
