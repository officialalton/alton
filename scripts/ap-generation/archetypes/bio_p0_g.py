"""AP Biology P0 원형 G — 두 회 조립 여유를 위한 보강(단원 1·Practice 1·2 원형, 세트 2개). 같은 규약(코드 계산·고정 문장·이름 붙은 오개념)."""
from bio_common import *  # noqa: F401,F403
from bio_p0_f import _set

bi_dna_bonds_concept = make_bank_archetype("bi_dna_bonds_concept", "1.6", "1.A", [
    B("When a solution of double-stranded DNA is heated to near boiling, the two strands separate, but each strand remains intact. Which statement best explains this observation?",
      ("Heat breaks the hydrogen bonds between the strands but not the covalent bonds within each strand.", "Hydrogen bonds between bases are weak, while covalent phosphodiester bonds hold each strand together."),
      [("Heat breaks the covalent bonds within each strand but not the hydrogen bonds between the strands.", "This reverses the strengths of the two kinds of bonds."),
       ("Heat breaks both the hydrogen bonds and the covalent bonds, but the strands re-form immediately.", "Covalent bonds in each strand are not broken by this heating."),
       ("Heat has no effect on any of the bonds, so the strands separate for another reason.", "The separation is caused by breaking the hydrogen bonds between the bases.")]),
    B("DNA with a higher percentage of guanine and cytosine requires a higher temperature to separate its strands than DNA with a higher percentage of adenine and thymine. Which statement best explains this?",
      ("G-C base pairs have three hydrogen bonds, while A-T base pairs have two, so more energy is needed to separate G-C pairs.", "More hydrogen bonds per base pair means more energy is needed to separate the strands."),
      [("A-T base pairs have three hydrogen bonds, while G-C base pairs have two.", "The numbers of hydrogen bonds are reversed."),
       ("G-C base pairs are joined by covalent bonds, while A-T base pairs are joined by hydrogen bonds.", "All base pairs are held together by hydrogen bonds."),
       ("G and C are larger than A and T, so heat cannot reach them.", "Size is not the reason; the number of hydrogen bonds differs.")]),
], "relate bond types and base pairing to DNA stability", "fixed fact bank checked against CED 6.1", est=60)

bi_protein_function_shape = make_bank_archetype("bi_protein_function_shape", "1.7", "1.C", [
    B("Antibodies are proteins that recognize and bind to specific foreign molecules. Which feature of protein structure best explains this specificity?",
      ("The three-dimensional shape of the binding region, determined by the amino acid sequence, fits one specific target.", "The folded shape and the chemistry of the binding site determine which molecule binds."),
      [("The presence of a single amino acid that binds all foreign molecules equally well.", "Binding depends on the shape and chemistry of a region and not on one universal amino acid."),
       ("The number of nucleotides in the DNA that encodes the antibody.", "The protein's structure and not the nucleotide count determines binding."),
       ("The primary structure is irrelevant, because shape is determined only by the environment.", "The amino acid sequence determines how the protein folds.")]),
    B("Hemoglobin carries oxygen in red blood cells. In sickle cell disease, a single amino acid substitution changes the shape of hemoglobin molecules and they clump together. Which statement best connects this change to the function of the protein?",
      ("A change in primary structure changes folding and interactions, which can reduce the protein's ability to function normally.", "The structure of a protein determines its function, so a change in the sequence can change the function."),
      [("A change in one amino acid never affects the shape, so function is unchanged.", "A single substitution can change the interactions that determine the shape."),
       ("Only a change in the number of subunits can alter the function of a protein.", "A change in the amino acid sequence can also alter function."),
       ("The substitution changes the DNA of the red blood cell membrane directly.", "The change is in the amino acid sequence of the protein, not in the membrane DNA.")]),
], "connect protein shape to specific functions", "fixed fact bank checked against CED 1.7", est=65)

bi_nucleotide_components = make_bank_archetype("bi_nucleotide_components", "1.6", "2.A", [
    B("A student is given a model of a nucleotide that includes a phosphate group, a five-carbon sugar with a hydroxyl group on the second carbon, and the base uracil. To which type of nucleic acid does this nucleotide belong?",
      ("RNA, because it contains ribose and uracil", "Ribose has a hydroxyl group on the second carbon and uracil is found in RNA."),
      [("DNA, because it contains deoxyribose and uracil", "Deoxyribose lacks the hydroxyl group on the second carbon and DNA contains thymine."),
       ("DNA, because it contains ribose and thymine", "The model contains uracil, which is not found in DNA."),
       ("Either DNA or RNA, because both contain uracil", "Uracil is found only in RNA.")]),
    B("Which part of a nucleotide forms the connection between adjacent nucleotides in one strand of a nucleic acid?",
      ("The sugar of one nucleotide and the phosphate group of the next nucleotide", "The sugar-phosphate backbone is formed by phosphodiester bonds."),
      [("The nitrogenous base of one nucleotide and the nitrogenous base of the next", "Bases pair with bases on the opposite strand."),
       ("The phosphate group of one nucleotide and the base of the next nucleotide", "The phosphate links to the sugar and not to the base of the next nucleotide."),
       ("The two sugars of the adjacent nucleotides", "Adjacent sugars are connected through a phosphate group.")]),
], "identify the parts of a nucleotide and the type of nucleic acid", "fixed fact bank checked against CED 6.1", est=55)

bi_monomer_hydrolysis = make_bank_archetype("bi_monomer_hydrolysis", "1.3", "1.B", [
    B("A cell breaks down a large polymer into its monomers. Which statement best describes the type of reaction and the role of water?",
      ("Hydrolysis, in which water is added to break the bonds between monomers", "Hydrolysis uses a water molecule to break each bond between monomers."),
      [("Dehydration synthesis, in which water is added to break the bonds between monomers", "Dehydration synthesis builds polymers and releases water."),
       ("Hydrolysis, in which water is released as the bonds between monomers form", "Hydrolysis uses water and does not release it."),
       ("Dehydration synthesis, in which water is released as the monomers are separated", "Dehydration synthesis joins monomers and does not separate them.")]),
    B("Digestive enzymes in the stomach break down proteins into smaller peptides. Which statement describes the change in the number of water molecules involved?",
      ("Water molecules are used, one for each peptide bond that is broken.", "Hydrolysis of a peptide bond uses one water molecule."),
      [("Water molecules are released, one for each peptide bond that is broken.", "Breaking bonds by hydrolysis consumes water."),
       ("No water molecules are involved, because enzymes provide the energy.", "Enzymes lower activation energy; hydrolysis still uses water."),
       ("Water molecules are used, one for each amino acid in the protein.", "One water is used for each bond broken, not for each amino acid.")]),
], "distinguish hydrolysis from dehydration synthesis", "fixed fact bank checked against CED 1.3", est=55)


@retry_sep
def bi_graph_dose_response(rng):
    Rmax = pick(rng, [60, 80, 100]); Kd = pick(rng, [4, 6, 8])
    L = [0, 2, 4, 8, 12, 16, 24, 32, 40]
    resp = [round(Rmax * l / (Kd + l), 1) for l in L]
    stim = graph_stim("Response of cells to different concentrations of a signaling molecule", [("Cell response", [[l, r] for l, r in zip(L, resp)])], gaxis("Concentration of signaling molecule (µM)", 0, 40, 10), gaxis("Cell response (arbitrary units)", 0, math.ceil(Rmax / 20) * 20, 20))
    key, ds = sentence_options("The response levels off because nearly all of the receptors are bound to the signaling molecule.", "At high concentration the receptors are saturated, so adding more signaling molecule cannot increase the response.",
        [("The response levels off because the signaling molecule is used up at high concentration.", "A higher concentration means more signaling molecule is available, not less."),
         ("The response levels off because the signaling molecule is destroyed by the receptors.", "Receptors bind signaling molecules and do not destroy them."),
         ("The response levels off because cells stop making receptors when the signal is strong.", "The plateau is explained by saturation of existing receptors and not by loss of receptors.")])
    stem = "The graph shows the response of cells to increasing concentrations of a signaling molecule that binds to a receptor on the cell surface. Which statement best explains the shape of the curve at high concentrations?"
    return mk("bi_graph_dose_response", "4.2", "2.B", stem, key, ds, rng, concept="relate saturation of a dose-response curve to a limited number of receptors", stim=stim, path="second differences of the plotted response (concave saturation) vs the generating hyperbolic form", facts=[f"Rmax={Rmax}", f"Kd={Kd}"], judgment="explain a plateau by receptor saturation", est=65)


@retry_sep
def bi_graph_pcr_cycles(rng):
    n0 = pick(rng, [10, 20]); cyc = list(range(0, 31, 3))
    amt = [round(min(n0 * 2 ** c, 5e6) / 1e3, 1) for c in cyc]
    if amt[-1] == amt[-2]:
        pass
    stim = graph_stim("Amount of DNA produced in a PCR reaction after different numbers of cycles", [("DNA", [[c, a] for c, a in zip(cyc, amt)])], gaxis("Number of cycles", 0, 30, 5), gaxis("Amount of DNA (thousands of copies)", 0, 5000, 1000))
    key, ds = sentence_options("The amount of DNA doubles with each cycle at first, and the increase slows when a reagent becomes limiting.", "Early on every molecule is copied each cycle, which gives exponential growth; later, primers or nucleotides run out, so the curve levels off.",
        [("The amount of DNA increases by the same amount in every cycle for all 30 cycles.", "The early part of the graph shows an increasing rate, not a constant amount of increase."),
         ("The amount of DNA decreases in the later cycles because the polymerase destroys DNA.", "The graph does not show a decrease in DNA."),
         ("The amount of DNA is constant because the original DNA is never copied.", "The graph shows a large increase in DNA.")])
    stem = "The graph shows the amount of DNA in a PCR reaction after different numbers of cycles. Which statement best describes the data and gives a reason for the shape of the curve?"
    return mk("bi_graph_pcr_cycles", "6.8", "2.B", stem, key, ds, rng, concept="exponential amplification and a limiting reagent in PCR", stim=stim, path="ratio of successive plotted values (about two) in the early cycles vs the generating doubling", facts=[f"n0={n0}"], judgment="relate the shape of the curve to doubling and to a limiting reagent", est=65)


def bis_translation_set(rng):
    """세트 7: 번역·돌연변이 표 → 아미노산 서열·돌연변이 유형·영향·예측."""
    for _ in forever():
        aas = [c for c in CODON if CODON[c] not in ("*", "M")]
        body = [rng.choice(aas) for _ in range(4)]
        stop = rng.choice(["UAA", "UAG", "UGA"])
        orig = "AUG" + "".join(body) + stop
        idx = rng.randint(1, 4); pos = 3 * idx; cod = orig[pos:pos + 3]
        opts = [c for c in CODON if CODON[c] not in ("*", CODON[cod]) and sum(a != b for a, b in zip(c, cod)) == 1]
        syn = [c for c in CODON if CODON[c] == CODON[cod] and c != cod and sum(a != b for a, b in zip(c, cod)) == 1]
        near = [c for c in ("UAA", "UAG", "UGA") if sum(a != b for a, b in zip(c, cod)) == 1]
        if opts and syn and len(translate(orig)) == 5:
            break
    mis = orig[:pos] + rng.choice(opts) + orig[pos + 3:]
    syn_m = orig[:pos] + rng.choice(syn) + orig[pos + 3:]
    delm = orig[:pos + 1] + orig[pos + 2:]
    p0 = translate(orig); p_mis = translate(mis); p_del = translate(delm)
    used = sorted({orig[k:k + 3] for k in range(0, len(orig) - 2)} | {mis[k:k + 3] for k in range(0, len(mis) - 2)} | {delm[k:k + 3] for k in range(0, len(delm) - 2)})
    stim = tbl("Original and mutated mRNA coding sequences (5' to 3') for one gene", ["Sequence", "mRNA (5' to 3')"], [["Original", orig], ["Mutation 1", mis], ["Mutation 2", delm]], notes=["Each sequence begins at the start codon."])
    # q1: 원래 폴리펩타이드
    cands = [("Includes the stop codon as an amino acid position and keeps reading.", [AA_NAME[CODON[orig[k:k + 3]]] for k in range(0, len(orig), 3) if len(orig[k:k + 3]) == 3][:len(p0) + 1]), ("Lists the amino acids in reverse order.", p0[::-1]), ("Starts reading one nucleotide after the start codon.", None)]
    wrong = []
    for why, v in cands:
        if v is None:
            v = []
            j = 1
            while j + 3 <= len(orig):
                a = CODON[orig[j:j + 3]]
                if a == "*":
                    break
                v.append(AA_NAME[a]); j += 3
        t = "-".join(v)
        if t and t != "-".join(p0) and t not in [w[0] for w in wrong]:
            wrong.append((t, why))
    if len(wrong) < 3:
        raise ValueError("few")
    from common import Opt as _O
    k1 = _O("-".join(p0), True, f"Translation reads codons in order from the start codon until the stop codon: {'-'.join(p0)}.", None)
    d1 = [_O(t, False, why, None) for t, why in wrong[:3]]
    q1 = mk("bis_translation_set_q1", "6.4", "5.A", "Which choice shows the amino acid sequence of the polypeptide made from the original mRNA, beginning at the amino terminus? (Use the standard codon table.)", k1, d1, rng, concept="translate an mRNA from the start codon to the stop codon", path="codon-table loop vs translate()", material=MAT_TABLE("original mRNA"), facts=[f"orig={orig}"], est=80)
    # q2: 돌연변이 1 유형
    kind1 = "missense" if p_mis != p0 else "silent"
    texts = {"missense": "A missense mutation: one amino acid is changed.", "silent": "A silent mutation: the amino acid sequence is unchanged.", "nonsense": "A nonsense mutation: a premature stop codon shortens the polypeptide.", "frameshift": "A frameshift mutation: the reading frame is changed after the mutation."}
    whys = {"missense": "Compare the two sequences: one codon codes for a different amino acid.", "silent": "The sequence of amino acids is the same as the original.", "nonsense": "No codon has changed into a stop codon in this sequence.", "frameshift": "A frameshift would require the insertion or deletion of a nucleotide; mutation 1 replaced a nucleotide."}
    k2 = _O(texts[kind1], True, f"Mutation 1 changes one nucleotide, so it is a substitution. {whys[kind1]}", None)
    d2 = [_O(texts[k], False, whys[k] if k != kind1 else "", None) for k in ("missense", "silent", "nonsense", "frameshift") if k != kind1]
    q2 = mk("bis_translation_set_q2", "6.7", "5.D", "Which statement best describes mutation 1?", k2, d2, rng, concept="classify a point mutation by comparing translations", path="translate both sequences vs the generating substitution", material=MAT_TABLE("mutated mRNA"), facts=[f"mis={mis}"], est=75)
    # q3: 돌연변이 2(결실)
    k3 = _O(texts["frameshift"], True, "Mutation 2 is missing one nucleotide compared with the original, so the reading frame shifts after the deletion.", None)
    d3 = [_O(texts[k], False, {"missense": "A single amino acid replacement does not explain a deletion of one nucleotide.", "silent": "The sequence is shorter by one nucleotide, so it cannot be a substitution.", "nonsense": "The deletion shifts the frame; the effect is not limited to a new stop codon."}[k], None) for k in ("missense", "silent", "nonsense")]
    q3 = mk("bis_translation_set_q3", "6.7", "5.D", "Which statement best describes mutation 2?", k3, d3, rng, concept="recognize a frameshift from a deletion", path="length comparison and translation vs the generating deletion", material=MAT_TABLE("mutated mRNA"), facts=[f"del={delm}"], est=70)
    k4, d4 = sentence_options("Mutation 2 is more likely to destroy the function of the protein, because it can change many amino acids after the deletion.", "A frameshift changes all of the codons after the deletion, which usually changes the protein's structure much more than one amino acid substitution.",
        [("Mutation 1 is more likely to destroy the function of the protein, because every missense mutation changes all of the amino acids.", "A substitution changes at most one codon."),
         ("Both mutations are equally likely to destroy the function, because both change one nucleotide.", "The effects differ because a deletion shifts the reading frame."),
         ("Neither mutation can change the function, because the start codon is unchanged.", "A change after the start codon can still change the protein's amino acid sequence.")])
    q4 = mk("bis_translation_set_q4", "6.7", "6.E", "Which prediction about the effects of the two mutations on the function of the protein is best supported by the data?", k4, d4, rng, concept="compare the likely effects of a substitution and a frameshift", path="number of changed codons in each mutated sequence vs the generating mutation types", material=MAT_TABLE("mutated mRNA"), facts=[f"p_del={p_del}"], est=75)
    return _set("bis_translation_set", "A researcher compares an original mRNA coding sequence with two mutated sequences of the same gene. The sequences are shown in the table.", stim, [q1, q2, q3, q4], "6.4", "5.A")


def bis_leafdisk_set(rng):
    """세트 8: 두 광도에서 떠오른 잎 원판 수 → 서술·ET50 비교·속도 비·예측."""
    for _ in forever():
        ts = [2, 4, 6, 8, 10, 12, 14, 16]
        t_hi = rng.choice([4.0, 5.0, 6.0]); t_lo = t_hi * rng.choice([1.8, 2.0, 2.2]); s = 1.4
        f = lambda t, t50: min(10, max(0, round(10 / (1 + math.exp(-(t - t50) / s)))))  # noqa: E731
        hi = [f(t, t_hi) for t in ts]; lo = [f(t, t_lo) for t in ts]
        if 5 in hi or 5 in lo or hi[0] > 3 or lo[-1] < 8 or len(set(hi)) < 5 or len(set(lo)) < 5:
            continue
        def et(c):
            i = next(k for k in range(len(ts) - 1) if c[k] < 5 < c[k + 1])
            return float(Fr(ts[i]) + (Fr(5) - Fr(c[i])) * (Fr(ts[i + 1]) - Fr(ts[i])) / (Fr(c[i + 1]) - Fr(c[i])))
        try:
            e_hi, e_lo = et(hi), et(lo)
        except StopIteration:
            continue
        break
    stim = tbl("Number of leaf disks floating (out of 10) over time at two light intensities", ["Time (minutes)", "Disks floating in bright light", "Disks floating in dim light"], [[t, a, b] for t, a, b in zip(ts, hi, lo)])
    k1, d1 = sentence_options("More disks floated sooner in bright light than in dim light.", f"In bright light {hi[3]} disks were floating at {ts[3]} minutes, compared with {lo[3]} in dim light.",
        [("More disks floated sooner in dim light than in bright light.", "The table shows more disks floating in bright light at each early time."), ("The same number of disks floated at each time in both light intensities.", "The numbers of floating disks differ between the two light intensities."), ("No disks floated in either light intensity.", "Disks floated in both light intensities.")])
    q1 = mk("bis_leafdisk_set_q1", "3.4", "4.B", "Which statement best describes the data in the table?", k1, d1, rng, concept="describe a comparison of two treatments in a table", path="counts compared at each time vs the generating light effect", material=MAT_TABLE("floating disks"), facts=[f"hi={hi}", f"lo={lo}"], est=55)
    pairs = [("Reports the first time at which at least five disks had floated in bright light.", float(next(t for t, c in zip(ts, hi) if c >= 5))), ("Reports the time at which all ten disks had floated.", float(next((t for t, c in zip(ts, hi) if c >= 10), ts[-1]))), ("Reports the time for the dim light treatment.", e_lo), ("Averages the times at which disks were counted.", float(np.mean(ts)))]
    k2, d2 = val_opts(e_hi, pairs, lambda v: f"{v:.1f} minutes", gap=0.3)
    q2 = mk("bis_leafdisk_set_q2", "3.4", "5.A", "Assuming a steady change between measurements, what is the best estimate of the time at which half of the disks had floated in bright light?", k2, d2, rng, concept="median floating time by interpolation", path="exact fraction interpolation vs the generating logistic midpoint", material=MAT_TABLE("floating disks"), facts=[f"e_hi={e_hi:.4f}"], est=75)
    ratio = e_lo / e_hi
    pairs = [("Divides the time for bright light by the time for dim light.", e_hi / e_lo), ("Subtracts the two times instead of dividing one by the other.", e_lo - e_hi), ("Adds the two times instead of dividing one by the other.", e_lo + e_hi), ("Compares the number of disks floating at the last time.", float(hi[-1]) / max(1, lo[-1]))]
    k3, d3 = val_opts(ratio, pairs, lambda v: f"{v:.1f}", gap=0.12)
    q3 = mk("bis_leafdisk_set_q3", "3.4", "5.A", "Using the times at which half of the disks had floated, the rate of photosynthesis in bright light is how many times the rate in dim light? (Assume that the rate is inversely proportional to the time for half of the disks to float.)", k3, d3, rng, concept="relative rates from times to half floating", path="ratio of interpolated times vs the generating midpoints", material=MAT_TABLE("floating disks"), facts=[f"ratio={ratio:.4f}"], est=90)
    k4, d4 = sentence_options("Disks would float even later than in dim light, because less light energy would drive the light reactions and oxygen production would be slower.", "Less light reduces the output of the light reactions, so less oxygen collects in the disks per minute.",
        [("Disks would float sooner than in bright light, because plants make more oxygen in the dark.", "Photosynthesis needs light and does not make more oxygen in the dark."), ("Disks would float at the same time as in dim light, because light has no effect on oxygen production.", "The data show that light intensity affects the floating time."), ("Disks would float only if carbon dioxide were removed from the solution.", "Removing carbon dioxide would reduce photosynthesis and delay floating.")])
    q4 = mk("bis_leafdisk_set_q4", "3.4", "6.E", "A third treatment places the leaf disks in very dim light, much dimmer than the dim light treatment. Which prediction is best supported by the data and by the process of photosynthesis?", k4, d4, rng, concept="predict the effect of lower light on oxygen production", path="trend of the half-floating time against light vs the light-reaction model", material=MAT_TABLE("floating disks"), facts=[f"e_lo={e_lo:.4f}"], est=70)
    return _set("bis_leafdisk_set", "A student places leaf disks in bicarbonate solution under two light intensities and counts how many of ten disks float over time. Disks float when oxygen from photosynthesis collects inside them. The table shows the data.", stim, [q1, q2, q3, q4], "3.4", "4.B")


STAGE_G = ["bi_dna_bonds_concept", "bi_protein_function_shape", "bi_nucleotide_components", "bi_monomer_hydrolysis", "bi_graph_dose_response", "bi_graph_pcr_cycles"]
STAGE_SETS_G = ["bis_translation_set", "bis_leafdisk_set"]
