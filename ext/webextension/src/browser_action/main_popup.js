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
/*jshint browser:true, devel:true */
/* globals chrome, mpw */
import sitestore from "../lib/sitestore.js";
import mpw_utils from "../lib/mpw-utils.js";
import {defer, copy_to_clipboard} from "../lib/utils.js";
import {parseUri} from "../lib/uritools.js";
import {ui} from "./ui.js";

(function () {
"use strict";

const runtimeSendMessage = (typeof browser !== 'undefined' ?
                       browser.runtime.sendMessage :
                       (msg) => new Promise(suc => chrome.runtime.sendMessage(msg, suc)));

    function store_update(data) {
        runtimeSendMessage({action: 'store_update', data: data })
        .catch(err=>{ console.log("BUG!",err); });
    }

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

function update_page_password_input(pass, username) {
    runtimeSendMessage({action: 'update_page_password',
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

function loadSites(domain) {
    const [domain_parts, significant_domain] = domain;
    const domain_parts_r = [...domain_parts].reverse()
    const significant_parts = significant_domain.length;

    const zip = (a, b) => Array.from(Array(Math.max(b.length, a.length)), (_, i) => [a[i], b[i]]);

    const num_equal_elements = (a,b) => {
        const z = zip(a,b)
        let i = 0;
        for (i = 0; i < z.length; i++)
            if (z[i][0] != z[i][1]) break;
        return i
    }

    const url_match_score = (site) => {
        let score = 0;
        for (const u of site.url) {
            score = Math.max(score, num_equal_elements(domain_parts_r, u.split('.').reverse()));
        }
        return score >= significant_parts ? score : 0;
    };

    return sitestore.get()
    .then(sites => {
        const compare_score_then_name = (a, b) => {
            if (a[0] > b[0]) { return -1; }
            if (a[0] < b[0]) { return 1; }
            if (a[1].sitename < b[1].sitename) { return -1; }
            return 1;
        }

        let url_scored_sites = sites.map(s=>[url_match_score(s), s]).sort(compare_score_then_name);
        let num_related=-1;
        let domain = significant_domain.join('.');

        sites = url_scored_sites.map((el,i) => { if (el[0]>=significant_parts) num_related=i; return el[1];});
        num_related++;

        if (!num_related && domain) {
            console.log("insert default site");
            sites.unshift(new mpw_utils.Site({
                url:[domain],
                sitename:domain,
                generation: 1,
                username: '',
                type: session_store.defaulttype}));
            num_related++;
        }
        if (domain)
            sites.splice(num_related, 0, null);

        session_store.stored_sites = sites;

        return [domain, num_related];
    });
}

function updateUIForDomainSettings(combined)
{
    const [domain, num_related] = combined;

    for (let d of document.querySelectorAll('.domain'))
        d.value = domain;

    ui.setStoredIds(session_store.stored_sites);
    if (num_related > 1)
        ui.show('#storedids_dropdown');

    if (domain) {
        let first = session_store.stored_sites[0];
        ui.sitename(first.sitename);
        ui.siteconfig(first.type, first.generation, first.username || '');
    } else
         ui.siteconfig(session_store.defaulttype, 1, '');
}

function extractDomainFromUrl(url) {
    if (!url || url.startsWith('about:')
        || url.startsWith('resource:')
        || url.startsWith('moz-extension:')
        || url.startsWith('chrome-extension:')
        || url.startsWith('chrome:'))
        url = '';
    let domain_parts = parseUri(url).domain.split(".");
    let significant_parts = 2;
    if (domain_parts.length > 2 && domain_parts[domain_parts.length-2].toLowerCase() === "co")
        significant_parts = 3;

    let significant_domain = domain_parts.slice(-significant_parts)
    return [domain_parts, significant_domain];
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
    .then(loadSites)
    .then(updateUIForDomainSettings);

    Promise.all([mpw_promise, urlpromise])
    .then(recalculate);
}

window.addEventListener('load', function () {
    let r = runtimeSendMessage({action: 'store_get', keys:
        ['username', 'masterkey', 'key_id', 'max_alg_version', 'defaulttype', 'pass_to_clipboard']});
    r.then(data => {
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
    document.querySelector('#sitename').open();
});

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
    let sitename = ui.sitename();
    let domain = ui.domain();
    const target_is_sitename_select = ev.target == document.querySelector('mp-combobox');

    const siteidx = session_store.stored_sites.findIndex(e => e ? e.sitename == sitename : false);
    let site = siteidx != -1 ? session_store.stored_sites[siteidx] : null;

    if (!site) {
        if (!target_is_sitename_select) {
            console.log("impossible condition?");
            let props = {sitename: sitename, url:[domain]};
            Object.assign(props, ui.siteconfig());
            site = new mpw_utils.Site(props);
        } else {
            site = new mpw_utils.Site({sitename: sitename, url:[domain], type: session_store.defaulttype, generation: 1, username:''})
        }
    } else {
        site.url = Array.from(new Set([...site.url, domain]));
        // place it at the very top
        session_store.stored_sites.splice(siteidx, 1);
        session_store.stored_sites.unshift(site);
    }

    if (target_is_sitename_select)
        ui.siteconfig(site.type, site.generation, site.username);

    if (domain !== '' && !chrome.extension.inIncognitoContext) {
        try {
            sitestore.addOrReplace(site);
        } catch (e) {
            ui.user_warn(e.message);
        }
    }

    // TODO: remove default site from stored_sites if it exists and it's not the one we're changing
    // --> meaning the user wanted a different sitename for this url

    //     if (session_store.related_sites.length > 1)
    //         ui.show('#storedids_dropdown');

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
