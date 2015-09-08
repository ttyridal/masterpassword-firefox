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
 * js-ctypes interface to osx keychain
 *
 **/

exports.osx = (function(){
try {
    var {Cu} = require('chrome');
    Cu.import('resource://gre/modules/ctypes.jsm');
} catch(e) {
    console.error("Failed to load js-ctypes");
    return null;
}

var sf,cf;
try { 
    sf = ctypes.open('/System/Library/Frameworks/Security.framework/Versions/Current/Security'); 
    cf = ctypes.open('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation');
} catch(e) {
    console.error("Failed to load libraries for osx keychain");
    return null;
}

const 
    _CFString = ctypes.StructType('CFString'),
    _SecKeychain = ctypes.StructType('SecKeychain'),
    _SecKeychainItem = ctypes.StructType('SecKeychainItem'),
    SecKeychainRef = _SecKeychain.ptr,
    SecKeychainItemRef = _SecKeychainItem.ptr,
    CFStringRef = _CFString.ptr,
    CFIndex = ctypes.long,
    CFStringEncoding = ctypes.int,
    SecKeychainAttributeList = ctypes.voidptr_t,
    SecKeychainStatus = ctypes.uint32_t,
    OSStatus = ctypes.int;

const
    kCFStringEncodingMacRoman = 0,
    kCFStringEncodingUTF8 = 0x08000100,
    errSecItemNotFound = -25300;


const
    CFStringGetCString = cf.declare('CFStringGetCString', ctypes.default_abi, ctypes.bool, 
            CFStringRef, ctypes.char.ptr, CFIndex, CFStringEncoding),
    CFStringGetLength = cf.declare('CFStringGetLength', ctypes.default_abi, CFIndex,
            CFStringRef),
    CFStringCreateWithBytes = cf.declare('CFStringCreateWithBytes', ctypes.default_abi, CFStringRef,
            ctypes.voidptr_t, ctypes.uint8_t.ptr, CFIndex, CFStringEncoding, ctypes.bool),
    CFRelease = cf.declare('CFRelease', ctypes.default_abi, ctypes.void_t, 
            ctypes.voidptr_t),

    _SecCopyErrorMessageString = sf.declare('SecCopyErrorMessageString', ctypes.default_abi, CFStringRef,
            OSStatus, ctypes.voidptr_t),
    _SecKeychainAddGenericPassword = sf.declare('SecKeychainAddGenericPassword', ctypes.default_abi, OSStatus,
            SecKeychainRef,
            ctypes.uint32_t, ctypes.char.ptr, //service name
            ctypes.uint32_t, ctypes.char.ptr, //account name
            ctypes.uint32_t, ctypes.char.ptr, //password data
            SecKeychainItemRef),
    _SecKeychainFindGenericPassword = sf.declare('SecKeychainFindGenericPassword', ctypes.default_abi, OSStatus,
            SecKeychainRef,
            ctypes.uint32_t, ctypes.char.ptr, //service name
            ctypes.uint32_t, ctypes.char.ptr, //account name
            ctypes.uint32_t.ptr, ctypes.voidptr_t.ptr, //password data
            SecKeychainItemRef.ptr),
    _SecKeychainGetStatus = sf.declare('SecKeychainGetStatus', ctypes.default_abi, OSStatus,
            SecKeychainRef, SecKeychainStatus.ptr),
    _SecKeychainItemFreeContent = sf.declare('SecKeychainItemFreeContent', ctypes.default_abi, OSStatus,
            ctypes.voidptr_t, ctypes.voidptr_t),
    _SecKeychainItemModifyAttributesAndData = sf.declare('SecKeychainItemModifyAttributesAndData', ctypes.default_abi, OSStatus,
            SecKeychainItemRef, ctypes.voidptr_t, ctypes.uint32_t, ctypes.char.ptr);
    _SecKeychainSetUserInteractionAllowed = sf.declare('SecKeychainSetUserInteractionAllowed', ctypes.default_abi, OSStatus, 
            ctypes.bool);

function cfstring_to_js(cfstr) {
    var l = CFStringGetLength(cfstr),
        cstr_x = ctypes.char.array(l*4)(),
        cstr = ctypes.cast(cstr_x.address(), ctypes.char.ptr);
    if (! CFStringGetCString(cfstr, cstr, l*4, kCFStringEncodingUTF8)) {
        console.error("Failed to CFStringGetCString");
        return undefined;
    } else
        return cstr.readString();
}

function SecCopyErrorMessageString(rc) {
    var cfstr = _SecCopyErrorMessageString(rc, null),
        s = cfstring_to_js(cfstr) + ' ('+rc+')'; 
    CFRelease(cfstr);
    return s;
}

function SecKeychainGetStatus() {
    var stat = SecKeychainStatus(), 
        res = {},
        rc;
    rc = _SecKeychainGetStatus(null, stat.address());
    if (rc != 0) throw new Error(SecCopyErrorMessageString(rc));
    if (stat.value & 1) res['SecUnlockState'] = 1;
    if (stat.value & 2) res['SecReadPerm'] = 1;
    if (stat.value & 4) res['SecWritePerm'] = 1;
    return res;
}

function SecKeychainSetUserInteractionAllowed(allowed) {
    var rc = _SecKeychainSetUserInteractionAllowed(allowed);
    if (rc != 0) throw new Error(SecCopyErrorMessageString(rc));
}

function SecKeychainItemFreeContent(attrList, data) {
    var rc = _SecKeychainItemFreeContent(attrList, data);
    if (rc != 0) throw new Error(SecCopyErrorMessageString(rc));
}

function SecKeychainFindGenericPassword(service, account, return_item) {
    var pw_len = ctypes.uint32_t(),
        item = null,
        itemr = null,
        pw_data = ctypes.voidptr_t(),
        rc;

    if (return_item) {
        item = SecKeychainItemRef();
        itemr = item.address();
    }

    rc = _SecKeychainFindGenericPassword(
            null,
            service.length,
            service,
            account.length,
            account,
            pw_len.address(),
            pw_data.address(),
            itemr);
    if (rc == errSecItemNotFound) return undefined;
    else if (rc != 0) throw new Error(SecCopyErrorMessageString(rc));

    let x = CFStringCreateWithBytes(
            null,
            ctypes.cast(pw_data, ctypes.uint8_t.ptr),
            pw_len.value,
            kCFStringEncodingUTF8,
            false);
    itemr = cfstring_to_js(x);
    CFRelease(x);

    SecKeychainItemFreeContent(null, pw_data);
    if (return_item)
        return item;
    else
        return itemr;
}

function SecKeychainItemModifyAttributesAndData(itm, new_passwd) {
    new_passwd = ctypes.char.array()(new_passwd);

    var rc = _SecKeychainItemModifyAttributesAndData(
            itm, 
            null, 
            new_passwd.length - 1, 
            new_passwd);
    if (rc != 0) throw new Error(SecCopyErrorMessageString(rc));
}

function SecKeychainAddGenericPassword(service, account, passwd) {
    passwd = ctypes.char.array()(passwd);
    var rc = _SecKeychainAddGenericPassword(
            null,
            service.length,
            service,
            account.length,
            account,
            passwd.length-1,
            passwd,
            null);
    if (rc != 0) throw new Error(SecCopyErrorMessageString(rc));
}


SecKeychainSetUserInteractionAllowed(true);
if ( ! 'SecUnlockState' in SecKeychainGetStatus())
    console.log("Unlock keychain fail");


return {
    setPassword: function(service, account, passwd) {
        console.log("do setpasswd");
        var itm = SecKeychainFindGenericPassword(service, account, true);
        console.log("item exists?",itm);
        if (itm === undefined) {
            console.log("create new");
            SecKeychainAddGenericPassword(service, account, passwd);
        }
        else {
            SecKeychainItemModifyAttributesAndData(itm, passwd);
            CFRelease(itm);
        }
    },
    getPassword: function(service, account) {
        return new Promise(function(resolve, fail){
            var pw = SecKeychainFindGenericPassword(service, account, false);
            resolve(pw);
        });
    },
};
})();
