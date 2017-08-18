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
/*jshint browser:true, devel:true, nonstandard:true, -W055 */
/* globals chrome */

(function(){
function encode_utf8(s) {
  return unescape(encodeURIComponent(s));
}
function string_is_plain_ascii(s) {
    return s.length === encode_utf8(s).length;
}

 var stored_sites={},
     username="",
     key_id,
     alg_max_version,
     alg_min_version = 1;

function save_sites_to_backend() {
    chrome.extension.getBackgroundPage().store_update({sites: stored_sites});

}

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
        default: throw new Error("Unknown password type");
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

function stored_sites_table_update(stored_sites) {
    document.querySelector('#stored_sites > tbody').innerHTML = '';
    Object.keys(stored_sites).forEach(function(domain){
        Object.keys(stored_sites[domain]).forEach(function(site){
            let settings = stored_sites[domain][site],
                alg_version = alg_min_version;

            if (alg_min_version < 3 && !string_is_plain_ascii(site))
                alg_version = 2;
            if (settings.username === undefined)
                settings.username = "";
            stored_sites_table_append(domain,
                site,
                settings.type,
                settings.username,
                settings.generation,
                ""+alg_version);
        });
    });
}

window.addEventListener('load', function() {
    chrome.extension.getBackgroundPage().store_get(['sites', 'username', 'max_alg_version', 'key_id'])
    .then(data => {
        if (data.sites)
            stored_sites = data.sites;
        username = data.username;
        key_id = data.key_id;
        alg_max_version = data.max_alg_version;

        if (!string_is_plain_ascii(username)) {
            alg_min_version = Math.min(3, alg_max_version);
            if (alg_min_version > 2) {
                document.querySelector('#ver3note').style.display = 'inherit';
            }
        }

        stored_sites_table_update(stored_sites);
    })
    .catch(() => {
        console.error("Failed loading state from background on popup");
    });
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
        domain = e.target.getAttribute('data-old'),
        newdomain = e.target.value,
        site = t.querySelector('td:nth-child(1)').textContent;

    if (! (newdomain in stored_sites)) stored_sites[newdomain] = {};
    stored_sites[newdomain][site] = stored_sites[domain][site];
    delete stored_sites[domain][site];
    save_sites_to_backend();
    console.debug('Change',t,domain,newdomain);
    e.target.setAttribute('data-old', newdomain);
});

document.querySelector('#stored_sites').addEventListener('click', function(e) {
    if (!e.target.classList.contains('delete')) return;
    let t = find_parent('TR', e.target);

    let sitesearch = t.querySelector('td:nth-child(2) > input').value,
        sitename = t.querySelector('td:nth-child(1)').textContent;

    delete stored_sites[sitesearch][sitename];
    t.parentNode.removeChild(t);
    save_sites_to_backend();
});


function get_sitesearch(sitename) {
    let y = sitename.split("@");
    if (y.length > 1)
        return y[y.length-1];
    else
        return sitename;
}

function resolveConflict(site) {
    return new Promise(function(resolve, reject){
        let existing = stored_sites[site.sitesearch][site.sitename],
            div = document.querySelector('#conflict_resolve');

        div.querySelector('.sitename').textContent = site.sitename;
        div.querySelector('.domainvalue').textContent = site.sitesearch;
        div.querySelector('.existing_type').textContent = passtype_to_str(existing.type);
        div.querySelector('.existing_count').textContent = existing.generation;
        div.querySelector('.existing_username').textContent = existing.username;

        div.querySelector('.new_type').textContent = passtype_to_str(site.passtype);
        div.querySelector('.new_count').textContent = site.passcnt;
        div.querySelector('.new_username').textContent = site.loginname;

        function click_handler(ev) {
            switch (ev.target.id) {
                case 'existing':
                    resolve(stored_sites[site.sitesearch][site.sitename]);
                    break;
                case 'imported':
                    resolve({'generation': site.passcnt, 'type': site.passtype, 'username': site.loginname});
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

document.addEventListener('drop', function(e) {
    let dt = e.dataTransfer;
    dt.dropEffect='move';
    e.preventDefault();
    e.stopPropagation();
    if (dt.files.length !== 1) return;
    if (! /.*\.mpsites$/gi.test(dt.files[0].name)) {
        alert("need a .mpsites file");
        return;
    }
    var fr = new FileReader();
    fr.onload=function(x){
        var has_ver1_mb_sites = false;
        try {
            x = window.mpw_utils.read_mpsites(x.target.result, username, key_id, confirm);
            if (!x) return;
        } catch (e) {
            if (e.name === 'mpsites_import_error') {
                alert(e.message);
                return;
            }
            else throw e;
        }

        var done = new Promise(function(all_done){
            function popsite() {
                if (! x.length) return false;

                var p, site = x.shift();

                site.sitesearch = get_sitesearch(site.sitename);
                if (site.passalgo < 2 && !string_is_plain_ascii(site.sitename))
                    has_ver1_mb_sites = true;

                if (! (site.sitesearch in stored_sites)) stored_sites[site.sitesearch] = {};
                if (site.sitename in stored_sites[site.sitesearch] &&
                    (stored_sites[site.sitesearch][site.sitename].generation !== site.passcnt ||
                        stored_sites[site.sitesearch][site.sitename].type !== site.passtype ||
                        stored_sites[site.sitesearch][site.sitename].username !== site.loginname)) {

                    p = resolveConflict(site);
                } else {
                    p = Promise.resolve({'generation': site.passcnt, 'type': site.passtype, 'username': site.loginname}, undefined);
                }

                p.then(function(cfg, nextanswer){
                    stored_sites[site.sitesearch][site.sitename] = cfg;
                    if (!popsite())
                        all_done();
                })
                .catch(function(reason){
                    console.error("popsite failed", reason);
                });

                return true;
            }

            if (!popsite())
                all_done();
        });


        done.then(function(){
            stored_sites_table_update(stored_sites);

            if (has_ver1_mb_sites)
                alert("Version mismatch\n\nYour file contains site names with non ascii characters from "+
                      "an old masterpassword version. This addon can not reproduce these passwords");
            else
                console.debug('Import successful');

            save_sites_to_backend();
        })
        .catch(function(err){
            console.error(err);
        });

    };
    fr.readAsText(dt.files[0]);

});

document.querySelector('body').addEventListener('click', function(ev){
    if (ev.target.classList.contains('export_mpsites')) {
        start_data_download(window.mpw_utils.make_mpsites(key_id, username, stored_sites, alg_min_version, alg_max_version), 'firefox.mpsites');
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
    let url = URL.createObjectURL(new Blob(stringarr, {type: 'text/plain'}));
    let p = browser.downloads.download({url: url, filename: filename, saveAs: true});
    p.catch(e=>{
        console.error('browser.download failed',e);
    });
}

}());
