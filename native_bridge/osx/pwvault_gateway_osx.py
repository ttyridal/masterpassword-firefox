#!/usr/bin/env python
"""pwvault_gateway.py: NativeMessaging host for Masterpassword for Firefox

This gateway will allow Masterpassword for Firefox to store the master key
in OS' key store.

This is implementation for OSX"""

from ctypes import *
import json
import logging
import os
import signal
import struct
import sys

__author__ = "Torbjorn Tyridal"
__copyright__ = "Copyright 2017, Torbjorn Tyridal"
__license__ = "GPL"
__version__ = "1.0.0"
__maintainer__ = "Torbjorn Tyridal"
__status__ = "Production"
APPNAME = b'masterpassword-for-firefox'
USAGE = b'masterkey'

if 1:
    logging.basicConfig(
            level=logging.DEBUG,
            format='%(filename)s %(levelname)s: %(message)s')
else:
    logging.basicConfig(
       filename=os.path.join(
           os.path.dirname(os.path.realpath(__file__)), 'pwgw.log'),
       level=logging.DEBUG,
       format='%(asctime)s %(levelname)s %(message)s')


class Quit(Exception):
    pass


class InvalidMessage(Exception):
    pass

if sys.version_info >= (3, 0):
    sys.stdin = sys.stdin.buffer
    sys.stdout = sys.stdout.buffer
    Unicode = str
else:
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


sf = CDLL('/System/Library/Frameworks/Security.framework/Versions/Current/Security')
cf = CDLL('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')


class SecKeychainItem(Structure):
    pass


class CFString(Structure):
    pass


class SecKeychain(Structure):
    pass

CFStringRef = POINTER(CFString)
SecKeychainRef = POINTER(SecKeychain)
SecKeychainItemRef = POINTER(SecKeychainItem)
CFIndex = c_long
CFStringEncoding = c_int
SecKeychainAttributeList = c_void_p
SecKeychainStatus = c_uint32
OSStatus = c_int

kCFStringEncodingMacRoman = 0
kCFStringEncodingUTF8 = 0x08000100
errSecItemNotFound = -25300

cf.CFStringGetCString.restype = c_bool
cf.CFStringGetCString.argtypes = [CFStringRef, c_char_p, CFIndex, CFStringEncoding]

cf.CFStringGetLength.restype = CFIndex
cf.CFStringGetLength.argtypes = [CFStringRef]

cf.CFStringCreateWithBytes.restype = CFStringRef
cf.CFStringCreateWithBytes.argtypes = [
        c_void_p,
        POINTER(c_uint8),
        CFIndex,
        CFStringEncoding,
        c_bool]

cf.CFRelease.restype = None
cf.CFRelease.argtypes = [c_void_p]

sf.SecCopyErrorMessageString.restype = CFStringRef
sf.SecCopyErrorMessageString.argtypes = [OSStatus, c_void_p]

sf.SecKeychainAddGenericPassword.restype = OSStatus
sf.SecKeychainAddGenericPassword.argtypes = [
            SecKeychainRef,
            c_uint32, POINTER(c_char),  # service name
            c_uint32, POINTER(c_char),  # account name
            c_uint32, POINTER(c_char),  # password data
            SecKeychainItemRef]

sf.SecKeychainFindGenericPassword.restype = OSStatus
sf.SecKeychainFindGenericPassword.argtypes = [
            SecKeychainRef,
            c_uint32, POINTER(c_char),  # service name
            c_uint32, POINTER(c_char),  # account name
            POINTER(c_uint32), POINTER(c_void_p),  # password data
            POINTER(SecKeychainItemRef)]

sf.SecKeychainGetStatus.restype = OSStatus
sf.SecKeychainGetStatus.argtypes = [
            SecKeychainRef,
            POINTER(SecKeychainStatus)]

sf.SecKeychainItemFreeContent.restype = OSStatus
sf.SecKeychainItemFreeContent.argtypes = [c_void_p, c_void_p]

sf.SecKeychainItemModifyAttributesAndData.restype = OSStatus
sf.SecKeychainItemModifyAttributesAndData.argtypes = [
            SecKeychainItemRef, c_void_p, c_uint32, c_char_p]

sf.SecKeychainSetUserInteractionAllowed.restype = OSStatus
sf.SecKeychainSetUserInteractionAllowed.argtypes = [c_bool]


def cfstring_to_js(cfstr):
    l = cf.CFStringGetLength(cfstr)
    cstr_x = (c_char * (l*4))()
    cstr = cast(cstr_x, c_char_p)

    if not cf.CFStringGetCString(cfstr, cstr, l*4, kCFStringEncodingUTF8):
        logging.error("Failed to CFStringGetCString")
        return None
    else:
        return cstr.value.decode('utf-8')


def SecCopyErrorMessageString(rc):
    cfstr = sf.SecCopyErrorMessageString(rc, None)
    s = cfstring_to_js(cfstr) + ' ('+rc+')'
    cf.CFRelease(cfstr)
    return s


def SecKeychainGetStatus():
    stat = SecKeychainStatus()
    res = type('obj', (object,), {
        'SecUnlockState': 0,
        'SecReadPerm': 0,
        'SecWritePerm': 0,
    })()
    rc = sf.SecKeychainGetStatus(None, byref(stat))
    if rc:
        raise Exception(SecCopyErrorMessageString(rc))
    if (stat.value & 1):
        res.SecUnlockState = 1
    if (stat.value & 2):
        res.SecReadPerm = 1
    if (stat.value & 4):
        res.SecWritePerm = 1
    return res


def SecKeychainSetUserInteractionAllowed(allowed):
    rc = sf.SecKeychainSetUserInteractionAllowed(allowed)
    if rc:
        raise Exception(SecCopyErrorMessageString(rc))


def SecKeychainItemFreeContent(attrList, data):
    rc = sf.SecKeychainItemFreeContent(attrList, data)
    if rc:
        raise Exception(SecCopyErrorMessageString(rc))


def SecKeychainFindGenericPassword(service, account, return_item):
    pw_len = c_uint32()
    item = None
    itemr = None
    pw_data = c_void_p()

    if return_item:
        item = SecKeychainItemRef()
        itemr = byref(item)

    rc = sf.SecKeychainFindGenericPassword(
            None,
            len(service),
            service,
            len(account),
            account,
            byref(pw_len),
            byref(pw_data),
            itemr)
    if rc == errSecItemNotFound:
        return None
    elif rc:
        raise Exception(SecCopyErrorMessageString(rc))

    x = cf.CFStringCreateWithBytes(
            None,
            cast(pw_data, POINTER(c_uint8)),
            pw_len.value,
            kCFStringEncodingUTF8,
            False)
    itemr = cfstring_to_js(x)
    cf.CFRelease(x)

    SecKeychainItemFreeContent(None, pw_data)
    if (return_item):
        return item
    else:
        return itemr


def SecKeychainItemModifyAttributesAndData(itm, new_passwd):
    new_passwd = new_passwd.encode('utf-8')
    rc = sf.SecKeychainItemModifyAttributesAndData(
            itm,
            None,
            len(new_passwd),
            new_passwd)
    if rc:
        raise Exception(SecCopyErrorMessageString(rc))


def SecKeychainAddGenericPassword(service, account, passwd):
    passwd = passwd.encode('utf-8')
    rc = sf.SecKeychainAddGenericPassword(
            None,
            len(service),
            service,
            len(account),
            account,
            len(passwd),
            passwd,
            None)
    if rc:
        raise Exception(SecCopyErrorMessageString(rc))


class OSXKeychain(object):
    def __init__(self):
        SecKeychainSetUserInteractionAllowed(True)
        if not SecKeychainGetStatus().SecUnlockState:
            logging.info("Unlock keychain fail")

    def get_password(self):
        return SecKeychainFindGenericPassword(APPNAME, USAGE, False)

    def set_password(self, passwd):
        logging.info("do setpasswd")
        itm = SecKeychainFindGenericPassword(APPNAME, USAGE, True)
        logging.info("item exists? %s", itm is not None)
        if itm is None:
            logging.info("create new")
            SecKeychainAddGenericPassword(APPNAME, USAGE, passwd)
        else:
            logging.info("update existing")
            SecKeychainItemModifyAttributesAndData(itm, passwd)
            cf.CFRelease(itm)


def test_main():
    s = OSXKeychain()
    if sys.argv[2] == 'pwget':
        p = s.get_password()
        p = p.encode() if p is not None else b''
        sys.stdout.write(b'Password: "' + p + b'"\n')
    elif sys.argv[2] == 'pwset':
        s.set_password(sys.argv[3])
    else:
        sys.stdout.write(b"unknown command\n")


def main():
    def quit_now(x, y):
        logging.info("Got TERM signal")
        raise Quit()

    signal.signal(signal.SIGTERM, quit_now)

    store = OSXKeychain()

    try:
        while 1:
            receivedMessage = getMessage()
            if 'type' not in receivedMessage:
                raise InvalidMessage()
            if receivedMessage['type'] == 'pwget':
                if 'name' not in receivedMessage:
                    raise InvalidMessage("pwget requires argument 'name'")
                logging.debug("Get password for %s", receivedMessage['name'])
                p = store.get_password()
                p = p.decode() if p is not None else None
                sendMessage({'type': 'pwgetreply',
                             'value': p,
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
                sendMessage({'type': 'comcheckreply', 'success': True, 'os': 'mac', 'version': __version__})
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
    path_ff = ('~/Library/Application Support/Mozilla/NativeMessagingHosts/',
               '/Library/Application Support/Mozilla/NativeMessagingHosts/')
    path_chrome = ('~/Library/Application Support/Google/Chrome/NativeMessagingHosts/',
                   '/Library/Google/Chrome/NativeMessagingHosts/')
    path_chromium = ('~/Library/Application Support/Chromium/NativeMessagingHosts',
                     '/Library/Application Support/Chromium/NativeMessagingHosts/')

    args = sys.argv[2:]
    paths = []
    if not any(a in args for a in ('firefox', 'chrome', 'chromium', 'all')):
        sys.stdout.write(b'Usage:\n  '
                         b'pwvault_gateway_dbus.py install [--global] {firefox|chrome|chromium|all}\n'
                         b'\n  --global will install system wide, otherwise current user only\n')
        return

    if 'firefox' in args or 'all' in args:
        paths.append(path_ff[1 if '--global' in args else 0])
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

    dst = os.path.join(dst, 'pwvault_gateway_osx')
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
