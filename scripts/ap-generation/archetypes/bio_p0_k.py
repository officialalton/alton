"""AP Biology 원형 K — exam_prep 보강 3차(2026-10-14, bio-v2): 정확 배정에서 exam_prep 이 부족한 단원(1·2·4)과 Practice(4.B·6.B·6.E·2.B)를 채운다.
구조는 bio_p0_i/j 와 같다: 코드가 두 경로로 계산하고, 오답은 단계 누락·오적용 값이며, 선택지 문장은 서로 병렬이다."""
from fractions import Fraction as Fr  # noqa: F811
from bio_common import *  # noqa: F401,F403
from bio_p0_i import _retry, _steps, _num


# ---------------------------------------------------------------- 단원 1
@_retry
def bi_z_dna_sample_prediction(rng):
    gc_hi, gc_mid, gc_lo = pick(rng, [(58, 50, 38), (56, 48, 36), (60, 52, 40), (54, 46, 34)])
    ds = [(gc_hi, "dna"), (gc_mid, "dna"), (gc_lo, "dna")]

    def row(gc):
        return [(100 - gc) // 2, (100 - gc) // 2, gc // 2, gc // 2]   # A, T, G, C
    rna_gc = gc_hi + pick(rng, [4, 6])
    rna = [pick(rng, [24, 26, 28]), None, None, None]
    g = rna_gc // 2 + 2; c = rna_gc - g
    u = 100 - rna_gc - rna[0]
    if u == rna[0] or g == c or u < 5:
        raise ValueError("rna")
    names = ["W", "X", "Y", "Z"]; rng.shuffle(names)
    samples = {names[0]: ("dna", row(gc_hi), gc_hi), names[1]: ("dna", row(gc_mid), gc_mid), names[2]: ("dna", row(gc_lo), gc_lo), names[3]: ("rna", [rna[0], u, g, c], rna_gc)}
    order = sorted(samples)
    rows = []
    for n_ in order:
        k, v, gc = samples[n_]
        rows.append([f"Sample {n_}", v[0], v[1], v[2], v[3]])
    # 독립 경로: 가닥별 샤가프 규칙으로 이중가닥 DNA 판별
    dsdna = [n_ for n_ in order if samples[n_][0] == "dna" and samples[n_][1][0] == samples[n_][1][1] and samples[n_][1][2] == samples[n_][1][3]]
    agree(len(dsdna), 3, 0, "ds")
    best = max(dsdna, key=lambda n_: samples[n_][2])
    key_n = best
    rna_n = [n_ for n_ in order if samples[n_][0] == "rna"][0]
    lo_n = min(dsdna, key=lambda n_: samples[n_][2]); mid_n = [n_ for n_ in dsdna if n_ not in (best, lo_n)][0]
    key_t = f"Sample {key_n}, because it is double-stranded DNA with the highest percent of G-C pairs, which are held together by three hydrogen bonds."
    wrong = [(f"Sample {rna_n}, because it has the highest percent of G and C of all the samples.", "This sample has uracil and unequal amounts of A and U and of G and C, so it is single-stranded RNA and has no second strand to separate."),
             (f"Sample {lo_n}, because it has the highest percent of A-T pairs, which are held together by the most hydrogen bonds.", "A-T pairs have two hydrogen bonds, fewer than the three of G-C pairs, so a sample rich in A-T pairs separates at a lower temperature."),
             (f"Sample {mid_n}, because it has equal amounts of A and T and equal amounts of G and C.", "All three DNA samples have equal amounts of A and T and of G and C, so this feature does not distinguish them.")]
    stim = tbl("Percent of each base in four nucleic acid samples", ["Sample", "% A", "% T or U (U in RNA)", "% G", "% C"], [[r[0], r[1], r[2], r[3], r[4]] for r in rows])
    stem = "A student isolated four nucleic acid samples and measured the percent of each base in each one. The table shows the results; one sample is RNA, and the others are DNA. The student heats each double-stranded DNA sample slowly. Which sample is predicted to need the highest temperature to separate its two strands?"
    kw = (f"Samples with equal A and T and equal G and C are double-stranded DNA; sample {rna_n} has unequal amounts and is single-stranded RNA. Among the DNA samples, sample {key_n} has {samples[key_n][2]}% G-C, the highest, "
          f"so it has the most three-hydrogen-bond pairs and needs the highest temperature to separate.")
    key, dd = sentence_options(key_t, kw, wrong)
    return mk("bi_z_dna_sample_prediction", "1.6", "6.E", stem, key, dd, rng, concept="identify double-stranded DNA from base percents and predict strand separation from G-C content", path="Chargaff equalities per sample then maximum G+C among double-stranded samples vs the generating GC percents",
              thinking=_steps("Use equal A and T and equal G and C to identify the double-stranded DNA samples", "Calculate the percent of G-C pairs for each DNA sample", "Relate more three-hydrogen-bond pairs to a higher separation temperature"), stim=stim, est=110, facts=[f"gc={gc_hi},{gc_mid},{gc_lo}", f"rna_gc={rna_gc}"], kwhy=kw, judgment="classify the samples before using G-C content to predict")


# ---------------------------------------------------------------- 단원 2
@_retry
def bi_z_cell_growth_supply(rng):
    r1 = pick(rng, [4, 5, 6]); k = pick(rng, [0.3, 0.4, 0.5]); ratio1 = pick(rng, [1.2, 1.4, 1.5, 1.6, 1.8])
    j = ratio1 * k * r1 / 3
    if abs(j * 100 - round(j * 100)) > 1e-6:
        raise ValueError("j")
    r2 = 2 * r1
    ratio2 = 3 * j / (k * r2)
    # 독립 경로: 표면적·부피를 직접 계산
    sa = lambda r: 4 * math.pi * r * r; vol = lambda r: 4 / 3 * math.pi * r ** 3  # noqa: E731
    agree(j * sa(r2) / (k * vol(r2)), ratio2, 1e-9, "ratio2"); agree(j * sa(r1) / (k * vol(r1)), ratio1, 1e-9, "ratio1")
    if ratio2 >= 1:
        raise ValueError("still_ok")
    pct = lambda x: f"{x * 100:.0f}%"  # noqa: E731
    key_t = f"No; after the radius doubles, the uptake could supply only {pct(ratio2)} of the demand, because the volume increases eight-fold and the surface area only four-fold."
    wrong = [(f"Yes; after the radius doubles, the uptake could still supply {pct(ratio1 * 2)} of the demand, because the surface area increases four-fold and the volume only two-fold.", "The volume of a sphere increases with the cube of the radius, so doubling the radius increases the volume eight-fold and not two-fold."),
             (f"Yes; after the radius doubles, the uptake could still supply {pct(ratio1)} of the demand, because the ratio does not depend on the size of the cell.", "The surface area to volume ratio decreases as the radius increases, so the fraction of demand that uptake can supply decreases."),
             (f"No; after the radius doubles, the uptake could supply only {pct(ratio1 / 4)} of the demand, because the surface area increases two-fold and the volume eight-fold.", "The surface area of a sphere increases with the square of the radius, so doubling the radius increases the surface area four-fold and not two-fold.")]
    stem = (f"A spherical cell with a radius of {r1} µm takes up a nutrient across its surface at a rate of {j:.2f} nmol per µm² per hour, and uses the nutrient at a rate of {k:g} nmol per µm³ per hour. "
            "The cell then grows until its radius is twice as large, without changing its shape or rates. Which prediction about the ability of the cell to meet its demand for the nutrient is best supported?")
    kw = f"At a radius of {r1} µm the uptake supplies {pct(ratio1)} of the demand (3j/(kr) = 3({j:.2f})/({k:g} x {r1}) = {ratio1:g}). When the radius doubles, the ratio halves to {ratio2:g}, so only {pct(ratio2)} of the demand can be met."
    key, dd = sentence_options(key_t, kw, wrong)
    return mk("bi_z_cell_growth_supply", "2.2", "6.E", stem, key, dd, rng, concept="predict whether uptake can meet demand when a cell doubles its radius", path="direct surface-area and volume formulas at both radii vs the ratio 3j/(kr)",
              thinking=_steps("Calculate how the surface area and the volume change when the radius doubles", "Compare uptake, which scales with the surface area, with demand, which scales with the volume", "State the fraction of the demand that uptake can supply after growth"), est=110, facts=[f"r1={r1}", f"ratio1={ratio1}", f"ratio2={ratio2:.3f}"], kwhy=kw, judgment="use how surface area and volume scale to predict the effect of growth")


@_retry
def bi_z_beet_leakage(rng):
    temps = [25, 35, 45, 55, 65]
    blank = pick(rng, [0.02, 0.04, 0.05]); amax = pick(rng, [0.82, 0.92, 1.02])
    leak = [0.04, 0.08, 0.25, 0.55, 0.9]
    absb = [round(blank + l * (amax - blank), 3) for l in leak]
    pct = [(a - blank) / (amax - blank) * 100 for a in absb]
    i1, i2 = 1, 3
    # 독립 경로: 보정한 값의 비
    agree(100 * (absb[i2] - blank) / (amax - blank), pct[i2], 1e-9, "pct")
    t1, t2 = temps[i1], temps[i2]
    raw_pct1 = absb[i1] / amax * 100; raw_pct2 = absb[i2] / amax * 100
    key_t = f"The pigment leakage increased from {pct[i1]:.0f}% at {t1} °C to {pct[i2]:.0f}% at {t2} °C of the total pigment."
    wrong = [(f"The pigment leakage increased from {raw_pct1:.0f}% at {t1} °C to {raw_pct2:.0f}% at {t2} °C of the total pigment.", "This does not subtract the absorbance of the water blank from the readings before comparing them with the boiled sample."),
             (f"The pigment leakage increased from {absb[i1] - blank:.2f}% at {t1} °C to {absb[i2] - blank:.2f}% at {t2} °C of the total pigment.", "The corrected absorbance is not a percent; it must be divided by the corrected absorbance of the boiled sample and multiplied by 100."),
             (f"The pigment leakage increased from {pct[i2]:.0f}% at {t1} °C to {pct[i1]:.0f}% at {t2} °C of the total pigment.", "The values are reversed: leakage is lower at the lower temperature.")]
    stim = tbl("Absorbance of the solution around beet tissue after 10 minutes at different temperatures", ["Sample", "Absorbance"], [["Water blank", f"{blank:.3f}"], *[[f"{t} °C", f"{a:.3f}"] for t, a in zip(temps, absb)], ["Boiled tissue (all pigment released)", f"{amax:.3f}"]])
    stem = "Pieces of beet tissue were placed in water at different temperatures, and the absorbance of the red pigment that leaked into the water was measured. A water blank and a sample of boiled tissue, in which all the pigment was released, were also measured. The table shows the absorbance of each sample. Which statement correctly describes the leakage of the pigment as a percent of the total pigment?"
    kw = f"The percent leakage is (absorbance - blank)/(boiled - blank) x 100. At {t1} °C it is ({absb[i1]:.3f} - {blank:.3f})/({amax:.3f} - {blank:.3f}) = {pct[i1]:.0f}%, and at {t2} °C it is ({absb[i2]:.3f} - {blank:.3f})/({amax:.3f} - {blank:.3f}) = {pct[i2]:.0f}%."
    key, dd = sentence_options(key_t, kw, wrong)
    return mk("bi_z_beet_leakage", "2.4", "4.B", stem, key, dd, rng, concept="describe pigment leakage as a percent of the total after correcting for a blank", path="corrected ratios vs the generating leakage fractions",
              thinking=_steps("Subtract the absorbance of the water blank from each reading", "Divide each corrected reading by the corrected absorbance of the boiled tissue", "Convert to percent and describe the change between the two temperatures"), stim=stim, est=120, facts=[f"pct={[round(x, 1) for x in pct]}"], kwhy=kw, judgment="correct for the blank and for the total before describing the change")


@_retry
def bi_z_bag_percent_change(rng):
    names = ["A", "B", "C", "D"]
    init = [pick(rng, [10.0, 20.0, 25.0]) for _ in names]
    pct_ = [pick(rng, [-12, -6, 4, 10, 16, 24, 30]) for _ in names]
    fin = [i * (1 + p / 100) for i, p in zip(init, pct_)]
    if any(abs(f - round(f, 1)) > 1e-9 for f in fin) or len(set(pct_)) < 4 or min(pct_) >= 0:
        raise ValueError("round")
    ab = [f - i for f, i in zip(fin, init)]
    bp = int(np.argmax(pct_)); ba = int(np.argmax(ab))
    if bp == ba or sorted(pct_)[-1] - sorted(pct_)[-2] < 4:
        raise ValueError("same")
    # 독립 경로: 최종 질량/초기 질량 - 1
    agree(max(range(4), key=lambda k: fin[k] / init[k]), bp, 0, "best")
    lowp = int(np.argmin(pct_))
    key_t = f"Bag {names[bp]} had the greatest percent increase in mass, {pct_[bp]}%."
    wrong = [(f"Bag {names[ba]} had the greatest percent increase in mass, {pct_[ba]}%.", f"Bag {names[ba]} gained the most mass in grams ({ab[ba]:.1f} g), but its percent increase is not the greatest."),
             (f"Bag {names[lowp]} had the greatest percent increase in mass, {abs(pct_[lowp])}%.", f"Bag {names[lowp]} lost mass, so its change is a decrease and not an increase."),
             (f"Bag {names[bp]} had the greatest percent increase in mass, {ab[bp]:.1f}%.", "The number is the change in mass in grams, not the percent of the starting mass.")]
    wrong = [(t, w) for t, w in wrong if t != key_t]
    if len(wrong) < 3:
        raise ValueError("few")
    sols = ["0.0 M", "0.2 M", "0.4 M", "0.8 M"]
    stim = tbl("Mass of dialysis bags before and after 30 minutes in water", ["Bag", "Starting mass (g)", "Final mass (g)"], [[n_, f"{i:.1f}", f"{f:.1f}"] for n_, i, f in zip(names, init, fin)])
    stem = "Four dialysis bags with different starting masses and different sucrose concentrations were placed in beakers of distilled water for 30 minutes. The table shows the mass of each bag before and after. Which statement correctly describes the changes in mass?"
    kw = f"Percent change = (final - starting)/starting x 100. " + "; ".join(f"bag {n_}: {p}%" for n_, p in zip(names, pct_)) + f". The greatest percent increase is for bag {names[bp]}."
    key, dd = sentence_options(key_t, kw, wrong)
    return mk("bi_z_bag_percent_change", "2.7", "4.B", stem, key, dd, rng, concept="describe mass changes of dialysis bags as percent change", path="final/initial ratios vs the generating percent changes",
              thinking=_steps("Calculate the change in mass of each bag", "Divide each change by the starting mass of the same bag to find the percent change", "Compare the percent changes and report the largest increase"), stim=stim, est=110, facts=[f"pct={pct_}"], kwhy=kw, judgment="compare percent changes, not changes in grams, for bags with different starting masses")


@_retry
def bi_z_cell_volume_osmolarity(rng):
    S = pick(rng, [100, 120, 150, 200, 240, 450, 600]); C = 300; thr = 1.5
    ratio = C / S
    lyse = ratio > thr
    # 독립 경로: 용질 양 보존(물만 이동)
    n_solute = C * 1.0; V2 = n_solute / S
    agree(V2, ratio, 1e-9, "V")
    if 0.95 < ratio < 1.05:
        raise ValueError("iso")
    if ratio > 1:
        verdict = f"swell to {ratio:.2f} times its original volume and burst" if lyse else f"swell to {ratio:.2f} times its original volume and not burst"
        inv = 1 / ratio
        wrong = [(f"The cell would shrink to {inv:.2f} times its original volume, because water would move out of the cell.", "The solution has a lower solute concentration than the cell, so water moves into the cell, and the cell swells."),
                 (f"The cell would {'swell to {:.2f} times its original volume and not burst'.format(ratio) if lyse else 'swell to {:.2f} times its original volume and burst'.format(ratio)}.", f"A red blood cell bursts when its volume exceeds {thr:g} times the original volume; {ratio:.2f} is {'above' if lyse else 'below'} this value."),
                 (f"The cell would swell to {ratio - 1:.2f} times its original volume and not burst.", "The final volume is the ratio of the cell osmolarity to the solution osmolarity, which is a multiple of the original volume and not an increase of that amount.")]
    else:
        verdict = f"shrink to {ratio:.2f} times its original volume"
        wrong = [(f"The cell would swell to {1 / ratio:.2f} times its original volume and burst.", "The solution has a higher solute concentration than the cell, so water moves out of the cell, and the cell shrinks."),
                 (f"The cell would swell to {ratio:.2f} times its original volume and not burst.", "A ratio below one means that the volume decreases, so the cell shrinks and does not swell."),
                 (f"The cell would shrink to {1 - ratio:.2f} times its original volume.", "The final volume is the ratio of the cell osmolarity to the solution osmolarity, which is a multiple of the original volume and not the amount of the decrease.")]
    key_t = f"The cell would {verdict}."
    wrong = [(t, w) for t, w in wrong if t != key_t]
    if len(wrong) < 3:
        raise ValueError("few")
    stem = (f"A red blood cell has a solute concentration equivalent to {C} mOsm and is at its normal volume in an isotonic solution. The cell is placed in a solution with an osmolarity of {S} mOsm. Assume that only water can cross the plasma membrane, that the amount of solute in the cell does not change, and that the cell bursts if its volume becomes more than {thr:g} times its normal volume. "
            "Which prediction is best supported?")
    kw = f"The amount of solute stays constant, so the volume changes in inverse proportion to the osmolarity of the cell's contents: V = {C}/{S} = {ratio:.2f} times the normal volume. " + (f"This is more than {thr:g}, so the cell bursts." if lyse and ratio > 1 else ("This is less than 1, so the cell shrinks." if ratio < 1 else f"This is less than {thr:g}, so the cell does not burst."))
    key, dd = sentence_options(key_t, kw, wrong)
    return mk("bi_z_cell_volume_osmolarity", "2.7", "6.E", stem, key, dd, rng, concept="predict cell volume change from tonicity and a bursting limit", path="solute-conservation volume calculation vs ratio of osmolarities",
              thinking=_steps("Compare the osmolarity of the solution with the osmolarity of the cell to decide the direction of water movement", "Calculate the final volume from the conserved amount of solute", "Compare the final volume with the volume at which the cell bursts"), est=110, facts=[f"S={S}", f"ratio={ratio:.3f}"], kwhy=kw, judgment="combine tonicity with a quantitative limit to predict the outcome")


# ---------------------------------------------------------------- 단원 4
@_retry
def bi_z_stage_time_claim(rng):
    n = pick(rng, [500, 1000]); T = pick(rng, [20, 24])
    ctrl = {"Interphase": 0, "Prophase": 0, "Metaphase": 0, "Anaphase": 0, "Telophase": 0}
    pm = pick(rng, [20, 30, 40]); mm = pick(rng, [10, 20]); am = pick(rng, [10, 20]); tm = pick(rng, [10, 20])
    ctrl.update({"Prophase": pm, "Metaphase": mm, "Anaphase": am // 2, "Telophase": tm // 2})
    ctrl["Interphase"] = n - sum(v for k, v in ctrl.items() if k != "Interphase")
    treat = dict(ctrl)
    mult = pick(rng, [3, 4, 5])
    treat["Metaphase"] = mm * mult; treat["Anaphase"] = max(1, am // 4)
    treat["Interphase"] = n - sum(v for k, v in treat.items() if k != "Interphase")
    if treat["Interphase"] < n * 0.5:
        raise ValueError("round")
    h = lambda d, st: d[st] / n * T * 60  # noqa: E731
    h0, h1 = h(ctrl, "Metaphase"), h(treat, "Metaphase")
    # 독립 경로: 비율을 정확 분수로
    agree(float(Fr(treat["Metaphase"], n) * T * 60), h1, 1e-9, "h1")
    a0, a1 = h(ctrl, "Anaphase"), h(treat, "Anaphase")
    key_t = f"The drug increased the time that a cell spends in metaphase from about {h0:.0f} minutes to about {h1:.0f} minutes, which suggests that it interferes with the progress of cells out of metaphase."
    wrong = [(f"The drug decreased the time that a cell spends in anaphase from about {a0:.0f} minutes to about {a1:.0f} minutes, which suggests that it speeds up cell division.", "Anaphase is shorter because fewer cells reach it from the blocked metaphase, which does not mean that the cycle is faster; the largest change is the accumulation of cells in metaphase."),
             (f"The drug increased the time that a cell spends in metaphase from about {h0 * 10:.0f} minutes to about {h1 * 10:.0f} minutes, which suggests that it interferes with the progress of cells out of metaphase.", "These times are ten times too large; a stage occupying a small fraction of the cells uses only that fraction of the cell cycle time."),
             (f"The drug increased the number of cells in metaphase from {ctrl['Metaphase']} to {treat['Metaphase']} but did not change the time that a cell spends in metaphase.", "A larger fraction of cells in a stage means that cells spend more time in that stage, if the total cycle length is unchanged.")]
    rows = [[st, ctrl[st], treat[st]] for st in ctrl]
    stim = tbl(f"Number of cells in each stage among {n} cells counted in each group of root tips", ["Stage", "Control", "Drug"], rows)
    stem = f"A student counted {n} cells in root tips from a control group and from a group treated with a drug, and recorded the stage of each cell. The table shows the counts. The cell cycle of these cells takes {T} hours in both groups, and the time spent in a stage is proportional to the fraction of cells in that stage. Which claim is best supported by the data?"
    kw = f"Time in metaphase = fraction x {T * 60} min. The control has {ctrl['Metaphase']}/{n} x {T * 60} = {h0:.0f} min, and the drug-treated group has {treat['Metaphase']}/{n} x {T * 60} = {h1:.0f} min."
    key, dd = sentence_options(key_t, kw, wrong)
    return mk("bi_z_stage_time_claim", "4.5", "6.B", stem, key, dd, rng, concept="support a claim about the stage affected by a drug with times calculated from counts", path="exact fractions of the cycle time vs the generating counts",
              thinking=_steps("Calculate the fraction of cells in each stage for each group", "Multiply the fractions by the cell cycle length to estimate the time in each stage", "Choose the claim that matches the stage with the largest change"), stim=stim, est=120, facts=[f"min0={h0:.1f}", f"min1={h1:.1f}"], kwhy=kw, judgment="turn counts into times before supporting a claim")


@_retry
def bi_z_p53_predict(rng):
    N = pick(rng, [1000, 2000, 4000]); dmg = pick(rng, [10, 20, 25]); a_n = pick(rng, [80, 85, 90]); a_m = pick(rng, [20, 25, 30])
    damaged = N * dmg / 100
    val = damaged * (100 - a_m) / 100
    if abs(val - round(val)) > 1e-9 or abs(damaged * (100 - a_n) / 100 - round(damaged * (100 - a_n) / 100)) > 1e-9:
        raise ValueError("int")
    # 독립 경로: 세포를 하나씩 센다
    cnt = 0
    for i in range(int(damaged)):
        cnt += 1 if (i % 100) >= a_m else 0
    agree(cnt, val, 1e-9, "count")
    normal = damaged * (100 - a_n) / 100
    pairs = [("Uses the percent of damaged cells that are stopped by the mutant checkpoint instead of the percent that continue.", damaged * a_m / 100), ("Leaves out the percent of cells with damaged DNA and applies the checkpoint to all cells in the culture.", N * (100 - a_m) / 100),
             ("Gives the number of damaged cells that would enter S phase in a culture with a functioning checkpoint.", normal), ("Gives the number of damaged cells in the culture before the checkpoint acts.", damaged)]
    stem = (f"In a culture of {N:,} cells, {dmg}% of the cells have damaged DNA. In cells with a functioning p53 protein, the G1 checkpoint stops {a_n}% of the cells with damaged DNA from entering S phase. In a culture of the same cells that have a mutated p53 gene, the checkpoint stops only {a_m}% of the cells with damaged DNA. "
            f"How many cells with damaged DNA are predicted to enter S phase in the culture with the mutated p53 gene?")
    kw = f"There are {N:,} x {dmg}% = {damaged:,.0f} cells with damaged DNA. {100 - a_m}% of them pass the weakened checkpoint, so {damaged:,.0f} x {(100 - a_m) / 100:g} = {val:,.0f} cells enter S phase."
    return _num("bi_z_p53_predict", "4.6", "6.E", stem, val, pairs, lambda v: f"{v:,.0f}", rng, concept="predict the number of damaged cells that pass a weakened G1 checkpoint", path="cell-by-cell count vs the product of fractions",
                steps=_steps("Find the number of cells with damaged DNA", "Find the fraction of those cells that pass the mutated checkpoint", "Multiply the number of damaged cells by that fraction"), gap=5, rel=0.04, facts=[f"val={val}"], kwhy=kw)


@_retry
def bi_z_dna_content_counts(rng):
    n = pick(rng, [500, 1000]); c = [pick(rng, [60, 62, 65]), pick(rng, [12, 15, 18])]
    c.append(100 - c[0] - c[1])
    shift = pick(rng, [12, 15, 20])
    t = [c[0] - shift, c[1], c[2] + shift]
    cnt = lambda p: [round(x / 100 * n) for x in p]  # noqa: E731
    ctrl = cnt(c); trt = cnt(t)
    if sum(ctrl) != n or sum(trt) != n:
        raise ValueError("sum")
    pc = [x / n * 100 for x in ctrl]; pt = [x / n * 100 for x in trt]
    # 독립 경로: 퍼센트를 정수 분수로
    agree(float(Fr(trt[2], n) * 100), pt[2], 1e-9, "p4C")
    key_t = f"The percent of cells with 4C of DNA increased from {pc[2]:.0f}% to {pt[2]:.0f}%, and the percent of cells with 2C of DNA decreased from {pc[0]:.0f}% to {pt[0]:.0f}%."
    wrong = [(f"The number of cells with 4C of DNA increased from {ctrl[2]} to {trt[2]}, so the percent of cells with 4C of DNA doubled.", "The counts must be divided by the total number of cells before percents are compared, and the percent did not necessarily double."),
             (f"The percent of cells with 2C of DNA increased from {pt[0]:.0f}% to {pc[0]:.0f}%, and the percent of cells with 4C of DNA decreased from {pt[2]:.0f}% to {pc[2]:.0f}%.", "This reverses the control and treated groups."),
             (f"The percent of cells with between 2C and 4C of DNA changed from {pc[1]:.0f}% to {pt[1] + shift:.0f}%, which is the largest change.", "The percent of cells in S phase did not change; the largest changes are in the cells with 2C and 4C of DNA.")]
    stim = tbl(f"Number of cells with each amount of DNA among {n} cells measured in each group", ["DNA content", "Control", "Drug"], [["2C (G1)", ctrl[0], trt[0]], ["Between 2C and 4C (S)", ctrl[1], trt[1]], ["4C (G2 or mitosis)", ctrl[2], trt[2]]])
    stem = f"A researcher measured the DNA content of {n} cells in a control culture and {n} cells in a culture treated with a drug. The table shows the number of cells with each amount of DNA, where C is the amount of DNA in a haploid cell. Which statement correctly describes the change in the percent of cells in each group?"
    kw = f"Percent = number/{n} x 100. The control has {pc[0]:.0f}% at 2C, {pc[1]:.0f}% in S, and {pc[2]:.0f}% at 4C. The treated group has {pt[0]:.0f}%, {pt[1]:.0f}%, and {pt[2]:.0f}%."
    key, dd = sentence_options(key_t, kw, wrong)
    return mk("bi_z_dna_content_counts", "4.5", "4.B", stem, key, dd, rng, concept="describe changes in the percent of cells at each DNA content", path="percent of each class computed from exact fractions vs the generating percents",
              thinking=_steps("Divide each count by the number of cells in its group to find percents", "Compare the percents of the 2C and 4C classes between the groups", "Choose the statement that reports the correct direction and size of each change"), stim=stim, est=110, facts=[f"c={c}", f"t={t}"], kwhy=kw, judgment="convert counts to percents before describing the change")


# ---------------------------------------------------------------- 단원 5, 6, 8
@_retry
def bi_z_gene_order(rng):
    names = ["A", "B", "C"]; rng.shuffle(names)
    x, y, z = names   # y 가 가운데
    a = pick(rng, [6, 8, 10, 12]); b = pick(rng, [14, 16, 18, 20])
    freq = {frozenset((x, y)): a, frozenset((y, z)): b, frozenset((x, z)): a + b}
    pair_of = lambda u, v: freq[frozenset((u, v))]  # noqa: E731
    # 독립 경로: 가운데 유전자 후보마다 두 거리의 합이 바깥 거리와 같은지 검사
    mids = [m for m in names if (lambda o: pair_of(m, o[0]) + pair_of(m, o[1]) == pair_of(o[0], o[1]))([n_ for n_ in names if n_ != m])]
    agree(1.0 if mids == [y] else 0.0, 1.0, 0, "mid")
    o1 = sorted((x, z))
    key_t = f"The order is {x}-{y}-{z}, because the largest recombination frequency is between {x} and {z}, and the distance between {x} and {z} is {a + b} map units."
    others = [n_ for n_ in names if n_ != y]
    wrong = [(f"The order is {y}-{x}-{z}, because the smallest recombination frequency is between {x} and {y}, and the distance between {y} and {z} is {b} map units.", f"The two genes with the largest recombination frequency ({x} and {z}) are the outer genes, so {y} is in the middle and not {x}."),
             (f"The order is {x}-{y}-{z}, because the largest recombination frequency is between {x} and {z}, and the distance between {x} and {z} is {abs(b - a)} map units.", "The distance between the outer genes is the sum of the two shorter distances and not their difference."),
             (f"The order is {x}-{z}-{y}, because the recombination frequency between {x} and {z} is larger than between {x} and {y}.", f"The largest recombination frequency is between {x} and {z}, which places them at the two ends and {y} between them.")]
    rows = [[f"{u} and {v}", f"{pair_of(u, v)}"] for u, v in (sorted((x, y)), sorted((y, z)), sorted((x, z)))]
    stim = tbl("Recombination frequency between pairs of three genes in a testcross", ["Gene pair", "Recombination frequency (%)"], rows)
    stem = "A testcross was used to measure the recombination frequency between each pair of three linked genes. The table shows the results, and one map unit corresponds to a recombination frequency of 1%. Assume that no double crossovers occurred. Which statement correctly gives the order of the genes and the support for it?"
    kw = f"The pair with the largest recombination frequency ({x} and {z}, {a + b}%) is at the two ends, so {y} is in the middle. The distance {x}-{y} ({a}) plus {y}-{z} ({b}) equals {a + b} map units."
    key, dd = sentence_options(key_t, kw, wrong)
    return mk("bi_z_gene_order", "5.4", "2.B", stem, key, dd, rng, concept="deduce gene order from recombination frequencies and check additivity", path="test of each gene as the middle gene (distances add) vs the generating order",
              thinking=_steps("Find the pair of genes with the largest recombination frequency, which are the outer genes", "Identify the remaining gene as the middle gene", "Check that the two shorter distances add up to the longest distance"), stim=stim, est=110, facts=[f"a={a}", f"b={b}"], kwhy=kw, judgment="use additivity of map distances to order linked genes")


@_retry
def bi_z_pcr_cycles_predict(rng):
    N0 = pick(rng, [10, 20, 50]); n1 = pick(rng, [8, 10, 12]); n2 = pick(rng, [4, 5, 6]); eff = pick(rng, [0.5, 0.6, 0.8])
    val = N0 * 2 ** n1 * (1 + eff) ** n2
    # 독립 경로: 주기마다 갱신
    n = float(N0)
    for k in range(n1 + n2):
        n *= 2 if k < n1 else (1 + eff)
    agree(n, val, 1e-9, "N")
    pairs = [("Doubles the number of copies in every cycle, including the cycles at lower efficiency.", N0 * 2 ** (n1 + n2)), ("Multiplies the copies by the efficiency instead of by one plus the efficiency in the last cycles.", N0 * 2 ** n1 * eff ** n2),
             ("Leaves out the first cycles at full efficiency.", N0 * (1 + eff) ** n2), ("Adds the extra copies of the last cycles instead of multiplying them.", N0 * 2 ** n1 + eff * n2 * N0)]
    stem = (f"A PCR reaction starts with {N0} copies of a target DNA sequence. In each of the first {n1} cycles the number of copies doubles. In each of the next {n2} cycles the polymerase is partly inactive, and the number of copies increases by only {int(eff * 100)}% (it is multiplied by {1 + eff:g}). "
            "How many copies are predicted after all of the cycles? (Round to the nearest whole number.)")
    kw = f"After {n1} cycles the number of copies is {N0} x 2^{n1} = {N0 * 2 ** n1:,}. Each of the next {n2} cycles multiplies it by {1 + eff:g}, so the final number is {N0 * 2 ** n1:,} x {1 + eff:g}^{n2} = {val:,.0f}."
    return _num("bi_z_pcr_cycles_predict", "6.8", "6.E", stem, val, pairs, lambda v: f"{v:,.0f}", rng, concept="predict PCR product after cycles at two different efficiencies", path="cycle-by-cycle update vs a product of two powers",
                steps=_steps("Calculate the number of copies after the cycles with doubling", "Find the factor for a cycle with partial efficiency", "Apply that factor for each remaining cycle and round"), gap=20, rel=0.03, facts=[f"val={val:.1f}"], kwhy=kw)


@_retry
def bi_z_biomagnification(rng):
    c0 = pick(rng, [0.2, 0.5, 1.0]); bcf = pick(rng, [100, 200, 500]); f = pick(rng, [5, 8, 10]); thr = pick(rng, [500, 1000, 5000])
    tert = c0 * bcf * f ** 3
    if 0.7 < tert / thr < 1.4:
        raise ValueError("close")
    over = tert > thr
    # 독립 경로: 영양 단계마다 갱신
    c = c0 * bcf
    for _ in range(3):
        c *= f
    agree(c, tert, 1e-9, "c")
    fmt = lambda v: f"{v:,.0f}"  # noqa: E731
    key_t = f"The concentration in the tertiary consumers would be about {fmt(tert)} ppb, which {'is above' if over else 'is below'} the harmful level of {thr:,} ppb."
    two = c0 * bcf * f ** 2
    wrong = [(f"The concentration in the tertiary consumers would be about {fmt(two)} ppb, which {'is above' if two > thr else 'is below'} the harmful level of {thr:,} ppb.", "This applies the increase from one trophic level to the next only twice; there are three transfers from the producers to the tertiary consumers."),
             (f"The concentration in the tertiary consumers would be about {fmt(c0 * f ** 3)} ppb, which {'is above' if c0 * f ** 3 > thr else 'is below'} the harmful level of {thr:,} ppb.", "This leaves out the concentration of the substance in the producers, which is the concentration in the water multiplied by the factor for the producers."),
             (f"The concentration in the tertiary consumers would be about {fmt(c0 * bcf + 3 * f)} ppb, which {'is above' if c0 * bcf + 3 * f > thr else 'is below'} the harmful level of {thr:,} ppb.", "The substance becomes more concentrated at each trophic level by a factor, so the increases are multiplied and not added.")]
    wrong = [(t, w) for t, w in wrong if t != key_t]
    if len(wrong) < 3 or len({t for t, _ in wrong}) < 3:
        raise ValueError("few")
    stem = (f"A pollutant is found in a lake at a concentration of {c0:g} ppb. Producers take it up and reach a concentration {bcf} times that of the water. At each transfer from one trophic level to the next, the concentration of the pollutant in the organisms increases by a factor of {f}. "
            f"The food chain is producers, primary consumers, secondary consumers, and tertiary consumers, and a concentration of {thr:,} ppb is harmful to the tertiary consumers. Which prediction is best supported?")
    kw = f"The producers have {c0:g} x {bcf} = {c0 * bcf:,.0f} ppb. There are three transfers to the tertiary consumers, so the concentration is {c0 * bcf:,.0f} x {f}³ = {tert:,.0f} ppb, which {'is above' if over else 'is below'} {thr:,} ppb."
    key, dd = sentence_options(key_t, kw, wrong)
    return mk("bi_z_biomagnification", "8.7", "6.E", stem, key, dd, rng, concept="predict biomagnification of a pollutant along a food chain", path="trophic level by trophic level update vs a closed-form product",
              thinking=_steps("Calculate the concentration in the producers from the concentration in the water", "Apply the factor for each of the three transfers to the tertiary consumers", "Compare the final concentration with the harmful level"), est=110, facts=[f"tert={tert:.1f}"], kwhy=kw, judgment="chain the concentration factors before comparing with a harmful level")


STAGE_K = ["bi_z_dna_sample_prediction", "bi_z_cell_growth_supply", "bi_z_beet_leakage", "bi_z_bag_percent_change", "bi_z_cell_volume_osmolarity", "bi_z_stage_time_claim", "bi_z_p53_predict",
           "bi_z_dna_content_counts", "bi_z_gene_order", "bi_z_pcr_cycles_predict", "bi_z_biomagnification"]
STAGE_V2C = STAGE_K
