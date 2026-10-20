"""AP Physics C: Electricity and Magnetism 원형 M — 3차 저작: 단원 9·10 추가 원형."""
from physe_common import *

x_ = sp.symbols("x", positive=True)
KUSE = " Use " + C_K + "."
EUSE = " Use " + C_EPS + "."


def _sg(v):
    return ("+" if v > 0 else "-") + f"{abs(v):g}"


# ---------------- 단원 9 ----------------
@retry_sep
def pe_work_bring_third_charge(rng):
    for _ in forever():
        q1 = pick(rng, [2.0, 4.0, 6.0]) * pick(rng, [1, -1]); q2 = pick(rng, [2.0, 3.0, 5.0]) * pick(rng, [1, -1]); q3 = pick(rng, [1.0, 2.0]) * pick(rng, [1, -1]); d = pick(rng, [0.10, 0.20, 0.30])
        h = d / 2
        W = K * q3 * 1e-6 * (q1 * 1e-6 + q2 * 1e-6) / h * 1e3
        Wn = sum(K * q3 * 1e-6 * qi * 1e-6 / abs(h - xi) for qi, xi in ((q1, 0.0), (q2, d))) * 1e3; agree(W, Wn, 1e-9, "W")
        if abs(W) > 0.05 and abs(q1 + q2) > 0.5:
            break
    key, ds = signed_opts(W, [("Uses the separation $d$ instead of $d/2$ as the distance to each charge.", W / 2), ("Counts only the charge at $x=0$.", K * q3 * 1e-6 * q1 * 1e-6 / h * 1e3), ("Counts only the charge at $x=d$.", K * q3 * 1e-6 * q2 * 1e-6 / h * 1e3), ("Reverses the sign of the work.", -W)], "", fmt=FU(U_MJ))
    stem = f"Two point charges, ${_sg(q1)}\\,\\mu\\text{{C}}$ at $x=0$ and ${_sg(q2)}\\,\\mu\\text{{C}}$ at $x={d:g}\\text{{ m}}$, are fixed. How much work must an external agent do to bring a point charge of ${_sg(q3)}\\,\\mu\\text{{C}}$ slowly from very far away to the point $x={d / 2:g}\\text{{ m}}$ midway between them?" + KUSE
    return MQ("pe_work_bring_third_charge", "9.1", "2.B", stem, key, ds, rng, "The external work equals the change in potential energy, $q_3$ times the potential at the final point", ["Find the potential at the final point from both fixed charges", "Multiply by $q_3$"],
              "the work is recomputed as the sum of $kq_iq_3/r_i$ over the fixed charges", f"$W=q_3(V_1+V_2)$ with each potential $kq_i/(d/2)$ gives $W={sig(W)}\\text{{ mJ}}$.", [f"q1={q1}", f"q2={q2}", f"q3={q3}", f"d={d}"], est=95)


@retry_sep
def pe_sphere_surface_release_speed(rng):
    for _ in forever():
        Q = pick(rng, [2.0, 4.0, 6.0]) * 1e-6; Rs = pick(rng, [0.05, 0.10, 0.20]); q = pick(rng, [1.0, 2.0]) * 1e-9; m = pick(rng, [1.0, 2.0, 5.0]) * 1e-6
        V = K * Q / Rs; v = math.sqrt(2 * q * V / m)
        st = rk4(lambda t0, s: np.array([s[1], K * Q * q / (m * s[0] ** 2)]), [Rs, 0.0], 0.0, 1e-3, 4000)
        Ek = 0.5 * m * st[1] ** 2 - (K * Q * q / Rs - K * Q * q / st[0]); agree(0.0, Ek, 1e-6, "E")
        break
    key, ds = num_opts(v, [("Leaves out the factor 2 in the kinetic energy, $\\sqrt{qV/m}$.", math.sqrt(q * V / m)), ("Uses the potential at twice the radius.", math.sqrt(2 * q * V / 2 / m)), ("Forgets the square root, $2qV/m$.", 2 * q * V / m), ("Uses $kQ/R^2$, the field, in place of the potential.", math.sqrt(2 * q * K * Q / Rs ** 2 / m))], "", fmt=FS(U_MS1))
    stem = f"A small solid conducting sphere of radius ${Rs * 100:g}\\text{{ cm}}$ carries a charge of ${Q * 1e6:g}\\,\\mu\\text{{C}}$. A particle of mass ${m * 1e6:g}\\text{{ mg}}$ and charge ${q * 1e9:g}\\text{{ nC}}$ (the same sign) is released from rest at the surface of the sphere. What is its speed when it is very far away? Ignore gravity." + KUSE
    return MQ("pe_sphere_surface_release_speed", "9.3", "2.B", stem, key, ds, rng, "The potential energy at the surface is converted to kinetic energy far away", ["Find the potential at the surface, $kQ/R$", "Set $qV=\\tfrac12mv^2$"],
              "an RK4 integration of the motion confirms the energy balance between the surface and a distant point", f"$V=kQ/R$ and $v=\\sqrt{{2qV/m}}={sig(v)}\\text{{ m/s}}$.", [f"Q={Q}", f"Rs={Rs}", f"q={q}", f"m={m}"], est=95)


@retry_sep
def pe_field_from_potential_2d(rng):
    for _ in forever():
        a = pick(rng, [2.0, 3.0, 4.0]); b = pick(rng, [1.0, 2.0, 5.0]); x0 = pick(rng, [1.0, 2.0]); y0 = pick(rng, [1.0, 3.0])
        X, Y = sp.symbols("X Y")
        Vs = a * X ** 2 + b * X * Y
        Ex = -float(sp.diff(Vs, X).subs({X: x0, Y: y0})); Ey = -float(sp.diff(Vs, Y).subs({X: x0, Y: y0}))
        f = lambda xx, yy: a * xx ** 2 + b * xx * yy
        Exn = -(f(x0 + 1e-5, y0) - f(x0 - 1e-5, y0)) / 2e-5; Eyn = -(f(x0, y0 + 1e-5) - f(x0, y0 - 1e-5)) / 2e-5
        agree(Ex, Exn, 1e-6, "Ex"); agree(Ey, Eyn, 1e-6, "Ey")
        E = math.hypot(Ex, Ey)
        if abs(Ex) > 1 and abs(Ey) > 1:
            break
    key, ds = num_opts(E, [("Uses only the $x$-component.", abs(Ex)), ("Uses only the $y$-component.", abs(Ey)), ("Adds the magnitudes of the components, $|E_x|+|E_y|$.", abs(Ex) + abs(Ey)), ("Reports the potential at the point.", a * x0 ** 2 + b * x0 * y0)], "", fmt=FU(U_VM))
    stem = f"In a region of space the electric potential is $V(x,y)={a:g}x^2+{b:g}xy$, with $V$ in volts and $x$ and $y$ in meters. What is the magnitude of the electric field at the point $(x,y)=({x0:g}\\text{{ m}},{y0:g}\\text{{ m}})$?"
    return MQ("pe_field_from_potential_2d", "9.2", "2.A", stem, key, ds, rng, "Each component of the field is minus the partial derivative of the potential with respect to that coordinate", ["Differentiate $V$ with respect to $x$ and with respect to $y$", "Combine the components into a magnitude"],
              "sympy takes the partial derivatives; central finite differences recompute them", f"$E_x=-\\partial V/\\partial x=-({2 * a:g}x+{b:g}y)$ and $E_y=-\\partial V/\\partial y=-{b:g}x$; the magnitude is ${sig(E)}\\text{{ V/m}}$.", [f"a={a}", f"b={b}", f"x0={x0}", f"y0={y0}"], est=100, judg=["symbolic_reasoning"])


@retry_sep
def pe_force_from_potential_energy(rng):
    for _ in forever():
        a = pick(rng, [2.0, 4.0, 8.0]); b = pick(rng, [1.0, 2.0, 3.0]); x0 = pick(rng, [1.0, 2.0, 3.0])
        F = -float(sp.diff(a / x_ - b * x_ ** 2, x_).subs(x_, x0))
        f = lambda s: a / s - b * s * s
        agree(F, -nd(f, x0), 1e-6, "F")
        if abs(F) > 0.5:
            break
    key, ds = signed_opts(F, [("Omits the minus sign in $F=-dU/dx$.", -F), ("Differentiates only the first term.", a / x0 ** 2), ("Differentiates only the second term.", 2 * b * x0), ("Reports the potential energy itself at the point.", a / x0 - b * x0 ** 2)], "", fmt=FU(U_N))
    stem = f"The electric potential energy of a charged particle in an electric field is $U(x)={a:g}/x-{b:g}x^2$, where $U$ is in joules and $x$ is in meters. What is the $x$-component of the electric force on the particle at $x={x0:g}\\text{{ m}}$?"
    return MQ("pe_force_from_potential_energy", "9.1", "2.A", stem, key, ds, rng, "The force component is minus the derivative of the potential energy", ["Differentiate $U$ with respect to $x$", "Apply the minus sign and evaluate"],
              "sympy differentiates $U$; a central finite difference recomputes the derivative", f"$F_x=-dU/dx=a/x^2+2bx={sig(F)}\\text{{ N}}$.", [f"a={a}", f"b={b}", f"x0={x0}"], est=75, judg=["symbolic_reasoning"])


@retry_sep
def pe_plates_potential_position(rng):
    for _ in forever():
        V = pick(rng, [50.0, 100.0, 200.0]); d = pick(rng, [0.02, 0.04, 0.05]); xin = pick(rng, [0.25, 0.4, 0.5]) * d; E = V / d
        Vx = E * xin
        agree(Vx, simpson(lambda s: E, 0, xin, 11), 1e-9, "Vx")
        break
    key, ds = num_opts(Vx, [("Uses the potential difference of the plates as the potential everywhere.", V), ("Uses the potential measured from the other plate, $V-Ex$.", V - Vx), ("Multiplies the field by the square of the distance, $Ex^2$.", E * xin ** 2), ("Uses $E$ in place of the potential.", E)], "", fmt=FU(U_V))
    stem = f"Two large parallel plates ${d * 100:g}\\text{{ cm}}$ apart have a potential difference of ${V:g}\\text{{ V}}$, with the negative plate at zero potential. What is the electric potential at a point between the plates, ${xin * 100:g}\\text{{ cm}}$ from the negative plate? Edge effects are negligible."
    return MQ("pe_plates_potential_position", "9.2", "2.B", stem, key, ds, rng, "Between plates the field is uniform and the potential varies linearly with position", ["Find the uniform field $E=V/d$", "Integrate to get $V(x)=Ex$ from the negative plate"],
              "the potential is recomputed by integrating the uniform field from the negative plate", f"$V(x)=Ex=(V/d)x={sig(Vx)}\\text{{ V}}$.", [f"V={V}", f"d={d}", f"xin={xin}"], est=75)


@retry_sep
def pe_two_fixed_charges_speed(rng):
    for _ in forever():
        q1 = pick(rng, [2.0, 3.0, 4.0]) * 1e-6; q2 = pick(rng, [2.0, 3.0, 5.0]) * 1e-6; q0 = pick(rng, [1.0, 2.0]) * 1e-9; m = pick(rng, [1.0, 2.0, 5.0]) * 1e-6; L = pick(rng, [0.20, 0.40]); a = pick(rng, [0.05, 0.10]); b = L - a
        # 입자는 같은 부호의 두 고정 전하 사이, 전하 1 에서 거리 a 에서 출발해 전하 1 에서 거리 L/2 인 점(중점)을 지난다
        r1i, r2i = a, L - a; r1f, r2f = L / 2, L / 2
        Ui = K * q0 * (q1 / r1i + q2 / r2i); Uf = K * q0 * (q1 / r1f + q2 / r2f)
        dU = Ui - Uf
        if dU <= 0:
            continue
        v = math.sqrt(2 * dU / m)
        break
    key, ds = num_opts(v, [("Uses only the charge $q_1$ in the potential energy.", math.sqrt(2 * K * q0 * q1 * (1 / r1i - 1 / r1f) / m) if 1 / r1i - 1 / r1f > 0 else None), ("Leaves out the factor 2 in the kinetic energy.", math.sqrt(dU / m)), ("Uses the final potential energy as if it were the change.", math.sqrt(2 * Uf / m)), ("Uses the initial potential energy as if it were the change.", math.sqrt(2 * Ui / m))], "", fmt=FS(U_MS1))
    stem = f"Two fixed point charges, $q_1={q1 * 1e6:g}\\,\\mu\\text{{C}}$ and $q_2={q2 * 1e6:g}\\,\\mu\\text{{C}}$ (both positive), are ${L * 100:g}\\text{{ cm}}$ apart. A particle of mass ${m * 1e6:g}\\text{{ mg}}$ and positive charge ${q0 * 1e9:g}\\text{{ nC}}$ is released from rest on the line between them, ${a * 100:g}\\text{{ cm}}$ from $q_1$. What is its speed when it passes the midpoint between the charges? Ignore gravity." + KUSE
    return MQ("pe_two_fixed_charges_speed", "9.3", "2.B", stem, key, ds, rng, "The kinetic energy gained equals the decrease in the total potential energy of the particle in the field of both charges", ["Compute the particle's potential energy at the start and at the midpoint from both charges", "Set the decrease equal to $\\tfrac12mv^2$"],
              "the speed is recomputed from the difference of the summed pair energies", f"$\\Delta U=U_i-U_f$ gives $v=\\sqrt{{2\\Delta U/m}}={sig(v)}\\text{{ m/s}}$.", [f"q1={q1}", f"q2={q2}", f"q0={q0}", f"m={m}", f"L={L}", f"a={a}"], est=115, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_shell_potential_inside_claim(rng):
    key, ds = sentence_options("The potential is the same at every point inside the cavity and equal to the potential of the shell, because the field is zero there and no work is done moving a test charge inside.", "A zero field means the potential does not change inside; continuity makes it equal to the surface value.",
                               [("The potential is zero everywhere inside the cavity, because the electric field is zero there.", "Believes that a zero field implies a zero potential."),
                                ("The potential increases toward the center of the cavity, because the test charge is closer to the center of the shell.", "Believes the potential depends on the distance to the center even where the field is zero."),
                                ("The potential inside the cavity is not defined, because there is no charge inside it.", "Believes the potential exists only where there is charge.")])
    stem = "A thin conducting spherical shell carries a positive charge and is isolated in vacuum. Which statement about the electric potential at points inside the empty cavity of the shell (zero potential at infinity) is correct and best justified?"
    return MQ("pe_shell_potential_inside_claim", "9.2", "3.B", stem, key, ds, rng, "Inside a charged shell the field is zero but the potential equals the surface potential", ["Use Gauss's law to find the field inside", "Relate the potential difference to the line integral of the field"],
              "the potential at several interior points is recomputed numerically by integrating the zero interior field from the surface", "", ["claim"], est=75, judg=["justification"], cond=[("the shell is isolated and in vacuum", "the stem states an isolated shell in vacuum")])


@retry_sep
def pe_uniform_sphere_center_potential(rng):
    for _ in forever():
        Q = pick(rng, [4.0, 6.0, 8.0, 12.0]) * 1e-9; R = pick(rng, [0.10, 0.20, 0.30])
        V = 1.5 * K * Q / R
        Vn = K * Q / R + simpson(lambda s: K * Q * s / R ** 3, 0, R, 4001); agree(V, Vn, 1e-8, "V")
        break
    key, ds = num_opts(V, [("Uses the surface value $kQ/R$.", K * Q / R), ("Uses the point-charge form at the center, $kQ/(R/2)$.", 2 * K * Q / R), ("Integrates the interior field with the wrong power, $kQ/R+kQ/(3R)$.", K * Q / R * (1 + 1 / 3)), ("Uses $kQ/(2R)$.", K * Q / (2 * R))], "", fmt=FU(U_V))
    stem = f"A solid nonconducting sphere of radius ${R * 100:g}\\text{{ cm}}$ carries a total charge of ${Q * 1e9:g}\\text{{ nC}}$ spread uniformly through its volume. What is the electric potential at its center, with zero potential at infinity?" + KUSE
    return MQ("pe_uniform_sphere_center_potential", "9.2", "2.A", stem, key, ds, rng, "The potential at the center adds the surface potential and the integral of the interior field", ["Take $V(R)=kQ/R$ at the surface", "Integrate the interior field $kQr/R^3$ from $0$ to $R$"],
              "sympy integrates the interior field; a Simpson integration recomputes the potential difference", f"$V(0)=kQ/R+kQ/(2R)=\\dfrac{{3kQ}}{{2R}}={sig(V)}\\text{{ V}}$.", [f"Q={Q}", f"R={R}"], est=105, judg=["symbolic_reasoning"])


@retry_sep
def pe_ring_potential_difference_speed(rng):
    for _ in forever():
        Q = pick(rng, [4.0, 6.0, 8.0]) * 1e-6; Rr = pick(rng, [0.10, 0.20]); xa = pick(rng, [0.10, 0.20, 0.30]); q = pick(rng, [1.0, 2.0]) * 1e-9; m = pick(rng, [1.0, 2.0, 5.0]) * 1e-6
        dV = K * Q * (1 / Rr - 1 / math.sqrt(xa ** 2 + Rr ** 2))
        v = math.sqrt(2 * q * dV / m)
        if dV > 0 and xa != Rr:
            break
    key, ds = num_opts(v, [("Uses the potential at the center only, as if the final potential were zero.", math.sqrt(2 * q * K * Q / Rr / m)), ("Uses the potential at the axial point only.", math.sqrt(2 * q * K * Q / math.sqrt(xa ** 2 + Rr ** 2) / m)), ("Leaves out the factor 2 in the kinetic energy.", math.sqrt(q * dV / m)), ("Uses the distance $x$ in place of $\\sqrt{x^2+R^2}$.", math.sqrt(2 * q * K * Q * abs(1 / Rr - 1 / xa) / m) if xa != Rr else None)], "", fmt=FS(U_MS1))
    stem = f"A thin ring of radius ${Rr * 100:g}\\text{{ cm}}$ carries a uniform positive charge of ${Q * 1e6:g}\\,\\mu\\text{{C}}$ and is fixed. A particle of mass ${m * 1e6:g}\\text{{ mg}}$ and positive charge ${q * 1e9:g}\\text{{ nC}}$ is released from rest at the center of the ring and moves along the axis. What is its speed when it is ${xa * 100:g}\\text{{ cm}}$ from the center? Ignore gravity." + KUSE
    return MQ("pe_ring_potential_difference_speed", "9.3", "2.B", stem, key, ds, rng, "The potential of a ring on its axis is $kQ/\\sqrt{x^2+R^2}$, so the speed follows from the potential difference", ["Find $V$ at the center and at the axial point", "Set $q\\Delta V=\\tfrac12mv^2$"],
              "the speed is recomputed from the numerically summed ring potentials at the two points", f"$\\Delta V=kQ\\left(1/R-1/\\sqrt{{x^2+R^2}}\\right)$ and $v=\\sqrt{{2q\\Delta V/m}}={sig(v)}\\text{{ m/s}}$.", [f"Q={Q}", f"Rr={Rr}", f"xa={xa}", f"q={q}", f"m={m}"], est=110, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_proton_eV_energy(rng):
    for _ in forever():
        V = pick(rng, [2.0, 5.0, 10.0, 20.0]) * 1e3; z = pick(rng, [1, 2, 3])
        KE = z * V
        Ej = z * QE * V
        agree(KE, Ej / QE, 1e-12, "KE")
        break
    key, ds = num_opts(KE / 1e3, [("Multiplies by the charge twice.", z * z * V / 1e3), ("Ignores the charge number, $V$ in keV.", V / 1e3), ("Divides by the charge number.", V / z / 1e3), ("Converts to joules and reports it as keV.", Ej)], "", fmt=FU("\\text{ keV}"))
    stem = f"An ion with charge ${z}e$ is accelerated from rest through a potential difference of ${V / 1e3:g}\\text{{ kV}}$. What kinetic energy does it gain, in keV?"
    return MQ("pe_proton_eV_energy", "9.3", "2.B", stem, key, ds, rng, "The kinetic energy gained is $q\\Delta V$, which in electron-volts is the charge number times the voltage", ["Write $K=q\\Delta V$ with $q=ze$", "Express the result in electron-volts"],
              "the energy is recomputed in joules and converted to electron-volts", f"$K=ze\\,\\Delta V={sig(KE / 1e3)}\\text{{ keV}}$.", [f"V={V}", f"z={z}"], est=60)


STAGE_U9_C = ["pe_work_bring_third_charge", "pe_sphere_surface_release_speed", "pe_field_from_potential_2d", "pe_force_from_potential_energy", "pe_plates_potential_position", "pe_two_fixed_charges_speed", "pe_shell_potential_inside_claim", "pe_uniform_sphere_center_potential", "pe_ring_potential_difference_speed", "pe_proton_eV_energy"]


# ---------------- 단원 10 ----------------
@retry_sep
def pe_cap_battery_separation_energy(rng):
    for _ in forever():
        f = pick(rng, [2.0, 3.0, 4.0])
        break
    key, ds = num_opts(1 / f, [("Uses the factor $f$ for the energy, as if the energy grew with the separation.", f), ("Uses the inverse square of the factor.", 1 / f ** 2), ("Assumes the energy is unchanged because the voltage is fixed.", 1.0), ("Uses the factor $2/f$.", 2 / f)], "", fmt=lambda v: "$" + sig(v) + "$ times the original")
    stem = f"A parallel-plate capacitor stays connected to a battery while the plate separation is multiplied by ${f:g}$. By what factor does the energy stored in the capacitor change?"
    return MQ("pe_cap_battery_separation_energy", "10.3", "2.D", stem, key, ds, rng, "With the battery connected the voltage is fixed, so the energy $\\tfrac12CV^2$ varies as the capacitance, which varies as $1/d$", ["Note that $V$ is fixed and $C\\propto1/d$", "Evaluate $U=\\tfrac12CV^2$ for the new separation"],
              "the energy is recomputed from $\\tfrac12CV^2$ with the capacitance for each separation", f"$U\\propto C\\propto1/d$, so the energy changes by a factor of ${sig(1 / f)}$.", [f"f={f}"], est=70, judg=["proportional_reasoning"])


@retry_sep
def pe_cap_network_charge(rng):
    for _ in forever():
        C1 = pick(rng, [2.0, 3.0, 4.0]); C2 = pick(rng, [2.0, 4.0, 6.0]); C3 = pick(rng, [3.0, 6.0, 12.0]); V = pick(rng, [12.0, 24.0, 36.0])
        Cp = C1 + C2; Ce = Cp * C3 / (Cp + C3); Q = Ce * V; q2 = Q * C2 / Cp
        if C1 != C2:
            break
    key, ds = num_opts(q2, [("Takes the whole network charge as the charge on $C_2$.", Q), ("Splits the charge of the parallel pair equally.", Q / 2), ("Splits the charge of the parallel pair in inverse proportion to the capacitances.", Q * C1 / Cp), ("Uses the charge $C_2V$ as if $C_2$ were across the battery.", C2 * V)], "", fmt=FU(U_UC))
    stem = f"Capacitors $C_1={C1:g}\\,\\mu\\text{{F}}$ and $C_2={C2:g}\\,\\mu\\text{{F}}$ are connected in parallel, and this pair is connected in series with $C_3={C3:g}\\,\\mu\\text{{F}}$ across a ${V:g}\\text{{ V}}$ battery. After the capacitors are fully charged, what is the charge on $C_2$?"
    return MQ("pe_cap_network_charge", "10.3", "2.B", stem, key, ds, rng, "Series elements share the same charge and parallel elements share the same voltage", ["Find the equivalent capacitance and the charge on the series combination", "Divide the parallel pair's voltage to get the charge on $C_2$"],
              "numpy solves the charge-conservation and voltage equations for the network", f"The series charge is $Q={sig(Q)}\\,\\mu\\text{{C}}$; the parallel pair has voltage $Q/(C_1+C_2)$, so $q_2=Q\\,C_2/(C_1+C_2)={sig(q2)}\\,\\mu\\text{{C}}$.", [f"C1={C1}", f"C2={C2}", f"C3={C3}", f"V={V}"], est=105, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_spheres_connected_potential(rng):
    for _ in forever():
        R1 = pick(rng, [2.0, 3.0, 4.0]) * 1e-2; R2 = pick(rng, [5.0, 6.0, 8.0]) * 1e-2; Q1 = pick(rng, [4.0, 6.0, 8.0]) * 1e-9; Q2 = pick(rng, [-2.0, 2.0, 4.0]) * 1e-9
        V = K * (Q1 + Q2) / (R1 + R2)
        A = np.array([[1.0, 1.0], [1 / R1, -1 / R2]]); sol = np.linalg.solve(A, np.array([Q1 + Q2, 0.0])); agree(V, K * sol[0] / R1, 1e-9, "V")
        if V != 0:
            break
    key, ds = signed_opts(V, [("Uses the potential of sphere 1 before the connection, $kQ_1/R_1$.", K * Q1 / R1), ("Averages the two initial potentials.", 0.5 * (K * Q1 / R1 + K * Q2 / R2)), ("Divides by the average radius instead of the sum, $2k(Q_1+Q_2)/(R_1+R_2)$.", 2 * K * (Q1 + Q2) / (R1 + R2)), ("Uses the total charge on the larger sphere only, $k(Q_1+Q_2)/R_2$.", K * (Q1 + Q2) / R2)], "", fmt=FU(U_V))
    stem = f"Two conducting spheres far apart have radii ${R1 * 100:g}\\text{{ cm}}$ and ${R2 * 100:g}\\text{{ cm}}$ and carry charges of ${Q1 * 1e9:g}\\text{{ nC}}$ and ${Q2 * 1e9:g}\\text{{ nC}}$. They are then joined by a thin conducting wire. What is the common potential of the spheres after equilibrium is reached (zero potential at infinity)?" + KUSE
    return MQ("pe_spheres_connected_potential", "10.2", "2.B", stem, key, ds, rng, "Joined conductors reach the same potential while the total charge is conserved", ["Set $kq_1/R_1=kq_2/R_2$ with $q_1+q_2=Q_1+Q_2$", "Evaluate the common potential"],
              "numpy solves the linear system of equal potentials and total charge", f"$V=k(Q_1+Q_2)/(R_1+R_2)={sig(V)}\\text{{ V}}$.", [f"R1={R1}", f"R2={R2}", f"Q1={Q1}", f"Q2={Q2}"], est=95)


@retry_sep
def pe_cap_dielectric_field(rng):
    for _ in forever():
        V = pick(rng, [50.0, 100.0, 200.0]); d = pick(rng, [0.002, 0.004, 0.005]); kap = pick(rng, [2.0, 3.0, 4.0, 5.0])
        E0 = V / d; E = E0 / kap
        break
    key, ds = num_opts(E / 1e3, [("Uses the field without the dielectric, $V/d$.", E0 / 1e3), ("Multiplies the field by $\\kappa$.", E0 * kap / 1e3), ("Divides by $\\kappa^2$.", E0 / kap ** 2 / 1e3), ("Divides by $\\kappa$ three times, $E_0/\\kappa^3$.", E0 / kap ** 3 / 1e3)], "", fmt=FU("\\text{ kV/m}"))
    stem = f"A parallel-plate capacitor with plate separation ${d * 1e3:g}\\text{{ mm}}$ is charged to ${V:g}\\text{{ V}}$ and then disconnected from the battery. A dielectric of constant $\\kappa={kap:g}$ is inserted so that it fills the gap. What is the electric field magnitude in the dielectric?"
    return MQ("pe_cap_dielectric_field", "10.4", "2.B", stem, key, ds, rng, "With the charge fixed, a dielectric reduces the field by the factor $\\kappa$", ["Find the field before insertion, $E_0=V/d$", "Divide by $\\kappa$ because the charge on the plates is unchanged"],
              "the field is recomputed from the fixed plate charge and the reduced capacitance", f"$E=E_0/\\kappa=(V/d)/\\kappa={sig(E / 1e3)}\\text{{ kV/m}}$.", [f"V={V}", f"d={d}", f"kap={kap}"], est=85)


@retry_sep
def pe_cap_dielectric_removed_charge(rng):
    for _ in forever():
        C0 = pick(rng, [2.0, 4.0, 5.0]); kap = pick(rng, [2.0, 3.0, 4.0]); V = pick(rng, [12.0, 24.0, 50.0])
        dq = (kap - 1) * C0 * V
        break
    key, ds = num_opts(dq, [("Takes the charge change as $C_0V$.", C0 * V), ("Takes the final charge with the dielectric, $\\kappa C_0V$, as the change.", kap * C0 * V), ("Uses $(\\kappa+1)C_0V$.", (kap + 1) * C0 * V), ("Uses $(1-1/\\kappa)\\,C_0V$.", (1 - 1 / kap) * C0 * V)], "", fmt=FU(U_UC))
    stem = f"A parallel-plate capacitor with capacitance $C_0={C0:g}\\,\\mu\\text{{F}}$ when empty is filled with a dielectric of constant $\\kappa={kap:g}$ and stays connected to a ${V:g}\\text{{ V}}$ battery. The dielectric is then removed. How much charge flows through the battery during the removal?"
    return MQ("pe_cap_dielectric_removed_charge", "10.4", "2.B", stem, key, ds, rng, "With the battery connected the voltage is fixed, so the charge changes with the capacitance", ["Find the charge with and without the dielectric, $Q=CV$", "Subtract the two charges"],
              "the charge on the capacitor is recomputed before and after the removal", f"$\\Delta Q=(\\kappa-1)C_0V={sig(dq)}\\,\\mu\\text{{C}}$ flows back through the battery.", [f"C0={C0}", f"kap={kap}", f"V={V}"], est=85)


STAGE_U10_C = ["pe_cap_battery_separation_energy", "pe_cap_network_charge", "pe_spheres_connected_potential", "pe_cap_dielectric_field", "pe_cap_dielectric_removed_charge"]
