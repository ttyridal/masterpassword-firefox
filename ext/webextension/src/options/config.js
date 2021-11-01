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

 var stored_sites=[],
     username="",
     key_id,
     alg_max_version,
     alg_min_version = 1;

function save_sites_to_backend() {
    browser.runtime.sendMessage({action: 'sites_put', sites: stored_sites})
    .catch(err=>{ console.log("BUG!",err); });
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

function stored_sites_table_update(stored_sites) {
    document.querySelector('#stored_sites > tbody').innerHTML = '';

    for (const site of stored_sites) {
        let asite = new window.mpw_utils.Site(site);

        stored_sites_table_append(site.url,
            asite.sitename,
            asite.type,
            asite.username,
            asite.generation,
            ""+asite.required_alg_version(alg_min_version));
    }
}

window.addEventListener('load', function() {
    browser.runtime.sendMessage({action: 'store_get', keys:
      ['username', 'max_alg_version', 'key_id']})
    .then(data => {
        username = data.username;
        key_id = data.key_id;
        alg_max_version = data.max_alg_version;

        if (!string_is_plain_ascii(username)) {
            alg_min_version = Math.min(3, alg_max_version);
            if (alg_min_version > 2) {
                document.querySelector('#ver3note').style.display = 'inherit';
            }
        }
    })
    .then(()=>{
        return browser.runtime.sendMessage({action: 'site_get', domain: null});
    })
    .then(d => {
        stored_sites = d.sitedata;
        stored_sites_table_update(stored_sites);
    })
    .catch((err) => {
        console.error("Failed loading state from background on popup", err);
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
        sitename = t.querySelector('td:nth-child(1)').textContent,
        siteidx = stored_sites.findIndex(e => e.sitename == sitename);

    if (siteidx == -1) {
        console.error("Can't find", sitename, "for update");
        return;
    }

    stored_sites[siteidx].url = newdomain;
    save_sites_to_backend();
    console.debug('Change',t,domain,newdomain);
    e.target.setAttribute('data-old', newdomain);
});

document.querySelector('#stored_sites').addEventListener('click', function(e) {
    if (!e.target.classList.contains('delete')) return;
    let t = find_parent('TR', e.target);
    let sitename = t.querySelector('td:nth-child(1)').textContent;
    let siteidx = stored_sites.findIndex(e => e.sitename == sitename);
    if (siteidx == -1) {
        console.error("Can't find", sitename, "for delete");
        return;
    }

    stored_sites.splice(siteidx, 1);
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

function resolveConflict(site, existing) {
    return new Promise(function(resolve, reject){
            div = document.querySelector('#conflict_resolve');

        div.querySelector('.sitename').textContent = site.sitename;
        div.querySelector('.domainvalue').textContent = site.sitesearch;
        div.querySelector('.existing_type').textContent = passtype_to_str(existing.type);
        div.querySelector('.existing_count').textContent = existing.generation;
        div.querySelector('.existing_username').textContent = existing.username;

        div.querySelector('.new_type').textContent = passtype_to_str(site.type);
        div.querySelector('.new_count').textContent = site.generation;
        div.querySelector('.new_username').textContent = site.username;

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


document.querySelector('#importinput').addEventListener('change', function(e) {
    var fr=new FileReader();
    fr.onload=function(){
        import_mpsites(fr.result);
    }
    fr.readAsText(this.files[0]);
});

document.addEventListener('drop', function(e) {
    let dt = e.dataTransfer;
    dt.dropEffect='move';
    e.preventDefault();
    e.stopPropagation();
    if (dt.files.length !== 1) return;
    if (! /.*\.mpsites$/gi.test(dt.files[0].name)) {
        messagebox("Error: need a .mpsites file");
        return;
    }
    var fr = new FileReader();
    fr.onload=function(x){
        import_mpsites(x.target.result);
    }
    fr.readAsText(dt.files[0]);
});

async function import_mpsites(data) {
    let has_ver1_mb_sites = false;
    let imported_sites;
    try {
        imported_sites = window.mpw_utils.read_mpsites(data, username, key_id, confirm);
        if (!imported_sites) return;
    } catch (e) {
        if (e.name === 'mpsites_import_error') {
            messagebox("Error: "+e.message);
            return;
        }
        else throw e;
    }


    let stored_site_names = new Set(stored_sites.map(e=>e.sitename));
    console.log(stored_sites);

    for (let site of imported_sites) {
        site.url = get_sitesearch(site.sitename);
        let insert_indx = -1;

        if (stored_site_names.has(site.sitename)) {
            insert_indx = stored_sites.findIndex(e => e.sitename == site.sitename);
            let asite = new window.mpw_utils.Site(stored_sites[insert_indx]);
            if (site.equal(asite)) {
                continue;  // we already have this one.
            } else {
                site = await resolveConflict(site, asite);
            }
        }
        if (site.passalgo < 2 && !string_is_plain_ascii(site.sitename))
            has_ver1_mb_sites = true;

        if (insert_indx != -1)
            stored_sites[insert_indx] = site;
        else
            stored_sites.push(site);

        stored_site_names.add(site.sitename);
    }

    stored_sites_table_update(stored_sites);

    if (has_ver1_mb_sites)
        alert("Version mismatch\n\nYour file contains site names with non ascii characters from "+
              "an old masterpassword version. This addon can not reproduce these passwords");
    else {
        messagebox('Import successful');
    }

    save_sites_to_backend();
};

document.querySelector('body').addEventListener('click', function(ev){
    if (ev.target.classList.contains('import_mpsites')) {
        document.querySelector('#importinput').click();
    }
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
    let a = window.document.createElement('a');
    a.href = window.URL.createObjectURL(new Blob(stringarr, {type: 'text/plain'}));
    a.download = filename;

    // Append anchor to body.
    document.body.appendChild(a);
    a.click();

    // Remove anchor from body
    document.body.removeChild(a);
}

document.querySelector('#messagebox > div.progress').addEventListener('transitionend', ()=> {
    document.querySelector("#messagebox").classList.remove('visible');
});

function messagebox(txt) {
    document.querySelector("#messagebox").classList.add('visible');
    document.querySelector("#messagebox_text").innerHTML = txt;
}

}());
