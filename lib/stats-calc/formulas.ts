// ALTON 자체 작성 통계 공식 참고표. College Board 공식 수식표의 문구·배치를 옮기지 않았고,
// 표준 표기로 2027 AP Statistics 과정(data/ap/curriculum-2027/ap_statistics.json)의 토픽만 다룬다.
// 토픽 코드는 과정 문서의 코드(예: 2.10). 2027 과정에 없는 항목(기하분포, 적합도 검정, 기울기 추론)은 넣지 않는다.

export const FORMULA_DISCLAIMER = "ALTON study reference — not the official College Board sheet";

export type FormulaItem = { name: string; expr: string; note?: string };
export type FormulaSection = { id: string; title: string; topics: string; items: FormulaItem[] };

export const STATS_FORMULAS: FormulaSection[] = [
  {
    id: "descriptive", title: "Descriptive statistics", topics: "1.3, 1.7, 1.8",
    items: [
      { name: "Sample mean", expr: "x̄ = (Σ xᵢ) / n" },
      { name: "Sample standard deviation", expr: "s = √[ Σ (xᵢ − x̄)² / (n − 1) ]" },
      { name: "z-score", expr: "z = (x − mean) / standard deviation" },
      { name: "Interquartile range", expr: "IQR = Q₃ − Q₁" },
      { name: "Outlier fences (1.5 × IQR rule)", expr: "low = Q₁ − 1.5·IQR      high = Q₃ + 1.5·IQR", note: "A value outside the fences is flagged as an outlier." },
      { name: "Relative frequency", expr: "relative frequency = count in category / total count" },
    ],
  },
  {
    id: "probability", title: "Probability", topics: "2.4–2.7",
    items: [
      { name: "Complement", expr: "P(Aᶜ) = 1 − P(A)" },
      { name: "Addition rule", expr: "P(A ∪ B) = P(A) + P(B) − P(A ∩ B)", note: "If A and B are mutually exclusive, P(A ∩ B) = 0." },
      { name: "Conditional probability", expr: "P(A | B) = P(A ∩ B) / P(B)" },
      { name: "Independent events", expr: "P(A ∩ B) = P(A)·P(B)", note: "Equivalent: P(A | B) = P(A)." },
    ],
  },
  {
    id: "random-variables", title: "Random variables", topics: "2.8–2.10",
    items: [
      { name: "Expected value of a discrete X", expr: "μ_X = Σ x·P(x)" },
      { name: "Standard deviation of a discrete X", expr: "σ_X = √[ Σ (x − μ_X)²·P(x) ]" },
      { name: "Linear transformation", expr: "μ_(a+bX) = a + b·μ_X      σ_(a+bX) = |b|·σ_X" },
      { name: "Sum or difference", expr: "μ_(X±Y) = μ_X ± μ_Y", note: "If X and Y are independent: σ²_(X±Y) = σ²_X + σ²_Y." },
      { name: "Binomial probability", expr: "P(X = k) = C(n, k)·pᵏ·(1 − p)ⁿ⁻ᵏ,  k = 0, 1, …, n", note: "C(n, k) = n! / [k!(n − k)!]" },
      { name: "Binomial mean and standard deviation", expr: "μ_X = np      σ_X = √[ np(1 − p) ]" },
    ],
  },
  {
    id: "normal", title: "Normal distribution", topics: "2.11",
    items: [
      { name: "Standardizing", expr: "z = (x − μ) / σ" },
      { name: "Empirical rule", expr: "≈ 68%, 95%, 99.7% within 1, 2, 3 standard deviations of the mean" },
    ],
  },
  {
    id: "sampling", title: "Sampling distributions", topics: "2.12, 3.2, 3.9, 4.1, 4.6",
    items: [
      { name: "Sample proportion p̂", expr: "μ_p̂ = p      σ_p̂ = √[ p(1 − p) / n ]", note: "Approximately normal if np ≥ 10 and n(1 − p) ≥ 10." },
      { name: "Difference of sample proportions", expr: "μ = p₁ − p₂      σ = √[ p₁(1 − p₁)/n₁ + p₂(1 − p₂)/n₂ ]" },
      { name: "Sample mean x̄", expr: "μ_x̄ = μ      σ_x̄ = σ / √n", note: "Approximately normal if the population is normal or n is large (central limit theorem, commonly n ≥ 30)." },
      { name: "Difference of sample means", expr: "μ = μ₁ − μ₂      σ = √[ σ₁²/n₁ + σ₂²/n₂ ]" },
      { name: "Independence condition", expr: "n ≤ 10% of the population when sampling without replacement" },
    ],
  },
  {
    id: "inference-general", title: "Confidence intervals and tests: general form", topics: "3.3–3.13, 4.2–4.10",
    items: [
      { name: "Confidence interval", expr: "statistic ± (critical value)·(standard error of the statistic)" },
      { name: "Test statistic", expr: "(statistic − null value) / (standard error of the statistic)" },
    ],
  },
  {
    id: "inference-proportions", title: "Inference for proportions", topics: "3.3, 3.7, 3.10, 3.13",
    items: [
      { name: "One proportion: interval", expr: "p̂ ± z*·√[ p̂(1 − p̂) / n ]" },
      { name: "One proportion: test", expr: "z = (p̂ − p₀) / √[ p₀(1 − p₀) / n ]" },
      { name: "Two proportions: interval", expr: "(p̂₁ − p̂₂) ± z*·√[ p̂₁(1 − p̂₁)/n₁ + p̂₂(1 − p̂₂)/n₂ ]" },
      { name: "Two proportions: test (H₀: p₁ = p₂)", expr: "z = (p̂₁ − p̂₂) / √[ p̂_c(1 − p̂_c)(1/n₁ + 1/n₂) ]", note: "Pooled p̂_c = (x₁ + x₂) / (n₁ + n₂)" },
    ],
  },
  {
    id: "inference-means", title: "Inference for means", topics: "4.2, 4.5, 4.7, 4.10",
    items: [
      { name: "One mean (or mean of paired differences): interval", expr: "x̄ ± t*·s/√n      df = n − 1" },
      { name: "One mean: test", expr: "t = (x̄ − μ₀) / (s/√n)      df = n − 1" },
      { name: "Two means: interval", expr: "(x̄₁ − x̄₂) ± t*·√[ s₁²/n₁ + s₂²/n₂ ]" },
      { name: "Two means: test (H₀: μ₁ − μ₂ = 0)", expr: "t = (x̄₁ − x̄₂) / √[ s₁²/n₁ + s₂²/n₂ ]", note: "Use technology for df, or the conservative df = min(n₁ − 1, n₂ − 1)." },
    ],
  },
  {
    id: "chi-square", title: "Chi-square test", topics: "3.14, 3.15",
    items: [
      { name: "Test statistic", expr: "χ² = Σ (O − E)² / E" },
      { name: "Expected count in a two-way table", expr: "E = (row total)(column total) / (table total)" },
      { name: "Degrees of freedom", expr: "df = (rows − 1)(columns − 1)" },
      { name: "Contribution of one cell", expr: "(O − E)² / E", note: "Large contributions show where the data differ most from the null hypothesis. Expected counts are normally at least 5." },
    ],
  },
  {
    id: "regression", title: "Correlation and regression", topics: "5.2–5.5",
    items: [
      { name: "Correlation", expr: "r = [1/(n − 1)]·Σ [(xᵢ − x̄)/sₓ]·[(yᵢ − ȳ)/s_y]" },
      { name: "Least-squares line", expr: "ŷ = a + bx" },
      { name: "Slope and intercept", expr: "b = r·(s_y / sₓ)      a = ȳ − b·x̄", note: "The line passes through (x̄, ȳ)." },
      { name: "Residual", expr: "residual = y − ŷ  (observed − predicted)" },
      { name: "Coefficient of determination", expr: "r² = proportion of the variation in y explained by the linear relationship with x" },
    ],
  },
];

export const TABLE_CALCULATOR_NOTE =
  "The Statistics tab of the Calculator gives exact values (normalcdf, invNorm, tcdf, invT, χ² cdf), so tables are only a quick check.";
