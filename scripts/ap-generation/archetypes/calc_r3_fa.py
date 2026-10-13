"""R3 FRQ 원형(AB 계산기 필수, Part A 스타일) 4종 — 기존 FRQ 유형과 질문 구조가 다른 새 유형.
 1) frq_accum_charge: 적분으로 정의된 누적 함수 Q(x)=∫I (값·FTC 도함수·평균변화율·절대 최댓값 정당화·오목 구간)
 2) frq_marginal_profit: 한계수익·한계비용 모형(한계 이윤의 뜻·MR=MC 최적 생산량·수익 증가분·고정비를 뺀 총이윤)
 3) frq_trench_volume: 단면적 표 + 모형(사다리꼴 부피 추정·모형 부피·단면적 변화율의 뜻·평균 단면적과 같아지는 위치)
 4) frq_cooling_check: 냉각 모형이 미분방정식을 만족함을 확인·접선 근사·과소/과대 판정·목표 온도 도달 시각과 그때의 변화율
모든 값은 코드가 계산하고 독립 경로(기호 적분 대 수치 구적, 격자 탐색, 중심차분, 이분법)로 다시 확인한다."""
from common import *
from bp import frq_blueprint
from calc_ab_frq import row, part, f3
from calc_supp_frq import AB
from scipy import integrate as _I, optimize as _O


def _m(s):
    return f"${s}$"


def _pack(name, template, topic, extra, skill, title, stim, parts, facts, concept, thinking, keycond, material, indep):
    pk = {"archetype": name, "template": template, "topic": topic, "extra_topics": extra, "skill": skill, "representative_skill": skill, "calculator": "required", "title": title,
          "stimulus": stim, "parts": parts, "total_points": 9, "est_minutes": 15, "facts": facts}
    pk["blueprint"] = frq_blueprint(name, AB, pk, concept, thinking, keycond, material, indep)
    return pk


# ------------------------------------------------------------------ 1) 누적 함수 Q(x) = ∫_0^x I(t) dt, I(t)=A e^{-t/s} sin(w t)
def frq_accum_charge(rng):
    A = rng.choice([2, 3, 4, 5])
    s = rng.choice([4, 5, 6])
    w, wtxt = rng.choice([(0.8, "0.8"), (1.0, "1")])
    B = rng.choice([8, 9])
    x1 = rng.choice([2, 3])
    x2, x3 = rng.choice([(1, 6), (2, 7), (1, 5)])
    I = lambda t: A * math.exp(-t / s) * math.sin(w * t)
    Ip = lambda t: A * math.exp(-t / s) * (w * math.cos(w * t) - math.sin(w * t) / s)
    Q = lambda x: _I.quad(I, 0, x, epsabs=1e-12, epsrel=1e-12)[0]
    # 독립 경로 1: sympy 기호 적분
    tt = sp.Symbol("tt")
    anti = sp.integrate(A * sp.exp(-tt / sp.Integer(s)) * sp.sin(sp.Rational(wtxt) * tt), tt)
    Qs = lambda x: float(sp.N(anti.subs(tt, x) - anti.subs(tt, 0)))
    for x in (x1, x2, x3, B):
        if abs(Qs(x) - Q(x)) > 1e-8:
            raise ValueError("independent_check_failed")
    # 임계점 I(t)=0: 닫힌 꼴 n*pi/w, 독립 경로는 격자 부호 변화
    zs = [n * math.pi / w for n in range(1, 4) if n * math.pi / w < B]
    N = 160000
    grid = [B * i / N for i in range(N + 1)]
    sc = [grid[i] for i in range(1, N) if I(grid[i]) * I(grid[i + 1]) < 0]
    if len(zs) != 2 or len(sc) != 2 or any(abs(a - b) > 2 * B / N for a, b in zip(zs, sc)):
        raise ValueError("bad_design")
    z1, z2 = zs
    qz1, qB = Q(z1), Q(B)
    if not (qz1 > max(qB, 0) + 0.05):
        raise ValueError("bad_design")
    # 격자 최댓값(누적 사다리꼴)이 z1 에서
    cum, best, bt = 0.0, 0.0, 0.0
    for i in range(1, N + 1):
        cum += (I(grid[i - 1]) + I(grid[i])) / 2 * (B / N)
        if cum > best:
            best, bt = cum, grid[i]
    if abs(bt - z1) > 5 * B / N or abs(best - qz1) > 1e-4:
        raise ValueError("independent_check_failed")
    # 오목: Q'' = I' > 0 인 구간. 닫힌 꼴 t_n = (atan(w s) + n pi)/w, 독립 경로는 Q 의 이계 차분 부호
    ts = [(math.atan(w * s) + n * math.pi) / w for n in range(0, 4)]
    ts = [u for u in ts if 0 < u < B]
    edges = [0.0] + ts + [B]
    ups = []
    for i in range(len(edges) - 1):
        lo, hi = edges[i], edges[i + 1]
        mid = (lo + hi) / 2
        h = 1e-2
        sec = (Q(mid + h) - 2 * Q(mid) + Q(mid - h)) / h ** 2
        if (sec > 0) != (Ip(mid) > 0) or abs(sec) < 1e-4:
            raise ValueError("independent_check_failed")
        if sec > 0:
            ups.append((lo, hi))
    if not (1 <= len(ups) <= 3) or any(abs(Ip(u)) > 1e-9 for u in ts):
        raise ValueError("bad_design")
    avgrate = (Q(x3) - Q(x2)) / (x3 - x2)
    q1, d1 = Q(x1), I(x1)
    if abs(avgrate) < 0.05 or abs(d1) < 0.05:
        raise ValueError("bad_design")
    nf = lambda u: str(B) if u == B else ("0" if u == 0 else f3(u))
    ufmt = " and ".join(f"${nf(lo)}<x<{nf(hi)}$" for lo, hi in ups)
    stim = {"kind": "text", "description": "Current into a battery and the net charge delivered", "data": {"model": f"I(t) = {A}e^(-t/{s}) sin({wtxt}t) amperes, 0 <= t <= {B} seconds; Q(x) = integral of I(t) from 0 to x"}}
    wt = "" if wtxt == "1" else wtxt
    Itex = f"I(t)={A}e^{{-t/{s}}}\\sin({wt}t)"
    parts = [
        part("a", f"During a charging test, the current into a small battery is modeled by ${Itex}$ amperes (coulombs per second), where $t$ is the time in seconds and $0\\le t\\le {B}$. The net charge delivered to the battery during the first $x$ seconds is $Q(x)=\\int_0^x I(t)\\,dt$ coulombs. Find $Q({x1})$ and $Q'({x1})$.", 2, "calculate", ["1.D", "1.E"],
             f"$Q({x1})=\\int_0^{{{x1}}} I(t)\\,dt={f3(q1)}$ coulombs. By the Fundamental Theorem of Calculus, $Q'({x1})=I({x1})={f3(d1)}$.",
             [row("a1", 1, "Value of the accumulated charge, using the definite integral of the current", [_m(f"Q({x1})={f3(q1)}")], nums=True, tol="±0.001"),
              row("a2", 1, "Uses the Fundamental Theorem: the derivative of Q equals the integrand evaluated at the endpoint", [_m(f"Q'({x1})=I({x1})={f3(d1)}")], nums=True, tol="±0.001")]),
        part("b", f"Find the average rate of change of $Q$ over the interval ${x2}\\le x\\le {x3}$. Using correct units, state what this average rate of change represents.", 2, "calculate", ["1.E", "3.F"],
             f"$\\dfrac{{Q({x3})-Q({x2})}}{{{x3}-{x2}}}={f3(avgrate)}$ coulombs per second: the average current into the battery between $t={x2}$ and $t={x3}$ seconds (it also equals the average value of $I$ on that interval).",
             [row("b1", 1, "Average rate of change from the values of Q at the endpoints, divided by the length of the interval", [_m(f"\\frac{{Q({x3})-Q({x2})}}{{{x3}-{x2}}}")], alt=[_m(f"\\frac{{1}}{{{x3}-{x2}}}\\int_{{{x2}}}^{{{x3}}} I(t)\\,dt")]),
              row("b2", 1, "Value with units: coulombs per second (the average current)", [_m(f3(avgrate)) + " coulombs per second"], requires="b1", nums=True, units=True, tol="±0.001")]),
        part("c", f"For $0\\le x\\le {B}$, at what value of $x$ does $Q$ attain its absolute maximum value? Find that maximum value and justify your answer.", 3, "explain", ["3.B", "3.E"],
             f"$Q'(x)=I(x)=0$ for $x={f3(z1)}$ and $x={f3(z2)}$. $I$ changes from positive to negative at $x={f3(z1)}$, so $Q$ has a local maximum there; $Q(0)=0$, $Q({f3(z1)})={f3(qz1)}$, $Q({B})={f3(qB)}$. The absolute maximum is {f3(qz1)} coulombs at $x={f3(z1)}$.",
             [row("c1", 1, "Sets the derivative of Q, which is I, equal to zero and finds the critical points in the interval", [_m(f"x={f3(z1)}"), _m(f"x={f3(z2)}")], nums=True, both=True, tol="±0.001"),
              row("c2", 1, "Justification with the sign of $Q'$, i.e. of $I$: positive then negative at the first critical point", [_m("Q'") + " changes from positive to negative at " + _m(f"x={f3(z1)}")], requires="c1"),
              row("c3", 1, "Compares the values of Q at the candidates including both endpoints and states the maximum value", [_m(f"Q(0)=0"), _m(f"Q({B})={f3(qB)}"), _m(f3(qz1))], requires="c2", nums=True, both=True, tol="±0.001")]),
        part("d", f"On which open intervals within $0<x<{B}$ is $Q$ concave up? Give a reason for your answer.", 2, "explain", ["2.E", "3.E"],
             f"$Q''(x)=I'(x)$, and $I'(x)>0$ exactly when $Q$ is concave up. $I'(x)=0$ at " + ", ".join(f"$x={f3(u)}$" for u in ts) + f"; the graph of $Q$ is concave up on {ufmt}.",
             [row("d1", 1, "Reason: relates the concavity of $Q$ to the sign of $Q''=I'$ and finds where $I'$ changes sign", [_m("Q''(x)=I'(x)")] + [_m(f"x={f3(u)}") for u in ts], nums=True, both=True, tol="±0.001"),
              row("d2", 1, "States the intervals on which $I'$ is positive", [f"{f3(lo)} to {f3(hi)}" for lo, hi in ups], requires="d1", nums=True, both=True, tol="±0.001")])]
    for p_, tc in zip(parts, [["6.4"], ["1.2"], ["5.5"], ["6.5"]]):
        p_["topic_codes"] = tc
    return _pack("frq_accum_charge", "accumulation_function_analysis_calc", "6.5", ["6.4", "5.5"], "3.E", "Accumulation function of a current: value, Fundamental Theorem derivative, average rate, absolute maximum, concavity",
                 stim, parts, [f"A={A}", f"s={s}", f"w={w}", f"B={B}", f"Q(x1)={q1:.6f}", f"I(x1)={d1:.6f}", f"avg={avgrate:.6f}", f"z1={z1:.6f}", f"Qmax={qz1:.6f}", f"Q(B)={qB:.6f}"],
                 "Analyze a function defined as an integral of a given integrand with a calculator: values, derivative by the Fundamental Theorem, average rate, absolute extremum with candidates, and concavity from the derivative of the integrand",
                 ["Evaluate the accumulation function with a numerical integral and use the Fundamental Theorem for its derivative", "Use the average rate of change from endpoint values", "Locate critical points where the integrand is zero and compare Q at the candidates and endpoints", "Concavity of Q follows from the sign of the derivative of the integrand"],
                 [("the integrand has exactly two sign changes in the interval, first positive to negative", "I(t)=0 only at n*pi/w below the interval end and Q(first zero) exceeds both Q(0) and Q(end)")], {"type": "text", "must_include": ["integrand formula", "definition of Q"]},
                 "Q values are checked with sympy's symbolic antiderivative, the maximum with a 160001-point cumulative trapezoid scan, the zeros of I with a grid sign scan, and the concave-up intervals with the second difference of Q (independent of the closed forms)")


# ------------------------------------------------------------------ 2) 한계수익·한계비용: MR(q)=A-b ln(q+1), MC(q)=c+d q^2
def frq_marginal_profit(rng):
    for _ in range(4000):
        A, b, c, d = rng.choice([14, 16, 18, 20]), rng.choice([2, 3]), rng.choice([2, 3, 4]), rng.choice([0.1, 0.15, 0.2])
        K = rng.choice([6, 8, 10, 12])
        q0 = rng.choice([1, 2])
        qa, qb = rng.choice([(1, 5), (2, 6), (1, 6)])
        MR = lambda q: A - b * math.log(q + 1)
        MC = lambda q: c + d * q * q
        D = lambda q: MR(q) - MC(q)
        Q = 10
        N = 100000
        g = [Q * i / N for i in range(N + 1)]
        sc = [i for i in range(N) if D(g[i]) * D(g[i + 1]) < 0]
        if len(sc) != 1 or D(0) <= 0 or D(Q) >= 0:
            continue
        qs = _O.brentq(D, g[sc[0]], g[sc[0] + 1], xtol=1e-13)
        if not (2.5 < qs < 8 and D(q0) > 0.3 and qb < qs):
            continue
        break
    else:
        raise ValueError("no_sample")
    q = sp.Symbol("q")
    # 독립 경로: 격자 근, 기호 적분, 이윤 격자 최댓값
    if abs(g[sc[0]] - qs) > 2 * Q / N:
        raise ValueError("independent_check_failed")
    MRs = A - b * sp.log(q + 1)
    MCs = c + sp.Rational(str(d)) * q ** 2
    Rgain = _I.quad(MR, qa, qb)[0]
    Rgain_s = float(sp.N(sp.integrate(MRs, (q, qa, qb))))
    gain = _I.quad(D, 0, qs)[0]
    gain_s = float(sp.N(sp.integrate(MRs - MCs, (q, 0, qs))))
    if abs(Rgain - Rgain_s) > 1e-8 or abs(gain - gain_s) > 1e-8:
        raise ValueError("independent_check_failed")
    prof = gain - K
    cum, best, bq = 0.0, -1e9, 0.0
    for i in range(1, N + 1):
        cum += (D(g[i - 1]) + D(g[i])) / 2 * (Q / N)
        if cum - K > best:
            best, bq = cum - K, g[i]
    if abs(bq - qs) > 5 * Q / N or abs(best - prof) > 1e-3 or abs(prof) < 0.2:
        raise ValueError("independent_check_failed")
    diff0 = D(q0)
    dtxt = f"{d:g}"
    stim = {"kind": "text", "description": "Marginal revenue and marginal cost of a workshop", "data": {"model": f"MR(q) = {A} - {b}ln(q+1), MC(q) = {c} + {dtxt}q^2, 0 <= q <= 10; q in hundreds of items, money in thousands of dollars; fixed cost {K}"}}
    verdict = "a profit" if prof > 0 else "a loss"
    parts = [
        part("a", f"A workshop makes and sells $q$ hundred custom phone cases per week, for $0\\le q\\le 10$. The marginal revenue is $MR(q)={A}-{b}\\ln(q+1)$ and the marginal cost is $MC(q)={c}+{dtxt}q^2$, both in thousands of dollars per hundred cases. Find $MR({q0})-MC({q0})$. Using correct units, explain what this value says about the profit when production is increased from $q={q0}$.", 2, "explain", ["1.E", "3.F"],
             f"$MR({q0})-MC({q0})={f3(diff0)}$ thousand dollars per hundred cases. At $q={q0}$ the profit is changing at a rate of {f3(diff0)} thousand dollars per hundred cases, so producing a little more raises the profit.",
             [row("a1", 1, "Difference of the marginal revenue and the marginal cost at the given production level", [_m(f"MR({q0})-MC({q0})={f3(diff0)}")], nums=True, tol="±0.001"),
              row("a2", 1, "Interpretation with units: the rate of change of profit, in thousand dollars per hundred cases; positive, so profit increases as production increases", ["rate of change of the profit", "thousand dollars per hundred cases", "profit increases"], both=True, units=True, requires="a1")]),
        part("b", "The profit is $P(q)=R(q)-C(q)$, where $R$ and $C$ are the revenue and cost functions. Find the production level $q$ that gives the maximum profit on $0\\le q\\le 10$. Justify your answer.", 3, "explain", ["3.B", "3.E"],
             f"$P'(q)=MR(q)-MC(q)=0$ at $q={f3(qs)}$. $P'>0$ for $q<{f3(qs)}$ and $P'<0$ for $q>{f3(qs)}$ on the whole interval, so the maximum profit occurs at $q={f3(qs)}$ hundred cases.",
             [row("b1", 1, "Uses the fact that the derivative of profit is MR minus MC and sets it equal to zero", [_m("P'(q)=MR(q)-MC(q)=0")]),
              row("b2", 1, "Solution with a calculator", [_m(f"q={f3(qs)}")], requires="b1", nums=True, tol="±0.001"),
              row("b3", 1, "Justification: $P'$ changes from positive to negative at this value, so the profit is greatest there", [_m("P'") + " changes from positive to negative"], requires="b2")]),
        part("c", f"Find the increase in total revenue when production is raised from $q={qa}$ to $q={qb}$ hundred cases. Show the setup for your calculation.", 2, "calculate", ["1.D", "1.E"],
             f"Increase in revenue $=R({qb})-R({qa})=\\int_{{{qa}}}^{{{qb}}} MR(q)\\,dq={f3(Rgain)}$ thousand dollars.",
             [row("c1", 1, "Net change of the revenue as the definite integral of the marginal revenue over the given interval", [_m(f"\\int_{{{qa}}}^{{{qb}}} MR(q)\\,dq")]),
              row("c2", 1, "Value with units", [_m(f3(Rgain)) + " thousand dollars"], requires="c1", nums=True, units=True, tol="±0.001")]),
        part("d", f"The weekly fixed cost is ${K}$ thousand dollars, so $P(0)=-{K}$. Find the profit at the production level found in part (b). Does the workshop make a profit or a loss at that level?", 2, "calculate", ["1.E", "3.E"],
             f"$P({f3(qs)})=P(0)+\\int_0^{{{f3(qs)}}}(MR(q)-MC(q))\\,dq=-{K}+{f3(gain)}={f3(prof)}$ thousand dollars, which is {verdict}.",
             [row("d1", 1, "Profit as the initial value plus the integral of the marginal profit up to the production level of part (b)", [_m(f"P(0)+\\int_0^{{{f3(qs)}}}(MR(q)-MC(q))\\,dq"), _m(f"\\int_0^{{{f3(qs)}}}(MR(q)-MC(q))\\,dq={f3(gain)}")], nums=True, tol="±0.001"),
              row("d2", 1, "Value of the profit and the conclusion", [_m(f3(prof)) + " thousand dollars", verdict.replace("a ", "")], requires="d1", nums=True, both=True, tol="±0.001")])]
    for p_, tc in zip(parts, [["4.1"], ["5.10"], ["6.4"], ["6.4"]]):
        p_["topic_codes"] = tc
    return _pack("frq_marginal_profit", "marginal_profit_calc", "5.10", ["4.1", "6.4"], "3.E", "Marginal revenue and marginal cost: meaning of marginal profit, best production level, revenue increase, profit at the optimum",
                 stim, parts, [f"A={A}", f"b={b}", f"c={c}", f"d={d}", f"K={K}", f"q0={q0}", f"qs={qs:.6f}", f"Rgain={Rgain:.6f}", f"gain={gain:.6f}", f"profit={prof:.6f}"],
                 "Given marginal revenue and marginal cost, interpret their difference, find the production level that maximizes profit with a sign argument, and use integrals of marginal quantities for a revenue increase and the profit",
                 ["Marginal profit is the difference of the marginal functions; interpret it with units", "Solve MR = MC with a calculator and justify with the sign change of the marginal profit", "Net change of revenue is the integral of MR", "Profit equals the starting value minus the fixed cost plus the integral of the marginal profit"],
                 [("MR - MC is positive at 0 and negative at the end of the interval and crosses zero exactly once", "P' changes sign once so the critical point is the global maximum")], {"type": "text", "must_include": ["MR formula", "MC formula", "fixed cost"]},
                 "the root of MR - MC is found by a 100001-point grid sign scan (independent of Brent's method), the integrals by sympy's symbolic antiderivative, and the maximum profit by a cumulative trapezoid scan of P")


# ------------------------------------------------------------------ 3) 단면적 표(사다리꼴 부피) + 모형 A(x)=a+b sin(x/m)
def frq_trench_volume(rng):
    for _ in range(4000):
        a, b, m = rng.choice([12, 14, 16]), rng.choice([3, 4, 5]), rng.choice([4, 5, 6])
        k = rng.choice([4, 6, 8, 12])
        xs = rng.choice([[0, 3, 7, 12, 16, 20], [0, 4, 7, 11, 16, 20], [0, 2, 6, 11, 15, 20]])
        A = lambda x: a + b * math.sin(x / m)
        Lg = 20
        N = 100000
        grid = [Lg * i / N for i in range(N + 1)]
        V = a * Lg + b * m * (1 - math.cos(Lg / m))
        avg = V / Lg
        sc = [i for i in range(N) if (A(grid[i]) - avg) * (A(grid[i + 1]) - avg) < 0]
        if len(sc) != 2:
            continue
        break
    else:
        raise ValueError("no_sample")
    tab = [round(A(x), 1) for x in xs]
    trap = sum((tab[i] + tab[i + 1]) / 2 * (xs[i + 1] - xs[i]) for i in range(5))
    Vq = _I.quad(A, 0, Lg, epsabs=1e-12, epsrel=1e-12)[0]
    if abs(Vq - V) > 1e-7:
        raise ValueError("independent_check_failed")
    r1 = _O.brentq(lambda u: A(u) - avg, grid[sc[0]], grid[sc[0] + 1], xtol=1e-13)
    r2 = _O.brentq(lambda u: A(u) - avg, grid[sc[1]], grid[sc[1] + 1], xtol=1e-13)
    if abs(grid[sc[0]] - r1) > 2 * Lg / N or abs(grid[sc[1]] - r2) > 2 * Lg / N:
        raise ValueError("independent_check_failed")
    dA = (b / m) * math.cos(k / m)
    cd = (A(k + 1e-6) - A(k - 1e-6)) / 2e-6
    if abs(cd - dA) > 1e-6 or abs(dA) < 0.05:
        raise ValueError("bad_design")
    rows_tab = [[str(x), f"{v:.1f}"] for x, v in zip(xs, tab)]
    stim = {"kind": "table", "description": "Cross-sectional area of a trench, in square meters", "data": {"x_label": "x (meters)", "y_label": "A(x) (square meters)", "rows": rows_tab}}
    trap_terms = "+".join(f"(({tab[i]}+{tab[i+1]})/2)({xs[i+1]-xs[i]})" for i in range(5))
    trend = "increasing" if dA > 0 else "decreasing"
    parts = [
        part("a", f"A drainage trench is dug along a straight line for $20$ meters. At the point $x$ meters from the start, the vertical cross section of the trench perpendicular to the line has area $A(x)$ square meters, where $A$ is a continuous function. Selected values of $A(x)$ are shown in the table. Use a trapezoidal sum with the five subintervals indicated by the table to approximate the volume of soil removed, $\\int_0^{{20}} A(x)\\,dx$. Using correct units, explain the meaning of this integral in the context of the problem.", 3, "calculate", ["1.E", "3.F", "4.B"],
             f"Trapezoidal sum $={f3(trap)}$ cubic meters; $\\int_0^{{20}} A(x)\\,dx$ is the volume of the trench, i.e. of the soil removed, in cubic meters.",
             [row("a1", 1, "Form of the trapezoidal sum with the five subintervals of different widths", [_m(trap_terms)], nums=True),
              row("a2", 1, "Approximation value", [_m(f3(trap))], requires="a1", nums=True, tol="±0.001"),
              row("a3", 1, "Interpretation with units: the volume of soil removed over the 20 meters, in cubic meters", ["volume of soil removed", "cubic meters"], both=True, units=True)]),
        part("b", f"The area function is modeled by $A(x)={a}+{b}\\sin\\left(\\dfrac{{x}}{{{m}}}\\right)$ for $0\\le x\\le 20$. Use the model to find the volume of the trench. Show the setup for your calculation.", 2, "calculate", ["1.D", "1.E"],
             f"$V=\\int_0^{{20}}\\left({a}+{b}\\sin\\left(\\frac{{x}}{{{m}}}\\right)\\right)dx={f3(V)}$ cubic meters.",
             [row("b1", 1, "Definite integral of the model over the length of the trench", [_m(f"\\int_0^{{20}} A(x)\\,dx")]),
              row("b2", 1, "Value with units", [_m(f3(V)) + " cubic meters"], requires="b1", nums=True, units=True, tol="±0.001")]),
        part("c", f"Find $A'({k})$. Using correct units, explain the meaning of $A'({k})$ in the context of the problem.", 2, "explain", ["1.E", "3.F"],
             f"$A'({k})={f3(dA)}$: at $x={k}$ meters the cross-sectional area is {trend} at {f3(abs(dA))} square meters per meter of length.",
             [row("c1", 1, "Value of the derivative of the model at the given point", [_m(f"A'({k})={f3(dA)}")], nums=True, tol="±0.001"),
              row("c2", 1, "Interpretation with units: the rate of change of the cross-sectional area with respect to distance along the trench, in square meters per meter", ["rate of change of the cross-sectional area", "square meters per meter"], both=True, units=True, requires="c1")]),
        part("d", "Find the average cross-sectional area of the trench according to the model. Then find all values of $x$ in $0<x<20$ at which the cross-sectional area equals this average.", 2, "calculate", ["1.D", "1.E"],
             f"Average $=V/20={f3(avg)}$ square meters; $A(x)={f3(avg)}$ at $x={f3(r1)}$ and $x={f3(r2)}$.",
             [row("d1", 1, "Average value of the model: the volume divided by the length", [_m(f"\\frac{{1}}{{20}}\\int_0^{{20}} A(x)\\,dx={f3(avg)}")], nums=True, tol="±0.001"),
              row("d2", 1, "Both solutions of $A(x)=$ average (calculator)", [_m(f"x={f3(r1)}"), _m(f"x={f3(r2)}")], requires="d1", nums=True, both=True, tol="±0.001")])]
    for p_, tc in zip(parts, [["6.2"], ["8.1"], ["4.1"], ["8.1"]]):
        p_["topic_codes"] = tc
    return _pack("frq_trench_volume", "cross_section_table_model_calc", "8.2", ["6.2", "8.1", "4.1"], "1.E", "Trench cross-section areas: trapezoid volume from a table, model volume, rate of change of area, average area and where it occurs",
                 stim, parts, [f"a={a}", f"b={b}", f"m={m}", f"k={k}", f"trap={trap:.6f}", f"V={V:.6f}", f"dA={dA:.6f}", f"avg={avg:.6f}", f"r1={r1:.6f}", f"r2={r2:.6f}"],
                 "Estimate a volume from a table of cross-sectional areas with a trapezoidal sum, compare with the model integral, interpret the derivative of the area function, and find where the area equals its average",
                 ["Treat the area of cross sections as the integrand and add trapezoids over unequal widths", "Integrate the model for the volume", "Differentiate the model and interpret with units", "Average area is volume over length; solve A(x) = average for both locations"],
                 [("the model is a sine with period long enough that A equals its average exactly twice on the interval", "the grid sign scan finds exactly two crossings")], {"type": "table", "must_include": ["x values", "A(x) values"]},
                 "the model volume is checked against the closed form of the integral, the derivative by central difference, and the two locations by a 100001-point grid sign scan (independent of Brent's method)")


# ------------------------------------------------------------------ 4) 냉각 모형 T(t)=Ta+(T0-Ta)e^{-kt}: 미분방정식 확인·접선 근사·과소/과대·도달 시각과 변화율
def frq_cooling_check(rng):
    Ta = rng.choice([20, 22, 24])
    T0 = rng.choice([180, 200, 220])
    k, ktxt = rng.choice([(0.04, "0.04"), (0.05, "0.05"), (0.06, "0.06")])
    t0 = rng.choice([10, 15])
    h = rng.choice([5, 10])
    Tg = rng.choice([60, 80, 100])
    T = lambda t: Ta + (T0 - Ta) * math.exp(-k * t)
    Tp = lambda t: -k * (T0 - Ta) * math.exp(-k * t)
    slope = -k * (T(t0) - Ta)
    if abs(slope - Tp(t0)) > 1e-12:
        raise ValueError("independent_check_failed")
    est = T(t0) + slope * h
    act = T(t0 + h)
    if not est < act:
        raise ValueError("bad_design")
    cd = (T(t0 + 1e-6) - T(t0 - 1e-6)) / 2e-6
    if abs(cd - slope) > 1e-5:
        raise ValueError("independent_check_failed")
    ts = math.log((T0 - Ta) / (Tg - Ta)) / k
    # 반올림 경계 회피: 어떤 값도 소수 넷째 자리가 5 근처이면 안 되고, 반올림한 중간값으로 구한 추정치가 키와 0.0004 이내여야 한다(채점 일관성)
    for v_ in (T(t0), slope, est, act, ts, -k * (Tg - Ta)):
        if abs((abs(v_) * 1000) % 1 - 0.5) < 0.15:
            raise ValueError("rounding_boundary")
    if abs(round(T(t0), 3) + round(slope, 3) * h - est) > 0.0004:
        raise ValueError("rounding_boundary")
    tb = _O.bisect(lambda u: T(u) - Tg, 0, 400, xtol=1e-13)
    if abs(tb - ts) > 1e-9:
        raise ValueError("independent_check_failed")
    rate = -k * (Tg - Ta)
    if abs((T(ts + 1e-6) - T(ts - 1e-6)) / 2e-6 - rate) > 1e-5:
        raise ValueError("independent_check_failed")
    # T'' > 0 (격자 확인)
    if any((T(u + 0.01) - 2 * T(u) + T(u - 0.01)) <= 0 for u in (t0, t0 + h / 2, t0 + h)):
        raise ValueError("independent_check_failed")
    stim = {"kind": "text", "description": "Temperature of a cast-iron pan cooling in a kitchen", "data": {"model": f"T(t) = {Ta} + {T0 - Ta}e^(-{ktxt}t) degrees Celsius, t in minutes; dT/dt = -{ktxt}(T - {Ta})"}}
    parts = [
        part("a", f"A cast-iron pan is taken out of an oven and left in a kitchen. Its temperature, in degrees Celsius, is modeled by $T(t)={Ta}+{T0 - Ta}e^{{-{ktxt}t}}$, where $t$ is the time in minutes since the pan was taken out. Show that $T$ satisfies the differential equation $\\dfrac{{dT}}{{dt}}=-{ktxt}\\,(T-{Ta})$.", 2, "explain", ["1.E", "2.C"],
             f"$T'(t)=-{ktxt}\\cdot{T0 - Ta}e^{{-{ktxt}t}}$. Since $T(t)-{Ta}={T0 - Ta}e^{{-{ktxt}t}}$, this equals $-{ktxt}\\,(T(t)-{Ta})$.",
             [row("a1", 1, "Differentiates the model", [_m(f"T'(t)=-{ktxt}\\cdot {T0 - Ta}e^{{-{ktxt}t}}")]),
              row("a2", 1, "Rewrites the exponential term as T minus the room temperature and concludes the equation holds", [_m(f"T(t)-{Ta}={T0 - Ta}e^{{-{ktxt}t}}"), _m(f"T'(t)=-{ktxt}(T(t)-{Ta})")], requires="a1")]),
        part("b", f"Write an equation for the line tangent to the curve $y=T(t)$ at $t={t0}$. Use this tangent line to approximate the temperature of the pan at $t={t0 + h}$.", 2, "calculate", ["1.E", "1.F"],
             f"$T({t0})={f3(T(t0))}$ and $T'({t0})={f3(slope)}$, so the tangent line is $y={f3(T(t0))}+({f3(slope)})(t-{t0})$. At $t={t0 + h}$ the approximation is ${f3(est)}$ degrees Celsius.",
             [row("b1", 1, "Tangent line equation using the value and the slope at the given time", [_m(f"y={f3(T(t0))}+({f3(slope)})(t-{t0})")], nums=True, tol="±0.001"),
              row("b2", 1, "Approximation at the later time", [_m(f3(est))], requires="b1", nums=True, tol="±0.001")]),
        part("c", f"Is the approximation in part (b) less than or greater than the actual temperature $T({t0 + h})$? Use $\\dfrac{{d^2T}}{{dt^2}}$ to justify your answer.", 2, "explain", ["3.E", "2.E"],
             f"$T''(t)={k * k * (T0 - Ta):g}e^{{-{ktxt}t}}>0$, so the graph of $T$ is concave up and lies above its tangent lines. The approximation ${f3(est)}$ is less than the actual value $T({t0 + h})={f3(act)}$.",
             [row("c1", 1, "Justification: the second derivative of the model is positive, so the function is concave up", [_m(f"T''(t)={k * k * (T0 - Ta):g}e^{{-{ktxt}t}}>0"), "concave up"], both=True),
              row("c2", 1, "Conclusion: the tangent line is below a concave up graph, so the approximation is less than the actual temperature", ["less than"], requires="c1")]),
        part("d", f"The pan can be handled safely once its temperature reaches ${Tg}$ degrees Celsius. Find the time $t$ at which $T(t)={Tg}$. Using correct units, find the rate of change of the temperature at that time.", 3, "calculate", ["1.E", "3.F"],
             f"$T(t)={Tg}$ gives $t={f3(ts)}$ minutes. At that time $T'(t)=-{ktxt}({Tg}-{Ta})={f3(rate)}$ degrees Celsius per minute.",
             [row("d1", 1, "Equation for the time", [_m(f"T(t)={Tg}")]),
              row("d2", 1, "Time (calculator)", [_m(f"t={f3(ts)}") + " minutes"], requires="d1", nums=True, units=True, tol="±0.001"),
              row("d3", 1, "Rate of change at that time with units: degrees Celsius per minute (negative: the pan is cooling)", [_m(f3(rate)) + " degrees Celsius per minute"], requires="d2", nums=True, units=True, tol="±0.001")])]
    for p_, tc in zip(parts, [["7.2"], ["4.6"], ["5.6"], ["4.1"]]):
        p_["topic_codes"] = tc
    return _pack("frq_cooling_check", "cooling_model_check_tangent_calc", "7.2", ["4.6", "5.6", "4.1"], "1.E", "Cooling model: verify the differential equation, tangent-line estimate, over or under by concavity, time to a target temperature and the rate then",
                 stim, parts, [f"Ta={Ta}", f"T0={T0}", f"k={k}", f"t0={t0}", f"h={h}", f"Tg={Tg}", f"est={est:.6f}", f"act={act:.6f}", f"ts={ts:.6f}", f"rate={rate:.6f}"],
                 "Verify that a given exponential cooling model satisfies its differential equation, use the tangent line to estimate, decide over or under from the second derivative, and find the time to a target temperature and the rate of change then",
                 ["Differentiate the model and compare with the equation", "Tangent line from the value and slope at the starting time", "Positive second derivative means the tangent line is below the graph", "Solve T(t) = target and use the equation for the rate"],
                 [("T'' is positive for all t so the tangent estimate is always an underestimate", "T''(t) = k^2 (T0 - Ta) e^(-kt) > 0")], {"type": "text", "must_include": ["model formula", "differential equation"]},
                 "the tangent slope is checked by central difference, the target time by bisection on T(t) - target (independent of the logarithm formula), the rate at that time by central difference, and concavity by second differences of T")


def _safe(*vals):
    """3자리 반올림 경계에서 멀리 떨어진 값만 허용(풀이자가 반올림한 중간값으로 계산해도 같은 답이 나오게)."""
    for v in vals:
        fr = (abs(v) * 1000) % 1
        if abs(fr - 0.5) < 0.03 or fr < 0.003 or fr > 0.997:
            raise ValueError("rounding_boundary")


# ------------------------------------------------------------------ 5) 곡선과 직선으로 둘러싸인 영역: 교점·넓이·넓이를 이등분하는 수직선·최대 수직 거리
def _retry(fn, rng):
    for _ in range(400):
        try:
            return fn(rng)
        except ValueError:
            continue
    raise ValueError("no_sample")


def frq_region_bisect(rng):
    return _retry(_region_impl, rng)


def frq_closest_point(rng):
    return _retry(_closest_impl, rng)


def _region_impl(rng):
    m = rng.choice([2, 3])
    A = m * rng.choice([1, 2])
    c = round(rng.choice([0.2, 0.3, 0.4, 0.5]) * A / m, 2)
    f = lambda x: A * math.sin(x / m)
    d = lambda x: A * math.sin(x / m) - c * x
    N = 120000
    top = m * math.pi
    grid = [top * i / N for i in range(1, N + 1)]
    sc = [i for i in range(N - 1) if d(grid[i]) * d(grid[i + 1]) < 0]
    if len(sc) != 1:
        raise ValueError("bad_design")
    r = _O.brentq(d, grid[sc[0]], grid[sc[0] + 1], xtol=1e-14)
    if abs(grid[sc[0]] - r) > 2 * top / N:
        raise ValueError("independent_check_failed")
    rr = round(r, 3)
    S = _I.quad(d, 0, r, epsabs=1e-13, epsrel=1e-13)[0]
    S_closed = A * m * (1 - math.cos(r / m)) - c * r * r / 2
    S_round = _I.quad(d, 0, rr)[0]
    if abs(S - S_closed) > 1e-9:
        raise ValueError("independent_check_failed")
    cum = lambda h, rt: _I.quad(d, 0, h)[0] - _I.quad(d, 0, rt)[0] / 2
    h = _O.brentq(lambda u: cum(u, r), 1e-6, r - 1e-6, xtol=1e-14)
    h_round = _O.brentq(lambda u: cum(u, rr), 1e-6, rr - 1e-6, xtol=1e-14)
    # 독립: 누적 사다리꼴 격자에서 절반 넘는 첫 위치
    M = 200000
    acc, hg = 0.0, None
    for i in range(1, M + 1):
        a0, a1 = r * (i - 1) / M, r * i / M
        acc += (d(a0) + d(a1)) / 2 * (r / M)
        if acc >= S / 2:
            hg = a1
            break
    if hg is None or abs(hg - h) > 3 * r / M:
        raise ValueError("independent_check_failed")
    xm = m * math.acos(c * m / A)
    gmax = max(d(r * i / 100000) for i in range(100001))
    dmax = d(xm)
    if abs(gmax - dmax) > 1e-7 or not (0 < xm < r):
        raise ValueError("independent_check_failed")
    _safe(r, S, h, xm, dmax)
    for u, v in ((S, S_round), (h, h_round)):
        if f3(u) != f3(v):
            raise ValueError("rounding_boundary")
    if abs(h - r / 2) < 0.15:
        raise ValueError("bad_design")
    mt = f"\\sin\\left(\\dfrac{{x}}{{{m}}}\\right)"
    stim = {"kind": "text", "description": "A region between a sine curve and a line", "data": {"model": f"y = {A} sin(x/{m}) and y = {c:g}x, x >= 0"}}
    parts = [
        part("a", f"Let $R$ be the region in the first quadrant enclosed by the curve $y={A}{mt}$ and the line $y={c:g}x$. Find the $x$-coordinate of the point, other than the origin, where the curve and the line intersect.", 2, "calculate", ["1.D", "1.E"],
             f"Solve ${A}\\sin(x/{m})={c:g}x$ on $x>0$: $x={f3(r)}$.",
             [row("a1", 1, "Sets the two expressions equal to find the intersection", [_m(f"{A}\\sin(x/{m})={c:g}x")]),
              row("a2", 1, "Solution with a calculator", [_m(f"x={f3(r)}")], requires="a1", nums=True, tol="±0.001")]),
        part("b", "Find the area of $R$. Show the setup for your calculation.", 2, "calculate", ["1.D", "1.E"],
             f"Area $=\\int_0^{{{f3(r)}}}\\left({A}\\sin(x/{m})-{c:g}x\\right)dx={f3(S)}$.",
             [row("b1", 1, "Integral of the upper curve minus the lower curve between the limits found in part (a)", [_m(f"\\int_0^{{{f3(r)}}}({A}\\sin(x/{m})-{c:g}x)\\,dx")]),
              row("b2", 1, "Value of the area", [_m(f3(S))], requires="b1", nums=True, tol="±0.001")]),
        part("c", "The vertical line $x=k$, with $0<k<$ the $x$-coordinate found in part (a), divides $R$ into two regions of equal area. Write an equation involving an integral that gives $k$, and find the value of $k$.", 3, "calculate", ["1.D", "1.E"],
             f"The area of the left piece must be half of the total: $\\int_0^{{k}}\\left({A}\\sin(x/{m})-{c:g}x\\right)dx={f3(S / 2)}$, which gives $k={f3(h)}$.",
             [row("c1", 1, "Uses half of the total area from part (b) as the target", [_m(f3(S / 2))], nums=True, tol="±0.001"),
              row("c2", 1, "Equation with an integral from zero to k of the difference of the curves equal to half of the area", [_m(f"\\int_0^{{k}}({A}\\sin(x/{m})-{c:g}x)\\,dx={f3(S / 2)}")], alt=[_m(f"\\int_k^{{{f3(r)}}}({A}\\sin(x/{m})-{c:g}x)\\,dx={f3(S / 2)}")]),
              row("c3", 1, "Value of k", [_m(f"k={f3(h)}")], requires="c2", nums=True, tol="±0.001")]),
        part("d", "For $0\\le x\\le$ the $x$-coordinate found in part (a), find the greatest vertical distance between the curve and the line. Justify your answer.", 2, "explain", ["3.B", "3.E"],
             f"The vertical distance is $g(x)={A}\\sin(x/{m})-{c:g}x$, and $g'(x)={A / m:g}\\cos(x/{m})-{c:g}=0$ at $x={f3(xm)}$. $g'$ changes from positive to negative there and $g=0$ at both ends, so the greatest distance is $g({f3(xm)})={f3(dmax)}$.",
             [row("d1", 1, "Sets the derivative of the vertical distance equal to zero and solves", [_m(f"g'(x)=0"), _m(f"x={f3(xm)}")], nums=True, both=True, tol="±0.001"),
              row("d2", 1, "Justification: $g'$ changes from positive to negative (or the endpoint values are zero), and the greatest distance value", [_m("g'") + " changes sign from positive to negative", _m(f3(dmax))], requires="d1", nums=True, both=True, tol="±0.001")])]
    for p_, tc in zip(parts, [["8.4"], ["8.4"], ["8.4"], ["5.10"]]):
        p_["topic_codes"] = tc
    return _pack("frq_region_bisect", "region_bisecting_line_calc", "8.4", ["5.10"], "1.E", "Region between a sine curve and a line: intersection, area, vertical line bisecting the area, greatest vertical distance",
                 stim, parts, [f"A={A}", f"m={m}", f"c={c}", f"r={r:.6f}", f"S={S:.6f}", f"k={h:.6f}", f"xm={xm:.6f}", f"dmax={dmax:.6f}"],
                 "Find the intersection of a sine curve and a line with a calculator, the enclosed area, the vertical line that splits the area in half (an integral equation solved numerically) and the greatest vertical gap with a derivative argument",
                 ["Solve the equation of the curves for the right endpoint", "Integrate top minus bottom for the area", "Set the integral from 0 to k equal to half the area and solve for k", "Maximize the vertical gap with the derivative and sign change"],
                 [("the line starts at the origin and meets the sine curve once more before the curve returns to zero", "the grid sign scan finds exactly one crossing in (0, m*pi)")], {"type": "text", "must_include": ["curve", "line"]},
                 "the intersection by a 120000-point grid sign scan, the area by the closed-form antiderivative, the bisecting line by a 200000-step cumulative trapezoid scan (independent of Brent's method and quad), and the greatest gap by a grid maximum")


# ------------------------------------------------------------------ 6) 점에서 곡선 y=ln x 까지 최단 거리: 거리 함수·최소화·수직 조건·거리 변화율
def _closest_impl(rng):
    p = rng.choice([3, 4, 5])
    x1 = rng.choice([1, 2])
    x2 = rng.choice([2, 4])
    v = rng.choice([2, 3, 4])
    D = lambda x: math.sqrt((x - p) ** 2 + math.log(x) ** 2)
    Dp = lambda x: ((x - p) + math.log(x) / x) / D(x)
    lo, hi, N = 0.5, 8.0, 150000
    grid = [lo + (hi - lo) * i / N for i in range(N + 1)]
    sc = [i for i in range(N) if Dp(grid[i]) * Dp(grid[i + 1]) < 0]
    if len(sc) != 1 or Dp(lo) >= 0 or Dp(hi) <= 0:
        raise ValueError("bad_design")
    xs = _O.brentq(Dp, grid[sc[0]], grid[sc[0] + 1], xtol=1e-14)
    gmin = min(grid, key=D)
    if abs(gmin - xs) > 2 * (hi - lo) / N:
        raise ValueError("independent_check_failed")
    for x in (x1, x2, xs):
        if abs((D(x + 1e-6) - D(x - 1e-6)) / 2e-6 - Dp(x)) > 1e-6:
            raise ValueError("independent_check_failed")
    xr = round(xs, 3)
    dmin = D(xs)
    d1v, d1p = D(x1), Dp(x1)
    rate = Dp(x2) * v
    ts = 1 / xr
    ss = math.log(xr) / (xr - p)
    prod = ts * ss
    _safe(xs, dmin, d1v, d1p, rate, ts, ss)
    if f3(D(xr)) != f3(dmin) or f3(Dp(x2) * v) != f3(round(Dp(x2), 3) * v) or abs(prod + 1) > 0.01:
        raise ValueError("rounding_boundary")
    if abs(ts - 1 / xs) > 1e-3 or abs(Dp(x2)) < 0.05:
        raise ValueError("bad_design")
    stim = {"kind": "text", "description": "A drone flying above a curved path, a ground station at a fixed point", "data": {"model": f"path y = ln(x), x > 0; station at ({p}, 0); distances in kilometers"}}
    pathtext = "decreasing" if rate < 0 else "increasing"
    parts = [
        part("a", f"A drone flies along the path $y=\\ln x$ for $0.5\\le x\\le 8$, where $x$ and $y$ are in kilometers. A ground station is located at the point $({p},0)$. Let $D(x)$ be the distance, in kilometers, from the station to the drone when the drone is at the point $(x,\\ln x)$. Find $D({x1})$ and $D'({x1})$.", 2, "calculate", ["1.E", "2.C"],
             f"$D(x)=\\sqrt{{(x-{p})^2+(\\ln x)^2}}$, so $D({x1})={f3(d1v)}$ kilometers and $D'({x1})={f3(d1p)}$.",
             [row("a1", 1, "Value of the distance at the given position", [_m(f"D({x1})={f3(d1v)}")], nums=True, tol="±0.001"),
              row("a2", 1, "Value of the derivative of the distance at the given position", [_m(f"D'({x1})={f3(d1p)}")], nums=True, tol="±0.001")]),
        part("b", "Find the value of $x$ for which the drone is closest to the station. Find that least distance and justify your answer.", 3, "explain", ["3.B", "3.E"],
             f"$D'(x)=0$ at $x={f3(xs)}$. $D'$ changes from negative to positive there, and it is the only critical point on the interval, so the least distance is $D({f3(xs)})={f3(dmin)}$ kilometers.",
             [row("b1", 1, "Sets the derivative of the distance equal to zero and solves with a calculator", [_m("D'(x)=0"), _m(f"x={f3(xs)}")], nums=True, both=True, tol="±0.001"),
              row("b2", 1, "Justification: $D'$ changes sign from negative to positive at this value, so the distance has a minimum", [_m("D'") + " changes from negative to positive"], requires="b1"),
              row("b3", 1, "Least distance", [_m(f3(dmin)) + " kilometers"], requires="b2", nums=True, units=True, tol="±0.001")]),
        part("c", "At the point of the path closest to the station, show that the line segment from the station to the drone is perpendicular to the line tangent to the path.", 2, "explain", ["1.E", "3.E"],
             f"The tangent slope is $\\frac{{1}}{{x}}={f3(ts)}$ at $x={f3(xr)}$. The segment from $({p},0)$ to $({f3(xr)},\\ln {f3(xr)})$ has slope $\\frac{{\\ln x}}{{x-{p}}}={f3(ss)}$. The product of the slopes is {f3(prod)}, approximately $-1$, so the lines are perpendicular.",
             [row("c1", 1, "Slope of the tangent line and slope of the segment at the closest point", [_m(f"\\frac{{1}}{{{f3(xr)}}}={f3(ts)}"), _m(f"{f3(ss)}")], nums=True, both=True, tol="±0.001"),
              row("c2", 1, "Conclusion: the product of the slopes is negative one, so the lines are perpendicular", [_m("-1"), "perpendicular"], requires="c1", both=True)]),
        part("d", f"The drone moves along the path so that $x$ is increasing at a constant rate of ${v}$ kilometers per minute. Find the rate at which the distance from the station to the drone is changing at the instant $x={x2}$. Using correct units, state whether the distance is increasing or decreasing.", 2, "calculate", ["1.E", "3.F"],
             f"$\\frac{{dD}}{{dt}}=D'({x2})\\cdot\\frac{{dx}}{{dt}}={f3(Dp(x2))}\\cdot {v}={f3(rate)}$ kilometers per minute, so the distance is {pathtext}.",
             [row("d1", 1, "Uses the chain rule: the rate of the distance is the derivative of D times the rate of x", [_m(f"\\frac{{dD}}{{dt}}=D'({x2})\\cdot\\frac{{dx}}{{dt}}")]),
              row("d2", 1, "Value with units, and whether the distance is increasing or decreasing", [_m(f3(rate)) + " kilometers per minute", pathtext], requires="d1", nums=True, units=True, both=True, tol="±0.001")])]
    for p_, tc in zip(parts, [["3.1"], ["5.10"], ["5.10"], ["4.4"]]):
        p_["topic_codes"] = tc
    return _pack("frq_closest_point", "closest_point_to_curve_calc", "5.10", ["3.1", "4.4"], "3.E", "Closest point on a curved path to a fixed station: distance and its derivative, minimum distance, perpendicular condition, rate of change of distance",
                 stim, parts, [f"p={p}", f"x1={x1}", f"x2={x2}", f"v={v}", f"xs={xs:.6f}", f"dmin={dmin:.6f}", f"D1={d1v:.6f}", f"Dp1={d1p:.6f}", f"rate={rate:.6f}", f"prod={prod:.6f}"],
                 "Minimize the distance from a fixed point to a logarithmic curve with a calculator, justify with the sign of the derivative, verify the perpendicular condition at the minimizer, and find the rate of change of distance as the point moves",
                 ["Write the distance as a function of x and differentiate it", "Solve D' = 0 numerically and use the sign change", "Compare the tangent slope with the segment slope", "Multiply D' by the rate of x for the rate of the distance"],
                 [("D' is negative at the left end and positive at the right end and changes sign exactly once", "the grid sign scan finds one crossing")], {"type": "text", "must_include": ["path formula", "station point"]},
                 "the minimizer by a 150000-point grid minimum of D (independent of Brent's method on D'), the derivative by central difference, and the perpendicular condition by the numeric product of slopes")


STAGE_LISTS = {"supp_r3fa_ab": ["frq_accum_charge", "frq_marginal_profit", "frq_trench_volume", "frq_cooling_check"]}
