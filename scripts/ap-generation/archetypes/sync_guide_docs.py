"""가이드 문서·레지스트리 id 목록 동기화(무료, 로컬): lib/ap-generation/subjects/graph-archetypes.json 에 있고 가이드 문서에 아직 없는 원형 행을 docs/ap/generation-guides/calc-{ab,bc}.md 에 덧붙이고,
registry.py 의 GRAPH_ARCHETYPE_IDS 목록을 JSON 의 id 전체로 다시 쓴다(gates.test.ts 의 가이드 일관성 검사가 읽는다).
사용: python3 sync_guide_docs.py  (저장소 루트 기준 상대 경로를 이 파일 위치에서 계산)"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
guide = json.loads((ROOT / "lib/ap-generation/subjects/graph-archetypes.json").read_text())
for doc_name, is_bc in (("calc-ab.md", False), ("calc-bc.md", True)):
    p = ROOT / "docs/ap/generation-guides" / doc_name
    text = p.read_text()
    rows = [a for a in guide if bool(a["bc"]) == is_bc and a["id"] not in text]
    if rows:
        text = text.rstrip("\n") + "\n\n보강(supplement, 2026-10-09 오너 승인) 원형:\n\n| id | topic | skill | calculator | verified by |\n|---|---|---|---|---|\n" + "\n".join(
            f"| {a['id']} | {a['topic']} | {a['skill']} | {a['calculator']} | {a['verifiedBy'][0][:110].replace('|', '/')} |" for a in rows) + "\n"
        p.write_text(text)
    print(doc_name, "added", len(rows))
reg = ROOT / "scripts/ap-generation/archetypes/registry.py"
src = reg.read_text()
ids = sorted(a["id"] for a in guide)
new_line = "GRAPH_ARCHETYPE_IDS = [" + ", ".join(f'"{i}"' for i in ids) + "]"
src = re.sub(r"GRAPH_ARCHETYPE_IDS = \[[^\]]*\]", lambda m: new_line, src)
reg.write_text(src)
print("registry ids", len(ids))
