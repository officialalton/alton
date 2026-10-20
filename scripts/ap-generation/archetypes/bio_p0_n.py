"""AP Biology 원형 N — BI4 새 풀이 틀(2026-10-19, 브랜치 ap-bi-ph-ch): 공개 세트(BI1·BI2)와 BI3 이 쓰지 않은 라이브러리 원형이 Practice 1·2·6 칸에서 모자라
(BI3+BI4 엄격 배정: P1 -5, P2 -6, P6 -2) 새로 쓰는 16개 원형이다.
- P1·P6: 고정 문장 은행(시나리오 3개, 정답 1 + 이름 붙은 오개념 3). 은행 항목은 CED 학습 목표에 맞춘 사실이다.
- P2: 표 자료는 코드가 시드마다 만들고, 정답은 정의가 다른 두 경로(보간 vs 최소제곱, 합 검사 vs 열거 등)로 독립 계산해 불일치 시 건너뛴다.
필요한 모든 값은 학생 화면의 본문 또는 표에 있다(해설에만 있는 값 없음)."""
from fractions import Fraction as Fr  # noqa: F811
from bio_common import *  # noqa: F401,F403
from bio_p0_i import _retry, _steps, _num


# ============================ Practice 1 (개념 설명) — 고정 문장 은행 ============================
bi_n_transport_classify = make_bank_archetype("bi_n_transport_classify", "2.8", "1.B", [
    B("Potassium ions are more concentrated inside a nerve cell than outside it. When channel proteins in the plasma membrane open, potassium ions move out of the cell through the channels until the concentrations on the two sides of the membrane are nearly equal. Which of the following best describes the movement of the ions?",
      ("Facilitated diffusion, because the ions move down their gradient through channels without using ATP", "The ions move from high to low concentration through a protein channel, and no cellular energy is needed."),
      [("Active transport, because the ions cross the membrane through a membrane protein", "Both facilitated diffusion and active transport use membrane proteins; only active transport uses energy to move a substance against its gradient."),
       ("Simple diffusion, because the ions pass directly through the phospholipid bilayer", "Charged ions cannot cross the hydrophobic core of the bilayer directly and need a channel or carrier."),
       ("Osmosis, because the ions move across a selectively permeable membrane", "Osmosis is the movement of water, not the movement of ions.")]),
    B("The concentration of calcium ions is much higher in the fluid outside a muscle cell than inside the cell. A membrane protein uses energy from ATP to move calcium ions from the inside of the cell to the outside. Which of the following best describes this movement of the ions?",
      ("Active transport, because the ions move against their concentration gradient using energy from ATP", "A substance that moves from low to high concentration must be driven by an input of energy."),
      [("Facilitated diffusion, because a protein helps the ions cross the membrane", "Facilitated diffusion moves a substance down its gradient and does not use ATP."),
       ("Simple diffusion, because the ions are small enough to pass through the membrane", "Ions are charged and cannot cross the phospholipid bilayer by simple diffusion."),
       ("Osmosis, because the movement changes the concentration of a solute on both sides", "Osmosis is the diffusion of water and not the transport of ions.")]),
    B("The concentration of oxygen is higher in the air of the alveoli of the lungs than in the blood of the nearby capillaries. Oxygen molecules, which are small and nonpolar, move from the alveoli into the blood. Which of the following best describes the movement of the oxygen?",
      ("Simple diffusion, because oxygen moves down its gradient directly across the phospholipid bilayer", "Small nonpolar molecules cross the lipid bilayer directly from high to low concentration."),
      [("Facilitated diffusion, because movement down a gradient always requires a channel protein", "Small nonpolar molecules such as oxygen can cross the bilayer without a protein."),
       ("Active transport, because oxygen moves into the blood, where it is needed by the cells", "Oxygen moves down its gradient, so no energy is used; the need for oxygen does not determine the mechanism."),
       ("Osmosis, because the oxygen moves across a selectively permeable membrane", "Osmosis is the movement of water and not of gases.")]),
], "classify the movement of a substance across a membrane as simple diffusion, facilitated diffusion or active transport", "fixed fact bank checked against CED 2.8", est=60)

bi_n_trophic_energy = make_bank_archetype("bi_n_trophic_energy", "8.2", "1.B", [
    B("The producers in a grassland store 10,000 kJ of energy per square meter per year in their biomass. The herbivores that eat the producers store much less energy in their own biomass. Which of the following best explains this difference?",
      ("Much of the energy that the herbivores take in is used by cellular respiration and released as heat, so only a small fraction is stored in new biomass.", "Energy is lost as heat at each transfer, so each trophic level stores a small fraction of the energy of the level below."),
      [("Energy is destroyed when it is passed from one trophic level to the next.", "Energy is transformed and not destroyed; much of it leaves the food chain as heat."),
       ("Most of the energy in the producers is returned to the soil as nutrients that the herbivores cannot use.", "Nutrients are matter, and energy does not cycle back to the soil in this way."),
       ("Herbivores store less energy because they obtain their energy from sunlight and not from the producers.", "Herbivores are heterotrophs that obtain energy from the producers they eat, not from sunlight.")]),
    B("A food chain in a lake rarely has more than four or five trophic levels. Which of the following is the best explanation?",
      ("Only a small fraction of the energy at each level reaches the next level, so too little remains at the top to support a population.", "Because most energy is lost as heat at each transfer, the energy that reaches a high trophic level is very small."),
      [("The organisms at the top of a food chain are too large to find enough prey in the lake to feed on.", "Body size does not explain the limit; the limit is set by the energy that reaches the level."),
       ("Matter is used up at each level of the food chain, so the nutrients run out before the top level.", "Matter is recycled by decomposers, and the limit on the number of levels is the loss of energy."),
       ("Energy flows from the higher trophic levels back down to the producers, where it is used up.", "Energy flows in one direction through an ecosystem and does not return to the producers.")]),
    B("The same area of farmland can be used to grow corn for people to eat directly or to grow corn to feed cattle that people eat. Which of the following predictions is best supported by the flow of energy through trophic levels?",
      ("The area can support more people on a diet of corn than on a diet of beef, because fewer trophic levels means less energy is lost as heat before it reaches the people.", "Each added trophic level loses most of the energy as heat, so a shorter food chain supports more consumers."),
      [("The area can support more people on a diet of beef than on a diet of corn, because beef has more energy in each gram than corn does.", "Energy per gram does not matter; the energy lost at the extra trophic level reduces the total that reaches people."),
       ("The area can support the same number of people on either diet, because energy is conserved when it is transferred.", "Energy is conserved, but much of it becomes heat that people cannot use as food energy."),
       ("The area can support more people on a diet of beef, because cattle store the energy of the corn without any loss.", "Cattle use most of the energy of the corn for their own metabolism, so only a small fraction is stored as beef.")]),
], "explain the loss of usable energy between trophic levels", "fixed fact bank checked against CED 8.2", est=60)

bi_n_meiosis_variation = make_bank_archetype("bi_n_meiosis_variation", "5.2", "1.B", [
    B("A pea plant is heterozygous for seed shape (Rr) and for seed color (Yy), and the two genes are on different chromosomes. The plant produces gametes with all four combinations of the alleles (RY, Ry, rY, and ry). Which event during meiosis best explains this?",
      ("Independent assortment of the homologous chromosome pairs during metaphase I", "Each homologous pair lines up and separates independently of the other pair, which produces all four combinations of alleles."),
      [("Crossing over between sister chromatids during prophase II", "Crossing over occurs during prophase I between nonsister chromatids of homologous chromosomes."),
       ("Separation of sister chromatids during anaphase II", "Separating sister chromatids gives cells with identical copies of a chromosome and does not shuffle alleles of different genes."),
       ("Replication of the DNA during the S phase of interphase", "Replication copies each chromosome and does not shuffle alleles of different genes into new combinations.")]),
    B("Two genes are located close together on the same chromosome. A parent has the alleles A and B on one homologous chromosome and the alleles a and b on the other. Some of the gametes of this parent carry the combination A and b. Which process best explains these gametes?",
      ("Crossing over between nonsister chromatids of the homologous chromosomes during prophase I", "Crossing over exchanges segments between homologs and makes a new combination of linked alleles."),
      [("Independent assortment of the two genes during metaphase I", "Genes on the same chromosome are linked and do not assort independently."),
       ("Random fertilization of an egg by a sperm cell", "Fertilization combines gametes and does not change the combination of alleles in a gamete."),
       ("Mitosis of the cells in the testes or ovaries before meiosis begins", "Mitosis produces cells identical to the parent cell and does not make new allele combinations.")]),
    B("Which statement correctly compares the cells produced by mitosis and by meiosis in a diploid organism?",
      ("Mitosis produces two genetically identical diploid cells, and meiosis produces four genetically different haploid cells.", "Mitosis copies a cell, whereas meiosis halves the chromosome number and shuffles alleles."),
      [("Mitosis produces four haploid cells, and meiosis produces two identical diploid cells.", "The numbers and ploidy are reversed: meiosis produces four haploid cells."),
       ("Mitosis and meiosis both produce four cells that are genetically different from the parent cell.", "Mitosis produces two cells that are genetically identical to the parent cell."),
       ("Mitosis produces two haploid cells, and meiosis produces two diploid cells that differ genetically.", "Mitosis keeps the diploid number, and meiosis produces haploid cells.")]),
], "explain how meiosis produces genetically different gametes", "fixed fact bank checked against CED 5.2", est=60)

bi_n_signal_receptor_location = make_bank_archetype("bi_n_signal_receptor_location", "4.2", "1.B", [
    B("Testosterone is a nonpolar steroid hormone. Which of the following best predicts where the receptor for testosterone is located in a target cell?",
      ("Inside the cell, because the hormone can cross the phospholipid bilayer to reach its receptor", "Nonpolar molecules diffuse through the lipid bilayer, so steroid hormone receptors are intracellular."),
      [("On the outer surface of the plasma membrane, because signaling molecules are too large to enter cells", "Nonpolar steroid hormones pass through the membrane, so a surface receptor is not required."),
       ("In the extracellular fluid, because a receptor must be outside the cell to detect a signal", "A receptor is a protein of the target cell and the steroid receptor is found inside the cell."),
       ("In the membrane of the mitochondria, because the hormone is made from energy-rich molecules", "The place where a hormone is made from does not determine where its receptor is found.")]),
    B("Insulin is a large, polar protein hormone. Which of the following best predicts where the receptor for insulin is located in a target cell?",
      ("In the plasma membrane with its binding site on the outer surface, because insulin cannot cross the phospholipid bilayer", "Large polar molecules cannot pass through the bilayer, so the receptor is on the cell surface."),
      [("In the cytoplasm, because the hormone must enter the cell to cause a response", "A large polar protein cannot cross the membrane, and surface receptors can start the response from outside."),
       ("In the nucleus, because the hormone must bind the DNA to change the activity of genes", "Insulin binds a surface receptor and the signal is passed on by a signal transduction pathway."),
       ("In the extracellular matrix, because the receptor must be free of the cell", "Receptors for peptide hormones are membrane proteins of the target cell.")]),
    B("A researcher treats target cells with an inhibitor that blocks all of the receptors in the plasma membrane but cannot enter the cells. Which of the following ligands would still be expected to cause a response in the cells?",
      ("A nonpolar steroid hormone, because its receptor is inside the cell and the hormone can cross the membrane", "The inhibitor cannot block intracellular receptors, which the steroid can reach."),
      [("A large polar peptide hormone, because peptide hormones are able to enter cells easily", "Large polar molecules cannot cross the bilayer and rely on receptors in the plasma membrane."),
       ("A neurotransmitter that binds a membrane receptor, because it can bypass the receptor", "A ligand that binds a membrane receptor depends on that receptor to cause a response."),
       ("Any ligand, because the cells contain other receptors for every signal", "Each receptor binds a specific ligand, so blocking the membrane receptors blocks the response to their ligands.")]),
], "relate the chemical nature of a signaling molecule to the location of its receptor", "fixed fact bank checked against CED 4.2", est=60)

bi_n_density_factors = make_bank_archetype("bi_n_density_factors", "8.4", "1.B", [
    B("A wildfire kills about 70% of the deer mice in a forest, no matter how large the population was before the fire. Which of the following correctly classifies the factor that reduced the population?",
      ("A density-independent factor, because it affects the same proportion of the population regardless of its density", "A fire kills a fixed fraction of the individuals whether the population is crowded or sparse."),
      [("A density-dependent factor, because it reduced the number of individuals in the population", "Any factor that changes the size of a population can be either type; the classification depends on whether the effect changes with density."),
       ("A density-dependent factor, because larger populations occupy more of the forest and are more likely to burn", "The fire killed the same percent of the population regardless of its size, so it does not depend on density."),
       ("A density-independent factor, because it affects only the largest individuals in the population", "Being density-independent refers to the effect not depending on population density, not to which individuals are affected.")]),
    B("As a population of aphids on a plant grows, the aphids compete more for phloem sap and the number of offspring produced per aphid decreases. Which of the following best describes this regulation of the population?",
      ("Density-dependent regulation, because the birth rate per individual falls as the population becomes more crowded", "The effect of competition on each individual increases with the density of the population."),
      [("Density-independent regulation, because competition is not a limit on a population", "Competition for resources is a common density-dependent limit."),
       ("Density-independent regulation, because the number of offspring changes in the population", "A change in the birth rate does not make a factor density-independent; the change depends on crowding here."),
       ("Density-dependent regulation, because the aphids move to a different plant when the population falls", "The regulation described is the decrease in the birth rate with crowding, not the movement of aphids.")]),
    B("A disease spreads more easily through a herd of elk when the animals are crowded together, and the proportion of elk that die from the disease is greater in dense herds than in sparse herds. Which of the following best describes the effect of the disease on the elk population?",
      ("It is density-dependent, because the proportion of elk that die increases as the herd becomes more crowded", "The effect of the disease depends on how dense the population is."),
      [("It is density-independent, because disease is not a factor of the environment", "Disease is an environmental limit and in this case its effect depends on density."),
       ("It is density-independent, because the disease kills elk in both dense and sparse herds", "A factor is density-dependent when the proportion affected changes with density, even if it acts at every density."),
       ("It is density-dependent, because the disease kills only the weakest elk in the herd", "Which individuals are killed does not determine whether a factor depends on density.")]),
], "classify a limiting factor as density-dependent or density-independent", "fixed fact bank checked against CED 8.4", est=60)

bi_n_replication_vs_transcription = make_bank_archetype("bi_n_replication_vs_transcription", "6.3", "1.B", [
    B("Which of the following correctly compares DNA replication and transcription in a eukaryotic cell?",
      ("Replication copies both strands of the DNA using DNA polymerase, and transcription uses RNA polymerase to make an RNA copy of one strand of a gene.", "Replication makes two identical DNA molecules, whereas transcription makes a single-stranded RNA from a template strand."),
      [("Replication uses RNA polymerase to copy one strand of a gene, and transcription uses DNA polymerase to copy both strands.", "The two enzymes are reversed: DNA polymerase replicates DNA and RNA polymerase transcribes it."),
       ("Replication and transcription both make a copy of an entire chromosome using the same enzyme.", "Transcription copies a single gene or a few genes, and it uses a different enzyme than replication."),
       ("Replication makes a single strand of RNA, and transcription makes two identical double-stranded DNA molecules.", "Replication makes DNA and transcription makes RNA, which is single-stranded.")]),
    B("A template strand of DNA has the sequence 3'-TACGGA-5'. Which of the following best describes the molecule made from this template by transcription?",
      ("A strand of RNA with the sequence 5'-AUGCCU-3'", "RNA is made complementary and antiparallel to the template strand, with uracil in place of thymine."),
      [("A strand of RNA with the sequence 5'-ATGCCT-3'", "RNA contains uracil in place of thymine."),
       ("A strand of DNA with the sequence 5'-ATGCCT-3'", "Transcription makes RNA and not DNA."),
       ("A strand of RNA with the sequence 5'-UACGGA-3'", "The new strand is complementary to the template, not a copy of the template sequence.")]),
    B("Which of the following is true of the enzyme that carries out transcription but not of the enzyme that carries out replication?",
      ("It can start a new strand without a primer and joins ribonucleotides to the template.", "RNA polymerase can start a new strand without a primer, whereas DNA polymerase extends a primer."),
      [("It reads the DNA template in the 5' to 3' direction while it builds the new strand.", "Both polymerases read a template in the 3' to 5' direction and build the new strand 5' to 3'."),
       ("It joins deoxyribonucleotides to build the new strand, as in the copying of the DNA.", "Replication joins deoxyribonucleotides; transcription joins ribonucleotides."),
       ("It builds the new strand in the 3' to 5' direction along the template.", "Both enzymes build new strands in the 5' to 3' direction.")]),
], "compare the enzymes, templates and products of DNA replication and transcription", "fixed fact bank checked against CED 6.3 (3'-TACGGA-5' transcribes to 5'-AUGCCU-3')", est=60)

# ============================ Practice 6 (논증) — 고정 문장 은행 ============================
bi_n_reason_hershey_chase = make_bank_archetype("bi_n_reason_hershey_chase", "6.1", "6.C", [
    B("In an experiment, bacteriophages were grown in a medium with radioactive phosphorus (32P) or with radioactive sulfur (35S). The phages were then allowed to infect nonradioactive bacteria, and the mixture was agitated to remove the phages from the surface of the bacteria. The inside of the bacterial cells contained 32P but almost no 35S. Which of the following best justifies the claim that DNA is the genetic material of the phage?",
      ("Phosphorus is found in DNA but not in proteins, so the labeled DNA entered the bacteria and directed the production of new phages.", "Only the labeled molecule that carries the information for new phages should enter the host cell, and phosphorus labels DNA."),
      [("Sulfur is found in DNA but not in proteins, so the labeled DNA remained outside the bacteria.", "Sulfur is found in proteins and not in DNA, so 35S labels the protein."),
       ("Radioactivity was detected in the bacteria, so every labeled molecule of the phage must enter the host cell.", "The experiment shows that the labeled phosphorus entered and the labeled sulfur did not, so not every molecule enters."),
       ("Proteins contain phosphorus, so the protein of the phage entered the bacteria and carried the genetic information.", "Proteins do not contain phosphorus in their amino acids, and the protein did not enter the cell.")]),
    B("In the experiment described, phages labeled with 35S were mixed with bacteria and then separated from the bacterial cells by agitation. Most of the 35S was found in the liquid with the phage coats and not inside the cells. Which of the following is the best reasoning for what this result shows?",
      ("The sulfur-containing protein of the phage stayed outside the cell, so protein did not direct the production of new phages.", "The labeled protein was left outside, so it could not be the material that carried the instructions into the host."),
      [("The DNA of the phage, which contains sulfur, stayed outside the cell, so DNA is not the genetic material.", "DNA does not contain sulfur, so the 35S did not label the DNA."),
       ("The protein of the phage entered the cell and was copied to make new phages.", "The 35S stayed outside the cell, so the protein was not inside."),
       ("The bacteria could not be infected, because the phages did not enter the cells at all.", "The phosphorus label showed that the genetic material entered, so infection took place.")]),
    B("A student reads that new phages produced in infected bacteria contained some of the 32P that was in the parent phages but almost none of the 35S. Which of the following is the best reasoning to explain how this result supports the claim that DNA is the genetic material?",
      ("The 32P that labeled the parent DNA was passed to the new phages, so the DNA carried the information that was inherited by the next generation.", "Material that is passed from parents to offspring is the genetic material, and the labeled DNA was passed on."),
      [("The 35S that labeled the parent protein was passed to the new phages, so protein is inherited.", "Almost none of the 35S was passed on, so the protein was not inherited."),
       ("The 32P was found in the new phages because phosphorus is a part of every protein, so protein is inherited.", "Phosphorus labels DNA and not the amino acids of proteins."),
       ("The new phages contained 32P because the bacteria made it, which shows that bacteria carry the genetic information of the phage.", "The 32P came from the labeled parent phages and was not made by the bacteria.")]),
], "justify the claim that DNA is the genetic material from labeled phage data", "fixed fact bank checked against CED 6.1 (DNA contains phosphorus and no sulfur; proteins contain sulfur in some amino acids and no phosphorus)", est=70)

bi_n_predict_keystone = make_bank_archetype("bi_n_predict_keystone", "8.5", "6.E", [
    B("In a rocky intertidal community, a sea star preys on mussels, which are the strongest competitors for space on the rocks. Sea stars are removed from part of the community. Which of the following is the best prediction of the long-term effect of removing the sea stars?",
      ("The number of mussels will increase and the number of species in the community will decrease, because mussels will outcompete the other species for space.", "Without a predator, the dominant competitor increases and crowds out other species."),
      [("The number of mussels will decrease and the number of species in the community will increase, because there is less competition from the sea stars.", "Removing a predator of mussels would not decrease the mussels."),
       ("The number of mussels and the number of other species will both stay the same, because each species occupies a different niche.", "A keystone predator has a large effect on the community, so the composition will change."),
       ("The number of mussels will decrease because they lose a food source, and the number of other species will increase.", "Sea stars are predators of the mussels and are not a food source for them.")]),
    B("Wolves in a forest prey on elk, and the elk feed on young willow trees along streams. Wolves are removed from the forest. Which of the following is the best prediction of the effect of the removal of the wolves?",
      ("The elk population will increase and the number of young willow trees will decrease, because the elk will eat more of them.", "Removing a predator allows the prey to increase, which increases the pressure on the plants that they eat."),
      [("The elk population will decrease and the number of young willow trees will increase, because there is less competition.", "Without wolves, the elk are not preyed upon and are expected to increase."),
       ("The elk population will stay the same and the number of willow trees will increase, because the willows do not depend on wolves.", "Wolves control the elk population, which affects the willows."),
       ("The elk population will increase and the number of young willow trees will increase, because the elk spread the seeds.", "The effect of the elk on the willows that is described is the feeding on young trees, which reduces them.")]),
    B("Sea otters in a coastal kelp forest prey on sea urchins, which graze on kelp. Sea otters are removed from the community. Which of the following is the best prediction of the effect of removing the sea otters?",
      ("The sea urchin population will increase and the amount of kelp will decrease, because more urchins graze on the kelp.", "Removing the predator allows the grazers to increase and they reduce their food."),
      [("The sea urchin population will decrease and the amount of kelp will increase, because the urchins lose a predator.", "A loss of a predator does not decrease the urchins."),
       ("The sea urchin population will increase and the amount of kelp will increase, because the urchins provide nutrients.", "A larger population of grazers reduces the kelp that they eat."),
       ("Neither the sea urchins nor the kelp will change, because the otters do not eat the kelp.", "The otters affect the kelp indirectly by controlling the urchins that eat it.")]),
], "predict the effect on a community of the removal of a keystone predator", "fixed fact bank checked against CED 8.5", est=70)

bi_n_support_common_ancestry = make_bank_archetype("bi_n_support_common_ancestry", "7.6", "6.B", [
    B("A student claims that species X shares a more recent common ancestor with species Y than with species Z. Which of the following evidence best supports the claim?",
      ("A gene of 1,000 base pairs is 98% identical in X and Y but only 85% identical in X and Z.", "A greater similarity of homologous DNA sequences indicates a more recent common ancestor."),
      [("Species X and species Y live in the same habitat, and species Z lives in a different habitat.", "Living in the same habitat does not show that species share a recent common ancestor."),
       ("Species X and species Y both have wings that are used for flight, and species Z does not have wings.", "Similar structures that evolved independently (analogous structures) do not show a recent common ancestor."),
       ("Species X is larger than species Z and similar in size to species Y.", "Body size is not a reliable measure of how recently species shared a common ancestor.")]),
    B("A student claims that two species of mammals share a more recent common ancestor with each other than either does with a species of bird. Which of the following is the best evidence to support the claim?",
      ("The mammals share homologous limb bones and a derived trait, such as mammary glands, that the bird lacks.", "Shared homologous structures and derived traits are evidence of a common ancestor."),
      [("One of the mammals and the bird can both fly, while the other mammal cannot fly.", "Flight evolved independently in birds and bats and is an analogous trait."),
       ("The two mammals and the bird all eat the same kinds of food in their habitats.", "Diet is not a measure of relatedness."),
       ("The two mammals are found in the same kinds of environments more often than the bird.", "The abundance of a species does not show relatedness.")]),
    B("A student claims that humans share a more recent common ancestor with chimpanzees than with mice. Which of the following comparisons of a protein found in all three species provides the best evidence for the claim?",
      ("The protein has 1 amino acid difference between humans and chimpanzees and 15 amino acid differences between humans and mice.", "Fewer differences in a homologous protein indicate less time since the species shared a common ancestor."),
      [("The protein has the same function in humans, chimpanzees and mice.", "A common function shows that the protein is conserved but not which species are the closest relatives."),
       ("The protein is found in more cells of the human body than in the bodies of mice.", "The number of cells that contain the protein does not measure relatedness."),
       ("The protein of humans and mice has more amino acids than the protein of chimpanzees.", "Length alone does not measure relatedness and the claim is about differences between sequences.")]),
], "choose the evidence that supports a claim about common ancestry", "fixed fact bank checked against CED 7.6 and 7.9", est=65)


# ============================ Practice 2 (시각 표현) — 코드가 만든 표 ============================
def _f2(v):
    return f"{v:.2f}"


@_retry
def bi_n_potato_osmosis_table(rng):
    concs = [0.0, 0.2, 0.4, 0.6, 0.8]
    c0 = pick(rng, [0.12, 0.16, 0.24, 0.28, 0.32, 0.36, 0.44, 0.48, 0.52, 0.56, 0.64, 0.68])
    k = 25
    vals = [Fr(k) * (Fr(str(c0)) - Fr(str(c))) for c in concs]
    if any(v == 0 for v in vals):
        raise ValueError("zero_on_grid")
    # 경로 1: 부호가 바뀌는 두 점 사이의 선형 보간
    i = next(j for j in range(4) if vals[j] > 0 > vals[j + 1])
    interp = Fr(str(concs[i])) + (Fr(str(concs[i + 1])) - Fr(str(concs[i]))) * vals[i] / (vals[i] - vals[i + 1])
    # 경로 2: 최소제곱 직선의 x 절편
    import numpy as np
    xs = np.array(concs); ys = np.array([float(v) for v in vals])
    b, a = np.polyfit(xs, ys, 1)
    agree(-a / b, float(interp), 1e-9, "x0")
    nearest = min(concs, key=lambda c: abs(float(vals[concs.index(c)])))
    key_v = float(interp)
    pairs = [("Chooses the tested concentration at which the change in mass was the smallest instead of finding where the change would be zero.", nearest),
             ("Chooses the concentration in which the cores gained the most mass.", 0.0),
             ("Takes the middle of the range of tested concentrations.", 0.4),
             ("Chooses the concentration in which the cores lost the most mass.", 0.8)]
    rows = [[f"{c:.1f}", f"{float(v):+.1f}"] for c, v in zip(concs, vals)]
    stim = tbl("Percent change in mass of potato cores after 24 hours in sucrose solutions", ["Sucrose concentration of the solution (M)", "Percent change in mass of the potato core"], rows)
    stem = ("Potato cores of equal initial mass were placed in sucrose solutions of different concentrations for 24 hours, and the percent change in the mass of each core was measured. The results are shown in the table. "
            "Assume that the percent change in mass is a linear function of the concentration of the solution. Which of the following is the best estimate of the solute concentration of the cells of the potato?")
    kw = f"The mass of a core does not change when the solution is isotonic to the cells. The change in mass goes from {float(vals[i]):+.1f}% at {concs[i]:.1f} M to {float(vals[i + 1]):+.1f}% at {concs[i + 1]:.1f} M, so the line crosses zero at {key_v:.2f} M."
    return _num("bi_n_potato_osmosis_table", "2.7", "2.B", stem, key_v, pairs, lambda v: f"{v:.2f} M", rng, concept="estimate the solute concentration of cells from the zero crossing of mass change in solutions", path="linear interpolation between the two points of opposite sign vs the x intercept of the least-squares line",
                steps=_steps("Recognize that there is no net movement of water when the percent change in mass is zero", "Locate the pair of concentrations between which the sign of the change reverses", "Use the assumed linear relationship to find the concentration at which the change is zero"), stim=stim, gap=0.03, rel=0.1, facts=[f"c0={c0}"], kwhy=kw, est=95,
                judgment="read the sign change in a table and interpolate to the equilibrium concentration")


@_retry
def bi_n_respirometer_table(rng):
    r = pick(rng, [Fr(2, 5), Fr(3, 5), Fr(4, 5), Fr(1), Fr(6, 5)])    # mL/min of the germinating peas at the warm temperature
    m = pick(rng, [4, 5, 8, 10])
    cold_ratio = pick(rng, [Fr(1, 4), Fr(1, 2)])
    times = [0, 5, 10, 15, 20]
    warm = [r * t for t in times]
    cold = [r * cold_ratio * t for t in times]
    # 경로 1: 전체 변화량 / 전체 시간; 경로 2: 구간별 속도의 평균
    seg = [(warm[i + 1] - warm[i]) / (times[i + 1] - times[i]) for i in range(4)]
    agree(float(sum(seg) / 4), float(warm[-1] / 20), 1e-9, "rate")
    key_v = float(r / m)
    pairs = [("Divides the rate by the mass but uses the rate for the cooler temperature.", float(r * cold_ratio / m)),
             ("Gives the rate for all of the peas and does not divide by the mass of the peas.", float(r)),
             ("Divides the total volume of oxygen consumed in 20 minutes by the mass and does not divide by the time.", float(warm[-1] / m)),
             ("Multiplies the rate by the mass of the peas instead of dividing by it.", float(r * m))]
    fmt = lambda v: f"{v:.3f} mL O₂ per gram per minute"  # noqa: E731
    rows = [[str(t), f"{float(w):.1f}", f"{float(c):.1f}"] for t, w, c in zip(times, warm, cold)]
    stim = tbl("Cumulative oxygen consumed by germinating peas", ["Time (min)", "Cumulative O₂ consumed at 22°C (mL)", "Cumulative O₂ consumed at 10°C (mL)"], rows)
    stem = (f"A respirometer was used to measure the oxygen consumed by {m} g of germinating peas at two temperatures. The table shows the cumulative volume of oxygen consumed over 20 minutes. "
            "Which of the following is the rate of oxygen consumption of the peas at 22°C per gram of peas?")
    kw = f"At 22°C the peas consumed {float(warm[-1]):.1f} mL in 20 minutes, which is {float(r):.2f} mL per minute. Dividing by the mass of {m} g gives {key_v:.3f} mL per gram per minute."
    return _num("bi_n_respirometer_table", "3.5", "2.B", stem, key_v, pairs, fmt, rng, concept="calculate a mass-specific rate of oxygen consumption from cumulative respirometer data", path="total change divided by total time vs the mean of the rates of the four 5-minute intervals",
                steps=_steps("Find the rate of oxygen consumption from the change in volume over the change in time at the correct temperature", "Divide the rate by the mass of the peas to express it per gram"), stim=stim, gap=0.0005, rel=0.08, facts=[f"r={float(r)}", f"m={m}"], kwhy=kw, est=95,
                judgment="read the right column of a table and convert a rate to a rate per unit mass")


@_retry
def bi_n_gel_digest_table(rng):
    N = pick(rng, [4000, 5000, 6000, 8000, 9000, 10000])
    d = pick(rng, [500, 1000, 1500, 2000, 2500, 3000])
    if d >= N / 2 or 2 * d == N:
        raise ValueError("d")
    big = N - d
    # 경로 1: 이중 절단 조각의 합 = N 이고 작은 조각이 두 자리 사이의 짧은 거리; 경로 2: 원 위의 모든 위치 배치를 열거
    found = set()
    for p1 in range(0, N, 500):
        p2 = (p1 + d) % N
        frags = sorted([abs(p2 - p1), N - abs(p2 - p1)])
        if frags == sorted([d, big]):
            found.add(min(frags))
    agree(min(found), d, 0, "dist")
    names = pick(rng, [("EcoRI", "BamHI"), ("HindIII", "XbaI"), ("SalI", "PstI"), ("KpnI", "SacI")])
    rows = [[f"{names[0]} alone", f"{N:,}"], [f"{names[1]} alone", f"{N:,}"], [f"{names[0]} and {names[1]} together", f"{big:,} and {d:,}"]]
    stim = tbl("Sizes of DNA fragments after digestion of a circular plasmid", ["Enzymes added to the plasmid", "Size of each fragment (base pairs)"], rows)
    stem = (f"A circular plasmid of {N:,} base pairs was digested with the restriction enzymes {names[0]} and {names[1]}. Each enzyme cuts the plasmid at exactly one site. The sizes of the fragments are shown in the table. "
            f"What is the distance, in base pairs, along the shorter path between the {names[0]} site and the {names[1]} site?")
    pairs = [("Gives the size of the larger fragment, which is the longer path between the two sites.", big), ("Gives the size of the whole plasmid, which is the size of the fragment that one enzyme makes.", N),
             ("Gives half of the size of the plasmid.", N // 2), ("Adds the size of the shorter fragment to the size of the plasmid.", N + d)]
    kw = f"One cut in a circular plasmid makes one linear fragment of {N:,} bp. Two cuts make two fragments, and the fragment lengths are the two paths between the sites around the circle: {d:,} bp and {big:,} bp. The shorter path is {d:,} bp."
    return _num("bi_n_gel_digest_table", "6.8", "2.B", stem, d, pairs, lambda v: f"{int(v):,} base pairs", rng, concept="deduce the spacing of two restriction sites on a circular plasmid from fragment sizes", path="sum of the fragment sizes and the shorter path vs enumeration of site positions around the circle",
                steps=_steps("Recognize that a single cut makes a circular plasmid into one linear fragment of the same size", "Recognize that two cuts make two fragments whose sizes are the two paths between the sites", "Choose the shorter fragment as the shorter path"), stim=stim, gap=0.0, rel=0.08, facts=[f"N={N}", f"d={d}"], kwhy=kw, est=95,
                judgment="interpret fragment sizes for single and double digests of a circular molecule")


@_retry
def bi_n_trophic_efficiency_table(rng):
    P = pick(rng, [10000, 20000, 40000, 50000])
    r1, r2, r3 = rng.sample([5, 8, 10, 12, 15, 20, 25], 3)
    e1 = Fr(P * r1, 100); e2 = e1 * r2 / 100; e3 = e2 * r3 / 100
    if any(x.denominator != 1 for x in (e1, e2, e3)):
        raise ValueError("int")
    e = [P, int(e1), int(e2), int(e3)]
    levels = ["Producers", "Primary consumers", "Secondary consumers", "Tertiary consumers"]
    which = rng.randrange(1, 3)   # 1: primary->secondary, 2: secondary->tertiary
    num, den = e[which + 1], e[which]
    key_v = 100.0 * num / den
    # 경로 2: 단계별로 효율을 곱해 최상위 값에서 거꾸로 확인
    chain = [r1, r2, r3][which]
    agree(key_v, chain, 1e-9, "pct")
    pairs = [("Divides by the energy of the producers instead of the energy of the lower trophic level of the transfer.", 100.0 * num / P), ("Calculates the percent of the energy that was lost in the transfer instead of the percent transferred.", 100.0 - key_v),
             ("Uses the percent transferred between a different pair of adjacent levels in the table.", float([r1, r2, r3][(which + 1) % 3])), ("Uses the percent transferred between the other pair of adjacent levels in the table.", float([r1, r2, r3][(which + 2) % 3]))]
    rows = [[lv, f"{v:,}"] for lv, v in zip(levels, e)]
    stim = tbl("Energy stored in the biomass at each trophic level of a pond community", ["Trophic level", "Energy stored (kJ per square meter per year)"], rows)
    stem = (f"The table shows the energy stored in the biomass of each trophic level in a pond community. What percent of the energy stored by the {levels[which].lower()} is transferred to and stored by the {levels[which + 1].lower()}?")
    kw = f"The energy stored by the {levels[which + 1].lower()} ({num:,} kJ) divided by the energy stored by the {levels[which].lower()} ({den:,} kJ) is {key_v:g}%."
    return _num("bi_n_trophic_efficiency_table", "8.2", "2.B", stem, key_v, pairs, lambda v: f"{v:g}%", rng, concept="calculate the percent of energy transferred between two trophic levels from a table", path="ratio of the two table values vs the generating transfer percent used to build the table",
                steps=_steps("Choose the two levels named in the question from the table", "Divide the energy of the higher level by the energy of the lower level and convert to a percent"), stim=stim, gap=0.3, rel=0.1, facts=[f"P={P}", f"r={r1},{r2},{r3}", f"which={which}"], kwhy=kw, est=85,
                judgment="select the right pair of rows and compute a transfer efficiency")


@_retry
def bi_n_molecular_clock_table(rng):
    rate = pick(rng, [1, 2, 3])        # amino acid changes per lineage per 10 million years
    T = pick(rng, [20, 30, 40, 50, 60, 80])   # millions of years since the split of the pair asked about
    d = 2 * rate * T // 10
    if d * 10 != 2 * rate * T:
        raise ValueError("int")
    # 세 종 A, B, C 의 쌍별 차이: A–B 는 묻는 쌍, 다른 쌍은 더 멀다
    d2 = d + pick(rng, [6, 8, 10, 12, 14])
    # 경로 1: d / (2 * rate) * 10; 경로 2: 한 계통의 변화 수(d/2)를 속도로 나눔
    t1 = d / (2 * rate) * 10
    t2 = (d / 2) / rate * 10
    agree(t1, t2, 1e-9, "T"); agree(t1, T, 1e-9, "T0")
    sp = rng.sample(["P", "Q", "R", "S", "T"], 3)
    a, b, c = sorted(sp)
    rows = [[f"{a} and {b}", str(d)], [f"{a} and {c}", str(d2)], [f"{b} and {c}", str(d2)]]
    stim = tbl("Number of amino acid differences in the same protein between pairs of species", ["Species pair", "Number of amino acid differences"], rows)
    stem = (f"The table shows the number of amino acid differences in the same protein between pairs of three species. Each lineage accumulates {rate} amino acid change{'s' if rate > 1 else ''} in this protein per 10 million years, and the rate is constant. "
            f"About how many million years ago did the species {a} and {b} share a common ancestor?")
    pairs = [("Divides the number of differences by the rate for one lineage, forgetting that both lineages changed since the split.", d / rate * 10), ("Multiplies the number of differences by the rate.", d * rate * 10),
             ("Uses the number of differences between a different pair of species.", d2 / (2 * rate) * 10), ("Divides the number of differences by four times the rate.", d / (4 * rate) * 10)]
    kw = f"The {d} differences accumulated in two lineages, so each lineage changed by {d // 2}. At {rate} change per 10 million years per lineage, the time is {d // 2} / {rate} x 10 = {T} million years."
    return _num("bi_n_molecular_clock_table", "7.9", "2.B", stem, T, pairs, lambda v: f"{v:g} million years", rng, concept="estimate a divergence time from sequence differences and a constant rate in each lineage", path="differences divided by twice the per-lineage rate vs half of the differences (the change in one lineage) divided by the rate",
                steps=_steps("Recognize that the differences between two species were accumulated in both lineages since the split", "Find the number of changes in one lineage", "Divide by the rate per unit of time"), stim=stim, gap=0.0, rel=0.08, facts=[f"rate={rate}", f"T={T}", f"d={d}"], kwhy=kw, est=95,
                judgment="account for change in both lineages after a divergence")


@_retry
def bi_n_ploidy_dna_table(rng):
    two_n = pick(rng, [8, 12, 16, 20, 24, 28, 38, 46])
    c = pick(rng, [Fr(3, 2), Fr(2), Fr(5, 2), Fr(3), Fr(7, 2), Fr(4)])
    cells = {"g1": (two_n, 2 * c), "prophase1": (two_n, 4 * c), "after1": (two_n // 2, 2 * c), "gamete": (two_n // 2, c)}
    labels = ["W", "X", "Y", "Z"]; rng.shuffle(labels)
    order = ["g1", "prophase1", "after1", "gamete"]; rng.shuffle(order)
    who = dict(zip(order, labels))
    ask = pick(rng, ["gamete", "after1", "prophase1"])
    # 경로 1: 규칙으로 식별; 경로 2: 염색체 수와 DNA 양 순서쌍으로 직접 비교
    ch = {k: v[0] for k, v in cells.items()}; dn = {k: v[1] for k, v in cells.items()}
    by_rule = {"gamete": min(cells, key=lambda k: (ch[k], dn[k])), "prophase1": max(cells, key=lambda k: dn[k]), "after1": next(k for k in cells if ch[k] == two_n // 2 and dn[k] == 2 * c)}
    agree(1.0 if by_rule[ask] == ask else 0.0, 1.0, 0, "id")
    rows = [[f"Cell {lab}", str(cells[k][0]), f"{float(cells[k][1]):g}"] for lab, k in sorted((who[k], k) for k in order)]
    stim = tbl("Number of chromosomes and amount of DNA in four cells from the same organism", ["Cell", "Number of chromosomes in the cell", "Amount of DNA in the cell (picograms)"], rows)
    desc = {"gamete": "a gamete (egg or sperm cell)", "after1": "one of the two cells that results from the first meiotic division (meiosis I) and has not begun meiosis II", "prophase1": "a cell in prophase I of meiosis"}
    stem = ("The table shows the number of chromosomes and the amount of DNA in four cells of the same diploid organism. The cells are a cell in the G1 phase of the cell cycle, a cell in prophase I of meiosis, one of the two cells that results from meiosis I, and a gamete. "
            f"Which cell is {desc[ask]}?")
    key = Opt(f"Cell {who[ask]}", True, "", None)
    rest = [k for k in order if k != ask]
    whys = {"g1": "This cell has the diploid number of chromosomes and the amount of DNA of a cell that has not replicated its DNA, which fits a cell in the G1 phase.",
            "prophase1": "This cell has the diploid number of chromosomes and twice as much DNA as a G1 cell, which fits a cell in prophase I after the DNA is replicated.",
            "after1": "This cell has the haploid number of chromosomes but the amount of DNA of a G1 cell, because each chromosome still has two chromatids, so it fits a cell after meiosis I.",
            "gamete": "This cell has the haploid number of chromosomes and the least DNA, which fits a gamete."}
    ds = [Opt(f"Cell {who[k]}", False, whys[k], None) for k in rest]
    kw = (f"A gamete has {two_n // 2} chromosomes and {float(c):g} pg of DNA; a cell after meiosis I has {two_n // 2} chromosomes with {float(2 * c):g} pg because each chromosome still has two chromatids; a cell in prophase I has {two_n} chromosomes and {float(4 * c):g} pg after replication. "
          f"Cell {who[ask]} matches {desc[ask]}.")
    return mk("bi_n_ploidy_dna_table", "5.2", "2.A", stem, key, ds, rng, concept="identify the stage of meiosis from chromosome number and DNA content", path="identification by rules on chromosome number and DNA amount vs comparison of the ordered pairs of values with the cell cycle model",
              thinking=_steps("Compare the number of chromosomes of each cell with the diploid number", "Compare the amount of DNA with the amount before replication", "Match the combination to the stage described"), stim=stim, est=95, facts=[f"2n={two_n}", f"c={float(c)}", f"ask={ask}"], kwhy=kw, judgment="relate chromosome number and DNA content to stages of the cell cycle and meiosis")


@_retry
def bi_n_action_spectrum_table(rng):
    wl = [450, 500, 550, 600, 650, 700]
    base = [100, 62, 22, 48, 85, 28]
    s = pick(rng, [Fr(1), Fr(9, 10), Fr(11, 10), Fr(6, 5), Fr(4, 5)])
    jit = [pick(rng, [-3, 0, 2, 3]) for _ in wl]
    rate = [int(base[i] * s) + jit[i] for i in range(6)]
    ask = rng.randrange(2)
    srt = sorted(rate)
    if srt[0] == srt[1] or srt[-2] == srt[-3]:
        raise ValueError("tie")
    # 경로 1: 정렬로 순위 결정; 경로 2: 최댓값·최솟값 선형 탐색
    order = sorted(range(6), key=lambda i: rate[i])
    lo = min(range(6), key=lambda i: rate[i]); hi = sorted(range(6), key=lambda i: -rate[i])[:2]
    agree(1.0 if order[0] == lo else 0.0, 1.0, 0, "lo"); agree(1.0 if set(order[-2:]) == set(hi) else 0.0, 1.0, 0, "hi")
    names = {450: "blue", 500: "blue-green", 550: "green", 600: "orange", 650: "red", 700: "far red"}
    rows = [[str(w), str(r)] for w, r in zip(wl, rate)]
    stim = tbl("Relative rate of oxygen production by an aquatic plant in light of different wavelengths", ["Wavelength of light (nm)", "Relative rate of O₂ production (arbitrary units)"], rows)
    if ask == 0:
        stem = ("An aquatic plant was illuminated with equal intensities of light at six different wavelengths, and the relative rate of oxygen production was measured. The results are shown in the table. "
                "Which of the following is the best explanation for the wavelength at which the plant produced oxygen at the lowest rate?")
        w = wl[lo]
        key_t = f"{w} nm, because the photosynthetic pigments absorb little {names[w]} light, so less energy is available to drive the light reactions."
        wrong = [(f"{wl[hi[0]]} nm, because the photosynthetic pigments reflect {names[wl[hi[0]]]} light, so less energy is available.", f"The rate was highest at {wl[hi[0]]} nm, so this wavelength is absorbed well and not poorly."),
                 (f"{wl[order[1]]} nm, because the photosynthetic pigments absorb all of the {names[wl[order[1]]]} light and are damaged by it.", f"The rate at {wl[order[1]]} nm was not the lowest of the six wavelengths."),
                 (f"{wl[lo]} nm, because the plant absorbs this light well but the Calvin cycle cannot use the energy.", "A low rate of oxygen production from the light reactions shows that the light is poorly absorbed, and the Calvin cycle is not the cause.")]
        wrong = [x for x in wrong]
        kw = f"The lowest rate in the table is {rate[lo]} at {w} nm, so that light is absorbed the least by the pigments and drives the light reactions the least."
    else:
        stem = ("An aquatic plant was illuminated with equal intensities of light at six different wavelengths, and the relative rate of oxygen production was measured. The results are shown in the table. "
                "Which of the following best describes the two wavelengths at which the rate of oxygen production was the highest and the reason?")
        a, b = sorted(hi)
        key_t = f"{wl[a]} nm and {wl[b]} nm, because chlorophylls absorb the most light in the blue and red regions of the spectrum."
        lo_w = wl[lo]
        wrong = [(f"{lo_w} nm and {wl[a]} nm, because chlorophylls absorb green light most strongly.", f"The rate at {lo_w} nm was the lowest, so green light is not absorbed most strongly."),
                 (f"{wl[order[1]]} nm and {wl[order[2]]} nm, because the pigments reflect the wavelengths that drive photosynthesis the most.", "The wavelengths that drive photosynthesis the most are those that are absorbed, and not those that are reflected."),
                 ("650 nm and 700 nm, because the longest wavelengths carry the most energy per photon.", "Longer wavelengths carry less energy per photon, and the rate of oxygen production depends on the absorption of the light by the pigments.")]
        kw = f"The two highest rates in the table are {rate[a]} at {wl[a]} nm and {rate[b]} at {wl[b]} nm, which are in the blue and red regions where chlorophylls absorb the most light."
    key, ds = sentence_options(key_t, kw, wrong)
    return mk("bi_n_action_spectrum_table", "3.4", "2.A", stem, key, ds, rng, concept="describe an action spectrum and relate it to the absorption of light by photosynthetic pigments", path="ranking of the six rates by sorting vs a linear search for the lowest and the two highest values",
              thinking=_steps("Find the wavelength or wavelengths with the lowest or highest rate in the table", "Relate the rate of oxygen production to the absorption of light by the pigments"), stim=stim, est=90, facts=[f"rates={rate}"], kwhy=kw, judgment="read the extremes of a table and connect them to pigment absorption")


STAGE_N_MC = ["bi_n_transport_classify", "bi_n_trophic_energy", "bi_n_meiosis_variation", "bi_n_signal_receptor_location", "bi_n_density_factors", "bi_n_replication_vs_transcription",
              "bi_n_reason_hershey_chase", "bi_n_predict_keystone", "bi_n_support_common_ancestry",
              "bi_n_potato_osmosis_table", "bi_n_respirometer_table", "bi_n_gel_digest_table", "bi_n_trophic_efficiency_table", "bi_n_molecular_clock_table", "bi_n_ploidy_dna_table", "bi_n_action_spectrum_table"]


# ===== BI3/BI4 생성 단계 목록(2026-10-19): 정확 배정(엄격: 공개 세트 원형 제외)에서 재고에 없는 칸 =====
STAGE_B34_MC = [
 "bi_antibiotic_data",
 "bi_bar_biomass",
 "bi_bar_expression",
 "bi_behavior_response",
 "bi_cancer_mutation",
 "bi_carb_structure",
 "bi_cell_compartment",
 "bi_chemiosmosis",
 "bi_community_interaction",
 "bi_cyclin_graph",
 "bi_density_factor",
 "bi_dna_structure",
 "bi_energy_coupling",
 "bi_feedback_type",
 "bi_graph_pcr_cycles",
 "bi_hw_conditions",
 "bi_hypothesis_signal",
 "bi_lipid_structure",
 "bi_meiosis_variation",
 "bi_membrane_structure",
 "bi_monomer_hydrolysis",
 "bi_n_action_spectrum_table",
 "bi_n_density_factors",
 "bi_n_gel_digest_table",
 "bi_n_meiosis_variation",
 "bi_n_molecular_clock_table",
 "bi_n_potato_osmosis_table",
 "bi_n_predict_keystone",
 "bi_n_reason_hershey_chase",
 "bi_n_replication_vs_transcription",
 "bi_n_respirometer_table",
 "bi_n_signal_receptor_location",
 "bi_n_support_common_ancestry",
 "bi_n_transport_classify",
 "bi_n_trophic_efficiency_table",
 "bi_n_trophic_energy",
 "bi_new_investigation_selection",
 "bi_nondisjunction",
 "bi_nucleotide_components",
 "bi_origin_of_life",
 "bi_photosynthesis_inputs",
 "bi_phylo_dna_data",
 "bi_prediction_gene",
 "bi_procedure_choice_dna",
 "bi_protein_function_shape",
 "bi_question_testable_cellcycle",
 "bi_reasoning_griffith",
 "bi_respiration_concept",
 "bi_selection_data_table",
 "bi_signal_steps",
 "bi_testcross",
 "bi_translation_concept",
 "bi_vesicle_transport",
 "bi_z_gene_order",
 "bi_z_pcr_cycles_predict"
]
STAGE_B34_SETS = ["bis_hw_set"]
STAGE_B34_FRQ = ["bif_q5_phylogeny"]
