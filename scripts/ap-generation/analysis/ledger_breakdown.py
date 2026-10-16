"""ledger 분해: 신규 지출 $21.75(AB run2a→b→final, BC bc_a→bc_b→final)와 run1(구 방식)을 사용 가능한 고유 문항 기준 비용으로 환산. 출력: JSON."""
import json, os, re, collections, hashlib
R = "data/ap/sample-2027"
def jl(p): return [json.loads(l) for l in open(p) if l.strip()] if os.path.exists(p) else []
def costs(run):
    out = collections.defaultdict(lambda: collections.defaultdict(float)); calls = collections.Counter()
    for st in ["gen", "solve", "review", "difficulty", "spot"]:
        for r in jl(f"{R}/{run}/{st}.results.jsonl"):
            if not r.get("ok"): continue
            k = re.sub(r"^[a-z]-", "", r["custom_id"]) if st != "gen" else r["custom_id"]
            out[k][st] += r.get("cost", 0); calls[k] += 1
    return out, calls
def cands(run): return {x["candidateKey"]: x for x in json.load(open(f"{R}/{run}/candidates.json"))}
def packmap(run):
    p = f"{R}/{run}/packs.json"
    if not os.path.exists(p): return {}
    d = json.load(open(p)); m = {}
    for cell, lst in d.items():
        for i, pk in enumerate(lst): m[f"{cell}-k{i}"] = pk.get("pack_id")
    return m
def sig(c):
    p = c["payload"]
    if c["kind"] == "mc": return re.sub(r"\s+", " ", (p.get("stem", "") + "|" + "~".join(sorted(re.sub(r"\s+", " ", (o["text"] if isinstance(o, dict) else o)) for o in p.get("options", [])))))
    return re.sub(r"\s+", " ", p.get("title", "") + "|".join(x["prompt"] for x in p.get("parts", [])))
def analyze(chain, label):
    final = chain[-1]; fc = cands(final); slots = collections.defaultdict(lambda: {"cost": 0.0, "calls": 0, "hist": {}, "kind": None})
    for run in chain:
        co, ca = costs(run); cs = cands(run); pm = packmap(run)
        for k, c in cs.items():
            pid = pm.get(k) or k
            s = slots[(c["apSubjectCode"], pid)]
            s["kind"] = c["kind"]; s["hist"][run] = (c["rejectionReason"] is None)
            s["cost"] += sum(co.get(k, {}).values()); s["calls"] += ca.get(k, 0)
    res = collections.defaultdict(lambda: collections.Counter()); cost = collections.defaultdict(lambda: collections.Counter())
    for (sub, pid), s in slots.items():
        first = s["hist"].get(chain[0]); last = s["hist"].get(final)
        if last: cat = "first_pass_passed" if first else "passed_after_repair"
        elif last is False: cat = "passed_early_but_rejected_in_final" if first else "rejected_never_passed"
        else: cat = "dropped_before_final"
        res[s["kind"]][cat] += 1; cost[s["kind"]][cat] += s["cost"]
    file_total = sum(s["cost"] for s in slots.values())
    return res, cost, file_total, fc
def exact_unique(fc):
    seen = set(); n = collections.Counter()
    for c in fc.values():
        if c["rejectionReason"]: continue
        sg = sig(c)
        if sg in seen: n[c["kind"] + "_dup"] += 1; continue
        seen.add(sg); n[c["kind"]] += 1
    return n
out = {}
for label, chain, total in [("AB", ["run2a", "run2b", "run2"], 14.07), ("BC", ["run2bc_a", "run2bc_b", "run2bc"], 21.75 - 14.07)]:
    res, cost, ft, fc = analyze(chain, label); uq = exact_unique(fc)
    sel = collections.Counter(("selected" if c["reviewState"] == "pending_expert_review" and not c["reserve"] else "reserve" if c["reviewState"] == "pending_expert_review" else "rej") + "_" + c["kind"] for c in fc.values())
    out[label] = {"slots": {k: dict(v) for k, v in res.items()}, "cost_by_category": {k: {a: round(b, 3) for a, b in v.items()} for k, v in cost.items()}, "file_cost_total": round(ft, 3), "ledger_spend": round(total, 2), "unattributed": round(total - ft, 3), "unique_passed_final": dict(uq), "final_selected_reserve": dict(sel)}
# run1(구 방식)
co, ca = costs("run1"); c1 = cands("run1"); byk = collections.defaultdict(lambda: collections.Counter())
for k, c in c1.items(): kind = c["kind"] if c["structure"] == "standalone" or c["kind"] != "mc" else "mc_set"; byk[kind]["cost"] += sum(co.get(k, {}).values()); byk[kind]["cand"] += 1; byk[kind]["pass"] += 0 if c["rejectionReason"] else 1; byk[kind]["calls"] += ca.get(k, 0)
out["run1"] = {k: {a: round(b, 3) for a, b in v.items()} for k, v in byk.items()}; out["run1"]["_unique_passed"] = dict(exact_unique(c1)); out["run1"]["_file_cost_total"] = round(sum(sum(v.values()) for v in co.values()), 3)
print(json.dumps(out, indent=1))


# ---- 정산표(비용 단계별·종류별) 추가 출력
def stage_costs(chain):
    tot = collections.defaultdict(lambda: collections.defaultdict(float)); cnt = collections.defaultdict(lambda: collections.Counter())
    for run in chain:
        cs = cands(run)
        for st in ["gen", "solve", "review", "difficulty", "spot"]:
            for r in jl(f"{R}/{run}/{st}.results.jsonl"):
                if not r.get("ok"): continue
                k = re.sub(r"^[a-z]-", "", r["custom_id"]) if st != "gen" else r["custom_id"]
                kind = cs.get(k, {}).get("kind", "unknown")
                tot[kind][st] += r.get("cost", 0); cnt[kind][st] += 1
    return {k: {a: round(b, 3) for a, b in v.items()} for k, v in tot.items()}, {k: dict(v) for k, v in cnt.items()}
recon = {}
for label, chain in [("AB", ["run2a", "run2b", "run2"]), ("BC", ["run2bc_a", "run2bc_b", "run2bc"])]:
    st, ct = stage_costs(chain); recon[label] = {"cost_by_stage": st, "calls_by_stage": ct}
    fc = cands(chain[-1]); recon[label]["final_rows"] = collections.Counter(("pass" if c["rejectionReason"] is None else "rej") + "_" + c["kind"] for c in fc.values())
    recon[label]["final_rows"] = dict(recon[label]["final_rows"])
    recon[label]["interim_rows"] = {run: dict(collections.Counter(c["kind"] for c in cands(run).values())) for run in chain}
print("RECON", json.dumps(recon))
