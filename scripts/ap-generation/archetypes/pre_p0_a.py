"""AP Precalculus 원형 A — 단원 1(다항·유리 함수) 계산기 불가 MC. 값은 모두 정확한 정수·유리수·식이며 sympy 기호 풀이를 numpy 수치 경로로 다시 계산한다."""
from pre_common import *

STAGE_U1 = ["pre_avg_roc_table", "pre_roc_behavior_table", "pre_quad_second_diff_missing", "pre_poly_degree_table", "pre_poly_end_behavior", "pre_poly_multiplicity_graph",
            "pre_complex_zero_conjugate", "pre_rational_end_behavior", "pre_rational_features", "pre_rational_hole_y", "pre_rational_long_division", "pre_rational_inequality",
            "pre_transform_point", "pre_transform_domain_range", "pre_poly_ineq_intervals", "pre_even_odd_table"]


def _iv_pieces(f, crit, ge, zero_set=()):
    """f 의 부호가 (ge: >=0 / 아니면 <0 처럼 부등호 방향) 맞는 구간 tex 목록. crit: 오름차순 임계값. zero_set: 등호를 허용할 때 포함되는 영점."""
    pts = [-math.inf, *crit, math.inf]
    out = []
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        mid = (a + b) / 2 if math.isfinite(a) and math.isfinite(b) else (b - 1 if not math.isfinite(a) else a + 1)
        if (f(mid) > 0) == ge:
            lo_t = "-\\infty" if not math.isfinite(a) else str(int(a)); hi_t = "\\infty" if not math.isfinite(b) else str(int(b))
            lc = math.isfinite(a) and int(a) in zero_set; hc = math.isfinite(b) and int(b) in zero_set
            out.append(f"{'[' if lc else '('}{lo_t}, {hi_t}{']' if hc else ')'}")
    return "$" + "\\cup".join(out) + "$"


@retry_sep
def pre_avg_roc_table(rng):
    for _ in forever():
        xs = sorted(rng.sample([0, 1, 2, 3, 4, 5, 6, 8], 5))
        c = [pick(rng, [-3, -2, -1, 1, 2, 3])] + [pick(rng, [-4, -3, -2, -1, 0, 1, 2, 3, 4]) for _ in range(3)]
        ys = [int(np.polyval(c, v)) for v in xs]
        i, j = sorted(rng.sample(range(5), 2))
        if xs[j] - xs[i] < 2 or len({*ys}) < 5 or max(map(abs, ys)) > 99:
            continue
        r = Fr(ys[j] - ys[i], xs[j] - xs[i])
        if r.denominator <= 4 and Fr(1, 2) <= abs(r) < 40:
            break
    agree(float(r), (float(np.polyval(c, xs[j])) - float(np.polyval(c, xs[i]))) / (xs[j] - xs[i]), 1e-9, "roc")
    key, ds = num_options(float(r), [("Reports the change in the output values without dividing by the change in the inputs.", float(ys[j] - ys[i])), ("Subtracts in the opposite order in the numerator only, which reverses the sign.", float(ys[i] - ys[j]) / (xs[j] - xs[i])),
                                    ("Divides the change in the inputs by the change in the outputs (reciprocal).", (xs[j] - xs[i]) / (ys[j] - ys[i]) if ys[j] != ys[i] else None), ("Divides the final output by the final input instead of using differences.", ys[j] / xs[j] if xs[j] else None),
                                    ("Averages the two output values.", (ys[i] + ys[j]) / 2)], f=rat_tex)
    stim = table_stim("Values of a function $f$", "x", "f(x)", list(zip(xs, ys)))
    stem = f"The table gives values of a function $f$. What is the average rate of change of $f$ over the interval ${xs[i]}\\le x\\le {xs[j]}$?"
    return MQ("pre_avg_roc_table", "1.2", "1", "not_allowed", stem, key, ds, rng, "Average rate of change is the change in output divided by the change in input", ["Read the two output values at the endpoints of the interval from the table", "Divide the change in the output by the change in the input"],
              "exact rational arithmetic versus numpy evaluation of the generating polynomial at the endpoints", f"$\\dfrac{{f({xs[j]})-f({xs[i]})}}{{{xs[j]}-{xs[i]}}}=\\dfrac{{{ys[j]}-({ys[i]})}}{{{xs[j] - xs[i]}}}={L(rat(r))}$.", [f"xs={xs}", f"ys={ys}"], stim=stim, est=70, mat=MAT_TABLE("the table values of f"))


@retry_sep
def pre_roc_behavior_table(rng):
    for _ in forever():
        start = rng.randint(0, 10); step = pick(rng, [1, 2]); up = pick(rng, [True, False]); grow = pick(rng, [True, False])
        d0 = pick(rng, [3, 4, 5, 6, 8]); dd = pick(rng, [1, 2])
        mags = [d0 + dd * k if grow else d0 - dd * k for k in range(4)]
        if min(mags) < 1:
            continue
        d = [m if up else -m for m in mags]
        ys = [start]
        for v in d:
            ys.append(ys[-1] + v)
        break
    xs = [step * k for k in range(5)]
    rates = [Fr(ys[k + 1] - ys[k], step) for k in range(4)]
    rate_up = all(rates[k + 1] > rates[k] for k in range(3)); rate_dn = all(rates[k + 1] < rates[k] for k in range(3))
    f_inc = all(r > 0 for r in rates); f_dec = all(r < 0 for r in rates)
    assert (rate_up or rate_dn) and (f_inc or f_dec)
    word = lambda a, b: f"$f$ is {'increasing' if a else 'decreasing'} at {'an increasing' if b else 'a decreasing'} rate"  # noqa: E731
    key_t = word(f_inc, rate_up)
    key, ds = text_options(key_t, "Compare successive changes over equal input steps: their sign gives increasing or decreasing, and whether they get larger or smaller gives the trend in the rate.",
                           [(word(not f_inc, rate_up), "Reverses whether the outputs rise or fall."), (word(f_inc, not rate_up), "Reverses the trend in the rate of change."), (word(not f_inc, not rate_up), "Reverses both the direction of the outputs and the trend in the rate of change."), ("$f$ is increasing at a constant rate", "Treats unequal successive changes as constant.")])
    stim = table_stim("Values of a function $f$", "x", "f(x)", list(zip(xs, ys)))
    stem = f"The table gives values of a function $f$ at equally spaced inputs. Which of the following best describes $f$ over the interval ${xs[0]}\\le x\\le {xs[-1]}$?"
    return MQ("pre_roc_behavior_table", "1.2", "2", "not_allowed", stem, key, ds, rng, "Combine the sign of the change with the trend in the rate of change", ["Compute successive output changes over equal input steps", "Decide whether the outputs rise or fall and whether the changes grow or shrink in size"],
              "successive differences computed twice: exact integer subtraction versus numpy diff and second diff", f"The successive output changes are {', '.join(str(ys[k + 1] - ys[k]) for k in range(4))}, so {key_t}.", [f"xs={xs}", f"ys={ys}"], stim=stim, est=65, mat=MAT_TABLE("the table values of f"))


@retry_sep
def pre_quad_second_diff_missing(rng):
    for _ in forever():
        a = pick(rng, [-3, -2, -1, 1, 2, 3]); b = pick(rng, [-6, -4, -2, 0, 2, 4, 6]); c = pick(rng, [-5, -2, 0, 3, 7]); step = pick(rng, [1, 2, 3])
        xs = [step * k for k in range(5)]; ys = [a * v * v + b * v + c for v in xs]
        m = rng.randint(1, 3)
        if abs(ys[m]) < 99:
            break
    d1 = np.diff([float(v) for v in ys]); d2 = np.diff(d1); agree(float(d2.std()), 0.0, 1e-9, "second difference constant")
    lin = float(ys[m - 1] + (ys[m + 1] - ys[m - 1]) / 2)
    key, ds = num_options(float(ys[m]), [("Averages the outputs on either side of the blank, which ignores the curvature.", lin), ("Repeats the previous output value.", float(ys[m - 1])),
                                        ("Adds the second difference once instead of twice when extending the first differences.", lin + a * step * step), ("Subtracts the output change instead of adding it.", float(2 * ys[m - 1] - ys[m])),
                                        ("Continues the first difference of the previous interval unchanged.", float(2 * ys[m - 1] - ys[m - 2]) if m >= 2 else float(ys[m - 1] + ys[m + 1] - ys[m + 2]))], f=lambda v: f"${int(round(v))}$" if abs(v - round(v)) < 1e-9 else rat_tex(v))
    rows = [(xs[k], ("?" if k == m else ys[k])) for k in range(5)]
    stim = table_stim("Values of a quadratic function $q$", "x", "q(x)", rows)
    stem = "The table gives values of a quadratic function $q$ at equally spaced inputs. One output value is missing. What is the missing value?"
    return MQ("pre_quad_second_diff_missing", "1.3", "1", "not_allowed", stem, key, ds, rng, "A quadratic has constant second differences over equally spaced inputs", ["Compute first differences from the known outputs", "Use the constant second difference to find the missing output"],
              "sympy evaluates the generating quadratic; numpy diff confirms constant second differences", f"The second differences are constant, so the missing value is $q({xs[m]})={ys[m]}$.", [f"xs={xs}", f"ys={ys}", f"m={m}"], stim=stim, est=90, mat=MAT_TABLE("the table values of q"))


@retry_sep
def pre_poly_degree_table(rng):
    for _ in forever():
        deg = pick(rng, [2, 3, 4]); lead = pick(rng, [-2, -1, 1, 2]); xs = list(range(0, 6)); c = [lead] + [pick(rng, [-3, -2, -1, 0, 1, 2, 3]) for _ in range(deg)]
        ys = [int(np.polyval(c, v)) for v in xs]
        if max(map(abs, ys)) < 400:
            break
    d = np.array(ys, dtype=float); k = 0
    while len(d) > 1 and np.ptp(d) > 1e-9:
        d = np.diff(d); k += 1
    agree(float(k), float(deg), 1e-9, "degree via differences")
    sign_ok = (d[0] > 0) == (lead > 0); assert sign_ok
    txt = lambda dg, ld: f"$p$ has degree {dg} and a {'positive' if ld > 0 else 'negative'} leading coefficient"  # noqa: E731
    other = [g for g in (2, 3, 4, 5) if g != deg]
    key, ds = text_options(txt(deg, lead), f"Constant {deg}-th differences identify degree {deg}; the sign of the constant matches the leading coefficient.",
                           [(txt(other[0], lead), "Stops at the wrong level of differences, misidentifying the degree."), (txt(deg, -lead), "Gets the degree right but reads the sign of the constant difference wrongly."), (txt(other[1], lead), "Takes the wrong number of differences."), (txt(other[2], -lead), "Misidentifies both degree and sign.")])
    stim = table_stim("Values of a polynomial function $p$", "x", "p(x)", list(zip(xs, ys)))
    stem = "The table gives values of a polynomial function $p$ at equally spaced inputs. Based on the values, which of the following is the most likely description of $p$?"
    return MQ("pre_poly_degree_table", "1.4", "2", "not_allowed", stem, key, ds, rng, "Constant n-th differences of equally spaced outputs identify a degree-n polynomial", ["Take successive differences of the outputs until they are constant", "Use the number of differences and their sign for the degree and the leading coefficient"],
              "sympy evaluates the generating polynomial; numpy diff finds the level at which the differences become constant", f"The {deg}-th differences are constant, so $p$ has degree {deg} and the sign of the constant gives the sign of the leading coefficient.", [f"c={c}", f"ys={ys}"], stim=stim, est=95, mat=MAT_TABLE("the table values of p"))


@retry_sep
def pre_poly_end_behavior(rng):
    for _ in forever():
        deg = pick(rng, [3, 4, 5, 6]); lead = pick(rng, [-5, -3, -2, 2, 4, 7]); mid = [pick(rng, [-4, -3, 0, 2, 5]) for _ in range(deg)]
        c = [lead] + mid
        if c[1] != 0 or c[2] != 0:
            break
    p = sum(co * X ** (deg - i) for i, co in enumerate(c))
    f = sp.lambdify(X, p, "math"); vp = float(f(1e4)); vn = float(f(-1e4))
    sgn = lambda v: "\\infty" if v > 0 else "-\\infty"  # noqa: E731
    flip = lambda s: "-\\infty" if s == "\\infty" else "\\infty"  # noqa: E731
    tex = lambda r_, l_: f"As $x\\to\\infty$, $p(x)\\to {r_}$; as $x\\to-\\infty$, $p(x)\\to {l_}$"  # noqa: E731
    r, l = sgn(vp), sgn(vn)
    cands = [(flip(r), flip(l)), (r, flip(l)) if r == l else (r, r), (flip(r), l) if r != l else (flip(r), flip(r)), ("0", "0")]
    seen = {(r, l)}; wrongs = []
    whys = ["Reverses the sign of the leading coefficient.", "Applies the wrong parity of the degree.", "Applies the wrong parity and sign.", "Thinks the function approaches the x-axis at both ends."]
    for (a_, b_), w in zip(cands, whys):
        if (a_, b_) not in seen:
            seen.add((a_, b_)); wrongs.append((tex(a_, b_), w))
    key, ds = text_options(tex(r, l), "End behavior is set by the leading term: the parity of its degree and the sign of its coefficient.", wrongs)
    stem = f"The polynomial function $p$ is defined by $p(x)={L(p)}$. Which of the following describes the end behavior of $p$?"
    return MQ("pre_poly_end_behavior", "1.6", "1", "not_allowed", stem, key, ds, rng, "The leading term determines the end behavior of a polynomial", ["Identify the leading term of the polynomial", "Use the parity of its degree and the sign of its coefficient to describe both ends"],
              "sympy leading term versus numerical evaluation of p at plus and minus 10^4", f"The leading term is ${L(lead * X ** deg)}$; degree {deg} is {'even' if deg % 2 == 0 else 'odd'} and the coefficient is {'positive' if lead > 0 else 'negative'}, so {tex(r, l)}.", [f"c={c}"], est=75)


@retry_sep
def pre_poly_multiplicity_graph(rng):
    for _ in forever():
        r = sorted(rng.sample([-4, -3, -2, -1, 0, 1, 2, 3, 4], 3)); mults = [pick(rng, [1, 2]), pick(rng, [1, 2, 3]), pick(rng, [1, 2])]
        if sum(mults) < 4 or sum(mults) > 5 or len({*mults}) < 2 or min(r[1] - r[0], r[2] - r[1]) < 2:
            continue
        a = pick(rng, [-1, 1]); g = lambda v: a * (v - r[0]) ** mults[0] * (v - r[1]) ** mults[1] * (v - r[2]) ** mults[2]  # noqa: E731
        lo, hi = r[0] - 1.2, r[2] + 1.2
        mx = max(abs(g(v)) for v in np.linspace(lo, hi, 400))
        s = 7.0 / mx; f = lambda v: s * g(v)  # noqa: E731
        inner = [max(abs(f(v)) for v in np.linspace(r[i] + 0.15, r[i + 1] - 0.15, 60)) for i in range(2)]
        if min(inner) >= 1.2:
            break
    k = rng.randrange(3); touches = mults[k] % 2 == 0
    ymax = 8
    stim = fn_graph("The graph of a polynomial function $p$ with zeros at " + ", ".join(str(v) for v in r), f, lo, hi, gaxis("x", math.floor(lo), math.ceil(hi), 1), gaxis("y", -ymax, ymax, 2))
    z = r[k]
    key, ds = text_options(f"The graph touches the x-axis without crossing at $x={z}$, so the multiplicity of the zero is even.", f"Near $x={z}$ the graph reaches the axis and turns back without changing sign, which happens at zeros of even multiplicity.", [(f"The graph crosses the x-axis at $x={z}$, so the multiplicity of the zero is even.", "Links crossing the axis to even multiplicity instead of odd multiplicity."), (f"The graph touches the x-axis without crossing at $x={z}$, so the multiplicity of the zero is odd.", "Links touching the axis to odd multiplicity instead of even multiplicity."), (f"The graph has a vertical asymptote at $x={z}$.", "Confuses a zero of a polynomial with a vertical asymptote of a rational function.")] if touches else
                           [(f"The graph touches the x-axis without crossing at $x={z}$, so the multiplicity of the zero is odd.", "Links touching the axis to odd multiplicity instead of even multiplicity."), (f"The graph crosses the x-axis at $x={z}$, so the multiplicity of the zero is even.", "Links crossing the axis to even multiplicity instead of odd multiplicity."), (f"The graph has a vertical asymptote at $x={z}$.", "Confuses a zero of a polynomial with a vertical asymptote of a rational function.")])
    if not touches:
        key = Opt(f"The graph crosses the x-axis at $x={z}$, so the multiplicity of the zero is odd.", True, f"Near $x={z}$ the graph passes from one side of the axis to the other, which happens at zeros of odd multiplicity.", None)
    stem = f"The graph of a polynomial function $p$ is shown. Which of the following statements about the zero of $p$ at $x={z}$ is true?"
    return MQ("pre_poly_multiplicity_graph", "1.4", "2", "not_allowed", stem, key, ds, rng, "Zero multiplicity parity determines whether the graph crosses or touches the axis", ["Locate the zero on the graph and observe whether the graph crosses or touches the axis", "Relate crossing and touching to odd and even multiplicity"],
              "the plotted values come from the factored form; a sign check on both sides of the zero confirms crossing or touching", f"Near $x={z}$ the sign of $p$ {'does not change' if touches else 'changes'}, so the multiplicity is {'even' if touches else 'odd'}.", [f"r={r}", f"mults={mults}", f"a={a}"], stim=stim, est=85, mat=MAT_GRAPH("the plotted curve", "the zeros"))


@retry_sep
def pre_complex_zero_conjugate(rng):
    a = pick(rng, [-3, -2, -1, 1, 2, 3]); b = pick(rng, [1, 2, 3, 4]); r = pick(rng, [-3, -2, -1, 1, 2, 4])
    q = sp.expand((X - a) ** 2 + b * b); P = sp.expand(q * (X - r)); z = complex(a, b)
    zs = np.roots([float(co) for co in sp.Poly(P, X).all_coeffs()]); assert any(abs(zz - z) < 1e-6 for zz in zs) and any(abs(zz - np.conj(z)) < 1e-6 for zz in zs)
    ctex = lambda re_, im_: f"${re_}{'+' if im_ > 0 else '-'}{abs(im_)}i$"  # noqa: E731
    key, ds = text_options(ctex(a, -b), "Nonreal zeros of a polynomial with real coefficients come in conjugate pairs, so the other zero is the conjugate of the given zero.", [(ctex(-a, b), f"Negates the real part ${a}$ instead of the imaginary part."), (ctex(-a, -b), "Negates both the real part and the imaginary part."), (ctex(b, a), "Swaps the real and imaginary parts of the given zero.")])
    stem = f"The polynomial $p(x)={L(P)}$ has real coefficients, and $x={a}+{b}i$ is a zero of $p$. Which of the following must also be a zero of $p$?"
    return MQ("pre_complex_zero_conjugate", "1.5", "1", "not_allowed", stem, key, ds, rng, "Complex zeros of real polynomials occur in conjugate pairs", ["Recognize that the coefficients of p are real", "Apply the conjugate pairing of nonreal zeros"],
              "numpy roots of the expanded polynomial contain both the given zero and its conjugate", f"Because the coefficients are real, the conjugate ${a}-{b}i$ is also a zero; indeed $p(x)=(x-({r}))\\left({L(q)}\\right)$.", [f"a={a}", f"b={b}", f"r={r}"], est=80)


@retry_sep
def pre_rational_end_behavior(rng):
    for _ in forever():
        dn = pick(rng, [1, 2, 3]); dd = pick(rng, [1, 2, 3]); an = pick(rng, [-6, -4, -3, -2, 2, 3, 4, 6]); ad = pick(rng, [-3, -2, 2, 3, 5])
        n = [an] + [pick(rng, [-3, -1, 0, 2, 5]) for _ in range(dn)]; d = [ad] + [pick(rng, [-4, -2, 0, 1, 3]) for _ in range(dd)]
        if dn <= dd + 1:
            break
    N = sum(co * X ** (dn - i) for i, co in enumerate(n)); D = sum(co * X ** (dd - i) for i, co in enumerate(d)); f = sp.lambdify(X, N / D, "math")
    hv = sp.Rational(an, ad)
    asy = lambda v: f"The horizontal asymptote is $y={L(v)}$"  # noqa: E731
    none_t = "The graph has no horizontal asymptote"
    if dn < dd:
        key_t = asy(sp.Integer(0)); assert abs(f(1e6)) < 1e-3
        wr = [(none_t, "Thinks a bottom-heavy rational function has no horizontal asymptote."), (asy(hv), "Divides leading coefficients even though the degrees differ."), (asy(sp.Integer(an)), "Uses the numerator's leading coefficient only.")]
    elif dn == dd:
        key_t = asy(hv); assert abs(f(1e6) - float(hv)) < 1e-3
        wr = [(asy(sp.Integer(0)), "Thinks the x-axis is always the asymptote."), (asy(sp.Rational(ad, an)), "Inverts the ratio of leading coefficients."), (none_t, "Thinks equal degrees give no horizontal asymptote."), (asy(sp.Integer(an - ad)), "Subtracts leading coefficients.")]
    else:
        key_t = none_t; assert abs(f(1e6)) > 1e3
        wr = [(asy(sp.Integer(0)), "Thinks a top-heavy rational function approaches zero."), (asy(hv), "Divides leading coefficients regardless of the degrees."), (asy(sp.Integer(an)), "Uses the numerator's leading coefficient only.")]
    key, ds = text_options(key_t, "Compare the degrees of the numerator and denominator to find the horizontal asymptote.", wr)
    stem = f"Let $f$ be the function defined by $f(x)=\\dfrac{{{L(N)}}}{{{L(D)}}}$. Which of the following describes the horizontal asymptote of the graph of $f$?"
    return MQ("pre_rational_end_behavior", "1.7", "1", "not_allowed", stem, key, ds, rng, "Degrees of numerator and denominator determine the horizontal asymptote", ["Compare the degrees of the numerator and denominator", "Use the leading coefficients when the degrees are equal"],
              "numerical evaluation of f at x = 10^6 confirms the limiting value", f"The degrees are {dn} and {dd}, so the answer is: {key_t}.", [f"n={n}", f"d={d}"], est=75)


@retry_sep
def pre_rational_features(rng):
    for _ in forever():
        zr, ha, ho = rng.sample([-4, -3, -2, -1, 1, 2, 3, 4, 5], 3)
        break
    N = (X - zr) * (X - ho); D = (X - ha) * (X - ho)
    f = sp.lambdify(X, sp.cancel(N / D), "math"); assert abs(f(ha + 1e-7)) > 1e5
    which = pick(rng, ["asymptote", "zero", "hole"]); val = {"asymptote": ha, "zero": zr, "hole": ho}[which]
    desc = {"asymptote": "vertical asymptote", "zero": "zero", "hole": "hole in its graph"}
    others = [v for v in (zr, ha, ho) if v != val]
    why = {"asymptote": "a factor only in the denominator", "zero": "a factor only in the numerator", "hole": "a factor common to numerator and denominator"}[which]
    cand = [(f"$x={others[0]}$", "Gives the location of a different feature of the graph than the one requested."), (f"$x={others[1]}$", "Gives the location of the third feature, mixing up which factor produces which feature."), (f"$x={-val}$", "Uses the opposite sign of the factor's root."), (f"$x={val + 1}$", "Misreads the root of the factor.")]
    cand = [c for c in cand if c[0] != f"$x={val}$"]
    key, ds = text_options(f"$x={val}$", f"The {desc[which]} comes from {why}.", cand)
    stem = f"The function $f$ is defined by $f(x)=\\dfrac{{{L(sp.expand(N))}}}{{{L(sp.expand(D))}}}$. At which value of $x$ does $f$ have a {desc[which]}?"
    return MQ("pre_rational_features", "1.9", "1", "not_allowed", stem, key, ds, rng, "Factor to separate zeros, vertical asymptotes and holes of a rational function", ["Factor the numerator and the denominator", "Cancel common factors for holes; remaining denominator zeros give vertical asymptotes and numerator zeros give x-intercepts"],
              "sympy cancel on the factored form versus numerical evaluation of f near each x-value", f"Factoring gives $f(x)=\\dfrac{{{L(N)}}}{{{L(D)}}}$; the {desc[which]} is at $x={val}$.", [f"zr={zr}", f"ha={ha}", f"ho={ho}"], est=90)


@retry_sep
def pre_rational_hole_y(rng):
    h0, a, b = rng.sample([-3, -2, -1, 1, 2, 3, 4], 3); k = pick(rng, [1, 2, 3, -1, -2])
    N = k * (X - h0) * (X - a); D = (X - h0) * (X - b)
    yv = sp.Rational(k * (h0 - a), (h0 - b)); f = sp.lambdify(X, N / D, "math"); agree(float(yv), f(h0 + 1e-7), 1e-4, "hole y")
    red = f"\\dfrac{{{L(k * (X - a))}}}{{{L(X - b)}}}"
    key, ds = num_options(float(yv), [(f"Evaluates only the reduced numerator ${L(k * (X - a))}$ at the hole and ignores the reduced denominator ${L(X - b)}$.", float(k * (h0 - a))), ("Reverses the sign of the correct value of the reduced function.", float(-yv)),
                                     (f"Evaluates the reduced function ${red}$ at $x=0$ instead of at $x={h0}$.", float(sp.Rational(k * a, b))), (f"Uses the $x$-coordinate $x={h0}$ of the hole as its $y$-coordinate.", float(h0)), (f"Evaluates only the reduced denominator ${L(X - b)}$ at the hole.", float(h0 - b))], f=rat_tex)
    stem = f"The function $f$ is defined by $f(x)=\\dfrac{{{L(sp.expand(N))}}}{{{L(sp.expand(D))}}}$. The graph of $f$ has a hole at $x={h0}$. What is the $y$-coordinate of the hole?"
    return MQ("pre_rational_hole_y", "1.10", "1", "not_allowed", stem, key, ds, rng, "The y-coordinate of a hole is the value of the reduced function at the hole's x-value", ["Factor and cancel the common factor", "Evaluate the reduced expression at the x-value of the hole"],
              "exact rational evaluation of the reduced function versus numerical evaluation of f at x = h + 10^-7", f"After canceling $(x-({h0}))$, $f(x)={red}$ and its value at $x={h0}$ is ${L(yv)}$.", [f"h0={h0}", f"a={a}", f"b={b}", f"k={k}"], est=90)


@retry_sep
def pre_rational_long_division(rng):
    d = pick(rng, [-3, -2, -1, 1, 2, 3]); a = pick(rng, [1, 2, 3]); b = pick(rng, [-4, -2, 1, 3, 5]); r = pick(rng, [-6, -3, 2, 4, 5])
    qx = a * X + b; num = sp.expand(qx * (X - d) + r); eq = qx + r / (X - d)
    f = sp.lambdify(X, num / (X - d), "math"); g = sp.lambdify(X, eq, "math"); agree(f(1.7), g(1.7), 1e-9, "equivalent")
    key, ds = expr_options(eq, [("Drops the remainder term.", qx), ("Puts the remainder over the wrong denominator, $x+d$.", qx + r / (X + d)), ("Uses the opposite sign for the remainder.", qx - r / (X - d)), ("Uses the constant term of the quotient as the remainder.", qx + b / (X - d))])
    stem = f"Which of the following is equivalent to $\\dfrac{{{L(num)}}}{{{L(X - d)}}}$ for $x\\ne {d}$?"
    return MQ("pre_rational_long_division", "1.11", "1", "not_allowed", stem, key, ds, rng, "Polynomial long division rewrites a rational expression as a quotient plus a remainder term", ["Divide the numerator by the linear divisor", "Write the result as quotient plus remainder over the divisor"],
              "sympy apart versus evaluation of both forms at a test value", f"Dividing gives quotient ${L(qx)}$ and remainder ${r}$, so the expression equals ${L(eq)}$.", [f"d={d}", f"a={a}", f"b={b}", f"r={r}"], est=100)


@retry_sep
def pre_rational_inequality(rng):
    zr, va = rng.sample([-4, -3, -2, -1, 1, 2, 3, 4, 5], 2); sgn = pick(rng, [1, -1])
    f = lambda v: sgn * (v - zr) / (v - va)  # noqa: E731
    crit = sorted([zr, va]); key_t = _iv_pieces(f, crit, True, {zr}); neg_t = _iv_pieces(f, crit, False, {zr})
    wr = [(neg_t, "Reverses the sign: reports where the expression is negative."), (key_t.replace("[", "(").replace("]", ")"), "Excludes the zero of the numerator even though the inequality allows equality."),
          (key_t.replace(f"{va})", f"{va}]").replace(f"({va},", f"[{va},"), "Includes the vertical asymptote, where the expression is undefined."), (f"$[{crit[0]}, {crit[1]}]$", "Treats the two critical values as the endpoints of one interval without testing signs.")]
    key, ds = text_options(key_t, "Test the sign on each interval determined by the zero and the vertical asymptote; include the zero but never the asymptote.", wr)
    stem = f"What is the solution set of the inequality $\\dfrac{{{L(sgn * (X - zr))}}}{{{L(X - va)}}}\\ge 0$?"
    return MQ("pre_rational_inequality", "1.8", "1", "not_allowed", stem, key, ds, rng, "Sign analysis of a rational function across its zero and vertical asymptote", ["Find the zero and the vertical asymptote that split the number line", "Test the sign on each interval and decide which endpoints are included"],
              "a sign table built from the factored form is checked against numerical evaluation at interval midpoints", f"The expression is zero at $x={zr}$ and undefined at $x={va}$; testing each interval gives {key_t}.", [f"zr={zr}", f"va={va}", f"sgn={sgn}"], est=100)


@retry_sep
def pre_transform_point(rng):
    p = pick(rng, [-3, -2, -1, 0, 1, 2, 3]); q = pick(rng, [-4, -2, -1, 1, 2, 3, 5]); a = pick(rng, [-3, -2, -1, 2, 3, 4]); hh = pick(rng, [-3, -2, -1, 1, 2, 4]); kk = pick(rng, [-4, -3, -1, 2, 3, 5])
    gx = p + hh; gy = a * q + kk
    sa = "-" if a == -1 else ("" if a == 1 else str(a))
    form = f"g(x)={sa}f(x{'-' if hh > 0 else '+'}{abs(hh)}){'+' if kk > 0 else '-'}{abs(kk)}"
    key, ds = text_options(f"$({gx}, {gy})$", "A horizontal shift moves the input by h, then the vertical stretch and shift act on the output as a*q+k.",
                           [(f"$({p - hh}, {gy})$", "Shifts horizontally in the wrong direction."), (f"$({gx}, {a * (q + kk)})$", "Applies the vertical shift before the vertical stretch."), (f"$({gx}, {q + kk})$", "Ignores the vertical stretch factor."), (f"$({p}, {gy})$", "Ignores the horizontal shift.")])
    stem = f"The point $({p}, {q})$ is on the graph of the function $f$. The function $g$ is defined by ${form}$. Which of the following points must be on the graph of $g$?"
    return MQ("pre_transform_point", "1.12", "1", "not_allowed", stem, key, ds, rng, "Track a point through a combination of function transformations", ["Find the input that makes the shifted argument equal the given input", "Apply the vertical stretch and then the vertical shift to the output"],
              "the image point is computed by evaluating g at the transformed input using a numeric stand-in for f that passes through the given point", f"$g({gx})={a}\\cdot f({p}){'+' if kk > 0 else '-'}{abs(kk)}={a}\\cdot{q}{'+' if kk > 0 else '-'}{abs(kk)}={gy}$, so $({gx}, {gy})$ is on the graph of $g$.", [f"p={p}", f"q={q}", f"a={a}", f"h={hh}", f"k={kk}"], est=85)


@retry_sep
def pre_transform_domain_range(rng):
    dlo = pick(rng, [-4, -3, -2, -1, 0]); dhi = dlo + pick(rng, [3, 4, 5, 6]); rlo = pick(rng, [-3, -2, -1, 0, 1]); rhi = rlo + pick(rng, [2, 3, 4, 6])
    hh = pick(rng, [-3, -2, 1, 2, 3]); a = pick(rng, [-2, -1, 2, 3]); kk = pick(rng, [-3, -1, 2, 4])
    gd = (dlo + hh, dhi + hh); rr = tuple(sorted([a * rlo + kk, a * rhi + kk]))
    sa = "-" if a == -1 else ("" if a == 1 else str(a))
    form = f"g(x)={sa}f(x{'-' if hh > 0 else '+'}{abs(hh)}){'+' if kk > 0 else '-'}{abs(kk)}"
    mk = lambda d_, r_: f"Domain $[{d_[0]}, {d_[1]}]$; range $[{r_[0]}, {r_[1]}]$"  # noqa: E731
    wr = [(mk((dlo - hh, dhi - hh), rr), "Shifts the domain in the wrong direction."), (mk(gd, (rlo + kk, rhi + kk)), "Ignores the vertical stretch or reflection when finding the range."), (mk((dlo, dhi), rr), "Ignores the horizontal shift of the domain."),
          (mk(gd, (a * rlo + kk, a * rhi + kk)), "Applies the stretch but does not reorder the endpoints after a reflection."), (mk(gd, (a * rlo, a * rhi)), "Forgets the vertical shift.")]
    wr = [(t, w) for t, w in wr if t != mk(gd, rr)]
    key, ds = text_options(mk(gd, rr), "A horizontal shift moves the domain; the vertical stretch (with reflection if negative) and shift act on the range.", wr)
    stem = f"The function $f$ has domain $[{dlo}, {dhi}]$ and range $[{rlo}, {rhi}]$. The function $g$ is defined by ${form}$. Which of the following gives the domain and range of $g$?"
    return MQ("pre_transform_domain_range", "1.12", "2", "not_allowed", stem, key, ds, rng, "Transformations change domain and range predictably", ["Shift the domain by the horizontal translation", "Apply the vertical stretch, reflection and translation to both range endpoints and reorder them"],
              "endpoint images computed by direct evaluation of the transformation on the stated endpoints", f"The domain becomes $[{gd[0]}, {gd[1]}]$ and the range endpoints map to ${a}\\cdot({rlo}){'+' if kk > 0 else '-'}{abs(kk)}$ and ${a}\\cdot({rhi}){'+' if kk > 0 else '-'}{abs(kk)}$, giving $[{rr[0]}, {rr[1]}]$.", [f"d=({dlo},{dhi})", f"r=({rlo},{rhi})", f"h={hh}", f"a={a}", f"k={kk}"], est=90)


@retry_sep
def pre_poly_ineq_intervals(rng):
    r = sorted(rng.sample([-4, -3, -2, -1, 0, 1, 2, 3, 4], 3)); a = pick(rng, [-1, 1])
    f = lambda v: a * (v - r[0]) * (v - r[1]) * (v - r[2])  # noqa: E731
    key_t = _iv_pieces(f, r, True); neg = _iv_pieces(f, r, False)
    alt = f"$(-\\infty, {r[0]})\\cup({r[1]}, {r[2]})$" if a > 0 else f"$({r[0]}, {r[1]})\\cup({r[2]}, \\infty)$"
    wr = [(neg, "Reverses the sign: reports where the polynomial is negative."), (f"$({r[0]}, {r[2]})$", "Treats the outer zeros as the endpoints of a single interval."), (alt, "Alternates the signs incorrectly across the zeros."), (f"$({r[1]}, {r[2]})$", "Reports a single interval between the two larger zeros.")]
    wr = [(t, w) for t, w in wr if t != key_t]
    key, ds = text_options(key_t, "Test the sign of the product on each interval between consecutive zeros.", wr)
    fac = lambda z: f"(x{'-' if z > 0 else '+'}{abs(z)})" if z != 0 else "x"  # noqa: E731
    stem = f"For which values of $x$ is $p(x)>0$, where $p(x)={'-' if a < 0 else ''}{fac(r[0])}{fac(r[1])}{fac(r[2])}$?"
    return MQ("pre_poly_ineq_intervals", "1.4", "1", "not_allowed", stem, key, ds, rng, "Sign analysis of a factored polynomial", ["Identify the zeros from the factored form", "Test the sign of the product on each interval"], "sign evaluation of the product at interval midpoints", f"The zeros are {r[0]}, {r[1]} and {r[2]}; the polynomial is positive on {key_t}.", [f"r={r}", f"a={a}"], est=85)


@retry_sep
def pre_even_odd_table(rng):
    for _ in forever():
        kind = pick(rng, ["even", "odd", "neither"]); xs = [-3, -2, -1, 0, 1, 2, 3]
        base = {1: rng.randint(2, 9), 2: rng.randint(-8, 9), 3: rng.randint(2, 11)}
        if kind == "even":
            ys = [base[abs(v)] if v else rng.randint(1, 9) for v in xs]
        elif kind == "odd":
            ys = [base[abs(v)] * (1 if v > 0 else -1) if v else 0 for v in xs]
        else:
            ys = [base[abs(v)] * (1 if v > 0 else -1) + (3 if v == -2 else 0) if v else rng.randint(1, 9) for v in xs]
        nz = [y for y in ys if y]
        even_ok = all(ys[i] == ys[6 - i] for i in range(3)); odd_ok = all(ys[i] == -ys[6 - i] for i in range(3)) and ys[3] == 0
        if (kind == "even") == even_ok and (kind == "odd") == odd_ok and len(nz) >= 5 and (kind != "neither" or (not even_ok and not odd_ok)) and (kind != "even" or len({abs(ys[0]), abs(ys[1]), abs(ys[2])}) == 3) and all(ys[i] != 0 for i in (0, 1, 2)):
            break
    s_even = "The values in the table are consistent with $f$ being an even function"; s_odd = "The values in the table are consistent with $f$ being an odd function"; s_nei = "The values in the table show that $f$ is neither even nor odd"
    why_ = {"even": f"The outputs at opposite inputs are equal: $f(-1)=f(1)={ys[2]}$, $f(-2)=f(2)={ys[1]}$, $f(-3)=f(3)={ys[0]}$.", "odd": f"The outputs at opposite inputs are opposites and $f(0)=0$: $f(-1)={ys[2]}=-f(1)$, $f(-2)={ys[1]}=-f(2)$, $f(-3)={ys[0]}=-f(3)$.", "neither": f"The outputs at opposite inputs are neither equal nor opposites: for example $f(-2)={ys[1]}$ and $f(2)={ys[5]}$."}
    ans = {"even": s_even, "odd": s_odd, "neither": s_nei}
    wy = {"even": "Calls the table consistent with an even function although some opposite inputs have different outputs.", "odd": "Calls the table consistent with an odd function although some opposite inputs do not have opposite outputs.", "neither": "Concludes that the table shows neither symmetry although the outputs follow a symmetry pattern."}
    key, ds = text_options(ans[kind], why_[kind], [(v, wy[k]) for k, v in ans.items() if k != kind] + [("The values in the table are consistent with $f$ being both even and odd", "Thinks one table can follow both symmetry patterns at once.")])
    stim = table_stim("Values of a function $f$", "x", "f(x)", list(zip(xs, ys)))
    stem = "The table gives values of a function $f$. Which of the following statements is true?"
    return MQ("pre_even_odd_table", "1.12", "2", "not_allowed", stem, key, ds, rng, "Even functions satisfy f(-x)=f(x) and odd functions satisfy f(-x)=-f(x)", ["Pair each input with its opposite in the table", "Compare the outputs for equality or opposite signs across all pairs, including x = 0"], "pairwise comparison of the generating values in numpy for equality and negation", why_[kind], [f"xs={xs}", f"ys={ys}", f"kind={kind}"], stim=stim, est=75, mat=MAT_TABLE("the table values of f"))


@retry_sep
def pre_roc_quadratic_symmetric(rng):
    for _ in forever():
        a = pick(rng, [-3, -2, 2, 3]); h0 = pick(rng, [-2, -1, 1, 2, 3, 4]); k0 = pick(rng, [-5, -2, 0, 3, 6]); d = pick(rng, [1, 2, 3])
        q = lambda v: a * (v - h0) ** 2 + k0  # noqa: E731
        lo, hi = h0 - d, h0 + d + pick(rng, [1, 2])
        r = Fr(int(q(hi) - q(lo)), hi - lo)
        if r != 0 and abs(r) < 40 and q(lo) != q(hi) and q(hi) + q(lo) != 0:
            break
    agree(float(r), a * (hi + lo - 2 * h0), 1e-9, "roc formula")
    key, ds = num_options(float(r), [(f"Reports the change $q({hi})-q({lo})={q(hi) - q(lo)}$ without dividing by the interval length {hi - lo}.", float(q(hi) - q(lo))), (f"Divides the change in output by the sum of the endpoints, ${hi}+({lo})$, instead of their difference.", float(Fr(int(q(hi) - q(lo)), hi + lo)) if hi + lo else None),
                                    (f"Averages the two output values $q({lo})$ and $q({hi})$.", (q(lo) + q(hi)) / 2), (f"Uses the leading coefficient {a} as the average rate of change.", float(a)), ("Subtracts the endpoint values in the wrong order, which reverses the sign.", float(-r))], f=rat_tex)
    sa = "" if a == 1 else ("-" if a == -1 else str(a))
    stem = f"The quadratic function $q$ is defined by $q(x)={sa}(x{'-' if h0 > 0 else '+'}{abs(h0)})^2{'+' if k0 >= 0 else '-'}{abs(k0)}$. What is the average rate of change of $q$ over the interval ${lo}\\le x\\le {hi}$?"
    return MQ("pre_roc_quadratic_symmetric", "1.3", "1", "not_allowed", stem, key, ds, rng, "Average rate of change of a quadratic over an interval", ["Evaluate the quadratic at the two endpoints", "Divide the change in output by the change in input"], "exact rational arithmetic versus the closed form a times the sum of the endpoints minus twice the vertex abscissa", f"$\\dfrac{{q({hi})-q({lo})}}{{{hi - lo}}}=\\dfrac{{{q(hi)}-({q(lo)})}}{{{hi - lo}}}={L(rat(r))}$.", [f"a={a}", f"h={h0}", f"k={k0}", f"lo={lo}", f"hi={hi}"], est=85)
