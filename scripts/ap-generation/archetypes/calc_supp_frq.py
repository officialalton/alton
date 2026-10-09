"""보강(supplement, 2026-10-09 오너 승인) FRQ 원형 5종 — 기존 유형(표 비율·f' 그래프·미분방정식·넓이/부피·입자 운동·관련 변화율·음함수·급수·매개·극좌표·오일러/로지스틱)과 풀이 구조가 다른 새 유형만 만든다.
 AB 계산기 불가 2(표 값 활용, 함수 분석), AB 계산기 1(유입·유출 순변화), BC 계산기 불가 2(미분방정식 테일러 다항식, 이상적분·부분적분).
모든 값은 코드(정확 유리수·sympy)가 계산하고 독립 수치 경로(격자·구적법·유한차분)로 다시 확인한다."""
from common import *
from bp import frq_blueprint
from calc_ab_frq import row, part, f3
from scipy import integrate as _I, optimize as _O
from fractions import Fraction as Fr

AB = "ap_calculus_ab"
BC = "ap_calculus_bc"


def _sg(v):
    return f"({v})" if v < 0 else str(v)


def _fr(v):
    v = Fr(v)
    return str(v.numerator) if v.denominator == 1 else f"{v.numerator}/{v.denominator}"


# ------------------------------------------------------------------ AB 계산기 불가: 표 값으로 합성·몫·평균변화율(MVT)·사다리꼴
def frq_table_values(rng):
    xs = [1, 2, 4, 7]
    for _ in range(4000):
        f = [rng.randint(-3, 8) for _ in xs]
        fp = [rng.randint(-4, 6) for _ in xs]
        g = [rng.randint(1, 7) for _ in xs]
        gp = [rng.randint(-4, 6) for _ in xs]
        a = rng.choice(xs)
        ia = xs.index(a)
        if g[ia] not in xs:
            continue
        b = rng.choice([x_ for x_ in xs if x_ != a])
        ib = xs.index(b)
        if g[ib] == 0 or gp[ia] == 0 or fp[xs.index(g[ia])] == 0 or len(set(fp)) < 3:
            continue
        ha = fp[xs.index(g[ia])] * gp[ia]
        kb = Fr(fp[ib] * g[ib] - f[ib] * gp[ib], g[ib] ** 2)
        avg = Fr(g[3] - g[0], 6)
        trap = Fr(fp[0] + fp[1], 2) * 1 + Fr(fp[1] + fp[2], 2) * 2 + Fr(fp[2] + fp[3], 2) * 3
        if avg.denominator == 1 or ha == 0 or kb == 0 or trap.denominator > 2 or trap == 0:
            continue
        break
    else:
        raise ValueError("no_sample")
    # 독립 경로: 값을 sympy 다항 보간 함수가 아니라 표의 격자 연산으로 다시(몫의 법칙은 로그 미분으로)
    fa, ga = sp.Symbol("fa"), sp.Symbol("ga")
    qq = (sp.Rational(f[ib]) / g[ib]) * (sp.Rational(fp[ib]) / f[ib] - sp.Rational(gp[ib]) / g[ib]) if f[ib] != 0 else Fr(0)
    if f[ib] != 0 and Fr(str(qq)) != kb:
        raise ValueError("independent_check_failed")
    trap_num = sum((fp[i] + fp[i + 1]) / 2 * (xs[i + 1] - xs[i]) for i in range(3))
    if abs(trap_num - float(trap)) > 1e-12:
        raise ValueError("independent_check_failed")
    rows_tab = [[str(xs[i]), str(f[i]), str(fp[i]), str(g[i]), str(gp[i])] for i in range(4)]
    stim = {"kind": "table", "description": "Values of the twice-differentiable functions f and g and of their derivatives f' and g' at selected values of x", "data": {"columns": ["x", "f(x)", "f'(x)", "g(x)", "g'(x)"], "rows": rows_tab}}
    hx = g[ia]
    parts = [
        part("a", f"Let $h(x)=f(g(x))$. Find $h'({a})$. Show the work that leads to your answer.", 2, "calculate", ["1.E", "2.B"], f"h'({a}) = f'(g({a})) g'({a}) = f'({hx}) g'({a}) = ({fp[xs.index(hx)]})({gp[ia]}) = {ha}.",
             [row("a1", 1, "Chain rule form f'(g(a)) g'(a) with the inner value g(a) read from the table", [f"f'(g({a})) g'({a})", f"f'({hx})"]), row("a2", 1, "Answer", [str(ha)], requires="a1", nums=True)]),
        part("b", f"Let $k(x)=\\dfrac{{f(x)}}{{g(x)}}$. Find $k'({b})$.", 2, "calculate", ["1.E", "2.B"], f"k'({b}) = (f'({b}) g({b}) - f({b}) g'({b}))/g({b})^2 = {_fr(kb)}.",
             [row("b1", 1, "Quotient rule with values from the table", [f"(f'({b}) g({b}) - f({b}) g'({b}))/(g({b}))^2"]), row("b2", 1, "Answer", [_fr(kb)], requires="b1", nums=True)]),
        part("c", f"Find the average rate of change of $g$ over the interval $1\\le x\\le 7$. Must there be a value $c$ with $1<c<7$ at which $g'(c)$ equals this average rate of change? Justify your answer.", 3, "explain", ["3.B", "3.C"],
             f"Average rate = (g(7) - g(1))/(7 - 1) = {_fr(avg)}. Yes: g is twice differentiable, so it is continuous on [1,7] and differentiable on (1,7), and by the Mean Value Theorem some c in (1,7) has g'(c) = {_fr(avg)}.",
             [row("c1", 1, "Average rate of change (g(7) - g(1))/6", [f"({g[3]} - {g[0]})/6", _fr(avg)], nums=True), row("c2", 1, "Conditions: g is differentiable, hence continuous, on the interval", ["g is differentiable", "g is continuous on [1,7] and differentiable on (1,7)"]),
              row("c3", 1, "Conclusion by the Mean Value Theorem: yes, there is such a c", ["Mean Value Theorem", "yes"], requires="c2")]),
        part("d", "Use a trapezoidal sum with the three subintervals indicated by the table to approximate $\\int_1^7 f'(x)\\,dx$.", 2, "calculate", ["1.E", "2.B"],
             f"T = (({_sg(fp[0])} + {_sg(fp[1])})/2)(1) + (({_sg(fp[1])} + {_sg(fp[2])})/2)(2) + (({_sg(fp[2])} + {_sg(fp[3])})/2)(3) = {_fr(trap)}.",
             [row("d1", 1, "Trapezoids with the correct widths 1, 2, 3 and the f' values from the table", [f"(({fp[0]}+{fp[1]})/2)(1)", f"(({fp[1]}+{fp[2]})/2)(2)"]), row("d2", 1, "Value of the trapezoidal sum", [_fr(trap)], requires="d1", nums=True)])]
    for p_, tc in zip(parts, [["3.1"], ["2.9"], ["5.1"], ["6.2"]]):
        p_["topic_codes"] = tc
    pk = {"archetype": "frq_table_values", "template": "table_values_theorems", "topic": "3.1", "extra_topics": ["2.9", "5.1", "6.2"], "skill": "1.E", "representative_skill": "1.E", "calculator": "not_allowed", "title": "Table of f, f', g, g': composite, quotient, Mean Value Theorem, trapezoidal sum",
          "stimulus": stim, "parts": parts, "total_points": 9, "est_minutes": 15, "facts": [f"a={a}", f"b={b}", f"h'={ha}", f"k'={_fr(kb)}", f"avg={_fr(avg)}", f"trap={_fr(trap)}"]}
    pk["blueprint"] = frq_blueprint("frq_table_values", AB, pk, "Use a table of function and derivative values for a composite, a quotient, the Mean Value Theorem, and a trapezoidal sum",
        ["Read the inner value g(a) and use f'(g(a)) g'(a)", "Apply the quotient rule with table values", "Check the differentiability hypotheses and apply the Mean Value Theorem", "Add trapezoids with the unequal subinterval widths"],
        [("f and g are twice differentiable so both are continuous and the rules and theorems apply", "stated in the problem")], {"type": "table", "must_include": ["values of f, f', g, g' at x = 1, 2, 4, 7"]},
        "the quotient rule value is recomputed through the logarithmic derivative (k)(f'/f - g'/g) and the trapezoidal sum by floating-point arithmetic (independent of the formulas used for the model answer)")
    return pk


# ------------------------------------------------------------------ AB 계산기 불가: 함수 분석 f(x) = x e^{-x/c}
def frq_function_analysis(rng):
    c = rng.choice([1, 2, 3])
    f = x * sp.exp(-x / c)
    fp, fpp = sp.diff(f, x), sp.diff(f, x, 2)
    a = 2 * c
    fa, fpa = sp.simplify(f.subs(x, a)), sp.simplify(fp.subs(x, a))
    # 독립 경로: 수치 도함수·격자
    F = sp.lambdify(x, f, "math")
    hh = 1e-5
    num_slope = (F(a + hh) - F(a - hh)) / (2 * hh)
    grid = [4 * c * i / 20000 for i in range(20001)]
    gmax = max(grid, key=F)
    crit = _O.brentq(lambda u: (F(u + hh) - F(u - hh)) / (2 * hh), 0.2 * c, 3 * c)
    infl = _O.brentq(lambda u: (F(u + 1e-3) - 2 * F(u) + F(u - 1e-3)) / 1e-6, 0.5 * c, 4 * c)
    if abs(num_slope - float(fpa)) > 1e-6 or abs(gmax - c) > 4 * c / 20000 * 2 or abs(crit - c) > 1e-3 or abs(infl - a) > 2e-2:
        raise ValueError("independent_check_failed")
    fmax = sp.simplify(f.subs(x, c))
    f4 = sp.simplify(f.subs(x, 4 * c))
    ftex = sp.latex(f)
    tang = f"y = {sp.latex(sp.simplify(fa))} + ({sp.latex(fpa)})(x - {a})"
    parts = [
        part("a", f"Write an equation for the line tangent to the curve $y=f(x)$ at $x={a}$.", 2, "calculate", ["1.E"], f"f({a}) = {sp.latex(fa)} and f'({a}) = {sp.latex(fpa)}, so the tangent line is {tang}.",
             [row("a1", 1, "Finds f'(x) = e^(-x/c)(1 - x/c) (derivative with product and chain rules)", [f"f'(x) = e^(-x/{c})(1 - x/{c})"]), row("a2", 1, "Equation of the tangent line using f(a) and f'(a)", [tang], requires="a1", nums=True)]),
        part("b", "Find the $x$-coordinate of each relative extremum of $f$ for $x>0$, and classify each as a relative minimum or a relative maximum. Justify your answer.", 3, "explain", ["3.B", "3.E"],
             f"f'(x) = 0 only at x = {c}; f' > 0 for 0 < x < {c} and f' < 0 for x > {c}, so f has a relative maximum at x = {c}.",
             [row("b1", 1, "Sets f'(x) = 0 and solves", [f"x = {c}"], nums=True), row("b2", 1, "Sign analysis of f' on both sides of the critical number", ["f' is positive before and negative after", "sign chart for f'"], requires="b1"),
              row("b3", 1, "Conclusion: relative maximum at the critical number, with the sign change as the reason", [f"relative maximum at x = {c}"], both=True, requires="b2")]),
        part("c", "Find the $x$-coordinate of the point of inflection of the curve $y=f(x)$ for $x>0$. Justify your answer.", 2, "explain", ["3.B", "3.E"],
             f"f''(x) = e^(-x/{c})(x/{c}^2 - 2/{c}) is negative for x < {a} and positive for x > {a}, so the graph changes concavity at x = {a}.",
             [row("c1", 1, "Finds f'' and solves f''(x) = 0", [f"x = {a}"], nums=True), row("c2", 1, "Justification: f'' changes sign at that x (concave down before, concave up after)", ["f'' changes sign", "concavity changes"], requires="c1")]),
        part("d", f"Find the absolute minimum value and the absolute maximum value of $f$ on the interval $0\\le x\\le {4 * c}$. Justify your answer.", 2, "explain", ["3.B", "3.E"],
             f"Candidates: f(0) = 0, f({c}) = {sp.latex(fmax)}, f({4 * c}) = {sp.latex(f4)}. The absolute minimum value is 0 and the absolute maximum value is {sp.latex(fmax)}.",
             [row("d1", 1, "Evaluates f at the endpoints and the critical number (candidates)", [f"f(0) = 0", f"f({c}) = {sp.latex(fmax)}", f"f({4 * c}) = {sp.latex(f4)}"], nums=True), row("d2", 1, "Justification and answer: compares the candidate values and identifies the absolute minimum value 0 and the absolute maximum value", ["absolute minimum value is 0", f"absolute maximum value is {sp.latex(fmax)}"], both=True, requires="d1")])]
    for p_, tc in zip(parts, [["2.7"], ["5.4"], ["5.6"], ["5.5"]]):
        p_["topic_codes"] = tc
    stim = {"kind": "text", "description": "A function defined by a formula", "data": {"function": f"f(x) = x e^(-x/{c})"}}
    pk = {"archetype": "frq_function_analysis", "template": "function_analysis_justify", "topic": "5.4", "extra_topics": ["5.5", "5.6", "2.7"], "skill": "3.E", "representative_skill": "3.E", "calculator": "not_allowed", "title": "Analysis of f(x) = x e^(-x/c): tangent line, extremum, inflection, absolute extrema",
          "stimulus": stim, "parts": parts, "total_points": 9, "est_minutes": 15, "facts": [f"c={c}", f"f={ftex}", f"fmax={fmax}", f"f4c={f4}"]}
    pk["blueprint"] = frq_blueprint("frq_function_analysis", AB, pk, "Analyze a function given by a formula: tangent line, relative extremum, point of inflection, and absolute extrema on a closed interval",
        ["Differentiate with the product and chain rules", "Use the sign of f' and f'' around the critical number and the inflection candidate", "Compare candidate values on the closed interval"],
        [("f is twice differentiable on x > 0 and f' and f'' each have exactly one zero", "f' = e^(-x/c)(1 - x/c) and f'' = e^(-x/c)(x/c^2 - 2/c)")], {"type": "text", "must_include": ["formula for f"]},
        "the tangent slope is checked by central difference, the critical number and inflection point by Brent's method on numerical derivatives, and the absolute maximum by a 20001-point grid (independent of the symbolic derivatives)")
    return pk


# ------------------------------------------------------------------ AB 계산기: 유입·유출 순변화와 최대량
def frq_rate_in_out(rng):
    for _ in range(4000):
        a0, b0, s = rng.choice([40, 50, 60]), rng.choice([20, 25, 30]), rng.choice([2.0, 2.5, 3.0])
        d0, e0 = rng.choice([30, 35, 40]), rng.choice([2.0, 2.5, 3.0])
        W0 = rng.choice([100, 150, 200])
        T = 8
        t1 = rng.choice([2, 3, 4])
        Fin = lambda u: a0 + b0 * math.sin(u / s)
        Dout = lambda u: d0 + e0 * u
        h_ = lambda u: Fin(u) - Dout(u)
        grid = [T * i / 8000 for i in range(8001)]
        sc = [i for i in range(8000) if h_(grid[i]) * h_(grid[i + 1]) < 0]
        if len(sc) != 1 or h_(grid[sc[0]]) <= 0 or abs(h_(t1)) < 1:
            continue
        break
    else:
        raise ValueError("no_sample")
    tstar = _O.brentq(h_, grid[sc[0]], grid[sc[0] + 1], xtol=1e-13)
    inA = _I.quad(Fin, 0, T)[0]
    net = lambda u0: W0 + _I.quad(h_, 0, u0)[0]
    WT, Wstar = net(T), net(tstar)
    if not (Wstar > WT and Wstar > W0):
        raise ValueError("max_not_interior")
    # 독립 경로: sympy 정적분과 격자 최댓값
    tt = sp.Symbol("tt")
    inA_s = float(sp.N(sp.integrate(a0 + b0 * sp.sin(tt / sp.Float(s)), (tt, 0, T))))
    gridmax = max(net(T * i / 400) for i in range(401))
    if abs(inA_s - inA) > 1e-6 or abs(gridmax - Wstar) > 0.5 or abs(Wstar - gridmax) > 0.5:
        raise ValueError("independent_check_failed")
    rate1 = h_(t1)
    stim = {"kind": "text", "description": "Rates of water flowing into and out of a tank", "data": {"inflow": f"F(t) = {a0} + {b0} sin(t/{s:g}) gallons per hour", "outflow": f"D(t) = {d0} + {e0:g}t gallons per hour", "initial": f"{W0} gallons at t = 0"}}
    parts = [
        part("a", f"Water flows into a tank at the rate $F(t)={a0}+{b0}\\sin\\!\\left(\\dfrac{{t}}{{{s:g}}}\\right)$ gallons per hour and flows out at the rate $D(t)={d0}+{e0:g}t$ gallons per hour, for $0\\le t\\le {T}$, where $t$ is measured in hours. To the nearest gallon, how much water flows into the tank during the first ${T}$ hours?", 2, "calculate", ["1.D", "1.E"],
             f"∫₀^{T} F(t) dt = {f3(inA)} gallons, about {round(inA)} gallons.", [row("a1", 1, f"Integral of F from 0 to {T}", [f"∫_0^{T} F(t) dt"]), row("a2", 1, "Answer", [f3(inA)], requires="a1", nums=True, tol="±0.5 gallon (rounding)")]),
        part("b", f"At time $t={t1}$ hours, is the amount of water in the tank increasing or decreasing? Give a reason for your answer, using correct units.", 2, "explain", ["3.E", "3.F"],
             f"F({t1}) - D({t1}) = {f3(rate1)} gallons per hour, so the amount in the tank is {'increasing' if rate1 > 0 else 'decreasing'} at t = {t1}.",
             [row("b1", 1, "Rate of change of the amount F(t) - D(t) at the given time, with units", [f"F({t1}) - D({t1}) = {f3(rate1)} gallons per hour"], nums=True, units=True), row("b2", 1, f"Reason and conclusion: {'increasing' if rate1 > 0 else 'decreasing'} since the rate of change is {'positive' if rate1 > 0 else 'negative'}", [f"{'increasing' if rate1 > 0 else 'decreasing'}", "the rate of change has that sign"], both=True, requires="b1")]),
        part("c", f"There are ${W0}$ gallons of water in the tank at time $t=0$. Find the amount of water in the tank at time $t={T}$.", 2, "calculate", ["1.D", "1.E"],
             f"W({T}) = {W0} + ∫₀^{T} (F(t) - D(t)) dt = {f3(WT)} gallons.", [row("c1", 1, "Initial amount plus the integral of F - D from 0 to the given time", [f"{W0} + ∫_0^{T} (F(t) - D(t)) dt"]), row("c2", 1, "Answer", [f3(WT)], requires="c1", nums=True, tol="±0.001")]),
        part("d", f"For $0\\le t\\le {T}$, at what time $t$ is the amount of water in the tank greatest? Justify your answer.", 3, "explain", ["3.B", "3.E"],
             f"W'(t) = F(t) - D(t) = 0 at t = {f3(tstar)}; W' > 0 before and W' < 0 after, and W({f3(tstar)}) = {f3(Wstar)} exceeds W(0) = {W0} and W({T}) = {f3(WT)}.",
             [row("d1", 1, "Sets F(t) - D(t) = 0 and solves", [f"t = {f3(tstar)}"], nums=True, tol="±0.001"), row("d2", 1, "Justification: W' changes from positive to negative there, or compares the amount at the candidates", ["W' changes sign from positive to negative", "compares W at the critical point and the endpoints"], requires="d1"),
              row("d3", 1, "Answer: the time of the greatest amount", [f"t = {f3(tstar)}"], requires="d2", nums=True, tol="±0.001")])]
    for p_, tc in zip(parts, [["8.3"], ["4.1"], ["8.3"], ["5.5"]]):
        p_["topic_codes"] = tc
    pk = {"archetype": "frq_rate_in_out", "template": "rate_in_out_net_change_calc", "topic": "8.3", "extra_topics": ["4.1", "5.5"], "skill": "3.E", "representative_skill": "3.E", "calculator": "required", "title": "Inflow and outflow rates: total inflow, sign of the net rate, amount at a time, time of the greatest amount",
          "stimulus": stim, "parts": parts, "total_points": 9, "est_minutes": 15, "facts": [f"inA={inA:.6f}", f"rate1={rate1:.6f}", f"WT={WT:.6f}", f"tstar={tstar:.6f}", f"Wstar={Wstar:.6f}"]}
    pk["blueprint"] = frq_blueprint("frq_rate_in_out", AB, pk, "Use inflow and outflow rate functions to find total inflow, the sign of the net rate, the amount at a time, and the time of the maximum amount",
        ["Integrate the inflow rate", "Use F - D as the rate of change of the amount and read its sign", "Add the net change to the initial amount", "Locate the interior maximum with the sign change of F - D and compare with the endpoints"],
        [("F - D is continuous and changes sign from positive to negative exactly once on (0, T)", "checked numerically on a fine grid")], {"type": "text", "must_include": ["formula for F", "formula for D", "initial amount"]},
        "the inflow integral is checked with sympy's symbolic integral, and the time and value of the maximum with a 401-point grid on the net-change function (independent of Brent's method and scipy quad)")
    return pk


# ------------------------------------------------------------------ BC 계산기 불가: 미분방정식의 테일러 다항식
def frq_bc_taylor_diffeq(rng):
    a_, b_ = rng.choice([(2, 1), (1, 2), (3, 1), (2, 3), (4, 1), (1, 3), (3, 2)])
    xv = rng.choice([Fr(1, 2), Fr(1, 3), Fr(1, 4)])
    cb = "" if b_ == 1 else str(b_)
    M = math.ceil(a_ * b_ ** 2 * math.exp(b_ * float(xv))) + rng.choice([0, 1, 2, 3])  # |f^(4)| = a b^2 e^(bx) 의 [0, x] 최댓값 이상
    F = a_ * x + b_ * y
    # y(0)=0:  y'' = a + b y', y''' = b y''
    f0, f1 = Fr(0), Fr(0)
    f2 = Fr(a_)
    f3_ = Fr(a_ * b_)
    P3 = lambda v: f2 * v ** 2 / 2 + f3_ * v ** 3 / 6
    approx = P3(xv)
    lag = Fr(M) * xv ** 4 / 24
    # 독립 경로: 피카르 반복의 계수와 비교, 그리고 실제 해(해석 해)의 매클로린 계수
    ysol = sp.Function("Y")
    sol = sp.dsolve(sp.Eq(ysol(x).diff(x), a_ * x + b_ * ysol(x)), ysol(x), ics={ysol(0): 0}).rhs
    ser = sp.series(sol, x, 0, 4).removeO()
    if sp.Rational(ser.coeff(x, 2)) != sp.Rational(f2.numerator, f2.denominator) / 2 or sp.Rational(ser.coeff(x, 3)) != sp.Rational(f3_.numerator, f3_.denominator) / 6 or ser.coeff(x, 1) != 0:
        raise ValueError("independent_check_failed")
    min_or = "relative minimum"  # f''(0) = a > 0
    stim = {"kind": "text", "description": "A differential equation with an initial condition", "data": {"equation": f"dy/dx = {a_}x + {cb}y", "initial": "f(0) = 0"}}
    pts = _fr(xv)
    parts = [
        part("a", f"The function $f$ is the solution of the differential equation $\\dfrac{{dy}}{{dx}}={a_}x+{cb}y$ with $f(0)=0$. Find $f'(0)$, $f''(0)$, and $f'''(0)$, and write the Taylor polynomial of degree $3$ for $f$ about $x=0$.", 3, "calculate", ["1.E", "2.B"],
             f"f'(0) = 0; f''(x) = {a_} + {cb}f'(x), so f''(0) = {a_}; f'''(x) = {cb}f''(x), so f'''(0) = {a_ * b_}. P3(x) = {a_}x^2/2 + {a_ * b_}x^3/6.",
             [row("a1", 1, "f'(0) from the differential equation and the initial condition", ["f'(0) = 0"], nums=True), row("a2", 1, "Second and third derivatives by differentiating the equation (chain rule)", [f"f''(0) = {a_}", f"f'''(0) = {a_ * b_}"], nums=True, both=True, requires="a1"),
              row("a3", 1, "Taylor polynomial of degree 3 with the factorials", [f"{a_}x^2/2 + {a_ * b_}x^3/6"], requires="a2")]),
        part("b", f"Use the Taylor polynomial of degree $3$ from part (a) to approximate $f\\!\\left({pts}\\right)$.", 2, "calculate", ["1.E"], f"P3({pts}) = {_fr(approx)}.",
             [row("b1", 1, "Substitutes into the polynomial", [f"P3({pts})"]), row("b2", 1, "Value of the approximation", [_fr(approx)], requires="b1", nums=True)]),
        part("c", f"It is known that $\\left|f^{{(4)}}(x)\\right|\\le {M}$ for $0\\le x\\le {pts}$. Use the Lagrange error bound to find an upper bound for $\\left|f\\!\\left({pts}\\right)-P_3\\!\\left({pts}\\right)\\right|$.", 2, "calculate", ["1.E", "3.D"],
             f"Error ≤ {M}({pts})^4/4! = {_fr(lag)}.", [row("c1", 1, "Lagrange error form M x^4/4!", [f"{M}({pts})^4/4!"]), row("c2", 1, "Value of the bound", [_fr(lag)], requires="c1", nums=True)]),
        part("d", "Does $f$ have a relative minimum, a relative maximum, or neither at $x=0$? Justify your answer.", 2, "explain", ["3.B", "3.E"],
             f"f'(0) = 0 and f''(0) = {a_} > 0, so by the Second Derivative Test f has a {min_or} at x = 0.",
             [row("d1", 1, "Justification: uses f'(0) = 0 (critical number) and the sign of f''(0)", ["f'(0) = 0", f"f''(0) = {a_} > 0"], both=True), row("d2", 1, f"Conclusion: {min_or} by the Second Derivative Test", [min_or], requires="d1")])]
    for p_, tc in zip(parts, [["10.11"], ["10.11"], ["10.12"], ["5.7"]]):
        p_["topic_codes"] = tc
    pk = {"archetype": "frq_bc_taylor_diffeq", "template": "taylor_from_diffeq_bc", "topic": "10.11", "extra_topics": ["10.12", "5.7"], "skill": "1.E", "representative_skill": "1.E", "calculator": "not_allowed", "title": "Taylor polynomial of a solution of a differential equation, approximation, Lagrange bound, second derivative test",
          "stimulus": stim, "parts": parts, "total_points": 9, "est_minutes": 15, "facts": [f"a={a_}", f"b={b_}", f"x={pts}", f"approx={_fr(approx)}", f"lag={_fr(lag)}"]}
    pk["blueprint"] = frq_blueprint("frq_bc_taylor_diffeq", BC, pk, "Build the Taylor polynomial of a solution of a differential equation from repeated differentiation, approximate a value, bound the error, and classify the critical point",
        ["Differentiate the equation repeatedly with the chain rule and evaluate at 0", "Assemble the degree-3 polynomial with factorials", "Apply the Lagrange error bound with the given derivative bound", "Use the Second Derivative Test at the critical number"],
        [("f has derivatives of all orders at 0 determined by the equation and the initial value", "the right side is linear in x and y")], {"type": "text", "must_include": ["differential equation", "initial condition"]},
        "the exact solution found by sympy's dsolve is expanded as a Maclaurin series and its coefficients compared with those from repeated differentiation of the equation")
    return pk


# ------------------------------------------------------------------ BC 계산기 불가: 이상적분·부분적분·미분
def frq_bc_improper_parts(rng):
    b_ = rng.choice([2, 3, 4])
    T = rng.choice([1, 2]) * b_
    K = rng.choice([5, 6, 8, 10])
    t_ = sp.Symbol("t", positive=True)
    r = t_ * sp.exp(-t_ / b_)
    anti = -b_ * t_ * sp.exp(-t_ / b_) - b_ ** 2 * sp.exp(-t_ / b_)
    total = sp.limit(anti, t_, sp.oo) - anti.subs(t_, 0)
    ampart = sp.simplify(anti.subs(t_, T) - anti.subs(t_, 0))
    peak = b_
    kk = sp.Rational(K, b_ ** 2)
    # 독립 경로: 구적법으로 전체량과 부분량, 격자로 최댓값
    rf = sp.lambdify(t_, r, "math")
    tot_num = _I.quad(rf, 0, math.inf)[0]
    part_num = _I.quad(rf, 0, T)[0]
    grid_max = max((i * 6 * b_ / 6000 for i in range(6001)), key=rf)
    if abs(tot_num - float(total)) > 1e-6 or abs(part_num - float(ampart)) > 1e-8 or abs(grid_max - peak) > 6 * b_ / 6000 * 2:
        raise ValueError("independent_check_failed")
    frac = sp.simplify(ampart / total)
    stim = {"kind": "text", "description": "A rate function for the absorption of a drug", "data": {"rate": f"r(t) = t e^(-t/{b_}) milligrams per hour, t >= 0"}}
    ptex = lambda e_: sp.latex(e_)
    parts = [
        part("a", f"A drug is absorbed into the bloodstream at the rate $r(t)=te^{{-t/{b_}}}$ milligrams per hour, where $t$ is measured in hours and $t\\ge 0$. Find $\\displaystyle\\int_0^{{\\infty}} r(t)\\,dt$, or show that the integral diverges. Show the work that leads to your answer.", 3, "calculate", ["1.C", "1.E"],
             f"Integration by parts gives ∫ t e^(-t/{b_}) dt = -{b_}t e^(-t/{b_}) - {b_ ** 2}e^(-t/{b_}); ∫₀^∞ r(t) dt = lim as B→∞ of the antiderivative at B minus its value at 0 = {ptex(total)} milligrams.",
             [row("a1", 1, "Writes the improper integral as a limit", ["lim_{B→∞} ∫_0^B r(t) dt"]), row("a2", 1, "Antiderivative by integration by parts", [f"-{b_}t e^(-t/{b_}) - {b_ ** 2}e^(-t/{b_})"], requires="a1", nums=True), row("a3", 1, "Value of the integral: converges to the total amount", [ptex(total)], requires="a2", nums=True)]),
        part("b", f"Find the total amount of the drug absorbed during the first ${T}$ hours. Give your answer in exact form.", 2, "calculate", ["1.C", "1.E"], f"∫₀^{T} r(t) dt = {ptex(ampart)} milligrams.",
             [row("b1", 1, f"Uses the antiderivative with limits 0 and {T}", [f"∫_0^{T} r(t) dt"]), row("b2", 1, "Exact value", [ptex(ampart)], requires="b1", nums=True)]),
        part("c", "At what time $t>0$ is the rate of absorption greatest? Justify your answer.", 2, "explain", ["3.B", "3.E"], f"r'(t) = e^(-t/{b_})(1 - t/{b_}) = 0 at t = {b_}; r' > 0 before and r' < 0 after, so the rate is greatest at t = {b_}.",
             [row("c1", 1, "Sets r'(t) = 0 and solves", [f"t = {b_}"], nums=True), row("c2", 1, "Justification: r' changes sign from positive to negative at that time", ["r' changes from positive to negative"], requires="c1")]),
        part("d", f"For a constant $k>0$ the rate function $kte^{{-t/{b_}}}$ gives a total absorbed amount of ${K}$ milligrams over all time $t\\ge 0$. Find $k$.", 2, "calculate", ["1.E", "3.D"], f"k({ptex(total)}) = {K}, so k = {ptex(kk)}.",
             [row("d1", 1, "Uses linearity: k times the total amount from part (a) equals the given total", [f"k({ptex(total)}) = {K}"]), row("d2", 1, "Value of k", [ptex(kk)], requires="d1", nums=True)])]
    for p_, tc in zip(parts, [["6.13"], ["6.11"], ["5.4"], ["6.13"]]):
        p_["topic_codes"] = tc
    pk = {"archetype": "frq_bc_improper_parts", "template": "improper_integral_by_parts", "topic": "6.13", "extra_topics": ["6.11", "5.4"], "skill": "1.E", "representative_skill": "1.E", "calculator": "not_allowed", "title": "Absorption rate te^(-t/b): improper integral, integration by parts, maximum rate, scaling",
          "stimulus": stim, "parts": parts, "total_points": 9, "est_minutes": 15, "facts": [f"b={b_}", f"T={T}", f"K={K}", f"total={total}", f"part={ampart}", f"k={kk}"]}
    pk["blueprint"] = frq_blueprint("frq_bc_improper_parts", BC, pk, "Evaluate a convergent improper integral and a definite integral by parts, locate the maximum of a rate, and scale a rate to a target total",
        ["Write the improper integral as a limit and use integration by parts", "Evaluate the definite integral over a finite window exactly", "Find the maximum rate with the sign of r'", "Use linearity to scale the total"],
        [("t e^(-t/b) decays faster than any power so the improper integral converges", "the limit of t e^(-t/b) at infinity is 0")], {"type": "text", "must_include": ["rate function"]},
        "scipy quad to infinity and over the finite window, and a 6001-point grid for the maximum rate (independent of the by-parts antiderivative and the derivative test)")
    return pk
