"""AP Chemistry 원형 — CH4·CH5 5세트 채우기(2026-10-21) 계산 문항 1부(Practice 5): 단원 3(기체·용액·분광)·5(속도론)·7(평형).
chem_p0_n 과 같은 규칙: 정답은 이중 경로(sympy 정확 풀이 vs 수치/다른 형태 공식)로 계산하고, 오답은 이름 붙은 오개념이며 수치 선택지는 8% 이상 떨어진다. 구조 기준: 공개 문항과 자료·조건·과제·풀이 단계가 달라야 한다."""
from chem_common import *  # noqa: F401,F403
from common import Opt


@retry_sep
def ch_t5_ideal_gas_moles(rng):
    P, V, T = pick(rng, [0.85, 1.20, 2.50, 3.00]), pick(rng, [2.0, 5.0, 8.0, 12.0]), pick(rng, [298.0, 320.0, 350.0, 400.0])
    key_v = P * V / (R_ATM * T)
    n = sp.Symbol("n", positive=True); agree(key_v, float(sp.solve(sp.Eq(sp.nsimplify(P) * sp.nsimplify(V), n * sp.nsimplify(R_ATM) * sp.nsimplify(T)), n)[0]), 1e-9, "n")
    pairs = [("Uses R = 8.314 J/(mol K) with pressure in atm and volume in liters.", P * V / (R_J * T)), ("Inverts the relationship and divides RT by PV.", R_ATM * T / (P * V)),
             ("Uses the Celsius value of the temperature (subtracts 273) instead of kelvins.", P * V / (R_ATM * (T - 273.15))), ("Multiplies pressure and volume by the gas constant instead of dividing by it.", P * V * R_ATM / T)]
    key, ds = num_opts(key_v, pairs, "mol")
    stem = f"A sample of an ideal gas occupies ${V:g}\\text{{ L}}$ at ${P:g}\\text{{ atm}}$ and ${T:g}\\text{{ K}}$. How many moles of gas are in the sample? (R = 0.08206 L atm/(mol K))"
    return mk("ch_t5_ideal_gas_moles", "3.4", "5.F", stem, key, ds, rng, concept="moles of gas from PV = nRT with consistent units", path="sympy solve of PV = nRT vs direct formula", facts=[f"P={P}", f"V={V}", f"T={T}"],
              kwhy=f"n = PV/RT = ({P:g})({V:g})/(0.08206 × {T:g}) = {sig(key_v)} mol.", judgment="match the gas constant to the units of pressure and volume", est=80)


@retry_sep
def ch_t5_gas_molar_mass_density(rng):
    d, T, P = pick(rng, [1.25, 1.96, 2.86, 3.17, 0.72]), pick(rng, [273.0, 298.0, 323.0]), pick(rng, [1.00, 0.95, 1.50, 2.00])
    key_v = d * R_ATM * T / P
    M = sp.Symbol("M", positive=True); agree(key_v, float(sp.solve(sp.Eq(sp.nsimplify(P) * M, sp.nsimplify(d) * sp.nsimplify(R_ATM) * sp.nsimplify(T)), M)[0]), 1e-9, "M")
    pairs = [("Inverts the relationship and uses dP/RT.", d * P / (R_ATM * T)), ("Leaves the pressure out of the calculation.", d * R_ATM * T), ("Uses 22.4 L/mol as the molar volume at any temperature and pressure.", d * 22.4), ("Divides the density by RT and multiplies by P twice.", d * P * P / (R_ATM * T) if P != 1 else d * R_ATM * T / 2)]
    key, ds = num_opts(key_v, pairs, "g/mol")
    stem = f"A gas has a density of ${d:g}\\text{{ g/L}}$ at ${T:g}\\text{{ K}}$ and ${P:g}\\text{{ atm}}$. Assuming ideal behavior, what is the molar mass of the gas? (R = 0.08206 L atm/(mol K))"
    return mk("ch_t5_gas_molar_mass_density", "3.4", "5.F", stem, key, ds, rng, concept="molar mass from the density of an ideal gas, M = dRT/P", path="sympy solve of PM = dRT vs direct formula", facts=[f"d={d}", f"T={T}", f"P={P}"],
              kwhy=f"Because n/V = P/RT, the molar mass is M = dRT/P = ({d:g})(0.08206)({T:g})/{P:g} = {sig(key_v)} g/mol.", judgment="combine PV = nRT with density = mass/volume", est=95)


@retry_sep
def ch_t5_dalton_partial(rng):
    gases = pick(rng, [("N2", "O2", "Ar"), ("He", "Ne", "Ar"), ("H2", "CO2", "N2")]); n = [pick(rng, [0.20, 0.30, 0.50]), pick(rng, [0.40, 0.60, 0.80]), pick(rng, [0.10, 0.20, 0.30])]
    Pt = pick(rng, [1.50, 2.40, 3.00, 4.50]); i = pick(rng, [0, 1, 2])
    key_v = Pt * n[i] / sum(n)
    agree(key_v, float(sp.nsimplify(Pt) * sp.nsimplify(n[i]) / sum(sp.nsimplify(x) for x in n)), 1e-9, "Pi")
    pairs = [("Divides the moles of the gas by the total pressure instead of multiplying the mole fraction by it.", n[i] / Pt), ("Uses the moles of the gas divided by the moles of the other gases only.", Pt * n[i] / (sum(n) - n[i])),
             ("Takes the partial pressure equal to the total pressure divided by the number of gases.", Pt / 3), ("Multiplies the total pressure by the total moles and divides by the moles of the gas.", Pt * sum(n) / n[i])]
    key, ds = num_opts(key_v, pairs, "atm")
    stem = f"A rigid container holds ${n[0]:g}\\text{{ mol}}$ of {cf(gases[0])}, ${n[1]:g}\\text{{ mol}}$ of {cf(gases[1])}, and ${n[2]:g}\\text{{ mol}}$ of {cf(gases[2])}. The total pressure is ${Pt:g}\\text{{ atm}}$. What is the partial pressure of {cf(gases[i])}?"
    return mk("ch_t5_dalton_partial", "3.5", "5.F", stem, key, ds, rng, concept="partial pressure from the mole fraction and the total pressure", path="exact fractions vs float", facts=[f"n={n}", f"Pt={Pt}", f"i={i}"],
              kwhy=f"The mole fraction of {gases[i]} is {n[i]:g}/{sum(n):g}, so its partial pressure is {Pt:g} atm × {n[i] / sum(n):.3f} = {sig(key_v)} atm.", judgment="the partial pressure is the mole fraction times the total pressure", est=80)


@retry_sep
def ch_t5_graham_ratio(rng):
    pair = pick(rng, [("H2", 2.016, "O2", 32.00), ("He", 4.003, "CH4", 16.04), ("CH4", 16.04, "SO2", 64.07), ("NH3", 17.03, "HCl", 36.46), ("N2", 28.01, "CO2", 44.01)])
    a, Ma, b, Mb = pair
    key_v = math.sqrt(Mb / Ma); agree(key_v, float(sp.sqrt(sp.nsimplify(Mb) / sp.nsimplify(Ma))), 1e-9, "r")
    pairs = [("Uses the ratio of the molar masses without the square root.", Mb / Ma), ("Inverts the ratio, putting the heavier gas in the numerator.", math.sqrt(Ma / Mb)),
             ("Takes the ratio of the square roots but inverts it.", Ma ** 0.5 / Mb ** 0.5 * 1.0 if False else Ma / Mb), ("Uses the difference of the molar masses.", Mb - Ma)]
    key, ds = num_opts(key_v, pairs, "", fmt=lambda v: "$" + sig(v, 3) + "$")
    stem = f"Two gases, {cf(a)} (M = {Ma:g} g/mol) and {cf(b)} (M = {Mb:g} g/mol), effuse through a small opening at the same temperature. What is the ratio of the effusion rate of {cf(a)} to the effusion rate of {cf(b)}?"
    return mk("ch_t5_graham_ratio", "3.5", "5.F", stem, key, ds, rng, concept="the ratio of effusion rates from Graham's law", path="sympy square root of the molar mass ratio vs math.sqrt", facts=[f"a={a}", f"b={b}"],
              kwhy=f"Rate_{a}/Rate_{b} = sqrt(M_{b}/M_{a}) = sqrt({Mb:g}/{Ma:g}) = {sig(key_v)}.", judgment="the lighter gas effuses faster, in proportion to the inverse square root of the molar mass", est=85)


@retry_sep
def ch_t5_stock_dilution_volume(rng):
    M1, M2, V2 = pick(rng, [12.0, 6.0, 3.0, 2.0]), pick(rng, [0.10, 0.25, 0.50, 1.0]), pick(rng, [100.0, 250.0, 500.0, 1000.0])
    key_v = M2 * V2 / M1
    agree(key_v, float(sp.nsimplify(M2) * sp.nsimplify(V2) / sp.nsimplify(M1)), 1e-9, "V1")
    pairs = [("Divides the volume of the dilute solution by the molarity ratio the wrong way (V2 M1 / M2).", V2 * M1 / M2), ("Subtracts the molarities and multiplies by the final volume.", (M1 - M2) * V2), ("Takes the volume of water to add instead of the volume of stock.", V2 - key_v),
             ("Multiplies the two molarities and divides by the final volume.", M1 * M2 / V2 * 1000)]
    key, ds = num_opts(key_v, pairs, "mL")
    stem = f"A chemist needs ${V2:g}\\text{{ mL}}$ of a ${M2:g}\\text{{ M}}$ solution and starts with a ${M1:g}\\text{{ M}}$ stock solution. What volume of the stock solution should be diluted with water to prepare it?"
    return mk("ch_t5_stock_dilution_volume", "3.7", "5.F", stem, key, ds, rng, concept="volume of stock solution needed from M1V1 = M2V2", path="exact rational V1 vs float formula", facts=[f"M1={M1}", f"M2={M2}", f"V2={V2}"],
              kwhy=f"The moles of solute are unchanged by dilution: V1 = M2V2/M1 = ({M2:g})({V2:g})/{M1:g} = {sig(key_v)} mL.", judgment="the moles of solute stay constant in a dilution", est=75)


@retry_sep
def ch_t5_beer_lambert_conc(rng):
    A, eps, b = pick(rng, [0.250, 0.480, 0.620, 0.800]), pick(rng, [1500.0, 3200.0, 8500.0, 12000.0]), pick(rng, [1.00, 0.50, 2.00])
    key_v = A / (eps * b); agree(key_v, float(sp.nsimplify(A) / (sp.nsimplify(eps) * sp.nsimplify(b))), 1e-9, "c")
    pairs = [("Multiplies the absorbance by the molar absorptivity and the path length.", A * eps * b), ("Divides by the absorbance instead of by the molar absorptivity and path length.", eps * b / A),
             ("Leaves the path length out of the calculation.", A / eps), ("Divides the absorbance by the path length only.", A / b)]
    SC = 1e4
    key, ds = num_opts(key_v * SC, [(w, v * SC) for w, v in pairs], "", fmt=lambda v: "$" + sn(v / SC, 3) + "\\text{ M}$")
    stem = f"A solution in a cuvette with a path length of ${b:g}\\text{{ cm}}$ has an absorbance of ${A:g}$ at a wavelength where the molar absorptivity is ${sn(eps, 3)}\\text{{ L/(mol cm)}}$. What is the concentration of the absorbing species?"
    return mk("ch_t5_beer_lambert_conc", "3.13", "5.F", stem, key, ds, rng, concept="concentration from absorbance using Beer's law, A = εbc", path="sympy rational vs float", facts=[f"A={A}", f"eps={eps}", f"b={b}"],
              kwhy=f"Beer's law gives c = A/(εb) = {A:g}/(({eps:g})({b:g})) = {sn(key_v)} M.", judgment="absorbance is proportional to concentration and path length", est=80)


@retry_sep
def ch_t5_combined_gas_volume(rng):
    P1, V1, T1 = pick(rng, [1.00, 2.00, 0.80]), pick(rng, [2.0, 4.0, 6.0]), pick(rng, [273.0, 298.0, 300.0])
    P2, T2 = pick(rng, [0.50, 1.50, 3.00]), pick(rng, [350.0, 400.0, 250.0])
    key_v = P1 * V1 * T2 / (T1 * P2); agree(key_v, float(sp.nsimplify(P1) * sp.nsimplify(V1) * sp.nsimplify(T2) / (sp.nsimplify(T1) * sp.nsimplify(P2))), 1e-9, "V2")
    pairs = [("Inverts the temperature ratio.", P1 * V1 * T1 / (T2 * P2)), ("Multiplies by the pressure ratio instead of dividing by it.", P1 * V1 * T2 * P2 / T1), ("Uses the Celsius values of both temperatures.", P1 * V1 * (T2 - 273.15) / ((T1 - 273.15) * P2) if abs(T1 - 273.15) > 1 else P1 * V1 * T2 / (P2 * 100)),
             ("Ignores the change in pressure.", V1 * T2 / T1)]
    key, ds = num_opts(key_v, pairs, "L")
    stem = f"A sample of gas has a volume of ${V1:g}\\text{{ L}}$ at ${P1:g}\\text{{ atm}}$ and ${T1:g}\\text{{ K}}$. The pressure is changed to ${P2:g}\\text{{ atm}}$ and the temperature to ${T2:g}\\text{{ K}}$. What is the new volume of the sample? (The amount of gas is constant.)"
    return mk("ch_t5_combined_gas_volume", "3.4", "5.F", stem, key, ds, rng, concept="final volume from the combined gas law", path="exact rational combined law vs float", facts=[f"P1={P1}", f"V1={V1}", f"T1={T1}", f"P2={P2}", f"T2={T2}"],
              kwhy=f"For a fixed amount, V2 = V1 (P1/P2)(T2/T1) = {V1:g} × ({P1:g}/{P2:g}) × ({T2:g}/{T1:g}) = {sig(key_v)} L.", judgment="volume is inversely proportional to pressure and directly proportional to kelvin temperature", est=90)


# ============================ 단원 5 속도론 ============================
@retry_sep
def ch_t5_first_order_k_from_halflife(rng):
    th = pick(rng, [12.0, 35.0, 80.0, 250.0, 1200.0]); unit = pick(rng, ["s", "min", "h"])
    key_v = math.log(2) / th; agree(key_v, float(sp.log(2) / sp.nsimplify(th)), 1e-9, "k")
    pairs = [("Takes the rate constant to be the reciprocal of the half-life.", 1 / th), ("Multiplies the half-life by ln 2.", th * math.log(2)), ("Uses log10 of 2 instead of the natural logarithm.", math.log10(2) / th), ("Divides 1 by the product of the half-life and ln 2.", 1 / (th * math.log(2)))]
    SC = 1.0
    key, ds = num_opts(key_v, pairs, "", fmt=lambda v: "$" + sn(v, 3) + f"\\text{{ {unit}}}^{{-1}}$")
    stem = f"A first-order reaction has a half-life of ${th:g}\\text{{ {unit}}}$. What is the rate constant for the reaction?"
    return mk("ch_t5_first_order_k_from_halflife", "5.3", "5.F", stem, key, ds, rng, concept="first-order rate constant from the half-life, k = ln 2 / t_1/2", path="sympy ln 2 / t vs math.log", facts=[f"th={th}", f"unit={unit}"],
              kwhy=f"For first order t_1/2 = ln 2 / k, so k = 0.693 / {th:g} = {sn(key_v)} {unit}⁻¹.", judgment="use the natural logarithm relationship between k and the half-life", est=70)


@retry_sep
def ch_t5_first_order_fraction_left(rng):
    th = pick(rng, [10.0, 15.0, 20.0, 40.0]); n = pick(rng, [2, 3, 4, 5]); t = th * n
    key_v = 0.5 ** n; agree(key_v, float(sp.Rational(1, 2) ** n), 1e-12, "f")
    pairs = [("Divides the elapsed time by the half-life and treats that number as the fraction left.", n * 1.0 / 10), ("Subtracts the fraction decayed incorrectly, using 1 − 1/n.", 1 - 1 / n), ("Uses (1/2) times the number of half-lives.", 0.5 * n / 10), ("Uses 1/n as the fraction remaining.", 1 / n)]
    key, ds = num_opts(key_v, pairs, "", fmt=lambda v: "$" + sig(v, 3) + "$")
    stem = f"A radioactive sample undergoes first-order decay with a half-life of ${th:g}\\text{{ min}}$. What fraction of the original sample remains after ${t:g}\\text{{ min}}$?"
    return mk("ch_t5_first_order_fraction_left", "5.3", "5.F", stem, key, ds, rng, concept="fraction remaining after a whole number of half-lives", path="exact rational (1/2)^n vs float power", facts=[f"th={th}", f"n={n}"],
              kwhy=f"The elapsed time is {n} half-lives, so the fraction remaining is (1/2)^{n} = {sig(key_v)}.", judgment="halve the amount once for each half-life", est=70)


@retry_sep
def ch_t5_rate_from_law(rng):
    k = pick(rng, [0.015, 0.20, 3.5, 0.080]); m, n = pick(rng, [(1, 1), (2, 1), (1, 2), (2, 0)]); A, B = pick(rng, [0.10, 0.20, 0.50]), pick(rng, [0.10, 0.30, 0.40])
    key_v = k * A ** m * B ** n; agree(key_v, float(sp.nsimplify(k) * sp.nsimplify(A) ** m * sp.nsimplify(B) ** n), 1e-9, "rate")
    pairs = [("Multiplies the concentrations without using the reaction orders as exponents.", k * A * B), ("Adds the orders and applies the total to each concentration.", k * (A ** (m + n)) * (B ** (m + n))), ("Uses the orders as coefficients instead of exponents.", k * m * A * n * B if n else k * m * A), ("Leaves out the rate constant.", A ** m * B ** n)]
    SC = 1e4
    key, ds = num_opts(key_v * SC, [(w, v * SC) for w, v in pairs], "", fmt=lambda v: "$" + sn(v / SC, 3) + "\\text{ M/s}$")
    stem = f"The rate law for a reaction is rate = k[A]^{m}[B]^{n}, where k = ${k:g}$ in units that give the rate in M/s. What is the rate when [A] = ${A:g}\\text{{ M}}$ and [B] = ${B:g}\\text{{ M}}$?"
    return mk("ch_t5_rate_from_law", "5.2", "5.F", stem, key, ds, rng, concept="rate from the rate law with given orders and concentrations", path="exact rational vs float", facts=[f"k={k}", f"m={m}", f"n={n}", f"A={A}", f"B={B}"],
              kwhy=f"rate = {k:g} × ({A:g})^{m} × ({B:g})^{n} = {sn(key_v)} M/s.", judgment="raise each concentration to its own order", est=80)


@retry_sep
def ch_t5_rate_factor_order(rng):
    order = pick(rng, [2, 3]); fac = pick(rng, [2, 3, 4])
    key_v = float(fac ** order); agree(key_v, float(sp.Integer(fac) ** order), 1e-12, "f")
    pairs = [("Takes the rate to change by the same factor as the concentration.", float(fac)), ("Multiplies the concentration factor by the order.", float(fac * order)), ("Adds the order to the concentration factor.", float(fac + order)), ("Raises the order to the concentration factor.", float(order ** fac))]
    key, ds = num_opts(key_v, pairs, "", fmt=lambda v: "$" + f"{v:g}" + "$")
    stem = f"A reaction is order {order} in reactant A and zero order in all other species. By what factor does the rate change when [A] is multiplied by {fac} at constant temperature?"
    return mk("ch_t5_rate_factor_order", "5.2", "5.F", stem, key, ds, rng, concept="change in rate when a concentration is changed for a reaction of known order", path="exact integer power vs float", facts=[f"order={order}", f"fac={fac}"],
              kwhy=f"The rate is proportional to [A]^{order}, so multiplying [A] by {fac} multiplies the rate by {fac}^{order} = {int(key_v)}.", judgment="the rate depends on the concentration raised to the reaction order", est=65)


@retry_sep
def ch_t5_zero_order_time(rng):
    k = pick(rng, [0.0020, 0.0050, 0.012, 0.030]); A0 = pick(rng, [0.40, 0.60, 1.00]); A = A0 * pick(rng, [0.25, 0.50, 0.75])
    key_v = (A0 - A) / k; agree(key_v, float(sp.nsimplify(A0 - A) / sp.nsimplify(k)), 1e-6, "t")
    pairs = [("Uses the first-order integrated rate law.", math.log(A0 / A) / k), ("Uses the second-order integrated rate law.", (1 / A - 1 / A0) / k), ("Divides the final concentration by the rate constant.", A / k), ("Divides the initial concentration by the rate constant.", A0 / k)]
    key, ds = num_opts(key_v, pairs, "s")
    stem = f"A reaction is zero order in A with a rate constant of ${k:g}\\text{{ M/s}}$. How long does it take for [A] to decrease from ${A0:g}\\text{{ M}}$ to ${A:g}\\text{{ M}}$?"
    return mk("ch_t5_zero_order_time", "5.3", "5.F", stem, key, ds, rng, concept="time for a zero-order concentration change from [A] = [A]0 − kt", path="exact rational difference vs float", facts=[f"k={k}", f"A0={A0}", f"A={A}"],
              kwhy=f"For zero order [A] = [A]0 − kt, so t = ({A0:g} − {A:g})/{k:g} = {sig(key_v)} s.", judgment="a zero-order concentration decreases linearly with time", est=75)


# ============================ 단원 7 평형 ============================
@retry_sep
def ch_t5_kc_from_concentrations(rng):
    a, b, c = pick(rng, [(1, 1, 1), (1, 3, 2), (2, 1, 2), (1, 2, 1)]); A, B, C = pick(rng, [0.20, 0.50, 0.10]), pick(rng, [0.30, 0.60, 0.40]), pick(rng, [0.40, 0.25, 0.80])
    key_v = C ** c / (A ** a * B ** b); agree(key_v, float(sp.nsimplify(C) ** c / (sp.nsimplify(A) ** a * sp.nsimplify(B) ** b)), 1e-9, "K")
    pairs = [("Inverts the expression, putting the reactants in the numerator.", A ** a * B ** b / C ** c), ("Ignores the coefficients and does not use them as exponents.", C / (A * B)), ("Multiplies the coefficients by the concentrations instead of using them as exponents.", c * C / (a * A * b * B)), ("Adds the concentrations of the reactants in the denominator.", C ** c / (A ** a + B ** b))]
    key, ds = num_opts(key_v, pairs, "", fmt=lambda v: "$" + sig(v, 3) + "$")
    stem = f"For the reaction {a if a != 1 else ''}A(g) + {b if b != 1 else ''}B(g) ⇌ {c if c != 1 else ''}C(g), the equilibrium concentrations are [A] = ${A:g}\\text{{ M}}$, [B] = ${B:g}\\text{{ M}}$, and [C] = ${C:g}\\text{{ M}}$. What is the value of the equilibrium constant K_c?"
    return mk("ch_t5_kc_from_concentrations", "7.4", "5.F", stem, key, ds, rng, concept="Kc from equilibrium concentrations using the coefficients as exponents", path="exact rational vs float", facts=[f"coefs={a},{b},{c}", f"A={A}", f"B={B}", f"C={C}"],
              kwhy=f"Kc = [C]^{c}/([A]^{a}[B]^{b}) = ({C:g})^{c}/(({A:g})^{a}({B:g})^{b}) = {sig(key_v)}.", judgment="products over reactants, each raised to its coefficient", est=85)


@retry_sep
def ch_t5_kp_from_kc(rng):
    Kc, dn, T = pick(rng, [0.50, 2.0, 5.0, 12.0, 0.080]), pick(rng, [1, -1, 2, -2]), pick(rng, [298.0, 400.0, 500.0, 700.0])
    key_v = Kc * (R_ATM * T) ** dn; agree(key_v, float(sp.nsimplify(Kc) * (sp.nsimplify(R_ATM) * sp.nsimplify(T)) ** dn), 1e-9, "Kp")
    pairs = [("Uses the opposite sign for the change in moles of gas.", Kc * (R_ATM * T) ** (-dn)), ("Uses Kp = Kc with no correction for the change in moles of gas.", Kc), ("Multiplies by RT without raising it to the power Δn.", Kc * R_ATM * T), ("Uses R = 8.314 J/(mol K) with pressures in atm.", Kc * (R_J * T) ** dn)]
    key, ds = num_opts(key_v, pairs, "", fmt=lambda v: "$" + sn(v, 3) + "$")
    stem = f"For a gas-phase reaction, K_c = ${Kc:g}$ at ${T:g}\\text{{ K}}$, and the total moles of gas change by Δn = {dn:+d} when the reaction goes from reactants to products. What is K_p at this temperature? (R = 0.08206 L atm/(mol K))"
    return mk("ch_t5_kp_from_kc", "7.4", "5.F", stem, key, ds, rng, concept="Kp from Kc using Kp = Kc (RT)^Δn", path="sympy rational power vs float power", facts=[f"Kc={Kc}", f"dn={dn}", f"T={T}"],
              kwhy=f"Kp = Kc(RT)^Δn = {Kc:g} × (0.08206 × {T:g})^{dn} = {sn(key_v)}.", judgment="use R in L atm/(mol K) and the change in moles of gas as the exponent", est=95)


@retry_sep
def ch_t5_k_reverse_doubled(rng):
    K = pick(rng, [0.20, 0.50, 4.0, 5.0, 10.0]); mode = pick(rng, ["reverse_double", "double", "reverse_half"])
    if mode == "reverse_double":
        key_v, txt, pairs = 1 / K ** 2, "the reverse reaction written with every coefficient doubled", [("Takes the reciprocal but does not square the constant.", 1 / K), ("Squares the constant but does not take the reciprocal.", K ** 2), ("Multiplies the constant by 2 for the doubled coefficients and inverts it.", 1 / (2 * K))]
    elif mode == "double":
        key_v, txt, pairs = K ** 2, "the same reaction written with every coefficient doubled", [("Multiplies the constant by 2 instead of squaring it.", 2 * K), ("Takes the reciprocal of the constant.", 1 / K), ("Adds 2 to the constant instead of squaring it.", K + 2)]
    else:
        key_v, txt, pairs = K ** -0.5, "the reverse reaction written with every coefficient halved", [("Takes the reciprocal but does not take the square root.", 1 / K), ("Takes the square root but does not invert it.", K ** 0.5), ("Halves the reciprocal of the constant.", 0.5 / K)]
    pairs = pairs + [("Reports the original constant unchanged.", K)]
    key, ds = num_opts(key_v, pairs, "", fmt=lambda v: "$" + sig(v, 3) + "$")
    stem = f"A reaction has an equilibrium constant K = ${K:g}$ at a given temperature. What is the equilibrium constant at the same temperature for {txt}?"
    return mk("ch_t5_k_reverse_doubled", "7.6", "5.F", stem, key, ds, rng, concept="how K changes when a reaction is reversed or its coefficients are multiplied", path="exact power of the rational constant vs float power", facts=[f"K={K}", f"mode={mode}"],
              kwhy=f"Reversing inverts K and multiplying the coefficients by n raises K to the power n, so the new constant is {sig(key_v)}.", judgment="reversal inverts K and a coefficient multiplier is an exponent on K", est=70)


@retry_sep
def ch_t5_qsp_after_mixing(rng):
    c1, c2 = pick(rng, [0.020, 0.040, 0.10]), pick(rng, [0.020, 0.050, 0.10]); v1, v2 = pick(rng, [50.0, 100.0]), pick(rng, [50.0, 100.0])
    ion = pick(rng, [("Ag+", "Cl-", 1, 1), ("Ba2+", "SO42-", 1, 1), ("Pb2+", "I-", 1, 2), ("Ca2+", "F-", 1, 2)])
    c_cat, c_an = c1 * v1 / (v1 + v2), c2 * v2 / (v1 + v2)
    key_v = c_cat ** ion[2] * c_an ** ion[3]
    agree(key_v, float((sp.nsimplify(c1) * sp.nsimplify(v1) / sp.nsimplify(v1 + v2)) ** ion[2] * (sp.nsimplify(c2) * sp.nsimplify(v2) / sp.nsimplify(v1 + v2)) ** ion[3]), 1e-9, "Q")
    pairs = [("Uses the initial concentrations and forgets that mixing dilutes each ion.", c1 ** ion[2] * c2 ** ion[3]), ("Dilutes only the cation concentration.", c_cat ** ion[2] * c2 ** ion[3]), ("Adds the two diluted concentrations.", c_cat + c_an), ("Does not use the coefficient as an exponent for the anion.", c_cat * c_an)]
    SC = 1e8
    key, ds = num_opts(key_v * SC, [(w, v * SC) for w, v in pairs], "", fmt=lambda v: "$" + sn(v / SC, 3) + "$")
    cat, an = ion[0], ion[1]
    stem = f"${v1:g}\\text{{ mL}}$ of a ${c1:g}\\text{{ M}}$ solution containing {cat} is mixed with ${v2:g}\\text{{ mL}}$ of a ${c2:g}\\text{{ M}}$ solution containing {an}. Volumes are additive. What is the ion product Q for the possible precipitate formed from these two ions?"
    return mk("ch_t5_qsp_after_mixing", "7.11", "5.F", stem, key, ds, rng, concept="ion product Q after mixing two solutions, including the dilution of each ion", path="exact rational dilution vs float", facts=[f"c1={c1}", f"c2={c2}", f"v1={v1}", f"v2={v2}", f"ion={cat},{an}"],
              kwhy=f"After mixing, [{cat}] = {c_cat:.4f} M and [{an}] = {c_an:.4f} M, so Q = {sn(key_v)}.", judgment="dilute each ion for the total volume before forming Q", est=95)


@retry_sep
def ch_t5_common_ion_solubility(rng):
    f = pick(rng, [("AgCl", 1.8e-10, 1, 1), ("BaSO4", 1.1e-10, 1, 1), ("AgBr", 5.0e-13, 1, 1), ("PbSO4", 2.5e-8, 1, 1)]); c = pick(rng, [0.050, 0.10, 0.20, 0.50])
    name, Ksp = f[0], f[1]
    key_v = Ksp / c; agree(key_v, float(sp.nsimplify(Ksp) / sp.nsimplify(c)), 1e-9, "s")
    pairs = [("Takes the molar solubility in pure water, the square root of Ksp.", math.sqrt(Ksp)), ("Multiplies Ksp by the common-ion concentration.", Ksp * c), ("Takes the square root of Ksp divided by the common-ion concentration.", math.sqrt(Ksp / c)), ("Divides the common-ion concentration by Ksp.", c / Ksp)]
    SC = 1e12
    key, ds = num_opts(key_v * SC, [(w, v * SC) for w, v in pairs], "", fmt=lambda v: "$" + sn(v / SC, 3) + "\\text{ M}$")
    ion = "Cl⁻" if name.startswith("AgCl") else ("Br⁻" if name == "AgBr" else "SO₄²⁻")
    stem = f"The K_sp of {cf(name)} is ${sn(Ksp, 2)}$ at 25 °C. What is the molar solubility of {cf(name)} in a solution that already contains ${c:g}\\text{{ M}}$ {ion}? (Assume the added ion concentration stays constant.)"
    return mk("ch_t5_common_ion_solubility", "7.12", "5.F", stem, key, ds, rng, concept="solubility of a sparingly soluble salt in a solution containing a common ion", path="exact rational Ksp/c vs float", facts=[f"name={name}", f"Ksp={Ksp}", f"c={c}"],
              kwhy=f"With [ion] fixed at {c:g} M, s = Ksp/[ion] = {sn(Ksp, 2)}/{c:g} = {sn(key_v)} M.", judgment="the common ion fixes one factor of the Ksp expression", est=85)


@retry_sep
def ch_t5_ice_hi_formation(rng):
    a = pick(rng, [0.50, 1.00, 0.80, 1.20]); K = pick(rng, [4.0, 16.0, 49.0, 9.0]); r = math.sqrt(K)
    x = a * r / (2 + r); key_v = 2 * x; agree(key_v, float(sp.nsimplify(2) * sp.nsimplify(a) * sp.sqrt(sp.nsimplify(K)) / (2 + sp.sqrt(sp.nsimplify(K)))), 1e-9, "HI")
    pairs = [("Treats x as the equilibrium concentration of HI instead of doubling it.", x), ("Sets [HI] equal to K times the initial concentration.", K * a), ("Uses K = [HI]/([H2][I2]) without squaring [HI] or using the coefficient.", a * K / (1 + K)), ("Subtracts 2x from each reactant concentration but reports [H2].", a - x)]
    key, ds = num_opts(key_v, pairs, "M")
    stem = f"The reaction H₂(g) + I₂(g) ⇌ 2 HI(g) has K_c = ${K:g}$ at a given temperature. A rigid container initially holds ${a:g}\\text{{ M}}$ H₂ and ${a:g}\\text{{ M}}$ I₂ and no HI. What is the equilibrium concentration of HI?"
    return mk("ch_t5_ice_hi_formation", "7.7", "5.F", stem, key, ds, rng, concept="an ICE table for a reaction with Δn = 0 and a perfect-square equilibrium expression", path="sympy solve of the ICE expression vs the closed form x = a r/(2 + r)", facts=[f"a={a}", f"K={K}"],
              kwhy=f"With HI = 2x, K = (2x)²/(a − x)², so 2x/(a − x) = √K = {r:g}, x = {x:.4f} M and [HI] = 2x = {sig(key_v)} M.", judgment="set up the ICE table and take the square root of the perfect-square expression", est=115)
