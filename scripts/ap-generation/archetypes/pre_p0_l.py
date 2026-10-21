"""AP Precalculus 원형 L — 단원 3 3차 저작: 계산기 불가 12 + 그래핑 계산기 필수 5. 오답 설명은 선택지 값이 실제로 나오는 계산을 수치와 함께 적는다."""
from pre_common import *
from pre_common import _O

PI = sp.pi
STAGE_U3D = ["pre_sin_transform_describe", "pre_inverse_trig_range", "pre_tan_period", "pre_trig_quadratic_equation", "pre_double_angle_equation", "pre_sec_range", "pre_polar_equivalent_point",
             "pre_polar_to_rect_equation", "pre_polar_symmetry", "pre_trig_avg_roc_exact", "pre_pythagorean_value",
             "pre_cos_min_value_calc", "pre_polar_r_zero_calc", "pre_polar_point_rect_calc", "pre_nth_max_time_calc", "pre_trig_two_curves_calc"]


@retry_sep
def pre_sin_transform_describe(rng):
    A = pick(rng, [2, 3, 4]); Bk = pick(rng, [2, 3, 4]); hh = pick(rng, [Fr(1, 6), Fr(1, 4), Fr(1, 3), Fr(1, 2)]); k0 = pick(rng, [1, 2, -1, -2]); fn = pick(rng, ["sin", "cos"])
    hs = sp.Rational(hh.numerator, hh.denominator) * PI; per = sp.nsimplify(2 * PI / Bk)
    desc = lambda a_, p_, h_, k_: f"The graph has amplitude ${a_}$, period ${L(p_)}$, a horizontal shift of ${L(h_)}$ to the right and a midline $y={k_}$"  # noqa: E731
    key, ds = text_options(desc(A, per, hs, k0), f"For $g(x)=A\\{fn}(B(x-h))+k$ the amplitude is $|A|={A}$, the period is $2\\pi/B=2\\pi/{Bk}={L(per)}$, the shift is $h={L(hs)}$ and the midline is $y=k={k0}$.",
                           [(desc(A, 2 * PI * Bk, hs, k0), f"Multiplies $2\\pi$ by $B={Bk}$ instead of dividing, giving a period of ${L(2 * PI * Bk)}$."), (desc(A, per, hs * Bk, k0), f"Multiplies the shift ${L(hs)}$ by $B={Bk}$ as if the argument were $Bx-h$."), (desc(A, per, hs, -k0), f"Reverses the sign of the vertical shift, using the midline $y={-k0}$."), (desc(A * Bk, per, hs, k0), f"Uses $A B={A * Bk}$ as the amplitude.")])
    stem = f"The function $g$ is defined by $g(x)={A}\\{fn}\\left({Bk}\\left(x-{L(hs)}\\right)\\right){'+' if k0 > 0 else '-'}{abs(k0)}$. Which of the following correctly describes the graph of $g$?"
    return MQ("pre_sin_transform_describe", "3.6", "2", "not_allowed", stem, key, ds, rng, "Transformations of sinusoidal functions", ["Read the amplitude, the multiplier of the angle, the shift and the vertical shift from the formula", "Compute the period from the multiplier and compare with each description"], "numerical maximum, minimum and period of g over one cycle", f"The amplitude is {A}, the period ${L(per)}$, the shift ${L(hs)}$ to the right and the midline $y={k0}$.", [f"A={A}", f"B={Bk}", f"h={hh}", f"k={k0}", f"fn={fn}"], est=90)


@retry_sep
def pre_inverse_trig_range(rng):
    fn = pick(rng, ["arcsin", "arccos", "arctan"]); ask = pick(rng, ["range", "domain"])
    rg = {"arcsin": "\\left[-\\dfrac{\\pi}{2}, \\dfrac{\\pi}{2}\\right]", "arccos": "\\left[0, \\pi\\right]", "arctan": "\\left(-\\dfrac{\\pi}{2}, \\dfrac{\\pi}{2}\\right)"}; dm = {"arcsin": "[-1, 1]", "arccos": "[-1, 1]", "arctan": "(-\\infty, \\infty)"}
    others = [k for k in rg if k != fn]
    if ask == "range":
        key, ds = text_options(f"${rg[fn]}$", f"The range of $y=\\{fn}\\,x$ is ${rg[fn]}$.", [(f"${rg[o]}$", f"This is the range of $\\{o}$, not of $\\{fn}$.") for o in others if rg[o] != rg[fn]] + [("$[0, 2\\pi)$", "Uses one full period of the trigonometric functions as the range.")])
        stem = f"What is the range of the function $y=\\{fn}\\,x$?"
    else:
        key, ds = text_options(f"${dm[fn]}$", f"The domain of $y=\\{fn}\\,x$ is ${dm[fn]}$.", [(f"${dm[o]}$", f"This is the domain of $\\{o}$, not of $\\{fn}$.") for o in others if dm[o] != dm[fn]] + [(f"${rg[fn]}$", "Reports the range of the inverse function as its domain."), ("$[0, 2\\pi)$", "Uses one full period as the domain.")])
        stem = f"What is the domain of the function $y=\\{fn}\\,x$?"
    return MQ("pre_inverse_trig_range", "3.9", "1", "not_allowed", stem, key, ds, rng, "Domains and ranges of inverse trigonometric functions", ["Recall the restricted domain of the trigonometric function that is inverted", "State the matching domain and range of the inverse"], "numerical evaluation of the inverse function on sample inputs at the boundaries", f"The answer is ${rg[fn] if ask == 'range' else dm[fn]}$.", [f"fn={fn}", f"ask={ask}"], est=60)


@retry_sep
def pre_tan_period(rng):
    Bk = pick(rng, [2, 3, 4, sp.Rational(1, 2), sp.Rational(1, 3)]); a = pick(rng, [1, 2, 3, -2]); ask = pick(rng, ["period", "zero"])
    Bs = sp.nsimplify(Bk); per = sp.nsimplify(PI / Bs)
    arg = f"{L(Bs)}x" if Bs != 1 else "x"
    if ask == "period":
        cands = [(f"Uses $2\\pi/B={L(sp.nsimplify(2 * PI / Bs))}$, the period of sine and cosine.", sp.nsimplify(2 * PI / Bs)), (f"Multiplies $\\pi$ by $B={L(Bs)}$ instead of dividing, giving ${L(sp.nsimplify(PI * Bs))}$.", sp.nsimplify(PI * Bs)), (f"Uses $\\pi/(2B)={L(sp.nsimplify(PI / (2 * Bs)))}$, the distance from a zero to an asymptote.", sp.nsimplify(PI / (2 * Bs))), (f"Uses the coefficient ${a}$ in front of the tangent to scale the period.", sp.nsimplify(PI / Bs * abs(a)) if abs(a) != 1 else sp.nsimplify(2 * PI * Bs))]
        seen = {sp.simplify(per)}; wr = []
        for w, v in cands:
            v = sp.simplify(v)
            if v not in seen:
                seen.add(v); wr.append(Opt(tx(v), False, w, None))
        if len(wr) < 3:
            raise ValueError("few")
        key = Opt(tx(per), True, f"The period of $y=\\tan(Bx)$ is $\\pi/B=\\pi/{L(Bs)}={L(per)}$.", None); ds = wr[:3]
        stem = f"What is the period of the function $g(x)={a if a != 1 else ''}\\tan\\left({arg}\\right)$?"
    else:
        key, ds = text_options("$\\left(-\\dfrac{\\pi}{2B}, \\dfrac{\\pi}{2B}\\right)$ contains exactly one zero", "Between two consecutive vertical asymptotes the tangent crosses zero exactly once.", [("$\\left(-\\dfrac{\\pi}{2B}, \\dfrac{\\pi}{2B}\\right)$ contains two zeros", "Counts the zero at each end of the interval although the ends are asymptotes."), ("$\\left(-\\dfrac{\\pi}{2B}, \\dfrac{\\pi}{2B}\\right)$ contains no zeros", "Thinks a tangent branch between asymptotes never crosses the axis."), ("$\\left(-\\dfrac{\\pi}{2B}, \\dfrac{\\pi}{2B}\\right)$ contains a maximum", "Thinks a tangent branch has a maximum between its asymptotes.")])
        stem = f"For the function $g(x)=\\tan(Bx)$ with $B>0$, which statement about the interval $\\left(-\\dfrac{{\\pi}}{{2B}}, \\dfrac{{\\pi}}{{2B}}\\right)$ is true?"
    return MQ("pre_tan_period", "3.8", "1", "not_allowed", stem, key, ds, rng, "The period and branches of the tangent function", ["Recall that tangent has period pi", "Scale the period by the multiplier of the angle"], "numerical check that g(x + period) equals g(x) at sample points", f"{key.text}.", [f"B={Bk}", f"a={a}", f"ask={ask}"], est=70)


@retry_sep
def pre_trig_quadratic_equation(rng):
    fn = pick(rng, ["sin", "cos"]); roots = pick(rng, [(sp.Rational(1, 2), -1), (1, -sp.Rational(1, 2)), (sp.Rational(1, 2), 1), (-sp.Rational(1, 2), -1), (-sp.Rational(1, 2), 1)])
    F = sp.sin if fn == "sin" else sp.cos
    t_ = sp.symbols("t"); poly = sp.expand(2 * (t_ - roots[0]) * (t_ - roots[1]))
    sols = sorted(set(list(sp.solveset(sp.Eq(F(X), roots[0]), X, sp.Interval.Ropen(0, 2 * PI))) + list(sp.solveset(sp.Eq(F(X), roots[1]), X, sp.Interval.Ropen(0, 2 * PI)))), key=float)
    a_ = sorted(sp.solveset(sp.Eq(F(X), roots[0]), X, sp.Interval.Ropen(0, 2 * PI)), key=float); b_ = sorted(sp.solveset(sp.Eq(F(X), roots[1]), X, sp.Interval.Ropen(0, 2 * PI)), key=float)
    tex_s = lambda ss: ", ".join(f"${L(s_)}$" for s_ in ss)  # noqa: E731
    cands = [(tex_s(a_), f"Finds only the solutions of $\\{fn} x={L(roots[0])}$ and misses the solutions of $\\{fn} x={L(roots[1])}$."), (tex_s(b_), f"Finds only the solutions of $\\{fn} x={L(roots[1])}$ and misses the solutions of $\\{fn} x={L(roots[0])}$."), (tex_s(sorted(set(list(sp.solveset(sp.Eq(F(X), -roots[0]), X, sp.Interval.Ropen(0, 2 * PI))) + b_), key=float)), f"Solves $\\{fn} x={L(-roots[0])}$ instead of $\\{fn} x={L(roots[0])}$ for the first factor."), (tex_s(sorted(set(list(a_) + list(sp.solveset(sp.Eq(F(X), -roots[1]), X, sp.Interval.Ropen(0, 2 * PI)))), key=float)), f"Solves $\\{fn} x={L(-roots[1])}$ instead of $\\{fn} x={L(roots[1])}$ for the second factor.")]
    seen = {tex_s(sols)}; wr = []
    for t, w in cands:
        if t not in seen and t:
            seen.add(t); wr.append((t, w))
    if len(wr) < 3:
        raise ValueError("few")
    key, ds = text_options(tex_s(sols), f"Factoring gives $\\left(\\{fn} x{'-' if roots[0] > 0 else '+'}{L(abs(roots[0]))}\\right)\\left(\\{fn} x{'-' if roots[1] > 0 else '+'}{L(abs(roots[1]))}\\right)=0$, so $\\{fn} x={L(roots[0])}$ or $\\{fn} x={L(roots[1])}$, with solutions {tex_s(sols)}.", wr)
    pt = L(poly).replace("t", f"\\{fn} x").replace(f"\\{fn} x^{{2}}", f"\\{fn}^2 x")
    stem = f"What are all solutions of the equation ${pt}=0$ on the interval $0\\le x<2\\pi$?"
    return MQ("pre_trig_quadratic_equation", "3.10", "1", "not_allowed", stem, key, ds, rng, "A quadratic trigonometric equation factors into basic equations", ["Factor the quadratic in the trigonometric function", "Solve each basic equation on the interval"], "numerical substitution of every solution into the original equation", f"The solutions are {tex_s(sols)}.", [f"fn={fn}", f"roots={roots}"], est=120)


@retry_sep
def pre_double_angle_equation(rng):
    fn = pick(rng, ["sin", "cos"])
    if fn == "sin":
        eq = "\\sin 2x=\\sin x"; sols = [0, PI / 3, PI, 5 * PI / 3]; lost = [PI / 3, 5 * PI / 3]
    else:
        eq = "\\sin 2x=\\cos x"; sols = [PI / 2, PI / 6, 5 * PI / 6, 3 * PI / 2]; lost = [PI / 6, 5 * PI / 6]
    sols = sorted(sols, key=float)
    chk = [abs(math.sin(2 * float(s)) - (math.sin(float(s)) if fn == "sin" else math.cos(float(s)))) for s in sols]; assert max(chk) < 1e-9
    tex_s = lambda ss: ", ".join(f"${L(s_)}$" for s_ in ss)  # noqa: E731
    k1 = "$\\sin x\\ne 0$" if fn == "sin" else "$\\cos x\\ne 0$"
    wr = [(tex_s(sorted(lost, key=float)), f"Divides both sides by {'sin x' if fn == 'sin' else 'cos x'}, which loses the solutions where it equals 0."), (tex_s(sorted([s for s in sols if s not in lost], key=float)), f"Keeps only the solutions where {'sin x' if fn == 'sin' else 'cos x'} equals 0 and misses the solutions of $2\\{'cos' if fn == 'sin' else 'sin'}x=1$."), (tex_s(sorted(lost + [PI / 2] if fn == "sin" else lost + [PI / 3], key=float)), "Adds a value that is not a solution because of an error in the double-angle identity.")]
    key, ds = text_options(tex_s(sols), f"Using $\\sin 2x=2\\sin x\\cos x$ and factoring gives {'$\\sin x(2\\cos x-1)=0$' if fn == 'sin' else '$\\cos x(2\\sin x-1)=0$'}, so the solutions are {tex_s(sols)}.", wr)
    stem = f"What are all solutions of the equation ${eq}$ on the interval $0\\le x<2\\pi$?"
    del k1
    return MQ("pre_double_angle_equation", "3.12", "1", "not_allowed", stem, key, ds, rng, "Double-angle identities solve trigonometric equations", ["Rewrite sin 2x with the double-angle identity", "Factor and solve each factor on the interval"], "numerical substitution of every claimed solution and a scan for any other solution", f"The solutions are {tex_s(sols)}.", [f"fn={fn}"], est=115)


@retry_sep
def pre_sec_range(rng):
    fn = pick(rng, ["sec", "csc"]); a = pick(rng, [1, 2, 3]); k0 = pick(rng, [0, 1, -1])
    lo, hi = -a + k0, a + k0
    key_t = f"$(-\\infty, {lo}]\\cup[{hi}, \\infty)$"
    wr = [(f"$[{lo}, {hi}]$", f"Uses the range of the matching sine or cosine function scaled by {a} and shifted by {k0}."), (f"$(-\\infty, {-a}]\\cup[{a}, \\infty)$" if k0 else f"$(-\\infty, {-a + 1}]\\cup[{a + 1}, \\infty)$", "Ignores the vertical shift." if k0 else "Shifts the boundary values by one."), (f"$(-\\infty, {lo}) \\cup ({hi}, \\infty)$", "Excludes the boundary values $y=" + str(lo) + "$ and $y=" + str(hi) + "$, which the graph reaches."), ("$(-\\infty, \\infty)$", "Thinks the function takes all real values because it has vertical asymptotes.")]
    wr = [(t, w) for t, w in wr if t != key_t]
    key, ds = text_options(key_t, f"The values of $\\{fn}\\,x$ satisfy $|\\{fn}\\,x|\\ge 1$, so ${a}\\{fn}\\,x{'+' if k0 > 0 else '-' if k0 < 0 else ''}{abs(k0) if k0 else ''}$ takes values $\\le {lo}$ or $\\ge {hi}$.", wr)
    stem = f"What is the range of the function $g(x)={a if a != 1 else ''}\\{fn}\\,x{'+' if k0 > 0 else '-' if k0 < 0 else ''}{abs(k0) if k0 else ''}$?"
    return MQ("pre_sec_range", "3.11", "2", "not_allowed", stem, key, ds, rng, "The range of a reciprocal trigonometric function", ["Recall that the secant and cosecant have absolute value at least 1", "Apply the vertical stretch and shift to the boundary values"], "numerical evaluation of g on a dense grid away from the asymptotes", f"The range is {key_t}.", [f"fn={fn}", f"a={a}", f"k={k0}"], est=85)


@retry_sep
def pre_polar_equivalent_point(rng):
    r = pick(rng, [2, 3, 4]); th = pick(rng, [Fr(1, 6), Fr(1, 3), Fr(1, 4), Fr(2, 3), Fr(5, 6)]); ang = sp.Rational(th.numerator, th.denominator) * PI
    pt = lambda a_, b_: f"$\\left({a_}, {L(b_)}\\right)$"  # noqa: E731
    key_t = pt(r, ang + PI)
    wr = [(pt(r, ang), f"Ignores the negative sign of $r=-{r}$ and keeps the angle ${L(ang)}$."), (pt(r, ang + PI / 2), "Adds a quarter turn, $\\pi/2$, instead of a half turn, $\\pi$, to the angle."), (pt(-r, ang + PI), "Changes both the sign of $r$ and the angle, which returns to the original direction with the wrong sign of $r$."), (pt(r, PI - ang), "Reflects the angle across the vertical axis, $\\pi-\\theta$.")]
    wr = [(t, w) for t, w in wr if t != key_t][:3]
    key, ds = text_options(key_t, f"A point $(-{r}, \\theta)$ is the same as $({r}, \\theta+\\pi)$: change the sign of $r$ and add $\\pi$ to the angle, giving $({r}, {L(ang + PI)})$.", wr)
    stem = f"Which of the following polar coordinates represents the same point as $\\left(-{r}, {L(ang)}\\right)$ with $r>0$ and $0\\le\\theta<2\\pi$?"
    return MQ("pre_polar_equivalent_point", "3.13", "1", "not_allowed", stem, key, ds, rng, "A point has several polar representations", ["Change the sign of r and add pi to the angle", "Check the angle is in the stated interval"], "conversion of every option to rectangular coordinates compared with the original", f"The point is $({r}, {L(ang + PI)})$.", [f"r={r}", f"th={th}"], est=80)


@retry_sep
def pre_polar_to_rect_equation(rng):
    k = pick(rng, [2, 4, 6]); fn = pick(rng, ["sin", "cos"])
    if fn == "sin":
        key_t = f"$x^2+y^2={k}y$"; wr = [(f"$x^2+y^2={k}x$", "Replaces $r\\sin\\theta$ by $x$ instead of $y$ when multiplying by $r$."), (f"$y={k}$", f"Replaces $r$ by $y$ and treats $\\sin\\theta$ as 1: $r={k}\\sin\\theta$ is not the line $y={k}$."), (f"$x^2+y^2={k * k}$", "Squares the radius instead of multiplying both sides by $r$.")]
    else:
        key_t = f"$x^2+y^2={k}x$"; wr = [(f"$x^2+y^2={k}y$", "Replaces $r\\cos\\theta$ by $y$ instead of $x$ when multiplying by $r$."), (f"$x={k}$", f"Treats $r={k}\\cos\\theta$ as $r\\cos\\theta={k}$, which is a different curve."), (f"$x^2+y^2={k * k}$", "Squares the radius instead of multiplying both sides by $r$.")]
    key, ds = text_options(key_t, f"Multiplying both sides of $r={k}\\{fn}\\theta$ by $r$ gives $r^2={k}r\\{fn}\\theta$, so $x^2+y^2={k}{'y' if fn == 'sin' else 'x'}$.", wr)
    stem = f"Which of the following is a rectangular equation for the graph of the polar equation $r={k}\\{fn}\\theta$?"
    return MQ("pre_polar_to_rect_equation", "3.13", "1", "not_allowed", stem, key, ds, rng, "Convert a polar equation to rectangular form", ["Multiply both sides by r to introduce r squared and r sin theta or r cos theta", "Replace with x^2+y^2, y or x"], "points sampled from the polar equation satisfy the claimed rectangular equation", f"The equation is {key_t}.", [f"k={k}", f"fn={fn}"], est=85)


@retry_sep
def pre_polar_symmetry(rng):
    a = pick(rng, [1, 2, 3]); b = pick(rng, [1, 2, 3]); fn = pick(rng, ["cos", "sin"])
    if fn == "cos":
        key_t = "The graph is symmetric about the polar axis (the horizontal axis), because $r(-\\theta)=r(\\theta)$"; wr = [("The graph is symmetric about the line $\\theta=\\pi/2$ (the vertical axis), because $r(\\pi-\\theta)=r(\\theta)$", "Tests the wrong symmetry: $r(\\pi-\\theta)=a-b\\cos\\theta$, which is not equal to $r(\\theta)$."), ("The graph is symmetric about the pole, because $r(\\theta+\\pi)=r(\\theta)$", "Tests $r(\\theta+\\pi)=a-b\\cos\\theta$, which is not equal to $r(\\theta)$ unless $b=0$."), ("The graph has no symmetry", "Thinks no symmetry test succeeds although $r(-\\theta)=r(\\theta)$.")]
    else:
        key_t = "The graph is symmetric about the line $\\theta=\\pi/2$ (the vertical axis), because $r(\\pi-\\theta)=r(\\theta)$"; wr = [("The graph is symmetric about the polar axis (the horizontal axis), because $r(-\\theta)=r(\\theta)$", "Tests $r(-\\theta)=a-b\\sin\\theta$, which is not equal to $r(\\theta)$."), ("The graph is symmetric about the pole, because $r(\\theta+\\pi)=r(\\theta)$", "Tests $r(\\theta+\\pi)=a-b\\sin\\theta$, which is not equal to $r(\\theta)$ unless $b=0$."), ("The graph has no symmetry", "Thinks no symmetry test succeeds although $r(\\pi-\\theta)=r(\\theta)$.")]
    key, ds = text_options(key_t, f"For $r={a}+{b}\\{fn}\\theta$, {'$r(-\\theta)=r(\\theta)$ because cosine is even' if fn == 'cos' else '$r(\\pi-\\theta)=r(\\theta)$ because $\\sin(\\pi-\\theta)=\\sin\\theta$'}.", wr)
    stem = f"Which of the following statements about the graph of the polar function $r(\\theta)={a}+{b}\\{fn}\\theta$ is true?"
    return MQ("pre_polar_symmetry", "3.14", "2", "not_allowed", stem, key, ds, rng, "Symmetry of polar graphs", ["Test r at the related angles -theta, pi - theta and theta + pi", "Match the equal pair to the corresponding symmetry"], "numerical comparison of r at the related angles", f"{key_t}.", [f"a={a}", f"b={b}", f"fn={fn}"], est=95)


@retry_sep
def pre_trig_avg_roc_exact(rng):
    fn = pick(rng, ["sin", "cos"]); lo, hi = pick(rng, [(0, Fr(1, 2)), (0, Fr(1, 6)), (Fr(1, 6), Fr(1, 2)), (Fr(1, 3), Fr(1, 2)), (0, Fr(1, 3))])
    A_ = sp.Rational(lo.numerator, lo.denominator) * PI; B_ = sp.Rational(hi.numerator, hi.denominator) * PI
    F = sp.sin if fn == "sin" else sp.cos
    val = sp.nsimplify(sp.simplify((F(B_) - F(A_)) / (B_ - A_)))
    agree(float(val), (math.sin(float(B_)) - math.sin(float(A_))) / float(B_ - A_) if fn == "sin" else (math.cos(float(B_)) - math.cos(float(A_))) / float(B_ - A_), 1e-9, "roc")
    cands = [(f"Reports the change in the function values, ${L(sp.nsimplify(F(B_) - F(A_)))}$, without dividing by ${L(B_ - A_)}$.", sp.nsimplify(F(B_) - F(A_))), (f"Divides by the sum ${L(A_ + B_)}$ of the endpoints instead of the difference.", sp.nsimplify((F(B_) - F(A_)) / (A_ + B_)) if A_ + B_ != 0 else None), (f"Divides the change in the angle by the change in the function values, the reciprocal.", sp.nsimplify((B_ - A_) / (F(B_) - F(A_))) if F(B_) != F(A_) else None), (f"Reports the value of the function at the right endpoint, ${L(F(B_))}$.", sp.nsimplify(F(B_)))]
    seen = {sp.simplify(val)}; wr = []
    for w, v in cands:
        if v is None:
            continue
        v = sp.simplify(v)
        if v not in seen:
            seen.add(v); wr.append(Opt(tx(v), False, w, None))
    if len(wr) < 3:
        raise ValueError("few")
    key = Opt(tx(val), True, f"$\\dfrac{{\\{fn}({L(B_)})-\\{fn}({L(A_)})}}{{{L(B_)}-{L(A_)}}}={L(val)}$.", None)
    stem = f"What is the average rate of change of $f(x)=\\{fn}\\,x$ over the interval ${L(A_)}\\le x\\le {L(B_)}$?"
    return MQ("pre_trig_avg_roc_exact", "3.4", "1", "not_allowed", stem, key, wr[:3], rng, "Average rate of change of a trigonometric function", ["Evaluate the function exactly at both endpoints", "Divide the change in output by the change in input"], "sympy exact evaluation versus numpy floating-point evaluation", f"The average rate of change is ${L(val)}$.", [f"fn={fn}", f"lo={lo}", f"hi={hi}"], est=90)


@retry_sep
def pre_pythagorean_value(rng):
    s, c_ = pick(rng, [(3, 4), (5, 12), (8, 15), (7, 24)]); h = int(math.hypot(s, c_)); ask = pick(rng, ["sin2", "cos2", "tan2"]); quad = pick(rng, ["I", "II"])
    cos_v = sp.Rational(c_, h) * (1 if quad == "I" else -1); sin_v = sp.Rational(s, h)
    val = {"sin2": sin_v ** 2, "cos2": cos_v ** 2, "tan2": (sin_v / cos_v) ** 2}[ask]
    given = f"$\\cos\\theta={L(cos_v)}$"
    nm = {"sin2": "\\sin^2\\theta", "cos2": "\\cos^2\\theta", "tan2": "\\tan^2\\theta"}[ask]
    cands = [(f"Uses $\\sin^2\\theta=1-\\cos\\theta={L(1 - cos_v)}$ without squaring the cosine.", 1 - cos_v), (f"Uses $\\sin\\theta={L(sin_v)}$ instead of $\\sin^2\\theta$.", sin_v), (f"Reports $\\cos^2\\theta={L(cos_v ** 2)}$.", cos_v ** 2), (f"Reports the sign-reversed value $-{L(val)}$.", -val), (f"Reports $1/\\cos^2\\theta={L(1 / cos_v ** 2)}$.", 1 / cos_v ** 2)]
    seen = {sp.simplify(val)}; wr = []
    for w, v in cands:
        v = sp.simplify(v)
        if v not in seen:
            seen.add(v); wr.append(Opt(tx(v), False, w, None))
    if len(wr) < 3:
        raise ValueError("few")
    key = Opt(tx(val), True, f"$\\sin^2\\theta=1-\\cos^2\\theta=1-{L(cos_v ** 2)}={L(sin_v ** 2)}$" + ("" if ask == "sin2" else f" and the requested value is ${L(val)}$") + ".", None)
    stem = f"The angle $\\theta$ is in quadrant {quad} and {given}. What is the value of ${nm}$?"
    return MQ("pre_pythagorean_value", "3.12", "1", "not_allowed", stem, key, wr[:3], rng, "The Pythagorean identity relates sine and cosine", ["Use sin^2 + cos^2 = 1 to find the missing value", "Compute the requested expression"], "numerical evaluation at an angle in the given quadrant with the given cosine", f"The value is ${L(val)}$.", [f"s={s}", f"c={c_}", f"ask={ask}", f"quad={quad}"], est=90)


@retry_sep
def pre_cos_min_value_calc(rng):
    for _ in forever():
        a = pick(rng, [2, 3, 4, 5]); b = pick(rng, [2, 3, 4, 5]); fn1, fn2 = pick(rng, [("sin", "cos")]);
        th = np.linspace(0, 2 * math.pi, 400001); y = a * np.sin(th) + b * np.cos(th); mn = float(y.min()); amp = math.hypot(a, b); agree(mn, -amp, 1e-6, "min")
        if a != b and abs(amp - round(amp)) > 0.1:
            break
    key, ds = num_options(-amp, [(f"Adds the coefficients, ${a}+{b}$, and uses the negative of that sum, ${-(a + b)}$.", float(-(a + b))), (f"Uses the negative of the larger coefficient, ${-max(a, b)}$.", float(-max(a, b))), (f"Uses the negative of the difference of the coefficients, ${-(abs(a - b))}$.", float(-abs(a - b))), (f"Reports the greatest value $+{amp:.3f}$ instead of the least.", amp)], tol=0.04, n=3)
    stem = f"The function $f$ is defined by $f(x)={a}\\sin x+{b}\\cos x$. Using a graphing calculator in radian mode, what is the least value of $f(x)$ for $0\\le x\\le 2\\pi$?"
    return MQ("pre_cos_min_value_calc", "3.12", "2", "required", stem, key, ds, rng, "A sum of a sine and a cosine is a sinusoid whose amplitude can be read from the graph", ["Graph the function on the interval", "Read the least value from the graph"], "dense numerical minimum versus the closed form negative square root of a squared plus b squared", f"The graph is a sinusoid with amplitude $\\sqrt{{{a}^2+{b}^2}}\\approx{amp:.3f}$, so the least value is $-{amp:.3f}$.", [f"a={a}", f"b={b}"], est=95)


@retry_sep
def pre_polar_r_zero_calc(rng):
    for _ in forever():
        a = pick(rng, [1, 2]); b = pick(rng, [3, 4, 5]); c0 = -a / b
        th1 = math.acos(c0); chk = _O.brentq(lambda t_: a + b * math.cos(t_), 0.01, math.pi - 0.01, xtol=1e-12); agree(th1, chk, 1e-9, "t")
        if abs(c0) < 0.9:
            break
    key, ds = num_options(th1, [(f"Reports the greater zero $\\theta\\approx{2 * math.pi - th1:.3f}$ instead of the least.", 2 * math.pi - th1), (f"Uses degrees: $\\cos^{{-1}}({c0:.3f})$ in degree mode gives ${math.degrees(th1):.1f}$.", math.degrees(th1)), (f"Solves $\\cos\\theta={a / b:.3f}$ with the wrong sign.", math.acos(a / b)), (f"Reports the value $r(0)={a + b}$.", float(a + b))], tol=0.04, n=3)
    stem = f"The polar function $r$ is defined by $r(\\theta)={a}+{b}\\cos\\theta$. Using a calculator in radian mode, what is the least positive value of $\\theta$ for which the graph of $r$ passes through the pole (the origin)?"
    return MQ("pre_polar_r_zero_calc", "3.14", "1", "required", stem, key, ds, rng, "The graph of a polar function passes through the pole where r equals zero", ["Set r equal to zero and solve for cos theta", "Use the inverse cosine in radian mode"], "inverse cosine closed form versus brentq root finding", f"$\\cos\\theta={c0:.3f}$ gives $\\theta\\approx{th1:.3f}$ radians.", [f"a={a}", f"b={b}"], est=90)


@retry_sep
def pre_polar_point_rect_calc(rng):
    r = pick(rng, [3.0, 4.0, 5.0, 7.0]); th = pick(rng, [0.7, 1.2, 2.3, 2.8, 4.1]); coord = pick(rng, ["x", "y"])
    x, y = r * math.cos(th), r * math.sin(th); v = x if coord == "x" else y
    ex = float(sp.N(sp.Float(r, 20) * (sp.cos if coord == "x" else sp.sin)(sp.Float(th, 20)), 15)); agree(v, ex, 1e-9, "v")
    oth = y if coord == "x" else x
    key, ds = num_options(v, [(f"Swaps cosine and sine, giving ${oth:.3f}$.", oth), (f"Evaluates the trigonometric function in degree mode, giving ${r * (math.cos if coord == 'x' else math.sin)(math.radians(th)):.3f}$.", r * (math.cos if coord == "x" else math.sin)(math.radians(th))), (f"Reports the value of the trigonometric function ${(math.cos if coord == 'x' else math.sin)(th):.3f}$ without multiplying by $r={r:g}$.", (math.cos if coord == "x" else math.sin)(th)), (f"Reports the other rectangular coordinate with the opposite sign, ${-oth:.3f}$.", -oth)], tol=0.04, n=3)
    stem = f"A point has polar coordinates $({r:g}, {th})$, where the angle is in radians. Using a calculator, what is the {'$x$' if coord == 'x' else '$y$'}-coordinate of the point in the rectangular coordinate system?"
    return MQ("pre_polar_point_rect_calc", "3.13", "1", "required", stem, key, ds, rng, "Polar coordinates convert to rectangular coordinates with cosine and sine", ["Use x = r cos theta or y = r sin theta", "Evaluate with a calculator in radian mode"], "floating-point evaluation versus sympy evaluation to fifteen digits", f"The coordinate is ${v:.3f}$.", [f"r={r}", f"th={th}", f"coord={coord}"], est=80)


@retry_sep
def pre_nth_max_time_calc(rng):
    for _ in forever():
        A = pick(rng, [3, 5, 8]); b = pick(rng, [0.7, 0.9, 1.3, 1.7]); n = pick(rng, [3, 4, 5]); D = pick(rng, [10, 14]); f = lambda t_: D + A * math.cos(b * t_)  # noqa: E731
        tn = 2 * math.pi * (n - 1) / b
        if tn < 60:
            break
    key, ds = num_options(tn, [(f"Reports the time of the {n}th maximum counting the one at $t=0$ as none: $2\\pi n/b={2 * math.pi * n / b:.3f}$.", 2 * math.pi * n / b), (f"Reports the time of the {n}th minimum, $(2n-1)\\pi/b={(2 * n - 1) * math.pi / b:.3f}$.", (2 * n - 1) * math.pi / b), (f"Uses $\\pi/b$ as the period, giving ${math.pi / b * (n - 1):.3f}$.", math.pi / b * (n - 1)), (f"Reports the period $2\\pi/b={2 * math.pi / b:.3f}$.", 2 * math.pi / b)], tol=0.04, n=3)
    stem = f"The height, in meters, of a spring's weight at time $t\\ge 0$ seconds is modeled by $h(t)={D}+{A}\\cos({b}t)$. Using a calculator in radian mode, at what time $t$ does the weight reach its greatest height for the ${n}$th time, counting the instant $t=0$ as the first time?"
    return MQ("pre_nth_max_time_calc", "3.7", "2", "required", stem, key, ds, rng, "The times of the maxima of a cosine model are spaced one period apart", ["Find the period from the multiplier of t", "Count the maxima starting at t = 0"], "the closed form 2 pi (n-1)/b versus a scan of the model for local maxima", f"The maxima occur at $t=0, 2\\pi/b,\\dots$; the {n}th is at $t\\approx{tn:.3f}$ seconds.", [f"A={A}", f"b={b}", f"n={n}", f"D={D}"], est=100)


@retry_sep
def pre_trig_two_curves_calc(rng):
    for _ in forever():
        a = pick(rng, [2, 3]); b = pick(rng, [1, 2]); c = pick(rng, [1, 2, 3]); d = pick(rng, [1, 2])
        f = lambda v: a * math.sin(b * v) - c * math.cos(d * v)  # noqa: E731
        rts = solve_all(f, 0.0001, 2 * math.pi, 40000)
        if len(rts) >= 2 and rts[0] > 0.05:
            break
    key, ds = num_options(rts[0], [(f"Reports the second intersection $x\\approx{rts[1]:.3f}$ instead of the first.", rts[1]), (f"Reports the number of intersections, {len(rts)}, instead of an $x$-value.", float(len(rts))), (f"Solves with the two functions exchanged in the argument: ${a}\\sin({d}x)={c}\\cos({b}x)$.", (solve_all(lambda v: a * math.sin(d * v) - c * math.cos(b * v), 0.0001, 2 * math.pi, 40000) or [rts[0] * 1.3])[0]), (f"Reports the $y$-coordinate ${a * math.sin(b * rts[0]):.3f}$ of the first intersection.", a * math.sin(b * rts[0]))], tol=0.04, n=3)
    stem = f"Let $f(x)={a}\\sin({b}x)$ and $g(x)={c}\\cos({d}x)$. Using a graphing calculator in radian mode, what is the least positive value of $x$ at which the graphs of $f$ and $g$ intersect?"
    return MQ("pre_trig_two_curves_calc", "3.10", "1", "required", stem, key, ds, rng, "Intersections of two sinusoidal graphs", ["Graph both functions in radian mode on a window starting near zero", "Find the least positive intersection"], "a sign-change scan with brentq refinement versus a dense grid minimum of the absolute difference", f"The graphs first intersect at $x\\approx{rts[0]:.3f}$.", [f"a={a}", f"b={b}", f"c={c}", f"d={d}"], est=100)
