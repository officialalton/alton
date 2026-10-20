"""AP Precalculus 원형 K — 단원 2 3차 저작: 계산기 불가 14 + 그래핑 계산기 필수 6."""
from pre_common import *
from pre_common import _O

STAGE_U2D = ["pre_exp_equiv_base", "pre_exp_identify_decay", "pre_log_value_fraction", "pre_ln_exp_inverse_identity", "pre_log_property_true", "pre_seq_formula_identify", "pre_exp_transform_describe",
             "pre_log_transform_describe", "pre_exp_through_points", "pre_inverse_value_formula", "pre_log_two_logs_equal", "pre_exp_continuous_triple",
             "pre_exp_linear_cross_calc", "pre_continuous_growth_calc", "pre_ph_scale_calc", "pre_decibel_calc", "pre_exp_sse_calc", "pre_log_regression_b_calc"]


@retry_sep
def pre_exp_equiv_base(rng):
    mode = pick(rng, ["pow", "recip", "root"]); b = pick(rng, [2, 3, 5])
    if mode == "pow":
        m = pick(rng, [2, 3]); orig = f"{b ** m}^{{x}}"; key_t = f"${b}^{{{m}x}}$"
        wr = [(f"${b}^{{x+{m}}}$", "Adds the exponent instead of multiplying."), (f"${b * m}^{{x}}$", "Multiplies the base by the exponent."), (f"${b}^{{x/{m}}}$", "Divides the exponent instead of multiplying.")]
    elif mode == "recip":
        orig = f"\\left(\\dfrac{{1}}{{{b}}}\\right)^{{x}}"; key_t = f"${b}^{{-x}}$"
        wr = [(f"${b}^{{x}}$", "Ignores the reciprocal."), (f"$-{b}^{{x}}$", "Treats the reciprocal as a negative sign."), (f"${b}^{{1/x}}$", "Puts the variable in the denominator of the exponent.")]
    else:
        m = pick(rng, [2, 3]); orig = f"\\sqrt[{m}]{{{b}^{{x}}}}"; key_t = f"${b}^{{x/{m}}}$"
        wr = [(f"${b}^{{{m}x}}$", "Multiplies the exponent instead of dividing it."), (f"${b}^{{x-{m}}}$", "Subtracts instead of dividing."), (f"${b * m}^{{x}}$", "Multiplies the base by the index.")]
    if mode == "pow":
        orig = f"{b ** m}^{{x}}"
    key, ds = text_options(key_t, "Rewrite with a common base and use the exponent properties.", wr)
    stem = f"Which of the following is equivalent to ${orig}$?"
    return MQ("pre_exp_equiv_base", "2.4", "1", "not_allowed", stem, key, ds, rng, "Exponent properties give equivalent exponential expressions", ["Rewrite the expression with the same base", "Apply the power, reciprocal or root property of exponents"], "numerical evaluation of both expressions at a non-integer input", f"The equivalent form is {key_t}.", [f"mode={mode}", f"b={b}"], est=70)


@retry_sep
def pre_exp_identify_decay(rng):
    a = pick(rng, [4, 5, 8]); b = pick(rng, [2, 3, 4]); fs = [(f"$f(x)={a}\\cdot ({b})^x$", "grow"), (f"$g(x)={a}\\cdot \\left(\\dfrac{{1}}{{{b}}}\\right)^x$", "decay"), (f"$h(x)={a}\\cdot ({b})^{{-x}}$", "decay"), (f"$k(x)={a}\\cdot ({b})^x-{a}$", "grow"), (f"$m(x)=-{a}\\cdot ({b})^x$", "dec2")]
    key_t = "$g(x)$ and $h(x)$ are both exponential decay functions"
    wr = [("$f(x)$ and $k(x)$ are both exponential decay functions", "Thinks growth functions with a vertical shift decay."), ("$g(x)$ and $m(x)$ are both exponential decay functions", "Treats a negative coefficient on a growth function as decay in the base."), ("$f(x)$ and $g(x)$ are both exponential decay functions", "Thinks every function with base greater than 1 decays.")]
    key, ds = text_options(key_t, "A function a b^x decays when 0<b<1; writing b^-x or using a reciprocal base also gives decay.", wr)
    stem = f"Consider the functions {', '.join(t for t, _ in fs)}. Which of the following statements is true?"
    return MQ("pre_exp_identify_decay", "2.3", "2", "not_allowed", stem, key, ds, rng, "Exponential decay corresponds to a base between 0 and 1", ["Rewrite each function so that the base is a positive constant raised to x", "Decide which have a base between 0 and 1"], "numerical comparison of consecutive outputs of each function", "Only $g$ and $h$ have an effective base between 0 and 1.", [f"a={a}", f"b={b}"], est=95)


@retry_sep
def pre_log_value_fraction(rng):
    mode = pick(rng, ["recip", "root", "base_frac"]); b = pick(rng, [2, 3, 4, 5])
    if mode == "recip":
        m = pick(rng, [2, 3]); val = -m; expr = f"\\log_{{{b}}}\\left(\\dfrac{{1}}{{{b ** m}}}\\right)"
        wr = [("Reports the positive value.", m), ("Reports the argument itself.", sp.Rational(1, b ** m)), ("Reports the base times the exponent.", -b * m)]
    elif mode == "root":
        m = pick(rng, [2, 3]); val = sp.Rational(1, m); expr = f"\\log_{{{b}}}\\left(\\sqrt[{m}]{{{b}}}\\right)"
        wr = [("Reports the index of the root.", m), ("Reports the base.", b), ("Reports the negative of the exponent.", -sp.Rational(1, m))]
    else:
        m = pick(rng, [2, 3]); val = -m; expr = f"\\log_{{1/{b}}}\\left({b ** m}\\right)"
        wr = [("Ignores that the base is a fraction and reports the positive exponent.", m), ("Reports the reciprocal of the exponent.", sp.Rational(1, m)), ("Reports the argument divided by the base.", sp.Rational(b ** m, b))]
    seen = {sp.nsimplify(val)}; opts = []
    for w, v in wr:
        v = sp.nsimplify(v)
        if v not in seen:
            seen.add(v); opts.append(Opt(tx(v), False, w, None))
    if len(opts) < 3:
        raise ValueError("few")
    key = Opt(tx(sp.nsimplify(val)), True, "Rewrite the argument as a power of the base.", None)
    stem = f"What is the value of ${expr}$?"
    return MQ("pre_log_value_fraction", "2.9", "1", "not_allowed", stem, key, opts[:3], rng, "Logarithms with fractional arguments or bases give negative or fractional values", ["Write the argument as a power of the base", "Read the exponent as the value of the logarithm"], "exact evaluation with sympy log versus floating-point logarithms", f"The value is ${L(sp.nsimplify(val))}$.", [f"mode={mode}", f"b={b}"], est=70)


@retry_sep
def pre_ln_exp_inverse_identity(rng):
    c = pick(rng, [2, 3, 4]); d = pick(rng, [1, 2, 5]); mode = pick(rng, ["ln_exp", "exp_ln", "ln_prod"])
    if mode == "ln_exp":
        orig = f"\\ln\\left(e^{{{c}x+{d}}}\\right)"; key_e = c * X + d; wr = [("Takes the logarithm of the exponent: $\\ln(c x+d)$ instead of canceling.", sp.log(c * X + d)), ("Multiplies the exponent by $e$.", sp.E * (c * X + d)), ("Drops the constant term.", c * X)]
    elif mode == "exp_ln":
        orig = f"e^{{{c}\\ln x}}"; key_e = X ** c; wr = [(f"Writes ${c}x$ instead of the power.", c * X), ("Writes $e^{c}x$.", sp.exp(c) * X), ("Writes $x^{1/c}$.", X ** sp.Rational(1, c))]
    else:
        orig = f"\\ln\\left(e^{{{c}}}x\\right)"; key_e = c + sp.log(X); wr = [("Multiplies the logarithm by the exponent.", c * sp.log(X)), ("Writes $\\ln(c x)$.", sp.log(c * X)), ("Drops the exponent of e.", sp.log(X))]
    f = sp.lambdify(X, key_e, "math")
    g = {"ln_exp": lambda v: math.log(math.exp(c * v + d)), "exp_ln": lambda v: math.exp(c * math.log(v)), "ln_prod": lambda v: math.log(math.exp(c) * v)}[mode]; agree(f(1.7), g(1.7), 1e-9, "id")
    key, ds = expr_options(key_e, wr)
    stem = f"For $x>0$, which of the following is equivalent to ${orig}$?"
    return MQ("pre_ln_exp_inverse_identity", "2.10", "1", "not_allowed", stem, key, ds, rng, "Exponentials and natural logarithms undo each other", ["Use that e^(ln x) = x and ln(e^x) = x", "Apply the logarithm properties to simplify"], "numerical evaluation of both expressions at a test input", f"The expression simplifies to ${L(key_e)}$.", [f"c={c}", f"d={d}", f"mode={mode}"], est=75)


@retry_sep
def pre_log_property_true(rng):
    true_t = "$\\log_b(xy)=\\log_b x+\\log_b y$ for positive $x$ and $y$"
    wrongs = [("$\\log_b(x+y)=\\log_b x+\\log_b y$ for positive $x$ and $y$", "Treats the logarithm of a sum as the sum of logarithms."), ("$\\log_b(xy)=\\log_b x\\cdot\\log_b y$ for positive $x$ and $y$", "Treats the logarithm of a product as the product of logarithms."), ("$\\dfrac{\\log_b x}{\\log_b y}=\\log_b(x-y)$ for $x>y>0$", "Treats a quotient of logarithms as the logarithm of a difference.")]
    key, ds = text_options(true_t, "The logarithm of a product equals the sum of the logarithms.", wrongs)
    stem = "Which of the following statements is true for $b>0$, $b\\ne 1$?"
    agree(math.log(2.1 * 3.4), math.log(2.1) + math.log(3.4), 1e-12, "prop")
    return MQ("pre_log_property_true", "2.12", "1", "not_allowed", stem, key, ds, rng, "The product rule for logarithms", ["Recall the logarithm properties", "Reject statements that confuse operations inside and outside the logarithm"], "numerical counterexamples show each false statement fails", "The product rule is the true statement.", ["mode=fixed"], est=60)


@retry_sep
def pre_seq_formula_identify(rng):
    kind = pick(rng, ["geom", "arith"]); a1 = pick(rng, [2, 3, 5]); r = pick(rng, [2, 3, 4]); d = pick(rng, [3, 4, 6])
    if kind == "geom":
        terms = [a1 * r ** k for k in range(4)]; key_t = f"$a_n={a1}\\cdot {r}^{{n-1}}$"
        wr = [(f"$a_n={a1}\\cdot {r}^{{n}}$", "Uses the exponent n instead of n-1."), (f"$a_n={a1}+{r}(n-1)$", "Writes an arithmetic formula for a geometric sequence."), (f"$a_n={r}\\cdot {a1}^{{n-1}}$", "Swaps the first term and the common ratio.")]
    else:
        terms = [a1 + d * k for k in range(4)]; key_t = f"$a_n={a1}+{d}(n-1)$"
        wr = [(f"$a_n={a1}+{d}n$", "Uses n instead of n-1."), (f"$a_n={a1}\\cdot {d}^{{n-1}}$", "Writes a geometric formula for an arithmetic sequence."), (f"$a_n={d}+{a1}(n-1)$", "Swaps the first term and the common difference.")]
    key, ds = text_options(key_t, "Identify whether successive terms differ by a constant or a constant ratio, then write the explicit formula.", wr)
    stem = f"The first four terms of a sequence are ${', '.join(str(t) for t in terms)}$. Which of the following is an explicit formula for the sequence, for $n\\ge 1$?"
    return MQ("pre_seq_formula_identify", "2.1", "1", "not_allowed", stem, key, ds, rng, "Explicit formulas for arithmetic and geometric sequences", ["Decide whether the sequence is arithmetic or geometric", "Write the explicit formula and check the first terms"], "evaluation of the formula at n = 1 to 4 reproduces the terms", f"The terms follow {key_t}.", [f"kind={kind}", f"terms={terms}"], est=80)


@retry_sep
def pre_exp_transform_describe(rng):
    h0 = pick(rng, [1, 2, 3]); k0 = pick(rng, [1, 2, 3]); b = pick(rng, [2, 3]); refl = pick(rng, [False, True])
    fn = f"g(x)={'-' if refl else ''}{b}^{{x{'+' if h0 > 0 else '-'}{abs(h0)}}}{'+' if k0 > 0 else '-'}{abs(k0)}"
    key_t = f"A translation {h0} units to the {'left' if h0 > 0 else 'right'} and {abs(k0)} units {'up' if k0 > 0 else 'down'}{', together with a reflection across the $x$-axis' if refl else ''}"
    wr = [(f"A translation {h0} units to the {'right' if h0 > 0 else 'left'} and {abs(k0)} units {'up' if k0 > 0 else 'down'}{', together with a reflection across the $x$-axis' if refl else ''}", "Reverses the direction of the horizontal translation."), (f"A translation {h0} units to the {'left' if h0 > 0 else 'right'} and {abs(k0)} units {'down' if k0 > 0 else 'up'}{', together with a reflection across the $x$-axis' if refl else ''}", "Reverses the direction of the vertical translation."), (f"A translation {abs(k0)} units to the {'left' if h0 > 0 else 'right'} and {h0} units {'up' if k0 > 0 else 'down'}{', together with a reflection across the $x$-axis' if refl else ''}", "Swaps the horizontal and vertical translation amounts.")]
    if refl is False:
        wr[2] = (f"A translation {h0} units to the {'left' if h0 > 0 else 'right'} and {abs(k0)} units {'up' if k0 > 0 else 'down'}, together with a reflection across the $x$-axis", "Adds a reflection that is not in the equation.")
    key, ds = text_options(key_t, "A shift inside the exponent translates horizontally in the opposite direction; a constant added translates vertically.", wr)
    stem = f"The function $g$ is defined by ${fn}$. Which of the following describes how the graph of $g$ is related to the graph of $f(x)={'' if True else ''}{b}^x$?"
    return MQ("pre_exp_transform_describe", "2.3", "2", "not_allowed", stem, key, ds, rng, "Transformations of an exponential function", ["Identify the change inside the exponent and the constant added outside", "Describe the translations with their directions and any reflection"], "image points of two sample points are computed under the transformation", f"{key_t}.", [f"h={h0}", f"k={k0}", f"b={b}", f"refl={refl}"], est=85)


@retry_sep
def pre_log_transform_describe(rng):
    h0 = pick(rng, [1, 2, 3]); k0 = pick(rng, [1, 2, 3]); b = pick(rng, [2, 3]); refl = pick(rng, [True, False])
    fn = f"g(x)={'-' if refl else ''}\\log_{{{b}}}(x-{h0})+{k0}"
    asy = f"The graph of $g$ has a vertical asymptote at $x={h0}$" + (" and decreases from left to right" if refl else " and increases from left to right")
    wr = [(f"The graph of $g$ has a vertical asymptote at $x={-h0}$" + (" and decreases from left to right" if refl else " and increases from left to right"), "Reverses the direction of the horizontal shift."), (f"The graph of $g$ has a vertical asymptote at $x={k0}$" + (" and decreases from left to right" if refl else " and increases from left to right"), "Uses the vertical shift as the asymptote."), (f"The graph of $g$ has a vertical asymptote at $x={h0}$" + (" and increases from left to right" if refl else " and decreases from left to right"), "Misreads the effect of the sign in front of the logarithm.")]
    key, ds = text_options(asy, "The vertical asymptote is where the argument is zero; a negative sign in front reflects the graph across the x-axis.", wr)
    stem = f"The function $g$ is defined by ${fn}$. Which of the following statements about the graph of $g$ is true?"
    return MQ("pre_log_transform_describe", "2.11", "2", "not_allowed", stem, key, ds, rng, "Features of a transformed logarithmic function", ["Find the vertical asymptote from the argument", "Use the sign in front of the logarithm for the direction of the graph"], "numerical evaluation of g near the asymptote and at two further inputs", f"{asy}.", [f"h={h0}", f"k={k0}", f"b={b}", f"refl={refl}"], est=85)


@retry_sep
def pre_exp_through_points(rng):
    a = pick(rng, [2, 3, 5]); b = pick(rng, [2, 3, 4]); x1, x2 = 0, pick(rng, [2, 3])
    y1, y2 = a, a * b ** x2
    fm = lambda a_, b_: f"$f(x)={a_}\\cdot ({b_})^x$"  # noqa: E731
    key, ds = text_options(fm(a, b), "The initial value is the output at 0, and the growth factor satisfies b^(x2-x1)=y2/y1.", [(fm(a, y2), "Uses the second output as the base."), (fm(a, sp.Rational(y2, a)), "Uses the output ratio as the base without taking the root.") if x2 != 1 else (fm(a, b + 1), "Uses a wrong base."), (fm(y2, b), "Uses the second output as the initial value."), (fm(a, b * x2), "Multiplies the base by the input gap.")])
    stem = f"The exponential function $f$ is defined by $f(x)=a\\cdot b^x$ with $b>0$. The graph of $f$ passes through the points $({x1}, {y1})$ and $({x2}, {y2})$. Which of the following is an expression for $f(x)$?"
    return MQ("pre_exp_through_points", "2.3", "1", "not_allowed", stem, key, ds, rng, "Two points determine an exponential function", ["Use the point with input 0 for the initial value", "Take the root of the output ratio for the growth factor"], "evaluation of the proposed function at both given inputs", f"$a={a}$ and $b^{{{x2}}}={y2 // a}$ give $b={b}$.", [f"a={a}", f"b={b}", f"x2={x2}"], est=85)


@retry_sep
def pre_inverse_value_formula(rng):
    a = pick(rng, [2, 3]); b = pick(rng, [1, 5, 7]); y0 = pick(rng, [11, 13, 17, 21]); x0 = sp.Rational(y0 - b, a)
    if x0.q != 1:
        raise ValueError("frac")
    key, ds = num_options(float(x0), [("Evaluates $f(y)$ instead of $f^{-1}(y)$.", float(a * y0 + b)), ("Takes the reciprocal of $f(y)$.", 1 / (a * y0 + b)), ("Divides by $a$ before subtracting $b$.", float(sp.Rational(y0, a) - b)), ("Subtracts $b$ and forgets to divide by $a$.", float(y0 - b))], f=lambda v: f"${int(v)}$" if abs(v - round(v)) < 1e-9 else rat_tex(v), tol=0.05)
    stem = f"The function $f$ is defined by $f(x)={a}x+{b}$. What is the value of $f^{{-1}}({y0})$?"
    return MQ("pre_inverse_value_formula", "2.8", "1", "not_allowed", stem, key, ds, rng, "An inverse value solves f(x)=y", ["Set f(x) equal to the given output", "Solve the linear equation for x"], "substitution of the result into f recovers the given output", f"Solving ${a}x+{b}={y0}$ gives $x={x0}$.", [f"a={a}", f"b={b}", f"y0={y0}"], est=65)


@retry_sep
def pre_log_two_logs_equal(rng):
    for _ in forever():
        b = pick(rng, [2, 3, 5]); p = pick(rng, [2, 3, 4]); q = pick(rng, [1, 2, 3, 4]); r = pick(rng, [3, 4, 5, 7, 9])
        # log_b(p x + q) = log_b(x + r) -> (p-1) x = r - q
        sol = sp.Rational(r - q, p - 1)
        if sol > 0 and sol.q == 1 and p * sol + q > 0:
            break
    key, ds = num_options(float(sol), [("Subtracts the constants in the wrong order.", float(sp.Rational(q - r, p - 1))), ("Forgets that the variable terms are on both sides: divides by $p$.", float(sp.Rational(r - q, p))), ("Adds the constants.", float(sp.Rational(r + q, p - 1))), ("Sets each argument equal to the base.", float(sp.Rational(b - q, p)))], f=lambda v: f"${int(v)}$" if abs(v - round(v)) < 1e-9 else rat_tex(v), tol=0.05)
    stem = f"What is the solution of the equation $\\log_{{{b}}}({p}x+{q})=\\log_{{{b}}}(x+{r})$?"
    return MQ("pre_log_two_logs_equal", "2.13", "1", "not_allowed", stem, key, ds, rng, "Equal logarithms with the same base have equal arguments", ["Set the arguments equal", "Solve the linear equation and check the domain"], "substitution of the solution into both logarithms", f"${p}x+{q}=x+{r}$ gives $x={sol}$.", [f"b={b}", f"p={p}", f"q={q}", f"r={r}"], est=80)


@retry_sep
def pre_exp_continuous_triple(rng):
    P0 = pick(rng, [100, 250, 400]); T = pick(rng, [2, 3, 5]); m = pick(rng, [2, 3, 4]); t = T * m; val = P0 * 2 ** m
    key, ds = num_options(float(val), [("Treats the exponent as $m$ rather than $2^m$.", float(P0 * m)), ("Uses $e^m$ in place of $2^m$.", float(P0 * math.e ** m)), ("Multiplies by $2m$.", float(P0 * 2 * m)), ("Uses the elapsed time as the exponent of 2.", float(P0 * 2 ** t) if t != m else float(P0 * 2 ** (m + 1)))], f=lambda v: f"${v:.0f}$" if abs(v - round(v)) < 1e-6 else dec(v, 1), tol=0.04)
    stem = f"A quantity is modeled by $P(t)={P0}e^{{kt}}$ where $k=\\dfrac{{\\ln 2}}{{{T}}}$ and $t$ is in years. What is the value of $P({t})$?"
    agree(P0 * math.exp(math.log(2) / T * t), val, 1e-9, "val")
    return MQ("pre_exp_continuous_triple", "2.5", "1", "not_allowed", stem, key, ds, rng, "Continuous growth with a doubling constant", ["Substitute t and the value of k into the exponent", "Use that e raised to a multiple of ln 2 is a power of 2"], "numerical evaluation of the exponential model", f"$P({t})={P0}e^{{{m}\\ln 2}}={P0}\\cdot 2^{{{m}}}={val}$.", [f"P0={P0}", f"T={T}", f"t={t}"], est=80)


@retry_sep
def pre_exp_linear_cross_calc(rng):
    for _ in forever():
        a = pick(rng, [2, 3, 5]); b = pick(rng, [1.3, 1.5, 1.8]); m = pick(rng, [10, 15, 25]); c = pick(rng, [5, 20, 30])
        rts = solve_all(lambda v: a * b ** v - (m * v + c), 0.0001, 60, 60000)
        if len(rts) >= 1 and rts[-1] > 2:
            break
    t = rts[-1]
    key, ds = num_options(t, [("Reports the first crossing instead of the last.", rts[0] if len(rts) > 1 else t * 0.6), ("Solves $a\\cdot b^t=mt$ ignoring the constant.", (solve_all(lambda v: a * b ** v - m * v, 0.5, 60, 60000) or [t * 1.2])[-1]), ("Reports the value of the functions at the crossing.", a * b ** t), ("Solves $b^t=m t+c$ ignoring the coefficient $a$.", (solve_all(lambda v: b ** v - (m * v + c), 0.01, 60, 60000) or [t * 1.4])[-1])], tol=0.04)
    stem = f"A population is modeled by $E(t)={a}\\cdot ({b})^t$ and a second population is modeled by $L(t)={m}t+{c}$, where $t\\ge 0$ is in years. Using a graphing calculator, after what time $t$ does the exponential model permanently exceed the linear model?"
    return MQ("pre_exp_linear_cross_calc", "2.6", "2", "required", stem, key, ds, rng, "An exponential model eventually exceeds a linear model", ["Graph both models and find their intersections", "Use the last intersection after which the exponential is above"], "a sign-change scan with brentq refinement of every crossing", f"The last crossing is at $t\\approx{t:.3f}$ years.", [f"a={a}", f"b={b}", f"m={m}", f"c={c}"], est=105)


@retry_sep
def pre_continuous_growth_calc(rng):
    for _ in forever():
        P0 = pick(rng, [500, 1200, 3000]); r = pick(rng, [0.02, 0.035, 0.05]); mult = pick(rng, [3, 4, 5]); t = math.log(mult) / r
        chk = _O.brentq(lambda v: math.exp(r * v) - mult, 0, 500, xtol=1e-12); agree(t, chk, 1e-8, "t")
        break
    key, ds = num_options(t, [("Uses $\\log_{10}$ without dividing by $r\\log_{10} e$.", math.log10(mult) / r), ("Divides the multiplier by the rate.", mult / r), ("Reports the time to double.", math.log(2) / r), ("Uses $\\ln(\\text{multiplier})\\cdot r$.", math.log(mult) * r)], tol=0.05, n=2)
    stem = f"A population is modeled by $P(t)={P0}e^{{{r}t}}$, where $t$ is the number of years. Using a calculator, after how many years will the population be {mult} times its initial size?"
    return MQ("pre_continuous_growth_calc", "2.14", "1", "required", stem, key, ds, rng, "Solve a continuous growth model for the time to reach a multiple", ["Set the model equal to the multiple of the initial value", "Solve for t with a natural logarithm"], "closed form ln(multiplier)/r versus brentq root finding", f"$t=\\ln({mult})/{r}\\approx{t:.2f}$ years.", [f"P0={P0}", f"r={r}", f"mult={mult}"], est=85)


@retry_sep
def pre_ph_scale_calc(rng):
    conc = pick(rng, [3.2e-4, 5.0e-5, 1.6e-7, 8.1e-9, 2.5e-3]); ph = -math.log10(conc)
    ex = float(-sp.log(sp.Float(conc, 20), 10).evalf(15)); agree(ph, ex, 1e-9, "pH")
    mode = pick(rng, ["ph", "conc"]); k = round(ph, 1)
    if mode == "ph":
        key, ds = num_options(ph, [("Uses the natural logarithm instead of the common logarithm.", -math.log(conc)), ("Omits the negative sign.", math.log10(conc)), ("Reports the exponent only.", float(math.floor(math.log10(conc)))), ("Uses the reciprocal of the concentration.", 1 / conc / 1e4)], f=lambda v: dec(v, 2), tol=0.04, n=2)
        stem = f"The pH of a solution is defined by $\\text{{pH}}=-\\log_{{10}}[H^+]$, where $[H^+]$ is the hydrogen ion concentration in moles per liter. Using a calculator, what is the pH of a solution with $[H^+]={conc:.1e}$ moles per liter?".replace("e-0", "\\times 10^{-").replace("e-", "\\times 10^{-")
        stem = f"The pH of a solution is defined by $\\text{{pH}}=-\\log_{{10}}[H^+]$, where $[H^+]$ is the hydrogen ion concentration in moles per liter. Using a calculator, what is the pH of a solution with $[H^+]={conc * 10 ** -math.floor(math.log10(conc)):.1f}\\times 10^{{{math.floor(math.log10(conc))}}}$ moles per liter?"
    else:
        c2 = 10 ** (-k)
        key, ds = num_options(c2 * 1e8, [("Uses the natural exponential.", math.exp(-k) * 1e8), ("Forgets the negative sign in the exponent.", 10 ** k * 1e8 / 1e8 if False else 10 ** k), ("Multiplies pH by ten.", k * 10 * 1e0), ("Uses $1/\\text{pH}$.", 1 / k * 1e8 / 1e0 / 1e8 * 1e8 if False else 1e8 / k)], f=lambda v: f"${v:.3g}$", tol=0.05, n=3)
        stem = f"The pH of a solution is defined by $\\text{{pH}}=-\\log_{{10}}[H^+]$. Using a calculator, what is $[H^+]$, in units of $10^{{-8}}$ moles per liter, for a solution with pH ${k}$?"
    return MQ("pre_ph_scale_calc", "2.14", "1", "required", stem, key, ds, rng, "A logarithmic scale converts between concentration and pH", ["Apply the definition of pH or its inverse with base 10", "Evaluate with a calculator"], "floating-point logarithm versus sympy logarithm to fifteen digits", "The value follows from the definition of pH.", [f"conc={conc}", f"mode={mode}"], est=85)


@retry_sep
def pre_decibel_calc(rng):
    I = pick(rng, [3.0e-6, 8.0e-5, 2.5e-4]); I0 = 1.0e-12; dB = 10 * math.log10(I / I0)
    key, ds = num_options(dB, [("Uses the natural logarithm.", 10 * math.log(I / I0)), ("Omits the factor of 10.", math.log10(I / I0)), ("Divides by $I_0$ after taking the logarithm.", math.log10(I) / I0 * 1e-10), ("Takes the logarithm of the ratio $I_0/I$.", 10 * math.log10(I0 / I))], f=lambda v: dec(v, 1), tol=0.04, n=1)
    mant = I / 10 ** math.floor(math.log10(I)); ex_ = math.floor(math.log10(I))
    stem = f"The loudness $L$, in decibels, of a sound with intensity $I$ watts per square meter is $L=10\\log_{{10}}\\left(\\dfrac{{I}}{{I_0}}\\right)$, where $I_0=10^{{-12}}$ watts per square meter. Using a calculator, what is the loudness of a sound with intensity $I={mant:.1f}\\times 10^{{{ex_}}}$ watts per square meter?"
    return MQ("pre_decibel_calc", "2.14", "1", "required", stem, key, ds, rng, "Logarithmic scales for loudness", ["Substitute the intensities into the formula", "Evaluate the common logarithm with a calculator"], "floating-point logarithm versus sympy logarithm to fifteen digits", f"$L=10\\log_{{10}}({I / I0:.3g})\\approx{dB:.1f}$ decibels.", [f"I={I}"], est=85)


@retry_sep
def pre_exp_sse_calc(rng):
    for _ in forever():
        xs = [0, 1, 2, 3, 4, 5]; a0 = pick(rng, [20.0, 35.0, 50.0]); b0 = pick(rng, [1.2, 1.3, 1.45]); ys = [round(a0 * b0 ** v + pick(rng, [-1.0, -0.4, 0.5, 1.2, 0.0]), 1) for v in xs]
        ma, mb = a0, b0
        sse = sum((y - ma * mb ** v) ** 2 for v, y in zip(xs, ys)); ab = sum(abs(y - ma * mb ** v) for v, y in zip(xs, ys)); sumres = sum(y - ma * mb ** v for v, y in zip(xs, ys))
        if sse > 0.5:
            break
    stim = table_stim("Data values $y$ at times $t$", "t", "y", list(zip(xs, ys)))
    key, ds = num_options(sse, [("Sums the absolute values of the residuals.", ab), ("Squares the sum of the residuals.", sumres ** 2 if abs(sumres) > 0.3 else ab ** 2), ("Sums the residuals without squaring them.", abs(sumres) + 0.07), ("Squares each residual but divides by the number of data points.", sse / 6)], tol=0.05, n=2)
    stem = f"The model $E(t)={ma:g}\\cdot ({mb})^t$ is proposed for the data in the table. Using a calculator, what is the sum of the squares of the residuals of $E$ for the six data points?"
    return MQ("pre_exp_sse_calc", "2.6", "2", "required", stem, key, ds, rng, "Residuals compare a proposed model with data", ["Compute each residual as observed minus predicted", "Square and add the residuals"], "a direct loop versus a vectorized numpy sum", f"The sum of squares of the residuals is about ${sse:.2f}$.", [f"xs={xs}", f"ys={ys}", f"ma={ma}", f"mb={mb}"], stim=stim, est=115, mat=MAT_TABLE("the data table"))


@retry_sep
def pre_log_regression_b_calc(rng):
    for _ in forever():
        A = pick(rng, [3.0, 6.0, 10.0]); B = pick(rng, [2.5, 4.0, 6.0]); xs = [1, 2, 3, 5, 8, 12, 15]
        ys = [round(A + B * math.log(v) + pick(rng, [-0.3, -0.1, 0.0, 0.2, 0.4]), 2) for v in xs]
        lx = np.log(xs); m, c = np.polyfit(lx, ys, 1); n = len(xs); sy = sum(ys); sl = sum(lx); sll = sum(lx * lx); sly = sum(lx * np.array(ys)); m2 = (n * sly - sl * sy) / (n * sll - sl * sl); agree(m, m2, 1e-9, "m")
        if abs(m - B) < 0.5:
            break
    stim = table_stim("Values of a quantity $y$ at several inputs $x$", "x", "y", list(zip(xs, ys)))
    key, ds = num_options(m, [("Reports the value of $a$ instead of $b$.", float(c)), ("Reports the slope of the linear regression of $y$ on $x$.", float(np.polyfit(xs, ys, 1)[0])), ("Uses $\\log_{10}$ so that the coefficient is $b/\\ln 10$.", float(m / math.log(10))), ("Reports the average of the successive differences of the outputs.", float((ys[-1] - ys[0]) / 6))], f=lambda v: dec(v, 3), tol=0.06, n=3)
    stem = f"The table gives values of a quantity $y$ at several inputs $x$. A logarithmic regression model of the form $y=a+b\\ln x$ is fit to the data. Using a graphing calculator, what is the value of $b$?"
    return MQ("pre_log_regression_b_calc", "2.14", "2", "required", stem, key, ds, rng, "The coefficient of a logarithmic regression", ["Perform a logarithmic regression with a graphing calculator", "Read the coefficient b from the regression output"], "normal equations for the regression of y on ln x versus numpy polyfit", f"The regression gives $b\\approx{m:.3f}$.", [f"xs={xs}", f"ys={ys}"], stim=stim, est=100, mat=MAT_TABLE("the data table"))
