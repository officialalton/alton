"""AP Biology 원형 J — exam_prep 보강 2차(2026-10-14, bio-v2): Practice 5 가 아닌 스킬(예측 6.E·근거 6.B·모델 관계 2.B·자료 서술 4.B·가설 3.B)에서
계산을 거쳐 결론·예측·해석으로 끝나는 다단계 문항. 한 회 Practice 5 는 8–14 문항으로 제한되므로, exam_prep 을 24 문항까지 올리려면 다른 Practice 의 exam_prep 이 필요하다.
모든 값은 코드가 두 경로로 계산하고, 오답은 단계를 빠뜨리거나 잘못 적용한 값이다."""
from fractions import Fraction as Fr  # noqa: F811
from bio_common import *  # noqa: F401,F403
from bio_p0_i import _retry, _steps, _num


# ---------------------------------------------------------------- 예측(6.E)
@_retry
def bi_y_selection_partial(rng):
    q = pick(rng, [0.3, 0.4, 0.5, 0.6]); s = pick(rng, [0.4, 0.5, 0.6, 0.8])
    p = 1 - q
    wbar = 1 - s * q * q
    val = (q - s * q * q) / wbar
    # 독립 경로: 10000 개체의 대립유전자를 센다
    N = 10000
    nAA, nAa, naa = p * p * N, 2 * p * q * N, q * q * N
    a_alleles = nAa * 1.0 + naa * (1 - s) * 2
    tot = 2 * (nAA + nAa + naa * (1 - s))
    agree(a_alleles / tot, val, 1e-9, "q'")
    pairs = [("Reports the frequency of the allele before selection.", q), ("Multiplies the allele frequency by the fitness of aa, which treats the allele frequency as a genotype frequency.", q * (1 - s)),
             ("Subtracts the loss of a alleles from the aa individuals but does not divide by the mean fitness of the population.", q - s * q * q), ("Reports the frequency of the aa genotype after selection instead of the allele frequency.", q * q * (1 - s) / wbar)]
    stem = (f"In a large, randomly mating population in Hardy-Weinberg equilibrium, the frequency of allele a is {q:g}. AA and Aa individuals have a relative fitness of 1.0, and aa individuals have a relative fitness of {1 - s:g}. "
            "Predict the frequency of allele a among the gametes that produce the next generation. (Round to two decimal places.)")
    kw = (f"Before selection AA = {p * p:.2f}, Aa = {2 * p * q:.2f}, and aa = {q * q:.2f}. The mean fitness is 1 - {s:g}({q * q:.2f}) = {wbar:.3f}. "
          f"The a alleles come from Aa (half of {2 * p * q:.2f}) and from aa ({q * q:.2f} x {1 - s:g}), so q' = ({p * q:.3f} + {q * q * (1 - s):.3f})/{wbar:.3f} = {val:.2f}.")
    return _num("bi_y_selection_partial", "7.4", "6.E", stem, val, pairs, lambda v: f"{hu(v, 2)}", rng, concept="predict allele frequency after partial selection against a recessive genotype", path="allele counting among 10,000 weighted individuals vs q'=(q-sq^2)/(1-sq^2)",
                steps=_steps("Use Hardy-Weinberg to find the genotype frequencies before selection", "Weight each genotype by its fitness to find the mean fitness", "Count the a alleles among the reproducing individuals and divide by the weighted total"), gap=0.025, rel=0.04, facts=[f"q={q}", f"s={s}", f"val={val:.4f}"], kwhy=kw)


@_retry
def bi_y_carrying_capacity_drop(rng):
    K1 = pick(rng, [800, 1000, 1200]); K2 = int(K1 * pick(rng, [0.5, 0.6])); N = int(K1 * pick(rng, [0.7, 0.75])); r = pick(rng, [0.2, 0.3, 0.4])
    if N <= K2:
        raise ValueError("N")
    g1 = r * N * (K1 - N) / K1; g2 = r * N * (K2 - N) / K2
    # 독립 경로: 닫힌 해의 짧은 시간 변화로 확인
    def step(K, h=1e-5):
        A = (K - N) / N
        return (K / (1 + A * math.exp(-r * h)) - N) / h
    agree(step(K1), g1, 1e-3, "g1"); agree(step(K2), g2, 1e-3, "g2")
    key_t = f"The population would decrease by about {abs(g2):,.0f} individuals per year, because it would be above the new carrying capacity, whereas before the change it grew by about {g1:,.0f} per year."
    wrong = [(f"The population would grow by about {abs(g2):,.0f} individuals per year, because it is below the original carrying capacity.", "The growth rate becomes negative when the population is above the new carrying capacity, so the sign is wrong."),
             (f"The population would keep growing by about {g1:,.0f} individuals per year, because the population size has not changed.", "The growth rate depends on K as well as on N, so reducing K changes the rate even if N does not change."),
             (f"The population would decrease by about {abs(r * N * (K2 - N)):,.0f} individuals per year, because the rate is r_max N (K - N) without the division by K.", "The logistic equation divides by K, so leaving that out gives a rate that is too large.")]
    ds = [(t, w) for t, w in wrong if t != key_t]
    if len({round(abs(g2)), round(g1), round(abs(r * N * (K2 - N)))}) < 3:
        raise ValueError("not_enough_separated_distractors")
    stem = (f"A population of {N:,} individuals lives in a habitat with a carrying capacity of {K1:,}, and r_max is {r:g} per year. A disease then permanently reduces the carrying capacity to {K2:,} without immediately changing the number of individuals. "
            "Using dN/dt = r_max N (K - N)/K, which prediction about the population is best supported?")
    kw = f"Before the change dN/dt = ({r:g})({N:,})({K1 - N:,})/{K1:,} = {g1:,.0f} per year. After the change dN/dt = ({r:g})({N:,})({K2 - N:,})/{K2:,} = {g2:,.0f} per year, which is negative because N is above {K2:,}."
    key, dd = sentence_options(key_t, kw, ds)
    return mk("bi_y_carrying_capacity_drop", "8.4", "6.E", stem, key, dd, rng, concept="predict the sign and size of growth when the carrying capacity falls below the population size", path="short-time change in the closed-form logistic solution vs the logistic equation",
              thinking=_steps("Calculate the growth rate with the original carrying capacity", "Calculate the growth rate with the new carrying capacity and the same population size", "Interpret the sign of the new rate"), est=110, facts=[f"g1={g1:.2f}", f"g2={g2:.2f}"], kwhy=kw, judgment="predict the effect of a lower carrying capacity from the logistic model")


@_retry
def bi_y_potato_predict(rng):
    ms = [0.0, 0.2, 0.5, 0.8]
    iso = pick(rng, [0.25, 0.3, 0.35, 0.4]); slope = pick(rng, [-20, -24, -30])
    vals = [round(slope * (m - iso), 1) for m in ms]
    M = pick(rng, [0.3, 0.35, 0.4, 0.6, 0.65, 0.7])
    i = max(k for k in range(3) if ms[k] <= M)
    f = (M - ms[i]) / (ms[i + 1] - ms[i])
    est = vals[i] + f * (vals[i + 1] - vals[i])
    # 독립 경로: 모든 점을 지나는 직선(최소제곱) 값
    co = np.polyfit(ms, vals, 1)
    agree(np.polyval(co, M), est, 0.02, "est")
    avg = (vals[i] + vals[i + 1]) / 2
    near = vals[i] if f < 0.5 else vals[i + 1]
    ext = vals[0] + (vals[1] - vals[0]) * (M - ms[0]) / (ms[1] - ms[0])
    fmt = lambda v: f"A {'gain' if v > 0 else 'loss'} of {abs(v):.1f}% in mass"  # noqa: E731
    pairs = [("Averages the percent changes of the two molarities on either side, which treats M as the midpoint between them.", avg), ("Uses the percent change of the nearest molarity in the table.", near),
             ("Gives the correct size with the wrong sign.", -est), ("Extends the line through the first two points instead of using the two points on either side of the molarity.", ext)]
    key, ds = val_opts(est, pairs, fmt, gap=0.8, rel=0.05)
    stim = tbl("Percent change in the mass of potato cores after 24 hours in sucrose solutions", ["Sucrose molarity (M)", "Percent change in mass"], [[f"{m:.1f}", f"{v:+.1f}"] for m, v in zip(ms, vals)])
    stem = f"A student measured the percent change in the mass of potato cores in four sucrose solutions. The table shows the results. Assume that the change in mass varies in a straight line between neighboring molarities. What is the best prediction for the percent change in mass of a core placed in a {M:g} M sucrose solution?"
    kw = (f"The {M:g} M solution lies between {ms[i]:.1f} M ({vals[i]:+.1f}%) and {ms[i + 1]:.1f} M ({vals[i + 1]:+.1f}%), {f:.2f} of the way between them. "
          f"The predicted change is {vals[i]:+.1f} + {f:.2f}({vals[i + 1]:+.1f} - ({vals[i]:+.1f})) = {est:+.1f}%.")
    return mk("bi_y_potato_predict", "2.7", "6.E", stem, key, ds, rng, concept="predict a mass change by interpolating between solution concentrations", path="least-squares line through all points vs interpolation between the two bracketing points",
              thinking=_steps("Identify the two molarities in the table on either side of the new solution", "Find the fraction of the distance between them", "Use that fraction to interpolate the percent change and decide whether it is a gain or a loss"), stim=stim, est=100, facts=[f"est={est:.3f}"], kwhy=kw, judgment="interpolate between data points to predict the response in a new solution")


@_retry
def bi_y_exponential_predict(rng):
    N0 = pick(rng, [500, 800, 1000, 2000]); b = pick(rng, [0.12, 0.15, 0.2]); d = pick(rng, [0.04, 0.05, 0.08]); t = 3
    val = N0 * (1 + b - d) ** t
    # 독립 경로: 해마다 출생과 사망을 따로 더하고 뺀다
    n = float(N0)
    for _ in range(t):
        n = n + b * n - d * n
    agree(n, val, 1e-9, "N")
    pairs = [("Adds the yearly net increase of the starting population three times, which does not let the increase grow with the population.", N0 * (1 + t * (b - d))), ("Leaves out the deaths and grows the population only by births.", N0 * (1 + b) ** t),
             ("Gives the population after one year only.", N0 * (1 + b - d)), ("Applies the death rate as a gain instead of a loss.", N0 * (1 + b + d) ** t)]
    stem = (f"A population of {N0:,} deer has {int(b * 100)} births and {int(round(d * 100))} deaths per 100 deer each year, and these rates stay the same as the population changes. "
            "Predict the number of deer in the population after 3 years. (Round to the nearest whole number.)")
    kw = f"Each year the population is multiplied by 1 + {b:g} - {d:g} = {1 + b - d:g}. After 3 years it is {N0:,} x {1 + b - d:g}³ = {val:,.0f}."
    return _num("bi_y_exponential_predict", "8.3", "6.E", stem, val, pairs, lambda v: f"{v:,.0f}", rng, concept="predict exponential growth from per capita birth and death rates", path="year-by-year update of births and deaths vs a power of the yearly factor",
                steps=_steps("Combine the birth and death rates into one per capita growth factor", "Apply the factor to the starting population for one year", "Repeat the growth for three years and round"), gap=15, rel=0.01, facts=[f"val={val:.2f}"], kwhy=kw)


@_retry
def bi_y_incomplete_dom_counts(rng):
    color = {"red": Fr(1, 4), "pink": Fr(1, 2), "white": Fr(1, 4)}; height = {"tall": Fr(3, 4), "short": Fr(1, 4)}
    c = pick(rng, ["red", "pink", "white"]); h = pick(rng, ["tall", "short"]); N = pick(rng, [320, 480, 640, 960])
    val = N * color[c] * height[h]
    # 독립 경로: 16 칸 푸넷 사각형 전수 열거
    from itertools import product
    cnt = 0
    for a, b in product(["R", "r"], ["R", "r"]):
        for x, y in product(["T", "t"], ["T", "t"]):
            col = {2: "red", 1: "pink", 0: "white"}[(a == "R") + (b == "R")]; ht = "tall" if "T" in (x, y) else "short"
            cnt += 1 if (col == c and ht == h) else 0
    agree(float(Fr(cnt, 16) * N), float(val), 1e-12, "count")
    complete = {"red": Fr(3, 4), "pink": Fr(3, 4), "white": Fr(1, 4)}[c] * height[h] * N if c != "white" else Fr(1, 4) * height[h] * N
    pairs = [("Treats flower color as completely dominant, so pink flowers are counted together with red flowers.", complete), ("Leaves out the height gene and uses only the flower color ratio.", color[c] * N), ("Uses one quarter for the flower color and for the height whatever the phenotype is.", N * Fr(1, 16)),
             ("Uses one half for each gene.", N * Fr(1, 4))]
    pairs = [(w, v) for w, v in pairs if v != val]
    stem = (f"In a plant, flower color is controlled by one gene with incomplete dominance (RR is red, Rr is pink, and rr is white), and height is controlled by a second, independently assorting gene with a completely dominant tall allele (T). "
            f"Two plants with the genotype RrTt are crossed, and {N} offspring are grown. How many offspring are expected to have {c} flowers and to be {h}?")
    kw = f"The probability of {c} flowers is {color[c]} and of {h} plants is {height[h]}. The genes assort independently, so the expected number is {N} x {color[c]} x {height[h]} = {float(val):g}."
    return _num("bi_y_incomplete_dom_counts", "5.4", "6.E", stem, float(val), [(w, float(v)) for w, v in pairs], lambda v: f"{v:,.0f}", rng, concept="predict offspring numbers with incomplete dominance and an independent gene", path="16-square Punnett enumeration vs product of single-gene probabilities",
                steps=_steps("Find the probability of the flower color phenotype from the incomplete dominance cross", "Find the probability of the height phenotype from the dominant allele cross", "Multiply the probabilities and the number of offspring"), gap=2, rel=0.03, facts=[c, h, f"N={N}"], kwhy=kw)


@_retry
def bi_y_light_halved_o2(rng):
    I = pick(rng, [6.0, 7.0, 8.0]); a = pick(rng, [0.8, 1.2, 1.6, 2.0]); b = pick(rng, [0.4, 0.6, 0.8]); t = pick(rng, [4, 5, 6])
    g = a + b
    final = I + (g / 2 - b) * t
    if abs(final - I) < 0.5 or final < 0:
        raise ValueError("small")
    # 독립 경로: 한 시간씩 갱신
    o2 = I
    for _ in range(t):
        o2 += g / 2 - b
    agree(o2, final, 1e-9, "o2")
    pairs = [("Halves the net rate measured in bright light instead of halving only the gross production.", I + a / 2 * t), ("Leaves out the oxygen used in respiration and counts only the halved gross production.", I + g / 2 * t),
             ("Assumes that the light does not change.", I + a * t), ("Adds the respiration to the halved gross production instead of subtracting it.", I + (g / 2 + b) * t)]
    stem = (f"A sealed bottle of pond water with algae contains {I:.1f} mg of dissolved O₂ per liter at the start. In bright light the O₂ concentration rises by {a:.1f} mg/L per hour, and in the dark it falls by {b:.1f} mg/L per hour because of respiration. "
            f"Assume that respiration continues at the same rate in light, and that gross photosynthesis is directly proportional to light intensity. If the bottle is placed in light with half the intensity of the bright light, what is the predicted O₂ concentration, in mg/L, after {t} hours?")
    kw = (f"Gross photosynthesis in bright light is {a:.1f} + {b:.1f} = {g:.1f} mg/L per hour, so in half the light it is {g / 2:.2f}. The net rate is {g / 2:.2f} - {b:.1f} = {g / 2 - b:.2f} mg/L per hour. "
          f"After {t} hours the concentration is {I:.1f} + {t}({g / 2 - b:.2f}) = {final:.1f} mg/L.")
    return _num("bi_y_light_halved_o2", "3.4", "6.E", stem, final, pairs, lambda v: f"{hu(v, 1)} mg/L", rng, concept="predict oxygen after a change in light using gross production and respiration", path="hour-by-hour bookkeeping vs a closed-form net rate",
                steps=_steps("Add respiration to the net rate in bright light to find the gross rate", "Halve the gross rate for half the light and subtract respiration", "Multiply the new net rate by the time and add it to the starting concentration"), gap=0.2, rel=0.03, facts=[f"final={final:.3f}"], kwhy=kw)


# ---------------------------------------------------------------- 근거(6.B)
@_retry
def bi_y_hw_equilibrium_claim(rng):
    N = pick(rng, [400, 500, 1000]); q = pick(rng, [0.3, 0.4, 0.5]); p = 1 - q
    exp_het = 2 * p * q * N
    ineq = pick(rng, [True, False])
    if ineq:
        het = int(round(exp_het * pick(rng, [0.5, 0.6, 1.4])))
    else:
        het = int(round(exp_het * pick(rng, [0.98, 1.0, 1.02])))
    rest = N - het
    # 호모 접합자는 대립유전자 빈도가 q 가 되도록 배분
    a_alleles = int(round(q * 2 * N)); aa = (a_alleles - het) // 2
    AA = N - het - aa
    if aa < 5 or AA < 5 or (a_alleles - het) % 2:
        raise ValueError("counts")
    qo = (het + 2 * aa) / (2 * N)
    exp_het_o = 2 * (1 - qo) * qo * N
    # 독립 경로: 열거한 대립유전자 목록에서 q 를 다시 구해 기대값 계산
    alleles = ["A"] * (2 * AA + het) + ["a"] * (2 * aa + het)
    qq = alleles.count("a") / len(alleles)
    agree(2 * (1 - qq) * qq * N, exp_het_o, 1e-9, "exp")
    far = abs(het - exp_het_o) / exp_het_o > 0.15
    stim = tbl("Genotypes of individuals sampled from a population", ["Genotype", "Number of individuals"], [["AA", AA], ["Aa", het], ["aa", aa]])
    sum_opt = (f"The population is probably in Hardy-Weinberg equilibrium, because the three genotype counts add up to {N}.", "Any sample adds up to its sample size; equilibrium depends on whether the genotype counts match the expected frequencies.")
    if far:
        lower = het < exp_het_o
        key_t = f"The population is probably not in Hardy-Weinberg equilibrium, because {'fewer' if lower else 'more'} heterozygotes were observed ({het}) than the {exp_het_o:.0f} expected."
        wrong = [(f"The population is probably not in Hardy-Weinberg equilibrium, because {'more' if lower else 'fewer'} heterozygotes were observed ({het}) than the {exp_het_o:.0f} expected.", "This reverses the comparison: the observed number of heterozygotes is on the other side of the expected number."), sum_opt,
                 (f"The population is probably in Hardy-Weinberg equilibrium, because both alleles are common (the frequency of allele a is {qo:.2f}).", "Equilibrium depends on genotype frequencies matching p², 2pq, and q², not on whether both alleles are common.")]
    else:
        key_t = f"The population is probably in Hardy-Weinberg equilibrium, because the observed number of heterozygotes ({het}) is close to the {exp_het_o:.0f} expected."
        wrong = [(f"The population is probably not in Hardy-Weinberg equilibrium, because the observed number of heterozygotes ({het}) is not exactly {exp_het_o:.0f}.", "A sample differs a little from the expected value by chance; a very small difference does not show a departure from equilibrium."),
                 (f"The population is probably not in Hardy-Weinberg equilibrium, because the frequency of allele a is {qo:.2f}, which is not equal to the frequency of allele A.", "Equilibrium does not require equal allele frequencies; it requires genotype frequencies of p², 2pq, and q²."),
                 (f"The population is probably not in Hardy-Weinberg equilibrium, because the number of AA individuals ({AA}) is not equal to the number of aa individuals ({aa}).", "Equilibrium does not require equal numbers of the two homozygotes.")]
        if qo == 0.5 or AA == aa:
            raise ValueError("equal")
    stem = "A biologist sampled a population and counted the genotypes at one gene with two alleles, A and a. The table shows the counts. Which claim is best supported by the data?"
    kw = f"The frequency of a is ({het} + 2 x {aa})/{2 * N} = {qo:.2f}, so p = {1 - qo:.2f}. The expected number of heterozygotes is 2pq x {N} = {exp_het_o:.0f}. The observed number is {het}."
    key, dd = sentence_options(key_t, kw, wrong)
    return mk("bi_y_hw_equilibrium_claim", "7.5", "6.B", stem, key, dd, rng, concept="support a claim about Hardy-Weinberg equilibrium by comparing observed and expected heterozygotes", path="allele list recount of q and expected 2pqN vs the generating counts",
              thinking=_steps("Calculate the frequency of the recessive allele from the genotype counts", "Use the allele frequencies to calculate the expected number of heterozygotes", "Compare the observed and expected numbers to judge the claim"), stim=stim, est=110, facts=[f"qo={qo:.3f}", f"exp={exp_het_o:.1f}", f"het={het}"], kwhy=kw, judgment="use computed expectations as evidence for a claim")


# ---------------------------------------------------------------- 모델·그래프(2.B)
@_retry
def bi_y_logistic_graph_peak(rng):
    K = pick(rng, [400, 600, 800, 1000]); r = pick(rng, [0.4, 0.5, 0.6]); N0 = pick(rng, [10, 20, 40])
    ts = list(range(0, 31))
    Nt = [K / (1 + (K - N0) / N0 * math.exp(-r * t)) for t in ts]
    ymax = math.ceil(K * 1.2 / 200) * 200
    val = r * K / 4
    # 독립 경로: 그래프 점의 최대 증가량(해당 시간 간격으로 환산)
    steps_ = [(Nt[i + 1] - Nt[i]) for i in range(30)]
    agree(max(steps_), val, 0.12, "peak")
    pairs = [("Uses the carrying capacity in place of the population size in r_max N (K - N)/K, which gives r_max times K.", r * K), ("Uses half of the carrying capacity but leaves out the factor (K - N)/K.", r * K / 2), ("Calculates N(K - N)/K at the midpoint but forgets to multiply by r_max.", K / 4), ("Reads the population size in the year of fastest growth instead of the rate.", K / 2)]
    key, ds = val_opts(val, pairs, lambda v: f"{hu(v, 0)} individuals per day", gap=3, rel=0.06)
    stim = graph_stim("Size of a population over time", [("Population size", [[t, round(n, 1)] for t, n in zip(ts, Nt)])], gaxis("Time (days)", 0, 30, 5), gaxis("Number of individuals", 0, ymax, 200))
    stem = f"The graph shows the size of a population in a new habitat. For this population, r_max is {r:g} per day. Use the graph and the equation dN/dt = r_max N (K - N)/K to estimate the maximum population growth rate, in individuals per day."
    kw = f"The curve levels off at the carrying capacity K = {K}. Growth is fastest at N = K/2 = {K // 2}, where dN/dt = r_max (K/2)(K/2)/K = r_max K/4 = ({r:g})({K})/4 = {val:g} individuals per day."
    return mk("bi_y_logistic_graph_peak", "8.4", "2.B", stem, key, ds, rng, concept="relate the plateau and the midpoint of a logistic graph to the maximum growth rate", path="largest one-day increase between plotted points vs r_max K/4",
              thinking=_steps("Read the carrying capacity from the plateau of the graph", "Find the population size at which growth is fastest (K/2)", "Substitute into the logistic equation to calculate the growth rate"), stim=stim, est=110, facts=[f"K={K}", f"r={r}"], kwhy=kw, judgment="read a graph and use the model equation at the point of fastest growth")


@_retry
def bi_y_phylo_distance_tree(rng):
    names = ["P", "Q", "R", "S"]; rng.shuffle(names)
    a, b, c, d = names
    h1 = pick(rng, [2, 3, 4]); h2 = h1 + pick(rng, [2, 3, 4]); h3 = h2 + pick(rng, [2, 3])
    dist = {(a, b): 2 * h1, (a, c): 2 * h2, (b, c): 2 * h2, (a, d): 2 * h3, (b, d): 2 * h3, (c, d): 2 * h3}
    # 독립 경로: 가장 짧은 거리 쌍 반복 결합(UPGMA 첫 단계)
    pair = min(dist, key=dist.get)
    agree(1.0 if set(pair) == {a, b} else 0.0, 1.0, 0, "pair")
    key_t = f"{a} and {b} share the most recent common ancestor, and each lineage has about {h1} substitutions per 100 sites since that ancestor."
    wrong = [(f"{a} and {b} share the most recent common ancestor, and each lineage has about {2 * h1} substitutions per 100 sites since that ancestor.", "The table gives the total difference between the two taxa, which is the sum of changes on both lineages; each lineage has half of it."),
             (f"{a} and {c} share the most recent common ancestor, and each lineage has about {h2} substitutions per 100 sites since that ancestor.", "The pair with the smallest difference is the most closely related pair, and {a} and {c} differ more than {a} and {b} do.".replace("{a}", a).replace("{c}", c).replace("{b}", b)),
             (f"{c} and {d} share the most recent common ancestor, and each lineage has about {h3} substitutions per 100 sites since that ancestor.", f"{c} and {d} have the largest difference, so they are the most distantly related pair and not the most closely related pair.")]
    rows = [[x, *[("-" if x == y else str(dist.get((x, y), dist.get((y, x))))) for y in sorted(names)]] for x in sorted(names)]
    stim = tbl("Number of nucleotide differences per 100 sites between four species", ["Species", *sorted(names)], rows)
    stem = "The table shows the number of nucleotide differences per 100 sites between pairs of four species. Assume that substitutions accumulated at the same constant rate along every lineage. Which statement is best supported by the data?"
    kw = f"The smallest difference is between {a} and {b} ({2 * h1}), so they share the most recent common ancestor. The difference is the sum of the changes on both lineages, so each lineage has {2 * h1}/2 = {h1} substitutions per 100 sites."
    key, dd = sentence_options(key_t, kw, wrong)
    return mk("bi_y_phylo_distance_tree", "7.9", "2.B", stem, key, dd, rng, concept="read a distance table to find sister species and the divergence along each lineage", path="smallest-distance pair vs the generating tree heights",
              thinking=_steps("Find the pair of species with the smallest difference", "Use the other differences to confirm which species branched earlier", "Divide the difference by two to estimate the changes on each lineage"), stim=stim, est=110, facts=[f"h1={h1}", f"h2={h2}", f"h3={h3}"], kwhy=kw, judgment="use a distance table and a constant rate to describe relationships")


@_retry
def bi_y_enzyme_graph_slopes(rng):
    E1 = pick(rng, [2, 4]); k = pick(rng, [1.5, 2.0, 2.5, 3.0]); s1 = pick(rng, [1.0, 1.5, 2.0]); p0 = pick(rng, [1.0, 2.0, 3.0])
    s2 = k * s1
    ts = [0, 1, 2, 3, 4]
    c1 = [[t, round(s1 * t, 2)] for t in ts]; c2 = [[t, round(p0 + s2 * t, 2)] for t in ts]
    val = k * E1
    # 독립 경로: 두 직선의 기울기를 최소제곱으로 구한다
    sl1 = np.polyfit([x for x, _ in c1], [y for _, y in c1], 1)[0]; sl2 = np.polyfit([x for x, _ in c2], [y for _, y in c2], 1)[0]
    agree(sl2 / sl1 * E1, val, 1e-6, "E2")
    fin = (p0 + s2 * 4) / (s1 * 4) * E1
    pairs = [("Compares the amounts of product at 4 minutes instead of the rates, which includes the product already present at time zero.", fin), ("Divides the rate of tube 1 by the rate of tube 2.", E1 / k), ("Subtracts the two rates and adds the result to the enzyme amount in tube 1.", E1 + (s2 - s1)),
             ("Uses the enzyme amount of tube 1 without considering the rates.", float(E1))]
    key, ds = val_opts(val, pairs, lambda v: f"{hu(v, 1)} µg", gap=0.15, rel=0.04)
    ymax = math.ceil(max(c2[-1][1], c1[-1][1]) / 2) * 2
    stim = graph_stim("Product formed over time in two tubes", [("Tube 1", c1), ("Tube 2", c2)], gaxis("Time (minutes)", 0, 4, 1), gaxis("Product (µmol)", 0, ymax, 2 if ymax <= 20 else 4))
    stem = f"Two tubes contained the same substrate concentration and different amounts of the same enzyme. Tube 1 contained {E1} µg of enzyme. The graph shows the amount of product in each tube. Tube 2 already contained some product when the reaction was started. Assume that the rate of the reaction is directly proportional to the amount of enzyme. How much enzyme does tube 2 contain?"
    kw = f"The rate is the slope: tube 1 is {s1:g} µmol/min and tube 2 is {s2:g} µmol/min. The ratio of the rates is {k:g}, so tube 2 has {k:g} x {E1} = {val:g} µg of enzyme."
    return mk("bi_y_enzyme_graph_slopes", "3.1", "2.B", stem, key, ds, rng, concept="relate the slopes of two reaction progress lines to the amounts of enzyme", path="least-squares slopes vs the generating rate ratio",
              thinking=_steps("Read two points on each line to find the slope, which is the reaction rate", "Divide the rate of tube 2 by the rate of tube 1", "Multiply the ratio by the amount of enzyme in tube 1"), stim=stim, est=120, facts=[f"s1={s1}", f"s2={s2}", f"p0={p0}"], kwhy=kw, judgment="use slopes, not endpoints, to compare rates in a graph")


# ---------------------------------------------------------------- 자료 서술(4.B)
@_retry
def bi_y_rates_percent_greatest(rng):
    temps = [15, 25, 35, 45]
    r = [pick(rng, [2, 3, 4]), 0, 0, 0]
    r[1] = r[0] * pick(rng, [1.5, 2.0, 2.5]); r[2] = r[1] * pick(rng, [1.2, 1.4, 1.6]); r[3] = r[2] * pick(rng, [0.1, 0.25, 0.5])
    t1, t2 = 2, 6
    c1 = [pick(rng, [1.0, 2.0]) for _ in temps]
    c2 = [c1[i] + r[i] * (t2 - t1) for i in range(4)]
    if any(abs(v * 10 - round(v * 10)) > 1e-9 for v in c2) or any(abs(x - round(x, 2)) > 1e-9 for x in r):
        raise ValueError("round")
    pct = [(r[i + 1] - r[i]) / r[i] * 100 for i in range(3)]
    ab = [r[i + 1] - r[i] for i in range(3)]
    best_pct = int(np.argmax(pct)); best_abs = int(np.argmax(ab))
    if best_pct == best_abs or sorted(pct)[-1] - sorted(pct)[-2] < 8:
        raise ValueError("not_distinct")
    lab = lambda i: f"{temps[i]} °C and {temps[i + 1]} °C"  # noqa: E731
    most_down = int(np.argmin(pct))
    key_t = f"The rate increased by the largest percent between {lab(best_pct)}, by {pct[best_pct]:.0f}%."
    wrong = [(f"The rate increased by the largest percent between {lab(best_abs)}, by {pct[best_abs]:.0f}%.", f"This interval has the largest increase in µmol per minute ({ab[best_abs]:.1f}), but its percent increase ({pct[best_abs]:.0f}%) is not the largest."),
             (f"The rate increased by the largest percent between {lab(most_down)}, by {abs(pct[most_down]):.0f}%.", f"The rate decreased in this interval, so it is a percent decrease of {abs(pct[most_down]):.0f}% and not an increase."),
             (f"The rate increased by the largest percent between {lab(best_pct)}, by {ab[best_pct]:.1f}%.", "The number is the increase in the rate in µmol per minute and not a percent of the starting rate.")]
    stim = tbl("Product formed by an enzyme at four temperatures (µmol)", ["Temperature", f"Product at {t1} min", f"Product at {t2} min"], [[f"{T} °C", f"{a:.1f}", f"{b:.1f}"] for T, a, b in zip(temps, c1, c2)])
    stem = f"A student measured the product formed by an enzyme at four temperatures after {t1} minutes and after {t2} minutes. The reaction was linear over this period. Which statement correctly describes the change in the rate of the reaction between neighboring temperatures?"
    kw = f"The rates are {', '.join(f'{x:.2f}' for x in r)} µmol/min at the four temperatures. The percent changes between neighboring temperatures are {', '.join(f'{x:.0f}%' for x in pct)}. The largest percent increase is between {lab(best_pct)}."
    key, dd = sentence_options(key_t, kw, wrong)
    return mk("bi_y_rates_percent_greatest", "3.2", "4.B", stem, key, dd, rng, concept="describe percent changes in enzyme rate between temperatures", path="rates and percent changes recomputed from the table vs the generating rate sequence",
              thinking=_steps("Calculate the rate at each temperature from the change in product over time", "Calculate the percent change in rate between each pair of neighboring temperatures", "Choose the interval with the largest percent increase and report it correctly"), stim=stim, est=120, facts=[f"r={r}"], kwhy=kw, judgment="compare percent changes rather than absolute changes")


@_retry
def bi_y_expression_normalized(rng):
    f1 = pick(rng, [2.0, 3.0, 4.0]); h_scale = pick(rng, [1.5, 2.0, 2.5, 3.0])
    x0 = pick(rng, [20, 30, 40]); h0 = pick(rng, [100, 120]); x1 = x0 * f1 * h_scale; h1 = h0 * h_scale
    if abs(x1 - round(x1)) > 1e-9 or abs(h1 - round(h1)) > 1e-9:
        raise ValueError("int")
    val = (x1 / h1) / (x0 / h0)
    agree(val, f1, 1e-9, "fold")
    pairs = [("Compares the signals of the gene of interest without dividing by the control gene, which includes the change in the amount of RNA loaded.", x1 / x0), ("Divides the untreated normalized value by the treated normalized value.", 1 / val),
             ("Subtracts the normalized values instead of dividing them.", x1 / h1 - x0 / h0), ("Divides the signal of the control gene in the treated sample by the signal in the untreated sample.", h1 / h0)]
    key, ds = val_opts(val, pairs, lambda v: f"{hu(v, 1)}", gap=0.1, rel=0.06)
    stim = tbl("Relative amounts of mRNA detected in liver cells", ["Gene", "Without the hormone", "With the hormone"], [["Gene of interest", f"{x0}", f"{x1:.0f}"], ["Control gene (expressed at a constant level per cell)", f"{h0}", f"{h1:.0f}"]])
    stem = "A researcher measured the relative amount of mRNA for a gene of interest and for a control gene in liver cells with and without a hormone. The amount of RNA that was loaded differed between the two samples. The control gene is expressed at a constant level in every cell. By what factor did the hormone change the expression of the gene of interest per cell?"
    kw = f"Each value is divided by the control gene signal of the same sample to correct for the different amount of RNA: {x0}/{h0} = {x0 / h0:.2f} without the hormone and {x1:.0f}/{h1:.0f} = {x1 / h1:.2f} with the hormone. The expression increased by {x1 / h1:.2f}/{x0 / h0:.2f} = {val:.1f} times."
    return mk("bi_y_expression_normalized", "6.6", "4.B", stem, key, ds, rng, concept="normalize mRNA signals to a control gene and describe the fold change", path="normalized ratios of each sample vs the generating fold change",
              thinking=_steps("Divide the signal of the gene of interest by the control gene signal in each sample", "Compare the normalized values with and without the hormone", "Express the comparison as a factor of increase"), stim=stim, est=110, facts=[f"fold={f1}"], kwhy=kw, judgment="correct for a loading difference with a control gene before comparing")


# ---------------------------------------------------------------- 가설(3.B)
@_retry
def bi_y_null_recombinants(rng):
    N = pick(rng, [400, 480, 600, 800]); obs = int(N * pick(rng, [0.08, 0.1, 0.15, 0.2]))
    exp_rec = N // 2
    # 독립 경로: 네 부모형 칸 열거
    from itertools import product
    classes = list(product(["A", "a"], ["B", "b"]))
    rec = [c for c in classes if (c[0] == "A") != (c[1] == "B")]
    agree(len(rec) / 4 * N, exp_rec, 1e-12, "exp")
    key_t = f"If the genes assort independently, about {exp_rec} of the {N} offspring are expected to be Aabb or aaBb; the observed {obs} is far lower, so the data suggest that the genes are linked."
    wrong = [(f"If the genes assort independently, about {N // 4} of the {N} offspring are expected to be Aabb or aaBb; the observed {obs} is lower, so the data suggest that the genes are linked.", "Each of the four classes has one quarter of the offspring, so the two classes together make up one half, not one quarter."),
             (f"If the genes assort independently, about {exp_rec} of the {N} offspring are expected to be Aabb or aaBb; the observed {obs} is far lower, so the data show that the genes assort independently.", "A large deficit of these classes is not what independent assortment predicts, so the data do not support independent assortment."),
             (f"If the genes assort independently, about {N - exp_rec} of the {N} offspring are expected to be AaBb or aabb; the observed {obs} is far lower, so the data suggest that the genes are linked.", "The observed number refers to the Aabb and aaBb classes, and the AaBb and aabb classes make up the other half of the expected offspring.")]
    wrong = [w for w in wrong if w[0] != key_t]
    stem = (f"A student crosses a plant with the genotype AaBb with a plant with the genotype aabb and tests the hypothesis that genes A and B are on different chromosomes. Of {N} offspring, {obs} have the genotype Aabb or aaBb. "
            "Which statement states the expectation under the null hypothesis of independent assortment and interprets the result?")
    kw = f"Under independent assortment the four offspring classes (AaBb, Aabb, aaBb, aabb) are equally likely, so Aabb and aaBb together make up half of the offspring, or {exp_rec}. The observed {obs} is much lower than {exp_rec}."
    key, dd = sentence_options(key_t, kw, wrong)
    return mk("bi_y_null_recombinants", "5.4", "3.B", stem, key, dd, rng, concept="state the expected result under independent assortment and compare it with data", path="four-class enumeration vs the generating expectation N/2",
              thinking=_steps("List the four offspring classes of the testcross under independent assortment", "Find the expected number of the two classes named in the question", "Compare the expected and observed numbers and interpret the difference"), est=110, facts=[f"N={N}", f"obs={obs}"], kwhy=kw, judgment="use the null hypothesis to set an expected number before interpreting data")


@_retry
def bi_y_inhibitor_half(rng):
    concs = [0, 2, 4, 8, 16]
    r0 = pick(rng, [20.0, 25.0, 30.0, 40.0]); ic = pick(rng, [3.0, 5.0, 6.0, 10.0])
    rates = [round(r0 / (1 + c / ic), 1) for c in concs]
    half = r0 / 2
    i = next((k for k in range(4) if rates[k] > half >= rates[k + 1]), None)
    if i is None:
        raise ValueError("bracket")
    f = (rates[i] - half) / (rates[i] - rates[i + 1])
    est = concs[i] + f * (concs[i + 1] - concs[i])
    # 독립 경로: 촘촘한 격자에서 선형 보간 곡선이 처음 half 이하가 되는 농도
    xs = np.linspace(0, 16, 160001); ys = np.interp(xs, concs, rates)
    agree(xs[np.argmax(ys <= half)], est, 1e-3, "est")
    pairs = [("Uses the concentration with the rate closest to half of the rate without the inhibitor, with no interpolation.", float(min(concs, key=lambda c: abs(rates[concs.index(c)] - half)))), ("Uses the midpoint of the two concentrations on either side without interpolating.", (concs[i] + concs[i + 1]) / 2),
             ("Divides the highest concentration by two.", concs[-1] / 2), ("Uses the concentration at which the rate is half of the rate with the highest concentration of inhibitor.", float(concs[i + 1]) if concs[i + 1] != est else float(concs[i]))]
    key, ds = val_opts(est, pairs, lambda v: f"{hu(v, 1)} µM", gap=0.3, rel=0.05)
    stim = tbl("Rate of an enzyme-catalyzed reaction at different concentrations of an inhibitor", ["Inhibitor concentration (µM)", "Rate (µmol/min)"], [[c, f"{r_:.1f}"] for c, r_ in zip(concs, rates)])
    stem = "The table shows the rate of an enzyme-catalyzed reaction at several concentrations of an inhibitor. The rate with no inhibitor is the first value. Assume that the rate changes in a straight line between neighboring concentrations. Which concentration of the inhibitor is the best estimate of the concentration that reduces the rate by 50%?"
    kw = f"Half of the rate without inhibitor is {half:.1f} µmol/min. This lies between {concs[i]} µM ({rates[i]:.1f}) and {concs[i + 1]} µM ({rates[i + 1]:.1f}), {f:.2f} of the way between them, so the concentration is {concs[i]} + {f:.2f}({concs[i + 1]} - {concs[i]}) = {est:.1f} µM."
    return mk("bi_y_inhibitor_half", "3.2", "4.B", stem, key, ds, rng, concept="describe an inhibitor dose-response table by interpolating the 50% reduction", path="dense interpolation grid search vs linear interpolation between the bracketing points",
              thinking=_steps("Calculate half of the rate with no inhibitor", "Find the two concentrations whose rates are on either side of that value", "Interpolate between them to estimate the concentration"), stim=stim, est=110, facts=[f"est={est:.3f}"], kwhy=kw, judgment="interpolate in a data table to describe a 50% effect")


STAGE_J = ["bi_y_selection_partial", "bi_y_carrying_capacity_drop", "bi_y_potato_predict", "bi_y_exponential_predict", "bi_y_incomplete_dom_counts", "bi_y_light_halved_o2", "bi_y_hw_equilibrium_claim",
           "bi_y_logistic_graph_peak", "bi_y_phylo_distance_tree", "bi_y_enzyme_graph_slopes", "bi_y_rates_percent_greatest", "bi_y_expression_normalized", "bi_y_null_recombinants", "bi_y_inhibitor_half"]


# 유료 보강 2차(bio-v2b): Practice 5 밖의 exam_prep 14 + 1차에서 한 개도 통과하지 못한 2개(보강 후)
STAGE_V2B = STAGE_J + ["bi_x_pedigree_carrier_prob", "bi_x_sd_to_se_overlap"]
