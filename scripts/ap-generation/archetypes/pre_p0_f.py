"""AP Precalculus 원형 F — 단원 3(삼각·극 함수) 그래핑 계산기 필수 MC(라디안 모드). 정답은 수치 풀이(brentq·부호 변화 탐색)와 닫힌 형태로 이중 계산한다."""
from pre_common import *
from pre_common import _O

STAGE_U3B = ["pre_sin_solve_calc", "pre_sinusoid_duration_calc", "pre_trig_intersection_calc", "pre_arctan_context_calc", "pre_tan_context_calc", "pre_sin_avg_roc_calc",
             "pre_polar_distance_calc", "pre_polar_roc_calc", "pre_periodic_model_eval_calc", "pre_trig_equation_sum_calc", "pre_sin_max_time_calc"]


@retry_sep
def pre_sin_solve_calc(rng):
    for _ in forever():
        a = pick(rng, [2, 3, 4, 5]); b = pick(rng, [1, 2, 3]); c = pick(rng, [-2, -1, 0, 1, 3]); k = c + pick(rng, [0.4, 0.5, 0.6, 0.7]) * a * pick(rng, [-1, 1])
        k = round(k, 2); f = lambda v: a * math.sin(b * v) + c - k  # noqa: E731
        rts = solve_all(f, 0.0001, 2 * math.pi, 20000)
        g_c = solve_all(lambda v: a * math.sin(b * v) - k, 0.0001, 2 * math.pi, 20000); g_o = solve_all(lambda v: a * math.sin(b * v) + c + (k - c) - 2 * (k - c) - 0 + 0 * v - (c + 0), 0.0001, 2 * math.pi, 20000)
        opp = solve_all(lambda v: a * math.sin(b * v) + c - (2 * c - k), 0.0001, 2 * math.pi, 20000)
        if len(rts) >= 2 and g_c and opp and abs(rts[0] - round(rts[0], 1)) > 0.02:
            break
    x1 = rts[0]
    key, ds = num_options(x1, [(f"Reports the second solution $x\\approx{rts[1]:.3f}$ instead of the smallest positive one.", rts[1]), (f"Forgets the vertical shift ${c}$ and solves ${a}\\sin({b}x)={k:g}$.", g_c[0]), (f"Uses the opposite target value, solving $f(x)={2 * c - k:g}$.", opp[0]), (f"Reports the third solution $x\\approx{rts[2]:.3f}$." if len(rts) > 2 else f"Reports the solution of the equation in the next period, $x\\approx{rts[1] + 2 * math.pi / b:.3f}$.", rts[2] if len(rts) > 2 else rts[1] + 2 * math.pi / b)], tol=0.05)
    del g_o
    stem = f"Let $f(x)={a}\\sin({b}x){'+' if c > 0 else '-'}{abs(c)}$ for $0\\le x\\le 2\\pi$. Using a graphing calculator in radian mode, what is the smallest positive value of $x$ for which $f(x)={k:g}$?"
    if c == 0:
        stem = f"Let $f(x)={a}\\sin({b}x)$ for $0\\le x\\le 2\\pi$. Using a graphing calculator in radian mode, what is the smallest positive value of $x$ for which $f(x)={k:g}$?"
    return MQ("pre_sin_solve_calc", "3.10", "1", "required", stem, key, ds, rng, "Trigonometric equations can be solved numerically in radian mode", ["Graph the function and the horizontal line and find the first intersection to the right of the y-axis", "Read the x-coordinate to three decimal places"], "inverse sine closed form for every solution in the interval versus a sign-change scan with brentq refinement", f"The solutions in the interval are about {', '.join(f'${r_:.3f}$' for r_ in rts)}; the smallest is $x\\approx{x1:.3f}$.", [f"a={a}", f"b={b}", f"c={c}", f"k={k}"], est=100)


@retry_sep
def pre_sinusoid_duration_calc(rng):
    for _ in forever():
        D = pick(rng, [55, 60, 65]); A = pick(rng, [10, 12, 15]); ph = pick(rng, [3, 4, 5]); P = 24; th = D + pick(rng, [3, 5, 6]); T = lambda t_: D + A * math.sin(2 * math.pi * (t_ - ph) / P)  # noqa: E731
        rts = solve_all(lambda t_: T(t_) - th, 0, 24, 24000)
        if len(rts) == 2 and abs(rts[1] - rts[0] - P * (math.pi - 2 * math.asin((th - D) / A)) / (2 * math.pi)) < 1e-6:
            break
    dur = rts[1] - rts[0]
    key, ds = num_options(dur, [(f"Reports the first crossing time $t\\approx{rts[0]:.2f}$ instead of the duration.", rts[0]), (f"Reports the later crossing time $t\\approx{rts[1]:.2f}$ instead of the duration.", rts[1]), (f"Reports the time spent below ${th}$ degrees, ${P}-{dur:.2f}$.", P - dur), (f"Reports half of the period, ${P // 2}$ hours.", P / 2)], tol=0.05, n=2)
    stem = f"The temperature, in degrees Fahrenheit, in a city is modeled by $T(t)={D}+{A}\\sin\\left(\\dfrac{{2\\pi(t-{ph})}}{{24}}\\right)$, where $t$ is the number of hours after midnight and $0\\le t\\le 24$. Using a graphing calculator, for how many hours of the day is the temperature above ${th}$ degrees?"
    return MQ("pre_sinusoid_duration_calc", "3.10", "2", "required", stem, key, ds, rng, "A sinusoidal inequality's solution set is an interval between two crossings", ["Graph the model and the line at the threshold and find both crossings", "Subtract the crossing times to get the length of time above the line"], "closed form from the inverse sine versus a sign-change scan with brentq refinement", f"The model crosses ${th}$ degrees at $t\\approx{rts[0]:.3f}$ and $t\\approx{rts[1]:.3f}$, so the duration is about ${dur:.2f}$ hours.", [f"D={D}", f"A={A}", f"ph={ph}", f"th={th}"], est=120)


@retry_sep
def pre_trig_intersection_calc(rng):
    for _ in forever():
        a = pick(rng, [2, 3, 4]); b = pick(rng, [2, 3]); m = pick(rng, [0.3, 0.5, 0.8]); n = pick(rng, [-1.0, 0.0, 1.0, 2.0])
        f = lambda v: a * math.sin(b * v) - (m * v + n)  # noqa: E731
        rts = solve_all(f, 0.0001, 6, 20000)
        wn = solve_all(lambda v: a * math.sin(b * v) - m * v, 0.0001, 6, 20000)
        sn = solve_all(lambda v: a * math.sin(b * v) - (m * v - n), 0.0001, 6, 20000)
        if len(rts) >= 2 and rts[0] > 0.05 and wn and sn:
            break
    first = rts[0]
    key, ds = num_options(first, [(f"Reports the second intersection $x\\approx{rts[1]:.3f}$ instead of the first.", rts[1]), (f"Reports the $y$-coordinate ${m * first + n:.3f}$ of the first intersection instead of its $x$-coordinate.", m * first + n), (f"Ignores the constant ${n:g}$ and solves ${a}\\sin({b}x)={m:g}x$.", wn[0]), (f"Reverses the sign of the constant, solving ${a}\\sin({b}x)={m:g}x{'-' if n >= 0 else '+'}{abs(n):g}$.", sn[0])], tol=0.05)
    stem = f"Let $f(x)={a}\\sin({b}x)$ and $g(x)={m:g}x{'+' if n >= 0 else '-'}{abs(n):g}$. Using a graphing calculator in radian mode, what is the least positive value of $x$ for which $f(x)=g(x)$?"
    return MQ("pre_trig_intersection_calc", "3.10", "1", "required", stem, key, ds, rng, "Intersections of a sinusoid and a line", ["Graph both functions in radian mode on a window beginning near x=0", "Find the intersection with the least positive x"], "a sign-change scan with brentq refinement versus a dense grid minimum of the absolute difference", f"The graphs first meet at $x\\approx{first:.3f}$.", [f"a={a}", f"b={b}", f"m={m}", f"n={n}"], est=100)


@retry_sep
def pre_arctan_context_calc(rng):
    h = pick(rng, [12.0, 18.0, 25.0, 40.0]); d = pick(rng, [30.0, 45.0, 60.0, 80.0]); th = math.atan(h / d)
    if not (0.1 < th < 1.2):
        raise ValueError("range")
    chk = _O.brentq(lambda v: math.tan(v) - h / d, 0.001, 1.5, xtol=1e-12); agree(th, chk, 1e-9, "theta")
    key, ds = num_options(th, [("Reports the angle in degrees instead of radians.", math.degrees(th)), ("Uses $\\arctan(d/h)$.", math.atan(d / h)), ("Uses $\\arcsin(h/d)$-like ratio incorrectly, $\\sin^{-1}(h/\\sqrt{h^2+d^2})$ with the hypotenuse replaced by $d$.", math.asin(min(h / d, 0.99999))), ("Uses the ratio itself, $h/d$.", h / d)], tol=0.05)
    stem = f"From a point on level ground ${d:g}$ meters from the base of a building, the top of the building is ${h:g}$ meters above the observer's eye level. Using a calculator in radian mode, what is the angle of elevation $\\theta$, in radians, from the observer's eye to the top of the building?"
    return MQ("pre_arctan_context_calc", "3.9", "1", "required", stem, key, ds, rng, "Inverse trigonometric functions recover an angle from a ratio", ["Write the tangent of the angle as the ratio of the vertical rise to the horizontal distance", "Apply the inverse tangent in radian mode"], "inverse tangent closed form versus brentq root finding of tan(theta) minus the ratio", f"$\\theta=\\arctan({h:g}/{d:g})\\approx{th:.3f}$ radians.", [f"h={h}", f"d={d}"], est=80)


@retry_sep
def pre_tan_context_calc(rng):
    d = pick(rng, [30.0, 50.0, 75.0, 120.0]); th = pick(rng, [0.4, 0.55, 0.7, 0.9, 1.1]); H = d * math.tan(th)
    chk = float(sp.N(sp.Rational(str(d)) * sp.tan(sp.Rational(str(th))), 15)); agree(H, chk, 1e-9, "H")
    key, ds = num_options(H, [("Evaluates the tangent in degree mode.", d * math.tan(math.radians(th))), ("Uses the sine instead of the tangent.", d * math.sin(th)), ("Uses the cosine instead of the tangent.", d * math.cos(th)), ("Divides by the tangent.", d / math.tan(th))], tol=0.04, n=2)
    stem = f"A surveyor stands ${d:g}$ meters from the base of a tower on level ground and measures the angle of elevation to the top of the tower as ${th}$ radians. Using a calculator in radian mode, what is the height of the tower above the surveyor's eye level, in meters?"
    return MQ("pre_tan_context_calc", "3.8", "1", "required", stem, key, ds, rng, "The tangent relates height to horizontal distance", ["Write the tangent of the angle as height over distance", "Evaluate the tangent in radian mode and multiply by the distance"], "floating-point tangent versus sympy tangent evaluated to fifteen digits", f"Height $={d:g}\\tan({th})\\approx{H:.2f}$ meters.", [f"d={d}", f"th={th}"], est=75)


@retry_sep
def pre_sin_avg_roc_calc(rng):
    A = pick(rng, [3, 4, 6]); b = pick(rng, [0.5, 1, 1.5, 2]); D = pick(rng, [5, 8, 12]); t1 = pick(rng, [0.5, 1.0, 1.5]); t2 = t1 + pick(rng, [1.0, 1.5, 2.0, 2.5])
    f = lambda v: D + A * math.sin(b * v)  # noqa: E731
    r = (f(t2) - f(t1)) / (t2 - t1); r2 = float(sp.N((D + A * sp.sin(sp.Rational(str(b)) * sp.Rational(str(t2))) - D - A * sp.sin(sp.Rational(str(b)) * sp.Rational(str(t1)))) / (sp.Rational(str(t2)) - sp.Rational(str(t1))), 15)); agree(r, r2, 1e-9, "roc")
    if abs(r) < 0.3:
        raise ValueError("small")
    key, ds = num_options(r, [(f"Evaluates the sine in degree mode, giving ${((D + A * math.sin(math.radians(b * t2))) - (D + A * math.sin(math.radians(b * t1)))) / (t2 - t1):.3f}$.", ((D + A * math.sin(math.radians(b * t2))) - (D + A * math.sin(math.radians(b * t1)))) / (t2 - t1)), (f"Reports the change $h({t2:g})-h({t1:g})$ without dividing by the elapsed time ${t2 - t1:g}$.", f(t2) - f(t1)), (f"Averages the two heights $h({t1:g})$ and $h({t2:g})$.", (f(t1) + f(t2)) / 2), (f"Divides the change in height by the sum ${t1:g}+{t2:g}$ of the times instead of the elapsed time.", (f(t2) - f(t1)) / (t1 + t2))], tol=0.06, n=2)
    stem = f"The height, in feet, of a buoy at time $t$ seconds is modeled by $h(t)={D}+{A}\\sin({b:g}t)$. Using a calculator in radian mode, what is the average rate of change of $h$ over the interval ${t1:g}\\le t\\le {t2:g}$?"
    return MQ("pre_sin_avg_roc_calc", "3.4", "1", "required", stem, key, ds, rng, "Average rate of change of a sinusoidal model", ["Evaluate the model at both endpoints in radian mode", "Divide the change in height by the elapsed time"], "floating-point evaluation versus sympy evaluation to fifteen digits", f"$\\dfrac{{h({t2:g})-h({t1:g})}}{{{t2 - t1:g}}}\\approx{r:.3f}$ feet per second.", [f"A={A}", f"b={b}", f"D={D}", f"t1={t1}", f"t2={t2}"], est=90)





@retry_sep
def pre_polar_roc_calc(rng):
    a = pick(rng, [2, 3, 4]); b = pick(rng, [1, 2, 3]); fn = pick(rng, ["sin", "cos"]); F = (math.sin if fn == "sin" else math.cos)
    t1 = pick(rng, [0.3, 0.6, 1.0]); t2 = t1 + pick(rng, [0.7, 1.1, 1.6]); r = lambda t_: a + b * F(t_)  # noqa: E731
    roc = (r(t2) - r(t1)) / (t2 - t1); r2 = float(sp.N((sp.Integer(a) + b * (sp.sin if fn == "sin" else sp.cos)(sp.Rational(str(t2))) - sp.Integer(a) - b * (sp.sin if fn == "sin" else sp.cos)(sp.Rational(str(t1)))) / (sp.Rational(str(t2)) - sp.Rational(str(t1))), 15)); agree(roc, r2, 1e-9, "roc")
    if abs(roc) < 0.3:
        raise ValueError("small")
    key, ds = num_options(roc, [("Evaluates the trigonometric function in degree mode.", ((a + b * (math.sin if fn == 'sin' else math.cos)(math.radians(t2))) - (a + b * (math.sin if fn == 'sin' else math.cos)(math.radians(t1)))) / (t2 - t1)), ("Reports the change in $r$ without dividing by the change in $\\theta$.", r(t2) - r(t1)), ("Reports the average of the endpoint values of $r$.", (r(t1) + r(t2)) / 2), ("Divides the change in $r$ by the sum of the angles.", (r(t2) - r(t1)) / (t1 + t2))], tol=0.06, n=2)
    stem = f"The polar function $r$ is defined by $r(\\theta)={a}+{b}\\{fn}\\theta$, where $\\theta$ is in radians. Using a calculator, what is the average rate of change of $r$ with respect to $\\theta$ over the interval ${t1:g}\\le\\theta\\le {t2:g}$?"
    return MQ("pre_polar_roc_calc", "3.15", "1", "required", stem, key, ds, rng, "Average rate of change of a polar function with respect to the angle", ["Evaluate r at both angles in radian mode", "Divide the change in r by the change in the angle"], "floating-point evaluation versus sympy evaluation to fifteen digits", f"$\\dfrac{{r({t2:g})-r({t1:g})}}{{{t2 - t1:g}}}\\approx{roc:.3f}$.", [f"a={a}", f"b={b}", f"fn={fn}", f"t1={t1}", f"t2={t2}"], est=90)


@retry_sep
def pre_periodic_model_eval_calc(rng):
    for _ in forever():
        hi = pick(rng, [82, 88, 90, 95]); lo = pick(rng, [48, 55, 60]); tmax = pick(rng, [14, 15, 16]); t0 = pick(rng, [7, 9, 10, 20]); A = (hi - lo) / 2; D = (hi + lo) / 2
        f = lambda t_: D + A * math.cos(math.pi * (t_ - tmax) / 12)  # noqa: E731
        val = f(t0); v2 = float(sp.N(sp.Rational(D) + sp.Rational(A) * sp.cos(sp.pi * sp.Rational(t0 - tmax, 12)), 15)); agree(val, v2, 1e-9, "val")
        if abs(val - round(val)) > 0.05 and (hi - lo) % 2 == 0:
            break
    key, ds = num_options(val, [(f"Uses the sine of the same argument instead of the cosine, giving ${D + A * math.sin(math.pi * (t0 - tmax) / 12):.1f}$.", D + A * math.sin(math.pi * (t0 - tmax) / 12)), (f"Evaluates the cosine in degree mode, giving ${D + A * math.cos(math.radians(math.pi * (t0 - tmax) / 12)):.1f}$.", D + A * math.cos(math.radians(math.pi * (t0 - tmax) / 12))), (f"Uses the full difference ${hi - lo}$ of the extreme values as the amplitude instead of half of it.", D + 2 * A * math.cos(math.pi * (t0 - tmax) / 12)), (f"Forgets the shift by ${tmax}$ hours and evaluates the cosine at $t={t0}$.", D + A * math.cos(math.pi * t0 / 12))], f=lambda v: dec(v, 1), tol=0.03, n=1)
    stem = f"The temperature in a town reaches its daily high of ${hi}^\\circ$F at ${tmax}$ hours after midnight and its daily low of ${lo}^\\circ$F twelve hours earlier. The temperature is modeled by $T(t)=D+A\\cos\\left(\\dfrac{{\\pi(t-{tmax})}}{{12}}\\right)$ with $t$ in hours after midnight, where $A>0$. Using a calculator in radian mode, what is $T({t0})$ to the nearest tenth of a degree?"
    return MQ("pre_periodic_model_eval_calc", "3.7", "2", "required", stem, key, ds, rng, "Construct and evaluate a sinusoidal model from extreme values", ["Find the midline and amplitude from the high and low temperatures", "Evaluate the cosine model at the requested time in radian mode"], "floating-point evaluation versus sympy evaluation to fifteen digits", f"$D={D:g}$, $A={A:g}$, and $T({t0})\\approx{val:.1f}$.", [f"hi={hi}", f"lo={lo}", f"tmax={tmax}", f"t0={t0}"], est=110)


@retry_sep
def pre_trig_equation_sum_calc(rng):
    for _ in forever():
        a = pick(rng, [2, 3, 4, 5]); b = pick(rng, [2, 3]); k = pick(rng, [1, 1.5, 2, 2.5]); fn = pick(rng, ["sin", "cos"])
        F = (math.sin if fn == "sin" else math.cos); g = lambda v: a * F(b * v) - k  # noqa: E731
        rts = solve_all(g, 0, 2 * math.pi - 1e-9, 40000)
        s0 = math.asin(k / a) if fn == "sin" else math.acos(k / a)
        cl = sorted(z for j in range(0, 2 * b + 1) for z in ([(s0 + 2 * math.pi * j) / b, (math.pi - s0 + 2 * math.pi * j) / b] if fn == "sin" else [(s0 + 2 * math.pi * j) / b, (2 * math.pi - s0 + 2 * math.pi * j) / b]) if 0 <= z < 2 * math.pi - 1e-9)
        if len(rts) == 2 * b and len(cl) == len(rts) and all(abs(u - v) < 1e-6 for u, v in zip(rts, cl)):
            break
    last = rts[-1]
    key, ds = num_options(last, [(f"Reports the smallest solution $\\theta\\approx{rts[0]:.3f}$ instead of the greatest.", rts[0]), (f"Reports the second-greatest solution $\\theta\\approx{rts[-2]:.3f}$.", rts[-2]), (f"Solves ${a}\\{fn}\\theta={k:g}$ ignoring the multiplier ${b}$ of the angle and reports its greatest solution.", (2 * math.pi - s0) if fn == "cos" else (math.pi - s0)), (f"Reports the middle value of the {2 * b} solutions, $\\theta\\approx{rts[len(rts) // 2]:.3f}$.", rts[len(rts) // 2])], tol=0.05)
    stem = f"Using a graphing calculator in radian mode, what is the greatest solution of the equation ${a}\\{fn}({b}\\theta)={k:g}$ on the interval $0\\le\\theta<2\\pi$?"
    return MQ("pre_trig_equation_sum_calc", "3.10", "1", "required", stem, key, ds, rng, "Solve a trigonometric equation over one full period", ["Graph the function and the horizontal line over the interval and list the intersections", "Choose the greatest intersection"], "inverse function closed form for every solution versus a sign-change scan with brentq refinement", f"The {2 * b} solutions in the interval are about {', '.join(f'${r_:.3f}$' for r_ in rts)}; the greatest is $\\theta\\approx{last:.3f}$.", [f"a={a}", f"b={b}", f"k={k}", f"fn={fn}"], est=100)


@retry_sep
def pre_sin_max_time_calc(rng):
    for _ in forever():
        A = pick(rng, [3, 4, 6]); b = pick(rng, [0.4, 0.5, 0.8, 1.2]); c = pick(rng, [0.5, 1.0, 1.5, 2.0]); D = pick(rng, [5, 8, 10]); f = lambda t_: D + A * math.sin(b * (t_ - c))  # noqa: E731
        first = c + math.pi / (2 * b)
        if first > 0.2:
            break
    grid = np.linspace(0, 2 * math.pi / b + c, 400001); gm = float(grid[int(np.argmax([f(v) for v in grid[::100]])) * 100]); agree(first, gm if gm > 0 else first, 1e-3, "max")
    key, ds = num_options(first, [(f"Reports the greatest height $H={D + A}$ meters instead of the time.", float(D + A)), (f"Forgets to add the horizontal shift ${c:g}$ and reports $\\pi/(2\\cdot {b:g})$.", math.pi / (2 * b)), (f"Reports the time of the first minimum, ${c:g}+3\\pi/(2\\cdot {b:g})$, instead of the first maximum.", c + 3 * math.pi / (2 * b)), (f"Adds half a period, $\\pi/{b:g}$, to the shift ${c:g}$, which is where the model returns to its midline.", c + math.pi / b)], tol=0.05, n=2)
    stem = f"The height, in meters, of a point on a rotating wheel at time $t\\ge 0$ seconds is modeled by $H(t)={D}+{A}\\sin({b:g}(t-{c:g}))$. Using a graphing calculator in radian mode, at what time $t$ is the point first at its greatest height?"
    return MQ("pre_sin_max_time_calc", "3.7", "2", "required", stem, key, ds, rng, "The first maximum of a shifted sinusoid", ["Graph the model for a full period starting at t = 0", "Read the time of the first maximum from the graph"], "closed form c plus pi over 2b versus a dense grid maximum", f"The first maximum occurs at $t={c:g}+\\pi/(2\\cdot{b:g})\\approx{first:.3f}$ seconds.", [f"A={A}", f"b={b}", f"c={c}", f"D={D}"], est=100)


@retry_sep
def pre_rational_va_behavior(rng):
    for _ in forever():
        va = pick(rng, [-3, -2, -1, 1, 2, 3]); a = pick(rng, [-3, -2, -1, 1, 2, 3]); m = pick(rng, [1, 2, 3]); zr = pick(rng, [-5, -4, 4, 5])
        f = lambda v: a * (v - zr) / (v - va) ** m  # noqa: E731
        if f(va + 1e-4) != 0 and abs(va - zr) > 1:
            break
    sg = lambda v: "\\infty" if v > 0 else "-\\infty"  # noqa: E731
    r, l = sg(f(va + 1e-5)), sg(f(va - 1e-5)); fl = lambda s: "-\\infty" if s == "\\infty" else "\\infty"  # noqa: E731
    tex = lambda a_, b_: f"As $x\\to {va}^+$, $f(x)\\to {a_}$; as $x\\to {va}^-$, $f(x)\\to {b_}$"  # noqa: E731
    num_s = "positive" if a * (va - zr) > 0 else "negative"
    cands = [(fl(r), fl(l), f"Reverses the sign of the numerator, which is {num_s} near the asymptote, so both limits have the wrong sign."), ((r, fl(l)) if r == l else (r, r), "", "Treats the exponent " + str(m) + " of the denominator as " + ("odd" if m % 2 == 0 else "even") + ", which makes the signs on the two sides " + ("different" if m % 2 == 0 else "the same") + " when they should not be."), ("0", "0", f"Thinks $f(x)$ approaches 0 near $x={va}$, but the denominator approaches 0 so $f$ is unbounded.")]
    wr = []; seen = {(r, l)}
    for aa, bb, w in [(c[0], c[1], c[2]) for c in cands]:
        if (aa, bb) not in seen:
            seen.add((aa, bb)); wr.append((tex(aa, bb), w))
    extra = (fl(r), l) if fl(r) != r else (r, l)
    if (fl(r), l) not in seen:
        wr.append((tex(fl(r), l), "Gets the sign on the right of the asymptote wrong while the left is right."))
    key, ds = text_options(tex(r, l), f"Near $x={va}$ the numerator is {num_s}; the denominator $(x-{va})^{m}$ is {'positive on both sides' if m % 2 == 0 else 'positive on the right and negative on the left'}, so $f$ has the stated signs.", wr)
    stem = f"The function $f$ is defined by $f(x)=\\dfrac{{{L(a * (X - zr))}}}{{{L((X - va) ** m)}}}$. Which of the following describes the behavior of $f$ near its vertical asymptote $x={va}$?"
    del extra
    return MQ("pre_rational_va_behavior", "1.9", "2", "not_allowed", stem, key, ds, rng, "Behavior of a rational function near a vertical asymptote", ["Evaluate the sign of the numerator near the asymptote", "Use the parity of the denominator's exponent to find the sign on each side"], "numerical evaluation of f at the asymptote plus and minus 10^-5", f"Evaluating the sign of $f$ just to the right and just to the left of the asymptote gives: {tex(r, l)}.", [f"va={va}", f"a={a}", f"m={m}", f"zr={zr}"], est=95)
