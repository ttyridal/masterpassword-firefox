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
/*jshint browser:true, jquery:true, devel:true, nonstandard:true, -W055 */

"use strict";
import {Site} from "./sites.js";
export default (function() {

function pad_left(len, s, chr) {
    chr = chr || ' ';
    var x, a=[];
    if (typeof s === 'number')
        s = ''+s;
    if (typeof s === 'string') {
        len -= s.length;
        if (len <= 0) return s;
        chr = chr.repeat(len);
        return [chr, s].join('');
    }
    else  {
        for (x of s) {
            if (typeof x  === 'number') x = ''+x;
            len -= x.length;
            a.push(x);
        }
        if (len <= 0) return a.join[''];
        a.unshift(chr.repeat(len));
        return a.join('');
    }
}

class MPsitesImportError extends Error {
  constructor(message) {
    super(message);
    this.name = "MPsitesImportError";
  }
}

function site_as_mpsites_line(site, alg_min_version) {
    const last_used = '2015-03-23T13:06:35Z';
    const use_count = '0';
    const sp2 = '  ';
    return [last_used, sp2,
        pad_left(8, use_count), sp2,
        pad_left(8, [site.type_as_code().toString(), ':', site.required_alg_version(alg_min_version), ':', site.generation]), sp2,
        pad_left(25, site.username), '\t',
        pad_left(25, site.sitename), '\t',
        '\n'].join('');
}

function site_as_mpjson(site, alg_min_version) {
    let o = {};
    o[site.sitename] = {
        "counter": site.generation,
        "algorithm": site.required_alg_version(alg_min_version),
        "type": site.type_as_code(),
        "login_type": 0,
        "uses": 0,
        "last_used": '2015-03-23T13:06:35Z',
        "ext.browser.url": site.url,
        "ext.browser.username": site.username
        }
    if (site.type == 'nx')
        o[site.sitename].login_type = 30;
    if (site.type == 'px') {
        o[site.sitename].questions = { '': { "type": 31 }};
    }
    return o;
}

function read_mpsites(d, username, key_id, confirm_fn){
    let jsn;
    try {
        jsn = JSON.parse(d);
    } catch (e) {
        console.log("failed to parse json.. try legacy mpsites");
        return read_mpsites_legacy(d, username, key_id, confirm_fn);
    }
    if (!('export' in jsn &&
          'sites' in jsn &&
          'user' in jsn &&
          'format' in jsn['export'] &&
          [1,2].includes(jsn['export']['format']))) {
        throw new MPsitesImportError("Not a mpjson v1 file");
    }
    if (username && jsn.user['full_name'] && jsn.user['full_name'] !== username) {
        if (!confirm_fn("Username mismatch!\n\nYou may still import this file, "+
                "but passwords will be different from where you exported the file"))
            return undefined;
    } else if (key_id && jsn.user['key_id'] && jsn.user['key_id'] .toLowerCase() !== key_id.toLowerCase()) {
        if (!confirm_fn("Key ID mismatch!\n\nYou may still import this file, "+
                "but passwords will be different from where you exported the file"))
            return undefined;
    }

    let ret = [];
    for (const [sitename, siteprops] of Object.entries(jsn.sites)) {
        // if login_type is != 0 it's value is actually anything type can take,
        // but we only support 'name'
        if (siteprops.login_type)
            siteprops.type = 'nx'
        // if question exists, it's a dict for different 'keywords' like:
        // "questions": { "keyword": { "type": 19 } }
        // we only support empty keyword ('') and type 'phrase'
        if (siteprops.questions)
            siteprops.type = 'px'
        ret.push(new Site({
            sitename: sitename,
            generation: siteprops.counter || 1,
            type: siteprops.type,
            passalgo: siteprops.algorithm,
            lastused: siteprops.last_used,
            timesused: siteprops.uses,
            url: siteprops["ext.browser.url"] || [],
            username: siteprops["ext.browser.username"]
        }));
    }
    return ret;
}

function read_mpsites_legacy(d, username, key_id, confirm_fn){
    let ret=[],l,fheader={'format':-1, 'key_id':undefined, 'username':undefined};
    const file_header = '# Master Password site export';
    d = d.split('\n');
    d = d.map(function(cv) { return cv.replace(/^\s+|[\r\n]+$/gm,''); });

    if ((l = d.shift()) !== file_header) {
        console.warn("header not as expected", l);
        throw new MPsitesImportError("Not a mpsites file");
    }

    while((l = d.shift()) !== '##'){
        if (!d.length) throw new MPsitesImportError("Not a mpsites file");
    }

    while((l = d.shift()) !== '##'){
        l = l.split(":");
        if (l[0] === '# Format') fheader.format = parseInt(l[1].trim(),10);
        if (l[0] === '# Key ID') fheader.key_id = l[1].trim();
        if (l[0] === '# User Name') fheader.username = l[1].trim();
    }
    if (fheader.format !== 1) {
        console.log(fheader);
        throw new MPsitesImportError("Unsupported mpsites format");
    }
    if (username && fheader.username && fheader.username !== username) {
        if (!confirm_fn("Username mismatch!\n\nYou may still import this file, "+
                "but passwords will be different from where you exported the file"))
            return undefined;
    } else if (key_id && fheader.key_id && fheader.key_id.toLowerCase() !== key_id.toLowerCase()) {
        if (!confirm_fn("Key ID mismatch!\n\nYou may still import this file, "+
                "but passwords will be different from where you exported the file"))
            return undefined;
    }

    for (let line of d) {
        var s,re = /([-0-9T:Z]+)  +([0-9]+)  +([0-9]+):([0-9]+):([0-9]+)  +([^\t]*)\t *([^\t]*)\t(.*)$/g;
        if (line.length === 0 || line.charAt(0) === '#') continue;
        s=re.exec(line);
        if (!s) {
            console.warn("Unexpected sites input", line);
            continue;
        }
        ret.push(new Site({
            lastused: s[1],
            timesused: s[2],
            type: parseInt(s[3]),
            passalgo: parseInt(s[4],10),
            generation: parseInt(s[5],10),
            username: s[6],
            sitename: s[7],
            sitepass: s[8]
        }));
    }

    return ret;
}

function make_mpsites(key_id, username, stored_sites, alg_min_version, alg_version, as_json) {
    if (as_json) {
        let sites = stored_sites.reduce((prev, cur) => Object.assign(prev, site_as_mpjson(cur, alg_min_version)), {});
        return [JSON.stringify({
            "export": {
                "date": new Date().toISOString().slice(0,-2) +'Z',
                "redacted": true,
                "format": 1
            },
            "user": {
                "avatar": 0,
                "full_name": username,
                "algorithm": alg_version,
                "key_id": key_id.toUpperCase(),
                "default_type": 17,
            },
            "sites": sites
        }, null, 2)];
    }

    var a=[ '# Master Password site export\n',
        '#     Export of site names and stored passwords (unless device-private) encrypted with the master key.\n',
        '#\n',
        '##\n',
        '# Format: 1\n',
        '# Date: '+ new Date().toISOString().slice(0,-2) +'Z\n',
        '# User Name: '+username+'\n',
        '# Full Name: '+username+'\n',
        '# Avatar: 0\n',
        '# Key ID: '+key_id.toUpperCase()+'\n',
        '# Version: 2.2\n',
        '# Algorithm: '+alg_version+'\n',
        '# Default Type: 17\n',
        '# Passwords: PROTECTED\n',
        '##\n',
        '#\n',
        '#               Last     Times  Password                      Login\t                     Site\tSite\n',
        '#               used      used      type                       name\t                     name\tpassword\n'];



    for (const site of stored_sites) {
        a.push(site_as_mpsites_line(site, alg_min_version));
    }

    return a;
}

function get_sitesearch(sitename) {
    let y = sitename.split("@");
    if (y.length > 1)
        return y[y.length-1];
    else
        return sitename;
}

async function merge_sites(sites, imported_sites, resolveConflict) {
    let site_index = new Map(sites.map((e, i) => [e.sitename, i]));

    for (let site of imported_sites) {
        if (!site.url || site.url.length==0)
            site.url = [get_sitesearch(site.sitename)];

        let conflict_idx = site_index.get(site.sitename);

        if (conflict_idx !== undefined) {
            let asite = sites[conflict_idx];
            if (site.equal(asite)) {
                asite.url = Array.from(new Set([...site.url, ...asite.url]));
                sites[conflict_idx] = asite;
            } else {
                let url = Array.from(new Set([...site.url, ...asite.url]));
                site = await resolveConflict(site, asite);
                site.url = url;
                sites[conflict_idx] = site;
            }
        } else {
            site_index.set(site.sitename, sites.length);
            sites.push(site);
        }
    }
    return sites;
}



return {
    make_mpsites,
    read_mpsites,
    merge_sites,
    MPsitesImportError
};
}());
