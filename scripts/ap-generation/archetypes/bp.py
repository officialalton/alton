"""설계도(blueprint) 조립 도구 — 문항·번들 문장을 쓰기 전에 확정되는 기계 판독 설계도(lib/ap-generation/blueprint.ts 가 검증)."""

def mc_blueprint(arch, subject, topic, skill, calc, concept, thinking, key_conditions, misconceptions, independent_path, material=None, method="sympy+numeric", extra=None):
    bp = {"id": arch, "subject": subject, "kind": "mc", "concept": concept, "topic": topic, "skill": skill, "student_thinking": thinking, "structure": "standalone", "response_mode": "select",
          "calculator": calc, "key_conditions": [{"condition": c, "evidence": e} for c, e in key_conditions], "material": material or {"type": "none", "must_include": []},
          "misconceptions": [{"id": i, "description": d} for i, d in misconceptions], "verification": {"independent_path": independent_path, "method": method}}
    if extra: bp.update(extra)
    return bp

def frq_blueprint(arch, subject, pack, concept, thinking, key_conditions, material, independent_path, extra=None, method="sympy+independent-module"):
    parts = [{"label": p["label"], "skills": p["skill_codes"], "topics": p.get("topic_codes") or [pack["topic"]], "points": p["points"], "accepted_answers": [p["model_answer"]],
              "rubric_rows": [{"row_id": r["row_id"], "points": r["points"], "criterion": r["criterion"], "elements": r["required_elements"]} for r in p["rubric_rows"]]} for p in pack["parts"]]
    bp = {"id": arch, "subject": subject, "kind": "frq_bundle", "concept": concept, "topic": pack["topic"], "skill": pack.get("representative_skill") or pack["skill"], "student_thinking": thinking,
          "structure": "frq_multipart", "response_mode": "explain", "calculator": pack.get("calculator", "allowed"), "key_conditions": [{"condition": c, "evidence": e} for c, e in key_conditions],
          "material": material, "misconceptions": [], "verification": {"independent_path": independent_path, "method": method}, "parts": parts, "total_points": pack["total_points"]}
    if extra: bp.update(extra)
    return bp
