"""AP Chemistry P0 원형 I — 스킬 2.C(질문에 맞는 절차)와 5.C(변수 사이의 관계). 스킬 범위 검사가 이 두 스킬 코드가 비어 있음을 잡아 추가했다."""
from chem_common import *  # noqa: F401,F403
from common import Opt

PROC = {
    "calorimetry": ("determine the molar enthalpy of dissolution of a salt", ["measure the mass of water into an insulated cup", "record the initial temperature of the water", "add a measured mass of the salt and stir", "record the highest or lowest temperature reached"]),
    "titration": ("determine the molar mass of an unknown solid monoprotic acid", ["dissolve a measured mass of the acid in water", "titrate the solution with standardized NaOH to the endpoint", "record the volume of NaOH delivered", "calculate the moles of NaOH from its molarity and volume"]),
    "rate": ("determine how the initial rate of a reaction depends on the concentration of one reactant", ["prepare mixtures in which only the concentration of that reactant changes", "keep the temperature constant", "measure the time to form a fixed amount of product", "compare the initial rates of the mixtures"]),
}
PROC_WHY = {
    "calorimetry": ["Omits the water mass, which is needed to calculate the heat gained by the water.", "Omits the initial temperature, so the temperature change cannot be found.", "Omits the mass of salt, so moles cannot be calculated.", "Omits the final temperature."],
    "titration": ["Omits the mass of the acid, so its molar mass cannot be calculated.", "Omits the titration to the endpoint, so the moles of acid are unknown.", "Omits the volume of base delivered.", "Omits the conversion of volume to moles."],
    "rate": ["Does not control which concentration changes, so the effect of one reactant cannot be isolated.", "Does not control the temperature, which also changes the rate.", "Does not measure the rate in any way.", "Does not compare the mixtures."],
}


# ======================= 2.C 질문에 맞는 절차 =======================
def _procedure(rng, name):
    goal, steps = PROC[name]
    full = "; ".join(steps) + "."
    full = full[0].upper() + full[1:]
    drops = rng.sample(range(len(steps)), 3)
    ds = [Opt(("; ".join(s_ for i, s_ in enumerate(steps) if i != d) + ".").capitalize(), False, PROC_WHY[name][d], None) for d in drops]
    key = Opt(full, True, "Every quantity the calculation needs is measured, and the variable of interest is isolated.", None)
    agree(len(steps), 4, 1e-9, "steps")
    stem = f"A student wants to {goal}. Which of the following procedures is best aligned with this goal?"
    return mk(f"ch_procedure_{name}", {"calorimetry": "6.4", "titration": "4.6", "rate": "5.2"}[name], "2.C", stem, key, ds, rng, concept="choose an experimental procedure that measures every quantity needed for the question",
              path="the complete step list covers all measured quantities of the working equation; each distractor drops exactly one required step", facts=[f"scenario={name}", f"drops={drops}"], judgment="check the procedure against what the calculation needs", est=80)


def ch_procedure_calorimetry(rng):
    return _procedure(rng, "calorimetry")


def ch_procedure_titration(rng):
    return _procedure(rng, "titration")


def ch_procedure_rate(rng):
    return _procedure(rng, "rate")


# ======================= 5.C 변수 사이의 관계 =======================
def _relation(rng, kind):
    if kind == "gas_T":
        t1c = pick(rng, [27, 47, 127, 227]); t2c = t1c * 2 if t1c != 27 else 54
        f = (t2c + 273.15) / (t1c + 273.15)
        stem = f"A sample of an ideal gas in a rigid container is heated from ${t1c}\\,^{{\\circ}}\\text{{C}}$ to ${t2c}\\,^{{\\circ}}\\text{{C}}$. By what factor does the pressure of the gas change?"
        pairs = [("Doubles the pressure because the Celsius temperature doubled.", t2c / t1c), ("Uses the reciprocal of the temperature ratio.", 1 / f), ("Adds the temperature change to the pressure.", 1 + (t2c - t1c) / 100), ("Squares the temperature ratio.", f * f)]
        agree(f, float(sp.Rational(str(t2c + 273.15)) / sp.Rational(str(t1c + 273.15))), 1e-9, "f")
        facts = [f"t1c={t1c}", f"t2c={t2c}", f"f={f:.6f}"]; topic = "3.4"; kw = f"The container is rigid and the amount of gas is fixed, so P is proportional to the kelvin temperature: P2/P1 = ({t2c} + 273.15)/({t1c} + 273.15) = {f:.3g}."
    elif kind == "gas_V":
        n = pick(rng, [2, 3, 4]); f = 1 / n
        stem = f"The volume of a sample of an ideal gas is increased by a factor of {n} at constant temperature while the number of moles stays the same. By what factor does the pressure change?"
        pairs = [("Multiplies the pressure by the volume factor.", float(n)), ("Subtracts 1 from the volume factor.", float(n - 1)), ("Uses the square of the volume factor.", float(n * n)), ("Uses the square root of the factor.", 1 / math.sqrt(n))]
        facts = [f"n={n}", f"f={f:.6f}"]; topic = "3.4"; kw = f"At constant temperature and amount of gas, P is inversely proportional to V (Boyle's law), so increasing V by a factor of {n} multiplies P by 1/{n} = {f:.3g}."
    else:
        a = pick(rng, [2, 3]); b = pick(rng, [2, 3])
        f = a / (b * b)
        stem = f"The magnitude of the charge on one of two ions is multiplied by ${a}$ and the other ion is left unchanged, and the distance between the ions is multiplied by ${b}$. By what factor does the magnitude of the Coulombic force between them change?"
        pairs = [("Multiplies the force by the distance factor instead of dividing by its square.", a * b), ("Divides by the distance factor instead of by its square.", a / b), ("Squares the charge factor.", a * a / (b * b)), ("Ignores the change in the charge.", 1 / (b * b))]
        facts = [f"a={a}", f"b={b}", f"f={f:.6f}"]; topic = "2.2"; kw = f"By Coulomb's law the force is proportional to q1q2/d², so multiplying one charge by {a} and the distance by {b} changes the force by {a}/({b})² = {f:.3g}."
    key, ds = num_opts(f, pairs, "", 3, fmt=lambda v: "$" + f"{v:.3g}" + "$")
    return mk("ch_variable_coulomb" if kind == "coulomb" else "ch_variable_gas", topic, "5.C", stem, key, ds, rng, concept="how a quantity scales when variables in an equation change (absolute temperature, inverse and inverse-square laws)",
              path="exact rational scaling vs numeric evaluation of the ratio of the two states", facts=facts, judgment="decide whether the relationship is direct, inverse, or inverse-square, and use absolute temperature", est=65, kwhy=kw)


def ch_variable_gas(rng):
    return _relation(rng, pick(rng, ["gas_T", "gas_V"]))


def ch_variable_coulomb(rng):
    return _relation(rng, "coulomb")
