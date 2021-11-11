"use strict";
import {jest} from '@jest/globals'
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
