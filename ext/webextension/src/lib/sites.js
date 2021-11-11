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

"use strict";

function encode_utf8(s) {
    return unescape(encodeURIComponent(s));
}
function string_is_plain_ascii(s) {
    return s.length === encode_utf8(s).length;
}


export function Site(site_data) {
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
Site.prototype.equal = function(other) {
    return (this.sitename == other.sitename &&
        this.generation == other.generation &&
        this.type == other.type &&
        this.username == other.username);
}

