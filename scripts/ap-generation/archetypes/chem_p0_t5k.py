"""AP Chemistry 원형 — CH5 3.4 기체 단독 1칸 대체(2026-10-22): 두 용기의 서로 다른 기체를 밸브로 연결해 섞은 뒤의 전체 압력.
공개 문항(이상 기체 몰수·밀도·결합 기체 법칙·몰분율 분압·수증기 오차·건조 기체)과 자료·조건·과제·풀이 단계가 다르다: 서로 다른 초기 압력·부피의 두 용기, 온도 일정,
각 용기의 물질량을 PV = nRT 로 구한 뒤 합친 물질량을 전체 부피에 대입한다. 정답은 이중 경로(몰수 합산 vs 정확 분수)로 계산하고 오답은 이름 붙은 오개념이다."""
from chem_common import *  # noqa: F401,F403


@retry_sep
def ch_t5k_valve_mixing(rng):
    for _ in forever():
        ga, gb = pick(rng, [("He", "Ar"), ("Ne", "N2"), ("H2", "CO2"), ("Ar", "CH4")])
        P1, V1 = pick(rng, [1.20, 2.00, 0.80, 1.60]), pick(rng, [2.0, 3.0, 4.0])
        P2, V2 = pick(rng, [0.50, 0.90, 1.50, 0.30]), pick(rng, [1.0, 2.0, 6.0, 5.0])
        T = pick(rng, [300.0, 273.0, 350.0])
        key_v = (P1 * V1 + P2 * V2) / (V1 + V2)
        n1, n2 = P1 * V1 / (R_ATM * T), P2 * V2 / (R_ATM * T)
        path_b = (n1 + n2) * R_ATM * T / (V1 + V2)
        agree(key_v, path_b, 1e-9, "Pf")
        exact = float((sp.nsimplify(P1) * sp.nsimplify(V1) + sp.nsimplify(P2) * sp.nsimplify(V2)) / (sp.nsimplify(V1) + sp.nsimplify(V2)))
        agree(key_v, exact, 1e-9, "Pf exact")
        pairs = [("Averages the two initial pressures.", (P1 + P2) / 2), ("Adds the two initial pressures.", P1 + P2),
                 ("Divides only the first gas's PV by the combined volume and ignores the second gas.", P1 * V1 / (V1 + V2)),
                 ("Divides the sum of the two pressures by the combined volume.", (P1 + P2) / (V1 + V2))]
        pairs = [(t, v) for t, v in pairs if abs(v - key_v) / key_v > 0.10]
        tie = abs((key_v * 100) % 1 - 0.5) < 0.05  # 세 자리 유효숫자 반올림이 .5 경계에 걸리면 정답 표기가 모호해진다
        if len(pairs) >= 3 and key_v > 0.3 and V1 != V2 and not tie:
            break
    key, ds = num_opts(key_v, pairs[:3], "atm")
    stem = (f"A rigid ${V1:g}\\text{{ L}}$ flask holds {cf(ga)}(g) at ${P1:g}\\text{{ atm}}$, and a second rigid ${V2:g}\\text{{ L}}$ flask holds {cf(gb)}(g) at ${P2:g}\\text{{ atm}}$. "
            f"Both flasks are at ${T:g}\\text{{ K}}$ and are joined by a tube with a closed stopcock. The stopcock is opened and the gases mix while the temperature stays at ${T:g}\\text{{ K}}$. "
            f"Assuming ideal behavior and no reaction, what is the final total pressure in the connected flasks, in atm?")
    return mk("ch_t5k_valve_mixing", "3.4", "5.F", stem, key, ds, rng, concept="final total pressure after two gases at different pressures and volumes are allowed to mix at constant temperature",
              path="moles from PV/RT summed over the total volume vs exact rational (P1V1 + P2V2)/(V1 + V2)", facts=[f"P1={P1}", f"V1={V1}", f"P2={P2}", f"V2={V2}", f"T={T}", f"Pf={key_v:.5f}"],
              kwhy=f"At constant T each gas keeps its amount, n = PV/RT, so n_total = (P1V1 + P2V2)/RT and P_final = n_total RT/(V1 + V2) = (({P1:g})({V1:g}) + ({P2:g})({V2:g}))/({V1:g} + {V2:g}) = {sig(key_v)} atm.",
              judgment="find the amount of each gas from its own pressure and volume, then use the total amount in the total volume", est=105)
