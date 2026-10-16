"""AP Macroeconomics FRQ 원형(2026-10-14). 긴 문항 3종(10점) + 짧은 문항 7종(5점). 공식 구조(CED p.129): 긴 1 + 짧은 2 = 20점. 그래프 그리기(스킬 4.A–4.C)는 FRQ 점수의 30–50%.
모든 수치는 코드가 계산하고 독립 경로로 다시 계산한다. 루브릭은 의미 기반(문구 일치 아님), 모범 답안은 'ALTON reference answer for self-review — not official AP scoring'. 그래프 그리기 행은 체크리스트(종이 손글씨)다."""
from macro_common import *  # noqa: F401,F403
from macro_common import _sg  # noqa: F401
import re
from calc_ab_frq import row, part

REF = "ALTON reference answer for self-review — not official AP scoring. "


def fr(rid, pts, crit, el, alt, err, nums=False, requires=None, both=False, note=None):
    r = row(rid, pts, crit, el, alt=list(alt), err=err, requires=requires, both=both, nums=nums)
    # 의미 기반 행은 허용 표현이 2개 이상이어야 한다(게이트): 부족하면 행 유형에 맞는 일반 허용 표현을 덧붙인다.
    generic = "the same numerical answer in an equivalent form (fraction, decimal, or with units)" if nums else ("equivalent labels or notation on the student's graph, as long as the axes and curves are identified" if re.search(r"draw|graph|label|curve|shift", crit + " ".join(el), re.I) else "a correct equivalent statement in the student's own words")
    while len(r["alt_solutions"]) < 2:
        r["alt_solutions"].append(generic if generic not in r["alt_solutions"] else generic + " (accepted without a specific phrase)")
    r["meaning_based"] = True; r["uses_concept"] = False; r["single_explanation"] = False
    r["grading_note"] = note or "Award the point when the response conveys the required meaning, whatever the wording; do not require any specific phrase."
    return r


def prt(label, prompt, pts, mode, skills, answer, rows, topics):
    if mode == "explain":  # 설명 파트의 채점 행은 '이유를 설명한다'는 기준 문장을 갖는다(프롬프트↔루브릭 일치 게이트)
        for r in rows:
            if not re.search(r"explain|reason|because|incentive|link|justif|shows? that|argu|state[s]? that|identif", r["criterion"], re.I):
                r["criterion"] = "Gives the reason: " + r["criterion"][0].lower() + r["criterion"][1:]
    p = part(label, prompt, pts, mode, skills, REF + answer, rows)
    p["topic_codes"] = topics
    return p


def finish(pk, concept, thinking, cond, material, path, model):
    pk["blueprint"] = frq_blueprint(pk["archetype"], SUB, pk, concept, thinking, cond, material, path, extra={"model": model})
    return pk


def mdl(initial, changed, held, checks, aid):
    return {"initial_state": initial, "changed_conditions": changed, "held_constant": held, "checks": checks, "key_assumptions_id": aid, "explanation_assumptions_id": aid}


def info(desc, rows, notes=None):
    return tbl(desc, ["Item", "Value"], rows, notes=notes)


# 자주 쓰는 그래프 행(체크리스트)
def adas_rows(prefix, yf_side):
    return [fr(f"{prefix}1", 1, "AD, SRAS, and LRAS graph labeled", ["Draws a downward-sloping aggregate demand curve, an upward-sloping short-run aggregate supply curve, and a vertical long-run aggregate supply curve, with Real GDP on the horizontal axis and Price level on the vertical axis, all labeled"], ["curves may be labeled AD, SRAS, and LRAS", "axes may be labeled Real output or Real GDP and PL or Price level"], ["draws a horizontal or upward-sloping AD curve", "omits an axis label or a curve label"]),
            fr(f"{prefix}2", 1, "Short-run equilibrium labeled", ["Labels the intersection of AD and SRAS as the equilibrium with the real output Y1 on the horizontal axis and the price level PL1 on the vertical axis"], ["dashed lines may drop from the intersection to the axes", "the equilibrium may be labeled E1 with Y1 and PL1"], ["labels a point that is not the intersection of AD and SRAS", "omits PL1 or Y1"]),
            fr(f"{prefix}3", 1, "Full-employment output labeled", [f"Draws the vertical LRAS curve to the {yf_side} of Y1 and labels the full-employment output YF where it meets the horizontal axis"], [f"YF may be labeled Y_F or Yf", f"LRAS is drawn {yf_side} of the equilibrium output"], [f"places LRAS on the {'left' if yf_side == 'right' else 'right'} of Y1", "omits the YF label"])]


# ======================= L1 AD-AS 와 재정정책 (긴, 10점) =======================
def maf_long_adas_policy(rng):
    mpc = rng.choice([Fr(1, 2), Fr(3, 5), Fr(3, 4), Fr(4, 5)]); gap = rng.choice([40, 60, 80, 100])
    need = gap * (1 - mpc)
    if need != int(need):
        raise ValueError("fraction")
    need = int(need)
    agree(float(need), float(gap * (1 - sp.Rational(mpc.numerator, mpc.denominator))), 1e-9, "need")
    agree(float(need / (1 - mpc)), gap, 1e-9, "closes_gap")
    unemp, nat = rng.choice([(8, 5), (9, 6), (7, 5), (10, 6)])
    yf = rng.choice([2000, 2500, 3000]); y1 = yf - gap
    c = rng.choice(["Zeeland", "Valdoria", "Marenia", "Torvania"])
    stim = info(f"Macroeconomic data for the country of {c}, which is in short-run equilibrium.", [["Actual unemployment rate", f"{unemp} percent"], ["Natural rate of unemployment", f"{nat} percent"], ["Real GDP", usd(y1) + " billion"], ["Full-employment (potential) real GDP", usd(yf) + " billion"], ["Marginal propensity to consume", nm(float(mpc), 2)]],
                notes=["For the calculation in part (D), use the simple spending multiplier, which ignores any change in the price level. No other policy changes."])
    parts = [
        prt("A", f"Draw a correctly labeled graph of aggregate demand, short-run aggregate supply, and long-run aggregate supply for {c}, and show each of the following: (i) the current equilibrium real output and price level, labeled Y1 and PL1, and (ii) the full-employment output, labeled YF.", 3, "draw", ["4.A", "4.B"],
            "AD slopes down, SRAS slopes up, LRAS is vertical to the right of Y1 because actual unemployment exceeds the natural rate; the AD-SRAS intersection is labeled Y1 and PL1 and the LRAS meets the axis at YF.", adas_rows("A", "right"), ["3.5"]),
        prt("B", f"Assume that no policy action is taken. Explain how the economy of {c} will adjust to full employment in the long run.", 1, "explain", ["3.A"],
            "With unemployment above the natural rate, nominal wages and input prices fall, which lowers costs and shifts short-run aggregate supply to the right until output equals YF.",
            [fr("B1", 1, "Wage adjustment shifts SRAS right", ["Explains that high unemployment puts downward pressure on nominal wages and input prices, which shifts short-run aggregate supply to the right until real output returns to full employment"], ["falling nominal wages lower firms' costs", "SRAS increases and the price level falls as output rises to potential"], ["says aggregate demand shifts right on its own", "says long-run aggregate supply shifts to meet Y1"])], ["3.7"]),
        prt("C", "Identify one fiscal policy action the government could take to close the gap.", 1, "identify", ["2.A"], "Increase government purchases, increase transfer payments, or cut taxes (any one expansionary fiscal action).",
            [fr("C1", 1, "Expansionary fiscal action", ["States an expansionary fiscal policy action: an increase in government purchases, an increase in transfer payments, or a decrease in taxes"], ["a tax cut", "greater government spending on infrastructure", "increase in unemployment benefits"], ["names a monetary policy action such as buying bonds", "names a contractionary action such as a tax increase"])], ["3.8"]),
        prt("D", "Using the data in the table, calculate the increase in government purchases that would exactly close the gap, and show your work.", 1, "calculate", ["3.C"], f"The gap is {gap} billion and the multiplier is 1/(1 - {nm(float(mpc), 2)}) = {nm(float(1 / (1 - mpc)), 2)}, so government purchases must rise by {gap}/{nm(float(1 / (1 - mpc)), 2)} = {need} billion.",
            [fr("D1", 1, "Required increase in purchases (answer)", ["Divides the output gap by the spending multiplier 1/(1 - MPC) to find the required change in government purchases (the answer is correct)", str(need)], ["gap times (1 - MPC)", "uses the multiplier of the spending change to reach the gap"], ["uses the gap itself as the change in purchases", "multiplies the gap by the multiplier"], nums=True)], ["3.2", "3.8"]),
        prt("E", "On your graph from part (A), show the effect of the government purchases increase from part (D): label the new aggregate demand curve AD2 and the new equilibrium price level PL2.", 2, "draw", ["4.C"], "AD shifts right to AD2, intersecting SRAS at full-employment output, with PL2 above PL1.",
            [fr("E1", 1, "AD shifted right and labeled", ["Shifts the aggregate demand curve to the right and labels the new curve AD2"], ["draws an arrow showing the rightward shift", "AD2 passes through the point on SRAS above YF's equilibrium"], ["shifts the AD curve to the left", "shifts the SRAS curve instead"]),
             fr("E2", 1, "New price level higher", ["Labels the new equilibrium at the intersection of AD2 and SRAS with a price level PL2 that is higher than PL1 and output at YF"], ["dashed lines to the vertical axis at PL2", "output equals YF at the new intersection"], ["labels PL2 below PL1", "places the new equilibrium away from SRAS"])], ["3.8"]),
        prt("F", "Assume the government finances the increase in purchases by borrowing from private savers. Explain the effect of this borrowing on the real interest rate and on private investment spending.", 2, "explain", ["3.B"], "Government borrowing increases the demand for loanable funds, which raises the real interest rate; the higher real interest rate reduces private investment spending (crowding out).",
            [fr("F1", 1, "Real interest rate rises", ["Explains that government borrowing increases the demand for loanable funds, which raises the real interest rate"], ["a larger demand for loanable funds raises the price of borrowing", "the real interest rate goes up because the government competes for savings"], ["says the borrowing lowers the real interest rate", "says the supply of loanable funds increases"]),
             fr("F2", 1, "Private investment falls", ["States that the higher real interest rate reduces private investment spending, so some private borrowing is crowded out"], ["private investment decreases", "crowding out of private firms' borrowing"], ["says private investment increases", "says investment is unaffected by interest rates"], requires="F1")], ["5.5"]),
    ]
    pk = {"archetype": "maf_long_adas_policy", "template": "long_adas_policy", "topic": "3.5", "extra_topics": ["3.7", "3.8", "3.2", "5.5"], "skill": "4.A", "calculator": "allowed", "title": "Closing a recessionary gap with fiscal policy", "stimulus": stim, "parts": parts, "total_points": 10, "est_minutes": 25,
          "facts": [f"mpc={float(mpc):.4f}", f"gap={gap}", f"need={need}", f"unemp={unemp}", f"nat={nat}", f"yf={yf}", f"y1={y1}", f"country={c}"], "context": "adas_policy"}
    return finish(pk, "Recessionary gap: AD-AS graph, self-correction, fiscal policy, multiplier, and crowding out", ["Draw the AD-AS graph consistent with the data", "Explain self-correction and choose a fiscal action", "Use the multiplier to size the action and trace the loanable funds effect"],
                  [("Gap and MPC are stated in the table; the price level is constant for the multiplier calculation", "stated in the stimulus notes")], {"type": "table", "must_include": ["real GDP", "potential real GDP", "marginal propensity to consume"]},
                  "exact fraction of the required spending change versus sympy; gap recovered by multiplying the change by the multiplier",
                  mdl(f"economy with real GDP {gap} billion below potential and MPC {float(mpc):.2f}", [f"government purchases increase by {need} billion"], ["price level for the multiplier calculation", "other policies"], ["gap closes exactly", "AD shifts right", "crowding-out direction"], "adas-fiscal-gap"))


# ======================= L2 개방경제 (긴, 10점) =======================
def maf_long_open_economy(rng):
    ex1 = rng.choice([500, 600, 700]); im1 = ex1 - rng.choice([20, 40, 60]); ex2 = ex1 - rng.choice([40, 60, 80]); im2 = im1 + rng.choice([20, 40, 60])
    nx1, nx2 = ex1 - im1, ex2 - im2
    agree(nx1, int(sp.Integer(ex1) - im1), 1e-9, "nx1"); agree(nx2, int(sp.Integer(ex2) - im2), 1e-9, "nx2")
    if nx2 >= nx1:
        raise ValueError("nx_not_falling")
    c = rng.choice(["Orlandia", "Kestria", "Brevonia", "Haldania"]); cur = rng.choice(["ora", "kes", "bre", "hal"])
    stim = info(f"Data for {c}, a country with a floating exchange rate and a banking system with ample reserves (billions of dollars).", [["Exports in Year 1", usd(ex1)], ["Imports in Year 1", usd(im1)], ["Exports in Year 2", usd(ex2)], ["Imports in Year 2", usd(im2)]],
                notes=[f"Between Year 1 and Year 2 the central bank of {c} raised its administered interest rates to reduce inflationary pressure. Its currency is the {cur}."])
    parts = [
        prt("A", f"Draw a correctly labeled graph of the foreign exchange market for the {cur} (the currency of {c}), showing the equilibrium exchange rate labeled ER1 and the equilibrium quantity of {cur} labeled Q1.", 2, "draw", ["4.A"], f"Downward-sloping demand for {cur} and upward-sloping supply of {cur}, with the exchange rate on the vertical axis and the quantity of {cur} on the horizontal axis, intersecting at ER1 and Q1.",
            [fr("A1", 1, "Curves and axes", [f"Draws a downward-sloping demand curve and an upward-sloping supply curve for the {cur}, labels the vertical axis as the exchange rate (units of foreign currency per {cur}) and the horizontal axis as the quantity of {cur}"], ["curves may be labeled D and S", "axis may say exchange rate or price of the currency"], ["labels the vertical axis as the price level", "draws two curves with the same slope sign"]),
             fr("A2", 1, "Equilibrium labeled", ["Labels the intersection of the two curves with the equilibrium exchange rate ER1 on the vertical axis and Q1 on the horizontal axis"], ["dashed lines from the intersection to both axes", "labels the point E1 with ER1 and Q1"], ["labels a point that is not the intersection", "omits ER1 or Q1"])], ["6.3"]),
        prt("B", f"Identify the effect of the central bank's higher administered interest rates on net financial capital inflows to {c}.", 1, "identify", ["3.B"], "Net financial capital inflows increase (foreign investors want more of the country's higher-yielding assets).",
            [fr("B1", 1, "Capital inflows increase", ["States that net financial capital inflows to the country increase"], ["more foreign investment in the country's financial assets", "capital flows into the country rise"], ["says net financial capital inflows decrease", "says the effect is zero"])], ["6.6"]),
        prt("C", f"On your graph from part (A), show the effect of the change in net financial capital flows on the market for the {cur}: label the new exchange rate ER2.", 2, "draw", ["4.C"], f"The demand for the {cur} shifts to the right (or, equivalently, the supply of the {cur} shifts to the left because domestic investors buy fewer foreign assets), and the new equilibrium exchange rate ER2 is higher than ER1.",
            [fr("C1", 1, "Demand right or supply left", [f"Shifts the demand curve for the {cur} to the right or the supply curve of the {cur} to the left, and labels the new curve"], ["arrow showing the rightward shift of demand", "a leftward shift of supply because domestic investors buy fewer foreign assets"], ["shifts the supply curve to the right", "shifts the demand curve to the left"]),
             fr("C2", 1, "Higher exchange rate labeled", ["Labels the new equilibrium exchange rate ER2 above ER1 at the intersection of the new demand curve and the supply curve"], ["dashed line to the vertical axis at ER2", f"the {cur} appreciates on the graph"], ["labels ER2 below ER1", "labels ER2 at the old intersection"])], ["6.4"]),
        prt("D", f"Based on the change in the value of the {cur}, will exports from {c} increase, decrease, or stay the same? Explain.", 1, "explain", ["3.B"], f"Exports decrease, because the appreciation of the {cur} makes the country's goods more expensive for foreign buyers.",
            [fr("D1", 1, "Exports decrease with reason", ["States that exports decrease because the stronger currency makes the country's goods more expensive to foreign buyers"], ["appreciation raises the foreign price of exports", "foreigners buy fewer of the country's goods"], ["says exports increase", "says exports are unaffected by the exchange rate"])], ["6.5"]),
        prt("E", "Using the data in the table, calculate net exports in Year 1 and in Year 2, and show your work.", 2, "calculate", ["1.C"], f"Net exports in Year 1 = {ex1} - {im1} = {nx1} billion; net exports in Year 2 = {ex2} - {im2} = {nx2} billion.",
            [fr("E1", 1, "Net exports in Year 1 (answer)", ["Subtracts imports from exports in Year 1 to get net exports (the Year 1 answer is correct)", str(nx1)], ["exports minus imports for Year 1"], ["adds exports and imports", "reverses the subtraction"], nums=True),
             fr("E2", 1, "Net exports in Year 2 (answer)", ["Subtracts imports from exports in Year 2 to get net exports (the Year 2 answer is correct)", str(nx2)], ["exports minus imports for Year 2"], ["adds exports and imports", "reverses the subtraction"], nums=True)], ["6.5"]),
        prt("F", "Explain how the central bank's action will affect real GDP in the short run, considering both the effect of higher interest rates on spending and the effect of the change in net exports.", 2, "explain", ["3.A"], "Higher interest rates reduce interest-sensitive consumption and investment, and the lower net exports reduce aggregate demand further, so aggregate demand shifts to the left and real GDP falls.",
            [fr("F1", 1, "Interest-rate effect on spending", ["Explains that higher interest rates reduce interest-sensitive consumption and investment spending, which decreases aggregate demand"], ["borrowing is more expensive so spending falls", "aggregate demand shifts left"], ["says interest-sensitive spending rises", "says aggregate supply shifts"]),
             fr("F2", 1, "Net exports reinforce the fall", ["Explains that the lower net exports from the stronger currency also decrease aggregate demand, so real GDP falls"], ["net exports are a component of aggregate demand", "the appreciation reinforces the contraction"], ["says lower net exports raise aggregate demand", "says real GDP rises"], requires="F1")], ["4.6", "6.5"]),
    ]
    pk = {"archetype": "maf_long_open_economy", "template": "long_open_economy", "topic": "6.4", "extra_topics": ["6.3", "6.5", "6.6", "4.6"], "skill": "4.A", "calculator": "allowed", "title": "Interest rates, the exchange rate, and net exports", "stimulus": stim, "parts": parts, "total_points": 10, "est_minutes": 25,
          "facts": [f"ex1={ex1}", f"im1={im1}", f"ex2={ex2}", f"im2={im2}", f"nx1={nx1}", f"nx2={nx2}", f"country={c}"], "context": "open_economy"}
    return finish(pk, "Higher administered rates: capital inflows, appreciation, net exports, and aggregate demand", ["Draw the currency market and show the demand shift", "Trace capital flows to the exchange rate to net exports", "Compute net exports and explain the combined effect on real GDP"],
                  [("Higher administered interest rates in an ample-reserves economy attract financial capital", "stated in the stimulus notes")], {"type": "table", "must_include": ["exports", "imports"]},
                  "net exports from the table by exact subtraction versus sympy; direction of the exchange rate from a linear currency-market simulation",
                  mdl(f"floating-rate economy with NX {nx1} then {nx2}", ["administered interest rates rise"], ["foreign interest rates"], ["capital inflows rise", "currency appreciates", "net exports fall", "AD falls"], "open-economy-interest"))


# ======================= L3 화폐시장과 통화정책 (긴, 10점) =======================
def maf_long_money_market(rng):
    rr = rng.choice([Fr(1, 10), Fr(1, 5), Fr(1, 4)]); x = rng.choice([20, 40, 50, 100])
    mult = 1 / rr; dm = x * mult
    agree(float(dm), float(sp.Integer(x) / sp.Rational(rr.numerator, rr.denominator)), 1e-9, "dm")
    c = rng.choice(["Ridonia", "Palvia", "Meridia", "Corvalia"])
    stim = info(f"Data for {c}, an economy in a recession whose banking system has limited reserves.", [["Required reserve ratio", f"{nm(float(rr) * 100, 1)} percent"], ["Open-market purchase planned by the central bank", usd(x) + " million"]],
                notes=["Assume banks lend out all excess reserves and the public holds no currency."])
    parts = [
        prt("A", f"Draw a correctly labeled graph of the money market in {c}, showing the demand for money, the supply of money, and the equilibrium nominal interest rate labeled i1.", 2, "draw", ["4.A"], "Downward-sloping money demand and a vertical money supply curve, with the nominal interest rate on the vertical axis and the quantity of money on the horizontal axis, intersecting at i1.",
            [fr("A1", 1, "Curves and axes", ["Draws a downward-sloping money demand curve and a vertical money supply curve, with the nominal interest rate on the vertical axis and the quantity of money on the horizontal axis, all labeled"], ["curves may be labeled MD and MS", "axis may say nominal interest rate or interest rate"], ["draws the money supply curve upward sloping", "labels the vertical axis as the real interest rate"]),
             fr("A2", 1, "Equilibrium rate labeled", ["Labels the intersection of money demand and money supply with the equilibrium nominal interest rate i1"], ["dashed line from the intersection to the vertical axis at i1"], ["labels i1 away from the intersection", "omits i1"])], ["4.5"]),
        prt("B", f"The central bank carries out the open-market purchase shown in the table. On your graph from part (A), show the effect on the money market and label the new nominal interest rate i2.", 2, "draw", ["4.C"], "The money supply curve shifts to the right, and the new equilibrium nominal interest rate i2 is lower than i1.",
            [fr("B1", 1, "Money supply shifts right", ["Shifts the vertical money supply curve to the right and labels the new curve (for example MS2)"], ["arrow showing the rightward shift of money supply"], ["shifts money demand to the right", "shifts money supply to the left"]),
             fr("B2", 1, "Lower interest rate labeled", ["Labels the new equilibrium nominal interest rate i2 below i1 at the intersection of money demand and the new money supply curve"], ["dashed line to the vertical axis at i2"], ["labels i2 above i1"])], ["4.6"]),
        prt("C", "What happens to the price of previously issued bonds as a result of the central bank's action?", 1, "identify", ["3.A"], "The price of previously issued bonds increases (bond prices and interest rates move in opposite directions).",
            [fr("C1", 1, "Bond prices rise", ["States that the price of previously issued bonds increases"], ["bond prices go up as interest rates fall", "existing bonds become more valuable"], ["says bond prices decrease", "says bond prices do not change"])], ["4.1"]),
        prt("D", "Explain how the lower nominal interest rate affects real GDP in the short run.", 2, "explain", ["3.A"], "A lower interest rate lowers the cost of borrowing and increases interest-sensitive consumption and investment, which shifts aggregate demand to the right and raises real GDP.",
            [fr("D1", 1, "Interest-sensitive spending rises", ["Explains that the lower interest rate reduces the cost of borrowing and increases investment and interest-sensitive consumption spending"], ["cheaper loans raise investment", "firms and households borrow and spend more"], ["says saving rises and spending falls", "says the lower rate reduces investment"]),
             fr("D2", 1, "AD shifts right and real GDP rises", ["Explains that the higher spending shifts aggregate demand to the right, which increases real GDP"], ["aggregate demand increases", "real output rises along the short-run supply curve"], ["says aggregate supply shifts", "says real GDP falls"], requires="D1")], ["3.6", "4.6"]),
        prt("E", "Using the data in the table, calculate the maximum possible change in the money supply from the open-market purchase, and show your work.", 2, "calculate", ["3.C"], f"The money multiplier is 1/{nm(float(rr), 3)} = {nm(float(mult), 2)}, so the maximum increase in the money supply is {x} x {nm(float(mult), 2)} = {nm(float(dm), 1)} million.",
            [fr("E1", 1, "Money multiplier (answer)", ["Calculates the money multiplier as one divided by the required reserve ratio (the multiplier answer is correct)", nm(float(mult), 2)], ["1/rr", "the reciprocal of the reserve ratio"], ["uses the reserve ratio itself as the multiplier", "uses 1 - rr"], nums=True),
             fr("E2", 1, "Maximum change in the money supply (answer)", ["Multiplies the open-market purchase by the multiplier to find the maximum change in the money supply (the answer is correct)", nm(float(dm), 1)], ["purchase x multiplier"], ["reports only the purchase amount", "multiplies by the reserve ratio"], nums=True, requires="E1")], ["4.4"]),
        prt("F", "Assume the economy was initially at its natural rate of unemployment before the recession and expected inflation is unchanged. Identify what happens to the unemployment rate in the short run as a result of the central bank's action, and whether it is a movement along or a shift of the short-run Phillips curve.", 1, "identify", ["3.A"], "Unemployment falls, as a movement along the short-run Phillips curve.",
            [fr("F1", 1, "Unemployment falls along the SRPC", ["States that the unemployment rate decreases and that this is a movement along the short-run Phillips curve (not a shift)"], ["unemployment falls and inflation rises along the curve"], ["says the unemployment rate increases", "says the short-run Phillips curve shifts"])], ["5.2"]),
    ]
    pk = {"archetype": "maf_long_money_market", "template": "long_money_market", "topic": "4.6", "extra_topics": ["4.5", "4.4", "4.1", "5.2", "3.6"], "skill": "4.A", "calculator": "allowed", "title": "Open-market purchase in a limited-reserves economy", "stimulus": stim, "parts": parts, "total_points": 10, "est_minutes": 25,
          "facts": [f"rr={float(rr):.4f}", f"x={x}", f"mult={float(mult):.4f}", f"dm={float(dm):.4f}", f"country={c}"], "context": "money_market"}
    return finish(pk, "Open-market purchase: money market graph, bond prices, real GDP, money multiplier, and Phillips curve movement", ["Draw the money market and show the supply shift", "Trace bond prices, spending, and real GDP", "Compute the multiplier and the maximum change in the money supply"],
                  [("Banking system has limited reserves, so the money supply responds to open-market operations", "stated in the stimulus header")], {"type": "table", "must_include": ["required reserve ratio", "open-market purchase"]},
                  "exact fraction multiplier versus sympy rational; direction of the interest rate from a vertical-supply money market simulation",
                  mdl(f"limited-reserves economy with reserve ratio {float(rr):.2f}", [f"central bank buys {x} million of bonds"], ["money demand", "no excess reserves held", "no currency drain"], ["supply shifts right", "interest rate falls", "multiplier", "maximum money supply change"], "money-market-omo"))


# ======================= S1 GDP 자료 (짧은, 5점) =======================
def maf_short_gdp_data(rng):
    for _ in forever():
        n1 = rng.choice([100000, 120000, 150000]); d1 = 100; d2 = rng.choice([110, 120, 125]); n2 = n1 * rng.choice([Fr(6, 5), Fr(5, 4), Fr(3, 2)])
        if n2.denominator != 1:
            continue
        n2 = int(n2); r2 = Fr(n2 * 100, d2)
        if r2.denominator != 1:
            continue
        r2 = int(r2); p1 = rng.choice([100, 120, 200]); p2 = int(p1 * rng.choice([Fr(1, 1), Fr(11, 10), Fr(6, 5)]))
        if r2 <= n1 * 100 // d1 or p2 < p1:
            continue
        break
    infl = (Fr(d2, d1) - 1) * 100
    agree(float(r2), float(sp.Rational(n2 * 100, d2)), 1e-9, "real2")
    pc1 = Fr(n1, p1); pc2 = Fr(r2, p2)
    up = pc2 > pc1
    c = rng.choice(["Rendell", "Samoria", "Tolvana", "Quenland"])
    stim = tbl(f"Macroeconomic statistics for the country of {c}.", ["Year", "Nominal GDP", "GDP deflator (Year 1 = 100)", "Population"], [["Year 1", usd(n1), d1, p1], ["Year 2", usd(n2), d2, p2]])
    parts = [
        prt("A", f"Using the data in the table, calculate real GDP in Year 2 and show your work.", 1, "calculate", ["1.C"], f"Real GDP = nominal GDP / deflator x 100 = {n2}/{d2} x 100 = {r2}.",
            [fr("A1", 1, "Real GDP in Year 2 (answer)", ["Divides Year 2 nominal GDP by the Year 2 GDP deflator and multiplies by 100 (the real GDP answer is correct)", str(r2)], ["nominal GDP / (deflator/100)"], ["multiplies nominal GDP by the deflator", "reports nominal GDP"], nums=True)], ["2.6"]),
        prt("B", "Using the data in the table, calculate the inflation rate from Year 1 to Year 2 and show your work.", 1, "calculate", ["2.C"], f"Inflation = ({d2} - {d1})/{d1} = {nm(float(infl), 1)} percent.",
            [fr("B1", 1, "Inflation rate (answer)", ["Calculates the percent change in the GDP deflator from Year 1 to Year 2 (the inflation rate answer is correct)", nm(float(infl), 1)], ["(deflator 2 - deflator 1)/deflator 1 x 100"], ["divides by the Year 2 deflator", "reports the Year 2 deflator as inflation"], nums=True)], ["2.4"]),
        prt("C", f"Did real GDP per capita in {c} increase, decrease, or stay the same from Year 1 to Year 2? Explain.", 1, "explain", ["2.C"], f"Real GDP per capita {'increased' if up else 'decreased'}: it went from {nm(float(pc1), 2)} to {nm(float(pc2), 2)} because real GDP grew {'faster' if up else 'slower'} than population.",
            [fr("C1", 1, "Per capita direction with reason", [f"States that real GDP per capita {'increased' if up else 'decreased'} because real GDP grew {'faster' if up else 'more slowly'} than the population"], ["compares growth of real GDP with growth of the population", "real GDP per person rose" if up else "real GDP per person fell"], ["uses nominal GDP per capita", "says it is unchanged because both measures rose" if up else "says it increased because real GDP rose"])], ["2.2"]),
        prt("D", "Suppose a bank made a loan in Year 1 at a fixed nominal interest rate, expecting no inflation. Did the bank gain or lose as a result of the inflation rate calculated in part (B)? Identify.", 1, "identify", ["3.A"], "The lender (bank) lost, because the dollars repaid have less purchasing power than expected.",
            [fr("D1", 1, "Lender loses", ["States that the lender loses (or the borrower gains) because inflation lowers the purchasing power of the repayments"], ["the real interest rate received is lower than expected"], ["says the bank gains", "says the bank is unaffected"])], ["2.5"]),
        prt("E", "Explain why economists use real GDP rather than nominal GDP to compare output across the two years.", 1, "explain", ["1.D"], "Nominal GDP can rise because prices rise even if output does not; real GDP removes the effect of price changes, so it measures changes in the quantity of output.",
            [fr("E1", 1, "Real GDP removes price changes", ["Explains that nominal GDP is affected by price changes, while real GDP adjusts for the price level and so measures changes in output"], ["nominal GDP can rise from inflation alone", "real GDP holds prices constant"], ["says real GDP includes more goods than nominal GDP", "says real GDP measures spending and nominal GDP measures income"])], ["2.6"]),
    ]
    pk = {"archetype": "maf_short_gdp_data", "template": "short_gdp_data", "topic": "2.6", "extra_topics": ["2.4", "2.2", "2.5"], "skill": "2.C", "calculator": "allowed", "title": "Real GDP, inflation, and living standards", "stimulus": stim, "parts": parts, "total_points": 5, "est_minutes": 12,
          "facts": [f"n1={n1}", f"n2={n2}", f"d1={d1}", f"d2={d2}", f"p1={p1}", f"p2={p2}", f"r2={r2}", f"infl={float(infl):.4f}", f"up={up}", f"country={c}"], "context": "gdp_data"}
    return finish(pk, "Real GDP and inflation from nominal data, per-capita living standards, and the effect of inflation on a lender", ["Convert nominal GDP to real GDP with the deflator", "Compute inflation from the deflator and compare per capita output", "Judge winners and losers and the reason for using real GDP"],
                  [("Year 1 is the base year (deflator 100)", "stated in the table header")], {"type": "table", "must_include": ["nominal GDP", "GDP deflator", "population"]},
                  "exact fractions for real GDP and inflation versus sympy rationals; per capita compared with exact ratios",
                  mdl(f"country with nominal GDP {n1} then {n2} and deflator {d1} then {d2}", ["compare two years"], ["base year deflator 100"], ["real GDP", "inflation rate", "per capita direction", "lender outcome"], "gdp-data"))


# ======================= S2 PPC 와 무역 (짧은, 5점) =======================
def maf_short_ppc_trade(rng):
    for _ in forever():
        a = [rng.choice([60, 80, 120]), rng.choice([20, 30, 40, 60])]; b = [rng.choice([30, 40, 60]), rng.choice([30, 40, 60, 90])]
        oa, ob = Fr(a[1], a[0]), Fr(b[1], b[0])
        if oa != ob:
            break
    low = "Country A" if oa < ob else "Country B"; high = "Country B" if low == "Country A" else "Country A"
    agree(1, 1 if (oa < ob) == (low == "Country A") else 0, 1e-9, "order")
    g = rng.choice([("wheat", "cloth"), ("laptops", "bicycles"), ("corn", "soybeans")])
    stim = tbl(f"Maximum daily output of two goods for two countries when each uses all of its resources for one good. Production possibilities curves are straight lines.", ["Country", f"{g[0].capitalize()} (units)", f"{g[1].capitalize()} (units)"], [["Country A", a[0], a[1]], ["Country B", b[0], b[1]]])
    parts = [
        prt("A", f"Calculate Country A's opportunity cost of producing one unit of {g[0]}, in units of {g[1]}, and show your work.", 1, "calculate", ["1.C"], f"{a[1]}/{a[0]} = {nm(float(oa), 2)} units of {g[1]}.",
            [fr("A1", 1, "Opportunity cost (answer)", [f"Divides Country A's maximum output of {g[1]} by its maximum output of {g[0]} (the opportunity cost answer is correct)", nm(float(oa), 2)], ["units of the other good given up per unit"], ["inverts the ratio", "uses the output of one good only"], nums=True)], ["1.3"]),
        prt("B", f"Which country has the comparative advantage in producing {g[0]}? Identify.", 1, "identify", ["1.B"], f"{low}, because its opportunity cost of {g[0]} is lower ({nm(float(min(oa, ob)), 2)} versus {nm(float(max(oa, ob)), 2)}).",
            [fr("B1", 1, "Country with the lower opportunity cost", [f"Identifies {low} as having the comparative advantage in {g[0]} because it has the lower opportunity cost"], [f"the country that gives up fewer units of {g[1]}"], [f"names {high}", "uses the larger total output as the reason"])], ["1.3"]),
        prt("C", f"Draw a correctly labeled production possibilities curve for Country A, with {g[0]} on the horizontal axis, and label both intercepts. Then show the effect of a technological advance that doubles the output of {g[1]} only, by drawing and labeling the new curve.", 2, "draw", ["4.A", "4.C"], f"A straight-line PPC with intercepts {a[0]} and {a[1]}, and a new curve with the {g[1]}-axis intercept doubled to {2 * a[1]}, the other intercept unchanged.",
            [fr("C1", 1, "Original PPC with intercepts", [f"Draws a downward-sloping straight-line PPC with {g[0]} on the horizontal axis and {g[1]} on the vertical axis, labeled with the intercepts {a[0]} and {a[1]}"], ["axes may be reversed if labeled consistently with the intercepts"], ["draws a bowed PPC with unlabeled intercepts", "omits the axis labels"]),
             fr("C2", 1, "New PPC pivots outward", [f"Draws a new PPC with the {g[1]} intercept doubled and the {g[0]} intercept unchanged, and labels it"], ["pivoting outward on one axis only"], ["shifts both intercepts equally", "shifts the curve inward"])], ["1.2"]),
        prt("D", "Explain how both countries can gain from trade.", 1, "explain", ["2.A"], f"Each country specializes in the good for which it has the comparative advantage and trades at a price between the two opportunity costs, so each can consume combinations outside its own PPC.",
            [fr("D1", 1, "Specialization and trade raise consumption", ["Explains that each country specializes in the good with the lower opportunity cost and trades, so each can consume beyond its own production possibilities"], ["terms of trade between the two opportunity costs", "total output rises with specialization"], ["says one country gains only if the other loses", "says only the country with an absolute advantage gains"])], ["1.3"]),
    ]
    pk = {"archetype": "maf_short_ppc_trade", "template": "short_ppc_trade", "topic": "1.3", "extra_topics": ["1.2"], "skill": "1.C", "calculator": "allowed", "title": "Comparative advantage and the PPC", "stimulus": stim, "parts": parts, "total_points": 5, "est_minutes": 12,
          "facts": [f"a={a}", f"b={b}", f"oa={float(oa):.4f}", f"ob={float(ob):.4f}", f"low={low}"], "context": "ppc_trade"}
    return finish(pk, "Opportunity cost, comparative advantage, a PPC, and gains from trade", ["Compute opportunity cost from the table", "Compare opportunity costs and draw a PPC with growth in one good", "Explain mutual gains"],
                  [("Straight-line PPCs from the table's maximum outputs", "stated in the table description")], {"type": "table", "must_include": ["maximum daily output"]},
                  "exact ratios versus the reciprocal opportunity cost of the other good",
                  mdl(f"two countries with outputs {a} and {b}", ["technology advance in one good"], ["resources"], ["opportunity costs", "comparative advantage", "PPC pivot"], "ppc-trade"))


# ======================= S3 대부자금시장과 구축효과 (짧은, 5점) =======================
def maf_short_lf_crowding(rng):
    c = rng.choice(["Elvaria", "Norland", "Tessoria", "Bayland"])
    stim = info(f"Situation in {c}.", [["Economy", "Closed to international financial flows"], ["Government budget", "A deficit that the government plans to increase by borrowing from private savers"]])
    parts = [
        prt("A", f"Draw a correctly labeled graph of the loanable funds market in {c}, labeling the equilibrium real interest rate r1. Then show the effect of the government's increased borrowing on your graph and label the new real interest rate r2.", 2, "draw", ["4.A", "4.C"], "Downward-sloping demand and upward-sloping supply of loanable funds with the real interest rate on the vertical axis; demand shifts right and the new real interest rate r2 is above r1.",
            [fr("A1", 1, "Loanable funds graph labeled", ["Draws a downward-sloping demand curve and an upward-sloping supply curve for loanable funds, labels the vertical axis the real interest rate and the horizontal axis the quantity of loanable funds, and labels the equilibrium real interest rate r1"], ["curves may be labeled D and S", "axis may say interest rate or price of loanable funds"], ["labels the vertical axis as the nominal interest rate", "draws the supply curve downward sloping"]),
             fr("A2", 1, "Demand shifts right; r2 higher", ["Shifts the demand curve for loanable funds to the right and labels a new real interest rate r2 above r1"], ["draws and labels D2", "dashed line to r2 at the new intersection"], ["shifts the supply curve to the right", "labels r2 below r1"], requires="A1")], ["4.7", "5.5"]),
        prt("B", "Identify the effect of the government's increased borrowing on private investment spending, and explain.", 2, "explain", ["3.B"], "Private investment spending decreases (crowding out), because the higher real interest rate makes borrowing more expensive and fewer investment projects are profitable.",
            [fr("B1", 1, "Private investment decreases", ["States that private investment spending decreases (crowding out)"], ["private investment falls"], ["says private investment increases", "says investment is unchanged"]),
             fr("B2", 1, "Higher real rate reduces investment", ["Explains that the higher real interest rate raises the cost of borrowing, so firms undertake less investment"], ["fewer projects have returns above the cost of funds"], ["says the lower real interest rate reduces investment", "says firms have less income"], requires="B1")], ["5.5"]),
        prt("C", "Explain how this change in private investment affects the economy's long-run growth.", 1, "explain", ["2.A"], "Less private investment slows the growth of the capital stock, so potential output and long-run aggregate supply grow more slowly.",
            [fr("C1", 1, "Slower capital accumulation lowers growth", ["Explains that lower investment reduces the growth of the capital stock, so long-run aggregate supply (potential output) grows more slowly"], ["a smaller capital stock lowers productivity growth"], ["says long-run growth is unaffected by investment", "says growth speeds up"])], ["5.6"]),
    ]
    pk = {"archetype": "maf_short_lf_crowding", "template": "short_lf_crowding", "topic": "5.5", "extra_topics": ["4.7", "5.6"], "skill": "4.C", "calculator": "na", "title": "Government borrowing and crowding out", "stimulus": stim, "parts": parts, "total_points": 5, "est_minutes": 12,
          "facts": [f"country={c}"], "context": "lf_crowding"}
    return finish(pk, "Government borrowing in the loanable funds market: real interest rate, crowding out, and long-run growth", ["Draw the market and show the demand shift", "Identify and explain the effect on private investment", "Link investment to long-run growth"],
                  [("Closed economy so only domestic saving supplies loanable funds", "stated in the stimulus")], {"type": "table", "must_include": ["economy", "government budget"]},
                  "loanable funds equilibrium simulation: demand shift raises the rate and lowers private funds",
                  mdl("closed economy loanable funds market in equilibrium", ["government deficit borrowing increases"], ["saving behavior"], ["r rises", "private investment falls", "growth slows"], "lf-crowding"))


# ======================= S4 은행과 화폐공급 (짧은, 5점) =======================
def maf_short_money_banking(rng):
    for _ in forever():
        rr = rng.choice([Fr(1, 10), Fr(1, 5), Fr(1, 4)]); dep = rng.choice([400, 500, 800, 1000]); res = int(dep * rr) + rng.choice([40, 60, 100]); loans = dep - res
        if loans > 0:
            break
    req = dep * rr; exc = res - req; maxm = exc / rr
    agree(float(exc), float(sp.Integer(res) - sp.Integer(dep) * sp.Rational(rr.numerator, rr.denominator)), 1e-9, "exc")
    c = rng.choice(["Wellmark", "Dunmere", "Lorvia"])
    stim = tbl(f"Balance sheet of the banking system of {c}, a limited-reserves economy (millions of dollars).", ["Assets", "Amount", "Liabilities", "Amount"], [["Reserves", usd(res), "Checkable deposits", usd(dep)], ["Loans", usd(loans), "Total liabilities", usd(dep)]], notes=[f"The required reserve ratio is {nm(float(rr) * 100, 1)} percent."])
    parts = [
        prt("A", "Using the balance sheet, calculate the required reserves of the banking system and show your work.", 1, "calculate", ["3.C"], f"Required reserves = {nm(float(rr), 3)} x {dep} = {nm(float(req), 1)} million.",
            [fr("A1", 1, "Required reserves (answer)", ["Multiplies checkable deposits by the required reserve ratio (the required reserves answer is correct)", nm(float(req), 1)], ["reserve ratio times deposits"], ["divides deposits by the reserve ratio", "reports total reserves"], nums=True)], ["4.4"]),
        prt("B", "Calculate the excess reserves of the banking system and show your work.", 1, "calculate", ["3.C"], f"Excess reserves = {res} - {nm(float(req), 1)} = {nm(float(exc), 1)} million.",
            [fr("B1", 1, "Excess reserves (answer)", ["Subtracts required reserves from total reserves (the excess reserves answer is correct)", nm(float(exc), 1)], ["total reserves minus required reserves"], ["reports total reserves", "reports required reserves"], nums=True)], ["4.4"]),
        prt("C", "Assuming banks lend out all excess reserves and the public holds no currency, calculate the maximum possible increase in the money supply and show your work.", 1, "calculate", ["3.C"], f"The multiplier is 1/{nm(float(rr), 3)} = {nm(float(1 / rr), 2)}, so the maximum increase is {nm(float(exc), 1)} x {nm(float(1 / rr), 2)} = {nm(float(maxm), 1)} million.",
            [fr("C1", 1, "Maximum increase in the money supply (answer)", ["Multiplies excess reserves by the money multiplier 1/rr (the maximum increase answer is correct)", nm(float(maxm), 1)], ["excess reserves divided by the reserve ratio"], ["reports excess reserves only", "multiplies by the reserve ratio"], nums=True)], ["4.4"]),
        prt("D", "Explain why the actual increase in the money supply is likely to be smaller than the amount you calculated in part (C).", 1, "explain", ["1.D"], "Banks may choose to hold some excess reserves and the public may hold some of its money as currency, which reduces lending and deposit creation.",
            [fr("D1", 1, "Leakages reduce the multiplier", ["Explains that banks may hold excess reserves or the public may hold currency instead of deposits, so less is lent and deposited at each round"], ["currency held by the public", "banks' desire to hold extra reserves"], ["says banks lend required reserves", "says the central bank removes deposits"])], ["4.4"]),
        prt("E", "The central bank wants to increase the money supply in this economy through an open-market operation. Identify the open-market action it should take.", 1, "identify", ["2.A"], "Buy government bonds (an open-market purchase).",
            [fr("E1", 1, "Open-market purchase", ["States that the central bank should buy government bonds in the open market"], ["an open-market purchase increases reserves"], ["says the central bank should sell bonds", "names a fiscal policy action"])], ["4.6"]),
    ]
    pk = {"archetype": "maf_short_money_banking", "template": "short_money_banking", "topic": "4.4", "extra_topics": ["4.6"], "skill": "3.C", "calculator": "allowed", "title": "Bank reserves and the money supply", "stimulus": stim, "parts": parts, "total_points": 5, "est_minutes": 12,
          "facts": [f"rr={float(rr):.4f}", f"dep={dep}", f"res={res}", f"loans={loans}", f"req={float(req):.2f}", f"exc={float(exc):.2f}", f"maxm={float(maxm):.2f}", f"country={c}"], "context": "money_banking"}
    return finish(pk, "Required and excess reserves, the money multiplier, leakages, and open-market purchases", ["Compute required and excess reserves", "Compute the maximum money creation", "Explain why actual expansion is smaller and name the tool"],
                  [("Required reserve ratio stated in the table notes", "stated in the table notes")], {"type": "table", "must_include": ["reserves", "checkable deposits", "required reserve ratio"]},
                  "exact fractions versus sympy rationals",
                  mdl(f"banking system with deposits {dep}, reserves {res}, reserve ratio {float(rr):.2f}", ["lending of excess reserves"], ["no currency drain"], ["required reserves", "excess reserves", "multiplier expansion"], "money-banking"))


# ======================= S5 필립스 곡선 (짧은, 5점) =======================
def maf_short_phillips(rng):
    nat = rng.choice([4, 5, 6]); ei = rng.choice([2, 3])
    c = rng.choice(["Aldoria", "Pelland", "Syrenia"])
    stim = info(f"The economy of {c} is initially in long-run equilibrium.", [["Natural rate of unemployment", f"{nat} percent"], ["Expected inflation rate", f"{ei} percent"], ["Actual inflation rate", f"{ei} percent"]])
    parts = [
        prt("A", f"Draw a correctly labeled graph of the short-run Phillips curve (SRPC) and the long-run Phillips curve (LRPC) for {c}, and label the initial long-run equilibrium point.", 2, "draw", ["4.A"], f"A downward-sloping SRPC and a vertical LRPC at the natural rate of {nat} percent, with the inflation rate on the vertical axis and the unemployment rate on the horizontal axis; the SRPC and LRPC intersect at the initial equilibrium ({nat}, {ei}).",
            [fr("A1", 1, "Axes and curves", ["Draws a downward-sloping short-run Phillips curve and a vertical long-run Phillips curve, with the inflation rate on the vertical axis and the unemployment rate on the horizontal axis, all labeled"], ["curves may be labeled SRPC and LRPC"], ["draws the LRPC horizontal or downward sloping", "swaps the axes without labels"]),
             fr("A2", 1, "Equilibrium on both curves at the natural rate", [f"Labels the LRPC at the natural rate of unemployment ({nat} percent) and marks the initial equilibrium where the SRPC meets the LRPC at the expected inflation rate"], ["dashed lines to both axes", "the natural rate labeled on the horizontal axis"], ["places the SRPC intersection away from the LRPC", "omits the natural rate label"], requires="A1")], ["5.2"]),
        prt("B", "Assume that workers and firms come to expect a higher inflation rate. On your graph, show the effect on the short-run Phillips curve by drawing and labeling the new curve SRPC2.", 1, "draw", ["4.C"], "The SRPC shifts upward (to the right) to SRPC2.",
            [fr("B1", 1, "SRPC shifts up and right", ["Draws a new short-run Phillips curve SRPC2 above (to the right of) the original curve"], ["an arrow showing the upward shift"], ["shifts the LRPC", "draws SRPC2 below the original curve"])], ["5.2"]),
        prt("C", "Identify the effect of the higher expected inflation on the economy's unemployment rate in the long run, and explain why the short-run Phillips curve shifts when expected inflation rises.", 2, "explain", ["3.A", "2.A"], "Long-run unemployment is the natural rate. Workers and firms build the higher expected inflation into wages and prices, so actual inflation is higher at every unemployment rate.",
            [fr("C1", 1, "Unemployment at the natural rate", ["States that long-run unemployment is the natural rate (it does not change)"], ["no long-run trade-off between inflation and unemployment"], ["says unemployment falls permanently", "says unemployment rises permanently"]),
             fr("C2", 1, "Expectations raise inflation at each unemployment rate", ["Explains that higher expected inflation is built into wage and price setting, so actual inflation is higher at every unemployment rate"], ["wages and prices rise faster because people expect inflation"], ["says higher expected inflation lowers the natural rate", "says the economy moves along the same curve"])], ["5.2"]),
    ]
    pk = {"archetype": "maf_short_phillips", "template": "short_phillips", "topic": "5.2", "extra_topics": [], "skill": "4.A", "calculator": "na", "title": "Expectations and the Phillips curve", "stimulus": stim, "parts": parts, "total_points": 5, "est_minutes": 12,
          "facts": [f"nat={nat}", f"ei={ei}", f"country={c}"], "context": "phillips"}
    return finish(pk, "Short-run and long-run Phillips curves and a shift from higher expected inflation", ["Draw SRPC and LRPC with the natural rate", "Show the shift for higher expected inflation", "Explain the long-run result and the reason"],
                  [("Initial long-run equilibrium at the natural rate with expected equal to actual inflation", "stated in the stimulus table")], {"type": "table", "must_include": ["natural rate of unemployment", "expected inflation rate"]},
                  "fixed rule table of Phillips curve shifts consistent with the AD-AS supply and demand rules",
                  mdl("long-run equilibrium with expected inflation equal to actual inflation", ["expected inflation rises"], ["natural rate"], ["SRPC shifts up", "LRPC unchanged"], "phillips-expectations"))


# ======================= S6 승수와 재정정책 (짧은, 5점) =======================
def maf_short_fiscal_multiplier(rng):
    mpc = rng.choice([Fr(1, 2), Fr(3, 5), Fr(3, 4), Fr(4, 5)]); dg = rng.choice([20, 40, 50, 100])
    sm = 1 / (1 - mpc); tm = mpc / (1 - mpc)
    dy = dg * sm
    agree(float(sm), float(1 / (1 - sp.Rational(mpc.numerator, mpc.denominator))), 1e-9, "sm")
    c = rng.choice(["Hamlen", "Dorrin", "Varsha"])
    stim = info(f"Data for {c}, which has a recessionary gap.", [["Marginal propensity to consume", nm(float(mpc), 2)], ["Proposed increase in government purchases", usd(dg) + " billion"], ["Proposed tax cut (alternative)", usd(dg) + " billion"]],
                notes=["Assume the price level is constant and taxes are lump-sum."])
    parts = [
        prt("A", "Using the data in the table, calculate the spending multiplier and show your work.", 1, "calculate", ["3.C"], f"Spending multiplier = 1/(1 - {nm(float(mpc), 2)}) = {nm(float(sm), 2)}.",
            [fr("A1", 1, "Spending multiplier (answer)", ["Calculates one divided by (1 minus the MPC) (the multiplier answer is correct)", nm(float(sm), 2)], ["1/MPS"], ["uses 1/MPC", "uses MPC/(1 - MPC)"], nums=True)], ["3.2"]),
        prt("B", "Calculate the maximum change in real GDP from the proposed increase in government purchases and show your work.", 1, "calculate", ["3.C"], f"{dg} x {nm(float(sm), 2)} = {nm(float(dy), 1)} billion.",
            [fr("B1", 1, "Change in real GDP (answer)", ["Multiplies the change in government purchases by the spending multiplier (the change in real GDP answer is correct)", nm(float(dy), 1)], ["purchases x multiplier"], ["reports the initial change in spending", "uses the tax multiplier"], nums=True, requires="A1")], ["3.2", "3.8"]),
        prt("C", "Would the tax cut of the same size, instead of the increase in government purchases, have a larger, smaller, or the same effect on real GDP? Identify.", 1, "identify", ["3.A"], "A smaller effect.",
            [fr("C1", 1, "Smaller effect", ["States that the tax cut has a smaller effect on real GDP than the same-sized increase in government purchases"], ["the tax multiplier is smaller than the spending multiplier"], ["says the tax cut has a larger effect", "says the effects are the same"])], ["3.2"]),
        prt("D", "Explain your answer to part (C).", 1, "explain", ["2.A"], "A tax cut first raises disposable income, and households spend only the fraction MPC of it, so the first round of spending is smaller than the full amount of government purchases.",
            [fr("D1", 1, "Only the MPC share is spent", ["Explains that part of a tax cut is saved, so the first-round increase in spending is less than the full tax cut, while government purchases add the full amount"], ["households save part of the tax cut", "the first round is MPC times the tax cut"], ["says a tax cut reduces consumption", "says government purchases are not part of aggregate demand"])], ["3.2"]),
        prt("E", "Explain how automatic stabilizers affect the government's budget during a recession.", 1, "explain", ["1.A"], "Tax revenues fall and transfer payments such as unemployment benefits rise automatically, which moves the budget toward a deficit and cushions the fall in aggregate demand.",
            [fr("E1", 1, "Budget moves toward deficit", ["Explains that tax revenues fall and transfer payments rise automatically in a recession, moving the budget toward a deficit"], ["progressive taxes collect less and transfers increase"], ["says tax revenues rise in a recession", "says the budget moves toward a surplus"])], ["3.9"]),
    ]
    pk = {"archetype": "maf_short_fiscal_multiplier", "template": "short_fiscal_multiplier", "topic": "3.2", "extra_topics": ["3.8", "3.9"], "skill": "3.C", "calculator": "allowed", "title": "Multipliers and fiscal policy", "stimulus": stim, "parts": parts, "total_points": 5, "est_minutes": 12,
          "facts": [f"mpc={float(mpc):.4f}", f"dg={dg}", f"sm={float(sm):.4f}", f"dy={float(dy):.4f}", f"country={c}"], "context": "fiscal_multiplier"}
    return finish(pk, "Spending multiplier, tax versus spending effects, and automatic stabilizers", ["Compute the multiplier and the output effect", "Compare spending and tax changes with a reason", "Explain automatic stabilizers"],
                  [("Price level constant and lump-sum taxes stated in the table notes", "stated in the stimulus notes")], {"type": "table", "must_include": ["marginal propensity to consume", "government purchases"]},
                  "exact fractions versus sympy rationals",
                  mdl(f"economy with MPC {float(mpc):.2f}", [f"government purchases rise by {dg} billion"], ["price level"], ["multiplier", "output effect", "tax versus spending"], "fiscal-multiplier"))


# ======================= S7 환율과 총수요 (짧은, 5점) =======================
def maf_short_fx_trade(rng):
    c = rng.choice(["Zandor", "Ketland", "Moravia"]); cur = rng.choice(["zan", "ket", "mor"])
    stim = info(f"Situation in {c}, which has a floating exchange rate.", [["Event", f"The central bank of {c} lowers its administered interest rates, so interest rates in {c} fall relative to rates in other countries"], ["Currency", f"The {cur}"]])
    parts = [
        prt("A", f"Draw a correctly labeled graph of the foreign exchange market for the {cur}, showing the initial equilibrium exchange rate labeled ER1.", 1, "draw", ["4.A"], f"Downward-sloping demand for the {cur} and upward-sloping supply of the {cur}, with the exchange rate on the vertical axis and the quantity of {cur} on the horizontal axis, intersecting at ER1.",
            [fr("A1", 1, "Currency market labeled", [f"Draws a downward-sloping demand curve and an upward-sloping supply curve for the {cur}, labels the vertical axis as the exchange rate (foreign currency per {cur}) and the horizontal axis as the quantity of {cur}, and labels the equilibrium exchange rate ER1"], ["curves may be labeled D and S"], ["labels the vertical axis as the price level", "omits ER1"])], ["6.3"]),
        prt("B", f"On your graph, show the effect of the lower interest rates in {c} on the market for the {cur}, and label the new exchange rate ER2.", 1, "draw", ["4.C"], f"Demand for the {cur} shifts to the left (or supply shifts to the right) because investors want fewer {cur}-denominated assets, and ER2 is below ER1.",
            [fr("B1", 1, "Shift and lower exchange rate", [f"Shifts the demand for the {cur} to the left or the supply of the {cur} to the right and labels a new exchange rate ER2 below ER1"], ["either a leftward demand shift or a rightward supply shift is accepted"], ["shifts demand to the right", "labels ER2 above ER1"])], ["6.4"]),
        prt("C", f"Identify the effect of the lower interest rates on the value of the {cur}.", 1, "identify", ["3.B"], f"The {cur} depreciates.",
            [fr("C1", 1, "Currency depreciates", [f"States that the {cur} depreciates (loses value)"], ["the exchange rate falls"], [f"says the {cur} appreciates", "says there is no effect"])], ["6.4"]),
        prt("D", "Explain why the lower interest rates change the demand for or supply of the currency in the way you showed in part (B).", 1, "explain", ["3.B"], "Lower interest rates make the country's financial assets less attractive, so foreign investors demand less of the currency and domestic investors supply more of it to buy foreign assets.",
            [fr("D1", 1, "Lower returns reduce net capital inflows", ["Explains that lower interest rates reduce the return on the country's financial assets, so net financial capital inflows fall (or outflows rise)"], ["investors move funds to higher-yielding foreign assets"], ["says lower interest rates attract more foreign investment", "says lower rates raise the demand for the currency"])], ["6.6"]),
        prt("E", "Explain the effect of the change in the value of the currency on the country's net exports and real GDP in the short run.", 1, "explain", ["3.B"], "The depreciation makes exports cheaper abroad and imports costlier, so net exports increase, aggregate demand shifts to the right, and real GDP increases.",
            [fr("E1", 1, "Net exports and AD rise", ["Explains that the depreciation raises net exports, which increases aggregate demand and real GDP"], ["exports become cheaper for foreigners", "imports become more expensive"], ["says net exports fall", "says real GDP falls"])], ["6.5"]),
    ]
    pk = {"archetype": "maf_short_fx_trade", "template": "short_fx_trade", "topic": "6.4", "extra_topics": ["6.3", "6.5", "6.6"], "skill": "4.C", "calculator": "na", "title": "Lower interest rates and the exchange rate", "stimulus": stim, "parts": parts, "total_points": 5, "est_minutes": 12,
          "facts": [f"country={c}", f"cur={cur}"], "context": "fx_trade"}
    return finish(pk, "Lower interest rates: currency market, depreciation, net exports, and real GDP", ["Draw the currency market and show the shift", "State the exchange-rate effect and explain the capital flows", "Explain net exports and real GDP"],
                  [("Floating exchange rate with lower relative interest rates", "stated in the stimulus table")], {"type": "table", "must_include": ["Event", "Currency"]},
                  "direction of the exchange rate from a linear currency-market simulation; net exports opposite to currency value",
                  mdl("floating-rate economy with lower relative interest rates", ["interest rates fall"], ["foreign interest rates"], ["capital outflows", "depreciation", "net exports rise"], "fx-interest"))
