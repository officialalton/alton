"""AP Macroeconomics 사건표·규칙·시뮬레이션(2026-10-14). 사건 → 곡선 이동 방향(경제 지식, 규칙표)을 적고, 결과 방향은
(1) 규칙표(eq_effect_rule 계열) 와 (2) 선형 모형 수치 시뮬레이션으로 따로 계산해 일치할 때만 쓴다. 모든 시장 모형(AD-AS·화폐시장·대부자금·외환)은 '두 곡선 + 이동' 구조다.
방향: +1 증가·오른쪽/위, -1 감소·왼쪽/아래, 0 변화 없음, None 불확정."""
from macro_common import *  # noqa: F401,F403
from macro_common import _sg  # noqa: F401

# ---------------- 선형 모형 시뮬레이션(독립 경로) ----------------


def market_sim(ds, ss):
    """수요(또는 AD·화폐수요·대부자금 수요·통화 수요) 이동 ds, 공급 이동 ss 의 (가격 방향, 수량 방향). 크기 영역 3가지를 풀어 부호가 일정하면 확정, 아니면 None."""
    return eq_effect_sim(ds, ss)


def vertical_supply_sim(ms, md):
    """화폐시장(공급 수직): 수요 i = A - B*M, 공급 M = M0. 수요 이동 md(+1 오른쪽), 공급 이동 ms(+1 오른쪽). 금리 방향."""
    res = set()
    for (kd, ks) in [(3, 1), (1, 3), (2, 2)]:
        A, B, M0 = 20, 1, 10
        i0 = A - B * M0
        i1 = (A + md * 2 * kd) - B * (M0 + ms * 2 * ks)
        res.add(_sg(i1 - i0))
    return res.pop() if len(res) == 1 else None


def vertical_supply_rule(ms, md):
    """공급 증가는 금리를 낮추고 수요 증가는 금리를 올린다. 두 이동이 같은 힘이 아니면 불확정."""
    if ms and md and ms == md:
        return None  # 공급 오른쪽(금리 하락)과 수요 오른쪽(금리 상승)은 상쇄 방향
    return _sg(md - ms)


def adas_dirs(ds, ss):
    """AD(ds)·SRAS(ss) 이동의 단기 균형: 물가수준 P, 실질 GDP Y, 경기적 실업 U(= -Y). 규칙표와 시뮬레이션이 일치해야 한다."""
    r = eq_effect_rule(ds, ss)
    s = market_sim(ds, ss)
    if r != s:
        raise ValueError(f"adas_rule_sim_mismatch:{ds}:{ss}:{r}:{s}")
    P, Y = r
    U = None if Y is None else -Y
    return {"P": P, "Y": Y, "U": U}


def mm_dirs(ms, md):
    r = vertical_supply_rule(ms, md); s = vertical_supply_sim(ms, md)
    if r != s:
        raise ValueError(f"mm_rule_sim_mismatch:{ms}:{md}:{r}:{s}")
    return r


# ---------------- 사건표 ----------------
# 각 항목: (사건 문장, 메커니즘 한 줄). 문장은 학생용(영어)이다.
AD_UP = [
    ("Households become more confident about their future incomes and increase consumption spending at every price level.", "Higher consumption spending is a component of aggregate expenditure, so aggregate demand shifts to the right."),
    ("The government increases spending on infrastructure projects without changing taxes.", "Government purchases are a component of aggregate demand, so aggregate demand shifts to the right."),
    ("The government lowers personal income tax rates.", "Lower taxes raise disposable income and consumption spending, so aggregate demand shifts to the right."),
    ("Firms become more optimistic about future profits and increase their investment spending.", "Investment spending is a component of aggregate demand, so aggregate demand shifts to the right."),
    ("Incomes rise in the country's major trading partners, so foreign buyers purchase more of the country's exports.", "Higher exports raise net exports, a component of aggregate demand, so aggregate demand shifts to the right."),
    ("The central bank lowers its administered interest rates, which lowers market interest rates.", "Lower interest rates raise interest-sensitive consumption and investment, so aggregate demand shifts to the right."),
    ("A sustained boom in stock prices raises household wealth.", "Greater wealth raises consumption spending, so aggregate demand shifts to the right."),
]
AD_DOWN = [
    ("Households become pessimistic about their future incomes and cut consumption spending at every price level.", "Lower consumption spending reduces aggregate expenditure, so aggregate demand shifts to the left."),
    ("The government cuts its spending on public works without changing taxes.", "Government purchases are a component of aggregate demand, so aggregate demand shifts to the left."),
    ("The government raises personal income tax rates.", "Higher taxes reduce disposable income and consumption spending, so aggregate demand shifts to the left."),
    ("Firms become pessimistic about future profits and reduce their investment spending.", "Lower investment spending reduces aggregate expenditure, so aggregate demand shifts to the left."),
    ("A recession in the country's major trading partners reduces foreign purchases of the country's exports.", "Lower exports reduce net exports, so aggregate demand shifts to the left."),
    ("The central bank raises its administered interest rates, which raises market interest rates.", "Higher interest rates reduce interest-sensitive consumption and investment, so aggregate demand shifts to the left."),
    ("A sharp fall in stock prices reduces household wealth.", "Lower wealth reduces consumption spending, so aggregate demand shifts to the left."),
]
SRAS_UP = [
    ("The price of imported oil, an input for many firms, falls sharply.", "Lower input costs reduce firms' costs at every price level, so short-run aggregate supply shifts to the right.", False),
    ("Workers accept lower nominal wages in new labor contracts.", "Lower nominal wages reduce firms' costs at every price level, so short-run aggregate supply shifts to the right.", False),
    ("A technological advance raises labor productivity throughout the economy.", "Higher productivity lowers the cost per unit of output, so short-run aggregate supply shifts to the right.", True),
    ("A favorable growing season lowers the prices of agricultural inputs used by food producers.", "Lower input costs reduce firms' costs at every price level, so short-run aggregate supply shifts to the right.", False),
    ("The government eliminates a payroll tax paid by employers.", "Lower business costs reduce the cost of producing each unit, so short-run aggregate supply shifts to the right.", False),
]
SRAS_DOWN = [
    ("The price of oil rises sharply, raising production costs for many firms.", "Higher input costs raise firms' costs at every price level, so short-run aggregate supply shifts to the left.", False),
    ("Workers win large nominal wage increases in new labor contracts.", "Higher nominal wages raise firms' costs at every price level, so short-run aggregate supply shifts to the left.", False),
    ("A severe drought reduces crop yields and raises the prices of agricultural inputs.", "Higher input costs raise firms' costs at every price level, so short-run aggregate supply shifts to the left.", False),
    ("The government raises a payroll tax paid by employers.", "Higher business costs raise the cost of producing each unit, so short-run aggregate supply shifts to the left.", False),
    ("Firms expect higher inflation and raise their prices and the wages they offer in advance.", "Higher expected input and output prices raise costs at every price level, so short-run aggregate supply shifts to the left.", False),
]

# 통화정책·재정정책 사건(AD 방향, 설명)
FISCAL_EXP = [("The government increases spending on public infrastructure.", "government purchases"), ("The government cuts income taxes.", "taxes"), ("The government increases transfer payments such as unemployment benefits.", "transfers")]
FISCAL_CON = [("The government reduces its spending on public infrastructure.", "government purchases"), ("The government raises income taxes.", "taxes"), ("The government reduces transfer payments.", "transfers")]

# 화폐시장(지급준비금이 제한적인 경제). (사건, ms, md)
MM_EVENTS = [
    ("The central bank buys government bonds in the open market in an economy with limited reserves.", 1, 0, "An open-market purchase increases reserves and the money supply, so the money supply curve shifts to the right."),
    ("The central bank sells government bonds in the open market in an economy with limited reserves.", -1, 0, "An open-market sale decreases reserves and the money supply, so the money supply curve shifts to the left."),
    ("The central bank lowers the required reserve ratio in an economy with limited reserves.", 1, 0, "A lower reserve requirement raises the money multiplier and the money supply, so the money supply curve shifts to the right."),
    ("The central bank raises the required reserve ratio in an economy with limited reserves.", -1, 0, "A higher reserve requirement lowers the money multiplier and the money supply, so the money supply curve shifts to the left."),
    ("The price level rises, so households and firms need more money for their transactions.", 0, 1, "A higher price level raises the quantity of money demanded at every nominal interest rate, so money demand shifts to the right."),
    ("The price level falls, so households and firms need less money for their transactions.", 0, -1, "A lower price level reduces the quantity of money demanded at every nominal interest rate, so money demand shifts to the left."),
    ("Real GDP rises, so households and firms carry out more transactions.", 0, 1, "Higher real income raises the amount of money people want to hold at every nominal interest rate, so money demand shifts to the right."),
    ("Real GDP falls, so households and firms carry out fewer transactions.", 0, -1, "Lower real income reduces the amount of money people want to hold at every nominal interest rate, so money demand shifts to the left."),
]

# 대부자금시장: 사건, 공급 이동(저축), 수요 이동(차입), 메커니즘
LF_EVENTS = [
    ("Households increase their saving at every real interest rate.", 1, 0, "Greater saving increases the supply of loanable funds."),
    ("Households decrease their saving at every real interest rate.", -1, 0, "Lower saving decreases the supply of loanable funds."),
    ("Firms become more optimistic about the profitability of new capital and plan more investment.", 0, 1, "Higher expected returns on investment increase the demand for loanable funds."),
    ("Firms become pessimistic about the profitability of new capital and plan less investment.", 0, -1, "Lower expected returns on investment decrease the demand for loanable funds."),
    ("Foreign savers increase their lending in the country's financial markets.", 1, 0, "Greater capital inflows increase the supply of loanable funds."),
    ("The government introduces a tax credit that rewards firms for purchasing new equipment.", 0, 1, "A higher after-tax return on investment increases the demand for loanable funds."),
]

# 외환시장(자국 통화의 가치): 사건, 통화 수요 이동, 통화 공급 이동, 메커니즘
FX_EVENTS = [
    ("Interest rates in the country rise relative to interest rates abroad, so foreign investors want more of the country's financial assets.", 1, 0, "Foreign investors demand more of the country's currency to buy its financial assets, so the demand for the currency shifts to the right."),
    ("Interest rates in the country fall relative to interest rates abroad, so foreign investors want less of the country's financial assets.", -1, 0, "Foreign investors demand less of the country's currency, so the demand for the currency shifts to the left."),
    ("Incomes rise abroad, and foreign households buy more of the country's exports.", 1, 0, "Foreign buyers need more of the country's currency to pay for exports, so the demand for the currency shifts to the right."),
    ("Foreign consumers' tastes shift away from the country's goods.", -1, 0, "Foreign buyers need less of the country's currency to pay for exports, so the demand for the currency shifts to the left."),
    ("Domestic consumers' tastes shift toward imported goods.", 0, 1, "Domestic buyers supply more of the country's currency to buy foreign currency for imports, so the supply of the currency shifts to the right."),
    ("Domestic consumers' tastes shift away from imported goods.", 0, -1, "Domestic buyers supply less of the country's currency to buy foreign currency for imports, so the supply of the currency shifts to the left."),
    ("Interest rates abroad rise relative to interest rates in the country, so domestic investors buy more foreign financial assets.", 0, 1, "Domestic investors supply more of the country's currency to buy foreign assets, so the supply of the currency shifts to the right."),
    ("Interest rates abroad fall relative to interest rates in the country, so domestic investors buy fewer foreign financial assets.", 0, -1, "Domestic investors supply less of the country's currency to buy foreign assets, so the supply of the currency shifts to the left."),
]


def fx_dirs(dd, sd):
    """외환시장: 통화 수요(dd)·공급(sd) 이동 → 환율(자국 통화 가치) 방향과 거래량 방향. 규칙표와 시뮬레이션 일치."""
    r = eq_effect_rule(dd, sd); s = market_sim(dd, sd)
    if r != s:
        raise ValueError("fx_rule_sim_mismatch")
    return {"ER": r[0], "QC": r[1]}


def lf_dirs(sup, dem):
    """대부자금시장: 공급(sup)·수요(dem) 이동 → 실질 이자율, 대부자금 거래량."""
    r = eq_effect_rule(dem, sup); s = market_sim(dem, sup)
    if r != s:
        raise ValueError("lf_rule_sim_mismatch")
    return {"r": r[0], "Q": r[1]}


# ---------------- 방향 선택지 ----------------
NAMES = {"P": "the price level", "Y": "real GDP", "U": "the unemployment rate", "i": "the nominal interest rate", "r": "the real interest rate", "ER": "the value of the currency", "Q": "the quantity of loanable funds", "I": "investment spending", "NX": "net exports",
         "QC": "the quantity of the currency traded", "AD": "aggregate demand", "B": "the price of previously issued bonds", "X": "exports", "IM": "imports", "CAP": "net financial capital inflows", "ir": "interest rates", "pi": "the inflation rate"}


def phrase(var, d, tense="will"):
    """'The price level will increase' 형태의 구."""
    nm_ = NAMES[var]
    if var == "ER":
        if d is None:
            return "The change in the value of the currency is indeterminate"
        return f"The currency {tense} " + {1: "appreciate", -1: "depreciate", 0: "stay the same"}[d]
    if d is None:
        return f"The change in {nm_} is indeterminate"
    w = {1: "increase", -1: "decrease", 0: "not change"}[d]
    return f"{cap1(nm_)} {tense} {w}"


def combo_txt(vs, ds):
    parts = [phrase(v, d) for v, d in zip(vs, ds)]
    return ", and ".join([parts[0], parts[1][0].lower() + parts[1][1:]]) + "." if len(parts) == 2 else parts[0] + "."


def combo_item(rng, vs, truth, mech, dirs=(1, -1, 0), why_extra=None, allow_none_for=()):
    """두 변수 방향 조합 선택지(정답 1 + 오답 4). truth: {var: dir}, mech: {var: 메커니즘 문장(참인 결과의 이유)}.
    오답 설명은 어느 변수의 방향이 틀렸는지·이름 붙은 혼동을 담는다. 반환 (key Opt, [Opt])."""
    import itertools
    t = tuple(truth[v] for v in vs)
    allc = [c for c in itertools.product(dirs, repeat=len(vs)) if c != t]
    one = [c for c in allc if sum(a != b for a, b in zip(c, t)) == 1]
    two = [c for c in allc if sum(a != b for a, b in zip(c, t)) >= 2]
    rng.shuffle(one); rng.shuffle(two)
    # 일부 변수는 '변화 없음'이 그럴듯하지 않아 제외(dirs 에서 0 을 빼면 된다). 오답: 한 변수만 틀린 것 우선
    pick_c = (one + two)[:4]
    if len(pick_c) < 4:
        raise ValueError("not_enough_separated_distractors")
    from common import Opt as _O
    key = _O(combo_txt(vs, t), True, " ".join(mech[v] for v in vs), None)
    ds = []
    for c in pick_c:
        why = []
        for v, a, b in zip(vs, c, t):
            if a == b:
                continue
            nm_ = NAMES[v]
            if a is None:
                why.append(f"Calls the effect on {nm_} indeterminate, but it would {DIRW[b]}. {mech[v]}")
            elif b is None:
                why.append(f"Claims {nm_} would {DIRW[a]} for certain, but the effect is indeterminate. {mech[v]}")
            elif a == 0:
                why.append(f"Says {nm_} would not change, but it would {DIRW[b]}. {mech[v]}")
            else:
                why.append(f"Says {nm_} would {DIRW[a]}, but it would {DIRW[b]}. {mech[v]}")
        ds.append(_O(combo_txt(vs, c), False, " ".join(why), None))
    return key, ds


def policy_mix(f, mo):
    """재정정책 f(+1 확장, -1 긴축)와 통화정책 mo(+1 확장, -1 긴축)의 단기 효과: 실질 GDP Y, 이자율 i. 규칙: 같은 방향이면 Y 가 확정, 반대 방향이면 i 가 확정.
    시뮬레이션: 세 가지 크기 영역에서 Y 효과 = kf*f + km*mo, i 효과 = kf'*f - km'*mo 의 부호가 일정하면 확정."""
    rule_Y = None if f * mo < 0 else _sg(f + mo)
    rule_i = None if f * mo > 0 else _sg(f - mo)
    sY, si = set(), set()
    for (a, b) in [(3, 1), (1, 3), (2, 2)]:
        sY.add(_sg(a * f + b * mo)); si.add(_sg(a * f - b * mo))
    simY = sY.pop() if len(sY) == 1 else None; simi = si.pop() if len(si) == 1 else None
    if (rule_Y, rule_i) != (simY, simi):
        raise ValueError(f"policy_rule_sim_mismatch:{f}:{mo}")
    return {"Y": rule_Y, "i": rule_i}


# ---------------- AD-AS 그림 ----------------
def adas_scene(rng, gap):
    """단기 균형 (Y0,P0), AD: P = A - B*Y, SRAS: P = C + D*Y, LRAS: Y = Yf. gap: 'rec'(Y0<Yf) | 'inf'(Y0>Yf) | 'none'."""
    for _ in forever():
        Y0 = rng.choice(range(40, 81, 5)); P0 = rng.choice(range(60, 121, 10)); B = rng.choice([Fr(1, 2), Fr(1)]); D = rng.choice([Fr(1, 2), Fr(1, 4)])
        A = P0 + B * Y0; C = P0 - D * Y0
        if C <= 5:
            continue
        gapsz = rng.choice([10, 15, 20])
        Yf = Y0 + gapsz if gap == "rec" else (Y0 - gapsz if gap == "inf" else Y0)
        if Yf <= 10:
            continue
        return dict(Y0=Y0, P0=P0, B=B, D=D, A=A, C=C, Yf=Yf, gap=gap, gapsz=gapsz)


def adas_curves(sc, xhi=120, ad_shift=0, sras_shift=0, ad2=False, sras2=False):
    yhi = int(sc["A"]) + 20 + (abs(ad_shift) if ad2 else 0)
    ad = line_pts(sc["A"], -sc["B"], 0, xhi); sras = line_pts(sc["C"], sc["D"], 0, xhi)
    cur = [("AD", ad), ("SRAS", sras), ("LRAS", [(sc["Yf"], 0), (sc["Yf"], yhi)])]
    if ad2:
        cur.insert(1, ("AD2", line_pts(sc["A"] + ad_shift, -sc["B"], 0, xhi)))
    if sras2:
        cur.insert(2 if not ad2 else 3, ("SRAS2", line_pts(sc["C"] + sras_shift, sc["D"], 0, xhi)))
    return cur, xhi, yhi


def sc_check(sc):
    Y, P = eq_sympy(Mkt(sc["Y0"], sc["P0"], sc["B"], sc["D"]))
    agree(float(Y), sc["Y0"], 1e-9, "Y0"); agree(float(P), sc["P0"], 1e-9, "P0")


AXES = dict(xlabel="Real GDP (billions of dollars)", ylabel="Price level (index)")


