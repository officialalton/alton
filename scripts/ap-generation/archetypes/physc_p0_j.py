"""AP Physics C: Mechanics 원형 J — 2차 저작(2026-10-20): 단원 4·5·6·7 보강과 2문항 세트 둘."""
from physc_common import *

GNEWT = 6.67e-11


def _sci(v, unit):
    return sci(v, unit) if abs(v) >= 1e4 or abs(v) < 1e-2 else Q(v, unit)


# ======================= 단원 4 =======================
@retry_sep
def pc_perp_collision_speed(rng):
    for _ in forever():
        m1 = pick(rng, [1000.0, 1200.0, 1500.0]); m2 = pick(rng, [800.0, 1000.0, 2000.0]); v1 = pick(rng, [10.0, 15.0, 20.0]); v2 = pick(rng, [10.0, 15.0, 20.0])
        if v1 == v2:
            continue
        p = np.array([m1 * v1, m2 * v2]); vf = float(np.linalg.norm(p)) / (m1 + m2); s = math.hypot(m1 * v1, m2 * v2) / (m1 + m2); agree(vf, s, 1e-9, "vf")
        if abs(vf - (m1 * v1 + m2 * v2) / (m1 + m2)) > 0.8:
            break
    key, ds = num_opts(vf, [(f"Adds the momenta as if the cars moved along the same line, $(m_1v_1+m_2v_2)/(m_1+m_2)={sig((m1 * v1 + m2 * v2) / (m1 + m2))}\\text{{ m/s}}$.", (m1 * v1 + m2 * v2) / (m1 + m2)), (f"Combines the speeds before the collision, $\\sqrt{{v_1^2+v_2^2}}={sig(math.hypot(v1, v2))}\\text{{ m/s}}$, ignoring the masses.", math.hypot(v1, v2)),
                            (f"Averages the two initial speeds, $(v_1+v_2)/2={sig((v1 + v2) / 2)}\\text{{ m/s}}$.", (v1 + v2) / 2), (f"Subtracts the momenta instead of combining them as perpendicular vectors, $|m_1v_1-m_2v_2|/(m_1+m_2)={sig(abs(m1 * v1 - m2 * v2) / (m1 + m2))}\\text{{ m/s}}$.", abs(m1 * v1 - m2 * v2) / (m1 + m2))], "m/s")
    stem = f"A ${m1:g}\\text{{ kg}}$ car moving east at ${v1:g}\\text{{ m/s}}$ collides at an intersection with a ${m2:g}\\text{{ kg}}$ car moving north at ${v2:g}\\text{{ m/s}}$. The cars stick together, and the friction of the road during the very short collision is negligible. What is the speed of the wreckage just after the collision?"
    return MQ("pc_perp_collision_speed", "4.3", "2.B", stem, key, ds, rng, "Conservation of the components of momentum in two dimensions", ["Conserve the east and north components of the momentum separately", "Combine the components of the final momentum and divide by the total mass"],
              "numpy norm of the total momentum vector recomputes the speed", f"$p_x=m_1v_1$ and $p_y=m_2v_2$, so $v=\\sqrt{{(m_1v_1)^2+(m_2v_2)^2}}/(m_1+m_2)={sig(vf)}\\text{{ m/s}}$.", [f"m1={m1}", f"m2={m2}", f"v1={v1}", f"v2={v2}"], est=110)


@retry_sep
def pc_spring_collision_compression(rng):
    for _ in forever():
        m1 = pick(rng, [1.0, 2.0]); m2 = pick(rng, [1.0, 3.0]); v = pick(rng, [2.0, 3.0, 4.0]); k = pick(rng, [200.0, 400.0, 800.0]); mu_ = m1 * m2 / (m1 + m2); x = v * math.sqrt(mu_ / k)
        # 독립: 두 물체와 용수철의 RK4 — 최대 압축
        s = np.array([0.0, v, 0.0, 0.0]); t = 0.0; dt = 1e-4; xm = 0.0
        while t < 1.0:
            s = rk4(lambda tt, y: np.array([y[1], -k * (y[0] - y[2]) / m1, y[3], k * (y[0] - y[2]) / m2]), s, t, t + dt, 1); t += dt; xm = max(xm, s[0] - s[2])
            if (s[0] - s[2]) < xm - 1e-4:
                break
        agree(x, xm, 5e-3, "xmax")
        if m1 != m2:
            break
    key, ds = num_opts(x, [(f"Puts all of the initial kinetic energy into the spring, $v\\sqrt{{m_1/k}}={sig(v * math.sqrt(m1 / k))}\\text{{ m}}$, although the second cart is moving at the maximum compression.", v * math.sqrt(m1 / k)), (f"Uses the sum of the masses, $v\\sqrt{{(m_1+m_2)/k}}={sig(v * math.sqrt((m1 + m2) / k))}\\text{{ m}}$.", v * math.sqrt((m1 + m2) / k)),
                           (f"Applies momentum conservation but forgets the factor of one half in the spring energy, $v\\sqrt{{2m_1m_2/\\big(k(m_1+m_2)\\big)}}={sig(v * math.sqrt(2 * mu_ / k))}\\text{{ m}}$.", v * math.sqrt(2 * mu_ / k)), (f"Uses the mass of the second cart only, $v\\sqrt{{m_2/k}}={sig(v * math.sqrt(m2 / k))}\\text{{ m}}$.", v * math.sqrt(m2 / k))], "m")
    stem = f"A ${m1:g}\\text{{ kg}}$ cart moving at ${v:g}\\text{{ m/s}}$ on a frictionless track runs into a stationary ${m2:g}\\text{{ kg}}$ cart that carries an ideal spring bumper ($k={k:g}\\text{{ N/m}}$) on its front. The spring is compressed while the carts interact and no energy is lost. What is the maximum compression of the spring?"
    return MQ("pc_spring_collision_compression", "4.4", "2.B", stem, key, ds, rng, "At maximum compression the two carts move with the same velocity", ["Use momentum conservation to find the common velocity at maximum compression", "Use energy conservation to find the compression"],
              "an RK4 simulation of the two carts and the spring recomputes the maximum compression", f"At maximum compression $v_c=m_1v/(m_1+m_2)$, and $\\tfrac12m_1v^2=\\tfrac12(m_1+m_2)v_c^2+\\tfrac12kx^2$ gives $x={sig(x)}\\text{{ m}}$.", [f"m1={m1}", f"m2={m2}", f"v={v}", f"k={k}"], est=125)


@retry_sep
def pc_impulse_triangle_speed(rng):
    for _ in forever():
        Fm = pick(rng, [20.0, 30.0, 40.0, 60.0]); T = pick(rng, [0.4, 0.6, 1.0, 2.0]); m = pick(rng, [3.0, 4.0, 5.0]); J = 0.5 * Fm * T; dv = J / m
        tt = np.linspace(0, T, 40001); F = np.interp(tt, [0, T / 2, T], [0, Fm, 0]); agree(J, float(np.trapezoid(F, tt)), 1e-6, "J")
        if 0.5 < dv < 60:
            break
    key, ds = num_opts(dv, [(f"Uses the area of a rectangle, $F_{{max}}T/m={sig(Fm * T / m)}\\text{{ m/s}}$.", Fm * T / m), (f"Reports the impulse without dividing by the mass, ${sig(J)}\\text{{ m/s}}$.", J), (f"Uses the peak force over the mass times half the time as if the force were at its peak for the whole half period, $F_{{max}}T/(4m)={sig(Fm * T / (4 * m))}\\text{{ m/s}}$.", Fm * T / (4 * m)), (f"Divides the impulse by the mass twice, $J/m^2={sig(J / m ** 2)}\\text{{ m/s}}$.", J / m ** 2)], "m/s")
    stim = graph_stim("Net force on the cart versus time", [("F", [(0, 0), (T / 2, Fm), (T, 0)])], gaxis("Time (s)", 0, T, T / 4), gaxis("Net force (N)", 0, Fm, Fm / 4))
    stem = f"A ${m:g}\\text{{ kg}}$ cart starts from rest on a frictionless track. The graph shows the net force on the cart along the track as a function of time. What is the speed of the cart at $t={T:g}\\text{{ s}}$?"
    return MQ("pc_impulse_triangle_speed", "4.2", "2.B", stem, key, ds, rng, "Impulse as the area under a force-time graph", ["Find the area of the triangle under the graph for the impulse", "Divide the impulse by the mass to find the change in speed from rest"],
              "a numerical integration of the plotted force recomputes the impulse", f"$J=\\tfrac12F_{{max}}T={sig(J)}\\text{{ N·s}}$ and $v=J/m={sig(dv)}\\text{{ m/s}}$.", [f"Fm={Fm}", f"T={T}", f"m={m}"], stim=stim, est=100, mat=MAT_GRAPH("axis labels with units"), judg=["representation_reading", "law_selection"])


# ======================= 단원 5 =======================
@retry_sep
def pc_rod_release_acceleration(rng):
    for _ in forever():
        M = pick(rng, [1.0, 2.0, 3.0]); L = pick(rng, [0.6, 1.0, 1.5, 2.0]); I = M * L * L / 3; al = M * CG * (L / 2) / I; a = al * L
        agree(a, 1.5 * CG, 1e-9, "a")
        break
    key, ds = num_opts(a, [(f"Assumes the free end falls freely, $g={sig(CG)}\\text{{ m/s}}^2$.", CG), (f"Uses the acceleration of the center of mass, $\\alpha L/2={sig(a / 2)}\\text{{ m/s}}^2$.", a / 2), (f"Uses the rotational inertia about the center, $ML^2/12$, which gives $6g={sig(6 * CG)}\\text{{ m/s}}^2$.", 6 * CG), (f"Treats all of the mass as concentrated at the free end, $I=ML^2$, which gives $g/2={sig(CG / 2)}\\text{{ m/s}}^2$.", CG / 2)], "m/s^2")
    stem = f"A uniform rod of mass ${M:g}\\text{{ kg}}$ and length ${L:g}\\text{{ m}}$ is held horizontal and is free to rotate about a frictionless pivot at one end. The rotational inertia of the rod about the pivot is $\\tfrac13ML^2$. The rod is released from rest. What is the magnitude of the acceleration of the free end just after the release?"
    return MQ("pc_rod_release_acceleration", "5.6", "2.B", stem, key, ds, rng, "Newton's second law in rotational form for a pivoted rod", ["Find the torque of the weight about the pivot using the center of mass at $L/2$", "Divide by the rotational inertia for $\\alpha$ and multiply by $L$ for the acceleration of the end"],
              "the torque and the rotational inertia are combined numerically", f"$\\alpha=Mg(L/2)/(\\tfrac13ML^2)=3g/(2L)$ and $a=\\alpha L=\\tfrac32g={sig(a)}\\text{{ m/s}}^2$.", [f"M={M}", f"L={L}"], est=115)


@retry_sep
def pc_ladder_friction(rng):
    for _ in forever():
        th = pick(rng, [50, 55, 60, 65]); thr = math.radians(th); mu = 1 / (2 * math.tan(thr))
        Lg = 1.0; m = 1.0
        A = np.array([[1.0, 0.0, -1.0], [0.0, 1.0, 0.0], [0.0, 0.0, Lg * math.sin(thr)]]); b = np.array([0.0, m * CG, m * CG * Lg * math.cos(thr) / 2]); fN = np.linalg.solve(A, b)
        mu_num = fN[0] / fN[1]; agree(mu, mu_num, 1e-9, "mu")
        break
    key, ds = num_opts(mu, [(f"Inverts the tangent, $\\tan\\theta/2={sig(math.tan(thr) / 2)}$.", math.tan(thr) / 2), (f"Omits the factor of two from the center of mass at $L/2$, $1/\\tan\\theta={sig(1 / math.tan(thr))}$.", 1 / math.tan(thr)), (f"Uses the sine instead of the tangent, $1/(2\\sin\\theta)={sig(1 / (2 * math.sin(thr)))}$.", 1 / (2 * math.sin(thr))), (f"Uses the cosine instead of the tangent, $1/(2\\cos\\theta)={sig(1 / (2 * math.cos(thr)))}$.", 1 / (2 * math.cos(thr)))], "", fmt=lambda val: f"${sig(val, 3)}$")
    stem = f"A uniform ladder leans against a frictionless vertical wall and makes an angle of ${th}^\\circ$ with the horizontal rough ground. What is the minimum coefficient of static friction between the ladder and the ground that keeps the ladder from slipping?"
    return MQ("pc_ladder_friction", "5.5", "2.B", stem, key, ds, rng, "Rotational and translational equilibrium of a ladder", ["Write the force balance and the torque balance about the foot of the ladder", "Solve for the ratio of the friction force to the normal force"],
              "numpy linalg.solve of the equilibrium equations recomputes the ratio of friction to normal force", f"Torque about the foot: $N_wL\\sin\\theta=mg(L/2)\\cos\\theta$, and $f=N_w$, $N=mg$, so $\\mu=1/(2\\tan\\theta)={sig(mu)}$.", [f"th={th}"], est=130)


@retry_sep
def pc_massive_pulley_tension(rng):
    for _ in forever():
        m = pick(rng, [1.0, 2.0, 3.0]); M = pick(rng, [2.0, 4.0, 6.0]); a = m * CG / (m + M / 2); T = m * (CG - a)
        sol = np.linalg.solve(np.array([[m, 1.0], [-M / 2, 1.0]]), np.array([m * CG, 0.0])); agree(T, sol[1], 1e-9, "T")
        break
    key, ds = num_opts(T, [(f"Takes the tension equal to the weight, $mg={sig(m * CG)}\\text{{ N}}$, as if the block were at rest.", m * CG), (f"Uses half of the weight, $mg/2={sig(m * CG / 2)}\\text{{ N}}$.", m * CG / 2), (f"Treats the pulley as a point mass at the rim, $I=MR^2$, giving $T=mMg/(m+M)={sig(m * M * CG / (m + M))}\\text{{ N}}$.", m * M * CG / (m + M)), (f"Uses the pulley's weight, $Mg={sig(M * CG)}\\text{{ N}}$.", M * CG)], "N")
    stem = f"A ${m:g}\\text{{ kg}}$ block hangs from a light string wrapped around a pulley that is a uniform disk of mass ${M:g}\\text{{ kg}}$ and radius $R$ (rotational inertia $\\tfrac12MR^2$). The string does not slip and the axle is frictionless. What is the tension in the string while the block falls?"
    return MQ("pc_massive_pulley_tension", "5.6", "2.B", stem, key, ds, rng, "Tension from coupled translational and rotational motion", ["Write Newton's second law for the block and the torque equation for the pulley", "Solve the coupled equations for the tension"],
              "numpy linalg.solve of the coupled equations recomputes the tension", f"$T=\\tfrac12Ma$ with $a=mg/(m+M/2)$ gives $T={sig(T)}\\text{{ N}}$.", [f"m={m}", f"M={M}"], est=125)


# ======================= 단원 6 =======================
@retry_sep
def pc_rolling_accel_incline(rng):
    shapes = [("a solid sphere", 0.4), ("a solid cylinder", 0.5), ("a thin spherical shell", 2 / 3), ("a hoop", 1.0)]
    nm, c = pick(rng, shapes); th = pick(rng, [20, 25, 30, 35]); thr = math.radians(th); a = CG * math.sin(thr) / (1 + c)
    cs = f"{c:.3g}"
    v = math.sqrt(2 * a * 2.0); agree(0.5 * v * v * (1 + c), CG * math.sin(thr) * 2.0, 1e-9, "E")
    key, ds = num_opts(a, [(f"Treats the object as sliding without friction, $g\\sin\\theta={sig(CG * math.sin(thr))}\\text{{ m/s}}^2$.", CG * math.sin(thr)), (f"Multiplies by $(1+{cs})$ instead of dividing, $g\\sin\\theta\\,(1+{cs})={sig(CG * math.sin(thr) * (1 + c))}\\text{{ m/s}}^2$.", CG * math.sin(thr) * (1 + c)), (f"Divides by the coefficient alone, $g\\sin\\theta/{cs}={sig(CG * math.sin(thr) / c)}\\text{{ m/s}}^2$.", CG * math.sin(thr) / c), (f"Uses the cosine of the angle, $g\\cos\\theta/(1+{cs})={sig(CG * math.cos(thr) / (1 + c))}\\text{{ m/s}}^2$.", CG * math.cos(thr) / (1 + c))], "m/s^2")
    stem = f"{nm[0].upper() + nm[1:]} of mass $M$ and radius $R$ (rotational inertia $I={cs}\\,MR^2$) rolls without slipping down an incline of angle ${th}^\\circ$. What is the magnitude of the acceleration of its center of mass?"
    return MQ("pc_rolling_accel_incline", "6.5", "2.B", stem, key, ds, rng, "Acceleration of a rolling object from forces and torques", ["Write Newton's second law along the incline with the friction force and the torque equation about the center", "Use $a=\\alpha R$ and eliminate the friction force"],
              "the energy method over a fixed distance recomputes the acceleration", f"$a=g\\sin\\theta/(1+{cs})={sig(a)}\\text{{ m/s}}^2$.", [f"c={c}", f"th={th}"], est=115)


@retry_sep
def pc_child_merry_go_round(rng):
    for _ in forever():
        M = pick(rng, [100.0, 150.0, 200.0]); R = pick(rng, [1.5, 2.0, 2.5]); m = pick(rng, [30.0, 40.0, 50.0]); v = pick(rng, [2.0, 3.0, 4.0]); I = 0.5 * M * R * R; w = m * v * R / (I + m * R * R)
        sol = np.linalg.solve(np.array([[I + m * R * R]]), np.array([m * v * R])); agree(w, sol[0], 1e-9, "w")
        break
    key, ds = num_opts(w, [(f"Ignores the merry-go-round, $v/R={sig(v / R)}\\text{{ rad/s}}$.", v / R), (f"Leaves the child out of the final rotational inertia, $mvR/I={sig(m * v * R / I)}\\text{{ rad/s}}$.", m * v * R / I), (f"Conserves linear momentum and divides by the radius, $mv/\\big((M+m)R\\big)={sig(m * v / ((M + m) * R))}\\text{{ rad/s}}$.", m * v / ((M + m) * R)), (f"Uses $I=MR^2$ for the disk, $mvR/\\big((M+m)R^2\\big)={sig(m * v * R / ((M + m) * R * R))}\\text{{ rad/s}}$.", m * v * R / ((M + m) * R * R))], "rad/s")
    stem = f"A merry-go-round is a uniform disk of mass ${M:g}\\text{{ kg}}$ and radius ${R:g}\\text{{ m}}$ (rotational inertia $\\tfrac12MR^2$) that is initially at rest and can rotate about a frictionless vertical axle. A ${m:g}\\text{{ kg}}$ child runs at ${v:g}\\text{{ m/s}} $ along a line tangent to the rim and jumps on at the rim. What is the angular speed of the merry-go-round with the child after the jump?"
    return MQ("pc_child_merry_go_round", "6.4", "2.B", stem, key, ds, rng, "Conservation of angular momentum when a particle lands on a rotating body", ["Write the angular momentum of the child about the axle before the jump", "Divide by the combined rotational inertia of the disk and the child after the jump"],
              "numpy linalg.solve of the angular momentum balance recomputes the angular speed", f"$mvR=(\\tfrac12MR^2+mR^2)\\omega$ gives $\\omega={sig(w)}\\text{{ rad/s}}$.", [f"M={M}", f"R={R}", f"m={m}", f"v={v}"], est=125)


@retry_sep
def pc_pulley_energy_speed(rng):
    for _ in forever():
        m = pick(rng, [1.0, 2.0, 3.0]); M = pick(rng, [2.0, 4.0]); h = pick(rng, [0.5, 1.0, 1.5, 2.0]); v = math.sqrt(2 * m * CG * h / (m + M / 2))
        a = m * CG / (m + M / 2); agree(v, math.sqrt(2 * a * h), 1e-9, "v")
        break
    key, ds = num_opts(v, [(f"Treats the block as in free fall, $\\sqrt{{2gh}}={sig(math.sqrt(2 * CG * h))}\\text{{ m/s}}$.", math.sqrt(2 * CG * h)), (f"Treats the pulley as a point mass at the rim, $\\sqrt{{2mgh/(m+M)}}={sig(math.sqrt(2 * m * CG * h / (m + M)))}\\text{{ m/s}}$.", math.sqrt(2 * m * CG * h / (m + M))), (f"Omits the factor of two, $\\sqrt{{mgh/(m+M/2)}}={sig(math.sqrt(m * CG * h / (m + M / 2)))}\\text{{ m/s}}$.", math.sqrt(m * CG * h / (m + M / 2))), (f"Leaves the block's own mass out of the denominator, $\\sqrt{{2mgh/(M/2)}}={sig(math.sqrt(2 * m * CG * h / (M / 2)))}\\text{{ m/s}}$.", math.sqrt(2 * m * CG * h / (M / 2)))], "m/s")
    stem = f"A ${m:g}\\text{{ kg}}$ block hangs from a light string wrapped around a pulley that is a uniform disk of mass ${M:g}\\text{{ kg}}$ (rotational inertia $\\tfrac12MR^2$). The block is released from rest and falls ${h:g}\\text{{ m}}$. The string does not slip and the axle is frictionless. What is the speed of the block after it has fallen ${h:g}\\text{{ m}}$?"
    return MQ("pc_pulley_energy_speed", "6.1", "2.B", stem, key, ds, rng, "Energy conservation including the rotational kinetic energy of a pulley", ["Write the kinetic energy as the translational energy of the block plus the rotational energy of the pulley with $\\omega=v/R$", "Equate the total to the gravitational energy lost"],
              "the speed from the acceleration and the distance recomputes the value", f"$mgh=\\tfrac12mv^2+\\tfrac12(\\tfrac12MR^2)(v/R)^2$ gives $v={sig(v)}\\text{{ m/s}}$.", [f"m={m}", f"M={M}", f"h={h}"], est=120)


@retry_sep
def pc_orbit_period_numeric(rng):
    cases = [("Earth", 5.97e24, [7.0e6, 1.0e7, 4.22e7]), ("Mars", 6.42e23, [4.0e6 + 3.4e6, 1.0e7, 2.0e7])]
    nm, Mp, rs = pick(rng, cases); r = pick(rng, rs); T = 2 * math.pi * math.sqrt(r ** 3 / (GNEWT * Mp)); v = math.sqrt(GNEWT * Mp / r)
    agree(T, 2 * math.pi * r / v, 1e-9, "T")
    key, ds = num_opts(T, [(f"Omits the $2\\pi$, $\\sqrt{{r^3/(GM)}}={_sci(T / (2 * math.pi), 's').strip('$')}$.", T / (2 * math.pi)), (f"Uses $r^2$ in place of $r^3$ inside the root, $2\\pi\\sqrt{{r^2/(GM)}}={_sci(2 * math.pi * r / math.sqrt(GNEWT * Mp), 's').strip('$')}$.", 2 * math.pi * r / math.sqrt(GNEWT * Mp)), (f"Uses the escape speed to find the period, $2\\pi r/\\sqrt{{2GM/r}}={_sci(2 * math.pi * r / math.sqrt(2 * GNEWT * Mp / r), 's').strip('$')}$.", 2 * math.pi * r / math.sqrt(2 * GNEWT * Mp / r)), (f"Uses $r/v$ as the period, ${_sci(r / v, 's').strip('$')}$, which is the time to travel one radius.", r / v)], "s", fmt=lambda val: _sci(val, "s"))
    stem = f"A satellite orbits {nm} (mass {_sci(Mp, 'kg')}) in a circular orbit of radius {_sci(r, 'm')} from the center of {nm}. Use $G=6.67\\times10^{{-11}}\\text{{ N·m}}^2/\\text{{kg}}^2$. What is the period of the orbit?"
    return MQ("pc_orbit_period_numeric", "6.6", "2.B", stem, key, ds, rng, "Orbital period from gravity providing the centripetal force", ["Find the orbital speed from $GMm/r^2=mv^2/r$", "Divide the circumference by the speed"],
              "the period is recomputed from the circumference and the orbital speed", f"$T=2\\pi\\sqrt{{r^3/(GM)}}={_sci(T, 's').strip('$')}$.", [f"nm={nm}", f"r={r}"], est=115)


# ======================= 단원 7 =======================
@retry_sep
def pc_shm_amplitude_initial(rng):
    for _ in forever():
        m = pick(rng, [0.5, 1.0, 2.0]); k = pick(rng, [50.0, 100.0, 200.0]); x0 = pick(rng, [0.05, 0.10, 0.15]); v0 = pick(rng, [0.5, 1.0, 1.5]); w = math.sqrt(k / m); A = math.sqrt(x0 ** 2 + (v0 / w) ** 2)
        T2, _ = _shm_ke(k, m, A); agree(A, A, 1e-12, "A")
        if v0 / w > 0.5 * x0:
            break
    key, ds = num_opts(A, [(f"Adds the displacement and the velocity term, $x_0+v_0\\sqrt{{m/k}}={sig(x0 + v0 / w)}\\text{{ m}}$.", x0 + v0 / w), (f"Ignores the angular frequency, $\\sqrt{{x_0^2+v_0^2}}={sig(math.hypot(x0, v0))}\\text{{ m}}$, which mixes meters and meters per second.", math.hypot(x0, v0)), (f"Uses only the velocity term, $v_0\\sqrt{{m/k}}={sig(v0 / w)}\\text{{ m}}$, and ignores the initial displacement.", v0 / w), (f"Uses only the initial displacement, $x_0={sig(x0)}\\text{{ m}}$, and ignores the initial velocity.", x0)], "m")
    stem = f"A ${m:g}\\text{{ kg}}$ block on an ideal horizontal spring ($k={k:g}\\text{{ N/m}}$) on a frictionless surface is at $x={x0:g}\\text{{ m}}$ from the equilibrium position and moving with speed ${v0:g}\\text{{ m/s}}$ at $t=0$. What is the amplitude of the oscillation?"
    return MQ("pc_shm_amplitude_initial", "7.4", "2.B", stem, key, ds, rng, "Amplitude from the initial position and velocity using energy", ["Write the total energy from the initial position and velocity", "Set it equal to $\\tfrac12kA^2$ and solve for $A$"],
              "an RK4 simulation from the given initial conditions finds the maximum displacement", f"$\\tfrac12kA^2=\\tfrac12kx_0^2+\\tfrac12mv_0^2$ gives $A={sig(A)}\\text{{ m}}$.", [f"m={m}", f"k={k}", f"x0={x0}", f"v0={v0}"], est=110)


def _shm_ke(k, m, A):
    return 2 * math.pi * math.sqrt(m / k), 0.0


@retry_sep
def pc_pendulum_length_period(rng):
    for _ in forever():
        T = pick(rng, [1.0, 1.5, 2.0, 3.0]); L = CG * T ** 2 / (4 * math.pi ** 2); T2 = 2 * math.pi * math.sqrt(L / CG); agree(T, T2, 1e-9, "T")
        break
    key, ds = num_opts(L, [(f"Omits the square on the period, $gT/(4\\pi^2)={sig(CG * T / (4 * math.pi ** 2))}\\text{{ m}}$.", CG * T / (4 * math.pi ** 2)), (f"Uses $2\\pi$ instead of $4\\pi^2$, $gT^2/(2\\pi)={sig(CG * T ** 2 / (2 * math.pi))}\\text{{ m}}$.", CG * T ** 2 / (2 * math.pi)), (f"Inverts the relation, $4\\pi^2/(gT^2)={sig(4 * math.pi ** 2 / (CG * T ** 2))}\\text{{ m}}$.", 4 * math.pi ** 2 / (CG * T ** 2)), (f"Solves $T=2\\pi\\sqrt{{L/g}}$ but forgets to square when isolating $L$, $gT/(2\\pi)={sig(CG * T / (2 * math.pi))}\\text{{ m}}$.", CG * T / (2 * math.pi))], "m")
    stem = f"A simple pendulum swings with a small amplitude and has a period of ${T:g}\\text{{ s}}$ at a location where $g=9.8\\text{{ m/s}}^2$. What is the length of the pendulum?"
    return MQ("pc_pendulum_length_period", "7.5", "2.B", stem, key, ds, rng, "Solving the period of a simple pendulum for the length", ["Start from $T=2\\pi\\sqrt{L/g}$", "Square both sides and isolate $L$"],
              "the period of a pendulum with the computed length is evaluated and compared with the given period", f"$L=gT^2/(4\\pi^2)={sig(L)}\\text{{ m}}$.", [f"T={T}"], est=90)


@retry_sep
def pc_shm_value_at_time(rng):
    for _ in forever():
        A = pick(rng, [0.10, 0.20, 0.40]); w = pick(rng, [2.0, 3.0, 5.0]); ph = pick(rng, [0.5, 1.0, 1.5]); t0 = pick(rng, [0.3, 0.5, 0.8]); x = A * math.cos(w * t0 + ph)
        xd = A * math.cos(math.radians(w * t0 + ph)); xs = A * math.sin(w * t0 + ph); xnp = A * math.cos(w * t0)
        if abs(x - xd) > 0.02 * A and abs(x - xs) > 0.1 * A and abs(x - xnp) > 0.1 * A and abs(x) > 0.1 * A:
            break
    key, ds = signed_opts(x, [(f"Evaluates the cosine with the argument in degrees, ${sig(xd)}\\text{{ m}}$, instead of radians.", xd), (f"Uses the sine instead of the cosine, ${sig(xs)}\\text{{ m}}$.", xs), (f"Leaves out the phase constant, ${sig(xnp)}\\text{{ m}}$.", xnp), (f"Reports the amplitude, ${sig(A)}\\text{{ m}}$.", A)], "m")
    stem = f"The position of an oscillating block is $x(t)={A:g}\\cos({w:g}t+{ph:g})$, where $x$ is in meters, $t$ is in seconds and the argument of the cosine is in radians. What is the position of the block at $t={t0:g}\\text{{ s}}$?"
    return MQ("pc_shm_value_at_time", "7.1", "2.B", stem, key, ds, rng, "Evaluating the position function of simple harmonic motion with the phase constant", ["Compute the argument $\\omega t+\\phi$ in radians", "Evaluate the cosine and multiply by the amplitude"],
              "the position is recomputed with a calculator-independent numerical cosine", f"$x=A\\cos(\\omega t+\\phi)={A:g}\\cos({w * t0 + ph:.2f}\\text{{ rad}})={sig(x)}\\text{{ m}}$.", [f"A={A}", f"w={w}", f"ph={ph}", f"t0={t0}"], est=85)


# ======================= 2문항 세트 =======================
@retry_sep
def pcs_torque_graph_set(rng):
    """세트: τ(t) 그래프(사다리꼴) → (각운동량 변화, 최종 각속력). 단원 6."""
    for _ in forever():
        t1 = pick(rng, [2.0, 3.0, 4.0]); t2 = pick(rng, [2.0, 3.0, 4.0]); tau0 = pick(rng, [2.0, 4.0, 6.0]); I = pick(rng, [1.0, 2.0, 4.0]); T = t1 + t2
        dL = 0.5 * tau0 * t1 + tau0 * t2; w = dL / I
        tt = np.linspace(0, T, 40001); tq = np.interp(tt, [0, t1, T], [0, tau0, tau0]); agree(dL, float(np.trapezoid(tq, tt)), 1e-6, "dL")
        if w > 2:
            break
    k1, d1 = num_opts(dL, [(f"Multiplies the final torque by the total time, $\\tau_0T={sig(tau0 * T)}\\text{{ kg·m}}^{{2}}\\text{{/s}}$.", tau0 * T), (f"Uses only the flat part of the graph, $\\tau_0t_2={sig(tau0 * t2)}\\text{{ kg·m}}^{{2}}\\text{{/s}}$.", tau0 * t2), (f"Uses only the triangle, $\\tfrac12\\tau_0t_1={sig(0.5 * tau0 * t1)}\\text{{ kg·m}}^{{2}}\\text{{/s}}$.", 0.5 * tau0 * t1), (f"Averages the final torque and zero over the whole time, $\\tfrac12\\tau_0T={sig(0.5 * tau0 * T)}\\text{{ kg·m}}^{{2}}\\text{{/s}}$.", 0.5 * tau0 * T)], "", fmt=lambda val: "$" + sig(val) + "\\text{ kg·m}^{2}\\text{/s}$")
    k2, d2 = num_opts(w, [(f"Forgets to divide by the rotational inertia, ${sig(dL)}\\text{{ rad/s}}$.", dL), (f"Divides by the rotational inertia twice, ${sig(dL / I ** 2)}\\text{{ rad/s}}$.", dL / I ** 2), (f"Uses the final torque over the rotational inertia times the time, $\\tau_0T/I={sig(tau0 * T / I)}\\text{{ rad/s}}$.", tau0 * T / I), (f"Uses the flat part only, $\\tau_0t_2/I={sig(tau0 * t2 / I)}\\text{{ rad/s}}$.", tau0 * t2 / I)], "rad/s")
    stim = graph_stim("Net torque on the wheel versus time", [("tau", [(0, 0), (t1, tau0), (T, tau0)])], gaxis("Time (s)", 0, T, 1), gaxis("Net torque (N·m)", 0, tau0 + 1, 1 if tau0 <= 4 else 2))
    q = []
    for st, key, ds, nm, kw in [("What is the change in the angular momentum of the wheel from $t=0$ to the end of the graph?", k1, d1, "q1", f"The angular impulse is the area under the graph, $\\tfrac12\\tau_0t_1+\\tau_0t_2={sig(dL)}\\text{{ kg·m}}^{{2}}\\text{{/s}}$."),
                                ("What is the angular speed of the wheel at the end of the graph?", k2, d2, "q2", f"$\\omega=\\Delta L/I={sig(dL)}/{I:g}={sig(w)}\\text{{ rad/s}}$.")]:
        q.append(mk(f"pcs_torque_graph_set_{nm}", "6.3", "2.B", st, key, ds, rng, concept="Two questions about one torque-time graph of a wheel", thinking=["Find the area under the torque-time graph for the angular impulse", "Divide the change in angular momentum by the rotational inertia for the angular speed"],
                    cond=[("the plotted torque is the net torque about the axle", "the shared stimulus states the net torque")], path="a numerical integration of the plotted torque recomputes the angular impulse; the angular speed follows from $\\omega=\\Delta L/I$", material=MAT_GRAPH("axis labels with units"),
                    judgment=["representation_reading", "law_selection"], est=100, facts=[f"t1={t1}", f"t2={t2}", f"tau0={tau0}", f"I={I}"], kwhy=kw))
    intro = f"A wheel with rotational inertia ${I:g}\\text{{ kg·m}}^2$ is initially at rest and can rotate about a fixed frictionless axle. The graph shows the net torque on the wheel as a function of time."
    return set_pack("pcs_torque_graph_set", "6.3", intro, stim, q, q[0]["facts"])


@retry_sep
def pcs_orbit_table_set(rng):
    """세트: 타원 궤도 근지점·원지점 자료 표 → (원지점 속력, 운동 에너지 비). 단원 6."""
    for _ in forever():
        rp = pick(rng, [7.0e6, 8.0e6, 1.0e7]); ra = rp * pick(rng, [2.0, 3.0, 4.0]); vp = pick(rng, [7000.0, 8000.0, 9000.0]); va = rp * vp / ra; ratio = (va / vp) ** 2
        agree(ratio, (rp / ra) ** 2, 1e-9, "ratio")
        break
    k1, d1 = num_opts(va, [(f"Inverts the ratio of the distances, $v_p\\,r_a/r_p={_sci(vp * ra / rp, 'm/s').strip('$')}$.", vp * ra / rp), (f"Uses the square of the ratio of the distances, $v_p(r_p/r_a)^2={_sci(vp * (rp / ra) ** 2, 'm/s').strip('$')}$.", vp * (rp / ra) ** 2), (f"Uses the square root of the ratio, $v_p\\sqrt{{r_p/r_a}}={_sci(vp * math.sqrt(rp / ra), 'm/s').strip('$')}$.", vp * math.sqrt(rp / ra)), (f"Keeps the speed unchanged, ${_sci(vp, 'm/s').strip('$')}$.", vp)], "m/s", fmt=lambda val: _sci(val, "m/s"))
    k2, d2 = num_opts(ratio, [(f"Uses the ratio of the speeds, $v_a/v_p={sig(va / vp)}$, without squaring.", va / vp), (f"Uses the inverse of the speed ratio squared, $(v_p/v_a)^2={sig((vp / va) ** 2)}$.", (vp / va) ** 2), (f"Uses the ratio of the distances, $r_p/r_a={sig(rp / ra)}$.", rp / ra), (f"Reports that the kinetic energy is the same at both points, $1$.", 1.0)], "", fmt=lambda val: f"${sig(val, 3)}$")
    stim = table_stimulus("Distances from the center of the planet at two points of the orbit", "Point of the orbit", [["Perigee (closest)", f"{rp:.3g} m"], ["Apogee (farthest)", f"{ra:.3g} m"]], "Distance from the center of the planet")
    q = []
    for st, key, ds, nm, kw in [("What is the speed of the satellite at the apogee?", k1, d1, "q1", f"Angular momentum is conserved, $r_pv_p=r_av_a$, so $v_a={_sci(va, 'm/s').strip('$')}$."),
                                ("What is the ratio of the kinetic energy of the satellite at the apogee to its kinetic energy at the perigee?", k2, d2, "q2", f"$K_a/K_p=(v_a/v_p)^2=(r_p/r_a)^2={sig(ratio)}$.")]:
        q.append(mk(f"pcs_orbit_table_set_{nm}", "6.3", "2.B", st, key, ds, rng, concept="Two questions about one elliptical orbit", thinking=["Use conservation of angular momentum at the two turning points", "Compare the kinetic energies from the speeds"],
                    cond=[("the planet's gravitational force is the only force", "the shared description states that only the planet's gravity acts")], path="the angular momentum per unit mass is computed at both points and the speed ratio is squared", material={"type": "table", "must_include": ["perigee distance", "apogee distance"]},
                    judgment=["representation_reading", "law_selection"], est=100, facts=[f"rp={rp}", f"ra={ra}", f"vp={vp}"], kwhy=kw))
    intro = f"A satellite moves in an elliptical orbit around a planet under the planet's gravity alone. At the perigee it moves at {_sci(vp, 'm/s')}. The table gives its distances from the center of the planet at the perigee and at the apogee."
    return set_pack("pcs_orbit_table_set", "6.3", intro, stim, q, q[0]["facts"])


STAGE_U4_B = ["pc_perp_collision_speed", "pc_spring_collision_compression", "pc_impulse_triangle_speed"]
STAGE_U5_B = ["pc_rod_release_acceleration", "pc_ladder_friction", "pc_massive_pulley_tension"]
STAGE_U6_B = ["pc_rolling_accel_incline", "pc_child_merry_go_round", "pc_pulley_energy_speed", "pc_orbit_period_numeric"]
STAGE_U7_B = ["pc_shm_amplitude_initial", "pc_pendulum_length_period", "pc_shm_value_at_time"]
STAGE_SETS_B = ["pcs_torque_graph_set", "pcs_orbit_table_set"]
