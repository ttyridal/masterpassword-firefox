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
/*jshint browser:true */
/*globals self, cloneInto */

window.addEventListener("masterpassword-siteupdate", function(event) {
    self.port.emit('configstore', event.detail);
}, false);

self.port.on("configload", function (d) {
    document.documentElement.dispatchEvent(
        new CustomEvent('masterpassword-configload', {
            detail: cloneInto(d, document.defaultView),
            bubbles: true
        }));
});

self.port.emit('configload', 'lots of fun');
