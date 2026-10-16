import json,random,collections,math,sys
scan={r['key'] for r in json.load(open('data/ap/stock/defect-scan.json'))}
I=[]
for f in ['items','s1a-items','v1ab-items','v45ab-items']:
    try: I+=json.load(open(f'data/ap/stock/{f}.json'))
    except: pass
I=[i for i in I if i['apSubjectCode']=='ap_calculus_ab' and i['validation']=='auto_passed' and i['stockKey'] not in scan and i['kind']=='mc' and not i.get('duplicateOf')]
def rep(i):
    s=i['payload'].get('stimulus'); 
    try: k=(json.loads(s) if isinstance(s,str) else s or {}).get('kind')
    except: k=None
    return k or 'none'
for i in I: i['_u']=int(i['keywordCode'].split('.')[0]); i['_c']=int(i['skillPrimary'][0]); i['_g']=rep(i)=='graph'
print(len(I),collections.Counter(rep(i) for i in I))
A=[i for i in I if i['calculator']=='not_allowed']; B=[i for i in I if i['calculator']=='required']
mn=[5,5,3,5,7,7,3,5]; mx=[6,6,4,6,8,8,4,6]; cmn={1:21,2:7,3:5}; cmx={1:29,2:12,3:9}
def cost(sel,G):
    c=0;u=collections.Counter(i['_u'] for i in sel);k=collections.Counter(i['_c'] for i in sel);f=collections.Counter(i['itemFamilyId'] for i in sel)
    for j in range(8): c+=max(0,mn[j]-u[j+1])+max(0,u[j+1]-mx[j])
    for j in (1,2,3): c+=max(0,cmn[j]-k[j])+max(0,k[j]-cmx[j])
    c+=sum(max(0,n-2) for n in f.values()); c+=max(0,21-len(f)); c+=max(0,G-sum(i['_g'] for i in sel)); return c
def search(G,iters=60000):
    rnd=random.Random(1); sa=rnd.sample(A,29); sb=rnd.sample(B,13); cur=cost(sa+sb,G); T=1.0
    for t in range(iters):
        if cur==0: return sa+sb
        part,pool=(sa,A) if rnd.random()<0.7 else (sb,B); p=rnd.randrange(len(part)); new=rnd.choice(pool)
        if new in part: continue
        old=part[p]; part[p]=new; c=cost(sa+sb,G)
        if c<=cur or rnd.random()<math.exp((cur-c)/max(T,.05)): cur=c
        else: part[p]=old
        T*=0.9999
    return None
for G in (0,6,8,10,12,14):
    ok=any(search(G) for _ in range(1)) ; print('graph>=',G,'witness' if ok else 'none found')
