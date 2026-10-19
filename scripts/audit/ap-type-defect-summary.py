#!/usr/bin/env python3
"""유형 단위 결함 전수 목록의 단계별 요약(과목별 문항 수). ap-type-defect-scan.py 의 탐지 규칙을 그대로 쓴다(읽기 전용).
  python3 scripts/audit/ap-type-defect-summary.py [--write]   → docs/audits/ap-type-defect-scan-20261019.md 의 표 부분을 출력(--write 는 data/audit/ap-type-defect-summary-20261019.json 저장)
단계: 원본(검수 전 게시 구성) / 1015 교체안 적용 후 / 이번 1019 교체안 적용 후. 수정본 복제 후보(fix1015·fix1019·aud1015 등)는 결함 문항으로 세지 않는다."""
import collections
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("scan", os.path.join(HERE, "ap-type-defect-scan.py"))
scan = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scan)

COPY_PREFIX = ("fix1015:", "fix1019:", "supp-aud1015-final:", "csa-aud1015:", "audit-wuel:", "supp-fix1015:")
STAGES = [("origin", "audit|aud1015|1015|1019|r6|wuel"), ("after1015", "1019"), ("after1019", None)]


def main():
    pool = scan.load_pool()
    result = {}
    for name, drop in STAGES:
        plans = scan.load_plans(drop)
        comp, _ = scan.compose_all(plans)
        where = collections.defaultdict(list)
        for sid, (_f, c) in comp.items():
            if sid in scan.UNPUBLISHED_SETS:
                continue
            for sec in ("mc", "frq"):
                for i, k in enumerate(c[sec]):
                    where[k].append(f"{sid}-{'MC' if sec == 'mc' else 'FRQ'}{i + 1}")
        result[name] = where
    table = {}
    for code, det in scan.DETECTORS.items():
        rows = []
        for k, r in pool.items():
            if k.startswith(COPY_PREFIX):
                continue
            hits = det(r)
            if hits:
                rows.append({"key": k, "subject": r["apSubjectCode"], "archetype": scan.base_arch(scan.arch(r)) or "(none)", "hits": sorted(set(hits))[:3],
                             "origin": result["origin"].get(k, []), "after1015": result["after1015"].get(k, []), "after1019": result["after1019"].get(k, [])})
        table[code] = rows
    out = {}
    for code, rows in table.items():
        subj = collections.defaultdict(lambda: collections.Counter())
        for x in rows:
            s = x["subject"].replace("ap_", "")
            subj[s]["stock"] += 1
            if x["origin"]:
                subj[s]["published_origin"] += 1
            if x["after1015"]:
                subj[s]["published_after1015"] += 1
            if x["after1019"]:
                subj[s]["published_after1019"] += 1
        out[code] = {"bySubject": {s: dict(c) for s, c in sorted(subj.items())}, "items": rows}
        tot = collections.Counter()
        for c in subj.values():
            tot.update(c)
        print(f"{code}: {dict(tot)}")
        for s, c in sorted(subj.items()):
            print(f"    {s}: {dict(c)}")
    if "--write" in sys.argv:
        with open(os.path.join(scan.ROOT, "data", "audit", "ap-type-defect-summary-20261019.json"), "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=1)
            f.write("\n")


if __name__ == "__main__":
    main()
