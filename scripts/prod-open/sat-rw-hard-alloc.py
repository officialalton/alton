#!/usr/bin/env python3
"""SAT R&W Hard 보강 배정(2026-10-22): M1·M2 쉬운(lower) 모듈마다 Hard H개를 같은 기술 슬롯(Medium 우선, 없으면 Easy)에 배정한다.
입력: --slots slots2.json (공개 30세트 R&W 슬롯), --pool pool.json ([{key,skill}]), 출력: --out alloc.json
규칙: 모듈당 H개(기본 3), 한 모듈 안 같은 기술 최대 1개, 교체 슬롯 난이도는 medium 우선, 영역·기술 문항 수는 교체(같은 기술)라 불변, 풀 문항은 한 번만 사용.
"""
import argparse, json, collections, random
ap = argparse.ArgumentParser(); ap.add_argument('--slots'); ap.add_argument('--pool'); ap.add_argument('--out'); ap.add_argument('--h', type=int, default=3); ap.add_argument('--seed', type=int, default=7)
a = ap.parse_args(); rnd = random.Random(a.seed)
slots = json.load(open(a.slots)); pool = json.load(open(a.pool))
supply = collections.defaultdict(list)
for p in pool: supply[p['skill']].append(p['key'])
for v in supply.values(): rnd.shuffle(v)
mods = collections.defaultdict(list)
for s in slots:
    k = (s['set_id'], s['name'], s['module_key'], s['route'])
    if (s['module_key'], s['route']) in (('rw_m1', ''), ('rw_m2', 'lower')): mods[k].append(s)
order = sorted(mods)
rnd.shuffle(order)
assign = []; unfilled = collections.Counter()
chosen_by = {k: [] for k in order}
# 라운드 방식: 모든 모듈이 먼저 1개씩, 다음 2개째, 3개째 — 재고가 모자라도 특정 모듈이 0개가 되지 않게 고르게 나눈다.
for _round in range(a.h):
    # 이번 라운드에서 후보 기술이 가장 적은 모듈부터(제약이 큰 모듈 우선)
    def n_opts(k):
        sl = mods[k]; c = chosen_by[k]
        return sum(1 for skill, keys in supply.items() if keys and not any(x['skill_code'] == skill for x in c) and any(s['skill_code'] == skill and s['difficulty'] in ('medium', 'easy') and s not in c for s in sl))
    for k in sorted(order, key=n_opts):
        sl = mods[k]; chosen = chosen_by[k]; cands = []
        for skill, keys in supply.items():
            if not keys or any(c['skill_code'] == skill for c in chosen): continue
            m = [s for s in sl if s['skill_code'] == skill and s['difficulty'] == 'medium' and s not in chosen]
            e = [s for s in sl if s['skill_code'] == skill and s['difficulty'] == 'easy' and s not in chosen]
            if m: cands.append((len(keys), 1, skill, m[0]))
            elif e: cands.append((len(keys), 0, skill, e[0]))
        if not cands: unfilled[k] += 1; continue
        cands.sort(key=lambda x: (-x[1], -x[0], x[2]))
        _, _, skill, slot = cands[0]
        key = supply[skill].pop()
        chosen.append(slot); assign.append({'setId': k[0], 'name': k[1], 'moduleKey': k[2], 'route': k[3], 'section': 'rw', 'curPosition': slot['position'], 'oldProblemId': slot['problem_id'], 'skill': skill, 'from': slot['difficulty'], 'key': key})
by_skill = collections.Counter(x['skill'] for x in assign)
rem = {s: len(v) for s, v in supply.items() if v}
json.dump({'assign': assign, 'unfilledSlotsByModule': {f'{k[1]}|{k[2]}|{k[3]}': n for k, n in unfilled.items()}, 'bySkill': by_skill, 'poolRemaining': rem, 'modules': len(order), 'assigned': len(assign), 'target': len(order) * a.h}, open(a.out, 'w'), ensure_ascii=False, indent=1)
print('modules', len(order), 'assigned', len(assign), 'of target', len(order) * a.h, 'unfilled modules', len(unfilled), 'remaining pool', sum(rem.values()))
print('from', collections.Counter(x['from'] for x in assign)); print('bySkill', dict(by_skill))
