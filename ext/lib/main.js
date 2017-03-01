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
/* global require, console */

var prefs = require("sdk/simple-prefs").prefs;
var global_prefs  = require("sdk/preferences/service");
var windows = require("sdk/windows");
var isPrivate = require("sdk/private-browsing").isPrivate;
var self = require("sdk/self");
var ss = require("sdk/simple-storage");

console.debug("Stored variables:", Object.keys(ss.storage));
console.debug("Preferences",
    'pass_store', prefs.pass_store,
    'defaulttype', prefs.defaulttype,
    'pass_clear_delay', prefs.pass_clear_delay,
    'pass_to_clipboard', prefs.pass_to_clipboard,
    'hotkeycompbo', prefs.hotkeycombo
);


const webExtension = require("sdk/webextension");
webExtension.startup().then(api => {
    const {browser} = api;
    browser.runtime.onMessage.addListener((msg, sender, sendReply) => {
        if (typeof msg.name === 'undefined') return;
        switch(msg.name) {
            case 'store_get':
                sendReply(store_get());
                break;
            case 'store_update':
                sendReply(store_update(msg.data));
                break;
            default:
                console.warn("sdkcom: unhandled message");
        }
    });
});


function fix_session_store_password_type() {
    console.log('updating masterpassword storage');
    var s,d;
    if (! ss.storage.sites)
    {
        return;
    }
    for (s in ss.storage.sites) {
        if (! ss.storage.sites.hasOwnProperty(s)) continue;
        for (d in ss.storage.sites[s]) {
            if (! ss.storage.sites[s].hasOwnProperty(d)) continue;
            switch (ss.storage.sites[s][d].type) {
                case 'maximum': ss.storage.sites[s][d].type = 'x'; break;
                case 'long': ss.storage.sites[s][d].type = 'l'; break;
                case 'medium': ss.storage.sites[s][d].type = 'm'; break;
                case 'basic': ss.storage.sites[s][d].type = 'b'; break;
                case 'short': ss.storage.sites[s][d].type = 's'; break;
                case 'pin': ss.storage.sites[s][d].type = 'i'; break;
                case 'name': ss.storage.sites[s][d].type = 'n'; break;
                case 'phrase': ss.storage.sites[s][d].type = 'p'; break;
                default: break;
            }
        }
    }
}

if (ss.storage.sites && (!ss.storage.version || ss.storage.version < 2)) {
    fix_session_store_password_type();
}
if (ss.storage.version !== 2) ss.storage.version = 2;

function store_get() {
    return {
        'username': ss.storage.username || null,
        'key_id': ss.storage.key_id,
        'sites': ss.storage.sites || {},
        'defaulttype': prefs.defaulttype,
        'passwdtimeout': prefs.pass_clear_delay,
        'pass_store': prefs.pass_store,
        'pass_to_clipboard': false, //prefs.pass_to_clipboard,
        'hotkeycombo': prefs.hotkeycombo,
        'max_alg_version': global_prefs.get('extensions.' + self.id + '.max_alg_version', 3),
    };
}

function store_update(d) {
    console.debug("main: store_update", Object.keys(d));
    if (isPrivate(windows.activeWindow)) {
        console.log("won't store anything for private windows");
        return;
    }

    for (let i of ['username', 'sites', 'key_id']) {
        if (i in d)
            ss.storage[i] = d[i];
    }
}
