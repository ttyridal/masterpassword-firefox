/* globals global */
"use strict";
import {it, expect} from '@jest/globals'
import {PslLookup} from './psllookup.js'
import fs from 'fs';
import {PNG} from 'pngjs3'
// import { sync as PNGSync } from 'pngjs3';
import { URL } from 'url';

function pngPixels(url) {
    const url_abspath = new URL(url, import.meta.url).pathname;
    const data = fs.readFileSync(url_abspath);

    return new Promise(resolve=>{
        new PNG().parse(data, function (error, data) {
            resolve(data.data);
        });
    });
}

class MockBlob {
    constructor(data/*, params*/) {
        let txt = data.toString("utf8");
        this.text = ()=>{return Promise.resolve(txt)};
    }
}
global.Blob = MockBlob;

it('gets the correct domain from url', async () => {


    const psl = new PslLookup({tableLoader: pngPixels});
    await psl.waitTableReady()
    const getDomain = psl.getPublicDomain.bind(psl);

    expect(getDomain('example.com')).toBe('example.com');
    expect(getDomain('amazon.com')).toBe('amazon.com');
    expect(getDomain('show.amazon.com')).toBe('amazon.com');
    expect(getDomain('amazon.co.uk')).toBe('amazon.co.uk');
    expect(getDomain('shop.amazon.co.uk')).toBe('amazon.co.uk');
    expect(getDomain('tyridal.no')).toBe('tyridal.no');
    expect(getDomain('digi.gitapp.si')).toBe('digi.gitapp.si');
    expect(getDomain('www.tyridal.no')).toBe('tyridal.no');
    expect(getDomain('torbjorn.tyridal.no')).toBe('tyridal.no');
    expect(getDomain('wilson.no.eu.org')).toBe('wilson.no.eu.org');
    expect(getDomain('xxx.wilson.no.eu.org')).toBe('wilson.no.eu.org');
    expect(getDomain('weare.org.om')).toBe('weare.org.om');
    expect(getDomain('rave.weare.org.om')).toBe('weare.org.om');
    expect(getDomain('rave.blogspot.co.nz')).toBe('rave.blogspot.co.nz');
    expect(getDomain('rave.blogspot.com')).toBe('rave.blogspot.com');
    expect(getDomain('xx.rave.blogspot.co.nz')).toBe('rave.blogspot.co.nz');
    expect(getDomain('xx.rave.blogspot.com')).toBe('rave.blogspot.com');
    expect(getDomain('blogspot.com')).toBe('blogspot.com');

});
