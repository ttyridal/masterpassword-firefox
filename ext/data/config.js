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

 var stored_sites={},
     username="",
     key_id,
     alg_max_version,
     alg_min_version = 1;

function save_sites_to_backend() {
    var event = document.createEvent('CustomEvent');
    event.initCustomEvent("masterpassword-siteupdate", true, true, stored_sites);
    document.documentElement.dispatchEvent(event);
}

function stored_sites_table_append(domain, site, type, loginname, count, ver) {
    switch(type) {
        case 'x': type="Maximum"; break;
        case 'l': type="Long"; break;
        case 'm': type="Medium"; break;
        case 'b': type="Basic"; break;
        case 's': type="Short"; break;
        case 'i': type="Pin"; break;
        case 'n': type="Name"; break;
        case 'p': type="Phrase"; break;
        default: throw new Error("Unknown password type");
    }
    $('#stored_sites').append('<tr><td>'+site+'<td><input class="domainvalue" type="text" data-old="'+
        domain+'" value="'+domain+'"><td>'+loginname+'<td>'+count+'<td>'+type+'<td>'+ver+
        '<td><img class="delete" src="delete.png">');
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

    while((l = d.shift()) !== '##'){} //jshint ignore:line

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
    } else if (key_id && fheader.key_id && fheader.key_id !== key_id) {
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

window.addEventListener('masterpassword-configload', function(e){
    stored_sites = e.detail.sites;
    username = e.detail.username;
    key_id = e.detail.key_id;
    alg_max_version = e.detail.max_alg_version;

    if (!string_is_plain_ascii(username)) {
        alg_min_version = Math.min(3, alg_max_version);
        if (alg_min_version > 2)
            $('#ver3note').show();
    }


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
});

$(document).on('dragover dragenter', function(e){
    e.preventDefault();
    e.stopPropagation();
});

$('#stored_sites').on('change','.domainvalue',function(e){
    var $t = $(this), domain = $t.attr('data-old'), newdomain = $t.val(), site;
    $t.attr('data-old', newdomain);
    $t=this;
    do {
        $t = $t.parentNode;
    } while($t.nodeName !== 'TR');
    site=$($t).children('td:eq(0)').text();

    if (! (newdomain in stored_sites)) stored_sites[newdomain] = {};
    stored_sites[newdomain][site] = stored_sites[domain][site];
    delete stored_sites[domain][site];
    save_sites_to_backend();
});

$('#stored_sites').on('click','.delete',function(e){
    var $t, t = this;
    console.log(t);
    while (t.parentNode.nodeName !== 'TR') t = t.parentNode;
    if (t.parentNode.nodeName !== 'TR') throw new Error("logic error - cant find parent node");
    t=t.parentNode;
    $t=$(t);

    delete stored_sites[$t.find('td:eq(1) > input').val()][$t.children('td:eq(0)').text()];
    $(t).remove();
    save_sites_to_backend();
});

$(document).on('drop', function(e){
    e.originalEvent.dataTransfer.dropEffect='move';
    e.preventDefault();
    e.stopPropagation();
    if (e.originalEvent.dataTransfer.files.length !== 1) return;
    if (! /.*\.mpsites$/gi.test(e.originalEvent.dataTransfer.files[0].name)) {
        alert("need a .mpsites file");
        return;
    }
    var fr = new FileReader();
    fr.onload=function(x){
        var has_ver1_mb_sites = false;
        try {
            x = read_mpsites(x.target.result, username, key_id, confirm);
            if (!x) return;
        } catch (e) {
            if (e.name === 'mpsites_import_error') {
                alert(e.message);
                return;
            }
            else throw e;
        }

        for (let site of x) {
            let y = site.sitename.split("@");
            if (y.length > 1)
                site.sitesearch = y[y.length-1];
            else
                site.sitesearch = site.sitename;

            stored_sites_table_append(
                site.sitesearch,
                site.sitename,
                site.passtype,
                site.loginname,
                site.passcnt,
                site.passalgo);

            if (site.passalgo < 2 && !string_is_plain_ascii(site.sitename))
                has_ver1_mb_sites = true;

            if (! (site.sitesearch in stored_sites)) stored_sites[site.sitesearch] = {};
            stored_sites[site.sitesearch][site.sitename] = {
                'generation': site.passcnt,
                'type': site.passtype,
                'username': site.loginname
            };
        }

        if (has_ver1_mb_sites)
            alert("Version mismatch\n\nYour file contains site names with non ascii characters from "+
                  "an old masterpassword version. This addon can not reproduce these passwords");
        else
            console.debug('Import successful');

        save_sites_to_backend();
    };
    fr.readAsText(e.originalEvent.dataTransfer.files[0]);

});

$('body').on('click','.export_mpsites',function(){
    start_data_download(make_mpsites(key_id, stored_sites, alg_min_version, alg_max_version), 'firefox.mpsites');
});

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

function make_mpsites(key_id, stored_sites, alg_min_version, alg_version) {
    var a=[ '# Master Password site export\n',
        '#     Export of site names and stored passwords (unless device-private) encrypted with the master key.\n',
        '#\n',
        '##\n',
        '# Format: 1\n',
        '# Date: '+ new Date().toISOString().slice(0,-2) +'Z\n',
        '# User Name: '+username+'\n',
        '# Full Name: '+username+'\n',
        '# Avatar: 0\n',
        '# Key ID: '+key_id+'\n',
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

function start_data_download(stringarr,filename) {
    var a = window.document.createElement('a');
    a.href = window.URL.createObjectURL(new Blob(stringarr, {type: 'text/plain'}));
    a.download = filename;

    // Append anchor to body.
    document.body.appendChild(a);
    a.click();

    // Remove anchor from body
    document.body.removeChild(a);
}

window.mpw_utils = {
    make_mpsites: make_mpsites,
    read_mpsites: read_mpsites
};
}());
