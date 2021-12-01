/* globals global */

"use strict";
import {jest, it, expect, beforeEach} from '@jest/globals'
import config from './config.js'
import {mockStorageGet} from '../../mocks/chromestorage.js'

beforeEach(()=>{
    config.reset();
    global.chrome = {storage:{local:{get:jest.fn().mockImplementation(mockStorageGet()),
                                     set:jest.fn().mockImplementation((_,e)=>e())},
                              sync:{get:jest.fn().mockImplementation(mockStorageGet()),
                                     set:jest.fn().mockImplementation((_,e)=>e())},
                              }};
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

it('saves config default', async () => {
    // chrome default
    global.browser = undefined;

    await config.set({'username':'user', 'key_id':'123', 'pass_store':true, 'passwdtimeout':0});
    expect(global.chrome.storage.sync.set).toHaveBeenCalledWith(
        {'username':'user', 'key_id':'123'}, expect.anything());
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith(
        {'pass_store':true, 'passwdtimeout':0}, expect.anything());

    global.chrome.storage.local.set.mockClear();
    global.chrome.storage.sync.set.mockClear();
    config.reset();

    // firefox default
    global.browser = {};
    await config.set({'username':'user', 'key_id':'123', 'pass_store':true, 'passwdtimeout':0});
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith(
        {'username':'user', 'key_id':'123', 'pass_store':true, 'passwdtimeout':0}, expect.anything());
});

it('saves config sync on', async () => {
    global.browser = undefined;
    // sync on
    global.chrome.storage.local.get.mockImplementation(mockStorageGet({'use_sync': true}));

    await config.set({'username':'user', 'key_id':'123', 'pass_store':true, 'passwdtimeout':0});
    expect(global.chrome.storage.sync.set).toHaveBeenCalledWith(
        {'username':'user', 'key_id':'123'}, expect.anything());
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith(
        {'pass_store':true, 'passwdtimeout':0}, expect.anything());


    global.chrome.storage.local.set.mockClear();
    global.chrome.storage.sync.set.mockClear();
    config.reset();
    global.browser = {};
    await config.set({'username':'user', 'key_id':'123', 'pass_store':true, 'passwdtimeout':0});
    expect(global.chrome.storage.sync.set).toHaveBeenCalledWith(
        {'username':'user', 'key_id':'123'}, expect.anything());
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith(
        {'pass_store':true, 'passwdtimeout':0}, expect.anything());
});


it('saves config sync off', async () => {
    global.browser = undefined;
    // sync on
    global.chrome.storage.local.get.mockImplementation(mockStorageGet({'use_sync': false}));

    await config.set({'username':'user', 'key_id':'123', 'pass_store':true, 'passwdtimeout':0});
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith(
        {'username':'user', 'key_id':'123', 'pass_store':true, 'passwdtimeout':0}, expect.anything());


    global.chrome.storage.local.set.mockClear();
    global.chrome.storage.sync.set.mockClear();
    config.reset();
    global.browser = {};
    await config.set({'username':'user', 'key_id':'123', 'pass_store':true, 'passwdtimeout':0});
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith(
        {'username':'user', 'key_id':'123', 'pass_store':true, 'passwdtimeout':0}, expect.anything());
});
