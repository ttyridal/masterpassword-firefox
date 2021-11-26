from __future__ import print_function

from collections import *
import sys
import json

c = Counter()

common = {
        'org': [],
        'com': [],
        'net': [],
        'gov': [],
        'edu': [],
        'co': [],
        'mil': [],
        'ac': [],
        'info': [],
        }
tree = lambda: defaultdict(tree)

others = tree()

for l in open("public_suffix_list.dat"):
    l = l.strip()
    if not l or l[0] == '/' or '.' not in l: continue
##     print(l)
    x = l.split('.')

    if l[0]=='!': continue  ## deal with those later

    if 'blogspot' in x:  ## special case them.. always x.blogspot....
        pass
    elif len(x) == 2 and x[-2] in common:
        common[x[-2]].append(x[-1])
    else:
        x = x[::-1]
        d = others
        for q in x:
            d = d[q]

def walk(d, dst,lvl=0):
    for k,v in d.items():
        if v:
            print((" "*lvl)+k)
            dst[k] = dict()
            walk(v, dst[k],lvl+1)
        else:
            print((" "*lvl)+k)
            dst[k] = 0


table=dict()
walk(others, table)
## print("export const tldlookup =", json.dumps(table),";")
## print("export const tldcommon =", json.dumps(common),";")
sys.exit(0)
def lookup(url, d):
    k = url.split('.')[::-1]
    x = d
    p = []
    for e in k:
        if not d:
            break
        if e in d:
            p.append(e)
            d = d[e]
        elif '*' in d:
            p.append(e)
            d=None
        else:
            break

    p.append(e)

    if len(k)>2 and k[1] in common and k[0] in common[k[1]] and len(p) < 3:
        p = k[:3]

    try:
        p1 = k[:k.index('blogspot')+2]
        if len(p1) > len(p):
            p = p1
    except: pass

    return ".".join(p[::-1])

for test in [
        'example.com',
        'amazon.com',
        'show.amazon.com',
        'amazon.co.uk',
        'shop.amazon.co.uk',
        'tyridal.no',
        'digi.gitapp.si',
        'www.tyridal.no',
        'torbjorn.tyridal.no',
        'wilson.no.eu.org',
        'xxx.wilson.no.eu.org',
        'weare.org.om',
        'rave.weare.org.om',
        'rave.blogspot.co.nz',
        'rave.blogspot.com',
        'xx.rave.blogspot.co.nz',
        'xx.rave.blogspot.com',
        'blogspot.com',
        ]:
    print(test, "->", lookup(test, table))
