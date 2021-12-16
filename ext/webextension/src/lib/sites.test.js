"use strict";
import {it, expect} from '@jest/globals'
import {Site} from './sites.js'


it('constructs a Site objecct', () => {
    let s = new Site();
    expect(s).toEqual(expect.objectContaining({
        username: expect.any(String),
        generation: expect.any(Number),
        sitename: expect.any(String),
        type: expect.stringMatching(/[sxibpnlm]/)
    }));
    console.log(s);
});

it('copy constructs from site-like', () => {
    const orig = {sitename:'somesite.com',url:['somesite.com'],'type':'x'};
    let s = new Site(orig);
    expect(s).toEqual(expect.objectContaining(orig));
    console.log(s);
});


it('constructs with all password types', () => {
    let s = new Site({sitename:'somesite.com',url:['somesite.com'],'type':'s'});
    let x = new Site({sitename:'somesite.com',url:['somesite.com'],'type':'x'});
    let i = new Site({sitename:'somesite.com',url:['somesite.com'],'type':'i'});
    let b = new Site({sitename:'somesite.com',url:['somesite.com'],'type':'b'});
    let l = new Site({sitename:'somesite.com',url:['somesite.com'],'type':'l'});
    let m = new Site({sitename:'somesite.com',url:['somesite.com'],'type':'m'});
    let n = new Site({sitename:'somesite.com',url:['somesite.com'],'type':'n'});
    let p = new Site({sitename:'somesite.com',url:['somesite.com'],'type':'p'});
    let nx = new Site({sitename:'somesite.com',url:['somesite.com'],'type':'nx'});
    let px = new Site({sitename:'somesite.com',url:['somesite.com'],'type':'px'});
    expect(s.type_as_code()).toEqual(20);
    expect(x.type_as_code()).toEqual(16);
    expect(i.type_as_code()).toEqual(21);
    expect(b.type_as_code()).toEqual(19);
    expect(l.type_as_code()).toEqual(17);
    expect(m.type_as_code()).toEqual(18);
    expect(n.type_as_code()).toEqual(30);
    expect(p.type_as_code()).toEqual(31);
    expect(nx.type_as_code()).toEqual(17); // type is actually ignored. mpjson login_type is the correct field
    expect(px.type_as_code()).toEqual(17); // type is actually ignored. mpjson question is the correct field
});
