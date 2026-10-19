#!/usr/bin/env python3
"""AP 외부 검수(2026-10-15) 유형 단위 결함 전수 목록(로컬 파일만, DB·네트워크 없음, 재고 파일은 읽기만 한다).
  python3 scripts/audit/ap-type-defect-scan.py [--write]

검수가 "해당 문항만 고쳐졌고 같은 생성기 결함이 다른 문항에 남아 있다"고 지적한 유형을 원형(archetype) 단위로 찾는다.
  1) 재고: data/ap/stock/*items.json 의 모든 후보(같은 stockKey 는 한 번만)
  2) 공개 구성: 정확 배정(exact-assign-*) + 이미 만들어진 교체안(*swap-plan*)을 순서대로 적용해 재구성(PH1·PH2 는 PH3·PH4 로 대체되어 미공개)
  3) 각 결함 유형(탐지 규칙)마다 재고·공개·이미 교체안으로 덮인 문항을 센다
출력: data/audit/ap-type-defect-scan-20261019.json (--write). 원형 코드의 같은 규칙은 scripts/ap-generation/archetypes/frq_visible.py 와 test_audit_1019.py 가 지킨다.
"""
import collections
import glob
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
STOCK = os.path.join(ROOT, "data", "ap", "stock") + os.sep
sys.path.insert(0, os.path.join(ROOT, "scripts", "ap-generation", "archetypes"))
import frq_visible as FV  # noqa: E402

UNPUBLISHED_SETS = {"PH1", "PH2"}  # PH3·PH4 가 대체(docs/ap/status-latest.md Physics 1 절)
ASSIGN_ORDER = [
    "exact-assign-bio-bi1-bi2.json", "exact-assign-bio-bi1-bi2-v2.json", "exact-assign-bio-bi1-bi2-v3.json", "exact-assign-bio-bi1-bi2-v4.json",
    "exact-assign-chem-ch1-ch2.json", "exact-assign-csa-cs1-cs2.json", "exact-assign-el-el1-el2.json", "exact-assign-el-el1.json", "exact-assign-el-long-el1-el2.json", "exact-assign-englit-lt1-lt2.json",
    "exact-assign-macro-ma1-ma2.json", "exact-assign-macro-ma1-ma2-v3.json", "exact-assign-micro-mi1-mi2.json", "exact-assign-phys-ph1-ph2.json", "exact-assign-phys-ph3-ph4.json",
    "exact-assign-psych-ps1-ps2.json", "exact-assign-psych-ps1-ps2-v3.json", "exact-assign-stats-st1-s2b.json", "exact-assign-stats-st2-s3b.json", "exact-assign-ushistory-us1-us2.json", "exact-assign-worldhistory-wh1-wh2.json",
]


def rd(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def load_pool():
    pool = {}
    for f in sorted(glob.glob(STOCK + "*items.json")):
        try:
            d = rd(f)
        except Exception:
            continue
        if not isinstance(d, list):
            continue
        for r in d:
            if isinstance(r, dict) and "stockKey" in r and r["stockKey"] not in pool:
                r["_file"] = os.path.basename(f)
                pool[r["stockKey"]] = r
    return pool


def load_plans(drop=None):
    """drop: 이 정규식에 맞는 교체안 파일은 적용하지 않는다(단계별 공개 구성 비교용: --drop-plans '1015|1019')."""
    plans = collections.defaultdict(list)
    for f in glob.glob(STOCK + "*swap-plan*.json"):
        if drop and re.search(drop, os.path.basename(f)):
            continue
        d = rd(f)
        if d.get("swaps"):
            plans[d["set"]].append((d.get("sourceVersionNo", 0), os.path.basename(f), d))
    return plans


def compose_all(plans, only_before=None):
    """공개 구성 재구성. only_before: 이 이름의 교체안(과 그 뒤)을 적용하지 않는다(교체 전 구성 확인용)."""
    base = {}
    for f in ASSIGN_ORDER:
        for s in rd(STOCK + f)["sets"]:
            sid = {"CS1": "CSA1", "CS2": "CSA2"}.get(s["id"], s["id"])
            base[sid] = (f, {"mc": list(s["mcA"]) + list(s.get("mcB", [])), "frq": list(s["frqA"]) + list(s.get("frqB", []))})
    ab = rd(STOCK + "ab-full-set-selection.json")["keys"]
    base["AB1"] = ("ab-full-set-selection.json", {"mc": ab["mcA"] + ab["mcB"], "frq": ab["frqA"] + ab["frqB"]})
    for s in rd(STOCK + "exact-assign-5sets-cons.json")["sets"]:  # 미적분 5세트: 교체안은 이 구성을 기준으로 만들어졌다
        base[s["id"]] = ("exact-assign-5sets-cons.json", {"mc": list(s["mcA"]) + list(s["mcB"]), "frq": list(s["frqA"]) + list(s["frqB"])})
    comp, log = {}, []
    for sid, (f, c) in base.items():
        for _ver, pf, d in sorted(plans.get(sid, []), key=lambda x: (x[0], x[1])):
            if only_before and pf == only_before:
                break
            for w in d["swaps"]:
                lst = c["mc"] if w["section"] in ("ap_mc", "ap_mc_a", "ap_mc_b") else c["frq"]
                if w["removeKey"] in lst and w["addKey"] not in lst:
                    lst[lst.index(w["removeKey"])] = w["addKey"]
                    log.append((sid, pf, "applied", w["removeKey"], w["addKey"]))
                else:
                    log.append((sid, pf, "skipped", w["removeKey"], w["addKey"]))
        comp[sid] = (f, c)
    return comp, log


def arch(r):
    p = r["payload"]
    if not isinstance(p, dict):
        return r.get("archetype")
    if p.get("archetype"):
        return p["archetype"]
    its = p.get("items")
    if isinstance(its, list) and its and isinstance(its[0], dict) and its[0].get("archetype"):
        return its[0]["archetype"]
    return r.get("archetype")


def base_arch(a):
    return re.sub(r"-s\d+(-.*)?$", "", a or "")


def mc_items(p):
    its = p.get("items")
    return [i for i in its if isinstance(i, dict)] if isinstance(its, list) else [p]


def opt_text(o):
    return o if isinstance(o, str) else (o or {}).get("text", "")


# ------------------------------------------------------------------ 탐지 규칙(유형별)
def d_chisq_equiv_null(r):
    """한 문항의 보기에 동질성 귀무(분포 동일)와 독립성 귀무(독립)가 함께 있다(두 명제는 모집단에서 동치)."""
    if r["kind"] != "mc" or not isinstance(r["payload"], dict):
        return []
    out = []
    for it in mc_items(r["payload"]):
        t = [opt_text(o) for o in it.get("options") or []]
        hom = [x for x in t if re.search(r"distribution[^.;]*\b(is|are) the same|homogene", x, re.I) and not re.search(r"not the same|in the sample", x)]
        ind = [x for x in t if re.search(r"independent in the population", x)]
        if hom and ind and re.search(r"H_?0|null|hypothes", " ".join(t) + str(it.get("stem", "")), re.I):
            out.append("homogeneity_and_independence_nulls_both_offered")
    return out


def d_setup_hidden(r):
    """표·도식·통계 그림 자료의 description 에만 있는 주어진 값·실험 소개(학생 화면에 안 나온다)."""
    p = r["payload"]
    if not isinstance(p, dict) or r["kind"] not in ("mc", "frq_bundle"):
        return []
    return FV.hidden_setup(p, "mc" if r["kind"] == "mc" else "frq")


def d_title_truncated(r):
    p = r["payload"]
    if isinstance(p, dict) and r["kind"] == "frq_bundle" and FV.title_truncated(p):
        return ["title_cut_mid_sentence"]
    return []


def d_fork_direction(r):
    p = r["payload"]
    if not isinstance(p, dict) or base_arch(arch(r)) != "bif_q5_replication":
        return []
    a = str(p["parts"][0]["prompt"])
    return [] if "fork is moving" in a else ["fork_direction_not_in_student_text"]


def d_potato_solute(r):
    p = r["payload"]
    if not isinstance(p, dict) or r["kind"] != "frq_bundle":
        return []
    s = json.dumps(p)
    return ["solute_potential_greater"] if "solute potential, Ψ_S = -iCRT with i = 2) is greater" in s.replace("\\u03a8", "Ψ") or "solute potential, \\u03a8_S = -iCRT with i = 2) is greater" in s else []


def d_uv_unstated(r):
    p = r["payload"]
    if not isinstance(p, dict) or base_arch(arch(r)) != "bif_q3_uvbacteria":
        return []
    st = p.get("stimulus")
    txt = (st if isinstance(st, str) else json.dumps(st)) + json.dumps(p.get("parts"))
    return [] if "low enough" in txt else ["uv_dose_lethality_unstated"]


def d_population_stops(r):
    p = r["payload"]
    if not isinstance(p, dict) or r["kind"] != "mc":
        return []
    return ["stops_changing_but_table_still_changes"] if any("stops changing at the end of the table" in str(i.get("stem", "")) for i in mc_items(p)) else []


def d_phat_n(r):
    """표본비율 p-hat 이 정수 개수 / n 이 아니다(예: n=200 에서 .459)."""
    p = r["payload"]
    if not isinstance(p, dict) or r["apSubjectCode"] != "ap_statistics" or r["kind"] != "mc":
        return []
    out = []
    for it in mc_items(p):
        s = str(it.get("stem", ""))
        m = re.search(r"random sample of \$(\d+)\$[^.]*?(?:proportion|fraction)[^$.]*\$(0\.\d+)\$", s)
        if m:
            n, ph = int(m.group(1)), float(m.group(2))
            x = round(n * ph)
            if abs(round(x / n, len(m.group(2)) - 2) - ph) > 1e-9:
                out.append(f"p_hat_{ph}_is_not_count_over_n_{n}")
    return out


def d_collision_rounded(r):
    p = r["payload"]
    if not isinstance(p, dict) or base_arch(arch(r)) != "ph_evid_collision_data":
        return []
    f = {}
    for x in p.get("facts") or []:
        if isinstance(x, str) and "=" in x:
            k, v = x.split("=", 1)
            try:
                f[k] = float(v)
            except ValueError:
                pass
    bad = [k for k in ("u1", "u2") if k in f and abs(f[k] - float(f"{f[k]:.3g}")) > 1e-9]
    return [f"displayed_{k}_rounded" for k in bad]


def d_calc_smooth(r):
    """'모든 차수의 도함수가 존재' 라면서 꺾은선(선분) 도함수 그래프를 준다 / 선분 그래프에 '미분 가능한 함수' 전제."""
    p = r["payload"]
    if not isinstance(p, dict) or r["kind"] != "mc" or r["apSubjectCode"] not in ("ap_calculus_ab", "ap_calculus_bc"):
        return []
    out = []
    for it in mc_items(p):
        s = str(it.get("stem", "")) + " " + str(p.get("set_intro", ""))
        if re.search(r"derivatives of all orders", s) and re.search(r"line segments", s):
            out.append("all_order_derivatives_with_piecewise_linear_graph")
        if re.search(r"graphs of the differentiable functions", s) and re.search(r"line segments", s):
            out.append("differentiable_premise_with_segment_graphs")
    return out


def d_calc_concavity(r):
    p = r["payload"]
    if not isinstance(p, dict) or r["kind"] != "frq_bundle":
        return []
    s = json.dumps(p)
    return ["f_prime_increasing_equated_with_strict_f_double_prime_positive"] if "Reason: f' is increasing (so f'' > 0) on those intervals" in s else []


def d_csa_scope(r):
    p = r["payload"]
    if not isinstance(p, dict) or r["apSubjectCode"] != "ap_computer_science_a":
        return []
    a = base_arch(arch(r))
    out = []
    code = json.dumps(p.get("stimulus"))
    if a == "cs_char_arith" and re.search(r"\bchar\b", code):
        out.append("char_arithmetic_out_of_scope")
    if a == "cs_compile_error" and re.search(r"\b(char|long|float)\b", json.dumps(p.get("options"))):
        out.append("char_long_float_in_options_out_of_scope")
    if r["kind"] == "frq_bundle" and p.get("total_points") == 9:
        out.append("frq_points_9_not_official_7_7_5_6")
    return out


def d_regression_range(r):
    """회귀 FRQ(stfrq_q2_regression)의 참고답이 말하는 '자료의 범위'가 산점도의 실제 x 범위와 다르다(명목 범위를 그대로 씀)."""
    p = r["payload"]
    if not isinstance(p, dict) or base_arch(arch(r)) != "stfrq_q2_regression":
        return []
    try:
        pts = p["stimulus"]["data"]["data"]["points"]
        xs = [q[0] for q in pts]
        e = [x for x in p["parts"] if x["label"] == "E"][0]["model_answer"]
        m = re.search(r"range of the data \((\d+) to (\d+)\)", e)
        if m and (int(m.group(1)) != int(min(xs)) or int(m.group(2)) != int(max(xs))):
            return [f"reference_range_{m.group(1)}_to_{m.group(2)}_but_data_{int(min(xs))}_to_{int(max(xs))}"]
    except (KeyError, IndexError, TypeError):
        return []
    return []


DETECTORS = {
    "a_chisq_equivalent_nulls": d_chisq_equiv_null,
    "b_setup_hidden": d_setup_hidden,
    "b_title_truncated": d_title_truncated,
    "d_bio_fork_direction": d_fork_direction,
    "d_bio_potato_solute_potential": d_potato_solute,
    "d_bio_uv_dose_unstated": d_uv_unstated,
    "d_bio_population_stops_changing": d_population_stops,
    "d_stats_phat_not_count_over_n": d_phat_n,
    "d_phys_collision_rounded_premise": d_collision_rounded,
    "d_calc_smoothness_premise": d_calc_smooth,
    "d_calc_concavity_reference": d_calc_concavity,
    "d_csa_scope_and_points": d_csa_scope,
    "d_stats_regression_reference_range": d_regression_range,
}


def main():
    write = "--write" in sys.argv
    pool = load_pool()
    drop = sys.argv[sys.argv.index("--drop-plans") + 1] if "--drop-plans" in sys.argv else None
    plans = load_plans(drop)
    comp, _log = compose_all(plans)
    where = collections.defaultdict(list)
    for sid, (_f, c) in comp.items():
        for sec in ("mc", "frq"):
            for i, k in enumerate(c[sec]):
                where[k].append({"set": sid, "section": sec, "position": i + 1, "published": sid not in UNPUBLISHED_SETS})
    removed_by = {}  # 원본 키 -> (교체안 파일, 새 키)
    for sid, lst in plans.items():
        for _v, pf, d in lst:
            for w in d["swaps"]:
                removed_by[w["removeKey"]] = (pf, w["addKey"], sid)
    result = {}
    for code, det in DETECTORS.items():
        stock = collections.defaultdict(list)
        for k, r in pool.items():
            hits = det(r)
            if hits:
                stock[base_arch(arch(r)) or "(no archetype)"].append((k, sorted(set(hits)), r["apSubjectCode"]))
        entry = {"stockByArchetype": {a: len(v) for a, v in sorted(stock.items())}, "stockTotal": sum(len(v) for v in stock.values()), "published": [], "coveredByExistingPlan": [], "stockItems": {}}
        for a, v in stock.items():
            for k, hits, subj in v:
                entry["stockItems"].setdefault(a, []).append({"key": k, "subject": subj, "hits": hits, "usedIn": where.get(k, []), "replacedBy": removed_by.get(k)})
                pub = [w for w in where.get(k, []) if w["published"]]
                if pub:
                    entry["published"].append({"key": k, "archetype": a, "subject": subj, "hits": hits, "where": pub})
                elif k in removed_by:
                    entry["coveredByExistingPlan"].append({"key": k, "archetype": a, "plan": removed_by[k][0], "newKey": removed_by[k][1], "set": removed_by[k][2]})
        result[code] = entry
    out = {"dropPlans": drop, "generatedBy": "scripts/audit/ap-type-defect-scan.py", "auditSource": "docs/audits/ap-external-audit-20261015-report.md", "poolSize": len(pool), "unpublishedSets": sorted(UNPUBLISHED_SETS), "detectors": result}
    # 요약 출력
    for code, e in result.items():
        subs = collections.Counter(x["subject"] for x in e["published"])
        print(f"{code}: stock {e['stockTotal']} {e['stockByArchetype']} | published-now {len(e['published'])} {dict(subs)} | already-in-plan {len(e['coveredByExistingPlan'])}")
        for x in e["published"]:
            print("    PUB", x["key"], x["archetype"], [(w["set"], w["section"], w["position"]) for w in x["where"]], x["hits"][:2])
    if write:
        os.makedirs(os.path.join(ROOT, "data", "audit"), exist_ok=True)
        with open(os.path.join(ROOT, "data", "audit", "ap-type-defect-scan-20261019.json"), "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=1)
            f.write("\n")
        print("wrote data/audit/ap-type-defect-scan-20261019.json")


if __name__ == "__main__":
    main()
