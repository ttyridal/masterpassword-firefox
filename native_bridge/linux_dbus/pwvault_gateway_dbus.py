#!/usr/bin/env python
"""pwvault_gateway.py: NativeMessaging host for Masterpassword for Firefox

This gateway will allow Masterpassword for Firefox to store the master key
in OS' key store.

This is implementation for Gnome Keyring / Secret Services"""

from ctypes import *
import json
import logging
import os
import signal
import struct
import sys

__author__ = "Torbjorn Tyridal"
__copyright__ = "Copyright 2007, Torbjorn Tyridal"
__license__ = "GPL"
__version__ = "1.0.0"
__maintainer__ = "Torbjorn Tyridal"
__status__ = "Production"
APPNAME = 'masterpassword-for-firefox'
USAGE = 'masterkey'

if 1:
    logging.basicConfig(level=logging.DEBUG, format='%(filename)s %(levelname)s: %(message)s')
else:
    logging.basicConfig(
       filename=os.path.join(os.path.dirname(os.path.realpath(__file__)), 'pwgw.log'),
       level=logging.DEBUG,
       format='%(asctime)s %(levelname)s %(message)s')


class _long(int):
    pass


class Quit(Exception):
    pass


class InvalidMessage(Exception):
    pass

if sys.version_info >= (3, 0):
    sys.stdin = sys.stdin.buffer
    sys.stdout = sys.stdout.buffer
    Long = _long
    Unicode = str
else:
    Long = long
    Unicode = unicode


def getMessage():
    rawLength = sys.stdin.read(4)
    if len(rawLength) == 0:
        logging.info("pipe closed")
        raise Quit()
    messageLength = struct.unpack('@I', rawLength)[0]
    message = sys.stdin.read(messageLength)
    return json.loads(message.decode())


def sendMessage(obj):
    encodedContent = json.dumps(obj)
    encodedLength = struct.pack('@I', len(encodedContent))
    sys.stdout.write(encodedLength)
    sys.stdout.write(encodedContent.encode())
    sys.stdout.flush()


class DBus(object):
    class GenericException(Exception):
        pass

    class ImplementationException(GenericException):
        pass

    class InvalidArgsException(GenericException):
        pass

    class NoReplyException(GenericException):
        pass

    class ServiceUnknownException(GenericException):
        pass

    class DisconnectedException(GenericException):
        pass

    class DBUSMessage(Structure):
        pass

    PDBUSMessage = POINTER(DBUSMessage)

    class DBUSConnection(Structure):
        pass

    PDBUSConnection = POINTER(DBUSConnection)

    class Error(Structure):
        _fields_ = [("name", c_char_p),
                    ("message", c_char_p),
                    ("dummy1", c_int),
                    ("dummy2", c_int),
                    ("dummy3", c_int),
                    ("dummy4", c_int),
                    ("dummy5", c_int),
                    ("padding", c_void_p),
                    ]

    MessageIter = c_void_p * 14

    class ObjectPath(bytes):
        pass

    class Variant(object):
        def __init__(self, value):
            self.value = value

    def __init__(self):
        err = DBus.Error()
        self._lib = CDLL('libdbus-1.so.3')
        self._lib.dbus_message_new_method_call.restype = self.PDBUSMessage
        self._lib.dbus_bus_get.restype = self.PDBUSConnection
        self._lib.dbus_connection_send_with_reply_and_block.restype = self.PDBUSConnection
        c = self._lib.dbus_bus_get(0, byref(err))
        if c == 0:
            raise DBus.GenericException("failed to get bus " + err.name + " " + err.message)
        self.bus = c

    def _iter_result(self, it):
        ret = []
        while 1:
            typ = self._lib.dbus_message_iter_get_arg_type(it)
            if typ == 0:
                break
            elif typ == ord('s') or typ == ord('o'):
                s = c_char_p()
                self._lib.dbus_message_iter_get_basic(it, byref(s))
                if typ == ord('o'):
                    ret.append(DBus.ObjectPath(s.value))
                else:
                    ret.append(s.value)
            elif typ == ord('y'):
                s = c_char()
                self._lib.dbus_message_iter_get_basic(it, byref(s))
                ret.append(s.value)
            elif typ == ord('i'):
                s = c_int()
                self._lib.dbus_message_iter_get_basic(it, byref(s))
                ret.append(s.value)
            elif typ == ord('x'):
                s = c_int64()
                self._lib.dbus_message_iter_get_basic(it, byref(s))
                ret.append(s.value)
            elif typ == ord('a'):
                subit = DBus.MessageIter()
                self._lib.dbus_message_iter_recurse(it, byref(subit))
                s = self._iter_result(byref(subit))
                ret.append(s)
            elif typ == ord('r'):
                subit = DBus.MessageIter()
                self._lib.dbus_message_iter_recurse(it, byref(subit))
                s = self._iter_result(byref(subit))
                ret.append(s)
            elif typ == ord('v'):
                subit = DBus.MessageIter()
                self._lib.dbus_message_iter_recurse(it, byref(subit))
                s = self._iter_result(byref(subit))
                ret.append(s)
            else:
                raise DBus.ImplementationException("Unknown type " + typ + " " + chr(typ))
            self._lib.dbus_message_iter_next(it)
        return ret

    def _iter_append_basic(self, it, typ, value):
        if not self._lib.dbus_message_iter_append_basic(it, typ, byref(value)):
            raise DBus.GenericException("dbus_message_iter_append_basic failed")

    def _iter_open_container(self, it, ctyp, typ, entry):
        if not self._lib.dbus_message_iter_open_container(it, ctyp, typ, byref(entry)):
            raise DBus.GenericException("dbus_message_iter_open_container failed")

    def _iter_args(self, it, args, level=0):
        for x in args:
            if type(x) == Long:
                typ = ord('x')
                x = c_int64(x)
                self._iter_append_basic(it, typ, x)
            elif type(x) == int:
                typ = ord('i')
                x = c_int(x)
                self._iter_append_basic(it, typ, x)
            elif type(x) == bool:
                typ = ord('b')
                x = c_int(1 if x else 0)
                self._iter_append_basic(it, typ, x)
            elif type(x) == DBus.ObjectPath:
                typ = ord('o')
                x = c_char_p(x)
                self._iter_append_basic(it, typ, x)
            elif type(x) == Unicode:
                x = x.encode()
                typ = ord('s')
                x = c_char_p(x)
                self._iter_append_basic(it, typ, x)
            elif type(x) == str:
                typ = ord('s')
                x = c_char_p(x)
                self._iter_append_basic(it, typ, x)
            elif type(x) == bytes:
                typ = ord('s')
                x = c_char_p(x)
                self._iter_append_basic(it, typ, x)
            elif type(x) == DBus.Variant:
                typ = {Unicode: b's',
                       str: b's',
                       bytes: b's',
                       DBus.ObjectPath: b'o',
                       Long: b'x',
                       int: b'i',
                       dict: b'a{ss}'}[type(x.value)]
                entry = DBus.MessageIter()
                self._iter_open_container(it, ord('v'), typ, entry)
                self._iter_args(byref(entry), [x.value])
                self._lib.dbus_message_iter_close_container(it, byref(entry))
            elif type(x) == bytearray:
                entry = DBus.MessageIter()
                self._iter_open_container(it, ord('a'), b'y', entry)
                for xx in x:
                    xx = c_byte(xx)
                    self._iter_append_basic(byref(entry), ord('y'), xx)
                self._lib.dbus_message_iter_close_container(it, byref(entry))

            elif type(x) == tuple:
                struct = DBus.MessageIter()
                self._iter_open_container(it, ord('r'), None, struct)
                self._iter_args(byref(struct), x, level+1)
                self._lib.dbus_message_iter_close_container(it, byref(struct))

            elif type(x) == dict:
                dic = DBus.MessageIter()

                is_variant = False
                for v in x.values():
                    if type(v) == DBus.Variant:
                        is_variant = True
                typ = b'{sv}' if is_variant else b'{ss}'
                self._iter_open_container(it, ord('a'), typ, dic)
                for k, v in x.items():
                    entry = DBus.MessageIter()
                    self._iter_open_container(byref(dic), ord('e'), None, entry)
                    x = c_char_p(k.encode())
                    self._iter_append_basic(byref(entry), ord('s'), x)
                    self._iter_args(byref(entry), [v], level+1)
                    self._lib.dbus_message_iter_close_container(byref(dic), byref(entry))
                self._lib.dbus_message_iter_close_container(it, byref(dic))
            else:
                raise Exception("Unknown type "+str(type(x)))

    def _msg_send(self, m, to=1000):
        err = DBus.Error()
        rep = self._lib.dbus_connection_send_with_reply_and_block(self.bus, m, to, byref(err))
        if rep == 0:
            if err.name == b'org.freedesktop.DBus.Error.NoReply':
                raise DBus.NoReplyException(err.message.decode())
            elif err.name == b'org.freedesktop.DBus.Error.ServiceUnknown':
                raise DBus.ServiceUnknownException(err.message.decode())
            elif err.name == b'org.freedesktop.DBus.Error.Disconnected':
                raise DBus.DisconnectedException(err.message.decode())
            elif err.name == b'org.freedesktop.DBus.Error.InvalidArgs':
                raise DBus.InvalidArgsException(err.message.decode())
            else:
                raise DBus.GenericException(err.name.decode() + " " + err.message.decode())

        it = DBus.MessageIter()
        self._lib.dbus_message_iter_init(rep, byref(it))
        return self._iter_result(byref(it))

    def execute_timeout(self, time, dest, path, iface, method, *args):
        dest = dest.encode() if hasattr(dest, 'encode') else dest
        path = path.encode() if hasattr(path, 'encode') else path
        iface = iface.encode() if hasattr(iface, 'encode') else iface
        method = method.encode() if hasattr(method, 'encode') else method
        m = self._lib.dbus_message_new_method_call(dest, path, iface, method)
        if not m:
            raise DBus.GenericException("Failed executing dbus_message_new_method_call")
        it = DBus.MessageIter()
        itp = byref(it)
        if not self._lib.dbus_message_iter_init_append(m, byref(it)):
            raise DBus.GenericException("Failed executing dbus_message_iter_init_append")
        self._iter_args(byref(it), args)
        return self._msg_send(m, time*1000)

    def execute(self, dest, path, iface, method, *args):
        return self.execute_timeout(1, dest, path, iface, method, *args)

    def get_property(self, dest, path, iface, prop):
        m = self.execute(dest, path, 'org.freedesktop.DBus.Properties', 'Get', iface, prop)
        return m[0][0]


class SecretServices(object):
    base_path = '/org/freedesktop/secrets'
    key_folder = b'/org/freedesktop/secrets/collection/login'
    CollectionInterface = 'org.freedesktop.Secret.Collection'
    ServiceInterface = 'org.freedesktop.Secret.Service'
    ItemInterface = 'org.freedesktop.Secret.Item'
    address = 'org.freedesktop.secrets'

    def __init__(self):
        bus = DBus()
        coll = bus.get_property(self.address, self.base_path, self.ServiceInterface, 'Collections')
        if self.key_folder not in coll:
            raise Exception("No folder named '%s'! incompatible setup" % self.key_folder)
        self.bus = bus

    def _get_session(self):
        return self.bus.execute(
                self.address,
                self.base_path,
                self.ServiceInterface,
                'OpenSession',
                'plain',
                DBus.Variant(''))[1]

    def get_password(self):
        keys = self.bus.execute(
                self.address,
                self.key_folder,
                self.CollectionInterface,
                'SearchItems',
                {'usage': USAGE, 'appname': APPNAME})[0]
        if len(keys) == 0:
            logging.info("No keys in store")
            return ""
        if len(keys) > 1:
            logging.info("More than one key matching query. blindly using first")
        passwd, encoding = self.bus.execute(
                self.address,
                keys[0],
                self.ItemInterface,
                b'GetSecret',
                self._get_session())[0][2:]

        assert(encoding == b'text/plain')
        passwd = b''.join(passwd)
        return passwd

    def set_password(self, value):
        newpath = self.bus.execute(
                self.address,
                self.key_folder,
                self.CollectionInterface,
                'CreateItem',
                {
                    'org.freedesktop.Secret.Item.Label':
                        DBus.Variant(APPNAME+' master'),
                    'org.freedesktop.Secret.Item.Attributes':
                        DBus.Variant({'xdg:schema': 'org.freedesktop.Secret.Generic',
                                      'usage': USAGE,
                                      'appname': APPNAME}),
                },
                (self._get_session(), bytearray(), bytearray(value), 'text/plain'), True)
        logging.info("Created or updated item %s", newpath[0].decode())


class KWallet(object):
    path = b'/modules/kwalletd'
    interface = 'org.kde.KWallet'
    address = 'org.kde.kwalletd'
    FOLDER = 'Passwords'
    KEYNAME = APPNAME+'-master'

    def _setup_kf5_kde4(self):
        try:
            wallet_name = self.bus.execute(
                self.address+'5',
                self.path+b'5',
                self.interface,
                'localWallet')
            KWallet.path += b'5'
            KWallet.address += b'5'
            return wallet_name[0]
        except DBus.ServiceUnknownException:
            pass  # Ok, let's try kde4 style

        return self.bus.execute(
                self.address,
                self.path,
                self.interface,
                'localWallet')[0]

    def __init__(self):
        self.bus = DBus()
        self.wallet_name = self._setup_kf5_kde4()

        self.handle = self.bus.execute_timeout(
                10,
                self.address,
                self.path,
                self.interface,
                'open', self.wallet_name, Long(0), APPNAME)[0]

    def get_password(self):
        pw = self.bus.execute(
                self.address,
                self.path,
                self.interface,
                'readPassword',
                self.handle,
                self.FOLDER,
                self.KEYNAME,
                APPNAME)
        return pw[0]

    def set_password(self, value):
        pw = self.bus.execute(
                self.address,
                self.path,
                self.interface,
                'writePassword',
                self.handle,
                self.FOLDER,
                self.KEYNAME,
                value,
                APPNAME)


def test_main():
    if sys.argv[2] == 'kwallet':
        s = KWallet()
    elif sys.argv[2] == 'gnome':
        s = SecretServices()

    if sys.argv[3] == 'pwget':
        p = s.get_password()
        sys.stdout.write(b'Password: "' + p + b'"\n')
    elif sys.argv[3] == 'pwset':
        s.set_password(sys.argv[4].encode())
    else:
        sys.stdout.write(b"unknown command\n")


def main():
    def quit_now(x, y):
        logging.info("Got TERM signal")
        raise Quit()

    signal.signal(signal.SIGTERM, quit_now)

    if os.path.basename(__file__) == 'pwvault_gateway_kde':
        store = KWallet()
    else:
        store = SecretServices()

    try:
        while 1:
            receivedMessage = getMessage()
            if 'type' not in receivedMessage:
                raise InvalidMessage()
            if receivedMessage['type'] == 'pwget':
                if 'name' not in receivedMessage:
                    raise InvalidMessage("pwget requires argument 'name'")
                logging.debug("Get password for %s", receivedMessage['name'])
                sendMessage({'type': 'pwgetreply',
                             'value': store.get_password().decode(),
                             'success': True})
            elif receivedMessage['type'] == 'pwset':
                if 'name' not in receivedMessage:
                    raise InvalidMessage("pwset requires argument 'name'")
                if 'value' not in receivedMessage:
                    raise InvalidMessage("pwset requires argument 'value'")
                logging.debug("Set password for %s", receivedMessage['name'])
                store.set_password(receivedMessage['value'].encode())
                sendMessage({'type': 'pwsetreply', 'success': True})
            elif receivedMessage['type'] == 'comcheck':
                sendMessage({'type': 'comcheckreply', 'success': True})
            else:
                raise InvalidMessage("Unknown message type")

    except Quit:
        pass
    except KeyboardInterrupt:
        logging.info("Quit by ctrl-C")
    except:
        logging.exception("")


def install():
    appname = 'no.ttyridal.pwvault_gateway.json'
    path_ff = ('~/.mozilla/native-messaging-hosts/',
               '/usr/lib/mozilla/native-messaging-hosts/')
    path_chrome = ('~/.config/google-chrome/NativeMessagingHosts/',
                   'etc/opt/chrome/native-messaging-hosts/')
    path_chromium = ('~/.config/chromium/NativeMessagingHosts/',
                     '/etc/chromium/native-messaging-hosts/')

    args = sys.argv[2:]
    paths = []
    if not any(a in args for a in ('firefox', 'chrome', 'chromium', 'all')) \
            or not any(a in args for a in ('gnome', 'kwallet')):
        sys.stdout.write(b'Usage:\n  '
                         b'pwvault_gateway_dbus.py install [--global] {gnome|kwallet} {firefox|chrome|chromium|all}\n'
                         b'\n  --global will install system wide, otherwise current user only\n')
        return

    if 'firefox' in args or 'all' in args:
        paths.append(path_ff[1 if '--global' in args else 0])
        if '--global' in args and os.path.isdir('/usr/lib64/mozilla'):
            paths.append(path_ff[1].replace('/lib/', '/lib64/'))
    if 'chrome' in args or 'all' in args:
        paths.append(path_chrome[1 if '--global' in args else 0])
    if 'chromium' in args or 'all' in args:
        paths.append(path_chromium[1 if '--global' in args else 0])

    dst = os.path.expanduser('/usr/local/bin/' if '--global' in args else '~/bin/')
    try:
        os.makedirs(dst)
    except OSError as e:
        if e.errno == 17:
            pass
        else:
            raise

    dst = os.path.join(dst, 'pwvault_gateway_gnome' if 'gnome' in args else 'pwvault_gateway_kde')
    os.system('cp -f "%s" "%s"' % (os.path.realpath(__file__), dst))
    os.chmod(dst, 0o755)
    sys.stdout.write(b"Installed " + dst + b"\n")

    for path in paths:
        try:
            os.makedirs(os.path.expanduser(path))
        except OSError as e:
            if e.errno == 17:
                pass
            else:
                raise

        with open(os.path.join(os.path.expanduser(path), appname), 'w') as f:
            f.write('{\n')
            f.write('"name": "no.ttyridal.pwvault_gateway",\n')
            f.write('"description": "Exposes the OS password vault to masterpassword extension",\n')
            f.write('"path": "'+dst+'",\n')
            f.write('"type": "stdio",\n')
            if 'mozilla' in path:
                f.write('"allowed_extensions": [ "jid1-pn4AFskf9WBAdA@jetpack" ]\n')
            else:
                f.write('"allowed_origins": [ "chrome-extension://hifbblnjfcimjnlhibannjoclibgedmd/" ]\n')
            f.write('}')
        sys.stdout.write(b"Created " + os.path.join(os.path.expanduser(path), appname).encode() + b"\n")


if len(sys.argv) < 2:
    sys.stdout.write(b"Missing arguments: pwvault_gateway_dbus.py install help for more\n")
elif sys.argv[1] == 'test':
    test_main()
elif sys.argv[1] == 'install':
    try:
        install()
    except Exception as e:
        sys.stdout.write(b"Failed: " + str(e).encode() + b"\n")
else:  # firefox will start us with path as argument
    main()
