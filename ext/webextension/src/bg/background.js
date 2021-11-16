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

(function(){
"use strict";

const browser_is_chrome = typeof browser === 'undefined';
if (!browser) {
    var browser = {};
    browser.alarms = chrome.alarms;
    browser.tabs = chrome.tabs;
    browser.management = {
        getSelf: () => {
            return new Promise((success) => chrome.management.getSelf(success));
        }
    };
}

var port;
function port_default_error() { port = undefined; }
function pwvault_gateway(msg) {
    console.log("pwvault_gw:",msg.type);
    // Keeping the port open "forever".. seems to be a bug in firefox
    // not noting that the native-app is gone and it will spinn forever.
    // Like this, we'll at least not trigger that until firefox closes.

    if (!port) {
        port = browser.runtime.connectNative('no.ttyridal.pwvault_gateway');
        port.onDisconnect.addListener(port_default_error);
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
            if (!p) p = "disconnect";
            port = undefined;
            fail(p);
        };

        port.onMessage.addListener(success);
        port.onDisconnect.addListener(error);
        try {
            port.postMessage(msg);
        } catch (err) {
            port.onMessage.removeListener(error);
            port.onDisconnect.removeListener(success);
            fail(err);
        }
    });
}

var _masterkey;
const pw_retention_timer = 'pw_retention_timer';
browser.alarms.onAlarm.addListener(a => {
    if (a.name === pw_retention_timer) {
        _masterkey = undefined;
    }
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.passwdtimeout) {
        if (changes.passwdtimeout.newValue == 0)
            _masterkey = undefined;
        if (changes.passwdtimeout.newValue <= 0)
            browser.alarms.clear(pw_retention_timer);
    }
});

function temp_store_masterkey(k, keep_time) {
    if (!keep_time) return;
    if (keep_time > 0) {
        // create a new alarm with same name will automatically clear the old -> reset :)
        browser.alarms.create(pw_retention_timer, {delayInMinutes: keep_time});
    }
    _masterkey = k;
}

function promised_storage_get(keys) {
    return new Promise(resolve => {
        chrome.storage.local.get(keys, itms => {
            if (itms === undefined) resolve({});
            else resolve(itms);
        });
    });
}

function current_tab() {
    return new Promise(r => {
        chrome.tabs.query({active:true, currentWindow:true}, function(tabs) {
            r(tabs[0]);
        });
    });
}

function find_active_input(tab) {
    const TIMEOUT = 100;

    return new Promise((r,f) => {
        let to, good_response;
        function msgrecv(msg, sender /*, sendResponse*/) {
            if (!msg || msg.id !== chrome.runtime.id)
                return;
            if (msg.action === 'IamActive') {
                good_response = true;
                if (to)
                    window.clearTimeout(to);
                chrome.runtime.onMessage.removeListener(msgrecv);
                r({tab:sender.tab, frameId:sender.frameId, tgt: msg.tgt});
            }
        }
        chrome.runtime.onMessage.addListener(msgrecv);

        chrome.tabs.executeScript(tab && tab.id, {
            file: '/src/cs/findinput.js',
            allFrames: true,
            matchAboutBlank: true
        }, ()=>{
            if (good_response) return;
            to = window.setTimeout(()=>{
                chrome.runtime.onMessage.removeListener(msgrecv);
                f({name: 'update_pass_failed', message:"No password field found (timeout)"});
            }, TIMEOUT);
        });
    });
}

function Update_pass_failed() {
    let t = Error.apply(this, arguments);
    t.name = this.name = 'Update_pass_failed';
    this.message = t.message;
    Object.defineProperty(this, 'stack', {
        get: function() { return t.stack; }
    });
}
var IntermediateInheritor = function () {};
IntermediateInheritor.prototype = Error.prototype;
Update_pass_failed.prototype = new IntermediateInheritor();


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


function update_page_password_impl(pass, username, allow_subframe, allow_submit) {
    return current_tab()
           .then(find_active_input)
           .then(r=>{
               if (r.tgt.type.toLowerCase() === 'password') { /* empty */ }
               else if ((r.tgt.type === '' || r.tgt.type.match(/(text|email|num|tel)/ig)) &&
                    r.tgt.name.match(/.*(user|name|email|login).*/ig)) { /* empty */ }
               else
                   throw new Update_pass_failed("no password field selected");
               if (!allow_subframe && r.frameId)
                   throw new Update_pass_failed("Not pasting to subframe");
               let args = { pass: pass, username: username, autosubmit: allow_submit };
               return chrome.tabs.executeScript(r.tab.id, {
                   code: ';('+_insert_password+'('+JSON.stringify(args)+'));',
                   frameId: r.frameId,
                   matchAboutBlank: true
               });
           })
           .catch(err=>{
               if (err instanceof Update_pass_failed || (err.name && err.name == 'update_pass_failed'))
                   console.log(err.message);
               else
                   console.error("update_page_password", err);});
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
            if (_masterkey) {
                sendResponse({masterkey: _masterkey});
                return;
            } else if (req.use_pass_store) {
                pwvault_gateway({'type':'pwget', 'name':'default'})
                .then(mk => {
                    sendResponse({masterkey: mk.value});
                })
                .catch(err => {
                    console.error("pwvault_gateway failed " + err);
                    sendResponse({pwgw_failure: err});
                });
                return true;
            }
            sendResponse({});
            return;
        case 'masterkey_set':
            if (!req.masterkey) {
                _masterkey = undefined;
            } else if (req.use_pass_store) {
                pwvault_gateway({'type':'pwset','name':'default', 'value': req.masterkey})
                .catch(e => { console.error(e); });
            } else
                temp_store_masterkey(req.masterkey, req.keep_time);
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

Promise.all([browser.management.getSelf(), promised_storage_get(['releasenote_version'], true)])
.then(c => {
    if (c[0].version !== c[1].releasenote_version) {
        browser.tabs.create({
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
