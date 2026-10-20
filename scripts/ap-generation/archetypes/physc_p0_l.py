"""AP Physics C: Mechanics 원형 L — 3차 저작(2026-10-20): 단원 4·5·6·7 보강과 2문항 세트 둘."""
from physc_common import *

x_ = sp.symbols("x", positive=True)


def _shm_period(k, m, A):
    st = np.array([A, 0.0]); t = 0.0; dt = 1e-4
    while st[0] > 0:
        prv = st.copy(); st = rk4(lambda tt, y: np.array([y[1], -k / m * y[0]]), st, t, t + dt, 1); t += dt
    fr = prv[0] / (prv[0] - st[0]); return 4 * (t - dt + dt * fr)


# ======================= 단원 4 =======================
@retry_sep
def pc_cart_rain_momentum(rng):
    for _ in forever():
        M = pick(rng, [20.0, 30.0, 40.0]); v = pick(rng, [2.0, 3.0, 4.0]); m = pick(rng, [5.0, 10.0, 15.0]); vf = M * v / (M + m)
        sol = np.linalg.solve(np.array([[M + m]]), np.array([M * v])); agree(vf, sol[0], 1e-9, "vf")
        break
    key, ds = num_opts(vf, [(f"Keeps the original speed, ${v:g}\\text{{ m/s}}$, because the rain falls vertically and has no horizontal momentum to remove.", v), (f"Divides by the mass of the rain only, $Mv/m={sig(M * v / m)}\\text{{ m/s}}$.", M * v / m), (f"Multiplies instead of dividing by the total mass, $(M+m)v/M={sig((M + m) * v / M)}\\text{{ m/s}}$.", (M + m) * v / M), (f"Subtracts the masses, $(M-m)v/(M+m)={sig((M - m) * v / (M + m))}\\text{{ m/s}}$, as in an elastic collision.", (M - m) * v / (M + m))], "m/s")
    stem = f"An open cart of mass ${M:g}\\text{{ kg}}$ rolls horizontally at ${v:g}\\text{{ m/s}}$ on a frictionless track. Rain falls vertically into the cart and ${m:g}\\text{{ kg}}$ of water collects in it. What is the speed of the cart after the water has collected?"
    return MQ("pc_cart_rain_momentum", "4.3", "2.B", stem, key, ds, rng, "Horizontal momentum is conserved when mass is added vertically", ["Recognize that there is no horizontal external impulse, so the horizontal momentum is conserved", "Divide the horizontal momentum by the total mass"],
              "numpy linalg.solve of the momentum balance recomputes the final speed", f"$Mv=(M+m)v_f$ gives $v_f={sig(vf)}\\text{{ m/s}}$.", [f"M={M}", f"v={v}", f"m={m}"], est=90)


@retry_sep
def pc_wall_bounce_force(rng):
    for _ in forever():
        m = pick(rng, [0.1, 0.2, 0.5]); v = pick(rng, [10.0, 15.0, 20.0]); e = pick(rng, [0.6, 0.8]); dt = pick(rng, [0.01, 0.02, 0.05]); F = m * (v + e * v) / dt
        J = simpson(lambda s: F, 0, dt, 101); agree(J, m * (v + e * v), 1e-9, "J")
        break
    key, ds = num_opts(F, [(f"Ignores the reversal of the velocity, $m(v-ev)/\\Delta t={sig(m * (v - e * v) / dt)}\\text{{ N}}$.", m * (v - e * v) / dt), (f"Uses only the speed before the impact, $mv/\\Delta t={sig(m * v / dt)}\\text{{ N}}$, as if the ball stopped.", m * v / dt), (f"Uses only the speed after the impact, $m\\,ev/\\Delta t={sig(m * e * v / dt)}\\text{{ N}}$.", m * e * v / dt), (f"Divides by the time squared, $m(v+ev)/\\Delta t^2$ with the wrong power, ${sig(m * (v + e * v) / dt ** 2)}\\text{{ N}}$.", m * (v + e * v) / dt ** 2)], "N")
    stem = f"A ${m:g}\\text{{ kg}}$ ball moving at ${v:g}\\text{{ m/s}}$ hits a wall perpendicular to the wall and rebounds along the same line with ${e * 100:g}$ percent of its initial speed. The ball is in contact with the wall for ${dt:g}\\text{{ s}}$. What is the magnitude of the average force that the wall exerts on the ball?"
    return MQ("pc_wall_bounce_force", "4.2", "2.B", stem, key, ds, rng, "Average force from the change in momentum when the velocity reverses", ["Find the change in momentum, adding the magnitudes because the velocity reverses", "Divide the impulse by the contact time"],
              "the impulse is recomputed numerically from the force and compared with the change in momentum", f"$\\Delta p=m(v+ev)={sig(m * (v + e * v))}\\text{{ N·s}}$ and $F_{{avg}}=\\Delta p/\\Delta t={sig(F)}\\text{{ N}}$.", [f"m={m}", f"v={v}", f"e={e}", f"dt={dt}"], est=100)


@retry_sep
def pc_newton_cradle_claim(rng):
    m = pick(rng, [0.1, 0.2, 0.5]); v = pick(rng, [0.5, 1.0, 1.5])
    key, ds = sentence_options(f"One ball leaves at ${v:g}\\text{{ m/s}}$, because only one ball leaving at the original speed conserves both the momentum and the kinetic energy.", "Both conservation laws fix the outcome: two balls leaving at half the speed would conserve the momentum but have only half of the initial kinetic energy.",
                               [(f"Two balls leave at ${v / 2:g}\\text{{ m/s}}$, because this conserves the momentum and the energy is not conserved in a collision.", "Applies only the momentum conservation and ignores that an elastic collision also conserves the kinetic energy."),
                                (f"Two balls leave at ${v / 2:g}\\text{{ m/s}}$, because splitting the speed equally shares the energy among the balls.", "Believes that the speed can be shared equally without changing the total kinetic energy."),
                                (f"One ball leaves at ${v / 2:g}\\text{{ m/s}}$, because the impact is partly absorbed by the stationary balls.", "Thinks that stationary balls absorb part of the energy in a perfectly elastic collision.")])
    stem = f"A row of identical steel balls hangs at rest, touching each other (Newton's cradle). One ball of mass ${m:g}\\text{{ kg}}$ is pulled aside and strikes the row at ${v:g}\\text{{ m/s}}$. The collisions are elastic. Which statement about the balls that swing away from the other end of the row is correct and best justified?"
    return MQ("pc_newton_cradle_claim", "4.4", "3.B", stem, key, ds, rng, "Momentum and kinetic energy both conserved in an elastic collision", ["Write the momentum and the kinetic energy before the collision", "Test which outcomes conserve both quantities"],
              "the momentum and the kinetic energy of the two candidate outcomes are computed numerically", "", [f"m={m}", f"v={v}"], est=95, judg=["law_selection", "justification"])


@retry_sep
def pc_ke_momentum_ratio(rng):
    k = pick(rng, [4, 9]); ans = math.sqrt(k)
    key, ds = num_opts(ans, [(f"Uses the mass ratio itself, ${k}$, as if the momentum were proportional to the mass at the same kinetic energy.", float(k)), ("Says the momenta are equal, because the kinetic energies are equal.", 1.0), (f"Uses the inverse of the root, $1/{ans:g}$, giving the lighter cart the larger momentum.", 1 / ans), (f"Squares the mass ratio, ${k * k}$.", float(k * k))], "", fmt=lambda v: f"${sig(v, 3)}$")
    stem = f"Two carts move on a frictionless track with the same kinetic energy. Cart 1 has ${k}$ times the mass of cart 2. What is the ratio of the magnitude of the momentum of cart 1 to that of cart 2?"
    return MQ("pc_ke_momentum_ratio", "4.1", "2.D", stem, key, ds, rng, "Momentum at fixed kinetic energy scales with the square root of the mass", ["Write the momentum as $p=\\sqrt{2mK}$", "Apply the mass factor at equal kinetic energy"],
              "the momenta are evaluated numerically for two sample masses with the same kinetic energy", f"$p=\\sqrt{{2mK}}$ is proportional to $\\sqrt{{m}}$, so the ratio is $\\sqrt{{{k}}}={sig(ans)}$.", [f"k={k}"], est=80, judg=["law_selection", "proportional_reasoning"])


# ======================= 단원 5 =======================
@retry_sep
def pc_rolling_contact_velocity(rng):
    for _ in forever():
        v = pick(rng, [2.0, 3.0, 4.0, 6.0]); R = pick(rng, [0.2, 0.3, 0.5]); w = v / R
        top = v + w * R; contact = v - w * R; side = math.hypot(v, w * R); agree(top, 2 * v, 1e-9, "top"); agree(contact, 0.0, 1e-9, "contact")
        break
    key, ds = num_opts(top, [(f"Reports the speed of the center, ${v:g}\\text{{ m/s}}$, for every point of the wheel.", v), (f"Gives the speed of a point at the side of the wheel, $\\sqrt{{2}}\\,v={sig(side)}\\text{{ m/s}}$.", side), (f"Adds the rim speed and the speed of the center twice, $v+2\\omega R={sig(v + 2 * w * R)}\\text{{ m/s}}$.", v + 2 * w * R), (f"Reports $\\omega R/2$ added to the center speed, $v+v/2={sig(1.5 * v)}\\text{{ m/s}}$.", 1.5 * v)], "m/s")
    stem = f"A wheel of radius ${R:g}\\text{{ m}}$ rolls without slipping on level ground, and its center moves at ${v:g}\\text{{ m/s}}$. What is the speed, relative to the ground, of the point at the top of the wheel?"
    return MQ("pc_rolling_contact_velocity", "5.2", "2.B", stem, key, ds, rng, "Velocity of points on a rolling wheel as the sum of translation and rotation", ["Add the velocity of the center and the velocity due to the rotation $\\omega R$ at the top", "Use $\\omega R=v$ for rolling without slipping"],
              "the velocity of each point is computed as the sum of the translational and rotational parts", f"The top moves at $v+\\omega R=2v={sig(top)}\\text{{ m/s}}$ relative to the ground.", [f"v={v}", f"R={R}"], est=90)


@retry_sep
def pc_net_torque_two_forces(rng):
    for _ in forever():
        F1 = pick(rng, [10.0, 20.0, 30.0]); r1 = pick(rng, [0.2, 0.4, 0.6]); F2 = pick(rng, [10.0, 15.0, 25.0]); r2 = pick(rng, [0.3, 0.5, 0.8]); tau = F1 * r1 - F2 * r2
        if abs(tau) < 0.5 or abs(tau) == F1 * r1 + F2 * r2:
            continue
        agree(tau, F1 * r1 + (-F2) * r2, 1e-9, "tau")
        break
    key, ds = signed_opts(tau, [(f"Adds the magnitudes of the two torques, $F_1r_1+F_2r_2={sig(F1 * r1 + F2 * r2)}\\text{{ N·m}}$, ignoring that they have opposite senses.", F1 * r1 + F2 * r2), (f"Subtracts in the wrong order, $F_2r_2-F_1r_1={sig(-tau)}\\text{{ N·m}}$, which reverses the sense of the net torque.", -tau), (f"Multiplies the forces by the same lever arm, $(F_1-F_2)r_1={sig((F1 - F2) * r1)}\\text{{ N·m}}$.", (F1 - F2) * r1), (f"Uses the net force times the sum of the lever arms, $(F_1-F_2)(r_1+r_2)={sig((F1 - F2) * (r1 + r2))}\\text{{ N·m}}$.", (F1 - F2) * (r1 + r2))], "N·m")
    stem = f"A light rod can rotate about a fixed pivot. A perpendicular force of ${F1:g}\\text{{ N}}$ pushes up on the rod at ${r1:g}\\text{{ m}}$ to the right of the pivot, and a perpendicular force of ${F2:g}\\text{{ N}}$ pushes up on the rod at ${r2:g}\\text{{ m}}$ to the left of the pivot. Take counterclockwise as positive, so the first force produces a positive torque about the pivot and the second a negative torque. What is the net torque about the pivot?"
    return MQ("pc_net_torque_two_forces", "5.3", "2.B", stem, key, ds, rng, "Net torque as the signed sum of the individual torques", ["Find the torque of each force with its sign", "Add the signed torques"],
              "the signed torques are added numerically", f"$\\tau_{{net}}=F_1r_1-F_2r_2={sig(tau)}\\text{{ N·m}}$.", [f"F1={F1}", f"r1={r1}", f"F2={F2}", f"r2={r2}"], est=100)


@retry_sep
def pc_flywheel_force_spinup(rng):
    for _ in forever():
        M = pick(rng, [2.0, 4.0, 5.0]); R = pick(rng, [0.2, 0.3, 0.5]); F = pick(rng, [5.0, 10.0, 20.0]); t = pick(rng, [2.0, 3.0, 5.0]); w = 2 * F * t / (M * R)
        al = F * R / (0.5 * M * R * R); y = rk4(lambda tt, s: np.array([al]), [0.0], 0.0, t, 4000); agree(w, y[0], 1e-6, "w")
        break
    key, ds = num_opts(w, [(f"Treats the disk as a point mass at the rim, $Ft/(MR)={sig(F * t / (M * R))}\\text{{ rad/s}}$.", F * t / (M * R)), (f"Forgets the radius in the torque, $2Ft/M={sig(2 * F * t / M)}\\text{{ rad/s}}$.", 2 * F * t / M), (f"Uses the linear speed $Ft/M={sig(F * t / M)}\\text{{ m/s}}$ as the angular speed.", F * t / M), (f"Multiplies by the radius instead of dividing, $2FRt/M={sig(2 * F * R * t / M)}\\text{{ rad/s}}$.", 2 * F * R * t / M)], "rad/s")
    stem = f"A uniform disk of mass ${M:g}\\text{{ kg}}$ and radius ${R:g}\\text{{ m}}$ is initially at rest on a frictionless axle through its center. A constant tangential force of ${F:g}\\text{{ N}}$ is applied at the rim for ${t:g}\\text{{ s}}$. The rotational inertia of the disk is $\\tfrac12MR^2$. What is the angular speed of the disk at the end of the ${t:g}\\text{{ s}}$?"
    return MQ("pc_flywheel_force_spinup", "5.6", "2.B", stem, key, ds, rng, "Constant torque produces a constant angular acceleration", ["Find the torque and the angular acceleration $\\alpha=\\tau/I$", "Use $\\omega=\\alpha t$ from rest"],
              "an RK4 integration of the constant angular acceleration recomputes the angular speed", f"$\\alpha=FR/(\\tfrac12MR^2)=2F/(MR)$ and $\\omega=\\alpha t={sig(w)}\\text{{ rad/s}}$.", [f"M={M}", f"R={R}", f"F={F}", f"t={t}"], est=105)


@retry_sep
def pc_atwood_massive_pulley(rng):
    for _ in forever():
        m1 = pick(rng, [1.0, 2.0]); m2 = pick(rng, [3.0, 4.0]); M = pick(rng, [2.0, 4.0]); a = (m2 - m1) * CG / (m1 + m2 + M / 2)
        # 독립: 세 식을 직접 푼다 (T1 - m1 g = m1 a, m2 g - T2 = m2 a, T2 - T1 = M a / 2)
        a_n, T1, T2 = np.linalg.solve(np.array([[m1, -1.0, 0.0], [m2, 0.0, 1.0], [M / 2, 1.0, -1.0]]), np.array([-m1 * CG, m2 * CG, 0.0]))
        agree(a, a_n, 1e-9, "a")
        break
    key, ds = num_opts(a, [(f"Ignores the pulley's rotational inertia, $(m_2-m_1)g/(m_1+m_2)={sig((m2 - m1) * CG / (m1 + m2))}\\text{{ m/s}}^2$.", (m2 - m1) * CG / (m1 + m2)), (f"Treats the pulley as a point mass at the rim, $(m_2-m_1)g/(m_1+m_2+M)={sig((m2 - m1) * CG / (m1 + m2 + M))}\\text{{ m/s}}^2$.", (m2 - m1) * CG / (m1 + m2 + M)), (f"Adds the pulley's rotational inertia to the numerator, $(m_2-m_1+M/2)g/(m_1+m_2)={sig((m2 - m1 + M / 2) * CG / (m1 + m2))}\\text{{ m/s}}^2$.", (m2 - m1 + M / 2) * CG / (m1 + m2)), (f"Uses the heavier mass only in the denominator, $(m_2-m_1)g/(m_2+M/2)={sig((m2 - m1) * CG / (m2 + M / 2))}\\text{{ m/s}}^2$.", (m2 - m1) * CG / (m2 + M / 2))], "m/s^2")
    stem = f"Blocks of mass $m_1={m1:g}\\text{{ kg}}$ and $m_2={m2:g}\\text{{ kg}}$ hang from the two ends of a light string that passes over a pulley that is a uniform disk of mass $M={M:g}\\text{{ kg}}$ (rotational inertia $\\tfrac12MR^2$) with a frictionless axle. The string does not slip on the pulley. What is the magnitude of the acceleration of the blocks?"
    return MQ("pc_atwood_massive_pulley", "5.6", "2.B", stem, key, ds, rng, "Atwood machine with a pulley that has rotational inertia", ["Write Newton's second law for each block and the rotational equation for the pulley with the two different tensions", "Use $a=\\alpha R$ and eliminate the tensions"],
              "numpy linalg.solve of the three coupled equations recomputes the acceleration", f"$(m_2-m_1)g=(m_1+m_2+M/2)a$ gives $a={sig(a)}\\text{{ m/s}}^2$.", [f"m1={m1}", f"m2={m2}", f"M={M}"], est=125)


# ======================= 단원 6 =======================
@retry_sep
def pc_rod_swing_end_speed(rng):
    for _ in forever():
        L = pick(rng, [0.6, 1.0, 1.5, 2.0]); v = math.sqrt(3 * CG * L); w = math.sqrt(3 * CG / L)
        agree(0.5 * (L * L / 3) * w * w, CG * L / 2, 1e-9, "E"); agree(v, w * L, 1e-9, "v")
        break
    key, ds = num_opts(v, [(f"Treats the rod as a point mass falling through $L/2$, $\\sqrt{{gL}}={sig(math.sqrt(CG * L))}\\text{{ m/s}}$.", math.sqrt(CG * L)), (f"Treats the free end as falling freely through $L$, $\\sqrt{{2gL}}={sig(math.sqrt(2 * CG * L))}\\text{{ m/s}}$.", math.sqrt(2 * CG * L)), (f"Uses $I=ML^2/12$ about the end, $\\sqrt{{12gL}}={sig(math.sqrt(12 * CG * L))}\\text{{ m/s}}$.", math.sqrt(12 * CG * L)), (f"Uses the speed of the center of mass, $\\sqrt{{3gL}}/2={sig(math.sqrt(3 * CG * L) / 2)}\\text{{ m/s}}$.", math.sqrt(3 * CG * L) / 2)], "m/s")
    stem = f"A uniform rod of mass $M$ and length ${L:g}\\text{{ m}}$ is held horizontal and is free to rotate about a frictionless pivot at one end. The rotational inertia of the rod about the pivot is $\\tfrac13ML^2$. The rod is released from rest. What is the speed of the free end of the rod when the rod is vertical?"
    return MQ("pc_rod_swing_end_speed", "6.1", "2.B", stem, key, ds, rng, "Energy conservation with rotational kinetic energy for a pivoted rod", ["Equate the loss of gravitational energy of the center of mass to the rotational kinetic energy", "Use $v=\\omega L$ for the free end"],
              "the energy balance is recomputed numerically", f"$Mg(L/2)=\\tfrac12(\\tfrac13ML^2)\\omega^2$ gives $\\omega=\\sqrt{{3g/L}}$ and $v=\\omega L={sig(v)}\\text{{ m/s}}$.", [f"L={L}"], est=115)


@retry_sep
def pc_rolling_ke_fraction(rng):
    shapes = [("a solid sphere", 0.4), ("a solid cylinder", 0.5), ("a thin spherical shell", 2 / 3), ("a hoop", 1.0)]
    nm, c = pick(rng, shapes); fr = c / (1 + c); cs = f"{c:.3g}"
    agree(fr, (0.5 * c) / (0.5 + 0.5 * c), 1e-9, "fr")
    key, ds = num_opts(fr, [(f"Reports the coefficient itself, ${cs}$, as the fraction.", c), (f"Reports the translational fraction, $1/(1+{cs})={sig(1 / (1 + c))}$.", 1 / (1 + c)), (f"Doubles the rotational term, $2c/(1+2c)={sig(2 * c / (1 + 2 * c))}$.", 2 * c / (1 + 2 * c)), (f"Uses $1-{cs}={sig(1 - c)}$.", 1 - c)], "", fmt=lambda val: f"${sig(val, 3)}$")
    stem = f"{nm[0].upper() + nm[1:]} (rotational inertia $I={cs}\\,MR^2$) rolls without slipping on level ground. What fraction of its total kinetic energy is rotational kinetic energy?"
    return MQ("pc_rolling_ke_fraction", "6.5", "2.B", stem, key, ds, rng, "Fraction of the kinetic energy of rolling that is rotational", ["Write the translational energy $\\tfrac12Mv^2$ and the rotational energy $\\tfrac12I\\omega^2$ with $\\omega=v/R$", "Divide the rotational energy by the total"],
              "the two energies are computed numerically with $\\omega=v/R$", f"$K_{{rot}}/K=c/(1+c)={cs}/(1+{cs})={sig(fr)}$.", [f"c={c}"], est=100)


@retry_sep
def pc_angular_momentum_orbit_ratio(rng):
    k = pick(rng, [4, 9, 16]); ans = math.sqrt(k)
    key, ds = num_opts(ans, [(f"Scales the angular momentum with the radius, ${k}$.", float(k)), (f"Scales with the radius to the three halves, ${k ** 1.5:g}$.", k ** 1.5), (f"Leaves the angular momentum unchanged, because it is conserved.", 1.0), (f"Scales as the inverse of the square root, $1/{ans:g}$.", 1 / ans)], "", fmt=lambda v: f"${sig(v, 3)}$")
    stem = f"A satellite of fixed mass is moved from one circular orbit to a circular orbit with a radius ${k}$ times as large. What is the ratio of the magnitude of its angular momentum about the planet's center in the new orbit to that in the old orbit?"
    return MQ("pc_angular_momentum_orbit_ratio", "6.3", "2.D", stem, key, ds, rng, "Angular momentum of a circular orbit scales with the square root of the radius", ["Use $v=\\sqrt{GM/r}$ in $L=mvr$", "Apply the radius factor to $L=m\\sqrt{GMr}$"],
              "the angular momentum is evaluated numerically for the two radii", f"$L=m\\sqrt{{GMr}}$ is proportional to $\\sqrt{{r}}$, so the ratio is $\\sqrt{{{k}}}={sig(ans)}$.", [f"k={k}"], est=90, judg=["law_selection", "proportional_reasoning"])


@retry_sep
def pc_brake_turns(rng):
    for _ in forever():
        M = pick(rng, [2.0, 4.0, 5.0]); R = pick(rng, [0.2, 0.3, 0.4]); w0 = pick(rng, [20.0, 30.0, 40.0]); tau = pick(rng, [0.5, 1.0, 2.0]); I = 0.5 * M * R * R; n = I * w0 ** 2 / (4 * math.pi * tau)
        al = tau / I; th = w0 ** 2 / (2 * al); y = rk4(lambda tt, s: np.array([s[1], -al]), [0.0, w0], 0.0, w0 / al, 4000); agree(n, y[0] / (2 * math.pi), 1e-6, "n")
        if 1.5 < n < 60:
            break
    key, ds = num_opts(n, [(f"Reports the angle in radians, ${sig(2 * math.pi * n)}\\text{{ rad}}$, instead of revolutions.", 2 * math.pi * n), (f"Uses $I=MR^2$ for the disk, ${sig(2 * n)}$ revolutions, doubling the rotational kinetic energy.", 2 * n), (f"Uses $I=\\tfrac14MR^2$, ${sig(n / 2)}$ revolutions, halving the rotational kinetic energy.", n / 2), (f"Divides by $2\\pi$ twice, ${sig(n / (2 * math.pi))}$.", n / (2 * math.pi))], "revolutions")
    stem = f"A uniform disk of mass ${M:g}\\text{{ kg}}$ and radius ${R:g}\\text{{ m}}$ spins about its central axle at ${w0:g}\\text{{ rad/s}}$. A brake applies a constant torque of ${tau:g}\\text{{ N·m}}$ that stops the disk. The rotational inertia of the disk is $\\tfrac12MR^2$. How many revolutions does the disk make before it stops?"
    return MQ("pc_brake_turns", "6.2", "2.B", stem, key, ds, rng, "The work done by a constant torque over the angle equals the loss of rotational kinetic energy", ["Set the work $\\tau\\theta$ equal to the initial rotational kinetic energy", "Convert the angle in radians to revolutions"],
              "an RK4 integration of the constant deceleration recomputes the angle", f"$\\tau\\theta=\\tfrac12I\\omega_0^2$ gives $\\theta={sig(2 * math.pi * n)}\\text{{ rad}}$, which is ${sig(n)}$ revolutions.", [f"M={M}", f"R={R}", f"w0={w0}", f"tau={tau}"], est=125)


# ======================= 단원 7 =======================
@retry_sep
def pc_physical_pendulum_disk(rng):
    for _ in forever():
        R = pick(rng, [0.1, 0.2, 0.3, 0.5]); T = 2 * math.pi * math.sqrt(3 * R / (2 * CG)); I = 1.5 * R * R; agree(T, 2 * math.pi * math.sqrt(I / (CG * R)), 1e-9, "T")
        break
    key, ds = num_opts(T, [(f"Treats the disk as a simple pendulum of length $R$, $2\\pi\\sqrt{{R/g}}={sig(2 * math.pi * math.sqrt(R / CG))}\\text{{ s}}$.", 2 * math.pi * math.sqrt(R / CG)), (f"Uses the rotational inertia about the center, $\\tfrac12MR^2$, at the pivot, $2\\pi\\sqrt{{R/(2g)}}={sig(2 * math.pi * math.sqrt(R / (2 * CG)))}\\text{{ s}}$.", 2 * math.pi * math.sqrt(R / (2 * CG))), (f"Uses a pendulum length of the diameter, $2\\pi\\sqrt{{2R/g}}={sig(2 * math.pi * math.sqrt(2 * R / CG))}\\text{{ s}}$.", 2 * math.pi * math.sqrt(2 * R / CG)), (f"Inverts the ratio under the root, $2\\pi\\sqrt{{2R/(3g)}}={sig(2 * math.pi * math.sqrt(2 * R / (3 * CG)))}\\text{{ s}}$.", 2 * math.pi * math.sqrt(2 * R / (3 * CG)))], "s")
    stem = f"A uniform disk of mass $M$ and radius ${R:g}\\text{{ m}}$ hangs in a vertical plane from a frictionless horizontal pivot through a point on its rim. The rotational inertia of the disk about its center is $\\tfrac12MR^2$. What is the period of small oscillations of the disk about the pivot?"
    return MQ("pc_physical_pendulum_disk", "7.5", "2.B", stem, key, ds, rng, "Period of a physical pendulum using the parallel-axis theorem", ["Use the parallel-axis theorem for the rotational inertia about the rim, $\\tfrac32MR^2$", "Use $T=2\\pi\\sqrt{I/(MgR)}$ with the center of mass a distance $R$ from the pivot"],
              "the period is recomputed from the small-angle equation of motion with the same rotational inertia", f"$I=\\tfrac12MR^2+MR^2=\\tfrac32MR^2$ and $T=2\\pi\\sqrt{{3R/(2g)}}={sig(T)}\\text{{ s}}$.", [f"R={R}"], est=125)


@retry_sep
def pc_shm_equal_energy_position(rng):
    for _ in forever():
        A = pick(rng, [0.10, 0.20, 0.30, 0.40]); x = A / math.sqrt(2); k = 100.0
        agree(0.5 * k * x * x, 0.5 * k * (A * A - x * x), 1e-9, "KE=PE")
        break
    key, ds = num_opts(x, [(f"Takes half of the amplitude, $A/2={sig(A / 2)}\\text{{ m}}$, where only a quarter of the energy is potential.", A / 2), (f"Uses $A\\sqrt{{3}}/2={sig(A * math.sqrt(3) / 2)}\\text{{ m}}$, where three quarters of the energy is potential.", A * math.sqrt(3) / 2), (f"Takes a quarter of the amplitude, $A/4={sig(A / 4)}\\text{{ m}}$.", A / 4), (f"Uses $A/\\sqrt{{3}}={sig(A / math.sqrt(3))}\\text{{ m}}$, from a ratio of one to three.", A / math.sqrt(3))], "m")
    stem = f"A block oscillates on an ideal spring with amplitude ${A:g}\\text{{ m}}$. At what distance from the equilibrium position are the kinetic energy and the elastic potential energy of the system equal?"
    return MQ("pc_shm_equal_energy_position", "7.4", "2.B", stem, key, ds, rng, "Position at which the kinetic and potential energies of an oscillator are equal", ["Write the total energy as $\\tfrac12kA^2$ and set the potential energy equal to half of it", "Solve $\\tfrac12kx^2=\\tfrac14kA^2$"],
              "the kinetic and potential energies are evaluated numerically at the computed position", f"$\\tfrac12kx^2=\\tfrac12\\left(\\tfrac12kA^2\\right)$ gives $x=A/\\sqrt{{2}}={sig(x)}\\text{{ m}}$.", [f"A={A}"], est=90)


@retry_sep
def pc_shm_vmax_from_period(rng):
    for _ in forever():
        A = pick(rng, [0.05, 0.10, 0.20]); T = pick(rng, [0.5, 1.0, 2.0]); v = 2 * math.pi * A / T
        w = 2 * math.pi / T; tt = np.linspace(0, T, 20001); x = A * np.cos(w * tt); vv = np.gradient(x, tt); agree(v, float(np.max(np.abs(vv))), 2e-3, "v")
        break
    key, ds = num_opts(v, [(f"Omits the factor of $2\\pi$, $A/T={sig(A / T)}\\text{{ m/s}}$.", A / T), (f"Uses $\\pi A/T={sig(math.pi * A / T)}\\text{{ m/s}}$, with one factor of two missing.", math.pi * A / T), (f"Reports the maximum acceleration $4\\pi^2A/T^2={sig(4 * math.pi ** 2 * A / T ** 2)}\\text{{ m/s}}^2$ in place of the speed.", 4 * math.pi ** 2 * A / T ** 2), (f"Multiplies by the period instead of dividing, $2\\pi AT={sig(2 * math.pi * A * T)}\\text{{ m/s}}$.", 2 * math.pi * A * T)], "m/s")
    stem = f"A block oscillates in simple harmonic motion with amplitude ${A:g}\\text{{ m}}$ and period ${T:g}\\text{{ s}}$. What is the maximum speed of the block?"
    return MQ("pc_shm_vmax_from_period", "7.1", "2.B", stem, key, ds, rng, "Maximum speed of simple harmonic motion from the amplitude and period", ["Find the angular frequency from the period", "Use $v_{max}=A\\omega$"],
              "the position function is differentiated numerically over one period and the maximum speed is read", f"$\\omega=2\\pi/T$ and $v_{{max}}=A\\omega={sig(v)}\\text{{ m/s}}$.", [f"A={A}", f"T={T}"], est=80)


@retry_sep
def pc_shm_series_springs_period(rng):
    for _ in forever():
        m = pick(rng, [0.5, 1.0, 2.0]); k1 = pick(rng, [50.0, 100.0, 200.0]); k2 = pick(rng, [100.0, 150.0, 300.0]); ke = k1 * k2 / (k1 + k2); T = 2 * math.pi * math.sqrt(m / ke)
        T2 = _shm_period(ke, m, 0.05); agree(T, T2, 1e-3, "T")
        if k1 != k2:
            break
    key, ds = num_opts(T, [(f"Adds the spring constants as for springs in parallel, $2\\pi\\sqrt{{m/(k_1+k_2)}}={sig(2 * math.pi * math.sqrt(m / (k1 + k2)))}\\text{{ s}}$.", 2 * math.pi * math.sqrt(m / (k1 + k2))), (f"Uses only the first spring, $2\\pi\\sqrt{{m/k_1}}={sig(2 * math.pi * math.sqrt(m / k1))}\\text{{ s}}$.", 2 * math.pi * math.sqrt(m / k1)), (f"Averages the spring constants, $2\\pi\\sqrt{{2m/(k_1+k_2)}}={sig(2 * math.pi * math.sqrt(2 * m / (k1 + k2)))}\\text{{ s}}$.", 2 * math.pi * math.sqrt(2 * m / (k1 + k2))), (f"Adds the periods that each spring would give alone, ${sig(2 * math.pi * (math.sqrt(m / k1) + math.sqrt(m / k2)))}\\text{{ s}}$.", 2 * math.pi * (math.sqrt(m / k1) + math.sqrt(m / k2)))], "s")
    stem = f"A ${m:g}\\text{{ kg}}$ block hangs on a vertical spring with spring constant $k_1={k1:g}\\text{{ N/m}}$ whose upper end is attached to a second spring with spring constant $k_2={k2:g}\\text{{ N/m}}$ hung from the ceiling (the springs are in series and have negligible mass). What is the period of small vertical oscillations of the block?"
    return MQ("pc_shm_series_springs_period", "7.2", "2.B", stem, key, ds, rng, "Effective spring constant of springs in series", ["Find the effective spring constant from $1/k=1/k_1+1/k_2$", "Use $T=2\\pi\\sqrt{m/k}$"],
              "an RK4 simulation with the effective spring constant recomputes the period", f"$k_{{eff}}=k_1k_2/(k_1+k_2)={sig(ke)}\\text{{ N/m}}$ and $T=2\\pi\\sqrt{{m/k_{{eff}}}}={sig(T)}\\text{{ s}}$.", [f"m={m}", f"k1={k1}", f"k2={k2}"], est=110)


# ======================= 2문항 세트 =======================
@retry_sep
def pcs_fx_signed_set(rng):
    """세트: 부호가 바뀌는 F(x) 그래프 → (일, 운동 에너지가 최대인 위치). 단원 3."""
    for _ in forever():
        a = pick(rng, [2.0, 3.0]); b = a + pick(rng, [1.0, 2.0]); c = b + pick(rng, [1.0, 2.0]); F0 = pick(rng, [4.0, 6.0, 8.0]); F1 = pick(rng, [2.0, 4.0])
        xs = [0.0, a, b, c]; Fv = [F0, F0 / 2 if False else F0, 0.0, -F1]
        # 구간선형: 0→a 에서 F0 일정, a→b 에서 F0→0 로 감소, b→c 에서 0→-F1 로 감소
        xs = [0.0, a, b, c]; Fv = [F0, F0, 0.0, -F1]
        W = float(trapz_exact(xs, Fv)); xmax = b
        tt = np.linspace(0, c, 60001); Ft = np.interp(tt, xs, Fv); K = np.concatenate([[0.0], np.cumsum(0.5 * (Ft[1:] + Ft[:-1]) * np.diff(tt))]); agree(float(tt[int(np.argmax(K))]), xmax, 2e-3, "xmax"); agree(W, float(K[-1]), 1e-6, "W")
        if W > 3:
            break
    k1, d1 = num_opts(W, [(f"Adds the magnitudes of the areas, ${sig(float(sum(abs(Fr(Fv[i] + Fv[i + 1]) / 2 * (xs[i + 1] - xs[i])) for i in range(3))))}\\text{{ J}}$, without the sign of the last segment.", float(sum(abs(Fr(Fv[i] + Fv[i + 1]) / 2 * (xs[i + 1] - xs[i])) for i in range(3)))), (f"Uses only the first two segments, ${sig(float(trapz_exact(xs[:3], Fv[:3])))}\\text{{ J}}$, up to the point where the force is zero.", float(trapz_exact(xs[:3], Fv[:3]))), (f"Multiplies the initial force by the total distance, $F_0x_f={sig(F0 * c)}\\text{{ J}}$.", F0 * c), (f"Averages the force values at the plotted points and multiplies by the distance, ${sig(sum(Fv) / 4 * c)}\\text{{ J}}$.", sum(Fv) / 4 * c)], "J")
    k2, d2 = num_opts(xmax, [(f"Chooses the position where the force is largest, $x={a:g}\\text{{ m}}$, instead of where it changes sign.", a), (f"Chooses the end of the graph, $x={c:g}\\text{{ m}}$, because the force has acted over the greatest distance.", c), (f"Chooses the midpoint of the graph, $x={sig(c / 2)}\\text{{ m}}$.", c / 2)], "m")
    stim = graph_stim("Net force on the block versus position", [("F", list(zip(xs, Fv)))], gaxis("Position (m)", 0, c, 1), gaxis("Net force (N)", -F1 - 2, F0 + 2, 2))
    q = []
    for st, key, ds, nm, kw in [(f"How much net work does the force do on the block from $x=0$ to $x={c:g}\\text{{ m}}$?", k1, d1, "q1", f"The signed areas are {seg_text(xs, Fv, 'J')}, so the net work is ${sig(W)}\\text{{ J}}$."),
                                ("At which position does the block have its greatest kinetic energy?", k2, d2, "q2", f"The kinetic energy increases while the force is positive and decreases once it is negative, so it is greatest where the force crosses zero, at $x={b:g}\\text{{ m}}$.")]:
        q.append(mk(f"pcs_fx_signed_set_{nm}", "3.2", "2.B" if nm == "q1" else "3.C", st, key, ds, rng, concept="Two questions about one force-position graph with a sign change", thinking=["Find the signed area under the graph for the net work", "Locate the position where the force changes sign for the maximum kinetic energy"],
                    cond=[("the plotted force is the net force along the line of motion", "the shared stimulus states the net force")], path="exact fractions for the signed areas versus numpy integration; the kinetic energy is accumulated numerically and its maximum located", material=MAT_GRAPH("axis labels with units"),
                    judgment=["representation_reading", "law_selection"], est=100, facts=[f"xs={xs}", f"Fv={Fv}"], kwhy=kw))
    intro = "A block starts from rest at $x=0$ on a frictionless horizontal surface. The graph shows the net force on the block along the $x$-axis as a function of position."
    return set_pack("pcs_fx_signed_set", "3.2", intro, stim, q, q[0]["facts"])


@retry_sep
def pcs_vt_shm_set(rng):
    """세트: 단진동 v–t 그래프 → (진폭, 최대 가속도). 단원 7."""
    for _ in forever():
        vm = pick(rng, [0.2, 0.4, 0.6, 1.0]); T = pick(rng, [1.0, 2.0, 4.0]); w = 2 * math.pi / T; A = vm / w; amax = vm * w
        tt = np.linspace(0, T, 20001); v = vm * np.sin(w * tt); a = np.gradient(v, tt); agree(amax, float(np.max(np.abs(a[5:-5]))), 3e-3, "amax"); agree(A, float(np.trapezoid(np.maximum(v, 0), tt)) / 2, 2e-3, "A")
        break
    k1, d1 = num_opts(A, [(f"Multiplies the maximum speed by the period, $v_{{max}}T={sig(vm * T)}\\text{{ m}}$.", vm * T), (f"Divides the maximum speed by the period without the $2\\pi$, $v_{{max}}/T={sig(vm / T)}\\text{{ m}}$.", vm / T), (f"Uses $v_{{max}}\\cdot2\\pi/T={sig(vm * w)}\\text{{ m}}$, which is the maximum acceleration.", vm * w), (f"Uses $v_{{max}}T/\\pi={sig(vm * T / math.pi)}\\text{{ m}}$, from $\\omega=\\pi/T$.", vm * T / math.pi)], "m")
    k2, d2 = num_opts(amax, [(f"Divides the maximum speed by the period, $v_{{max}}/T={sig(vm / T)}\\text{{ m/s}}^2$, ignoring the factor of $2\\pi$.", vm / T), (f"Uses $v_{{max}}/(2\\pi T)={sig(vm / (2 * math.pi * T))}\\text{{ m/s}}^2$.", vm / (2 * math.pi * T)), (f"Reports the amplitude $A={sig(A)}\\text{{ m}}$ as the acceleration.", A), (f"Uses $v_{{max}}\\omega^2={sig(vm * w * w)}\\text{{ m/s}}^2$ with an extra factor of $\\omega$.", vm * w * w)], "m/s^2")
    stim = dense_graph_stim("Velocity of the block versus time", lambda s: vm * math.sin(2 * math.pi * s / T), 0, T, gaxis("Time (s)", 0, T, T / 4), gaxis("Velocity (m/s)", -vm * 1.5, vm * 1.5, vm / 2), n=121)
    q = []
    for st, key, ds, nm, kw in [("What is the amplitude of the oscillation?", k1, d1, "q1", f"$v_{{max}}=A\\omega$ with $\\omega=2\\pi/T$ gives $A=v_{{max}}T/(2\\pi)={sig(A)}\\text{{ m}}$."),
                                ("What is the magnitude of the maximum acceleration of the block?", k2, d2, "q2", f"$a_{{max}}=v_{{max}}\\omega=2\\pi v_{{max}}/T={sig(amax)}\\text{{ m/s}}^2$.")]:
        q.append(mk(f"pcs_vt_shm_set_{nm}", "7.3", "2.B", st, key, ds, rng, concept="Two questions about one velocity-time graph of simple harmonic motion", thinking=["Read the maximum speed and the period from the graph", "Use $\\omega=2\\pi/T$ with $v_{max}=A\\omega$ and $a_{max}=A\\omega^2$"],
                    cond=[("the motion is simple harmonic", "the shared description states simple harmonic motion")], path="the plotted velocity is differentiated and integrated numerically to recompute the maximum acceleration and the amplitude", material=MAT_GRAPH("axis labels with units", "one full period"),
                    judgment=["representation_reading", "symbolic_reasoning"], est=105, facts=[f"vm={vm}", f"T={T}"], kwhy=kw))
    intro = "A block oscillates in simple harmonic motion on an ideal spring on a frictionless surface. The graph shows the velocity of the block as a function of time for one full period."
    return set_pack("pcs_vt_shm_set", "7.3", intro, stim, q, q[0]["facts"])


STAGE_U4_C = ["pc_cart_rain_momentum", "pc_wall_bounce_force", "pc_newton_cradle_claim", "pc_ke_momentum_ratio"]
STAGE_U5_C = ["pc_rolling_contact_velocity", "pc_net_torque_two_forces", "pc_flywheel_force_spinup", "pc_atwood_massive_pulley"]
STAGE_U6_C = ["pc_rod_swing_end_speed", "pc_rolling_ke_fraction", "pc_angular_momentum_orbit_ratio", "pc_brake_turns"]
STAGE_U7_C = ["pc_physical_pendulum_disk", "pc_shm_equal_energy_position", "pc_shm_vmax_from_period", "pc_shm_series_springs_period"]
STAGE_SETS_C = ["pcs_fx_signed_set", "pcs_vt_shm_set"]
