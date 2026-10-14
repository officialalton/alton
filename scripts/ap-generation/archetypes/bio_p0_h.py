"""AP Biology P0 원형 H — 정확 배정(두 회 구조 겹침 0)에서 가상 칸으로 남은 (단원 x 스킬) 칸을 채우는 시나리오형 고정 문장 원형.
검토기가 반복해서 떨어뜨린 지적(상황 없는 어휘 문제, 정답이 가장 긴 선택지, 비현실적 오답)을 피한다: 모든 문항은 구체적 상황이나 표를 쓰고, 오답은 이름 붙은 오개념이며 길이가 비슷하다."""
from bio_common import *  # noqa: F401,F403

bi_selection_claim_data = make_bank_archetype("bi_selection_claim_data", "7.2", "6.B", [
    B("A biologist measured the mean beak depth of ground finches on an island before and after a drought, and compared it with the mean seed hardness available. The table shows the data. Which claim is best supported by the data?",
      ("Birds with deeper beaks were more likely to survive the drought, because harder seeds remained.", "The mean beak depth increased as the seeds became harder, which supports survival of deeper beaks."),
      [("Individual birds grew deeper beaks during the drought, because they needed to crack harder seeds.", "The data describe the population mean and do not show that individual birds changed their beaks."),
       ("The drought caused the beak depth gene to mutate, because the population changed in one season.", "The data do not show a mutation; they show a change in which existing variants survived."),
       ("The finches with shallower beaks tried harder to crack seeds, so they were selected against.", "Selection acts on traits, not on effort, and the data do not measure effort.")],
      stim=tbl("Mean beak depth and mean seed hardness on an island before and after a drought", ["Year", "Mean beak depth (mm)", "Mean seed hardness (relative units)"], [["Before the drought", "9.2", "1.0"], ["After the drought", "10.1", "2.6"]]), est=70),
    B("A researcher counted the beetles of two color forms on a dark lava field in two years. The table shows the data. Which claim is best supported by the data?",
      ("Dark beetles had a higher survival rate than light beetles, so the dark form is favored on this lava field.", "The dark form rose from 40 percent to 70 percent of the population, which supports differential survival."),
      [("Each light beetle changed to a dark beetle after it landed on the lava, so the dark form increased.", "The data count whole populations and do not show any individual changing color."),
       ("Dark beetles are always better adapted, so the dark form will also increase in every other habitat.", "Which form is favored depends on the environment, and the data come from one habitat."),
       ("The dark color appeared because the beetles needed to hide from predators on the lava field.", "Variation arises by mutation and does not appear because of a need.")],
      stim=tbl("Percent of beetles of each color form on a dark lava field in two years", ["Year", "Dark form (%)", "Light form (%)"], [["Year 1", "40", "60"], ["Year 5", "70", "30"]]), est=70),
], "support a claim about natural selection with population data", "fixed fact bank checked against CED 7.2")

bi_antibiotic_survival_claim = make_bank_archetype("bi_antibiotic_survival_claim", "7.8", "6.B", [
    B("A student exposed bacterial cultures to an antibiotic for three successive rounds and, after each round, grew the survivors on fresh plates. The table shows the percent of cells that survived the antibiotic after each round. Which claim is best supported by the data?",
      ("The proportion of resistant cells increased, because resistant cells survived and passed resistance to their offspring.", "The survival percent rose after every round, which shows that resistant cells made up more of each new culture."),
      [("The bacteria became resistant on purpose, because the antibiotic told them to change.", "Resistance does not arise in response to exposure; it comes from existing variation."),
       ("Each surviving cell became more resistant during every round, so every cell adapted equally.", "The data are population percents and do not show that individual cells changed."),
       ("The antibiotic caused new resistance mutations at a higher rate in every round.", "The data show survival and do not show a change in the mutation rate.")],
      stim=tbl("Percent of bacterial cells surviving an antibiotic in three successive rounds", ["Round", "Survivors (%)"], [["1", "2"], ["2", "14"], ["3", "61"]]), est=70),
], "support a claim about the evolution of resistance with data", "fixed fact bank checked against CED 7.8")

bi_expression_tissue_table = make_bank_archetype("bi_expression_tissue_table", "6.6", "2.A", [
    B("A researcher measured the relative amount of mRNA from a gene in liver cells and muscle cells, with and without a hormone. The table shows the data. Which statement best describes a pattern in the table?",
      ("The hormone increased the amount of mRNA in the liver cells but not in the muscle cells.", "The liver value rose from 10 to 60, while the muscle value stayed near 5."),
      [("The hormone increased the amount of mRNA in both cell types by the same amount.", "The liver value rose by 50, while the muscle value did not change."),
       ("The hormone decreased the amount of mRNA in the liver cells but not in the muscle cells.", "The liver value rose with the hormone, so this reverses the direction of the change."),
       ("The liver cells and muscle cells contain different genes, so only the liver cells transcribe it.", "All cells of one organism have the same genes, and the muscle cells also made some mRNA.")],
      stim=tbl("Relative amount of mRNA from one gene in two cell types with and without a hormone", ["Cell type", "Without hormone", "With hormone"], [["Liver cells", "10", "60"], ["Muscle cells", "5", "5"]]), est=60),
], "describe a pattern in gene expression data", "fixed fact bank checked against CED 6.6")

bi_checkpoint_mutation_claim = make_bank_archetype("bi_checkpoint_mutation_claim", "4.6", "6.D", [
    B("A researcher compared cultured cells that have a normal copy of a gene for a checkpoint protein with cells in which the gene is mutated. The table shows the percent of cells with damaged DNA that divided. Which claim is best supported by the data?",
      ("The mutation allows cells with damaged DNA to divide, which could increase the chance of uncontrolled growth.", "Damaged cells divided far more often when the checkpoint gene was mutated, so the checkpoint no longer stopped them."),
      [("The mutation makes the cells repair damaged DNA faster, so fewer cells need the checkpoint.", "More damaged cells divided, which shows that fewer cells were stopped, not that repair was faster."),
       ("The normal gene causes cells to divide faster, so the mutated cells are slower to divide.", "The normal cells divided less often when their DNA was damaged, so the gene slows division."),
       ("The checkpoint protein is needed to copy DNA, so cells without it cannot replicate their DNA.", "The mutated cells still divided, so they did replicate their DNA.")],
      stim=tbl("Percent of cells with damaged DNA that divided", ["Cell type", "Cells with damaged DNA that divided (%)"], [["Normal checkpoint gene", "4"], ["Mutated checkpoint gene", "46"]]), est=70),
], "support a claim about checkpoint failure and cancer with data", "fixed fact bank checked against CED 4.6")

bi_hw_migration_scenario = make_bank_archetype("bi_hw_migration_scenario", "7.5", "1.B", [
    B("A large population of wildflowers has been in Hardy-Weinberg equilibrium for a gene with two alleles. A storm brings many seeds from a distant population with a very different allele frequency. Which statement best explains why the population is no longer expected to be in equilibrium?",
      ("Gene flow from the new seeds changes the allele frequencies, which violates the condition of no migration.", "Hardy-Weinberg equilibrium requires no movement of alleles into or out of the population."),
      [("The new seeds are a type of mutation, which violates the condition of no new alleles.", "Seeds that arrive from another population are gene flow, not a mutation."),
       ("The population is large, so a large population always violates the equilibrium conditions.", "A large population is one of the conditions for equilibrium."),
       ("The storm caused random mating, which violates the condition of non-random mating.", "Random mating is one of the conditions for equilibrium, so it would not violate it.")], est=65),
    B("In a population of snails in Hardy-Weinberg equilibrium, a new predator begins to eat only the snails with banded shells. Which statement best explains why the population is no longer expected to be in equilibrium?",
      ("The predator causes natural selection against the banded allele, which violates the condition of no selection.", "Hardy-Weinberg equilibrium requires that all genotypes survive and reproduce equally well."),
      [("The predator causes the snails to mutate, which violates the condition of no mutation.", "Predation does not cause mutations; it changes which snails survive."),
       ("The predator reduces the population size to zero, which violates the condition of a large population.", "The population still exists, and the change comes from unequal survival, not from size alone."),
       ("The banded shells are dominant, which violates the condition of random mating.", "Dominance of an allele does not change the equilibrium conditions.")], est=65),
], "identify which Hardy-Weinberg condition is violated in a scenario", "fixed fact bank checked against CED 7.5")

bi_signal_receptor_prediction = make_bank_archetype("bi_signal_receptor_prediction", "4.2", "3.B", [
    B("A hormone binds to a receptor on the surface of liver cells and causes the cells to release glucose. A researcher adds a drug that blocks the receptor, and then adds the hormone. Which result is best predicted for the treated cells?",
      ("The cells release less glucose than cells that receive the hormone alone, because the hormone cannot bind to its receptor.", "A blocked receptor cannot bind the hormone, so the response to the hormone is reduced."),
      [("The cells release more glucose than cells that receive the hormone alone, because the drug acts as a second hormone.", "A drug that blocks the receptor does not activate it, so the response is not increased."),
       ("The cells release the same amount of glucose, because the hormone can enter the cell and bypass the receptor.", "A hormone that works through a surface receptor cannot cross the membrane to bypass it."),
       ("The cells release glucose without the hormone, because the blocked receptor stays active.", "A blocked receptor cannot trigger the pathway, so glucose release is not triggered.")], est=65),
], "predict the outcome of blocking a receptor in a signal transduction pathway", "fixed fact bank checked against CED 4.2")

bi_meiosis_crossing_scenario = make_bank_archetype("bi_meiosis_crossing_scenario", "5.2", "1.B", [
    B("Two sibling gametes from the same parent cell carry the same two genes on one chromosome, but the combination of alleles is different in each gamete. Which process during meiosis best explains this difference?",
      ("Crossing over in prophase I exchanged segments between homologous chromosomes, which formed new allele combinations.", "Crossing over swaps segments between homologs, so the gametes carry different combinations on the same chromosome."),
      [("DNA replication in interphase changed the alleles on each chromatid, which formed new allele combinations.", "Replication copies the alleles and does not exchange them between chromosomes."),
       ("Cytokinesis in telophase II divided the alleles unevenly, which formed new allele combinations.", "Cytokinesis divides the cytoplasm and does not change the allele combinations."),
       ("Mitosis in the gamete cells shuffled the alleles on each chromosome, which formed new allele combinations.", "Gametes are made by meiosis, and mitosis does not shuffle alleles.")], est=65),
    B("A pea plant is heterozygous for two genes that are on different chromosomes. Its gametes carry all four combinations of the alleles in about equal numbers. Which process during meiosis best explains this result?",
      ("Independent assortment of homologous chromosomes in metaphase I, because each pair lines up independently of the other.", "Each homologous pair lines up independently, so all four combinations of alleles occur in the gametes."),
      [("Crossing over in prophase II, because the sister chromatids exchange segments between genes.", "Crossing over occurs between homologous chromosomes in prophase I, not in prophase II."),
       ("Fertilization of the gametes, because the egg and sperm combine at random.", "The combinations are present in the gametes before fertilization takes place."),
       ("DNA replication in interphase, because each gene is copied once for each allele.", "Replication makes copies of the same alleles and does not mix combinations.")], est=65),
], "explain how meiosis produces genetic variation in gametes", "fixed fact bank checked against CED 5.2")

bi_selection_followup_design = make_bank_archetype("bi_selection_followup_design", "7.2", "3.D", [
    B("Researchers found that the mean beak depth of a finch population increased after a drought that left mostly hard seeds. They hypothesize that this change was caused by natural selection. Which additional investigation would best test this hypothesis?",
      ("Compare the beak depth of parents with the beak depth of their offspring, to determine whether the trait is heritable.", "Selection can change a population only if the trait is passed from parents to offspring."),
      [("Measure the beak depth of the same birds again after the drought, to determine whether the birds have grown.", "The same birds measured twice would test growth in individuals and not inheritance."),
       ("Count the number of birds on the island each year, to determine whether the population is larger.", "A count of birds does not test whether the beak depth is inherited."),
       ("Measure the hardness of the seeds in a different island, to determine whether seeds vary.", "Seed hardness on another island does not test the trait in this population.")], est=70),
], "choose an investigation that tests a natural selection hypothesis", "fixed fact bank checked against CED 7.2")

bi_yeast_respiration_scenario = make_bank_archetype("bi_yeast_respiration_scenario", "3.5", "1.B", [
    B("Yeast cells are placed in a sealed flask with glucose and no oxygen. After several hours, the flask contains ethanol and carbon dioxide, and the cells have made a small amount of ATP. Which process best explains these observations?",
      ("Fermentation, which regenerates NAD+ so that glycolysis can continue to make a small amount of ATP.", "Without oxygen, glycolysis continues only if fermentation regenerates NAD+, and the cells make ethanol and carbon dioxide."),
      [("Aerobic respiration, which uses oxygen in the electron transport chain to make a large amount of ATP.", "The flask has no oxygen, so the electron transport chain cannot run."),
       ("Photosynthesis, which uses light energy to make glucose and release carbon dioxide.", "Yeast cells do not photosynthesize, and the flask contains no light-driven reactions."),
       ("The Calvin cycle, which fixes carbon dioxide into glucose and releases ethanol.", "The Calvin cycle occurs in photosynthetic cells and fixes carbon dioxide; it does not make ethanol.")], est=65),
], "explain ATP production and products of fermentation in a scenario", "fixed fact bank checked against CED 3.5")

bi_cell_cycle_question = make_bank_archetype("bi_cell_cycle_question", "4.6", "3.A", [
    B("A researcher notices that cells from a tumor divide much more often than normal cells from the same tissue. Which question about cell cycle regulation can be investigated experimentally?",
      ("Do the tumor cells have a lower amount of an active checkpoint protein than the normal cells?", "The amount of a checkpoint protein can be measured in both cell types and compared."),
      [("Is it ethical to treat the tumor cells with a drug that stops their division?", "Whether a treatment is ethical is a matter of values, so no experiment can answer it."),
       ("Which stage of the cell cycle is the most important stage for the tissue?", "Importance is a judgment, and the question gives no measurable variable to test."),
       ("Would the tumor cells be better off if they divided less often than the normal cells?", "Better off is not a measurable quantity, so the question cannot be tested.")], est=60),
], "identify a testable question about cell cycle regulation", "fixed fact bank checked against CED 4.6")

bi_transcription_concept = make_bank_archetype("bi_transcription_concept", "6.3", "1.A", [
    B("A researcher isolates a gene from a eukaryotic cell and finds that the mature mRNA from the gene is shorter than the gene itself. Which process best explains why the mature mRNA is shorter?",
      ("Introns were removed from the primary transcript, and the remaining exons were joined together.", "RNA processing removes noncoding introns and joins the exons before the mRNA leaves the nucleus."),
      [("Exons were removed from the primary transcript, and the remaining introns were joined together.", "Exons code for the protein and stay in the mature mRNA, so this reverses the roles."),
       ("Ribosomes cut the mRNA into shorter pieces while it was translated in the cytoplasm.", "Translation reads the mRNA and does not shorten it, and splicing occurs earlier in the nucleus."),
       ("RNA polymerase copied only part of each gene because it cannot copy a complete sequence.", "RNA polymerase copies the whole gene, and the shortening happens after transcription.")], est=65),
    B("In a eukaryotic cell, a newly made primary transcript receives a 5' cap and a poly-A tail before it is used for translation. Which statement best describes the function of these modifications?",
      ("They protect the mRNA from degradation and help it to be exported and translated.", "The cap and tail stabilize the mRNA and help ribosomes recognize it after it leaves the nucleus."),
      [("They add amino acids to the mRNA so that the protein can begin to fold.", "Amino acids are added during translation by ribosomes, not by modifying the mRNA."),
       ("They remove the introns so that only the coding sequence remains in the mRNA.", "Introns are removed by splicing, which is a different modification."),
       ("They copy the DNA template so that more mRNA can be made from the gene.", "Copying a template is transcription, which is not the function of the cap and tail.")], est=65),
], "explain eukaryotic RNA processing", "fixed fact bank checked against CED 6.3")

bi_replication_enzyme_scenario = make_bank_archetype("bi_replication_enzyme_scenario", "6.2", "1.A", [
    B("A researcher adds a drug that blocks DNA ligase to dividing cells. Which result is most likely during DNA replication in the treated cells?",
      ("Gaps remain between the Okazaki fragments on the lagging strand, because the fragments are not joined together.", "DNA ligase joins the Okazaki fragments, so blocking it leaves nicks in the lagging strand."),
      [("The two parental strands cannot separate, because DNA ligase unwinds the double helix.", "Helicase unwinds the double helix, and DNA ligase joins fragments."),
       ("New nucleotides cannot be added to the leading strand, because DNA ligase adds the nucleotides.", "DNA polymerase adds nucleotides, and the leading strand is made without fragments."),
       ("RNA primers are not made, because DNA ligase builds the primers on each strand.", "Primase builds the RNA primers, and DNA ligase does not make them.")], est=65),
], "relate replication enzymes to their functions in a scenario", "fixed fact bank checked against CED 6.2")

STAGE_H = ["bi_selection_claim_data", "bi_antibiotic_survival_claim", "bi_expression_tissue_table", "bi_checkpoint_mutation_claim", "bi_hw_migration_scenario", "bi_signal_receptor_prediction", "bi_meiosis_crossing_scenario", "bi_selection_followup_design", "bi_yeast_respiration_scenario", "bi_cell_cycle_question", "bi_transcription_concept", "bi_replication_enzyme_scenario"]
