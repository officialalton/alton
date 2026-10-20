"""AP Precalculus 원형 B — 단원 1: 그래핑 계산기 필수 MC(파트 B 유형) + 계산기 불가 MC 추가. 계산기 필수 문항의 정답은 수치 풀이(numpy·scipy)와 독립 경로(표본·정규방정식)로 이중 계산한다."""
from pre_common import *
from pre_common import _O

STAGE_U1B = ["pre_poly_zero_calc", "pre_poly_local_max_calc", "pre_rational_intersection_calc", "pre_quad_regression_calc", "pre_cubic_regression_calc", "pre_poly_avg_roc_calc",
             "pre_solution_count_calc", "pre_avg_cost_min_calc", "pre_open_box_calc", "pre_vertex_form_max", "pre_roc_quadratic_symmetric", "pre_poly_min_degree_graph",
             "pre_rational_build_from_features", "pre_poly_build_from_zeros", "pre_remainder_theorem", "pre_rational_va_behavior", "pre_model_select_context"]


@retry_sep
def pre_poly_zero_calc(rng):
    for _ in forever():
        a = pick(rng, [-4, -3, -2, 0, 1, 2]); b = pick(rng, [-7, -5, -3, 2, 4]); c = pick(rng, [-9, -6, -2, 3, 5, 8])
        P = X ** 3 + a * X ** 2 + b * X + c; zs = sorted(float(z.real) for z in np.roots([1, a, b, c]) if abs(z.imag) < 1e-9)
        f = sp.lambdify(X, P, "math"); zs2 = solve_all(f, -12, 12)
        if len(zs) == 3 and len(zs2) == 3 and all(abs(u - v) < 1e-6 for u, v in zip(zs, zs2)) and all(abs(z - round(z)) > 0.12 for z in zs) and min(abs(zs[i + 1] - zs[i]) for i in range(2)) > 0.9:
            break
    which = pick(rng, [0, 2]); name = ["least", None, "greatest"][which]
    ex = [zs[1], zs[2 - which], c]
    key, ds = num_options(zs[which], [("Reports the middle zero.", zs[1]), (f"Reports the {'greatest' if which == 0 else 'least'} zero instead.", zs[2 - which]), ("Reports the $y$-intercept of the graph.", float(c)), ("Reports the sum of the three zeros.", sum(zs)), ("Uses the coefficient of $x^2$ as a zero.", float(a))])
    del ex
    stem = f"The polynomial function $p$ is defined by $p(x)={L(P)}$. Using a graphing calculator, what is the {name} zero of $p$?"
    return MQ("pre_poly_zero_calc", "1.4", "1", "required", stem, key, ds, rng, "Zeros of a polynomial can be found numerically from its graph", ["Graph the polynomial and identify where it crosses the x-axis", "Choose the requested zero and read it to three decimal places"],
              "numpy roots of the coefficient list versus a sign-change scan with brentq refinement", f"The three real zeros of $p$ are about ${zs[0]:.3f}$, ${zs[1]:.3f}$ and ${zs[2]:.3f}$.", [f"a={a}", f"b={b}", f"c={c}"], est=100)


@retry_sep
def pre_poly_local_max_calc(rng):
    for _ in forever():
        a = pick(rng, [-2, -1, 1, 2]); b = pick(rng, [-9, -6, -3, 3, 6, 9]); c = pick(rng, [-12, -6, 0, 6, 12]); d = pick(rng, [-5, -2, 0, 3, 7])
        P = a * X ** 3 + b * X ** 2 + c * X + d; dp = sp.diff(P, X); rts = sorted(float(r.real) for r in np.roots([float(co) for co in sp.Poly(dp, X).all_coeffs()]) if abs(r.imag) < 1e-9)
        if len(rts) != 2 or abs(rts[1] - rts[0]) < 1.2 or all(abs(r - round(r)) < 1e-9 for r in rts):
            continue
        f = sp.lambdify(X, P, "math"); xm = rts[0] if a < 0 else rts[0]
        # 상대 최대: a>0 이면 작은 임계점, a<0 이면 큰 임계점
        xm = rts[0] if a > 0 else rts[1]; xn = rts[1] if a > 0 else rts[0]
        grid = np.linspace(xm - 0.4 * (rts[1] - rts[0]), xm + 0.4 * (rts[1] - rts[0]), 80001); brute = float(max(f(v) for v in grid)); vmax = float(f(xm))
        if abs(vmax - brute) < 1e-6 and abs(vmax) > 1 and abs(f(xn)) > 1 and abs(vmax - f(xn)) > 2:
            break
    key, ds = num_options(vmax, [("Reports the relative minimum value instead.", float(f(xn))), ("Reports the $x$-coordinate of the relative maximum.", xm), ("Reports the $y$-intercept.", float(d)), ("Reports the $x$-coordinate of the relative minimum.", xn)])
    stem = f"The polynomial function $p$ is defined by $p(x)={L(P)}$. The graph of $p$ has a relative maximum. Using a graphing calculator, what is the value of the relative maximum?"
    return MQ("pre_poly_local_max_calc", "1.4", "1", "required", stem, key, ds, rng, "A relative maximum value is the output at a turning point found from the graph", ["Graph the function and locate the turning points", "Identify the relative maximum and read its output value"],
              "sympy critical points of the derivative versus a dense brute-force maximum near the turning point", f"The relative maximum occurs near $x={xm:.3f}$ with value about ${vmax:.3f}$.", [f"a={a}", f"b={b}", f"c={c}", f"d={d}"], est=100)


@retry_sep
def pre_rational_intersection_calc(rng):
    for _ in forever():
        a = pick(rng, [2, 3, 4, 5]); b = pick(rng, [-3, -1, 2, 5]); c = pick(rng, [-2, -1, 1, 2, 3]); d = pick(rng, [-2, -1, 1, 2]); e = pick(rng, [-3, -1, 2, 4])
        f = lambda v: (a * v + b) / (v - c)  # noqa: E731
        g = lambda v: d * v + e  # noqa: E731
        zs = [z for z in solve_all(lambda v: f(v) - g(v), c + 1e-3, 30)] + [z for z in solve_all(lambda v: f(v) - g(v), -30, c - 1e-3)]
        coef = sp.Poly(sp.expand((a * X + b) - (d * X + e) * (X - c)), X).all_coeffs(); rr = sorted(float(r.real) for r in np.roots([float(q) for q in coef]) if abs(r.imag) < 1e-9)
        if len(rr) == 2 and len(zs) == 2 and all(abs(u - v) < 1e-5 for u, v in zip(sorted(zs), rr)) and rr[1] > c + 0.2 and abs(rr[1] - rr[0]) > 0.6 and all(abs(r - round(r)) > 0.1 for r in rr):
            break
    xr = rr[1]
    key, ds = num_options(xr, [("Reports the other intersection point's $x$-coordinate.", rr[0]), ("Reports the $y$-coordinate of the intersection.", float(g(xr))), ("Reports the location of the vertical asymptote.", float(c)), ("Reports the zero of $f$.", -b / a)])
    stem = f"Let $f(x)=\\dfrac{{{L(a * X + b)}}}{{{L(X - c)}}}$ and $g(x)={L(d * X + e)}$. The graphs of $f$ and $g$ intersect at two points. Using a graphing calculator, what is the $x$-coordinate of the intersection point with $x>{c}$?"
    return MQ("pre_rational_intersection_calc", "1.9", "1", "required", stem, key, ds, rng, "Intersections of graphs can be located numerically", ["Graph both functions and find their intersection points", "Choose the intersection that satisfies the stated condition"], "roots of the cleared-denominator quadratic versus a sign-change scan of f minus g",
              f"The graphs intersect at $x\\approx{rr[0]:.3f}$ and $x\\approx{rr[1]:.3f}$; the one with $x>{c}$ is $x\\approx{xr:.3f}$.", [f"a={a}", f"b={b}", f"c={c}", f"d={d}", f"e={e}"], est=100)


def _reg_data(rng, deg):
    for _ in forever():
        co = [pick(rng, [-0.6, -0.4, 0.5, 0.8, 1.2])] if deg == 3 else []
        co += [pick(rng, [-3.0, -2.0, -1.0, 1.0, 2.0, 3.0]) if deg == 2 else pick(rng, [-3.0, -1.5, 1.5, 3.0]), pick(rng, [-8.0, -4.0, 2.0, 5.0, 9.0]), pick(rng, [10.0, 20.0, 30.0, 45.0])]
        xs = [0, 1, 2, 3, 4, 5, 6]; ys = [round(float(np.polyval(co, v)) + rng.choice([-1, 0, 1, 0, 2, -2]) * 0.5, 1) for v in xs]
        if min(ys) > 2 and max(ys) < 300:
            return xs, ys


def _fit_exact(xs, ys, deg):
    A = sp.Matrix([[sp.Rational(v) ** k for k in range(deg, -1, -1)] for v in xs]); b = sp.Matrix([sp.Rational(str(y)) for y in ys])
    sol = (A.T * A).LUsolve(A.T * b)
    return [float(s) for s in sol]


@retry_sep
def pre_quad_regression_calc(rng):
    for _ in forever():
        xs, ys = _reg_data(rng, 2); fit = np.polyfit(xs, ys, 2); ex = _fit_exact(xs, ys, 2)
        agree(float(np.linalg.norm(np.array(fit) - np.array(ex))), 0.0, 1e-6, "fit")
        x0 = 8; pred = float(np.polyval(fit, x0)); lin = np.polyfit(xs, ys, 1); linpred = float(np.polyval(lin, x0)); cub = np.polyfit(xs, ys, 3)
        if pred > 5 and abs(pred - linpred) > 0.1 * pred:
            break
    ctx = pick(rng, [("a drone's altitude, in meters,", "seconds"), ("the daily revenue of a food truck, in hundreds of dollars,", "days"), ("the water level of a reservoir, in feet,", "weeks")])
    stim = table_stim(f"Measured values of {ctx[0]} over {ctx[1]}", f"t ({ctx[1]})", "y", list(zip(xs, ys)))
    key, ds = num_options(pred, [("Uses a linear regression model instead of a quadratic model.", linpred), ("Evaluates the quadratic model at the last data point's input.", float(np.polyval(fit, xs[-1]))), ("Uses a cubic regression model instead of a quadratic model.", float(np.polyval(cub, x0))), ("Extends the final data value by the average change in the table.", ys[-1] + (ys[-1] - ys[0]) / 6 * (x0 - xs[-1]))], tol=0.04)
    stem = f"The table shows measured values of {ctx[0]} at several times. A quadratic function $Q$ is the regression model for the data. Using a graphing calculator, what is the value of $Q({x0})$?"
    return MQ("pre_quad_regression_calc", "1.14", "2", "required", stem, key, ds, rng, "A regression model is fit to data and then used for prediction", ["Enter the data into a graphing calculator and perform a quadratic regression", "Evaluate the fitted model at the requested input"], "numpy polyfit versus exact normal equations solved with sympy rational arithmetic", f"The quadratic regression gives $Q(x)\\approx{fit[0]:.3f}x^2{fit[1]:+.3f}x{fit[2]:+.3f}$ and $Q({x0})\\approx{pred:.3f}$.", [f"xs={xs}", f"ys={ys}"], stim=stim, est=110, mat=MAT_TABLE("the data table"))


@retry_sep
def pre_cubic_regression_calc(rng):
    for _ in forever():
        xs, ys = _reg_data(rng, 3); fit = np.polyfit(xs, ys, 3); ex = _fit_exact(xs, ys, 3)
        agree(float(np.linalg.norm(np.array(fit) - np.array(ex))), 0.0, 1e-5, "fit")
        x0 = pick(rng, [2.5, 3.5, 4.5, 5.5]); pred = float(np.polyval(fit, x0)); q = np.polyfit(xs, ys, 2); interp = float((ys[int(x0 - 0.5)] + ys[int(x0 + 0.5)]) / 2)
        if pred > 5 and abs(pred - float(np.polyval(q, x0))) > 0.05 * pred and abs(pred - interp) > 0.05 * pred:
            break
    stim = table_stim("Measured values of a quantity $y$ at several times $t$", "t", "y", list(zip(xs, ys)))
    key, ds = num_options(pred, [("Uses a quadratic regression model instead of a cubic model.", float(np.polyval(q, x0))), ("Averages the two nearest data values, which ignores the model.", interp), ("Uses a linear regression model.", float(np.polyval(np.polyfit(xs, ys, 1), x0))), ("Evaluates the cubic model at the nearest integer input.", float(np.polyval(fit, round(x0 + 0.01))))], tol=0.03)
    stem = f"The table gives measured values of a quantity $y$. A cubic function $C$ is the regression model for the data. Using a graphing calculator, what is the value of $C({x0})$?"
    return MQ("pre_cubic_regression_calc", "1.14", "2", "required", stem, key, ds, rng, "A polynomial regression model supports interpolation", ["Perform a cubic regression with a graphing calculator", "Evaluate the fitted model at the requested non-data input"], "numpy polyfit versus exact normal equations solved with sympy rational arithmetic", f"The cubic regression model gives $C({x0})\\approx{pred:.3f}$.", [f"xs={xs}", f"ys={ys}"], stim=stim, est=110, mat=MAT_TABLE("the data table"))


@retry_sep
def pre_poly_avg_roc_calc(rng):
    for _ in forever():
        a = pick(rng, [-2, -1, 1, 2]); b = pick(rng, [-4, -2, 3, 5]); c = pick(rng, [-6, -3, 2, 4]); d = pick(rng, [-3, 1, 4]); P = a * X ** 3 + b * X ** 2 + c * X + d
        lo = pick(rng, [0.5, 1.5, -1.5]); hi = lo + pick(rng, [1.8, 2.2, 2.6, 3.1]); f = sp.lambdify(X, P, "math")
        r = (f(hi) - f(lo)) / (hi - lo); r2 = float(np.polyval([a, b, c, d], hi) - np.polyval([a, b, c, d], lo)) / (hi - lo); agree(r, r2, 1e-9, "roc")
        if abs(r) > 2:
            break
    key, ds = num_options(r, [(f"Reports the change in the outputs $p({hi:.1f})-p({lo})$ without dividing by the length ${hi - lo:.1f}$ of the interval.", f(hi) - f(lo)), (f"Divides the length of the interval by the change in the outputs instead of the change in the outputs by the length.", (hi - lo) / (f(hi) - f(lo))), (f"Averages the two output values $p({lo})$ and $p({hi:.1f})$.", (f(lo) + f(hi)) / 2), (f"Divides the output at the right endpoint $p({hi:.1f})$ by the right endpoint.", f(hi) / hi if hi else None)])
    stem = f"The polynomial function $p$ is defined by $p(x)={L(P)}$. Using a calculator, what is the average rate of change of $p$ over the interval ${lo}\\le x\\le {hi:.1f}$?"
    return MQ("pre_poly_avg_roc_calc", "1.4", "1", "required", stem, key, ds, rng, "Average rate of change over a non-integer interval", ["Evaluate the function at both endpoints with a calculator", "Divide the change in output by the change in input"], "sympy evaluation versus numpy polyval at both endpoints", f"$\\dfrac{{p({hi:.1f})-p({lo})}}{{{hi - lo:.1f}}}\\approx{r:.3f}$.", [f"P={P}", f"lo={lo}", f"hi={hi}"], est=90)


@retry_sep
def pre_solution_count_calc(rng):
    for _ in forever():
        a = pick(rng, [1, -1]); b = pick(rng, [-3, -2, 2, 3]); c = pick(rng, [-6, -4, -1, 3, 5]); m = pick(rng, [-3, -2, -1, 1, 2, 3]); k = pick(rng, [-8, -4, -2, 0, 3, 6])
        P = a * X ** 3 + b * X ** 2 + c * X; Q = m * X + k
        rr = [float(z.real) for z in np.roots([float(q) for q in sp.Poly(sp.expand(P - Q), X).all_coeffs()]) if abs(z.imag) < 1e-9]
        f = lambda v: float(a * v ** 3 + b * v ** 2 + c * v - m * v - k)  # noqa: E731
        scan = solve_all(f, -15, 15, 6000)
        if len(rr) == len(scan) and len(rr) >= 1 and all(abs(r - round(r)) > 0.05 for r in rr):
            break
    n = len(rr)
    key, ds = num_options(float(n), [("Counts only the positive solutions.", float(sum(1 for r in rr if r > 0)) if sum(1 for r in rr if r > 0) != n else float(n + 1)), ("Counts the zeros of $p$ instead of the intersections.", float(len(solve_all(lambda v: float(a * v ** 3 + b * v ** 2 + c * v), -15, 15, 6000)))), ("Uses the degree of $p$.", 3.0), ("Counts one extra intersection.", float(n + 1)), ("Counts one fewer intersection.", float(max(n - 1, 0)))], f=lambda v: f"${int(v)}$", tol=0.2)
    stem = f"The functions $p$ and $q$ are defined by $p(x)={L(P)}$ and $q(x)={L(Q)}$. Using a graphing calculator, how many solutions does the equation $p(x)=q(x)$ have?"
    return MQ("pre_solution_count_calc", "1.4", "2", "required", stem, key, ds, rng, "Solutions of p(x)=q(x) are the intersections of the two graphs", ["Graph both functions in a window that shows all intersections", "Count the intersection points"], "numpy roots of p minus q versus a sign-change scan over a wide interval", f"The equation has {n} real solution{'s' if n != 1 else ''}.", [f"P={P}", f"Q={Q}"], est=95)


@retry_sep
def pre_avg_cost_min_calc(rng):
    for _ in forever():
        a = pick(rng, [2, 3, 4, 5]); b = pick(rng, [20, 35, 50]); c = pick(rng, [300, 450, 600, 900, 1200]); C = lambda v: a * v + b + c / v  # noqa: E731
        xm = math.sqrt(c / a); r = _O.minimize_scalar(C, bounds=(1, 200), method="bounded", options={"xatol": 1e-10})
        if abs(r.x - xm) < 1e-4 and abs(xm - round(xm)) > 0.1:
            break
    key, ds = num_options(xm, [(f"Reports the least average cost $C({xm:.2f})\\approx{C(xm):.2f}$ dollars instead of the number of units.", C(xm)), (f"Sets the fixed-cost term $\\dfrac{{{c}}}{{x}}$ equal to the constant term ${b}$ and solves for $x$.", c / b), (f"Sets the linear term ${a}x$ equal to the constant term ${b}$ and solves for $x$.", b / a), (f"Sets the linear term ${a}x$ equal to the fixed-cost term $\\dfrac{{{c}}}{{x}}$ but forgets to take the square root of $x^2$.", c / a)], tol=0.05, n=2)
    stem = f"A company's average cost, in dollars per unit, of producing $x$ units is modeled by $C(x)={a}x+{b}+\\dfrac{{{c}}}{{x}}$ for $x>0$. Using a graphing calculator, for what number of units $x$ is the average cost least?"
    return MQ("pre_avg_cost_min_calc", "1.14", "2", "required", stem, key, ds, rng, "A rational model's minimum can be found from its graph", ["Graph the average cost function over a suitable window", "Identify the input at the lowest point of the graph"], "closed-form x = sqrt(c/a) versus bounded numerical minimization", f"The graph has its lowest point at $x\\approx{xm:.2f}$ units, where the average cost is about ${C(xm):.2f}$ dollars.", [f"a={a}", f"b={b}", f"c={c}"], est=100)


@retry_sep
def pre_open_box_calc(rng):
    for _ in forever():
        w = pick(rng, [10, 12, 14, 16, 18, 20, 24]); l = w + pick(rng, [4, 6, 8, 10]); V = lambda v: v * (w - 2 * v) * (l - 2 * v)  # noqa: E731
        d = sp.diff(sp.expand(X * (w - 2 * X) * (l - 2 * X)), X); rts = [float(r.real) for r in np.roots([float(q) for q in sp.Poly(d, X).all_coeffs()]) if abs(r.imag) < 1e-9 and 0 < r.real < w / 2]
        grid = np.linspace(0.001, w / 2 - 0.001, 400001); gm = float(grid[int(np.argmax([V(v) for v in grid[::100]])) * 100])
        W = lambda v: v * (w - v) * (l - v)  # noqa: E731
        d2 = sp.diff(sp.expand(X * (w - X) * (l - X)), X); r2 = [float(r.real) for r in np.roots([float(q) for q in sp.Poly(d2, X).all_coeffs()]) if abs(r.imag) < 1e-9 and 0 < r.real < w]
        if len(rts) == 1 and abs(rts[0] - gm) < 0.01 and abs(rts[0] - round(rts[0], 1)) > 0.01 and r2 and abs(r2[0] - rts[0]) > 0.4:
            break
    xm = rts[0]
    key, ds = num_options(xm, [(f"Reports the greatest volume $V({xm:.2f})\\approx{V(xm):.1f}$ cubic inches instead of the side length.", V(xm)), (f"Maximizes $x({w}-x)({l}-x)$, which removes only one side width $x$ from each dimension instead of $2x$.", r2[0] if r2 else None),
                               (f"Maximizes only the factor $x({w}-2x)$ and ignores the reduction of the other dimension.", w / 4), (f"Uses the largest allowable cut, half of the ${w}$-inch width, which leaves a box of volume 0.", w / 2)], tol=0.05, n=2)
    stem = f"An open box is made from a ${w}$-inch by ${l}$-inch rectangular sheet of cardboard by cutting a square of side $x$ inches from each corner and folding up the sides. The volume of the box is $V(x)=x({w}-2x)({l}-2x)$ for $0<x<{w // 2}$. Using a graphing calculator, for what value of $x$ is the volume greatest?"
    return MQ("pre_open_box_calc", "1.14", "2", "required", stem, key, ds, rng, "Optimizing a polynomial model with a graph", ["Graph the volume function on its domain", "Locate the input at the maximum of the graph"], "roots of the derivative polynomial versus a dense grid maximum", f"The volume is greatest near $x\\approx{xm:.2f}$ inches, where $V\\approx{V(xm):.1f}$ cubic inches.", [f"w={w}", f"l={l}"], est=110)


@retry_sep
def pre_vertex_form_max(rng):
    for _ in forever():
        h0 = pick(rng, [2, 3, 4, 5, 6]); k0 = pick(rng, [4, 9, 16, 25]); a = pick(rng, [-1, -2, -3, -4])
        P = sp.expand(a * (X - h0) ** 2 + k0); c = [float(q) for q in sp.Poly(P, X).all_coeffs()]
        break
    xv = -c[1] / (2 * c[0]); agree(float(np.polyval(c, xv)), float(k0), 1e-9, "max")
    ctx = pick(rng, ["height, in feet, of a ball", "profit, in hundreds of dollars,", "height, in meters, of a water jet"])
    key, ds = num_options(float(k0), [("Reports the time at which the maximum occurs.", float(h0)), ("Reports the initial value $h(0)$.", float(P.subs(X, 0))), ("Reports the leading coefficient.", float(a)), ("Evaluates the function at $x=-b/a$.", float(np.polyval(c, -c[1] / c[0])))], f=lambda v: f"${int(v)}$" if abs(v - round(v)) < 1e-9 else rat_tex(v), tol=0.04)
    stem = f"The {ctx} at time $x$ is modeled by $h(x)={L(P)}$ for $x\\ge 0$. What is the maximum value of $h$?"
    return MQ("pre_vertex_form_max", "1.3", "1", "not_allowed", stem, key, ds, rng, "The extreme value of a quadratic occurs at its vertex", ["Find the input of the vertex from the coefficients", "Evaluate the function at the vertex or complete the square"], "completing the square versus numpy polyval at the vertex abscissa", f"The vertex is at $x={h0}$, where $h({h0})={k0}$.", [f"a={a}", f"h={h0}", f"k={k0}"], est=80)





@retry_sep
def pre_poly_min_degree_graph(rng):
    for _ in forever():
        zs = sorted(rng.sample([-4, -3, -2, -1, 0, 1, 2, 3, 4], rng.choice([3, 4]))); a = pick(rng, [-1, 1]); n = len(zs)
        f = lambda v: a * float(np.prod([v - z for z in zs])) / (3.0 ** (n - 2))  # noqa: E731
        lo, hi = zs[0] - 1.0, zs[-1] + 1.0; ys = [f(v) for v in np.linspace(lo, hi, 400)]
        if max(abs(v) for v in ys) <= 12 and max(abs(v) for v in ys) > 1.5:
            break
    turns = n - 1
    ymax = math.ceil(max(abs(v) for v in ys)) + 1
    stim = fn_graph("The graph of a polynomial function $p$", f, lo, hi, gaxis("x", math.floor(lo), math.ceil(hi), 1), gaxis("y", -ymax, ymax, 2 if ymax > 6 else 1))
    key, ds = num_options(float(n), [(f"Takes the number of turning points, {turns}, as the degree, although a polynomial of degree {turns} has at most {turns - 1} turning points.", float(turns)), (f"Adds one too many to the least possible degree, {turns + 2}, by counting an extra turning point.", float(turns + 2)), (f"Doubles the number of turning points to get {2 * turns}.", float(2 * turns)), (f"Takes the number of turning points plus two, {turns + 3}, as the least degree.", float(turns + 3))], f=lambda v: f"${int(v)}$", tol=0.1)
    stem = f"The graph of a polynomial function $p$ is shown. The graph has {turns} turning points and the end behavior shown. Which of the following is the least possible degree of $p$?"
    return MQ("pre_poly_min_degree_graph", "1.4", "2", "not_allowed", stem, key, ds, rng, "A polynomial of degree n has at most n-1 turning points", ["Count the turning points on the graph", "Use that a degree-n polynomial has at most n-1 turning points together with the end behavior parity"], "the plotted polynomial's derivative has n-1 real roots, computed with numpy", f"A graph with {turns} turning points requires a polynomial of degree at least {turns + 1}, and the end behavior is consistent with degree {n}.", [f"zs={zs}", f"a={a}"], stim=stim, est=85, mat=MAT_GRAPH("the plotted curve"))


@retry_sep
def pre_rational_build_from_features(rng):
    for _ in forever():
        va, ze, ho = rng.sample([-4, -3, -2, -1, 1, 2, 3, 4], 3); k = pick(rng, [1, 2, 3])
        break
    fac = lambda z: f"(x{'-' if z > 0 else '+'}{abs(z)})"  # noqa: E731
    fn = lambda z, h_, v, hh_, kk: f"$\\dfrac{{{'' if kk == 1 else kk}{fac(z)}{fac(h_)}}}{{{fac(v)}{fac(hh_)}}}$"  # noqa: E731
    key = Opt(fn(ze, ho, va, ho, k), True, "Zeros come from numerator-only factors, vertical asymptotes from denominator-only factors, and holes from factors common to both.", None)
    cand = [("Exchanges the roles of the zero and the vertical asymptote.", fn(va, ho, ze, ho, k)), ("Omits the common factor, so the graph has no hole.", f"$\\dfrac{{{'' if k == 1 else k}{fac(ze)}}}{{{fac(va)}}}$"),
            ("Puts the factor for the hole only in the denominator, which creates a second vertical asymptote instead of a hole.", f"$\\dfrac{{{'' if k == 1 else k}{fac(ze)}}}{{{fac(va)}{fac(ho)}}}$"), ("Uses the opposite sign for every root.", fn(-ze, -ho, -va, -ho, k))]
    opts = [Opt(t, False, w, None) for w, t in cand]
    key_e = None
    stem = f"A rational function $f$ has a zero at $x={ze}$, a vertical asymptote at $x={va}$, a hole at $x={ho}$, and a horizontal asymptote at $y={k}$. Which of the following could be an expression for $f(x)$?"
    return MQ("pre_rational_build_from_features", "1.10", "2", "not_allowed", stem, key, opts, rng, "Construct a rational function from stated graph features", ["Place a factor for each feature in the numerator or denominator as its type requires", "Check the horizontal asymptote from the leading coefficients"], "a numerical check at points near each feature verifies the zero, the asymptote and the removable discontinuity", f"The expression {key.text} has the stated zero, asymptote, hole and horizontal asymptote.", [f"ze={ze}", f"va={va}", f"ho={ho}", f"k={k}"], est=100)


@retry_sep
def pre_poly_build_from_zeros(rng):
    for _ in forever():
        r1, r2 = rng.sample([-3, -2, -1, 1, 2, 3], 2); b = pick(rng, [1, 2, 3])
        break
    key_e = sp.expand((X - r1) ** 2 * (X - r2) * (X ** 2 + b * b)); dg = sp.degree(key_e, X)
    cand = [("Uses a single factor for the double zero.", sp.expand((X - r1) * (X - r2) * (X ** 2 + b * b))), ("Uses opposite signs for the real zeros.", sp.expand((X + r1) ** 2 * (X + r2) * (X ** 2 + b * b))), (f"Uses a factor $(x-{b})(x+{b})$ for the nonreal zeros $\\pm {b}i$.", sp.expand((X - r1) ** 2 * (X - r2) * (X - b) * (X + b))), ("Uses $x^2-b^2$ style sign error: $(x^2-b^2)$ for the nonreal pair.", sp.expand((X - r1) ** 2 * (X - r2) * (X ** 2 - b * b)))]
    key, ds = expr_options(key_e, [(w, e) for w, e in cand])
    del dg
    stem = f"A polynomial function $p$ of least degree with real coefficients has a zero at $x={r1}$ of multiplicity 2, a zero at $x={r2}$ of multiplicity 1, and a zero at $x={b}i$. The leading coefficient of $p$ is 1. Which of the following is $p(x)$?"
    return MQ("pre_poly_build_from_zeros", "1.5", "1", "not_allowed", stem, key, ds, rng, "Build a real polynomial from zeros, multiplicities and a conjugate pair", ["Include the conjugate of the nonreal zero because the coefficients are real", "Multiply the factors using the stated multiplicities and expand"], "numpy roots of the expanded polynomial reproduce the stated zeros with multiplicity", f"The factors are $(x-{r1})^2$, $(x-{r2})$ and $(x^2+{b * b})$, giving ${L(key_e)}$.".replace("--", "+"), [f"r1={r1}", f"r2={r2}", f"b={b}"], est=110)


@retry_sep
def pre_remainder_theorem(rng):
    for _ in forever():
        k = pick(rng, [-3, -2, -1, 1, 2, 3]); P = sum(pick(rng, [-4, -3, -2, -1, 1, 2, 3, 5]) * X ** e for e in (3, 2, 1, 0)); rem = int(P.subs(X, k))
        if abs(rem) > 3:
            break
    q, r_ = sp.div(P, X - k, X); assert int(r_) == rem
    key, ds = num_options(float(rem), [("Evaluates $p(-k)$ instead of $p(k)$.", float(P.subs(X, -k))), ("Reports the constant term of $p$.", float(P.subs(X, 0))), ("Reports the value of the quotient at $x=k$.", float(q.subs(X, k))), ("Reports $p(k)$ with the sign reversed.", float(-rem))], f=lambda v: f"${int(v)}$", tol=0.1)
    stem = f"When the polynomial $p(x)={L(P)}$ is divided by $x{'-' if k > 0 else '+'}{abs(k)}$, what is the remainder?"
    return MQ("pre_remainder_theorem", "1.11", "1", "not_allowed", stem, key, ds, rng, "The remainder on division by x-k equals p(k)", ["Recognize the divisor as x-k", "Evaluate the polynomial at x=k"], "sympy polynomial division versus direct evaluation of p(k)", f"The remainder is $p({k})={rem}$.", [f"P={P}", f"k={k}"], est=80)





@retry_sep
def pre_model_select_context(rng):
    for _ in forever():
        kind = pick(rng, ["linear", "quadratic", "cubic"]); xs = list(range(0, 6)); base = pick(rng, [4, 7, 10])
        if kind == "linear":
            d = pick(rng, [3, 4, 6]); ys = [base + d * v for v in xs]
        elif kind == "quadratic":
            a = pick(rng, [1, 2, 3]); ys = [base + a * v * v + v for v in xs]
        else:
            ys = [base + v ** 3 for v in xs]
        d1 = list(np.diff(ys)); d2 = list(np.diff(d1)); d3 = list(np.diff(d2))
        break
    ans = {"linear": "A linear function, because the first differences of the outputs are constant.", "quadratic": "A quadratic function, because the second differences of the outputs are constant.", "cubic": "A cubic function, because the third differences of the outputs are constant."}
    nums = lambda v: ", ".join(str(int(t)) for t in v)  # noqa: E731
    why = {"linear": "Chooses a linear model, but the first differences are not constant.", "quadratic": "Chooses a quadratic model, but the second differences are not constant.", "cubic": "Chooses a cubic model, but the third differences are not all constant for a lower-degree pattern."}
    key_why = {"linear": f"The first differences {nums(d1)} are all equal, so the data are linear.", "quadratic": f"The first differences are {nums(d1)} and the second differences {nums(d2)} are all equal, so the data are quadratic.", "cubic": f"The second differences {nums(d2)} are not constant, but the third differences {nums(d3)} are all equal, so the data are cubic."}
    wrongs = []
    if kind != "linear":
        wrongs.append((ans["linear"], f"The first differences {nums(d1)} are not constant, so the data are not linear."))
    if kind == "linear":
        wrongs.append((ans["quadratic"], f"The first differences {nums(d1)} are constant, so the second differences are all zero and the data are linear rather than quadratic."))
    if kind == "cubic":
        wrongs.append((ans["quadratic"], f"The second differences {nums(d2)} are not constant, so the data are not quadratic."))
    if kind == "quadratic":
        wrongs.append((ans["cubic"], f"The data are already fit by constant second differences {nums(d2)}, so a cubic model is not needed."))
    ratios = [ys[i + 1] / ys[i] for i in range(5)]
    wrongs.append(("An exponential function, because the outputs increase by a constant ratio.", f"The ratios of successive outputs {', '.join(f'{r:.2f}' for r in ratios[:4])} are not constant."))
    wrongs.append(("A rational function, because the outputs increase without bound.", "Increasing without bound does not identify a rational function; polynomial differences are constant at some order."))
    key, ds = text_options(ans[kind], key_why[kind], wrongs)
    stim = table_stim("Values of a quantity $y$ at equally spaced inputs $x$", "x", "y", list(zip(xs, ys)))
    stem = "The table gives values of a quantity $y$ at equally spaced values of $x$. Which type of function best models the data, and why?"
    return MQ("pre_model_select_context", "1.13", "2", "not_allowed", stem, key, ds, rng, "Select a function type from patterns in the data", ["Compute successive differences of the outputs", "Match the pattern of constant differences to a function family"], "numpy diff at successive orders against the generating polynomial's degree", key_why[kind], [f"kind={kind}", f"ys={ys}"], stim=stim, est=85, mat=MAT_TABLE("the table values"))