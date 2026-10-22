"""AP Physics 1 — PH5 스킬 균형 2차 보충 13개(2026-10-22): 공개 PH1~PH4 와 구조가 겹치지 않는 소재로 2.A 3 · 2.C 2 · 2.D 2 · 3.B 3 · 3.C 3.
phys_p0_t5b 의 일부 원형이 공개 원형과 같은 구조(쌍둥이)로 판명돼 빼면서 생긴 부족분을 채운다(sym_table_hanging↔cart_hanging, claim_buoyancy↔buoyancy_equal_volume, evid_* 3종, rank_torque, pred_pendulum_planet, sym_continuity_pipe)."""
import json
from phys_common import *
from common import table_stimulus
from phys_sym import tex_eval, sym_opts, rank_opts
from phys_p0_f import _a2, _c2, _rank_loop, LBL
from phys_p0_g import _d2, _b3


def _sent(key_text, key_why, wrongs):
    return sentence_options(key_text, key_why, wrongs)


# ======================= 2.A 3 =======================
@retry_sep
def ph_t5_sym_block_ramp_friction_speed(rng):
    d = pick(rng, [2.0, 3.0, 4.0]); th = pick(rng, [25, 30, 35, 40]); mu = pick(rng, [0.10, 0.15, 0.20, 0.25]); thr = math.radians(th)
    a = G * (math.sin(thr) - mu * math.cos(thr)); v = math.sqrt(2 * a * d)
    # 독립: 경사를 따라 가속도 a 로 거리 d 만큼 가는 운동을 RK4 로 적분해 속력을 잰다
    y = np.array([0.0, 0.0]); t = 0.0; dt = 1e-4
    while y[0] < d:
        prv = y.copy(); y = rk4(lambda tt, s: np.array([s[1], a]), y, t, t + dt, 1); t += dt
    fr = (d - prv[0]) / (y[0] - prv[0]); agree(v, prv[1] + (y[1] - prv[1]) * fr, 3e-3, "v")
    env = {"g": G, "d": d, "theta": thr, "mu": mu}
    wrongs = [("Ignores friction.", r"\sqrt{2gd\sin\theta}"), ("Adds the friction term instead of subtracting it.", r"\sqrt{2gd\left(\sin\theta+\mu\cos\theta\right)}"), ("Swaps the sine and the cosine of the angle.", r"\sqrt{2gd\left(\cos\theta-\mu\sin\theta\right)}"), ("Leaves out the square root.", r"2gd\left(\sin\theta-\mu\cos\theta\right)")]
    key, ds = sym_opts(r"\sqrt{2gd\left(\sin\theta-\mu\cos\theta\right)}", v, wrongs, env)
    stem = "A block of mass $m$ is released from rest at the top of an incline that makes an angle $\\theta$ with the horizontal. The coefficient of kinetic friction between the block and the incline is $\\mu$. Which of the following is the speed of the block after it has slid a distance $d$ down the incline?"
    return _a2("ph_t5_sym_block_ramp_friction_speed", "3.4", stem, key, ds, rng, kwhy=r"The net force along the incline is $mg\sin\theta-\mu mg\cos\theta$, so $a=g(\sin\theta-\mu\cos\theta)$ and $v=\sqrt{2ad}$ (or the work-energy theorem $mgd\sin\theta-\mu mg\cos\theta\,d=\tfrac12mv^2$).", concept="Speed after sliding a distance down a rough incline from the work-energy theorem", thinking=["Find the work done by gravity and by kinetic friction over the distance $d$", "Set the net work equal to the kinetic energy gained and solve for $v$"],
               cond=[("the block starts from rest and slides without leaving the incline", "the stem says the block is released from rest at the top of the incline")], path="an RK4 integration of the motion along the incline with the net acceleration measures the speed after the distance and the printed option is evaluated by a TeX evaluator", facts=[f"d={d}", f"theta={th}", f"mu={mu}"], est=95)


@retry_sep
def ph_t5_sym_ballistic_pendulum(rng):
    m = pick(rng, [0.01, 0.02, 0.05]); M = pick(rng, [1.0, 2.0, 3.0]); vb = pick(rng, [100.0, 150.0, 200.0, 300.0]); h = (m * vb / (m + M)) ** 2 / (2 * G); env = {"m": m, "M": M, "g": G, "h": h}
    agree(vb, (m + M) / m * math.sqrt(2 * G * h), 1e-9, "v")
    wrongs = [("Ignores the momentum transfer and uses only the energy of the block, $\\sqrt{2gh}$.", r"\sqrt{2gh}"), ("Inverts the mass ratio.", r"\frac{m}{m+M}\sqrt{2gh}"), ("Leaves out the square root.", r"\frac{m+M}{m}2gh"), ("Uses only the mass of the block in the momentum equation.", r"\frac{M}{m}\sqrt{2gh}")]
    key, ds = sym_opts(r"\frac{m+M}{m}\sqrt{2gh}", vb, wrongs, env)
    stem = "A bullet of mass $m$ is fired horizontally into a block of mass $M$ that hangs at rest from a light string and embeds in the block. The block and bullet swing up together to a maximum height $h$ above the starting position. Which of the following is the speed of the bullet just before it hits the block?"
    return _a2("ph_t5_sym_ballistic_pendulum", "4.4", stem, key, ds, rng, kwhy=r"Momentum is conserved in the collision, $mv=(m+M)V$, and energy is conserved during the swing, $V=\sqrt{2gh}$, so $v=\dfrac{m+M}{m}\sqrt{2gh}$.", concept="Speed of a bullet from the height reached by a ballistic pendulum", thinking=["Use conservation of momentum for the collision", "Use conservation of energy for the swing to relate the speed after the collision to the height"],
               cond=[("the collision is perfectly inelastic and the swing is frictionless", "the stem says the bullet embeds in the block and the block swings up on a light string")], path="the height is computed forward from the bullet speed with momentum and energy conservation, and the printed option is evaluated by a TeX evaluator to recover the speed", facts=[f"m={m}", f"M={M}", f"v={vb}"], est=100)


@retry_sep
def ph_t5_sym_drop_onto_spring(rng):
    m = pick(rng, [0.5, 1.0, 2.0]); h = pick(rng, [0.3, 0.5, 0.8]); k = pick(rng, [200.0, 400.0, 800.0]); env = {"m": m, "g": G, "h": h, "k": k}
    x = (m * G + math.sqrt((m * G) ** 2 + 2 * k * m * G * h)) / k; agree(x, bisect(lambda z: 0.5 * k * z * z - m * G * z - m * G * h, 0, 10), 1e-9, "x")
    wrongs = [("Forgets that the block keeps falling while it compresses the spring: $mgh=\\tfrac12kx^2$.", r"\sqrt{\frac{2mgh}{k}}"), ("Balances only the weight with the spring force, $kx=mg$.", r"\frac{mg}{k}"),
              ("Takes the other root of the quadratic, which subtracts $mg$.", r"\frac{-mg+\sqrt{m^2g^2+2kmgh}}{k}"), ("Leaves out the factor of two under the square root.", r"\frac{mg+\sqrt{m^2g^2+kmgh}}{k}")]
    key, ds = sym_opts(r"\frac{mg+\sqrt{m^2g^2+2kmgh}}{k}", x, wrongs, env)
    stem = "A block of mass $m$ is released from rest at a height $h$ above the free end of a light vertical spring of spring constant $k$ that stands on the floor. The block falls onto the spring and compresses it. Which of the following is the maximum compression of the spring?"
    return _a2("3.4", stem, key, ds, rng, kwhy=r"Energy is conserved from release to the lowest point: $mg(h+x)=\tfrac12kx^2$, a quadratic whose positive root is $x=\dfrac{mg+\sqrt{m^2g^2+2kmgh}}{k}$.", concept="Maximum compression of a vertical spring when a block is dropped onto it from a height", thinking=["Include the further drop of the block during the compression in the gravitational energy lost", "Solve the quadratic from $mg(h+x)=\\tfrac12kx^2$ and keep the positive root"],
               cond=[("the spring is light, the block starts from rest and no energy is lost", "the stem gives a light spring and a block released from rest")], path="a bisection root finder on the energy equation recomputes the compression and the printed option is evaluated by a TeX evaluator", facts=[f"m={m}", f"h={h}", f"k={k}"], est=105)


# ======================= 2.C 2 =======================
def ph_t5_rank_projectile_range(rng):
    def make(r):
        vs = r.sample([10.0, 12.0, 15.0, 18.0, 20.0], 4); th = r.sample([15, 30, 45, 60, 75], 4)
        vals = {L: vs[i] ** 2 * math.sin(math.radians(2 * th[i])) / G for i, L in enumerate(LBL)}
        wr = [("Ranks by the launch speed alone.", {L: vs[i] for i, L in enumerate(LBL)}), ("Ranks by the launch angle alone, as if a steeper launch always goes farther.", {L: float(th[i]) for i, L in enumerate(LBL)}),
              ("Ranks by the maximum height, $v^2\\sin^2\\theta/2g$, instead of the range.", {L: vs[i] ** 2 * math.sin(math.radians(th[i])) ** 2 / (2 * G) for i, L in enumerate(LBL)}), ("Ranks by $v^2\\cos\\theta$, treating the horizontal speed times the speed as the range.", {L: vs[i] ** 2 * math.cos(math.radians(th[i])) for i, L in enumerate(LBL)})]
        return (vs, th), vals, wr
    (vs, th), vals, key, ds, order, _ = _rank_loop(rng, make)
    ex = sorted(LBL, key=lambda L: -(vs[LBL.index(L)] ** 2 * math.sin(math.radians(2 * th[LBL.index(L)])))); assert ex == order, "rank_path_mismatch"
    rows = "; ".join(f"{L}: ${vs[i]:g}\\text{{ m/s}}$ at ${th[i]}^\\circ$" for i, L in enumerate(LBL))
    stem = f"Four balls are launched from level ground (launch speed, angle above the horizontal): {rows}. Air resistance is negligible. Rank the horizontal distances traveled before landing at the launch level from greatest to least."
    st = ", ".join(f"{L}: {sig(vals[L])} m" for L in LBL); key.why = f"The range is $v^2\\sin2\\theta/g$, so the ranges are {st}, which ranks as {key.text}."
    return _c2("ph_t5_rank_projectile_range", "1.5", stem, key, ds, rng, kwhy=None, concept="Ranking the ranges of four projectiles launched with different speeds and angles", thinking=["Use $R=v^2\\sin2\\theta/g$ for each launch", "Order the four ranges"], cond=[("each ball lands at the launch level and air resistance is negligible", "the stem says the balls are launched from level ground and air resistance is negligible")],
               path="the range is computed from the closed-form expression and the ordering is checked against the same expression evaluated with exact trigonometric identities of the doubled angle", facts=[f"v={json.dumps(vs)}", f"theta={json.dumps(th)}"], est=90)


def ph_t5_rank_buoyant_force(rng):
    FL = {"alcohol": 800.0, "water": 1000.0, "brine": 1200.0, "glycerin": 1260.0}
    def make(r):
        fl = r.sample(list(FL), 4); Vs = r.sample([100.0, 150.0, 200.0, 250.0, 300.0], 4); ms = r.sample([0.3, 0.5, 0.8, 1.2, 2.0], 4)
        vals = {L: FL[fl[i]] * Vs[i] * 1e-6 * G for i, L in enumerate(LBL)}
        wr = [("Ranks by the volume of the object alone.", {L: Vs[i] for i, L in enumerate(LBL)}), ("Ranks by the density of the fluid alone.", {L: FL[fl[i]] for i, L in enumerate(LBL)}), ("Ranks by the mass of the object, as if a heavier object gets a larger buoyant force.", {L: ms[i] for i, L in enumerate(LBL)}), ("Ranks by the weight of the object minus nothing, $mg/V$, the object's density.", {L: ms[i] / Vs[i] for i, L in enumerate(LBL)})]
        return (fl, Vs, ms), vals, wr
    (fl, Vs, ms), vals, key, ds, order, _ = _rank_loop(rng, make)
    ex = sorted(LBL, key=lambda L: -(Fr(str(FL[fl[LBL.index(L)]])) * Fr(str(Vs[LBL.index(L)])))); assert ex == order, "rank_path_mismatch"
    rows = "; ".join(f"{L}: ${ms[i]:g}\\text{{ kg}}$, ${Vs[i]:g}\\text{{ cm}}^3$, in {fl[i]} (${FL[fl[i]]:g}\\text{{ kg/m}}^3$)" for i, L in enumerate(LBL))
    stem = f"Four solid objects are each completely submerged and held at rest in a different liquid (mass, volume, liquid and its density): {rows}. Rank the magnitudes of the buoyant forces on the objects from greatest to least."
    st = ", ".join(f"{L}: {sig(vals[L])} N" for L in LBL); key.why = f"The buoyant force is $\\rho_{{fluid}}Vg$, so the forces are {st}, which ranks as {key.text}."
    return _c2("ph_t5_rank_buoyant_force", "8.3", stem, key, ds, rng, kwhy=None, concept="Ranking the buoyant forces on submerged objects from the fluid density and the displaced volume", thinking=["Use $F_B=\\rho_{fluid}Vg$ with the volume converted to cubic meters", "Order the four forces"], cond=[("each object is completely submerged", "the stem says each object is completely submerged")],
               path="exact fractions of the density times the volume are sorted and compared with the floating-point ordering", facts=[f"fluid={json.dumps(fl)}", f"V={json.dumps(Vs)}", f"m={json.dumps(ms)}"], est=85)


# ======================= 2.D 2 =======================
@retry_sep
def ph_t5_pred_power_speed(rng):
    f = pick(rng, [2, 3, 4]); v1 = pick(rng, [10.0, 15.0, 20.0, 25.0]); F1 = pick(rng, [800.0, 1000.0, 1200.0]); P = F1 * v1; v2 = P / (f * F1); agree(v2, v1 / f, 1e-12, "v2")
    pairs = [("Multiplies the speed by the factor for the resistive force.", v1 * f), ("Divides the speed by the square of the factor.", v1 / f ** 2), ("Keeps the speed the same because the power is the same.", v1), ("Divides the speed by the square root of the factor.", v1 / math.sqrt(f))]
    fm = lambda v: f"${sig(v)}\\text{{ m/s}}$"  # noqa: E731
    key, ds = num_opts(v2, pairs, fmt=fm)
    stem = f"A truck cruises at a constant speed of ${v1:g}\\text{{ m/s}}$ on a level road while its engine delivers a constant power. The total resistive force on the truck is ${F1:g}\\text{{ N}}$. On a rougher stretch of road the total resistive force is ${f}$ times as great, and the engine delivers the same power. What is the best prediction of the constant speed of the truck on the rougher road?"
    return _d2("ph_t5_pred_power_speed", "3.5", stem, key, ds, rng, kwhy=f"At constant speed the engine force equals the resistive force, so $P=Fv$. With the same power, $v_2=P/F_2={sig(v1)}/{f}={sig(v2)}\\text{{ m/s}}$.", concept="Predicting the cruising speed from constant power and a changed resistive force", thinking=["Write the power as force times speed with the engine force equal to the resistive force", "Keep the power fixed and apply the factor for the resistive force"],
               cond=[("the truck moves at a constant speed on a level road", "the stem says the truck cruises at a constant speed on a level road")], path="the power is computed from the force and speed on the first road and divided by the larger force to give the new speed", facts=[f"f={f}", f"v1={v1}", f"F1={F1}"], est=75)


@retry_sep
def ph_t5_pred_shm_max_speed(rng):
    fA = pick(rng, [2, 3]); fm = pick(rng, [2, 4, 9]); A = pick(rng, [0.05, 0.10, 0.20]); m = pick(rng, [0.2, 0.5, 1.0]); k = pick(rng, [20.0, 50.0, 80.0]); v1 = A * math.sqrt(k / m); v2 = fA * A * math.sqrt(k / (fm * m)); fac = v2 / v1; agree(fac, fA / math.sqrt(fm), 1e-12, "fac")
    pairs = [("Scales the speed with the amplitude factor only.", v1 * fA), ("Multiplies by the amplitude factor and by the square root of the mass factor.", v1 * fA * math.sqrt(fm)), ("Divides by the mass factor instead of its square root.", v1 * fA / fm), ("Multiplies by the amplitude factor and by the mass factor.", v1 * fA * fm)]
    fmt = lambda v: f"${sig(v)}\\text{{ m/s}}$"  # noqa: E731
    key, ds = num_opts(v2, pairs, fmt=fmt)
    stem = f"A block of mass ${m:g}\\text{{ kg}}$ oscillates on a horizontal frictionless surface at the end of a spring of spring constant ${k:g}\\text{{ N/m}}$ with an amplitude of ${A * 100:g}\\text{{ cm}}$. Its maximum speed is ${sig(v1)}\\text{{ m/s}}$. The block is replaced by one with ${fm}$ times the mass and set oscillating on the same spring with ${fA}$ times the amplitude. What is the best prediction of the new maximum speed?"
    return _d2("ph_t5_pred_shm_max_speed", "7.4", stem, key, ds, rng, kwhy=f"Energy conservation gives $\\tfrac12kA^2=\\tfrac12mv_{{max}}^2$, so $v_{{max}}=A\\sqrt{{k/m}}$ and the new speed is ${sig(v1)}\\times{fA}/\\sqrt{{{fm}}}={sig(v2)}\\text{{ m/s}}$.", concept="Predicting the maximum speed of a mass-spring oscillator when the amplitude and the mass change", thinking=["Write the maximum speed from the conservation of energy as $A\\sqrt{k/m}$", "Apply the amplitude factor in the numerator and the square root of the mass factor in the denominator"],
               cond=[("the spring and the surface are ideal", "the stem gives a horizontal frictionless surface and the same spring")], path="the maximum speeds for the two oscillators are computed from the energy equation and their ratio is compared with the combined scaling factor", facts=[f"fA={fA}", f"fm={fm}", f"A={A}", f"m={m}", f"k={k}"], est=80)


# ======================= 3.B 3 =======================
@retry_sep
def ph_t5_claim_rolling_race(rng):
    pairs_ = [(("solid disk", 0.5), ("hoop", 1.0)), (("solid sphere", 0.4), ("solid disk", 0.5)), (("solid sphere", 0.4), ("hoop", 1.0))]
    (n1, k1), (n2, k2) = pick(rng, pairs_); h = pick(rng, [0.5, 1.0, 1.5, 2.0]); v1 = math.sqrt(2 * G * h / (1 + k1)); v2 = math.sqrt(2 * G * h / (1 + k2))
    agree(v1 ** 2 * (1 + k1), v2 ** 2 * (1 + k2), 1e-9, "energy")
    stem = f"A {n1} and a {n2}, with the same mass and radius, are released from rest at the same time at the top of an incline of height ${h:g}\\text{{ m}}$. Both roll without slipping. Which statement about the objects at the bottom of the incline is correct and best justified?"
    key, ds = _sent(f"The {n1} is moving faster (${sig(v1)}\\text{{ m/s}}$ compared with ${sig(v2)}\\text{{ m/s}}$) because it has the smaller rotational inertia, so a smaller share of the same energy lost by gravity goes into rotation.", f"With $mgh=\\tfrac12mv^2(1+I/mR^2)$ the speed is $\\sqrt{{2gh/(1+k)}}$ with $k={k1:g}$ for the {n1} and $k={k2:g}$ for the {n2}.",
                    [(f"The {n2} is moving faster, because its larger rotational inertia gives it more energy at the bottom.", "Thinks a larger rotational inertia gives more total energy; the total energy is the same for both objects."), (f"The two objects are moving at the same speed, because they have the same mass, radius and starting height.", "Assumes that the same mass and height give the same speed, ignoring that the energy is shared between rotation and translation differently."),
                     (f"The {n1} is moving faster, because it has the larger rotational inertia and so more energy is available for translation.", "Reverses the effect of the rotational inertia on the share of energy in translation.")])
    return _b3("ph_t5_claim_rolling_race", "6.5", stem, key, ds, rng, concept="Justifying which rolling object is faster from the share of energy that goes into rotation", thinking=["Write the energy conservation including the rotational kinetic energy", "Compare the share of the energy that stays in translation for the two shapes"], cond=[("both objects roll without slipping from the same height", "the stem says both roll without slipping from rest at the top of the same incline")],
               path="the speeds are computed from energy conservation with the rotational inertia factors and compared", facts=[f"k1={k1}", f"k2={k2}", f"h={h}"], est=90)


@retry_sep
def ph_t5_claim_container_pressure(rng):
    h = pick(rng, [0.3, 0.4, 0.5, 0.6]); rho = pick(rng, [800.0, 1000.0, 1200.0]); P0 = 101.3e3; P = P0 + rho * G * h
    agree(P, P0 + rho * G * h, 1e-12, "P")
    stem = f"Three open containers have different shapes: a wide cylinder, a narrow tube, and a container that widens toward the top. Each is filled with the same liquid (density ${rho:g}\\text{{ kg/m}}^3$) to the same depth of ${h:g}\\text{{ m}}$ and rests on a table. The surrounding air pressure is $101.3\\text{{ kPa}}$. Which statement about the pressure at the bottom of the containers is correct and best justified?"
    key, ds = _sent(f"The pressure at the bottom is the same in all three containers, ${sig(P / 1000)}\\text{{ kPa}}$, because it depends only on the depth and density of the liquid and the air pressure above it, not on the shape or the amount of liquid.", f"$P=P_0+\\rho gh=101.3\\text{{ kPa}}+({rho:g})({G:g})({h:g})={sig(P / 1000)}\\text{{ kPa}}$ for every container.",
                    [("The pressure is greatest in the wide cylinder, because it holds the most liquid and the liquid there weighs the most.", "Confuses the total weight of the liquid with the pressure, which depends on the depth."), ("The pressure is greatest in the narrow tube, because the same force is spread over a smaller area.", "Applies the idea that pressure is force over area to the base area instead of using the depth and density of the liquid."),
                     ("The pressure is greatest in the container that widens toward the top, because there is more liquid above the sides.", "Uses the amount of liquid above the sides rather than the depth of the liquid above the bottom.")])
    return _b3("ph_t5_claim_container_pressure", "8.2", stem, key, ds, rng, concept="Justifying equal bottom pressure in open containers of different shapes filled to the same depth", thinking=["Write the pressure at depth $h$ as $P_0+\\rho gh$", "Compare the depth and the density in the three containers"], cond=[("the liquid is at rest and the containers are open to the air", "the stem says the containers are open and the liquid has the same density and depth")],
               path="the bottom pressure is computed from the air pressure plus the hydrostatic term with the same depth and density and is the same for all three shapes", facts=[f"h={h}", f"rho={rho}"], est=85)


@retry_sep
def ph_t5_claim_com_explosion(rng):
    R = pick(rng, [20.0, 24.0, 30.0, 36.0]); M = pick(rng, [2.0, 3.0, 4.0]); m1 = pick(rng, [0.5, 1.0, 1.5]); x1 = pick(rng, [R + 6.0, R + 8.0, R - 8.0, R - 10.0]); m2 = M - m1; x2 = (M * R - m1 * x1) / m2
    agree(m1 * x1 + m2 * x2, M * R, 1e-9, "com")
    if x2 <= 0 or abs(x2 - R) < 2:
        raise ValueError("bad_position")
    stem = f"A ${M:g}\\text{{ kg}}$ firework shell is launched from level ground and would land ${R:g}\\text{{ m}}$ from the launch point if it did not explode. At the top of its path the shell explodes into two fragments of masses ${m1:g}\\text{{ kg}}$ and ${m2:g}\\text{{ kg}}$. Both fragments land on the ground at the same time. The ${m1:g}\\text{{ kg}}$ fragment lands ${x1:g}\\text{{ m}}$ from the launch point. Air resistance is negligible. Which statement about the other fragment is correct and best justified?"
    key, ds = _sent(f"The ${m2:g}\\text{{ kg}}$ fragment lands ${sig(x2)}\\text{{ m}}$ from the launch point, because the explosion forces are internal, so the center of mass of the two fragments still lands ${R:g}\\text{{ m}}$ from the launch point.", f"The center of mass lands at ${R:g}\\text{{ m}}$: $({m1:g})({x1:g})+({m2:g})x_2=({M:g})({R:g})$, so $x_2={sig(x2)}\\text{{ m}}$.",
                    [(f"The ${m2:g}\\text{{ kg}}$ fragment lands ${R:g}\\text{{ m}}$ from the launch point, because the shell was headed there before the explosion.", "Assumes that each fragment follows the original path, ignoring that the internal forces change the fragment trajectories while keeping the center of mass path."), (f"The ${m2:g}\\text{{ kg}}$ fragment lands ${sig(2 * R - x1)}\\text{{ m}}$ from the launch point, because the two fragments land symmetrically about ${R:g}\\text{{ m}}$.", "Uses a symmetric landing distance without weighting by the masses."),
                     (f"The position of the second fragment cannot be found, because the explosion forces are unknown.", "Thinks the explosion forces must be known, but they are internal forces that do not change the motion of the center of mass.")])
    return _b3("ph_t5_claim_com_explosion", "2.1", stem, key, ds, rng, concept="Justifying the landing point of a fragment from the unchanged motion of the center of mass", thinking=["Recognize that the explosion forces are internal to the system", "Use the weighted average of the landing positions equal to the landing point of the unexploded shell"], cond=[("both fragments land at the same time and air resistance is negligible", "the stem says both fragments land at the same time and air resistance is negligible")],
               path="the center-of-mass equation is solved for the second landing position and the weighted average of the two landing positions is recomputed to match the unexploded range", facts=[f"R={R}", f"M={M}", f"m1={m1}", f"x1={x1}"], est=95)


# ======================= 3.C 3 =======================
@retry_sep
def ph_t5_evid_pressure_depth_data(rng):
    rho = pick(rng, [800.0, 1000.0, 1200.0]); P0 = 101.3; hs = sorted(rng.sample([0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0], 5)); Ps = [round(P0 + rho * G * h / 1000 * (1 + rng.uniform(-0.005, 0.005)), 1) for h in hs]
    dd = [(P - P0) / h for P, h in zip(Ps, hs)]; dm = float(np.mean(dd)); pr = [P / h for P, h in zip(Ps, hs)]
    if not (max(dd) - min(dd) < 0.05 * dm and max(pr) / min(pr) > 1.5):
        raise ValueError("data_not_hydrostatic")
    rows = [[f"{h:.1f}", f"{P:.1f}"] for h, P in zip(hs, Ps)]; stim = table_stimulus("Depth and absolute pressure in a liquid", "Depth h (m)", rows, "Absolute pressure P (kPa)")
    stem = "A student lowers a pressure sensor to different depths in a deep tank of liquid that is open to the air and records the absolute pressure at each depth. The table shows the depth and the absolute pressure for five trials. Which of the following is best supported by the data?"
    key, ds = _sent(f"The pressure rises by about ${sig(dm)}\\text{{ kPa}}$ for each meter of depth in every trial, so the pressure increases linearly with depth.", f"The values of $(P-101.3)/h$ range only from ${sig(min(dd))}$ to ${sig(max(dd))}\\text{{ kPa/m}}$, so $P=P_0+\\rho gh$ with $\\rho g\\approx{sig(dm)}\\text{{ kPa/m}}$.",
                    [(f"The ratio $P/h$ is nearly the same in every trial, so the absolute pressure is proportional to the depth of the sensor.", f"Tests $P/h$, but it falls from ${sig(max(pr))}$ to ${sig(min(pr))}\\text{{ kPa/m}}$ because the air pressure at the surface is part of every reading."), (f"The pressure is nearly the same at every depth, so the pressure does not depend on the depth of the sensor.", f"Overlooks that the pressure rises from ${Ps[0]:.1f}\\text{{ kPa}}$ to ${Ps[-1]:.1f}\\text{{ kPa}}$ as the depth increases."),
                     (f"The product $Ph$ is nearly constant, so a deeper sensor reads a lower absolute pressure in the liquid.", "Tests the product, but the product increases with the depth.")])
    return mk("ph_t5_evid_pressure_depth_data", "8.2", "3.C", stem, key, ds, rng, concept="Supporting the linear increase of pressure with depth from data that include the surface pressure", thinking=["Subtract the surface pressure and divide by the depth for each trial", "Decide which ratio is nearly constant and what that says about the relationship"],
              cond=[("the liquid is at rest and open to the air", "the stem says the tank is open to the air and the liquid is deep")], path="the slope of pressure against depth from the normal equations agrees with the mean of the increases divided by the depth, and P/h is not constant", material={"type": "table", "must_include": ["depth column", "absolute pressure column"]}, judgment=["representation_reading", "justification"], stim=stim, est=100,
              facts=[f"rho={rho}", f"h={json.dumps(hs)}", f"P={json.dumps(Ps)}", f"mean_increase={dm}"])


@retry_sep
def ph_t5_evid_centripetal_speed_data(rng):
    m = pick(rng, [0.20, 0.25, 0.40]); r = pick(rng, [0.50, 0.80, 1.0]); vs = sorted(rng.sample([1.0, 1.5, 2.0, 2.5, 3.0, 4.0], 5)); Fs = [round(m * v * v / r * (1 + rng.uniform(-0.02, 0.02)), 3) for v in vs]
    q = [F / (v * v) for F, v in zip(Fs, vs)]; qm = float(np.mean(q)); l = [F / v for F, v in zip(Fs, vs)]
    if not (max(q) - min(q) < 0.06 * qm and max(l) / min(l) > 1.6):
        raise ValueError("data_not_quadratic")
    rows = [[f"{v:.1f}", f"{F:.3f}"] for v, F in zip(vs, Fs)]; stim = table_stimulus("Speed and string tension for a ball in a horizontal circle", "Speed v (m/s)", rows, "Tension F (N)")
    stem = f"A student whirls a ball of mass ${m:g}\\text{{ kg}}$ on a string in a horizontal circle of fixed radius ${r:g}\\text{{ m}}$ at several different constant speeds and measures the tension in the string each time. The table shows the speed and the tension for five trials. Which of the following is best supported by the data?"
    key, ds = _sent(f"The ratio $F/v^2$ is nearly the same in every trial, about ${sig(qm)}\\text{{ N s}}^2/\\text{{m}}^2$, so the tension is proportional to the square of the speed.", f"The values of $F/v^2$ range only from ${sig(min(q))}$ to ${sig(max(q))}\\text{{ N s}}^2/\\text{{m}}^2$, so $F\\propto v^2$ (as in $F=mv^2/r$).",
                    [(f"The ratio $F/v$ is nearly the same in every trial, so the tension is proportional to the speed.", f"Tests $F/v$, but it rises from ${sig(min(l))}$ to ${sig(max(l))}\\text{{ N s/m}}$ as the speed increases."), (f"The tension is nearly the same in every trial, so it does not depend on the speed.", f"Overlooks that the tension rises from ${Fs[0]:.3f}\\text{{ N}}$ to ${Fs[-1]:.3f}\\text{{ N}}$ as the speed increases."),
                     (f"The product $Fv$ is nearly constant, so a faster ball needs less tension.", "Tests the product, but the product increases with the speed.")])
    return mk("ph_t5_evid_centripetal_speed_data", "2.9", "3.C", stem, key, ds, rng, concept="Supporting the dependence of the centripetal force on the square of the speed with ratios computed from a data table", thinking=["Compute $F/v^2$ and $F/v$ for each trial", "Decide which ratio is nearly constant"],
              cond=[("the radius and the mass are fixed and the circle is horizontal", "the stem says the radius is fixed and the ball moves in a horizontal circle")], path="the ratio F over v squared is computed for each trial and compared with m over r, which agrees within a few percent", material={"type": "table", "must_include": ["speed column", "tension column"]}, judgment=["representation_reading", "justification"], stim=stim, est=100,
              facts=[f"m={m}", f"r={r}", f"v={json.dumps(vs)}", f"F={json.dumps(Fs)}", f"mean_ratio={qm}"])


@retry_sep
def ph_t5_evid_range_speed_data(rng):
    th = pick(rng, [30, 40, 45, 60]); vs = sorted(rng.sample([6.0, 8.0, 10.0, 12.0, 14.0, 16.0], 5)); Rs = [round(v * v * math.sin(math.radians(2 * th)) / G * (1 + rng.uniform(-0.02, 0.02)), 2) for v in vs]
    q = [R / (v * v) for R, v in zip(Rs, vs)]; qm = float(np.mean(q)); l = [R / v for R, v in zip(Rs, vs)]
    if not (max(q) - min(q) < 0.06 * qm and max(l) / min(l) > 1.8):
        raise ValueError("data_not_quadratic")
    rows = [[f"{v:.1f}", f"{R:.2f}"] for v, R in zip(vs, Rs)]; stim = table_stimulus("Launch speed and range of a ball", "Launch speed v (m/s)", rows, "Range R (m)")
    stem = f"A student launches a ball from level ground at a fixed angle of ${th}^\\circ$ above the horizontal with several different speeds and measures the horizontal distance traveled before the ball lands at the launch level. The table shows the speed and the range for five trials. Which of the following is best supported by the data?"
    key, ds = _sent(f"The ratio $R/v^2$ is nearly the same in every trial, about ${sig(qm)}\\text{{ s}}^2/\\text{{m}}$, so the range is proportional to the square of the launch speed.", f"The values of $R/v^2$ range only from ${sig(min(q))}$ to ${sig(max(q))}\\text{{ s}}^2/\\text{{m}}$, so $R\\propto v^2$ at a fixed angle.",
                    [(f"The ratio $R/v$ is nearly the same in every trial, so the range is proportional to the launch speed.", f"Tests $R/v$, but it rises from ${sig(min(l))}$ to ${sig(max(l))}\\text{{ s}}$ as the speed increases."), (f"The range is nearly the same in every trial, so it does not depend on the launch speed.", f"Overlooks that the range rises from ${Rs[0]:.2f}\\text{{ m}}$ to ${Rs[-1]:.2f}\\text{{ m}}$ as the speed increases."),
                     (f"The product $Rv$ is nearly constant, so a faster launch gives a shorter range.", "Tests the product, but the product increases with the speed.")])
    return mk("ph_t5_evid_range_speed_data", "1.5", "3.C", stem, key, ds, rng, concept="Supporting the dependence of the range of a projectile on the square of the launch speed with ratios computed from a data table", thinking=["Compute $R/v^2$ and $R/v$ for each trial", "Decide which ratio is nearly constant"],
              cond=[("the launch angle is fixed and the ball lands at the launch level", "the stem says the angle is fixed and the ball lands at the launch level")], path="the ratio R over v squared is computed for each trial and compared with sin of twice the angle over g, which agrees within a few percent", material={"type": "table", "must_include": ["launch speed column", "range column"]}, judgment=["representation_reading", "justification"], stim=stim, est=100,
              facts=[f"theta={th}", f"v={json.dumps(vs)}", f"R={json.dumps(Rs)}", f"mean_ratio={qm}"])


# ======================= 2.A / 2.D 추가(스킬 균형 마지막 칸) =======================
@retry_sep
def ph_t5_sym_stacked_blocks_friction(rng):
    m = pick(rng, [1.0, 2.0, 3.0]); M = pick(rng, [2.0, 4.0, 5.0]); F = pick(rng, [12.0, 15.0, 20.0, 30.0]); env = {"m": m, "M": M, "F": F}
    f = m * F / (M + m)
    A = np.array([[M + m, 0.0], [0.0, 1.0]]); a_ = F / (M + m); fn = float(np.linalg.solve(np.array([[1.0]]), np.array([m * a_]))[0]); agree(f, fn, 1e-9, "f")
    wrongs = [("Swaps the masses in the numerator and uses the mass of the lower block.", r"\frac{MF}{M+m}"), ("Gives the acceleration of the blocks instead of the friction force.", r"\frac{F}{M+m}"),
              ("Assumes that the friction force on the upper block equals the whole applied force.", r"F"), ("Divides by the mass of the lower block only, as if the upper block did not accelerate with it.", r"\frac{mF}{M}")]
    key, ds = sym_opts(r"\frac{mF}{M+m}", f, wrongs, env)
    stem = "A block of mass $m$ rests on top of a block of mass $M$, which rests on a horizontal frictionless table. A horizontal force of magnitude $F$ pushes the lower block, and the upper block does not slip on it. Which of the following is the magnitude of the friction force that the lower block exerts on the upper block?"
    return _a2("ph_t5_sym_stacked_blocks_friction", "2.7", stem, key, ds, rng, kwhy=r"Both blocks have the acceleration $a=F/(M+m)$. The only horizontal force on the upper block is static friction, so $f=ma=\dfrac{mF}{M+m}$.", concept="Static friction force on the upper block of two stacked blocks that accelerate together", thinking=["Find the common acceleration of the two blocks from Newton's second law for the system", "Apply Newton's second law to the upper block, whose only horizontal force is friction"],
               cond=[("the upper block does not slip and the table is frictionless", "the stem says the upper block does not slip and the table is frictionless")], path="a linear solve of the two Newton equations gives the friction force and the printed option is evaluated by a TeX evaluator", facts=[f"m={m}", f"M={M}", f"F={F}"], est=90)


@retry_sep
def ph_t5_pred_rolling_speed_scaling(rng):
    fh = pick(rng, [2, 4, 9]); fm = pick(rng, [2, 3]); fR = pick(rng, [2, 3]); h = pick(rng, [0.5, 1.0, 1.5]); k = 0.4
    v1 = math.sqrt(2 * G * h / (1 + k)); v2 = math.sqrt(2 * G * fh * h / (1 + k)); agree(v2 / v1, math.sqrt(fh), 1e-12, "fac")
    pairs = [("Scales the speed with the height factor to the first power.", v1 * fh), ("Includes the factor for the mass, as if a heavier sphere rolls faster.", v1 * math.sqrt(fh * fm)), ("Includes the factor for the radius, as if a larger sphere rolls faster.", v1 * math.sqrt(fh) * fR), ("Leaves the speed unchanged because the mass and radius changed.", v1)]
    fmt = lambda v: f"${sig(v)}\\text{{ m/s}}$"  # noqa: E731
    key, ds = num_opts(v2, pairs, fmt=fmt)
    stem = f"A solid sphere rolls without slipping from rest down an incline from a height of ${h:g}\\text{{ m}}$ and reaches the bottom with a speed of ${sig(v1)}\\text{{ m/s}}$. A second solid sphere with ${fm}$ times the mass and ${fR}$ times the radius rolls without slipping from rest down the same incline from a height ${fh}$ times as great. What is the best prediction of the speed of the second sphere at the bottom?"
    return _d2("ph_t5_pred_rolling_speed_scaling", "6.5", stem, key, ds, rng, kwhy=f"For a solid sphere $mgh=\\tfrac12mv^2+\\tfrac12\\left(\\tfrac25mR^2\\right)\\omega^2$ gives $v=\\sqrt{{10gh/7}}$, which does not depend on the mass or the radius, so $v\\propto\\sqrt{{h}}$: ${sig(v1)}\\text{{ m/s}}\\times\\sqrt{{{fh}}}={sig(v2)}\\text{{ m/s}}$.", concept="Predicting the speed of a rolling sphere at the bottom of an incline when the mass, the radius and the height change", thinking=["Write energy conservation with translational and rotational kinetic energy for a solid sphere", "Notice that the mass and the radius cancel and the speed scales with the square root of the height"],
               cond=[("both spheres are uniform solid spheres that roll without slipping", "the stem says both spheres are solid and roll without slipping")], path="the speeds are computed from energy conservation with the rotational inertia factor and their ratio is compared with the square root of the height factor", facts=[f"fh={fh}", f"fm={fm}", f"fR={fR}", f"h={h}"], est=85)


# ======================= 마지막 3개(정수계획으로 구한 최소 부족분: 2.C 단원 5, 2.D 단원 4, 3.B 단원 8) =======================
def ph_t5_rank_rim_tangential_accel(rng):
    def make(r):
        al = r.sample([2.0, 3.0, 4.0, 5.0, 6.0], 4); rs = r.sample([0.10, 0.20, 0.30, 0.40, 0.50], 4)
        vals = {L: al[i] * rs[i] for i, L in enumerate(LBL)}
        wr = [("Ranks by the angular acceleration alone.", {L: al[i] for i, L in enumerate(LBL)}), ("Ranks by the radius alone.", {L: rs[i] for i, L in enumerate(LBL)}),
              ("Ranks by $\\alpha/r$, dividing by the radius instead of multiplying.", {L: al[i] / rs[i] for i, L in enumerate(LBL)}), ("Ranks by $\\alpha r^2$.", {L: al[i] * rs[i] ** 2 for i, L in enumerate(LBL)})]
        return (al, rs), vals, wr
    (al, rs), vals, key, ds, order, _ = _rank_loop(rng, make)
    ex = sorted(LBL, key=lambda L: -(Fr(str(al[LBL.index(L)])) * Fr(str(rs[LBL.index(L)])))); assert ex == order, "rank_path_mismatch"
    rows = "; ".join(f"{L}: angular acceleration ${al[i]:g}\\text{{ rad/s}}^2$, radius ${rs[i]:.2f}\\text{{ m}}$" for i, L in enumerate(LBL))
    stem = f"Four wheels each speed up from rest with a constant angular acceleration (angular acceleration, radius of the wheel): {rows}. Rank the magnitudes of the tangential acceleration of a point on the rim of each wheel from greatest to least."
    st = ", ".join(f"{L}: {sig(vals[L])} m/s$^2$" for L in LBL); key.why = f"The tangential acceleration is $a_t=\\alpha r$, so the values are {st}, which ranks as {key.text}."
    return _c2("ph_t5_rank_rim_tangential_accel", "5.2", stem, key, ds, rng, kwhy=None, concept="Ranking the tangential accelerations of rim points of wheels from the angular acceleration and the radius", thinking=["Connect the tangential acceleration to the angular acceleration with $a_t=\\alpha r$", "Order the four products"], cond=[("the wheels speed up with constant angular acceleration", "the stem says each wheel speeds up from rest with a constant angular acceleration")],
               path="exact fractions of the product of the angular acceleration and the radius are sorted and compared with the floating-point ordering", facts=[f"alpha={json.dumps(al)}", f"r={json.dumps(rs)}"], est=75)


@retry_sep
def ph_t5_pred_cart_split_energy(rng):
    f = pick(rng, [2, 3, 4]); m = pick(rng, [0.5, 1.0, 2.0]); E = pick(rng, [4.0, 6.0, 8.0, 12.0])
    share1 = 1 / 2; share2 = f / (1 + f)
    # 독립: 운동량 보존 m v1 = f m v2 와 에너지 합 E 를 연립해 가벼운 카트의 운동 에너지를 구한다
    v2 = math.sqrt(2 * E / (f * m * (1 + f))); v1 = f * v2; K1 = 0.5 * m * v1 ** 2; agree(K1, E * f / (1 + f), 1e-9, "K1")
    Ek1 = E * share1; Ek2 = E * share2
    pairs = [("Gives the lighter cart the same share as before, ignoring the larger mass of the other cart.", Ek1), ("Gives the lighter cart the inverse share, $E/(1+f)$.", E / (1 + f)), ("Divides the energy in proportion to the masses in the wrong direction, $E\\cdot f/2$.", E * f / 2 if E * f / 2 < E else None), ("Gives all of the energy to the lighter cart.", E)]
    fm = lambda v: f"${sig(v)}\\text{{ J}}$"  # noqa: E731
    key, ds = num_opts(Ek2, pairs, fmt=fm)
    stem = f"Two carts of equal mass ${m:g}\\text{{ kg}}$ at rest on a frictionless track are pushed apart by a compressed spring between them. The spring releases a total of ${E:g}\\text{{ J}}$ of energy, which becomes kinetic energy of the carts, and the carts have equal kinetic energy because their masses are equal: ${sig(E * share1)}\\text{{ J}}$ each. In a second trial one of the carts is replaced by a cart with ${f}$ times the mass, and the spring releases the same ${E:g}\\text{{ J}}$. What is the best prediction of the kinetic energy of the lighter cart in the second trial?"
    return _d2("ph_t5_pred_cart_split_energy", "4.3", stem, key, ds, rng, kwhy=f"Momentum is conserved, so $mv_1=({f}m)v_2$ and $v_1={f}v_2$. The kinetic energies are in the ratio $K_1:K_2={f}:1$, so the lighter cart has the fraction ${f}/({f}+1)$ of ${E:g}\\text{{ J}}$, which is ${sig(Ek2)}\\text{{ J}}$.", concept="Predicting how the released energy is shared between two carts of different mass pushed apart by a spring", thinking=["Use conservation of momentum to relate the two speeds", "Find the ratio of the kinetic energies and apply it to the total energy"],
               cond=[("the carts start at rest on a frictionless track and all of the spring energy becomes kinetic energy", "the stem says the carts start at rest on a frictionless track and the spring energy becomes kinetic energy")], path="the speeds are found by solving the momentum and energy equations together and the kinetic energy of the lighter cart is compared with the closed-form fraction", facts=[f"f={f}", f"m={m}", f"E={E}"], est=90)


@retry_sep
def ph_t5_claim_hydraulic_work(rng):
    A1 = pick(rng, [2.0, 4.0, 5.0]); fa = pick(rng, [10, 20, 25]); A2 = A1 * fa; F1 = pick(rng, [20.0, 30.0, 40.0]); d1 = pick(rng, [0.20, 0.30, 0.50]); F2 = F1 * fa; d2 = d1 / fa; W1 = F1 * d1; W2 = F2 * d2
    agree(W1, W2, 1e-9, "work")
    stem = f"In a hydraulic lift a small piston of area ${A1:g}\\text{{ cm}}^2$ is pushed down with a force of ${F1:g}\\text{{ N}}$ through a distance of ${d1:g}\\text{{ m}}$. The incompressible fluid transmits the pressure to a large piston of area ${A2:g}\\text{{ cm}}^2$. Friction is negligible. Which statement about the work done on the small piston and by the fluid on the large piston is correct and best justified?"
    key, ds = _sent(f"The work is the same for both pistons, ${sig(W1)}\\text{{ J}}$, because the large piston gets a force ${fa}$ times as great but moves only $1/{fa}$ of the distance, so the force and distance changes cancel.", f"The pressure is equal, so $F_2={F2:g}\\text{{ N}}$; the fluid volume is conserved, so $d_2=d_1/{fa}={sig(d2)}\\text{{ m}}$; then $W_2=F_2d_2={sig(W2)}\\text{{ J}}=W_1$.",
                    [(f"The work done on the large piston is ${fa}$ times as great, because the force on it is ${fa}$ times as great.", "Multiplies the work by the force factor without noticing that the large piston moves a proportionally smaller distance."), (f"The work done on the small piston is ${fa}$ times as great, because the small piston must be pushed with more pressure.", "Confuses the pressure in the fluid with the force; the pressure is the same on both pistons."),
                     (f"The work done on the large piston is less than the work done on the small piston, because the fluid loses energy transmitting the force.", "Assumes that energy is lost in the fluid even though friction is negligible and the fluid is incompressible.")])
    return _b3("ph_t5_claim_hydraulic_work", "8.4", stem, key, ds, rng, concept="Justifying equal work on the two pistons of a hydraulic lift from conservation of fluid volume", thinking=["Use equal pressure to find the force on the large piston and conservation of volume to find the distance it moves", "Compare the work on the two pistons"], cond=[("the fluid is incompressible and friction is negligible", "the stem says the fluid is incompressible and friction is negligible")],
               path="the force and the distance on the large piston are computed from the area ratio and the work on the two pistons is compared numerically", facts=[f"A1={A1}", f"fa={fa}", f"F1={F1}", f"d1={d1}"], est=90)


@retry_sep
def ph_t5_claim_same_torque_two_wheels(rng):
    pairs_ = [(("solid disk", 0.5), ("hoop", 1.0)), (("solid sphere", 0.4), ("solid disk", 0.5)), (("solid sphere", 0.4), ("hoop", 1.0))]
    (n1, k1), (n2, k2) = pick(rng, pairs_); M = pick(rng, [2.0, 3.0, 4.0]); R = pick(rng, [0.20, 0.30, 0.40]); tau = pick(rng, [1.0, 2.0, 3.0]); t = pick(rng, [4.0, 5.0, 6.0])
    I1 = k1 * M * R ** 2; I2 = k2 * M * R ** 2; w1 = tau * t / I1; w2 = tau * t / I2
    agree(w1 * I1, w2 * I2, 1e-9, "L")
    stem = f"A {n1} and a {n2}, each of mass ${M:g}\\text{{ kg}}$ and radius ${R:g}\\text{{ m}}$, are mounted on identical frictionless axles through their centers and start from rest. The same constant torque of ${tau:g}\\text{{ N m}}$ is applied to each for ${t:g}\\text{{ s}}$. Which statement about the angular speeds after ${t:g}\\text{{ s}}$ is correct and best justified?"
    key, ds = _sent(f"The {n1} is spinning faster (${sig(w1)}\\text{{ rad/s}}$ compared with ${sig(w2)}\\text{{ rad/s}}$), because the same torque gives a larger angular acceleration to the object with the smaller rotational inertia.", f"The angular acceleration is $\\alpha=\\tau/I$ with $I={sig(I1)}\\text{{ kg m}}^2$ for the {n1} and ${sig(I2)}\\text{{ kg m}}^2$ for the {n2}, so $\\omega=\\alpha t$ is larger for the {n1}.",
                    [(f"The {n2} is spinning faster, because it has the larger rotational inertia and so it stores more rotational energy.", "Confuses a larger rotational inertia with a larger angular speed; the same torque gives it a smaller angular acceleration."), (f"The two objects are spinning at the same speed, because they have the same mass, the same radius and the same torque.", "Overlooks that the rotational inertia also depends on how the mass is distributed."),
                     (f"The {n1} is spinning faster, because the torque acts for a longer time on it.", "Invents a different time of action; the torque acts on both objects for the same time.")])
    return _b3("ph_t5_claim_same_torque_two_wheels", "5.6", stem, key, ds, rng, concept="Justifying which of two objects spins faster under the same torque from their rotational inertias", thinking=["Use $\\alpha=\\tau/I$ for each object with its rotational inertia", "Find the angular speed from the angular acceleration and the time"], cond=[("the torque is constant and the objects start from rest", "the stem says the same constant torque acts on objects that start from rest")],
               path="the angular speeds are computed from the torque, the rotational inertia and the time, and the angular momentum gained is the same for both objects", facts=[f"k1={k1}", f"k2={k2}", f"M={M}", f"R={R}", f"tau={tau}", f"t={t}"], est=90)


STAGE_U1 = ["ph_t5_rank_projectile_range", "ph_t5_evid_range_speed_data"]
STAGE_U2 = ["ph_t5_claim_com_explosion", "ph_t5_evid_centripetal_speed_data", "ph_t5_sym_stacked_blocks_friction"]
STAGE_U3 = ["ph_t5_sym_block_ramp_friction_speed", "ph_t5_pred_power_speed"]
STAGE_U4 = ["ph_t5_sym_ballistic_pendulum", "ph_t5_pred_cart_split_energy"]
STAGE_U5 = ["ph_t5_rank_rim_tangential_accel", "ph_t5_claim_same_torque_two_wheels"]
STAGE_U6 = ["ph_t5_claim_rolling_race", "ph_t5_pred_rolling_speed_scaling"]
STAGE_U7 = ["ph_t5_pred_shm_max_speed"]
STAGE_U8 = ["ph_t5_rank_buoyant_force", "ph_t5_claim_container_pressure", "ph_t5_evid_pressure_depth_data", "ph_t5_claim_hydraulic_work"]
STAGE_T5_MC4 = [n for st in (STAGE_U1, STAGE_U2, STAGE_U3, STAGE_U4, STAGE_U6, STAGE_U7, STAGE_U8) for n in st]
STAGE_T5_MC5 = ["ph_t5_sym_stacked_blocks_friction", "ph_t5_pred_rolling_speed_scaling"]  # 마지막 보충(2.A·2.D 각 1 가족)
STAGE_T5_MC6 = ["ph_t5_rank_rim_tangential_accel", "ph_t5_pred_cart_split_energy", "ph_t5_claim_hydraulic_work"]  # 정수계획으로 구한 최소 부족분 3개
STAGE_T5_MC7 = ["ph_t5_pred_cart_split_energy"]  # 7차: 오답 설명과 값 일치 수정
STAGE_T5_MC8 = ["ph_t5_claim_same_torque_two_wheels"]  # 8차: 유닛 5 마지막 1칸(3.B)
