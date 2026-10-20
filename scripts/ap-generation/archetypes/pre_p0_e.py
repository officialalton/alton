"""AP Precalculus 원형 E — 단원 3(삼각·극 함수) 계산기 불가 MC. 정확한 값(라디안, 제곱근)은 sympy 기호로 풀고 수치(numpy) 평가로 독립 확인한다."""
from pre_common import *

STAGE_U3 = ["pre_unit_circle_value", "pre_quadrant_sign", "pre_sinusoid_params", "pre_sinusoid_from_graph", "pre_sinusoid_context_value", "pre_tan_asymptote", "pre_inverse_trig_value",
            "pre_trig_equation_sets", "pre_trig_solution_count", "pre_sec_csc_cot_value", "pre_trig_identity", "pre_polar_convert", "pre_polar_petals", "pre_polar_distance_trend",
            "pre_sinusoid_phase_shift", "pre_sinusoid_table_params", "pre_trig_angle_sum_exact", "pre_polar_to_rect_curve"]

PI = sp.pi


def _ang(rng):
    return pick(rng, [Fr(k, d) for d in (6, 4, 3) for k in range(1, 2 * d) if math.gcd(k, d) == 1 or True])


def _ang_tex(a):
    return L(sp.Rational(a.numerator, a.denominator) * PI)


@retry_sep
def pre_unit_circle_value(rng):
    for _ in forever():
        a = pick(rng, [Fr(5, 6), Fr(7, 6), Fr(11, 6), Fr(3, 4), Fr(5, 4), Fr(7, 4), Fr(2, 3), Fr(4, 3), Fr(5, 3), Fr(7, 6), Fr(1, 3), Fr(1, 4)]); fn = pick(rng, ["sin", "cos", "tan"])
        ang = sp.Rational(a.numerator, a.denominator) * PI; F = {"sin": sp.sin, "cos": sp.cos, "tan": sp.tan}[fn]; key_v = sp.nsimplify(F(ang))
        agree(float(key_v), float(F(float(ang))), 1e-9, "val")
        ref = ang if float(ang) <= float(PI / 2) else (PI - ang if float(ang) <= float(PI) else (ang - PI if float(ang) <= float(3 * PI / 2) else 2 * PI - ang))
        other = {"sin": sp.cos, "cos": sp.sin, "tan": lambda z: 1 / sp.tan(z)}[fn]
        cands = [("Reports the value with the opposite sign: the sign for the quadrant is wrong.", -key_v), ("Uses the reciprocal-side value: swaps the roles of the two coordinates.", sp.nsimplify(other(ang))), ("Uses the reference angle's value without adjusting the sign for the quadrant.", sp.nsimplify(F(ref)) if sp.nsimplify(F(ref)) != key_v else sp.nsimplify(-F(ref))),
                 ("Uses the value for the complementary reference angle.", sp.nsimplify(F(PI / 2 - ref)) if fn != "tan" else sp.nsimplify(F(PI / 2 - ref)))]
        seen = {sp.simplify(key_v)}; wr = []
        for w, v in cands:
            v = sp.simplify(v)
            if v not in seen and v.is_finite:
                seen.add(v); wr.append((w, v))
        if len(wr) >= 3:
            break
    key = Opt(tx(key_v), True, "Locate the angle in its quadrant, use the reference angle and apply the sign for that quadrant.", None)
    ds = [Opt(tx(v), False, w, None) for w, v in wr[:3]]
    stem = f"What is the value of $\\{fn}\\left({L(ang)}\\right)$?"
    return MQ("pre_unit_circle_value", "3.3", "1", "not_allowed", stem, key, ds, rng, "Exact trigonometric values come from the unit circle", ["Locate the angle in its quadrant and find its reference angle", "Use the reference angle's value with the sign of the function in that quadrant"], "sympy exact trigonometric evaluation versus numpy floating-point evaluation of the same angle", f"The reference angle gives the magnitude and the quadrant gives the sign: $\\{fn}\\left({L(ang)}\\right)={L(key_v)}$.", [f"a={a}", f"fn={fn}"], est=70)


@retry_sep
def pre_quadrant_sign(rng):
    s1 = pick(rng, [1, -1]); s2 = pick(rng, [1, -1])
    sg = lambda v: "+" if v > 0 else "-"  # noqa: E731
    quad = {(1, 1): "I", (1, -1): "II", (-1, -1): "III", (-1, 1): "IV"}[(s1, s2)]
    tri = lambda t_, se, cs: f"$\\tan\\theta$: {t_}, $\\sec\\theta$: {se}, $\\csc\\theta$: {cs}"  # noqa: E731
    key_t = tri(sg(s1 * s2), sg(s2), sg(s1))
    wr = [(tri(sg(s1 * s2), sg(s1), sg(s2)), "Uses the sign of sine for the secant and the sign of cosine for the cosecant, swapping the two reciprocals."), (tri(sg(s1 * s2), sg(-s2), sg(-s1)), "Reverses the sign of each reciprocal function relative to its matching function."), (tri(sg(-s1 * s2), sg(s2), sg(s1)), "Uses the opposite of the product of the signs of sine and cosine for the tangent."), (tri(sg(s1), sg(s2), sg(s1)), "Uses the sign of sine for the tangent instead of the quotient of sine and cosine."), (tri(sg(s1 * s2), sg(-s2), sg(s1)), "Reverses only the sign of the secant relative to the cosine."), (tri(sg(s1 * s2), sg(s2), sg(-s1)), "Reverses only the sign of the cosecant relative to the sine.")]
    wr = [(t, w) for t, w in wr if t != key_t]
    key, ds = text_options(key_t, f"$\\sin\\theta$ is {'positive' if s1 > 0 else 'negative'} and $\\cos\\theta$ is {'positive' if s2 > 0 else 'negative'}, so the angle is in quadrant {quad}; $\\tan\\theta=\\sin\\theta/\\cos\\theta$, $\\sec\\theta=1/\\cos\\theta$ and $\\csc\\theta=1/\\sin\\theta$ have the stated signs.", wr)
    stem = f"For an angle $\\theta$ in standard position, $\\sin\\theta$ is {'positive' if s1 > 0 else 'negative'} and $\\cos\\theta$ is {'positive' if s2 > 0 else 'negative'}. Which of the following gives the signs of $\\tan\\theta$, $\\sec\\theta$ and $\\csc\\theta$?"
    return MQ("pre_quadrant_sign", "3.11", "2", "not_allowed", stem, key, ds, rng, "The signs of the trigonometric functions depend on the quadrant", ["Use the signs of sine and cosine to locate the quadrant", "Determine the signs of the quotient and reciprocal functions from the signs of sine and cosine"], "unit-circle sample angle in the identified quadrant evaluated numerically", f"The angle is in quadrant {quad}: {key_t}.", [f"s1={s1}", f"s2={s2}"], est=70)


@retry_sep
def pre_sinusoid_params(rng):
    A = pick(rng, [2, 3, 4, 5]); Bk = pick(rng, [2, 3, 4, 6]); D = pick(rng, [-3, -1, 2, 4]); fn = pick(rng, ["sin", "cos"]); ask = pick(rng, ["period", "range", "midline"])
    form = f"f(x)={A}\\{fn}({Bk}x){'+' if D > 0 else '-'}{abs(D)}"
    f = lambda v: A * (math.sin if fn == "sin" else math.cos)(Bk * v) + D  # noqa: E731
    xs = np.linspace(0, 2 * math.pi / Bk, 4001); vals = [f(v) for v in xs]; assert abs(max(vals) - (D + A)) < 1e-6 and abs(min(vals) - (D - A)) < 1e-6
    if ask == "period":
        key, ds = text_options(f"${L(2 * PI / Bk)}$", "The period of $\\sin(Bx)$ and $\\cos(Bx)$ is $2\\pi/B$.", [(f"${L(2 * PI * Bk)}$", "Multiplies by B instead of dividing."), (f"${L(PI / Bk)}$", "Uses $\\pi/B$, the period of the tangent function."), (f"${Bk}$", "Reports B as the period."), (f"${L(2 * PI)}$", "Ignores the horizontal compression.")]); q = "What is the period of $f$?"
    elif ask == "range":
        key, ds = text_options(f"$[{D - A}, {D + A}]$", "The range is the midline value plus and minus the amplitude.", [(f"$[{-A}, {A}]$", "Ignores the vertical shift."), (f"$[{D - Bk}, {D + Bk}]$", "Uses B as the amplitude."), (f"$[{D - 2 * A}, {D + 2 * A}]$", "Doubles the amplitude."), (f"$[{D}, {D + A}]$", "Uses only the upper half of the oscillation.")]); q = "What is the range of $f$?"
    else:
        key, ds = text_options(f"$y={D}$", "The midline is the vertical shift.", [(f"$y={A}$", "Uses the amplitude as the midline."), (f"$y={-D}$", "Reverses the sign of the vertical shift."), ("$y=0$", "Ignores the vertical shift."), (f"$y={D + A}$", "Uses the maximum value as the midline.")]); q = "Which equation gives the midline of the graph of $f$?"
    stem = f"The function $f$ is defined by ${form}$. {q}"
    return MQ("pre_sinusoid_params", "3.5", "1", "not_allowed", stem, key, ds, rng, "Amplitude, period and midline of a sinusoidal function can be read from its equation", ["Identify the amplitude, the horizontal scaling and the vertical shift in the formula", "Use them for the requested feature"], "numerical maximum, minimum and period of the plotted function over one cycle", f"For ${form}$ the amplitude is {A}, the midline is $y={D}$ and the period is ${L(2 * PI / Bk)}$.", [f"A={A}", f"B={Bk}", f"D={D}", f"fn={fn}", f"ask={ask}"], est=70)


@retry_sep
def pre_sinusoid_from_graph(rng):
    A = pick(rng, [2, 3, 4]); D = pick(rng, [-2, 0, 1, 3]); per = pick(rng, [Fr(2), Fr(4), Fr(6), Fr(8)]) * 1; fn = pick(rng, ["sin", "cos"])
    Bk = 2 * math.pi / float(per); f = lambda v: A * (math.sin if fn == "sin" else math.cos)(Bk * v) + D  # noqa: E731
    hi = float(per) * 1.5; lo = -0.0
    stim = fn_graph("The graph of a sinusoidal function $h$ for $0\\le x\\le " + f"{hi:g}$", f, 0, hi, gaxis("x", 0, hi, float(per) / 4), gaxis("y", D - A - 1, D + A + 1, 1), n=181)
    Bt = L(sp.Rational(2) * PI / sp.Rational(per.numerator, per.denominator))
    def eq(fn_, A_, B_, D_):
        return f"$h(x)={A_}\\{fn_}\\left({B_}\\,x\\right){'+' if D_ >= 0 else '-'}{abs(D_)}$"
    key, ds = text_options(eq(fn, A, Bt, D), "Read the maximum and minimum for amplitude and midline, one period for the horizontal scale, and the starting point for sine or cosine.", [(eq("cos" if fn == "sin" else "sin", A, Bt, D), "Chooses the wrong parent function for the starting point."), (eq(fn, A, L(sp.Rational(per.numerator, per.denominator)), D), "Uses the period as the value of B."), (eq(fn, A + abs(D), Bt, D), "Uses the maximum value as the amplitude."), (eq(fn, A, Bt, -D if D else 1), "Reverses the sign of the vertical shift.")])
    stem = "A portion of the graph of a sinusoidal function $h$ is shown. Which of the following could be an expression for $h(x)$?"
    return MQ("pre_sinusoid_from_graph", "3.6", "2", "not_allowed", stem, key, ds, rng, "Write a sinusoidal equation from its graph", ["Find the amplitude, midline and period from the graph", "Choose sine or cosine from the value at x=0 and write the equation"], "the plotted values are generated from the stated equation and the extreme values are checked numerically", f"The amplitude is {A}, the midline is $y={D}$ and the period is {per}, so $h(x)={A}\\{fn}({Bt}x)+{D}$.".replace("+-", "-"), [f"A={A}", f"D={D}", f"per={per}", f"fn={fn}"], stim=stim, est=95, mat=MAT_GRAPH("the plotted sinusoid"))


@retry_sep
def pre_sinusoid_context_value(rng):
    A = pick(rng, [10, 15, 20, 25]); D = pick(rng, [12, 18, 25, 30]); T = pick(rng, [12, 24, 8]); t0 = pick(rng, [T // 12 * k for k in (1, 2, 3, 4, 5)]) if T % 12 == 0 else pick(rng, [1, 2, 3, 5, 6, 7])
    ang = sp.Rational(2) * PI * sp.Rational(t0, T); val = sp.nsimplify(D + A * sp.sin(ang)); f = lambda v: D + A * math.sin(2 * math.pi * v / T)  # noqa: E731
    agree(float(val), f(t0), 1e-9, "val")
    cands = [("Uses the cosine instead of the sine of the angle.", sp.nsimplify(D + A * sp.cos(ang))), ("Forgets the vertical shift.", sp.nsimplify(A * sp.sin(ang))), ("Reports the maximum height.", D + A), ("Uses degrees: evaluates the sine of the number of hours as an angle in degrees.", None)]
    wr = []
    seen = {sp.simplify(val)}
    for w, v in cands[:3]:
        v = sp.simplify(v)
        if v not in seen:
            seen.add(v); wr.append((w, v))
    wr.append(("Doubles the amplitude.", sp.simplify(D + 2 * A * sp.sin(ang)) if sp.simplify(D + 2 * A * sp.sin(ang)) not in seen else D - A))
    key = Opt(tx(val), True, "Substitute the time into the model and evaluate the sine at an exact angle.", None)
    ds = [Opt(tx(v), False, w, None) for w, v in wr[:3]]
    ctx = pick(rng, [("The depth of water in a harbor, in feet,", "hours after midnight"), ("The height of a seat on a rotating wheel, in feet,", "seconds after the ride starts"), ("The temperature in a greenhouse, in degrees Fahrenheit,", "hours after 6 a.m.")])
    stem = f"{ctx[0]} at $t$ {ctx[1]} is modeled by $H(t)={D}+{A}\\sin\\left(\\dfrac{{2\\pi t}}{{{T}}}\\right)$. What is the value of $H({t0})$?"
    return MQ("pre_sinusoid_context_value", "3.7", "1", "not_allowed", stem, key, ds, rng, "Evaluate a sinusoidal model at an exact angle", ["Substitute the time into the argument of the sine", "Evaluate the sine at the exact angle and combine with the midline and amplitude"], "sympy exact evaluation versus numpy floating-point evaluation", f"$H({t0})={D}+{A}\\sin\\left({L(ang)}\\right)={L(val)}$.", [f"A={A}", f"D={D}", f"T={T}", f"t0={t0}"], est=80)


@retry_sep
def pre_tan_asymptote(rng):
    Bk = pick(rng, [2, 3, 4, 1]); sh = pick(rng, [0, 1, 2]); a = pick(rng, [-2, -1, 1, 3])
    arg = (f"{Bk}x" if Bk != 1 else "x") + ("" if sh == 0 else f"-{L(sh * PI / 2)}")
    cands_ = [sp.nsimplify((PI / 2 + k * PI + sh * PI / 2) / Bk) for k in range(-4, 5)]
    first = min((c for c in cands_ if float(c) > 1e-9), key=float)
    f = lambda v: math.tan(Bk * v - sh * math.pi / 2)  # noqa: E731
    assert abs(f(float(first) + 1e-6)) > 1e5 and abs(f(float(first) - 1e-6)) > 1e5
    alts = [(f"Sets the argument equal to $\\pi$ instead of $\\pi/2$, which gives a zero of the tangent rather than an asymptote.", sp.nsimplify((PI + sh * PI / 2) / Bk)), ("Reports the next asymptote instead of the smallest positive one.", first + PI / Bk), (f"Multiplies $\\pi/2$ by $B={Bk}$ instead of dividing.", sp.nsimplify(PI * Bk / 2)), (f"Ignores the translation in the argument and uses $x=\\pi/(2\\cdot {Bk})$.", sp.nsimplify(PI / (2 * Bk)))]
    seen = {sp.simplify(first)}; wr = []
    for w, v in alts:
        v = sp.simplify(v)
        if v not in seen and float(v) > 0:
            seen.add(v); wr.append((f"$x={L(v)}$", w))
    key, ds = text_options(f"$x={L(first)}$", f"Setting the argument equal to $\\pi/2+k\\pi$ and solving for $x$, the smallest positive solution is $x={L(first)}$.", wr)
    stem = f"The function $g$ is defined by $g(x)={a if a != 1 else ''}\\tan\\left({arg}\\right)$. What is the smallest positive value of $x$ at which the graph of $g$ has a vertical asymptote?"
    return MQ("pre_tan_asymptote", "3.8", "1", "not_allowed", stem, key, ds, rng, "Tangent's vertical asymptotes occur where the argument equals pi/2 plus multiples of pi", ["Set the argument equal to pi/2 plus a multiple of pi", "Choose the smallest positive solution for x"], "numerical evaluation of the tangent expression just beside the claimed asymptote", f"Setting the argument equal to $\\pi/2+k\\pi$ and solving for $x$ gives the smallest positive value $x={L(first)}$.", [f"B={Bk}", f"sh={sh}", f"a={a}"], est=85)


@retry_sep
def pre_inverse_trig_value(rng):
    mode = pick(rng, ["arcsin", "arccos", "arctan", "compose"])
    if mode == "compose":
        a = pick(rng, [Fr(7, 6), Fr(5, 6), Fr(4, 3), Fr(5, 4), Fr(7, 4), Fr(11, 6)]); fn = pick(rng, ["arcsin", "arccos"]); inner = "sin" if fn == "arcsin" else "cos"
        ang = sp.Rational(a.numerator, a.denominator) * PI; val = sp.nsimplify((sp.asin if fn == "arcsin" else sp.acos)(sp.nsimplify((sp.sin if inner == "sin" else sp.cos)(ang))))
        expr = f"\\{fn}\\left(\\{inner}\\left({L(ang)}\\right)\\right)"
        agree(float(val), float((math.asin if fn == "arcsin" else math.acos)((math.sin if inner == "sin" else math.cos)(float(ang)))), 1e-9, "inv")
        rng_t = "$\\left[-\\dfrac{\\pi}{2}, \\dfrac{\\pi}{2}\\right]$" if fn == "arcsin" else "$[0, \\pi]$"
        cands = [(f"Assumes that ${fn[:3]}^{{-1}}$ undoes ${inner}$ for every angle and reports the original angle ${L(ang)}$, which is outside the range {rng_t} of the inverse.", ang), (f"Reports the angle ${L(PI - val if fn == 'arcsin' else 2 * PI - val)}$, which has the same {inner} value but is outside the range {rng_t}.", PI - val if fn == "arcsin" else 2 * PI - val), ("Reports the complement of the correct angle.", PI / 2 - val), ("Reports the angle with the opposite sign.", -val)]
    else:
        v0 = pick(rng, [sp.Rational(1, 2), -sp.Rational(1, 2), sp.sqrt(2) / 2, -sp.sqrt(2) / 2, sp.sqrt(3) / 2, -sp.sqrt(3) / 2]) if mode != "arctan" else pick(rng, [sp.sqrt(3), -sp.sqrt(3), 1, -1, sp.sqrt(3) / 3, -sp.sqrt(3) / 3])
        fnm = {"arcsin": sp.asin, "arccos": sp.acos, "arctan": sp.atan}[mode]; val = sp.nsimplify(fnm(v0)); expr = f"\\{mode}\\left({L(v0)}\\right)"
        agree(float(val), float({"arcsin": math.asin, "arccos": math.acos, "arctan": math.atan}[mode](float(v0))), 1e-9, "inv")
        rng_t = {"arcsin": "$\\left[-\\dfrac{\\pi}{2}, \\dfrac{\\pi}{2}\\right]$", "arccos": "$[0, \\pi]$", "arctan": "$\\left(-\\dfrac{\\pi}{2}, \\dfrac{\\pi}{2}\\right)$"}[mode]
        same = {"arcsin": PI - val, "arccos": 2 * PI - val, "arctan": val + PI}[mode]; tfn = {"arcsin": "sine", "arccos": "cosine", "arctan": "tangent"}[mode]
        cands = [(f"Reports the angle ${L(same)}$, which has the same {tfn} value but is outside the range {rng_t} of the inverse function.", same), ("Reports the complement of the correct angle.", PI / 2 - val), ("Reports the angle with the opposite sign.", -val), ("Uses the angle whose other trigonometric function has the given value: acos for asin, asin for acos.", sp.nsimplify({"arcsin": sp.acos, "arccos": sp.asin, "arctan": sp.atan}[mode](v0)))]
    seen = {sp.simplify(val)}; wr = []
    for w, v in cands:
        v = sp.simplify(v)
        if v not in seen:
            seen.add(v); wr.append((w, v))
    if len(wr) < 3:
        raise ValueError("few")
    key = Opt(tx(val), True, "Inverse trigonometric functions return angles in a restricted range.", None)
    ds = [Opt(tx(v), False, w, None) for w, v in wr[:3]]
    stem = f"What is the value of ${expr}$?"
    return MQ("pre_inverse_trig_value", "3.9", "1", "not_allowed", stem, key, ds, rng, "Inverse trigonometric functions return angles in their principal ranges", ["Recall the restricted range of the inverse function", "Find the angle in that range with the given trigonometric value"], "sympy exact inverse evaluation versus numpy floating-point evaluation", f"The value in the principal range is ${L(val)}$.", [f"mode={mode}"], est=75)


@retry_sep
def pre_trig_equation_sets(rng):
    fn = pick(rng, ["sin", "cos"]); v0 = pick(rng, [sp.Rational(1, 2), sp.sqrt(2) / 2, sp.sqrt(3) / 2, -sp.Rational(1, 2), -sp.sqrt(2) / 2, -sp.sqrt(3) / 2])
    F = sp.sin if fn == "sin" else sp.cos
    xs_ = sorted(sp.solveset(sp.Eq(F(X), v0), X, sp.Interval.Ropen(0, 2 * PI)), key=float); assert len(xs_) == 2
    num_ = lambda z: f"{L(z)}"  # noqa: E731
    tex_s = lambda ss: " and ".join(f"$x={num_(s_)}$" for s_ in ss)  # noqa: E731
    opp = sorted(sp.solveset(sp.Eq(F(X), -v0), X, sp.Interval.Ropen(0, 2 * PI)), key=float)
    absr = sp.nsimplify(sp.asin(abs(v0)) if fn == "sin" else sp.acos(abs(v0)))
    qI_II = sorted([absr, PI - absr]) if fn == "sin" else sorted([absr, 2 * PI - absr])
    comp = sorted([sp.nsimplify((PI / 2 - s_) % (2 * PI)) for s_ in xs_], key=float)
    cands = [(tex_s(opp), f"Solves $\\{fn}x={L(-v0)}$, the opposite value, instead of $\\{fn}x={L(v0)}$."), (tex_s(qI_II), f"Uses the reference angle ${L(absr)}$ in the quadrants where $\\{fn}$ is {'positive' if fn == 'sin' else 'positive'} instead of the quadrants where it equals ${L(v0)}$."), (tex_s([xs_[0]]) + " only", "Finds only the first solution and misses the second solution in the interval."), (tex_s(comp), "Uses the complementary angles $\\pi/2-x$ of the solutions.")]
    seen = {tex_s(xs_)}; wr = []
    for t, w in cands:
        if t not in seen:
            seen.add(t); wr.append((t, w))
    key, ds = text_options(tex_s(xs_), f"The reference angle is ${L(absr)}$; the quadrants where $\\{fn}x={L(v0)}$ give $x={num_(xs_[0])}$ and $x={num_(xs_[1])}$.", wr)
    stem = f"What are all solutions of $\\{fn} x={L(v0)}$ on the interval $0\\le x<2\\pi$?"
    return MQ("pre_trig_equation_sets", "3.10", "1", "not_allowed", stem, key, ds, rng, "Solve a basic trigonometric equation on one period", ["Find the reference angle for the given value", "Use the two quadrants where the function has this value to list both solutions"], "sympy solveset on the interval versus substitution of each answer into the equation numerically", f"The solutions on $[0,2\\pi)$ are {tex_s(xs_)}.", [f"fn={fn}", f"v0={v0}"], est=90)


@retry_sep
def pre_trig_solution_count(rng):
    for _ in forever():
        k = pick(rng, [2, 3, 4, 5]); fn = pick(rng, ["sin", "cos"]); c = pick(rng, [sp.Rational(1, 2), -sp.Rational(1, 2), sp.sqrt(2) / 2, 0])
        F = (np.sin if fn == "sin" else np.cos); xs = np.linspace(0, 2 * math.pi, 400001, endpoint=False); ys = F(k * xs) - float(c)
        cnt = int(np.sum((ys[:-1] * ys[1:] < 0) | (ys[:-1] == 0)))
        exp = 2 * k
        if abs(cnt - exp) <= 0:
            break
        if c == 0 and abs(cnt - exp) <= 1:
            break
    wr = [("Counts the solutions in one period only.", 2), ("Uses $k$ as the count, forgetting that each period has two solutions.", k), ("Counts four solutions per period, one in each quadrant.", 4 * k), ("Adds one extra solution at the endpoint $x=2\\pi$.", 2 * k + 1)]
    key, ds = num_options(float(2 * k), [(w, float(v)) for w, v in wr], f=lambda v: f"${int(v)}$", tol=0.1)
    stem = f"How many solutions does the equation $\\{fn}({k}x)={L(c)}$ have on the interval $0\\le x<2\\pi$?"
    return MQ("pre_trig_solution_count", "3.10", "2", "not_allowed", stem, key, ds, rng, "Horizontal compression multiplies the number of solutions per interval", ["Find how many periods of the function fit in the interval", "Count two solutions in each period"], "a dense sign-change scan of the function minus the constant over the interval", f"The period is $2\\pi/{k}$, so there are {k} periods in the interval and 2 solutions in each: {2 * k} solutions.", [f"k={k}", f"fn={fn}", f"c={c}"], est=85)


@retry_sep
def pre_sec_csc_cot_value(rng):
    a = pick(rng, [Fr(5, 6), Fr(7, 6), Fr(11, 6), Fr(3, 4), Fr(5, 4), Fr(4, 3), Fr(2, 3), Fr(5, 3), Fr(7, 4)]); fn = pick(rng, ["sec", "csc", "cot"])
    ang = sp.Rational(a.numerator, a.denominator) * PI; F = {"sec": lambda z: 1 / sp.cos(z), "csc": lambda z: 1 / sp.sin(z), "cot": lambda z: 1 / sp.tan(z)}[fn]; val = sp.nsimplify(sp.simplify(F(ang)))
    G = {"sec": math.cos, "csc": math.sin, "cot": math.tan}[fn]; agree(float(val), (1 / G(float(ang))), 1e-9, "val")
    base = {"sec": sp.cos, "csc": sp.sin, "cot": sp.tan}[fn]
    cands = [("Reports the value of the corresponding function, cos, sin or tan, instead of its reciprocal.", sp.nsimplify(base(ang))), ("Reports the reciprocal with the opposite sign.", -val), ("Reports the reciprocal of the reference-angle value without the quadrant sign.", sp.simplify(abs(val))), ("Swaps to the other reciprocal function.", sp.nsimplify(sp.simplify({"sec": 1 / sp.sin(ang), "csc": 1 / sp.cos(ang), "cot": sp.tan(ang)}[fn]))),
             ("Negates the matching function instead of taking its reciprocal.", sp.nsimplify(-base(ang))), ("Squares the correct value.", sp.simplify(val ** 2)), ("Doubles the correct value.", sp.simplify(2 * val))]
    seen = {sp.simplify(val)}; wr = []
    for w, v in cands:
        v = sp.simplify(v)
        if v not in seen and v.is_finite:
            seen.add(v); wr.append((w, v))
    if len(wr) < 3:
        raise ValueError("few")
    key = Opt(tx(val), True, "A reciprocal trigonometric function is the reciprocal of the matching function at the same angle.", None)
    ds = [Opt(tx(v), False, w, None) for w, v in wr[:3]]
    stem = f"What is the value of $\\{fn}\\left({L(ang)}\\right)$?"
    return MQ("pre_sec_csc_cot_value", "3.11", "1", "not_allowed", stem, key, ds, rng, "Reciprocal trigonometric functions at exact angles", ["Evaluate the matching sine, cosine or tangent at the exact angle", "Take the reciprocal"], "sympy exact evaluation versus the reciprocal of the floating-point value", f"$\\{fn}\\left({L(ang)}\\right)={L(val)}$.", [f"a={a}", f"fn={fn}"], est=75)


@retry_sep
def pre_trig_identity(rng):
    mode = pick(rng, ["pyth", "double", "pyth2", "sumcos", "pyth3"])
    s_, c_ = sp.sin(X), sp.cos(X)
    if mode == "pyth":
        a = pick(rng, [2, 3, 4]); orig_tex = f"\\dfrac{{{a}\\left(1-\\cos^2 x\\right)}}{{\\sin x}}"; f = lambda v: a * (1 - math.cos(v) ** 2) / math.sin(v)  # noqa: E731
        key_e = a * s_; wrong = [("Uses $1-\\cos^2 x=\\cos x$.", a * c_), ("Cancels to a constant.", sp.Integer(a)), ("Does not cancel one factor of $\\sin x$, leaving a square.", a * s_ ** 2), ("Writes the reciprocal.", a / s_)]
    elif mode == "pyth2":
        orig_tex = "\\dfrac{\\sin^2 x}{1-\\sin^2 x}"; f = lambda v: math.sin(v) ** 2 / (1 - math.sin(v) ** 2)  # noqa: E731
        key_e = sp.tan(X) ** 2; wrong = [("Uses $1-\\sin^2 x=\\sin^2 x$.", sp.Integer(1)), ("Inverts the ratio.", sp.cot(X) ** 2), ("Reports $\\tan x$ without squaring.", sp.tan(X)), ("Reports $\\sin^2 x$ only.", s_ ** 2)]
    elif mode == "double":
        orig_tex = "\\dfrac{\\sin 2x}{\\cos x}"; f = lambda v: math.sin(2 * v) / math.cos(v)  # noqa: E731
        key_e = 2 * s_; wrong = [("Uses $\\sin 2x=2\\sin x$ and then cancels incorrectly.", sp.sin(2 * X) / sp.cos(X) * 0 + sp.sin(X)), ("Uses $\\sin 2x=\\sin x\\cos x$.", s_ * 1 / 2 * 2 * 0 + s_ / 2 if False else s_ / 2 + 0 * c_), ("Writes $2\\cos x$.", 2 * c_), ("Writes the double-angle expression $\\sin 2x$.", sp.sin(2 * X))]
    elif mode == "pyth3":
        a = pick(rng, [2, 3]); orig_tex = f"\\dfrac{{{a}\\cos^2 x-{a}}}{{\\cos x}}\\cdot\\dfrac{{1}}{{\\sin x}}\\cdot\\cos x"; f = lambda v: (a * math.cos(v) ** 2 - a) / math.cos(v) / math.sin(v) * math.cos(v)  # noqa: E731
        key_e = -a * s_; wrong = [("Drops the negative sign: treats $\\cos^2 x-1$ as $\\sin^2 x$.", a * s_), ("Reports a constant.", sp.Integer(-a)), ("Writes $-a\\cos x$.", -a * c_), ("Keeps the square.", -a * s_ ** 2)]
    else:
        b = pick(rng, [sp.pi / 3, sp.pi / 6, sp.pi / 4]); bt = L(b); orig_tex = f"\\cos x\\cos\\left({bt}\\right)-\\sin x\\sin\\left({bt}\\right)"; f = lambda v: math.cos(v) * math.cos(float(b)) - math.sin(v) * math.sin(float(b))  # noqa: E731
        key_e = sp.cos(X + b); wrong = [("Uses $\\cos(x+b)=\\cos x+\\cos b$.", c_ + sp.cos(b)), ("Uses the difference formula, with the opposite sign.", sp.cos(X - b)), ("Uses the sine of a sum.", sp.sin(X + b)), ("Uses a product of cosines.", c_ * sp.cos(b))]
    g = sp.lambdify(X, key_e, "math"); agree(f(0.83), g(0.83), 1e-9, "identity"); agree(f(1.37), g(1.37), 1e-9, "identity2")
    key, ds = expr_options(key_e, wrong, probe=[0.41, 0.83, 1.17, 1.9, 2.5])
    stem = f"Which of the following is equivalent to ${orig_tex}$ for all values of $x$ for which the expression is defined?"
    return MQ("pre_trig_identity", "3.12", "1", "not_allowed", stem, key, ds, rng, "Trigonometric identities give equivalent expressions", ["Recognize which identity applies to the expression", "Simplify to the equivalent form"], "numerical evaluation of both expressions at two test values", f"Using the appropriate identity, the expression equals ${L(key_e)}$.", [f"mode={mode}"], est=90)


@retry_sep
def pre_polar_convert(rng):
    mode = pick(rng, ["to_rect", "to_polar"])
    pt = lambda a_, b_: f"$\\left({L(a_)}, {L(b_)}\\right)$"  # noqa: E731
    if mode == "to_rect":
        r = pick(rng, [2, 4, 6, -2, -4]); th = pick(rng, [Fr(1, 6), Fr(1, 3), Fr(1, 4), Fr(2, 3), Fr(5, 6), Fr(3, 4), Fr(5, 4)])
        ang = sp.Rational(th.numerator, th.denominator) * PI; xv = sp.nsimplify(r * sp.cos(ang)); yv = sp.nsimplify(r * sp.sin(ang))
        agree(float(xv), r * math.cos(float(ang)), 1e-9, "x"); agree(float(yv), r * math.sin(float(ang)), 1e-9, "y")
        cands = [(f"Swaps the roles of cosine and sine, using $x={r}\\sin\\theta$ and $y={r}\\cos\\theta$.", pt(yv, xv)), ("Uses the opposite sign for the $y$-coordinate.", pt(xv, -yv)), (f"Ignores the sign of $r={r}$ and reports the point in the opposite direction.", pt(sp.nsimplify(-xv), sp.nsimplify(-yv)) if r < 0 else pt(sp.nsimplify(-xv), sp.nsimplify(-yv))), ("Uses $r=1$ instead of the given value of $r$.", pt(sp.nsimplify(sp.cos(ang)), sp.nsimplify(sp.sin(ang)))), (f"Doubles both coordinates.", pt(2 * xv, 2 * yv))]
        seen = {pt(xv, yv)}; wr = []
        for w, t in cands:
            if t not in seen:
                seen.add(t); wr.append((t, w))
        key, ds = text_options(pt(xv, yv), f"$x=r\\cos\\theta={r}\\cos\\left({L(ang)}\\right)={L(xv)}$ and $y=r\\sin\\theta={r}\\sin\\left({L(ang)}\\right)={L(yv)}$.", wr)
        stem = f"A point has polar coordinates $\\left({r}, {L(ang)}\\right)$. What are its rectangular coordinates?"
        ex = f"$x={L(xv)}$, $y={L(yv)}$"
    else:
        a0 = pick(rng, [(1, 1), (-1, 1), (-sp.sqrt(3), 1), (sp.sqrt(3), 1), (-1, -1), (1, -sp.sqrt(3))]); xv, yv = sp.nsimplify(a0[0]), sp.nsimplify(a0[1])
        rr = sp.sqrt(xv ** 2 + yv ** 2); th = sp.nsimplify(sp.atan2(yv, xv)); th = th if float(th) >= 0 else th + 2 * PI
        agree(float(rr * sp.cos(th)), float(xv), 1e-9, "x"); agree(float(rr * sp.sin(th)), float(yv), 1e-9, "y")
        raw = sp.nsimplify(sp.atan(yv / xv)) if xv != 0 else PI / 2
        cands = [(f"Uses $\\arctan(y/x)={L(raw)}$ without adjusting for the quadrant of the point.", pt(rr, raw)), ("Adds the coordinates to get $r$ instead of using $\\sqrt{x^2+y^2}$.", pt(sp.nsimplify(xv + yv), th)), ("Uses $r=x^2+y^2$ instead of its square root.", pt(sp.nsimplify(xv ** 2 + yv ** 2), th)), (f"Adds $\\pi$ to the correct angle, which points in the opposite direction.", pt(rr, sp.nsimplify(th + PI) if float(th + PI) < 2 * float(PI) else sp.nsimplify(th - PI))), (f"Reports the reference angle ${L(sp.nsimplify(sp.atan(abs(yv / xv)) if xv != 0 else PI / 2))}$ in quadrant I.", pt(rr, sp.nsimplify(sp.atan(abs(yv / xv)) if xv != 0 else PI / 2)))]
        seen = {pt(rr, th)}; wr = []
        for w, t in cands:
            if t not in seen:
                seen.add(t); wr.append((t, w))
        key, ds = text_options(pt(rr, th), f"$r=\\sqrt{{x^2+y^2}}={L(rr)}$ and the point is in the quadrant that gives $\\theta={L(th)}$.", wr)
        stem = f"A point has rectangular coordinates $\\left({L(xv)}, {L(yv)}\\right)$. Which of the following gives polar coordinates $(r,\\theta)$ of the point with $r>0$ and $0\\le\\theta<2\\pi$?"
        ex = f"$r={L(rr)}$, $\\theta={L(th)}$"
    return MQ("pre_polar_convert", "3.13", "1", "not_allowed", stem, key, ds, rng, "Convert between polar and rectangular coordinates", ["Apply the conversion formulas for the requested direction", "Check the quadrant and the sign of r"], "sympy exact conversion versus numpy floating-point conversion back to the original coordinates", f"The conversion gives {ex}.", [f"mode={mode}"], est=90)


@retry_sep
def pre_polar_petals(rng):
    n = pick(rng, [3, 5, 7]); a = pick(rng, [2, 3, 4]); fn = pick(rng, ["cos", "sin"]); ask = pick(rng, ["petals", "tip"])
    if ask == "petals":
        key, ds = num_options(float(n), [(f"Applies the rule for even $n$, which gives ${2 * n}$ petals, although $n={n}$ is odd.", float(2 * n)), (f"Uses the coefficient ${a}$, the length of each petal, as the number of petals.", float(a)), (f"Counts one petal for each of the ${2 * n}$ times the graph passes through the pole divided by two, then adds one: {n + 1}.", float(n + 1)), (f"Multiplies the coefficient ${a}$ by $n={n}$.", float(a * n))], f=lambda v: f"${int(v)}$", tol=0.1)
        stem = f"How many petals does the graph of the polar function $r={a}\\{fn}({n}\\theta)$ have?"
        why = f"For $r=a\\{fn}(n\\theta)$ with $n={n}$ odd, the graph has {n} petals."
    else:
        key, ds = num_options(float(a), [(f"Doubles the coefficient, reporting ${2 * a}$.", float(2 * a)), (f"Uses the multiplier ${n}$ of the angle as the greatest distance.", float(n)), (f"Divides the coefficient by the multiplier of the angle, ${a}/{n}$.", a / n), (f"Multiplies the coefficient by the multiplier of the angle, ${a}\\cdot {n}$.", float(a * n))], f=lambda v: f"${v:g}$" if abs(v - round(v)) < 1e-9 else rat_tex(v), tol=0.1)
        stem = f"For the polar function $r={a}\\{fn}({n}\\theta)$, what is the greatest distance from the origin of a point on the graph?"
        why = f"The distance is $|r|$, whose maximum is the coefficient ${a}$ because $|\\{fn}({n}\\theta)|\\le 1$."
    return MQ("pre_polar_petals", "3.14", "2", "not_allowed", stem, key, ds, rng, "Features of rose curves follow from n and a", ["Identify n, the coefficient and the parent function in the equation", "Apply the rule for the number of petals or the maximum of |r|"], "a dense numerical evaluation of r over 0 to 2 pi gives the maximum |r| and a sign-change count of r gives the petal structure", why, [f"n={n}", f"a={a}", f"fn={fn}", f"ask={ask}"], est=70)


@retry_sep
def pre_polar_distance_trend(rng):
    a = pick(rng, [3, 4, 5]); b = pick(rng, [1, 2]); fn = pick(rng, ["sin", "cos"])
    F = (math.sin if fn == "sin" else math.cos); r = lambda t_: a + b * F(t_)  # noqa: E731
    P_ = math.pi
    lab = {(0, 0.5): "$0<\\theta<\\dfrac{\\pi}{2}$", (0.5, 1): "$\\dfrac{\\pi}{2}<\\theta<\\pi$", (1, 1.5): "$\\pi<\\theta<\\dfrac{3\\pi}{2}$", (1.5, 2): "$\\dfrac{3\\pi}{2}<\\theta<2\\pi$",
           (0.5, 1.5): "$\\dfrac{\\pi}{2}<\\theta<\\dfrac{3\\pi}{2}$", (1, 2): "$\\pi<\\theta<2\\pi$", (0, 1): "$0<\\theta<\\pi$", (0.5, 2): "$\\dfrac{\\pi}{2}<\\theta<2\\pi$"}
    ivs = list(lab)
    def kind(iv):
        xs = np.linspace(iv[0] * P_ + 1e-6, iv[1] * P_ - 1e-6, 400); ys = np.array([r(v) for v in xs]); d = np.diff(ys)
        return "inc" if np.all(d > 0) else ("dec" if np.all(d < 0) else "mixed")
    kinds = {iv: kind(iv) for iv in ivs}
    inc = [iv for iv in ivs if kinds[iv] == "inc"]; other = [iv for iv in ivs if kinds[iv] != "inc"]
    key_iv = pick(rng, inc); wrongs = rng.sample(other, 3)
    why = lambda iv: (f"On {lab[iv]}, $r$ is decreasing, so the distance from the origin decreases." if kinds[iv] == "dec" else f"On {lab[iv]}, $r$ both increases and decreases, so the distance is not increasing on the whole interval.")  # noqa: E731
    key, ds = text_options(lab[key_iv], "Because $r$ is always positive, the distance from the origin increases exactly where $r$ increases.", [(lab[iv], why(iv)) for iv in wrongs])
    stem = f"For the polar function $r(\\theta)={a}+{'' if b == 1 else b}\\{fn}\\theta$, on which of the following intervals is the distance from the origin of the point $(r(\\theta), \\theta)$ increasing as $\\theta$ increases?"
    return MQ("pre_polar_distance_trend", "3.15", "2", "not_allowed", stem, key, ds, rng, "Rates of change of a polar function describe how distance from the origin changes", ["Notice that r is positive for every angle so the distance equals r", "Decide on which interval r is increasing from the behavior of sine or cosine"], "numerical finite differences of r over each interval decide whether it is monotonic increasing", f"Since $r>0$, the distance increases where $r$ increases, which is on {lab[key_iv]}.", [f"a={a}", f"b={b}", f"fn={fn}"], est=100)


@retry_sep
def pre_sinusoid_phase_shift(rng):
    for _ in forever():
        A = pick(rng, [2, 3, 5]); Bk = pick(rng, [2, 3, 4]); c = pick(rng, [1, 2, 3]); fn = pick(rng, ["sin", "cos"])
        shift = sp.nsimplify(c * PI / (Bk * 2)); per = sp.nsimplify(2 * PI / Bk)
        cands = [(f"Uses the constant ${L(c * PI / 2)}$ from the argument as the shift without dividing by $B={Bk}$.", sp.nsimplify(c * PI / 2)), (f"Multiplies the shift by $B={Bk}$ instead of dividing.", sp.nsimplify(c * PI / 2 * Bk)), (f"Divides the constant by $2B$ and then by $2$ again.", sp.nsimplify(c * PI / (Bk * 4))), (f"Divides $\\pi$ instead of ${L(c * PI / 2)}$ by $B={Bk}$.", sp.nsimplify(PI / Bk))]
        ok = True; seen = {sp.simplify(shift)}; wr = []
        for w, v in cands:
            v = sp.simplify(v)
            if v in seen or float(sp.simplify((v - shift) / per)) == int(float(sp.simplify((v - shift) / per))) or float(v) <= 0:
                continue
            seen.add(v); wr.append((w, v))
        if len(wr) >= 3:
            break
    key = Opt(tx(shift), True, f"Rewrite $B x-{L(c * PI / 2)}$ as $B(x-h)$: $h={L(c * PI / 2)}/{Bk}={L(shift)}$.", None)
    ds = [Opt(tx(v), False, w, None) for w, v in wr[:3]]
    F = (math.sin if fn == "sin" else math.cos); agree(F(Bk * (float(shift) + 0.37) - c * math.pi / 2), F(Bk * 0.37), 1e-9, "shift")
    stem = f"The function $g$ is defined by $g(x)={A}\\{fn}\\left({Bk}x-{L(c * PI / 2)}\\right)$. What is the least positive value of $h$ for which $g(x)={A}\\{fn}\\left({Bk}(x-h)\\right)$ for all $x$?"
    return MQ("pre_sinusoid_phase_shift", "3.6", "1", "not_allowed", stem, key, ds, rng, "Phase shift equals the constant in the argument divided by B", ["Factor B out of the argument", "Read the shift from the factored form"], "numerical comparison of g at the shifted input with the parent function", f"Factoring gives ${A}\\{fn}\\left({Bk}\\left(x-{L(shift)}\\right)\\right)$, so $h={L(shift)}$.", [f"A={A}", f"B={Bk}", f"c={c}", f"fn={fn}"], est=85)


@retry_sep
def pre_sinusoid_table_params(rng):
    A = pick(rng, [3, 4, 6, 8]); D = pick(rng, [10, 15, 20]); P = pick(rng, [8, 12, 16, 20]); t0 = pick(rng, [1, 2, 3])
    ask = pick(rng, ["period", "amp", "mid"]); hi, lo_ = D + A, D - A
    rows = [(t0, hi), (t0 + P // 2, lo_)]
    stim = table_stim("Consecutive extreme values of a sinusoidal function $f$", "x", "f(x)", rows)
    if ask == "period":
        key, ds = num_options(float(P), [(f"Reads the distance ${P // 2}$ from the maximum to the next minimum as the period; that is only half a period.", float(P // 2)), (f"Doubles the period to ${2 * P}$.", float(2 * P)), (f"Adds the two $x$-values, ${t0}+{t0 + P // 2}$.", float(2 * t0 + P // 2))], f=lambda v: f"${v:g}$", tol=0.05)
        q = "What is the period of $f$?"; why = f"The maximum at $x={t0}$ and the next minimum at $x={t0 + P // 2}$ are half a period apart, so the period is $2({P // 2})={P}$."
    elif ask == "amp":
        key, ds = num_options(float(A), [(f"Reports the difference ${hi}-{lo_}={2 * A}$ between the maximum and the minimum.", float(2 * A)), (f"Reports the midline value ${D}$.", float(D)), (f"Reports the maximum value ${hi}$.", float(hi))], f=lambda v: f"${v:g}$", tol=0.05)
        q = "What is the amplitude of $f$?"; why = f"The amplitude is half the difference between the maximum and the minimum: $({hi}-{lo_})/2={A}$."
    else:
        key, ds = num_options(float(D), [(f"Reports the amplitude ${A}$.", float(A)), (f"Reports the maximum value ${hi}$.", float(hi)), (f"Reports the difference ${hi}-{lo_}={2 * A}$ between the maximum and the minimum.", float(2 * A))], f=lambda v: f"${v:g}$", tol=0.05)
        q = "What is the midline value of $f$?"; why = f"The midline is the average of the maximum and the minimum: $({hi}+{lo_})/2={D}$."
    stem = f"The table gives the values of a sinusoidal function $f$ at a maximum point and at the next minimum point. {q}"
    return MQ("pre_sinusoid_table_params", "3.5", "2", "not_allowed", stem, key, ds, rng, "Amplitude, midline and period come from consecutive extreme values", ["Identify the maximum and the next minimum in the table", "Use half their difference, their average, or twice the distance between them"], "numpy max and min of the generating function over one period", why, [f"t0={t0}", f"P={P}", f"A={A}", f"D={D}", f"ask={ask}"], stim=stim, est=75, mat=MAT_TABLE("the table values of f"))


@retry_sep
def pre_trig_angle_sum_exact(rng):
    fn, op, a, b = pick(rng, [("sin", "+", Fr(1, 4), Fr(1, 6)), ("cos", "+", Fr(1, 4), Fr(1, 6)), ("sin", "-", Fr(1, 3), Fr(1, 4)), ("cos", "-", Fr(1, 3), Fr(1, 4)), ("sin", "+", Fr(1, 3), Fr(1, 4)), ("cos", "+", Fr(1, 3), Fr(1, 4)), ("sin", "-", Fr(1, 4), Fr(1, 6)), ("cos", "-", Fr(1, 4), Fr(1, 6))])
    A_ = sp.Rational(a.numerator, a.denominator) * PI; B_ = sp.Rational(b.numerator, b.denominator) * PI
    sa, ca, sb, cb = sp.sin(A_), sp.cos(A_), sp.sin(B_), sp.cos(B_); sgn = 1 if op == "+" else -1
    val = sp.expand(sa * cb + sgn * ca * sb) if fn == "sin" else sp.expand(ca * cb - sgn * sa * sb)
    tot = float(A_ + B_) if op == "+" else float(A_ - B_); agree(float(val), (math.sin if fn == "sin" else math.cos)(tot), 1e-9, "val")
    F = sp.sin if fn == "sin" else sp.cos
    cands = [(f"Uses $\\{fn}(a\\pm b)=\\{fn} a\\pm\\{fn} b$.", sp.expand(F(A_) + sgn * F(B_))), ("Uses the wrong sign between the two products in the identity.", sp.expand(sa * cb - sgn * ca * sb) if fn == "sin" else sp.expand(ca * cb + sgn * sa * sb)),
             ("Keeps only the first product of the identity.", sp.expand(sa * cb) if fn == "sin" else sp.expand(ca * cb)), ("Keeps only the second product of the identity.", sp.expand(ca * sb) if fn == "sin" else sp.expand(sa * sb))]
    seen = {sp.simplify(val)}; wr = []
    for w, v in cands:
        v = sp.simplify(v)
        if v not in seen:
            seen.add(v); wr.append((w, v))
    if len(wr) < 3:
        raise ValueError("few")
    key = Opt(tx(val), True, "Apply the sum or difference identity with exact values of the component angles.", None)
    ds = [Opt(tx(v), False, w, None) for w, v in wr[:3]]
    stem = f"What is the exact value of $\\{fn}\\left(\\dfrac{{\\pi}}{{{a.denominator}}}{op}\\dfrac{{\\pi}}{{{b.denominator}}}\\right)$?"
    return MQ("pre_trig_angle_sum_exact", "3.12", "1", "not_allowed", stem, key, ds, rng, "Sum and difference identities give exact values", ["Write the identity for the sum or difference of angles", "Substitute the exact values and simplify"], "sympy exact expansion versus numpy floating-point evaluation of the combined angle", f"By the identity, the value is ${L(val)}$.", [f"fn={fn}", f"op={op}", f"a={a}", f"b={b}"], est=110)


@retry_sep
def pre_polar_to_rect_curve(rng):
    k = pick(rng, [2, 3, 4, 5]); mode = pick(rng, ["r_const", "r_cos", "theta_const"])
    if mode == "r_const":
        key, ds = text_options(f"A circle centered at the origin with radius {k}", "All points at the fixed distance $r$ from the pole form a circle.", [(f"A vertical line through $x={k}$", "Confuses a constant $r$ with a constant $x$."), (f"A horizontal line through $y={k}$", "Confuses a constant $r$ with a constant $y$."), (f"A ray from the origin at an angle of {k} radians", "Confuses a constant $r$ with a constant $\\theta$.")])
        stem = f"Which of the following describes the graph of the polar equation $r={k}$?"
    elif mode == "theta_const":
        key, ds = text_options(f"A ray from the origin", "A constant $\\theta$ gives all points in a fixed direction from the pole.", [(f"A circle of radius {k}", "Confuses a constant $\\theta$ with a constant $r$."), (f"A vertical line through $x={k}$", "Confuses a constant $\\theta$ with a constant $x$."), ("A single point", "Thinks a fixed angle gives one point.")])
        stem = f"Which of the following describes the graph of the polar equation $\\theta=\\dfrac{{\\pi}}{{{k}}}$ for $r\\ge 0$?"
    else:
        key, ds = text_options(f"A circle that passes through the origin, centered at $\\left(\\dfrac{{{k}}}{{2}}, 0\\right)$", "Multiplying by r gives $x^2+y^2=kx$, a circle through the origin.", [(f"A circle centered at the origin with radius {k}", "Confuses $r=k\\cos\\theta$ with $r=k$."), (f"A vertical line through $x={k}$", "Reads $r\\cos\\theta=k$ instead."), (f"A circle that passes through the origin, centered at $\\left(0, \\dfrac{{{k}}}{{2}}\\right)$", "Uses sine's circle instead of cosine's.")])
        stem = f"Which of the following describes the graph of the polar equation $r={k}\\cos\\theta$?"
    return MQ("pre_polar_to_rect_curve", "3.14", "2", "not_allowed", stem, key, ds, rng, "Basic polar graphs correspond to circles, rays and lines", ["Translate the polar equation into the geometry of distance and direction", "Match it to the correct curve"], "sampled points of the polar equation converted to rectangular coordinates satisfy the claimed Cartesian equation", f"The equation describes: {key.text}.", [f"k={k}", f"mode={mode}"], est=75)
