"""예비 3차(R3-A, 2026-10-12): 계산기 필수 MC 원형 2군 — 단원 4(운동·변화율·관련 변화율·선형근사). 오답 값은 해설에 적은 실수를 코드로 그대로 계산한다."""
from gcommon import *
from scommon import textopts
from scipy import optimize as _O, integrate as _I
from calc_graph_d import dopts
from calc_r3_a1 import _nbp, _bis
import math


def _first_root(fn, lo, hi, n=6000):
    xs = [lo + (hi - lo) * i / n for i in range(n + 1)]
    for i in range(n):
        if fn(xs[i]) * fn(xs[i + 1]) < 0:
            return _O.brentq(fn, xs[i], xs[i + 1], xtol=1e-13)
    return None


# 4.2 운동 방향이 처음 바뀌는 시각
def c_motion_first_reversal_calc(rng):
    a, b = rng.choice([2, 3, 4]), rng.choice([0.5, 0.8, 1.0])
    v = lambda t_: a * math.cos(t_) - b * t_
    key = _first_root(v, 0.0, 6.0)
    if key is None:
        raise ValueError("no_root")
    kb = _bis(v, max(0.0, key - 0.01), key + 0.01)  # 독립 경로: 별도 이분법
    sgn = v(key - 1e-4) * v(key + 1e-4)
    if abs(kb - key) > 1e-6 or sgn >= 0:
        raise ValueError("independent_check_failed")
    cands = [(f"Solves $v'(t)=0$, the time the acceleration is zero, which is $t=\\pi+\\arcsin\\left(\\frac{{{b:g}}}{{{a}}}\\right)$.", math.pi + math.asin(b / a)),
             (f"Solves ${a}\\cos t={b:g}$, dropping the factor $t$ from the linear term.", math.acos(b / a)), ("Sets only the cosine factor to zero, $\\cos t=0$.", math.pi / 2),
             (f"Replaces $\\cos t$ by $1$ and solves ${a}={b:g}t$.", a / b)]
    good = [(w, z) for w, z in cands if 0 < z <= 6]
    pool = dopts(good, key)
    stem = f"A particle moves along the $x$-axis with velocity $v(t)={a}\\cos t-{b:g}t$ for $0\\le t\\le 6$, where $t$ is in seconds. At what time $t$ does the particle first change direction?"
    k = Opt(dec(key), True, f"The particle changes direction when $v(t)=0$ and $v$ changes sign. Since $v(0)={a}>0$, solve ${a}\\cos t-{b:g}t=0$ with a calculator; the first root is $t={key:.3f}$, where $v$ changes from positive to negative.", key)
    bpr = _nbp("c_motion_first_reversal_calc", "4.2", "1.E", "Find the first time a particle changes direction by solving v(t) = 0 numerically",
               ["Recognize that a change of direction needs v = 0 with a sign change", "Solve the transcendental equation with a calculator", "Choose the first positive root"],
               [("v is continuous and changes sign at its first positive root", "v(0) > 0 and v decreases through zero")],
               [("acceleration_zero", "solves v' = 0"), ("drops_t", "drops the factor t"), ("cosine_only", "sets cos t = 0"), ("cos_as_one", "replaces cos t by 1")],
               "bisection (separate implementation) on v and a sign check on both sides of the root (independent of Brent's method)")
    return pack("c_motion_first_reversal_calc", "4.2", "1.E", "required", stem, k, pool, rng, est=90, facts=[f"a={a}", f"b={b}", f"root={key:.6f}"], extra={"blueprint": bpr})


# 4.2 처음 정지할 때의 가속도
def c_accel_at_rest_calc(rng):
    k = rng.choice([3, 4, 5])
    x_ = lambda t_: t_ * t_ - k * math.sin(t_)
    v = lambda t_: 2 * t_ - k * math.cos(t_)
    key_t = _first_root(v, 0.001, 4.0)
    if key_t is None:
        raise ValueError("no_root")
    acc = lambda t_: 2 + k * math.sin(t_)
    key = acc(key_t)
    hh = 1e-4  # 독립 경로: 위치의 이차 중심차분
    if abs((x_(key_t + hh) + x_(key_t - hh) - 2 * x_(key_t)) / hh ** 2 - key) > 1e-4:
        raise ValueError("independent_check_failed")
    ds = [(f"Reports the time $t={key_t:.3f}$ at which the particle is at rest instead of its acceleration.", key_t), (f"Reports the position $x({key_t:.3f})$ at that time instead of the acceleration.", x_(key_t)),
          (f"Differentiates $-{k}\\sin t$ with the wrong sign, giving $2-{k}\\sin t$.", 2 - k * math.sin(key_t)), (f"Differentiates $-{k}\\sin t$ twice as $+{k}\\cos t$, giving $2+{k}\\cos t$.", 2 + k * math.cos(key_t))]
    pool = dopts(ds, key)
    stem = f"A particle moves along the $x$-axis so that its position at time $t\\ge 0$ is $x(t)=t^{{2}}-{k}\\sin t$. At the first time $t>0$ that the particle is at rest, what is the acceleration of the particle?"
    kk = Opt(dec(key), True, f"$v(t)=x'(t)=2t-{k}\\cos t$ and $a(t)=v'(t)=2+{k}\\sin t$. The particle is at rest when $v(t)=0$; the first positive solution is $t={key_t:.3f}$ (calculator), so $a({key_t:.3f})={key:.3f}$.", key)
    bpr = _nbp("c_accel_at_rest_calc", "4.2", "1.E", "Find the acceleration at the first time a particle is at rest, solving v(t) = 0 numerically",
               ["Differentiate the position to get velocity and again to get acceleration", "Solve v(t) = 0 with a calculator for the first positive time", "Evaluate the acceleration at that time"],
               [("the particle is at rest exactly when v(t) = 0", "v is continuous and has a first positive zero")],
               [("time_not_acceleration", "reports the time"), ("position_not_acceleration", "reports the position"), ("sign_error", "wrong sign in the second derivative"), ("cos_for_sin", "uses cosine in the second derivative")],
               "second central difference (step 1e-4) of the position at the root (independent of the symbolic derivatives)")
    return pack("c_accel_at_rest_calc", "4.2", "1.E", "required", stem, kk, pool, rng, est=95, facts=[f"k={k}", f"t={key_t:.6f}", f"key={key:.6f}"], extra={"blueprint": bpr})


# 4.3 맥락에서의 변화율: 식어 가는 커피
def c_temperature_rate_calc(rng):
    Ta, d, k, t0 = rng.choice([20, 22, 25]), rng.choice([60, 65, 70]), rng.choice([0.06, 0.08, 0.1]), rng.choice([5, 8, 10])
    T = lambda t_: Ta + d * math.exp(-k * t_)
    key = -k * d * math.exp(-k * t0)
    hh = 1e-6
    if abs((T(t0 + hh) - T(t0 - hh)) / (2 * hh) - key) > 1e-5:
        raise ValueError("independent_check_failed")
    ds = [(f"Reports the temperature $T({t0})={T(t0):.3f}$ instead of its rate of change.", T(t0)), (f"Uses the rate at $t=0$, $T'(0)=-{k:g}({d})$.", -k * d),
          (f"Uses the average rate of change over $[0,{t0}]$, $\\dfrac{{T({t0})-T(0)}}{{{t0}}}$.", (T(t0) - T(0)) / t0), (f"Leaves out the factor $-{k:g}$ from the chain rule, giving ${d}e^{{-{k:g}({t0})}}$.", d * math.exp(-k * t0))]
    pool = dopts(ds, key)
    stem = f"The temperature of a cup of coffee, in degrees Celsius, at time $t$ minutes is modeled by $T(t)={Ta}+{d}e^{{-{k:g}t}}$. At what rate, in degrees Celsius per minute, is the temperature changing at time $t={t0}$?"
    kk = Opt(dec(key), True, f"$T'(t)=-{k:g}\\cdot {d}e^{{-{k:g}t}}$, so $T'({t0})=-{k:g}({d})e^{{-{k * t0:g}}}={key:.3f}$ degrees Celsius per minute; the negative sign means the temperature is decreasing.", key)
    bpr = _nbp("c_temperature_rate_calc", "4.3", "1.E", "Find the instantaneous rate of change of a cooling model at a given time",
               ["Differentiate the exponential model with the chain rule", "Substitute the time and evaluate with a calculator", "Report the rate with its sign"],
               [("the instantaneous rate of change is the derivative", "T is differentiable for all t")],
               [("value_not_rate", "reports T(t0)"), ("initial_rate", "uses the rate at t = 0"), ("average_rate", "uses the average rate of change"), ("no_inner_derivative", "omits the factor from the chain rule")],
               "central difference (step 1e-6) of T (independent of the chain rule)")
    return pack("c_temperature_rate_calc", "4.3", "1.E", "required", stem, kk, pool, rng, est=80, facts=[f"Ta={Ta}", f"d={d}", f"k={k}", f"t0={t0}", f"key={key:.6f}"], extra={"blueprint": bpr})


_FLIN = [(sp.log(x) + sp.sqrt(x), "\\ln x+\\sqrt{x}", [4, 9]), (x * sp.log(x), "x\\ln x", [2, 3]), (sp.sqrt(x) * sp.log(x), "\\sqrt{x}\\,\\ln x", [2, 4]), (sp.exp(x) / x, "\\dfrac{e^{x}}{x}", [2, 3])]


# 4.6 접선 근사의 오차 크기
def c_linearization_error_calc(rng):
    for _ in forever():
        fexpr, ftex, acs = rng.choice(_FLIN)
        a, dx = rng.choice(acs), rng.choice([0.2, 0.3, 0.5])
        ff = sp.lambdify(x, fexpr, "math")
        fp = sp.lambdify(x, sp.diff(fexpr, x), "math")
        L = ff(a) + fp(a) * dx
        true = ff(a + dx)
        err = abs(true - L)
        if err > 5e-3:
            break
    hi_ = float(sp.N(fexpr.subs(x, sp.Rational(str(a + dx))), 30))  # 독립 경로: 고정밀 sympy 값
    if abs(hi_ - true) > 1e-10:
        raise ValueError("independent_check_failed")
    ds = [(f"Reports the tangent line approximation itself, ${L:.3f}$, instead of its error.", L), (f"Reports the actual value $f({a + dx:g})={true:.3f}$ instead of the error.", true),
          (f"Reports the actual change $f({a + dx:g})-f({a})$ instead of the error.", true - ff(a)), (f"Reports the approximate change $f'({a})({dx:g})$ instead of the error.", fp(a) * dx)]
    pool = dopts(ds, err)
    stem = f"Let $f(x)={ftex}$. The line tangent to the graph of $f$ at $x={a}$ is used to approximate $f({a + dx:g})$. What is the absolute value of the difference between the approximation and the actual value of $f({a + dx:g})$?"
    kk = Opt(dec(err), True, f"The tangent line gives $f({a})+f'({a})({dx:g})={L:.3f}$, and with a calculator $f({a + dx:g})={true:.3f}$. The absolute difference is $|{true:.3f}-{L:.3f}|={err:.3f}$.", err)
    bpr = _nbp("c_linearization_error_calc", "4.6", "1.F", "Find the size of the error of a tangent line approximation using a calculator",
               ["Compute the tangent line approximation f(a) + f'(a) dx", "Evaluate the actual value with a calculator", "Take the absolute value of the difference"],
               [("the tangent line approximation differs from the actual value by the error to be found", "f is differentiable at a")],
               [("approximation_only", "reports the approximation"), ("actual_only", "reports the actual value"), ("actual_change", "reports f(a+dx) - f(a)"), ("approximate_change", "reports f'(a) dx")],
               "actual value recomputed with 30-digit sympy evaluation and compared with the floating-point value (independent of the tangent line formula)")
    return pack("c_linearization_error_calc", "4.6", "1.F", "required", stem, kk, pool, rng, est=95, facts=[f"f={fexpr}", f"a={a}", f"dx={dx}", f"err={err:.6f}"], extra={"blueprint": bpr})


# 4.5 관련 변화율: 반지름이 늘고 높이가 줄어드는 원기둥의 부피
def c_related_rates_cylinder_calc(rng):
    R, H, rr, hr = rng.choice([3, 4, 5]), rng.choice([8, 10, 12]), rng.choice([0.4, 0.5, 0.6]), rng.choice([0.3, 0.5, 0.8])
    key = math.pi * (2 * R * H * rr - R * R * hr)
    Vt = lambda t_: math.pi * (R + rr * t_) ** 2 * (H - hr * t_)
    hh = 1e-6
    if abs((Vt(hh) - Vt(-hh)) / (2 * hh) - key) > 1e-4:
        raise ValueError("independent_check_failed")
    ds = [(f"Leaves out the term from the changing height, giving $2\\pi rh\\,\\dfrac{{dr}}{{dt}}=2\\pi({R})({H})({rr:g})$.", math.pi * 2 * R * H * rr), (f"Leaves out the term from the changing radius, giving $\\pi r^{{2}}\\dfrac{{dh}}{{dt}}=\\pi({R})^{{2}}(-{hr:g})$.", -math.pi * R * R * hr),
          (f"Treats the height as increasing at ${hr:g}$ centimeters per second, adding $\\pi r^{{2}}({hr:g})$ instead of subtracting.", math.pi * (2 * R * H * rr + R * R * hr)),
          (f"Differentiates $r^{{2}}$ as $r$ instead of $2r$, giving $\\pi\\left(rh\\,\\dfrac{{dr}}{{dt}}+r^{{2}}\\dfrac{{dh}}{{dt}}\\right)$.", math.pi * (R * H * rr - R * R * hr))]
    pool = dopts(ds, key)
    stem = f"The radius $r$ of a right circular cylinder is increasing at a rate of ${rr:g}$ centimeter per second, and its height $h$ is decreasing at a rate of ${hr:g}$ centimeter per second. At the instant when $r={R}$ centimeters and $h={H}$ centimeters, at what rate, in cubic centimeters per second, is the volume of the cylinder changing?"
    kk = Opt(dec(key), True, f"$V=\\pi r^{{2}}h$, so $\\dfrac{{dV}}{{dt}}=\\pi\\left(2rh\\,\\dfrac{{dr}}{{dt}}+r^{{2}}\\dfrac{{dh}}{{dt}}\\right)=\\pi\\left(2({R})({H})({rr:g})+({R})^{{2}}(-{hr:g})\\right)={key:.3f}$ cubic centimeters per second.", key)
    bpr = _nbp("c_related_rates_cylinder_calc", "4.5", "1.E", "Solve a related rates problem for the volume of a cylinder whose radius and height both change",
               ["Write V = pi r^2 h and differentiate with respect to time using the product and chain rules", "Substitute the given radius, height and rates, with the height rate negative", "Evaluate with a calculator"],
               [("both r and h are functions of time, so both terms of the product rule appear", "the problem gives both rates")],
               [("height_term_missing", "omits the term from the changing height"), ("radius_term_missing", "omits the term from the changing radius"), ("sign_of_height_rate", "treats the decreasing height as increasing"), ("power_rule_slip", "differentiates r squared as r")],
               "central difference (step 1e-6) of V(t) with r(t) and h(t) linear in t (independent of implicit differentiation)")
    return pack("c_related_rates_cylinder_calc", "4.5", "1.E", "required", stem, kk, pool, rng, est=100, facts=[f"R={R}", f"H={H}", f"rr={rr}", f"hr={hr}", f"key={key:.6f}"], extra={"blueprint": bpr})


# 4.5 관련 변화율: 가로등과 그림자 끝(닮은 삼각형)
def c_related_rates_shadow_calc(rng):
    Hl, h, v = rng.choice([5.5, 6.3, 7.2]), rng.choice([1.6, 1.7, 1.8]), rng.choice([1.2, 1.4, 1.6])
    key = v * Hl / (Hl - h)
    tip = lambda t_: (v * t_) * Hl / (Hl - h)  # 독립 경로: 머리 꼭대기를 지나는 직선이 지면과 만나는 점의 이동
    xs0 = 3.0
    tipn = lambda xx: Hl * xx / (Hl - h)
    if abs((tipn(xs0 + 1e-6) - tipn(xs0 - 1e-6)) / 2e-6 * v - key) > 1e-6:
        raise ValueError("independent_check_failed")
    ds = [(f"Finds how fast the length of the shadow changes, $\\dfrac{{{h:g}\\,({v:g})}}{{{Hl:g}-{h:g}}}$, instead of the tip of the shadow.", v * h / (Hl - h)), (f"Uses the walking speed ${v:g}$ for the tip of the shadow.", v),
          (f"Inverts the ratio of similar triangles, using $\\dfrac{{{Hl:g}}}{{{h:g}}}({v:g})$.", v * Hl / h), (f"Uses $\\dfrac{{{Hl:g}-{h:g}}}{{{Hl:g}}}({v:g})$, the reciprocal of the correct ratio.", v * (Hl - h) / Hl)]
    pool = dopts(ds, key)
    stem = f"A lamp is ${Hl:g}$ meters above the ground. A person ${h:g}$ meters tall walks directly away from the base of the lamp at a constant speed of ${v:g}$ meters per second. At what rate, in meters per second, is the tip of the person's shadow moving along the ground?"
    kk = Opt(dec(key), True, f"If the person is $x$ meters from the base and the tip of the shadow is $s$ meters from the base, similar triangles give $\\dfrac{{s}}{{{Hl:g}}}=\\dfrac{{s-x}}{{{h:g}}}$, so $s=\\dfrac{{{Hl:g}}}{{{Hl:g}-{h:g}}}x$. Then $\\dfrac{{ds}}{{dt}}=\\dfrac{{{Hl:g}}}{{{Hl - h:.1f}}}({v:g})={key:.3f}$ meters per second.", key)
    bpr = _nbp("c_related_rates_shadow_calc", "4.5", "1.D", "Solve a related rates problem with similar triangles for the tip of a shadow",
               ["Draw similar triangles using the lamp and the person", "Relate the position of the shadow tip to the position of the person", "Differentiate with respect to time and evaluate with a calculator"],
               [("the two triangles are similar because both have a right angle at the ground and share the angle at the tip of the shadow", "lamp and person are both vertical")],
               [("shadow_length_only", "finds the rate of the length of the shadow"), ("walking_speed", "uses the walking speed"), ("inverted_ratio", "inverts the ratio"), ("reciprocal_ratio", "uses the reciprocal factor")],
               "the ground intercept of the line from the lamp top through the head, differentiated numerically with respect to the person's position (independent of the proportion for s)")
    return pack("c_related_rates_shadow_calc", "4.5", "1.D", "required", stem, kk, pool, rng, est=95, facts=[f"Hl={Hl}", f"h={h}", f"v={v}", f"key={key:.6f}"], extra={"blueprint": bpr})


# 4.3 한계비용의 의미(맥락 해석)
def c_marginal_cost_meaning_calc(rng):
    b, c, q0 = rng.choice([1500, 2000, 2500]), rng.choice([20, 30, 40]), rng.choice([40, 50, 60, 80])
    C = lambda q_: b + c * q_ * math.log(q_ + 1)
    K = c * math.log(q0 + 1) + c * q0 / (q0 + 1)
    M = C(q0) / q0
    hh = 1e-5
    if abs((C(q0 + hh) - C(q0 - hh)) / (2 * hh) - K) > 1e-5 or abs(K - M) < 0.05:
        raise ValueError("independent_check_failed")
    one_more = f"the approximate cost, in dollars, of producing one more item after ${q0}$ items have been produced."
    key = Opt(f"$C'({q0})\\approx {K:.2f}$; {one_more}", True, f"$C'({q0})=c\\ln({q0}+1)+\\dfrac{{c\\,{q0}}}{{{q0}+1}}={K:.2f}$ with $c={c}$. The derivative is the rate at which total cost changes with the number of items, in dollars per item, so it approximates the cost of one more item.", None)
    ds = [Opt(f"$C'({q0})\\approx {K:.2f}$; the average cost, in dollars, per item of the first ${q0}$ items.", False, f"The value of $C'({q0})$ is right, but the average cost per item is $C({q0})/{q0}={M:.2f}$; $C'$ is a rate of change, not an average.", None),
          Opt(f"$C'({q0})\\approx {M:.2f}$; {one_more}", False, f"${M:.2f}$ is the average cost per item $C({q0})/{q0}$, not $C'({q0})={K:.2f}$.", None),
          Opt(f"$C'({q0})\\approx {K:.2f}$; the total cost, in dollars, of producing ${q0}$ items.", False, f"The value of $C'({q0})$ is right, but the total cost is $C({q0})={C(q0):.2f}$ dollars; $C'$ has units of dollars per item.", None)]
    stem = f"A company's total cost, in dollars, of producing $q$ items is $C(q)={b}+{c}q\\ln(q+1)$. Which of the following is the best interpretation of $C'({q0})$?"
    bpr = _nbp("c_marginal_cost_meaning_calc", "4.3", "3.F", "Interpret the derivative of a cost function in context with its value and units",
               ["Compute the derivative with the product rule and evaluate it with a calculator", "Recognize that the derivative is the rate of change of total cost with units dollars per item", "Choose the statement whose value and meaning both match"],
               [("C' gives the instantaneous rate of change of total cost per item produced", "C is differentiable for q > 0")],
               [("average_cost_meaning", "right value, average cost meaning"), ("average_cost_value", "average cost value with marginal meaning"), ("total_cost_meaning", "right value, total cost meaning")],
               "central difference (step 1e-5) of C and the average cost C(q0)/q0 computed separately (independent of the product rule)")
    return pack("c_marginal_cost_meaning_calc", "4.3", "3.F", "required", stem, key, ds, rng, est=100, facts=[f"b={b}", f"c={c}", f"q0={q0}", f"K={K:.6f}", f"M={M:.6f}"], extra={"blueprint": bpr})


# 4.3 수위 모델: h(t) = k 가 되는 시각에서의 수위 변화율(두 단계: 방정식 풀이 후 미분)
def c_water_depth_rate_calc(rng):
    a, b, lvl = rng.choice([2, 3]), rng.choice([1, 2]), rng.choice([5, 6, 8])
    h = lambda t_: a * math.sqrt(t_) + b * math.log(t_ + 1)
    hp = lambda t_: a / (2 * math.sqrt(t_)) + b / (t_ + 1)
    ts = _first_root(lambda t_: h(t_) - lvl, 0.0001, 30.0)
    if ts is None or ts < 0.5:
        raise ValueError("no_root")
    key = hp(ts)
    tb = _bis(lambda t_: h(t_) - lvl, 0.0001, 30.0)
    hh = 1e-6
    if abs(tb - ts) > 1e-6 or abs((h(ts + hh) - h(ts - hh)) / (2 * hh) - key) > 1e-5:
        raise ValueError("independent_check_failed")
    ds = [(f"Reports the time $t={ts:.3f}$ at which the depth is ${lvl}$ instead of the rate.", ts), (f"Evaluates $h'$ at $t={lvl}$, using the depth as if it were the time.", hp(lvl)),
          (f"Reports the average rate of change $\\dfrac{{h(t)-h(0)}}{{t}}={lvl}/{ts:.3f}$ over $[0,{ts:.3f}]$.", lvl / ts), (f"Differentiates only the square root term, giving $\\dfrac{{{a}}}{{2\\sqrt{{t}}}}$ at $t={ts:.3f}$.", a / (2 * math.sqrt(ts)))]
    pool = dopts(ds, key)
    stem = f"The depth of water in a reservoir, in meters, is modeled by $h(t)={a}\\sqrt{{t}}+{b}\\ln(t+1)$, where $t$ is the time in days and $t\\ge 0$. At the time when the depth first reaches ${lvl}$ meters, at what rate, in meters per day, is the depth increasing?"
    kk = Opt(dec(key), True, f"Solve ${a}\\sqrt{{t}}+{b}\\ln(t+1)={lvl}$ with a calculator to get $t={ts:.3f}$. Then $h'(t)=\\dfrac{{{a}}}{{2\\sqrt{{t}}}}+\\dfrac{{{b}}}{{t+1}}$, so $h'({ts:.3f})={key:.3f}$ meters per day.", key)
    bpr = _nbp("c_water_depth_rate_calc", "4.3", "1.E", "Find the rate of change of a modeled depth at the time the depth reaches a given level",
               ["Solve h(t) = level numerically for the time", "Differentiate h", "Evaluate h' at that time with a calculator"],
               [("h is increasing, so h(t) = level has exactly one solution", "h' > 0 for t > 0")],
               [("time_not_rate", "reports the time"), ("depth_as_time", "evaluates h' at t = depth"), ("average_rate", "reports the average rate"), ("partial_derivative", "differentiates only one term")],
               "bisection (separate implementation) for the time and a central difference for the rate (independent of Brent's method and the symbolic derivative)")
    return pack("c_water_depth_rate_calc", "4.3", "1.E", "required", stem, kk, pool, rng, est=105, facts=[f"a={a}", f"b={b}", f"lvl={lvl}", f"t={ts:.6f}", f"key={key:.6f}"], extra={"blueprint": bpr})
