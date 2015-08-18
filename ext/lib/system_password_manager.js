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

var {Cu} = require('chrome');
Cu.import("resource://gre/modules/ctypes.jsm");


const APPNAME = 'masterpassword-for-firefox',
      USAGE = 'masterkey';

var keep_us_safe = null; // need to hold on to the libgnome-keyring reference indefinetively
function load_gnome_keyring() {
    var lib;

    try { lib = ctypes.open("libgnome-keyring.so"); }
    catch(e) { return null; }
    keep_us_safe = lib;

    const GNOME_KEYRING_ITEM_GENERIC_SECRET = 0,
          GNOME_KEYRING_ATTRIBUTE_TYPE_STRING = 0;

    const struct_pwschemaAttribute = ctypes.StructType('GnomeKeyringPasswordSchemaAttribute', [
                {'name': ctypes.char.ptr},
                {'type': ctypes.int}]),
        struct_pwschema = ctypes.StructType('GnomeKeyringPasswordSchema', [
                {'item_type': ctypes.int},
                {'attributes': struct_pwschemaAttribute.array(32)},
                {'reserved1': ctypes.uintptr_t},
                {'reserved2': ctypes.uintptr_t},
                {'reserved3': ctypes.uintptr_t}]),
        struct_attribute = ctypes.StructType('GnomeKeyringAttribute', [
                {'name': ctypes.char.ptr},
                {'type': ctypes.int},
                {'value': ctypes.char.ptr}]);

    const keyring_available = lib.declare("gnome_keyring_is_available", ctypes.default_abi, ctypes.bool),
          free_password = lib.declare("gnome_keyring_free_password", ctypes.default_abi, ctypes.void_t, ctypes.char.ptr),
          store_password_sync = lib.declare("gnome_keyring_store_password_sync", ctypes.default_abi, ctypes.int,
            struct_pwschema.ptr,
            ctypes.char.ptr, //keyring
            ctypes.char.ptr, //display_name
            ctypes.char.ptr, //password
            ctypes.char.ptr, //attrname
            ctypes.char.ptr, //attrval
            ctypes.char.ptr, //attrname
            ctypes.char.ptr, //attrval
            ctypes.char.ptr),
          find_password_sync = lib.declare("gnome_keyring_find_password_sync", ctypes.default_abi, ctypes.int,
            struct_pwschema.ptr,
            ctypes.char.ptr.ptr, //output
            ctypes.char.ptr, //attrname
            ctypes.char.ptr, //attrval
            ctypes.char.ptr, //attrname
            ctypes.char.ptr, //attrval
            ctypes.char.ptr);  //term

    const result_to_message = (function () {
                var fn = lib.declare("gnome_keyring_result_to_message", ctypes.default_abi, ctypes.char.ptr, ctypes.int);
                return function(res) { return fn(res).readString(); }
          }());


    if(!keyring_available()) {
        //lib.close(); -can't do that.. or firefox will crash!
        return null;
    }

    const my_schema = new struct_pwschema();
    my_schema.item_type = GNOME_KEYRING_ITEM_GENERIC_SECRET;
    my_schema.attributes[0].name = ctypes.char.array()('appname');
    my_schema.attributes[0].type = GNOME_KEYRING_ATTRIBUTE_TYPE_STRING;
    my_schema.attributes[1].name = ctypes.char.array()('usage');
    my_schema.attributes[1].type = GNOME_KEYRING_ATTRIBUTE_TYPE_STRING;
    my_schema.attributes[2].name = null;
    my_schema.attributes[2].type = 0;


    const set_password = function(p) {
        var res = store_password_sync(my_schema.address(), null,
                "Masterpassword firefox master",
                p,
                "appname", APPNAME,
                "usage", USAGE,
                null);
        switch (res) {
            case 0: break;
            default:
                console.log("store password failed",res, result_to_message(res));
        };
    }

    const get_password = function() {
        var res_str = new ctypes.char.ptr();
        var res = find_password_sync(my_schema.address(),
                res_str.address(),
                "appname", APPNAME,
                "usage", USAGE,
                null);
        switch (res) {
            case 0:
                res = res_str.readString();
                free_password(res_str);
                break;
            case 9:
                res = "";
                console.log("No password on store");
                break;
            default:
                res = null;
                console.log("find password failed",res, result_to_message(res));
        };
        return res
    }

    return {'set_password':set_password, 'get_password':get_password};
}


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
          message_new_method_call = lib.declare('dbus_message_new_method_call', ctypes.default_abi, DBusMessage.ptr,
                  ctypes.char.ptr, ctypes.char.ptr, ctypes.char.ptr, ctypes.char.ptr ),
          connection_send_with_reply_and_block = lib.declare('dbus_connection_send_with_reply_and_block', ctypes.default_abi, DBusMessage.ptr,
                  DBusConnection.ptr, DBusMessage.ptr, ctypes.int, DBusError.ptr);

    var iter_result = function(it) {
        var typ, data, ret = [];
        for (typ = message_iter_get_arg_type(it); typ != 0; message_iter_next(it), typ = message_iter_get_arg_type(it)) {
            switch(typ) {
                case 115: // s
                    data = ctypes.char.ptr();
                    break;
                case 105: // i
                    data = ctypes.int();
                    break;
                case 120: // x
                    data = ctypes.int64_t();
                    break;
                case 97:  // a
                    console.log('sub array result');
                    data = new DBusMessageIter();
                    message_iter_recurse(it, data.address());
                    ret.push( iter_result(data.address()) );
                    data = null;
                    break;
                default:
                    console.log("iter_result, Unknown data type",typ);
                    data = null;
            }
            if (data !== null) {
                message_iter_get_basic(it, data.address());
                if (typ == 115) ret.push(data.readString());
                else ret.push(data.value);
            }
        }
        return ret;
    }

    var err = new DBusError();
    var dbus_con = bus_get(0, err.address());
    if (dbus_con.isNull()) {
        console.log('Failed to get bus', err.name, err.message);
        return null;
    }

    var new_method_call = function(dest, path, iface, method) {
        var m = message_new_method_call(dest, path, iface, method);
        var it = new DBusMessageIter();
        message_iter_init_append(m, it.address());
        return {
            'string_arg': function(s) {
                var ss = ctypes.char.array()(s);
                var x = ctypes.cast(ss.address(), ctypes.char.ptr);
                message_iter_append_basic(it.address(), 115, x.address());
            },
            'int_arg': function(s) {
                var x = ctypes.int(s)
                message_iter_append_basic(it.address(), 105, x.address());
            },
            'int64_arg': function(s) {
                var x = ctypes.int(s)
                var x = ctypes.int64_t(s)
                message_iter_append_basic(it.address(), 120, x.address());
            },
            'bool_arg': function(s) {
                var x = ctypes.bool(s)
                message_iter_append_basic(it.address(), 98, x.address());
            },
            'execute': function(timeout) {
                if (timeout === undefined) timeout = 1000;
                console.log('execute',method,'timeout:',timeout);
                var err = new DBusError();
                var rep = connection_send_with_reply_and_block(dbus_con, m, timeout, err.address());
                if (rep.isNull()) {
                    throw "Failed to send message:"+err.name.readString();
                }
                it = new DBusMessageIter();
                if (message_iter_init(rep, it.address())) {
                    return iter_result(it.address());
                } else
                {
                    console.log(method,'had no arguments in reply');
                    return [];
                }
            }
        };
    }

    return {
        'new_method_call': new_method_call
    };
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
        lib = load_gnome_keyring();
        if (lib) {
            console.log("gnome_keyring available & loaded");
            return lib;
        }
    }
    else if (pref == 'k') {
        lib = load_kwallet();
        if (lib) {
            console.log("kwallet available & loaded");
            return lib;
        }
    }

    return null;
}


exports.manager = global_manager
