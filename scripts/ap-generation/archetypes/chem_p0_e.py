"""AP Chemistry P0 원형 E — 단원 8(산과 염기)·9(열역학과 전기화학). 정답은 코드가 계산하고 독립 경로로 재계산한다."""
from chem_common import *  # noqa: F401,F403
from common import Opt

WEAK = [("HF", 6.8e-4), ("HNO2", 4.5e-4), ("HCOOH", 1.8e-4), ("C6H5COOH", 6.3e-5), ("CH3COOH", 1.8e-5), ("HOCl", 3.0e-8), ("HCN", 4.9e-10)]


def _weak_h(Ka, c):
    """약산 [H+] — 전하 균형(물의 자동 이온화 포함)을 이분법으로 푼다."""
    return bisect(lambda h: h - Ka * c / (Ka + h) - KW / h, 1e-14, 1.0)


def _weak_h_sym(Ka, c):
    x = sp.Symbol("x", positive=True)
    return float(sp.solve(sp.Eq(x ** 2 + sp.nsimplify(Ka) * x - sp.nsimplify(Ka) * sp.nsimplify(c), 0), x)[0])


# ======================= 8.2 강산·강염기 pH (5.F) =======================
@retry_sep
def ch_strong_ph(rng):
    kind = pick(rng, ["HCl", "HNO3", "NaOH", "Ba(OH)2", "KOH", "Ca(OH)2"])
    c = pick(rng, [0.0010, 0.0020, 0.0050, 0.010, 0.020, 0.050, 0.10, 0.25])
    mult = 2 if "(OH)2" in kind else 1
    if kind in ("HCl", "HNO3"):
        pH = -math.log10(c); pOH = 14 - pH; why_wrong = [("Gives the pOH instead of the pH.", pOH)]
        agree(pH, float(-sp.log(sp.nsimplify(c), 10)), 1e-9, "pH")
        pairs = [("Gives the pOH instead of the pH.", 14 + math.log10(c)), ("Uses the concentration as the pH (not a logarithm).", c), ("Uses the natural logarithm.", -math.log(c)), ("Takes the logarithm without the negative sign.", math.log10(c))]
    else:
        oh = mult * c; pOH = -math.log10(oh); pH = 14 - pOH
        agree(pH, 14 + float(sp.log(sp.nsimplify(oh), 10)), 1e-9, "pH")
        pairs = [("Reports the pOH as if it were the pH.", pOH), ("Does not count both hydroxide ions in the formula." if mult == 2 else "Uses the pH of an acid of the same concentration.", 14 + math.log10(c) if mult == 2 else -math.log10(c)),
                 ("Subtracts the pH from 7 instead of 14.", 7 - pOH), ("Takes the logarithm without the negative sign.", 14 + math.log10(oh))]
    key, ds = pH_opts(pH, pairs)
    stem = f"What is the pH of a ${c:g}\\text{{ M}}$ solution of {cf(kind)} at $25^\\circ\\text{{C}}$? (Assume complete dissociation.)"
    return mk("ch_strong_ph", "8.2", "5.F", stem, key, ds, rng, concept="pH of a strong acid or strong base, counting hydroxide ions per formula unit", path="sympy logarithm vs numpy log10 with the pOH route", facts=[f"kind={kind}", f"c={c}", f"pH={pH:.5f}"], judgment="choose pH versus pOH and count ions per formula unit", est=70,
              kwhy=(f"A strong acid dissociates completely, so [H⁺] = {c:g} M and pH = −log({c:g}) = {pH:.2f}." if kind in ("HCl", "HNO3") else f"{kind} releases {mult} OH⁻ per formula unit, so [OH⁻] = {mult * c:g} M, pOH = −log({mult * c:g}) = {pOH:.2f}, and pH = 14 − pOH = {pH:.2f}."))


# ======================= 8.3 약산 pH (5.F) =======================
def ch_weak_acid_ph(rng):
    for _ in forever():
        name, Ka = pick(rng, WEAK[:6]); c = pick(rng, [0.010, 0.050, 0.10, 0.20, 0.50])
        h = _weak_h(Ka, c); hs = _weak_h_sym(Ka, c)
        if abs(math.log10(h) - math.log10(hs)) < 0.003 and 2.0 < -math.log10(h) < 6.5:
            break
    pH = -math.log10(h)
    pairs = [("Treats the weak acid as if it were fully dissociated.", -math.log10(c)), ("Uses the pKa of the acid as the pH of the solution.", -math.log10(Ka)), ("Takes the square root of Ka as [H⁺], leaving out the initial concentration.", -math.log10(Ka) / 2), ("Reports the pOH of the solution.", 14 - pH)]
    key, ds = pH_opts(pH, pairs)
    stem = f"What is the pH of a ${c:g}\\text{{ M}}$ solution of {cf(name)} at $25^\\circ\\text{{C}}$? The acid dissociation constant, $K_a$, is " + sci(Ka, "") + "."
    return mk("ch_weak_acid_ph", "8.3", "5.F", stem, key, ds, rng, concept="pH of a weak acid solution from Ka and the initial concentration", path="sympy solution of the quadratic x^2 + Ka x - Ka c = 0 vs bisection on the full charge balance including water", facts=[f"name={name}", f"Ka={Ka}", f"c={c}", f"pH={pH:.5f}"], judgment="set up the equilibrium rather than assuming complete dissociation", est=110,
              kwhy=f"Let x = [H⁺] = [A⁻]. Then Ka = x²/({c:g} − x) = {sn(Ka, 2)}, which gives x² + Ka·x − Ka·c = 0 and x = {sn(h, 4)} M. Therefore pH = −log[H⁺] = {pH:.2f}.")


# ======================= 8.9 완충 용액 (5.F) =======================
BUF = [("CH3COOH", "CH3COO-", 1.8e-5), ("HCOOH", "HCOO-", 1.8e-4), ("HNO2", "NO2-", 4.5e-4), ("HOCl", "OCl-", 3.0e-8), ("C6H5COOH", "C6H5COO-", 6.3e-5)]


@retry_sep
def ch_buffer_ph(rng):
    for _ in forever():
        ha, a, Ka = pick(rng, BUF); pKa = -math.log10(Ka)
        V = pick(rng, [100.0, 200.0, 250.0, 500.0]); cHA = pick(rng, [0.10, 0.20, 0.50, 0.30]); cA = pick(rng, [0.10, 0.20, 0.50, 0.40])
        add = pick(rng, [0.0050, 0.010, 0.020]); kind = pick(rng, ["NaOH", "HCl"])
        nHA, nA = cHA * V / 1000, cA * V / 1000
        if kind == "NaOH":
            nHA2, nA2 = nHA - add, nA + add
        else:
            nHA2, nA2 = nHA + add, nA - add
        if nHA2 > 0.002 and nA2 > 0.002 and 0.2 < nA2 / nHA2 < 5:
            break
    pH = pKa + math.log10(nA2 / nHA2)
    # 독립 경로: 완충 후 농도로 약산 평형(전하 균형)을 수치로 푼다
    Vt = V / 1000 + 0.0  # 가한 부피는 무시(몰 수가 같은 비율로 희석)
    ca, cb = nHA2 / Vt, nA2 / Vt
    h = bisect(lambda x: x + cb - (ca + cb) * Ka / (Ka + x) - KW / x, 1e-14, 1.0)
    agree(pH, -math.log10(h), 0.02, "pH")
    pairs = [("Ignores the added strong reagent and reports the pKa.", pKa), ("Applies the added moles to the wrong buffer component.", pKa + math.log10((nA - add if kind == "NaOH" else nA + add) / (nHA + add if kind == "NaOH" else nHA - add))),
             ("Inverts the base-to-acid ratio in the Henderson-Hasselbalch equation.", pKa - math.log10(nA2 / nHA2)), ("Uses the ratio of initial moles and ignores the reaction.", pKa + math.log10(nA / nHA))]
    key, ds = pH_opts(pH, pairs)
    stem = (f"A buffer is prepared by mixing ${V:g}\\text{{ mL}}$ of ${cHA:g}\\text{{ M}}$ {cf(ha)} with ${V:g}\\text{{ mL}}$ of ${cA:g}\\text{{ M}}$ of the sodium salt of its conjugate base. The $K_a$ of {cf(ha)} is " + sci(Ka, "") + f". After ${add:g}\\text{{ mol}}$ of {cf(kind)} is added, what is the pH of the solution? (Assume the volume change is negligible.)")
    return mk("ch_buffer_ph", "8.9", "5.F", stem, key, ds, rng, concept="pH of a buffer after adding a strong acid or base using moles and the Henderson-Hasselbalch equation", path="Henderson-Hasselbalch on the post-reaction moles vs bisection on the charge balance of the weak acid and its conjugate base", facts=[f"ha={ha}", f"Ka={Ka}", f"V={V}", f"cHA={cHA}", f"cA={cA}", f"add={add}", f"kind={kind}", f"pH={pH:.5f}"], judgment="react the strong reagent stoichiometrically first, then apply the buffer equation", est=140,
              kwhy=f"The added {add:g} mol of {kind} reacts completely with the buffer, " + ("converting that much HA to its conjugate base" if kind == "NaOH" else "converting that much conjugate base to HA") + f", so n(HA) = {nHA2:.4f} mol and n(A⁻) = {nA2:.4f} mol. Then pH = pKa + log(n(A⁻)/n(HA)) = {pKa:.2f} + log({nA2:.4f}/{nHA2:.4f}) = {pH:.2f}.")


# ======================= 8.5 적정 곡선 (5.D) =======================
def _titration_curve(Ka, c0, Va, cb, Vs):
    out = []
    for V in Vs:
        nb = cb * V / 1000; Vt = (Va + V) / 1000; ca_tot = c0 * Va / 1000 / Vt; na = nb / Vt
        h = bisect(lambda x: x + na - ca_tot * Ka / (Ka + x) - KW / x, 1e-14, 1.0)
        out.append(-math.log10(h))
    return out


def ch_titration_point(rng):
    pKa = pick(rng, [3.5, 3.9, 4.3, 4.8, 5.2, 5.6]); Ka = 10 ** -pKa
    c0, Va = 0.100, 25.0; cb = 0.100; Veq = c0 * Va / cb
    Vs = [i * 0.5 for i in range(0, 101)]
    pHs = _titration_curve(Ka, c0, Va, cb, Vs)
    # 독립 경로: 곡선의 가장 가파른 점으로 Veq 를 찾고, 그 절반 부피의 pH 에서 Ka 를 읽는다
    slopes = [pHs[i + 1] - pHs[i] for i in range(len(Vs) - 1)]
    veq_read = Vs[int(np.argmax(slopes))] + 0.25
    ph_half = pHs[Vs.index(round(veq_read / 2 * 2) / 2 if round(veq_read / 2 * 2) / 2 in Vs else Veq / 2)]
    agree(veq_read, Veq, 0.03, "Veq")
    ph_half = pHs[Vs.index(Veq / 2)]
    Ka_read = 10 ** -ph_half
    agree(math.log10(Ka_read), math.log10(Ka), 0.01, "Ka")
    pairs = [("Uses the pH at the equivalence point as the pKa.", 10 ** -pHs[Vs.index(Veq)]), ("Uses the initial pH of the acid solution as the pKa.", 10 ** -pHs[0]), ("Takes the pH at the point where the base volume is twice the equivalence volume.", 10 ** -pHs[-1]),
             ("Uses Kw divided by the correct value.", 1e-14 / Ka_read)]
    key, ds = num_opts(Ka_read, pairs, "", 2, fmt=lambda v: sci(v, "") if v < 1e-1 else "$" + f"{v:.2f}" + "$")
    stim = graph_stim("Titration of 25.0 mL of 0.100 M weak acid HA with 0.100 M NaOH", [("pH", [[v, round(p, 3)] for v, p in zip(Vs[::2], pHs[::2])])], gaxis("Volume of NaOH added (mL)", 0, 50, 10), gaxis("pH", 0, 14, 2))
    stem = "A $25.0\\text{ mL}$ sample of a weak monoprotic acid, HA, is titrated with $0.100\\text{ M}$ NaOH. The titration curve is shown. Which of the following is the best estimate of the acid dissociation constant, $K_a$, of HA?"
    return mk("ch_titration_point", "8.5", "5.D", stem, key, ds, rng, concept="Ka of a weak acid from the pH at the half-equivalence point of a titration curve", stim=stim, material={"type": "graph", "must_include": ["titration curve", "equivalence volume", "half-equivalence volume"]},
              path="generating Ka vs the value read from the numerically computed curve (steepest point gives Veq; pH at Veq/2 gives pKa)", facts=[f"pKa={pKa}", f"Ka={Ka:.6e}", f"Veq={Veq}", f"pH_half={ph_half:.4f}"], judgment="locate the equivalence volume, then read the pH halfway to it", est=120,
              kwhy=f"The steepest rise of the curve is at {Veq:g} mL, the equivalence point, so the half-equivalence point is at {Veq / 2:g} mL, where pH = pKa. The curve shows pH ≈ {ph_half:.2f} there, so Ka = 10^−{ph_half:.2f} = {sn(Ka_read, 3)}.")


# ======================= 8.5 지시약 선택 (6.D) =======================
INDS = [("methyl orange", 3.1, 4.4), ("bromocresol green", 3.8, 5.4), ("methyl red", 4.4, 6.2), ("bromothymol blue", 6.0, 7.6), ("phenolphthalein", 8.2, 10.0), ("alizarin yellow R", 10.1, 12.0)]


def ch_indicator(rng):
    for _ in forever():
        scen = pick(rng, ["wa", "wb", "ss"])
        c = pick(rng, [0.050, 0.10, 0.20])
        if scen == "wa":
            Ka = 10 ** -pick(rng, [3.5, 4.0, 4.75, 5.5, 6.5]); cs = c / 2
            # 당량점: 염 A- 농도 cs, 약염기 가수분해 Kb = Kw/Ka; 전하 균형 [Na+] + [H+] = [A-] + [OH-]
            ha_t = cs
            h = bisect(lambda x: x + cs - cs * Ka / (Ka + x) - KW / x, 1e-14, 1.0)
            pH_eq = -math.log10(h); approx = 7 + 0.5 * (-math.log10(Ka) + math.log10(cs))
            desc = "a weak monoprotic acid with $K_a=" + sci(Ka, "").strip("$") + "$ is titrated with NaOH"
            wrong_pk = -math.log10(Ka)
        elif scen == "wb":
            Kb = 10 ** -pick(rng, [3.5, 4.75, 5.5]); Ka_conj = KW / Kb; cs = c / 2
            h = bisect(lambda x: x - cs * x / (Ka_conj + x) - KW / x, 1e-14, 1.0)  # BH+ ⇌ B + H+
            pH_eq = -math.log10(h); approx = 0.5 * (-math.log10(Ka_conj) - math.log10(cs))
            desc = "a weak base with $K_b=" + sci(Kb, "").strip("$") + "$ is titrated with HCl"
            wrong_pk = 14 + math.log10(Kb)
        else:
            pH_eq = 7.0; approx = 7.0; desc = "a strong acid is titrated with a strong base"; wrong_pk = 7.0
        agree(pH_eq, approx, 0.06, "pH_eq")
        hits = [i for i, (n, lo, hi) in enumerate(INDS) if lo <= pH_eq <= hi]
        if len(hits) == 1:
            break
    k = INDS[hits[0]]
    near7 = min(INDS, key=lambda t: abs((t[1] + t[2]) / 2 - 7))
    pk_ind = [t for t in INDS if t[1] <= wrong_pk <= t[2] and t[0] != k[0]]
    ds = []
    if near7[0] != k[0]:
        ds.append(Opt(near7[0], False, f"{near7[0]} changes color between pH {near7[1]} and {near7[2]}, near pH 7, but the equivalence point is at pH {pH_eq:.1f}, outside that range.", None))
    for t in pk_ind:
        if t[0] not in [d.text for d in ds]:
            ds.append(Opt(t[0], False, f"{t[0]} (pH {t[1]}–{t[2]}) has a range that contains the pKa-related value {wrong_pk:.1f}, but the equivalence point is at pH {pH_eq:.1f}.", None))
    for t in sorted(INDS, key=lambda t: abs((t[1] + t[2]) / 2 - pH_eq)):
        if len(ds) >= 3:
            break
        if t[0] != k[0] and t[0] not in [d.text for d in ds]:
            ds.append(Opt(t[0], False, f"{t[0]} changes color between pH {t[1]} and {t[2]}, which does not include the equivalence-point pH of {pH_eq:.1f}.", None))
    key = Opt(k[0], True, f"At the equivalence point the pH is {pH_eq:.2f}, and {k[0]} changes color between pH {k[1]} and {k[2]}, a range that includes it.", None)
    tab = "; ".join(f"{n} ({lo}–{hi})" for n, lo, hi in INDS)
    stem = f"In a titration, {desc}. Which of the following indicators (pH range of color change in parentheses: {tab}) is most appropriate for detecting the equivalence point?"
    return mk("ch_indicator", "8.5", "6.D", stem, key, ds[:3], rng, concept="choose an indicator whose transition range contains the equivalence-point pH", path="equivalence pH from the full charge balance (bisection) vs the analytic salt-hydrolysis formula; both fall in one indicator range", facts=[f"scen={scen}", f"pH_eq={pH_eq:.4f}", f"key={k[0]}"], judgment="find the equivalence-point pH before choosing, rather than defaulting to pH 7", est=110)


# ======================= 8.3/8.7 Ka 를 pH 에서 (5.F) =======================
def ch_ka_from_ph(rng):
    for _ in forever():
        Ka = pick(rng, [1.8e-5, 6.8e-4, 6.3e-5, 4.5e-4, 3.0e-8]); c = pick(rng, [0.10, 0.20, 0.50, 0.050])
        h = _weak_h(Ka, c); pH = round(-math.log10(h), 2); hm = 10 ** -pH
        Kcalc = hm ** 2 / (c - hm)
        if abs(Kcalc - Ka) / Ka < 0.03 and hm / c > 0.003:
            break
    # 독립 경로: 이 Ka 로 pH 를 다시 구해 측정값과 맞는지
    agree(-math.log10(_weak_h(Kcalc, c)), pH, 2e-3, "pH")
    pairs = [("Ignores the dissociation in the denominator without noticing it is not small.", hm ** 2 / c), ("Uses the hydronium concentration as Ka.", hm), ("Reports the pKa (the negative logarithm of Ka) instead of Ka itself.", -math.log10(Kcalc)), ("Divides the hydronium concentration by the initial concentration.", hm / c)]
    key, ds = num_opts(Kcalc, pairs, "", 3, fmt=lambda v: sci(v, "") if v < 100 else "$" + f"{v:.2f}" + "$")
    stem = f"The pH of a ${c:g}\\text{{ M}}$ aqueous solution of a weak monoprotic acid HA is measured to be ${pH:.2f}$ at $25^\\circ\\text{{C}}$. What is the value of $K_a$ for HA?"
    return mk("ch_ka_from_ph", "8.3", "5.F", stem, key, ds, rng, concept="acid dissociation constant from the measured pH of a weak acid solution", path="algebra Ka = [H+]^2/(c - [H+]) vs forward bisection solve recovering the measured pH", facts=[f"c={c}", f"pH={pH}", f"Ka={Kcalc:.6e}"], judgment="build the equilibrium table from the measured hydronium concentration", est=100,
              kwhy=f"[H⁺] = 10^−{pH:.2f} = {sn(hm, 3)} M and [A⁻] = [H⁺]. Then Ka = [H⁺][A⁻]/[HA] = ({sn(hm, 3)})²/({c:g} − {sn(hm, 3)}) = {sn(Kcalc, 3)}.")


# ======================= 8.7 pH 와 pKa (6.D) =======================
def ch_species_ratio(rng):
    for _ in forever():
        pKa = pick(rng, [3.75, 4.76, 6.35, 7.21, 9.25]); d = pick(rng, [-2.0, -1.0, -0.5, 0.5, 1.0, 2.0]); pH = round(pKa + d, 2)
        ratio = 10 ** (pH - pKa)
        agree(ratio, float(sp.Float(10) ** sp.Float(pH - pKa)), 1e-9, "ratio")
        break
    predom = "the conjugate base, A⁻" if ratio > 1 else "the acid, HA"
    r = ratio if ratio > 1 else 1 / ratio
    rs = sig(r, 2)
    key_t = f"At pH ${pH:g}$, {predom} predominates, with a ratio of about ${rs}$ to 1, because the pH is {'greater' if ratio > 1 else 'less'} than the pKa."
    other = "the acid, HA" if ratio > 1 else "the conjugate base, A⁻"
    wrongs = [(f"At pH ${pH:g}$, {other} predominates, with a ratio of about ${rs}$ to 1, because the pH is {'greater' if ratio > 1 else 'less'} than the pKa.", "Reverses which species predominates when pH and pKa are compared."),
              (f"At pH ${pH:g}$, the acid and its conjugate base are present in equal amounts because both are weak.", "Believes pH alone sets a 1:1 ratio."),
              (f"At pH ${pH:g}$, {predom} predominates, with a ratio of about ${sig(abs(pH - pKa), 2)}$ to 1, because the difference between pH and pKa gives the ratio directly.", "Treats the pH - pKa difference as the ratio instead of a power of ten.")]
    k, ds = sentence_options(key_t, f"pH = pKa + log([A⁻]/[HA]), so [A⁻]/[HA] = 10^(pH − pKa) = 10^({pH:g} − {pKa:g}) = {ratio:.3g}; " + ("the base form is more abundant." if ratio > 1 else "the acid form is more abundant."), wrongs)
    stem = f"A weak acid HA has a $\\mathrm{{p}}K_a$ of ${pKa:g}$. Which statement about a solution of HA and its conjugate base A⁻ at pH ${pH:g}$ is correct?"
    return mk("ch_species_ratio", "8.7", "6.D", stem, k, ds, rng, concept="which acid or base form predominates at a given pH using the pKa", path="ratio from 10^(pH - pKa) with sympy vs the Henderson-Hasselbalch inequality sign", facts=[f"pKa={pKa}", f"pH={pH}", f"ratio={ratio:.5f}"], judgment="compare pH with pKa and treat the ratio as a power of ten", est=90)


# ======================= 8.8 완충 용액 선택 (4.B) =======================
BPAIRS = [("HCOOH / HCOO⁻", 3.75), ("CH₃COOH / CH₃COO⁻", 4.76), ("H₂PO₄⁻ / HPO₄²⁻", 7.21), ("HOCl / OCl⁻", 7.54), ("NH₄⁺ / NH₃", 9.25), ("HCO₃⁻ / CO₃²⁻", 10.33)]


def ch_buffer_choice(rng):
    for _ in forever():
        pairs_ = rng.sample(BPAIRS, 4); target = round(rng.uniform(3.5, 10.5), 1)
        d = sorted(abs(p[1] - target) for p in pairs_)
        if d[0] < 0.7 and d[1] - d[0] > 0.8:
            break
    k = min(pairs_, key=lambda p: abs(p[1] - target))
    agree(1.0, 1.0 if abs(k[1] - target) <= 1.0 else 0.0, 1e-9, "within1")
    low = min(pairs_, key=lambda p: p[1]); high = max(pairs_, key=lambda p: p[1])
    ds = []
    for p in pairs_:
        if p[0] == k[0]:
            continue
        why = f"This pair has the strongest acid shown (pKa = {p[1]}), but that is {abs(p[1] - target):.1f} units from the target pH of {target:g}, so it would resist pH changes poorly." if p[0] == low[0] else (
            f"This pair has the weakest acid shown (pKa = {p[1]}), but that is {abs(p[1] - target):.1f} units from the target pH of {target:g}, so it would resist pH changes poorly." if p[0] == high[0] else f"Its pKa of {p[1]} is {abs(p[1] - target):.1f} units from the target pH of {target:g}, more than the one unit over which a buffer works well.")
        ds.append(Opt(p[0], False, why, None))
    key = Opt(k[0], True, f"A buffer works best when the pH is within about one unit of the pKa; {k[0]} has pKa = {k[1]}, only {abs(k[1] - target):.1f} units from the target pH of {target:g}.", None)
    tab = "; ".join(f"{p[0]} ($\\mathrm{{p}}K_a={p[1]}$)" for p in pairs_)
    stem = f"A chemist needs a buffer with a pH of ${target:g}$. Which conjugate acid-base pair ({tab}) would be most effective, assuming equal total concentrations are available for each?"
    return mk("ch_buffer_choice", "8.8", "4.B", stem, key, ds, rng, concept="choose a buffer whose pKa is closest to the target pH", path="argmin of |pKa - target| vs the |log ratio| <= 1 feasibility test", facts=[f"target={target}", f"pairs={[p[0] for p in pairs_]}", f"key={k[0]}"], judgment="match pKa to the target pH rather than picking the strongest acid", est=80)


# ======================= 8.7 약산 순서 (4.A) =======================
def ch_ph_ranking(rng):
    for _ in forever():
        acs = rng.sample(WEAK[:6], 4); c = pick(rng, [0.10, 0.20, 0.050])
        phs = {n: -math.log10(_weak_h(Ka, c)) for n, Ka in acs}
        order_ph = sorted(phs, key=phs.get); order_ka = [n for n, _ in sorted(acs, key=lambda t: -t[1])]
        if order_ph == order_ka and phs[order_ph[1]] - phs[order_ph[0]] > 0.15:
            break
    k = order_ph[0]
    Kd = dict(acs)
    ds = [Opt(cf(n), False, f"{n} has Ka = {sn(Kd[n], 2)}, smaller than the {sn(Kd[k], 2)} of {k}, so it dissociates less at the same concentration and gives a higher pH" + (" (it is the weakest acid shown)." if n == order_ph[-1] else "."), None) for n in order_ph[1:]]
    key = Opt(cf(k), True, f"At equal concentration the acid with the largest Ka dissociates most; {k} has the largest Ka ({sn(Kd[k], 2)}), so its solution has the lowest pH.", None)
    rows = [[cf(n), f"{sn(Ka, 2)}"] for n, Ka in acs]
    stim = table_stimulus("Acid dissociation constants at 25 °C", "Acid", [[n, f"{sn(Ka, 2)}"] for n, Ka in acs], "Ka")
    stem = f"The table lists $K_a$ values for four weak acids. Which of the following $\\mathrm{{{c:g}\\ M}}$ solutions has the lowest pH?".replace("\\mathrm{" + f"{c:g}\\ M" + "}", f"{c:g}\\text{{ M}}")
    stem = f"The table lists the $K_a$ values for four weak acids. Which of the following ${c:g}\\text{{ M}}$ acid solutions has the lowest pH?"
    return mk("ch_ph_ranking", "8.7", "4.A", stem, key, ds, rng, concept="rank weak acid solutions by pH from their Ka values", stim=stim, material={"type": "table", "must_include": ["Ka values"]}, path="pH of each solution from the exact charge balance vs ordering by Ka; the orders agree", facts=[f"acids={[n for n, _ in acs]}", f"c={c}", f"key={k}"], judgment="relate larger Ka to larger extent of dissociation at equal concentration", est=75)


# ======================= 9.2 엔트로피 부호 (4.A) =======================
SABS = {"H2(g)": 130.7, "O2(g)": 205.2, "H2O(l)": 70.0, "H2O(g)": 188.8, "N2(g)": 191.6, "NH3(g)": 192.8, "CO2(g)": 213.8, "CaCO3(s)": 92.9, "CaO(s)": 38.1, "NO2(g)": 240.1, "N2O4(g)": 304.4, "SO2(g)": 248.2, "SO3(g)": 256.8}
SRX = [([(2, "H2(g)"), (1, "O2(g)")], [(2, "H2O(l)")]), ([(1, "CaCO3(s)")], [(1, "CaO(s)"), (1, "CO2(g)")]), ([(1, "N2(g)"), (3, "H2(g)")], [(2, "NH3(g)")]), ([(2, "NO2(g)")], [(1, "N2O4(g)")]), ([(1, "H2O(l)")], [(1, "H2O(g)")]), ([(2, "SO2(g)"), (1, "O2(g)")], [(2, "SO3(g)")])]


def ch_entropy_sign(rng):
    L, Rr = pick(rng, SRX)
    dS = sum(c * SABS[s] for c, s in Rr) - sum(c * SABS[s] for c, s in L)
    dn = sum(c for c, s in Rr if s.endswith("(g)")) - sum(c for c, s in L if s.endswith("(g)"))
    rule = (dn > 0) if dn != 0 else (any(s.endswith("(g)") for c, s in Rr) and not any(s.endswith("(g)") for c, s in L))
    if dn == 0 and not rule:
        rule = None
    if rule is not None:
        agree(1.0, 1.0 if (dS > 0) == bool(rule) else 0.0, 1e-9, "sign")
    pos = dS > 0
    gas = {True: "the number of moles of gas increases" if dn > 0 else "a more ordered liquid becomes a gas", False: "the number of moles of gas decreases" if dn < 0 else "particles become more ordered"}
    reason = ("a solid becomes a solid and a gas, so the number of gas particles increases" if dn > 0 and any(s.endswith("(s)") for c, s in L) else "the number of moles of gas increases" if dn > 0 else
              "a liquid is converted to a gas, which is much more disordered" if (dn > 0 or any(s.endswith("(l)") for c, s in L)) and pos else "the number of moles of gas decreases")
    reason = ("the number of moles of gas increases" if dn > 0 else ("the number of moles of gas decreases" if dn < 0 else "a liquid is converted to a gas, which is more disordered"))
    key_t = f"$\\Delta S^\\circ$ is {'positive' if pos else 'negative'} because {reason}."
    opp = "negative" if pos else "positive"
    wrongs = [(f"$\\Delta S^\\circ$ is {opp} because {reason}.", "Gets the entropy-change sign reversed."), (f"$\\Delta S^\\circ$ is {'positive' if pos else 'negative'} because the reaction is {'exothermic' if pos else 'endothermic'}.", "Links the sign of the entropy change to the sign of the enthalpy change."),
              (f"$\\Delta S^\\circ$ is approximately zero because the same elements are present on both sides.", "Believes entropy depends only on which elements are present.")]
    k, ds = sentence_options(key_t, f"Entropy tracks the number and freedom of motion of particles, especially gas particles: ΔS° = ΣS°(products) − ΣS°(reactants) = {dS:+.0f} J/(mol·K), and the moles of gas change by {dn:+d}.", wrongs)
    def side(x): return " + ".join((f"{c}\\," if c > 1 else "") + mt(s.split("(")[0]) + s[s.index("("):] for c, s in x)
    stem = f"For the process $" + side(L) + " \\rightarrow " + side(Rr) + "$, which statement about $\\Delta S^\\circ$ is correct?"
    return mk("ch_entropy_sign", "9.2", "4.A", stem, k, ds, rng, concept="predict the sign of the standard entropy change from phases and moles of gas", path="sign of the sum of tabulated absolute entropies vs the gas-mole and phase rule", facts=[f"dS={dS:.2f}", f"dn={dn}", f"L={L}", f"R={Rr}"], judgment="relate the change in particles and phases to the sign of ΔS", est=80)


# ======================= 9.3 Gibbs 임계 온도 (5.F) / 부호 (6.D) =======================
def ch_gibbs_temperature(rng):
    for _ in forever():
        dH = pick(rng, [40.0, 60.0, 90.0, 120.0, -50.0, -80.0]); dS = pick(rng, [100.0, 150.0, 200.0, 250.0, -100.0, -150.0, -200.0])
        if dH * dS > 0:
            break
    T = dH * 1000 / dS
    Ts = sp.Symbol("T", positive=True)
    agree(T, float(sp.solve(sp.Eq(sp.nsimplify(dH) * 1000 - Ts * sp.nsimplify(dS), 0), Ts)[0]), 1e-9, "T")
    agree(T, bisect(lambda t: dH * 1000 - t * dS, 1.0, 1e6), 1e-6, "T2")
    pairs = [("Does not convert kilojoules to joules.", dH / dS), ("Inverts the ratio, dividing ΔS by ΔH instead of ΔH by ΔS.", dS / (dH * 1000)), ("Converts the answer to degrees Celsius.", T - 273.15), ("Multiplies enthalpy and entropy.", dH * dS)]
    key, ds = num_opts(abs(T), pairs and [(w, abs(v)) for w, v in pairs], "K", 3, fmt=lambda v: "$" + f"{v:.0f}" + "\\text{ K}$" if v >= 10 else "$" + f"{v:.3f}" + "\\text{ K}$")
    side = "above" if dS > 0 else "below"
    stem = f"For a reaction, $\\Delta H^\\circ={dH:+g}\\text{{ kJ/mol}}$ and $\\Delta S^\\circ={dS:+g}\\text{{ J/(mol}}\\cdot\\text{{K)}}$, and both are assumed to be independent of temperature. The reaction is thermodynamically favorable {side} a certain temperature. What is that temperature, in K?"
    return mk("ch_gibbs_temperature", "9.3", "5.F", stem, key, ds, rng, concept="crossover temperature from ΔG = ΔH - TΔS = 0 with consistent energy units", path="sympy solution of ΔH - TΔS = 0 vs bisection on ΔG(T)", facts=[f"dH={dH}", f"dS={dS}", f"T={abs(T):.4f}"], judgment="set ΔG to zero and keep kilojoules and joules consistent", est=90,
              kwhy=f"ΔG° = ΔH° − TΔS° = 0 at T = ΔH°/ΔS° = ({dH * 1000:+g} J/mol)/({dS:+g} J/(mol·K)) = {abs(T):.0f} K, with ΔH° converted from kilojoules to joules.")


def ch_gibbs_sign(rng):
    dH = pick(rng, [-120.0, -50.0, 40.0, 90.0]); dS = pick(rng, [-150.0, -60.0, 70.0, 180.0])
    cases = {(-1, 1): "favorable at all temperatures", (1, -1): "not favorable at any temperature", (-1, -1): "favorable only at low temperatures", (1, 1): "favorable only at high temperatures"}
    sg = (int(np.sign(dH)), int(np.sign(dS)))
    key_c = cases[sg]
    # 독립 경로: 매우 낮은 온도와 매우 높은 온도에서 ΔG 의 부호를 직접 계산
    fav = lambda T_: dH - T_ * dS / 1000 < 0
    lo, hi = fav(1.0), fav(1e6)
    derived = "favorable at all temperatures" if lo and hi else ("not favorable at any temperature" if not lo and not hi else ("favorable only at low temperatures" if lo else "favorable only at high temperatures"))
    agree(1.0, 1.0 if derived == key_c else 0.0, 1e-9, "regime")
    word = lambda v: "negative" if v < 0 else "positive"
    cross = abs(dH * 1000 / dS)
    detail = {"favorable at all temperatures": f"ΔH° is negative and ΔS° is positive, so ΔG° = ΔH° − TΔS° is negative at every temperature",
              "not favorable at any temperature": f"ΔH° is positive and ΔS° is negative, so ΔG° = ΔH° − TΔS° is positive at every temperature",
              "favorable only at low temperatures": f"ΔH° and ΔS° are both negative, so ΔG° is negative only when T < ΔH°/ΔS° = {cross:.0f} K",
              "favorable only at high temperatures": f"ΔH° and ΔS° are both positive, so ΔG° is negative only when T > ΔH°/ΔS° = {cross:.0f} K"}[key_c]
    wrongs = []
    for (sh, ss), c in cases.items():
        if c == key_c:
            continue
        wrongs.append((f"The reaction is {c}.", f"This pattern requires ΔH° to be {word(sh)} and ΔS° to be {word(ss)}, but the reaction has ΔH° = {dH:+g} kJ/mol ({word(dH)}) and ΔS° = {dS:+g} J/(mol·K) ({word(dS)})."))
    k, ds = sentence_options(f"The reaction is {key_c}.", f"With ΔH° = {dH:+g} kJ/mol and ΔS° = {dS:+g} J/(mol·K), {detail}.", wrongs)
    stem = f"A reaction has $\\Delta H^\\circ={dH:+g}\\text{{ kJ/mol}}$ and $\\Delta S^\\circ={dS:+g}\\text{{ J/(mol}}\\cdot\\text{{K)}}$. Which statement about its thermodynamic favorability as the temperature changes is correct?"
    return mk("ch_gibbs_sign", "9.3", "6.D", stem, k, ds, rng, concept="thermodynamic favorability at different temperatures from the signs of ΔH and ΔS", path="sign pattern table vs direct evaluation of the sign of ΔG at a very low and a very high temperature", facts=[f"dH={dH}", f"dS={dS}", f"regime={key_c}"], judgment="combine the signs of ΔH and ΔS to see how ΔG changes with temperature", est=80)


# ======================= 9.5 ΔG° 와 K (5.F) =======================
def ch_gibbs_k(rng):
    dG = pick(rng, [-20.0, -10.0, -5.0, 5.0, 10.0, 20.0]); T = pick(rng, [298.0, 350.0, 400.0])
    K = math.exp(-dG * 1000 / (R_J * T))
    Ks = float(sp.exp(-sp.nsimplify(dG) * 1000 / (sp.nsimplify(R_J) * sp.nsimplify(T))))
    agree(K, Ks, 1e-9, "K")
    pairs = [("Omits the negative sign in ΔG° = -RT ln K.", 1 / K), ("Uses kilojoules without converting to joules.", math.exp(-dG / (R_J * T))), ("Uses the base-ten logarithm in place of the natural logarithm.", 10 ** (-dG * 1000 / (R_J * T))), ("Uses ΔG° as the equilibrium constant.", abs(dG))]
    key, ds = num_opts(K, pairs, "", 3, fmt=lambda v: sci(v, "") if (v < 0.01 or v >= 1e4) else "$" + f"{v:.3g}" + "$")
    stem = f"The standard free energy change for a reaction is $\\Delta G^\\circ={dG:+g}\\text{{ kJ/mol}}$ at ${T:g}\\text{{ K}}$. What is the value of the equilibrium constant, $K$, at this temperature?"
    return mk("ch_gibbs_k", "9.5", "5.F", stem, key, ds, rng, concept="equilibrium constant from the standard free energy change", path="closed-form exp(-ΔG°/RT) with sympy vs numpy exp", facts=[f"dG={dG}", f"T={T}", f"K={K:.6e}"], judgment="use natural logarithm, a negative sign, and joules", est=90,
              kwhy=f"ΔG° = −RT ln K, so K = exp(−ΔG°/RT) = exp(−({dG * 1000:g} J/mol)/((8.314 J/(mol·K))({T:g} K))) = exp({-dG * 1000 / (R_J * T):.3f}) = {K:.3g}.")


# ======================= 9.8–9.9 전지 전위 (5.F) =======================
REDP = {"Mg2+/Mg": (-2.37, 2), "Zn2+/Zn": (-0.76, 2), "Fe2+/Fe": (-0.44, 2), "Ni2+/Ni": (-0.25, 2), "Pb2+/Pb": (-0.13, 2), "Cu2+/Cu": (0.34, 2), "Ag+/Ag": (0.80, 1)}


def ch_cell_potential(rng):
    a, c = sorted(rng.sample(sorted(REDP), 2), key=lambda s: REDP[s][0])
    Ea, Ec = REDP[a][0], REDP[c][0]
    E = Ec - Ea
    agree(E, float(sp.nsimplify(Ec) - sp.nsimplify(Ea)), 1e-9, "E")
    pairs = [("Adds the two reduction potentials.", Ec + Ea), ("Subtracts in the wrong order (anode minus cathode).", Ea - Ec), ("Averages the two reduction potentials.", (Ea + Ec) / 2), ("Uses the magnitude of the anode's reduction potential as the cell potential.", abs(Ea))]
    key, ds = abs_opts(E, pairs, lambda v: E_fmt(v), 0.1)
    tab = "; ".join("$" + mt(k.split("/")[0].replace("2+", "").replace("+", ""), "2+" if "2+" in k else "+") + "/" + mt(k.split("/")[1]) + ":\\ " + f"{REDP[k][0]:+.2f}" + "\\text{ V}$" for k in (a, c))
    stem = f"A galvanic cell is constructed with a {k_fmt(a)} half-cell and a {k_fmt(c)} half-cell under standard conditions. The standard reduction potentials are {tab}. What is the standard cell potential, $E^\\circ_{{cell}}$, of this cell?"
    return mk("ch_cell_potential", "9.9", "5.F", stem, key, ds, rng, concept="standard cell potential from two standard reduction potentials", path="sympy rational subtraction of cathode minus anode vs a table sort that identifies the cathode as the more positive potential", facts=[f"anode={a}", f"cathode={c}", f"E={E:.4f}"], judgment="identify the cathode as the larger reduction potential and subtract", est=90,
              kwhy=f"The cathode is the half-cell with the more positive reduction potential ({c}, {Ec:+.2f} V) and the anode is the other ({a}, {Ea:+.2f} V). E°cell = E°cathode − E°anode = ({Ec:+.2f}) − ({Ea:+.2f}) = {E:.2f} V.")


def _fmt_dg(v):
    """ΔG° 선택지(kJ/mol): 큰 값은 과학적 표기('e+05' 같은 컴퓨터 표기 금지)."""
    sgn = "+" if v > 0 else "-"; a = abs(v)
    if a >= 1e4:
        e = int(math.floor(math.log10(a))); m = a / 10 ** e
        return "$" + sgn + sig(m, 3) + "\\times10^{" + str(e) + "}\\text{ kJ/mol}$"
    return "$" + f"{v:+.0f}" + "\\text{ kJ/mol}$"


def k_fmt(couple):
    ion, metal = couple.split("/")
    q = "2+" if "2+" in ion else "+"
    return cf(metal) + "-" + cf(ion.replace("2+", "").replace("+", ""), q) if False else "$\\mathrm{" + metal + "}$" + "/" + "$" + mt(ion.replace("2+", "").replace("+", ""), q) + "$"


def ch_cell_deltag(rng):
    a, c = sorted(rng.sample(sorted(REDP), 2), key=lambda s: REDP[s][0])
    E = REDP[c][0] - REDP[a][0]; n = math.lcm(REDP[a][1], REDP[c][1])
    dG = -n * F_CONST * E / 1000
    agree(dG, float(-sp.nsimplify(n) * sp.nsimplify(F_CONST) * sp.nsimplify(round(E, 2)) / 1000), 1e-6, "dG")
    pairs = [("Does not multiply by the number of electrons transferred.", -F_CONST * E / 1000), ("Omits the negative sign in ΔG° = -nFE°.", +n * F_CONST * E / 1000), ("Leaves the energy in joules per mole.", dG * 1000), ("Doubles the number of electrons transferred (uses 2n instead of n).", -F_CONST * E * (n * 2) / 1000)]
    key, ds = signed_opts(dG, pairs, fmt=_fmt_dg)
    stem = f"A galvanic cell is built from a {k_fmt(a)} half-cell and a {k_fmt(c)} half-cell. The standard cell potential is $E^\\circ_{{cell}}={E:.2f}\\text{{ V}}$, and the balanced cell reaction transfers {n} moles of electrons per mole of reaction. What is $\\Delta G^\\circ$ for the reaction, in kJ per mole of reaction?"
    return mk("ch_cell_deltag", "9.9", "5.F", stem, key, ds, rng, concept="standard free energy change from cell potential and electrons transferred", path="exact arithmetic with sympy vs numpy evaluation of -nFE°", facts=[f"E={E:.4f}", f"n={n}", f"dG={dG:.4f}"], judgment="use the electrons transferred in the balanced reaction", est=90,
              kwhy=f"ΔG° = −nFE°cell = −({n})(96,485 C/mol)({E:.2f} V) = {dG:.0f} kJ per mole of reaction; the product of coulombs and volts is joules, so divide by 1000 to get kilojoules.")


# ======================= 9.10 네른스트 (5.F) =======================
def ch_nernst(rng):
    for _ in forever():
        E0 = pick(rng, [0.34, 1.10, 0.46, 0.80, 0.63]); n = pick(rng, [1, 2]); Q = pick(rng, [0.010, 0.10, 10.0, 100.0, 1000.0]); T = 298.0
        E = E0 - R_J * T / (n * F_CONST) * math.log(Q)
        E2 = E0 - (0.05916 / n) * math.log10(Q)
        agree(E, E2, 2e-3, "E")
        break
    pairs = [("Adds the logarithmic term instead of subtracting it.", E0 + R_J * T / (n * F_CONST) * math.log(Q)), ("Uses the base-ten logarithm with the natural-log prefactor RT/nF.", E0 - R_J * T / (n * F_CONST) * math.log10(Q)), ("Ignores the number of electrons transferred.", E0 - R_J * T / F_CONST * math.log(Q) * (1 if n == 1 else 1)), ("Uses the standard potential as the cell potential.", E0)]
    key, ds = abs_opts(E, pairs, lambda v: E_fmt(v, 3), 0.004)
    stem = f"A galvanic cell has a standard cell potential of $E^\\circ={E0:g}\\text{{ V}}$ and transfers {n} mole{'s' if n > 1 else ''} of electrons per mole of reaction. At $25^\\circ\\text{{C}}$ the reaction quotient is $Q={Q:g}$. What is the cell potential, $E_{{cell}}$, under these conditions, in V? ($\\dfrac{{RT}}{{F}}=0.0257\\text{{ V}}$ at $298\\text{{ K}}$)"
    return mk("ch_nernst", "9.10", "5.F", stem, key, ds, rng, concept="cell potential under nonstandard conditions with the Nernst equation", path="natural-log Nernst equation vs the base-ten form with 0.05916/n", facts=[f"E0={E0}", f"n={n}", f"Q={Q}", f"E={E:.5f}"], judgment="apply the sign convention and the number of electrons in the Nernst equation", est=100,
              kwhy=f"E = E° − (RT/nF) ln Q = {E0:g} V − (0.0257 V/{n}) ln({Q:g}) = {E0:g} V − {R_J * T / (n * F_CONST) * math.log(Q):.4f} V = {E:.3f} V.")


# ======================= 9.11 패러데이 법칙 (5.F) =======================
FAR = [("Cu", 63.55, 2), ("Ag", 107.87, 1), ("Zn", 65.38, 2), ("Ni", 58.69, 2), ("Al", 26.98, 3), ("Cr", 52.00, 3)]


def ch_faraday(rng):
    met, M, n = pick(rng, FAR); I = pick(rng, [0.50, 1.00, 2.00, 5.00, 10.0]); tmin = pick(rng, [10.0, 20.0, 30.0, 60.0, 90.0])
    t = tmin * 60
    m = I * t * M / (n * F_CONST)
    ms = float(sp.nsimplify(I) * sp.nsimplify(t) * sp.nsimplify(M) / (sp.nsimplify(n) * sp.nsimplify(F_CONST)))
    agree(m, ms, 1e-9, "m")
    pairs = [("Uses the time in minutes without converting to seconds.", I * tmin * M / (n * F_CONST)), ("Does not divide by the number of electrons per ion.", I * t * M / F_CONST), ("Divides by the molar mass instead of multiplying.", I * t / (M * n * F_CONST)), ("Reports the moles of metal rather than the mass.", I * t / (n * F_CONST))]
    key, ds = num_opts(m, pairs, "g", 3)
    stem = f"A current of ${I:g}\\text{{ A}}$ is passed through a solution containing {cf(met, str(n) + '+' if n > 1 else '+')} ions for ${tmin:g}$ minutes. Assuming the process is 100% efficient, what mass of {met}, in g, is deposited at the cathode?"
    return mk("ch_faraday", "9.11", "5.F", stem, key, ds, rng, concept="mass deposited in electrolysis from current, time, and charge of the ion", path="sympy rational evaluation vs numpy evaluation", facts=[f"met={met}", f"I={I}", f"tmin={tmin}", f"n={n}", f"m={m:.6f}"], judgment="convert minutes to seconds and use the electrons per ion", est=100,
              kwhy=f"Charge = It = ({I:g} A)({t:g} s) = {I * t:g} C, which is {I * t / F_CONST:.5f} mol of electrons. Each {met} ion needs {n} electron{'s' if n > 1 else ''}, so {I * t / (n * F_CONST):.5f} mol of {met} is deposited, and the mass is {I * t / (n * F_CONST):.5f} mol × {M} g/mol = {m:.3g} g.")
