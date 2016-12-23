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
/*jshint browser:true, devel:true */
/* globals chrome, mpw */

(function () {
    "use strict";

function parse_uri(sourceUri){
    // stolen with pride: http://blog.stevenlevithan.com/archives/parseuri-split-url
    var uriPartNames = ["source","protocol","authority","domain","port","path","directoryPath","fileName","query","anchor"],
    uriParts = new RegExp("^(?:([^:/?#.]+):)?(?://)?(([^:/?#]*)(?::(\\d*))?)((/(?:[^?#](?![^?#/]*\\.[^?#/.]+(?:[\\?#]|$)))*/?)?([^?#/]*))?(?:\\?([^#]*))?(?:#(.*))?").exec(sourceUri),
    uri = {};
    for(var i = 0; i < 10; i++)
        uri[uriPartNames[i]] = uriParts[i] ? uriParts[i] : "";
    if(uri.directoryPath.length > 0)
        uri.directoryPath = uri.directoryPath.replace(/\/?$/, "/");
    return uri;
}

let ui = {
    hide: function(el) {
        if (typeof el === 'string')
            el = document.querySelector(el);
        el.style.display = 'none';
    },
    show: function(el) {
        if (typeof el === 'string')
            el = document.querySelector(el);
        el.style.display = '';
    },
    toggle: function(el) {
        if (typeof el === 'string')
            el = document.querySelector(el);
        el = el.style;
        el.display = el.display === 'none' ? '' : 'none';
        return el.display === '';
    },

    user_warn: function(s) {
        let e = document.querySelector('#usermessage');
        e.className = 'warning_message';
        e.textContent = s;
        return e;
    },

    user_info: function(s) {
        let e = document.querySelector('#usermessage');
        e.className = 'info_message';
        e.textContent = s;
    },

    domain: function(v) {
        return document.querySelector('#domain').value;
    },

    sitename: function(v) {
        let e = document.querySelector('#sitename'),
            r = e.value;
        if (v !== undefined)
            e.value = v;
        return r;
    },

    siteconfig: function(type, generation, username) {
        let t = document.querySelector('#passwdtype'),
            g = document.querySelector('#passwdgeneration'),
            n = document.querySelector('#loginname');
        let ret = {type: t.value, generation: g.value, username: n.value};
        if (type && generation && username !== undefined) {
            t.value = type;
            g.value = generation;
            n.value = username;
        }
        return ret;
    },

    thepassword: function(visible, real) {
        let e = document.querySelector('#thepassword');
        if (real)
            e.setAttribute('data-pass', real);
        if (e.getAttribute('data-visible') === 'true')
            e.textContent = real || visible;
        else {
            e.innerHTML = '';
            e = e.appendChild(document.createElement('a'));
            e.href = '';
            e.id = 'showpass';
            e.textContent = visible;
        }
    },

    verify: function(s) {
        document.querySelector('#verify_pass_fld').textContent = s;
    }

};

function get_active_tab_url() {
    var ret = new Promise(function(resolve, fail){
        chrome.tabs.query({active:true,windowType:"normal",currentWindow:true}, function(tabres){
        if (tabres.length !== 1) {
            ui.user_warn("Error: bug in tab selector");
            console.log(tabres);
            throw new Error("plugin bug");
        } else
            resolve(tabres[0].url);
        });
    });
    return ret;
}

function copy_to_clipboard(mimetype, data) {
    document.oncopy = function(event) {
        event.clipboardData.setData(mimetype, data);
        event.preventDefault();
    };
    document.execCommand("Copy", false, null);
    document.oncopy=null;
}
function update_page_password_input(pass) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {sender: "no.tyridal.masterpassword", password:pass}, function(response) {
       // response should contain pasted:true on success. don't care currently
    });
    });
}

var mpw_session,
    session_store = {};

function recalculate(hide_after_copy, retry) {
    ui.thepassword("(calculating..)");
    ui.user_info("Please wait...");
    if (!ui.sitename()) {
        ui.thepassword("(need a sitename!)");
        ui.user_info("need sitename");
        return;
    }
    var key_id_mismatch = false;

    if (!mpw_session) {
        mpw_session = mpw( session_store.username, session_store.masterkey, session_store.max_alg_version );

        ui.verify("Verify: " + mpw_session.sitepassword(".", 0, "nx"));

        var key_id = mpw_session.key_id();
        if (session_store.key_id && key_id !== session_store.key_id) {
            warn_keyid_not_matching();
            key_id_mismatch = true;
            chrome.extension.getBackgroundPage().store_update({username: session_store.username, masterkey: session_store.masterkey});
        }
        else {
            session_store.key_id = key_id;
            chrome.extension.getBackgroundPage().store_update({username: session_store.username, masterkey: session_store.masterkey, key_id: key_id});
        }
    }

    let siteconfig = ui.siteconfig();
    siteconfig.generation = parseInt(siteconfig.generation, 10);

    console.debug("calc password " +
            ui.sitename() +
            " . " +
            siteconfig.generation +
            " . " +
            siteconfig.type);

    var i,
        pass = mpw_session.sitepassword(
                ui.sitename(),
                siteconfig.generation,
                siteconfig.type);

        ui.thepassword(Array(pass.length+1).join("\u00B7"), pass); // &middot;

        copy_to_clipboard("text/plain", pass);
        update_page_password_input(pass);
        if (hide_after_copy) {
            addon.port.emit('close');
        }
        if (!key_id_mismatch)
            ui.user_info("Password for " + ui.sitename() + " copied to clipboard");
}

function update_with_settings_for(domain) {
    var keys, site;

    if (typeof session_store.sites === 'undefined' ||
        typeof session_store.sites[domain] === 'undefined') {
        keys = [];
    } else {
        keys = Object.keys(session_store.sites[domain]);
        site = session_store.sites[domain][keys[0]];
    }

    if (keys.length>1)
        ui.show('#storedids_dropdown');
    else if (keys.length === 0) {
        keys[0] = domain;
        site = { generation: 1,
                 username: '',
                 type: session_store.defaulttype
        };
    }

    ui.sitename(keys[0]);
    ui.siteconfig(site.type, site.generation, site.username || '');
}

function popup(session_store_, opened_by_hotkey) {
    var recalc = false;

    session_store = session_store_;
    if (!session_store.username || !session_store.masterkey) {
        ui.hide('#main');
        ui.show('#sessionsetup');
        mpw_session = undefined;
        if (!session_store.username)
            window.setTimeout(function(){
                document.querySelector('#username').focus();
            }, 0.1);
        else {
            document.querySelector('#username').value = session_store.username;
            window.setTimeout(function(){
                document.querySelector('#masterkey').focus();
            }, 0.1);
        }
    } else {
        recalc = true;
        ui.show('#main');
    }

    get_active_tab_url()
    .then(function(url){
        var domain = parse_uri(url).domain.split("."),
            significant_parts = 2;
        if (domain.length > 2 && domain[domain.length-2].toLowerCase() === "co")
            significant_parts = 3;
        while(domain.length > 1 && domain.length > significant_parts)
            domain.shift();
        domain = domain.join(".");
        for (let d of document.querySelectorAll('.domain'))
            d.value = domain;
        update_with_settings_for(domain);
        if(recalc) {
            recalculate(opened_by_hotkey);
        }
    })
    .catch(function(x) { //jshint ignore:line
        console.error('get_active_tab_url failed',x);
    });
}

window.addEventListener('load', function () {
    chrome.extension.getBackgroundPage().store_get(['sites', 'username', 'masterkey', 'key_id', 'max_alg_version', 'defaulttype'])
    .then(data => {popup(data);})
    .catch(() => {
        console.error("Failed loading state from background on popup");
        ui.user_warn("BUG. please check log and report");
    });
},false);

document.querySelector('#sessionsetup > form').addEventListener('submit', function(ev) {
    ev.preventDefault();
    ev.stopPropagation();

    let username = document.querySelector('#username'),
        masterkey= document.querySelector('#masterkey');

    if (username.value.length < 2) {
        ui.user_warn('Please enter a name (>2 chars)');
        username.focus();
    }
    else if (masterkey.value.length < 2) {
        ui.user_warn('Please enter a master key (>2 chars)');
        masterkey.focus();
    }
    else {
        session_store.username = username.value;
        session_store.masterkey= masterkey.value;
        masterkey.value = '';

        ui.hide('#sessionsetup');
        ui.show('#main');
        recalculate();
    }
});

document.querySelector('#storedids_dropdown').addEventListener('click', function(ev){
    let sids = document.querySelector('#storedids');

    if (ui.toggle(sids)) {
        sids.innerHTML = '';
        Object.keys(session_store.sites[ui.domain()]).forEach(function(site){
            sids.appendChild(document.createElement('option')).textContent = site;
        });
        sids.focus();
    }
});

function save_site_changes(){
    let domain = ui.domain();

    if (typeof session_store.sites === 'undefined')
        session_store.sites = {};
    if (typeof session_store.sites[domain] === 'undefined')
        session_store.sites[domain] = {};

    session_store.sites[domain][ui.sitename()] = ui.siteconfig();

    chrome.extension.getBackgroundPage().store_update({sites: session_store.sites});
    if (Object.keys(session_store.sites[domain]).length>1)
        ui.show('#storedids_dropdown');
}

function warn_keyid_not_matching()
{
    console.debug("keyids did not match!");
    let e = ui.user_warn("Master password possible mismatch! ");
    e = e.appendChild(document.createElement('button'));
    e.id = 'change_keyid_ok';
    e.setAttribute('title', "set as new");
    e.textContent = "OK";
}

document.querySelector('#main').addEventListener('change', function(ev){
    if (ev.target.id === 'storedids') {
        let site = ev.target.value,
            val = session_store.sites[ui.domain()][site];

        ui.sitename(site);
        ui.siteconfig(val.type, val.generation, val.username || '');
        ui.hide(ev.target);
    } else
        save_site_changes();
    recalculate();
});

document.querySelector('#thepassword').addEventListener('click', function(ev) {
    let t = ev.target.parentNode;
    t.textContent = t.getAttribute('data-pass');
    t.setAttribute('data-visible', 'true');
    ev.preventDefault();
    ev.stopPropagation();
});

document.querySelector('#mainPopup').addEventListener('click', function(ev) {
    if (ev.target.classList.contains('btnconfig')) {
        ui.hide('#burgermenu');
        chrome.tabs.create({'url': '../options/index.html'}, function(tab) { });
    }
    else if (ev.target.classList.contains('btnlogout')) {
        session_store.masterkey = null;
        ui.hide('#burgermenu');
        chrome.extension.getBackgroundPage().store_update({masterkey: null});
        popup(session_store);
        ui.user_info("session destroyed");
    }
    else if (ev.target.classList.contains('btnburger')) {
        ui.toggle('#burgermenu');
    }
    else if (ev.target.id === 'change_keyid_ok') {
        session_store.key_id = mpw_session.key_id();
        chrome.extension.getBackgroundPage().store_update({
            username: session_store.username,
            masterkey: session_store.masterkey,
            key_id: session_store.key_id,
            force_update: true
        });
        ui.user_info("Password for " + ui.sitename() + " copied to clipboard");
    }
    else if (ev.target.id === 'siteconfig_show') {
        ui.hide(ev.target);
        ui.show('#siteconfig');
    }
});

}());
