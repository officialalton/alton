"""AP Chemistry P0 원형 D — 단원 6(열화학)·7(평형). 정답은 코드가 계산하고 독립 경로로 재계산한다."""
from chem_common import *  # noqa: F401,F403
from common import Opt
from math import gcd

C_WATER = 4.18  # J/(g degC), 문항 본문에 항상 제시


def _fmt_kj(v):
    """kJ/mol 값을 유효숫자 3자리로(큰 값은 과학적 표기, 'e+04' 같은 컴퓨터 표기를 쓰지 않는다)."""
    sgn = "+" if v > 0 else "-"
    a = abs(v)
    if a >= 1000:
        e = int(math.floor(math.log10(a))); m = a / 10 ** e
        return "$" + sgn + sig(m, 3) + "\\times10^{" + str(e) + "}\\text{ kJ/mol}$"
    return "$" + sgn + sig(a, 3) + "\\text{ kJ/mol}$"


# ======================= 6.4 열량 측정 (5.F) =======================
SALTS = [("NH4NO3", +25.7), ("NaOH", -44.5), ("CaCl2", -82.8), ("KNO3", +34.9), ("LiCl", -37.0)]  # (식, 용해 엔탈피 kJ/mol) 일반 교재값 — 정답은 ΔT 에서 다시 계산


def ch_calorimetry(rng):
    for _ in forever():
        salt, dH = pick(rng, SALTS)
        mw = pick(rng, [50.0, 75.0, 100.0, 150.0, 200.0]); ms = pick(rng, [2.00, 4.00, 5.00, 8.00, 10.0, 12.0])
        n = ms / formula_mass(salt)
        dT = round(-dH * 1000 * n / ((mw + 0.0) * C_WATER), 1)
        if abs(dT) >= 1.5 and abs(dT) <= 25:
            break
    q = mw * C_WATER * dT  # 용액이 얻은 열(J)
    dH_calc = -q / n / 1000
    sx = sp.symbols("sx")
    dH2 = float(sp.solve(sp.Eq(sx * n * 1000, -sp.nsimplify(mw) * sp.nsimplify(C_WATER) * sp.nsimplify(dT)), sx)[0])
    agree(dH_calc, dH2, 1e-9, "dH")
    agree(dH_calc, dH, 0.08, "dH_generated")
    Ti = pick(rng, [20.0, 22.0, 25.0]); Tf = Ti + dT
    pairs = [("Gives the sign of the heat gained by the water instead of the sign of the enthalpy change.", -dH_calc), ("Reports the heat in kJ without dividing by the moles of salt.", q / 1000), ("Leaves the energy in joules per mole, which is a factor of 1000 too large when labeled kJ/mol.", dH_calc * 1000),
             ("Uses the mass of the salt in place of the mass of the water.", -ms * C_WATER * dT / n / 1000)]
    key, ds = signed_opts(dH_calc, pairs, fmt=_fmt_kj)
    stem = (f"A student dissolves ${ms:g}\\text{{ g}}$ of {cf(salt)} in ${mw:g}\\text{{ g}}$ of water in a calorimeter. The temperature changes from ${Ti:g}\\,^{{\\circ}}\\text{{C}}$ to ${Tf:.1f}\\,^{{\\circ}}\\text{{C}}$. "
            f"Assume that the specific heat capacity of the solution is ${C_WATER}\\text{{ J/(g}}\\cdot^{{\\circ}}\\text{{C)}}$, that the solution mass equals the mass of the water, and that no heat is exchanged with the surroundings. What is the enthalpy change of dissolution, in kJ/mol?")
    return mk("ch_calorimetry", "6.4", "5.F", stem, key, ds, rng, concept="molar enthalpy of dissolution from calorimetry data with the correct sign", path="sympy solve of q = -nΔH vs the generating enthalpy recovered within temperature rounding",
              facts=[f"salt={salt}", f"ms={ms}", f"mw={mw}", f"Ti={Ti}", f"Tf={Tf:.1f}", f"dH={dH_calc:.5f}"], judgment="relate the heat gained by the solution to the enthalpy change of the system and divide by moles", est=120,
              kwhy=f"The solution gained q = mcΔT = ({mw:g} g)({C_WATER} J/(g·°C))({dT:+.1f} °C) = {q:+.0f} J, so the dissolving process gave up the opposite amount. Moles of salt = {ms:g} g / {formula_mass(salt):.2f} g/mol = {n:.4f} mol, so ΔH = −q/n = {dH_calc:+.1f} kJ/mol.")


# ======================= 6.9 헤스의 법칙 (5.B) =======================
def ch_hess_law(rng):
    species = ["A", "B", "C", "D", "E"]
    for _ in forever():
        steps = []
        for _i in range(3):
            lhs = rng.sample(species, 2); rhs = rng.sample([s for s in species if s not in lhs], 1 if rng.random() < 0.5 else 2)
            cl = [pick(rng, [1, 1, 2]) for _ in lhs]; cr = [pick(rng, [1, 1, 2]) for _ in rhs]
            vec = {s: 0 for s in species}
            for s, c in zip(lhs, cl): vec[s] -= c
            for s, c in zip(rhs, cr): vec[s] += c
            steps.append((vec, pick(rng, [-50, -80, -110, -150, -200, 40, 70, 120]) + 0.0, lhs, cl, rhs, cr))
        coef = [pick(rng, [-2, -1, 1, 1, 2]) for _ in steps]
        tgt = {s: sum(c * st[0][s] for c, st in zip(coef, steps)) for s in species}
        if any(v == 0 for v in coef) or not any(v < 0 for v in tgt.values()) or not any(v > 0 for v in tgt.values()) or sum(abs(v) for v in tgt.values()) > 9:
            continue
        # 독립 경로: 목표 벡터를 단계 벡터의 선형 결합으로 lstsq 로 푼다
        Mx = np.array([[st[0][s] for st in steps] for s in species], dtype=float)
        sol = np.linalg.lstsq(Mx, np.array([tgt[s] for s in species], dtype=float), rcond=None)[0]
        if not np.allclose(sol, coef, atol=1e-6):
            continue
        dH = sum(c * st[1] for c, st in zip(coef, steps))
        pairs = [("Adds the three enthalpy changes without reversing or scaling any step.", sum(st[1] for st in steps)), ("Reverses the wrong step's sign when combining.", dH - 2 * coef[0] * steps[0][1]),
                 ("Multiplies by the coefficients but forgets to change signs for reversed steps.", sum(abs(c) * st[1] for c, st in zip(coef, steps))), ("Reverses every step, which gives the enthalpy change of the reverse of the target reaction.", -dH)]
        try:
            key, ds = signed_opts(dH, pairs, fmt=lambda v: "$" + f"{v:+.0f}" + "\\text{ kJ}$")
        except ValueError:
            continue
        break
    def rt(lhs, cl, rhs, cr):
        return "$" + " + ".join((f"{c}\\," if c > 1 else "") + mt(s) for s, c in zip(lhs, cl)) + " \\rightarrow " + " + ".join((f"{c}\\," if c > 1 else "") + mt(s) for s, c in zip(rhs, cr)) + "$"
    given = "; ".join(f"{rt(*st[2:])}, $\\Delta H={st[1]:.0f}\\text{{ kJ}}$" for st in steps)
    tl = [(-v, s) for s, v in tgt.items() if v < 0]; tr = [(v, s) for s, v in tgt.items() if v > 0]
    target = "$" + " + ".join((f"{c}\\," if c > 1 else "") + mt(s) for c, s in tl) + " \\rightarrow " + " + ".join((f"{c}\\," if c > 1 else "") + mt(s) for c, s in tr) + "$"
    stem = f"Given the reactions: {given}. What is $\\Delta H$, in kJ, for the reaction {target}?"
    return mk("ch_hess_law", "6.9", "5.B", stem, key, ds, rng, concept="combine reaction enthalpies by reversing and scaling steps (Hess's law)", path="vector sum of scaled step stoichiometries by exact integers vs least-squares solution of the linear system for the coefficients",
              facts=[f"coef={coef}", f"dH={dH}", f"steps={[st[1] for st in steps]}"], judgment="decide which steps to reverse or multiply so the species cancel", est=140,
              kwhy="Multiply each given reaction by the coefficient that makes the species cancel to the target reaction (a negative coefficient means the reaction is reversed, which changes the sign of its ΔH), then add: ΔH = " + " + ".join(f"({c})({st[1]:.0f})" for c, st in zip(coef, steps)) + f" = {dH:+.0f} kJ.")


# ======================= 6.7 결합 엔탈피 (5.F) =======================
BE = {"H-H": 436, "Cl-Cl": 243, "H-Cl": 431, "C-H": 413, "O=O": 498, "C=O": 799, "O-H": 463, "N#N": 945, "N-H": 391, "C-C": 347, "H-F": 567, "F-F": 158}
BR = [  # (반응식 TeX 좌/우 목록, 깨지는 결합 {결합: 수}, 생기는 결합)
    ([(1, "H2"), (1, "Cl2")], [(2, "HCl")], {"H-H": 1, "Cl-Cl": 1}, {"H-Cl": 2}),
    ([(1, "N2"), (3, "H2")], [(2, "NH3")], {"N#N": 1, "H-H": 3}, {"N-H": 6}),
    ([(1, "CH4"), (2, "O2")], [(1, "CO2"), (2, "H2O")], {"C-H": 4, "O=O": 2}, {"C=O": 2, "O-H": 4}),
    ([(1, "H2"), (1, "F2")], [(2, "HF")], {"H-H": 1, "F-F": 1}, {"H-F": 2}),
]


def ch_bond_enthalpy(rng):
    L, Rr, br, fo = pick(rng, BR)
    broken = sum(BE[b] * n for b, n in br.items()); formed = sum(BE[b] * n for b, n in fo.items())
    dH = broken - formed
    flat_b = np.array([BE[b] for b, n in br.items() for _ in range(n)]).sum(); flat_f = np.array([BE[b] for b, n in fo.items() for _ in range(n)]).sum()
    agree(dH, flat_b - flat_f, 1e-12, "dH")
    pairs = [("Subtracts the energy of bonds broken from the energy of bonds formed (reversed sign).", formed - broken), ("Counts each bond once and ignores the coefficients.", sum(BE[b] for b in br) - sum(BE[b] for b in fo)),
             ("Adds the energies of the bonds broken and formed.", broken + formed), ("Sums only the bonds formed.", -formed)]
    key, ds = signed_opts(float(dH), pairs, fmt=lambda v: "$" + f"{v:+.0f}" + "\\text{ kJ/mol}_{\\text{rxn}}$")
    tab = "; ".join(f"{b.replace('#', '≡').replace('-', '–')}: ${BE[b]}\\text{{ kJ/mol}}$" for b in sorted(set(br) | set(fo)))
    stem = f"Use the average bond enthalpies ({tab}) to estimate $\\Delta H$ for the reaction {rxn_tex(L, Rr)}. What is the estimated $\\Delta H$ of the reaction, in kJ per mole of reaction as written?"
    return mk("ch_bond_enthalpy", "6.7", "5.F", stem, key, ds, rng, concept="reaction enthalpy from bond enthalpies (bonds broken minus bonds formed)", path="bond counts from a per-reaction table summed exactly vs a flattened list of every bond",
              facts=[f"broken={broken}", f"formed={formed}", f"dH={dH}"], judgment="count every bond broken and formed using the coefficients", est=110,
              kwhy=f"ΔH = energy of bonds broken − energy of bonds formed = ({' + '.join(f'{n}({BE[b]})' for b, n in br.items())}) − ({' + '.join(f'{n}({BE[b]})' for b, n in fo.items())}) = {broken} kJ − {formed} kJ = {dH:+.0f} kJ per mole of reaction.")


# ======================= 6.8 생성 엔탈피 (5.F) =======================
HF = {"CH4": -74.8, "CO2": -393.5, "H2O(l)": -285.8, "H2O(g)": -241.8, "NH3": -45.9, "NO": 90.3, "NO2": 33.2, "SO2": -296.8, "SO3": -395.7, "CaO": -635.1, "CaCO3": -1206.9, "C2H6": -84.0, "CO": -110.5, "O2": 0.0, "Al2O3": -1675.7, "Fe2O3": -824.2}
FR = [([(1, "CH4"), (2, "O2")], [(1, "CO2"), (2, "H2O(l)")]), ([(2, "NO"), (1, "O2")], [(2, "NO2")]), ([(2, "SO2"), (1, "O2")], [(2, "SO3")]), ([(1, "CaCO3")], [(1, "CaO"), (1, "CO2")]),
      ([(4, "NH3"), (5, "O2")], [(4, "NO"), (6, "H2O(g)")]), ([(2, "C2H6"), (7, "O2")], [(4, "CO2"), (6, "H2O(l)")])]


def ch_formation_enthalpy(rng):
    L, Rr = pick(rng, FR)
    dH = sum(c * HF[s] for c, s in Rr) - sum(c * HF[s] for c, s in L)
    v = np.array([c for c, s in Rr] + [-c for c, s in L], dtype=float); h = np.array([HF[s] for c, s in Rr] + [HF[s] for c, s in L])
    agree(dH, float(v @ h), 1e-9, "dH")
    pairs = [("Subtracts products from reactants (reversed sign).", -dH), ("Omits the stoichiometric coefficients.", sum(HF[s] for c, s in Rr) - sum(HF[s] for c, s in L)),
             ("Adds the enthalpies of formation of the reactants and the products.", sum(c * HF[s] for c, s in Rr) + sum(c * HF[s] for c, s in L)), ("Uses only the enthalpies of formation of the products and ignores the reactants.", sum(c * HF[s] for c, s in Rr))]
    key, ds = signed_opts(dH, pairs, fmt=lambda v: "$" + f"{v:+.1f}" + "\\text{ kJ}$")
    species = sorted({s for c, s in L + Rr})
    tab = "; ".join(f"{s.replace('(l)', '(l)')}: ${HF[s]:g}\\text{{ kJ/mol}}$" for s in species)
    def fx(s): return cf(s.split("(")[0]) + (s[s.index("("):] if "(" in s else "")
    eq = "$" + " + ".join((f"{c}\\," if c > 1 else "") + mt(s.split("(")[0]) + (f"({s.split('(')[1]}" if "(" in s else "") for c, s in L) + " \\rightarrow " + " + ".join((f"{c}\\," if c > 1 else "") + mt(s.split("(")[0]) + (f"({s.split('(')[1]}" if "(" in s else "") for c, s in Rr) + "$"
    stem = f"The standard enthalpies of formation are: {tab}. What is $\\Delta H^\\circ$ for the reaction {eq}, in kJ per mole of reaction as written?"
    return mk("ch_formation_enthalpy", "6.8", "5.F", stem, key, ds, rng, concept="reaction enthalpy from standard enthalpies of formation with stoichiometric coefficients", path="explicit loop over products minus reactants vs a signed coefficient vector dot product",
              facts=[f"dH={dH:.4f}", f"L={L}", f"R={Rr}"], judgment="weight each enthalpy of formation by its coefficient and subtract reactants from products", est=110,
              kwhy=f"ΔH° = Σ n ΔHf°(products) − Σ n ΔHf°(reactants) = ({' + '.join(f'({c})({HF[s]:g})' for c, s in Rr)}) − ({' + '.join(f'({c})({HF[s]:g})' for c, s in L)}) = {dH:+.1f} kJ.")


# ======================= 6.5 가열 곡선 (5.F) =======================
@retry_sep
def ch_heating_curve(rng):
    m = pick(rng, [10.0, 20.0, 25.0, 50.0, 100.0]); T0 = pick(rng, [-10.0, -20.0, -30.0]); T1 = pick(rng, [20.0, 40.0, 60.0, 80.0])
    ci, cw, Lf = 2.09, 4.18, 334.0
    q = m * ci * (0 - T0) + m * Lf + m * cw * T1
    verts = [(0.0, T0), (m * ci * (0 - T0), 0.0), (m * ci * (0 - T0) + m * Lf, 0.0), (q, T1)]
    xs = [v[0] for v in verts]; ys = [v[1] for v in verts]
    area = (sum(((xs[i + 1] - xs[i]) / 1.0) for i in range(3)))  # 마지막 x = 누적 열
    agree(q, xs[-1], 1e-9, "q")
    pairs = [("Omits the energy needed to melt the ice.", m * ci * (0 - T0) + m * cw * T1), ("Uses the specific heat of liquid water for the ice as well as for the liquid.", m * cw * (0 - T0) + m * Lf + m * cw * T1),
             ("Stops at 0 °C: adds the warming of the ice and the melting but forgets to warm the liquid water to its final temperature.", m * ci * (0 - T0) + m * Lf), ("Adds the three steps correctly but reports the sum in joules as if it were kilojoules.", q)]
    key, ds = num_opts(q / 1000, [(w, v / 1000 if "joules" not in w else v) for w, v in pairs], "kJ")
    stim = graph_stim("Heating curve for a sample of water heated at a constant rate: temperature versus time", [("Temperature", [[round(x / q * 10, 3), round(y, 2)] for x, y in verts])], gaxis("Time (arbitrary units)", 0, 10, 2), gaxis("Temperature (°C)", T0 - 10, T1 + 10, 20))
    stem = (f"A ${m:g}\\text{{ g}}$ sample of ice at ${T0:g}\\,^{{\\circ}}\\text{{C}}$ is heated at constant pressure and at a constant rate until it forms liquid water at ${T1:g}\\,^{{\\circ}}\\text{{C}}$, as shown in the heating curve. "
            f"The specific heat of ice is ${ci}\\text{{ J/(g}}\\cdot^{{\\circ}}\\text{{C)}}$, the specific heat of liquid water is ${cw}\\text{{ J/(g}}\\cdot^{{\\circ}}\\text{{C)}}$, and the enthalpy of fusion of ice is ${Lf:g}\\text{{ J/g}}$. How much heat, in kJ, is required?")
    return mk("ch_heating_curve", "6.5", "5.F", stem, key, ds, rng, concept="total heat for warming ice, melting it, and warming the liquid", stim=stim, material={"type": "graph", "must_include": ["warming segments", "melting plateau"]},
              path="sum of the three heating steps vs the final heat coordinate of the generated curve vertices", facts=[f"m={m}", f"T0={T0}", f"T1={T1}", f"q={q/1000:.5f}"], judgment="add the sloped segments and the plateau, using the right specific heat for each phase", est=110,
              kwhy=f"Warming the ice: ({m:g} g)({ci} J/(g·°C))({-T0:g} °C) = {m * ci * (0 - T0):.0f} J; melting it: ({m:g} g)({Lf:g} J/g) = {m * Lf:.0f} J; warming the liquid: ({m:g} g)({cw} J/(g·°C))({T1:g} °C) = {m * cw * T1:.0f} J. The total is {q:.0f} J = {q / 1000:.3g} kJ.")


# ======================= 7.4 K 식과 값 (5.F) =======================
KR = [([(1, "N2"), (3, "H2")], [(2, "NH3")]), ([(2, "SO2"), (1, "O2")], [(2, "SO3")]), ([(1, "H2"), (1, "I2")], [(2, "HI")]), ([(2, "NO2")], [(1, "N2O4")]), ([(1, "CO"), (2, "H2")], [(1, "CH3OH")])]


def ch_k_expression(rng):
    L, Rr = pick(rng, KR)
    for _ in forever():
        conc = {s: pick(rng, [0.020, 0.030, 0.050, 0.10, 0.20, 0.40]) for _, s in L + Rr}
        Kc = float(sp.prod([sp.nsimplify(conc[s]) ** c for c, s in Rr]) / sp.prod([sp.nsimplify(conc[s]) ** c for c, s in L]))
        Kn = float(np.prod([conc[s] ** c for c, s in Rr]) / np.prod([conc[s] ** c for c, s in L]))
        agree(Kc, Kn, 1e-9, "K")
        pairs = [("Inverts the expression (reactants over products).", 1 / Kc), ("Omits the exponents from the stoichiometric coefficients.", float(np.prod([conc[s] for c, s in Rr]) / np.prod([conc[s] for c, s in L]))),
                 ("Multiplies by the coefficients instead of using them as exponents.", float(np.prod([c * conc[s] for c, s in Rr]) / np.prod([c * conc[s] for c, s in L]))), ("Adds the product concentrations and subtracts the reactants.", sum(conc[s] for c, s in Rr) - sum(conc[s] for c, s in L))]
        try:
            key, ds = num_opts(Kc, pairs, "", 3, fmt=lambda v: "$" + (f"{v:.3g}" if 0.01 <= v < 1e4 else f"{v:.2e}".replace("e", "\\times10^{") + "}") + "$")
        except ValueError:
            continue
        if 1e-3 < Kc < 1e5:
            break
    rows = [[s, f"{conc[s]:g}"] for _, s in L + Rr]
    stim = table_stimulus("Equilibrium concentrations at a given temperature", "Species", [[cf(r[0]) if False else r[0], r[1]] for r in rows], "Concentration (M)")
    stem = f"The reaction {rxn_tex(L, Rr, '\\rightleftharpoons')} reaches equilibrium at a certain temperature. The equilibrium concentrations are given in the table. What is the value of the equilibrium constant, $K_c$, at this temperature?"
    return mk("ch_k_expression", "7.4", "5.F", stem, key, ds, rng, concept="equilibrium constant from equilibrium concentrations using the balanced equation", stim=stim, material={"type": "table", "must_include": ["equilibrium concentrations"]},
              path="sympy product with exponents vs numpy product", facts=[f"conc={conc}", f"coefs={[(c, s) for c, s in L + Rr]}", f"Kc={Kc:.6g}"], judgment="write the expression with products over reactants raised to their coefficients", est=100,
              kwhy=f"Kc = [products]^coefficients / [reactants]^coefficients = {' × '.join(f'({conc[s]:g})^{c}' for c, s in Rr)} / ({' × '.join(f'({conc[s]:g})^{c}' for c, s in L)}) = {Kc:.3g}.")


# ======================= 7.3 Q 와 K (6.D) =======================
def ch_q_vs_k(rng):
    for _ in forever():
        K = pick(rng, [0.50, 2.0, 4.0, 10.0, 25.0, 50.0]); A = pick(rng, [0.10, 0.20, 0.40, 0.50, 1.0]); B = pick(rng, [0.10, 0.20, 0.40, 0.50, 1.0])  # A + B ⇌ C + D? 사용: 2A ⇌ B 형태
        Q = B / A ** 2
        if abs(math.log(Q / K)) > 0.4:
            break
    right = Q < K
    agree(1.0, 1.0 if (math.log(Q / K) < 0) == right else 0.0, 1e-9, "dir")
    d = {True: "toward the products (to the right)", False: "toward the reactant (to the left)"}
    cmp = {True: "$Q<K$", False: "$Q>K$"}
    key_t = f"The calculated value is $Q={Q:.3g}$, so {cmp[right]} and the reaction proceeds {d[right]} to reach equilibrium."
    wrongs = [(f"The calculated value is $Q={Q:.3g}$, so {cmp[right]} and the reaction proceeds {d[not right]} to reach equilibrium.", "Gets the inequality right but the direction reversed."),
              (f"The calculated value is $Q={Q:.3g}$, so {cmp[not right]} and the reaction proceeds {d[not right]} to reach equilibrium.", "Reverses the comparison of Q and K and the direction accordingly."),
              (f"The calculated value is $Q={Q:.3g}$, so the system is already at equilibrium and no net change occurs.", "Believes any nonzero Q means the system is at equilibrium.")]
    k, ds = sentence_options(key_t, f"Q = [B]/[A]² = {B:g}/({A:g})² = {Q:.3g}, which is {'less' if right else 'greater'} than K = {K:g}, so the mixture must change {'toward the products' if right else 'toward the reactant'} until Q equals K.", wrongs)
    stem = f"For the reaction $2\\,\\mathrm{{A}}(g) \\rightleftharpoons \\mathrm{{B}}(g)$, the equilibrium constant is $K_c={K:g}$ at a certain temperature. A mixture contains $[\\mathrm{{A}}]={A:g}\\text{{ M}}$ and $[\\mathrm{{B}}]={B:g}\\text{{ M}}$. Which statement is correct?"
    return mk("ch_q_vs_k", "7.2", "6.D", stem, k, ds, rng, concept="predict the direction of a reversible reaction by comparing Q with K", path="Q computed from the mixture compared with K via ln(Q/K) sign vs the inequality test", facts=[f"K={K}", f"A={A}", f"B={B}", f"Q={Q:.6f}", f"right={right}"], judgment="compute Q with the correct exponent and compare it with K", est=90)


# ======================= 7.7 ICE 표 (5.F) =======================
@retry_sep
def ch_ice_table(rng):
    for _ in forever():
        A0 = pick(rng, [0.50, 1.0, 0.20, 0.10, 2.0]); K = pick(rng, [0.020, 0.10, 0.40, 1.0, 4.0])
        x = sp.Symbol("x", positive=True)
        sol = [r for r in sp.solve(sp.Eq((2 * x) ** 2, sp.nsimplify(K) * (sp.nsimplify(A0) - x)), x) if r.is_real and r > 0]
        xe = float(sol[0])
        xb = bisect(lambda v: (2 * v) ** 2 - K * (A0 - v), 0.0, A0)
        agree(xe, xb, 1e-7, "x")
        if xe / A0 > 0.06 and A0 - xe > 0.02:
            break
    B = 2 * xe
    approx = math.sqrt(K * A0) / 2 * 2
    pairs = [("Uses x as the equilibrium concentration of B instead of 2x.", xe), ("Applies the small-x approximation even though the change is not negligible compared with the initial concentration.", math.sqrt(K * A0) / 2 * 2), ("Writes the expression with [B] instead of [B]² (leaves out the square) and solves it exactly.", 2 * K * A0 / (2 + K)), ("Reports the equilibrium concentration of A.", A0 - xe)]
    key, ds = num_opts(B, pairs, "M")
    stem = f"At a certain temperature the equilibrium constant for $\\mathrm{{A}}(g) \\rightleftharpoons 2\\,\\mathrm{{B}}(g)$ is $K_c={K:g}$. A flask initially contains only A at ${A0:g}\\text{{ M}}$. What is the equilibrium concentration of B, in M?"
    return mk("ch_ice_table", "7.7", "5.F", stem, key, ds, rng, concept="equilibrium concentration from an ICE table when the approximation is not valid", path="sympy solution of the quadratic vs bisection on the equilibrium expression", facts=[f"K={K}", f"A0={A0}", f"x={xe:.6g}", f"B={B:.6g}"], judgment="set up the ICE table with the stoichiometric 2x and solve the resulting equation", est=140,
              kwhy=f"If x M of A reacts, [A] = {A0:g} − x and [B] = 2x, so Kc = (2x)²/({A0:g} − x) = {K:g}, which gives 4x² + {K:g}x − {K * A0:g} = 0 and x = {xe:.4g} M. Therefore [B] = 2x = {B:.3g} M.")


# ======================= 7.9 르 샤틀리에 (4.A) =======================
def ch_le_chatelier(rng):
    for _ in forever():
        dn = pick(rng, [-1, +1])  # 기체 몰수 변화: 2A ⇌ B (감소) 또는 A ⇌ 2B (증가)
        K = pick(rng, [1.0, 2.0, 5.0]); stress = pick(rng, ["compress", "expand", "add_reactant", "remove_product", "add_inert"])
        a_c, b_c = (2, 1) if dn < 0 else (1, 2)
        # 평형 농도 풀이: K = [B]^b/[A]^a, 총 질량 보존 (A 단위) 으로 A0 = 1 로 정규화
        f = lambda xa: (((1 - xa) * (1 / a_c)) ** b_c if False else None)
        # 단순 수치: A 초기 1.0 M(단위 몰 / V=1), 평형에서 A=1-a*x, B=b*x
        xe = bisect(lambda x: (b_c * x) ** b_c / (1 - a_c * x) ** a_c - K, 0.0, 1 / a_c - 1e-9)
        nA, nB = 1 - a_c * xe, b_c * xe
        V = 1.0
        if stress == "compress":
            V2 = 0.5; Q = (nB / V2) ** b_c / (nA / V2) ** a_c
        elif stress == "expand":
            V2 = 2.0; Q = (nB / V2) ** b_c / (nA / V2) ** a_c
        elif stress == "add_reactant":
            Q = (nB / V) ** b_c / ((nA + 0.5) / V) ** a_c
        elif stress == "remove_product":
            Q = ((nB * 0.5) / V) ** b_c / (nA / V) ** a_c
        else:  # 부피 일정, 비활성 기체 추가 → 농도 불변 → Q = K
            Q = (nB / V) ** b_c / (nA / V) ** a_c
        shift_num = "none" if abs(Q / K - 1) < 1e-9 else ("right" if Q < K else "left")
        # 규칙 경로
        if stress == "compress":
            rule = "right" if b_c < a_c else "left"
        elif stress == "expand":
            rule = "left" if b_c < a_c else "right"
        elif stress == "add_reactant":
            rule = "right"
        elif stress == "remove_product":
            rule = "right"
        else:
            rule = "none"
        agree(1.0, 1.0 if shift_num == rule else 0.0, 1e-9, "shift")
        break
    names = {"right": "toward the products", "left": "toward the reactant", "none": "in neither direction"}
    desc = {"compress": "The volume of the container is halved at constant temperature.", "expand": "The volume of the container is doubled at constant temperature.", "add_reactant": "More A is added at constant temperature and volume.",
            "remove_product": "Some of B is removed at constant temperature and volume.", "add_inert": "An inert gas is added at constant temperature and volume."}[stress]
    reason = {"compress": "the total gas pressure rises, which favors the side with fewer moles of gas", "expand": "the total gas pressure falls, which favors the side with more moles of gas", "add_reactant": "adding a reactant makes Q less than K",
              "remove_product": "removing a product makes Q less than K", "add_inert": "the concentrations of A and B do not change, so Q still equals K"}[stress]
    reason_for = {"right": "the reaction quotient Q becomes smaller than K, so more products must form until Q equals K again", "left": "the reaction quotient Q becomes larger than K, so more reactant must form until Q equals K again", "none": "the concentrations of A and B do not change, so Q still equals K"}
    rel_of = {"right": "smaller than", "left": "larger than", "none": "equal to"}
    claim_not = {"right": "does not shift toward the products", "left": "does not shift toward the reactant", "none": "does not stay at equilibrium"}
    dn = b_c - a_c
    truth = {"compress": f"halving the volume doubles both concentrations, so Q = [B]^{b_c}/[A]^{a_c} is multiplied by 2^({b_c} − {a_c}) = {2.0 ** dn:g}",
             "expand": f"doubling the volume halves both concentrations, so Q = [B]^{b_c}/[A]^{a_c} is multiplied by (1/2)^({b_c} − {a_c}) = {0.5 ** dn:g}",
             "add_reactant": "adding A increases [A], the reactant in the denominator of Q, so Q falls below K", "remove_product": "removing B decreases [B], the product in the numerator of Q, so Q falls below K",
             "add_inert": "an inert gas added at constant volume leaves every concentration unchanged, so Q stays equal to K"}[stress]
    key_t = f"The system shifts {names[rule]}, because {reason_for[rule]}."
    wrongs = [(f"The system shifts {names[w]}, because {reason_for[w]}.", f"After this disturbance Q is {rel_of[rule]} K, not {rel_of[w]} K, so the system {claim_not[w]}.") for w in ("right", "left", "none") if w != rule][:2]
    wrongs.append((f"The system shifts {names['right' if rule != 'right' else 'left']}, because the equilibrium constant changes.", "Believes that a change in concentration or volume changes the value of K, which depends only on temperature."))
    k, ds = sentence_options(key_t, f"For this disturbance {truth}; Q is therefore {rel_of[rule]} K, so the system " + ("does not shift." if rule == "none" else f"shifts {names[rule]} until Q equals K again."), wrongs)
    stem = f"The reaction ${a_c if a_c > 1 else ''}\\mathrm{{A}}(g) \\rightleftharpoons {b_c if b_c > 1 else ''}\\mathrm{{B}}(g)$ is at equilibrium. {desc} Which statement correctly describes the response of the system?"
    return mk("ch_le_chatelier", "7.9", "4.A", stem, k, ds, rng, concept="predict the shift of an equilibrium after a concentration, volume, or inert-gas change", path="numeric Q after the change vs K (direction from the sign of ln Q/K) agrees with the rule from moles of gas",
              facts=[f"a={a_c}", f"b={b_c}", f"K={K}", f"stress={stress}", f"shift={rule}"], judgment="decide how Q compares with K after the disturbance", est=90)


# ======================= 7.11 Ksp 용해도 (5.F) =======================
KSP = [("AgCl", 1, 1, 1.8e-10), ("BaSO4", 1, 1, 1.1e-10), ("PbI2", 1, 2, 9.8e-9), ("CaF2", 1, 2, 3.5e-11), ("Ag2CrO4", 2, 1, 1.1e-12), ("Mg(OH)2", 1, 2, 5.6e-12), ("Fe(OH)3", 1, 3, 2.8e-39), ("Ca3(PO4)2", 3, 2, 2.0e-29)]


@retry_sep
def ch_ksp_solubility(rng):
    f, a, b, ksp = pick(rng, KSP[:6])
    s = sp.Symbol("s", positive=True)
    sol = float(sp.solve(sp.Eq((a * s) ** a * (b * s) ** b, sp.nsimplify(ksp)), s)[0])
    sb = bisect(lambda v: (a * v) ** a * (b * v) ** b - ksp, 0.0, 1.0)
    agree(sol, sb, 1e-6, "s")
    pairs = [("Takes the square root of Ksp regardless of the formula.", math.sqrt(ksp)), ("Omits the stoichiometric coefficients when writing the solubility product.", ksp ** (1 / (a + b))), ("Reports Ksp itself as the molar solubility.", ksp), ("Divides Ksp by the total number of ions instead of solving the product expression.", ksp / (a + b))]
    key, ds = num_opts(sol, pairs, "M", 3, fmt=lambda v: sci(v, "M"))
    stem = f"The solubility product constant, $K_{{sp}}$, of {cf(f)} is " + sci(ksp, "").replace("$", "$") + f" at $25^\\circ\\text{{C}}$. What is the molar solubility of {cf(f)} in pure water, in M?"
    return mk("ch_ksp_solubility", "7.11", "5.F", stem, key, ds, rng, concept="molar solubility from Ksp for salts with different ion ratios", path="sympy solution of the Ksp expression vs bisection on (as)^a (bs)^b - Ksp", facts=[f"f={f}", f"a={a}", f"b={b}", f"ksp={ksp}", f"s={sol:.6e}"], judgment="write the Ksp expression with the correct exponents and solve for s", est=100,
              kwhy=f"For {f}, Ksp = ({a}s)^{a}({b}s)^{b} = {a ** a * b ** b} s^{a + b}, so s = (Ksp / {a ** a * b ** b})^(1/{a + b}) = ({sn(ksp, 3)} / {a ** a * b ** b})^(1/{a + b}) = {sn(sol, 3)} M.")


# ======================= 7.12 공통 이온 (5.F) =======================
@retry_sep
def ch_common_ion(rng):
    f, a, b, ksp = pick(rng, [("AgCl", 1, 1, 1.8e-10), ("BaSO4", 1, 1, 1.1e-10), ("AgBr", 1, 1, 5.0e-13)])
    c = pick(rng, [0.010, 0.050, 0.10, 0.20])
    s = sp.Symbol("s", positive=True)
    sol = float(sp.solve(sp.Eq(s * (s + sp.nsimplify(c)), sp.nsimplify(ksp)), s)[0] if True else 0)
    sol = max(float(r) for r in sp.solve(sp.Eq(s * (s + sp.nsimplify(c)), sp.nsimplify(ksp)), s) if r.is_real)
    sb = bisect(lambda v: v * (v + c) - ksp, 0.0, 1.0)
    agree(sol, sb, 1e-6, "s")
    pure = math.sqrt(ksp)
    pairs = [("Reports the molar solubility in pure water.", pure), ("Divides Ksp by the square of the common-ion concentration.", ksp / c ** 2), ("Multiplies Ksp by the common-ion concentration.", ksp * c), ("Takes the square root of Ksp divided by the common-ion concentration.", math.sqrt(ksp / c))]
    key, ds = num_opts(sol, pairs, "M", 3, fmt=lambda v: sci(v, "M"))
    ion = {"AgCl": ("NaCl", "chloride"), "BaSO4": ("Na2SO4", "sulfate"), "AgBr": ("NaBr", "bromide")}[f]
    stem = f"The $K_{{sp}}$ of {cf(f)} is " + sci(ksp, "") + f" at $25^\\circ\\text{{C}}$. What is the molar solubility of {cf(f)} in a ${c:g}\\text{{ M}}$ solution of {cf(ion[0])}, in M?"
    return mk("ch_common_ion", "7.12", "5.F", stem, key, ds, rng, concept="solubility in the presence of a common ion", path="sympy quadratic for s(s + c) = Ksp vs bisection", facts=[f"f={f}", f"ksp={ksp}", f"c={c}", f"s={sol:.6e}"], judgment="include the common ion's initial concentration in the Ksp expression", est=100,
              kwhy=f"The common ion is already present at {c:g} M, so Ksp = s(s + {c:g}) = {sn(ksp, 2)}. Because s is much smaller than {c:g}, s ≈ Ksp/{c:g}, and solving the quadratic exactly gives s = {sn(sol, 3)} M, far smaller than the solubility in pure water ({sn(pure, 2)} M).")


# ======================= 7.6 K 조작 (5.B) =======================
def ch_k_manipulation(rng):
    for _ in forever():
        K1 = pick(rng, [2.0, 4.0, 5.0, 10.0, 0.50, 0.20]); K2 = pick(rng, [3.0, 4.0, 0.25, 0.10, 6.0, 0.50]); a = pick(rng, [-1, 1, 2, -2]); b = pick(rng, [1, 2, -1])
        if a == 1 and b == 1:
            continue
        K = K1 ** a * K2 ** b
        lk = a * math.log(K1) + b * math.log(K2)
        agree(K, math.exp(lk), 1e-9, "K")
        pairs = [("Adds the equilibrium constants when the reactions are added.", K1 * a + K2 * b), ("Multiplies the constants but ignores that a reversed reaction has the reciprocal K.", K1 ** abs(a) * K2 ** abs(b)), ("Multiplies each K by the coefficient instead of raising it to that power.", K1 * a * K2 * b if a * b > 0 else abs(K1 * a * K2 * b)),
                 ("Uses the reciprocal of the correct combined constant.", 1 / K)]
        try:
            key, ds = num_opts(K, pairs, "", 3, fmt=lambda v: "$" + (f"{v:.3g}") + "$")
        except ValueError:
            continue
        break
    r1 = ("reverse of reaction 1" if a < 0 else "reaction 1") + (f" multiplied by {abs(a)}" if abs(a) > 1 else "")
    r2 = ("reverse of reaction 2" if b < 0 else "reaction 2") + (f" multiplied by {abs(b)}" if abs(b) > 1 else "")
    stem = f"At a certain temperature, reaction 1 has an equilibrium constant $K_1={K1:g}$ and reaction 2 has an equilibrium constant $K_2={K2:g}$. A third reaction is obtained by adding the {r1} to the {r2}. What is the equilibrium constant of the third reaction at this temperature?"
    return mk("ch_k_manipulation", "7.6", "5.B", stem, key, ds, rng, concept="equilibrium constant of a reaction made by reversing, scaling, and adding reactions", path="exact powers K1^a K2^b vs exponentiated sum of logarithms", facts=[f"K1={K1}", f"K2={K2}", f"a={a}", f"b={b}", f"K={K:.6g}"], judgment="reverse means reciprocal, multiplying a reaction means a power, adding means multiplying", est=100,
              kwhy=f"Reversing a reaction inverts its K, multiplying a reaction by n raises K to the nth power, and adding reactions multiplies their K values: K = K1^({a}) × K2^({b}) = ({K1:g})^({a}) × ({K2:g})^({b}) = {K:.3g}.")
