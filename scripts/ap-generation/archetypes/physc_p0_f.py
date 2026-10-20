"""AP Physics C: Mechanics 원형 F — 단원 6(회전계의 에너지와 운동량: 일과 돌림힘, 각운동량, 구름, 위성 운동)."""
from physc_common import *

GNEWT = 6.67e-11
t_ = sp.symbols("t", positive=True)


def _sci(v, unit):
    return sci(v, unit) if abs(v) >= 1e4 or abs(v) < 1e-2 else Q(v, unit)


@retry_sep
def pc_rot_ke_flywheel(rng):
    for _ in forever():
        M = pick(rng, [2.0, 4.0, 5.0, 10.0]); R = pick(rng, [0.2, 0.3, 0.5]); w = pick(rng, [20.0, 30.0, 40.0, 50.0]); I = 0.5 * M * R * R; K = 0.5 * I * w * w
        agree(K, 0.25 * M * R * R * w * w, 1e-9, "K")
        break
    key, ds = num_opts(K, [("Uses $I=MR^2$ for a disk, doubling the energy.", M * R * R * w * w / 2), ("Forgets to square the angular speed, $\\tfrac12I\\omega$.", 0.5 * I * w), ("Uses $\\tfrac12MR\\omega^2$, missing a factor of $R$.", 0.5 * M * R * w * w), ("Uses $I=\\tfrac14MR^2$ for the disk, halving the energy.", 0.5 * (0.25 * M * R * R) * w * w)], "J")
    stem = f"A uniform solid disk of mass ${M:g}\\text{{ kg}}$ and radius ${R:g}\\text{{ m}}$ spins about its central axis at ${w:g}\\text{{ rad/s}}$. Its rotational inertia is $\\tfrac12MR^2$. What is its rotational kinetic energy?"
    return MQ("pc_rot_ke_flywheel", "6.1", "2.B", stem, key, ds, rng, "Rotational kinetic energy", ["Find the rotational inertia", "Use $K=\\tfrac12I\\omega^2$"],
              "the energy is recomputed from the closed form $\\tfrac14MR^2\\omega^2$", f"$K=\\tfrac12(\\tfrac12MR^2)\\omega^2={sig(K)}\\text{{ J}}$.", [f"M={M}", f"R={R}", f"w={w}"], est=80)


@retry_sep
def pc_work_torque_integral(rng):
    for _ in forever():
        c = pick(rng, [2.0, 3.0, 4.0, 6.0]); th1 = pick(rng, [1.0, 2.0, 3.0]); W = c * th1 ** 2 / 2
        agree(W, simpson(lambda s: c * s, 0, th1), 1e-6, "W")
        break
    key, ds = num_opts(W, [("Multiplies the final torque by the angle, $c\\theta_1\\cdot\\theta_1$.", c * th1 * th1), ("Uses the final torque as the work.", c * th1), ("Integrates twice, $c\\theta_1^3/6$.", c * th1 ** 3 / 6), ("Averages the torque and multiplies by the angle squared.", c * th1 ** 3 / 2)], "J")
    stem = f"A motor exerts a torque $\\tau(\\theta)={c:g}\\theta$ on a shaft, where $\\tau$ is in newton-meters and $\\theta$ is the angle in radians. How much work does the torque do as the shaft turns from $\\theta=0$ to $\\theta={th1:g}\\text{{ rad}}$?"
    return MQ("pc_work_torque_integral", "6.2", "2.B", stem, key, ds, rng, "Work done by a torque is the integral of torque over angle", ["Set up $W=\\int\\tau\\,d\\theta$", "Evaluate the integral over the angle"],
              "sympy integral versus a Simpson integration", f"$W=\\int_0^{{\\theta_1}}c\\theta\\,d\\theta=c\\theta_1^2/2={sig(W)}\\text{{ J}}$.", [f"c={c}", f"th1={th1}"], est=80)


@retry_sep
def pc_ang_mom_disks(rng):
    for _ in forever():
        M1 = pick(rng, [1.0, 2.0, 3.0]); M2 = pick(rng, [1.0, 2.0, 4.0]); R = pick(rng, [0.3, 0.5]); w1 = pick(rng, [10.0, 20.0, 30.0])
        I1 = 0.5 * M1 * R * R; I2 = 0.5 * M2 * R * R; wf = I1 * w1 / (I1 + I2)
        sol = np.linalg.solve(np.array([[I1 + I2]]), np.array([I1 * w1])); agree(wf, sol[0], 1e-9, "wf")
        if M1 != M2:
            break
    key, ds = num_opts(wf, [("Averages the two angular speeds, $\\omega_1/2$.", w1 / 2), ("Conserves kinetic energy instead of angular momentum, $\\omega_1\\sqrt{I_1/(I_1+I_2)}$.", w1 * math.sqrt(I1 / (I1 + I2))), ("Uses the mass of the second disk, $I_2\\omega_1/(I_1+I_2)$.", I2 * w1 / (I1 + I2)), ("Keeps the original angular speed.", w1)], "rad/s")
    stem = f"A uniform disk of mass ${M1:g}\\text{{ kg}}$ and radius ${R:g}\\text{{ m}}$ spins at ${w1:g}\\text{{ rad/s}}$ about its central axle. A second, non-rotating disk of mass ${M2:g}\\text{{ kg}}$ and the same radius, on the same axle, is dropped onto it, and they spin together. What is the final angular speed? (The rotational inertia of each disk is $\\tfrac12MR^2$.)"
    return MQ("pc_ang_mom_disks", "6.4", "2.B", stem, key, ds, rng, "Conservation of angular momentum in a rotational inelastic collision", ["Write the initial and final angular momenta about the axle", "Solve for the common angular speed"],
              "numpy linalg.solve of the angular momentum balance recomputes the final speed", f"$I_1\\omega_1=(I_1+I_2)\\omega_f$ gives $\\omega_f={sig(wf)}\\text{{ rad/s}}$.", [f"M1={M1}", f"M2={M2}", f"R={R}", f"w1={w1}"], est=100)


@retry_sep
def pc_skater_ke_ratio(rng):
    k = pick(rng, [2, 3, 4]); ans = float(k)
    key, ds = num_opts(ans, [("Reports that the kinetic energy is unchanged, because angular momentum is conserved.", 1.0), ("Reports $k^2$, as if the kinetic energy were proportional to the square of the angular speed at constant inertia.", float(k * k)), ("Reports $1/k$, assuming the energy decreases.", 1.0 / k), ("Reports $\\sqrt{k}$.", math.sqrt(k))], "", fmt=lambda v: f"${sig(v, 3)}$")
    stem = f"A skater spins with arms extended. The skater pulls the arms in so that the rotational inertia decreases to $1/{k}$ of its original value. Friction is negligible. By what factor does the rotational kinetic energy of the skater change?"
    return MQ("pc_skater_ke_ratio", "6.4", "2.D", stem, key, ds, rng, "Kinetic energy change when angular momentum is conserved", ["Use angular momentum conservation to find the new angular speed", "Compare $\\tfrac12I\\omega^2=L^2/(2I)$ before and after"],
              "the kinetic energy is evaluated numerically from $L^2/(2I)$ before and after", f"$K=L^2/(2I)$ with $L$ fixed, so $K$ is multiplied by ${k}$.", [f"k={k}"], est=85, judg=["law_selection", "proportional_reasoning"])


@retry_sep
def pc_rolling_incline_speed(rng):
    shapes = [("a solid sphere", 0.4), ("a solid cylinder", 0.5), ("a thin spherical shell", 2 / 3), ("a hoop", 1.0)]
    nm, c = pick(rng, shapes); h = pick(rng, [0.5, 1.0, 1.5, 2.0])
    v = math.sqrt(2 * CG * h / (1 + c)); agree(0.5 * v * v * (1 + c), CG * h, 1e-9, "E")
    cs = f"{c:.3g}"
    key, ds = num_opts(v, [(f"Ignores the rotational energy, $\\sqrt{{2gh}}={sig(math.sqrt(2 * CG * h))}\\text{{ m/s}}$.", math.sqrt(2 * CG * h)), (f"Multiplies by $(1+{cs})$ instead of dividing, $\\sqrt{{2gh(1+{cs})}}$.", math.sqrt(2 * CG * h * (1 + c))), (f"Puts all of the energy into rotation, $\\sqrt{{2gh/{cs}}}$.", math.sqrt(2 * CG * h / c)), ("Drops the factor of two in the energy balance, $\\sqrt{gh/(1+" + cs + ")}$.", math.sqrt(CG * h / (1 + c)))], "m/s")
    stem = f"{nm[0].upper() + nm[1:]} of mass $M$ and radius $R$ (rotational inertia $I={cs}\\,MR^2$) rolls without slipping from rest down a ramp and drops a vertical height of ${h:g}\\text{{ m}}$. What is the speed of its center of mass at the bottom?"
    return MQ("pc_rolling_incline_speed", "6.5", "2.B", stem, key, ds, rng, "Energy conservation for rolling without slipping", ["Split the kinetic energy into translational and rotational parts with $\\omega=v/R$", "Equate the total to the gravitational energy lost"],
              "the energy balance is recomputed numerically", f"$mgh=\\tfrac12mv^2+\\tfrac12({cs}mR^2)(v/R)^2$ gives $v=\\sqrt{{2gh/(1+{cs})}}={sig(v)}\\text{{ m/s}}$.", [f"c={c}", f"h={h}"], est=100)





@retry_sep
def pc_angular_impulse_speed(rng):
    for _ in forever():
        c = pick(rng, [2.0, 3.0, 4.0, 6.0]); T = pick(rng, [2.0, 3.0, 4.0]); I = pick(rng, [0.5, 1.0, 2.0]); w = c * T ** 2 / (2 * I)
        y = rk4(lambda tt, s: np.array([c * tt / I]), [0.0], 0.0, T, 4000); agree(w, y[0], 1e-6, "w")
        if w > 2:
            break
    key, ds = num_opts(w, [("Treats the torque as constant at its final value, $cT^2/I$.", c * T * T / I), ("Forgets to divide by the rotational inertia.", c * T ** 2 / 2), ("Uses the final torque over the inertia, $cT/I$.", c * T / I), ("Integrates twice, $cT^3/(6I)$.", c * T ** 3 / (6 * I))], "rad/s")
    stem = f"A wheel with rotational inertia ${I:g}\\text{{ kg·m}}^2$ starts from rest. A net torque $\\tau(t)={c:g}t$ (in newton-meters, $t$ in seconds) acts on it. What is its angular speed at $t={T:g}\\text{{ s}}$?"
    return MQ("pc_angular_impulse_speed", "6.3", "2.B", stem, key, ds, rng, "Angular impulse equals the change in angular momentum", ["Integrate the torque over time", "Divide the change in angular momentum by the rotational inertia"],
              "an RK4 integration of the angular acceleration recomputes the angular speed", f"$L=\\int_0^T ct\\,dt=cT^2/2$ and $\\omega=L/I={sig(w)}\\text{{ rad/s}}$.", [f"c={c}", f"T={T}", f"I={I}"], est=95)


@retry_sep
def pc_orbit_circular_speed(rng):
    for _ in forever():
        Me = pick(rng, [5.97e24, 6.42e23, 1.90e27]); r = pick(rng, [7.0e6, 1.0e7, 2.0e7, 4.0e7]) if Me < 1e25 else pick(rng, [1.0e8, 2.0e8])
        v = math.sqrt(GNEWT * Me / r)
        s0 = np.array([r, 0.0, 0.0, v]); fg = lambda t, s: np.array([s[2], s[3], -GNEWT * Me * s[0] / (s[0] ** 2 + s[1] ** 2) ** 1.5, -GNEWT * Me * s[1] / (s[0] ** 2 + s[1] ** 2) ** 1.5])  # noqa: E731
        s1 = rk4(fg, s0, 0.0, 2 * math.pi * r / v / 4, 3000); agree(math.hypot(s1[0], s1[1]), r, 1e-5, "r")
        break
    key, ds = num_opts(v, [("Omits the square root, $GM/r$.", GNEWT * Me / r), ("Uses $\\sqrt{GM/r^2}$, the field strength.", math.sqrt(GNEWT * Me / r ** 2)), ("Uses $\\sqrt{2GM/r}$, the escape speed.", math.sqrt(2 * GNEWT * Me / r)), ("Uses $\\sqrt{GMr}$.", math.sqrt(GNEWT * Me * r))], "m/s", fmt=lambda val: _sci(val, "m/s"))
    stem = f"A satellite orbits a planet of mass {_sci(Me, "kg")} in a circular orbit of radius {_sci(r, "m")} measured from the planet's center. Use $G=6.67\\times10^{{-11}}\\text{{ N·m}}^2/\\text{{kg}}^2$. What is the orbital speed of the satellite?"
    stem = stem.replace("e+", "\\times 10^{").replace("{24 ", "{24} ") if False else stem
    return MQ("pc_orbit_circular_speed", "6.6", "2.B", stem, key, ds, rng, "Gravity provides the centripetal force in a circular orbit", ["Set the gravitational force equal to the centripetal force", "Solve for the speed"],
              "an RK4 integration of the orbit with this speed keeps the radius constant", f"$v=\\sqrt{{GM/r}}={_sci(v, 'm/s').strip('$')}$.", [f"M={Me}", f"r={r}"], est=100)


@retry_sep
def pc_orbit_energy_ratio(rng):
    which = rng.randrange(2)
    if which == 0:
        ans = -1.0; q = "the total mechanical energy to the kinetic energy"; why = "For a circular orbit $K=GMm/2r$, $U=-GMm/r$, so $E=K+U=-K$ and $E/K=-1$."
        wr = [("Reports $+1$, treating the total energy as equal to the kinetic energy.", 1.0), ("Reports $-2$, which is the ratio $U/K$ of the potential energy to the kinetic energy, not $E/K$.", -2.0), ("Reports $-1/2$, which is the ratio $E/U$ of the total energy to the potential energy.", -0.5), ("Reports $+2$, the magnitude of $U/K$ with the sign dropped.", 2.0)]
    else:
        ans = -2.0; q = "the gravitational potential energy to the kinetic energy"; why = "For a circular orbit $K=GMm/2r$ and $U=-GMm/r$, so $U/K=-2$."
        wr = [("Reports $-1$, which is the ratio $E/K$ of the total energy to the kinetic energy, not $U/K$.", -1.0), ("Reports $-1/2$, which is the ratio $K/U$ with the two energies swapped.", -0.5), ("Reports $+2$, giving the potential energy a positive sign.", 2.0), ("Reports $+1$, treating the potential energy as equal to the kinetic energy.", 1.0)]
    m_, M_, r_ = 1.0, 2.0, 1.0; K = 0.5 * m_ * (M_ / r_); U = -m_ * M_ / r_
    agree(ans, (K + U) / K if which == 0 else U / K, 1e-9, "ratio")
    key, ds = signed_opts(ans, wr, "", fmt=lambda v: f"${sig(v, 3)}$")
    stem = f"A satellite moves in a circular orbit around a planet. Take the gravitational potential energy to be zero at infinite separation. What is the ratio of {q}?"
    return MQ("pc_orbit_energy_ratio", "6.6", "2.D", stem, key, ds, rng, "Energies of a circular orbit", ["Find the kinetic energy from the centripetal condition", "Compare with $U=-GMm/r$"],
              "the energies are evaluated numerically for a sample orbit", why, [f"which={which}"], est=85, judg=["law_selection", "proportional_reasoning"])


@retry_sep
def pc_kepler_period_scaling(rng):
    k = pick(rng, [2, 4, 9]); ans = float(k) ** 1.5
    key, ds = num_opts(ans, [("Scales linearly with the orbital radius.", float(k)), ("Scales as the square of the radius.", float(k * k)), ("Scales as the square root of the radius.", math.sqrt(k)), ("Does not change, because the planet is the same.", 1.0)], "", fmt=lambda v: f"${sig(v, 3)}$")
    stem = f"Satellite 2 orbits a planet in a circular orbit with a radius ${k}$ times the radius of the circular orbit of satellite 1. What is the ratio of the period of satellite 2 to the period of satellite 1?"
    return MQ("pc_kepler_period_scaling", "6.6", "2.D", stem, key, ds, rng, "Kepler's third law", ["Derive $T\\propto r^{3/2}$ from gravity providing the centripetal force", "Apply the radius factor"],
              "the periods are computed numerically from $T=2\\pi\\sqrt{r^3/GM}$ at the two radii", f"$T\\propto r^{{3/2}}$, so the ratio is ${k}^{{3/2}}={sig(ans)}$.", [f"k={k}"], est=75, judg=["law_selection", "proportional_reasoning"])


@retry_sep
def pc_ellipse_speed_ratio(rng):
    for _ in forever():
        rp = pick(rng, [7.0e6, 8.0e6, 1.0e7]); ra = rp * pick(rng, [2.0, 3.0, 4.0]); vp = pick(rng, [8000.0, 9000.0, 10000.0]); va = rp * vp / ra
        agree(va, (rp * vp) / ra, 1e-9, "va")
        break
    key, ds = num_opts(va, [("Uses $v_a=v_p\\,r_a/r_p$, inverting the ratio.", vp * ra / rp), ("Uses the square of the ratio, $v_pr_p^2/r_a^2$.", vp * (rp / ra) ** 2), ("Uses the square root of the ratio.", vp * math.sqrt(rp / ra)), ("Keeps the speed the same.", vp)], "m/s", fmt=lambda v: _sci(v, "m/s"))
    stem = f"A satellite moves in an elliptical orbit around a planet. At its closest approach it is {_sci(rp, "m")} from the center of the planet and moves at {_sci(vp, "m/s")}. At its farthest point it is {_sci(ra, "m")} from the center. What is its speed at the farthest point?"
    return MQ("pc_ellipse_speed_ratio", "6.3", "2.B", stem, key, ds, rng, "Conservation of angular momentum for an orbit", ["Recognize that the force is central so angular momentum is conserved", "At the two turning points the velocity is perpendicular to the radius so $rv$ is equal"],
              "the angular momentum per unit mass is computed at both points numerically", f"$r_pv_p=r_av_a$ gives $v_a={_sci(va, 'm/s').strip('$')}$.", [f"rp={rp}", f"ra={ra}", f"vp={vp}"], est=95)


@retry_sep
def pc_particle_ang_mom_line(rng):
    for _ in forever():
        m = pick(rng, [0.5, 1.0, 2.0]); v = pick(rng, [3.0, 4.0, 5.0, 8.0]); d = pick(rng, [2.0, 3.0, 4.0]); L = m * v * d
        r = np.array([5.0, d]); p = np.array([-m * v, 0.0]); agree(abs(L), abs(float(r[0] * p[1] - r[1] * p[0])), 1e-9, "L")
        break
    key, ds = num_opts(L, [(f"Squares the distance, $mvd^2={sig(m * v * d * d)}$, as in a rotational inertia.", m * v * d * d), (f"Squares the speed, $mv^2d={sig(m * v * v * d)}$, as in a kinetic energy.", m * v * v * d), (f"Divides by the distance instead of multiplying, $mv/d={sig(m * v / d)}$.", m * v / d), (f"Leaves out the mass, $vd={sig(v * d)}$.", v * d)], "", fmt=lambda val: "$" + sig(val) + "\\text{ kg·m}^{2}\\text{/s}$")
    stem = f"A ${m:g}\\text{{ kg}}$ particle moves in a straight line at a constant speed of ${v:g}\\text{{ m/s}}$. The line of motion passes ${d:g}\\text{{ m}}$ from a point $O$ at its closest. What is the magnitude of the angular momentum of the particle about $O$?"
    return MQ("pc_particle_ang_mom_line", "6.3", "2.B", stem, key, ds, rng, "Angular momentum of a particle moving in a straight line", ["Identify the perpendicular distance from the point to the line of motion", "Use the relation $L=mvd$ with that perpendicular distance"],
              "the two-dimensional cross product of a sample position and the momentum recomputes the magnitude", f"$L=mvd={sig(L)}\\text{{ kg·m}}^{{2}}\\text{{/s}}$, independent of where the particle is on its line.", [f"m={m}", f"v={v}", f"d={d}"], est=90)


@retry_sep
def pc_bullet_rod_pivot(rng):
    for _ in forever():
        M = pick(rng, [1.0, 2.0, 3.0]); L = pick(rng, [0.5, 1.0, 1.5]); m = pick(rng, [0.02, 0.05, 0.10]); v = pick(rng, [100.0, 200.0, 300.0])
        I = M * L * L / 3 + m * L * L; w = m * v * L / I
        sol = np.linalg.solve(np.array([[I]]), np.array([m * v * L])); agree(w, sol[0], 1e-9, "w")
        break
    key, ds = num_opts(w, [("Omits the bullet from the final rotational inertia, $mvL/(ML^2/3)$.", m * v * L / (M * L * L / 3)), ("Uses the center-pivot rod value, $ML^2/12$.", m * v * L / (M * L * L / 12 + m * L * L)), ("Conserves linear momentum instead, $mv/(M+m)$.", m * v / (M + m)), ("Uses $I=ML^2$ for the rod.", m * v * L / (M * L * L + m * L * L))], "rad/s")
    stem = f"A uniform rod of mass ${M:g}\\text{{ kg}}$ and length ${L:g}\\text{{ m}}$ hangs at rest from a frictionless pivot at its upper end. A ${m * 1000:g}\\text{{ g}}$ bullet moving horizontally at ${v:g}\\text{{ m/s}}$ strikes the lower end and embeds. The rotational inertia of the rod about the pivot is $\\tfrac13ML^2$. What is the angular speed of the rod and bullet just after the collision?"
    return MQ("pc_bullet_rod_pivot", "6.4", "2.B", stem, key, ds, rng, "Angular momentum conservation about a pivot", ["Conserve angular momentum about the pivot because the pivot's force has no torque about it", "Include the bullet in the final rotational inertia"],
              "numpy linalg.solve of the angular momentum balance recomputes the angular speed", f"$mvL=(\\tfrac13ML^2+mL^2)\\omega$ gives $\\omega={sig(w)}\\text{{ rad/s}}$.", [f"M={M}", f"L={L}", f"m={m}", f"v={v}"], est=115)


@retry_sep
def pc_escape_speed(rng):
    for _ in forever():
        km = pick(rng, [0.5, 2.0, 4.0, 10.0]); kr = pick(rng, [0.5, 1.0, 2.0, 3.0]); ME = 5.97e24; RE = 6.37e6; Mp = km * ME; Rp = kr * RE
        v = math.sqrt(2 * GNEWT * Mp / Rp); vb = bisect(lambda s: 0.5 * s * s - GNEWT * Mp / Rp, 1.0, 1e6); agree(v, vb, 1e-9, "v")
        if km != kr:
            break
    key, ds = num_opts(v, [("Uses the orbital speed at the surface, $\\sqrt{GM/R}$.", math.sqrt(GNEWT * Mp / Rp)), ("Omits the square root, $2GM/R$.", 2 * GNEWT * Mp / Rp), ("Uses $\\sqrt{2GM/R^2}$.", math.sqrt(2 * GNEWT * Mp / Rp ** 2)), ("Uses $\\sqrt{2GMR}$.", math.sqrt(2 * GNEWT * Mp * Rp))], "m/s", fmt=lambda val: _sci(val, "m/s"))
    stem = f"A planet has mass {_sci(Mp, "kg")} and radius {_sci(Rp, "m")}. Use $G=6.67\\times10^{{-11}}\\text{{ N·m}}^2/\\text{{kg}}^2$. What is the minimum speed needed for a projectile launched from the surface to escape the planet's gravity, ignoring air resistance and the planet's rotation?"
    return MQ("pc_escape_speed", "6.6", "2.B", stem, key, ds, rng, "Escape speed from energy conservation", ["Set the total energy at the surface to zero for the minimum escape condition", "Solve $\\tfrac12v^2=GM/R$"],
              "a bisection root finder on the total energy recomputes the escape speed", f"$\\tfrac12mv^2=GMm/R$ gives $v={_sci(v, 'm/s').strip('$')}$.", [f"km={km}", f"kr={kr}"], est=95)


@retry_sep
def pc_rolling_speed_ratio(rng):
    pairs = [("a solid cylinder", 0.5, "a hoop", 1.0), ("a solid sphere", 0.4, "a hoop", 1.0), ("a solid sphere", 0.4, "a solid cylinder", 0.5), ("a solid cylinder", 0.5, "a thin spherical shell", 2 / 3)]
    for _ in forever():
        n1, c1, n2, c2 = pick(rng, pairs); h = pick(rng, [0.5, 1.0, 2.0])
        ratio = math.sqrt((1 + c2) / (1 + c1)); v1 = math.sqrt(2 * CG * h / (1 + c1)); v2 = math.sqrt(2 * CG * h / (1 + c2)); agree(ratio, v1 / v2, 1e-9, "ratio")
        if abs(ratio - 1) > 0.1:
            break
    key, ds = num_opts(ratio, [(f"Uses the ratio of the rotational inertia coefficients, $\\dfrac{{{c2:.3g}}}{{{c1:.3g}}}={sig(c2 / c1)}$, without the energy balance.", c2 / c1), (f"Inverts the ratio, $\\sqrt{{(1+{c1:.3g})/(1+{c2:.3g})}}={sig(1 / ratio)}$.", 1 / ratio), (f"Omits the square root, $(1+{c2:.3g})/(1+{c1:.3g})={sig((1 + c2) / (1 + c1))}$.", (1 + c2) / (1 + c1)), (f"Uses $\\sqrt{{{c2:.3g}/{c1:.3g}}}={sig(math.sqrt(c2 / c1))}$, leaving the translational energy out of the denominator.", math.sqrt(c2 / c1))], "", fmt=lambda val: f"${sig(val, 3)}$")
    stem = f"{n1[0].upper() + n1[1:]} (rotational inertia ${c1:.3g}\\,MR^2$) and {n2} (rotational inertia ${c2:.3g}\\,MR^2$), with the same mass and radius, are released from rest at the same height and roll without slipping down the same ramp. What is the ratio of the speed of the center of mass of the first object to that of the second object at the bottom?"
    return MQ("pc_rolling_speed_ratio", "6.5", "2.B", stem, key, ds, rng, "Comparing rolling speeds from the rotational inertia coefficient", ["Write the speed at the bottom as $\\sqrt{2gh/(1+c)}$ for each object", "Take the ratio of the two speeds"],
              "the two speeds are computed from the energy balance and divided", f"$v\\propto 1/\\sqrt{{1+c}}$, so $v_1/v_2=\\sqrt{{(1+{c2:.3g})/(1+{c1:.3g})}}={sig(ratio)}$.", [f"c1={c1}", f"c2={c2}"], est=100)


STAGE_U6 = ["pc_rot_ke_flywheel", "pc_work_torque_integral", "pc_ang_mom_disks", "pc_skater_ke_ratio", "pc_rolling_incline_speed", "pc_rolling_speed_ratio", "pc_angular_impulse_speed", "pc_orbit_circular_speed",
            "pc_orbit_energy_ratio", "pc_kepler_period_scaling", "pc_ellipse_speed_ratio", "pc_particle_ang_mom_line", "pc_bullet_rod_pivot", "pc_escape_speed"]
