"use strict";
import {jest, it, expect, beforeEach} from '@jest/globals'
import {getDomain} from './getdomain.js'

it('gets the correct domain from url', () => {
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
