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

export const ui = {
    hide: function(el) {
        if (typeof el === 'string')
            el = document.querySelector(el);
        el.style.display = 'none';
    },
    show: function(el) {
        if (typeof el === 'string')
            el = document.querySelector(el);
        el.style.display = '';
    },

    focus: function(selector) {
        let el = document.querySelector(selector);
        window.setTimeout(() => {el.focus();}, 15);
    },

    is_visible: function(el) {
        if (typeof el === 'string')
            el = document.querySelector(el);
        el = el.style;
        return el.display !== 'none';
    },

    toggle: function(el) {
        if (typeof el === 'string')
            el = document.querySelector(el);
        el = el.style;
        el.display = el.display === 'none' ? '' : 'none';
        return el.display === '';
    },

    user_warn: function(s) {
        let e = document.querySelector('#usermessage');
        e.className = 'warning_message';
        e.textContent = s;
        return e;
    },

    user_info: function(s) {
        let e = document.querySelector('#usermessage');
        if (e.classList.contains('warning_message'))
            return;  // warnings have priority
        e.className = 'info_message';
        e.textContent = s;
    },

    clear_warning: function() {
        let e = document.querySelector('#usermessage');
        e.classList.remove('warning_message');
    },

    username: function(v) {
        let e = document.querySelector('#username');
        let r = e.value;
        if (v !== undefined)
            e.value = v;
        return r;
    },

    domain: function(v) {
        return document.querySelector('#domain').value;
    },

    sitename: function(v) {
        let e = document.querySelector('#sitename'),
            r = e.value;
        if (v !== undefined)
            e.value = v;
        return r;
    },

    siteconfig: function(type, generation, username) {
        let t = document.querySelector('#passwdtype'),
            g = document.querySelector('#passwdgeneration'),
            n = document.querySelector('#loginname');
        let ret = {type: t.value, generation: g.value, username: n.value};
        if (type && generation && username !== undefined) {
            t.value = type;
            g.value = generation;
            n.value = username;
        }
        return ret;
    },

    thepassword: function(visible, real) {
        let e = document.querySelector('#thepassword');
        if (real)
            e.setAttribute('data-pass', real);
        if (e.getAttribute('data-visible') === 'true')
            e.textContent = real || visible;
        else {
            e.innerHTML = '';
            e = e.appendChild(document.createElement('a'));
            e.href = '';
            e.id = 'showpass';
            e.textContent = visible;
        }
    },

    verify: function(s) {
        document.querySelector('#verify_pass_fld').textContent = s;
    }

};


