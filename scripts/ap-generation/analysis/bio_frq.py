"""Bio FRQ 병목 분석(런1: 76 후보 → 3 통과). 반려 원인을 근거 유형별로 분해한다. 사용: python3 bio_frq.py > docs/ap/bio-frq-bottleneck.md"""
import json, re, collections
c = json.load(open("data/ap/sample-2027/run1/candidates.json"))
bf = [x for x in c if x["apSubjectCode"] == "ap_biology" and x["kind"] != "mc"]
rej = [x for x in bf if x["rejectionReason"]]; ok = [x for x in bf if not x["rejectionReason"]]
def notes(x, crits=None):
    r = x["review"] if isinstance(x["review"], dict) else {}
    return [(k, v["notes"]) for k, v in r.items() if isinstance(v, dict) and "pass" in v and not v["pass"] and (crits is None or k in crits)]
def has(x, rx): return any(re.search(rx, n, re.I) for _, n in notes(x))
DET = r"numeric_check_failed|verification_error|verification_no_checks|no_parts|no_rubric|total_points|unknown_skill|rubric_sum"
det = [x for x in rej if re.search(DET, x["rejectionReason"])]
sol = [x for x in rej if x not in det and "solver_disagrees" in x["rejectionReason"]]
rest = [x for x in rej if x not in det and x not in sol]
patterns = {
 "rubric bundles several asks/calculations into one point (scoring unclear)": r"packs two|double ask|two (tasks|calculations)|multiple elements|requires_both|bundled in|bundles (two|several|multiple)|bundle[sd]? [^.]{0,40}(1 point|one point)|in (1|one) point",
 "tolerance / alternative answers inconsistent with the key": r"tolerance|alternative|conflicts? with the .*key|accepts (both|opposite)|model answer .*(garbled|incoherent)|not unique",
 "metadata inconsistency (calculator flag, garbled verification field)": r"calculator|metadata|garbled|truncated",
 "stimulus lacks data needed for a claim/prediction (design flaw)": r"no (treatment|ants|data)|cannot be (checked|answered)|not .*supported by the (table|data)|prediction is already given|stimulus has no",
 "per-part skill mislabel (one bundle-level primary skill vs parts of different skills)": r"tagged|mislabel|only part|only \(?[a-d]\)?|other practices",
 "topic drift (parts belong to another unit/topic)": r"drift|different (unit|topic)|loosely|thin|link to .* (loose|thin)|fabricated",
 "time/point-grain critique (long/overloaded/fragmentary)": r"22 minutes|too long|overloaded|fragmentary|four 1-point|point allocation|coarse|unbalanced|minutes for|trivial",
}
counts = {k: sum(1 for x in rej if has(x, rx)) for k, rx in patterns.items()}
only_rev = [x for x in rest if not has(x, r"not unique|garbled|contradict|incorrect|wrong|inconsistent|tolerance|conflict")]
by_cell = collections.Counter(x["cellId"] for x in bf); pass_cell = collections.Counter(x["cellId"] for x in ok)
def ex(rx, n=2):
    out = []
    for x in rej:
        for k, t in notes(x):
            if re.search(rx, t, re.I): out.append(f"`{x['candidateKey']}` ({k}): {t[:210]}"); break
        if len(out) >= n: break
    return out
L = []
L += ["# Biology FRQ 병목 분석 (런1: 후보 %d → 통과 %d)" % (len(bf), len(ok)), "", "생성 전에 원인을 먼저 가른다(오너 지시). 분석은 **근거 유형**으로 나눈다: (A) 코드·독립 풀이로 확인된 생성기 오류, (B) 검토기(LLM) 의견만 있는 항목 — 이 중 공식 패턴과 충돌하는 것은 '검토기 오류 의심', 스키마·구조와 어긋나는 것은 '구조 불일치'. 분류는 정규식 휴리스틱이며 B 영역은 사람의 표본 확인이 필요하다.", ""]
L += ["## 1. 칸별", "", "| 칸 | 템플릿 | 후보 | 통과 |", "|---|---|---|---|"]
tpl = {"ap_biology-f01": "긴 문항: 실험 해석 + 그래프(4.A)", "ap_biology-f02": "긴 문항: 실험 해석(6.B)", "ap_biology-f03": "짧은 문항: 과학적 탐구(3.C, 4×1점)", "ap_biology-f04": "짧은 문항: 모델·시각(2.B, 4×1점)"}
for k in sorted(by_cell): L.append(f"| {k} | {tpl.get(k,'')} | {by_cell[k]} | {pass_cell.get(k,0)} |")
L += ["", "## 2. 근거 유형별 분해(반려 %d건)" % len(rej), "", "| 유형 | 건수 | 비고 |", "|---|---|---|",
      f"| (A1) 코드 결정적 검증 실패(수치·루브릭 구조·검증 코드 오류) | {len(det)} | 생성기 오류(확정) |",
      f"| (A2) 독립 풀이(Opus)가 불일치·결함 지적(A1 제외) | {len(sol)} | 키·조건 불명확(생성기 오류 가능성 높음) |",
      f"| (B) 검토기 의견만(위 제외) | {len(rest)} | 아래 내용별 세분 |", ""]
L += ["### (B)+전체의 지적 내용별 건수(중복 집계, 반려 전체 기준)", "", "| 지적 내용 | 건수 | 판정 |", "|---|---|---|"]
judg = {"rubric bundles": "생성기 오류(루브릭 설계)", "tolerance": "생성기 오류(키/허용 답 불일치)", "metadata": "생성기 오류(메타데이터) — 결정적 게이트로 막을 수 있음", "stimulus lacks": "생성기 오류(자료 설계)", "per-part": "**구조 불일치** — 우리 스키마는 번들당 주 스킬 1개, 공식 FRQ는 파트별 스킬이 다름", "topic drift": "구조 불일치/생성 지시 미준수", "time/point": "**검토기 오류 의심** — 공식 Bio 짧은 문항은 정확히 4×1점, 긴 문항은 9점·약 20분"}
for k, v in counts.items():
    j = next((jj for kk, jj in judg.items() if k.startswith(kk)), "")
    L.append(f"| {k} | {v} | {j} |")
L += ["", f"- 반려이면서 코드·독립 풀이 근거가 없고 검토기만 지적한 항목: **{len(rest)}건**, 그중 생성기 결함 키워드(불일치·모순·garbled 등)가 없는 순수 의견: {len(only_rev)}건.", ""]
L += ["## 3. 예시", ""]
for title, rx in [("루브릭 설계 오류(1점에 여러 질문)", r"packs two|double ask|multiple elements|in (1|one) point"), ("허용 답/키 불일치", r"tolerance|conflicts? with|accepts (both|opposite)|not unique"), ("메타데이터 불일치", r"calculator.*(na|conflict)|garbled|truncated"), ("파트별 스킬 오표기(구조 불일치)", r"tagged|mislabel|only part"), ("시간·점수 입자 비판(검토기 오류 의심)", r"22 minutes|fragmentary|four 1-point|too long")]:
    L.append(f"**{title}**")
    L += [f"- {e}" for e in ex(rx)]
    L.append("")
L += ["## 4. 원인 → 조치(대량 생성 전)", "",
 "1. **생성기**: LLM이 루브릭·키·표를 모두 설계했다 → 코드 우선 원형으로 전환(`frq_bio_investigation`: 설계표·평균·±2SE 겹침을 코드가 계산, 파트 4×1점, 루브릭 행은 코드가 생성). 메타데이터 불일치(계산기 flag, 검증 코드 문구)는 코드 생성으로 소멸.",
 "2. **구조**: 번들 단일 `skill` 필드를 파트별 스킬 보유 구조로 바꾸고 검토 기준을 '번들의 지배 스킬'로 명시(Calc 가이드에는 이미 반영, Bio 가이드 필요). 데이터 모델의 `ap_frq_parts.skill_codes[]`는 이미 파트별 스킬을 지원한다.",
 "3. **검토기**: Bio 참조 패턴(긴 9점 = A1/B3~4/C2~3/D2, 짧은 4×1점, 약 8~20분, 수식·표 제공)을 프롬프트에 넣어 시간·점수 입자 비판을 정정. 순수 의견 항목은 사람 표본 확인으로 오탐률을 측정.",
 "4. **결정적 게이트 추가**(무료): 파트 루브릭 '한 점에 한 요소' 규칙(`required_elements` 수), 허용 답과 키의 수치 일치, 계산기 flag·검증 필드 형식.",
 "5. 위 수정 전에는 Bio FRQ를 추가 생성하지 않는다(현재 통과율 3/76 = 4%)."]
print("\n".join(L))
