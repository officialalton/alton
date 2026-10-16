"""BC 전용 FRQ 문항군: 오일러 근사 + 로지스틱 모형 해석(7.5, 7.9; BC 전용 학습 목표 FUN-7.C.4, FUN-7.H.1-4). 모든 값은 코드가 계산하고 독립 경로(부동소수 반복 + 해석해)로 확인한다."""
from common import *
from bp import frq_blueprint
from calc_ab_frq import row, part

SUB = "ap_calculus_bc"

def frq_euler_logistic(rng):
    K = rng.choice([100, 200, 400]); P0 = rng.choice([K // 20, K // 10, K // 10 * 2]); h = 1
    P = sp.Symbol("P")
    rate = lambda p: S(p) * (1 - S(p) / K)
    P1 = S(P0) + h * rate(P0); P2 = P1 + h * rate(P1)
    if not (P2 < S(K) / 2): raise ValueError("leaves_lower_half")
    pf = float(P0)
    for _ in range(2): pf += h * pf * (1 - pf / K)
    if abs(pf - float(P2)) > 1e-9: raise ValueError("independent_check_failed")
    true2 = K / (1 + (K / P0 - 1) * math.exp(-2))
    if not (float(P2) < true2 < K / 2): raise ValueError("not_underestimate_or_leaves_lower_half")
    assert sp.simplify(sp.diff(rate(P), P) * rate(P) - rate(P) * (1 - 2 * P / K)) == 0
    stim = {"kind": "text", "description": "Logistic model", "data": {"model": f"dP/dt = P(1 - P/{K}), P(0) = {P0}"}}
    L = lambda v: sp.latex(v)
    parts = [
        part("a", f"A population $P(t)$ of fish in a lake, in hundreds, at time $t$ years satisfies the logistic differential equation $\\dfrac{{dP}}{{dt}}=P\\left(1-\\dfrac{{P}}{{{K}}}\\right)$ with $P(0)={P0}$. Use Euler's method with two steps of equal size, starting at $t=0$, to approximate $P(2)$. Show the work that leads to your answer.", 3, "calculate", ["1.E"],
             f"Step size 1: P(1) ≈ {P0} + 1·({rate(P0)}) = {P1}; P(2) ≈ {P1} + 1·({rate(P1)}) = {P2}.", [
            row("a1", 1, "Slope at (0, P(0)) from the differential equation", [f"P'(0)={rate(P0)}"], nums=True), row("a2", 1, "First Euler step with step size 1 (value)", [f"{P1}"], requires="a1", nums=True), row("a3", 1, "Second Euler step using the updated value of P (answer)", [f"{P2}"], requires="a2", nums=True)]),
        part("b", "Is the Euler's method approximation from part (a) an overestimate or an underestimate of $P(2)$? Give a reason for your answer.", 2, "explain", ["3.E"],
             f"Underestimate: d²P/dt² = P'(1 - 2P/{K}) is positive while 0 < P < {K//2}, so the solution is concave up and tangent-line steps lie below it.", [
            row("b1", 1, f"Gives the reason: shows the solution is concave up using the sign of d^2P/dt^2 = (dP/dt)(1 - 2P/{K}) while P < {K//2}", ["d^2P/dt^2 > 0", f"P < {K//2}"], both=True), row("b2", 1, "Concludes Euler's method gives an underestimate because the tangent lines lie below a concave up solution", ["underestimate"], requires="b1")]),
        part("c", "Without solving the differential equation, find $\\lim_{t\\to\\infty}P(t)$ and find the value of $P$ at which the population is growing fastest. Explain your answers.", 2, "explain", ["3.F"],
             f"The limit is the carrying capacity {K}; growth is fastest at P = {K//2}, the maximum of P(1 - P/{K}).", [
            row("c1", 1, "Limit equals the carrying capacity (value)", [f"{K}"], nums=True), row("c2", 1, f"Fastest growth at P = {K//2}, justified as the maximizer of P(1 - P/{K}) (value)", [f"{K//2}", "maximum of dP/dt as a function of P"], both=True)]),
        part("d", f"A different population $Q(t)$ satisfies the same differential equation with $Q(0)={K + K // 5}$. Is $Q$ increasing or decreasing at $t=0$? Interpret your answer in the context of the model.", 2, "explain", ["3.F", "3.E"],
             f"dQ/dt = Q(1 - Q/{K}) < 0 when Q > {K}, so Q is decreasing: a population above the carrying capacity declines toward it.", [
            row("d1", 1, f"Determines the sign of dQ/dt at Q = {K + K // 5} (negative)", ["dQ/dt < 0"]), row("d2", 1, "Interprets: above the carrying capacity the population decreases toward the carrying capacity", ["carrying capacity", "decreases toward"], both=True, requires="d1")])]
    for p_, tc in zip(parts, [["7.5"], ["7.5", "7.4"], ["7.9"], ["7.9"]]): p_["topic_codes"] = tc
    pk = {"archetype": "frq_euler_logistic", "template": "euler_logistic_model", "topic": "7.5", "extra_topics": ["7.9", "7.4"], "skill": "1.E", "representative_skill": "1.E", "calculator": "not_allowed", "title": "Euler's method and a logistic model", "stimulus": stim, "parts": parts, "total_points": 9, "est_minutes": 15,
          "facts": [f"K={K}", f"P0={P0}", f"P1={P1}", f"P2={P2}"]}
    pk["blueprint"] = frq_blueprint("frq_euler_logistic", SUB, pk, "Approximate a solution with Euler's method, judge the approximation by concavity, and interpret a logistic model without solving it",
        ["Apply Euler's method twice, updating P each step", "Use the sign of d2P/dt2 to judge over/underestimate", "Read carrying capacity and fastest growth from the logistic equation", "Interpret the sign of dP/dt above the carrying capacity"],
        [(f"The Euler values stay below {K//2} and the solution stays in the lower half, so concavity is up on [0,2]", "checked in code with the closed-form logistic solution")], {"type": "text", "must_include": ["differential equation", "initial condition"]},
        "Euler iteration repeated in floating point and compared with the closed-form logistic solution to decide over/underestimate (independent of the exact-rational generation)")
    return pk
