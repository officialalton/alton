"""AP Chemistry 원형 — CH5 단원 7 단독 2칸 대체(2026-10-22): 공개 Exam 3 의 'K 를 평형 농도로 계산' 과 같은 풀이였던 Q 값 계산(chem-t5-mc2:m21-k2)을 대체한다.
둘 다 K/Q 식을 그대로 평가하지 않는다.
- 부피 변화 뒤 Q 와 K 의 크기 비교(7.10, 5.F): 평형 농도가 주어진 기체 반응에서 부피를 바꾸면 모든 농도가 같은 배율로 바뀌고, 기체 몰수가 다른 쪽에 따라 Q 가 K 의 배수가 된다 → 이동 방향 판단(공개 문항은 Q 식 계산·K 계산·정성적 르 샤틀리에 진술).
- 아주 작은 K 에서 평형 농도 근사(7.7, 5.F): x 가 초기 농도보다 훨씬 작다는 근사로 제곱근 식을 세우고 근사의 타당성을 확인한다(공개 문항은 ICE 표를 K 계산 방향으로만 쓴다).
오답은 이름 붙은 오개념이고, 수치는 코드가 두 경로로 검산한다(agree)."""
import math
from chem_common import *  # noqa: F401,F403


def _sci(v, d=1):
    """소수점 지수 표기 1.4×10⁻⁴ (원문 TeX 노출을 피하려고 유니코드 위첨자를 쓴다)."""
    m, e = f"{v:.{d}e}".split("e"); e = int(e)
    sup = str(abs(e)).translate(str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹"))
    return f"{m}×10{'⁻' if e < 0 else ''}{sup}"


# ============================ 7.10 부피 변화 뒤 Q vs K (5.F) ============================
def ch_t5m_q_after_volume_change(rng):
    # 공개 Exam 1·2·4 에 이미 있는 2A(g) ⇌ B(g) 의 정성 진술 문항과 겹치지 않도록 그 반응은 쓰지 않는다.
    v = pick(rng, [1, 2, 3])
    if v == 1:  # A(g) ⇌ 2B(g), 부피 1/2 → 농도 2배; Q = 2K > K → 역반응(반응물, 기체 몰수 적은 쪽)
        rxn = "A(g) ⇌ 2B(g)"; a, b = pick(rng, [(0.40, 0.20), (0.50, 0.10), (0.25, 0.10)]); fac = 2.0
        K = b ** 2 / a
        q_conc = ((b * fac) ** 2) / (a * fac)
        q_ratio = K * fac ** (2 - 1)
        change = "decreased to half of its original value"
        eq = f"[A] = {a:g} M and [B] = {b:g} M"
        correct_side, opp_side, desc, opp_desc = "reactant", "product", "fewer", "more"
    elif v == 2:  # A(g) + B(g) ⇌ C(g), 부피 2배 → 농도 1/2; Q = 2K > K → 역반응(반응물, 기체 몰수 많은 쪽)
        rxn = "A(g) + B(g) ⇌ C(g)"; a, b, c0 = pick(rng, [(0.20, 0.20, 0.10), (0.50, 0.20, 0.40), (0.10, 0.30, 0.06)]); fac = 0.5
        K = c0 / (a * b)
        q_conc = (c0 * fac) / ((a * fac) * (b * fac))
        q_ratio = K * fac ** (1 - 2)
        change = "increased to twice its original value"
        eq = f"[A] = {a:g} M, [B] = {b:g} M, and [C] = {c0:g} M"
        correct_side, opp_side, desc, opp_desc = "reactant", "product", "more", "fewer"
    else:  # A(g) ⇌ B(g) + C(g), 부피 2배 → 농도 1/2; Q = K/2 < K → 정반응(생성물, 기체 몰수 많은 쪽)
        rxn = "A(g) ⇌ B(g) + C(g)"; a, b, c0 = pick(rng, [(0.40, 0.20, 0.20), (0.50, 0.10, 0.25), (0.30, 0.15, 0.20)]); fac = 0.5
        K = b * c0 / a
        q_conc = ((b * fac) * (c0 * fac)) / (a * fac)
        q_ratio = K * fac ** (2 - 1)
        change = "increased to twice its original value"
        eq = f"[A] = {a:g} M, [B] = {b:g} M, and [C] = {c0:g} M"
        correct_side, opp_side, desc, opp_desc = "product", "reactant", "more", "fewer"
    agree(q_conc, q_ratio, 1e-9, "Q after volume change")
    smaller = q_conc < K
    rel, rel_opp = ("smaller than", "larger than") if smaller else ("larger than", "smaller than")
    q_wrong = K * 2 if smaller else K / 2   # Q 가 농도 변화에 선형이라고 오해한 값
    stem = (f"The reaction {rxn} is at equilibrium in a closed container at constant temperature, with {eq} and Kc = {K:g}. "
            f"The volume of the container is suddenly {change}, and the temperature does not change. "
            "Which statement correctly compares the reaction quotient Q with Kc immediately after the change and gives the direction of the shift?")
    key_t = f"Q = {q_conc:g} is {rel} Kc = {K:g}, so the net reaction shifts toward the {correct_side}, the side with {desc} gas molecules."
    wrongs = [(f"Q is still equal to Kc = {K:g} because Kc depends only on temperature, so the mixture stays at equilibrium and there is no shift.", "Believes that a constant K means Q cannot change, so volume changes cause no shift."),
              (f"Q = {q_conc:g} is {rel} Kc = {K:g}, so the net reaction shifts toward the {opp_side}, the side with {opp_desc} gas molecules, until Q equals Kc.", f"Reads Q {'<' if smaller else '>'} K backward and picks the opposite direction."),
              (f"Q = {q_wrong:g} is {rel_opp} Kc = {K:g}, so the net reaction shifts toward the {opp_side} until Q equals Kc again.", "Assumes Q scales linearly with the concentration change and ignores the exponents, so both the value and the direction come out wrong.")]
    kwhy = (f"Every concentration is multiplied by {fac:g}, so Q = {q_conc:g} against Kc = {K:g} gives Q/Kc = {q_conc / K:g}; Q is {rel} Kc, so the net change moves toward the {correct_side}, "
            f"which is the side with {desc} moles of gas.")
    key, ds = sentence_options(key_t, kwhy, wrongs)
    return mk("ch_t5m_q_after_volume_change", "7.10", "5.F", stem, key, ds, rng,
              concept="decide the direction of a shift after a sudden volume change by recomputing Q from the new concentrations and comparing it with K",
              path="recompute Q from the scaled concentrations vs Q = K·f^(Δn_gas) from the coefficients", facts=[f"rxn={rxn}", f"K={K:g}", f"Q={q_conc:g}"],
              judgment="find how every concentration changes, form Q from the new values, and compare it with K to name the direction", est=105)


# ============================ 7.7 아주 작은 K 에서 평형 농도 근사 (5.F) ============================
def ch_t5m_small_k_equilibrium(rng):
    v = 1
    if v == 0:  # X2 ⇌ 2X
        K, c0 = pick(rng, [(4.0e-8, 0.50), (1.6e-9, 0.25)])
        # 정확: (2x)^2 /(c0 - x) = K → 4x^2 + Kx - K c0 = 0
        x_exact = (-K + math.sqrt(K * K + 16 * K * c0)) / 8
        x_approx = math.sqrt(K * c0 / 4)
        agree(x_exact, x_approx, 1e-3, "x small-K approximation")
        prod = 2 * x_approx
        rxn, spec, mult = "X₂(g) ⇌ 2X(g)", "X", "2x"
        wrong_vals = [x_approx, math.sqrt(K), K]
        why_prod = f"[X] = 2x = 2({_sci(x_approx)}) = {_sci(prod)} M"
        setup = f"Kc = (2x)²/({c0:g} − x) ≈ 4x²/{c0:g}"
        rel_name = ("[X] equal to x", "[X] equal to the square root of Kc", "[X] equal to Kc")
    else:  # A ⇌ B + C
        K, c0 = pick(rng, [(2.5e-7, 0.40), (6.4e-9, 0.10), (1.6e-8, 0.25)])
        x_exact = (-K + math.sqrt(K * K + 4 * K * c0)) / 2
        x_approx = math.sqrt(K * c0)
        agree(x_exact, x_approx, 1e-3, "x small-K approximation")
        prod = x_approx
        rxn, spec, mult = "A(g) ⇌ B(g) + C(g)", "B", "x"
        wrong_vals = [2 * x_approx, math.sqrt(K), K]
        why_prod = f"[B] = x = {_sci(prod)} M"
        setup = f"Kc = x²/({c0:g} − x) ≈ x²/{c0:g}"
        rel_name = ("[B] equal to 2x", "[B] equal to the square root of Kc", "[B] equal to Kc")
    pct = 100 * x_approx / c0
    sym = "X" if v == 0 else "B"
    init = f"[X₂] = {c0:g} M and no X" if v == 0 else f"[A] = {c0:g} M and no B or C"
    stem = (f"At a certain temperature the reaction {rxn} has Kc = {_sci(K, 1)}. A closed container starts with {init}. "
            f"Which statement gives the equilibrium concentration of {sym} and a correct reason the simplification used to find it is valid?")
    key_t = (f"[{sym}] ≈ {_sci(prod)} M, found from {setup}, which is valid because x is only about {pct:.2g}% of the initial concentration.")
    w0 = ("without multiplying x by the coefficient 2" if v == 0 else "after multiplying x by 2 although B has a coefficient of 1")
    wrongs = [(f"[{sym}] ≈ {_sci(wrong_vals[0])} M, found from the same simplified expression {w0}, which is valid because Kc is so small.", "Mishandles the coefficient when converting the change x into the equilibrium concentration."),
              (f"[{sym}] ≈ {_sci(wrong_vals[1])} M, found by taking the square root of Kc alone, which is valid because Kc is so small that the initial concentration does not matter.", "Drops the initial concentration from the expression, treating the square root of Kc as the answer."),
              (f"[{sym}] ≈ {_sci(wrong_vals[2])} M, because a very small Kc means the equilibrium concentration of the product is approximately equal to Kc itself.", "Treats the numerical value of Kc as a concentration instead of a ratio of concentrations.")]
    kwhy = (f"With x as the change, {setup} gives x ≈ {_sci(x_approx)} M (the quadratic gives {_sci(x_exact)} M, the same to two figures), so {why_prod}; x is {pct:.3g}% of {c0:g} M, below the 5% rule, so dropping x from the subtraction is justified.")
    key, ds = sentence_options(key_t, kwhy, wrongs)
    return mk("ch_t5m_small_k_equilibrium", "7.7", "5.F", stem, key, ds, rng,
              concept="find an equilibrium concentration with a very small K by dropping x from the initial concentration and check that the approximation is valid",
              path="exact quadratic solution of the ICE expression vs the simplified square-root approximation", facts=[f"K={K:g}", f"c0={c0:g}", f"x={x_approx:.4g}"],
              judgment="set up the ICE change, simplify because K is tiny, solve for x, apply the coefficient, and check the 5% condition", est=115)
