"""AP Physics C: Electricity and Magnetism 원형 K — 2차 저작: 2문항 공유 자료 세트 5개."""
from physe_common import *
from physe_p0_h import _qitems

MUUSE = " Use " + C_MU + "."


@retry_sep
def pes_coulomb_table_set(rng):
    """세트: 두 같은 구의 힘-거리 표(역제곱) → (각 구의 전하, 새 거리에서의 힘). 단원 8."""
    for _ in forever():
        qn = pick(rng, [20.0, 30.0, 40.0, 50.0]); rs = [10.0, 20.0, 30.0, 40.0]
        Fs = [K * (qn * 1e-9) ** 2 / (r * 1e-2) ** 2 * 1e3 for r in rs]  # mN
        rnew = pick(rng, [15.0, 25.0, 50.0])
        Fnew = K * (qn * 1e-9) ** 2 / (rnew * 1e-2) ** 2 * 1e3
        agree(Fnew, Fs[1] * (rs[1] / rnew) ** 2, 1e-9, "Fnew")
        if Fs[0] > 0.05:
            break
    q0 = math.sqrt(Fs[0] * 1e-3 * (rs[0] * 1e-2) ** 2 / K) * 1e9
    agree(q0, qn, 1e-9, "q")
    k1, d1 = num_opts(qn, [("Uses $r$ in centimeters without converting.", math.sqrt(Fs[0] * 1e-3 * rs[0] ** 2 / K) * 1e9), ("Uses the force in millinewtons as if it were in newtons.", math.sqrt(Fs[0] * (rs[0] * 1e-2) ** 2 / K) * 1e9), ("Takes $r$ as the radius of each sphere and uses $2r$ as the separation.", 2 * qn), ("Uses half of the separation in the formula.", qn / 2)], "", fmt=FU(U_NC))
    F20 = Fs[1]
    k2, d2 = num_opts(Fnew, [("Scales the $20\\text{ cm}$ entry as $1/r$.", F20 * 20.0 / rnew), ("Scales the $20\\text{ cm}$ entry as $1/r^3$.", F20 * (20.0 / rnew) ** 3), ("Takes the force to stay equal to the $20\\text{ cm}$ entry.", F20), ("Takes the force to stay equal to the $10\\text{ cm}$ entry.", Fs[0])], "", fmt=FU(U_MN))
    rows = [[f"{r:g}", f"{f:.3g}"] for r, f in zip(rs, Fs)]
    stim = table_stimulus("Force between two identical charged spheres at several separations", "Separation of the centers r (cm)", rows, "Force F (mN)")
    qs = [("What is the charge on each sphere?", k1, d1, "q1", f"$F=kq^2/r^2$ gives $q=r\\sqrt{{F/k}}={sig(qn)}\\text{{ nC}}$."),
          (f"What force would the spheres exert on each other at a separation of ${rnew:g}\\text{{ cm}}$?", k2, d2, "q2", f"The force is inversely proportional to $r^2$: $F=F_0(r_0/r)^2={sig(Fnew)}\\text{{ mN}}$.")]
    items = _qitems("pes_coulomb_table_set", [("8.1", "2.B"), ("8.1", "2.D")], qs, rng, [f"qn={qn}", f"rnew={rnew}"], {"type": "table", "must_include": ["separation column", "force column"]}, "Two questions about measured forces between two charged spheres", ["Use one row of the table with Coulomb's law", "Scale the force with the inverse square of the separation"],
                    [("the spheres are identical and small enough to be treated as point charges", "the shared description states identical small spheres")], "the charge and the new force are recomputed from Coulomb's law", ["representation_reading", "law_selection"])
    intro = "Two identical small conducting spheres carry the same charge. A student measures the electric force between them at several separations of their centers, and the table gives the results." + " Use " + C_K + "."
    return set_pack("pes_coulomb_table_set", "8.1", intro, stim, items, items[0]["facts"])


@retry_sep
def pes_cap_dielectric_table_set(rng):
    """세트: 유전체를 채운 축전기의 V-Q 표 → (전기용량, 유전 상수). 단원 10."""
    for _ in forever():
        C0 = pick(rng, [2.0, 4.0, 5.0]); kap = pick(rng, [2.0, 3.0, 4.0, 5.0]); Cw = C0 * kap
        Vs = [2.0, 4.0, 6.0, 8.0]; Qs = [Cw * v for v in Vs]
        break
    k1, d1 = num_opts(Cw, [("Uses the inverse of the ratio, $V/Q$.", Vs[1] / Qs[1]), ("Uses the product $QV$.", Qs[1] * Vs[1]), ("Uses the charge divided by the square of the voltage.", Qs[1] / Vs[1] ** 2), ("Uses the difference between two charges.", Qs[3] - Qs[0])], "", fmt=FU(U_UF))
    k2, d2 = num_opts(kap, [("Uses the inverse ratio, $C_0/C$.", C0 / Cw), ("Uses the difference of the capacitances, $C-C_0$ in microfarads.", Cw - C0 if Cw - C0 != kap else None), ("Squares the ratio.", kap ** 2), ("Uses $\\sqrt{C/C_0}$.", math.sqrt(kap))], "", fmt=lambda v: "$" + sig(v) + "$")
    rows = [[f"{v:g}", f"{q:g}"] for v, q in zip(Vs, Qs)]
    stim = table_stimulus("Charge on the capacitor with the dielectric in place", "Potential difference V (V)", rows, "Charge Q (µC)")
    qs = [("What is the capacitance of the capacitor with the dielectric in place?", k1, d1, "q1", f"$C=Q/V={sig(Cw)}\\,\\mu\\text{{F}}$ from any row."),
          ("What is the dielectric constant of the material?", k2, d2, "q2", f"$\\kappa=C/C_0={sig(Cw)}/{C0:g}={sig(kap)}$.")]
    items = _qitems("pes_cap_dielectric_table_set", [("10.3", "2.B"), ("10.4", "2.C")], qs, rng, [f"C0={C0}", f"kap={kap}"], {"type": "table", "must_include": ["voltage column", "charge column"]}, "Two questions about a capacitor measured with a dielectric", ["Use $C=Q/V$ with a row of the table", "Compare with the empty capacitance to find $\\kappa$"],
                    [("the dielectric completely fills the space between the plates", "the shared description states that the dielectric fills the gap")], "the capacitance is recomputed from each row and the constant from the ratio of capacitances", ["representation_reading", "law_selection"])
    intro = f"A parallel-plate capacitor has a capacitance of ${C0:g}\\,\\mu\\text{{F}}$ with vacuum between its plates. A dielectric slab is then inserted so that it completely fills the space between the plates, and the charge on the capacitor is measured at several potential differences. The table gives the results."
    return set_pack("pes_cap_dielectric_table_set", "10.3", intro, stim, items, items[0]["facts"])


@retry_sep
def pes_rl_table_set(rng):
    """세트: RL 회로 전류 증가 표 → (저항, 인덕턴스). 단원 13."""
    for _ in forever():
        e = pick(rng, [6.0, 12.0, 24.0]); Rr = pick(rng, [20.0, 40.0, 50.0, 100.0]); tau = pick(rng, [5.0, 10.0, 20.0]) * 1e-3; L = tau * Rr
        ts = [0.0, tau, 2 * tau, 3 * tau, 5 * tau]; Is = [e / Rr * (1 - math.exp(-t / tau)) for t in ts]
        y = rk4(lambda t0, s: np.array([(e - Rr * s[0]) / L]), [0.0], 0.0, tau, 4000); agree(Is[1], y[0], 1e-6, "I")
        break
    k1, d1 = num_opts(Rr, [("Uses the current at $t=\\tau$, $\\varepsilon/I(\\tau)$.", e / Is[1]), ("Uses the current at $t=2\\tau$.", e / Is[2]), ("Uses $\\varepsilon/(2I_\\infty)$.", Rr / 2), ("Uses $2\\varepsilon/I_\\infty$.", 2 * Rr)], "", fmt=FU(U_OHM))
    k2, d2 = num_opts(L, [("Divides the time constant by the resistance, $\\tau/R$.", tau / Rr), ("Uses the time at which the current is half of its final value, $\\tau\\ln2\\,R$.", tau * math.log(2) * Rr), ("Uses $2\\tau R$.", 2 * tau * Rr)], "", fmt=FU(U_H))
    rows = [[f"{t * 1e3:g}", f"{i * 1e3:.4g}"] for t, i in zip(ts, Is)]
    stim = table_stimulus("Current in the circuit after the switch is closed", "Time t (ms)", rows, "Current I (mA)")
    qs = [("What is the resistance of the resistor?", k1, d1, "q1", f"By the last measurement the current has essentially reached $\\varepsilon/R$, so $R=\\varepsilon/I_\\infty={sig(Rr)}\\,\\Omega$."),
          ("What is the inductance of the inductor?", k2, d2, "q2", f"The current reaches $1-1/e\\approx63$ percent of its final value at $t=\\tau$, so $\\tau={tau * 1e3:g}\\text{{ ms}}$ and $L=\\tau R={sig(L)}\\text{{ H}}$.")]
    items = _qitems("pes_rl_table_set", [("13.5", "2.B"), ("13.5", "2.A")], qs, rng, [f"e={e}", f"Rr={Rr}", f"tau={tau}"], {"type": "table", "must_include": ["time column", "current column"]}, "Two questions about the growth of current in an RL circuit", ["Use the final current with the emf for the resistance", "Find the time at which the current reaches 63 percent of its final value"],
                    [("the battery is ideal, the inductor is ideal, and the last entry is essentially the final current", "the shared description states these assumptions")], "the table values are recomputed from the circuit equation with an RK4 integration", ["representation_reading", "law_selection"])
    intro = f"A battery of emf ${e:g}\\text{{ V}}$ and negligible internal resistance is connected through a switch to a resistor and an ideal inductor in series. There is no current before the switch is closed at $t=0$. The table gives the measured current; by the last measurement the current has essentially reached its final value."
    return set_pack("pes_rl_table_set", "13.5", intro, stim, items, items[0]["facts"])


@retry_sep
def pes_force_wire_graph_set(rng):
    """세트: 자기장 속 도선의 힘-전류 그래프(원점을 지나는 직선) → (자기장, 각도를 바꾼 힘). 단원 12."""
    for _ in forever():
        L = pick(rng, [0.20, 0.25, 0.40, 0.50]); B = pick(rng, [0.10, 0.20, 0.40, 0.50]); Imax = pick(rng, [4.0, 5.0, 8.0, 10.0]); I1 = pick(rng, [2.0, 3.0, 4.0])
        slope = B * L * 1e3  # mN/A
        F30 = slope * I1 * 0.5
        if I1 < Imax:
            break
    k1, d1 = num_opts(B, [("Uses the slope times the length, $(F/I)L$.", slope * 1e-3 * L), ("Uses the slope in mN/A as if it were in N/A.", slope / L), ("Uses $F/(IL^2)$.", slope * 1e-3 / L ** 2), ("Uses the slope divided by the length squared.", slope / L ** 2 * 1e-3)], "", fmt=FU(U_T))
    k2, d2 = num_opts(F30, [("Uses the force at the original angle, without the sine factor.", slope * I1), ("Uses $\\cos30^\\circ$ in place of $\\sin30^\\circ$.", slope * I1 * math.cos(math.radians(30))), ("Uses $\\tan30^\\circ$.", slope * I1 * math.tan(math.radians(30))), ("Uses $F\\,\\sin30^\\circ$ twice.", slope * I1 * 0.25)], "", fmt=FU(U_MN))
    ymax = round(slope * Imax, 3)
    stim = graph_stim("Magnetic force on the wire versus the current in it", [("F", [(0.0, 0.0), (Imax, ymax)])], gaxis("Current I (A)", 0, Imax, Imax / 4), gaxis("Force F (mN)", 0, ymax, round(ymax / 4, 4)))
    qs = [("What is the magnitude of the magnetic field?", k1, d1, "q1", f"The slope of $F$ versus $I$ is $LB$, so $B=\\text{{slope}}/L={sig(B)}\\text{{ T}}$."),
          (f"The wire is turned so that it makes an angle of $30^\\circ$ with the field, with the current at ${I1:g}\\text{{ A}}$. What is the magnitude of the force on the wire now?", k2, d2, "q2", f"$F=ILB\\sin30^\\circ={sig(F30)}\\text{{ mN}}$.")]
    items = _qitems("pes_force_wire_graph_set", [("12.1", "2.B"), ("12.1", "2.C")], qs, rng, [f"L={L}", f"B={B}", f"Imax={Imax}", f"I1={I1}"], MAT_GRAPH("axis labels with units"), "Two questions about the force on a wire in a magnetic field read from a graph", ["Use the slope of the force-current line for $LB$", "Include $\\sin\\theta$ when the wire is not perpendicular to the field"],
                    [("in the graph the wire is perpendicular to the field", "the shared description states that the wire is perpendicular to the field")], "the slope is recomputed from the plotted endpoints and the force from the cross product", ["representation_reading", "law_selection"])
    intro = f"A straight wire of length ${L * 100:g}\\text{{ cm}}$ is perpendicular to a uniform magnetic field. A student measures the magnetic force on the wire for several currents, and the graph shows the results."
    return set_pack("pes_force_wire_graph_set", "12.1", intro, stim, items, items[0]["facts"])


@retry_sep
def pes_vr_graph_set(rng):
    """세트: 점전하의 V(r) 그래프 → (전하, 한 지점의 전기장). 단원 9·8."""
    for _ in forever():
        Qn = pick(rng, [2.0, 4.0, 6.0, 8.0]); r0 = 20.0
        V0 = K * Qn * 1e-9 / (r0 * 1e-2); E0 = V0 / (r0 * 1e-2)
        break
    Vf = lambda rcm: K * Qn * 1e-9 / (rcm * 1e-2)
    ymax = 90.0 * Qn; step = 15.0 * Qn
    stim = dense_graph_stim("Electric potential versus distance from the point charge", Vf, 10.0, 60.0, gaxis("Distance r (cm)", 10, 60, 10), gaxis("Potential V (V)", 0, ymax, step), n=101)
    k1, d1 = num_opts(Qn, [("Uses the distance in centimeters without converting.", V0 * r0 / K * 1e9), ("Uses $V r^2/k$.", V0 * (r0 * 1e-2) ** 2 / K * 1e9), ("Divides the potential by $kr$, $V/(kr)$, which is not a field.", V0 / (K * r0 * 1e-2) * 1e9), ("Uses the potential at $r=10\\text{ cm}$ with the distance $20\\text{ cm}$.", 2 * V0 * r0 * 1e-2 / K * 1e9)], "", fmt=FU(U_NC))
    k2, d2 = num_opts(E0, [("Uses $V/r$ with the distance in centimeters.", V0 / r0), ("Uses the slope with the wrong sign convention, $2V/r$.", 2 * V0 / (r0 * 1e-2)), ("Multiplies the potential by the distance, $Vr$.", V0 * r0 * 1e-2), ("Halves the field by dividing by $2r$, $V/(2r)$.", V0 / (2 * r0 * 1e-2))], "", fmt=FU(U_NCC))
    qs = [("Using the value of the potential at $r=20\\text{ cm}$, what is the magnitude of the point charge?", k1, d1, "q1", f"At $r=20\\text{{ cm}}$ the graph gives $V={sig(V0)}\\text{{ V}}$, so $Q=Vr/k={sig(Qn)}\\text{{ nC}}$."),
          ("What is the magnitude of the electric field at $r=20\\text{ cm}$?", k2, d2, "q2", f"For a point charge $E=kQ/r^2=V/r={sig(E0)}\\text{{ N/C}}$ (minus the slope of the graph).")]
    items = _qitems("pes_vr_graph_set", [("9.2", "2.A"), ("9.2", "2.B")], qs, rng, [f"Qn={Qn}"], MAT_GRAPH("axis labels with units"), "Two questions about the potential graph of a point charge", ["Read the potential at the given distance from the graph", "Use $V=kQ/r$ for the charge and $E=V/r$ for the field"],
                    [("the source is a single point charge in vacuum", "the shared description states a single point charge")], "the charge and the field are recomputed from the closed forms and a numerical derivative of the plotted curve", ["representation_reading", "law_selection"])
    intro = "A single point charge in vacuum produces an electric potential that depends on the distance $r$ from the charge as shown in the graph (zero potential at infinity)." + " Use " + C_K + "."
    return set_pack("pes_vr_graph_set", "9.2", intro, stim, items, items[0]["facts"])


STAGE_SETS_B = ["pes_coulomb_table_set", "pes_cap_dielectric_table_set", "pes_rl_table_set", "pes_force_wire_graph_set", "pes_vr_graph_set"]
