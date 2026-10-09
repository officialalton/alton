"""BC 전용 FRQ 문항군(계산기, Part A 후보): 극좌표 곡선의 넓이·r'(θ) 의미·dy/dx·곡선 길이(9.7~9.9, BC 전용 단원 9). 값은 sympy/수치 적분으로 계산하고 독립 경로(심프슨·중심차분)로 확인한다."""
from common import *
from bp import frq_blueprint
from calc_ab_frq import row, part
from scipy import integrate as _I

SUB = "ap_calculus_bc"
th = sp.Symbol("theta")


def frq_polar_region(rng):
    a, b = rng.choice([2, 3]), rng.choice([1, 2])
    r = a + b * sp.cos(th)
    rp = sp.diff(r, th)
    rf, rpf = sp.lambdify(th, r, "math"), sp.lambdify(th, rp, "math")
    area = float(_I.quad(lambda u: 0.5 * rf(u) ** 2, 0, math.pi / 2)[0])
    area_closed = float(sp.N(sp.integrate(sp.Rational(1, 2) * r ** 2, (th, 0, sp.pi / 2))))
    if abs(area - area_closed) > 1e-9 or abs(numeric_integral(lambda u: 0.5 * rf(u) ** 2, 0, math.pi / 2, 20001) - area) > 1e-6:
        raise ValueError("independent_check_failed")
    t0 = sp.pi / 3
    rprime0 = float(rp.subs(th, t0))
    xdot = lambda u: rpf(u) * math.cos(u) - rf(u) * math.sin(u)
    ydot = lambda u: rpf(u) * math.sin(u) + rf(u) * math.cos(u)
    slope = ydot(math.pi / 3) / xdot(math.pi / 3)
    hh = 1e-6
    xf = lambda u: rf(u) * math.cos(u)
    yf = lambda u: rf(u) * math.sin(u)
    num_slope = ((yf(math.pi / 3 + hh) - yf(math.pi / 3 - hh)) / (xf(math.pi / 3 + hh) - xf(math.pi / 3 - hh)))
    if abs(num_slope - slope) > 1e-5:
        raise ValueError("independent_check_failed")
    L = float(_I.quad(lambda u: math.sqrt(rf(u) ** 2 + rpf(u) ** 2), 0, math.pi / 2)[0])
    Ls = numeric_integral(lambda u: math.sqrt(rf(u) ** 2 + rpf(u) ** 2), 0, math.pi / 2, 20001)
    if abs(L - Ls) > 1e-6:
        raise ValueError("independent_check_failed")
    f3 = lambda v: "%.3f" % v
    stim = {"kind": "text", "description": "Polar curve", "data": {"curve": f"r = {a} + {b} cos(theta), 0 <= theta <= pi/2"}}
    rtxt = f"r={a}+{b}\\cos\\theta"
    parts = [
        part("a", f"Let $R$ be the region in the first quadrant bounded by the polar curve ${rtxt}$ for $0\\le\\theta\\le\\frac{{\\pi}}{{2}}$ and the coordinate axes. Write an integral expression for the area of $R$ and find the area of $R$.", 3, "calculate", ["1.D", "1.E"],
             f"Area = (1/2) ∫_0^(π/2) ({a} + {b} cos θ)^2 dθ = {f3(area)}.", [
            row("a1", 1, "Area integrand (1/2) r^2 (setup)", [f"(1/2)({a}+{b}cos θ)^2"]), row("a2", 1, "Limits of integration 0 and π/2 (setup)", ["0 to π/2"], requires="a1"), row("a3", 1, "Answer (value)", [f3(area)], requires="a2", nums=True, tol="±0.001")]),
        part("b", f"Find $\\dfrac{{dr}}{{d\\theta}}$ at $\\theta=\\frac{{\\pi}}{{3}}$. Using correct units, interpret the meaning of your answer in the context of the distance from the origin to the point on the curve.", 2, "explain", ["1.E", "3.F"],
             f"dr/dθ = -{b} sin θ = {f3(rprime0)} at θ = π/3: the distance from the origin to the point is decreasing at {f3(abs(rprime0))} units per radian.", [
            row("b1", 1, "Value of dr/dθ at π/3 (value)", [f3(rprime0)], nums=True, tol="±0.001"), row("b2", 1, "Interpretation: the distance from the origin is decreasing, at that rate per radian (meaning)", ["distance from the origin", "decreasing"], both=True, requires="b1")]),
        part("c", "Find the slope of the line tangent to the curve at $\\theta=\\frac{\\pi}{3}$.", 2, "calculate", ["1.E"],
             f"dy/dx = (r' sin θ + r cos θ)/(r' cos θ - r sin θ) = {f3(slope)} at θ = π/3.", [
            row("c1", 1, "Uses dy/dx = (dy/dθ)/(dx/dθ) with x = r cos θ and y = r sin θ (setup)", ["dy/dθ over dx/dθ"]), row("c2", 1, "Answer (slope value)", [f3(slope)], requires="c1", nums=True, tol="±0.001")]),
        part("d", f"Find the length of the curve ${rtxt}$ for $0\\le\\theta\\le\\frac{{\\pi}}{{2}}$.", 2, "calculate", ["1.E"],
             f"Length = ∫_0^(π/2) sqrt(r^2 + (dr/dθ)^2) dθ = {f3(L)}.", [
            row("d1", 1, "Arc length integral with integrand sqrt(r^2 + (dr/dθ)^2) (setup)", ["∫ sqrt(r^2+(dr/dθ)^2) dθ from 0 to π/2"]), row("d2", 1, "Answer (value)", [f3(L)], requires="d1", nums=True, tol="±0.001")])]
    for p_, tc in zip(parts, [["9.8"], ["9.7", "4.1"], ["9.7"], ["9.9"]]):
        p_["topic_codes"] = tc
    pk = {"archetype": "frq_polar_region", "template": "polar_region_calc", "topic": "9.8", "extra_topics": ["9.7", "9.9"], "skill": "1.E", "representative_skill": "1.E", "calculator": "required", "title": "A polar curve: area, rate of change of distance, slope, and length",
          "stimulus": stim, "parts": parts, "total_points": 9, "est_minutes": 15, "facts": [f"a={a}", f"b={b}", f"area={area:.6f}", f"rprime={rprime0:.6f}", f"slope={slope:.6f}", f"L={L:.6f}"]}
    pk["blueprint"] = frq_blueprint("frq_polar_region", SUB, pk, "Use polar area, the derivative of r, the polar tangent slope and polar arc length for a first-quadrant limacon arc",
        ["Set up (1/2) r^2 and integrate over the given angles", "Differentiate r and interpret it as the rate of change of the distance from the origin", "Compute dy/dx from x = r cos theta and y = r sin theta", "Set up and evaluate the arc length integral numerically"],
        [("r is positive and differentiable on [0, pi/2], so the polar area and length formulas apply", "a + b cos theta >= a - 0 > 0 on the interval")], {"type": "text", "must_include": ["polar equation", "interval of theta"]},
        "area by closed-form sympy integration and Simpson rule; slope by central difference of x(theta), y(theta); length by Simpson rule (independent of scipy quad)")
    return pk
