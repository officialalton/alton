"""AP Biology P0 원형 D — 단원 7(자연 선택)·8(생태학)."""
import itertools
from bio_common import *  # noqa: F401,F403

# ============================ 단원 7 ============================
bi_natural_selection_conditions = make_bank_archetype("bi_natural_selection_conditions", "7.2", "1.B", [
    B("A population of beetles has green and brown individuals, and the color is heritable. Birds eat green beetles more often than brown beetles on brown tree bark. Which prediction is best supported by the principles of natural selection?",
      ("The proportion of brown beetles in the population will increase over generations.", "Brown beetles survive and reproduce more, passing on the alleles for brown color."),
      [("Individual green beetles will change color to brown during their lives.", "Natural selection acts on populations, and individuals do not change heritable traits in response to need."),
       ("All green beetles will die immediately, and the population will have no variation.", "Natural selection changes frequencies over generations and does not usually remove variation at once."),
       ("The beetles will mutate to brown because the birds create the need for brown.", "Mutations occur randomly and not in response to need.")]),
    B("Which of the following is required for evolution by natural selection to occur in a population?",
      ("Heritable variation among individuals that affects survival or reproduction", "Variation must be heritable and must affect fitness for selection to change allele frequencies."),
      [("Acquired traits that are passed to the offspring", "Traits acquired during an organism's life are not passed to offspring by genetic inheritance."),
       ("A change in the environment that creates new alleles to fit it", "The environment selects among existing variation and does not create alleles to fit it."),
       ("Equal survival and reproduction for all of the individuals", "Differential survival and reproduction are needed for selection.")]),
    B("A student states, 'Giraffes evolved long necks because they stretched to reach leaves.' Which statement best corrects this explanation using natural selection?",
      ("Giraffes with longer necks, due to heritable variation, survived and reproduced more, so long necks became more common.", "Variation in neck length was heritable, and longer-necked individuals left more offspring."),
      [("Stretching changed the genes in each giraffe's cells, and these genes were passed to offspring.", "Stretching does not change the genes passed to offspring."),
       ("Giraffes wanted longer necks, so their offspring developed them.", "Evolution is not driven by the wants of the organisms."),
       ("All giraffes had identical neck lengths, and a few mutated at the same time.", "The explanation depends on variation in the population and not on a sudden simultaneous mutation.")]),
], "apply natural selection to a case and reject acquired-trait and need-driven explanations", "fixed fact bank checked against CED 7.1 and 7.2", est=65)


@retry_sep
def bi_selection_type(rng):
    kind = pick(rng, ["directional", "stabilizing", "disruptive"])
    xs = [i * 0.25 for i in range(0, 41)]
    g = lambda x, m, s: math.exp(-0.5 * ((x - m) / s) ** 2) / (s * math.sqrt(2 * math.pi))  # noqa: E731
    mu = 5.0; sd = 1.0
    before = [40 * g(x, mu, sd) for x in xs]
    if kind == "directional":
        shift = pick(rng, [1.2, 1.5, -1.2, -1.5]); after = [40 * g(x, mu + shift, sd) for x in xs]
    elif kind == "stabilizing":
        after = [40 * g(x, mu, 0.55) for x in xs]
    else:
        after = [20 * g(x, 2.5, 0.8) + 20 * g(x, 7.5, 0.8) for x in xs]
    ya = np.array(after); yb = np.array(before)
    # 독립 경로: 평균·표준편차·봉우리 수로 분류
    def stats(y):
        w = y / y.sum(); m = float((np.array(xs) * w).sum()); v = float((((np.array(xs) - m) ** 2) * w).sum()); peaks = int(((y[1:-1] > y[:-2]) & (y[1:-1] > y[2:])).sum())
        return m, math.sqrt(v), peaks
    mb, sb, pb = stats(yb); ma, sa, pa = stats(ya)
    cls = "disruptive" if pa >= 2 else ("directional" if abs(ma - mb) > 0.5 else ("stabilizing" if sa < sb * 0.8 else "?"))
    agree(0, 0 if cls == kind else 1, 1e-9, "type")
    pk = xs[int(np.argmax(ya))]
    ymax = math.ceil(max(max(before), max(after)) / 5 + 1) * 5
    stim = graph_stim("Distribution of a trait in a population before and after selection", [("Before selection", [[x, round(y, 2)] for x, y in zip(xs, before)]), ("After selection", [[x, round(y, 2)] for x, y in zip(xs, after)])], gaxis("Value of the trait (arbitrary units)", 0, 10, 2), gaxis("Percent of population", 0, ymax, 5))
    texts = {"directional": ("Directional selection, because the whole distribution shifted toward one end of the range.", f"The most common value moved from about 5 before selection to about {pk:g} after selection, so one end of the range was favored."),
             "stabilizing": ("Stabilizing selection, because individuals near the middle of the range were favored.", "The distribution is narrower after selection and still centered near 5, so extreme values were selected against."),
             "disruptive": ("Disruptive selection, because individuals at both ends of the range were favored over intermediate ones.", "After selection there are two peaks, near 2.5 and 7.5, and values near 5 have become rare.")}
    why = {("directional", "stabilizing"): f"After selection the distribution has not become narrower around 5; its peak has moved to about {pk:g}.",
           ("directional", "disruptive"): "After selection there is still a single peak, not two peaks near the two ends of the range.",
           ("stabilizing", "directional"): "The most common value stays near 5 after selection, so the distribution did not shift toward one end.",
           ("stabilizing", "disruptive"): "After selection there is one narrow peak near 5, not two peaks near the two ends of the range.",
           ("disruptive", "directional"): "The distribution did not move as a whole; it split into two peaks near 2.5 and 7.5.",
           ("disruptive", "stabilizing"): "Stabilizing selection would leave one narrower peak near 5, but values near 5 have become rare."}
    wrongs = [(texts[k][0], why[(kind, k)]) for k in texts if k != kind]
    key, ds = sentence_options(texts[kind][0], texts[kind][1], wrongs)
    ds.append(Opt("No selection occurred, because the trait still varies after selection.", False, "Selection can change the position or the shape of the distribution while variation remains.", None))
    stem = "The graph shows the distribution of a heritable trait in a population before selection and after one generation of selection. Which type of selection is most consistent with the graph?"
    return mk("bi_selection_type", "7.2", "2.A", stem, key, ds, rng, concept="identify directional, stabilizing, or disruptive selection from distributions", stim=stim, path="mean, standard deviation, and peak count of the plotted series vs the generating kind", facts=[f"kind={kind}"], judgment="compare the position, width, and number of peaks of two distributions")


@retry_sep
def bi_selection_data_table(rng):
    d_year = pick(rng, [("beak depth", "mm", "finches", "drought", "large, hard seeds were more available than small seeds", 9.2, 9.9), ("beak depth", "mm", "finches", "wet season", "small, soft seeds were more available than large seeds", 9.8, 9.1), ("body length", "mm", "stick insects", "a new predator arrival", "individuals that were well camouflaged on thin twigs survived more", 62.0, 58.4)])
    trait, unit, org, event, why_t, m1, m2 = d_year
    n1 = pick(rng, [120, 150, 200]); n2 = pick(rng, [60, 80, 90])
    inc = m2 > m1
    stim = tbl(f"Mean {trait} of a population of {org} before and after {event}", ["Time", "Number of individuals measured", f"Mean {trait} ({unit})"], [["Before", n1, f"{m1:g}"], ["After one generation", n2, f"{m2:g}"]])
    key, ds = sentence_options(f"The mean {trait} {'increased' if inc else 'decreased'} from {m1:g} to {m2:g} {unit}, consistent with selection favoring {'larger' if inc else 'smaller'} values.", f"The population average changed in the direction expected if individuals with {'larger' if inc else 'smaller'} values of the heritable trait survived and reproduced more.",
        [(f"Each individual's {trait} {'increased' if inc else 'decreased'} during its life in response to {event}, and the individuals passed on this change.", "Changes that individuals acquire during life are not inherited; natural selection acts on heritable variation among individuals."),
         (f"{event.capitalize()} caused new alleles for {'larger' if inc else 'smaller'} {trait} to arise in all individuals at once.", "Mutations occur randomly and not in response to an environmental change."),
         (f"The change from {m1:g} to {m2:g} {unit} shows that the population adapted because it needed to change.", "Populations do not change because they need to; selection acts on existing heritable variation.")])
    stem = f"A researcher measured the {trait} of a population of {org} before and after {event}. The table shows the data. Which statement best uses the data as evidence for natural selection?"
    return mk("bi_selection_data_table", "7.2", "6.B", stem, key, ds, rng, concept="support a claim of selection with before-and-after population data", stim=stim, path="direction of the mean change in the table vs the generating selection pressure", facts=[f"m1={m1}", f"m2={m2}", f"trait={trait}"], judgment="support a claim of natural selection with a population-level change in a heritable trait")


@retry_sep
def bi_fitness_allele_change(rng):
    nAA, nAa, naa = pick(rng, [(60, 80, 60), (40, 100, 60), (90, 80, 30), (30, 90, 80)])
    sAA = nAA - rng.randint(0, 8); sAa = nAa - rng.randint(0, 8); saa = naa - rng.randint(nAA // 4 if False else 20, max(21, naa - 10))
    if saa < 5 or sAA < 5 or sAa < 5:
        raise ValueError("small")
    tot = sAA + sAa + saa
    p_after = (2 * sAA + sAa) / (2 * tot); q_after = 1 - p_after
    # 독립 경로: 생존 개체를 하나씩 대립유전자 목록으로 펼쳐 센다
    alleles = ["A"] * 0
    for _ in range(sAA):
        alleles += ["A", "A"]
    for _ in range(sAa):
        alleles += ["A", "a"]
    for _ in range(saa):
        alleles += ["a", "a"]
    agree(alleles.count("a") / len(alleles), q_after, 1e-9, "q")
    q_before = (nAa + 2 * naa) / (2 * (nAA + nAa + naa))
    pairs = [("Reports the frequency of the allele before selection.", q_before), ("Counts the proportion of homozygous recessive individuals instead of the allele frequency.", saa / tot), ("Counts each heterozygote as having one allele a for the whole genotype but divides by the number of individuals.", (sAa + saa) / tot), ("Reports the frequency of the dominant allele instead of the recessive allele.", p_after)]
    key, ds = val_opts(q_after, pairs, lambda v: f"{hu(v, 2)}", gap=0.02)
    stim = tbl("Number of individuals of each genotype at birth and surviving to reproduce", ["Genotype", "Number at birth", "Number surviving to reproduce"], [["AA", nAA, sAA], ["Aa", nAa, sAa], ["aa", naa, saa]])
    stem = "The table shows the number of individuals of each genotype in a population at birth and the number that survived to reproduce. Which value is the frequency of allele a among the individuals that survived?"
    return mk("bi_fitness_allele_change", "7.4", "5.A", stem, key, ds, rng, concept="allele frequency among survivors after selection", stim=stim, path="allele list built from every surviving individual vs the closed form (Aa + 2 aa) / (2 N)", facts=[f"survivors={sAA},{sAa},{saa}", f"q={q_after:.4f}"], judgment="count alleles, not individuals, among the survivors",
              kwhy=f"The survivors have {2 * tot} alleles in total, and the number of a alleles is {sAa} + 2 x {saa} = {sAa + 2 * saa}. The frequency of a is {sAa + 2 * saa}/{2 * tot} = {q_after:.2f}.")


@retry_sep
def bi_hw_allele_freq(rng):
    q2 = pick(rng, [0.01, 0.04, 0.09, 0.16, 0.25, 0.36, 0.49])
    q = math.sqrt(q2); p = 1 - q
    variant = pick(rng, ["carriers", "p", "homo_dom"])
    # 독립 경로: p^2 + 2pq + q^2 = 1 을 기호로 풀어 p 를 구한다
    ps = sp.symbols("p", positive=True)
    sol = sp.solve(sp.Eq(ps ** 2 + 2 * ps * (1 - ps) + sp.Rational(str(q2)), 1), ps)
    agree(float(sol[0]), p, 1e-9, "p")
    if variant == "carriers":
        val = 2 * p * q
        stem = f"A recessive genetic disorder affects {int(q2 * 100)}% of the individuals in a large population that is in Hardy-Weinberg equilibrium. What proportion of the population is expected to be heterozygous carriers of the allele?"
        pairs = [("Reports the frequency of the recessive allele, q, instead of the carrier frequency.", q), ("Reports the proportion of individuals that are homozygous dominant.", p * p), ("Reports the frequency of the dominant allele.", p), ("Doubles q squared instead of using 2pq.", 2 * q2)]
        kw = f"q^2 = {q2:g}, so q = {q:.2f} and p = 1 - q = {p:.2f}. The proportion of carriers is 2pq = 2({p:.2f})({q:.2f}) = {val:.2f}."
    elif variant == "p":
        val = p
        stem = f"A recessive genetic disorder affects {int(q2 * 100)}% of the individuals in a large population that is in Hardy-Weinberg equilibrium. What is the frequency of the dominant allele?"
        pairs = [("Reports q squared, the proportion of affected individuals.", q2), ("Reports the frequency of the recessive allele, q.", q), ("Subtracts q squared from 1 instead of subtracting q.", 1 - q2), ("Reports the carrier frequency.", 2 * p * q)]
        kw = f"q^2 = {q2:g}, so q = {q:.2f} and the frequency of the dominant allele is p = 1 - q = {p:.2f}."
    else:
        val = p * p
        stem = f"A recessive genetic disorder affects {int(q2 * 100)}% of the individuals in a large population that is in Hardy-Weinberg equilibrium. What proportion of the population is expected to be homozygous dominant?"
        pairs = [("Reports the frequency of the dominant allele, p, instead of p squared.", p), ("Reports the carrier frequency.", 2 * p * q), ("Subtracts the affected proportion from 1, which includes the carriers.", 1 - q2), ("Reports the frequency of the recessive allele.", q)]
        kw = f"q^2 = {q2:g}, so q = {q:.2f} and p = {p:.2f}. The homozygous dominant proportion is p^2 = {val:.2f}."
    key, ds = val_opts(val, pairs, lambda v: f"{hu(v, 2)}", gap=0.02)
    return mk("bi_hw_allele_freq", "7.5", "5.A", stem, key, ds, rng, concept="Hardy-Weinberg: derive allele and genotype frequencies from the recessive phenotype", path="symbolic solution of p^2 + 2pq + q^2 = 1 vs square roots from the phenotype frequency", facts=[f"q2={q2}", f"variant={variant}"], judgment="work from the frequency of the recessive phenotype to q, then to p and the genotype frequencies", kwhy=kw)


@retry_sep
def bi_hw_expected_counts(rng):
    p = pick(rng, [0.6, 0.7, 0.8, 0.4, 0.3]); N = pick(rng, [200, 400, 500, 1000])
    q = 1 - p
    target = pick(rng, ["heterozygous", "homozygous recessive", "homozygous dominant"])
    frac = {"heterozygous": 2 * p * q, "homozygous recessive": q * q, "homozygous dominant": p * p}[target]
    val = frac * N
    # 독립 경로: 개체를 N 마리 만들어 무작위 교배 확률 분포(정확 기대값)를 이항 전개로 구한다
    exp_counts = {g: N * Fr(str(p)).limit_denominator(100) ** a * Fr(str(q)).limit_denominator(100) ** b * c for g, (a, b, c) in {"homozygous dominant": (2, 0, 1), "heterozygous": (1, 1, 2), "homozygous recessive": (0, 2, 1)}.items()}
    agree(float(exp_counts[target]), val, 1e-9, "count")
    pairs = [("Uses p squared for every genotype.", p * p * N), ("Uses q squared for every genotype.", q * q * N), ("Uses 2pq without multiplying by the population size.", 2 * p * q), ("Uses 2p times q squared as the frequency of every genotype.", 2 * p * q * q * N), ("Uses the allele frequency times the population size.", p * N), ("Uses p times q without the factor of 2.", p * q * N)]
    pairs = [(w, v) for w, v in pairs if abs(v - val) > 1e-9]
    key, ds = val_opts(val, pairs, lambda v: f"{v:,.0f}" if v >= 1 else f"{hu(v, 2)}", gap=1, rel=0.05)
    stem = f"In a population of {N} individuals that is in Hardy-Weinberg equilibrium for one gene with two alleles, the frequency of the dominant allele A is {p:g}. How many individuals are expected to be {target}?"
    return mk("bi_hw_expected_counts", "7.5", "5.A", stem, key, ds, rng, concept="expected genotype counts under Hardy-Weinberg equilibrium", path="N x genotype frequency from p, q vs binomial expansion with exact fractions", facts=[f"p={p}", f"N={N}", f"target={target}"], judgment="select the right Hardy-Weinberg term for the genotype and scale it by the population size",
              kwhy=f"With p = {p:g} and q = {q:g}, the expected frequency of {target} individuals is {'2pq' if target == 'heterozygous' else ('q^2' if 'recessive' in target else 'p^2')} = {frac:.3f}. Multiplying by {N} gives {val:,.0f} individuals.")


bi_hw_conditions = make_bank_archetype("bi_hw_conditions", "7.5", "1.B", [
    B("Which set of conditions must be met for a population to remain in Hardy-Weinberg equilibrium?",
      ("Large population, random mating, no migration, no mutation, and no natural selection", "These conditions prevent changes in allele frequencies from one generation to the next."),
      [("Small population, random mating, frequent migration, and strong selection", "A small population, migration, and selection all change allele frequencies."),
       ("Large population, mating between relatives, and a high mutation rate", "Nonrandom mating and mutation change allele or genotype frequencies."),
       ("Any size of population, as long as the alleles are dominant", "Dominance does not determine whether a population is in equilibrium.")]),
    B("A population of wildflowers is in Hardy-Weinberg equilibrium. A strong wind then carries many seeds from a distant population with different allele frequencies into the population. Which prediction is best supported?",
      ("The allele frequencies in the population will change because of gene flow.", "Migration of individuals or gametes adds alleles and alters allele frequencies."),
      [("The allele frequencies will stay the same because Hardy-Weinberg equilibrium is permanent.", "Equilibrium is maintained only if the conditions remain met."),
       ("The alleles will mutate to match those of the new seeds.", "Mutation is not caused by the arrival of new seeds."),
       ("The population will become a different species immediately.", "Gene flow does not by itself produce a new species.")]),
    B("In a very small isolated population of lizards, the frequency of an allele changes randomly from one generation to the next by chance. Which mechanism does this describe?",
      ("Genetic drift", "Random changes in allele frequency are stronger in small populations."),
      [("Natural selection", "Selection is not random; it depends on the effects of the allele on fitness."),
       ("Gene flow", "Gene flow involves movement of alleles between populations."),
       ("Directional mutation", "Mutations are not responsible for the random change in the frequency of the existing allele described.")]),
], "identify conditions and violations of Hardy-Weinberg equilibrium", "fixed fact bank checked against CED 7.5 and 7.4", est=60)

bi_genetic_drift = make_bank_archetype("bi_genetic_drift", "7.4", "1.C", [
    B("A hurricane kills most of a population of mice, and the few survivors happen to have a rare allele at a high frequency. Which term describes this event?",
      ("A bottleneck effect, a type of genetic drift", "A sudden reduction of population size makes allele frequencies change by chance."),
      [("Directional selection, because the hurricane selected the rare allele", "The survivors were not chosen because of the allele; the change was by chance."),
       ("Gene flow, because individuals moved to a new area", "No movement of alleles between populations is described."),
       ("Mutation, because a new allele arose in the survivors", "The allele was already present in the population.")]),
    B("A few individuals from a mainland bird population colonize an island. The island population has allele frequencies that differ from those of the mainland population. Which explanation is most likely?",
      ("A founder effect, because a small founding group carried different allele frequencies", "A small founding group is unlikely to carry the same allele frequencies as the source population."),
      [("The island environment caused all of the birds to mutate.", "Mutation is random and does not occur in all the birds because of the environment."),
       ("The island birds adapted to the mainland environment.", "The birds live on the island and not the mainland."),
       ("The mainland population evolved to become identical to the island population.", "The mainland population is the source; its allele frequencies did not change because of the colonization.")]),
    B("Why does genetic drift have a greater effect on the allele frequencies of small populations than of large populations?",
      ("Chance events shift allele frequencies by more when few individuals are present.", "In small populations random sampling of alleles has larger effects from generation to generation."),
      [("Small populations have more mutations than large populations per individual.", "Mutation rates per individual do not depend on population size in this way."),
       ("Natural selection does not occur in small populations.", "Selection occurs in small populations, though drift can overpower it."),
       ("Small populations have no genetic variation at all.", "Small populations may have less variation, but variation is not absent.")]),
], "relate population size and chance events to changes in allele frequency", "fixed fact bank checked against CED 7.4 and 7.11", est=65)


@retry_sep
def bi_phylo_characters(rng):
    taxa = rng.sample(["A", "B", "C", "D"], 4)
    X, Y, Z, W = taxa  # X,Y 가장 가까움, Z 는 X,Y 와 c2 공유, W 는 c1 만
    chars = ["Character 1", "Character 2", "Character 3", "Character 4"]
    has = {"Outgroup": [0, 0, 0, 0], X: [1, 1, 1, 0], Y: [1, 1, 1, 1], Z: [1, 1, 0, 0], W: [1, 0, 0, 0]}
    rows = [[t] + ["+" if v else "-" for v in has[t]] for t in ["Outgroup", "A", "B", "C", "D"] if t in has]
    pairs_ = list(itertools.combinations(sorted([X, Y, Z, W]), 2))
    share = {p_: sum(1 for k in range(4) if has[p_[0]][k] and has[p_[1]][k]) for p_ in pairs_}
    best = max(share, key=lambda k: share[k])
    agree(0, 0 if best == tuple(sorted([X, Y])) and list(share.values()).count(share[best]) == 1 else 1, 1e-9, "best")
    key = Opt(f"Taxa {best[0]} and {best[1]}, because they share the most derived characters", True, f"Taxa {best[0]} and {best[1]} share characters 1, 2, and 3, more shared derived characters than any other pair, which indicates the most recent common ancestor.", None)
    pr2 = lambda a_, b_: " and ".join(sorted([a_, b_]))  # noqa: E731
    ds = [Opt(f"Taxa {pr2(W, Z)}, because they both have character 1", False, "Character 1 is present in every taxon of the ingroup, so sharing it gives no information about which pair is most closely related.", None),
          Opt(f"Taxa {pr2(Y, W)}, because taxon {Y} has the most characters", False, f"Taxon {Y} has the most characters because of character 4, which no other taxon has; a character found in only one taxon does not show a relationship.", None),
          Opt(f"Taxa {pr2(X, Z)}, because they share characters 1 and 2", False, f"Taxa {X} and {Z} share only characters 1 and 2, while the best pair also shares character 3, so they are less closely related.", None)]
    rows = sorted([[t] + ["+" if v else "-" for v in has[t]] for t in has], key=lambda r: (r[0] != "Outgroup", r[0]))
    stim = tbl("Presence (+) or absence (-) of derived characters in four taxa and an outgroup", ["Taxon"] + chars, rows)
    stem = "The table shows which of four derived characters are present in four taxa and in an outgroup. Which two taxa are most closely related?"
    return mk("bi_phylo_characters", "7.9", "2.B", stem, key, ds, rng, concept="infer relatedness from shared derived characters", stim=stim, path="count of shared derived characters for every pair vs the generating nested pattern", facts=[f"has={has}"], judgment="use shared derived characters, not ancestral or unique ones, to rank relatedness")


@retry_sep
def bi_phylo_dna_data(rng):
    sp_ = rng.sample(["P", "Q", "R", "S"], 4)
    a, b, c, d = sp_  # (a,b) 가장 최근, c 는 a,b 와 중간, d 가 가장 멀다
    t1 = rng.randint(2, 5); t2 = t1 + rng.randint(3, 6); t3 = t2 + rng.randint(3, 6)
    dist = {frozenset((a, b)): 2 * t1, frozenset((a, c)): 2 * t2, frozenset((b, c)): 2 * t2, frozenset((a, d)): 2 * t3, frozenset((b, d)): 2 * t3, frozenset((c, d)): 2 * t3}
    order = sorted(sp_)
    rows = []
    for r_ in order:
        rows.append([r_] + ["-" if r_ == c_ else str(dist[frozenset((r_, c_))]) for c_ in order])
    best = min(dist, key=lambda k: dist[k])
    agree(0, 0 if best == frozenset((a, b)) and list(dist.values()).count(dist[best]) == 1 else 1, 1e-9, "best")
    pr = lambda s: " and ".join(sorted(s))  # noqa: E731
    key = Opt(f"Species {pr(frozenset((a, b)))}, because they differ at the fewest nucleotide positions", True, f"Species {pr(frozenset((a, b)))} differ at only {dist[best]} positions, the smallest difference, so they diverged most recently.", None)
    ds = []
    for k, v in sorted(dist.items(), key=lambda kv: kv[1]):
        if k == best or len(ds) == 3:
            continue
        ds.append(Opt(f"Species {pr(k)}, because they differ at the fewest nucleotide positions", False, f"Species {pr(k)} differ at {v} positions, more than the closest pair, so their common ancestor is older.", None))
    stim = tbl("Number of nucleotide differences in the same gene between pairs of species", ["Species"] + order, rows)
    stem = "The table shows the number of nucleotide differences in a gene between pairs of four species. Assuming differences accumulate at a constant rate, which two species shared a common ancestor most recently?"
    return mk("bi_phylo_dna_data", "7.9", "4.B", stem, key, ds, rng, concept="infer the most recent divergence from sequence differences", stim=stim, path="minimum of the pairwise table vs the generating divergence times", facts=[f"dist={sorted(dist.values())}"], judgment="relate fewer differences to a more recent common ancestor")


@retry_sep
def bi_molecular_clock(rng):
    r = pick(rng, [1, 2, 3, 4]); T = pick(rng, [4, 5, 6, 8, 10, 12])
    d = 2 * r * T
    # 독립 경로: 시간을 한 단위씩 늘려 두 계통의 누적 차이가 d 가 되는 때를 찾는다
    t = 0; diff = 0
    while diff < d:
        t += 1; diff += 2 * r
    agree(t, T, 1e-9, "T")
    pairs = [("Divides by the rate for only one lineage, forgetting that both lineages accumulate differences.", d / r), ("Multiplies the differences by the rate.", d * r), ("Divides by twice the rate and then by two again.", d / (4 * r)), ("Doubles the number of differences before dividing.", 2 * d / r)]
    key, ds = val_opts(T, pairs, lambda v: f"{v:g} million years", gap=0.4, rel=0.08)
    stem = f"Two species differ at {d} nucleotide positions in a gene. In each lineage, this gene accumulates {r} difference{'s' if r > 1 else ''} per million years. Assuming a constant rate, how long ago did the two species share a common ancestor?"
    return mk("bi_molecular_clock", "7.7", "5.A", stem, key, ds, rng, concept="divergence time from sequence differences with changes accumulating in both lineages", path="time-stepping loop adding differences from both lineages vs d / (2r)", facts=[f"d={d}", f"r={r}", f"T={T}"], judgment="count differences from both lineages when using a molecular clock", kwhy=f"Both lineages accumulate {r} per million years, so the pair diverges by 2 x {r} = {2 * r} per million years. {d} / {2 * r} = {T} million years.")


bi_evidence_evolution = make_bank_archetype("bi_evidence_evolution", "7.6", "1.A", [
    B("The forelimbs of humans, cats, whales, and bats have the same arrangement of bones but are used for different functions. Which term describes these structures and what do they suggest?",
      ("Homologous structures, which suggest descent from a common ancestor", "Similar underlying structure with different functions suggests common ancestry."),
      [("Analogous structures, which suggest that the species evolved independently for similar functions", "Analogous structures share function but not underlying structure."),
       ("Vestigial structures, which suggest that the limbs no longer function", "The limbs are functional, so they are not vestigial."),
       ("Convergent structures, which suggest that the species share the same environment", "These species live in different environments and have a shared structure.")]),
    B("The wings of a butterfly and the wings of a bird both allow flight, but they have very different internal structures and developmental origins. Which conclusion is best supported?",
      ("They are analogous structures that evolved independently under similar selective pressures.", "Similar function with different structure suggests convergent evolution."),
      [("They are homologous structures inherited from a recent common ancestor with wings.", "Different structures and origins do not support homology."),
       ("They are vestigial structures that no longer function in flight.", "Both wings function in flight."),
       ("They prove that butterflies and birds are closely related.", "Analogous structures do not indicate close relationship.")]),
    B("Fossils of an extinct species are found in rock layers older than those containing fossils of a related species with a similar but more modified structure. Which type of evidence does this represent?",
      ("Fossil evidence showing change in structures over time", "Layers of fossils can show how a lineage changed over time."),
      [("Biochemical evidence of shared DNA sequences", "The evidence described is from fossils and not from sequences."),
       ("Evidence from embryology showing similar development", "No embryonic development is described."),
       ("Geographic evidence of the movement of populations to islands", "The evidence is based on position in rock layers.")]),
], "interpret structural and fossil evidence for evolution", "fixed fact bank checked against CED 7.6", est=60)

bi_common_ancestry = make_bank_archetype("bi_common_ancestry", "7.7", "6.B", [
    B("All known organisms use DNA or RNA as genetic material and share nearly the same genetic code. Which claim does this evidence best support?",
      ("All living things share a common ancestor.", "A shared genetic code and similar molecules are consistent with common descent."),
      [("All organisms have the same genes.", "Organisms share the code, but they have different genes."),
       ("Organisms evolved the genetic code separately in each species.", "A shared code across all organisms is unlikely if it arose separately in each."),
       ("Organisms can pass acquired traits to their offspring through DNA.", "The shared code does not show that acquired traits are inherited.")]),
    B("Scientists compare the amino acid sequence of cytochrome c in several species. Humans and chimpanzees have identical sequences, while humans and yeast differ at many positions. Which conclusion is best supported?",
      ("Humans and chimpanzees share a more recent common ancestor than humans and yeast.", "Fewer differences in a conserved protein indicate a more recent divergence."),
      [("Humans evolved from chimpanzees because their sequences are identical.", "Identical sequences suggest a shared ancestor, not descent from each other."),
       ("Yeast evolved from humans because they have the same protein.", "Having the same protein does not show descent in this direction."),
       ("Cytochrome c does not change over time in any lineage.", "The differences among species show that the sequence has changed.")]),
], "use molecular evidence to support a claim of common ancestry", "fixed fact bank checked against CED 7.7", est=60)

bi_speciation = make_bank_archetype("bi_speciation", "7.10", "1.B", [
    B("A river splits a population of squirrels into two groups. Over many generations the two groups become unable to interbreed. Which type of speciation is most likely?",
      ("Allopatric speciation, in which geographic separation leads to reproductive isolation", "A physical barrier separates the populations, and they diverge."),
      [("Sympatric speciation, in which populations in the same area diverge", "The groups were separated by a geographic barrier."),
       ("Convergent evolution, in which unrelated species become similar", "Convergent evolution does not describe the splitting of one population."),
       ("Adaptive radiation, in which a species disappears quickly", "Adaptive radiation involves rapid diversification and not the formation of a barrier.")]),
    B("Two species of frogs live in the same pond. One species breeds in early spring and the other in late summer. Which type of reproductive barrier keeps them from interbreeding?",
      ("A temporal prezygotic barrier, because the breeding times differ", "Differences in timing prevent mating before a zygote forms."),
      [("A postzygotic barrier, because their offspring are sterile", "The species do not mate, so no offspring are produced."),
       ("A geographic barrier, because they live far apart", "The two species live in the same pond."),
       ("A mechanical barrier, because their bodies do not fit together", "The scenario describes differences in timing and not in structure.")]),
    B("A plant species arises in a single generation when an error in meiosis doubles the chromosome number, and the new plants can no longer breed with the parent population. Which mechanism is this?",
      ("Polyploidy, a form of sympatric speciation", "A change in chromosome number can quickly produce reproductive isolation without a geographic barrier."),
      [("Allopatric speciation caused by a mountain range", "No geographic barrier is described."),
       ("Natural selection for taller plants", "The scenario describes a change in chromosome number and not selection for a trait."),
       ("Gene flow from a related species", "Gene flow would reduce divergence and not isolate the new plants.")]),
], "classify speciation mechanisms and reproductive barriers", "fixed fact bank checked against CED 7.10", est=65)

bi_continuing_evolution = make_bank_archetype("bi_continuing_evolution", "7.8", "6.E", [
    B("A hospital treats a bacterial infection with an antibiotic. A few bacteria carry an allele that makes them resistant. Which prediction is best supported if treatment continues?",
      ("The frequency of the resistance allele in the bacterial population will increase.", "Resistant bacteria survive and reproduce more under treatment, so the allele becomes more common."),
      [("Each bacterium will develop resistance because it is exposed to the drug.", "Exposure does not cause resistance alleles to appear in each bacterium."),
       ("The resistance allele will disappear because it is costly.", "In the presence of the antibiotic, resistance is advantageous."),
       ("The antibiotic will cause the bacteria to mutate toward resistance.", "Antibiotics select among existing variation and do not direct mutations.")]),
    B("Insecticide use on a crop kills most of the insects, but a few survive and reproduce. Several generations later, the insecticide is less effective. Which explanation is best supported?",
      ("Insects with heritable resistance survived and reproduced more, so resistance became more common.", "The population changed because resistant individuals contributed more offspring."),
      [("The insects learned to avoid the insecticide and taught their offspring.", "Learned behavior does not explain a heritable change in resistance."),
       ("The insecticide became weaker over time on its own.", "The change is in the population and not in the insecticide."),
       ("All insects changed their DNA at the same time to survive.", "Mutations do not occur in all individuals at once to meet a need.")]),
    B("The influenza virus changes each year, and a new vaccine is needed. Which statement best explains this change?",
      ("Mutations in the virus generate variation, and selection favors variants that escape immunity.", "Viruses mutate rapidly, and variants that avoid immune responses spread."),
      [("The virus changes only when people receive vaccines, in order to survive.", "Mutations occur whether or not a vaccine is given."),
       ("People pass acquired immunity to the viral population.", "Immunity in humans is not passed on to the virus."),
       ("The virus stops evolving once it infects humans.", "Viral populations continue to evolve in humans.")]),
], "predict evolutionary change in populations under human-caused selection", "fixed fact bank checked against CED 7.8", est=65)

bi_artificial_selection = make_bank_archetype("bi_artificial_selection", "7.3", "1.C", [
    B("Farmers have produced many varieties of cabbage, kale, and broccoli from one wild plant by choosing which plants to breed. Which statement best describes this process?",
      ("Humans select individuals with desired traits to reproduce, increasing the frequency of those traits.", "Artificial selection chooses breeders on the basis of traits, changing allele frequencies."),
      [("The environment selects traits without human influence, as in natural selection.", "In artificial selection the selecting agent is human choice."),
       ("The plants change their genes to meet the needs of the farmers.", "Traits are not produced by the need of the plants or farmers."),
       ("Mutations are produced by the farmers in order to make new varieties.", "Farmers select from existing variation and do not direct mutations.")]),
    B("Breeders mate only dogs with very short legs to produce a breed with short legs. Which long-term consequence is most likely in this breed?",
      ("Reduced genetic variation, which can increase the frequency of harmful recessive traits", "Breeding from a small set of individuals lowers variation and can increase homozygosity."),
      [("Increased genetic variation because the breeders choose the best dogs", "Selecting a few individuals tends to reduce variation."),
       ("Unchanged allele frequencies because humans are not part of natural selection", "Selective breeding changes allele frequencies."),
       ("A guarantee that all offspring will have no health problems", "Reduced variation can increase health problems.")]),
], "describe artificial selection and its consequences", "fixed fact bank checked against CED 7.3", est=60)

bi_variation_populations = make_bank_archetype("bi_variation_populations", "7.11", "1.C", [
    B("A new disease spreads through two populations of a plant species. One population has high genetic variation and the other has very little. Which prediction is best supported?",
      ("The population with high variation is more likely to contain some resistant individuals that survive.", "Greater variation increases the chance that some individuals have alleles for resistance."),
      [("The population with little variation is more likely to survive because its plants are identical.", "A genetically uniform population can be wiped out by one pathogen."),
       ("Both populations are equally likely to survive because variation does not affect survival.", "Variation provides the raw material for adaptation."),
       ("The population with high variation will be more likely to go extinct because of its diversity.", "High variation generally improves the chance of survival in a changing environment.")]),
    B("Which process is the original source of new alleles in a population?",
      ("Mutation", "Mutations create new alleles that can then be shuffled by sexual reproduction."),
      [("Natural selection", "Selection changes the frequencies of existing alleles."),
       ("Genetic drift", "Drift changes the frequencies of alleles by chance."),
       ("Crossing over", "Crossing over shuffles existing alleles into new combinations.")]),
], "explain the importance of variation in populations", "fixed fact bank checked against CED 7.11", est=55)

bi_origin_of_life = make_bank_archetype("bi_origin_of_life", "7.12", "6.B", [
    B("In an experiment, scientists passed electrical sparks through a mixture of water, methane, ammonia, and hydrogen and later detected amino acids. Which claim does the experiment best support?",
      ("Organic molecules can form from simple inorganic ones under early-Earth conditions.", "The result shows that building blocks of life can form abiotically."),
      [("Living cells were created in the experiment from nonliving matter.", "Only organic molecules, not living cells, were produced."),
       ("Early Earth contained oxygen-rich air that supported cells.", "The mixture used conditions with little oxygen."),
       ("Amino acids can form only in living cells.", "The experiment showed amino acids forming without cells.")]),
    B("The RNA world hypothesis proposes that RNA was an early genetic material. Which observation provides support for this hypothesis?",
      ("Some RNA molecules can catalyze reactions, as well as store information.", "Catalytic RNA molecules show that RNA can perform functions now carried out by proteins."),
      [("RNA is more chemically stable than DNA, so it can store information for longer times.", "DNA is generally more stable than RNA."),
       ("All modern enzymes are made of RNA.", "Most enzymes are proteins."),
       ("DNA cannot be copied in living cells.", "DNA is copied by cells every cell cycle.")]),
], "evaluate evidence about the origin of life", "fixed fact bank checked against CED 7.12", est=65)


@retry_sep
def bi_allele_freq_graph(rng):
    seed = rng.randrange(10 ** 6)
    gens = list(range(0, 31))
    def sim(N, rs):
        p = 0.5; out = [p]
        for _ in gens[1:]:
            p = rs.binomial(2 * N, p) / (2 * N); out.append(p)
        return out
    small = sim(20, np.random.RandomState(seed)); large = sim(500, np.random.RandomState(seed + 1))
    # 독립 경로: 두 경로의 세대 간 변화 크기(평균 절대 차이)와 최대 이탈 폭을 모두 비교
    d_s = float(np.mean(np.abs(np.diff(small)))); d_l = float(np.mean(np.abs(np.diff(large))))
    dev_s = max(abs(x - 0.5) for x in small); dev_l = max(abs(x - 0.5) for x in large)
    if not (d_s > 2.2 * d_l and dev_s > 1.4 * dev_l and dev_l < 0.15):
        raise ValueError("not_clear")
    first = pick(rng, ["X", "Y"])
    names = {"small": "Population " + first, "large": "Population " + ("Y" if first == "X" else "X")}
    key, ds = sentence_options(f"{names['small']} is more likely to be the smaller population, because chance has a larger effect on allele frequencies in small populations.", f"{names['small']}'s allele frequency fluctuates much more from generation to generation, as expected for genetic drift in a small population.",
        [(f"{names['large']} is more likely to be the smaller population, because its allele frequency changes more slowly.", "Slow change is expected in a large population, in which chance effects are small."),
         (f"{names['small']} is more likely to be the larger population, because it has more genetic variation to change.", "The large fluctuations show strong drift, which occurs in small populations."),
         ("Both populations are the same size, because the allele frequency started at the same value in each.", "Starting at the same value does not make the populations equal in size; their behavior differs.")])
    curves = [(names["small"].replace("Population ", ""), [[g, round(v, 3)] for g, v in zip(gens, small)]), (names["large"].replace("Population ", ""), [[g, round(v, 3)] for g, v in zip(gens, large)])]
    curves.sort(key=lambda c: c[0])
    stim = graph_stim("Frequency of an allele over 30 generations in populations X and Y", curves, gaxis("Generation", 0, 30, 5), gaxis("Frequency of the allele", 0, 1.0, 0.2))
    stem = "The graph shows the frequency of one allele over 30 generations in two populations. Both populations started at the same frequency, and no selection acted on the allele. Which statement is best supported by the graph?"
    return mk("bi_allele_freq_graph", "7.4", "2.B", stem, key, ds, rng, concept="relate the size of fluctuations in allele frequency to population size", stim=stim, path="mean absolute generation-to-generation change and maximum deviation of each simulated series vs the generating population sizes", facts=[f"seed={seed}", f"d_s={d_s:.4f}", f"d_l={d_l:.4f}"], judgment="relate fluctuations in a graph to genetic drift in small populations")


@retry_sep
def bi_antibiotic_data(rng):
    g0 = pick(rng, [2, 3, 5]); step = pick(rng, [12, 15, 20, 25])
    pct = [min(98, g0 + step * i) for i in range(5)]
    gens = [1, 2, 3, 4, 5]
    stim = tbl("Percent of bacteria in a culture that are resistant to an antibiotic over five generations of growth in the presence of the antibiotic", ["Generation", "Percent resistant"], [[g, p_] for g, p_ in zip(gens, pct)])
    key, ds = sentence_options(f"The percent of resistant bacteria increased from {pct[0]}% to {pct[-1]}%, because resistant bacteria survived and reproduced more in the presence of the antibiotic.", "The data show a heritable trait becoming more common because it improved survival and reproduction, which is natural selection.",
        [("The antibiotic caused each bacterium to become resistant during the experiment, so the percent increased.", "Resistance arose from existing variation; exposure did not make individual bacteria resistant."),
         (f"The percent of resistant bacteria increased from {pct[0]}% to {pct[-1]}%, because the bacteria needed to become resistant.", "Populations do not change because they need to; selection favored existing resistance alleles."),
         ("The increase shows that the antibiotic stopped working because the bacteria developed a habit of avoiding it.", "Bacteria do not learn habits; resistance is a heritable trait.")])
    stem = "A culture of bacteria was grown for five generations in the presence of an antibiotic. The table shows the percent of bacteria that were resistant. Which statement best explains the data?"
    return mk("bi_antibiotic_data", "7.8", "6.B", stem, key, ds, rng, concept="use a time course of resistance as evidence of natural selection", stim=stim, path="trend of the table (monotonic increase) vs the generating selection model", facts=[f"pct={pct}"], judgment="explain a change in population composition using survival and reproduction")


# ============================ 단원 8 ============================
@retry_sep
def bi_pop_growth_calc(rng):
    N = pick(rng, [1000, 2000, 5000, 8000]); B_ = pick(rng, [160, 240, 320, 400]); D = pick(rng, [60, 80, 120, 160])
    if B_ <= D:
        raise ValueError("neg")
    variant = pick(rng, ["rate", "per_capita"])
    if variant == "rate":
        val = B_ - D
        # 독립 경로: 한 해 동안 개체를 더하고 빼는 단순 계산(시뮬레이션)
        pop = N
        pop += B_; pop -= D
        agree(pop - N, val, 1e-9, "dN")
        pairs = [("Adds the number of births and deaths instead of subtracting.", B_ + D), ("Divides the births by the deaths.", B_ / D), ("Reports only the number of births.", B_), ("Divides the net change by the population size.", (B_ - D) / N)]
        key, ds = val_opts(val, pairs, lambda v: f"{v:g}" if v >= 1 else f"{hu(v, 3)}", gap=0.002, rel=0.08)
        stem = f"A population of {N:,} deer has {B_} births and {D} deaths in one year. Using the equation dN/dt = B - D, how many individuals does the population gain per year?"
        kw = f"dN/dt = B - D = {B_} - {D} = {val} individuals per year."
    else:
        val = (B_ - D) / N
        pop = N + B_ - D
        agree((pop - N) / N, val, 1e-9, "r")
        pairs = [("Reports the net change without dividing by the population size.", B_ - D), ("Divides the births alone by the population size.", B_ / N), ("Divides the deaths alone by the population size.", D / N), ("Adds the birth and death rates instead of subtracting.", (B_ + D) / N)]
        key, ds = val_opts(val, pairs, lambda v: f"{hu(v, 3)}" if v < 1 else f"{v:g}", gap=0.002, rel=0.08)
        stem = f"A population of {N:,} deer has {B_} births and {D} deaths in one year. What is the per capita growth rate of the population per year?"
        kw = f"The net change is B - D = {B_} - {D} = {B_ - D} per year. Divided by the population size, the per capita rate is {B_ - D}/{N:,} = {val:.3f} per individual per year."
    return mk("bi_pop_growth_calc", "8.3", "5.A", stem, key, ds, rng, concept="population growth rate from births and deaths", path="simulated yearly update of the population vs dN/dt = B - D", facts=[f"N={N}", f"B={B_}", f"D={D}", f"variant={variant}"], judgment="use the net change, and divide by population size for a per capita rate", kwhy=kw)


@retry_sep
def bi_exp_growth(rng):
    N = pick(rng, [200, 500, 800, 1000, 2000]); r = pick(rng, [0.02, 0.04, 0.05, 0.1])
    val = r * N
    h = 1e-6
    num_ = (N * math.exp(r * h) - N) / h
    agree(num_, val, 1e-4, "dNdt")
    pairs = [("Divides the population size by the growth rate.", N / r), ("Adds the growth rate to the population size.", N + r), ("Multiplies the population size by one plus the growth rate.", N * (1 + r)), ("Divides the growth rate by the population size.", r / N), ("Uses the square of the population size.", r * N * N)]
    key, ds = val_opts(val, pairs, lambda v: f"{v:,.0f}" if v >= 10 else f"{hu(v, 3)}", gap=0.002, rel=0.08)
    stem = f"A population of bacteria with {N:,} cells is growing exponentially with a maximum per capita growth rate of {r} per hour. Using the equation dN/dt = r_max N, what is the population growth rate at this moment, in cells per hour?"
    return mk("bi_exp_growth", "8.3", "5.A", stem, key, ds, rng, concept="exponential growth rate dN/dt = r_max N", path="direct product vs a numerical derivative of N(t) = N0 exp(rt)", facts=[f"N={N}", f"r={r}", f"dNdt={val}"], judgment="apply the exponential growth equation", kwhy=f"dN/dt = r_max N = ({r})({N:,}) = {val:,.2f} cells per hour.")


@retry_sep
def bi_logistic(rng):
    K = pick(rng, [500, 800, 1000, 2000]); frac = pick(rng, [0.2, 0.4, 0.5, 0.6, 0.8]); N = int(K * frac); r = pick(rng, [0.2, 0.3, 0.5])
    val = r * N * (K - N) / K
    h = 1e-6
    A = (K - N) / N
    Nt = lambda t: K / (1 + A * math.exp(-r * t))  # noqa: E731
    num_ = (Nt(h) - Nt(0)) / h
    agree(num_, val, 1e-4, "dNdt")
    pairs = [("Ignores the effect of the carrying capacity and uses exponential growth.", r * N), ("Leaves out the division by K, using r N (K - N) in place of r N (K - N)/K.", r * N * (K - N)), ("Uses N/K in place of (K - N)/K, so the term grows as the population approaches K.", r * N * N / K), ("Reports the carrying capacity minus the population size.", K - N), ("Multiplies by (K + N)/K instead of by (K - N)/K.", r * N * (K + N) / K)]
    key, ds = val_opts(val, pairs, lambda v: f"{v:,.0f}", gap=1, rel=0.08)
    stem = f"A population of {N:,} individuals lives in an environment with a carrying capacity (K) of {K:,}. The maximum per capita growth rate is {r} per year. Using the logistic growth equation dN/dt = r_max N (K - N)/K, what is the population growth rate, in individuals per year?"
    return mk("bi_logistic", "8.4", "5.A", stem, key, ds, rng, concept="logistic growth rate with the carrying-capacity term", path="formula evaluation vs numerical derivative of the closed-form logistic solution", facts=[f"K={K}", f"N={N}", f"r={r}", f"val={val}"], judgment="include the (K - N)/K term for density dependence", kwhy=f"dN/dt = r_max N (K - N)/K = ({r})({N:,})({K - N:,}/{K:,}) = {val:,.0f} individuals per year.")


@retry_sep
def bi_growth_graph_K(rng):
    K = pick(rng, [400, 600, 800, 1000, 1200]); r = pick(rng, [0.4, 0.5, 0.6]); N0 = pick(rng, [10, 20, 40])
    ts = list(range(0, 31))
    Nt = [K / (1 + (K - N0) / N0 * math.exp(-r * t)) for t in ts]
    ymax = math.ceil(K * 1.2 / 200) * 200
    plateau = float(np.mean(Nt[-5:]))
    agree(plateau, K, 0.01, "K")
    pairs = [("Reads the population size at 10 days, which is still increasing.", Nt[10]), ("Reads the highest value of the y axis rather than the plateau.", float(ymax)), ("Reads the starting population size.", float(N0)), ("Reads half of the plateau, where growth is fastest.", K / 2)]
    key, ds = val_opts(float(K), pairs, lambda v: f"{int(round(v, -1)):,}" if v >= 100 else f"{int(round(v)):,}", gap=25, rel=0.08)
    stim = graph_stim("Size of a population over time", [("Population size", [[t, round(n, 1)] for t, n in zip(ts, Nt)])], gaxis("Time (days)", 0, 30, 5), gaxis("Number of individuals", 0, ymax, ymax // 6 if ymax % 6 == 0 else 200))
    stem = "The graph shows the size of a population of organisms over time in a new habitat. Which value is the best estimate of the carrying capacity of the habitat?"
    return mk("bi_growth_graph_K", "8.4", "2.A", stem, key, ds, rng, concept="carrying capacity is the plateau of a logistic curve", stim=stim, path="mean of the last plotted values vs the generating K", facts=[f"K={K}", f"r={r}", f"N0={N0}"], judgment="read the plateau of a growth curve", kwhy=f"The curve levels off at about {K:,}, which is the carrying capacity.")


@retry_sep
def bi_growth_graph_fastest(rng):
    K = pick(rng, [400, 600, 800, 1000]); r = pick(rng, [0.4, 0.5, 0.6]); N0 = pick(rng, [10, 20])
    ts = list(range(0, 31))
    Nt = [K / (1 + (K - N0) / N0 * math.exp(-r * t)) for t in ts]
    slopes = np.diff(Nt)
    i = int(np.argmax(slopes)); n_fast = (Nt[i] + Nt[i + 1]) / 2
    agree(n_fast, K / 2, 0.16, "half")
    ymax = math.ceil(K * 1.2 / 200) * 200
    pairs = [("Chooses the carrying capacity, where the population stops growing.", float(K)), ("Chooses the initial population size.", float(N0)), ("Chooses three quarters of the carrying capacity.", 0.75 * K), ("Chooses one quarter of the carrying capacity.", 0.25 * K)]
    key, ds = val_opts(K / 2, pairs, lambda v: f"{int(round(v)):,}", gap=20, rel=0.08)
    stim = graph_stim("Size of a population over time", [("Population size", [[t, round(n, 1)] for t, n in zip(ts, Nt)])], gaxis("Time (days)", 0, 30, 5), gaxis("Number of individuals", 0, ymax, ymax // 6 if ymax % 6 == 0 else 200))
    stem = f"The graph shows the size of a population over time. The carrying capacity of the habitat is {K:,} individuals. At approximately what population size is the population growing fastest?"
    return mk("bi_growth_graph_fastest", "8.4", "2.B", stem, key, ds, rng, concept="logistic growth is fastest at half the carrying capacity", stim=stim, path="largest increase between successive plotted points vs K/2", facts=[f"K={K}", f"r={r}"], judgment="relate the steepest part of the curve to the population size", kwhy=f"The curve is steepest when the population is about K/2 = {K // 2:,} individuals, because both N and (K - N)/K are large there.")


bi_density_factor = make_bank_archetype("bi_density_factor", "8.4", "1.B", [
    B("Which of the following is an example of a density-dependent factor that limits population growth?",
      ("The spread of a contagious disease that spreads faster in crowded populations", "The impact of disease increases as the density of the population increases."),
      [("A wildfire that kills organisms regardless of population density", "A wildfire affects organisms regardless of density and is density-independent."),
       ("A volcanic eruption that buries a habitat", "An eruption affects organisms regardless of density."),
       ("A severe freeze that kills organisms in the area", "A freeze acts regardless of density.")]),
    B("A population of deer grows until food becomes scarce, and then the death rate rises and the birth rate falls. Which statement best describes this pattern?",
      ("Resource limitation is a density-dependent factor that reduces population growth as density increases.", "As the density rises, competition for food intensifies and growth slows."),
      [("Resource limitation is a density-independent factor that affects all populations equally.", "Competition for resources depends on how many individuals share them."),
       ("The deer population will grow without limit because food is a renewable resource.", "No population grows without limit; resources constrain it."),
       ("The carrying capacity increases as the population increases.", "The carrying capacity is set by the environment and does not increase because the population grows.")]),
], "classify limiting factors as density-dependent or density-independent", "fixed fact bank checked against CED 8.4", est=60)


@retry_sep
def bi_trophic_energy(rng):
    E = pick(rng, [10000, 20000, 50000, 100000]); level = pick(rng, [3, 4])
    names = {3: "secondary consumers", 4: "tertiary consumers"}
    # 독립 경로: 영양 단계를 한 단계씩 올라가며 10 % 만 남긴다
    cur = float(E)
    for _ in range(level - 1):
        cur *= 0.1
    val = E * 0.1 ** (level - 1)
    agree(cur, val, 1e-9, "E")
    pairs = [("Counts one extra trophic transfer, applying 10 percent once too many times.", E * 0.1 ** level), ("Counts one fewer trophic transfer, applying 10 percent once too few times.", E * 0.1 ** (level - 2)), ("Applies 10 percent only once, regardless of the trophic level.", E * 0.1), ("Divides the energy of the producers by the number of trophic levels.", E / level)]
    key, ds = val_opts(val, pairs, lambda v: f"{v:,.0f} kcal" if v >= 1 else f"{hu(v, 2)} kcal", gap=0.05, rel=0.08)
    stem = f"The producers in an ecosystem fix {E:,} kcal of energy. Assuming that 10 percent of the energy is transferred from each trophic level to the next, how much energy is available to the {names[level]}?"
    return mk("bi_trophic_energy", "8.2", "5.A", stem, key, ds, rng, concept="10 percent energy transfer between trophic levels", path="repeated multiplication by 0.1 per trophic transfer vs E x 0.1^(level - 1)", facts=[f"E={E}", f"level={level}"], judgment="count the transfers between the producer level and the consumer level", kwhy=f"The {names[level]} are {level - 1} transfers above the producers, so the energy is {E:,} x 0.1^{level - 1} = {val:,.0f} kcal.")


bi_food_web_prediction = make_bank_archetype("bi_food_web_prediction", "8.5", "6.E", [
    B("In a rocky intertidal community, sea stars prey on mussels, which are the dominant competitor for space. If sea stars are removed, which outcome is most likely?",
      ("Mussels will increase and outcompete other species, which will reduce species diversity.", "Removing a keystone predator allows the dominant competitor to take over."),
      [("Mussels will decrease because they depend on sea stars for food.", "Mussels are prey, not dependent on sea stars for food."),
       ("Species diversity will increase because predators reduce the space available to other species.", "In this community predation by sea stars keeps mussels from dominating, so diversity falls without them."),
       ("The community will be unchanged because predators have no effect on community structure.", "A keystone predator has a large effect on community structure.")]),
    B("In a food chain, grass is eaten by rabbits, and rabbits are eaten by foxes. A disease sharply reduces the number of rabbits. Which short-term effect is most likely?",
      ("The grass population increases, and the fox population decreases.", "Fewer rabbits eat less grass, and foxes have less food."),
      [("The grass population decreases, and the fox population increases.", "Fewer rabbits means less grazing and less food for foxes."),
       ("Both the grass and the fox populations increase.", "Foxes lose food when rabbits decline."),
       ("Both the grass and the fox populations remain unchanged.", "Changes in an intermediate level affect the levels above and below it.")]),
    B("Sea otters eat sea urchins, which eat kelp. Hunters remove most of the sea otters from a coastal area. Which long-term effect is most likely?",
      ("Sea urchins increase and kelp forests decline.", "Without predators the urchins increase and overgraze the kelp."),
      [("Sea urchins decrease and kelp forests expand.", "Removing otters would reduce predation on urchins."),
       ("Sea urchins and kelp both increase.", "More urchins would reduce kelp."),
       ("Sea otters will be replaced by kelp as the top consumer.", "Kelp is a producer and cannot take the role of a consumer.")]),
], "predict how removing or adding a species changes a community", "fixed fact bank checked against CED 8.5", est=65)


@retry_sep
def bi_simpson(rng):
    S = rng.randint(3, 4)
    counts = sorted([rng.randint(10, 80) for _ in range(S)], reverse=True)
    N = sum(counts)
    D = 1 - sum((n / N) ** 2 for n in counts)
    D2 = float(1 - sum(Fr(n, N) ** 2 for n in counts))
    agree(D, D2, 1e-9, "D")
    pairs = [(f"Reports the sum of the squared proportions, Σ(n/N)² = {1 - D:.2f}, without subtracting it from 1.", 1 - D), (f"Uses only the most abundant species: 1 − ({counts[0]}/{N})² = {1 - (counts[0] / N) ** 2:.2f}.", 1 - (counts[0] / N) ** 2), (f"Divides the number of species by the number of individuals: {S}/{N} = {S / N:.2f}.", S / N), (f"Squares the combined proportion of the two most abundant species: 1 − (({counts[0]} + {counts[1]})/{N})² = {1 - ((counts[0] + counts[1]) / N) ** 2:.2f}.", 1 - ((counts[0] + counts[1]) / N) ** 2)]
    key, ds = val_opts(D, [(w, v) for w, v in pairs if v is not None], lambda v: f"{hu(v, 2)}", gap=0.03)
    names = ["Species P", "Species Q", "Species R", "Species S"][:S]
    stim = tbl("Number of individuals of each species in a sampled community", ["Species", "Number of individuals"], [[n, c] for n, c in zip(names, counts)], notes=[f"Total individuals: {N}"])
    stem = "The table shows the number of individuals of each species in a community. Using the formula for Simpson's diversity index, which value is the diversity index for this community?"
    return mk("bi_simpson", "8.6", "5.A", stem, key, ds, rng, concept="Simpson's diversity index from species counts", stim=stim, path="floating-point sum vs exact fractions", facts=[f"counts={counts}", f"D={D:.4f}"], judgment="square each species proportion, add them, and subtract from one", kwhy=f"The proportions are " + ", ".join(f"{c}/{N}" for c in counts) + f". D = 1 - Σ(n/N)² = 1 - {1 - D:.3f} = {D:.2f}.")


@retry_sep
def bi_simpson_compare(rng):
    S = 3; N = pick(rng, [90, 120, 150])
    even = [N // 3, N // 3, N - 2 * (N // 3)]
    skew = sorted([N - 2 * rng.randint(5, 12), rng.randint(5, 12), rng.randint(5, 12)], reverse=True)
    skew[0] = N - skew[1] - skew[2]
    D = lambda cs: 1 - sum((n / N) ** 2 for n in cs)  # noqa: E731
    d_e, d_s = D(even), D(skew)
    agree(d_e > d_s, True, 1e-9, "order")
    first_even = pick(rng, [True, False])
    A, Bc = (even, skew) if first_even else (skew, even)
    key, ds = sentence_options("Community " + ("A" if first_even else "B") + f" has the higher diversity, because its individuals are spread more evenly among the species.", f"Both communities have {S} species and {N} individuals, but the more even community has the smaller Σ(n/N)² and so the higher index ({d_e:.2f} compared with {d_s:.2f}).",
        [("Community " + ("B" if first_even else "A") + " has the higher diversity, because it has one very abundant species.", "A community dominated by one species has a lower diversity index, not a higher one."),
         ("The two communities have the same diversity, because they have the same number of species and individuals.", "Diversity also depends on how evenly individuals are distributed among the species."),
         ("Community " + ("B" if first_even else "A") + " has the higher diversity, because it has fewer individuals of the rarest species.", "Fewer individuals of the rarest species does not make a community more diverse.")])
    stim = tbl("Number of individuals of each species in two communities", ["Species", "Community A", "Community B"], [[f"Species {s}", a, b] for s, a, b in zip("PQR", A, Bc)], notes=[f"Each community contains {N} individuals."])
    stem = "The table shows the number of individuals of each of three species in two communities of the same size. Which statement about the diversity of the two communities is best supported by Simpson's diversity index?"
    return mk("bi_simpson_compare", "8.6", "4.B", stem, key, ds, rng, concept="compare diversity of communities with equal richness but different evenness", stim=stim, path="Simpson's index for each community from the table vs the generating evenness", facts=[f"A={A}", f"B={Bc}", f"d_e={d_e:.3f}", f"d_s={d_s:.3f}"], judgment="compare evenness, not just species richness")


bi_biodiversity_concept = make_bank_archetype("bi_biodiversity_concept", "8.6", "6.D", [
    B("Two grassland plots have the same total number of plants. Plot 1 contains 20 plant species and plot 2 contains 2 plant species. A drought kills the plants of one species in each plot. Which prediction is best supported?",
      ("Plot 1 is more likely to keep its ecosystem functions because other species can fill the roles of the lost species.", "Higher diversity provides redundancy and resilience to disturbance."),
      [("Plot 2 is more likely to keep its ecosystem functions because it has fewer species to maintain.", "Plots with fewer species depend heavily on each remaining species."),
       ("Both plots are equally affected because the loss of one species affects each plot in the same way.", "The effect depends on the importance of the species and the redundancy of the community."),
       ("Plot 1 is more likely to collapse because it has more species to be affected by the drought.", "More species increase the chance that some tolerate the drought.")]),
    B("A conservation biologist explains that a diverse ecosystem is usually more stable than a less diverse one. Which statement best supports this idea?",
      ("A diverse ecosystem has many species with different tolerances, so some are likely to survive a disturbance.", "Different species respond differently to a disturbance, which stabilizes the system."),
      [("A diverse ecosystem has fewer interactions, so disturbances are less likely to spread.", "Diverse ecosystems usually have more interactions."),
       ("A diverse ecosystem is always larger in area, so disturbances occur less often.", "Area is not what explains stability here."),
       ("A diverse ecosystem has a single dominant species that controls all the others.", "Diversity means that no single species dominates.")]),
], "explain how biodiversity relates to stability and resilience", "fixed fact bank checked against CED 8.6", est=65)

bi_invasive_species = make_bank_archetype("bi_invasive_species", "8.7", "6.E", [
    B("A plant species from another continent is introduced into a lake. It grows rapidly and covers the lake surface. Which effect on the native community is most likely?",
      ("Native plants receive less light, and native species that depend on them decline.", "A fast-growing invasive plant with no natural controls shades native plants and changes the food web."),
      [("Native plant species increase because the invasive plant adds nutrients.", "A dense mat of an invasive plant usually reduces native plant growth."),
       ("The ecosystem is unchanged because the invasive plant is also photosynthetic.", "A new dominant species changes interactions and resources."),
       ("Native species become immune to the invasive plant by acclimation within one generation.", "Immunity to a competitor is not acquired this way.")]),
    B("An invasive predator is introduced to an island on which the native prey species had no predators. Which outcome is most likely?",
      ("The prey populations decline because they lack defenses against the new predator.", "Native prey without adaptations to the predator are often highly vulnerable."),
      [("The prey populations increase because they are adapted to the island.", "Their adaptations do not include defenses against a predator they never encountered."),
       ("The prey populations remain the same because predators do not affect prey.", "Predators can limit prey populations."),
       ("The predator population declines immediately because the island has no prey.", "The island has native prey that the predator can eat.")]),
], "predict the effects of an invasive species", "fixed fact bank checked against CED 8.7", est=65)

bi_ecosystem_disruption = make_bank_archetype("bi_ecosystem_disruption", "8.7", "6.E", [
    B("Fertilizer runoff increases the nitrogen and phosphorus concentrations in a lake, causing an algal bloom. Later, oxygen levels fall and fish die. Which sequence best explains the decline in oxygen?",
      ("Algae die in large numbers, and decomposers consume oxygen while breaking down the dead algae.", "Eutrophication leads to die-offs, and aerobic decomposition uses up dissolved oxygen."),
      [("Algae release more oxygen as they die, which poisons the fish.", "Dying algae do not release large amounts of oxygen; decomposition uses it."),
       ("Fertilizer reacts directly with oxygen gas, which removes it from the water.", "The effect is the result of biological activity."),
       ("Fish consume the algae and use up all the oxygen directly.", "The oxygen depletion is mostly caused by decomposition.")]),
    B("Increasing carbon dioxide in the atmosphere is absorbed by oceans, lowering the pH of seawater. Which effect on marine organisms is most likely?",
      ("Organisms that build shells from calcium carbonate have more difficulty forming shells.", "Lower pH reduces the availability of carbonate ions that shell-building organisms need."),
      [("Photosynthetic organisms stop all growth in the oceans.", "Some photosynthetic organisms may increase growth when carbon dioxide increases."),
       ("Shell-building organisms form thicker shells because of the lower pH.", "Lower pH makes shell formation harder."),
       ("The change has no effect on any marine organisms.", "Ocean acidification affects shell-forming organisms.")]),
    B("Deforestation of a large forest reduces transpiration and the amount of vegetation. Which effect on the local ecosystem is most likely?",
      ("A decrease in local rainfall and an increase in soil erosion", "Fewer plants lead to less water returned to the atmosphere and less soil held by roots."),
      [("An increase in local rainfall and a decrease in soil erosion", "Loss of vegetation does not increase rainfall or reduce erosion."),
       ("No change in local rainfall because forests do not affect weather", "Forests influence local water cycling."),
       ("An increase in the number of forest species because there is more space", "Loss of habitat generally reduces forest species.")]),
], "predict how a human-caused disruption changes an ecosystem", "fixed fact bank checked against CED 8.7", est=70)

bi_energy_flow_concept = make_bank_archetype("bi_energy_flow_concept", "8.2", "1.B", [
    B("Energy flows through an ecosystem, while matter such as carbon and nitrogen is recycled. Which statement best explains why an ecosystem needs a continuous input of energy?",
      ("Energy is lost as heat at each trophic level and cannot be reused by producers.", "Cellular processes release heat that is not recaptured, so energy must be replaced by the sun."),
      [("Energy is destroyed by decomposers when they break down organisms.", "Energy is transformed and not destroyed."),
       ("Producers convert energy from heat into chemical energy.", "Producers use light energy and do not use heat to make chemical energy."),
       ("Energy is recycled by decomposers, so the sun is not needed.", "Decomposers recycle matter, but the energy is lost as heat.")]),
    B("Which statement correctly describes net primary productivity of an ecosystem?",
      ("It is the energy captured by producers that remains after the producers use some for their own respiration.", "Net primary productivity equals gross productivity minus the energy used by producers for respiration."),
      [("It is the total energy captured by producers, including the energy used for respiration.", "That is gross primary productivity."),
       ("It is the energy that is available to the top predator after all transfers.", "Net primary productivity refers to producers and not to the top predator."),
       ("It is the amount of energy lost as heat by the consumers.", "Heat loss by consumers is not net primary productivity.")]),
], "relate energy flow, heat loss, and productivity in ecosystems", "fixed fact bank checked against CED 8.2", est=60)

bi_behavior_response = make_bank_archetype("bi_behavior_response", "8.1", "1.C", [
    B("Many birds migrate south in the fall, even when they have never made the trip before. Which statement best describes this behavior?",
      ("It is an innate behavior that is triggered by environmental cues such as day length.", "Migration can be a genetically based response to cues such as changes in photoperiod."),
      [("It is a learned behavior that each bird develops by observing the others.", "Birds that have never migrated still perform the behavior, so it is not simply learned."),
       ("It is a behavior that appears only after the birds are injured.", "Migration is not triggered by injury."),
       ("It is a response to temperature only, and day length has no effect.", "Day length is a major cue for migration.")]),
    B("Some plants flower only when the nights are longer than a certain length. Which statement best explains the benefit of this response?",
      ("The plants use a reliable environmental cue to time reproduction to a favorable season.", "Photoperiod is a predictable signal of season."),
      [("The plants flower in response to their own growth, which has nothing to do with the environment.", "The response is triggered by the length of the night."),
       ("The plants choose a time to flower after thinking about the weather.", "Plants do not make decisions as animals do; they respond to cues."),
       ("The plants flower at random times throughout the year to avoid competition.", "The timing is controlled by cues and is not random.")]),
    B("Worker bees warn the hive of danger by releasing a chemical signal that causes other bees to attack. Which statement best describes the evolutionary advantage of this behavior?",
      ("It increases the survival of the colony, which contains the relatives that share the alleles of the workers.", "Behaviors that help relatives reproduce can be favored because relatives share alleles."),
      [("It increases the survival of the individual worker that gives the signal.", "The signaling worker may be at risk; the benefit is to the colony."),
       ("It decreases the survival of the colony because it uses energy.", "The behavior is maintained because it improves colony survival."),
       ("It is a learned behavior that bees invent in each generation.", "The response is largely innate and not invented in each generation.")]),
], "explain behavior as a response to environmental cues and as an adaptation", "fixed fact bank checked against CED 8.1", est=65)


@retry_sep
def bi_organism_response_data(rng):
    sc = pick(rng, [("pill bugs", "humid", "dry", "humidity"), ("pill bugs", "dark", "light", "light"), ("blowfly larvae", "dark", "light", "light")])
    org, pref, other, cue = sc
    n = 20
    a = rng.randint(15, 18); b = n - a
    rows = [[f"Control: both sides {other}", 10, 10], [f"Test: one side {pref}, one side {other}", b, a]]
    stim = tbl(f"Number of {org} (out of {n}) on each side of a choice chamber after 10 minutes", ["Condition", f"Number on the {other} side", f"Number on the {pref} side"], rows)
    key, ds = sentence_options(f"The {org} moved toward the {pref} side, so the data support a response to {cue} that is not due to chance.", f"In the control the {org} were split evenly, while in the test {a} of {n} were on the {pref} side, which shows a response to {cue}.",
        [(f"The {org} moved toward the {other} side, so the data support a response to {cue}.", f"The table shows more of the {org} on the {pref} side in the test."),
         (f"The {org} had no response to {cue}, because some were on each side of the chamber.", "In the test most of the organisms were on one side, unlike the even split in the control."),
         (f"The control shows that the {org} prefer the {other} side, so the test is not needed.", "The control shows an even distribution, which means no side preference without the cue.")])
    stem = f"A student used a choice chamber to test the response of {org} to {cue}. The table shows the numbers of {org} on each side of the chamber. Which conclusion is best supported by the data?"
    return mk("bi_organism_response_data", "8.1", "4.B", stem, key, ds, rng, concept="interpret a choice-chamber result with a control", stim=stim, path="comparison of the test distribution with the even control distribution vs the generating preference", facts=[f"a={a}", f"org={org}"], judgment="use the control to interpret the test distribution")


@retry_sep
def bi_community_interaction(rng):
    table = {("+", "+"): "Mutualism", ("+", "0"): "Commensalism", ("+", "-"): "Parasitism", ("-", "-"): "Competition"}
    pair = pick(rng, list(table))
    tgt = table[pair]
    scen = {("+", "+"): ("Bacteria in the gut of an animal digest food that the animal cannot digest, and the animal supplies the bacteria with nutrients.", "gut bacteria", "the animal"), ("+", "0"): ("Barnacles grow on the shell of a whale. The barnacles gain a place to live and access to food in the water, and the whale is not affected.", "barnacles", "the whale"), ("+", "-"): ("A tapeworm absorbs nutrients from the intestine of a host. The tapeworm grows, and the host loses nutrients.", "the tapeworm", "the host"), ("-", "-"): ("Two species of plants in a meadow use the same limited water supply. The growth of both species is reduced when they are near each other.", "the first species", "the second species")}
    text, x, y = scen[pair]
    # 독립 경로: 효과 부호 쌍 → 관계 이름 규칙(대칭 포함)
    inv = {v: k for k, v in table.items()}
    agree(0, 0 if inv[tgt] == pair else 1, 1e-9, "relation")
    names = ["Mutualism", "Commensalism", "Parasitism", "Competition"]
    stim = tbl("Effect of the interaction on each species (+ benefits, - is harmed, 0 is not affected)", ["Species", "Effect"], [[x.capitalize(), pair[0]], [y.capitalize(), pair[1]]])
    why_k = {"Mutualism": "Both species benefit (+/+), which defines mutualism.", "Commensalism": "One species benefits and the other is unaffected (+/0), which defines commensalism.", "Parasitism": "One species benefits and the other is harmed (+/-), which defines parasitism.", "Competition": "Both species are harmed (-/-), which defines competition."}
    why_w = {"Mutualism": "Mutualism requires both species to benefit, which does not match the table.", "Commensalism": "Commensalism requires one species to be unaffected, which does not match the table.", "Parasitism": "Parasitism requires one species to benefit while the other is harmed, which does not match the table.", "Competition": "Competition requires both species to be harmed, which does not match the table."}
    key = Opt(tgt, True, why_k[tgt], None)
    ds = [Opt(nm, False, why_w[nm], None) for nm in names if nm != tgt]
    stem = text + " Which type of interaction does the table of effects describe?"
    return mk("bi_community_interaction", "8.5", "1.B", stem, key, ds, rng, concept="classify an interspecific interaction from its effects", stim=stim, path="lookup of the sign pair in a relation table vs the generating relationship", facts=[f"pair={pair}", f"tgt={tgt}"], judgment="map the pattern of effects to a type of ecological interaction")


@retry_sep
def bi_predator_prey_graph(rng):
    a, b, c, d = 0.35, 0.012, 0.3, 0.006
    x0 = pick(rng, [60, 70, 80]); y0 = pick(rng, [15, 20, 25])
    f = lambda t, s: np.array([a * s[0] - b * s[0] * s[1], -c * s[1] + d * s[0] * s[1]])  # noqa: E731
    ts = np.linspace(0, 60, 241); out = []
    s = np.array([x0, y0], float); h = ts[1] - ts[0]
    for _ in ts:
        out.append(s.copy())
        k1 = f(0, s); k2 = f(0, s + h / 2 * k1); k3 = f(0, s + h / 2 * k2); k4 = f(0, s + h * k3)
        s = s + h / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
    out = np.array(out)
    # 독립 경로: 구간 [0,20]에서 각 계열의 첫 극대 위치
    def first_peak(y):
        for i in range(1, len(y) - 1):
            if y[i] >= y[i - 1] and y[i] > y[i + 1]:
                return ts[i]
        return None
    tp, tq = first_peak(out[:, 0]), first_peak(out[:, 1])
    if tp is None or tq is None or tq - tp < 1.0 or max(out[:, 0]) > 300 or max(out[:, 1]) > 150:
        raise ValueError("shape")
    ymax = int(math.ceil(max(out.max(), 100) / 50) * 50)
    end = None
    for k in range(len(ts) - 1, 100, -1):  # 오른쪽 끝에서 두 곡선 값이 충분히 떨어진 창을 고른다(끝 라벨이 겹치지 않게)
        if abs(out[k, 0] - out[k, 1]) > 0.14 * ymax:
            end = k
            break
    if end is None:
        raise ValueError("labels_close")
    ts = ts[:end + 1]; out = out[:end + 1]
    first = pick(rng, ["A", "B"])
    names = {"prey": "Population " + first, "pred": "Population " + ("B" if first == "A" else "A")}
    curves = sorted([(names["prey"].replace("Population ", ""), [[round(float(t), 2), round(float(v), 1)] for t, v in zip(ts[::2], out[::2, 0])]), (names["pred"].replace("Population ", ""), [[round(float(t), 2), round(float(v), 1)] for t, v in zip(ts[::2], out[::2, 1])])], key=lambda cv: cv[0])
    key, ds = sentence_options(f"{names['pred']} is the predator, because its population peaks after {names['prey']} peaks.", f"{names['pred']} first peaks at about {tq:.1f} time units, after {names['prey']} first peaks at about {tp:.1f}, which is expected when predator numbers increase after their food supply grows.",
        [(f"{names['prey']} is the predator, because its population peaks first.", "A predator population is expected to peak after its prey increases."),
         (f"{names['prey']} is the predator, because it reaches the larger population size.", "Predators are usually less numerous than their prey, and the size of the peaks does not identify the predator; the lag does."),
         ("The two populations cannot be told apart, because both rise and fall in repeated cycles of the same length.", "The two cycles have the same length but one is delayed, and the delay shows which population depends on the other for food.")])
    stim = graph_stim("Sizes of populations A and B over time in the same ecosystem", curves, gaxis("Time (arbitrary units)", 0, int(math.ceil(float(ts[-1]) / 10) * 10), 10 if ts[-1] > 30 else 5), gaxis("Number of individuals", 0, ymax, 50))
    stem = "The graph shows the sizes of two populations in the same ecosystem over time. One population is a predator and the other is its prey. Which statement is best supported by the graph?"
    return mk("bi_predator_prey_graph", "8.5", "2.B", stem, key, ds, rng, concept="predator populations lag behind prey populations", stim=stim, path="location of the first maximum of each integrated series vs the sign of the lag", facts=[f"tp={tp:.2f}", f"tq={tq:.2f}"], judgment="use the timing of peaks to identify the predator")


STAGE_U7 = ["bi_natural_selection_conditions", "bi_selection_type", "bi_selection_data_table", "bi_fitness_allele_change", "bi_hw_allele_freq", "bi_hw_expected_counts", "bi_hw_conditions", "bi_genetic_drift", "bi_phylo_characters", "bi_phylo_dna_data", "bi_molecular_clock", "bi_evidence_evolution", "bi_common_ancestry", "bi_speciation", "bi_continuing_evolution", "bi_artificial_selection", "bi_variation_populations", "bi_origin_of_life", "bi_allele_freq_graph", "bi_antibiotic_data"]
STAGE_U8 = ["bi_pop_growth_calc", "bi_exp_growth", "bi_logistic", "bi_growth_graph_K", "bi_growth_graph_fastest", "bi_density_factor", "bi_trophic_energy", "bi_food_web_prediction", "bi_simpson", "bi_simpson_compare", "bi_biodiversity_concept", "bi_invasive_species", "bi_ecosystem_disruption", "bi_energy_flow_concept", "bi_behavior_response", "bi_organism_response_data", "bi_community_interaction", "bi_predator_prey_graph"]
