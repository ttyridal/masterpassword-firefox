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
/* globals chrome */

"use strict";
import {SiteStore, NeedUpgradeError} from "../lib/sitestore.js";
import mpw_utils from "../lib/mpw-utils.js";
import config from "../lib/config.js";

(function(){
function encode_utf8(s) {
  return unescape(encodeURIComponent(s));
}
function string_is_plain_ascii(s) {
    return s.length === encode_utf8(s).length;
}

var alg_min_version = 1;
let sitestore;

function passtype_to_str(type) {
    switch(type) {
        case 'x': return "Maximum";
        case 'l': return "Long";
        case 'm': return "Medium";
        case 'b': return "Basic";
        case 's': return "Short";
        case 'i': return "Pin";
        case 'n': return "Name";
        case 'p': return "Phrase";
        default: throw new Error("Unknown password type:"+type);
    }
}

function stored_sites_table_append(domain, site, type, loginname, count, ver) {
    let tr = document.importNode(document.querySelector('#stored_sites_row').content, true);
    let x = tr.querySelector('input.domainvalue');
    x.value = domain;
    x.setAttribute('data-old', domain);
    x = tr.querySelectorAll('td');
    x[0].textContent = site;
    x[2].textContent = loginname;
    x[3].textContent = count;
    x[4].textContent = passtype_to_str(type);
    x[5].textContent = ver;

    document.querySelector('#stored_sites > tbody').appendChild(tr);
}

function stored_sites_table_update(sites) {
    document.querySelector('#stored_sites > tbody').innerHTML = '';

    sites.sort((a,b)=>(a.sitename > b.sitename ? 1 : -1));

    for (const site of sites) {
        stored_sites_table_append(site.url,
            site.sitename,
            site.type,
            site.username,
            site.generation,
            ""+site.required_alg_version(alg_min_version));
    }
}

window.addEventListener('load', async function() {
    try {
        let {username, use_sync} = await config.get(['username', 'use_sync']);
        sitestore = new SiteStore(use_sync ? chrome.storage.sync : chrome.storage.local);
        let sites = await sitestore.get();

        let sites_max_version = Math.max(...(sites.map(s => s.required_alg_version(1))));
        alg_min_version = Math.max(sites_max_version, string_is_plain_ascii(username) ? 1 : 3);
        if (alg_min_version > 2)
            document.querySelector('#ver3note').style.display = 'inherit';

        stored_sites_table_update(sites);

        if (sitestore.need_upgrade())
            document.querySelector('.upgrade_datastore').style.display='';
    } catch (err) {
        console.error("Failed loading sites on load", err);
        messagebox("Failed loading sites");
    }
});

function dragover_enter(e){
    e.preventDefault();
    e.stopPropagation();
}
document.addEventListener('dragover', dragover_enter);
document.addEventListener('dragenter', dragover_enter);

function find_parent(name, node) {
    if (!node) throw new Error("node argument required");
    if (!node.parentNode) throw new Error("node has no parent");
    node = node.parentNode;
    while(node.nodeName !== name) {
        if (!node.parentNode) throw new Error("No parent node found matching " + name);
        node = node.parentNode;
    }
    return node;
}

document.querySelector('#stored_sites').addEventListener('change', function(e) {
    if (!e.target.classList.contains('domainvalue')) return;
    let t = find_parent('TR', e.target),
        oldurl = e.target.getAttribute('data-old'),
        newurl = e.target.value,
        sitename = t.querySelector('td:nth-child(1)').textContent;

    const url = Array.from(new Set(newurl.split(',')))
    sitestore.update(sitename, {url})
    .catch (er => {
        if (er instanceof NeedUpgradeError)
            messagebox(er.message);
        else {
            console.error(er.message, er);
            messagebox("Save failed " + er.message);
        }
        e.target.value = oldurl;
    });

    console.debug('Change',t,url,oldurl);
    e.target.setAttribute('data-old', newurl);
});

document.querySelector('#stored_sites').addEventListener('click', function(e) {
    if (!e.target.classList.contains('delete')) return;
    let t = find_parent('TR', e.target);
    let sitename = t.querySelector('td:nth-child(1)').textContent;

    sitestore.remove(sitename)
    .then(()=>t.parentNode.removeChild(t))
    .catch(er => {
        if (er instanceof NeedUpgradeError)
            messagebox(er.message);
        else {
            console.error(er.message, er);
            messagebox("Save failed " + er.message);
        }
    });
});


function resolveConflict(site, existing, AB) {
    return new Promise(resolve => {
        let div = document.querySelector('#conflict_resolve');

        div.querySelector('.sitename').textContent = site.sitename;
        div.querySelector('.domainvalue_existing').textContent = existing.url;
        div.querySelector('.existing_type').textContent = passtype_to_str(existing.type);
        div.querySelector('.existing_count').textContent = existing.generation;
        div.querySelector('.existing_username').textContent = existing.username;

        div.querySelector('.domainvalue_new').textContent = site.url;
        div.querySelector('.new_type').textContent = passtype_to_str(site.type);
        div.querySelector('.new_count').textContent = site.generation;
        div.querySelector('.new_username').textContent = site.username;

        if (AB) {
            div.querySelector('.existing').innerText = div.querySelector('.existing').innerText.replace(/existing/i, 'A');
            div.querySelector('.importing').innerText = div.querySelector('.importing').innerText.replace(/importing/i, 'B');
            div.querySelector('#existing').innerText = 'Keep A';
            div.querySelector('#imported').innerText = 'Keep B';
        }

        function click_handler(ev) {
            switch (ev.target.id) {
                case 'existing':
                    resolve(existing);
                    break;
                case 'imported':
                    resolve(site);
                    break;
                default:
                    return;
            }
            div.removeEventListener('click', click_handler);
            div.style.display = 'none';
        }

        div.addEventListener('click', click_handler);
        div.style.display = '';
    });
}


document.querySelector('#importinput').addEventListener('change', (ev) => {
    var fr=new FileReader();
    fr.onload=function(){
        import_mpsites(fr.result);
    }
    fr.readAsText(ev.target.files[0]);
});

document.addEventListener('drop', function(e) {
    let dt = e.dataTransfer;
    dt.dropEffect='move';
    e.preventDefault();
    e.stopPropagation();
    if (dt.files.length !== 1) return;
    if (! /.*\.(mpsites|mpjson)$/gi.test(dt.files[0].name)) {
        messagebox("Error: need a .mpsites file");
        return;
    }

    if (sitestore.need_upgrade()) {
        messagebox("need data upgrade before import");
        return;
    }

    var fr = new FileReader();
    fr.onload=function(x){
        import_mpsites(x.target.result);
    }
    fr.readAsText(dt.files[0]);
});

async function import_mpsites(data) {
    let imported_sites;

    let {key_id, username} = await config.get(['key_id', 'username']);
    try {
        imported_sites = mpw_utils.read_mpsites(data, username, key_id, confirm);
        if (!imported_sites) return;
    } catch (e) {
        if (e instanceof mpw_utils.MPsitesImportError) {
            messagebox("Error: "+e.message);
            return;
        }
        else throw e;
    }

    let sites = await sitestore.get();

    sites = await mpw_utils.merge_sites(sites, imported_sites, (a,b)=>resolveConflict(a,b,false));

    try {
        await sitestore.set(sites);
    } catch (er) {
        console.error(er.message, er);
        messagebox("Save failed " + er.message);
        return;
    }
    stored_sites_table_update(sites);

    const site_not_compatible = (site) => (site.passalgo < 2 && !string_is_plain_ascii(site.sitename))
    if (imported_sites.some(site_not_compatible))
        alert("Version mismatch\n\nYour file contains site names with non ascii characters from "+
              "an old masterpassword version. This addon can not reproduce these passwords");
    else {
        messagebox('Import successful');
    }
}

document.querySelector('body').addEventListener('click', function(ev){
    if (ev.target.classList.contains('upgrade_datastore')) {
        document.querySelector('#preupgrade').style.display='';
    }
    if (ev.target.classList.contains('upgrade_datastore_now')) {
        document.querySelector('#preupgrade').style.display='none';
        sitestore.get().then(sites => mpw_utils.merge_sites([], sites, (a,b)=>resolveConflict(a,b,true))).then(x => {
            let [sites, _] = x; // eslint-disable-line no-unused-vars
            sitestore.set(sites);
            messagebox("Upgrade complete");
            stored_sites_table_update(sites);
            document.querySelector('.upgrade_datastore').style.display='none';
        });
    }
    if (ev.target.classList.contains('hide_preupgrade')) {
        document.querySelector('#preupgrade').style.display='none';
    }
    if (ev.target.classList.contains('import_mpsites')) {
        if (sitestore.need_upgrade()) {
            messagebox("need data upgrade before import");
            return;
        }
        document.querySelector('#importinput').click();
    }
    if (ev.target.classList.contains('export_mpsites_json')) {

        Promise.all([config.get(['key_id', 'username']), sitestore.get()])
        .then(values => {
            let [{key_id, username}, sites] = values;
            start_data_download(mpw_utils.make_mpsites(key_id, username, sites, alg_min_version, config.algorithm_version, true), 'firefox.mpjson');
        });
    }
    if (ev.target.classList.contains('export_mpsites')) {
        Promise.all([config.get(['key_id', 'username']), sitestore.get()])
        .then(values => {
            let [{key_id, username}, sites] = values;
            start_data_download(mpw_utils.make_mpsites(key_id, username, sites, alg_min_version, config.algorithm_version, false), 'firefox.mpsites');
        });
    }
    if (ev.target.classList.contains('accordion_toggle')) {
        let d = ev.target.parentNode;
        let is_in = d.classList.contains('in');
        let new_height = d.querySelector('div').offsetHeight + d.offsetHeight + 20;
        if (is_in)
            d.style.height = '';
        else
            d.style.height = new_height + 'px';
        d.classList.toggle('in');
        let reset_height = function () {
            d.style.height = '';
            d.removeEventListener('transitionend', reset_height);
        };
        d.addEventListener('transitionend', reset_height);
    }
});

function start_data_download(stringarr,filename) {
    let a = window.document.createElement('a');
    a.href = window.URL.createObjectURL(new Blob(stringarr, {type: 'text/plain'}));
    a.download = filename;

    // Append anchor to body.
    document.body.appendChild(a);
    a.click();

    // Remove anchor from body
    document.body.removeChild(a);
}

document.querySelector('#messagebox > div.progress').addEventListener('transitionend', () => {
    document.querySelector("#messagebox").classList.remove('visible');
});

function messagebox(txt) {
    document.querySelector("#messagebox").classList.add('visible');
    document.querySelector("#messagebox_text").innerHTML = txt;
}

}());
