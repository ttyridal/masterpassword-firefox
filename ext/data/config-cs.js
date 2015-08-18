/* Copyright Torbjorn Tyridal 2015

    This file is part of Masterpassword for Firefox.

    Foobar is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Foobar is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Foobar.  If not, see <http://www.gnu.org/licenses/>.
*/

window.addEventListener("masterpassword-siteupdate", function(event) {
    self.port.emit('configstore', event.detail);
}, false);

self.port.on("configload", function (d) {
    var e = document.createEvent('CustomEvent');
    var cloned = cloneInto(d, document.defaultView);
    e.initCustomEvent("masterpassword-configload", true, true, cloned);
    document.documentElement.dispatchEvent(e);
});

self.port.emit('configload', 'lots of fun');
