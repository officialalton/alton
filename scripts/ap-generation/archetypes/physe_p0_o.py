"""AP Physics C: Electricity and Magnetism 원형 O — 3차 저작: 2문항 공유 자료 세트 2개."""
from physe_common import *
from physe_p0_h import _qitems


@retry_sep
def pes_ohm_table_set(rng):
    """세트: 저항기의 V-I 표(선형) → (저항, 한 전압에서의 전력). 단원 11."""
    for _ in forever():
        R = pick(rng, [20.0, 40.0, 50.0, 100.0]); Vs = [2.0, 4.0, 6.0, 8.0, 10.0]; Is = [v / R * 1e3 for v in Vs]
        Vq = pick(rng, [12.0, 15.0, 20.0]); P = Vq ** 2 / R
        break
    k1, d1 = num_opts(R, [("Divides the voltage by the current in milliamperes without converting to amperes.", Vs[1] / Is[1]), ("Pairs the largest voltage with the smallest current.", Vs[4] / (Is[0] * 1e-3)), ("Pairs the smallest voltage with the largest current.", Vs[0] / (Is[4] * 1e-3)), ("Uses the sum of the voltage and current values of one row.", Vs[1] + Is[1])], "", fmt=FU(U_OHM))
    k2, d2 = num_opts(P, [("Uses $VI$ with the current from the first row of the table.", Vq * Is[0] * 1e-3), ("Multiplies the square of the voltage by the resistance, $V^2R$.", Vq ** 2 * R), ("Uses $VI$ with the current from the last row of the table.", Vq * Is[4] * 1e-3), ("Uses $V/R$, which is a current.", Vq / R)], "", fmt=FU(U_W))
    rows = [[f"{v:g}", f"{i:.4g}"] for v, i in zip(Vs, Is)]
    stim = table_stimulus("Current in a resistor at several applied voltages", "Potential difference V (V)", rows, "Current I (mA)")
    qs = [("What is the resistance of the resistor?", k1, d1, "q1", f"The ratio $V/I$ is constant: $R=V/I={sig(R)}\\,\\Omega$ for every row."),
          (f"What power is dissipated in the resistor when a potential difference of ${Vq:g}\\text{{ V}}$ is applied (assuming it stays ohmic)?", k2, d2, "q2", f"$P=V^2/R={sig(P)}\\text{{ W}}$.")]
    items = _qitems("pes_ohm_table_set", [("11.3", "2.B"), ("11.4", "2.B")], qs, rng, [f"R={R}", f"Vq={Vq}"], {"type": "table", "must_include": ["voltage column", "current column"]}, "Two questions about a resistor characterized by a table", ["Use the ratio of voltage to current for the resistance", "Use $P=V^2/R$ at the new voltage"],
                    [("the resistor stays ohmic over the range considered", "the shared description states that the resistor is ohmic")], "the resistance is recomputed from every row and the power from $V^2/R$", ["representation_reading", "law_selection"])
    intro = "A student applies several potential differences across a resistor and measures the current, and the table gives the results."
    return set_pack("pes_ohm_table_set", "11.3", intro, stim, items, items[0]["facts"])


@retry_sep
def pes_solenoid_graph_set(rng):
    """세트: 긴 솔레노이드의 B-I 그래프(원점을 지나는 직선) → (단위 길이당 감김 수, 다른 전류에서의 자기장). 단원 12."""
    for _ in forever():
        n = pick(rng, [2000.0, 3000.0, 4000.0]); Imax = pick(rng, [2.0, 4.0]); I1 = pick(rng, [1.0, 1.5, 2.5, 3.0])
        slope = MU0 * n * 1e3  # mT/A
        B1 = slope * I1
        if I1 < Imax:
            break
    k1, d1 = num_opts(n, [("Solves $B=\\mu_0nI/(2\\pi)$, the long-wire formula, for $n$.", 2 * math.pi * n), ("Uses $B=2\\pi\\mu_0nI$.", n / (2 * math.pi)), ("Uses the field at the end of the solenoid, $B=\\tfrac12\\mu_0nI$.", 2 * n), ("Uses $B=2\\mu_0nI$.", n / 2)], "", fmt=FS("\\text{ turns/m}"))
    k2, d2 = num_opts(B1, [("Uses the current in the slope without the proportionality, $\\text{slope}+I$.", slope + I1), ("Scales with the square of the current.", slope * I1 ** 2), ("Uses the field at the largest plotted current.", slope * Imax), ("Halves the correct field.", B1 / 2)], "", fmt=FU(U_MT))
    ymax = round(slope * Imax, 4)
    stim = graph_stim("Magnetic field inside the solenoid versus the current", [("B", [(0.0, 0.0), (Imax, ymax)])], gaxis("Current I (A)", 0, Imax, Imax / 4), gaxis("Magnetic field B (mT)", 0, ymax, round(ymax / 4, 5)))
    qs = [("How many turns per meter does the solenoid have?", k1, d1, "q1", f"The slope of $B$ versus $I$ is $\\mu_0n$, so $n=\\text{{slope}}/\\mu_0={sig(n)}\\text{{ turns/m}}$."),
          (f"What is the magnitude of the field near the center when the current is ${I1:g}\\text{{ A}}$?", k2, d2, "q2", f"$B=\\mu_0nI={sig(B1)}\\text{{ mT}}$ (a point on the line).")]
    items = _qitems("pes_solenoid_graph_set", [("12.4", "2.B"), ("12.4", "2.B")], qs, rng, [f"n={n}", f"I1={I1}"], MAT_GRAPH("axis labels with units"), "Two questions about a solenoid's field read from a graph", ["Use the slope for $\\mu_0n$", "Read or compute the field at another current"],
                    [("the solenoid is long and the field is measured near its center", "the shared description states a long solenoid and a central field")], "the slope and the field are recomputed from $B=\\mu_0nI$", ["representation_reading", "law_selection"])
    intro = "A long air-filled solenoid carries a steady current. A student measures the magnetic field near its center for several currents, and the graph shows the results." + " Use " + C_MU + "."
    return set_pack("pes_solenoid_graph_set", "12.4", intro, stim, items, items[0]["facts"])


STAGE_SETS_C = ["pes_ohm_table_set"]
