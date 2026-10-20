"""AP Biology 원형 O — BI4 새 풀이 틀 2차(2026-10-19, 브랜치 ap-bi-ph-ch): bio-b34-mc 1차에서 반려된 16개 원형을 빼면 Practice 1·2·6 과 단원 3·7 칸이 다시 모자라
(엄격 배정: P1 -4, P2 -4, P6 -3) 새로 쓰는 14개 원형이다. bio_p0_n 과 같은 규칙: P1·P6 은 고정 문장 은행, P2 는 코드가 만든 표와 두 경로 독립 계산(검토기가
'단순 계산'이라고 반려한 2.B 계산형을 피하려고 P2 는 표에서 관계를 읽고 설명하는 문장 선택지로 쓴다). 필요한 모든 값은 학생 화면의 본문 또는 표에 있다."""
from fractions import Fraction as Fr  # noqa: F811
from bio_common import *  # noqa: F401,F403
from bio_p0_i import _retry, _steps, _num


# ============================ Practice 1 (개념 설명) ============================
bi_n_inhibitor_types = make_bank_archetype("bi_n_inhibitor_types", "3.1", "1.B", [
    B("Compound X has a shape that is similar to the shape of the substrate of an enzyme and binds reversibly to the active site. When the concentration of the substrate is made very large, the rate of the reaction returns to nearly the rate that is measured without compound X. Which of the following best explains this result?",
      ("Compound X is a competitive inhibitor, so a high concentration of the substrate makes the substrate more likely than X to occupy the active site.", "A competitive inhibitor and the substrate compete for the same site, and more substrate outcompetes the inhibitor."),
      [("Compound X is a noncompetitive inhibitor, so it lowers the maximum rate of the reaction no matter how much substrate is added.", "A noncompetitive inhibitor binds elsewhere and would continue to lower the rate at a high concentration of the substrate."),
       ("Compound X is an allosteric activator, so it increases the rate of the reaction when more substrate is present.", "An activator would raise the rate above the rate without X, and X lowered the rate at lower concentrations of the substrate."),
       ("Compound X is a coenzyme, so it supplies the energy that the substrate needs to react at a high concentration.", "A coenzyme helps catalysis and does not bind the active site in competition with the substrate.")]),
    B("Compound Y binds reversibly to a site on an enzyme that is not the active site and changes the shape of the active site. The rate of the reaction is lower with compound Y, and increasing the concentration of the substrate does not restore the rate. Which of the following best explains this result?",
      ("Compound Y is a noncompetitive (allosteric) inhibitor, so extra substrate cannot overcome its effect on the enzyme.", "An inhibitor at another site reduces the activity of the enzyme and cannot be outcompeted by the substrate."),
      [("Compound Y is a competitive inhibitor, so the substrate can be made to outcompete it for the active site.", "A competitive inhibitor binds the active site, and extra substrate would restore the rate."),
       ("Compound Y is a product of the reaction, so it is used up when the substrate is added.", "The inhibitor binds to the enzyme and is not consumed by the addition of substrate."),
       ("Compound Y denatures the enzyme permanently, so the enzyme cannot be reused.", "Binding to a site changes the shape reversibly and does not necessarily denature the enzyme.")]),
    B("In a metabolic pathway, the final product binds to the first enzyme of the pathway at a site that is not the active site, and the activity of that enzyme decreases when the concentration of the product is high. Which of the following best describes the advantage of this regulation to the cell?",
      ("It prevents the cell from making more of the product than is needed, because a high concentration of the product slows its own production.", "Negative feedback by the end product matches production to the demand of the cell."),
      [("It increases the production of the product, because the binding of the product makes the first enzyme more active.", "The activity decreases when the product is bound, so the production slows."),
       ("It allows the product to be used as a substrate by the first enzyme, so the enzyme works more efficiently.", "The product binds at a site other than the active site and is not a substrate of the first enzyme."),
       ("It permanently destroys the first enzyme, so that the pathway stops.", "The binding is reversible and the enzyme can recover when the concentration of the product falls.")]),
], "classify an enzyme inhibitor or regulator from its binding site and the effect of the substrate concentration", "fixed fact bank checked against CED 3.1", est=65)

bi_n_artificial_selection = make_bank_archetype("bi_n_artificial_selection", "7.3", "1.B", [
    B("A plant breeder grows a population of plants and each generation allows only the tallest plants to reproduce. After ten generations the average height of the population is much greater. Which of the following best describes this process?",
      ("Artificial selection, because the breeder chooses which plants reproduce, so alleles for greater height become more common.", "Humans select the individuals with the desired heritable trait to reproduce, which changes the allele frequencies."),
      [("Natural selection, because the environment chooses which plants reproduce.", "The reproduction of the plants was controlled by the breeder, not by the environment."),
       ("Genetic drift, because the average height of the population changed by chance.", "The change was directional because only tall plants reproduced, which is not random change."),
       ("Acclimation, because each tall plant grew taller during its life and passed that growth to its offspring.", "Traits that are acquired during the life of an individual are not inherited.")]),
    B("Teosinte, a wild grass with a few small kernels on each ear, is the ancestor of corn. Farmers over thousands of years saved the kernels of plants with larger ears to plant the next year. Which of the following is the best explanation for the evolution of corn with large ears?",
      ("The farmers repeatedly selected plants with heritable variation in ear size, so alleles for larger ears increased in frequency in each generation.", "Selection by humans on heritable variation changes the frequency of the alleles for the trait."),
      [("Each plant grew a larger ear because it needed a larger ear, and the larger ears were passed to its offspring.", "Needs of an organism do not cause new heritable traits."),
       ("The plants with small ears died out because large ears are always more fit in every environment.", "Fitness depends on the environment; here the farmers chose which plants reproduced."),
       ("The farmers caused mutations in the kernels that made large ears in the next generation.", "Saving kernels does not cause mutations; it selects among variation that already exists.")]),
    B("Dog breeds such as greyhounds and bulldogs differ greatly in body shape, although all dogs are descended from wolves. Which of the following best explains how the breeds became different from each other?",
      ("People bred dogs with different desired traits, so different alleles became common in the lines that were bred for different purposes.", "Selective breeding for different traits leads to different allele frequencies in different lines."),
      [("The dogs changed their own bodies to match the work they did, and the changes were passed on.", "Changes that an individual gains during life are not inherited."),
       ("Each breed formed because the dogs in the breed mutated in the same way at the same time.", "Mutations occur randomly in single individuals and do not appear in many individuals in the same way."),
       ("The breeds are different because the environment in which they were bred caused all of the dogs in a breed to have the same genes.", "The environment does not change the genes of all individuals in the same way; the breeders chose which dogs reproduced.")]),
], "explain how selective breeding changes allele frequencies and traits in a population", "fixed fact bank checked against CED 7.3 (artificial selection)", est=60)

bi_n_light_calvin = make_bank_archetype("bi_n_light_calvin", "3.4", "1.B", [
    B("Isolated chloroplasts are supplied with light and water but with no carbon dioxide. After a few minutes the Calvin cycle stops. Which of the following best explains why the Calvin cycle stops?",
      ("Carbon dioxide is the source of the carbon that is fixed into sugar, so the ATP and NADPH from the light reactions cannot be used.", "The Calvin cycle needs CO2 to fix carbon, and the ATP and NADPH accumulate unused."),
      [("Light is the substrate of the Calvin cycle, so the light is used up after a few minutes.", "Light is the energy source of the light reactions, and it is not a substrate of the Calvin cycle."),
       ("Water is split by the Calvin cycle, so the cycle stops when the CO2 is missing and no oxygen can be released.", "Water is split in the light reactions and not in the Calvin cycle."),
       ("The light reactions need CO2 to produce ATP, so without it no ATP is made.", "The light reactions make ATP and NADPH from light and water and do not use CO2.")]),
    B("A researcher adds an inhibitor that blocks the flow of electrons through the electron transport chain of the thylakoid membrane in a leaf. Which of the following is the best prediction of the effect on the Calvin cycle?",
      ("The rate of the Calvin cycle will decrease, because less ATP and NADPH are made to supply the energy and the reducing power for the cycle.", "The light reactions provide ATP and NADPH for the Calvin cycle."),
      [("The rate of the Calvin cycle will increase, because the inhibitor leaves more CO2 for the cycle.", "The inhibitor does not affect the supply of CO2, and the cycle depends on ATP and NADPH."),
       ("The rate of the Calvin cycle will not change, because the Calvin cycle is a separate process that does not need the light reactions.", "The Calvin cycle uses the products of the light reactions."),
       ("The rate of the Calvin cycle will increase, because the cycle can use the energy that is stored in the electrons directly.", "The cycle uses ATP and NADPH made by the light reactions.")]),
    B("A plant in which the Calvin cycle works well is moved into the dark. After some time the plant can no longer make sugar from carbon dioxide, even though it has plenty of carbon dioxide and water. Which of the following best explains this?",
      ("Without light, the light reactions stop making the ATP and NADPH that the Calvin cycle needs.", "The Calvin cycle does not directly use light but depends on the products of the light reactions."),
      [("The Calvin cycle uses light directly, so it stops when there is no light.", "The Calvin cycle uses ATP and NADPH, not light."),
       ("The plant takes in oxygen at night and so it cannot make sugar from carbon dioxide.", "The uptake of oxygen is not what limits sugar production in the dark."),
       ("The stomata of the plant are always closed in the dark, so that the cells cannot get water.", "The question states that water is plentiful, and the limiting factor is the lack of ATP and NADPH.")]),
], "relate the light reactions to the Calvin cycle in terms of their inputs and products", "fixed fact bank checked against CED 3.4", est=65)

bi_n_water_cohesion = make_bank_archetype("bi_n_water_cohesion", "1.1", "1.B", [
    B("A water strider is an insect that can stand and walk on the surface of a pond. Which of the following best explains why the insect does not break through the surface?",
      ("Hydrogen bonds between water molecules produce cohesion, so the surface acts like a thin film that resists being broken.", "Cohesion by hydrogen bonds gives water a high surface tension."),
      [("Water molecules at the surface form covalent bonds with the legs of the insect, which holds it up.", "The legs are held up by the surface tension of water, not by covalent bonds."),
       ("Water is a nonpolar liquid, so it does not wet the legs of the insect.", "Water is a polar molecule, and the surface tension comes from its polarity."),
       ("The density of the insect is lower than the density of air, so it floats on the water.", "Buoyancy does not explain why the surface holds the insect, and the insect is denser than air.")]),
    B("Ice floats on liquid water. Which of the following best explains why ice is less dense than liquid water?",
      ("In ice, each water molecule forms hydrogen bonds in an open, regular lattice that holds the molecules farther apart than in liquid water.", "The lattice of hydrogen bonds in ice has more space between the molecules."),
      [("The covalent bonds within a molecule of water get longer when the water freezes, which makes the molecules larger.", "The covalent bonds inside the molecule do not change greatly; the arrangement of the molecules changes."),
       ("Water molecules become nonpolar when they freeze, so they repel one another.", "Water remains polar in ice, and hydrogen bonds hold it in a lattice."),
       ("The molecules of ice are lighter than the molecules of liquid water because they lose some hydrogen atoms.", "Freezing does not change the mass of a molecule of water.")]),
    B("When a person sweats on a hot day, the evaporation of the sweat cools the skin. Which of the following best explains this cooling?",
      ("Water has a high heat of vaporization because hydrogen bonds must be broken, so evaporating molecules take a large amount of energy from the skin.", "Breaking hydrogen bonds as the water evaporates requires a large input of energy that is taken from the body."),
      [("Water has a low specific heat, so it warms up quickly and carries heat away from the skin.", "Water has a high specific heat and the cooling is due to the energy needed to evaporate it."),
       ("Evaporating water forms new covalent bonds, which releases energy to the air around the skin.", "Evaporation breaks hydrogen bonds between molecules of water and takes in energy."),
       ("Sweat is a nonpolar liquid, so it moves quickly across the skin and removes heat.", "Sweat is mostly water, which is polar, and the cooling is due to the high heat of vaporization.")]),
], "explain properties of water in terms of polarity and hydrogen bonding", "fixed fact bank checked against CED 1.1", est=60)

bi_n_gene_regulation_euk = make_bank_archetype("bi_n_gene_regulation_euk", "6.5", "1.B", [
    B("A human liver cell and a human neuron contain the same genome, but they express different sets of proteins. Which of the following best explains this difference?",
      ("Different regulatory proteins, such as transcription factors, are active in the two cell types and turn on different sets of genes.", "Cell types differ in gene expression, not in their DNA, because of which transcription factors are present and active."),
      [("The liver cell and the neuron lost different genes during their development, so each cell has a different set of genes.", "Cell differentiation does not usually involve loss of genes."),
       ("The two cell types have different codons, so the same gene makes different proteins.", "The genetic code is the same in all cells of an organism."),
       ("Only one of the two types of cell has ribosomes, so only that cell makes proteins from its mRNA.", "All cells that make proteins contain ribosomes.")]),
    B("A mutation changes the DNA-binding domain of a transcription factor, so that the protein can no longer bind to the enhancer region of a gene. Which of the following is the best prediction of the effect on the gene?",
      ("The transcription of the gene will decrease, because the transcription factor cannot help the RNA polymerase to start transcription.", "An activator that cannot bind its enhancer cannot increase the transcription of the gene."),
      [("The transcription of the gene will increase, because the mutation makes the transcription factor more active.", "A protein that cannot bind the DNA cannot activate the gene."),
       ("The mRNA of the gene will have a new sequence, because the mutation changes the codons of the gene.", "The mutation is in the transcription factor gene and not in the coding sequence of the target gene."),
       ("The transcription of the gene will not change, because the enhancer is part of the protein-coding region.", "An enhancer is a regulatory sequence of DNA and it influences the rate of transcription.")]),
    B("In bacteria that have the lac operon, the cells are grown in a medium that contains lactose but no glucose. Which of the following best describes the regulation of the lac operon in these cells?",
      ("Allolactose binds the repressor so that it cannot bind the operator, which allows the RNA polymerase to transcribe the genes for the use of lactose.", "The inducer inactivates the repressor, and the genes of the operon are transcribed."),
      [("Lactose binds to the DNA of the operator, which prevents the RNA polymerase from binding.", "The lactose does not bind the operator directly; its derivative acts on the repressor."),
       ("The repressor is made only in the absence of lactose, so the genes are always transcribed when lactose is present.", "The repressor is made all of the time, and it is the binding of the inducer that controls its action."),
       ("The ribosomes cannot bind to the mRNA of the operon until all of the lactose is used.", "The regulation of the operon takes place at the level of transcription.")]),
], "explain how regulatory proteins and sequences control gene expression", "fixed fact bank checked against CED 6.5", est=65)

# ============================ Practice 6 (논증) ============================
bi_n_claim_enzyme_temperature = make_bank_archetype("bi_n_claim_enzyme_temperature", "3.2", "6.B", [
    B("A student measures the rate of a reaction that is catalyzed by an enzyme at several temperatures and finds that the rate is highest at 37 degrees Celsius and very low at 60 degrees Celsius. The student claims that the enzyme is denatured at 60 degrees Celsius. Which additional observation would best support the claim?",
      ("After the enzyme is kept at 60 degrees Celsius and then cooled to 37 degrees Celsius, the rate of the reaction stays low.", "If the lost activity does not return at the optimum temperature, the change in the shape of the enzyme is not reversible and this suggests denaturation."),
      [("The rate of the reaction is also very low at 0 degrees Celsius in the same experiment.", "A low rate at a low temperature results from slow molecular motion and is not evidence of denaturation at 60 degrees Celsius."),
       ("The rate of the reaction at 37 degrees Celsius is higher with a larger amount of the substrate.", "The effect of the amount of substrate does not show whether the enzyme is denatured at 60 degrees Celsius."),
       ("The pH of the solution at 60 degrees Celsius is the same as at 37 degrees Celsius.", "A constant pH removes one other explanation but does not show that the enzyme changed shape.")]),
    B("A student claims that the optimum temperature of a human enzyme is higher than the optimum temperature of a similar enzyme from bacteria that live in a cold lake. Which data would best support the claim?",
      ("The human enzyme has its greatest rate at 37 degrees Celsius and the bacterial enzyme has its greatest rate at 10 degrees Celsius.", "A comparison of the temperatures at which each enzyme has its highest rate supports the claim."),
      [("The human enzyme has a faster reaction rate than the bacterial enzyme at 10 degrees Celsius.", "A faster rate at one temperature does not show the temperature at which each rate is the greatest."),
       ("Both enzymes lose all of their activity at 80 degrees Celsius in the same experiment.", "The temperature of denaturation does not give the optimum temperature."),
       ("The bacterial enzyme has a smaller number of amino acids than the human enzyme does.", "The length of the polypeptide does not show the optimum temperature.")]),
    B("A student states that increasing the temperature always increases the rate of an enzyme-catalyzed reaction. Which data would best be used as evidence against this claim?",
      ("A graph in which the rate rises up to 40 degrees Celsius and then falls sharply at higher temperatures.", "A rate that falls above an optimum temperature shows that a higher temperature does not always increase the rate."),
      [("A graph that shows the rate of the reaction increasing steadily from 10 to 40 degrees Celsius.", "These data show an increase over the range that is tested and do not contradict the claim."),
       ("A table that shows that the same product is made at each of the temperatures that were tested.", "The identity of the product does not show how the rate changes with temperature."),
       ("A graph that shows that the rate of the reaction increases when more enzyme is added.", "The effect of the amount of enzyme does not address the effect of temperature.")]),
], "choose the evidence that supports or contradicts a claim about the effect of temperature on an enzyme", "fixed fact bank checked against CED 3.2", est=65)

bi_n_predict_active_site = make_bank_archetype("bi_n_predict_active_site", "3.1", "6.E", [
    B("A mutation in the gene for an enzyme changes one amino acid in the active site from a polar amino acid to a nonpolar amino acid. The new amino acid does not change the overall shape of the enzyme. The substrate of the enzyme is a charged molecule that is held in the active site by an interaction with the polar amino acid. Which of the following is the best prediction of the effect of the mutation?",
      ("The enzyme will bind the substrate less effectively, so the rate of the reaction will decrease.", "The interaction that holds the charged substrate is lost, so fewer enzyme-substrate complexes form."),
      [("The enzyme will bind the substrate more tightly, so the rate of the reaction will increase.", "A nonpolar amino acid cannot hold a charged substrate more tightly."),
       ("The enzyme will no longer have a tertiary structure, so it will separate into amino acids.", "The stem says the overall shape does not change and a single substitution does not break the protein."),
       ("The rate of the reaction will not change, because only the shape of the enzyme matters and not the amino acids of the active site.", "The properties of the amino acids in the active site determine the binding of the substrate.")]),
    B("A mutation changes one amino acid in an enzyme at a position that is far from the active site. The amino acid is replaced by another amino acid with similar size and polarity. Which of the following is the best prediction of the effect of the mutation on the activity of the enzyme?",
      ("The activity of the enzyme will change little, because the shape of the active site is probably not affected.", "A similar amino acid far from the active site is unlikely to change the shape of the active site."),
      [("The enzyme will lose all of its activity, because every substitution of an amino acid denatures the protein.", "Many substitutions do not change the function of a protein."),
       ("The activity of the enzyme will double, because mutations always improve the function of a protein.", "Mutations do not always improve function, and this one is conservative."),
       ("The enzyme will be made from a different set of codons, which will stop the translation of its mRNA.", "A substitution of one amino acid does not by itself stop translation.")]),
    B("A mutation in the gene for an enzyme produces a stop codon in the middle of the coding sequence. Which of the following is the best prediction of the effect on the enzyme?",
      ("A shortened polypeptide will be made, and the enzyme will probably not be able to catalyze the reaction.", "A premature stop codon ends translation early, which gives a shortened polypeptide that usually lacks the active site."),
      [("A longer polypeptide will be made, because the stop codon adds amino acids to the end.", "A stop codon ends translation and does not add amino acids."),
       ("The enzyme will be made normally, because the DNA is repaired before translation.", "A mutation in the gene is copied in the mRNA and is not undone before translation."),
       ("The enzyme will have one different amino acid, and the rest of the protein will be normal.", "That would be the effect of a substitution, not of a stop codon in the middle of the sequence.")]),
], "predict the effect of a mutation on the function of an enzyme from the location and type of the change", "fixed fact bank checked against CED 3.1 and 6.7", est=70)

bi_n_predict_bottleneck = make_bank_archetype("bi_n_predict_bottleneck", "7.4", "6.E", [
    B("A population of 10,000 elephant seals was reduced to about 20 individuals by hunting, and then the population recovered to over 100,000 individuals. Which of the following is the best prediction of the genetic diversity of the recovered population compared with the diversity of the population before the hunting?",
      ("The genetic diversity of the recovered population will be lower, because only a small number of the alleles were present in the small surviving group.", "A bottleneck loses alleles by chance, and the recovered population descends from the survivors."),
      [("The genetic diversity of the recovered population will be the same, because the number of individuals is now larger than it was before.", "A larger population size does not restore the alleles that were lost during the bottleneck."),
       ("The genetic diversity of the recovered population will be higher, because new alleles were made when the population grew.", "Growth of the population does not by itself make new alleles quickly."),
       ("The genetic diversity of the recovered population will be the same, because natural selection restores the alleles that were lost.", "Selection cannot bring back alleles that no longer exist in the population.")]),
    B("A small number of birds from a large mainland population colonize an island. By chance, a rare allele for a feather color is carried by several of the colonists. Which of the following is the best prediction of the frequency of the allele in the island population compared with its frequency in the mainland population?",
      ("The frequency of the allele on the island will probably be higher, because a small sample of the mainland population can differ by chance from the whole population.", "The founder effect is a change in the allele frequencies in a small group that starts a new population."),
      [("The frequency of the allele on the island will be the same, because the colonists have the same alleles as the mainland population.", "A small group does not have the same allele frequencies as the large population by chance."),
       ("The frequency of the allele on the island will be lower, because rare alleles are always lost when a population is small.", "A rare allele can become more common in a small sample by chance."),
       ("The frequency of the allele on the island will be higher, because the birds chose to carry the allele to the island.", "The colonists do not choose alleles; the sample is random with respect to the allele.")]),
    B("Two populations of the same species of plant have the same starting frequency of an allele, 0.50. Population X has 50 individuals and population Y has 5,000 individuals. No selection, migration or mutation occurs. Which of the following is the best prediction of the allele frequency after many generations?",
      ("The frequency of the allele is more likely to change a lot in population X than in population Y, because random changes in the frequency are larger in a small population.", "Genetic drift has a greater effect in a small population."),
      [("The frequency of the allele is more likely to change a lot in population Y than in population X, because a larger population has more mutations.", "Mutation is excluded in the question and the effect of drift is larger when the population is small."),
       ("The frequency of the allele will stay at 0.50 in both populations, because no selection occurs.", "Random changes in the frequency occur even without selection."),
       ("The frequency of the allele will increase in both populations, because alleles always increase in frequency over time.", "Alleles do not always increase; drift changes them at random.")]),
], "predict the effect of a bottleneck, a founder event or population size on allele frequencies", "fixed fact bank checked against CED 7.4", est=70)

bi_n_justify_primary_structure = make_bank_archetype("bi_n_justify_primary_structure", "1.7", "6.C", [
    B("In sickle cell disease, a change in a single nucleotide in the gene for beta-globin changes one amino acid in the polypeptide, and the hemoglobin made from the changed polypeptide forms long fibers in the red blood cell. Which of the following best justifies the claim that the primary structure of a protein determines its function?",
      ("The change of a single amino acid in the primary structure changes the interactions between the R groups, which changes the shape and the behavior of the protein.", "The sequence of amino acids determines the interactions that fold the protein, so a change in the sequence can change the shape and function."),
      [("The change in the nucleotide of the DNA adds a new peptide bond to the protein, which makes the protein longer.", "The substitution changes one amino acid and does not add a peptide bond."),
       ("The changed protein is made in a different organelle, which is why the shape of the protein is different.", "Hemoglobin is made on ribosomes as normal; the difference is in the amino acid sequence."),
       ("The fibers form because the DNA of the red blood cell is damaged, which makes the cell produce water-soluble proteins.", "The disease results from one amino acid difference in the protein, not from damage that makes the proteins water-soluble.")]),
    B("A scientist heats a solution of an enzyme until the enzyme loses its activity and then cools the solution. In some cases the enzyme regains its activity. Which of the following best justifies the claim that the primary structure of the protein contains the information for the correct shape?",
      ("The enzyme refolds to its functional shape because its sequence of amino acids determines the interactions that favor that shape.", "When the original shape is regained from the unfolded polypeptide, the sequence of amino acids must specify the shape."),
      [("The enzyme regains activity because heating breaks the peptide bonds, and cooling forms new peptide bonds in the correct order.", "Heating at these temperatures disrupts weak interactions and does not break peptide bonds."),
       ("The enzyme regains its activity because cooling adds new amino acids to the end of the polypeptide.", "Cooling does not add amino acids."),
       ("The enzyme regains activity because the temperature has no effect on the interactions of the amino acids.", "Heating does disrupt the weak interactions, which is why the activity was lost.")]),
    B("Two proteins from different species have a 90 percent identity of amino acid sequence, and both fold into nearly the same three-dimensional shape. Which of the following best justifies the claim that the sequence of amino acids determines the three-dimensional shape of a protein?",
      ("Proteins with very similar sequences of amino acids form very similar interactions between R groups, so they fold into similar shapes.", "Similar primary structures give similar patterns of interactions and therefore similar shapes."),
      [("The proteins are made by the same ribosomes, which shapes them in the same way.", "The sequence determines the shape and the ribosome only links the amino acids."),
       ("The proteins contain the same number of peptide bonds, which is why they have the same shape.", "The number of peptide bonds does not determine the shape; the sequence of amino acids does."),
       ("The proteins have a similar shape because both species have the same environment.", "The shape follows from the sequence and not from the environment of the species.")]),
], "justify the claim that the sequence of amino acids determines the shape and function of a protein", "fixed fact bank checked against CED 1.7", est=70)


# ============================ Practice 2 (시각 표현) ============================
@_retry
def bi_n_light_compensation_table(rng):
    ints = [0, 20, 40, 80, 160, 400]
    # 그늘 식물: 호흡 R, 최대 광합성 Pm, 반포화 광도 Ik; 양지 식물은 모두 더 크다
    Rs, Ps, Ks = pick(rng, [1.0, 1.5, 2.0]), pick(rng, [6.0, 8.0, 10.0]), pick(rng, [30.0, 40.0, 50.0])
    Ru, Pu, Ku = pick(rng, [4.0, 5.0, 6.0]), pick(rng, [22.0, 26.0, 30.0]), pick(rng, [120.0, 150.0, 180.0])
    net = lambda R, P, K, I: P * I / (K + I) - R   # noqa: E731  (직각쌍곡선 광반응 곡선)
    shade = [net(Rs, Ps, Ks, I) for I in ints]; sun = [net(Ru, Pu, Ku, I) for I in ints]
    # 경로 1: 보상점을 식으로(P I/(K+I)=R → I = R K/(P−R)); 경로 2: 표의 인접한 두 값의 부호 변화 구간
    cs = Rs * Ks / (Ps - Rs); cu = Ru * Ku / (Pu - Ru)
    def bracket(v):
        for i in range(len(v) - 1):
            if v[i] < 0 <= v[i + 1]:
                return ints[i], ints[i + 1]
        return None
    bs, bu = bracket(shade), bracket(sun)
    if bs is None or bu is None or not (bs[0] <= cs <= bs[1]) or not (bu[0] <= cu <= bu[1]) or cs >= cu or sun[-1] <= shade[-1] + 3 or not any(a > 0 > b for a, b in zip(shade, sun)):
        raise ValueError("shape")
    rows = [[str(I), f"{a:.1f}", f"{b:.1f}"] for I, a, b in zip(ints, shade, sun)]
    stim = tbl("Net oxygen exchange of two leaves at different light intensities", ["Light intensity (micromoles of photons per square meter per second)", "Shade leaf: net O₂ production (microliters per minute; negative = net uptake)", "Sun leaf: net O₂ production (microliters per minute; negative = net uptake)"], rows)
    stem = ("A researcher measured the net rate of oxygen production by a leaf from a plant that grows in the shade and by a leaf from a plant that grows in full sun at several light intensities. The results are shown in the table. "
            "Which of the following best describes the data?")
    key_t = "The shade leaf reaches a net oxygen production of zero at a lower light intensity than the sun leaf, so it can gain more oxygen at low light even though the sun leaf makes more oxygen at high light."
    wrong = [("The sun leaf reaches a net oxygen production of zero at a lower light intensity than the shade leaf, because it produces more oxygen at 400 micromoles of photons.", "A higher maximum rate does not give a lower light compensation point; the sun leaf is still taking up oxygen at intensities where the shade leaf already makes a net gain."),
             ("Both leaves have the same light compensation point, because both have a net oxygen production that increases with the intensity.", "The light intensity at which the net production is zero differs: it is lower for the shade leaf."),
             ("The shade leaf does not respire in the dark, because its net oxygen production at an intensity of zero is the lowest of the two.", "At zero light the net value is negative for both leaves, which shows respiration in both; the values show the uptake of oxygen by respiration.")]
    kw = f"The net production changes from negative to positive between {bs[0]} and {bs[1]} for the shade leaf and between {bu[0]} and {bu[1]} for the sun leaf, so the light compensation point is lower for the shade leaf; at 400 the sun leaf makes more oxygen ({sun[-1]:.1f} versus {shade[-1]:.1f})."
    key, ds = sentence_options(key_t, kw, wrong)
    return mk("bi_n_light_compensation_table", "3.4", "2.B", stem, key, ds, rng, concept="relate the light compensation point and the maximum rate of photosynthesis of two leaves to their net oxygen production", path="the compensation intensity from the rectangular hyperbola vs the sign change between adjacent rows of the table",
              thinking=_steps("Find the light intensity at which the net oxygen production changes from negative to positive for each leaf", "Compare the leaves at low and at high light intensities"), stim=stim, est=100, facts=[f"R={Rs},{Ru}", f"P={Ps},{Pu}", f"K={Ks},{Ku}"], kwhy=kw, judgment="compare the zero crossings and the high-light values of two curves in a table")


@_retry
def bi_n_drift_table(rng):
    sizes = [25, 250, 2500]; rng.shuffle(sizes)
    names = ["Population X", "Population Y", "Population Z"]
    gens = [0, 10, 20]
    tracks = {}
    for nm, N in zip(names, sizes):
        amp = {25: pick(rng, [0.22, 0.26, 0.30]), 250: pick(rng, [0.07, 0.09]), 2500: pick(rng, [0.01, 0.02])}[N]
        sgn = pick(rng, [1, -1]); p = [0.50, round(0.50 + sgn * amp, 2), round(0.50 + sgn * amp * pick(rng, [1.2, 1.5]) * (1 if N == 25 else -1 if N == 250 else 1), 2)]
        tracks[nm] = (N, p)
    # 경로 1: 세대 0→20 변화의 크기와 집단 크기의 순서; 경로 2: 변화 크기 순위가 크기 역순위와 일치하는지
    chg = {nm: abs(t[1][2] - t[1][0]) for nm, t in tracks.items()}
    order_n = sorted(tracks, key=lambda nm: tracks[nm][0]); order_c = sorted(tracks, key=lambda nm: -chg[nm])
    agree(1.0 if order_n == order_c else 0.0, 1.0, 0, "mono")
    if any(not (0.0 < v < 1.0) for t in tracks.values() for v in t[1]) or len({round(c, 2) for c in chg.values()}) < 3:
        raise ValueError("range")
    small = order_n[0]; big = order_n[-1]
    rows = [[nm, str(tracks[nm][0])] + [f"{v:.2f}" for v in tracks[nm][1]] for nm in names]
    stim = tbl("Frequency of allele A in three populations of the same species", ["Population", "Number of breeding individuals", "Frequency of A in generation 0", "Frequency of A in generation 10", "Frequency of A in generation 20"], rows)
    stem = ("Three populations of the same species of beetle live on separate islands. There is no migration or mutation, and the allele A is neutral, which means that it does not affect survival or reproduction. "
            "The table shows the number of breeding individuals and the frequency of the allele A in three generations. Which of the following best explains the pattern in the data?")
    key_t = f"The frequency of A changed the most in {small}, because genetic drift causes larger random changes in the allele frequency in a population with fewer breeding individuals."
    wrong = [(f"The frequency of A changed the most in {big}, because a larger population has more individuals that can carry new alleles for A.", f"Drift has a larger effect in a small population, and {big} changed the least."),
             ("The frequency of A changed by the same amount in each population, because the allele is neutral and so nothing can change its frequency.", "A neutral allele still changes in frequency by chance, and the table shows different amounts of change."),
             (f"The frequency of A changed in {small} because natural selection favored the allele on that island.", "The allele is stated to be neutral, so selection does not explain the change.")]
    kw = f"The change in the frequency of A from generation 0 to generation 20 is " + ", ".join(f"{abs(tracks[nm][1][2] - tracks[nm][1][0]):.2f} in {nm} (N = {tracks[nm][0]})" for nm in order_n) + f", so the smallest population changed the most, as expected for genetic drift."
    key, ds = sentence_options(key_t, kw, wrong)
    return mk("bi_n_drift_table", "7.4", "2.B", stem, key, ds, rng, concept="relate the size of a population to the size of random changes in the frequency of a neutral allele in a table", path="the sizes of the changes in frequency are ranked and compared with the ranking of the population sizes in reverse order",
              thinking=_steps("Find the change in the frequency of the allele in each population between the first and the last generation", "Relate the size of the change to the number of breeding individuals"), stim=stim, est=100, facts=[f"sizes={sizes}"], kwhy=kw, judgment="relate the size of a change in a table to the size of the population")


@_retry
def bi_n_linkage_table(rng):
    linked = rng.randrange(2) == 0
    n = pick(rng, [500, 600, 800, 1000])
    if linked:
        rf = pick(rng, [0.08, 0.12, 0.16, 0.20, 0.24]); rec = int(round(n * rf)); par = n - rec
        counts = [par // 2 + pick(rng, [-6, -3, 0, 3, 6]), rec // 2 + pick(rng, [-3, 0, 3]), rec // 2 + pick(rng, [-3, 0, 3]), 0]
        counts[3] = n - sum(counts[:3]); order = [0, 1, 2, 3]
        parental = [counts[0], counts[3]]; recomb = [counts[1], counts[2]]
        # 보기 좋게: 두 친형 표현형이 큰 값
        counts = [parental[0], recomb[0], recomb[1], parental[1]]
    else:
        base = n // 4; counts = [base + pick(rng, [-10, -5, 0, 5, 10]) for _ in range(3)]; counts.append(n - sum(counts))
        parental = [counts[0], counts[3]]; recomb = [counts[1], counts[2]]
    # 경로 1: 재조합 비율 < 0.5 이고 카이제곱 > 임계값(df=3, 0.05 → 7.81) 이면 연관; 경로 2: 친형 표현형 합이 전체의 절반을 얼마나 넘는지
    exp = n / 4; chi = sum((c - exp) ** 2 / exp for c in counts); frac_par = (parental[0] + parental[1]) / n
    is_linked = chi > 7.81
    agree(1.0 if is_linked == (frac_par > 0.55) else 0.0, 1.0, 0, "classify"); agree(1.0 if is_linked == linked else 0.0, 1.0, 0, "gen")
    rfp = 100.0 * (recomb[0] + recomb[1]) / n
    rows = [["Gray body, long wings", str(counts[0])], ["Gray body, vestigial wings", str(counts[1])], ["Black body, long wings", str(counts[2])], ["Black body, vestigial wings", str(counts[3])]]
    stim = tbl("Phenotypes of the offspring of a testcross", ["Phenotype of the offspring", "Number of offspring"], rows)
    stem = (f"A fruit fly that is heterozygous for body color and for wing length was crossed with a fly that is homozygous recessive for both genes (black body, vestigial wings). The heterozygous parent came from a cross of a gray, long-winged fly and a black, vestigial-winged fly. "
            f"A total of {n} offspring were counted and are shown in the table. Which of the following is the best conclusion from the data?")
    if linked:
        key_t = f"The two genes are linked, because the parental phenotypes (gray, long and black, vestigial) are much more common than the recombinant phenotypes, and the recombination frequency is about {rfp:.0f}%."
        wrong = [("The two genes assort independently, because all four phenotypes appear among the offspring.", "Independent assortment predicts four phenotypes in about equal numbers; unequal numbers with the parental types more common show linkage."),
                 (f"The two genes are linked, because the recombination frequency is about {100 - rfp:.0f}%.", "The recombination frequency is the percent of recombinant offspring, which is the smaller group here, and not the percent of parental offspring."),
                 ("The two genes are on different chromosomes, because the recombinant phenotypes appear at all.", "Recombinant offspring also arise from crossing over between linked genes, so their presence does not show independent assortment.")]
        kw = f"The parental phenotypes make up {100 * frac_par:.0f}% of the offspring and the recombinants {rfp:.0f}%, which is not the 50% expected for independent assortment, so the genes are linked."
    else:
        key_t = "The two genes assort independently, because the four phenotypes appear in nearly equal numbers, as expected for genes on different chromosomes."
        wrong = [("The two genes are linked, because the number of offspring with the parental phenotypes is the same as the number with recombinant phenotypes.", "Equal numbers of parental and recombinant offspring indicate that the recombination frequency is 50%, which is what independent assortment gives."),
                 (f"The two genes are tightly linked with a recombination frequency of about {rfp / 2:.0f}%.", f"The recombinant offspring make up about {rfp:.0f}% of the total, which is close to 50% and not a low percent."),
                 ("The genes cannot be on the same chromosome, because a testcross can show only dominant phenotypes.", "A testcross with a homozygous recessive parent shows the genotype of the gametes of the other parent through all of the phenotypes, including recessive ones.")]
        kw = f"The four phenotypes are within a few offspring of {exp:.0f} each (chi-square {chi:.1f}, below 7.81 for 3 degrees of freedom), and the recombinants are {rfp:.0f}% of the offspring, so the genes assort independently."
    key, ds = sentence_options(key_t, kw, wrong)
    return mk("bi_n_linkage_table", "5.3", "2.B", stem, key, ds, rng, concept="decide from testcross offspring counts whether two genes are linked or assort independently", path="the chi-square statistic against the critical value for 3 degrees of freedom vs the fraction of offspring with parental phenotypes",
              thinking=_steps("Compare the observed counts with the 1:1:1:1 ratio expected for independent assortment", "If the parental phenotypes are more common, estimate the recombination frequency"), stim=stim, est=100, facts=[f"counts={counts}", f"n={n}"], kwhy=kw, judgment="compare four observed counts with the expected ratio for independent assortment")


@_retry
def bi_n_tonicity_volume_table(rng):
    sols = sorted(rng.sample([0.05, 0.10, 0.15, 0.20, 0.30, 0.40, 0.50, 0.60], 4))
    c0 = pick(rng, [0.20, 0.25, 0.30])    # 세포의 용질 농도(M)
    # 상대 부피: 등장에서 1.00, 저장에서 증가, 고장에서 감소(상한/하한)
    vol = lambda c: round(1.0 + 0.9 * (c0 - c) / (c0 + c), 2)  # noqa: E731
    vals = [vol(c) for c in sols]
    if any(v <= 0.3 for v in vals) or len({v for v in vals}) < 4 or not any(c < c0 for c in sols) or not any(c > c0 for c in sols):
        raise ValueError("shape")
    # 경로 1: 부호 규칙; 경로 2: 상대 부피 > 1 이면 저장, < 1 이면 고장
    hypo = [c for c, v in zip(sols, vals) if v > 1.0]; hyper = [c for c, v in zip(sols, vals) if v < 1.0]
    agree(1.0 if all(c < c0 for c in hypo) and all(c > c0 for c in hyper) else 0.0, 1.0, 0, "tonic")
    rows = [[f"{c:.2f}", f"{v:.2f}"] for c, v in zip(sols, vals)]
    stim = tbl("Relative volume of animal cells after 30 minutes in solutions of a solute that cannot cross the membrane", ["Concentration of the solute in the solution (M)", "Relative volume of the cells (initial volume = 1.00)"], rows)
    ask = pick(rng, ["hypo", "hyper"])
    target = pick(rng, hypo if ask == "hypo" else hyper)
    stem = ("Animal cells with the same initial volume were placed in solutions of different concentrations of a solute that cannot cross the plasma membrane. After 30 minutes the relative volume of the cells in each solution was measured. The results are shown in the table. "
            f"Which of the following is the best explanation for the volume of the cells in the solution with a concentration of {target:.2f} M?")
    if ask == "hypo":
        key_t = "The solution is hypotonic to the cells, so water moved into the cells by osmosis and the volume increased."
        wrong = [("The solution is hypertonic to the cells, so water moved into the cells by osmosis and the volume increased.", "Water moves toward the region of higher solute concentration; a hypertonic solution would draw water out of the cells."),
                 ("The solution is hypotonic to the cells, so the solute moved into the cells by diffusion and the volume increased.", "The solute cannot cross the membrane, so only water moves."),
                 ("The solution is isotonic to the cells, so water moved into the cells until the volume doubled.", "In an isotonic solution there is no net movement of water and the volume stays at about 1.00.")]
        kw = f"The relative volume in the {target:.2f} M solution is above 1.00, so there was a net movement of water into the cells; this happens when the solution has a lower solute concentration than the cells (hypotonic)."
    else:
        key_t = "The solution is hypertonic to the cells, so water moved out of the cells by osmosis and the volume decreased."
        wrong = [("The solution is hypotonic to the cells, so water moved out of the cells by osmosis and the volume decreased.", "Water moves from lower to higher solute concentration; a hypotonic solution would give a net movement into the cells."),
                 ("The solution is hypertonic to the cells, so the solute moved out of the cells by diffusion and the volume decreased.", "The solute cannot cross the membrane, so only water moves."),
                 ("The solution is isotonic to the cells, so water moved out of the cells until the cells were empty.", "In an isotonic solution there is no net movement of water and the volume stays at about 1.00.")]
        kw = f"The relative volume in the {target:.2f} M solution is below 1.00, so there was a net movement of water out of the cells; this happens when the solution has a higher solute concentration than the cells (hypertonic)."
    key, ds = sentence_options(key_t, kw, wrong)
    return mk("bi_n_tonicity_volume_table", "2.7", "2.B", stem, key, ds, rng, concept="relate the change in cell volume to the tonicity of the solution and the direction of net water movement", path="the sign of the volume change relative to 1.00 vs the sign of the difference between the solution concentration and the generating cell concentration",
              thinking=_steps("Compare the relative volume with 1.00 to find the direction of the net movement of water", "Relate the direction to the solute concentration of the solution compared with the cells"), stim=stim, est=95, facts=[f"c0={c0}", f"ask={ask}", f"target={target}"], kwhy=kw, judgment="infer tonicity from a change in volume in a table")


@_retry
def bi_n_cell_cycle_dna_table(rng):
    # 유세포 분석: 2C, 2C-4C(S), 4C 세포의 백분율. 대조군과 처리군; 처리군은 G1/S 또는 G2/M 에서 정체
    arrest = pick(rng, ["G2/M", "G1"])
    ctrl = [pick(rng, [52, 55, 58]), pick(rng, [18, 20, 22])]; ctrl.append(100 - sum(ctrl))
    if arrest == "G2/M":
        trt = [pick(rng, [18, 22, 25]), pick(rng, [10, 12, 15])]; trt.append(100 - sum(trt))
    else:
        trt = [pick(rng, [82, 86, 88]), pick(rng, [5, 6, 8])]; trt.append(100 - sum(trt))
    # 경로 1: 처리군에서 가장 크게 증가한 범주; 경로 2: 대조군과의 차이 부호
    diff = [t - c for t, c in zip(trt, ctrl)]; big = max(range(3), key=lambda i: diff[i])
    agree(1.0 if (big == 2) == (arrest == "G2/M") and (big == 0) == (arrest == "G1") else 0.0, 1.0, 0, "arrest")
    rows = [["Control", *[str(v) for v in ctrl]], ["Cells treated with drug Q", *[str(v) for v in trt]]]
    stim = tbl("Percent of cells with each amount of DNA in a culture of dividing cells", ["Culture", "Percent of cells with 2C DNA", "Percent of cells with DNA between 2C and 4C", "Percent of cells with 4C DNA"], rows)
    stem = ("A culture of dividing cells was treated with drug Q for 24 hours, and the amount of DNA in each cell was measured. Cells with 2C of DNA have not replicated their DNA, and cells with 4C of DNA have completed the replication of their DNA. "
            "The table shows the percent of cells with each amount of DNA in the control culture and in the treated culture. Which of the following is the best explanation for the data?")
    if arrest == "G2/M":
        key_t = "Drug Q blocks cells after the replication of their DNA, in G2 or in mitosis, so cells accumulate with 4C of DNA."
        wrong = [("Drug Q blocks the replication of DNA, so cells accumulate with 4C of DNA.", "If the replication of DNA were blocked, the cells would not reach 4C and the percent of cells with 2C would increase."),
                 ("Drug Q blocks cells before the S phase, in G1, so cells accumulate with 4C of DNA.", "Cells blocked in G1 have 2C of DNA, not 4C."),
                 ("Drug Q has no effect on the cell cycle, because the percent of cells with 2C of DNA decreased.", "The percent of cells in each phase differs from the control, so the drug changed the cell cycle.")]
        kw = f"The percent of cells with 4C of DNA increased from {ctrl[2]} to {trt[2]}, which shows that cells completed the replication of their DNA but did not finish mitosis."
    else:
        key_t = "Drug Q blocks cells before the replication of their DNA, in G1, so cells accumulate with 2C of DNA."
        wrong = [("Drug Q blocks cells after the replication of their DNA, so cells accumulate with 2C of DNA.", "Cells that have replicated their DNA have 4C of DNA, not 2C."),
                 ("Drug Q blocks the separation of the chromosomes in mitosis, so cells accumulate with 4C of DNA.", "The percent of cells with 4C of DNA decreased compared with the control."),
                 ("Drug Q speeds up the S phase, so the percent of cells with DNA between 2C and 4C is the highest.", "The percent of cells with DNA between 2C and 4C is lower in the treated culture than in the control.")]
        kw = f"The percent of cells with 2C of DNA increased from {ctrl[0]} to {trt[0]}, which shows that cells stayed before the replication of their DNA."
    key, ds = sentence_options(key_t, kw, wrong)
    return mk("bi_n_cell_cycle_dna_table", "4.6", "2.B", stem, key, ds, rng, concept="locate the point of arrest of the cell cycle from the distribution of DNA content in treated and control cultures", path="the category with the largest increase over the control vs the category that matches the generating arrest point",
              thinking=_steps("Relate the three amounts of DNA to the G1, S and G2/M phases", "Compare the treated culture with the control to find which category increased"), stim=stim, est=100, facts=[f"arrest={arrest}", f"ctrl={ctrl}", f"trt={trt}"], kwhy=kw, judgment="link the distribution of DNA content to the phase where cells accumulate")


STAGE_O_MC = ["bi_n_inhibitor_types", "bi_n_artificial_selection", "bi_n_light_calvin", "bi_n_water_cohesion", "bi_n_gene_regulation_euk", "bi_n_claim_enzyme_temperature", "bi_n_predict_active_site",
              "bi_n_predict_bottleneck", "bi_n_justify_primary_structure", "bi_n_light_compensation_table", "bi_n_drift_table", "bi_n_linkage_table", "bi_n_tonicity_volume_table", "bi_n_cell_cycle_dna_table"]


# ===== BI3/BI4 생성 2차 단계 목록(2026-10-19): 1차 반려 원형을 뺀 재배정에서 재고에 없는 칸 =====
STAGE_B34B_MC = ["bi_endomembrane_path", "bi_gel_interpretation", "bi_n_artificial_selection", "bi_n_cell_cycle_dna_table", "bi_n_claim_enzyme_temperature", "bi_n_drift_table", "bi_n_gene_regulation_euk", "bi_n_inhibitor_types", "bi_n_justify_primary_structure", "bi_n_light_compensation_table", "bi_n_linkage_table", "bi_n_ploidy_dna_table", "bi_n_predict_active_site", "bi_n_predict_bottleneck", "bi_n_water_cohesion", "bi_organism_response_data"]
STAGE_B34B_SETS = ["bis_hw_set"]
STAGE_B34B_FRQ = ["bif_q5_pyramid"]


# ============================ 4문항 세트(BI4 의 네 번째 세트 원형) ============================
def bis_n_cellcycle_set(rng):
    """세트: 양파 뿌리 끝 세포 수 표 → 서술(4.B)·유사분열 지수(5.A)·전기에 쓰는 시간(5.A)·방추사 억제 예측(6.E)."""
    from bio_p0_f import _set
    for _ in forever():
        n = pick(rng, [300, 400, 500]); T = pick(rng, [20, 24, 30])
        fr = {"Interphase": pick(rng, [0.70, 0.72, 0.76, 0.80]), "Prophase": pick(rng, [0.10, 0.12, 0.14]), "Metaphase": pick(rng, [0.05, 0.06, 0.07]), "Anaphase": pick(rng, [0.03, 0.04]), "Telophase": pick(rng, [0.03, 0.04, 0.05])}
        counts = {k: int(round(v * n)) for k, v in fr.items()}
        counts["Interphase"] = n - sum(v for k, v in counts.items() if k != "Interphase")
        names = list(counts)
        mitotic = n - counts["Interphase"]
        if not (counts["Prophase"] > counts["Metaphase"] > counts["Anaphase"] and counts["Telophase"] != counts["Anaphase"] and 0.15 <= mitotic / n <= 0.35):
            continue
        break
    # 독립 경로: 단계별 수의 합과 n 의 비교, 지수는 두 방식(유사분열 세포의 비율 vs 1 - 간기 비율)
    agree(sum(counts.values()), n, 0, "n"); mi1 = 100 * mitotic / n; mi2 = 100 * (1 - counts["Interphase"] / n); agree(mi1, mi2, 1e-9, "mi")
    tp = T * counts["Prophase"] / n; tp2 = T * (counts["Prophase"] / n); agree(tp, tp2, 1e-9, "tp")
    stim = tbl("Number of cells in each stage in a sample of cells from an onion root tip", ["Stage of the cell cycle", "Number of cells"], [[k, str(counts[k])] for k in names])
    intro = f"A student counted the cells in each stage of the cell cycle in a sample of {n} cells from the growing tip of an onion root. The cell cycle of these cells takes {T} hours. The table shows the number of cells in each stage."
    k1, d1 = sentence_options("Most of the cells are in interphase, and the number of cells decreases from prophase to metaphase to anaphase.", f"{counts['Interphase']} of the {n} cells are in interphase, and the numbers are {counts['Prophase']}, {counts['Metaphase']} and {counts['Anaphase']} in prophase, metaphase and anaphase.",
                              [("The cells are spread equally among all of the stages of the cell cycle.", "The numbers in the table are very different from one another."), ("Most of the cells are in mitosis, because a growing root tip divides all of the time.", "Fewer than half of the cells are in a stage of mitosis."),
                               ("Most of the cells are in telophase, because the cells are about to divide.", "Only a small number of cells are in telophase.")])
    q1 = mk("bis_n_cellcycle_set_q1", "4.6", "4.B", "Which statement best describes the data in the table?", k1, d1, rng, concept="describe the distribution of cells among the stages of the cell cycle in a table", path="sum of the stage counts vs the sample size and the ordering of the counts", material=MAT_TABLE("the number of cells in each stage"), facts=[f"n={n}", f"counts={counts}"], est=65)
    pairs = [("Gives the percent of cells in interphase instead of the percent in mitosis.", 100 * counts["Interphase"] / n), ("Gives the number of cells in mitosis instead of the percent of the cells.", float(mitotic)), ("Divides the number of cells in prophase by the sample size.", 100 * counts["Prophase"] / n), ("Divides the number of cells in mitosis by the number of cells in interphase.", 100 * mitotic / counts["Interphase"])]
    k2, d2 = val_opts(mi1, pairs, lambda v: f"{v:.1f}%", gap=0.5, rel=0.08)
    q2 = mk("bis_n_cellcycle_set_q2", "4.6", "5.A", "The mitotic index is the percent of the cells in the sample that are in a stage of mitosis (prophase, metaphase, anaphase or telophase). What is the mitotic index of the sample?", k2, d2, rng, concept="calculate the mitotic index from the counts in a table", path="the fraction of cells in mitosis vs one minus the fraction in interphase", material=MAT_TABLE("the number of cells in each stage"), facts=[f"n={n}", f"mitotic={mitotic}"], est=75,
            kwhy=f"The cells in mitosis are {counts['Prophase']}+{counts['Metaphase']}+{counts['Anaphase']}+{counts['Telophase']}={mitotic} of {n}, which is {mi1:.1f}%.")
    k3, d3 = sentence_options("Count more samples from different root tips and combine the counts, because a larger sample reduces the effect of random variation.", "Repeating the counts with more samples from different roots gives a more reliable estimate of the percent of cells in each stage.",
                              [("Count only the cells that are in prophase, because that stage is the easiest one to recognize.", "Counting only one stage cannot give the percent of cells in mitosis, which needs all of the stages."), ("Count the cells in a smaller part of the same sample, because fewer cells are easier to count correctly.", "A smaller number of cells increases the effect of random variation."),
                               ("Count the cells only in the part of the root that is farthest from the tip, because those cells are the largest.", "The cells that divide are in the growing tip, so counting elsewhere would not measure the rate of division.")])
    q3 = mk("bis_n_cellcycle_set_q3", "4.6", "3.D", "The student wants the estimate of the mitotic index to be more reliable. Which change to the procedure would be best?", k3, d3, rng, concept="choose a change in the procedure that reduces random error in the counts of cells", path="fixed fact bank on sampling for a cell count", material=MAT_TABLE("the number of cells in each stage"), facts=[f"n={n}", f"T={T}"], est=70)
    k4, d4 = sentence_options("The percent of cells in metaphase would increase, because the chromosomes could not be pulled apart and the cells would stay in metaphase.", "Without spindle fibers the sister chromatids are not separated, so cells accumulate before anaphase.",
                              [("The percent of cells in anaphase would increase, because the chromosomes would be pulled apart more quickly.", "A drug that blocks the spindle fibers prevents the chromosomes from being pulled apart."), ("The percent of cells in interphase would decrease to zero, because all of the cells would enter mitosis.", "Cells would not all enter mitosis, and the cells that are blocked would stay in metaphase."),
                               ("The percent of cells in telophase would increase, because the nuclei would form without separating the chromosomes.", "Telophase follows anaphase, and cells that cannot separate their chromosomes do not reach it.")])
    q4 = mk("bis_n_cellcycle_set_q4", "4.6", "6.E", "The student treats the root tip with a drug that prevents the formation of the spindle fibers and counts the cells again after several hours. Which prediction is best supported?", k4, d4, rng, concept="predict the effect of a drug that blocks the spindle on the stages of mitosis", path="the stage that requires the spindle fibers and the stage before it", material=MAT_TABLE("the number of cells in each stage"), facts=[f"n={n}"], est=70)
    return _set("bis_n_cellcycle_set", intro, stim, [q1, q2, q3, q4], "4.6", "4.B")


STAGE_O_SETS = ["bis_n_cellcycle_set"]

STAGE_B34C_MC = ["bi_control_choice_membrane"]
STAGE_B34C_SETS = ["bis_n_cellcycle_set"]

STAGE_B34D_SETS = ["bis_n_cellcycle_set"]
