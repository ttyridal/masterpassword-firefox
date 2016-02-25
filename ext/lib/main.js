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

var buttons = require('sdk/ui/button/toggle');
var clipboard = require("sdk/clipboard");
var panels = require("sdk/panel");
var tabs = require("sdk/tabs");
var { Hotkey } = require("sdk/hotkeys");
var prefs = require("sdk/simple-prefs").prefs;
var global_prefs  = require("sdk/preferences/service");
var windows = require("sdk/windows");
var isPrivate = require("sdk/private-browsing").isPrivate;
var pagemod = require("sdk/page-mod");
var self = require("sdk/self");
var ss = require("sdk/simple-storage");
var { setTimeout, clearTimeout } = require("sdk/timers");
var pwmgr = require("./system_password_manager.js").manager;

var system_password_manager = pwmgr(prefs.pass_store);

console.debug("Stored variables:", Object.keys(ss.storage));


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

var session_store = {
    'username': ss.storage.username || null,
    'masterkey': null,
    'sites': ss.storage.sites || {},
    'defaulttype': prefs.defaulttype,
    'max_alg_version': global_prefs.get('extensions.' + self.id + '.max_alg_version', 3),
    'key_id': ss.storage.key_id
};

if (system_password_manager) {
    system_password_manager.then(function(lib){
        lib.get_password(function(pwd, err){
            if (pwd === undefined) {
                console.log("failed to get master key from os-store", err);
            }
            else if (pwd !== '') {
                session_store.masterkey = pwd;
            }
        });
    });
}

function show_window() {
    var panel = createPanel();
    panel.show({position: button});
    session_store.defaulttype = prefs.defaulttype;
    panel.port.on('loaded' ,function(){ panel.port.emit("popup", session_store,false); });
}

var button = buttons.ToggleButton({
    id: "com_github_ttyridal_masterpassword",
    label: "Master Password",
    icon: {
        "16": "./icon16.png",
        "32": "./icon32.png",
        "64": "./icon64.png"
    },
    onChange: function(state){
        if (state.checked)
            show_window();
    }
});

var hotPassword = new Hotkey({
  combo: prefs.hotkeycombo,
  onPress: show_window
});


var pm_config_handler = pagemod.PageMod({
    include: self.data.url("config.html"),
    contentScriptFile: self.data.url('config-cs.js'),
    attachTo: ['top'],
    onAttach: function(worker) {
        if (!worker.tab || worker.tab.id !== tabs.activeTab.id) {
            worker.destroy();
        }
        worker.port.on('configload', function(m) {
            worker.port.emit('configload', {
                sites:session_store.sites,
                username:session_store.username,
                key_id:session_store.key_id,
                max_alg_version:session_store.max_alg_version
            });
        });
        worker.port.on('configstore', function(d) {
            session_store.sites = d;
            ss.storage.sites = d;
        });
    }
});

var clear_password_timer;
function arm_passwd_clear_timer() {
    if (clear_password_timer !== undefined) {
        clearTimeout(clear_password_timer);
        clear_password_timer = undefined;
    }

    if (prefs.pass_clear_delay > 0) {
        clear_password_timer = setTimeout(function(){
            console.log("timeout() for password retention");
            clear_password_timer = undefined;
            session_store.masterkey = null;
        }, prefs.pass_clear_delay * 60000);
        console.debug("password retention timer armed for " + prefs.pass_clear_delay + " minutes");
    }
}


function createPanel() {
    var panel = panels.Panel({
        width:360,
        height:310,
        contentURL: self.data.url("main_popup.html"),
        onHide: function(){
            button.state('window', {checked: false});
            panel.destroy();
        }
    });
    panel.port.on('close', function() { panel.hide(); });

    panel.port.on('store_update', function(d){
        if (isPrivate(windows.activeWindow)) {
            console.log("won't store anything for private windows");
            return;
        }
        if (d.key_id && d.masterkey && (d.masterkey !== session_store.masterkey || d.force_update)  && prefs.pass_store !== 'n') {
            system_password_manager = system_password_manager || pwmgr(prefs.pass_store);
            if (system_password_manager) {
                system_password_manager.then(function(lib){ lib.set_password(d.masterkey); });
            }
        }

        if (d.masterkey) {
            arm_passwd_clear_timer();
            if (prefs.pass_clear_delay !== 0)
                session_store.masterkey = d.masterkey;
        }
        for (let i of ['username', 'sites', 'key_id']) {
            if (i in d)
                ss.storage[i] = session_store[i] = d[i];
        }
    });
    panel.port.on('openconfig', function(d){
        tabs.open({ url: self.data.url("config.html") });
    });

    panel.port.on('to_clipboard', function(d){
        clipboard.set(d, 'text');
    });
    panel.port.on('get_tab_url', function(d){
        panel.port.emit('get_tab_url_resp', tabs.activeTab.url);
    });
    panel.port.on('update_page_password_input', function(d){
        console.debug("emit to active tab");

        // tab.attach doesn't work with e10s on 43a nightly. :(
        //var worker = tabs.activeTab.attach({ contentScriptFile: self.data.url('password-fill-cs.js') });
        //worker.port.emit('the_password', d);
        var pm = pagemod.PageMod({
            include: tabs.activeTab.url,
            contentScriptFile: self.data.url('password-fill-cs.js'),
            attachTo: ['existing','top'],
            onAttach: function(worker) {
                if (!worker.tab || worker.tab.id !== tabs.activeTab.id) {
                    worker.destroy();
                }
                else {
                    worker.port.emit('the_password', d);
                }
                worker.destroy();
                pm.destroy();
            }
        });
    });
    return panel;
}
