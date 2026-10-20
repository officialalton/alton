"""AP Physics C: Electricity and Magnetism 원형 H — 2문항 공유 자료 세트(그래프/표 자료 하나에 문항 둘)."""
from physe_common import *

MUUSE = " Use " + C_MU + "."


def _qitems(prefix, topic_skill_pairs, rows, rng, facts, material, concept, thinking, cond, path, judgment, est=95):
    q = []
    for (st, key, ds, nm, kw), (topic, skill) in zip(rows, topic_skill_pairs):
        q.append(mk(f"{prefix}_{nm}", topic, skill, st, key, ds, rng, concept=concept, thinking=thinking, cond=cond, path=path, material=material, judgment=judgment, est=est, facts=facts, kwhy=kw))
    return q


@retry_sep
def pes_vx_graph_set(rng):
    """세트: V(x) 그래프(꺾은선) → (한 구간의 전기장, 방출 입자의 속력). 단원 9."""
    for _ in forever():
        xs = [0.0, 1.0, 3.0, 4.0, 6.0]; Vs = [pick(rng, [10.0, 20.0, 30.0]), pick(rng, [50.0, 60.0, 70.0]), pick(rng, [20.0, 30.0, 10.0]), pick(rng, [20.0, 10.0, 30.0]), pick(rng, [40.0, 50.0, 60.0])]
        q = pick(rng, [2.0, 3.0, 4.0]) * 1e-6; m = pick(rng, [2.0, 5.0, 10.0]) * 1e-6
        dV = Vs[1] - Vs[2]
        slope = (Vs[2] - Vs[1]) / 2.0
        if dV >= 20 and len({round(v, 6) for v in Vs}) == 5:
            break
    E = -slope; v = math.sqrt(2 * q * dV / m)
    k1, d1 = signed_opts(E, [("Omits the minus sign, reporting the slope of the graph.", -E), ("Reports the potential at $x=2\\text{ m}$ instead of the field.", float(np.interp(2.0, xs, Vs))), ("Uses the potential difference without dividing by the length of the segment.", dV), ("Uses the slope of the segment from $x=3\\text{ m}$ to $x=4\\text{ m}$.", -(Vs[3] - Vs[2]))], "", fmt=FU(U_VM))
    k2, d2 = num_opts(v, [("Leaves out the factor 2, $\\sqrt{q\\Delta V/m}$.", math.sqrt(q * dV / m)), ("Forgets the square root, $2q\\Delta V/m$.", 2 * q * dV / m), ("Uses the potential difference from $x=0$ to $x=3\\text{ m}$.", math.sqrt(2 * q * abs(Vs[0] - Vs[2]) / m) if Vs[0] != Vs[2] else None), ("Uses the larger potential, $\\sqrt{2qV(1\\text{ m})/m}$.", math.sqrt(2 * q * Vs[1] / m))], "", fmt=FU(U_MS1))
    stim = graph_stim("Electric potential versus position along the x-axis", [("V", list(zip(xs, Vs)))], gaxis("Position x (m)", 0, 6, 1), gaxis("Potential V (V)", 0, 80, 10))
    rows = [("What is the $x$-component of the electric field at $x=2\\text{ m}$?", k1, d1, "q1", f"Between $x=1\\text{{ m}}$ and $x=3\\text{{ m}}$, $E_x=-\\Delta V/\\Delta x=-({Vs[2]:g}-{Vs[1]:g})/2={sig(E)}\\text{{ V/m}}$."),
            ("What is the speed of the particle when it reaches $x=3\\text{ m}$?", k2, d2, "q2", f"$\\tfrac12mv^2=q(V_1-V_3)$ gives $v=\\sqrt{{2q\\Delta V/m}}={sig(v)}\\text{{ m/s}}$ with $\\Delta V={sig(dV)}\\text{{ V}}$.")]
    items = _qitems("pes_vx_graph_set", [("9.2", "2.B"), ("9.3", "2.B")], rows, rng, [f"Vs={Vs}", f"q={q}", f"m={m}"], MAT_GRAPH("axis labels with units"), "Two questions about one potential graph: the field from its slope and the speed from the potential energy change", ["Read the potential at the needed positions", "Use the slope for the field and energy conservation for the speed"],
                    [("only the electric force acts on the particle", "the shared description states that only the electric force acts")], "the slope is recomputed from the plotted vertices and the speed from energy conservation", ["representation_reading", "law_selection"])
    intro = f"The graph shows the electric potential $V$ along the $x$-axis, plotted in straight segments. A particle of charge ${q * 1e6:g}\\,\\mu\\text{{C}}$ and mass ${m * 1e6:g}\\text{{ mg}}$ is released from rest at $x=1\\text{{ m}}$ and moves along the $x$-axis under the electric force alone."
    return set_pack("pes_vx_graph_set", "9.2", intro, stim, items, items[0]["facts"])


@retry_sep
def pes_gauss_er_set(rng):
    """세트: 균일하게 대전된 구의 E(r) 그래프 → (전체 전하, 두 반지름 사이 전위차). 단원 8·9."""
    for _ in forever():
        R = pick(rng, [10.0, 20.0]); Qn = pick(rng, [2.0, 4.0, 6.0, 8.0]); Es = K * Qn * 1e-9 / (R * 1e-2) ** 2
        dV = 2 / 3 * Es * R * 1e-2
        Ef = lambda r: Es * r / R if r <= R else Es * (R / r) ** 2
        rs = np.linspace(R, 3 * R, 4001); agree(dV, float(np.trapezoid([Ef(r) for r in rs], rs * 1e-2)), 2e-3, "dV")
        break
    k1, d1 = num_opts(Qn, [("Reads the field at $r=2R$ instead of at the surface, then uses $E R^2/k$ with $R$.", Qn / 4), ("Uses $E_sR/k$, forgetting that the distance enters squared.", Es * (R * 1e-2) / K * 1e9), ("Omits the factor $4\\pi$, $\\varepsilon_0E_sR^2$.", Es * (R * 1e-2) ** 2 * EPS0 * 1e9), ("Uses the peak field with the distance $2R$, $E_s(2R)^2/k$.", 4 * Qn)], "", fmt=FU(U_NC))
    k2, d2 = num_opts(dV, [("Uses the uniform-field estimate with the peak field, $E_s\\,(2R)$.", Es * 2 * R * 1e-2), ("Uses the potential at the surface, $kQ/R=E_sR$.", Es * R * 1e-2), ("Evaluates $kQ(1/R-1/(9R))$, squaring the radius ratio.", Es * R * 1e-2 * 8 / 9), ("Integrates only to $2R$, giving $E_sR/2$.", Es * R * 1e-2 / 2)], "", fmt=FU(U_V))

    stim = dense_graph_stim("Electric field magnitude versus distance from the center", Ef, 0, 3 * R, gaxis("Distance r (cm)", 0, 3 * R, R / 2), gaxis("Field E (N/C)", 0, round(1.5 * Es, 3), round(Es / 2, 3)), n=121)
    rows = [("What is the total charge on the sphere?", k1, d1, "q1", f"At $r=R$ the field is the peak value $E_s=kQ/R^2$, so $Q=E_sR^2/k={sig(Qn)}\\text{{ nC}}$."),
            (f"What is the potential difference between the surface ($r=R$) and the point $r=3R$? ($V_R-V_{{3R}}$)", k2, d2, "q2", f"Outside the sphere $E=kQ/r^2$, so $\\Delta V=kQ(1/R-1/(3R))=\\tfrac23E_sR={sig(dV)}\\text{{ V}}$.")]
    items = _qitems("pes_gauss_er_set", [("8.6", "2.B"), ("9.2", "2.A")], rows, rng, [f"R={R}", f"Qn={Qn}"], MAT_GRAPH("axis labels with units", "peak at the radius of the sphere"), "Two questions about the field graph of a uniformly charged sphere", ["Read the peak field at the surface", "Use the exterior inverse-square field for the potential difference"],
                    [("the charge is uniformly distributed through the volume", "the shared description states a uniform volume charge")], "the charge and the potential difference are recomputed from the closed forms of the field and a numerical integration", ["representation_reading", "law_selection"])
    k = " Use " + C_K + "."
    intro = f"A solid nonconducting sphere of radius ${R:g}\\text{{ cm}}$ carries a charge spread uniformly through its volume. The graph shows the magnitude of the electric field as a function of the distance $r$ from the center." + k
    return set_pack("pes_gauss_er_set", "8.6", intro, stim, items, items[0]["facts"])


@retry_sep
def pes_rc_table_set(rng):
    """세트: RC 충전 전류 표 → (기전력, 전기용량). 단원 11."""
    for _ in forever():
        R = pick(rng, [1.0, 2.0, 5.0]) * 1e3; tau = pick(rng, [10.0, 20.0, 40.0]) * 1e-3; I0 = pick(rng, [2.0, 3.0, 4.0, 6.0]) * 1e-3
        e = I0 * R; C = tau / R
        ts = [0.0, 0.5 * tau, tau, 2 * tau, 3 * tau]; Is = [I0 * math.exp(-t / tau) for t in ts]
        y = rk4(lambda t0, s: np.array([(e - s[0] / C) / R]), [0.0], 0.0, tau, 4000); agree(Is[2], (e - y[0] / C) / R, 1e-6, "I")
        break
    k1, d1 = num_opts(e, [("Uses the current at $t=\\tau$ in $IR$.", Is[2] * R), ("Divides the initial current by the resistance, $I_0/R$.", I0 / R), ("Uses the final current times $R$ at $3\\tau$.", Is[4] * R), ("Doubles the product, $2I_0R$.", 2 * I0 * R)], "", fmt=FU(U_V))
    k2, d2 = num_opts(C * 1e6, [("Reads $\\tau$ as the time at which the current is half of $I_0$ and uses $\\tau/R$.", tau * math.log(2) / R * 1e6), ("Uses $2\\tau/R$.", 2 * tau / R * 1e6), ("Uses $3\\tau/R$, reading the last row as $\\tau$.", 3 * tau / R * 1e6), ("Uses the time at which the current is half of $I_0$ divided by $R$ twice.", tau * math.log(2) / R / R * 1e6 * 1e3)], "", fmt=FU(U_UF))
    rows = [[f"{t * 1e3:.3g}", f"{i * 1e3:.3g}"] for t, i in zip(ts, Is)]
    stim = table_stimulus("Charging current measured at several times", "Time (ms)", rows, "Current (mA)")
    qs = [("What is the emf of the battery?", k1, d1, "q1", f"At $t=0$ the capacitor acts as a wire, so $\\varepsilon=I_0R={sig(e)}\\text{{ V}}$."),
          ("What is the capacitance of the capacitor?", k2, d2, "q2", f"The current falls to $I_0/e$ at $t=\\tau$, so $\\tau={tau * 1e3:g}\\text{{ ms}}$ and $C=\\tau/R={sig(C * 1e6)}\\,\\mu\\text{{F}}$.")]
    items = _qitems("pes_rc_table_set", [("11.8", "2.B"), ("11.8", "2.A")], qs, rng, [f"R={R}", f"tau={tau}", f"I0={I0}"], {"type": "table", "must_include": ["time column", "current column"]}, "Two questions about the charging current of an RC circuit", ["Read the initial current from the table", "Find the time at which the current has fallen to $1/e$"],
                    [("the capacitor was uncharged at $t=0$ and the battery is ideal", "the shared description states an uncharged capacitor and an ideal battery")], "the table values are recomputed from the circuit equation with an RK4 integration", ["representation_reading", "law_selection"])
    intro = f"An initially uncharged capacitor is connected in series with a ${R / 1e3:g}\\text{{ k}}\\Omega$ resistor and an ideal battery at $t=0$. The table gives the measured current at several times."
    return set_pack("pes_rc_table_set", "11.8", intro, stim, items, items[0]["facts"])


@retry_sep
def pes_bt_graph_set(rng):
    """세트: B(t) 그래프 → (한 구간의 유도 기전력, 처음 2초 동안 저항을 지난 전하). 단원 13."""
    for _ in forever():
        side = pick(rng, [10.0, 20.0, 30.0]); R = pick(rng, [0.5, 1.0, 2.0]); B1 = pick(rng, [0.2, 0.4, 0.5]); B2 = pick(rng, [0.1, 0.0, 0.2])
        A = (side * 1e-2) ** 2; emf = A * B1 / 2.0; q = A * B1 / R
        ts = [0.0, 2.0, 4.0, 6.0]; Bs = [0.0, B1, B1, B2]
        agree(q, simpson(lambda s: A * B1 / 2.0 / R, 0, 2.0, 11), 1e-9, "q")
        break
    k1, d1 = num_opts(emf * 1e3, [("Uses the field at the end of the segment, $AB_1$.", A * B1 * 1e3), ("Uses the side length rather than the area.", side * 1e-2 * B1 / 2.0 * 1e3), ("Uses the area in square centimeters without converting.", side ** 2 * B1 / 2.0 * 1e3), ("Uses $A\\,B_1/4$, dividing by 4 s.", A * B1 / 4.0 * 1e3)], "", fmt=FU(U_MV))
    k2, d2 = num_opts(q * 1e3, [("Uses the current at the end of the segment times 1 s.", A * B1 / 2.0 / R * 1e3), ("Uses $\\Delta\\Phi\\cdot R$.", A * B1 * R * 1e3), ("Uses the current times the whole 6 s.", A * B1 / 2.0 / R * 6 * 1e3), ("Uses the emf in place of the charge.", emf * 1e3)], "", fmt=FU("\\text{ mC}"))
    stim = graph_stim("Magnetic field magnitude versus time", [("B", list(zip(ts, Bs)))], gaxis("Time (s)", 0, 6, 1), gaxis("Field B (T)", 0, round(max(B1, B2) + 0.1, 3), 0.1))
    qs = [(f"What is the magnitude of the emf induced in the loop at $t=1\\text{{ s}}$?", k1, d1, "q1", f"$|\\varepsilon|=A\\,dB/dt=({sig(A)})({sig(B1 / 2)})={sig(emf * 1e3)}\\text{{ mV}}$."),
          ("What total charge passes through the resistor between $t=0$ and $t=2\\text{ s}$?", k2, d2, "q2", f"The current is constant at $\\varepsilon/R$ for 2 s, so $q=\\Delta\\Phi/R=AB_1/R={sig(q * 1e3)}\\text{{ mC}}$.")]
    items = _qitems("pes_bt_graph_set", [("13.2", "2.A"), ("13.3", "2.B")], qs, rng, [f"side={side}", f"R={R}", f"B1={B1}", f"B2={B2}"], MAT_GRAPH("axis labels with units"), "Two questions about the emf and charge from a changing field", ["Find the slope of the field graph in the stated interval", "Use the emf for the current and the current for the charge"],
                    [("the loop is fixed and the field is uniform over it, perpendicular to its plane", "the shared description states a fixed loop in a uniform perpendicular field")], "the emf is recomputed from the plotted slope and the charge from a numerical integration of the current", ["representation_reading", "law_selection"])
    intro = f"A square loop of side ${side:g}\\text{{ cm}}$ is connected to a ${R:g}\\,\\Omega$ resistor, so the total resistance of the circuit is ${R:g}\\,\\Omega$. The loop is in a uniform magnetic field perpendicular to its plane whose magnitude changes with time as shown in the graph."
    return set_pack("pes_bt_graph_set", "13.2", intro, stim, items, items[0]["facts"])


@retry_sep
def pes_cap_qv_graph_set(rng):
    """세트: 축전기 Q-V 그래프(원점을 지나는 직선) → (전기용량, 저장 에너지). 단원 10."""
    for _ in forever():
        C = pick(rng, [2.0, 4.0, 5.0, 10.0]) * 1e-6; Vm = pick(rng, [10.0, 20.0, 40.0])
        Qm = C * Vm * 1e6; U = 0.5 * C * Vm ** 2 * 1e6
        agree(U, simpson(lambda s: s / C * 1e6, 0, C * Vm, 2001), 1e-6, "U")
        break
    k1, d1 = num_opts(C * 1e6, [("Uses the inverse of the slope, $V/Q$.", Vm / Qm), ("Reports the charge in microcoulombs as the capacitance.", Qm), ("Uses the area under the line.", Qm * Vm / 2)], "", fmt=FU(U_UF))
    k2, d2 = num_opts(U, [("Uses $QV$, leaving out the factor one half.", Qm * Vm), ("Uses $\\tfrac12CV$.", 0.5 * C * 1e6 * Vm), ("Uses the charge as the energy.", Qm), ("Uses $\\tfrac12QV^2$.", 0.5 * Qm * Vm ** 2 * 1e-2)], "", fmt=FU(U_UJ))
    stim = graph_stim("Charge on the capacitor versus potential difference across it", [("Q", [(0.0, 0.0), (Vm, round(Qm, 4))])], gaxis("Potential difference (V)", 0, Vm, Vm / 4), gaxis("Charge (µC)", 0, round(Qm, 4), round(Qm / 4, 4)))
    qs = [("What is the capacitance of the capacitor?", k1, d1, "q1", f"The slope of $Q$ versus $V$ is the capacitance: $C=Q/V={sig(C * 1e6)}\\,\\mu\\text{{F}}$."),
          (f"How much energy is stored in the capacitor when the potential difference is ${Vm:g}\\text{{ V}}$?", k2, d2, "q2", f"$U=\\tfrac12QV=\\tfrac12({sig(Qm)}\\times10^{{-6}})({Vm:g})={sig(U)}\\,\\mu\\text{{J}}$.")]
    items = _qitems("pes_cap_qv_graph_set", [("10.3", "2.B"), ("10.3", "2.B")], qs, rng, [f"C={C}", f"Vm={Vm}"], MAT_GRAPH("axis labels with units"), "Two questions about one capacitor charge-voltage graph", ["Use the slope for the capacitance", "Use the area under the $V$ versus $Q$ relation for the energy"],
                    [("the capacitor is ideal", "the shared description states an ideal capacitor")], "the slope is recomputed from the plotted endpoints and the energy from a numerical integration of $q/C$", ["representation_reading", "law_selection"])
    intro = "The graph shows how the charge on one plate of an ideal capacitor depends on the potential difference across it as the capacitor is charged from zero."
    return set_pack("pes_cap_qv_graph_set", "10.3", intro, stim, items, items[0]["facts"])


@retry_sep
def pes_wire_Br_graph_set(rng):
    """세트: 균일 전류 밀도 도선의 B(r) 그래프 → (전체 전류, 반지름의 절반 안쪽 전류). 단원 12."""
    for _ in forever():
        R = pick(rng, [2.0, 4.0]) * 1e-3; I = pick(rng, [5.0, 10.0, 20.0, 40.0])
        Bs = MU0 * I / (2 * math.pi * R) * 1e6
        Bf = lambda r: Bs * r / R if r <= R else Bs * R / r
        enc = I / 4
        break
    k1, d1 = num_opts(I, [("Leaves out the factor $2\\pi$, $B_sR/\\mu_0$.", I / (2 * math.pi)), ("Uses $4\\pi$ in place of $2\\pi$.", 2 * I), ("Reads the field at $r=R/2$, half the peak, instead of at the surface.", I / 2), ("Uses the radius in millimeters as meters.", I * 1e3)], "", fmt=FU(U_A))
    k2, d2 = num_opts(enc, [("Takes the current enclosed to be half of the total, since the radius is half.", I / 2), ("Takes the current enclosed to be an eighth of the total, using the cube of the ratio.", I / 8), ("Takes the current enclosed to be the whole current.", float(I)), ("Takes the enclosed current as the total times $(1/2)^{3/2}$.", I * 0.5 ** 1.5)], "", fmt=FU(U_A))

    ys = lambda rmm: Bf(rmm * 1e-3)
    stim = dense_graph_stim("Magnetic field magnitude versus distance from the axis", ys, 0, 3 * R * 1e3, gaxis("Distance r (mm)", 0, 3 * R * 1e3, R * 1e3 / 2), gaxis("Field B (µT)", 0, round(1.5 * Bs, 3), round(Bs / 2, 3)), n=121)
    qs = [("What is the total current in the wire?", k1, d1, "q1", f"Outside the wire $B=\\mu_0I/(2\\pi r)$; at $r=R$, $I=2\\pi RB_s/\\mu_0={sig(I)}\\text{{ A}}$."),
          ("What current is enclosed by a circle of radius $R/2$ centered on the axis?", k2, d2, "q2", f"The current density is uniform, so the enclosed current scales as the area: $I(R/2)^2/R^2={sig(enc)}\\text{{ A}}$.")]
    items = _qitems("pes_wire_Br_graph_set", [("12.4", "2.B"), ("12.4", "2.B")], qs, rng, [f"R={R}", f"I={I}"], MAT_GRAPH("axis labels with units", "peak at the wire's surface"), "Two questions about the field graph of a long wire with uniform current density", ["Read the peak field at the wire's surface", "Use Ampère's law with the enclosed area"],
                    [("the current is uniform over the cross-section", "the shared description states a uniform current density")], "the total and enclosed currents are recomputed from the Ampère law for each radius", ["representation_reading", "law_selection"])
    intro = f"A long straight cylindrical wire of radius ${R * 1e3:g}\\text{{ mm}}$ carries a current distributed uniformly over its cross-section. The graph shows the magnitude of the magnetic field as a function of the distance $r$ from the axis, inside and outside the wire." + MUUSE
    return set_pack("pes_wire_Br_graph_set", "12.4", intro, stim, items, items[0]["facts"])


STAGE_SETS = ["pes_vx_graph_set", "pes_gauss_er_set", "pes_rc_table_set", "pes_bt_graph_set", "pes_cap_qv_graph_set", "pes_wire_Br_graph_set"]
