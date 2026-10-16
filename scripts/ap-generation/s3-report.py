# S3 보고: 과목 × MC/FRQ 별 재검증 결과(S2 표본 결과는 별도 열). S2 통과율을 전체에 적용하지 않는다.
import json,collections
root='data/ap/sample-2027/'
scan={r['key'] for r in json.load(open('data/ap/stock/defect-scan.json'))}
def load(prefix,dirs):
    rows=[]
    for d,sub in dirs:
        v={x['key']:x for x in json.load(open(root+d+'/verdicts.json'))}; t=json.load(open(root+d+'/truth.json')); cells={c['cellId']:c for c in json.load(open(root+d+'/cells.json'))}
        cost=collections.defaultdict(float)
        for f in ['solve','review','review2','difficulty']:
            try:
                for ln in open(root+d+'/'+f+'.results.jsonl'):
                    r=json.loads(ln); cost[r['custom_id'][2:]]+=r.get('cost',0)
            except FileNotFoundError: pass
        for k,x in v.items():
            rows.append(dict(sub=sub,kind=cells[x['cellId']]['kind'],stock=t[k]['stockKey'],group=t[k].get('group'),passed=x['passed'],mal=any('review_malformed' in r for r in x['reasons']),reasons=x['reasons'],cost=cost[k],flag=t[k]['stockKey'] in scan))
    return rows
dirs3=[('s3-ab','ap_calculus_ab'),('s3-bio','ap_biology'),('s3-micro','ap_microeconomics')]; dirs2=[('s2-ab','ap_calculus_ab'),('s2-bio','ap_biology'),('s2-micro','ap_microeconomics')]
r3=load('s3',dirs3); r2=load('s2',dirs2)
def tab(rows,title):
    print('##',title,'총',len(rows),'통과',sum(r['passed'] for r in rows),'비용 $%.3f'%sum(r['cost'] for r in rows))
    by=collections.defaultdict(list)
    for r in rows: by[(r['sub'],r['kind'])].append(r)
    for k,l in sorted(by.items()): print('  ',k,'평가',len(l),'통과',sum(x['passed'] for x in l),'(%.0f%%)'%(100*sum(x['passed'] for x in l)/len(l)),'읽기불가(재요청 후)',sum(x['mal'] for x in l),'$%.3f'%sum(x['cost'] for x in l))
tab(r3,'S3 전수(대상 고정 125)')
tab([r for r in r2 if not r['flag'] and r['group']!='rule_fail'],'S2 표본(무작위+복구, 결함 플래그 제외)')
print('S2 표본 중 생성기 결함 플래그 문항',sum(r['flag'] for r in r2),'그중 검토기 통과',sum(r['flag'] and r['passed'] for r in r2))
print('S3 실패 사유',collections.Counter(x.split(':')[0] for r in r3 if not r['passed'] for x in r['reasons']).most_common(10))
json.dump(dict(s3=r3,s2=r2),open(root+'s3-report.json','w'),ensure_ascii=False,indent=1)
