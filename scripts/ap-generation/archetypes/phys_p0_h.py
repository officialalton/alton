"""AP Physics 1 원형 H — 스킬 범위 보강 2차(2026-10-13, phys-s3): 2.A 기호식 3개 + 2.C 순위 2개 + 2.D 예측 3개 + 3.C 자료 근거 2개(= 10개).
phys_p0_f/g 와 같은 규칙: 정답은 코드가 이중 경로로 계산, 오답은 이름 붙은 오개념, 선택지 8% 이상 간격, 정답 해설에 풀이 과정.
이 보강은 단원·스킬 칸이 얇은 곳(2.A 단원 3·4·6, 2.D 단원 1·4·6, 3.C 단원 1·3, 2.C 단원 2·3)을 채우고, 같은 문항군이 한 모의고사에 둘 들어가지 못하는 제약 때문에 원형 수 자체를 늘린다."""
import json
from phys_common import *
from common import table_stimulus
from phys_sym import tex_eval, sym_opts, rank_opts
from phys_p0_f import _a2, _c2, _rank_loop, LBL
from phys_p0_g import _d2, _fx

GM_EARTH = 3.986e14


# ======================= 2.A 기호식 =======================
@retry_sep
def ph_sym_orbit(rng):
    variant = rng.randrange(2)
    GMv, r = pick(rng, [(3.986e14, 7.0e6), (3.986e14, 1.0e7), (3.986e14, 2.0e7), (4.28e13, 5.0e6), (4.28e13, 1.0e7), (1.267e17, 2.0e8)])
    Gv = 6.674e-11; M = GMv / Gv
    env = {"G": Gv, "Mp": M, "ms": 500.0, "r": r}
    v = math.sqrt(GMv / r); T = 2 * math.pi * math.sqrt(r ** 3 / GMv)
    # 수치 경로: 중심력만 있는 2차원 운동을 RK4 로 적분해 속력이 일정함을(변형 0) 또는 한 바퀴 도는 시간을(변형 1) 측정
    f = lambda t, s: np.array([s[2], s[3], -GMv * s[0] / (s[0] ** 2 + s[1] ** 2) ** 1.5, -GMv * s[1] / (s[0] ** 2 + s[1] ** 2) ** 1.5])  # noqa: E731
    n = 1500; y = np.array([r, 0.0, 0.0, v]); t = 0.0; hh = T / n; prev = 0.0; unwrapped = 0.0; t_orb = None; steps = n // 4 if variant == 0 else int(n * 1.05)
    for _ in range(steps):
        k1 = f(t, y); k2 = f(t, y + hh / 2 * k1); k3 = f(t, y + hh / 2 * k2); k4 = f(t, y + hh * k3); y = y + hh / 6 * (k1 + 2 * k2 + 2 * k3 + k4); t += hh
        a = math.atan2(y[1], y[0]); d = a - prev
        d = d + 2 * math.pi if d < -math.pi else d - 2 * math.pi if d > math.pi else d
        unwrapped += d; prev = a
        if variant == 1 and unwrapped >= 2 * math.pi:
            t_orb = t - hh * (unwrapped - 2 * math.pi) / d; break
    sp_end = math.hypot(y[2], y[3])
    if variant == 0:
        agree(v, sp_end, 1e-6, "v"); sym_v = v
        key_tex = r"\sqrt{\frac{GM_p}{r}}"
        wrongs = [("Uses the mass of the satellite instead of the mass of the planet in the numerator.", r"\sqrt{\frac{Gm_s}{r}}"), ("Leaves out the square root, giving the quantity $v^2$.", r"\frac{GM_p}{r}"),
                  ("Squares the orbital radius under the root, as if the gravitational force were divided by $r$ instead of $r^2$ at the end.", r"\sqrt{\frac{GM_p}{r^2}}"), ("Gives the escape speed, which has an extra factor of 2 under the root.", r"\sqrt{\frac{2GM_p}{r}}")]
        stem = "A satellite of mass $m_s$ moves in a circular orbit of radius $r$ about the center of a planet of mass $M_p$. Which of the following is the orbital speed of the satellite?"
        why = r"Gravity provides the centripetal force: $\dfrac{GM_pm_s}{r^2}=\dfrac{m_sv^2}{r}$, so $v=\sqrt{GM_p/r}$."
    else:
        agree(T, t_orb, 1e-4, "T"); sym_v = T
        key_tex = r"2\pi\sqrt{\frac{r^3}{GM_p}}"
        wrongs = [("Cubes the radius in the wrong place, using $r^2$ in the numerator.", r"2\pi\sqrt{\frac{r^2}{GM_p}}"), ("Inverts the ratio under the root, so a larger orbit would have a shorter period.", r"2\pi\sqrt{\frac{GM_p}{r^3}}"),
                  (r"Leaves out the factor $2\pi$, which converts the angular frequency to a period.", r"\sqrt{\frac{r^3}{GM_p}}"), ("Uses the mass of the satellite in place of the mass of the planet.", r"2\pi\sqrt{\frac{r^3}{Gm_s}}")]
        stem = "A satellite of mass $m_s$ moves in a circular orbit of radius $r$ about the center of a planet of mass $M_p$. Which of the following is the period of the orbit?"
        why = r"With $v=\sqrt{GM_p/r}$ and $T=2\pi r/v$ the period is $T=2\pi\sqrt{r^3/(GM_p)}$."
    key, ds = sym_opts(key_tex, sym_v, wrongs, env)
    return _a2("ph_sym_orbit", "6.6", stem, key, ds, rng, kwhy=why, concept="Symbolic orbital speed or period of a satellite from Newton's law of gravitation and the centripetal condition", thinking=["Set the gravitational force equal to the centripetal force", "Solve for the speed, then use $T=2\\pi r/v$ if the period is asked"],
               cond=[("the orbit is circular and only the planet's gravity acts", "the stem states a circular orbit about the center of a planet")], path="sympy solves the force equation; an RK4 integration of the two-dimensional motion under the inverse-square force measures the speed or the time for one revolution, and the printed option is evaluated by a TeX evaluator",
               facts=[f"GM={GMv}", f"r={r}", f"variant={variant}"], est=75)


@retry_sep
def ph_sym_pendulum_bottom(rng):
    variant = rng.randrange(2)
    L = pick(rng, [0.8, 1.0, 1.5, 2.0]); th_d = pick(rng, [30, 40, 50, 60]); m = pick(rng, [0.5, 1.0, 2.0]); th0 = math.radians(th_d)
    env = {"g": G, "L": L, "theta": th0, "m": m}
    # 수치 경로: 비선형 진자 운동방정식 θ'' = -(g/L) sin θ 를 RK4 로 적분해 바닥(θ=0) 도달 시 각속도를 구한다
    f = lambda t, s: np.array([s[1], -(G / L) * math.sin(s[0])])  # noqa: E731
    y = np.array([th0, 0.0]); t = 0.0; hh = 1e-3; w = None
    for _ in range(5000):
        k1 = f(t, y); k2 = f(t, y + hh / 2 * k1); k3 = f(t, y + hh / 2 * k2); k4 = f(t, y + hh * k3); y2 = y + hh / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
        if y2[0] <= 0:
            fr = y[0] / (y[0] - y2[0]); w = y[1] + fr * (y2[1] - y[1]); break
        y = y2; t += hh
    if w is None:
        raise ValueError("no_bottom")
    vb = abs(w) * L
    if variant == 0:
        sym_v = math.sqrt(2 * G * L * (1 - math.cos(th0))); agree(sym_v, vb, 5e-4, "v")
        key_tex = r"\sqrt{2gL(1-\cos\theta)}"
        wrongs = [("Uses the length of the string as the drop in height, ignoring that the bob rises only $L(1-\\cos\\theta)$.", r"\sqrt{2gL}"), ("Takes the drop in height to be $L\\cos\\theta$ instead of $L(1-\\cos\\theta)$.", r"\sqrt{2gL\cos\theta}"),
                  ("Uses the sine instead of the cosine of the angle from the vertical.", r"\sqrt{2gL(1-\sin\theta)}"), ("Drops the factor 2 from the kinetic energy $\\tfrac12mv^2$.", r"\sqrt{gL(1-\cos\theta)}")]
        stem = r"A small bob of mass $m$ hangs from a light string of length $L$. The bob is pulled aside until the string makes an angle $\theta$ with the vertical and is released from rest. Air resistance is negligible. Which of the following is the speed of the bob at the lowest point of its swing?"
        why = r"The bob falls a height $L(1-\cos\theta)$, so $\tfrac12mv^2=mgL(1-\cos\theta)$ and $v=\sqrt{2gL(1-\cos\theta)}$."
    else:
        sym_v = m * G * (3 - 2 * math.cos(th0)); agree(m * G + m * vb ** 2 / L, sym_v, 1e-3, "T")
        key_tex = r"mg(3-2\cos\theta)"
        wrongs = [("Takes the tension to equal the weight, ignoring the centripetal force needed at the lowest point.", r"mg"), ("Gives only the centripetal part $mv^2/L$ and forgets to add the weight.", r"2mg(1-\cos\theta)"),
                  ("Uses the sine instead of the cosine of the angle from the vertical.", r"mg(3-2\sin\theta)"), ("Subtracts the centripetal part from the weight instead of adding it.", r"mg(2\cos\theta-1)")]
        stem = r"A small bob of mass $m$ hangs from a light string of length $L$. The bob is pulled aside until the string makes an angle $\theta$ with the vertical and is released from rest. Air resistance is negligible. Which of the following is the tension in the string when the bob passes through the lowest point?"
        why = r"At the lowest point $T-mg=mv^2/L$ with $v^2=2gL(1-\cos\theta)$, so $T=mg+2mg(1-\cos\theta)=mg(3-2\cos\theta)$."
    key, ds = sym_opts(key_tex, sym_v, wrongs, env)
    return _a2("ph_sym_pendulum_bottom", "3.4", stem, key, ds, rng, kwhy=why, concept="Symbolic speed or tension at the bottom of a pendulum swing from energy conservation and the centripetal condition", thinking=["Find the drop in height with the angle measured from the vertical, then use energy conservation for the speed", "Add the centripetal condition at the lowest point if the tension is asked"],
               cond=[("air resistance is negligible and the string is light", "the stem states negligible air resistance and a light string")], path="sympy solves the energy and force equations; an RK4 integration of the nonlinear pendulum equation of motion gives the speed at the lowest point (and the tension from it), and the printed option is evaluated by a TeX evaluator",
               facts=[f"L={L}", f"theta_deg={th_d}", f"m={m}", f"variant={variant}"], est=85)


@retry_sep
def ph_sym_bounce_force(rng):
    variant = rng.randrange(2)
    m = pick(rng, [0.2, 0.5, 1.0]); vi = pick(rng, [4.0, 6.0, 8.0]); vf = pick(rng, [2.0, 3.0, 5.0]); dt = pick(rng, [0.01, 0.02, 0.05])
    env = {"m": m, "vi": vi, "vf": vf, "Delta": 1.0, "t": dt}  # \Delta t 는 하나의 양이다: Delta=1 로 두고 t 에 시간 간격을 넣어 곱이 Δt 가 되게 한다
    # 수치 경로: 접촉 시간 동안의 반닫힌 사인 힘 펄스 F(t) 를 사다리꼴 적분해 충격량을 구하고 평균 힘 = 충격량/Δt
    ts = np.linspace(0.0, dt, 20001); Dp = m * (vi + vf) if variant == 0 else m * vi
    F0 = Dp * math.pi / (2 * dt); imp = float(np.trapezoid(F0 * np.sin(math.pi * ts / dt), ts)); sym_v = Dp / dt
    agree(imp / dt, sym_v, 1e-6, "F")
    if variant == 0:
        key_tex = r"\frac{m(v_i+v_f)}{\Delta t}"
        wrongs = [("Subtracts the speeds, forgetting that the velocity reverses so the change in velocity is the sum of the speeds.", r"\frac{m(v_i-v_f)}{\Delta t}"), ("Uses only the final momentum, ignoring the momentum before the collision.", r"\frac{mv_f}{\Delta t}"),
                  ("Multiplies by the contact time instead of dividing by it.", r"m(v_i+v_f)\Delta t"), ("Uses the average of the speeds before dividing, which does not give the change in momentum.", r"\frac{m(v_i+v_f)}{2\Delta t}")]
        stem = r"A ball of mass $m$ moving horizontally at speed $v_i$ strikes a wall and rebounds along the same line at speed $v_f$. The ball is in contact with the wall for a time $\Delta t$. Which of the following is the magnitude of the average force exerted by the wall on the ball?"
        why = r"The impulse equals the change in momentum, $F_{avg}\Delta t=m v_f-(-m v_i)=m(v_i+v_f)$, so $F_{avg}=\dfrac{m(v_i+v_f)}{\Delta t}$."
    else:
        key_tex = r"\frac{mv_i}{\Delta t}"
        wrongs = [("Divides by the contact time but includes a rebound speed that the ball does not have.", r"\frac{m(v_i+v_f)}{\Delta t}"), ("Multiplies the momentum by the contact time instead of dividing.", r"mv_i\Delta t"),
                  ("Uses the kinetic energy instead of the momentum.", r"\frac{mv_i^2}{2\Delta t}"), ("Divides by the square of the contact time.", r"\frac{mv_i}{\Delta t^2}")]
        stem = r"A ball of mass $m$ moving horizontally at speed $v_i$ strikes a wall and sticks to it, coming to rest. The ball is in contact with the wall for a time $\Delta t$ before stopping. Which of the following is the magnitude of the average force exerted by the wall on the ball?"
        why = r"The impulse equals the change in momentum, $F_{avg}\Delta t=0-(-mv_i)=mv_i$, so $F_{avg}=\dfrac{mv_i}{\Delta t}$."
    key, ds = sym_opts(key_tex, sym_v, wrongs, env)
    return _a2("ph_sym_bounce_force", "4.2", stem, key, ds, rng, kwhy=why, concept="Symbolic average force from the impulse-momentum theorem for a rebound or a stop", thinking=["Write the change in momentum with signs for the direction of the motion", "Divide the impulse by the contact time to get the average force"],
               cond=[("the force acts along the line of motion", "the stem states a head-on collision with a wall along a line")], path="a numeric integration of a force pulse over the contact time gives the impulse, whose ratio to the contact time is compared with the change in momentum divided by the time, and the printed option is evaluated by a TeX evaluator",
               facts=[f"m={m}", f"vi={vi}", f"vf={vf}", f"dt={dt}", f"variant={variant}"], est=75)


# ======================= 2.C 순위 =======================
def ph_rank_centripetal(rng):
    def make(r):
        qty = r.randrange(2)  # 0 구심 가속도, 1 구심력
        v = r.sample([2.0, 3.0, 4.0, 5.0, 6.0], 4); rr = r.sample([0.5, 1.0, 1.5, 2.0, 3.0, 4.0], 4); ms = r.sample([0.5, 1.0, 2.0, 3.0], 4)
        vals = {L: (v[i] ** 2 / rr[i]) * (1 if qty == 0 else ms[i]) for i, L in enumerate(LBL)}
        rules = [("Ranks by the speed alone, ignoring the radius.", {L: v[i] for i, L in enumerate(LBL)}), ("Ranks by the radius, as if a larger circle needs a larger centripetal acceleration.", {L: rr[i] for i, L in enumerate(LBL)}),
                 ("Ranks by the speed divided by the radius, which is the angular speed and not the centripetal acceleration.", {L: v[i] / rr[i] for i, L in enumerate(LBL)}), ("Ranks from least to greatest instead of from greatest to least.", {L: -vals[L] for L in LBL})]
        if qty == 1:
            rules.append(("Ranks by the acceleration $v^2/r$ alone, forgetting that the force also depends on the mass.", {L: v[i] ** 2 / rr[i] for i, L in enumerate(LBL)}))
        return (qty, v, rr, ms), vals, rules
    (qty, v, rr, ms), vals, key, ds, order, _ = _rank_loop(rng, make)
    ex = sorted(LBL, key=lambda L: -(Fr(str(v[LBL.index(L)])) ** 2 / Fr(str(rr[LBL.index(L)])) * (1 if qty == 0 else Fr(str(ms[LBL.index(L)]))))); assert ex == order, "rank_path_mismatch"
    desc = "; ".join(f"object {L}: mass ${ms[i]:g}\\text{{ kg}}$, speed ${v[i]:g}\\text{{ m/s}}$, radius ${rr[i]:g}\\text{{ m}}$" for i, L in enumerate(LBL))
    ask = "centripetal accelerations" if qty == 0 else "net forces on the objects"
    stem = f"Four objects move at constant speeds in horizontal circles: {desc}. Rank the magnitudes of the {ask} from greatest to least."
    st = ", ".join(f"{L}: {vals[L]:.2f}" for L in LBL)
    key.why = (f"The centripetal acceleration is $v^2/r$; in $\\text{{m/s}}^2$ the four values are {st}" if qty == 0 else f"The net force is $mv^2/r$; in newtons the four values are {st}") + f", which ranks as {key.text}."
    return _c2("ph_rank_centripetal", "2.9", stem, key, ds, rng, kwhy=None, concept="Ranking centripetal accelerations or forces from speed, radius and mass", thinking=["Compute $v^2/r$ (times the mass for the force) for each object", "Order the four values"], cond=[("each object moves in a circle at constant speed", "the stem states constant speeds in horizontal circles")],
               path="exact fractions of v squared over r (times mass) are sorted and compared with the floating-point ordering", facts=[f"qty={qty}", f"v={json.dumps(v)}", f"r={json.dumps(rr)}", f"m={json.dumps(ms)}", f"order={json.dumps(order)}"], est=85)


def ph_rank_work(rng):
    def make(r):
        Fv = r.sample([10, 12, 15, 20, 25, 30], 4); dd = r.sample([1.0, 1.5, 2.0, 3.0, 4.0], 4); th = r.sample([0, 30, 45, 60], 4)
        vals = {L: Fv[i] * dd[i] * math.cos(math.radians(th[i])) for i, L in enumerate(LBL)}
        rules = [("Ranks by the magnitude of the force alone.", {L: Fv[i] for i, L in enumerate(LBL)}), ("Ranks by the distance moved alone.", {L: dd[i] for i, L in enumerate(LBL)}),
                 ("Ranks by force times distance, ignoring the angle between the force and the displacement.", {L: Fv[i] * dd[i] for i, L in enumerate(LBL)}), ("Ranks using the sine instead of the cosine of the angle between the force and the displacement.", {L: Fv[i] * dd[i] * math.sin(math.radians(th[i])) + 1e-9 * i for i, L in enumerate(LBL)})]
        return (Fv, dd, th), vals, rules
    (Fv, dd, th), vals, key, ds, order, _ = _rank_loop(rng, make)
    wk = {L: float(np.dot([Fv[i] * math.cos(math.radians(th[i])), Fv[i] * math.sin(math.radians(th[i]))], [dd[i], 0.0])) for i, L in enumerate(LBL)}  # 독립 경로: 힘 벡터와 변위 벡터의 내적
    assert sorted(LBL, key=lambda L: -wk[L]) == order, "rank_path_mismatch"
    desc = "; ".join(f"{L}: ${Fv[i]:g}\\text{{ N}}$ force, ${dd[i]:g}\\text{{ m}}$ displacement, ${th[i]}^\\circ$ between them" for i, L in enumerate(LBL))
    stem = f"A constant force acts on a block while the block is displaced along a straight line in four different situations. {desc}. Rank the work done by the force from greatest to least."
    st = ", ".join(f"{L}: {vals[L]:.1f}" for L in LBL)
    key.why = f"The work is $W=Fd\\cos\\theta$; in joules the four values are {st}, which ranks as {key.text}."
    return _c2("ph_rank_work", "3.2", stem, key, ds, rng, kwhy=None, concept="Ranking the work done by constant forces from magnitude, displacement and angle", thinking=["Compute $Fd\\cos\\theta$ for each situation", "Order the four values"], cond=[("each force is constant", "the stem states a constant force and a straight-line displacement")],
               path="the dot product of the force and displacement vectors is sorted and compared with the cosine formula ordering", facts=[f"F={json.dumps(Fv)}", f"d={json.dumps(dd)}", f"theta={json.dumps(th)}", f"order={json.dumps(order)}"], est=85)


# ======================= 2.D 예측 =======================
@retry_sep
def ph_pred_orbit(rng):
    variant = rng.randrange(2); a = pick(rng, [2, 4, 9])
    r0 = 7.0e6; GMv = GM_EARTH
    v0 = math.sqrt(GMv / r0); v1 = math.sqrt(GMv / (a * r0)); T0 = 2 * math.pi * r0 / v0; T1 = 2 * math.pi * (a * r0) / v1  # 독립 경로: 속력과 둘레로 주기를 구해 비를 직접 계산
    if variant == 0:
        val = 1 / math.sqrt(a); agree(v1 / v0, val, 1e-9, "ratio")
        pairs = [("Takes the speed to be inversely proportional to the radius.", 1 / a), ("Takes the speed to increase with the radius, as if a larger orbit needed a higher speed.", math.sqrt(a)), ("Takes the speed to be proportional to the radius.", a), ("Takes the speed to be inversely proportional to the square of the radius.", 1 / (a * a))]
        stem = f"A satellite orbits a planet in a circular orbit of radius $r$ with orbital speed $v$. The satellite is moved to a circular orbit of radius ${a}r$ about the same planet. The orbital speed in the new orbit is how many times the original speed?"
        why = f"Gravity gives $v=\\sqrt{{GM/r}}$, so the speed varies as $1/\\sqrt{{r}}$; for a radius {a} times larger the speed is 1/$\\sqrt{{{a}}}$ = {sig(val)} times the original."
    else:
        val = a ** 1.5; agree(T1 / T0, val, 1e-9, "ratio")
        pairs = [("Takes the period to be proportional to the radius.", a), ("Takes the period to be proportional to the square of the radius.", a * a), ("Takes the period to be proportional to the square root of the radius.", math.sqrt(a)), ("Takes the period to decrease with the radius, as if the satellite moved faster in a larger orbit.", 1 / a)]
        stem = f"A satellite orbits a planet in a circular orbit of radius $r$ with period $T$. The satellite is moved to a circular orbit of radius ${a}r$ about the same planet. The period in the new orbit is how many times the original period?"
        why = f"The period satisfies $T^2\\propto r^3$, so $T\\propto r^{{3/2}}$; for a radius {a} times larger the period is {a}$^{{3/2}}$ = {sig(val)} times the original."
    key, ds = num_opts(float(val), pairs, fmt=_fx)
    return _d2("ph_pred_orbit", "6.6", stem, key, ds, rng, kwhy=why, concept="Scaling of the orbital speed or period of a satellite with the orbital radius", thinking=["Write the speed or the period of a circular orbit with its dependence on the radius", "Substitute the larger radius and compare with the original"],
               cond=[("the orbits are circular around the same planet", "the stem states circular orbits about the same planet")], path="the speed from the centripetal condition and the period from the speed and the circumference are evaluated for both radii and their ratio is computed", facts=[f"a={a}", f"variant={variant}", f"val={val}"])


@retry_sep
def ph_pred_collision_speed(rng):
    b = pick(rng, [2, 3, 4, 5]); m = pick(rng, [1.0, 2.0, 3.0]); v = pick(rng, [2.0, 4.0, 6.0])
    # 독립 경로: 두 경우의 질량중심 속도를 각각 직접 구해 비를 계산(처음 표적 질량 = m, 나중 = b m)
    v_a = m * v / (m + m); v_b = m * v / (m + b * m); ratio = v_b / v_a; val = 2 / (1 + b); agree(ratio, val, 1e-9, "ratio")
    pairs = [("Takes the final speed to be inversely proportional to the mass of the target cart alone.", 1 / b), ("Compares the new final speed with the initial speed of the moving cart instead of with the original final speed.", 1 / (1 + b)),
             ("Takes the final speed to be inversely proportional to the square root of the target mass.", 1 / math.sqrt(b)), ("Takes the final speed to be unchanged because the momentum of the system is conserved.", 1.0)]
    key, ds = num_opts(float(val), pairs, fmt=_fx)
    stem = f"A cart of mass ${m:g}\\text{{ kg}}$ moving at ${v:g}\\text{{ m/s}}$ on a frictionless track collides with a stationary cart of mass ${m:g}\\text{{ kg}}$, and the carts stick together and move off at speed $v_f$. In a second trial the stationary cart has a mass of ${b * m:g}\\text{{ kg}}$ and the carts again stick together. The final speed in the second trial is how many times $v_f$?"
    why = f"Momentum conservation gives {m:g}({v:g}) = ({m:g} + {m:g})$v_f$, so $v_f$ = {v / 2:g} m/s in the first trial and {m * v:g}/({m:g} + {b * m:g}) = {sig(m * v / (m + b * m))} m/s in the second; the ratio is 2/(1 + {b}) = {sig(val)}."
    return _d2("ph_pred_collision_speed", "4.3", stem, key, ds, rng, kwhy=why, concept="Scaling of the final speed of a perfectly inelastic collision with the target mass", thinking=["Write the final speed of the combined carts from momentum conservation in each trial", "Divide the second final speed by the first"],
               cond=[("the carts stick together on a frictionless track", "the stem states a frictionless track and that the carts stick together")], path="the center-of-mass velocity of the system is computed for both trials and the ratio equals 2/(1+b)", facts=[f"b={b}", f"m={m}", f"v={v}", f"val={val}"], est=80)


@retry_sep
def ph_pred_projectile_scale(rng):
    variant = rng.randrange(3); a = pick(rng, [2, 3]); th = pick(rng, [30, 40, 50, 60]); v0 = pick(rng, [10.0, 15.0, 20.0])
    r = lambda s: s * s * math.sin(2 * math.radians(th)) / G  # noqa: E731
    h = lambda s: (s * math.sin(math.radians(th))) ** 2 / (2 * G)  # noqa: E731
    tf = lambda s: 2 * s * math.sin(math.radians(th)) / G  # noqa: E731
    # 독립 경로: 운동방정식을 작은 시간 간격으로 적분해 사거리·최고 높이·비행 시간을 구한다
    def sim(s):
        x = 0.0; y = 0.0; vx = s * math.cos(math.radians(th)); vy = s * math.sin(math.radians(th)); t = 0.0; dt = 5e-4; ym = 0.0
        while True:
            x += vx * dt; y += vy * dt; vy -= G * dt; t += dt; ym = max(ym, y)
            if y < 0:
                return x, ym, t
    s0 = sim(v0); s1 = sim(a * v0)
    if variant == 0:
        val = a * a; agree(s1[0] / s0[0], val, 2e-3, "ratio"); what = "horizontal range"
        pairs = [("Takes the range to be proportional to the launch speed.", a), ("Takes the range to be proportional to the cube of the launch speed.", a ** 3), ("Takes the range to be proportional to the square root of the launch speed.", math.sqrt(a)), ("Adds the speed factor to its square, mixing two different dependences.", a * a + a)]
    elif variant == 1:
        val = a * a; agree(s1[1] / s0[1], val, 2e-3, "ratio"); what = "maximum height"
        pairs = [("Takes the maximum height to be proportional to the launch speed.", a), ("Takes the maximum height to be proportional to the cube of the launch speed.", a ** 3), ("Takes the maximum height to be proportional to the square root of the launch speed.", math.sqrt(a)), ("Adds the factor to the original height instead of scaling it.", a * a + a)]
    else:
        val = a; agree(s1[2] / s0[2], val, 2e-3, "ratio"); what = "time of flight"
        pairs = [("Takes the time of flight to be proportional to the square of the launch speed.", a * a), ("Takes the time of flight to be unchanged, as if it depended only on the angle.", 1.0), ("Takes the time of flight to be proportional to the square root of the launch speed.", math.sqrt(a)), ("Takes the time of flight to be proportional to the cube of the launch speed.", a ** 3)]
    key, ds = num_opts(float(val), pairs, fmt=_fx)
    stem = f"A ball is launched from level ground with speed $v_0$ at an angle of ${th}^\\circ$ above the horizontal, and it lands at the same level. Air resistance is negligible. The ball is launched again at the same angle with a speed of ${a}v_0$. The {what} in the second launch is how many times the {what} in the first launch?"
    why = {0: f"The range is $v_0^2\\sin 2\\theta/g$, so it scales with the square of the speed: {a}$^2$ = {a * a} times.", 1: f"The maximum height is $(v_0\\sin\\theta)^2/(2g)$, so it scales with the square of the speed: {a}$^2$ = {a * a} times.", 2: f"The time of flight is $2v_0\\sin\\theta/g$, so it scales with the speed: {a} times."}[variant]
    return _d2("ph_pred_projectile_scale", "1.5", stem, key, ds, rng, kwhy=why, concept="Scaling of the range, maximum height or time of flight of a projectile with the launch speed", thinking=["Write the formula for the quantity in terms of the launch speed and the fixed angle", "Substitute the larger speed and compare with the original"],
               cond=[("air resistance is negligible and the ground is level", "the stem states negligible air resistance and a launch from and landing on level ground")], path="a time-stepped integration of the motion gives the range, maximum height and time of flight for both launch speeds and their ratio equals the power of the speed factor", facts=[f"a={a}", f"th={th}", f"v0={v0}", f"variant={variant}", f"val={val}"], est=75)


# ======================= 3.C 자료 근거 =======================
def ph_evid_position_data(rng):
    for _ in forever():
        a = pick(rng, [1.0, 1.5, 2.0, 3.0]); v0 = pick(rng, [0.0, 1.0, 2.0]); x0 = pick(rng, [0.0, 1.0, 2.0])
        ts = [0.0, 1.0, 2.0, 3.0, 4.0]; xs = [round(x0 + v0 * t + 0.5 * a * t * t, 2) for t in ts]
        d = [xs[i + 1] - xs[i] for i in range(4)]; dd = [d[i + 1] - d[i] for i in range(3)]
        # 독립 경로: 시간에 대한 2차 다항식 최소제곱 적합의 이차 계수 x2 가 a/2 와 같다
        c2 = float(np.polyfit(ts, xs, 2)[0]); agree(2 * c2, a, 1e-6, "a")
        if all(abs(q - a) < 1e-9 for q in dd) and a * 16 / 2 > 0 and abs(xs[-1] / 16 * 2 - a) > 0.15 * a:
            break
    est_wrong = 2 * xs[-1] / 16
    rows = [[f"{t:g}", f"{x:g}"] for t, x in zip(ts, xs)]
    stim = table_stimulus("Position of an object along a line", "Time t (s)", rows, "Position x (m)")
    stem = "An object moves along a straight line, and its position is measured once each second. The table shows the data. Which of the following is best supported by the data?"
    key, ds = sentence_options(f"The displacement in each successive 1.0 s interval ({d[0]:g} m, {d[1]:g} m, {d[2]:g} m, {d[3]:g} m) increases by the same ${a:g}\\text{{ m}}$, so the object has a constant acceleration of ${a:g}\\text{{ m/s}}^2$.", f"The change of the displacement per interval, ${a:g}\\text{{ m}}$ per 1.0 s interval, equals the change of the velocity per second, which is the acceleration.",
                               [(f"The object moves ${d[0]:g}\\text{{ m}}$ or more in every second, so its velocity is constant.", "Reads a position that keeps increasing as a constant velocity, although the displacement in each interval is different."),
                                (f"The acceleration is ${est_wrong:.3g}\\text{{ m/s}}^2$, because $a=2x/t^2$ for the position {xs[-1]:g} m at 4.0 s.", "Uses the constant-acceleration relation $x=\\tfrac12at^2$ as if the object had started at the origin from rest, ignoring the initial position and velocity in the data."),
                                ("The acceleration is not constant, because the displacement keeps increasing in each interval.", "Confuses an increasing displacement with an increasing acceleration; a constant acceleration makes the displacement increase by the same amount each interval.")])
    return mk("ph_evid_position_data", "1.3", "3.C", stem, key, ds, rng, concept="Supporting a claim of constant acceleration with the changes of the displacement in equal time intervals of a position table", thinking=["Find the displacement in each equal time interval", "Check whether the change in displacement from one interval to the next is constant, and relate it to the acceleration"], cond=[("the position is measured at equal time intervals", "the table gives the position each second")],
              path="a quadratic least-squares fit of the position against time has a quadratic coefficient equal to half the acceleration, and the successive displacement differences are all equal", material={"type": "table", "must_include": ["time column", "position column"]}, judgment=["representation_reading", "justification"], stim=stim, est=95,
              facts=[f"a={a}", f"v0={v0}", f"x0={x0}", f"x={json.dumps(xs)}"])


def ph_evid_energy_data(rng):
    for _ in forever():
        hs = sorted(rng.sample([0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0], 5)); loss = pick(rng, [0.0, 0.02, 0.04]); nz = [1 + rng.uniform(-0.015, 0.015) for _ in hs]
        vs = [round(math.sqrt(2 * G * h * (1 - loss) * z), 2) for h, z in zip(hs, nz)]
        q = [v * v / h for v, h in zip(vs, hs)]
        # 독립 경로: v^2 대 h 의 원점을 지나는 최소제곱 기울기가 2g(1-loss) 에 가깝고, v/h 는 눈에 띄게 변한다
        s = sum(v * v * h for v, h in zip(vs, hs)) / sum(h * h for h in hs)
        if abs(s - 2 * G * (1 - loss)) < 0.06 * 2 * G and max(q) - min(q) < 0.08 * np.mean(q) and (max(v / h for v, h in zip(vs, hs)) / min(v / h for v, h in zip(vs, hs))) > 1.4:
            break
    qm = float(np.mean(q)); vh = [v / h for v, h in zip(vs, hs)]
    rows = [[f"{h:g}", f"{v:g}"] for h, v in zip(hs, vs)]
    stim = table_stimulus("Speed at the bottom of a track for different release heights", "Release height h (m)", rows, "Speed at the bottom v (m/s)")
    stem = "A cart is released from rest at different heights on a nearly frictionless track and its speed at the bottom is measured. The table shows the data. Which of the following is best supported by the data?"
    key, ds = sentence_options(f"The ratio $v^2/h$ is nearly constant, about ${qm:.3g}\\text{{ m/s}}^2$, which matches $v^2=2gh$ for $g=9.8\\text{{ m/s}}^2$, so the data support conservation of mechanical energy with little friction.", f"The values of $v^2/h$ range only from ${min(q):.3g}$ to ${max(q):.3g}$ m/s$^2$, close to $2g=19.6$ m/s$^2$.",
                               [(f"The ratio $v/h$ is nearly constant, so the speed at the bottom is proportional to the release height.", f"Tests the ratio $v/h$ for a direct proportion, but for these data it falls from ${max(vh):.3g}$ to ${min(vh):.3g}$ s$^{{-1}}$."),
                                (f"The speeds are all below ${max(vs) + 0.5:.2g}\\text{{ m/s}}$, so a large amount of energy must have been lost to friction.", "Judges the energy loss from the size of the speeds instead of comparing $v^2/h$ with $2g$."),
                                (f"The ratio $v^2/h$ is about ${qm:.3g}\\text{{ m/s}}^2$, not $g=9.8\\text{{ m/s}}^2$, so the mechanical energy was not conserved.", "Forgets the factor of 2 in $v^2=2gh$ and compares $v^2/h$ with $g$ instead of $2g$.")])
    return mk("ph_evid_energy_data", "3.4", "3.C", stem, key, ds, rng, concept="Supporting energy conservation by comparing the ratio of the squared speed to the height with 2g in a data table", thinking=["Compute $v^2/h$ for each release height", "Compare the nearly constant value with $2g$ from $mgh=\\tfrac12mv^2$"], cond=[("the track is nearly frictionless", "the stem states a nearly frictionless track")],
              path="a least-squares slope of v squared against h through the origin matches 2g within six percent, while the ratio v over h varies by more than forty percent", material={"type": "table", "must_include": ["height column", "speed column"]}, judgment=["representation_reading", "justification"], stim=stim, est=100,
              facts=[f"h={json.dumps(hs)}", f"v={json.dumps(vs)}", f"mean_v2_over_h={qm}", f"loss={loss}"])


STAGE_U1 = ["ph_pred_projectile_scale", "ph_evid_position_data"]
STAGE_U2 = ["ph_rank_centripetal"]
STAGE_U3 = ["ph_sym_pendulum_bottom", "ph_rank_work", "ph_evid_energy_data"]
STAGE_U4 = ["ph_sym_bounce_force", "ph_pred_collision_speed"]
STAGE_U6 = ["ph_sym_orbit", "ph_pred_orbit"]
STAGE_S3 = STAGE_U1 + STAGE_U2 + STAGE_U3 + STAGE_U4 + STAGE_U6
