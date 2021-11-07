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
export default (function() {

function encode_utf8(s) {
  return unescape(encodeURIComponent(s));
}
function string_is_plain_ascii(s) {
    return s.length === encode_utf8(s).length;
}

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

function Site(site_data) {
    if (site_data)
        Object.assign(this, site_data);
    if (this.type && !isNaN(this.type)) {
        let t = new Map([
            [20,'s'],
            [16,'x'],
            [21,'i'],
            [19,'b'],
            [31,'p'],
            [30,'n'],
            [17,'l'],
            [18,'m'],
        ]).get(this.type);
        if (!t)
            console.log('unknown password type, '+this.type);
        else
            this.type = t;
    }

    this.username = this.username || '';
}
Site.prototype.constructor = Site;
Site.prototype.type_as_code = function() {
    switch(this.type){
        case 's': return 20; break;
        case 'x': return 16; break;
        case 'i': return 21; break;
        case 'b': return 19; break;
        case 'p': return 31; break;
        case 'n': return 30; break;
        case 'l': return 17; break;
        case 'm': return 18; break;
        default: throw "unknown password type:" + this.type;
    }
}
Site.prototype.required_alg_version = function(alg_min_version) {
    if (alg_min_version < 3 && !string_is_plain_ascii(this.sitename))
        return 2;
    else
        return alg_min_version;
}
Site.prototype.as_mpsites_line = function(alg_min_version) {
    const last_used = '2015-03-23T13:06:35Z';
    const use_count = '0';
    const sp2 = '  ';
    return [last_used, sp2,
        pad_left(8, use_count), sp2,
        pad_left(8, [this.type_as_code().toString(), ':', this.required_alg_version(alg_min_version), ':', this.generation]), sp2,
        pad_left(25, this.username), '\t',
        pad_left(25, this.sitename), '\t',
        '\n'].join('');
}
Site.prototype.equal = function(other) {
    return (this.sitename == other.sitename &&
        this.generation == other.generation &&
        this.type == other.type &&
        this.username == other.username);
}
Site.prototype.as_mpjson = function(alg_min_version) {
    let o = {};
    o[this.sitename] = {
        "counter": this.generation,
        "algorithm": this.required_alg_version(alg_min_version),
        "type": this.type_as_code(),
        //login_type: 30
        "uses": 0,
        "last_used": '2015-03-23T13:06:35Z',
        "ext.browser.url": this.url,
        "ext.browser.username": this.username
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
          jsn['export']['format'] == 1)) {
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
    d = d.map(function(cv, i, a) { return cv.replace(/^\s+|[\r\n]+$/gm,''); });

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
        let sites = stored_sites.reduce((prev, cur) => Object.assign(prev, cur.as_mpjson(alg_min_version)), {});
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
        a.push(site.as_mpsites_line(alg_min_version));
    }

    return a;
}



return {
    make_mpsites,
    read_mpsites,
    Site,
    MPsitesImportError
};
}());
