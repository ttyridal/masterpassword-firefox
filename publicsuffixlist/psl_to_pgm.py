from __future__ import print_function
from collections import *
import sys
import json

tree = lambda: defaultdict(tree)

def is_ascii(s): return all(ord(c) < 128 for c in s)

def build_tree_from_psl(pslfilename):
    domain_tree = tree()

    for l in open(pslfilename):
        l = l.strip()
        if not l or l[0] == '/' or '.' not in l: continue
        x = l.split('.')

        if l[0]=='!': continue  ## deal with those later

        x = x[::-1]
        d = domain_tree
        for q in x:
            if not is_ascii(q):
                q = "xn-"+q.encode('punycode').decode('ascii')
            d = d[q]

    return domain_tree


# convert defaultdict to dict and replace empty dicts (leafs)
# with single 0 value
def walk(d, dst):
    for k,v in d.items():
        if v:
            dst[k] = dict()
            walk(v, dst[k])
        else:
            dst[k] = 0


## convert bytearray s to P5 PGM image
def pgmdump(s):
    rows = int(len(s) / 4096) + 1
    cols =  int(len(s)/rows) + 1
    padding = rows*cols - len(s)

    print("P5")
    print(cols)
    print(rows)
    print(255)
    print(s, end='')
    print(" "*padding)


table=dict()
walk(build_tree_from_psl(sys.argv[1]), table)
pgmdump(json.dumps(table).replace(' ',''))

if len(sys.argv) < 3 or sys.argv[2] != "test":
    sys.exit(0)

def lookup(url, d):
    urlparts = url.split('.')[::-1]

    lut = table
    res = []

    it = iter(urlparts)

    for part in it:
        res.append(part)
        if not lut:
            break
        elif part in lut:
            lut = lut[part]
        elif '*' in lut:
            lut = 0
        else:
            break

    return ".".join(res[::-1])

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
