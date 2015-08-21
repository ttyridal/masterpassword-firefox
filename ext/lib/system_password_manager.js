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

/*
 *
 * Minimal dbus api for accessing Secret Services API (gnome keyring / ksecretservice)
 * and Kwallet.
 *
 **/

var dbus = require("./dbus.js").dbus;

const APPNAME = 'masterpassword-for-firefox',
      USAGE = 'masterkey';

function utf8_bytes_to_string(tmp) {
    var s='';
    for (m in tmp) {
        s+=String.fromCharCode(tmp[m]);
    }
    return decodeURIComponent(escape(s));
}

function string_to_utf8_bytes(tmp) {
    return unescape(encodeURIComponent(tmp));
}


function load_secret_services() {
    const key_folder = '/org/freedesktop/secrets/collection/login',
          CollectionInterface = 'org.freedesktop.Secret.Collection',
          ServiceInterface = 'org.freedesktop.Secret.Service',
          ItemInterface = 'org.freedesktop.Secret.Item';

    var bus = dbus();
    if (bus == null) return null;

    bus = bus.get('org.freedesktop.secrets');

    var secret_service = bus.load('/org/freedesktop/secrets').bind(ServiceInterface);
    var tmp = secret_service.get_property('Collections');
    if (tmp.indexOf(key_folder) < 0) {
        console.warn("No "+key_folder+". incompatible setup");
        return null;
    }

    var m = secret_service.method_call('OpenSession');
    m.string_arg('plain');
    m.var_string_arg('');
    var tx_session = m.execute()[1];


    const get_password = function() {
        var col = bus.load(key_folder).bind(CollectionInterface);
        var m = col.method_call('SearchItems');
        m.dict_str_arg({'usage': USAGE, 'appname': APPNAME});
        var key_path = m.execute()[0]
        if (key_path.length == 0) {
            console.info('no keys available');
            return "";
        } else {
            if (key_path.length > 1) {
                console.log(key_path);
                console.warn("more than one alternative key.. blindly using first!");
            }
            key_path = key_path[0];
        }

        var itms = bus.load(key_path).bind(ItemInterface);
        m = itms.method_call('GetSecret');
        m.objpath_arg(tx_session);

        var encoding, pwd = m.execute()[0];
        encoding = pwd[3];
        if (encoding != 'text/plain') {
            console.warn("Stored password is not text/plain. Can't use it");
            return null;
        }
        return utf8_bytes_to_string(pwd[2]);
    }

    const set_password = function(p) {
        var col = bus.load(key_folder).bind(CollectionInterface);
        var m = col.method_call('CreateItem');
        m.secret_services_attributes_arg(APPNAME+' master', {
            'xdg:schema': 'org.freedesktop.Secret.Generic',
            'usage': USAGE,
            'appname': APPNAME
        });
        m.secret_services_passwd_arg(tx_session, [], string_to_utf8_bytes(p), 'text/plain');
        m.bool_arg(true);
        var newitem = m.execute()[0];
        console.log('Created or updated item:',newitem);
    }

    return {'set_password':set_password, 'get_password':get_password};
}


function load_kwallet() {
    const PASSWORD_FOLDER = 'Passwords',
          KEYNAME = APPNAME+'-master';

    var bus = dbus();
    if (bus == null) return null;

    bus = bus.get('org.kde.kwalletd').load('/modules/kwalletd').bind('org.kde.KWallet');

    var handle = (function init(){
        var m = bus.method_call('localWallet'),
            walletname = m.execute()[0];

        if (!walletname) {
            console.log('wallet name get failed', walletname);
            return null;
        }

        m = bus.method_call('open');
        m.string_arg(walletname);
        m.int64_arg(0);
        m.string_arg(APPNAME);
        handle = m.execute()[0];
        console.log('Got handle:',handle);
        return handle;
    }());

    if (!handle) return null;

    const get_password = function () {
        var m = bus.method_call('readPassword');
        m.int_arg(handle);
        m.string_arg(PASSWORD_FOLDER);
        m.string_arg(KEYNAME);
        m.string_arg(APPNAME);
        return m.execute()[0];
    };

    const set_password = function (p) {
        var m = bus.method_call('writePassword');
        m.int_arg(handle);
        m.string_arg(PASSWORD_FOLDER);
        m.string_arg(KEYNAME);
        m.string_arg(p);
        m.string_arg(APPNAME);
        m.execute();
    };

    return {'set_password':set_password, 'get_password':get_password};

}


function global_manager(pref) {
    var lib = null;

    if (pref == 'g') {
        lib = load_secret_services();
        if (lib) {
            console.info("gnome_keyring available & loaded");
            return lib;
        }
    }
    else if (pref == 'k') {
        lib = load_kwallet();
        if (lib) {
            console.info("kwallet available & loaded");
            return lib;
        }
    }

    return null;
}


exports.manager = global_manager
