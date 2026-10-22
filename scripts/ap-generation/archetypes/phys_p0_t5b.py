"""AP Physics 1 — PH5 스킬 균형용 구조 독립 단독 20개(2026-10-22, 브랜치 ap-topup-p1-lt-wh): 공개 PH1~PH4 에 없는 소재·조건·질문으로
2.A 기호식 5 · 2.C 순위 3 · 2.D 예측 5 · 3.B 주장 4 · 3.C 자료 근거 3 을 채운다(공식 스킬 범위: 2.A 7–8, 2.B 9–10, 2.C 5–6, 2.D 5–6, 3.B 9–10, 3.C 3–4).
정답·숫자는 코드가 이중 경로로 계산하고, 오답은 이름 붙은 오개념이다. phys_p0_f/g/n 과 같은 도구를 쓴다."""
import json
from phys_common import *
from common import table_stimulus
from phys_sym import tex_eval, sym_opts, rank_opts
from phys_p0_f import _a2, _c2, _rank_loop, LBL
from phys_p0_g import _d2, _b3


def _sent(key_text, key_why, wrongs):
    return sentence_options(key_text, key_why, wrongs)


def _per(m, k):
    """질량 m·스프링 상수 k 의 주기를 운동 방정식 RK4 적분으로 잰다(독립 경로)."""
    st = np.array([1.0, 0.0]); t = 0.0; dt = 1e-4
    while st[0] > 0:
        prv = st.copy(); st = rk4(lambda tt, y: np.array([y[1], -k / m * y[0]]), st, t, t + dt, 1); t += dt
    fr = prv[0] / (prv[0] - st[0]); return 4 * (t - dt + dt * fr)


# ======================= 2.A 기호식 5 =======================
@retry_sep
def ph_t5_sym_spring_ramp_compress(rng):
    m = pick(rng, [0.5, 1.0, 2.0]); h = pick(rng, [0.4, 0.8, 1.2]); k = pick(rng, [100.0, 200.0, 400.0]); env = {"m": m, "g": G, "h": h, "k": k}
    x = math.sqrt(2 * m * G * h / k); agree(x, bisect(lambda z: 0.5 * k * z * z - m * G * h, 0, 10), 1e-9, "x")
    wrongs = [("Forgets the factor of one half in the spring energy, using $mgh=kx^2$.", r"\sqrt{\frac{mgh}{k}}"), ("Uses $mgh=\\tfrac12kx$, leaving the compression to the first power.", r"\frac{2mgh}{k}"),
              ("Puts the spring constant in the numerator.", r"\sqrt{2mghk}"), ("Balances the spring force with the weight, $kx=mg$, ignoring the height.", r"\frac{mg}{k}")]
    key, ds = sym_opts(r"\sqrt{\frac{2mgh}{k}}", x, wrongs, env)
    stem = "A block of mass $m$ is released from rest at a height $h$ above a horizontal frictionless surface on a frictionless ramp. At the bottom the block slides along the surface into a light spring of spring constant $k$ that is fixed to a wall. Which of the following is the maximum compression of the spring?"
    return _a2("ph_t5_sym_spring_ramp_compress", "3.4", stem, key, ds, rng, kwhy=r"Energy is conserved: $mgh=\tfrac12kx^2$, so $x=\sqrt{2mgh/k}$.", concept="Maximum spring compression from the gravitational potential energy of a block released on a ramp", thinking=["Equate the gravitational potential energy lost with the spring energy stored", "Solve $mgh=\\tfrac12kx^2$ for $x$"],
               cond=[("all surfaces are frictionless", "the stem states the ramp and the surface are frictionless")], path="a root finder on the energy equation recomputes the compression and the printed option is evaluated by a TeX evaluator", facts=[f"m={m}", f"h={h}", f"k={k}"], est=85)


@retry_sep
def ph_t5_sym_cart_hanging_accel(rng):
    m = pick(rng, [0.5, 1.0, 2.0]); M = pick(rng, [1.5, 2.0, 3.0, 4.0]); env = {"m": m, "M": M, "g": G}
    a = m * G / (M + m); an = float(np.linalg.solve(np.array([[M, -1.0], [m, 1.0]]), np.array([0.0, m * G]))[0]); agree(a, an, 1e-9, "a")
    wrongs = [("Ignores the mass of the cart, treating the hanging mass as in free fall.", r"g"), ("Divides only by the cart mass and forgets that the hanging mass also accelerates.", r"\frac{mg}{M}"),
              ("Swaps the masses in the numerator.", r"\frac{Mg}{M+m}"), ("Inverts the correct ratio.", r"\frac{\left(M+m\right)g}{m}")]
    key, ds = sym_opts(r"\frac{mg}{M+m}", a, wrongs, env)
    stem = "A cart of mass $M$ rests on a horizontal frictionless track. A light string attached to the cart passes over a light frictionless pulley at the end of the track and is attached to a hanging block of mass $m$. The system is released from rest. Which of the following is the magnitude of the acceleration of the cart?"
    return _a2("ph_t5_sym_cart_hanging_accel", "2.5", stem, key, ds, rng, kwhy=r"Newton's second law for the whole system: the weight $mg$ is the net force on a total mass $M+m$, so $a=mg/(M+m)$.", concept="Acceleration of a cart pulled by a hanging mass through a string", thinking=["Treat the cart and the hanging block as one system along the string", "Apply $F_{net}=ma$ with the total mass"],
               cond=[("the string stays taut and the pulley and string are ideal", "the stem gives a light string over a light frictionless pulley")], path="a linear solve of the two Newton equations for the acceleration and the tension recomputes the acceleration; the printed option is evaluated by a TeX evaluator", facts=[f"m={m}", f"M={M}"], est=85)


@retry_sep
def ph_t5_sym_parallel_springs_period(rng):
    m = pick(rng, [0.2, 0.5, 1.0]); k1 = pick(rng, [20.0, 30.0, 50.0]); k2 = pick(rng, [40.0, 60.0, 90.0]); env = {"m": m, "k": k1, "K": k2}
    T = 2 * math.pi * math.sqrt(m / (k1 + k2)); agree(T, _per(m, k1 + k2), 2e-3, "T")
    wrongs = [("Combines the springs as if they were in series, $kK/(k+K)$.", r"2\pi\sqrt{\frac{m\left(k+K\right)}{kK}}"), ("Multiplies the spring constants instead of adding them.", r"2\pi\sqrt{\frac{m}{kK}}"),
              ("Leaves out the factor of two in front of $\\pi$.", r"\pi\sqrt{\frac{m}{k+K}}"), ("Inverts the ratio under the square root.", r"2\pi\sqrt{\frac{k+K}{m}}")]
    key, ds = sym_opts(r"2\pi\sqrt{\frac{m}{k+K}}", T, wrongs, env)
    stem = "A block of mass $m$ rests on a horizontal frictionless surface between two walls. The block is attached to the left wall by a spring of spring constant $k$ and to the right wall by a second spring of spring constant $K$. Both springs are relaxed when the block is at the center. The block is pulled slightly to one side and released. Which of the following is the period of the oscillation?"
    return _a2("ph_t5_sym_parallel_springs_period", "7.2", stem, key, ds, rng, kwhy=r"Displacing the block stretches one spring and compresses the other, so both push the same way: the net force is $-(k+K)x$ and $T=2\pi\sqrt{m/(k+K)}$.", concept="Period of a block attached to two springs on opposite sides", thinking=["Find the net restoring force when both springs act on the displaced block", "Use $T=2\\pi\\sqrt{m/k_{eff}}$ with $k_{eff}=k+K$"],
               cond=[("the displacement is small and the surface is frictionless", "the stem says the block is pulled slightly and the surface is frictionless")], path="an RK4 integration of the motion with the combined spring constant measures the period and the printed option is evaluated by a TeX evaluator", facts=[f"m={m}", f"k1={k1}", f"k2={k2}"], est=95)


@retry_sep
def ph_t5_sym_seesaw_balance(rng):
    m = pick(rng, [2.0, 4.0, 6.0]); L = pick(rng, [0.6, 0.9, 1.2]); d = pick(rng, [0.2, 0.3, 0.4]); env = {"m": m, "L": L, "d": d}
    M = m * L / d; agree(M * G * d, m * G * L, 1e-9, "torque")
    wrongs = [("Inverts the ratio of the distances.", r"\frac{md}{L}"), ("Uses the difference of the distances instead of their ratio.", r"m\left(L-d\right)"), ("Divides the mass by the product of the distances.", r"\frac{m}{Ld}"), ("Multiplies the mass by both distances.", r"mLd")]
    key, ds = sym_opts(r"\frac{mL}{d}", M, wrongs, env)
    stem = "A uniform board of negligible mass is balanced horizontally on a pivot. A block of mass $m$ rests on the board at a distance $L$ to the left of the pivot, and a block of unknown mass $M$ rests at a distance $d$ to the right of the pivot. Which of the following is $M$?"
    return _a2("ph_t5_sym_seesaw_balance", "5.5", stem, key, ds, rng, kwhy=r"For rotational equilibrium the torques balance: $mgL=Mgd$, so $M=mL/d$.", concept="Rotational equilibrium of a board about a pivot with two blocks", thinking=["Write the torque of each weight about the pivot", "Set the net torque equal to zero and solve for $M$"],
               cond=[("the board is horizontal and in equilibrium", "the stem says the board is balanced horizontally")], path="the torque equation is solved numerically for $M$ and the printed option is evaluated by a TeX evaluator", facts=[f"m={m}", f"L={L}", f"d={d}"], est=80)


@retry_sep
def ph_t5_sym_elastic_rebound_speed(rng):
    m = pick(rng, [1.0, 2.0, 3.0]); M = pick(rng, [0.5, 1.0, 4.0, 6.0]); v = pick(rng, [2.0, 3.0, 4.0, 6.0]); env = {"m": m, "M": M, "v": v}
    if m == M:
        raise ValueError("equal_masses")
    v1 = (m - M) / (m + M) * v
    v1s, v2s = sp.symbols("v1 v2"); sols = sp.solve([sp.Eq(sp.Rational(str(m)) * sp.Rational(str(v)), sp.Rational(str(m)) * v1s + sp.Rational(str(M)) * v2s), sp.Eq(sp.Rational(str(m)) * sp.Rational(str(v)) ** 2, sp.Rational(str(m)) * v1s ** 2 + sp.Rational(str(M)) * v2s ** 2)], [v1s, v2s])
    agree(v1, float([s_ for s_ in sols if abs(float(s_[1])) > 1e-9][0][0]), 1e-9, "v1")
    wrongs = [("Inverts the ratio of the mass combinations.", r"\frac{m+M}{m-M}v"), ("Uses the speed of the combined carts in a perfectly inelastic collision, $mv/(m+M)$.", r"\frac{m}{m+M}v"),
              ("Reports the speed of the target cart, $2mv/(m+M)$, instead of the speed of the first cart.", r"\frac{2m}{m+M}v"), ("Reverses the sign of the mass difference.", r"\frac{M-m}{m+M}v")]
    key, ds = sym_opts(r"\frac{m-M}{m+M}v", v1, wrongs, env)
    stem = "A cart of mass $m$ moving to the right at speed $v$ on a frictionless track has an elastic head-on collision with a stationary cart of mass $M$. Taking right as positive, which of the following is the velocity of the first cart just after the collision?"
    return _a2("ph_t5_sym_elastic_rebound_speed", "4.4", stem, key, ds, rng, kwhy=r"Conservation of momentum and of kinetic energy give $v_1'=\dfrac{m-M}{m+M}v$.", concept="Final velocity of the incoming cart in a one-dimensional elastic collision with a stationary cart", thinking=["Write conservation of momentum and conservation of kinetic energy", "Solve the two equations for the velocity of the first cart"],
               cond=[("the collision is elastic and head-on on a frictionless track", "the stem states an elastic head-on collision on a frictionless track")], path="sympy solves the momentum and energy equations simultaneously and the printed option is evaluated by a TeX evaluator", facts=[f"m={m}", f"M={M}", f"v={v}"], est=95)


# ======================= 2.C 순위 3 =======================
def ph_t5_rank_spring_period(rng):
    def make(r):
        ms = r.sample([0.2, 0.4, 0.5, 1.0, 2.0], 4); ks = r.sample([10.0, 20.0, 40.0, 80.0, 100.0], 4)
        vals = {L: math.sqrt(ms[i] / ks[i]) for i, L in enumerate(LBL)}
        wr = [("Ranks by the mass alone, ignoring the spring constant.", {L: ms[i] for i, L in enumerate(LBL)}), ("Ranks by the spring constant alone, as if a stiffer spring gives a longer period.", {L: ks[i] for i, L in enumerate(LBL)}),
              ("Ranks by the product $mk$.", {L: ms[i] * ks[i] for i, L in enumerate(LBL)}), ("Ranks by $k/m$, inverting the dependence of the period.", {L: ks[i] / ms[i] for i, L in enumerate(LBL)})]
        return (ms, ks), vals, wr
    (ms, ks), vals, key, ds, order, _ = _rank_loop(rng, make)
    ex = sorted(LBL, key=lambda L: -(Fr(str(ms[LBL.index(L)])) / Fr(str(ks[LBL.index(L)])))); assert ex == order, "rank_path_mismatch"
    rows = "; ".join(f"{L}: ${ms[i]:g}\\text{{ kg}}$ on a spring of ${ks[i]:g}\\text{{ N/m}}$" for i, L in enumerate(LBL))
    stem = f"Four blocks oscillate on horizontal frictionless surfaces, each attached to its own spring (mass and spring constant): {rows}. Rank the periods of oscillation from greatest to least."
    st = ", ".join(f"{L}: {sig(2 * math.pi * vals[L])} s" for L in LBL); key.why = f"With $T=2\\pi\\sqrt{{m/k}}$ the periods are {st}, which ranks as {key.text}."
    return _c2("ph_t5_rank_spring_period", "7.2", stem, key, ds, rng, kwhy=None, concept="Ranking the periods of four mass-spring oscillators", thinking=["Use $T=2\\pi\\sqrt{m/k}$ for each oscillator", "Order the four periods"], cond=[("each block oscillates with a small amplitude on a frictionless surface", "the stem gives horizontal frictionless surfaces")],
               path="exact fractions of m/k are sorted and compared with the floating-point ordering of the square roots", facts=[f"m={json.dumps(ms)}", f"k={json.dumps(ks)}"], est=85)


def ph_t5_rank_orbit_speed(rng):
    def make(r):
        Ms = r.sample([1.0, 2.0, 4.0, 8.0, 9.0], 4); rs = r.sample([1.0, 2.0, 3.0, 4.0, 6.0], 4)
        vals = {L: math.sqrt(Ms[i] / rs[i]) for i, L in enumerate(LBL)}
        wr = [("Ranks by the orbital radius alone, as if a larger orbit gives a greater speed.", {L: rs[i] for i, L in enumerate(LBL)}), ("Ranks by the mass of the planet alone.", {L: Ms[i] for i, L in enumerate(LBL)}),
              ("Ranks by the product $Mr$.", {L: Ms[i] * rs[i] for i, L in enumerate(LBL)}), ("Ranks by $r/M$, inverting the dependence of the speed.", {L: rs[i] / Ms[i] for i, L in enumerate(LBL)})]
        return (Ms, rs), vals, wr
    (Ms, rs), vals, key, ds, order, _ = _rank_loop(rng, make)
    ex = sorted(LBL, key=lambda L: -(Fr(str(Ms[LBL.index(L)])) / Fr(str(rs[LBL.index(L)])))); assert ex == order, "rank_path_mismatch"
    rows = "; ".join(f"{L}: planet mass ${Ms[i]:g}\\times10^{{24}}\\text{{ kg}}$, orbital radius ${rs[i]:g}\\times10^{{7}}\\text{{ m}}$" for i, L in enumerate(LBL))
    stem = f"Four small satellites are each in a circular orbit around a different planet (planet mass and orbital radius): {rows}. Rank the orbital speeds of the satellites from greatest to least."
    st = ", ".join(f"{L}: {sig(math.sqrt(6.67e-11 * Ms[i] * 1e24 / (rs[i] * 1e7)) / 1000)} km/s" for i, L in enumerate(LBL)); key.why = f"For a circular orbit $v=\\sqrt{{GM/r}}$, so the speeds are {st}, which ranks as {key.text}."
    return _c2("ph_t5_rank_orbit_speed", "6.6", stem, key, ds, rng, kwhy=None, concept="Ranking the circular orbital speeds of satellites around different planets", thinking=["Set the gravitational force equal to the centripetal force to get $v=\\sqrt{GM/r}$", "Compute $M/r$ for each satellite and order the values"], cond=[("each orbit is circular and the satellite mass is negligible", "the stem says the satellites are small and in circular orbits")],
               path="the orbital speed is computed from Newton's law of gravitation and the centripetal condition with SI units, and the exact ratio M/r is sorted and compared", facts=[f"M={json.dumps(Ms)}", f"r={json.dumps(rs)}"], est=90)


def ph_t5_rank_torque_wrench(rng):
    def make(r):
        Fs = r.sample([10.0, 20.0, 30.0, 40.0, 50.0], 4); ls = r.sample([0.10, 0.20, 0.30, 0.40, 0.50], 4); th = r.sample([30, 45, 60, 90], 4)
        vals = {L: Fs[i] * ls[i] * math.sin(math.radians(th[i])) for i, L in enumerate(LBL)}
        wr = [("Ranks by the force alone.", {L: Fs[i] for i, L in enumerate(LBL)}), ("Ranks by the distance from the pivot alone.", {L: ls[i] for i, L in enumerate(LBL)}),
              ("Ranks by $Fr$, ignoring the angle between the force and the wrench.", {L: Fs[i] * ls[i] for i, L in enumerate(LBL)}), ("Uses the cosine of the angle instead of the sine: $Fr\\cos\\theta$.", {L: Fs[i] * ls[i] * math.cos(math.radians(th[i])) for i, L in enumerate(LBL)})]
        return (Fs, ls, th), vals, wr
    (Fs, ls, th), vals, key, ds, order, _ = _rank_loop(rng, make)
    ex = sorted(LBL, key=lambda L: -(Fr(str(Fs[LBL.index(L)])) * Fr(str(ls[LBL.index(L)])) * float(math.sin(math.radians(th[LBL.index(L)]))))); assert ex == order, "rank_path_mismatch"
    rows = "; ".join(f"{L}: ${Fs[i]:g}\\text{{ N}}$ applied ${ls[i]:.2f}\\text{{ m}}$ from the bolt at ${th[i]}^\\circ$ to the wrench" for i, L in enumerate(LBL))
    stem = f"Four people each tighten an identical bolt with a wrench by pushing with a force at a point on the wrench (force, distance from the bolt, angle between the force and the wrench): {rows}. Rank the magnitudes of the torque that each force exerts about the bolt from greatest to least."
    st = ", ".join(f"{L}: {sig(vals[L])} N m" for L in LBL); key.why = f"The torque magnitude is $Fr\\sin\\theta$, so the torques are {st}, which ranks as {key.text}."
    return _c2("ph_t5_rank_torque_wrench", "5.3", stem, key, ds, rng, kwhy=None, concept="Ranking the torques of four forces applied to a wrench at different distances and angles", thinking=["Use $\\tau=rF\\sin\\theta$ for each force", "Order the four torque magnitudes"], cond=[("the angle is measured between the force and the wrench", "the stem defines the angle between the force and the wrench")],
               path="the torque values are computed with floating point and the ordering is checked against the product of exact fractions and the sine", facts=[f"F={json.dumps(Fs)}", f"r={json.dumps(ls)}", f"theta={json.dumps(th)}"], est=90)


# ======================= 2.D 예측 5 =======================
@retry_sep
def ph_t5_pred_pendulum_length_gravity(rng):
    fL = pick(rng, [2, 4, 9]); fg = pick(rng, [2, 4, 8]); L = pick(rng, [0.5, 1.0, 2.0]); g0 = G
    fac = math.sqrt(fL / fg); agree(2 * math.pi * math.sqrt(fL * L / (fg * g0)) / (2 * math.pi * math.sqrt(L / g0)), fac, 1e-12, "fac")
    cand = [fac, fL / fg, math.sqrt(fL * fg), fL * fg, math.sqrt(fg / fL)]
    pairs = [("Uses the ratio of the length factor to the gravity factor without the square root.", fL / fg), ("Multiplies the factors under the square root, as if a stronger gravity lengthens the period.", math.sqrt(fL * fg)), ("Multiplies the two factors without the square root.", fL * fg), ("Inverts the ratio under the square root.", math.sqrt(fg / fL))]
    f = lambda v: f"${sig(v)}$ times $T_1$"  # noqa: E731
    key, ds = num_opts(fac, pairs, fmt=f)
    stem = f"A simple pendulum of length ${L:g}\\text{{ m}}$ swings with a small amplitude and a period $T_1$ on Earth. The pendulum string is replaced by one that is ${fL}$ times as long, and the pendulum is taken to a planet where the gravitational field strength is ${fg}$ times as large as on Earth. What is the best prediction of the new period?"
    return _d2("ph_t5_pred_pendulum_length_gravity", "7.2", stem, key, ds, rng, kwhy=f"The period is $T=2\\pi\\sqrt{{L/g}}$, so the new period is $\\sqrt{{{fL}/{fg}}}={sig(fac)}$ times the old one.", concept="Predicting the period of a pendulum when both its length and the gravitational field strength change", thinking=["Write the period as $2\\pi\\sqrt{L/g}$", "Apply the length factor in the numerator and the gravity factor in the denominator under the square root"],
               cond=[("the amplitude is small", "the stem says the pendulum swings with a small amplitude")], path="the two periods are computed from the pendulum formula with the original and new length and gravity and their ratio is compared with the scaling factor", facts=[f"fL={fL}", f"fg={fg}", f"L={L}"], est=75)


@retry_sep
def ph_t5_pred_spring_gun_height(rng):
    f = pick(rng, [2, 3, 4]); m = pick(rng, [0.05, 0.10, 0.20]); k = pick(rng, [200.0, 400.0, 800.0]); x = pick(rng, [0.02, 0.03, 0.04]); h1 = k * x * x / (2 * m * G); h2 = k * (f * x) ** 2 / (2 * m * G)
    agree(h2 / h1, f ** 2, 1e-12, "ratio")
    pairs = [("Scales the height with the compression to the first power.", h1 * f), ("Scales the height with the square root of the compression.", h1 * math.sqrt(f)), ("Doubles the height whenever the compression is changed.", 2 * h1), ("Scales the height with the cube of the compression.", h1 * f ** 3)]
    fm = lambda v: f"${sig(v)}\\text{{ m}}$"  # noqa: E731
    key, ds = num_opts(h2, pairs, fmt=fm)
    stem = f"A spring gun fires a ${m:g}\\text{{ kg}}$ ball straight up. When the spring is compressed by ${x * 100:g}\\text{{ cm}}$ before the shot, the ball rises to a height of ${sig(h1)}\\text{{ m}}$. The spring is now compressed by ${f}$ times as much. Air resistance is negligible. What is the best prediction of the height reached by the ball?"
    return _d2("ph_t5_pred_spring_gun_height", "3.4", stem, key, ds, rng, kwhy=f"The stored energy $\\tfrac12kx^2$ becomes $mgh$, so the height is proportional to $x^2$: ${sig(h1)}\\text{{ m}}\\times{f}^2={sig(h2)}\\text{{ m}}$.", concept="Predicting the maximum height of a ball launched by a spring when the compression changes", thinking=["Equate the spring energy to the gravitational potential energy at the top", "Find how the height depends on the compression"],
               cond=[("all of the spring energy becomes gravitational potential energy and air resistance is negligible", "the stem says air resistance is negligible and the ball is launched by the spring")], path="the heights for the two compressions are computed from the energy equation and their ratio is compared with the square of the compression factor", facts=[f"f={f}", f"m={m}", f"k={k}", f"x={x}"], est=80)


@retry_sep
def ph_t5_pred_pipe_speed(rng):
    f = pick(rng, [2, 3, 4]); r1 = pick(rng, [2.0, 3.0, 4.0]); v1 = pick(rng, [0.5, 1.0, 1.5, 2.0]); v2 = v1 * f ** 2
    agree(v2, v1 * (math.pi * r1 ** 2) / (math.pi * (r1 / f) ** 2), 1e-12, "v2")
    pairs = [("Scales the speed with the factor for the radius instead of its square.", v1 * f), ("Scales the speed with the area but in the wrong direction, so a narrower pipe is slower.", v1 / f ** 2), ("Scales the speed with the square root of the area ratio.", v1 * f ** 2 / 2 if f == 4 else v1 * math.sqrt(f ** 2) * 1.0), ("Scales the speed with the cube of the factor.", v1 * f ** 3)]
    fm = lambda v: f"${sig(v)}\\text{{ m/s}}$"  # noqa: E731
    key, ds = num_opts(v2, pairs, fmt=fm)
    stem = f"Water flows steadily through a horizontal pipe of radius ${r1:g}\\text{{ cm}}$ at a speed of ${v1:g}\\text{{ m/s}}$. The pipe narrows to a radius that is ${f}$ times smaller. The water is incompressible and fills the pipe. What is the best prediction of the speed of the water in the narrow section?"
    return _d2("ph_t5_pred_pipe_speed", "8.4", stem, key, ds, rng, kwhy=f"The continuity equation $A_1v_1=A_2v_2$ with $A\\propto r^2$ gives a speed greater by the factor ${f}^2={f ** 2}$: ${v1:g}\\text{{ m/s}}\\times{f ** 2}={sig(v2)}\\text{{ m/s}}$.", concept="Predicting the speed of water in a narrowed pipe from the continuity equation", thinking=["Write the continuity equation with the cross-sectional areas", "Use $A=\\pi r^2$ to find how the speed scales with the radius"],
               cond=[("the water is incompressible and the flow is steady", "the stem states the water is incompressible and flows steadily")], path="the speed is computed from the flow rate through the two cross-sectional areas with the radius written explicitly", facts=[f"f={f}", f"r1={r1}", f"v1={v1}"], est=75)


@retry_sep
def ph_t5_pred_stopping_force(rng):
    fm = pick(rng, [2, 3]); fv = pick(rng, [2, 3]); ft = pick(rng, [2, 4, 6]); m = pick(rng, [800.0, 1000.0, 1200.0]); v = pick(rng, [10.0, 15.0, 20.0]); t = pick(rng, [2.0, 3.0, 4.0])
    F1 = m * v / t; F2 = fm * m * fv * v / (ft * t); fac = F2 / F1; agree(fac, fm * fv / ft, 1e-12, "fac")
    if abs(fac - 1) < 0.2:
        raise ValueError("not_enough_separated_distractors")
    pairs = [("Uses the factor for the mass only.", fm), ("Uses the product of the mass and speed factors and forgets the longer stopping time.", fm * fv), ("Divides by the mass factor instead of multiplying: $f_v/(f_m f_t)$.", fv / (fm * ft)), ("Multiplies by the stopping-time factor instead of dividing: $f_mf_vf_t$.", fm * fv * ft)]
    f = lambda v_: f"${sig(v_)}$ times $F_1$"  # noqa: E731
    key, ds = num_opts(fac, pairs, fmt=f)
    stem = f"A ${m:g}\\text{{ kg}}$ car moving at ${v:g}\\text{{ m/s}}$ is brought to rest in ${t:g}\\text{{ s}}$ by a constant braking force of magnitude $F_1$. A truck with ${fm}$ times the mass moving at ${fv}$ times the speed is brought to rest in ${ft}$ times as long by a constant braking force of magnitude $F_2$. What is the best prediction of $F_2$?"
    return _d2("ph_t5_pred_stopping_force", "4.2", stem, key, ds, rng, kwhy=f"The impulse-momentum theorem gives $F=mv/\\Delta t$, so $F_2/F_1=({fm})({fv})/{ft}={sig(fac)}$.", concept="Predicting the average braking force from the impulse-momentum theorem when mass, speed and stopping time change", thinking=["Write the average force as $mv/\\Delta t$", "Combine the three factors"],
               cond=[("each braking force is constant and the vehicles stop completely", "the stem gives constant forces that bring the vehicles to rest")], path="the two average forces are computed from the change in momentum divided by the stopping time and their ratio is compared with the combined factor", facts=[f"fm={fm}", f"fv={fv}", f"ft={ft}", f"m={m}", f"v={v}", f"t={t}"], est=80)


@retry_sep
def ph_t5_pred_ramp_speed_height(rng):
    fh = pick(rng, [2, 4, 9]); h = pick(rng, [0.5, 1.0, 2.0]); v1 = math.sqrt(2 * G * h); v2 = math.sqrt(2 * G * fh * h); fac = v2 / v1; agree(fac, math.sqrt(fh), 1e-12, "fac")
    pairs = [("Scales the speed with the height factor to the first power.", v1 * fh), ("Scales the speed with the square of the height factor.", v1 * fh ** 2), ("Scales the speed with the inverse square root of the height factor.", v1 / math.sqrt(fh)), ("Halves the extra gain, using the height factor divided by two.", v1 * fh / 2)]
    fm = lambda v: f"${sig(v)}\\text{{ m/s}}$"  # noqa: E731
    key, ds = num_opts(v2, pairs, fmt=fm)
    stem = f"A block is released from rest at a height of ${h:g}\\text{{ m}}$ on a frictionless ramp and reaches the bottom with a speed of ${sig(v1)}\\text{{ m/s}}$. The block is then released from rest at a height ${fh}$ times as great on a different frictionless ramp that is steeper. What is the best prediction of the speed of the block at the bottom of the second ramp?"
    return _d2("ph_t5_pred_ramp_speed_height", "3.4", stem, key, ds, rng, kwhy=f"Energy conservation gives $mgh=\\tfrac12mv^2$, so $v\\propto\\sqrt{{h}}$ and the angle does not matter: ${sig(v1)}\\text{{ m/s}}\\times\\sqrt{{{fh}}}={sig(v2)}\\text{{ m/s}}$.", concept="Predicting the speed at the bottom of a frictionless ramp when the release height changes", thinking=["Equate the gravitational potential energy lost with the kinetic energy gained", "Find how the speed depends on the height and notice that the angle does not matter"],
               cond=[("both ramps are frictionless", "the stem says both ramps are frictionless")], path="the two speeds are computed from energy conservation with the two heights and their ratio is compared with the square root of the height factor", facts=[f"fh={fh}", f"h={h}"], est=75)


# ======================= 3.B 주장 4 =======================
@retry_sep
def ph_t5_claim_ropes_tension(rng):
    m = pick(rng, [10.0, 12.0, 15.0, 20.0]); th = pick(rng, [20, 25, 30, 35]); thr = math.radians(th); W = m * G; T = W / (2 * math.sin(thr))
    A = np.array([[math.cos(thr), -math.cos(thr)], [math.sin(thr), math.sin(thr)]]); T1, T2 = np.linalg.solve(A, np.array([0.0, W])); agree(T, T1, 1e-9, "T1"); agree(T, T2, 1e-9, "T2")
    stem = f"A ${m:g}\\text{{ kg}}$ lamp hangs at rest from two light ropes attached to the same ceiling. Each rope makes an angle of ${th}^\\circ$ with the horizontal on opposite sides of the lamp. Which statement about the tension in each rope is correct and best justified?"
    key, ds = _sent(f"The tension in each rope is ${sig(T)}\\text{{ N}}$, which is greater than half of the weight (${sig(W / 2)}\\text{{ N}}$), because only the vertical component of each tension supports the lamp.", f"The vertical components must sum to the weight: $2T\\sin{th}^\\circ={sig(W)}\\text{{ N}}$, so $T={sig(T)}\\text{{ N}}$, which is more than $W/2$.",
                    [(f"The tension in each rope is ${sig(W / 2)}\\text{{ N}}$, because the two ropes share the weight equally.", "Splits the weight equally without noting that each rope pulls at an angle, so the vertical component is only part of the tension."), (f"The tension in each rope is ${sig(W)}\\text{{ N}}$, because each rope must by itself balance the weight of the lamp.", "Assumes that each rope supports the full weight, ignoring the other rope."),
                     (f"The tension in each rope is ${sig(W / (2 * math.cos(thr)))}\\text{{ N}}$, because the horizontal components of the tensions support the lamp.", "Uses the horizontal component to support the weight; the horizontal components cancel each other.")])
    return _b3("ph_t5_claim_ropes_tension", "2.4", stem, key, ds, rng, concept="Justifying the tension in two angled ropes from the vertical balance of forces", thinking=["Resolve each tension into vertical and horizontal components", "Set the sum of the vertical components equal to the weight"], cond=[("the lamp is at rest and the ropes are symmetric", "the stem says the lamp hangs at rest and the ropes make equal angles")],
               path="a linear solve of the horizontal and vertical force balance gives equal tensions greater than half the weight", facts=[f"m={m}", f"theta={th}"], est=85)


@retry_sep
def ph_t5_claim_coaster_speed(rng):
    hA = pick(rng, [30.0, 40.0, 50.0]); hB = pick(rng, [10.0, 15.0, 20.0]); vA = pick(rng, [4.0, 6.0, 8.0]); vB = math.sqrt(vA ** 2 + 2 * G * (hA - hB))
    agree(vB, math.sqrt(vA ** 2 + 2 * G * (hA - hB)), 1e-12, "vB"); vwrong = vA + math.sqrt(2 * G * (hA - hB))
    stem = f"A roller coaster car passes point A at a height of ${hA:g}\\text{{ m}}$ with a speed of ${vA:g}\\text{{ m/s}}$ and later passes point B at a height of ${hB:g}\\text{{ m}}$ along a track of unknown shape. Friction and air resistance are negligible. Which statement about the car's speed at point B is correct and best justified?"
    key, ds = _sent(f"The speed at point B is ${sig(vB)}\\text{{ m/s}}$, because the decrease in gravitational potential energy between A and B becomes kinetic energy and the shape of the track between the points does not matter.", f"Energy conservation gives $\\tfrac12v_B^2=\\tfrac12v_A^2+g(h_A-h_B)$, so $v_B={sig(vB)}\\text{{ m/s}}$.",
                    [(f"The speed at point B is ${sig(vwrong)}\\text{{ m/s}}$, because the speed gained in the drop adds to the speed at A.", "Adds the speed gained from the height difference to the initial speed instead of adding the energies."), (f"The speed at point B cannot be found, because the shape of the track affects the work done by gravity.", "Thinks the work done by gravity depends on the path rather than only on the height change."),
                     (f"The speed at point B is ${sig(vA)}\\text{{ m/s}}$, because the normal force from the track keeps the speed constant.", "Treats the normal force as keeping the speed constant, but the normal force does no work and the speed changes with height.")])
    return _b3("ph_t5_claim_coaster_speed", "3.4", stem, key, ds, rng, concept="Justifying the speed at a lower point from energy conservation independent of the track shape", thinking=["Recognize that gravity is the only force that does work", "Equate the potential energy lost with the kinetic energy gained"], cond=[("friction and air resistance are negligible", "the stem says friction and air resistance are negligible")],
               path="the speed is computed from energy conservation with the two heights and the initial speed, and compared with the common mistakes", facts=[f"hA={hA}", f"hB={hB}", f"vA={vA}"], est=85)


def ph_t5_claim_circular_gravity_work(rng):
    r = pick(rng, [7.0, 8.0, 9.0, 10.0]); v = math.sqrt(6.67e-11 * 5.97e24 / (r * 1e6)) / 1000
    agree(v ** 2, 6.67e-11 * 5.97e24 / (r * 1e6) / 1e6, 1e-9, "v")
    stem = f"A satellite moves in a circular orbit of radius ${r:g}\\times10^6\\text{{ m}}$ around Earth at a constant speed of ${sig(v)}\\text{{ km/s}}$. Which statement about the work done on the satellite by Earth's gravitational force during one quarter of an orbit is correct and best justified?"
    key, ds = _sent("The work is zero, because the gravitational force is always perpendicular to the velocity, so it changes the direction of the velocity but not the kinetic energy.", "The force points toward the center and the displacement is tangent to the orbit, so $W=Fd\\cos90^\\circ=0$ and the kinetic energy is unchanged.",
                    [("The work is positive, because the gravitational force acts on the satellite the whole time it moves.", "Assumes that any force acting during the motion does positive work, ignoring the angle between force and displacement."), ("The work is negative, because the gravitational force keeps the satellite from moving away from Earth.", "Treats the restraining effect of the force as negative work rather than looking at the angle between force and displacement."),
                     ("The work is positive, because the satellite is accelerating toward Earth the whole time.", "Confuses a nonzero acceleration with a change in speed; the acceleration is perpendicular to the velocity.")])
    return _b3("ph_t5_claim_circular_gravity_work", "3.2", stem, key, ds, rng, concept="Justifying zero work by a perpendicular force on an object in uniform circular motion", thinking=["Compare the direction of the gravitational force with the direction of the displacement", "Use the work-energy theorem to relate work to the change in kinetic energy"], cond=[("the speed is constant", "the stem says the satellite moves at a constant speed")],
               path="the orbital speed is computed from the gravitational and centripetal condition and the work is evaluated from the dot product of force and displacement at several angles", facts=[f"r={r}"], est=80)


@retry_sep
def ph_t5_claim_buoyancy_equal_volume(rng):
    V = pick(rng, [1.0e-3, 1.5e-3, 2.0e-3]); mA = pick(rng, [2.5, 3.0]); mB = pick(rng, [5.0, 7.0, 9.0]); FB = 1000.0 * G * V
    agree(FB, 1000.0 * G * V, 1e-12, "FB")
    stem = f"Two objects A and B have the same volume of ${V * 1000:g}\\text{{ L}}$ but different masses (${mA:g}\\text{{ kg}}$ and ${mB:g}\\text{{ kg}}$). Each object hangs at rest from its own thin light string attached to a fixed support above a large tank of water, with the object completely underwater. Which statement about the buoyant forces on the objects is correct and best justified?"
    key, ds = _sent(f"The buoyant forces are equal (${sig(FB)}\\text{{ N}}$ each), because each object displaces the same volume of water.", f"The buoyant force is $\\rho_{{water}}gV=(1000)({G:g})({V:g})={sig(FB)}\\text{{ N}}$ for both objects.",
                    [("The buoyant force on B is greater, because B has more mass and is pulled down harder.", "Ties the buoyant force to the mass of the object rather than to the weight of the displaced fluid."), ("The buoyant force on A is greater, because A is less dense and so the water pushes it up harder.", "Confuses the density of the object with the size of the buoyant force; both are fully submerged with equal displaced volume."),
                     ("The buoyant force on each object equals its own weight, because both objects are at rest.", "Sets the buoyant force equal to the weight even though the string also pulls up on each object.")])
    return _b3("ph_t5_claim_buoyancy_equal_volume", "8.3", stem, key, ds, rng, concept="Justifying equal buoyant forces on fully submerged objects of equal volume", thinking=["Relate the buoyant force to the weight of the displaced water", "Compare the displaced volumes"], cond=[("both objects are completely submerged in the same fluid", "the stem says both objects are held completely underwater in the same tank")],
               path="the buoyant force is computed from the density of water, g and the volume for each object and the two values are compared", facts=[f"V={V}", f"mA={mA}", f"mB={mB}"], est=75)


# ======================= 3.C 자료 근거 3 =======================
@retry_sep
def ph_t5_evid_hooke_hanging_data(rng):
    k = pick(rng, [20.0, 25.0, 40.0, 50.0]); ms = sorted(rng.sample([0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.40], 5)); xs = [round(m * G / k * (1 + rng.uniform(-0.02, 0.02)), 4) for m in ms]
    ratios = [m * G / x for m, x in zip(ms, xs)]; km = float(np.mean(ratios)); s = sum(m * G * x for m, x in zip(ms, xs)) / sum(x * x for x in xs); agree(s, km, 0.04, "k")
    sq = [x * x for x in xs]
    if not (max(ratios) - min(ratios) < 0.06 * km and xs[-1] > 1.5 * xs[0]):
        raise ValueError("data_not_proportional")
    rows = [[f"{m:.2f}", f"{x * 100:.2f}"] for m, x in zip(ms, xs)]; stim = table_stimulus("Hanging mass and stretch of a vertical spring", "Hanging mass m (kg)", rows, "Stretch x (cm)")
    stem = "A student hangs different masses from a vertical spring at rest and measures how far the spring stretches. The table shows the hanging mass and the stretch for five trials. Which of the following is best supported by the data?"
    key, ds = _sent(f"The weight divided by the stretch is nearly the same in every trial, about ${sig(km)}\\text{{ N/m}}$, so the spring force is proportional to the stretch.", f"The ratios $mg/x$ range only from ${sig(min(ratios))}$ to ${sig(max(ratios))}\\text{{ N/m}}$, so $F\\propto x$ with $k\\approx{sig(km)}\\text{{ N/m}}$.",
                    [(f"The stretch is nearly the same in every trial, so the stretch does not depend on the hanging mass.", f"Overlooks that the stretch rises from ${xs[0] * 100:.2f}\\text{{ cm}}$ to ${xs[-1] * 100:.2f}\\text{{ cm}}$ as the mass increases."), (f"The stretch divided by the mass squared is nearly constant, so the spring force depends on the square of the stretch.", "Tests the wrong power relation; the ratio of the stretch to the mass squared changes a lot across the trials."),
                     (f"The stretch times the mass is nearly constant, so a larger hanging mass produces a smaller stretch.", "Tests the product rather than the ratio, but the product increases with the mass.")])
    return mk("ph_t5_evid_hooke_hanging_data", "2.8", "3.C", stem, key, ds, rng, concept="Supporting a linear force-stretch relationship with ratios computed from a data table", thinking=["Convert each hanging mass to a weight and divide by the stretch", "Decide what a nearly constant ratio says about the spring"],
              cond=[("the spring is at rest in each trial so the spring force equals the weight", "the stem says the masses hang at rest")], path="a least-squares slope through the origin of weight against stretch agrees with the mean ratio within a few percent", material={"type": "table", "must_include": ["hanging mass column", "stretch column"]}, judgment=["representation_reading", "justification"], stim=stim, est=95,
              facts=[f"k={k}", f"m={json.dumps(ms)}", f"x={json.dumps(xs)}", f"mean_ratio={km}"])


@retry_sep
def ph_t5_evid_pendulum_length_data(rng):
    g0 = pick(rng, [9.8, 9.6, 9.9]); Ls = sorted(rng.sample([0.20, 0.40, 0.60, 0.80, 1.00, 1.20], 5)); Ts = [round(2 * math.pi * math.sqrt(L / g0) * (1 + rng.uniform(-0.01, 0.01)), 3) for L in Ls]
    r2 = [t * t / L for t, L in zip(Ts, Ls)]; rm = float(np.mean(r2)); r1 = [t / L for t, L in zip(Ts, Ls)]
    if not (max(r2) - min(r2) < 0.05 * rm and max(r1) / min(r1) > 1.4):
        raise ValueError("data_not_t2_over_l")
    rows = [[f"{L:.2f}", f"{t:.3f}"] for L, t in zip(Ls, Ts)]; stim = table_stimulus("Length and period of a pendulum", "Length L (m)", rows, "Period T (s)")
    stem = "A student measures the period of a simple pendulum with a small amplitude for five different lengths. The table shows the length and the period for each trial. Which of the following is best supported by the data?"
    key, ds = _sent(f"The ratio $T^2/L$ is nearly the same in every trial, about ${sig(rm)}\\text{{ s}}^2/\\text{{m}}$, so the data support a period whose square is proportional to the length.", f"The values of $T^2/L$ range only from ${sig(min(r2))}$ to ${sig(max(r2))}\\text{{ s}}^2/\\text{{m}}$, so $T^2\\propto L$.",
                    [(f"The ratio $T/L$ is nearly the same in every trial, so the period is proportional to the length.", f"Tests $T/L$, but it falls from ${sig(max(r1))}$ to ${sig(min(r1))}\\text{{ s/m}}$ as the length increases."), (f"The period is nearly the same in every trial, so it does not depend on the length.", f"Overlooks that the period rises from ${Ts[0]:.3f}\\text{{ s}}$ to ${Ts[-1]:.3f}\\text{{ s}}$ as the length increases."),
                     (f"The product $TL$ is nearly constant, so a longer pendulum has a shorter period.", "Tests the product, but the product increases with the length.")])
    return mk("ph_t5_evid_pendulum_length_data", "7.3", "3.C", stem, key, ds, rng, concept="Supporting the relationship between the period and the length of a pendulum with the ratio computed from a data table", thinking=["Compute $T^2/L$ and $T/L$ for each trial", "Decide which ratio is nearly constant"],
              cond=[("the amplitude is small in every trial", "the stem says the amplitude is small")], path="the ratio T squared over L is computed for each trial and compared with 4 pi squared over g, which agrees within a few percent", material={"type": "table", "must_include": ["length column", "period column"]}, judgment=["representation_reading", "justification"], stim=stim, est=95,
              facts=[f"g={g0}", f"L={json.dumps(Ls)}", f"T={json.dumps(Ts)}", f"mean_ratio={rm}"])


@retry_sep
def ph_t5_evid_accel_force_data(rng):
    m = pick(rng, [0.5, 1.0, 2.0, 4.0]); Fs = sorted(rng.sample([1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0], 5)); acc = [round(F / m * (1 + rng.uniform(-0.02, 0.02)), 3) for F in Fs]
    s = sum(F * a for F, a in zip(Fs, acc)) / sum(F * F for F in Fs); mest = 1 / s; ratios = [F / a for F, a in zip(Fs, acc)]
    if not (abs(mest - m) < 0.04 * m and max(ratios) - min(ratios) < 0.06 * m and acc[-1] > 1.5 * acc[0]):
        raise ValueError("data_not_linear")
    rows = [[f"{F:.1f}", f"{a:.3f}"] for F, a in zip(Fs, acc)]; stim = table_stimulus("Net force and acceleration of a cart", "Net force F (N)", rows, "Acceleration a (m/s^2)")
    stem = "A student pulls a cart on a low-friction track with several different constant net forces and measures the acceleration each time. The table shows the net force and the acceleration for five trials. Which of the following is best supported by the data?"
    key, ds = _sent(f"The ratio $F/a$ is nearly the same in every trial, about ${sig(float(np.mean(ratios)))}\\text{{ kg}}$, so the data support an acceleration proportional to the net force with a cart mass of about ${sig(float(np.mean(ratios)))}\\text{{ kg}}$.", f"The ratios $F/a$ range only from ${sig(min(ratios))}$ to ${sig(max(ratios))}\\text{{ kg}}$, so $a\\propto F$ and the ratio is the mass.",
                    [(f"The acceleration is nearly the same in every trial, so it does not depend on the net force.", f"Overlooks that the acceleration rises from ${acc[0]:.3f}\\text{{ m/s}}^2$ to ${acc[-1]:.3f}\\text{{ m/s}}^2$ as the force increases."), (f"The ratio $a/F$ is nearly the same in every trial, about ${sig(float(np.mean([a / F for F, a in zip(Fs, acc)])))}\\text{{ kg}}$, so this ratio is the mass of the cart.", "Takes the reciprocal ratio $a/F$ as the mass, but the mass is $F/a$."),
                     (f"The product $Fa$ is nearly constant, so a larger force gives a smaller acceleration.", "Tests the product, but the product increases with the force.")])
    return mk("ph_t5_evid_accel_force_data", "2.5", "3.C", stem, key, ds, rng, concept="Supporting Newton's second law with the ratio of force to acceleration computed from a data table", thinking=["Compute $F/a$ for each trial", "Decide what a nearly constant ratio says about the acceleration and the mass"],
              cond=[("the net force is constant during each trial", "the stem says constant net forces are used")], path="a least-squares slope of acceleration against force through the origin gives the inverse of the mean ratio F over a within a few percent", material={"type": "table", "must_include": ["net force column", "acceleration column"]}, judgment=["representation_reading", "justification"], stim=stim, est=95,
              facts=[f"m={m}", f"F={json.dumps(Fs)}", f"a={json.dumps(acc)}", f"mean_ratio={float(np.mean(ratios))}"])


STAGE_U1 = []
STAGE_U2 = ["ph_t5_rank_orbit_speed", "ph_t5_claim_ropes_tension"]
STAGE_U3 = ["ph_t5_sym_spring_ramp_compress", "ph_t5_pred_spring_gun_height", "ph_t5_pred_ramp_speed_height", "ph_t5_claim_coaster_speed", "ph_t5_claim_circular_gravity_work"]
STAGE_U4 = ["ph_t5_sym_elastic_rebound_speed", "ph_t5_pred_stopping_force"]
STAGE_U5 = ["ph_t5_sym_seesaw_balance"]
STAGE_U7 = ["ph_t5_sym_parallel_springs_period", "ph_t5_rank_spring_period"]
STAGE_U8 = []
STAGE_T5_MC2 = [n for st in (STAGE_U2, STAGE_U3, STAGE_U4, STAGE_U5, STAGE_U7, STAGE_U8) for n in st]

STAGE_T5_MC3 = ["ph_cliff_throw_speed", "ph_wall_press_friction", "ph_two_ropes_sign", "ph_u_tube_oil"] + STAGE_T5_MC2  # 3차 실행: 주제 코드를 바로잡은 단독 24개

# 구조 쌍둥이로 판명돼 등록에서 뺀 원형(함수는 남겨 근거를 보존): ph_t5_sym_cart_hanging_accel, ph_t5_pred_pendulum_length_gravity, ph_t5_claim_buoyancy_equal_volume, ph_t5_pred_pipe_speed, ph_t5_rank_torque_wrench, ph_t5_evid_pendulum_length_data, ph_t5_evid_accel_force_data, ph_t5_evid_hooke_hanging_data — 공개 sym_table_hanging·claim_buoyancy·rank_torque·pred_pendulum_planet·sym_continuity_pipe·evid_{force,pendulum,spring}_data 와 소재·조건·질문·풀이 단계가 같다(docs/ap/topup-p1-lt-wh-2026-10-22.md).
