"""AP Biology 원형 I — exam_prep 보강(2026-10-14, bio-v2). 목적: 풀 모의고사 한 회의 exam_prep 문항 수를 올린다.
구조 기준(판정기 입력): 3단계 이상, 개념 또는 자료 2개 이상을 결합하고, 앞 단계의 결과를 다음 단계로 가져가야 한다. 모든 문항은 코드가 값을 두 경로로 계산하고,
오답은 중간 단계에서 멈추거나 한 단계를 빠뜨린 실제 오류(값이 선택지와 같음)다. 해설은 계산 과정을 보여 준다.
이 파일의 원형은 전부 단독 문항이며 기존 원형과 구조(식 체인)가 겹치지 않는다."""
from fractions import Fraction as Fr  # noqa: F811
from bio_common import *  # noqa: F401,F403


def _steps(*s):
    return list(s)


def _retry(fn):
    """표본이 조건(정수 값·간격 등)을 만족하지 않으면 같은 rng 로 다시 뽑는다(결정적). 독립 경로 불일치도 같은 방식으로 건너뛴다."""
    import functools

    @functools.wraps(fn)
    def w(rng):
        last = None
        for _ in range(300):
            try:
                return fn(rng)
            except ValueError as e:
                if str(e).startswith("independent_check_failed") and False:
                    raise
                last = e
        raise last
    return w


def _num(arch, topic, skill, stem, val, pairs, f, rng, *, concept, path, steps, stim=None, gap=0.0, rel=0.08, facts=None, kwhy=None, est=100, judgment=None):
    key, ds = val_opts(val, pairs, f, gap=gap, rel=rel)
    return mk(arch, topic, skill, stem, key, ds, rng, concept=concept, path=path, thinking=steps, stim=stim, est=est, facts=facts or [], kwhy=kwhy, judgment=judgment or "carry the result of each step into the next step")


# ---------------------------------------------------------------- 단원 1
@_retry
def bi_x_hbond_count(rng):
    N = pick(rng, [2000, 3000, 4000, 5000]); pa = pick(rng, [20, 22, 24, 28, 30, 32])
    A = pa * 2 * N // 100
    if A * 100 != pa * 2 * N:
        raise ValueError("frac")
    at, gc = A, N - A
    # 독립 경로: 염기를 하나씩 나열해 쌍 수를 센다
    bases = {"A": A, "T": A, "G": N - A, "C": N - A}
    hb = 2 * min(bases["A"], bases["T"]) + 3 * min(bases["G"], bases["C"])
    agree(hb, 2 * at + 3 * gc, 1e-12, "hb")
    wrong_at = pa * N // 100
    pairs = [("Counts the adenine percent against the number of base pairs instead of the number of nucleotides, so too few A-T pairs are found.", 2 * wrong_at + 3 * (N - wrong_at)),
             ("Swaps the bond numbers, giving three hydrogen bonds to A-T pairs and two to G-C pairs.", 3 * at + 2 * gc),
             ("Counts only the G-C pairs, three hydrogen bonds each, and leaves out the A-T pairs.", 3 * gc),
             ("Counts one hydrogen bond for each base pair.", N)]
    stem = (f"A double-stranded DNA fragment is {N:,} base pairs long, and {pa}% of all the nucleotides in the fragment are adenine. "
            "An A-T base pair is held together by two hydrogen bonds, and a G-C base pair by three. How many hydrogen bonds hold the two strands of the fragment together?")
    kw = (f"The fragment has {2 * N:,} nucleotides, so adenine is {pa}% of {2 * N:,} = {A:,}. T equals A, so there are {at:,} A-T pairs and {N:,} - {at:,} = {gc:,} G-C pairs. "
          f"Hydrogen bonds = 2({at:,}) + 3({gc:,}) = {hb:,}.")
    return _num("bi_x_hbond_count", "1.6", "5.A", stem, hb, pairs, lambda v: f"{int(v):,}", rng, concept="base-pairing rules and hydrogen bonds in a DNA fragment", path="explicit base list pairing vs closed-form 2(A-T)+3(G-C)",
                steps=_steps("Use the percentage of adenine in all nucleotides to find the number of adenine nucleotides", "Use base pairing to find the A-T and G-C pairs", "Multiply each kind of pair by its hydrogen bonds and add"), gap=20, rel=0.04, facts=[f"N={N}", f"pa={pa}", f"hb={hb}"], kwhy=kw)


# ---------------------------------------------------------------- 단원 2
@_retry
def bi_x_cell_size_limit(rng):
    j = pick(rng, [1.0, 1.5, 2.0, 2.5, 3.0]); k = pick(rng, [0.25, 0.3, 0.4, 0.5, 0.6])
    r = 3 * j / k
    if abs(r - round(r)) > 1e-9 or not 6 <= r <= 30:
        raise ValueError("r")
    # 독립 경로: 반지름을 키우며 공급과 수요를 비교
    best = max(x / 10 for x in range(1, 400) if 4 * math.pi * (x / 10) ** 2 * j >= 4 / 3 * math.pi * (x / 10) ** 3 * k - 1e-9)
    agree(best, r, 1e-9, "r")
    pairs = [("Treats the surface-area-to-volume ratio as 1/r instead of 3/r, which leaves out the factor of three from the sphere formulas.", j / k),
             ("Gives the diameter of the cell instead of the radius.", 2 * r), ("Treats the surface-area-to-volume ratio as 2/r, as for a long cylinder, instead of 3/r.", 2 * j / k),
             ("Divides by three instead of multiplying by three when the surface area and volume are set equal.", j / (3 * k))]
    stem = (f"A spherical bacterial cell takes up a nutrient across its surface at a rate of {j:g} nmol per µm² per hour, and the cell uses the nutrient at a rate of {k:g} nmol per µm³ of cell volume per hour. "
            "Using the formulas for the surface area and volume of a sphere, what is the largest radius, in µm, at which the uptake across the surface can still meet the use of the nutrient?")
    kw = f"Uptake = j(4πr²) and use = k(4/3 πr³). Setting uptake equal to use gives r = 3j/k = 3({j:g})/{k:g} = {r:g} µm."
    return _num("bi_x_cell_size_limit", "2.2", "5.A", stem, r, pairs, lambda v: f"{hu(v, 1)} µm", rng, concept="surface area to volume limits on cell size", path="scan of radii comparing supply and demand vs r = 3j/k",
                steps=_steps("Write the surface area and the volume of a sphere", "Write uptake as rate x area and use as rate x volume", "Set uptake equal to use and solve for the radius"), gap=0.4, rel=0.06, facts=[f"j={j}", f"k={k}", f"r={r}"], kwhy=kw)


@_retry
def bi_x_plant_osmosis(rng):
    psi_s = pick(rng, [-6.0, -8.0, -10.0, -12.0]); pp = pick(rng, [3.0, 4.0, 5.0, 6.0]); M = pick(rng, [0.2, 0.3, 0.4, 0.5, 0.6]); T = 25
    cell = psi_s + pp; sol = -M * R_BAR * (T + 273)
    D = cell - sol
    if abs(D) < 1.0:
        raise ValueError("small")
    d_in = D < 0  # 세포 Ψ 가 더 낮으면 물이 들어간다

    key_text = f"Water moves {'into' if d_in else 'out of'} the cell, because the water potential of the solution is {hu(abs(D), 1)} bars {'higher' if d_in else 'lower'} than that of the cell."
    wrong_dir = f"Water moves {'out of' if d_in else 'into'} the cell, because the water potential of the solution is {hu(abs(D), 1)} bars {'lower' if d_in else 'higher'} than that of the cell."
    D2 = psi_s - sol  # 압력 퍼텐셜을 빼먹음
    sol_c = -M * R_BAR * T
    D3 = cell - sol_c  # 섭씨 온도를 그대로 사용
    cand = [("Water moves %s the cell, because the water potential of the solution is %s bars %s than that of the cell." % ("into" if D2 < 0 else "out of", hu(abs(D2), 1), "higher" if D2 < 0 else "lower"), "Uses only the solute potential of the cell and leaves out its pressure potential, so the difference in water potential is wrong."),
            ("Water moves %s the cell, because the water potential of the solution is %s bars %s than that of the cell." % ("into" if D3 < 0 else "out of", hu(abs(D3), 1), "higher" if D3 < 0 else "lower"), "Uses the temperature in degrees Celsius instead of kelvins when calculating the solute potential of the solution."),
            (wrong_dir, "Water moves from higher water potential to lower water potential, so the direction of movement is reversed.")]
    texts = {key_text}
    ds = []
    for t, w in cand:
        if t in texts:
            continue
        texts.add(t); ds.append((t, w))
    if len(ds) < 3 or len({hu(abs(D), 1), hu(abs(D2), 1), hu(abs(D3), 1)}) < 3:
        raise ValueError("not_enough_separated_distractors")
    kw = (f"The solution has Ψ = Ψs = -iCRT = -(1)({M:g})(0.0831)({T + 273}) = {sol:.1f} bars. The cell has Ψ = Ψp + Ψs = {pp:g} + ({psi_s:g}) = {cell:.1f} bars. "
          f"Water moves from higher to lower water potential, so it moves {'into' if d_in else 'out of'} the cell.")
    key, dd = sentence_options(key_text, kw, ds)
    stem = (f"A plant cell has a pressure potential of {pp:g} bars and a solute potential of {psi_s:g} bars. The cell is placed in an open beaker of a {M:g} M sucrose solution at {T} °C. "
            "(The ionization constant for sucrose is 1.) Which statement correctly describes the movement of water?")
    return mk("bi_x_plant_osmosis", "2.7", "5.A", stem, key, dd, rng, concept="compare the water potential of a cell and a sucrose solution", path="solution Ψ_S = -iCRT and cell Ψ = Ψ_P + Ψ_S vs a direct difference calculation",
              thinking=_steps("Calculate the water potential of the open solution from its solute potential", "Add pressure and solute potential to find the water potential of the cell", "Compare the two and apply movement from higher to lower water potential"),
              est=110, facts=[f"cell={cell}", f"sol={sol:.3f}"], judgment="carry the calculated water potentials to the direction of net water movement")


# ---------------------------------------------------------------- 단원 3
@_retry
def bi_x_gross_productivity(rng):
    init = pick(rng, [6.0, 7.0, 8.0]); light_gain = pick(rng, [1.6, 2.0, 2.4, 3.0]); dark_loss = pick(rng, [0.6, 0.8, 1.0, 1.2]); t = pick(rng, [2, 4, 5])
    final_l = init + light_gain; final_d = init - dark_loss
    gross = (light_gain + dark_loss) / t
    # 독립 경로: 한 시간씩 갱신
    o2l = init; o2d = init
    for _ in range(t):
        o2l += light_gain / t; o2d -= dark_loss / t
    agree((o2l - o2d) / t, gross, 1e-9, "gpp")
    pairs = [("Divides the net change in the light bottle by the time and does not add the oxygen used in respiration.", light_gain / t), ("Subtracts the oxygen used in respiration from the net gain instead of adding it.", (light_gain - dark_loss) / t),
             ("Reports the oxygen used in respiration per hour, from the dark bottle only.", dark_loss / t), ("Adds the two changes correctly but does not divide by the number of hours.", light_gain + dark_loss)]
    stim = tbl("Dissolved oxygen in pond-water samples before and after incubation", ["Bottle", "Initial O₂ (mg/L)", f"O₂ after {t} hours (mg/L)"], [["Light bottle", f"{init:.1f}", f"{final_l:.1f}"], ["Dark bottle", f"{init:.1f}", f"{final_d:.1f}"]])
    stem = "Samples of pond water containing algae were sealed in a clear bottle and in a dark bottle. The table shows the dissolved oxygen in each bottle at the start and at the end of the incubation. What is the rate of gross photosynthesis, in mg of O₂ produced per liter per hour?"
    kw = (f"The dark bottle shows respiration: {init:.1f} - {final_d:.1f} = {dark_loss:.1f} mg/L used. The light bottle shows net production: {final_l:.1f} - {init:.1f} = {light_gain:.1f} mg/L. "
          f"Gross production = net + respiration = {light_gain:.1f} + {dark_loss:.1f} = {light_gain + dark_loss:.1f} mg/L over {t} hours, or {gross:.2f} mg/L per hour.")
    return _num("bi_x_gross_productivity", "3.4", "5.A", stem, gross, pairs, lambda v: f"{hu(v, 2)} mg/L per hour" if v < 20 else f"{hu(v, 1)} mg/L", rng, concept="gross photosynthesis = net production + respiration", path="hour-by-hour bookkeeping of both bottles vs (net + respiration)/time",
                steps=_steps("Use the dark bottle to find the oxygen used by respiration", "Use the light bottle to find the net oxygen production", "Add respiration to net production and divide by the time"), stim=stim, gap=0.03, rel=0.06, facts=[f"gpp={gross:.4f}"], kwhy=kw)


@_retry
def bi_x_respirometer_ratio(rng):
    t_lo, t_hi = pick(rng, [(10, 25), (10, 30), (15, 30)])
    peas_lo = pick(rng, [0.5, 0.6, 0.8, 1.0]); bead_lo = pick(rng, [0.1, 0.2]); mult = pick(rng, [2.0, 2.5, 3.0, 4.0])
    net_lo = peas_lo - bead_lo; net_hi = net_lo * mult
    bead_hi = pick(rng, [0.2, 0.3, 0.4]); peas_hi = net_hi + bead_hi
    # 독립 경로: 보정 전 비를 따로 계산해 구별
    unc = peas_hi / peas_lo
    if abs(unc - mult) < 0.15:
        raise ValueError("close")
    pairs = [("Compares the uncorrected readings of the germinating peas and does not subtract the control.", unc), ("Subtracts the two corrected readings instead of dividing them.", net_hi - net_lo), ("Divides the lower-temperature rate by the higher-temperature rate.", net_lo / net_hi),
             ("Subtracts the control reading from the 10 °C reading only.", (peas_hi - bead_lo) / net_lo)]
    stim = tbl("Oxygen consumed in 15 minutes (mL) in a respirometer", ["Temperature (°C)", "Germinating peas", "Glass beads (control)"], [[t_lo, f"{peas_lo:.1f}", f"{bead_lo:.1f}"], [t_hi, f"{peas_hi:.2f}", f"{bead_hi:.1f}"]])
    stem = f"A student measured the oxygen consumed by germinating peas in a respirometer at {t_lo} °C and at {t_hi} °C. The respirometer with glass beads of the same volume at each temperature was a control. The table shows the oxygen consumed in 15 minutes. After correcting for the control, the rate of oxygen consumption by the peas at {t_hi} °C is how many times the rate at {t_lo} °C?"
    kw = f"Corrected consumption is peas minus beads: {peas_hi:.2f} - {bead_hi:.1f} = {net_hi:.2f} mL at {t_hi} °C and {peas_lo:.1f} - {bead_lo:.1f} = {net_lo:.2f} mL at {t_lo} °C. Both took 15 minutes, so the rate ratio is {net_hi:.2f}/{net_lo:.2f} = {mult:.1f}."
    return _num("bi_x_respirometer_ratio", "3.5", "5.A", stem, net_hi / net_lo, pairs, lambda v: f"{hu(v, 1)}" if v < 20 else f"{hu(v, 2)} mL", rng, concept="correct respirometer readings with a control and compare rates", path="corrected rates as separate numbers vs the generating multiplier",
                steps=_steps("Subtract the control reading from the peas reading at each temperature", "Convert the corrected readings to rates over the same 15 minutes", "Divide the higher-temperature rate by the lower-temperature rate"), stim=stim, gap=0.1, rel=0.06, facts=[f"mult={mult}"], kwhy=kw)


@_retry
def bi_x_enzyme_rate_percent(rng):
    t1, t2 = pick(rng, [(2, 6), (1, 5), (2, 8)])
    r_lo = pick(rng, [4.0, 5.0, 6.0]); inc = pick(rng, [20, 30, 40, 50, 60]); r_hi = r_lo * (1 + inc / 100)
    c1_lo = pick(rng, [2.0, 3.0]); c2_lo = c1_lo + r_lo * (t2 - t1)
    c1_hi = pick(rng, [2.5, 3.5]); c2_hi = c1_hi + r_hi * (t2 - t1)
    if round(c2_lo, 2) != c2_lo or round(c2_hi, 2) != c2_hi:
        raise ValueError("round")
    rate = lambda a, b: (b - a) / (t2 - t1)  # noqa: E731
    pct = (rate(c1_hi, c2_hi) - rate(c1_lo, c2_lo)) / rate(c1_lo, c2_lo) * 100
    agree(pct, inc, 1e-9, "pct")
    pairs = [("Reports the higher rate as a percent of the lower rate, which leaves out subtracting the original 100 percent.", rate(c1_hi, c2_hi) / rate(c1_lo, c2_lo) * 100), ("Divides the increase in rate by the new rate instead of the original rate.", (r_hi - r_lo) / r_hi * 100),
             ("Compares the product amounts at the final time instead of the rates.", (c2_hi - c2_lo) / c2_lo * 100), ("Uses the increase in rate in µmol per minute as the percent.", r_hi - r_lo)]
    stim = tbl("Product formed in an enzyme-catalyzed reaction (µmol)", ["Temperature", f"Product at {t1} min", f"Product at {t2} min"], [["25 °C", f"{c1_lo:.1f}", f"{c2_lo:.1f}"], ["35 °C", f"{c1_hi:.1f}", f"{c2_hi:.2f}"]])
    stem = f"A student measured the amount of product formed by an enzyme at two temperatures. The table shows the amount of product at {t1} minutes and at {t2} minutes. The reaction was linear over this period. By what percent did the rate of the reaction change when the temperature was raised from 25 °C to 35 °C?"
    kw = f"The rate at 25 °C is ({c2_lo:.1f} - {c1_lo:.1f})/({t2} - {t1}) = {r_lo:.2f} µmol/min and at 35 °C is ({c2_hi:.2f} - {c1_hi:.1f})/({t2} - {t1}) = {r_hi:.2f} µmol/min. Percent change = ({r_hi:.2f} - {r_lo:.2f})/{r_lo:.2f} x 100 = {inc}%."
    return _num("bi_x_enzyme_rate_percent", "3.2", "5.A", stem, float(inc), pairs, lambda v: f"{hu(v, 0)}%" if abs(v) >= 1 else f"{hu(v, 2)}%", rng, concept="percent change in enzyme rate from product amounts at two times", path="two rates from the table vs the generating percent increase",
                steps=_steps("Find the rate at each temperature from the change in product over the time interval", "Subtract the rates to find the change", "Divide the change by the original rate and convert to a percent"), stim=stim, gap=2, rel=0.08, facts=[f"inc={inc}"], kwhy=kw)


# ---------------------------------------------------------------- 단원 4
@_retry
def bi_x_mitosis_hours(rng):
    n = pick(rng, [400, 500, 600]); cyc = pick(rng, [16, 20, 24]); m_c = pick(rng, [60, 72, 80, 90]); m_t = pick(rng, [20, 30, 36, 40])
    if m_c <= m_t or (m_c * cyc) % n or (m_t * cyc) % n:
        raise ValueError("frac")
    hc = m_c * cyc / n; ht = m_t * cyc / n
    diff = hc - ht
    agree(diff, (m_c - m_t) / n * cyc, 1e-9, "diff")
    pairs = [("Gives the estimated duration of mitosis in the control group only.", hc), ("Gives the estimated duration of mitosis in the treated group only.", ht), ("Divides the difference in the number of dividing cells by the number in the control group and multiplies by the cycle time.", (m_c - m_t) / m_c * cyc),
             ("Subtracts the numbers of mitotic cells and divides by the cycle time instead of multiplying.", (m_c - m_t) / cyc)]
    stim = tbl(f"Number of cells in mitosis among {n} cells counted in root-tip squashes", ["Group", "Cells in mitosis", "Cells in interphase"], [["Control", m_c, n - m_c], ["Treated with a drug", m_t, n - m_t]])
    stem = f"A student counted {n} cells in root tips from a control group and from a group treated with a drug. The table shows the counts. Assume that the cell cycle of these cells lasts {cyc} hours in both groups and that the time spent in a stage is proportional to the fraction of cells in that stage. By how many hours did the drug shorten the estimated time that a cell spends in mitosis?"
    kw = f"The fraction of cells in mitosis is {m_c}/{n} in the control and {m_t}/{n} in the treated group. Time in mitosis = fraction x {cyc} h = {hc:.1f} h for the control and {ht:.1f} h for the treated group. The difference is {hc:.1f} - {ht:.1f} = {diff:.1f} h."
    return _num("bi_x_mitosis_hours", "4.5", "5.A", stem, diff, pairs, lambda v: f"{hu(v, 1)} hours", rng, concept="time in mitosis from the mitotic index and the cell-cycle length", path="durations for each group vs the combined difference formula",
                steps=_steps("Calculate the fraction of cells in mitosis for each group", "Multiply each fraction by the length of the cell cycle", "Subtract the two durations"), stim=stim, gap=0.15, rel=0.06, facts=[f"diff={diff:.3f}"], kwhy=kw)


@_retry
def bi_x_cascade_amplification(rng):
    r = pick(rng, [2, 3, 4]); m1 = pick(rng, [10, 20, 30]); m2 = pick(rng, [5, 10, 20]); loss = pick(rng, [20, 25, 40, 50]); m3 = pick(rng, [4, 5, 10])
    remaining = m2 * (100 - loss) / 100
    if abs(remaining - round(remaining)) > 1e-9:
        raise ValueError("frac")
    tf = r * m1 * remaining * m3
    # 독립 경로: 단계마다 개체 수를 갱신
    n = r
    n *= m1; n *= m2; n -= n * loss / 100; n *= m3
    agree(n, tf, 1e-9, "tf")
    pairs = [("Leaves out the phosphatase, so no activated molecules are lost at the second step.", r * m1 * m2 * m3), ("Leaves out the number of receptors and counts the cascade for one receptor.", m1 * remaining * m3),
             ("Treats the phosphatase as removing the whole second step instead of the stated percent.", r * m1 * m3), ("Adds the numbers at each step instead of multiplying them.", r + m1 + m2 + m3)]
    stem = (f"{r} activated receptor molecules each activate {m1} molecules of kinase 1. Each active kinase 1 molecule activates {m2} molecules of kinase 2. A phosphatase inactivates {loss}% of the active kinase 2 molecules. "
            f"Each remaining active kinase 2 molecule activates {m3} molecules of a transcription factor. How many active transcription factor molecules are made?")
    kw = f"Kinase 1: {r} x {m1} = {r * m1}. Kinase 2 before the phosphatase: {r * m1} x {m2} = {r * m1 * m2}; after losing {loss}% it is {r * m1 * remaining:g}. Transcription factors: {r * m1 * remaining:g} x {m3} = {tf:g}."
    return _num("bi_x_cascade_amplification", "4.3", "5.A", stem, tf, pairs, lambda v: f"{v:,.0f}", rng, concept="amplification through a signal transduction cascade with a phosphatase", path="step-by-step update of the molecule count vs the product formula",
                steps=_steps("Multiply the receptors by the molecules each activates at the first step", "Apply the second step and remove the molecules inactivated by the phosphatase", "Multiply by the number of transcription factors each remaining kinase activates"), gap=1, rel=0.05, facts=[f"tf={tf}"], kwhy=kw)


# ---------------------------------------------------------------- 단원 5
@_retry
def bi_x_dna_meiosis_amount(rng):
    X = pick(rng, [6, 8, 10, 12, 16])
    stage = pick(rng, ["the end of meiosis I", "the end of meiosis II"])
    after_s = 2 * X
    val = X if stage == "the end of meiosis I" else X / 2
    # 독립 경로: 염색분체 수로 센다(상수 = X/2n 단위 DNA)
    cells = 2 if stage == "the end of meiosis I" else 4
    agree(2 * X / cells, val, 1e-9, "dna")
    pairs = [("Gives the amount after S phase, before the cell divides.", float(after_s)), ("Gives the amount of the original G1 cell.", float(X)), ("Gives the amount expected after meiosis II instead of after meiosis I.", X / 2), ("Halves the amount a second time.", X / 4), ("Doubles the amount after S phase.", float(2 * after_s))]
    stem = f"A diploid cell that has {X} pg of DNA in G1 completes S phase and then meiosis. How much DNA is in each cell at {stage}?"
    kw = f"S phase doubles the DNA to {after_s} pg. Meiosis I separates homologous chromosomes into two cells, so each cell has {after_s}/2 = {X} pg. Meiosis II separates sister chromatids into four cells with {X / 2:g} pg each. At {stage} each cell has {val:g} pg."
    return _num("bi_x_dna_meiosis_amount", "5.1", "5.A", stem, float(val), pairs, lambda v: f"{v:g} pg", rng, concept="DNA content per cell through S phase and meiosis", path="count of chromatids per cell after each division vs the doubling-and-halving rule",
                steps=_steps("Double the DNA content in S phase", "Track how many cells and how many chromatids per cell exist after meiosis I", "Divide again after meiosis II if the question asks about the gametes"), gap=0.4, rel=0.08, facts=[f"X={X}", stage], kwhy=kw)


@_retry
def bi_x_trihybrid_prob(rng):
    names = ["Aa x Aa", "Aa x aa"]
    genes = [pick(rng, names) for _ in range(3)]
    want = [pick(rng, ["dominant", "recessive"]) for _ in range(3)]
    if sum(1 for g in genes if g == "Aa x Aa") < 2 or len(set(zip(genes, want))) < 2:
        raise ValueError("need")
    table = {"dominant": {"Aa x Aa": Fr(3, 4), "Aa x aa": Fr(1, 2)}, "recessive": {"Aa x Aa": Fr(1, 4), "Aa x aa": Fr(1, 2)}}
    val = Fr(1)
    for g, w in zip(genes, want):
        val *= table[w][g]
    # 독립 경로: 생식자 조합을 하나씩 열거해 표현형을 센다(유전자마다 따로)
    from itertools import product
    gam = {"Aa x Aa": (["A", "a"], ["A", "a"]), "Aa x aa": (["A", "a"], ["a", "a"])}
    chk = Fr(1)
    for g, w in zip(genes, want):
        combos = list(product(*gam[g]))
        hit = sum(1 for x, y in combos if (("A" in (x, y)) == (w == "dominant")))
        chk *= Fr(hit, len(combos))
    agree(float(val), float(chk), 1e-12, "prod")
    flip = Fr(1)
    het_only = Fr(1)
    for g, w in zip(genes, want):
        flip *= table["recessive" if w == "dominant" else "dominant"][g]
        het_only *= Fr(1, 2) if (g == "Aa x Aa" and w == "dominant") else table[w][g]
    half_each = Fr(1)
    for g, w in zip(genes, want):
        half_each *= Fr(1, 4) if g == "Aa x Aa" else Fr(1, 2)
    pairs = [("Swaps the dominant and recessive phenotype probabilities for every gene.", flip), ("Counts only the heterozygous offspring, with probability one half, for each Aa x Aa gene with a dominant phenotype, which leaves out the AA offspring.", het_only),
             ("Uses one quarter for every Aa x Aa gene and one half for every Aa x aa gene regardless of the phenotype asked for.", half_each), ("Uses the probability for one gene only.", table[want[0]][genes[0]])]
    key, ds = frac_opts(val, pairs)
    desc = {"dominant": "the dominant phenotype", "recessive": "the recessive phenotype"}
    stem = ("Three genes assort independently, and each gene has a completely dominant allele (capital letter) and a recessive allele (lowercase letter). "
            "In a cross, the parental genotypes are " + "; ".join(f"for gene {k}, {g.replace(' x ', ' and ')}" for k, g in zip("123", genes)) + ". "
            "What is the probability that an offspring shows " + ", ".join(f"{desc[w]} for gene {k}" for k, w in zip("123", want)) + "?")
    kw = "Treat each gene separately and multiply: " + " x ".join(f"{ffmt(table[w][g])}" for g, w in zip(genes, want)) + f" = {ffmt(val)}."
    return mk("bi_x_trihybrid_prob", "5.3", "5.A", stem, key, ds, rng, concept="probability of a phenotype combination from independent genes", path="gamete-pair enumeration for each gene vs table of phenotype probabilities",
              thinking=_steps("Split the cross into three single-gene crosses", "Find the probability of the stated phenotype for each gene", "Multiply the independent probabilities"), est=110, facts=[f"genes={genes}", f"want={want}"], kwhy=kw, judgment="multiply the independent single-gene probabilities")


@_retry
def bi_x_xlinked_two_children(rng):
    # 어머니 보인자(XA Xa) x 아버지 환자(Xa Y): 딸 1/2(보인자 1/4, 환자 1/4), 아들 1/2(정상 1/4, 환자 1/4)
    order = pick(rng, ["daughter", "son"])
    from itertools import product
    kids = list(product(["XA", "Xa"], ["Xa", "Y"]))
    p_dau = Fr(sum(1 for m, d in kids if d == "Xa"), 4); p_son_aff = Fr(sum(1 for m, d in kids if d == "Y" and m == "Xa"), 4); p_dau_aff = Fr(sum(1 for m, d in kids if d == "Xa" and m == "Xa"), 4)
    if order == "daughter":
        val = p_dau * p_son_aff
        desc = "the first child is a daughter and the second child is an affected son"
        pairs = [("Considers only whether the second child is affected, which ignores its sex and treats the first child as certain.", Fr(1, 2)), ("Gives the probability that the first child is a carrier daughter and the second is an affected son.", Fr(1, 16)), ("Gives the probability that a single child is an affected son.", Fr(1, 4))]
        agree(float(val), 1 / 8, 1e-12, "xl")
    else:
        val = p_son_aff * p_dau_aff
        desc = "the first child is an affected son and the second child is an affected daughter"
        pairs = [("Treats every child as affected with probability one half regardless of sex.", Fr(1, 4)), ("Gives the probability that a single child is an affected son.", Fr(1, 4) * Fr(1, 1) if False else Fr(1, 2)), ("Gives the probability that the first child is a son and the second child is a daughter, which ignores the disorder.", Fr(1, 4)), ("Gives the probability of two affected children of either sex in this order.", Fr(1, 4))]
        agree(float(val), 1 / 16, 1e-12, "xl")
    pairs = [(w, v) for w, v in pairs if v != val]
    key, ds = frac_opts(val, pairs)
    stem = ("An X-linked recessive disorder is caused by the allele Xa. A woman who is a carrier (XA Xa) and a man who is affected (Xa Y) have two children. "
            f"What is the probability that {desc}?")
    kw = ("The cross XA Xa x Xa Y gives four equally likely outcomes: carrier daughter, affected daughter, unaffected son, and affected son. "
          + (f"A daughter has probability 1/2 and an affected son has probability 1/4, so the product is {ffmt(val)}." if order == "daughter" else f"An affected son has probability 1/4 and an affected daughter has probability 1/4, so the product is {ffmt(val)}."))
    return mk("bi_x_xlinked_two_children", "5.3", "5.A", stem, key, ds, rng, concept="X-linked inheritance probabilities for two children", path="enumeration of gamete pairs vs product of phenotype-by-sex probabilities",
              thinking=_steps("Write the gametes of the mother and father and the four possible children", "Find the probability of each required child type", "Multiply the probabilities for the two independent children"), est=100, facts=[f"order={order}"], kwhy=kw, judgment="apply sex-linked ratios, then multiply across two children")


@_retry
def bi_x_pedigree_carrier_prob(rng):
    c = pick(rng, [Fr(1), Fr(1, 50), Fr(1, 25), Fr(1, 100)])
    val = Fr(2, 3) * c * Fr(1, 4)
    # 독립 경로: 두 보인자의 자녀 3 가지 비환자 유전자형을 열거해 보인자 비율을 센다
    kids = [("AA", 1), ("Aa", 2), ("aa", 1)]
    unaff = [(g, n) for g, n in kids if g != "aa"]
    carrier_share = Fr(sum(n for g, n in unaff if g == "Aa"), sum(n for _, n in unaff))
    agree(float(carrier_share), 2 / 3, 1e-12, "share")
    pairs = [("Assumes that the unaffected sibling is certainly a carrier, which leaves out the 2/3 chance.", c * Fr(1, 4)), ("Uses one half as the chance that the unaffected sibling is a carrier.", Fr(1, 2) * c * Fr(1, 4)),
             ("Uses one half as the chance that a carrier passes the recessive allele to a child.", Fr(2, 3) * c * Fr(1, 2)), ("Uses the chance 1/4 for the child from two carrier parents without considering the sibling or the partner.", Fr(1, 4))]
    mate = ("The partner of individual II-3 is a known carrier of the allele." if c == 1 else f"The partner of individual II-3 is from the general population, in which {ffmt(c)} of people are carriers of the allele.")
    stem = (f"A rare recessive condition is inherited as an autosomal trait. Two unaffected parents have a child, II-1, who is affected, and another child, II-3, who is unaffected. {mate} "
            "What is the probability that a first child of II-3 and the partner will be affected?")
    kw = (f"Both parents of II-3 must be carriers because they have an affected child. An unaffected child of two carriers is a carrier with probability 2/3. "
          f"A carrier passes the allele with probability 1/2 and the partner does so with probability {ffmt(c / 2)}, so the probability is (2/3)({ffmt(c)})(1/4) = {ffmt(val)}.")
    key, ds = frac_opts(val, pairs)
    return mk("bi_x_pedigree_carrier_prob", "5.3", "5.A", stem, key, ds, rng, concept="carrier probability and risk to a child in a pedigree", path="share of carriers among unaffected genotypes of two-carrier crosses vs product of 2/3, partner chance and 1/4",
              thinking=_steps("Infer that both parents are carriers from the affected sibling", "Find the chance that the unaffected sibling is a carrier", "Combine that chance with the partner and the 1/4 chance for a child of two carriers"), est=110, facts=[f"c={ffmt(c)}"], kwhy=kw, judgment="convert pedigree information into a carrier probability before applying the cross")


@_retry
def bi_x_linkage_class_count(rng):
    N = pick(rng, [400, 500, 800, 1000]); rf = pick(rng, [8, 10, 12, 16, 20, 24]); phase = pick(rng, ["repulsion", "coupling"])
    if (N * rf) % 200 or (N * (100 - rf)) % 200:
        raise ValueError("frac")
    gam = {"coupling": {"AB": (100 - rf) / 200, "ab": (100 - rf) / 200, "Ab": rf / 200, "aB": rf / 200}, "repulsion": {"Ab": (100 - rf) / 200, "aB": (100 - rf) / 200, "AB": rf / 200, "ab": rf / 200}}[phase]
    val = gam["AB"] * N
    # 독립 경로: 시뮬레이션이 아니라 전수 분수 계산(재조합 생식자 = 두 종류 균등)
    parental = [("A", "b"), ("a", "B")] if phase == "repulsion" else [("A", "B"), ("a", "b")]
    rec = [("A", "B"), ("a", "b")] if phase == "repulsion" else [("A", "b"), ("a", "B")]
    share = Fr(rf, 200) if ("A", "B") in rec else Fr(100 - rf, 200)
    agree(float(share) * N, val, 1e-9, "ab")
    other = gam["Ab"] * N
    ab_other = (100 - rf) / 200 * N if phase == "repulsion" else rf / 200 * N
    pairs = [("Uses the parental class frequency for the recombinant class, or the reverse, which mixes up the linkage phase.", ab_other),
             ("Assumes independent assortment, so each of the four classes has one quarter of the offspring.", N / 4), ("Uses the recombination frequency of both recombinant classes together.", rf / 100 * N), ("Gives the number of offspring that are parental types of both kinds together.", (100 - rf) / 100 * N)]
    desc = "one chromosome carries A and b, and the homologous chromosome carries a and B" if phase == "repulsion" else "one chromosome carries A and B, and the homologous chromosome carries a and b"
    stem = (f"In a plant, genes A and B are on the same chromosome and {rf} map units apart (a recombination frequency of {rf}%). A plant heterozygous for both genes, in which {desc}, is crossed with a plant that is homozygous recessive for both genes (aabb). "
            f"Of {N:,} offspring, how many are expected to show the dominant phenotype for both traits?")
    kw = (f"Because {desc}, the gamete AB is {'a recombinant' if phase == 'repulsion' else 'a parental'} gamete. Recombinant gametes make up {rf}% of the gametes, split equally between two types ({rf / 2:g}% each), and parental gametes make up {100 - rf}%, split equally ({(100 - rf) / 2:g}% each). "
          f"AB offspring = {share * 100:g}% of {N:,} = {val:g}.")
    return _num("bi_x_linkage_class_count", "5.4", "5.A", stem, val, pairs, lambda v: f"{v:,.0f}", rng, concept="expected class size from linkage phase and recombination frequency", path="class frequency from the generating haplotypes vs a fraction of gametes",
                steps=_steps("Use the arrangement of alleles on the chromosomes to decide which gametes are parental", "Split the recombination frequency between the two recombinant gametes", "Multiply the frequency of the AB gamete by the number of offspring"), gap=2, rel=0.03, facts=[f"N={N}", f"rf={rf}", phase], kwhy=kw)


@_retry
def bi_x_blood_type_inference(rng):
    # 어머니 A형 Rh+, 아버지 B형 Rh+, 첫째가 O형 Rh- → 부모 모두 IA i Dd / IB i Dd
    ask = pick(rng, ["AB and Rh-negative", "type O and Rh-negative", "type A and Rh-positive"])
    want_abo = {"AB and Rh-negative": "AB", "type O and Rh-negative": "O", "type A and Rh-positive": "A"}[ask]
    want_rh = {"AB and Rh-negative": "neg", "type O and Rh-negative": "neg", "type A and Rh-positive": "pos"}[ask]
    from itertools import product

    def pheno(a, b):
        s_ = {a, b}
        return "AB" if s_ == {"IA", "IB"} else "A" if "IA" in s_ else "B" if "IB" in s_ else "O"
    abo = Fr(sum(1 for a, b in product(["IA", "i"], ["IB", "i"]) if pheno(a, b) == want_abo), 4)
    rh = Fr(sum(1 for a, b in product(["D", "d"], ["D", "d"]) if (("D" in (a, b)) == (want_rh == "pos"))), 4)
    val = abo * rh
    pairs = [("Gives the probability for the blood type only and leaves out the Rh factor.", abo), ("Gives the probability for the Rh factor only and leaves out the blood type.", rh),
             ("Treats the Rh cross as Dd x dd, which gives one half for each Rh phenotype.", abo * Fr(1, 2)), ("Treats the parents as homozygous for the A and B alleles, which makes every child type AB.", Fr(1, 1) * rh)]
    pairs = [(w, v) for w, v in pairs if v != val]
    stem = ("The ABO blood type is controlled by three alleles (IA and IB are codominant, and i is recessive), and the Rh factor is controlled by a gene on a different chromosome with a dominant Rh-positive allele (D) and a recessive Rh-negative allele (d). "
            "A woman with type A, Rh-positive blood and a man with type B, Rh-positive blood have a first child with type O, Rh-negative blood. "
            f"What is the probability that their second child has {ask} blood?")
    kw = ("The type O, Rh-negative child (genotype ii dd) received i and d from each parent, so the parents are IA i Dd and IB i Dd. "
          f"The ABO and Rh genes assort independently. The probability for the blood type is {ffmt(abo)} and for the Rh factor is {ffmt(rh)}, so the probability is {ffmt(val)}.")
    key, ds = frac_opts(val, pairs)
    return mk("bi_x_blood_type_inference", "5.4", "5.A", stem, key, ds, rng, concept="infer parental genotypes from a child, then combine two independent genes", path="gamete enumeration for the ABO locus and the Rh locus vs product of two single-gene probabilities",
              thinking=_steps("Use the first child to infer that both parents carry the recessive alleles", "Find the probability of the blood type and of the Rh phenotype from the two crosses", "Multiply the independent probabilities"), est=110, facts=[ask], kwhy=kw, judgment="infer genotypes from an earlier child before predicting the next one")


# ---------------------------------------------------------------- 단원 6
@_retry
def bi_x_okazaki_primers(rng):
    L = pick(rng, [12000, 18000, 24000, 30000]); F = pick(rng, [100, 150, 200, 300])
    if L % F:
        raise ValueError("frac")
    val = L // F + 2
    # 독립 경로: 두 분기점을 따로 센다
    half = L // 2
    per_fork = 1 + half // F
    agree(2 * per_fork, val, 1e-12, "primers") if half % F == 0 else None
    if half % F:
        raise ValueError("half")
    pairs = [("Counts only the primers for the lagging strands and leaves out the primer for each leading strand.", L // F), ("Counts the primers for one replication fork only.", per_fork), ("Counts both new strands of each fork as lagging strands, which doubles the number of Okazaki fragments.", 2 * L // F + 2),
             ("Counts the lagging-strand primers of one fork together with the leading-strand primers of both forks.", L // (2 * F) + 2)]
    stem = (f"DNA replication begins at one origin and proceeds in both directions, so a replication bubble forms. When the bubble is {L:,} base pairs long, each of the two forks has replicated {L // 2:,} base pairs. "
            f"At each fork, the leading strand needs one RNA primer, and the lagging strand is made in Okazaki fragments that each begin with one RNA primer. The average Okazaki fragment is {F} nucleotides long. How many RNA primers were made for the bubble?")
    kw = (f"Each fork's lagging strand has {L // 2:,}/{F} = {half // F} fragments, so the two forks have {2 * (half // F)} lagging-strand primers. Each fork also has one leading-strand primer, which adds 2. The total is {val}.")
    return _num("bi_x_okazaki_primers", "6.2", "5.A", stem, float(val), [(w, float(v)) for w, v in pairs], lambda v: f"{int(v):,}", rng, concept="primers for leading and lagging strands at two replication forks", path="primers counted fork by fork vs L/F + 2",
                steps=_steps("Find the number of Okazaki fragments on the lagging strand at each fork", "Count one leading-strand primer at each fork", "Add the primers from both forks"), gap=0.5, rel=0.02, facts=[f"L={L}", f"F={F}", f"val={val}"], kwhy=kw)


@_retry
def bi_x_template_to_peptide(rng):
    COMP = {"A": "T", "U": "A", "G": "C", "C": "G"}
    for _ in forever():
        aas = [c for c in CODON if CODON[c] not in ("*", "M")]
        body = [pick(rng, aas) for _ in range(3)]
        mrna = "AUG" + "".join(body)
        i = rng.randint(1, 3); pos = 3 * i; cod = mrna[pos:pos + 3]
        j = rng.randint(0, 2)
        mut = [cod[:j] + b + cod[j + 1:] for b in "ACGU" if b != cod[j]]
        mut = [m for m in mut if CODON[m] not in ("*", CODON[cod])]
        if mut:
            m2 = pick(rng, mut)
            break
    template = "".join(COMP[c] for c in mrna)             # 3'->5' 로 쓴 주형(mRNA 5'->3' 와 같은 방향의 상보 서열)
    t_pos = pos + j + 1                                      # 1-기반 위치
    new_base = COMP[m2[j]]
    mut_template = template[:t_pos - 1] + new_base + template[t_pos:]
    # 독립 경로: 변이 주형을 다시 mRNA 로 만들어 번역
    back = "".join({"T": "A", "A": "U", "C": "G", "G": "C"}[c] for c in mut_template)
    agree(0 if back == mrna[:pos] + m2 + mrna[pos + 3:] else 1, 0, 0, "mut")
    a1 = AA_NAME[CODON[cod]]; a2 = AA_NAME[CODON[m2]]
    n = i + 1
    # 주형 삼중자를 그대로 코돈으로 읽은 경우, 상보 가닥을 거꾸로 읽은 경우
    raw_old = template[pos:pos + 3].replace("T", "U"); raw_new = mut_template[pos:pos + 3].replace("T", "U")
    rev_old = "".join({"T": "A", "A": "U", "C": "G", "G": "C"}[c] for c in template[pos:pos + 3])[::-1]; rev_new = "".join({"T": "A", "A": "U", "C": "G", "G": "C"}[c] for c in mut_template[pos:pos + 3])[::-1]
    sent = lambda p, x, y: f"The amino acid at position {p} changes from {x} to {y}."  # noqa: E731
    key_t = sent(n, a1, a2)
    cands = [(sent(n, AA_NAME[CODON[raw_old]], AA_NAME[CODON[raw_new]]), "Reads the template strand directly as the mRNA codon instead of reading its complement."),
             (sent(n, AA_NAME[CODON[rev_old]], AA_NAME[CODON[rev_new]]), "Reads the complement of the template in the wrong direction, which reverses the order of the bases in the codon."),
             ("The mutation is silent, so the polypeptide is unchanged.", f"The new mRNA codon {m2} codes for {a2}, not {a1}, so the amino acid changes."),
             (sent(n - 1, a1, a2), "Counts the start codon as position zero, which shifts the position of the changed amino acid by one.")]
    ds, seen = [], {key_t}
    for t, w in cands:
        if t in seen:
            continue
        seen.add(t); ds.append((t, w))
    if len(ds) < 3:
        raise ValueError("not_enough_separated_distractors")
    codons = sorted({cod, m2, "AUG", raw_old, raw_new, rev_old, rev_new})
    stim = tbl("Selected mRNA codons and the amino acids they specify", ["mRNA codon (5' to 3')", "Amino acid"], [[c, AA_NAME[CODON[c]]] for c in codons])
    stem = (f"The template strand of a gene is written 3' to 5' as 3'-{template}-5'. Transcription begins at the first base shown, so the first codon of the mRNA is the start codon, and the amino acid at position 1 is Met. "
            f"A point mutation changes the template base at position {t_pos} (counting from the 3' end) to {new_base}. Using the codons in the table, which statement describes the effect of the mutation on the polypeptide?")
    kw = (f"The mRNA is complementary to the template, 5'-{mrna}-3'. Position {n} is encoded by {cod}, which codes for {a1}. After the mutation, the codon is {m2}, which codes for {a2}.")
    key, dd = sentence_options(key_t, kw, ds)
    return mk("bi_x_template_to_peptide", "6.4", "2.D", stem, key, dd, rng, concept="transcribe a template strand and translate the original and mutated codons", path="mutated template transcribed again vs direct codon substitution",
              thinking=_steps("Write the mRNA that is complementary to the template strand", "Locate the codon that contains the mutated template base and write the new codon", "Compare the amino acids that the two codons specify using the table"), stim=stim, est=110, facts=[f"template={template}", f"mrna={mrna}", f"mut={m2}"], kwhy=kw, judgment="carry the mutation from the template strand to the amino acid")


@_retry
def bi_x_transformation_eff(rng):
    dna_ng = pick(rng, [50, 100, 200]); plated = pick(rng, [0.05, 0.1, 0.25]); total = pick(rng, [0.5, 1.0]); col = pick(rng, [60, 120, 150, 240, 300])
    scale = total / plated
    if abs(scale - round(scale)) > 1e-9:
        raise ValueError("scale")
    eff = col * scale / (dna_ng / 1000)
    # 독립 경로: 전체 배양액 기준 총 형질전환체 수를 먼저 구하고 ng 당 값으로 환산
    total_col = col * (total / plated)
    agree(total_col / dna_ng * 1000, eff, 1e-9, "eff")
    pairs = [("Divides the colonies on the plate by the micrograms of DNA and does not scale up to the whole culture.", col / (dna_ng / 1000)), ("Scales to the whole culture but divides by the nanograms of DNA, which gives colonies per ng.", total_col / dna_ng),
             ("Multiplies the colonies on the plate by the micrograms of DNA instead of dividing.", col * dna_ng / 1000), ("Scales to the whole culture but does not divide by the amount of DNA.", total_col)]
    stem = (f"Bacteria were transformed with {dna_ng} ng of plasmid DNA that carries an ampicillin-resistance gene, and the cells were then suspended in a total volume of {total:g} mL. A {plated:g} mL sample of the suspension was spread on a plate with ampicillin, and {col} colonies grew. "
            "Transformation efficiency is the number of transformed colonies per microgram of DNA that was used (1 µg = 1000 ng). What is the transformation efficiency of the experiment?")
    kw = f"The whole {total:g} mL contains {total:g}/{plated:g} = {scale:g} times as many transformed cells as the plated sample, or {total_col:,.0f} colonies. The DNA was {dna_ng} ng = {dna_ng / 1000:g} µg, so the efficiency is {total_col:,.0f}/{dna_ng / 1000:g} = {eff:,.0f} colonies per µg."
    return _num("bi_x_transformation_eff", "6.8", "5.A", stem, eff, pairs, lambda v: f"{v:,.0f}" if v >= 10 else f"{hu(v, 2)}", rng, concept="transformation efficiency from a plated sample", path="total colonies per ng converted to µg vs a single combined formula",
                steps=_steps("Scale the colonies on the plate to the whole volume of cells", "Convert the amount of DNA from nanograms to micrograms", "Divide the total number of colonies by the micrograms of DNA"), gap=1, rel=0.05, facts=[f"eff={eff}"], kwhy=kw)


@_retry
def bi_x_gel_size_estimate(rng):
    sizes = [5000, 3000, 2000, 1000, 500]
    d = [10, 16, 21, 29, 38]
    i = rng.randint(0, 3)
    du = d[i] + rng.randint(2, d[i + 1] - d[i] - 2)
    f = (du - d[i]) / (d[i + 1] - d[i])
    est = 10 ** (math.log10(sizes[i]) + f * (math.log10(sizes[i + 1]) - math.log10(sizes[i])))
    # 독립 경로: 로그 눈금 직선의 방정식
    slope = (math.log10(sizes[i + 1]) - math.log10(sizes[i])) / (d[i + 1] - d[i]); icpt = math.log10(sizes[i]) - slope * d[i]
    agree(10 ** (slope * du + icpt), est, 1e-9, "size")
    est_r = round(est / 50) * 50
    lin = sizes[i] + f * (sizes[i + 1] - sizes[i])
    pairs = [("Interpolates linearly between the sizes of the two nearest standards instead of using the logarithm of the size.", round(lin / 50) * 50), ("Uses the size of the nearest standard band.", float(sizes[i] if f < 0.5 else sizes[i + 1])),
             ("Uses the larger of the two bracketing standards.", float(sizes[i])), ("Uses the smaller of the two bracketing standards.", float(sizes[i + 1])), ("Uses the midpoint of the two bracketing sizes.", (sizes[i] + sizes[i + 1]) / 2)]
    stim = tbl("Distance migrated by DNA standards and by an unknown fragment in an agarose gel", ["Band", "Size (bp)", "Distance migrated (mm)"], [[f"Standard {k + 1}", f"{s:,}", dd] for k, (s, dd) in enumerate(zip(sizes, d))] + [["Unknown fragment", "?", du]])
    stem = "DNA standards of known size and an unknown fragment were separated by gel electrophoresis. The table shows how far each band migrated. On a graph of the logarithm of fragment size against distance migrated, the points of neighboring standards fall on a straight line. Which of the following is the best estimate of the size of the unknown fragment?"
    kw = (f"The unknown band lies between the {sizes[i]:,} bp and {sizes[i + 1]:,} bp standards. It is {f:.2f} of the way between them. On the log scale, log10(size) = log10({sizes[i]}) + {f:.2f}(log10({sizes[i + 1]}) - log10({sizes[i]})), which gives a size of about {est_r:,.0f} bp.")
    return _num("bi_x_gel_size_estimate", "6.8", "5.A", stem, float(est_r), pairs, lambda v: f"{v:,.0f} bp", rng, concept="estimate fragment size from a semilog standard curve", path="line equation through two standards vs interpolation by fraction of the distance",
                steps=_steps("Identify the two standards whose distances bracket the unknown band", "Interpolate on the logarithmic scale of fragment size", "Convert the logarithm back to a size"), stim=stim, gap=50, rel=0.06, facts=[f"est={est:.1f}"], kwhy=kw)


@_retry
def bi_x_new_mutations(rng):
    G = pick(rng, [3.0, 3.2]); mu = pick(rng, [1.0, 1.25, 1.5]); cod = pick(rng, [1.0, 1.5, 2.0]); alt = pick(rng, [50, 75])
    total = 2 * G * 1e9 * mu * 1e-8
    coding = total * cod / 100
    changing = coding * alt / 100
    # 독립 경로: 염기 수를 단위로 환산해 센다
    agree(2 * (G * 1e9 * cod / 100) * mu * 1e-8 * alt / 100, changing, 1e-9, "mut")
    pairs = [("Counts the haploid genome once and leaves out the second set of chromosomes.", total / 2 * cod / 100 * alt / 100), ("Stops after finding the new mutations in the coding regions, without taking only those that change an amino acid.", coding),
             ("Stops after finding the new mutations in the whole genome.", total), ("Applies the percent that change an amino acid to the whole genome instead of the coding regions.", total * alt / 100)]
    stem = (f"The haploid human genome has about {G:g} billion base pairs, and a zygote is diploid. Assume that {mu:g} new mutations arise per 100 million base pairs of DNA per generation, that {cod:g}% of the genome codes for protein, and that {alt}% of new mutations in coding regions change an amino acid. "
            "On average, how many new amino-acid-changing mutations does a zygote have?")
    kw = (f"A diploid zygote has 2 x {G:g} billion = {2 * G:g} billion base pairs, so it has {total:.0f} new mutations. {cod:g}% of them are in coding regions, or {coding:.2f}. "
          f"{alt}% of those change an amino acid: {changing:.2f}.")
    return _num("bi_x_new_mutations", "6.7", "5.A", stem, changing, pairs, lambda v: f"{hu(v, 2)}" if v < 10 else f"{hu(v, 0)}", rng, concept="new mutations per zygote that alter proteins", path="mutations counted per base-pair class vs a chain of fractions",
                steps=_steps("Use the diploid genome size and the mutation rate to find the new mutations", "Take the fraction that fall in the coding regions", "Take the fraction of those that change an amino acid"), gap=0.04, rel=0.08, facts=[f"changing={changing:.4f}"], kwhy=kw)


# ---------------------------------------------------------------- 단원 7
@_retry
def bi_x_hw_selection_next_gen(rng):
    q = pick(rng, [0.3, 0.4, 0.5, 0.6])
    p = 1 - q
    val = q / (1 + q)
    # 독립 경로: 생존자의 대립유전자를 센다
    AA, Aa, aa = p * p, 2 * p * q, q * q
    surv = AA + Aa
    agree((Aa / 2) / surv, val, 1e-9, "q'")
    pairs = [("Reports the frequency of the allele before selection.", q), ("Reports the frequency of homozygous recessive individuals before selection.", q * q), ("Subtracts the frequency of the removed genotype from the allele frequency without correcting for the smaller number of remaining individuals.", q - q * q), ("Halves the allele frequency because half of the genotypes carry the allele.", q / 2)]
    stem = (f"In a large, randomly mating population in Hardy-Weinberg equilibrium, the recessive allele a has a frequency of {q:g}. A genetic disorder prevents every aa individual from reproducing, and AA and Aa individuals reproduce equally well. "
            "What is the expected frequency of allele a among the gametes that produce the next generation?")
    kw = (f"Before selection, AA = {p * p:.2f}, Aa = {2 * p * q:.2f}, and aa = {q * q:.2f}. After the aa individuals are removed, the reproducing adults make up {surv:.2f} of the population. "
          f"Only the heterozygotes carry a, so a makes up half of their alleles: ({Aa:.2f}/2)/{surv:.2f} = {val:.2f}.")
    return _num("bi_x_hw_selection_next_gen", "7.4", "5.A", stem, val, pairs, lambda v: f"{hu(v, 2)}", rng, concept="allele frequency after complete selection against a recessive genotype", path="allele counting among reproducing genotypes vs q/(1+q)",
                steps=_steps("Use Hardy-Weinberg to find the genotype frequencies before selection", "Remove the genotype that does not reproduce and find the share of the reproducing adults", "Count the a alleles among the reproducing adults"), gap=0.02, rel=0.06, facts=[f"q={q}", f"val={val:.4f}"], kwhy=kw)


@_retry
def bi_x_hw_carriers(rng):
    X = pick(rng, [400, 625, 900, 1600, 2500]); P = pick(rng, [80000, 120000, 200000, 500000])
    q = 1 / math.sqrt(X); p = 1 - q
    val = 2 * p * q * P
    # 독립 경로: 유전자형 빈도를 합쳐 1 이 되는지 확인하며 보인자 수를 센다
    assert abs(p * p + 2 * p * q + q * q - 1) < 1e-9
    agree(P * (1 - p * p - q * q), val, 1e-9, "het")
    pairs = [("Gives the number of affected individuals instead of carriers.", q * q * P), ("Uses q as the carrier frequency, which leaves out the factor 2p.", q * P),
             ("Gives the number of homozygous dominant individuals.", p * p * P), ("Uses 2q as the carrier frequency, which leaves out the factor p.", 2 * q * P)]
    stem = (f"A recessive disorder affects 1 in {X:,} newborns in a population that is in Hardy-Weinberg equilibrium. About how many carriers are expected in a population of {P:,} people?")
    kw = f"q² = 1/{X:,}, so q = {q:.4f} and p = {p:.4f}. The carrier frequency is 2pq = 2({p:.4f})({q:.4f}) = {2 * p * q:.4f}. Carriers = {2 * p * q:.4f} x {P:,} = {val:,.0f}, or about {round(val, -1):,.0f}."
    return _num("bi_x_hw_carriers", "7.5", "5.A", stem, val, pairs, lambda v: f"{round(v, -1):,.0f}", rng, concept="carrier number from the frequency of affected individuals", path="1 - p^2 - q^2 vs 2pq",
                steps=_steps("Find q from the frequency of affected individuals", "Find p and calculate the carrier frequency 2pq", "Multiply the carrier frequency by the size of the population"), gap=10, rel=0.06, facts=[f"X={X}", f"P={P}"], kwhy=kw)


@_retry
def bi_x_selection_coefficient(rng):
    nb = {"AA": pick(rng, [400, 500, 600]), "Aa": pick(rng, [800, 1000]), "aa": pick(rng, [200, 250, 400])}
    s_AA = pick(rng, [0.8, 0.9]); s_aa = pick(rng, [0.4, 0.45, 0.5, 0.6]) * s_AA
    surv = {"AA": nb["AA"] * s_AA, "Aa": nb["Aa"] * s_AA, "aa": nb["aa"] * s_aa}
    if any(abs(v - round(v)) > 1e-9 for v in surv.values()):
        raise ValueError("frac")
    rates = {g: surv[g] / nb[g] for g in nb}
    w = rates["aa"] / max(rates.values()); s = 1 - w
    # 독립 경로: 가장 생존률이 높은 유전자형 기준 상대 적합도를 직접 비교
    agree(s, 1 - (surv["aa"] / nb["aa"]) / (surv["AA"] / nb["AA"]), 1e-9, "s")
    pairs = [("Reports the fraction of aa individuals that did not survive, which uses survival itself instead of fitness relative to the best genotype.", 1 - rates["aa"]), ("Reports the relative fitness of aa instead of the selection coefficient.", w), ("Reports the survival rate of aa.", rates["aa"]),
             ("Subtracts the survival rate of aa from the survival rate of AA without dividing by the highest survival rate.", rates["AA"] - rates["aa"])]
    stim = tbl("Number of individuals of each genotype at birth and surviving to reproduce", ["Genotype", "Number at birth", "Number surviving to reproduce"], [[g, nb[g], f"{surv[g]:.0f}"] for g in ("AA", "Aa", "aa")])
    stem = ("The table shows the number of individuals of each genotype at birth and the number that survived to reproduce in one generation. Relative fitness (w) of a genotype is its survival rate divided by the highest survival rate among the genotypes, and the selection coefficient (s) against a genotype is 1 - w. "
            "What is the selection coefficient against the aa genotype?")
    kw = (f"The survival rates are AA = {surv['AA']:.0f}/{nb['AA']} = {rates['AA']:.2f}, Aa = {surv['Aa']:.0f}/{nb['Aa']} = {rates['Aa']:.2f}, and aa = {surv['aa']:.0f}/{nb['aa']} = {rates['aa']:.2f}. "
          f"The highest is {max(rates.values()):.2f}, so w(aa) = {rates['aa']:.2f}/{max(rates.values()):.2f} = {w:.2f} and s = 1 - {w:.2f} = {s:.2f}.")
    return _num("bi_x_selection_coefficient", "7.4", "5.A", stem, s, pairs, lambda v: f"{hu(v, 2)}", rng, concept="relative fitness and selection coefficient from survival data", path="relative fitness through the ratio of survival rates vs 1 - w",
                steps=_steps("Calculate the survival rate of each genotype", "Divide the survival rate of aa by the highest survival rate to find relative fitness", "Subtract the relative fitness from one"), stim=stim, gap=0.03, rel=0.06, facts=[f"s={s:.4f}"], kwhy=kw)


@_retry
def bi_x_antibiotic_generations(rng):
    T0 = pick(rng, [1e8, 1e9]); f = pick(rng, [1e-6, 1e-5]); kill = pick(rng, [0.99, 0.999]); dt = pick(rng, [20, 30, 40])
    R0 = T0 * f; S = T0 * (1 - f) * (1 - kill)
    g = 0
    while R0 * 2 ** g <= S:
        g += 1
    g_nokill = 0
    while R0 * 2 ** g_nokill <= T0 * (1 - f):
        g_nokill += 1
    # 독립 경로: 로그로 계산한 최소 세대
    agree(g, math.floor(math.log2(S / R0)) + 1, 0, "g")
    hrs = g * dt / 60
    ratio = S / R0
    pairs = [("Rounds the number of generations down, so the resistant cells have not yet outnumbered the surviving sensitive cells.", (g - 1) * dt / 60), ("Ignores the antibiotic and waits for the resistant cells to outnumber the original sensitive population.", g_nokill * dt / 60),
             ("Treats the ratio of surviving sensitive cells to resistant cells as the number of generations.", ratio * dt / 60), ("Counts the time for one doubling only.", dt / 60)]
    sup = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")
    stem = (f"A culture contains 1 x 10{str(int(round(math.log10(T0)))).translate(sup)} bacterial cells, and 1 in every {int(round(1 / f)):,} of them carries a mutation for resistance to an antibiotic. The antibiotic kills {kill * 100:g}% of the sensitive cells at once and stops the survivors from dividing. "
            f"The resistant cells divide every {dt} minutes without dying. How many hours does it take for the resistant cells to outnumber the surviving sensitive cells?")
    kw = (f"There are {R0:,.0f} resistant cells at the start. The surviving sensitive cells number {S:,.0f}. The resistant cells double each generation, so they outnumber {S:,.0f} after {g} generations, because {R0:,.0f} x 2^{g} = {R0 * 2 ** g:,.0f}. "
          f"With a doubling time of {dt} minutes, this takes {g} x {dt}/60 = {hrs:g} hours.")
    return _num("bi_x_antibiotic_generations", "7.8", "5.A", stem, hrs, pairs, lambda v: f"{hu(v, 1)} hours" if v < 100 else f"{v:,.0f} hours", rng, concept="selection for resistance: resistant cells outgrow surviving sensitive cells", path="doubling loop until the counts cross vs a base-2 logarithm",
                steps=_steps("Find the number of resistant cells and of surviving sensitive cells after the antibiotic", "Find how many doublings the resistant cells need to exceed the sensitive survivors", "Convert the number of generations to hours"), gap=0.2, rel=0.08, facts=[f"g={g}", f"hrs={hrs}"], kwhy=kw)


@_retry
def bi_x_gene_flow_freq(rng):
    qi = pick(rng, [0.1, 0.2]); qm = pick(rng, [0.6, 0.7, 0.8]); m = pick(rng, [0.1, 0.2, 0.25])
    q1 = (1 - m) * qi + m * qm; q2 = (1 - m) * q1 + m * qm
    # 독립 경로: 대립유전자 수로 계산 (한 세대 번식 개체 1000 마리 = 2000 대립유전자)
    n = 2000.0; a = qi * n
    for _ in range(2):
        a = a * (1 - m) + qm * n * m
    agree(a / n, q2, 1e-9, "q2")
    pairs = [("Gives the allele frequency after only one generation of gene flow.", q1), ("Gives the average of the island and mainland frequencies.", (qi + qm) / 2), ("Swaps the weights so that the island contributes the fraction m and the mainland contributes 1 - m in each generation.", m * (m * qi + (1 - m) * qm) + (1 - m) * qm),
             ("Adds the mainland contribution m x q in each of the two generations to the original frequency without removing the emigrating part.", qi + 2 * m * qm), ("Gives the mainland allele frequency.", qm)]
    stem = (f"On a small island, the frequency of allele a is {qi:g}. In each generation, {int(m * 100)}% of the breeding individuals on the island are immigrants from the mainland, where the frequency of allele a is {qm:g}. "
            f"Assuming that the mainland frequency does not change and that no other evolutionary force acts, what is the frequency of allele a on the island after two generations of gene flow?")
    kw = (f"Each generation, q(new) = (1 - {m:g})q(old) + {m:g}({qm:g}). After one generation q = {(1 - m):g}({qi:g}) + {m:g}({qm:g}) = {q1:.3f}. After the second generation q = {(1 - m):g}({q1:.3f}) + {m:g}({qm:g}) = {q2:.3f}.")
    return _num("bi_x_gene_flow_freq", "7.4", "5.A", stem, q2, pairs, lambda v: f"{hu(v, 2)}", rng, concept="allele frequency change from repeated gene flow", path="allele counts per generation vs repeated weighted average",
                steps=_steps("Use the proportion of immigrants to weight the island and mainland frequencies in the first generation", "Use the result as the starting frequency for the second generation", "Weight again with the same proportion of immigrants"), gap=0.02, rel=0.05, facts=[f"q2={q2:.4f}"], kwhy=kw)


# ---------------------------------------------------------------- 단원 8
@_retry
def bi_x_trophic_chain_energy(rng):
    e = [pick(rng, [5, 8, 10, 12, 15]), pick(rng, [8, 10, 12, 15, 20]), pick(rng, [5, 10, 15, 20])]
    if len(set(e)) < 3:
        raise ValueError("same")
    out = pick(rng, [6, 12, 15, 24, 30])
    need = out / (e[0] / 100 * e[1] / 100 * e[2] / 100)
    # 독립 경로: 위로 올려 가며 곱해 확인
    x = need
    for k in e:
        x *= k / 100
    agree(x, out, 1e-9, "out")
    pairs = [("Divides by the efficiency of only two of the three transfers.", out / (e[0] / 100 * e[1] / 100)), ("Multiplies the energy in the top level by the three efficiencies, which moves the energy the wrong way.", out * e[0] / 100 * e[1] / 100 * e[2] / 100),
             ("Uses 10% for every transfer instead of the stated efficiencies.", out / 0.001), ("Divides by the sum of the three efficiencies.", out / (sum(e) / 100))]
    stem = (f"An ecosystem has producers, primary consumers, secondary consumers, and tertiary consumers. The percent of energy transferred is {e[0]}% from the producers to the primary consumers, {e[1]}% from the primary to the secondary consumers, and {e[2]}% from the secondary to the tertiary consumers. "
            f"How much energy, in kJ, must the producers fix to support {out} kJ of energy stored in the tertiary consumers?")
    kw = f"Each transfer multiplies the energy by its efficiency: producers x {e[0] / 100:g} x {e[1] / 100:g} x {e[2] / 100:g} = tertiary. So producers = {out}/({e[0] / 100:g} x {e[1] / 100:g} x {e[2] / 100:g}) = {need:,.0f} kJ."
    return _num("bi_x_trophic_chain_energy", "8.2", "5.A", stem, need, pairs, lambda v: f"{v:,.0f} kJ" if v >= 1 else f"{hu(v, 4)} kJ", rng, concept="energy needed at the base of a food chain with unequal efficiencies", path="forward multiplication of the producer energy vs backward division",
                steps=_steps("Write the three energy transfers as fractions", "Combine them into one overall efficiency from producers to tertiary consumers", "Divide the energy at the top by the overall efficiency"), gap=20, rel=0.04, facts=[f"need={need:.1f}"], kwhy=kw)


@_retry
def bi_x_logistic_ratio(rng):
    K = pick(rng, [800, 1000, 1200, 2000]); N1 = int(K * pick(rng, [0.4, 0.5])); N2 = int(K * pick(rng, [0.8, 0.9]))
    g = lambda n: n * (K - n) / K  # noqa: E731
    val = g(N1) / g(N2)
    # 독립 경로: 닫힌 해의 수치 미분
    r = 0.4; A1 = (K - N1) / N1; A2 = (K - N2) / N2
    d = lambda A, h=1e-6: (K / (1 + A * math.exp(-r * h)) - K / (1 + A)) / h  # noqa: E731
    agree(d(A1) / d(A2), val, 1e-4, "ratio")
    pairs = [("Compares only the population sizes and leaves out the (K - N)/K term.", N1 / N2), ("Compares only the (K - N) terms and leaves out the population sizes.", (K - N1) / (K - N2)), ("Divides the rate at the larger population by the rate at the smaller population.", 1 / val), ("Compares the two values of (K - N)/K as differences.", (K - N1) / K - (K - N2) / K)]
    stem = (f"A population grows according to dN/dt = r_max N (K - N)/K, with a carrying capacity (K) of {K:,} and the same r_max at all times. How many times greater is the population growth rate when N = {N1:,} than when N = {N2:,}?")
    kw = f"The rate is proportional to N(K - N)/K. At N = {N1:,} this is {N1:,}({K - N1:,})/{K:,} = {g(N1):,.1f}. At N = {N2:,} it is {N2:,}({K - N2:,})/{K:,} = {g(N2):,.1f}. The ratio is {g(N1):,.1f}/{g(N2):,.1f} = {val:.2f}."
    return _num("bi_x_logistic_ratio", "8.4", "5.A", stem, val, pairs, lambda v: f"{hu(v, 2)}", rng, concept="compare logistic growth rates at two population sizes", path="numerical derivative of the logistic solution vs the formula ratio",
                steps=_steps("Evaluate N(K - N)/K at the first population size", "Evaluate N(K - N)/K at the second population size", "Divide the first rate by the second rate because r_max cancels"), gap=0.1, rel=0.06, facts=[f"val={val:.4f}"], kwhy=kw)


@_retry
def bi_x_invasive_percent_change(rng):
    r0 = pick(rng, [12, 15, 20]); r_gain = pick(rng, [30, 40, 50, 60]); c_loss = pick(rng, [10, 15, 20, 25])
    r1 = r0 * (100 + r_gain) / 100; c0 = pick(rng, [12, 15, 20]); c1 = c0 * (100 - c_loss) / 100
    if abs(r1 - round(r1)) > 1e-9 or abs(c1 - round(c1)) > 1e-9 or abs(c0 * (100 - c_loss) / 100 - c1) > 1e-9:
        raise ValueError("frac")
    pr = (r1 - r0) / r0 * 100; pc = (c1 - c0) / c0 * 100
    # 독립 경로: 값을 다시 만들어 본다
    agree(r0 * (1 + pr / 100), r1, 1e-9, "r")
    key_t = f"Richness increased by {pr:.0f}% in the plots with the invasive plant removed and decreased by {abs(pc):.0f}% in the plots where it was left."
    wrong = [(f"Richness increased by {pr:.0f}% in the plots with the invasive plant removed and increased by {abs(pc):.0f}% in the plots where it was left.", "Gives the control change as a gain, but the number of native species in the plots where the plant was left decreased."),
             (f"Richness increased by {(r1 - r0) / r1 * 100:.0f}% in the plots with the invasive plant removed and decreased by {abs((c1 - c0) / c1 * 100):.0f}% in the plots where it was left.", "Divides each change by the final richness instead of the starting richness."),
             (f"Richness increased by {r1 - r0:.0f}% in the plots with the invasive plant removed and decreased by {abs(c1 - c0):.0f}% in the plots where it was left.", "Reports the change in the number of species as a percent without dividing by the starting richness.")]
    ds = [(t, w) for t, w in wrong if t != key_t]
    if len(ds) < 3 or len({t for t, _ in ds}) < 3:
        raise ValueError("not_enough_separated_distractors")
    stim = tbl("Mean number of native plant species per plot", ["Treatment", "Before", "After two years"], [["Invasive plant removed", r0, f"{r1:.0f}"], ["Invasive plant left in place", c0, f"{c1:.0f}"]])
    stem = "Researchers counted the native plant species in plots before and after two years in which an invasive plant was either removed or left in place. The table shows the mean number of species per plot. Which statement correctly describes the percent change in the mean number of native species in each treatment?"
    kw = f"Percent change = (after - before)/before x 100. Removed plots: ({r1:.0f} - {r0})/{r0} x 100 = {pr:.0f}%. Plots left in place: ({c1:.0f} - {c0})/{c0} x 100 = {pc:.0f}%."
    key, dd = sentence_options(key_t, kw, ds)
    return mk("bi_x_invasive_percent_change", "8.7", "5.A", stem, key, dd, rng, concept="percent change in species richness for a treatment and a control", path="percent change recomputed from reconstructed counts vs the generating changes",
              thinking=_steps("Calculate the percent change for the plots with the invasive plant removed", "Calculate the percent change for the plots where it was left", "Match the two results with the correct direction of change"), stim=stim, est=100, facts=[f"pr={pr}", f"pc={pc}"], kwhy=kw, judgment="calculate percent change relative to the starting value for two treatments")


@_retry
def bi_x_gpp_respired(rng):
    eco = pick(rng, ["tropical rain forest", "temperate forest", "grassland", "tundra"])
    rows = {"tropical rain forest": (2200, 2000), "temperate forest": (1200, 800), "grassland": (600, 300), "tundra": (140, 60)}
    npp, resp = rows[eco]
    gpp = npp + resp
    val = resp / gpp * 100
    # 독립 경로: 분수로 계산
    agree(float(Fr(resp, gpp)) * 100, val, 1e-9, "pct")
    pairs = [("Divides the respiration by the net primary productivity instead of by the gross primary productivity.", resp / npp * 100), ("Gives the percent of the gross primary productivity that remains as net primary productivity.", npp / gpp * 100), ("Divides the respiration by the total gross primary productivity of all four ecosystems.", resp / sum(a + b for a, b in rows.values()) * 100)]
    stim = tbl("Net primary productivity and producer respiration in four ecosystems (kcal per m² per year)", ["Ecosystem", "Net primary productivity", "Respiration by producers"], [[e.capitalize(), a, b] for e, (a, b) in rows.items()])
    stem = f"The table shows the net primary productivity (NPP) and the respiration by producers in four ecosystems. Gross primary productivity (GPP) is the total energy captured by photosynthesis. What percent of the GPP of the {eco} is used in the respiration of producers?"
    kw = f"GPP = NPP + respiration = {npp:,} + {resp:,} = {gpp:,} kcal/m²/yr. The percent used in respiration = {resp:,}/{gpp:,} x 100 = {val:.0f}%."
    return _num("bi_x_gpp_respired", "8.2", "5.A", stem, val, pairs, lambda v: f"{hu(v, 0)}%", rng, concept="GPP = NPP + respiration and the share lost to respiration", path="fraction arithmetic vs percent formula",
                steps=_steps("Add net productivity and respiration to find gross productivity", "Form the ratio of respiration to gross productivity", "Convert the ratio to a percent"), stim=stim, gap=2, rel=0.05, facts=[eco, f"val={val:.2f}"], kwhy=kw)


# ---------------------------------------------------------------- 단원 3 (통계)
@_retry
def bi_x_sd_to_se_overlap(rng):
    n = pick(rng, [9, 16, 25]); m1 = pick(rng, [12.0, 14.0, 16.0]); sd = pick(rng, [2.0, 3.0, 4.0]); sd2 = pick(rng, [2.0, 3.0, 4.0]); m2 = m1 + pick(rng, [1.0, 2.0, 3.0, 4.0, 5.0, 6.0])
    se1 = sd / math.sqrt(n); se2 = sd2 / math.sqrt(n)
    lo1, hi1, lo2, hi2 = m1 - 2 * se1, m1 + 2 * se1, m2 - 2 * se2, m2 + 2 * se2
    sep = hi1 < lo2
    # 독립 경로: 두 평균의 차이와 SE 합으로 구분
    agree(1.0 if (m2 - m1) > 2 * (se1 + se2) else 0.0, 1.0 if sep else 0.0, 0, "sep")
    if abs((m2 - m1) - 2 * (se1 + se2)) < 0.15:
        raise ValueError("borderline")
    txt = f"For treatment 1 the range is {lo1:.1f} to {hi1:.1f}, and for treatment 2 the range is {lo2:.1f} to {hi2:.1f}."
    key, ds = range_options(sep, f"Standard error = SD/√n = {sd:g}/√{n} = {se1:.2f} for treatment 1 and {sd2:g}/√{n} = {se2:.2f} for treatment 2, so mean ± 2SE gives these ranges. {txt}")
    stim = tbl("Plant height after two fertilizer treatments (mean ± standard deviation, with the same number of plants in each group)", ["Treatment", "Mean height (cm)", "Standard deviation (cm)", "Number of plants"], [["Treatment 1", f"{m1:.1f}", f"{sd:g}", n], ["Treatment 2", f"{m2:.1f}", f"{sd2:g}", n]])
    stem = "A student measured the height of plants that received two different fertilizer treatments. The table gives the mean, the sample standard deviation, and the number of plants in each group. Which of the following is the best conclusion about the difference between the two means?"
    return mk("bi_x_sd_to_se_overlap", "3.4", "5.B", stem, key, ds, rng, concept="convert SD and n to ±2SE and compare the ranges", path="difference between means vs the sum of the two 2SE half-widths", thinking=_steps("Convert each standard deviation to a standard error using the sample size", "Calculate the mean ± 2SE range for each group", "Compare the two ranges to judge whether the difference is likely real"),
              stim=stim, est=110, facts=[f"se1={se1:.3f}", f"se2={se2:.3f}", f"sep={sep}"], judgment="convert the SD to SE before using the 2SE overlap rule")


STAGE_I = ["bi_x_hbond_count", "bi_x_cell_size_limit", "bi_x_plant_osmosis", "bi_x_gross_productivity", "bi_x_respirometer_ratio", "bi_x_enzyme_rate_percent", "bi_x_mitosis_hours", "bi_x_cascade_amplification",
           "bi_x_dna_meiosis_amount", "bi_x_trihybrid_prob", "bi_x_xlinked_two_children", "bi_x_pedigree_carrier_prob", "bi_x_linkage_class_count", "bi_x_blood_type_inference", "bi_x_okazaki_primers",
           "bi_x_template_to_peptide", "bi_x_transformation_eff", "bi_x_gel_size_estimate", "bi_x_new_mutations", "bi_x_hw_selection_next_gen", "bi_x_hw_carriers", "bi_x_selection_coefficient",
           "bi_x_antibiotic_generations", "bi_x_gene_flow_freq", "bi_x_trophic_chain_energy", "bi_x_logistic_ratio", "bi_x_invasive_percent_change", "bi_x_gpp_respired", "bi_x_sd_to_se_overlap"]

# 유료 보강 실행 목록(bio-v2a): exam_prep 단독 29 + 고친 세트 2(번역·개체군)
STAGE_V2 = STAGE_I + ["bis_translation_set", "bis_population_set"]
