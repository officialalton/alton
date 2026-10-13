// AP Microeconomics 학습용 참조 패널 — ALTON 자체 문구. CED(V.1)는 시험 중 제공되는 공식 수식 시트를 언급하지 않는다(docs/ap/microeconomics-facts.md §3 #3 UNVERIFIED).
// 따라서 이 패널은 공식 시트를 복제하거나 대체한다고 주장하지 않고, 교과 표준 식을 ALTON 이 정리한 학생용 요약이다.
export const MICRO_REF_DISCLAIMER = "ALTON study reference — not the official College Board sheet. The AP Microeconomics course description does not list a formula sheet; use this only as a study aid.";
export type MicroRefGroup = { id: string; title: string; items: { name: string; expr: string }[] };
export const MICRO_CONVENTIONS = [
  "Markets are perfectly competitive unless a problem says otherwise.",
  "Dollar amounts are in dollars; quantities are in units.",
  "Graphs show Price on the vertical axis and Quantity on the horizontal axis unless labeled otherwise.",
  "A four-function calculator is allowed on both sections of the exam.",
];
export const MICRO_GROUPS: MicroRefGroup[] = [
  { id: "elast", title: "Elasticity (Unit 2)", items: [
    { name: "Price elasticity of demand (midpoint)", expr: "Ed = (ΔQ / average Q) ÷ (ΔP / average P)" }, { name: "Total revenue", expr: "TR = P × Q" },
    { name: "Cross-price elasticity", expr: "Exy = %ΔQ of X ÷ %ΔP of Y  (positive: substitutes, negative: complements)" }, { name: "Income elasticity", expr: "Ey = %ΔQ ÷ %Δincome  (negative: inferior good)" } ] },
  { id: "surplus", title: "Surplus and deadweight loss (Units 2, 4, 6)", items: [
    { name: "Triangle area", expr: "Area = ½ × base × height" }, { name: "Consumer surplus", expr: "area below demand and above price, up to the quantity" }, { name: "Producer surplus", expr: "area above supply and below price, up to the quantity" },
    { name: "Deadweight loss", expr: "lost surplus on units whose benefit exceeds their cost but are not traded" } ] },
  { id: "cost", title: "Production and cost (Unit 3)", items: [
    { name: "Marginal product", expr: "MP = ΔTotal product ÷ ΔLabor" }, { name: "Costs", expr: "TC = FC + VC;  ATC = TC / Q;  AVC = VC / Q;  AFC = FC / Q;  MC = ΔTC / ΔQ" },
    { name: "Profit", expr: "Economic profit = TR − TC = (P − ATC) × Q" }, { name: "Accounting versus economic profit", expr: "Economic profit = TR − explicit costs − implicit costs" } ] },
  { id: "rules", title: "Decision rules (Units 3–6)", items: [
    { name: "Profit maximization", expr: "produce where MR = MC (a price taker: P = MC)" }, { name: "Short-run shutdown (perfect competition)", expr: "shut down if P < minimum AVC" },
    { name: "Long-run perfect competition", expr: "P = MC = minimum ATC, economic profit = 0" }, { name: "Monopoly", expr: "produce where MR = MC; charge the price on the demand curve; P > MC" } ] },
  { id: "factor", title: "Factor markets (Unit 5)", items: [
    { name: "Marginal revenue product", expr: "MRP = MP × marginal revenue  (competitive output market: MRP = MP × P)" }, { name: "Hiring rule", expr: "hire until MRP = wage (monopsony: MRP = marginal factor cost)" },
    { name: "Least-cost inputs", expr: "MPL / w = MPK / r" } ] },
  { id: "market", title: "Concentration and inequality (Units 4, 6)", items: [
    { name: "Four-firm concentration ratio", expr: "sum of the market shares of the four largest firms" }, { name: "Herfindahl-Hirschman Index", expr: "HHI = sum of the squared market shares (in percent)" },
    { name: "Gini coefficient", expr: "0 = perfect equality, 1 = perfect inequality" }, { name: "Marginal utility rule", expr: "MUx / Px = MUy / Py" } ] },
];
