"""AP Physics C: Electricity and Magnetism 원형 L — 3차 저작: 단원 8·9·10 추가 원형(distractor 값은 모두 적힌 오개념의 규칙대로 계산)."""
from physe_common import *

x_ = sp.symbols("x", positive=True)
KUSE = " Use " + C_K + "."
EUSE = " Use " + C_EPS + "."
U_FLUX = "\\text{ N}\\cdot\\text{m}^{2}/\\text{C}"


def _sg(v):
    return ("+" if v > 0 else "-") + f"{abs(v):g}"


# ---------------- 단원 8 ----------------
@retry_sep
def pe_field_square_center(rng):
    for _ in forever():
        Q = [pick(rng, [2.0, 3.0, 4.0, 5.0]) * pick(rng, [1, -1]) for _ in range(4)]; a = pick(rng, [0.20, 0.30, 0.40])
        pos = [(a / 2, a / 2), (-a / 2, a / 2), (-a / 2, -a / 2), (a / 2, -a / 2)]  # 중심에서 본 네 모서리
        r2 = (a / math.sqrt(2)) ** 2
        Ev = np.zeros(2)
        for q_, p_ in zip(Q, pos):
            d = -np.array(p_); Ev += K * q_ * 1e-9 * d / np.linalg.norm(d) ** 3
        E = float(np.linalg.norm(Ev))
        if E > 100:
            break
    ssum = K * sum(abs(q_) for q_ in Q) * 1e-9 / r2
    first = K * abs(Q[0]) * 1e-9 / r2
    key, ds = num_opts(E, [("Adds the magnitudes of the four fields, ignoring their directions and signs.", ssum), ("Counts only the field of the first listed charge.", first), ("Adds the signed charges as a scalar and divides by $r^2$, as if the fields were scalars.", K * abs(sum(Q)) * 1e-9 / r2 if sum(Q) != 0 else None), ("Uses the side length $a$ as the distance from each corner.", E * 0.5)], "", fmt=FU(U_NCC))
    stem = f"Four point charges of ${_sg(Q[0])}\\text{{ nC}}$, ${_sg(Q[1])}\\text{{ nC}}$, ${_sg(Q[2])}\\text{{ nC}}$ and ${_sg(Q[3])}\\text{{ nC}}$ are fixed at the corners of a square of side ${a * 100:g}\\text{{ cm}}$, listed in order around the square. What is the magnitude of the electric field at the center of the square?" + KUSE
    return MQ("pe_field_square_center", "8.3", "2.B", stem, key, ds, rng, "The field at the center is the vector sum of four fields of equal distance, with directions set by the signs", ["Find the direction and magnitude of each field at the center", "Add the components and take the magnitude"],
              "the net field is recomputed as a vector sum with numpy using the corner coordinates", f"Each corner is $a/\\sqrt2$ from the center; the vector sum has magnitude ${sig(E)}\\text{{ N/C}}$.", [f"Q={Q}", f"a={a}"], est=115, judg=["law_selection", "vector_reasoning"])


@retry_sep
def pe_field_quarter_arc(rng):
    for _ in forever():
        Q = pick(rng, [4.0, 6.0, 8.0, 12.0]); R = pick(rng, [0.10, 0.20, 0.25])
        lam = Q * 1e-9 / (math.pi * R / 2)
        Ex = simpson(lambda t: K * lam * math.cos(t) / R, 0, math.pi / 2, 4001); Ey = simpson(lambda t: K * lam * math.sin(t) / R, 0, math.pi / 2, 4001)
        E = math.hypot(Ex, Ey); Ec = 2 * math.sqrt(2) * K * Q * 1e-9 / (math.pi * R * R); agree(E, Ec, 1e-7, "E")
        break
    key, ds = num_opts(E, [("Treats the arc as a point charge at distance $R$, $kQ/R^2$.", K * Q * 1e-9 / R ** 2), ("Gives only one component of the field, $2kQ/(\\pi R^2)$.", 2 * K * Q * 1e-9 / (math.pi * R * R)), ("Adds the two component magnitudes instead of combining them as perpendicular vectors, $4kQ/(\\pi R^2)$.", 4 * K * Q * 1e-9 / (math.pi * R * R)), ("Uses the chord length as the distance, $kQ/(\\sqrt2R)^2$.", K * Q * 1e-9 / (2 * R * R))], "", fmt=FU(U_NCC))
    stem = f"A thin wire is bent into a quarter of a circle of radius ${R * 100:g}\\text{{ cm}}$ and carries a uniform charge of ${Q:g}\\text{{ nC}}$. What is the magnitude of the electric field at the center of the circle?" + KUSE
    return MQ("pe_field_quarter_arc", "8.4", "2.A", stem, key, ds, rng, "The field of an arc is found by integrating the components of the fields of its elements", ["Write the two components $k\\lambda\\cos\\theta/R$ and $k\\lambda\\sin\\theta/R$ integrated over $0$ to $\\pi/2$", "Combine the perpendicular components"],
              "sympy integrates the components; a Simpson integration recomputes both components", f"Each component is $k\\lambda/R$ with $\\lambda=2Q/(\\pi R)$, so $E=\\sqrt2\\,k\\lambda/R={sig(E)}\\text{{ N/C}}$.", [f"Q={Q}", f"R={R}"], est=115, judg=["symbolic_reasoning"])


@retry_sep
def pe_flux_line_charge_cylinder(rng):
    for _ in forever():
        lam = pick(rng, [2.0, 4.0, 5.0, 8.0]); L = pick(rng, [0.20, 0.50, 1.0]); Rc = pick(rng, [2.0, 5.0, 10.0])
        phi = lam * 1e-9 * L / EPS0
        Er = 2 * K * lam * 1e-9 / (Rc * 1e-2); phin = Er * 2 * math.pi * (Rc * 1e-2) * L; agree(phi, phin, 3e-3, "phi")
        break
    key, ds = num_opts(phi, [("Divides by $4\\pi\\varepsilon_0$ as well, $\\lambda L/(4\\pi\\varepsilon_0)$.", lam * 1e-9 * L / (4 * math.pi * EPS0)), ("Uses the area of the curved surface times the field at the wrong distance of $1\\text{ m}$, $2k\\lambda\\cdot2\\pi RL$ with $R$ in centimeters.", 2 * K * lam * 1e-9 / (Rc * 1e-2) * 2 * math.pi * Rc * L), ("Leaves out the length, $\\lambda/\\varepsilon_0$.", lam * 1e-9 / EPS0), ("Includes a factor of 2, $2\\lambda L/\\varepsilon_0$.", 2 * lam * 1e-9 * L / EPS0)], "", fmt=FS(U_FLUX))
    stem = f"A very long straight wire carries a uniform linear charge density of ${lam:g}\\text{{ nC/m}}$. What is the net electric flux through a closed cylinder of radius ${Rc:g}\\text{{ cm}}$ and length ${L:g}\\text{{ m}}$ whose axis is the wire (including its end faces)?" + EUSE
    return MQ("pe_flux_line_charge_cylinder", "8.5", "2.B", stem, key, ds, rng, "The net flux through a closed surface depends only on the enclosed charge, $\\lambda L$ here", ["Find the charge enclosed by the cylinder", "Divide by $\\varepsilon_0$"],
              "the flux is recomputed as the field $2k\\lambda/R$ times the curved area (the end faces carry no flux)", f"$\\Phi=\\lambda L/\\varepsilon_0={sig(phi)}\\text{{ N}}\\cdot\\text{{m}}^2/\\text{{C}}$ independent of the radius.", [f"lam={lam}", f"L={L}", f"Rc={Rc}"], est=85)


@retry_sep
def pe_gauss_slab(rng):
    for _ in forever():
        rho = pick(rng, [1.0, 2.0, 4.0]) * 1e-6; d = pick(rng, [0.10, 0.20]); xin = pick(rng, [0.25, 0.5]) * d / 2; place = pick(rng, ["inside", "outside"])
        if place == "inside":
            E = rho * xin / EPS0; pos = xin
        else:
            E = rho * d / (2 * EPS0); pos = d
        break
    if place == "inside":
        wr = [("Uses the field of a single sheet, $\\rho x/(2\\varepsilon_0)$.", rho * xin / (2 * EPS0)), ("Uses the exterior value $\\rho d/(2\\varepsilon_0)$ inside the slab.", rho * d / (2 * EPS0)), ("Uses $\\rho d/\\varepsilon_0$.", rho * d / EPS0), ("Uses $\\rho x/(4\\varepsilon_0)$.", rho * xin / (4 * EPS0))]
    else:
        wr = [("Doubles the field, $\\rho d/\\varepsilon_0$.", rho * d / EPS0), ("Uses half of the thickness, $\\rho d/(4\\varepsilon_0)$.", rho * d / (4 * EPS0)), ("Uses $\\rho d/(2\\varepsilon_0)$ with $d$ in centimeters.", rho * d * 100 / (2 * EPS0)), ("Uses $\\rho d^2/(2\\varepsilon_0)$.", rho * d * d / (2 * EPS0))]
    key, ds = num_opts(E, wr, "", fmt=FS(U_NCC))
    where = f"a distance of ${xin * 100:g}\\text{{ cm}}$ from the central plane, inside the slab" if place == "inside" else f"a point outside the slab"
    stem = f"A very large nonconducting slab of thickness ${d * 100:g}\\text{{ cm}}$ has a uniform volume charge density of ${rho * 1e6:g}\\,\\mu\\text{{C/m}}^{{3}}$. What is the magnitude of the electric field at {where}?" + EUSE
    return MQ("pe_gauss_slab", "8.6", "2.A", stem, key, ds, rng, "A Gaussian pillbox symmetric about the central plane encloses a charge proportional to its half-thickness", ["Choose a pillbox symmetric about the central plane", "Find the enclosed charge for the stated region and apply Gauss's law"],
              "the enclosed charge for the pillbox is recomputed and the field from Gauss's law is compared with the closed form", f"The field is ${sig(E / 1e3)}\\times10^{{3}}\\text{{ N/C}}$.", [f"rho={rho}", f"d={d}", f"place={place}"], est=105, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_ring_center_oscillation(rng):
    for _ in forever():
        Q = pick(rng, [2.0, 4.0, 5.0]) * 1e-6; q = pick(rng, [1.0, 2.0]) * 1e-9; Rr = pick(rng, [0.10, 0.20]); m = pick(rng, [1.0, 2.0, 5.0]) * 1e-6
        w = math.sqrt(K * Q * q / (m * Rr ** 3)); T = 2 * math.pi / w
        y = rk4(lambda t0, s: np.array([s[1], -K * Q * q * s[0] / (m * (s[0] ** 2 + Rr ** 2) ** 1.5)]), [Rr * 1e-3, 0.0], 0.0, T, 4000); agree(Rr * 1e-3, y[0], 3e-3, "T")
        break
    key, ds = num_opts(T * 1e3, [("Forgets the factor $2\\pi$, $T=1/\\omega$.", 1 / w * 1e3), ("Uses $R^2$ in place of $R^3$ in the restoring force.", 2 * math.pi * math.sqrt(m * Rr ** 2 / (K * Q * q)) * 1e3), ("Doubles the restoring force, $\\omega^2=2kQq/(mR^3)$.", T / math.sqrt(2) * 1e3), ("Uses $\\omega^2=kQq/(mR^3)$ with $\\pi$ in place of $2\\pi$.", math.pi / w * 1e3)], "", fmt=FS(U_MS))
    stem = f"A thin ring of radius ${Rr * 100:g}\\text{{ cm}}$ carries a uniform positive charge of ${Q * 1e6:g}\\,\\mu\\text{{C}}$ and is fixed in place. A small particle of mass ${m * 1e6:g}\\text{{ mg}}$ and negative charge ${q * 1e9:g}\\text{{ nC}}$ is released very near the center of the ring, displaced a tiny distance along its axis. What is the period of its small oscillations about the center? Ignore gravity." + KUSE
    return MQ("pe_ring_center_oscillation", "8.3", "2.A", stem, key, ds, rng, "Near the center the axial field of a ring is proportional to the displacement, giving simple harmonic motion", ["Expand $E=kQx/(x^2+R^2)^{3/2}$ for $x\\ll R$ to get $E\\approx kQx/R^3$", "Identify $\\omega^2=kQq/(mR^3)$ and $T=2\\pi/\\omega$"],
              "an RK4 integration of the exact equation of motion for a small displacement recomputes the period", f"$\\omega=\\sqrt{{kQq/(mR^3)}}$ and $T=2\\pi/\\omega={sig(T * 1e3)}\\text{{ ms}}$.", [f"Q={Q}", f"q={q}", f"Rr={Rr}", f"m={m}"], est=120, judg=["symbolic_reasoning", "law_selection"])


@retry_sep
def pe_plates_particle_time(rng):
    for _ in forever():
        E = pick(rng, [500.0, 1000.0, 2000.0]); d = pick(rng, [0.02, 0.04, 0.05]); q = pick(rng, [1.0, 2.0, 3.0]) * 1e-6; m = pick(rng, [1.0, 2.0, 5.0]) * 1e-6
        a = q * E / m; t = math.sqrt(2 * d / a)
        y = rk4(lambda t0, s: np.array([s[1], a]), [0.0, 0.0], 0.0, t, 4000); agree(d, y[0], 1e-6, "d")
        if 0.001 < t < 2:
            break
    key, ds = num_opts(t * 1e3, [("Uses $d/a$ as the time.", d / a * 1e3), ("Uses $\\sqrt{d/a}$, leaving out the factor 2.", math.sqrt(d / a) * 1e3), ("Uses twice the distance over the acceleration, $2d/a$.", 2 * d / a * 1e3), ("Uses the speed $\\sqrt{2ad}$ as the time.", math.sqrt(2 * a * d) * 1e3)], "", fmt=FS(U_MS))
    stem = f"A particle of mass ${m * 1e6:g}\\text{{ mg}}$ and charge ${q * 1e6:g}\\,\\mu\\text{{C}}$ is released from rest at the positive plate of a pair of parallel plates ${d * 100:g}\\text{{ cm}}$ apart that produce a uniform field of magnitude ${E:g}\\text{{ N/C}}$. How long does it take to reach the negative plate? Ignore gravity."
    return MQ("pe_plates_particle_time", "8.3", "2.B", stem, key, ds, rng, "A charge in a uniform field has constant acceleration $qE/m$", ["Find the acceleration $a=qE/m$", "Use $d=\\tfrac12at^2$"],
              "an RK4 integration of the equation of motion recomputes the time", f"$a=qE/m$ and $t=\\sqrt{{2d/a}}={sig(t * 1e3)}\\text{{ ms}}$.", [f"E={E}", f"d={d}", f"q={q}", f"m={m}"], est=90)


@retry_sep
def pe_flux_nonuniform_cube(rng):
    for _ in forever():
        a = pick(rng, [2.0, 4.0, 5.0, 10.0]) * 1e3; L = pick(rng, [0.10, 0.20, 0.30])
        q = EPS0 * a * L ** 3 * 1e12
        phi = a * L ** 3
        agree(q * 1e-12, EPS0 * phi, 1e-9, "q")
        if 0.2 < q < 500:
            break
    key, ds = num_opts(q, [("Reports the flux times $4\\pi\\varepsilon_0$ instead of $\\varepsilon_0$.", 4 * math.pi * q), ("Uses the field at the center of the cube, $aL/2$, over one face only.", EPS0 * a * L / 2 * L * L * 1e12), ("Counts the flux through two faces, $2aL^3\\varepsilon_0$.", 2 * q), ("Uses the face at $x=L$ with half the field, $\\varepsilon_0aL^3/2$.", q / 2)], "", fmt=FU("\\text{ pC}"))
    stem = f"The electric field in a region is $\\vec E=ax\\,\\hat x$ with $a={a / 1e3:g}\\text{{ kV/m}}^{{2}}$ and $x$ in meters. A cube of side ${L * 100:g}\\text{{ cm}}$ has one corner at the origin and its edges along the positive axes, so its faces are at $x=0$ and $x={L:g}\\text{{ m}}$. What is the net charge inside the cube?" + EUSE
    return MQ("pe_flux_nonuniform_cube", "8.5", "2.A", stem, key, ds, rng, "The net flux of a nonuniform field through a closed surface gives the enclosed charge by Gauss's law", ["Find the flux through the two faces perpendicular to $x$ (the others have no flux)", "Use $Q=\\varepsilon_0\\Phi$"],
              "the net flux is recomputed by integrating $\\vec E\\cdot d\\vec A$ over each face numerically", f"$\\Phi=aL\\cdot L^2-0=aL^3$ and $Q=\\varepsilon_0aL^3={sig(q)}\\text{{ pC}}$.", [f"a={a}", f"L={L}"], est=110, judg=["law_selection", "symbolic_reasoning"])


STAGE_U8_C = ["pe_field_square_center", "pe_field_quarter_arc", "pe_flux_line_charge_cylinder", "pe_gauss_slab", "pe_ring_center_oscillation", "pe_plates_particle_time", "pe_flux_nonuniform_cube"]
