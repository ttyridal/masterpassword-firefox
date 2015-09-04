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

    if (dbus == null) return false;
    var bus = dbus();
    if (bus == null) return false;
    bus = bus.get('org.freedesktop.secrets');

    function secret_services_object(tx_session) {
        const col = bus.load(key_folder).bind(CollectionInterface);

        const get_password = function(cb) {
            var m = col.method_call('SearchItems');
            m.dict_str_arg({'usage': USAGE, 'appname': APPNAME});
            m.execute()
            .then(function(key_path){
                key_path = key_path[0];

                if (key_path.length == 0) {
                    console.info('no keys available');
                    cb('');
                    return;
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
                return m.execute();
            }).then(function(pwd){
                pwd = pwd[0];
                var encoding = pwd[3];
                pwd = pwd[2];
                if (encoding != 'text/plain')
                    cb(undefined, "Stored password is not text/plain. Can't use it");
                else
                    cb(utf8_bytes_to_string(pwd), undefined);
            });
        }

        const set_password = function(p) {
            var m = col.method_call('CreateItem');
            m.secret_services_attributes_arg(APPNAME+' master', {
                'xdg:schema': 'org.freedesktop.Secret.Generic',
                'usage': USAGE,
                'appname': APPNAME
            });
            m.secret_services_passwd_arg(tx_session, [], string_to_utf8_bytes(p), 'text/plain');
            m.bool_arg(true);
            m.execute().then(function(newitem){
                console.log('Created or updated item:',newitem);
            });
        }

        return {'set_password':set_password, 'get_password':get_password};
    }



    return new Promise(function(lib_load_resolved, lib_load_rejected){
        var secret_service = bus.load('/org/freedesktop/secrets').bind(ServiceInterface);
        secret_service.get_property('Collections')
        .then(function(ret){
            if (ret.indexOf(key_folder) < 0) {
                console.warn("No "+key_folder+". incompatible setup");
                lib_load_rejected();
            } else {
                var m = secret_service.method_call('OpenSession');
                m.string_arg('plain');
                m.var_string_arg('');
                m.execute().then(function(dta){
                    lib_load_resolved( secret_services_object(dta[1]) );
                });
            }
        }).catch(function(reason){
            console.error("secret services (gnome keyring) load failed:",reason.message,'\n', reason.stack);
        });
    });

}


function load_kwallet() {
    const PASSWORD_FOLDER = 'Passwords',
          KEYNAME = APPNAME+'-master';

    if (dbus == null) return null;
    var bus = dbus();
    if (bus == null) return null;
    bus = bus.get('org.kde.kwalletd').load('/modules/kwalletd').bind('org.kde.KWallet');


    return new Promise(function(lib_load_resolved, lib_load_rejected){
        var m = bus.method_call('localWallet');
        m.execute().then(function(walletname){
            walletname = walletname[0];
            if (!walletname) {
                console.log("wallet name get failed", walletname);
                throw new Error("Wallet name get failed");
            } else
                return walletname;
        }).then(function(walletname){
            m = bus.method_call('open');
            m.string_arg(walletname);
            m.int64_arg(0);
            m.string_arg(APPNAME);
            return m.execute();
        }).then(function(handle){
            handle = handle[0];
            console.log("Got handle",handle);
            if (!handle)
                throw new Error("wrong handle");


            const get_password = function (cb) {
                var m = bus.method_call('readPassword');
                m.int_arg(handle);
                m.string_arg(PASSWORD_FOLDER);
                m.string_arg(KEYNAME);
                m.string_arg(APPNAME);
                m.execute().then(function(pwd){
                    cb(pwd[0], undefined);
                });
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

            lib_load_resolved({'set_password':set_password, 'get_password':get_password});
        }).catch(function(reason){
            console.error("kwallet load failed:",reason.message);
            console.debug(reason.stack);
            lib_load_rejected();
        });
    });
}


function global_manager(pref) {
    if (pref == 'g') {
        try {
            return load_secret_services();
        } catch(e) {
            console.error(e)
        }
    }
    else if (pref == 'k') {
        try {
            return load_kwallet();
        } catch(e) {
            console.error(e)
        }
    }
    return null;
}


exports.manager = global_manager
