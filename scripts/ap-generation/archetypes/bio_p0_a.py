"""AP Biology P0 원형 A — 단원 1(생명의 화학)·2(세포). 계산형은 두 독립 경로로 정답을 확인하고, 개념형은 고정 문장 은행(정답 1 + 이름 붙은 오개념)이다.
각 함수는 시드 rng 하나로 한 문항 팩을 만든다. 조건 불충족 시 ValueError(파이프라인이 시드를 건너뛴다)."""
from bio_common import *  # noqa: F401,F403

# ============================ 단원 1 ============================
bi_water_property = make_bank_archetype("bi_water_property", "1.1", "1.B", [
    B("A water strider rests on the surface of a pond without sinking. Which property of water best explains this observation?",
      ("Cohesion among water molecules, from hydrogen bonding, produces surface tension.", "Hydrogen bonds make water molecules cohere, so the surface resists being broken, which supports the insect."),
      [("Adhesion between water and the insect's legs pulls the insect upward through the surface.", "Confuses adhesion (water sticking to other surfaces) with the cohesion that creates surface tension."),
       ("Water's high specific heat keeps the pond surface from warming when the insect lands.", "Applies a thermal property of water to a mechanical situation that involves no heat transfer."),
       ("The nonpolar covalent bonds within each water molecule make the surface rigid like a solid.", "Water's covalent bonds are polar, and surface tension comes from hydrogen bonds between molecules."),
       ("Water's low density at the surface lets the insect float as ice would.", "Buoyancy from density does not explain surface tension, and liquid water at the surface is not less dense.")]),
    B("Ice floats on liquid water in a pond. Which statement best explains why?",
      ("In ice, hydrogen bonds hold the molecules in a lattice with more space between them, so ice is less dense.", "The rigid hydrogen-bonded lattice of ice spaces molecules farther apart than in liquid water, lowering density."),
      [("Hydrogen bonds break completely when water freezes, which lets the molecules spread apart.", "In ice the hydrogen bonds are maximal and stable, not broken; they are what fix the open lattice."),
       ("Molecules in ice are heavier than molecules in liquid water, so ice rises.", "Molecular mass is the same in ice and liquid water; the difference is spacing."),
       ("Cold water molecules become nonpolar and repel liquid water, pushing the ice upward.", "Water stays polar at all temperatures, and repulsion is not what makes ice float.")]),
    B("A person sweats on a hot day and feels cooler as the sweat evaporates. Which property of water is most directly responsible for the cooling?",
      ("Water's high heat of vaporization, so evaporating water removes a large amount of energy from the skin.", "Breaking hydrogen bonds to vaporize water requires a lot of energy, which is taken from the body surface."),
      [("Water's high specific heat, so sweat absorbs energy without ever evaporating.", "High specific heat describes resisting temperature change, not the energy taken up when water changes to vapor."),
       ("Cohesion, because water molecules stick together and carry heat away along the skin.", "Cohesion explains surface tension and water columns, not removal of heat by evaporation."),
       ("Condensation of sweat releases energy that cools the surface of the skin.", "Condensation releases energy and would warm the surface, the opposite of evaporative cooling.")]),
    B("Water travels upward in the xylem of a tall tree against gravity. Which pair of properties of water best explains this movement?",
      ("Cohesion between water molecules and adhesion of water to the walls of xylem vessels.", "Cohesion pulls the water column up as a chain, and adhesion to vessel walls helps hold it against gravity."),
      [("High specific heat and high heat of vaporization of water in the xylem.", "These thermal properties affect temperature regulation, not the upward movement of a water column."),
       ("Hydrophobic interactions between water and the lining of the xylem.", "Water is polar and is attracted to xylem walls; hydrophobic interactions would repel it."),
       ("Surface tension alone, because water forms a film that pushes itself upward.", "Surface tension is a result of cohesion at an air-water boundary and cannot by itself lift a column of water.")]),
    B("A large lake changes temperature much more slowly than the surrounding land during a seasonal change. Which property of water best accounts for this?",
      ("Water has a high specific heat, so it absorbs or releases a lot of energy for each degree of temperature change.", "Hydrogen bonding means a large energy input is needed to raise the temperature of water."),
      [("Water has a low specific heat, so it quickly equalizes with the air above it.", "Reverses the property: a low specific heat would make the lake change temperature faster than land."),
       ("Water has strong adhesion to soil, which keeps the lake temperature stable.", "Adhesion to soil does not regulate the temperature of a lake."),
       ("Water molecules are nonpolar, so heat from the air cannot enter the lake.", "Water is polar, and heat transfer does not depend on polarity in this way.")]),
], "link a property of water (cohesion, adhesion, specific heat, heat of vaporization, density of ice) to the situation it explains", "fixed fact bank checked against CED 1.1 (hydrogen bonding and properties of water); distractors are named misconceptions", est=60)

bi_water_solvent = make_bank_archetype("bi_water_solvent", "1.1", "1.A", [
    B("Table salt (NaCl) dissolves in water but vegetable oil does not. Which statement best describes why?",
      ("Water is polar and surrounds ions through partial charges, but it does not interact favorably with nonpolar oil.", "Polar water molecules interact with the Na+ and Cl- ions, while nonpolar oil molecules cannot form such interactions."),
      [("Water is nonpolar and mixes with substances of equal density, such as salt.", "Water is polar; solubility is not decided by density."),
       ("Oil molecules are too large to fit between water molecules, but salt is small enough.", "Solubility depends on polarity and interactions, not simply on the size of the molecule."),
       ("Salt forms covalent bonds with water but oil forms ionic bonds.", "Dissolving does not create covalent bonds with water, and oil has no ionic bonds.")]),
    B("Why does a molecule with many hydroxyl (-OH) groups tend to dissolve in water?",
      ("The polar -OH groups can form hydrogen bonds with water molecules.", "Hydroxyl groups are polar and can hydrogen bond to water, which makes the molecule hydrophilic."),
      [("The -OH groups are nonpolar and are attracted to the oxygen atoms of water.", "Hydroxyl groups are polar, not nonpolar."),
       ("The -OH groups form covalent bonds with water that make a new compound.", "Dissolving is based on weak interactions, not new covalent bonds."),
       ("Hydroxyl groups raise the density of the molecule above that of water.", "Density does not decide whether a molecule dissolves.")]),
    B("A student places a drop of oil in water and shakes the mixture. The oil rapidly forms separate droplets. Which statement best explains this?",
      ("Nonpolar oil molecules cannot form hydrogen bonds with water, so water molecules interact with each other and exclude the oil.", "Water molecules hydrogen bond with each other, which pushes nonpolar molecules together into droplets."),
      [("Oil molecules are attracted strongly to each other by ionic bonds that water cannot break.", "Oil is held together by weak nonpolar interactions, not ionic bonds."),
       ("Oil molecules react with water to form a new insoluble compound.", "Mixing oil and water is not a chemical reaction that forms a new compound."),
       ("Water molecules have a higher density, so they always force oil to form spheres.", "Droplet formation is caused by polarity differences and not by density differences.")]),
], "relate polarity and hydrogen bonding to solubility", "fixed fact bank checked against CED 1.1; each wrong option is a named solubility misconception", est=55)

bi_macromolecule_id = make_bank_archetype("bi_macromolecule_id", "1.3", "1.A", [
    B("A researcher isolates a polymer made of monomers that each contain a phosphate group, a five-carbon sugar, and a nitrogen-containing base. To which class of macromolecule does the polymer belong?",
      ("A nucleic acid", "Nucleotides consist of a phosphate, a pentose sugar, and a nitrogenous base."),
      [("A protein", "Proteins are made of amino acids, which have an amino group, a carboxyl group, and an R group."),
       ("A polysaccharide", "Polysaccharides are made of sugar monomers that lack phosphate groups and nitrogenous bases."),
       ("A triglyceride", "Triglycerides are made of glycerol and fatty acids and are not built from nucleotides.")]),
    B("A molecule is built from monomers that each have an amino group, a carboxyl group, and a variable R group, joined by peptide bonds. To which class of macromolecule does the molecule belong?",
      ("A protein", "Amino acids joined by peptide bonds make a polypeptide, which is a protein."),
      [("A nucleic acid", "Nucleic acids are built from nucleotides joined by phosphodiester bonds."),
       ("A carbohydrate", "Carbohydrates are built from monosaccharides joined by glycosidic bonds."),
       ("A phospholipid", "Phospholipids contain glycerol, fatty acids, and a phosphate group, not amino acids.")]),
    B("A large molecule is hydrolyzed and yields only glucose monomers, which were joined by glycosidic bonds. To which class of macromolecule did the large molecule belong?",
      ("A carbohydrate", "Glucose monomers linked by glycosidic bonds form a polysaccharide such as starch or cellulose."),
      [("A protein", "Proteins break down into amino acids, not glucose."),
       ("A nucleic acid", "Nucleic acids break down into nucleotides, not glucose."),
       ("A lipid", "Lipids are not polymers of glucose and are not held together by glycosidic bonds.")]),
    B("A molecule is formed by joining one glycerol and three fatty acids with ester linkages, and it is insoluble in water. To which class of macromolecule does the molecule belong?",
      ("A lipid", "A triglyceride is a lipid made of glycerol and three fatty acids; it is nonpolar and insoluble in water."),
      [("A carbohydrate", "Carbohydrates are made of sugars and are usually soluble in water."),
       ("A protein", "Proteins are polymers of amino acids and contain nitrogen in every monomer."),
       ("A nucleic acid", "Nucleic acids are polymers of nucleotides and contain phosphate and nitrogenous bases.")]),
], "identify a macromolecule class from its monomers or bonds", "fixed fact bank checked against CED 1.3 and 1.4-1.7; distractors name the confusion between classes", est=50)


@retry_sep
def bi_dehydration_count(rng):
    n = pick(rng, [12, 16, 20, 25, 30, 40, 50])
    kind = pick(rng, ["peptide", "starch"])
    # 독립 경로: 단량체를 하나씩 붙이는 반복(축합 횟수) vs 닫힌 식 n-1
    count = 0
    for _ in range(n - 1):
        count += 1
    agree(count, n - 1, 1e-9, "water")
    if kind == "peptide":
        stem = f"A ribosome joins {n} amino acids into one linear polypeptide by dehydration synthesis. How many water molecules are released in forming the polypeptide?"
        why_k = f"Each peptide bond forms by dehydration synthesis and releases one water. Joining {n} amino acids in a chain takes {n - 1} bonds, so {n - 1} water molecules are released."
        pairs = [("Assumes one water is released for every amino acid rather than for every bond.", n), ("Counts one extra bond because the chain has two ends.", n + 1), ("Assumes one water is released for every two amino acids.", n // 2), ("Subtracts two because both end amino acids are treated as unbonded.", n - 2)]
    else:
        stem = f"A starch molecule contains {n} glucose units in one unbranched chain. How many water molecules are used when the chain is completely hydrolyzed into individual glucose molecules?"
        why_k = f"Each glycosidic bond is broken by adding one water. A chain of {n} units has {n - 1} bonds, so {n - 1} water molecules are used."
        pairs = [("Assumes one water is used for every glucose unit rather than for every bond.", n), ("Counts one extra bond because the chain has two ends.", n + 1), ("Assumes hydrolysis releases water instead of using it, giving half the unit count.", n // 2), ("Subtracts two because both end units are treated as unbonded.", n - 2)]
    key, ds = int_opts(n - 1, pairs)
    return mk("bi_dehydration_count", "1.3", "5.A", stem, key, ds, rng, concept="count condensation or hydrolysis events in a linear polymer", path="stepwise loop joining monomers one at a time vs the closed form n-1",
              cond=[("a linear unbranched polymer with n monomers has n-1 linkages", "stem")], facts=[f"n={n}", f"kind={kind}"], judgment="relate the number of monomers to the number of bonds, then to the water molecules released or used", kwhy=why_k)


@retry_sep
def bi_chargaff(rng):
    a = pick(rng, [18, 20, 22, 24, 26, 28, 30, 32])
    g = 50 - a
    # 독립 경로: A=T, G=C, 합 100 을 선형계로 푼다
    sol = sp.solve([sp.Symbol("a") - a, sp.Symbol("a") - sp.Symbol("t"), sp.Symbol("g") - sp.Symbol("c"), sp.Symbol("a") + sp.Symbol("t") + sp.Symbol("g") + sp.Symbol("c") - 100], [sp.Symbol(x) for x in "atgc"], dict=True)[0]
    agree(float(sol[sp.Symbol("g")]), g, 1e-9, "g")
    pairs = [("Assumes the bases other than adenine split the remaining percentage unevenly, giving 100 minus the adenine percentage.", 100 - a), ("Sets guanine equal to adenine, ignoring that G pairs with C and A pairs with T.", a), ("Reports the combined percentage of guanine and cytosine as the guanine percentage.", 100 - 2 * a), ("Uses the sum of A and T as the guanine percentage.", 2 * a)]
    key, ds = val_opts(g, pairs, lambda v: f"{v:g}%", gap=1.5)
    stem = f"A sample of double-stranded DNA from a bacterium is analyzed. Adenine makes up {a}% of the bases in the sample. What percentage of the bases is guanine?"
    return mk("bi_chargaff", "1.6", "5.A", stem, key, ds, rng, concept="base-pairing rules give the percentage of each base in double-stranded DNA", path="linear system (A=T, G=C, total 100) solved symbolically vs the closed form 50 - A",
              cond=[("the DNA is double-stranded so A=T and G=C", "stem")], facts=[f"A={a}", f"G={g}"], judgment="apply complementary base pairing to a percentage composition", kwhy=f"In double-stranded DNA A pairs with T, so T is also {a}%. A and T together are {2 * a}%, leaving {100 - 2 * a}% for G and C, which are equal, so guanine is {g}%.")


@retry_sep
def bi_dna_hbonds(rng):
    L = rng.randint(8, 11)
    top = "".join(rng.choice("ATGC") for _ in range(L))
    if len(set(top)) < 3 or top.count("G") + top.count("C") < 2:
        raise ValueError("composition")
    bot = comp_dna(top)
    hb = sum(2 if c in "AT" else 3 for c in top)
    # 독립 경로: 짝 염기쌍 표로 센다
    pair_hb = {("A", "T"): 2, ("T", "A"): 2, ("G", "C"): 3, ("C", "G"): 3}
    agree(hb, sum(pair_hb[(t, b)] for t, b in zip(top, bot)), 1e-9, "hb")
    n_at = sum(c in "AT" for c in top); n_gc = L - n_at
    pairs = [("Counts only one hydrogen bond for every base pair.", L), ("Gives every base pair three hydrogen bonds, as for G-C pairs.", 3 * L), ("Gives every base pair two hydrogen bonds, as for A-T pairs.", 2 * L), ("Counts the hydrogen bonds of G-C pairs only.", 3 * n_gc), ("Counts the hydrogen bonds of A-T pairs only.", 2 * n_at)]
    key, ds = int_opts(hb, pairs)
    stim = strand_stim("Two complementary DNA strands joined by base pairing", ("Top strand", "5'", "3'", list(top)), ("Bottom strand", "3'", "5'", list(bot)))
    stem = "The diagram shows a short double-stranded DNA segment. How many hydrogen bonds hold the two strands together in this segment?"
    return mk("bi_dna_hbonds", "1.6", "5.A", stem, key, ds, rng, concept="count hydrogen bonds between complementary strands (A-T two, G-C three)", stim=stim, path="sum over base pairs using a pairing table vs 2*(A+T pairs)+3*(G+C pairs)",
              facts=[f"top={top}", f"hb={hb}"], judgment="read base pairs from a diagram and weight each pair by its number of hydrogen bonds", kwhy=f"The segment has {n_at} A-T pairs (2 hydrogen bonds each) and {n_gc} G-C pairs (3 each), so 2 x {n_at} + 3 x {n_gc} = {hb} hydrogen bonds.")


bi_protein_level = make_bank_archetype("bi_protein_level", "1.7", "1.B", [
    B("Heating egg white makes the proteins unfold and clump together, but the peptide bonds between amino acids stay intact. Which levels of protein structure are directly disrupted by the heat?",
      ("Secondary, tertiary, and quaternary structure, but not primary structure", "Heat breaks the weak interactions that fold the protein; the covalent sequence of amino acids is unchanged."),
      [("Primary structure only, because heat breaks the peptide bonds", "Peptide bonds are strong covalent bonds and are not broken by this mild heating."),
       ("Primary and secondary structure, but not tertiary structure", "Tertiary structure depends on weak interactions that are disrupted by heat, so it is changed."),
       ("None of the levels, because the amino acid sequence is unchanged", "A protein loses its folded structure when weak interactions are broken even if its sequence is the same.")]),
    B("In sickle cell disease a single amino acid in hemoglobin is replaced. Which level of protein structure is changed first by this substitution?",
      ("Primary structure, which can then alter higher levels of structure", "A different amino acid in the sequence changes primary structure, and the new R group changes folding and interactions."),
      [("Quaternary structure only, because hemoglobin has four subunits", "The substitution alters the amino acid sequence first; quaternary effects follow from it."),
       ("Secondary structure only, because the hydrogen bonds along the backbone are lost", "Backbone hydrogen bonds are not directly changed by replacing one R group."),
       ("No level of structure, because the substitution is only one amino acid", "Even one amino acid change alters primary structure and can change function.")]),
    B("A reducing agent breaks the disulfide bridges between cysteine R groups in a folded protein. Which level of structure is most directly affected?",
      ("Tertiary structure, because disulfide bridges help hold the three-dimensional fold", "Interactions between R groups, including disulfide bridges, stabilize tertiary structure."),
      [("Primary structure, because disulfide bridges are peptide bonds", "Disulfide bridges are bonds between R groups, not peptide bonds in the amino acid sequence."),
       ("Secondary structure only, because disulfide bridges form the alpha helix", "Alpha helices are stabilized by hydrogen bonds between backbone atoms, not by disulfide bridges."),
       ("Quaternary structure only, because disulfide bridges always connect separate polypeptides", "Disulfide bridges within one chain stabilize tertiary structure; they are not limited to quaternary structure.")]),
    B("Hemoglobin consists of four separate polypeptide chains that together carry oxygen. The arrangement of these four chains in one functional protein is an example of which level of protein structure?",
      ("Quaternary structure", "Quaternary structure is the association of two or more polypeptide subunits."),
      [("Primary structure", "Primary structure is the linear sequence of amino acids in one chain."),
       ("Secondary structure", "Secondary structure refers to local folding such as alpha helices and beta sheets."),
       ("Tertiary structure", "Tertiary structure is the folding of a single polypeptide chain.")]),
], "match a change or feature to a level of protein structure", "fixed fact bank checked against CED 1.7; wrong options are level-of-structure confusions", est=60)


@retry_sep
def bi_nucleic_polarity(rng):
    L = rng.randint(6, 8)
    s = "".join(rng.choice("ATGC") for _ in range(L))
    if len(set(s)) < 3 or s == revcomp(s) or s == comp_dna(s):
        raise ValueError("palin")
    key_t = revcomp(s)
    # 독립 경로: 3'->5' 상보 가닥을 만든 뒤 방향을 뒤집어 5'->3' 로 읽는다
    three_five = "".join(DNA_COMP[c] for c in s)
    agree(0, 0 if three_five[::-1] == key_t else 1, 1e-9, "rc")
    cands = [("Writes the complement in the same left-to-right order, which gives the 3' to 5' direction instead of 5' to 3'.", comp_dna(s)), ("Reverses the sequence without taking the complement.", s[::-1]), ("Swaps only A and T, leaves G and C unchanged, and then reverses the order.", "".join({"A": "T", "T": "A", "G": "G", "C": "C"}[c] for c in s)[::-1]), ("Uses uracil in place of thymine in the new DNA strand.", revcomp(s).replace("T", "U"))]
    seen = {key_t}
    ds = []
    for why, t in cands:
        if t in seen or t == s:
            continue
        seen.add(t)
        ds.append(Opt(f"5'-{t}-3'", False, why, None))
    if len(ds) < 3:
        raise ValueError("few")
    key = Opt(f"5'-{key_t}-3'", True, f"The strands are antiparallel. The complement of 5'-{s}-3' is 3'-{comp_dna(s)}-5', and written in the 5' to 3' direction it reads 5'-{key_t}-3'.", None)
    stem = f"One strand of a DNA molecule has the sequence 5'-{s}-3'. Which choice shows the complementary strand written in the 5' to 3' direction?"
    return mk("bi_nucleic_polarity", "1.6", "2.D", stem, key, ds, rng, concept="complementary antiparallel strand written 5' to 3'", path="reverse complement computed in one step vs complement then reversal", facts=[f"s={s}"], judgment="represent the partner strand of a DNA molecule with the correct polarity")


bi_amino_acid_property = make_bank_archetype("bi_amino_acid_property", "1.7", "2.B", [
    B("In many soluble proteins, amino acids with nonpolar R groups are found mostly in the interior of the folded protein. Which statement best explains this arrangement?",
      ("Nonpolar R groups cluster away from water, which is polar, so they are buried in the core.", "Hydrophobic R groups avoid contact with water and cluster together inside the folded protein."),
      [("Nonpolar R groups form hydrogen bonds with water, so they must be shielded from it.", "Nonpolar groups cannot form hydrogen bonds with water; that is why they avoid it."),
       ("Nonpolar R groups carry charges that attract each other in the core.", "Nonpolar R groups are uncharged and are held together by weak hydrophobic interactions."),
       ("Nonpolar R groups are larger than polar R groups and cannot fit on the surface.", "The location of R groups depends on polarity, not on size alone.")]),
    B("A mutation replaces a polar amino acid on the surface of an enzyme with a nonpolar amino acid. Which prediction is best supported?",
      ("The protein may fold differently or clump with other proteins because the surface now repels water.", "A hydrophobic R group on the surface can cause changes in folding or aggregation because it avoids water."),
      [("The primary structure of the protein will not change, because only one R group differs.", "Replacing an amino acid changes the amino acid sequence, which is the primary structure."),
       ("The enzyme will always function better because nonpolar groups bind substrate more tightly.", "A nonpolar surface group does not guarantee tighter binding and can reduce stability."),
       ("The protein will become a nucleic acid because the monomer changed.", "Changing one amino acid does not change the class of macromolecule.")]),
    B("Cysteine residues in different regions of a polypeptide can form covalent disulfide bridges. How would replacing both cysteines with alanine most likely affect the protein?",
      ("The bridges could no longer form, so the folded shape could be less stable.", "Alanine R groups cannot form disulfide bridges, which removes a stabilizing interaction in the tertiary structure."),
      [("The protein could not be translated because alanine has no codon.", "Alanine has codons, and the amino acid substitution does not prevent translation."),
       ("The disulfide bridges would form between the alanine R groups instead.", "Alanine has a methyl R group with no sulfur and cannot form a disulfide bridge."),
       ("The change would affect only the primary structure and never the shape of the protein.", "A change in primary structure can change which interactions are possible and so can change shape.")]),
], "relate R-group chemistry to protein folding and stability", "fixed fact bank checked against CED 1.7 (amino acid R groups and protein structure)", est=70)

bi_lipid_structure = make_bank_archetype("bi_lipid_structure", "1.5", "1.A", [
    B("Phospholipids have a hydrophilic head and two hydrophobic tails. When phospholipids are placed in water, which arrangement is most likely to form?",
      ("A bilayer with the heads facing the water and the tails facing each other", "Polar heads interact with water and nonpolar tails cluster away from water, forming a bilayer."),
      [("A single layer with the tails facing the water and the heads facing each other", "The nonpolar tails would then be exposed to water, which is unfavorable."),
       ("A random mixture with heads and tails evenly spread in all directions", "The amphipathic nature of phospholipids drives an ordered arrangement in water."),
       ("A bilayer with the heads facing each other and the tails facing the water", "This arrangement would expose the hydrophobic tails to the aqueous environment.")]),
    B("Animal fats such as butter are solid at room temperature, but plant oils such as olive oil are liquid. Which difference in structure best explains this?",
      ("Animal fats have mostly saturated fatty acids that pack tightly, while plant oils have unsaturated fatty acids with kinks.", "Saturated chains are straight and pack closely; double bonds in unsaturated chains create kinks that prevent tight packing."),
      [("Plant oils have fewer carbon atoms because they are made of carbohydrates.", "Plant oils are lipids made of fatty acids and are not made of carbohydrates."),
       ("Animal fats contain double bonds that cause kinks, so the molecules pack tightly.", "Kinks come from double bonds and prevent tight packing; this reverses the roles of the two fats."),
       ("Plant oils are polar molecules that dissolve in water at room temperature.", "Oils are nonpolar and do not dissolve in water.")]),
    B("Cholesterol is a steroid found in animal cell membranes. Which statement about its structure and function is most accurate?",
      ("It is a lipid with a ring structure that is embedded among phospholipids and affects membrane fluidity.", "Cholesterol is a four-ring steroid that interacts with phospholipid tails and helps regulate membrane fluidity."),
      [("It is a protein that forms channels through the membrane.", "Cholesterol is a lipid, not a protein."),
       ("It is a carbohydrate that marks the outside of the cell.", "Cell-surface markers are glycolipids or glycoproteins; cholesterol is not a carbohydrate."),
       ("It is a nucleic acid that stores information in the membrane.", "Cholesterol does not store information and is not a nucleic acid.")]),
], "relate lipid structure (saturation, amphipathic character, steroid rings) to behavior in water or membranes", "fixed fact bank checked against CED 1.5", est=60)

bi_carb_structure = make_bank_archetype("bi_carb_structure", "1.4", "1.A", [
    B("Starch and cellulose are both polymers of glucose, but humans can digest starch and not cellulose. Which statement best explains the difference?",
      ("The glucose units are joined by different types of glycosidic linkages, and human enzymes recognize only one type.", "Alpha linkages in starch and beta linkages in cellulose give different shapes, and human digestive enzymes fit alpha linkages only."),
      [("Cellulose is made of amino acids, so human protein-digesting enzymes cannot break it.", "Cellulose is a polysaccharide of glucose and not a protein."),
       ("Starch is a lipid, so it dissolves in the enzymes of the stomach.", "Starch is a polysaccharide and not a lipid."),
       ("Cellulose contains phosphate groups that block digestion.", "Cellulose is built from glucose units and does not contain phosphate groups.")]),
    B("Animals store glucose in the liver and muscles as glycogen, a highly branched polymer. What is an advantage of the branched structure?",
      ("Many ends are available at which enzymes can quickly release glucose when needed.", "Branching creates many terminal glucose units that can be removed in parallel."),
      [("Branching makes glycogen insoluble so that it can never be broken down.", "Glycogen is broken down when glucose is needed; branching speeds this up."),
       ("Branching converts glucose into fatty acids for long-term storage.", "Branching does not change glucose into fatty acids."),
       ("Branching lets glycogen carry genetic information.", "Genetic information is carried by nucleic acids and not by glycogen.")]),
    B("A glucose molecule and a fructose molecule are joined to form sucrose. Which statement describes this reaction?",
      ("A glycosidic bond forms by dehydration synthesis, and one water molecule is released.", "Two monosaccharides join through a glycosidic bond with the removal of one water molecule."),
      [("A peptide bond forms by hydrolysis, and one water molecule is used.", "Peptide bonds join amino acids, and hydrolysis breaks bonds rather than forming them."),
       ("A phosphodiester bond forms, and two water molecules are released.", "Phosphodiester bonds join nucleotides in nucleic acids."),
       ("An ester bond forms between the sugars, and no water is released.", "Joining two monosaccharides is a dehydration reaction that releases water.")]),
], "relate carbohydrate structure (linkage type, branching) to function and digestion", "fixed fact bank checked against CED 1.4", est=60)

bi_elements_life = make_bank_archetype("bi_elements_life", "1.2", "1.A", [
    B("In a classic experiment, bacteriophages were labeled with radioactive sulfur (35S) in one group and radioactive phosphorus (32P) in another. Which macromolecules were labeled in the two groups?",
      ("Protein was labeled by 35S and DNA was labeled by 32P.", "Sulfur occurs in some amino acids but not in DNA, and phosphorus is in the phosphate groups of DNA."),
      [("DNA was labeled by 35S and protein was labeled by 32P.", "Reverses the labels; DNA has phosphorus and no sulfur."),
       ("Both groups labeled protein because proteins contain both elements in every amino acid.", "Not every amino acid has sulfur, and phosphorus is the signature element of nucleic acids."),
       ("Both groups labeled DNA because phosphate and sulfur are in the sugar-phosphate backbone.", "The backbone contains phosphorus but no sulfur.")]),
    B("Which element is found in every amino acid and in every nucleotide but is absent from simple sugars and from triglycerides?",
      ("Nitrogen, which is found in amino groups and in nitrogenous bases", "Amino acids and nucleotide bases contain nitrogen, while sugars and triglycerides contain only carbon, hydrogen, and oxygen."),
      [("Phosphorus, which is found in every amino acid and every nucleotide", "Amino acids do not contain phosphorus as a standard component."),
       ("Sulfur, which is found in every amino acid and every nucleotide", "Sulfur occurs in only some amino acids and not in nucleotides."),
       ("Calcium, which is found in the backbone of every polymer of life", "Calcium is not part of the covalent backbone of the major macromolecules.")]),
    B("Which statement about the elements in biological molecules is most accurate?",
      ("Carbon forms the backbone of all four classes of macromolecules because it can form four covalent bonds.", "Carbon's ability to form four bonds allows chains and rings in carbohydrates, lipids, proteins, and nucleic acids."),
      [("Nucleic acids contain no phosphorus, which is found only in lipids.", "Phosphate groups are part of every nucleotide in nucleic acids."),
       ("Lipids and carbohydrates always contain nitrogen in their monomers.", "Lipids and carbohydrates generally contain only carbon, hydrogen, and oxygen."),
       ("Proteins are the only class of macromolecule containing hydrogen.", "All the major classes of organic molecules contain hydrogen.")]),
], "link elements to the macromolecules that contain them", "fixed fact bank checked against CED 1.2 and 1.3", est=55)


@retry_sep
def bi_macromolecule_table(rng):
    types = {"protein": {"C", "H", "O", "N", "S"}, "nucleic acid": {"C", "H", "O", "N", "P"}, "carbohydrate": {"C", "H", "O"}, "triglyceride": {"C", "H", "O"}}
    tgt = pick(rng, ["protein", "nucleic acid"])
    others = rng.sample([t for t in types if t != tgt and t in ("carbohydrate", "triglyceride", "protein", "nucleic acid")], 2)
    labs = ["X", "Y", "Z"]
    assign = [tgt] + others
    rng.shuffle(assign)
    rows = []
    for lab, t in zip(labs, assign):
        e = types[t]
        rows.append([lab] + ["Yes" if el in e else "No" for el in ("C", "H", "O", "N", "P", "S")])
    # 독립 경로: 표의 원소 집합으로 되짚어 맞는 유형을 판정(대상 유형의 표지 원소 조합이 유일한지)
    sig_t = types[tgt]
    match = [lab for lab, r in zip(labs, rows) if {el for el, v in zip(("C", "H", "O", "N", "P", "S"), r[1:]) if v == "Yes"} == sig_t]
    if len(match) != 1:
        raise ValueError("ambiguous")
    pos = labs.index(match[0])
    why = {l: assign[labs.index(l)] for l in labs}
    ds = [Opt(f"Sample {l}", False, f"Sample {l} has the element pattern of a {why[l]}, not of a {tgt}.", None) for l in labs if l != match[0]]
    ds.append(Opt("None of the samples", False, f"The table shows that sample {match[0]} has the elements expected for a {tgt}, so one sample fits.", None))
    key = Opt(f"Sample {match[0]}", True, f"A {tgt} contains " + ("carbon, hydrogen, oxygen, and nitrogen, with sulfur in some amino acids" if tgt == "protein" else "carbon, hydrogen, oxygen, nitrogen, and phosphorus") + f". Only sample {match[0]} has that pattern.", None)
    stim = tbl("Elements detected in three purified biological samples", ["Sample", "C", "H", "O", "N", "P", "S"], rows)
    stem = f"The table shows which elements were detected in three purified samples. Which sample is most likely a {tgt}?"
    return mk("bi_macromolecule_table", "1.3", "4.B", stem, key, ds, rng, concept="identify a macromolecule from its element composition", stim=stim, path="element sets read from the table vs the generating assignment", facts=[f"assign={assign}", f"target={tgt}"], judgment="describe the pattern in a table and relate it to the composition of a macromolecule class")


# ============================ 단원 2 ============================
@retry_sep
def bi_sa_v_ratio(rng):
    shape = pick(rng, ["cube", "sphere", "box"])
    if shape == "cube":
        s = pick(rng, [2, 4, 5, 10, 20, 25])
        SA, V = 6 * s * s, s ** 3
        desc = f"a cube-shaped cell with sides of {s} micrometers"
        sa_s = sp.symbols("s", positive=True); sym = (6 * sa_s ** 2) / (sa_s ** 3)
        agree(float(sym.subs(sa_s, s)), SA / V, 1e-9, "ratio")
        wrong = [("Divides volume by surface area instead.", V / SA), ("Uses 6s instead of 6s squared for the surface area.", 6 * s / V), ("Uses the area of one face as the surface area.", s * s / V)]
        form = f"surface area = 6s² = 6({s})² = {SA:,} µm² and volume = s³ = {s}³ = {V:,} µm³"
    elif shape == "sphere":
        r = pick(rng, [1, 2, 3, 4, 5, 6, 10])
        SA, V = 4 * math.pi * r * r, 4 / 3 * math.pi * r ** 3
        desc = f"a spherical cell with a radius of {r} micrometers"
        rr = sp.symbols("r", positive=True); sym = (4 * sp.pi * rr ** 2) / (sp.Rational(4, 3) * sp.pi * rr ** 3)
        agree(float(sym.subs(rr, r)), SA / V, 1e-9, "ratio")
        wrong = [("Divides volume by surface area instead.", V / SA), ("Uses the diameter in place of the radius in 3/r.", 3 / (2 * r)), ("Uses 2/r by treating the sphere like a circle.", 2 / r)]
        form = f"surface area = 4πr² = {SA:.1f} µm² and volume = (4/3)πr³ = {V:.1f} µm³"
    else:
        l, w, h = pick(rng, [(2, 2, 4), (4, 4, 8), (5, 5, 10), (2, 4, 8), (3, 3, 6), (2, 5, 10)])
        SA, V = 2 * l * h + 2 * l * w + 2 * w * h, l * w * h
        desc = f"a rectangular cell with length {l}, width {w}, and height {h} micrometers"
        wrong = [("Divides volume by surface area instead.", V / SA), ("Counts only the top and bottom faces for the surface area.", 2 * l * w / V), ("Adds the three dimensions instead of computing the surface area.", (l + w + h) / V)]
        form = f"surface area = 2lh + 2lw + 2wh = {SA} µm² and volume = lwh = {V} µm³"
    ratio = SA / V
    pairs = [(a, b) for a, b in wrong]
    key, ds = val_opts(ratio, pairs, lambda v: f"${hu(v, 2)}" + "\\text{ µm}^{-1}$", gap=0.02)
    stem = f"What is the surface-area-to-volume ratio of {desc}?"
    return mk("bi_sa_v_ratio", "2.2", "5.A", stem, key, ds, rng, concept="surface area to volume ratio of a cell from the formula sheet", path="symbolic ratio (sympy) vs direct numeric evaluation of the surface area and volume", facts=[f"shape={shape}", f"SA={SA:.4f}", f"V={V:.4f}"], judgment="select the right formulas from the sheet and divide surface area by volume", kwhy=f"{form[0].upper() + form[1:]}. The ratio is {SA:,.0f} / {V:,.0f} = {ratio:.2f} per µm.")


bi_sa_v_concept = make_bank_archetype("bi_sa_v_concept", "2.2", "1.C", [
    B("As a spherical cell grows larger, its volume increases faster than its surface area. Which consequence is most likely for a very large cell?",
      ("The cell cannot exchange materials across its membrane quickly enough to supply its whole volume.", "A decreasing surface area to volume ratio limits the rate of exchange relative to the cell's needs."),
      [("The cell membrane becomes impermeable to all molecules.", "Size does not change the permeability of the membrane; it changes the ratio of surface area to volume."),
       ("The cell's metabolic needs decrease in proportion to its surface area.", "Metabolic needs scale with volume, not surface area, so needs outpace exchange."),
       ("Diffusion distances inside the cell become shorter.", "A larger cell has longer, not shorter, diffusion distances from the membrane to the center.")]),
    B("The small intestine has many folds and finger-like projections called villi and microvilli. How do these structures most directly help the intestine function?",
      ("They increase the surface area available for absorption of nutrients.", "More membrane surface allows more transport proteins and faster absorption without a larger organ volume."),
      [("They decrease the surface area, which slows digestion so that food is absorbed completely.", "The folds increase the surface area; they do not slow digestion by shrinking it."),
       ("They make the intestinal cells impermeable to nutrients so that bacteria cannot enter.", "The structures are for absorption and do not make cells impermeable."),
       ("They increase the volume of the lumen so that more food can be stored.", "Folds and projections are surface-area adaptations and not storage features.")]),
    B("Two cells of the same shape have different sizes. Compared with the larger cell, the smaller cell has which characteristic?",
      ("A larger surface-area-to-volume ratio, which allows more efficient exchange per unit volume", "Smaller cells have more membrane surface for each unit of volume."),
      [("A smaller surface-area-to-volume ratio, which allows more efficient exchange per unit volume", "A smaller ratio would reduce exchange efficiency per unit volume."),
       ("The same surface-area-to-volume ratio, because both have the same shape", "The ratio changes with size even when the shape stays the same."),
       ("A larger volume-to-surface-area ratio, which speeds the movement of materials", "A larger volume-to-surface ratio means less membrane relative to the cell contents and slows exchange.")]),
], "relate surface-area-to-volume ratio to exchange limits and adaptations", "fixed fact bank checked against CED 2.2", est=60)

bi_membrane_structure = make_bank_archetype("bi_membrane_structure", "2.3", "1.A", [
    B("The fluid mosaic model describes the plasma membrane as a phospholipid bilayer with proteins embedded in it. Which statement correctly describes the proteins that span the bilayer?",
      ("They have hydrophobic regions in contact with the lipid tails and hydrophilic regions exposed to the water on each side.", "Transmembrane proteins are amphipathic, so each region sits where it is most compatible with its surroundings."),
      [("They are entirely hydrophilic and sit only on the surface of the membrane.", "Proteins that span the bilayer need nonpolar regions to be stable inside the lipid core."),
       ("They are entirely hydrophobic and are found only in the center of the bilayer.", "Spanning proteins also have hydrophilic regions that face the aqueous environments."),
       ("They are fixed in place so that the membrane cannot be fluid.", "Membrane proteins can move laterally, which is part of the fluid mosaic model.")]),
    B("A researcher adds a substance that increases the proportion of unsaturated fatty acids in membrane phospholipids. Which change in membrane properties is most likely?",
      ("The membrane becomes more fluid because kinked tails prevent tight packing.", "Unsaturated fatty acids have double bonds that create kinks and increase fluidity."),
      [("The membrane becomes more rigid because unsaturated tails pack tightly.", "Unsaturated tails pack less tightly because of their kinks."),
       ("The membrane becomes permeable only to ions because heads become nonpolar.", "The polar heads are unchanged by this treatment."),
       ("The membrane loses its bilayer structure because unsaturated lipids are not amphipathic.", "Phospholipids with unsaturated tails are still amphipathic and form bilayers.")]),
    B("Glycoproteins and glycolipids are found on the outer surface of animal cell membranes. Which function is most closely associated with these molecules?",
      ("Cell-to-cell recognition and signaling", "Carbohydrate chains on the outer surface act as identity markers and signal recognition sites."),
      [("Storage of genetic information", "Genetic information is stored in nucleic acids."),
       ("Production of ATP for the cell", "ATP is produced by the mitochondria and chloroplasts, not by cell-surface carbohydrates."),
       ("Formation of the rigid cell wall", "Animal cells do not have cell walls, and these molecules do not form one.")]),
], "apply the fluid mosaic model to the roles of lipids, proteins, and carbohydrates", "fixed fact bank checked against CED 2.3", est=60)

bi_membrane_permeability = make_bank_archetype("bi_membrane_permeability", "2.4", "1.B", [
    B("A researcher places artificial phospholipid vesicles in a solution containing oxygen gas, sodium ions, and glucose. Which substance is most likely to cross the vesicle membrane without the help of a transport protein?",
      ("Oxygen gas, because it is small and nonpolar", "Small nonpolar molecules pass through the hydrophobic core of the bilayer."),
      [("Sodium ions, because they are small", "Ions are charged and cannot pass through the hydrophobic core without a channel or carrier."),
       ("Glucose, because it is an energy source for the cell", "Glucose is large and polar and needs a transport protein."),
       ("All three substances equally, because the bilayer is not selective", "The bilayer is selectively permeable and blocks charged and large polar substances.")]),
    B("Which characteristic of a molecule makes it most likely to diffuse across the phospholipid bilayer directly?",
      ("It is small and uncharged with nonpolar character.", "The hydrophobic interior is permeable to small nonpolar molecules."),
      [("It is large, polar, and has an electric charge.", "Large charged polar molecules cannot cross the hydrophobic core."),
       ("It is an ion with a high concentration inside the cell.", "A concentration difference does not make a charged ion able to cross the lipid core."),
       ("It is hydrophilic so that it dissolves in the lipid tails.", "Hydrophilic substances do not dissolve in the lipid tails.")]),
    B("A cell membrane contains many channel proteins specific for water. What is the most likely effect of these proteins?",
      ("They speed up the passive movement of water across the membrane.", "Aquaporins speed up passive movement of water; they do not supply energy or reverse direction."),
      [("They actively pump water against its water potential gradient using ATP.", "Aquaporins are channels for passive movement and do not use ATP."),
       ("They prevent water from crossing the membrane at all.", "Aquaporins facilitate water movement; they do not block it."),
       ("They make the membrane permeable to every polar molecule.", "Channel proteins are specific for particular substances.")]),
], "predict which substances cross a selectively permeable membrane and how", "fixed fact bank checked against CED 2.4", est=55)


@retry_sep
def bi_transport_type(rng):
    types = {
        "simple diffusion": dict(grad="down", prot="No", atp="No"),
        "facilitated diffusion": dict(grad="down", prot="Yes", atp="No"),
        "active transport": dict(grad="up", prot="Yes", atp="Yes"),
    }
    names = list(types)
    tgt = pick(rng, names)
    sub = pick(rng, ["a solute", "molecule X", "ion Y", "compound Z"])
    t = types[tgt]
    c_in, c_out = (10, 40) if t["grad"] == "down" else (40, 10)
    rows = [["Direction relative to concentration gradient", "Down the gradient (high to low)" if t["grad"] == "down" else "Against the gradient (low to high)"], ["Membrane protein required", t["prot"]], ["ATP hydrolysis required", t["atp"]], ["Concentration outside the cell (mM)", str(c_out)], ["Concentration inside the cell (mM)", str(c_in)]]
    # 독립 경로: 표의 속성으로 규칙 판정
    def decide(r):
        down = r["grad"] == "down"
        if r["atp"] == "Yes" and not down:
            return "active transport"
        if down and r["prot"] == "Yes" and r["atp"] == "No":
            return "facilitated diffusion"
        if down and r["prot"] == "No" and r["atp"] == "No":
            return "simple diffusion"
        return "?"
    agree(0, 0 if decide(t) == tgt else 1, 1e-9, "type")
    why = {"simple diffusion": "Simple diffusion needs no protein and no ATP, but the data show that a protein or ATP is required."
           if (t["prot"] == "Yes" or t["atp"] == "Yes") else "", "facilitated diffusion": "Facilitated diffusion moves a solute down its gradient with a protein and no ATP, which does not match all of the data in the table.", "active transport": "Active transport moves a solute against its gradient using ATP, which does not match the data in the table."}
    nm = {"simple diffusion": "Simple diffusion", "facilitated diffusion": "Facilitated diffusion", "active transport": "Active transport", "osmosis": "Osmosis"}
    ds = [Opt(nm[k], False, why[k] or f"{nm[k]} does not match the combination of gradient, protein, and ATP data in the table.", None) for k in names if k != tgt]
    ds.append(Opt("Osmosis", False, "Osmosis is the diffusion of water, and the table describes the movement of a solute instead.", None))
    ks = {"simple diffusion": "The solute moves down its gradient with no protein and no ATP, which defines simple diffusion.", "facilitated diffusion": "The solute moves down its gradient through a membrane protein without ATP, which defines facilitated diffusion.", "active transport": "The solute moves against its gradient and ATP is required, which defines active transport."}
    key = Opt(nm[tgt], True, ks[tgt], None)
    stim = tbl(f"Observations of the movement of {sub} across the plasma membrane of a cell", ["Observation", "Result"], rows)
    stem = f"The table describes the movement of {sub} across the plasma membrane. Which type of transport is most consistent with the data?"
    return mk("bi_transport_type", "2.5", "4.B", stem, key, ds, rng, concept="classify membrane transport from gradient direction, protein requirement, and ATP use", stim=stim, path="rule-based classifier on the table attributes vs the generating label", facts=[f"type={tgt}"], judgment="describe data in a table and map the pattern to a transport mechanism")


@retry_sep
def bi_water_potential(rng):
    solute, i = pick(rng, [("sucrose", 1), ("sucrose", 1), ("NaCl", 2), ("glucose", 1)])
    C = pick(rng, [0.1, 0.2, 0.3, 0.4, 0.5])
    Tc = pick(rng, [20, 25, 30])
    Tk = Tc + 273
    psi = -i * C * R_BAR * Tk
    sy = sp.Symbol("x"); agree(float(-sp.Rational(str(i)) * sp.Rational(str(C)) * sp.Rational(str(R_BAR)) * Tk), psi, 1e-9, "psi")
    pairs = [("Omits the ionization constant i, which is 2 for NaCl, and uses i = 1.", -C * R_BAR * Tk if i != 1 else None), ("Uses the temperature in degrees Celsius instead of kelvins.", -i * C * R_BAR * Tc), ("Gives the solute potential a positive sign.", i * C * R_BAR * Tk), ("Multiplies by the pressure constant but forgets the molar concentration.", -i * R_BAR * Tk), ("Uses 0.831 in place of 0.0831 for the pressure constant.", -i * C * 0.831 * Tk)]
    key, ds = val_opts(psi, pairs, lambda v: f"${hu(v, 2)}" + "\\text{ bars}$", gap=0.03)
    stem = f"A student prepares a {C:g} M solution of {solute} in an open beaker at {Tc} °C. Using the formula sheet equation for solute potential, what is the water potential of the solution? (The ionization constant is {i} for {solute}.)"
    return mk("bi_water_potential", "2.7", "5.A", stem, key, ds, rng, concept="water potential of an open solution equals its solute potential, Psi_S = -iCRT", path="exact rational arithmetic (sympy) vs floating-point evaluation of -iCRT", facts=[f"i={i}", f"C={C}", f"T={Tk}", f"psi={psi:.4f}"], judgment="select the equation, convert temperature to kelvins, and apply the pressure potential of zero in an open container",
              kwhy=f"In an open container the pressure potential is zero, so the water potential equals the solute potential: Ψ = -iCRT = -({i})({C:g})(0.0831)({Tk}) = {psi:.2f} bars.")


@retry_sep
def bi_water_flow_direction(rng):
    for _ in forever():
        psp_c = rng.choice([0.0, 0.2, 0.4, 0.6])
        pss_c = rng.choice([-0.6, -0.8, -1.0, -1.2])
        psp_s = 0.0
        pss_s = rng.choice([-0.3, -0.5, -0.7, -0.9, -1.1])
        psi_c = psp_c + pss_c; psi_s = psp_s + pss_s
        naive_c, naive_s = pss_c, pss_s
        if abs(psi_c - psi_s) < 0.1 or abs(naive_c - naive_s) < 0.1:
            continue
        if (psi_c > psi_s) != (naive_c > naive_s):
            break
    into_cell = psi_s > psi_c
    naive_into = naive_s > naive_c
    key_t = "Water moves into the cell, because the solution has the higher water potential." if into_cell else "Water moves out of the cell, because the cell has the higher water potential."
    wrongs = [("Water moves out of the cell, because the cell has the higher water potential." if into_cell else "Water moves into the cell, because the solution has the higher water potential.", "Draws the right idea of potential but applies the comparison to the wrong side, so the direction is reversed."),
              (("Water moves out of the cell, because only the solute potentials matter and the cell's is higher." if naive_into is False else "Water moves into the cell, because only the solute potentials matter and the solution's is higher."), "Ignores the pressure potential of the cell and compares only solute potentials."),
              ("There is no net movement of water, because water potential is not related to water movement.", "Water moves from higher to lower water potential whenever the two differ."),
              ("Water moves toward the region of lower solute concentration regardless of pressure.", "Water moves toward the lower water potential, which is not decided by the solute concentration alone.")]
    wrongs = [w for w in wrongs if w[0] != key_t]
    key, ds = sentence_options(key_t, f"Ψ of the cell = Ψ_P + Ψ_S = {psp_c:g} + ({pss_c:g}) = {psi_c:g} bars; Ψ of the solution = {psp_s:g} + ({pss_s:g}) = {psi_s:g} bars. Water moves from higher to lower water potential, so it moves {'into' if into_cell else 'out of'} the cell.", wrongs)
    stim = tbl("Pressure potential and solute potential (bars) of a plant cell and of the surrounding solution", ["Component", "Pressure potential (bars)", "Solute potential (bars)"], [["Plant cell", f"{psp_c:g}", f"{pss_c:g}"], ["Surrounding solution", f"{psp_s:g}", f"{pss_s:g}"]])
    stem = "A plant cell is placed in an open beaker of solution. The table shows the pressure potential and the solute potential of the cell and of the solution. Which statement describes the net movement of water?"
    return mk("bi_water_flow_direction", "2.7", "5.D", stem, key, ds, rng, concept="net water movement follows water potential Psi = Psi_P + Psi_S", stim=stim, path="sum of components per side compared numerically vs the generating condition (with and without pressure)", facts=[f"psi_cell={psi_c}", f"psi_sol={psi_s}"], judgment="combine pressure and solute potentials before comparing the two sides")


@retry_sep
def bi_osmosis_mass_change(rng):
    ms = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]
    iso = pick(rng, [0.25, 0.30, 0.35, 0.45, 0.50, 0.55])
    slope = pick(rng, [-24, -28, -32, -36])
    vals = [round(slope * (m - iso), 1) for m in ms]
    # 독립 경로: 부호가 바뀌는 두 점의 선형 보간(분수) vs numpy 최소제곱 직선의 x절편
    i0 = next(i for i in range(5) if vals[i] > 0 >= vals[i + 1]) if any(vals[i] > 0 >= vals[i + 1] for i in range(5)) else None
    if i0 is None:
        raise ValueError("no_crossing")
    x0, x1, y0, y1 = ms[i0], ms[i0 + 1], vals[i0], vals[i0 + 1]
    interp = x0 + (0 - y0) * (x1 - x0) / (y1 - y0)
    co = np.polyfit(ms, vals, 1); lsq = -co[1] / co[0]
    agree(interp, lsq, 0.03, "iso")
    est = round(interp, 2)
    pairs = [("Reads the molarity with the greatest mass gain instead of the molarity with no change.", ms[int(np.argmax(vals))] if max(vals) > 0 else None), ("Reads the molarity with the greatest mass loss instead of the molarity with no change.", ms[int(np.argmin(vals))]), ("Averages all the molarities tested.", float(np.mean(ms))), ("Uses the midpoint of the two molarities that bracket zero without interpolating.", 0.5 * (ms[i0] + ms[i0 + 1]))]
    key, ds = val_opts(est, pairs, lambda v: f"${hu(v, 2)}" + "\\text{ M}$", gap=0.04)
    stim = graph_stim("Percent change in mass of potato cores after 24 hours in sucrose solutions", [("Percent change in mass", [[m, v] for m, v in zip(ms, vals)])], gaxis("Sucrose molarity (M)", 0, 1.0, 0.2), gaxis("Percent change in mass", -30, 30, 10))
    stem = "Identical potato cores were placed in sucrose solutions of different molarities for 24 hours. The graph shows the percent change in mass. Which value is the best estimate of the molarity of sucrose that is isotonic to the potato cells?"
    return mk("bi_osmosis_mass_change", "2.7", "5.A", stem, key, ds, rng, concept="estimate the solute concentration of cells where no net water movement occurs from mass-change data", stim=stim, path="linear interpolation between the two points that bracket zero vs least-squares line x-intercept", facts=[f"iso={iso}", f"vals={vals}", f"est={est}"], judgment="find where the percent change is zero from the plotted data",
              kwhy=f"The cores neither gain nor lose mass where the percent change is zero. The plotted values change from {y0:g}% at {x0:g} M to {y1:g}% at {x1:g} M, so the zero crossing is at about {est:.2f} M.")


bi_tonicity_pred = make_bank_archetype("bi_tonicity_pred", "2.7", "6.E", [
    B("A red blood cell is placed in a solution with a much lower solute concentration than the cell's cytoplasm. Which outcome is most likely?",
      ("Water enters the cell and the cell swells and may burst.", "The solution is hypotonic, so water moves into the cell; an animal cell has no wall to resist swelling."),
      [("Water leaves the cell and the cell shrinks.", "Water would leave only in a hypertonic solution."),
       ("Solutes leave the cell until the solute concentrations are equal and the cell size is unchanged.", "Solute movement is not the cause of the volume change; osmosis of water is."),
       ("Nothing happens, because the plasma membrane is impermeable to water.", "Water crosses the membrane by osmosis, and aquaporins increase this movement.")]),
    B("A plant cell with a cell wall is placed in pure water. Which outcome is most likely?",
      ("Water enters, the cell becomes turgid, and the cell wall prevents bursting.", "In a hypotonic solution water enters and pressure potential builds up against the cell wall."),
      [("Water leaves, and the cell undergoes plasmolysis.", "Plasmolysis occurs in hypertonic solutions when water leaves the cell."),
       ("Water enters until the cell bursts, as an animal cell would.", "The cell wall resists expansion and prevents bursting."),
       ("The cell does not change because plant cells cannot take up water.", "Plant cells take up water readily by osmosis.")]),
    B("A freshwater protist has a contractile vacuole that pumps water out of the cell. If the protist is moved to a solution with the same solute concentration as its cytoplasm, how will the activity of the contractile vacuole most likely change?",
      ("It will slow down because less water enters the cell by osmosis.", "In an isotonic solution there is little net water entry, so less pumping is needed."),
      [("It will speed up because more water enters the cell by osmosis.", "More water would enter in a hypotonic solution and not in an isotonic one."),
       ("It will stop working because the vacuole needs a concentration gradient of ATP.", "The change in solution does not remove ATP."),
       ("It will stay the same because osmosis is not affected by solute concentrations.", "Osmosis depends on differences in water potential, which depend on solute concentration.")]),
], "predict water movement and cell response in hypotonic, hypertonic, and isotonic solutions", "fixed fact bank checked against CED 2.7", est=60)


@retry_sep
def bi_membrane_graph(rng):
    vmax = pick(rng, [30, 40, 50]); km = pick(rng, [5, 8, 10])
    cs = [0, 5, 10, 15, 20, 25, 30, 35, 40]
    sat_raw = [vmax * c / (km + c) for c in cs]
    k = round(sat_raw[-1] / 40 * pick(rng, [0.9, 1.0, 1.1]), 2)
    lin = [round(k * c, 1) for c in cs]
    sat = [round(v, 1) for v in sat_raw]
    # 독립 경로: 두 곡선의 2차 차분(포화 곡선은 오목, 선형 곡선은 0)
    d2_lin = np.diff([k * c for c in cs], 2); d2_sat = np.diff(sat_raw, 2)
    agree(0, float(np.max(np.abs(d2_lin))), 1e-6, "linear")
    if not np.all(d2_sat < 0):
        raise ValueError("not_concave")
    ymax = 60
    first = pick(rng, ["A", "B"])
    labs = {first: "Substance P", ("B" if first == "A" else "A"): "Substance Q"}
    curves = [("Substance P", [[c, v] for c, v in zip(cs, lin if first == "A" else sat)]), ("Substance Q", [[c, v] for c, v in zip(cs, sat if first == "A" else lin)])]
    stim = graph_stim("Rate of movement of two substances across a membrane at different external concentrations", curves, gaxis("External concentration (mM)", 0, 40, 10), gaxis("Rate of movement (µmol per minute)", 0, 60, 10))
    sat_name = "Substance Q" if first == "A" else "Substance P"; lin_name = "Substance P" if first == "A" else "Substance Q"
    key, ds = sentence_options(f"{sat_name} moves by facilitated diffusion, because its rate levels off when all the transport proteins are in use.", f"{sat_name}'s rate levels off at high concentration, which shows a limited number of transport proteins, while {lin_name}'s rate keeps increasing in proportion to concentration, as in simple diffusion.",
        [(f"{lin_name} moves by facilitated diffusion, because its rate increases in proportion to concentration.", "A rate that rises without limit in proportion to concentration indicates simple diffusion and not a saturable protein."),
         (f"{sat_name} moves by simple diffusion, because its rate levels off when the concentrations on both sides are equal.", "Leveling off of the rate at high external concentration is not caused by equal concentrations; it indicates saturation."),
         (f"Both substances move by active transport, because both rates increase with concentration.", "Active transport requires energy and works against gradients; the data do not show ATP use.")])
    stem = "The graph shows the rate at which two substances cross the plasma membrane of a cell as the external concentration increases. Which statement is best supported by the data?"
    return mk("bi_membrane_graph", "2.6", "2.B", stem, key, ds, rng, concept="a saturable transport rate indicates a limited number of carrier or channel proteins", stim=stim, path="second differences of the plotted series (linear vs concave) vs the generating model", facts=[f"k={k}", f"vmax={vmax}", f"km={km}"], judgment="relate the shape of a curve to the transport mechanism")


bi_organelle_function = make_bank_archetype("bi_organelle_function", "2.1", "1.A", [
    B("Pancreatic cells synthesize large amounts of the hormone insulin, a protein that is secreted from the cell. Which organelle is expected to be especially abundant in these cells?",
      ("Rough endoplasmic reticulum, because ribosomes on it make secreted proteins", "Ribosomes on the rough ER make proteins that are destined for secretion."),
      [("Smooth endoplasmic reticulum, because it makes proteins for export", "The smooth ER makes lipids and detoxifies substances; protein synthesis for export occurs on rough ER."),
       ("Lysosomes, because they package proteins for secretion", "Lysosomes digest macromolecules and do not package proteins for secretion."),
       ("Chloroplasts, because proteins come from photosynthesis", "Chloroplasts are not in animal cells and do not make proteins by photosynthesis.")]),
    B("Skeletal muscle cells use large amounts of ATP during exercise. Compared with skin cells, which structure is expected to be more abundant in muscle cells?",
      ("Mitochondria, because they make most of the ATP in the cell", "Mitochondria produce most of the ATP by cellular respiration, so cells with high energy demands have more of them."),
      [("Lysosomes, because they produce ATP", "Lysosomes digest materials and do not produce ATP."),
       ("Golgi complexes, because they release energy from glucose", "The Golgi modifies and sorts proteins and does not release energy from glucose."),
       ("Nucleoli, because they make ATP from DNA", "The nucleolus assembles ribosomal subunits and does not make ATP.")]),
    B("A white blood cell engulfs a bacterium and destroys it with digestive enzymes. Which organelle contains the enzymes that break down the bacterium?",
      ("Lysosome", "Lysosomes contain hydrolytic enzymes that digest engulfed materials."),
      [("Ribosome", "Ribosomes synthesize proteins and do not digest materials."),
       ("Chloroplast", "Chloroplasts carry out photosynthesis and are not in white blood cells."),
       ("Nucleus", "The nucleus stores DNA and does not contain the digestive enzymes of the cell.")]),
    B("A student observes a cell that contains a large central vacuole, a cell wall, and chloroplasts. Which kind of cell is most likely being observed?",
      ("A plant cell, because these structures are found together in plants", "These three structures are characteristic of plant cells."),
      [("An animal cell, because it has a central vacuole", "Animal cells do not have chloroplasts or cell walls."),
       ("A bacterial cell, because it has chloroplasts", "Bacteria lack membrane-bound organelles such as chloroplasts."),
       ("A fungal cell, because it has chloroplasts", "Fungal cells have walls but lack chloroplasts.")]),
], "match an organelle to the function suggested by a cell's activity", "fixed fact bank checked against CED 2.1", est=55)

bi_endomembrane_path = make_bank_archetype("bi_endomembrane_path", "2.1", "1.B", [
    B("A cell secretes a digestive enzyme into its surroundings. Which sequence best describes the route of the enzyme?",
      ("Ribosome on the rough ER, then the Golgi complex, then a secretory vesicle, then the plasma membrane", "A secreted protein is made on the rough ER, modified in the Golgi, and carried in vesicles to the membrane."),
      [("Nucleus, then lysosome, then the Golgi complex, then the plasma membrane", "The nucleus does not make the protein and lysosomes are not on the secretion pathway."),
       ("Golgi complex, then the rough ER, then a secretory vesicle, then the plasma membrane", "The order of the ER and the Golgi is reversed in this pathway."),
       ("Free ribosome, then mitochondrion, then the plasma membrane", "Mitochondria do not process secreted proteins.")]),
    B("A cell is treated with a drug that blocks the movement of vesicles from the endoplasmic reticulum to the Golgi complex. Which result is most likely?",
      ("Proteins made on the rough ER accumulate in the ER and are not secreted.", "Blocking vesicle transport from the ER traps proteins at the first stage of the pathway."),
      [("Proteins accumulate in the Golgi complex and are secreted normally.", "If transport from the ER is blocked, proteins do not reach the Golgi."),
       ("Proteins are made on ribosomes in the nucleus instead.", "Ribosomes are not in the nucleus, and the block does not move protein synthesis there."),
       ("The cell stops all transcription of DNA.", "Blocking vesicle transport does not directly stop transcription.")]),
    B("Which structure is the most direct destination of vesicles that bud from the Golgi complex carrying proteins to be released from the cell?",
      ("The plasma membrane", "Secretory vesicles fuse with the plasma membrane and release their contents by exocytosis."),
      [("The nuclear envelope", "Vesicles carrying secreted proteins do not fuse with the nuclear envelope."),
       ("The mitochondrial inner membrane", "Mitochondria import proteins by a different process."),
       ("The ribosome", "Ribosomes are not membrane-bound targets of vesicles.")]),
], "trace the path of a secreted or membrane protein through the endomembrane system", "fixed fact bank checked against CED 2.1 and 2.8", est=60)

bi_cell_compartment = make_bank_archetype("bi_cell_compartment", "2.9", "1.C", [
    B("Eukaryotic cells have membrane-bound compartments such as lysosomes that contain digestive enzymes. What is a benefit of this compartmentalization?",
      ("Digestive enzymes can work in their optimal conditions without damaging other parts of the cell.", "Separate compartments maintain different conditions and keep harmful reactions away from other cell components."),
      [("All metabolic reactions of the cell occur at the same rate in every compartment.", "Compartments allow different conditions and rates; they do not equalize them."),
       ("Membranes between compartments make the cytoplasm contain no enzymes.", "Enzymes are present throughout the cell, in different compartments."),
       ("The cell no longer needs to make proteins because compartments store them.", "Compartments do not replace protein synthesis.")]),
    B("The inner membrane of a mitochondrion is highly folded into cristae. Which statement best explains the advantage of this structure?",
      ("The folds increase the membrane surface area available for the proteins that make ATP.", "More inner membrane means more electron transport chain and ATP synthase molecules in the organelle."),
      [("The folds decrease the surface area and keep the matrix free of enzymes.", "Cristae increase the surface area, and the matrix contains many enzymes."),
       ("The folds allow the mitochondrion to synthesize proteins for the nucleus.", "Cristae are not involved in protein synthesis for the nucleus."),
       ("The folds let the mitochondrion make glucose from carbon dioxide.", "Mitochondria carry out respiration and do not make glucose from carbon dioxide.")]),
    B("Which of the following best explains why separating the nucleus from the cytoplasm is advantageous in a eukaryotic cell?",
      ("Transcription and RNA processing occur in the nucleus, which allows regulation before the RNA reaches ribosomes.", "The nuclear envelope separates RNA synthesis and processing from translation, allowing regulation."),
      [("It allows translation to occur before transcription is complete in all genes.", "Coupling of the two processes is typical of prokaryotes that lack a nucleus."),
       ("It prevents any molecule from moving between the nucleus and the cytoplasm.", "Nuclear pores allow selective transport between the nucleus and cytoplasm."),
       ("It allows the cell to avoid using DNA as the genetic material.", "Eukaryotic cells use DNA as their genetic material, stored in the nucleus.")]),
], "relate compartmentalization and membrane folding to function", "fixed fact bank checked against CED 2.9", est=60)

bi_endosymbiosis = make_bank_archetype("bi_endosymbiosis", "2.10", "6.B", [
    B("Mitochondria and chloroplasts contain their own circular DNA and ribosomes similar to those of prokaryotes. Which claim is best supported by this evidence?",
      ("They arose from free-living prokaryotes engulfed by an early eukaryotic cell.", "Their own circular DNA and prokaryote-like ribosomes are consistent with an endosymbiotic origin."),
      [("These organelles were produced by the nucleus from nuclear DNA only.", "Their own DNA and ribosomes show they have some independent genetic material."),
       ("These organelles are found in all prokaryotes and so are ancient prokaryotic structures.", "Prokaryotes do not have mitochondria or chloroplasts."),
       ("These organelles formed by the infolding of the plasma membrane around the nucleus.", "Infolding of the membrane explains the endomembrane system and not organelles with their own DNA.")]),
    B("Which observation would provide additional evidence that mitochondria originated through endosymbiosis?",
      ("Mitochondria have two membranes and divide in a way like binary fission.", "A double membrane and division like that of bacteria fit an engulfed prokaryotic ancestor."),
      [("Mitochondria are surrounded by a single membrane and divide by mitosis.", "Mitochondria do not divide by mitosis, and this would not suggest a prokaryotic origin."),
       ("Mitochondria contain no nucleic acids and cannot reproduce.", "Mitochondria contain DNA and reproduce within the cell."),
       ("Mitochondria are found only in prokaryotic cells.", "Mitochondria are organelles of eukaryotic cells.")]),
    B("Which structure is thought to have formed by the infolding of the plasma membrane rather than by endosymbiosis?",
      ("The endoplasmic reticulum and nuclear envelope", "The endomembrane system is proposed to have arisen by infolding of the plasma membrane."),
      [("The mitochondrion and its double membrane", "Mitochondria are proposed to have originated from an engulfed bacterium."),
       ("The chloroplast and its thylakoid system", "Chloroplasts are proposed to have originated from an engulfed photosynthetic bacterium."),
       ("The plant cell wall and its cellulose", "The plant cell wall is a secreted extracellular structure and not an organelle formed by infolding.")]),
], "evaluate evidence for the origin of organelles", "fixed fact bank checked against CED 2.10", est=65)


@retry_sep
def bi_sa_v_table(rng):
    names = ["P", "Q", "R"]
    dims = rng.sample([2, 3, 4, 5, 6, 8, 10], 3)
    sa = [6 * s * s for s in dims]; v = [s ** 3 for s in dims]
    ratios = [a / b for a, b in zip(sa, v)]
    best = int(np.argmax(ratios))
    agree(0, 0 if dims[best] == min(dims) else 1, 1e-9, "smallest")
    pairs = lambda: None
    key = Opt(f"Cell {names[best]}", True, f"Cell {names[best]} has the greatest ratio, {sa[best]} / {v[best]} = {ratios[best]:.2f} per µm, because the surface area to volume ratio decreases as a cube gets larger.", None)
    ds = []
    for j in range(3):
        if j == best:
            continue
        ds.append(Opt(f"Cell {names[j]}", False, f"Cell {names[j]} has a ratio of {ratios[j]:.2f} per µm, which is lower than cell {names[best]}; its larger size means less surface area per unit volume." + (" It has the greatest surface area, which is not the same as the greatest ratio." if sa[j] == max(sa) else ""), None))
    ds.append(Opt("All three cells equally", False, "The ratio changes with size, so cells of different sizes do not have equal ratios.", None))
    stim = tbl("Surface area and volume of three cube-shaped cells", ["Cell", "Side length (µm)", "Surface area (µm²)", "Volume (µm³)"], [[names[j], dims[j], sa[j], v[j]] for j in range(3)])
    stem = "The table gives the dimensions of three cube-shaped cells. Which cell is expected to exchange materials with its environment most efficiently for its volume?"
    return mk("bi_sa_v_table", "2.2", "4.B", stem, key, ds, rng, concept="compare surface area to volume ratios in a table", stim=stim, path="ratio computed from the table columns vs the closed form 6/s for a cube", facts=[f"dims={dims}"], judgment="compute and compare ratios, not raw surface areas")


bi_prokaryote_eukaryote = make_bank_archetype("bi_prokaryote_eukaryote", "2.1", "1.A", [
    B("A microscopist finds a cell that lacks a nucleus and membrane-bound organelles but has ribosomes and a circular chromosome. Which statement about this cell is most accurate?",
      ("It is a prokaryotic cell and can still carry out transcription and translation.", "Prokaryotes lack a nucleus and organelles but make RNA and protein with their own ribosomes."),
      [("It is a eukaryotic cell because it has ribosomes.", "Both prokaryotic and eukaryotic cells have ribosomes."),
       ("It is a prokaryotic cell and cannot make proteins because it has no nucleus.", "Protein synthesis occurs on ribosomes and does not require a nucleus."),
       ("It is a eukaryotic cell because it has a chromosome.", "Prokaryotes have chromosomes too.")]),
    B("Which structure is found in both prokaryotic and eukaryotic cells?",
      ("Ribosomes", "All cells use ribosomes to synthesize proteins."),
      [("Nucleus", "A nucleus is found only in eukaryotic cells."),
       ("Mitochondria", "Mitochondria are found only in eukaryotic cells."),
       ("Endoplasmic reticulum", "The endoplasmic reticulum is found only in eukaryotic cells.")]),
], "classify a cell as prokaryotic or eukaryotic from its structures", "fixed fact bank checked against CED 2.1", est=50)

bi_vesicle_transport = make_bank_archetype("bi_vesicle_transport", "2.8", "1.B", [
    B("A white blood cell takes in a large bacterium by extending its membrane around the particle and forming a vesicle. Which process is this, and what is required?",
      ("Phagocytosis, which requires energy and a membrane that can change shape", "Phagocytosis is a form of endocytosis in which the membrane engulfs a large particle using energy."),
      [("Exocytosis, which releases the bacterium from the cell", "Exocytosis moves materials out of the cell."),
       ("Facilitated diffusion, which requires a channel for the bacterium", "Bacteria are too large to pass through channels."),
       ("Simple diffusion, which moves the bacterium down its gradient", "Large particles cannot diffuse across the membrane.")]),
    B("Nerve cells release neurotransmitter molecules when vesicles fuse with the plasma membrane. Which process is this?",
      ("Exocytosis, in which vesicle membrane merges with the plasma membrane", "Exocytosis releases the contents of a vesicle to the outside as the vesicle membrane fuses with the plasma membrane."),
      [("Endocytosis, in which the plasma membrane forms a new vesicle from the outside", "Endocytosis brings materials into the cell."),
       ("Osmosis, in which water carries the neurotransmitter across the membrane", "Osmosis is the movement of water and not of neurotransmitter vesicles."),
       ("Active transport, in which a pump moves each molecule across the bilayer", "Vesicle fusion does not move individual molecules through pump proteins.")]),
], "identify endocytosis and exocytosis and what they require", "fixed fact bank checked against CED 2.8", est=55)

STAGE_U1 = ["bi_water_property", "bi_water_solvent", "bi_macromolecule_id", "bi_dehydration_count", "bi_chargaff", "bi_dna_hbonds", "bi_protein_level", "bi_nucleic_polarity", "bi_amino_acid_property", "bi_lipid_structure", "bi_carb_structure", "bi_elements_life", "bi_macromolecule_table"]
STAGE_U2 = ["bi_sa_v_ratio", "bi_sa_v_concept", "bi_membrane_structure", "bi_membrane_permeability", "bi_transport_type", "bi_water_potential", "bi_water_flow_direction", "bi_osmosis_mass_change", "bi_tonicity_pred", "bi_membrane_graph", "bi_organelle_function", "bi_endomembrane_path", "bi_cell_compartment", "bi_endosymbiosis", "bi_sa_v_table", "bi_prokaryote_eukaryote", "bi_vesicle_transport"]
