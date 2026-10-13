"""AP Computer Science A 파일럿·풀 모의고사 비용 추정(2026-10-13, 유료 호출 없음). 단가는 Physics 1·Chemistry 실측(docs/ap/physics1-groundwork.md §12, chemistry-groundwork.md §8):
MC 후보 1개 약 $0.039(생성 문장 고정 + 풀이 + 검토 + 난이도), FRQ 후보 1개 약 $0.05–0.06(파트 4개 기준). CS A FRQ 는 풀이(Opus)가 Java 전체를 써서 토큰이 더 많으므로 중간 $0.07(범위 $0.05–0.10)로 둔다 — 실측 전 가정이다.
첫 통과율: MC 52–76%(중간 60%), FRQ 약 45%. 모든 값은 가정이며 파일럿(P1-a/P1-b) 결과로 갱신한다."""
MC_USD = 0.039
FRQ_USD = 0.07
FRQ_USD_RANGE = (0.05, 0.10)
MC_PASS = (0.52, 0.60, 0.76)  # 낮음·중간·높음(후보 1개당 첫 통과율)
FRQ_PASS = 0.45
MC_CANDS = 2   # 칸당 후보(AP_MC_CANDS=2, 화학·물리와 같다)
FRQ_CANDS = 3  # 칸당 후보
RESERVE = 1.3


def cell_pass(p, k):
    return 1 - (1 - p) ** k


def mc_cost(cells, p=MC_PASS[1], cands=MC_CANDS, usd=MC_USD, topup=True):
    """칸 수 cells 를 채우는 기대 비용. 한 번 돌린 뒤 실패한 칸만 한 번 더(top-up) 돌린다. 반환: (비용, 통과 칸 기대값)."""
    first = cells * cands * usd
    miss = cells * (1 - cell_pass(p, cands))
    return first + (miss * cands * usd if topup else 0.0), cells - miss


def frq_cost(cells, p=FRQ_PASS, cands=FRQ_CANDS, usd=FRQ_USD, topup=True):
    first = cells * cands * usd
    miss = cells * (1 - cell_pass(p, cands))
    return first + (miss * cands * usd if topup else 0.0), cells - miss


def pilot(usd_mc=MC_USD, usd_frq=FRQ_USD):
    """파일럿: MC 22칸 x 후보 2 + FRQ 4칸 x 후보 2(상한 계획용 — top-up 없음)."""
    return 22 * MC_CANDS * usd_mc, 4 * 2 * usd_frq


def exams(n_exams=2, reuse_mc=0, reuse_frq=0, p_mc=MC_PASS[1], reserve=RESERVE, usd_frq=FRQ_USD):
    """풀 모의고사 n 회(문항 겹침 0): MC 42n 칸, FRQ 4n 칸. 파일럿에서 통과한 칸(reuse)은 다시 만들지 않는다. 반환: (기대, 예비 포함)."""
    mc, _ = mc_cost(42 * n_exams - reuse_mc, p=p_mc)
    frq, _ = frq_cost(4 * n_exams - reuse_frq, usd=usd_frq)
    base = mc + frq
    return round(base, 2), round(base * reserve, 2)


def summary():
    pm, pf = pilot()
    reuse_mc = int(22 * cell_pass(MC_PASS[1], MC_CANDS))  # 파일럿(후보 2)에서 통과한 칸 수(소수점 버림)
    reuse_frq = int(4 * cell_pass(FRQ_PASS, 2))
    return {"pilot_mc": round(pm, 2), "pilot_frq": round(pf, 2), "pilot_total": round(pm + pf, 2), "reuse_mc": reuse_mc, "reuse_frq": reuse_frq,
            "one_exam": exams(1), "two_exams": exams(2), "two_exams_with_pilot_reuse": exams(2, reuse_mc=reuse_mc, reuse_frq=reuse_frq),
            "two_exams_pessimistic": exams(2, p_mc=MC_PASS[0], usd_frq=FRQ_USD_RANGE[1]), "two_exams_optimistic": exams(2, p_mc=MC_PASS[2], usd_frq=FRQ_USD_RANGE[0])}


if __name__ == "__main__":
    import json
    print(json.dumps(summary(), indent=1))
