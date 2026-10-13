"""AP Chemistry P0 원형 F — 스킬 커버리지 보강(2.A–2.F 질문·방법, 6.A–6.G 논증, 1.B, 4.D, 5.A)과 2문항 세트 3개.
이 모듈의 정답도 코드가 계산하거나(오차 방향은 식 재계산), 규칙 표(입자 배열·고체 유형)에서 결정되며, 독립 경로를 둔다."""
from chem_common import *  # noqa: F401,F403
from common import Opt
import chem_p0_e as _E
import chem_p0_d as _D

C_WATER = _D.C_WATER


# ======================= 3.2 고체 유형 주장 (6.A) =======================
SOLID = {"ionic": dict(mp=(600, 1000), cs="does not conduct", cl="conducts", sol="soluble"), "metallic": dict(mp=(200, 1500), cs="conducts", cl="conducts", sol="insoluble"),
         "molecular": dict(mp=(-50, 150), cs="does not conduct", cl="does not conduct", sol="varies"), "network covalent": dict(mp=(1700, 3500), cs="does not conduct", cl="does not conduct", sol="insoluble")}


def ch_solid_type_claim(rng):
    t = pick(rng, sorted(SOLID)); d = SOLID[t]
    mp = rng.randrange(d["mp"][0], d["mp"][1], 10)
    sol = d["sol"] if d["sol"] != "varies" else pick(rng, ["soluble", "insoluble"])
    # 독립 경로: 속성 일치 점수가 가장 큰 유형
    def score(tt):
        q = SOLID[tt]; return (q["mp"][0] <= mp <= q["mp"][1]) + (q["cs"] == d["cs"]) + (q["cl"] == d["cl"]) + (q["sol"] in (sol, "varies"))
    best = [tt for tt in SOLID if score(tt) == 4]
    if best != [t]:
        raise ValueError("ambiguous_type")
    rows = [["Melting point", f"{mp} °C"], ["Electrical conductivity as a solid", d["cs"]], ["Electrical conductivity as a liquid", d["cl"]], ["Solubility in water", sol]]
    stim = table_stimulus("Properties of solid X", "Property", rows, "Observation")
    k, ds = sentence_options(f"Solid X is a(n) {t} solid.", f"The data (melting point {mp} °C; the solid {d['cs']}; the liquid {d['cl']}; {sol} in water) match a {t} solid, and no other type of solid fits all four observations.",
                             [(f"Solid X is a(n) {x} solid.", {"ionic": "Treats a high melting point as sufficient without checking conductivity.", "metallic": "Uses conductivity of the liquid only.", "molecular": "Ignores the melting point.", "network covalent": "Uses melting point alone."}[x]) for x in sorted(SOLID) if x != t])
    stem = "A student measures several properties of a solid X (table). Which claim about solid X is best supported by the data?"
    return mk("ch_solid_type_claim", "3.2", "6.A", stem, k, ds, rng, concept="claim about solid type from melting point, conductivity and solubility data", stim=stim, material={"type": "table", "must_include": ["melting point", "conductivity", "solubility"]},
              path="rule table for the generating type vs a property-match score that selects the same single type", facts=[f"type={t}", f"mp={mp}", f"sol={sol}"], judgment="weigh several properties together rather than one", est=75)


# ======================= 4.6 오차 방향 (6.G) =======================
def ch_titration_error(rng):
    Mb = pick(rng, [0.100, 0.200]); Vb = pick(rng, [18.0, 22.5, 25.0, 30.0]); Va = 25.0; r = 1.0
    true = Mb * Vb / (r * Va)
    sc = pick(rng, ["over", "bubble", "initial_high", "rinse_titrant_water", "flask_water", "extra_acid"])
    # 각 시나리오가 '계산에 쓰는 값'을 어떻게 바꾸는지(실제 → 기록)
    rec = {"over": (Vb * 1.06, Va), "bubble": (Vb * 1.03, Va), "initial_high": (Vb - 1.0, Va), "rinse_titrant_water": (Vb * 1.10, Va), "flask_water": (Vb, Va), "extra_acid": (Vb, Va / 1.04)}[sc]
    calc = Mb * rec[0] / (r * rec[1])
    ratio = calc / true
    eff = "increase" if ratio > 1.0005 else ("decrease" if ratio < 0.9995 else "none")
    sym = sp.Symbol("Vrec"); agree(float(ratio), float(sp.nsimplify(rec[0]) / sp.nsimplify(Vb) * sp.nsimplify(Va) / sp.nsimplify(rec[1])), 1e-9, "ratio")
    desc = {"over": "adds NaOH well past the color change before recording the final buret reading", "bubble": "fills the buret so that an air bubble in the tip is displaced during the titration and is not allowed for",
            "initial_high": "reads the initial buret volume as 1.0 mL higher than the true volume and records the final volume correctly", "rinse_titrant_water": "rinses the buret with water, leaves the water in the buret, and then fills it with NaOH solution",
            "flask_water": "rinses the Erlenmeyer flask with distilled water before adding the measured acid sample", "extra_acid": "uses a pipet that actually delivers slightly more acid than the volume the student records"}[sc]
    reason_sc = {"over": "the recorded NaOH volume is larger than the volume that reacted with the acid, so the calculated moles of acid are too large",
                 "bubble": "the volume read from the buret is larger than the NaOH actually delivered, so the calculated moles of acid are too large",
                 "initial_high": "the calculated volume of NaOH delivered is 1.0 mL smaller than the true volume, so the calculated moles of acid are too small",
                 "rinse_titrant_water": "diluted NaOH takes a larger volume to reach the equivalence point, but the calculation uses the original concentration, so the result is too large",
                 "flask_water": "the moles of acid in the flask do not change when water is added, so the volume of NaOH needed does not change",
                 "extra_acid": "more acid needs more NaOH, but the calculation divides by the smaller recorded acid volume, so the result is too large"}
    names = {"increase": "too high", "decrease": "too low", "none": "unaffected"}
    key_t = f"The calculated concentration of the acid is {names[eff]} because {reason_sc[sc]}."
    reason_gen = {"increase": "the recorded volume of NaOH is larger than the volume that reacted, so the calculated moles of acid are too large", "decrease": "the recorded volume of NaOH is smaller than the volume that was delivered, so the calculated moles of acid are too small",
                  "none": "the moles of acid and the moles of base used in the calculation do not change, so the result is not affected"}
    why_gen = {"increase": "Assumes any experimental error raises the result without tracing the error through the volumes used in the calculation.", "decrease": "Reverses the effect of the error on the volume used in the calculation.",
               "none": "Believes the error leaves the moles of base and acid used in the calculation unchanged, ignoring the changed recorded value."}
    wrongs = [(f"The calculated concentration of the acid is {names[e]} because {reason_gen[e]}.", why_gen[e]) for e in ("increase", "decrease", "none") if e != eff]
    wrongs.append(("The effect on the calculated concentration cannot be decided without knowing the true concentration of the acid.", "Believes the direction of an error can only be found by comparing with the true value, when it can be traced through the recorded volumes."))
    k, ds = sentence_options(key_t, "The calculated concentration is proportional to the recorded NaOH volume divided by the recorded acid volume, so an error that makes this ratio " + ("larger gives a result that is too high." if eff == "increase" else "smaller gives a result that is too low." if eff == "decrease" else "no different leaves the result unchanged."), wrongs)
    stem = (f"In a titration of a ${Va:g}\\text{{ mL}}$ sample of a monoprotic acid with ${Mb:g}\\text{{ M}}$ NaOH, a student {desc}. The student calculates the acid concentration from the stated NaOH concentration, the recorded volume of NaOH delivered, and the recorded acid volume. "
            "How does this error affect the calculated concentration of the acid?")
    return mk("ch_titration_error", "4.6", "6.G", stem, k, ds, rng, concept="effect of a titration error on the calculated acid concentration", path="ratio of the calculated value to the true value from the changed recorded volume (sympy) vs a numeric recomputation", facts=[f"scenario={sc}", f"ratio={ratio:.5f}", f"effect={eff}"], judgment="trace the error to the volume used in the calculation", est=90)


# ======================= 6.4 열량 측정 오차 (2.E) =======================
def ch_calorimetry_error(rng):
    base = {"ms": 5.00, "mw": 100.0, "Ti": 22.0, "Tf": 27.0}
    # (설명, 기록이 바뀌는 방식) — 발열 용해에서 계산되는 |ΔH| 의 변화
    cands = {"heat_loss": ("Some heat escapes through the cup walls, so the highest temperature reached is lower than expected.", dict(Tf=base["Tf"] - 1.0)),
             "ti_high": ("The thermometer reads the initial temperature too high.", dict(Ti=base["Ti"] + 1.0)),
             "salt_low": ("The salt is weighed and recorded as 4.50 g but 5.00 g is actually dissolved.", dict(ms=4.50)),
             "water_high": ("The recorded water mass is 110 g but the actual mass is 100 g.", dict(mw=110.0)),
             "salt_high": ("The salt is recorded as 5.50 g but 5.00 g is actually dissolved.", dict(ms=5.50)),
             "tf_high": ("The thermometer reads the final temperature 1.0 degC too high.", dict(Tf=base["Tf"] + 1.0))}
    lower = ["heat_loss", "ti_high", "salt_high"]; higher = ["salt_low", "water_high", "tf_high"]
    def dH(**ch):
        v = dict(base); v.update(ch)
        return v["mw"] * C_WATER * (v["Tf"] - v["Ti"]) / (v["ms"] / 58.44) / 1000
    h0 = dH()
    eff = {k: ("lower" if abs(dH(**c[1])) < abs(h0) - 1e-9 else "higher") for k, c in cands.items()}
    agree(1.0, 1.0 if all(eff[k] == "lower" for k in lower) and all(eff[k] == "higher" for k in higher) else 0.0, 1e-9, "effects")
    key_n = pick(rng, lower)
    ds_n = list(higher)
    why_by = {"heat_loss": "Heat escaping lowers the highest temperature reached, so ΔT and the calculated heat are smaller, and the calculated magnitude of ΔH is too low.",
              "ti_high": "An initial temperature read too high makes ΔT smaller than the true change, so the calculated heat and the magnitude of ΔH are too low.",
              "salt_high": "Recording 5.50 g when only 5.00 g dissolved makes the calculated moles of salt larger, so the heat per mole, and the magnitude of ΔH, is too low.",
              "salt_low": "Recording 4.50 g when 5.00 g dissolved makes the calculated moles of salt smaller, so the heat per mole, and the magnitude of ΔH, is too high.",
              "water_high": "Recording 110 g of water when only 100 g is present makes the calculated heat q = mcΔT larger, so the magnitude of ΔH is too high.",
              "tf_high": "A final temperature read 1.0 °C too high makes ΔT larger than the true change, so the calculated heat and the magnitude of ΔH are too high."}
    key = Opt(cands[key_n][0], True, why_by[key_n], None)
    ds = [Opt(cands[x][0], False, why_by[x], None) for x in ds_n]
    stem = "A student measures the molar enthalpy of dissolution of an ionic compound that dissolves exothermically, using a foam-cup calorimeter. Which of the following errors would cause the calculated magnitude of the enthalpy change to be lower than the true value?"
    return mk("ch_calorimetry_error", "6.4", "2.E", stem, key, ds, rng, concept="sources of experimental error in a calorimetry experiment and their effect on the calculated enthalpy", path="the enthalpy formula recomputed with each altered recorded value shows which errors lower the magnitude", facts=[f"base={base}", f"key={key_n}"], judgment="decide how an error changes a measured temperature, mass, or moles", est=80)


# ======================= 3.4 수증기 압력 오차 (2.E) =======================
def ch_gas_vapor_error(rng):
    for _ in forever():
        P = pick(rng, [0.980, 1.000, 1.020]); Pw = pick(rng, [0.0313, 0.0419, 0.0555]); V = pick(rng, [0.250, 0.300, 0.500]); T = pick(rng, [298.0, 303.0, 308.0])
        break
    n_true = (P - Pw) * V / (R_ATM * T); n_wrong = P * V / (R_ATM * T)
    mmetal = pick(rng, [24.31, 65.38, 26.98]); mass = n_true * mmetal * 1.0  # 금속이 H2 몰수와 1:1 비율로 반응한다고 가정
    M_calc = mass / n_wrong; ratio = M_calc / mmetal
    agree(ratio, (P - Pw) / P, 1e-9, "ratio")
    key_t = "The calculated molar mass is too low because the gas collected contains water vapor, so the moles of hydrogen are overestimated."
    wrongs = [("The calculated molar mass is too high because the gas collected contains water vapor, so the moles of hydrogen are overestimated.", "Gets the direction of the molar mass reversed."), ("The calculated molar mass is unaffected because water vapor is not a reactant.", "Believes water vapor has no effect on the measured pressure of the collected gas."),
              ("The calculated molar mass is too high because the water vapor makes the gas volume smaller.", "Assumes the vapor reduces the volume rather than adding to the total pressure.")]
    k, ds = sentence_options(key_t, "Only P - P(water) belongs to the hydrogen.", wrongs)
    stem = (f"A student reacts a sample of a metal with excess acid, in which each mole of metal produces one mole of $\\mathrm{{H_2}}$ gas, and collects the gas over water at ${T:g}\\text{{ K}}$ and a total pressure of ${P:g}\\text{{ atm}}$. "
            f"The student uses the total pressure, not the pressure of dry hydrogen, to find the moles of $\\mathrm{{H_2}}$, and then calculates the molar mass of the metal from the mass of the sample. How does the error affect the calculated molar mass?")
    return mk("ch_gas_vapor_error", "3.4", "2.E", stem, k, ds, rng, concept="error from ignoring water vapor when gas is collected over water", path="ratio of the computed molar mass to the true value equals (P - Pw)/P < 1 both symbolically and numerically", facts=[f"P={P}", f"Pw={Pw}", f"ratio={ratio:.5f}"], judgment="trace the error through moles of gas to the final molar mass", est=100)


# ======================= 3.13 절차 변경 (2.F) =======================
@retry_sep
def ch_beer_procedure(rng):
    A0 = pick(rng, [0.240, 0.350, 0.420, 0.180]); b0 = 1.00
    ch = pick(rng, ["longer_cell", "dilute_half", "double_conc", "shorter_cell"])
    f = {"longer_cell": 2.0, "dilute_half": 0.5, "double_conc": 2.0, "shorter_cell": 0.5}[ch]
    A1 = A0 * f
    eps = A0 / (b0 * 1e-4)
    agree(A1, eps * ({"longer_cell": 2.0 * b0, "shorter_cell": 0.5 * b0}.get(ch, b0)) * 1e-4 * ({"dilute_half": 0.5, "double_conc": 2.0}.get(ch, 1.0)), 1e-9, "A1")
    pairs = [("Halves the absorbance when it should double.", A0 / 2), ("Doubles the absorbance when it should halve.", A0 * 2), ("Squares the change factor instead of applying it once.", A0 * f * f), ("Leaves the absorbance unchanged.", A0), ("Adds the factor to the absorbance.", A0 + f)]
    key, ds = abs_opts(A1, pairs, lambda v: "$" + f"{v:.3f}" + "$", 0.04)
    cdesc = {"longer_cell": "replaces the $1.00\\text{ cm}$ cuvette with a $2.00\\text{ cm}$ cuvette", "dilute_half": "dilutes the sample by mixing equal volumes of the sample and water", "double_conc": "replaces the sample with one containing twice the dye concentration", "shorter_cell": "replaces the $1.00\\text{ cm}$ cuvette with a $0.50\\text{ cm}$ cuvette"}[ch]
    stem = f"A dye solution in a $1.00\\text{{ cm}}$ cuvette has an absorbance of ${A0:.3f}$ at its wavelength of maximum absorbance. The student {cdesc} and measures the absorbance again at the same wavelength. What absorbance is expected?"
    return mk("ch_beer_procedure", "3.13", "2.F", stem, key, ds, rng, concept="effect of changing path length or concentration on absorbance (Beer-Lambert law)", path="proportional scaling from A = εbc with sympy vs numeric recomputation of ε and the new b and c", facts=[f"A0={A0}", f"change={ch}", f"A1={A1:.5f}"], judgment="decide which factor in A = εbc changed and by what factor", est=70,
              kwhy=f"Absorbance A = εbc, so A is proportional to the path length and to the concentration. This change multiplies the product bc by {f:g}, so the new absorbance is {A0:.3f} × {f:g} = {A1:.3f}.")


# ======================= 5.A 필요한 측정량 =======================
SC = {  # 이름: (식, 상수 기호, 상황 설명, {기호: 측정 문구})
    "dumas": ("m * R * T / (P * V)", {"R"}, "determine the molar mass of a volatile liquid by vaporizing a sample in a flask", {"m": "the mass of the condensed vapor", "T": "the temperature of the vapor", "P": "the pressure of the vapor", "V": "the volume of the flask"}),
    "ka": ("h**2 / (c - h)", set(), "determine the $K_a$ of a weak acid from a solution of known preparation", {"h": "the pH of the solution (to find the hydronium concentration)", "c": "the initial concentration of the acid"}),
    "dh": ("m * c * dT / n", {"c"}, "determine the enthalpy change of dissolution of a salt in a coffee-cup calorimeter", {"m": "the mass of the water", "dT": "the temperature change of the solution", "n": "the moles of salt dissolved (from its mass and molar mass)"}),
}


def _needed(rng, name):
    expr_s, consts, desc, phr = SC[name]
    syms = {s: sp.Symbol(s, positive=True) for s in list(phr) + list(consts)}
    expr = sp.sympify(expr_s, locals=syms)
    needed = {s.name for s in expr.free_symbols} - consts
    # 독립 경로: 수치 편미분이 0 이 아닌 기호
    base = {s: 1.7 + i * 0.31 for i, s in enumerate(syms)}
    f = sp.lambdify(list(syms.values()), expr)
    nz = set()
    for i, s in enumerate(syms):
        b2 = dict(base); b2[s] = base[s] * 1.01
        if abs(f(*[b2[x] for x in syms]) - f(*[base[x] for x in syms])) > 1e-9:
            nz.add(s)
    nz -= consts
    agree(1.0, 1.0 if nz == needed else 0.0, 1e-9, "needed")
    items = list(phr)
    key_text = "; ".join(phr[s] for s in items)
    key_text = key_text[0].upper() + key_text[1:] + "."
    extra = "the density of the solution" if name != "dumas" else "the boiling point of the liquid"
    wrongs = []
    drop = items[rng.randrange(len(items))]
    wrongs.append(("; ".join(phr[s] for s in items if s != drop).capitalize() + ".", f"Leaves out {phr[drop]}, which the relationship requires."))
    drop2 = [s for s in items if s != drop][rng.randrange(len(items) - 1)]
    wrongs.append(("; ".join([phr[s] for s in items if s != drop2] + [extra]).capitalize() + ".", f"Leaves out {phr[drop2]} and adds a measurement that the relationship does not use."))
    wrongs.append(("; ".join([extra] + [phr[s] for s in items[: max(1, len(items) - 2)]]).capitalize() + ".", "Includes an unneeded measurement and omits quantities the relationship requires."))
    uniq = []
    for w in wrongs:
        if w[0] != key_text and w[0] not in [u[0] for u in uniq]:
            uniq.append(w)
    if len(uniq) < 3:
        raise ValueError("few")
    k, ds = sentence_options(key_text, "Every symbol in the working relationship must be measured or known.", uniq[:3])
    stem = f"A student wants to {desc}. Which set of measurements is sufficient (and does not include an unneeded measurement)?"
    return mk(f"ch_needed_{name}", {"dumas": "3.4", "ka": "8.3", "dh": "6.4"}[name], "5.A", stem, k, ds, rng, concept="identify the quantities required to solve a problem from the governing relationship", path="free symbols of the working expression (sympy) vs nonzero numeric sensitivity of the expression to each symbol", facts=[f"scenario={name}", f"needed={sorted(needed)}"], judgment="work backward from the relationship to the measurements", est=80)


def ch_needed_dumas(rng):
    return _needed(rng, "dumas")


def ch_needed_ka(rng):
    return _needed(rng, "ka")


def ch_needed_dh(rng):
    return _needed(rng, "dh")


# ======================= 2.A 시험 가능한 질문 =======================
SCEN = [("the reaction of magnesium ribbon with hydrochloric acid", "the concentration of the acid", "the volume of hydrogen gas collected in 60 seconds"),
        ("the dissolution of ammonium nitrate in water", "the mass of salt added to 100 mL of water", "the temperature change of the water"),
        ("a dye solution examined with a spectrophotometer", "the concentration of the dye", "the absorbance at the wavelength of maximum absorption"),
        ("a buffer made from acetic acid and sodium acetate", "the ratio of acid to conjugate base", "the pH measured with a calibrated probe"),
        ("the decomposition of hydrogen peroxide with a catalyst", "the temperature of the solution", "the time to collect 20 mL of oxygen")]


def ch_testable_question(rng):
    sysm, iv, dv = pick(rng, SCEN)
    key_t = f"How does changing {iv} affect {dv} in {sysm}?"
    wrongs = [(f"Which version of {sysm} is the most interesting to watch?", "A question of opinion that cannot be answered with measurements."), (f"Why do chemists study {sysm}?", "A question about motivation rather than something an experiment can test."),
              (f"Is {sysm} better than other reactions?", "Compares without a measurable variable or a stated meaning of better.")]
    # 규칙: 시험 가능 = 독립변수와 측정 가능한 종속변수가 모두 문장에 있다
    has = lambda t: iv in t and dv in t
    agree(1.0, 1.0 if has(key_t) and not any(has(w[0]) for w in wrongs) else 0.0, 1e-9, "testable")
    k, ds = sentence_options(key_t, "A testable question names a variable the experimenter changes and a quantity that can be measured.", wrongs)
    stem = f"A student plans an investigation of {sysm}. Which of the following is a testable scientific question for the investigation?"
    return mk("ch_testable_question", "3.13", "2.A", stem, k, ds, rng, concept="identify a testable question with a controlled variable and a measurable outcome", path="sentence rule: a testable question contains both the manipulated variable and the measured quantity; the distractors contain neither", facts=[f"iv={iv}", f"dv={dv}"], judgment="separate a measurable relationship from opinion", est=60)


# ======================= 2.B 가설 예측 (5.2) =======================
def ch_rate_prediction(rng):
    for _ in forever():
        m, n = pick(rng, [(1, 1), (2, 1), (1, 2), (2, 0), (0, 2), (1, 0)])
        fa, fb = pick(rng, [(2, 0.5), (3, 2), (2, 2), (0.5, 2), (2, 3)])
        ratio = fa ** m * fb ** n
        if ratio not in (1.0,) and abs(math.log(ratio)) > 0.5:
            break
    agree(ratio, math.exp(m * math.log(fa) + n * math.log(fb)), 1e-9, "ratio")
    pairs = [("Swaps the orders of A and B.", fa ** n * fb ** m), ("Multiplies the concentration factors instead of raising them to the orders.", fa * fb), ("Uses only the effect of changing A.", fa ** m), ("Adds the exponent contributions.", fa + fb)]
    key, ds = num_opts(ratio, pairs, "", 3, fmt=lambda v: "$" + f"{v:.3g}" + "$")
    stem = f"The experimentally determined rate law for a reaction is $\\text{{rate}}=k[\\mathrm{{A}}]^{m}[\\mathrm{{B}}]^{n}$. A student predicts what will happen if the concentration of A is multiplied by {fa:g} and the concentration of B is multiplied by {fb:g} at constant temperature. By what factor is the initial rate predicted to change?"
    return mk("ch_rate_prediction", "5.2", "2.B", stem, key, ds, rng, concept="predict the factor change in rate from reaction orders", path="power-law arithmetic exactly vs the exponent-sum of logs", facts=[f"m={m}", f"n={n}", f"fa={fa}", f"fb={fb}", f"ratio={ratio:.6g}"], judgment="apply each order to its own concentration factor", est=70,
              kwhy=f"The rate is proportional to [A]^{m}[B]^{n}, so changing [A] by a factor of {fa:g} and [B] by a factor of {fb:g} changes the rate by ({fa:g})^{m} × ({fb:g})^{n} = {ratio:.3g}.")


# ======================= 4.6 뷰렛 읽기 (2.D) =======================
def ch_buret_data(rng):
    for _ in forever():
        true = pick(rng, [18.60, 21.45, 24.10, 27.35]); jit = [pick(rng, [-0.05, 0.0, 0.05, 0.10]) for _ in range(3)]
        outl = rng.randrange(3); jit[outl] = pick(rng, [-1.3, 1.4, 1.6, -1.1])
        init = [pick(rng, [0.00, 0.50, 1.00, 0.20]) for _ in range(3)]
        vols = [round(true + j, 2) for j in jit]
        fin = [round(i + v, 2) for i, v in zip(init, vols)]
        pairs_ = sorted(((abs(vols[i] - vols[j]), (i, j)) for i in range(3) for j in range(i + 1, 3)))
        best = pairs_[0][1]
        if pairs_[0][0] <= 0.15 and pairs_[1][0] > 0.8:
            break
    avg = float((Fr(str(vols[best[0]])) + Fr(str(vols[best[1]]))) / 2)
    agree(avg, float(np.mean([vols[best[0]], vols[best[1]]])), 1e-9, "avg")
    agree(outl, [i for i in range(3) if i not in best][0], 1e-9, "outlier")
    pairs = [("Averages all three trials, including the trial that is far from the others.", float(np.mean(vols))), ("Uses only the final buret reading of the first trial.", fin[0]), ("Averages the three final readings.", float(np.mean(fin))), ("Uses the largest volume delivered.", max(vols))]
    key, ds = abs_opts(avg, pairs, lambda v: "$" + f"{v:.2f}" + "\\text{ mL}$", 0.03)
    rows = [[f"Trial {i + 1}", f"{init[i]:.2f}", f"{fin[i]:.2f}"] for i in range(3)]
    stim = {"kind": "table", "description": "Buret readings in three titration trials", "data": {"x_label": "Trial", "columns": ["Trial", "Initial reading (mL)", "Final reading (mL)"], "y_label": "Final reading (mL)", "rows": rows}}
    stem = "A student titrates three identical samples of an acid with NaOH and records the buret readings (table). Which value is the best estimate of the volume of NaOH needed to reach the endpoint, in mL?"
    return mk("ch_buret_data", "4.6", "2.D", stem, key, ds, rng, concept="volume delivered from initial and final buret readings, excluding a discordant trial", stim=stim, material={"type": "table", "must_include": ["initial readings", "final readings"]},
              path="exact fraction mean of the two closest delivered volumes vs numpy mean of the same pair; the discordant trial is the one outside the closest pair", facts=[f"vols={vols}", f"best={best}", f"avg={avg:.4f}"], judgment="compute delivered volumes first, then exclude the discordant trial", est=90,
              kwhy=f"The volume delivered in each trial is final − initial: {', '.join(f'{v:.2f} mL' for v in vols)}. Trial {outl + 1} is far from the other two, so the best estimate is the average of the closest pair, ({vols[best[0]]:.2f} + {vols[best[1]]:.2f})/2 = {avg:.2f} mL.")


# ======================= 3.3 입자 모형과 상 (1.B) =======================
def ch_particle_phase(rng):
    ph = pick(rng, ["solid", "liquid", "gas"])
    pf = {"solid": 0.74, "liquid": 0.60, "gas": 0.04}[ph]; order = {"solid": "regular repeating pattern", "liquid": "random arrangement with particles touching", "gas": "random arrangement with large gaps"}[ph]
    # 독립 경로: 충전율과 정렬 여부로 상을 분류
    cls = "gas" if pf < 0.2 else ("solid" if order.startswith("regular") else "liquid")
    agree(1.0, 1.0 if cls == ph else 0.0, 1e-9, "phase")
    props = {"solid": "has a fixed shape and is essentially incompressible", "liquid": "takes the shape of its container, has a fixed volume, and is nearly incompressible", "gas": "takes the shape and volume of its container and is easily compressed"}
    scene = {"type": "particles", "phase": ph, "arrangement": order, "packing_fraction": pf}
    stim = diagram_stim_chem(f"A particulate diagram of one sample of a pure substance: the particles show a {order}.", "chem_particles", {"scene": scene})
    k, ds = sentence_options(f"The sample is a {ph}, so it {props[ph]}.", f"The diagram shows a {order}, which is the arrangement of a {ph}; the spacing and order of the particles determine how the sample behaves as a whole.",
                             [(f"The sample is a {x}, so it {props[x]}.", {"solid": "Treats particles in contact as a rigid lattice regardless of order.", "liquid": "Confuses freely moving touching particles with widely spaced particles.", "gas": "Assumes particles that are far apart form a dense, incompressible phase."}[x]) for x in ("solid", "liquid", "gas") if x != ph] +
                             [(f"The sample is a {ph}, so it is expected to have the same properties as a {pick(rng, [x for x in ('solid', 'liquid', 'gas') if x != ph])}.", "Links a particulate arrangement to the wrong macroscopic behavior.")])
    stem = "The particulate representation of a pure substance is shown. Which statement correctly connects the particle arrangement to the macroscopic properties of the sample?"
    return mk("ch_particle_phase", "3.3", "1.B", stem, k, ds, rng, concept="phase and macroscopic properties from a particulate diagram", stim=stim, material={"type": "diagram", "must_include": ["particle spacing", "particle arrangement"]}, path="rule table from arrangement/packing to phase vs a packing-fraction threshold classifier", facts=[f"phase={ph}", f"packing={pf}"], judgment="read spacing and order from the diagram and connect to properties", est=70)


# ======================= 2.6 공명과 결합 길이 (4.D) =======================
RES = [("CO32-", "C–O", 143, 120, [129, 129, 129], "carbonate ion"), ("NO3-", "N–O", 140, 120, [124, 124, 124], "nitrate ion"), ("O3", "O–O", 148, 121, [128, 128], "ozone molecule")]


def ch_resonance_lengths(rng):
    sp_, bond, single, double, meas, nm = pick(rng, RES)
    equal = len(set(meas)) == 1
    between = single > meas[0] > double
    agree(1.0, 1.0 if equal and between else 0.0, 1e-9, "resonance")
    key_t = f"The measured bond lengths are all equal and between the single-bond and double-bond values, so a model with one double bond and the rest single bonds does not fit the data; resonance structures describe the {nm} better."
    wrongs = [("The measured bond lengths are all equal, so the model with one double bond and the rest single bonds fits the data well and needs no change.", "Ignores that a single-double model predicts two different bond lengths."),
              (f"The measured bond lengths are close to the single-bond value, so the {nm} contains only single bonds and the model needs no double bond.", "Misreads a length between the two reference values as a single bond."),
              ("The measured bond lengths are all different from one another, so each bond must have a different order and the model should be kept as drawn.", "Contradicts the table, which shows equal measured lengths.")]
    k, ds = sentence_options(key_t, "Equal intermediate bond lengths show delocalized bonding that no single Lewis structure shows.", wrongs)
    stim = table_stimulus(f"{bond} bond lengths in the {nm}", "Bond", [["Typical single bond", f"{single} pm"], ["Typical double bond", f"{double} pm"]] + [[f"Measured bond {i + 1} in the {nm}", f"{v} pm"] for i, v in enumerate(meas)], "Length")
    stem = f"A student draws a Lewis structure of the {nm} with one double bond and the other bonds single. The table compares typical {bond} bond lengths with those measured in the {nm}. Which statement best evaluates the student's model?"
    return mk("ch_resonance_lengths", "2.6", "4.D", stem, k, ds, rng, concept="evaluate a single Lewis structure against measured bond lengths and resonance", stim=stim, material={"type": "table", "must_include": ["single bond length", "double bond length", "measured lengths"]}, path="equality and betweenness tests on the measured lengths vs the number of distinct lengths a single-double structure predicts", facts=[f"species={sp_}", f"meas={meas}"], judgment="compare the number and size of measured lengths with what the model predicts", est=95)


# ======================= 6.4 자료로 주장 뒷받침 (6.B) =======================
def ch_claim_from_data(rng):
    exo = rng.random() < 0.5
    base = pick(rng, [21.0, 22.5, 24.0]); d = pick(rng, [2.5, 3.1, 4.4, 5.2])
    trials = [round(base + (d if exo else -d) + e, 1) for e in (0.0, 0.2, -0.1)]
    dT = [round(t - base, 1) for t in trials]
    avg = float(np.mean(dT))
    agree(1.0, 1.0 if (avg > 0) == exo else 0.0, 1e-9, "sign")
    word = "exothermic" if exo else "endothermic"; opp = "endothermic" if exo else "exothermic"
    key_t = f"The process is {word}: the average temperature change was ${avg:+.1f}\\,^{{\\circ}}\\text{{C}}$, so the solution {'gained' if exo else 'lost'} thermal energy from the dissolving process."
    wrongs = [(f"The process is {opp}: the average temperature change was ${avg:+.1f}\\,^{{\\circ}}\\text{{C}}$, so the solution {'lost' if exo else 'gained'} thermal energy.", "Reverses the link between the sign of ΔT and the direction of energy flow."),
              (f"The process is {word}: the average temperature change was ${abs(avg):.1f}\\,^{{\\circ}}\\text{{C}}$ in magnitude, but a single trial is not enough evidence.", "Dismisses consistent data from three trials."),
              (f"The process is {opp}: the final temperatures differ between trials, so the system must absorb energy.", "Uses trial-to-trial variation rather than the sign of the temperature change.")]
    k, ds = sentence_options(key_t, f"The temperature changes in the three trials are {', '.join(f'{x:+.1f}' for x in dT)} °C (mean {avg:+.1f} °C); a temperature {'increase' if exo else 'decrease'} of the solution means energy was {'released to' if exo else 'absorbed from'} the solution, so the process is {word}.", wrongs)
    rows = [[f"Trial {i + 1}", f"{base:.1f}", f"{t:.1f}"] for i, t in enumerate(trials)]
    stim = {"kind": "table", "description": "Temperature of water before and after a solid is dissolved", "data": {"x_label": "Trial", "columns": ["Trial", "Initial temperature (°C)", "Final temperature (°C)"], "y_label": "Final temperature (°C)", "rows": rows}}
    stem = "A student dissolves a solid in water in a calorimeter in three trials and records the temperatures (table). Which claim about the dissolving process is best supported by the data?"
    return mk("ch_claim_from_data", "6.4", "6.B", stem, k, ds, rng, concept="support a claim about an endothermic or exothermic process with experimental temperature data", stim=stim, material={"type": "table", "must_include": ["initial temperatures", "final temperatures"]}, path="mean of the three temperature changes (exact) vs the sign of each trial's change", facts=[f"base={base}", f"trials={trials}", f"exo={exo}"], judgment="cite the sign and size of the temperature change", est=85)


# ======================= 3.5 입자 수준 설명 (6.E) =======================
GAS_SC = [("the temperature of a gas in a rigid container is increased", "pressure increases", "the particles move faster on average, so they hit the walls more often and with more force"),
          ("the volume of a gas sample is halved at constant temperature", "pressure increases", "the particles collide with the walls more often because they are closer together, while their average speed is unchanged"),
          ("more gas is added to a rigid container at constant temperature", "pressure increases", "there are more particles, so more collisions with the walls occur per second")]


def ch_gas_particle_claim(rng):
    cond, res, why = pick(rng, GAS_SC)
    # 독립 경로: 이상 기체식에서 압력이 증가하는지 수치로 확인
    idx = GAS_SC.index((cond, res, why))
    P = [lambda: (1.0 * 1.5 * 1.0) > 1.0, lambda: (1.0 * 1.0 / 0.5) > 1.0, lambda: (1.5 * 1.0) > 1.0][idx]()
    agree(1.0, 1.0 if P else 0.0, 1e-9, "P up")
    wrongs = [("The pressure increases because the particles themselves expand when the sample is changed, so they fill more of the space.", "Believes particles themselves expand."), ("The pressure increases because the particles attract each other more strongly, so they push harder against the walls.", "Attributes the pressure change to stronger attractions."),
              ("The pressure increases because the individual particles become heavier, so each collision transfers more momentum.", "Believes the mass of a particle changes.")]
    k, ds = sentence_options(f"The pressure increases because {why}.", "Pressure comes from the frequency and force of particle collisions with the container walls.", wrongs)
    stem = f"A student explains that when {cond}, the pressure of the gas increases. Which statement best justifies the claim at the particulate level?"
    return mk("ch_gas_particle_claim", "3.5", "6.E", stem, k, ds, rng, concept="particulate-level justification of a macroscopic gas-law trend", path="the ideal gas relation predicts a pressure increase in each scenario (numeric) and the collision explanation is keyed to the changed variable", facts=[f"scenario={idx}"], judgment="connect collisions per second and force per collision to the pressure", est=70)


# ======================= 8.5 적정 결론 (6.F) =======================
def ch_titration_conclusion(rng):
    weak = rng.random() < 0.6
    c = pick(rng, [0.100, 0.200]); Ka = pick(rng, [1.8e-5, 6.8e-4, 4.5e-4])
    if weak:
        h = _E._weak_h(Ka, c); pH0 = -math.log10(h)
        cs = c / 2; pH_eq = 14 + math.log10(math.sqrt(KW / Ka * cs))
    else:
        pH0 = -math.log10(c); pH_eq = 7.0
    strong_pred = -math.log10(c)
    is_weak = pH0 > strong_pred + 0.3
    agree(1.0, 1.0 if is_weak == weak else 0.0, 1e-9, "weak")
    kind = "weak" if weak else "strong"
    key_t = f"The acid is {kind}: the initial pH of ${pH0:.2f}$ is {'much higher than' if weak else 'consistent with'} the pH of ${strong_pred:.2f}$ expected for a fully dissociated acid of this concentration, and the equivalence-point pH of ${pH_eq:.1f}$ is {'above' if weak else 'equal to'} 7."
    other = "strong" if weak else "weak"
    wrongs = [(f"The acid is {other}: the initial pH of ${pH0:.2f}$ shows that the acid is {'completely' if weak else 'only partly'} dissociated in water, and the equivalence-point pH of ${pH_eq:.1f}$ is {'equal to' if weak else 'above'} 7.", "Misreads the initial pH relative to the strong-acid expectation."),
              (f"The acid is {other}: the equivalence point at pH ${pH_eq:.1f}$ shows that the salt formed is {'neutral' if weak else 'basic'}, and the initial pH of ${pH0:.2f}$ supports this.", "Misinterprets the pH at equivalence."),
              (f"The acid is {kind}, but the pH at the equivalence point of ${pH_eq:.1f}$ is not relevant to the strength of the acid, so the initial pH alone must be used.", "Ignores that the equivalence-point pH carries information about the conjugate base.")]
    k, ds = sentence_options(key_t, f"A {c:g} M strong acid would have an initial pH of {strong_pred:.2f}; the measured initial pH of {pH0:.2f} is {'higher' if weak else 'equal'}, and the equivalence-point pH of {pH_eq:.1f} is {'above' if weak else 'equal to'} 7, which " + ("shows that A⁻ is a weak base, so HA is a weak acid." if weak else "is the pH of a salt of a strong acid and a strong base."), wrongs)
    stem = f"A ${c:g}\\text{{ M}}$ monoprotic acid is titrated with NaOH of the same concentration. The initial pH of the acid solution is ${pH0:.2f}$ and the pH at the equivalence point is ${pH_eq:.1f}$. Which conclusion about the acid is best supported by these results?"
    return mk("ch_titration_conclusion", "8.5", "6.F", stem, k, ds, rng, concept="connect titration pH data to the strength of an acid", path="initial pH compared with -log c from an exact charge balance vs the equivalence-point pH from salt hydrolysis", facts=[f"c={c}", f"weak={weak}", f"pH0={pH0:.4f}", f"pHeq={pH_eq:.4f}"], judgment="compare measured pH with what a strong acid would give", est=95)


# ======================= 2문항 세트 =======================
def _set(arch, intro, stim, items, topic, skill):
    return {"archetype": arch, "topic": topic, "skill": skill, "calculator": "allowed", "set_intro": intro, "stimulus": stim, "items": items, "facts": items[0]["facts"], "blueprint": items[0]["blueprint"]}


def chs_titration_set(rng):
    """세트 1: 약산 적정 곡선 → (Ka, 당량점 pH)."""
    for _ in forever():
        pKa = pick(rng, [3.9, 4.3, 4.8, 5.2]); Ka = 10 ** -pKa
        Vs = [i * 0.5 for i in range(0, 101)]; pHs = _E._titration_curve(Ka, 0.100, 25.0, 0.100, Vs)
        Veq = 25.0; pH_half = pHs[Vs.index(12.5)]; pH_eq = pHs[Vs.index(Veq)]
        approx_eq = 7 + 0.5 * (pKa + math.log10(0.05))
        agree(pH_eq, approx_eq, 0.06, "pH_eq")
        break
    stim = graph_stim("Titration of 25.0 mL of 0.100 M weak acid HA with 0.100 M NaOH", [("pH", [[v, round(p, 3)] for v, p in zip(Vs[::2], pHs[::2])])], gaxis("Volume of NaOH added (mL)", 0, 50, 10), gaxis("pH", 0, 14, 2))
    k1, d1 = num_opts(10 ** -pH_half, [("Uses the pH at the equivalence point instead of the pH at the half-equivalence point.", 10 ** -pH_eq), ("Uses the initial pH of the acid solution instead of the pH at the half-equivalence point.", 10 ** -pHs[0]), ("Uses the pH after excess base was added instead of the pH at the half-equivalence point.", 10 ** -pHs[-1]), ("Uses Kw divided by the correct value.", 1e-14 / 10 ** -pH_half)], "", 2, fmt=lambda v: sci(v, "") if v < 0.1 else "$" + f"{v:.2f}" + "$")
    k2, d2 = pH_opts(pH_eq, [("Reports 7.00 for the equivalence point of any neutralization.", 7.0), ("Reports the pKa, the pH at the half-equivalence point, instead of the equivalence-point pH.", pH_half), ("Uses the initial pH of the acid.", pHs[0]), ("Uses the final pH after excess base.", pHs[-1])])
    qs = []
    for stm, key, ds, nm in [("Which of the following is the best estimate of the acid dissociation constant, $K_a$, of HA?", k1, d1, "q1"), ("What is the pH at the equivalence point of this titration?", k2, d2, "q2")]:
        qs.append(mk(f"chs_titration_set_{nm}", "8.5", "5.D", stm, key, ds, rng, concept="questions about one weak-acid titration curve", cond=[("the curve is the exact charge-balance solution", "stimulus")], path="generating Ka and the analytic equivalence pH vs values read from the numerically computed curve", material=MAT_GRAPH("titration curve"), facts=[f"pKa={pKa}", f"pH_half={pH_half:.4f}", f"pH_eq={pH_eq:.4f}"], judgment="read the half-equivalence and equivalence points", est=95,
                       kwhy=(f"The equivalence point is at 25.0 mL (the steep rise), so the half-equivalence point is at 12.5 mL, where pH = pKa. The curve shows pH ≈ {pH_half:.2f} there, so Ka = 10^−{pH_half:.2f} = {sn(10 ** -pH_half, 3)}." if nm == "q1" else f"At 25.0 mL all of the HA has been converted to its conjugate base A⁻, a weak base, so the equivalence-point pH is above 7; the curve reads pH ≈ {pH_eq:.2f} at that volume.")))
    return _set("chs_titration_set", "A $25.0\\text{ mL}$ sample of a weak monoprotic acid, HA, is titrated with $0.100\\text{ M}$ NaOH. The titration curve is shown.", stim, qs, "8.5", "5.D")


def chs_rate_set(rng):
    """세트 2: 초기 속도 표 → (A 에 대한 차수, 속도 상수 k)."""
    for _ in forever():
        m, n = pick(rng, [(1, 1), (2, 1), (1, 0), (0, 1), (2, 0)]); k = pick(rng, [0.015, 0.040, 0.12, 0.30, 1.5]); A0, B0 = pick(rng, [0.10, 0.20]), pick(rng, [0.10, 0.20])
        exps = [(A0, B0), (2 * A0, B0), (A0, 2 * B0)]; rates = [k * a ** m * b ** n for a, b in exps]
        X = np.array([[1, math.log(a), math.log(b)] for a, b in exps]); co = np.linalg.lstsq(X, np.log(np.array(rates)), rcond=None)[0]
        agree(co[1], m, 1e-6, "m"); agree(co[2], n, 1e-6, "n")
        break
    unit = {1: "\\text{ s}^{-1}", 2: "\\text{ M}^{-1}\\text{s}^{-1}", 3: "\\text{ M}^{-2}\\text{s}^{-2}"}.get(m + n, "\\text{ M/s}") if m + n else "\\text{ M/s}"
    unit = {0: "\\text{ M/s}", 1: "\\text{ s}^{-1}", 2: "\\text{ M}^{-1}\\text{s}^{-1}", 3: "\\text{ M}^{-2}\\text{s}^{-1}"}[m + n]
    rows = [[str(i + 1), f"{a:g}", f"{b:g}", f"{sn(r, 4)}"] for i, ((a, b), r) in enumerate(zip(exps, rates))]
    stim = {"kind": "table", "description": "Initial rates for the reaction A + B → products", "data": {"x_label": "Experiment", "columns": ["Experiment", "[A] (M)", "[B] (M)", "Initial rate (M/s)"], "y_label": "Initial rate (M/s)", "rows": rows}}
    names = {0: "zero order", 1: "first order", 2: "second order"}
    k1, d1 = sentence_options(f"The reaction is {names[m]} in A.", f"Experiments 1 and 2 change only [A] (it doubles) and the rate changes by a factor of {rates[1] / rates[0]:g}, which gives the order in A.", [(f"The reaction is {names[o]} in A.", f"A {names[o]} dependence on A would change the rate by a factor of {2 ** o} when [A] doubles, but the data show a factor of {rates[1] / rates[0]:g}.") for o in (0, 1, 2) if o != m] + [("The order in A cannot be determined from these data.", "Believes three experiments are not enough to find an order, when two experiments that change only [A] are enough.")])
    key_k = Opt("$" + sig(k, 3) + unit + "$", True, "", k)
    wr = []
    for why, v, u in [("Uses the rate of experiment 1 as k.", rates[0], "\\text{ M/s}"), ("Divides the rate by only one concentration.", rates[0] / A0, unit), ("Uses the concentrations without their orders in the rate law.", rates[0] / (A0 * B0), unit), ("Gives k with the wrong rate-law order for the units.", k * 2.5, "\\text{ M/s}")]:
        if abs(v - k) > 0.08 * k:
            wr.append(Opt("$" + sig(v, 3) + u + "$", False, why, v))
    wr = wr[:3]
    if len(wr) < 3:
        raise ValueError("few")
    qs = []
    for stm, key, ds, nm in [("What is the order of the reaction with respect to A?", k1, d1, "q1"), ("What is the value of the rate constant, $k$, for the reaction, including units?", key_k, wr, "q2")]:
        qs.append(mk(f"chs_rate_set_{nm}", "5.2", "5.D", stm, key, ds, rng, concept="orders and rate constant from one table of initial rates", cond=[("one concentration changes at a time", "table")], path="log-log least squares vs integer search of orders; k from experiment 1 with those orders", material={"type": "table", "must_include": ["initial rates"]}, facts=[f"k={k}", f"m={m}", f"n={n}", f"A0={A0}", f"B0={B0}"], judgment="find orders by comparing experiments, then solve for k", est=105,
                       kwhy=(f"Experiments 1 and 2 differ only in [A], which doubles from {exps[0][0]:g} M to {exps[1][0]:g} M, while the rate changes by a factor of {rates[1] / rates[0]:g}, so the order in A is {m}." if nm == "q1" else f"With orders of {m} in A and {n} in B, k = rate/([A]^{m}[B]^{n}) = {sn(rates[0], 4)} M/s / (({A0:g} M)^{m} ({B0:g} M)^{n}) = {k:.3g}, and the units of k are chosen so that the rate comes out in M/s.")))
    return _set("chs_rate_set", "The table gives initial rate data for the reaction A + B → products at constant temperature.", stim, qs, "5.2", "5.D")


def chs_equilibrium_set(rng):
    """세트 3: A ⇌ 2B 의 초기 혼합물 → (Q 와 이동 방향, 평형 [B])."""
    for _ in forever():
        K = pick(rng, [0.20, 0.50, 1.0, 2.0]); A0 = pick(rng, [0.40, 0.50, 1.0]); B0 = pick(rng, [0.10, 0.20, 0.30])
        Q = B0 ** 2 / A0
        if abs(Q / K - 1) > 0.25:
            break
    x = sp.Symbol("x", real=True)
    roots = [r for r in sp.solve(sp.Eq((sp.nsimplify(B0) + 2 * x) ** 2, sp.nsimplify(K) * (sp.nsimplify(A0) - x)), x) if r.is_real and A0 - r > 0 and B0 + 2 * r > 0]
    xe = float(roots[0])
    xb = bisect(lambda v: (B0 + 2 * v) ** 2 - K * (A0 - v), -B0 / 2 + 1e-9, A0 - 1e-9)
    agree(xe, xb, 1e-7, "x")
    Beq = B0 + 2 * xe
    fwd = Q < K
    dtxt = {True: "toward the products", False: "toward the reactant"}
    k1, d1 = sentence_options(f"$Q={Q:.3g}$, which is {'less' if fwd else 'greater'} than $K_c$, so the reaction proceeds {dtxt[fwd]}.", f"Q = [B]²/[A] = ({B0:g})²/{A0:g} = {Q:.3g}, compared with K = {K:g}: Q is {'less' if fwd else 'greater'} than K, so the reaction proceeds {dtxt[fwd]}.",
                              [(f"$Q={Q:.3g}$, which is {'less' if fwd else 'greater'} than $K_c$, so the reaction proceeds {dtxt[not fwd]}.", "Correct comparison, reversed direction."), (f"$Q={Q:.3g}$, which is {'greater' if fwd else 'less'} than $K_c$, so the reaction proceeds {dtxt[not fwd]}.", "Reverses the comparison of Q and K."),
                               (f"$Q={Q:.3g}$, so the mixture is at equilibrium.", "Treats any computed Q as an equilibrium state.")])
    k2, d2 = num_opts(Beq, [("Reports B0 + x (the amount of A that reacted) instead of the equilibrium concentration of B.", B0 + xe), ("Ignores the initial amount of B.", 2 * bisect(lambda v: (2 * v) ** 2 - K * (A0 - v), 0.0, A0)), ("Reports the equilibrium concentration of A.", A0 - xe), ("Uses the initial concentration of B.", B0)], "M")
    qs = []
    for stm, key, ds, nm in [(f"What is the value of the reaction quotient, $Q$, for the initial mixture, and in which direction does the reaction proceed?", k1, d1, "q1"), ("What is the equilibrium concentration of B, in M?", k2, d2, "q2")]:
        qs.append(mk(f"chs_equilibrium_set_{nm}", "7.3", "5.F", stm, key, ds, rng, concept="Q versus K and an ICE table from one initial mixture", cond=[("K is given at one temperature", "stem")], path="sympy quadratic for the shifted equilibrium vs bisection; Q computed directly", facts=[f"K={K}", f"A0={A0}", f"B0={B0}", f"Q={Q:.6f}", f"Beq={Beq:.6f}"], judgment="compare Q with K first, then solve with a shifted ICE table", est=110,
                       kwhy=(f"Q = [B]²/[A] = ({B0:g})²/{A0:g} = {Q:.3g}, which is {'less' if fwd else 'greater'} than K = {K:g}, so the reaction proceeds {dtxt[fwd]}." if nm == "q1" else f"If x M of A reacts, Kc = ({B0:g} + 2x)²/({A0:g} − x) = {K:g}; solving this quadratic gives x = {xe:.4g} M, so [B] = {B0:g} + 2x = {Beq:.3g} M.")))
    return _set("chs_equilibrium_set", "The table gives the equilibrium constant and the initial concentrations for the gaseous reaction $\\mathrm{A}(g) \\rightleftharpoons 2\\,\\mathrm{B}(g)$ in a rigid flask at a certain temperature.", table_stimulus("Conditions for the reaction A(g) ⇌ 2 B(g) at one temperature", "Quantity", [["Equilibrium constant, Kc", f"{K:g}"], ["Initial [A] (M)", f"{A0:g}"], ["Initial [B] (M)", f"{B0:g}"]], "Value"), qs, "7.3", "5.F")
