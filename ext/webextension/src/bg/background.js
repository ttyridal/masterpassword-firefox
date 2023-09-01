/* Copyright Torbjorn Tyridal 2015-2021

    This file is part of Masterpassword for Firefox (herby known as "the software").

    The software is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    The software is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with the software.  If not, see <http://www.gnu.org/licenses/>.
*/
/* global browser, chrome */

import {defer} from "../lib/utils.js";


(function(){
"use strict";
var cbrowser;

const browser_is_chrome = typeof browser === 'undefined' || Object.getPrototypeOf(browser) !== Object.prototype;
if (browser_is_chrome) {
    console.log("install browser replacement");
    cbrowser = {};
    cbrowser.alarms = chrome.alarms;
    cbrowser.tabs = chrome.tabs;
    cbrowser.runtime = chrome.runtime;
    cbrowser.management = {
        getSelf: () => {
            return new Promise((success) => chrome.management.getSelf(success));
        }
    };
} else
    cbrowser = browser;

chrome.runtime.onInstalled.addListener(details=>{
    switch (details.reason) {
        case "install":
        case "update":
            chrome.storage.local.get('use_sync', settings=>{
                if (typeof settings.use_sync === "undefined") {
                    console.log("plugin "+details.reason+". setting default values");
                    chrome.storage.local.set({use_sync: browser_is_chrome});
                }
            });
            break;
        default:
    }
});

var port;
function port_default_error() { port = undefined; }
function pwvault_gateway(msg) {
    // Keeping the port open "forever".. seems to be a bug in firefox
    // not noting that the native-app is gone and it will spinn forever.
    // Like this, we'll at least not trigger that until firefox closes.

    if (!port) {
        try {
            port = cbrowser.runtime.connectNative('no.ttyridal.pwvault_gateway');
            port.onDisconnect.addListener(port_default_error);
        } catch (e) {
            return Promise.reject(e);
        }
    }

    return new Promise((resolv, fail) => {
        let error;
        let success = r => {
            port.onMessage.removeListener(error);
            port.onDisconnect.removeListener(success);
            resolv(r);
        };
        error = p => {
            p = p.error;
            if (!p)
                p = new Error("ERROR pwgateway disconnected");
            port = undefined;
            fail(p);
            return;
        };

        try {
            port.onMessage.addListener(success);
            port.onDisconnect.addListener(error);
        } catch (err) {
            console.log("Failed to attach listeners", err);
            fail(err);
            return;
        }
        try {
            port.postMessage(msg);
        } catch (err) {
            port.onMessage.removeListener(error);
            port.onDisconnect.removeListener(success);
            fail(err);
        }
    });
}

var _masterkey, _mpwstate;
const pw_retention_timer = 'pw_retention_timer';
cbrowser.alarms.onAlarm.addListener(a => {
    if (a.name === pw_retention_timer) {
        _masterkey = undefined;
        _mpwstate = undefined;
    }
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.passwdtimeout) {
        if (changes.passwdtimeout.newValue == 0) {
            _masterkey = undefined;
            _mpwstate = undefined;
        }
        if (changes.passwdtimeout.newValue <= 0)
            cbrowser.alarms.clear(pw_retention_timer);
    }
});

function temp_store_masterkey(k, keep_time) {
    if (!keep_time) return;
    if (keep_time > 0) {
        // create a new alarm with same name will automatically clear the old -> reset :)
        cbrowser.alarms.create(pw_retention_timer, {delayInMinutes: keep_time});
    }
    _masterkey = k;
}

function temp_store_mpwstate(k, keep_time) {
    if (!keep_time) return;
    if (keep_time > 0) {
        // create a new alarm with same name will automatically clear the old -> reset :)
        cbrowser.alarms.create(pw_retention_timer, {delayInMinutes: keep_time});
    }
    _mpwstate = k;
}

function promised_storage_get(keys) {
    return new Promise(resolve => {
        chrome.storage.local.get(keys, itms => {
            if (itms === undefined) resolve({});
            else resolve(itms);
        });
    });
}

async function current_tab() {
    let queryOptions = { active: true, /*currentWindow:true,*/ lastFocusedWindow: true };
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}

async function find_active_input(tab) {
    const TIMEOUT = 100;
    const done = defer();
    let to = undefined;

    if (!tab) return undefined;

    function msgrecv(msg, sender /*, sendResponse*/) {
        if (!msg || msg.id !== chrome.runtime.id)
            return;
        if (msg.action === 'IamActive') {
            done.resolve({tab:sender.tab, frameId:sender.frameId, tgt: msg.tgt});
        }
    }

    chrome.runtime.onMessage.addListener(msgrecv);
    to = setTimeout(()=>{
        done.resolve(undefined);
    }, TIMEOUT);
    await chrome.scripting.executeScript({
            target: {
                tabId: tab.id,
                allFrames: true,
            },
            files: ['/src/cs/findinput.js'],
        });

    let resp = await done;

    chrome.runtime.onMessage.removeListener(msgrecv);
    clearTimeout(to);
    return resp;
}

function _insert_password(args) {
    let inputf = document.activeElement &&
            document.activeElement.matches('input') &&
            document.activeElement;
    let pwinput = inputf && inputf.type.toLowerCase() === 'password' && inputf;

    if (!inputf) {
        console.warn("inject - but not an active input");
        return;
    }

    if (!pwinput) {
        let inputs = document.querySelectorAll('input');
        let idx = 0;
        for (; inputs[idx] && inputs[idx] !== inputf; idx++)
            ;
        let sib = inputs[idx+1];

        if (args.username && sib && sib.type.toLowerCase() === 'password' && inputf.form === sib.form) {
            pwinput = sib;
            if (!inputf.value) {
                inputf.value = args.username;
                inputf.dispatchEvent(new Event('change', {bubbles: true, cancelable: true}));
                inputf.dispatchEvent(new Event('input', {bubbles: true, cancelable: true}));
            }
        } else {
            console.warn("inject - but nextSibling input is not password");
            return;
        }
    }

    pwinput.dispatchEvent(new Event('focus', {bubbles: false, cancelable: true}));
    pwinput.dispatchEvent(new Event('focusin', {bubbles: true, cancelable: true}));
    window.setTimeout(()=>{
        pwinput.value = args.pass;
        pwinput.dispatchEvent(new Event('change', {bubbles: true, cancelable: true}));
        pwinput.dispatchEvent(new Event('input', {bubbles: true, cancelable: true}));
        if (args.autosubmit && pwinput.form)
            window.setTimeout(()=>{
                let btn = pwinput.form.querySelector('input[type=submit], button[type=submit]');
                let cancelled = !btn.dispatchEvent(new Event('click', {bubbles: true, cancelable: true}));
                if (!cancelled)
                pwinput.form.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
            },20);
    },20);
}


function is_username_or_password_form_element(el) {
    return (el.type.toLowerCase() === 'password')
           || ((el.type === '' || el.type.match(/(text|email|num|tel)/ig))
              && el.name.match(/.*(user|name|email|login).*/ig)
           );
}

async function update_page_password_impl(pass, username, allow_subframe, allow_submit) {
    let r = await find_active_input(await current_tab());

    if (!r || !is_username_or_password_form_element(r.tgt) || (r.frameId && !allow_subframe))
        return;

    const args = { pass: pass, username: username, autosubmit: allow_submit };
    try {
        chrome.scripting.executeScript({
            target: { tabId: r.tab.id, frameIds: [r.frameId] },
            func: _insert_password,
            args: [args]
        });
    } catch (err) {
        console.error("update_page_password", err);
    }
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    // not really necessary according to the docs, but rather safe than sorry.
    if (!sender || !sender.id || sender.id !== chrome.runtime.id) {
        console.log("invalid sender", sender);
        return;
    }
    if (!req || !req.action) {
        console.log("missing request action");
        return;
    }

    switch(req.action) {
        case 'IamActive':  // noisy bastard
            return;
        case 'masterkey_get':
            if (_mpwstate) {
                sendResponse({mpwstate: _mpwstate});
                return;
            }
            if (_masterkey) {
                sendResponse({masterkey: _masterkey});
                return;
            } else if (req.use_pass_store) {
                pwvault_gateway({'type':'pwget', 'name':'default'})
                .then(mk => {
                    sendResponse({masterkey: mk.value});
                })
                .catch(err => {
                    console.error("pwvault_gateway failed ", err);
                    sendResponse({pwgw_failure: err.message});
                });
                return true;
            }
            sendResponse({});
            return;
        case 'masterkey_set':
            if (!req.masterkey) {
                _masterkey = undefined;
                _mpwstate = undefined;
            } else if (req.use_pass_store) {
                pwvault_gateway({'type':'pwset','name':'default', 'value': req.masterkey})
                .catch(e => { console.error(e); });
            } else if (!_mpwstate)
                temp_store_masterkey(req.masterkey, req.keep_time);
            sendResponse({});
            return;
        case 'mpwstate_set':
            _masterkey = undefined;  // no need to keep it around if we have the state
            if (!req.mpwstate) {
                _mpwstate = undefined;
            } else
                temp_store_mpwstate(req.mpwstate, req.keep_time);
            sendResponse({});
            return;
        case 'update_page_password':
            update_page_password_impl(
                        req.pass,
                        req.username,
                        req.allow_subframe,
                        req.allow_submit).then(res=>sendResponse(res));
            return true;
        default:
            console.log("unknown action", req);
    }

});

Promise.all([cbrowser.management.getSelf(), promised_storage_get(['releasenote_version'], true)])
.then(c => {
    // show releasenote if maj.min version differ (ginore patch/beta)
    const this_version = c[0].version.split('.').slice(0,2).join('.');
    const last_run_version = c[1]?.releasenote_version?.split('.').slice(0,2).join('.');
    if (this_version !== last_run_version) {
        cbrowser.tabs.create({
            url: "/src/options/releasenote.html"
          });
        chrome.storage.local.set({releasenote_version: c[0].version});
    }
})
.catch(e => {
    console.error(e);
});

console.log("background.js loaded");
}());
