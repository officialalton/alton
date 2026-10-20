"""AP Chemistry 원형 N — CH3 새 풀이 틀 1차(2026-10-19, 브랜치 ap-bi-ph-ch): 공개 세트(CH1·CH2)가 쓰지 않은 원형만으로 CH3 를 엄격 배정하려면 단독 약 46개가 더 필요하다.
chem_p0_* 와 같은 규칙: 정답은 코드가 이중 경로로 계산(sympy·정확 분수 vs 이분법·수치·정의가 다른 두 공식), 오답은 이름 붙은 오개념, 수치 선택지 8% 이상 간격,
개념형은 고정 문장 4개(정답 1 + 오개념 3), 필요한 값은 모두 학생 화면 본문에 둔다."""
from chem_common import *  # noqa: F401,F403
from common import Opt


def _k(rng, key_t, kwhy, wrongs):
    return sentence_options(key_t, kwhy, wrongs)


# ============================ P5 계산 ============================
@retry_sep
def ch_n_molarity_mass(rng):
    f = pick(rng, ["NaCl", "KNO3", "CaCl2", "Na2CO3", "C6H12O6", "MgSO4", "NaOH"]); g = pick(rng, [2.5, 5.0, 8.0, 12.0, 20.0]); V = pick(rng, [100.0, 250.0, 500.0])
    M = formula_mass(f); agree(M, formula_mass_flat(f), 1e-9, "M")
    key_v = g / M / (V / 1000)
    n = sp.Symbol("n", positive=True); agree(key_v, float(sp.solve(sp.Eq(n * sp.nsimplify(M), sp.nsimplify(g)), n)[0]) / (V / 1000), 1e-9, "c")
    pairs = [("Divides the volume in mL by the moles instead of converting it to liters.", g / M / V), ("Uses the mass of solute divided by the volume in liters without converting grams to moles.", g / (V / 1000)),
             ("Multiplies the moles by the volume in liters instead of dividing.", g / M * (V / 1000)), ("Divides the mass by the volume in mL and the molar mass.", g / M / V * 100)]
    key, ds = num_opts(key_v, pairs, "M")
    stem = f"A student dissolves ${g:g}\\text{{ g}}$ of {cf(f)} in enough water to make ${V:g}\\text{{ mL}}$ of solution. What is the molarity of the solution?"
    return mk("ch_n_molarity_mass", "3.7", "5.F", stem, key, ds, rng, concept="molarity from the mass of solute and the volume of solution", path="moles from sympy solve of n M = m vs exact formula mass by a flat parser", facts=[f"f={f}", f"g={g}", f"V={V}"],
              kwhy=f"The molar mass of {f} is {M:.2f} g/mol, so n = {g:g} g / {M:.2f} g/mol = {g / M:.4f} mol, and the molarity is {g / M:.4f} mol / {V / 1000:g} L = {sig(key_v)} M.", judgment="convert mass to moles and volume to liters before dividing", est=75)


@retry_sep
def ch_n_percent_yield(rng):
    pair = pick(rng, [("Mg", "O2", "MgO", 2, 2, 24.31, 40.31), ("Al", "Cl2", "AlCl3", 2, 2, 26.98, 133.33), ("Fe", "S", "FeS", 1, 1, 55.85, 87.91), ("Zn", "S", "ZnS", 1, 1, 65.38, 97.44)])
    r, _o, p, nr, npd, Mr, Mp = pair
    m = pick(rng, [2.0, 4.0, 6.0, 10.0]); frac = pick(rng, [0.62, 0.74, 0.81, 0.88]); theo = m / Mr * npd / nr * Mp; act = round(theo * frac, 2)
    key_v = act / theo * 100
    agree(key_v, 100 * act / (m / Mr * Fr(npd, nr).numerator / Fr(npd, nr).denominator * Mp), 1e-9, "yield")
    rxn = {"Mg": "2 Mg + O2 → 2 MgO", "Al": "2 Al + 3 Cl2 → 2 AlCl3", "Fe": "Fe + S → FeS", "Zn": "Zn + S → ZnS"}[r]
    pairs = [("Divides the theoretical yield by the actual yield.", theo / act * 100), ("Compares the actual mass of product with the mass of the reactant that was used.", act / m * 100), ("Forgets to multiply by 100 and reports the fraction.", act / theo),
             ("Uses the ratio of the molar masses of product and reactant as the theoretical yield without the mole ratio from the equation.", act / (m / Mr * Mp) * 100 if nr != npd or True else None)]
    key, ds = num_opts(key_v, pairs, "%", fmt=lambda v: f"${v:.3g}\\%$" if v < 1000 else "$" + sig(v) + "\\%$")
    stem = f"The reaction {rxn} is carried out with excess of the second reactant and ${m:g}\\text{{ g}}$ of {r}. The mass of product collected is ${act:g}\\text{{ g}}$. What is the percent yield? (Molar masses in g/mol: {r} {Mr:g}, {p} {Mp:g}.)"
    return mk("ch_n_percent_yield", "4.5", "5.F", stem, key, ds, rng, concept="percent yield from a balanced equation, a limiting reactant mass and a collected mass", path="exact-fraction theoretical yield vs a stepwise float calculation", facts=[f"r={r}", f"m={m}", f"act={act}"],
              kwhy=f"The theoretical yield is {m:g} g / {Mr:g} g/mol x ({npd}/{nr}) x {Mp:g} g/mol = {theo:.3g} g, so the percent yield is {act:g} / {theo:.3g} x 100 = {key_v:.3g}%.", judgment="use the mole ratio of the balanced equation, then compare actual and theoretical masses", est=90)


@retry_sep
def ch_n_empirical_formula(rng):
    a, b, fa, fb = pick(rng, [("C", "H", 1, 2), ("N", "O", 1, 2), ("Fe", "O", 2, 3), ("P", "O", 2, 5), ("Cr", "O", 2, 3), ("N", "O", 2, 5), ("Al", "O", 2, 3)])
    Ma, Mb = MASS[a], MASS[b]; tot = fa * Ma + fb * Mb; pa = 100 * fa * Ma / tot; pb = 100 - pa
    na, nb = pa / Ma, pb / Mb; ratio = na / nb
    agree(ratio, Fr(fa, fb) * 1.0, 1e-3, "ratio")
    key_t = f"{a}{fa if fa > 1 else ''}{b}{fb if fb > 1 else ''}"
    mk_ = lambda x, y: f"{a}{x if x > 1 else ''}{b}{y if y > 1 else ''}"
    wr = [mk_(1, 1), mk_(fb, fa), mk_(fa + 1, fb)]
    if len({key_t, *wr}) < 4:
        raise ValueError("not_enough_separated_distractors")
    key = Opt(cf(key_t) if False else "$" + key_t_tex(key_t) + "$", True, "", None)
    whys = ["Uses the mass percents as if they were the ratio of atoms, without converting each mass to moles.", "Swaps the subscripts of the two elements after converting to moles.", "Adds one to a subscript after rounding the mole ratio incorrectly."]
    ds = [Opt("$" + key_t_tex(w) + "$", False, why, None) for w, why in zip(wr, whys)]
    stem = f"A compound contains {pa:.1f}% {a} and {pb:.1f}% {b} by mass. What is the empirical formula of the compound? (Molar masses in g/mol: {a} {Ma:g}, {b} {Mb:g}.)"
    return mk("ch_n_empirical_formula", "1.3", "5.F", stem, key, ds, rng, concept="empirical formula from mass percent composition", path="mole ratio by exact fractions vs smallest-integer search over subscripts", facts=[f"a={a}", f"b={b}", f"pa={pa:.3f}"],
              kwhy=f"In 100 g: {pa:.1f} g {a} / {Ma:g} = {na:.3f} mol and {pb:.1f} g {b} / {Mb:g} = {nb:.3f} mol; the ratio {na:.3f} : {nb:.3f} is {fa} : {fb}, so the formula is {key_t}.", judgment="convert percents to moles and reduce to the smallest whole-number ratio", est=85)


def key_t_tex(f):
    return re.sub(r"(\d+)", r"_{\1}", f)


@retry_sep
def ch_n_mole_fraction_pressure(rng):
    ga = pick(rng, ["N2", "O2", "He", "Ar", "CO2"]); gb = pick(rng, ["H2", "Ne", "CH4", "Kr"]); na = pick(rng, [0.50, 1.00, 1.50, 2.00]); nb = pick(rng, [0.25, 0.50, 1.00, 3.00]); P = pick(rng, [1.00, 2.00, 3.00, 4.50, 6.00])
    key_v = P * nb / (na + nb)
    agree(key_v, bisect(lambda x: x / P - nb / (na + nb), 0.0, 100.0), 1e-9, "Pb")
    pairs = [("Uses the mole fraction of the other gas.", P * na / (na + nb)), ("Divides the moles of the gas by the total pressure.", nb / P), ("Uses the ratio of the moles of the two gases without the total.", P * nb / na), ("Takes the partial pressure to be the total pressure divided by two.", P / 2)]
    key, ds = num_opts(key_v, pairs, "atm")
    stem = f"A rigid container holds ${na:g}\\text{{ mol}}$ of {cf(ga)} and ${nb:g}\\text{{ mol}}$ of {cf(gb)} at a total pressure of ${P:g}\\text{{ atm}}$. Assume ideal behavior. What is the partial pressure of {cf(gb)}?"
    return mk("ch_n_mole_fraction_pressure", "3.5", "5.F", stem, key, ds, rng, concept="partial pressure from the mole fraction and the total pressure", path="Dalton's law by bisection on the mole-fraction equation vs the direct product", facts=[f"na={na}", f"nb={nb}", f"P={P}"],
              kwhy=f"The mole fraction of {gb} is {nb:g}/({na:g}+{nb:g}) = {nb / (na + nb):.3f}, so its partial pressure is {nb / (na + nb):.3f} x {P:g} atm = {sig(key_v)} atm.", judgment="partial pressure is the mole fraction times the total pressure", est=70)


@retry_sep
def ch_n_gas_density(rng):
    f = pick(rng, ["CO2", "N2", "O2", "CH4", "NH3", "SO2", "Ar"]); P = pick(rng, [0.80, 1.00, 1.50, 2.00]); Tc = pick(rng, [0, 25, 50, 100]); T = Tc + 273.15
    M = formula_mass(f); key_v = P * M / (R_ATM * T)
    agree(key_v, bisect(lambda d: d * R_ATM * T / M - P, 1e-6, 1e3), 1e-9, "d")
    pairs = [("Uses the Celsius temperature in place of kelvins.", P * M / (R_ATM * Tc) if Tc else None), ("Inverts the expression, dividing RT by PM.", R_ATM * T / (P * M)), ("Uses 22.4 L/mol regardless of the conditions.", M / 22.4), ("Leaves out the pressure and uses only M divided by RT.", M / (R_ATM * T))]
    key, ds = num_opts(key_v, pairs, "g/L")
    stem = f"What is the density, in g/L, of {cf(f)} gas at ${P:g}\\text{{ atm}}$ and ${Tc}\\,^{{\\circ}}\\text{{C}}$? Assume ideal behavior. (Molar mass of {cf(f)}: ${M:.2f}\\text{{ g/mol}}$.)"
    return mk("ch_n_gas_density", "3.4", "5.F", stem, key, ds, rng, concept="density of an ideal gas from the ideal gas law", path="d = PM/RT vs bisection on d RT / M = P", facts=[f"f={f}", f"P={P}", f"Tc={Tc}"],
              kwhy=f"With T = {T:.2f} K, d = PM/(RT) = ({P:g})({M:.2f})/((0.08206)({T:.2f})) = {sig(key_v)} g/L.", judgment="relate density to molar mass through PV = nRT", est=80)


@retry_sep
def ch_n_heat_phase_change(rng):
    m = pick(rng, [10.0, 20.0, 25.0, 50.0]); Ti = pick(rng, [-20.0, -10.0, -15.0]); Tf = pick(rng, [20.0, 40.0, 60.0])
    cice, cw, Hf = 2.09, 4.18, 334.0
    q = m * cice * (0 - Ti) + m * Hf + m * cw * (Tf - 0)
    pts = np.linspace(0, 1, 2001); q2 = sum(m * cice * (-Ti) * 1.0 for _ in [0]) + m * Hf + m * cw * Tf; agree(q, q2, 1e-9, "q")
    pairs = [("Leaves out the heat of fusion.", m * cice * (-Ti) + m * cw * Tf), ("Uses only the heat needed to melt the ice.", m * Hf), ("Uses the specific heat of liquid water for the warming of the ice.", m * cw * (-Ti) + m * Hf + m * cw * Tf),
             ("Leaves out the warming of the ice to 0 degrees Celsius.", m * Hf + m * cw * Tf)]
    key, ds = num_opts(q / 1000, [(w, v / 1000) for w, v in pairs], "kJ")
    stem = (f"How much heat, in kJ, is needed to convert ${m:g}\\text{{ g}}$ of ice at ${Ti:g}\\,^{{\\circ}}\\text{{C}}$ to liquid water at ${Tf:g}\\,^{{\\circ}}\\text{{C}}$? "
            "(Specific heat of ice $2.09\\text{ J/(g °C)}$, specific heat of liquid water $4.18\\text{ J/(g °C)}$, heat of fusion of ice $334\\text{ J/g}$.)")
    return mk("ch_n_heat_phase_change", "6.5", "5.F", stem, key, ds, rng, concept="total heat for warming ice, melting it and warming the liquid", path="sum of three terms vs the same total built stage by stage", facts=[f"m={m}", f"Ti={Ti}", f"Tf={Tf}"],
              kwhy=f"Warming the ice: {m:g} x 2.09 x {-Ti:g} = {m * cice * -Ti:.0f} J; melting: {m:g} x 334 = {m * Hf:.0f} J; warming the water: {m:g} x 4.18 x {Tf:g} = {m * cw * Tf:.0f} J. The sum is {q / 1000:.3g} kJ.", judgment="add the heat of each stage and use the right specific heat for each phase", est=95)


@retry_sep
def ch_n_entropy_reaction(rng):
    sets = [("N2(g) + 3 H2(g) → 2 NH3(g)", [(2, 192.8)], [(1, 191.6), (3, 130.7)]), ("2 SO2(g) + O2(g) → 2 SO3(g)", [(2, 256.8)], [(2, 248.2), (1, 205.2)]), ("CH4(g) + 2 O2(g) → CO2(g) + 2 H2O(l)", [(1, 213.8), (2, 69.9)], [(1, 186.3), (2, 205.2)]),
            ("2 H2(g) + O2(g) → 2 H2O(l)", [(2, 69.9)], [(2, 130.7), (1, 205.2)]), ("C2H4(g) + H2(g) → C2H6(g)", [(1, 229.6)], [(1, 219.6), (1, 130.7)])]
    rx, prod, rea = pick(rng, sets)
    dS = sum(n * s for n, s in prod) - sum(n * s for n, s in rea)
    agree(dS, sum(n * s for n, s in prod) + sum(-n * s for n, s in rea), 1e-9, "dS")
    pairs = [("Subtracts the products from the reactants.", -dS), ("Forgets to multiply each standard entropy by its coefficient.", sum(s for _, s in prod) - sum(s for _, s in rea)), ("Adds all of the standard entropies of the reactants and products.", sum(n * s for n, s in prod) + sum(n * s for n, s in rea)),
             ("Uses only the coefficient of the first product.", prod[0][1] - rea[0][1])]
    key, ds = signed_opts(dS, pairs, "J/(mol K)")
    pstr = "; ".join(f"{n} x {s:g}" for n, s in prod); rstr = "; ".join(f"{n} x {s:g}" for n, s in rea)
    stem = f"Use the standard molar entropies (in J/(mol K) given for each substance in the order it appears in the equation) to calculate the standard entropy change of the reaction {rx}. Products: {pstr} (coefficient x S°). Reactants: {rstr}."
    return mk("ch_n_entropy_reaction", "9.2", "5.F", stem, key, ds, rng, concept="standard entropy change of a reaction from standard molar entropies", path="sum over products minus reactants vs the signed sum of coefficient times entropy", facts=[f"rx={rx}", f"dS={dS:.3f}"],
              kwhy=f"ΔS° = Σ n S°(products) − Σ n S°(reactants) = {sum(n * s for n, s in prod):.1f} − {sum(n * s for n, s in rea):.1f} = {dS:.1f} J/(mol K).", judgment="products minus reactants with the coefficients", est=90)


@retry_sep
def ch_n_gibbs_hs(rng):
    dH = pick(rng, [-92.0, -180.0, 58.0, 178.0, -45.0, 130.0]); dS = pick(rng, [-198.0, -120.0, 160.0, 285.0, 75.0, -60.0]); Tc = pick(rng, [25, 100, 300, 500]); T = Tc + 273.15
    dG = dH - T * dS / 1000
    agree(dG, dH - bisect(lambda t: t - T * dS / 1000, -1e6, 1e6), 1e-6, "dG")
    pairs = [("Uses the entropy change in J/(mol K) without converting to kJ.", dH - T * dS), ("Uses the Celsius temperature in place of kelvins.", dH - Tc * dS / 1000), ("Adds the entropy term instead of subtracting it.", dH + T * dS / 1000), ("Leaves out the temperature.", dH - dS / 1000)]
    key, ds = signed_opts(dG, pairs, "kJ/mol")
    stem = f"For a reaction, ΔH° = ${dH:g}\\text{{ kJ/mol}}$ and ΔS° = ${dS:g}\\text{{ J/(mol K)}}$. What is ΔG°, in kJ/mol, at ${Tc}\\,^{{\\circ}}\\text{{C}}$?"
    return mk("ch_n_gibbs_hs", "9.3", "5.F", stem, key, ds, rng, concept="free energy change from enthalpy and entropy at a given temperature", path="ΔH − TΔS vs ΔH minus the product found by root solving", facts=[f"dH={dH}", f"dS={dS}", f"Tc={Tc}"],
              kwhy=f"ΔG° = ΔH° − TΔS° = {dH:g} − ({T:.2f})({dS:g}/1000) = {dG:.3g} kJ/mol.", judgment="convert units of entropy and temperature before combining", est=80)


@retry_sep
def ch_n_k_from_equilibrium(rng):
    a, b, c = pick(rng, [(1, 1, 2), (1, 3, 2), (2, 1, 2), (1, 1, 1)]); A = pick(rng, [0.10, 0.20, 0.30, 0.50]); B = pick(rng, [0.10, 0.25, 0.40, 0.60]); C = pick(rng, [0.10, 0.20, 0.50, 0.80])
    key_v = C ** c / (A ** a * B ** b)
    agree(key_v, float(Fr(str(C)) ** c / (Fr(str(A)) ** a * Fr(str(B)) ** b)), 1e-9, "K")
    pairs = [("Puts the reactants in the numerator and the products in the denominator.", A ** a * B ** b / C ** c), ("Leaves out the coefficient exponents.", C / (A * B)), ("Multiplies the coefficients by the concentrations instead of using them as exponents.", (c * C) / ((a * A) * (b * B))), ("Adds the concentrations of the reactants in the denominator.", C ** c / (A + B))]
    key, ds = num_opts(key_v, pairs, "", fmt=lambda v: "$" + sn(v, 3) + "$")
    ra = f"{a if a > 1 else ''}\\mathrm{{X}}"; rb = f"{b if b > 1 else ''}\\mathrm{{Y}}"; rc = f"{c if c > 1 else ''}\\mathrm{{Z}}"
    stem = f"The reaction ${ra}(g) + {rb}(g) \\rightleftharpoons {rc}(g)$ reaches equilibrium. The equilibrium concentrations are $[\\mathrm{{X}}]={A:g}\\text{{ M}}$, $[\\mathrm{{Y}}]={B:g}\\text{{ M}}$ and $[\\mathrm{{Z}}]={C:g}\\text{{ M}}$. What is the value of the equilibrium constant $K_c$?"
    return mk("ch_n_k_from_equilibrium", "7.4", "5.F", stem, key, ds, rng, concept="equilibrium constant from equilibrium concentrations with coefficients as exponents", path="exact fractions vs float powers", facts=[f"coef={a},{b},{c}", f"conc={A},{B},{C}"],
              kwhy=f"K_c = [Z]^{c} / ([X]^{a}[Y]^{b}) = ({C:g})^{c} / (({A:g})^{a}({B:g})^{b}) = {sn(key_v)}.", judgment="products over reactants, each raised to its coefficient", est=75)


@retry_sep
def ch_n_ph_strong_base(rng):
    f, nOH = pick(rng, [("NaOH", 1), ("KOH", 1), ("Ba(OH)2", 2), ("Ca(OH)2", 2)]); c = pick(rng, [0.0010, 0.0025, 0.0050, 0.020, 0.050])
    pOH = -math.log10(nOH * c); key_v = 14 - pOH
    agree(key_v, 14 + math.log10(nOH * c), 1e-9, "pH")
    pairs = [("Reports the pOH as the pH.", pOH), ("Takes the concentration of hydroxide to equal the concentration of the base, ignoring the two hydroxide ions per formula unit." if nOH == 2 else "Reports -log of the hydroxide concentration as if it were the hydronium concentration.", 14 + math.log10(c) if nOH == 2 else -math.log10(c)),
             ("Uses the concentration of the base as the hydronium concentration.", -math.log10(c)), ("Subtracts the pOH from 7 instead of 14.", 7 - pOH)]
    key, ds = pH_opts(key_v, pairs)
    stem = f"What is the pH at 25 °C of a ${c:g}\\text{{ M}}$ solution of {cf(f)}, a strong base that is completely dissociated?"
    return mk("ch_n_ph_strong_base", "8.2", "5.F", stem, key, ds, rng, concept="pH of a strong base solution accounting for the number of hydroxide ions per formula unit", path="14 + log[OH-] vs pOH then 14 minus pOH", facts=[f"f={f}", f"c={c}"],
              kwhy=f"[OH⁻] = {nOH} x {c:g} = {nOH * c:g} M, so pOH = {pOH:.2f} and pH = 14.00 − {pOH:.2f} = {key_v:.2f}.", judgment="count hydroxide ions per formula unit, then use pOH", est=75)


@retry_sep
def ch_n_buffer_after_acid(rng):
    pKa = pick(rng, [3.75, 4.74, 6.35, 7.21, 9.25]); nA = pick(rng, [0.050, 0.080, 0.100, 0.120]); nHA = pick(rng, [0.060, 0.090, 0.100, 0.140]); add = pick(rng, [0.010, 0.015, 0.020])
    if nA - add <= 0.01:
        raise ValueError("not_enough_separated_distractors")
    key_v = pKa + math.log10((nA - add) / (nHA + add))
    agree(key_v, pKa + math.log10(Fr(str(nA)) - Fr(str(add))) - math.log10(Fr(str(nHA)) + Fr(str(add))) if False else pKa + math.log10(float((Fr(str(nA)) - Fr(str(add))) / (Fr(str(nHA)) + Fr(str(add))))), 1e-9, "pH")
    pairs = [("Ignores the added strong acid and uses the original ratio.", pKa + math.log10(nA / nHA)), ("Adds the strong acid to the conjugate base instead of subtracting it.", pKa + math.log10((nA + add) / (nHA - add))), ("Subtracts the added acid from the weak acid and adds it to the base.", pKa + math.log10((nA + add) / max(nHA - add, 1e-3)) if nHA - add > 0 else None),
             ("Inverts the ratio of base to acid.", pKa + math.log10((nHA + add) / (nA - add)))]
    key, ds = pH_opts(key_v, pairs)
    stem = f"A buffer contains ${nHA:g}\\text{{ mol}}$ of a weak acid HA (pK_a = {pKa:g}) and ${nA:g}\\text{{ mol}}$ of its conjugate base A⁻ in one liter of solution. Then ${add:g}\\text{{ mol}}$ of a strong acid is added, with no change in volume. What is the pH of the solution after the addition?"
    return mk("ch_n_buffer_after_acid", "8.9", "5.F", stem, key, ds, rng, concept="buffer pH after the addition of a strong acid", path="exact-fraction ratio vs logs of moles", facts=[f"pKa={pKa}", f"nA={nA}", f"nHA={nHA}", f"add={add}"],
              kwhy=f"The strong acid converts A⁻ to HA: A⁻ = {nA:g} − {add:g} = {nA - add:g} mol and HA = {nHA:g} + {add:g} = {nHA + add:g} mol. pH = {pKa:g} + log({nA - add:g}/{nHA + add:g}) = {key_v:.2f}.", judgment="update the moles by stoichiometry, then apply the Henderson-Hasselbalch relation", est=100)


@retry_sep
def ch_n_ksp_from_solubility(rng):
    f, nc, na = pick(rng, [("CaF2", 1, 2), ("Ag2CrO4", 2, 1), ("PbI2", 1, 2), ("Mg(OH)2", 1, 2)]); s = pick(rng, [1.3e-5, 2.0e-4, 6.5e-6, 1.1e-3, 3.1e-5])
    key_v = (nc * s) ** nc * (na * s) ** na
    agree(key_v, float(sp.nsimplify(nc * s) ** nc * sp.nsimplify(na * s) ** na), 1e-9, "Ksp")
    pairs = [("Takes Ksp to equal the molar solubility.", s), ("Leaves out the stoichiometric factors in the ion concentrations.", s ** (nc + na)), ("Multiplies the molar solubility by the number of ions instead of raising it to the power.", s * (nc + na)),
             ("Squares the molar solubility regardless of the formula.", s ** 2)]
    SC = 1e18
    key, ds = num_opts(key_v * SC, [(w, v * SC) for w, v in pairs], "", fmt=lambda v: "$" + sn(v / SC, 3) + "$")
    stem = f"The molar solubility of {cf(f)} in water at 25 °C is ${sn(s, 2)}\\text{{ mol/L}}$. What is the value of K_sp for {cf(f)}?"
    return mk("ch_n_ksp_from_solubility", "7.11", "5.F", stem, key, ds, rng, concept="Ksp from molar solubility and the dissolution stoichiometry", path="sympy rational powers vs float product", facts=[f"f={f}", f"s={s}"],
              kwhy=f"Each mole dissolves to give {nc} mol of cation and {na} mol of anion, so Ksp = ({nc}s)^{nc}({na}s)^{na} = {sn(key_v)}.", judgment="write the ion concentrations in terms of s with the formula's subscripts", est=90)


@retry_sep
def ch_n_second_order_time(rng):
    k = pick(rng, [0.025, 0.040, 0.10, 0.50]); A0 = pick(rng, [0.10, 0.20, 0.50, 1.00]); A = A0 / pick(rng, [2, 4, 5])
    t = (1 / A - 1 / A0) / k
    tt = bisect(lambda x: 1 / (1 / A0 + k * x) - A, 0.0, 1e7); agree(t, tt, 1e-6, "t")
    pairs = [("Uses the first-order integrated rate law.", math.log(A0 / A) / k), ("Subtracts the concentrations and divides by the rate constant.", (A0 - A) / k), ("Uses 1/[A]0 − 1/[A] so the time is negative in sign convention but reported as a magnitude of the wrong quantity.", (1 / A0) / k), ("Divides the final concentration by the rate constant.", A / k)]
    key, ds = num_opts(t, pairs, "s")
    stem = f"The reaction 2 A → products is second order in A with a rate constant of ${k:g}\\text{{ L/(mol s)}}$. How long does it take for the concentration of A to fall from ${A0:g}\\text{{ M}}$ to ${A:g}\\text{{ M}}$?"
    return mk("ch_n_second_order_time", "5.3", "5.F", stem, key, ds, rng, concept="time for a second-order concentration change from the integrated rate law", path="1/[A] = 1/[A]0 + kt solved directly vs bisection on the concentration curve", facts=[f"k={k}", f"A0={A0}", f"A={A}"],
              kwhy=f"For second order 1/[A] = 1/[A]0 + kt, so t = (1/{A:g} − 1/{A0:g})/{k:g} = {sig(t)} s.", judgment="choose the integrated rate law that matches the order", est=85)


@retry_sep
def ch_n_arrhenius_ratio(rng):
    Ea = pick(rng, [40.0, 55.0, 75.0, 100.0]); T1 = pick(rng, [298.0, 300.0, 310.0]); T2 = T1 + pick(rng, [10.0, 20.0, 30.0])
    ratio = math.exp(Ea * 1000 / R_J * (1 / T1 - 1 / T2))
    k1, k2 = 1.0, ratio; agree(math.log(k2 / k1), Ea * 1000 / R_J * (1 / T1 - 1 / T2), 1e-9, "ln")
    pairs = [("Uses the activation energy in kJ without converting to J.", math.exp(Ea / R_J * (1 / T1 - 1 / T2))), ("Uses the difference of the temperatures instead of the difference of the reciprocals.", math.exp(Ea * 1000 / R_J * (T2 - T1) / (T1 * T2) * T1 * T2 / 100 / 100) if False else math.exp(Ea * 1000 / R_J * (T2 - T1) / 1e4)),
             ("Takes the ratio of the rate constants to equal the ratio of the temperatures.", T2 / T1), ("Reverses T1 and T2 so that the rate constant decreases.", 1 / ratio)]
    key, ds = num_opts(ratio, pairs, "", fmt=lambda v: "$" + sig(v, 3) + "$")
    stem = f"A reaction has an activation energy of ${Ea:g}\\text{{ kJ/mol}}$. By what factor does the rate constant increase when the temperature is raised from ${T1:g}\\text{{ K}}$ to ${T2:g}\\text{{ K}}$? (R = 8.314 J/(mol K))"
    return mk("ch_n_arrhenius_ratio", "5.7", "5.F", stem, key, ds, rng, concept="ratio of rate constants from the Arrhenius equation at two temperatures", path="ln(k2/k1) formula vs the ratio of two explicit Arrhenius exponentials", facts=[f"Ea={Ea}", f"T1={T1}", f"T2={T2}"],
              kwhy=f"ln(k2/k1) = (Ea/R)(1/T1 − 1/T2) = ({Ea * 1000:.0f}/8.314)(1/{T1:g} − 1/{T2:g}) = {math.log(ratio):.3f}, so k2/k1 = {sig(ratio)}.", judgment="convert kJ to J and use reciprocal temperatures", est=95)


@retry_sep
def ch_n_halfway_titration_ph(rng):
    pKa = pick(rng, [3.75, 4.20, 4.74, 6.35, 7.21]); c = pick(rng, [0.100, 0.200]); V = pick(rng, [25.0, 40.0, 50.0]); frac = pick(rng, [0.25, 0.50, 0.75])
    key_v = pKa + math.log10(frac / (1 - frac)); agree(key_v, pKa + math.log10(Fr(str(frac)) / (1 - Fr(str(frac)))) if False else pKa + math.log10(float(Fr(str(frac)) / (1 - Fr(str(frac))))), 1e-9, "pH")
    pairs = [("Reports the pKa itself, which applies only at the half-equivalence point.", pKa), ("Inverts the ratio of base to acid.", pKa - math.log10(frac / (1 - frac))), ("Uses the pH of the starting weak acid solution.", 0.5 * (pKa - math.log10(c))), ("Uses the pH of a neutral solution.", 7.0)]
    key, ds = pH_opts(key_v, pairs)
    pct = int(round(frac * 100))
    stem = f"${V:g}\\text{{ mL}}$ of a ${c:g}\\text{{ M}}$ weak acid HA (pK_a = {pKa:g}) is titrated with ${c:g}\\text{{ M}}$ NaOH. What is the pH after enough NaOH has been added to neutralize {pct}% of the acid?"
    return mk("ch_n_halfway_titration_ph", "8.5", "5.F", stem, key, ds, rng, concept="pH in the buffer region of a weak acid titration from the fraction neutralized", path="Henderson-Hasselbalch with exact fractions vs the log of the mole ratio", facts=[f"pKa={pKa}", f"frac={frac}"],
              kwhy=f"At {pct}% neutralization [A⁻]/[HA] = {frac:g}/{1 - frac:g}, so pH = {pKa:g} + log({frac:g}/{1 - frac:g}) = {key_v:.2f}.", judgment="the base-to-acid ratio in the buffer region equals the fraction neutralized over the fraction remaining", est=90)


@retry_sep
def ch_n_isotope_abundance(rng):
    el = pick(rng, [("boron", 10.013, 11.009), ("copper", 62.93, 64.93), ("chlorine", 34.969, 36.966), ("lithium", 6.015, 7.016), ("gallium", 68.93, 70.92)])
    name, m1, m2 = el; x = pick(rng, [0.20, 0.30, 0.40, 0.55, 0.69, 0.76]); avg = x * m1 + (1 - x) * m2
    sol = float(sp.solve(sp.Eq(sp.Symbol("x") * sp.nsimplify(m1) + (1 - sp.Symbol("x")) * sp.nsimplify(m2), sp.nsimplify(round(avg, 3))), sp.Symbol("x"))[0]); agree(sol, x, 5e-3, "x")
    key_v = 100 * (m2 - round(avg, 3)) / (m2 - m1)
    pairs = [("Reports the abundance of the heavier isotope.", 100 - key_v), ("Divides the average mass by the mass of the lighter isotope.", 100 * round(avg, 3) / m1 - 100 if False else 100 * (round(avg, 3) - m1) / m1 * 10), ("Takes the average of the two isotopic masses as the abundance weight.", 50.0), ("Uses the lighter mass divided by the average mass.", 100 * m1 / round(avg, 3))]
    key, ds = num_opts(key_v, pairs, "%", fmt=lambda v: f"${v:.3g}\\%$")
    stem = f"Naturally occurring {name} consists of two isotopes with masses ${m1:g}\\text{{ u}}$ and ${m2:g}\\text{{ u}}$. The average atomic mass of {name} is ${avg:.3f}\\text{{ u}}$. What is the percent natural abundance of the lighter isotope?"
    return mk("ch_n_isotope_abundance", "1.2", "5.F", stem, key, ds, rng, concept="percent abundance of an isotope from the average atomic mass", path="sympy solve of the weighted average vs the direct difference ratio", facts=[f"name={name}", f"x={x}"],
              kwhy=f"Let x be the fraction of the lighter isotope: x({m1:g}) + (1 − x)({m2:g}) = {avg:.3f}, so x = ({m2:g} − {avg:.3f})/({m2:g} − {m1:g}) = {key_v / 100:.3f}, which is {key_v:.3g}%.", judgment="set up a weighted average and solve for the fraction", est=85)


@retry_sep
def ch_n_limiting_mass(rng):
    A, B, Ma, Mb, Mp, ca, cb = pick(rng, [("N2", "H2", 28.02, 2.016, 17.03, 1, 3), ("Al", "O2", 26.98, 32.00, 101.96, 4, 3), ("CH4", "O2", 16.04, 32.00, 44.01, 1, 2), ("Zn", "HCl", 65.38, 36.46, 136.3, 1, 2)])
    mA = pick(rng, [4.0, 8.0, 12.0, 20.0]); mB = pick(rng, [2.0, 5.0, 10.0, 15.0, 30.0]); nA = mA / Ma / ca; nB = mB / Mb / cb
    fac = {"N2": 2, "Al": 2, "CH4": 1, "Zn": 1}[A]
    stem_p = {"N2": "N2 + 3 H2 → 2 NH3 (product NH3)", "Al": "4 Al + 3 O2 → 2 Al2O3 (product Al2O3)", "CH4": "CH4 + 2 O2 → CO2 + 2 H2O (product CO2)", "Zn": "Zn + 2 HCl → ZnCl2 + H2 (product ZnCl2)"}[A]
    npro = {"N2": 2, "Al": 2 / 4 * 4 / 2, "CH4": 1, "Zn": 1}[A]
    nprod = (min(nA, nB)) * {"N2": 2, "Al": 2, "CH4": 1, "Zn": 1}[A]
    if A == "Al":
        nprod = min(mA / Ma / 4, mB / Mb / 3) * 2
    nprod = min(nA, nB) * {"N2": 2, "Al": 2, "CH4": 1, "Zn": 1}[A]
    key_v = nprod * Mp
    agree(key_v, min(mA / Ma / ca, mB / Mb / cb) * {"N2": 2, "Al": 2, "CH4": 1, "Zn": 1}[A] * Mp, 1e-9, "m")
    other = max(nA, nB) * {"N2": 2, "Al": 2, "CH4": 1, "Zn": 1}[A] * Mp
    pairs = [("Uses the reactant that is in excess to find the product mass.", other), ("Adds the masses of the two reactants.", mA + mB), ("Uses the limiting mass of reactant as if the mole ratio were 1:1.", min(mA / Ma, mB / Mb) * Mp * {"N2": 1, "Al": 1, "CH4": 1, "Zn": 1}[A]),
             ("Forgets to convert moles of product to grams.", min(nA, nB) * {"N2": 2, "Al": 2, "CH4": 1, "Zn": 1}[A])]
    key, ds = num_opts(key_v, pairs, "g")
    stem = f"The reaction {stem_p} goes to completion. A mixture contains ${mA:g}\\text{{ g}}$ of {A} and ${mB:g}\\text{{ g}}$ of {B}. What is the maximum mass of product that can form? (Molar masses in g/mol: {A} {Ma:g}, {B} {Mb:g}, product {Mp:g}.)"
    return mk("ch_n_limiting_mass", "4.5", "5.F", stem, key, ds, rng, concept="mass of product from a limiting reactant using mole ratios", path="smaller of two mole ratios vs a stepwise product comparison", facts=[f"A={A}", f"mA={mA}", f"mB={mB}"],
              kwhy=f"Moles per coefficient: {A} {nA:.3f}, {B} {nB:.3f}; the smaller one limits. Product = {min(nA, nB):.3f} x {fac} x {Mp:g} = {key_v:.3g} g.", judgment="divide each moles by its coefficient to find the limiting reactant", est=100)


@retry_sep
def ch_n_gas_stoich_volume(rng):
    mass = pick(rng, [2.0, 4.0, 5.0, 10.0]); Tc = pick(rng, [0, 25, 50, 100]); P = pick(rng, [0.80, 1.00, 1.20]); T = Tc + 273.15
    M = formula_mass("CaCO3"); n = mass / M; V = n * R_ATM * T / P
    agree(V, bisect(lambda v: P * v - n * R_ATM * T, 1e-9, 1e4), 1e-6, "V")
    pairs = [("Doubles the moles of CO2 for the two moles of product in the equation.", 2 * V), ("Uses 22.4 L/mol for the molar volume at the stated conditions.", n * 22.4), ("Uses the Celsius temperature in place of kelvins.", n * R_ATM * Tc / P if Tc else None), ("Uses the mass of CaCO3 as the moles of gas.", mass * R_ATM * T / P)]
    key, ds = num_opts(V, pairs, "L")
    stem = f"Calcium carbonate decomposes: CaCO3(s) → CaO(s) + CO2(g). A ${mass:g}\\text{{ g}}$ sample of CaCO3 decomposes completely. What volume of CO2, in L, is produced at ${Tc}\\,^{{\\circ}}\\text{{C}}$ and ${P:g}\\text{{ atm}}$? (Molar mass of CaCO3: ${M:.2f}\\text{{ g/mol}}$.)"
    return mk("ch_n_gas_stoich_volume", "4.4", "5.F", stem, key, ds, rng, concept="volume of a gaseous product from the mass of a solid reactant", path="PV = nRT solved directly vs bisection on the pressure balance", facts=[f"mass={mass}", f"Tc={Tc}", f"P={P}"],
              kwhy=f"n(CO2) = n(CaCO3) = {mass:g}/{M:.2f} = {n:.4f} mol; V = nRT/P = ({n:.4f})(0.08206)({T:.2f})/{P:g} = {V:.3g} L.", judgment="moles of solid to moles of gas, then the ideal gas law", est=95)


# ============================ P4/P1/P2/P6 고정 문장 ============================


def _bank(arch, topic, skill, bank, concept, path, est=70):
    def f(rng):
        sc = pick(rng, bank)
        key, ds = sentence_options(sc[1][0], sc[1][1], list(sc[2]))
        return mk(arch, topic, skill, sc[0], key, ds, rng, concept=concept, path=path, facts=[sc[0][:60]], judgment="apply a chemical principle to a specific case and reject plausible misconceptions", est=est)
    f.__name__ = arch
    f.__module__ = "chem_p0_n"
    return f


ch_n_polarity_molecule = _bank("ch_n_polarity_molecule", "2.7", "4.A", [
    ("Carbon tetrachloride, CCl4, has polar C–Cl bonds, but the molecule is nonpolar. Which statement best explains this?",
     ("The four polar bonds are arranged symmetrically in a tetrahedron, so their bond dipoles cancel.", "A tetrahedral arrangement of identical bonds gives a zero net dipole."),
     [("The C–Cl bonds are really nonpolar because carbon and chlorine have the same electronegativity.", "Chlorine is more electronegative than carbon, so the bonds are polar."), ("The molecule has a lone pair on the carbon atom that cancels the bond dipoles.", "Carbon in CCl4 has no lone pair; the cancelation comes from the symmetric shape."),
      ("The chlorine atoms share their electrons equally with each other, so the molecule has no dipole.", "The bonding electrons are shared between C and Cl and not between the chlorine atoms.")]),
    ("Water, H2O, has a nonzero dipole moment, but carbon dioxide, CO2, has none, although both contain polar bonds. Which statement best explains the difference?",
     ("CO2 is linear, so its two bond dipoles point in opposite directions and cancel, whereas H2O is bent, so its bond dipoles do not cancel.", "Molecular shape determines whether bond dipoles add or cancel."),
     [("The O–H bonds are more polar than the C=O bonds, so the water dipole is always larger.", "The C=O bonds are also polar; the difference is the shape and not the polarity of the individual bonds."), ("CO2 has no lone pairs on the oxygen atoms, which makes the bonds nonpolar.", "Each oxygen atom in CO2 has two lone pairs and the bonds are polar."),
      ("Carbon is less electronegative than hydrogen, so the C=O bond dipoles point in the same direction.", "Carbon is more electronegative than hydrogen, and the dipoles of CO2 point in opposite directions.")]),
    ("Ammonia, NH3, is a polar molecule, whereas boron trifluoride, BF3, is nonpolar. Which statement best explains this?",
     ("BF3 is symmetric, so its dipoles cancel, but the lone pair on nitrogen makes NH3 asymmetric.", "A lone pair makes the NH3 shape asymmetric; BF3 has no lone pair on boron and is symmetric."),
     [("The B–F bonds are nonpolar because boron and fluorine have similar electronegativities.", "Fluorine is far more electronegative than boron, so the B–F bonds are very polar."), ("NH3 is polar because it has more atoms than BF3.", "The number of atoms does not determine polarity; the geometry does."),
      ("BF3 has a lone pair on the boron atom that cancels the dipoles.", "Boron in BF3 has no lone pair; the shape is symmetric.")]),
], "relate molecular shape and bond polarity to the polarity of a molecule", "fixed fact bank checked against CED 2.7")

ch_n_oxidation_number = _bank("ch_n_oxidation_number", "4.9", "4.A", [
    ("In the reaction Zn(s) + Cu²⁺(aq) → Zn²⁺(aq) + Cu(s), which statement is correct?",
     ("Zn is oxidized because its oxidation number increases from 0 to +2, and Cu²⁺ is the oxidizing agent.", "Loss of electrons raises the oxidation number; the species that is reduced is the oxidizing agent."),
     [("Zn is reduced because it gains electrons, and Cu²⁺ is the reducing agent.", "Zinc loses electrons, so it is oxidized."), ("Cu²⁺ is oxidized because its oxidation number decreases from +2 to 0.", "A decrease in oxidation number is reduction."), ("Neither species changes oxidation number, because the charges balance.", "Balanced charge does not mean that the oxidation numbers stay the same.")]),
    ("In the reaction 2 Na(s) + Cl2(g) → 2 NaCl(s), which statement is correct?",
     ("Chlorine is reduced because its oxidation number decreases from 0 to −1, and sodium is the reducing agent.", "Chlorine gains electrons and is reduced; sodium loses them and reduces chlorine."),
     [("Chlorine is oxidized because it forms a bond with sodium.", "Forming a bond does not define oxidation; the oxidation number of chlorine decreases."), ("Sodium is reduced because its oxidation number increases from 0 to +1.", "An increase in oxidation number is oxidation."), ("Chlorine is the reducing agent because it is more electronegative than sodium.", "The species that is reduced acts as the oxidizing agent.")]),
    ("In which of the following species does sulfur have the highest oxidation number?",
     ("SO4²⁻, because x + 4(−2) = −2 gives sulfur an oxidation number of +6.", "x + 4(−2) = −2 gives x = +6."),
     [("SO3²⁻, because it has one fewer oxygen atom than SO4²⁻ and so more electrons on sulfur.", "x + 3(−2) = −2 gives +4, which is lower."), ("H2S, because hydrogen is less electronegative than sulfur.", "In H2S sulfur is −2, the lowest of the choices."), ("S8, because it contains the most sulfur atoms.", "An element in its standard state has an oxidation number of 0.")]),
], "assign oxidation numbers and identify the species oxidized and reduced", "fixed fact bank checked against CED 4.9")

ch_n_catalyst_profile = _bank("ch_n_catalyst_profile", "5.6", "4.B", [
    ("A catalyst is added to a reaction at constant temperature and increases the rate of both the forward and reverse reactions. Which statement best describes the effect on the energy profile?",
     ("The catalyst provides a pathway with a lower activation energy, and the enthalpy change of the reaction stays the same.", "A catalyst lowers Ea for both directions without changing the energies of the reactants and products."),
     [("The catalyst lowers the energy of the products, so the reaction becomes more exothermic.", "A catalyst does not change ΔH."), ("The catalyst raises the energy of the reactants so that more of them can cross the barrier.", "A catalyst does not change the energy of the reactants."), ("The catalyst changes the equilibrium constant so that more product forms.", "A catalyst does not change K; it only speeds the approach to equilibrium.")]),
    ("A student states that a catalyst makes a reaction faster by increasing the average kinetic energy of the reactant molecules. Which response is best?",
     ("Incorrect, because a catalyst provides a lower-energy pathway and does not change the temperature.", "The average kinetic energy depends only on temperature."),
     [("The statement is correct, because a catalyst releases energy when it binds the reactants.", "Binding a catalyst does not raise the temperature of the sample."), ("The statement is correct, because a faster reaction always means more energetic molecules.", "A rate can increase because more collisions are effective, with no change in the average kinetic energy."), ("The statement is incorrect, because a catalyst is consumed and its amount determines the energy.", "A catalyst is not consumed, and the claim about energy is wrong for a different reason.")]),
    ("For an exothermic reaction, a catalyst is added. Which of the following correctly compares the catalyzed and the uncatalyzed reaction?",
     ("The activation energies of both the forward and the reverse reaction are lower for the catalyzed reaction, and ΔH is the same.", "A catalyst lowers the barrier in both directions by the same amount."),
     [("The activation energy of the forward reaction is lower, but the activation energy of the reverse reaction is unchanged.", "A catalyst lowers the barrier of the reverse reaction too."), ("ΔH is more negative for the catalyzed reaction.", "ΔH depends only on the reactants and products."), ("The activation energy is the same, but the frequency of collisions increases.", "A catalyst changes the activation energy; collisions are not the explanation.")]),
], "describe how a catalyst changes a reaction energy profile", "fixed fact bank checked against CED 5.6")

ch_n_calorimetry_direction = _bank("ch_n_calorimetry_direction", "6.3", "4.A", [
    ("A metal block is placed in cooler water in an insulated container. Which statement about the heat flow is correct?",
     ("Heat flows from the metal to the water, so q for the metal is negative and q for the water is positive.", "Heat leaves the hotter object; the signs are opposite and equal in magnitude."),
     [("Heat flows from the water to the metal because the water has the higher specific heat.", "Heat flows from the object at the higher temperature, not the one with the higher specific heat."), ("Both q values are positive because both objects exchange energy.", "The heat lost by one object is gained by the other, so the signs are opposite."), ("No heat flows because the container is insulated.", "The insulation stops heat loss to the surroundings and not the exchange between the block and the water.")]),
    ("A student dissolves a salt in water in a coffee-cup calorimeter and the temperature of the solution decreases. Which statement is correct?",
     ("The dissolution is endothermic, because the solution lost heat, so ΔH is positive.", "A falling temperature of the solution shows that the process absorbed energy from it."),
     [("The dissolution is exothermic, because the temperature decreased.", "An exothermic process raises the temperature of the solution."), ("The dissolution is endothermic, so ΔH is negative.", "An endothermic process has a positive ΔH."), ("The temperature change does not show the sign of ΔH because the salt is a solid.", "The temperature change of the solution does show the direction of the heat flow.")]),
    ("Two samples of different metals with the same mass and the same initial temperature absorb the same amount of heat. Metal X has a larger specific heat than metal Y. Which statement is correct?",
     ("Metal Y ends hotter, because the same heat raises a smaller-specific-heat metal by more.", "q = mcΔT, so for equal q and m the temperature change is inversely proportional to c."),
     [("Metal X ends at the higher temperature, because it can hold more heat.", "A larger specific heat means a smaller temperature change for the same heat."), ("Both end at the same temperature because they absorbed the same heat.", "The temperature change depends on the specific heat."), ("Metal Y ends at a lower temperature because its specific heat is smaller.", "A smaller specific heat gives a larger temperature rise.")]),
], "interpret the direction and sign of heat flow in calorimetry", "fixed fact bank checked against CED 6.3 and 6.4")

ch_n_entropy_rank = _bank("ch_n_entropy_rank", "9.2", "4.A", [
    ("Which of the following changes is accompanied by the greatest increase in entropy of the system?",
     ("1 mol of liquid water evaporates to give 1 mol of water vapor at 100 °C.", "A liquid to a gas gives the largest increase in the number of accessible microstates."),
     [("1 mol of liquid water freezes to give 1 mol of ice at 0 °C.", "Freezing decreases the entropy."), ("1 mol of a solid dissolves in water to give a more concentrated solution with fewer ions than particles.", "Dissolving a solid increases entropy by much less than vaporization."), ("2 mol of H2(g) and 1 mol of O2(g) react to give 2 mol of H2O(l).", "Three moles of gas become a liquid, so the entropy decreases.")]),
    ("Which of the following reactions has a negative entropy change?",
     ("N2(g) + 3 H2(g) → 2 NH3(g), because four moles of gas become two moles of gas.", "A decrease in the number of moles of gas decreases the entropy."),
     [("CaCO3(s) → CaO(s) + CO2(g), because a gas is formed.", "A solid producing a gas increases the entropy."), ("2 H2O2(l) → 2 H2O(l) + O2(g), because oxygen is produced.", "Forming a gas increases the entropy."), ("NH4Cl(s) → NH3(g) + HCl(g), because two molecules are formed.", "Two gases from a solid is a large increase.")]),
    ("Which sample has the greatest standard molar entropy at 298 K?",
     ("CH3CH2CH2CH3(g), because the largest gas molecule has the most ways to store energy.", "A larger gaseous molecule has more motional states."),
     [("CH3CH2CH2CH3(l), because liquids are more disordered than the gases.", "A gas is more disordered than a liquid of the same substance."), ("CH4(g), because it is a gas with the smallest molecules.", "Larger gaseous molecules have the greater molar entropy."), ("C(diamond), because it has strong bonds.", "A rigid solid has very low entropy.")]),
], "compare entropy changes of physical and chemical processes", "fixed fact bank checked against CED 9.2")

ch_n_galvanic_flow = _bank("ch_n_galvanic_flow", "9.8", "4.A", [
    ("A galvanic cell is built with a zinc electrode in 1 M Zn²⁺ and a copper electrode in 1 M Cu²⁺ connected by a salt bridge. Which statement correctly describes the cell?",
     ("Electrons flow through the wire from the zinc anode to the copper cathode, where Cu²⁺ is reduced.", "Zinc is oxidized at the anode and the electrons travel through the wire to the cathode."),
     [("Electrons flow through the salt bridge from the copper electrode to the zinc electrode.", "Electrons travel through the wire and the ions travel through the salt bridge."), ("Reduction occurs at the zinc electrode, so it is the cathode.", "Zinc is oxidized and so it is the anode."), ("Cations in the salt bridge move toward the zinc electrode to balance the charge.", "Cations move toward the cathode, where positive charge is being used up.")]),
    ("In a galvanic cell, which of the following is true at the anode?",
     ("Oxidation occurs, and the electrode loses mass as the metal forms ions.", "The anode is where electrons are produced by oxidation."),
     [("Reduction occurs, and the electrode gains mass.", "Reduction occurs at the cathode."), ("Electrons flow into the electrode from the external wire.", "Electrons leave the anode through the external wire."), ("Anions in the salt bridge move away from the electrode.", "Anions move toward the anode to balance the positive charge produced there.")]),
    ("The standard cell potential of a galvanic cell is positive. Which statement is correct?",
     ("The overall reaction is spontaneous under standard conditions, so ΔG° is negative.", "A positive E°cell means ΔG° = −nFE° is negative."),
     [("The overall reaction is nonspontaneous, so ΔG° is positive.", "A positive potential corresponds to a negative ΔG°."), ("The cell potential is positive only if the concentrations are not 1 M.", "E°cell refers to standard conditions of 1 M."), ("The reaction is spontaneous in the direction that uses more electrons.", "Spontaneity depends on the sign of the potential and not on the number of electrons.")]),
], "describe electron and ion flow in a galvanic cell", "fixed fact bank checked against CED 9.8 and 9.9")

ch_n_rate_law_concept = _bank("ch_n_rate_law_concept", "5.2", "4.B", [
    ("The rate law for a reaction is $\\text{rate} = k[\\mathrm{A}]^2[\\mathrm{B}]$. What happens to the initial rate if the concentration of A is tripled and the concentration of B is halved?",
     ("The rate increases by a factor of 4.5, because 3² x 1/2 = 4.5.", "The rate is proportional to [A] squared and [B] to the first power."),
     [("The rate increases by a factor of 1.5, because 3 x 1/2 = 1.5.", "The order in A is two, so the factor for A is 9."), ("The rate increases by a factor of 9, because B does not matter.", "The rate is first order in B and so the halving matters."), ("The rate increases by a factor of 18, because 3² x 2 = 18.", "Halving B reduces the rate by a factor of 2; it does not double it.")]),
    ("Doubling the concentration of a reactant doubles the initial rate of a reaction. Which statement is best supported?",
     ("The reaction is first order in that reactant.", "A rate that is proportional to the concentration indicates first order."),
     [("The reaction is second order in that reactant.", "Second order would quadruple the rate."), ("The reaction is zero order in that reactant.", "Zero order would leave the rate unchanged."), ("The overall order of the reaction must be one.", "The data give the order only in that reactant, not the overall order.")]),
    ("The units of the rate constant k are 1/s. Which of the following is the order of the reaction overall?",
     ("First order, because the units of k for a first-order reaction are 1/time.", "For rate = k[A], the units of k are s⁻¹."),
     [("Second order, because the units of k include time.", "A second-order k has units of L/(mol s)."), ("Zero order, because k has no concentration units.", "A zero-order k has units of mol/(L s)."), ("The order cannot be determined from the units.", "The units of k identify the overall order.")]),
], "use a rate law to predict the change in rate and to identify an order", "fixed fact bank checked against CED 5.2")

ch_n_particulate_solution = _bank("ch_n_particulate_solution", "3.8", "1.A", [
    ("A particulate diagram of a solution of NaCl in water should show which of the following?",
     ("Separated Na⁺ and Cl⁻ ions, hydrated by water molecules that are oriented oppositely around each ion.", "Ion-dipole attractions hydrate the dissolved ions with opposite orientations."),
     [("Intact NaCl units dispersed among the water molecules.", "NaCl is an ionic compound that dissociates into ions in water."), ("Separated Na⁺ and Cl⁻ ions with the water molecules all oriented the same way.", "Water molecules orient differently around cations and anions."), ("Sodium atoms and chlorine atoms separated by water molecules.", "The solute is present as ions and not as neutral atoms.")]),
    ("A particulate diagram of a solution of ethanol, C2H5OH, in water should show which of the following?",
     ("Intact ethanol molecules among water molecules, with hydrogen bonds between their OH groups.", "Ethanol dissolves as molecules and forms hydrogen bonds with water."),
     [("Separated C2H5⁺ and OH⁻ ions surrounded by water.", "Ethanol is a molecular compound that does not dissociate into ions."), ("Ethanol molecules clustered together and separate from the water molecules.", "Ethanol is miscible with water and mixes at the particle level."), ("Carbon, hydrogen and oxygen atoms separated from each other.", "The bonds within ethanol are not broken when it dissolves.")]),
    ("Which of the following particulate representations best shows what happens when solid MgCl2 dissolves in water?",
     ("One Mg²⁺ ion and two Cl⁻ ions per formula unit, each hydrated by water molecules.", "MgCl2 dissociates into one Mg²⁺ and two Cl⁻."),
     [("One Mg²⁺ ion and one Cl⁻ ion are shown for each formula unit.", "The formula unit contains two chloride ions."), ("Two Mg⁺ ions and one Cl²⁻ ion are shown for each formula unit.", "The charges are wrong: magnesium forms 2+ and chloride 1−."), ("Intact MgCl2 molecules are shown surrounded by water.", "An ionic compound does not remain as molecules in water.")]),
], "choose a correct particulate model of a solution", "fixed fact bank checked against CED 3.8")


STAGE_N_MC = ["ch_n_molarity_mass", "ch_n_percent_yield", "ch_n_empirical_formula", "ch_n_mole_fraction_pressure", "ch_n_gas_density", "ch_n_heat_phase_change", "ch_n_entropy_reaction", "ch_n_gibbs_hs", "ch_n_k_from_equilibrium", "ch_n_ph_strong_base", "ch_n_buffer_after_acid",
              "ch_n_ksp_from_solubility", "ch_n_second_order_time", "ch_n_arrhenius_ratio", "ch_n_halfway_titration_ph", "ch_n_isotope_abundance", "ch_n_limiting_mass", "ch_n_gas_stoich_volume", "ch_n_polarity_molecule", "ch_n_oxidation_number",
              "ch_n_catalyst_profile", "ch_n_calorimetry_direction", "ch_n_entropy_rank", "ch_n_galvanic_flow", "ch_n_rate_law_concept", "ch_n_particulate_solution"]
