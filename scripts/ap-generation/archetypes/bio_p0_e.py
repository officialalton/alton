"""AP Biology P0 원형 E — 질문·방법(Practice 3)·오차 막대(5.B)·자료 기술(4.B)·논증(6.B–6.D)·시각 표현 보강. 공식 MC 스킬 비중(P3 8–14%)을 처음부터 채우기 위한 원형이다."""
from bio_common import *  # noqa: F401,F403

# ============================ Practice 3: 질문과 방법 ============================
bi_design_variable_osmosis = make_bank_archetype("bi_design_variable_osmosis", "2.7", "3.C", [
    B("A student places equal-sized potato cores in sucrose solutions of 0.0 M, 0.2 M, 0.4 M, 0.6 M, and 0.8 M for 24 hours and measures the mass of each core before and after. Which of the following is the dependent variable in this investigation?",
      ("The percent change in mass of the potato cores", "The dependent variable is the quantity measured in response to the manipulated variable."),
      [("The molarity of the sucrose solution", "Molarity is the independent variable that the student changes."),
       ("The temperature of the room during the 24 hours", "Temperature should be held constant and is a controlled variable."),
       ("The size of the potato cores at the start", "Starting size should be controlled and is not the measured response.")]),
    B("A student places equal-sized potato cores in sucrose solutions of five different molarities and measures the percent change in mass of each core after 24 hours. The student keeps the temperature, the volume of solution, and the time the same for all of the cores. What is the purpose of keeping these factors constant?",
      ("To make sure the change in mass is due to the sucrose concentration and not to another factor", "Controlled variables prevent other factors from affecting the dependent variable."),
      [("To make the independent variable change with the time of day", "Controlled factors are kept constant and do not change the independent variable."),
       ("To increase the number of cores that gain mass", "The purpose is to isolate an effect, not to produce a result."),
       ("To ensure that the cores all lose the same percent of mass", "The results should reflect the effect of the variable, not be forced to be equal.")]),
    B("A student places equal-sized potato cores in sucrose solutions of different molarities for 24 hours and wants to test the hypothesis that potato cells have a lower solute concentration than a 0.6 M sucrose solution. Which result would best support the hypothesis?",
      ("The cores in the 0.6 M solution lose mass.", "Water leaves the cells when the solution has a higher solute concentration than the cells."),
      [("The cores in the 0.6 M solution gain mass.", "Gaining mass shows that the solution has a lower solute concentration than the cells."),
       ("The cores in the 0.6 M solution show no change in mass.", "No change would indicate that the solution is isotonic to the cells."),
       ("The cores in distilled water lose mass.", "Cores in distilled water are expected to gain mass.")]),
], "identify variables and controls and predict results in an osmosis investigation", "fixed fact bank checked against CED 2.7 and science practice 3", est=65)

bi_design_variable_enzyme = make_bank_archetype("bi_design_variable_enzyme", "3.2", "3.C", [
    B("A student investigates how temperature affects the rate at which the enzyme catalase breaks down hydrogen peroxide by measuring the volume of oxygen gas produced in 2 minutes at 10, 25, 37, and 60 degrees Celsius. Which of the following should be kept constant?",
      ("The concentration of hydrogen peroxide and the amount of catalase", "Only temperature should be changed, so the concentrations and amounts must stay the same."),
      [("The temperature of the reaction mixture", "Temperature is the independent variable and is changed."),
       ("The volume of oxygen gas produced", "The volume of oxygen is the dependent variable that is measured."),
       ("The time at which each trial is stopped, which should change in each trial", "Time should be the same for all trials.")]),
    B("A student measures the volume of oxygen gas released in 2 minutes when the enzyme catalase breaks down hydrogen peroxide at 10, 25, 37, and 60 degrees Celsius, using the same amounts of enzyme and hydrogen peroxide each time. Which question is best answered by this experiment?",
      ("How does temperature affect the rate of the reaction catalyzed by catalase?", "The question links one manipulated variable to a measured response."),
      [("Why does catalase exist in cells?", "This question cannot be tested with the data collected."),
       ("What is the best temperature for living organisms?", "The investigation does not address organisms as a whole."),
       ("Does catalase change the structure of hydrogen peroxide permanently?", "The experiment does not measure the structure of hydrogen peroxide.")]),
    B("A student measures the rate at which catalase breaks down hydrogen peroxide at 10, 25, 37, and 60 degrees Celsius and predicts that the rate will be lowest at 60 degrees Celsius. Which statement is the best justification for this prediction?",
      ("High temperature can change the shape of the enzyme, which reduces binding of the substrate.", "Denaturation at high temperature reduces enzyme activity."),
      [("High temperature increases the activation energy of the reaction.", "Enzymes lower the activation energy, and heat does not raise it in this way."),
       ("High temperature removes the substrate from the solution.", "Temperature does not remove hydrogen peroxide by itself."),
       ("High temperature makes the enzyme a different catalyst for the same reaction.", "Heating does not change the catalyst to another enzyme that works.")]),
], "identify controls, questions, and justified predictions in an enzyme investigation", "fixed fact bank checked against CED 3.2", est=65)

bi_design_control_photosynthesis = make_bank_archetype("bi_design_control_photosynthesis", "3.4", "3.C", [
    B("A student wants to determine whether light is required for oxygen production by an aquatic plant. The student places one plant in a lit tube and measures the oxygen produced. Which additional treatment would serve as the best control?",
      ("An identical plant in a tube kept in the dark under otherwise identical conditions", "The control differs from the experimental treatment only in the factor being tested."),
      [("An identical plant in a tube that receives brighter light", "A different light intensity tests a different question."),
       ("A tube with no plant but with the same light", "A tube without a plant could test for non-biological effects but does not test the requirement for light."),
       ("A plant of a different species kept in the dark", "Changing the species introduces a second variable.")]),
    B("In a leaf disk assay, leaf disks float when oxygen produced by photosynthesis collects inside the disks. A student adds bicarbonate to the solution. What is the purpose of the bicarbonate?",
      ("It provides a source of carbon dioxide for photosynthesis.", "Bicarbonate in solution supplies the carbon dioxide needed for the Calvin cycle."),
      [("It provides oxygen that makes the disks float.", "The oxygen that makes the disks float is produced by the disks."),
       ("It acts as an energy source in place of light.", "Bicarbonate does not replace light as the energy source."),
       ("It prevents the disks from performing cellular respiration.", "Bicarbonate does not stop respiration.")]),
    B("A student predicts that leaf disks in a solution with bicarbonate placed in light will float sooner than disks in a solution without bicarbonate. Which statement best justifies the prediction?",
      ("Bicarbonate increases the amount of carbon dioxide available, so the rate of photosynthesis and oxygen production increases.", "More available carbon dioxide can increase the rate of carbon fixation and oxygen production."),
      [("Bicarbonate increases the activation energy for photosynthesis, which speeds the reaction.", "Raising activation energy would slow a reaction."),
       ("Bicarbonate is used to make glucose in the light reactions.", "Carbon dioxide is used in the Calvin cycle and not in the light reactions."),
       ("Bicarbonate makes the leaf disks more dense so they float.", "Floating results from oxygen trapped in the disks, which lowers their density.")]),
], "identify controls and justify predictions in a photosynthesis investigation", "fixed fact bank checked against CED 3.4", est=65)

bi_question_testable_cellcycle = make_bank_archetype("bi_question_testable_cellcycle", "4.6", "3.A", [
    B("A student wants to investigate how a chemical affects cell division in onion root tips. Which of the following is the best testable question?",
      ("Does the concentration of the chemical affect the percent of root-tip cells in mitosis?", "A testable question names a variable that can be manipulated and a measurable response."),
      [("Why do onion root cells divide, and what is the purpose of division in the plant?", "This question is about purpose and cannot be answered with a measurement."),
       ("Is the chemical good for the health of onion plants in general?", "The word good is not defined or measurable."),
       ("Are onion root tips more interesting to study than onion leaves?", "Interest is not measurable.")]),
    B("A student predicts that root tips treated with a chemical that blocks spindle formation will have a higher proportion of cells in metaphase than untreated root tips. Which statement best explains the prediction?",
      ("Without spindle fibers, chromosomes cannot move apart, so cells accumulate at metaphase.", "Blocking the spindle arrests cells before anaphase."),
      [("Without spindle fibers, DNA replication cannot occur, so cells stay in G1.", "The spindle is not needed for DNA replication."),
       ("Without spindle fibers, cells move directly from prophase to cytokinesis.", "Without chromosome separation, cells do not complete division."),
       ("Without spindle fibers, the nuclear envelope never breaks down, so cells stay in interphase.", "The question concerns the arrest of cells that entered mitosis.")]),
], "pose a testable question and justify a prediction in a cell-cycle investigation", "fixed fact bank checked against CED 4.5 and 4.6", est=60)

bi_hypothesis_signal = make_bank_archetype("bi_hypothesis_signal", "4.2", "3.B", [
    B("A researcher hypothesizes that a hormone causes liver cells to break down glycogen by binding a receptor on the cell surface. Which prediction is the most appropriate test of the hypothesis?",
      ("If cells lacking the receptor are exposed to the hormone, then glycogen breakdown will not increase.", "A prediction tests whether the proposed receptor is necessary for the response."),
      [("If the hormone is added to the cells, then glycogen will be made from glucose.", "The hypothesis concerns glycogen breakdown, not synthesis."),
       ("If the cells are heated, then the hormone will turn into a receptor.", "Heating does not turn a hormone into a receptor."),
       ("If the hormone is added to the cells, the cells will stop making all proteins.", "This prediction is unrelated to the proposed receptor-dependent response.")]),
    B("A student states the null hypothesis for an experiment on the effect of a signaling molecule on cell division. Which statement is a null hypothesis?",
      ("The signaling molecule has no effect on the rate of cell division.", "A null hypothesis states that there is no effect or no difference."),
      [("The signaling molecule increases the rate of cell division.", "This is an alternative hypothesis."),
       ("The signaling molecule causes cells to divide faster than any other molecule.", "This predicts an effect and a comparison."),
       ("The rate of cell division depends on many factors.", "This statement is not testable as a statement of no effect.")]),
], "state null hypotheses and predictions for signaling experiments", "fixed fact bank checked against CED 4.2 and science practice 3", est=60)

bi_null_hypothesis_ecology = make_bank_archetype("bi_null_hypothesis_ecology", "8.1", "3.B", [
    B("A student investigates whether pill bugs prefer humid or dry conditions using a choice chamber. Which statement is the null hypothesis for this investigation?",
      ("Pill bugs show no preference for humid or dry conditions.", "The null hypothesis states there is no difference in the distribution of the pill bugs."),
      [("Pill bugs prefer humid conditions.", "This is an alternative hypothesis."),
       ("Pill bugs prefer dry conditions.", "This also states a preference, which is an alternative hypothesis."),
       ("Pill bugs move more in humid conditions than in dry conditions.", "This is a prediction about movement and not about distribution.")]),
    B("A student predicts that fertilizer will increase the growth rate of grass in a lawn. Which experimental design is best for testing this prediction?",
      ("Apply fertilizer to some plots and no fertilizer to similar plots, and measure growth in all plots.", "Treatment and control plots that differ in only the fertilizer allow a comparison."),
      [("Apply fertilizer to all plots and compare the growth with last year's growth.", "Without a control group the effect of fertilizer cannot be separated from other changes."),
       ("Apply different fertilizers to each plot and different amounts of water to each plot.", "Changing two variables makes it impossible to identify the cause."),
       ("Apply fertilizer to one plot and measure only the height of the tallest plant.", "One plot and one measurement do not provide a reliable comparison.")]),
], "state null hypotheses and design comparisons in ecology investigations", "fixed fact bank checked against CED 8.1", est=60)

bi_prediction_gene = make_bank_archetype("bi_prediction_gene", "6.5", "3.B", [
    B("Bacteria are grown in a medium that contains lactose but no glucose. A researcher predicts that the bacteria will produce more of the enzymes encoded by the lac operon than bacteria grown without lactose. Which statement best supports the prediction?",
      ("Lactose binds the repressor, which releases the operator so transcription of the operon can occur.", "In the presence of lactose the repressor cannot block the operator."),
      [("Lactose binds the promoter and speeds transcription by acting as a repressor.", "Lactose acts on the repressor and not on the promoter."),
       ("Lactose is converted to DNA that makes more copies of the operon.", "Lactose does not become DNA."),
       ("Lactose blocks the ribosome, so more RNA remains in the cell.", "Lactose does not block ribosomes.")]),
    B("A researcher deletes the operator region of the lac operon in bacteria. Which result would most likely be observed when the bacteria are grown without lactose?",
      ("The enzymes are produced, because the repressor can no longer bind to block transcription.", "Without the operator, the repressor has no binding site."),
      [("The enzymes are never produced, because RNA polymerase can no longer bind the promoter.", "Deleting the operator does not remove the promoter."),
       ("The bacteria produce lactose, because the operator codes for lactose.", "The operator is a regulatory sequence and does not code for lactose."),
       ("The enzymes are produced only when lactose is present, as in the normal operon.", "The normal pattern requires the operator and repressor.")]),
], "predict the result of an experiment on gene regulation", "fixed fact bank checked against CED 6.5", est=65)

bi_new_investigation_selection = make_bank_archetype("bi_new_investigation_selection", "7.2", "3.D", [
    B("Researchers observe that the average beak size of a bird population increased after a drought. They hypothesize that this change was caused by natural selection for beak size. Which additional investigation would best test this hypothesis?",
      ("Determine whether beak size is heritable by comparing the beak sizes of parents and offspring.", "Natural selection acts on heritable variation, so heritability must be shown."),
      [("Measure the beak sizes of the birds again in the same week to check the first measurements.", "Remeasuring does not test heritability or the cause of the change."),
       ("Count the number of birds in the population without measuring any traits.", "Counting alone does not test whether the change was caused by selection on a heritable trait."),
       ("Teach the birds to eat larger seeds and measure how their beaks change.", "This tests learning, not selection on inherited variation.")]),
    B("A researcher finds that a moth population is darker in a polluted forest than in a clean forest. Which additional investigation would best test whether predation by birds is the selective pressure?",
      ("Release equal numbers of dark and light moths in each forest and compare how many birds eat.", "The experiment compares survival of the two phenotypes in each environment."),
      [("Measure the wing length of the moths in each forest and compare the averages.", "Wing length is not related to the hypothesis about predation on color."),
       ("Count the number of trees in each forest and compare the totals.", "The number of trees does not test the effect of predation."),
       ("Paint all of the moths dark and release them in both forests.", "Painting all moths dark removes the comparison between phenotypes.")]),
], "propose a follow-up investigation to test a hypothesis about selection", "fixed fact bank checked against CED 7.2", est=65)

bi_new_investigation_enzyme = make_bank_archetype("bi_new_investigation_enzyme", "3.1", "3.D", [
    B("The rate of an enzyme-catalyzed reaction levels off as substrate concentration increases. A student hypothesizes that the enzyme becomes saturated. Which additional investigation would best test this hypothesis?",
      ("Repeat the experiment with more enzyme and determine whether the maximum rate increases.", "If the enzyme is limiting, more enzyme should increase the maximum rate."),
      [("Repeat the experiment with more substrate only and determine whether the rate increases further.", "The original data already show that more substrate does not increase the rate."),
       ("Repeat the experiment at a much higher temperature and compare the rates.", "Temperature tests a different hypothesis."),
       ("Repeat the experiment with a different substrate and no enzyme.", "Removing the enzyme does not test saturation of the enzyme.")]),
    B("A student finds that an unknown compound reduces the rate of an enzyme-catalyzed reaction. The student hypothesizes that the compound is a competitive inhibitor. Which follow-up experiment would best test this hypothesis?",
      ("Vary the substrate concentration with the compound present and see whether the inhibition is overcome.", "A competitive inhibitor's effect decreases as substrate concentration increases."),
      [("Measure the rate with the compound at several temperatures and ignore the substrate concentration.", "Temperature does not test competition for the active site."),
       ("Measure the mass of the compound before and after the reaction.", "The mass of the compound does not test the type of inhibition."),
       ("Measure the pH of the compound alone.", "The pH of the compound does not show how it binds to the enzyme.")]),
], "design a follow-up experiment to test a hypothesis about enzyme activity", "fixed fact bank checked against CED 3.1", est=65)

bi_procedure_choice_dna = make_bank_archetype("bi_procedure_choice_dna", "6.8", "3.C", [
    B("A forensic scientist wants to determine whether DNA from a hair found at a scene matches DNA from a suspect. Which procedure is the best choice?",
      ("Cut both DNA samples with the same restriction enzyme, and compare the fragment patterns on a gel.", "Using the same enzyme and a gel allows the fragment patterns to be compared."),
      [("Compare the color of both hair samples under a microscope.", "Color does not identify the individual by DNA."),
       ("Place both samples in a solution and measure the pH.", "pH does not compare DNA sequences."),
       ("Cut one DNA sample with one enzyme and the other sample with a different enzyme.", "Different enzymes produce patterns that cannot be compared directly.")]),
    B("A student wants to determine whether bacteria have taken up a plasmid that confers antibiotic resistance. Which procedure is the best choice?",
      ("Grow the treated bacteria on a medium that contains the antibiotic and see whether colonies form.", "Only bacteria that took up the resistance plasmid can grow on the antibiotic."),
      [("Grow the treated bacteria on a medium without the antibiotic and count colonies.", "Growth without the antibiotic does not show uptake of the plasmid."),
       ("Observe the bacteria for movement under a microscope.", "Movement does not show whether the plasmid was taken up."),
       ("Place the bacteria in the dark and measure the temperature.", "Temperature in the dark does not test for the plasmid.")]),
], "choose a procedure that answers a question about DNA or transformation", "fixed fact bank checked against CED 6.8", est=60)

bi_question_testable_ecology = make_bank_archetype("bi_question_testable_ecology", "8.4", "3.A", [
    B("A student wants to investigate the effect of population density on the growth of a plant. Which question is the best testable question?",
      ("How does the number of seedlings planted in a container affect the mass of each seedling after four weeks?", "The question names a manipulated variable and a measurable response."),
      [("Do plants like to grow in crowded containers more than in roomy containers?", "Liking is not measurable."),
       ("Is it better for a plant to have more space around it than less space?", "The word better is not defined."),
       ("Why are the leaves of most plants green instead of another color?", "This question does not test the effect of density.")]),
    B("A researcher wants to test the hypothesis that competition for light limits the growth of seedlings in a dense planting. Which prediction best tests this hypothesis?",
      ("If dense seedlings are given extra light, their growth will increase relative to dense seedlings in normal light.", "Adding light to dense plantings tests whether light is the limiting resource."),
      [("If seedlings are planted farther apart, they will have more leaves than seedlings planted close together.", "This prediction does not isolate light as the limiting resource."),
       ("If seedlings are watered more often than before, they will all die within the first week.", "This prediction is unrelated to the hypothesis about light."),
       ("If seedlings are planted in the dark, they will grow faster than seedlings planted in the light.", "Plants in the dark cannot carry out photosynthesis and are expected to grow poorly.")]),
], "pose testable questions and predictions in population-density investigations", "fixed fact bank checked against CED 8.4", est=60)

bi_control_choice_membrane = make_bank_archetype("bi_control_choice_membrane", "2.4", "3.C", [
    B("A student uses dialysis tubing, a selectively permeable membrane, filled with starch and glucose solution and placed in a beaker of water. After an hour, the water in the beaker tests positive for glucose but not for starch. What conclusion is best supported?",
      ("Glucose molecules are small enough to pass through the membrane, but starch molecules are not.", "Only the small glucose molecules diffused out of the tubing."),
      [("Starch molecules are small enough to pass through the membrane, but glucose molecules are not.", "The beaker tested positive for glucose, which means glucose crossed the membrane."),
       ("Neither starch nor glucose can pass through the membrane.", "Glucose was detected outside the tubing."),
       ("Both starch and glucose crossed the membrane because the membrane is not selective.", "Starch was not detected outside the tubing.")]),
    B("A student places dialysis tubing, a selectively permeable membrane, filled with a starch and glucose solution in a beaker of water and tests the water in the beaker for starch and glucose after an hour. Which additional setup would serve as the best control?",
      ("A tubing filled with water only and placed in a beaker of water, tested in the same way", "A control with water inside shows whether the tests give a result without the solutes."),
      [("A tubing filled with a more concentrated starch and glucose solution placed in the same beaker", "A different concentration tests another variable."),
       ("A beaker with starch and glucose but no tubing", "Without the tubing the movement across the membrane cannot be tested."),
       ("A tubing filled with the same solution and placed in a hot water bath", "A change in temperature introduces a second variable.")]),
], "interpret results and choose controls in a membrane permeability experiment", "fixed fact bank checked against CED 2.4", est=65)

bi_hypothesis_heredity = make_bank_archetype("bi_hypothesis_heredity", "5.3", "3.B", [
    B("A student crosses two heterozygous plants and wants to test whether the inheritance of the trait follows a 3:1 phenotypic ratio. Which statement is the best null hypothesis for the investigation?",
      ("The observed numbers do not differ from a 3:1 ratio beyond chance.", "The null hypothesis is that the observed results fit the expected ratio."),
      [("The offspring will show a 1:1 ratio.", "This predicts a different ratio and not a statement of no difference."),
       ("The trait is controlled by two genes on separate chromosomes.", "This statement is about gene number and not about the expected ratio."),
       ("All offspring will have the dominant phenotype.", "This predicts a specific outcome that differs from the expected ratio.")]),
    B("A researcher crosses a plant of unknown genotype with a homozygous recessive plant and predicts that about half of the offspring will show the recessive phenotype. Which genotype is the researcher assuming for the unknown plant?",
      ("Heterozygous", "A heterozygote crossed with a homozygous recessive plant yields a 1:1 ratio."),
      [("Homozygous dominant", "A homozygous dominant plant would produce only dominant offspring."),
       ("Homozygous recessive", "A homozygous recessive plant would produce only recessive offspring."),
       ("Either homozygous genotype", "The two homozygous genotypes give different results and do not both give a 1:1 ratio.")]),
], "state hypotheses and predicted ratios for genetic crosses", "fixed fact bank checked against CED 5.3", est=60)

bi_new_investigation_cellsize = make_bank_archetype("bi_new_investigation_cellsize", "2.2", "3.D", [
    B("A student models cells with agar cubes of different sizes soaked in a dye and measures how far the dye diffuses in 10 minutes. The student hypothesizes that smaller cells exchange materials more efficiently. Which additional investigation would best test this hypothesis?",
      ("Calculate the surface-area-to-volume ratio of each cube and compare it with the percent of the cube that the dye reached.", "Comparing the ratio with the fraction of volume reached tests the idea that exchange depends on the ratio."),
      [("Soak the cubes for a different amount of time and measure the color only on the surface.", "This does not compare the efficiency of exchange with size."),
       ("Compare the mass of the cubes before they are soaked.", "Mass before soaking does not test exchange efficiency."),
       ("Replace the dye with a different dye and keep a single cube size.", "A single cube size cannot test the effect of size.")]),
    B("A student models cells with agar cubes of different sizes soaked in a dye for the same amount of time. The dye reaches the center of the small cubes but not the center of the large cubes. Which conclusion is best supported?",
      ("Diffusion is less efficient at supplying the interior of larger cubes, which supports a limit to cell size.", "Larger blocks have a smaller surface-area-to-volume ratio and a longer diffusion distance."),
      [("Larger cubes have a larger surface-area-to-volume ratio, so they are exchanged more efficiently.", "Larger cubes have a smaller ratio."),
       ("The dye affects the cubes by making them smaller.", "The data are about the distance the dye travels, not about the dye changing the cubes."),
       ("The experiment shows that real cells are always cube-shaped.", "The model does not claim anything about the shape of real cells.")]),
], "interpret a cell-size model investigation and propose follow-up tests", "fixed fact bank checked against CED 2.2", est=65)

# ============================ 5.B 오차 막대·신뢰구간, 5.A 통계량 ============================


@retry_sep
def bi_error_bars_overlap(rng):
    n = pick(rng, [8, 10, 12])
    sc = pick(rng, [("catalase activity", "mL of oxygen per minute", ["15 °C", "37 °C", "60 °C"]), ("seedling height", "cm", ["no fertilizer", "low fertilizer", "high fertilizer"]), ("pigment absorbance", "arbitrary units", ["450 nm", "550 nm", "650 nm"])])
    meas, unit, levels = sc
    mid = rng.choice([[8.0, 14.0, 9.0], [10.0, 15.0, 15.8], [6.0, 9.0, 12.5]])
    se = [round(m * rng.uniform(0.03, 0.06), 2) for m in mid]
    means = [round(m, 1) for m in mid]
    lo = [m - 2 * e for m, e in zip(means, se)]; hi = [m + 2 * e for m, e in zip(means, se)]
    ov = lambda i, j: not (hi[i] < lo[j] or hi[j] < lo[i])  # noqa: E731
    pairs_ = [(0, 1), (1, 2), (0, 2)]
    sep = [pr for pr in pairs_ if not ov(*pr)]
    ovl = [pr for pr in pairs_ if ov(*pr)]
    if not sep or not ovl:
        raise ValueError("need_both")
    tgt = rng.choice(["sep", "ovl"]); pr = rng.choice(sep if tgt == "sep" else ovl)
    a, b = pr
    rows = [[levels[i], f"{means[i]:.1f} ± {2 * se[i]:.2f}"] for i in range(3)]
    stim = tbl(f"Mean {meas} ({unit}) ± 2SE for three treatments, n = {n} for each treatment", ["Treatment", f"Mean ± 2SE ({unit})"], rows)
    stem = f"The table shows the mean {meas} with the range of ±2SE for three treatments. Which statement about the difference between the {levels[a]} treatment and the {levels[b]} treatment is best supported by the data?"
    key, ds = range_options(tgt == "sep", f"The ranges are {means[a] - 2 * se[a]:.2f} to {means[a] + 2 * se[a]:.2f} and {means[b] - 2 * se[b]:.2f} to {means[b] + 2 * se[b]:.2f}.")
    return mk("bi_error_bars_overlap", "3.2", "5.B", stem, key, ds, rng, concept="use ±2SE ranges to judge whether a difference is supported", stim=stim, path="interval overlap computed from the displayed mean and 2SE vs the generating means and standard errors", facts=[f"means={means}", f"se={se}", f"pair={pr}"], judgment="compare the ranges, not only the means", est=75)


@retry_sep
def bi_se_calc(rng):
    s = pick(rng, [2.0, 3.0, 4.0, 5.0, 6.0, 8.0]); n = pick(rng, [4, 9, 16, 25, 36, 49, 64])
    se = s / math.sqrt(n)
    # 독립 경로: 표본 분산 정의로부터 같은 s 를 갖는 자료를 만들어 SE 를 직접 계산
    vals = np.array([-s * math.sqrt((n - 1) / n) * 0 for _ in range(n)])
    se2 = float(sp.N(sp.Rational(str(s)) / sp.sqrt(n)))
    agree(se, se2, 1e-9, "se")
    pairs = [("Divides the standard deviation by n instead of the square root of n.", s / n), ("Multiplies the standard deviation by the square root of n.", s * math.sqrt(n)), ("Divides n by the standard deviation.", n / s), ("Uses the square of the standard deviation divided by the square root of n.", s * s / math.sqrt(n))]
    key, ds = val_opts(se, pairs, lambda v: f"{hu(v, 2)}", gap=0.03)
    stem = f"A student measures the height of {n} seedlings. The sample standard deviation is {s:g} cm. Using the equation on the formula sheet, what is the standard error of the mean?"
    return mk("bi_se_calc", "8.1", "5.A", stem, key, ds, rng, concept="standard error of the mean SE = s / sqrt(n)", path="s / sqrt(n) computed numerically vs exact symbolic evaluation", facts=[f"s={s}", f"n={n}", f"se={se:.4f}"], judgment="apply the standard error formula", kwhy=f"SE = s / √n = {s:g} / √{n} = {s:g} / {math.sqrt(n):g} = {se:.2f} cm.")


@retry_sep
def bi_mean_calc(rng):
    k = rng.randint(5, 7)
    vals = [round(rng.uniform(8, 20), 1) for _ in range(k)]
    m = sum(vals) / k
    agree(m, float(np.mean(vals)), 1e-9, "mean")
    med = float(np.median(vals)); rngv = max(vals) - min(vals)
    pairs = [("Reports the median instead of the mean.", med), ("Reports the range instead of the mean.", rngv), ("Divides the sum by one less than the number of values.", sum(vals) / (k - 1)), ("Reports the sum of the values.", sum(vals))]
    key, ds = val_opts(m, pairs, lambda v: f"{hu(v, 1)}", gap=0.2)
    stem = f"A student measured the length of {k} leaves, in centimeters: " + ", ".join(f"{v:g}" for v in vals) + ". What is the mean length of the leaves?"
    return mk("bi_mean_calc", "8.1", "5.A", stem, key, ds, rng, concept="mean of a small data set", path="sum divided by count vs numpy.mean", facts=[f"vals={vals}"], judgment="apply the definition of the mean", kwhy=f"The mean is the sum of the values divided by the number of values: {sum(vals):.1f} / {k} = {m:.1f} cm.")


@retry_sep
def bi_ci_interpretation(rng):
    n = pick(rng, [20, 30, 40]); m1 = pick(rng, [48, 52, 60]); d = pick(rng, [2, 3, 8, 10]); se1 = round(pick(rng, [0.6, 0.8, 1.0]), 1)
    m2 = m1 + d; se2 = round(pick(rng, [0.6, 0.8, 1.0]), 1)
    sep = (m2 - 2 * se2) > (m1 + 2 * se1)
    stim = tbl("Mean number of seeds produced per plant ± 2SE in two populations of the same species", ["Population", "Mean seeds per plant ± 2SE", "Plants measured"], [["Population 1 (shaded site)", f"{m1} ± {2 * se1:.1f}", n], ["Population 2 (sunny site)", f"{m2} ± {2 * se2:.1f}", n]])
    key, ds = range_options(sep, f"The ranges are {m1 - 2 * se1:.1f} to {m1 + 2 * se1:.1f} and {m2 - 2 * se2:.1f} to {m2 + 2 * se2:.1f}.")
    stem = "The table shows the mean number of seeds produced per plant in two populations of the same species, with the ±2SE range. Which statement is best supported by the data?"
    return mk("bi_ci_interpretation", "8.4", "5.B", stem, key, ds, rng, concept="interpret ±2SE ranges without over-claiming causation", stim=stim, path="range overlap computed from the table values vs the generating means and SE", facts=[f"m1={m1}", f"m2={m2}", f"se={se1},{se2}", f"sep={sep}"], judgment="decide from the ranges whether a difference is supported, and avoid causal claims from correlation", est=75)


# ============================ 4.B 자료 기술 / 2.A·2.B 시각 표현 ============================
@retry_sep
def bi_describe_trend_enzyme(rng):
    opt = pick(rng, [30, 37, 45])
    temps = [10, 20, 30, 40, 50, 60]
    rate = [round(100 * math.exp(-((t - opt) / 14.0) ** 2), 0) for t in temps]
    top = temps[int(np.argmax(rate))]
    agree(top, min(temps, key=lambda t: abs(t - opt)), 1e-9, "peak")
    stim = tbl("Relative rate of an enzyme-catalyzed reaction at different temperatures", ["Temperature (°C)", "Relative rate"], [[t, f"{r:g}"] for t, r in zip(temps, rate)])
    key, ds = sentence_options(f"The rate increases as temperature rises to {top} °C and then decreases at higher temperatures.", f"The values rise to a maximum of {max(rate):g} at {top} °C and then fall to {rate[-1]:g} at 60 °C.",
        [("The rate increases at every temperature as the temperature rises.", f"The rate falls at temperatures above {top} °C."),
         (f"The rate decreases as the temperature rises to {top} °C and then increases at higher temperatures.", "The pattern is the reverse of the data: the rate first increases."),
         ("The rate is the same at all of the temperatures tested.", "The rate changes strongly with temperature.")])
    stem = "The table shows the relative rate of an enzyme-catalyzed reaction at different temperatures. Which statement best describes the data?"
    return mk("bi_describe_trend_enzyme", "3.2", "4.B", stem, key, ds, rng, concept="describe a rise-then-fall pattern in a table", stim=stim, path="argmax of the table values vs the generating optimum", facts=[f"opt={opt}", f"rate={rate}"], judgment="describe the whole pattern, not a single pair of points", est=55)


@retry_sep
def bi_describe_growth_table(rng):
    K = pick(rng, [300, 500, 800]); r = pick(rng, [0.5, 0.6, 0.7]); N0 = pick(rng, [10, 20])
    yrs = [0, 2, 4, 6, 8, 10, 12]
    N = [round(K / (1 + (K - N0) / N0 * math.exp(-r * y))) for y in yrs]
    inc = [N[i + 1] - N[i] for i in range(len(N) - 1)]
    peak_i = int(np.argmax(inc))
    if peak_i in (0, len(inc) - 1) or inc[-1] > 0.25 * max(inc):
        raise ValueError("shape")
    stim = tbl("Population size of an introduced species over time", ["Year", "Number of individuals"], [[y, n] for y, n in zip(yrs, N)])
    key, ds = sentence_options("The population grows slowly at first, then rapidly, and then more slowly as it approaches a limit.", f"The yearly increases are small at first, largest between years {yrs[peak_i]} and {yrs[peak_i + 1]}, and small again near {N[-1]}.",
        [("The population grows at a constant rate throughout the study.", "The yearly increases are not constant; they speed up and then slow down."),
         ("The population grows slowly at first and then continues to grow faster and faster.", f"The increases become smaller near the end as the population levels off at about {N[-1]}."),
         ("The population decreases after the first year.", "The population increases in every interval in the table.")])
    stem = "The table shows the size of a population of an introduced species over time. Which statement best describes the pattern of growth?"
    return mk("bi_describe_growth_table", "8.4", "4.B", stem, key, ds, rng, concept="describe an S-shaped growth pattern from a table", stim=stim, path="interval increases computed from the table vs the generating logistic parameters", facts=[f"N={N}"], judgment="describe changes in the rate of growth across the table", est=60)


@retry_sep
def bi_bar_expression(rng):
    tissues = ["Liver", "Muscle", "Brain", "Kidney"]
    vals = rng.sample(range(3, 25), 4)
    if sorted(vals)[-1] - sorted(vals)[-2] < 3 or sorted(vals)[1] - sorted(vals)[0] < 2:
        raise ValueError("ties")
    hi = int(np.argmax(vals)); lo = int(np.argmin(vals))
    fold = max(vals) / min(vals)
    stim = bar_stim("Relative amount of mRNA for one gene in four tissues of an organism", "Relative mRNA levels in four tissues", tissues, [("Relative mRNA level", vals)], "Tissue", "Relative amount of mRNA (arbitrary units)")
    key, ds = sentence_options(f"The gene is expressed in all four tissues, and the level is highest in the {tissues[hi].lower()}.", f"The tallest bar is for the {tissues[hi].lower()} ({vals[hi]}), while the others are lower, and every tissue has mRNA for the gene.",
        [(f"The gene is expressed only in the {tissues[hi].lower()}, because it has the highest level.", "Every tissue has some mRNA for the gene."),
         (f"The gene is expressed at the highest level in the {tissues[lo].lower()}.", f"The {tissues[lo].lower()} has the lowest level."),
         ("The gene is lost from the DNA of all but one tissue.", "All of the somatic cells of an organism have the same genes.")])
    stem = "The bar graph shows the relative amount of mRNA transcribed from one gene in four tissues of the same organism. Which statement is best supported by the graph?"
    return mk("bi_bar_expression", "6.6", "2.A", stem, key, ds, rng, concept="describe a bar graph of tissue-specific gene expression", stim=stim, path="argmax and argmin of the plotted values vs the generating values", facts=[f"vals={vals}"], judgment="read relative bar heights and connect them to differential gene expression", est=60)


@retry_sep
def bi_bar_biomass(rng):
    E0 = pick(rng, [10000, 20000, 50000]); pct = pick(rng, [5, 10, 15, 20])
    lev = [E0, E0 * pct / 100, E0 * (pct / 100) ** 2]
    # 독립 경로: 두 번째 단계 대 첫 단계의 비를 표에서 읽는다
    ratio = lev[1] / lev[0] * 100
    agree(ratio, pct, 1e-9, "pct")
    names = ["Producers", "Primary", "Secondary"]
    stim = bar_stim("Energy available at each trophic level of an ecosystem (primary and secondary refer to primary and secondary consumers)", "Energy available at three trophic levels", names, [("Energy (kcal)", [round(v, 1) for v in lev])], "Trophic level", "Energy available (kcal per year)")
    pairs = [("Divides the larger value by the smaller value instead of the smaller by the larger.", 100 * lev[0] / lev[1]), ("Reports the energy lost between levels as a percent of the producers.", 100 - pct), ("Reports the energy of the primary consumers in kcal rather than as a percent.", lev[1]), ("Compares the secondary consumers with the producers.", lev[2] / lev[0] * 100)]
    key, ds = val_opts(ratio, pairs, lambda v: f"{v:g}%" if v < 1000 else f"{v:,.0f}", gap=0.5, rel=0.1)
    stem = "The bar graph shows the energy available at three trophic levels of an ecosystem. About what percent of the energy at the producer level is transferred to the primary consumers?"
    return mk("bi_bar_biomass", "8.2", "2.B", stem, key, ds, rng, concept="percent energy transfer between trophic levels read from a bar graph", stim=stim, path="ratio of the first two bars vs the generating transfer efficiency", facts=[f"lev={lev}", f"pct={pct}"], judgment="read two bars and compute a percent transfer", est=70, kwhy=f"The primary consumers have {lev[1]:g} kcal and the producers have {lev[0]:g} kcal, so the transfer is {lev[1]:g} / {lev[0]:g} x 100 = {pct}%.")


@retry_sep
def bi_graph_membrane_temp(rng):
    T = [0, 10, 20, 30, 40, 50, 60, 70]
    onset = pick(rng, [40, 50])
    leak = [round(2 + (0 if t < onset else (t - onset) ** 1.6 * 0.9), 1) for t in T]
    if leak[-1] < 25:
        raise ValueError("low")
    stim = graph_stim("Leakage of pigment from beet root tissue at different temperatures", [("Pigment leakage", [[t, v] for t, v in zip(T, leak)])], gaxis("Temperature (°C)", 0, 70, 10), gaxis("Relative pigment leakage (arbitrary units)", 0, math.ceil(max(leak) / 10) * 10, 10))
    key, ds = sentence_options("High temperatures damage the membranes, so the pigment inside the cells leaks out.", f"Leakage stays low up to about {onset - 10} °C and then rises steeply, as expected when heat disrupts membrane structure.",
        [("High temperatures make the membranes more selective, so more pigment is released.", "More selective membranes would hold the pigment inside, not release it."),
         ("Leakage increases at all temperatures at the same rate, because membranes do not change with heat.", "The graph shows a low rate at low temperatures and a steep rise at high temperatures."),
         ("High temperatures increase the amount of pigment made, which makes the leakage higher.", "The graph shows the leakage of pigment and does not measure how much pigment is made.")])
    stem = "Pieces of beet root tissue, whose cells contain a red pigment inside vacuoles, were heated for 10 minutes at different temperatures. The graph shows the amount of pigment that leaked into the water. Which explanation is best supported by the graph and by the structure of membranes?"
    return mk("bi_graph_membrane_temp", "2.3", "2.B", stem, key, ds, rng, concept="relate membrane integrity to temperature using a leakage curve", stim=stim, path="slope change in the plotted series vs the generating onset temperature", facts=[f"onset={onset}"], judgment="connect the shape of the curve to heat damage of membranes", est=70)


# ============================ 6.B–6.D 논증 ============================
@retry_sep
def bi_reasoning_dna_replication(rng):
    stim = tbl("Density of the DNA of bacteria grown first in a heavy-nitrogen medium and then transferred to a light-nitrogen medium", ["Generation after transfer", "Band positions in the density gradient"], [["0", "One band at the heavy position"], ["1", "One band at the intermediate position"], ["2", "One band at the intermediate position and one band at the light position, in equal amounts"]])
    key, ds = sentence_options("Replication is semiconservative, because each new molecule contains one old strand and one new strand.", "All generation 1 molecules are intermediate, which means each has one heavy and one light strand, and generation 2 gives half intermediate and half light molecules.",
        [("Replication is conservative, because the old molecule stays intact and makes an entirely new copy.", "Conservative replication would give heavy and light bands in generation 1, not one intermediate band."),
         ("Replication is dispersive, because every molecule is a mixture of old and new pieces in each generation.", "Dispersive replication would not give a separate light band in generation 2."),
         ("Replication does not use the original strands, because the heavy band disappears after generation 0.", "The intermediate band shows that the original heavy strands were used as templates.")])
    stem = "In an experiment, bacteria were grown for many generations in a medium containing heavy nitrogen and then transferred to a medium containing light nitrogen. DNA was extracted in each generation and separated by density. The table shows the results. Which conclusion is best supported by the data?"
    return mk("bi_reasoning_dna_replication", "6.2", "6.C", stem, key, ds, rng, concept="reason from density-band data to a model of DNA replication", stim=stim, path="predicted bands for the three models for generations 1 and 2 compared with the table", facts=["semiconservative"], judgment="match the observed bands to the predictions of the three models", est=80)


bi_reasoning_griffith = make_bank_archetype("bi_reasoning_griffith", "6.1", "6.C", [
    B("In an experiment, mice were injected with live harmless bacteria mixed with heat-killed disease-causing bacteria, and the mice developed the disease. Live disease-causing bacteria were then recovered from the mice. Which conclusion is best supported?",
      ("A substance from the heat-killed bacteria changed the harmless bacteria into disease-causing bacteria.", "A heritable substance transferred from the dead cells to the live cells and changed their properties."),
      [("The heat-killed bacteria came back to life in the mice.", "Dead cells were killed by heat and do not come back to life; a substance was transferred."),
       ("The harmless bacteria mutated because they were injected.", "The change occurred only in the presence of the heat-killed disease-causing bacteria."),
       ("The mice produced the disease-causing bacteria on their own.", "The mice that received only the harmless bacteria did not develop the disease.")]),
    B("In a later experiment, scientists treated an extract from heat-killed disease-causing bacteria with enzymes that destroy protein, RNA, or DNA. Only the treatment that destroyed DNA prevented the transformation of harmless bacteria. What can be concluded?",
      ("DNA is the substance that carries genetic information in the bacteria.", "Destroying DNA stopped the transfer of the trait, which shows that DNA is the transforming substance."),
      [("Protein is the genetic material, because proteins are needed for cell function.", "Destroying protein did not prevent transformation."),
       ("RNA is the genetic material, because RNA is more abundant than DNA.", "Destroying RNA did not prevent transformation."),
       ("None of the molecules is the genetic material, because the cells were already dead.", "The results identify DNA as the material that carried the trait.")]),
], "reason from transformation experiments to the role of DNA", "fixed fact bank checked against CED 6.1", est=75)

bi_reasoning_pea_ratio = make_bank_archetype("bi_reasoning_pea_ratio", "5.3", "6.C", [
    B("Mendel crossed true-breeding purple-flowered and white-flowered pea plants. All of the F1 plants had purple flowers. When the F1 plants were self-pollinated, about three-fourths of the F2 plants had purple flowers and one-fourth had white flowers. Which conclusion is best supported?",
      ("The trait for white flowers was masked in the F1 plants but was still present and was inherited separately.", "The reappearance of white flowers in the F2 plants shows that the factor for white was not lost or blended."),
      [("The traits of the parents blended in the F1 plants, and white was lost.", "A blend would not allow the white trait to reappear unchanged in the F2 plants."),
       ("The white trait was created by mutation in the F1 plants.", "White flowers appeared in a consistent proportion that is explained by inheritance, not by new mutations."),
       ("All F1 plants carried two copies of the purple factor.", "F1 plants of the cross must carry one purple and one white factor to produce white offspring.")]),
    B("In a cross of purple-flowered F1 plants, the F2 generation has 705 purple and 224 white plants. Which hypothesis best explains the ratio?",
      ("The F1 plants were heterozygous, and each parent passed one allele to each offspring at random.", "A 3:1 ratio is expected when two heterozygous parents pass their alleles randomly."),
      [("The F1 plants were homozygous dominant, and each offspring received both alleles from one parent.", "Homozygous dominant plants would produce only purple offspring."),
       ("The F1 plants were homozygous recessive, and white flowers are dominant.", "Homozygous recessive plants would not be purple."),
       ("The F1 plants each produced only one kind of gamete.", "Heterozygous plants produce two kinds of gametes in equal numbers.")]),
], "reason from monohybrid cross data to the particulate nature of inheritance", "fixed fact bank checked against CED 5.3", est=75)

bi_reasoning_osmosis_data = make_bank_archetype("bi_reasoning_osmosis_data", "2.7", "6.C", [
    B("A student places a red onion cell in a strong salt solution and observes under a microscope that the cell membrane pulls away from the cell wall. Which explanation best connects this observation to water potential?",
      ("The solution has a lower water potential than the cell, so water moves out of the cell by osmosis.", "Water moves from higher to lower water potential, so the cell loses water and shrinks away from the wall."),
      [("The solution has a higher water potential than the cell, so water moves out of the cell.", "Water would move into the cell if the solution had a higher water potential."),
       ("The salt ions enter the cell and pull the membrane away from the wall.", "The change is caused by the loss of water and not by the entry of ions."),
       ("The cell wall pushes the membrane inward because of the pressure potential in the solution.", "The shrinkage is caused by water loss, not by the pressure of the solution.")]),
    B("A student places two identical pieces of celery in two beakers. The piece in distilled water becomes firm, and the piece in concentrated salt water becomes limp. Which explanation best connects these observations to water movement?",
      ("Water enters the celery cells in distilled water and leaves them in salt water, because of the differences in water potential.", "Water moves toward lower water potential, which is inside the cells in distilled water and in the solution in salt water."),
      [("Water leaves the celery cells in distilled water and enters them in salt water.", "The directions are reversed."),
       ("Salt moves out of the celery cells and into the distilled water, which makes the celery firm.", "The change in firmness is caused by water movement, not by salt movement."),
       ("The celery in distilled water produces more cell wall, which makes it firm.", "The change occurs too quickly to be caused by making new wall material.")]),
], "reason from osmosis observations to water potential", "fixed fact bank checked against CED 2.7", est=70)

bi_justify_hypothesis_signal = make_bank_archetype("bi_justify_hypothesis_signal", "4.3", "6.D", [
    B("Researchers find that cancer cells in a culture divide even when no growth factor is added to the medium. Further analysis shows that a protein in the signaling pathway is always active. Which statement best explains how this result relates to the regulation of cell division?",
      ("A protein that is always active can send a division signal without the growth factor, so division is not controlled.", "Constant activation of a pathway component bypasses the need for the signal."),
      [("The protein prevents the cell from receiving any signals, so division is blocked.", "Constant activity would not block signaling; it would increase it."),
       ("The cells divide only when the protein is destroyed.", "The protein is active and the cells divide."),
       ("Growth factors have no role in the regulation of normal cell division.", "In normal cells growth factors regulate division.")]),
    B("In a normal cell, the binding of a signal molecule to its receptor activates a series of proteins that end in a response. A drug blocks the receptor binding site. How does this result relate to the pathway?",
      ("The first step of the pathway is blocked, so the downstream steps are not activated.", "Without ligand binding, the receptor does not trigger the transduction pathway."),
      [("The downstream steps are activated more strongly because the receptor is free.", "A blocked receptor would not activate the pathway."),
       ("Only the last step of the pathway is blocked.", "The block is at the first step."),
       ("The signal molecule changes into a different molecule that activates the pathway.", "The signal molecule does not change into a different activator by being blocked.")]),
], "relate the behavior of a signaling pathway to regulation of cell division", "fixed fact bank checked against CED 4.3 and 4.6", est=70)

STAGE_E = ["bi_design_variable_osmosis", "bi_design_variable_enzyme", "bi_design_control_photosynthesis", "bi_question_testable_cellcycle", "bi_hypothesis_signal", "bi_null_hypothesis_ecology", "bi_prediction_gene", "bi_new_investigation_selection", "bi_new_investigation_enzyme", "bi_procedure_choice_dna", "bi_question_testable_ecology", "bi_control_choice_membrane", "bi_hypothesis_heredity", "bi_new_investigation_cellsize",
           "bi_error_bars_overlap", "bi_se_calc", "bi_mean_calc", "bi_ci_interpretation", "bi_describe_trend_enzyme", "bi_describe_growth_table", "bi_bar_expression", "bi_bar_biomass", "bi_graph_membrane_temp", "bi_reasoning_dna_replication", "bi_reasoning_griffith", "bi_reasoning_pea_ratio", "bi_reasoning_osmosis_data", "bi_justify_hypothesis_signal"]
