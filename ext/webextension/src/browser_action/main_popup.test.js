/**
 * @jest-environment jsdom
 */
/* globals global, chrome */

import {jest, beforeAll, it, expect, beforeEach, afterEach} from '@jest/globals'
import {Site} from '../lib/sites.js'
import {ui} from './ui.js'

class MockSiteStore {
    get() { return Promise.resolve([
        new Site({sitename: "empty.no", url:['something.else.no'], type:'l'}),
        new Site({sitename: "test.no", url:['test.no'], type:'x'}),
        new Site({sitename: "www.test.no", url:['test.no'], type:'x'})

    ]); }
    addOrReplace() { return Promise.resolve([]); }
}

jest.unstable_mockModule('../lib/sitestore.js', () => {
    return { SiteStore: MockSiteStore };
});

jest.unstable_mockModule('../lib/mpw.js', () => {
    return { default: jest.fn().mockResolvedValue({sitepassword:calcpasswd,
                                              key_id: ()=>{return "yyyy"}}) };
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
            get defaultname() {return ''},
        }
    }
});

let sitename;
let mainpopup;
let libmpw;
let calcpasswd = jest.fn().mockReturnValue('xxxxx');
const real_setTimeout = setTimeout;


beforeAll(async ()=>{
    global.chrome = {
        storage: {local:{}, sync:{}},
        runtime: { sendMessage: jest.fn((lst,cb)=>{cb({})}) },
        tabs: {},
        extension: {inIncognitoContext: false},
    };
    await import('../lib/sitestore.js');
    await import('../lib/config.js');
    libmpw = await import('../lib/mpw.js');

    document.body.innerHTML =
    '<div>' +
    '<div id="sessionsetup"><form></form></div>' +
    '<div id="main"><div id="thepassword"></div>' +
    '<input class="domain" id="domain">' +
    '<input id="sitename">' +
    '<button id="siteconfig_show"></button>' +
    '<button id="copypass"></button>' +
    '<input id="passwdtype">' +
    '<input id="passwdgeneration">' +
    '<input id="loginname"></div>' +
    '<button class="btnlogout" id="btnlogout"></button>' +
    '</div>';


    ui.warn = jest.fn();
    ui.clear_warning = jest.fn();
    ui.user_info = jest.fn();
    ui.user_warn = jest.fn().mockReturnValue({appendChild: (e)=>e});
    ui.username = jest.fn();
    ui.masterkey = jest.fn();
    ui.verify = jest.fn();
    ui.focus = jest.fn();
    chrome.tabs.query = jest.fn((lst,cb)=>{cb([{url: 'http://www.test.no'}])});

    sitename = document.querySelector('#sitename');
    sitename.clearOptions = jest.fn();
    sitename.addOption = jest.fn();

    global.running_under_test = 1;
    mainpopup = await import('./main_popup.js');
    // wait here for the first load event to fire..
    await flushPromises();
});

afterEach(() => {
    jest.useRealTimers();
});

beforeEach(() => {
    window.dispatchEvent(new window.Event('test_reset'));
    jest.restoreAllMocks();
    libmpw.default.mockClear();
    calcpasswd.mockClear();
    sitename.addOption.mockClear();
    chrome.runtime.sendMessage.mockClear();
    chrome.extension.inIncognitoContext = false;
});

const flushPromises = () => new Promise(r=>real_setTimeout(r,3));

it('main_popup.js loads without error', async () => {
//     await import('./main_popup.js');
});

it('main_popup.js login with in memory masterkey', async () => {
    chrome.runtime.sendMessage.mockImplementationOnce((lst,cb)=>{cb({masterkey: 'test'})});
    jest.spyOn(MockSiteStore.prototype, 'get').mockResolvedValueOnce([]);

    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');

    window.dispatchEvent(new window.Event('load'));
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
    jest.spyOn(MockSiteStore.prototype, 'get').mockResolvedValueOnce([]);
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');

    window.dispatchEvent(new window.Event('load'));
    await flushPromises();

    jest.runOnlyPendingTimers()

    expect(chrome.runtime.sendMessage).toHaveBeenCalled();
    expect(libmpw.default).toHaveBeenCalledTimes(0);
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
        new Site({sitename: "test.no", url:['test.no'], type:'x'}),
        new Site({sitename: "wwwtest.no", url:['www.test.no'], type:'x'})]);
    chrome.runtime.sendMessage.mockImplementationOnce((lst,cb)=>{cb({masterkey: 'test'})});

    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');

    window.dispatchEvent(new window.Event('load'));
    await flushPromises();

    jest.runOnlyPendingTimers()

    expect(sitename.addOption).toHaveBeenCalledWith("wwwtest.no");
    expect(sitename.addOption).toHaveBeenCalledWith("test.no");
    expect(sitename.value).toEqual("wwwtest.no");
    await flushPromises();
    expect(calcpasswd).toHaveBeenCalledWith("wwwtest.no", 1, 'x');
});


async function run_to_popup_loaded() {
    chrome.runtime.sendMessage.mockImplementationOnce((lst,cb)=>{cb({masterkey: 'test'})});
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');

    window.dispatchEvent(new window.Event('load'));
    await flushPromises();

    jest.runOnlyPendingTimers()

    expect(sitename.addOption).toHaveBeenCalledWith("www.test.no");
    expect(sitename.addOption).toHaveBeenCalledWith("test.no");
    expect(sitename.value).toEqual("www.test.no");
    await flushPromises();
    expect(calcpasswd).toHaveBeenCalledWith("www.test.no", 1, 'x');
}


it('updates stored site when used on new domain', async () => {
    let addOrReplace = jest.spyOn(MockSiteStore.prototype, 'addOrReplace');
    jest.spyOn(ui, 'siteconfig');

    await run_to_popup_loaded();

    sitename.value='empty.no';
    document.querySelector('#sitename').dispatchEvent(new window.Event('change', { bubbles: true, cancelable: true }));
    await flushPromises();
    expect(ui.siteconfig).toHaveBeenCalledWith('l',1,'');
    expect(calcpasswd).toHaveBeenCalledWith("empty.no", 1, 'l');

    expect(addOrReplace).toHaveBeenCalledWith(expect.objectContaining({
        type:'l',
        sitename:'empty.no',
        url:expect.arrayContaining(['something.else.no', 'test.no'])}));
});


it('does NOT save if in private browsing', async () => {
    jest.spyOn(ui, 'siteconfig');
    const addOrReplace = jest.spyOn(MockSiteStore.prototype, 'addOrReplace');
    chrome.extension.inIncognitoContext = true;

    await run_to_popup_loaded();

    sitename.value='empty.no';
    document.querySelector('#sitename').dispatchEvent(new window.Event('change', { bubbles: true, cancelable: true }));
    await flushPromises();
    expect(ui.siteconfig).toHaveBeenCalledWith('l',1,'');
    expect(calcpasswd).toHaveBeenCalledWith("empty.no", 1, 'l');

    expect(addOrReplace).not.toHaveBeenCalled();
});


it('does not update stored site on a subdomain', async () => {
    jest.spyOn(MockSiteStore.prototype, 'get').mockResolvedValueOnce([
        new Site({sitename: "test.no", url:['test.no'], type:'x'}),
        new Site({sitename: "www.test.no", url:['www.test.no'], type:'x'})]);
    const addOrReplace = jest.spyOn(MockSiteStore.prototype, 'addOrReplace');

    await run_to_popup_loaded();

    let pwtype = document.querySelector('#passwdtype');
    expect(pwtype.value).toBe('x');
    pwtype.value='s';
    pwtype.dispatchEvent(new window.Event('change', { bubbles: true, cancelable: true }));
    await flushPromises();
    expect(calcpasswd).toHaveBeenCalledWith("www.test.no", 1, 's');
    expect(addOrReplace).toHaveBeenCalledWith(expect.objectContaining({
        type:'s',                // <- should change as requested
        sitename:'www.test.no',
        url:['www.test.no']}));  // <- should NOT change
});


it('scoreSiteByDomain', () => {
    let test_no = {sitename:"test.no", url:["test.no"]};
    let www_test_no = {sitename:"test.no", url:["www.test.no"]};
    let wrongsite_no = {sitename:"test.no", url:["unrelated.no"]};
    let unrelated_no = {sitename:"unrelated.no", url:["unrelated.no"]};

    let domain = ["no", "test", "www"];

    //matching the base domain
    expect(mainpopup.scoreSiteByDomain(test_no, domain, 2)).toBe(2);
    //also matching private subdomain is "better"
    expect(mainpopup.scoreSiteByDomain(www_test_no, domain, 2)).toBe(3);
    //matching sitename but non-matching url should still pass
    expect(mainpopup.scoreSiteByDomain(wrongsite_no, domain, 2)).toBe(2);
    //no match (only TLD, not good enough)
    expect(mainpopup.scoreSiteByDomain(unrelated_no, domain, 2)).toBe(0);

    //TODO: need to decide on how to handle this case..
    //is mismatch on the private subdomain disqualifying?
    //let different_prefix = {sitename:"api.test.no", url:["api.test.no"]};
    //expect(mainpopup.scoreSiteByDomain(different_prefix, domain, 2)).toBe(0);

});
