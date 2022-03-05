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
/* globals browser, chrome */

import {SiteStore} from "../lib/sitestore.js";
import {Site} from "../lib/sites.js";
import {defer, copy_to_clipboard} from "../lib/utils.js";
import {parseUri} from "../lib/uritools.js";
import {PslLookup} from '../lib/psllookup.js'
import config from "../lib/config.js";
import mpw from "../lib/mpw.js";
import {ui} from "./ui.js";

const psl = new PslLookup({tableurl: "/src/lib/psllookup.json.png"});

const zip = (a, b) => Array.from(Array(Math.max(b.length, a.length)), (_, i) => [a[i], b[i]]);
function arrayEqualElements(a,b) {
    const z = zip(a,b)
    let i = 0;
    for (i = 0; i < z.length; i++)
        if (z[i][0] != z[i][1]) break;
    return i
}

export function scoreSiteByDomain(site, domainSplitReversed, minScore) {
    const siteurls = site.url.map(u => u.split('.').reverse());

    let score = Math.max(...siteurls.map(u => arrayEqualElements(u, domainSplitReversed)));

    // strip any "name@" if it exists
    // and score on sitename even if not matching on url
    let sitenameurl = site.sitename.replace(/[^@]*(?=@)@?(.*)$/, '$1');
    sitenameurl = sitenameurl.split('.').reverse();
    score = Math.max(score, arrayEqualElements(sitenameurl, domainSplitReversed));

    return score >= minScore ? score : 0;
}

(function () {
"use strict";

let sitestore;

const runtimeSendMessage = (typeof browser !== 'undefined' ?
                       browser.runtime.sendMessage :
                       (msg) => new Promise(suc => chrome.runtime.sendMessage(msg, suc)));

function masterkey_set(masterkey, nosave) {
    return runtimeSendMessage({action: 'masterkey_set',
                        masterkey: masterkey,
                        use_pass_store: config.pass_store && (!nosave),
                        keep_time: config.passwdtimeout})
    .catch(err=>{ console.log("BUG!",err); });
}

function mpwstate_set(mpwstate) {
    return runtimeSendMessage({action: 'mpwstate_set',
                        mpwstate: mpwstate,
                        keep_time: config.passwdtimeout})
    .catch(err=>{ console.log("BUG!",err); });
}

function masterkey_clear() {
    runtimeSendMessage({action: 'masterkey_set', masterkey: null, use_pass_store: false })
    .catch(err=>{ console.log("BUG!",err); });
}

function get_active_tab_url() {
    var ret = new Promise(resolve => {
        chrome.tabs.query({active:true,currentWindow:true}, function(tabres){
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
    config.get(['auto_submit_pass', 'auto_submit_username'])
    .then(v => {
        const url_has_single_site = session_store.num_related_sites == 1;
        let allow_submit = url_has_single_site && v.auto_submit_pass;
        if (!v.auto_submit_username)
            username = '';

        return runtimeSendMessage({action: 'update_page_password',
        pass: pass,
        username: username,
        allow_subframe: true,
        allow_submit: allow_submit});
    })
    .catch(e=>{
        console.info(e);
    });
}

var mpw_promise = defer(),
    session_store = {};

function resolve_mpw(masterkey_or_state) {
    mpw_promise.resolve(
        masterkey_or_state.mpwstate ? mpw(masterkey_or_state.mpwstate) : mpw(
            config.username,
            masterkey_or_state.masterkey,
            config.algorithm_version));
    mpw_promise.then(mpw_session => {
        ui.verify("Verify: " + mpw_session.sitepassword(".", 0, "nx"));

        var key_id = mpw_session.key_id();
        let has_known_keyid = !!config.key_id;

        if (!has_known_keyid) {
            config.set({ key_id: key_id});
        }
        else if (key_id !== config.key_id && masterkey_or_state.masterkey) {
            let masterkey = masterkey_or_state.masterkey;
            warn_keyid_not_matching(()=>{
                config.set({ key_id });
                masterkey_set(masterkey);
                ui.clear_warning();
                ui.user_info("ready");
            });
            return Promise.all([mpw_session, masterkey_set(masterkey_or_state.masterkey, has_known_keyid), false]);
        }
        // always call masterkey_set to reset password timer
        if (masterkey_or_state.masterkey)
            return Promise.all([mpw_session, masterkey_set(masterkey_or_state.masterkey, has_known_keyid), true]);
        else
            return Promise.all([mpw_session, null, true]);
    })
    .then((values)=>{
        // save mpwstate only if key_id matches.. so we can continue to present the warning (on next
        // popup open if not matching
        if (values[2])
            return mpwstate_set(values[0].state());
    })
    .catch(console.error);
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

        if (config.pass_to_clipboard)
            copy_to_clipboard("text/plain", pass);
        if (ui.domain() !== '')
            update_page_password_input(pass, siteconfig.username);
        //if (hide_after_copy) {
        //    addon.port.emit('close');
        //}
        if (config.pass_to_clipboard)
            ui.user_info("Password for " + ui.sitename() + " copied to clipboard");
        else
            ui.user_info("Password for " + ui.sitename() + " ready");
    })
    .catch(console.error);
}

function prepareSitelist(sites, domain, basedomain)
{
    const domainSplitReversed = domain.split('.').reverse();
    const minScoreForRelated = basedomain.split('.').length;

    let scoredSites = sites.map(s=>[scoreSiteByDomain(s, domainSplitReversed, minScoreForRelated),s]);

    scoredSites.sort((a,b) => {
        if (a[0] > b[0]) { return -1; }
        if (a[0] < b[0]) { return 1; }
        if (a[1].sitename < b[1].sitename) { return -1; }
        return 1;
    });

    let num_related = scoredSites.findIndex(s=>s[0]==0);
    if (num_related == -1) num_related=scoredSites.length;

    if (!num_related && basedomain) {
        console.log("insert default site");
        scoredSites.unshift([1, new Site({
            url:[basedomain],
            sitename:basedomain,
            generation: 1,
            username: '',
            type: config.defaulttype})]);
        num_related++;
    }

    // insert a horizontal split in StoredIds separating related from unrelated sites
    if (basedomain)
        scoredSites.splice(num_related, 0, [0, null]);

    return [scoredSites.map(s=>s[1]), num_related];
}

function onDataLoadedUpdateUI(activeurl, sites)
{
    const urlParsed = parseUri(activeurl);
    const protocolsIgnored = ["", "about", "resource", "moz-extension", "chrome-extension", "chrome", "edge", "brave"];
    const domain = protocolsIgnored.includes(urlParsed.protocol) ? '' : urlParsed.domain;
    const basedomain = getBaseDomain(domain);

    let [stored_sites, num_related] = prepareSitelist(sites, domain, basedomain);
    session_store.stored_sites = stored_sites;

    for (let d of document.querySelectorAll('.domain'))
        d.value = basedomain;

    ui.setStoredIds(stored_sites);
    session_store.num_related_sites = num_related;

    if (basedomain) { // expects there to be atleast one related site.. saved or default
        let first = stored_sites[0];
        ui.sitename(first.sitename);
        ui.siteconfig(first.type, first.generation, first.username || '');
    } else
         ui.siteconfig(config.defaulttype, 1, '');
}

// The baseDomain is also known as "eTLD+1", eg www.example.com -> example.com
// and shop.amazon.co.uk -> amazon.co.uk
function getBaseDomain(domain) {
    if (!domain) return '';

    try {
        return psl.getPublicDomain(domain);
    } catch (err) {
        console.warn("psl lookup failed, using fallback", err);

        let domain_parts = domain.split(".");
        let significant_parts = 2;
        const common_slds = ['co','com','gov','govt','net','org','edu','priv','ac'];
        let second_level_domain = domain_parts[domain_parts.length-2].toLowerCase();
        if (domain_parts.length > 2 && common_slds.includes(second_level_domain))
            significant_parts = 3;

        return domain_parts.slice(-significant_parts).join('.');
    }
}

function showSessionSetup() {
    ui.hide('#main');
    ui.show('#sessionsetup');

    if (!config.username) {
        ui.focus('#username');
    } else {
        ui.username(config.username);
        ui.focus('#masterkey');
    }
}

function showMain() {
    ui.hide('#sessionsetup');
    ui.show('#main');
}

function popup(masterkey_or_state) {
    if (!masterkey_or_state) {
        showSessionSetup();
    }
    else if (masterkey_or_state.mpwstate || (config.username && masterkey_or_state.masterkey)) {
        showMain();
        setTimeout(()=>{ resolve_mpw(masterkey_or_state);}, 1); // do later so page paints as fast as possible
    } else {
        showSessionSetup();
    }

    let urlpromise = get_active_tab_url()
    .catch(function(x) { //jshint ignore:line
        console.error('get_active_tab_url failed',x);
        ui.user_warn("failed to get tab url");
        setTimeout(()=>{ui.clear_warning()}, 2000);
        return '';
    });


    sitestore = new SiteStore(config.use_sync ? chrome.storage.sync : chrome.storage.local);
    let sites = sitestore.get()
    .catch(x=>{
        console.error('sitestore.get failed',x);
        ui.user_warn("failed to get sites");
        setTimeout(()=>{ui.clear_warning()}, 2000);
        return [];
    });

    let dataloaded = Promise.all([urlpromise,  sites, psl.waitTableReady()])
    .then((x)=>onDataLoadedUpdateUI(x[0], x[1]))
    .catch(err => console.error(err));

    Promise.all([mpw_promise, dataloaded])
    .then(recalculate)
    .catch(err => console.error(err));
}

window.addEventListener('test_reset', () => {
    mpw_promise = defer();
    session_store = {};
});

window.addEventListener('load', function () {
    if (window.running_under_test)
    {
        window.running_under_test = undefined;
        return;
    }

    config.get([
        'username',
        'key_id',
        'defaulttype',
        'pass_to_clipboard',
        'pass_store',
        'passwdtimeout',
        'use_sync',
    ])
    .then(v=>{
        return runtimeSendMessage({action: 'masterkey_get', use_pass_store: v.pass_store});
    })
    .then(data => {
        if (data.pwgw_failure) {
            let e = ui.user_warn("System password vault failed! ");
            e = e.appendChild(document.createElement('a'));
            e.href = "https://github.com/ttyridal/masterpassword-firefox/wiki/Key-vault-troubleshooting";
            e.target = "_blank";
            e.textContent = "Help?";
            data.masterkey=undefined;
        } else {
            ui.user_info("");
        }
        popup(data);
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

    let username = ui.username(),
        masterkey= ui.masterkey();

    if (username.length < 2) {
        ui.user_warn('Please enter a name (>2 chars)');
        ui.focus('#username');
    }
    else if (masterkey.length < 2) {
        ui.user_warn('Please enter a master key (>2 chars)');
        ui.focus('#masterkey');
    }
    else {
        ui.masterkey('');

        config.set({username});

        ui.hide('#sessionsetup');
        ui.show('#main');
        resolve_mpw({masterkey});
    }
});

function warn_keyid_not_matching(ok_cb)
{
    console.debug("keyids did not match!");
    let e = ui.user_warn("Master password possible mismatch! ");
    e = e.appendChild(document.createElement('button'));
    e.setAttribute('title', "set as new");
    e.textContent = "OK";
    e.onclick = ok_cb;
}

document.querySelector('#main').addEventListener('change', function(ev){
    let sitename = ui.sitename();
    let domain = ui.domain();
    const target_is_sitename_select = ev.target.id === 'sitename';

    const siteidx = session_store.stored_sites.findIndex(e => e ? e.sitename == sitename : false);
    let site = siteidx != -1 ? session_store.stored_sites[siteidx] : null;

    if (!site) {
        if (!target_is_sitename_select) {
            // we would get here if the default-insert is not in stored_sites though...
            console.log("impossible condition?");
            let props = {sitename: sitename, url:[domain]};
            Object.assign(props, ui.siteconfig());
            site = new Site(props);
        } else {
            site = new Site({sitename: sitename, url:[domain], type: config.defaulttype, generation: 1, username:''})
        }
    } else {
        let domainquery = new RegExp('^(.*\\.)?' + domain.replace('.', '\\.') + '$', 'i');
        if (! site.url.map(u => domainquery.test(u)).some(e=>e))
            site.url = Array.from(new Set([...site.url, domain]));
        if (!target_is_sitename_select)
            Object.assign(site, ui.siteconfig());
    }
    if (target_is_sitename_select)
        ui.siteconfig(site.type, site.generation, site.username);

    if (domain !== '' && !chrome.extension.inIncognitoContext) {
        sitestore.addOrReplace(site)
        .catch(e => {
            console.error(e);
            ui.user_warn("save failed: "+e.message);
        });
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

document.querySelector('#copypass').addEventListener('click', function() {
    let pass = document.querySelector('#thepassword').getAttribute('data-pass');
    copy_to_clipboard("text/plain", pass);
    if (pass && pass !== '')
        ui.user_info("Password for " + ui.sitename() + " copied to clipboard");
});

document.querySelector('body').addEventListener('click', function(ev) {
    if (ev.target.classList.contains('btnconfig')) {
//         if (window.matchMedia("only screen and (max-device-width:640px)").matches)
//             chrome.tabs.create({'url': '/src/options/options_mobile.html'}, function() { });
//         else
        chrome.tabs.create({'url': '/src/options/index.html'}, function() { });
        window.close();
    }
    else if (ev.target.classList.contains('btnlogout')) {
        masterkey_clear();
        mpw_promise = defer();
        ui.clear_warning();
        ui.user_info("Session destroyed");
        console.log("session destroyed");
        popup();
    }
});

document.querySelector('#siteconfig_show').addEventListener('click', function() {
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

function indetifierUpdate()
{
    var text = document.querySelector("#username").value;
    text += document.querySelector('#masterkey').value;
    var identifier = document.querySelector('#identifier');
    if (text == '' || text == null || text.length < 6)
    {
        identifier.innerHTML = '';
    }
    else if (text.length >=6)
    {
        var emojiStr = "&#1285";
        var a = 0, b = 0;
        var isA = true;
        for (var i = 0; i < text.length; i++)
        {
            if (isA)
            {
                a += text.charCodeAt(i);
            }
            else 
            {
                b += text.charCodeAt(i);
            }
            isA = !isA;
        }
        a = a % 99;
        b = b % 99;
        var emojiText = emojiStr + a.toString() + "; " + emojiStr + b.toString() + ";";
        identifier.innerHTML = emojiText;
    }
}

document.querySelector("#username").addEventListener('input',indetifierUpdate);
document.querySelector('#masterkey').addEventListener('input', indetifierUpdate);

}());
