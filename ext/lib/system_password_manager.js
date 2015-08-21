/* Copyright Torbjorn Tyridal 2015

    This file is part of Masterpassword for Firefox (herby known as "the software")

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

var {Cu} = require('chrome');
Cu.import("resource://gre/modules/ctypes.jsm");


const APPNAME = 'masterpassword-for-firefox',
      USAGE = 'masterkey';

function dbus() {
    var lib
    try { lib = ctypes.open("libdbus-1.so.3"); }
    catch(e) { return null; }

    const DBusError = ctypes.StructType('DBusError', [
            {'name': ctypes.char.ptr},
            {'message': ctypes.char.ptr},
            {'dummy1': ctypes.int},
            {'dummy2': ctypes.int},
            {'dummy3': ctypes.int},
            {'dummy4': ctypes.int},
            {'dummy5': ctypes.int},
            {'padding': ctypes.voidptr_t},
        ]),
        DBusConnection = ctypes.StructType('DBusConnection'),
        DBusMessage = ctypes.StructType('DBusMessage'),
        DBusMessageIter = ctypes.StructType('DBusMessageIter', [
            {'dummy1': ctypes.voidptr_t},
            {'dummy2': ctypes.voidptr_t},
            {'dummy3': ctypes.uint32_t},
            {'dummy4': ctypes.int},
            {'dummy5': ctypes.int},
            {'dummy6': ctypes.int},
            {'dummy7': ctypes.int},
            {'dummy8': ctypes.int},
            {'dummy9': ctypes.int},
            {'dummy10': ctypes.int},
            {'dummy11': ctypes.int},
            {'pad1': ctypes.int},
            {'pad2': ctypes.int},
            {'pad3': ctypes.voidptr_t}

        ]);


    const bus_get = lib.declare('dbus_bus_get', ctypes.default_abi, DBusConnection.ptr,
                  ctypes.int, DBusError.ptr),
          message_iter_init = lib.declare('dbus_message_iter_init', ctypes.default_abi, ctypes.bool,
                  DBusMessage.ptr, DBusMessageIter.ptr),
          message_iter_get_arg_type = lib.declare('dbus_message_iter_get_arg_type', ctypes.default_abi, ctypes.int,
                  DBusMessageIter.ptr),
          message_iter_get_basic = lib.declare('dbus_message_iter_get_basic', ctypes.default_abi, ctypes.void_t,
                  DBusMessageIter.ptr, ctypes.voidptr_t),
          message_iter_recurse = lib.declare('dbus_message_iter_recurse', ctypes.default_abi, ctypes.void_t,
                  DBusMessageIter.ptr, DBusMessageIter.ptr),
          message_iter_init_append = lib.declare('dbus_message_iter_init_append', ctypes.default_abi, ctypes.void_t,
                  DBusMessage.ptr, DBusMessageIter.ptr),
          message_iter_append_basic = lib.declare('dbus_message_iter_append_basic', ctypes.default_abi, ctypes.bool,
                  DBusMessageIter.ptr, ctypes.int, ctypes.voidptr_t),
          message_iter_next = lib.declare('dbus_message_iter_next', ctypes.default_abi, ctypes.bool,
                  DBusMessageIter.ptr),
          message_iter_open_container = lib.declare('dbus_message_iter_open_container', ctypes.default_abi, ctypes.bool,
                  DBusMessageIter.ptr, ctypes.int, ctypes.char.ptr, DBusMessageIter.ptr),
          message_iter_close_container = lib.declare('dbus_message_iter_close_container', ctypes.default_abi, ctypes.bool,
                  DBusMessageIter.ptr, DBusMessageIter.ptr),
          message_new_method_call = lib.declare('dbus_message_new_method_call', ctypes.default_abi, DBusMessage.ptr,
                  ctypes.char.ptr, ctypes.char.ptr, ctypes.char.ptr, ctypes.char.ptr ),
          connection_send_with_reply_and_block = lib.declare('dbus_connection_send_with_reply_and_block', ctypes.default_abi, DBusMessage.ptr,
                  DBusConnection.ptr, DBusMessage.ptr, ctypes.int, DBusError.ptr);

    const dbus_type = {'string': 's'.charCodeAt(0),
                       'objectpath': 'o'.charCodeAt(0),
                       'integer': 'i'.charCodeAt(0),
                       'bool': 'b'.charCodeAt(0),
                       'int64': 'x'.charCodeAt(0),
                       'variant': 'v'.charCodeAt(0),
                       'array': 'a'.charCodeAt(0),
                       'byte': 'y'.charCodeAt(0),
                       'struct': 'r'.charCodeAt(0),
                       'dict_entry': 'e'.charCodeAt(0),
    }

    function iter_result(it) {
        var typ, data, ret = [];
        for (typ = message_iter_get_arg_type(it); typ != 0; message_iter_next(it), typ = message_iter_get_arg_type(it)) {
            switch(typ) {
                case dbus_type.objectpath:
                case dbus_type.string:
                    data = ctypes.char.ptr();
                    message_iter_get_basic(it, data.address());
                    ret.push(data.readString());
                    break;
                case dbus_type.integer:
                    data = ctypes.int();
                    message_iter_get_basic(it, data.address());
                    ret.push(data.value);
                    break;
                case dbus_type.int64:
                    data = ctypes.int64_t();
                    message_iter_get_basic(it, data.address());
                    ret.push(data.value);
                    break;
                case dbus_type.byte:
                    data = ctypes.uint8_t();
                    message_iter_get_basic(it, data.address());
                    ret.push(data.value);
                    break;
                case dbus_type.struct:
                case dbus_type.variant:
                case dbus_type.array:
                    data = new DBusMessageIter();
                    message_iter_recurse(it, data.address());
                    if (typ==dbus_type.variant)
                        ret.push( iter_result(data.address())[0] );
                    else
                        ret.push( iter_result(data.address()) );
                    break;
                default:
                    console.warn("iter_result, Unknown data type",typ);
            }
        }
        return ret;
    }

    var err = new DBusError();
    var dbus_con = bus_get(0, err.address());
    if (dbus_con.isNull()) {
        console.error('Failed to get bus', err.name, err.message);
        return null;
    }

    /// helpers ///
    function iter_each(ar, cb) {
        for (var key in ar)
            if (ar.hasOwnProperty(key))
                cb(key, ar[key]);
    }
    function msg_arg_str(it, s) {
        var ss = ctypes.char.array()(s);
        var x = ctypes.cast(ss.address(), ctypes.char.ptr);
        message_iter_append_basic(it, dbus_type.string, x.address());
    }
    function msg_arg_objectpath(it, s) {
        var ss = ctypes.char.array()(s);
        var x = ctypes.cast(ss.address(), ctypes.char.ptr);
        message_iter_append_basic(it, dbus_type.objectpath, x.address());
    }
    function msg_arg_dict(it, typ, then) {
        var dic = new DBusMessageIter();
        message_iter_open_container(it, dbus_type.array, typ, dic.address());
        then(dic.address());
        message_iter_close_container(it, dic.address());
    }
    function msg_arg_dict_entry(dic, key, then) {
        var entry = new DBusMessageIter();
        message_iter_open_container(dic, dbus_type.dict_entry, null, entry.address());
        msg_arg_str(entry.address(), key);
        then(entry.address());
        message_iter_close_container(dic, entry.address());
    }
    function msg_arg_variant(it, typ, then) {
        var va = new DBusMessageIter();
        message_iter_open_container(it, dbus_type.variant, typ, va.address());
        then(va.address());
        message_iter_close_container(it, va.address());
    }
    function msg_arg_struct(it, then) {
        var va = new DBusMessageIter();
        message_iter_open_container(it, dbus_type.struct, null, va.address());
        then(va.address());
        message_iter_close_container(it, va.address());
    }
    function msg_arg_bytearray(it, ar) {
        var va = new DBusMessageIter();
        message_iter_open_container(it, dbus_type.array, 'y', va.address());
        for (var x of ar) {
            if (x.charCodeAt(0) > 255) throw "Illegal byte array thing.. did you forget to convert to utf-8?";
            var x = ctypes.uint8_t(x.charCodeAt(0));
            message_iter_append_basic(va.address(), dbus_type.byte, x.address());
        }
        message_iter_close_container(it, va.address());
    }
    //compounds
    function msg_arg_var_str(it, s) {
        msg_arg_variant(it, 's', function(v){ msg_arg_str(v, s);});
    }
    function msg_arg_dict_strs(it, d) {
        msg_arg_dict(it, '{ss}', function(dic) {
            iter_each(d, function(key, val) {
                msg_arg_dict_entry(dic, key, function(c){ msg_arg_str(c, d[key]); });
            });
        });
    }

    const new_method_call = function(dest, path, iface, method) {
        var m = message_new_method_call(dest, path, iface, method);
        var it = new DBusMessageIter();
        message_iter_init_append(m, it.address());
        return {
            'secret_services_attributes_arg': function(label, attrs) {
                msg_arg_dict(it.address(), '{sv}', function(dic) {
                    msg_arg_dict_entry(dic, 'org.freedesktop.Secret.Item.Label', function(e){ msg_arg_var_str(e, label); });
                    msg_arg_dict_entry(dic, 'org.freedesktop.Secret.Item.Attributes', function(e) {
                        msg_arg_variant(e, 'a{ss}', function(v) {
                            msg_arg_dict_strs(v, attrs);
                        });
                    });
                });
            },
            'secret_services_passwd_arg': function(session, session_key, pass, pass_fmt) {
                msg_arg_struct(it.address(), function(s) {
                    msg_arg_objectpath(s, session);
                    msg_arg_bytearray(s, session_key);
                    msg_arg_bytearray(s, pass);
                    msg_arg_str(s, pass_fmt);
                });
            },
            'dict_str_arg': function(s) { msg_arg_dict_strs(it.address(), s); },
            'var_string_arg': function(s) { msg_arg_var_str(it.address(), s); },
            'string_arg': function(s) { msg_arg_str(it.address(), s); },
            'objpath_arg': function(s) { msg_arg_objectpath(it.address(), s); },
            'int_arg': function(s) {
                var x = ctypes.int(s);
                message_iter_append_basic(it.address(), dbus_type.integer, x.address());
            },
            'int64_arg': function(s) {
                var x = ctypes.int64_t(s);
                message_iter_append_basic(it.address(), dbus_type.int64, x.address());
            },
            'bool_arg': function(s) {
                var x = ctypes.int({true:1, false:0}[s]);
                message_iter_append_basic(it.address(), dbus_type.bool, x.address());
            },
            'execute': function(timeout) {
                if (timeout === undefined) timeout = 1000;
                console.log('execute',method,'timeout:',timeout);
                var err = new DBusError();
                var rep = connection_send_with_reply_and_block(dbus_con, m, timeout, err.address());
                if (rep.isNull()) {
                    throw "method execute, Failed to send message:"+err.name.readString()+"\n"+err.message.readString();
                }
                it = new DBusMessageIter();
                if (message_iter_init(rep, it.address())) {
                    return iter_result(it.address());
                } else
                {
                    return [];
                }
            }
        };
    }

    return {
        'new_method_call': new_method_call
    };
}


function load_secret_services() {
    var bus = dbus();
    if (bus == null) return null;

    const key_folder = '/org/freedesktop/secrets/collection/login';

    var m = bus.new_method_call('org.freedesktop.secrets', '/org/freedesktop/secrets', 'org.freedesktop.DBus.Properties', 'Get');
    m.string_arg('org.freedesktop.Secret.Service');
    m.string_arg('Collections');
    var tmp = m.execute()[0];
    if (tmp.indexOf(key_folder) < 0) {
        console.info("No "+key_folder+". incompatible setup");
        return null;
    }


    m = bus.new_method_call('org.freedesktop.secrets', '/org/freedesktop/secrets', 'org.freedesktop.Secret.Service', 'OpenSession');
    m.string_arg('plain');
    m.var_string_arg('');
    var tx_session = m.execute()[1];


    const get_password = function() {
        var m;
        m = bus.new_method_call('org.freedesktop.secrets', key_folder, 'org.freedesktop.Secret.Collection', 'SearchItems');
        m.dict_str_arg({'usage': USAGE, 'appname': APPNAME});
        var key_path = m.execute()[0]
        if (key_path.length == 0)
            console.info('no keys available');
        else {
            if (key_path.length > 1) {
                console.log(key_path);
                console.warn("more than one alternative key.. blindly using first!");
            }
            key_path = key_path[0];
        }

        m = bus.new_method_call('org.freedesktop.secrets', key_path, 'org.freedesktop.Secret.Item', 'GetSecret');
        m.objpath_arg(tx_session);

        var encoding, pwd = m.execute()[0];
        encoding = pwd[3];
        if (encoding != 'text/plain') {
            console.warn("Stored password is not text/plain. Can't use it");
            return null;
        }
        pwd = (function utf8_bytes_to_string(tmp){
            var s='';
            for (m in tmp) {
                s+=String.fromCharCode(tmp[m]);
            }
            return decodeURIComponent(escape(s));
        }(pwd[2]));

        return pwd;
    }

    const set_password = function(p) {
        var m = bus.new_method_call('org.freedesktop.secrets', key_folder, 'org.freedesktop.Secret.Collection', 'CreateItem');
        m.secret_services_attributes_arg(APPNAME+' master', {'xdg:schema': 'org.freedesktop.Secret.Generic','usage':USAGE,'appname':APPNAME});
        m.secret_services_passwd_arg(tx_session, [], unescape(encodeURIComponent(p)), 'text/plain');
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

    var handle = (function init(){
        var m = bus.new_method_call('org.kde.kwalletd', '/modules/kwalletd', ctypes.char.ptr(), 'localWallet'),
            walletname;

        walletname = m.execute()[0];
        if (!walletname) {
            console.log('wallet name get failed', walletname);
            return null;
        }

        m = bus.new_method_call('org.kde.kwalletd', '/modules/kwalletd', null, 'open');
        m.string_arg(walletname);
        m.int64_arg(0);
        m.string_arg(APPNAME);
        handle = m.execute()[0];
        console.log('Got handle:',handle);
        return handle;
    }());

    if (!handle) return null;

    const get_password = function () {
        var m = bus.new_method_call('org.kde.kwalletd', '/modules/kwalletd', null, 'readPassword');
        m.int_arg(handle);
        m.string_arg(PASSWORD_FOLDER);
        m.string_arg(KEYNAME);
        m.string_arg(APPNAME);
        return m.execute()[0];
    };

    const set_password = function (p) {
        var m = bus.new_method_call('org.kde.kwalletd', '/modules/kwalletd', null, 'writePassword');
        m.int_arg(handle);
        m.string_arg(PASSWORD_FOLDER);
        m.string_arg(KEYNAME);
        m.string_arg(p);
        m.string_arg(APPNAME);
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
