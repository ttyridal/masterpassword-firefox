/* globals global */

"use strict";
import {jest, it, expect, beforeEach} from '@jest/globals'
import config from './config.js'
import {mockStorageGet} from '../../mocks/chromestorage.js'

beforeEach(()=>{
    config.reset();
    global.chrome = {storage:{local:{get:jest.fn()},
                              sync:{get:jest.fn()}}};
});


it('loads a basic config firefox-style', async () => {
    global.browser = {};

    global.chrome.storage.local.get.mockImplementation(mockStorageGet(
        {'username':'username','key_id':'key_id'}));

    let c = await config.get(['username', 'key_id']);
    expect(c).toEqual(expect.objectContaining({'username':'username','key_id':'key_id'}));
});

it('loads a basic config firefox-style sync-off', async () => {
    global.browser = {};

    global.chrome.storage.local.get.mockImplementation(mockStorageGet(
        {'use_sync': false, 'username':'username','key_id':'key_id'}));

    let c = await config.get(['username', 'key_id']);
    expect(c).toEqual(expect.objectContaining({'username':'username','key_id':'key_id'}));
});

it('loads a basic config firefox-style with sync on', async () => {
    global.browser = {};

    global.chrome.storage.local.get.mockImplementation(mockStorageGet(
        {'use_sync': true}));
    global.chrome.storage.sync.get.mockImplementation(mockStorageGet(
        {'username':'username','key_id':'key_id'}));

    let c = await config.get(['username', 'key_id']);
    expect(c).toEqual(expect.objectContaining({'username':'username','key_id':'key_id'}));
});

it('loads a basic config chrome-style', async () => {
    global.browser = undefined;

    global.chrome.storage.local.get.mockImplementation(mockStorageGet(
        {}));
    global.chrome.storage.sync.get.mockImplementation(mockStorageGet(
        {'username':'username','key_id':'key_id'}));

    let c = await config.get(['username', 'key_id']);
    expect(c).toEqual(expect.objectContaining({'username':'username','key_id':'key_id'}));
});

it('loads a basic config chrome-style sync-off', async () => {
    global.browser = undefined;

    global.chrome.storage.local.get.mockImplementation(mockStorageGet(
        {'use_sync': false, 'username':'username','key_id':'key_id'}));

    let c = await config.get(['username', 'key_id']);
    expect(c).toEqual(expect.objectContaining({'username':'username','key_id':'key_id'}));
});

it('loads a basic config chrome-style with sync on', async () => {
    global.browser = undefined;

    global.chrome.storage.local.get.mockImplementation(mockStorageGet(
        {'use_sync': true}));
    global.chrome.storage.sync.get.mockImplementation(mockStorageGet(
        {'username':'username','key_id':'key_id'}));

    let c = await config.get(['username', 'key_id']);
    expect(c).toEqual(expect.objectContaining({'username':'username','key_id':'key_id'}));
});

