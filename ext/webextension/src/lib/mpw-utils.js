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
/*jshint browser:true, jquery:true, devel:true, nonstandard:true, -W055 */

(function(){

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

function mpsites_import_error(code, message) {
    this.name = 'mpsites_import_error';
    this.message = message || '';
    this.code = code || 0;
    this.stack = (new Error()).stack;
}
mpsites_import_error.prototype = Object.create(Error.prototype);
mpsites_import_error.prototype.constructor = mpsites_import_error;

function read_mpsites(d, username, key_id, confirm_fn){
    var ret=[],l,fheader={'format':-1, 'key_id':undefined, 'username':undefined};
    const file_header = '# Master Password site export';
    d = d.split('\n');
    d = d.map(function(cv, i, a) { return cv.replace(/^\s+|[\r\n]+$/gm,''); });

    if ((l = d.shift()) !== file_header) {
        console.warn("header not as expected", l);
        throw new mpsites_import_error(3, "Not a mpsites file");
    }

    while((l = d.shift()) !== '##'){
        if (!d.length) throw new mpsites_import_error(3, "Not a mpsites file");
    }

    while((l = d.shift()) !== '##'){
        l = l.split(":");
        if (l[0] === '# Format') fheader.format = parseInt(l[1].trim(),10);
        if (l[0] === '# Key ID') fheader.key_id = l[1].trim();
        if (l[0] === '# User Name') fheader.username = l[1].trim();
    }
    if (fheader.format !== 1) {
        console.log(fheader);
        throw new mpsites_import_error(1, "Unsupported mpsites format");
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
        switch(s[3]){
          case '20': s[3]='s'; break;
          case '16': s[3]='x'; break;
          case '21': s[3]='i'; break;
          case '19': s[3]='b'; break;
          case '31': s[3]='p'; break;
          case '30': s[3]='n'; break;
          case '17': s[3]='l'; break;
          case '18': s[3]='m'; break;
          default:console.log('unknown password type, '+s[3]);
        }
        s={
            lastused: s[1],
            timesused: s[2],
            passtype: s[3],
            passalgo: parseInt(s[4],10),
            passcnt: parseInt(s[5],10),
            loginname: s[6],
            sitename: s[7],
            sitepass: s[8]
          };
        ret.push(s);
    }

    return ret;
}



function make_mpsites(key_id, username, stored_sites, alg_min_version, alg_version) {
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

    Object.keys(stored_sites).forEach(function(domain){
        Object.keys(stored_sites[domain]).forEach(function(site){
            let settings = stored_sites[domain][site],
                alg_version = alg_min_version,
                typecode;
            if (alg_min_version < 3 && !string_is_plain_ascii(site))
                alg_version = 2;

            switch(settings.type){
                case 's': typecode = '20'; break;
                case 'x': typecode = '16'; break;
                case 'i': typecode = '21'; break;
                case 'b': typecode = '19'; break;
                case 'p': typecode = '31'; break;
                case 'n': typecode = '30'; break;
                case 'l': typecode = '17'; break;
                case 'm': typecode = '18'; break;
                default: throw "unknown password type";
            }

            a.push( ['2015-03-23T13:06:35Z',
                     '  ', pad_left(8, '0'),
                     '  ', pad_left(8, [typecode, ':', alg_version, ':', settings.generation]),
                     '  ', pad_left(25, settings.username || ''),
                     '\t', pad_left(25, site),
                     '\t\n'].join(''));
        });
    });
    return a;
}



window.mpw_utils = {
    make_mpsites: make_mpsites,
    read_mpsites: read_mpsites
};
}());
