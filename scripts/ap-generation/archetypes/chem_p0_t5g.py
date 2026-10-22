"""AP Chemistry 공유 세트(문항 2개) — CH4·CH5 5세트 채우기(2026-10-21) 신규 4개: 단원 6 열량계(금속 비열)·헤스 법칙 표, 단원 7 평형 표·용해도곱 표. 정답은 이중 경로(정확 분수/수치)로 계산한다."""
import json
from chem_common import *  # noqa: F401,F403
from chem_p0_f import _set
from chem_p0_p import _table


def _two(rng, arch, topic, intro, stim, specs):
    qs = []
    for nm, (stm, key, ds, kwhy, concept) in zip(("q1", "q2"), specs):
        qs.append(mk(f"{arch}_{nm}", topic, "5.F", stm, key, ds, rng, concept=concept, cond=[("the needed values are in the table or the introduction", "intro")], path="exact rational vs float", material={"type": "table", "must_include": ["the table values"]}, kwhy=kwhy, facts=[f"{arch}_{nm}", json.dumps(stim["data"]["rows"], ensure_ascii=False)], est=100))
    return _set(arch, intro, stim, qs, topic, "5.F")


@retry_sep
def chs_t5_metal_specific_heat_set(rng):
    mm, Tm = pick(rng, [50.0, 75.0, 100.0]), pick(rng, [95.0, 98.0, 100.0]); mw, Tw = pick(rng, [100.0, 150.0, 200.0]), pick(rng, [21.0, 22.0, 24.0]); c_true = pick(rng, [0.385, 0.449, 0.900, 0.240, 0.129])
    Tf = round((mm * c_true * Tm + mw * 4.18 * Tw) / (mm * c_true + mw * 4.18), 1)
    q_w = mw * 4.18 * (Tf - Tw); c_m = q_w / (mm * (Tm - Tf)); agree(c_m, float(sp.nsimplify(mw) * sp.nsimplify(4.18) * (sp.nsimplify(Tf) - sp.nsimplify(Tw)) / (sp.nsimplify(mm) * (sp.nsimplify(Tm) - sp.nsimplify(Tf)))), 1e-9, "c")
    if not 0.05 < c_m < 1.5 or Tf - Tw < 1.0:
        raise ValueError("ambiguous")
    stim = _table("A hot metal sample is placed in water in an insulated calorimeter", ["Quantity", "Value"], [["Mass of metal (g)", f"{mm:g}"], ["Initial temperature of metal (°C)", f"{Tm:g}"], ["Mass of water (g)", f"{mw:g}"], ["Initial temperature of water (°C)", f"{Tw:g}"], ["Final temperature of metal and water (°C)", f"{Tf:g}"]])
    k1, d1 = num_opts(q_w, [("Uses the final temperature of the mixture instead of the temperature change of the water.", mw * 4.18 * Tf), ("Uses the mass of the metal in place of the mass of the water.", mm * 4.18 * (Tf - Tw)), ("Uses the temperature change of the metal instead of the temperature change of the water.", mw * 4.18 * (Tm - Tf)), ("Forgets the mass of the water.", 4.18 * (Tf - Tw))], "J")
    k2, d2 = num_opts(c_m, [("Divides by the temperature change of the water instead of the temperature change of the metal.", q_w / (mm * (Tf - Tw))), ("Divides by the mass of the water instead of the mass of the metal.", q_w / (mw * (Tm - Tf))), ("Uses the final temperature instead of the temperature change of the metal.", q_w / (mm * Tf)), ("Reports the specific heat of water.", 4.18)], "J/(g °C)", n=3)
    specs = [("What is the heat gained by the water, in J? (The specific heat of water is 4.18 J/(g °C).)", k1, d1, f"q = mcΔT = ({mw:g} g)(4.18 J/(g °C))({Tf - Tw:.1f} °C) = {sig(q_w)} J.", "heat gained by water in a calorimeter"),
             ("What is the specific heat of the metal, in J/(g °C)? (Assume that no heat is lost to the surroundings.)", k2, d2, f"The metal lost the same heat that the water gained, so c = {sig(q_w)} J/(({mm:g} g)({Tm - Tf:.1f} °C)) = {sig(c_m)} J/(g °C).", "specific heat of a metal from a calorimeter experiment")]
    return _two(rng, "chs_t5_metal_specific_heat_set", "6.4", "A student heats a metal sample, places it in water in an insulated calorimeter, and records the data shown. Assume that the metal and the water reach the same final temperature and that no heat is lost to the surroundings.", stim, specs)


@retry_sep
def chs_t5_hess_table_set(rng):
    a, b = pick(rng, [92.0, 114.0, 285.0, 393.0, 242.0]), pick(rng, [45.0, 76.0, 112.0, 180.0]); n = pick(rng, [0.50, 2.0, 3.0, 0.25])
    d_target = -a - b; q = n * d_target; agree(d_target, -(float(sp.nsimplify(a)) + float(sp.nsimplify(b))), 1e-12, "dH")
    stim = _table("Standard enthalpy changes of two reactions", ["Reaction", "ΔH° (kJ/mol)"], [["A(g) → B(g)", f"{-a:g}"], ["C(g) → B(g)", f"{b:+g}"]])
    k1, d1 = signed_opts(d_target, [("Adds the two values without reversing the second reaction.", -a + b), ("Reverses both reactions before adding them.", a - b), ("Reverses only the first reaction and adds the second reaction as written.", a + b), ("Reports only the ΔH° of the first reaction.", -a)], "kJ")
    k2, d2 = signed_opts(q, [("Does not reverse the second reaction, and then scales by the number of moles.", n * (-a + b)), ("Ignores the amount of A that reacts and reports ΔH° of the target reaction.", d_target), ("Divides the enthalpy change by the number of moles instead of multiplying.", d_target / n), ("Changes the sign of the final enthalpy change.", -q)], "kJ")
    specs = [("What is ΔH° for the reaction A(g) → C(g), in kJ/mol?", k1, d1, f"Reverse the second reaction (ΔH = {-b:+g}) and add it to the first: {-a:g} + ({-b:+g}) = {d_target:g} kJ/mol.", "ΔH of a target reaction from two given reactions using Hess's law"),
             (f"What is the enthalpy change when {n:g} mol of A(g) is converted to C(g)?", k2, d2, f"ΔH = ({n:g} mol)({d_target:g} kJ/mol) = {sig(q)} kJ.", "enthalpy change scaled to the amount of reactant")]
    return _two(rng, "chs_t5_hess_table_set", "6.9", "The standard enthalpy changes of two reactions of gaseous species are shown in the table. All of the species are gases at the same temperature and pressure.", stim, specs)


@retry_sep
def chs_t5_equilibrium_table_set(rng):
    A0, B0, x = pick(rng, [(1.00, 1.00), (0.80, 1.20), (1.50, 1.00)]), None, pick(rng, [0.20, 0.30, 0.40])
    A0, B0 = A0
    if x >= min(A0, B0):
        raise ValueError("ambiguous")
    Aeq, Beq, Ceq = A0 - x, B0 - x, 2 * x; K = Ceq ** 2 / (Aeq * Beq); agree(K, float(sp.Rational(str(Ceq)) ** 2 / (sp.Rational(str(Aeq)) * sp.Rational(str(Beq)))), 1e-9, "K")
    stim = _table("Concentrations for A(g) + B(g) ⇌ 2 C(g) at one temperature", ["Species", "Initial (M)", "At equilibrium (M)"], [["A", f"{A0:g}", f"{Aeq:g}"], ["B", f"{B0:g}", "not measured"], ["C", "0", "not measured"]])
    k1, d1 = num_opts(Ceq, [("Takes the change in A as the equilibrium concentration of C, ignoring the coefficient 2.", x), ("Takes the equilibrium concentration of C equal to the initial concentration of B.", B0), ("Uses the equilibrium concentration of A as the concentration of C.", Aeq), ("Divides the change in A by 2.", x / 2)], "M")
    k2, d2 = num_opts(K, [("Does not square [C] in the numerator.", Ceq / (Aeq * Beq)), ("Uses the initial concentrations of A and B in the denominator.", Ceq ** 2 / (A0 * B0)), ("Inverts the expression, with the reactants in the numerator.", (Aeq * Beq) / Ceq ** 2), ("Uses x as the concentration of C.", x ** 2 / (Aeq * Beq))], "", ) if False else num_opts(K, [("Does not square [C] in the numerator.", Ceq / (Aeq * Beq)), ("Uses the initial concentrations of A and B in the denominator.", Ceq ** 2 / (A0 * B0)), ("Inverts the expression, with the reactants in the numerator.", (Aeq * Beq) / Ceq ** 2), ("Uses x as the concentration of C.", x ** 2 / (Aeq * Beq))], "", fmt=lambda v: "$" + sig(v, 3) + "$")
    specs = [("What is the equilibrium concentration of C, in M?", k1, d1, f"A decreased by {x:g} M, so 2 × {x:g} = {Ceq:g} M of C formed.", "equilibrium concentration of a product from the change in a reactant and the coefficients"),
             ("What is the value of K_c for the reaction at this temperature?", k2, d2, f"[A] = {Aeq:g} M, [B] = {Beq:g} M and [C] = {Ceq:g} M, so Kc = ({Ceq:g})²/(({Aeq:g})({Beq:g})) = {sig(K)}.", "Kc from an initial and equilibrium table")]
    return _two(rng, "chs_t5_equilibrium_table_set", "7.4", "A gas-phase reaction is studied in a rigid container. Initially only A and B are present. The concentration of A at equilibrium is measured, and the table shows the results.", stim, specs)


@retry_sep
def chs_t5_ksp_table_set(rng):
    salt = pick(rng, [("AgCl", 1.8e-10, "Ag⁺", "Cl⁻"), ("BaSO₄", 1.1e-10, "Ba²⁺", "SO₄²⁻"), ("PbSO₄", 2.5e-8, "Pb²⁺", "SO₄²⁻"), ("AgBr", 5.0e-13, "Ag⁺", "Br⁻")]); name, Ksp, cat, an = salt
    c1, c2 = pick(rng, [1.0e-3, 2.0e-4, 5.0e-5, 3.0e-3]), pick(rng, [1.0e-3, 4.0e-4, 2.0e-5, 8.0e-3])
    Q = c1 * c2; ratio = Q / Ksp
    if not (0.05 < ratio < 1e7) or 0.7 < ratio < 1.4:
        raise ValueError("ambiguous")
    stim = _table("Ion concentrations in a mixture just after two solutions are combined", ["Ion", "Concentration (M)"], [[cat, sn(c1, 2)], [an, sn(c2, 2)]])
    SCq = 1e10
    k1, d1 = num_opts(Q * SCq, [("Adds the two concentrations instead of multiplying them.", (c1 + c2) * SCq), ("Divides one concentration by the other.", c1 / c2 * SCq), ("Takes the square of the first concentration.", c1 * c1 * SCq), ("Takes the square root of the product of the concentrations.", math.sqrt(Q) * SCq)], "", fmt=lambda v: "$" + sn(v / SCq, 3) + "$")
    k2, d2 = num_opts(ratio, [("Inverts the ratio and divides Ksp by Q.", Ksp / Q), ("Divides the first ion concentration alone by Ksp.", c1 / Ksp), ("Takes the square root of the ratio.", math.sqrt(ratio)), ("Divides the sum of the two concentrations by Ksp.", (c1 + c2) / Ksp)], "", fmt=lambda v: "$" + sig(v, 3) + "$")
    verdict = "greater than" if ratio > 1 else "less than"
    specs = [(f"What is the ion product, Q, for {name} in this mixture?", k1, d1, f"Q = [{cat}][{an}] = ({sn(c1, 2)})({sn(c2, 2)}) = {sn(Q)}.", "ion product Q from the ion concentrations"),
             (f"The K_sp of {name} is ${sn(Ksp, 2)}$. By what factor is Q greater or less than K_sp (that is, what is Q/K_sp)?", k2, d2, f"Q/Ksp = {sn(Q)}/{sn(Ksp, 2)} = {sig(ratio)}, so Q is {verdict} Ksp.", "comparison of Q with Ksp to judge precipitation")]
    return _two(rng, "chs_t5_ksp_table_set", "7.11", f"Two solutions are mixed, and the concentrations of the ions that could form a precipitate of {name} are shown in the table. Assume that no solid has formed yet.", stim, specs)
