/**
 * @jest-environment jsdom
 */
/* globals global, chrome */

import {jest, beforeAll, it, expect, afterEach} from '@jest/globals'
import libconfig from '../lib/config.js'
import {Site} from '../lib/sites.js'
import {ui} from './ui.js'

let sitestore;
let sitename;
let calcpasswd = jest.fn().mockReturnValue('xxxxx');
const real_setTimeout = setTimeout;


beforeAll(async ()=>{
    global.chrome = {
        storage: {local:{}, sync:{}},
        runtime: { },
        tabs: {}
    };
    sitestore = (await import('../lib/sitestore.js')).default;

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
    libconfig.get = jest.fn().mockResolvedValue({username: 'test'});
    libconfig.set = jest.fn();
    jest.spyOn(libconfig, 'username', 'get').mockReturnValue('testuser');
    jest.spyOn(libconfig, 'defaulttype', 'get').mockReturnValue('l');
    jest.spyOn(libconfig, 'pass_to_clipboard', 'get').mockReturnValue(false);
    jest.spyOn(libconfig, 'key_id', 'get').mockReturnValue('yyyy');
    jest.spyOn(libconfig, 'pass_store', 'get').mockReturnValue(false);
    jest.spyOn(libconfig, 'passwdtimeout', 'get').mockReturnValue(-1);
    chrome.tabs.query = jest.fn((lst,cb)=>{cb([{url: 'www.test.no'}])});
    window.mpw = jest.fn().mockResolvedValue({sitepassword:calcpasswd,
                                              key_id: ()=>{return "yyyy"}});

    sitename = document.querySelector('#sitename');
    sitename.clearOptions = jest.fn();
    sitename.addOption = jest.fn();

});

afterEach(() => {
    jest.useRealTimers();
    document.querySelector('#btnlogout').dispatchEvent(new Event('click', {bubbles: true, cancelable: true}));
});


const flushPromises = () => new Promise(r=>real_setTimeout(r,1));

it('main_popup.js loads without error', async () => {
    await import('./main_popup.js');
});

it('main_popup.js login with in memory masterkey', async () => {
    sitestore.get = jest.fn().mockResolvedValue([]);
    chrome.runtime.sendMessage = jest.fn((lst,cb)=>{cb({masterkey: 'test'})});

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
    sitestore.get = jest.fn().mockResolvedValue([]);
    chrome.runtime.sendMessage = jest.fn((lst,cb)=>{cb({})});

    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');

    window.mpw.mockClear();
    calcpasswd.mockClear();

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
    sitestore.get = jest.fn().mockResolvedValue([
        new Site({sitename: "google.com", url:['google.no'], type:'x'}),
        new Site({sitename: "domain.com", url:['test.no'], type:'x'})]);
    chrome.runtime.sendMessage = jest.fn((lst,cb)=>{cb({masterkey: 'test'})});

    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');
    sitename.addOption.mockClear();
    calcpasswd.mockClear();

    window.dispatchEvent(new window.Event('load'));
    await flushPromises();

    jest.runOnlyPendingTimers()

    expect(sitename.addOption).not.toHaveBeenCalledWith("test.no");
    expect(sitename.value).toEqual("domain.com");
    await flushPromises();
    expect(calcpasswd).toHaveBeenCalledWith("domain.com", 1, 'x');

});

it('selects the best match', async () => {
    sitestore.get = jest.fn().mockResolvedValue([
        new Site({sitename: "empty.no", url:['something.else.no'], type:'x'}),
        new Site({sitename: "test.no", url:['test.no'], type:'x'}),
        new Site({sitename: "wwwtest.no", url:['www.test.no'], type:'x'})]);
    chrome.runtime.sendMessage = jest.fn((lst,cb)=>{cb({masterkey: 'test'})});

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


it.skip('prefers matching sitename', async () => {
    sitestore.get = jest.fn().mockResolvedValue([
        new Site({sitename: "empty.no", url:['something.else.no'], type:'x'}),
        new Site({sitename: "test.no", url:['test.no'], type:'x'}),
        new Site({sitename: "www.test.no", url:['test.no'], type:'x'})]);
    chrome.runtime.sendMessage = jest.fn((lst,cb)=>{cb({masterkey: 'test'})});

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
