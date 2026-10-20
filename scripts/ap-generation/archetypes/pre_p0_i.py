"""AP Precalculus 원형 I — 단원 3(삼각·극) 2차 저작: 계산기 불가 13 + 그래핑 계산기 필수 6."""
from pre_common import *
from pre_common import _O

PI = sp.pi
STAGE_U3C = ["pre_sin_graph_reading", "pre_sinusoid_equation_from_table", "pre_sin_arccos_value", "pre_tan_from_sin", "pre_radian_conversion", "pre_csc_undefined", "pre_trig_inequality_interval",
             "pre_double_angle_value", "pre_polar_zero_angles", "pre_polar_max_r", "pre_sin_cos_shift_equiv", "pre_period_from_rate", "pre_unit_circle_coords",
             "pre_trig_zero_count_calc", "pre_polar_max_y_calc", "pre_arcsin_context_calc", "pre_tan_model_solve_calc", "pre_polar_x_extreme_calc", "pre_sin_rate_time_calc"]


@retry_sep
def pre_sin_graph_reading(rng):
    A = pick(rng, [2, 3, 4]); per = pick(rng, [4, 6, 8]); D = pick(rng, [-1, 0, 1, 2]); fn = pick(rng, ["sin", "cos"])
    Bk = 2 * math.pi / per; f = lambda v: A * (math.sin if fn == "sin" else math.cos)(Bk * v) + D  # noqa: E731
    hi = per * 1.25; ask = pick(rng, ["period", "max", "amp"])
    stim = fn_graph("The graph of a sinusoidal function $f$ for $0\\le x\\le " + f"{hi:g}$", f, 0, hi, gaxis("x", 0, hi, per / 4), gaxis("y", D - A - 1, D + A + 1, 1), n=181)
    if ask == "period":
        key, ds = num_options(float(per), [("Reads the distance from a maximum to the next minimum as the period.", per / 2), ("Reads the distance covering two periods.", float(2 * per)), ("Uses $2\\pi$ as the period.", 2 * math.pi), ("Reads the amplitude as the period.", float(A))], f=lambda v: f"${v:g}$" if abs(v - round(v, 3)) < 1e-9 and v == int(v) else (dec(v, 3) if False else f"$2\\pi$" if abs(v - 2 * math.pi) < 1e-9 else f"${v:g}$"), tol=0.05)
        q = "What is the period of $f$?"
    elif ask == "max":
        key, ds = num_options(float(D + A), [("Reports the amplitude instead of the maximum value.", float(A)), ("Reports the midline value.", float(D)), ("Reports the difference between the maximum and the minimum.", float(2 * A)), ("Reports the minimum value.", float(D - A))], f=lambda v: f"${v:g}$", tol=0.05)
        q = "What is the maximum value of $f$?"
    else:
        key, ds = num_options(float(A), [("Reports the maximum value.", float(D + A)), ("Reports the difference between the maximum and the minimum.", float(2 * A)), ("Reports the midline value.", float(D if D else A + 3)), ("Reports half of the period.", per / 2)], f=lambda v: f"${v:g}$", tol=0.05)
        q = "What is the amplitude of $f$?"
    stem = f"A portion of the graph of a sinusoidal function $f$ is shown. {q}"
    return MQ("pre_sin_graph_reading", "3.4", "2", "not_allowed", stem, key, ds, rng, "Features of a sinusoidal function are read from its graph", ["Locate the maximum and minimum points and a full cycle on the graph", "Compute the requested feature from them"], "numerical maximum, minimum and period of the plotted function", f"The maximum is {D + A}, the minimum is {D - A}, and one cycle has length {per}.", [f"A={A}", f"per={per}", f"D={D}", f"fn={fn}", f"ask={ask}"], stim=stim, est=75, mat=MAT_GRAPH("the plotted curve"))


@retry_sep
def pre_sinusoid_equation_from_table(rng):
    A = pick(rng, [3, 4, 6]); D = pick(rng, [8, 10, 14]); P = pick(rng, [8, 12, 16]); fn = pick(rng, ["cos", "sin"])
    f = lambda v: D + A * (math.cos if fn == "cos" else math.sin)(2 * math.pi * v / P)  # noqa: E731
    ts = [P * k // 4 for k in range(5)]; ys = [round(f(v)) for v in ts]
    if abs(f(ts[1]) - round(f(ts[1]))) > 1e-9:
        raise ValueError("round")
    fm = lambda a_, f_: f"$h(t)={a_}\\{f_}\\left(\\dfrac{{2\\pi}}{{{P}}}t\\right)+{D}$"  # noqa: E731
    wrong_f = "sin" if fn == "cos" else "cos"
    key, ds = text_options(fm(A, fn), "The value at t=0 and the pattern over one period identify cosine or sine; the amplitude and midline come from the extreme values.", [(fm(A, wrong_f), "Chooses the wrong parent function for the starting value."), (fm(-A, fn), "Uses a negative amplitude although the starting value is not the minimum." if fn == "cos" else "Uses a negative amplitude although the function first increases."), (f"$h(t)={A}\\{fn}\\left({P}t\\right)+{D}$", "Uses the period as the value of b."), (fm(A + D, fn).replace(f"+{D}$", f"+{D}$"), "Uses the maximum value as the amplitude.")])
    stim = table_stim("Values of a sinusoidal function $h$ over one period", "t", "h(t)", list(zip(ts, ys)))
    stem = "The table gives values of a sinusoidal function $h$ over one full period. Which of the following could be an expression for $h(t)$?"
    return MQ("pre_sinusoid_equation_from_table", "3.6", "2", "not_allowed", stem, key, ds, rng, "Write a sinusoidal equation from tabular data", ["Find the amplitude, midline and period from the table", "Choose sine or cosine from the value at t=0 and the next values"], "evaluation of the proposed expression at each table input", f"The maximum and minimum give amplitude {A} and midline {D}; the period is {P}; the pattern matches {fn}.", [f"ts={ts}", f"ys={ys}", f"fn={fn}"], stim=stim, est=95, mat=MAT_TABLE("the table values of h"))


@retry_sep
def pre_sin_arccos_value(rng):
    pair = pick(rng, [(Fr(3, 5), Fr(4, 5)), (Fr(5, 13), Fr(12, 13)), (Fr(8, 17), Fr(15, 17)), (Fr(4, 5), Fr(3, 5))]); c, s = pair; outer = pick(rng, ["sin", "tan", "cos"])
    cs = sp.Rational(c.numerator, c.denominator); sn = sp.Rational(s.numerator, s.denominator)
    th = math.acos(float(c))
    if outer == "sin":
        val = sn; expr = f"\\sin\\left(\\arccos\\left({L(cs)}\\right)\\right)"; agree(float(val), math.sin(th), 1e-9, "v")
        wr = [("Uses the cosine value itself.", cs), ("Uses $1-\\cos\\theta$.", 1 - cs), ("Uses $\\sqrt{1-\\cos\\theta}$ without squaring first.", sp.sqrt(1 - cs)), ("Uses the reciprocal.", 1 / sn)]
    elif outer == "tan":
        val = sn / cs; expr = f"\\tan\\left(\\arccos\\left({L(cs)}\\right)\\right)"; agree(float(val), math.tan(th), 1e-9, "v")
        wr = [("Reports the reciprocal, the cotangent.", cs / sn), ("Reports the sine instead of the tangent.", sn), ("Reports the cosine instead of the tangent.", cs), ("Subtracts instead of dividing.", sn - cs)]
    else:
        val = 2 * cs ** 2 - 1; expr = f"\\cos\\left(2\\arccos\\left({L(cs)}\\right)\\right)"; agree(float(val), math.cos(2 * th), 1e-9, "v")
        wr = [("Doubles the cosine value.", 2 * cs), ("Squares the cosine value without the double-angle identity.", cs ** 2), ("Uses $1-2\\cos^2\\theta$.", 1 - 2 * cs ** 2), ("Uses $\\cos 2\\theta=2\\cos\\theta$ with the wrong sign.", -2 * cs)]
    seen = {val}; opts = []
    for w, v in wr:
        v = sp.nsimplify(v)
        if v not in seen:
            seen.add(v); opts.append(Opt(tx(v), False, w, None))
    if len(opts) < 3:
        raise ValueError("few")
    key = Opt(tx(val), True, "Use a right triangle or an identity for the angle whose cosine is given.", None)
    stem = f"What is the value of ${expr}$?"
    return MQ("pre_sin_arccos_value", "3.9", "1", "not_allowed", stem, key, opts[:3], rng, "Evaluate a trigonometric function of an inverse trigonometric value", ["Let the angle be the arccosine and draw the right triangle with the given ratio", "Read the requested trigonometric value from the triangle or identity"], "numerical evaluation of the composition using floating-point inverse cosine", f"The value is ${L(val)}$.", [f"c={c}", f"outer={outer}"], est=90)


@retry_sep
def pre_tan_from_sin(rng):
    s, c_ = pick(rng, [(3, 4), (5, 12), (8, 15), (7, 24)]); quad = pick(rng, ["II", "III", "IV", "I"])
    h = math.hypot(s, c_); sn = {"I": 1, "II": 1, "III": -1, "IV": -1}[quad]; cn = {"I": 1, "II": -1, "III": -1, "IV": 1}[quad]
    ask = pick(rng, ["tan", "cos"])
    sin_v = sp.Rational(sn * s, int(h)); cos_v = sp.Rational(cn * c_, int(h)); val = sin_v / cos_v if ask == "tan" else cos_v
    agree(float(val), (sn * s / (cn * c_)) if ask == "tan" else cn * c_ / h, 1e-9, "val")
    wr = [("Uses the wrong sign for the quadrant.", -val), ("Uses the reciprocal.", 1 / val if val != 0 else None), ("Reports the sine value instead of the requested function." if ask == "cos" else "Reports the cosine value instead of the requested function.", sin_v if ask == "cos" else cos_v),
          ("Uses the positive reference-triangle ratio without regard to the quadrant.", abs(val)), ("Reports the absolute value of the reciprocal.", abs(1 / val) if val != 0 else None), ("Adds the sine and cosine values.", sin_v + cos_v)]
    seen = {val}; opts = []
    for w, v in wr:
        if v is None:
            continue
        v = sp.nsimplify(v)
        if v not in seen:
            seen.add(v); opts.append(Opt(tx(v), False, w, None))
    if len(opts) < 3:
        raise ValueError("few")
    key = Opt(tx(val), True, "Use the Pythagorean identity or a reference triangle and apply the sign for the quadrant.", None)
    stem = f"The angle $\\theta$ is in quadrant {quad} and $\\sin\\theta={L(sin_v)}$. What is the value of $\\{ask}\\theta$?"
    return MQ("pre_tan_from_sin", "3.2", "1", "not_allowed", stem, key, opts[:3], rng, "Find other trigonometric values from one value and the quadrant", ["Use a reference triangle or the Pythagorean identity to find the missing coordinate", "Apply the sign for the given quadrant"], "numerical evaluation at an angle in the given quadrant with the same sine", f"The missing leg gives cosine ${L(cos_v)}$ and tangent ${L(sin_v / cos_v)}$.", [f"s={s}", f"c={c_}", f"quad={quad}", f"ask={ask}"], est=90)


@retry_sep
def pre_radian_conversion(rng):
    mode = pick(rng, ["to_rad", "to_deg", "arc"])
    if mode == "to_rad":
        d = pick(rng, [30, 45, 60, 120, 135, 150, 210, 225, 300]); val = sp.Rational(d, 180) * PI
        key, ds = text_options(tx(val), "Multiply the degree measure by pi over 180.", [(tx(sp.Rational(180, d) * PI), "Inverts the conversion factor."), (tx(sp.Rational(d, 90) * PI), "Uses pi over 90 as the conversion factor."), (tx(sp.Rational(d) * PI / 360), "Uses pi over 360 as the conversion factor.")])
        stem = f"What is the radian measure of an angle of ${d}^\\circ$?"
    elif mode == "to_deg":
        n_, d_ = pick(rng, [(5, 6), (7, 6), (3, 4), (2, 3), (5, 3), (11, 6)]); deg = int(sp.Rational(n_, d_) * 180)
        key, ds = text_options(f"${deg}^\\circ$", "Multiply the radian measure by 180 over pi.", [(f"${int(sp.Rational(n_, d_) * 90)}^\\circ$", "Uses 90 over pi as the conversion factor."), (f"${int(sp.Rational(n_, d_) * 360)}^\\circ$", "Uses 360 over pi as the conversion factor."), (f"${int(sp.Rational(d_, n_) * 180)}^\\circ$", "Inverts the fraction before converting.")])
        stem = f"What is the degree measure of an angle of ${L(sp.Rational(n_, d_) * PI)}$ radians?"
    else:
        r = pick(rng, [4, 6, 9, 12]); n_, d_ = pick(rng, [(1, 3), (1, 2), (2, 3), (3, 4), (5, 6)]); s = sp.Rational(n_, d_) * PI * r
        key, ds = text_options(tx(s), "Arc length equals the radius times the central angle in radians.", [(tx(sp.Rational(n_, d_) * PI * r * r / 2), "Uses the area formula for a sector."), (tx(sp.Rational(n_, d_) * PI), "Forgets the radius."), (tx(sp.Rational(n_, d_) * 180 * r), "Uses the angle in degrees without converting to radians.")])
        stem = f"A circle has radius ${r}$ centimeters. What is the length, in centimeters, of the arc intercepted by a central angle of ${L(sp.Rational(n_, d_) * PI)}$ radians?"
    return MQ("pre_radian_conversion", "3.1", "1", "not_allowed", stem, key, ds, rng, "Radian measure relates angles to arc length and degrees", ["Recall the relationship between radians, degrees and arc length", "Apply the conversion factor or formula in the right direction"], "numerical evaluation of the conversion", f"The correct value is {key.text}.", [f"mode={mode}"], est=65)


@retry_sep
def pre_csc_undefined(rng):
    fn = pick(rng, ["csc", "sec", "cot"]); k = pick(rng, [1, 2, 3])
    base = {"csc": sp.sin, "sec": sp.cos, "cot": sp.sin}[fn]
    zeros = {"csc": "$x=n\\pi$ for integers $n$", "sec": "$x=\\dfrac{\\pi}{2}+n\\pi$ for integers $n$", "cot": "$x=n\\pi$ for integers $n$"}[fn]
    key, ds = text_options(zeros, "A reciprocal function is undefined where the matching function is zero.", [({"csc": "$x=\\dfrac{\\pi}{2}+n\\pi$ for integers $n$", "sec": "$x=n\\pi$ for integers $n$", "cot": "$x=\\dfrac{\\pi}{2}+n\\pi$ for integers $n$"}[fn], "Uses the zeros of the other function."), ("$x=2n\\pi$ for integers $n$", "Uses only every other zero."), ("$x=\\dfrac{n\\pi}{2}$ for integers $n$", "Uses the zeros of both sine and cosine.")])
    stem = f"For which values of $x$ is $\\{fn}\\,x$ undefined?"
    del k, base
    return MQ("pre_csc_undefined", "3.11", "1", "not_allowed", stem, key, ds, rng, "Reciprocal trigonometric functions are undefined where the denominator is zero", ["Write the reciprocal function as a quotient", "Find where the denominator is zero"], "numerical evaluation of the denominator near the claimed values", f"{zeros} is where the denominator is zero.", [f"fn={fn}"], est=70)


@retry_sep
def pre_trig_inequality_interval(rng):
    fn = pick(rng, ["sin", "cos"]); v = pick(rng, [sp.Rational(1, 2), sp.sqrt(2) / 2, sp.sqrt(3) / 2, -sp.Rational(1, 2)]); sgn = pick(rng, [">", "<"])
    F = sp.sin if fn == "sin" else sp.cos; f = lambda t_: float(F(t_)) - float(v)  # noqa: E731
    sols = sorted(float(z) for z in sp.solveset(sp.Eq(F(X), v), X, sp.Interval.Ropen(0, 2 * PI))); crit = sorted(sp.solveset(sp.Eq(F(X), v), X, sp.Interval.Ropen(0, 2 * PI)), key=float)
    pts = [0.0, *sols, 2 * math.pi]; ints = []
    for i in range(len(pts) - 1):
        mid = (pts[i] + pts[i + 1]) / 2
        if (f(mid) > 0) == (sgn == ">"):
            ints.append((pts[i], pts[i + 1], i))
    ptsS = [sp.Integer(0), *crit, 2 * PI]
    tex_iv = lambda a_, b_: f"\\left({L(a_)}, {L(b_)}\\right)"  # noqa: E731
    ans = "$" + "\\cup".join(tex_iv(ptsS[i], ptsS[i + 1]) for _, _, i in ints) + "$"
    others = []
    for j in range(len(ptsS) - 1):
        for k_ in range(j, len(ptsS) - 1):
            pass
    comp = "$" + "\\cup".join(tex_iv(ptsS[i], ptsS[i + 1]) for i in range(len(pts) - 1) if i not in [t[2] for t in ints]) + "$"
    alt1 = f"$\\left({L(crit[0])}, {L(crit[1])}\\right)$"; alt2 = ans.replace("\\left(", "\\left[").replace("\\right)", "\\right]")
    wr = [(comp, "Reports the solution set of the reversed inequality."), (alt1, "Reports the interval between the two solutions of the equation regardless of the inequality."), (alt2, "Includes the endpoints even though the inequality is strict."),
          (f"$\\left(0, {L(crit[0])}\\right)$", "Reports only the first interval from the origin to the first solution."), (f"$\\left({L(crit[1])}, 2\\pi\\right)$", "Reports only the last interval after the second solution.")]
    wr = [(t, w) for t, w in wr if t != ans]
    key, ds = text_options(ans, "Find where the graph of the function is above or below the horizontal line by locating the two solutions of the equation on one period.", wr)
    stem = f"What is the solution set of the inequality $\\{fn}\\,x{sgn}{L(v)}$ on the interval $0\\le x<2\\pi$?"
    del others
    return MQ("pre_trig_inequality_interval", "3.10", "2", "not_allowed", stem, key, ds, rng, "Trigonometric inequalities are solved from the solutions of the related equation", ["Solve the related equation on the interval", "Test each resulting interval for the direction of the inequality"], "numerical sign tests at the midpoints of the intervals", f"The solutions of the equation split the interval; the inequality holds on {ans}.", [f"fn={fn}", f"v={v}", f"sgn={sgn}"], est=105)


@retry_sep
def pre_double_angle_value(rng):
    s, c_ = pick(rng, [(3, 4), (5, 12), (8, 15), (7, 24)]); h = int(math.hypot(s, c_)); sn = sp.Rational(s, h); cs = sp.Rational(c_, h); ask = pick(rng, ["sin2", "cos2"])
    th = math.asin(float(sn)); val = 2 * sn * cs if ask == "sin2" else cs ** 2 - sn ** 2
    agree(float(val), math.sin(2 * th) if ask == "sin2" else math.cos(2 * th), 1e-9, "val")
    wr = [("Doubles the sine value.", 2 * sn) if ask == "sin2" else ("Squares the cosine value only.", cs ** 2), ("Uses $\\sin 2\\theta=\\sin\\theta\\cos\\theta$ without the factor 2." if ask == "sin2" else "Uses $\\cos 2\\theta=\\cos^2\\theta+\\sin^2\\theta$.", sn * cs if ask == "sin2" else sp.Integer(1)), ("Doubles the cosine value." if ask == "sin2" else "Uses $\\cos 2\\theta=2\\cos\\theta$.", 2 * cs), ("Uses the sum instead of the difference of squares." if ask == "cos2" else "Uses $\\sin 2\\theta=2\\sin\\theta$.", cs ** 2 + sn ** 2 if ask == "cos2" else 2 * sn)]
    seen = {val}; opts = []
    for w, v in wr:
        v = sp.nsimplify(v)
        if v not in seen:
            seen.add(v); opts.append(Opt(tx(v), False, w, None))
    if len(opts) < 3:
        raise ValueError("few")
    key = Opt(tx(val), True, "Use the double-angle identity with the sine and cosine found from the right triangle.", None)
    stem = f"The angle $\\theta$ is in quadrant I and $\\sin\\theta={L(sn)}$. What is the value of $\\{ask[:3]}\\,2\\theta$?"
    return MQ("pre_double_angle_value", "3.12", "1", "not_allowed", stem, key, opts[:3], rng, "Double-angle identities evaluate trigonometric values of twice an angle", ["Find the cosine from the Pythagorean identity", "Apply the double-angle identity"], "numerical evaluation of sin 2θ or cos 2θ at the angle with the given sine", f"The identity gives ${L(val)}$.", [f"s={s}", f"c={c_}", f"ask={ask}"], est=95)


@retry_sep
def pre_polar_zero_angles(rng):
    a = pick(rng, [1, 2]); b = pick(rng, [2, 4]); fn = pick(rng, ["cos"])
    # r = a + b cos θ, 0<=θ<2π: r=0 at cosθ = -a/b
    cv = sp.Rational(-a, b)
    if abs(float(cv)) > 1:
        raise ValueError("range")
    if cv not in (sp.Rational(-1, 2), sp.Rational(-1, 1), sp.Rational(1, 2)):
        raise ValueError("nonexact")
    sols = sorted(sp.solveset(sp.Eq(sp.cos(X), cv), X, sp.Interval.Ropen(0, 2 * PI)), key=float)
    tex_s = lambda ss: " and ".join(f"$\\theta={L(s_)}$" for s_ in ss)  # noqa: E731
    other = sorted(sp.solveset(sp.Eq(sp.cos(X), -cv), X, sp.Interval.Ropen(0, 2 * PI)), key=float) if cv != -1 else [sp.Integer(0)]
    cands = [(tex_s(other), "Solves $\\cos\\theta$ equal to the opposite value."), (tex_s([sp.pi / 2, 3 * sp.pi / 2]), "Sets the cosine itself equal to zero instead of $r$."), (tex_s([s_ / 2 for s_ in sols]), "Halves the solutions."), (tex_s([sp.pi - s_ if float(sp.pi - s_) > 0 else s_ + sp.pi for s_ in sols[:1]]), "Reports a single related angle.")]
    seen = {tex_s(sols)}; wr = []
    for t, w in cands:
        if t not in seen:
            seen.add(t); wr.append((t, w))
    key, ds = text_options(tex_s(sols), "The curve passes through the pole where r=0; solve the equation for cosθ and use the unit circle.", wr)
    stem = f"The polar function $r$ is defined by $r(\\theta)={a}+{b}\\cos\\theta$. For which values of $\\theta$ in the interval $0\\le\\theta<2\\pi$ does the graph of $r$ pass through the pole (the origin)?"
    return MQ("pre_polar_zero_angles", "3.14", "2", "not_allowed", stem, key, ds, rng, "A polar graph passes through the pole where r equals zero", ["Set r equal to zero", "Solve for theta on the interval using exact cosine values"], "numerical evaluation of r at the claimed angles", f"Setting $r=0$ gives $\\cos\\theta={L(cv)}$, so {tex_s(sols)}.", [f"a={a}", f"b={b}"], est=100)


@retry_sep
def pre_polar_max_r(rng):
    a = pick(rng, [1, 2, 3]); b = pick(rng, [-4, -3, 2, 5]); fn = pick(rng, ["sin", "cos"]); F = (np.sin if fn == "sin" else np.cos)
    th = np.linspace(0, 2 * math.pi, 200001); rv = a + b * F(th); mx = float(rv.max()); amax = float(np.max(np.abs(rv)))
    ask = pick(rng, ["r", "dist"])
    val = mx if ask == "r" else amax
    key, ds = num_options(float(round(val)), [("Reports the coefficient $b$ as the maximum.", float(abs(b))), ("Reports the constant $a$ as the maximum.", float(a)), ("Reports $|b|-a$.", float(abs(abs(b) - a)) if abs(abs(b) - a) != val else float(abs(b) + 1)), ("Reports $a+|b|$ when $r$ itself is not maximal there." if ask == "r" and b < 0 else "Reports the minimum value of $r$.", float(a + abs(b)) if ask == "r" and b < 0 else float(rv.min()))], f=lambda v: f"${int(v)}$", tol=0.05)
    stem = f"For the polar function $r(\\theta)={a}{'+' if b >= 0 else '-'}{abs(b)}\\{fn}\\theta$, " + ("what is the greatest value of $r$ for $0\\le\\theta\\le 2\\pi$?" if ask == "r" else "what is the greatest distance from the origin of a point on the graph?")
    return MQ("pre_polar_max_r", "3.14", "2", "not_allowed", stem, key, ds, rng, "Extreme values of r and of |r| for a limaçon", ["Find the greatest and least values of r from the sinusoidal term", "For distance, use the greatest absolute value of r"], "dense numerical evaluation of r over 0 to 2 pi", f"The values of r range from {rv.min():.0f} to {mx:.0f}, so the answer is {round(val)}.", [f"a={a}", f"b={b}", f"fn={fn}", f"ask={ask}"], est=85)


@retry_sep
def pre_sin_cos_shift_equiv(rng):
    kind = pick(rng, ["sin_to_cos", "cos_to_sin", "neg"]); sh = pick(rng, [sp.pi / 2, sp.pi, 3 * sp.pi / 2])
    if kind == "sin_to_cos":
        orig = sp.sin(X + PI / 2); key_e = sp.cos(X); wr = [("Uses $\\sin(x+\\pi/2)=\\sin x$.", sp.sin(X)), ("Uses $\\sin(x+\\pi/2)=-\\cos x$.", -sp.cos(X)), ("Uses $\\sin(x+\\pi/2)=-\\sin x$.", -sp.sin(X)), ("Uses $\\sin(x+\\pi/2)=\\cos 2x$.", sp.cos(2 * X))]
    elif kind == "cos_to_sin":
        orig = sp.cos(X - PI / 2); key_e = sp.sin(X); wr = [("Uses $\\cos(x-\\pi/2)=\\cos x$.", sp.cos(X)), ("Uses $\\cos(x-\\pi/2)=-\\sin x$.", -sp.sin(X)), ("Uses $\\cos(x-\\pi/2)=-\\cos x$.", -sp.cos(X)), ("Uses $\\cos(x-\\pi/2)=\\sin 2x$.", sp.sin(2 * X))]
    else:
        orig = sp.sin(X + PI); key_e = -sp.sin(X); wr = [("Uses $\\sin(x+\\pi)=\\sin x$.", sp.sin(X)), ("Uses $\\sin(x+\\pi)=\\cos x$.", sp.cos(X)), ("Uses $\\sin(x+\\pi)=-\\cos x$.", -sp.cos(X)), ("Uses $\\sin(x+\\pi)=\\sin 2x$.", sp.sin(2 * X))]
    f = sp.lambdify(X, orig, "math"); g = sp.lambdify(X, key_e, "math"); agree(f(0.83), g(0.83), 1e-9, "eq")
    key, ds = expr_options(key_e, wr, probe=[0.41, 0.83, 1.17, 1.9, 2.5])
    stem = f"Which of the following is equivalent to ${L(orig)}$ for all $x$?"
    return MQ("pre_sin_cos_shift_equiv", "3.12", "1", "not_allowed", stem, key, ds, rng, "Phase shifts relate sine and cosine", ["Recognize the shift of a quarter or half period", "Rewrite using the matching function and sign"], "numerical evaluation of both expressions at test values", f"The shifted function equals ${L(key_e)}$.", [f"kind={kind}"], est=75)


@retry_sep
def pre_period_from_rate(rng):
    rpm = pick(rng, [2, 3, 4, 5, 6]); P = Fr(60, rpm); b = 2 * sp.pi / sp.Rational(P.numerator, P.denominator); R_ = pick(rng, [10, 15, 20])
    key, ds = text_options(f"$h(t)={R_}\\sin\\left({L(b)}\\,t\\right)+{R_ + 2}$", "The period in seconds is 60 divided by the revolutions per minute, and b equals 2 pi over the period.",
                           [(f"$h(t)={R_}\\sin\\left({L(sp.Rational(rpm) * 2 * sp.pi)}\\,t\\right)+{R_ + 2}$", "Uses revolutions per minute as the period."), (f"$h(t)={R_}\\sin\\left({L(sp.Rational(P.numerator, P.denominator))}\\,t\\right)+{R_ + 2}$", "Uses the period as the value of b."), (f"$h(t)={R_}\\sin\\left({L(sp.pi / sp.Rational(P.numerator, P.denominator))}\\,t\\right)+{R_ + 2}$", "Uses pi over the period for b, which gives a period twice as long.")])
    stem = f"A rider on a wheel of radius ${R_}$ feet makes ${rpm}$ revolutions per minute. The height of the rider above the ground, in feet, at time $t$ seconds is modeled by $h(t)={R_}\\sin(bt)+{R_ + 2}$. Which of the following gives the correct expression for $h(t)$?"
    return MQ("pre_period_from_rate", "3.7", "2", "not_allowed", stem, key, ds, rng, "The period of a rotating model comes from the rotation rate", ["Convert revolutions per minute to the period in seconds", "Use b = 2 pi over the period"], "numerical check that h repeats after the computed period", f"The period is ${L(sp.Rational(P.numerator, P.denominator))}$ seconds, so $b={L(b)}$.", [f"rpm={rpm}", f"R={R_}"], est=95)


@retry_sep
def pre_unit_circle_coords(rng):
    ang = pick(rng, [Fr(1, 3), Fr(2, 3), Fr(5, 6), Fr(7, 6), Fr(5, 4), Fr(11, 6), Fr(4, 3), Fr(5, 3)]); th = sp.Rational(ang.numerator, ang.denominator) * PI
    x_, y_ = sp.nsimplify(sp.cos(th)), sp.nsimplify(sp.sin(th)); pt = lambda a_, b_: f"$\\left({L(a_)}, {L(b_)}\\right)$"  # noqa: E731
    cands = [(pt(y_, x_), "Swaps the cosine and sine coordinates."), (pt(-x_, y_), "Uses the wrong sign for the x-coordinate."), (pt(x_, -y_), "Uses the wrong sign for the y-coordinate."), (pt(-x_, -y_), "Uses the point on the opposite side of the circle.")]
    seen = {pt(x_, y_)}; wr = []
    for t, w in cands:
        if t not in seen:
            seen.add(t); wr.append((t, w))
    if len(wr) < 3:
        raise ValueError("few")
    key, ds = text_options(pt(x_, y_), "On the unit circle the point at angle theta is (cos theta, sin theta).", wr[:3])
    stem = f"What are the coordinates of the point where the terminal ray of an angle of ${L(th)}$ radians in standard position intersects the unit circle?"
    agree(float(x_) ** 2 + float(y_) ** 2, 1.0, 1e-9, "unit")
    return MQ("pre_unit_circle_coords", "3.2", "1", "not_allowed", stem, key, ds, rng, "Coordinates on the unit circle are the cosine and sine of the angle", ["Locate the angle's quadrant and reference angle", "Write the cosine as x and the sine as y with the right signs"], "numerical cosine and sine of the angle give the coordinates on the unit circle", f"The point is $(\\cos\\theta,\\sin\\theta)=\\left({L(x_)}, {L(y_)}\\right)$.", [f"ang={ang}"], est=70)


@retry_sep
def pre_trig_zero_count_calc(rng):
    for _ in forever():
        a = pick(rng, [2, 3, 4]); b = pick(rng, [1, 2, 3]); m = pick(rng, [0.3, 0.5, 0.8]); hi = pick(rng, [8, 10, 12])
        f = lambda v: a * math.sin(b * v) - m * v  # noqa: E731
        sc = solve_all(f, 0.0001, hi, 20000)
        if len(sc) >= 2:
            break
    n = len(sc) + 1
    xs = np.linspace(0, hi, 400001); ys = a * np.sin(b * xs) - m * xs; cnt = 1 + int(np.sum(ys[:-1] * ys[1:] < 0)); agree(float(cnt), float(n), 1e-9, "count")
    key, ds = num_options(float(n), [("Excludes the solution at $x=0$.", float(n - 1)), ("Counts only the positive crossings of the sine curve through the $x$-axis.", float(max(int(b * hi / math.pi), 1))), ("Counts the maxima of the sine curve in the interval.", float(max(int(b * hi / (2 * math.pi)), 1))), ("Counts one extra solution.", float(n + 1))], f=lambda v: f"${int(v)}$", tol=0.1)
    stem = f"Using a graphing calculator in radian mode, how many solutions does the equation ${a}\\sin({b}x)={m:g}x$ have on the interval $0\\le x\\le {hi}$?"
    return MQ("pre_trig_zero_count_calc", "3.10", "2", "required", stem, key, ds, rng, "Count intersections of a sinusoid and a line", ["Graph both functions on the interval in radian mode", "Count all intersections, including the one at the origin"], "a dense sign-change scan of the difference over the interval", f"The graphs intersect {n} times on the interval.", [f"a={a}", f"b={b}", f"m={m}", f"hi={hi}"], est=100)


@retry_sep
def pre_polar_max_y_calc(rng):
    for _ in forever():
        a = pick(rng, [1, 2, 3]); b = pick(rng, [2, 3, 4]); th = np.linspace(0, 2 * math.pi, 400001); y = (a + b * np.cos(th)) * np.sin(th); ym = float(y.max())
        f = lambda t_: -((a + b * math.cos(t_)) * math.sin(t_))  # noqa: E731
        r = _O.minimize_scalar(f, bounds=(0.05, 2.0), method="bounded", options={"xatol": 1e-12}); agree(-r.fun, ym, 1e-6, "ym")
        if abs(ym - round(ym, 1)) > 0.02:
            break
    xm = (a + b * math.cos(r.x)) * math.cos(r.x)
    key, ds = num_options(ym, [("Reports the greatest value of $r$ instead of the greatest $y$-coordinate.", float(a + b)), ("Reports the $x$-coordinate at the point of greatest height.", xm), ("Reports $a+b\\sin\\theta$ evaluated at $\\theta=\\pi/2$.", float(a + b * math.sin(math.pi / 2))), ("Reports the angle at which the maximum occurs.", float(r.x))], tol=0.05, n=2)
    stem = f"The graph of the polar function $r(\\theta)={a}+{b}\\cos\\theta$ for $0\\le\\theta\\le 2\\pi$ is a limaçon. Using a graphing calculator, what is the greatest $y$-coordinate of a point on the graph?"
    return MQ("pre_polar_max_y_calc", "3.14", "2", "required", stem, key, ds, rng, "The greatest height of a polar curve uses y = r sin theta", ["Write y as r times sin theta", "Find the maximum of this expression on the interval with a graphing calculator"], "bounded numerical optimization versus a dense grid maximum", f"The greatest value of $(a+b\\cos\\theta)\\sin\\theta$ is about ${ym:.3f}$.", [f"a={a}", f"b={b}"], est=105)


@retry_sep
def pre_arcsin_context_calc(rng):
    L_ = pick(rng, [10.0, 12.0, 15.0, 20.0]); h = pick(rng, [6.0, 8.0, 9.0, 11.0]); th = math.asin(h / L_)
    if not (0.1 < th < 1.4) or h >= L_:
        raise ValueError("range")
    chk = _O.brentq(lambda v: math.sin(v) - h / L_, 0, 1.5707, xtol=1e-12); agree(th, chk, 1e-9, "th")
    key, ds = num_options(th, [("Reports the angle in degrees.", math.degrees(th)), ("Uses the cosine of the ratio: $\\cos^{-1}(h/L)$.", math.acos(h / L_)), ("Uses the tangent of the ratio: $\\tan^{-1}(h/L)$.", math.atan(h / L_)), ("Reports the ratio itself.", h / L_)], tol=0.04, n=3)
    stem = f"A ladder of length ${L_:g}$ feet leans against a vertical wall and reaches ${h:g}$ feet up the wall. Using a calculator in radian mode, what is the angle $\\theta$, in radians, between the ladder and the ground?"
    return MQ("pre_arcsin_context_calc", "3.9", "1", "required", stem, key, ds, rng, "The inverse sine recovers an angle from a ratio of sides", ["Write the sine of the angle as the opposite side over the hypotenuse", "Apply the inverse sine in radian mode"], "inverse sine closed form versus brentq root finding of sin(theta) minus the ratio", f"$\\theta=\\sin^{{-1}}({h:g}/{L_:g})\\approx{th:.3f}$ radians.", [f"L={L_}", f"h={h}"], est=80)


@retry_sep
def pre_tan_model_solve_calc(rng):
    for _ in forever():
        D = pick(rng, [50, 80, 120]); w = pick(rng, [0.4, 0.6, 0.9]); k = pick(rng, [30, 60, 100])
        f = lambda t_: D * math.tan(w * t_) - k  # noqa: E731
        t1 = math.atan(k / D) / w; chk = _O.brentq(f, 1e-6, math.pi / (2 * w) - 1e-6, xtol=1e-12); agree(t1, chk, 1e-8, "t")
        if 0.3 < t1 < 2.2:
            break
    key, ds = num_options(t1, [("Uses degrees for the inverse tangent.", math.degrees(math.atan(k / D)) / w), ("Uses the inverse sine of the ratio.", math.asin(min(k / D, 0.999)) / w if k / D < 1 else None), ("Forgets to divide by $w$.", math.atan(k / D)), ("Uses $k/D$ divided by $w$ directly.", k / D / w)], tol=0.05, n=3)
    stem = f"A rotating beam of light from a lighthouse sweeps along a straight shore. The distance, in meters, along the shore from the point closest to the lighthouse to the spot lit by the beam is modeled by $d(t)={D}\\tan({w}t)$, where $t$ is the time in seconds and $0\\le t<\\dfrac{{\\pi}}{{2({w})}}$. Using a calculator in radian mode, at what time $t$ is the spot ${k}$ meters from the closest point?"
    return MQ("pre_tan_model_solve_calc", "3.8", "2", "required", stem, key, ds, rng, "Solve a tangent model for the input", ["Set the model equal to the distance and isolate the tangent", "Apply the inverse tangent in radian mode and divide by w"], "inverse tangent closed form versus brentq root finding", f"$t=\\tan^{{-1}}({k}/{D})/{w}\\approx{t1:.3f}$ seconds.", [f"D={D}", f"w={w}", f"k={k}"], est=100)


@retry_sep
def pre_polar_x_extreme_calc(rng):
    for _ in forever():
        a = pick(rng, [2, 3, 4]); b = pick(rng, [1, 2, 3]); th = np.linspace(0, 2 * math.pi, 400001)
        x = (a + b * np.sin(th)) * np.cos(th); xm = float(x.max()); xn = float(x.min())
        f = lambda t_: -((a + b * math.sin(t_)) * math.cos(t_))  # noqa: E731
        cands = [_O.minimize_scalar(f, bounds=(lo, hi), method="bounded", options={"xatol": 1e-12}) for lo, hi in ((-1.0, 1.2), (3.0, 4.5), (4.0, 6.0))]
        best = max(-c.fun for c in cands); agree(best, xm, 1e-6, "xm")
        if abs(xm - round(xm, 1)) > 0.02:
            break
    key, ds = num_options(xm, [("Reports the least $x$-coordinate instead.", xn), ("Reports the greatest value of $r$.", float(a + b)), ("Reports $a$, the value of $r$ at $\\theta=0$.", float(a)), ("Reports the greatest $y$-coordinate instead.", float(((a + b * np.sin(th)) * np.sin(th)).max()))], tol=0.05, n=2)
    stem = f"The graph of the polar function $r(\\theta)={a}+{b}\\sin\\theta$ for $0\\le\\theta\\le 2\\pi$ is a limaçon. Using a graphing calculator, what is the greatest $x$-coordinate of a point on the graph?"
    return MQ("pre_polar_x_extreme_calc", "3.14", "2", "required", stem, key, ds, rng, "The greatest horizontal extent of a polar curve uses x = r cos theta", ["Write x as r times cos theta", "Find the maximum of this expression with a graphing calculator"], "bounded numerical optimization on several brackets versus a dense grid maximum", f"The greatest value of $(a+b\\sin\\theta)\\cos\\theta$ is about ${xm:.3f}$.", [f"a={a}", f"b={b}"], est=105)


@retry_sep
def pre_sin_rate_time_calc(rng):
    for _ in forever():
        A = pick(rng, [4, 6, 8]); D = pick(rng, [10, 14, 20]); P = pick(rng, [6, 8, 10, 12]); w = 2 * math.pi / P; k = D + A * pick(rng, [0.3, 0.5, 0.7])
        f = lambda t_: D + A * math.sin(w * t_)  # noqa: E731
        tt = math.asin((k - D) / A) / w; chk = _O.brentq(lambda v: f(v) - k, 0, P / 4, xtol=1e-12); agree(tt, chk, 1e-8, "t")
        if tt > 0.1:
            break
    key, ds = num_options(tt, [("Reports the second time the model equals the value in the first period.", P / 2 - tt), ("Uses degrees for the inverse sine.", math.degrees(math.asin((k - D) / A)) / w), ("Forgets to divide by the angular frequency.", math.asin((k - D) / A)), ("Forgets to subtract the midline before the inverse sine.", math.asin(min(k / A, 0.999)) / w if k / A < 1 else None)], tol=0.05, n=3)
    stem = f"The height, in feet, of a buoy at time $t$ seconds is modeled by $h(t)={D}+{A}\\sin\\left(\\dfrac{{2\\pi}}{{{P}}}t\\right)$. Using a calculator in radian mode, at what time $t\\ge 0$ is the buoy first at a height of ${k:g}$ feet?"
    return MQ("pre_sin_rate_time_calc", "3.10", "1", "required", stem, key, ds, rng, "Solve a sinusoidal model for the first time a height is reached", ["Set the model equal to the height and isolate the sine", "Apply the inverse sine in radian mode and divide by the angular frequency"], "inverse sine closed form versus brentq root finding on the first quarter period", f"The first time is $t\\approx{tt:.3f}$ seconds.", [f"A={A}", f"D={D}", f"P={P}", f"k={k}"], est=100)
