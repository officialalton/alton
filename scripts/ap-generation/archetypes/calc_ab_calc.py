"""AB 계산기 필수 MC 신규 원형 3종(설계도 포함, 2026-10-09 소규모 검증). 단원 1·3·7 에 계산기 필수 문항이 없던 칸을 채운다."""
from common import *
from bp import mc_blueprint
from scipy import integrate as _I, optimize as _O

SUB = "ap_calculus_ab"
def _v(v): return "$%.3f$" % v

# ---- 3.1 연쇄법칙(곱과 합성) 한 점에서의 도함수 — 계산기로 수치 평가
def deriv_calc_chain(rng):
    a, b = rnd(rng, 1, 4), rnd(rng, 1, 5); c = rng.choice([0.2, 0.3, 0.4, 0.5]); p = rng.choice([1, 2, 3])
    f = sp.log(a * x ** 2 + b) * sp.exp(c * x)
    key_v = float(sp.N(sp.diff(f, x).subs(x, p)))                      # 생성 경로: 기호 미분
    ff = sp.lambdify(x, f, "math"); hh = 1e-6
    if abs((ff(p + hh) - ff(p - hh)) / (2 * hh) - key_v) > 1e-5: raise ValueError("independent_check_failed")   # 독립 경로: 중심 차분
    u, up, w = math.log(a * p * p + b), 2 * a * p / (a * p * p + b), math.exp(c * p)
    d_nochain = (1 / (a * p * p + b)) * w + u * c * w                    # 안쪽 함수의 도함수 누락
    d_prodrop = up * w                                                   # 곱의 법칙에서 두 번째 항 누락
    d_nofactor = up * w + u * w                                          # e^{cx} 의 도함수에서 c 누락
    stem = f"Let $f(x)=\\ln\\left({a}x^{{2}}+{b}\\right)e^{{{c}x}}$. What is the value of $f'({p})$?"
    key = Opt(_v(key_v), True, "Product rule with the chain rule on both the logarithm and the exponential, evaluated numerically.", key_v)
    ds = [Opt(_v(d_nochain), False, "Differentiates the logarithm without the inner derivative factor.", d_nochain), Opt(_v(d_prodrop), False, "Product rule with the second term omitted.", d_prodrop),
          Opt(_v(d_nofactor), False, "Differentiates the exponential as e^{cx} without the factor c.", d_nofactor)]
    bp = mc_blueprint("deriv_calc_chain", SUB, "3.1", "1.E", "required", "Derivative of a product of composite functions at a point, evaluated with a calculator",
        ["Recognize the function as a product of two composite functions", "Apply the product and chain rules to get f' symbolically", "Evaluate f' at the given point with a graphing calculator"],
        [("f is differentiable at the point (logarithm argument positive)", f"{a}x^2+{b} > 0 for all x, exponential defined everywhere")], [("no_inner_derivative", "drops the inner derivative of the logarithm argument"), ("product_term_omitted", "uses only one term of the product rule"), ("missing_exponent_factor", "forgets the factor c from differentiating the exponent")],
        "symbolic derivative (sympy) cross-checked by a central finite difference with step 1e-6 on the original function")
    return pack("deriv_calc_chain", "3.1", "1.E", "required", stem, key, ds, rng, est=75, facts=[f"value={key_v:.6f}"], extra={"blueprint": bp})

# ---- 1.16 중간값 정리: f(c)=k 의 해를 계산기로 구하기
def ivt_solve_calc(rng):
    a_, b_ = rng.choice([1, 2, 3]), rng.choice([0.5, 1, 2]); hi = rng.choice([2, 3])
    g = lambda v: v * math.exp(v / b_) + a_ * v
    k = round(g(hi) * rng.choice([0.4, 0.5, 0.6]), 1)
    if not (g(0) < k < g(hi)): raise ValueError("k_out_of_range")
    root = _O.brentq(lambda v: g(v) - k, 0, hi, xtol=1e-12)                # 생성 경로: brentq
    lo_, hi_ = 0.0, float(hi)
    for _ in range(80):                                                    # 독립 경로: 직접 이분법
        mid = (lo_ + hi_) / 2
        if g(mid) < k: lo_ = mid
        else: hi_ = mid
    if abs(root - (lo_ + hi_) / 2) > 1e-6: raise ValueError("independent_check_failed")
    mid_c = hi / 2; lin = hi * (k - g(0)) / (g(hi) - g(0)); wrongk = _O.brentq(lambda v: g(v) - k / 2, 0, hi, xtol=1e-12)
    stem = f"The function $f(x)=xe^{{x/{b_}}}+{a_}x$ is continuous on $[0,{hi}]$. By the Intermediate Value Theorem there is a number $c$ in $(0,{hi})$ with $f(c)={k}$. What is the value of $c$?"
    key = Opt(_v(root), True, "Solve f(x)=k on the interval with a graphing calculator (f is increasing, so the solution is unique).", root)
    ds = [Opt(_v(mid_c), False, "Takes the midpoint of the interval as the solution.", mid_c), Opt(_v(lin), False, "Interpolates linearly between f(0) and the right-endpoint value.", lin), Opt(_v(wrongk), False, "Solves f(x)=k/2 instead of f(x)=k.", wrongk)]
    bp = mc_blueprint("ivt_solve_calc", SUB, "1.16", "1.E", "required", "Use the Intermediate Value Theorem guarantee and solve f(c)=k numerically",
        ["Check the function is continuous and k lies between f(0) and f(b)", "Set up f(x)=k on the interval", "Solve the equation numerically with a graphing calculator"],
        [("f is continuous on the closed interval and strictly increasing so the solution is unique", "f'(x)=e^{x/b}(1+x/b)+a > 0 on [0, b]")], [("midpoint", "assumes the solution is the midpoint of the interval"), ("linear_interpolation", "assumes f is linear between endpoints"), ("wrong_target", "solves for the wrong target value")],
        "brentq root (generation) cross-checked by a hand-written bisection with 80 halvings on the same function")
    return pack("ivt_solve_calc", "1.16", "1.E", "required", stem, key, ds, rng, est=80, facts=[f"c={root:.6f}", f"k={k}"], extra={"blueprint": bp})

# ---- 7.7 분리 가능한 미분방정식의 특수해 값 — 계산기 필수
def diffeq_value_calc(rng):
    k = rng.choice([0.2, 0.3, 0.4, 0.5]); A = rng.choice([2, 3, 4, 5]); b = rng.choice([2, 3])
    key_v = A * math.exp(k * b * b / 2)                                     # 생성 경로: 분리 후 닫힌 형태
    sol = _I.solve_ivp(lambda xx, yy: k * xx * yy, [0, b], [A], rtol=1e-11, atol=1e-13)   # 독립 경로: 수치 적분
    if abs(sol.y[0][-1] - key_v) > 1e-6: raise ValueError("independent_check_failed")
    d_nohalf = A * math.exp(k * b * b); d_lin = A * math.exp(k * b); d_add = A + k * b * b / 2
    stem = f"The function $y=f(x)$ satisfies $\\dfrac{{dy}}{{dx}}={k}xy$ with $f(0)={A}$. What is the value of $f({b})$?"
    key = Opt(_v(key_v), True, "Separate variables, integrate to get ln|y| = kx^2/2 + C, apply the initial condition, and evaluate with a calculator.", key_v)
    ds = [Opt(_v(d_nohalf), False, "Integrates kx dx as kx^2 and forgets the factor 1/2.", d_nohalf), Opt(_v(d_lin), False, "Treats x as a constant when integrating, giving an exponent kx.", d_lin), Opt(_v(d_add), False, "Adds the integral of the right side instead of exponentiating.", d_add)]
    bp = mc_blueprint("diffeq_value_calc", SUB, "7.7", "1.E", "required", "Particular solution of a separable differential equation evaluated at a point",
        ["Separate the variables dy/y = kx dx", "Integrate both sides and apply the initial condition", "Evaluate the particular solution at the requested value with a calculator"],
        [("y stays positive on the interval so ln|y| = ln y", f"y(0)={A}>0 and the solution A*exp(k x^2/2) is positive")], [("lost_half_factor", "forgets the 1/2 when integrating x"), ("treat_x_constant", "treats x as constant during integration"), ("additive_not_exponential", "adds instead of exponentiating")],
        "closed form from separation cross-checked by adaptive Runge-Kutta numerical integration (rtol 1e-11)")
    return pack("diffeq_value_calc", "7.7", "1.E", "required", stem, key, ds, rng, est=85, facts=[f"value={key_v:.6f}"], extra={"blueprint": bp})
