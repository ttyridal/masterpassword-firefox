window.mpw=function(name, password){
    var key,
        keyofs = Module.ccall('get_masterkey', 'number', [], []);
    const
        NSgeneral = "com.lyndir.masterpassword",
        NSlogin = "com.lyndir.masterpassword.login",
        NSanswer = "com.lyndir.masterpassword.answer";

    if (!Module.ccall('mp_key', 'number', ['string','string'], [password,name]))
    {
        alert("keying failed");
        return null;
    }
    // the underlaying code will reuse the key memory. By taking
    // a copy here, we can reset it before the call.
    key = new Uint8Array(Module.HEAPU8.subarray(keyofs, keyofs+64));



    function mp_seed(site, count, type) {
        var namespace, hmac;
        switch (type){
            case 'nx': namespace = NSlogin; break;
            case 'px': namespace = NSanswer; break;
            default: namespace = NSgeneral; break;
        }
        Module.HEAPU8.set(key, keyofs);
        hmac = Module.ccall('mp_seed', 'number', ['string','number','string'], [site,count,namespace]);
        if (hmac == 0) return undefined;
        hmac = new Uint8Array(Module.HEAPU8.subarray(hmac, hmac+32));
        return hmac;
    }

    function mp_password(site, count, type) {
        var passChars,
            retval,
            i,
            template,
            hmac = mp_seed(site, count, type);

        if (!hmac) {
            console.error('masterpassword site seeding failed');
            return;
        }

        switch (type) {
            case 'i': template = ["nnnn"]; break;
            case 'b': template = ["aaanaaan", "aannaaan", "aaannaaa"]; break;
            case 's': template = ["Cvcn"]; break;
            case 'm': template = ["CvcnoCvc", "CvcCvcno"]; break;
            case 'l': template = ["CvcvnoCvcvCvcv", "CvcvCvcvnoCvcv", "CvcvCvcvCvcvno", "CvccnoCvcvCvcv", "CvccCvcvnoCvcv",
                                  "CvccCvcvCvcvno", "CvcvnoCvccCvcv", "CvcvCvccnoCvcv", "CvcvCvccCvcvno", "CvcvnoCvcvCvcc",
                                  "CvcvCvcvnoCvcc", "CvcvCvcvCvccno", "CvccnoCvccCvcv", "CvccCvccnoCvcv", "CvccCvccCvcvno",
                                  "CvcvnoCvccCvcc", "CvcvCvccnoCvcc", "CvcvCvccCvccno", "CvccnoCvcvCvcc", "CvccCvcvnoCvcc",
                                  "CvccCvcvCvccno"]; break;
            case 'x': template = ["anoxxxxxxxxxxxxxxxxx","axxxxxxxxxxxxxxxxxno"]; break;
            case 'nx':
            case 'n': template = ["cvccvcvcv"]; break;
            case 'px':
            case 'p': template = ["cvcc cvc cvccvcv cvc", "cvc cvccvcvcv cvcv", "cv cvccv cvc cvcvccv"]; break;
            default:
                console.error('unknown password type', type);
                return;
        }
        template = template[hmac[0] % template.length];

        retval = [];
        for (i = 0; i < template.length; i++) {
            switch(template[i])
            {
                case 'V': passChars = "AEIOU"; break;
                case 'C': passChars = "BCDFGHJKLMNPQRSTVWXYZ";break;
                case 'v': passChars = "aeiou"; break;
                case 'c': passChars = "bcdfghjklmnpqrstvwxyz"; break;
                case 'A': passChars = "AEIOUBCDFGHJKLMNPQRSTVWXYZ"; break;
                case 'a': passChars = "AEIOUaeiouBCDFGHJKLMNPQRSTVWXYZbcdfghjklmnpqrstvwxyz"; break;
                case 'n': passChars = "0123456789"; break;
                case 'o': passChars = "@&%?,=[]_:-+*$#!'^~;()/."; break;
                case 'x': passChars = "AEIOUaeiouBCDFGHJKLMNPQRSTVWXYZbcdfghjklmnpqrstvwxyz0123456789!@#$%^&*()"; break;
                case ' ': passChars = " "; break;
                default: return NULL;
            }
            retval.push(passChars[hmac[i+1] % passChars.length]);
        }
        return retval.join('');
    }


    return {
        sitepassword : mp_password,
        key_id : function() {
            Module.HEAPU8.set(key, keyofs);
            return Module.ccall('sha256_digest', 'string', ['number','number'], [keyofs, 64]);
        }
    };
};
