"""R3 예비 3차 b1(AB, 계산기 불가): 단원 1(극한·연속) 10종 + 단원 2(미분의 정의·기본 성질) 12종. 모든 정답은 정확 계산(유리수·sympy)으로 구하고, 별도 수치 경로(고정밀 대입·중심차분·근 찾기)로 다시 확인한다.
단원 2에는 연쇄법칙이 필요한 식을 쓰지 않는다(e^x, ln x, sin x, cos x, 거듭제곱, 곱·몫만)."""
from scommon import *
import math
import numpy as _np

AB_ = "ap_calculus_ab"


def M(v):
    """수식 조각(문맥에 따라 $...$ 로 감싸지거나 이미 수식 안이면 그대로): 최종 _post 에서 정리한다."""
    return "\x01" + sp.latex(sp.sympify(v)).replace("\\log", "\\ln") + "\x02"


def _post(s):
    out, inm = [], False
    for ch in s:
        if ch == "$":
            inm = not inm
            out.append(ch)
        elif ch in "\x01\x02":
            out.append("" if inm else "$")
        else:
            out.append(ch)
    return "".join(out)


def _chk(a, b, tol=1e-6):
    if abs(float(a) - float(b)) > tol * max(1.0, abs(float(b))):
        raise ValueError("independent_check_failed")


def _tx(e):
    return sp.latex(e).replace("\\log", "\\ln")


def _E(v):
    return M(v)


def _bpr(arch, topic, skill, concept, thinking, cond, mis, path):
    return nb(arch, topic, skill, "not_allowed", concept, thinking, cond, mis, path, AB_)


def _fin(arch, topic, skill, stem, key, pool, rng, bpr, est, facts):
    p = build(arch, topic, skill, "not_allowed", stem, key, pool, rng, bpr, est, facts)
    p["stem"] = _post(p["stem"])
    for o in p["options"]:
        o["text"] = _post(o["text"])
        o["why"] = _post(o["why"])
    for mi in p["blueprint"]["misconceptions"]:
        mi["description"] = _post(mi["description"])
    return p


def _ex(trips, key_v, rng_unused=None):
    """trips: [(id, why, value)] -> 값이 다른 Opt(오답) 목록."""
    return opts([(w, v) for _, w, v in trips], key_v, lambda v: "$" + _tx(sp.sympify(v)) + "$")


def _mis(trips):
    return [(i, w) for i, w, _ in trips]


def _rn(rng, lo, hi):
    return rnd(rng, lo, hi)


# ===================================================================== 단원 1
# 1.15 지수함수 유리식의 두 수평 점근선(x -> ∞ 와 x -> -∞)
def c_horizontal_asymptotes_exp_ratio(rng):
    for _ in forever():
        a, c = rng.randint(1, 7), rng.randint(1, 4)
        b, d = _rn(rng, -6, 6), rng.randint(1, 4)
        if S(a) / c == S(b) / d or a + b == 0 or c + d == 0:
            continue
        up, down = S(a) / c, S(b) / d
        key_v = up + down
        f = lambda u: (a * math.exp(u) + b) / (c * math.exp(u) + d)
        _chk(f(40) + f(-40), key_v, 1e-6)
        trips = [("one_end_only_up", f"Finds only the asymptote as $x\\to\\infty$, $y={_tx(up)}$, and forgets the one as $x\\to-\\infty$.", up),
                 ("one_end_only_down", f"Finds only the asymptote as $x\\to-\\infty$, $y={_tx(down)}$, and forgets the one as $x\\to\\infty$.", down),
                 ("difference", f"Subtracts the two asymptote values, {_E(up)} and {_E(down)}, instead of adding them.", up - down),
                 ("value_at_zero", f"Substitutes $x=0$, where $e^{{0}}=1$, and reports $f(0)=\\dfrac{{{a}+({b})}}{{{c}+{d}}}={_tx(S(a + b) / (c + d))}$, which is not an asymptote value.", S(a + b) / (c + d))]
        try:
            pool = _ex(trips, key_v)
        except ValueError:
            continue
        break
    stem = f"The graph of $f(x)=\\dfrac{{{_tx(a * sp.exp(x) + b)}}}{{{_tx(c * sp.exp(x) + d)}}}$ has two horizontal asymptotes, $y=L_1$ and $y=L_2$. What is the value of $L_1+L_2$?"
    key = Opt(M(key_v), True, f"As $x\\to\\infty$, $e^{{x}}\\to\\infty$ and $f(x)\\to\\dfrac{{{a}}}{{{c}}}={M(up)}$. As $x\\to-\\infty$, $e^{{x}}\\to 0$ and $f(x)\\to\\dfrac{{{b}}}{{{d}}}={M(down)}$. So $L_1+L_2={M(key_v)}$.", key_v)
    bpr = _bpr("c_horizontal_asymptotes_exp_ratio", "1.15", "1.D", "Find both horizontal asymptotes of a ratio of exponential expressions by letting e^x tend to infinity and to 0",
               ["Take x to infinity, where e^x dominates, and divide by e^x", "Take x to negative infinity, where e^x tends to 0, and substitute", "Add the two asymptote values as asked"],
               [("e^x tends to infinity as x grows and to 0 as x decreases without bound", "the denominator stays positive")], _mis(trips),
               "direct evaluation of f at x = 40 and x = -40 (independent of the dominant-term argument)")
    return _fin("c_horizontal_asymptotes_exp_ratio", "1.15", "1.D", stem, key, pool, rng, bpr, 85, [f"a={a}", f"b={b}", f"c={c}", f"d={d}", f"key={key_v}"])


# 1.15 x -> -∞ 에서 근호가 있는 유리식: sqrt(x^2) = |x|
def c_lim_neg_inf_radical(rng):
    for _ in forever():
        m = rng.choice([2, 3])
        c = m * m
        a = rng.choice([2, 3, 4, 5, 6, 7])
        b = _rn(rng, -5, 5)
        d = rng.choice([1, 2, 3, 5, 7])
        f = (a * x + b) / sp.sqrt(c * x ** 2 + d)
        key_v = S(-a) / m
        _chk(float(sp.N(f.subs(x, -10 ** 8), 30)), key_v, 1e-5)
        trips = [("positive_sign", f"Uses $\\sqrt{{x^{{2}}}}=x$, but for $x<0$ we have $\\sqrt{{x^{{2}}}}=|x|=-x$, so the sign is lost and the result is {_E(S(a) / m)}.", S(a) / m),
                 ("forgets_root", f"Divides by {_E(c)} instead of by $\\sqrt{{{c}}}={m}$, forgetting to take the square root of the coefficient under the radical.", S(-a) / c),
                 ("ignores_coefficient", f"Treats $\\sqrt{{{c}x^{{2}}+{d}}}$ as $|x|$, ignoring the factor $\\sqrt{{{c}}}={m}$, which gives {_E(-a)}.", S(-a)),
                 ("degree_compare", "Compares the power $1$ in the numerator with the power $2$ under the radical as if the denominator had degree $2$, which gives $0$.", S(0))]
        try:
            pool = _ex(trips, key_v)
        except ValueError:
            continue
        break
    stem = f"What is $\\displaystyle\\lim_{{x\\to-\\infty}}\\dfrac{{{_tx(a * x + b)}}}{{\\sqrt{{{_tx(c * x ** 2 + d)}}}}}$?"
    key = Opt(M(key_v), True, f"For $x<0$, $\\sqrt{{{c}x^{{2}}+{d}}}\\approx {m}|x|=-{m}x$, so the quotient behaves like $\\dfrac{{{a}x}}{{-{m}x}}={M(key_v)}$ as $x\\to-\\infty$.", key_v)
    bpr = _bpr("c_lim_neg_inf_radical", "1.15", "1.E", "Limit at negative infinity of a quotient with a square root, where sqrt(x^2) equals |x| = -x",
               ["Factor the dominant term out of the radical", "Use sqrt(x^2) = |x| = -x because x is negative", "Cancel x and read off the horizontal asymptote value"],
               [("for x < 0 the radical is positive and equals the coefficient times |x|", "x approaches negative infinity")], _mis(trips),
               "direct evaluation at x = -10^8 with 30-digit arithmetic (independent of the |x| algebra)")
    return _fin("c_lim_neg_inf_radical", "1.15", "1.E", stem, key, pool, rng, bpr, 90, [f"a={a}", f"m={m}", f"key={key_v}"])


# 1.14 수직 점근선의 개수: 약분되는 인수(구멍)와 x절편을 구별
def c_count_vertical_asymptotes(rng):
    for _ in forever():
        pts = rng.sample(range(-5, 6), 5)
        pp, qq, ss, mm = pts[0], pts[1], pts[2], pts[3]
        num = (x - pp) * (x - mm)
        den = (x - pp) * (x - qq) * (x - ss)
        break
    key_v = 2
    # 독립 경로: 각 분모 영점 z 에서 |f(z ± 1e-7)| 이 매우 크면 점근선
    f = sp.lambdify(x, num / den, "math")
    cnt = sum(1 for z in (pp, qq, ss) if abs(f(z + 1e-7)) > 1e4 and abs(f(z - 1e-7)) > 1e4)
    if cnt != key_v:
        raise ValueError("independent_check_failed")
    trips = [("counts_hole", f"Counts all three zeros of the denominator, $x={pp}$, $x={qq}$ and $x={ss}$, including $x={pp}$ where the common factor ${_tx(x - pp)}$ cancels and leaves a hole.", S(3)),
             ("counts_all_zeros", f"Counts every value that makes the numerator or the denominator zero: $x={pp}$, $x={mm}$, $x={qq}$ and $x={ss}$.", S(4)),
             ("counts_x_intercepts", f"Counts the $x$-intercept at $x={mm}$, the only zero of the numerator that is not cancelled, instead of the vertical asymptotes.", S(1))]
    pool = _ex(trips, key_v)
    stem = f"How many vertical asymptotes does the graph of $f(x)=\\dfrac{{{_tx(sp.Mul(x - pp, x - mm, evaluate=False))}}}{{{_tx(sp.Mul(x - pp, x - qq, x - ss, evaluate=False))}}}$ have?"
    key = Opt(M(key_v), True, f"The factor ${_tx(x - pp)}$ cancels, leaving a removable discontinuity at $x={pp}$. The denominator still vanishes at $x={qq}$ and $x={ss}$ while the numerator does not, so there are 2 vertical asymptotes.", key_v)
    bpr = _bpr("c_count_vertical_asymptotes", "1.14", "1.D", "Count vertical asymptotes of a factored rational function, separating cancelled factors (holes) from true asymptotes",
               ["Find the zeros of the denominator", "Cancel any common factor with the numerator: that zero is a hole, not an asymptote", "Count the remaining denominator zeros where the numerator is nonzero"],
               [("a vertical asymptote needs the denominator to be zero while the numerator is not zero in the reduced form", "one factor of the denominator cancels with the numerator")], _mis(trips),
               "numerical evaluation of |f| just left and right of each denominator zero (independent of the factor cancellation)")
    return _fin("c_count_vertical_asymptotes", "1.14", "1.D", stem, key, pool, rng, bpr, 70, [f"p={pp}", f"q={qq}", f"s={ss}", f"m={mm}"])


# 1.3 절댓값 몫의 한쪽 극한
def c_one_sided_abs_quotient(rng):
    a = rng.choice([2, 3, 4, 5])
    left = rng.random() < 0.5
    sg = -1 if left else 1
    f = lambda u: abs(u - a) / (u * u - a * a)
    key_v = S(sg) / (2 * a)
    _chk(f(a + sg * 1e-8) if False else f(a - 1e-8 if left else a + 1e-8), key_v, 1e-5)
    sd = "^-" if left else "^+"
    trips = [("opposite_sign", f"Uses $|x-{a}|=x-{a}$ on the wrong side of $x={a}$, so the sign of the answer is reversed: {_E(-key_v)}.", -key_v),
             ("zero_numerator", "Substitutes into the numerator only, where $|x-%d|\\to 0$, and reports $0$ without cancelling the zero in the denominator." % a, S(0)),
             ("drops_two", f"Cancels correctly but replaces $x+{a}$ by {_E(a)} instead of {_E(2 * a)}, giving {_E(S(sg) / a)}.", S(sg) / a),
             ("only_sign", f"Cancels $|x-{a}|$ against $x-{a}$ to get only the sign {_E(sg)} and drops the factor $x+{a}$ of the denominator entirely, giving {_E(sg)}.", S(sg))]
    pool = _ex(trips, key_v)
    stem = f"What is $\\displaystyle\\lim_{{x\\to {a}{sd}}}\\dfrac{{|x-{a}|}}{{x^{{2}}-{a * a}}}$?"
    side = "less" if left else "greater"
    sgn_w = f"$|x-{a}|=-(x-{a})$" if left else f"$|x-{a}|=x-{a}$"
    key = Opt(M(key_v), True, f"For $x$ {side} than ${a}$, {sgn_w}, so the quotient equals $\\dfrac{{{'-' if left else ''}(x-{a})}}{{(x-{a})(x+{a})}}={'-' if left else ''}\\dfrac{{1}}{{x+{a}}}$, which approaches {M(key_v)}.", key_v)
    bpr = _bpr("c_one_sided_abs_quotient", "1.3", "1.E", "One-sided limit of a quotient containing an absolute value, found by rewriting |x - a| on the correct side",
               ["Rewrite the absolute value without bars for the side being approached", "Factor and cancel the common factor", "Evaluate the remaining expression at x = a"],
               [("on each side of a, |x - a| equals x - a or -(x - a)", "the limit is one-sided")], _mis(trips),
               "numerical evaluation of the quotient at x = a minus or plus 1e-8 on the stated side (independent of the algebra)")
    return _fin("c_one_sided_abs_quotient", "1.3", "1.E", stem, key, pool, rng, bpr, 75, [f"a={a}", f"left={left}", f"key={key_v}"])


# 1.5 sin(ax)/(bx)
def c_trig_limit_sine_ratio(rng):
    for _ in forever():
        a, b = rng.randint(2, 7), rng.randint(2, 7)
        if a == b:
            continue
        key_v = S(a) / b
        _chk(math.sin(a * 1e-5) / (b * 1e-5), key_v, 1e-6)
        trips = [("inverted", f"Inverts the ratio and reports {_E(S(b) / a)}, the reciprocal of {_E(key_v)}.", S(b) / a),
                 ("drops_a", f"Uses $\\lim_{{x\\to 0}}\\dfrac{{\\sin x}}{{x}}=1$ without accounting for the factor {_E(a)} inside the sine, leaving $\\dfrac{{1}}{{{b}}}$.", S(1) / b),
                 ("forgets_b", f"Rewrites $\\dfrac{{\\sin({a}x)}}{{{a}x}}\\to 1$ and multiplies by {_E(a)}, but forgets to divide by {_E(b)}, giving {_E(a)}.", S(a)),
                 ("zero_over_zero", "Reads the form $\\dfrac{0}{0}$ as $0$ after substituting $x=0$.", S(0))]
        try:
            pool = _ex(trips, key_v)
        except ValueError:
            continue
        break
    stem = f"What is $\\displaystyle\\lim_{{x\\to 0}}\\dfrac{{\\sin({a}x)}}{{{b}x}}$?"
    key = Opt(M(key_v), True, f"Write $\\dfrac{{\\sin({a}x)}}{{{b}x}}=\\dfrac{{{a}}}{{{b}}}\\cdot\\dfrac{{\\sin({a}x)}}{{{a}x}}$; since $\\dfrac{{\\sin u}}{{u}}\\to 1$ as $u\\to 0$, the limit is {M(key_v)}.", key_v)
    bpr = _bpr("c_trig_limit_sine_ratio", "1.5", "1.C", "Limit of sin(ax)/(bx) at 0 using the special trigonometric limit sin u / u -> 1",
               ["Recognize the 0/0 form", "Multiply and divide to build sin(u)/u with u = ax", "Apply sin u / u -> 1 and keep the leftover constant ratio"],
               [("sin u / u -> 1 as u -> 0", "u = ax tends to 0")], _mis(trips),
               "direct evaluation at x = 1e-5 (independent of the special limit)")
    return _fin("c_trig_limit_sine_ratio", "1.5", "1.C", stem, key, pool, rng, bpr, 65, [f"a={a}", f"b={b}"])


# 1.13 제거 가능한 불연속: 연속이 되게 하는 f(a)
def c_removable_value_power_ratio(rng):
    for _ in forever():
        n, m = rng.choice([(3, 2), (2, 3), (4, 2), (4, 3)])
        a = rng.choice([2, 3])
        key_v = sp.limit((x ** n - a ** n) / (x ** m - a ** m), x, a)
        f = lambda u: (u ** n - a ** n) / (u ** m - a ** m)
        _chk((f(a + 1e-6) + f(a - 1e-6)) / 2, key_v, 1e-4)
        trips = [("zero", f"Substitutes $x={a}$ and reads the $\\dfrac{{0}}{{0}}$ form as $0$.", S(0)),
                 ("exponent_ratio", f"Uses only the ratio of the exponents {_E(n)} and {_E(m)}, forgetting the factor ${a}^{{{n - m}}}={_tx(S(a) ** (n - m))}$ that comes from the powers of $x$ at $x={a}$: {_E(S(n) / m)}.", S(n) / m),
                 ("power_only", f"Keeps the factor ${a}^{{{n - m}}}={_tx(S(a) ** (n - m))}$ but drops the exponent ratio $\\dfrac{{{n}}}{{{m}}}$.", S(a) ** (n - m)),
                 ("inverted", f"Inverts the exponent ratio, using $\\dfrac{{{m}}}{{{n}}}\\cdot {a}^{{{m - n}}}={M(S(m) * S(a) ** (m - n) / n)}$.", S(m) * S(a) ** (m - n) / n)]
        try:
            pool = _ex(trips, key_v)
        except ValueError:
            continue
        break
    stem = f"The function $f$ is defined by $f(x)=\\dfrac{{x^{{{n}}}-{a ** n}}}{{x^{{{m}}}-{a ** m}}}$ for $x\\ne {a}$, and $f({a})=k$. For what value of $k$ is $f$ continuous at $x={a}$?"
    key = Opt(M(key_v), True, f"Continuity requires $k=\\lim_{{x\\to {a}}}f(x)$. Factoring out $x-{a}$ in numerator and denominator and cancelling leaves a quotient whose value at $x={a}$ is {M(key_v)}.", key_v)
    bpr = _bpr("c_removable_value_power_ratio", "1.13", "1.E", "Choose the value that removes a removable discontinuity by evaluating the limit of a difference-of-powers quotient",
               ["Recognize that continuity at a requires f(a) to equal the limit", "Factor x - a from the numerator and denominator and cancel", "Evaluate the reduced expression at x = a"],
               [("f is continuous at a when f(a) equals the limit as x approaches a", "the limit exists because the common factor cancels")], _mis(trips),
               "numerical average of f(a - 1e-6) and f(a + 1e-6) (independent of factoring)")
    return _fin("c_removable_value_power_ratio", "1.13", "1.E", stem, key, pool, rng, bpr, 85, [f"n={n}", f"m={m}", f"a={a}", f"k={key_v}"])


# 1.11/1.12 세 조각 함수가 모든 x 에서 연속이 되는 두 상수: a + b
def c_cont_three_pieces_two_unknowns(rng):
    for _ in forever():
        e = rng.choice([2, 3])
        b = rng.randint(1, 4)
        mm = rng.randint(1, 5)
        n = 9 * b - 3 * mm
        a = b - e
        key_v = S(a + b)
        b1 = S(3 * mm + n) / 3  # 9b -> 3b
        trips = [("square_dropped", f"At $x=3$ evaluates the middle piece as ${'b'}\\cdot 3$ instead of $b\\cdot 3^{{2}}$, getting $b={M(b1)}$ and then $a={M(b1 - e)}$, so $a+b={M(2 * b1 - e)}$.", 2 * b1 - e),
                 ("sign_slip", f"At $x=1$ writes $a={'b'}+{e}$ instead of $a=b-{e}$, so $a+b={M(2 * b + e)}$.", S(2 * b + e)),
                 ("only_a", f"Finds the correct $a={M(a)}$ but reports it instead of $a+b$.", S(a)),
                 ("forgets_n", f"At $x=3$ matches $9b$ with ${3 * mm}$ only, forgetting the constant ${n}$ of the right piece, so $b={_tx(S(3 * mm) / 9)}$, $a=b-{e}$ and $a+b={M(2 * S(3 * mm) / 9 - e)}$.", 2 * S(3 * mm) / 9 - e)]
        try:
            pool = _ex(trips, key_v)
        except ValueError:
            continue
        break
    # 독립 경로: 구한 a, b 로 만든 함수의 좌우 극한을 수치로 확인
    fl = lambda u: e * u + a
    fm = lambda u: b * u * u
    fr = lambda u: mm * u + n
    if abs(fl(1) - fm(1)) > 1e-9 or abs(fm(3) - fr(3)) > 1e-9:
        raise ValueError("independent_check_failed")
    stem = (f"Let $a$ and $b$ be constants, and let $f(x)=\\begin{{cases}} {_tx(e * x)}+a & x<1\\\\ bx^{{2}} & 1\\le x\\le 3\\\\ {_tx(mm * x + n)} & x>3\\end{{cases}}$. "
            "If $f$ is continuous for all real $x$, what is the value of $a+b$?")
    key = Opt(M(key_v), True, f"Continuity at $x=1$: ${e}+a=b$. Continuity at $x=3$: $9b={mm * 3}+({n})={3 * mm + n}$, so $b={b}$ and $a=b-{e}={a}$, giving $a+b={M(key_v)}$.", key_v)
    bpr = _bpr("c_cont_three_pieces_two_unknowns", "1.12", "1.E", "Find two constants that make a three-piece function continuous at both break points",
               ["Write the continuity condition at each break point", "Solve the condition at x = 3 for b, then the condition at x = 1 for a", "Combine the constants as asked"],
               [("a function is continuous at a break point when the one-sided values match", "two break points give two equations for two unknowns")], _mis(trips),
               "substitute the constants back and compare the piece values at x = 1 and x = 3 numerically")
    return _fin("c_cont_three_pieces_two_unknowns", "1.12", "1.E", stem, key, pool, rng, bpr, 100, [f"e={e}", f"b={b}", f"a={a}", f"m={mm}", f"n={n}"])


# 1.16 중간값 정리: 다항식의 영점이 보장되는 구간
def c_ivt_root_interval_polynomial(rng):
    for _ in forever():
        p, q, r = _rn(rng, -4, 4), _rn(rng, -6, 6), _rn(rng, -9, 9)
        fv = lambda k: k ** 3 + p * k ** 2 + q * k + r
        ks = list(range(-3, 4))
        vals = {k: fv(k) for k in ks}
        if any(v == 0 for v in vals.values()):
            continue
        change = [k for k in ks[:-1] if vals[k] * vals[k + 1] < 0]
        same_pos = [k for k in ks[:-1] if vals[k] > 0 and vals[k + 1] > 0]
        same_neg = [k for k in ks[:-1] if vals[k] < 0 and vals[k + 1] < 0]
        if len(change) != 1 or not same_pos or not same_neg:
            continue
        key_k = change[0]
        pos_k = rng.choice(same_pos)
        neg_k = rng.choice(same_neg)
        rest = [k for k in same_pos + same_neg if k not in (pos_k, neg_k)]
        if not rest:
            continue
        oth_k = rng.choice(rest)
        # 독립 경로: numpy 영점
        rts = [z.real for z in _np.roots([1, p, q, r]) if abs(z.imag) < 1e-9]
        if sum(1 for z in rts if key_k < z < key_k + 1) != 1:
            raise ValueError("independent_check_failed")
        break
    fexpr = x ** 3 + p * x ** 2 + q * x + r

    def iv(k):
        return f"$[{k},{k + 1}]$"

    def why_same(k):
        sgn = "positive" if vals[k] > 0 else "negative"
        return f"$f({k})={vals[k]}$ and $f({k + 1})={vals[k + 1]}$ are both {sgn}, so $0$ is not between them and the Intermediate Value Theorem guarantees no zero here."

    pool = [Opt(iv(pos_k), False, why_same(pos_k), None), Opt(iv(neg_k), False, why_same(neg_k), None), Opt(iv(oth_k), False, why_same(oth_k), None)]
    stem = f"The function $f(x)={_tx(fexpr)}$ is continuous for all real $x$. On which of the following intervals does the Intermediate Value Theorem guarantee a solution to $f(x)=0$?"
    key = Opt(iv(key_k), True, f"$f({key_k})={vals[key_k]}$ and $f({key_k + 1})={vals[key_k + 1]}$ have opposite signs, so $0$ is between them and, since $f$ is continuous, there is a zero in $({key_k},{key_k + 1})$.", None)
    mis = [("both_positive", "endpoint values are both positive, so the theorem gives no zero"), ("both_negative", "endpoint values are both negative, so the theorem gives no zero"), ("same_sign_other", "another interval with endpoint values of the same sign")]
    bpr = _bpr("c_ivt_root_interval_polynomial", "1.16", "3.D", "Use the Intermediate Value Theorem on a polynomial to find the interval that must contain a zero, by comparing endpoint signs",
               ["Check continuity of the polynomial", "Evaluate f at the interval endpoints", "Select the interval where the endpoint values have opposite signs"],
               [("the endpoint values bracket 0 when their signs differ", "f is a polynomial, hence continuous")], mis,
               "numpy.roots of the cubic: exactly one real root lies in the key interval")
    return _fin("c_ivt_root_interval_polynomial", "1.16", "3.D", stem, key, pool, rng, bpr, 80, [f"f={fexpr}", f"key=[{key_k},{key_k + 1}]"])


# 1.8 조임 정리: 식으로 주어진 위·아래 경계
def c_squeeze_polynomial_bounds(rng):
    for _ in forever():
        c = rng.choice([1, 2, 3])
        k = rng.choice([1, 2])
        b, d = _rn(rng, -4, 6), _rn(rng, -6, 6)
        g = -x ** 2 + b * x + d
        h = sp.expand(g + k * (x - c) ** 2)
        key_v = g.subs(x, c)
        trips = [("wrong_point", f"Evaluates the lower bound at $x=0$ instead of $x={c}$: $g(0)={M(g.subs(x, 0))}$.", g.subs(x, 0)),
                 ("adds_bounds", f"Adds the two limits of the bounds, {_E(g.subs(x, c))} and {_E(h.subs(x, c))}, instead of using their common value.", g.subs(x, c) + h.subs(x, c)),
                 ("upper_bound_wrong_point", f"Evaluates the upper bound at $x=0$ instead of $x={c}$: $h(0)={M(h.subs(x, 0))}$.", h.subs(x, 0)),
                 ("derivative_of_bound", f"Uses the slope $g'({c})={M(sp.diff(g, x).subs(x, c))}$ of the lower bound instead of its value.", sp.diff(g, x).subs(x, c))]
        try:
            pool = _ex(trips, key_v)
        except ValueError:
            continue
        break
    # 독립 경로: 두 경계의 수치 극한이 같은 값으로 모이는지
    for eps in (1e-5, 1e-7):
        gl = sp.lambdify(x, g, "math")
        hl = sp.lambdify(x, h, "math")
        if abs(gl(c + eps) - float(key_v)) > 1e-3 or abs(hl(c - eps) - float(key_v)) > 1e-3:
            raise ValueError("independent_check_failed")
    stem = f"The function $f$ satisfies $g(x)\\le f(x)\\le h(x)$ for all real $x$, where $g(x)={_tx(g)}$ and $h(x)={_tx(h)}$. What is $\\displaystyle\\lim_{{x\\to {c}}}f(x)$?"
    key = Opt(M(key_v), True, f"$\\lim_{{x\\to {c}}}g(x)=g({c})={M(key_v)}$ and $\\lim_{{x\\to {c}}}h(x)=h({c})={M(h.subs(x, c))}$ are equal, so by the Squeeze Theorem $\\lim_{{x\\to {c}}}f(x)={M(key_v)}$.", key_v)
    bpr = _bpr("c_squeeze_polynomial_bounds", "1.8", "3.D", "Apply the Squeeze Theorem with two polynomial bounds that agree in the limit at one point",
               ["Evaluate the limit of each bound at the approach point", "Confirm the two limits are equal", "Conclude the limit of f equals that common value"],
               [("both bounds have the same limit at the approach point", "g(c) = h(c)")], _mis(trips),
               "numerical evaluation of both bounds just beside the approach point (independent of the substitution)")
    return _fin("c_squeeze_polynomial_bounds", "1.8", "3.D", stem, key, pool, rng, bpr, 80, [f"c={c}", f"g={g}", f"h={h}"])


# 1.6 극한의 성질(합·곱·몫·거듭제곱)로 주어진 두 극한에서 새 극한을 계산
def c_limit_laws_from_given_limits(rng):
    for _ in forever():
        c = rng.choice([1, 2, 3, 4])
        p, q = _rn(rng, -4, 5), _rn(rng, -4, 5)
        k = rng.choice([2, 3, 4, 5])
        if p + q == 0 or p == q or p * p - k * q == 0:
            continue
        key_v = S(p * p - k * q) / (p + q)
        # 독립 경로: 실제 함수 f(x)=p+(x-c), g(x)=q-2(x-c) 의 몫을 c 근처에서 평가
        fl = lambda u: p + (u - c)
        gl = lambda u: q - 2 * (u - c)
        e = 1e-8
        _chk((fl(c + e) ** 2 - k * gl(c + e)) / (fl(c + e) + gl(c + e)), key_v, 1e-5)
        trips = [("square_as_double", f"Replaces $\\lim f(x)^{{2}}$ by $2\\cdot {p}={2 * p}$ instead of $({p})^{{2}}={p * p}$: {_E(S(2 * p - k * q) / (p + q))}.", S(2 * p - k * q) / (p + q)),
                 ("sign_of_second_term", f"Adds $k\\lim g(x)$ instead of subtracting it: $\\dfrac{{{p * p}+{k * q}}}{{{p + q}}}={_tx(S(p * p + k * q) / (p + q))}$.".replace("+-", "-"), S(p * p + k * q) / (p + q)),
                 ("drops_denominator", f"Takes the limit of the numerator only, ${p * p}-{k}({q})={p * p - k * q}$, and forgets to divide by $\\lim(f(x)+g(x))={p + q}$.", S(p * p - k * q)),
                 ("denominator_difference", f"Uses $\\lim(f(x)-g(x))={p - q}$ in the denominator instead of $\\lim(f(x)+g(x))={p + q}$: {_E(S(p * p - k * q) / (p - q))}.", S(p * p - k * q) / (p - q))]
        try:
            pool = _ex(trips, key_v)
        except ValueError:
            continue
        break
    stem = f"Let $f$ and $g$ be functions with $\\displaystyle\\lim_{{x\\to {c}}}f(x)={p}$ and $\\displaystyle\\lim_{{x\\to {c}}}g(x)={q}$. What is $\\displaystyle\\lim_{{x\\to {c}}}\\dfrac{{\\left(f(x)\\right)^{{2}}-{k}g(x)}}{{f(x)+g(x)}}$?"
    key = Opt(M(key_v), True, f"By the limit laws, the numerator tends to $({p})^{{2}}-{k}({q})={p * p - k * q}$ and the denominator to ${p}+({q})={p + q}$, which is not zero, so the limit is {M(key_v)}.", key_v)
    bpr = _bpr("c_limit_laws_from_given_limits", "1.6", "1.C", "Use the sum, power, constant multiple and quotient limit laws with two given limits and no formulas",
               ["Apply the power and constant multiple laws to the numerator", "Apply the sum law to the denominator and check it is nonzero", "Apply the quotient law and simplify"],
               [("the limit of a quotient is the quotient of the limits when the denominator limit is nonzero", "the denominator limit equals the sum of the given limits")], _mis(trips),
               "evaluate the expression for the concrete linear functions f(x) = p + (x - c) and g(x) = q - 2(x - c) at x = c + 1e-8")
    return _fin("c_limit_laws_from_given_limits", "1.6", "1.C", stem, key, pool, rng, bpr, 70, [f"c={c}", f"p={p}", f"q={q}", f"k={k}", f"key={key_v}"])


# ===================================================================== 단원 2
# 2.8 x^n e^x 의 접선의 y 절편
def c_tangent_y_intercept_power_exp(rng):
    for _ in forever():
        n, a = rng.choice([1, 2]), rng.choice([1, 2])
        f = x ** n * sp.exp(x)
        fp = sp.diff(f, x)
        fa, sl = f.subs(x, a), fp.subs(x, a)
        key_v = sp.simplify(fa - a * sl)
        ff = sp.lambdify(x, f, "math")
        hh = 1e-6
        sl2 = (ff(a + hh) - ff(a - hh)) / (2 * hh)
        _chk(float(fa) - a * sl2, float(key_v), 1e-5)
        wrong_slope = n * a ** (n - 1) * sp.exp(a)
        trips = [("reports_slope", f"Reports the slope $f'({a})={M(sp.simplify(sl))}$ of the tangent line instead of its $y$-intercept.", sp.simplify(sl)),
                 ("reports_point_y", f"Reports $f({a})={M(fa)}$, the $y$-value of the point of tangency, as the intercept.", fa),
                 ("sign_error", f"Writes the tangent line as $y=f({a})+{a}f'({a})$ at $x=0$, adding instead of subtracting $x_0f'(x_0)$: {_E(sp.simplify(fa + a * sl))}.", sp.simplify(fa + a * sl)),
                 ("one_factor", f"Differentiates only the power $x^{{{n}}}$ in the product, getting slope {_E(sp.simplify(wrong_slope))} and intercept {_E(sp.simplify(fa - a * wrong_slope))}.", sp.simplify(fa - a * wrong_slope))]
        try:
            pool = _ex(trips, key_v)
        except ValueError:
            continue
        break
    stem = f"The line tangent to the graph of $f(x)={_tx(f)}$ at $x={a}$ crosses the $y$-axis at the point $(0,k)$. What is the value of $k$?"
    key = Opt(M(key_v), True, f"By the product rule, $f'(x)={_tx(fp)}$, so $f({a})={M(fa)}$ and $f'({a})={M(sp.simplify(sl))}$. The tangent line is $y-f({a})=f'({a})(x-{a})$, and at $x=0$ it gives $k=f({a})-{a}f'({a})={M(key_v)}$.", key_v)
    bpr = _bpr("c_tangent_y_intercept_power_exp", "2.8", "1.D", "Find where the tangent line to a product x^n e^x meets the y-axis, using the product rule for the slope",
               ["Use the product rule to find f'(x)", "Evaluate f(a) and f'(a)", "Write the tangent line in point-slope form and set x = 0"],
               [("the tangent line has slope f'(a) and passes through (a, f(a))", "f is differentiable")], _mis(trips),
               "central difference (step 1e-6) of the lambdified function for the slope, then y-intercept f(a) - a * slope")
    return _fin("c_tangent_y_intercept_power_exp", "2.8", "1.D", stem, key, pool, rng, bpr, 90, [f"n={n}", f"a={a}", f"key={key_v}"])


# 2.8 (x^2 + bx + c) e^x 의 수평 접선(곱의 미분)
def c_horizontal_tangent_poly_exp(rng):
    for _ in forever():
        r1, r2 = rng.choice([-1, -2, -3]), rng.choice([1, 2, 3])
        if -r1 == r2:
            continue
        b = -(r1 + r2) - 2
        c = r1 * r2 - b
        p = x ** 2 + b * x + c
        f = p * sp.exp(x)
        fp = sp.simplify(sp.diff(f, x) / sp.exp(x))
        ff = sp.lambdify(x, f, "math")
        hh = 1e-6
        if abs((ff(r2 + hh) - ff(r2 - hh)) / (2 * hh)) > 1e-3 * max(1.0, abs(ff(r2))) or abs((ff(r1 + hh) - ff(r1 - hh)) / (2 * hh)) > 1e-3 * max(1.0, abs(ff(r1))):
            raise ValueError("independent_check_failed")
        key_v = S(r2)
        cands = [("poly_only", f"Differentiates only the polynomial factor and solves $2x+({b})=0$, ignoring the product rule term from $e^{{x}}$: $x={M(S(-b) / 2)}$.", S(-b) / 2),
                 ("opposite_roots", f"Factors $x^{{2}}+({b + 2})x+({b + c})$ with sign errors, taking the roots as the opposites of the true roots; the positive one is $x={-r1}$.", S(-r1)),
                 ("sum_of_roots", f"Reads the root off the coefficient of $x$ in $f'(x)/e^{{x}}$ (the negative of the sum of the roots) instead of solving: $x={r1 + r2}$.", S(r1 + r2))]
        disc = b * b - 4 * c
        if disc > 0 and c < 0:
            roots = [(-b + sp.sqrt(disc)) / 2, (-b - sp.sqrt(disc)) / 2]
            pos = [z for z in roots if z > 0]
            if pos:
                cands.append(("zero_of_f", f"Sets $f(x)=0$, that is $x^{{2}}+({b})x+({c})=0$, instead of $f'(x)=0$; its positive solution is {_E(sp.simplify(pos[0]))}.", sp.simplify(pos[0])))
        cands = [(i, w, v) for i, w, v in cands if v > 0]
        try:
            pool = _ex(cands, key_v)
        except ValueError:
            continue
        trips = cands
        break
    stem = f"Let $f(x)=\\left({_tx(p)}\\right)e^{{x}}$. At what positive value of $x$ does the graph of $f$ have a horizontal tangent line?"
    key = Opt(M(key_v), True, f"By the product rule, $f'(x)=e^{{x}}\\left({_tx(x ** 2 + (b + 2) * x + b + c)}\\right)=e^{{x}}(x-({r1}))(x-({r2}))$. Since $e^{{x}}>0$, $f'(x)=0$ at $x={r1}$ and $x={r2}$, and the positive one is $x={r2}$.".replace("+-", "-"), key_v)
    bpr = _bpr("c_horizontal_tangent_poly_exp", "2.8", "1.E", "Locate a horizontal tangent of a polynomial times e^x by setting the product-rule derivative equal to zero and factoring",
               ["Apply the product rule", "Factor e^x out and set the quadratic factor equal to zero", "Choose the root that satisfies the stated condition"],
               [("a horizontal tangent occurs where f'(x) = 0", "e^x is never zero, so only the quadratic factor matters")], _mis(trips),
               "central difference of the lambdified f at the key x (zero slope) and at the other root")
    return _fin("c_horizontal_tangent_poly_exp", "2.8", "1.E", stem, key, pool, rng, bpr, 90, [f"b={b}", f"c={c}", f"r1={r1}", f"r2={r2}"])


# 2.9 몫의 미분: sin x / x, cos x / x, e^x / x^n 의 한 점에서의 값
_QUOT = [(sp.sin(x), x, sp.pi / 2), (sp.sin(x), x, sp.pi), (sp.cos(x), x, sp.pi), (sp.exp(x), x, sp.Integer(2)), (sp.exp(x), x ** 2, sp.Integer(1)), (sp.exp(x), x ** 2, sp.Integer(3)), (sp.cos(x), x ** 2, sp.pi)]


def c_quotient_rule_trig_exp_value(rng):
    for _ in forever():
        N, D, a = rng.choice(_QUOT)
        f = N / D
        key_v = sp.simplify(sp.diff(f, x).subs(x, a))
        fl = sp.lambdify(x, f, "math")
        hh = 1e-6
        _chk((fl(float(a) + hh) - fl(float(a) - hh)) / (2 * hh), float(sp.N(key_v)), 1e-5)
        n1, d1 = sp.diff(N, x), sp.diff(D, x)
        ev = lambda e: sp.simplify(e.subs(x, a))
        trips = [("num_over_den_derivs", f"Divides the derivatives, $\\dfrac{{N'}}{{D'}}$ with $N={_tx(N)}$ and $D={_tx(D)}$, instead of using the quotient rule: {_E(ev(n1 / d1))}.", ev(n1 / d1)),
                 ("reversed_numerator", f"Reverses the numerator of the quotient rule, using $\\dfrac{{ND'-N'D}}{{D^{{2}}}}$ and so reversing the sign: {_E(ev((N * d1 - n1 * D) / D ** 2))}.", ev((N * d1 - n1 * D) / D ** 2)),
                 ("no_square", f"Uses the correct numerator but divides by $D$ instead of $D^{{2}}$: {_E(ev((n1 * D - N * d1) / D))}.", ev((n1 * D - N * d1) / D)),
                 ("plus_sign", f"Adds the two products in the numerator, $\\dfrac{{N'D+ND'}}{{D^{{2}}}}$, which is the product rule rather than the quotient rule: {_E(ev((n1 * D + N * d1) / D ** 2))}.", ev((n1 * D + N * d1) / D ** 2))]
        try:
            pool = _ex(trips, key_v)
        except ValueError:
            continue
        break
    stem = f"Let $f(x)=\\dfrac{{{_tx(N)}}}{{{_tx(D)}}}$. What is $f'\\left({_tx(a)}\\right)$?"
    key = Opt(M(key_v), True, f"By the quotient rule, $f'(x)=\\dfrac{{({_tx(n1)})({_tx(D)})-({_tx(N)})({_tx(d1)})}}{{({_tx(D)})^{{2}}}}$; evaluating at $x={_tx(a)}$ gives {M(key_v)}.", key_v)
    bpr = _bpr("c_quotient_rule_trig_exp_value", "2.9", "1.C", "Differentiate a quotient of sin x, cos x or e^x by a power of x with the quotient rule and evaluate at an exact point",
               ["Identify numerator N and denominator D and their derivatives", "Apply (N'D - N D')/D^2", "Evaluate exactly at the given x"],
               [("the quotient rule is (N'D - N D')/D^2", "D is nonzero at the evaluation point")], _mis(trips),
               "central difference (step 1e-6) of the lambdified quotient at the evaluation point")
    return _fin("c_quotient_rule_trig_exp_value", "2.9", "1.C", stem, key, pool, rng, bpr, 90, [f"f={f}", f"a={a}", f"key={key_v}"])


# 2.10 tan, cot, sec, csc 의 도함수 값
_TRIG_D = {"tan": (sp.tan, sp.sec(x) ** 2, "\\sec^{2}x", "\\tan x"), "cot": (sp.cot, -sp.csc(x) ** 2, "-\\csc^{2}x", "\\cot x"),
           "sec": (sp.sec, sp.sec(x) * sp.tan(x), "\\sec x\\tan x", "\\sec x"), "csc": (sp.csc, -sp.csc(x) * sp.cot(x), "-\\csc x\\cot x", "\\csc x")}


def c_derivative_sec_csc_cot_exact(rng):
    for _ in forever():
        nm = rng.choice(list(_TRIG_D))
        a = rng.choice([sp.pi / 6, sp.pi / 4, sp.pi / 3])
        fn, dfm, dtex, ftex = _TRIG_D[nm]
        key_v = sp.simplify(dfm.subs(x, a))
        fl = sp.lambdify(x, fn(x), "math")
        hh = 1e-6
        _chk((fl(float(a) + hh) - fl(float(a) - hh)) / (2 * hh), float(sp.N(key_v)), 1e-5)
        trips = []
        for other in _TRIG_D:
            if other == nm:
                continue
            _, od, otex, oftex = _TRIG_D[other]
            trips.append((f"formula_{other}", f"Uses the derivative formula for ${oftex}$, namely $\\dfrac{{d}}{{dx}}\\left({oftex}\\right)={otex}$, instead of the one for ${ftex}$: {_E(sp.simplify(od.subs(x, a)))}.", sp.simplify(od.subs(x, a))))
        trips.append(("sign_flip", f"Uses the correct formula ${dtex}$ but with the opposite sign: {_E(-key_v)}.", -key_v))
        try:
            pool = _ex(trips, key_v)
        except ValueError:
            continue
        break
    stem = f"Let $f(x)={ftex}$. What is $f'\\left({_tx(a)}\\right)$?"
    key = Opt(M(key_v), True, f"$f'(x)={dtex}$, and at $x={_tx(a)}$ this equals {M(key_v)}.", key_v)
    bpr = _bpr("c_derivative_sec_csc_cot_exact", "2.10", "1.C", "Differentiate tan, cot, sec or csc with the memorized derivative formula and evaluate at a special angle",
               ["Recall the derivative formula for the given trigonometric function", "Substitute the special angle", "Evaluate the trigonometric values exactly"],
               [("the derivatives of tan, cot, sec and csc are sec^2, -csc^2, sec tan and -csc cot", "the angle is a special angle with exact values")], _mis(trips),
               "central difference (step 1e-6) of the lambdified function at the angle")
    return _fin("c_derivative_sec_csc_cot_exact", "2.10", "1.C", stem, key, pool, rng, bpr, 70, [f"fn={nm}", f"a={a}", f"key={key_v}"])


# 2.2 극한이 도함수임을 알아보기
_LD = [(sp.sin(x), "\\sin", sp.pi / 3), (sp.sin(x), "\\sin", sp.pi / 6), (sp.cos(x), "\\cos", sp.pi / 6), (sp.cos(x), "\\cos", sp.pi / 3), (sp.log(x), "\\ln", sp.E), (sp.sqrt(x), "\\sqrt{x}", sp.Integer(4)), (sp.sqrt(x), "\\sqrt{x}", sp.Integer(9))]


def c_limit_is_derivative_exact(rng):
    for _ in forever():
        g, gname, a = rng.choice(_LD)
        form = rng.choice(["h", "x"])
        key_v = sp.simplify(sp.diff(g, x).subs(x, a))
        gl = sp.lambdify(x, g, "math")
        hh = 1e-6
        _chk((gl(float(a) + hh) - gl(float(a) - hh)) / (2 * hh), float(sp.N(key_v)), 1e-5)
        gv = sp.simplify(g.subs(x, a))
        g2 = sp.simplify(sp.diff(g, x, 2).subs(x, a))
        trips = [("function_value", f"Reports the function value $g({_tx(a)})={M(gv)}$, not the derivative.", gv),
                 ("sign_error", f"Differentiates with the wrong sign, giving {_E(-key_v)}.", -key_v),
                 ("second_derivative", f"Differentiates twice, reporting $g''({_tx(a)})={M(g2)}$.", g2)]
        try:
            pool = _ex(trips, key_v)
        except ValueError:
            continue
        break
    gx = (f"{gname}\\left(x\\right)" if gname.startswith("\\") and not gname.startswith("\\sqrt") else "\\sqrt{x}")
    if form == "h":
        gah = (f"{gname}\\left({_tx(a)}+h\\right)" if not gname.startswith("\\sqrt") else f"\\sqrt{{{_tx(a)}+h}}")
        gaa = f"g({_tx(a)})"
        lim = f"\\displaystyle\\lim_{{h\\to 0}}\\dfrac{{{gah}-{_tx(gv)}}}{{h}}"
    else:
        lim = f"\\displaystyle\\lim_{{x\\to {_tx(a)}}}\\dfrac{{{gx}-{_tx(gv)}}}{{x-{_tx(a)}}}"
    stem = f"What is the value of ${lim}$?"
    key = Opt(M(key_v), True, f"The limit is the definition of the derivative of $g(x)={gx}$ at $x={_tx(a)}$, because $g({_tx(a)})={M(gv)}$. So the limit equals $g'({_tx(a)})={M(key_v)}$.", key_v)
    bpr = _bpr("c_limit_is_derivative_exact", "2.2", "2.C", "Recognize a limit of a difference quotient as the derivative of a named function at a point and evaluate it",
               ["Match the limit to the difference quotient for g at the point", "Identify g and the point from the expression", "Differentiate g and evaluate exactly"],
               [("the limit of the difference quotient is g'(a) when g is differentiable at a", "the subtracted constant equals g(a)")], _mis(trips),
               "central difference (step 1e-6) of g at the point")
    return _fin("c_limit_is_derivative_exact", "2.2", "2.C", stem, key, pool, rng, bpr, 75, [f"g={g}", f"a={a}", f"form={form}"])


# 2.2 f(a+ph) - f(a-qh) 꼴 극한은 (p+q) f'(a)
def c_limit_two_point_difference_quotient(rng):
    for _ in forever():
        a = rng.choice([2, 3, 4, 5])
        p, q = rng.choice([2, 3]), rng.choice([1, 2, 3])
        d = _rn(rng, -5, 5)
        key_v = S((p + q) * d)
        trips = [("only_first", f"Counts only the term $f({a}+{p}h)$ and treats the second as a constant, giving ${p}f'({a})={p * d}$.", S(p * d)),
                 ("difference_of_factors", f"Subtracts the factors, $({p}-{q})f'({a})={(p - q) * d}$, instead of adding them (the second term has $-{q}h$ inside and a minus in front).", S((p - q) * d)),
                 ("ignores_factors", f"Treats the limit as $f'({a})={d}$, ignoring the factors {_E(p)} and {_E(q)} multiplying $h$.", S(d)),
                 ("product_of_factors", f"Multiplies the factors, ${p}\\cdot {q}\\cdot f'({a})={p * q * d}$.", S(p * q * d))]
        try:
            pool = _ex(trips, key_v)
        except ValueError:
            continue
        break
    # 독립 경로: f(x)=d x + x^2 (f'(a)=d+2a) 같은 함수로 수치 확인하지 않고 f(x)=d*x 로 직접 계산해 선형 사례에서 (p+q)*d 를 확인
    ff = lambda u: d * u
    hh = 1e-6
    _chk((ff(a + p * hh) - ff(a - q * hh)) / hh, key_v, 1e-6)
    stem = f"The function $f$ is differentiable at $x={a}$ and $f'({a})={d}$. What is the value of $\\displaystyle\\lim_{{h\\to 0}}\\dfrac{{f({a}+{p}h)-f({a}-{q}h)}}{{h}}$?"
    key = Opt(M(key_v), True, f"Write $f({a}+{p}h)-f({a}-{q}h)=[f({a}+{p}h)-f({a})]+[f({a})-f({a}-{q}h)]$. The first bracket over $h$ tends to ${p}f'({a})$ and the second to ${q}f'({a})$, so the limit is $({p}+{q})f'({a})={M(key_v)}$.", key_v)
    bpr = _bpr("c_limit_two_point_difference_quotient", "2.2", "2.C", "Express a two-point symmetric-type difference quotient limit as a multiple of f'(a) by splitting at f(a)",
               ["Insert and subtract f(a) to split the numerator", "Recognize each piece as a multiple of a difference quotient", "Add the contributions using f'(a)"],
               [("each bracket over h tends to a multiple of f'(a)", "f is differentiable at a")], _mis(trips),
               "linear model f(x) = d x evaluated directly in the difference quotient (independent of the splitting argument)")
    return _fin("c_limit_two_point_difference_quotient", "2.2", "2.C", stem, key, pool, rng, bpr, 90, [f"a={a}", f"p={p}", f"q={q}", f"d={d}"])


# 2.4 두 상수가 있는 조각 함수가 x = c 에서 미분가능
def c_piecewise_differentiable_two_constants(rng):
    for _ in forever():
        c = rng.choice([2, 3])
        aa = rng.randint(1, 3)
        m = rng.randint(1, 6)
        n = -aa * c * c
        bb = m - 2 * aa * c
        key_v = S(aa + bb)
        A, B = sp.symbols("A B")

        def sol(eqs):
            r = sp.solve(eqs, [A, B], dict=True)
            return r[0] if r and A in r[0] and B in r[0] else None

        cont = A * c ** 2 + B * c - (m * c + n)
        w1 = sol([cont, 2 * A + B - m])  # 도함수의 x 를 빼먹음
        w2 = sol([cont, 2 * A * c + B - (m * c + n)])  # 기울기 자리에 값을 대입
        w3 = sol([A * c ** 2 + B * c - (m * c - n), 2 * A * c + B - m])  # 상수 부호 실수
        if not (w1 and w2 and w3):
            continue
        trips = [("derivative_without_x", f"Differentiates $ax^{{2}}$ as $2a$ (dropping $x$), so the slope condition becomes $2a+b={m}$; with continuity this gives $a+b={M(w1[A] + w1[B])}$.", w1[A] + w1[B]),
                 ("slope_equals_value", f"Sets the left slope $2a({c})+b$ equal to the value ${m * c + n}$ of the right piece at $x={c}$ instead of its slope ${m}$, which gives $a+b={M(w2[A] + w2[B])}$.", w2[A] + w2[B]),
                 ("constant_sign", f"Writes the value of the right piece at $x={c}$ as ${m * c}-({n})$, with the wrong sign on the constant, which gives $a+b={M(w3[A] + w3[B])}$.", w3[A] + w3[B]),
                 ("only_a", f"Finds $a={aa}$ correctly but reports $a$ instead of $a+b$.", S(aa))]
        try:
            pool = _ex(trips, key_v)
        except ValueError:
            continue
        break
    # 독립 경로: 구한 a, b 로 좌우 차분몫이 같아지는지
    fl = lambda u: aa * u * u + bb * u
    fr = lambda u: m * u + n
    hh = 1e-6
    if abs(fl(c) - fr(c)) > 1e-9 or abs((fl(c) - fl(c - hh)) / hh - (fr(c + hh) - fr(c)) / hh) > 1e-4:
        raise ValueError("independent_check_failed")
    stem = (f"Let $a$ and $b$ be constants, and let $f(x)=\\begin{{cases}} ax^{{2}}+bx & x\\le {c}\\\\ {_tx(m * x + n)} & x>{c}\\end{{cases}}$. "
            f"If $f$ is differentiable at $x={c}$, what is the value of $a+b$?")
    key = Opt(M(key_v), True, f"Differentiable at $x={c}$ requires continuity and equal slopes. Continuity: ${c * c}a+{c}b={m * c + n}$. Slopes: ${2 * c}a+b={m}$. Solving gives $a={aa}$ and $b={bb}$, so $a+b={M(key_v)}$.".replace("+-", "-"), key_v)
    bpr = _bpr("c_piecewise_differentiable_two_constants", "2.4", "3.E", "Find two constants that make a piecewise function differentiable at the break point using both continuity and equal slopes",
               ["Write the continuity equation at the break point", "Write the equation matching the one-sided derivatives", "Solve the two equations for a and b"],
               [("differentiability at the break point requires continuity and equal one-sided derivatives", "two unknowns give two equations")], _mis(trips),
               "substitute the constants back and compare the values and the left and right difference quotients numerically at the break point")
    return _fin("c_piecewise_differentiable_two_constants", "2.4", "3.E", stem, key, pool, rng, bpr, 105, [f"c={c}", f"a={aa}", f"b={bb}", f"m={m}", f"n={n}"])


# 2.4 x = a 에서 미분가능한 함수 고르기
def c_choose_differentiable_at_point(rng):
    a = rng.choice([0, 1, 2, 3, -1, -2])
    u = (x - a)
    ut = _tx(u) if a != 0 else "x"
    ab = f"|{ut}|"
    kk = rng.choice([1, 2, 3])
    kp = "" if kk == 1 else str(kk)
    # 독립 경로: 양쪽 차분몫
    def dq(fn):
        h = 1e-7
        return (fn(a + h) - fn(a)) / h, (fn(a) - fn(a - h)) / h

    fns = {"key": lambda v: kk * (v - a) * abs(v - a), "abs": lambda v: kk * abs(v - a),
           "cusp": lambda v: kk * math.copysign(abs(v - a) ** (2 / 3), 1.0), "vert": lambda v: kk * math.copysign(abs(v - a) ** (1 / 3), v - a)}
    r, l = dq(fns["key"])
    if abs(r - l) > 1e-4:
        raise ValueError("independent_check_failed")
    for nm in ("abs", "cusp", "vert"):
        r, l = dq(fns[nm])
        if abs(r - l) < 1.0 and nm != "vert":
            raise ValueError("independent_check_failed")
    A = f"$f(x)={kp}{ab}$"
    B = f"$f(x)={kp}({ut})^{{2/3}}$" if a != 0 else f"$f(x)={kp}x^{{2/3}}$"
    C = f"$f(x)={kp}({ut})^{{1/3}}$" if a != 0 else f"$f(x)={kp}x^{{1/3}}$"
    D = f"$f(x)={kp}({ut}){ab}$" if a != 0 else f"$f(x)={kp}x|x|$"
    pool = [Opt(A, False, f"The graph has a corner at $x={a}$: the difference quotient is ${kk}$ from the right and $-{kk}$ from the left, so the one-sided derivatives differ.", None),
            Opt(B, False, f"The difference quotient at $x={a}$ is ${kk}h^{{-1/3}}$, which is unbounded and changes sign across $h=0$, so there is a cusp with no derivative.", None),
            Opt(C, False, f"The difference quotient at $x={a}$ is ${kk}h^{{-2/3}}$, which grows without bound, so the tangent line is vertical and $f'({a})$ does not exist.", None)]
    stem = f"Which of the following functions is differentiable at $x={a}$?"
    key = Opt(D, True, f"The difference quotient at $x={a}$ is ${kk}|h|$, which tends to $0$ from both sides, so $f'({a})=0$ exists.", None)
    mis = [("corner", "treats a function with a corner (absolute value) as differentiable"), ("cusp", "treats a cusp as differentiable because the graph is continuous"), ("vertical_tangent", "treats a vertical tangent as having a derivative")]
    bpr = _bpr("c_choose_differentiable_at_point", "2.4", "2.D", "Decide which of four continuous functions has a derivative at the point: corner, cusp, vertical tangent, or a smooth x|x| shape",
               ["Check continuity of each function at the point", "Examine the one-sided difference quotients as h tends to 0", "Select the one function whose difference quotient has a finite common limit"],
               [("differentiability requires the two one-sided derivatives to exist and be equal and finite", "continuity alone does not give differentiability")], mis,
               "numerical one-sided difference quotients (step 1e-7) of all four functions at the point")
    return _fin("c_choose_differentiable_at_point", "2.4", "2.D", stem, key, pool, rng, bpr, 80, [f"a={a}", f"k={kk}"])


# 2.4 절댓값 안의 다항식의 꺾임점 개수
def c_count_corners_abs_polynomial(rng):
    kind = rng.choice(["quad", "cubic"])
    pts = rng.sample(range(-4, 6), 2)
    r1, r2 = sorted(pts)
    if kind == "quad":
        poly = sp.expand((x - r1) * (x - r2))
        shown = _tx(poly)
        key_v = 2
        vert = S(r1 + r2) / 2
        trips = [("smooth", "Treats the absolute value as harmless and says the function is differentiable everywhere, because the polynomial inside it is differentiable.", S(0)),
                 ("vertex_only", f"Marks only the vertex $x={_tx(vert)}$ of the parabola, where the slope of the polynomial inside the absolute value is $0$, as the point where the graph is not smooth.", S(1)),
                 ("roots_and_vertex", f"Counts both zeros, $x={r1}$ and $x={r2}$, and also the vertex $x={_tx(vert)}$.", S(3))]
        why = f"The absolute value creates a corner where the polynomial inside crosses zero with a nonzero slope. It factors as $({_tx(x - r1)})({_tx(x - r2)})$ with two simple zeros, $x={r1}$ and $x={r2}$, so there are 2 corners."
        expr = poly
    else:
        poly = sp.expand((x - r1) * (x - r2) ** 2)
        shown = f"(x-({r1}))(x-({r2}))^{{2}}".replace("-(-", "+(").replace("(0)", "0")
        shown = _tx(sp.Mul(x - r1, (x - r2) ** 2, evaluate=False))
        key_v = 1
        trips = [("counts_both_zeros", f"Counts both zeros, $x={r1}$ and $x={r2}$, even though the squared factor $({_tx(x - r2)})^{{2}}$ makes the graph touch the axis smoothly at $x={r2}$.", S(2)),
                 ("counts_multiplicity", f"Counts the zeros with multiplicity, $1+2=3$.", S(3)),
                 ("smooth", "Treats the absolute value as harmless and says the function is differentiable everywhere, because the polynomial inside it is differentiable.", S(0))]
        why = f"A corner occurs only where the polynomial inside changes sign with nonzero slope. At $x={r1}$ the zero is simple, giving a corner; at $x={r2}$ the factor $({_tx(x - r2)})^{{2}}$ is squared, so the polynomial has slope $0$ there and does not change sign, and the absolute value is smooth. So there is 1 corner."
        expr = poly
    # 독립 경로: 양쪽 차분몫이 크게 다른 점을 격자에서 센다(영점 후보에서만)
    P = sp.lambdify(x, expr, "math")
    h = 1e-6
    cnt = 0
    for z in (r1, r2):
        l = (abs(P(z)) - abs(P(z - h))) / h
        rr = (abs(P(z + h)) - abs(P(z))) / h
        if abs(rr - l) > 1e-3:
            cnt += 1
    if cnt != key_v:
        raise ValueError("independent_check_failed")
    pool = _ex(trips, S(key_v))
    stem = f"For how many values of $x$ is the function $f(x)=\\left|{shown}\\right|$ not differentiable?"
    key = Opt(M(S(key_v)), True, why, S(key_v))
    bpr = _bpr("c_count_corners_abs_polynomial", "2.4", "2.D", "Count the corners of the absolute value of a polynomial, distinguishing simple zeros from repeated zeros",
               ["Find the zeros of the polynomial inside the absolute value", "Decide at each zero whether the polynomial changes sign with nonzero slope", "Count only the zeros that create a corner"],
               [("|P| has a corner only where P crosses zero with nonzero slope", "a repeated zero gives a smooth touch point")], _mis(trips),
               "one-sided difference quotients of |P| (step 1e-6) at each zero")
    return _fin("c_count_corners_abs_polynomial", "2.4", "2.D", stem, key, pool, rng, bpr, 80, [f"kind={kind}", f"r1={r1}", f"r2={r2}"])


# 2.7 x^n ln x 의 법선의 기울기
def c_normal_slope_power_ln(rng):
    n = rng.choice([2, 3])
    f = x ** n * sp.log(x)
    sl = sp.simplify(sp.diff(f, x).subs(x, sp.E))
    key_v = sp.simplify(-1 / sl)
    ff = sp.lambdify(x, f, "math")
    hh = 1e-6
    _chk(-1 / ((ff(math.e + hh) - ff(math.e - hh)) / (2 * hh)), float(sp.N(key_v)), 1e-5)
    wrong_nopr = sp.simplify(n * sp.E ** (n - 1))
    wrong_lnonly = sp.simplify(sp.E ** (n - 1))
    trips = [("tangent_slope", f"Reports the slope of the tangent line, $f'(e)={M(sl)}$, instead of the slope of the normal line.", sl),
             ("opposite_not_reciprocal", f"Uses the opposite $-f'(e)={M(-sl)}$ instead of the negative reciprocal.", -sl),
             ("no_product_term", f"Differentiates only $x^{{{n}}}$ and multiplies by $\\ln x$, forgetting the term from $\\ln x$: $f'(e)={M(wrong_nopr)}$, so the normal slope is {_E(sp.simplify(-1 / wrong_nopr))}.", sp.simplify(-1 / wrong_nopr)),
             ("only_ln_derivative", f"Differentiates only $\\ln x$ in the product, giving $f'(e)=e^{{{n}}}\\cdot\\dfrac{{1}}{{e}}={M(wrong_lnonly)}$ and normal slope {_E(sp.simplify(-1 / wrong_lnonly))}.", sp.simplify(-1 / wrong_lnonly))]
    pool = _ex(trips, key_v)
    stem = f"Let $f(x)=x^{{{n}}}\\ln x$. What is the slope of the line normal to the graph of $f$ at $x=e$?"
    key = Opt(M(key_v), True, f"By the product rule, $f'(x)={n}x^{{{n - 1}}}\\ln x+x^{{{n - 1}}}$, so $f'(e)={M(sl)}$. The normal line is perpendicular to the tangent, so its slope is the negative reciprocal, {M(key_v)}.", key_v)
    bpr = _bpr("c_normal_slope_power_ln", "2.7", "1.D", "Find the slope of the normal line to x^n ln x at x = e using the product rule and a negative reciprocal",
               ["Use the product rule to find f'(e)", "Evaluate ln e = 1 exactly", "Take the negative reciprocal for the normal slope"],
               [("the normal slope is the negative reciprocal of f'(e)", "f'(e) is nonzero")], _mis(trips),
               "central difference (step 1e-6) of the lambdified function at x = e, then the negative reciprocal")
    return _fin("c_normal_slope_power_ln", "2.7", "1.D", stem, key, pool, rng, bpr, 85, [f"n={n}", f"key={key_v}"])


# 2.2 x^n g(x) 의 도함수 값: g(a), g'(a) 가 글로 주어짐
def c_product_power_times_unknown_function(rng):
    for _ in forever():
        n, a = rng.choice([2, 3]), rng.choice([2, 3])
        ga, gp = _rn(rng, -4, 5), _rn(rng, -4, 4)
        key_v = S(n * a ** (n - 1) * ga + a ** n * gp)
        trips = [("derivatives_multiplied", f"Multiplies the derivatives, $(x^{{{n}}})'\\cdot g'(x)$ at $x={a}$: ${n * a ** (n - 1)}\\cdot({gp})={n * a ** (n - 1) * gp}$.", S(n * a ** (n - 1) * gp)),
                 ("only_second_term", f"Keeps only $x^{{{n}}}g'(x)$, which is ${a ** n}\\cdot({gp})={a ** n * gp}$, and drops the term from differentiating the power.", S(a ** n * gp)),
                 ("only_first_term", f"Keeps only $(x^{{{n}}})'g(x)$, which is ${n * a ** (n - 1)}\\cdot({ga})={n * a ** (n - 1) * ga}$, and drops the term from differentiating $g$.", S(n * a ** (n - 1) * ga)),
                 ("swapped_roles", f"Attaches the derivatives to the wrong factors: $x^{{{n}}}g(x)+(x^{{{n}}})'g'(x)$ at $x={a}$ equals ${a ** n * ga + n * a ** (n - 1) * gp}$.", S(a ** n * ga + n * a ** (n - 1) * gp))]
        try:
            pool = _ex(trips, key_v)
        except ValueError:
            continue
        break
    stem = f"Let $g$ be a differentiable function with $g({a})={ga}$ and $g'({a})={gp}$. If $f(x)=x^{{{n}}}g(x)$, what is $f'({a})$?".replace("=-", "=-")
    key = Opt(M(key_v), True, f"By the product rule, $f'(x)={n}x^{{{n - 1}}}g(x)+x^{{{n}}}g'(x)$. At $x={a}$: ${n * a ** (n - 1)}\\cdot({ga})+{a ** n}\\cdot({gp})={M(key_v)}$.", key_v)
    bpr = _bpr("c_product_power_times_unknown_function", "2.8", "1.C", "Differentiate x^n times an unknown differentiable function with the product rule using given values g(a) and g'(a)",
               ["Apply the product rule to x^n and g", "Substitute x = a, g(a) and g'(a) from the text", "Add the two products"],
               [("the product rule has two terms, each differentiating one factor", "g is differentiable at a")], _mis(trips),
               "model g(x) = g(a) + g'(a)(x - a) and a central difference of x^n g(x) at a (independent of the product rule formula)")
    # 독립 경로: 선형 모델
    gl = lambda u: ga + gp * (u - a)
    fl = lambda u: u ** n * gl(u)
    hh = 1e-6
    _chk((fl(a + hh) - fl(a - hh)) / (2 * hh), key_v, 1e-5)
    return _fin("c_product_power_times_unknown_function", "2.8", "1.C", stem, key, pool, rng, bpr, 70, [f"n={n}", f"a={a}", f"ga={ga}", f"gp={gp}"])


# 2.5/2.7 분수 꼴을 먼저 정리한 뒤 미분(몫의 미분을 쓰지 않는다)
def c_rewrite_then_differentiate_root_denominator(rng):
    for _ in forever():
        m, nn = rng.choice([2, 3]), rng.choice([0, 1])
        cc = _rn(rng, -4, 4)
        a = rng.choice([4, 9])
        f = (x ** m + cc * x ** nn) / sp.sqrt(x)
        key_v = sp.simplify(sp.diff(sp.expand(f), x).subs(x, a))
        fl = sp.lambdify(x, f, "math")
        hh = 1e-6
        _chk((fl(a + hh) - fl(a - hh)) / (2 * hh), float(sp.N(key_v)), 1e-5)
        N = x ** m + cc * x ** nn
        quot = sp.simplify((sp.diff(N, x) / sp.diff(sp.sqrt(x), x)).subs(x, a))
        numonly = sp.simplify((sp.diff(N, x) / sp.sqrt(x)).subs(x, a))
        wrongexp = sp.simplify(sp.diff(x ** (m + sp.Rational(1, 2)) + cc * x ** (nn + sp.Rational(1, 2)), x).subs(x, a))
        fa = sp.simplify(f.subs(x, a))
        trips = [("derivative_over_derivative", f"Divides the derivative of the numerator by the derivative of the denominator, $\\dfrac{{N'}}{{(\\sqrt{{x}})'}}$, instead of differentiating the simplified expression: {_E(quot)}.", quot),
                 ("numerator_only", f"Differentiates only the numerator and keeps the denominator $\\sqrt{{x}}$ unchanged: {_E(numonly)}.", numonly),
                 ("wrong_exponent_rewrite", f"Treats division by $\\sqrt{{x}}$ as if it added $\\frac{{1}}{{2}}$ to each exponent instead of subtracting it, and differentiates the result: {_E(wrongexp)}.", wrongexp),
                 ("function_value", f"Reports the function value $f({a})={M(fa)}$ instead of the derivative.", fa)]
        try:
            pool = _ex(trips, key_v)
        except ValueError:
            continue
        break
    stem = f"Let $f(x)=\\dfrac{{{_tx(x ** m + cc * x ** nn)}}}{{\\sqrt{{x}}}}$ for $x>0$. What is $f'({a})$?"
    simp = sp.expand(f)
    key = Opt(M(key_v), True, f"Rewrite $f(x)={_tx(simp)}$ using exponents, then apply the power rule: $f'(x)={_tx(sp.diff(simp, x))}$. At $x={a}$ this equals {M(key_v)}.", key_v)
    bpr = _bpr("c_rewrite_then_differentiate_root_denominator", "2.5", "2.C", "Rewrite a quotient with a square-root denominator as a sum of rational powers, then differentiate with the power rule",
               ["Divide each term by sqrt(x) by subtracting the exponent 1/2", "Differentiate each power term with the power rule", "Evaluate at the given x"],
               [("x^p / x^(1/2) = x^(p - 1/2), so no quotient rule is needed", "x is positive so the root is defined")], _mis(trips),
               "central difference (step 1e-6) of the lambdified original quotient")
    return _fin("c_rewrite_then_differentiate_root_denominator", "2.5", "2.C", stem, key, pool, rng, bpr, 85, [f"m={m}", f"n={nn}", f"c={cc}", f"a={a}", f"key={key_v}"])


STAGE_LISTS = {"supp_r3b1_ab": [
    "c_horizontal_asymptotes_exp_ratio", "c_lim_neg_inf_radical", "c_count_vertical_asymptotes", "c_one_sided_abs_quotient", "c_trig_limit_sine_ratio",
    "c_removable_value_power_ratio", "c_cont_three_pieces_two_unknowns", "c_ivt_root_interval_polynomial", "c_squeeze_polynomial_bounds", "c_limit_laws_from_given_limits",
    "c_tangent_y_intercept_power_exp", "c_horizontal_tangent_poly_exp", "c_quotient_rule_trig_exp_value", "c_derivative_sec_csc_cot_exact", "c_limit_is_derivative_exact",
    "c_limit_two_point_difference_quotient", "c_piecewise_differentiable_two_constants", "c_choose_differentiable_at_point", "c_count_corners_abs_polynomial",
    "c_normal_slope_power_ln", "c_product_power_times_unknown_function", "c_rewrite_then_differentiate_root_denominator"]}
