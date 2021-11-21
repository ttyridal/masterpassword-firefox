/**
 * @jest-environment jsdom
 */
/* globals global, chrome */

import {jest, beforeAll, it, expect, beforeEach, afterEach} from '@jest/globals'
import {Site} from '../lib/sites.js'
import {ui} from './ui.js'

class MockSiteStore {
    get() { return Promise.resolve([]); }
}

jest.unstable_mockModule('../lib/sitestore.js', () => {
    return { SiteStore: MockSiteStore };
});

jest.unstable_mockModule('../lib/config.js', () => {
    return {
        default: {
            get: jest.fn().mockResolvedValue({username: 'testuser', use_sync: false}),
            set: jest.fn(),
            get username() {return 'testuser'},
            get defaulttype() {return 'l'},
            get pass_to_clipboard() {return false},
            get pass_store() {return false},
            get use_sync() {return false},
            get key_id() {return 'yyyy'},
            get passwdtimeout() {return -1},
        }
    }
});

let sitename;
let calcpasswd = jest.fn().mockReturnValue('xxxxx');
const real_setTimeout = setTimeout;


beforeAll(async ()=>{
    global.chrome = {
        storage: {local:{}, sync:{}},
        runtime: { sendMessage: jest.fn((lst,cb)=>{cb({})}) },
        tabs: {}
    };
    await import('../lib/sitestore.js');
    await import('../lib/config.js');

    document.body.innerHTML =
    '<div>' +
    '<div id="sessionsetup"><form></form></div>' +
    '<button id="storedids_dropdown"></button>' +
    '<div id="main"><div id="thepassword"></div>' + 
    '<div id="sitename"></div>' + 
    '<button id="siteconfig_show"></button>' +
    '<button id="copypass"></button></div>' +
    '<input id="passwdtype">' +
    '<input id="passwdgeneration">' +
    '<input id="loginname">' +
    '<button class="btnlogout" id="btnlogout"></button>' +
    '</div>';


    ui.warn = jest.fn();
    ui.clear_warning = jest.fn();
    ui.user_info = jest.fn();
    ui.user_warn = jest.fn();
    ui.username = jest.fn();
    ui.masterkey = jest.fn();
    ui.verify = jest.fn();
    ui.focus = jest.fn();
    chrome.tabs.query = jest.fn((lst,cb)=>{cb([{url: 'www.test.no'}])});
    window.mpw = jest.fn().mockResolvedValue({sitepassword:calcpasswd,
                                              key_id: ()=>{return "yyyy"}});

    sitename = document.querySelector('#sitename');
    sitename.clearOptions = jest.fn();
    sitename.addOption = jest.fn();

    await import('./main_popup.js');
});

afterEach(() => {
    jest.useRealTimers();
    document.querySelector('#btnlogout').dispatchEvent(new Event('click', {bubbles: true, cancelable: true}));
});
beforeEach(() => {
    jest.restoreAllMocks();
    window.mpw.mockClear();
    calcpasswd.mockClear();
    sitename.addOption.mockClear();
    chrome.runtime.sendMessage.mockClear();
});

const flushPromises = () => new Promise(r=>real_setTimeout(r,1));

it('main_popup.js loads without error', async () => {
//     await import('./main_popup.js');
});

it('main_popup.js login with in memory masterkey', async () => {
    chrome.runtime.sendMessage.mockImplementationOnce((lst,cb)=>{cb({masterkey: 'test'})});

    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');

    await flushPromises();

    jest.runOnlyPendingTimers()

    expect(chrome.runtime.sendMessage).toHaveBeenCalled();
    expect(chrome.tabs.query).toHaveBeenCalled();
    expect(sitename.addOption).toHaveBeenCalledWith("test.no");
    expect(sitename.value).toEqual("test.no");
    await flushPromises();
    expect(calcpasswd).toHaveBeenCalledWith("test.no", 1, 'l');
});

it('main_popup.js requests login', async () => {
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');

    window.dispatchEvent(new window.Event('load'));
    await flushPromises();

    jest.runOnlyPendingTimers()

    expect(chrome.runtime.sendMessage).toHaveBeenCalled();
    expect(window.mpw).toHaveBeenCalledTimes(0);
    expect(sitename.value).toEqual("test.no");

    expect(ui.focus).toHaveBeenCalledWith('#masterkey');
    expect(calcpasswd).toHaveBeenCalledTimes(0);
    
    ui.username.mockReturnValueOnce('test');
    ui.masterkey.mockReturnValueOnce('test');

    document.querySelector('#sessionsetup > form').dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
    await flushPromises();
    expect(ui.masterkey).toHaveBeenLastCalledWith('');
    expect(calcpasswd).toHaveBeenCalledWith("test.no", 1, 'l');
});

it('selects the matching site instead of default', async () => {
    jest.spyOn(MockSiteStore.prototype, 'get').mockResolvedValueOnce([
        new Site({sitename: "google.com", url:['google.no'], type:'x'}),
        new Site({sitename: "domain.com", url:['test.no'], type:'x'})]);
    chrome.runtime.sendMessage.mockImplementationOnce((lst,cb)=>{cb({masterkey: 'test'})});

    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');

    window.dispatchEvent(new window.Event('load'));
    await flushPromises();

    jest.runOnlyPendingTimers()

    expect(sitename.addOption).not.toHaveBeenCalledWith("test.no");
    expect(sitename.value).toEqual("domain.com");
    await flushPromises();
    expect(calcpasswd).toHaveBeenCalledWith("domain.com", 1, 'x');

});

it('selects the best match', async () => {
    jest.spyOn(MockSiteStore.prototype, 'get').mockResolvedValueOnce([
        new Site({sitename: "empty.no", url:['something.else.no'], type:'x'}),
        new Site({sitename: "test.no", url:['test.no'], type:'x'}),
        new Site({sitename: "wwwtest.no", url:['www.test.no'], type:'x'})]);
    chrome.runtime.sendMessage.mockImplementationOnce((lst,cb)=>{cb({masterkey: 'test'})});

    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');
    sitename.addOption.mockClear();
    calcpasswd.mockClear();

    window.dispatchEvent(new window.Event('load'));
    await flushPromises();

    jest.runOnlyPendingTimers()

    expect(sitename.addOption).toHaveBeenCalledWith("wwwtest.no");
    expect(sitename.addOption).toHaveBeenCalledWith("test.no");
    expect(sitename.value).toEqual("wwwtest.no");
    await flushPromises();
    expect(calcpasswd).toHaveBeenCalledWith("wwwtest.no", 1, 'x');
});


it('prefers matching sitename', async () => {
    jest.spyOn(MockSiteStore.prototype, 'get').mockResolvedValueOnce([
        new Site({sitename: "empty.no", url:['something.else.no'], type:'x'}),
        new Site({sitename: "test.no", url:['test.no'], type:'x'}),
        new Site({sitename: "www.test.no", url:['test.no'], type:'x'})]);
    chrome.runtime.sendMessage.mockImplementationOnce((lst,cb)=>{cb({masterkey: 'test'})});

    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');
    sitename.addOption.mockClear();
    calcpasswd.mockClear();

    window.dispatchEvent(new window.Event('load'));
    await flushPromises();

    jest.runOnlyPendingTimers()

    expect(sitename.addOption).toHaveBeenCalledWith("www.test.no");
    expect(sitename.addOption).toHaveBeenCalledWith("test.no");
    expect(sitename.value).toEqual("www.test.no");
    await flushPromises();
    expect(calcpasswd).toHaveBeenCalledWith("www.test.no", 1, 'x');
});
