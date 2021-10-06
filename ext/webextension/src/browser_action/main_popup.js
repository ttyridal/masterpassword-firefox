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
import {defer} from "../lib/utils.js";

(function () {
    "use strict";

    function store_update(data) {
        browser.runtime.sendMessage({action: 'store_update', data: data })
        .catch(err=>{ console.log("BUG!",err); });
    }

    function sites_get(domain) {
        return browser.runtime.sendMessage({action: 'store_get', keys:['sites']})
        .catch(err=>{ console.log("BUG!",err); });
    }

    function sites_update(domain, sites) {
        return browser.runtime.sendMessage({action: 'store_update', data: {sites}})
        .catch(err=>{ console.log("BUG!",err); });
    }

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

    focus: function(selector) {
        let el = document.querySelector(selector);
        window.setTimeout(() => {el.focus();}, 15);
    },

    is_visible: function(el) {
        if (typeof el === 'string')
            el = document.querySelector(el);
        el = el.style;
        return el.display !== 'none';
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
        if (e.classList.contains('warning_message'))
            return;  // warnings have priority
        e.className = 'info_message';
        e.textContent = s;
    },

    clear_warning: function() {
        let e = document.querySelector('#usermessage');
        e.classList.remove('warning_message');
    },

    username: function(v) {
        let e = document.querySelector('#username');
        let r = e.value;
        if (v !== undefined)
            e.value = v;
        return r;
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
function update_page_password_input(pass, username) {
    browser.runtime.sendMessage({action: 'update_page_password',
        pass: pass,
        username: username,
        allow_subframe: true,
        allow_submit: !ui.is_visible('#storedids_dropdown')})
    .catch(e=>{
        console.info(e);
    });
}

var mpw_promise = defer(),
    session_store = {};

function resolve_mpw() {
    mpw_promise.resolve(
        mpw(
            session_store.username,
            session_store.masterkey,
            session_store.max_alg_version));
    mpw_promise.then(mpw_session => {
        ui.verify("Verify: " + mpw_session.sitepassword(".", 0, "nx"));

        var key_id = mpw_session.key_id();
        if (session_store.key_id && key_id !== session_store.key_id) {
            warn_keyid_not_matching();
            store_update({
                username: session_store.username,
                masterkey: session_store.masterkey});
        }
        else {
            session_store.key_id = key_id;
            store_update({
                username: session_store.username,
                masterkey: session_store.masterkey,
                key_id: key_id});
        }
    });
}

function recalculate() {
    let siteconfig = ui.siteconfig();
    siteconfig.generation = parseInt(siteconfig.generation, 10);

    mpw_promise.then(mpw_session => {
        if (!ui.sitename()) {
            ui.thepassword("(need a sitename!)");
            ui.user_info("need sitename");
            return;
        } else {
            ui.thepassword("(calculating..)");
            ui.user_info("Please wait...");
        }

        console.debug("calc password " +
                ui.sitename() +
                " . " +
                siteconfig.generation +
                " . " +
                siteconfig.type, ui.sitename(), !!ui.sitename());


        let pass = mpw_session.sitepassword(
                ui.sitename(),
                siteconfig.generation,
                siteconfig.type);

        ui.thepassword(Array(pass.length+1).join("\u00B7"), pass); // &middot;

        if (session_store.pass_to_clipboard)
            copy_to_clipboard("text/plain", pass);
        update_page_password_input(pass, siteconfig.username);
        //if (hide_after_copy) {
        //    addon.port.emit('close');
        //}
        if (session_store.pass_to_clipboard)
            ui.user_info("Password for " + ui.sitename() + " copied to clipboard");
        else
            ui.user_info("Password for " + ui.sitename() + " ready");
    });
}

function loadSettings(domain) {
    return sites_get(domain)
    .then(d=>{
        Object.assign(session_store, d);
        return domain;
    });
}

function updateUIForDomainSettings(domain)
{
    let keys = [];
    let site = undefined;
    if (domain === '' || typeof session_store.sites[domain] === 'undefined') {
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

    for (let d of document.querySelectorAll('.domain'))
        d.value = domain;
}

function extractDomainFromUrl(url) {
    if (url.startsWith('about:') || url.startsWith('resource:') || url.startsWith('moz-extension:'))
        url = '';
    var domain = parse_uri(url).domain.split("."),
        significant_parts = 2;
    if (domain.length > 2 && domain[domain.length-2].toLowerCase() === "co")
        significant_parts = 3;
    while(domain.length > 1 && domain.length > significant_parts)
        domain.shift();
    domain = domain.join(".");
    return domain;
}

function showSessionSetup() {
    ui.hide('#main');
    ui.show('#sessionsetup');

    if (!session_store.username) {
        ui.focus('#username');
    } else {
        ui.username(session_store.username);
        ui.focus('#masterkey');
    }
}

function showMain() {
    ui.hide('#sessionsetup');
    ui.show('#main');
}

function popup() {
    if (session_store.username && session_store.masterkey) {
        showMain();
        setTimeout(()=>{ resolve_mpw();}, 1); // do later so page paints as fast as possible
    } else {
        showSessionSetup();
    }

    let urlpromise = get_active_tab_url()
    .catch(function(x) { //jshint ignore:line
        console.error('get_active_tab_url failed',x);
        ui.user_warn("failed to get tab url");
        setTimeout(()=>{ui.clear_warning()}, 2000);
        return '';
    })
    .then(extractDomainFromUrl)
    .then(loadSettings)
    .then(updateUIForDomainSettings);

    Promise.all([mpw_promise, urlpromise])
    .then(recalculate);
}

window.addEventListener('load', function () {
    browser.runtime.sendMessage({action: 'store_get', keys:
        ['username', 'masterkey', 'key_id', 'max_alg_version', 'defaulttype', 'pass_to_clipboard']})
    .then(data => {
        if (data.pwgw_failure) {
            let e = ui.user_warn("System password vault failed! ");
            e = e.appendChild(document.createElement('a'));
            e.href = "https://github.com/ttyridal/masterpassword-firefox/wiki/Key-vault-troubleshooting";
            e.target = "_blank";
            e.textContent = "Help?";
            data.masterkey=undefined;
            session_store.username = data.username;
        } else {
            ui.user_info("");
            Object.assign(session_store, data);
        }
        popup();
    })
    .catch(err => {
        console.error(err);
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
        resolve_mpw();
    }
});

document.querySelector('#storedids_dropdown').addEventListener('click', function(ev){
    let sids = document.querySelector('#storedids');

    if (ui.toggle(sids)) {
        sids.innerHTML = '';
        Object.keys(session_store.sites[ui.domain()]).forEach(function(site){
            sids.appendChild(document.createElement('li')).textContent = site;
        });
        ui.show(sids);
        sids.focus();
    }
});

document.querySelector('#storedids').addEventListener('click', function(ev) {
    let site = ev.target.textContent,
        val = session_store.sites[ui.domain()][site];
    ui.sitename(site);
    ui.siteconfig(val.type, val.generation, val.username || '');
    ui.hide(ev.target.parentNode);
    ev.target.parentNode.blur();
    window.setTimeout(recalculate, 1);
});

document.querySelector('#storedids').addEventListener('blur', e=>{
    window.setTimeout(()=>{
        ui.hide(document.querySelector('#storedids'));
    },1);
});



function save_site_changes(){
    let domain = ui.domain();

    if (typeof session_store.sites === 'undefined')
        session_store.sites = {};
    if (typeof session_store.sites[domain] === 'undefined')
        session_store.sites[domain] = {};

    session_store.sites[domain][ui.sitename()] = ui.siteconfig();

    if (domain !== '' && !chrome.extension.inIncognitoContext)
        sites_update(domain, session_store.sites);

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
        save_site_changes();
    recalculate();
});

document.querySelector('#thepassword').addEventListener('click', function(ev) {
    let t = ev.target.parentNode;
    let dp = t.getAttribute('data-pass');
    if (dp) {
        t.textContent = dp;
        t.setAttribute('data-visible', 'true');
    }
    ev.preventDefault();
    ev.stopPropagation();
});

document.querySelector('#copypass').addEventListener('click', function(ev) {
    let pass = document.querySelector('#thepassword').getAttribute('data-pass');
    copy_to_clipboard("text/plain", pass);
    if (pass && pass !== '')
        ui.user_info("Password for " + ui.sitename() + " copied to clipboard");
});

document.querySelector('body').addEventListener('click', function(ev) {
    if (ev.target.classList.contains('btnconfig')) {
        chrome.tabs.create({'url': '../options/index.html'}, function(tab) { });
    }
    else if (ev.target.classList.contains('btnlogout')) {
        session_store.masterkey = null;
        store_update({masterkey: null});
        mpw_promise = defer();
        ui.clear_warning();
        ui.user_info("Session destroyed");
        popup();
    }
    else if (ev.target.id === 'change_keyid_ok') {
        mpw_promise.then(mpw_session => {
            session_store.key_id = mpw_session.key_id();
            store_update({
                username: session_store.username,
                masterkey: session_store.masterkey,
                key_id: session_store.key_id,
                force_update: true
            });
        });
        ui.clear_warning();
        ui.user_info("ready");
    }
});

document.querySelector('#siteconfig_show').addEventListener('click', function(ev) {
    let sc = document.querySelector('#siteconfig');
    sc.style.transform = 'scale(0,0)';
    sc.style.transformOrigin = '0 0';
    sc.style.transition = 'none';
    window.setTimeout(()=>{
        sc.style.transition = '0.2s ease-out';
        sc.style.transform = 'scale(1,1)';
    }, 1);
    ui.show(sc);
    ui.hide('#siteconfig_show');
});

}());
