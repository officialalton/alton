# S1c 채점: 문항별 탐지 여부(결함 문항은 탐지, 정상 문항은 오탐) — python3 s1c-score.py <run>
import json,sys,collections
run=sys.argv[1] if len(sys.argv)>1 else 's1c'; d=f'data/ap/sample-2027/{run}/'
t=json.load(open(d+'truth.json')); v={x['key']:x for x in json.load(open(d+'verdicts.json'))}
rows=[]
for k,tr in t.items():
    x=v[k]; rs=x['reasons']; rev=x.get('review') or {}
    by=[]
    if any(r.startswith('solver_disagrees') for r in rs): by.append('solver')
    if any(r.startswith('instant_reject') for r in rs): by.append('instant_reject')
    if any('missing_condition' in r for r in rs): by.append('instant_missing_condition')
    if any(r.startswith('criterion_failed') for r in rs): by.append('criterion')
    rows.append((k,tr['defect'],tr['archetype'],bool(rs),by,rs))
D=[r for r in rows if r[1]!='none']; G=[r for r in rows if r[1]=='none']
print(f"결함 {len(D)}: 탐지 {sum(r[3] for r in D)} / 미탐지 {sum(not r[3] for r in D)}"); print(f"정상 {len(G)}: 오탐 {sum(r[3] for r in G)} ({sum(r[3] for r in G)/len(G):.1%})")
print('탐지 경로(결함):',collections.Counter(b for r in D for b in r[4]))
print('미탐지 결함:',[(r[0],r[2]) for r in D if not r[3]]); print('오탐 정상:',[(r[0],r[2],r[5]) for r in G if r[3]])
print('원형별(결함) 탐지:',{a:f"{sum(1 for r in D if r[2]==a and r[3])}/{sum(1 for r in D if r[2]==a)}" for a in sorted({r[2] for r in D})})
json.dump([dict(key=r[0],defect=r[1],archetype=r[2],flagged=r[3],paths=r[4],reasons=r[5]) for r in rows],open(d+'score.json','w'),ensure_ascii=False,indent=1)
