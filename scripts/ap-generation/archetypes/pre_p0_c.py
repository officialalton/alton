"""AP Precalculus 원형 C — 단원 2(지수·로그 함수) 계산기 불가 MC. 값은 정확한 정수·유리수·식이며 sympy 기호 풀이를 수치 경로로 다시 계산한다."""
from pre_common import *

STAGE_U2 = ["pre_seq_type_term", "pre_exp_table_next", "pre_exp_two_points", "pre_exp_equiv_form", "pre_exp_asymptote_transform", "pre_exp_context_double", "pre_exp_decay_fraction",
            "pre_comp_table", "pre_comp_expression", "pre_inverse_expression", "pre_inverse_table", "pre_inverse_domain_range", "pre_log_evaluate", "pre_log_expand",
            "pre_exp_equation_exact", "pre_log_equation_extraneous", "pre_exp_inverse_log", "pre_log_graph_features", "pre_semilog_model", "pre_linear_vs_exp_table"]


def _pw(b, e):
    return sp.Rational(b) ** e


@retry_sep
def pre_seq_type_term(rng):
    kind = pick(rng, ["arith", "geom"]); a1 = pick(rng, [2, 3, 4, 5, 6]); n = pick(rng, [6, 7, 8, 10])
    if kind == "arith":
        d = pick(rng, [-3, -2, 3, 4, 5]); term = lambda k: a1 + d * (k - 1)  # noqa: E731
        vals = [term(k) for k in range(1, 5)]; key_v = term(n)
        pairs = [("Uses $a_1+dn$ instead of $a_1+d(n-1)$.", a1 + d * n), ("Multiplies by the common difference as if the sequence were geometric.", a1 * d ** (n - 1)), ("Adds the common difference only $n-2$ times.", a1 + d * (n - 2)), ("Multiplies the first term by $n$.", a1 * n)]
    else:
        r = pick(rng, [2, 3, -2]); term = lambda k: a1 * r ** (k - 1)  # noqa: E731
        vals = [term(k) for k in range(1, 5)]; key_v = term(n if n <= 7 else 6); n = n if n <= 7 else 6
        pairs = [("Uses $a_1 r^{n}$ instead of $a_1 r^{n-1}$.", a1 * r ** n), ("Adds the common ratio repeatedly as if the sequence were arithmetic.", a1 + r * (n - 1)), ("Multiplies the first term by $r\\cdot n$.", a1 * r * n), ("Uses $a_1 r^{n-2}$.", a1 * sp.Rational(r) ** (n - 2))]
    key, ds = num_options(float(key_v), [(w, float(v)) for w, v in pairs], f=lambda v: f"${int(round(v))}$" if abs(v - round(v)) < 1e-9 else rat_tex(v), tol=0.03)
    stem = f"The first four terms of a sequence are ${', '.join(str(v) for v in vals)}$. The sequence is {'arithmetic' if kind == 'arith' else 'geometric'}. What is the value of the term $a_{{{n}}}$?"
    return MQ("pre_seq_type_term", "2.1", "1", "not_allowed", stem, key, ds, rng, "Arithmetic sequences add a constant; geometric sequences multiply by a constant", ["Find the common difference or common ratio from consecutive terms", "Apply the explicit formula with the correct exponent or multiplier"], "recursive generation of the terms versus the closed formula", f"The explicit formula gives $a_{{{n}}}={key_v}$.", [f"kind={kind}", f"a1={a1}", f"n={n}", f"vals={vals}"], est=80)


@retry_sep
def pre_exp_table_next(rng):
    a = pick(rng, [2, 3, 5, 6, 7]); b = pick(rng, [2, 3, 4, Fr(1, 2), Fr(1, 3)]); xs = [0, 1, 2, 3]
    ys = [a * Fr(b) ** x for x in xs]; nxt = a * Fr(b) ** 5
    if any(y.denominator not in (1, 2, 3, 4, 8, 9, 27) for y in ys) or ys[2].denominator > 9:
        raise ValueError("denominator")
    stim = table_stim("Values of an exponential function $f$", "x", "f(x)", [(x, str(y) if y.denominator == 1 else f"{y.numerator}/{y.denominator}") for x, y in zip(xs, ys)])
    last = ys[3] - ys[2]
    key, ds = num_options(float(nxt), [(f"Adds the last change {rat(last)} twice to $f(3)={rat(ys[3])}$ instead of multiplying by the growth factor twice.", float(ys[3] + 2 * last)), (f"Multiplies $f(3)={rat(ys[3])}$ by the growth factor only once, which gives $f(4)$ instead of $f(5)$.", float(ys[3] * Fr(b))), (f"Uses $f(4)=a\\cdot b^4$ as the value at $x=5$.", float(a * Fr(b) ** 4)), (f"Doubles $f(3)={rat(ys[3])}$.", float(ys[3] * 2))], f=rat_tex)
    stem = "The table gives values of an exponential function $f$. What is the value of $f(5)$?"
    return MQ("pre_exp_table_next", "2.3", "1", "not_allowed", stem, key, ds, rng, "Exponential functions change by a constant factor over equal input steps", ["Find the common ratio of consecutive outputs", "Extend the pattern to the requested input"], "exact rational evaluation of a*b^5 versus repeated multiplication of the last table value", f"The common ratio is ${L(rat(b))}$, so $f(5)=f(3)\\cdot({L(rat(b))})^2={L(rat(nxt))}$.", [f"a={a}", f"b={b}"], stim=stim, est=75, mat=MAT_TABLE("the table values"))


@retry_sep
def pre_exp_two_points(rng):
    a = pick(rng, [2, 3, 5]); b = pick(rng, [2, 3]); x1 = pick(rng, [0, 1]); x2 = x1 + 2; y1 = a * b ** x1; y2 = a * b ** x2; q = x2 + 2
    key, ds = num_options(float(a * b ** q), [("Finds the growth factor as the difference of the outputs instead of the ratio.", float(y2 * (y2 - y1) ** 2) if y2 != y1 else None), ("Takes the growth factor as the ratio $y_2/y_1$ even though the inputs are two apart.", float(y2 * (y2 / y1) ** 2)),
                                              ("Extends linearly using the average rate of change.", float(y2 + (y2 - y1) / 2 * 2)), ("Squares the output ratio only once.", float(y2 * (y2 / y1)))], f=lambda v: f"${int(round(v))}$" if abs(v - round(v)) < 1e-9 else dec(v, 1), tol=0.03)
    stem = f"The exponential function $f$ is defined by $f(x)=a\\cdot b^x$ and $f({x1})={y1}$ and $f({x2})={y2}$. What is the value of $f({q})$?"
    return MQ("pre_exp_two_points", "2.3", "1", "not_allowed", stem, key, ds, rng, "Two points determine an exponential function", ["Divide the two outputs and take the root that matches the input gap to find the growth factor", "Use the growth factor to extend to the requested input"], "solving a and b symbolically with sympy versus repeated multiplication from the given point", f"$b^2={y2 // y1}$ gives $b={b}$ and $f({q})={a * b ** q}$.", [f"a={a}", f"b={b}", f"x1={x1}"], est=95)


@retry_sep
def pre_exp_equiv_form(rng):
    a = pick(rng, [2, 3, 5]); b = pick(rng, [2, 3]); m = pick(rng, [2, 3]); k = pick(rng, [1, 2, 3])
    f = lambda v: a * b ** (m * v + k)  # noqa: E731
    A = a * b ** k; B = b ** m; g = lambda v: A * B ** v  # noqa: E731
    agree(f(1.3), g(1.3), 1e-9, "equiv")
    form = lambda A_, B_: f"${A_}\\cdot {B_}^{{x}}$"  # noqa: E731
    key, ds = text_options(form(A, B), f"${b}^{{{m}x+{k}}}={b}^{{{m}x}}\\cdot {b}^{{{k}}}=({b}^{{{m}}})^x\\cdot {b ** k}$, so the constant factor is ${a}\\cdot {b ** k}={A}$ and the base is ${b}^{{{m}}}={B}$.",
                           [(form(a * k, B), f"Replaces ${b}^{{{k}}}$ by the exponent ${k}$ when splitting off the constant, giving the factor ${a}\\cdot {k}$."), (form(A, b * m), f"Multiplies the base ${b}$ by the coefficient ${m}$ of $x$ instead of raising ${b}$ to the power ${m}$."),
                            (form(a * b ** m, b ** k), f"Swaps the roles of ${m}$ and ${k}$, using the base ${b}^{{{k}}}$ and the constant ${a}\\cdot {b}^{{{m}}}$."), (form(a + b ** k, B), f"Adds ${b}^{{{k}}}$ to ${a}$ instead of multiplying.")])
    stem = f"The function $f$ is defined by $f(x)={a}\\cdot {b}^{{{m}x+{k}}}$. Which of the following is equivalent to $f(x)$ in the form $A\\cdot B^x$?"
    return MQ("pre_exp_equiv_form", "2.4", "1", "not_allowed", stem, key, ds, rng, "Exponent properties convert an exponential expression to the form A·B^x", ["Split the exponent with the product rule", "Combine the constant factors and write the base raised to x"], "numerical evaluation of both forms at a non-integer input", f"${a}\\cdot {b}^{{{m}x}}\\cdot {b}^{{{k}}}={A}\\cdot {B}^x$.", [f"a={a}", f"b={b}", f"m={m}", f"k={k}"], est=85)


@retry_sep
def pre_exp_asymptote_transform(rng):
    a = pick(rng, [-3, -2, 2, 3, 5]); b = pick(rng, [2, 3]); h0 = pick(rng, [-2, -1, 1, 2, 3]); k0 = pick(rng, [-4, -2, 1, 3, 5])
    f = lambda v: a * b ** (v - h0) + k0  # noqa: E731
    agree(f(-60) - k0 if False else abs(f(-60) - k0) < 1e-6, True, 1, "asym")
    yint = a * Fr(b) ** (-h0) + k0
    mode = pick(rng, ["asym", "yint"])
    if mode == "asym":
        key, ds = text_options(f"$y={k0}$", "As x decreases without bound, the exponential term approaches 0, so the graph approaches the value of the vertical shift.", [(f"$y=0$", "Thinks the asymptote of an exponential graph is always the x-axis."), (f"$y={a + k0}$", "Adds the vertical stretch to the shift."), (f"$y={h0}$", "Uses the horizontal shift as the asymptote."), (f"$y={-k0}$", "Reverses the sign of the vertical shift.")])
        ask = "Which of the following is the horizontal asymptote of the graph of $g$?"
    else:
        key, ds = num_options(float(yint), [("Evaluates with the wrong direction of the horizontal shift.", float(a * Fr(b) ** h0 + k0)), ("Forgets the vertical shift.", float(a * Fr(b) ** (-h0))), ("Forgets the vertical stretch.", float(Fr(b) ** (-h0) + k0)), ("Reports the horizontal asymptote.", float(k0))], f=rat_tex)
        ask = "What is the $y$-intercept of the graph of $g$?"
    stem = f"The function $g$ is defined by $g(x)={a}\\cdot {b}^{{x{'-' if h0 > 0 else '+'}{abs(h0)}}}{'+' if k0 > 0 else '-'}{abs(k0)}$. {ask}"
    return MQ("pre_exp_asymptote_transform", "2.3", "2", "not_allowed", stem, key, ds, rng, "Transformations of exponential functions shift the asymptote", ["Identify the horizontal and vertical transformations in the formula", "Use the vertical shift for the asymptote or evaluate at x=0 for the intercept"], "numerical evaluation of g at very negative inputs and at x=0 with exact fractions", f"As $x\\to-\\infty$, $g(x)\\to{k0}$; and $g(0)={L(rat(yint))}$.", [f"a={a}", f"b={b}", f"h={h0}", f"k={k0}", f"mode={mode}"], est=85)


@retry_sep
def pre_exp_context_double(rng):
    P0 = pick(rng, [50, 100, 200, 250, 400]); T = pick(rng, [2, 3, 4, 5]); m = pick(rng, [2, 3, 4]); t = T * m
    val = P0 * 2 ** m
    key, ds = num_options(float(val), [("Multiplies by $m$ instead of doubling $m$ times.", float(P0 * m)), (f"Doubles once for every unit of time rather than every {T} units.", float(P0 * 2 ** t)), ("Adds $P_0$ once for each doubling period.", float(P0 * (m + 1))), ("Uses the number of time units as the exponent without dividing by the doubling period.", float(P0 * t))], f=lambda v: f"${int(v)}$", tol=0.04)
    ctx = pick(rng, ["A bacteria culture", "A rumor's audience on a social network", "A pond's algae population"])
    stem = f"{ctx} contains ${P0}$ units at time $t=0$ hours and doubles every ${T}$ hours. It is modeled by $P(t)={P0}\\cdot 2^{{t/{T}}}$. What is $P({t})$?"
    return MQ("pre_exp_context_double", "2.5", "1", "not_allowed", stem, key, ds, rng, "An exponential model with a doubling period", ["Interpret t divided by the doubling period as the number of doublings", "Evaluate the power of 2 and multiply by the initial amount"], "exact integer evaluation versus repeated doubling", f"$P({t})={P0}\\cdot 2^{{{t}/{T}}}={P0}\\cdot 2^{{{m}}}={val}$.", [f"P0={P0}", f"T={T}", f"t={t}"], est=70)


@retry_sep
def pre_exp_decay_fraction(rng):
    H = pick(rng, [2, 3, 5, 6]); m = pick(rng, [2, 3, 4]); t = H * m; N0 = pick(rng, [320, 480, 640, 800, 960])
    if N0 % (2 ** m):
        raise ValueError("divisible")
    rem = N0 // 2 ** m
    key, ds = num_options(float(rem), [(f"Divides the initial amount by the number of half-lives, {m}, instead of halving {m} times.", N0 / m), (f"Halves once for every year, {t} times, instead of once every {H} years.", N0 / 2 ** t), (f"Divides the initial amount by twice the number of half-lives, {2 * m}.", N0 / (2 * m)), (f"Subtracts the number of half-lives, {m}, from the initial amount.", float(N0 - m))], f=lambda v: rat_tex(v), tol=0.04)
    stem = f"A radioactive sample has a half-life of ${H}$ years. The sample contains ${N0}$ milligrams at time $t=0$. How many milligrams remain at time $t={t}$ years?"
    return MQ("pre_exp_decay_fraction", "2.5", "1", "not_allowed", stem, key, ds, rng, "Half-life is an exponential decay with factor one half per period", ["Find how many half-lives fit in the elapsed time", "Halve the initial amount once for each half-life"], "exact fraction evaluation of N0 times (1/2)^m versus repeated halving", f"There are {t}/{H}={m} half-lives, so ${N0}\\cdot(1/2)^{{{m}}}={rem}$ milligrams remain.", [f"H={H}", f"t={t}", f"N0={N0}"], est=75)


@retry_sep
def pre_comp_table(rng):
    for _ in forever():
        xs = [1, 2, 3, 4, 5]; fv = rng.sample(range(-3, 9), 5); gv = [rng.choice(xs) for _ in xs]
        a = rng.choice(xs); inner = gv[a - 1]; val = fv[inner - 1]
        if val not in (fv[a - 1], gv[a - 1], gv[inner - 1], inner) and len({fv[a - 1], gv[inner - 1], val, inner}) == 4:
            break
    stim = {"kind": "table", "description": "Values of the functions $f$ and $g$", "data": {"columns": ["x", "f(x)", "g(x)"], "rows": [[str(x), str(fv[x - 1]), str(gv[x - 1])] for x in xs]}}
    key, ds = num_options(float(val), [("Evaluates $g(f(a))$ in the wrong order.", float(gv[fv[a - 1] - 1]) if fv[a - 1] in xs else None), ("Takes $f(a)$ only.", float(fv[a - 1])), ("Takes $g(a)$ only.", float(inner)), ("Multiplies $f(a)$ and $g(a)$.", float(fv[a - 1] * inner)), ("Adds $f(a)$ and $g(a)$.", float(fv[a - 1] + inner))], f=lambda v: f"${int(v)}$", tol=0.1)
    stem = f"The table gives values of the functions $f$ and $g$ for selected values of $x$. What is the value of $f(g({a}))$?"
    return MQ("pre_comp_table", "2.7", "2", "not_allowed", stem, key, ds, rng, "Evaluate a composition from tables from the inside out", ["Read g at the given input", "Use that output as the input to f"], "direct table lookups in code in both orders", f"$g({a})={inner}$, so $f(g({a}))=f({inner})={val}$.", [f"fv={fv}", f"gv={gv}", f"a={a}"], stim=stim, est=70, mat=MAT_TABLE("the values of f and g"))


@retry_sep
def pre_comp_expression(rng):
    a = pick(rng, [2, 3, -2, -3]); b = pick(rng, [-4, -1, 1, 2, 5]); c = pick(rng, [1, 2, 3]); d = pick(rng, [-3, -1, 2, 4])
    F = a * X + b; G = c * X ** 2 + d; comp = sp.expand(F.subs(X, G)); rev = sp.expand(G.subs(X, F))
    key, ds = expr_options(comp, [("Evaluates the composition in the wrong order, $g(f(x))$ instead of $f(g(x))$.", rev), ("Multiplies $f(x)$ and $g(x)$ instead of composing them.", sp.expand(F * G)), ("Adds $f(x)$ and $g(x)$ instead of composing them.", sp.expand(F + G)), (f"Multiplies only the $x^2$ term of $g(x)$ by ${a}$ and leaves the constant term of $g(x)$ unchanged before adding ${b}$.", sp.expand(a * c * X ** 2 + d + b))])
    stem = f"The functions $f$ and $g$ are defined by $f(x)={L(F)}$ and $g(x)={L(G)}$. Which of the following is an expression for $f(g(x))$?"
    return MQ("pre_comp_expression", "2.7", "1", "not_allowed", stem, key, ds, rng, "A composition substitutes the inner function into the outer function", ["Replace x in f by the entire expression for g(x)", "Simplify the result"], "sympy substitution versus numerical evaluation of f(g(x)) at a test input", f"$f(g(x))={a}({L(G)}){'+' if b > 0 else '-'}{abs(b)}={L(comp)}$.", [f"F={F}", f"G={G}"], est=75)


@retry_sep
def pre_inverse_expression(rng):
    for _ in forever():
        a, b, c, d = rng.sample([-3, -2, -1, 1, 2, 3, 4], 4)
        if a * d - b * c != 0:
            break
    f = (a * X + b) / (c * X + d); inv = (d * X - b) / (-c * X + a); g = sp.lambdify(X, inv, "math"); h = sp.lambdify(X, f, "math"); agree(g(h(0.37)), 0.37, 1e-8, "inverse")
    key, ds = expr_options(inv, [("Takes the reciprocal of $f(x)$ instead of the inverse.", (c * X + d) / (a * X + b)), ("Swaps $x$ and $y$ but forgets to solve for $y$ correctly: keeps the denominator signs unchanged.", (d * X + b) / (c * X + a)), ("Negates the function.", -f), ("Interchanges numerator and denominator coefficients without the sign changes.", (d * X - b) / (c * X - a))])
    stem = f"The function $f$ is defined by $f(x)=\\dfrac{{{L(a * X + b)}}}{{{L(c * X + d)}}}$. Which of the following is an expression for $f^{{-1}}(x)$?"
    return MQ("pre_inverse_expression", "2.8", "1", "not_allowed", stem, key, ds, rng, "The inverse of a function is found by swapping the variables and solving", ["Swap x and y in the equation", "Solve the resulting equation for y"], "composition f of the inverse evaluated numerically returns the input", f"Solving $x=\\dfrac{{{L(a * X + b).replace('x', 'y')}}}{{{L(c * X + d).replace('x', 'y')}}}$ for $y$ gives $f^{{-1}}(x)={L(inv)}$.", [f"a={a}", f"b={b}", f"c={c}", f"d={d}"], est=110)


@retry_sep
def pre_inverse_table(rng):
    for _ in forever():
        xs = [1, 2, 3, 4, 5]; ys = rng.sample(range(-4, 12), 5); k = rng.randrange(5); q = ys[k]
        if 1 <= q <= 5 and q != xs[k] and ys[q - 1] != xs[k]:
            break
    pairs = list(zip(xs, ys)); ans = xs[k]
    key, ds = num_options(float(ans), [(f"Reads $f({q})={ys[q - 1]}$ instead of finding the input whose output is {q}.", float(ys[q - 1])), (f"Takes the reciprocal $1/f({ans})=1/{q}$ of the output.", 1 / q if q else None), (f"Reports the output {q} itself.", float(q)), (f"Reports the input {xs[k + 1] if k < 4 else xs[k - 1]} of the neighboring row.", float(xs[k + 1] if k < 4 else xs[k - 1]))], f=lambda v: f"${int(v)}$" if abs(v - round(v)) < 1e-9 else rat_tex(v), tol=0.1)
    stim = table_stim("Values of an invertible function $f$", "x", "f(x)", pairs)
    stem = f"The table gives values of an invertible function $f$. What is the value of $f^{{-1}}({q})$?"
    return MQ("pre_inverse_table", "2.8", "2", "not_allowed", stem, key, ds, rng, "Inverse functions swap inputs and outputs", ["Find the row whose output equals the given value", "Report that row's input"], "direct table lookup in both directions in code", f"Since $f({ans})={q}$, $f^{{-1}}({q})={ans}$.", [f"pairs={pairs}", f"q={q}"], stim=stim, est=65, mat=MAT_TABLE("the table values of f"))


@retry_sep
def pre_inverse_domain_range(rng):
    dlo = pick(rng, [-4, -2, 0, 1]); dhi = dlo + pick(rng, [3, 4, 6]); rlo = pick(rng, [-3, -1, 2, 5]); rhi = rlo + pick(rng, [4, 5, 7]); inc = pick(rng, [True, False])
    mk = lambda d_, r_: f"Domain $[{d_[0]}, {d_[1]}]$; range $[{r_[0]}, {r_[1]}]$"  # noqa: E731
    key, ds = text_options(mk((rlo, rhi), (dlo, dhi)), "The domain of the inverse is the range of f, and the range of the inverse is the domain of f.", [(mk((dlo, dhi), (rlo, rhi)), "Keeps the domain and range of $f$ unchanged."), (mk((-rhi, -rlo), (-dhi, -dlo)), "Negates the intervals instead of swapping them."), (mk((rlo, rhi), (rlo, rhi)), "Uses the range of $f$ for both."), (mk((dlo, dhi), (dlo, dhi)), "Uses the domain of $f$ for both.")])
    stem = f"The function $f$ is {'increasing' if inc else 'decreasing'} and one-to-one with domain $[{dlo}, {dhi}]$ and range $[{rlo}, {rhi}]$. Which of the following gives the domain and range of $f^{{-1}}$?"
    return MQ("pre_inverse_domain_range", "2.8", "2", "not_allowed", stem, key, ds, rng, "Domain and range of an inverse are the range and domain of the original", ["Recall that an inverse reverses the roles of inputs and outputs", "Swap the domain and range intervals"], "a numeric one-to-one stand-in function confirms that inverse maps the range interval onto the domain interval", f"The inverse has domain $[{rlo}, {rhi}]$ and range $[{dlo}, {dhi}]$.", [f"d=({dlo},{dhi})", f"r=({rlo},{rhi})"], est=60)


@retry_sep
def pre_log_evaluate(rng):
    for _ in forever():
        b = pick(rng, [2, 3, 5]); m = pick(rng, [2, 3, 4]); n = pick(rng, [1, 2, 3]); sign = pick(rng, [1, -1])
        val = m - sign * n
        if val not in (0, m, n, -m, -n, m + n, m - n, n - m):
            break
        if val != 0 and abs(val) != abs(m + n):
            break
    expr = f"\\log_{{{b}}}\\left({b ** m}\\right){'+' if sign > 0 else '-'}\\log_{{{b}}}\\left(\\dfrac{{1}}{{{b ** n}}}\\right)"
    chk = math.log(b ** m, b) + sign * math.log(1 / b ** n, b); agree(chk, val, 1e-9, "log")
    key, ds = num_options(float(val), [(f"Treats $\\log_{{{b}}}\\left(\\dfrac{{1}}{{{b ** n}}}\\right)$ as ${n}$ instead of ${-n}$, giving ${m}{'+' if sign > 0 else '-'}{n}={m + sign * n}$.", float(m + sign * n)), (f"Reverses the sign of the whole result, giving ${-val}$.", float(-val)), (f"Multiplies the exponents ${m}$ and ${n}$ instead of combining the logarithm values.", float(m * n)), (f"Reports only the first logarithm, $\\log_{{{b}}}\\left({b ** m}\\right)={m}$.", float(m))], f=lambda v: f"${int(v)}$", tol=0.05)
    stem = f"What is the value of ${expr}$?"
    return MQ("pre_log_evaluate", "2.9", "1", "not_allowed", stem, key, ds, rng, "Logarithms undo exponentiation for the same base", ["Rewrite each argument as a power of the base", "Use that log_b(b^k)=k and combine the values"], "exact evaluation with sympy log simplification versus floating-point logarithms", f"$\\log_{{{b}}}{b ** m}={m}$ and $\\log_{{{b}}}(1/{b ** n})={-n}$, so the value is ${m}{'+' if sign > 0 else '-'}({-n})={val}$.", [f"b={b}", f"m={m}", f"n={n}", f"sign={sign}"], est=70)


@retry_sep
def pre_log_expand(rng):
    p = pick(rng, [2, 3, 4]); q = pick(rng, [2, 3, 5]); r = pick(rng, [1, 2, 3])
    expr = f"\\ln\\left(\\dfrac{{x^{p}\\sqrt{{y}}}}{{z^{{{r}}}}}\\right)" if q == 2 else f"\\ln\\left(\\dfrac{{x^{p}\\sqrt[{q}]{{y}}}}{{z^{{{r}}}}}\\right)"
    fr = "\\frac{1}{2}" if q == 2 else f"\\frac{{1}}{{{q}}}"
    key_t = f"${p}\\ln x+{fr}\\ln y-{r}\\ln z$"
    wr = [(f"${p}\\ln x\\cdot {fr}\\ln y-{r}\\ln z$", "Multiplies the logarithms of $x^{" + str(p) + "}$ and $y$ instead of adding them."), (f"${p}\\ln x+{fr}\\ln y+{r}\\ln z$", f"Adds ${r}\\ln z$ although $z^{{{r}}}$ is in the denominator, which requires subtraction."), (f"$\\ln\\left({p}x\\right)+{fr}\\ln y-{r}\\ln z$", f"Writes $\\ln x^{{{p}}}$ as $\\ln({p}x)$ instead of ${p}\\ln x$."), (f"${p}\\ln x+{q}\\ln y-{r}\\ln z$", f"Replaces the exponent {fr} on $y$ by {q}.".replace("\\frac{1}{" + str(q) + "}", f"1/{q}"))]
    key, ds = text_options(key_t, f"The quotient rule gives $\\ln(x^{{{p}}}\\sqrt[{q}]{{y}})-\\ln(z^{{{r}}})$, the product rule splits the first term, and the power rule gives ${p}\\ln x+{fr}\\ln y-{r}\\ln z$.", wr)
    stem = f"For positive $x$, $y$ and $z$, which of the following is equivalent to ${expr}$?"
    chk = lambda x_, y_, z_: math.log(x_ ** p * y_ ** (1 / q) / z_ ** r) - (p * math.log(x_) + math.log(y_) / q - r * math.log(z_))  # noqa: E731
    agree(chk(1.7, 2.3, 3.1), 0.0, 1e-9, "expand")
    return MQ("pre_log_expand", "2.12", "1", "not_allowed", stem, key, ds, rng, "Logarithm properties expand products, quotients and powers", ["Apply the quotient rule to separate numerator and denominator", "Apply the product and power rules, writing the root as a fractional exponent"], "numerical evaluation of both sides at a test point", f"The expansion is {key_t}.", [f"p={p}", f"q={q}", f"r={r}"], est=95)


@retry_sep
def pre_exp_equation_exact(rng):
    b = pick(rng, [2, 3, 5]); m = pick(rng, [2, 3, 4]); c = pick(rng, [-3, -1, 1, 2, 5]); a = pick(rng, [2, 3, 4]); sol = sp.Rational(m * 1 + 0) if False else None
    for _ in forever():
        x0 = pick(rng, [-2, -1, 1, 2, 3, 4]); e = a * x0 + c
        if e >= 0 and e <= 5:
            break
    rhs = b ** e if e >= 0 else sp.Rational(1, b ** -e)
    key, ds = num_options(float(x0), [("Divides the exponent by the base instead of equating exponents.", float(sp.Rational(e, b))), ("Equates the base to the right side.", float(b)), (f"Forgets to subtract the constant before dividing by {a}.", float(sp.Rational(e, a))), ("Adds the constant instead of subtracting.", float(sp.Rational(e + c, a)))], f=lambda v: f"${int(v)}$" if abs(v - round(v)) < 1e-9 else rat_tex(v), tol=0.05)
    stem = f"What is the solution of the equation ${b}^{{{a}x{'+' if c >= 0 else '-'}{abs(c)}}}={rhs}$?"
    chk = b ** (a * x0 + c); agree(float(chk), float(rhs), 1e-9, "eq")
    del sol
    return MQ("pre_exp_equation_exact", "2.13", "1", "not_allowed", stem, key, ds, rng, "Exponential equations with a common base reduce to equal exponents", ["Write both sides as powers of the same base", "Set the exponents equal and solve the linear equation"], "substitution of the solution back into the exponential expression", f"${rhs}={b}^{{{e}}}$, so ${a}x{'+' if c >= 0 else '-'}{abs(c)}={e}$ and $x={x0}$.", [f"b={b}", f"a={a}", f"c={c}", f"x0={x0}"], est=85)


@retry_sep
def pre_log_equation_extraneous(rng):
    for _ in forever():
        r1, r2 = rng.sample([1, 2, 3, 4, 5, 6], 2)
        # ln(x - p) + ln(x - q) = ln(c) 에서 하나는 정의역 밖
        p = pick(rng, [1, 2, 3]); q = p + pick(rng, [1, 2]); xs = sp.symbols("x"); c0 = None
        sol = [s for s in sp.solve(sp.expand((xs - p) * (xs - q) - sp.Integer(0)), xs)]
        z = pick(rng, [2, 3, 4, 5]); c0 = (z - p) * (z - q)
        if c0 > 0 and c0 <= 20:
            break
    roots = sp.solve(sp.expand((xs - p) * (xs - q) - c0), xs); valid = [r for r in roots if r > q]; assert len(valid) == 1
    ans = valid[0]; other = [r for r in roots if r != ans][0]
    key, ds = num_options(float(ans), [("Includes the extraneous solution as the answer.", float(other)), ("Sets each factor equal to the right side separately.", float(c0 + p)), ("Adds the roots instead of selecting the valid one.", float(ans + other)), ("Solves $x-p=c$ only.", float(c0 + q))], f=lambda v: f"${int(v)}$" if abs(v - round(v)) < 1e-9 else rat_tex(v), tol=0.05)
    stem = f"What is the solution of the equation $\\ln(x-{p})+\\ln(x-{q})=\\ln({c0})$?"
    return MQ("pre_log_equation_extraneous", "2.13", "1", "not_allowed", stem, key, ds, rng, "Logarithmic equations require checking the domain", ["Combine the logarithms with the product rule and equate the arguments", "Solve the quadratic and reject any solution outside the domain"], "substituting each root back into the original logarithmic equation exposes the extraneous one", f"The quadratic $(x-{p})(x-{q})={c0}$ has roots ${L(ans)}$ and ${L(other)}$; only $x={L(ans)}$ keeps both arguments positive.", [f"p={p}", f"q={q}", f"c0={c0}"], est=110)


@retry_sep
def pre_exp_inverse_log(rng):
    a = pick(rng, [2, 3, 5]); b = pick(rng, [2, 3, 4]); k0 = pick(rng, [-3, -1, 1, 4])
    f = lambda v: a * b ** v + k0  # noqa: E731
    inv = lambda y: math.log((y - k0) / a, b)  # noqa: E731
    agree(inv(f(1.3)), 1.3, 1e-9, "inverse")
    fn = lambda s: f"$f^{{-1}}(x)={s}$"  # noqa: E731
    key, ds = text_options(fn(f"\\log_{{{b}}}\\left(\\dfrac{{x{'-' if k0 > 0 else '+'}{abs(k0)}}}{{{a}}}\\right)"), "Isolate the exponential term, then apply the logarithm with the same base.", [(fn(f"\\log_{{{b}}}\\left(\\dfrac{{x}}{{{a}}}\\right){'-' if k0 > 0 else '+'}{abs(k0)}"), "Applies the vertical shift after the logarithm."), (fn(f"\\log_{{{b}}}(x{'-' if k0 > 0 else '+'}{abs(k0)})-\\log_{{{b}}}({a})") if False else fn(f"\\log_{{{b}}}\\left(x{'-' if k0 > 0 else '+'}{abs(k0)}\\right)"), "Forgets to divide by the vertical stretch."), (fn(f"{b}^{{\\left(x{'-' if k0 > 0 else '+'}{abs(k0)}\\right)/{a}}}"), "Writes an exponential instead of a logarithm."), (fn(f"\\dfrac{{\\log_{{{b}}}\\left(x{'-' if k0 > 0 else '+'}{abs(k0)}\\right)}}{{{a}}}"), "Divides the logarithm instead of the argument.")])
    stem = f"The function $f$ is defined by $f(x)={a}\\cdot {b}^x{'+' if k0 > 0 else '-'}{abs(k0)}$. Which of the following is $f^{{-1}}(x)$?"
    return MQ("pre_exp_inverse_log", "2.10", "1", "not_allowed", stem, key, ds, rng, "The inverse of an exponential function is a logarithmic function", ["Solve y = a b^x + k for the exponential term", "Take the logarithm with base b and swap the variables"], "numerical composition of the proposed inverse with f returns the input", f"Solving gives $f^{{-1}}(x)=\\log_{{{b}}}\\left(\\dfrac{{x{'-' if k0 > 0 else '+'}{abs(k0)}}}{{{a}}}\\right)$.", [f"a={a}", f"b={b}", f"k={k0}"], est=100)


@retry_sep
def pre_log_graph_features(rng):
    b = pick(rng, [2, 3, 5]); h0 = pick(rng, [-3, -2, -1, 1, 2, 4]); k0 = pick(rng, [-3, -1, 2, 4]); mode = pick(rng, ["va", "domain", "zero_x"])
    if mode == "va":
        key, ds = text_options(f"$x={h0}$", "The argument of the logarithm must be positive, so the asymptote is where the argument is 0.", [(f"$x={-h0}$", "Reverses the sign of the horizontal shift."), (f"$x={k0}$", "Uses the vertical shift as the asymptote."), (f"$y={h0}$", "Gives a horizontal line instead of a vertical asymptote."), (f"$x={h0 + k0}$", "Adds the two shifts.")])
        ask = "Which of the following is the vertical asymptote of the graph of $g$?"
    elif mode == "domain":
        key, ds = text_options(f"$x>{h0}$", "The argument x - h must be positive.", [(f"$x>{-h0}$", "Reverses the sign of the horizontal shift."), (f"$x\\ge {h0}$", "Includes the boundary where the logarithm is undefined."), (f"$x>{k0}$", "Uses the vertical shift."), (f"$x<{h0}$", "Reverses the inequality.")])
        ask = "What is the domain of $g$?"
    else:
        x0 = h0 + sp.Rational(1, b ** 1) if False else None
        zx = h0 + b ** (-k0) if -k0 >= 0 else h0 + sp.Rational(1, b ** k0)
        key, ds = num_options(float(zx), [("Sets the argument equal to 1 instead of $b^{-k}$.", float(h0 + 1)), ("Forgets the horizontal shift.", float(b ** (-k0)) if -k0 >= 0 else float(sp.Rational(1, b ** k0))), ("Reverses the sign of the horizontal shift.", float(-h0 + (b ** (-k0) if -k0 >= 0 else sp.Rational(1, b ** k0)))), ("Uses the vertical shift as the zero.", float(-k0))], f=rat_tex, tol=0.05)
        ask = "What is the $x$-intercept of the graph of $g$?"
        del x0
    stem = f"The function $g$ is defined by $g(x)=\\log_{{{b}}}(x{'-' if h0 > 0 else '+'}{abs(h0)}){'+' if k0 > 0 else '-'}{abs(k0)}$. {ask}"
    return MQ("pre_log_graph_features", "2.11", "2", "not_allowed", stem, key, ds, rng, "Transformed logarithmic functions have a shifted vertical asymptote and domain", ["Identify the horizontal and vertical shifts", "Use the argument's positivity for the asymptote and domain, or solve g(x)=0 for the intercept"], "numerical evaluation of g near the boundary and at the claimed intercept", f"The answer follows from the shift of the logarithm's argument by {h0} and the vertical shift by {k0}.", [f"b={b}", f"h={h0}", f"k={k0}", f"mode={mode}"], est=85)


@retry_sep
def pre_semilog_model(rng):
    a = pick(rng, [2, 3, 5, 10]); b = pick(rng, [2, 3, 10]); x1, x2 = 1, 4
    y1 = a * b ** x1; y2 = a * b ** x2; L1 = math.log10(y1); L2 = math.log10(y2); slope = (L2 - L1) / (x2 - x1); agree(slope, math.log10(b), 1e-9, "slope")
    key, ds = text_options(f"$y={a}\\cdot {b}^{{x}}$", "On a semi-log plot, a line means exponential growth: the slope is $\\log_{10} b$ and the vertical intercept is $\\log_{10} a$.", [(f"$y={a}\\cdot {b}x$", "Treats the straight line as a linear model of $y$."), (f"$y={y1}\\cdot {b}^{{x}}$", "Uses the output at $x=1$ as the initial value."), (f"$y={a}\\cdot {b * a}^{{x}}$", "Uses the wrong growth factor."), (f"$y={b}\\cdot {a}^{{x}}$", "Swaps the initial value and the growth factor.")])
    stim = table_stim("Points on a semi-log plot of $\\log_{10} y$ against $x$", "x", "\\log_{10} y", [(x1, f"{L1:.4f}"), (x2, f"{L2:.4f}")])
    stem = f"A straight line on a semi-logarithmic plot passes through the points $(1, \\log_{{10}}{y1})$ and $(4, \\log_{{10}}{y2})$, where the vertical axis is $\\log_{{10}} y$. Which of the following could be the function $y(x)$ modeled?"
    del stim
    return MQ("pre_semilog_model", "2.15", "2", "not_allowed", stem, key, ds, rng, "A line on a semi-log plot represents an exponential function", ["Use the two points to find the slope of the line in log scale", "Convert the line back to an exponential function of x"], "slope and intercept computed numerically from the base-10 logarithms of the two outputs", f"The slope is $\\log_{{10}} {b}$ and the intercept is $\\log_{{10}} {a}$, so $y={a}\\cdot {b}^x$.", [f"a={a}", f"b={b}"], est=100)


@retry_sep
def pre_linear_vs_exp_table(rng):
    kind = pick(rng, ["linear", "exp"]); xs = list(range(0, 5)); base = pick(rng, [3, 5, 8]); d = pick(rng, [2, 3, 4]); r = pick(rng, [2, 3])
    ys = [base + d * v for v in xs] if kind == "linear" else [base * r ** v for v in xs]
    d1 = [ys[i + 1] - ys[i] for i in range(4)]; q1 = [ys[i + 1] // ys[i] if ys[i + 1] % ys[i] == 0 else round(ys[i + 1] / ys[i], 2) for i in range(4)]
    ans = {"linear": "A linear model, because the outputs change by a constant amount over equal input steps.", "exp": "An exponential model, because the outputs change by a constant factor over equal input steps."}
    kwhy = {"linear": f"The differences of successive outputs {', '.join(map(str, d1))} are all equal, so a linear model fits.", "exp": f"The ratios of successive outputs {', '.join(map(str, q1))} are all equal, so an exponential model fits."}
    other = "exp" if kind == "linear" else "linear"
    wrongs = [(ans[other], f"The {'ratios' if other == 'exp' else 'differences'} {', '.join(map(str, q1 if other == 'exp' else d1))} are not all equal, so this model does not fit."), ("A quadratic model, because the outputs always increase.", f"Increasing outputs do not make the data quadratic: the {'second differences' if kind == 'linear' else 'ratios'} show the actual pattern."), ("Neither a linear nor an exponential model, because the outputs are not decreasing.", "The direction of change does not rule out either model; the pattern of differences or ratios does.")]
    key, ds = text_options(ans[kind], kwhy[kind], wrongs)
    stim = table_stim("Values of a quantity $y$ at equally spaced inputs $x$", "x", "y", list(zip(xs, ys)))
    stem = "The table gives values of $y$ at equally spaced values of $x$. Which model is most appropriate for the data, and why?"
    return MQ("pre_linear_vs_exp_table", "2.2", "2", "not_allowed", stem, key, ds, rng, "Linear functions have constant differences; exponential functions have constant ratios", ["Compute successive differences and successive ratios of the outputs", "Choose the family whose pattern is constant"], "numpy diff and ratio arrays of the generating values", kwhy[kind], [f"kind={kind}", f"ys={ys}"], stim=stim, est=80, mat=MAT_TABLE("the table values"))