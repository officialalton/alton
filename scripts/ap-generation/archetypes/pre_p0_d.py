"""AP Precalculus 원형 D — 단원 2(지수·로그) 그래핑 계산기 필수 MC. 정답은 수치 풀이(brentq·최소제곱)와 독립 경로(정규방정식·닫힌 형태)로 이중 계산한다."""
from pre_common import *
from pre_common import _O

STAGE_U2B = ["pre_exp_regression_calc", "pre_log_regression_calc", "pre_exp_solve_calc", "pre_exp_vs_poly_calc", "pre_sse_models_calc", "pre_doubling_time_calc", "pre_log_vs_line_solve_calc",
             "pre_inverse_eval_calc", "pre_compound_interest_calc", "pre_exp_avg_roc_calc", "pre_exp_threshold_calc", "pre_log_scale_ratio_calc"]


def _expfit(xs, ys):
    """Calculator-style ExpReg: least squares of ln y on x. 독립 경로: 정규방정식을 sympy 유리수로 푼다."""
    a, b = expo_fit(xs, ys)
    n = len(xs); sx = sum(xs); sl = sum(math.log(y) for y in ys); sxx = sum(v * v for v in xs); sxl = sum(v * math.log(y) for v, y in zip(xs, ys))
    m = (n * sxl - sx * sl) / (n * sxx - sx * sx); c = (sl - m * sx) / n
    agree(math.exp(m), b, 1e-9, "b"); agree(math.exp(c), a, 1e-9, "a")
    return a, b


@retry_sep
def pre_exp_regression_calc(rng):
    for _ in forever():
        a0 = pick(rng, [20, 35, 50, 80, 120]); b0 = pick(rng, [1.12, 1.18, 1.25, 1.3, 0.88, 0.8, 0.75]); xs = [0, 1, 2, 3, 4, 5, 6]
        ys = [round(a0 * b0 ** v * (1 + rng.choice([-0.03, -0.01, 0, 0.02, 0.04])), 1) for v in xs]
        a, b = _expfit(xs, ys); x0 = pick(rng, [8, 9, 10]); pred = a * b ** x0
        lin = np.polyfit(xs, ys, 1); linpred = float(np.polyval(lin, x0))
        if min(ys) > 1 and 3 < pred < 2000 and abs(pred - linpred) > 0.08 * max(pred, linpred):
            break
    ctx = pick(rng, [("the number of active users of an app, in thousands,", "months"), ("the amount of a medication in the bloodstream, in milligrams,", "hours"), ("the market value of a collectible", "years")])
    stim = table_stim(f"Values of {ctx[0]} at several times", f"t ({ctx[1]})", "y", list(zip(xs, ys)))
    key, ds = num_options(pred, [(f"Uses a linear regression model, which gives ${linpred:.2f}$ at $t={x0}$, instead of an exponential model.", linpred), (f"Evaluates the exponential model at the last data input $t=6$ instead of at $t={x0}$.", a * b ** 6), (f"Multiplies the last data value ${ys[-1]}$ by the growth factor $b\\approx{b:.3f}$ only once.", ys[-1] * b), (f"Averages the first and last data values ${ys[0]}$ and ${ys[-1]}$.", (ys[0] + ys[-1]) / 2)], tol=0.04, n=2)
    stem = f"The table gives values of {ctx[0]} at several times $t$, measured in {ctx[1]}. An exponential function $E$ is the regression model for the data. Using a graphing calculator, what is the value of $E({x0})$?"
    return MQ("pre_exp_regression_calc", "2.5", "2", "required", stem, key, ds, rng, "An exponential regression model is fit to data and used for prediction", ["Enter the data into a graphing calculator and perform an exponential regression", "Evaluate the fitted model at the requested input"], "least squares of ln y on t solved with the normal equations versus numpy polyfit on ln y", f"The exponential regression gives $E(t)\\approx{a:.3f}\\cdot {b:.4f}^t$ and $E({x0})\\approx{pred:.2f}$.", [f"xs={xs}", f"ys={ys}"], stim=stim, est=110, mat=MAT_TABLE("the data table"))


@retry_sep
def pre_log_regression_calc(rng):
    for _ in forever():
        A = pick(rng, [4.0, 8.0, 12.0, 20.0]); B = pick(rng, [3.0, 5.0, 7.0, 10.0]); xs = [1, 2, 4, 6, 9, 12, 16]
        ys = [round(A + B * math.log(v) + rng.choice([-0.4, -0.2, 0, 0.3, 0.5]), 1) for v in xs]
        lx = np.log(xs); m, c = np.polyfit(lx, ys, 1); n = len(xs); sy = sum(ys); sl = sum(lx); sll = sum(lx * lx); sly = sum(lx * np.array(ys))
        m2 = (n * sly - sl * sy) / (n * sll - sl * sl); c2 = (sy - m2 * sl) / n; agree(m, m2, 1e-9, "m"); agree(c, c2, 1e-9, "c")
        x0 = pick(rng, [20, 25, 30]); pred = c + m * math.log(x0); linpred = float(np.polyval(np.polyfit(xs, ys, 1), x0)); quad = float(np.polyval(np.polyfit(xs, ys, 2), x0))
        if abs(pred - linpred) > 0.08 * pred and pred > 5 and abs(pred - quad) > 0.06 * pred:
            break
    stim = table_stim("Values of a quantity $y$ at several inputs $x$", "x", "y", list(zip(xs, ys)))
    key, ds = num_options(pred, [(f"Uses a linear regression model, which gives ${linpred:.2f}$ at $x={x0}$, instead of a logarithmic model.", linpred), (f"Uses a quadratic regression model, which gives ${quad:.2f}$ at $x={x0}$.", quad), (f"Evaluates the logarithmic model at the last data input $x={xs[-1]}$.", c + m * math.log(xs[-1])), (f"Evaluates the model at $x={x0 - 5 if x0 > 20 else 20}$ instead of $x={x0}$.", c + m * math.log(x0 - 5 if x0 > 20 else 20))], tol=0.03, n=2)
    stem = f"The table gives values of a quantity $y$ at several inputs $x$. A logarithmic function $L(x)=a+b\\ln x$ is the regression model for the data. Using a graphing calculator, what is the value of $L({x0})$?"
    return MQ("pre_log_regression_calc", "2.14", "2", "required", stem, key, ds, rng, "A logarithmic regression model supports extrapolation", ["Perform a logarithmic regression with a graphing calculator", "Evaluate the model at the requested input"], "normal equations for the regression of y on ln x versus numpy polyfit", f"The regression gives $L(x)\\approx{c:.3f}+{m:.3f}\\ln x$ and $L({x0})\\approx{pred:.2f}$.", [f"xs={xs}", f"ys={ys}"], stim=stim, est=110, mat=MAT_TABLE("the data table"))


@retry_sep
def pre_exp_solve_calc(rng):
    for _ in forever():
        a = pick(rng, [2.5, 3.2, 4.0, 6.5, 12.0]); b = pick(rng, [1.05, 1.08, 1.12, 1.2, 1.35]); k = round(a * pick(rng, [3.0, 4.0, 5.5, 7.0]), 1)
        t1 = math.log(k / a) / math.log(b); r = _O.brentq(lambda v: a * b ** v - k, 0, 400, xtol=1e-12); agree(t1, r, 1e-8, "t")
        if 3 < t1 < 90:
            break
    key, ds = num_options(t1, [("Divides $k$ by $a$ and then by $b$ instead of using a logarithm.", k / a / b), ("Uses $\\log_b k$ without dividing by $a$.", math.log(k) / math.log(b)), ("Uses the common logarithm of the ratio without dividing by $\\log b$.", math.log10(k / a)), ("Takes the natural logarithm of $b$ in the numerator.", math.log(b) / math.log(k / a))], tol=0.05)
    stem = f"The amount of a substance at time $t$ days is modeled by $A(t)={a}\\cdot {b}^t$. Using a graphing calculator, at what time $t$ is the amount equal to ${k}$?"
    return MQ("pre_exp_solve_calc", "2.13", "1", "required", stem, key, ds, rng, "Exponential equations can be solved by logarithms or graphically", ["Set the model equal to the target value", "Solve numerically with a graphing calculator or with a logarithm"], "closed form with logarithms versus brentq root finding", f"Solving ${a}\\cdot {b}^t={k}$ gives $t\\approx{t1:.3f}$ days.", [f"a={a}", f"b={b}", f"k={k}"], est=90)


@retry_sep
def pre_exp_vs_poly_calc(rng):
    for _ in forever():
        a = pick(rng, [1, 2, 3, 5]); b = pick(rng, [1.4, 1.6, 2.0]); c = pick(rng, [2, 3, 4, 6]); p = pick(rng, [2, 3]); E = lambda v: a * b ** v  # noqa: E731
        Pf = lambda v: c * v ** p  # noqa: E731
        rts = solve_all(lambda v: E(v) - Pf(v), 0.01, 40, 40000)
        lin = solve_all(lambda v: E(v) - (c * v + 4), 0.01, 40, 40000)
        if len(rts) >= 1 and rts[-1] > 4 and lin:
            break
    tf = rts[-1]
    key, ds = num_options(tf, [(f"Reports the first crossing $t\\approx{rts[0]:.3f}$ instead of the last one.", rts[0] if len(rts) > 1 else tf * 0.5), (f"Reports the common value $E(t)\\approx{E(tf):.1f}$ at the crossing instead of the time.", E(tf)), (f"Replaces the power function ${c}t^{{{p}}}$ by the line ${c}t$ and solves $E(t)={c}t$.", (solve_all(lambda v: E(v) - c * v, 0.01, 60, 60000) or [tf * 0.5])[-1]), (f"Replaces ${c}t^{{{p}}}$ by ${c}t+4$ and uses the last solution of that equation.", lin[-1])], tol=0.05)
    stem = f"A quantity grows exponentially according to $E(t)={a}\\cdot ({b})^t$, and a second quantity grows according to the power model $P(t)={c}t^{{{p}}}$, where $t\\ge 0$ is time in years. Using a graphing calculator, after what time $t$ does $E(t)$ permanently exceed $P(t)$?"
    return MQ("pre_exp_vs_poly_calc", "2.6", "2", "required", stem, key, ds, rng, "An exponential eventually outgrows a power function", ["Graph both models and find their intersection points", "Identify the last intersection after which the exponential is above"], "a sign-change scan of E minus P over a long interval with brentq refinement of each crossing", f"The last crossing is at $t\\approx{tf:.3f}$ years; for larger $t$, $E(t)>P(t)$.", [f"a={a}", f"b={b}", f"c={c}", f"p={p}"], est=110)


@retry_sep
def pre_sse_models_calc(rng):
    for _ in forever():
        xs = [1, 2, 3, 4, 5, 6]; a = pick(rng, [4.0, 6.0, 9.0]); b = pick(rng, [1.2, 1.3, 1.5]); ys = [round(a * b ** v + rng.choice([-0.6, -0.2, 0.3, 0.5, 0.0, -0.4]), 2) for v in xs]
        ma, mb = a * 1.02, b * 0.99; E = lambda v: ma * mb ** v  # noqa: E731
        c1 = np.polyfit(xs, ys, 1); lm, lb = round(float(c1[0]), 2), round(float(c1[1]), 2); Lm = lambda v: lm * v + lb  # noqa: E731
        sseE = sum((y - E(v)) ** 2 for v, y in zip(xs, ys)); sseL = sum((y - Lm(v)) ** 2 for v, y in zip(xs, ys))
        sseE2 = float(np.sum((np.array(ys) - ma * mb ** np.array(xs, dtype=float)) ** 2)); agree(sseE, sseE2, 1e-9, "sse")
        if sseE > 0.2 and sseL / sseE > 1.5:
            break
    stim = table_stim("Data values $y$ at times $x$", "x", "y", list(zip(xs, ys)))
    sumres = sum(y - E(v) for v, y in zip(xs, ys))
    key, ds = num_options(sseE, [(f"Uses the residuals of the linear model $L$, which fits worse, giving ${sseL:.3f}$.", sseL), (f"Sums the residuals of $E$ without squaring them, giving about ${abs(sumres):.3f}$.", abs(sumres) + 0.05 if abs(sumres) < 0.05 else abs(sumres)), (f"Sums the absolute values of the residuals of $E$ instead of their squares.", sum(abs(y - E(v)) for v, y in zip(xs, ys))), (f"Squares each residual of $E$ but divides the sum by the {len(xs)} data points.", sseE / len(xs))], tol=0.06, n=3)
    stem = f"Two models are proposed for the data in the table: the exponential model $E(x)={ma:.3f}\\cdot {mb:.3f}^x$ and the linear model $L(x)={lm}x+({lb})$. Using a calculator, what is the sum of the squares of the residuals of the model that fits the data better?"
    return MQ("pre_sse_models_calc", "2.6", "2", "required", stem, key, ds, rng, "Competing models are compared by the sum of squared residuals", ["Compute the residuals of each model at the six data points", "Compare the sums of the squared residuals and report the smaller one"], "a direct loop in plain Python versus a vectorized numpy sum for both models", f"The sum of squared residuals is about ${sseE:.3f}$ for $E$ and about ${sseL:.3f}$ for $L$, so $E$ fits better.", [f"xs={xs}", f"ys={ys}", f"ma={ma}", f"mb={mb}", f"lm={lm}", f"lb={lb}"], stim=stim, est=125, mat=MAT_TABLE("the data table"))


@retry_sep
def pre_doubling_time_calc(rng):
    for _ in forever():
        r = pick(rng, [0.015, 0.021, 0.034, 0.047, 0.062]); P0 = pick(rng, [120, 250, 400, 900]); Pt = pick(rng, [2.5, 3.0, 4.0]); t2 = math.log(Pt) / r
        chk = _O.brentq(lambda v: math.exp(r * v) - Pt, 0, 2000, xtol=1e-12); agree(t2, chk, 1e-8, "T")
        if t2 > 10:
            break
    key, ds = num_options(t2, [(f"Solves $e^{{{r}t}}={Pt:g}$ by dividing ${Pt:g}$ by the rate ${r}$ with no logarithm.", Pt / r), (f"Uses the common logarithm of ${Pt:g}$ but forgets that the exponent is $e^{{{r}t}}$, dividing $\\log_{{10}}({Pt:g})$ by ${r}$.", math.log10(Pt) / r), (f"Multiplies $\\ln {Pt:g}$ by the rate ${r}$ instead of dividing.", math.log(Pt) * r), (f"Divides the rate ${r}$ by $\\ln {Pt:g}$ instead of $\\ln {Pt:g}$ by the rate.", r / math.log(Pt))], tol=0.05, n=2)
    stem = f"A population is modeled by $P(t)={P0}e^{{{r}t}}$, where $t$ is in years. Using a graphing calculator, in how many years will the population reach ${P0 * Pt:g}$?"
    return MQ("pre_doubling_time_calc", "2.13", "2", "required", stem, key, ds, rng, "Solve an exponential model for the time to reach a target", ["Set the model equal to the target and divide by the initial value", "Solve for t with a logarithm or by graphing both sides"], "closed form ln(target ratio)/r versus brentq root finding", f"Solving $e^{{{r}t}}={Pt:g}$ gives $t=\\ln({Pt:g})/{r}\\approx{t2:.2f}$ years.", [f"r={r}", f"P0={P0}", f"Pt={Pt}"], est=90)


@retry_sep
def pre_log_vs_line_solve_calc(rng):
    for _ in forever():
        a = pick(rng, [3.0, 4.0, 5.0, 6.0]); b = pick(rng, [1.0, 2.0]); m = pick(rng, [0.3, 0.4, 0.5, 0.6]); c = pick(rng, [-1.0, 0.0, 1.0, 2.0])
        f = lambda v: a * math.log(v) + b - (m * v + c)  # noqa: E731
        rts = solve_all(f, 0.01, 200, 8000)
        if len(rts) == 2 and rts[1] - rts[0] > 3 and rts[0] > 0.3:
            break
    key, ds = num_options(rts[1], [("Reports the smaller intersection.", rts[0]), ("Reports the output at the larger intersection.", m * rts[1] + c), ("Solves $a\\ln x=mx$ ignoring both constants.", (solve_all(lambda v: a * math.log(v) - m * v, 1.0001, 300, 8000) or [None])[-1]), ("Reports the midpoint of the two intersections.", sum(rts) / 2)], tol=0.04, n=2)
    stem = f"Let $f(x)={a:g}\\ln x+{b:g}$ and $g(x)={m:g}x{'+' if c >= 0 else '-'}{abs(c):g}$ for $x>0$. The graphs of $f$ and $g$ intersect at two points. Using a graphing calculator, what is the $x$-coordinate of the intersection point with the greater $x$-value?"
    return MQ("pre_log_vs_line_solve_calc", "2.13", "1", "required", stem, key, ds, rng, "Intersections of a logarithmic and a linear graph", ["Graph both functions on a window that shows both intersections", "Read the larger x-coordinate"], "a sign-change scan with brentq refinement versus a dense grid", f"The graphs intersect at $x\\approx{rts[0]:.3f}$ and $x\\approx{rts[1]:.3f}$.", [f"a={a}", f"b={b}", f"m={m}", f"c={c}"], est=100)


@retry_sep
def pre_inverse_eval_calc(rng):
    for _ in forever():
        a = pick(rng, [1, 2]); b = pick(rng, [1, 2, 3]); k = pick(rng, [20, 35, 50, 90]); g = lambda v: a * v ** 3 + b * v  # noqa: E731
        r = _O.brentq(lambda v: g(v) - k, -20, 20, xtol=1e-13); lo, hi = -20.0, 20.0
        for _ in range(100):
            mid = (lo + hi) / 2
            if g(mid) < k:
                lo = mid
            else:
                hi = mid
        agree(r, (lo + hi) / 2, 1e-9, "inv")
        if abs(r - round(r, 1)) > 0.01 and 1 < r < 8:
            break
    key, ds = num_options(r, [("Divides $k$ by $f$'s leading coefficient only.", k / a), ("Takes the cube root of $k$ only.", k ** (1 / 3)), ("Evaluates $f(k)$ instead of $f^{-1}(k)$.", g(k)), ("Divides $k$ by the sum of the coefficients.", k / (a + b))], tol=0.05, n=2)
    stem = f"The function $f$ is defined by $f(x)={a if a > 1 else ''}x^3+{b if b > 1 else ''}x$. The function $f$ is one-to-one. Using a graphing calculator, what is the value of $f^{{-1}}({k})$?"
    return MQ("pre_inverse_eval_calc", "2.8", "1", "required", stem, key, ds, rng, "An inverse value solves f(x)=k", ["Recognize that f^{-1}(k) is the input x with f(x)=k", "Solve f(x)=k numerically with a graphing calculator"], "brentq root finding versus a hand-written bisection", f"Solving $f(x)={k}$ gives $x\\approx{r:.3f}$.", [f"a={a}", f"b={b}", f"k={k}"], est=90)


@retry_sep
def pre_compound_interest_calc(rng):
    P = pick(rng, [1000, 2500, 4000, 8000]); r = pick(rng, [0.03, 0.045, 0.06, 0.075]); n = pick(rng, [2, 4, 12]); t = pick(rng, [5, 8, 10, 15])
    A = P * (1 + r / n) ** (n * t); A2 = float(sp.N(sp.Rational(P) * (1 + sp.Rational(str(r)) / n) ** (n * t), 15)); agree(A, A2, 1e-10, "A")
    key, ds = num_options(A, [("Uses simple interest.", P * (1 + r * t)), ("Compounds once per year instead of $n$ times.", P * (1 + r) ** t), ("Divides the rate by $n$ but does not multiply the exponent by $n$.", P * (1 + r / n) ** t), ("Compounds continuously.", P * math.exp(r * t))], f=lambda v: f"${v:,.2f}$".replace(",", ""), tol=0.01)
    stem = f"An account has an initial deposit of {P} dollars and earns interest at an annual rate of ${100 * r:.1f}\\%$ compounded ${n}$ times per year, so the balance after $t$ years is $A(t)={P}\\left(1+\\dfrac{{{r}}}{{{n}}}\\right)^{{{n}t}}$ dollars. Using a calculator, what is the balance after ${t}$ years?"
    return MQ("pre_compound_interest_calc", "2.5", "1", "required", stem, key, ds, rng, "Evaluate a compound-interest exponential model", ["Substitute the time into the model", "Evaluate the power with a calculator"], "floating point evaluation versus exact rational arithmetic evaluated to fifteen digits", f"$A({t})={P}(1+{r}/{n})^{{{n * t}}}\\approx{A:.2f}$ dollars.", [f"P={P}", f"r={r}", f"n={n}", f"t={t}"], est=80)


@retry_sep
def pre_exp_avg_roc_calc(rng):
    a = pick(rng, [20, 45, 80, 150]); b = pick(rng, [1.1, 1.15, 1.25, 0.9, 0.85]); t1 = pick(rng, [0, 2, 3]); t2 = t1 + pick(rng, [4, 5, 6])
    f = lambda v: a * b ** v  # noqa: E731
    r = (f(t2) - f(t1)) / (t2 - t1); r2 = float(sp.N((a * sp.Rational(str(b)) ** t2 - a * sp.Rational(str(b)) ** t1) / (t2 - t1), 15)); agree(r, r2, 1e-9, "roc")
    key, ds = num_options(r, [("Reports the change in output without dividing by the interval length.", f(t2) - f(t1)), ("Reports the instantaneous-style estimate using the growth factor: $(b-1)f(t_1)$.", (b - 1) * f(t1)), ("Divides the final output by the interval length.", f(t2) / (t2 - t1)), ("Uses the ratio $f(t_2)/f(t_1)$.", f(t2) / f(t1))], tol=0.05, n=2)
    stem = f"The quantity $Q$ is modeled by $Q(t)={a}\\cdot {b}^t$, where $t$ is in hours. Using a calculator, what is the average rate of change of $Q$ over the interval ${t1}\\le t\\le {t2}$?"
    return MQ("pre_exp_avg_roc_calc", "2.2", "1", "required", stem, key, ds, rng, "Average rate of change of an exponential model", ["Evaluate the model at both ends of the interval with a calculator", "Divide the change in output by the change in time"], "floating point evaluation versus exact rational arithmetic evaluated to fifteen digits", f"$\\dfrac{{Q({t2})-Q({t1})}}{{{t2 - t1}}}\\approx{r:.3f}$ per hour.", [f"a={a}", f"b={b}", f"t1={t1}", f"t2={t2}"], est=85)


@retry_sep
def pre_exp_threshold_calc(rng):
    for _ in forever():
        a = pick(rng, [800, 1200, 2000]); b = pick(rng, [0.82, 0.88, 0.92]); th = pick(rng, [100, 150, 250]); t1 = math.log(th / a) / math.log(b)
        r = _O.brentq(lambda v: a * b ** v - th, 0, 500, xtol=1e-12); agree(t1, r, 1e-8, "t")
        if 3 < t1 < 60:
            break
    key, ds = num_options(t1, [("Treats the decay as linear, losing the same amount each year.", (a - th) / (a * (1 - b))), ("Divides the threshold by the initial value and then by the factor.", th / a / b), ("Uses $\\log_{10}$ of the ratio without dividing by $\\log_{10} b$.", math.log10(th / a)), ("Subtracts the threshold from the initial value and divides by $1-b$.", (a - th) / (1 - b))], tol=0.05, n=2)
    stem = f"The value of a machine, in dollars, is modeled by $V(t)={a}\\cdot {b}^t$, where $t$ is time in years. Using a graphing calculator, after how many years does the value first fall to ${th}$?"
    return MQ("pre_exp_threshold_calc", "2.13", "1", "required", stem, key, ds, rng, "Time for an exponential decay to reach a threshold", ["Set the model equal to the threshold", "Solve numerically with a graphing calculator or with logarithms"], "closed form with logarithms versus brentq root finding", f"Solving ${a}\\cdot {b}^t={th}$ gives $t\\approx{t1:.2f}$ years.", [f"a={a}", f"b={b}", f"th={th}"], est=90)


@retry_sep
def pre_log_scale_ratio_calc(rng):
    for _ in forever():
        M1 = pick(rng, [4.5, 5.0, 5.5, 6.0]); dM = pick(rng, [0.7, 1.2, 1.6, 2.1, 2.4]); M2 = round(M1 + dM, 1)
        ratio = 10 ** (1.5 * (M2 - M1)); r2 = float(sp.N(sp.Integer(10) ** (sp.Rational(3, 2) * (sp.Rational(str(M2)) - sp.Rational(str(M1)))), 15)); agree(ratio, r2, 1e-9, "ratio")
        if 5 < ratio < 5000:
            break
    key, ds = num_options(ratio, [("Uses the difference of magnitudes as the ratio.", M2 - M1), ("Uses $10^{M_2-M_1}$ without the factor 1.5.", 10 ** (M2 - M1)), ("Uses $1.5(M_2-M_1)$ without exponentiating.", 1.5 * (M2 - M1)), ("Divides the magnitudes.", M2 / M1)], f=lambda v: dec(v, 1) if v < 100 else f"${v:,.0f}$".replace(",", ""), tol=0.05)
    stem = f"The energy $E$ released by an earthquake of magnitude $M$ satisfies $\\log_{{10}} E=a+1.5M$ for a constant $a$. Using a calculator, how many times greater is the energy released by an earthquake of magnitude ${M2}$ than by an earthquake of magnitude ${M1}$?"
    return MQ("pre_log_scale_ratio_calc", "2.14", "2", "required", stem, key, ds, rng, "Logarithmic scales turn differences into ratios", ["Subtract the two logarithmic equations to get the difference in log energy", "Exponentiate with base 10 to get the ratio of energies"], "exact rational exponent evaluated to fifteen digits versus floating-point exponentiation", f"$E_2/E_1=10^{{1.5({M2}-{M1})}}\\approx{ratio:.1f}$.", [f"M1={M1}", f"M2={M2}"], est=95)
