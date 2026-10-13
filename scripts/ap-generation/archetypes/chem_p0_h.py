"""AP Chemistry P0 원형 H — 표현·모델 분석 스킬 보강(Practice 1: 1.A/1.B, Practice 4: 4.A–4.D). 2026-10-13: 스킬 범위 검사(chem_coverage.py)가 P1·P4 가 공식 MC 범위를 못 채우는 것을 잡아 추가했다.
정답은 코드(정확 분수·표·규칙)로 계산하고 독립 경로로 재계산한다."""
from chem_common import *  # noqa: F401,F403
from common import Opt
import itertools
import chem_p0_a as _A
import chem_p0_f as _F

IE1 = {"Li": 520, "Be": 900, "B": 801, "C": 1086, "N": 1402, "O": 1314, "F": 1681, "Ne": 2081, "Na": 496, "Mg": 738, "Al": 578, "Si": 786, "P": 1012, "S": 1000, "Cl": 1251, "Ar": 1521, "K": 419}
PER = {"Li": (2, 1), "Be": (2, 2), "B": (2, 13), "C": (2, 14), "N": (2, 15), "O": (2, 16), "F": (2, 17), "Ne": (2, 18), "Na": (3, 1), "Mg": (3, 2), "Al": (3, 13), "Si": (3, 14), "P": (3, 15), "S": (3, 16), "Cl": (3, 17), "Ar": (3, 18), "K": (4, 1)}
EXC = [{"Be", "B"}, {"N", "O"}, {"Mg", "Al"}, {"P", "S"}]


# ======================= 1.7 첫 번째 이온화 에너지 경향 (4.A) =======================
def ch_ie_trend(rng):
    for _ in forever():
        per = pick(rng, [2, 3]); pool = [e for e in PER if PER[e][0] == per]
        els = rng.sample(pool, 4)
        if any(pair <= set(els) for pair in EXC):
            continue
        k = max(els, key=lambda e: IE1[e]); r = max(els, key=lambda e: PER[e][1])
        if k == r and sorted(IE1[e] for e in els)[-1] - sorted(IE1[e] for e in els)[-2] > 80:
            break
    ZZ = {"Li": 3, "Be": 4, "B": 5, "C": 6, "N": 7, "O": 8, "F": 9, "Ne": 10, "Na": 11, "Mg": 12, "Al": 13, "Si": 14, "P": 15, "S": 16, "Cl": 17, "Ar": 18, "K": 19}
    ds = [Opt(cf(e), False, f"{e} (Z = {ZZ[e]}) has {ZZ[k] - ZZ[e]} fewer proton{'s' if ZZ[k] - ZZ[e] != 1 else ''} than {k} (Z = {ZZ[k]}) in the same period with a similar number of inner electrons, so its outer electron feels a smaller effective nuclear charge and is removed more easily ({IE1[e]} versus {IE1[k]} kJ/mol).", None) for e in els if e != k]
    key = Opt(cf(k), True, f"Across period {per} the effective nuclear charge increases from left to right, so the outer electron of {k} (group {PER[k][1]}, first ionization energy about {IE1[k]} kJ/mol) is held most tightly.", None)
    stem = "Which of the following elements has the greatest first ionization energy?"
    return mk("ch_ie_trend", "1.7", "4.A", stem, key, ds, rng, concept="predict the element with the greatest first ionization energy from periodic trends", path="tabulated ionization energies vs the rule that the highest group in the same period wins (no exception pair present)", facts=[f"els={els}", f"key={k}"], judgment="apply the trend across a period without an exception pair", est=55)


# ======================= 1.2 질량 스펙트럼 봉우리 (1.A) =======================
def ch_mass_spec_peaks(rng):
    niso = pick(rng, [2, 3]); m0 = pick(rng, [35, 79, 63, 24])
    masses = [m0 + 2 * i if niso == 2 else m0 + i for i in range(niso)]
    sums = sorted({a + b for a, b in itertools.combinations_with_replacement(masses, 2)})
    agree(len(sums), 2 * niso - 1, 1e-9, "peaks")
    pairs = [("Counts the number of isotopes, not the combinations of two atoms.", float(niso)), ("Counts every ordered pair of isotopes as a different peak.", float(niso * niso)), ("Counts only the pairs of two different isotopes.", float(niso * (niso - 1) // 2 + 0)), ("Adds one for the single atom peak.", float(2 * niso))]
    key, ds = abs_opts(float(len(sums)), pairs, lambda v: "$" + f"{int(v)}" + "$", 0.5)
    rows = [[str(m), "x"] for m in masses]
    stim = table_stimulus("Naturally occurring isotopes of element X", "Mass of isotope (amu)", [[str(m), "present"] for m in masses], "Present in the sample")
    stem = f"The table lists the {niso} naturally occurring isotopes of element X (masses " + ", ".join(f"{m}" for m in masses) + " amu). A sample of the diatomic gas $\\mathrm{X_2}$ is analyzed with a mass spectrometer that detects intact $\\mathrm{X_2}^+$ ions. How many peaks with different mass-to-charge ratios are expected?"
    return mk("ch_mass_spec_peaks", "1.2", "1.A", stem, key, ds, rng, concept="number of molecular-ion peaks for a diatomic element with several isotopes", stim=stim, material={"type": "table", "must_include": ["isotope masses"]}, path="distinct sums of every isotope pair from itertools vs the formula 2n - 1 for evenly spaced masses", facts=[f"masses={masses}", f"peaks={len(sums)}"], judgment="enumerate which isotope pairs make which ion masses", est=75,
              kwhy=f"An X₂ molecule can contain any pair of isotopes, so its mass is the sum of two isotope masses: {', '.join(str(v) for v in sums)} amu. These {len(sums)} different sums give {len(sums)} peaks.")


# ======================= 1.6 PES 부껍질 읽기 (1.A) =======================
def ch_pes_subshell(rng):
    for _ in forever():
        z = rng.randint(7, 17); peaks = _A._pes_peaks(z); es = [p[0] for p in peaks]
        if all(es[i] > es[i + 1] * 1.08 for i in range(len(es) - 1)) and len(peaks) >= 4:
            break
    idx = rng.randrange(1, len(peaks))
    lab = peaks[idx][2]
    cfg = _A._config(z); labs = [f"{n}{l}" for n, l, k in cfg]
    agree(1.0, 1.0 if labs[idx] == lab else 0.0, 1e-9, "label")
    pool = [f"{n}{l}" for n, l, _ in _A.SUBSHELLS]
    key = Opt(cf(lab), True, f"Peaks run from the highest binding energy (1s) to the lowest in the order the subshells fill; counting from the highest binding energy, peak number {idx + 1} of this atom is {lab}.", None)
    occ = [Opt(cf(l), False, f"{l} is occupied in this atom, but the peak for {l} is number {labs.index(l) + 1} counting from the highest binding energy, not number {idx + 1}.", None) for l in labs if l != lab]
    unocc = [Opt(cf(l), False, f"{l} is not occupied in this atom, so the spectrum has no peak for it.", None) for l in pool if l != lab and l not in labs]
    ds = (occ[:2] + unocc[:1] + occ[2:] + unocc[1:])[:3]
    stim = {"kind": "diagram", "description": "Photoelectron spectrum of a neutral atom. Peaks (binding energy in MJ/mol, relative number of electrons): " + "; ".join(f"({e:g}, {k})" for e, k, _ in peaks) + ".", "data": {"variant": "chem_pes", "peaks": [{"energy": e, "electrons": k} for e, k, _ in peaks], "unit": "MJ/mol"}}
    order = ["highest", "second-highest", "third-highest", "fourth-highest", "fifth-highest", "sixth-highest"]
    stem = f"The photoelectron spectrum of a neutral atom of an element in period 2 or 3 is shown. To which subshell does the peak with the {order[idx]} binding energy correspond?"
    return mk("ch_pes_subshell", "1.6", "1.A", stem, key, ds, rng, concept="assign a peak in a photoelectron spectrum to a subshell", stim=stim, material={"type": "diagram", "must_include": ["peak energies", "relative heights"]}, path="peak labels from the shell-model energy ordering vs the occupied-subshell list in filling order", facts=[f"z={z}", f"idx={idx}", f"label={lab}"], judgment="order the peaks by binding energy and match them with the filling order", est=75)


# ======================= 2.5 Lewis 구조의 비공유 전자쌍 (1.A) =======================
LEW = [("H2O", 8, 2), ("NH3", 8, 3), ("CO2", 16, 4), ("HCN", 10, 4), ("CH2O", 12, 4), ("N2", 10, 3), ("O2", 12, 2), ("CH3OH", 14, 5), ("C2H4", 12, 6), ("Cl2", 14, 1), ("HF", 8, 1), ("CH3F", 14, 4)]


LEWIS_PAIRS = {"H2O": (8, 2, 2), "NH3": (8, 3, 1), "CO2": (16, 4, 4), "HCN": (10, 4, 1), "CH2O": (12, 4, 2), "N2": (10, 3, 2), "O2": (12, 2, 4), "CH3OH": (14, 5, 2), "Cl2": (14, 1, 6), "HF": (8, 1, 3), "CH3F": (14, 4, 3), "C2H4": (12, 6, 0)}  # (원자가 전자 총수, 결합쌍 수, 비공유 쌍 수)


def ch_lewis_lone_pairs(rng):
    f = pick(rng, sorted(LEWIS_PAIRS)); ve, bonds, lp = LEWIS_PAIRS[f]
    agree(lp, (ve - 2 * bonds) // 2, 1e-9, "lp")
    pairs = [("Reports the number of bonding pairs (shared pairs) in the diagram instead of the lone pairs.", float(bonds)), ("Counts the lone-pair electrons rather than the lone pairs.", float(2 * lp)),
             ("Divides all the valence electrons by 2 and counts every pair as a lone pair, forgetting that bonds use pairs.", float(ve // 2)), ("Subtracts only one electron per bond instead of two before dividing by 2.", float((ve - bonds) // 2))]
    key, ds = abs_opts(float(lp), pairs, lambda v: "$" + f"{int(v)}" + "$", 0.5)
    stem = f"How many lone pairs of electrons are shown in a correct Lewis electron-dot diagram of {cf(f)}? (Count the lone pairs on every atom.)"
    return mk("ch_lewis_lone_pairs", "2.5", "1.A", stem, key, ds, rng, concept="number of lone pairs in the Lewis diagram of a molecule", path="(valence electrons - 2 x bonding pairs)/2 vs a tabulated structure with explicit lone pairs", facts=[f"species={f}", f"valence={ve}", f"bonds={bonds}", f"lp={lp}"], judgment="draw the diagram from the total valence electrons and count the pairs not used in bonds", est=75,
              kwhy=f"{f} has {ve} valence electrons in total. Its Lewis diagram has {bonds} bonding pairs (each bond uses 2 electrons, so {2 * bonds} electrons), and the remaining {ve - 2 * bonds} electrons form {lp} lone pair{'s' if lp != 1 else ''}.")


# ======================= 2.3 단위 격자 구성비 (1.A) =======================
POS = {"corner": Fr(1, 8), "face": Fr(1, 2), "edge": Fr(1, 4), "body": Fr(1, 1)}
CELLS = [({"corner": 8, "face": 6}, {"edge": 12, "body": 1}), ({"corner": 8}, {"body": 1}), ({"corner": 8, "face": 6}, {"inside": 8}), ({"corner": 8}, {"face": 6}), ({"body": 1}, {"edge": 12}), ({"edge": 12, "body": 1}, {"corner": 8, "face": 6})]


def ch_unit_cell_ratio(rng):
    cats, ans = pick(rng, CELLS)
    cnt = lambda d: sum((POS.get(k, Fr(1)) * v) for k, v in d.items())
    nc, na = cnt(cats), cnt(ans)
    g = sp.gcd(sp.Rational(nc.numerator * na.denominator), sp.Rational(na.numerator * nc.denominator))
    a_, b_ = nc.numerator * na.denominator, na.numerator * nc.denominator
    gg = math.gcd(a_, b_); x, y = a_ // gg, b_ // gg
    agree(float(nc / na), x / y, 1e-9, "ratio")
    fm = lambda x_, y_: "XY" if (x_, y_) == (1, 1) else ("XY" + (f"_{{{y_}}}" if y_ > 1 else "") if x_ == 1 else f"X_{{{x_}}}Y" + (f"_{{{y_}}}" if y_ > 1 else ""))
    key_f = fm(x, y)
    raw = (sum(cats.values()), sum(ans.values()))
    cand = [("Counts every ion position as a whole ion, ignoring that corner, face, and edge ions are shared.", fm(*(lambda g_: (raw[0] // g_, raw[1] // g_))(math.gcd(*raw)))), ("Inverts the ratio of cations to anions.", fm(y, x)), ("Doubles the number of anions counted in the cell.", fm(*(lambda p: (p[0] // math.gcd(*p), p[1] // math.gcd(*p)))((x, 2 * y)))), ("Uses a 2 to 1 ratio for any unit cell with a body-centered ion.", fm(2, 1))]
    ds, seen = [], {key_f}
    for w, t in cand:
        if t not in seen:
            seen.add(t); ds.append(Opt("$\\mathrm{" + t + "}$", False, w, None))
    for t in ["XY", "XY_{2}", "XY_{3}", "X_{2}Y", "X_{3}Y"]:
        if len(ds) >= 3:
            break
        if t not in seen:
            seen.add(t); ds.append(Opt("$\\mathrm{" + t + "}$", False, f"The ratio of X to Y found by counting the shared positions is {x}:{y} ({nc} X : {na} Y per cell), which does not give {t.replace('_', '').replace('{', '').replace('}', '')}.", None))
    key = Opt("$\\mathrm{" + key_f + "}$", True, f"Ions on corners, faces, and edges are shared by neighboring cells, so each counts as a fraction: X contributes {nc} ion(s) and Y contributes {na} ion(s) per cell, a ratio of {x}:{y}.", None)
    desc = lambda d: ", ".join(f"{v} at the {'corners' if k == 'corner' else 'face centers' if k == 'face' else 'edge centers' if k == 'edge' else 'center of the cell' if k == 'body' else 'interior sites (entirely inside the cell)'}" for k, v in d.items())
    stem = f"In the unit cell of an ionic solid, the X ions are located as follows: {desc(cats)}. The Y ions are located as follows: {desc(ans)}. (An ion at a corner is shared by 8 cells, at a face center by 2 cells, and at an edge center by 4 cells.) What is the empirical formula of the compound?"
    return mk("ch_unit_cell_ratio", "2.3", "1.A", stem, key, ds[:3], rng, concept="empirical formula of an ionic solid from shared positions in a unit cell", path="exact fractions of each ion per cell reduced to a ratio vs the raw position counts shown as the wrong reading", facts=[f"cats={cats}", f"ans={ans}", f"ratio={x}:{y}"], judgment="weigh each ion by the fraction of it that belongs to one cell", est=100)


# ======================= 3.8 입자 그림과 화학식 (1.A) =======================
SALTS = {"NaCl": (("Na+", 1), ("Cl-", 1)), "CaCl2": (("Ca2+", 1), ("Cl-", 2)), "Na2SO4": (("Na+", 2), ("SO42-", 1)), "AlCl3": (("Al3+", 1), ("Cl-", 3)), "MgO": (("Mg2+", 1), ("O2-", 1)), "K3PO4": (("K+", 3), ("PO43-", 1))}


def ch_particle_solution_formula(rng):
    f = pick(rng, [k for k in SALTS if k not in ("NaCl", "MgO")]); (c, nc), (a, na) = SALTS[f]
    mult = pick(rng, [1, 2, 3])
    box = [{"species": c, "count": nc * mult}, {"species": a, "count": na * mult}, {"species": "H2O", "count": 0}]
    # 독립 경로: 전하 중성 — 양이온 전하 합 = 음이온 전하 합
    qc = int(re.sub(r"\D", "", c) or 1); qa = int(re.sub(r"\D", "", a.split("-")[0][-1:]) or 1) if False else {"Cl-": 1, "SO42-": 2, "O2-": 2, "PO43-": 3}[a]
    agree(nc * mult * qc, na * mult * qa, 1e-9, "neutral")
    others = [k for k in SALTS if k != f]
    ds = [Opt(cf(k), False, f"{k} contains {SALTS[k][0][1]} {SALTS[k][0][0]} to {SALTS[k][1][1]} {SALTS[k][1][0]} per formula unit" + (", not the ions shown in the diagram." if SALTS[k][0][0] != c or SALTS[k][1][0] != a else ", which is a ratio the diagram does not show."), None) for k in others[:5]]
    ds = [d for d in ds][:3]
    key = Opt(cf(f), True, f"The diagram shows {nc * mult} {c} ions and {na * mult} {a} ions, a {nc}:{na} ratio; {f} has this ratio, and the charges balance ({nc * mult * qc}+ and {na * mult * qa}−).", None)
    ion = lambda s: s
    stim = diagram_stim_chem("A particulate diagram of an aqueous solution of an ionic compound (water molecules not shown): " + f"{nc * mult} {c} ions and {na * mult} {a} ions.", "chem_particles", {"scene": {"type": "particles", "box": box[:2]}})
    stem = "The particulate diagram represents an aqueous solution of an ionic compound (the water molecules are not shown). Which compound could have been dissolved to make the solution?"
    return mk("ch_particle_solution_formula", "3.8", "1.A", stem, key, ds, rng, concept="identify a dissolved ionic compound from the ratio of ions in a particulate diagram", stim=stim, material={"type": "diagram", "must_include": ["number of each ion"]}, path="ion ratio compared with each formula vs charge neutrality of the counts shown", facts=[f"f={f}", f"c={c}", f"a={a}", f"mult={mult}"], judgment="read the ion counts and match them to a formula that is electrically neutral", est=75)


# ======================= 3.7 용해도와 극성 (4.A) =======================
SOLUB = {"methanol": (100.0, "P"), "ethanol": (100.0, "P"), "acetone": (100.0, "P"), "glucose": (90.0, "P"), "sodium chloride": (36.0, "P"), "hexane": (0.001, "N"), "carbon tetrachloride": (0.08, "N"), "toluene": (0.05, "N"), "cyclohexane": (0.006, "N")}


def ch_miscibility(rng):
    for _ in forever():
        k = pick(rng, [n for n in SOLUB if SOLUB[n][1] == "P"]); others = rng.sample([n for n in SOLUB if SOLUB[n][1] == "N"], 3)
        break
    agree(1.0, 1.0 if SOLUB[k][0] > max(SOLUB[o][0] for o in others) and SOLUB[k][1] == "P" else 0.0, 1e-9, "sol")
    ds = [Opt(o, False, f"{o} is nonpolar, so it has only weak dispersion attractions to water and cannot replace the strong hydrogen bonding among water molecules; its solubility is only about {SOLUB[o][0]:g} g per 100 mL.", None) for o in others]
    key = Opt(k, True, f"{k} is polar (or ionic) and can form hydrogen-bonding or ion-dipole attractions with water molecules, so it is highly soluble (about {SOLUB[k][0]:g} g per 100 mL).", None)
    stem = "Which of the following is expected to be the most soluble in water at $25^\\circ\\text{C}$?"
    return mk("ch_miscibility", "3.7", "4.A", stem, key, ds, rng, concept="predict relative solubility in water from molecular polarity and the attractions with water", path="tabulated solubilities vs the polar/nonpolar rule; the polar substance is the unique maximum", facts=[f"key={k}", f"others={others}"], judgment="relate polarity and hydrogen bonding to dissolving", est=55)


# ======================= 3.3 증기압 곡선 (4.C) =======================
def ch_vapor_pressure_graph(rng):
    for _ in forever():
        TbX, HX = pick(rng, [(308.0, 28.0), (329.0, 29.0), (351.0, 38.6), (373.0, 40.7)]), None
        (TbX, HX) = TbX
        (TbY, HY) = pick(rng, [(308.0, 28.0), (329.0, 29.0), (351.0, 38.6), (373.0, 40.7), (400.0, 42.0)])
        if TbX != TbY and abs(TbX - TbY) >= 20:
            break
    Pat = 101.3
    P = lambda T, Tb, H: Pat * math.exp(H * 1000 / R_J * (1 / Tb - 1 / T))
    Ts = list(range(280, 381, 10))
    vx = [round(P(T, TbX, HX), 2) for T in Ts]; vy = [round(P(T, TbY, HY), 2) for T in Ts]
    T0 = 320.0
    ymax = max(100, math.ceil(max(vx + vy) / 100) * 100)
    weaker = "X" if P(T0, TbX, HX) > P(T0, TbY, HY) else "Y"
    agree(1.0, 1.0 if (weaker == "X") == (TbX < TbY) else 0.0, 1e-9, "weak")
    stronger = "Y" if weaker == "X" else "X"
    key_t = f"Liquid {weaker} has the weaker intermolecular forces, because it has the higher vapor pressure at a given temperature and the lower normal boiling point."
    wrongs = [(f"Liquid {stronger} has the weaker intermolecular forces, because it has the higher vapor pressure at a given temperature and the lower normal boiling point.", "Reads the curves in the wrong order."),
              (f"Liquid {weaker} has the stronger intermolecular forces, because it has the higher vapor pressure at a given temperature.", "Believes a higher vapor pressure means stronger attractions."),
              (f"Liquid {stronger} has the weaker intermolecular forces, because its vapor pressure curve starts lower.", "Treats a lower vapor pressure as weaker attractions.")]
    k, ds = sentence_options(key_t, "Easier escape from the liquid means a higher vapor pressure at the same temperature.", wrongs)
    stim = graph_stim("Vapor pressure versus temperature for liquids X and Y", [("X", [[T, v] for T, v in zip(Ts, vx)]), ("Y", [[T, v] for T, v in zip(Ts, vy)])], gaxis("Temperature (K)", 280, 380, 20), gaxis("Vapor pressure (kPa)", 0, ymax, ymax / 4))
    stem = "The graph shows the vapor pressure of two liquids, X and Y, as a function of temperature. Which statement about the liquids is correct?"
    return mk("ch_vapor_pressure_graph", "3.3", "4.C", stem, k, ds, rng, concept="connect vapor pressure curves to the strength of intermolecular forces", stim=stim, material={"type": "graph", "must_include": ["two curves", "vapor pressure at one temperature"]}, path="Clausius-Clapeyron values at 320 K for both liquids vs the order of the normal boiling points", facts=[f"TbX={TbX}", f"HX={HX}", f"TbY={TbY}", f"HY={HY}", f"weaker={weaker}"], judgment="compare two curves at one temperature and connect to forces", est=85)


# ======================= 3.1 점성과 -OH 기 수 (4.C) =======================
VISC = {"hexane": (0.30, 0), "ethanol": (1.07, 1), "water": (0.89, 2), "ethylene glycol": (16.1, 2), "glycerol": (934.0, 3), "acetone": (0.31, 0), "methanol": (0.54, 1)}


def ch_viscosity_trend(rng):
    for _ in forever():
        names = rng.sample(sorted(VISC), 4)
        k = max(names, key=lambda n: VISC[n][0]); kk = sorted(names, key=lambda n: -VISC[n][0])
        oh = max(names, key=lambda n: (VISC[n][1], formula_mass_proxy(n)))
        if k == oh and VISC[kk[0]][0] > 5 * VISC[kk[1]][0]:
            break
    ds = [Opt(n, False, f"{n} has {VISC[n][1]} –OH group{'s' if VISC[n][1] != 1 else ''} per molecule, " + (f"fewer than the {VISC[k][1]} of {k}, so its molecules attract each other less strongly and it flows more easily." if VISC[n][1] < VISC[k][1] else f"the same number as {k} but a smaller molecule, so its attractions between molecules are weaker."), None) for n in names if n != k]
    key = Opt(k, True, f"{k} has {VISC[k][1]} –OH group{'s' if VISC[k][1] != 1 else ''} per molecule, the most of the four, so more hydrogen bonds form between molecules and the liquid flows less easily.", None)
    stem = "Which of the following liquids is expected to have the highest viscosity at $25^\\circ\\text{C}$, based on its molecular structure?"
    return mk("ch_viscosity_trend", "3.1", "4.C", stem, key, ds, rng, concept="relate hydrogen-bonding groups to the viscosity of a liquid", path="measured viscosities vs the count of -OH groups (ties broken by molecular size); the same liquid wins", facts=[f"names={names}", f"key={k}"], judgment="connect the number of hydrogen-bonding sites to a macroscopic flow property", est=60)


def formula_mass_proxy(n):
    return {"glycerol": 92, "ethylene glycol": 62, "water": 18, "ethanol": 46, "methanol": 32, "hexane": 86, "acetone": 58}[n]


# ======================= 3.2 모형 평가와 전도도 (4.D) =======================
def ch_model_conductivity(rng):
    t = pick(rng, ["ionic", "metallic", "molecular", "network covalent"]); d = _F.SOLID[t]
    cons = d["cs"] == "does not conduct" and d["cl"] == "conducts"
    rows = [["Electrical conductivity as a solid", d["cs"]], ["Electrical conductivity as a liquid", d["cl"]]]
    stim = table_stimulus("Conductivity of solid X", "Property", rows, "Observation")
    agree(1.0, 1.0 if cons == (t == "ionic") else 0.0, 1e-9, "model")
    if cons:
        key_t = "The model is consistent with the data: ions cannot move in the solid lattice, so the solid does not conduct, but they move freely after melting, so the liquid conducts."
        wrongs = [("The model is not consistent with the data, because ions are present in the solid and any substance with ions must conduct as a solid.", "Believes ions in fixed positions can carry current."), ("The model is not consistent with the data, because a liquid cannot conduct electricity.", "Believes only solids conduct."),
                  ("The model is consistent with the data, because the solid conducts through mobile electrons.", "Misreads the table, which shows the solid does not conduct.")]
    else:
        key_t = f"The model does not fully explain the data: {'the solid conducts, which requires charge carriers that move in the solid' if d['cs'] == 'conducts' else 'the liquid does not conduct, but separated ions in a melt would carry current'}."
        wrongs = [("The model is consistent with the data: fixed ions in the solid and mobile ions in the liquid fit every observation.", "Does not compare the model's predictions with the table."), ("The model is consistent with the data, because ions in fixed positions can carry current.", "Believes fixed ions can conduct."),
                  ("The model cannot be tested with conductivity measurements.", "Rejects conductivity as evidence about the particles.")]
    k, ds = sentence_options(key_t, "Compare what the model predicts for the solid and the liquid with the observations.", wrongs)
    stem = "A student proposes a model in which solid X consists of ions held in fixed positions in a lattice, with the ions free to move only after melting. Based on the conductivity data in the table, which statement best evaluates the model?"
    return mk("ch_model_conductivity", "3.2", "4.D", stem, k, ds, rng, concept="evaluate how well an ionic-lattice model explains conductivity data", stim=stim, material={"type": "table", "must_include": ["solid conductivity", "liquid conductivity"]}, path="model prediction (no conduction as a solid, conduction as a liquid) compared with the observed pair; consistent only for the ionic type", facts=[f"type={t}", f"consistent={cons}"], judgment="derive the model's predictions and compare them with observations", est=85)


# ======================= 2.5 Lewis 전자 수 점검 (4.B) =======================
def ch_lewis_electron_check(rng):
    f, ve, bonds = pick(rng, [s for s in LEW if s[0] in ("H2O", "NH3", "CO2", "HCN", "CH2O", "CH3OH")])
    lp_true = (ve - 2 * bonds) // 2
    drawn_lp = lp_true + pick(rng, [1, -1, 2]) if lp_true > 1 else lp_true + pick(rng, [1, 2])
    shown = 2 * bonds + 2 * drawn_lp
    agree(1.0, 1.0 if shown != ve else 0.0, 1e-9, "wrong")
    key_t = f"The model shows {shown} valence electrons but the molecule has {ve}, so the student's drawing is not consistent with the number of valence electrons."
    wrongs = [(f"The model shows {ve} valence electrons, so the student's drawing is consistent with the number of valence electrons.", "Assumes the student's drawing is right without counting its electrons."), (f"The model shows {2 * bonds} valence electrons but the molecule has {ve}, so the student's drawing is not consistent.", "Counts only the bonding electrons, forgetting the lone pairs."),
              (f"The model shows {shown} valence electrons but the molecule has {ve}, so the student's drawing is consistent because the extra electrons are on the central atom.", "Accepts extra electrons because they are placed on the central atom.")]
    k, ds = sentence_options(key_t, "A valid Lewis structure uses exactly the total number of valence electrons.", wrongs)
    stem = f"A student draws a Lewis diagram of {cf(f)} that shows {bonds} bonding pairs and {drawn_lp} lone pairs. The molecule has {ve} valence electrons in total. Which statement correctly evaluates the student's drawing?"
    return mk("ch_lewis_electron_check", "2.5", "4.B", stem, k, ds, rng, concept="check a Lewis diagram against the total number of valence electrons", path="2(bonds + lone pairs) compared with the valence electron count; the student's drawing is inconsistent by construction", facts=[f"species={f}", f"valence={ve}", f"bonds={bonds}", f"drawn_lp={drawn_lp}", f"shown={shown}"], judgment="count the electrons in a drawn structure against what is available", est=70)


# ======================= 8.6 산 세기와 구조 (4.A) =======================
ACIDS = {"HOCl": ("O", 7.5), "HClO2": ("O", 1.96), "HClO3": ("O", -1.0), "HClO4": ("O", -8.0), "HF": ("B", 3.2), "HCl": ("B", -6.3), "HBr": ("B", -9.0), "HI": ("B", -10.0)}
NOH = {"HOCl": 0, "HClO2": 1, "HClO3": 2, "HClO4": 3}


BOND = {"HF": (92, 567), "HCl": (127, 431), "HBr": (141, 366), "HI": (161, 299)}  # (H–X 결합 길이 pm, 결합 엔탈피 kJ/mol)


def ch_acid_strength(rng):
    names = rng.sample(sorted(BOND), 4) if False else ["HF", "HCl", "HBr", "HI"]
    k = "HI"
    agree(1.0, 1.0 if k == max(names, key=lambda n: BOND[n][0]) == min(names, key=lambda n: BOND[n][1]) else 0.0, 1e-9, "weakest")
    ds = [Opt(cf(n), False, f"{n} has a shorter ({BOND[n][0]} pm) and stronger (about {BOND[n][1]} kJ/mol) H–X bond than HI ({BOND[k][0]} pm, about {BOND[k][1]} kJ/mol), so its bond is harder to break." + (" It is also the most electronegative halogen, which makes the bond strongest rather than weakest." if n == "HF" else ""), None) for n in names if n != k]
    key = Opt(cf(k), True, f"Bond length grows and bond strength falls down the halogen group because the larger halogen atoms overlap less well with hydrogen; HI has the longest ({BOND[k][0]} pm) and weakest (about {BOND[k][1]} kJ/mol) H–X bond.", None)
    stem = "Which of the following hydrogen halides has the longest and weakest bond between hydrogen and the halogen?"
    return mk("ch_acid_strength", "8.6", "4.A", stem, key, ds, rng, concept="relate the periodic trend in H–X bond length and strength to the halogen", path="measured bond lengths and enthalpies (longest and lowest) vs the rule that bond strength falls down a group", facts=["family=B", f"key={k}"], judgment="apply the trend down a group rather than choosing the most electronegative atom", est=60)
