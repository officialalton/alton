"""MC 신규 원형 K군(2026-10-09, 단계 S3c): 그래프 2종 + 계산기 일반 문항(AB 5, BC 3)."""
from gcommon import *
from scipy import optimize as _O, integrate as _I
from calc_graph_d import dopts

XS5 = [0, 2, 4, 6, 8]
BC = "ap_calculus_bc"


def _fin(arch, topic, skill, stem, key, ds, rng, bpr, est, facts):
    return pack(arch, topic, skill, "required", stem, key, dopts(ds, key.value), rng, est=est, facts=facts, extra={"blueprint": bpr})


def _nb(arch, topic, skill, concept, thinking, cond, mis, path, subject=SUB):
    return bp(arch, topic, skill, "required", concept, thinking, cond, mis, path, {"type": "none", "must_include": []}, subject=subject)


# ---------- 그래프 ----------
# 8.5 y 에 대한 적분: 그래프가 x = f(y)
def g_area_y_graph(rng):
    ys = [0, 2, 4, 6, 8]
    for _ in forever():
        vx = rand_vals(rng, 5, 1, 7)
        f = PL(ys, vx)                      # x = f(y)
        A = f.area(0, 8)
        key = A
        trap_x = Fr(sum(vx), 5) * 8
        if len({key, trap_x, A / 2, f.sq_area(0, 8)}) == 4 and A.denominator <= 2:
            break
    num = _I.quad(f.num, 0, 8, points=[2, 4, 6], limit=200)[0]
    if abs(num - float(key)) > 1e-9:
        raise ValueError("independent_check_failed")
    ds = [("Averages the five x-values and multiplies by the height 8, which is not the area of this region.", trap_x), ("Halves the area, as for a triangle.", A / 2), ("Integrates x squared with respect to y, the volume integrand instead of the area.", f.sq_area(0, 8))]
    pool = opts(ds, key, fx)
    pts = [[vx[i], ys[i]] for i in range(5)]
    stem = "The graph of $x=f(y)$ for $0\\le y\\le 8$ is shown and consists of line segments. Let $R$ be the region bounded by the graph, the $y$-axis, and the lines $y=0$ and $y=8$. What is the area of $R$?"
    k = Opt(fx(key), True, "The region is described in terms of y: area = the integral of f(y) dy from 0 to 8, computed as trapezoids stacked along the y-axis.", key)
    bpr = bp("g_area_y_graph", "8.5", "1.D", "not_allowed", "Find the area of a region described with x as a function of y, integrating with respect to y",
             ["Recognize that the boundary is x = f(y) so the area integral is taken in the y direction", "Compute the area as trapezoids whose widths are the x-values and whose heights are the y-steps", "Add the areas of the pieces"],
             [("the region lies between the y-axis and the graph for 0 <= y <= 8 and x = f(y) >= 0", "all plotted x-values are positive")],
             [("average_times_height", "uses the average x-value"), ("half_area", "halves the area"), ("squared_integrand", "integrates x squared")],
             "numerical quadrature of the interpolated x(y) over y in [0, 8] (independent of trapezoid areas)", {"type": "graph", "must_include": ["vertices of x = f(y) at y = 0, 2, 4, 6, 8"]})
    stim = gstim("Graph of x = f(y), consisting of line segments connecting the plotted vertices.", [("f", pts)], axis("x", 0, max(vx) + 1, 1), axis("y", 0, 8, 1))
    return gpack("g_area_y_graph", "8.5", "1.D", "not_allowed", stem, k, pool, rng, stim, bpr, 90, [f"vx={vx}", f"A={A}"])


# 8.8 정삼각형 단면
def g_volume_triangle_graph(rng):
    for _ in forever():
        v = rand_vals(rng, 5, 0, 6)
        f = PL(XS5, v)
        S = f.sq_area(0, 8)
        key = S / 4                       # (sqrt(3)/4) ∫ f^2 → coefficient sqrt(3)/4
        if v.count(0) <= 1 and S > 0 and len({S, S / 2, S / 4, f.area(0, 8) ** 2}) == 4 and S.denominator <= 3:
            break
    root3 = sp.sqrt(3)
    kv = R(S) * root3 / 4
    num = math.sqrt(3) / 4 * f.quad(0, 8, lambda u: f.num(u) ** 2)
    if abs(num - float(sp.N(kv))) > 1e-6:
        raise ValueError("independent_check_failed")
    ds = [("Uses the area formula for a right isosceles triangle, (1/2) f^2, instead of an equilateral triangle.", R(S) / 2), ("Uses (sqrt(3)/2) f^2, the height of the triangle times its side, with no 1/2.", R(S) * root3 / 2),
          ("Leaves out sqrt(3)/4 and integrates only f squared.", R(S)), ("Squares the area of the base region, (integral of f)^2, times sqrt(3)/4.", R(f.area(0, 8) ** 2) * root3 / 4)]
    pool = opts(ds, kv, anyfmt)
    stem = "The graph of the function $f$ is shown and consists of line segments. Let $R$ be the region bounded by the graph of $f$, the $x$-axis, and the lines $x=0$ and $x=8$. $R$ is the base of a solid whose cross sections perpendicular to the $x$-axis are equilateral triangles with one side in $R$. What is the volume of the solid?"
    k = Opt(anyfmt(kv), True, "An equilateral triangle with side f(x) has area (sqrt(3)/4) f(x)^2, so V = (sqrt(3)/4) times the integral of f^2.", kv)
    bpr = bp("g_volume_triangle_graph", "8.8", "1.D", "not_allowed", "Find a volume with equilateral triangle cross sections whose side is given by a graph",
             ["Express the area of an equilateral triangle of side f(x) as (sqrt(3)/4) f squared", "Integrate f squared over [0, 8] piece by piece from the graph", "Multiply by sqrt(3)/4"],
             [("the side of each triangle lies in the base region and equals f(x)", "stated in the problem")],
             [("right_triangle_formula", "uses the factor 1/2"), ("no_half", "uses sqrt(3)/2"), ("missing_coefficient", "omits the coefficient"), ("square_of_area", "squares the area")],
             "numerical quadrature of (sqrt(3)/4) f^2 on the interpolated graph (independent of exact quadratic pieces)", {"type": "graph", "must_include": ["vertices of f at x = 0, 2, 4, 6, 8"]})
    ymax = max(v)
    return gpack("g_volume_triangle_graph", "8.8", "1.D", "not_allowed", stem, k, pool, rng, gstim("Graph of f, consisting of line segments connecting the plotted vertices.", [("f", f.vert())], axis("x", 0, 8, 1), axis("y", -1, ymax + 1, 1)), bpr, 105, [f"v={v}", f"S={S}"])


# ---------- AB 계산기 일반 ----------
# 6.5 누적함수가 증가하는 구간
def c_accum_interval_calc(rng):
    c, b = rng.choice([0.4, 0.5, 0.6]), rng.choice([2, 3])
    f = lambda t_: t_ * math.exp(-t_ / b) - c
    grid = [i / 1000 for i in range(0, 8001)]
    roots = [_O.brentq(f, grid[i], grid[i + 1], xtol=1e-13) for i in range(8000) if f(grid[i]) * f(grid[i + 1]) < 0]
    if len(roots) != 2:
        raise ValueError("unexpected_roots")
    r1, r2 = roots
    ds = [("Gives the interval where f is decreasing, (0, r1), instead of where F is increasing.", (0.0, r1)), ("Gives (r2, 8): after the second zero f is negative, so F is decreasing there.", (r2, 8.0)), ("Gives (0, r2): F is decreasing on (0, r1).", (0.0, r2))]
    fmtI = lambda p: "$(%.3f,%.3f)$" % p
    opts_ = [Opt(fmtI(p), False, w, p[0] * 10 + p[1]) for w, p in ds]
    key = Opt(fmtI((r1, r2)), True, "F'(x) = f(x) = x e^{-x/%d} - %s is positive between its two zeros, found with a calculator, so F is increasing on (r1, r2)." % (b, c), r1 * 10 + r2)
    stem = f"Let $F(x)=\\int_0^x\\left(te^{{-t/{b}}}-{c}\\right)dt$ for $0\\le x\\le 8$. On which interval is $F$ increasing?"
    bpr = _nb("c_accum_interval_calc", "6.5", "3.E", "Determine where an accumulation function increases from the sign of its integrand, locating zeros with a calculator",
              ["Use F' = f, the integrand", "Find the zeros of the integrand numerically with a calculator", "F increases where the integrand is positive"],
              [("F is differentiable with F' equal to the integrand", "Fundamental Theorem of Calculus; the integrand is continuous")],
              [("where_f_decreasing", "uses where f decreases"), ("after_second_zero", "picks the interval after the second zero"), ("first_part_wrong", "starts at 0")],
              "sign of the integrand on a fine grid and Brent roots (independent of the Fundamental Theorem argument)")
    return pack("c_accum_interval_calc", "6.5", "3.E", "required", stem, key, opts_, rng, est=100, facts=[f"b={b}", f"c={c}", f"roots={roots}"], extra={"blueprint": bpr})


# 4.6 접선 근사와 과소/과대
def c_linear_approx_overunder_calc(rng):
    a, k, dx = rng.choice([1, 2, 3]), rng.choice([2, 3, 4]), rng.choice([0.1, 0.2, 0.3])
    f = sp.sqrt(x + k) * sp.log(x + 2)
    L = float(f.subs(x, a)) + float(sp.diff(f, x).subs(x, a)) * dx
    true = float(f.subs(x, a + dx))
    f2 = float(sp.diff(f, x, 2).subs(x, a))
    under = f2 > 0
    if abs(L - true) < 1e-4 or f2 == 0:
        raise ValueError("degenerate")
    if (true > L) != under:
        raise ValueError("independent_check_failed")
    wd = "an underestimate" if under else "an overestimate"
    od = "an overestimate" if under else "an underestimate"
    key = Opt("$%.4f$, %s" % (L, wd), True, "f(a) + f'(a) dx = %.4f; f'' is %s at x = %d, so the graph is concave %s and the tangent line is %s the curve." % (L, "positive" if under else "negative", a, "up" if under else "down", "below" if under else "above"), None)
    ds = [Opt("$%.4f$, %s" % (L, od), False, "Computes the tangent line value correctly but reverses the concavity argument (f'' is %s)." % ("positive" if under else "negative"), None),
          Opt("$%.4f$, %s" % (float(f.subs(x, a)), od), False, "Reports f(%d) with no change along the tangent line and then reverses the comparison." % a, None),
          Opt("$%.4f$, %s" % (float(f.subs(x, a)) + float(sp.diff(f, x).subs(x, a)) * dx * 2, wd), False, "Moves twice the step size along the tangent line.", None)]
    stem = f"Let $f(x)=\\sqrt{{x+{k}}}\\,\\ln(x+2)$. The tangent line to the graph of $f$ at $x={a}$ is used to approximate $f({a+dx:g})$. Which of the following gives the approximation and says how it compares with $f({a+dx:g})$?"
    bpr = _nb("c_linear_approx_overunder_calc", "4.6", "1.F", "Use a tangent line approximation and decide over/under estimate from the sign of the second derivative, with a calculator",
              ["Compute f(a) and f'(a) with a calculator and form the tangent line value", "Find the sign of f'' at a with a calculator", "Decide whether the tangent line lies below (concave up) or above (concave down) the curve"],
              [("f'' keeps its sign on the interval from a to a + dx so the tangent line stays on one side of the curve", "f'' is continuous and nonzero at a")],
              [("reversed_concavity", "wrong over/under claim"), ("no_tangent_change", "ignores the slope"), ("double_step", "wrong step size")],
              "the exact f(a + dx) is compared with the tangent line value (independent of the sign of f'')")
    return pack("c_linear_approx_overunder_calc", "4.6", "1.F", "required", stem, key, ds, rng, est=105, facts=[f"a={a}", f"k={k}", f"L={L:.6f}"], extra={"blueprint": bpr})


# 4.2 운동 방향이 바뀌는 시각
def c_motion_turn_calc(rng):
    a, b = rng.choice([2, 3, 4]), rng.choice([0.5, 0.8, 1.0])
    v = lambda t_: a * math.cos(t_) - b * t_
    grid = [i / 1000 for i in range(0, 6001)]
    roots = [_O.brentq(v, grid[i], grid[i + 1], xtol=1e-13) for i in range(6000) if v(grid[i]) * v(grid[i + 1]) < 0]
    if len(roots) < 1:
        raise ValueError("no_root")
    key_v = roots[0]
    dist = _I.quad(lambda t_: abs(v(t_)), 0, key_v)[0]
    ds = [("Reports the time when the acceleration is zero, found from v'(t) = 0, instead of when the velocity is zero.", (math.pi + math.asin(min(1.0, b / a)) if math.pi + math.asin(min(1.0, b / a)) < 6 else 4.0)),
          ("Solves a cos t = b instead of a cos t = b t.", math.acos(min(1.0, b / a))), ("Reports the particle's position at the turning time instead of the time.", _I.quad(v, 0, key_v)[0] + 5.0), ("Takes the midpoint of the interval [0, 6].", 3.0)]
    stem = f"A particle moves along the $x$-axis with velocity $v(t)={a}\\cos t-{b}t$ for $0\\le t\\le 6$, where $t$ is in seconds. At what time $t$ does the particle first change direction?"
    key = Opt(dec(key_v), True, "The particle changes direction when v(t) = 0 and v changes sign; solve a cos t - b t = 0 with a calculator (first positive root).", key_v)
    bpr = _nb("c_motion_turn_calc", "4.2", "1.E", "Find the time a particle changes direction by solving v(t) = 0 numerically",
              ["Recognize that a change of direction needs v = 0 with a sign change", "Solve the transcendental equation with a calculator", "Choose the first positive root"],
              [("v is continuous and changes sign at its first positive root", "v(0) > 0 and v decreases through zero")],
              [("acceleration_zero", "solves v' = 0"), ("wrong_equation", "drops the linear term"), ("position_not_time", "reports a position"), ("midpoint", "guesses the midpoint")],
              "bisection on v over a fine grid (independent of Brent's method)")
    return _fin("c_motion_turn_calc", "4.2", "1.E", stem, key, ds, rng, bpr, 90, [f"a={a}", f"b={b}", f"root={key_v:.6f}"])


# 8.4 곡선 사이의 넓이(교점은 계산기)
def c_area_between_calc(rng):
    A, c = rng.choice([2, 3, 4]), rng.choice([0.3, 0.5])
    f = lambda u: A * math.exp(-c * u)
    g = lambda u: 1 + 0.5 * u
    r = _O.brentq(lambda u: f(u) - g(u), 0, 6)
    key_v = _I.quad(lambda u: f(u) - g(u), 0, r)[0]
    simp = numeric_integral(lambda u: f(u) - g(u), 0, r, 20001)
    if abs(simp - key_v) > 1e-6 or key_v < 0.3:
        raise ValueError("independent_check_failed")
    ds = [("Integrates over [0, 6] instead of stopping at the intersection point.", _I.quad(lambda u: abs(f(u) - g(u)), 0, 6)[0]), ("Integrates (g - f), reversing the order, and reports the magnitude of a net value over [0, 6].", abs(_I.quad(lambda u: g(u) - f(u), 0, 6)[0])),
          ("Uses only the area under f from 0 to the intersection point.", _I.quad(f, 0, r)[0]), ("Uses only the area under g from 0 to the intersection point.", _I.quad(g, 0, r)[0])]
    stem = f"Let $R$ be the region in the first quadrant bounded by the graph of $y={A}e^{{-{c}x}}$, the line $y=1+\\frac{{1}}{{2}}x$, and the $y$-axis. What is the area of $R$?"
    key = Opt(dec(key_v), True, "Find the intersection with a calculator, then integrate (upper - lower) = A e^{-cx} - (1 + x/2) from 0 to that x-value.", key_v)
    bpr = _nb("c_area_between_calc", "8.4", "1.D", "Find the area between a decreasing exponential and a line using a calculator for the intersection",
              ["Determine which curve is on top and find the intersection x-value numerically", "Set up the integral of upper minus lower from 0 to the intersection", "Evaluate with a calculator"],
              [("the exponential starts above the line and they intersect once for x > 0", "A > 1 and the line is increasing")],
              [("wrong_limits", "integrates past the intersection"), ("wrong_order", "reverses the order"), ("area_under_f_only", "area under the curve only"), ("area_under_g_only", "area under the line only")],
              "composite Simpson rule on f - g between the Brent root (independent of scipy quad)")
    return _fin("c_area_between_calc", "8.4", "1.D", stem, key, ds, rng, bpr, 95, [f"A={A}", f"c={c}", f"root={r:.6f}", f"area={key_v:.6f}"])


# 8.9 원판법
def c_disc_volume_calc(rng):
    A, hi = rng.choice([2, 3]), rng.choice([2, 3])
    f = lambda u: math.sqrt(A * u) * math.exp(-u / 4)
    key_v = math.pi * _I.quad(lambda u: f(u) ** 2, 0, hi)[0]
    simp = math.pi * numeric_integral(lambda u: f(u) ** 2, 0, hi, 20001)
    if abs(simp - key_v) > 1e-6:
        raise ValueError("independent_check_failed")
    ds = [("Leaves out the factor pi.", key_v / math.pi), ("Squares the integral of f instead of integrating f squared.", math.pi * _I.quad(f, 0, hi)[0] ** 2), ("Uses the radius f(x) as the area of the cross section, pi f(x), instead of pi f(x)^2.", math.pi * _I.quad(f, 0, hi)[0]),
          ("Rotates about the y-axis with discs, pi times the integral of x^2 dx.", math.pi * hi ** 3 / 3)]
    stem = f"The region bounded by the graph of $y=\\sqrt{{{A}x}}\\,e^{{-x/4}}$, the $x$-axis, and the line $x={hi}$ is revolved about the $x$-axis. What is the volume of the solid generated?"
    key = Opt(dec(key_v), True, "Disc method: V = pi times the integral of y^2 dx from 0 to %d, evaluated with a calculator." % hi, key_v)
    bpr = _nb("c_disc_volume_calc", "8.9", "1.D", "Set up and evaluate a disc-method volume with a calculator",
              ["Identify the radius y = f(x) of each disc", "Write V = pi times the integral of f squared", "Evaluate numerically with a calculator"],
              [("the region lies above the x-axis so each cross section is a disc of radius f(x)", "f(x) >= 0 on the interval")],
              [("missing_pi", "omits the factor pi"), ("square_of_integral", "squares the integral"), ("radius_as_area", "uses pi times f only"), ("wrong_axis", "uses the y-axis")],
              "composite Simpson rule on pi f^2 (independent of scipy quad)")
    return _fin("c_disc_volume_calc", "8.9", "1.D", stem, key, ds, rng, bpr, 90, [f"A={A}", f"hi={hi}", f"V={key_v:.6f}"])


# ---------- BC 계산기 일반 ----------
# 7.5 오일러(소수 보폭, 비선형 기울기)
def c_bc_euler_calc(rng):
    y0, h = rng.choice([1, 2]), rng.choice([0.2, 0.25, 0.4])
    n = 3
    slope = lambda xx, yy: xx + math.sin(yy)
    def run(steps, sl, upd=True):
        xx, yy = 0.0, float(y0)
        for _ in range(steps):
            yy = yy + h * sl(xx, yy)
            xx += h
        return yy
    key_v = run(n, slope)
    # 독립 경로: 부동소수 반복을 단계별 표로 다시 계산
    xs_, ys_ = [0.0], [float(y0)]
    for i in range(n):
        ys_.append(ys_[-1] + h * (xs_[-1] + math.sin(ys_[-1])))
        xs_.append(xs_[-1] + h)
    if abs(ys_[-1] - key_v) > 1e-12:
        raise ValueError("independent_check_failed")
    right = run(n, lambda xx, yy: (xx + h) + math.sin(yy))
    two = run(n - 1, slope)
    noupd = float(y0) + sum(h * (i * h + math.sin(float(y0))) for i in range(n))
    nosin = run(n, lambda xx, yy: xx + yy)
    ds = [("Uses the x-value at the right end of each step in the slope instead of the left end.", right), ("Takes only two steps instead of three.", two),
          ("Does not update y between steps: every step uses sin(y0).", noupd), ("Uses y instead of sin y in the differential equation.", nosin)]
    stem = f"The function $y=f(x)$ satisfies $f(0)={y0}$ and $\\dfrac{{dy}}{{dx}}=x+\\sin y$. Euler's method with step size ${h}$ and 3 steps starting at $x=0$ is used to approximate $f({3*h:g})$. What is the approximation?"
    key = Opt(dec(key_v), True, "Update (x, y) three times: y_{k+1} = y_k + h (x_k + sin y_k) using the slope at the left end, with a calculator.", key_v)
    bpr = _nb("c_bc_euler_calc", "7.5", "1.E", "Apply Euler's method with a nonlinear slope function using a calculator",
              ["Compute the slope at the current point from the differential equation", "Update y with y + h times the slope and advance x by h", "Repeat for the required number of steps using the updated y"],
              [("Euler's method uses the slope at the left end of each step", "definition of Euler's method")],
              [("right_endpoint_slope", "uses right-end x-values"), ("wrong_step_count", "stops early"), ("no_update", "does not update y"), ("wrong_function", "uses y instead of sin y")],
              "the iteration recomputed as a table of floating-point values (independent of the loop implementation)", subject=BC)
    return _fin("c_bc_euler_calc", "7.5", "1.E", stem, key, ds, rng, bpr, 110, [f"y0={y0}", f"h={h}", f"key={key_v:.6f}"])


# 6.14 이상적분(계산기)
def c_bc_improper_calc(rng):
    a, c = rng.choice([1, 2]), rng.choice([2, 3, 4])
    f = lambda u: math.exp(-u * u / c)
    key_v = _I.quad(f, a, math.inf)[0]
    chk = _I.quad(f, a, 40)[0]
    if abs(key_v - chk) > 1e-9:
        raise ValueError("independent_check_failed")
    ds = [("Stops at x = 4 instead of taking the limit to infinity.", _I.quad(f, a, 4)[0]), ("Integrates from 0 instead of from %d." % a, _I.quad(f, 0, math.inf)[0]), ("Concludes the integral diverges, so reports the integrand's value at the lower limit.", f(a)),
          ("Uses e^(-x) in place of e^(-x^2/%d) as the integrand." % c, math.exp(-a))]
    stem = f"What is the value of $\\int_{{{a}}}^{{\\infty}}e^{{-x^{{2}}/{c}}}\\,dx$?"
    key = Opt(dec(key_v), True, "The improper integral converges; evaluate the limit of the integral from %d to b with a calculator for large b." % a, key_v)
    bpr = _nb("c_bc_improper_calc", "6.14", "1.E", "Evaluate a convergent improper integral of a non-elementary integrand numerically",
              ["Recognize an improper integral with an infinite upper limit", "Replace infinity by a large bound or use the calculator's improper integral", "Evaluate numerically"],
              [("the integrand decays faster than 1/x^2 so the improper integral converges", "e^(-x^2/c) is bounded by e^(-x/c) for x >= 1 and integrable")],
              [("truncated_limit", "stops early"), ("wrong_lower_limit", "starts at zero"), ("divergence_claim", "claims divergence"), ("wrong_integrand", "changes the integrand")],
              "scipy quad to a finite upper bound of 40 compared with the infinite-range quad (independent of the infinite-range algorithm)", subject=BC)
    return _fin("c_bc_improper_calc", "6.14", "1.E", stem, key, ds, rng, bpr, 80, [f"a={a}", f"c={c}", f"key={key_v:.6f}"])


# 10.10 교대급수: 오차가 기준보다 작아지기 위한 항의 수
def c_bc_alt_terms_calc(rng):
    p, tol = rng.choice([2, 3]), rng.choice([0.001, 0.0005, 0.002])
    # b_n = 1/(n^p + n)
    b = lambda n: 1 / (n ** p + n)
    N = next(n for n in range(1, 500) if b(n + 1) < tol)
    if N < 3 or N > 60:
        raise ValueError("range")
    S_N = sum((-1) ** (n + 1) * b(n) for n in range(1, N + 1))
    ds = [("Chooses the smallest N with b_N < tolerance instead of b_(N+1), which is one term too many.", N + 1), ("Requires only b_(N+2) < tolerance, which allows one term too few.", next(n for n in range(1, 500) if b(n + 2) < tol)),
          ("Uses the tolerance squared when solving b_(N+1) < tolerance.", next(n for n in range(1, 5000) if b(n + 1) < tol ** 2))]
    pairs = [(w, float(z)) for w, z in ds]
    stem = f"The alternating series $\\sum_{{n=1}}^{{\\infty}}(-1)^{{n+1}}\\dfrac{{1}}{{n^{{{p}}}+n}}$ converges. What is the least number of terms $N$ for which the alternating series error bound guarantees $|S-S_N|<{tol}$?"
    key = Opt("$%d$" % N, True, "The error is at most b_(N+1) = 1/((N+1)^%d + N + 1); find the smallest N with this less than %s using a calculator." % (p, tol), float(N))
    pool = [Opt("$%d$" % int(z), False, w, z) for w, z in pairs if int(z) != N and int(z) > 0]
    uniq, seen = [], {N}
    for o in pool:
        if int(o.value) not in seen:
            seen.add(int(o.value))
            uniq.append(o)
    if len(uniq) < 3:
        raise ValueError("not_enough_distractors")
    bpr = _nb("c_bc_alt_terms_calc", "10.10", "1.E", "Use the alternating series error bound to find how many terms are needed, with a calculator",
              ["Identify the terms b_n and check that they decrease to 0", "State the error bound |S - S_N| <= b_(N+1)", "Find the least N with b_(N+1) below the tolerance using a calculator"],
              [("b_n is positive, decreasing and tends to 0 so the alternating series error bound applies", "1/(n^p + n) decreases to 0")],
              [("off_by_one_low", "uses the bound b_N"), ("one_term_too_few", "uses b_(N+2)"), ("counts_from_zero", "indexes from zero"), ("squared_tolerance", "squares the tolerance")],
              "terms computed in floating point and the first index with b_(N+1) below the tolerance found by direct search (independent of solving the inequality)", subject=BC)
    return pack("c_bc_alt_terms_calc", "10.10", "1.E", "required", stem, key, uniq, rng, est=100, facts=[f"p={p}", f"tol={tol}", f"N={N}"], extra={"blueprint": bpr})
