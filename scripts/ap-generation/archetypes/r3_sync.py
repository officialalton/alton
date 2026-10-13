"""예비 3차(R3) 원형 가이드 동기화(무료, 로컬): calc_r3_*.py 모듈의 원형마다 샘플 팩 1개를 뽑아
 - MC(g_/c_) → lib/ap-generation/subjects/graph-archetypes.json 에 항목(id/topic/skill/calculator/stimulus/verifiedBy/misconceptions/bc)을 넣거나 갱신(id 정렬),
 - FRQ(frq_) → lib/ap-generation/subjects/frq-r3.json 에 FRQ 템플릿 항목을 넣거나 갱신,
 그 뒤 sync_guide_docs.py 로 가이드 문서·레지스트리 id 목록을 맞춘다. 반복 실행해도 같은 결과(멱등). 사용: python r3_sync.py"""
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
import registry as R  # noqa: E402

GJ = ROOT / "lib/ap-generation/subjects/graph-archetypes.json"
FJ = ROOT / "lib/ap-generation/subjects/frq-r3.json"


def sample(name, is_frq=False):
    for s0 in (0, 1000, 5000):
        try:
            b = R.batch(name, 1, s0)
        except Exception:
            continue
        if b:
            return b[0]
    return None


mc_names = sorted(n for m in R._R3 for n in dir(m) if n.startswith(("g_", "c_")) and callable(getattr(m, n)) and getattr(getattr(m, n), "__module__", "") == m.__name__)
frq_names = sorted(n for m in R._R3 for n in dir(m) if n.startswith("frq_") and callable(getattr(m, n)) and getattr(getattr(m, n), "__module__", "") == m.__name__)
guide = json.loads(GJ.read_text())
by = {a["id"]: a for a in guide}
bad = []
for n in mc_names:
    p = sample(n)
    if not p:
        bad.append(n)
        continue
    bp = p["blueprint"]
    by[n] = {"id": n, "topic": p["topic"], "skill": p["skill"], "calculator": p["calculator"], "stimulus": "graph" if bp["material"]["type"] == "graph" else ("table" if bp["material"]["type"] == "table" else "none"),
             "verifiedBy": [bp["verification"]["independent_path"]], "misconceptions": [m["description"] for m in bp["misconceptions"]], "bc": False}
GJ.write_text(json.dumps(sorted(by.values(), key=lambda a: a["id"]), indent=1, ensure_ascii=False) + "\n")
fr = []
for n in frq_names:
    p = sample(n, True)
    if not p:
        bad.append(n)
        continue
    parts = " / ".join(f"{q['label']} {q['prompt'][:60].strip()} ({q['points']})" for q in p["parts"])
    fr.append({"id": n, "template": p["template"], "topic": p["topic"], "extraTopics": p.get("extra_topics", []), "skill": p["skill"], "calculator": p["calculator"], "parts": parts, "points": p["total_points"], "verifiedBy": [p["blueprint"]["verification"]["independent_path"][:160]]})
FJ.write_text(json.dumps(fr, indent=1, ensure_ascii=False) + "\n")
print("mc", len(mc_names), "frq", len(frq_names), "no_sample", bad)
subprocess.run([sys.executable, str(HERE / "sync_guide_docs.py")], check=False)
# 가이드 일관성 테스트(gates.test.ts)가 registry.py 소스에서 id 문자열을 찾으므로 R3 FRQ id 를 목록 줄로 유지한다.
import re as _re
_reg = HERE / "registry.py"
_src = _reg.read_text()
_line = "R3_FRQ_IDS = [" + ", ".join(f'"{t["id"]}"' for t in fr) + "]"
_src = _re.sub(r"\nR3_FRQ_IDS = \[[^\]]*\]", "", _src).rstrip("\n") + "\n" + _line + "\n"
_reg.write_text(_src)
# FRQ 템플릿 행을 가이드 문서(calc-ab.md)에 덧붙인다(없는 id 만).
_doc = ROOT / "docs/ap/generation-guides/calc-ab.md"
_txt = _doc.read_text()
_new = [t for t in fr if t["id"] not in _txt]
if _new:
    _txt = _txt.rstrip("\n") + "\n\n예비 3차(R3, 2026-10-12) FRQ 템플릿:\n\n| id | template | topic | skill | calculator | parts |\n|---|---|---|---|---|---|\n" + "\n".join(
        f"| {t['id']} | {t['template']} | {t['topic']} | {t['skill']} | {t['calculator']} | {t['parts'][:150].replace('|', '/')} |" for t in _new) + "\n"
    _doc.write_text(_txt)
print("frq doc rows added", len(_new))
