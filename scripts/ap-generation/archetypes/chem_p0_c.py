"""AP Chemistry P0 원형 C — 단원 4(화학 반응)·5(반응 속도론). 정답은 코드가 계산하고 독립 경로로 재계산한다."""
from chem_common import *  # noqa: F401,F403
from common import Opt
from math import gcd

# 반응: (반응물 [(계수, 식)], 생성물 (계수, 식))
RXNS = [([(2, "Al"), (3, "Cl2")], (2, "AlCl3")), ([(1, "N2"), (3, "H2")], (2, "NH3")), ([(2, "H2"), (1, "O2")], (2, "H2O")), ([(4, "Fe"), (3, "O2")], (2, "Fe2O3")),
        ([(2, "Na"), (1, "Cl2")], (2, "NaCl")), ([(2, "Mg"), (1, "O2")], (2, "MgO")), ([(1, "C3H8"), (5, "O2")], (3, "CO2")), ([(2, "Ca"), (1, "O2")], (2, "CaO"))]


def _stoich(rng, need_limiting=True):
    for _ in forever():
        rx = pick(rng, RXNS)
        (a, fa), (b, fb) = rx[0]
        ma = pick(rng, [2.0, 4.0, 5.0, 8.0, 10.0, 12.0, 20.0, 25.0, 40.0]); mb = pick(rng, [2.0, 4.0, 5.0, 8.0, 10.0, 16.0, 20.0, 25.0, 40.0, 64.0])
        na, nb = Fr(str(ma)) / Fr(str(round(formula_mass(fa), 4))), Fr(str(mb)) / Fr(str(round(formula_mass(fb), 4)))
        ea, eb = na / a, nb / b
        if ea != eb and (max(ea, eb) / min(ea, eb) > 1.25 or not need_limiting):
            return rx, ma, mb, na, nb, ea, eb


@retry_sep
def ch_limiting_reagent(rng):
    rx, ma, mb, na, nb, ea, eb = _stoich(rng)
    (a, fa), (b, fb) = rx[0]; pc, fp = rx[1]
    ext = min(ea, eb)
    key_v = float(ext * pc) * formula_mass(fp)
    # 독립 경로: 반응 진행도를 작은 걸음으로 올리며 한 반응물이 바닥날 때까지 시뮬레이션
    x, step = 0.0, 1e-5
    NA_, NB_ = float(na), float(nb)
    while NA_ - a * (x + step) >= 0 and NB_ - b * (x + step) >= 0:
        x += step
    agree(key_v, x * pc * formula_mass(fp), 5e-3, "mass")
    lim_other = float((eb if ea < eb else ea) * pc) * formula_mass(fp)
    pairs = [("Uses the excess reactant to find the product.", lim_other), ("Adds the masses of the two reactants.", ma + mb), ("Omits the mole ratio of the balanced equation (treats it as 1:1:1).", float(min(na, nb)) * formula_mass(fp)),
             ("Uses the moles of the limiting reactant without the product coefficient.", float(ext) * formula_mass(fp))]
    key, ds = num_opts(key_v, pairs, "g")
    eq = rxn_tex([(c, f) for c, f in rx[0]], [rx[1]])
    stem = f"Consider the reaction {eq}. A mixture contains ${ma:g}\\text{{ g}}$ of {cf(fa)} and ${mb:g}\\text{{ g}}$ of {cf(fb)}. What is the maximum mass of {cf(fp)}, in g, that can form?"
    return mk("ch_limiting_reagent", "4.5", "5.F", stem, key, ds, rng, concept="theoretical yield from a limiting reactant using a balanced equation", path="exact fraction extent-of-reaction minimum vs numerical stepping of the reaction extent until one reactant runs out",
              facts=[f"fa={fa}", f"fb={fb}", f"fp={fp}", f"ma={ma}", f"mb={mb}", f"coefs={a},{b},{pc}", f"key={key_v:.5f}"], judgment="identify the limiting reactant before converting to product mass", est=130)


@retry_sep
def ch_percent_yield(rng):
    rx, ma, mb, na, nb, ea, eb = _stoich(rng, False)
    (a, fa), (b, fb) = rx[0]; pc, fp = rx[1]
    # 반응물 A 가 제한(B 는 과량)이 되도록 B 질량을 크게 한다는 서술
    theo = float(na / a * pc) * formula_mass(fp)
    frac = pick(rng, [0.55, 0.62, 0.70, 0.75, 0.82, 0.88])
    actual = round(theo * frac, 2)
    pct = actual / theo * 100
    agree(pct, float(Fr(str(actual)) / (na / a * pc * Fr(str(round(formula_mass(fp), 4)))) * 100), 1e-3, "pct")
    pairs = [("Divides the theoretical yield by the actual yield.", theo / actual * 100), ("Omits the product coefficient when finding the theoretical yield.", actual / (float(na / a) * formula_mass(fp)) * 100),
             ("Uses the mass of the reactant as the theoretical yield.", actual / ma * 100), ("Reports the actual mass as a percentage.", actual)]
    key, ds = num_opts(pct, pairs, "%")
    eq = rxn_tex([(c, f) for c, f in rx[0]], [rx[1]])
    stem = f"For the reaction {eq}, ${ma:g}\\text{{ g}}$ of {cf(fa)} reacts with an excess of {cf(fb)}. The reaction produces ${actual:g}\\text{{ g}}$ of {cf(fp)}. What is the percent yield?"
    return mk("ch_percent_yield", "4.5", "5.F", stem, key, ds, rng, concept="percent yield from the actual mass and a stoichiometric theoretical yield", path="exact fractions for the theoretical yield vs recovery of the generating percent",
              facts=[f"fa={fa}", f"fp={fp}", f"ma={ma}", f"coefs={a},{pc}", f"actual={actual}", f"pct={pct:.4f}"], judgment="compute the theoretical yield first, then compare with the measured mass", est=110)


# ======================= 4.6 적정 (5.F) =======================
TITR = [("HCl", "NaOH", 1), ("HNO3", "KOH", 1), ("H2SO4", "NaOH", 2), ("CH3COOH", "NaOH", 1), ("H3PO4", "NaOH", 3), ("HCl", "Ba(OH)2", 0.5)]  # base mol per acid mol


@retry_sep
def ch_titration_conc(rng):
    for _ in forever():
        ac, bs, r = pick(rng, TITR)
        Mb = pick(rng, [0.0500, 0.100, 0.150, 0.200, 0.250]); Vb = pick(rng, [12.5, 15.0, 18.4, 20.0, 24.6, 30.0]); Va = pick(rng, [10.0, 20.0, 25.0, 50.0])
        Ma = Mb * Vb * 1e-3 / r / (Va * 1e-3)
        agree(Ma, float(sp.solve(sp.Eq(sp.nsimplify(Ma_ := sp.Symbol("Ma")) * sp.nsimplify(Va) * sp.nsimplify(r), sp.nsimplify(Mb) * sp.nsimplify(Vb)), Ma_)[0]), 1e-9, "Ma")
        if 0.01 < Ma < 1.0:
            break
    pairs = [("Uses a 1:1 mole ratio regardless of the formula.", Mb * Vb / Va), ("Multiplies by the mole ratio instead of dividing.", Mb * Vb * r / Va), ("Divides by the base volume instead of the acid volume.", Mb * Vb / r / Vb * 1.0 if False else Ma * Va / Vb), ("Uses the base volume in liters and the acid volume in mL.", Mb * Vb * 1e-3 / r / Va)]
    key, ds = num_opts(Ma, pairs, "M")
    stem = f"A ${Va:g}\\text{{ mL}}$ sample of {cf(ac)} is titrated to the equivalence point with ${Mb:g}\\text{{ M}}$ {cf(bs)}. The titration requires ${Vb:g}\\text{{ mL}}$ of the base. What is the concentration of the acid, in M?"
    return mk("ch_titration_conc", "4.6", "5.F", stem, key, ds, rng, concept="concentration of an acid from an equivalence-point volume using the mole ratio in the neutralization", path="sympy solve of the mole-balance equation vs direct mole arithmetic",
              facts=[f"acid={ac}", f"base={bs}", f"ratio={r}", f"Mb={Mb}", f"Vb={Vb}", f"Va={Va}", f"Ma={Ma:.6f}"], judgment="write the neutralization mole ratio from the formulas", est=100)


# ======================= 4.2 알짜 이온 반응식 (5.E) =======================
PPT = [("Pb", 2, "I", 1, False, False), ("Ag", 1, "Cl", 1, False, False), ("Ba", 2, "SO4", 2, False, True), ("Ca", 2, "CO3", 2, False, True), ("Cu", 2, "OH", 1, False, True), ("Fe", 3, "OH", 1, False, True), ("Pb", 2, "Cl", 1, False, False),
       ("Ag", 1, "CrO4", 2, False, True), ("Mg", 2, "PO4", 3, False, True), ("Al", 3, "PO4", 3, False, True)]


def _ionic(cat, qc, an, qa, poly):
    g = gcd(qc, qa); nc, na_ = qa // g, qc // g
    cs = cat + (str(nc) if nc > 1 else ""); asub = an
    as_ = (f"({an}){na_}" if poly and na_ > 1 else an + (str(na_) if na_ > 1 else ""))
    return cs + as_, nc, na_


def ch_net_ionic(rng):
    cat, qc, an, qa, _, poly = pick(rng, PPT)
    form, nc, nan = _ionic(cat, qc, an, qa, poly)
    # 독립 경로: 전하 균형과 원자 균형을 직접 센다
    agree(nc * qc, nan * qa, 1e-9, "charge")
    good = f"{nc if nc > 1 else ''}{mt(cat, f'{qc}+' if qc > 1 else '+')} + {nan if nan > 1 else ''}{mt(an, f'{qa}-' if qa > 1 else '-')} \\rightarrow {mt(form)}(s)".replace("{}", "")
    good = "$" + good.replace("\\mathrm", "\\mathrm", 1) + "$"
    ion = lambda c, q, n: (f"{n}\\," if n > 1 else "") + mt(c, (f"{q}+" if q > 1 else "+"))
    ani = lambda c, q, n: (f"{n}\\," if n > 1 else "") + mt(c, (f"{q}-" if q > 1 else "-"))
    good = "$" + ion(cat, qc, nc) + " + " + ani(an, qa, nan) + " \\rightarrow " + mt(form) + "(s)$"
    unbal = "$" + ion(cat, qc, 1) + " + " + ani(an, qa, 1) + " \\rightarrow " + mt(form) + "(s)$"
    nna, nno3 = nan * qa, nc * qc  # 구경꾼 이온 수: 음이온 쪽 나트륨, 양이온 쪽 질산 이온(전하 균형)
    sp_na = (f"{nna}\\," if nna > 1 else "") + mt("Na", "+"); sp_no3 = (f"{nno3}\\," if nno3 > 1 else "") + mt("NO3", "-")
    full = "$" + ion(cat, qc, nc) + " + " + ani(an, qa, nan) + " + " + sp_na + " + " + sp_no3 + " \\rightarrow " + mt(form) + "(s) + " + sp_na + " + " + sp_no3 + "$"
    wrong_formula = "$" + ion(cat, qc, 1) + " + " + ani(an, qa, 1) + " \\rightarrow " + mt(cat + an) + "(s)$"
    nb = nc * qc
    wrong_ion = "$" + ion(cat, qc, nc) + " + " + ani(an, qa, nan) + " \\rightarrow " + mt(form) + "(aq)$"
    spect = "$" + mt("Na", "+") + " + " + mt("NO3", "-") + " \\rightarrow " + mt("NaNO3") + "(s)$"
    nochange = "$" + ion(cat, qc, nc) + " + " + ani(an, qa, nan) + " \\rightarrow " + ion(cat, qc, nc) + " + " + ani(an, qa, nan) + "$"
    cands = [(unbal, "Leaves the equation unbalanced in charge and atoms."), (full, "Includes spectator ions, which do not take part in the net change."), (wrong_formula, "Writes a precipitate formula that does not balance the ion charges."),
             (wrong_ion, "Shows the product as dissolved even though it precipitates."), (spect, "Combines the spectator ions, which stay dissolved."), (nochange, "Writes the same ions on both sides, showing no net change.")]
    key_t = good
    ds, seen = [], {good}
    for t, w in cands:
        if t not in seen:
            seen.add(t); ds.append(Opt(t, False, w, None))
    key = Opt(key_t, True, "The net ionic equation shows the ions that combine and the solid they form, balanced in charge and atoms.", None)
    solcat = {"Pb": "Pb(NO3)2", "Ag": "AgNO3", "Ba": "Ba(NO3)2", "Ca": "Ca(NO3)2", "Cu": "Cu(NO3)2", "Fe": "Fe(NO3)3", "Mg": "Mg(NO3)2", "Al": "Al(NO3)3"}[cat]
    solan = {"I": "NaI", "Cl": "NaCl", "SO4": "Na2SO4", "CO3": "Na2CO3", "OH": "NaOH", "CrO4": "Na2CrO4", "PO4": "Na3PO4"}[an]
    stem = f"Aqueous {cf(solcat)} is mixed with aqueous {cf(solan)}, and a precipitate of {cf(form)} forms. Which of the following is the net ionic equation for the reaction?"
    return mk("ch_net_ionic", "4.2", "5.E", stem, key, ds[:3], rng, concept="net ionic equation for a precipitation reaction balanced in atoms and charge", path="precipitate formula from cross-multiplying charges vs the tabulated formula; charge and atom counts checked",
              facts=[f"cat={cat}{qc}", f"an={an}{qa}", f"form={form}"], judgment="drop spectator ions and balance both atoms and charge", est=100)


# ======================= 4.9 산화-환원 (4.A) =======================
REDOX = [("Zn", 0, "Zn", 2, "Cu", 2, "Cu", 0), ("Fe", 0, "Fe", 2, "Ag", 1, "Ag", 0), ("Mg", 0, "Mg", 2, "Cu", 2, "Cu", 0), ("Al", 0, "Al", 3, "Ag", 1, "Ag", 0), ("Cu", 0, "Cu", 2, "Ag", 1, "Ag", 0), ("Zn", 0, "Zn", 2, "H", 1, "H", 0)]


def ch_redox_agent(rng):
    a, qa0, _, qa1, b, qb0, _, qb1 = pick(rng, REDOX)
    sp_ = lambda x, q: mt(x, (f"{q}+" if q > 1 else "+") if q > 0 else None) if q != 0 else mt(x if x != "H" else "H2")
    r_a, r_b = (a, qa0), (b, qb0)
    # 독립 경로 1: 산화수 변화의 부호, 경로 2: 잃은·얻은 전자 수
    reduced = b if qb1 < qb0 else a
    lost = qa1 - qa0; gained = qb0 - qb1
    g_ = gcd(lost, gained)
    agree((gained // g_) * lost, (lost // g_) * gained, 1e-9, "electrons")  # 전자 수가 같도록 계수를 맞춘 뒤 잃은 전자 = 얻은 전자
    agree(1.0, 1.0 if (qb1 < qb0) else 0.0, 1e-9, "reduction")
    left = [(1, a if a != "H" else "H2")]
    species = [("$" + sp_(a, qa0) + "$", a, qa0), ("$" + sp_(b, qb0) + "$", b, qb0), ("$" + sp_(a, qa1) + "$", a, qa1), ("$" + sp_(b, qb1) + "$", b, qb1)]
    texts = {}
    for t, el, q in species:
        texts[t] = (el, q)
    tex_eq = "$" + sp_(a, qa0) + " + " + sp_(b, qb0) + " \\rightarrow " + sp_(a, qa1) + " + " + sp_(b, qb1) + "$ (coefficients omitted)"
    key = Opt(species[1][0], True, "The oxidizing agent is the species that is reduced: it gains electrons and its oxidation number decreases.", None)
    ds = [Opt(species[0][0], False, "Chooses the species that is oxidized, which is the reducing agent.", None), Opt(species[2][0], False, "Chooses the product of the oxidation instead of a reactant that is reduced.", None), Opt(species[3][0], False, "Chooses the product of the reduction instead of the reactant.", None)]
    if len({o.text for o in [key] + ds}) < 4:
        raise ValueError("dup")
    stem = f"A reaction occurs according to the following skeleton equation: {tex_eq}. Which species is the oxidizing agent?"
    return mk("ch_redox_agent", "4.9", "4.A", stem, key, ds, rng, concept="identify the oxidizing agent from changes in oxidation number", path="oxidation-number change signs vs electron bookkeeping (electrons lost equal electrons gained)",
              facts=[f"a={a}", f"qa={qa0}->{qa1}", f"b={b}", f"qb={qb0}->{qb1}"], judgment="decide which reactant is reduced", est=70)


# ======================= 4.3 반응식 균형 (5.E) =======================
def ch_balance_combustion(rng):
    for _ in forever():
        x = rng.randint(1, 6); y = pick(rng, [2 * x + 2, 2 * x, 2 * x - 2]) if True else 0
        if y < 2 or y % 2:
            continue
        break
    # sympy: x C + y H : a CxHy + b O2 -> c CO2 + d H2O ; a=1 -> b = x + y/4 ; 정수화
    a_, b_, c_, d_ = sp.symbols("a b c d")
    sol = sp.solve([x * a_ - c_, y * a_ - 2 * d_, 2 * b_ - 2 * c_ - d_, a_ - 1], [a_, b_, c_, d_])
    bq = sol[b_]
    den = sp.denom(bq)
    coef = tuple(int(sol[v] * den) for v in (a_, b_, c_, d_))
    # 독립 경로: 작은 정수 전수 탐색
    found = None
    for A in range(1, 13):
        for B in range(1, 40):
            for C in range(1, 40):
                for D in range(1, 40):
                    if x * A == C and y * A == 2 * D and 2 * B == 2 * C + D:
                        found = (A, B, C, D); break
                if found: break
            if found: break
        if found: break
    agree(1.0, 1.0 if found == coef else 0.0, 1e-9, "coef")
    key_v = float(coef[1])
    pairs = [("Leaves the coefficient of O2 as a fraction rounded without scaling the other coefficients.", float(bq) if bq.q == 1 else float(math.ceil(float(bq)))), ("Balances oxygen using only the CO2 oxygen atoms.", float(2 * x) / 2 * 2 if False else float(x)),
             ("Gives the sum of all coefficients instead of the O2 coefficient.", float(sum(coef))), ("Doubles the O2 coefficient without checking the hydrogens.", float(coef[1] * 2)), ("Uses the number of carbon atoms times two.", float(2 * x))]
    key, ds = abs_opts(key_v, pairs, lambda v: "$" + f"{int(v)}" + "$", 0.5)
    form = f"C{x if x > 1 else ''}H{y}"
    stem = f"The complete combustion of {cf(form)} produces carbon dioxide and water. When the equation is balanced with the smallest whole-number coefficients, what is the coefficient of {cf('O2')}?"
    return mk("ch_balance_combustion", "4.3", "5.E", stem, key, ds, rng, concept="coefficient of oxygen in a balanced combustion equation with whole-number coefficients", path="sympy linear system with scaling by the denominator vs brute-force search of small integers",
              facts=[f"x={x}", f"y={y}", f"coef={coef}"], judgment="balance C, H and O in order and clear fractions", est=80)


# ======================= 4.5 입자 모형 한계 반응물 (1.A) =======================
PART = [("N2", "H2", "NH3", 1, 3, 2), ("H2", "O2", "H2O", 2, 1, 2), ("H2", "Cl2", "HCl", 1, 1, 2), ("CO", "O2", "CO2", 2, 1, 2)]


@retry_sep
def ch_particulate_limiting(rng):
    fa, fb, fp, a, b, c = pick(rng, PART)
    for _ in forever():
        na_, nb_ = rng.randint(2, 7), rng.randint(2, 11)
        ea, eb = Fr(na_, a), Fr(nb_, b)
        if ea != eb:
            break
    ext = int(min(ea, eb))
    prod = c * ext
    # 독립 경로: 분자를 한 세트씩 소모하는 시뮬레이션
    A_, B_, P_ = na_, nb_, 0
    while A_ >= a and B_ >= b:
        A_ -= a; B_ -= b; P_ += c
    agree(prod, P_, 1e-9, "prod")
    pairs = [("Counts the molecules of the excess reactant that are left over.", float(A_ if ea > eb else B_)), ("Uses the number of molecules of the first reactant as the number of product molecules.", float(na_)), ("Ignores the product coefficient.", float(ext)), ("Adds all reactant molecules.", float(na_ + nb_))]
    key, ds = abs_opts(float(prod), pairs, lambda v: "$" + f"{int(v)}" + "$", 0.5)
    eq = rxn_tex([(a, fa), (b, fb)], [(c, fp)])
    scene = {"type": "particles", "box": [{"species": fa, "count": na_}, {"species": fb, "count": nb_}]}
    stim = diagram_stim_chem(f"A particulate diagram of a mixture before the reaction: {na_} molecules of {fa} and {nb_} molecules of {fb}.", "chem_particles", {"scene": scene})
    stem = f"The particulate diagram shows a reaction mixture before the reaction {eq} takes place. What is the maximum number of {cf(fp)} molecules that can form?"
    return mk("ch_particulate_limiting", "4.5", "1.A", stem, key, ds, rng, concept="limiting reagent and product count from a particulate diagram", stim=stim, material={"type": "diagram", "must_include": ["number of each reactant molecule"]},
              path="exact fraction extent minimum vs step-by-step molecule consumption", facts=[f"fa={fa}", f"fb={fb}", f"na={na_}", f"nb={nb_}", f"coefs={a},{b},{c}", f"prod={prod}"], judgment="count particles and apply the mole ratio of the balanced equation", est=90)


# ======================= 5.2 초기 속도법 (5.D) =======================
@retry_sep
def ch_rate_law_initial(rng):
    for _ in forever():
        m, n = rng.choice([(1, 1), (2, 1), (1, 0), (2, 0), (0, 1), (1, 2), (0, 2)]), None
        m, n = m
        k = pick(rng, [0.015, 0.025, 0.040, 0.12, 0.30, 1.5, 2.5])
        A0, B0 = pick(rng, [0.10, 0.20, 0.050]), pick(rng, [0.10, 0.20, 0.050])
        exps = [(A0, B0), (2 * A0, B0), (A0, 2 * B0)]
        rates = [k * a ** m * b ** n for a, b in exps]
        An, Bn = pick(rng, [0.30, 0.40, 0.60]), pick(rng, [0.30, 0.40, 0.60])
        # 독립 경로 1: 로그 비율 최소제곱
        X = np.array([[1, math.log(a), math.log(b)] for a, b in exps]); y = np.log(np.array(rates))
        coef = np.linalg.lstsq(X, y, rcond=None)[0]
        agree(coef[1], m, 1e-6, "m"); agree(coef[2], n, 1e-6, "n")
        # 독립 경로 2: 정수 차수 전수 탐색(첫 실험의 속도로 k 를 맞춰 나머지 실험 재현)
        hit = [(i, j) for i in range(3) for j in range(3) if all(abs(rates[0] / (exps[0][0] ** i * exps[0][1] ** j) * a ** i * b ** j - r) < 1e-9 * max(r, 1e-12) for (a, b), r in zip(exps, rates))]
        agree(1.0, 1.0 if hit == [(m, n)] else 0.0, 1e-9, "orders")
        key_v = k * An ** m * Bn ** n
        pairs = [("Assumes first order in each reactant regardless of the data.", k * An * Bn if (m, n) != (1, 1) else None), ("Swaps the orders of the two reactants.", k * An ** n * Bn ** m if (m, n) not in [(1, 1)] else None),
                 ("Assumes the rate is proportional only to A.", k * An), ("Assumes second order in each reactant.", k * An ** 2 * Bn ** 2)]
        pairs = [(w, v * ((rates[0] / (k * A0 ** m * B0 ** n)))) if v else (w, None) for w, v in pairs]
        if len({round(p[1], 12) for p in pairs if p[1]}) >= 3:
            break
    # 왜곡 방지: distractor 는 같은 k 를 쓰는 잘못된 차수
    key, ds = num_opts(key_v, pairs, "M/s", 3, fmt=lambda v: sci(v, "M/s"))
    rows = [[str(i + 1), f"{a:g}", f"{b:g}", f"{r:.3e}"] for i, ((a, b), r) in enumerate(zip(exps, rates))]
    stim = {"kind": "table", "description": "Initial rates for the reaction A + B → products", "data": {"x_label": "Experiment", "columns": ["Experiment", "[A] (M)", "[B] (M)", "Initial rate (M/s)"], "y_label": "Initial rate (M/s)", "rows": [[r[0], r[1], r[2], r[3]] for r in rows]}}
    stem = f"The table gives initial rate data for the reaction A + B → products at constant temperature. What is the initial rate, in M/s, for a mixture with $[\\mathrm{{A}}]={An:g}\\text{{ M}}$ and $[\\mathrm{{B}}]={Bn:g}\\text{{ M}}$?"
    return mk("ch_rate_law_initial", "5.2", "5.D", stem, key, ds, rng, concept="determine reaction orders from initial-rate data and predict a new rate", stim=stim, material={"type": "table", "must_include": ["three experiments", "initial rates"]},
              path="least-squares fit of ln(rate) on ln[A], ln[B] vs exhaustive search of integer orders reproducing all rates", facts=[f"k={k}", f"m={m}", f"n={n}", f"A0={A0}", f"B0={B0}", f"An={An}", f"Bn={Bn}", f"key={key_v:.6e}"], judgment="compare experiments that change one concentration at a time", est=120)


# ======================= 5.3 1차 반응 (5.F) =======================
@retry_sep
def ch_first_order_decay(rng):
    for _ in forever():
        k = pick(rng, [0.0050, 0.0100, 0.0200, 0.0350, 0.050]); A0 = pick(rng, [0.200, 0.400, 0.500, 0.800, 1.00]); t = pick(rng, [20.0, 30.0, 50.0, 60.0, 100.0, 120.0])
        At = A0 * math.exp(-k * t)
        # 독립 경로: RK4 로 d[A]/dt = -k[A] 적분
        num = float(rk4(lambda tt, y: np.array([-k * y[0]]), [A0], 0.0, t, 4000)[0])
        agree(At, num, 1e-8, "At")
        if 0.05 * A0 < At < 0.9 * A0:
            break
    pairs = [("Treats the reaction as zero order and subtracts kt.", A0 - k * t if A0 - k * t > 0 else None), ("Uses a growing exponential e^(+kt).", A0 * math.exp(k * t)), ("Multiplies the initial concentration by kt.", A0 * k * t), ("Uses the second-order integrated rate law.", A0 / (1 + k * t * A0))]
    key, ds = num_opts(At, pairs, "M")
    stem = f"The decomposition of a reactant A is first order with a rate constant $k={k:g}\\text{{ s}}^{{-1}}$. If the initial concentration is ${A0:g}\\text{{ M}}$, what is the concentration of A after ${t:g}\\text{{ s}}$?"
    return mk("ch_first_order_decay", "5.3", "5.F", stem, key, ds, rng, concept="first-order integrated rate law for the concentration after a given time", path="closed-form ln[A]t - ln[A]0 = -kt vs RK4 integration of d[A]/dt = -k[A]",
              facts=[f"k={k}", f"A0={A0}", f"t={t}", f"At={At:.6f}"], judgment="select the first-order integrated law and apply the exponential form", est=80)


# ======================= 5.3 선형 그래프와 차수 (5.D) =======================
def ch_order_plot(rng):
    for _ in forever():
        order = pick(rng, [0, 1, 2]); A0 = pick(rng, [0.800, 1.00, 0.500]); ts = [0, 20, 40, 60, 80, 100]
        k = {0: pick(rng, [0.0030, 0.0040]), 1: pick(rng, [0.0090, 0.0120, 0.015]), 2: pick(rng, [0.0300, 0.0500, 0.080])}[order]
        f = {0: lambda t: A0 - k * t, 1: lambda t: A0 * math.exp(-k * t), 2: lambda t: 1 / (1 / A0 + k * t)}[order]
        As = [round(f(t), 4) for t in ts]
        if all(a > 0.02 for a in As):
            break
    tr = {0: lambda a: a, 1: lambda a: math.log(a), 2: lambda a: 1 / a}
    r2 = {}; slope = {}
    for o in (0, 1, 2):
        ys = [tr[o](a) for a in As]
        s, b = np.polyfit(ts, ys, 1); res = np.array(ys) - (s * np.array(ts) + b)
        r2[o] = 1 - float(res @ res) / float(np.var(ys) * len(ys)); slope[o] = s
    best = max(r2, key=r2.get)
    agree(1.0, 1.0 if best == order else 0.0, 1e-9, "order")
    kk = {o: abs(slope[o]) for o in (0, 1, 2)}
    unit = {0: "M/s", 1: "s^{-1}", 2: "M^{-1}s^{-1}"}
    name = {0: "zero", 1: "first", 2: "second"}
    fmt = lambda o: f"The reaction is {name[o]} order, with $k\\approx {kk[o]:.3g}\\text{{ }}{unit[o].replace('^{-1}', '^{-1}')}$." if o != 2 else f"The reaction is second order, with $k\\approx {kk[o]:.3g}\\text{{ M}}^{{-1}}\\text{{s}}^{{-1}}$."
    fmt = lambda o: ("The reaction is " + name[o] + " order, with $k\\approx " + f"{kk[o]:.3g}" + {0: "\\text{ M/s}", 1: "\\text{ s}^{-1}", 2: "\\text{ M}^{-1}\\text{s}^{-1}"}[o] + "$.")
    key = Opt(fmt(order), True, "The linearized plot with the best straight line identifies the order, and its slope magnitude gives k.", None)
    ds = [Opt(fmt(o), False, f"Fits the {name[o]}-order plot, which is visibly curved for these data.", None) for o in (0, 1, 2) if o != order]
    # 네 번째 선지: 올바른 차수에 잘못된 k(기울기 부호/배수)
    ds.append(Opt("The reaction is " + name[order] + " order, with $k\\approx " + f"{kk[order] * 2:.3g}" + {0: "\\text{ M/s}", 1: "\\text{ s}^{-1}", 2: "\\text{ M}^{-1}\\text{s}^{-1}"}[order] + "$.", False, "Gives the right order but doubles the slope (confuses k with a rate-law coefficient).", None))
    rows = [[str(t), f"{a:.4f}"] for t, a in zip(ts, As)]
    stim = table_stimulus("Concentration of A over time at constant temperature", "Time (s)", rows, "[A] (M)")
    stem = "The table gives the concentration of reactant A as a function of time for a reaction that occurs in a single step with only A as a reactant. Which statement correctly gives the order of the reaction and the rate constant?"
    return mk("ch_order_plot", "5.3", "5.D", stem, key, ds, rng, concept="reaction order and rate constant from the linearity of concentration-time data", stim=stim, material={"type": "table", "must_include": ["time", "[A]"]},
              path="the generating order and rate constant vs least-squares R^2 of the three linearized plots (the best fit recovers the order)", facts=[f"order={order}", f"k={k}", f"A0={A0}", f"slope={abs(slope[order]):.6g}"], judgment="linearize the data three ways and pick the plot that is straight", est=130)


# ======================= 5.6 반응 에너지 곡선 (5.D) =======================
@retry_sep
def ch_energy_profile(rng):
    for _ in forever():
        ER = pick(rng, [20, 30, 40, 50]); ET = ER + pick(rng, [40, 50, 60, 75, 90]); EP = pick(rng, [0, 10, 20, 60, 80, 100, 120])
        if EP != ER and ET > max(ER, EP) + 15 and abs(EP - ER) >= 20:
            break
    def E(x):
        return ER + (ET - ER) * (1 - math.cos(math.pi * x)) / 2 if x <= 1 else ET + (EP - ET) * (1 - math.cos(math.pi * (x - 1))) / 2
    xs = np.linspace(0, 2, 401); ys = np.array([E(x) for x in xs])
    num_ea = ys.max() - ys[0]; num_dh = ys[-1] - ys[0]; num_rev = ys.max() - ys[-1]
    agree(num_ea, ET - ER, 1e-6, "Ea"); agree(num_rev, ET - EP, 1e-6, "Ea_rev")
    ask = pick(rng, ["rev", "dh", "fwd"])
    key_v = {"rev": ET - EP, "dh": EP - ER, "fwd": ET - ER}[ask]
    pairs = [("Reads the activation energy of the forward reaction.", ET - ER), ("Reads the activation energy of the reverse reaction.", ET - EP), ("Reverses the sign of the enthalpy change.", -(EP - ER)), ("Reads the height of the transition state above zero energy.", ET),
             ("Reads the enthalpy change magnitude as the peak height above the products.", ET - EP + (EP - ER) if False else EP), ("Uses the difference between the product and zero.", EP)]
    if ask == "dh":
        key, ds = signed_opts(float(key_v), pairs, fmt=lambda v: "$" + f"{v:+.0f}" + "\\text{ kJ/mol}$")
    else:
        key, ds = num_opts(float(key_v), pairs, "kJ/mol", 3, fmt=lambda v: "$" + f"{v:.0f}" + "\\text{ kJ/mol}$")
    stim = graph_stim("Potential energy diagram for a one-step reaction", [("Energy", [[round(float(x), 3), round(float(y), 2)] for x, y in zip(xs[::8], ys[::8])])], gaxis("Reaction coordinate", 0, 2, 0.5), gaxis("Energy (kJ/mol)", 0, round(ET * 1.2 / 20) * 20 + 20, 20))
    q = {"rev": "the activation energy of the reverse reaction", "dh": "the enthalpy change, $\\Delta H$, of the forward reaction", "fwd": "the activation energy of the forward reaction"}[ask]
    stem = f"The potential energy diagram for a one-step reaction is shown. What is {q}, in kJ/mol?"
    return mk("ch_energy_profile", "5.6", "5.D", stem, key, ds, rng, concept="activation energies and enthalpy change read from a reaction energy diagram", stim=stim, material={"type": "graph", "must_include": ["reactant energy", "transition state", "product energy"]},
              path="analytic heights from the generating energies vs numeric max and endpoints of the dense curve", facts=[f"ER={ER}", f"ET={ET}", f"EP={EP}", f"ask={ask}", f"key={key_v}"], judgment="read differences between levels rather than absolute heights", est=80)


# ======================= 5.8 메커니즘과 속도식 (4.B) =======================
MECH = {  # 이름: (단계 [(텍스트, 속도)], 속도식 지수 {종})
    "a": ([("2NO \\rightleftharpoons N_2O_2", "fast"), ("N_2O_2 + O_2 \\rightarrow 2NO_2", "slow")], {"NO": 2, "O2": 1}),
    "b": ([("NO + O_2 \\rightleftharpoons NO_3", "fast"), ("NO_3 + NO \\rightarrow 2NO_2", "slow")], {"NO": 2, "O2": 1}),
    "c": ([("2NO \\rightarrow N_2O_2", "slow"), ("N_2O_2 + O_2 \\rightarrow 2NO_2", "fast")], {"NO": 2}),
    "d": ([("NO + O_2 \\rightarrow NO_3", "slow"), ("NO_3 + NO \\rightarrow 2NO_2", "fast")], {"NO": 1, "O2": 1}),
    "f": ([("O_2 \\rightarrow 2O", "slow"), ("2O + 2NO \\rightarrow 2NO_2", "fast")], {"O2": 1}),
}


def _derive(name):
    """느린 단계의 속도식에서 중간체를 앞선 빠른 평형(K)으로 치환해 지수를 구한다(sympy)."""
    NO, O2, N2O2, NO3 = sp.symbols("NO O2 N2O2 NO3", positive=True)
    if name == "a":
        K = sp.Symbol("K"); inter = {N2O2: K * NO ** 2}; rate = N2O2 * O2
    elif name == "b":
        K = sp.Symbol("K"); inter = {NO3: K * NO * O2}; rate = NO3 * NO
    elif name == "c":
        inter = {}; rate = NO ** 2
    elif name == "d":
        inter = {}; rate = NO * O2
    else:
        inter = {}; rate = O2
    rate = rate.subs(inter)
    poly = sp.Poly(rate / sp.Symbol("K") if rate.has(sp.Symbol("K")) else rate, NO, O2)
    return {"NO": sp.degree(sp.expand(rate), NO) if rate.has(NO) else 0, "O2": sp.degree(sp.expand(rate), O2) if rate.has(O2) else 0}


def ch_mechanism_consistent(rng):
    obs = pick(rng, ["a", "c", "d", "f"])
    exps = {k: v for k, v in MECH[obs][1].items()}
    for n in MECH:
        d = {k: v for k, v in _derive(n).items() if v}
        agree(1.0, 1.0 if d == MECH[n][1] else 0.0, 1e-9, "mech_" + n)
    # 관측 속도식과 일치하는 기구는 정확히 1개만 제시
    same = [n for n in MECH if MECH[n][1] == exps]
    key_n = rng.choice(same)
    others = [n for n in MECH if MECH[n][1] != exps]
    shown = [key_n] + rng.sample(others, 3)
    law = " ".join(f"[\\mathrm{{{s if s == 'NO' else 'O_2'}}}]" + (f"^{e}" if e > 1 else "") for s, e in sorted(exps.items()))
    def show(n):
        return "$" + ";\\ ".join(f"\\text{{Step {i + 1} ({sp_}): }}" + t for i, (t, sp_) in enumerate(MECH[n][0])) + "$"
    texts = {n: show(n) for n in shown}
    key = Opt(texts[key_n], True, "A slow step (with any intermediate replaced through the fast equilibrium) gives a rate law that matches the observed one.", None)
    ds = [Opt(texts[n], False, "The rate law derived from this mechanism does not match the observed rate law.", None) for n in shown if n != key_n]
    stem = f"The overall reaction $2\\,\\mathrm{{NO}} + \\mathrm{{O_2}} \\rightarrow 2\\,\\mathrm{{NO_2}}$ has the experimentally determined rate law $\\text{{rate}} = k{law}$. Which mechanism is consistent with the observed rate law?"
    return mk("ch_mechanism_consistent", "5.8", "4.B", stem, key, ds, rng, concept="rate law implied by a mechanism with a slow step or a fast pre-equilibrium compared with the observed rate law", path="sympy substitution of the intermediate from the fast equilibrium vs a hand-built table of expected exponents",
              facts=[f"obs={obs}", f"key={key_n}", f"shown={shown}"], judgment="derive a rate law from each mechanism and compare with experiment", est=140)
