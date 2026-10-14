"""AP Biology P0 원형 B — 단원 3(세포 에너지학)·4(세포 소통과 세포 주기)."""
from bio_common import *  # noqa: F401,F403

# ============================ 단원 3 ============================
bi_enzyme_active_site = make_bank_archetype("bi_enzyme_active_site", "3.1", "1.B", [
    B("An enzyme catalyzes the breakdown of one specific substrate and does not act on similar molecules. Which feature of enzyme structure best explains this specificity?",
      ("The shape and chemistry of the active site fit the substrate.", "Only substrates whose shape and charges complement the active site bind and react."),
      [("The enzyme is consumed in each reaction, so it can act on only one molecule.", "Enzymes are not consumed and are reused."),
       ("The enzyme changes the free energy difference between reactants and products.", "Enzymes lower the activation energy and do not change the free energy difference."),
       ("The enzyme supplies the energy that the substrate needs to react.", "Enzymes speed reactions by lowering activation energy; they do not supply energy.")]),
    B("Which statement correctly describes how an enzyme speeds up a reaction?",
      ("It lowers the activation energy by stabilizing the transition state when the substrate binds.", "Binding to the active site lowers the energy barrier so more molecules react per unit time."),
      [("It raises the temperature of the substrate so that more molecules react.", "Enzymes do not heat the substrate."),
       ("It changes the products that form so that the reaction releases more energy.", "Enzymes do not change the products or the energy released."),
       ("It permanently combines with the substrate to form the product.", "The enzyme is released unchanged after the reaction.")]),
    B("A mutation changes one amino acid in the active site of an enzyme. Which outcome is most likely?",
      ("The enzyme may bind substrate less effectively because the shape or chemistry of the site has changed.", "A change in the active site can reduce substrate binding and catalysis."),
      [("The enzyme will lose its primary structure but still function normally.", "A mutation changes the primary structure, and the change may affect function."),
       ("The enzyme will begin to catalyze every reaction in the cell.", "Enzymes remain specific, and a mutation does not remove specificity in this way."),
       ("The substrate will be unable to dissolve in water.", "Solubility of the substrate does not depend on a mutation in the enzyme.")]),
], "relate enzyme structure to specificity and rate enhancement", "fixed fact bank checked against CED 3.1", est=60)


@retry_sep
def bi_enzyme_rate_calc(rng):
    r = pick(rng, [4, 5, 6, 8, 10]); knee = 6
    ts = [0, 2, 4, 6, 8, 10]
    ys = [0, 2 * r, 4 * r, 6 * r, round(6 * r + 0.4 * r * 2, 1), round(6 * r + 0.4 * r * 4, 1)]
    a, b = pick(rng, [(2, 8), (2, 10), (4, 10), (4, 8)])
    ya, yb = ys[ts.index(a)], ys[ts.index(b)]
    rate = (yb - ya) / (b - a)
    seg = [(ys[i + 1] - ys[i]) / (ts[i + 1] - ts[i]) for i in range(len(ts) - 1)]
    w = [ts[i + 1] - ts[i] for i in range(len(ts) - 1)]
    idx = [i for i in range(len(ts) - 1) if ts[i] >= a and ts[i + 1] <= b]
    wavg = sum(seg[i] * w[i] for i in idx) / sum(w[i] for i in idx)
    agree(rate, wavg, 1e-9, "rate")
    pairs = [("Divides the product formed by the full elapsed time b instead of the interval length.", (yb - ya) / b), ("Uses only the final amount of product and the final time.", yb / b), ("Reports the change in product without dividing by the time interval.", yb - ya), ("Uses the initial linear rate and ignores the slowing between the two times.", float(r)), ("Divides the interval length by the change in product.", (b - a) / (yb - ya))]
    key, ds = val_opts(rate, pairs, lambda v: f"{v:.2f} µmol per minute", gap=0.05)
    stim = tbl("Product formed in an enzyme-catalyzed reaction over time", ["Time (minutes)", "Product (µmol)"], [[t, f"{y:g}"] for t, y in zip(ts, ys)])
    stem = f"The table shows the amount of product formed in an enzyme-catalyzed reaction. What is the average rate of product formation from {a} minutes to {b} minutes?"
    return mk("bi_enzyme_rate_calc", "3.1", "5.A", stem, key, ds, rng, concept="average rate = change in product / change in time from a data table", stim=stim, path="(y_b - y_a)/(b - a) vs the time-weighted mean of the segment slopes", facts=[f"r={r}", f"a={a}", f"b={b}", f"rate={rate:.4f}"], judgment="select two data points and compute a rate from the formula sheet",
              kwhy=f"Rate = change in product / change in time = ({yb:g} - {ya:g}) µmol / ({b} - {a}) min = {rate:.2f} µmol per minute.")


@retry_sep
def bi_enzyme_inhibitor_data(rng):
    kind = pick(rng, ["competitive", "noncompetitive"])
    Vmax, Km, alpha = pick(rng, [(100, 20, 3), (80, 10, 4), (120, 30, 3)]), None, None
    Vmax, Km, alpha = Vmax[0], Vmax[1], Vmax[2]
    S = [5, 10, 20, 40, 80, 160]
    v0 = [Vmax * s / (Km + s) for s in S]
    vi = [Vmax * s / (Km * alpha + s) for s in S] if kind == "competitive" else [Vmax / alpha * s / (Km + s) for s in S]
    rows = [[s, f"{a:.0f}", f"{b:.0f}"] for s, a, b in zip(S, v0, vi)]
    # 독립 경로: 두 모형 예측과 표의 제곱 오차를 비교해 모형 판정
    obs = np.array([float(r[2]) for r in rows])
    comp = np.array([Vmax * s / (Km * alpha + s) for s in S]); nonc = np.array([Vmax / alpha * s / (Km + s) for s in S])
    judged = "competitive" if np.sum((obs - comp) ** 2) < np.sum((obs - nonc) ** 2) else "noncompetitive"
    agree(0, 0 if judged == kind else 1, 1e-9, "model")
    r_hi = vi[-1] / v0[-1]
    texts = {"competitive": ("Inhibitor X is competitive, because the effect shrinks as substrate concentration rises.", f"At 5 units of substrate the inhibited rate is {vi[0] / v0[0]:.0%} of the normal rate, but at 160 units it is {r_hi:.0%}: a competitive inhibitor is overcome by more substrate."),
             "noncompetitive": ("Inhibitor X is noncompetitive, because it lowers the maximum rate even at high substrate concentration.", f"The inhibited rate stays near {r_hi:.0%} of the normal rate at every substrate concentration, so adding substrate does not overcome it, as expected for a noncompetitive inhibitor.")}
    other = "noncompetitive" if kind == "competitive" else "competitive"
    wrongs = [(texts[other][0], "Reverses the interpretation of how the inhibited rate changes with substrate concentration." if kind == "competitive" else "Reverses the interpretation: the inhibited rate does not approach the normal rate at high substrate."),
              ("Inhibitor X is an activator, because the enzyme still produces product when it is present.", "Rates in the presence of X are lower than the normal rates, so X does not activate the enzyme."),
              ("Inhibitor X has no effect, because the rate increases with substrate concentration in both columns.", "A rate that rises with substrate in both columns does not mean the inhibitor has no effect; the rates differ.")]
    key, ds = sentence_options(texts[kind][0], texts[kind][1], wrongs)
    stim = tbl("Initial rate of an enzyme-catalyzed reaction at different substrate concentrations, without and with inhibitor X", ["Substrate concentration (arbitrary units)", "Rate without inhibitor (µmol per minute)", "Rate with inhibitor X (µmol per minute)"], rows)
    stem = "The table shows the rate of an enzyme-catalyzed reaction without and with inhibitor X at several substrate concentrations. Which statement is best supported by the data?"
    return mk("bi_enzyme_inhibitor_data", "3.1", "4.B", stem, key, ds, rng, concept="distinguish competitive from noncompetitive inhibition from rate data", stim=stim, path="sum of squared errors between the table and the two kinetic models vs the generating model", facts=[f"kind={kind}", f"Vmax={Vmax}", f"Km={Km}", f"alpha={alpha}"], judgment="describe how the effect of an inhibitor changes with substrate concentration")


@retry_sep
def bi_enzyme_ph_graph(rng):
    opt1 = pick(rng, [2, 8]); opt2 = 8 if opt1 == 2 else 2
    phs = [i * 0.5 for i in range(0, 29)]
    f = lambda p, o: 100 * math.exp(-((p - o) / 1.6) ** 2)  # noqa: E731
    c1 = [[p, round(f(p, opt1), 1)] for p in phs]; c2 = [[p, round(f(p, opt2), 1)] for p in phs]
    pk1 = max(c1, key=lambda q: q[1])[0]
    agree(pk1, opt1, 1e-9, "peak")
    place = "the stomach" if opt1 == 2 else "the small intestine"
    other = "the small intestine" if opt1 == 2 else "the stomach"
    ph_txt = "acidic" if opt1 == 2 else "slightly basic"
    key, ds = sentence_options(f"Enzyme 1 is most likely active in {place}, because its activity is greatest in {ph_txt} conditions.", f"Enzyme 1 reaches its maximum activity at pH {opt1}, which is {ph_txt}; {place} has that kind of environment.",
        [(f"Enzyme 1 is most likely active in {other}, because its activity is greatest in {ph_txt} conditions.", "Matches the optimum pH to the wrong part of the digestive tract."),
         ("Enzyme 1 is most likely active in the mouth, because the enzyme works at every pH tested.", "The graph shows activity falling sharply away from the optimum, so it does not work at every pH."),
         (f"Enzyme 1 is denatured at pH {opt1}, because that pH gives its highest activity.", "The highest activity at a pH indicates the optimum, not denaturation.")])
    stim = graph_stim("Relative activity of two digestive enzymes at different pH values", [("Enzyme 1", c1), ("Enzyme 2", c2)], gaxis("pH", 0, 14, 2), gaxis("Relative activity (%)", 0, 100, 20))
    stem = "The graph shows the relative activity of two digestive enzymes as pH changes. In which location is Enzyme 1 most likely to function in the human body?"
    return mk("bi_enzyme_ph_graph", "3.2", "4.B", stem, key, ds, rng, concept="read an optimum pH from a graph and connect it to the environment where the enzyme functions", stim=stim, path="argmax of the plotted series vs the generating optimum", facts=[f"opt1={opt1}", f"opt2={opt2}"], judgment="describe where a curve peaks and connect it to the setting")


bi_enzyme_temp_pred = make_bank_archetype("bi_enzyme_temp_pred", "3.2", "6.E", [
    B("An enzyme from a human cell has an optimum temperature near 37 degrees Celsius. What is the most likely effect of heating a solution of the enzyme to 80 degrees Celsius?",
      ("The enzyme's rate of reaction decreases because its shape changes and the active site no longer fits the substrate.", "High temperature breaks the weak bonds that hold the enzyme's shape, so the enzyme denatures."),
      [("The rate of reaction increases because more molecules have enough energy to react at higher temperature.", "This is true only up to the optimum temperature; at much higher temperatures denaturation dominates."),
       ("The rate of reaction stays the same because enzymes are not affected by temperature.", "Enzyme activity depends strongly on temperature."),
       ("The enzyme breaks down into amino acids and the reaction speeds up.", "Heat unfolds the enzyme but does not break the peptide bonds that join the amino acids.")]),
    B("Warm-blooded animals keep their body temperature nearly constant. Which statement best explains the benefit of this for metabolism?",
      ("Enzymes in the body work near their optimum temperature, which keeps reaction rates efficient.", "A constant temperature near the enzyme optimum maintains efficient and predictable reaction rates."),
      [("A constant temperature prevents any enzyme from ever binding substrate.", "Maintaining temperature allows enzymes to function."),
       ("Enzymes are made of DNA, which is stable only at constant temperature.", "Enzymes are proteins, not DNA."),
       ("Constant temperature increases the activation energy of reactions so that they are more controlled.", "A constant temperature does not raise activation energy; enzymes lower it.")]),
    B("An enzyme in a hot-spring bacterium has an optimum temperature of 75 degrees Celsius. Which prediction about this enzyme is best supported?",
      ("At 20 degrees Celsius its activity would be low because molecules move more slowly and collide less often.", "Far below the optimum, fewer effective collisions occur, so the rate is low even though the enzyme keeps its shape."),
      [("At 20 degrees Celsius it would be denatured because all enzymes denature in the cold.", "Cold slows reactions but does not generally denature enzymes."),
       ("At 20 degrees Celsius its activity would be at the maximum because it requires no activation energy.", "Enzymes lower, but do not remove, the activation energy."),
       ("At 20 degrees Celsius it would change the reaction it catalyzes.", "Temperature changes the rate and not the reaction an enzyme catalyzes.")]),
], "predict how temperature changes enzyme activity", "fixed fact bank checked against CED 3.2", est=65)

bi_energy_coupling = make_bank_archetype("bi_energy_coupling", "3.3", "1.A", [
    B("Cells often couple the hydrolysis of ATP to an energetically unfavorable reaction. Which statement best explains why this coupling allows the unfavorable reaction to occur?",
      ("The energy released by ATP hydrolysis is used to drive the reaction that requires energy.", "The exergonic hydrolysis of ATP provides energy that makes the overall coupled process favorable."),
      [("ATP hydrolysis lowers the activation energy of the unfavorable reaction.", "Lowering activation energy is the role of an enzyme and not the energy-coupling function of ATP."),
       ("ATP hydrolysis absorbs energy, which cools the cell and favors the reaction.", "ATP hydrolysis releases energy."),
       ("ATP is converted to DNA, which then catalyzes the unfavorable reaction.", "ATP is not converted to DNA for this purpose.")]),
    B("Which statement correctly describes an exergonic reaction?",
      ("The products have less free energy than the reactants, so energy is released.", "In an exergonic reaction the free energy change is negative."),
      [("The products have more free energy than the reactants, so energy is released.", "Products with more free energy mean energy must be added."),
       ("The reaction requires a net input of energy and does not occur spontaneously.", "This describes an endergonic reaction."),
       ("The reaction proceeds only in the presence of an enzyme.", "Exergonic reactions can proceed without enzymes, although slowly.")]),
    B("Energy flows through living systems but matter cycles. Which statement best supports this idea about energy?",
      ("Each energy transfer is incomplete, and some energy is lost to the surroundings as heat.", "Energy transformations are never completely efficient, so energy input is required continually."),
      [("Organisms create new energy when they break down glucose.", "Energy is not created; it is transformed."),
       ("Living systems are closed systems that do not require an input of energy.", "Living systems are open systems that require continuous energy input."),
       ("Heat released by organisms is recycled completely by producers into chemical energy.", "Heat is not recaptured by producers; it is lost to the environment.")]),
], "link energy changes to coupled reactions and the flow of energy", "fixed fact bank checked against CED 3.3", est=60)


@retry_sep
def bi_activation_energy_graph(rng):
    Er = pick(rng, [40, 50, 60]); dG = pick(rng, [-30, -20, 20, 30]); Ea_u = pick(rng, [70, 80, 90]); Ea_c = pick(rng, [30, 40, 50])
    Ep = Er + dG
    pk_u = Er + Ea_u; pk_c = Er + Ea_c
    if pk_c <= max(Er, Ep) + 5:
        raise ValueError("peak_low")
    xs = [0, 3, 5, 7, 10]
    unc = [[0, Er], [3, Er], [5, pk_u], [7, Ep], [10, Ep]]; cat = [[0, Er], [3, Er], [5, pk_c], [7, Ep], [10, Ep]]
    ymax = max(pk_u, pk_c, Er, Ep) + 20
    stim = graph_stim("Free energy during a reaction without and with an enzyme", [("Without enzyme", unc), ("With enzyme", cat)], gaxis("Reaction progress", 0, 10, 2), gaxis("Free energy (kJ/mol)", 0, math.ceil(ymax / 20) * 20, 20))
    variant = pick(rng, ["reduction", "dG"])
    if variant == "reduction":
        val = Ea_u - Ea_c
        # 독립 경로: 그래프 점 배열의 봉우리 차이
        agree(val, max(q[1] for q in unc) - max(q[1] for q in cat), 1e-9, "dEa")
        pairs = [("Reports the activation energy without the enzyme instead of the reduction.", Ea_u), ("Reports the activation energy with the enzyme instead of the reduction.", Ea_c), ("Adds the two activation energies.", Ea_u + Ea_c), ("Uses the difference in free energy between reactants and products.", abs(dG))]
        key, ds = val_opts(val, pairs, lambda v: f"{v:g} kJ/mol", gap=4)
        stem = "The graph shows the free energy during a reaction without and with an enzyme. By how much does the enzyme lower the activation energy of the reaction?"
        kw = f"The activation energy is the difference between the peak and the starting free energy: {Ea_u} kJ/mol without the enzyme and {Ea_c} kJ/mol with it, so the enzyme lowers it by {val} kJ/mol."
    else:
        val = dG
        agree(val, unc[-1][1] - unc[0][1], 1e-9, "dG")
        pairs = [("Uses the activation energy of the uncatalyzed reaction as the free energy change.", Ea_u if dG > 0 else -Ea_u), ("Uses the activation energy of the catalyzed reaction as the free energy change.", Ea_c if dG > 0 else -Ea_c), ("Gives the free energy change the wrong sign.", -dG), ("Uses the difference between the two activation energies, which the enzyme changes, as the free energy change.", Ea_u - Ea_c)]
        key, ds = val_opts(val, pairs, lambda v: f"{v:+g} kJ/mol", gap=4)
        stem = "The graph shows the free energy during a reaction without and with an enzyme. What is the free energy change for the reaction (products minus reactants) in the presence of the enzyme?"
        kw = f"An enzyme does not change the free energy of the reactants or products. The free energy rises or falls from {Er} to {Ep} kJ/mol, so the free energy change is {dG:+d} kJ/mol with or without the enzyme."
    return mk("bi_activation_energy_graph", "3.1", "5.A", stem, key, ds, rng, concept="read activation energy and free energy change from an energy diagram", stim=stim, path="peak differences read from the plotted vertices vs the generating parameters", facts=[f"Er={Er}", f"Ea_u={Ea_u}", f"Ea_c={Ea_c}", f"dG={dG}", f"variant={variant}"], judgment="subtract the right pair of values read from the diagram", kwhy=kw)


bi_photosynthesis_inputs = make_bank_archetype("bi_photosynthesis_inputs", "3.4", "1.B", [
    B("Plants release oxygen gas during photosynthesis. From which molecule does this oxygen come?",
      ("Water, which is split in the light reactions", "Water is split by the light reactions, releasing oxygen and supplying electrons."),
      [("Carbon dioxide, which is split in the Calvin cycle", "Carbon dioxide is fixed into sugar in the Calvin cycle and is not the source of the oxygen gas."),
       ("Glucose, which is broken down in the light reactions", "Glucose is a product of photosynthesis and is not the source of oxygen gas."),
       ("ATP, which is oxidized by the light reactions", "ATP does not release oxygen gas.")]),
    B("Which statement correctly describes the relationship between the light reactions and the Calvin cycle?",
      ("The light reactions produce ATP and NADPH that the Calvin cycle uses to fix carbon dioxide into sugar.", "The light reactions capture light energy as ATP and NADPH, which power carbon fixation."),
      [("The Calvin cycle produces ATP and NADPH that the light reactions use to split water.", "The roles are reversed: the light reactions produce ATP and NADPH."),
       ("The light reactions produce glucose directly, and the Calvin cycle produces oxygen.", "Glucose is made in the Calvin cycle, and oxygen comes from splitting water in the light reactions."),
       ("The two stages are independent and do not exchange energy carriers.", "The stages are linked through ATP and NADPH.")]),
    B("In chloroplasts, the light reactions occur in which location?",
      ("In the thylakoid membranes, where pigments and the electron transport chain are located", "Chlorophyll and electron transport proteins are embedded in the thylakoid membranes."),
      [("In the stroma, where the Calvin cycle enzymes are located", "The stroma is the site of the Calvin cycle."),
       ("In the mitochondria, where light energy is converted to ATP", "Mitochondria do not capture light energy."),
       ("In the nucleus, where chlorophyll is made from DNA", "The nucleus is not the site of the light reactions.")]),
], "match stages of photosynthesis to their inputs, outputs, and locations", "fixed fact bank checked against CED 3.4", est=55)


@retry_sep
def bi_photosynthesis_data(rng):
    wl = [450, 500, 550, 600, 650, 700]
    base = [round(v * rng.uniform(0.95, 1.05), 1) for v in [92, 38, 10, 44, 86, 52]]
    lo = int(np.argmin(base)); hi = int(np.argmax(base))
    if wl[lo] != 550 or wl[hi] not in (450, 650):
        raise ValueError("pattern")
    low_wl = wl[lo]
    stim = tbl("Oxygen released by an aquatic plant in light of different wavelengths", ["Wavelength of light (nm)", "Oxygen released (relative units per hour)"], [[w, f"{b:g}"] for w, b in zip(wl, base)])
    key, ds = sentence_options(f"Light of {low_wl} nm is used least efficiently, which is consistent with chlorophyll absorbing it poorly.", f"The lowest rate of oxygen release, {base[lo]:g}, is at {low_wl} nm; this is consistent with poor absorption of green light by chlorophyll.",
        [(f"Light of {low_wl} nm is used most efficiently, because plants look green.", "The color of a plant comes from reflected light, which is not used efficiently."),
         (f"Photosynthesis stops completely at {low_wl} nm, because no oxygen is released.", "The data show a small amount of oxygen released at every wavelength, so photosynthesis did not stop."),
         ("Oxygen release is greatest at the longest wavelength tested, because longer wavelengths carry more energy.", "The greatest release in the data is at a shorter wavelength, and longer wavelengths carry less energy.")])
    stem = "The table shows the oxygen released by an aquatic plant in light of different wavelengths. Which conclusion is best supported by the data?"
    return mk("bi_photosynthesis_data", "3.4", "6.B", stem, key, ds, rng, concept="use rate data to support a claim about light wavelength and photosynthesis", stim=stim, path="argmin/argmax of the table vs the pigment-absorption model used to generate it", facts=[f"base={base}"], judgment="support a claim about wavelength effectiveness with values from the table")


@retry_sep
def bi_leaf_disk_et50(rng):
    ts = [2, 4, 6, 8, 10, 12, 14]
    t50 = rng.choice([5.0, 6.2, 7.0, 8.4, 9.0])
    s = rng.choice([1.6, 2.0])
    counts = [min(10, max(0, round(10 / (1 + math.exp(-(t - t50) / s))))) for t in ts]
    if 5 in counts or counts[0] > 3 or counts[-1] < 9 or len(set(counts)) < 5:
        raise ValueError("shape")
    i = next(k for k in range(len(ts) - 1) if counts[k] < 5 < counts[k + 1])
    x0, x1, y0, y1 = ts[i], ts[i + 1], counts[i], counts[i + 1]
    est = float(Fr(x0) + (Fr(5) - Fr(y0)) * (Fr(x1) - Fr(x0)) / (Fr(y1) - Fr(y0)))
    agree(est, float(np.interp(5, counts, ts)), 1e-9, "et50")
    pairs = [("Reports the first measured time at which at least five disks had floated.", float(x1)), ("Reports the last measured time before five disks had floated.", float(x0)), ("Averages all the measured times.", float(np.mean(ts))), ("Reports the number of disks instead of the time.", 5.0)]
    key, ds = val_opts(est, pairs, lambda v: f"{v:.1f} minutes" if v != 5.0 else "5.0 disks", gap=0.3)
    ds = [Opt("5 disks" if d.text == "5.0 disks" else d.text, False, d.why, d.value) for d in ds]
    stim = tbl("Number of leaf disks floating (out of 10) at different times in a bicarbonate solution under light", ["Time (minutes)", "Disks floating"], [[t, c] for t, c in zip(ts, counts)])
    stem = "Ten leaf disks were placed in bicarbonate solution under a lamp. The table shows how many disks floated over time. Assuming a steady change between measurements, what is the best estimate of the time at which half of the disks had floated?"
    return mk("bi_leaf_disk_et50", "3.4", "5.A", stem, key, ds, rng, concept="estimate the median floating time of leaf disks by interpolation", stim=stim, path="exact fraction interpolation between the bracketing points vs numpy.interp over the whole table", facts=[f"counts={counts}", f"est={est:.4f}"], judgment="interpolate between the two measurements that bracket five floating disks",
              kwhy=f"Five disks float between {x0} minutes ({y0} disks) and {x1} minutes ({y1} disks). Interpolating, 5 disks is reached at {x0} + ({5 - y0} / {y1 - y0}) x {x1 - x0} = {est:.1f} minutes.")


bi_respiration_concept = make_bank_archetype("bi_respiration_concept", "3.5", "1.B", [
    B("In aerobic cellular respiration, which molecule acts as the final electron acceptor in the electron transport chain?",
      ("Oxygen, which combines with electrons and protons to form water", "Oxygen accepts electrons at the end of the chain and forms water."),
      [("Carbon dioxide, which combines with electrons to form glucose", "Carbon dioxide is released by respiration, not used to form glucose."),
       ("Water, which combines with electrons to form oxygen", "Water is a product of the last step, not the final electron acceptor."),
       ("NAD+, which accepts electrons from ATP", "NAD+ accepts electrons from food molecules earlier in respiration.")]),
    B("Which statement correctly pairs a stage of cellular respiration with its location in a eukaryotic cell?",
      ("Glycolysis occurs in the cytoplasm, and the electron transport chain is in the inner mitochondrial membrane.", "Glycolysis occurs in the cytosol, and the electron transport chain is embedded in the inner membrane of the mitochondrion."),
      [("Glycolysis occurs in the inner mitochondrial membrane, and the electron transport chain is in the cytoplasm.", "The locations are reversed."),
       ("Glycolysis occurs in the nucleus, and the electron transport chain is in the Golgi complex.", "Neither stage occurs in these structures."),
       ("Both glycolysis and the electron transport chain occur only in the mitochondrial matrix.", "Glycolysis occurs outside the mitochondrion.")]),
    B("Most of the ATP in aerobic respiration is produced when protons flow back through ATP synthase. What drives this flow of protons?",
      ("A proton gradient across the inner mitochondrial membrane produced by the electron transport chain", "Electron transport pumps protons across the membrane, creating a gradient that powers ATP synthase."),
      [("A gradient of glucose across the inner mitochondrial membrane", "The proton gradient, not a glucose gradient, drives ATP synthase."),
       ("The direct transfer of phosphate groups from NADH to ADP", "Most ATP is made by chemiosmosis, not by direct transfer from NADH."),
       ("The breakdown of ATP by the electron transport chain", "The chain does not break down ATP; it helps make ATP.")]),
], "match respiration stages to locations, electron flow, and ATP production", "fixed fact bank checked against CED 3.5", est=60)


@retry_sep
def bi_respiration_rates(rng):
    base = pick(rng, [0.6, 0.8, 1.0, 1.2]); mult = pick(rng, [2.0, 2.5, 3.0])
    ts = [0, 5, 10, 15, 20]
    warm = [round(base * mult * t, 1) for t in ts]; cool = [round(base * t, 1) for t in ts]
    r_w = (warm[-1] - warm[0]) / 20; r_c = (cool[-1] - cool[0]) / 20
    ratio = r_w / r_c
    sl_w = float(np.polyfit(ts, warm, 1)[0]); sl_c = float(np.polyfit(ts, cool, 1)[0])
    agree(ratio, sl_w / sl_c, 1e-6, "ratio")
    pairs = [("Divides the slower rate by the faster rate.", 1 / ratio), ("Subtracts the two rates instead of dividing them.", r_w - r_c), ("Compares the totals at 5 minutes with the totals at 20 minutes.", 4.0), ("Adds the two rates instead of dividing them.", r_w + r_c)]
    key, ds = val_opts(ratio, pairs, lambda v: f"{v:.1f}", gap=0.2)
    stim = tbl("Oxygen consumed (mL) by germinating peas at two temperatures", ["Time (minutes)", "Oxygen consumed at 25 °C (mL)", "Oxygen consumed at 10 °C (mL)"], [[t, f"{w:g}", f"{c:g}"] for t, w, c in zip(ts, warm, cool)])
    stem = "A respirometer measured the oxygen consumed by germinating peas at 25 °C and at 10 °C. Based on the data in the table, the rate of oxygen consumption at 25 °C is how many times the rate at 10 °C?"
    return mk("bi_respiration_rates", "3.5", "5.A", stem, key, ds, rng, concept="compare respiration rates from cumulative oxygen consumption", stim=stim, path="ratio of end-point rates vs ratio of least-squares slopes", facts=[f"base={base}", f"mult={mult}", f"ratio={ratio:.4f}"], judgment="convert cumulative data to rates, then compare the rates", kwhy=f"The rate at 25 °C is {warm[-1]:g} mL / 20 min = {r_w:.2f} mL per minute and the rate at 10 °C is {cool[-1]:g} / 20 = {r_c:.2f} mL per minute, a ratio of {ratio:.1f}.")


bi_fermentation = make_bank_archetype("bi_fermentation", "3.5", "6.E", [
    B("Yeast cells in a sealed container run out of oxygen. Which change in metabolism is most likely?",
      ("The cells rely on glycolysis and fermentation, which make much less ATP per glucose.", "Without oxygen the electron transport chain stops, and cells regenerate NAD+ by fermentation to keep glycolysis going."),
      [("The cells use carbon dioxide as the final electron acceptor and make more ATP.", "Carbon dioxide cannot replace oxygen as the final electron acceptor in yeast."),
       ("The cells switch to photosynthesis to make ATP from light.", "Yeast cells are not photosynthetic."),
       ("The cells stop all metabolism and use no glucose.", "Glycolysis and fermentation can continue without oxygen.")]),
    B("Human muscle cells that run out of oxygen during intense exercise continue to make a small amount of ATP. Which statement explains how?",
      ("Glycolysis continues, and pyruvate is converted to lactate, which regenerates NAD+.", "Regeneration of NAD+ by lactic acid fermentation allows glycolysis to continue."),
      [("The electron transport chain continues, and oxygen is replaced by lactate.", "Lactate is not an electron acceptor in the chain."),
       ("The Calvin cycle continues, and carbon dioxide is fixed into sugar.", "The Calvin cycle occurs in chloroplasts, not in muscle cells."),
       ("ATP is made directly from lactate by the mitochondria.", "Lactate is not directly converted to ATP.")]),
    B("A poison blocks the electron transport chain in mitochondria. Which effect is most likely in cells that depend on aerobic respiration?",
      ("ATP production falls sharply because the proton gradient can no longer be maintained.", "Blocking electron transport stops proton pumping, so ATP synthase has no gradient to use."),
      [("ATP production rises because electrons are no longer lost to oxygen.", "ATP production depends on electron flow through the chain."),
       ("Glycolysis stops completely because it requires a proton gradient.", "Glycolysis does not require a proton gradient and can continue for a time."),
       ("Oxygen consumption increases because the chain is open.", "Blocking the chain reduces oxygen consumption.")]),
], "predict the effect of removing oxygen or blocking electron transport", "fixed fact bank checked against CED 3.5", est=65)

bi_chemiosmosis = make_bank_archetype("bi_chemiosmosis", "3.4", "2.B", [
    B("In both mitochondria and chloroplasts, ATP synthase uses a proton gradient to make ATP. Which pair correctly describes the gradient in a chloroplast?",
      ("Protons are pumped into the thylakoid space, and flow back out to the stroma through ATP synthase.", "In chloroplasts the thylakoid space has high proton concentration, and ATP is made as protons flow into the stroma."),
      [("Protons are pumped into the stroma, and flow into the thylakoid space through ATP synthase.", "The direction of the gradient is reversed."),
       ("Protons are pumped out of the cell, and flow back through the cell wall.", "The gradient is across the thylakoid membrane, not the cell wall."),
       ("Protons are not involved, and ATP is made by direct transfer from NADPH.", "Chemiosmosis, not direct transfer, makes ATP in the light reactions.")]),
    B("A chemical makes the inner mitochondrial membrane permeable to protons, so they leak back without passing through ATP synthase. Which result is most likely?",
      ("Electron transport continues, but much less ATP is made because the gradient is not used by ATP synthase.", "The chain can keep pumping protons, but the energy of the gradient is dissipated as heat instead of making ATP."),
      [("ATP production increases because protons move faster across the membrane.", "Leaking protons bypass ATP synthase, so less ATP is made."),
       ("Electron transport stops because the proton gradient becomes too large.", "The gradient decreases when protons leak, and the chain can continue."),
       ("ATP synthase begins to pump protons into the intermembrane space using glucose.", "ATP synthase does not use glucose to pump protons.")]),
], "apply chemiosmosis to a model of ATP production", "fixed fact bank checked against CED 3.4 and 3.5", est=65)


@retry_sep
def bi_limiting_factor(rng):
    P1 = pick(rng, [30, 40, 50]); P2 = pick(rng, [70, 80]); L = list(range(0, 101, 10))
    low = [min(P1, 1.0 * l) for l in L]; high = [min(P2, 1.0 * l) for l in L]
    X = pick(rng, [x for x in L if x >= P1 + 10 and x <= P2 - 10])
    agree(low[L.index(X)], P1, 1e-9, "plateau")
    key, ds = sentence_options("Increasing the carbon dioxide concentration, because carbon dioxide limits the rate at that light intensity.", f"At a light intensity of {X} the rate with low carbon dioxide has leveled off at {P1}, while the rate with high carbon dioxide is {high[L.index(X)]:g}, so carbon dioxide is the limiting factor.",
        [("Increasing the light intensity, because light limits the rate at that light intensity.", "The low-carbon dioxide curve is already flat, so more light does not increase the rate."),
         ("Decreasing the carbon dioxide concentration, because it is above the optimum.", "The high-carbon dioxide curve shows a higher rate, so reducing carbon dioxide would not help."),
         ("No change would increase the rate, because the plant is already at its maximum.", "The high-carbon dioxide curve shows that a higher rate is possible at this light intensity.")])
    stim = graph_stim("Rate of photosynthesis at different light intensities for two carbon dioxide concentrations", [("Low CO2", [[l, v] for l, v in zip(L, low)]), ("High CO2", [[l, v] for l, v in zip(L, high)])], gaxis("Light intensity (arbitrary units)", 0, 100, 20), gaxis("Rate of photosynthesis (arbitrary units)", 0, 100, 20))
    stem = f"The graph shows the rate of photosynthesis at different light intensities for plants grown at low and high carbon dioxide concentrations. For plants in low carbon dioxide at a light intensity of {X}, which change would most likely increase the rate of photosynthesis?"
    return mk("bi_limiting_factor", "3.4", "4.B", stem, key, ds, rng, concept="identify the limiting factor from rate curves", stim=stim, path="plateau of each plotted series vs the generating minimum of the light-driven and carbon-dioxide-limited rates", facts=[f"P1={P1}", f"P2={P2}", f"X={X}"], judgment="compare curves to decide which factor limits the rate")


@retry_sep
def bi_enzyme_substrate_graph(rng):
    Vmax = pick(rng, [40, 50, 60, 80]); Km = pick(rng, [4, 5, 8])
    S = [0, 2, 4, 6, 8, 10, 15, 20, 30, 40, 50]
    v = [round(Vmax * s / (Km + s), 1) for s in S]
    d = np.diff(v); assert np.all(np.diff(d / np.diff(S)) < 1e-9)
    variant = pick(rng, ["plateau", "raise"])
    stim = graph_stim("Rate of an enzyme-catalyzed reaction at different substrate concentrations", [("Reaction rate", [[s, y] for s, y in zip(S, v)])], gaxis("Substrate concentration (mM)", 0, 50, 10), gaxis("Reaction rate (µmol per minute)", 0, 100, 20))
    if variant == "plateau":
        key, ds = sentence_options("Nearly all of the enzyme's active sites are occupied, so more substrate does not increase the rate.", "At high substrate concentration the enzyme is saturated, so the rate levels off near its maximum.",
            [("The enzyme is denatured by the high substrate concentration, so the rate stops increasing.", "Denaturation would lower the rate, but the curve shows a stable maximum."),
             ("The substrate is used up at high concentration, so the reaction stops.", "More substrate makes it less likely that the substrate would be used up."),
             ("The enzyme is consumed in the reaction, so less enzyme remains at high substrate concentration.", "Enzymes are not consumed in the reactions that they catalyze.")])
        stem = "The graph shows the rate of an enzyme-catalyzed reaction at different substrate concentrations. Which statement best explains why the rate levels off at high substrate concentration?"
    else:
        key, ds = sentence_options("The plateau would be higher, because more enzyme provides more active sites for the substrate.", "The maximum rate is limited by the number of active sites, so adding enzyme raises the plateau.",
            [("The plateau would be lower, because the extra enzyme would compete for the substrate.", "More enzyme does not lower the maximum rate; it provides more active sites."),
             ("The plateau would be the same, because the substrate concentration is what sets the maximum rate.", "At saturating substrate, the maximum rate depends on the amount of enzyme."),
             ("The curve would shift to the left but would level off at the same rate.", "More enzyme raises the maximum rate and not only the position of the curve.")])
        stem = "The graph shows the rate of an enzyme-catalyzed reaction at different substrate concentrations. A student repeats the experiment with twice as much enzyme. Which prediction is best supported by the graph and the role of active sites?"
    return mk("bi_enzyme_substrate_graph", "3.1", "6.E", stem, key, ds, rng, concept="saturation of an enzyme and the effect of enzyme concentration", stim=stim, path="second differences of the plotted rate (concave saturation) vs the generating Michaelis-Menten form", facts=[f"Vmax={Vmax}", f"Km={Km}", f"variant={variant}"], judgment="explain the plateau using active sites")


# ============================ 단원 4 ============================
bi_signal_steps = make_bank_archetype("bi_signal_steps", "4.2", "1.B", [
    B("A hormone binds to a receptor protein on the surface of a target cell, which triggers a series of changes inside the cell that lead to a response. What is the term for the series of changes inside the cell?",
      ("Signal transduction", "Signal transduction converts the signal received by the receptor into a cellular response through a series of steps."),
      [("Signal reception", "Reception is the binding of the signal molecule to the receptor."),
       ("Translation", "Translation is the synthesis of a polypeptide at a ribosome."),
       ("Osmosis", "Osmosis is the movement of water across a membrane.")]),
    B("Which sequence correctly lists the three stages of a cell signaling pathway in order?",
      ("Reception, transduction, response", "A ligand is received, the signal is relayed, and the cell responds."),
      [("Transduction, reception, response", "A signal must be received before it can be transduced."),
       ("Response, reception, transduction", "The response is the final stage."),
       ("Reception, response, transduction", "The signal is transduced before the cell responds.")]),
    B("A signaling molecule is hydrophobic and can pass through the plasma membrane of a target cell. Where is its receptor most likely to be located?",
      ("Inside the cell, in the cytoplasm or nucleus", "Small hydrophobic ligands such as steroid hormones diffuse across the membrane and bind intracellular receptors."),
      [("On the outer surface of the plasma membrane only", "A ligand that crosses the membrane can bind receptors inside the cell."),
       ("On the surface of the nuclear envelope facing the extracellular space", "The nuclear envelope is not exposed to the extracellular space."),
       ("In the cell wall of the target cell", "Receptors are not typically located in the cell wall.")]),
], "describe the stages of cell signaling and where receptors are located", "fixed fact bank checked against CED 4.1 and 4.2", est=55)


@retry_sep
def bi_signal_amplification(rng):
    k1, k2, k3 = pick(rng, [5, 10, 20, 50]), pick(rng, [5, 10, 20]), pick(rng, [2, 5, 10])
    total = k1 * k2 * k3
    # 독립 경로: 단계마다 분자 수를 실제로 증식시키는 반복
    n = 1
    for k in (k1, k2, k3):
        n = sum(k for _ in range(n))
    agree(total, n, 1e-9, "total")
    pairs = [("Adds the three numbers instead of multiplying them.", k1 + k2 + k3), ("Multiplies only the first two numbers and forgets the last step.", k1 * k2), ("Multiplies only the last two steps and forgets the first.", k2 * k3), ("Uses the largest single number as the total.", max(k1, k2, k3) * 3)]
    key, ds = val_opts(total, pairs, lambda v: f"{int(v):,}", rel=0.08, gap=1)
    stem = f"In a signal transduction pathway, one activated receptor activates {k1} molecules of kinase 1. Each activated kinase 1 molecule activates {k2} molecules of kinase 2, and each activated kinase 2 molecule activates {k3} molecules of a transcription factor. How many transcription factor molecules are activated by one activated receptor?"
    return mk("bi_signal_amplification", "4.3", "5.A", stem, key, ds, rng, concept="amplification of a signal through successive activation steps", path="product of the step multipliers vs a stepwise loop counting molecules at each tier", facts=[f"k={k1},{k2},{k3}", f"total={total}"], judgment="multiply across tiers to quantify amplification",
              kwhy=f"The numbers multiply at each tier: {k1} x {k2} x {k3} = {total:,} transcription factor molecules.")


bi_signal_mutation = make_bank_archetype("bi_signal_mutation", "4.3", "6.E", [
    B("A mutation in the gene for a receptor makes the receptor active even when no signaling molecule is bound. Which prediction is best supported?",
      ("The cell responds as if the signal were present, even when no signal is present.", "A receptor that is always active continually triggers the pathway."),
      [("The cell will never respond to the signal because the receptor cannot change shape.", "The mutation causes constant activation, so the cell responds continuously."),
       ("The cell will respond only when the signal molecule is added.", "A constitutively active receptor does not need the signal molecule."),
       ("The cell will stop making the receptor protein.", "The mutation changes how the receptor works and does not stop its synthesis.")]),
    B("A kinase in a signaling pathway cannot be phosphorylated because of a mutation. If the kinase normally activates a transcription factor, what is the most likely result?",
      ("The target genes are not activated in response to the signal.", "Without activation of the kinase, the signal is not passed to the transcription factor."),
      [("The target genes are expressed at a higher level in response to the signal.", "A kinase that cannot be activated would not increase the response."),
       ("The signal molecule is destroyed outside the cell.", "The mutation affects an intracellular kinase, not the signal molecule."),
       ("The receptor changes into a different receptor.", "A kinase mutation does not change the receptor.")]),
    B("A drug blocks the enzyme that breaks down the second messenger cAMP in cells. Which effect is most likely?",
      ("The response triggered by cAMP lasts longer because the second messenger remains active.", "If cAMP is not degraded, the signal continues for longer."),
      [("The response ends sooner because cAMP builds up and shuts down the pathway.", "Higher cAMP prolongs, and does not shorten, the response."),
       ("The cell stops producing the receptor.", "The drug does not affect receptor production."),
       ("The signal molecule can no longer bind its receptor.", "The drug acts on cAMP breakdown inside the cell.")]),
], "predict how a mutation or drug changes a signal transduction pathway", "fixed fact bank checked against CED 4.3", est=65)

bi_feedback_type = make_bank_archetype("bi_feedback_type", "4.4", "1.B", [
    B("After a meal, blood glucose rises and the pancreas releases insulin, which causes cells to take up glucose, lowering blood glucose. This is an example of which type of regulation?",
      ("Negative feedback, because the response reduces the original change", "The response opposes the rise in glucose and returns the level toward its set point."),
      [("Positive feedback, because the response increases the original change", "Insulin lowers the glucose level and does not amplify the rise."),
       ("Positive feedback, because insulin is a hormone", "Whether a signal is a hormone does not determine whether the feedback is positive or negative."),
       ("Neither, because the hormone acts only once", "The hormone response ends once the glucose level returns to normal; the system is regulated by feedback.")]),
    B("During childbirth, stretching of the uterus triggers the release of oxytocin, which causes stronger contractions that stretch the uterus further and release more oxytocin. This is an example of which type of regulation?",
      ("Positive feedback, because the response amplifies the original stimulus", "Each contraction increases the stimulus, which leads to more oxytocin and more contractions."),
      [("Negative feedback, because the response maintains a set point", "The response increases the stimulus rather than returning it to a set point."),
       ("Negative feedback, because oxytocin is released in small amounts", "The amount of hormone does not decide the type of feedback; its effect on the stimulus does."),
       ("Neither, because the process involves muscle and not hormones", "The process is regulated by a hormone and involves feedback.")]),
    B("When body temperature rises above its set point, sweat glands are activated, and evaporation lowers body temperature. Which statement is correct?",
      ("This is negative feedback because the response reverses the change in temperature.", "Sweating opposes the temperature rise and returns the temperature toward its set point."),
      [("This is positive feedback because the response increases the temperature.", "Sweating lowers the temperature."),
       ("This is positive feedback because many sweat glands are activated at once.", "The number of glands involved does not determine the type of feedback."),
       ("This is not feedback because the nervous system, not a hormone, is involved.", "Feedback can involve nervous or hormonal signals.")]),
    B("Ripening fruit releases ethylene gas, which causes nearby fruit to ripen and release more ethylene. What type of regulation does this represent?",
      ("Positive feedback, because ethylene amplifies its own production", "Ethylene stimulates more ethylene release and ripening, which amplifies the effect."),
      [("Negative feedback, because ethylene stops ripening once it is released", "Ethylene promotes ripening and does not stop it."),
       ("Negative feedback, because gases cannot amplify a response", "Gases can act as signals that amplify responses."),
       ("No feedback, because plants do not use signaling molecules", "Plants use signaling molecules, including ethylene, and regulate responses with feedback.")]),
], "classify a regulatory process as positive or negative feedback", "fixed fact bank checked against CED 4.4", est=60)


@retry_sep
def bi_feedback_graph(rng):
    kind = pick(rng, ["negative", "positive"])
    ts = list(range(0, 61, 3))
    if kind == "negative":
        base = pick(rng, [90, 100]); A = pick(rng, [50, 60, 70]); t0 = 6; tau = pick(rng, [9, 12])
        ys = [round(base + (A * (t - 0) / t0 if t < t0 else A * math.exp(-(t - t0) / tau)), 1) for t in ts]
        desc = "Blood glucose after a meal"
        yax = gaxis("Blood glucose (mg/dL)", 0, 200, 50)
        peak_to = ys[-1]; ok = abs(ys[-1] - base) < 0.1 * base
        agree(0, 0 if ok else 1, 1e-9, "returns")
    else:
        y0 = pick(rng, [2, 3]); g = pick(rng, [0.09, 0.1]); ys = []
        for t in ts:
            ys.append(round(y0 * math.exp(g * t), 1) if t <= 45 else 0.0)
        ys = [y if y <= 200 else 200.0 for y in ys]
        desc = "Oxytocin concentration during labor"
        yax = gaxis("Oxytocin concentration (arbitrary units)", 0, 200, 50)
        agree(0, 0 if all(ys[i + 1] > ys[i] for i in range(0, 14)) else 1, 1e-9, "rises")
    if kind == "negative":
        key, ds = sentence_options("Negative feedback, because the variable returns toward its starting level after the change.", "After the initial rise, the response brings the variable back to its starting level, as expected for negative feedback.",
            [("Positive feedback, because the variable first increases after the change.", "An initial increase does not make the regulation positive; the variable is returned to its set point."),
             ("Positive feedback, because the response amplifies the change over time.", "The graph shows the change shrinking, not amplified."),
             ("No feedback, because the variable changes over time.", "A variable that returns to its set point shows regulation by feedback.")])
    else:
        key, ds = sentence_options("Positive feedback, because the variable increases faster and faster until the process ends.", "The increase accelerates over time, which shows that the response amplifies the stimulus.",
            [("Negative feedback, because the variable eventually decreases.", "The decrease at the end occurs when the process is finished and not because the response opposed the change."),
             ("Negative feedback, because the variable stays close to a constant set point.", "The variable does not stay near a set point; it keeps rising."),
             ("No feedback, because the variable depends only on time.", "The accelerating increase indicates a feedback loop.")])
    stim = graph_stim(desc + " over time", [("Level", [[t, y] for t, y in zip(ts, ys)])], gaxis("Time (minutes)", 0, 60, 10), yax)
    stem = "The graph shows how a physiological variable changes over time after a stimulus. Which type of regulation is most consistent with the graph?"
    return mk("bi_feedback_graph", "4.4", "2.B", stem, key, ds, rng, concept="recognize positive and negative feedback from a time course", stim=stim, path="shape tests on the plotted series (return to baseline vs accelerating growth) vs the generating model", facts=[f"kind={kind}", f"ys={ys[:6]}"], judgment="relate the shape of a time course to the type of feedback")


@retry_sep
def bi_cell_cycle_time(rng):
    total = 200
    cyc = pick(rng, [16, 20, 24])
    counts = {"Interphase": rng.randint(130, 150)}
    rest = total - counts["Interphase"]
    pro = rng.randint(max(8, rest // 3), rest // 2 + 2); counts["Prophase"] = pro
    r2 = rest - pro
    meta = rng.randint(r2 // 4, r2 // 2); counts["Metaphase"] = meta
    r3 = r2 - meta; ana = r3 // 2; counts["Anaphase"] = ana; counts["Telophase"] = r3 - ana
    phase = pick(rng, ["Prophase", "Metaphase", "Anaphase", "Telophase"])
    hrs = Fr(counts[phase], total) * cyc
    agree(float(hrs), counts[phase] / total * cyc, 1e-9, "time")
    mi = (total - counts["Interphase"]) / total
    pairs = [("Reports the percent of cells in the phase instead of the time.", 100 * counts[phase] / total), ("Divides the number of cells by the cycle length.", counts[phase] / cyc), ("Multiplies the count by the cycle length without dividing by the total number of cells.", counts[phase] * cyc), ("Uses the fraction of the dividing cells only (excluding interphase cells) times the cycle length.", counts[phase] / (total - counts["Interphase"]) * cyc)]
    key, ds = val_opts(float(hrs), pairs, lambda v: f"{v:.2f} hours", gap=0.05)
    stim = tbl("Number of cells in each stage in a sample of 200 onion root-tip cells", ["Stage", "Number of cells"], [[k, v] for k, v in counts.items()], notes=[f"Total cells counted: {total}"])
    stem = f"The table shows the number of cells in each stage in a sample of {total} root-tip cells. The cell cycle in these cells lasts {cyc} hours. Assuming the percentage of cells in a stage is proportional to the time spent in it, how long does a cell spend in {phase.lower()}?"
    return mk("bi_cell_cycle_time", "4.5", "5.A", stem, key, ds, rng, concept="estimate time in a stage of the cell cycle from the percentage of cells in that stage", stim=stim, path="exact fraction (count/total) x cycle length vs numpy float evaluation", facts=[f"counts={counts}", f"cyc={cyc}", f"phase={phase}"], judgment="convert counts to a percentage and scale it by the cycle length",
              kwhy=f"The fraction of cells in {phase.lower()} is {counts[phase]}/{total}. Time in the stage = ({counts[phase]}/{total}) x {cyc} hours = {float(hrs):.2f} hours.")


@retry_sep
def bi_mitotic_index(rng):
    N = pick(rng, [400, 500, 1000])
    c_m = rng.randint(int(0.08 * N), int(0.14 * N)); t_m = rng.randint(int(0.02 * N), int(0.06 * N))
    ci, ti = c_m / N * 100, t_m / N * 100
    pct = (ci - ti) / ci * 100
    agree(pct, 100 * (1 - (t_m / c_m)), 1e-9, "pct")
    pairs = [("Divides the decrease by the mitotic index of the treated cells instead of the control.", (ci - ti) / ti * 100), ("Reports the difference in mitotic index in percentage points rather than the percent decrease.", ci - ti), ("Reports the mitotic index of the treated cells instead of the percent decrease.", ti), ("Reports the ratio of control to treated mitotic indexes.", ci / ti)]
    key, ds = val_opts(pct, pairs, lambda v: f"{v:.0f}%", gap=1.5)
    stim = tbl("Cells in mitosis in root tips of control and treated onion seedlings", ["Group", "Cells counted", "Cells in mitosis"], [["Control", N, c_m], ["Treated with a drug", N, t_m]])
    stem = "The mitotic index is the percent of cells in mitosis. The table shows data for control root tips and root tips treated with a drug. By what percent did the drug decrease the mitotic index?"
    return mk("bi_mitotic_index", "4.6", "5.A", stem, key, ds, rng, concept="percent decrease in mitotic index between control and treatment", stim=stim, path="percent change from the two mitotic indexes vs 100 x (1 - treated/control cell counts)", facts=[f"N={N}", f"c={c_m}", f"t={t_m}", f"pct={pct:.3f}"], judgment="compute each index, then the percent change relative to the control", kwhy=f"The control index is {ci:.1f}% and the treated index is {ti:.1f}%. The percent decrease is ({ci:.1f} - {ti:.1f}) / {ci:.1f} x 100 = {pct:.0f}%.")


bi_cell_cycle_events = make_bank_archetype("bi_cell_cycle_events", "4.5", "1.A", [
    B("A cell in G1 of the cell cycle has 46 chromosomes. How many chromosomes and how many DNA molecules does the cell have after S phase, before mitosis begins?",
      ("46 chromosomes, each consisting of two sister chromatids, so 92 DNA molecules", "DNA replication makes sister chromatids but does not change the number of chromosomes."),
      [("92 chromosomes, because S phase doubles the number of chromosomes", "Sister chromatids remain joined, so they count as one chromosome."),
       ("46 chromosomes, each consisting of one chromatid, so 46 DNA molecules", "After replication each chromosome has two chromatids and so two DNA molecules."),
       ("23 chromosomes, because the cell prepares to divide into two cells", "The chromosome number does not change during S phase.")]),
    B("Which event occurs during the S phase of interphase?",
      ("DNA is replicated, so each chromosome has two sister chromatids", "S phase is the synthesis phase in which the DNA is copied."),
      [("The chromosomes line up at the middle of the cell", "This occurs during metaphase of mitosis."),
       ("The nuclear envelope breaks down", "This occurs in prometaphase of mitosis."),
       ("The cytoplasm divides into two cells", "This is cytokinesis, which follows mitosis.")]),
    B("Which statement best describes what happens during anaphase of mitosis?",
      ("Sister chromatids separate and move toward opposite poles of the cell", "In anaphase the sister chromatids are pulled apart by spindle fibers."),
      [("Homologous chromosomes separate and move toward opposite poles", "Homologous chromosomes separate in meiosis I and not in mitosis."),
       ("The DNA is replicated, so each chromosome has two chromatids", "DNA replication occurs during S phase."),
       ("The chromosomes decondense and the nuclear envelopes re-form", "This occurs in telophase.")]),
], "describe events and chromosome counts in the cell cycle", "fixed fact bank checked against CED 4.5", est=60)


@retry_sep
def bi_dna_content_graph(rng):
    g1 = rng.randint(4, 8); s_len = rng.randint(4, 8); g2 = rng.randint(2, 5); m = rng.randint(1, 3)
    t = [0, g1, g1 + s_len, g1 + s_len + g2, g1 + s_len + g2 + m]
    d = [2, 2, 4, 4, 2]
    # 독립 경로: 구간 기울기가 양인 구간을 찾는다
    slopes = [(d[i + 1] - d[i]) / (t[i + 1] - t[i]) for i in range(4)]
    s_idx = [i for i, s in enumerate(slopes) if s > 0]
    agree(0, 0 if s_idx == [1] else 1, 1e-9, "S")
    stim = graph_stim("DNA content per cell during one cell cycle", [("DNA per cell", [[a, b] for a, b in zip(t, d)])], gaxis("Time (hours)", 0, t[-1] + 2, 2 if t[-1] > 12 else 2), gaxis("DNA content per cell (arbitrary units)", 0, 5, 1))
    iv = lambda a, b: f"From {a} to {b} hours"  # noqa: E731
    key = Opt(iv(t[1], t[2]), True, f"DNA content rises from 2 to 4 units between {t[1]} and {t[2]} hours, which is when DNA is replicated (S phase).", None)
    ds = [Opt(iv(t[0], t[1]), False, "DNA content stays at 2 units during G1, so no DNA is replicated in this interval.", None), Opt(iv(t[2], t[3]), False, "DNA content stays at 4 units in G2, after replication is finished.", None), Opt(iv(t[3], t[4]), False, "DNA content falls from 4 to 2 units as the cell divides, so DNA is being partitioned and not replicated.", None)]
    stem = "The graph shows the DNA content per cell during one cell cycle. During which interval is DNA being replicated?"
    return mk("bi_dna_content_graph", "4.5", "2.A", stem, key, ds, rng, concept="identify S phase from a DNA-content graph", stim=stim, path="the segment with a positive slope among the plotted vertices vs the generating phase lengths", facts=[f"t={t}", f"d={d}"], judgment="identify the interval where the plotted DNA content increases")


bi_checkpoint = make_bank_archetype("bi_checkpoint", "4.6", "6.E", [
    B("A cell has DNA damage that cannot be repaired. In a normal cell, the protein p53 stops the cell cycle and can trigger cell death. What would most likely happen in a cell that has a mutation that makes p53 nonfunctional?",
      ("The cell may continue through the cell cycle with damaged DNA, which can lead to tumor growth.", "Without a functioning checkpoint protein, damaged cells are not stopped and mutations can accumulate."),
      [("The cell will stop in G1 permanently, which prevents tumor growth.", "A nonfunctional p53 would not stop the cycle."),
       ("The cell will repair its DNA faster because p53 slows repair.", "p53 promotes repair or cell death and does not slow repair."),
       ("The cell will skip S phase and move directly to anaphase.", "Loss of a checkpoint does not remove the sequence of the cell cycle.")]),
    B("Cyclin-dependent kinases (CDKs) are active only when bound to cyclins. Cyclin levels rise and fall during the cell cycle. What is the most likely effect of a drug that prevents cyclin from being produced?",
      ("CDKs stay inactive and the cell is arrested at a checkpoint.", "Without cyclin the CDKs are inactive, so the cell cannot progress past the checkpoint."),
      [("CDKs become permanently active and the cell divides rapidly.", "CDKs need cyclin to be active."),
       ("The cell enters G0 and restarts the cycle at S phase.", "A cell blocked at a checkpoint is arrested; it does not skip phases."),
       ("DNA replication occurs twice in the same cell cycle.", "The lack of cyclin does not cause re-replication of DNA.")]),
    B("A cell enters the M phase before DNA replication in S phase is complete. Which checkpoint failure best explains this?",
      ("A failure of the checkpoint that checks for complete DNA replication before mitosis", "Checkpoints normally delay mitosis until replication is complete."),
      [("A failure of the checkpoint that ensures the cell has enough nutrients in G1", "This checkpoint acts before S phase and not before M."),
       ("A failure of the spindle assembly checkpoint during anaphase", "The spindle checkpoint ensures chromosomes attach before anaphase and does not monitor replication."),
       ("An overproduction of cell-surface receptors in G0", "Receptor numbers are not the checkpoint that monitors DNA replication.")]),
], "predict the effect of losing a cell-cycle checkpoint or regulator", "fixed fact bank checked against CED 4.6", est=70)

bi_cancer_mutation = make_bank_archetype("bi_cancer_mutation", "4.6", "6.D", [
    B("Which statement best explains how mutations in the genes that regulate the cell cycle can lead to cancer?",
      ("Mutations can cause cells to divide without the normal controls, so cells can accumulate and form a tumor.", "Mutations in genes that regulate the cell cycle can remove the controls that limit cell division."),
      [("Mutations always cause cells to stop dividing and die, which damages tissues.", "Cancer results from uncontrolled division, not from a stop in division."),
       ("Mutations in these genes are always inherited from a parent and cause cancer at birth.", "Many cancer-causing mutations occur in body cells during a lifetime."),
       ("Mutations convert body cells into gametes that divide by meiosis.", "Cancer cells divide by mitosis.")]),
    B("A tumor suppressor gene normally slows cell division. Which mutation would most likely contribute to cancer?",
      ("A mutation that makes the tumor suppressor protein nonfunctional", "Loss of a protein that slows division can allow uncontrolled division."),
      [("A mutation that makes the tumor suppressor protein more active", "A more active suppressor would further slow division."),
       ("A mutation in a gene for a protein that does not affect the cell cycle", "Only changes that disrupt cell-cycle control are likely to contribute to cancer."),
       ("A mutation that is silent and does not change the amino acid sequence", "A silent mutation does not change the protein.")]),
    B("A proto-oncogene encodes a protein that stimulates cell division in response to growth factors. Which change would most likely turn it into an oncogene?",
      ("A mutation that makes the protein active even when no growth factor is present", "A protein that is always active drives division without the normal signal."),
      [("A mutation that prevents the protein from being made", "Loss of a protein that stimulates division would reduce division."),
       ("A mutation that makes the growth factor receptor unable to bind growth factors", "This would reduce the response to growth factors."),
       ("A mutation that increases the activity of a protein that stops the cell cycle", "This would slow division rather than stimulate it.")]),
], "relate mutations in regulators of the cell cycle to cancer", "fixed fact bank checked against CED 4.6", est=65)


@retry_sep
def bi_cyclin_graph(rng):
    tm = rng.choice([8, 10, 12, 14]); ts = list(range(0, 25, 1))
    cyc = [round(35 + 65 * math.exp(-((t - tm + 1) / 4.0) ** 2), 1) for t in ts]
    cdk = [round(5 + 95 * math.exp(-((t - tm) / 3.0) ** 2), 1) for t in ts]
    pk = ts[int(np.argmax(cdk))]
    agree(pk, tm, 1e-9, "peak")
    key = Opt(f"At about {tm} hours, when the CDK activity is at its maximum", True, f"CDK activity peaks at about {tm} hours, and active CDK triggers entry into mitosis.", None)
    cand = [(f"At about {max(2, tm - 8)} hours, when the CDK activity is lowest", "CDK activity is near its minimum at this time, so mitosis is not triggered.", max(2, tm - 8)), (f"At about {tm + 6} hours, after the CDK activity has fallen", "CDK activity has fallen by this time, which is after mitosis has begun.", tm + 6), (f"At about {max(2, tm - 4)} hours, when the cyclin concentration begins to rise", "Cyclin begins to rise before CDK activity is high enough to trigger mitosis.", max(2, tm - 4))]
    ds = [Opt(t, False, w, None) for t, w, _ in cand]
    stim = graph_stim("Cyclin concentration and CDK activity during the cell cycle", [("Cyclin concentration", [[t, c] for t, c in zip(ts, cyc)]), ("CDK activity", [[t, c] for t, c in zip(ts, cdk)])], gaxis("Time (hours)", 0, 24, 4), gaxis("Relative level (arbitrary units)", 0, 100, 20))
    stem = "The graph shows the concentration of a cyclin and the activity of the CDK that binds to it during one cell cycle. At which time is the cell most likely to enter mitosis?"
    return mk("bi_cyclin_graph", "4.6", "2.B", stem, key, ds, rng, concept="relate cyclin and CDK activity to entry into mitosis", stim=stim, path="argmax of the plotted CDK series vs the generating peak time", facts=[f"tm={tm}"], judgment="read the peak of CDK activity and connect it to mitosis")


bi_communication_types = make_bank_archetype("bi_communication_types", "4.1", "1.A", [
    B("A cell releases a signaling molecule that diffuses a short distance and affects only neighboring cells. Which type of signaling does this describe?",
      ("Local signaling", "Local (paracrine) signals act on nearby cells."),
      [("Long-distance signaling by hormones carried in the blood", "Hormones travel through the circulatory system to distant targets."),
       ("Direct contact signaling through gap junctions only", "The signal in this case diffuses through the extracellular fluid."),
       ("Self-signaling that affects only the cell that released it", "The signal described reaches neighboring cells.")]),
    B("Plant cells in a root communicate through channels that connect the cytoplasm of adjacent cells. What are these channels?",
      ("Plasmodesmata", "Plasmodesmata link the cytoplasm of adjacent plant cells."),
      [("Gap junctions", "Gap junctions are channels between animal cells."),
       ("Desmosomes", "Desmosomes anchor animal cells and do not connect the cytoplasm."),
       ("Tight junctions", "Tight junctions seal the space between animal cells.")]),
    B("Insulin released by the pancreas travels through the bloodstream to affect cells in the liver and muscles. Which type of signaling is this?",
      ("Endocrine signaling, which uses hormones that travel in the blood", "Endocrine signals travel to distant target cells."),
      [("Paracrine signaling, which affects only neighboring cells", "Insulin acts on distant tissues, not only on neighboring cells."),
       ("Signaling by direct contact between cell surfaces", "Insulin is a secreted signal that travels away from the secreting cells."),
       ("Autocrine signaling, which affects only the secreting cell", "Insulin acts on other cells and not only on the cell that secreted it.")]),
], "classify a signaling situation by distance and mechanism", "fixed fact bank checked against CED 4.1", est=55)


@retry_sep
def bi_pathway_mutant_table(rng):
    comps = ["receptor", "protein A", "protein B", "transcription factor (TF)"]
    defect = rng.randrange(4)
    treat = ["Signaling molecule added", "Active protein A added", "Active protein B added", "Active TF added"]
    # 독립 경로 1: 경로를 단계별로 실제로 따라가 본다(처리가 들어가는 단계부터 마지막 단계까지 결함 단계가 있으면 신호가 끊긴다)
    def simulate(start):
        for step in range(start, 4):
            if step == defect:
                return False
        return True
    res = [simulate(0)] + [simulate(i) for i in range(1, 4)]
    res = [False] + [simulate(i) and i > defect for i in range(1, 4)]
    rows = [[t, "Yes" if r else "No"] for t, r in zip(treat, res)]
    keyname = comps[defect]
    # 독립 경로 2: 반응이 처음 나타나는 처리 직전 단계가 결함
    first = next((i for i, r in enumerate(res) if r), None)
    expect = comps[first - 1] if first is not None else comps[3]
    if first == 0:
        raise ValueError("bad")
    agree(0, 0 if expect == keyname else 1, 1e-9, "defect")
    names = {"receptor": "The receptor", "protein A": "Protein A", "protein B": "Protein B", "transcription factor (TF)": "The TF"}
    ds = []
    for c in comps:
        if c == keyname:
            continue
        i = comps.index(c)
        if i < defect:
            w = f"The {c} is upstream of the defect: adding an active downstream protein skips it, and the table shows a response only after the defective step is bypassed."
        else:
            w = f"The {c} is downstream of the first step that restores the response, and the table shows that bypassing the defective step already restores the response."
        ds.append(Opt(names[c], False, w, None))
    key = Opt(names[keyname], True, f"A response is restored only when the signal enters downstream of the {keyname}, so the {keyname} must be the nonfunctional component." if defect < 3 else "No treatment restores the response, including active TF, so the final component, the transcription factor, is nonfunctional.", None)
    stim = tbl("Response of a mutant cell line to treatments in a pathway: receptor, then protein A, then protein B, then a transcription factor that activates a target gene", ["Treatment", "Target gene expressed"], rows)
    stem = "In a signaling pathway, the receptor activates protein A, protein A activates protein B, and protein B activates a transcription factor (TF) that turns on a target gene. A mutant cell has one nonfunctional component. The table shows whether the target gene is expressed after each treatment. Which component is most likely nonfunctional?"
    return mk("bi_pathway_mutant_table", "4.3", "4.B", stem, key, ds, rng, concept="locate the defective step of a signal pathway from rescue data", stim=stim, path="direct simulation of the linear pathway with a defect at each position vs inference from the first rescuing treatment", facts=[f"defect={keyname}"], judgment="describe a table of rescue results and infer which step is defective")


STAGE_U3 = ["bi_enzyme_active_site", "bi_enzyme_rate_calc", "bi_enzyme_inhibitor_data", "bi_enzyme_ph_graph", "bi_enzyme_temp_pred", "bi_energy_coupling", "bi_activation_energy_graph", "bi_photosynthesis_inputs", "bi_photosynthesis_data", "bi_leaf_disk_et50", "bi_respiration_concept", "bi_respiration_rates", "bi_fermentation", "bi_chemiosmosis", "bi_limiting_factor", "bi_enzyme_substrate_graph"]
STAGE_U4 = ["bi_signal_steps", "bi_signal_amplification", "bi_signal_mutation", "bi_feedback_type", "bi_feedback_graph", "bi_cell_cycle_time", "bi_mitotic_index", "bi_cell_cycle_events", "bi_dna_content_graph", "bi_checkpoint", "bi_cancer_mutation", "bi_cyclin_graph", "bi_communication_types", "bi_pathway_mutant_table"]
