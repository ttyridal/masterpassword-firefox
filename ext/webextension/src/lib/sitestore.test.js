/* globals global */
/**
 * @jest-environment node
 */

import {it, expect, jest, beforeEach} from '@jest/globals'
import {site_to_storage, SiteStore} from './sitestore.js'
import {mockStorageGet} from '../../mocks/chromestorage.js'

beforeEach(() => {
    global.chrome = {runtime: {lastError: null}};
});

const testSiteData = {
    "url1.com": { "urla.no": { "generation": 1, "type": "l", "username": "" } },
    "url2.co.uk": { "urlb.com": { "generation": 1, "type": "l", "username": "" } },
    "url2.de": { "urlb.com": { "generation": 1, "type": "l", "username": "" } }
};

it('sitestorage.get should return array of sites from old format', async () => {
    let storage = {get: jest.fn()};
    storage.get.mockImplementation(mockStorageGet({sites:testSiteData}));

    let sitestore = new SiteStore(storage);

    let a = await sitestore.get();
    expect(storage.get).toHaveBeenCalled();
    expect(a).toEqual(expect.arrayContaining([
        {"sitename": "urla.no", "url": ["url1.com"], "generation": 1, "type": "l", "username": ""},
        {"sitename": "urlb.com", "url": ["url2.co.uk"], "generation": 1, "type": "l", "username": ""},
        {"sitename": "urlb.com", "url": ["url2.de"], "generation": 1, "type": "l", "username": ""}
    ]));
});

it('should convert any legal site to storage keying', () => {
    let x = site_to_storage({username:'username', sitename:'sitename', garbage:'aeger',
                             generation:1, type:'l', url:['url']});
    expect(x).toEqual({n:'username', s:'sitename', c:1, t:'l', u:['url']});

    x = site_to_storage({url:['url']});
    expect(x).toEqual({u:['url']});
});

it('sitestorage.get should return correct for chrome multirow data', async () => {
    let storage = {get: jest.fn()};
    let data = JSON.stringify(testSiteData);

    data = [data.slice(0,15), data.slice(15)];
    let i = 0;
    let syncset = {};
    for (; i < data.length; i++)
        syncset['sites' + i] = data[i];
    syncset.sites = i;

    storage.get.mockImplementation(mockStorageGet(syncset));

    let sitestore = new SiteStore(storage);

    let a = await sitestore.get();
    expect(storage.get).toHaveBeenCalled();
    expect(a).toEqual(expect.arrayContaining([
        {"sitename": "urla.no", "url": ["url1.com"], "generation": 1, "type": "l", "username": ""},
        {"sitename": "urlb.com", "url": ["url2.co.uk"], "generation": 1, "type": "l", "username": ""},
        {"sitename": "urlb.com", "url": ["url2.de"], "generation": 1, "type": "l", "username": ""}
    ]));
});
