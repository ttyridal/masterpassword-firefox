/* Copyright Torbjorn Tyridal 2015

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
/* global browser, window, console, chrome */

(function(){
"use strict";

function store_update(d) {
    browser.runtime.sendMessage({name: 'store_update', data: d});
    let syncset = {};

    Object.keys(d).forEach(k => {
        switch (k) {
            case 'username':
            case 'key_id':
            case 'sites':
                if (!chrome.extension.inIncognitoContext)
                    syncset[k] = d[k];
                break;
            case 'masterkey':
                break;
            default:
                console.info("Trying to store unknown key",k);
                break;
        }
    });
    console.log("chrome storage", Object.keys(syncset));
    chrome.storage.local.set(syncset);
}

function store_get(keys) {
    return new Promise((resolve, fail) => {
        browser.runtime.sendMessage({name: 'store_get'})
        .then(reply => {
            if (!reply) fail("missing reply from store_get");
            let r = {};
            for (let k of keys) {
                switch (k) {
                    //preferences
                    case 'defaulttype':
                    case 'passwdtimeout':
                    case 'pass_store':
                    case 'hotkeycombo':
                    //settings
                    case 'username':
                    case 'masterkey':
                    case 'max_alg_version':
                    case 'key_id':
                    case 'sites':
                        r[k] = reply[k];
                        break;
                        // JSON.parse(JSON.stringify(session_store.sites));
                    default:
                        fail("unknown key requested");
                }
            }
            chrome.storage.local.get(keys, itms => {
                if (itms !== undefined) {
                    for (let k of keys) {
                        if (itms[k] !== undefined) {
                            r[k] = itms[k];
                        }
                    }
                }
                resolve(r);
            });
            // save any changed preferences
            chrome.storage.local.set({
                'defaulttype': reply.defaulttype,
                'passwdtimeout': reply.passwdtimeout,
                'pass_store': reply.pass_store,
                'hotkeycombo': reply.hotkeycombo
            });
        })
        .catch(err => {
            console.error("sendMessage failed",err);
            fail();
        });
    });
}

window.store_update = store_update;
window.store_get = store_get;

console.log("background.js loaded");
}());
