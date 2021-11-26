import {tldlookup, tldcommon} from './getdomain_lut.js'

export function getDomain(url) {
    //TODO decode Punycodeed urls (RFC 3492 and RFC 5891) 
    const parts = url.split('.').reverse();
    let res = [];
    let lut = tldlookup;
    let v;

    for (v=0; v < parts.length; v++) {
        const part = parts[v];
        if (!lut) break;
        if (part in lut) {
            res.push(part);
            lut = lut[part]
        } 
        else if ('*' in lut) {
            res.push(e);
            lut = null;
        } else
            break;
    }
    if (v < parts.length)
        res.push(parts[v]);

    if (parts.length > 2 && parts[1] in tldcommon
        && tldcommon[parts[1]].includes(parts[0]) && res.length < 3) {
        res = parts.slice(0, 3);
    }
    
    v = parts.indexOf('blogspot');
    if (v >= 0)
        res = parts.slice(0, v + 2);

    return res.reverse().join('.');
}
