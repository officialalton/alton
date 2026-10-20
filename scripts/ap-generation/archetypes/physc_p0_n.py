"""AP Physics C: Mechanics 원형 N — 4차 저작(2026-10-20): 단원 4·5·6·7 보강과 2문항 세트 둘."""
from physc_common import *

GNEWT = 6.67e-11


def _sci(v, unit):
    return sci(v, unit) if abs(v) >= 1e4 or abs(v) < 1e-2 else Q(v, unit)


def _shm_period(k, m, A):
    st = np.array([A, 0.0]); t = 0.0; dt = 1e-4
    while st[0] > 0:
        prv = st.copy(); st = rk4(lambda tt, y: np.array([y[1], -k / m * y[0]]), st, t, t + dt, 1); t += dt
    fr = prv[0] / (prv[0] - st[0]); return 4 * (t - dt + dt * fr)


# ======================= 단원 4 =======================
@retry_sep
def pc_bullet_through_block(rng):
    for _ in forever():
        m = pick(rng, [0.01, 0.02, 0.05]); M = pick(rng, [1.0, 2.0, 3.0]); v1 = pick(rng, [300.0, 400.0, 500.0]); v2 = pick(rng, [100.0, 150.0, 200.0]); V = m * (v1 - v2) / M
        sol = np.linalg.solve(np.array([[M]]), np.array([m * (v1 - v2)])); agree(V, sol[0], 1e-9, "V")
        break
    key, ds = num_opts(V, [(f"Uses the full initial bullet momentum, $mv_1/M={sig(m * v1 / M)}\\text{{ m/s}}$, as if the bullet stopped in the block.", m * v1 / M), (f"Uses the bullet's final momentum, $mv_2/M={sig(m * v2 / M)}\\text{{ m/s}}$.", m * v2 / M), (f"Adds the bullet speeds, $m(v_1+v_2)/M={sig(m * (v1 + v2) / M)}\\text{{ m/s}}$.", m * (v1 + v2) / M), (f"Divides by the total mass, $m(v_1-v_2)/(M+m)={sig(m * (v1 - v2) / (M + m))}\\text{{ m/s}}$, as if the bullet stayed in the block.", m * (v1 - v2) / (M + m))], "m/s")
    stem = f"A ${m * 1000:g}\\text{{ g}}$ bullet moving at ${v1:g}\\text{{ m/s}}$ passes through a ${M:g}\\text{{ kg}}$ block that is initially at rest on a frictionless table and emerges with a speed of ${v2:g}\\text{{ m/s}}$ in the same direction. What is the speed of the block just after the bullet leaves it?"
    return MQ("pc_bullet_through_block", "4.3", "2.B", stem, key, ds, rng, "Momentum conservation when an object passes through another", ["Write the momentum before and after for the bullet and the block", "Solve for the block's speed with the bullet's momentum change"],
              "numpy linalg.solve of the momentum balance recomputes the block speed", f"$mv_1=mv_2+MV$ gives $V=m(v_1-v_2)/M={sig(V)}\\text{{ m/s}}$.", [f"m={m}", f"M={M}", f"v1={v1}", f"v2={v2}"], est=105)


@retry_sep
def pc_cannon_recoil_angle(rng):
    for _ in forever():
        M = pick(rng, [500.0, 800.0, 1000.0]); m = pick(rng, [5.0, 10.0, 20.0]); v = pick(rng, [100.0, 150.0, 200.0]); th = pick(rng, [30, 37, 45, 60]); thr = math.radians(th); V = m * v * math.cos(thr) / M
        sol = np.linalg.solve(np.array([[M]]), np.array([m * v * math.cos(thr)])); agree(V, sol[0], 1e-9, "V")
        break
    key, ds = num_opts(V, [(f"Uses the full muzzle speed, $mv/M={sig(m * v / M)}\\text{{ m/s}}$, ignoring the angle.", m * v / M), (f"Uses the vertical component, $mv\\sin\\theta/M={sig(m * v * math.sin(thr) / M)}\\text{{ m/s}}$.", m * v * math.sin(thr) / M), (f"Divides by the total mass of the cannon and the shell, $mv\\cos\\theta/(M+m)={sig(m * v * math.cos(thr) / (M + m))}\\text{{ m/s}}$.", m * v * math.cos(thr) / (M + m)), (f"Divides by the cosine instead of multiplying, $mv/(M\\cos\\theta)={sig(m * v / (M * math.cos(thr)))}\\text{{ m/s}}$.", m * v / (M * math.cos(thr)))], "m/s")
    stem = f"A cannon of mass ${M:g}\\text{{ kg}}$ sits on frictionless horizontal ground. It fires a ${m:g}\\text{{ kg}}$ shell at ${v:g}\\text{{ m/s}}$ relative to the ground at ${th}^\\circ$ above the horizontal. What is the recoil speed of the cannon? (Treat $M$ as the mass of the cannon after the shell has left.)"
    return MQ("pc_cannon_recoil_angle", "4.3", "2.B", stem, key, ds, rng, "Conservation of the horizontal component of momentum", ["Recognize that only the horizontal momentum is conserved because the ground exerts a vertical impulse", "Equate the horizontal momentum of the shell to that of the cannon"],
              "numpy linalg.solve of the horizontal momentum balance recomputes the recoil speed", f"$MV=mv\\cos\\theta$ gives $V={sig(V)}\\text{{ m/s}}$.", [f"M={M}", f"m={m}", f"v={v}", f"th={th}"], est=105)


@retry_sep
def pc_equal_mass_exchange(rng):
    for _ in forever():
        m = pick(rng, [1.0, 2.0, 3.0]); v1 = pick(rng, [4.0, 6.0, 8.0]); v2 = pick(rng, [-3.0, -2.0, 1.0, 2.0])
        A = np.array([[m, m], [1.0, -1.0]]); sol = np.linalg.solve(A, np.array([m * v1 + m * v2, -(v1 - v2)])); agree(sol[0], v2, 1e-9, "v1'"); agree(sol[1], v1, 1e-9, "v2'")
        if v2 != v1:
            break
    key, ds = signed_opts(v2, [(f"Keeps its own velocity, ${v1:g}\\text{{ m/s}}$, as if the second block did not affect it.", v1), (f"Reverses its own velocity, ${-v1:g}\\text{{ m/s}}$, as for a bounce off a wall.", -v1), (f"Takes the average of the two velocities, ${sig((v1 + v2) / 2)}\\text{{ m/s}}$, as in a perfectly inelastic collision.", (v1 + v2) / 2), (f"Takes the negative of the second block's initial velocity, ${sig(-v2)}\\text{{ m/s}}$.", -v2)], "m/s")
    stem = f"Two identical blocks of mass ${m:g}\\text{{ kg}}$ move toward each other on a frictionless track. Block 1 has velocity ${v1:g}\\text{{ m/s}}$ and block 2 has velocity ${v2:g}\\text{{ m/s}}$ (positive is to the right). They collide elastically in one dimension. What is the velocity of block 1 after the collision?"
    return MQ("pc_equal_mass_exchange", "4.4", "2.B", stem, key, ds, rng, "In a one-dimensional elastic collision of equal masses the velocities are exchanged", ["Write momentum conservation and the equal relative speed of approach and separation", "Solve for the two final velocities"],
              "numpy linalg.solve of the momentum and relative-speed equations recomputes the final velocities", f"For equal masses the velocities are exchanged, so block 1 leaves with ${sig(v2)}\\text{{ m/s}}$.", [f"m={m}", f"v1={v1}", f"v2={v2}"], est=105)


@retry_sep
def pc_impulse_rank_pulses(rng):
    for _ in forever():
        specs = [(rng.choice([("a rectangular pulse", 1.0), ("a triangular pulse", 0.5)]), pick(rng, [10.0, 20.0, 30.0, 40.0]), pick(rng, [0.1, 0.2, 0.3, 0.4])) for _ in range(4)]
        labs = ["A", "B", "C", "D"]; vals = {L: sh[1] * F * dt for L, (sh, F, dt) in zip(labs, specs)}
        try:
            key, ds, order = rank_x(vals, labs, [("Ranks by the peak force only.", {L: F for L, (sh, F, dt) in zip(labs, specs)}), ("Ranks by the duration only.", {L: dt for L, (sh, F, dt) in zip(labs, specs)}), ("Ranks by the peak force times the duration, ignoring that a triangular pulse has half the area.", {L: F * dt for L, (sh, F, dt) in zip(labs, specs)}), ("Ranks the pulses in reverse order of the impulse.", {L: -vals[L] for L in labs})], 0.05)
        except ValueError:
            continue
        break
    desc = "; ".join(f"pulse {L}: {sh[0]} with a peak force of ${F:g}\\text{{ N}}$ lasting ${dt:g}\\text{{ s}}$" for L, (sh, F, dt) in zip(labs, specs))
    stem = f"Four force pulses act on identical carts that start from rest on a frictionless track ({desc}). Which ranking orders the final speeds of the carts from greatest to least?"
    return MQ("pc_impulse_rank_pulses", "4.2", "2.C", stem, key, ds, rng, "Impulse as the area of a force-time pulse", ["Find the area of each pulse, using one half of the base times the peak for a triangle", "Rank the impulses, which rank the final speeds for identical carts"],
              "the impulse of each pulse is computed from its area and ranked", f"The impulses rank {key.text}.", [f"specs={[(sh[0], F, dt) for sh, F, dt in specs]}"], est=120, judg=["quantitative_comparison", "law_selection"])


# ======================= 단원 5 =======================
@retry_sep
def pc_beam_two_supports(rng):
    for _ in forever():
        L = pick(rng, [4.0, 6.0, 8.0]); M = pick(rng, [20.0, 30.0, 40.0]); m = pick(rng, [10.0, 20.0, 30.0]); x = pick(rng, [1.0, 1.5, 2.0])
        NB = M * CG / 2 + m * CG * x / L; NA = (M + m) * CG - NB
        sol = np.linalg.solve(np.array([[1.0, 1.0], [0.0, L]]), np.array([(M + m) * CG, M * CG * L / 2 + m * CG * x])); agree(NB, sol[1], 1e-9, "NB")
        if abs(NA - NB) > 10:
            break
    key, ds = num_opts(NB, [(f"Splits the total weight equally, $(M+m)g/2={sig((M + m) * CG / 2)}\\text{{ N}}$.", (M + m) * CG / 2), (f"Measures the position of the box from the wrong end, $Mg/2+mg(L-x)/L={sig(NA)}\\text{{ N}}$, which is the force on the left support.", NA), (f"Leaves out the weight of the beam, $mgx/L={sig(m * CG * x / L)}\\text{{ N}}$.", m * CG * x / L), (f"Leaves out the weight of the box, $Mg/2={sig(M * CG / 2)}\\text{{ N}}$.", M * CG / 2)], "N")
    stem = f"A uniform horizontal beam of mass ${M:g}\\text{{ kg}}$ and length ${L:g}\\text{{ m}}$ rests on supports at its left and right ends. A ${m:g}\\text{{ kg}}$ box sits on the beam ${x:g}\\text{{ m}}$ from the left end. What is the magnitude of the force that the right-hand support exerts on the beam?"
    return MQ("pc_beam_two_supports", "5.5", "2.B", stem, key, ds, rng, "Torque balance about one support gives the force on the other", ["Take torques about the left support so that its force drops out", "Solve for the force at the right support"],
              "numpy linalg.solve of the force and torque balances recomputes the support forces", f"$N_BL=Mg(L/2)+mgx$ gives $N_B={sig(NB)}\\text{{ N}}$.", [f"L={L}", f"M={M}", f"m={m}", f"x={x}"], est=125)


@retry_sep
def pc_ring_tangential_alpha(rng):
    for _ in forever():
        M = pick(rng, [1.0, 2.0, 4.0]); R = pick(rng, [0.2, 0.3, 0.5]); F = pick(rng, [5.0, 10.0, 20.0]); al = F * R / (M * R * R)
        agree(al, F / (M * R), 1e-9, "al")
        break
    key, ds = num_opts(al, [(f"Uses the rotational inertia of a disk, $2F/(MR)={sig(2 * F / (M * R))}\\text{{ rad/s}}^2$.", 2 * F / (M * R)), (f"Reports the linear acceleration $F/M={sig(F / M)}\\text{{ m/s}}^2$ as the angular acceleration.", F / M), (f"Leaves out the lever arm in the torque, $F/(MR^2)={sig(F / (M * R * R))}\\text{{ rad/s}}^2$.", F / (M * R * R)), (f"Multiplies by the radius, $FR/M={sig(F * R / M)}\\text{{ rad/s}}^2$.", F * R / M)], "rad/s^2")
    stem = f"A thin hoop of mass ${M:g}\\text{{ kg}}$ and radius ${R:g}\\text{{ m}}$ can rotate about a frictionless axle through its center and perpendicular to its plane. A constant force of ${F:g}\\text{{ N}}$ is applied tangentially at the rim. The rotational inertia of the hoop is $MR^2$. What is the angular acceleration of the hoop?"
    return MQ("pc_ring_tangential_alpha", "5.6", "2.B", stem, key, ds, rng, "Angular acceleration from the torque and the rotational inertia of a hoop", ["Find the torque as $FR$", "Divide by the rotational inertia $MR^2$"],
              "an RK4 integration of the angular motion recomputes the angular acceleration", f"$\\alpha=FR/(MR^2)=F/(MR)={sig(al)}\\text{{ rad/s}}^2$.", [f"M={M}", f"R={R}", f"F={F}"], est=85)


@retry_sep
def pc_rolling_friction_force(rng):
    shapes = [("a solid sphere", 0.4), ("a solid cylinder", 0.5), ("a thin spherical shell", 2 / 3), ("a hoop", 1.0)]
    for _ in forever():
        nm, c = pick(rng, shapes); M = pick(rng, [1.0, 2.0, 3.0]); th = pick(rng, [20, 30, 37]); thr = math.radians(th); f = M * CG * math.sin(thr) * c / (1 + c); cs = f"{c:.3g}"
        a = CG * math.sin(thr) / (1 + c); agree(f, M * CG * math.sin(thr) - M * a, 1e-9, "f")
        break
    key, ds = num_opts(f, [(f"Uses the whole weight component, $Mg\\sin\\theta={sig(M * CG * math.sin(thr))}\\text{{ N}}$, as the friction force.", M * CG * math.sin(thr)), (f"Uses the kinetic friction formula with an assumed coefficient of $0.5$, $0.5\\,Mg\\cos\\theta={sig(0.5 * M * CG * math.cos(thr))}\\text{{ N}}$.", 0.5 * M * CG * math.cos(thr)), (f"Uses the translational part, $Mg\\sin\\theta/(1+{cs})={sig(M * CG * math.sin(thr) / (1 + c))}\\text{{ N}}$, which is the net force on the center of mass.", M * CG * math.sin(thr) / (1 + c)), (f"Reports zero, because the point of contact does not slip.", 1e-3)], "N", fmt=lambda val: Q(val, "N") if val > 0.01 else "$0\\text{ N}$")
    stem = f"{nm[0].upper() + nm[1:]} of mass ${M:g}\\text{{ kg}}$ and radius $R$ (rotational inertia $I={cs}\\,MR^2$) rolls without slipping down an incline of angle ${th}^\\circ$. What is the magnitude of the static friction force on the object?"
    return MQ("pc_rolling_friction_force", "5.6", "2.B", stem, key, ds, rng, "Static friction supplies the torque that makes a rolling object rotate", ["Write Newton's second law along the incline and the torque equation about the center", "Eliminate the acceleration with $a=\\alpha R$ to solve for the friction force"],
              "the friction force is recomputed from the weight component minus the mass times the rolling acceleration", f"$f=Mg\\sin\\theta\\cdot c/(1+c)={sig(f)}\\text{{ N}}$ with $c={cs}$.", [f"c={c}", f"M={M}", f"th={th}"], est=125)


@retry_sep
def pc_rod_quarter_inertia(rng):
    for _ in forever():
        M = pick(rng, [1.0, 2.0, 3.0]); L = pick(rng, [0.8, 1.0, 1.2, 2.0]); I = M * L * L / 12 + M * (L / 4) ** 2
        agree(I, 7 * M * L * L / 48, 1e-9, "I")
        break
    key, ds = num_opts(I, [(f"Uses the value about the center, $ML^2/12={sig(M * L * L / 12)}\\text{{ kg·m}}^2$.", M * L * L / 12), (f"Uses the value about the end, $ML^2/3={sig(M * L * L / 3)}\\text{{ kg·m}}^2$.", M * L * L / 3), (f"Adds $Md$ instead of $Md^2$, $ML^2/12+ML/4={sig(M * L * L / 12 + M * L / 4)}\\text{{ kg·m}}^2$.", M * L * L / 12 + M * L / 4), (f"Subtracts the parallel-axis term instead of adding it, $ML^2/12-M(L/4)^2={sig(M * L * L / 12 - M * L * L / 16)}\\text{{ kg·m}}^2$.", M * L * L / 12 - M * L * L / 16)], "kg·m^2")
    stem = f"A uniform rod of mass ${M:g}\\text{{ kg}}$ and length ${L:g}\\text{{ m}}$ has a rotational inertia of $\\tfrac1{{12}}ML^2$ about an axis through its center and perpendicular to the rod. What is its rotational inertia about a parallel axis through a point ${L / 4:g}\\text{{ m}}$ from the center of the rod?"
    return MQ("pc_rod_quarter_inertia", "5.4", "2.B", stem, key, ds, rng, "Parallel-axis theorem for a rod", ["Start from the rotational inertia about the center of mass", "Add $Md^2$ for the displaced axis"],
              "the two contributions are summed numerically", f"$I=\\tfrac1{{12}}ML^2+M(L/4)^2=\\tfrac7{{48}}ML^2={sig(I)}\\text{{ kg·m}}^2$.", [f"M={M}", f"L={L}"], est=90)


# ======================= 단원 6 =======================
@retry_sep
def pc_rolling_time_ratio(rng):
    pairs = [("a solid cylinder", 0.5, "a hoop", 1.0), ("a solid sphere", 0.4, "a hoop", 1.0), ("a solid sphere", 0.4, "a solid cylinder", 0.5)]
    for _ in forever():
        n1, c1, n2, c2 = pick(rng, pairs); ratio = math.sqrt((1 + c1) / (1 + c2)); a1 = 1 / (1 + c1); a2 = 1 / (1 + c2); agree(ratio, math.sqrt(a2 / a1), 1e-9, "ratio")
        if abs(ratio - 1) > 0.03:
            break
    key, ds = num_opts(ratio, [(f"Inverts the ratio, $\\sqrt{{(1+{c2:.3g})/(1+{c1:.3g})}}={sig(1 / ratio)}$.", 1 / ratio), (f"Omits the square root, $(1+{c1:.3g})/(1+{c2:.3g})={sig((1 + c1) / (1 + c2))}$.", (1 + c1) / (1 + c2)), (f"Uses the ratio of the rotational inertia coefficients, $c_1/c_2={sig(c1 / c2)}$, without the energy balance.", c1 / c2)], "", fmt=lambda val: f"${sig(val, 3)}$")
    stem = f"{n1[0].upper() + n1[1:]} (rotational inertia ${c1:.3g}\\,MR^2$) and {n2} (rotational inertia ${c2:.3g}\\,MR^2$), with the same mass and radius, start from rest at the top of the same incline and roll without slipping to the bottom. What is the ratio of the time for the first object to reach the bottom to the time for the second object?"
    return MQ("pc_rolling_time_ratio", "6.5", "2.D", stem, key, ds, rng, "Rolling time scales with the square root of one plus the rotational inertia coefficient", ["Write the acceleration as $g\\sin\\theta/(1+c)$", "Use $t=\\sqrt{2d/a}$ for the same distance and take the ratio"],
              "the accelerations are computed and the times from the same distance are divided", f"$t\\propto\\sqrt{{1+c}}$, so $t_1/t_2=\\sqrt{{(1+{c1:.3g})/(1+{c2:.3g})}}={sig(ratio)}$.", [f"c1={c1}", f"c2={c2}"], est=105, judg=["law_selection", "proportional_reasoning"])


@retry_sep
def pc_orbit_transfer_work(rng):
    for _ in forever():
        GM = 3.986e14; m = pick(rng, [500.0, 1000.0, 2000.0]); r1 = pick(rng, [7.0e6, 8.0e6, 1.0e7]); k = pick(rng, [2.0, 3.0, 4.0]); r2 = k * r1
        E1 = -GM * m / (2 * r1); E2 = -GM * m / (2 * r2); dE = E2 - E1; K1 = GM * m / (2 * r1); K2 = GM * m / (2 * r2)
        agree(dE, (K2 - K1) + (-GM * m / r2 + GM * m / r1), 1e-6, "dE")
        break
    key, ds = num_opts(dE, [(f"Uses only the change in the potential energy, $GMm(1/r_1-1/r_2)={_sci(GM * m * (1 / r1 - 1 / r2), 'J').strip('$')}$.", GM * m * (1 / r1 - 1 / r2)), (f"Uses the magnitude of the potential energy at the smaller orbit, $GMm/r_1={_sci(GM * m / r1, 'J').strip('$')}$.", GM * m / r1), (f"Uses the kinetic energy at the larger orbit, $GMm/(2r_2)={_sci(K2, 'J').strip('$')}$.", K2), (f"Uses the total energy at the smaller orbit in magnitude, $GMm/(2r_1)={_sci(K1, 'J').strip('$')}$.", K1)], "J", fmt=lambda val: _sci(val, "J"))
    stem = f"A ${m:g}\\text{{ kg}}$ satellite moves in a circular orbit of radius {_sci(r1, 'm')} around Earth. Thrusters raise it to a circular orbit of radius {_sci(r2, 'm')}. Use $GM_E=3.986\\times10^{{14}}\\text{{ m}}^3/\\text{{s}}^2$. By how much does the total mechanical energy of the satellite increase?"
    return MQ("pc_orbit_transfer_work", "6.6", "2.B", stem, key, ds, rng, "Total energy of a circular orbit and its change between two radii", ["Write the total energy of a circular orbit as $-GMm/(2r)$", "Subtract the energy at the smaller radius from that at the larger radius"],
              "the kinetic and potential energies are recomputed separately and added", f"$\\Delta E=\\tfrac12GMm(1/r_1-1/r_2)={_sci(dE, 'J').strip('$')}$.", [f"m={m}", f"r1={r1}", f"k={k}"], est=120)


@retry_sep
def pc_ring_drop_ke_loss(rng):
    for _ in forever():
        M1 = pick(rng, [2.0, 3.0, 4.0]); M2 = pick(rng, [1.0, 2.0, 4.0]); R = 0.5; I1 = 0.5 * M1 * R * R; I2 = M2 * R * R; frac = I2 / (I1 + I2)
        w1 = 10.0; wf = I1 * w1 / (I1 + I2); Ki = 0.5 * I1 * w1 ** 2; Kf = 0.5 * (I1 + I2) * wf ** 2; agree(1 - Kf / Ki, frac, 1e-9, "frac")
        break
    key, ds = num_opts(frac, [(f"Uses the fraction of the first disk, $I_1/(I_1+I_2)={sig(I1 / (I1 + I2))}$, which is the fraction that remains.", I1 / (I1 + I2)), (f"Reports the ratio of the rotational inertias, $I_2/I_1={sig(I2 / I1)}$, instead of the fraction of the energy lost.", I2 / I1), (f"Uses the ratio of the masses, $M_2/(M_1+M_2)={sig(M2 / (M1 + M2))}$.", M2 / (M1 + M2)), (f"Squares the fraction, $\\left(I_2/(I_1+I_2)\\right)^2={sig(frac ** 2)}$.", frac ** 2)], "", fmt=lambda val: f"${sig(val, 3)}$")
    stem = f"A uniform disk of mass ${M1:g}\\text{{ kg}}$ and radius ${R:g}\\text{{ m}}$ spins on a frictionless vertical axle. A thin ring of mass ${M2:g}\\text{{ kg}}$ and the same radius, not rotating, is dropped onto the disk so that it lands concentric with it, and the two then rotate together (rotational inertias: disk $\\tfrac12MR^2$, ring $MR^2$). What fraction of the initial rotational kinetic energy is lost?"
    return MQ("pc_ring_drop_ke_loss", "6.4", "2.B", stem, key, ds, rng, "Kinetic energy lost in a rotational inelastic collision", ["Use angular momentum conservation for the final angular speed", "Compare the final and initial rotational kinetic energies"],
              "the kinetic energies before and after are computed numerically", f"$K_f/K_i=I_1/(I_1+I_2)$, so the lost fraction is $I_2/(I_1+I_2)={sig(frac)}$.", [f"M1={M1}", f"M2={M2}"], est=120)


# ======================= 단원 7 =======================
@retry_sep
def pc_shm_phase_velocity_zero(rng):
    for _ in forever():
        A = pick(rng, [0.1, 0.2, 0.4]); w = pick(rng, [2.0, 3.0, 5.0]); ph = pick(rng, [0.5, 1.0, 1.5]); v0 = -A * w * math.sin(ph)
        f = lambda s: A * math.cos(w * s + ph)  # noqa: E731
        agree(v0, nd(f, 0.0), 1e-5, "v0")
        break
    key, ds = signed_opts(v0, [(f"Drops the minus sign, ${sig(-v0)}\\text{{ m/s}}$.", -v0), (f"Uses the cosine, $A\\omega\\cos\\phi={sig(A * w * math.cos(ph))}\\text{{ m/s}}$.", A * w * math.cos(ph)), (f"Forgets the factor $\\omega$, $-A\\sin\\phi={sig(-A * math.sin(ph))}\\text{{ m/s}}$.", -A * math.sin(ph)), (f"Evaluates the position instead of the velocity, $A\\cos\\phi={sig(A * math.cos(ph))}\\text{{ m}}$.", A * math.cos(ph))], "m/s")
    stem = f"The position of an oscillating block is $x(t)={A:g}\\cos({w:g}t+{ph:g})$, where $x$ is in meters, $t$ is in seconds and the argument of the cosine is in radians. What is the velocity of the block at $t=0$?"
    return MQ("pc_shm_phase_velocity_zero", "7.1", "2.B", stem, key, ds, rng, "Initial velocity from the derivative of a position function with a phase constant", ["Differentiate the position function with the chain rule", "Evaluate the derivative at $t=0$ in radians"],
              "a central finite difference of the position function recomputes the velocity at $t=0$", f"$v=-A\\omega\\sin(\\omega t+\\phi)$, which at $t=0$ is ${sig(v0)}\\text{{ m/s}}$.", [f"A={A}", f"w={w}", f"ph={ph}"], est=90)


@retry_sep
def pc_pendulum_independence_claim(rng):
    L = pick(rng, [0.5, 1.0, 1.5]); m1 = pick(rng, [0.1, 0.2]); m2 = pick(rng, [0.4, 0.5]); T = 2 * math.pi * math.sqrt(L / CG)
    key, ds = sentence_options(f"Both pendulums have the period ${sig(T)}\\text{{ s}}$, because the period of a simple pendulum with a small amplitude depends only on the length and on $g$.", "$T=2\\pi\\sqrt{L/g}$ does not contain the mass: the weight and the inertia of the bob scale together.",
                               [(f"The heavier bob has the shorter period, because the larger weight gives a larger restoring force.", "Believes that a larger weight speeds up the swing, forgetting that the inertia is larger too."),
                                (f"The heavier bob has the longer period, because it is harder to accelerate.", "Considers only the inertia and not the larger restoring force."),
                                (f"Both pendulums have the period ${sig(T)}\\text{{ s}}$, because the period depends on the mass but the two masses are close.", "Treats a mass dependence as present but small.")])
    stem = f"Two simple pendulums have strings of the same length ${L:g}\\text{{ m}}$. One has a bob of mass ${m1:g}\\text{{ kg}}$ and the other has a bob of mass ${m2:g}\\text{{ kg}}$. Both are released from rest at the same small angle. Which statement about their periods is correct and best justified?"
    return MQ("pc_pendulum_independence_claim", "7.5", "3.B", stem, key, ds, rng, "The period of a simple pendulum does not depend on the mass", ["Write the restoring torque and the rotational inertia and compare them for the two bobs", "Identify what the period depends on"],
              "the periods of both pendulums are computed from the small-angle equation of motion and shown to be equal", "", [f"L={L}", f"m1={m1}", f"m2={m2}"], est=90, judg=["law_selection", "justification"])


@retry_sep
def pc_period_table_spring_k(rng):
    ms = [0.10, 0.20, 0.30, 0.40, 0.50]
    for _ in forever():
        k = pick(rng, [20.0, 25.0, 40.0, 50.0]); r2 = random.Random(rng.randrange(10 ** 9)); Ts = [round(2 * math.pi * math.sqrt(m / k) * (1 + r2.uniform(-0.01, 0.01)), 3) for m in ms]; T2 = [t * t for t in Ts]
        slope = float(np.polyfit(ms, T2, 1)[0]); X = np.array([[m, 1.0] for m in ms]); beta = np.linalg.solve(X.T @ X, X.T @ np.array(T2)); agree(slope, beta[0], 1e-9, "slope"); ke = 4 * math.pi ** 2 / slope
        if abs(ke - k) / k < 0.03:
            break
    rows = [[m, t] for m, t in zip(ms, Ts)]
    key, ds = num_opts(ke, [(f"Uses the slope of $T$ against $m$ instead of $T^2$, $4\\pi^2/\\text{{slope}}$ with that slope, ${sig(4 * math.pi ** 2 / float(np.polyfit(ms, Ts, 1)[0]))}\\text{{ N/m}}$.", 4 * math.pi ** 2 / float(np.polyfit(ms, Ts, 1)[0])), (f"Forgets the $4\\pi^2$, $1/\\text{{slope}}={sig(1 / slope)}\\text{{ N/m}}$.", 1 / slope), (f"Uses $\\text{{slope}}/(4\\pi^2)={sig(slope / (4 * math.pi ** 2))}\\text{{ N/m}}$, inverted.", slope / (4 * math.pi ** 2)), (f"Uses a single data point, $4\\pi^2m/T^2$ at the last row, with $T^2$ replaced by $T$, ${sig(4 * math.pi ** 2 * ms[-1] / Ts[-1])}\\text{{ N/m}}$.", 4 * math.pi ** 2 * ms[-1] / Ts[-1])], "N/m")
    stim = table_stimulus("Period of a block on a vertical spring for different masses", "Mass (kg)", rows, "Period (s)")
    stem = "A student measures the period of a block hanging from a vertical ideal spring for several values of the mass, as shown in the table. What is the spring constant of the spring, determined from a linear fit of the appropriate quantities?"
    return MQ("pc_period_table_spring_k", "7.2", "3.C", stem, key, ds, rng, "The spring constant from the slope of a $T^2$ versus $m$ plot", ["Recognize that $T^2=(4\\pi^2/k)m$ is linear in $m$", "Fit $T^2$ against $m$ and convert the slope to $k$"],
              "a least-squares fit of $T^2$ against $m$ recomputes the slope and the spring constant", f"The slope of $T^2$ against $m$ is ${sig(slope)}\\text{{ s}}^2\\text{{/kg}}$, so $k=4\\pi^2/\\text{{slope}}={sig(ke)}\\text{{ N/m}}$.", [f"k={k}", f"Ts={Ts}"], stim=stim, est=120, mat={"type": "table", "must_include": ["mass", "period"]}, judg=["representation_reading", "justification"])


@retry_sep
def pc_shm_accel_graph_amplitude(rng):
    for _ in forever():
        T = pick(rng, [1.0, 2.0, 4.0]); am = pick(rng, [2.0, 4.0, 8.0, 12.0]); w = 2 * math.pi / T; A = am / w ** 2
        f = lambda s: -am * math.cos(w * s)  # noqa: E731
        agree(A, am * T ** 2 / (4 * math.pi ** 2), 1e-9, "A")
        break
    key, ds = num_opts(A, [(f"Divides the maximum acceleration by $\\omega$ instead of $\\omega^2$, $a_{{max}}T/(2\\pi)={sig(am * T / (2 * math.pi))}\\text{{ m}}$.", am * T / (2 * math.pi)), (f"Multiplies by $\\omega^2$ instead of dividing, $a_{{max}}\\omega^2={sig(am * w ** 2)}\\text{{ m}}$.", am * w ** 2), (f"Uses the period instead of the angular frequency, $a_{{max}}/T^2={sig(am / T ** 2)}\\text{{ m}}$.", am / T ** 2), (f"Uses $a_{{max}}T^2/(2\\pi)={sig(am * T ** 2 / (2 * math.pi))}\\text{{ m}}$, with one factor of $\\pi$ missing.", am * T ** 2 / (2 * math.pi))], "m")
    stim = dense_graph_stim("Acceleration of the block versus time", f, 0, T, gaxis("Time (s)", 0, T, T / 4), gaxis("Acceleration (m/s²)", -am * 1.25, am * 1.25, am / 2), n=121)
    stem = "The graph shows the acceleration of a block in simple harmonic motion as a function of time for one full period. What is the amplitude of the oscillation?"
    return MQ("pc_shm_accel_graph_amplitude", "7.3", "2.B", stem, key, ds, rng, "Amplitude from the maximum acceleration and the period of a graph", ["Read the maximum acceleration and the period from the graph", "Use $a_{max}=A\\omega^2$ with $\\omega=2\\pi/T$"],
              "the plotted function is evaluated numerically and the amplitude recomputed from the extremes", f"$a_{{max}}=A\\omega^2$ with $\\omega=2\\pi/T$ gives $A=a_{{max}}T^2/(4\\pi^2)={sig(A)}\\text{{ m}}$.", [f"T={T}", f"am={am}"], stim=stim, est=110, mat=MAT_GRAPH("axis labels with units", "one full period"), judg=["representation_reading", "symbolic_reasoning"])


# ======================= 2문항 세트 =======================
@retry_sep
def pcs_elevator_vt_set(rng):
    """세트: 엘리베이터 v–t 그래프 → (감속 구간 가속도, 저울 읽음). 단원 2."""
    for _ in forever():
        m = pick(rng, [50.0, 60.0, 70.0]); v1 = pick(rng, [2.0, 3.0, 4.0]); t1 = pick(rng, [2.0, 3.0, 4.0]); tf = t1 + pick(rng, [4.0, 6.0]); t3 = tf + pick(rng, [2.0, 4.0])
        a3 = -v1 / (t3 - tf); N = m * (CG + a3)
        if N > 0:
            break
    k1, d1 = signed_opts(a3, [(f"Reports the speeding-up acceleration, ${sig(v1 / t1)}\\text{{ m/s}}^2$, instead of the slowing-down one.", v1 / t1), (f"Divides the speed by the total time of the graph, $-v_1/t_3={sig(-v1 / t3)}\\text{{ m/s}}^2$.", -v1 / t3), (f"Gives the acceleration the wrong sign, ${sig(-a3)}\\text{{ m/s}}^2$.", -a3), (f"Divides the speed by the time of the constant-speed part, $-v_1/(t_f-t_1)={sig(-v1 / (tf - t1))}\\text{{ m/s}}^2$.", -v1 / (tf - t1))], "m/s^2")
    k2, d2 = num_opts(N, [(f"Reports the weight, $mg={sig(m * CG)}\\text{{ N}}$.", m * CG), (f"Uses the speeding-up acceleration, $m(g+a_1)={sig(m * (CG + v1 / t1))}\\text{{ N}}$.", m * (CG + v1 / t1)), (f"Adds the magnitude of the deceleration, $m(g+|a|)={sig(m * (CG + abs(a3)))}\\text{{ N}}$.", m * (CG + abs(a3))), (f"Reports the net force, $m|a|={sig(m * abs(a3))}\\text{{ N}}$.", m * abs(a3))], "N")
    stim = graph_stim("Velocity of the elevator versus time (upward is positive)", [("v", [(0, 0), (t1, v1), (tf, v1), (t3, 0)])], gaxis("Time (s)", 0, t3, 1), gaxis("Velocity (m/s)", 0, v1 + 1, 1))
    q = []
    for st, key, ds, nm, kw in [("What is the acceleration of the elevator during the final segment of the graph?", k1, d1, "q1", f"The slope of the final segment is $(0-{v1:g})/({t3:g}-{tf:g})={sig(a3)}\\text{{ m/s}}^2$."),
                                (f"A person of mass ${m:g}\\text{{ kg}}$ stands on a scale in the elevator. What does the scale read during the final segment?", k2, d2, "q2", f"$N-mg=ma$ gives $N=m(g+a)={sig(N)}\\text{{ N}}$.")]:
        q.append(mk(f"pcs_elevator_vt_set_{nm}", "2.5", "2.B", st, key, ds, rng, concept="Two questions about one velocity-time graph of an elevator", thinking=["Read the acceleration from the slope of the relevant segment", "Apply Newton's second law to the person with the normal force and the weight"],
                    cond=[("upward is the positive direction", "the shared stimulus states the sign convention")], path="the slope is computed from the vertices; Newton's second law is solved numerically", material=MAT_GRAPH("axis labels with units"),
                    judgment=["representation_reading", "law_selection"], est=100, facts=[f"m={m}", f"v1={v1}", f"t1={t1}", f"tf={tf}", f"t3={t3}"], kwhy=kw))
    intro = "An elevator moves vertically. The graph shows its velocity as a function of time (upward is positive)."
    return set_pack("pcs_elevator_vt_set", "2.5", intro, stim, q, q[0]["facts"])


@retry_sep
def pcs_pendulum_table_set(rng):
    """세트: 진자 길이–주기 표 → (g, 다른 길이의 주기). 단원 7."""
    Ls = [0.20, 0.40, 0.60, 0.80, 1.00]
    for _ in forever():
        gtrue = pick(rng, [9.7, 9.8, 9.9]); r2 = random.Random(rng.randrange(10 ** 9)); Ts = [round(2 * math.pi * math.sqrt(L / gtrue) * (1 + r2.uniform(-0.01, 0.01)), 3) for L in Ls]; T2 = [t * t for t in Ts]
        slope = float(np.polyfit(Ls, T2, 1)[0]); X = np.array([[L, 1.0] for L in Ls]); beta = np.linalg.solve(X.T @ X, X.T @ np.array(T2)); agree(slope, beta[0], 1e-9, "slope"); g_est = 4 * math.pi ** 2 / slope; L3 = pick(rng, [1.5, 2.0, 2.5]); T3 = 2 * math.pi * math.sqrt(L3 / g_est)
        if abs(g_est - 9.8) / 9.8 < 0.03:
            break
    k1, d1 = num_opts(g_est, [(f"Uses $\\text{{slope}}/(4\\pi^2)={sig(slope / (4 * math.pi ** 2))}\\text{{ m/s}}^2$, inverted.", slope / (4 * math.pi ** 2)), (f"Forgets the $4\\pi^2$, $1/\\text{{slope}}={sig(1 / slope)}\\text{{ m/s}}^2$.", 1 / slope), (f"Uses $2\\pi/\\text{{slope}}={sig(2 * math.pi / slope)}\\text{{ m/s}}^2$.", 2 * math.pi / slope), (f"Uses $4\\pi^2L/T$ at the last row, with $T$ in place of $T^2$, ${sig(4 * math.pi ** 2 * Ls[-1] / Ts[-1])}\\text{{ m/s}}^2$.", 4 * math.pi ** 2 * Ls[-1] / Ts[-1])], "m/s^2")
    k2, d2 = num_opts(T3, [(f"Scales the period linearly with the length from the last row, ${sig(Ts[-1] * L3 / Ls[-1])}\\text{{ s}}$.", Ts[-1] * L3 / Ls[-1]), (f"Uses the length divided by $g$ without the square root and $2\\pi$, $L/g={sig(L3 / g_est)}\\text{{ s}}$.", L3 / g_est), (f"Omits the $2\\pi$, $\\sqrt{{L/g}}={sig(math.sqrt(L3 / g_est))}\\text{{ s}}$.", math.sqrt(L3 / g_est)), (f"Omits the square root, $2\\pi L/g={sig(2 * math.pi * L3 / g_est)}\\text{{ s}}$.", 2 * math.pi * L3 / g_est)], "s")
    stim = table_stimulus("Period of a simple pendulum for different string lengths", "String length (m)", [[L, t] for L, t in zip(Ls, Ts)], "Period (s)")
    q = []
    for st, key, ds, nm, kw, tp in [("What value of $g$ do the data imply, found from a linear fit of the appropriate quantities?", k1, d1, "q1", f"The slope of $T^2$ against $L$ is ${sig(slope)}\\text{{ s}}^2\\text{{/m}}$, so $g=4\\pi^2/\\text{{slope}}={sig(g_est)}\\text{{ m/s}}^2$.", "7.5"),
                                    (f"Using the value of $g$ from the data, what is the period of the pendulum when the string length is ${L3:g}\\text{{ m}}$?", k2, d2, "q2", f"$T=2\\pi\\sqrt{{L/g}}=2\\pi\\sqrt{{{L3:g}/{sig(g_est)}}}={sig(T3)}\\text{{ s}}$.", "7.5")]:
        q.append(mk(f"pcs_pendulum_table_set_{nm}", tp, "2.B", st, key, ds, rng, concept="Two questions about one set of simple-pendulum data", thinking=["Linearize the data as $T^2$ against $L$ and use the slope for $g$", "Use $T=2\\pi\\sqrt{L/g}$ with that value of $g$"],
                    cond=[("the pendulum swings with a small amplitude", "the shared description states a small amplitude")], path="a least-squares fit of $T^2$ against $L$ recomputes the slope; the period follows from the pendulum formula", material={"type": "table", "must_include": ["string length", "period"]},
                    judgment=["representation_reading", "law_selection"], est=110, facts=[f"gtrue={gtrue}", f"L3={L3}"], kwhy=kw))
    intro = "A student measures the period of a simple pendulum with a small amplitude for several lengths of the string. The table shows the data."
    return set_pack("pcs_pendulum_table_set", "7.5", intro, stim, q, q[0]["facts"])


STAGE_U4_D = ["pc_bullet_through_block", "pc_cannon_recoil_angle", "pc_equal_mass_exchange", "pc_impulse_rank_pulses"]
STAGE_U5_D = ["pc_beam_two_supports", "pc_ring_tangential_alpha", "pc_rolling_friction_force", "pc_rod_quarter_inertia"]
STAGE_U6_D = ["pc_rolling_time_ratio", "pc_orbit_transfer_work", "pc_ring_drop_ke_loss"]
STAGE_U7_D = ["pc_shm_phase_velocity_zero", "pc_pendulum_independence_claim", "pc_period_table_spring_k", "pc_shm_accel_graph_amplitude"]
STAGE_SETS_D = ["pcs_elevator_vt_set", "pcs_pendulum_table_set"]
