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
 * js-ctypes interface to windows credential vault
 *
 **/

exports.win = (function(){
try {
    var {Cu} = require('chrome');
    Cu.import('resource://gre/modules/ctypes.jsm');
} catch(e) {
    console.error("Failed to load js-ctypes");
    return null;
}

var sf,cf;
try {
    kern32 = ctypes.open('Kernel32.dll');
    lib = ctypes.open('advapi32.dll');
	msvcrt = ctypes.open('msvcrt');
} catch(e) {
    console.error("Failed to load advapi32");
    return null;
}

const
    DWORD = ctypes.uint32_t,
    LPTSTR = ctypes.jschar.ptr,
    LPBYTE = ctypes.uint8_t.ptr,
    FILETIME = ctypes.StructType('FILETIME', [{'dwLowDateTime':DWORD}, {'dwHighDateTime':DWORD}]),
    CREDENTIAL = ctypes.StructType('CREDENTIAL', [
        {'Flags': DWORD},
        {'Type': DWORD},
        {'TargetName': LPTSTR},
        {'Comment': LPTSTR},
        {'LastWritten': FILETIME},
        {'CredentialBlobSize': DWORD},
        {'CredentialBlob': LPBYTE},
        {'Persist': DWORD},
        {'AttributeCount': DWORD},
        {'Attributes': ctypes.voidptr_t},
        {'TargetAlias': LPTSTR},
        {'UserName': LPTSTR}]),
    PCREDENTIAL = CREDENTIAL.ptr,
    CRED_TYPE_GENERIC = 1,
    CRED_PERSIST_LOCAL_MACHINE = 2;

const
    CredRead = lib.declare('CredReadW', ctypes.winapi_abi, ctypes.bool, LPTSTR, DWORD, DWORD, PCREDENTIAL.ptr),
    CredWrite = lib.declare('CredWriteW', ctypes.winapi_abi, ctypes.bool, PCREDENTIAL, DWORD),
    CredFree = lib.declare('CredFree', ctypes.winapi_abi, ctypes.void_t, ctypes.voidptr_t),
    GetLastError = kern32.declare('GetLastError', ctypes.winapi_abi, DWORD),
	memcpy = msvcrt.declare('memcpy', ctypes.winapi_abi, ctypes.void_t, ctypes.voidptr_t, ctypes.voidptr_t, ctypes.size_t);


function readPassword(service) {
    var x, pc = PCREDENTIAL();
    if (! CredRead(service, CRED_TYPE_GENERIC, 0, pc.address())) {
		let err = GetLastError();
		if (err)
			throw new Error("wincred: read failed "+ GetLastError());
        else
			return ""; // no such service
		return;
    }
    // byte array (of utf16) to string:
	x = ctypes.jschar.array(pc.contents.CredentialBlobSize/2)();
	memcpy(x, pc.contents.CredentialBlob, pc.contents.CredentialBlobSize);
    x = x.readString();
    CredFree(pc);
	return x;
}

function writePassword(service, account, passwd) {
	var pwtype = ctypes.jschar.array(passwd.length);
    // some gymnastics to get a byte-array of the utf16 string
	var pwdx = pwtype(passwd);
	var pwd = ctypes.uint8_t.array(pwtype.size)();
	memcpy(pwd, pwdx, pwtype.size);
	
	var tname = ctypes.jschar.array()(service);
	var uname = ctypes.jschar.array()(account);
	
    c = new CREDENTIAL();
    c.Flags = 0;
    c.Type = CRED_TYPE_GENERIC;
    c.TargetName = tname;
    c.CredentialBlobSize = pwd.length;
    c.CredentialBlob = pwd;
    c.Persist = CRED_PERSIST_LOCAL_MACHINE;
    c.AttributeCount = 0;
    c.Attributes = null;
    c.TargetAlias = null;
    c.UserName = uname;

    if (!CredWrite(c.address(), 0)) {
		let err = GetLastError();
		if (err)
			console.log("wincred: failed store", GetLastError());
		else
			console.log("wincred: nothing to update");
	}
}

return {
	setPassword: writePassword,
	getPassword: readPassword
};

})();
