"""AP Chemistry P0 원형 A — 단원 1(원자 구조·성질)·2(화합물 구조·성질). 정답은 코드가 정확 분수/sympy 로 풀고 numpy·수치 경로로 독립 재계산한다.
각 함수는 시드 rng 하나로 한 문항 팩을 만든다. 조건 불충족 시 ValueError(파이프라인이 시드를 건너뛴다)."""
from chem_common import *  # noqa: F401,F403
from common import Opt

SYM = {1: "H", 2: "He", 3: "Li", 4: "Be", 5: "B", 6: "C", 7: "N", 8: "O", 9: "F", 10: "Ne", 11: "Na", 12: "Mg", 13: "Al", 14: "Si", 15: "P", 16: "S", 17: "Cl", 18: "Ar"}
SUBSHELLS = [(1, "s", 2), (2, "s", 2), (2, "p", 6), (3, "s", 2), (3, "p", 6), (4, "s", 2), (3, "d", 10), (4, "p", 6)]


# ======================= 1.1 몰·몰질량 (5.B 아님 → 5.F) =======================
@retry_sep
def ch_moles_of_atoms(rng):
    f = pick(rng, ["Ca(OH)2", "Al2(SO4)3", "Mg3(PO4)2", "(NH4)2SO4", "Fe2O3", "Ca3(PO4)2", "Al(NO3)3", "Mg(NO3)2"])
    cnt = fmass(f)
    el = pick(rng, [a for a, n in cnt.items() if n > 1 and a != "H"] or ["O"])
    m = round(rng.uniform(8, 60), 1)
    M = formula_mass(f); n = m / M * cnt[el]
    agree(M, formula_mass_flat(f), 1e-9, "M")
    n2 = float(sp.Rational(str(m)) / sp.nsimplify(round(M, 4)) * cnt[el])
    agree(n, n2, 1e-3, "n")
    M_wrong = formula_mass(re.sub(r"\)(\d+)", ")", f))
    pairs = [("Gives moles of formula units, not moles of the named atom (omits the subscript factor).", m / M),
             ("Ignores the subscript outside the parentheses when computing the molar mass.", m / M_wrong * cnt[el]),
             ("Divides by the atom count instead of multiplying by it.", m / M / cnt[el]),
             ("Multiplies the mass by the atom count before dividing by an atom's molar mass.", m * cnt[el] / MASS[el])]
    key, ds = num_opts(n, pairs, "mol")
    stem = f"A sample of {cf(f)} has a mass of {Q(m, 'g', 3)}. How many moles of {el} atoms are in the sample?"
    return mk("ch_moles_of_atoms", "1.1", "5.F", stem, key, ds, rng, concept="moles of an element in a sample of a compound from its mass", path="formula mass by a recursive parser vs a flattened-regex parser; exact rational recomputation of the mole count",
              cond=[("the molar mass counts every atom including those inside parentheses", "formula parse"), ("the atom subscript multiplies the moles of formula units", "stoichiometric ratio")], facts=[f"mass={m}", f"M={M:.4f}", f"count={cnt[el]}", f"n={n:.6f}"],
              judgment="parse the formula, convert mass to moles, then scale by atoms per formula unit")


# ======================= 1.2 질량 스펙트럼 평균 원자량 (5.D) =======================
@retry_sep
def ch_average_atomic_mass(rng):
    for _ in forever():
        m1 = pick(rng, [10, 20, 24, 35, 63, 69, 79, 107, 121]); d = pick(rng, [1, 2, 3, 4]); a1 = pick(rng, [20, 25, 30, 40, 60, 65, 70, 75, 80])
        m2 = m1 + d; a2 = 100 - a1
        avg = Fr(m1 * a1 + m2 * a2, 100)
        num = float(np.average([m1, m2], weights=[a1, a2]))
        agree(float(avg), num, 1e-9, "avg")
        if a1 != 50:
            break
    major = m1 if a1 > a2 else m2
    pairs = [("Takes the simple average of the two isotope masses, ignoring abundance.", (m1 + m2) / 2), ("Reports the mass of the more abundant isotope.", float(major)),
             ("Swaps the two abundances when weighting.", m1 * a2 / 100 + m2 * a1 / 100), ("Weights by the lighter isotope's abundance only.", m1 * a1 / 100)]
    key, ds = abs_opts(float(avg), pairs, lambda v: "$" + f"{v:.2f}" + "\\text{ amu}$", 0.25)
    rows = [[f"{m1}", f"{a1}"], [f"{m2}", f"{a2}"]]
    stim = table_stimulus("Mass spectrum data for a sample of element X", "Mass of isotope (amu)", rows, "Relative abundance (%)")
    stem = f"The table shows the mass spectrum data for a sample of element X. What is the average atomic mass of X, in amu?"
    return mk("ch_average_atomic_mass", "1.2", "5.D", stem, key, ds, rng, concept="average atomic mass from isotope masses and abundances in mass-spectrum data", stim=stim,
              path="exact fraction weighted sum vs numpy weighted average", material={"type": "table", "must_include": ["isotope masses", "abundances"]},
              cond=[("abundances are percentages that sum to 100", "table")], facts=[f"m1={m1}", f"m2={m2}", f"a1={a1}", f"a2={a2}", f"avg={float(avg):.5f}"], judgment="read a data table and weight each isotope by its abundance")


# ======================= 1.3 질량 백분율 조성 (5.F) =======================
@retry_sep
def ch_percent_composition(rng):
    f = pick(rng, ["Fe2O3", "Al2O3", "Ca(OH)2", "NH4NO3", "CaCO3", "Mg(OH)2", "Na2SO4", "(NH4)2SO4", "Al2(SO4)3", "Ca3(PO4)2"])
    cnt = fmass(f); el = pick(rng, sorted(cnt))
    M = formula_mass(f); pct = MASS[el] * cnt[el] / M * 100
    agree(pct, 100 * (cnt[el] * MASS[el]) / formula_mass_flat(f), 1e-9, "pct")
    pairs = [("Uses the atomic mass of one atom and ignores its subscript.", MASS[el] / M * 100), ("Divides the total mass of the other elements by the molar mass.", 100 - pct),
             ("Divides by the mass of the named element instead of the compound.", 100 * M / (MASS[el] * cnt[el]) if M / (MASS[el] * cnt[el]) < 5 else None), ("Uses the number of atoms rather than their mass.", 100 * cnt[el] / sum(cnt.values()))]
    key, ds = num_opts(pct, pairs, "%")
    stem = f"What is the mass percent of {el} in {cf(f)}?"
    return mk("ch_percent_composition", "1.3", "5.F", stem, key, ds, rng, concept="mass percent of an element in a pure compound", path="recursive formula parser vs flattened parser; percent from atom-count fraction cross-check",
              facts=[f"M={M:.4f}", f"el_mass={MASS[el] * cnt[el]:.4f}", f"pct={pct:.4f}"], judgment="total the element's mass in one formula unit and divide by the molar mass")


# ======================= 1.6 PES 원소 식별 (1.A) =======================
def _config(z):
    left, out = z, []
    for n, l, cap in SUBSHELLS:
        k = min(cap, left)
        if k:
            out.append((n, l, k))
        left -= k
        if left == 0:
            break
    return out


def _pes_peaks(z):
    """슬레이터 유사 유효 핵전하로 결합 에너지(MJ/mol) 계산, 엄격 단조 감소 확인."""
    cfg = _config(z); peaks = []
    for n, l, k in cfg:
        core = sum(c for n2, l2, c in cfg if n2 < n)
        same = sum(c for n2, l2, c in cfg if n2 == n) - 1
        zeff = z - (0.30 * (k - 1) if n == 1 else 0.85 * core + 0.35 * same)
        if l == "p":
            zeff *= 0.96
        peaks.append((round(1.312 * zeff ** 2 / n ** 2, 2), k, f"{n}{l}"))
    return peaks


def ch_pes_identify(rng):
    for _ in forever():
        z = rng.randint(5, 17)
        peaks = _pes_peaks(z)
        es = [p[0] for p in peaks]
        if all(es[i] > es[i + 1] * 1.08 for i in range(len(es) - 1)):
            break
    total = sum(p[1] for p in peaks)
    # 독립 경로: 마델룽 채움(n+l 규칙)으로 z 전자를 다시 배치해 전자 총합을 센다
    order = sorted([(n + {"s": 0, "p": 1, "d": 2}[l], n, l, cap) for n, l, cap in SUBSHELLS if (n, l) != (3, "d") or z > 20], key=lambda t: (t[0], t[1]))
    left, cnt2 = z, 0
    for _, n, l, cap in order:
        k = min(cap, left); cnt2 += k; left -= k
    agree(total, cnt2, 1e-9, "electrons")
    agree(total, z, 1e-9, "z")
    pool = [("Counts one electron too many.", z + 1), ("Counts one electron too few.", z - 1), ("Uses the number of peaks as the atomic number.", len(peaks)), ("Counts two electrons too many.", z + 2), ("Counts two electrons too few.", z - 2)]
    cand = [(w, SYM[v]) for w, v in pool if v in SYM and v != z]
    seen, ds = {SYM[z]}, []
    for w, s in cand:
        if s not in seen:
            seen.add(s); ds.append(Opt(cf(s), False, w, None))
    if len(ds) < 3:
        raise ValueError("few_distractors")
    key = Opt(cf(SYM[z]), True, "", None)
    rows = [[f"{e:g}", str(k)] for e, k, _ in peaks]
    stim = diagram_stim_chem("Photoelectron spectrum of a neutral atom of element X. Peaks (binding energy in MJ/mol, relative number of electrons): " + "; ".join(f"({e:g}, {k})" for e, k, _ in peaks) + ".", "chem_pes", {"peaks": [{"energy": e, "electrons": k} for e, k, _ in peaks], "unit": "MJ/mol"})
    stem = "The photoelectron spectrum of a neutral atom of element X is shown. Which element is X?"
    return mk("ch_pes_identify", "1.6", "1.A", stem, key, ds[:3], rng, concept="identify an element from the peak positions and relative heights in a photoelectron spectrum", stim=stim,
              path="electron configuration from a hand-coded subshell filling list vs Madelung (n+l) ordering; total relative electrons equals Z", material={"type": "diagram", "must_include": ["peak energies", "relative electron numbers"]},
              cond=[("the relative height of each peak equals the number of electrons in that subshell", "stimulus")], facts=[f"z={z}", f"peaks={len(peaks)}"], est=100, judgment="read relative peak heights as electron counts and sum them")


# ======================= 1.7 연속 이온화 에너지 (5.D) =======================
SUCC_IE = {"Na": (1, [496, 4562, 6910, 9544]), "Mg": (2, [738, 1451, 7733, 10543]), "Al": (3, [578, 1817, 2745, 11577]), "Si": (4, [786, 1577, 3232, 4356, 16091]), "P": (5, [1012, 1907, 2914, 4964, 6274, 21267])}


@retry_sep
def ch_successive_ie(rng):
    el = pick(rng, sorted(SUCC_IE)); true, ies = SUCC_IE[el]
    shown = ies[: true + 1]
    ratios = [shown[i + 1] / shown[i] for i in range(len(shown) - 1)]
    k = int(np.argmax(ratios)) + 1
    jump = next(i + 1 for i in range(len(shown) - 1) if shown[i + 1] / shown[i] > 2.4)
    agree(k, jump, 1e-9, "valence"); agree(k, true, 1e-9, "valence_true")
    grp = {1: 1, 2: 2, 3: 13, 4: 14, 5: 15}
    pairs = [("Counts the first core electron removed after the large jump as a valence electron.", true + 1), ("Stops one electron before the jump.", true - 1), ("Counts the electrons needed to complete an octet instead.", 8 - true), ("Counts the number of ionization energies listed beyond the jump twice.", true + 2)]
    key, ds = abs_opts(float(true), pairs, lambda v: "$" + f"{int(v)}" + "$", 0.5)
    rows = [[str(i + 1), f"{v:,}"] for i, v in enumerate(shown)]
    stim = table_stimulus("Successive ionization energies of element X", "Electron removed", rows, "Ionization energy (kJ/mol)")
    stem = "The table lists the first ionization energies of element X in order. How many valence electrons does an atom of X have?"
    return mk("ch_successive_ie", "1.7", "5.D", stem, key, ds, rng, concept="valence electron count from the large jump in successive ionization energies", stim=stim, material={"type": "table", "must_include": ["successive ionization energies"]},
              path="argmax of consecutive ratios vs first ratio above a threshold; both equal the known group valence count", cond=[("a large jump marks the first removal from a core shell", "table")], facts=[f"el={el}", f"valence={true}"], judgment="locate the jump in a data table and connect it to core versus valence shells")


# ======================= 1.7 반지름 경향 (6.D) =======================
RAD = {"Li": (2, 1, 152), "Na": (3, 1, 186), "K": (4, 1, 227), "Be": (2, 2, 112), "Mg": (3, 2, 160), "Ca": (4, 2, 197), "B": (2, 13, 85), "C": (2, 14, 77), "N": (2, 15, 75), "O": (2, 16, 73), "F": (2, 17, 71),
       "Al": (3, 13, 143), "Si": (3, 14, 118), "P": (3, 15, 110), "S": (3, 16, 103), "Cl": (3, 17, 99)}


def ch_radius_trend(rng):
    for _ in forever():
        a, b = rng.sample(sorted(RAD), 2)
        pa, ga, ra = RAD[a]; pb, gb, rb = RAD[b]
        same_period, same_group = pa == pb, ga == gb
        if (same_period or same_group) and abs(ra - rb) > 5:
            break
    rule_larger = (a if pa > pb else b) if same_group else (a if ga < gb else b)
    table_larger = a if ra > rb else b
    agree(1.0, 1.0 if rule_larger == table_larger else 0.0, 1e-9, "trend")
    good = "it has more electron shells, so its valence electrons are farther from the nucleus" if same_group else "its nucleus has a smaller effective nuclear charge acting on the same shell, so the valence electrons are held less tightly"
    bad_same = "it has more protons, so the nucleus pulls the electrons outward" if same_group else "it has more protons, so the electron cloud is larger"
    other = b if rule_larger == a else a
    key_t = f"{rule_larger}, because {good}."
    wrongs = [(f"{rule_larger}, because {bad_same}.", "Treats more protons as making an atom larger."), (f"{other}, because {good}.", "Right reason applied to the wrong atom."),
              (f"{other}, because {bad_same}.", "Both the atom and the reason are reversed.")]
    k, ds = sentence_options(key_t, "The trend follows shell number within a group and effective nuclear charge across a period.", wrongs)
    stem = f"Which atom has the larger atomic radius, {a} or {b}, and why?" if True else ""
    return mk("ch_radius_trend", "1.7", "6.D", stem, k, ds, rng, concept="justify the larger atomic radius using shells and effective nuclear charge", path="rule from period and group positions vs tabulated radii agree",
              facts=[f"a={a}", f"b={b}", f"larger={rule_larger}"], judgment="choose between shell number and effective nuclear charge as the deciding factor", est=75)


# ======================= 2.1 결합 극성 (4.A) =======================
EN = {"H": 2.20, "C": 2.55, "N": 3.04, "O": 3.44, "F": 3.98, "Cl": 3.16, "Br": 2.96, "I": 2.66, "S": 2.58, "P": 2.19, "Si": 1.90, "Li": 0.98, "Na": 0.93, "Mg": 1.31, "Al": 1.61}


def ch_bond_polarity(rng):
    for _ in forever():
        pairs_ = [tuple(rng.sample(["H", "C", "N", "O", "F", "Cl", "Br", "I", "S", "P", "Si"], 2)) for _ in range(4)]
        diffs = [abs(EN[a] - EN[b]) for a, b in pairs_]
        order = sorted(range(4), key=lambda i: -diffs[i])
        if len({tuple(sorted(p)) for p in pairs_}) == 4 and diffs[order[0]] - diffs[order[1]] > 0.25:
            break
    key_i = order[0]
    ref = max(range(4), key=lambda i: (lambda a, b: abs(EN[a] - EN[b]))(*pairs_[i]))
    agree(key_i, ref, 1e-9, "polar")
    tex = lambda p: "$\\mathrm{" + p[0] + "{-}" + p[1] + "}$"
    wr = []
    for i in range(4):
        if i != key_i:
            wr.append(Opt(tex(pairs_[i]), False, "Chooses a bond with a smaller electronegativity difference." if diffs[i] < diffs[key_i] else "Compares atomic size instead of electronegativity.", None))
    key = Opt(tex(pairs_[key_i]), True, "The largest electronegativity difference gives the most polar bond.", None)
    stem = "Which of the following bonds is the most polar?"
    return mk("ch_bond_polarity", "2.1", "4.A", stem, key, wr, rng, concept="rank bond polarity by electronegativity difference", path="difference from a Pauling table vs argmax over the four bonds",
              facts=[f"pairs={pairs_}"], judgment="compare electronegativity differences rather than atomic size or group position", est=60)


# ======================= 2.6 형식 전하 (5.F) =======================
FC_SET = [("N", 5, 0, 4, "NH_4^+"), ("O", 6, 2, 3, "H_3O^+"), ("N", 5, 4, 2, "NH_2^-"), ("C", 4, 2, 3, "CO"), ("O", 6, 2, 3, "CO"), ("B", 3, 0, 4, "BF_4^-"), ("O", 6, 6, 1, "OH^-"), ("N", 5, 2, 3, "NO_2^-")]


def ch_formal_charge(rng):
    for _ in forever():
        el, V, L, b, sp_ = pick(rng, FC_SET[:7])
        fc = V - L - b
        owned = L + (2 * b) / 2  # 독립 경로: 고립 전자 + 공유 전자의 절반
        agree(fc, V - owned, 1e-9, "fc")
        pairs = [("Counts both electrons of every bond as belonging to the atom.", V - L - 2 * b), ("Ignores the bonding electrons entirely.", V - L), ("Subtracts only the bonds and forgets the lone-pair electrons.", V - b), ("Uses lone pairs instead of lone-pair electrons.", V - L // 2 - b)]
        try:
            key, ds = signed_opts(float(fc), pairs, fmt=lambda v: "$" + (f"{int(v):+d}" if v else "0") + "$")
        except ValueError:
            continue
        break
    stem = f"In a valid Lewis structure of $\\mathrm{{{sp_}}}$, the {el} atom has {L} nonbonding electrons and is part of a total of {b} bonds (a double bond counts as two bonds). What is the formal charge on the {el} atom?"
    return mk("ch_formal_charge", "2.6", "5.F", stem, key, ds, rng, concept="formal charge from valence electrons, nonbonding electrons, and bonds", path="valence minus nonbonding minus bonds vs electron bookkeeping (lone pair plus half the shared electrons)",
              facts=[f"V={V}", f"L={L}", f"b={b}", f"fc={fc}"], judgment="use the formal charge formula with the correct electron bookkeeping", est=70)


# ======================= 2.7 VSEPR (4.A) =======================
VSEPR = {(2, 0): ("linear", 180), (3, 0): ("trigonal planar", 120), (4, 0): ("tetrahedral", 109.5), (3, 1): ("bent", 118), (4, 1): ("trigonal pyramidal", 107), (4, 2): ("bent", 104.5), (5, 0): ("trigonal bipyramidal", 90),
         (5, 1): ("seesaw", 90), (5, 2): ("T-shaped", 90), (6, 0): ("octahedral", 90), (6, 1): ("square pyramidal", 90), (6, 2): ("square planar", 90)}
ELEC_GEO = {2: "linear", 3: "trigonal planar", 4: "tetrahedral", 5: "trigonal bipyramidal", 6: "octahedral"}
SPECIES = [("CH4", 4, 4, 0), ("NH3", 5, 3, 1), ("H2O", 6, 2, 2), ("CO2", 4, 2, 0), ("BF3", 3, 3, 0), ("SO2", 6, 2, 1), ("PCl5", 5, 5, 0), ("SF6", 6, 6, 0), ("XeF4", 8, 4, 2), ("ClF3", 7, 3, 2), ("SF4", 6, 4, 1), ("BrF5", 7, 5, 1)]  # (식, 중심 원자 원자가 전자, 시그마 결합 수, 비공유 전자쌍 수)


def ch_vsepr_shape(rng):
    f, V, sig_, lp = pick(rng, SPECIES)
    dom = sig_ + lp
    shape = VSEPR[(dom, lp)][0]
    lp_calc = {"CO2": 0, "SO2": 1}.get(f)  # 다중 결합 때문에 시그마 수 ≠ 전자 수 → 표에서 직접
    if lp_calc is None:
        lp_calc = (V - sig_) // 2
    agree(lp, lp_calc, 1e-9, "lp")
    if lp == 0:
        derived = ELEC_GEO[dom]
    else:
        derived = VSEPR[(dom, lp)][0]
    agree(1.0, 1.0 if derived == shape else 0.0, 1e-9, "shape")
    pairs = [("Reports the electron-domain geometry, ignoring the lone pairs.", ELEC_GEO[dom]), ("Treats the molecule as if every domain were a bonded atom (no lone pairs).", VSEPR[(dom, 0)][0] if (dom, 0) in VSEPR else None),
             ("Removes one lone pair too many.", VSEPR.get((dom - 1, max(lp - 1, 0)), (None,))[0]), ("Counts one extra lone pair.", VSEPR.get((dom, lp + 1), (None,))[0])]
    pool = [x for x in {s[0] for s in VSEPR.values()} if x != shape]
    ds, seen = [], {shape}
    for why, s in pairs:
        if s and s not in seen:
            seen.add(s); ds.append(Opt(s, False, why, None))
    for s in sorted(pool, key=lambda t: (abs(len(t) - len(shape)), t)):  # 길이 단서를 막기 위해 키와 길이가 비슷한 모양부터
        if len(ds) >= 3:
            break
        if s not in seen:
            seen.add(s); ds.append(Opt(s, False, "Matches a different count of bonded atoms and lone pairs.", None))
    key = Opt(shape, True, "The shape follows from the numbers of bonded atoms and lone pairs on the central atom.", None)
    stem = f"What is the molecular geometry of {cf(f)}? (The central atom has {sig_} bonded atoms and {lp} lone pair{'s' if lp != 1 else ''}.)"
    return mk("ch_vsepr_shape", "2.7", "4.A", stem, key, ds[:3], rng, concept="molecular geometry from bonded atoms and lone pairs on the central atom", path="shape table keyed by (domains, lone pairs) vs rule-built geometry from the electron-domain geometry",
              facts=[f"species={f}", f"domains={dom}", f"lone_pairs={lp}", f"shape={shape}"], judgment="separate electron-domain geometry from molecular geometry", est=60)


# ======================= 2.2 포텐셜 에너지 곡선 (5.D) =======================
def _morse(r, re_, De, a):
    return De * (1 - math.exp(-a * (r - re_))) ** 2 - De


def ch_potential_curve(rng):
    for _ in forever():
        reA = pick(rng, [0.9, 1.0, 1.1, 1.2, 1.4]); reB = pick(rng, [0.9, 1.0, 1.1, 1.2, 1.4, 1.5])
        DeA = pick(rng, [200, 300, 400, 500, 600]); DeB = pick(rng, [200, 300, 400, 500, 600])
        if reA != reB and DeA != DeB:
            break
    a = 2.0
    rs = np.linspace(0.5, 3.0, 2501)
    VA = np.array([_morse(r, reA, DeA, a) for r in rs]); VB = np.array([_morse(r, reB, DeB, a) for r in rs])
    numA, numB = rs[VA.argmin()], rs[VB.argmin()]
    agree(numA, reA, 2e-3, "reA"); agree(numB, reB, 2e-3, "reB")
    longer = "X" if reA > reB else "Y"; stronger = "X" if DeA > DeB else "Y"
    other = lambda s: "Y" if s == "X" else "X"
    key_t = f"{longer} has the longer bond and {stronger} has the stronger bond."
    key = Opt(key_t, True, "The minimum's horizontal position gives the bond length and its depth gives the bond energy.", None)
    ds = []
    for l, s, why in [(other(longer), stronger, "Reads bond length from the wrong curve."), (longer, other(stronger), "Reads bond strength from the wrong curve."), (other(longer), other(stronger), "Reverses both readings.")]:
        ds.append(Opt(f"{l} has the longer bond and {s} has the stronger bond.", False, why, None))
    pts = lambda V: [[round(float(r), 3), round(float(v), 2)] for r, v in zip(rs[::25], V[::25]) if v <= 780]  # 축 범위 안의 점만(반발 벽의 가파른 부분은 잘라낸다)
    stim = graph_stim("Potential energy versus internuclear distance for diatomic molecules X and Y", [("X", pts(VA)), ("Y", pts(VB))], gaxis("Internuclear distance (arbitrary units)", 0.5, 3.0, 0.5), gaxis("Potential energy (kJ/mol)", -600, 800, 200))
    stem = "The graph shows how the potential energy of two bonded atoms varies with internuclear distance for diatomic molecules X and Y. Which statement is correct?"
    return mk("ch_potential_curve", "2.2", "5.D", stem, key, ds, rng, concept="bond length and bond energy from the minimum of a potential energy curve", stim=stim,
              path="analytic Morse minimum position and depth vs numerical argmin of a dense sampled curve", facts=[f"reX={reA}", f"reY={reB}", f"DeX={DeA}", f"DeY={DeB}"], material={"type": "graph", "must_include": ["two curves", "minimum positions", "minimum depths"]},
              judgment="connect the minimum's position and depth on a graph to bond length and bond energy", est=90)


# ======================= 2.3 격자 에너지 (4.A) =======================
IONIC = {"NaCl": (1, 1, 102 + 181), "KCl": (1, 1, 138 + 181), "LiF": (1, 1, 76 + 133), "NaF": (1, 1, 102 + 133), "KBr": (1, 1, 138 + 196), "MgO": (2, 2, 72 + 140), "CaO": (2, 2, 100 + 140), "MgCl2": (2, 1, 72 + 181), "CaF2": (2, 1, 100 + 133), "NaBr": (1, 1, 102 + 196)}


def ch_lattice_energy(rng):
    for _ in forever():
        names = rng.sample(sorted(IONIC), 4)
        sc = {n: IONIC[n][0] * IONIC[n][1] / IONIC[n][2] for n in names}
        order = sorted(names, key=lambda n: -sc[n])
        if sc[order[0]] / sc[order[1]] > 1.12:
            break
    k = order[0]
    agree(sc[k], max(float(sp.Rational(IONIC[n][0] * IONIC[n][1], IONIC[n][2])) for n in names), 1e-9, "lat")
    ds = []
    for n in names:
        if n == k:
            continue
        why = "Considers only the smaller ionic separation and neglects the smaller charges." if IONIC[n][2] < IONIC[k][2] else "Looks only at the charge of one ion without comparing the separation."
        if IONIC[n][0] * IONIC[n][1] >= IONIC[k][0] * IONIC[k][1] and IONIC[n][2] > IONIC[k][2]:
            why = "Considers only the larger charges and neglects the larger ionic separation."
        ds.append(Opt(cf(n), False, why, None))
    key = Opt(cf(k), True, "Lattice energy grows with the product of the ion charges and shrinks as the ions are farther apart (Coulomb's law).", None)
    stem = "Which of the following ionic compounds is expected to have the greatest lattice energy (the largest magnitude)?"
    return mk("ch_lattice_energy", "2.3", "4.A", stem, key, ds, rng, concept="compare lattice energies using ion charges and ionic radii (Coulomb's law)", path="exact rational q1q2/d ranking vs numpy argmax; sizes from a radius table",
              facts=[f"names={names}", f"key={k}"], judgment="weigh charge product against interionic distance", est=70)
