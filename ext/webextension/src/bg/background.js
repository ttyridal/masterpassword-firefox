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
/* global browser, window, console */

(function(){
"use strict";


var session_store = {
    'username':null,
    'masterkey':null,
    'defaulttype':'l',
    'max_alg_version': 3,
    'passwdtimeout': -1,
    'key_id': undefined,
    'sites':{},
    'needs_port':true
};

function store_update(d) {
    browser.runtime.sendMessage({name: 'store_update', data: d});
}

function store_get(keys) {
    return new Promise((resolve, fail) => {
        browser.runtime.sendMessage({name: 'store_get'})
        .then(reply => {
            if (!reply) fail("missing reply from store_get");
            let r = {};
            for (let k of keys) {
                switch (k) {
                    case 'username':
                    case 'masterkey':
                    case 'defaulttype':
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
            resolve(r);
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
