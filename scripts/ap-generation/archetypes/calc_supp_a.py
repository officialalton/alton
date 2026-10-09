"""BC 단원 10(급수) 보강 MC 원형 A군(2026-10-09, 오너 승인 supplement 배치 1): 계산기 필수 6 + 계산기 불가(정확값·텍스트 선택지) 8.
구조 기준 독립 문항군: 같은 질문·풀이 골격이 아니라 구하는 양과 풀이 단계가 서로 다르다(docs/ap/family-structure-review.md 기준). 모든 값은 코드가 계산하고 독립 수치 경로로 다시 확인한다."""
from scommon import *
from fractions import Fraction as Fr
from scipy import integrate as _I
import math

BC = "ap_calculus_bc"
SERIES = "\\displaystyle\\sum"


def _nb(arch, topic, skill, calc, concept, thinking, cond, mis, path):
    return nb(arch, topic, skill, calc, concept, thinking, cond, mis, path, BC)


# ====================== 계산기 필수(Part B) ======================
# 10.12 라그랑주 오차 한계로 보장되는 최소 차수
def c_lagrange_min_degree_calc(rng):
    k, c, tol = rng.choice([(1, 1, 0.001), (2, 0.5, 0.0005), (3, 0.5, 0.001), (2, 1, 0.001), (1, 2, 0.001), (3, 1, 0.0005)])

    def bound(n, kk=k, cc=c, fact=lambda m: math.factorial(m)):
        return (kk ** (n + 1)) * math.exp(kk * cc) * cc ** (n + 1) / fact(n + 1)

    def least(fn):
        for n in range(1, 25):
            if fn(n) < tol:
                return n
        raise ValueError("no_n")
    key_n = least(bound)
    # 독립 경로: |f^(n+1)| 의 [0,c] 최댓값을 격자에서 직접 찾아 라그랑주 한계를 다시 계산
    fsym = sp.exp(k * x)
    for n in (key_n - 1, key_n):
        dn = sp.lambdify(x, sp.diff(fsym, x, n + 1), "math")
        M = max(abs(dn(c * i / 2000)) for i in range(2001))
        bnd = M * c ** (n + 1) / math.factorial(n + 1)
        if (bnd < tol) != (n == key_n):
            raise ValueError("independent_check_failed")
    if key_n < 3 or key_n > 10:
        raise ValueError("n_out_of_range")
    d_fact = least(lambda n: (k ** (n + 1)) * math.exp(k * c) * c ** (n + 1) / math.factorial(n))
    d_noexp = least(lambda n: (k ** (n + 1)) * c ** (n + 1) / math.factorial(n + 1))
    d_nok = least(lambda n: math.exp(k * c) * c ** (n + 1) / math.factorial(n + 1))
    ds = [("Uses n! instead of (n+1)! in the denominator of the Lagrange error bound.", d_fact), ("Leaves out the factor e^(kc) from the maximum of the (n+1)st derivative.", d_noexp),
          ("Leaves out the factor k^(n+1) that each derivative of e^(kx) contributes.", d_nok), ("Reports the number of terms, n + 1, instead of the degree n.", key_n + 1), ("Stops one degree early because the bound is only close to the tolerance.", key_n - 1)]
    opts_ = numopts(ds, key_n, lambda v: fmt(int(v)))
    stem = f"Let $P_n(x)$ be the Maclaurin polynomial of degree $n$ for $f(x)=e^{{{k}x}}$. Using the Lagrange error bound with the maximum value of $|f^{{(n+1)}}|$ on the interval $[0,{c:g}]$, what is the least $n$ for which the error in approximating $f({c:g})$ by $P_n({c:g})$ is guaranteed to be less than ${tol:g}$?"
    key = Opt(fmt(key_n), True, "M = k^(n+1) e^(kc) on [0, c], so the bound is M c^(n+1)/(n+1)!; test n = 1, 2, 3, ... with a calculator until the bound first drops below the tolerance.", key_n)
    bpr = _nb("c_lagrange_min_degree_calc", "10.12", "1.E", "required", "Find the least degree of a Maclaurin polynomial whose Lagrange error bound is below a tolerance",
              ["Find the maximum of |f^(n+1)| on [0, c] in terms of n", "Write the Lagrange bound M c^(n+1)/(n+1)! and evaluate it for successive n with a calculator", "Choose the first n for which the bound is below the tolerance"],
              [("the derivatives of e^(kx) are k^m e^(kx), largest at x = c on [0, c]", "e^(kx) is increasing and k > 0")],
              [("n_factorial", "uses n! in the denominator"), ("missing_exp_factor", "drops the exponential factor"), ("missing_k_power", "drops the k power"), ("terms_not_degree", "reports the number of terms")],
              "for the two critical degrees, the maximum of |f^(n+1)| is found by a 2001-point grid on [0, c] and the bound recomputed (independent of the closed form k^(n+1) e^(kc))")
    return build("c_lagrange_min_degree_calc", "10.12", "1.E", "required", stem, key, opts_, rng, bpr, 100, [f"k={k}", f"c={c}", f"tol={tol}", f"n={key_n}"])


# 10.11 매클로린 다항식의 실제 오차 |f(c) - P_n(c)|
def c_taylor_actual_error_calc(rng):
    form = rng.choice(["ln", "atan", "exp"])
    n, c = rng.choice([(3, 0.8), (3, 0.6), (4, 0.9), (3, 0.7), (5, 1.0)]) if form != "exp" else rng.choice([(3, 1.0), (4, 1.5), (3, 1.2)])
    fs = {"ln": sp.log(1 + x), "atan": sp.atan(x), "exp": sp.exp(x)}[form]
    ftex = {"ln": "\\ln(1+x)", "atan": "\\arctan x", "exp": "e^{x}"}[form]
    ff = sp.lambdify(x, fs, "math")

    def P(m, v):
        return float(sum(sp.series(fs, x, 0, m + 1).removeO().coeff(x, j) * sp.Float(v) ** j for j in range(m + 1)))
    coeff = {"ln": lambda j: (-1) ** (j + 1) / j if j else 0, "atan": lambda j: ((-1) ** ((j - 1) // 2) / j if j % 2 else 0), "exp": lambda j: 1 / math.factorial(j)}[form]
    Pn = lambda m, v: sum(coeff(j) * v ** j for j in range(m + 1))
    if abs(P(n, c) - Pn(n, c)) > 1e-9:
        raise ValueError("independent_check_failed")
    key_v = abs(ff(c) - Pn(n, c))
    if key_v < 0.005:
        raise ValueError("error_too_small")
    # 오답: 라그랑주 한계, 한 항 적은/많은 차수, 부호 없는 차이 아님(절댓값 요구), P_n(c) 자체
    dM = float(max(abs(sp.lambdify(x, sp.diff(fs, x, n + 1), "math")(c * i / 400)) for i in range(401)))
    lag = dM * c ** (n + 1) / math.factorial(n + 1)
    jn = next(j for j in range(n + 1, n + 6) if coeff(j))
    ds = [(f"Reports the Lagrange error bound {lag:.4f}, an upper limit for the error, instead of the actual error.", lag), (f"Uses the polynomial of degree {n - 1}, whose error at x = {c:g} is {abs(ff(c) - Pn(n - 1, c)):.4f}, instead of the degree {n} polynomial.", abs(ff(c) - Pn(n - 1, c))),
          (f"Uses the polynomial of degree {n + 1}, whose error at x = {c:g} is {abs(ff(c) - Pn(n + 1, c)):.4f}, instead of the degree {n} polynomial.", abs(ff(c) - Pn(n + 1, c))), (f"Reports P_{n}({c:g}) = {Pn(n, c):.4f}, the value of the polynomial, instead of its error.", Pn(n, c)),
          (f"Reports the size {abs(coeff(jn) * c ** jn):.4f} of the first omitted nonzero term of the series instead of the actual error.", abs(coeff(jn) * c ** jn))]
    opts_ = numopts(ds, key_v, dec4)
    stem = f"Let $P_{{{n}}}(x)$ be the Maclaurin polynomial of degree ${n}$ for $f(x)={ftex}$. What is the value of $\\left|f({c:g})-P_{{{n}}}({c:g})\\right|$?"
    key = Opt(dec4(key_v), True, f"With a calculator f({c:g}) = {ff(c):.4f} and P_{n}({c:g}) = {Pn(n, c):.4f}, so the absolute error is {key_v:.4f}.", key_v)
    bpr = _nb("c_taylor_actual_error_calc", "10.11", "1.E", "required", "Compute the actual error of a Maclaurin polynomial approximation with a calculator",
              ["Write the Maclaurin polynomial of the given degree", "Evaluate the polynomial and the function at the given point", "Take the absolute value of the difference"],
              [("the Maclaurin polynomial of degree n uses the terms of the series through x^n", "stated in the problem")],
              [("error_bound_not_error", "reports the Lagrange bound"), ("wrong_degree_low", "uses a lower degree"), ("wrong_degree_high", "uses a higher degree"), ("polynomial_value", "reports the polynomial value")],
              "the coefficients come from the series closed form (not sympy's series expansion used to generate the options) and are checked against sympy series; the function value comes from the math library")
    return build("c_taylor_actual_error_calc", "10.11", "1.E", "required", stem, key, opts_, rng, bpr, 100, [f"form={form}", f"n={n}", f"c={c}", f"err={key_v:.6f}"])


# 10.14 매클로린 급수의 처음 세 개의 0 이 아닌 항을 항별 적분해 정적분 근사
def c_series_integral_calc(rng):
    form = rng.choice(["exp", "cos", "sin"])
    b = rng.choice([0.5, 0.6, 0.8, 0.9])
    base = {"exp": sp.exp(-x ** 2), "cos": sp.cos(x ** 2), "sin": sp.sin(x ** 2)}[form]
    ser = sp.expand(sp.series(base, x, 0, 12).removeO())
    tx = sorted([tm for tm in sp.Add.make_args(ser) if tm != 0], key=lambda tm: sp.degree(tm, x))[:3]
    ant = [sp.integrate(tm, x) for tm in tx]
    key_v = float(sum(a_.subs(x, b) for a_ in ant))
    # 독립 경로: 항을 다항식으로 모아 수치 적분
    poly = sp.lambdify(x, sum(tx), "math")
    if abs(_I.quad(poly, 0, b)[0] - key_v) > 1e-9:
        raise ValueError("independent_check_failed")
    exact = _I.quad(sp.lambdify(x, base, "math"), 0, b)[0]
    two = float(sum(a_.subs(x, b) for a_ in ant[:2]))
    no_int = float(sum(tm.subs(x, b) for tm in tx))
    c1 = [sp.Poly(tm, x).coeffs()[0] for tm in tx]
    wrong_div = float(sum((c_ * sp.Float(b) ** (sp.degree(tm, x) + 1)) for c_, tm in zip(c1, tx)))
    ds = [("Uses only the first two nonzero terms.", two), ("Evaluates the three-term polynomial at x = b without integrating.", no_int), ("Integrates each term but forgets to divide by the new exponent.", wrong_div),
          ("Reports the value of the exact integral instead of the series approximation.", exact)]
    opts_ = numopts(ds, key_v, dec4)
    ftex = {"exp": "e^{-x^{2}}", "cos": "\\cos\\left(x^{2}\\right)", "sin": "\\sin\\left(x^{2}\\right)"}[form]
    stem = f"The first three nonzero terms of the Maclaurin series for $f(x)={ftex}$ are integrated term by term to approximate $\\int_0^{{{b:g}}} f(x)\\,dx$. What is the value of this approximation?"
    key = Opt(dec4(key_v), True, "Write the first three nonzero terms of the series, integrate each from 0 to b, and add the results (calculator for the powers).", key_v)
    bpr = _nb("c_series_integral_calc", "10.15", "1.E", "required", "Approximate a definite integral by integrating the leading terms of a Maclaurin series term by term",
              ["Substitute x squared into the standard Maclaurin series and keep the first three nonzero terms", "Integrate each term from 0 to b", "Add the integrals and evaluate with a calculator"],
              [("a power series may be integrated term by term inside its interval of convergence", "the series for these functions converges for all x")],
              [("two_terms", "uses only two terms"), ("no_integration", "evaluates instead of integrating"), ("no_divide", "forgets to divide by the new exponent"), ("exact_value", "reports the exact integral")],
              "the truncated series is rebuilt with sympy's series expansion and integrated numerically by quadrature (independent of the term-by-term antiderivative formula)")
    return build("c_series_integral_calc", "10.15", "1.E", "required", stem, key, opts_, rng, bpr, 95, [f"form={form}", f"b={b}", f"key={key_v:.6f}"])


# 10.11 미분방정식에서 테일러 다항식(3차) 구하고 값 평가
def c_taylor_from_diffeq_calc(rng):
    F, ftex = rng.choice([(x + y ** 2, "x+y^{2}"), (x * y + 1, "xy+1"), (y + x ** 2, "y+x^{2}"), (sp.sin(x) + y, "\\sin x+y")])
    y0 = rng.choice([1, 2]) if F != x * y + 1 else rng.choice([1, 2])
    pt = rng.choice([0.1, 0.2, 0.3])
    D = lambda g: sp.diff(g, x) + sp.diff(g, y) * F
    d1 = F
    d2 = D(d1)
    d3 = D(d2)
    vals = [sp.nsimplify(d.subs({x: 0, y: y0})) for d in (d1, d2, d3)]
    P3 = lambda v, vs=vals: y0 + float(vs[0]) * v + float(vs[1]) * v ** 2 / 2 + float(vs[2]) * v ** 3 / 6
    key_v = P3(pt)
    # 독립 경로: 피카르 반복(적분 방정식)으로 x^3 까지의 계수를 만들어 비교
    sv = sp.Symbol("s")
    Y = sp.Integer(y0)
    for _ in range(4):
        integrand = sp.expand(F.subs({x: sv, y: Y.subs(x, sv)}, simultaneous=True))
        Y = sp.expand(sp.series(y0 + sp.integrate(integrand, (sv, 0, x)), x, 0, 4).removeO())
    pic = [Y.coeff(x, j) for j in range(4)]
    if any(abs(float(pic[j]) - float([y0, vals[0], vals[1] / 2, vals[2] / 6][j])) > 1e-9 for j in range(4)):
        raise ValueError("independent_check_failed")
    P2 = y0 + float(vals[0]) * pt + float(vals[1]) * pt ** 2 / 2
    no_fact = y0 + float(vals[0]) * pt + float(vals[1]) * pt ** 2 + float(vals[2]) * pt ** 3
    # 연쇄 항을 빠뜨린 2계 도함수(y' 를 곱하지 않음)로 만든 3차
    d2w = sp.diff(F, x) + sp.diff(F, y)
    wrong2 = float(sp.nsimplify(d2w.subs({x: 0, y: y0})))
    wrong = y0 + float(vals[0]) * pt + wrong2 * pt ** 2 / 2 + float(vals[2]) * pt ** 3 / 6
    ds = [("Uses only the terms through x^2 and leaves out the cubic term.", P2), ("Leaves out the factorials in the second and third terms of the polynomial.", no_fact), ("Computes the second derivative without the factor y' from the chain rule.", wrong)]
    ds.append(("Uses the first derivative value as the coefficient of x and ignores the initial value y(0).", P3(pt) - y0))
    opts_ = numopts(ds, key_v, dec4)
    stem = f"The function $y=f(x)$ satisfies $\\dfrac{{dy}}{{dx}}={ftex}$ and $f(0)={y0}$. The Taylor polynomial of degree $3$ for $f$ about $x=0$ is used to approximate $f({pt:g})$. What is the approximation?"
    key = Opt(dec4(key_v), True, "Use the differential equation and the chain rule to find f'(0), f''(0), f'''(0), then evaluate the cubic Taylor polynomial at the given x with a calculator.", key_v)
    bpr = _nb("c_taylor_from_diffeq_calc", "10.11", "1.E", "required", "Build a Taylor polynomial of a solution of a differential equation from repeated differentiation and use it to approximate a value",
              ["Compute f'(0) from the differential equation and the initial value", "Differentiate the equation with the chain rule to get f''(0) and f'''(0)", "Evaluate the degree-3 Taylor polynomial at the given x with a calculator"],
              [("the solution has derivatives of all orders at 0 that are determined by the differential equation and the initial value", "the right side is differentiable in x and y")],
              [("missing_cubic_term", "stops at degree 2"), ("missing_factorials", "omits the factorials"), ("missing_chain_factor", "forgets the chain rule factor"), ("drops_initial_value", "omits f(0)")],
              "Picard iteration of the integral equation y = y0 + integral of F(x, y), truncated at x^3, gives the same coefficients (independent of repeated implicit differentiation)")
    return build("c_taylor_from_diffeq_calc", "10.11", "1.E", "required", stem, key, opts_, rng, bpr, 110, [f"F={F}", f"y0={y0}", f"pt={pt}", f"key={key_v:.6f}"])


# 10.4 적분 판정법으로 급수 합의 상계
def c_integral_test_bound_calc(rng):
    form = rng.choice(["p2", "p3", "atan"])
    N = rng.choice([4, 5, 6] if form == "p3" else [6, 8, 10])
    if form == "p2":
        a = lambda n: 1 / n ** 2
        tail = lambda M: 1 / M
        ser, ftex = "\\dfrac{1}{n^{2}}", "\\dfrac{1}{x^{2}}"
    elif form == "p3":
        a = lambda n: 1 / n ** 3
        tail = lambda M: 1 / (2 * M * M)
        ser, ftex = "\\dfrac{1}{n^{3}}", "\\dfrac{1}{x^{3}}"
    else:
        a = lambda n: 1 / (n * n + 1)
        tail = lambda M: math.pi / 2 - math.atan(M)
        ser, ftex = "\\dfrac{1}{n^{2}+1}", "\\dfrac{1}{x^{2}+1}"
    SN = sum(a(n) for n in range(1, N + 1))
    key_v = SN + tail(N)
    # 독립 경로: 큰 부분합 + 정확한 나머지(수치 적분)로 합을 구하고, 상계·하계 관계를 검사
    big = sum(a(n) for n in range(1, 200001)) + tail(200000)
    low = SN + tail(N + 1)
    fnum = {"p2": lambda t_: 1 / t_ ** 2, "p3": lambda t_: 1 / t_ ** 3, "atan": lambda t_: 1 / (t_ * t_ + 1)}[form]
    if abs(_I.quad(fnum, N, math.inf)[0] - tail(N)) > 1e-8 or not (low < big < key_v):
        raise ValueError("independent_check_failed")
    ds = [("Uses the integral from N + 1 rather than from N, which gives a lower bound instead of an upper bound.", low), ("Reports the partial sum S_N alone, which is less than the sum.", SN), ("Adds the next term a_(N+1) instead of the tail integral.", SN + a(N + 1)),
          ("Reports the true value of the infinite sum, which is not what the integral test bound produces.", big)]
    opts_ = numopts(ds, key_v, dec4)
    stem = f"Let $f(x)={ftex}$ and $a_n=f(n)$ for $n\\ge 1$, and let $S_{{{N}}}$ be the sum of the first ${N}$ terms of ${SERIES}_{{n=1}}^{{\\infty}} {ser}$. Using the integral test, which is the upper bound for the sum of the series given by $S_{{{N}}}+\\int_{{{N}}}^{{\\infty}} f(x)\\,dx$?"
    key = Opt(dec4(key_v), True, "The sum of the terms after n = N is at most the integral of f from N to infinity, so the upper bound is S_N plus that integral; evaluate both with a calculator.", key_v)
    bpr = _nb("c_integral_test_bound_calc", "10.4", "1.E", "required", "Bound the sum of a series above with a partial sum plus the tail integral from the integral test",
              ["Compute the partial sum of the first N terms with a calculator", "Evaluate the improper integral of f from N to infinity", "Add them to get the upper bound"],
              [("f is positive, continuous, and decreasing for x >= 1 so the integral test comparison applies", "f(x) is a positive decreasing function")],
              [("lower_bound_integral", "integral from N+1"), ("partial_sum_only", "omits the tail"), ("next_term", "adds one term"), ("true_sum", "reports the actual sum")],
              "the sum is computed from 200000 terms plus the exact tail, and the tail integral by scipy quad (independent of the closed forms); the ordering lower bound < sum < upper bound is verified")
    return build("c_integral_test_bound_calc", "10.4", "1.E", "required", stem, key, opts_, rng, bpr, 100, [f"form={form}", f"N={N}", f"key={key_v:.6f}"])


# 10.2 기하급수의 부분합이 합에 충분히 가까워지는 최소 항 수
def c_geometric_terms_needed_calc(rng):
    a0, r, tol = rng.choice([(5, 0.8, 0.01), (4, 0.9, 0.05), (6, 0.75, 0.001), (3, 0.85, 0.01), (8, 0.7, 0.001), (2, 0.9, 0.001)])
    S = a0 / (1 - r)

    def rem(n):
        return a0 * r ** n / (1 - r)
    key_n = next(n for n in range(1, 400) if rem(n) < tol)
    # 독립 경로: 부분합과 무한합의 차를 직접 수치로 비교
    s = 0.0
    n_ind = None
    for n in range(1, 400):
        s += a0 * r ** (n - 1)
        if abs(S - s) < tol:
            n_ind = n
            break
    if n_ind != key_n or key_n < 4:
        raise ValueError("independent_check_failed")
    d_term = next(n for n in range(1, 400) if a0 * r ** (n - 1) < tol)
    d_nofac = next(n for n in range(1, 400) if a0 * r ** n < tol)
    ds = [("Finds when the nth term, not the remainder, is smaller than the tolerance.", d_term), ("Leaves out the factor 1/(1 - r) in the remainder a r^n/(1 - r).", d_nofac), ("Reports one fewer term because the remainder after n terms is a r^n/(1 - r).", key_n - 1),
          ("Reports one more term than needed.", key_n + 1)]
    opts_ = numopts(ds, key_n, lambda v: fmt(int(v)))
    stem = f"The sum of the geometric series ${SERIES}_{{n=1}}^{{\\infty}} {a0}({r:g})^{{n-1}}$ is approximated by the sum $S_n$ of its first $n$ terms. What is the least $n$ for which $\\left|\\text{{sum}}-S_n\\right|<{tol:g}$?"
    key = Opt(fmt(key_n), True, "The error after n terms is a r^n/(1 - r); solve a r^n/(1 - r) < tolerance with logarithms or a calculator and round up.", key_n)
    bpr = _nb("c_geometric_terms_needed_calc", "10.2", "1.E", "required", "Find how many terms of a geometric series are needed for a given accuracy using the remainder formula",
              ["Find the sum of the series and the remainder after n terms", "Set a r^n/(1 - r) less than the tolerance and solve for n with a calculator", "Round up to the least integer"],
              [("the ratio r has absolute value less than 1 so the series converges and the remainder is a r^n/(1 - r)", "r is between 0 and 1")],
              [("nth_term_vs_remainder", "compares the nth term to the tolerance"), ("missing_denominator", "drops 1/(1 - r)"), ("off_by_one_low", "one term too few"), ("off_by_one_high", "one term too many")],
              "partial sums are accumulated term by term in floating point and compared with the closed-form sum a/(1 - r) (independent of the remainder formula)")
    return build("c_geometric_terms_needed_calc", "10.2", "1.E", "required", stem, key, opts_, rng, bpr, 95, [f"a={a0}", f"r={r}", f"tol={tol}", f"n={key_n}"])


# ====================== 계산기 불가(Part A) ======================
# 10.15 알려진 급수의 값으로 알아보기: ln(1 + x) 와 arctan
def c_series_recognize_sum(rng):
    if rng.random() < 0.5:
        k = rng.choice([2, 3, 4, 5])
        n_ = sp.Symbol("n", integer=True, positive=True)
        key_e = sp.log(sp.Rational(k + 1, k))
        ser = f"\\dfrac{{(-1)^{{n+1}}}}{{n\\cdot {k}^{{n}}}}"
        lo = 1
        num = sum(((-1) ** (n + 1)) / (n * k ** n) for n in range(1, 400))
        key_why = f"The terms are (-1)^(n+1) x^n/n with x = 1/{k}, the Maclaurin series of ln(1 + x), so the sum is ln(1 + 1/{k}) = ln({k + 1}/{k})."
        ds = [(-sp.log(1 - sp.Rational(1, k)), f"Uses the series for -ln(1 - x) at x = 1/{k}, which has no alternating signs, giving -ln({k - 1}/{k})."), (sp.log(k + 1), f"Substitutes x = {k} instead of x = 1/{k} into ln(1 + x), giving ln({k + 1})."),
              (sp.Rational(1, k), f"Takes the first term, 1/{k}, as the sum of the whole series."), (sp.log(sp.Rational(k, k + 1)), f"Reverses the logarithm, giving ln({k}/{k + 1}) = -ln({k + 1}/{k}), which has the wrong sign.")]
    else:
        key_e = sp.sqrt(3) * sp.pi / 6
        key_why = "Write each term as sqrt(3) (-1)^n (1/sqrt 3)^(2n+1)/(2n+1), which is sqrt(3) times the Maclaurin series of arctan x at x = 1/sqrt 3, so the sum is sqrt(3) arctan(1/sqrt 3) = sqrt(3) pi/6."
        ser = "\\dfrac{(-1)^{n}}{(2n+1)\\,3^{n}}"
        lo = 0
        num = sum(((-1) ** n) / ((2 * n + 1) * 3 ** n) for n in range(0, 400))
        ds = [(sp.pi / 6, "Uses arctan(1/sqrt 3) = pi/6 without the factor sqrt 3 from rewriting the terms."), (sp.pi * sp.sqrt(3) / 18, "Divides by 3 instead of multiplying by sqrt 3."), (sp.pi / 4, "Uses the sum of the series for arctan 1."),
              (sp.log(sp.Rational(4, 3)), "Recognizes a logarithm series instead of the arctangent series.")]
    if abs(num - float(sp.N(key_e))) > 1e-9:
        raise ValueError("independent_check_failed")
    pool = opts([(w, v) for v, w in ds], key_e, anyfmt)
    stem = f"What is the sum of the series ${SERIES}_{{n={lo}}}^{{\\infty}} {ser}$?"
    key = Opt(anyfmt(key_e), True, key_why, key_e)
    bpr = _nb("c_series_recognize_sum", "10.15", "1.E", "not_allowed", "Find the sum of a numerical series by recognizing it as a known Maclaurin series evaluated at a point",
              ["Match the general term to the Maclaurin series of ln(1 + x) or arctan x", "Identify the value of x that produces the given terms, including any constant factor", "Evaluate the function at that x exactly"],
              [("the point lies inside the interval of convergence of the Maclaurin series", "the ratio of the terms has absolute value less than 1 and the alternating series converges")],
              [("wrong_series", "uses a series without alternating signs"), ("wrong_substitution", "substitutes the wrong x"), ("first_term_only", "uses the first term"), ("missing_factor", "drops the constant factor")],
              "partial sums of 400 terms computed in floating point (independent of the recognition of the series)")
    return build("c_series_recognize_sum", "10.15", "1.E", "not_allowed", stem, key, pool, rng, bpr, 95, [f"key={key_e}"])


# 10.15 항별 미분으로 얻은 급수의 합
def c_term_diff_sum(rng):
    k, a_ = rng.choice([(3, 1), (4, 2), (5, 2), (5, 3), (4, 1), (6, 3)])
    key_e = sp.Rational(1, k - a_)
    # 독립: f'(a) = sum_{n>=1} a^(n-1)/k^n 를 수치로
    num = sum(a_ ** (n - 1) / k ** n for n in range(1, 400))
    if abs(num - float(key_e)) > 1e-9:
        raise ValueError("independent_check_failed")
    ds = [(sp.Rational(k, k - a_), f"Drops the factor 1/{k} from each differentiated term, summing x^(n-1)/{k}^(n-1) = 1/(1 - x/{k}) = {k}/({k} - x) at x = {a_}."), (-sp.log(1 - sp.Rational(a_, k)), f"Reports f({a_}) = -ln(1 - {a_}/{k}), the value of the function, instead of the value of its derivative."),
          (sp.Rational(a_, k - a_), f"Keeps the power x^n instead of lowering it to x^(n-1), summing (x/{k})^n = (x/{k})/(1 - x/{k}) = x/({k} - x) at x = {a_}."), (sp.Rational(1, (k - a_) ** 2), f"Differentiates the closed form 1/({k} - x) of the derivative once more, giving 1/({k} - x)^2.")]
    pool = opts([(w, v) for v, w in ds], key_e, anyfmt)
    stem = f"A function $f$ is defined by $f(x)={SERIES}_{{n=1}}^{{\\infty}} \\dfrac{{x^{{n}}}}{{n\\cdot {k}^{{n}}}}$ for $|x|<{k}$. What is the value of $f'({a_})$?"
    key = Opt(anyfmt(key_e), True, f"Differentiating term by term gives sum x^(n-1)/{k}^n, a geometric series with first term 1/{k} and ratio x/{k}, whose sum is 1/({k} - x); at x = {a_} this is 1/{k - a_}.", key_e)
    bpr = _nb("c_term_diff_sum", "10.15", "1.E", "not_allowed", "Differentiate a power series term by term and sum the resulting geometric series at a point",
              ["Differentiate each term of the power series with respect to x", "Recognize a geometric series with first term 1/k and ratio x/k", "Sum it with a/(1 - r) at the given x"],
              [("a power series can be differentiated term by term inside its interval of convergence", "the given x lies in (-k, k)")],
              [("missing_one_over_k", "forgets the factor 1/k"), ("value_not_derivative", "reports f instead of f'"), ("wrong_power", "keeps the power x^n after differentiating"), ("extra_derivative", "differentiates again")],
              "the terms n x^(n-1)/(n k^n) = x^(n-1)/k^n are summed numerically (400 terms) at the given x (independent of the geometric-series formula)")
    return build("c_term_diff_sum", "10.15", "1.E", "not_allowed", stem, key, pool, rng, bpr, 90, [f"k={k}", f"a={a_}", f"key={key_e}"])


# 10.8 비율 판정법의 극한값(n! 와 n^n)
def c_ratio_limit_e(rng):
    c = rng.choice([2, 3, 4])
    key_e = sp.Integer(c) / sp.E
    n = 10 ** 7
    num = c * math.exp(n * math.log(n / (n + 1)))
    if abs(num - float(key_e)) > 1e-6:
        raise ValueError("independent_check_failed")
    concl = "converges" if c < math.e else "diverges"
    ds = [(sp.Integer(c), f"Takes the limit of (n/(n+1))^n to be 1 instead of 1/e."), (c * sp.E, "Inverts the limit of (n/(n+1))^n and gets e instead of 1/e."), (1 / sp.E, "Forgets the constant factor in the ratio of consecutive terms."), (sp.E / c, "Takes the reciprocal of the correct ratio.")]
    pool = opts([(w, v) for v, w in ds], key_e, anyfmt)
    stem = f"For the series ${SERIES}_{{n=1}}^{{\\infty}} \\dfrac{{{c}^{{n}}\\,n!}}{{n^{{n}}}}$, let $L=\\lim_{{n\\to\\infty}}\\left|\\dfrac{{a_{{n+1}}}}{{a_n}}\\right|$ be the limit used in the Ratio Test. What is the value of $L$?"
    key = Opt(anyfmt(key_e), True, "a(n+1)/a(n) = c (n/(n+1))^n, and (n/(n+1))^n = 1/(1 + 1/n)^n tends to 1/e, so L = c/e.", key_e)
    bpr = _nb("c_ratio_limit_e", "10.8", "1.E", "not_allowed", "Evaluate the Ratio Test limit for a series whose terms involve n! and n^n",
              ["Write a(n+1)/a(n) and cancel n! and the powers of c", "Rewrite n^n/(n+1)^n as 1/(1 + 1/n)^n", "Use the limit (1 + 1/n)^n = e"],
              [("the Ratio Test limit exists because the ratio simplifies to c times (n/(n+1))^n", "the terms are positive")],
              [("limit_one", "treats (n/(n+1))^n as 1"), ("inverted_limit", "gets e instead of 1/e"), ("missing_constant", "drops the constant c"), ("reciprocal", "takes the reciprocal")],
              "the ratio is evaluated at n = 10^7 using logarithms in floating point and compared with c/e (independent of the limit definition of e)")
    return build("c_ratio_limit_e", "10.8", "1.E", "not_allowed", stem, key, pool, rng, bpr, 95, [f"c={c}", f"concl={concl}"])


# 10.1 부분합 공식에서 항 구하기
def c_partial_sum_term(rng):
    p, q, m = rng.choice([(3, 2, 3), (2, 1, 4), (4, 3, 3), (5, 2, 4), (3, 1, 5), (2, 3, 4)])
    S_ = lambda n: Fr(p * n, n + q)
    key_f = S_(m) - S_(m - 1)
    # 독립: 처음 m 개 항을 차례로 구해 더하면 S_m 이 되는지, 그리고 sympy 의 기호 차분
    terms = [S_(1)] + [S_(j) - S_(j - 1) for j in range(2, m + 1)]
    nn = sp.Symbol("n")
    sym = sp.simplify(sp.Rational(p) * nn / (nn + q) - sp.Rational(p) * (nn - 1) / (nn - 1 + q))
    if sum(terms) != S_(m) or Fr(str(sym.subs(nn, m))) != key_f:
        raise ValueError("independent_check_failed")
    ds = [("Reports the partial sum S_m itself instead of the term a_m.", S_(m)), ("Subtracts in the wrong order, S_(m-1) - S_m.", S_(m - 1) - S_(m)), ("Uses S_(m+1) - S_m, which is the next term a_(m+1).", S_(m + 1) - S_(m)), ("Reports the limit of the partial sums, the sum of the series.", Fr(p))]
    pool = opts([(w, v) for w, v in ds], key_f, anyfmt)
    stem = f"The $n$th partial sum of the series ${SERIES}_{{n=1}}^{{\\infty}} a_n$ is $S_n=\\dfrac{{{p}n}}{{n+{q}}}$. What is the value of $a_{{{m}}}$?"
    key = Opt(anyfmt(key_f), True, "a_m = S_m - S_(m-1): the m-th term is the difference of consecutive partial sums.", key_f)
    bpr = _nb("c_partial_sum_term", "10.1", "1.E", "not_allowed", "Find a term of a series from a formula for its partial sums",
              ["Recognize that a_m is the difference of consecutive partial sums", "Evaluate S_m and S_(m-1) from the formula", "Subtract in the correct order and simplify the fraction"],
              [("S_m = a_1 + ... + a_m so S_m - S_(m-1) = a_m for m >= 2", "definition of partial sums")],
              [("partial_sum_for_term", "reports S_m"), ("wrong_order", "subtracts in the wrong order"), ("next_term", "gives a_(m+1)"), ("limit_value", "reports the limit")],
              "the first m terms are generated one by one and their exact sum is compared with S_m; the difference is also computed symbolically in n")
    return build("c_partial_sum_term", "10.1", "1.E", "not_allowed", stem, key, pool, rng, bpr, 85, [f"p={p}", f"q={q}", f"m={m}"])


# 10.1 망원급수의 합
def c_telescoping_sum(rng):
    form = rng.choice(["n(n+k)", "(2n-1)(2n+1)", "n(n+1)"])
    if form == "n(n+k)":
        k = rng.choice([2, 3])
        key_f = Fr(1, k) * sum(Fr(1, j) for j in range(1, k + 1))
        term = lambda n: 1 / (n * (n + k))
        den = f"n(n+{k})"
        num_ = "1"
        ds = [(Fr(1), "Treats the series as telescoping down to a single term, 1."), (Fr(1, k), f"Keeps only the first term 1/{k}."), (sum(Fr(1, j) for j in range(1, k + 1)), "Forgets the factor 1/k from the partial fraction decomposition."), (Fr(1, k + 1), "Uses the limit of the last term instead of the sum.")]
    elif form == "(2n-1)(2n+1)":
        c = rng.choice([2, 4, 6])
        key_f = Fr(c, 2)
        term = lambda n: c / ((2 * n - 1) * (2 * n + 1))
        den = "(2n-1)(2n+1)"
        num_ = str(c)
        ds = [(Fr(c), "Forgets the factor 1/2 in the partial fraction decomposition."), (Fr(c, 3), "Keeps only the first term."), (Fr(c, 4), "Uses the average of the first two partial fractions."), (Fr(c, 2) + Fr(c, 6), "Adds an extra term after the telescoping cancellation.")]
    else:
        c = rng.choice([3, 5])
        key_f = Fr(c)
        term = lambda n: c / (n * (n + 1))
        den = "n(n+1)"
        num_ = str(c)
        ds = [(Fr(c, 2), "Keeps only the first term."), (Fr(2 * c), "Doubles the telescoping sum."), (Fr(c, 4), "Uses a partial fraction decomposition with an extra factor 1/2."), (Fr(c + 1), "Adds one to the limit of the partial sums.")]
    s = 0.0
    for n in range(1, 200001):
        s += float(term(n))
    s += float(term(200001)) * 200001   # 꼬리 근사(1/n^2 형: 합 ≈ N 번째 이후 항 × N)
    if abs(s - float(key_f)) > 1e-3:
        raise ValueError("independent_check_failed")
    pool = opts([(w, v) for v, w in ds], key_f, anyfmt)
    stem = f"What is the sum of the series ${SERIES}_{{n=1}}^{{\\infty}} \\dfrac{{{num_}}}{{{den}}}$?"
    key = Opt(anyfmt(key_f), True, "Use partial fractions so consecutive terms cancel, then take the limit of the partial sums.", key_f)
    bpr = _nb("c_telescoping_sum", "10.1", "1.E", "not_allowed", "Find the sum of a convergent series by partial fractions and telescoping",
              ["Decompose the general term into partial fractions", "Write the partial sum and cancel the terms that telescope", "Take the limit of the partial sums"],
              [("the partial sums have a limit because all but a fixed number of terms cancel", "the telescoping partial sums approach a constant")],
              [("full_telescope", "assumes everything cancels"), ("first_term_only", "keeps the first term"), ("missing_factor", "forgets the partial fraction constant"), ("extra_term", "adds an extra term")],
              "the partial sums up to 200000 terms plus a tail estimate are accumulated in floating point (independent of the partial fraction decomposition)")
    return build("c_telescoping_sum", "10.1", "1.E", "not_allowed", stem, key, pool, rng, bpr, 95, [f"form={form}", f"key={key_f}"])


# 10.4 적분 판정법으로 수렴하는 급수 고르기
_INT_CONV = [("\\dfrac{1}{n(\\ln n)^{2}}", "n\\ge 2", lambda n: 1 / (n * math.log(n) ** 2), "The integral of 1/(x (ln x)^2) from 2 to infinity equals 1/ln 2 (substitute u = ln x), which is finite."),
             ("n e^{-n^{2}}", "n\\ge 1", lambda n: n * math.exp(-n * n), "The integral of x e^(-x^2) from 1 to infinity equals e^(-1)/2, which is finite."),
             ("\\dfrac{1}{n^{3/2}}", "n\\ge 1", lambda n: n ** -1.5, "The integral of x^(-3/2) from 1 to infinity equals 2, which is finite.")]
_INT_DIV = [("\\dfrac{1}{n\\ln n}", "n\\ge 2", lambda n: 1 / (n * math.log(n)), "The integral of 1/(x ln x) from 2 to infinity is ln(ln x) evaluated to infinity, which diverges."),
            ("\\dfrac{\\ln n}{n}", "n\\ge 3", lambda n: math.log(n) / n, "The integral of (ln x)/x from 3 to infinity is (ln x)^2/2, which grows without bound."),
            ("\\dfrac{1}{\\sqrt{n}}", "n\\ge 1", lambda n: n ** -0.5, "The integral of x^(-1/2) from 1 to infinity diverges, since it is a p-integral with p = 1/2."),
            ("\\dfrac{n}{n^{2}+1}", "n\\ge 1", lambda n: n / (n * n + 1), "The integral of x/(x^2+1) from 1 to infinity is (1/2) ln(x^2+1), which grows without bound."),
            ("\\dfrac{1}{n}", "n\\ge 1", lambda n: 1 / n, "The integral of 1/x from 1 to infinity diverges.")]


def c_integral_test_choice(rng):
    conv = rng.choice(_INT_CONV)
    divs = rng.sample(_INT_DIV, 3)
    # 독립 경로 1: 모든 보기의 항이 표시된 시작 번호부터 정말 감소하는지(스템의 가설이 참이어야 한다)
    for s_ in [conv] + divs:
        st = int(s_[1].split("ge ")[1])
        if not all(s_[2](n + 1) < s_[2](n) for n in range(st, st + 400)):
            raise ValueError("hypothesis_false")
    # 독립 경로 2: 수렴 후보는 큰 N 의 꼬리 합이 작다
    f = conv[2]
    inc = sum(f(n) for n in range(10 ** 5, 10 ** 5 + 10 ** 5))
    if inc > 0.02:
        raise ValueError("independent_check_failed")
    idx = lambda s_: s_[1].replace("\\ge ", "=")
    mk = lambda s_: f"$\\displaystyle\\sum_{{{idx(s_)}}}^{{\\infty}} {s_[0]}$"
    key_text = mk(conv)
    pool = [Opt(mk(d), False, d[3], None) for d in divs]
    stem = "The terms of each of the following series are positive, continuous, and decreasing functions of $n$ for the indicated values of $n$. For which of the following series does the integral test show that the series converges?"
    key = Opt(key_text, True, conv[3] + " So the integral test shows convergence.", None)
    bpr = _nb("c_integral_test_choice", "10.4", "3.D", "not_allowed", "Choose the series whose related improper integral converges, so the integral test shows convergence",
              ["Replace each term by the corresponding function f(x)", "Evaluate or compare each improper integral from the starting index to infinity", "Select the series whose integral is finite"],
              [("each f is positive, continuous, and decreasing so the integral test applies", "stated in the stem and checked numerically for every listed series")],
              [("log_reciprocal_diverges", "treats 1/(n ln n) like a convergent p-series"), ("sqrt_p_series", "treats p = 1/2 as convergent"), ("ln_over_n", "treats (ln n)/n as convergent because it tends to 0"), ("rational_n_over_n2", "treats n/(n^2+1) as convergent")],
              "every listed term is checked numerically to be decreasing from its starting index, and the convergent series has a small tail sum over n from 10^5 to 2*10^5; each integral is evaluated with sympy")
    return build("c_integral_test_choice", "10.4", "3.D", "not_allowed", stem, key, pool, rng, bpr, 100, [f"conv={conv[0]}", f"divs={[d[0] for d in divs]}"])


# 10.6 극한 비교 판정법의 비교 급수와 결론
def c_comparison_benchmark(rng):
    p_, q_ = rng.choice([(2, 4), (1, 4), (2, 3), (1, 3), (3, 4), (1, 2)])
    a1, b1, c1, d1 = rng.choice([(3, 1, 1, 2), (2, 1, 5, 1), (4, 3, 1, 1), (5, 2, 3, 1)])
    s = q_ - p_
    n_ = sp.Symbol("n", positive=True)
    expr = (a1 * n_ ** p_ + c1) / (b1 * n_ ** q_ + d1 * n_)
    lim = sp.limit(expr * n_ ** s, n_, sp.oo)
    big = 10 ** 6
    if abs(float(expr.subs(n_, big)) * big ** s - float(lim)) > 1e-3 or lim <= 0:
        raise ValueError("independent_check_failed")
    conv = s > 1
    co = lambda v: "" if v == 1 else str(v)
    num_t = f"{co(a1)}n^{{{p_}}}+{c1}" if p_ > 1 else f"{co(a1)}n+{c1}"
    den_t = f"{co(b1)}n^{{{q_}}}+{co(d1)}n"
    word = lambda e_, c_: f"{'Converges' if c_ else 'Diverges'}, by limit comparison with $\\displaystyle\\sum \\dfrac{{1}}{{n^{{{e_}}}}}$" if e_ != 1 else f"{'Converges' if c_ else 'Diverges'}, by limit comparison with $\\displaystyle\\sum \\dfrac{{1}}{{n}}$"
    key_text = word(s, conv)
    bad = [(s + 1, conv or True), (max(1, s - 1), False), (s, not conv), (q_, q_ > 1)]
    pool, used = [], {key_text}
    whys = ["Chooses a benchmark whose exponent is one too large, which does not have the same growth as the terms.", "Chooses a benchmark whose exponent is too small, which does not have the same growth as the terms.", "Uses the right comparison series but states the wrong conclusion about its convergence.", "Compares with a series whose exponent is the degree of the denominator alone."]
    for (e_, c_), w in zip(bad, whys):
        t = word(e_, c_)
        if t in used:
            continue
        used.add(t)
        pool.append(Opt(t, False, w, None))
    if len(pool) < 3:
        raise ValueError("not_enough_distractors")
    stem = f"Which of the following statements about ${SERIES}_{{n=1}}^{{\\infty}} \\dfrac{{{num_t}}}{{{den_t}}}$ is true?"
    key = Opt(key_text, True, "For large n the terms behave like (a/b) times 1/n^(q-p); the limit of the ratio to 1/n^(q-p) is a finite positive number, and that p-series converges exactly when its exponent exceeds 1.", None)
    bpr = _nb("c_comparison_benchmark", "10.6", "3.D", "not_allowed", "Choose the comparison series and conclusion for the limit comparison test with a rational general term",
              ["Compare the highest powers in the numerator and denominator to find the exponent of the benchmark p-series", "Check that the limit of the ratio is a finite positive number", "State convergence or divergence from the p-series test"],
              [("the limit of a_n over 1/n^(q-p) is a finite positive constant so both series behave alike", "the leading coefficients are positive")],
              [("exponent_too_large", "benchmark exponent one too large"), ("exponent_too_small", "benchmark exponent too small"), ("wrong_conclusion", "right series, wrong conclusion"), ("denominator_only", "uses only the denominator degree")],
              "the ratio of the general term to 1/n^(q-p) is evaluated at n = 10^6 and by sympy's limit, and must be finite and positive")
    return build("c_comparison_benchmark", "10.6", "3.D", "not_allowed", stem, key, pool, rng, bpr, 100, [f"p={p_}", f"q={q_}", f"s={s}", f"conv={conv}"])


# 10.7 교대급수 판정법의 조건을 만족하는 급수 고르기
_ALT_OK = [("\\dfrac{(-1)^{n}}{\\sqrt{n}}", "The terms 1/sqrt n decrease to 0, so the alternating series test applies.", lambda n: n ** -0.5),
           ("\\dfrac{(-1)^{n} n}{n^{2}+1}", "The terms n/(n^2+1) decrease for n >= 1 and tend to 0, so the alternating series test applies.", lambda n: n / (n * n + 1)),
           ("\\dfrac{(-1)^{n}}{\\ln n}", "The terms 1/ln n decrease and tend to 0, so the alternating series test applies.", lambda n: 1 / math.log(n))]
_ALT_BAD = [("\\dfrac{(-1)^{n} n}{2n+1}", "The terms tend to 1/2, not 0, so the alternating series test does not apply (the series diverges)."),
            ("\\dfrac{(-1)^{n} (n+1)}{n}", "The absolute value of the terms is 1 + 1/n, which tends to 1 rather than 0, so the test does not apply."),
            ("(-1)^{n}\\cos\\!\\left(\\dfrac{1}{n}\\right)", "Since cos(1/n) tends to cos 0 = 1, the terms do not approach 0 and the test does not apply."),
            ("\\dfrac{(-1)^{n} n^{2}}{n^{2}+3}", "The ratio of the leading terms n^2/n^2 gives limit 1, so the terms do not tend to 0 and the test does not apply.")]


def c_alt_test_choice(rng):
    ok = rng.choice(_ALT_OK)
    bad = rng.sample(_ALT_BAD, 3)
    f = ok[2]
    if not all(f(n + 1) < f(n) for n in range(2, 300)) or f(10 ** 6) > 0.1:
        raise ValueError("independent_check_failed")
    start = 2 if "ln" in ok[0] else 1
    mk = lambda e_: f"$\\displaystyle\\sum_{{n={2 if 'ln' in e_ else 1}}}^{{\\infty}} {e_}$"
    pool = [Opt(mk(b_[0]), False, b_[1], None) for b_ in bad]
    stem = "For which of the following series do the conditions of the alternating series test hold, so that the test shows the series converges?"
    key = Opt(mk(ok[0]), True, ok[1], None)
    bpr = _nb("c_alt_test_choice", "10.7", "3.D", "not_allowed", "Check the conditions of the alternating series test: terms decrease in absolute value and tend to zero",
              ["Write the absolute value of each term as b_n", "Check that b_n tends to 0 as n grows", "Check that b_n is decreasing and select the series that meets both conditions"],
              [("the alternating series test requires b_n to be decreasing with limit 0", "checked for the chosen series; the other series have b_n tending to a positive limit")],
              [("limit_half", "limit of b_n is 1/2, not zero"), ("limit_one_plus_term", "b_n = 1 + 1/n tends to 1"), ("cos_term", "cos(1/n) tends to 1, not zero"), ("rational_one", "ratio of equal degrees tends to 1")],
              "b_n is checked to be strictly decreasing for 2 <= n < 300 and its limit evaluated at n = 10^6; the distractors' limits are evaluated symbolically")
    return build("c_alt_test_choice", "10.7", "3.D", "not_allowed", stem, key, pool, rng, bpr, 95, [f"ok={ok[0]}", f"bad={[b_[0] for b_ in bad]}"])
