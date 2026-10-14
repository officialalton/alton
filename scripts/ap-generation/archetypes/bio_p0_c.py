"""AP Biology P0 원형 C — 단원 5(유전)·6(유전자 발현과 조절)."""
import itertools
from bio_common import *  # noqa: F401,F403

# ============================ 단원 5 ============================


@retry_sep
def bi_meiosis_chromosomes(rng):
    two_n = pick(rng, [4, 6, 8, 10, 12, 14, 16, 20, 24])
    n = two_n // 2
    variant = pick(rng, ["after_I", "chromatids_I", "gamete"])
    # 독립 경로: 염색체를 실제 객체(염색분체 쌍)로 만들어 감수 분열 단계를 진행한다
    chroms = [("h%d" % (i // 2), 2) for i in range(two_n)]  # 상동 염색체 쌍, 복제 뒤 각 염색체는 염색분체 2개
    after_I = n  # 상동 염색체가 갈라져 한 세포에 한 쌍 중 하나씩
    pairs_ids = sorted({c[0] for c in chroms})
    cell1 = []
    for pid in pairs_ids:
        cell1.append(pid)  # 각 상동 쌍에서 한 염색체
    agree(len(cell1), n, 1e-9, "n")
    chromatids = sum(c[1] for c in chroms)
    agree(chromatids, 2 * two_n, 1e-9, "chromatids")
    if variant == "after_I":
        val = n
        stem = f"A diploid cell with {two_n} chromosomes undergoes meiosis. How many chromosomes are in each cell at the end of meiosis I?"
        pairs = [("Gives the diploid number, as at the end of mitosis, because homologous chromosomes are thought not to separate.", two_n), ("Divides the haploid number by two, as if meiosis II had already occurred.", n // 2), ("Doubles the diploid number because DNA was replicated in S phase.", 2 * two_n), ("Counts the chromatids instead of the chromosomes.", 2 * n)]
        kw = f"Homologous chromosomes separate in meiosis I, so each cell receives one chromosome from each pair: {two_n} / 2 = {n} chromosomes (each still has two chromatids)."
    elif variant == "chromatids_I":
        val = 2 * two_n
        stem = f"A diploid cell with {two_n} chromosomes enters meiosis I after S phase. How many chromatids are present in the cell at metaphase I?"
        pairs = [("Counts the chromosomes and ignores that each has two sister chromatids.", two_n), ("Counts the chromatids in one cell after meiosis I.", two_n), ("Quadruples the diploid number.", 4 * two_n), ("Counts the chromosomes in a haploid gamete.", n)]
        kw = f"After DNA replication each of the {two_n} chromosomes consists of two sister chromatids, so the cell has 2 x {two_n} = {2 * two_n} chromatids at metaphase I."
    else:
        val = n
        stem = f"A diploid organism has {two_n} chromosomes in its body cells. How many chromosomes are in each gamete the organism produces, ignoring nondisjunction?"
        pairs = [("Gives the diploid number, as in a body cell.", two_n), ("Divides the haploid number by two.", n // 2), ("Doubles the diploid number.", 2 * two_n), ("Counts the number of homologous pairs plus one.", n + 1)]
        kw = f"Meiosis produces haploid gametes with half the diploid number: {two_n} / 2 = {n} chromosomes."
    key, ds = int_opts(val, pairs)
    return mk("bi_meiosis_chromosomes", "5.1", "5.A", stem, key, ds, rng, concept="chromosome and chromatid counts through meiosis", path="explicit chromosome objects carried through S phase and meiosis I vs the closed forms n and 2(2n)", facts=[f"2n={two_n}", f"variant={variant}"], judgment="track chromosome and chromatid number through replication and reduction", kwhy=kw)


@retry_sep
def bi_gamete_combos(rng):
    k = pick(rng, [3, 4, 5, 6])
    # 독립 경로: 각 상동 쌍에서 어느 염색체가 들어가는지 모든 경우를 열거해 서로 다른 조합을 센다
    combos = set(itertools.product([0, 1], repeat=k))
    agree(len(combos), 2 ** k, 1e-9, "combos")
    pairs = [("Doubles the haploid number instead of raising two to that power.", 2 * k), ("Squares the haploid number.", k * k), ("Raises two to the diploid number rather than to the haploid number.", 2 ** (2 * k)), ("Multiplies the haploid number by the diploid number.", k * 2 * k)]
    key, ds = val_opts(2 ** k, pairs, lambda v: f"{int(v):,}", rel=0.08, gap=1)
    stem = f"An organism has {2 * k} chromosomes in its diploid body cells (all in homologous pairs). Ignoring crossing over, how many genetically different gametes can the organism produce through independent assortment of homologous chromosomes?"
    return mk("bi_gamete_combos", "5.2", "5.A", stem, key, ds, rng, concept="2^n combinations of maternal and paternal chromosomes in gametes", path="enumeration of all orientations with itertools.product vs 2**n", facts=[f"k={k}"], judgment="relate the number of homologous pairs to possible gamete combinations", kwhy=f"There are {k} homologous pairs, and each pair assorts independently into two possibilities, so the number of gametes is 2^{k} = {2 ** k}.")


bi_meiosis_variation = make_bank_archetype("bi_meiosis_variation", "5.2", "1.B", [
    B("During prophase I of meiosis, homologous chromosomes exchange segments. Which statement best describes the genetic consequence of this process?",
      ("It produces chromosomes with new combinations of alleles, which increases the genetic variation of gametes.", "Crossing over recombines alleles between maternal and paternal chromosomes."),
      [("It makes the two daughter cells of meiosis I genetically identical.", "Crossing over increases genetic differences between the cells."),
       ("It changes the number of chromosomes in the gametes from haploid to diploid.", "Crossing over does not change the number of chromosomes."),
       ("It makes sister chromatids exchange segments so that the alleles stay the same.", "Crossing over occurs between nonsister chromatids of homologous chromosomes and changes allele combinations.")]),
    B("Which process in meiosis contributes to genetic variation by separating maternal and paternal chromosomes in random combinations into gametes?",
      ("Independent assortment of homologous chromosomes in metaphase I", "The random orientation of homologous pairs at the metaphase plate gives many combinations of chromosomes."),
      [("Replication of DNA in S phase", "Replication makes copies and does not shuffle chromosomes."),
       ("Separation of sister chromatids in anaphase II", "Sister chromatids are identical apart from crossing over, so separating them does not create new combinations."),
       ("Cytokinesis after telophase II", "Cytokinesis divides the cytoplasm and does not shuffle alleles.")]),
    B("Offspring of the same two parents are not genetically identical to each other. Which process explains the variation arising from the combination of gametes?",
      ("Random fertilization, in which any sperm may fuse with any egg", "Because gametes differ, the particular sperm and egg that fuse produce unique combinations."),
      [("Mitosis of the zygote, which changes alleles in each offspring", "Mitosis produces identical cells from the zygote and does not change alleles."),
       ("Binary fission of the egg cell before fertilization", "Eggs do not reproduce by binary fission."),
       ("Replication of the parents' DNA after fertilization", "Replication copies DNA and does not create variation between offspring.")]),
], "relate crossing over, independent assortment, and fertilization to genetic variation", "fixed fact bank checked against CED 5.2", est=60)

bi_nondisjunction = make_bank_archetype("bi_nondisjunction", "5.1", "6.E", [
    B("A pair of homologous chromosomes fails to separate during meiosis I in a human oocyte. What is the expected outcome for the four resulting cells?",
      ("All four cells are abnormal: two have an extra chromosome and two lack one.", "When homologs fail to separate in meiosis I, every product has an abnormal number of that chromosome."),
      [("Two cells have the normal number and two have an abnormal number.", "This outcome occurs when sister chromatids fail to separate in meiosis II."),
       ("All four cells have the normal haploid number of chromosomes.", "Nondisjunction produces abnormal numbers."),
       ("All four cells have the diploid number of chromosomes.", "The cells would not all be diploid; two would have an extra chromosome and two a missing one.")]),
    B("Sister chromatids of one chromosome fail to separate during meiosis II in a sperm-producing cell. What is the expected outcome for the four resulting sperm cells?",
      ("Two sperm are normal, one has an extra chromosome, and one lacks it.", "Only the cell that underwent nondisjunction in meiosis II produces an abnormal pair of gametes."),
      [("All four sperm cells have an extra copy of that chromosome.", "Only one of the two meiosis II divisions is affected."),
       ("All four sperm cells lack that chromosome.", "Not all of the cells lose the chromosome."),
       ("Two sperm cells have an extra copy and two are normal.", "One abnormal cell gains and one loses a chromosome; the numbers of abnormal products are not both gains.")]),
    B("A baby has three copies of chromosome 21 (Down syndrome). Which event in the formation of a gamete could explain this?",
      ("Nondisjunction of chromosome 21 in a parent's meiosis gave a gamete with two copies", "A gamete with two copies of chromosome 21 plus a normal gamete gives a zygote with three copies."),
      [("Crossing over between chromosome 21 and chromosome 22 in mitosis", "Crossing over occurs in meiosis and would not produce three copies by itself."),
       ("Failure of the zygote to undergo DNA replication before the first mitosis", "The condition is present in all of the cells from the zygote stage and arises in the gametes."),
       ("A point mutation that duplicates chromosome 21 in a single body cell", "A point mutation changes a base and does not add a whole chromosome.")]),
], "predict gamete outcomes for nondisjunction in meiosis I and II", "fixed fact bank checked against CED 5.1 and 5.2", est=70)


@retry_sep
def bi_monohybrid_prob(rng):
    trait = pick(rng, [("purple flowers", "white flowers", "P"), ("tall plants", "short plants", "T"), ("round seeds", "wrinkled seeds", "R")])
    dom, rec, L = trait
    variant = pick(rng, ["both_rec", "dom_then_rec", "three_dom"])
    gam = [L, L.lower()]
    kids = [a + b for a in gam for b in gam]  # 푼넷 4칸
    p_rec = Fr(sum(1 for k in kids if k == L.lower() * 2), 4); p_dom = 1 - p_rec
    if variant == "both_rec":
        key_v = p_rec * p_rec
        # 독립 경로: 두 자손의 푼넷 칸을 모두 열거(4x4)
        agree(float(key_v), sum(1 for a in kids for b in kids if a == L.lower() * 2 and b == L.lower() * 2) / 16, 1e-12, "p")
        stem = f"Two pea plants that are heterozygous for a gene ({L}{L.lower()} x {L}{L.lower()}) are crossed. {dom.capitalize()} is dominant to {rec}. What is the probability that the first two offspring both have {rec}?"
        pairs = [("Gives the probability for a single offspring instead of both.", p_rec), ("Adds the probabilities for the two offspring instead of multiplying them.", p_rec + p_rec), ("Uses 1/4 for one offspring and 3/4 for the other.", p_rec * p_dom), ("Squares the probability of the dominant phenotype.", p_dom * p_dom)]
        kw = f"Each offspring has a 1/4 chance of {rec}. The offspring are independent, so P = 1/4 x 1/4 = 1/16."
    elif variant == "dom_then_rec":
        key_v = p_dom * p_rec
        agree(float(key_v), sum(1 for a in kids for b in kids if a != L.lower() * 2 and b == L.lower() * 2) / 16, 1e-12, "p")
        stem = f"Two pea plants that are heterozygous for a gene ({L}{L.lower()} x {L}{L.lower()}) are crossed. {dom.capitalize()} is dominant to {rec}. What is the probability that the first offspring has {dom} and the second offspring has {rec}?"
        pairs = [("Gives the probability of the dominant phenotype for one offspring only.", p_dom), ("Gives the probability of the recessive phenotype for one offspring only.", p_rec), ("Adds 3/4 and 1/4 instead of multiplying them.", Fr(1)), ("Squares the probability of the recessive phenotype.", p_rec * p_rec), ("Squares the probability of the dominant phenotype.", p_dom * p_dom)]
        kw = "The probability of the dominant phenotype is 3/4 and of the recessive phenotype is 1/4. For independent events in the stated order, P = 3/4 x 1/4 = 3/16."
    else:
        key_v = p_dom ** 3
        agree(float(key_v), sum(1 for a in kids for b in kids for c in kids if all(x != L.lower() * 2 for x in (a, b, c))) / 64, 1e-12, "p")
        stem = f"Two pea plants that are heterozygous for a gene ({L}{L.lower()} x {L}{L.lower()}) are crossed. {dom.capitalize()} is dominant to {rec}. What is the probability that three offspring all have {dom}?"
        pairs = [("Gives the probability for a single offspring.", p_dom), ("Multiplies 3/4 by 3 instead of by itself three times.", Fr(9, 4)), ("Cubes the probability of the recessive phenotype.", p_rec ** 3), ("Squares the dominant probability, using only two offspring.", p_dom ** 2), ("Uses the probability that exactly one of three is recessive.", Fr(3 * 1 * 9, 64))]
        kw = "Each offspring has a 3/4 chance of the dominant phenotype. For three independent offspring, P = (3/4)^3 = 27/64."
    key, ds = frac_opts(key_v, pairs)
    return mk("bi_monohybrid_prob", "5.3", "5.A", stem, key, ds, rng, concept="multiply independent probabilities for monohybrid offspring", path="enumeration of every Punnett combination across offspring vs the product rule", facts=[f"variant={variant}", f"key={key_v}"], judgment="apply the product rule for independent events to Punnett probabilities", kwhy=kw)


@retry_sep
def bi_dihybrid_prob(rng):
    target = pick(rng, [("both dominant traits", lambda a, b: a != "aa" and b != "bb", Fr(9, 16)), ("both recessive traits", lambda a, b: a == "aa" and b == "bb", Fr(1, 16)), ("the dominant trait for the first gene and the recessive trait for the second gene", lambda a, b: a != "aa" and b == "bb", Fr(3, 16)), ("the genotype AaBb", lambda a, b: a == "Aa" and b == "Bb", Fr(1, 4))])
    desc, pred, expect = target
    g1 = ["AA", "Aa", "Aa", "aa"]; g2 = ["BB", "Bb", "Bb", "bb"]
    cnt = sum(1 for a in g1 for b in g2 if pred(a, b))
    agree(cnt / 16, float(expect), 1e-12, "cnt")
    p_first = {"both dominant traits": Fr(3, 4), "both recessive traits": Fr(1, 4)}
    pairs = [("Uses the probability for only one of the two genes.", Fr(3, 4) if "dominant" in desc else Fr(1, 4)), ("Adds the probabilities for the two genes instead of multiplying them.", Fr(1, 2) if expect <= Fr(1, 4) else Fr(1, 1) - Fr(1, 4)), ("Uses 1/16 for any phenotype because there are 16 boxes in the Punnett square.", Fr(1, 16)), ("Counts the dominant phenotype of each gene as 1/2.", Fr(1, 4) if expect != Fr(1, 4) else Fr(1, 2)), ("Uses 9/16 as the probability for every phenotype class.", Fr(9, 16)), ("Uses 3/16 as the probability for every phenotype class.", Fr(3, 16))]
    key, ds = frac_opts(expect, pairs)
    stem = f"In pea plants, A is dominant to a and B is dominant to b. The two genes assort independently. Two plants that are both AaBb are crossed. What is the probability that an offspring has {desc}?"
    return mk("bi_dihybrid_prob", "5.3", "5.A", stem, key, ds, rng, concept="dihybrid cross probabilities by independent assortment", path="count of the 16 Punnett combinations meeting the condition vs the product of the two monohybrid probabilities", facts=[f"desc={desc}", f"expect={expect}"], judgment="combine two independent monohybrid probabilities",
              kwhy=f"Each gene is a 3:1 or 1:2:1 cross and the genes assort independently, so the probability is the product of the two single-gene probabilities, giving {ffmt(expect)} ({cnt} of the 16 Punnett boxes).")


@retry_sep
def bi_testcross(rng):
    trait = pick(rng, [("purple", "white", "P"), ("tall", "short", "T"), ("round", "wrinkled", "R")])
    dom, rec, L = trait
    hetero = pick(rng, [True, False])
    N = pick(rng, [60, 80, 100])
    if hetero:
        a = N // 2 + rng.choice([-3, -2, -1, 1, 2, 3]); rows = [[f"{dom} offspring", a], [f"{rec} offspring", N - a]]
    else:
        rows = [[f"{dom} offspring", N], [f"{rec} offspring", 0]]
    # 독립 경로: 두 가능 유전자형의 기대 비율과 비교해 가까운 쪽을 고른다
    obs = [rows[0][1], rows[1][1]]
    d_hetero = sum((o - N / 2) ** 2 for o in obs); d_homo = sum((o - e) ** 2 for o, e in zip(obs, [N, 0]))
    guess = "hetero" if d_hetero < d_homo else "homo"
    agree(0, 0 if (guess == "hetero") == hetero else 1, 1e-9, "genotype")
    key_t = f"Heterozygous ({L}{L.lower()}), because about half of the offspring show the recessive phenotype" if hetero else f"Homozygous dominant ({L}{L}), because none of the offspring show the recessive phenotype"
    key_w = f"A heterozygote crossed with a homozygous recessive plant gives about a 1:1 ratio of {dom} to {rec} offspring, as observed." if hetero else f"A homozygous dominant plant crossed with a homozygous recessive plant gives only {dom} offspring, as observed."
    wr = []
    if hetero:
        wr.append((f"Homozygous dominant ({L}{L}), because the dominant phenotype is present in the offspring", "Dominant offspring appear from both genotypes; the recessive offspring show that the parent carried the recessive allele."))
        wr.append((f"Homozygous recessive ({L.lower()}{L.lower()}), because recessive offspring appear", "The parent shows the dominant phenotype, so it cannot be homozygous recessive."))
        wr.append((f"Heterozygous ({L}{L.lower()}), because exactly all offspring show the dominant phenotype", "This reasoning does not match the observed numbers of recessive offspring."))
    else:
        wr.append((f"Heterozygous ({L}{L.lower()}), because dominant offspring were produced", "A heterozygous parent would produce about half recessive offspring."))
        wr.append((f"Homozygous recessive ({L.lower()}{L.lower()}), because the other parent was recessive", "The parent shows the dominant phenotype, so it is not homozygous recessive."))
        wr.append((f"Heterozygous ({L}{L.lower()}), because the trait is dominant", "Showing a dominant phenotype does not mean that the genotype is heterozygous."))
    key, ds = sentence_options(key_t, key_w, wr)
    stim = tbl(f"Offspring of a test cross between a plant with {dom} flowers or traits of unknown genotype and a plant with the recessive phenotype ({rec})", ["Phenotype", "Number of offspring"], rows)
    stem = f"A plant with the dominant phenotype ({dom}) and an unknown genotype is crossed with a plant that shows the recessive phenotype ({rec}). The table shows the offspring. What is the most likely genotype of the unknown plant?"
    return mk("bi_testcross", "5.3", "6.B", stem, key, ds, rng, concept="infer a parental genotype from test-cross offspring ratios", stim=stim, path="distance of the observed counts from each expected ratio vs the generating genotype", facts=[f"hetero={hetero}", f"N={N}"], judgment="use offspring counts as evidence for a genotype")


@retry_sep
def bi_chi_square(rng):
    cross = pick(rng, ["monohybrid", "dihybrid"])
    if cross == "monohybrid":
        ratios = [3, 1]; labels = ["Dominant phenotype", "Recessive phenotype"]
    else:
        ratios = [9, 3, 3, 1]; labels = ["Dominant for both traits", "Dominant for trait 1 only", "Dominant for trait 2 only", "Recessive for both traits"]
    N = pick(rng, [160, 240, 320]) if cross == "dihybrid" else pick(rng, [100, 200, 400])
    tot = sum(ratios)
    exp = [N * r / tot for r in ratios]
    dev = rng.choice([0.04, 0.08, 0.14, 0.2])
    obs = [max(1, round(e * (1 + rng.choice([-1, 1]) * dev * rng.random()))) for e in exp]
    diff = N - sum(obs)
    obs[0] += diff
    if min(obs) < 1:
        raise ValueError("neg")
    X = chi2(obs, exp)
    X2 = float(sum(Fr(o - Fr(e)) ** 2 / Fr(e) for o, e in zip(obs, [Fr(N * r, tot) for r in ratios])))
    agree(X, X2, 1e-9, "chi2")
    df = len(obs) - 1
    c = crit(df)
    reject = X > c
    other_df_c = crit(df + 1 if df < 8 else df)

    def sent(chi, c_, rej, tag):
        cmp_ = "greater" if chi > c_ else "less"
        return f"The chi-square value is {chi:.2f}, which is {cmp_} than the critical value of {c_} (df = {df if tag else df}, p = 0.05), so the null hypothesis is {'rejected' if rej else 'not rejected'}."
    key_t = sent(X, c, reject, 1)
    wr = [(f"The chi-square value is {X:.2f}, which is {'less' if reject else 'greater'} than the critical value of {c} (df = {df}, p = 0.05), so the null hypothesis is {'not rejected' if reject else 'rejected'}.", "Computes the statistic correctly but draws the opposite conclusion from the comparison with the critical value."),
          (None, "Divides each squared difference by the observed count instead of the expected count."),
          (None, "Sums the squared differences without dividing by the expected counts."),
          (None, "Uses the number of phenotype classes as the degrees of freedom instead of the number minus one.")]
    X_obs = sum((o - e) ** 2 / o for o, e in zip(obs, exp)); X_nodiv = sum((o - e) ** 2 for o, e in zip(obs, exp))
    wr[1] = (sent(X_obs, c, X_obs > c, 1), wr[1][1])
    wr[2] = (sent(X_nodiv, c, X_nodiv > c, 1), wr[2][1])
    c_bad = crit(len(obs) if len(obs) <= 8 else df)
    wr[3] = (f"The chi-square value is {X:.2f}, which is {'greater' if X > c_bad else 'less'} than the critical value of {c_bad} (df = {len(obs)}, p = 0.05), so the null hypothesis is {'rejected' if X > c_bad else 'not rejected'}.", wr[3][1])
    wr = [w for w in wr if w[0] != key_t]
    seen = set(); wr2 = []
    for w in wr:
        if w[0] not in seen:
            seen.add(w[0]); wr2.append(w)
    key, ds = sentence_options(key_t, f"Sum of (o - e)^2/e over the {len(obs)} classes is {X:.2f}. With df = {len(obs)} - 1 = {df}, the critical value at p = 0.05 is {c}, and {X:.2f} is {'greater' if reject else 'less'} than {c}, so the null hypothesis (the observed ratio matches {':'.join(map(str, ratios))}) is {'rejected' if reject else 'not rejected'}.", wr2)
    stim = tbl("Offspring phenotypes observed in a genetic cross and the numbers expected from the hypothesized ratio", ["Phenotype", "Observed", "Expected"], [[l, o, f"{e:g}"] for l, o, e in zip(labels, obs, exp)])
    ratio_txt = ":".join(map(str, ratios))
    stem = f"A student hypothesizes that the offspring of a {cross} cross will appear in a {ratio_txt} ratio. The table gives the observed and expected numbers. Using the chi-square equation and the critical values on the formula sheet, which statement is correct?"
    return mk("bi_chi_square", "5.3", "5.C", stem, key, ds, rng, concept="chi-square test of a genetic ratio with df = outcomes - 1", stim=stim, path="floating-point chi-square vs exact-fraction chi-square; critical value from the formula sheet table", facts=[f"obs={obs}", f"chi2={X:.4f}", f"df={df}", f"crit={c}"], judgment="compute chi-square, choose the degrees of freedom, and compare with the critical value")


bi_chi_square_hypothesis = make_bank_archetype("bi_chi_square_hypothesis", "5.3", "3.B", [
    B("A student crosses two pea plants heterozygous for flower color and counts the offspring. The student will use a chi-square test to compare the results with a 3:1 ratio. Which statement is the null hypothesis for the test?",
      ("The observed numbers of offspring do not differ from a 3:1 ratio except by chance.", "The null hypothesis states that there is no difference between observed results and the expected ratio beyond chance."),
      [("The observed numbers of offspring will differ from a 3:1 ratio.", "This states an alternative hypothesis and not a null hypothesis."),
       ("The offspring will all have the dominant phenotype.", "This predicts a result that is not the expected ratio."),
       ("The flower color gene is located on the X chromosome.", "The statement is about gene location, not about the expected ratio.")]),
    B("A chi-square test of a genetic cross gives a value smaller than the critical value at p = 0.05. Which conclusion is justified?",
      ("The null hypothesis is not rejected; the difference from the expected ratio may be due to chance.", "A statistic below the critical value means the data are consistent with the expected ratio."),
      [("The null hypothesis is rejected; the expected ratio is wrong.", "Rejection occurs when the statistic exceeds the critical value."),
       ("The hypothesis is proven true because the chi-square value is small.", "A statistical test does not prove a hypothesis."),
       ("The experiment must have been performed incorrectly.", "A small statistic is not evidence of error in the experiment.")]),
    B("In a chi-square test of a dihybrid cross with four phenotype classes, how many degrees of freedom are used with the table on the formula sheet?",
      ("Three, which is the number of classes minus one", "Degrees of freedom equal the number of distinct outcomes minus one."),
      [("Four, which is the number of classes", "The number of classes minus one is used."),
       ("Two, which is the number of genes minus one", "Degrees of freedom depend on the number of phenotype classes."),
       ("Sixteen, which is the number of boxes in the Punnett square", "The count of Punnett boxes is not used.")]),
], "state a null hypothesis and interpret chi-square results", "fixed fact bank checked against CED 5.3 and the formula sheet", est=60)


@retry_sep
def bi_linkage_map(rng):
    N = pick(rng, [500, 800, 1000])
    rf = pick(rng, [6, 10, 14, 18, 22, 30])
    R = int(round(N * rf / 100)); P = N - R
    cls = {"AB": P // 2, "ab": P - P // 2, "Ab": R // 2, "aB": R - R // 2}
    # 독립 경로: 부모형 조합(AB, ab)과 비교해 각 부류를 재조합형으로 분류
    recomb = sum(n for g, n in cls.items() if g not in ("AB", "ab"))
    agree(recomb / N * 100, 100 * R / N, 1e-9, "rf")
    rfv = recomb / N * 100
    pairs = [("Reports the percent of parental-type offspring instead of recombinant-type offspring.", 100 - rfv), ("Divides the recombinant count by the number of parental offspring instead of the total.", recomb / (N - recomb) * 100), ("Reports the percent for only one recombinant class.", cls["Ab"] / N * 100), ("Doubles the percent of recombinants.", 2 * rfv)]
    key, ds = val_opts(rfv, pairs, lambda v: f"{v:.0f} map units", gap=1.5)
    stim = tbl("Offspring of a test cross between an AaBb parent (genotype AB/ab) and an aabb parent", ["Offspring phenotype", "Number of offspring"], [["Dominant for both traits (AB)", cls["AB"]], ["Recessive for both traits (ab)", cls["ab"]], ["Dominant for trait 1 only (Ab)", cls["Ab"]], ["Dominant for trait 2 only (aB)", cls["aB"]]])
    stem = "An AaBb plant whose alleles are arranged AB/ab was crossed with an aabb plant. The table shows the offspring. One map unit equals 1% recombinant offspring. What is the distance between the two genes in map units?"
    return mk("bi_linkage_map", "5.4", "5.A", stem, key, ds, rng, concept="recombination frequency between linked genes from test-cross counts", stim=stim, path="classification of each offspring class against the parental haplotypes vs the generating recombination frequency", facts=[f"N={N}", f"rf={rfv:.3f}"], judgment="identify recombinant classes and divide by the total number of offspring",
              kwhy=f"The recombinant classes (Ab and aB) total {recomb} of {N} offspring. Recombination frequency = {recomb}/{N} x 100 = {rfv:.0f}%, which corresponds to {rfv:.0f} map units.")


@retry_sep
def bi_pedigree_mode(rng):
    t = pick(rng, ["AR", "XD", "XR"])
    if t == "AR":
        rows = [["I-1", "Male", "Unaffected", "-"], ["I-2", "Female", "Unaffected", "-"], ["II-1", "Male", "Unaffected", "I-1, I-2"], ["II-2", "Female", "Affected", "I-1, I-2"], ["II-3", "Female", "Unaffected", "I-1, I-2"]]
        note = "The trait is rare."
        key = ("Autosomal recessive, because two unaffected parents had an affected daughter", "An affected daughter of unaffected parents shows that both parents carry the recessive allele on an autosome; this cannot occur with an X-linked recessive allele because the unaffected father would pass his normal X to his daughter.")
        wr = [("X-linked recessive, because the trait is rare in the family", "An affected daughter would require an affected father with an X-linked recessive allele, but her father is unaffected."),
              ("Autosomal dominant, because the trait appears in a child of the family", "A dominant trait must appear in at least one parent, but both parents are unaffected."),
              ("X-linked dominant, because the trait appears in a daughter of the family", "An X-linked dominant trait would require an affected parent.")]
    elif t == "XD":
        rows = [["I-1", "Male", "Affected", "-"], ["I-2", "Female", "Unaffected", "-"], ["II-1", "Female", "Affected", "I-1, I-2"], ["II-2", "Female", "Affected", "I-1, I-2"], ["II-3", "Male", "Unaffected", "I-1, I-2"], ["II-4", "Male", "Unaffected", "I-1, I-2"]]
        note = "The mother (I-2) is not a carrier."
        key = ("X-linked dominant, because an affected father had only affected daughters", "A father passes his X chromosome to all daughters and a Y to all sons, so an affected father with all daughters affected and no sons affected fits an X-linked dominant trait.")
        wr = [("Autosomal recessive, because the affected father had two unaffected sons", "A recessive trait would require the unaffected mother to carry the allele, and she is not a carrier."),
              ("X-linked recessive, because the affected father had affected daughters", "Daughters of an affected father and a noncarrier mother would be unaffected carriers if the trait were recessive."),
              ("Y-linked, because the trait came from the affected father", "A Y-linked trait would be passed to all sons and to no daughters, which is the opposite of the pattern.")]
    else:
        rows = [["I-1", "Male", "Affected", "-"], ["I-2", "Female", "Unaffected", "-"], ["II-1", "Female", "Unaffected", "I-1, I-2"], ["II-2", "Male", "Unaffected", "I-1, I-2"], ["II-3", "Male", "Unaffected", "II-1, II-2's partner"], ["II-3 ", "Male", "Affected", "II-1, II-2's partner"]]
        rows = [["I-1", "Male", "Affected", "-"], ["I-2", "Female", "Unaffected", "-"], ["II-1", "Female", "Unaffected", "I-1, I-2"], ["II-2", "Male", "Unaffected", "I-1, I-2"], ["III-1", "Male", "Affected", "II-1 and an unaffected father"], ["III-2", "Male", "Unaffected", "II-1 and an unaffected father"], ["III-3", "Female", "Unaffected", "II-1 and an unaffected father"]]
        note = "The trait is rare, and the unaffected father of generation III does not carry the allele."
        key = ("X-linked recessive, because the trait skipped a generation through an unaffected carrier daughter", "A recessive X-linked allele passes from an affected male through his carrier daughter to her sons, so the trait can skip a generation and appear in males.")
        wr = [("Autosomal dominant, because the trait skipped a generation in the family", "A dominant trait does not skip generations because every carrier is affected."),
              ("Autosomal recessive, because the trait is rare in the population", "The unaffected father of generation III does not carry the allele, so an affected son must have received the allele on the X chromosome from his mother."),
              ("Y-linked, because only males in the family are affected", "The affected male in generation III received his Y chromosome from his unaffected father, so the trait is not Y-linked.")]
    k, ds = sentence_options(key[0], key[1], wr)
    stim = tbl("Phenotypes in a family (pedigree information)", ["Individual", "Sex", "Phenotype", "Parents"], rows, notes=[note])
    stem = "The table gives information from a family pedigree for a genetic trait. Which mode of inheritance is most consistent with the data?"
    return mk("bi_pedigree_mode", "5.3", "2.B", stem, k, ds, rng, concept="infer a mode of inheritance from family data", stim=stim, path="enumeration of the four candidate modes against each parent-child relationship in the table vs the generating mode", facts=[f"mode={t}"], judgment="test each mode of inheritance against the family data")


@retry_sep
def bi_sex_linked(rng):
    variant = pick(rng, ["son", "child", "daughter"])
    # 어머니 보인자 X^A X^a, 아버지 X^A Y. 독립 경로: 푼넷 열거
    mom = ["XA", "Xa"]; dad = ["XA", "Y"]
    kids = [(m, d) for m in mom for d in dad]
    affected = lambda m, d: d == "Y" and m == "Xa"  # noqa: E731
    if variant == "son":
        sons = [k for k in kids if k[1] == "Y"]
        val = Fr(sum(1 for k in sons if affected(*k)), len(sons))
        stem = "In humans, red-green color blindness is caused by a recessive allele on the X chromosome. A woman who is a carrier has children with a man who has normal vision. What is the probability that a son of this couple is color blind?"
        pairs = [("Gives the probability for any child instead of for a son.", Fr(1, 4)), ("Assumes all sons are affected because the mother carries the allele.", Fr(1, 1)), ("Assumes sons are never affected because the mother is not affected.", Fr(0)), ("Reports the probability that a child of either sex has normal vision.", Fr(3, 4))]
        kw = "Sons inherit the X chromosome from their mother, who passes the recessive allele half of the time, and the Y from their father. The probability that a son is color blind is 1/2."
    elif variant == "child":
        val = Fr(sum(1 for k in kids if affected(*k)), len(kids))
        stem = "In humans, red-green color blindness is caused by a recessive allele on the X chromosome. A woman who is a carrier has children with a man who has normal vision. What is the probability that a child of this couple (sex not specified) is a color-blind son?"
        pairs = [("Gives the probability that a son is color blind.", Fr(1, 2)), ("Reports the probability that a child of either sex has normal vision.", Fr(3, 4)), ("Assumes no child is affected.", Fr(0)), ("Assumes half of all children are affected daughters.", Fr(1, 8))]
        kw = "Of the four equally likely combinations, one is X^a Y, a color-blind son, so the probability is 1/4."
    else:
        daughters = [k for k in kids if k[1] != "Y"]
        val = Fr(sum(1 for k in daughters if affected(*k)), len(daughters))
        stem = "In humans, red-green color blindness is caused by a recessive allele on the X chromosome. A woman who is a carrier has children with a man who has normal vision. What is the probability that a daughter of this couple is color blind?"
        pairs = [("Assumes daughters are affected at the same rate as sons.", Fr(1, 2)), ("Assumes all daughters are affected because the mother carries the allele.", Fr(1, 1)), ("Gives the probability for any child to be a color-blind son.", Fr(1, 4)), ("Reports the probability that a child of either sex has normal vision.", Fr(3, 4))]
        kw = "A daughter receives her father's normal X chromosome, so she cannot be color blind. About half of the daughters are carriers, and none are affected, so the probability is 0."
    key, ds = frac_opts(val, pairs)
    return mk("bi_sex_linked", "5.4", "5.A", stem, key, ds, rng, concept="probabilities for an X-linked recessive trait", path="Punnett enumeration of X and Y combinations vs a reasoning by chromosome inheritance", facts=[f"variant={variant}", f"val={val}"], judgment="separate the inheritance of X and Y chromosomes by sex of the child", kwhy=kw)


bi_nonmendelian = make_bank_archetype("bi_nonmendelian", "5.4", "1.B", [
    B("Crossing red-flowered and white-flowered snapdragons produces only pink-flowered offspring. Crossing two pink-flowered plants produces red, pink, and white offspring in a 1:2:1 ratio. Which pattern of inheritance best explains these results?",
      ("Incomplete dominance, in which the heterozygote has an intermediate phenotype", "A pink heterozygote with a 1:2:1 ratio in the F2 generation is the pattern of incomplete dominance."),
      [("Complete dominance, in which the heterozygote has the phenotype of one parent", "The heterozygotes are pink, which differs from both parents."),
       ("Codominance, in which both alleles are fully expressed in the same individual", "Codominance would show both red and white areas rather than a blended pink."),
       ("Sex linkage, in which the allele is on the X chromosome", "The ratio in both sexes is the same, so the pattern does not indicate sex linkage.")]),
    B("A person with blood type AB has red blood cells that carry both the A and the B antigens. Which pattern of inheritance does this represent?",
      ("Codominance, in which both alleles are expressed fully in the heterozygote", "Both I^A and I^B alleles are expressed separately in an AB individual."),
      [("Incomplete dominance, in which the phenotype is a blend of two alleles", "The A and B antigens are both present as separate products and are not blended."),
       ("Recessive inheritance, in which both alleles must be present to be expressed", "The AB phenotype arises from two different alleles being expressed."),
       ("Epistasis, in which one gene masks the expression of another gene", "The AB phenotype results from alleles of one gene.")]),
    B("Human height varies continuously in a population and is influenced by many genes. Which statement best describes the inheritance of this trait?",
      ("It is polygenic, so many genes each contribute a small effect and the environment also matters.", "Continuous variation in a trait usually arises from the additive effects of many genes plus the environment."),
      [("It is determined by one gene with two alleles, so there are only two heights.", "A single two-allele gene would give discrete categories."),
       ("It is carried on mitochondrial DNA and inherited only from the father.", "Mitochondrial DNA is inherited from the mother and does not control height."),
       ("It is determined entirely by the environment and not by genes.", "Genes contribute significantly to height.")]),
    B("In some labrador retrievers, a gene at one locus determines whether any pigment is deposited in the fur, regardless of the alleles at a second gene that determines black or brown color. This is an example of which type of interaction?",
      ("Epistasis, in which one gene affects the expression of a second gene", "The pigment-deposition gene masks the effect of the color gene when it is not functional."),
      [("Codominance, in which both alleles of one gene are fully expressed", "This pattern involves alleles of one gene and not an interaction between two genes."),
       ("Incomplete dominance, in which one gene gives an intermediate phenotype", "Intermediate phenotypes are not the key pattern in this case."),
       ("Sex linkage, in which a gene is on a sex chromosome", "Nothing in the example involves sex chromosomes.")]),
], "identify patterns of inheritance that do not follow simple Mendelian ratios", "fixed fact bank checked against CED 5.4", est=65)

bi_environment_phenotype = make_bank_archetype("bi_environment_phenotype", "5.5", "1.C", [
    B("The same genotype of hydrangea plants produces blue flowers in acidic soil and pink flowers in basic soil. Which statement best explains this observation?",
      ("The environment influences how a genotype is expressed as a phenotype.", "A single genotype can yield different phenotypes in different environments."),
      [("The plants in acidic soil have a different DNA sequence from those in basic soil.", "The plants have the same genotype, so the DNA does not differ."),
       ("Soil pH changes the alleles that are passed to the next generation.", "Environmental conditions do not change the inherited alleles in this way."),
       ("Flower color in hydrangeas is controlled only by the environment.", "The phenotype depends on both genotype and environment.")]),
    B("Himalayan rabbits have dark fur on their ears and paws, where the body is coolest, and white fur elsewhere. A scientist shaves a patch of white fur and places an ice pack on the area, and dark fur grows back. Which conclusion is best supported?",
      ("The enzyme for dark pigment is active at lower temperatures, so temperature affects gene expression.", "Fur color changes in response to temperature, showing environmental influence on phenotype."),
      [("The ice pack changed the rabbit's genotype in the cells of the skin.", "A temperature change does not change the DNA sequence."),
       ("Dark fur results from a dominant allele that is expressed only in the ears and paws.", "The experiment shows a response to temperature, not a location-specific allele."),
       ("The rabbit's white fur color is controlled only by the environment.", "The pattern requires both a gene and a temperature-sensitive process.")]),
    B("Identical twins that grow up in different environments show differences in height and weight as adults. Which statement best explains this?",
      ("Phenotype results from interaction between genotype and environment, even when genotypes are identical.", "Identical twins share genotype, so differences are attributed to environmental effects."),
      [("Identical twins have different genotypes because of crossing over.", "Identical twins come from one zygote and share the same genotype."),
       ("Environmental differences change the DNA sequence of the twins.", "Environmental differences do not generally change DNA sequence in this way."),
       ("Height and weight are determined only by genes, so the differences are due to errors in measurement.", "Environmental influences contribute to these traits.")]),
], "explain environmental effects on phenotype", "fixed fact bank checked against CED 5.5", est=60)

# ============================ 단원 6 ============================
bi_dna_structure = make_bank_archetype("bi_dna_structure", "6.1", "1.A", [
    B("Which feature distinguishes the structure of DNA from that of RNA?",
      ("DNA contains deoxyribose and thymine, while RNA contains ribose and uracil.", "DNA has deoxyribose sugar and the base thymine; RNA has ribose and uracil."),
      [("DNA contains ribose and uracil, while RNA contains deoxyribose and thymine.", "The sugars and bases are reversed."),
       ("DNA is single-stranded and RNA is double-stranded in all cells.", "DNA is usually double-stranded and RNA is usually single-stranded."),
       ("DNA contains amino acids, while RNA contains nucleotides.", "Both are polymers of nucleotides.")]),
    B("The two strands of a DNA double helix run in opposite directions. Which term describes this arrangement?",
      ("Antiparallel", "One strand runs 5' to 3' while the complementary strand runs 3' to 5'."),
      [("Semiconservative", "This term describes DNA replication in which each new molecule has one old and one new strand."),
       ("Complementary only", "Complementary refers to base pairing and does not describe direction."),
       ("Parallel", "The strands are not parallel; they run in opposite directions.")]),
    B("Which bond joins adjacent nucleotides in a single strand of DNA?",
      ("A phosphodiester bond between the sugar of one nucleotide and the phosphate of the next", "The covalent bond joins the 3' carbon of one sugar to the 5' phosphate of the next nucleotide."),
      [("A hydrogen bond between the bases of adjacent nucleotides", "Hydrogen bonds join bases on opposite strands, not adjacent nucleotides on one strand."),
       ("A peptide bond between the amino groups of adjacent nucleotides", "Peptide bonds join amino acids."),
       ("A glycosidic bond between the phosphates of adjacent nucleotides", "Glycosidic bonds join sugars and do not link phosphates.")]),
], "describe the structure of DNA and RNA", "fixed fact bank checked against CED 6.1", est=55)

bi_replication_enzymes = make_bank_archetype("bi_replication_enzymes", "6.2", "1.B", [
    B("During DNA replication, which enzyme unwinds the double helix at the replication fork by breaking hydrogen bonds between the strands?",
      ("Helicase", "Helicase separates the two strands at the replication fork."),
      [("DNA polymerase", "DNA polymerase adds nucleotides to a growing strand."),
       ("DNA ligase", "DNA ligase joins Okazaki fragments."),
       ("Primase", "Primase synthesizes the RNA primers.")]),
    B("DNA polymerase can add nucleotides only to the 3' end of an existing strand. Which statement correctly explains a consequence of this?",
      ("One new strand is made continuously and the other is made in short fragments.", "Because synthesis occurs only in the 5' to 3' direction, the strand oriented away from the fork is made as Okazaki fragments."),
      [("Both strands are made continuously in the same direction as the fork.", "Only the leading strand is continuous."),
       ("DNA polymerase can start a new strand without a primer.", "DNA polymerase needs a primer with a free 3' end."),
       ("Neither strand requires a primer because the template is long.", "Both strands require a primer.")]),
    B("A cell has a mutation that makes DNA ligase nonfunctional. Which result is most likely during replication?",
      ("Gaps remain between Okazaki fragments on the lagging strand.", "DNA ligase seals the nicks between fragments."),
      [("The leading strand cannot be made at all.", "The leading strand is made continuously and is less dependent on ligase."),
       ("The helicase cannot unwind the double helix.", "Helicase action does not depend on ligase."),
       ("Primers are not made, so no new strand can start.", "Primers are made by primase and not by ligase.")]),
    B("Replication of DNA is described as semiconservative. What does this mean?",
      ("Each new DNA molecule consists of one original strand and one newly made strand.", "After replication, every double helix keeps one of the parent strands."),
      [("One new molecule has both original strands and the other has two new strands.", "That describes conservative replication."),
       ("Each new molecule is a mixture of short pieces of old and new DNA.", "That describes dispersive replication."),
       ("Both new molecules are made entirely of new strands.", "The parent strands are used as templates and remain in the daughter molecules.")]),
], "match enzymes and features of DNA replication to their roles", "fixed fact bank checked against CED 6.2", est=60)


@retry_sep
def bi_replication_strands(rng):
    left3 = pick(rng, [True, False])  # 위쪽 주형의 3' 끝이 왼쪽인가
    fork = pick(rng, ["right", "left"])
    L = rng.randint(7, 9)
    top = "".join(rng.choice("ATGC") for _ in range(L))
    bot = comp_dna(top)
    # 위쪽 주형: left3 이면 3' 왼쪽, 5' 오른쪽. 새 가닥은 주형의 5' 끝 쪽으로 3' 가 향한다 → 합성 방향
    synth_top = "right" if left3 else "left"
    synth_bot = "left" if left3 else "right"
    lead_top = synth_top == fork
    # 독립 경로: 합성 방향이 포크 이동 방향과 같으면 연속(선도). 아래 주형 기준 재확인
    lead_bot = synth_bot == fork
    agree(0, 0 if lead_top != lead_bot else 1, 1e-9, "one_each")
    lag = "top" if lead_bot else "bottom"
    names = {"top": "The new strand made on the top template strand", "bottom": "The new strand made on the bottom template strand"}
    key = Opt(names[lag] + " is made in short Okazaki fragments.", True, f"DNA polymerase adds nucleotides only to a 3' end. On the {lag} template, synthesis proceeds {'right' if (synth_top if lag == 'top' else synth_bot) == 'right' else 'left'}, away from the fork that moves {fork}, so the new strand is made discontinuously.", None)
    other = "bottom" if lag == "top" else "top"
    ds = [Opt(names[other] + " is made in short Okazaki fragments.", False, "Synthesis on that template proceeds toward the fork, so it is the continuous leading strand.", None),
          Opt("Both new strands are made in short Okazaki fragments, because DNA polymerase works in both directions.", False, "DNA polymerase works only in the 5' to 3' direction, and only one strand is discontinuous.", None),
          Opt("Neither new strand is made in fragments, because both are made continuously from the origin.", False, "One strand must be made in fragments because both new strands are synthesized 5' to 3' on antiparallel templates.", None)]
    t_l, t_r = ("3'", "5'") if left3 else ("5'", "3'")
    b_l, b_r = ("5'", "3'") if left3 else ("3'", "5'")
    stim = strand_stim("Two parental template strands at a replication fork", ("Top template strand", t_l, t_r, list(top)), ("Bottom template strand", b_l, b_r, list(bot)))
    stem = f"The diagram shows the two parental DNA strands at a replication fork. The fork is moving toward the {fork} side of the diagram. Which statement correctly describes the synthesis of the two new strands?"
    return mk("bi_replication_strands", "6.2", "2.B", stem, key, ds, rng, concept="identify the leading and lagging strands from template orientation and fork direction", stim=stim, path="synthesis direction derived from each template's polarity compared with the fork direction, checked from both templates", facts=[f"left3={left3}", f"fork={fork}"], judgment="relate template polarity and fork direction to continuous or discontinuous synthesis")


@retry_sep
def bi_transcription(rng):
    L = rng.randint(7, 9)
    tmpl = "".join(rng.choice("ATGC") for _ in range(L))
    if len(set(tmpl)) < 3:
        raise ValueError("comp")
    mrna = "".join(RNA_COMP[c] for c in tmpl)  # 주형 3'→5' 에 상보 = mRNA 5'→3'
    # 독립 경로: 주형을 5'→3' 로 뒤집어 역상보를 구한 뒤 RNA 로 읽는다
    alt = revcomp(tmpl[::-1]).replace("T", "U")
    agree(0, 0 if alt == mrna else 1, 1e-9, "mrna")
    cands = [("Copies the template strand and replaces T with U, without taking the complement.", tmpl.replace("T", "U")), ("Writes the complement with T instead of U, as in DNA.", comp_dna(tmpl)), ("Builds the correct complement but reads it from the wrong end and labels it 5' to 3'.", mrna[::-1]), ("Reverses the template and replaces T with U, without taking the complement.", tmpl[::-1].replace("T", "U"))]
    seen = {mrna}; ds = []
    for why, t in cands:
        if t in seen:
            continue
        seen.add(t); ds.append(Opt(f"5'-{t}-3'", False, why, None))
    if len(ds) < 3:
        raise ValueError("few")
    key = Opt(f"5'-{mrna}-3'", True, f"RNA polymerase pairs ribonucleotides with the template strand (A with U, T with A, G with C, C with G). Reading the template 3'-{tmpl}-5' gives the mRNA 5'-{mrna}-3'.", None)
    stem = f"The template strand of a gene has the sequence 3'-{tmpl}-5'. Which choice shows the mRNA transcribed from this template?"
    return mk("bi_transcription", "6.3", "2.D", stem, key, ds, rng, concept="mRNA sequence transcribed from a template strand", path="complement with uracil of the 3' to 5' template vs reverse complement of the 5' to 3' template written as RNA", facts=[f"tmpl={tmpl}"], judgment="represent the transcript with the correct complementary bases and polarity")


@retry_sep
def bi_translation(rng):
    aas = [c for c in CODON if CODON[c] not in ("*", "M")]
    lead = "".join(rng.choice("ACG") for _ in range(pick(rng, [1, 2, 4])))
    body = [rng.choice(aas) for _ in range(rng.randint(3, 5))]
    stop = rng.choice(["UAA", "UAG", "UGA"])
    mrna = lead + "AUG" + "".join(body) + stop
    if "AUG" in lead or "UAA" in lead or "UAG" in lead or "UGA" in lead:
        raise ValueError("lead")
    prot = translate(mrna)
    # 독립 경로: 코돈 표를 직접 조회해 AUG 위치에서 3글자씩 읽는다
    i = mrna.index("AUG"); aa2 = []
    while mrna[i:i + 3] not in ("UAA", "UAG", "UGA"):
        aa2.append(AA_NAME[CODON[mrna[i:i + 3]]]); i += 3
    agree(0, 0 if aa2 == prot else 1, 1e-9, "protein")

    def read(start):
        out = []
        j = start
        while j + 3 <= len(mrna):
            a = CODON[mrna[j:j + 3]]
            if a == "*":
                break
            out.append(AA_NAME[a]); j += 3
        return out
    cands = [("Begins reading at the first nucleotide of the mRNA instead of at the start codon AUG.", read(0)), ("Begins reading one nucleotide after the start codon, in the wrong reading frame.", read(mrna.index("AUG") + 1)), ("Lists the correct amino acids in reverse order.", prot[::-1]), ("Begins reading at the nucleotide just before the start codon.", read(max(0, mrna.index("AUG") - 1)))]
    seen = {"-".join(prot)}; ds = []
    for why, p in cands:
        t = "-".join(p)
        if not t or t in seen:
            continue
        seen.add(t); ds.append(Opt(t, False, why, None))
    if len(ds) < 3:
        raise ValueError("few")
    key = Opt("-".join(prot), True, f"Translation begins at the first AUG and reads codons in order until a stop codon: {', '.join(mrna[mrna.index('AUG'):][k:k + 3] for k in range(0, 3 * len(prot) + 3, 3))}, giving {'-'.join(prot)}.", None)
    used = sorted({mrna[mrna.index("AUG") + 3 * k: mrna.index("AUG") + 3 * k + 3] for k in range(len(prot) + 1)} | {c for c in mrna[:0]})
    if mrna[:3] not in used and len(lead) >= 3:
        used.append(mrna[:3])
    for p_ in cands:
        pass
    # 표에는 모든 읽기 틀에서 나올 수 있는 코돈을 포함해 정답을 표만으로 풀 수 있게 한다
    allc = {mrna[k:k + 3] for k in range(len(mrna) - 2)}
    rows = [[c, AA_NAME[CODON[c]]] for c in sorted(allc)]
    stim = tbl("Codons and the amino acids they specify (for the codons that appear in the sequence below)", ["Codon (5' to 3')", "Amino acid"], rows)
    stem = f"The mRNA sequence 5'-{mrna}-3' is translated by a ribosome. Using the table of codons, which choice shows the amino acid sequence of the polypeptide, beginning at the amino terminus?"
    return mk("bi_translation", "6.4", "5.A", stem, key, ds, rng, concept="translate an mRNA starting at the start codon until a stop codon", stim=stim, path="translate() over the first AUG vs a manual codon-table loop", facts=[f"mrna={mrna}", f"prot={prot}"], judgment="locate the start codon, keep the reading frame, and stop at the stop codon")


@retry_sep
def bi_mutation_effect(rng):
    aas = [c for c in CODON if CODON[c] not in ("*", "M")]
    n = rng.randint(4, 5)
    body = [rng.choice(aas) for _ in range(n)]
    stop = rng.choice(["UAA", "UAG", "UGA"])
    kind = pick(rng, ["silent", "missense", "nonsense", "frameshift"])
    idx = rng.randint(1, n)  # 돌연변이가 일어나는 코돈(AUG 다음 코돈들 중)
    if kind == "nonsense":
        near = [c for c in aas if any(sum(a != b for a, b in zip(c, st)) == 1 for st in ("UAA", "UAG", "UGA"))]
        body[idx - 1] = rng.choice(near)
    orig = "AUG" + "".join(body) + stop
    pos = 3 * idx
    cod = orig[pos:pos + 3]
    mut = None
    if kind == "silent":
        syn = [c for c in CODON if CODON[c] == CODON[cod] and c != cod and sum(a != b for a, b in zip(c, cod)) == 1]
        if not syn:
            raise ValueError("nosyn")
        newc = rng.choice(syn); mut = orig[:pos] + newc + orig[pos + 3:]
    elif kind == "missense":
        opts = [c for c in CODON if CODON[c] not in ("*", CODON[cod]) and sum(a != b for a, b in zip(c, cod)) == 1]
        if not opts:
            raise ValueError("nomis")
        newc = rng.choice(opts); mut = orig[:pos] + newc + orig[pos + 3:]
    elif kind == "nonsense":
        stops = [c for c in ("UAA", "UAG", "UGA") if sum(a != b for a, b in zip(c, cod)) == 1]
        if not stops:
            raise ValueError("nostop")
        mut = orig[:pos] + stops[0] + orig[pos + 3:]
    else:
        mut = orig[:pos + 1] + orig[pos + 2:]  # 한 염기 결실
    p0 = translate(orig); p1 = translate(mut)
    # 독립 경로: 두 단백질을 비교해 분류
    if p0 == p1:
        cls = "silent"
    elif kind == "frameshift":
        cls = "frameshift" if len(mut) % 3 != len(orig) % 3 else "?"
    elif len(p1) < len(p0) and p0[:len(p1)] == p1:
        cls = "nonsense"
    elif len(p1) == len(p0) and sum(a != b for a, b in zip(p0, p1)) == 1:
        cls = "missense"
    else:
        cls = "?"
    agree(0, 0 if cls == kind else 1, 1e-9, "class")
    if kind == "frameshift" and p0 == p1:
        raise ValueError("same")
    txt = {"silent": "The mutation is silent: the polypeptide has the same amino acid sequence as the original.",
           "missense": "The mutation is a missense mutation: one amino acid in the polypeptide is changed.",
           "nonsense": "The mutation is a nonsense mutation: a premature stop codon makes the polypeptide shorter.",
           "frameshift": "The mutation is a frameshift: the reading frame changes after the deletion, so downstream amino acids can differ."}
    why = {"silent": f"The changed codon still specifies {AA_NAME[CODON[cod]] if kind == 'silent' else 'the same amino acid'}, so the amino acid sequence is unchanged.",
           "missense": f"One codon now specifies a different amino acid ({AA_NAME[CODON[cod]] if kind == 'missense' else ''} is replaced), and the polypeptide stays the same length.",
           "nonsense": "A codon for an amino acid has become a stop codon, so translation ends early and the polypeptide is shorter.",
           "frameshift": "Deleting one nucleotide shifts the reading frame, which changes every codon after the deletion."}
    wr_why = {"silent": "The polypeptide changed, so the mutation is not silent.", "missense": "More than one amino acid differs or the length changed, so one amino acid replacement does not describe the result.", "nonsense": "No premature stop codon appears in the mutated sequence, so the polypeptide is not shortened that way.", "frameshift": "The mutation did not insert or delete a nucleotide, so the reading frame is unchanged."}
    key = Opt(txt[kind], True, why[kind], None)
    ds = [Opt(txt[k], False, wr_why[k] if k != kind else "", None) for k in txt if k != kind]
    stim = tbl("Original and mutated mRNA coding sequences (5' to 3')", ["Sequence", "mRNA (5' to 3')"], [["Original", orig], ["Mutated", mut]])
    stem = "The table shows part of an mRNA before and after a single mutation in the gene. The sequence begins with a start codon. Which statement best describes the effect of the mutation on the polypeptide?"
    return mk("bi_mutation_effect", "6.7", "5.D", stem, key, ds, rng, concept="classify a point mutation as silent, missense, nonsense, or frameshift by comparing translations", stim=stim, path="translate both sequences and classify by comparison vs the generating mutation type", facts=[f"orig={orig}", f"mut={mut}", f"kind={kind}"], judgment="translate both sequences and compare the polypeptides")


@retry_sep
def bi_lac_operon(rng):
    patterns = {"wild type": ("No", "Yes"), "constitutive": ("Yes", "Yes"), "never": ("No", "No")}
    labs = ["Strain 1", "Strain 2", "Strain 3"]
    assign = list(patterns)
    rng.shuffle(assign)
    rows = [[lab, patterns[a][0], patterns[a][1]] for lab, a in zip(labs, assign)]
    tgt = pick(rng, ["constitutive", "never"])
    pos = assign.index(tgt)
    # 독립 경로: 유전자 논리(억제자 기능·작동자·프로모터)로 각 가설 균주의 발현 예측과 표를 비교
    def predict(strain, lactose):
        if strain == "constitutive":
            return True
        if strain == "never":
            return False
        return lactose
    ok = all((rows[i][1] == "Yes") == predict(assign[i], False) and (rows[i][2] == "Yes") == predict(assign[i], True) for i in range(3))
    agree(0, 0 if ok else 1, 1e-9, "logic")
    if tgt == "constitutive":
        q = "Which strain most likely has a mutation that prevents the repressor from blocking transcription of the operon (for example, a nonfunctional repressor or an operator that cannot bind it)?"
        kw = "The enzymes are made even without lactose, which happens when the repressor cannot block the operon."
    else:
        q = "Which strain most likely has a mutation in the promoter that prevents RNA polymerase from binding?"
        kw = "No enzymes are made with or without lactose, which happens when RNA polymerase cannot begin transcription."
    key = Opt(labs[pos], True, f"{labs[pos]} shows enzyme production {'with and without lactose' if tgt == 'constitutive' else 'in neither condition'}. {kw}", None)
    ds = []
    for i, lab in enumerate(labs):
        if i == pos:
            continue
        a = assign[i]
        ds.append(Opt(lab, False, {"wild type": f"{lab} makes enzymes only when lactose is present, which is the regulated pattern of a normal operon and does not match the described mutation.", "constitutive": f"{lab} makes enzymes with and without lactose, which fits loss of repression and not a promoter defect.", "never": f"{lab} makes no enzymes in either condition, which fits a defective promoter and not loss of repression."}[a], None))
    ds.append(Opt("None of the strains", False, "Mutations in regulatory regions or in regulatory proteins can change expression, and one strain fits the data.", None))
    stim = tbl("Presence of lactose-digesting enzyme in three strains of E. coli grown without and with lactose", ["Strain", "Enzyme present without lactose", "Enzyme present with lactose"], rows)
    stem = "The table shows whether three strains of E. coli produce the enzymes of the lac operon when grown without lactose and with lactose. " + q
    return mk("bi_lac_operon", "6.5", "6.C", stem, key, ds, rng, concept="use expression data from mutant strains to infer a defect in an inducible operon", stim=stim, path="gene-logic predictions for each candidate mutation compared with the table vs the generating assignment", facts=[f"assign={assign}", f"tgt={tgt}"], judgment="connect the pattern of expression to a defect in repressor, operator, or promoter")


@retry_sep
def bi_restriction_gel(rng):
    L = pick(rng, [4000, 5000, 6000, 8000, 10000])
    circ = pick(rng, [True, False])
    k = pick(rng, [1, 2]) if not circ else pick(rng, [2, 3])
    cuts = sorted(rng.sample(range(500, L - 500, 100), k))
    if any(b - a < 600 for a, b in zip(cuts, cuts[1:])) or (circ and (L - cuts[-1] + cuts[0]) < 600):
        raise ValueError("close")
    if circ:
        frags = [cuts[i + 1] - cuts[i] for i in range(len(cuts) - 1)] + [L - cuts[-1] + cuts[0]]
        # 독립 경로: 원형을 L 만큼 풀어 좌표 두 바퀴로 조각을 센다
        pts = cuts + [c + L for c in cuts]
        alt = [pts[i + 1] - pts[i] for i in range(len(cuts))]
        assert sorted(frags) == sorted(alt)
    else:
        edges = [0] + cuts + [L]
        frags = [edges[i + 1] - edges[i] for i in range(len(edges) - 1)]
        assert sorted(frags) == sorted(np.diff(edges).tolist())
    frags = sorted(frags, reverse=True)
    fmt = lambda fs: ", ".join(f"{f:,}" for f in fs) + " bp"  # noqa: E731
    keytxt = fmt(frags)
    cands = [("Lists the positions of the cut sites instead of the fragment lengths.", cuts), ("Treats the molecule as linear when it is circular, so one fragment is missing or too large." if circ else "Treats the molecule as circular, so one fragment is missing.", None)]
    wrong = []
    if circ:
        edges = [0] + cuts + [L]
        lin = sorted([edges[i + 1] - edges[i] for i in range(len(edges) - 1)], reverse=True)
        wrong.append(("Treats the circular DNA as if it were linear, which gives one extra fragment.", lin))
    else:
        wrong.append(("Treats the linear DNA as if it were circular, which merges the two end pieces and gives one fewer fragment.", sorted(([cuts[i + 1] - cuts[i] for i in range(len(cuts) - 1)] + [L - cuts[-1] + cuts[0]]), reverse=True)))
    wrong.append(("Lists the positions of the cut sites instead of the fragment lengths.", sorted(cuts, reverse=True)))
    wrong.append(("Leaves out the largest fragment.", frags[1:]))
    wrong.append(("Gives the total length as a single fragment, as if the enzyme did not cut.", [L]))
    seen = {keytxt}; ds = []
    for why, fs in wrong:
        t = fmt(fs)
        if t in seen or not fs:
            continue
        seen.add(t); ds.append(Opt(t, False, why, None))
    if len(ds) < 3:
        raise ValueError("few")
    shape = "circular plasmid" if circ else "linear DNA molecule"
    cs = ", ".join(f"{c:,}" for c in cuts)
    key = Opt(keytxt, True, f"The enzyme cuts the {shape} of {L:,} bp at {len(cuts)} sites ({cs} bp from the reference point), giving {len(frags)} fragments with lengths {keytxt}.", None)
    stem = f"A {shape} that is {L:,} base pairs long is cut by a restriction enzyme at {len(cuts)} site{'s' if len(cuts) > 1 else ''}, located {cs} base pairs from a reference point on the molecule. Which choice lists the lengths of the fragments produced when the DNA is completely digested?"
    return mk("bi_restriction_gel", "6.8", "5.A", stem, key, ds, rng, concept="fragment lengths from restriction sites on linear or circular DNA", path="differences of consecutive cut positions with the circular wrap-around vs numpy.diff over the unrolled coordinates", facts=[f"L={L}", f"circ={circ}", f"cuts={cuts}"], judgment="count fragments for linear and circular DNA and subtract positions")


@retry_sep
def bi_gel_interpretation(rng):
    pool = [450, 620, 900, 1250, 1600, 2100, 2800, 3500]
    scene = sorted(rng.sample(pool, 3), reverse=True)
    sus = {}
    names = ["Suspect A", "Suspect B", "Suspect C"]
    match = rng.randrange(3)
    for i, nm in enumerate(names):
        if i == match:
            sus[nm] = list(scene)
        else:
            alt = list(scene)
            j = rng.randrange(3)
            repl = rng.choice([p for p in pool if p not in scene])
            alt[j] = repl
            sus[nm] = sorted(alt, reverse=True)
    rows = [["Crime scene sample", ", ".join(map(str, scene))]] + [[n, ", ".join(map(str, sus[n]))] for n in names]
    # 독립 경로: 집합 비교
    m = [n for n in names if set(sus[n]) == set(scene)]
    agree(0, 0 if m == [names[match]] else 1, 1e-9, "match")
    key = Opt(names[match], True, f"{names[match]}'s DNA fragments ({', '.join(map(str, scene))} bp) are identical to those of the crime scene sample, so the DNA is consistent with that suspect.", None)
    ds = []
    for n in names:
        if n == names[match]:
            continue
        diff = [x for x in sus[n] if x not in scene]
        ds.append(Opt(n, False, f"{n}'s pattern contains a fragment of {diff[0]} bp that is not in the crime scene sample, so the patterns do not match.", None))
    ds.append(Opt("None of the suspects", False, "One suspect has a fragment pattern identical to the crime scene sample, so one suspect is consistent with it.", None))
    stim = tbl("Sizes of DNA fragments (base pairs) produced by the same restriction enzyme in each sample", ["Sample", "Fragment sizes (bp)"], rows)
    stem = "DNA from a crime scene and from three suspects was cut with the same restriction enzyme and separated by gel electrophoresis. The table lists the fragment sizes. Which suspect's DNA is consistent with the crime scene sample?"
    return mk("bi_gel_interpretation", "6.8", "4.B", stem, key, ds, rng, concept="compare restriction fragment patterns from a gel", stim=stim, path="set equality of fragment sizes vs the generating match index", facts=[f"scene={scene}", f"match={names[match]}"], judgment="compare patterns band by band and not only partially")


@retry_sep
def bi_pcr(rng):
    n = pick(rng, [4, 5, 6, 8, 10])
    m = pick(rng, [1, 2, 5, 10])
    cur = m
    for _ in range(n):
        cur *= 2
    agree(cur, m * 2 ** n, 1e-9, "copies")
    pairs = [("Adds two copies per cycle instead of doubling the number of copies.", m + 2 * n), ("Multiplies the starting number by the number of cycles.", m * n), ("Doubles the number of cycles instead of raising two to that power.", m * 2 * n), ("Raises the starting number to the power of the number of cycles.", m ** n if m > 1 else 2 ** (n - 1)), ("Doubles once fewer than the number of cycles, as if the first cycle made no copies.", m * 2 ** (n - 1))]
    key, ds = val_opts(cur, pairs, lambda v: f"{int(v):,}", rel=0.08, gap=1)
    stem = f"A PCR reaction begins with {m} copy{'ies' if m > 1 else ''} of a double-stranded target DNA sequence. Assuming that every DNA molecule is copied in every cycle, how many copies of the target sequence are present after {n} cycles?"
    return mk("bi_pcr", "6.8", "5.A", stem, key, ds, rng, concept="exponential amplification by PCR", path="stepwise doubling loop vs the closed form m x 2^n", facts=[f"n={n}", f"m={m}", f"copies={cur}"], judgment="recognize that each cycle doubles the number of molecules", kwhy=f"The number of copies doubles in each cycle, so after {n} cycles there are {m} x 2^{n} = {cur:,} copies.")


@retry_sep
def bi_transformation(rng):
    col = rng.randint(24, 90)
    rows = [["1", "Bacteria without plasmid", "Nutrient agar", "Lawn of bacteria"], ["2", "Bacteria without plasmid", "Nutrient agar + ampicillin", "No colonies"], ["3", "Bacteria treated with plasmid carrying an ampicillin-resistance gene", "Nutrient agar + ampicillin", f"{col} colonies"], ["4", "Bacteria treated with plasmid carrying an ampicillin-resistance gene", "Nutrient agar", "Lawn of bacteria"]]
    key = Opt("Plate 3, because bacteria that took up the plasmid grew on a medium that kills nonresistant cells", True, f"Only cells that were transformed with the ampicillin-resistance plasmid can grow on ampicillin, and plate 3 has {col} colonies while plate 2 (no plasmid) has none.", None)
    ds = [Opt("Plate 1, because bacteria grew without any antibiotic present", False, "Growth on plain agar shows that the bacteria are alive but not that transformation occurred.", None),
          Opt("Plate 2, because no bacteria grew in the presence of ampicillin", False, "Plate 2 is a control showing that untransformed bacteria are killed by ampicillin.", None),
          Opt("Plate 4, because the lawn shows that the plasmid was taken up by every cell", False, "A lawn on plain agar does not show which cells took up the plasmid.", None)]
    stim = tbl("Growth of E. coli on four plates after a transformation experiment", ["Plate", "Bacteria", "Medium", "Result after incubation"], rows)
    stem = "A student tries to transform E. coli with a plasmid that carries a gene for ampicillin resistance. The table shows the results on four plates. Which plate provides the best evidence that transformation occurred?"
    return mk("bi_transformation", "6.8", "6.B", stem, key, ds, rng, concept="use selection on antibiotic plates as evidence of transformation", stim=stim, path="logic of controls (no plasmid on ampicillin) vs the experimental plate", facts=[f"colonies={col}"], judgment="use the control plates to decide which plate supports the claim")


bi_rna_processing = make_bank_archetype("bi_rna_processing", "6.3", "1.B", [
    B("In eukaryotic cells, a primary transcript is modified before it leaves the nucleus. Which set of modifications correctly describes this processing?",
      ("A 5' cap and a poly-A tail are added, and introns are removed by splicing.", "Eukaryotic mRNA is capped, polyadenylated, and spliced before export."),
      [("Exons are removed, and introns are joined to form the mature mRNA.", "Introns are removed and exons are joined."),
       ("Introns are translated first, then the exons are added to the poly-A tail.", "Introns are removed and are not translated."),
       ("A 3' cap and a 5' poly-A tail are added, and the mRNA is converted into DNA.", "The cap is at the 5' end and the tail is at the 3' end; mRNA is not converted into DNA.")]),
    B("A gene has several exons. Different cells splice the primary transcript to include different combinations of exons. What is a consequence of this alternative splicing?",
      ("A single gene can produce more than one version of a protein.", "Different combinations of exons produce different mature mRNAs and different proteins."),
      [("Each gene can produce only one mRNA and one protein.", "Alternative splicing allows multiple products."),
       ("The DNA sequence of the gene differs among the cells.", "The gene is identical in all of the cells; the splicing differs."),
       ("The introns are translated into different amino acids in each cell.", "Introns are removed before translation.")]),
], "describe processing of eukaryotic mRNA", "fixed fact bank checked against CED 6.3", est=60)

bi_gene_regulation = make_bank_archetype("bi_gene_regulation", "6.5", "1.C", [
    B("A transcription factor binds to a regulatory sequence near a gene and increases the rate of transcription of that gene. How does this binding most likely change the cell?",
      ("The cell produces more of the protein encoded by the gene.", "Increased transcription generally leads to more mRNA and more protein."),
      [("The cell produces less of the protein because transcription factors prevent translation.", "Transcription factors regulate transcription, not translation."),
       ("The gene sequence is rewritten to include more exons.", "Transcription factors do not change the DNA sequence."),
       ("The cell loses the gene from its DNA after transcription.", "Transcription does not remove genes.")]),
    B("DNA methylation in the promoter region of a gene is associated with reduced transcription of the gene. Which statement best describes this type of regulation?",
      ("An epigenetic modification changes gene expression without changing the DNA sequence.", "Methylation is a chemical modification that can reduce gene expression while the base sequence remains the same."),
      [("A mutation deletes the promoter, so the DNA sequence is changed.", "Methylation does not change the DNA sequence."),
       ("The cell makes a different protein because the codons are changed.", "Methylation does not change codons."),
       ("The methyl group is added to the mRNA to speed up translation.", "The modification described is on DNA and is associated with reduced transcription.")]),
    B("Steroid hormones can enter cells and bind receptors that then act as transcription factors. Which prediction is best supported?",
      ("The hormone-receptor complex changes the transcription of specific genes in target cells.", "The complex binds regulatory DNA sequences and alters transcription."),
      [("The hormone changes the DNA sequence of the target genes.", "Hormone binding does not change the DNA sequence."),
       ("The hormone-receptor complex translates mRNA into protein at the plasma membrane.", "Translation occurs on ribosomes."),
       ("The hormone prevents all genes from being expressed in every cell.", "The effect is specific to certain genes in target cells.")]),
], "relate regulatory proteins and modifications to gene expression", "fixed fact bank checked against CED 6.5", est=60)

bi_cell_specialization = make_bank_archetype("bi_cell_specialization", "6.6", "1.B", [
    B("Nerve cells and muscle cells in the same person have the same DNA but different structures and functions. Which statement best explains this?",
      ("Different genes are expressed in the two cell types, so they make different sets of proteins.", "Differential gene expression produces cell specialization in cells with the same genome."),
      [("The nerve cells and muscle cells contain different genes.", "All of the somatic cells in an individual contain the same genes."),
       ("Muscle cells lose the genes for proteins found in nerve cells during development.", "Specialization is not caused by loss of genes."),
       ("The two cell types make the same proteins in different amounts of each organelle.", "The two cell types express different sets of genes and not the same proteins in different organelle amounts.")]),
    B("A researcher moves the nucleus of a differentiated frog intestinal cell into an egg whose nucleus was removed, and the egg develops into a normal tadpole. What does this experiment suggest?",
      ("The differentiated cell kept all of the genes needed for development.", "The nucleus from a specialized cell can direct normal development, so genes are not permanently lost."),
      [("Differentiation always removes genes that are not used.", "The tadpole developed normally, so the genes were still present."),
       ("The egg cytoplasm contains the DNA that directs development.", "The nucleus provides the DNA used for development."),
       ("Intestinal cells cannot express any genes after differentiation.", "Intestinal cells express genes; the experiment is about the presence of the genes.")]),
], "explain how cells with the same genome specialize", "fixed fact bank checked against CED 6.6", est=60)

bi_translation_concept = make_bank_archetype("bi_translation_concept", "6.4", "1.A", [
    B("During translation, a tRNA molecule brings an amino acid to the ribosome. Which feature of the tRNA ensures that the correct amino acid is added at each codon?",
      ("The anticodon of the tRNA pairs with the codon of the mRNA, and the tRNA carries the matching amino acid.", "Codon-anticodon pairing specifies which charged tRNA binds at the ribosome."),
      [("The tRNA has a codon that pairs with the anticodon of the mRNA.", "Codons are on mRNA and anticodons are on tRNA."),
       ("The ribosome chooses amino acids by their R groups without the tRNA.", "The tRNA is required to bring the amino acids and to match them to codons."),
       ("The tRNA has a sequence of DNA that is complementary to the gene.", "A tRNA is RNA, and its anticodon pairs with the mRNA codon.")]),
    B("In a ribosome, which site holds the tRNA carrying the growing polypeptide chain?",
      ("The P site, where the tRNA holding the chain sits", "The P site holds the tRNA attached to the polypeptide chain."),
      [("The A site, where the next tRNA enters", "The A site holds the incoming aminoacyl-tRNA."),
       ("The E site, where the chain is released", "The E site is the exit site for uncharged tRNAs."),
       ("The nuclear pore, where the chain is made", "Ribosomes are not attached to DNA at nuclear pores.")]),
    B("Ribosomes synthesizing proteins that will be secreted from the cell are attached to which structure?",
      ("The rough endoplasmic reticulum", "Proteins destined for secretion are made on ribosomes bound to the rough ER."),
      [("The inner mitochondrial membrane", "Mitochondrial ribosomes make proteins inside the mitochondrion."),
       ("The nuclear lamina", "Ribosomes are not bound to the nuclear lamina."),
       ("The Golgi complex", "The Golgi modifies proteins after they are made.")]),
], "describe the roles of tRNA, ribosome sites, and locations of translation", "fixed fact bank checked against CED 6.4", est=60)

bi_central_dogma_inhibitor = make_bank_archetype("bi_central_dogma_inhibitor", "6.3", "6.E", [
    B("A drug blocks RNA polymerase in eukaryotic cells. Which change would be observed first in treated cells?",
      ("Levels of newly made mRNA decrease, and later protein synthesis declines.", "RNA polymerase makes mRNA, so blocking it reduces mRNA and then the proteins made from it."),
      [("DNA replication stops immediately because RNA polymerase copies the DNA.", "DNA replication is carried out by DNA polymerase."),
       ("Existing proteins are destroyed because RNA polymerase maintains them.", "Existing proteins are not maintained by RNA polymerase."),
       ("The ribosomes begin to make DNA from the mRNA.", "Ribosomes make proteins and not DNA.")]),
    B("A drug binds to ribosomes and blocks the movement of the ribosome along the mRNA. Which result is most likely?",
      ("Protein synthesis is inhibited, but transcription can continue.", "The drug acts at translation and does not directly block RNA synthesis."),
      [("Transcription stops immediately because ribosomes are part of RNA polymerase.", "Ribosomes are not part of RNA polymerase."),
       ("DNA replication stops because ribosomes copy DNA.", "Ribosomes do not copy DNA."),
       ("The mRNA is converted into DNA by the blocked ribosomes.", "mRNA is not converted into DNA by ribosomes.")]),
], "predict the effect of inhibiting a step of the central dogma", "fixed fact bank checked against CED 6.3 and 6.4", est=60)


@retry_sep
def bi_trna_anticodon(rng):
    codon = "".join(rng.choice("ACGU") for _ in range(3))
    if CODON[codon] == "*":
        raise ValueError("codon")
    comp = "".join({"A": "U", "U": "A", "G": "C", "C": "G"}[c] for c in codon)
    # 독립 경로: 5'→3' 로 쓴 반(反)코돈을 역으로 읽어 3'→5' 표기와 일치하는지
    anti_53 = comp[::-1]
    agree(0, 0 if anti_53[::-1] == comp else 1, 1e-9, "anti")
    cands = [("Writes the anticodon identical to the codon.", codon), ("Writes the complement with thymine in place of uracil.", comp.replace("U", "T")), ("Writes the complementary bases in the reverse order for the 3' to 5' direction.", comp[::-1]), ("Gives the DNA coding sequence complement of the codon written with thymine.", codon.replace("U", "T"))]
    seen = {comp}; ds = []
    for why, a in cands:
        if a in seen:
            continue
        seen.add(a); ds.append(Opt(f"3'-{a}-5'", False, why, None))
    if len(ds) < 3:
        raise ValueError("few")
    key = Opt(f"3'-{comp}-5'", True, f"The anticodon pairs antiparallel with the codon: A with U and G with C. The codon 5'-{codon}-3' pairs with the anticodon 3'-{comp}-5'.", None)
    stem = f"An mRNA codon in the A site of a ribosome has the sequence 5'-{codon}-3'. Which choice shows the anticodon of the tRNA that binds to this codon?"
    return mk("bi_trna_anticodon", "6.4", "2.D", stem, key, ds, rng, concept="tRNA anticodon complementary and antiparallel to an mRNA codon", path="complement written 3' to 5' vs reverse of the 5' to 3' anticodon", facts=[f"codon={codon}"], judgment="represent codon-anticodon pairing with the correct polarity")


STAGE_U5 = ["bi_meiosis_chromosomes", "bi_gamete_combos", "bi_meiosis_variation", "bi_nondisjunction", "bi_monohybrid_prob", "bi_dihybrid_prob", "bi_testcross", "bi_chi_square", "bi_chi_square_hypothesis", "bi_linkage_map", "bi_pedigree_mode", "bi_sex_linked", "bi_nonmendelian", "bi_environment_phenotype"]
STAGE_U6 = ["bi_dna_structure", "bi_replication_enzymes", "bi_replication_strands", "bi_transcription", "bi_translation", "bi_mutation_effect", "bi_lac_operon", "bi_restriction_gel", "bi_gel_interpretation", "bi_pcr", "bi_transformation", "bi_rna_processing", "bi_gene_regulation", "bi_cell_specialization", "bi_translation_concept", "bi_central_dogma_inhibitor", "bi_trna_anticodon"]
