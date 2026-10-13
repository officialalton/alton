"""예비 3차(R3-A, 2026-10-12): 계산기 필수 MC 원형 4군 — 단원 6·7·8과 스킬 3(정당화·의미 해석) 문항. 오답 값은 해설에 적은 실수를 코드로 그대로 계산한다."""
from gcommon import *
from scipy import optimize as _O, integrate as _I
from calc_graph_d import dopts, _ax, _curve_line, _curve_line_stim
from calc_r3_a1 import _nbp, _gbp, _bis
from calc_r3_a3 import _roots
import math

XS5 = [0, 2, 4, 6, 8]


def _iv(p):
    return "$(%.3f,%.3f)$" % p


# 6.5 적분 함수가 증가하는 구간(피적분함수의 부호): F(x) = ∫_0^x (t e^{-t/b} - c) dt
def c_accum_increasing_interval_calc(rng):
    c, b = rng.choice([0.4, 0.5, 0.6]), rng.choice([2, 3])
    f = lambda t_: t_ * math.exp(-t_ / b) - c
    rts = _roots(f, 0.0, 8.0, 8000)
    if len(rts) != 2:
        raise ValueError("unexpected_roots")
    r1, r2 = rts
    sg = [f(u) > 0 for u in (r1 / 2, (r1 + r2) / 2, (r2 + 8) / 2)]  # 독립 경로: 구간별 부호 표본
    if sg != [False, True, False]:
        raise ValueError("independent_check_failed")
    key = Opt(_iv((r1, r2)), True, f"$F'(x)=f(x)=xe^{{-x/{b}}}-{c:g}$ is positive between its two zeros $x={r1:.3f}$ and $x={r2:.3f}$ (calculator), so $F$ is increasing on $({r1:.3f},{r2:.3f})$.", None)
    ds = [Opt(_iv((0.0, r1)), False, f"On $(0,{r1:.3f})$ the integrand is negative ($f(0)=-{c:g}$), so $F$ is decreasing there, not increasing.", None),
          Opt(_iv((r2, 8.0)), False, f"After the second zero $x={r2:.3f}$ the integrand is negative, so $F$ is decreasing on $({r2:.3f},8)$.", None),
          Opt(_iv((0.0, r2)), False, f"This interval includes $(0,{r1:.3f})$, where the integrand is negative and $F$ is decreasing.", None)]
    stem = f"Let $F(x)=\\int_0^x\\left(te^{{-t/{b}}}-{c:g}\\right)dt$ for $0\\le x\\le 8$. On which interval is $F$ increasing?"
    bpr = _nbp("c_accum_increasing_interval_calc", "6.5", "3.E", "Determine where an accumulation function increases from the sign of its integrand, locating zeros with a calculator",
               ["Use F' = f, the integrand", "Find the zeros of the integrand numerically with a calculator", "F increases where the integrand is positive"],
               [("F is differentiable with F' equal to the integrand", "Fundamental Theorem of Calculus; the integrand is continuous")],
               [("decreasing_part", "uses an interval where the integrand is negative"), ("after_second_zero", "picks the interval after the second zero"), ("includes_negative_part", "starts at 0")],
               "sign of the integrand sampled inside each of the three intervals (independent of the root-finding)")
    return pack("c_accum_increasing_interval_calc", "6.5", "3.E", "required", stem, key, ds, rng, est=100, facts=[f"b={b}", f"c={c}", f"roots={rts}"], extra={"blueprint": bpr})


# 6.5 적분 함수의 절댓값 최대가 되는 x: 후보 0, r2, 8 의 F 값 비교
def c_accum_abs_max_x_calc(rng):
    for _ in forever():
        c, b = rng.choice([0.35, 0.4, 0.45, 0.5, 0.6]), rng.choice([2, 3])
        f = lambda t_: t_ * math.exp(-t_ / b) - c
        rts = _roots(f, 0.0, 8.0, 8000)
        if len(rts) != 2:
            continue
        r1, r2 = rts
        F = lambda u: _I.quad(f, 0, u)[0]
        F2, F8, Fr1 = F(r2), F(8.0), F(r1)
        if abs(F2) < 0.05:
            continue
        break
    key = r2 if F2 > 0 else 0.0
    simp = numeric_integral(f, 0, r2, 20001)  # 독립 경로: F(r2) 를 심프슨 합으로
    if abs(simp - F2) > 1e-6:
        raise ValueError("independent_check_failed")
    texts = {0.0: "0", r1: f"{r1:.3f}", r2: f"{r2:.3f}", 8.0: "8"}
    why = {}
    why[r1] = f"$x={r1:.3f}$ is where $F$ has a relative minimum: $F'$ changes from negative to positive there and $F({r1:.3f})={Fr1:.3f}$."
    why[8.0] = f"$F(8)={F8:.3f}$ is less than $F({r2:.3f})={F2:.3f}$ because $F$ is decreasing on $({r2:.3f},8)$."
    why[r2] = f"$F({r2:.3f})={F2:.3f}$ is less than $F(0)=0$, so the maximum is not at $x={r2:.3f}$." if F2 <= 0 else ""
    why[0.0] = f"$F(0)=0$ is less than $F({r2:.3f})={F2:.3f}$, so the maximum is not at $x=0$." if F2 > 0 else ""
    opts_ = {p: Opt("$%.3f$" % p, p == key, why.get(p, ""), p) for p in (0.0, r1, r2, 8.0)}
    kk = opts_[key]
    kk.why = (f"The integrand $f$ is negative on $(0,{r1:.3f})$, positive on $({r1:.3f},{r2:.3f})$ and negative on $({r2:.3f},8)$. Candidates for the absolute maximum of $F$: $F(0)=0$, $F({r2:.3f})={F2:.3f}$ and $F(8)={F8:.3f}$ (calculator), so the largest value is at $x={key:.3f}$.")
    ds = [o for p, o in opts_.items() if p != key]
    stem = f"Let $F(x)=\\int_0^x\\left(te^{{-t/{b}}}-{c:g}\\right)dt$ for $0\\le x\\le 8$. At what value of $x$ does $F$ attain its absolute maximum on the closed interval $[0,8]$?"
    bpr = _nbp("c_accum_abs_max_x_calc", "6.5", "3.E", "Locate the absolute maximum of an accumulation function on a closed interval by comparing candidate values",
               ["Use F' = f and find where the integrand changes sign with a calculator", "List the candidates: the endpoints and the point where F' changes from positive to negative", "Compare F at the candidates using integrals evaluated with a calculator"],
               [("F is continuous on [0, 8], so the Extreme Value Theorem guarantees an absolute maximum", "F' = f is continuous")],
               [("relative_minimum", "picks the first zero of the integrand"), ("endpoint_without_comparison", "picks the right endpoint without comparing"), ("left_endpoint_or_critical_point", "picks the wrong candidate")],
               "composite Simpson rule (20001 nodes) for F at the candidate point (independent of scipy quad)")
    return pack("c_accum_abs_max_x_calc", "6.5", "3.E", "required", stem, kk, ds, rng, est=115, facts=[f"b={b}", f"c={c}", f"key={key:.6f}"], extra={"blueprint": bpr})


_FTWO = [(lambda t_: math.log(t_ * t_ + 1), "\\ln\\left(t^{2}+1\\right)"), (lambda t_: math.exp(-t_ * t_ / 10), "e^{-t^{2}/10}"), (lambda t_: math.sqrt(t_ ** 3 + 2), "\\sqrt{t^{3}+2}"), (lambda t_: math.sin(t_) + 2, "\\sin t+2")]


# 6.4 위·아래 끝이 모두 변수인 적분의 도함수: G(x) = ∫_x^{2x} f(t) dt
def c_ftc_two_limits_calc(rng):
    f_, ftex = rng.choice(_FTWO)
    a = rng.choice([1.0, 1.2, 1.5, 2.0])
    key = 2 * f_(2 * a) - f_(a)
    G = lambda u: _I.quad(f_, u, 2 * u)[0]
    hh = 1e-5  # 독립 경로: 적분 함수 자체의 중심차분
    if abs((G(a + hh) - G(a - hh)) / (2 * hh) - key) > 1e-5:
        raise ValueError("independent_check_failed")
    ds = [(f"Forgets the chain-rule factor $2$ for the upper limit, giving $f(2a)-f(a)$ at $a={a:g}$.", f_(2 * a) - f_(a)), (f"Adds the lower-limit term instead of subtracting it, giving $2f(2a)+f(a)$ at $a={a:g}$.", 2 * f_(2 * a) + f_(a)),
          (f"Uses only the upper limit, giving $2f(2a)$ at $a={a:g}$.", 2 * f_(2 * a)), (f"Evaluates $G({a:g})$, the value of the integral, instead of its derivative.", G(a))]
    pool = dopts(ds, key)
    stem = f"Let $G(x)=\\int_x^{{2x}}{ftex.replace('t', 't')[:0]}f(t)\\,dt$ where $f(t)={ftex}$. What is the value of $G'({a:g})$?"
    kk = Opt(dec(key), True, f"By the Fundamental Theorem and the chain rule, $G'(x)=2f(2x)-f(x)$. At $x={a:g}$ this is $2f({2 * a:g})-f({a:g})={key:.3f}$ (calculator).", key)
    bpr = _nbp("c_ftc_two_limits_calc", "6.4", "1.D", "Differentiate an integral whose upper and lower limits are both functions of x",
               ["Split the roles of the two limits: upper limit 2x contributes f(2x) times 2, lower limit x contributes minus f(x)", "Apply the Fundamental Theorem with the chain rule", "Evaluate with a calculator"],
               [("f is continuous, so the Fundamental Theorem applies to each limit", "f is continuous for all t")],
               [("missing_chain_factor", "forgets the factor 2"), ("wrong_sign", "adds the lower-limit term"), ("upper_only", "ignores the lower limit"), ("value_not_derivative", "evaluates G itself")],
               "central difference (step 1e-5) of G computed by numerical quadrature (independent of the Fundamental Theorem)")
    return pack("c_ftc_two_limits_calc", "6.4", "1.D", "required", stem, kk, pool, rng, est=95, facts=[f"f={ftex}", f"a={a}", f"key={key:.6f}"], extra={"blueprint": bpr})


_FTRAP = [(lambda t_: math.log(t_ * t_ + 1), "\\ln\\left(x^{2}+1\\right)"), (lambda t_: math.exp(-t_ * t_ / 4), "e^{-x^{2}/4}"), (lambda t_: math.sqrt(1 + t_ ** 3), "\\sqrt{1+x^{3}}"), (lambda t_: t_ * math.exp(-t_ / 2), "xe^{-x/2}")]


# 6.2 사다리꼴 합(4 등분)과 참값의 구분
def c_trapezoid_formula_calc(rng):
    f_, ftex = rng.choice(_FTRAP)
    lo, hi = rng.choice([(0, 2), (0, 4), (1, 3), (0, 3)])
    n = 4
    w = (hi - lo) / n
    pts = [lo + w * i for i in range(n + 1)]
    trap = w * (f_(pts[0]) / 2 + sum(f_(p) for p in pts[1:-1]) + f_(pts[-1]) / 2)
    left = w * sum(f_(p) for p in pts[:-1])
    right = w * sum(f_(p) for p in pts[1:])
    mid = w * sum(f_((pts[i] + pts[i + 1]) / 2) for i in range(n))
    exact = _I.quad(f_, lo, hi)[0]
    if abs((left + right) / 2 - trap) > 1e-12:  # 독립 경로: 좌·우 합의 평균
        raise ValueError("independent_check_failed")
    ds = [(f"Uses the left Riemann sum $\\Delta x\\,[f(x_0)+f(x_1)+f(x_2)+f(x_3)]$ instead of the trapezoidal sum, giving ${left:.3f}$.", left), (f"Uses the right Riemann sum, giving ${right:.3f}$.", right),
          (f"Uses the midpoint sum, evaluating $f$ at the middle of each subinterval, giving ${mid:.3f}$.", mid), (f"Gives the exact value of the integral, ${exact:.3f}$, instead of the approximation.", exact),
          ("Forgets the factor $\\frac{1}{2}$ on both end values and adds all five values times the width.", w * sum(f_(p) for p in pts))]
    pool = dopts(ds, trap)
    stem = f"The trapezoidal sum with $4$ subintervals of equal length is used to approximate $\\int_{{{lo}}}^{{{hi}}}{ftex}\\,dx$. What is the value of the approximation?"
    kk = Opt(dec(trap), True, f"Each subinterval has width ${w:g}$, so the trapezoidal sum is $\\dfrac{{{w:g}}}{{2}}\\left[f({pts[0]:g})+2f({pts[1]:g})+2f({pts[2]:g})+2f({pts[3]:g})+f({pts[4]:g})\\right]={trap:.3f}$ (calculator).", trap)
    bpr = _nbp("c_trapezoid_formula_calc", "6.2", "1.E", "Compute a trapezoidal sum with equal subintervals for a function given by a formula",
               ["Find the width and the five endpoints", "Evaluate f at each endpoint with a calculator", "Apply the trapezoidal sum with weight 1/2 on the end values"],
               [("the trapezoidal sum uses the endpoint values with weights 1/2, 1, 1, 1, 1/2", "definition of the trapezoidal sum")],
               [("left_sum", "uses left endpoints"), ("right_sum", "uses right endpoints"), ("midpoint_sum", "uses midpoints"), ("exact_value", "gives the integral"), ("no_half_weights", "gives full weight to the end values")],
               "average of the left and right sums computed separately (independent of the trapezoid weights)")
    return pack("c_trapezoid_formula_calc", "6.2", "1.E", "required", stem, kk, pool, rng, est=100, facts=[f"f={ftex}", f"lo={lo}", f"hi={hi}", f"key={trap:.6f}"], extra={"blueprint": bpr})


# 7.8 지수 감소: 두 자료로 k 를 정하고 더 먼 시각의 양
def c_decay_two_points_calc(rng):
    y0, t1, frac, t2 = rng.choice([50, 80, 120]), rng.choice([3, 4]), rng.choice([0.6, 0.7]), rng.choice([8, 10])
    k = -math.log(frac) / t1
    key = y0 * math.exp(-k * t2)
    sol = _I.solve_ivp(lambda t_, y_: [-k * y_[0]], [0, t2], [y0], rtol=1e-11, atol=1e-12)  # 독립 경로: 수치 적분
    if abs(sol.y[0][-1] - key) > 1e-6:
        raise ValueError("independent_check_failed")
    lin = y0 * (1 - (1 - frac) * t2 / t1)
    cand = [(f"Extends the loss linearly: the amount lost in ${t1}$ hours, ${y0 * (1 - frac):g}$ grams, is lost again every ${t1}$ hours.", lin), (f"Applies the factor ${frac:g}$ once per hour instead of once per ${t1}$ hours, giving ${y0}({frac:g})^{{{t2}}}$.", y0 * frac ** t2),
            (f"Uses $k=\\dfrac{{\\ln {frac:g}}}{{{t1}}}$ with the wrong sign, so the amount grows to ${y0}e^{{{t2}k}}$.", y0 * math.exp(k * t2)),
            (f"Starts from the amount at ${t1}$ hours, ${y0 * frac:g}$ grams, but applies the factor for the full ${t2}$ hours.", y0 * frac * frac ** (t2 / t1))]
    pool = dopts([(w, z) for w, z in cand if z > 0], key)
    stem = f"A substance decays so that the amount $y$, in grams, satisfies $\\dfrac{{dy}}{{dt}}=-ky$ for a constant $k>0$, where $t$ is in hours. Initially there are ${y0}$ grams, and after ${t1}$ hours ${y0 * frac:g}$ grams remain. How many grams remain after ${t2}$ hours?"
    kk = Opt(dec(key), True, f"$y={y0}e^{{-kt}}$ and $e^{{-{t1}k}}={frac:g}$, so $y({t2})={y0}({frac:g})^{{{t2}/{t1}}}={key:.3f}$ grams (calculator).", key)
    bpr = _nbp("c_decay_two_points_calc", "7.8", "1.E", "Use an exponential decay model determined by two data points to predict a later amount",
               ["Solve dy/dt = -ky to get y = y0 e^(-kt)", "Find the decay factor from the amount remaining after the given time", "Evaluate the amount at the later time with a calculator"],
               [("solutions of dy/dt = -ky have the form y0 e^(-kt)", "exponential model stated in the problem")],
               [("linear_decay", "extends the loss linearly"), ("ratio_per_hour", "applies the ratio per hour"), ("wrong_sign_k", "grows instead of decays"), ("wrong_base", "starts from the wrong amount")],
               "Runge-Kutta numerical integration of dy/dt = -ky with k from the two data points (independent of the exponential solution)")
    return pack("c_decay_two_points_calc", "7.8", "1.E", "required", stem, kk, pool, rng, est=90, facts=[f"y0={y0}", f"t1={t1}", f"frac={frac}", f"t2={t2}", f"key={key:.6f}"], extra={"blueprint": bpr})


# 7.8 그래프의 두 점으로 k 를 구하고, 값이 목표에 도달하는 시각
def g_exp_time_graph_calc(rng):
    P0, m, T = rng.choice([2, 3, 4]), rng.choice([2, 3]), 2
    M = rng.choice([5, 6, 8, 10])
    V = P0 * M
    k_ = math.log(m) / T
    key = math.log(M) / k_
    PT = P0 * m
    kk_ = (PT - P0) / (P0 * T)
    if abs(P0 * math.exp(k_ * key) - V) > 1e-9:  # 독립 경로: 구한 시각에서 모형 값이 목표와 같은지
        raise ValueError("independent_check_failed")
    ds = [(f"Extends the chord through $A$ and $B$ linearly: $t={T}\\cdot\\dfrac{{{V}-{P0}}}{{{PT}-{P0}}}$.", T * (V - P0) / (PT - P0)), (f"Uses the average growth rate $\\dfrac{{P(2)-P(0)}}{{2P(0)}}={kk_:g}$ as $k$, so $t=\\dfrac{{\\ln {M}}}{{{kk_:g}}}$.", math.log(M) / kk_),
          (f"Solves $e^{{kt}}={V}$ instead of $e^{{kt}}={M}$, using $\\ln {V}$ in place of $\\ln\\dfrac{{{V}}}{{{P0}}}$.", math.log(V) / k_), (f"Uses $\\ln {M}$ times the elapsed time ${T}$ without dividing by $\\ln {m}$, giving $t={T}\\ln {M}$.", T * math.log(M))]
    pool = dopts(ds, key)
    pts = [[round(i / 5, 2), round(P0 * math.exp(k_ * i / 5), 4)] for i in range(0, 26)]
    ymax = int(math.ceil(P0 * math.exp(k_ * 5)))
    stem = f"A quantity $P$ at time $t$ (in years) satisfies $\\dfrac{{dP}}{{dt}}=kP$. The graph of $P$ for $0\\le t\\le 5$ is shown and passes through the labeled points $A$ and $B$. At what time $t$ is $P(t)={V}$?"
    kk = Opt(dec(key), True, f"From the labeled points $P({T})/P(0)={m}$, so $k=\\dfrac{{\\ln {m}}}{{{T}}}$. Then $P(t)=P(0)e^{{kt}}={V}$ gives $e^{{kt}}={M}$ and $t=\\dfrac{{\\ln {M}}}{{k}}={key:.3f}$ (calculator).", key)
    stim = gstim("Graph of P(t), an increasing exponential curve, with labeled points A and B.", [("P", pts)], axis("t", 0, 5, 1), axis("P", 0, ymax + 1, 2), {"labeled_points": {"A": [0, P0], "B": [T, PT]}})
    bpr = _gbp("g_exp_time_graph_calc", "7.8", "1.E", "Use an exponential model read from two points on a graph to find when a target value is reached",
               ["Read the labeled points A and B from the graph", "Find k from P(T)/P(0) = e^{kT}", "Solve P(0) e^{kt} = target for t with a calculator"],
               [("solutions of dP/dt = kP have the form P(0) e^{kt}", "exponential model stated in the problem")],
               [("linear_extension", "extends the chord linearly"), ("average_rate_as_k", "uses the average growth rate as k"), ("log_of_value", "uses ln of the value instead of the ratio"), ("no_division", "does not divide by ln m")],
               "the model value P(0) e^{k t} evaluated at the computed time and compared with the target (independent of the logarithm algebra)", ["exponential curve for 0 <= t <= 5", "labeled points A = (0, P0) and B = (2, m P0)"])
    return gpack("g_exp_time_graph_calc", "7.8", "1.E", "required", stem, kk, pool, rng, stim, bpr, 100, [f"P0={P0}", f"m={m}", f"M={M}", f"key={key:.6f}"])


# 8.4 곡선(식)과 직선(그림) 사이의 넓이 — 거짓이던 오답 해설을 고친 판
def g_area_sin_line_calc(rng):
    fexpr, ftex, dom, c0, c1, m, roots, ff = _curve_line(rng, "sin")
    r1, r2 = roots
    Lf = lambda u: c0 + m * u
    area = _I.quad(lambda u: ff(u) - Lf(u), r1, r2)[0]
    if abs(numeric_integral(lambda u: ff(u) - Lf(u), r1, r2, 20001) - area) > 1e-6:
        raise ValueError("independent_check_failed")
    d = dom[1]
    whole = _I.quad(lambda u: ff(u) - Lf(u), 0, d)[0]
    ds = [(f"Integrates $f-L$ over the whole drawn interval $0\\le x\\le\\pi$ instead of between the two intersection points $x={r1:.3f}$ and $x={r2:.3f}$.", whole),
          (f"Computes the area under the curve alone between the intersection points, $\\int_{{{r1:.3f}}}^{{{r2:.3f}}}f(x)\\,dx$.", _I.quad(ff, r1, r2)[0]), (f"Computes the area under the line alone between the intersection points, $\\int_{{{r1:.3f}}}^{{{r2:.3f}}}L(x)\\,dx$.", _I.quad(Lf, r1, r2)[0]),
          ("Subtracts in the wrong order over $0\\le x\\le\\pi$, integrating $L-f$, and reports the magnitude.", abs(_I.quad(lambda u: Lf(u) - ff(u), 0, d)[0]))]
    pool = dopts(ds, area)
    stem = f"The figure shows the graph of $f(x)={ftex}$ for $0\\le x\\le\\pi$ and the line $L$. Let $R$ be the region enclosed by the graph of $f$ and the line $L$. What is the area of $R$?"
    kk = Opt(dec(area), True, f"The line passes through $(0,{c0})$ and $(4,{c1})$, so $L(x)={c0}+{m:g}x$. The graphs intersect at $x={r1:.3f}$ and $x={r2:.3f}$ (calculator), and $f\\ge L$ between them, so the area is $\\int_{{{r1:.3f}}}^{{{r2:.3f}}}(f(x)-L(x))\\,dx={area:.3f}$.", area)
    ytop = max(ff(u) for u in [dom[0] + (dom[1] - dom[0]) * i / 200 for i in range(201)])
    bpr = _gbp("g_area_sin_line_calc", "8.4", "1.D", "Find the area between a curve given by a formula and a line given only by a figure",
               ["Read two lattice points on the line from the figure and write its equation", "Find the two intersection points with a calculator", "Integrate (curve - line) between the intersection points"],
               [("f is above L between the two intersection points", "shown in the figure")],
               [("wrong_limits", "integrates over the whole drawn interval"), ("curve_only", "area under the curve only"), ("line_only", "area under the line only"), ("net_wrong_order", "wrong order of subtraction")],
               "composite Simpson rule on f - L between Brent-found roots (independent of scipy quad)", ["curve y = f(x)", "line L through two lattice points"])
    return gpack("g_area_sin_line_calc", "8.4", "1.D", "required", stem, kk, pool, rng, _curve_line_stim(fexpr, dom, c0, c1, ytop), bpr, 110, [f"f={fexpr}", f"c0={c0}", f"c1={c1}", f"area={area:.6f}"])


_RNET = [(3 + 2 * sp.sin(x / 2), "3+2\\sin\\left(\\dfrac{t}{2}\\right)"), (2 + 4 * sp.exp(-x / 3), "2+4e^{-t/3}"), (2 * sp.sqrt(x + 1), "2\\sqrt{t+1}")]


# 8.3 유입률은 식, 누출률은 그래프: t = b 에서 탱크 속 양 — 오답 해설을 값에 맞게 고쳤다
def g_net_amount_formula_graph_calc(rng):
    for _ in forever():
        rexpr, rtex = rng.choice(_RNET)
        vl = rand_vals(rng, 5, 0, 5)
        Lg = PL(XS5, vl)
        b = rng.choice([4, 6, 8])
        k0 = rng.randint(5, 30)
        rf = sp.lambdify(x, rexpr, "math")
        IR = _I.quad(rf, 0, b)[0]
        AL = float(Lg.area(0, b))
        key = k0 + IR - AL
        if key > 1 and AL > 0.5:
            break
    if abs(k0 + numeric_integral(lambda u: rf(u) - Lg.num(u), 0, b, 20001) - key) > 1e-5:
        raise ValueError("independent_check_failed")
    ds = [(f"Leaves out the ${k0}$ gallons already in the tank: $\\int_0^{{{b}}}R(t)\\,dt-\\int_0^{{{b}}}L(t)\\,dt$.", IR - AL), (f"Adds the leak instead of subtracting it: ${k0}+\\int_0^{{{b}}}R+\\int_0^{{{b}}}L$.", k0 + IR + AL),
          (f"Ignores the leak and adds only the water pumped in: ${k0}+\\int_0^{{{b}}}R(t)\\,dt$.", k0 + IR), (f"Counts only the leak: ${k0}-\\int_0^{{{b}}}L(t)\\,dt$.", k0 - AL)]
    pool = dopts(ds, key)
    stem = f"Water is pumped into a tank at the rate $R(t)={rtex}$ gallons per minute and leaks out at a rate $L(t)$ gallons per minute, for $0\\le t\\le 8$ minutes. The graph of $L$, consisting of line segments, is shown. The tank holds ${k0}$ gallons at $t=0$. How many gallons are in the tank at $t={b}$?"
    kk = Opt(dec(key), True, f"Amount $={k0}+\\int_0^{{{b}}}R(t)\\,dt-\\int_0^{{{b}}}L(t)\\,dt={k0}+{IR:.3f}-{AL:g}={key:.3f}$ gallons; $\\int R$ uses a calculator and $\\int L$ is the area under the graph.", key)
    bpr = _gbp("g_net_amount_formula_graph_calc", "8.3", "1.D", "Use net change with an inflow given by a formula and an outflow given by a graph",
               ["Recognize that the amount at time b is the initial amount plus the integral of inflow minus outflow", "Evaluate the integral of R with a calculator and the integral of L as an area from the graph", "Combine the three quantities"],
               [("amount at time b = initial amount + integral of the net rate", "net change theorem")],
               [("forgets_initial", "omits the initial amount"), ("adds_leak", "adds the leak"), ("ignores_leak", "counts only the inflow"), ("leak_only", "counts only the leak")],
               "composite Simpson rule (20001 nodes) on R - L with L interpolated (independent of splitting into two integrals)", ["vertices of L at t = 0, 2, 4, 6, 8"])
    return gpack("g_net_amount_formula_graph_calc", "8.3", "1.D", "required", stem, kk, pool, rng, gstim("Graph of L(t), consisting of line segments connecting the plotted vertices.", [("L", Lg.vert())], *_ax([vl], "t", (0, 8), "L(t)")), bpr, 105, [f"R={rexpr}", f"vl={vl}", f"b={b}", f"k0={k0}", f"key={key:.6f}"])


# 8.5 y 에 대한 적분: 오른쪽 곡선 x = A e^{-y/2}, 왼쪽 곡선 x = y^2/c, 아래는 x 축
def c_area_wrt_y_calc(rng):
    A, c = rng.choice([3, 4, 5]), rng.choice([2, 3, 4])
    R_ = lambda y_: A * math.exp(-y_ / 2)
    L_ = lambda y_: y_ * y_ / c
    ys = _roots(lambda y_: R_(y_) - L_(y_), 0.0, 8.0, 4000)
    if len(ys) != 1:
        raise ValueError("unexpected_roots")
    ys = ys[0]
    key = _I.quad(lambda y_: R_(y_) - L_(y_), 0, ys)[0]
    if abs(numeric_integral(lambda y_: R_(y_) - L_(y_), 0, ys, 20001) - key) > 1e-6:  # 독립 경로: 심프슨
        raise ValueError("independent_check_failed")
    xs = R_(ys)
    ds = [(f"Reverses the order, integrating $\\dfrac{{y^{{2}}}}{{{c}}}-{A}e^{{-y/2}}$ over $[0,{ys:.3f}]$, and reports the magnitude.", abs(_I.quad(lambda y_: L_(y_) - R_(y_), 0, ys)[0])),
          (f"Finds only the area between the right curve and the $y$-axis, $\\int_0^{{{ys:.3f}}}{A}e^{{-y/2}}\\,dy$.", _I.quad(R_, 0, ys)[0]),
          (f"Uses the $x$-coordinate of the intersection, ${xs:.3f}$, as the upper limit of the $y$-integral instead of the $y$-coordinate ${ys:.3f}$.", _I.quad(lambda y_: R_(y_) - L_(y_), 0, xs)[0]),
          (f"Integrates $\\left({A}e^{{-y/2}}-\\dfrac{{y^{{2}}}}{{{c}}}\\right)$ up to $y=4$ instead of up to the intersection.", _I.quad(lambda y_: R_(y_) - L_(y_), 0, 4)[0])]
    pool = dopts(ds, key)
    stem = f"Let $R$ be the region in the first quadrant bounded by the graphs of $x={A}e^{{-y/2}}$ and $x=\\dfrac{{y^{{2}}}}{{{c}}}$ and the $x$-axis. What is the area of $R$?"
    kk = Opt(dec(key), True, f"The curves meet where ${A}e^{{-y/2}}=\\dfrac{{y^{{2}}}}{{{c}}}$, at $y={ys:.3f}$ (calculator). For $0\\le y\\le {ys:.3f}$ the right curve is $x={A}e^{{-y/2}}$ and the left curve is $x=\\dfrac{{y^{{2}}}}{{{c}}}$, so the area is $\\int_0^{{{ys:.3f}}}\\left({A}e^{{-y/2}}-\\dfrac{{y^{{2}}}}{{{c}}}\\right)dy={key:.3f}$.", key)
    bpr = _nbp("c_area_wrt_y_calc", "8.5", "1.D", "Find the area between two curves written as x in terms of y by integrating with respect to y",
               ["Find the intersection y-value of the two curves with a calculator", "Identify the right curve and the left curve for 0 <= y <= y*", "Integrate (right - left) with respect to y"],
               [("the right curve lies above the left curve for 0 <= y < y*", "the right curve starts at x = A and the left at x = 0")],
               [("wrong_order", "subtracts in the wrong order"), ("one_curve_only", "uses only the right curve"), ("x_for_y_limit", "uses the x-coordinate as a y-limit"), ("wrong_upper_limit", "uses y = 4 as the upper limit")],
               "composite Simpson rule on (right - left) with the limit from Brent's method (independent of scipy quad)")
    return pack("c_area_wrt_y_calc", "8.5", "1.D", "required", stem, kk, pool, rng, est=110, facts=[f"A={A}", f"c={c}", f"ys={ys:.6f}", f"key={key:.6f}"], extra={"blueprint": bpr})


_FTRI = [(lambda t_: math.sqrt(t_) * math.exp(-t_ / 4), "\\sqrt{x}\\,e^{-x/4}", (1, 4)), (lambda t_: t_ * math.exp(-t_ / 3), "xe^{-x/3}", (1, 5)), (lambda t_: math.sin(t_) + 0.5 * t_, "\\sin x+\\dfrac{x}{2}", (1, 3))]


# 8.8 정삼각형 단면의 부피(밑면은 곡선과 x 축)
def c_equilateral_cross_section_calc(rng):
    f_, ftex, (_, bs) = rng.choice(_FTRI)
    b = rng.choice([2, bs])
    I2 = _I.quad(lambda u: f_(u) ** 2, 0, b)[0]
    key = math.sqrt(3) / 4 * I2
    simp = math.sqrt(3) / 4 * numeric_integral(lambda u: f_(u) ** 2, 0, b, 20001)  # 독립 경로: 심프슨
    if abs(simp - key) > 1e-6:
        raise ValueError("independent_check_failed")
    ds = [("Uses the area formula for a semicircle, $\\dfrac{\\pi}{8}s^{2}$, instead of the area of an equilateral triangle.", math.pi / 8 * I2), ("Uses the area of a square, $s^{2}$, for each cross section.", I2),
          ("Does not square the side length, integrating $\\dfrac{\\sqrt{3}}{4}\\,s$ instead of $\\dfrac{\\sqrt{3}}{4}\\,s^{2}$.", math.sqrt(3) / 4 * _I.quad(f_, 0, b)[0]),
          ("Forgets the factor $\\frac{1}{2}$ in the area of the triangle, using base times height $s\\cdot\\dfrac{\\sqrt{3}}{2}s$.", math.sqrt(3) / 2 * I2)]
    pool = dopts(ds, key)
    stem = f"Let $R$ be the region in the first quadrant bounded by the graph of $y={ftex}$, the $x$-axis, and the line $x={b}$. $R$ is the base of a solid whose cross sections perpendicular to the $x$-axis are equilateral triangles with a side in $R$. What is the volume of the solid?"
    kk = Opt(dec(key), True, f"The side of each triangle is $s=f(x)$ and its area is $\\dfrac{{\\sqrt{{3}}}}{{4}}s^{{2}}$, so $V=\\dfrac{{\\sqrt{{3}}}}{{4}}\\int_0^{{{b}}}\\left({ftex}\\right)^{{2}}dx={key:.3f}$ (calculator).", key)
    bpr = _nbp("c_equilateral_cross_section_calc", "8.8", "1.D", "Find the volume of a solid whose cross sections are equilateral triangles over a base region",
               ["Write the side length of the triangle as the height of the region", "Use the area of an equilateral triangle, sqrt(3)/4 times the side squared", "Integrate along the x-axis with a calculator"],
               [("cross sections perpendicular to the x-axis are equilateral triangles whose side lies in the base region", "stated in the problem")],
               [("semicircle_formula", "uses the semicircle area formula"), ("square_formula", "uses a square"), ("not_squared", "does not square the side"), ("missing_half", "forgets the factor 1/2")],
               "composite Simpson rule (20001 nodes) on the squared side (independent of scipy quad)")
    return pack("c_equilateral_cross_section_calc", "8.8", "1.D", "required", stem, kk, pool, rng, est=105, facts=[f"f={ftex}", f"b={b}", f"key={key:.6f}"], extra={"blueprint": bpr})


# 8.3 정적분의 의미(맥락 해석): 값과 의미가 모두 맞는 문장
def c_integral_meaning_calc(rng):
    a, bb, T0, V0 = rng.choice([10, 12, 14]), rng.choice([4, 5, 6]), rng.choice([8, 10, 12]), rng.choice([15, 20, 25])
    R = lambda t_: a + bb * math.sin(t_ / 2)
    V = _I.quad(R, 0, T0)[0]
    if abs(V - numeric_integral(R, 0, T0, 20001)) > 1e-6:  # 독립 경로: 심프슨
        raise ValueError("independent_check_failed")
    A = V / T0
    key = Opt(f"$\\int_0^{{{T0}}}R(t)\\,dt\\approx {V:.2f}$; the total number of gallons of water that enter the tank from $t=0$ to $t={T0}$.", True, f"$\\int_0^{{{T0}}}R(t)\\,dt={V:.2f}$ (calculator) is the accumulated change of the amount, in gallons, over the first ${T0}$ minutes: the total water that enters the tank in that time.", None)
    ds = [Opt(f"$\\int_0^{{{T0}}}R(t)\\,dt\\approx {V:.2f}$; the rate, in gallons per minute, at which water enters the tank at $t={T0}$.", False, f"The integral has units of gallons, not gallons per minute; the rate at $t={T0}$ is $R({T0})={R(T0):.2f}$ gallons per minute.", None),
          Opt(f"$\\int_0^{{{T0}}}R(t)\\,dt\\approx {A:.2f}$; the total number of gallons of water that enter the tank from $t=0$ to $t={T0}$.", False, f"${A:.2f}$ is the average rate $\\dfrac{{1}}{{{T0}}}\\int_0^{{{T0}}}R(t)\\,dt$ in gallons per minute; the integral itself is ${V:.2f}$.", None),
          Opt(f"$\\int_0^{{{T0}}}R(t)\\,dt\\approx {V:.2f}$; the number of gallons of water in the tank at $t={T0}$.", False, f"The tank holds ${V0}$ gallons at $t=0$, so the amount at $t={T0}$ is ${V0}+{V:.2f}={V0 + V:.2f}$ gallons, not ${V:.2f}$.", None)]
    stem = f"Water flows into a tank at the rate $R(t)={a}+{bb}\\sin\\left(\\dfrac{{t}}{{2}}\\right)$ gallons per minute for $0\\le t\\le {T0}$ minutes, where $t$ is measured in minutes. The tank holds ${V0}$ gallons at $t=0$. Which of the following is a correct value and interpretation of $\\int_0^{{{T0}}}R(t)\\,dt$?"
    bpr = _nbp("c_integral_meaning_calc", "8.3", "3.F", "Interpret a definite integral of a rate in context with its value and units",
               ["Evaluate the definite integral with a calculator", "Recognize that the integral of a rate is an accumulated amount in gallons", "Do not confuse it with the amount in the tank, the average rate, or the rate itself"],
               [("the integral of the rate of flow over [0, T0] is the total amount that flows in", "net change theorem")],
               [("rate_meaning", "reads the integral as a rate"), ("average_value", "gives the average rate with the total meaning"), ("amount_in_tank", "forgets the initial amount")],
               "composite Simpson rule (20001 nodes) for the integral and the average (independent of scipy quad)")
    return pack("c_integral_meaning_calc", "8.3", "3.F", "required", stem, key, ds, rng, est=100, facts=[f"a={a}", f"b={bb}", f"T0={T0}", f"V0={V0}", f"V={V:.6f}"], extra={"blueprint": bpr})


# 4.2 속력 증가·감소의 판정(v 와 a 의 부호)
def c_speed_change_justify_calc(rng):
    for _ in forever():
        A, B, t0 = rng.choice([3, 4]), rng.choice([1.0, 1.5]), rng.choice([1.5, 2.0, 2.5, 3.0, 4.0, 5.0])
        v = A * math.sin(t0) - B * t0
        a = A * math.cos(t0) - B
        if abs(v) > 0.3 and abs(a) > 0.3:
            break
    hh = 1e-6
    vf = lambda u: A * math.sin(u) - B * u
    if abs((vf(t0 + hh) - vf(t0 - hh)) / (2 * hh) - a) > 1e-5:  # 독립 경로: 중심차분
        raise ValueError("independent_check_failed")
    inc = v * a > 0
    word = lambda z: "increasing" if z else "decreasing"
    t_ = f"{t0:g}"
    key = Opt(f"$v({t_})={v:.3f}$ and $a({t_})={a:.3f}$; the speed is {word(inc)}.", True, f"$v(t)=A\\sin t-Bt$ gives $v({t_})={v:.3f}$ and $a(t)=v'(t)={A}\\cos t-{B:g}$ gives $a({t_})={a:.3f}$; $v$ and $a$ have {'the same sign' if inc else 'opposite signs'}, so the speed is {word(inc)}.".replace("A\\sin t-Bt", f"{A}\\sin t-{B:g}t"), None)
    ds = [Opt(f"$v({t_})={v:.3f}$ and $a({t_})={a:.3f}$; the speed is {word(not inc)}.", False, f"The values are right, but $v$ and $a$ have {'the same sign' if inc else 'opposite signs'}, so the speed is {word(inc)}, not {word(not inc)}.", None),
          Opt(f"$v({t_})={v:.3f}$ and $a({t_})={-a:.3f}$; the speed is {word(not inc)}.", False, f"$a({t_})={A}\\cos({t_})-{B:g}={a:.3f}$, not ${-a:.3f}$; the sign of the acceleration is reversed, which reverses the conclusion.", None),
          Opt(f"$v({t_})={-v:.3f}$ and $a({t_})={a:.3f}$; the speed is {word(not inc)}.", False, f"$v({t_})={A}\\sin({t_})-{B:g}({t_})={v:.3f}$, not ${-v:.3f}$; the sign of the velocity is reversed, which reverses the conclusion.", None)]
    stem = f"A particle moves along the $x$-axis with velocity $v(t)={A}\\sin t-{B:g}t$, where $t$ is in seconds. Which of the following is correct at time $t={t_}$?"
    bpr = _nbp("c_speed_change_justify_calc", "4.2", "3.E", "Decide whether the speed is increasing or decreasing from the signs of velocity and acceleration",
               ["Evaluate v and a = v' at the given time with a calculator", "Compare the signs of v and a", "Same signs mean the speed is increasing; opposite signs mean it is decreasing"],
               [("speed increases when velocity and acceleration have the same sign", "v and a are both nonzero at the time")],
               [("reversed_conclusion", "reverses the rule"), ("wrong_acceleration_sign", "wrong sign of a"), ("wrong_velocity_sign", "wrong sign of v")],
               "central difference (step 1e-6) of v for the acceleration and a direct evaluation of v (independent of the symbolic derivative)")
    return pack("c_speed_change_justify_calc", "4.2", "3.E", "required", stem, key, ds, rng, est=95, facts=[f"A={A}", f"B={B}", f"t0={t0}", f"v={v:.6f}", f"a={a:.6f}"], extra={"blueprint": bpr})
