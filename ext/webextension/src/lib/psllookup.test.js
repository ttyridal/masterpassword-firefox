/* globals global, Buffer */
"use strict";
import {it, expect} from '@jest/globals'
import {PslLookup} from './psllookup.js'
import fs from 'fs';
import {Readable} from 'node:stream';
import { URL } from 'url';

async function MockFetch(url) {
    const url_abspath = new URL(url, import.meta.url).pathname;
    let bdy = Readable.toWeb(fs.createReadStream(url_abspath));
    return {body:bdy};
}

function MockResponse(stream, options) { // eslint-disable-line no-unused-vars
    async function respJson() {
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(Buffer.from(chunk));
        }
        return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
    }

    return {json: respJson};

}

global.fetch = MockFetch;
global.Response = MockResponse;

it('gets the correct domain from url', async () => {


    const psl = new PslLookup();
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
