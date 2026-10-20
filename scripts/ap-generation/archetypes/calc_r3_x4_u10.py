"""BC4·BC5 확대 라운드(2026-10-19) 단원 10(무한급수·테일러) 새 원형. 공개 세트·재고와 풀이 틀이 다르다(n번째 항 판정, p-급수 범위, 극한비교 값, 비율판정 불확정, 절대·조건 수렴 분류,
교대급수 오차한계 값, 등비급수 방정식, 순환소수, 적분판정 범위, 급수 미분 닫힌 꼴, 매클로린 합성, 테일러 계수에서 도함수 값, 수렴 반지름 범위, 부분합 표·그래프, 급수 적분 근사·테일러 근삿값).
학생에게 보이는 모든 문장은 실제 수치와 $...$ 수식으로 쓴다(r3_lint.py 통과)."""
from calc_r3_x4_lib import *
from fractions import Fraction as Fr

N = sp.Symbol("n", positive=True, integer=True)
X = sp.Symbol("x", real=True)


def W(text, why):
    return Opt(text, False, why, None)


def tex_asc(e):
    """다항식을 낮은 차수부터 쓴 LaTeX."""
    return sp.latex(sp.expand(e), order="rev-lex")


def co(v):
    """계수 1 은 생략."""
    return "" if v == 1 else str(v)


def fr_tex(v):
    return sp.latex(sp.Rational(v.numerator, v.denominator) if isinstance(v, Fr) else sp.nsimplify(v))


# 10.3 n 번째 항 판정으로 발산을 보일 수 있는 급수
def c_x4_nth_term_test(rng):
    a, b = rng.choice([2, 3, 4]), rng.choice([1, 3, 5])
    c, d, e_ = rng.choice([1, 2, 3]), rng.choice([1, 2, 4]), rng.choice([1, 2, 5])
    key_f = lambda n: n / (a * n + b)
    fs = [(f"\\dfrac{{n}}{{{a}n+{b}}}", key_f, True), (f"\\dfrac{{1}}{{n+{c}}}", lambda n: 1 / (n + c), False), (f"\\dfrac{{(-1)^n}}{{n+{d}}}", lambda n: (-1) ** n / (n + d), False), (f"\\dfrac{{n}}{{n^2+{e_}}}", lambda n: n / (n * n + e_), False)]
    for _, f, div in fs:  # 독립 경로: 큰 n 에서 항의 크기
        big = abs(f(10 ** 7))
        if div != (big > 0.01):
            raise ValueError("independent_check_failed")
    key_t = f"$\\displaystyle\\sum_{{n=1}}^{{\\infty}}{fs[0][0]}$"
    ds = [W(f"$\\displaystyle\\sum_{{n=1}}^{{\\infty}}{fs[1][0]}$", f"The terms approach $0$, so the $n$th-term test is inconclusive; the series does diverge, but by comparison with the harmonic series, not by the $n$th-term test."),
          W(f"$\\displaystyle\\sum_{{n=1}}^{{\\infty}}{fs[2][0]}$", f"The terms approach $0$, so the $n$th-term test gives no information (this alternating series converges)."),
          W(f"$\\displaystyle\\sum_{{n=1}}^{{\\infty}}{fs[3][0]}$", f"The terms approach $0$, so the $n$th-term test is inconclusive; the series diverges by limit comparison with $\\sum\\dfrac{{1}}{{n}}$.")]
    stem = "For which of the following series can the $n$th-term test be used to show that the series diverges?"
    bpr = bpb("c_x4_nth_term_test", "10.3", "3.B", "not_allowed", "Use the nth-term test correctly: it proves divergence only when the terms do not approach 0",
              ["Find the limit of the general term for each series", "Select the series whose terms do not approach 0", "Remember that terms approaching 0 give no information"],
              [("if lim a_n is not 0 then the series diverges", "nth-term test for divergence")],
              [("harmonic_like", "terms go to 0 but the series diverges"), ("alternating", "terms go to 0 and the series converges"), ("limit_comparison", "terms go to 0 yet the series diverges by comparison")],
              "the general term of each series is evaluated numerically at n = 10^7; only the key stays far from 0 (independent of the symbolic limits)")
    why = f"$\\displaystyle\\lim_{{n\\to\\infty}}\\dfrac{{n}}{{{a}n+{b}}}=\\dfrac{{1}}{{{a}}}\\ne 0$, so the series diverges by the $n$th-term test. For each of the other three series the terms approach $0$, so that test cannot show divergence."
    return finish("c_x4_nth_term_test", "10.3", "3.B", "not_allowed", stem, key_t, why, None, ds, rng, bpr, 90, [f"a={a},b={b}", f"c={c},d={d},e={e_}"])


# 10.5 p-급수: Σ (n+m)/n^p 가 수렴하는 p
def c_x4_p_series_range(rng):
    m, k = rng.choice([1, 2, 3]), rng.choice([1, 2])
    # 일반항 ~ n^(k)/n^p·... : Σ (n^k + m)/n^p 는 p > k+1 일 때 수렴
    crit = k + 1
    def head(p, Nn):
        return sum((i ** k + m) / i ** p for i in range(Nn + 1, 2 * Nn + 1))
    bound = head(crit, 100000)  # 경계 p 에서는 N+1..2N 구간의 합이 ln 2 에 가깝고, 수렴하는 p 에서는 훨씬 작고, 발산하는 p 에서는 더 커진다
    if not (0.5 < bound < 0.9 and head(crit + 0.5, 100000) < 0.02 * bound and head(crit - 0.4, 100000) > 5 * bound):
        raise ValueError("independent_check_failed")
    pe = f"\\dfrac{{n^{k}+{m}}}{{n^p}}" if k > 1 else f"\\dfrac{{n+{m}}}{{n^p}}"
    key_t = f"$p>{crit}$"
    ds = [W(f"$p>1$", f"This is the condition for $\\sum\\dfrac{{1}}{{n^p}}$; here the terms behave like $\\dfrac{{1}}{{n^{{p-{k}}}}}$, so the exponent that matters is $p-{k}$, not $p$."),
          W(f"$p\\ge {crit}$", f"At $p={crit}$ the terms behave like $\\dfrac{{1}}{{n}}$, so the series diverges like the harmonic series; $p={crit}$ must be excluded."),
          W(f"$p>{crit + 1}$", f"Requires too much: for ${crit}<p\\le{crit + 1}$ the terms behave like $\\dfrac{{1}}{{n^{{p-{k}}}}}$ with $p-{k}>1$, and the series still converges."),
          W(f"$p>0$", "Uses only that the terms approach $0$, which is not enough for convergence of the series.")]
    stem = f"For what values of $p$ does the series $\\displaystyle\\sum_{{n=1}}^{{\\infty}}{pe}$ converge?"
    bpr = bpb("c_x4_p_series_range", "10.5", "1.D", "not_allowed", "Use the p-series test after reducing the terms to their dominant behavior (limit comparison)",
              ["Find the dominant power of n in the numerator and the denominator", "Compare with a p-series of exponent p - k", "State the strict inequality for convergence"],
              [("sum of 1/n^q converges exactly when q > 1", "limit comparison with the p-series gives the same behavior")],
              [("unshifted_exponent", "uses p > 1"), ("boundary_included", "includes p = k+1"), ("too_strict", "adds one extra to the threshold"), ("terms_to_zero", "uses p > 0")],
              "the sum of terms n = N+1..2N at N = 10^5 is compared at the boundary exponent and half a unit above it (independent of the limit comparison)")
    why = f"Since $\\dfrac{{n^{k}+{m}}}{{n^p}}$ behaves like $\\dfrac{{1}}{{n^{{p-{k}}}}}$, by limit comparison the series converges exactly when $p-{k}>1$, that is, $p>{crit}$."
    return finish("c_x4_p_series_range", "10.5", "1.D", "not_allowed", stem, key_t, why, None, ds, rng, bpr, 95, [f"m={m},k={k}", f"crit={crit}"])


# 10.6 극한비교판정: lim a_n/b_n 와 결론
def c_x4_limit_comparison_value(rng):
    A_, B_, C_ = rng.choice([2, 3, 5]), rng.choice([1, 2, 4]), rng.choice([1, 2, 3])
    q = rng.choice([2, 3])  # b_n = 1/n^q ; a_n = (A n^q + B n) / (n^(q+2) + C)  -> a_n ~ A/n^2 ... 로 q=2 고정
    q = 2
    an = lambda n: (A_ * n * n + B_ * n) / (n ** 4 + C_)
    bn = lambda n: 1 / n ** 2
    lim = A_
    if abs(an(1e6) / bn(1e6) - lim) > 1e-3:
        raise ValueError("independent_check_failed")
    form = lambda L, concl: f"The limit is ${L}$, so the series {concl}."
    key_t = form(A_, "converges")
    ds = [W(form(A_, "diverges"), f"The limit is a positive finite number, so $\\sum a_n$ behaves like $\\sum\\dfrac{{1}}{{n^2}}$, which converges; the series cannot diverge."),
          W(form(0, "converges"), f"Computes the limit as $0$ by comparing the wrong powers of $n$; the limit of $\\dfrac{{a_n}}{{b_n}}$ is ${A_}$."),
          W(form(f"\\dfrac{{1}}{{{A_}}}", "converges"), f"Inverts the ratio: the limit of $\\dfrac{{a_n}}{{b_n}}$ is ${A_}$, not $\\dfrac{{1}}{{{A_}}}$."),
          W(form("\\infty", "diverges"), "Treats $a_n$ as larger than $b_n$ in growth, but both have the same order $\\dfrac{1}{n^2}$.")]
    stem = f"Let $a_n=\\dfrac{{{A_}n^2+{B_}n}}{{n^4+{C_}}}$ and $b_n=\\dfrac{{1}}{{n^2}}$ for $n\\ge1$. Which of the following is true about $\\displaystyle\\lim_{{n\\to\\infty}}\\dfrac{{a_n}}{{b_n}}$ and the convergence of $\\displaystyle\\sum_{{n=1}}^{{\\infty}}a_n$?"
    bpr = bpb("c_x4_limit_comparison_value", "10.6", "1.E", "not_allowed", "Evaluate the limit of a_n/b_n and apply the limit comparison test to a p-series",
              ["Form a_n/b_n and divide numerator and denominator by the highest power", "Take the limit of the ratio as n grows", "Because the limit is positive and finite, a_n and b_n series converge or diverge together; the p-series with p = 2 converges"],
              [("lim a_n/b_n is a positive finite number", "then both series converge or both diverge")],
              [("diverges_wrong", "positive finite limit but concludes divergence"), ("zero_limit", "uses zero limit"), ("inverted_ratio", "inverts the ratio"), ("infinite_limit", "infinite limit")],
              "the ratio a_n/b_n is evaluated numerically at n = 10^6 (independent of the algebraic limit)")
    why = f"$\\dfrac{{a_n}}{{b_n}}=\\dfrac{{{A_}n^4+{B_}n^3}}{{n^4+{C_}}}\\to{A_}$, which is positive and finite. Since $\\sum\\dfrac{{1}}{{n^2}}$ converges ($p=2>1$), $\\sum a_n$ converges by the limit comparison test."
    return finish("c_x4_limit_comparison_value", "10.6", "1.E", "not_allowed", stem, key_t, why, None, ds, rng, bpr, 100, [f"A={A_},B={B_},C={C_}"])


# 10.8 비율판정이 결론을 못 내리는 급수
def c_x4_ratio_inconclusive(rng):
    a, c = rng.choice([2, 3, 4]), rng.choice([1, 2, 3])
    ser = [(f"\\dfrac{{n}}{{n^2+{c}n}}", lambda n: n / (n * n + c * n), True),
           (f"\\dfrac{{n}}{{{a}^n}}", lambda n: n / a ** n, False),
           (f"\\dfrac{{{a}^n}}{{n!}}", lambda n: a ** n / math.factorial(n), False),
           (f"\\dfrac{{{a + 1}^n}}{{{a}^n}}", lambda n: (a + 1) ** n / a ** n, False)]
    def ratio(f, n):
        return f(n + 1) / f(n)
    for _, f, inc in ser:
        r = ratio(f, 120)
        if inc != (abs(r - 1) < 0.03):
            raise ValueError("independent_check_failed")
    key_t = f"$\\displaystyle\\sum_{{n=1}}^{{\\infty}}{ser[0][0]}$"
    Ls = [("", ""), (f"\\dfrac{{1}}{{{a}}}", "less than 1"), ("0", "less than 1"), (f"\\dfrac{{{a + 1}}}{{{a}}}", "greater than 1")]
    ds = [W(f"$\\displaystyle\\sum_{{n=1}}^{{\\infty}}{ser[i][0]}$", f"The ratio of successive terms has limit ${Ls[i][0]}$, which is {Ls[i][1]}, so the Ratio Test does decide this series.") for i in (1, 2, 3)]
    stem = "For which of the following series does the Ratio Test fail to determine whether the series converges or diverges?"
    bpr = bpb("c_x4_ratio_inconclusive", "10.8", "3.B", "not_allowed", "Know when the Ratio Test is inconclusive: the limit of |a_(n+1)/a_n| equals 1",
              ["Compute the limit of the ratio of successive terms for each series", "Identify the series whose limit equals 1"],
              [("the Ratio Test decides when the limit is not 1", "the limit equals 1 gives no conclusion")],
              [("geometric_over_one", "limit greater than 1 decides"), ("factorial_zero", "limit 0 decides"), ("exponential_decay", "limit below 1 decides")],
              "numeric ratio of consecutive terms at n = 120 for each series (independent of the symbolic limits)")
    why = f"For $a_n=\\dfrac{{n}}{{n^2+{c}n}}=\\dfrac{{1}}{{n+{c}}}$, $\\dfrac{{a_{{n+1}}}}{{a_n}}=\\dfrac{{n+{c}}}{{n+{c + 1}}}\\to1$, so the Ratio Test is inconclusive. The other three ratios have limits $\\dfrac{{1}}{{{a}}}$, $0$ and $\\dfrac{{{a + 1}}}{{{a}}}$, none of which is $1$."
    return finish("c_x4_ratio_inconclusive", "10.8", "3.B", "not_allowed", stem, key_t, why, None, ds, rng, bpr, 100, [f"a={a},c={c}"])


# 10.9 절대·조건 수렴 분류
def c_x4_abs_cond_classify(rng):
    frames = [("\\dfrac{(-1)^n}{\\sqrt{n}}", "conditional", "The terms alternate, decrease to $0$, so the series converges by the Alternating Series Test; $\\sum\\dfrac{1}{\\sqrt n}$ is a $p$-series with $p=\\dfrac12\\le1$ and diverges, so the convergence is conditional."),
              ("\\dfrac{(-1)^n}{n^2}", "absolute", "$\\sum\\dfrac{1}{n^2}$ is a $p$-series with $p=2>1$ and converges, so the series converges absolutely."),
              ("(-1)^n\\dfrac{n}{n+1}", "diverges", "The terms $(-1)^n\\dfrac{n}{n+1}$ do not approach $0$ (their absolute values approach $1$), so the series diverges by the $n$th-term test.")]
    name, cls, why = rng.choice(frames)
    stmt = {"conditional": "The series converges conditionally.", "absolute": "The series converges absolutely.", "diverges": "The series diverges."}
    key_t = stmt[cls]
    mis = {"conditional": {"absolute": "Concludes absolute convergence because the Alternating Series Test applies, without checking the series of absolute values.", "diverges": "Concludes divergence because the series of absolute values diverges, forgetting that the alternating series can still converge.", "other": "Claims no classification is possible, but the terms alternate and decrease to $0$ and the absolute series is a divergent $p$-series, so the series can be classified."},
           "absolute": {"conditional": "Treats the series as conditionally convergent although $\\sum|a_n|$ converges.", "diverges": "Concludes divergence because the terms alternate in sign.", "other": "Claims no classification is possible, but the series of absolute values is a convergent $p$-series, which settles the classification."},
           "diverges": {"absolute": "Treats the series as absolutely convergent without noticing that the terms do not approach $0$.", "conditional": "Applies the Alternating Series Test, but the terms do not decrease to $0$, so the test does not apply.", "other": "Claims no classification is possible, but the terms do not approach $0$, so the $n$th-term test settles that the series diverges."}}[cls]
    others = [c for c in ("conditional", "absolute", "diverges") if c != cls]
    ds = [W(stmt[others[0]], mis[others[0]]), W(stmt[others[1]], mis[others[1]]), W("Convergence cannot be determined from the information given.", mis["other"])]
    stem = f"Which of the following statements is true about the series $\\displaystyle\\sum_{{n=1}}^{{\\infty}}{name}$?"
    # 독립 경로: 부분합과 절댓값 부분합의 거동
    f = {"conditional": lambda n: (-1) ** n / math.sqrt(n), "absolute": lambda n: (-1) ** n / n ** 2, "diverges": lambda n: (-1) ** n * n / (n + 1)}[cls]
    s_abs = [sum(abs(f(i)) for i in range(1, M)) for M in (10 ** 3, 10 ** 5)]
    tail = abs(f(10 ** 5))
    behaved = {"conditional": (s_abs[1] > 1.5 * s_abs[0] and tail < 0.01), "absolute": (s_abs[1] - s_abs[0] < 0.01 and tail < 0.01), "diverges": tail > 0.5}[cls]
    if not behaved:
        raise ValueError("independent_check_failed")
    bpr = bpb("c_x4_abs_cond_classify", "10.9", "3.D", "not_allowed", "Classify an alternating series as absolutely convergent, conditionally convergent or divergent",
              ["Check whether the terms approach 0", "Test the series of absolute values with a p-series", "Apply the Alternating Series Test when the absolute series diverges but the terms decrease to 0"],
              [("absolute convergence needs sum |a_n| to converge; conditional needs the series to converge while sum |a_n| diverges", "classification definitions")],
              [("alt_test_means_absolute", "confuses conditional with absolute"), ("alternating_means_diverges", "thinks alternation implies divergence"), ("no_classification", "claims no conclusion")],
              "partial sums of the absolute terms up to 10^3 and 10^5 terms and the size of the 10^5-th term (independent of the p-series reasoning)")
    return finish("c_x4_abs_cond_classify", "10.9", "3.D", "not_allowed", stem, key_t, why, None, ds, rng, bpr, 95, [f"class={cls}"])


# 10.10 교대급수 오차한계: S_4 로 근사할 때 오차의 상한
def c_x4_alt_error_bound_value(rng):
    q = rng.choice([2, 3])
    c = rng.choice([1, 2, 3])
    an = lambda n: Fr(1, n ** q + c)
    key = an(5)
    # 독립: 큰 항수 부분합과 S_4 의 차가 a_5 이하이며 a_5 에 가깝다(교대급수)
    Sbig = sum((-1) ** (i + 1) * 1 / (i ** q + c) for i in range(1, 200000))
    S4 = sum((-1) ** (i + 1) * 1 / (i ** q + c) for i in range(1, 5))
    err = abs(Sbig - S4)
    if not (err <= float(key) + 1e-12 and err > 0.4 * float(key)):
        raise ValueError("independent_check_failed")
    ds = vopts([("Uses the last term used, $a_4$, instead of the first omitted term $a_5$.", an(4)), ("Uses $a_6$, skipping one term.", an(6)), ("Uses the sum of the omitted terms $a_5+a_6$.", an(5) + an(6)),
                ("Uses the difference $a_4-a_5$ of the last two terms.", an(4) - an(5))], key, lambda v: "$" + sp.latex(sp.Rational(v.numerator, v.denominator)) + "$")
    stem = f"The series $\\displaystyle\\sum_{{n=1}}^{{\\infty}}\\dfrac{{(-1)^{{n+1}}}}{{n^{q}+{c}}}$ converges to a sum $S$. The sum $S_4$ of the first four terms is used to approximate $S$. Which of the following is the bound on the error $|S-S_4|$ given by the Alternating Series Error Bound?"
    key_t = "$" + sp.latex(sp.Rational(key.numerator, key.denominator)) + "$"
    bpr = bpb("c_x4_alt_error_bound_value", "10.10", "1.E", "not_allowed", "Alternating Series Error Bound: |S - S_n| <= a_(n+1), the first omitted term",
              ["Check that the terms alternate, decrease and approach 0", "Identify the first omitted term a_5", "Evaluate the first omitted term a_5 exactly"],
              [("the terms 1/(n^q + c) decrease to 0 and alternate in sign", "so the Alternating Series Error Bound applies")],
              [("last_used_term", "uses the last term a_4"), ("skipped_term", "uses a_6 and skips a term"), ("sum_of_omitted", "adds omitted terms a_5 + a_6"), ("difference", "subtracts neighboring terms")],
              "the partial sum of 200000 terms compared with S_4 shows the true error lies between 0.4 a_5 and a_5 (independent of the bound formula)")
    why = f"The terms alternate in sign and $\\dfrac{{1}}{{n^{q}+{c}}}$ decreases to $0$, so $|S-S_4|\\le a_5=\\dfrac{{1}}{{5^{q}+{c}}}={key_t.strip('$')}$."
    return finish("c_x4_alt_error_bound_value", "10.10", "1.E", "not_allowed", stem, key_t, why, key, ds, rng, bpr, 100, [f"q={q},c={c}", f"key={key}"])


# 10.2 등비급수 방정식: Σ_{n=0}^∞ (x/k)^n = m
def c_x4_geom_sum_equation(rng):
    k, m = rng.choice([3, 4, 5, 6]), rng.choice([2, 3, 4])
    xs = Fr(k) * (1 - Fr(1, m))
    r = xs / k
    if abs(r) >= 1:
        raise ValueError("diverges")
    part = sum(float(r) ** i for i in range(0, 4000))
    if abs(part - m) > 1e-9:
        raise ValueError("independent_check_failed")
    t = lambda v: "$" + sp.latex(sp.Rational(v.numerator, v.denominator)) + "$"
    ds = vopts([("Takes the common ratio to be $\\dfrac{1}{%d}$ and solves $\\dfrac{x}{%d}=\\dfrac{1}{%d}$." % (m, k, m), Fr(k, m)), ("Takes the sum to be the common ratio and solves $\\dfrac{x}{%d}=%d$." % (k, m), Fr(k * m)),
                ("Solves $\\dfrac{1}{1+\\frac{x}{%d}}=%d$, with the wrong sign in the denominator of the sum formula." % (k, m), -xs), ("Solves $1-\\dfrac{x}{%d}=%d$, forgetting that the sum is $\\dfrac{1}{1-r}$." % (k, m), Fr(k) * (1 - m))], xs, t)
    stem = f"For which value of $x$ does $\\displaystyle\\sum_{{n=0}}^{{\\infty}}\\left(\\dfrac{{x}}{{{k}}}\\right)^n={m}$?"
    bpr = bpb("c_x4_geom_sum_equation", "10.2", "1.E", "not_allowed", "Solve for a parameter in a convergent geometric series using sum = first term/(1 - ratio)",
              ["Identify the first term 1 and the common ratio x/k", "Write 1/(1 - x/k) = m", "Solve for x and check |x/k| < 1"],
              [("a geometric series converges to a/(1 - r) when |r| < 1", "the solution satisfies |x/k| < 1")],
              [("ratio_equals_inverse", "sets the ratio to 1/m"), ("ratio_equals_sum", "sets the ratio to m"), ("sign_error", "wrong sign in the denominator"), ("omits_reciprocal", "forgets the reciprocal")],
              "the partial sum of 4000 terms at the solution is compared with the target sum (independent of the algebra)")
    why = f"The sum is $\\dfrac{{1}}{{1-\\frac{{x}}{{{k}}}}}={m}$, so $1-\\dfrac{{x}}{{{k}}}=\\dfrac{{1}}{{{m}}}$ and $x={t(xs).strip('$')}$. Here $\\left|\\dfrac{{x}}{{{k}}}\\right|=\\dfrac{{{m - 1}}}{{{m}}}<1$, so the series converges."
    return finish("c_x4_geom_sum_equation", "10.2", "1.E", "not_allowed", stem, t(xs), why, xs, ds, rng, bpr, 95, [f"k={k},m={m}", f"x={xs}"])


# 10.2 순환소수를 분수로: 0.a\overline{bc}
def c_x4_repeating_decimal(rng):
    a_, b_, c_ = rng.randint(1, 9), rng.randint(0, 9), rng.randint(0, 9)
    if b_ == c_ and b_ == 0:
        raise ValueError("trivial")
    pre = Fr(a_, 10); rep = Fr(10 * b_ + c_, 99)
    val = pre + rep / 10
    if val == Fr(1, 1) or val.denominator < 6:
        raise ValueError("too_simple")
    digits = f"0.{a_}\\overline{{{b_}{c_}}}"
    # 독립 경로: 소수 전개(정확 분수의 긴 나눗셈 자릿수)와 같은 자릿수를 낸다
    nume, den = val.numerator, val.denominator
    dd, r_ = [], nume % den
    for _ in range(14):
        r_ *= 10; dd.append(r_ // den); r_ %= den
    want = [a_] + [b_, c_] * 7
    if dd != want[:14]:
        raise ValueError("independent_check_failed")
    t = lambda v: "$\\dfrac{%d}{%d}$" % (v.numerator, v.denominator)
    A_n = 100 * a_ + 10 * b_ + c_
    ds = vopts([("Treats the repeating block as if it began right after the decimal point: $\\dfrac{%d}{999}$." % A_n, Fr(A_n, 999)), ("Uses the denominator $990$ but forgets to subtract the non-repeating digit from the numerator: $\\dfrac{%d}{990}$." % A_n, Fr(A_n, 990)),
                ("Uses the ratio $\\dfrac{1}{1000}$ instead of $\\dfrac{1}{100}$ for the repeating block: $\\dfrac{%d}{10}+\\dfrac{%d}{999}$." % (a_, 10 * b_ + c_), pre + Fr(10 * b_ + c_, 999)),
                ("Subtracts the non-repeating digit but uses the denominator $999$: $\\dfrac{%d}{999}$." % (A_n - a_), Fr(A_n - a_, 999))], val, t)
    stem = f"What is the value of the repeating decimal ${digits}$ written as a fraction in lowest terms?"
    bpr = bpb("c_x4_repeating_decimal", "10.2", "2.C", "not_allowed", "Re-express a repeating decimal as a fraction using a geometric series",
              ["Split the decimal into the non-repeating digit and a geometric series for the repeating block", "Sum the geometric series with ratio 1/100", "Add the two parts and reduce the fraction"],
              [("a repeating block is a geometric series with ratio 1/100", "the block has two digits")],
              [("block_not_shifted", "ignores the shift by one place"), ("adds_unshifted", "does not shift the repeating part"), ("denominator_990_without_subtracting", "forgets to subtract"), ("wrong_denominator", "uses one 9")],
              "long division of the fraction produces the same first 14 digits as the repeating decimal (independent of the geometric series)")
    why = f"$0.{a_}\\overline{{{b_}{c_}}}=\\dfrac{{{a_}}}{{10}}+\\dfrac{{\\frac{{{10 * b_ + c_}}}{{1000}}}}{{1-\\frac{{1}}{{100}}}}=\\dfrac{{{a_}}}{{10}}+\\dfrac{{{10 * b_ + c_}}}{{990}}=\\dfrac{{{val.numerator}}}{{{val.denominator}}}$ in lowest terms."
    return finish("c_x4_repeating_decimal", "10.2", "2.C", "not_allowed", stem, t(val), why, val, ds, rng, bpr, 100, [f"digits={a_}{b_}{c_}", f"val={val}"])


# 10.4 적분판정: Σ 1/(n (ln n)^p) 가 수렴하는 p
def c_x4_integral_test_log_p(rng):
    start = rng.choice([2, 3])

    def tailint(p, M):  # ∫_{ln start}^{M} u^{-p} du  (x = e^u)
        return QI.quad(lambda u: u ** (-p), math.log(start), M)[0]
    if not (tailint(1.5, 1e8) - tailint(1.5, 1e4) < 0.05 and tailint(1.0, 1e8) - tailint(1.0, 1e4) > 1.5 and tailint(0.5, 1e8) > 100):
        raise ValueError("independent_check_failed")
    ds = [W("$p\\ge1$", f"At $p=1$ the integral $\\displaystyle\\int_{{{start}}}^{{\\infty}}\\dfrac{{dx}}{{x\\ln x}}=\\lim_{{b\\to\\infty}}\\left[\\ln(\\ln b)-\\ln(\\ln {start})\\right]$ grows without bound, so the series diverges."),
          W("$p>0$", "Uses only that the terms decrease to $0$; for $0<p\\le1$ the series still diverges."),
          W("$p<1$", "Reverses the inequality: the series diverges for $p<1$ and converges for $p>1$."),
          W("$p>2$", "Requires too much: for $1<p\\le2$ the integral $\\int_2^{\\infty}\\dfrac{dx}{x(\\ln x)^p}$ already converges.")]
    key_t = "$p>1$"
    stem = f"For what values of $p$ does the series $\\displaystyle\\sum_{{n={start}}}^{{\\infty}}\\dfrac{{1}}{{n(\\ln n)^p}}$ converge?"
    bpr = bpb("c_x4_integral_test_log_p", "10.4", "3.D", "not_allowed", "Apply the integral test with the substitution u = ln x to decide for which p the series converges",
              ["Check that the function is positive, continuous and decreasing for x >= start", "Substitute u = ln x in the improper integral", "Use the p-integral to state the condition on p"],
              [("1/(x (ln x)^p) is positive, continuous and decreasing on [start, infinity) for p > 0", "so the integral test applies")],
              [("boundary_included", "includes p = 1"), ("only_terms_to_zero", "uses p > 0"), ("reversed_inequality", "reverses the inequality"), ("too_strict", "requires p > 2")],
              "numerical quadrature of the transformed integral over [ln start, 10^4] and [ln start, 10^8] at p = 1.5, 1 and 0.5 shows bounded versus unbounded growth (independent of the antiderivative)")
    why = f"For $p>0$ the terms are positive, continuous and decreasing, so the integral test applies. With $u=\\ln x$, $\\displaystyle\\int_{{{start}}}^{{\\infty}}\\dfrac{{dx}}{{x(\\ln x)^p}}=\\int_{{\\ln {start}}}^{{\\infty}}u^{{-p}}\\,du$, which converges exactly when $p>1$."
    return finish("c_x4_integral_test_log_p", "10.4", "3.D", "not_allowed", stem, key_t, why, None, ds, rng, bpr, 105, [f"start={start}"])


# 10.15 멱급수의 미분: f(x) = Σ x^n / n  또는  Σ (-1)^n x^(2n+1)/(2n+1)
def c_x4_series_derivative_closed(rng):
    fr = rng.choice([0, 1])
    if fr == 0:
        ftxt = "\\displaystyle\\sum_{n=1}^{\\infty}\\dfrac{x^n}{n}"; closed = 1 / (1 - X)
        chk = lambda x0: sum(x0 ** (n - 1) for n in range(1, 400)) - 1 / (1 - x0)
        domain = "|x|<1"
        opts = [("$\\dfrac{1}{1-x}$", None), ("$\\dfrac{1}{1+x}$", "Uses $\\dfrac{1}{1+x}$, which is the sum of the alternating series $\\sum(-x)^{n-1}$; the terms of $f'$ all have positive coefficients."), ("$\\dfrac{x}{1-x}$", "Starts the series of $f'$ at $x^1$ instead of $x^0$: the derivative of the term $\\dfrac{x^n}{n}$ is $x^{n-1}$, so the first term is $1$."),
                ("$-\\ln(1-x)$", "Gives $f(x)$ itself (the sum of the original series), not its derivative."), ("$\\dfrac{1}{(1-x)^2}$", "Differentiates the closed form of the geometric series again instead of differentiating the given series term by term.")]
        why = "Differentiating term by term, $f'(x)=\\displaystyle\\sum_{n=1}^{\\infty}x^{n-1}=1+x+x^2+\\cdots$, a geometric series with first term $1$ and ratio $x$, so $f'(x)=\\dfrac{1}{1-x}$ for $|x|<1$."
    else:
        ftxt = "\\displaystyle\\sum_{n=0}^{\\infty}\\dfrac{(-1)^nx^{2n+1}}{2n+1}"; closed = 1 / (1 + X ** 2)
        chk = lambda x0: sum((-1) ** n * x0 ** (2 * n) for n in range(0, 400)) - 1 / (1 + x0 ** 2)
        domain = "|x|<1"
        why = "Differentiating term by term, $f'(x)=\\displaystyle\\sum_{n=0}^{\\infty}(-1)^nx^{2n}=1-x^2+x^4-\\cdots$, a geometric series with first term $1$ and ratio $-x^2$, so $f'(x)=\\dfrac{1}{1+x^2}$ for $|x|<1$."
        opts = [("$\\dfrac{1}{1+x^2}$", None), ("$\\dfrac{1}{1-x^2}$", "Drops the alternating signs: the terms of $f'$ are $(-1)^nx^{2n}$, which sum to $\\dfrac{1}{1+x^2}$."), ("$\\dfrac{x}{1+x^2}$", "Misses the first term: the derivative of $x$ is $1$, so the constant term of $f'$ is $1$."),
                ("$\\dfrac{1}{1+x}$", "Uses ratio $-x$ instead of $-x^2$."), ("$\\arctan x$", "Gives $f(x)$ itself (the sum of the original series), not its derivative.")]
    for x0 in (0.3, -0.5, 0.7):
        if abs(chk(x0)) > 1e-6:
            raise ValueError("independent_check_failed")
    key_t = opts[0][0]
    ds = [W(t_, w_) for t_, w_ in opts[1:]]
    stem = f"The function $f$ is defined by $f(x)={ftxt}$ for $|x|<1$. Which of the following is an expression for $f'(x)$ on this interval?"
    bpr = bpb("c_x4_series_derivative_closed", "10.15", "2.C", "not_allowed", "Differentiate a power series term by term and recognize the result as a geometric series",
              ["Differentiate each term of the series", "Recognize the new series as a geometric series", "Write its sum as a closed form on the interval of convergence"],
              [("a power series can be differentiated term by term inside its interval of convergence", "|x| < 1 lies inside the interval of convergence")],
              [("wrong_sign_closed_form", "uses the wrong sign or ratio"), ("shifted_start", "misses or adds a power of x"), ("antiderivative_instead", "gives f instead of f'"), ("second_differentiation", "differentiates again")],
              "the partial sum of 400 terms of the differentiated series is compared with each option at three sample points (independent of the geometric-series sum)")
    return finish("c_x4_series_derivative_closed", "10.15", "2.C", "not_allowed", stem, key_t, why, None, ds, rng, bpr, 100, [f"frame={fr}"])


# 10.14 매클로린 급수의 처음 세 개 영이 아닌 항
def c_x4_maclaurin_compose(rng):
    fn = rng.choice(["cos", "sin", "exp"]); a = rng.choice([1, 2])
    b = rng.choice([1, 2, 3]) if fn != "exp" else rng.choice([2, 3])
    gfun = {"cos": sp.cos, "sin": sp.sin, "exp": sp.exp}[fn]
    U = sp.Symbol("u")
    base = sp.series(gfun(U), U, 0, 10).removeO()
    bterms = sorted([(sp.degree(t_, U), sp.Poly(t_, U).LC()) for t_ in sp.Add.make_args(sp.expand(base)) if t_ != 0], key=lambda z: z[0])[:3]
    key_terms = [(k + a, c * sp.Integer(b) ** k) for k, c in bterms]
    mk = lambda terms: sp.Add(*[c * X ** p_ for p_, c in terms])
    key_poly = mk(key_terms)
    # 독립 경로: 세 항 다항식과 실제 함수의 차이가 다음 항 크기 이하(x = 0.05)
    f = X ** a * gfun(b * X)
    x0 = 0.05
    nxt = sorted([(sp.degree(t_, U), sp.Poly(t_, U).LC()) for t_ in sp.Add.make_args(sp.expand(base)) if t_ != 0], key=lambda z: z[0])[3]
    if abs(float(key_poly.subs(X, x0)) - float(f.subs(X, x0))) > 2 * abs(float(nxt[1]) * b ** nxt[0] * x0 ** (nxt[0] + a)):
        raise ValueError("independent_check_failed")
    fn_tex = {"cos": "\\cos(%dx)" % b if b > 1 else "\\cos x", "sin": "\\sin(%dx)" % b if b > 1 else "\\sin x", "exp": "e^{%dx}" % b}[fn]
    fx_tex = (f"x^{a}" if a > 1 else "x") + fn_tex
    pts = []
    if b > 1:
        pts.append(("Replaces $(%dx)^k$ by $x^k$ in the series, forgetting to raise the coefficient $%d$ to the power $k$." % (b, b), mk([(k + a, c) for k, c in bterms])))
    pts.append(("Divides by $k$ instead of $k!$ for the terms of degree $k\\ge 2$ in the series of the basic function.", mk([(k + a, sp.sign(c) * sp.Integer(b) ** k / (k if k > 1 else 1)) for k, c in bterms])))
    if fn != "exp":
        pts.append(("Drops the alternating signs of the series.", mk([(k + a, abs(c) * sp.Integer(b) ** k) for k, c in bterms])))
    pts.append(("Forgets the factor $x^%d$ in front, so every power of $x$ is too small by %d." % (a, a), mk([(k, c * sp.Integer(b) ** k) for k, c in bterms])))
    pts.append(("Multiplies by $x^%d$ but writes the power one too high in every term." % a, mk([(p_ + 1, c) for p_, c in key_terms])))
    key_t = "$" + tex_asc(key_poly) + "$"
    ds, seen = [], {key_t}
    for w_, p_ in pts:
        tx = "$" + tex_asc(p_) + "$"
        if tx not in seen and p_ != 0:
            seen.add(tx); ds.append(W(tx, w_))
    if len(ds) < 3:
        raise ValueError("not_enough_distractors")
    stem = f"What are the first three nonzero terms of the Maclaurin series for $f(x)={fx_tex}$?"
    bpr = bpb("c_x4_maclaurin_compose", "10.14", "2.C", "not_allowed", "Build a Maclaurin series by substituting into a known series and multiplying by a power of x",
              ["Write the series for the basic function", "Replace x by bx and keep the powers of b", "Multiply by the power of x and list the first three nonzero terms"],
              [("Maclaurin series of cos u, sin u and e^u are known", "the substitution u = bx is valid for all x")],
              [("lost_power_prefix", "forgets the power-of-x factor"), ("wrong_signs", "drops the alternating signs"), ("scale_lost", "forgets b^k in each term"), ("wrong_denominators", "divides by exponent instead of factorial")],
              "the three-term polynomial and the exact function agree to within the size of the next term at x = 0.05 (independent of the symbolic series)")
    basic = tex_asc(sp.Add(*[c * U ** k for k, c in bterms]).subs(U, b * X))
    why = (f"The series for the basic function is ${basic}+\\cdots$" + (f" after replacing $u$ by ${b}x$" if b > 1 else "") + f"; multiplying by $x^{a}$ gives the first three nonzero terms ${tex_asc(key_poly)}$.")
    return finish("c_x4_maclaurin_compose", "10.14", "2.C", "not_allowed", stem, key_t, why, None, ds, rng, bpr, 105, [f"fn={fn},a={a},b={b}"])


# 10.11 테일러 다항식의 계수에서 도함수 값
def c_x4_taylor_deriv_from_poly(rng):
    a = rng.choice([1, 2, 3])
    c0, c1, c2, c3 = rng.choice([-3, 2, 5, 7]), rng.choice([-4, 3, 6]), rng.choice([-5, -3, 2, 4, 6]), rng.choice([-4, -2, 3, 5])
    which = rng.choice([2, 3])
    key = (2 * c2) if which == 2 else (6 * c3)
    Pp = c0 + c1 * (X - a) + c2 * (X - a) ** 2 + c3 * (X - a) ** 3
    num = sp.diff(Pp, X, which).subs(X, a)
    if num != key:
        raise ValueError("independent_check_failed")
    c = c2 if which == 2 else c3
    ds = vopts([(f"Reports the coefficient ${c}$ itself instead of multiplying by ${math.factorial(which)}$ (the factorial).", c), (f"Multiplies by ${which}$ instead of ${which}!$.", which * c), (f"Divides by ${math.factorial(which)}$ instead of multiplying: this is the step used to build the coefficient.", sp.Rational(c, math.factorial(which))),
                (f"Multiplies the coefficient of the $(x-{a})^{3 if which == 2 else 2}$ term by ${math.factorial(which)}$ instead of using the coefficient of the $(x-{a})^{which}$ term.", (2 * c3) if which == 2 else (6 * c2))], key)
    pol = f"{c0}{'+' if c1 >= 0 else '-'}{abs(c1)}(x-{a}){'+' if c2 >= 0 else '-'}{abs(c2)}(x-{a})^2{'+' if c3 >= 0 else '-'}{abs(c3)}(x-{a})^3"
    dtex = "f^{\\prime\\prime}" if which == 2 else "f^{\\prime\\prime\\prime}"
    stem = f"The third-degree Taylor polynomial for a function $f$ about $x={a}$ is $P_3(x)={pol}$. What is the value of ${dtex}({a})$?"
    bpr = bpb("c_x4_taylor_deriv_from_poly", "10.11", "2.C", "not_allowed", "Read a derivative value from a Taylor polynomial: the coefficient of (x - a)^k is f^(k)(a)/k!",
              ["Identify the coefficient of (x - a)^k", "Multiply the coefficient by k! to recover f^(k)(a)"],
              [("the coefficient of (x - a)^k in the Taylor polynomial equals f^(k)(a)/k!", "definition of the Taylor polynomial")],
              [("coefficient_only", "forgets the factorial"), ("times_k", "multiplies by k instead of k!"), ("divides", "divides instead of multiplying"), ("wrong_term", "reads the wrong coefficient")],
              "the k-th derivative of the polynomial itself is evaluated at x = a with sympy (independent of the coefficient-factorial rule)")
    why = f"The coefficient of $(x-{a})^{which}$ is $\\dfrac{{f^{{({which})}}({a})}}{{{which}!}}={c}$, so $f^{{({which})}}({a})={c}\\cdot{math.factorial(which)}={key}$."
    return finish("c_x4_taylor_deriv_from_poly", "10.11", "2.C", "not_allowed", stem, E(key), why, key, ds, rng, bpr, 90, [f"a={a}", f"coefs={c0},{c1},{c2},{c3}", f"which={which}", f"key={key}"])


# 10.13 수렴 반지름의 범위: 중심 a, x1 에서 수렴, x2 에서 발산
def c_x4_radius_from_known_points(rng):
    a = rng.choice([1, 2, 3, 5])
    d1 = rng.choice([2, 3, 4]); d2 = d1 + rng.choice([2, 3])
    sgn = rng.choice([1, -1])
    x1, x2 = a + sgn * d1, a - sgn * d2 if rng.random() < 0.5 else a + sgn * d2
    key_t = f"${d1}\\le R\\le {d2}$"
    ds = [W(f"$R={d1}$", f"The series converges at $x={x1}$, which is at distance ${d1}$ from the center, but that does not make ${d1}$ the radius: the radius could be anywhere from ${d1}$ up to ${d2}$."),
          W(f"$R={d2}$", f"The series diverges at $x={x2}$, but divergence at distance ${d2}$ only shows $R\\le{d2}$."),
          W(f"$R\\le{d1}$", f"Convergence at distance ${d1}$ from the center shows $R\\ge{d1}$, not $R\\le{d1}$."),
          W(f"$R\\ge{d2}$", f"Divergence at distance ${d2}$ from the center shows $R\\le{d2}$, not $R\\ge{d2}$.")]
    stem = f"A power series $\\displaystyle\\sum_{{n=0}}^{{\\infty}}c_n(x-{a})^n$ converges at $x={x1}$ and diverges at $x={x2}$. Which of the following must be true about the radius of convergence $R$ of the series?"
    bpr = bpb("c_x4_radius_from_known_points", "10.13", "3.E", "not_allowed", "Bound the radius of convergence from one point of convergence and one point of divergence",
              ["Compute the distance from the center to each point", "Convergence at distance d1 forces R >= d1", "Divergence at distance d2 forces R <= d2"],
              [("a power series converges absolutely for |x - a| < R and diverges for |x - a| > R", "behavior exactly at distance R is not determined")],
              [("equals_convergence_distance", "sets R to the distance of convergence"), ("equals_divergence_distance", "sets R to the distance of divergence"), ("reversed_lower_bound", "turns the lower bound into an upper bound"), ("reversed_upper_bound", "turns the upper bound into a lower bound")],
              "geometric power series with radius R on a grid are tested numerically at both points: the radii consistent with the data fill (d1, d2], and each wrong option is contradicted by one such series", None)
    why = f"The distance from the center ${a}$ to $x={x1}$ is ${d1}$; convergence there means $R\\ge{d1}$. The distance to $x={x2}$ is ${d2}$; divergence there means $R\\le{d2}$. So ${d1}\\le R\\le{d2}$."
    if abs(x1 - a) != d1 or abs(x2 - a) != d2 or d1 >= d2:
        raise ValueError("independent_check_failed")
    ok = lambda R_: 4000 * math.log(d1 / R_) < -14 and 4000 * math.log(d2 / R_) >= 0  # 등비급수 sum ((x-a)/R)^n: x1 에서 수렴, x2 에서 발산인가
    Rs = [d1 + (d2 - d1) * i / 50 for i in range(-10, 61)]
    good = [R_ for R_ in Rs if R_ > 0 and ok(R_)]
    if not good or min(good) <= d1 or max(good) > d2 + 1e-9 or not any(R_ > d1 + 1e-9 and R_ < d2 - 1e-9 for R_ in good) or not any(abs(R_ - d2) < 1e-9 for R_ in good):
        raise ValueError("independent_check_failed")
    return finish("c_x4_radius_from_known_points", "10.13", "3.E", "not_allowed", stem, key_t, why, None, ds, rng, bpr, 90, [f"a={a}", f"x1={x1},x2={x2}"])


# 10.1 부분합 표: 표의 S_n 으로 a_k 구하기
def c_x4_partial_sum_table(rng):
    for _ in forever():
        a = [rng.randint(-3, 9) for _ in range(6)]
        S_ = [sum(a[:i + 1]) for i in range(6)]
        k = rng.choice([4, 5, 6])
        if len({a[k - 1], S_[k - 1], S_[k - 1] + S_[k - 2], S_[k - 2] - S_[k - 1], S_[k - 1] - S_[k - 3]}) == 5 and a[k - 1] not in (0,):
            break
    if abs(a[k - 1] - (S_[k - 1] - S_[k - 2])) > 0:
        raise ValueError("independent_check_failed")
    ds = vopts([(f"Reports the partial sum $S_{k}$ itself instead of the single term $a_{k}$.", S_[k - 1]), (f"Adds the two partial sums $S_{k}+S_{k - 1}$.", S_[k - 1] + S_[k - 2]),
                (f"Subtracts in the wrong order, $S_{k - 1}-S_{k}$.", S_[k - 2] - S_[k - 1]), (f"Subtracts two partial sums that are two apart, $S_{k}-S_{k - 2}$, which equals $a_{k - 1}+a_{k}$.", S_[k - 1] - S_[k - 3])], a[k - 1])
    rows = [(i + 1, S_[i]) for i in range(6)]
    stem = f"The table gives the partial sums $S_n=\\displaystyle\\sum_{{i=1}}^{{n}}a_i$ of a series $\\displaystyle\\sum_{{i=1}}^{{\\infty}}a_i$ for $n=1,2,\\ldots,6$. What is the value of $a_{k}$?"
    bpr = bpb("c_x4_partial_sum_table", "10.1", "2.B", "not_allowed", "Recover a single term from consecutive partial sums: a_k = S_k - S_(k-1)",
              ["Read S_k and S_(k-1) from the table", "Subtract: the partial sums differ by exactly the k-th term"],
              [("S_k = S_(k-1) + a_k", "definition of partial sums")],
              [("partial_sum_not_term", "reports S_k"), ("sum_of_partial_sums", "adds partial sums"), ("reversed_difference", "subtracts in reverse"), ("two_term_difference", "subtracts partial sums two apart")],
              "the term list is rebuilt by cumulative summation of the generated terms and compared with the table differences (independent of the table subtraction)", {"type": "table", "must_include": ["n = 1 to 6", "S_n"]})
    return finish("c_x4_partial_sum_table", "10.1", "2.B", "not_allowed", stem, E(a[k - 1]), f"$a_{k}=S_{k}-S_{k - 1}={S_[k - 1]}-({S_[k - 2]})={a[k - 1]}$.", a[k - 1], ds, rng, bpr, 80, [f"a={a}", f"k={k}"], stim=tab("Partial sums of the series", "n", "S_n", rows))


# 10.15 급수의 처음 세 항을 항별로 적분해 정적분 근사(정확한 분수)
def c_x4_series_integral_estimate(rng):
    b = rng.choice([Fr(1, 2), Fr(1, 3), Fr(2, 3), Fr(1)])
    c = rng.choice([1, 2])
    # f(x) = e^{-c x^2} = 1 - c x^2 + c^2 x^4/2 - c^3 x^6/6 ...; 세 항을 적분
    coef = [(Fr(1), 0), (Fr(-c), 2), (Fr(c * c, 2), 4)]
    antid = lambda u, terms: sum(co * u ** (e + 1) / (e + 1) for co, e in terms)
    approx = antid(b, coef)
    # 독립 경로: 같은 세 항 다항식의 수치 적분
    poly = lambda u: 1 - c * u ** 2 + c * c * u ** 4 / 2
    if abs(QI.quad(poly, 0, float(b))[0] - float(approx)) > 1e-12:
        raise ValueError("independent_check_failed")
    two = antid(b, coef[:2])
    four = antid(b, coef + [(Fr(-c ** 3, 6), 6)])
    at_b = Fr(poly(float(b))).limit_denominator(10 ** 6)
    wrong_den = sum(co * b ** (e + 1) for co, e in coef)  # 적분하되 새 지수로 나누지 않는다
    t = lambda v: "$" + sp.latex(sp.Rational(v.numerator, v.denominator)) + "$"
    ds = vopts([("Uses only the first two nonzero terms of the series.", two), ("Evaluates the three-term polynomial at the upper limit instead of integrating it.", at_b),
                ("Adds the fourth nonzero term, which is $-\\dfrac{%sx^6}{6}$, so the result uses four terms." % co(c ** 3), four), ("Raises each power by one when integrating but forgets to divide by the new exponent.", wrong_den)], approx, t)
    bt = {Fr(1, 2): "\\dfrac12", Fr(1, 3): "\\dfrac13", Fr(2, 3): "\\dfrac23", Fr(1): "1"}[b]
    stem = f"The Maclaurin series for $e^{{-{co(c)}x^2}}$ is $1-{co(c)}x^2+\\dfrac{{{co(c * c)}x^4}}{{2}}-\\dfrac{{{co(c ** 3)}x^6}}{{6}}+\\cdots$. Using the first three nonzero terms of this series, what is the approximation of $\\displaystyle\\int_0^{{{bt}}}e^{{-{co(c)}x^2}}\\,dx$?"
    bpr = bpb("c_x4_series_integral_estimate", "10.15", "1.E", "not_allowed", "Approximate a definite integral by integrating the first terms of a Maclaurin series term by term",
              ["Write the first three nonzero terms of the series given in the stem", "Integrate each term from 0 to the upper limit", "Add the three exact values as a single fraction"],
              [("a power series may be integrated term by term inside its interval of convergence", "the interval of convergence of the series is all real numbers")],
              [("two_terms_only", "uses only two terms"), ("evaluates_polynomial", "evaluates instead of integrating"), ("extra_term", "adds a fourth term"), ("missing_division", "forgets the new exponent")],
              "scipy quad of the three-term polynomial over [0, b] (independent of the term-by-term antiderivatives)")
    why = f"$\\displaystyle\\int_0^{{{bt}}}\\left(1-{co(c)}x^2+\\dfrac{{{co(c * c)}x^4}}{{2}}\\right)dx=\\left[x-\\dfrac{{{co(c)}x^3}}{{3}}+\\dfrac{{{co(c * c)}x^5}}{{10}}\\right]_0^{{{bt}}}={t(approx).strip('$')}$."
    return finish("c_x4_series_integral_estimate", "10.15", "1.E", "not_allowed", stem, t(approx), why, approx, ds, rng, bpr, 105, [f"b={b},c={c}", f"approx={approx}"])


# 10.11 계산기: ln x 의 테일러 다항식 값
def c_x4_taylor_ln_calc(rng):
    a = rng.choice([2, 3, 4]); h = rng.choice([0.5, -0.5, 1.0, -1.0])
    x0 = a + h
    # P3(x) = ln a + (x-a)/a - (x-a)^2/(2a^2) + (x-a)^3/(3a^3)
    P3 = math.log(a) + h / a - h ** 2 / (2 * a ** 2) + h ** 3 / (3 * a ** 3)
    # 독립 경로: 도함수를 유한차분으로 구해 테일러 합을 만든다
    f = math.log
    d1 = (f(a + 1e-3) - f(a - 1e-3)) / 2e-3
    d2 = (f(a + 1e-3) - 2 * f(a) + f(a - 1e-3)) / 1e-6
    d3 = (f(a + 2e-2) - 2 * f(a + 1e-2) + 2 * f(a - 1e-2) - f(a - 2e-2)) / (2 * 1e-2 ** 3)
    P3n = f(a) + d1 * h + d2 * h ** 2 / 2 + d3 * h ** 3 / 6
    if abs(P3 - P3n) > 5e-4:
        raise ValueError("independent_check_failed")
    cands = [(math.log(a) + h / a - h ** 2 / (2 * a ** 2) + h ** 3 / (3 * a ** 3) + (-h ** 4 / (4 * a ** 4)), "Includes a fourth-degree term, so this is $P_4$, not $P_3$."), (math.log(a) + h / a - h ** 2 / a ** 2 + 2 * h ** 3 / a ** 3, "Omits the factorials: uses $f^{(k)}(a)(x-a)^k$ instead of $\\dfrac{f^{(k)}(a)}{k!}(x-a)^k$."),
             (math.log(a) + h / a + h ** 2 / (2 * a ** 2) + h ** 3 / (3 * a ** 3), "Uses the wrong sign for the second-degree term: $f''(a)=-\\dfrac{1}{a^2}$ is negative."), (math.log(x0), "Gives the exact value $\\ln(%.1f)$ instead of the value of the Taylor polynomial." % x0)]
    pool, seen = [], {"$%.4f$" % P3}
    for v, w in cands:
        tx = "$%.4f$" % v
        if tx not in seen:
            seen.add(tx); pool.append(Opt(tx, False, w, v))
    if len(pool) < 3:
        raise ValueError("not_enough_distractors")
    stem = f"Let $P_3(x)$ be the third-degree Taylor polynomial for $f(x)=\\ln x$ about $x={a}$. What is the value of $P_3({x0:g})$?"
    bpr = bpb("c_x4_taylor_ln_calc", "10.11", "1.E", "required", "Build and evaluate a Taylor polynomial of ln x about a point other than 1",
              ["Compute f(a), f'(a), f''(a), f'''(a) for f(x) = ln x", "Divide by factorials and multiply by powers of (x - a)", "Evaluate at the given x with a calculator"],
              [("f'(x) = 1/x, f''(x) = -1/x^2, f'''(x) = 2/x^3", "derivatives of ln x")],
              [("fourth_degree", "adds a degree-4 term"), ("no_factorials", "omits factorials"), ("sign_error", "wrong sign in second-degree term"), ("exact_function_value", "gives ln of the point")],
              "central finite differences of ln at the center build the polynomial (independent of the symbolic derivatives)")
    why = f"$P_3(x)=\\ln {a}+\\dfrac{{x-{a}}}{{{a}}}-\\dfrac{{(x-{a})^2}}{{{2 * a * a}}}+\\dfrac{{(x-{a})^3}}{{{3 * a ** 3}}}$, and $P_3({x0:g})={P3:.4f}$."
    return finish("c_x4_taylor_ln_calc", "10.11", "1.E", "required", stem, "$%.4f$" % P3, why, P3, pool, rng, bpr, 105, [f"a={a},h={h}", f"P3={P3:.6f}"])


# 10.1 그래프: 부분합 그래프에서 항 읽기
def g_x4_partial_sum_term_graph(rng):
    xs = list(range(1, 9))
    for _ in forever():
        v = [rng.randint(-3, 9) for _ in xs]
        k = rng.choice([3, 4, 5, 6, 7])
        a_k = v[k - 1] - v[k - 2]
        if a_k != 0 and len({a_k, v[k - 1], v[k - 2] - v[k - 1], v[k - 1] + v[k - 2], v[k - 1] - v[k - 3]}) == 5 and abs(a_k) >= 2:
            break
    f = PL(xs, v)
    if abs(f.num(k) - f.num(k - 1) - a_k) > 1e-12:
        raise ValueError("independent_check_failed")
    ds = [Opt(fx(z), False, w, z) for w, z in [(f"Reports the height of the graph at $n={k}$, which is the partial sum $S_{k}$, not the term.", v[k - 1]), (f"Subtracts in the wrong order, $S_{k - 1}-S_{k}$.", v[k - 2] - v[k - 1]),
                                                (f"Adds the heights at $n={k - 1}$ and $n={k}$.", v[k - 1] + v[k - 2]), (f"Subtracts the heights at $n={k - 2}$ and $n={k}$, which equals $a_{k - 1}+a_{k}$.", v[k - 1] - v[k - 3])] if z != a_k]
    stem = f"The graph shows the partial sums $S_n=\\displaystyle\\sum_{{i=1}}^{{n}}a_i$ of a series for $n=1,2,\\ldots,8$; consecutive points are connected by line segments. What is the value of $a_{k}$?"
    bpr = bpb("g_x4_partial_sum_term_graph", "10.1", "2.B", "not_allowed", "Read a series term from a graph of its partial sums: a_k = S_k - S_(k-1)",
             ["Read the heights of the graph at n = k and n = k - 1", "Subtract: the vertical change between consecutive points is the term"],
             [("S_k = S_(k-1) + a_k", "definition of partial sums; the vertices are at integer n")],
             [("height_not_change", "reports the height S_k itself"), ("reversed_difference", "reverses the subtraction"), ("sum_of_heights", "adds the two heights"), ("two_step_change", "subtracts heights two steps apart")],
             "difference of the interpolated graph heights at n = k and n = k - 1 (independent of reading the vertices)", {"type": "graph", "must_include": ["points of S_n at n = 1 to 8"]})
    lo, hi = min(0, min(v)) - 1, max(0, max(v)) + 1
    return gpack("g_x4_partial_sum_term_graph", "10.1", "2.B", "not_allowed", stem, Opt(fx(a_k), True, f"$a_{k}=S_{k}-S_{k - 1}$ is the vertical change of the graph from $n={k - 1}$ to $n={k}$.", a_k), ds, rng,
                 gstim("Graph of the partial sums S_n for n from 1 to 8, with consecutive points connected by line segments.", [("S", f.vert())], axis("n", 1, 8, 1), axis("S_n", lo, hi, 1)), bpr, 85, [f"v={v}", f"k={k}"])


STAGE_LISTS = {"supp_x4b_bc": ["c_x4_nth_term_test", "c_x4_p_series_range", "c_x4_limit_comparison_value", "c_x4_ratio_inconclusive", "c_x4_abs_cond_classify", "c_x4_alt_error_bound_value", "c_x4_geom_sum_equation", "c_x4_repeating_decimal",
                                  "c_x4_integral_test_log_p", "c_x4_series_derivative_closed", "c_x4_maclaurin_compose", "c_x4_taylor_deriv_from_poly", "c_x4_radius_from_known_points", "c_x4_partial_sum_table", "c_x4_series_integral_estimate",
                                  "c_x4_taylor_ln_calc", "g_x4_partial_sum_term_graph"]}
