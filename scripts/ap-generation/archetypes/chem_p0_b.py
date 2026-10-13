"""AP Chemistry P0 원형 B — 단원 3(물질과 혼합물의 성질): 분자 간 힘·기체·용액·분광·분리. 정답은 코드가 계산하고 독립 경로로 재계산한다."""
from chem_common import *  # noqa: F401,F403
from common import Opt

# ======================= 3.1 분자 간 힘과 끓는점 (6.C) =======================
# (식, 유형 H=수소 결합 P=극성(수소 결합 없음) N=무극성, 끓는점 K, 몰질량)
BP = {"H2O": ("H", 373, 18.0), "CH3OH": ("H", 338, 32.0), "HF": ("H", 293, 20.0), "C2H5OH": ("H", 351, 46.1), "NH3": ("H", 240, 17.0), "HCl": ("P", 188, 36.5), "H2S": ("P", 213, 34.1), "CH3OCH3": ("P", 248, 46.1),
      "PH3": ("P", 185, 34.0), "C2H6": ("N", 185, 30.1), "CH4": ("N", 112, 16.0), "SiH4": ("N", 161, 32.1), "Ne": ("N", 27, 20.2), "Ar": ("N", 87, 39.9), "Kr": ("N", 120, 83.8), "Xe": ("N", 165, 131.3),
      "F2": ("N", 85, 38.0), "Cl2": ("N", 239, 70.9), "Br2": ("N", 332, 159.8), "I2": ("N", 457, 253.8)}
STRENGTH = {"H": 3, "P": 2, "N": 1}


def ch_imf_boiling(rng):
    for _ in forever():
        hi, lo = rng.sample(sorted(BP), 2)
        th, tl = BP[hi][0], BP[lo][0]
        if BP[hi][1] < BP[lo][1]:
            hi, lo = lo, hi; th, tl = tl, th
        # 힘의 종류가 달라 더 센 쪽이 끓는점이 높고, 몰질량 논증이 분명히 틀리도록 높은 쪽의 몰질량이 같거나 작은 쌍만 쓴다
        if th != tl and STRENGTH[th] > STRENGTH[tl] and BP[hi][1] - BP[lo][1] > 40 and BP[hi][2] <= BP[lo][2]:
            break
    expl = {("H", "N"): "its molecules form hydrogen bonds, which are stronger than the dispersion forces between the nonpolar molecules of the other substance",
            ("H", "P"): "its molecules form hydrogen bonds, which are stronger than the dipole-dipole attractions between the other substance's molecules",
            ("P", "N"): "its polar molecules attract each other through dipole-dipole forces in addition to dispersion forces, so the attractions are stronger than the dispersion forces alone"}[(th, tl)]
    kind = {"H": "hydrogen bonds", "P": "dipole-dipole attractions", "N": "London dispersion forces only"}
    key_t = f"The substance with the higher boiling point is {hi}, because {expl}."
    wrongs = [(f"The substance with the higher boiling point is {hi}, because the covalent bonds within its molecules are stronger and break when it boils.", "Confuses the covalent bonds inside molecules, which stay intact when a liquid boils, with the intermolecular forces that are overcome."),
              (f"The substance with the higher boiling point is {hi}, because it has the greater molar mass.", f"{hi} actually has the smaller molar mass ({BP[hi][2]:g} g/mol versus {BP[lo][2]:g} g/mol for {lo}), so molar mass cannot explain its higher boiling point."),
              (f"The substance with the higher boiling point is {hi}, because its particles have a greater average kinetic energy at a given temperature, which keeps them together as a liquid.", "Confuses kinetic energy, which depends only on temperature, with the strength of the attractions between particles.")]
    k, ds = sentence_options(key_t, f"{hi} has {kind[th]} between its particles while {lo} has {kind[tl]}; stronger attractions need more energy to separate the particles, which gives {hi} the higher boiling point ({BP[hi][1]} K versus {BP[lo][1]} K).", wrongs)
    stem = f"A student claims that {hi} has a higher boiling point than {lo}. Which statement best supports the claim at the particulate level?"
    return mk("ch_imf_boiling", "3.1", "6.C", stem, k, ds, rng, concept="support a boiling-point claim with the type of intermolecular force", path="tabulated boiling points vs a force-strength score (H-bond > dipole-dipole > dispersion), with the molar-mass argument checked against the table",
              facts=[f"hi={hi}", f"lo={lo}", f"bp_hi={BP[hi][1]}", f"bp_lo={BP[lo][1]}"], judgment="connect a macroscopic property to the particulate-level force", est=70)


# ======================= 3.4 이상 기체 법칙 (5.F) =======================
def ch_ideal_gas(rng):
    unk = pick(rng, ["V", "P", "n"])
    for _ in forever():
        n = round(rng.uniform(0.2, 3.0), 2); Tc = pick(rng, [0, 15, 25, 50, 75, 100, 127]); P = pick(rng, [0.50, 0.75, 1.00, 1.50, 2.00, 3.00])
        T = Tc + 273.15
        V = n * R_ATM * T / P
        if 1.5 < V < 80:
            break
    Vr = round(V, 1)
    nsym, Vs, Ps, Ts = sp.symbols("n V P T", positive=True)
    eq = sp.Eq(Ps * Vs, nsym * sp.Rational(str(R_ATM)) * Ts)
    if unk == "V":
        key_v = float(sp.solve(eq, Vs)[0].subs({nsym: sp.nsimplify(n), Ps: sp.nsimplify(P), Ts: sp.nsimplify(T)}))
        agree(key_v, bisect(lambda v: P * v - n * R_ATM * T, 1e-6, 1e4), 1e-6, "V")
        stem = f"What is the volume, in L, of ${n:g}\\text{{ mol}}$ of an ideal gas at ${P:g}\\text{{ atm}}$ and ${Tc}\\,^{{\\circ}}\\text{{C}}$?"
        pairs = [("Uses the Celsius temperature in place of kelvins.", n * R_ATM * Tc / P if Tc else None), ("Multiplies by the pressure instead of dividing.", n * R_ATM * T * P), ("Uses the J/(mol K) gas constant with a pressure in atm.", n * R_J * T / P),
                 ("Uses the STP molar volume of 22.4 L/mol regardless of the given temperature and pressure.", n * 22.4), ("Uses 273 K for the temperature regardless of the given temperature.", n * R_ATM * 273.15 / P)]
        key, ds = num_opts(key_v, pairs, "L")
        facts = [f"n={n}", f"P={P}", f"Tc={Tc}", f"V={key_v:.5f}"]
        kw = f"Convert to kelvins: T = {Tc} + 273.15 = {T:.2f} K. Then V = nRT/P = ({n:g} mol)(0.08206 L·atm/(mol·K))({T:.2f} K)/({P:g} atm) = {key_v:.3g} L."
    elif unk == "P":
        key_v = n * R_ATM * T / Vr
        stem = f"What is the pressure, in atm, of ${n:g}\\text{{ mol}}$ of an ideal gas in a ${Vr:g}\\text{{ L}}$ container at ${Tc}\\,^{{\\circ}}\\text{{C}}$?"
        agree(key_v, float(sp.solve(sp.Eq(Ps * sp.nsimplify(Vr), nsym * sp.Rational(str(R_ATM)) * Ts), Ps)[0].subs({nsym: sp.nsimplify(n), Ts: sp.nsimplify(T)})), 1e-9, "P")
        pairs = [("Uses the Celsius temperature in place of kelvins.", n * R_ATM * Tc / Vr if Tc else None), ("Multiplies by the volume instead of dividing.", n * R_ATM * T * Vr), ("Uses R = 8.314 with a volume in L and a pressure in atm.", n * R_J * T / Vr), ("Uses the STP molar volume of 22.4 L/mol regardless of the given temperature.", n * 22.4 / Vr)]
        key, ds = num_opts(key_v, pairs, "atm")
        facts = [f"n={n}", f"V={Vr}", f"Tc={Tc}", f"P={key_v:.5f}"]
        kw = f"Convert to kelvins: T = {Tc} + 273.15 = {T:.2f} K. Then P = nRT/V = ({n:g} mol)(0.08206 L·atm/(mol·K))({T:.2f} K)/({Vr:g} L) = {key_v:.3g} atm."
    else:
        P_ = P; key_v = P_ * Vr / (R_ATM * T)
        stem = f"How many moles of an ideal gas are in a ${Vr:g}\\text{{ L}}$ container at ${P_:g}\\text{{ atm}}$ and ${Tc}\\,^{{\\circ}}\\text{{C}}$?"
        agree(key_v, float(sp.solve(sp.Eq(sp.nsimplify(P_) * sp.nsimplify(Vr), nsym * sp.Rational(str(R_ATM)) * sp.nsimplify(T)), nsym)[0]), 1e-9, "n")
        pairs = [("Uses the Celsius temperature in place of kelvins.", P_ * Vr / (R_ATM * Tc) if Tc else None), ("Multiplies by the temperature instead of dividing.", P_ * Vr * T * R_ATM), ("Uses R = 8.314 with a volume in L and a pressure in atm.", P_ * Vr / (R_J * T)), ("Uses the STP molar volume of 22.4 L/mol regardless of the given temperature and pressure.", Vr / 22.4)]
        key, ds = num_opts(key_v, pairs, "mol")
        facts = [f"P={P_}", f"V={Vr}", f"Tc={Tc}", f"n={key_v:.5f}"]
        kw = f"Convert to kelvins: T = {Tc} + 273.15 = {T:.2f} K. Then n = PV/RT = ({P_:g} atm)({Vr:g} L)/((0.08206 L·atm/(mol·K))({T:.2f} K)) = {key_v:.3g} mol."
    return mk("ch_ideal_gas", "3.4", "5.F", stem, key, ds, rng, concept="solve the ideal gas law with a Celsius temperature and consistent units", path="sympy solve of PV = nRT vs bisection root find on the residual",
              cond=[("temperature must be absolute", "unit conversion"), ("R and the pressure and volume units must be consistent", "constant choice")], facts=facts, judgment="convert units before substituting into PV = nRT", est=90, kwhy=kw)


# ======================= 3.4 기체 밀도와 몰질량 (5.B) =======================
@retry_sep
def ch_gas_molar_mass(rng):
    for _ in forever():
        M = pick(rng, [16.04, 28.01, 32.00, 44.01, 58.12, 64.07, 70.90, 17.03, 30.07, 2.016])
        Tc = pick(rng, [0, 25, 50, 100, 127]); P = pick(rng, [0.80, 1.00, 1.50, 2.00])
        T = Tc + 273.15
        d = P * M / (R_ATM * T)
        d = round(d, 3)
        key_v = d * R_ATM * T / P
        agree(key_v, float(sp.solve(sp.Eq(sp.nsimplify(P) * sp.Symbol("M"), sp.nsimplify(d) * sp.Rational(str(R_ATM)) * sp.nsimplify(T)), sp.Symbol("M"))[0]), 1e-9, "M")
        if abs(key_v - M) / M < 0.01 and 1 < d < 6:
            break
    pairs = [("Uses the Celsius temperature in place of kelvins.", d * R_ATM * Tc / P if Tc else None), ("Uses the STP molar volume of 22.4 L/mol regardless of the given temperature and pressure.", d * 22.4), ("Uses R = 8.314 with a pressure in atm.", d * R_J * T / P), ("Multiplies by the pressure instead of dividing.", d * R_ATM * T * P)]
    key, ds = num_opts(key_v, pairs, "g/mol")
    stem = f"A gas has a density of ${d:g}\\text{{ g/L}}$ at ${P:g}\\text{{ atm}}$ and ${Tc}\\,^{{\\circ}}\\text{{C}}$. Assuming ideal behavior, what is the molar mass of the gas, in g/mol?"
    return mk("ch_gas_molar_mass", "3.4", "5.B", stem, key, ds, rng, concept="molar mass from gas density using PV = nRT with n = m/M", path="sympy solve of PM = dRT vs recovery of the generating molar mass",
              facts=[f"d={d}", f"P={P}", f"Tc={Tc}", f"M={key_v:.4f}"], judgment="choose to rewrite the ideal gas law in terms of density", est=90,
              kwhy=f"Writing n = m/M in PV = nRT gives PM = dRT, so M = dRT/P = ({d:g} g/L)(0.08206 L·atm/(mol·K))({T:.2f} K)/({P:g} atm) = {key_v:.1f} g/mol, with T = {Tc} + 273.15 = {T:.2f} K.")


# ======================= 3.4 결합 기체 법칙 (5.F) =======================
@retry_sep
def ch_combined_gas(rng):
    for _ in forever():
        P1 = pick(rng, [1.00, 1.50, 2.00, 0.80]); V1 = pick(rng, [2.0, 4.0, 5.0, 10.0]); T1c = pick(rng, [0, 20, 25, 27, 50]); T2c = pick(rng, [75, 100, 127, 200, -23, 227]); V2 = pick(rng, [1.0, 2.0, 2.5, 5.0, 8.0])
        if V2 == V1 or T1c == T2c:
            continue
        T1, T2 = T1c + 273.15, T2c + 273.15
        P2 = P1 * V1 * T2 / (T1 * V2)
        agree(P2, bisect(lambda p: p * V2 / T2 - P1 * V1 / T1, 1e-6, 1e4), 1e-6, "P2")
        if 0.2 < P2 < 12:
            break
    pairs = [("Uses Celsius temperatures instead of kelvins.", P1 * V1 * T2c / (T1c * V2) if T1c else None), ("Inverts the temperature ratio.", P1 * V1 * T1 / (T2 * V2)), ("Inverts the volume ratio.", P1 * V2 * T2 / (T1 * V1)), ("Ignores the temperature change.", P1 * V1 / V2)]
    key, ds = num_opts(P2, pairs, "atm")
    stem = f"A sample of an ideal gas at ${P1:g}\\text{{ atm}}$ occupies ${V1:g}\\text{{ L}}$ at ${T1c}\\,^{{\\circ}}\\text{{C}}$. The gas is changed to ${V2:g}\\text{{ L}}$ at ${T2c}\\,^{{\\circ}}\\text{{C}}$. What is the final pressure, in atm?"
    return mk("ch_combined_gas", "3.4", "5.F", stem, key, ds, rng, concept="combined gas law with Celsius temperatures", path="closed-form rearrangement vs bisection on the invariant PV/T",
              facts=[f"P1={P1}", f"V1={V1}", f"T1c={T1c}", f"V2={V2}", f"T2c={T2c}", f"P2={P2:.5f}"], judgment="decide that the amount of gas is fixed and temperatures must be absolute", est=90,
              kwhy=f"The amount of gas is fixed, so P1V1/T1 = P2V2/T2 with kelvin temperatures T1 = {T1c} + 273.15 = {T1:.2f} K and T2 = {T2c} + 273.15 = {T2:.2f} K: P2 = ({P1:g})({V1:g})({T2:.2f})/(({T1:.2f})({V2:g})) = {P2:.3g} atm.")


# ======================= 3.4 부분 압력 (5.F) =======================
@retry_sep
def ch_partial_pressure(rng):
    for _ in forever():
        gases = rng.sample([("H2", 2.016), ("He", 4.003), ("N2", 28.01), ("O2", 32.00), ("CO2", 44.01), ("Ar", 39.95)], 3)
        ms = [pick(rng, [2.0, 4.0, 5.0, 8.0, 10.0, 16.0, 20.0]) for _ in gases]
        Pt = pick(rng, [1.20, 1.50, 2.00, 3.00, 4.50])
        ns = [Fr(str(m)) / Fr(str(M)) for m, (_, M) in zip(ms, gases)]
        idx = rng.randrange(3)
        x = ns[idx] / sum(ns)
        Pk = float(x) * Pt
        agree(Pk, float(np.array([float(v) for v in ns])[idx] / np.sum([float(v) for v in ns])) * Pt, 1e-9, "Pk")
        mass_frac = ms[idx] / sum(ms) * Pt
        if abs(Pk - mass_frac) / Pk > 0.12 and abs(Pk - Pt / 3) / Pk > 0.12 and 0.05 < Pk < Pt:
            break
    pairs = [("Uses the mass fraction instead of the mole fraction.", mass_frac), ("Assumes each gas contributes an equal share of the total pressure.", Pt / 3), ("Uses the moles of the gas divided by the moles of the other gases only.", float(ns[idx] / (sum(ns) - ns[idx])) * Pt if float(ns[idx] / (sum(ns) - ns[idx])) * Pt < 20 else None),
             ("Reports the total pressure.", Pt)]
    key, ds = num_opts(Pk, pairs, "atm")
    name = gases[idx][0]
    rows = "; ".join(f"${m:g}\\text{{ g}}$ of {cf(g)}" for m, (g, _) in zip(ms, gases))
    stem = f"A rigid container holds {rows}. The total pressure is ${Pt:g}\\text{{ atm}}$. What is the partial pressure of {cf(name)}, in atm?"
    return mk("ch_partial_pressure", "3.4", "5.F", stem, key, ds, rng, concept="partial pressure from mole fractions computed from masses", path="exact fractions vs numpy normalized moles",
              facts=[f"masses={ms}", f"gases={[g for g, _ in gases]}", f"Pt={Pt}", f"idx={idx}", f"Pk={Pk:.5f}"], judgment="convert masses to moles before forming mole fractions", est=100,
              kwhy=f"Convert each mass to moles ({'; '.join(f'{g}: {float(n_):.3f} mol' for (g, _), n_ in zip(gases, ns))}). The mole fraction of {name} is {float(x):.3f}, so its partial pressure is {float(x):.3f} × {Pt:g} atm = {Pk:.3g} atm.")


# ======================= 3.5 맥스웰-볼츠만 곡선 (5.D) =======================
def _mb(v, M, T):
    m = M / 1000 / CONSTS["NA"]; kB = R_J / CONSTS["NA"]
    return 4 * math.pi * (m / (2 * math.pi * kB * T)) ** 1.5 * v * v * math.exp(-m * v * v / (2 * kB * T))


@retry_sep
def ch_mb_curves(rng):
    for _ in forever():
        (ga, Ma), (gb, Mb) = rng.sample([("He", 4.003), ("Ne", 20.18), ("N2", 28.01), ("O2", 32.00), ("Ar", 39.95), ("CO2", 44.01), ("Kr", 83.80)], 2)
        if Mb / Ma > 1.4:
            break
        if Ma / Mb > 1.4:
            ga, Ma, gb, Mb = gb, Mb, ga, Ma
            break
    T = pick(rng, [298, 350, 400, 500])
    vs = np.linspace(0, 2200, 441)
    fa = np.array([_mb(v, Ma, T) for v in vs]); fb = np.array([_mb(v, Mb, T) for v in vs])
    vpa, vpb = vs[fa.argmax()], vs[fb.argmax()]
    agree(vpa, math.sqrt(2 * R_J * T / (Ma / 1000)), 6e-3, "vpa"); agree(vpb, math.sqrt(2 * R_J * T / (Mb / 1000)), 6e-3, "vpb")
    # 곡선 라벨: X 는 더 빠른 쪽(작은 M)인지 무작위
    swap = rng.random() < 0.5
    X, Y = (("X", Ma, fa, vpa), ("Y", Mb, fb, vpb)) if not swap else (("X", Mb, fb, vpb), ("Y", Ma, fa, vpa))
    heavier = "X" if X[1] > Y[1] else "Y"
    lighter = "Y" if heavier == "X" else "X"
    key_t = f"Gas {heavier} has the greater molar mass, and both gases have the same average kinetic energy."
    k = Opt(key_t, True, "At the same temperature the average kinetic energy is the same, and the heavier gas has the slower most probable speed.", None)
    ds = [Opt(f"Gas {lighter} has the greater molar mass, and both gases have the same average kinetic energy.", False, "Assigns the peak at the higher speed to the heavier gas.", None),
          Opt(f"Gas {heavier} has the greater molar mass, and Gas {heavier} has the greater average kinetic energy.", False, "Thinks a heavier gas has a larger average kinetic energy at the same temperature.", None),
          Opt(f"Gas {lighter} has the greater molar mass, and Gas {lighter} has the greater average kinetic energy.", False, "Reverses the molar-mass assignment and links speed to kinetic energy.", None)]
    pts = lambda f_: [[float(v), round(float(y) * 1000, 4)] for v, y in zip(vs[::10], f_[::10])]
    stim = graph_stim(f"Distribution of molecular speeds for gases X and Y at the same temperature, {T} K", [(X[0], pts(X[2])), (Y[0], pts(Y[2]))], gaxis("Molecular speed (m/s)", 0, 2200, 400), gaxis("Relative number of molecules", 0, round(float(max(fa.max(), fb.max())) * 1050, 2), round(float(max(fa.max(), fb.max())) * 262.5, 2)))
    stem = "The graph shows the distribution of molecular speeds for two different gases, X and Y, at the same temperature. Which statement is correct?"
    return mk("ch_mb_curves", "3.5", "5.D", stem, k, ds, rng, concept="compare molar masses from Maxwell-Boltzmann speed distributions at one temperature", stim=stim, path="analytic most probable speed sqrt(2RT/M) vs numerical argmax of the sampled distribution",
              material={"type": "graph", "must_include": ["two speed distributions", "peak positions"]}, facts=[f"Ma={Ma}", f"Mb={Mb}", f"T={T}", f"heavier={heavier}"], judgment="relate peak position to molar mass at fixed temperature", est=85)


# ======================= 3.6 이상 기체에서의 이탈 (4.B) =======================
VDW = {"He": (0.034, 0.0237, 4.00), "Ne": (0.211, 0.0171, 20.2), "H2": (0.244, 0.0266, 2.02), "N2": (1.37, 0.0387, 28.0), "O2": (1.38, 0.0318, 32.0), "Ar": (1.35, 0.0322, 39.9), "CH4": (2.25, 0.0428, 16.0), "CO2": (3.59, 0.0427, 44.0), "NH3": (4.17, 0.0371, 17.0)}


def _Z_vdw(a, b, P, T):
    """고정 P, T 에서 몰 부피 Vm 을 반 데르 발스식의 큰 근으로 구해 Z = P Vm / (RT)"""
    f = lambda Vm: (P + a / Vm ** 2) * (Vm - b) - R_ATM * T
    ideal = R_ATM * T / P  # f 는 b 보다 큰 쪽에서 단조 증가 → 이상 기체 부피 근방에서 부호가 바뀌는 구간을 이분법으로 찾는다
    Vm = bisect(f, max(b * 1.0001, ideal * 0.3), ideal * 1.6 + 1.0)
    return P * Vm / (R_ATM * T)


def ch_gas_deviation(rng):
    for _ in forever():
        names = rng.sample(sorted(VDW), 4); P = pick(rng, [10.0, 20.0, 50.0]); T = pick(rng, [250.0, 273.15, 300.0])
        dev = {n: abs(_Z_vdw(VDW[n][0], VDW[n][1], P, T) - 1) for n in names}
        approx = {n: abs((VDW[n][1] - VDW[n][0] / (R_ATM * T)) * P) for n in names}
        o1 = sorted(names, key=lambda n: -dev[n]); o2 = sorted(names, key=lambda n: -approx[n])
        if o1[0] == o2[0] and dev[o1[0]] > 1.5 * dev[o1[1]]:
            break
    k = o1[0]
    heavy = max(names, key=lambda n: VDW[n][2])
    ds = []
    for n in names:
        if n == k:
            continue
        ds.append(Opt(cf(n), False, f"{n} has a van der Waals attraction constant of a = {VDW[n][0]} L²·atm/mol², smaller than the {VDW[k][0]} of {k}, so it stays closer to ideal behavior" + (" even though it is the heaviest gas shown." if n == heavy else "."), None))
    key = Opt(cf(k), True, f"Stronger attractions between molecules (a = {VDW[k][0]} L²·atm/mol² for {k}, the largest of the four) lower the pressure and cause the greatest departure from ideal behavior at high pressure and low temperature.", None)
    stem = f"Which of the following gases is expected to deviate most from ideal behavior at ${P:g}\\text{{ atm}}$ and ${T:g}\\text{{ K}}$?"
    return mk("ch_gas_deviation", "3.6", "4.B", stem, key, ds, rng, concept="which real gas deviates most from the ideal gas model", path="Z from the van der Waals equation by root finding vs the first-order estimate (b - a/RT)P; both pick the same gas",
              facts=[f"names={names}", f"P={P}", f"T={T}", f"key={k}"], judgment="judge when the ideal-gas assumptions of no attractions and no volume fail", est=70)


# ======================= 3.7 묽힘 (5.F) =======================
def ch_dilution(rng):
    for _ in forever():
        M1 = pick(rng, [2.00, 3.00, 6.00, 12.0, 1.50, 5.00]); M2 = pick(rng, [0.100, 0.200, 0.250, 0.500, 1.00, 0.0500]); V2 = pick(rng, [100.0, 250.0, 500.0, 1000.0])
        if M2 < M1 / 3:
            break
    V1 = M2 * V2 / M1
    v1s = sp.Symbol("V1", positive=True)
    agree(V1, float(sp.solve(sp.Eq(sp.nsimplify(M1) * v1s, sp.nsimplify(M2) * sp.nsimplify(V2)), v1s)[0]), 1e-9, "V1")
    ask = pick(rng, ["stock", "water"])
    key_v = V1 if ask == "stock" else V2 - V1
    pairs = [("Divides the stock volume by the concentration ratio the wrong way (uses M1V2/M2).", M1 * V2 / M2), ("Reports the volume of water to add instead of the stock volume." if ask == "stock" else "Reports the volume of stock instead of the volume of water.", V2 - V1 if ask == "stock" else V1),
             ("Multiplies the final concentration by the final volume and treats the product as a volume.", M2 * V2), ("Uses the dilution factor M1/M2 itself as the volume instead of applying it to the final volume.", M1 / M2)]
    key, ds = num_opts(key_v, pairs, "mL")
    stem = (f"A chemist prepares ${V2:g}\\text{{ mL}}$ of a ${M2:g}\\text{{ M}}$ solution by diluting a ${M1:g}\\text{{ M}}$ stock solution with water. " + ("What volume of the stock solution, in mL, is required?" if ask == "stock" else "What volume of water, in mL, must be added to the stock solution? (Assume volumes are additive.)"))
    return mk("ch_dilution", "3.7", "5.F", stem, key, ds, rng, concept="dilution calculation with M1V1 = M2V2 and the volume of water added", path="sympy solve of M1V1 = M2V2 vs exact fraction",
              facts=[f"M1={M1}", f"M2={M2}", f"V2={V2}", f"ask={ask}", f"key={key_v:.5f}"], judgment="recognize that moles of solute are conserved and distinguish stock volume from water volume", est=80,
              kwhy=f"Moles of solute are conserved, so M1V1 = M2V2 and V1 = M2V2/M1 = ({M2:g} M)({V2:g} mL)/({M1:g} M) = {V1:.3g} mL of stock" + (f", and the water to add is {V2:g} mL − {V1:.3g} mL = {V2 - V1:.3g} mL." if ask == "water" else "."))


# ======================= 3.8 이온 수와 전기 전도도 (4.C) =======================
IONS = {"NaCl": 2, "KNO3": 2, "MgSO4": 2, "CaCl2": 3, "(NH4)2SO4": 3, "Na2CO3": 3, "Al(NO3)3": 4, "K3PO4": 4, "C6H12O6": 1, "CH3OH": 1, "C12H22O11": 1, "AlCl3": 4}
ION_SPLIT = {"NaCl": ["Na", "Cl"], "KNO3": ["K", "NO3"], "MgSO4": ["Mg", "SO4"], "CaCl2": ["Ca", "Cl", "Cl"], "(NH4)2SO4": ["NH4", "NH4", "SO4"], "Na2CO3": ["Na", "Na", "CO3"], "Al(NO3)3": ["Al", "NO3", "NO3", "NO3"],
             "K3PO4": ["K", "K", "K", "PO4"], "C6H12O6": ["C6H12O6"], "CH3OH": ["CH3OH"], "C12H22O11": ["C12H22O11"], "AlCl3": ["Al", "Cl", "Cl", "Cl"]}


def ch_ion_conductivity(rng):
    for _ in forever():
        names = rng.sample(sorted(IONS), 4)
        counts = sorted((IONS[n] for n in names), reverse=True)
        if counts[0] > counts[1]:
            break
    k = max(names, key=lambda n: IONS[n])
    agree(IONS[k], len(ION_SPLIT[k]), 1e-9, "ions")
    ds = []
    for n in names:
        if n == k:
            continue
        ds.append(Opt(cf(n), False, (f"{n} releases {IONS[n]} ions per formula unit, fewer than the {IONS[k]} released by {k}, so its solution has fewer charge carriers." if IONS[n] > 1 else f"{n} dissolves as neutral molecules and releases no ions, so its solution has far fewer charge carriers than {k}."), None))
    key = Opt(cf(k), True, f"At equal molarity, {k} releases {IONS[k]} ions per formula unit ({' + '.join(ION_SPLIT[k])}), the most of the four solutes, so its solution has the most charge carriers.", None)
    stem = "Four aqueous solutions each have a concentration of $0.10\\text{ M}$ at the same temperature. Which solution is expected to have the highest electrical conductivity?"
    return mk("ch_ion_conductivity", "3.8", "4.C", stem, key, ds, rng, concept="connect the number of dissolved particles to the electrical conductivity of a solution", path="ion count from a table vs ions listed by splitting the formula",
              facts=[f"names={names}", f"key={k}"], judgment="count particles released per formula unit and link them to conductivity", est=60)


# ======================= 3.13 비어-람베르트 (5.D) =======================
@retry_sep
def ch_beer_lambert(rng):
    for _ in forever():
        eps = pick(rng, [1200, 2500, 4000, 5400, 8000]); b = pick(rng, [0.50, 2.00, 5.00])
        cs = [pick(rng, [1, 2, 3, 4, 5]) * 1e-5 * s for s in (1, 2, 3, 4)]
        cs = [round(1e-5 * i * pick(rng, [1]), 8) for i in (1, 2, 3, 4)]
        As = [round(eps * b * c, 3) for c in cs]
        cu = round(rng.uniform(1.5, 3.8) * 1e-5, 7); Au = round(eps * b * cu, 3)
        if all(0.05 < a < 1.5 for a in As) and 0.05 < Au < 1.5:
            break
    slope, icpt = np.polyfit(cs, As, 1)
    n_ = len(cs); sx = sum(cs); sy = sum(As); sxx = sum(c * c for c in cs); sxy = sum(c * a for c, a in zip(cs, As))
    slope2 = (n_ * sxy - sx * sy) / (n_ * sxx - sx * sx)
    agree(slope, slope2, 1e-6, "slope")
    cx = (Au - icpt) / slope
    agree(cx, cu, 0.02, "cu")
    near = cs[int(np.argmin([abs(a - Au) for a in As]))]
    pairs = [("Takes the concentration of the standard with the closest absorbance instead of using the calibration line.", near), ("Averages the concentrations of the four standards.", float(np.mean(cs))), ("Divides by the path length a second time even though the slope already includes it.", cx / b),
             ("Multiplies by the path length instead of using the slope of the calibration line.", cx * b), ("Adds the path length in cm to the concentration found from the calibration line.", cx + b * 1e-5)]
    key, ds = num_opts(cx, [(w, v) for w, v in pairs], "M", 3, fmt=lambda v: sci(v, "M"))
    rows = [[f"{sn(c, 3)}", f"{a:.3f}"] for c, a in zip(cs, As)]
    stim = table_stimulus(f"Absorbance of standard solutions measured in a cuvette of path length {b:g} cm", "Concentration (M)", rows, "Absorbance")
    stem = f"A student measures the absorbance of four standard solutions of a dye at its maximum wavelength in a ${b:g}\\text{{ cm}}$ cuvette (table). A sample of unknown concentration of the same dye in the same cuvette has an absorbance of ${Au:.3f}$. What is the concentration of the dye in the unknown, in M?"
    return mk("ch_beer_lambert", "3.13", "5.D", stem, key, ds, rng, concept="unknown concentration from a Beer-Lambert calibration table", stim=stim, material={"type": "table", "must_include": ["standard concentrations", "absorbances"]},
              path="least-squares line from numpy polyfit vs normal equations; the recovered concentration matches the generating value within rounding", facts=[f"b={b}", f"Au={Au}", f"slope={slope:.5g}", f"cx={cx:.6g}"], judgment="use a calibration line, not a single point or a second factor of path length", est=100,
              kwhy=f"The standards fall on a straight line A = mc with slope m = {sn(slope, 3)} M⁻¹ (the slope already equals ε times the path length). For the unknown, c = A/m = {Au:.3f} / {sn(slope, 3)} M⁻¹ = {sn(cx, 3)} M.")


# ======================= 3.12 광자 에너지 (5.F) =======================
def ch_photon_energy(rng):
    lam = pick(rng, [250, 300, 400, 450, 500, 550, 600, 650, 700, 800, 1000, 1500])
    h, c = CONSTS["h"], CONSTS["c"]
    E = h * c / (lam * 1e-9)
    Es = sp.Rational(str(h)) * sp.Rational(str(c)) / (sp.Rational(lam) * sp.Rational("1e-9"))
    agree(E, float(Es), 1e-9, "E")
    pairs = [("Does not convert nanometers to meters.", h * c / lam), ("Computes the energy of a mole of photons.", E * CONSTS["NA"]), ("Reports the frequency c/λ instead of the energy.", c / (lam * 1e-9)), ("Omits Planck's constant (c/λ in wrong units).", c * 1e-9 / lam)]
    key, ds = num_opts(E, pairs, "J", 3, fmt=lambda v: sci(v, "J") if v < 1e4 else sci(v, ""))
    stem = f"What is the energy, in J, of a single photon of light with a wavelength of ${lam}\\text{{ nm}}$?"
    return mk("ch_photon_energy", "3.12", "5.F", stem, key, ds, rng, concept="photon energy from wavelength using E = hc/λ", path="sympy rational arithmetic vs float evaluation",
              facts=[f"lam={lam}", f"E={E:.5e}"], judgment="convert nanometers to meters and keep a single photon distinct from a mole of photons", est=70,
              kwhy=f"E = hc/λ = (6.626×10⁻³⁴ J·s)(2.998×10⁸ m/s)/({lam} × 10⁻⁹ m) = {sn(E, 4)} J for one photon; the wavelength must be converted from nm to m.")


# ======================= 3.9 크로마토그래피 Rf (2.D) =======================
def ch_chromatography(rng):
    for _ in forever():
        front = pick(rng, [6.0, 7.5, 8.0, 9.0, 10.0]); ds_ = sorted(rng.sample([1.5, 2.0, 2.4, 3.0, 3.6, 4.5, 5.0, 5.4, 6.0], 3)); origin = 0.0
        if max(ds_) < front - 0.5:
            break
    which = rng.randrange(3)
    rf = [float(Fr(str(d)) / Fr(str(front))) for d in ds_]
    agree(rf[which], float(np.array(ds_)[which] / front), 1e-9, "rf")
    pairs = [("Divides the solvent-front distance by the spot distance.", front / ds_[which]), ("Uses the distance between two spots instead of the origin distance.", (ds_[which] - ds_[which - 1]) / front if which else ds_[which] / front * 0.5),
             ("Reports the spot distance without dividing by the solvent front.", ds_[which]), ("Divides by the distance the farthest spot traveled.", ds_[which] / max(ds_))]
    key, ds = num_opts(rf[which], pairs, "", 3, fmt=lambda v: "$" + f"{v:.2f}" + "$")
    rows = [["Solvent front", f"{front:g}"]] + [[f"Component {i + 1}", f"{d:g}"] for i, d in enumerate(ds_)]
    stim = table_stimulus("Distances traveled from the origin line on a chromatography plate", "Feature", rows, "Distance from origin (cm)")
    stem = f"A student separates a mixture by paper chromatography. The table gives the distance each feature moved from the origin line. What is the $R_f$ value of component {which + 1}?"
    return mk("ch_chromatography", "3.9", "2.D", stem, key, ds, rng, concept="retention factor from distances read off a chromatography result", stim=stim, material={"type": "table", "must_include": ["solvent front", "spot distances"]},
              path="exact fraction vs numpy division", facts=[f"front={front}", f"d={ds_[which]}", f"rf={rf[which]:.5f}"], judgment="identify the solvent front as the reference distance", est=70,
              kwhy=f"Rf = distance moved by the component / distance moved by the solvent front = {ds_[which]:g} cm / {front:g} cm = {rf[which]:.2f}.")
