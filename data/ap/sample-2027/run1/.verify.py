import json
from sympy import symbols,solve,Rational
Q=symbols('Q')
q=solve((30-Q/4)-(Q/2)-6,Q)[0]
pd=30-q/4
share=Rational(pd-20,6)
opts=[Rational(1,6),Rational(1,3),Rational(1,2),Rational(2,3),Rational(5,6)]
print(json.dumps({'computed_key_index':opts.index(share),'conceptual_only':False,'details':str(share)}))