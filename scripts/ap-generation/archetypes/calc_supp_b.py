"""보강(supplement, 2026-10-09 오너 승인) MC 원형 B군: 단원 5·6·2·4(+8·BC 7·9·10) 계산기 필수(Part B) 일반 문항 — 대체가 어려운 구조 우선.
기존 재고 구조(절대 극값 후보 검사·f'' = 0 변곡점·2계 도함수 판정·누적함수 증가 구간·FTC 연쇄·중점 합·몫의 법칙 평가 등)와 구하는 양·풀이 골격이 다른 것만 만든다.
정답은 sympy/수치로 계산하고, 생성 경로와 다른 독립 수치 경로(격자·구적법·유한차분·이분법)로 다시 확인한다."""
from scommon import *
from scipy import optimize as _O, integrate as _I, special as _Sp
import math

AB_ = "ap_calculus_ab"
BC_ = "ap_calculus_bc"


def _bpa(arch, topic, skill, concept, thinking, cond, mis, path, subject=AB_, calc="required"):
    return nb(arch, topic, skill, calc, concept, thinking, cond, mis, path, subject)


def _roots(f, lo, hi, n=4000):
    """f 의 부호 변화 구간을 격자로 찾아 Brent 로 근을 돌려준다(생성 경로)."""
    xs = [lo + (hi - lo) * i / n for i in range(n + 1)]
    out = []
    for i in range(n):
        if f(xs[i]) == 0:
            out.append(xs[i])
        elif f(xs[i]) * f(xs[i + 1]) < 0:
            out.append(_O.brentq(f, xs[i], xs[i + 1], xtol=1e-13))
    return out


# ============================ 단원 5 ============================
# 5.3 닫힌 구간에서 f 가 증가하는 구간(f' 의 근을 계산기로)
def c_increasing_interval_calc(rng):
    a = rng.choice([0.8, 1.0, 1.2])
    b = rng.choice([2, 3, 4])
    f = lambda u: math.exp(a * u) - b * u * u
    fp = lambda u: a * math.exp(a * u) - 2 * b * u
    fpp = lambda u: a * a * math.exp(a * u) - 2 * b
    rts = _roots(fp, 1.0, 5.0)
    if len(rts) != 1 or fp(1.0) >= 0 or fp(5.0) <= 0 or not (1.4 < rts[0] < 4.6):
        raise ValueError("bad_roots")
    r = rts[0]
    # 독립 경로: 중심차분의 부호가 r 앞에서 음수, 뒤에서 양수
    cd = lambda u: (f(u + 1e-6) - f(u - 1e-6)) / 2e-6
    if not all((cd(1 + 4 * i / 400) > 0) == (1 + 4 * i / 400 > r) for i in range(401) if abs(1 + 4 * i / 400 - r) > 1e-3):
        raise ValueError("independent_check_failed")
    r2 = _roots(fpp, 1.0, 5.0)
    rf = _roots(f, 1.0, 5.0)
    key_t = f"$({r:.3f}, 5)$"
    cands = [(f"$(1, {r:.3f})$", "Reverses the sign analysis: f' is negative on this interval, so f is decreasing there."), ("$(1, 5)$", "Treats f as increasing on the whole interval because f' is positive at the right endpoint.")]
    if r2:
        cands.append((f"$({r2[0]:.3f}, 5)$", "Uses the zero of the second derivative, where the graph changes concavity, instead of the zero of f'."))
    if rf:
        cands.append((f"$({rf[-1]:.3f}, 5)$", "Uses the zero of f itself instead of the zero of f'."))
    if len(cands) < 3:
        raise ValueError("not_enough_distractors")
    pool = textopts(cands)
    ax = "x" if a == 1.0 else f"{a:g}x"
    ac = "" if a == 1.0 else f"{a:g}"
    stem = f"Let $f(x)=e^{{{ax}}}-{b}x^{{2}}$ for $1\\le x\\le 5$. On which of the following intervals is $f$ increasing?"
    key = Opt(key_t, True, f"f'(x) = {ac}e^({ax}) - {2 * b}x is negative on (1, {r:.3f}) and positive on ({r:.3f}, 5), where f' = 0 at x = {r:.3f} (found with a calculator), so f is increasing on ({r:.3f}, 5).", None)
    bpr = _bpa("c_increasing_interval_calc", "5.3", "3.E", "Determine the interval of increase of a function by solving f'(x) = 0 numerically and reading the sign of f'",
               ["Compute f' and find its zero on the interval with a calculator", "Check the sign of f' on each side of the zero", "Name the interval where f' is positive"],
               [("f is increasing where f' > 0", "f' changes sign once on the interval, from negative to positive")],
               [("reversed_signs", "uses the interval where f' is negative"), ("whole_interval", "assumes f increases on the whole interval"), ("second_derivative_zero", "uses the zero of f''"), ("zero_of_f", "uses the zero of f")],
               "the sign of a central-difference derivative is checked at 401 points of [1, 5], with the single sign change located at the reported zero (independent of Brent's method)")
    return build("c_increasing_interval_calc", "5.3", "3.E", "required", stem, key, pool, rng, bpr, 100, [f"a={a}", f"b={b}", f"r={r:.6f}"])


# 5.2 임계점의 개수(f' = 0 의 해를 센다)
def c_critical_count_calc(rng):
    k = rng.choice([1, 2])
    L = rng.choice([8, 10, 12]) if k == 1 else rng.choice([4, 5, 6])
    f = lambda u: u * math.sin(k * u)
    fp = lambda u: math.sin(k * u) + k * u * math.cos(k * u)
    rts = _roots(fp, 1e-6, L)
    key_v = len(rts)
    # 독립 경로: 수치 도함수(중심차분)의 부호 변화를 다른 격자로 센다
    cd = lambda u: (f(u + 1e-7) - f(u - 1e-7)) / 2e-7
    xs = [1e-4 + (L - 1e-4) * i / 30000 for i in range(30001)]
    cnt = sum(1 for i in range(30000) if cd(xs[i]) * cd(xs[i + 1]) < 0)
    if cnt != key_v or key_v < 3:
        raise ValueError("independent_check_failed")
    zeros_f = math.floor(L * k / math.pi - 1e-9)
    fpp = lambda u: 2 * k * math.cos(k * u) - k * k * u * math.sin(k * u)
    zeros_fpp = len(_roots(fpp, 1e-6, L))
    ds = [("Counts the zeros of f on the interval instead of the zeros of f'.", zeros_f), ("Counts the zeros of f'', which are the possible points of inflection, instead of the critical points.", zeros_fpp),
          ("Misses the last solution of f'(x) = 0 near the right end of the interval.", key_v - 1), ("Counts x = 0, where f'(0) = 0, although 0 is not in the open interval.", key_v + 1),
          ("Counts x = 0 and also the right endpoint, although neither belongs to the open interval.", key_v + 2)]
    pool = numopts(ds, key_v, lambda v: fmt(int(v)))
    stem = f"How many critical points does $f(x)=x\\sin({'' if k == 1 else k}x)$ have on the open interval $0<x<{L}$?"
    key = Opt(fmt(key_v), True, f"f'(x) = sin({'' if k == 1 else k}x) + {'' if k == 1 else k}x cos({'' if k == 1 else k}x) is defined everywhere, so the critical points are its zeros; solving f'(x) = 0 on (0, {L}) with a calculator gives {key_v} solutions.", key_v)
    bpr = _bpa("c_critical_count_calc", "5.2", "1.E", "Count the critical points of a function by counting the solutions of f'(x) = 0 on an interval with a calculator",
               ["Differentiate f with the product rule", "Find all solutions of f'(x) = 0 on the interval from a calculator graph or table of f'", "Count them, excluding the endpoints"],
               [("critical points occur where f' = 0 or f' is undefined, and f' is defined for all x", "f is differentiable everywhere")],
               [("zeros_of_f", "counts zeros of f instead of f'"), ("zeros_of_fpp", "counts zeros of f'' instead of f'"), ("missed_one", "misses the last solution of f' = 0"), ("endpoint_included", "counts x = 0 or an endpoint of the open interval")],
               "sign changes of a central-difference derivative on a 30001-point grid are counted (independent of the closed-form f' and Brent's method)")
    return build("c_critical_count_calc", "5.2", "1.E", "required", stem, key, pool, rng, bpr, 100, [f"k={k}", f"L={L}", f"count={key_v}"])


# 5.11 곡선 아래 직사각형의 최대 넓이(코사인 곡선)
def c_optimization_rect_calc(rng):
    a_, b_ = rng.choice([(2, 2), (3, 2), (4, 1), (5, 2), (3, 4), (6, 1)])
    # 직사각형: 밑변이 x 축, 위 꼭짓점이 y = a cos(x/b) 위, y 축 대칭 → 넓이 A(x) = 2 x a cos(x/b)
    A = lambda u: 2 * u * a_ * math.cos(u / b_)
    Ap = lambda u: 2 * a_ * (math.cos(u / b_) - (u / b_) * math.sin(u / b_))
    xs_ = _O.brentq(Ap, 0.1, b_ * math.pi / 2 - 1e-3)
    key_v = A(xs_)
    grid = [b_ * math.pi / 2 * i / 200000 for i in range(200001)]
    gm = max(A(g) for g in grid)
    if abs(gm - key_v) > 1e-6:
        raise ValueError("independent_check_failed")
    ds = [("Takes the rectangle with half-width x = b pi/4, the middle of the interval, without optimizing.", A(b_ * math.pi / 4)), ("Reports the x-coordinate of the maximizing vertex instead of the maximum area.", xs_),
          ("Uses the half-width x as the whole base, so the area is x a cos(x/b) rather than 2 x a cos(x/b).", key_v / 2), ("Reports the maximum height a of the curve times the full width of the interval.", a_ * b_ * math.pi)]
    pool = numopts(ds, key_v, dec3)
    arg_ = "x" if b_ == 1 else f"\\dfrac{{x}}{{{b_}}}"
    lim_ = "\\dfrac{\\pi}{2}" if b_ == 1 else f"{b_}\\dfrac{{\\pi}}{{2}}"
    stem = f"A rectangle has its base on the $x$-axis and is symmetric about the $y$-axis, and its upper two vertices lie on the graph of $y={a_}\\cos\\!\\left({arg_}\\right)$ for $-{lim_}<x<{lim_}$. What is the maximum possible area of such a rectangle?"
    key = Opt(dec3(key_v), True, "The area is A(x) = 2x a cos(x/b) for the right vertex at (x, a cos(x/b)); solve A'(x) = 0 with a calculator and evaluate A there.", key_v)
    bpr = _bpa("c_optimization_rect_calc", "5.11", "1.D", "Maximize the area of a rectangle inscribed under a cosine curve by solving A'(x) = 0 numerically",
               ["Write the area of the symmetric rectangle in terms of the x-coordinate of a vertex", "Differentiate and solve A'(x) = 0 on the allowed interval with a calculator", "Evaluate A at the solution (the area vanishes at both ends)"],
               [("A is continuous and zero at both ends of the interval, so an interior solution of A' = 0 gives the maximum", "A(0) = 0 and A at the right end is 0")],
               [("no_optimization", "uses a convenient x without optimizing"), ("location_not_value", "reports the x-coordinate"), ("half_width", "uses half the base"), ("rough_bound", "uses a crude bound")],
               "the maximum of A over a 200001-point grid on the allowed interval (independent of Brent's method on A')")
    return build("c_optimization_rect_calc", "5.11", "1.D", "required", stem, key, pool, rng, bpr, 105, [f"a={a_}", f"b={b_}", f"xstar={xs_:.6f}", f"Amax={key_v:.6f}"])


# 5.11 곡선 위에서 주어진 점에 가장 가까운 점까지의 거리
def c_closest_point_calc(rng):
    k = rng.choice([0.5, 1.0])
    px, py = rng.choice([(0.0, 4.0), (1.0, 5.0), (0.0, 6.0), (2.0, 5.0)])
    curve = lambda u: math.exp(k * u)
    D2 = lambda u: (u - px) ** 2 + (curve(u) - py) ** 2
    D2p = lambda u: 2 * (u - px) + 2 * (curve(u) - py) * k * curve(u)
    rts = _roots(D2p, -1, 5)
    if not rts:
        raise ValueError("no_root")
    xs_ = min(rts, key=D2)
    key_v = math.sqrt(D2(xs_))
    gm = min(math.sqrt(D2(-1 + 6 * i / 300000)) for i in range(300001))
    if abs(gm - key_v) > 1e-6:
        raise ValueError("independent_check_failed")
    ds = [("Reports the squared distance, the quantity that was minimized, instead of the distance.", D2(xs_)), ("Reports the x-coordinate of the closest point instead of the distance.", xs_),
          ("Uses the vertical gap between the point and the curve directly above it.", abs(py - curve(px))), ("Uses the distance from the point to the point of the curve at x = 0.", math.sqrt(D2(0.0)))]
    pool = numopts(ds, key_v, dec3)
    stem = f"What is the minimum distance from the point $({px:g},{py:g})$ to the graph of $y=e^{{{k:g}x}}$?"
    key = Opt(dec3(key_v), True, "Minimize the squared distance (x - p)^2 + (e^(kx) - q)^2 by solving its derivative equal to zero with a calculator, then take the square root of the minimum.", key_v)
    bpr = _bpa("c_closest_point_calc", "5.11", "1.D", "Find the minimum distance from a point to an exponential curve by minimizing the squared distance numerically",
               ["Write the squared distance from the point to a general point of the curve", "Solve the derivative of the squared distance equal to zero with a calculator", "Evaluate the distance at the solution"],
               [("minimizing the squared distance gives the same location as minimizing the distance", "the square root is increasing")],
               [("squared_distance", "reports the squared distance"), ("location_not_value", "reports the x-coordinate"), ("vertical_gap", "uses the vertical gap"), ("fixed_point", "uses a fixed point of the curve")],
               "the minimum of the distance over a 300001-point grid on [-1, 5] (independent of Brent's method on the derivative)")
    return build("c_closest_point_calc", "5.11", "1.D", "required", stem, key, pool, rng, bpr, 105, [f"k={k}", f"p=({px},{py})", f"d={key_v:.6f}"])


# 5.9 변화율이 가장 큰 시각(2계 도함수의 근)
def c_fastest_increase_calc(rng):
    c = rng.choice([2, 3, 4])
    A_ = rng.choice([20, 30, 40])
    M = lambda u: A_ * u * u * math.exp(-u / c)
    Mp = lambda u: A_ * math.exp(-u / c) * (2 * u - u * u / c)
    Mpp = lambda u: A_ * math.exp(-u / c) * (2 - 4 * u / c + u * u / c ** 2)
    L = 10 * c
    rts = _roots(Mpp, 0, L)
    if len(rts) != 2:
        raise ValueError("bad_roots")
    key_v = rts[0]
    grid = [L * i / 200000 for i in range(200001)]
    gmax = max(grid, key=Mp)
    if abs(gmax - key_v) > L / 200000 * 2:
        raise ValueError("independent_check_failed")
    ds = [("Gives the time at which M' = 0, when the amount itself is greatest, not when it is increasing fastest.", 2.0 * c), ("Gives the time at which M' is most negative, when the amount is decreasing fastest.", rts[1]),
          ("Maximizes only the factor 2t - t^2/c of M'(t) and ignores the factor e^(-t/c), which gives t = c.", float(c)),("Reports the largest rate M'(t) rather than the time at which it occurs.", Mp(key_v))]
    pool = numopts(ds, key_v, dec3)
    stem = f"The amount of a chemical in a tank, in grams, is modeled by $M(t)={A_}t^{{2}}e^{{-t/{c}}}$ for $0\\le t\\le {L}$, where $t$ is measured in hours. At what time $t$ is the amount of the chemical increasing most rapidly?"
    key = Opt(dec3(key_v), True, "The rate M'(t) is largest where M''(t) = 0 and M'' changes from positive to negative; solve M''(t) = 0 with a calculator and take the smaller root.", key_v)
    bpr = _bpa("c_fastest_increase_calc", "5.5", "3.E", "Find when a quantity is increasing most rapidly by maximizing its rate of change, using the second derivative",
               ["Recognize that the rate of change M' must be maximized", "Solve M''(t) = 0 with a calculator and choose the root where M' has its maximum", "Compare with the endpoints if necessary"],
               [("the greatest rate occurs where M'' changes sign from positive to negative or at an endpoint", "M'' is positive then negative at the smaller root")],
               [("time_of_max_amount", "reports where M' = 0"), ("steepest_decrease", "reports the other root of M''"), ("vertex_of_rate", "uses the vertex of a factor"), ("rate_value", "reports the rate, not the time")],
               "the maximum of M' over a 200001-point grid on [0, 10c] (independent of Brent's method on M'')")
    return build("c_fastest_increase_calc", "5.5", "3.E", "required", stem, key, pool, rng, bpr, 105, [f"A={A_}", f"c={c}", f"t={key_v:.6f}"])


# 5.12 음함수 곡선의 수평 접선 점
def c_implicit_horizontal_tangent_calc(rng):
    cst = rng.choice([7, 10, 13, 19, 21])
    xv = math.sqrt(cst / 3)
    key_v = -2 * xv
    # 독립 경로: 곡선 위의 점을 y(x) 로 수치 계산(이차 방정식의 근)하고 기울기가 0 인 점을 격자에서 찾는다
    best = None
    for i in range(1, 200001):
        xx = -math.sqrt(4 * cst / 3) + 2 * math.sqrt(4 * cst / 3) * i / 200000
        disc = xx * xx - 4 * (xx * xx - cst)
        if disc < 0:
            continue
        yy = (-xx - math.sqrt(disc)) / 2
        slope = -(2 * xx + yy) / (xx + 2 * yy) if abs(xx + 2 * yy) > 1e-9 else None
        if slope is not None and (best is None or abs(slope) < best[0]):
            best = (abs(slope), xx, yy)
    if abs(best[2] - key_v) > 1e-2 or abs(best[1] - xv) > 1e-2:
        raise ValueError("independent_check_failed")
    ds = [("Reports the positive y-coordinate of the symmetric point in the second quadrant.", -key_v), ("Reports the x-coordinate of the point instead of the y-coordinate.", xv), ("Sets the numerator 2x + y equal to zero but substitutes y = -x, so it solves 1 x^2 = c.", -math.sqrt(cst)),
          ("Sets the denominator x + 2y equal to zero, which gives the vertical tangent condition.", -math.sqrt(4 * cst / 3) / 1.0 * 0.5)]
    pool = numopts(ds, key_v, dec3)
    stem = f"The curve $x^{{2}}+xy+y^{{2}}={cst}$ has a horizontal tangent at two points. What is the $y$-coordinate of the one that lies in the fourth quadrant?"
    key = Opt(dec3(key_v), True, "dy/dx = -(2x + y)/(x + 2y) = 0 requires y = -2x; substituting into the equation gives 3x^2 = c, so x = sqrt(c/3) and y = -2 sqrt(c/3), evaluated with a calculator.", key_v)
    bpr = _bpa("c_implicit_horizontal_tangent_calc", "5.12", "1.E", "Locate the points of an implicit curve with a horizontal tangent from dy/dx = 0",
               ["Differentiate implicitly to find dy/dx", "Set the numerator equal to zero to get a relation between x and y", "Substitute into the curve equation and choose the point in the stated quadrant"],
               [("a horizontal tangent needs dy/dx = 0 with a nonzero denominator", "at y = -2x the denominator x + 2y = -3x is not zero")],
               [("wrong_quadrant", "reports the other point"), ("x_not_y", "reports the x-coordinate"), ("wrong_relation", "uses y = -x"), ("vertical_tangent_condition", "uses the denominator")],
               "the curve is solved for y(x) on a 200000-point grid and the point with the smallest slope magnitude is located (independent of the algebraic substitution)")
    return build("c_implicit_horizontal_tangent_calc", "5.12", "1.E", "required", stem, key, pool, rng, bpr, 100, [f"c={cst}", f"y={key_v:.6f}"])


# ============================ 단원 6 ============================
# 6.5 누적함수의 최댓값
def c_accum_max_value_calc(rng):
    a0, c = rng.choice([(4, 3), (5, 3), (4, 4), (6, 4), (5, 2.5)])
    f = lambda t_: a0 - t_ * math.exp(t_ / c)
    b = 4
    rts = _roots(f, 0, b)
    if len(rts) != 1 or f(0) <= 0:
        raise ValueError("bad_roots")
    r = rts[0]
    G = lambda u: _I.quad(f, 0, u)[0]
    key_v = G(r)
    # 독립 경로: 격자에서 G 를 누적 사다리꼴로 만들어 최댓값 확인
    n = 40000
    acc, best = 0.0, 0.0
    for i in range(n):
        t0, t1 = b * i / n, b * (i + 1) / n
        acc += (f(t0) + f(t1)) / 2 * (t1 - t0)
        best = max(best, acc)
    if abs(best - key_v) > 1e-6:
        raise ValueError("independent_check_failed")
    ds = [("Reports G at the right endpoint of the interval, which is smaller than the maximum because f is negative after the zero.", G(b)), ("Reports the x-value where f changes sign, not the value of G there.", r),
          ("Reports the integral of f from the zero to the right endpoint, which is the negative part of the accumulation.", _I.quad(f, r, b)[0]), ("Reports the total area between the graph of f and the x-axis over the whole interval.", _I.quad(lambda t_: abs(f(t_)), 0, b)[0])]
    pool = numopts(ds, key_v, dec3)
    stem = f"Let $G(x)=\\int_0^x\\left({a0}-te^{{t/{c:g}}}\\right)dt$ for $0\\le x\\le {b}$. What is the maximum value of $G$ on this interval?"
    key = Opt(dec3(key_v), True, f"G'(x) = {a0} - x e^(x/{c:g}) changes from positive to negative at x = {r:.3f} (found with a calculator), and G(0) = 0, so the maximum is G({r:.3f}) = the integral of the integrand from 0 to {r:.3f}.", key_v)
    bpr = _bpa("c_accum_max_value_calc", "6.5", "1.E", "Find the maximum value of an accumulation function by locating where its integrand changes sign and then integrating",
               ["Use G' = the integrand to locate where G changes from increasing to decreasing", "Compute the integral from 0 to that x with a calculator", "Compare with the value at the endpoints"],
               [("G is continuous and G' changes sign from positive to negative exactly once", "the integrand is decreasing with a single zero on the interval")],
               [("endpoint_value", "reports G at the right endpoint"), ("location_not_value", "reports the x-value where G is greatest"), ("negative_part", "reports the integral over the part where f is negative"), ("total_area", "reports the area between the graph and the axis")],
               "G is accumulated with a cumulative trapezoid rule on 40000 steps and its maximum is read from the running values (independent of scipy quad and Brent's method)")
    return build("c_accum_max_value_calc", "6.5", "1.E", "required", stem, key, pool, rng, bpr, 105, [f"a={a0}", f"c={c}", f"r={r:.6f}", f"Gmax={key_v:.6f}"])


# 6.4 누적함수의 2계 도함수 값
def c_ftc_second_derivative_calc(rng):
    form = rng.choice(["sqrt", "ln", "exp"])
    k = rng.choice([1, 2, 3, 5])
    p = rng.choice([1.5, 2.0, 2.5])
    g = {"sqrt": lambda t_: math.sqrt(t_ ** 3 + k), "ln": lambda t_: math.log(t_ ** 2 + k), "exp": lambda t_: math.exp(t_ / k) * t_}[form]
    gp = {"sqrt": lambda t_: 3 * t_ ** 2 / (2 * math.sqrt(t_ ** 3 + k)), "ln": lambda t_: 2 * t_ / (t_ ** 2 + k), "exp": lambda t_: math.exp(t_ / k) * (1 + t_ / k)}[form]
    key_v = gp(p)
    # 독립 경로: F 를 구적법으로 만들어 2계 중심차분
    F = lambda u: _I.quad(g, 0, u)[0]
    hh = 1e-3
    num = (F(p + hh) - 2 * F(p) + F(p - hh)) / hh ** 2
    if abs(num - key_v) > 1e-4:
        raise ValueError("independent_check_failed")
    ds = [("Reports F'(p) = g(p), the first derivative, instead of the second derivative.", g(p)), ("Reports F(p), the value of the accumulation function.", F(p)),
          ("Differentiates the integrand but evaluates the derivative at the wrong point, p squared.", gp(p * p)), ("Reports g'(p)/g(p), the logarithmic derivative of the integrand, instead of g'(p).", gp(p) / g(p))]
    pool = numopts(ds, key_v, dec3)
    gtex = {"sqrt": f"\\sqrt{{t^{{3}}+{k}}}", "ln": f"\\ln\\left(t^{{2}}+{k}\\right)", "exp": f"te^{{t/{k}}}"}[form]
    stem = f"Let $F(x)=\\int_0^x {gtex}\\,dt$. What is the value of $F''({p:g})$?"
    key = Opt(dec3(key_v), True, "By the Fundamental Theorem, F'(x) is the integrand, so F''(x) is the derivative of the integrand; evaluate it at the given x with a calculator.", key_v)
    bpr = _bpa("c_ftc_second_derivative_calc", "6.4", "1.D", "Find the second derivative of an accumulation function by differentiating its integrand",
               ["Use the Fundamental Theorem: F' is the integrand", "Differentiate the integrand to get F''", "Evaluate at the given x with a calculator"],
               [("the integrand is continuous and differentiable on the interval, so F is twice differentiable", "the integrand is a composition of differentiable functions")],
               [("first_derivative", "reports the first derivative F'"), ("function_value", "reports the value of F itself"), ("wrong_point", "evaluates at the wrong point"), ("log_derivative", "reports the logarithmic derivative of the integrand")],
               "F is computed by scipy quad and its second central difference with step 1e-3 is compared with the derivative of the integrand (independent of symbolic differentiation)")
    return build("c_ftc_second_derivative_calc", "6.4", "1.D", "required", stem, key, pool, rng, bpr, 90, [f"form={form}", f"k={k}", f"p={p}", f"key={key_v:.6f}"])


# 6.7 적분 방정식의 해(상한을 구하기)
def c_integral_equation_solve_calc(rng):
    c = rng.choice([2, 3, 4])
    tot = math.sqrt(math.pi * c) / 2
    m = round(rng.choice([0.35, 0.45, 0.55]) * tot, 2)
    kv = math.sqrt(c) * _Sp.erfinv(m / tot)
    # 독립 경로: 이분법 + 구적법
    lo, hi = 0.0, 10.0
    for _ in range(100):
        mid = (lo + hi) / 2
        if _I.quad(lambda t_: math.exp(-t_ * t_ / c), 0, mid)[0] < m:
            lo = mid
        else:
            hi = mid
    if abs(lo - kv) > 1e-8:
        raise ValueError("independent_check_failed")
    kf = math.sqrt(c * math.log(1 / m)) if 0 < m < 1 else None
    ds = [("Solves e^(-k^2/c) = m, setting the integrand instead of the integral equal to the target.", kf if kf else kv * 0.5), ("Takes k = m, as if the integrand were the constant 1 on the interval.", m),
          ("Solves for the k that makes the integral from -k to k equal to m, which is half the needed upper limit.", kv / 2), ("Uses the full area under the curve divided by the target.", tot / m)]
    pool = numopts(ds, kv, dec3)
    stem = f"For $k>0$, let $I(k)=\\int_0^{{k}} e^{{-t^{{2}}/{c}}}\\,dt$. For what value of $k$ is $I(k)={m:g}$?"
    key = Opt(dec3(kv), True, "I(k) is increasing in k, so solve I(k) = m with a calculator (numerical integration and a solver).", kv)
    bpr = _bpa("c_integral_equation_solve_calc", "6.7", "1.E", "Solve for the upper limit of an integral that equals a given value, using a calculator",
               ["Recognize that I(k) is increasing in k so the equation has one solution", "Set up the equation I(k) = m with a numerical integral", "Solve numerically for k"],
               [("I is continuous and increasing with I(0) = 0 and a limit larger than m", "the integrand is positive")],
               [("integrand_equals_target", "sets the integrand equal to the target"), ("constant_integrand", "treats the integrand as 1"), ("symmetric_interval", "uses -k to k"), ("total_over_target", "divides the total area by the target")],
               "bisection on the numerically integrated I(k) (independent of the inverse error function used to build the key)")
    return build("c_integral_equation_solve_calc", "6.7", "1.E", "required", stem, key, pool, rng, bpr, 95, [f"c={c}", f"m={m}", f"k={kv:.6f}"])


# ============================ 단원 3 ============================
# 3.6 음함수 곡선의 2계 도함수 d2y/dx2 (한 점에서)
def c_implicit_second_calc(rng):
    x0, y0 = rng.choice([(1, 1), (2, 1), (1, 0), (2, 0), (3, 1)])
    ysym = sp.Symbol("y")
    F = x ** 2 * ysym + sp.exp(ysym)
    cst = float(F.subs({x: x0, ysym: y0}))
    yp = -sp.diff(F, x) / sp.diff(F, ysym)
    ypp = sp.diff(yp, x) + sp.diff(yp, ysym) * yp
    m1 = float(yp.subs({x: x0, ysym: y0}))
    key_v = float(ypp.subs({x: x0, ysym: y0}))
    # 독립 경로: 곡선을 y(x) 로 수치 계산(브렌트)하고 2계 중심차분
    yf = lambda xx: _O.brentq(lambda yy: xx * xx * yy + math.exp(yy) - cst, y0 - 2.5, y0 + 2.5, xtol=1e-14)
    hh = 1e-3
    num2 = (yf(x0 + hh) - 2 * yf(x0) + yf(x0 - hh)) / hh ** 2
    if abs(num2 - key_v) > 1e-4 or abs(key_v) < 0.05:
        raise ValueError("independent_check_failed")
    no_chain = float(sp.diff(yp, x).subs({x: x0, ysym: y0}))
    wrong_sign = float((sp.diff(-yp, x) + sp.diff(-yp, ysym) * (-yp)).subs({x: x0, ysym: y0}))
    ds = [("Reports the first derivative dy/dx at the point instead of the second derivative.", m1), ("Differentiates dy/dx with respect to x but treats y as a constant, leaving out the dy/dx factor from the chain rule.", no_chain),
          ("Starts from dy/dx = F_x/F_y with the wrong sign, so the second derivative has the wrong sign structure.", wrong_sign), ("Reports the negative of the correct value after a sign slip in the quotient.", -key_v)]
    pool = numopts(ds, key_v, dec3)
    cst_tex = f"{x0 * x0}+e" if y0 == 1 else "1"
    stem = f"A curve is defined by $x^{{2}}y+e^{{y}}={cst_tex}$. The point $({x0},{y0})$ lies on the curve. What is the value of $\\dfrac{{d^{{2}}y}}{{dx^{{2}}}}$ at this point?"
    key = Opt(dec3(key_v), True, "Differentiate implicitly to get dy/dx = -2xy/(x^2 + e^y); differentiate again, replacing dy/dx wherever y is differentiated, and evaluate at the point with a calculator.", key_v)
    bpr = _bpa("c_implicit_second_calc", "3.6", "1.E", "Find a second derivative of an implicitly defined curve at a point",
               ["Differentiate implicitly once to express dy/dx in terms of x and y", "Differentiate dy/dx again with the quotient and chain rules, substituting dy/dx for the derivative of y", "Evaluate at the given point with a calculator"],
               [("the denominator x^2 + e^y is positive so y is a differentiable function of x near the point", "x^2 + e^y > 0 for all points")],
               [("first_derivative", "reports dy/dx instead of the second derivative"), ("missing_chain_factor", "treats y as a constant when differentiating again"), ("wrong_sign_start", "starts from the wrong sign of dy/dx"), ("sign_slip", "reports the opposite sign")],
               "the curve is solved for y(x) near the point with Brent's method and the second central difference (step 1e-3) is compared with the formula (independent of implicit differentiation)")
    return build("c_implicit_second_calc", "3.6", "1.E", "required", stem, key, pool, rng, bpr, 110, [f"x0={x0}", f"y0={y0}", f"ypp={key_v:.6f}"])


# ============================ 단원 2 ============================
# 2.2 도함수의 극한 정의를 알아보고 값 구하기
def c_limit_def_derivative_calc(rng):
    form = rng.choice(["xln", "xe", "xsin", "lnx_over_x", "ecos"])
    a_ = rng.choice([1, 2, 3]) if form != "ecos" else rng.choice([1, 2])
    fsym = {"xln": x * sp.log(x), "xe": x * sp.exp(x), "xsin": x * sp.sin(x), "lnx_over_x": sp.log(x) / x, "ecos": sp.exp(x) * sp.cos(x)}[form]
    # 곱·몫의 법칙만 쓰는 함수(2.8, 2.9)라 연쇄법칙(3 단원) 없이 도함수를 구한다
    ff = sp.lambdify(x, fsym, "math")
    key_v = float(sp.diff(fsym, x).subs(x, a_))
    if abs(key_v) < 0.05:
        raise ValueError("flat")
    q = lambda hh: (ff(a_ + hh) - ff(a_)) / hh
    if abs((ff(a_ + 1e-6) - ff(a_ - 1e-6)) / 2e-6 - key_v) > 1e-6 or abs(q(1e-7) - key_v) > 1e-4:
        raise ValueError("independent_check_failed")
    ltex = sp.latex(fsym).replace("\\log", "\\ln")
    fa = float(fsym.subs(x, a_))
    d1 = {"xln": sp.log(x), "xe": sp.exp(x), "xsin": sp.sin(x), "lnx_over_x": 1 / x, "ecos": sp.exp(x)}[form]
    ds = [("Reports the value of the function f(a), the first term of the difference quotient, instead of the limit.", fa), ("Reports f(a)/a, treating the limit as a slope from the origin.", fa / a_),
          ("Differentiates only one factor (or only the numerator) and ignores the product or quotient rule.", float(d1.subs(x, a_))), ("Reports the second derivative at the point instead of the first.", float(sp.diff(fsym, x, 2).subs(x, a_)))]
    pool = numopts(ds, key_v, dec3)
    stem = f"Let $f(x)={ltex}$. What is the value of $\\displaystyle\\lim_{{h\\to 0}}\\dfrac{{f({a_}+h)-f({a_})}}{{h}}$?"
    key = Opt(dec3(key_v), True, f"The limit is the definition of f'({a_}); differentiate with the product or quotient rule and evaluate at x = {a_} with a calculator.", key_v)
    bpr = _bpa("c_limit_def_derivative_calc", "2.2", "1.E", "Recognize a limit of a difference quotient as a derivative at a point and evaluate it",
               ["Identify the limit as the derivative f'(a) from the definition", "Differentiate f with the product or quotient rule", "Evaluate f'(a) with a calculator"],
               [("the limit of the difference quotient defines f'(a) when f is differentiable at a", "f is differentiable at a")],
               [("function_value", "reports f(a) itself"), ("slope_from_origin", "reports f(a)/a"), ("one_factor_only", "differentiates only one factor"), ("second_derivative", "reports f''(a)")],
               "the difference quotient is evaluated numerically with h = 10^-6 (symmetric) and h = 10^-7 (one-sided) and compared with the symbolic derivative")
    return build("c_limit_def_derivative_calc", "2.2", "1.E", "required", stem, key, pool, rng, bpr, 95, [f"form={form}", f"a={a_}", f"fprime={key_v:.6f}"])


# 2.7 접선의 x 절편
def c_tangent_x_intercept_calc(rng):
    form = rng.choice(["xln", "xe", "sinexp"])
    a_ = rng.choice([2.0, 3.0, 1.5]) if form == "xln" else rng.choice([0.5, 1.0, 1.5])
    f = {"xln": lambda u: u * math.log(u), "xe": lambda u: u * math.exp(u), "sinexp": lambda u: math.exp(u) * math.sin(u)}[form]
    fp = {"xln": lambda u: math.log(u) + 1, "xe": lambda u: math.exp(u) * (1 + u), "sinexp": lambda u: math.exp(u) * (math.sin(u) + math.cos(u))}[form]
    if abs(fp(a_)) < 0.05:
        raise ValueError("flat")
    key_v = a_ - f(a_) / fp(a_)
    # 독립 경로: 중심차분으로 기울기를 구해 접선과 x 축의 교점을 계산
    hh = 1e-6
    m_ = (f(a_ + hh) - f(a_ - hh)) / (2 * hh)
    if abs(a_ - f(a_) / m_ - key_v) > 1e-6:
        raise ValueError("independent_check_failed")
    ds = [("Adds instead of subtracts: x = a + f(a)/f'(a).", a_ + f(a_) / fp(a_)), ("Uses the reciprocal slope: x = a - f'(a)/f(a).", a_ - fp(a_) / f(a_)), ("Reports the y-intercept of the tangent line instead of the x-intercept.", f(a_) - fp(a_) * a_),
          ("Reports the x-intercept of the normal line instead of the tangent line.", a_ + f(a_) * fp(a_))]
    pool = numopts(ds, key_v, dec3)
    ftex = {"xln": "x\\ln x", "xe": "xe^{x}", "sinexp": "e^{x}\\sin x"}[form]
    stem = f"The line tangent to the graph of $f(x)={ftex}$ at $x={a_:g}$ crosses the $x$-axis at $x=c$. What is the value of $c$?"
    key = Opt(dec3(key_v), True, "The tangent line is y = f(a) + f'(a)(x - a); setting y = 0 gives x = a - f(a)/f'(a), evaluated with a calculator.", key_v)
    bpr = _bpa("c_tangent_x_intercept_calc", "2.7", "1.E", "Find where a tangent line crosses the x-axis using f(a) and f'(a)",
               ["Compute f(a) and f'(a) with the product rule and a calculator", "Write the tangent line at x = a", "Solve for the x-value where the line equals zero"],
               [("the tangent line has slope f'(a) and passes through (a, f(a)), and f'(a) is not zero", "the slope at the point is nonzero")],
               [("sign_error", "adds instead of subtracts"), ("reciprocal_slope", "uses the reciprocal slope"), ("y_intercept", "reports the y-intercept"), ("normal_line", "uses the normal line")],
               "the slope is recomputed by central difference (step 1e-6) and the intersection of the numerical tangent line with the x-axis is compared (independent of the symbolic derivative)")
    return build("c_tangent_x_intercept_calc", "2.7", "1.E", "required", stem, key, pool, rng, bpr, 95, [f"form={form}", f"a={a_}", f"c={key_v:.6f}"])


# ============================ 단원 4 ============================
# 4.5 관련 변화율: 카메라 각도의 변화율
def c_related_rates_angle_calc(rng):
    d = rng.choice([700, 800, 900, 1200])
    h0 = rng.choice([430, 650, 730, 910])
    v = rng.choice([35, 45, 55, 65])
    key_v = v * d / (d * d + h0 * h0)
    # 독립 경로: θ(h) = arctan(h/d) 를 시간에 대해 h(t) = h0 + v t 로 놓고 중심차분
    th = lambda tt: math.atan((h0 + v * tt) / d)
    hh = 1e-4
    if abs((th(hh) - th(-hh)) / (2 * hh) - key_v) > 1e-9:
        raise ValueError("independent_check_failed")
    ds = [("Uses the height instead of the horizontal distance in the numerator: v h/(d^2 + h^2).", v * h0 / (d * d + h0 * h0)), ("Omits the sec^2 factor and uses d(theta)/dt = v/d.", v / d),
          ("Forgets to convert tan(theta) = h/d: uses d(theta)/dt = (dh/dt)/(d^2 + h^2).", v / (d * d + h0 * h0)), ("Reports the rate in degrees per second.", math.degrees(key_v))]
    pool = numopts(ds, key_v, lambda z: "$%.5f$" % z)
    stem = f"A camera on the ground is ${d}$ feet from the base of a vertical launch tower. A rocket rises straight up from the base at a constant ${v}$ feet per second. Let $\\theta$ be the angle of elevation of the camera, in radians, to the rocket. At the instant the rocket is ${h0}$ feet high, what is the rate of change of $\\theta$, in radians per second?"
    key = Opt("$%.5f$" % key_v, True, "tan(theta) = h/d gives sec^2(theta) d(theta)/dt = (1/d) dh/dt, and sec^2(theta) = (d^2 + h^2)/d^2, so d(theta)/dt = v d/(d^2 + h^2).", key_v)
    bpr = _bpa("c_related_rates_angle_calc", "4.5", "1.D", "Solve a related rates problem for an angle of elevation using tan(theta) = h/d",
               ["Relate the angle, the fixed distance, and the height with tan(theta) = h/d", "Differentiate implicitly with respect to time", "Substitute the instant's height and rate and evaluate with a calculator"],
               [("the camera distance is constant while the height changes at a known rate", "stated in the problem")],
               [("height_in_numerator", "uses h instead of d"), ("missing_secant_squared", "omits the sec^2 factor"), ("missing_distance", "drops the distance factor"), ("degrees", "reports degrees")],
               "theta(t) = arctan((h0 + v t)/d) is differentiated by central difference at t = 0 (independent of the implicit differentiation)")
    return build("c_related_rates_angle_calc", "4.5", "1.D", "required", stem, key, pool, rng, bpr, 105, [f"d={d}", f"h0={h0}", f"v={v}", f"rate={key_v:.7f}"])


# 4.2 가장 큰 속력
def c_max_speed_calc(rng):
    k = rng.choice([3, 4, 5])
    w = rng.choice([2, 3])
    T = rng.choice([3, 4, 5])
    pos = lambda u: math.exp(u / k) * math.sin(w * u)
    vel = lambda u: math.exp(u / k) * (w * math.cos(w * u) + math.sin(w * u) / k)
    acc_ = lambda u: (vel(u + 1e-6) - vel(u - 1e-6)) / 2e-6
    cands = [0.0, float(T)] + _roots(acc_, 0, T)
    sp_best = max(abs(vel(u)) for u in cands)
    grid = max(abs(vel(T * i / 200000)) for i in range(200001))
    if abs(grid - sp_best) > 1e-7:
        raise ValueError("independent_check_failed")
    vmax_signed = max(vel(T * i / 20000) for i in range(20001))
    vmin_signed = min(vel(T * i / 20000) for i in range(20001))
    if abs(vmin_signed) < vmax_signed * 1.05:
        raise ValueError("speed_equals_velocity_max")
    ds = [("Reports the greatest velocity (positive value) instead of the greatest speed, which can occur when velocity is negative.", vmax_signed), ("Reports the speed at the final time t = T only.", abs(vel(T))),
          ("Reports the speed at time t = 0 only.", abs(vel(0.0))), ("Reports the greatest distance from the origin, the maximum of |x(t)|.", max(abs(pos(T * i / 20000)) for i in range(20001)))]
    pool = numopts(ds, sp_best, dec3)
    stem = f"A particle moves along the $x$-axis so that its position at time $t$ is $x(t)=e^{{t/{k}}}\\sin({w}t)$ for $0\\le t\\le {T}$. What is the greatest speed of the particle on this interval?"
    key = Opt(dec3(sp_best), True, "Speed is |x'(t)|; find where the acceleration is zero (and the endpoints) with a calculator and compare |x'| at those times; the largest value is the greatest speed.", sp_best)
    bpr = _bpa("c_max_speed_calc", "4.2", "1.E", "Find the greatest speed of a particle by the candidates test applied to |v|",
               ["Differentiate the position to get the velocity", "Find the critical points of the speed from the zeros of the acceleration with a calculator", "Compare |v| at the critical points and the endpoints"],
               [("speed is |v| and its maximum on a closed interval occurs at an endpoint or where the acceleration is zero", "|v| is continuous on the interval")],
               [("velocity_not_speed", "reports the greatest velocity"), ("final_time_only", "uses t = T"), ("initial_time_only", "uses t = 0"), ("max_position", "reports the greatest position")],
               "the maximum of |x'(t)| over a 200001-point grid on [0, T] (independent of Brent's method on the acceleration)")
    return build("c_max_speed_calc", "4.2", "1.E", "required", stem, key, pool, rng, bpr, 110, [f"k={k}", f"w={w}", f"T={T}", f"speed={sp_best:.6f}"])


# ============================ 단원 8 ============================
# 8.2 총 이동 거리(속도의 부호가 바뀌는 구간)
def c_total_distance_calc(rng):
    a_, T = rng.choice([(1.0, 4.0), (1.0, 5.0), (2.0, 4.0), (0.5, 6.0)])
    v = lambda t_: t_ * math.cos(a_ * t_)
    rts = _roots(v, 0.001, T)
    if not rts:
        raise ValueError("no_sign_change")
    pts = [0.0] + rts + [T]
    key_v = sum(abs(_I.quad(v, pts[i], pts[i + 1])[0]) for i in range(len(pts) - 1))
    # 독립 경로: |v| 를 한 번에 구적(분할점 지정)이 아니라 심프슨 합성
    n = 400000
    hh = T / n
    s = abs(v(0)) + abs(v(T)) + sum((4 if i % 2 else 2) * abs(v(i * hh)) for i in range(1, n))
    if abs(s * hh / 3 - key_v) > 1e-5:
        raise ValueError("independent_check_failed")
    disp = _I.quad(v, 0, T)[0]
    ds = [("Reports the displacement, the integral of v, which lets the negative part cancel.", disp), ("Counts only the part of the motion before the velocity first changes sign.", abs(_I.quad(v, 0, rts[0])[0])),
          ("Reports the final speed |v(T)| instead of a distance.", abs(v(T))), ("Takes the absolute value of the displacement instead of integrating |v|.", abs(disp))]
    pool = numopts(ds, key_v, dec3)
    arg = f"{a_:g}t" if a_ != 1.0 else "t"
    stem = f"A particle moves along a line with velocity $v(t)=t\\cos({arg})$ for $0\\le t\\le {T:g}$. What is the total distance traveled by the particle during this time interval?"
    key = Opt(dec3(key_v), True, "Total distance is the integral of |v|; find where v changes sign with a calculator and add the absolute values of the integrals on the intervals between sign changes.", key_v)
    bpr = _bpa("c_total_distance_calc", "8.2", "1.D", "Find total distance traveled when the velocity changes sign, using the integral of |v|",
               ["Find where v(t) = 0 and check the sign of v on each subinterval", "Integrate |v| piece by piece with a calculator", "Add the distances"],
               [("distance traveled is the integral of speed |v|, not the integral of v", "v changes sign inside the interval")],
               [("displacement", "reports the integral of v"), ("first_piece_only", "stops at the first turn"), ("speed_not_distance", "reports a speed"), ("doubled_displacement", "doubles the displacement")],
               "|v| is integrated with a composite Simpson rule on 400000 subintervals (independent of the sign-change splitting and scipy quad)")
    return build("c_total_distance_calc", "8.2", "1.D", "required", stem, key, pool, rng, bpr, 100, [f"a={a_}", f"T={T}", f"dist={key_v:.6f}"])


# ============================ BC ============================
# 7.9 로지스틱 모형이 주어진 값에 도달하는 시각
def c_bc_logistic_time_calc(rng):
    K, P0, k, frac = rng.choice([(500, 40, 0.08, 0.7), (800, 50, 0.05, 0.6), (1200, 100, 0.06, 0.8), (600, 30, 0.1, 0.5)])
    Pt = K * frac if frac != 0.5 else K * 0.45
    A = (K - P0) / P0
    key_v = math.log(Pt * (K - P0) / (P0 * (K - Pt))) / k
    # 독립 경로: dP/dt = k P (1 - P/K) 를 룽게-쿠타로 적분해 P 가 Pt 가 되는 시각을 이분법으로
    from scipy.integrate import solve_ivp
    ev = lambda t_, y_: y_[0] - Pt
    ev.terminal = True
    sol = solve_ivp(lambda t_, y_: [k * y_[0] * (1 - y_[0] / K)], [0, 400], [P0], events=ev, rtol=1e-11, atol=1e-11)
    if abs(sol.t_events[0][0] - key_v) > 1e-5:
        raise ValueError("independent_check_failed")
    ds = [("Uses exponential growth P = P0 e^(kt), ignoring the carrying capacity.", math.log(Pt / P0) / k), ("Reports the time of fastest growth, when P = K/2.", math.log(A) / k),
          ("Solves P(t) = Pt with a sign error inside the logarithm: ln(Pt (K - P0)/(P0 (K + Pt)))/k.", math.log(Pt * (K - P0) / (P0 * (K + Pt))) / k), ("Forgets to divide by k.", key_v * k)]
    pool = numopts(ds, key_v, dec3)
    stem = f"A population $P(t)$ satisfies the logistic differential equation $\\dfrac{{dP}}{{dt}}={k:g}P\\left(1-\\dfrac{{P}}{{{K}}}\\right)$, where $t$ is measured in years and $P(0)={P0}$. At what time $t$ does the population reach ${Pt:g}$?"
    key = Opt(dec3(key_v), True, "The solution is P = K/(1 + A e^(-kt)) with A = (K - P0)/P0; solve P(t) = target for t with logarithms and a calculator.", key_v)
    bpr = _bpa("c_bc_logistic_time_calc", "7.9", "1.E", "Find when a logistic population reaches a given size from the closed-form solution",
               ["Use the logistic solution P = K/(1 + A e^(-kt)) with A from the initial value", "Set P(t) equal to the target and solve for e^(-kt)", "Take logarithms and evaluate with a calculator"],
               [("the solution of the logistic equation with 0 < P0 < K has the form K/(1 + A e^(-kt))", "P0 is between 0 and K")],
               [("exponential_model", "ignores the carrying capacity"), ("fastest_growth_time", "reports when P = K/2"), ("sign_error", "wrong sign in the logarithm"), ("missing_k", "forgets to divide by k")],
               "the differential equation is integrated numerically (Runge-Kutta, tolerance 1e-11) and the crossing time of the target is located with an event (independent of the closed-form solution)", subject=BC_)
    return build("c_bc_logistic_time_calc", "7.9", "1.E", "required", stem, key, pool, rng, bpr, 105, [f"K={K}", f"P0={P0}", f"k={k}", f"Pt={Pt}", f"t={key_v:.6f}"])


# 9.6 벡터 운동의 가장 큰 속력
def c_bc_vector_speed_max_calc(rng):
    a_, b_, c_, T = rng.choice([(2, 3, 1, 3), (1, 4, 2, 4), (3, 2, 1, 3), (2, 5, 1, 4)])
    xp = lambda t_: a_ * t_
    yp = lambda t_: b_ * math.cos(c_ * t_)
    sp_ = lambda t_: math.hypot(xp(t_), yp(t_))
    dsp = lambda t_: (sp_(t_ + 1e-6) - sp_(t_ - 1e-6)) / 2e-6
    cands = [0.0, float(T)] + _roots(dsp, 0.001, T)
    key_v = max(sp_(u) for u in cands)
    grid = max(sp_(T * i / 300000) for i in range(300001))
    if abs(grid - key_v) > 1e-7:
        raise ValueError("independent_check_failed")
    ds = [("Reports the greatest value of the horizontal component x'(t) = a t instead of the speed.", xp(T)), ("Reports the greatest value of |y'(t)| instead of the speed.", float(b_)),
          ("Adds the components instead of using the magnitude: the greatest value of |x'| + |y'|.", max(abs(xp(T * i / 3000)) + abs(yp(T * i / 3000)) for i in range(3001))), ("Reports the speed at t = 0 only.", sp_(0.0))]
    pool = numopts(ds, key_v, dec3)
    stem = f"A particle moves in the $xy$-plane so that its velocity vector at time $t$ is $\\langle {a_}t,\\ {b_}\\cos({c_ if c_ != 1 else ''}t)\\rangle$ for $0\\le t\\le {T}$. What is the greatest speed of the particle on this interval?"
    key = Opt(dec3(key_v), True, "Speed is sqrt((x')^2 + (y')^2); find where its derivative is zero (and the endpoints) with a calculator and compare the speeds there.", key_v)
    bpr = _bpa("c_bc_vector_speed_max_calc", "9.6", "1.E", "Find the greatest speed of a particle from its velocity vector using the candidates test",
               ["Write the speed as the magnitude of the velocity vector", "Locate critical points of the speed and the endpoints with a calculator", "Compare the speeds"],
               [("speed is the magnitude of the velocity vector and is continuous on the closed interval", "the components are continuous")],
               [("x_component_only", "uses one component"), ("y_component_only", "uses the other component"), ("sum_of_components", "adds components"), ("initial_speed", "uses t = 0")],
               "the maximum speed over a 300001-point grid on [0, T] (independent of Brent's method on the derivative of the speed)", subject=BC_)
    return build("c_bc_vector_speed_max_calc", "9.6", "1.E", "required", stem, key, pool, rng, bpr, 105, [f"a={a_}", f"b={b_}", f"c={c_}", f"T={T}", f"speed={key_v:.6f}"])


# 9.9 두 극곡선 사이의 넓이
def c_bc_polar_between_calc(rng):
    a_, b_, c_ = rng.choice([(3, 2, 2), (4, 2, 3), (5, 3, 4), (4, 3, 2), (5, 2, 3)])
    # 바깥 r1 = a + b cos θ, 안쪽 r2 = c (원) 의 교점에서 위쪽 절반을 만든 영역: a + b cos θ ≥ c 인 θ ∈ [-t0, t0] (c < a + b)
    cosv = (c_ - a_) / b_
    if not (-1 < cosv < 1):
        raise ValueError("no_intersection")
    t0 = math.acos(cosv)
    r1 = lambda u: a_ + b_ * math.cos(u)
    key_v = 0.5 * _I.quad(lambda u: r1(u) ** 2 - c_ ** 2, -t0, t0)[0]
    # 독립 경로: 직교 좌표 격자에서 영역(곡선 r1 안쪽이고 원 r=c 바깥)의 넓이를 몬테카를로가 아니라 극 격자 합으로
    n = 400000
    s = 0.0
    for i in range(n):
        u = -t0 + 2 * t0 * (i + 0.5) / n
        s += 0.5 * (r1(u) ** 2 - c_ ** 2) * (2 * t0 / n)
    if abs(s - key_v) > 1e-6:
        raise ValueError("independent_check_failed")
    ds = [("Uses r1^2 - r2^2 without the factor 1/2.", 2 * key_v), ("Integrates (r1 - r2)^2/2 instead of (r1^2 - r2^2)/2.", 0.5 * _I.quad(lambda u: (r1(u) - c_) ** 2, -t0, t0)[0]),
          ("Takes only the upper half, from 0 to the intersection angle.", key_v / 2), ("Integrates over the whole circle 0 to 2 pi, including the part where the limacon is inside the circle.", 0.5 * _I.quad(lambda u: r1(u) ** 2 - c_ ** 2, 0, 2 * math.pi)[0])]
    pool = numopts(ds, key_v, dec3)
    stem = f"Let $R$ be the region that lies inside the polar curve $r={a_}+{b_}\\cos\\theta$ and outside the circle $r={c_}$. What is the area of $R$?"
    key = Opt(dec3(key_v), True, "The curves intersect where a + b cos(theta) = c; the area is (1/2) times the integral of (r_outer^2 - r_inner^2) over the angles where the limacon is outside the circle, from -theta0 to theta0, evaluated with a calculator.", key_v)
    bpr = _bpa("c_bc_polar_between_calc", "9.9", "1.D", "Find the area between two polar curves by locating the intersection angles and subtracting squares",
               ["Solve for the angle at which the two curves meet", "Set up one half the integral of the outer radius squared minus the inner radius squared over the correct angles", "Evaluate with a calculator"],
               [("the limacon is outside the circle exactly for angles between -theta0 and theta0", "a + b cos(theta) >= c there")],
               [("missing_half", "omits the factor 1/2 of the polar area formula"), ("difference_squared", "squares the difference of radii"), ("half_region", "uses only the upper half"), ("full_circle", "integrates over the whole circle")],
               "the area is summed from 400000 polar sectors between the intersection angles (independent of scipy quad)", subject=BC_)
    return build("c_bc_polar_between_calc", "9.9", "1.D", "required", stem, key, pool, rng, bpr, 110, [f"a={a_}", f"b={b_}", f"c={c_}", f"area={key_v:.6f}"])


# 9.7 극곡선의 접선 기울기
def c_bc_polar_slope_calc(rng):
    a_, b_ = rng.choice([(2, 1), (3, 2), (1, 2), (4, 3), (2, 3)])
    kind = rng.choice(["sin", "cos"])
    th0 = rng.choice([math.pi / 6, math.pi / 4, math.pi / 3, 2 * math.pi / 3])
    r = (lambda u: a_ + b_ * math.sin(u)) if kind == "sin" else (lambda u: a_ + b_ * math.cos(u))
    rp = (lambda u: b_ * math.cos(u)) if kind == "sin" else (lambda u: -b_ * math.sin(u))
    dydx = (rp(th0) * math.sin(th0) + r(th0) * math.cos(th0)) / (rp(th0) * math.cos(th0) - r(th0) * math.sin(th0))
    xf = lambda u: r(u) * math.cos(u)
    yf = lambda u: r(u) * math.sin(u)
    hh = 1e-6
    num = (yf(th0 + hh) - yf(th0 - hh)) / (xf(th0 + hh) - xf(th0 - hh))
    if abs(num - dydx) > 1e-6 or abs(dydx) < 0.05 or abs(dydx) > 40:
        raise ValueError("independent_check_failed")
    tanth = math.tan(th0)
    ds = [("Uses dy/dx = (dr/d theta)... equal to dr/d theta divided by r, the slope in the (theta, r) plane.", rp(th0) / r(th0)), ("Inverts the quotient: (dx/d theta)/(dy/d theta).", 1 / dydx),
          ("Uses the slope of the radial line, tan(theta), instead of the tangent line.", tanth), ("Differentiates y = r sin(theta) but forgets the r' sin(theta) term: dy/d theta = r cos(theta) only, over dx/d theta.", (r(th0) * math.cos(th0)) / (rp(th0) * math.cos(th0) - r(th0) * math.sin(th0)))]
    pool = numopts(ds, dydx, dec3)
    thtex = {math.pi / 6: "\\frac{\\pi}{6}", math.pi / 4: "\\frac{\\pi}{4}", math.pi / 3: "\\frac{\\pi}{3}", 2 * math.pi / 3: "\\frac{2\\pi}{3}"}[th0]
    stem = f"What is the slope of the line tangent to the polar curve $r={a_}+{b_}\\{kind}\\theta$ at $\\theta={thtex}$?"
    key = Opt(dec3(dydx), True, "With x = r cos(theta) and y = r sin(theta), dy/dx = (r' sin(theta) + r cos(theta))/(r' cos(theta) - r sin(theta)); evaluate at the given angle with a calculator.", dydx)
    bpr = _bpa("c_bc_polar_slope_calc", "9.7", "1.E", "Find the slope of a tangent line to a polar curve from x = r cos(theta) and y = r sin(theta)",
               ["Write x and y in terms of theta and differentiate with the product rule", "Form dy/dx = (dy/d theta)/(dx/d theta)", "Evaluate at the given angle with a calculator"],
               [("dx/d theta is not zero at the given angle", "the denominator is nonzero at that angle")],
               [("slope_in_r_theta_plane", "uses r'/r, the slope in the (theta, r) plane"), ("inverted_quotient", "inverts the quotient dy/dx"), ("radial_slope", "uses tan(theta), the slope of the radial line"), ("missing_product_term", "drops a product rule term")],
               "x(theta) and y(theta) are evaluated and differenced numerically with step 1e-6, and the ratio of the differences is compared with the formula (independent of the product rule)", subject=BC_)
    return build("c_bc_polar_slope_calc", "9.7", "1.E", "required", stem, key, pool, rng, bpr, 100, [f"a={a_}", f"b={b_}", f"kind={kind}", f"slope={dydx:.6f}"])


# 10.14 매클로린 급수로 극한 구하기
def c_series_limit_eval(rng):
    form = rng.choice(["exp", "sin", "cos", "ln"])
    k = rng.choice([1, 2, 3]) if form in ("exp", "sin") else 1
    if form == "exp":
        num, den, lim = f"e^{{{'' if k == 1 else k}x}}-1-{'' if k == 1 else k}x", "x^{2}", sp.Rational(k * k, 2)
        fn = lambda u: (math.exp(k * u) - 1 - k * u) / u ** 2
        ds = [(sp.Rational(k), "Uses only the first term of the series, giving k."), (sp.Rational(k * k, 6), "Divides the x^2 coefficient by 3! instead of 2!."), (sp.Rational(k ** 3, 6), "Uses the coefficient of x^3 instead of x^2."), (sp.Integer(0), "Concludes the limit is 0 because the numerator tends to 0.")]
    elif form == "sin":
        num, den, lim = f"\\sin({'' if k == 1 else k}x)-{'' if k == 1 else k}x", "x^{3}", -sp.Rational(k ** 3, 6)
        fn = lambda u: (math.sin(k * u) - k * u) / u ** 3
        ds = [(sp.Rational(k ** 3, 6), "Uses the wrong sign for the cubic term of sin."), (-sp.Rational(k, 6), "Forgets the factor k^3 from substituting kx."), (-sp.Rational(k ** 3, 2), "Divides by 2! instead of 3!."), (sp.Integer(0), "Concludes the limit is 0 because the numerator tends to 0.")]
    elif form == "cos":
        num, den, lim = "\\cos x-1+\\dfrac{x^{2}}{2}", "x^{4}", sp.Rational(1, 24)
        fn = lambda u: (math.cos(u) - 1 + u * u / 2) / u ** 4
        ds = [(-sp.Rational(1, 24), "Uses the wrong sign for the x^4 term of cos."), (sp.Rational(1, 12), "Divides by 3! instead of 4!."), (sp.Rational(1, 2), "Uses the x^2 coefficient, which cancels."), (sp.Integer(0), "Concludes the limit is 0 because the numerator tends to 0.")]
    else:
        num, den, lim = "\\ln(1+x)-x", "x^{2}", -sp.Rational(1, 2)
        fn = lambda u: (math.log(1 + u) - u) / u ** 2
        ds = [(sp.Rational(1, 2), "Uses the wrong sign for the quadratic term of ln(1+x)."), (-sp.Rational(1, 4), "Divides by 4 instead of 2."), (sp.Integer(-1), "Uses the coefficient of x in the denominator of the series."), (sp.Integer(0), "Concludes the limit is 0 because the numerator tends to 0.")]
    # 독립 경로: 작은 h 의 값(고정밀)과 sympy limit
    hv = 1e-3
    if abs((fn(hv) + fn(-hv)) / 2 - float(lim)) > 1e-4:
        raise ValueError("independent_check_failed")
    pool = opts([(w, v) for v, w in ds], lim, anyfmt)
    stem = f"What is the value of $\\displaystyle\\lim_{{x\\to 0}}\\dfrac{{{num}}}{{{den}}}$?"
    key = Opt(anyfmt(lim), True, "Replace the numerator by its Maclaurin series; the low-order terms cancel and the first remaining term divided by the power of x in the denominator gives the limit.", lim)
    bpr = _bpa("c_series_limit_eval", "10.14", "1.E", "Evaluate a limit of an indeterminate form using the Maclaurin series of the numerator",
               ["Write the Maclaurin series of the numerator and cancel the leading terms", "Divide by the power of x in the denominator", "Take the limit as x tends to 0"],
               [("the Maclaurin series converges to the function near 0, so the limit can be computed term by term", "the series for these functions converge near 0")],
               [("wrong_sign", "uses the wrong sign of a series term"), ("wrong_factorial", "uses the wrong factorial"), ("wrong_term", "uses the wrong term"), ("zero_limit", "assumes the limit is 0")],
               "the quotient is evaluated at x = +/-10^-3 in floating point and averaged (independent of the series expansion)", subject=BC_, calc="not_allowed")
    return build("c_series_limit_eval", "10.14", "1.E", "not_allowed", stem, key, pool, rng, bpr, 95, [f"form={form}", f"k={k}", f"lim={lim}"])
